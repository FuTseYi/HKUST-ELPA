(function(){
'use strict';
const config=window.ELPA_SUBMISSION_CONFIG||{};
const taxonomy=typeof ELPA_TAXONOMY!=='undefined'?ELPA_TAXONOMY:null;
const form=document.getElementById('submissionForm');
const btn=document.getElementById('submissionButton');
const message=document.getElementById('submissionMessage');
const qFields=document.getElementById('questionFields'),aFields=document.getElementById('adviceFields');
const tabQ=document.getElementById('tabQuestion'),tabA=document.getElementById('tabAdvice');
const followups=document.getElementById('followupList');
const list=document.getElementById('adviceTags');
const currentYear=new Date().getFullYear();
let kind='question',widgetId=null,submitting=false;
const ready=Boolean(taxonomy&&config.apiEndpoint&&config.turnstileSiteKey&&
  /^https:\/\//.test(config.apiEndpoint));
const get=id=>document.getElementById(id);
const trimmed=id=>get(id).value.trim();
function say(text,state='info'){message.textContent=text;message.dataset.state=state;}
function addText(parent,tag,text,cls){
  const el=document.createElement(tag);el.textContent=text;
  if(cls)el.className=cls;parent.append(el);return el;
}
const year=get('submissionYear');
for(let i=currentYear+2;i>=2022;i--){
  const option=document.createElement('option');
  option.value=String(i);option.textContent=String(i);year.append(option);
}
year.value=String(currentYear);
const ph=taxonomy?.placeholders||{};
for(const [id,value] of Object.entries({
  mainEn:ph.mainEn,mainCn:ph.mainCn,
  adviceTitle:ph.adviceTitle,adviceBody:ph.adviceBody
})){if(value)get(id).placeholder=value;}
for(const [code,labels] of Object.entries(taxonomy?.adviceTags||{})){
  const label=document.createElement('label');label.className='contrib-tag';
  const input=document.createElement('input');
  input.type='checkbox';input.value=code;input.name='adviceTag';
  label.append(input);addText(label,'span',labels.zh+' · '+labels.en);
  list.append(label);
}
function setKind(next){
  kind=next;
  qFields.hidden=next!=='question';aFields.hidden=next!=='advice';
  tabQ.setAttribute('aria-pressed',String(next==='question'));
  tabA.setAttribute('aria-pressed',String(next==='advice'));
  for(const item of qFields.querySelectorAll('input,select,textarea'))item.disabled=next!=='question';
  for(const item of aFields.querySelectorAll('input,select,textarea'))item.disabled=next!=='advice';
  get('previewPanel').hidden=true;
  if(next==='question')renderSuggestions();
}
tabQ.addEventListener('click',()=>setKind('question'));
tabA.addEventListener('click',()=>setKind('advice'));
function refreshFollowups(){
  [...followups.children].forEach((el,i)=>{
    el.querySelector('.follow-title').textContent='小问 '+(i+1);
    el.querySelector('.move-up').disabled=i===0;
    el.querySelector('.move-down').disabled=i===followups.children.length-1;
  });
  get('followupCount').textContent=followups.children.length+' / 20';
  get('addFollowup').disabled=followups.children.length>=20;
}
function addFollowup(en='',cn=''){
  if(followups.children.length>=20)return;
  const wrapper=document.createElement('div');wrapper.className='contrib-follow';
  const header=document.createElement('div');header.className='contrib-follow-header';
  const title=addText(header,'strong','小问','follow-title');
  const actions=document.createElement('div');actions.className='contrib-follow-controls';
  for(const [cls,symbol,label] of [['move-up','↑','上移 / Move up'],['move-down','↓','下移 / Move down'],['remove','×','删除 / Remove']]){
    const b=document.createElement('button');b.type='button';b.className='contrib-mini '+cls;
    b.textContent=symbol;b.setAttribute('aria-label',label);
    b.addEventListener('click',()=>{
      if(cls==='remove'){wrapper.remove();}
      else if(cls==='move-up'&&wrapper.previousElementSibling)followups.insertBefore(wrapper,wrapper.previousElementSibling);
      else if(cls==='move-down'&&wrapper.nextElementSibling)followups.insertBefore(wrapper.nextElementSibling,wrapper);
      refreshFollowups();get('previewPanel').hidden=true;
    });actions.append(b);
  }
  header.append(actions);wrapper.append(header);
  for(const [role,labelText,placeholder,val] of [
    ['en','英文小问 / English follow-up *',ph.subEn,en],['cn','中文补充 / Chinese (optional)',ph.subCn,cn]]){
    const field=document.createElement('div');field.className='contrib-field';
    const id='follow-'+String(Date.now())+'-'+Math.random().toString(36).slice(2)+'-'+role;
    const label=document.createElement('label');label.textContent=labelText;label.htmlFor=id;
    const ta=document.createElement('textarea');ta.id=id;ta.dataset.lang=role;
    ta.rows=2;ta.required=role==='en';ta.maxLength=400;ta.minLength=role==='en'?1:0;ta.placeholder=placeholder||'';
    ta.value=val;field.append(label,ta);wrapper.append(field);
  }
  followups.append(wrapper);refreshFollowups();
}
get('addFollowup').addEventListener('click',()=>addFollowup());

/* Local-first bilingual match suggestions; only exact linked canonical text is submitted. */
let linkedId=null;
const normMatch=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const chinese=s=>(String(s||'').match(/[\u3400-\u9fff]/g)||[]).join('');
function words(s){return normMatch(s).split(/\s+/).filter(w=>w.length>2&&!['how','what','why','the','and','can','would','could','from','with','you','your','for','are','this','that'].includes(w));}
function matchScore(entry,query){
  const q=normMatch(query);
  if(q.length<3)return 0;
  const corpus=normMatch(entry.en+' '+entry.cn);
  if(corpus.includes(q))return 2;
  const queryWords=words(query),targetWords=words(entry.en+' '+entry.cn);
  const wordHits=queryWords.filter(w=>targetWords.some(t=>t===w||(w.length>=5&&t.startsWith(w)))).length;
  const wordScore=queryWords.length?wordHits/queryWords.length:0;
  const h=chinese(query),targetH=chinese(entry.cn);
  const pairs=h.length>1?Array.from({length:h.length-1},(_,i)=>h.slice(i,i+2)):[];
  const zhScore=pairs.length?pairs.filter(p=>targetH.includes(p)).length/pairs.length:0;
  return Math.max(wordScore,zhScore);
}
function availableQuestions(){
  const campus=trimmed('submissionCampus'),track=trimmed('submissionTrack');
  const keys=campus==='nansha'?(track==='regular'?
    PAST_QUESTION_IDS.concat(BANKS.D.items.map(it=>'D-'+it.num)):
    BANKS.F.items.map(it=>'F-'+it.num)):
    (BANKS[track==='regular'?'H':'T']?.items||[]).map(it=>(track==='regular'?'H-':'T-')+it.num);
  return keys.map(id=>{
    const key=id.split('-')[0],entry=BANKS[key].items.find(it=>key+'-'+it.num===id);
    return entry?{id,en:entry.en,cn:entry.cn||''}:null;
  }).filter(Boolean);
}
function findQuestion(id){
  const track=trimmed('submissionTrack'),campus=trimmed('submissionCampus');
  const allowed=campus==='nansha'?(track==='fast-track'?['F']:['A','B','C','D']):
    campus==='clear-water-bay'?(track==='fast-track'?['T']:['H']):
    (track==='fast-track'?['F','T']:['A','B','C','D','H']);
  const key=String(id||'').split('-')[0],bank=allowed.includes(key)&&BANKS[key];
  const entry=bank&&bank.items.find(it=>key+'-'+it.num===id);
  return entry?{id,en:entry.en,cn:entry.cn||''}:null;
}
function clearLink(){
  linkedId=null;
  get('mainEn').readOnly=false;get('mainCn').readOnly=false;
  get('mainEnField').classList.remove('linked-hidden');
  get('mainCnField').classList.remove('linked-hidden');
  get('linkedQuestion').hidden=true;
  get('mainEn').value='';get('mainCn').value='';
  get('supplementEn').value='';get('supplementCn').value='';
  syncContributionIntent();
  renderSuggestions();
}
function linkQuestion(entry){
  linkedId=entry.id;
  get('mainEn').value=entry.en;
  get('mainCn').value=entry.cn||'';
  get('mainEn').readOnly=true;
  get('mainCn').readOnly=true;
  get('mainEnField').classList.add('linked-hidden');
  get('mainCnField').classList.add('linked-hidden');
  get('linkedQuestionTitle').textContent=entry.en+' · '+entry.id;
  get('linkedQuestion').hidden=false;
  get('matchingResults').replaceChildren();
  get('matchingPanel').hidden=false;
  const selected=get('contributionIntent').querySelector('input[value="encounter"]');
  selected.checked=true;
  syncContributionIntent();
}
function syncContributionIntent(){
  const supplement=linkedId&&form.querySelector('input[name="contributionIntent"]:checked')?.value==='supplement';
  get('supplementQuestionFields').hidden=!supplement;
  get('supplementEn').disabled=!supplement;
  get('supplementCn').disabled=!supplement;
}
for(const radio of form.querySelectorAll('input[name="contributionIntent"]'))
  radio.addEventListener('change',syncContributionIntent);
function renderSuggestions(){
  if(kind!=='question'){get('matchingPanel').hidden=true;return;}
  if(linkedId){get('matchingPanel').hidden=false;return;}
  const raw=[trimmed('mainEn'),trimmed('mainCn')].filter(Boolean);
  const matches=availableQuestions().map(entry=>({
    ...entry,rank:Math.max(...raw.map(q=>matchScore(entry,q)),0)
  })).filter(e=>e.rank>=0.28).sort((a,b)=>b.rank-a.rank).slice(0,3);
  const out=get('matchingResults');out.replaceChildren();
  get('linkedQuestion').hidden=true;
  get('matchingPanel').hidden=matches.length===0;
  for(const entry of matches){
    const button=document.createElement('button');button.type='button';button.className='contrib-match';
    const block=document.createElement('span');block.textContent=entry.en;
    const detail=document.createElement('small');detail.textContent=entry.cn;block.append(detail);
    const action=document.createElement('em');action.textContent='关联 / Select';
    button.append(block,action);button.addEventListener('click',()=>linkQuestion(entry));out.append(button);
  }
}
get('unlinkQuestion').addEventListener('click',clearLink);
for(const id of ['mainEn','mainCn'])get(id).addEventListener('input',()=>{if(!linkedId)renderSuggestions();});
// A deep link may start with no campus selected; once selected, never keep a
// canonical question from another campus or assessment in the draft.
for(const id of ['submissionCampus','submissionTrack'])get(id).addEventListener('change',()=>{
  if(linkedId&&!findQuestion(linkedId))clearLink();
  else renderSuggestions();
});
function loadQuestionLink(){
  const params=new URLSearchParams(location.search);
  const campus=params.get('campus'),track=params.get('track'),id=params.get('question');
  if(['regular','fast-track'].includes(track))get('adviceTrack').value=track;
  if(['nansha','clear-water-bay'].includes(campus))get('submissionCampus').value=campus;
  if(['regular','fast-track'].includes(track))get('submissionTrack').value=track;
  const q=id&&findQuestion(id);
  if(q){
    linkQuestion(q);
    const intent=params.get('intent');
    if(intent==='supplement')
      get('contributionIntent').querySelector('input[value="supplement"]').checked=true;
    syncContributionIntent();
    if(intent==='encounter')requestAnimationFrame(()=>{
      get('exam-context').scrollIntoView({block:'start',behavior:'instant'});
      get('submissionCampus').focus({preventScroll:true});
    });
  }else renderSuggestions();
}

loadQuestionLink();
function buildData(){
  if(kind==='advice'){
    const tags=[...list.querySelectorAll('input:checked')].map(x=>x.value);
    if(tags.length<1||tags.length>4)throw new Error('请选择 1–4 个主题标签。 / Please select 1–4 topics.');
    return {version:2,kind:'advice',track:trimmed('adviceTrack'),phase:trimmed('advicePhase'),tags,
      title:trimmed('adviceTitle'),body:trimmed('adviceBody')};
  }
  const slot=trimmed('submissionSlot');
  if(!slot)throw new Error('请选择学期及场次。 / Please select a semester and session.');
  const [semester,examStage]=slot.split(':');
  const subs=[...followups.children].map(el=>({
    en:el.querySelector('[data-lang="en"]').value.trim(),
    cn:el.querySelector('[data-lang="cn"]').value.trim()
  }));
  if(!trimmed('mainEn')||subs.some(x=>!x.en))
    throw new Error('请填写英文主问题；小问只需填写记得的英文内容，中文可留空。');
  const intent=linkedId?form.querySelector('input[name="contributionIntent"]:checked').value:'encounter';
  const alternative=intent==='supplement'?{en:trimmed('supplementEn'),cn:trimmed('supplementCn')}:null;
  if(alternative&&alternative.cn&&!alternative.en)
    throw new Error('填写中文理解时，也请填写补充的英文题目。');
  if(intent==='supplement'&&!alternative.en&&!subs.length)
    throw new Error('仅补充题目内容时，请填写相似问法或至少添加一条新的提示小问。');
  return {version:2,kind:'question',campus:trimmed('submissionCampus'),track:trimmed('submissionTrack'),
    term:trimmed('submissionYear')+' '+semester,
    examStage,main:{en:trimmed('mainEn'),cn:trimmed('mainCn')},
    subs,source:trimmed('submissionSource'),
    ...(alternative&&alternative.en?{alternatives:[alternative]}:{}),
    ...(linkedId?{linkedQuestionId:linkedId,intent}:{} )};
}
function validateForm(){
  if(!form.reportValidity())return null;
  try{
    const data=buildData();
    const bytes=new TextEncoder().encode(JSON.stringify({...data,turnstileToken:'x'.repeat(2048)})).byteLength;
    if(bytes>24576)throw new Error('内容过长，请精简。 / Content is too long. Please shorten it.');
    return data;
  }catch(e){say(e.message,'error');return null;}
}
function showPreview(){
  const data=validateForm();if(!data)return;
  const preview=get('previewPanel');preview.replaceChildren();
  addText(preview,'h2','投稿预览 · Review');
  if(data.kind==='question'){
    addText(preview,'small',(data.linkedQuestionId?'已关联 '+data.linkedQuestionId+' · '+
      (data.intent==='supplement'?'补充题目内容':'我也考过 / Seen this')+' · ':'')+
      (data.campus==='nansha'?'GZ':'HK')+' · '+
      (data.track==='regular'?'常规 ELPA · Regular':'ELPA Fast Track')+' · '+data.term+' · '+taxonomy.examStages[data.examStage].zh+
      ' · '+taxonomy.sourceTypes[data.source].zh);
    addText(preview,'strong',data.main.en);
    addText(preview,'p',data.main.cn);
    for(const alternative of data.alternatives||[]){
      addText(preview,'small','相似问法','contrib-preview-line');
      addText(preview,'p',alternative.en);
      addText(preview,'p',alternative.cn);
    }
    for(const [i,s] of data.subs.entries()){
      addText(preview,'small','小问 '+(i+1),'contrib-preview-line');
      addText(preview,'p',s.en);
      addText(preview,'p',s.cn);
    }
  }else{
    addText(preview,'small',(data.track==='fast-track'?'ELPA Fast Track':'常规 ELPA · Regular')+' · '+taxonomy.advicePhases[data.phase].zh+' · '+
      data.tags.map(x=>taxonomy.adviceTags[x].zh).join('、'));
    addText(preview,'strong',data.title);
    addText(preview,'p',data.body);
  }
  addText(preview,'small','内容将公开保存。 / This submission will be public.');
  preview.hidden=false;preview.scrollIntoView({block:'nearest',behavior:'smooth'});
}
get('previewButton').addEventListener('click',showPreview);
if(!ready){
  say('投稿暂不可用。 / Submissions are unavailable. Please try later.','error');
}else{
  say('填写后完成人机验证。 / Complete the form and verification to submit.');
  const started=Date.now();
  const initialize=()=>{
    if(window.turnstile&&typeof window.turnstile.render==='function'){
      try{
        widgetId=window.turnstile.render('#submissionTurnstile',{
          sitekey:config.turnstileSiteKey,
          action:'elpa_submit',
          callback:()=>{if(!submitting){btn.disabled=false;say('验证完成，可以提交。 / Verified. You can submit now.');}},
          'expired-callback':()=>{btn.disabled=true;say('验证已过期。 / Verification expired. Please verify again.','error');},
          'error-callback':()=>{btn.disabled=true;say('验证失败。 / Verification failed. Please refresh and retry.','error');}
        });
      }catch{say('验证初始化失败。 / Verification could not start. Please refresh.','error');}
    }else if(Date.now()-started<12000)setTimeout(initialize,200);
    else say('验证加载失败。 / Verification could not load. Please refresh.','error');
  };
  initialize();
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!ready||widgetId===null||btn.disabled||submitting)return;
  const data=validateForm();if(!data)return;
  const token=window.turnstile.getResponse(widgetId);
  if(!token){say('请完成人机验证。 / Please complete verification.','error');btn.disabled=true;return;}
  submitting=true;btn.disabled=true;say('正在提交 / Submitting…');
  try{
    const response=await fetch(config.apiEndpoint,{
      method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...data,turnstileToken:token})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.ok)throw new Error(result.message||'提交失败，请稍后重试。 / Submission failed. Please try again.');
    form.reset();followups.replaceChildren();refreshFollowups();
    get('mainEn').readOnly=false;get('mainCn').readOnly=false;linkedId=null;
    get('supplementEn').value='';get('supplementCn').value='';syncContributionIntent();
    get('mainEnField').classList.remove('linked-hidden');
    get('mainCnField').classList.remove('linked-hidden');
    year.value=String(currentYear);
    get('submissionSlot').value='';
    get('previewPanel').hidden=true;
    setKind(kind);
    say('分享已提交，待核对与整理。 / Submitted! Contributions are reviewed before inclusion.','success');
    if(/^https:\/\/github\.com\/FuTseYi\/HKUST-ELPA\/issues\/\d+$/.test(result.issueUrl||'')){
      const a=document.createElement('a');a.href=result.issueUrl;a.target='_blank';
      a.rel='noopener noreferrer';a.textContent='查看投稿记录 / View submission';message.append(' ',a);
    }
  }catch(e){say(e.message||'网络异常，请重试。 / Network error. Please try again.','error');}
  finally{
    submitting=false;btn.disabled=true;
    if(widgetId!==null&&window.turnstile)window.turnstile.reset(widgetId);
  }
});
setKind(new URLSearchParams(location.search).get('kind')==='advice'?'advice':'question');
})();
