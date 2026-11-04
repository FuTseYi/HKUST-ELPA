'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {exportData} = require('../scripts/export-question-bank.cjs');

const ROOT = path.resolve(__dirname, '..');
const bank = file => fs.readFileSync(path.join(ROOT, 'question-bank', file), 'utf8');
const trusted = (file, expression) =>
  JSON.parse(JSON.stringify(vm.runInNewContext(bank(file) + '\n;(' + expression + ')', {},
    {timeout: 1000})));

test('migration export preserves every original question, ID, alias and order', () => {
  const data = exportData();
  const source = trusted('questions.js',
    '({banks:BANKS,pastQuestionIds:PAST_QUESTION_IDS,legacyQuestionAliases:LEGACY_QUESTION_ALIASES})');
  assert.deepEqual(data['questions.json'], source);
  for (const id of ['A-附', 'B-9', 'C-18', 'D-5', 'F-5']) {
    const [bankKey, number] = id.split('-');
    assert.ok(source.banks[bankKey].items.some(item => String(item.num) === number), id);
  }
  assert.equal(source.legacyQuestionAliases['A-附'], 'C-16');
  assert.equal(source.legacyQuestionAliases['C-18'], 'A-3');
});

test('migration export preserves reviewed occurrences, advice and taxonomy', () => {
  const data = exportData();
  assert.deepEqual(data['appearances.json'], trusted('appearances.js', 'ELPA_APPEARANCES'));
  assert.deepEqual(data['advice.json'], trusted('advice.js', 'ELPA_ADVICE'));
  assert.deepEqual(data['taxonomy.json'], trusted('taxonomy.js', 'ELPA_TAXONOMY'));
  assert.equal(data['appearances.json']['D-5'][0].issueNumber, 57);
  assert.equal(data['appearances.json']['C-10'][0].issueNumber, 58);
});

test('export CLI creates four portable JSON files without modifying source', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'elpa-data-export-'));
  try {
    const output = path.join(temp, 'snapshot');
    const script = path.join(ROOT, 'scripts', 'export-question-bank.cjs');
    const before = ['questions.js', 'appearances.js', 'advice.js', 'taxonomy.js'].map(bank);
    const result = spawnSync(process.execPath, [script, '--output', output],
      {cwd: ROOT, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(output).sort(),
      ['advice.json', 'appearances.json', 'questions.json', 'taxonomy.json']);
    const data = exportData();
    for (const [name, expected] of Object.entries(data))
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, name), 'utf8')), expected);
    assert.deepEqual(['questions.js', 'appearances.js', 'advice.js', 'taxonomy.js'].map(bank), before);
    const repeated = spawnSync(process.execPath, [script, '--output', output],
      {cwd: ROOT, encoding: 'utf8'});
    assert.notEqual(repeated.status, 0, 'Must not silently overwrite a prior snapshot');
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
});
