# Grammar response evidence

The additive `grammar-response-evidence-v1` policy distinguishes an independent choice from an independent written answer. It preserves the existing grammar-v1/v2 `ready`, `remembered`, lesson completion, authored target rubric, events, XP, completion receipts and exact saved sessions. Those older fields remain mixed-response course milestones. One typed answer can legitimately complement recognition in the old rubric without certifying general written recall.

`grammar-state.js` and `course-v2-state.js` feed the same response tracker only events that their existing policy accepts as fresh and separated independent checks. Assistance, guidance, revealed answers, a forced final matching pair, ungraded portfolios, a repeated exposure family and an incompatible content version cannot add mode evidence. Conflicting `mode`/`responseMode` metadata remains in the old course interpretation but grants no new response milestone. The tracker retains exact qualifying event IDs.

Each response lane needs the target's minimum independent count, at least two distinct contexts, and coverage of every required facet. A lane's mistake suspends that lane until a fresh successful check in the same response mode repairs the same facet. Repeated unresolved mistakes require two repairs. A still-unresolved course misconception also suspends current response milestones. Two fresh distinct delayed contexts in a different session, at least one day after the lane became ready, establish its later-retention milestone. A short repair restores readiness without claiming delayed retention.

| Fields | Meaning |
| --- | --- |
| `recognitionIndependentCorrect`, `recognitionReady`, `recognitionRemembered` | Independent choices/matching, with their own facet and delayed evidence |
| `writtenIndependentCorrect`, `writtenResponseReady`, `writtenResponseRemembered` | Independent typed answers in the actual target modality |
| `productionIndependentCorrect`, `productionReady`, `productionRemembered` | The written evidence for a **language** target only |
| `responseEvidence.{recognition,written}` | Counts, required facets, unresolved mode errors, timing, delayed contexts and exact qualifying event IDs |

Reading and listening keep their comprehension modality. Typing a reading or listening answer can establish written-response evidence for that target; it does not establish general grammatical production. A recognition review can lengthen its own schedule without creating typed readiness or typed delayed retention.

The unified scheduler now accepts grammar successes only from independently qualifying event IDs and only in `grammarPhase:'independent'`. Guided/assisted success can receive a gentle retry time but cannot advance independent scheduling repetitions. The current content policy/version is respected. Generic recognition counters cannot overwrite the stronger grammar facet evidence.

Plain historical course events retain their existing mixed SRS until a unified visit is recorded. Review nevertheless requests a typed check whenever a retained written-mode error exists, even if the old course rubric was subsequently satisfied by choices. This preserves the old completion and due-time contract while making the actual difficulty reachable. The history UI keeps its neutral grammar labels.

Learning schema stays version 6 and the verified v5-to-v6 migration identity stays `learning-v6-lossless-1`. Only the derived checkpoint policy changes to `learning-v6-lossless-2-grammar-evidence`; older checkpoints rebuild from the complete retained event log. No stored evidence or saved answer is rewritten.

Verification: `tools/test-grammar-evidence.mjs` passes 15 checks covering mixed completion, recognition-only retention, typed later recall, facet completeness, repeated facets in the same context, comprehension modality, guided/assisted/forced/ungraded answers, exposure, repeated errors and same-mode repair, conflicting imports, legacy completion, content revisions, checkpoint replay, draft/merge/reset preservation, actual authored course completion and a real bounded written repair visit. Existing grammar course/durability, course engine/durability, unified learning, model and index/checkpoint suites also pass. The new deterministic suite is included in check/deploy CI.

`tests/unified-review-e2e.mjs` passes ten checks in Chromium and WebKit. The new case exercises the retained written difficulty, exact typed draft reload and successful repair in the actual route. Reports are `unified-review-chromium.json` and `unified-review-webkit.json` in this directory; neither reports application errors.

This is deterministic and browser implementation evidence. Native pedagogy, learner calibration and installed-device rollout remain separate gates.
