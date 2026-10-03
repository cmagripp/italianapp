# Unified learning and review implementation

Implemented on the shared programme checkout on 3 October 2026. This is implementation evidence, not a production or installed-phone release claim.

## Public services

`dailyPlan(store, {now, minutes})` in `js/learning/daily-plan.js` returns a read-only `{version:1, minutes, estimatedMinutes, continuation, dueCount, steps, suggestedNext, now}`. Home and Learn use identical stable step IDs, labels and destinations. Each step includes an activity, entry ID, optional case/objective/session ID and estimated visit minutes. Estimates are design defaults, not learner-trial measurements. A five-minute plan can include two minutes of review and three minutes of new/continued learning. Resuming a saved review reserves the remaining budget for new learning. Additional backlog remains available in Review. An optional next new activity is returned when the chosen budget is already occupied.

The module does not import full lesson authoring. The existing `homeLearning` history path loads `integration.js`, which registers the full review/lesson services; a fresh Home uses completion descriptors and the course outline. Merely calculating the plan or opening the queue creates no session.

`continuation(store,{now})` considers compatible saved word/verb journeys, grammar-v1/v2 lessons, combined Everyday Italian sessions, sentence workshops and bounded reviews in deterministic updated-time/ID order. Destinations contain the actual saved session ID and verb chapter where applicable. Workshop titles are saved by the workshop route. Grouped legacy dictionary entries remain resumable and reviewable; `legacyGrouping` excludes them from new discovery. No progress is assigned to newly split sense entries.

`reviewItems(store,now)` returns one row per word, completed verb case or independently eligible grammar lesson. Rows retain `targets` with exact assessed objective IDs, due times and diagnostic/legacy-item flags. Due work is independent of current discovery scope. A legacy aggregate item lapse is retained even if a newer adaptive objective has a later due date. Manual completion enrolls checks without inventing correct answers, rewards or readiness. An unchecked case remains excluded; its retained saved review is fenced and skipped without a new assessment.

## Identity and evidence

`objectives.js` declares versioned mappings. Equivalent aliases currently cover only the same stable dictionary noun's singular definite-article target, with the same skill and evidence modes. Custom editable nouns and plural-only noun policies are excluded. Broad legacy meaning/recall, bare-plural versus article-plus-plural, and broad tense conjugation map diagnostically. A broad conjugation does not become evidence for one person or contextual construction. Unsupported earlier diagnostics remain visible with their retained identity and a reference destination.

Raw event IDs/objective IDs remain unchanged on disk. Canonical indexing aggregates only declared equivalent aliases; registry changes invalidate cached summaries. Individual modes, assistance, policies and content versions remain attached to each event. New bounded review events declare `reviewPolicy:'unified-review-v1'`. Correct delayed recognition advances its recognition schedule with normal ease, independently of written-production readiness. Recognition and production schedules remain distinct; a recognition success cannot hide a still-due writing lapse. A review for that declared writing difficulty requests its typed check. Correct hint/reveal-supported responses cannot create unaided readiness. Duplicate immutable IDs cannot change schedules or rewards twice. Lossless checkpoints retain every event and invalidate on mapping changes.

`review-session.js` creates at most ten frozen question snapshots per visit (normally eight, or four for the two-minute plan slot), interleaving rows before adding more targets from one row. A mistake gives feedback and the visit continues to its existing stopping point. Extra practice is voluntary. The denominator never grows after mistakes. Review records and sessions use stable answer/session identities and preserve the exact draft, submitted accent policy, feedback and pause state through reload. Compatible explicit imports can resume under the same stable learner identity even if the local installation slot ID differs.

The route uses the shared activity viewport and existing feedback/answer controls. Correct sentence questions speak their complete authored sentence. The browser suites verify reachable Continue at 375 × 667 and on a shortened viewport, without page scrolling or overflow.

Grammar keeps its original mixed-response completion milestones and now adds `grammar-response-evidence-v1`: separate recognition and written-response counts, facet readiness and delayed retention. Language targets alone expose those written fields as production; typed reading/listening responses remain comprehension evidence. Guided answers cannot advance unified independent grammar schedules, and a retained written error requests writing even after choice repair satisfies the older course rubric. Derived checkpoints use `learning-v6-lossless-2-grammar-evidence` and rebuild older summaries losslessly. The exact policy and scoped evidence are in `grammar-evidence-contract.md`.

## Learning schema integration

Root integrated learning version **6** with migration `learning-v6-lossless-1`; profile schema remains version 2. Migration keeps the original event log, completion fences, XP and exact unfinished cursor/draft. Before changing the profile it atomically saves the v5 profile to IDB, verifies its SHA-256 and scope, and retains the recovery snapshot. Failed verification/commit shows export and retry recovery; a future learning schema is rejected. This replaces the earlier provisional v5 additive implementation.

An older v5 client ignores `reviewPolicy` and canonical metadata, so it does not reproduce the new recognition scheduling semantics. Its older session key function can also coalesce multiple bounded review visits sharing an entry/mode. The explicit v6 version makes this changed interpretation visible to older-client guards rather than claiming semantic compatibility from additive fields.

The migration updates and validates these consumers together:

- `model.js` learning-version guards, event normalization, equivalent-alias indexing, session-key normalization, merge/reset and lossless checkpoint validation.
- `store.js` profile normalization and migration, import/restore/reset transaction guards, older/future-version rejection, stable learner identity, evidence XP/reward accounting and durable recovery.
- Journey, adaptive, grammar-v1/v2, workshop and review route guards; SQL/cloud schema/version checks and merge handlers; service-worker build and deployment manifests.
- Existing `phase-0-2` fixtures and tests for v2-profile/v5-learning imports, future schema refusal, migration idempotence, manual uncheck fences, stale merges, historical XP, exact unfinished drafts, concurrent-device events and checkpoint replay.
- New equivalent-article and non-equivalent broad-tense/plural fixtures; out-of-order/duplicate alias merge; delayed recognition without typed readiness; multiple bounded-review sessions; same-learner explicit import to another local slot; reset/profile/learner changes while an answer or save is pending.
- Old-client refusal of v6 candidates and restoration from the preserved v5 pre-migration snapshot. Snapshot/commit/verification failure preserves data and rejects safely.

Root reports six migration browser cases passing in Chromium and WebKit, with the legacy fixtures (14), completion (24), index (10), persistence (17), store sync (20), course durability (7), and SQL contract (11) suites passing. The implementation lives in `js/learning/migrate-profile.js`, `model.js`, `store.js` and boot recovery in `app.js`; migration browser evidence is `tests/learning-v6-migration-e2e.mjs`. Deployment manifests and actual installed-device migration/storage failures remain release gates.

## Verification

- `tools/test-unified-learning.mjs`: 15 deterministic checks using real catalogues and authored grammar data, including preserved writing lapses and unmapped diagnostics.
- Existing `tools/test-learning-model.mjs`: 30 checks; `tools/test-learning-integration.mjs`: 17; `tools/test-learning-completion.mjs`: 24; `tools/test-learning-index.mjs`: 10 plus 1k/10k/50k desktop replay measurements.
- `tests/unified-review-e2e.mjs`: ten complete browser checks in Chromium and WebKit, including grouping/global due, exact game difficulty, fixed visit size, reload/deduplication, pause/Home/Learn resume, uncheck fences, typed accent/draft preservation and a retained grammar written error after choice repair. Reports are `unified-review-chromium.json` and `unified-review-webkit.json`.
- Existing `tests/review-layout-e2e.mjs`: ten Review/legacy geometry and lifecycle checks in Chromium; no application errors.

Actual installed-iPhone persistence, storage failure/migration rollout and learner-tested pacing remain separate release gates. Browser WebKit evidence is not an installed-phone test.

New verb lessons now use the declared `verb-case-coverage-v1` completion policy: every required target receives a supported check, every production target receives unaided production, and fresh mixed transfer closes the case. Errors require targeted repair and fresh production. Actual readiness and remembered evidence stay unchanged. Older saved sessions retain their cursor and sequencing. Saved optional eight-answer visits provide exact pause/resume without granting progress from the stop itself. The full runtime traversal passes 5,908 available cases, with 22 unavailable cases excluded; ordinary dynamic present is 24 question screens/16 written answers instead of 42/32. There are still 2,081 three-visit and 25 four-visit cases. Details, policies and browser evidence are in `catalogue-pacing-review.md`; the remaining larger cases and learner timing are explicit gates.

Review source fidelity: the frozen Italian gap and supplied situation are shown together. Reading retains its full Italian passage. Listening uses only the manifest’s reviewed bundled clip with the same complete spoken text, and a completed replay is required for independent listening evidence. Unplayed or device-speech-only responses record audio assistance. Both browsers decode and play the actual M4A clip through `ended`, then reload the exact visit before submitting.
