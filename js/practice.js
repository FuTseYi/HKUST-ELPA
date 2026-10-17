/* ============ 应用逻辑 ============ */


/* 题目数据由 question-bank/questions.js 提供，见同目录的来源说明。 */

/* ============ 学习记录：浏览器本地优先，JSON 文件可选同步 ============ */
const DATA_FILE = 'elpa_data.json';
/* Campus distinguishes the source of a question, not the university-wide assessment category. */
let activeCampus='nansha',activeTrack='regular';
const examChoiceNote=document.getElementById('elpaChoiceNote');
function isNanshaRegular(){return activeCampus==='nansha'&&activeTrack==='regular';}
function activePracticeIds(){
  if(activeCampus==='nansha'&&activeTrack==='fast-track')return BANKS.F.items.map(it=>'F-'+it.num);
  if(activeCampus==='clear-water-bay')return (activeTrack==='regular'?BANKS.H:BANKS.T).items.map(it=>(activeTrack==='regular'?'H-':'T-')+it.num);
  return elpaAllPracticeIds();
}
const LS_KEY = 'elpa-q-status-v1'; // 兼容旧数据
const LS_NOTES = 'elpa-notes-v1';  // 兼容旧数据
const LS_SNAPSHOT = 'elpa-data-snapshot-v2';
const IDB_NAME = 'elpa-fs-db';
const IDB_STORE = 'handles';
const IDB_DIR_KEY = 'data-dir';

let statuses = {};
let notes = {};
let dirHandle = null;
let dirty = false; // 已保存于浏览器，但尚未同步到所选文件夹
let revision = 0;
let fileWriteQueue = Promise.resolve();
const fsSupported = typeof window.showDirectoryPicker === 'function' && !!window.isSecureContext;

function validRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function normalizePayload(data) {
  if (!validRecord(data) || !validRecord(data.statuses) || !validRecord(data.notes)) {
    throw new Error('数据文件格式不正确（需要 statuses 与 notes 对象）');
  }
  const cleanStatuses = {};
  const cleanNotes = {};
  for (const [key, value] of Object.entries(data.statuses)) {
    if ((/^[A-DFHT]-\d+$/.test(key) || key === 'A-附') && ['new', 'doing', 'done'].includes(value)) cleanStatuses[key] = value;
  }
  for (const [key, value] of Object.entries(data.notes)) {
    if ((/^(?:qn-)?[A-DFHT]-\d+(?:-\d+)?$/.test(key) || key === 'qn-A-附') && typeof value === 'string' && value.length <= 200000) {
      cleanNotes[key] = value;
    }
  }
  return { version: 1, updatedAt: data.updatedAt || '', statuses: cleanStatuses, notes: cleanNotes };
}
function snapshot() {
  return { version: 1, updatedAt: new Date().toISOString(), statuses: { ...statuses }, notes: { ...notes } };
}
function persistBrowser(payload = snapshot()) {
  try {
    localStorage.setItem(LS_SNAPSHOT, JSON.stringify(payload));
    return true;
  } catch (error) {
    setTip('❌ 浏览器存储空间不足或存储被禁用。请先点击“备份”保存 JSON 文件。', 'err');
    return false;
  }
}
function restoreBrowser() {
  try {
    const saved = localStorage.getItem(LS_SNAPSHOT);
    const data = saved ? JSON.parse(saved) : {
      statuses: JSON.parse(localStorage.getItem(LS_KEY) || '{}'),
      notes: JSON.parse(localStorage.getItem(LS_NOTES) || '{}'),
      updatedAt: ''
    };
    const valid = normalizePayload(data);
    statuses = valid.statuses;
    notes = valid.notes;
    return valid;
  } catch (error) {
    console.warn('旧学习记录读取失败，当前使用空数据：', error);
    statuses = {};
    notes = {};
    return { updatedAt: '', statuses, notes };
  }
}

/* ---- 记住文件夹句柄，兼容已有配置 ---- */
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => { e.target.result.createObjectStore(IDB_STORE); };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = e => { db.close(); reject(e); };
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => { db.close(); resolve(rq.result || null); };
    rq.onerror = e => { db.close(); reject(e); };
  });
}

function setTip(msg, cls) {
  const el = document.getElementById('storageTip');
  if (!el) return;
  el.textContent = msg;
  el.className = 'storage-banner show' + (cls ? ' ' + cls : '');
}
function updateSaveBtn() {
  const btn = document.getElementById('saveBtn');
  if (!btn) return;
  btn.classList.toggle('dirty', dirty);
  if (dirty) btn.classList.remove('saved');
}
function flashSaveBtn() {
  const btn = document.getElementById('saveBtn');
  const top = document.getElementById('saveTopBtn');
  btn.classList.add('saved');
  setTimeout(() => btn.classList.remove('saved'), 1500);
  if (top) {
    const old = top.innerHTML;
    top.classList.add('saved');
    top.innerHTML = '✅ 已保存';
    setTimeout(() => { top.classList.remove('saved'); top.innerHTML = old; }, 1500);
  }
}
function setSaving(flag) {
  const top = document.getElementById('saveTopBtn');
  if (!top) return;
  top.disabled = flag;
  top.classList.toggle('saving', flag);
}

/* ---- 文件写入按序执行，避免手动保存与自动同步互相覆盖 ---- */
async function writeData() {
  const data = snapshot();
  if (!persistBrowser(data)) throw new Error('浏览器存储失败');
  if (fsSupported && dirHandle) {
    const content = JSON.stringify(data, null, 2);
    const selectedDir = dirHandle;
    const task = async () => {
      const fh = await selectedDir.getFileHandle(DATA_FILE, { create: true });
      const w = await fh.createWritable();
      try { await w.write(content); await w.close(); }
      catch (e) { try { await w.abort(); } catch (_) {} throw e; }
    };
    const pending = fileWriteQueue.then(task, task);
    fileWriteQueue = pending.catch(() => {});
    await pending;
  }
}
async function loadFromDir(localRecord = null, explicit = false) {
  let fh;
  try { fh = await dirHandle.getFileHandle(DATA_FILE, { create: false }); }
  catch (e) { if (e.name === 'NotFoundError') return false; throw e; }
  const raw = await fh.getFile();
  const data = normalizePayload(JSON.parse(await raw.text()));
  const localCount = Object.keys(statuses).length + Object.keys(notes).length;
  const fileCount = Object.keys(data.statuses).length + Object.keys(data.notes).length;
  const localDate = Date.parse(localRecord && localRecord.updatedAt || '') || 0;
  const fileDate = Date.parse(data.updatedAt || '') || 0;
  if (!explicit && localCount && (localDate > fileDate || (!fileDate && fileCount))) {
    dirty = true;
    updateSaveBtn();
    setTip('ℹ️ 浏览器内有更新的学习记录，已优先保留。点击“保存”可同步到已关联的 JSON 文件。', 'ok');
    return true;
  }
  if (!explicit && localCount && !fileCount) {
    dirty = true;
    updateSaveBtn();
    setTip('ℹ️ JSON 文件为空，已保留浏览器内已有学习记录。', 'ok');
    return true;
  }
  statuses = data.statuses;
  notes = data.notes;
  persistBrowser({ ...data, updatedAt: data.updatedAt || new Date().toISOString() });
  dirty = false;
  updateSaveBtn();
  setTip('✅ 已读取 ' + DATA_FILE + '（进度 ' + Object.keys(statuses).length + ' 条 · 笔记 ' + Object.keys(notes).length + ' 条）', 'ok');
  return true;
}

let autoSaveOn = true;
let autoSaveTimer = null;
function scheduleFileSync() {
  clearTimeout(autoSaveTimer);
  if (!autoSaveOn || !dirHandle) return;
  autoSaveTimer = setTimeout(async () => {
    const currentRevision = revision;
    try {
      await writeData();
      if (currentRevision === revision) {
        dirty = false;
        updateSaveBtn();
        setTip('✅ 已同步 JSON 文件（' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '）', 'ok');
      } else {
        scheduleFileSync();
      }
    } catch (e) {
      dirty = true;
      updateSaveBtn();
      setTip('⚠️ 浏览器记录已保留，JSON 自动同步失败：' + e.message + '。请手动保存重试。', 'err');
    }
  }, 1500);
}
function markDirty() {
  revision++;
  const localOk = persistBrowser();
  dirty = !!dirHandle || !localOk;
  updateSaveBtn();
  scheduleFileSync();
}
async function initStorage() {
  restoreBrowser();
  // Existing local progress remains authoritative; legacy folder sync is no longer automatic.
  const notice=document.getElementById('storageTip');
  notice.className='storage-banner';
  notice.textContent='';
}

/* ---- 手动关联文件夹：已有 JSON 时必须先确认是否导入 ---- */
async function connectDirectory() {
  if (!fsSupported) {
    setTip('该浏览器不支持文件夹写入。请使用“备份 / 恢复”管理 JSON 文件。', 'err');
    return false;
  }
  const candidate = await window.showDirectoryPicker({ id: 'elpa-data-dir', mode: 'readwrite' });
  let existing = false;
  try { await candidate.getFileHandle(DATA_FILE, { create: false }); existing = true; }
  catch (e) { if (e.name !== 'NotFoundError') throw e; }
  if (existing) {
    const ok = window.confirm('该文件夹已有 elpa_data.json。是否导入该文件并替换当前页面的浏览器记录？\n建议先使用“备份”保存当前记录。取消则不连接该文件夹。');
    if (!ok) return false;
    const previous = dirHandle;
    dirHandle = candidate;
    try {
      await loadFromDir(null, true);
    } catch (e) {
      dirHandle = previous;
      throw e;
    }
    renderAll();
  } else {
    dirHandle = candidate;
    await writeData();
    dirty = false;
    updateSaveBtn();
    setTip('✅ 已关联文件夹，并创建 ' + DATA_FILE, 'ok');
  }
  try { await idbSet(IDB_DIR_KEY, candidate); }
  catch (e) { setTip('⚠️ 文件已读取／保存，但浏览器未能记住文件夹，下次可能需要重新选择。', 'err'); }
  return true;
}

/* ---- 手动保存：始终有本地副本；文件同步为可选操作 ---- */
async function handleSave() {
  setSaving(true);
  try {
    const savedRevision = revision;
    await writeData();
    if (savedRevision === revision) {
      dirty = false;
      updateSaveBtn();
    } else {
      scheduleFileSync();
    }
    setTip('✅ 已保存' + (dirHandle ? '至浏览器并同步 ' + DATA_FILE : '到浏览器本地'), 'ok');
    flashSaveBtn();
  } catch (e) {
    setTip('⚠️ 文件保存失败：' + e.message + '；请确认浏览器本地记录或使用 JSON 备份。', 'err');
  } finally {
    setSaving(false);
  }
}
document.getElementById('saveBtn').addEventListener('click', handleSave);
document.getElementById('saveTopBtn').addEventListener('click', handleSave);

/* ---- 自动同步只控制已关联文件夹；浏览器始终自动保存 ---- */
try { autoSaveOn = localStorage.getItem('elpa-autosave') !== '0'; } catch (e) { autoSaveOn = true; }
const autoSaveToggle = document.getElementById('autoSaveToggle');
autoSaveToggle.checked = autoSaveOn;
autoSaveToggle.addEventListener('change', () => {
  autoSaveOn = autoSaveToggle.checked;
  try { localStorage.setItem('elpa-autosave', autoSaveOn ? '1' : '0'); } catch (e) {}
  if (autoSaveOn && dirty) scheduleFileSync();
  if (!autoSaveOn) clearTimeout(autoSaveTimer);
  setTip(autoSaveOn ? '✅ 已开启文件自动同步；浏览器学习记录始终自动保存。' : 'ℹ️ 已关闭文件自动同步；浏览器学习记录仍会自动保存。', 'ok');
});
document.getElementById('folderBtn').addEventListener('click', async () => {
  try { await connectDirectory(); }
  catch (e) {
    if (e.name !== 'AbortError') setTip('❌ 无法关联文件夹：' + e.message, 'err');
  }
});

/* ---- JSON 备份与恢复，不依赖 File System Access API ---- */
document.getElementById('backupBtn').addEventListener('click', () => {
  const content = JSON.stringify(snapshot(), null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'elpa_data_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setTip('✅ 已生成 JSON 备份，请将下载的文件妥善保管。', 'ok');
});
const restoreInput = document.getElementById('restoreInput');
document.getElementById('restoreBtn').addEventListener('click', () => restoreInput.click());
restoreInput.addEventListener('change', async () => {
  const file = restoreInput.files && restoreInput.files[0];
  restoreInput.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    setTip('❌ JSON 备份超过 5 MB；为安全起见未导入。', 'err');
    return;
  }
  try {
    const data = normalizePayload(JSON.parse(await file.text()));
    if (!window.confirm('确认从此 JSON 恢复学习记录？这将替换当前浏览器内的进度和笔记。\n建议先点击“备份”保存现有记录。\n\nRestore this backup? It will replace the progress and notes in this browser. Back up your current records first.')) return;
    statuses = data.statuses;
    notes = data.notes;
    renderAll();
    markDirty();
    setTip('✅ 已恢复学习进度与笔记，并保存到本浏览器' + (dirHandle ? '；关联文件将按自动同步设置更新。' : '。'), 'ok');
  } catch (e) {
    setTip('❌ 备份文件无法导入：' + e.message, 'err');
  }
});

function qId(bank, num) { return bank + '-' + num; }
function questionTranslation(bankKey,item) {
  return item.cn || '';
}
function questionSourceNote(bankKey,item) {
  if(item && typeof item.recallTag === 'string')return item.recallTag;
  if(bankKey==='F' && item && item.verbatim===false)
    return '英文根据中文回忆整理，用于练习；非已核实的现场逐字题干。';
  return '';
}
function appearancesFor(id){
  const records=ELPA_APPEARANCES[id];
  return Array.isArray(records)?records:[];
}
function feedbackCount(id){
  const item=questionById(id);
  if(!item)return 0;
  const reports=appearancesFor(id);
  // Historic student recollections start at one; Fast Track retains its sourced report count.
  // Newly imported questions already have their originating Issue in appearances.
  const imported=Number(item.num)>=1000000&&reports.length>0;
  const baseline=imported?0:(Number.isInteger(item.records)&&item.records>0?item.records:1);
  const encounters=reports.filter(x=>x&&x.intent!=='supplement'&&
    Number.isInteger(x.issueNumber)&&x.issueNumber>0);
  return baseline+new Set(encounters.map(x=>x.issueNumber)).size;
}
function questionFollowups(id,item){
  const result=[],seen=new Set();
  for(const sub of [...(item.subs||[]),...appearancesFor(id).flatMap(x=>Array.isArray(x.subs)?x.subs:[])]){
    if(!sub||(!sub.en&&!sub.cn))continue;
    const key=String(sub.en||sub.cn).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
    if(seen.has(key))continue;
    seen.add(key);result.push(sub);
  }
  return result;
}
function questionAlternatives(id,item){
  const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
  const result=[],seen=new Set([normalize(item.en)]);
  for(const alternative of appearancesFor(id).flatMap(x=>Array.isArray(x.alternatives)?x.alternatives:[])){
    if(!alternative||!alternative.en)continue;
    const key=normalize(alternative.en);
    if(seen.has(key))continue;
    seen.add(key);result.push(alternative);
  }
  return result;
}
function feedbackRanked(ids){
  return ids.map((id,i)=>({id,i,count:feedbackCount(id)}))
    .sort((a,b)=>b.count-a.count||a.i-b.i).map(x=>x.id);
}
function toggleTranslation(id,button){
  const target=document.getElementById(id);
  if(!target||!button)return;
  const showing=target.hidden;
  target.hidden=!showing;
  button.setAttribute('aria-expanded',String(showing));
  button.textContent=showing?'收起 Hide':'中文 CN';
}
function toggleVariantChinese(id,button){
  const section=document.getElementById('variants-'+id);
  if(!section||!button)return;
  const targets=[...section.querySelectorAll('.subq-cn.translation')];
  if(!targets.length)return;
  const showing=targets[0].hidden;
  for(const node of targets)node.hidden=!showing;
  button.setAttribute('aria-expanded',String(showing));
  button.textContent=showing?'收起中文 / Hide Chinese':'相似问法中文 / Chinese variants';
}
function toggleFollowupChinese(id,button){
  const section=document.getElementById('subq-'+id);
  if(!section||!button)return;
  const targets=[...section.querySelectorAll('.subq-cn.translation')];
  if(!targets.length)return;
  const showing=targets[0].hidden;
  for(const node of targets)node.hidden=!showing;
  button.setAttribute('aria-expanded',String(showing));
  button.textContent=showing?'收起中文 / Hide Chinese':'小问中文 / Chinese follow-ups';
}


function esc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function activeLatestTerm(){
  return elpaLatestTermForIds(activePracticeIds());
}
function activeLatestSession(){
  const stageOrder={start:0,mid:1,end:2};
  const sessions=new Map();
  for(const id of activePracticeIds())for(const entry of appearancesFor(id)){
    if(!entry||!/^20\d{2} (Spring|Fall)$/.test(entry.term)||!ELPA_TAXONOMY.examStages[entry.examStage])continue;
    sessions.set(entry.term+'|'+entry.examStage,{term:entry.term,stage:entry.examStage});
  }
  return [...sessions.values()].sort((a,b)=>{
    const [yearA,seasonA]=a.term.split(' '),[yearB,seasonB]=b.term.split(' ');
    return Number(yearB)-Number(yearA)||(seasonB==='Fall'?1:0)-(seasonA==='Fall'?1:0)||stageOrder[b.stage]-stageOrder[a.stage];
  })[0]||null;
}
function activeLatestSessionLabel(){
  const session=activeLatestSession();
  if(session)return session.term+' · '+ELPA_TAXONOMY.examStages[session.stage].zh;
  return activeLatestTerm()||(activePracticeIds().length?'场次待核实':'当前场次题库');
}
function activeCurrentIds(){
  const session=activeLatestSession();
  if(session)return activePracticeIds().filter(id=>appearancesFor(id).some(entry=>
    entry&&entry.term===session.term&&entry.examStage===session.stage));
  const term=activeLatestTerm();
  return term?activePracticeIds().filter(id=>elpaReportedTerms(id).includes(term)):activePracticeIds();
}
function activeArchivedIds(){
  const current=new Set(activeCurrentIds());
  return activePracticeIds().filter(id=>!current.has(id));
}
function renderTOC() {
  const campus=activeCampus==='nansha'?'GZ':'HK';
  const type=activeTrack==='regular'?'常规 ELPA · Regular':'ELPA Fast Track';
  const count=activePracticeIds().length;
  const sessionLabel=activeLatestSessionLabel(),current=activeCurrentIds(),past=activeArchivedIds();
  const selectedValue=sessionFilter.value;
  const [selectedTerm='',selectedStage='']=selectedValue.split('|');
  const selectedOption=sessionFilter.options[sessionFilter.selectedIndex];
  const selectedLabel=selectedOption&&selectedValue?selectedOption.text:sessionLabel;
  const latest=activeLatestSession();
  const selectedIsCurrent=!!(selectedValue&&latest&&latest.term===selectedTerm&&latest.stage===selectedStage);
  document.getElementById('sec-bankD').hidden=!!selectedValue&&!selectedIsCurrent;
  document.getElementById('sec-bankA').hidden=!!selectedValue&&selectedIsCurrent;
  document.getElementById('currentBankTitle').textContent=selectedIsCurrent?selectedLabel:sessionLabel;
  document.getElementById('pastBankTitle').textContent=selectedValue&&!selectedIsCurrent?selectedLabel:'过往题库';
  document.getElementById('pagerFall').setAttribute('aria-label',(selectedIsCurrent?selectedLabel:sessionLabel)+'分页');
  document.getElementById('pagerPast').setAttribute('aria-label',(selectedValue&&!selectedIsCurrent?selectedLabel:'过往题库')+'分页');
  document.getElementById('feedbackBankCount').textContent=current.length+' 题';
  document.getElementById('pastBankCount').textContent=past.length+' 题';
  examChoiceNote.textContent=campus+' · '+type+' · '+count+' 道题；仅按有来源依据的场次归类。';
  const items=selectedValue?
    [[selectedIsCurrent?'sec-bankD':'sec-bankA',selectedIsCurrent?'🎓':'📚',selectedLabel]]:
    [['sec-bankD','🎓',sessionLabel],['sec-bankA','📚','过往题库']];
  document.getElementById('toc').innerHTML =
    '<h2>📑 题库导航</h2><div class="toc-grid">' +
    items.map(i => `<a href="#${i[0]}"><span class="num">${i[1]}</span>${esc(i[2])}</a>`).join('') +
    '</div>';
}

function questionById(id) {
  const key = id.split('-')[0];
  return BANKS[key].items.find(it => qId(key, it.num) === id);
}
function allPracticeIds() {
  return activePracticeIds();
}
function renderQuestionIds(ids) {
  return feedbackRanked(ids).map((id,index) => {
    const key=id.split('-')[0],item=questionById(id);
    return renderBank(key,[item],index);
  }).join('');
}
function migrateLegacyPractice() {
  let changed = false;
  for (const [oldId, newId] of Object.entries(LEGACY_QUESTION_ALIASES)) {
    if (!statuses[newId] && statuses[oldId]) { statuses[newId] = statuses[oldId]; changed = true; }
    if (!notes['qn-' + newId] && notes['qn-' + oldId]) {
      notes['qn-' + newId] = notes['qn-' + oldId]; changed = true;
    }
  }
  return changed;
}
function renderBank(bankKey, items = BANKS[bankKey].items, startIndex = 0) {
  return items.map((item, idx) => {
    const id = qId(bankKey, item.num);
    const st = statuses[id] || 'new';
    const stMap = { new: ['未练 New', 'active-new'], doing: ['练习中 Doing', 'active-doing'], done: ['已掌握 Done', 'active-done'] };
    const subs=questionFollowups(id,item);
    const alternatives=questionAlternatives(id,item);
    const hasSubs=subs.length>0;
    const qnoteKey = 'qn-' + id;
    const qnoteSaved = notes[qnoteKey] || '';
    const translation=questionTranslation(bankKey,item);
    const sourceNote=questionSourceNote(bankKey,item);
    const feedback=feedbackCount(id);
    const searchText = (item.en + ' ' + (item.cn||'') + ' ' + alternatives.map(s=>s.en+' '+(s.cn||'')).join(' ') + ' ' + subs.map(s => s.en + ' ' + (s.cn||'')).join(' ')).toLowerCase();
    return `
    <div class="qcard status-${st}" id="q-${id}" data-search="${escAttr(searchText)}">
      <div class="q-top">
        <div class="q-num">${idx + startIndex + 1}</div>
        <div class="q-title">
          <div class="en">${esc(item.en)}</div>
          ${sourceNote ? `<span class="recall-mark">${esc(sourceNote)}</span>` : ""}
          ${feedback ? `<div class="question-feedback"><span>↻ 过往考过 ${feedback} 次</span><a href="./submit.html?question=${encodeURIComponent(id)}&track=${encodeURIComponent(activeTrack)}&intent=encounter" aria-label="我也考过这道题，提交考试反馈">我也考过 / Seen this</a></div>` : ''}
          ${translation ? `<div class="cn translation" id="cn-${id}" hidden>${esc(translation)}</div>` : ''}
        </div>
        <div class="q-actions ${translation ? "has-translation" : "no-translation"}">
          ${translation ? `<button type="button" class="translation-toggle" aria-expanded="false" aria-controls="cn-${id}" onclick="toggleTranslation('cn-${id}',this)">中文 CN</button>` : ""}
          <button class="copy-btn" onclick="copyQuestion('${id}')" title="复制题目 / Copy question">复制 Copy</button>
          <button class="status-btn ${stMap[st][1]}" onclick="cycleStatus('${id}', this)">${stMap[st][0]}</button>
        </div>
      </div>
      ${alternatives.length ? `
      <div class="subq" id="variants-${id}">
        <button type="button" class="subq-head" onclick="toggleVariants('${id}')" aria-expanded="false" aria-controls="variants-list-${id}">
          <span class="arrow">▶</span>相似问法 / Variants (${alternatives.length})
        </button>
        <div class="subq-list" id="variants-list-${id}">
          ${alternatives.some(s=>s.cn) ? `<button type="button" class="translation-toggle translation-toggle-sub" aria-expanded="false" aria-controls="variants-list-${id}" onclick="toggleVariantChinese('${id}',this)">查看相似问法中文</button>` : ''}
          <ol>${alternatives.map(s=>`<li><span class="subq-en">${esc(s.en)}</span>${s.cn?`<span class="subq-cn translation" hidden>${esc(s.cn)}</span>`:''}</li>`).join('')}</ol>
        </div>
      </div>` : ''}
      ${hasSubs ? `
      <div class="subq" id="subq-${id}">
        <button type="button" class="subq-head" onclick="toggleSub('${id}')" aria-expanded="false" aria-controls="subq-list-${id}">
          <span class="arrow">▶</span>提示小问 / Follow-ups (${subs.length})
        </button>
        <div class="subq-list" id="subq-list-${id}">
        ${subs.some(x=>x.cn) ? `<button type="button" class="translation-toggle translation-toggle-sub" aria-expanded="false" onclick="toggleFollowupChinese('${id}',this)">查看小问中文</button>` : ''}<ol>
          ${subs.map((s, si) => {
            const nk = id + '-' + si;
            const saved = notes[nk] || '';
            return `
            <li>
              <span class="subq-en">${esc(s.en)}</span>
              ${s.cn ? `<span class="subq-cn translation" hidden>${esc(s.cn)}</span>` : ''}
              <div class="note-wrap" id="nw-${nk}">
                <div class="note-toolbar">
                  <button class="note-toggle" onclick="toggleNote('${nk}')" title="记录回答思路 / Add your notes">📝 记笔记 Notes</button>
                  <button class="md-tab" aria-pressed="false" id="mdt-prev-${nk}" onclick="togglePreview('${nk}')" title="显示/隐藏 Markdown 预览">👁 预览 Preview</button>
                </div>
                <textarea class="note-area" id="note-${nk}" rows="1" placeholder="记录回答思路 / Add your notes (Markdown supported)" oninput="saveNote('${nk}', this.value); autoResize(this)">${esc(saved)}</textarea>
                <div class="md-preview" id="mdp-${nk}"></div>
              </div>
            </li>`;}).join('')}
        </ol></div>
      </div>` : ''}
      <div class="qnote">
        <div class="note-wrap" id="nw-${qnoteKey}">
          <div class="note-toolbar">
            <button class="note-toggle" onclick="toggleNote('${qnoteKey}')" title="记录本题思路 / Add your notes">📝 我的笔记 Notes</button>
            <button class="md-tab" id="mdt-edit-${qnoteKey}" onclick="switchNoteMode('${qnoteKey}','edit')">✏️ 编辑 Edit</button>
            <button class="md-tab" id="mdt-prev-${qnoteKey}" onclick="switchNoteMode('${qnoteKey}','preview')">👁 预览 Preview</button>
          </div>
          <textarea class="note-area" id="note-${qnoteKey}" rows="3" placeholder="记录思路与反馈 / Add ideas and feedback (Markdown supported)" oninput="saveNote('${qnoteKey}', this.value)">${esc(qnoteSaved)}</textarea>
          <div class="md-preview" id="mdp-${qnoteKey}"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleSub(id) {
  const el = document.getElementById('subq-' + id);
  if (el) {
    const expanded = el.classList.toggle('open');
    el.querySelector('.subq-head').setAttribute('aria-expanded', String(expanded));
  }
}
function toggleVariants(id) {
  const el=document.getElementById('variants-'+id);
  if(el){
    const expanded=el.classList.toggle('open');
    el.querySelector('.subq-head').setAttribute('aria-expanded',String(expanded));
  }
}

/* ---- 小问笔记：展开/收起 + 自动标记修改 ---- */
/* ---- 笔记框高度自适应（展开时 & 输入时） ---- */
function autoResize(ta, force) {
  if (!ta) return;
  const userH = ta.clientHeight;         // 当前渲染高度（含用户手动拖拽的结果）
  ta.style.height = 'auto';
  const h = ta.scrollHeight + 2;         // 完全按内容高度，无上限
  // 只在「展开/切回编辑时强制适配」或「内容比当前高」时调整高度；
  // 否则保持用户手动拖拽的高度，避免输入时高度被弹回造成卡顿
  if (force || h > userH) {
    ta.style.height = h + 'px';
  } else {
    ta.style.height = userH + 'px';
  }
  ta.style.overflowY = 'hidden';
}

function toggleNote(nk) {
  const wrap = document.getElementById('nw-' + nk);
  if (!wrap) return;
  wrap.classList.toggle('open');
  if (wrap.classList.contains('open')) {
    autoResize(document.getElementById('note-' + nk), true);
    const ta = wrap.querySelector('.note-area');
    if (ta) ta.focus();
  }
}
function saveNote(nk, val) {
  notes[nk] = val;
  autoResize(document.getElementById('note-' + nk));
  markDirty();
}

/* ---- Markdown 渲染器（轻量、无依赖） ---- */
function renderMarkdown(src) {
  if (!src || !src.trim()) return '<p style="color:#9ca3af">（暂无内容，点击 ✏️ 编辑开始记录）</p>';
  let html = src;
  // 先保护 <u>下划线</u> 标签（避免被转义），还原时再对内容做转义
  const uls = [];
  html = html.replace(/<u>([\s\S]*?)<\/u>/gi, (m, c) => {
    uls.push(c);
    return '\x00U' + (uls.length - 1) + '\x00';
  });
  html = html
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 代码块
  html = html.replace(/```([\s\S]*?)```/g, (m, c) => '<pre><code>' + c.replace(/\n$/, '').trim() + '</code></pre>');
  // 表格 | a | b |
  html = html.replace(/(^\|.*\|[ \t]*(?:\n|$)(?:\|[^\n]*\|[ \t]*(?:\n|$))+)/gm, block => {
    const rows = block.trim().split('\n').filter(Boolean);
    const parse = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    let out = '<table>';
    const header = parse(rows[0]);
    out += '<thead><tr>' + header.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>';
    rows.slice(1).forEach(r => {
      if (/^[\s:\-|]+$/.test(r.replace(/\s/g, '').replace(/:/g, '').replace(/-/g, ''))) return; // 分隔行
      out += '<tr>' + parse(r).map(c => '<td>' + c + '</td>').join('') + '</tr>';
    });
    return out + '</tbody></table>';
  });
  // 标题
  html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  // 引用
  html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>');
  // 水平线 ---
  html = html.replace(/^-{3,}\s*$/gm, '<hr>');
  // 无序列表
  html = html.replace(/(?:^|\n)((?:[-*]\s+.*(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split('\n').map(l => '<li>' + l.replace(/^[-*]\s+/, '') + '</li>').join('');
    return '\n<ul>' + items + '</ul>\n';
  });
  // 有序列表
  html = html.replace(/(?:^|\n)((?:\d+[.)]\s+.*(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split('\n').map(l => '<li>' + l.replace(/^\d+[.)]\s+/, '') + '</li>').join('');
    return '\n<ol>' + items + '</ol>\n';
  });
  // 行内代码
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // 粗斜体 ***text***
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // 加粗（非贪婪，支持内部含单个 *）
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 删除线
  html = html.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  // 仅允许 http(s) 链接；URL 必须编码为安全的 HTML 属性值
  html = html.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/gi, (match, label, href) => {
    try {
      const url = new URL(href.replace(/&amp;/g, '&'));
      if (!['https:', 'http:'].includes(url.protocol)) return label;
      return '<a href="' + escAttr(url.href) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    } catch (e) { return label; }
  });
  // 斜体（边界含中英文标点）
  html = html.replace(/(^|[\s(（【\[「『])\*([^*\n]+)\*(?=[\s)）】」』\].:：;；,，!！?？、]|$)/g, '$1<em>$2</em>');
  // 保护块级元素（避免被 <p> 包裹）
  const blocks = [];
  html = html.replace(/(<pre>[\s\S]*?<\/pre>|<table>[\s\S]*?<\/table>|<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>|<blockquote>[\s\S]*?<\/blockquote>|<h[1-6]>.*?<\/h[1-6]>|<hr>)/g, m => {
    blocks.push(m);
    return '\x00B' + (blocks.length - 1) + '\x00';
  });
  // 段落与换行
  html = html.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  // 还原块级元素：将其从 <p> 内拆出（闭合上一段 → 块 → 重新开段）
  html = html.replace(/\x00B(\d+)\x00/g, (m, i) => '</p>' + (blocks[+i] || '') + '<p>');
  // 还原 <u> 下划线标签（内容做 HTML 转义）
  html = html.replace(/\x00U(\d+)\x00/g, (m, i) =>
    '<u>' + String(uls[+i] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</u>');
  return html;
}

/* ---- 提示小问笔记：预览开关（修复原页面未定义的 togglePreview） ---- */
function togglePreview(nk) {
  const ta = document.getElementById('note-' + nk);
  const pv = document.getElementById('mdp-' + nk);
  const btn = document.getElementById('mdt-prev-' + nk);
  if (!ta || !pv || !btn) return;
  const show = !pv.classList.contains('show');
  if (show) pv.innerHTML = renderMarkdown(ta.value);
  pv.classList.toggle('show', show);
  btn.classList.toggle('active', show);
  btn.setAttribute('aria-pressed', String(show));
}

/* ---- 笔记编辑/预览模式切换 ---- */
function switchNoteMode(nk, mode) {
  const ta = document.getElementById('note-' + nk);
  const pv = document.getElementById('mdp-' + nk);
  const te = document.getElementById('mdt-edit-' + nk);
  const tp = document.getElementById('mdt-prev-' + nk);
  if (!ta || !pv) return;
  if (mode === 'preview') {
    pv.innerHTML = renderMarkdown(notes[nk] || ta.value);
    pv.classList.add('show');
    ta.style.display = 'none';
    te.classList.remove('active');
    tp.classList.add('active');
  } else {
    pv.classList.remove('show');
    ta.style.display = '';
    autoResize(ta, true);
    te.classList.add('active');
    tp.classList.remove('active');
  }
}

const STATUS_ORDER = ['new', 'doing', 'done'];
const STATUS_LABEL = { new: '未练 New', doing: '练习中 Doing', done: '已掌握 Done' };
function cycleStatus(id, btn) {
  const cur = statuses[id] || 'new';
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(cur) + 1) % 3];
  statuses[id] = next;
  markDirty();
  const card = document.getElementById('q-' + id);
  card.className = 'qcard status-' + next;
  btn.className = 'status-btn active-' + next;
  btn.textContent = STATUS_LABEL[next];
  updateProgress();
  applyFilters();
}

function copyQuestion(id) {
  const bankKey = id.split('-')[0];
  const item = questionById(id);
  if (!item) return;
  const currentIds=activeCurrentIds();
  const inCurrent=currentIds.includes(id);
  const category=activeTrack==='fast-track'?'ELPA Fast Track':'常规 ELPA · Regular';
  const section=category+' · '+(inCurrent?activeLatestSessionLabel():'过往题库');
  const number=feedbackRanked(inCurrent?currentIds:activeArchivedIds()).indexOf(id)+1;
  let text = `【${section} · 第 ${number} 题】\n${item.en}\n`;
  const copyCn=questionTranslation(id.split('-')[0],item);
  if (copyCn) text += `（${copyCn}）\n`;
  const copyNote=questionSourceNote(bankKey,item);
  if (copyNote) text += `来源说明：${copyNote}\n`;
  const followups = questionFollowups(id,item);
  if (followups.length) {
    text += '\n提示小问：\n' + followups.map(s => '• ' + s.en + (s.cn ? '  (' + s.cn + ')' : '')).join('\n');
  }
  const doCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => flash(btnOf(id))).catch(() => fallbackCopy(text, id));
    } else {
      fallbackCopy(text, id);
    }
  };
  doCopy();
}
function fallbackCopy(text, id) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  flash(btnOf(id));
}
function btnOf(id) {
  const card = document.getElementById('q-' + id);
  return card ? card.querySelector('.copy-btn') : null;
}
function flash(btn) {
  if (!btn) return;
  const old = btn.textContent;
  btn.textContent = '✅ 已复制 Copied';
  setTimeout(() => btn.textContent = old, 1200);
}

function updateProgress() {
  let total = 0, done = 0, doing = 0, fresh = 0;
  for (const id of allPracticeIds()) {
    total++;
    const st = statuses[id] || 'new';
    if (st === 'done') done++;
    else if (st === 'doing') doing++;
    else fresh++;
  }
  const pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('totalCount').textContent = total;
  document.getElementById('doneCount').textContent = done;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressBar').setAttribute('aria-valuenow', String(pct));
  document.getElementById('progressPct').textContent = pct + '%';
  document.getElementById('progressDetail').textContent = '未练 ' + fresh + ' · 练习中 ' + doing;
}

/* ============ 组合筛选（关键词 + 练习状态） ============ */
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const sessionFilter=document.getElementById('sessionFilter');
function populateExamFilters(){
  const activeIds=activePracticeIds();
  const sessions=new Map();
  for(const id of activeIds)for(const entry of appearancesFor(id)){
    const stage=entry&&ELPA_TAXONOMY.examStages[entry.examStage];
    if(!entry||!entry.term||!stage)continue;
    sessions.set(entry.term+'|'+entry.examStage,{term:entry.term,stage:entry.examStage,label:entry.term+' · '+stage.zh});
  }
  const stageOrder={start:0,mid:1,end:2};
  const options=[...sessions.entries()].sort((a,b)=>{
    const [yearA,seasonA]=a[1].term.split(' '),[yearB,seasonB]=b[1].term.split(' ');
    return Number(yearB)-Number(yearA)||(seasonB==='Fall'?1:0)-(seasonA==='Fall'?1:0)||stageOrder[b[1].stage]-stageOrder[a[1].stage];
  });
  sessionFilter.replaceChildren(new Option('全部场次 / All sessions',''));
  for(const [value,session] of options)sessionFilter.append(new Option(session.label,value));
  const hasSessions=options.length>0;
  sessionFilter.disabled=!hasSessions;sessionFilter.hidden=!hasSessions;
  document.querySelector('label[for="sessionFilter"]').hidden=!hasSessions;
  sessionFilter.title=hasSessions?'按已收录考试场次筛选':'暂无已确认考试场次的投稿';
}
populateExamFilters();

/* Search and study-status filtering cover every question, regardless of pagination. */
const PAGE_SIZE=8;
const bankPages={past:1,fall:1};
function bankCards(kind){return [...document.querySelectorAll((kind==='past'?'#bankPast':'#bankD')+' .qcard')];}
function matchingCards(kind){return bankCards(kind).filter(card=>card.dataset.filterMatch==='1');}
function changeBankPage(kind,page){
  bankPages[kind]=page;applyFilters();
  document.getElementById(kind==='past'?'sec-bankA':'sec-bankD').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderPager(kind,total,pages){
  const el=document.getElementById(kind==='past'?'pagerPast':'pagerFall');
  const page=bankPages[kind];
  const titleStatus=document.getElementById(kind==='past'?'pastBankCount':'feedbackBankCount');
  el.hidden=total===0;
  titleStatus.textContent=total?'第 '+page+' / '+pages+' 页 · 总 '+total+' 题':'0 题';
  if(!total){el.innerHTML='';return;}
  const buttons=[{label:'上一页 Prev',page:page-1,disabled:page===1}];
  for(let n=1;n<=pages;n++)buttons.push({label:String(n),page:n,current:n===page});
  buttons.push({label:'下一页 Next',page:page+1,disabled:page===pages});
  el.innerHTML=buttons.map(b=>'<button type="button" data-page="'+b.page+'"'+(b.current?' aria-current="page"':'')+(b.disabled?' disabled':'')+'>'+b.label+'</button>').join('');
  el.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>changeBankPage(kind,Number(button.dataset.page))));
}
function applyFilters(reset=false){
  if(reset){bankPages.past=1;bankPages.fall=1;}
  const kw=searchInput.value.trim().toLowerCase(),filter=statusFilter.value;
  const [selectedTerm='',selectedStage='']=sessionFilter.value.split('|');
  renderTOC();
  document.getElementById('searchClear').classList.toggle('show',!!searchInput.value);
  let total=0;
  for(const kind of ['past','fall']){
    const cards=bankCards(kind);
    const matches=cards.filter(card=>{
      const state=statuses[card.id.slice(2)]||'new';
      const id=card.id.slice(2);
      const records=appearancesFor(id);
      const termOK=!selectedTerm||elpaReportedTerms(id).includes(selectedTerm);
      const stageOK=!selectedStage||records.some(r=>r&&r.examStage===selectedStage&&(!selectedTerm||r.term===selectedTerm));
      const sessionOK=termOK&&stageOK;
      const yes=(!kw||card.dataset.search.includes(kw))&&(filter==='all'||state===filter)&&sessionOK;
      card.dataset.filterMatch=yes?'1':'0';return yes;
    });
    const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));
    bankPages[kind]=Math.max(1,Math.min(bankPages[kind],pages));
    const first=(bankPages[kind]-1)*PAGE_SIZE;
    const shown=new Set(matches.slice(first,first+PAGE_SIZE));
    cards.forEach(card=>{card.style.display=shown.has(card)?'':'none';});
    total+=matches.length;renderPager(kind,matches.length,pages);
  }
  document.getElementById('matchCount').textContent=String(total);
  document.getElementById('emptyState').style.display=total||!allPracticeIds().length?'none':'block';
  document.getElementById('emptyKeyword').textContent=kw||statusFilter.options[statusFilter.selectedIndex].text;
}
searchInput.addEventListener('input',()=>applyFilters(true));
statusFilter.addEventListener('change',()=>applyFilters(true));
sessionFilter.addEventListener('change',()=>applyFilters(true));

/* Live filtering remains unchanged; an explicit search moves to results. */
const searchForm=document.getElementById('searchForm');
const searchFeedback=document.getElementById('searchFeedback');
function clearSearchHighlight(){
  document.querySelectorAll('.qcard.search-target').forEach(card=>card.classList.remove('search-target'));
}
searchInput.addEventListener('input',()=>{
  searchFeedback.hidden=true;
  clearSearchHighlight();
});
searchForm.addEventListener('submit',event=>{
  event.preventDefault();
  const keyword=searchInput.value.trim();
  if(!keyword){
    searchFeedback.textContent='输入关键词后即可搜索。';
    searchFeedback.hidden=false;
    searchInput.focus();
    return;
  }
  applyFilters(true);
  clearSearchHighlight();
  const total=Number(document.getElementById('matchCount').textContent)||0;
  if(!total){
    searchFeedback.textContent='未找到匹配“'+keyword+'”的题目，请尝试其他关键词。';
    searchFeedback.hidden=false;
    searchInput.blur();
    searchFeedback.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  searchFeedback.textContent='找到 '+total+' 道匹配题目，已定位至第一条。';
  searchFeedback.hidden=false;
  const first=matchingCards('fall')[0]||matchingCards('past')[0];
  if(!first)return;
  first.classList.add('search-target');
  first.setAttribute('tabindex','-1');
  searchInput.blur();
  requestAnimationFrame(()=>{
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    first.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
    first.focus({preventScroll:true});
  });
});


/* ============ 快捷键：文本编辑 + 保存 + 帮助 ============ */
function toggleHelp() {
  document.getElementById('helpMask').classList.toggle('show');
}
function closeHelp() {
  document.getElementById('helpMask').classList.remove('show');
}
document.getElementById('helpBtn').addEventListener('click', toggleHelp);

/* ---- textarea 行/选区操作工具 ---- */
function getLineInfo(ta) {
  const val = ta.value;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const before = val.slice(0, start), after = val.slice(end);
  const lineStart = before.lastIndexOf('\n') + 1;
  let lineEnd = after.indexOf('\n');
  if (lineEnd === -1) lineEnd = val.length; else lineEnd = end + lineEnd;
  return { val, start, end, lineStart, lineEnd };
}
function fireInput(ta) { ta.dispatchEvent(new Event('input', { bubbles: true })); }

/* ---- 通过 execCommand 提交编辑（可被 Ctrl+Z 撤销） ---- */
function commitEdit(ta, from, to, newText, caret) {
  if (!ta) return;
  ta.focus();
  ta.setSelectionRange(from, to);
  try {
    document.execCommand('insertText', false, newText);
  } catch (e) {
    ta.value = ta.value.slice(0, from) + newText + ta.value.slice(to);
  }
  if (caret) ta.setSelectionRange(caret[0], caret[1]);
  fireInput(ta);
}

function applyIndent(ta, shift) {
  const { val, start, end, lineStart } = getLineInfo(ta);
  const selected = val.slice(start, end);
  if (selected.includes('\n')) {
    const lines = selected.split('\n');
    const newSel = shift
      ? lines.map(l => l.startsWith('  ') ? l.slice(2) : l.startsWith('\t') ? l.slice(1) : l).join('\n')
      : lines.map(l => '  ' + l).join('\n');
    commitEdit(ta, start, end, newSel, [start, start + newSel.length]);
  } else if (shift) {
    let n = 0;
    while (n < 2 && (val[lineStart + n] === ' ' || val[lineStart + n] === '\t')) n++;
    commitEdit(ta, lineStart, lineStart + n, '', [Math.max(start - n, lineStart), Math.max(end - n, lineStart)]);
  } else {
    commitEdit(ta, lineStart, lineStart, '  ', [start + 2, end + 2]);
  }
}
function wrapSelection(ta, before, after) {
  const { val, start, end } = getLineInfo(ta);
  const sel = val.slice(start, end) || 'text';
  commitEdit(ta, start, end, before + sel + after, [start + before.length, start + before.length + sel.length]);
}
function deleteLine(ta) {
  const { val, lineStart, lineEnd } = getLineInfo(ta);
  let start = lineStart, end = lineEnd;
  if (val[lineEnd] === '\n') end = lineEnd + 1;      // 普通行：连行尾换行一起删
  else if (lineStart > 0) start = lineStart - 1;      // 最后一行无换行：删掉前一行的换行
  commitEdit(ta, start, end, '', [start, start]);
}
function moveLine(ta, dir) {
  const { val, start, end } = getLineInfo(ta);
  const selLen = end - start;
  const lines = val.split('\n');
  const lineNo = val.slice(0, start).split('\n').length - 1;
  const target = lineNo + dir;
  if (target < 0 || target >= lines.length) return;
  const a = Math.min(lineNo, target), b = Math.max(lineNo, target);
  const lineStarts = [];
  let pos = 0;
  for (let i = 0; i < lines.length; i++) { lineStarts.push(pos); pos += lines[i].length + 1; }
  const spanStart = lineStarts[a];
  const spanEnd = (b < lines.length - 1) ? lineStarts[b] + lines[b].length : val.length;
  const spanText = val.slice(spanStart, spanEnd);
  const spanLines = spanText.split('\n');
  const within = lineNo - a;
  const [l] = spanLines.splice(within, 1);
  spanLines.splice(within + dir, 0, l);
  const newText = spanLines.join('\n');
  const lineOff = start - val.slice(0, start).lastIndexOf('\n') - 1;
  const tIdx = within + dir;
  const caretStart = spanStart + spanLines.slice(0, tIdx).join('\n').length + (tIdx > 0 ? 1 : 0) + Math.min(lineOff, lines[target].length);
  commitEdit(ta, spanStart, spanEnd, newText, [caretStart, caretStart + selLen]);
}

/* ---- 全局 + 笔记框快捷键 ---- */
document.addEventListener('keydown', e => {
  const isTa = e.target && e.target.tagName === 'TEXTAREA';
  const mod = e.ctrlKey || e.metaKey;
  // Ctrl+S：保存（全局生效）
  if (mod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    handleSave();
    return;
  }
  if (mod && !e.shiftKey && !e.altKey && e.key === '/') {
    e.preventDefault();
    toggleHelp();
    return;
  }
  // '?'：显示帮助（输入框外）
  if (e.key === '?' && !e.ctrlKey && !e.altKey && !isTa && !(e.target && e.target.tagName === 'INPUT')) {
    toggleHelp();
    return;
  }
  if (!isTa) return; // 以下快捷键仅在笔记框内生效
  if (e.key === 'Tab') { e.preventDefault(); applyIndent(e.target, e.shiftKey); return; }
  if (mod && !e.shiftKey && !e.altKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); wrapSelection(e.target, '**', '**'); return; }
  if (mod && !e.shiftKey && !e.altKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); wrapSelection(e.target, '*', '*'); return; }
  if (mod && !e.shiftKey && !e.altKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); wrapSelection(e.target, '<u>', '</u>'); return; }
  if (mod && !e.shiftKey && !e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); deleteLine(e.target); return; }
  if (mod && e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); deleteLine(e.target); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); handleSave(); return; }
  if (e.altKey && !mod && e.key === 'ArrowUp') { e.preventDefault(); moveLine(e.target, -1); return; }
  if (e.altKey && !mod && e.key === 'ArrowDown') { e.preventDefault(); moveLine(e.target, 1); return; }
});

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

/* Existing backup and export handlers are accessed from a single menu. */
const recordsButton=document.getElementById('recordsMenuBtn');
const recordsPanel=document.getElementById('recordsMenu');
recordsButton.addEventListener('click',()=>{
  const show=recordsPanel.hidden;
  recordsPanel.hidden=!show;
  recordsButton.setAttribute('aria-expanded',String(show));
});
document.getElementById('recordsBackupBtn').addEventListener('click',()=>document.getElementById('backupBtn').click());
document.getElementById('recordsRestoreBtn').addEventListener('click',()=>document.getElementById('restoreBtn').click());
document.getElementById('recordsExportBtn').addEventListener('click',()=>document.getElementById('exportBtn').click());
document.addEventListener('click',e=>{
  if(!e.target.closest('.records-menu')){
    recordsPanel.hidden=true;
    recordsButton.setAttribute('aria-expanded','false');
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){recordsPanel.hidden=true;recordsButton.setAttribute('aria-expanded','false');}
});
/* ============ 导出全部笔记（Markdown 下载） ============ */
document.getElementById('exportBtn').addEventListener('click', () => {
  let md = '# ELPA 备考笔记导出\n\n> 导出时间：' + new Date().toLocaleString('zh-CN') + '\n\n';
  const category=(activeCampus==='nansha'?'GZ':'HK')+' · '+
    (activeTrack==='fast-track'?'ELPA Fast Track':'常规 ELPA · Regular');
  const sections=[
    {name:category+' · '+activeLatestSessionLabel(),ids:activeCurrentIds()},
    {name:category+' · 过往题库',ids:activeArchivedIds()}
  ];
  for (const section of sections) {
    md += '\n## ' + section.name + '\n\n';
    for (const [i, id] of section.ids.entries()) {
      const it = questionById(id);
      const st = statuses[id] || 'new';
      const stLabel = { new: '未练 New', doing: '练习中 Doing', done: '已掌握 Done' }[st];
      md += '### ' + (i + 1) + '. ' + it.en + '\n';
      const cn=questionTranslation(id.split('-')[0],it);
      const historicalNote=questionSourceNote(id.split('-')[0],it);
      if (cn) md += '> ' + cn + '\n';
      if (historicalNote) md += '> 来源说明：' + historicalNote + '\n';
      md += '*状态：' + stLabel + '*\n\n';
      const qn = notes['qn-' + id];
      if (qn && qn.trim()) md += '**大问题笔记：**\n\n' + qn.trim() + '\n\n';
      const followups = questionFollowups(id,it);
      if (followups.length) {
        md += '**提示小问：**\n\n';
        followups.forEach((s, si) => {
          const n = notes[id + '-' + si];
          md += '- ' + s.en + (s.cn ? '（' + s.cn + '）' : '');
          if (n && n.trim()) md += '\n  > 笔记：' + n.trim().replace(/\n/g, '\n  > ');
          md += '\n';
        });
        md += '\n';
      }
    }
  }
  const blob = new Blob(['\ufeff' + md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ELPA备考笔记_' + new Date().toISOString().slice(0, 10) + '.md';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  setTip('📤 已导出全部题目与笔记为 Markdown 文件', 'ok');
});

/* ============ 搜索：清空 + 计数 ============ */
const searchClear = document.getElementById('searchClear');
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.focus();
});

/* ============ 回到顶部 ============ */
const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => {
  toTop.classList.toggle('show', window.scrollY > 400);
});
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ============ 渲染（读取数据后统一执行） ============ */
function renderAll() {
  if (migrateLegacyPractice()) markDirty();
  const currentIds=activeCurrentIds(),archivedIds=activeArchivedIds();
  document.getElementById('bankD').innerHTML=currentIds.length?renderQuestionIds(currentIds):'';
  document.getElementById('bankPast').innerHTML=renderQuestionIds(archivedIds);
  renderTOC();updateProgress();applyFilters();
}
function setExamChoice(axis,value){
  if(axis==='campus')activeCampus=value;
  else activeTrack=value;
  document.querySelectorAll('[data-campus]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.campus===activeCampus)));
  document.querySelectorAll('[data-track]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.track===activeTrack)));
  sessionFilter.value='';statusFilter.value='all';searchInput.value='';
  bankPages.past=1;bankPages.fall=1;searchFeedback.hidden=true;
  renderAll();populateExamFilters();
  const params=new URLSearchParams(location.search);
  params.set('campus',activeCampus);params.set('track',activeTrack);
  const hash=location.hash;
  history.replaceState(null,'',location.pathname+'?'+params.toString()+hash);
}
document.querySelectorAll('[data-campus]').forEach(b=>b.addEventListener('click',()=>setExamChoice('campus',b.dataset.campus)));
document.querySelectorAll('[data-track]').forEach(b=>b.addEventListener('click',()=>setExamChoice('track',b.dataset.track)));

/* ============ 初始化：先读取同目录 JSON，再渲染 ============ */
(async function init() {
  const route=new URLSearchParams(location.search);
  if(['nansha','clear-water-bay'].includes(route.get('campus')))activeCampus=route.get('campus');
  if(['regular','fast-track'].includes(route.get('track')))activeTrack=route.get('track');
  document.querySelectorAll('[data-campus]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.campus===activeCampus)));
  document.querySelectorAll('[data-track]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.track===activeTrack)));
  renderTOC();
  await initStorage();
  populateExamFilters();
  renderAll();
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }));
  }
})();
