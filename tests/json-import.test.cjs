'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const importer=path.join(root,'scripts/import-reviewed-json.cjs');
const names=['questions.json','appearances.json','taxonomy.json','advice.json'];
function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-reviewed-json-'));
  const bank=path.join(dir,'question-bank');
  fs.mkdirSync(bank);
  for(const name of names)
    fs.copyFileSync(path.join(root,'question-bank',name),path.join(bank,name));
  const read=name=>JSON.parse(fs.readFileSync(path.join(bank,name),'utf8'));
  const raw=name=>fs.readFileSync(path.join(bank,name),'utf8');
  const run=(data,issueNumber,version=data.version)=>{
    const marker=Buffer.from(JSON.stringify(data)).toString('base64url');
    const issue={number:issueNumber,title:'[ELPA 投稿] [2027 Fall] Review',
      body:'<!-- elpa-submission-v'+version+':'+marker+' -->'};
    const eventFile=path.join(dir,'event-'+issueNumber+'.json');
    const outputFile=path.join(dir,'output-'+issueNumber+'.txt');
    fs.writeFileSync(eventFile,JSON.stringify({issue}));
    fs.writeFileSync(outputFile,'');
    const result=spawnSync(process.execPath,[importer],{cwd:dir,encoding:'utf8',
      env:{...process.env,GITHUB_EVENT_PATH:eventFile,GITHUB_OUTPUT:outputFile}});
    return {...result,output:fs.readFileSync(outputFile,'utf8')};
  };
  return {dir,read,raw,run,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
const question=(en='How can you improve teamwork in an interdisciplinary research project?')=>({
  version:2,kind:'question',term:'2027 Spring',examStage:'start',
  main:{en,cn:''},subs:[{en:'Can you give a specific example?',cn:''}],source:'firsthand'
});
test('v2 JSON import preserves all historical IDs and creates one linked appearance',()=>{
  const f=fixture();try {
    const initial=f.read('questions.json');
    const oldCount=initial.banks.D.items.length;
    const a=f.run(question(),701);
    assert.equal(a.status,0,a.stderr);
    assert.match(a.output,/recorded=true/);
    const next=f.read('questions.json');
    assert.equal(next.banks.D.items.length,oldCount+1);
    assert.deepEqual(next.legacyQuestionAliases,initial.legacyQuestionAliases);
    assert.deepEqual(next.pastQuestionIds,initial.pastQuestionIds);
    assert.deepEqual(next.banks.D.items.slice(0,oldCount),initial.banks.D.items);
    assert.equal(next.banks.D.items.at(-1).num,1000701);
    assert.equal(f.read('appearances.json')['D-1000701'][0].issueNumber,701);
    const before=f.raw('appearances.json');
    const repeated=f.run(question(),701);
    assert.equal(repeated.status,0,repeated.stderr);
    assert.match(repeated.output,/recorded=true/);
    assert.equal(f.raw('appearances.json'),before);
  }finally{f.close();}
});
test('v2 duplicate linked encounter and supplement retain original question ID',()=>{
  const f=fixture();try{
    const en='Explain one of your projects.';
    const base=f.read('questions.json');
    const repeat={...question(en),linkedQuestionId:'D-4',intent:'encounter'};
    const first=f.run(repeat,702);
    assert.equal(first.status,0,first.stderr);
    assert.equal(f.read('questions.json').banks.D.items.length,base.banks.D.items.length);
    assert.ok(f.read('appearances.json')['D-4'].some(a=>a.issueNumber===702));
    const supplement={...repeat,intent:'supplement'};
    const second=f.run(supplement,703);
    assert.equal(second.status,0,second.stderr);
    assert.equal(f.read('appearances.json')['D-4'].at(-1).intent,'supplement');
    const wrong=f.run({...repeat,linkedQuestionId:'F-1'},704);
    assert.notEqual(wrong.status,0);
  }finally{f.close();}
});
test('v2 advice is only stored as reviewed JSON text',()=>{
  const f=fixture();try {
    const original=f.raw('questions.json');
    const advice={version:2,kind:'advice',track:'fast-track',phase:'before',
      tags:['speaking-strategy'],title:'准备练习的方法',
      body:'练习时先确定主问题的回答，再按现场要求组织自己熟悉的经历和示例。'};
    const result=f.run(advice,705);
    assert.equal(result.status,0,result.stderr);
    assert.equal(f.read('advice.json').at(-1).id,'ADV-705');
    assert.equal(f.raw('questions.json'),original);
    assert.equal(f.run(advice,705).status,0);
    assert.equal(f.read('advice.json').filter(a=>a.id==='ADV-705').length,1);
  }finally{f.close();}
});
test('legacy v1 structured Issues still import with stable ID',()=>{
  const f=fixture();try {
    const data={version:1,term:'2027 Fall',
      question:'How would you present a research project to an unfamiliar audience?',
      subquestions:'Why does your work matter?',source:'firsthand'};
    const result=f.run(data,706);
    assert.equal(result.status,0,result.stderr);
    const item=f.read('questions.json').banks.D.items.at(-1);
    assert.equal(item.num,1000706);
    assert.deepEqual(item.subs,[{en:'Why does your work matter?',cn:''}]);
    assert.match(f.run(data,706).output,/recorded=true/);
  }finally{f.close();}
});
test('malformed data and synthetic Issue are rejected without changing JSON',()=>{
  const f=fixture();try{
    const before=names.map(name=>f.raw(name));
    const invalid={...question(),track:'unknown-assessment'};
    assert.notEqual(f.run(invalid,707).status,0);
    const injection={...question(),main:{en:'',cn:'无效'}};
    assert.notEqual(f.run(injection,708).status,0);
    assert.deepEqual(names.map(name=>f.raw(name)),before);
  }finally{f.close();}
});

test('reviewed JSON Issue flows through Python build into browser grouping without losing IDs',()=>{
  const f=fixture();
  try {
    const previous=f.read('questions.json');
    const item=question('How do you explain an academic project to new students?');
    item.term='2028 Spring';
    item.examStage='mid';
    const imported=f.run(item,711);
    assert.equal(imported.status,0,imported.stderr);
    assert.match(imported.output,/recorded=true/);

    const generated=path.join(f.dir,'generated');
    const python=process.platform==='win32'?'python':'python3';
    const built=spawnSync(python,[path.join(root,'scripts/build-question-data.py'),
      '--input',path.join(f.dir,'question-bank'),'--output',generated],{encoding:'utf8'});
    assert.equal(built.status,0,built.stderr);
    const context=vm.createContext({});
    for(const file of ['questions.js','appearances.js','taxonomy.js']){
      vm.runInContext(fs.readFileSync(path.join(generated,file),'utf8'),context,
        {filename:file,timeout:1000});
    }
    vm.runInContext(fs.readFileSync(path.join(root,'assets/js/question-bank-queries.js'),'utf8'),
      context,{filename:'question-bank-queries.js',timeout:1000});
    const actual=JSON.parse(JSON.stringify(vm.runInContext(
      '({latest:elpaLatestTerm(),current:elpaCurrentQuestionIds(),all:elpaAllPracticeIds(),alias:LEGACY_QUESTION_ALIASES["A-附"],extra:elpaReportedTerms("D-1000711")})',
      context,{timeout:1000})));
    assert.equal(actual.latest,'2028 Spring');
    assert.ok(actual.current.includes('D-1000711'));
    assert.ok(actual.all.includes('D-1000711'));
    assert.equal(actual.alias,previous.legacyQuestionAliases['A-附']);
    assert.deepEqual(actual.extra,['2028 Spring']);
    const after=f.read('questions.json');
    assert.deepEqual(after.pastQuestionIds,previous.pastQuestionIds);
    assert.deepEqual(after.banks.A,previous.banks.A);
    assert.deepEqual(after.banks.B,previous.banks.B);
    assert.deepEqual(after.banks.C,previous.banks.C);
    assert.deepEqual(after.banks.F,previous.banks.F);
  } finally { f.close(); }
});

test('invalid linked supplement cannot change reviewed JSON or generate fake history',()=>{
  const f=fixture();
  try {
    const before=names.map(name=>f.raw(name));
    const missing={...question('A previously unreported topic about future research priorities?'),
      linkedQuestionId:'D-999999',intent:'supplement'};
    const result=f.run(missing,712);
    assert.notEqual(result.status,0);
    assert.deepEqual(names.map(name=>f.raw(name)),before);
  } finally { f.close(); }
});
