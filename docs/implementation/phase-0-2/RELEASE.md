# Phases 0–2 repair release

This release implements the first three authorised phases: baseline preservation, shared contracts and feasibility work, and repairs to the existing application. It stops before Phase 3. New Conversations, Dialogue Coach, broad navigation changes and the full curriculum rewrite remain later phases.

## What changes for learners

- Typed drills share one accent policy. With Strict accents off, an accent-only answer is accepted and visibly corrected while the original spelling remains available. Existing feedback keeps its original result after settings change or reload. Explicit answer choices still distinguish meaning.
- The sentence workshop checks the submitted form, accepts supported compound forms and alternatives, and labels dictionary construction as assisted. It preserves typed drafts and prevents old callbacks from replacing another lesson or learner's work. Misleading automated fit verdicts are removed.
- Saving failures remain visible with Retry and Export. Imports/resets preserve and verify a recovery copy before activation. Learner identities, deleted-list records and prospective reward identities prevent unsafe merging, resurrection or duplicate new awards.
- Verified course errors, missing person-form preparation and mismatched repair explanations are corrected. All 256 lessons have a tracked inventory. This is a bounded repair; it is not the comprehensive zero–C2 editorial rewrite or approval by a human Italian educator.
- Home/Learn resume labels agree with their destination. Answer announcements, translation state, language labels, zoom and reachable feedback controls receive accessibility repairs. The bespoke visual design is retained.
- Course stages load when opened. Compact course/completion indexes preserve exact existing completion rules, while the first route avoids loading all 13 course packs and the large lesson table. Installed stages remain available on their first offline visit.
- Updates verify file hashes, reuse unchanged bytes and activate atomically. Interrupted updates preserve the prior installation. Fonts are local, and the existing optional assistant runtime has a separately verified cache, including opt-in before the first worker controls the page.

## Evidence and practical limits

Local checks passed: **46 deterministic commands/suites, all 24 Chromium suites, four WebKit suites, 48 routes and 46 interaction flows**. The packaged-site subset and simulator UI checks also passed.

The [integrated validation record](integrated-validation.json) retains actual commands/results, resolved fixture failures and browser evidence. Supporting records include [storage/contracts](contracts-validation.json), [WebKit](webkit-validation.json), [simulator UI](simulator-ui.json), [curriculum inventory](curriculum-map.md), [startup measurements](startup-performance.json) and [evidence measurements](evidence-performance.json).

Cold local Chromium Home source requests fell from about 9.05 MB to 5.12 MB. The 3.46 MB dictionary remains loaded; these are source-byte counts, not hosted transfer or physical-phone timings. At 50,000 synthetic events, median append was about 27 ms versus 541 ms for explicit complete normalization/replay. Immutable map copying is still linear. Checkpoints retain every event and fence; they do not reduce storage and their verified hydration is not claimed to be faster than replay.

The tested simulator is **iPhone 16 Pro Max on iOS 26.5 (23F77)**. Safari Home and a verb lesson were visually inspected; browser interaction, storage and update checks are separately recorded. Simulator results do not measure physical microphone, battery or thermal behavior.

## AI/speech trial decision

The [disposable trial report](ai-trial.md) includes four measured local models, actual local recognition and speech, edited manual input, three context-bearing hands-free turns, offline reopening and cancellation evidence. It is isolated from the deployed app.

Every tested small model made serious teaching errors, so **none is recommended as a production tutor yet**. The simulator returned no WebGPU adapter; the production mobile runtime decision remains unresolved. Desktop local inference is demonstrated, but does not settle mobile suitability. No cloud fallback or new production conversation service has been introduced. Later AI work needs a stronger teaching evaluation and a usable mobile runtime before release.

## Release boundary

The baseline is `bd60180cc4eea7d9c0bd45e41584048ec752fba1`. The application stamp is `parola-v15-a9cf12a5a28d`. Publication is gated by the build and complete shared browser workflow; the exact pushed commit, successful Pages run and live byte verification are reported in the task after deployment. No later phase begins without the user's confirmation.
