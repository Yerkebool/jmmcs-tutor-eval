// Aggregates the rubric evaluation: final (adjudicated) scores, inter-rater agreement, stratum-weighted estimates.
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const wf = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const batches = wf.result;
const key = JSON.parse(fs.readFileSync(path.join(DIR, 'eval', 'sample_key.json'), 'utf8'));
const byCode = Object.fromEntries(key.map(k => [k.code, k]));
const A = [], B = [], FIN = [];
for (const b of batches) {
  if (!b.final) throw new Error('batch ' + b.batch + ' has no final');
  A.push(...b.A.items); B.push(...b.B.items); FIN.push(...b.final.items);
}
console.log('items A/B/final:', A.length, B.length, FIN.length);
const ord = ['math_correct', 'scaffolding', 'responsiveness', 'clarity'];
const cat = ['misjudged_student_answer', 'correct_final'];
const idx = a => Object.fromEntries(a.map(x => [x.code, x]));
const IA = idx(A), IB = idx(B), IF = idx(FIN);
const codes = key.map(k => k.code).filter(c => IF[c]);
// weighted kappa (linear weights) for 0..2; Cohen's kappa for categories
function kappaW(x, y, k = 3) {
  const n = x.length; const O = Array.from({ length: k }, () => Array(k).fill(0));
  x.forEach((v, i) => O[v][y[i]]++);
  const r = O.map(row => row.reduce((a, b) => a + b, 0)); const c = O[0].map((_, j) => O.reduce((a, row) => a + row[j], 0));
  let po = 0, pe = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const w = 1 - Math.abs(i - j) / (k - 1); po += w * O[i][j] / n; pe += w * (r[i] * c[j]) / (n * n); }
  return (po - pe) / (1 - pe);
}
function kappa(x, y) {
  const cats = [...new Set([...x, ...y])]; const n = x.length;
  const po = x.filter((v, i) => v === y[i]).length / n;
  const pe = cats.reduce((a, c) => a + (x.filter(v => v === c).length / n) * (y.filter(v => v === c).length / n), 0);
  return (po - pe) / (1 - pe);
}
const agree = {};
for (const f of ord) { const x = codes.map(c => IA[c][f]), y = codes.map(c => IB[c][f]); agree[f] = { exact: +(100 * x.filter((v, i) => v === y[i]).length / x.length).toFixed(1), kappaW: +kappaW(x, y).toFixed(2) }; }
for (const f of cat) { const x = codes.map(c => IA[c][f]), y = codes.map(c => IB[c][f]); agree[f] = { exact: +(100 * x.filter((v, i) => v === y[i]).length / x.length).toFixed(1), kappa: +kappa(x, y).toFixed(2) }; }
const adjudicated = codes.filter(c => (IF[c].notes || '').startsWith('ADJ')).length;
const anyDisagree = codes.filter(c => [...ord, ...cat].some(f => IA[c][f] !== IB[c][f])).length;
// final score distributions, overall and by stratum
const strata = ['solved_unrated', 'full_solution', 'rated_no_full', 'abandoned_engaged'];
const pop = Object.fromEntries(strata.map(s => [s, key.find(k => k.stratum === s).poolSize]));
const dist = (sel, f) => { const v = codes.filter(sel).map(c => IF[c][f]); return { n: v.length, d0: v.filter(x => x === 0).length, d1: v.filter(x => x === 1).length, d2: v.filter(x => x === 2).length, mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) }; };
const res = { overall: {}, byStratum: {}, weighted: {} };
for (const f of ord) {
  res.overall[f] = dist(() => true, f);
  res.byStratum[f] = Object.fromEntries(strata.map(s => [s, dist(c => byCode[c].stratum === s, f)]));
  // stratum-weighted share of score 2 and of score 0
  const W = strata.reduce((a, s) => a + pop[s], 0);
  const share = v => strata.reduce((a, s) => a + pop[s] / W * (res.byStratum[f][s][v] / res.byStratum[f][s].n), 0);
  res.weighted[f] = { share2: +(100 * share('d2')).toFixed(1), share0: +(100 * share('d0')).toFixed(1) };
}
for (const f of cat) {
  const tally = sel => codes.filter(sel).reduce((a, c) => (a[IF[c][f]] = (a[IF[c][f]] || 0) + 1, a), {});
  res.overall[f] = tally(() => true);
  res.byStratum[f] = Object.fromEntries(strata.map(s => [s, tally(c => byCode[c].stratum === s)]));
}
// data-quality notes flagged by raters
const notesAll = codes.map(c => `${c} [${byCode[c].stratum}] ${IF[c].error_note || ''} || ${IF[c].notes || ''}`);
const emptyFull = codes.filter(c => /пуст/i.test(IF[c].notes + IA[c].notes + IB[c].notes));
const exportIssue = codes.filter(c => /индекс|экспорт|разметк/i.test(IF[c].notes + IA[c].notes + IB[c].notes));
const out = { n: codes.length, populationSizes: pop, agreement: agree, anyDisagree, adjudicated, results: res, flaggedEmptyFullSolution: emptyFull, flaggedExportFormatting: exportIssue };
fs.writeFileSync(path.join(DIR, 'eval_stats.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(DIR, 'eval_final.json'), JSON.stringify(codes.map(c => ({ ...byCode[c], ...IF[c], raterA: IA[c], raterB: IB[c] })), null, 1));
fs.writeFileSync(path.join(DIR, 'eval_notes.txt'), notesAll.join('\n'));
console.log(JSON.stringify(out, null, 1));
