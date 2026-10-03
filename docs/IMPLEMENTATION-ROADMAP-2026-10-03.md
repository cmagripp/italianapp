# Parola implementation roadmap

Status: implementation proposal, 3 October 2026. This document defines execution order for the [agreed comprehensive update plan](PLAN-UNIFIED-LEARNING-OFFLINE-AI-2026-10-03.md); it does not change its product decisions. Application implementation, downloads and deployment have not begun as part of this planning work.

Build and release the programme in usable increments. Run three workstreams together: application correctness and integration; curriculum and language data; offline AI and speech feasibility. Stabilise shared data rules before connecting new features. Begin the complete Foundations–C2 curriculum early, while independently resolving whether the requested conversation experience works on the installed iPhone app.

The planning baseline is `bd60180cc4eea7d9c0bd45e41584048ec752fba1`. Refresh against the external team's latest `main` when implementation starts and before each integration. Audit findings must be reconciled with intervening changes; the plan does not assume the remote repository has stood still.

## 1. Phases and dependencies

| Phase | Deliverable | Depends on | Completion gate |
| --- | --- | --- | --- |
| **0. Establish the execution baseline** | Current source baseline, complete requirements ledger, reproducible defect examples and migration profiles. | Implementation start. | Every agreed requirement has an owner, dependencies and an observable test. |
| **1. Agree shared contracts and test the phone architecture** | Data/progress/language/conversation contracts; whole-course map; combined offline AI and speech trial. | Phase 0 inventory. | Contracts reviewed; runtime decision supported by real-phone measurements or an explicit unresolved platform decision. |
| **2. Repair correctness and the underlying systems** | Trustworthy grading, accents, saves and drafts; fast evidence/startup; urgent content and accessibility repairs. | Relevant Phase 1 contracts, not completion of the phone trial. | Critical regressions pass without losing learner data or installed offline content. |
| **3. Connect the learning experience** | One review/continuation system, coherent navigation, shared activity controls, updated words/verbs/workshop and language reference. | Applicable Phase 2 foundations and language-data contracts. | All surfaces agree about progress and review; short, varied lessons and reliable navigation work end to end. |
| **4. Deliver production offline AI and speech services** | Verified downloadable packs, local AI service, speech services, level/rule retrieval and durable conversation storage. | Successful architecture trial; stable persistence/language contracts. | Production components work after a cold offline reopen and recover from failed installation or update. |
| **5. Deliver Conversations and Dialogue Coach** | Written, tap-recorded and hands-free conversation, Italian coaching, live summaries and connected study actions. | The Phase 4 services and Phase 3 interfaces needed by each slice. | Every requested mode passes its own complete device, language and recovery checks. |
| **6. Complete the curriculum through C2** | Revised Foundations/A1, A2/B1, B2 and C1/C2 releases with complete practice, media and reference coverage. | Authoring begins in Phase 1; publication follows prerequisite/data/player readiness. | Every stage meets its language, teaching, transfer and skill-breadth requirements. |
| **7. Validate and release the complete programme** | Integrated application, migrated history, reliable updates, reviewed content, documentation and verified live release. | All preceding scope, including advanced curriculum and spoken modes. | Requirement ledger closed with evidence; deployed version matches the validated release. |

These are dependency phases, not eight serial waiting rooms. Content authoring, evaluation cases, visual prototypes and independent fixes proceed as soon as their own inputs are ready. A phone-testing delay does not stop the core repairs or course work.

## 2. Phase 0 establishes what we are delivering

Refresh and inspect `main`, preserve existing local work and user-supplied files, and use isolated `codex/` branches or worktrees for implementation. Record the starting commit and current production version. Re-run the appropriate baseline checks before attributing failures to new work.

Create one implementation ledger covering every requirement in Sections 3–12 of the comprehensive plan. Each work package records its affected surfaces, owner, prerequisite contracts, test cases, migration implications, release destination and status. Track “implemented,” “independently reviewed,” “device validated” and “live verified” separately.

Prepare representative synthetic old profiles: partially learned words and verb cases, manual checks/unchecks, grammar and workshop sessions, lists/custom words, game mistakes, XP, legacy evidence, recordings and optional cloud identities. Do not depend on inspecting the user's personal learning history. Record a safe export/recovery procedure before migrating anything.

Before the first real migration, require a recoverable pre-migration snapshot or export, an idempotent transformation, verification before activating the new state, and a tested restore path compatible with the saved schema. If durable preservation fails, keep the prior state active and show the failure.

**Result:** a complete, prioritised backlog and a baseline against which each release can be assessed. No feature is omitted simply because it belongs to advanced content or is difficult to test.

## 3. Phase 1 settles shared rules and the main technical uncertainty

Three specialist assignments start together:

1. **Learning and data:** specify completion versus evidence, canonical objectives and legacy aliases, review eligibility, assistance, prospective rewards, accent comparison/display, durable saves, profiles, sessions, sense IDs and content versions. Specify committed/draft conversation turns, correction provenance, summary revisions and audio retention. Preserve existing progress and never manufacture past evidence.
2. **Curriculum and language:** inventory all 256 baseline lessons plus reserve, repair and review variants; define the complete Foundations–C2 outcome/prerequisite map and retain/repair/merge/replace decisions. Map vocabulary senses, full paradigms, linked word/verb cases and reference topics. Reconcile counts if the new main has changed them.
3. **AI and speech:** build a small disposable test of the complete local pipeline: microphone → turn detection → Italian recognition → dialogue/correction → local speech. Compare the plan's candidate combinations, including the existing text-model baseline. Test Italian teaching quality, learner-error preservation, latency, resource contention, audio activation and cold offline use on the iPhone 16 Pro Max with the reported iOS 26.6.1, or document its actual updated version.

The trial returns separate results for written conversation, manual speech and hands-free use. It is not a polished chat interface or proof of full A1–C2 quality. Select the runtime/model combination from measurements, not model size or family reputation. Pin exact versions and redistribution terms.

If the browser path cannot meet the agreed offline experience, present the measured failure and a concrete native iOS alternative, including distribution and progress migration. That product decision remains with the user. Do not silently substitute cloud processing or scripted replies. Physical-phone access is a real dependency; unavailable testing remains explicitly unverified while independent work continues.

**Result:** shared contracts and an evidence-based platform direction. Correctness repairs may begin once their individual contracts are reviewed, without waiting for every trial result.

## 4. Phase 2 makes the existing app trustworthy and faster

Implement small reviewable batches:

- **Grading and accents:** reproduce and repair false accepts/rejects, accepted variants and workshop agreement/compound input. Apply Strict accents consistently; permissive typed answers visibly become the correct accented form on submission. Keep assisted construction distinct from assessed production.
- **Persistence:** reliable save outcomes, workshop drafts, safe import/reset, local-profile boundaries, deletion tombstones, duplicate-award prevention and cloud identity/merge corrections. Stop reporting success when data was not saved.
- **Performance:** append evidence and update indexes without replaying the entire lifetime log; design and verify compaction against resets, old backups and concurrent devices. Render from compact startup data, lazily load large lesson data, isolate damaged packs and route directly to current players.
- **Immediate learner-facing repairs:** urgent incorrect/unsupported teaching, incomplete prerequisites and paradigms, wrong resume destinations, misleading fit feedback, obstructing feedback/toasts, and essential zoom/announcement fixes.
- **Offline updates:** reuse unchanged hashed assets, preserve atomic activation and installed course availability, and self-host required fonts/runtime assets. Keep recovery possible after interrupted updates.

**First usable release:** these repairs can ship before new Conversations is ready. Completion requires the critical regression set, representative migration tests, retained offline routes and measured improvement in the diagnosed slow paths. Do not remove old behavior before its replacement and migration are covered.

## 5. Phase 3 creates one connected learning experience

Connect Home, Learn, Course, Words, Play and Me to the same progress and continuation services. Home and Learn identify the exact activity they resume; the daily plan balances review and new learning within the chosen time budget. Preserve useful existing dials, reels, cards and dropdown styling. Put preferences into a coherent settings sheet.

Unify review around the actual word, verb case or grammar target. A game mistake and its subsequent review resolve the same difficulty. Group related due targets into short sessions; do not replay entire lessons per row. Manual completion remains supported, unlearned cases stay out of ordinary review, and scope filters do not erase due work.

Extract shared activity behavior one family at a time: viewport/keyboard fitting, back/pause, stable visit progress, help, feedback, lookup, information menus and completion actions. Keep layouts appropriate to matching, example rails, construction and chat. Review all exercise/game families for reachable Continue, full-sentence playback, stable matching cards, flashcard controls and intentional transitions.

Update word and verb journeys across the catalogue. Retain short mainly non-writing word lessons; all five core verb cases; formal Lei; correct gerund/participle patterns and exceptions; appropriate progressive usage; the current verb's own examples; mixed simple/progressive review; shorter varied visits and specific repairs. Do not treat one corrected verb as completion of this package.

Integrate sense-aware dictionary data and reference coverage with safe old-ID mappings. Correct noun-phrase metadata, auxiliary-by-construction rules, accent-sensitive explanations, accepted irregular alternatives and valid game distractors. Preserve ambiguous old completion without claiming that every new sense was mastered.

The workshop receives its two clear purposes—practise a pattern and help me say it—with valid alternatives, explicit assistance, editable agreement preferences, meaningful glosses and coherent next turns.

Phase 3 delivers the common mechanisms and catalogue-wide migration/coverage checks; the full lesson-by-lesson language and media review continues through Phase 6. Conversation work can consume reviewed interfaces before every navigation or catalogue change is finished.

**Result:** the existing learning product works cohesively without requiring AI. Progress, review and shared controls have migrated safely; old links and unfinished sessions still resolve.

## 6. Phase 4 provides dependable local services

Turn the successful prototype into production components:

- One cancellable AI service shared by lessons, workshop and conversations, with task priority, bounded context, relevant history retrieval, validated output and stale-result protection.
- A sense/construction-aware level policy, grounded rule retrieval and appropriate handling of valid alternatives or uncertain corrections. Generated practice cannot determine mastery without a validated objective and answer.
- Separate durable transcript, draft and summary records; stable thread/participant/turn IDs; original-versus-corrected provenance; export/import/delete and profile isolation.
- Offline conversation and speech packs with accurate size/progress, cancellation, resumable verification, repair/removal, pinned runtimes and licenses. Keep model assets separate from learner data and from the small website distribution.
- A local audio controller for capture, pause detection, recognition, playback, interruptions, permission/lifecycle changes and explicit recording retention. Recognition uncertainty cannot become a grammar penalty.

Test packaging in the installed app's own storage. A successful download or desktop inference is insufficient: cold-reopen in airplane mode and exercise the actual runtime, tokenizer, weights, speech recognizer, turn detector and local voice together. Keep compatible previous assets until a replacement passes verification.

**Result:** production services suitable for the real conversation interface. Dialogue-only and full-speech readiness are recorded separately.

The written slice may proceed once its generation, persistence, validation and local playback requirements pass. Manual and hands-free recognition/controller work can continue alongside it; their later release gates remain mandatory.

## 7. Phase 5 delivers the conversation experience in complete slices

**5A — Written Conversations.** Deliver the saved inbox, name/agreement/level/topic/participant setup, message bubbles, full-message speech, keyboard controls, drafts and exact resume. Support choices, typed blanks, valid own-word alternatives and free responses. Include multiple partners, lookup/help, all correction styles and responses that follow the learner's actual meaning. General conversation begins with the agreed greeting and lets the learner direct the exchange.

Ship the living study summary with this first slice: source-linked vocabulary, noun forms, verb cases, corrections and notes, plus Learn/Practise/list/star actions that return to the same conversation. Edits invalidate stale notes. Exposure, list saving and model praise do not silently mark items learned. The selected level includes lower levels; approved new-word exceptions remain scoped and visible.

**5B — Tap-recorded speech.** Add Record → Stop → editable transcript → Send inside the same threads. Preserve recognised versus edited text, allow cancellation/re-recording and typing, and speak replies locally. Save only transcripts and notes by default; retain original audio only when explicitly chosen.

**5C — Hands-free conversation.** After one Start, detect completed turns, transcribe, respond aloud and resume listening. Handle hesitation, self-repair, silence, long answers, speaker echo, headphones, interruptions and background/pause transitions. Begin with controlled alternating turns; any advertised spoken interruption of partner playback needs separate passing tests. Natural spoken correction and continuation is the default; pause-and-explain and review-afterward remain selectable.

**5D — Dialogue Coach and shared assistance.** Add Italian speaking goals, word-finding through circumlocution, progressively simpler Italian explanations, examples and supportive follow-up. Use the same service for workshop intent-to-sentence help and lesson explanations/hints. Preserve the learner's meaning and distinguish language errors from transcription problems and optional style suggestions. Validate the roommate example and equivalent unfamiliar-word situations at suitable levels.

Each slice receives language, accessibility, offline, persistence and device checks. Use the comprehensive plan's per-level evaluation corpus and quality thresholds, 100+ turn resume tests, and 30–60 minute combined sessions. A text-only or manual-recording release is an intermediate milestone; it does not complete the requested spoken experience.

## 8. Phase 6 is a continuous curriculum programme

This work starts during Phase 1 and runs alongside Phases 2–5. Assign content ownership in three bands—Foundations/A1, A2/B1 and B2/C1/C2—and rotate the available workers between authoring, infrastructure and independent review. Advanced planning and media sourcing begin early; stage publication follows prerequisites.

| Content release | Required outcome |
| --- | --- |
| **Foundations and A1** | Begin from zero with meaning and sound before testing, known vocabulary, useful everyday domains, complete required forms and supported interaction. Validate pacing with beginners. |
| **A2 and B1** | Connected past accounts, plans, routine services, independent everyday exchanges and opinions; full taught paradigms, planned retrieval and varied transfer tasks. |
| **B2** | Detailed viewpoints, argument, hypotheticals, register, richer connected language and sustained reading/listening/production. |
| **C1 and C2** | Extended authentic material, implicit meaning, nuance, difficult listening, synthesis, mediation, precise reformulation and sophisticated interaction. |

Every release includes teaching, guided and independent practice, valid alternatives, specific error explanations, reserve/repair material, delayed review, word/verb links, reference topics, audio provenance and migration mappings. Record lessons retained, repaired, merged or replaced. Deliberate familiar-context recurrence supports spacing; fresh contexts check transfer.

Automated checks and a second agent provide useful review, but cannot be described as review by a native Italian human. Arrange actual Italian educator review for the agreed editorial gates and track it separately. Obtain appropriate rights for authentic text and recordings. These are real dependencies, not assumed outcomes.

Each stage has explicit exit outcomes across reception, production, interaction and mediation. A grammar-choice pass is insufficient. Course completion is not certified CEFR proficiency; advanced AI coaching must be evaluated separately at each advertised level. Existing advanced content remains honestly labelled while replacement work proceeds.

**Result:** the complete course and supporting language catalogue are covered. A polished beginner release does not close the programme.

## 9. Phase 7 validates and releases the complete update

Validation also runs throughout development. The final pass connects the entire experience: course lesson → related word/verb case → workshop → written/spoken conversation → summary → targeted practice → delayed review → resume/export/offline reopen.

Exercise old-profile migration, manual unchecks, merge conflicts, list deletion, reset/compaction, low storage, interrupted writes/downloads, corrupted packs and background termination. Verify accessibility and viewport/keyboard behavior on the actual installed iPhone app in both themes. Retire legacy dispatchers, players and obsolete caches only after replacement coverage and imported-session compatibility are established.

For each deployable release:

1. Integrate the reviewed slice with the latest main and resolve external-team changes without overwriting unrelated work.
2. Run applicable deterministic, language, migration and browser checks; run required device gates for affected capabilities. Validate the assembled website as well as the source checkout.
3. Preserve a recoverable release and compatible data/export path. Application-code rollback must not attempt to interpret incompatible migrated data blindly.
4. Commit the reviewed release, merge/push to main within the authorised implementation scope, and wait for GitHub Pages deployment to succeed. The existing workflow already gates deployment on build and browser checks.
5. Verify the production build identity and changed routes, then test both an existing installation updating in place and a fresh installation, including offline reopening. Confirm model/content compatibility separately from the website version.
6. Report the exact commit, live URL, delivered scope, remaining scope and any measured limitations. Give update/install instructions that preserve learner data; reinstalling is not a substitute for testing the update mechanism.

The full programme is complete only when the requirements ledger has evidence for every agreed deliverable. Failed or unavailable device/editorial gates remain unresolved work; they cannot be renamed “done” to fit a release date.

## 10. Team operation and first implementation batch

Requested model configuration: the main orchestrator remains GPT-6 Astra at ultra effort; specialist subagents use **GPT-6.1 Sol at ultra effort**. The orchestrator owns shared contracts, cross-team decisions, integration, migrations and release verification.

There are currently four concurrent slots in total: the orchestrator plus three active specialists. Use all useful capacity, but treat teams as workstreams rather than inventing unlimited simultaneous workers. Nested specialists run when capacity becomes available; completed authors rotate into review of another worker's changes.

| Work period | Specialist 1 | Specialist 2 | Specialist 3 |
| --- | --- | --- | --- |
| Opening | Learning/data contracts and migration examples | Curriculum/sense/prerequisite inventory | Combined AI/speech phone trial |
| Core repairs | Grading, persistence and review | Content/morphology fixes and editorial work | Performance, offline and shared presentation |
| Conversation delivery | Conversation UI, persistence and summaries | Runtime, packaging and audio controller | Curriculum, language evaluation and independent review |
| Release verification | Migration/offline/recovery | Language/content review | Accessibility/device/performance |

Assignments have bounded file ownership and explicit interface contracts. Shared-file and schema changes are integrated sequentially; workers can develop consumers against stable interfaces while their dependencies are implemented. Each handoff includes what changed, test evidence, migration effects and unresolved issues. Authors do not approve their own language work.

The first implementation batch should produce the refreshed baseline and scope ledger, shared contracts, whole-course map and combined phone trial. Begin urgent regression fixes as soon as their contracts are settled. The first production increment is the correctness/reliability repair release; broader curriculum and conversation releases follow their own gates.

Do not promise calendar dates from the number of agents. Establish estimates after the initial inventory, phone trial and one completed lesson/unit slice reveal the real work and editorial throughput. Update estimates by workstream, distinguishing engineering time from physical-device access, media sourcing and educator review. These uncertainties affect sequencing and dates, not the agreed scope.

## 11. Scope coverage

| Comprehensive plan scope | Execution ownership |
| --- | --- |
| Navigation, design, common controls, games and feedback | Phases 2–3; continuous accessibility validation. |
| Completion, evidence, rewards, accents and review | Contracts in Phase 1; implementation/migration in Phases 2–3; every new activity thereafter. |
| Dictionary senses, morphology and reference | Phase 1 schema/inventory; Phases 2–3 engine/data repairs; Phase 6 editorial coverage. |
| Words, all verb cases and workshop | Phases 2–3 repairs/integration; Phase 5 assistance; Phase 6 full content validation. |
| Conversations, summaries and selected-item study | Phases 4–5, including all written and spoken modes. |
| Offline models, speech and Dialogue Coach | Phase 1 feasibility; Phase 4 production services; Phase 5 full delivery and per-level evaluation. |
| Zero-to-C2 curriculum and authentic media | Phase 1 whole-programme map; parallel Phase 6 releases and independent editorial gates. |
| Persistence, cloud identity, compaction, performance and offline updates | Phases 1–2 foundations; Phases 4–5 new-data integration; Phase 7 stress and release verification. |
| Legacy retirement, documentation and deployment | Incremental integration throughout; final reconciliation and live verification in Phase 7. |

All phases are planned. This roadmap records no completed application changes, model benchmarks or deployment results.
