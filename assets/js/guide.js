/* Single choice; no extra filters, accounts or persistent state. */
const flowRegular=document.getElementById('regularGuide');
const flowFast=document.getElementById('fastGuide');
const regularButton=document.getElementById('guideRegularTab');
const fastButton=document.getElementById('guideFastTab');
function selectGuideTrack(track){
  const fast=track==='fast-track';
  flowRegular.hidden=fast;
  flowFast.hidden=!fast;
  regularButton.classList.toggle('active',!fast);
  fastButton.classList.toggle('active',fast);
  regularButton.setAttribute('aria-pressed',String(!fast));
  fastButton.setAttribute('aria-pressed',String(fast));
  selectAdviceTrack(fast?'fast-track':'regular');
}
regularButton.addEventListener('click',()=>selectGuideTrack('regular'));
fastButton.addEventListener('click',()=>selectGuideTrack('fast-track'));
const requestedTrack=new URLSearchParams(window.location.search).get('track');

/* Show only filters that have reviewed entries for the selected assessment. */
const reviewedAdvice=Array.isArray(ELPA_ADVICE)?ELPA_ADVICE.filter(entry=>entry&&entry.title&&entry.body):[];
const advicePhaseFilter=document.getElementById('advicePhaseFilter');
const adviceTagFilter=document.getElementById('adviceTagFilter');
let adviceTrack='regular';
function selectAdviceTrack(track){
  adviceTrack=track;
  const entries=reviewedAdvice.filter(entry=>(entry.track||'regular')===track);
  const phases=new Set(entries.map(entry=>entry.phase));
  const tags=new Set(entries.flatMap(entry=>entry.tags||[]));
  for(const [select,keys,names] of [
    [advicePhaseFilter,phases,ELPA_TAXONOMY.advicePhases],
    [adviceTagFilter,tags,ELPA_TAXONOMY.adviceTags]
  ]){
    select.replaceChildren(select.options[0]);
    for(const [key,label] of Object.entries(names)){
      if(!keys.has(key))continue;
      const option=document.createElement('option');
      option.value=key;
      option.textContent=label.zh+" · "+label.en;
      select.append(option);
    }
    select.value='';
  }
  document.getElementById('guideAdviceFilters').hidden=entries.length===0;
  document.getElementById('guideAdviceShare').href='./submit.html?kind=advice&track='+track;
  renderCommunityAdvice();
}
function renderCommunityAdvice(){
  const adviceSection=document.getElementById('sec-advice');
  const adviceList=document.getElementById('guideAdviceList');
  const adviceEmpty=document.getElementById('guideAdviceEmpty');
  adviceList.replaceChildren();
  const visible=reviewedAdvice.filter(entry=>(entry.track||'regular')===adviceTrack&&
    (!advicePhaseFilter.value||entry.phase===advicePhaseFilter.value)&&
    (!adviceTagFilter.value||(entry.tags||[]).includes(adviceTagFilter.value)));
  for(const entry of visible){
    const article=document.createElement('article');
    article.className='elpa-advice-card';
    const chips=document.createElement('div');
    chips.className='elpa-advice-chips';
    const phase=ELPA_TAXONOMY.advicePhases[entry.phase];
    if(phase){
      const chip=document.createElement('span');
      chip.className='elpa-advice-chip';
      chip.textContent=phase.zh+" · "+phase.en;
      chips.append(chip);
    }
    for(const tag of entry.tags||[]){
      const names=ELPA_TAXONOMY.adviceTags[tag];
      if(!names)continue;
      const chip=document.createElement('span');
      chip.className='elpa-advice-chip';
      chip.textContent=names.zh+" · "+names.en;
      chips.append(chip);
    }
    const title=document.createElement('h3');
    title.textContent=entry.title;
    const body=document.createElement('p');
    body.className='elpa-advice-content';
    body.textContent=entry.body;
    article.append(chips,title,body);
    if(Number.isSafeInteger(entry.issueNumber)&&entry.issueNumber>0){
      const link=document.createElement('a');
      link.href='https://github.com/FuTseYi/HKUST-ELPA/issues/'+entry.issueNumber;
      link.rel='noopener noreferrer';
      link.target='_blank';
      link.textContent='原始分享 / Original post';
      link.className='elpa-advice-source';
      article.append(link);
    }
    adviceList.append(article);
  }
  adviceEmpty.hidden=visible.length!==0;
  adviceEmpty.textContent=reviewedAdvice.some(entry=>(entry.track||'regular')===adviceTrack)
    ?'暂无经验 / No tips in this category.':'暂未收录 Fast Track 经验。 / No Fast Track tips yet.';
  adviceSection.hidden=false;
}
advicePhaseFilter.addEventListener('change',renderCommunityAdvice);
adviceTagFilter.addEventListener('change',renderCommunityAdvice);
selectGuideTrack(requestedTrack==='fast-track'||window.location.hash==='#fast-track'?'fast-track':'regular');
