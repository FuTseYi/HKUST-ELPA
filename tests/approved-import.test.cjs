'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {test}=require('node:test');
const importer=path.resolve(__dirname,'../scripts/import-approved-submission.cjs');
const bank=path.resolve(__dirname,'../question-bank/questions.js');
function attempt(input,question,issueNumber) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-approved-'));
  fs.mkdirSync(path.join(root,'question-bank'));
  fs.copyFileSync(bank,path.join(root,'question-bank/questions.js'));
  const encoded=Buffer.from(JSON.stringify({
    version:1,term:'2027 Fall',question,subquestions:'a. Why?\nb. How?',
    source:'firsthand',...input
  })).toString('base64url');
  const event={issue:{number:issueNumber,title:'[ELPA 投稿] [2027 Fall] Sample',
    body:'<!-- elpa-submission-v1:'+encoded+' -->'}};
  const eventFile=path.join(root,'event.json');
  fs.writeFileSync(eventFile,JSON.stringify(event));
  const result=spawnSync(process.execPath,[importer],{
    cwd:root,env:{...process.env,GITHUB_EVENT_PATH:eventFile,GITHUB_OUTPUT:''},
    encoding:'utf8'
  });
  const contents=fs.readFileSync(path.join(root,'question-bank/questions.js'),'utf8');
  const doc=path.join(root,'question-bank/community-submissions.md');
  fs.rmSync(root,{recursive:true,force:true});
  return {result,contents,docExists:fs.existsSync(doc)};
}
test('reviewed issue imports a stable non-sequential question ID',()=>{
  const {result,contents}=attempt({},'This is a unique sample question about teamwork?',42);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Import status: added/);
  assert.match(contents,/"num":1000042/);
  assert.match(contents,/"subs":\[\{"en":"a\. Why\?"/);
  assert.doesNotThrow(()=>new Function(contents+'\nreturn BANKS.D.items.length'));
});
test('exact duplicate does not change bank',()=>{
  const {result,contents}=attempt({},'Explain one of your projects.',43);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Import status: duplicate/);
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
