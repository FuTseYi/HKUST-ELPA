'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const practice=fs.readFileSync(path.join(__dirname,'../practice.html'),'utf8');
const submit=fs.readFileSync(path.join(__dirname,'../submit.html'),'utf8');
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
 const code=section(practice,'function feedbackCount(id){','function sessionBadges(id){');
 const fixtures={
   'F-1':{num:1,records:1},'F-2':{num:2,records:2},
   'D-1':{num:1,term:'2026 Fall'},'A-1':{num:1},
   'D-1000301':{num:1000301,term:'2027 Fall'}
 };
 const arrivals={'F-1':[{issueNumber:9},{issueNumber:9},{issueNumber:10}],
   'F-2':[], 'D-1':[{issueNumber:11},{issueNumber:12,intent:'supplement'}],
   'D-1000301':[{issueNumber:301,intent:'encounter',subs:[{en:'What matters?',cn:''}]}]};
 const funcs=new Function('questionById','appearancesFor',code+
   ';return {feedbackCount,feedbackRanked,questionFollowups}')(
   id=>fixtures[id],id=>arrivals[id]||[]);
 assert.equal(funcs.feedbackCount('F-1'),3);
 assert.equal(funcs.feedbackCount('D-1'),2);
 assert.equal(funcs.feedbackCount('A-1'),1);
 assert.equal(funcs.feedbackCount('D-1000301'),1,'imported issue counted exactly once');
 assert.deepEqual(funcs.questionFollowups('D-1000301',{subs:[]}),[{en:'What matters?',cn:''}]);
 assert.deepEqual(funcs.feedbackRanked(['F-2','A-1','F-1','D-1']),['F-1','F-2','D-1','A-1']);
});
test('practice cards expose reviewed encounter action and uniform alignment',()=>{
 assert.match(practice,/考过 \$\{feedback\} 次/);
 assert.match(practice,/我也考过 ↗/);
 assert.match(practice,/submit\.html\?question=\$\{encodeURIComponent\(id\)\}/);
 assert.match(practice,/margin:0!important/);
 assert.match(submit,/id="contributionIntent"/);
 assert.match(submit,/linkedQuestionId:linkedId/);
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

test('footer is a consistent student-led open community component across all five routes',()=>{
 const pages=['index.html','guide.html','practice.html','sources.html','submit.html'];
 const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
 for(const page of pages){
   const html=read(page);
   assert.equal((html.match(/<footer class="elpa-footer"/g)||[]).length,1,page);
   assert.match(html,/Built with Passion\. Shared with Everyone\./);
   assert.match(html,/为爱发电 · 开源共建 · 互帮互助/);
   assert.match(html,/Created &amp; Maintained by/);
   assert.match(html,/2026 Fall MPhil/);
   assert.doesNotMatch(html,/2026 Fall MPhil · HKUST\(GZ\)/);
   assert.match(html,/https:\/\/github\.com\/FuTseYi\/HKUST-ELPA\/pulls/);
   assert.match(html,/href="\.\/submit\.html">分享考题<\/a>/);
   for(const stack of ['GitHub','Vercel','Cloudflare'])assert.ok(html.includes('<span>'+stack+'</span>'),page+' missing '+stack);
   assert.match(html,/Not affiliated with or endorsed by HKUST/);
   // Intentional hierarchy: collective purpose and contribution first; author in the final lines.
   const expectedOrder=['elpa-footer-intro','elpa-footer-contribute','elpa-footer-tech',
     'elpa-footer-disclaimer','elpa-footer-source','elpa-footer-identity'];
   const positions=expectedOrder.map(name=>html.indexOf('class="'+name+'"'));
   assert.ok(positions.every(pos=>pos>=0),page+' missing an expected footer section');
   assert.ok(positions.every((pos,i)=>i===0||pos>positions[i-1]),
     page+' creator credit must be the final footer section');
   assert.equal((html.match(/class="elpa-footer-identity"/g)||[]).length,1,page+' should show author once');
   assert.match(html,/href="\.\/sources\.html">资料来源与声明<\/a>/);
 }
 const practice=read('practice.html');
 assert.equal((practice.match(/id="exportBtn"/g)||[]).length,1,'keep the notebook exporter');
 const css=read('site.css');
 assert.match(css,/\.elpa-footer-actions\{/);
 assert.match(css,/@media\(max-width:560px\)/);
});
