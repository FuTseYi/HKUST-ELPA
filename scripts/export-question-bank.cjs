#!/usr/bin/env node
'use strict';

/*
 * One-time migration aid. The existing trusted JavaScript bank remains the
 * sole authoritative source until the importer and browser are migrated.
 * Write JSON snapshots outside the repository and compare them before cutover.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const BANK = path.join(ROOT, 'question-bank');

function readTrustedData(file, expression) {
  const source = fs.readFileSync(path.join(BANK, file), 'utf8');
  // Never evaluate Issue input; only repository-owned JavaScript sources.
  const value = vm.runInNewContext(source + '\n;(' + expression + ')', {}, {timeout: 1000});
  return JSON.parse(JSON.stringify(value));
}

function exportData() {
  const questions = readTrustedData('questions.js',
    '({banks:BANKS,pastQuestionIds:PAST_QUESTION_IDS,legacyQuestionAliases:LEGACY_QUESTION_ALIASES})');
  const appearances = readTrustedData('appearances.js', 'ELPA_APPEARANCES');
  const advice = readTrustedData('advice.js', 'ELPA_ADVICE');
  const taxonomy = readTrustedData('taxonomy.js', 'ELPA_TAXONOMY');

  if (!questions.banks || !Array.isArray(questions.pastQuestionIds) ||
      !questions.legacyQuestionAliases || !appearances || !Array.isArray(advice) ||
      !taxonomy) throw Error('Incomplete question-bank export');

  const ids = new Set(Object.entries(questions.banks).flatMap(([bank, data]) =>
    data.items.map(item => bank + '-' + item.num)));
  if (ids.size !== Object.values(questions.banks).reduce((sum, bank) => sum + bank.items.length, 0))
    throw Error('Duplicate question IDs');
  for (const id of questions.pastQuestionIds)
    if (!ids.has(id)) throw Error('Missing historical question: ' + id);
  for (const [id, canonical] of Object.entries(questions.legacyQuestionAliases))
    if (!ids.has(id) || !ids.has(canonical)) throw Error('Broken question alias: ' + id);
  for (const id of Object.keys(appearances))
    if (!ids.has(id)) throw Error('Appearance references missing question: ' + id);
  return {'questions.json': questions, 'appearances.json': appearances,
    'advice.json': advice, 'taxonomy.json': taxonomy};
}

function writeExport(destination) {
  if (fs.existsSync(destination) && fs.readdirSync(destination).length)
    throw Error('Destination must be empty; refusing to overwrite migration data');
  const data = exportData();
  fs.mkdirSync(destination, {recursive: true});
  for (const [filename, value] of Object.entries(data))
    fs.writeFileSync(path.join(destination, filename), JSON.stringify(value, null, 2) + '\n');
  return data;
}

if (require.main === module) {
  if (process.argv.length !== 4 || process.argv[2] !== '--output')
    throw Error('Usage: node scripts/export-question-bank.cjs --output <empty-directory>');
  writeExport(path.resolve(process.argv[3]));
}
module.exports = {exportData, writeExport};
