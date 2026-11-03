'use strict';
const DATA_FILE = 'elpa_data.json';
/* Local-first study records: old storage keys and JSON payloads remain compatible. */
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
