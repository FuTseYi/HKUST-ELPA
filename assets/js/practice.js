/* ============ 应用逻辑 ============ */


/* 题目数据由 question-bank/questions.js 提供，见同目录的来源说明。 */

/* Campus distinguishes the source of a question, not the university-wide assessment category. */
let activeCampus='nansha',activeTrack='regular';
const examChoiceNote=document.getElementById('elpaChoiceNote');
function isNanshaRegular(){return activeCampus==='nansha'&&activeTrack==='regular';}
function activePracticeIds(){
  if(activeCampus==='nansha'&&activeTrack==='fast-track')return BANKS.F.items.map(it=>'F-'+it.num);
  if(activeCampus==='clear-water-bay')return (activeTrack==='regular'?BANKS.H:BANKS.T).items.map(it=>(activeTrack==='regular'?'H-':'T-')+it.num);
  return elpaAllPracticeIds();
}
/* Browser learning records, backups and optional folder sync live in practice-storage.js. */
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
  document.getElementById('sec-bankD').hidden=!count||(!!selectedValue&&!selectedIsCurrent);
  document.getElementById('sec-bankA').hidden=!count||(!!selectedValue&&selectedIsCurrent);
  document.getElementById('categoryEmpty').hidden=count>0;
  document.getElementById('categoryEmptyShare').href='./submit.html?campus='+activeCampus+'&track='+activeTrack;
  document.querySelector('.toolbar').hidden=!count;
  document.getElementById('toc').hidden=!count;
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
    const recallLabel=questionSourceNote(bankKey,item);
    const feedback=feedbackCount(id);
    const searchText = (item.en + ' ' + (item.cn||'') + ' ' + alternatives.map(s=>s.en+' '+(s.cn||'')).join(' ') + ' ' + subs.map(s => s.en + ' ' + (s.cn||'')).join(' ')).toLowerCase();
    return `
    <div class="qcard status-${st}" id="q-${id}" data-search="${escAttr(searchText)}">
      <div class="q-top">
        <div class="q-num">${idx + startIndex + 1}</div>
        <div class="q-title">
          <div class="en">${esc(item.en)}</div>
          ${recallLabel ? `<span class="recall-mark">${esc(recallLabel)}</span>` : ""}
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
  document.getElementById('timerDrill').disabled=total===0;
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
  if(e.key==='Escape'&&!recordsPanel.hidden){
    const focusInside=recordsPanel.contains(document.activeElement);
    recordsPanel.hidden=true;
    recordsButton.setAttribute('aria-expanded','false');
    if(focusInside)recordsButton.focus();
  }
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
    for (const [i, id] of feedbackRanked(section.ids).entries()) {
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
  setTip('📤 已导出当前类别的全部题目与笔记为 Markdown 文件（不受搜索和筛选影响）', 'ok');
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
(function init() {
  const route=new URLSearchParams(location.search);
  if(['nansha','clear-water-bay'].includes(route.get('campus')))activeCampus=route.get('campus');
  if(['regular','fast-track'].includes(route.get('track')))activeTrack=route.get('track');
  document.querySelectorAll('[data-campus]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.campus===activeCampus)));
  document.querySelectorAll('[data-track]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.track===activeTrack)));
  renderTOC();
  initStorage();
  populateExamFilters();
  renderAll();
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }));
  }
})();
