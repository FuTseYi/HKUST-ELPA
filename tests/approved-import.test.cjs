'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {test}=require('node:test');
const importer=path.resolve(__dirname,'../scripts/import-approved-submission.cjs');
const bank=path.resolve(__dirname,'../question-bank/questions.js');
function attempt(input,question,issueNumber,displayPrefix='') {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-approved-'));
  fs.mkdirSync(path.join(root,'question-bank'));
  fs.copyFileSync(bank,path.join(root,'question-bank/questions.js'));
  const encoded=Buffer.from(JSON.stringify({
    version:1,term:'2027 Fall',question,subquestions:'a. Why?\nb. How?',
    source:'firsthand',...input
  })).toString('base64url');
  const event={issue:{number:issueNumber,title:'[ELPA 投稿] [2027 Fall] Sample',
    body:displayPrefix+'<!-- elpa-submission-v1:'+encoded+' -->'}};
  const eventFile=path.join(root,'event.json');
  fs.writeFileSync(eventFile,JSON.stringify(event));
  const result=spawnSync(process.execPath,[importer],{
    cwd:root,env:{...process.env,GITHUB_EVENT_PATH:eventFile,GITHUB_OUTPUT:''},
    encoding:'utf8'
  });
  const contents=fs.readFileSync(path.join(root,'question-bank/questions.js'),'utf8');
  const doc=path.join(root,'question-bank/community-submissions.md');
  const docExists=fs.existsSync(doc);
  const docContents=docExists?fs.readFileSync(doc,'utf8'):'';
  fs.rmSync(root,{recursive:true,force:true});
  return {result,contents,docExists,docContents};
}
test('reviewed issue imports a stable non-sequential question ID',()=>{
  const {result,contents,docExists,docContents}=attempt({},'This is a unique sample question about teamwork?',42);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Import status: added/);
  assert.match(contents,/"num":1000042/);
  assert.equal(docExists,true);
  assert.match(docContents,/Issue #42/);
  assert.match(contents,/"subs":\[\{"en":"a\. Why\?"/);
  assert.doesNotThrow(()=>new Function(contents+'\nreturn BANKS.D.items.length'));
});
test('exact duplicate does not change bank',()=>{
  const {result,contents,docExists}=attempt({},'Explain one of your projects.',43);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Import status: duplicate/);
  assert.equal(docExists,false);
  assert.doesNotMatch(contents,/"num":1000043/);
});
test('untrusted input remains a string, never executable JS',()=>{
  const {result,contents}=attempt({},'Explain this term: "; process.exit(15); //',44);
  assert.equal(result.status,0,result.stderr);
  assert.doesNotThrow(()=>new Function(contents+'\nreturn BANKS.D.items.length'));
});
test('malformed issue is rejected',()=>{
  const {result}=attempt({source:'unsupported'},'Explain this phrase to students in a class?',45);
  assert.notEqual(result.status,0);
});

test('Chinese recollection is explicitly identified as non-verbatim',()=>{
  const {result,contents}=attempt({},'如何向不同专业的本科生解释复杂学术问题？',46);
  assert.equal(result.status,0,result.stderr);
  assert.match(contents,/中文题意回忆，未核实英文原题/);
});
test('more than 30 subquestions fails rather than silently dropping content',()=>{
  const many=Array.from({length:31},(_,i)=>'Subquestion '+i).join('\n');
  const {result}=attempt({subquestions:many},'Please describe a unique research topic in simple English.',47);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Too many subquestions/);
});

test('quoted forged marker in visible text cannot replace trusted metadata record',()=>{
  const forged=Buffer.from(JSON.stringify({version:1,term:'2027 Fall',question:'Malicious substitute content',subquestions:'',source:'secondhand'})).toString('base64url');
  const prefix='> <!-- elpa-submission-v1:'+forged+' -->\\n\\n';
  const {result,contents}=attempt({},'What qualities make an effective research collaborator?',48,prefix);
  assert.equal(result.status,0,result.stderr);
  assert.match(contents,/effective research collaborator/);
  assert.doesNotMatch(contents,/Malicious substitute content/);
});
