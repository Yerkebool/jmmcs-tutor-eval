// Descriptive analytics of the JUZ40 AI-tutor log + stratified sample for quality evaluation.
// Usage: node analyze.js "<path to ai_tutor.csv>"
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
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
const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (a, b) => +(100 * a / b).toFixed(1);
const secs = t => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
const strip = h => (h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();
const KZ = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/;

const rows = parseCSV(raw).map(r => {
  const d = JSON.parse(r[11]);
  const full = d.some(m => m.kind === 'FULL_SOLUTION');
  let outcome;
  if (r[3] === 'ACTIVE') outcome = 'abandoned';
  else if (full) outcome = 'full_solution';
  else outcome = 'solved';
  return { user: r[0], session: r[1], problem: r[2], status: r[3], hint: +r[4], nStudent: +r[5], nCount: +r[6], started: r[7], rating: r[8] || null, tags: r[9] ? JSON.parse(r[9]) : [], comment: r[10] || null, dialog: d, full, outcome, rated: r[3] === 'RATED' };
});
const S = {};
S.sessions = rows.length;
S.users = new Set(rows.map(r => r.user)).size;
S.problems = new Set(rows.map(r => r.problem)).size;
S.period = [rows.map(r => r.started).sort()[0], rows.map(r => r.started).sort().slice(-1)[0]];
const perUser = {}; rows.forEach(r => perUser[r.user] = (perUser[r.user] || 0) + 1);
const pu = Object.values(perUser);
S.sessionsPerUser = { mean: +mean(pu).toFixed(2), median: q(pu, 0.5), max: Math.max(...pu), oneSessionUsersPct: pct(pu.filter(x => x === 1).length, pu.length) };
const cnt = (arr, key) => arr.reduce((a, r) => (a[key(r)] = (a[key(r)] || 0) + 1, a), {});
S.status = cnt(rows, r => r.status);
S.outcome = cnt(rows, r => r.outcome);
S.outcomePct = Object.fromEntries(Object.entries(S.outcome).map(([k, v]) => [k, pct(v, rows.length)]));
S.ended = rows.filter(r => r.outcome !== 'abandoned').length;
S.ratedOfEnded = { rated: rows.filter(r => r.rated).length, pct: pct(rows.filter(r => r.rated).length, S.ended) };
S.hintByOutcome = {};
for (const o of ['solved', 'full_solution', 'abandoned']) S.hintByOutcome[o] = cnt(rows.filter(r => r.outcome === o), r => 'h' + r.hint);
S.hintOverall = cnt(rows, r => 'h' + r.hint);
const msgStats = sel => { const a = rows.filter(sel); const st = a.map(r => r.dialog.filter(m => m.who === 'STUDENT').length); const all = a.map(r => r.dialog.length); return { n: a.length, studentMsgs: { median: q(st, 0.5), q1: q(st, 0.25), q3: q(st, 0.75), mean: +mean(st).toFixed(2) }, allMsgs: { median: q(all, 0.5), q1: q(all, 0.25), q3: q(all, 0.75) } }; };
S.messagesByOutcome = { solved: msgStats(r => r.outcome === 'solved'), full_solution: msgStats(r => r.outcome === 'full_solution'), abandoned: msgStats(r => r.outcome === 'abandoned'), all: msgStats(() => true) };
S.abandonedNoStudentMsg = rows.filter(r => r.outcome === 'abandoned' && r.dialog.filter(m => m.who === 'STUDENT').length === 0).length;
S.messages = { total: rows.reduce((a, r) => a + r.dialog.length, 0), student: rows.reduce((a, r) => a + r.dialog.filter(m => m.who === 'STUDENT').length, 0), assistant: rows.reduce((a, r) => a + r.dialog.filter(m => m.who === 'ASSISTANT').length, 0), kinds: rows.reduce((a, r) => { r.dialog.forEach(m => a[m.kind] = (a[m.kind] || 0) + 1); return a; }, {}) };
// durations and latency (times of day; add 24h when crossing midnight)
const dur = [], lat = [];
const durBy = { solved: [], full_solution: [], abandoned: [] };
for (const r of rows) {
  const ts = r.dialog.map(m => secs(m.at));
  for (let i = 1; i < ts.length; i++) if (ts[i] < ts[i - 1]) ts[i] += 86400 * Math.ceil((ts[i - 1] - ts[i]) / 86400);
  const d = ts[ts.length - 1] - ts[0]; dur.push(d); durBy[r.outcome].push(d);
  for (let i = 1; i < r.dialog.length; i++) if (r.dialog[i - 1].who === 'STUDENT' && r.dialog[i].who === 'ASSISTANT') lat.push(ts[i] - ts[i - 1]);
}
const secStats = xs => ({ n: xs.length, median: q(xs, 0.5), q1: q(xs, 0.25), q3: q(xs, 0.75), p90: q(xs, 0.9) });
S.durationSec = { all: secStats(dur), solved: secStats(durBy.solved), full_solution: secStats(durBy.full_solution), abandoned: secStats(durBy.abandoned) };
S.tutorLatencySec = secStats(lat);
// language of student messages
const stMsgs = rows.flatMap(r => r.dialog.filter(m => m.who === 'STUDENT').map(m => m.student || ''));
S.studentLang = { total: stMsgs.length, kazakhLetters: stMsgs.filter(t => KZ.test(t)).length, cyrillicNoKz: stMsgs.filter(t => /[А-Яа-яЁё]/.test(t) && !KZ.test(t)).length, latinOrDigitsOnly: stMsgs.filter(t => !/[А-Яа-яЁёәғқңөұүһі]/i.test(t)).length };
S.studentMsgLen = { median: q(stMsgs.map(t => t.length), 0.5), q1: q(stMsgs.map(t => t.length), 0.25), q3: q(stMsgs.map(t => t.length), 0.75) };
// ratings and tags
S.ratings = cnt(rows.filter(r => r.rating), r => r.rating);
S.ratingsByFull = { withFull: cnt(rows.filter(r => r.rating && r.full), r => r.rating), withoutFull: cnt(rows.filter(r => r.rating && !r.full), r => r.rating) };
S.tags = rows.reduce((a, r) => { r.tags.forEach(t => a[t] = (a[t] || 0) + 1); return a; }, {});
S.sessionsWithTags = rows.filter(r => r.tags.length).length;
S.comments = rows.filter(r => r.comment).length;
// daily activity
S.daily = cnt(rows, r => r.started.slice(0, 10));
S.activeDays = Object.keys(S.daily).length;
// problems
const perProblem = Object.values(cnt(rows, r => r.problem));
S.sessionsPerProblem = { median: q(perProblem, 0.5), max: Math.max(...perProblem), problemsWithOneSession: perProblem.filter(x => x === 1).length };
// chi-square: hint level (0-1 vs 2 vs 3) x ended outcome (solved vs full_solution)
const ended = rows.filter(r => r.outcome !== 'abandoned');
const lv = h => (h <= 1 ? '0–1' : String(h));
const table = {}; for (const r of ended) { const k = lv(r.hint); table[k] = table[k] || { solved: 0, full_solution: 0 }; table[k][r.outcome]++; }
const levels = Object.keys(table).sort(); const cols = ['solved', 'full_solution'];
const rowT = levels.map(l => cols.reduce((a, c) => a + table[l][c], 0)); const colT = cols.map(c => levels.reduce((a, l) => a + table[l][c], 0)); const N = rowT.reduce((a, b) => a + b, 0);
let chi2 = 0; levels.forEach((l, i) => cols.forEach((c, j) => { const e = rowT[i] * colT[j] / N; chi2 += (table[l][c] - e) ** 2 / e; }));
const dfree = (levels.length - 1) * (cols.length - 1);
// p-value for chi-square with df=2 via exact formula exp(-x/2); df=1 via erfc
const pval = dfree === 2 ? Math.exp(-chi2 / 2) : null;
S.chiHintOutcome = { table, chi2: +chi2.toFixed(2), df: dfree, p: pval !== null ? +pval.toExponential(2) : 'n/a', cramersV: +Math.sqrt(chi2 / (N * (Math.min(levels.length, cols.length) - 1))).toFixed(3), N };
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(S, null, 1));

// ---------- stratified sample for quality evaluation ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20260927);
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const strata = {
  solved_unrated: rows.filter(r => r.status === 'SOLVED'),
  full_solution: rows.filter(r => r.full),
  rated_no_full: rows.filter(r => r.rated && !r.full),
  abandoned_engaged: rows.filter(r => r.outcome === 'abandoned' && r.dialog.filter(m => m.who === 'STUDENT').length >= 2),
};
const sample = [];
for (const [name, pool] of Object.entries(strata)) shuffle(pool).slice(0, 25).forEach(r => sample.push({ stratum: name, poolSize: pool.length, r }));
const order = shuffle(sample); // mix strata so batches are not homogeneous
const fmtDialog = (s, i) => {
  const code = 'S' + String(i + 1).padStart(3, '0');
  const lines = [`### ${code}`, `ЗАДАЧА: ${s.r.problem}`];
  for (const m of s.r.dialog) {
    if (m.who === 'STUDENT') lines.push(`[УЧЕНИК]: ${(m.student || '').trim()}`);
    else lines.push(`[ТЬЮТОР${m.kind === 'TEMPLATE' ? ', шаблон' : m.kind === 'FULL_SOLUTION' ? ', полное решение' : ''}]: ${strip(m.ai)}`);
  }
  return { code, text: lines.join('\n') };
};
fs.mkdirSync(path.join(OUT, 'eval'), { recursive: true });
const key = [];
order.forEach((s, i) => { const f = fmtDialog(s, i); s.code = f.code; s.text = f.text; key.push({ code: f.code, session: s.r.session, stratum: s.stratum, poolSize: s.poolSize, status: s.r.status, outcome: s.r.outcome, hint: s.r.hint, rating: s.r.rating }); });
for (let b = 0; b < 5; b++) fs.writeFileSync(path.join(OUT, 'eval', `batch${b + 1}.md`), order.slice(b * 20, b * 20 + 20).map(s => s.text).join('\n\n---\n\n'), 'utf8');
fs.writeFileSync(path.join(OUT, 'eval', 'sample_key.json'), JSON.stringify(key, null, 1));
// problems for topic classification
const probs = Object.entries(cnt(rows, r => r.problem)).map(([text, n], i) => ({ id: 'P' + String(i + 1).padStart(3, '0'), sessions: n, text }));
fs.writeFileSync(path.join(OUT, 'problems.json'), JSON.stringify(probs, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(S).filter(([k]) => k !== 'daily')), null, 1));
console.log('strata sizes:', Object.fromEntries(Object.entries(strata).map(([k, v]) => [k, v.length])), '| sample:', sample.length, '| problems:', probs.length);
