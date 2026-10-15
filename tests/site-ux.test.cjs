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
   'F-1':{records:1},'F-2':{records:2},'D-1':{term:'2026 Fall'},'A-1':{}
 };
 const arrivals={'F-1':[{issueNumber:9},{issueNumber:9},{issueNumber:10}],
   'F-2':[], 'D-1':[{issueNumber:11}]};
 const funcs=new Function('questionById','appearancesFor',code+';return {feedbackCount,feedbackRanked}')(
   id=>fixtures[id],id=>arrivals[id]||[]);
 assert.equal(funcs.feedbackCount('F-1'),3);
 assert.equal(funcs.feedbackCount('D-1'),2);
 assert.equal(funcs.feedbackCount('A-1'),0);
 assert.deepEqual(funcs.feedbackRanked(['F-2','A-1','F-1','D-1']),['F-1','F-2','D-1','A-1']);
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
test('random draw stays equal probability, timed practice reuses countdown',()=>{
 assert.match(practice,/const pick = keys\[Math\.floor\(Math\.random\(\) \* keys\.length\)\]/);
 assert.match(practice,/function drawPractice\(withTimer\)/);
 assert.match(practice,/if\(withTimer\)startTimer\(\)/);
 assert.match(practice,/timerRemain = 60/);
 assert.match(practice,/timerRemain = 120/);
 assert.match(practice,/id="recordsMenuBtn"/);
});
