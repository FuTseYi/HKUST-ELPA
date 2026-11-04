'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
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
