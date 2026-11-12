# Socratic LLM tutor in Kazakh: evaluation materials

Supplementary materials for the article:

> Zaurbekov N.S., Salgozha I.T., Aimakhanov Ye.Ye. *LLM-based Socratic tutor for school mathematics: engagement, response quality and student modelling.* Submitted to the Journal of Mathematics, Mechanics and Computer Science (Al-Farabi Kazakh National University).

The article analyses 1,197 sessions of a Socratic mathematics tutor (Gemini 3.5 Flash, solutions precomputed by Gemini 3.1 Pro) deployed on the JUZ40 platform in August–September 2026. It also rates a stratified sample of 100 dialogues with two LLM raters and an adjudicator (Claude Opus 5.5, model `claude-opus-5-5`, September 2026, default settings), plus a blind human check of 30 dialogues.

## Contents

| File | What it is |
|---|---|
| [RUBRIC.md](RUBRIC.md) | The rubric used by the LLM raters, the adjudicator and the human validator. |
| [scripts/analyze.js](scripts/analyze.js) | Descriptive analytics of the tutor log and the stratified sample: 4 strata × 25 dialogues, random seed `20260927`. |
| [scripts/eval_stats.js](scripts/eval_stats.js) | Final scores, inter-rater agreement (weighted Cohen's kappa with linear weights) and stratum-weighted shares. |
| [scripts/revision_stats.js](scripts/revision_stats.js) | χ² tests, the stratified estimator with finite-population correction (Eq. 2 in the article), Wilson intervals, reply latency and the message-language heuristic. |
| [scripts/topic_outcome.js](scripts/topic_outcome.js) | Topic × outcome tables and the Monte Carlo permutation test (20,000 permutations). |
| [scripts/opening.js](scripts/opening.js) | Opening templates and refusal templates. |
| [scripts/manual_check.js](scripts/manual_check.js) | Builds the blind-validation workbook: the 9 flagged dialogues plus 21 random ones, seed `27092026`. |

## Data

**The tutor log and the dialogues are not included.** They contain students' messages and belong to the JUZ40 platform.

The scripts take the de-identified CSV export of the log as their first argument. The CSV parser and the column order are in `analyze.js`.

## Running

- Node.js 18 or newer.
- `manual_check.js` also needs the `exceljs` package.

```
node scripts/analyze.js tutor_log.csv
node scripts/eval_stats.js rater_results.json
node scripts/revision_stats.js tutor_log.csv
```
