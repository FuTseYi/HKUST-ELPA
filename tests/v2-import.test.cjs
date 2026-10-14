'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const importer=path.resolve(__dirname,'../scripts/import-approved-submission.cjs');
const bank=path.resolve(__dirname,'../question-bank/questions.js');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-v2-'));
 fs.mkdirSync(path.join(root,'question-bank'));
 for(const name of ['questions.js','appearances.js','advice.js'])
   fs.copyFileSync(path.resolve(__dirname,'../question-bank/'+name),path.join(root,'question-bank',name));
 return {root,close:()=>fs.rmSync(root,{recursive:true,force:true}),
   read:name=>fs.readFileSync(path.join(root,'question-bank',name),'utf8'),
   run:(data,number)=>{
     const marker=Buffer.from(JSON.stringify(data)).toString('base64url');
     const event={issue:{number,title:'[ELPA 投稿] [2026 Fall] Sample',body:'<!-- elpa-submission-v2:'+marker+' -->'}};
     const eventFile=path.join(root,'event-'+number+'.json');
     fs.writeFileSync(eventFile,JSON.stringify(event));
     return spawnSync(process.execPath,[importer],{cwd:root,
       env:{...process.env,GITHUB_EVENT_PATH:eventFile,GITHUB_OUTPUT:''},encoding:'utf8'});
   }
 };
}
const question=(main='How can you prepare for interdisciplinary research at university?')=>({
 version:2,kind:'question',term:'2026 Fall',examStage:'start',
 main:{en:main,cn:'你如何为跨学科研究做准备？'},
 subs:[
  {en:'What was your main challenge?',cn:'你遇到的主要挑战是什么？'},
  {en:'Can you explain with an example?',cn:'你能举例解释吗？'},
  {en:'What did you learn?',cn:'你学到了什么？'}],
 source:'firsthand'
});
const advice=()=>({version:2,kind:'advice',phase:'before',
 tags:['speaking-strategy','time-management'],title:'考前素材准备',
 body:'尽量准备真实经历，并练习在有限时间内提炼清晰观点。'});
test('v2 new question keeps bilingual main, dynamic subs, and stable ID',()=>{
 const f=fixture();try{
  const r=f.run(question(),101);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/status: added/);
  assert.match(f.read('questions.js'),/"num":1000101/);
  assert.match(f.read('questions.js'),/"cn":"你如何为跨学科研究做准备？"/);
  assert.match(f.read('questions.js'),/"en":"What was your main challenge\?","cn":"你遇到的主要挑战是什么？"/);
  assert.match(f.read('appearances.js'),/"D-1000101"/);
  assert.match(f.read('appearances.js'),/"examStage": "start"/);
  assert.match(f.read('community-submissions.md'),/Issue #101/);
  assert.doesNotThrow(()=>new Function(f.read('questions.js')+'\nreturn BANKS.D.items.length'));
 }finally{f.close();}
});
test('repeat of an existing question preserves its ID and adds a session occurrence',()=>{
 const f=fixture();try{
  const original=f.read('questions.js');
  const data=question('Explain one of your projects.');
  const r=f.run(data,102);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/status: linked/);
  assert.equal(f.read('questions.js'),original);
  assert.match(f.read('appearances.js'),/"D-4"/);
  assert.doesNotMatch(f.read('appearances.js'),/D-1000102/);
 }finally{f.close();}
});
test('same new question from different semester reuses stable ID and records both appearances',()=>{
 const f=fixture();try{
  assert.equal(f.run(question(),103).status,0);
  const different={...question(),term:'2027 Spring',examStage:'end',source:'secondhand'};
  const r=f.run(different,104);
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/status: linked/);
  const appearance=f.read('appearances.js');
  assert.match(appearance,/"issueNumber": 103/);
  assert.match(appearance,/"issueNumber": 104/);
  assert.match(appearance,/"term": "2027 Spring"/);
  assert.match(appearance,/"examStage": "end"/);
  assert.doesNotMatch(f.read('questions.js'),/1000104/);
 }finally{f.close();}
});
test('advice is single language and classified by exact tag codes',()=>{
 const f=fixture();try{
  const a=advice();const r=f.run(a,105);
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/status: added/);
  assert.match(f.read('advice.js'),/ADV-105/);
  assert.match(f.read('advice.js'),/speaking-strategy/);
  assert.match(f.read('community-advice.md'),/考前素材准备/);
  assert.equal(f.read('questions.js'),fs.readFileSync(bank,'utf8'));
 }finally{f.close();}
});
test('incomplete Chinese and unknown taxonomy codes are rejected',()=>{
 const bads=[
  {...question(),main:{en:question().main.en,cn:''}},
  {...question(),subs:[{en:'English only',cn:''}]},
  {...question(),examStage:'unknown'},
  {...advice(),tags:['free-form-label']},
  {...advice(),body:'太短'}
 ];
 const f=fixture();try{
  for(const [i,data] of bads.entries()){
   const r=f.run(data,110+i);
   assert.notEqual(r.status,0,JSON.stringify({i,stdout:r.stdout}));
  }
  assert.equal(f.read('appearances.js').trim(),'/* Reviewed appearances of a canonical question across semesters. */\nconst ELPA_APPEARANCES = {};'.trim());
 }finally{f.close();}
});
test('untrusted quote/JS delimiters remain data without injection',()=>{
 const f=fixture();try{
  const a={...advice(),body:'A quote with "; process.exit(99); // and <script> remains text, not code.'};
  assert.equal(f.run(a,106).status,0);
  assert.doesNotThrow(()=>new Function(f.read('advice.js')+'\nreturn ELPA_ADVICE.length'));
  assert.match(f.read('advice.js'),/process.exit\(99\)/);
 }finally{f.close();}
});
test('same Issue imported twice is idempotent',()=>{
 const f=fixture();try{
  const a=question();assert.equal(f.run(a,107).status,0);
  const p=f.read('appearances.js');
  const r=f.run(a,107);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/status: duplicate/);
  assert.equal(f.read('appearances.js'),p);
 }finally{f.close();}
});
