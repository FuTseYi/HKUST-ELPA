'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {exportData}=require('../scripts/export-question-bank.cjs');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const bank=path.join(root,'question-bank');
const readJson=name=>JSON.parse(fs.readFileSync(path.join(bank,name),'utf8'));

test('proposed canonical JSON is losslessly identical to existing question-bank sources',()=>{
  const current=exportData();
  for(const [name,oldData] of Object.entries(current))
    if(name==='questions.json'){
      const actual=readJson(name);
      assert.deepEqual(actual.pastQuestionIds,oldData.pastQuestionIds);
      assert.deepEqual(actual.legacyQuestionAliases,oldData.legacyQuestionAliases);
      for(const [bank,group] of Object.entries(oldData.banks))
        assert.deepEqual(actual.banks[bank].items.slice(0,group.items.length),group.items);
    }else if(name==='advice.json')
      assert.deepEqual(readJson(name).slice(0,oldData.length),oldData);
    else if(name==='appearances.json'){
      const actual=readJson(name);
      for(const [id,entries] of Object.entries(oldData))
        assert.deepEqual(actual[id].slice(0,entries.length),entries);
    }else assert.deepEqual(readJson(name),oldData);
  const questions=readJson('questions.json');
  const ids=new Set(Object.entries(questions.banks).flatMap(([name,bank])=>
    bank.items.map(item=>name+'-'+item.num)));
  assert.ok(ids.has('A-附'));
  assert.equal(questions.legacyQuestionAliases['A-附'],'C-16');
  assert.equal(questions.legacyQuestionAliases['C-18'],'A-3');
  assert.equal(questions.pastQuestionIds.length,25);
  assert.equal(Object.keys(questions.legacyQuestionAliases).length,14);
  assert.equal(readJson('appearances.json')['D-5'][0].issueNumber,57);
  assert.equal(readJson('appearances.json')['C-10'][0].issueNumber,58);
});

test('Python generator accepts the checked-in migration snapshot',()=>{
  const py=process.platform==='win32'?'python':'python3';
  const os=require('node:os');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-proposed-json-'));
  try {
    const output=path.join(temp,'generated');
    const result=spawnSync(py,[path.join(root,'scripts/build-question-data.py'),
      '--input',bank,'--output',output],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    for(const name of ['questions','appearances','advice','taxonomy'])
      assert.ok(fs.statSync(path.join(output,name+'.js')).size>0);
  }finally {
    fs.rmSync(temp,{force:true,recursive:true});
  }
});
