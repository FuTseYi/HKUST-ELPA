/* Trusted importer for maintainer-approved v2 Issues.
 * Never execute issue text. All untrusted content is validated and JSON-stringified.
 */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const F=path.join.bind(path);
const valid=(s,min,max)=>typeof s==='string' && s.trim().length>=min &&
  s.trim().length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);
const text=(s)=>s.trim();
const normalized=(s)=>String(s).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
const quote=(s)=>String(s).split(/\r?\n/).map(x=>'> '+x.replace(/</g,'&lt;')).join('\n');
const saveJS=(file,name,value)=>fs.writeFileSync(file,'const '+name+' = '+JSON.stringify(value,null,2)+';\n','utf8');
const readJS=(file,name,defaultValue)=>{
  if(!fs.existsSync(file))return defaultValue;
  return vm.runInNewContext(fs.readFileSync(file,'utf8')+'\n;'+name,{}, {timeout:1000});
};
const output=(status)=>{
  console.log('Import status:',status);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'result='+status+'\n');
};
const tags=['exam-process','speaking-strategy','time-management','stress-management',
  'english-expression','ai-learning','exam-experience'];
function validate(data){
 if(!data||data.version!==2)return false;
 if(data.kind==='question')
   return /^20\d{2} (Spring|Fall)$/.test(data.term||'') &&
     (data.campus===undefined||['nansha','clear-water-bay'].includes(data.campus)) &&
     (data.track===undefined||['regular','fast-track'].includes(data.track)) &&
     ['start','mid','end'].includes(data.examStage) &&
     data.main && valid(data.main.en,8,1000) && valid(data.main.cn,0,1000) &&
     Array.isArray(data.subs) && data.subs.length<=20 &&
     data.subs.every(s=>s && valid(s.en,1,400)&&valid(s.cn,0,400)) &&
     (data.alternatives===undefined||(Array.isArray(data.alternatives) && data.alternatives.length<=1 &&
       data.alternatives.every(s=>s&&valid(s.en,8,1000)&&valid(s.cn,0,1000)))) &&
     ['firsthand','secondhand'].includes(data.source) &&
     (data.linkedQuestionId===undefined||
       (/^[A-DFHT]-[0-9]+$/.test(data.linkedQuestionId)&&
        ['encounter','supplement'].includes(data.intent))) &&
     (data.intent===undefined||data.linkedQuestionId!==undefined) &&
     (data.intent!=='supplement'||data.subs.length>0||(data.alternatives&&data.alternatives.length>0));
 if(data.kind==='advice')
   return (data.track===undefined||['regular','fast-track'].includes(data.track)) &&
     ['before','during','after'].includes(data.phase) &&
     Array.isArray(data.tags) && data.tags.length>=1 && data.tags.length<=4 &&
     new Set(data.tags).size===data.tags.length && data.tags.every(t=>tags.includes(t)) &&
     valid(data.title,4,120) && valid(data.body,20,6000);
 return false;
}
function appendDoc(file,header,entry){
 const prior=fs.existsSync(file)?fs.readFileSync(file,'utf8'):header;
 fs.writeFileSync(file,prior+entry,'utf8');
}
module.exports=function importV2(event){
 const issue=event.issue||{}, number=issue.number;
 if(!Number.isSafeInteger(number)||number<1||number>9999999||
    !String(issue.title||'').startsWith('[ELPA 投稿]'))throw Error('Invalid issue metadata');
 const mark=(issue.body||'').match(/^<!-- elpa-submission-v2:([A-Za-z0-9_-]+) -->\s*$/m);
 if(!mark||mark[1].length>32768)throw Error('Missing or oversized v2 marker');
 let data;
 try{data=JSON.parse(Buffer.from(mark[1],'base64url').toString('utf8'));}catch{throw Error('Malformed v2 record');}
 if(!validate(data))throw Error('Invalid v2 contribution');
 const bankFile=F('question-bank','questions.js');
 const appFile=F('question-bank','appearances.js');
 const adviceFile=F('question-bank','advice.js');
 const questionDoc=F('question-bank','community-submissions.md');
 const adviceDoc=F('question-bank','community-advice.md');
 if(data.kind==='advice'){
   const existing=readJS(adviceFile,'ELPA_ADVICE',[]);
   if(!Array.isArray(existing))throw Error('Advice database invalid');
   const id='ADV-'+number;
   if(existing.some(x=>x.id===id)){output('duplicate');return;}
   existing.push({id,issueNumber:number,track:data.track||'regular',phase:data.phase,tags:data.tags,
     title:text(data.title),body:text(data.body)});
   saveJS(adviceFile,'ELPA_ADVICE',existing);
   appendDoc(adviceDoc,'# 社区备考经验 · Reviewed Preparation Advice\n\n> 考生分享，不代表学校官方建议。\n',
     '\n## '+id+' · '+quote(text(data.title))+'\n\n考试方式：'+(data.track||'regular')+' ｜ 阶段：'+data.phase+
     ' ｜ 标签：'+data.tags.join(', ')+' ｜ [原始投稿](https://github.com/FuTseYi/HKUST-ELPA/issues/'+number+')'+
     '\n\n'+quote(text(data.body))+'\n');
   output('added');return;
 }
 const campus=data.campus||'nansha',track=data.track||'regular';
 const bankKey=campus==='nansha'?(track==='regular'?'D':'F'):(track==='regular'?'H':'T');
 const extraFile=F('question-bank','fast-track.js');
 const content=fs.readFileSync(bankFile,'utf8');
 const extra=fs.existsSync(extraFile)?fs.readFileSync(extraFile,'utf8'):'';
 if(bankKey!=='D'&&!extra)throw Error('Fast Track and campus bank file missing');
 const banks=vm.runInNewContext(content+'\n'+extra+'\n;BANKS',{}, {timeout:1000});
 if(!banks||!banks.D||!banks[bankKey]||!Array.isArray(banks[bankKey].items))
   throw Error('Question bank invalid');
 const display=vm.runInNewContext(content+'\n;PAST_QUESTION_IDS',{}, {timeout:1000});
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
 const app=readJS(appFile,'ELPA_APPEARANCES',{});
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
   const file=bankKey==='D'?bankFile:extraFile;
   const original=bankKey==='D'?content:extra;
   const begin=original.indexOf('BANKS.'+bankKey+' = {');
   if(begin<0)throw Error('Missing target bank '+bankKey);
   const lineEnd=original.indexOf('};',begin);
   const blockEnd=original.indexOf('\n};',begin);
   const finish=blockEnd>=0&&(lineEnd<0||blockEnd<=lineEnd)?blockEnd:lineEnd;
   if(finish<begin)throw Error('Bank closure missing');
   const section=original.slice(begin,finish);
   let updated;
   if(section.includes('items:[]')){
     updated=original.slice(0,begin)+section.replace('items:[]','items:['+
       JSON.stringify(item)+']')+original.slice(finish);
   }else{
     const pretty=section.lastIndexOf('\n  ]');
     const relative=pretty>=0?pretty:section.lastIndexOf(']');
     if(relative<0||relative<section.indexOf('items:['))throw Error('Invalid bank structure');
     const already=banks[bankKey].items.length>0;
     updated=original.slice(0,begin+relative)+(already?',':'')+
       '\n    '+JSON.stringify(item)+original.slice(begin+relative);
   }
   fs.writeFileSync(file,updated,'utf8');
 }
 saveJS(appFile,'ELPA_APPEARANCES',app);
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
