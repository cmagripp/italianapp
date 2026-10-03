# Catalogue journeys and game pacing

Implemented and independently exercised on the shared programme checkout on 3 October 2026. Browser evidence is not an installed-phone or learner-timing trial.

## Finished cases and retained evidence

New verb lesson sessions declare `caseCoveragePolicy:'verb-case-coverage-v1'`. Finishing a case requires a supported successful check for every available required target, one genuinely unaided production for each production target, and fresh mixed transfer after the earlier targets are covered. An error or reveal requires successful targeted repair and a subsequent fresh unaided production. The forced last matching pair cannot supply independent production credit. Coverage is reconstructed from immutable events within one declared session, rather than inferred from the current screen.

This policy changes the completion milestone only. Existing readiness, delayed remembered status, XP, earlier completion records and the evidence log keep their meaning. A finished target can still need its second independent context and later recall. Existing sessions without the declaration retain their old sequencing and cursor; an explicit fresh visit uses the updated policy. Manual uncheck fences older proof, and reset/merge preserve those fences. The v6 normalizer preserves the supported declaration exactly.

`journey-visit.js` provides a saved optional stopping point after eight answered main questions. Pair subrows do not inflate the visit count. Draft, feedback and the next question survive reload and pause; Home and Learn return to the same saved case. Choosing another visit resets only this presentation count and grants no completion or evidence.

If the learner explicitly saves an earlier required part for later, the final mixed transfer is also deferred. A partial visit ends at its recap while retaining correct progressive evidence and leaving the case incomplete. This fixes an unreachable final-transfer loop: the fresh transfer gate correctly refused credit without earlier simple coverage, but previously kept asking a transfer that could never satisfy that gate. Normal full practice still requires both fresh simple/progressive transfers after every earlier target is covered.

## Measured interaction counts

Cold, correct-answer traversals of an ordinary dynamic present case now require **24 question screens, including 16 written answers**, compared with 42 screens and 32 written answers under the retained consolidation sequence. Guided pair boards and choices provide variation without adding mandatory extra screens. A representative stative present case requires 13 screens/8 written answers; weather present 10/6, past 12/9, future and conditional 10/7. Teaching cards are counted separately: ordinary present has six. These are interaction counts, not measured minutes.

The refreshed full runtime traversal used actual question grading, teaching exposure, pair grading and event replay for all **5,908 available verb cases**, from 1,186 verbs and 5,930 core case descriptors. The 22 unavailable cases remain explicit exclusions and gain no completion. The active word catalogue contains 6,994 six-question journeys, including the separately identified meaning entries. Across available verb cases, optional eight-answer visits are distributed as follows:

| Visits | Cases |
| --- | ---: |
| 1 | 53 |
| 2 | 3,749 |
| 3 | 2,081 |
| 4 | 25 |

The maximum correct-answer case is 26 question screens and 17 written answers. Larger present/background cases therefore commonly need three visits; 25 cases still need four and remain a specific pedagogic-design gate. Mistakes can require additional targeted repair. This does not claim that all cases meet the plan's roughly two-visit aspiration, or that every catalogue sentence has received individual editorial review.

## Games and controls

Quiz, typing, conjugation and mixed-verb drills cap their final question list to the requested answer count, rather than multiplying it by each selected verb's subquestions. Matching, sentence construction and hangman use eight-item defaults. Sentence and hangman eligibility filtering precedes selection so explicitly requested larger sessions retain their requested count when enough eligible material exists. Crossword defaults to at most eight placed words while retaining a larger candidate pool for layout. The deliberately timed speed game retains its timed semantics.

All changed game families capture route, local profile, stable learner and learning epoch ownership. Retained answer, Continue, keyboard and timer callbacks cannot record for a different learner or after reset. Correct and incorrect authored sentence feedback speaks the complete sentence once. Controls remain reachable at the tested small viewport.

## Evidence and remaining gates

- `tools/test-journey-pacing.mjs`: ten deterministic policy, repair, partial-skip, merge, uncheck, clock-order and visit checks. The partial-skip check also retains the explicit historical repair sequence with two later unaided successes.
- Integration regressions rechecked after policy adoption: `tools/test-word-questions.mjs` passes 28 constraints (6,972 records at that run), `tools/test-lesson-activities.mjs` 19, `tools/test-verb-pacing.mjs` nine representative paths plus saved-scene/spacing/historical-policy proof, and `tools/test-journey-integration.mjs` 13. Historical fixtures explicitly retain their mandatory letter/second-production sequence; new fixtures require complete supported/unaided coverage and tightly bounded actual screen counts without claiming consolidated skill readiness. Review links pin the new case/objective visit instead of full-lesson replay.
- `tools/audit-journey-pacing.mjs` with `PACING_FULL=1`: refreshed after the partial-skip fix and current meaning/riavere additions: 5,908 available cases traversed, no failures; 6,994 active words and 1,186 verbs. Report `journey-pacing-full.json`.
- `tests/journey-pacing-e2e.mjs`: five checks in Chromium and WebKit, including exact reload/pause/resume, feedback/XP deduplication, accent restoration and ownership changes. Reports `journey-pacing-{chromium,webkit}.json`.
- Existing `tests/verb-pacing-e2e.mjs` and `tests/verb-flow-v2-e2e.mjs` explicitly continue the saved voluntary eight-answer visit boundary without adding events or XP. Both pass in Chromium and WebKit: Avere present has 15 questions (including one order-dependent supported spacing check), exactly eight unaided written targets and four formats; all five case-flow checks and the exact pre-update draft/feedback/Back scene checks remain enforced. Reports `tests/report-verb-pacing-{chromium,webkit}.json` and `tests/report-verb-flow-v2-{chromium,webkit}.json`.
- `tests/lesson-overview-e2e.mjs`: all 18 Chromium checks pass after the partial-skip repair; the two partial/full progressive regressions and application-error check also pass in WebKit. A skipped-simple progressive visit ends after six remaining questions with seven unaided progressive successes and incomplete case status. Normal full present remains 24 questions with both final simple/progressive transfers. Reports `tests/report-lesson-overview.json` and `tests/report-lesson-overview-targeted{,-webkit}.json`.
- `tests/game-family-pacing-e2e.mjs`: six checks in Chromium and WebKit, including larger explicitly requested sessions and stale pair, keyboard, answer and timer callbacks. Reports `game-family-{chromium,webkit}.json`.
- Existing Review geometry/lifecycle suite: ten Chromium checks, no application errors. Module parse check: 125/125. Unified-learning deterministic suite: 14 checks.

Learner trials, native educator review of catalogue language, refinement of the 25 four-visit cases and installed-device controls/persistence remain open. These checks establish implementation behavior and safe evidence boundaries.
