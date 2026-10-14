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
    SUBMISSION_MODE:'public',
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

test('mode missing fails closed even when disabled flag is false',async()=>{
  const x=makeWorker();
  delete x.env.SUBMISSION_MODE;
  const r=await x.handler.fetch(x.request(baseBody),x.env);
  assert.equal(r.status,503);
  assert.equal(x.calls.length,0);
});
test('test window automatically expires and never reaches verification or GitHub',async()=>{
  const x=makeWorker();
  x.env.SUBMISSION_MODE='test';
  x.env.SUBMISSION_TEST_DEADLINE_MS=String(Date.now()-1000);
  x.env.SUBMISSION_TEST_QUESTION=baseBody.question;
  const r=await x.handler.fetch(x.request(baseBody),x.env);
  assert.equal(r.status,503);
  assert.equal(x.calls.length,0);
});
test('test window rejects non-allowlisted questions before Turnstile or GitHub',async()=>{
  const x=makeWorker();
  x.env.SUBMISSION_MODE='test';
  x.env.SUBMISSION_TEST_DEADLINE_MS=String(Date.now()+120000);
  x.env.SUBMISSION_TEST_QUESTION='TEST ONLY - HKUST-ELPA integration verification';
  const r=await x.handler.fetch(x.request(baseBody),x.env);
  assert.equal(r.status,403);
  assert.equal(x.calls.length,0);
});
test('test window accepts only exact allowlisted synthetic payload',async()=>{
  const x=makeWorker();
  const question='TEST ONLY - HKUST-ELPA integration verification';
  x.env.SUBMISSION_MODE='test';
  x.env.SUBMISSION_TEST_DEADLINE_MS=String(Date.now()+120000);
  x.env.SUBMISSION_TEST_QUESTION=question;
  const r=await x.handler.fetch(x.request({...baseBody,
    term:'2026 Fall',question,subquestions:'',source:'firsthand'}),x.env);
  assert.equal(r.status,201,await r.text());
  assert.equal(x.calls.length,2);
  assert.match(JSON.parse(x.calls[1].init.body).title,/TEST ONLY/);
});

test('both exact production origins have scoped CORS preflight, previews are rejected',async()=>{
  const x=makeWorker();
  for (const origin of ['https://futseyi.github.io','https://hkust-elpa.vercel.app']){
    const res=await x.handler.fetch(new Request('https://hkust-elpa-submissions.futseyi.workers.dev/submit',{
      method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'}
    }),x.env);
    assert.equal(res.status,204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'),origin);
    assert.equal(res.headers.get('Vary'),'Origin');
  }
  for (const origin of ['https://hkust-elpa-git-main.vercel.app','https://hkust-elpa.vercel.app.evil.test',
    'http://hkust-elpa.vercel.app','https://bad.example','null']){
    const res=await x.handler.fetch(new Request('https://hkust-elpa-submissions.futseyi.workers.dev/submit',{
      method:'OPTIONS',headers:{Origin:origin}
    }),x.env);
    assert.equal(res.status,403);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'),null);
  }
  assert.equal(x.calls.length,0);
});

test('Vercel-origin successful submission uses matching hostname from siteverify',async()=>{
  const x=makeWorker({siteverify:{success:true,hostname:'hkust-elpa.vercel.app',action:'elpa_submit'}});
  const response=await x.handler.fetch(x.request(baseBody,{Origin:'https://hkust-elpa.vercel.app'}),x.env);
  assert.equal(response.status,201);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://hkust-elpa.vercel.app');
  assert.equal(x.calls.length,2);
  assert.equal(JSON.parse(x.calls[1].init.body).labels[0],'submission:pending');
});

test('Turnstile siteverify hostname must match the exact calling origin',async()=>{
  for (const [origin,verifiedHostname] of [
    ['https://futseyi.github.io','hkust-elpa.vercel.app'],
    ['https://hkust-elpa.vercel.app','futseyi.github.io'],
    ['https://hkust-elpa.vercel.app','preview.vercel.app']
  ]){
    const x=makeWorker({siteverify:{success:true,hostname:verifiedHostname,action:'elpa_submit'}});
    const response=await x.handler.fetch(x.request(baseBody,{Origin:origin}),x.env);
    assert.equal(response.status,403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
    assert.equal(x.calls.length,1);
  }
});

test('disabled mode returns CORS-scoped response on both official sites',async()=>{
  for(const origin of ['https://futseyi.github.io','https://hkust-elpa.vercel.app']){
    const x=makeWorker();x.env.SUBMISSIONS_DISABLED='true';
    const response=await x.handler.fetch(x.request(baseBody,{Origin:origin}),x.env);
    assert.equal(response.status,503);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
    assert.equal(x.calls.length,0);
  }
});

const v2Question={
  version:2,kind:'question',term:'2027 Spring',examStage:'mid',
  main:{en:'How does interdisciplinary research help solve complex problems?',
    cn:'跨学科研究如何帮助解决复杂问题？'},
  subs:[
    {en:'Give an example.',cn:'请举例说明。'},
    {en:'What challenges could arise?',cn:'可能遇到什么挑战？'}
  ],source:'firsthand',turnstileToken:'mock-valid-token'
};
const v2Advice={
  version:2,kind:'advice',phase:'during',tags:['speaking-strategy','time-management'],
  title:'我的现场时间管理经验',
  body:'先明确表达观点，再结合真实例子说明，最后注意回答时间。',
  turnstileToken:'mock-valid-token'
};
test('v2 bilingual question passes verification and only creates a review Issue',async()=>{
  const x=makeWorker();
  const response=await x.handler.fetch(x.request(v2Question),x.env);
  assert.equal(response.status,201,await response.text());
  assert.equal(x.calls.length,2);
  const issue=JSON.parse(x.calls[1].init.body);
  assert.equal(issue.labels[0],'submission:pending');
  assert.match(issue.body,/elpa-submission-v2:/);
  assert.match(issue.body,/跨学科研究如何帮助解决复杂问题/);
  assert.match(issue.body,/可能遇到什么挑战/);
  assert.doesNotMatch(issue.body,/mock-valid-token/);
});
test('v2 campus and track are carried through the Issue marker, without leaking Turnstile tokens',async()=>{
  const x=makeWorker();
  const q={...v2Question,campus:'clear-water-bay',track:'fast-track'};
  const response=await x.handler.fetch(x.request(q),x.env);
  assert.equal(response.status,201,await response.text());
  const issue=JSON.parse(x.calls[1].init.body);
  assert.match(issue.body,/清水湾校区/);
  assert.match(issue.body,/ELPA Fast Track/);
  const marker=issue.body.match(/elpa-submission-v2:([A-Za-z0-9_-]+)/);
  assert.ok(marker,'machine-readable marker exists');
  const embedded=JSON.parse(Buffer.from(marker[1],'base64url').toString('utf8'));
  assert.equal(embedded.campus,'clear-water-bay');
  assert.equal(embedded.track,'fast-track');
  assert.equal(embedded.term,v2Question.term);
  assert.equal(Object.hasOwn(embedded,'turnstileToken'),false);
});
test('legacy v2 submissions remain compatible with default Nansha regular metadata',async()=>{
  const x=makeWorker();
  const response=await x.handler.fetch(x.request(v2Question),x.env);
  assert.equal(response.status,201);
  const issue=JSON.parse(x.calls[1].init.body);
  const marker=issue.body.match(/elpa-submission-v2:([A-Za-z0-9_-]+)/);
  const embedded=JSON.parse(Buffer.from(marker[1],'base64url').toString('utf8'));
  assert.equal(embedded.campus,'nansha');
  assert.equal(embedded.track,'regular');
});
test('v2 advice accepts one original-language title and article',async()=>{
  const x=makeWorker();
  const response=await x.handler.fetch(x.request(v2Advice),x.env);
  assert.equal(response.status,201,await response.text());
  const issue=JSON.parse(x.calls[1].init.body);
  assert.match(issue.title,/备考经验/);
  assert.match(issue.body,/speaking-strategy/);
  assert.match(issue.body,/elpa-submission-v2:/);
  assert.ok(!issue.body.includes('mock-valid-token'));
});
test('v2 rejects incomplete bilingual text and noncanonical categories before siteverify',async()=>{
  const bads=[
    {...v2Question,main:{...v2Question.main,cn:''}},
    {...v2Question,subs:[{en:'Why?',cn:''}]},
    {...v2Question,examStage:'unknown'},
    {...v2Question,campus:'untrusted-campus'},
    {...v2Question,track:'untrusted-track'},
    {...v2Question,subs:Array.from({length:21},()=>({en:'Why?',cn:'为什么？'}))},
    {...v2Advice,tags:['arbitrary-tag']},
    {...v2Advice,tags:['speaking-strategy','speaking-strategy']},
    {...v2Advice,body:'too short'}
  ];
  for(const invalid of bads){
    const x=makeWorker();
    const response=await x.handler.fetch(x.request(invalid),x.env);
    assert.equal(response.status,400);
    assert.equal(x.calls.length,0);
  }
});
test('v2 test-mode never enables arbitrary submissions',async()=>{
  const x=makeWorker();
  x.env.SUBMISSION_MODE='test';
  x.env.SUBMISSION_TEST_DEADLINE_MS=String(Date.now()+120000);
  x.env.SUBMISSION_TEST_QUESTION='TEST ONLY - approved';
  const response=await x.handler.fetch(x.request(v2Question),x.env);
  assert.equal(response.status,403);
  assert.equal(x.calls.length,0);
});
test('Vercel v2 verified hostname must match the caller',async()=>{
  const yes=makeWorker({siteverify:{success:true,hostname:'hkust-elpa.vercel.app',action:'elpa_submit'}});
  const accepted=await yes.handler.fetch(yes.request(v2Question,{Origin:'https://hkust-elpa.vercel.app'}),yes.env);
  assert.equal(accepted.status,201);
  const no=makeWorker({siteverify:{success:true,hostname:'futseyi.github.io',action:'elpa_submit'}});
  const rejected=await no.handler.fetch(no.request(v2Question,{Origin:'https://hkust-elpa.vercel.app'}),no.env);
  assert.equal(rejected.status,403);
  assert.equal(no.calls.length,1);
});
test('v2 body enforces byte-size bound with no external requests',async()=>{
  const x=makeWorker();
  const huge={...v2Advice,body:'考'.repeat(9000)};
  const response=await x.handler.fetch(x.request(huge),x.env);
  assert.ok(response.status===400||response.status===413);
  assert.equal(x.calls.length,0);
});
