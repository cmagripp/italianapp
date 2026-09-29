# Adaptive learning implementation

Implemented against main `e6d33a9`, 29 September 2026. This branch is for review; production has not been deployed.

## Learner experience

- **Everyday Italian** teaches Present, completed Past (passato prossimo), background/habitual Past (imperfetto), and Future. A finite course has 19 checkpoints using the authored foundation verbs. Optional requests/commands, narrative forms, subjunctive and further compound forms are enrolled separately. The complete reference remains available.
- A word or verb lesson focuses on one skill. Meaning, Italian recall, conjugation, auxiliary, participle, agreement, contextual past choice, articles and plurals are tracked separately. Word context and listening are optional, with explicit skip controls.
- A skill requires at least four independent production successes, varied prompts, the latest three independent checks correct, intervening questions, and repaired component errors. Choice questions, copied answers, hints and answer audio cannot independently establish readiness. Person errors need new evidence for that person.
- Readiness and retention are distinct. “Remembered later” requires two varied independent successes in another session at least 24 hours after readiness. A new error reopens practice. Course checkpoints also require the specified person coverage.
- Wrong answers trigger supported explanations and further targeted practice. An uncertain answer receives a conservative explanation instead of a fabricated diagnosis. Short retrieval questions on other in-scope entries provide spacing.
- There is no automatic retry cap. Learners can continue, pause with their exact question/hint/draft saved, or explicitly skip a step. A ten-answer checkpoint offers a break without declaring mastery. A very small scope explains its spacing limitation and offers a scope change or skip.
- The Learn hub and Review use in-scope skill recommendations. Completing a stage's immediate checkpoints offers the next stage; its delayed checks remain scheduled. Skipping or choosing a later stage never grants mastery.
- Supported shared-runner games contribute skill evidence while retaining their existing rewards. Unsupported games do not certify skills. Explicitly choosing an advanced game does not enroll its tense into automatic lessons.

## Structure

No production dependencies or backend inference service were added. This remains a static, offline-capable JavaScript application.

| Module | Responsibility |
| --- | --- |
| `js/learning/curriculum.js` | Core stages, expansions, skill descriptors and finite checkpoints |
| `js/learning/content.js` | Authored foundation predicates, teaching notes and error tips |
| `js/learning/questions.js` | Serializable question recipes, safe variants, component metadata and game annotations |
| `js/learning/diagnose.js` | Conservative grading and observed component results |
| `js/learning/model.js` | Event reduction, readiness/retention, selection, spacing, merge and reset generations |
| `js/learning/integration.js` | Scope-aware recommendations, review eligibility and course progress |
| `js/views/learnAdaptive.js` | Resumable lesson loop, assistance tracking and explicit learner controls |
| `js/views/course.js` | Stage selection, milestones and expansion enrollment |

Old learned items, lists, custom entries and XP migrate additively. A legacy learned flag does not fabricate per-skill evidence. The Adaptive lessons setting can restore the original walkthrough while retaining adaptive history.

Attempt records contain metadata and observed component results, not raw typed answers. Local saved sessions can contain the current draft/feedback answer (capped at 500 characters); sessions are omitted from cloud uploads. Backups include local resume state. Custom-entry deletion uses tombstones so an old merged backup cannot silently restore the deleted entry.

Events use unique identities and reset generations. Reimporting the same evidence does not duplicate XP or resurrect reset progress. Metadata events are retained rather than unsafely compacted; acknowledged event compaction is a future storage optimization. Simultaneous browser tabs sharing a profile still use the app's existing whole-profile local persistence; use one active learning tab per profile. Cloud revision checks address separate-device writes.

## Cloud migration before rollout

Local lessons work without Supabase. Existing cloud installations need the updated SQL shown under **Me → Cloud sync → Show setup SQL / update sync**. It is the `SETUP_SQL` constant in `js/sync.js`.

1. Keep a backup of the existing Supabase table and a learner export.
2. Run the updated setup SQL in that installation's Supabase SQL editor. It adds a revision column, an authenticated revision-checked RPC, ownership policies, and a trigger rejecting older clients' blind updates.
3. Publish the reviewed application version, then reload installed devices. Older clients receive an update error rather than overwriting the new evidence.
4. Validate sync on two test accounts/devices before inviting existing learners to update. A missing schema shows a clear error and preserves local progress; there is no blind-write fallback.

The migration has been executed against isolated PostgreSQL using PGlite, including migration reruns, ownership isolation, stale revisions, insert races and legacy-writer rejection. The JavaScript sync protocol is additionally exercised using mocked concurrent transports. No production Supabase credentials or database were accessed. Real-device Safari/PWA behavior and live Supabase integration still need rollout testing.

## Verification

Run the deterministic checks with Node 22:

```sh
node tools/check-modules.mjs
node tools/check-shell.mjs
node tools/test-conjugator.mjs
node tools/test-noun-forms.mjs
node tools/test-learning-model.mjs
node tools/test-learning-questions.mjs
node tools/test-learning-store-sync.mjs
node tools/test-learning-integration.mjs
```

`tools/test-learning-sql.mjs` uses an isolated `@electric-sql/pglite@0.5.8` installation selected by `PGLITE_DIR`. Browser tests use Playwright; see [the browser test guide](../tests/README.md). The pull-request workflow installs test dependencies outside the app and runs the checks without publishing it.

Local verification at delivery passed 2,802 conjugator checks plus dedicated learning-model, curriculum/question/diagnosis, store/sync, recommendation/course and PostgreSQL migration checks. Browser verification covers adaptive lessons, game evidence and four actual service-worker update/offline scenarios. All 45 application routes and 45 existing flows passed across the full regression run and the focused rerun after a repaired review import; mobile layout checks covered 270 route/size/theme combinations, including expanded course milestones. These are Chromium checks using phone emulation, not physical iPhone Safari tests.

These tests establish software behavior and regression coverage. They do not measure long-term language acquisition. The adaptation is explainable, deterministic and local. It does not diagnose spoken pronunciation, score free conversation or claim a percentage of fluency. Authored semantic contexts cover the foundation set; other verbs use labeled form practice when reliable contexts are unavailable.

## Noun forms and meaning

Daily word cards display the recorded plural or a number-usage explanation. Entry cards, grids, reference pages and lessons distinguish a normally singular meaning from an unknown plural; placeholders are never turned into article-plus-dash answers. For example, the football entry remains **il calcio**, with an explanation that **i calci** means kicks. Invariable nouns still show both articles and undergo plural practice.

The full noun inventory and conflicting source meanings are reviewed in [the noun audit](NOUN-FORMS-AUDIT-2026-09-29.md). The current dictionary identifies entries by lemma and part of speech, so separate meanings can collapse during generation. This patch clarifies the selected meaning; a future meaning-aware dictionary migration must preserve saved entry references before adding separate senses.
