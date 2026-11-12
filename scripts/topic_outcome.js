// Outcome of tutor sessions by topic (LLM topic labels from topics.json) + chi-square tests.
// Usage: node topic_outcome.js "<path to ai_tutor.csv>"
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const raw = fs.readFileSync(process.argv[2], 'utf8');
function parseCSV(s) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.length > 1);
}
// regularized upper incomplete gamma -> chi-square survival function
function gammaln(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function gammq(a, x) {
  if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return 1 - sum * Math.exp(-x + a * Math.log(x) - gammaln(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
  return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}
function chi2test(tab) { // tab: rows of counts
  const R = tab.map(r => r.reduce((a, b) => a + b, 0)), C = tab[0].map((_, j) => tab.reduce((a, r) => a + r[j], 0)), N = R.reduce((a, b) => a + b, 0);
  let x = 0, minE = Infinity; tab.forEach((r, i) => r.forEach((o, j) => { const e = R[i] * C[j] / N; minE = Math.min(minE, e); x += (o - e) ** 2 / e; }));
  const df = (tab.length - 1) * (tab[0].length - 1);
  return { chi2: +x.toFixed(2), df, p: +gammq(df / 2, x / 2).toExponential(2), V: +Math.sqrt(x / (N * (Math.min(tab.length, tab[0].length) - 1))).toFixed(3), minExpected: +minE.toFixed(1), N };
}
const probs = JSON.parse(fs.readFileSync(path.join(DIR, 'problems.json'), 'utf8'));
const topics = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, 'topics.json'), 'utf8')).items.map(x => [x.id, x.topic]));
const topicOf = Object.fromEntries(probs.map(p => [p.text, topics[p.id]]));
const rows = parseCSV(raw).map(r => {
  const d = JSON.parse(r[11]); const full = d.some(m => m.kind === 'FULL_SOLUTION');
  return { session: r[1], topic: topicOf[r[2]], outcome: r[3] === 'ACTIVE' ? 'abandoned' : (full ? 'full_solution' : 'solved'), nStudent: d.filter(m => m.who === 'STUDENT').length };
});
const MAIN = ['Комбинаторика, вероятность и статистика', 'Текстовые задачи (движение, работа, смеси, пропорции)', 'Арифметика, дроби и проценты', 'Планиметрия', 'Стереометрия'];
const grp = t => (MAIN.includes(t) ? t : 'Другие разделы');
const G = [...MAIN, 'Другие разделы'];
const res = {};
for (const g of G) {
  const rs = rows.filter(r => grp(r.topic) === g);
  const c = o => rs.filter(r => r.outcome === o).length;
  const ended = c('solved') + c('full_solution');
  res[g] = { sessions: rs.length, solved: c('solved'), full: c('full_solution'), abandoned: c('abandoned'), endedPct: +(100 * ended / rs.length).toFixed(1), solvedPct: +(100 * c('solved') / rs.length).toFixed(1), fullShareOfEnded: +(100 * c('full_solution') / ended).toFixed(1), noMsgAbandoned: rs.filter(r => r.outcome === 'abandoned' && r.nStudent === 0).length };
}
const completion = chi2test(G.map(g => [res[g].solved + res[g].full, res[g].abandoned]));
const endedSplit = chi2test(G.map(g => [res[g].solved, res[g].full]));
// substantive errors by topic
const key = JSON.parse(fs.readFileSync(path.join(DIR, 'eval', 'sample_key.json'), 'utf8'));
const fin = JSON.parse(fs.readFileSync(path.join(DIR, 'eval_final.json'), 'utf8'));
const bySession = Object.fromEntries(rows.map(r => [r.session, r]));
const errs = fin.filter(x => x.math_correct === 0).map(x => { const k = key.find(k => k.code === x.code); return { code: x.code, topic: bySession[k.session].topic }; });
const sampleTopics = {}; for (const k of key) { const t = grp(bySession[k.session].topic); sampleTopics[t] = (sampleTopics[t] || 0) + 1; }
const out = { byTopic: res, completion, endedSplit, errors: errs, sampleTopics };
fs.writeFileSync(path.join(DIR, 'topic_stats.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
