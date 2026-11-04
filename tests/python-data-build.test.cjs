'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {writeExport, exportData} = require('../scripts/export-question-bank.cjs');
const root = path.resolve(__dirname, '..');
const py = process.platform === 'win32' ? 'python' : 'python3';

function build(input, output) {
  return spawnSync(py, [path.join(root, 'scripts/build-question-data.py'),
    '--input', input, '--output', output], {encoding:'utf8'});
}

test('Python JSON build preserves all current question records and historical identities', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elpa-data-build-'));
  try {
    const source = path.join(dir, 'source');
    const output = path.join(dir, 'output');
    const expected = writeExport(source);
    const result = build(source, output);
    assert.equal(result.status, 0, result.stderr);
    const question = vm.runInNewContext(
      fs.readFileSync(path.join(output, 'questions.js'), 'utf8') +
      '\n;({banks:BANKS,pastQuestionIds:PAST_QUESTION_IDS,legacyQuestionAliases:LEGACY_QUESTION_ALIASES})');
    const appearances = vm.runInNewContext(
      fs.readFileSync(path.join(output, 'appearances.js'), 'utf8') +
      '\n;ELPA_APPEARANCES');
    const advice = vm.runInNewContext(
      fs.readFileSync(path.join(output, 'advice.js'), 'utf8') + '\n;ELPA_ADVICE');
    const taxonomy = vm.runInNewContext(
      fs.readFileSync(path.join(output, 'taxonomy.js'), 'utf8') + '\n;ELPA_TAXONOMY');
    const plain = value => JSON.parse(JSON.stringify(value));
    assert.deepEqual(plain(question), expected['questions.json']);
    assert.deepEqual(plain(appearances), expected['appearances.json']);
    assert.deepEqual(plain(advice), expected['advice.json']);
    assert.deepEqual(plain(taxonomy), expected['taxonomy.json']);
    assert.deepEqual(Object.keys(exportData()), Object.keys(expected));
    assert.deepEqual(fs.readdirSync(output).sort(),
      ['advice.js', 'appearances.js', 'questions.js', 'taxonomy.js']);
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
  }
});

test('Python builder rejects missing historical targets rather than emitting broken assets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elpa-invalid-data-'));
  try {
    const source = path.join(dir, 'source');
    const output = path.join(dir, 'output');
    writeExport(source);
    const file = path.join(source, 'questions.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.legacyQuestionAliases['A-附'] = 'C-999999';
    fs.writeFileSync(file, JSON.stringify(data));
    const result = build(source, output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /broken historical aliases/);
    assert.ok(!fs.existsSync(output), 'Invalid data must not create browser output');
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
  }
});
