'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const {read:readArtifact}=require('../scripts/validate-site.cjs');
const read=file=>readArtifact(file).replace(/\?v=[a-f0-9]{12}(?=")/g,'');
const data=JSON.parse(read('question-bank/questions.json'));
const appearances=JSON.parse(read('question-bank/appearances.json'));
const queries=read('assets/js/question-bank-queries.js');

function loadQueries(){
  const context=vm.createContext({});
  vm.runInContext('const BANKS='+JSON.stringify(data.banks)+';\n'+
    'const PAST_QUESTION_IDS='+JSON.stringify(data.pastQuestionIds)+';\n'+
    'const LEGACY_QUESTION_ALIASES='+JSON.stringify(data.legacyQuestionAliases)+';\n'+
    'const ELPA_APPEARANCES='+JSON.stringify(appearances)+';\n'+queries,context);
  return vm.runInContext('({all:elpaAllPracticeIds(),term:elpaLatestTerm(),current:elpaCurrentQuestionIds(),archived:elpaArchivedQuestionIds(),reported:elpaReportedTerms("D-5"),prior:elpaReportedTerms("A-1"),fast:BANKS.F.items.length,hasHistoricalId:BANKS.A.items.some(item=>String(item.num)==="附"),alias:LEGACY_QUESTION_ALIASES["A-附"]})',context);
}

test('historical IDs and reported terms survive independent query extraction',()=>{
  const result=JSON.parse(JSON.stringify(loadQueries()));
  assert.equal(result.alias,'C-16');
  assert.ok(result.hasHistoricalId);
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
  assert.equal(typeof data.banks,'object');
  assert.match(queries,/function elpaLatestTermForIds/);
});
