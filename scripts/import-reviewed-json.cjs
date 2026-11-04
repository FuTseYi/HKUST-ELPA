/* Migration candidate: import an owner-completed Issue to reviewed JSON data.
 * Inputs are read from the event JSON file (never interpolated into shell).
 * Run against the trusted repository checkout only.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const writeJSON=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n','utf8');
const eventFile=process.env.GITHUB_EVENT_PATH || process.argv[2];
if(!eventFile)throw Error('GitHub event payload required');
const event=JSON.parse(fs.readFileSync(eventFile,'utf8'));
const issue=event.issue||{};
// Synthetic browser-verification Issues are never eligible for canonical publication.
// This also prevents rerunning the historical completed Issue #13 from reimporting it.
if(/\bTEST ONLY\b/i.test(String(issue.title||'')))
  throw Error('Synthetic verification Issue cannot be published');
/* v2 is additive: v1 data format and stable IDs remain compatible. */
if(/^<!-- elpa-submission-v2:[A-Za-z0-9_-]+ -->\s*$/m.test(issue.body||'')){
  importV2(event);
  process.exit(0);
}
const number=issue.number;
const marker=(issue.body||'').match(/^<!-- elpa-submission-v1:([A-Za-z0-9_-]+) -->\s*$/m);
if(!Number.isSafeInteger(number)||number<1||!marker||!String(issue.title||'').startsWith('[ELPA 投稿]')){
  throw Error('Issue is not a structured ELPA submission');
}
const data=JSON.parse(Buffer.from(marker[1],'base64url').toString('utf8'));
const valid=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max&&!/[\u0000-\u001f]/.test(v.replace(/[\r\n]/g,''));
if(data.version!==1||!valid(data.question,8,1000)||
   !valid(data.subquestions,0,2000)||
   !( /^20\d{2} (Spring|Fall)$/.test(data.term||'')||data.term==='Other / Unknown')||
   !['firsthand','secondhand'].includes(data.source))
  throw Error('Malformed or unsupported submission');
const bankPath=path.join('question-bank','questions.json');
const bankData=readJSON(bankPath);
const banks=bankData.banks;
if(!banks||!banks.D||!Array.isArray(banks.D.items))throw Error('Missing D bank');
const normalized=(s)=>String(s).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
const subject=normalized(data.question);
const existing=Object.values(banks).flatMap(bank=>bank.items||[]);
const output=(status, recorded)=>{
  console.log('Import status:',status);
  if(process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT,'result='+status+'\nrecorded='+recorded+'\n');
};
if(existing.some(x=>normalized(x.en)===subject)){
  // A matching question does not mean this Issue was previously published.
  const file=path.join('question-bank','community-submissions.md');
  const doc=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  const recorded=banks.D.items.some(item=>item.num===1000000+number) ||
    new RegExp('Issue #'+number+'(?![0-9])').test(doc);
  output('duplicate',recorded);process.exit(0);
}
// Numeric ID is based on GitHub Issue, not an append index, to remain stable
// even if multiple approvals are reviewed concurrently.
const num=1000000+number;
if(banks.D.items.some(x=>x.num===num))throw Error('Duplicate generated question ID');
const subs=data.subquestions.trim()
  ?data.subquestions.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
  :[];
if(subs.length>30)throw Error('Too many subquestions; review the original Issue');
const subItems=subs.map(en=>({en,cn:''}));
const item={
  num,
  en:data.question.trim(),
  cn:data.term+'｜社区投稿（'+(data.source==='firsthand'?'考生亲历':'同学转述')+'；非官方核实原题）',
  recallTag:/[\u3400-\u9fff]/u.test(data.question) ? '中文题意回忆，未核实英文原题' : '考生英文回忆，非官方原题',
  subs:subItems
};
banks.D.items.push(item);
writeJSON(bankPath,bankData);
const docPath=path.join('question-bank','community-submissions.md');
const doc=fs.existsSync(docPath)?fs.readFileSync(docPath,'utf8'):
  '# 已审核社区投稿 · Community Submissions\n\n> 学生自主整理、非官方资料。此处的“已审核”仅指维护者同意收录，不代表学校确认原题。\n';
const quote=(text)=>String(text).split(/\r?\n/).map(s=>'> '+s.replace(/</g,'&lt;')).join('\n');
const source=data.source==='firsthand'?'本人亲历':'同学转述';
const addition='\n## '+data.term+' · Issue #'+number+
  '\n\n来源：'+source+' ｜ [投稿记录](https://github.com/FuTseYi/HKUST-ELPA/issues/'+number+')'+
  ' ｜ 练习题 ID：D-'+num+
  '\n\n**主问题（回忆版）**\n\n'+quote(data.question)+
  '\n\n**提示小问**\n\n'+(data.subquestions?quote(data.subquestions):'> 未记录')+'\n';
fs.writeFileSync(docPath,doc+addition,'utf8');
output('added',true);


/* v2 structured import is kept as a scoped branch of this single entrypoint. */
function importV2(event){
const F=path.join.bind(path);
const valid=(s,min,max)=>typeof s==='string' && s.trim().length>=min &&
  s.trim().length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);
const text=(s)=>s.trim();
const normalized=(s)=>String(s).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
const quote=(s)=>String(s).split(/\r?\n/).map(x=>'> '+x.replace(/</g,'&lt;')).join('\n');
const readOptionalJSON=(file,defaultValue)=>fs.existsSync(file)?readJSON(file):defaultValue;
const output=(status, recorded=true)=>{
  console.log('Import status:',status);
  if(process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT,'result='+status+'\nrecorded='+recorded+'\n');
};
const taxonomy=readOptionalJSON(F('question-bank','taxonomy.json'),null);
if(!taxonomy)throw Error('Missing question-bank taxonomy');
const allowed=(group,value)=>typeof value==='string'&&Object.hasOwn(taxonomy[group],value);
function validate(data){
 if(!data||data.version!==2)return false;
 if(data.kind==='question')
   return typeof data.term==='string' && /^20\d{2} (Spring|Fall)$/.test(data.term) &&
     (data.campus===undefined||allowed('campuses',data.campus)) &&
     (data.track===undefined||allowed('tracks',data.track)) &&
     allowed('examStages',data.examStage) &&
     data.main && valid(data.main.en,8,1000) && valid(data.main.cn,0,1000) &&
     Array.isArray(data.subs) && data.subs.length<=20 &&
     data.subs.every(s=>s && valid(s.en,1,400)&&valid(s.cn,0,400)) &&
     (data.alternatives===undefined||(Array.isArray(data.alternatives) && data.alternatives.length<=1 &&
       data.alternatives.every(s=>s&&valid(s.en,8,1000)&&valid(s.cn,0,1000)))) &&
     allowed('sourceTypes',data.source) &&
     (data.linkedQuestionId===undefined||
       (typeof data.linkedQuestionId==='string'&&/^[A-DFHT]-[0-9]+$/.test(data.linkedQuestionId)&&
        allowed('contributionIntents',data.intent))) &&
     (data.intent===undefined||data.linkedQuestionId!==undefined) &&
     (data.intent!=='supplement'||data.subs.length>0||(data.alternatives&&data.alternatives.length>0));
 if(data.kind==='advice')
   return (data.track===undefined||allowed('tracks',data.track)) &&
     allowed('advicePhases',data.phase) &&
     Array.isArray(data.tags) && data.tags.length>=1 && data.tags.length<=4 &&
     new Set(data.tags).size===data.tags.length && data.tags.every(t=>allowed('adviceTags',t)) &&
     valid(data.title,4,120) && valid(data.body,20,6000);
 return false;
}
function appendDoc(file,header,entry){
 const prior=fs.existsSync(file)?fs.readFileSync(file,'utf8'):header;
 fs.writeFileSync(file,prior+entry,'utf8');
}
function runV2(event){
 const issue=event.issue||{}, number=issue.number;
 if(!Number.isSafeInteger(number)||number<1||number>9999999||
    !String(issue.title||'').startsWith('[ELPA 投稿]'))throw Error('Invalid issue metadata');
 const mark=(issue.body||'').match(/^<!-- elpa-submission-v2:([A-Za-z0-9_-]+) -->\s*$/m);
 if(!mark||mark[1].length>32768)throw Error('Missing or oversized v2 marker');
 let data;
 try{data=JSON.parse(Buffer.from(mark[1],'base64url').toString('utf8'));}catch{throw Error('Malformed v2 record');}
 if(!validate(data))throw Error('Invalid v2 contribution');
 const bankFile=F('question-bank','questions.json');
 const appFile=F('question-bank','appearances.json');
 const adviceFile=F('question-bank','advice.json');
 const questionDoc=F('question-bank','community-submissions.md');
 const adviceDoc=F('question-bank','community-advice.md');
 if(data.kind==='advice'){
   const existing=readOptionalJSON(adviceFile,[]);
   if(!Array.isArray(existing))throw Error('Advice database invalid');
   const id='ADV-'+number;
   if(existing.some(x=>x.id===id)){output('duplicate');return;}
   existing.push({id,issueNumber:number,track:data.track||'regular',phase:data.phase,tags:data.tags,
     title:text(data.title),body:text(data.body)});
   writeJSON(adviceFile,existing);
   appendDoc(adviceDoc,'# 社区备考经验 · Reviewed Preparation Advice\n\n> 考生分享，不代表学校官方建议。\n',
     '\n## '+id+' · '+quote(text(data.title))+'\n\n考试方式：'+(data.track||'regular')+' ｜ 阶段：'+data.phase+
     ' ｜ 标签：'+data.tags.join(', ')+' ｜ [原始投稿](https://github.com/FuTseYi/HKUST-ELPA/issues/'+number+')'+
     '\n\n'+quote(text(data.body))+'\n');
   output('added');return;
 }
 const campus=data.campus||'nansha',track=data.track||'regular';
 const bankKey=campus==='nansha'?(track==='regular'?'D':'F'):(track==='regular'?'H':'T');
 const bankData=readJSON(bankFile);
 const banks=bankData.banks;
 if(!banks||!banks.D||!banks[bankKey]||!Array.isArray(banks[bankKey].items))
   throw Error('Question bank invalid');
 const display=bankData.pastQuestionIds;
 const known=new Set([...display,...banks.D.items.map(x=>'D-'+x.num)]);
 const eligibleBanks=bankKey==='D'?['A','B','C','D']:[bankKey];
 const exact=[];
 for(const bank of eligibleBanks)
   for(const it of banks[bank].items||[])
     if(normalized(it.en)===normalized(data.main.en))exact.push({id:bank+'-'+it.num,item:it});
 exact.sort((a,b)=>Number(known.has(b.id))-Number(known.has(a.id)));
 // Explicit linked ID is accepted only for a real canonical question whose
 // campus/track and exact original English text both match the current bank.
 // Old v2 reports without IDs keep their legacy exact-English deduplication.
 let matched=exact[0]||null;
 if(data.linkedQuestionId){
   const linked=exact.find(x=>x.id===data.linkedQuestionId);
   if(!linked)throw Error('Linked question ID does not match the selected assessment and canonical wording');
   matched=linked;
 }
 if(data.intent==='supplement'&&!matched)throw Error('Content supplements require an existing question');
 const id=matched?matched.id:bankKey+'-'+(1000000+number);
 const app=readOptionalJSON(appFile,{});
 if(!app||typeof app!=='object'||Array.isArray(app))throw Error('Appearance database invalid');
 const appearances=Array.isArray(app[id])?app[id]:[];
 if(appearances.some(x=>x.issueNumber===number)){output('duplicate');return;}
 const occurrence={issueNumber:number,term:data.term,examStage:data.examStage,
   source:data.source,campus,track,intent:data.intent||'encounter',
   ...(data.alternatives?.length?{alternatives:data.alternatives.map(x=>({en:text(x.en),cn:text(x.cn)}))}:{}),
   ...(data.subs.length?{subs:data.subs.map(x=>({en:text(x.en),cn:text(x.cn)}))}:{} )};
 app[id]=[...appearances,occurrence];
 if(!matched){
   const num=1000000+number;
   if(banks[bankKey].items.some(x=>x.num===num))throw Error('Duplicate question ID');
   const item={num,term:data.term,en:text(data.main.en),cn:text(data.main.cn),
     subs:data.subs.map(x=>({en:text(x.en),cn:text(x.cn)}))};
   banks[bankKey].items.push(item);
   writeJSON(bankFile,bankData); }
 writeJSON(appFile,app);
 const campusLabel=campus==='nansha'?'南沙校区':'清水湾校区';
 const trackLabel=track==='regular'?'常规 ELPA':'ELPA Fast Track';
 appendDoc(questionDoc,'# 已审核社区投稿 · Community Submissions\n\n> 学生投稿经审核后整理收录。\n',
   '\n## '+data.term+' · '+campusLabel+' · '+trackLabel+' · Issue #'+number+
   '\n\n考试阶段：'+data.examStage+
   ' ｜ 来源：'+(data.source==='firsthand'?'本人亲历':'同学转述')+
   ' ｜ 类型：'+(data.intent==='supplement'?'补充题目内容':'新增考试经历')+
   ' ｜ 关联题目：'+id+
   ' ｜ [投稿记录](https://github.com/FuTseYi/HKUST-ELPA/issues/'+number+')'+
   '\n\n**English**\n\n'+quote(text(data.main.en))+
   '\n\n**中文**\n\n'+quote(text(data.main.cn))+
   '\n\n**相似问法**\n\n'+(data.alternatives?.length?data.alternatives.map(s=>
      quote(text(s.en))+'\n'+quote(text(s.cn))).join('\n\n'):'> 无')+
   '\n\n**提示小问**\n\n'+(data.subs.length?data.subs.map((s,i)=>
      '\n'+(i+1)+'. '+quote(text(s.en))+'\n'+quote(text(s.cn))).join('\n'):'> 无')+'\n');
 output(matched?'linked':'added');
};
  return runV2(event);
}
