'use strict';
// Compatibility contracts that must survive architectural consolidation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('historical question identities and aliases remain resolvable', () => {
  const data = vm.runInNewContext(
    read('question-bank/questions.js') + '\n' +
    ';({BANKS, PAST_QUESTION_IDS, LEGACY_QUESTION_ALIASES})',
    {}, { timeout: 1000 }
  );
  const ids = new Set(Object.entries(data.BANKS).flatMap(([bank, group]) =>
    group.items.map(item => bank + '-' + item.num)));
  for (const id of data.PAST_QUESTION_IDS) assert.ok(ids.has(id), 'Historical question missing: ' + id);
  for (const [oldId, currentId] of Object.entries(data.LEGACY_QUESTION_ALIASES)) {
    assert.ok(ids.has(oldId), 'Missing original question: ' + oldId);
    assert.ok(ids.has(currentId), 'Missing canonical question: ' + currentId);
  }
  for (const id of ['A-附', 'B-9', 'C-18', 'D-5', 'F-5']) {
    assert.ok(ids.has(id), 'Compatibility identity missing: ' + id);
  }
});

test('existing practice record and submission draft storage contracts stay readable', () => {
  const practice = read('assets/js/practice-storage.js');
  for (const key of ['elpa-q-status-v1', 'elpa-notes-v1', 'elpa-data-snapshot-v2',
    'elpa-autosave', 'elpa-fs-db', 'data-dir']) {
    assert.ok(practice.includes(key), 'Missing stored compatibility identifier: ' + key);
  }
  assert.match(practice, /version:\s*1,\s*updatedAt:/);
  assert.match(practice, /\bnormalizePayload\s*\(/);
  assert.match(read('assets/js/submit.js'), /elpa-submission-draft-v1:/);
});

test('published routes and owner-approved Issue publication remain available', () => {
  for (const page of ['index', 'guide', 'practice', 'submit', 'sources'])
    assert.ok(fs.existsSync(path.join(root, page + '.html')), 'Missing public route: ' + page);
  const worker = read('worker/src/index.js');
  assert.match(worker, /elpa-submission-v2:/);
  assert.match(worker, /elpa-submission-v1:/);
  const workflow = read('.github/workflows/publish-completed-submission.yml');
  assert.match(workflow, /state_reason == 'completed'/);
  assert.match(workflow, /github\.event\.sender\.login == 'FuTseYi'/);
});

test('practice session remains a separate, loaded module', () => {
  const html=read('practice.html');
  assert.match(html, /<script src="\.\/js\/practice\.js"><\/script>[\s\S]*?<script src="\.\/js\/practice-session\.js"><\/script>/);
  const session=read('assets/js/practice-session.js');
  assert.match(session, /function tickTimer\(/);
  assert.match(session, /function drawPractice\(/);
  assert.ok(!read('assets/js/practice.js').includes('function tickTimer('));
});

test('browser record storage is independently loaded before practice UI', () => {
  const html=read('practice.html');
  const store=html.indexOf('<script src="./assets/js/practice-storage.js"></script>');
  const ui=html.indexOf('<script src="./assets/js/practice.js"></script>');
  assert.ok(store>=0&&ui>store,'storage module must initialize before practice UI');
  assert.ok(!read('assets/js/practice.js').includes("const LS_SNAPSHOT"));
});

test('synthetic browser-verification questions are not published as actual exam practice',()=>{
  const bank=read('question-bank/questions.js');
  const docs=read('question-bank/community-submissions.md');
  assert.doesNotMatch(bank,/TEST ONLY - HKUST-ELPA browser submission verification/);
  assert.doesNotMatch(docs,/Issue #13(?:\D|$)/);
});
