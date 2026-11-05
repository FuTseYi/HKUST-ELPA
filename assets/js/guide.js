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

/* Filter pre-rendered reviewed cards; no duplicate browser-side HTML renderer. */
const adviceList=document.getElementById('guideAdviceList');
const adviceCards=[...adviceList.querySelectorAll('.elpa-advice-card')];
const advicePhaseFilter=document.getElementById('advicePhaseFilter');
const adviceTagFilter=document.getElementById('adviceTagFilter');
let adviceTrack='regular';

function selectAdviceTrack(track){
  adviceTrack=track;
  const entries=adviceCards.filter(card=>card.dataset.track===track);
  const phases=new Set(entries.map(card=>card.dataset.phase));
  const tags=new Set(entries.flatMap(card=>card.dataset.tags.split(',').filter(Boolean)));
  for(const [select,keys,names] of [
    [advicePhaseFilter,phases,ELPA_TAXONOMY.advicePhases],
    [adviceTagFilter,tags,ELPA_TAXONOMY.adviceTags]
  ]){
    select.replaceChildren(select.options[0]);
    for(const [key,label] of Object.entries(names)){
      if(!keys.has(key))continue;
      const option=document.createElement('option');
      option.value=key;
      option.textContent=label.zh+' · '+label.en;
      select.append(option);
    }
    select.value='';
  }
  document.getElementById('guideAdviceFilters').hidden=entries.length===0;
  document.getElementById('guideAdviceShare').href='./submit.html?kind=advice&track='+track;
  renderCommunityAdvice();
}
function renderCommunityAdvice(){
  const visible=adviceCards.filter(card=>card.dataset.track===adviceTrack&&
    (!advicePhaseFilter.value||card.dataset.phase===advicePhaseFilter.value)&&
    (!adviceTagFilter.value||card.dataset.tags.split(',').includes(adviceTagFilter.value)));
  adviceList.replaceChildren(...visible);
  const adviceEmpty=document.getElementById('guideAdviceEmpty');
  adviceEmpty.hidden=visible.length!==0;
  adviceEmpty.textContent=adviceCards.some(card=>card.dataset.track===adviceTrack)
    ?'暂无经验 / No tips in this category.':'暂未收录 Fast Track 经验。 / No Fast Track tips yet.';
}
advicePhaseFilter.addEventListener('change',renderCommunityAdvice);
adviceTagFilter.addEventListener('change',renderCommunityAdvice);
selectGuideTrack(requestedTrack==='fast-track'||window.location.hash==='#fast-track'?'fast-track':'regular');
