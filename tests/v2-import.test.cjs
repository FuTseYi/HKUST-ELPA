'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const importer=path.resolve(__dirname,'../scripts/import-approved-submission.cjs');
const bank=path.resolve(__dirname,'../question-bank/questions.js');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-v2-'));
 fs.mkdirSync(path.join(root,'question-bank'));
 for(const name of ['questions.js','fast-track.js','appearances.js','advice.js'])
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
  assert.match(f.read('questions.js'),/"term":"2026 Fall"/);
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
  assert.match(f.read('advice.js'),/"track": "regular"/);
  assert.match(f.read('advice.js'),/speaking-strategy/);
  assert.match(f.read('community-advice.md'),/考前素材准备/);
  assert.equal(f.read('questions.js'),fs.readFileSync(bank,'utf8'));
 }finally{f.close();}
});
test('Fast Track advice imports with its track and never changes question IDs',()=>{
 const f=fixture();try{
  const original=f.read('questions.js');
  const r=f.run({...advice(),track:'fast-track'},205);
  assert.equal(r.status,0,r.stderr);
  assert.match(f.read('advice.js'),/"track": "fast-track"/);
  assert.match(f.read('community-advice.md'),/考试方式：fast-track/);
  assert.equal(f.read('questions.js'),original);
 }finally{f.close();}
});
test('missing English and unknown taxonomy codes are rejected',()=>{
 const bads=[
  {...question(),main:{en:'',cn:'只有中文'}},
  {...question(),subs:[{en:'',cn:'可选中文'}]},
  {...question(),examStage:'unknown'},
  {...question(),campus:'unknown-campus'},
  {...question(),track:'unknown-assessment'},
  {...advice(),tags:['free-form-label']},
  {...advice(),track:'unknown-assessment'},
  {...advice(),body:'太短'}
 ];
 const f=fixture();try{
  for(const [i,data] of bads.entries()){
   const r=f.run(data,110+i);
   assert.notEqual(r.status,0,JSON.stringify({i,stdout:r.stdout}));
  }
  assert.equal(f.read('appearances.js'),fs.readFileSync(path.resolve(__dirname,'../question-bank/appearances.js'),'utf8'));
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

test('current-term grouping archives other sessions without renumbering saved IDs',()=>{
 const f=fixture();try{
  assert.equal(f.run(question(),301).status,0);
  const spring={...question('Can you describe your current academic interests in simple terms?'),
    term:'2027 Spring'};
  assert.equal(f.run(spring,302).status,0);
  const classify=new Function(f.read('questions.js')+'\n'+f.read('appearances.js')+`
    return {
      fall:elpaCurrentQuestionIds('2026 Fall'),
      spring:elpaCurrentQuestionIds('2027 Spring'),
      past:elpaArchivedQuestionIds('2027 Spring'),
      latest:elpaLatestTerm(),
      sorted:elpaArchivedQuestionIds(elpaLatestTerm())
    };`);
  const groups=classify();
  assert.equal(groups.fall.length,13); // The 12 original 2026 Fall reports + Issue #301.
  assert.deepEqual([...groups.spring],['D-1000302']);
  assert.ok(groups.past.includes('D-1'));
  assert.ok(groups.past.includes('D-1000301'));
  assert.ok(!groups.past.includes('D-1000302'));
  assert.equal(groups.latest,'2027 Spring');
  const older=question('How should a student plan a research project with limited time?');
  assert.equal(f.run(older,303).status,0);
  const latestAfterOlder=new Function(f.read('questions.js')+'\n'+f.read('appearances.js')+
    '\nreturn elpaLatestTerm();')();
  assert.equal(latestAfterOlder,'2027 Spring');
  assert.ok(groups.sorted.includes('D-1'));
  assert.ok(!groups.sorted.includes('D-1000302'));
  const every=new Set([...groups.spring,...groups.past]);
  assert.equal(every.size,elpaTotal());
  function elpaTotal(){return 25+12+2;}
 }finally{f.close();}
});

test('Fast Track and campus categories keep distinct canonical IDs and review records',()=>{
 const f=fixture();try{
  const fast={...question('What research technique improved your work recently?'),
    campus:'nansha',track:'fast-track'};
  const x=f.run(fast,501);
  assert.equal(x.status,0,x.stderr);
  assert.match(x.stdout,/status: added/);
  assert.match(f.read('fast-track.js'),/"num":1000501/);
  assert.match(f.read('appearances.js'),/"F-1000501"/);
  assert.doesNotMatch(f.read('questions.js'),/1000501/);
  const clear={...fast,campus:'clear-water-bay'};
  assert.equal(f.run(clear,502).status,0);
  assert.match(f.read('fast-track.js'),/"num":1000502/);
  assert.match(f.read('appearances.js'),/"T-1000502"/);
  const regular={...clear,track:'regular'};
  assert.equal(f.run(regular,503).status,0);
  assert.match(f.read('fast-track.js'),/"num":1000503/);
  assert.match(f.read('appearances.js'),/"H-1000503"/);
  // A second submission into a formerly empty bank must remain valid JS.
  assert.equal(f.run({...regular,main:{
    en:'What academic skills are most valuable to a new graduate student?',
    cn:'研究生最重要的学术技能是什么？'}},504).status,0);
  assert.doesNotThrow(()=>new Function(f.read('questions.js')+'\n'+f.read('fast-track.js')+'\nreturn BANKS.H.items.length'));
 }finally{f.close();}
});
test('existing Fast Track English wording is reused, not duplicated',()=>{
 const f=fixture();try{
  const record={...question('Please introduce yourself and explain why you decided to pursue this degree.'),
    campus:'nansha',track:'fast-track'};
  const r=f.run(record,505);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/status: linked/);
  assert.match(f.read('appearances.js'),/"F-1"/);
  assert.doesNotMatch(f.read('fast-track.js'),/1000505/);
 }finally{f.close();}
});

test('regular and Fast Track each show their own latest reviewed term and historic reports',()=>{
 const f=fixture();try{
  const fast={...question('How did you prepare to communicate effectively with your research supervisor?'),
    campus:'nansha',track:'fast-track',term:'2027 Spring'};
  const older={...question('How did you prepare to explain your research to new students?'),
    campus:'nansha',track:'fast-track',term:'2026 Fall'};
  assert.equal(f.run(fast,601).status,0);
  assert.equal(f.run(older,602).status,0);
  const source=f.read('questions.js')+'\n'+f.read('fast-track.js')+'\n'+
    f.read('appearances.js')+'\n';
  const grouping=new Function(source+`
    const fastIds=BANKS.F.items.map(x=>'F-'+x.num);
    const nanshaRegular=elpaLatestTerm();
    const fastLatest=elpaLatestTermForIds(fastIds);
    const current=fastIds.filter(id=>elpaReportedTerms(id).includes(fastLatest));
    return {nanshaRegular,fastLatest,current,past:fastIds.filter(id=>!current.includes(id)),
      originalSource:elpaReportedTerms('F-1')};
  `)();
  assert.equal(grouping.nanshaRegular,'2026 Fall');
  assert.equal(grouping.fastLatest,'2027 Spring');
  assert.deepEqual([...grouping.current],['F-1000601']);
  assert.ok(grouping.past.includes('F-1'));
  assert.ok(grouping.past.includes('F-1000602'));
  assert.deepEqual([...grouping.originalSource],[]);
  assert.equal(grouping.current.length+grouping.past.length,14);
 }finally{f.close();}
});

test('linked repeat adds an encounter and supplemental followups do not inflate count',()=>{
 const f=fixture();try{
  const linked={...question('Explain one of your projects.'),linkedQuestionId:'D-4',
    intent:'encounter',main:{en:'Explain one of your projects.',cn:''},subs:[]};
  const first=f.run(linked,801);
  assert.equal(first.status,0,first.stderr);
  assert.match(first.stdout,/status: linked/);
  const supplement={...linked,intent:'supplement',
    subs:[{en:'What tools did you use?',cn:''}]};
  const extra=f.run(supplement,802);
  assert.equal(extra.status,0,extra.stderr);
  assert.match(extra.stdout,/status: linked/);
  assert.doesNotMatch(f.read('questions.js'),/1000801/);
  assert.match(f.read('appearances.js'),/"intent": "encounter"/);
  assert.match(f.read('appearances.js'),/"intent": "supplement"/);
  assert.match(f.read('appearances.js'),/What tools did you use\?/);
  assert.match(f.read('community-submissions.md'),/仅补充小问/);
 }finally{f.close();}
});
test('tampered linked ID cannot credit a different question',()=>{
 const f=fixture();try{
  const wrong={...question('Explain one of your projects.'),linkedQuestionId:'D-5',intent:'encounter'};
  const failure=f.run(wrong,803);
  assert.notEqual(failure.status,0);
  assert.match(failure.stderr,/Linked question ID does not match/);
  assert.equal(f.read('appearances.js'),fs.readFileSync(path.resolve(__dirname,'../question-bank/appearances.js'),'utf8'));
  const notLinked={...wrong,intent:'supplement',linkedQuestionId:undefined};
  const failed=f.run(notLinked,804);
  assert.notEqual(failed.status,0);
 }finally{f.close();}
});
test('new question accepts optional Chinese explanation without inventing translation',()=>{
 const f=fixture();try{
  const data={...question('How do you prepare to communicate your research to audiences?'),
    main:{en:'How do you prepare to communicate your research to audiences?',cn:''},
    subs:[{en:'What example would you give?',cn:''}]};
  const r=f.run(data,805);
  assert.equal(r.status,0,r.stderr);
  assert.match(f.read('questions.js'),/"cn":""/);
  assert.match(f.read('appearances.js'),/"D-1000805"/);
 }finally{f.close();}
});
