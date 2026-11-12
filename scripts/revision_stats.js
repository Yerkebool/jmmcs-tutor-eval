// Extra statistics requested in review: hint contrasts, CIs of stratum-weighted shares, Monte Carlo topic test,
// refusal outcomes, repeat openings, tutor reply language, model-reply latency, rater agreement on errors.
// Usage: node revision_stats.js "<path to ai_tutor.csv>"
const fs = require('fs'), path = require('path');
const DIR = __dirname;

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
function gammaln(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function gammq(a, x) {
  if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return 1 - sum * Math.exp(-x + a * Math.log(x) - gammaln(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
  return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}
function chi2(tab) {
  const R = tab.map(r => r.reduce((a, b) => a + b, 0)), C = tab[0].map((_, j) => tab.reduce((a, r) => a + r[j], 0)), N = R.reduce((a, b) => a + b, 0);
  let x = 0; tab.forEach((r, i) => r.forEach((o, j) => { const e = R[i] * C[j] / N; x += (o - e) ** 2 / e; }));
  const df = (tab.length - 1) * (tab[0].length - 1);
  return { chi2: +x.toFixed(2), df, p: +gammq(df / 2, x / 2).toPrecision(3) };
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const secs = t => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
const quant = (xs, p) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const wilson = (k, n, z = 1.96) => { const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [+(100 * (c - h)).toFixed(1), +(100 * (c + h)).toFixed(1)]; };
const KZ = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/;

const rows = parseCSV(fs.readFileSync(process.argv[2], 'utf8')).map(r => {
  const d = JSON.parse(r[11]);
  return { user: r[0], session: r[1], problem: r[2], status: r[3], hint: +r[4], dialog: d, outcome: r[3] === 'ACTIVE' ? 'abandoned' : (d.some(m => m.kind === 'FULL_SOLUTION') ? 'full' : 'solved') };
});
const out = {};

// 1) hint contrasts among ended sessions
const ended = rows.filter(r => r.outcome !== 'abandoned');
const cnt = f => ended.filter(f).length;
const lo = [cnt(r => r.hint <= 1 && r.outcome === 'solved'), cnt(r => r.hint <= 1 && r.outcome === 'full')];
const hi = [cnt(r => r.hint >= 2 && r.outcome === 'solved'), cnt(r => r.hint >= 2 && r.outcome === 'full')];
const l2 = [cnt(r => r.hint === 2 && r.outcome === 'solved'), cnt(r => r.hint === 2 && r.outcome === 'full')];
const l3 = [cnt(r => r.hint === 3 && r.outcome === 'solved'), cnt(r => r.hint === 3 && r.outcome === 'full')];
out.hint = { level0ended: cnt(r => r.hint === 0), low01: lo, high23: hi, fullShareLow: +(100 * lo[1] / (lo[0] + lo[1])).toFixed(1), fullShareHigh: +(100 * hi[1] / (hi[0] + hi[1])).toFixed(1), lowVsHigh: chi2([lo, hi]), level2vs3: chi2([l2, l3]), solvedAtLevel3: l3[0], solvedAtLevel23: l2[0] + l3[0] };

// 2) Monte Carlo permutation test: topic x (solved, full) among ended sessions
const probs = JSON.parse(fs.readFileSync(path.join(DIR, 'problems.json'), 'utf8'));
const topics = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, 'topics.json'), 'utf8')).items.map(x => [x.id, x.topic]));
const topicOf = Object.fromEntries(probs.map(p => [p.text, topics[p.id]]));
const MAIN = ['Комбинаторика, вероятность и статистика', 'Текстовые задачи (движение, работа, смеси, пропорции)', 'Арифметика, дроби и проценты', 'Планиметрия', 'Стереометрия'];
const grp = r => { const t = topicOf[r.problem]; return MAIN.includes(t) ? MAIN.indexOf(t) : 5; };
const table = labels => { const t = Array.from({ length: 6 }, () => [0, 0]); ended.forEach((r, i) => t[grp(r)][labels[i]]++); return t; };
const obsLab = ended.map(r => (r.outcome === 'full' ? 1 : 0));
const x0 = chi2(table(obsLab)).chi2; const rnd = mulberry32(20260927); let ge = 0; const B = 20000;
for (let b = 0; b < B; b++) { const lab = [...obsLab]; for (let i = lab.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lab[i], lab[j]] = [lab[j], lab[i]]; } if (chi2(table(lab)).chi2 >= x0 - 1e-9) ge++; }
out.topicFullShareMonteCarlo = { chi2: x0, p: +((ge + 1) / (B + 1)).toFixed(3), B };

// 3) refusal templates and outcomes; repeat openings of the same problem by the same student
const isRefusal = m => m.kind === 'TEMPLATE' && /Дайын жауап/.test(m.ai || '');
const refusalSessions = rows.filter(r => r.dialog.some(isRefusal));
out.refusal = { sessions: refusalSessions.length, templates: rows.reduce((a, r) => a + r.dialog.filter(isRefusal).length, 0), outcomes: refusalSessions.reduce((a, r) => (a[r.outcome] = (a[r.outcome] || 0) + 1, a), {}) };
const pairs = {}; rows.forEach(r => { const k = r.user + '|' + r.problem; (pairs[k] = pairs[k] || []).push(r); });
const multi = Object.values(pairs).filter(v => v.length > 1);
const perProblem = rows.reduce((a, r) => (a[r.problem] = (a[r.problem] || 0) + 1, a), {});
out.repeat = { pairs: Object.keys(pairs).length, pairsWithRepeats: multi.length, sessionsInRepeatedPairs: multi.reduce((a, v) => a + v.length, 0), pairsAbandonedAndEnded: multi.filter(v => v.some(r => r.outcome === 'abandoned') && v.some(r => r.outcome !== 'abandoned')).length, maxSessionsPerProblem: Math.max(...Object.values(perProblem)) };

// 4) language of model-generated tutor replies; latency of model-generated replies only
const model = rows.flatMap(r => r.dialog.filter(m => m.who === 'ASSISTANT' && m.kind === 'MODEL').map(m => m.ai || ''));
out.tutorLanguage = { modelReplies: model.length, withKazakhLetters: model.filter(t => KZ.test(t)).length, pctKazakh: +(100 * model.filter(t => KZ.test(t)).length / model.length).toFixed(1) };
const lat = [];
rows.forEach(r => {
  const ts = r.dialog.map(m => secs(m.at));
  for (let i = 1; i < ts.length; i++) if (ts[i] < ts[i - 1]) for (let j = i; j < ts.length; j++) ts[j] += 86400;
  for (let i = 1; i < r.dialog.length; i++) if (r.dialog[i - 1].who === 'STUDENT' && r.dialog[i].who === 'ASSISTANT' && r.dialog[i].kind === 'MODEL') lat.push(ts[i] - ts[i - 1]);
});
out.modelLatency = { n: lat.length, median: quant(lat, 0.5), p90: quant(lat, 0.9) };

// 5) evaluation: stratified estimates with finite-population correction
const F = JSON.parse(fs.readFileSync(path.join(DIR, 'eval_final.json'), 'utf8'));
const pop = { solved_unrated: 83, full_solution: 81, rated_no_full: 91, abandoned_engaged: 572 };
const Ntot = Object.values(pop).reduce((a, b) => a + b, 0);
function strat(pred) {
  let est = 0, v = 0;
  for (const [s, N] of Object.entries(pop)) {
    const xs = F.filter(x => x.stratum === s); const n = xs.length; const p = xs.filter(pred).length / n; const W = N / Ntot;
    est += W * p; v += W * W * (1 - n / N) * p * (1 - p) / (n - 1);
  }
  return { est: +(100 * est).toFixed(1), ci: [+(100 * Math.max(0, est - 1.96 * Math.sqrt(v))).toFixed(1), +(100 * Math.min(1, est + 1.96 * Math.sqrt(v))).toFixed(1)] };
}
out.weighted = { mathFlawless: strat(x => x.math_correct === 2), substantiveError: strat(x => x.math_correct === 0), scaffolding2: strat(x => x.scaffolding === 2), responsiveness2: strat(x => x.responsiveness === 2), clarity2: strat(x => x.clarity === 2) };
{ // misjudgement among dialogues in which the student gave an answer (ratio estimator over strata)
  let num = 0, den = 0; out.misjudgedByStratum = {};
  for (const [s, N] of Object.entries(pop)) { const xs = F.filter(x => x.stratum === s); const ans = xs.filter(x => x.misjudged_student_answer !== 'na'); const yes = ans.filter(x => x.misjudged_student_answer === 'yes'); num += N * yes.length / xs.length; den += N * ans.length / xs.length; out.misjudgedByStratum[s] = `${yes.length}/${ans.length}`; }
  out.misjudgedWeightedPct = +(100 * num / den).toFixed(1);
}
const answered = F.filter(x => x.misjudged_student_answer !== 'na');
out.misjudgedSample = { yes: answered.filter(x => x.misjudged_student_answer === 'yes').length, answered: answered.length, wilson: wilson(answered.filter(x => x.misjudged_student_answer === 'yes').length, answered.length) };
const fin = F.filter(x => x.correct_final !== 'na');
out.correctFinal = { yes: fin.filter(x => x.correct_final === 'yes').length, n: fin.length, byStratum: fin.reduce((a, x) => (a[x.stratum] = (a[x.stratum] || 0) + 1, a), {}), wilson: wilson(fin.filter(x => x.correct_final === 'yes').length, fin.length) };
const errs = F.filter(x => x.math_correct === 0);
out.errors = { k: errs.length, wilson: wilson(errs.length, 100), flaggedByBoth: errs.filter(x => x.raterA && x.raterB && x.raterA.math_correct === 0 && x.raterB.math_correct === 0).length, codes: errs.map(x => x.code + '(' + (x.raterA ? x.raterA.math_correct : '?') + '/' + (x.raterB ? x.raterB.math_correct : '?') + ')') };
out.misjudgedAgreement = { bothYes: F.filter(x => x.misjudged_student_answer === 'yes' && x.raterA && x.raterB && x.raterA.misjudged_student_answer === 'yes' && x.raterB.misjudged_student_answer === 'yes').length, oneRaterOnly: F.filter(x => x.raterA && x.raterB && ((x.raterA.misjudged_student_answer === 'yes') !== (x.raterB.misjudged_student_answer === 'yes'))).map(x => x.code + ':final=' + x.misjudged_student_answer) };
out.scaffolding0 = F.filter(x => x.scaffolding === 0).length;
out.fullSolutionAfterNStudentMsgs = rows.filter(r => r.dialog.some(m => m.kind === 'FULL_SOLUTION')).map(r => r.dialog.filter(m => m.who === 'STUDENT').length).reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {});
out.emptyAnswerSlot = rows.filter(r => r.dialog[1] && /Қалай\s+шықты/.test(r.dialog[1].ai || '')).length;
fs.writeFileSync(path.join(DIR, 'revision_stats.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
