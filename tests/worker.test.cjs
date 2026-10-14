'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');

const source=fs.readFileSync(path.resolve(__dirname,'../worker/src/index.js'),'utf8');
const baseBody={
  term:'2027 Fall',question:'Can you explain interdisciplinary research to first-year students?',
  subquestions:'a. Why does it matter?\nb. Give an example.',source:'firsthand',
  turnstileToken:'mock-valid-token'
};
function makeWorker({siteverify={success:true,hostname:'futseyi.github.io',action:'elpa_submit'},rateLimit={success:true}}={}){
  const calls=[];
  const sandbox={
    module:{exports:{}},
    Request, Response, URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array,
    AbortSignal, console,
    btoa:(s)=>Buffer.from(s,'binary').toString('base64'),
    fetch:async(url,init)=>{
      calls.push({url:String(url),init});
      if(String(url).includes('/siteverify'))return Response.json(siteverify);
      if(String(url).includes('/repos/FuTseYi/HKUST-ELPA/issues'))
        return Response.json({html_url:'https://github.com/FuTseYi/HKUST-ELPA/issues/123'},{status:201});
      throw Error('Unexpected network request to '+url);
    }
  };
  vm.runInNewContext(source.replace('export default {','module.exports = {'),sandbox,{filename:'worker.js'});
  const env={
    SUBMISSIONS_DISABLED:'false',
    GITHUB_TOKEN:'FAKE-NOT-A-CREDENTIAL',
    TURNSTILE_SECRET:'FAKE-NOT-A-SECRET',
    SUBMISSION_LIMITER:{limit:async()=>rateLimit}
  };
  const request=(body,headers={})=>new Request('https://hkust-elpa-submissions.futseyi.workers.dev/submit',{
    method:'POST',headers:{Origin:'https://futseyi.github.io','Content-Type':'application/json',...headers},
    body:JSON.stringify(body)
  });
  return {handler:sandbox.module.exports,env,calls,request};
}
test('disabled switch rejects all submissions before any GitHub request',async()=>{
 const x=makeWorker();x.env.SUBMISSIONS_DISABLED='true';
 const r=await x.handler.fetch(x.request(baseBody),x.env);
 assert.equal(r.status,503);assert.equal(x.calls.length,0);
});
test('missing or foreign origin rejected',async()=>{
 const x=makeWorker();const r=await x.handler.fetch(x.request(baseBody,{Origin:'https://bad.example'}),x.env);
 assert.equal(r.status,403);assert.equal(x.calls.length,0);
});
test('rate limit checked before Turnstile or GitHub',async()=>{
 const x=makeWorker({rateLimit:{success:false}});
 const r=await x.handler.fetch(x.request(baseBody),x.env);
 assert.equal(r.status,429);assert.equal(x.calls.length,0);
});
test('valid long Chinese submission accepted and queued only as an issue',async()=>{
 const x=makeWorker();
 const body={...baseBody,question:'考'.repeat(900),subquestions:'试'.repeat(1800)};
 assert.ok(Buffer.byteLength(JSON.stringify(body),'utf8')>6500,'fixture exceeds previous cap');
 const response=await x.handler.fetch(x.request(body),x.env);
 assert.equal(response.status,201,await response.text());
 assert.equal(x.calls.length,2);
 const payload=JSON.parse(x.calls[1].init.body);
 assert.equal(payload.labels[0],'submission:pending');
 assert.match(payload.body,/待审核/);
 assert.ok(!payload.body.includes('CF-Connecting-IP'));
});
test('invalid Turnstile hostname/action cannot create GitHub issue',async()=>{
 for(const bad of [{success:true,hostname:'attacker.example',action:'elpa_submit'},
                  {success:true,hostname:'futseyi.github.io',action:'other'},
                  {success:false,hostname:'futseyi.github.io',action:'elpa_submit'}]){
  const x=makeWorker({siteverify:bad});
  const r=await x.handler.fetch(x.request(baseBody),x.env);
  assert.equal(r.status,403);
  assert.equal(x.calls.length,1);
 }
});
test('payload size cap rejects oversized request without reaching GitHub',async()=>{
 const x=makeWorker();
 const body={...baseBody,question:'中'.repeat(9000)};
 const r=await x.handler.fetch(x.request(body),x.env);
 assert.ok([400,413].includes(r.status));
 assert.equal(x.calls.length,0);
});
test('empty or unconfigured secrets fail closed',async()=>{
 const x=makeWorker();x.env.GITHUB_TOKEN='';
 const r=await x.handler.fetch(x.request(baseBody),x.env);
 assert.equal(r.status,503);assert.equal(x.calls.length,0);
});

test('missing or malformed enable flag fails closed (opt-in only)',async()=>{
 for(const value of [undefined,'TRUE','0','false ']){
  const x=makeWorker();
  if(value===undefined)delete x.env.SUBMISSIONS_DISABLED;
  else x.env.SUBMISSIONS_DISABLED=value;
  const r=await x.handler.fetch(x.request(baseBody),x.env);
  assert.equal(r.status,503);
  assert.equal(x.calls.length,0);
 }
});
