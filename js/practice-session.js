/* ============ Unified practice dock: random draw + one stable timer ============ */
const timerPanel=document.getElementById('timerPanel');
const practiceLauncher=document.getElementById('practiceLauncher');
const launcherText=document.getElementById('practiceLauncherText');
const timerDisplay=document.getElementById('timerDisplay');
const timerStatus=document.getElementById('timerStatus');
const timerStartPause=document.getElementById('timerStartPause');
const timerSet=document.getElementById('timerSet');
let timerMode='mock';                 // mock | countdown | stopwatch
let timerRunning=false;
let timerRemain=60;                   // seconds, including paused countdown
let timerEndAt=0;                    // phase deadline on the wall clock
let timerElapsed=0;                  // milliseconds, including paused stopwatch
let timerStartStamp=0;
let timerInterval=null;
let timerPhase='idle';               // idle | prep | speak | done
let activeDrawId=null;

function fmtTime(totalSec){
  const sec=Math.max(0,Math.floor(totalSec));
  const hour=Math.floor(sec/3600),minute=Math.floor((sec%3600)/60),second=sec%60;
  const part=String(minute).padStart(2,'0')+':'+String(second).padStart(2,'0');
  return hour?hour+':'+part:part;
}
function readInput(){
  const min=Math.min(180,Math.max(0,Number.parseInt(document.getElementById('timerMin').value,10)||0));
  const sec=Math.min(59,Math.max(0,Number.parseInt(document.getElementById('timerSec').value,10)||0));
  return Math.max(1,min*60+sec);
}
function setPhase(next){
  timerPhase=next;
  timerPanel.classList.toggle('prep',next==='prep');
  timerPanel.classList.toggle('speak',next==='speak');
  timerPanel.classList.toggle('finished',next==='done');
}
function renderTimer(){
  const value=timerMode==='stopwatch'?timerElapsed/1000:timerRemain;
  timerDisplay.textContent=fmtTime(value);
  timerDisplay.classList.toggle('warn',timerMode!=='stopwatch'&&timerRunning&&timerRemain<=10);
  timerStartPause.textContent=timerRunning?'⏸ 暂停 Pause':'▶ '+(timerPhase==='done'?'重来 Restart':'开始 Start');
  const labels={
    mock:{idle:'准备 Prep 1:00 · 陈述 Speak 2:00',prep:'准备 Prep',speak:'陈述 Speak',done:'模拟结束 Finished'},
    countdown:{idle:'自定倒计时 / Countdown',prep:'倒计时 Countdown',speak:'倒计时 Countdown',done:'计时结束 Finished'},
    stopwatch:{idle:'正向计时 Stopwatch',prep:'正向计时 Stopwatch',speak:'正向计时 Stopwatch',done:'计时结束 Finished'}
  };
  document.getElementById('timerPhase').textContent=labels[timerMode][timerPhase];
  document.getElementById('timerMin').disabled=timerRunning;
  document.getElementById('timerSec').disabled=timerRunning;
  launcherText.textContent=timerRunning?fmtTime(value):
    (timerPhase!=='idle'&&timerPhase!=='done'?'⏸ '+fmtTime(value):'练习 Practice');
  practiceLauncher.setAttribute('aria-label',
    timerRunning?'练习计时中，剩余或已用 '+fmtTime(value)+'，打开练习工具':'打开练习工具');
}
function openTimerPanel(open,focusControl=false){
  timerPanel.classList.toggle('show',open);
  timerPanel.setAttribute('aria-hidden',String(!open));
  practiceLauncher.setAttribute('aria-expanded',String(open));
  if(focusControl)(open?document.getElementById('timerClose'):practiceLauncher).focus();
}
practiceLauncher.addEventListener('click',()=>openTimerPanel(!timerPanel.classList.contains('show'),true));
document.getElementById('timerClose').addEventListener('click',()=>openTimerPanel(false,true));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&timerPanel.classList.contains('show'))openTimerPanel(false,true);
});
function beep(times){
  try{
    const context=new (window.AudioContext||window.webkitAudioContext)();
    for(let i=0;i<times;i++){
      const oscillator=context.createOscillator(),gain=context.createGain();
      oscillator.connect(gain);gain.connect(context.destination);
      oscillator.frequency.value=880;
      gain.gain.setValueAtTime(.15,context.currentTime+i*.26);
      oscillator.start(context.currentTime+i*.26);
      oscillator.stop(context.currentTime+i*.26+.15);
    }
    setTimeout(()=>context.close().catch(()=>{}),times*260+300);
  }catch(e){}
}
function stopTimer(){
  if(timerInterval)clearInterval(timerInterval);
  timerInterval=null;
  timerRunning=false;
  renderTimer();
}
function resetTimer(clearSelection=false){
  stopTimer();
  setPhase('idle');
  timerRemain=timerMode==='mock'?60:readInput();
  timerElapsed=0;
  timerStatus.textContent='';
  if(clearSelection)clearDrill();
  renderTimer();
}
function tickTimer(){
  if(!timerRunning)return;
  const now=Date.now();
  if(timerMode==='stopwatch'){
    timerElapsed=Math.max(0,now-timerStartStamp);
    renderTimer();
    return;
  }
  if(timerMode==='mock'&&timerPhase==='prep'&&now>=timerEndAt){
    // Preserve the original deadline so a backgrounded tab cannot extend the exam.
    timerEndAt+=120000;
    setPhase('speak');
    timerStatus.textContent='准备结束，开始陈述 / Speak for 2 minutes';
    beep(2);
  }
  timerRemain=Math.max(0,(timerEndAt-now)/1000);
  if(timerRemain<=0){
    stopTimer();
    setPhase('done');
    timerStatus.textContent='时间到 / Session finished';
    beep(3);
  }
  renderTimer();
}
function startTimer(){
  if(timerRunning)return;
  if(timerPhase==='done')resetTimer();
  if(timerMode==='mock'&&timerPhase==='idle'){
    timerRemain=60;
    setPhase('prep');
  }else if(timerMode!=='mock'&&timerPhase==='idle'){
    setPhase('prep');
  }
  timerStatus.textContent='';
  const now=Date.now();
  if(timerMode==='stopwatch')timerStartStamp=now-timerElapsed;
  else timerEndAt=now+Math.max(1,timerRemain)*1000;
  timerRunning=true;
  tickTimer();
  timerInterval=setInterval(tickTimer,200);
}
timerStartPause.addEventListener('click',()=>{
  if(timerRunning){
    tickTimer();
    if(!timerRunning)return;
    if(timerMode==='stopwatch')timerElapsed=Math.max(0,Date.now()-timerStartStamp);
    else timerRemain=Math.max(0,(timerEndAt-Date.now())/1000);
    stopTimer();
  }else{
    startTimer();
    openTimerPanel(false);
  }
});
document.getElementById('timerReset').addEventListener('click',()=>resetTimer());
for(const id of ['timerMin','timerSec']){
  document.getElementById(id).addEventListener('input',()=>{
    if(timerMode==='countdown'&&!timerRunning&&timerPhase==='idle'){
      timerRemain=readInput();renderTimer();
    }
  });
}
function switchTimerMode(mode){
  if(mode===timerMode)return;
  if((timerRunning||timerPhase==='prep'||timerPhase==='speak')&&
    !window.confirm('切换计时模式将结束本轮计时，是否继续？\nSwitching modes ends this timer session. Continue?'))return;
  stopTimer();
  timerMode=mode;
  for(const [id,value] of [['tabMock','mock'],['tabCountdown','countdown'],['tabStopwatch','stopwatch']]){
    const button=document.getElementById(id),active=mode===value;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  timerSet.hidden=mode!=='countdown';
  resetTimer();
}
for(const [id,mode] of [['tabMock','mock'],['tabCountdown','countdown'],['tabStopwatch','stopwatch']]){
  document.getElementById(id).addEventListener('click',()=>switchTimerMode(mode));
}
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)tickTimer();
});
function clearDrill(){
  document.querySelectorAll('.qcard.drill-active,.qcard.drill-flash').forEach(card=>{
    card.classList.remove('drill-active','drill-flash');
  });
  activeDrawId=null;
}
function drawPractice(){
  const keys=allPracticeIds().filter(id=>{
    const card=document.getElementById('q-'+id);
    return card&&card.dataset.filterMatch==='1';
  });
  if(!keys.length){
    setTip('当前筛选下无题目，请调整筛选。 / No questions match. Please change your filters.','err');
    return;
  }
  if((timerRunning||timerPhase==='prep'||timerPhase==='speak')&&
    !window.confirm('重新抽题将结束本轮计时，是否继续？\nDrawing again ends this timer session. Continue?'))return;
  resetTimer();
  const pick=keys[Math.floor(Math.random()*keys.length)];
  const card=document.getElementById('q-'+pick);
  if(!card)return;
  const kind=document.getElementById('bankD').contains(card)?'fall':'past';
  const index=matchingCards(kind).indexOf(card);
  bankPages[kind]=Math.max(1,Math.floor(index/PAGE_SIZE)+1);
  applyFilters();
  clearDrill();
  activeDrawId=pick;
  card.classList.add('drill-active');
  openTimerPanel(false);
  card.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  setTip('🎲 已抽到第 '+(index+1)+' 题；需要计时可点右下角「练习」。','ok');
}
document.getElementById('timerDrill').addEventListener('click',drawPractice);
renderTimer();
