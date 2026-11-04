'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const python=process.platform==='win32'?'py':'python3';
const pythonArgs=process.platform==='win32'?['-3']:[];
const pages=['index','guide','practice','sources','submit'];

test('portable site build publishes all pages and generates scripts from JSON',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-static-build-'));
  try{
    const dest=path.join(tmp,'site');
    const built=spawnSync(python,[...pythonArgs,path.join(root,'preview.py'),
      '--build-only','--output',dest],{cwd:root,encoding:'utf8'});
    assert.equal(built.status,0,built.stderr);
    for(const page of pages) assert.ok(fs.existsSync(path.join(dest,page+'.html')));
    for(const asset of ['submission-config.js','elpa_data.json',
      'assets/js/practice.js','assets/js/question-bank-queries.js',
      'assets/css/site.css','question-bank/previous-years.md'])
      assert.ok(fs.existsSync(path.join(dest,asset)),'Missing public asset: '+asset);
    const bank=JSON.parse(fs.readFileSync(path.join(root,'question-bank/questions.json'),'utf8'));
    const context=vm.createContext({});
    for(const script of ['questions','appearances','taxonomy','advice'])
      vm.runInContext(fs.readFileSync(path.join(dest,'question-bank',script+'.js'),'utf8'),
        context,{filename:script+'.js',timeout:1000});
    const generated=JSON.parse(JSON.stringify(vm.runInContext(
      '({banks:BANKS,ids:PAST_QUESTION_IDS,aliases:LEGACY_QUESTION_ALIASES})',context)));
    assert.deepEqual(generated.banks,bank.banks);
    assert.deepEqual(generated.ids,bank.pastQuestionIds);
    assert.deepEqual(generated.aliases,bank.legacyQuestionAliases);
    const references=fs.readFileSync(path.join(dest,'question-bank/fast-track.md'),'utf8');
    assert.match(references,/github\.com\/FuTseYi\/HKUST-ELPA\/blob\/main\/question-bank\/questions\.json/);
    const practice=fs.readFileSync(path.join(dest,'practice.html'),'utf8').replace(/\?v=[a-f0-9]{12}(?=")/g,'');
    assert.ok(practice.indexOf('question-bank/questions.js')<
      practice.indexOf('assets/js/question-bank-queries.js'));
    assert.equal(fs.existsSync(path.join(dest,'question-bank/questions.json')),false,
      'Browser output must not carry a second copy of canonical JSON');
    const before=fs.readFileSync(path.join(dest,'question-bank/questions.js'),'utf8');
    const again=spawnSync(python,[...pythonArgs,path.join(root,'preview.py'),
      '--build-only','--output',dest],{cwd:root,encoding:'utf8'});
    assert.equal(again.status,0,again.stderr);
    assert.equal(fs.readFileSync(path.join(dest,'question-bank/questions.js'),'utf8'),before);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('build refuses to replace canonical source data',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-invalid-output-'));
  try{
    const result=spawnSync(python,[...pythonArgs,path.join(root,'preview.py'),
      '--build-only','--output',path.join(root,'question-bank')],{cwd:root,encoding:'utf8'});
    assert.notEqual(result.status,0,'Refuse to overwrite tracked canonical data');
    assert.ok(fs.existsSync(path.join(root,'assets/js/practice.js')));
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
