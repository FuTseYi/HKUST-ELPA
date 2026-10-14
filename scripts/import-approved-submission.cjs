/* Import a maintainer-approved GitHub Issue to a data-only PR.
 * Inputs are read from the event JSON file (never interpolated into shell).
 * Run against the trusted repository checkout only.
 */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const eventFile=process.env.GITHUB_EVENT_PATH || process.argv[2];
if(!eventFile)throw Error('GitHub event payload required');
const event=JSON.parse(fs.readFileSync(eventFile,'utf8'));
const issue=event.issue||{};
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
const bankPath=path.join('question-bank','questions.js');
let content=fs.readFileSync(bankPath,'utf8');
// Load only the trusted checked-out bank source, never submitted text.
const banks=vm.runInNewContext(content+'\n;BANKS',{});
if(!banks||!banks.D||!Array.isArray(banks.D.items))throw Error('Missing D bank');
const normalized=(s)=>String(s).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
const subject=normalized(data.question);
const existing=Object.values(banks).flatMap(bank=>bank.items||[]);
const output=(status)=>{
  console.log('Import status:',status);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'result='+status+'\n');
};
if(existing.some(x=>normalized(x.en)===subject)){
  output('duplicate');process.exit(0);
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
const start=content.indexOf('BANKS.D = {');
const end=content.indexOf('\n};',start);
if(start<0||end<start)throw Error('Cannot find D bank');
const section=content.slice(start,end);
const insertAt=section.lastIndexOf('\n  ]');
if(insertAt<0||insertAt<section.indexOf('items: ['))throw Error('Invalid D bank structure');
const where=start+insertAt;
const insert=',\n    '+JSON.stringify(item);
content=content.slice(0,where)+insert+content.slice(where);
fs.writeFileSync(bankPath,content,'utf8');
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
output('added');
