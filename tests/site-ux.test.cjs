'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {readPageSource}=require('../scripts/validate-site.cjs');
const practice=readPageSource('practice.html');
const submit=readPageSource('submit.html');
function section(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'missing section '+start);return source.slice(a,b);
}
test('GZ/HK are display-only; old campus route values stay stable',()=>{
 assert.match(practice,/data-campus="nansha"[^>]*>GZ<\/button>/);
 assert.match(practice,/data-campus="clear-water-bay"[^>]*>HK<\/button>/);
 assert.match(submit,/<option value="nansha">GZ<\/option>/);
 assert.match(submit,/<option value="clear-water-bay">HK<\/option>/);
});
test('all current IDs survive JSON backup normalization and recovery',()=>{
 const code=section(practice,'function normalizePayload(data) {','function snapshot()');
 const clean=new Function('validRecord',code+';return normalizePayload')(
   v=>v!==null&&typeof v==='object'&&!Array.isArray(v));
 for(const id of ['A-1','D-4','F-1','H-1000111','T-1000112']){
   const got=clean({statuses:{[id]:'done'},notes:{['qn-'+id]:'kept',[id+'-1']:'follow-up'}});
   assert.equal(got.statuses[id],'done',id);
   assert.equal(got.notes['qn-'+id],'kept',id);
   assert.equal(got.notes[id+'-1'],'follow-up',id);
 }
 assert.deepEqual(Object.keys(clean({statuses:{'../bad':'done'},notes:{'qn-<script>':'injection'}}).statuses),[]);
});
test('feedback count includes reviewed submissions and ties retain original order',()=>{
 const code=section(practice,'function feedbackCount(id){','function toggleTranslation(id,button){');
 const fixtures={
   'F-1':{num:1,records:1},'F-2':{num:2,records:2},
   'D-1':{num:1,term:'2026 Fall'},'A-1':{num:1},
   'D-1000301':{num:1000301,term:'2027 Fall'}
 };
 const arrivals={'F-1':[{issueNumber:9},{issueNumber:9},{issueNumber:10}],
   'F-2':[], 'D-1':[{issueNumber:11},{issueNumber:12,intent:'supplement'}],
   'D-1000301':[
     {issueNumber:301,intent:'encounter',subs:[{en:'What matters?',cn:''}]},
     {issueNumber:302,intent:'supplement',alternatives:[{en:'Could you explain this project?',cn:'你能解释这个项目吗？'}],subs:[{en:'What changed?',cn:''}]}
   ]};
 const funcs=new Function('questionById','appearancesFor',code+
   ';return {feedbackCount,feedbackRanked,questionFollowups,questionAlternatives}')(
   id=>fixtures[id],id=>arrivals[id]||[]);
 assert.equal(funcs.feedbackCount('F-1'),3);
 assert.equal(funcs.feedbackCount('D-1'),2);
 assert.equal(funcs.feedbackCount('A-1'),1);
 assert.equal(funcs.feedbackCount('D-1000301'),1,'imported issue counted exactly once');
 assert.deepEqual(funcs.questionFollowups('D-1000301',{subs:[{en:'Original prompt?',cn:''}]}),[
   {en:'Original prompt?',cn:''},{en:'What matters?',cn:''},{en:'What changed?',cn:''}
 ]);
 assert.deepEqual(funcs.questionAlternatives('D-1000301',{en:'Original question'}),[
   {en:'Could you explain this project?',cn:'你能解释这个项目吗？'}
 ]);
 assert.deepEqual(funcs.feedbackRanked(['F-2','A-1','F-1','D-1']),['F-1','F-2','D-1','A-1']);
});
test('practice cards expose reviewed encounter action and uniform alignment',()=>{
 assert.match(practice,/过往考过 \$\{feedback\} 次/);
 assert.match(practice,/我也考过 \/ Seen this<\/a>/);
 assert.match(practice,/submit\.html\?question=\$\{encodeURIComponent\(id\)\}/);
 assert.doesNotMatch(practice,/submit\.html\?question=\$\{encodeURIComponent\(id\)\}[^"`]*campus=/);
 assert.match(practice,/margin:0!important/);
 assert.match(submit,/id="contributionIntent"/);
 assert.match(submit,/linkedQuestionId:linkedId/);
 assert.match(submit,/id="supplementQuestionFields"[^>]*hidden/);
 assert.match(submit,/id="supplementEn"/);
 assert.match(submit,/填写相似问法或至少添加一条新的提示小问/);
 assert.match(practice,/相似问法 \/ Variants \(\$\{alternatives\.length\}\)/);
 assert.match(practice,/function questionAlternatives\(id,item\)/);
 assert.match(submit,/id="exam-context">01 · 考试校区与类型/);
 assert.match(submit,/id="submissionCampus" required>[\s\S]*?<option value="" selected disabled>选择校区 \/ Select campus<\/option>/);
 assert.match(submit,/if\(intent==='encounter'\)requestAnimationFrame\(\(\)=>\{/);
 assert.match(submit,/get\('exam-context'\)\.scrollIntoView\(\{block:'start',behavior:'instant'\}\)/);
 assert.match(submit,/get\('submissionCampus'\)\.focus\(\{preventScroll:true\}\)/);
 assert.match(submit,/for\(const id of \['submissionCampus','submissionTrack'\]\)get\(id\)\.addEventListener\('change'/);
 assert.match(submit,/if\(linkedId&&!findQuestion\(linkedId\)\)clearLink\(\)/);
 assert.match(submit,/id="mainCn"[^>]*maxlength="1000"/);
 assert.doesNotMatch(submit,/id="mainCn"[^>]*required/);
});
test('Chinese and English matching runs locally, does not require network',()=>{
 const code=section(submit,'const normMatch=s=>','function availableQuestions(){');
 const score=new Function(code+';return matchScore')();
 const item={en:'How would you guide undergraduate students to use AI ethically?',
   cn:'作为助教，如何指导本科生合乎伦理地使用 AI？'};
 assert.ok(score(item,'如何指导本科生使用AI')>=0.28);
 assert.ok(score(item,'undergraduate students AI ethically')>=0.28);
 assert.equal(score(item,'interdisciplinary robotics curriculum'),0);
 assert.match(submit,/slice\(0,3\)/);
});
test('one exercise entry and predictable compact question card',()=>{
 assert.match(practice,/id="practiceLauncher"/);
 assert.match(practice,/id="timerPanel"[^>]*aria-hidden="true"/);
 assert.match(practice,/id="tabMock"/);
 assert.match(practice,/id="timerDrill"/);
 assert.doesNotMatch(practice,/id="mockExamBtn"|id="quickDrawBtn"|id="practiceTimerBtn"/);
 assert.doesNotMatch(practice,/class="question-contribute"/);
 assert.match(practice,/class="q-actions \$\{translation \? "has-translation"/);
 assert.match(practice,/\.q-actions\.no-translation/);
 assert.match(practice,/\.note-wrap:not\(\.open\) \.md-tab/);
 assert.match(practice,/env\(safe-area-inset-bottom,0px\)/);
});
function newTimerFixture(){
 const code=section(practice,
   '/* ============ Unified practice dock: random draw + one stable timer ============ */',
   '/* Existing backup and export handlers are accessed from a single menu. */');
 const elements=new Map(),listeners=new Map();
 const cls=()=>{const store=new Set();return {
   add:(...names)=>names.forEach(name=>store.add(name)),
   remove:(...names)=>names.forEach(name=>store.delete(name)),
   contains:name=>store.has(name),
   toggle:(name,force)=>{const target=force===undefined?!store.has(name):force;
     target?store.add(name):store.delete(name);return target;}
 }};
 const card={dataset:{filterMatch:'1'},classList:cls(),scrolled:0,
   scrollIntoView(){this.scrolled++;}};
 const el=id=>{
   if(id==='q-A-1')return card;
   if(!elements.has(id))elements.set(id,{
     classList:cls(),textContent:'',value:id==='timerMin'?'2':'0',hidden:false,
     disabled:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},
     addEventListener(name,fn){listeners.set(id+':'+name,fn);},
     focus(){this.focused=true;},contains(){return true;}
   });
   return elements.get(id);
 };
 const document={getElementById:el,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners.set('document:'+name,fn),hidden:false};
 const window={confirm:()=>true,matchMedia:()=>({matches:true})};
 let clock=100000,notice='';
 const fakeDate={now:()=>clock};
 const timerFactory=new Function('document','window','Date','setInterval',
    'clearInterval','setTimeout','allPracticeIds','bankPages','matchingCards',
    'applyFilters','setTip','PAGE_SIZE',code+
    ';return {tickTimer,drawPractice,read:()=>({timerRunning,timerMode,timerRemain,timerPhase,timerElapsed}),openTimerPanel};');
 const api=timerFactory(document,window,fakeDate,()=>7,()=>{},()=>{},
    ()=>['A-1'],{fall:1,past:1},()=>[card],()=>{},txt=>{notice=txt;},8);
 const click=id=>{const fn=listeners.get(id+':click');assert.ok(fn,'missing click '+id);fn();};
 return {api,el,click,card,advance:ms=>{clock+=ms;},notice:()=>notice};
}
test('opening exercise panel does not draw or start timer; random drawing is independent',()=>{
 const f=newTimerFixture();
 assert.equal(f.api.read().timerRunning,false);
 assert.equal(f.el('timerPanel').classList.contains('show'),false);
 f.click('practiceLauncher');
 assert.equal(f.el('timerPanel').classList.contains('show'),true);
 assert.equal(f.api.read().timerRunning,false);
 assert.equal(f.card.scrolled,0);
 f.click('timerDrill');
 assert.equal(f.card.scrolled,1);
 assert.equal(f.el('timerPanel').classList.contains('show'),false);
 assert.equal(f.api.read().timerRunning,false);
 assert.match(f.notice(),/已抽到/);
});
test('mock timer keeps time after panel closes and transitions at original deadlines',()=>{
 const f=newTimerFixture();
 f.click('practiceLauncher');
 f.click('timerStartPause');
 assert.equal(f.api.read().timerRunning,true);
 assert.equal(f.api.read().timerPhase,'prep');
 assert.equal(f.el('timerPanel').classList.contains('show'),false);
 f.advance(60000);
 f.api.tickTimer();
 assert.equal(f.api.read().timerPhase,'speak');
 assert.equal(Math.round(f.api.read().timerRemain),120);
 f.advance(120000);
 f.api.tickTimer();
 assert.equal(f.api.read().timerPhase,'done');
 assert.equal(f.api.read().timerRunning,false);
 f.click('timerReset');
 assert.equal(f.api.read().timerPhase,'idle');
 assert.equal(f.api.read().timerRemain,60);
});
test('pause and resume preserve seconds, custom countdown and stopwatch work',()=>{
 const f=newTimerFixture();
 f.click('timerStartPause');
 f.advance(10000);
 f.api.tickTimer();
 f.click('timerStartPause');
 assert.equal(f.api.read().timerRunning,false);
 assert.equal(Math.round(f.api.read().timerRemain),50);
 f.advance(25000);
 f.click('timerStartPause');
 assert.equal(f.api.read().timerRunning,true);
 f.advance(50000);
 f.api.tickTimer();
 assert.equal(f.api.read().timerPhase,'speak');
 f.click('timerReset');
 f.click('tabCountdown');
 assert.equal(f.api.read().timerMode,'countdown');
 assert.equal(f.el('timerSet').hidden,false);
 f.el('timerMin').value='0';f.el('timerSec').value='12';
 const onInput=f.el('timerSec'); // timer set is read only through the existing input handler.
 f.click('tabStopwatch');
 assert.equal(f.api.read().timerMode,'stopwatch');
 f.click('timerStartPause');
 f.advance(4500);
 f.api.tickTimer();
 assert.equal(Math.floor(f.api.read().timerElapsed),4500);
 assert.equal(f.el('timerDisplay').textContent,'00:04');
});

test('footer is concise, community-oriented and identical across five pages',()=>{
 const pages=['index.html','guide.html','practice.html','sources.html','submit.html'];
 const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
 const footers=pages.map(p=>{
   const html=read(p),matches=html.match(/<footer class="elpa-footer"[\s\S]*?<\/footer>/g);
   assert.equal(matches?.length,1,p+' should have one footer');
   return matches[0];
 });
 for(const f of footers){
   assert.equal(f,footers[0],'Footer must match across all pages');
   for(const label of ['Built with Passion. Shared with Everyone.','为爱发电 · 开源共建 · 互帮互助','Built with GitHub · Vercel · Cloudflare','Initiated by','FuTseYi'])
     assert.ok(f.includes(label),'Footer missing '+label);
   assert.match(f,/href="\.\/submit\.html">分享考题与经验 <span[^>]*lang="en">Share questions & tips<\/span><\/a>/);
   assert.match(f,/>参与开源共建 <span[^>]*lang="en">Contribute on GitHub<\/span><\/a>/);
   assert.doesNotMatch(f,/Not affiliated with or endorsed by HKUST|资料来源与声明|Created &amp; Maintained by/);
 }
 assert.match(read('sources.html'),/本站为学生整理的备考资源，并非学校官方题库/);
 assert.match(read('site.css'),/\.elpa-footer \.elpa-footer-action\{[^}]*min-height:28px/);
 assert.match(read('site.css'),/\.question-feedback a::after/);
 assert.equal((read('practice.html').match(/id="exportBtn"/g)||[]).length,1);
});

test('internal pages share one compact banner and the practice brand uses the site palette',()=>{
 const pages=['guide.html','practice.html','sources.html','submit.html'];
 for(const page of pages){
   const html=fs.readFileSync(path.resolve(__dirname,'..',page),'utf8');
   assert.match(html,/class="[^"]*elpa-subhero/);
   assert.equal((html.match(/<main(?:\s|>)/g)||[]).length,1,page+' should have one main landmark');
 }
 assert.match(practice,/<body class="elpa-body page-practice">/);
});

test('sources page keeps external references without duplicate question-bank documents',()=>{
 const sources=fs.readFileSync(path.join(__dirname,'../sources.html'),'utf8');
  assert.match(sources,/id="official-sources">学校官方说明 <span[^>]*lang="en">Official Information<\/span><\/h2>/);
  assert.match(sources,/id="community-sources">补充链接 <span[^>]*lang="en">Additional Links<\/span><\/h2>/);
 assert.match(sources,/docs\.qq\.com\/doc\/DT3BxSkJzSGdUamJE/);
 assert.match(sources,/docs\.qq\.com\/doc\/DSHJydEVYSHBtdkZO/);
 assert.doesNotMatch(sources,/站内题库文档|question-bank\/(?:2026-fall|previous-years|fast-track)\.md/);
 assert.doesNotMatch(practice,/tree\/main\/question-bank|question-provenance|sourceNote/);
 assert.match(practice,/href="\.\/sources\.html">查看参考资料<\/a>/);
});

test('seed advice uses the same track, phase and topic schema without invented provenance',()=>{
 const advice=fs.readFileSync(path.join(__dirname,'../question-bank/advice.js'),'utf8');
 assert.equal((advice.match(/id: 'ADVICE-REGULAR-/g)||[]).length,3);
 assert.equal((advice.match(/track: 'regular', phase: 'during'/g)||[]).length,3);
 assert.doesNotMatch(advice,/HIST-|provenance|历史考情整理/);
 assert.match(submit,/<select id="adviceTrack">[\s\S]*?<option value="regular">常规 ELPA · Regular<\/option>[\s\S]*?<option value="fast-track">ELPA Fast Track<\/option>/);
});

test('guide separates the official Regular and Fast Track paths with one obvious switch',()=>{
 const guide=readPageSource('guide.html');
 assert.match(guide,/id="guideRegularTab"[^>]*aria-pressed="true"/);
 assert.match(guide,/id="guideFastTab"[^>]*aria-pressed="false"/);
 assert.match(guide,/id="fastGuide"[^>]*hidden/);
 for(const step of ['入场与身份核验','抽题与准备','个人陈述','提问与回答','结束离场']) assert.match(guide,new RegExp(step));
 assert.match(guide,/学生证或校园卡/);
 assert.match(guide,/主问题和提示小问/);
 assert.match(guide,/草稿纸和笔/);
 assert.match(guide,/考官的计时提示/);
 assert.match(guide,/个人英语陈述/);
 assert.match(guide,/按照系统指定的话题准备英语回答/);
 assert.doesNotMatch(guide,/约 30 分钟|最多 4 名|IELTS 口语|TOEFL 口语|Automatic Exemption/);
 assert.match(guide,/track=regular#sec-bankD/);
 assert.match(guide,/track=fast-track#sec-bankD/);
 assert.doesNotMatch(guide,/报名截止日期|2026 Fall 场次反馈|你可能想知道|elpa-guide-faq/);
 assert.match(guide,/id="advicePhaseFilter"/);
 assert.match(guide,/id="adviceTagFilter"/);
 assert.equal((guide.match(/class="elpa-guide-switch"/g)||[]).length,1);
});
test('homepage explains the full learning workflow without a repeated oversized practice CTA',()=>{
 const home=readPageSource('index.html');
 const practice=readPageSource('practice.html');
 assert.match(home,/id="home-overview-title">初次使用 <span[^>]*lang="en">Start here<\/span><\/h2>/);
 assert.match(home,/id="home-features-title">使用指南 <span[^>]*lang="en">Quick guide<\/span><\/h2>/);
 assert.equal((home.match(/class="elpa-home-journey"/g)||[]).length,1);
 assert.equal((home.match(/class="elpa-home-feature"/g)||[]).length,4);
 for(const id of ['home-guide-title','home-bank-title','home-practice-title','home-record-title','home-more-title'])
   assert.ok(home.includes('id="'+id+'"'),'Missing '+id);
 for(const topic of ['常规 ELPA / Fast Track','考试场次','相似问法','提示小问','随机抽题','正向计时','记笔记','未练','练习中','已掌握','备份','恢复','换浏览器'])
   assert.ok(home.includes(topic),'Not explained: '+topic);
 assert.match(home,/从当前筛选结果中抽题，配合计时自己开口练习/);
 assert.match(home,/先有 1 分钟准备，接着进入 2 分钟陈述/);
 assert.match(home,/不同校区和考试类型的收录情况可能不同/);
 assert.match(home,/不会自动评价回答/);
 assert.match(home,/点击页面右下角的「练习」，再选「随机抽题」/);
 assert.match(home,/换手机或电脑，怎么接着练？/);
 assert.match(home,/「恢复」会替换当前设备已有的记录/);
 assert.doesNotMatch(home,/模拟口语|Markdown|JSON|elpa_data\.json/);
 assert.equal((home.match(/class="elpa-home-instructions"/g)||[]).length,2);
 assert.equal((home.match(/class="elpa-home-instructions-num"/g)||[]).length,6);
 assert.equal((home.match(/class="elpa-home-backup-guide"/g)||[]).length,1);
 assert.match(home,/class="elpa-home-demo"/);
 assert.match(home,/class="elpa-home-demo elpa-home-demo-timer"/);
 assert.equal((home.match(/class="elpa-demo-top"/g)||[]).length,4);
 assert.ok(home.includes('href="./guide.html"')&&home.includes('href="./practice.html"'));
 assert.ok(home.includes('href="./sources.html"')&&home.includes('href="./submit.html"'));
 assert.match(home,/无需注册账号/);
 assert.match(home,/公开记录保存/);
 assert.doesNotMatch(home,/elpa-next-primary|elpa-home-next|elpa-start-actions|elpa-capability|提交 → 后端校验 → 审核 → 入库/);
 assert.match(home,/class="elpa-cta elpa-cta-primary" href="\.\/practice\.html"/);
 const css=fs.readFileSync(path.join(__dirname,'../site.css'),'utf8');
 assert.match(css,/\.elpa-home-feature\{display:grid/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.doesNotMatch(css,/\.elpa-next-primary|\.elpa-quickstart|\.elpa-capability/);
 const toolbar=section(practice,'<div class="toolbar">','<!-- 存储状态提示 -->');
 const progress=section(practice,'<!-- Progress -->','<!-- TOC -->');
 assert.doesNotMatch(toolbar,/id="doneCount"|id="recordsMenuBtn"/);
 assert.match(progress,/id="doneCount"/);
 assert.match(progress,/id="recordsMenuBtn"/);
 assert.doesNotMatch(practice,/id="currentBankDescription"|往届经典题与其他学期的考生反馈统一归档|该分类暂无已收录题目/);
 assert.doesNotMatch(practice,/current\.length\+' 题 · '|past\.length\+' 题 · '/);
 assert.match(practice,/feedbackBankCount'\)\.textContent=current\.length\+' 题'/);
 assert.match(practice,/pastBankCount'\)\.textContent=past\.length\+' 题'/);
 assert.match(practice,/id="sessionFilter"[\s\S]*?<option value="">全部场次 \/ All sessions<\/option>/);
 assert.match(practice,/#sessionFilter\{field-sizing:content\}/);
 assert.match(practice,/\.filter-select \{[^}]*width:auto; max-width:100%/);
 assert.match(practice,/appearance:none; -webkit-appearance:none; padding:7px 28px 7px 12px/);
 assert.match(practice,/id="statusFilter"[^>]*>[\s\S]*?<option value="all">备考状态 \/ Status<\/option>/);
 assert.match(practice,/\.progress-head-actions \.stat-pill,#recordsMenuBtn\{[^}]*height:36px;[^}]*white-space:nowrap/);
 assert.match(practice,/#recordsMenuBtn\{[^}]*width:auto;[^}]*padding:0 10px;[^}]*border-radius:999px/);
 assert.match(practice,/entry\.term\+' · '\+stage\.zh/);
 assert.doesNotMatch(practice,/id="termFilter"|id="examStageFilter"|session-badges|session-chip/);
 const appearances=fs.readFileSync(path.join(__dirname,'../question-bank/appearances.js'),'utf8');
 const questions=fs.readFileSync(path.join(__dirname,'../question-bank/questions.js'),'utf8');
 const sessionData=new Function(questions+'\n'+appearances+'\nreturn {ids:PAST_QUESTION_IDS,data:ELPA_APPEARANCES};')();
 assert.equal(sessionData.ids.length,25);
 // Legacy questions must not acquire invented year/stage evidence.
 // Future issue-linked reports may still add reviewed appearances to these IDs.
 for(const id of [...sessionData.ids,...Array.from({length:12},(_,i)=>'D-'+(i+1))])
   for(const entry of sessionData.data[id]||[])
     assert.ok(Number.isSafeInteger(entry.issueNumber)&&entry.issueNumber>0,id);
 const fastTrack=fs.readFileSync(path.join(__dirname,'../question-bank/fast-track.js'),'utf8');
 const fastSessionData=new Function(questions+'\n'+fastTrack+'\n'+appearances+'\nreturn {ids:BANKS.F.items.map(x=>"F-"+x.num),data:ELPA_APPEARANCES};')();
 assert.equal(fastSessionData.ids.length,12);
 for(const id of fastSessionData.ids)
   for(const entry of fastSessionData.data[id]||[])
     assert.ok(Number.isSafeInteger(entry.issueNumber)&&entry.issueNumber>0,id);
 assert.match(fastTrack,/"num": 1,[\s\S]*?"subs": \[\]/);
 assert.doesNotMatch(fastTrack,/"num": 13/);
 assert.doesNotMatch(questions,/"F-13"/);
 assert.doesNotMatch(practice,/fastIntroSection|fastIntroDetails|ELPA_FAST_TRACK_INTRO|补充准备 · 完整自我介绍任务/);
 assert.match(practice,/titleStatus\.textContent=total\?'第 '\+page\+' \/ '\+pages\+' 页 · 总 '\+total\+' 题':'0 题'/);
 assert.match(practice,/function activeLatestSessionLabel\(\)[\s\S]*?session\.term\+' · '\+ELPA_TAXONOMY\.examStages\[session\.stage\]\.zh/);
 assert.match(practice,/currentBankTitle'\)\.textContent=selectedIsCurrent\?selectedLabel:sessionLabel/);
 assert.doesNotMatch(practice,/currentBankTitle'\)\.textContent=.*最新学期题库/);
 assert.match(practice,/id="pastBankTitle">过往题库<\/h2>/);
 assert.match(practice,/pastBankTitle'\)\.textContent=selectedValue&&!selectedIsCurrent\?selectedLabel:'过往题库'/);
 assert.match(practice,/sec-bankD'\)\.hidden=!!selectedValue&&!selectedIsCurrent/);
 assert.match(practice,/sec-bankA'\)\.hidden=!!selectedValue&&selectedIsCurrent/);
 assert.match(practice,/const items=selectedValue\?/);
 assert.match(practice,/\.page-practice \.to-top\{[\s\S]*?display:inline-grid!important/);
 assert.match(practice,/\.page-practice \.practice-launcher\{[\s\S]*?bottom:calc\(66px/);
 assert.doesNotMatch(practice,/筛选后|每页最多|pagination-caption/);
 assert.match(practice,/\.page-practice \.sec-head \.tag \{[\s\S]*?white-space:nowrap/);
});
test('latest bank advances by complete term and stage while older sessions remain filterable',()=>{
 const code=section(practice,'function activeLatestTerm(){','function renderTOC() {');
 const ids=['Q-start','Q-mid','Q-old'];
 const records={
   'Q-start':[{term:'2026 Fall',examStage:'start'}],
   'Q-mid':[{term:'2026 Fall',examStage:'mid'}],
   'Q-old':[{term:'2025 Fall',examStage:'start'}]
 };
 const funcs=new Function('activePracticeIds','appearancesFor','elpaLatestTermForIds','elpaReportedTerms','ELPA_TAXONOMY',
   code+';return {activeLatestSession,activeCurrentIds,activeArchivedIds};')(
     ()=>ids,id=>records[id]||[],()=> '2026 Fall',id=>(records[id]||[]).map(x=>x.term),
     {examStages:{start:{zh:'开学阶段'},mid:{zh:'学期中'},end:{zh:'学期末'}}});
 assert.deepEqual(funcs.activeLatestSession(),{term:'2026 Fall',stage:'mid'});
 assert.deepEqual(funcs.activeCurrentIds(),['Q-mid']);
 assert.deepEqual(funcs.activeArchivedIds(),['Q-start','Q-old']);
 // Undated Fast Track recollections must remain immediately practiceable.
 const undated=new Function('activePracticeIds','appearancesFor','elpaLatestTermForIds','elpaReportedTerms','ELPA_TAXONOMY',
   code+';return {activeLatestSessionLabel,activeCurrentIds,activeArchivedIds};')(
     ()=>['F-1','F-2'],()=>[],()=>'',()=>[],{examStages:{}});
 assert.equal(undated.activeLatestSessionLabel(),'场次待核实');
 assert.deepEqual(undated.activeCurrentIds(),['F-1','F-2']);
 assert.deepEqual(undated.activeArchivedIds(),[]);
 assert.match(practice,/sessions\.set\(entry\.term\+'\|'\+entry\.examStage/);
 assert.match(practice,/sessionFilter\.append\(new Option\(session\.label,value\)\)/);
});
test('guide switch preserves accessible state and works without a second page',()=>{
 const html=readPageSource('guide.html');
 const code=section(html,'/* Single choice; no extra filters, accounts or persistent state. */',
   '/* Show only filters that have reviewed entries for the selected assessment. */');
 const events=new Map();
 const btn=id=>({id,attributes:{},classList:{toggle(name,val){this[name]=val;}},setAttribute(k,v){this.attributes[k]=v;},
   addEventListener(name,cb){events.set(id+':'+name,cb);}});
 const regular=btn('regular'),fast=btn('fast'),one={hidden:false},two={hidden:true};
 const elements={regularGuide:one,fastGuide:two,guideRegularTab:regular,guideFastTab:fast};
 const shown=[];
 const fn=new Function('document','window','selectAdviceTrack',code+';return selectGuideTrack;');
 const select=fn({getElementById:id=>elements[id]},{location:{search:'',hash:''}},track=>shown.push(track));
 assert.equal(one.hidden,false);assert.equal(two.hidden,true);
 events.get('fast:click')();
 assert.equal(one.hidden,true);assert.equal(two.hidden,false);
 assert.equal(regular.attributes['aria-pressed'],'false');assert.equal(fast.attributes['aria-pressed'],'true');
 events.get('regular:click')();
 assert.equal(one.hidden,false);assert.equal(two.hidden,true);
 assert.equal(regular.attributes['aria-pressed'],'true');
 assert.deepEqual(shown,['fast-track','regular']);
 const selected=fn({getElementById:id=>elements[id]},
   {location:{search:'?track=fast-track',hash:''}},()=>{});
 selected('fast-track');assert.equal(two.hidden,false);
});

test('Fast Track documentation links to the selectable practice route',()=>{
 const fastDoc=fs.readFileSync(path.join(__dirname,'../question-bank/fast-track.md'),'utf8');
 const indexDoc=fs.readFileSync(path.join(__dirname,'../question-bank/README.md'),'utf8');
 assert.ok(fastDoc.includes('../practice.html?campus=nansha&track=fast-track'));
 assert.ok(!fastDoc.includes('../practice.html#fast-track'));
 assert.ok(indexDoc.includes('| [Fast Track · 南沙校区](./fast-track.md) |'));
});

test('official source links remain separate from community references',()=>{
 const sources=fs.readFileSync(path.join(__dirname,'../sources.html'),'utf8');
 assert.match(sources,/id="official-sources"/);
 assert.match(sources,/id="community-sources"/);
 for(const target of ['https://elpa.hkust-gz.edu.cn/','https://fytgs.hkust-gz.edu.cn/handbooks/handbook-for-research-postgraduate-studies','https://cle.hkust.edu.hk/elpa','https://cle.hkust.edu.hk/sites/default/files/ELPA-Speaking-Scale-Student-Version.pdf'])assert.ok(sources.includes(target),target);
 assert.ok(sources.indexOf('id="official-sources"')<sources.indexOf('id="community-sources"'));
 assert.equal((sources.match(/class="elpa-resource-tag"/g)||[]).length,4);
});
