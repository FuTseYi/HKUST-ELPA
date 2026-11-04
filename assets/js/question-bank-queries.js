/* Shared question grouping and reported-term queries. IDs remain stable for browser notes. */
/* Display grouping is derived only from merged, reviewed question data.
 * The latest represented term is displayed first regardless of today's calendar.
 * Student progress stays keyed to the canonical question ID across terms.
 */
function elpaLatestTermForIds(ids) {
  const terms = new Set();
  for (const id of ids) {
    for (const term of elpaReportedTerms(id)) {
      if (/^20\d{2} (Spring|Fall)$/.test(term)) terms.add(term);
    }
  }
  return [...terms].sort((a,b) => {
    const [yearA,seasonA] = a.split(' ');
    const [yearB,seasonB] = b.split(' ');
    return Number(yearB)-Number(yearA) ||
      (seasonB === 'Fall' ? 1 : 0) - (seasonA === 'Fall' ? 1 : 0);
  })[0] || '';
}
function elpaLatestTerm() {
  return elpaLatestTermForIds(elpaAllPracticeIds());
}
function elpaAllPracticeIds() {
  return PAST_QUESTION_IDS.concat(BANKS.D.items.map(item => 'D-' + item.num));
}
function elpaReportedTerms(id) {
  const terms = new Set();
  const key=id.split('-')[0];
  const bank=BANKS[key];
  const item=bank&&Array.isArray(bank.items)?
    bank.items.find(entry=>key+'-'+entry.num===id):null;
  if(item&&item.term)terms.add(item.term);
  // Legacy D-series 2026 Fall reports predate explicit per-issue appearances.
  else if(key==='D'&&item&&Number.isInteger(item.num)&&item.num>=1&&item.num<=12)
    terms.add('2026 Fall');
  const records = typeof ELPA_APPEARANCES === 'undefined' ? [] : ELPA_APPEARANCES[id];
  if (Array.isArray(records)) {
    for (const entry of records) if (entry && entry.term) terms.add(entry.term);
  }
  return [...terms];
}
function elpaCurrentQuestionIds(term = elpaLatestTerm()) {
  return elpaAllPracticeIds().filter(id => elpaReportedTerms(id).includes(term));
}
function elpaArchivedQuestionIds(term = elpaLatestTerm()) {
  const current = new Set(elpaCurrentQuestionIds(term));
  return elpaAllPracticeIds().filter(id => !current.has(id));
}
