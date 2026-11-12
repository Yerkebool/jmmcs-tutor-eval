// Opening message types and what precedes the other template messages.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, 'topic_outcome.js'), 'utf8');
const parseCSV = eval('(' + src.match(/function parseCSV[\s\S]*?\n}\n/)[0] + ')');
const rows = parseCSV(fs.readFileSync(process.argv[2], 'utf8'));
const open = { wrong: 0, unanswered: 0, other: 0 }, byOpen = { wrong: {}, unanswered: {} }, prev = { refuse: [], detail: [] }, noMsg = { wrong: 0, unanswered: 0 };
for (const r of rows) {
  const d = JSON.parse(r[11]); const o = d[1] && d[1].kind === 'TEMPLATE' ? d[1].ai : '';
  const t = /қате кетіпті/.test(o) ? 'wrong' : /жауап бермепсің/.test(o) ? 'unanswered' : 'other'; open[t]++;
  const outcome = r[3] === 'ACTIVE' ? 'abandoned' : (d.some(m => m.kind === 'FULL_SOLUTION') ? 'full' : 'solved');
  if (byOpen[t]) { byOpen[t][outcome] = (byOpen[t][outcome] || 0) + 1; if (outcome === 'abandoned' && !d.some(m => m.who === 'STUDENT')) noMsg[t]++; }
  d.forEach((m, i) => { if (m.kind === 'TEMPLATE' && i > 1) { const p = d.slice(0, i).reverse().find(x => x.who === 'STUDENT'); (/Дайын жауап/.test(m.ai) ? prev.refuse : prev.detail).push(p ? p.student : '(none)'); } });
}
const kinds = {}; prev.refuse.length; fs.writeFileSync(require('path').join(__dirname, 'opening_stats.json'), JSON.stringify({ opening: open, outcomeByOpening: byOpen, abandonedWithoutMessageByOpening: noMsg, refusalTemplates: prev.refuse.length, moreDetailTemplates: prev.detail.length, refusalPrecededBy: prev.refuse.slice(0, 20), moreDetailPrecededBy: prev.detail.slice(0, 20) }, null, 1));
console.log('opening', open, '\nby opening', byOpen, '\nabandoned without message', noMsg);
console.log('before refusal (sample):', prev.refuse.slice(0, 14));
console.log('before "write in more detail" (sample):', prev.detail.slice(0, 14));
