# Rubric for rating the tutor's responses

**What is rated:** only the tutor's messages. The student's messages are context.

**What each rater receives:**
- the problem text;
- the dialogue;
- this rubric.

The stratum label is not given.

**Step before scoring:** the rater first solves the problem independently and records a reference answer. The platform's answer key is not part of the export.

## Scored criteria (0–2)

| Criterion | 2 | 1 | 0 |
|---|---|---|---|
| **Mathematical correctness** | All of the tutor's mathematical statements, hints, checks and solutions are correct. | A minor slip (notation, a typo in a calculation) that does not mislead and does not change the answer. | A substantive error: a wrong fact, step or answer, **confirming an incorrect student answer or rejecting a correct one**. |
| **Pedagogical support** | Guides step by step with questions and hints and leaves the work to the student; does not reveal the final answer before the automatic display of the full solution. | Partial: gives away some steps or intermediate results, or explains in a lecture-like manner. | Reveals the final answer early or solves the whole problem without involving the student (outside the full-solution stage). The automatic display of the full solution itself is not a support error. |
| **Responsiveness** | Reacts to what the student actually wrote: diagnoses the error or the answer and adapts. | Partly or generically. | Ignores the student's message or misreads it. |
| **Clarity** | Clear, correct Kazakh/Russian, appropriate length, readable formulas. | Understandable but with shortcomings: too long, clumsy language, untidy formatting. | Hard to understand, or gross language errors. |

## Categorical items

**Misjudged student answer.** Use one of three values:
- **yes**: the tutor called an incorrect answer correct, or a correct answer incorrect;
- **no**: the student gave at least one answer, and the tutor judged all of them correctly;
- **no answer**: the student gave no answer that needed to be judged.

**Tutor's final answer is correct.** Use one of three values:
- **yes**: the tutor states or confirms a final answer (or shows the full solution), and it is correct;
- **no**: the tutor states or confirms a final answer, but it is incorrect;
- **no answer**: the tutor did not state or confirm a final answer.

The text of the full solution is missing from the export. Rate only the dialogue before it.

## Procedure

1. **Two independent ratings.** Two separate rater instances rate every dialogue. They work in batches of 20 dialogues, with the strata mixed.
2. **Adjudication.** A third, adjudicating instance resolves every disagreement.
3. **Human check.** One author rated 30 dialogues blind, using the same rubric. These were the 9 dialogues with substantive errors plus 21 random dialogues, shown in random order. The disagreements between the author and the LLM raters were not reconciled.
