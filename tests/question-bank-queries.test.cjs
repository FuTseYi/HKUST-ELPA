'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const bank=read('question-bank/questions.js');
const appearances=read('question-bank/appearances.js');
const queries=read('assets/js/question-bank-queries.js');

function loadQueries(){
  const context=vm.createContext({});
  vm.runInContext(bank+'\n'+appearances+'\n'+queries,context);
  return vm.runInContext('({all:elpaAllPracticeIds(),term:elpaLatestTerm(),current:elpaCurrentQuestionIds(),archived:elpaArchivedQuestionIds(),reported:elpaReportedTerms("D-5"),prior:elpaReportedTerms("A-1"),fast:BANKS.F.items.length,alias:LEGACY_QUESTION_ALIASES["A-附"]})',context);
}

test('historical IDs and reported terms survive independent query extraction',()=>{
  const result=JSON.parse(JSON.stringify(loadQueries()));
  assert.equal(result.alias,'C-16');
  assert.ok(result.all.includes('A-附'));
  assert.ok(result.all.includes('D-5'));
  assert.equal(result.term,'2026 Fall');
  assert.ok(result.current.includes('D-5'));
  assert.ok(result.archived.includes('A-1'));
  assert.deepEqual(result.reported,['2026 Fall']);
  assert.ok(result.fast>0);
  assert.equal(new Set([...result.current,...result.archived]).size,result.all.length);
});

test('practice loads data, appearances and grouping logic before interactive UI',()=>{
  const html=read('practice.html');
  const files=['question-bank/questions.js','question-bank/appearances.js',
    'question-bank/taxonomy.js','assets/js/question-bank-queries.js',
    'assets/js/practice-storage.js','assets/js/practice.js','assets/js/practice-session.js'];
  const offsets=files.map(file=>html.indexOf('<script src="./'+file+'"></script>'));
  assert.ok(offsets.every(offset=>offset>=0),'Missing required script');
  assert.deepEqual([...offsets].sort((a,b)=>a-b),offsets);
  assert.doesNotMatch(bank,/function elpaLatestTermForIds/);
  assert.match(queries,/function elpaLatestTermForIds/);
});
