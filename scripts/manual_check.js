// Blind manual-verification workbook: the 9 dialogues with substantive errors + a stratified random fill to 30.
// Sheet 1: the author rates blind (LLM ratings are on a hidden sheet); sheet "Итог" computes agreement with formulas
// and assembles the sentences to paste into the article.
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const DIR = __dirname;
const F = JSON.parse(fs.readFileSync(path.join(DIR, 'eval_final.json'), 'utf8'));
const texts = {};
for (let b = 1; b <= 5; b++) fs.readFileSync(path.join(DIR, 'eval', `batch${b}.md`), 'utf8').split('\n\n---\n\n').forEach(t => { const m = t.match(/^### (S\d{3})/); if (m) texts[m[1]] = t.replace(/^### S\d{3}\n/, ''); });
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(27092026);
const flagged = F.filter(x => x.math_correct === 0 || x.misjudged_student_answer === 'yes');
const rest = F.filter(x => !flagged.includes(x));
const strata = ['solved_unrated', 'full_solution', 'rated_no_full', 'abandoned_engaged'];
const pick = [];
let need = 30 - flagged.length, si = 0;
const pools = Object.fromEntries(strata.map(s => [s, rest.filter(x => x.stratum === s).sort(() => rnd() - 0.5)]));
while (need > 0) { const s = strata[si % 4]; if (pools[s].length) { pick.push(pools[s].shift()); need--; } si++; }
// blind order: shuffle so that the flagged dialogues are not grouped or recognisable by position
const chosen = [...flagged, ...pick].map(x => ({ x, r: rnd() })).sort((a, b) => a.r - b.r).map(o => o.x);
const N = chosen.length, last = N + 1;
const YN = { yes: 'да', no: 'нет', na: 'нет ответа' };

(async () => {
  const wb = new ExcelJS.Workbook();
  // ---------- instructions ----------
  const info = wb.addWorksheet('0_Инструкция');
  [
    'Слепая проверка оценок ИИ-оценщиков: 30 диалогов (все 9 диалогов с существенными ошибками и 21 случайный, порядок перемешан).',
    'ВАЖНО: сделайте проверку ДО того, как подробно читать раздел Results статьи (там описаны найденные ошибки), и не открывайте скрытый лист с оценками ИИ – иначе проверка не будет слепой. Лучше всего, если её сделает тот из авторов, кто ещё не читал разбор ошибок.',
    '1. Откройте лист «1_Оценка_вслепую». Для каждого диалога прочитайте задачу и сообщения тьютора ([ТЬЮТОР]); реплики ученика – контекст. Оценивайте только сообщения тьютора.',
    '2. Сами решите задачу и впишите свой ответ в столбец C. Затем выставьте оценки в столбцах D–I (выпадающие списки).',
    'Полная рубрика (та же, что получали ИИ-оценщики). Мат. корректность: 2 – все математические утверждения, подсказки, проверки и решения тьютора верны; 1 – мелкая неточность (обозначение, опечатка в вычислении), которая не вводит в заблуждение и не меняет ответ; 0 – существенная ошибка: неверный факт, шаг или ответ, подтверждение неверного ответа ученика или отклонение верного.',
    'Педагогическая поддержка: 2 – ведёт по шагам вопросами и подсказками и оставляет работу ученику; не раскрывает итоговый ответ до автоматического показа полного решения; 1 – частично: выдаёт часть шагов или промежуточных результатов либо объясняет в лекционной манере; 0 – раскрывает итоговый ответ раньше времени или решает всю задачу без участия ученика (вне этапа полного решения). Сам автоматический показ полного решения ошибкой поддержки не считается.',
    'Реакция на реплики: 2 – отвечает на то, что действительно написал ученик: диагностирует ошибку или ответ и подстраивается; 1 – частично или шаблонно; 0 – игнорирует реплику или понимает её неверно.',
    'Ясность: 2 – ясный, грамотный казахский/русский язык, уместная длина, читаемые формулы; 1 – понятно, но с недостатками: слишком длинно, неуклюжий язык, неряшливое оформление; 0 – трудно понять или грубые языковые ошибки.',
    'Неверная оценка ответа ученика: «да» – тьютор назвал неверный ответ ученика верным или верный неверным; «нет» – ученик дал хотя бы один ответ, и тьютор оценил все его ответы правильно; «нет ответа» – ученик не давал ответа, который нужно оценить.',
    'Итоговый ответ тьютора верен: «да» – тьютор называет или подтверждает итоговый ответ (или показывает полное решение), и он верен; «нет» – называет, но ответ неверен; «нет ответа» – итоговый ответ не называл и не подтверждал. Текст полного решения в выгрузке отсутствует – оценивайте только диалог до него.',
    '3. Когда все 30 строк заполнены, откройте лист «3_Итог»: там автоматически посчитаны совпадения и собраны две фразы (EN и RU).',
    '4. Скопируйте английскую фразу в статью вместо предложения с [FILL IN] (файл paper.tex, раздел Results, «Quality of tutor responses»), русскую – в русскую версию вместо [ЗАПОЛНИТЬ]. Если совпадение по математической корректности ниже 24 из 30 или вы не подтвердили часть ошибок, сообщите – формулировки выводов нужно будет смягчить.',
    'Скрытый лист с оценками ИИ («2_Оценки_ИИ») можно открыть после проверки: правый клик по ярлыку листа → «Показать».',
  ].forEach(l => info.addRow([l]));
  info.getColumn(1).width = 150; info.eachRow(r => { r.alignment = { wrapText: true, vertical: 'top' }; });
  info.getRow(1).font = { bold: true };

  // ---------- 1: blind rating ----------
  const ws = wb.addWorksheet('1_Оценка_вслепую', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  ws.columns = [
    { header: 'Код', key: 'code', width: 7 },
    { header: 'Задача и диалог', key: 'dialog', width: 95 },
    { header: 'Ваш ответ к задаче', key: 'ref', width: 16 },
    { header: 'Мат. корректность (0–2)', key: 'mc', width: 12 },
    { header: 'Поддержка (0–2)', key: 'sc', width: 11 },
    { header: 'Реакция (0–2)', key: 'rs', width: 11 },
    { header: 'Ясность (0–2)', key: 'cl', width: 11 },
    { header: 'Неверная оценка ответа ученика', key: 'mis', width: 14 },
    { header: 'Итоговый ответ тьютора верен', key: 'cf', width: 13 },
    { header: 'Комментарий', key: 'note', width: 40 },
  ];
  chosen.forEach(x => ws.addRow({ code: x.code, dialog: texts[x.code] || '' }));
  ws.getRow(1).font = { bold: true }; ws.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
  ws.eachRow((row, i) => { if (i > 1) row.alignment = { wrapText: true, vertical: 'top' }; });
  for (let r = 2; r <= last; r++) {
    for (const c of ['D', 'E', 'F', 'G']) ws.getCell(`${c}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"0,1,2"'] };
    for (const c of ['H', 'I']) ws.getCell(`${c}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"да,нет,нет ответа"'] };
    for (const c of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) ws.getCell(`${c}${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7D6' } };
  }

  // ---------- 2: LLM ratings (hidden), same row order ----------
  const ai = wb.addWorksheet('2_Оценки_ИИ', { state: 'hidden' });
  ai.columns = [
    { header: 'Код', key: 'code', width: 7 },
    { header: 'Эталонный ответ (ИИ)', key: 'ref', width: 24 },
    { header: 'Мат. корректность', key: 'mc', width: 12 },
    { header: 'Поддержка', key: 'sc', width: 11 },
    { header: 'Реакция', key: 'rs', width: 11 },
    { header: 'Ясность', key: 'cl', width: 11 },
    { header: 'Неверная оценка ответа ученика', key: 'mis', width: 14 },
    { header: 'Итоговый ответ верен', key: 'cf', width: 12 },
    { header: 'Отобран как', key: 'kind', width: 16 },
    { header: 'Комментарий ИИ-оценщика', key: 'note', width: 60 },
  ];
  chosen.forEach(x => ai.addRow({ code: x.code, ref: x.reference_answer, mc: x.math_correct, sc: x.scaffolding, rs: x.responsiveness, cl: x.clarity, mis: YN[x.misjudged_student_answer], cf: YN[x.correct_final], kind: flagged.includes(x) ? 'ошибка ИИ-оценки' : 'случайный', note: [x.error_note, x.notes].filter(Boolean).join(' | ') }));
  ai.getRow(1).font = { bold: true }; ai.eachRow(r => { r.alignment = { wrapText: true, vertical: 'top' }; });

  // ---------- 3: summary with formulas ----------
  const B = `'1_Оценка_вслепую'`, A = `'2_Оценки_ИИ'`, rng = c => `${c}2:${c}${last}`;
  const sum = wb.addWorksheet('3_Итог');
  sum.columns = [{ width: 70 }, { width: 14 }];
  const rows = [
    ['Заполнено строк (мат. корректность)', `COUNT(${B}!${rng('D')})`],
    ['Совпало: математическая корректность', `SUMPRODUCT(--(${B}!${rng('D')}=${A}!${rng('C')}),--ISNUMBER(${B}!${rng('D')}))`],
    ['Совпало: педагогическая поддержка', `SUMPRODUCT(--(${B}!${rng('E')}=${A}!${rng('D')}),--ISNUMBER(${B}!${rng('E')}))`],
    ['Совпало: реакция на реплики', `SUMPRODUCT(--(${B}!${rng('F')}=${A}!${rng('E')}),--ISNUMBER(${B}!${rng('F')}))`],
    ['Совпало: ясность', `SUMPRODUCT(--(${B}!${rng('G')}=${A}!${rng('F')}),--ISNUMBER(${B}!${rng('G')}))`],
    ['В пределах 1 балла по всем четырём критериям', `SUMPRODUCT(--(ABS(${B}!${rng('D')}-${A}!${rng('C')})<=1),--(ABS(${B}!${rng('E')}-${A}!${rng('D')})<=1),--(ABS(${B}!${rng('F')}-${A}!${rng('E')})<=1),--(ABS(${B}!${rng('G')}-${A}!${rng('F')})<=1),--ISNUMBER(${B}!${rng('D')}),--ISNUMBER(${B}!${rng('E')}),--ISNUMBER(${B}!${rng('F')}),--ISNUMBER(${B}!${rng('G')}))`],
    ['Подтверждено существенных ошибок (из 9)', `SUMPRODUCT(--(${A}!${rng('C')}=0),--(${B}!${rng('D')}=0),--ISNUMBER(${B}!${rng('D')}))`],
    ['Новых существенных ошибок в 21 случайном диалоге', `SUMPRODUCT(--(${A}!${rng('C')}<>0),--(${B}!${rng('D')}=0),--ISNUMBER(${B}!${rng('D')}))`],
    ['Совпало: неверная оценка ответа ученика', `SUMPRODUCT(--(${B}!${rng('H')}=${A}!${rng('G')}),--(${B}!${rng('H')}<>""))`],
  ];
  sum.addRow(['Показатель', 'Значение']).font = { bold: true };
  rows.forEach(([label, f]) => sum.addRow([label, { formula: f }]));
  // B2..B10 hold the values above
  sum.addRow([]);
  sum.addRow(['Фраза для статьи (EN) – вставить вместо предложения с [FILL IN]:']).font = { bold: true };
  sum.addRow([{ formula: `"In the blind check, the author's ratings matched the final ratings for mathematical correctness in "&B3&" of the 30 dialogues, for pedagogical support in "&B4&", for responsiveness in "&B5&" and for clarity in "&B6&"; the author confirmed "&B8&" of the nine substantive errors and found "&B9&" further substantive errors in the 21 random dialogues."` }]);
  sum.addRow(['Фраза для русской версии – вместо предложения с [ЗАПОЛНИТЬ]:']).font = { bold: true };
  sum.addRow([{ formula: `"При слепой проверке оценки автора совпали с итоговыми по математической корректности в "&B3&" из 30 диалогов, по педагогической поддержке – в "&B4&", по реакции на реплики – в "&B5&" и по ясности – в "&B6&"; автор подтвердил "&B8&" из девяти существенных ошибок и нашёл ещё "&B9&" существенных ошибок в 21 случайном диалоге."` }]);
  sum.eachRow(r => { r.alignment = { wrapText: true, vertical: 'top' }; });
  sum.getColumn(1).width = 110;

  const out = path.join(DIR, 'Ручная_проверка_диалогов_тьютора.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('written', out, '| dialogues:', N, '| flagged:', flagged.length, '| order:', chosen.map(x => x.code).join(' '));
})();
