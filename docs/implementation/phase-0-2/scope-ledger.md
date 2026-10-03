# Phases 0 to 2 execution ledger

Active scope: implement Phases 0, 1 and 2 of the [roadmap](../../IMPLEMENTATION-ROADMAP-2026-10-03.md), then stop for discussion. Phases 3–7 require further confirmation. This ledger records acceptance requirements, not claims of completion.

Source of product requirements: [comprehensive plan](../../PLAN-UNIFIED-LEARNING-OFFLINE-AI-2026-10-03.md), Sections 3–12. User steering on 3 October permits an iPhone 16 Pro Max simulator in place of physical-phone testing. Report the actual installed runtime and simulator/desktop measurements honestly; no simulator result establishes physical battery, thermals or microphone quality.

## Phase 0 baseline

| ID | Owner | Requirement and completion evidence | State |
| --- | --- | --- | --- |
| P0-01 | Integration | Fetch origin/main, record exact commit and current live build; reconcile intervening external work. | Verified: bd60180, deploy 37044189794 successful, live sw.js byte-identical. |
| P0-02 | Integration | Isolated codex implementation branch; preserve original untracked user files; every agreed scope mapped below. | Branch codex/parola-phases-0-2 in managed worktree; user copies remain in original checkout. |
| P0-03 | Integration | Run baseline deterministic checks and representative complete browser flows; retain commands, results and failures. | Verified baseline: 38/38 deterministic commands; 48/48 browser routes and 46/46 flows, 0 console/network errors. |
| P0-04 | Data | Synthetic old profiles cover manual all/per-case checks and unchecks, words, legacy evidence, course/workshop drafts, lists, custom entries, XP, recordings metadata and cloud identities. | 14 synthetic legacy preservation checks passed. |
| P0-05 | Data | Before migration preserve recoverable prior data; transform idempotently; validate before activation; compatible restore tested; failed preservation leaves old state active. | Staged snapshot/verify/activate implemented; focused persistence checks pass; integrated persistence, recovery and offline browser checks pass. |

## Phase 1 contracts and feasibility

All implementation packages depend on their reviewed contracts. The AI trial does not block unrelated correctness repairs.

| ID | Owner | Requirement and completion evidence | State |
| --- | --- | --- | --- |
| P1-01 | Data | Completion versus evidence, recognition/production/assistance, five core cases, manual marks, case eligibility, canonical objective aliases, resets, review identity and prospective awards specified with concrete examples. | Contract reviewed: completion/evidence/manual overrides and prospective awards; fixture suite passes. |
| P1-02 | Integration/Data | Shared strict-accent comparison and visible restoration contract, original/policy provenance, Unicode/accepted alternatives and explicit-choice/ASR distinctions. | Contract implemented in shared answer policy; 16 deterministic checks and Chromium/WebKit field/history checks pass. |
| P1-03 | Data | Durable saves/import/reset, identity, tombstones, award deduplication, compaction/merge/reset semantics and pre-migration recovery specified. | Contract reviewed; focused durable save/restore, identity, tombstone, award and replay tests pass. |
| P1-04 | Language | Stable senses, levels/constructions, content versions, noun forms, auxiliary constraints, reference links and ambiguous historical mappings specified. | Sense/construction contract and complete curriculum inventory recorded; catalogue migration remains Phase 3. |
| P1-05 | Data/AI | Future thread/participant/turn identities, draft/committed states, corrections, summary revisions, cancellation, profile boundaries, local-default retention and explicit audio opt-in specified; no production Conversations yet. | Future conversation identities, draft/commit/provenance, retention and profile contracts recorded; production deferred. |
| P1-06 | Curriculum | All 256 baseline lessons and reserve/repair/review material inventoried; retain/repair/merge/replace decisions; full Foundations–C2 outcomes/prerequisites, vocabulary/form/reference map and migration needs. | Inventory complete: 256 lessons, 3,215 steps after bounded fixes, 1,484 questions, 445 variants, 260 target repairs. Automated checks pass; human editorial approval not claimed. |
| P1-07 | AI | Executable disposable written/manual/hands-free pipeline, actual Italian ASR + dialogue model + local speech, endpointing and error/provenance checks. | Completed exploratory trial: actual local file and synthetic microphone pipelines; edited manual send and three context-bearing hands-free turns; original ASR errors retained. No production conversation service. |
| P1-08 | AI | Candidate comparison on versioned Italian cases; measured latency/resource stability, offline reopening and playback; pin versions/licenses; distinguish desktop/simulator from physical results. | Four candidates measured with pins/raw evidence; all generated on cold offline desktop reopen, all also made severe tutoring errors. Speech/cancellation/offline evidence recorded. Long-session/mobile performance remains unverified; no candidate recommended for production. |
| P1-09 | AI/Integration | Verify requested simulator/runtime availability; record actual device configuration and limitations. No faked OS version or invented measurement. | Approved tested configuration: iPhone 16 Pro Max simulator, iOS 26.5 (23F77). |
| P1-10 | Integration | Review contracts/inventory/trial; record measured platform direction or explicit unresolved decision. No automatic native/cloud substitution. | Reviewed. Production mobile runtime/model choice remains explicitly unresolved: simulator has no WebGPU adapter and desktop model quality fails the teaching gate. Current repairs proceed; no cloud/native substitution or production tutor shipped. |

## Phase 2 implementation and regression gates

| ID | Owner | Requirement and completion evidence | State |
| --- | --- | --- | --- |
| P2-01 | Integration | Every retained typed activity honors Strict accents. Off accepts accent-only differences and visibly restores the valid form after submission; on grades spelling; preserve source input/policy and accepted alternatives. | Shared policy implemented across games, current/legacy lessons and placement; workshop integration and full-app passes complete. |
| P2-02 | Integration | Choice meaning contrasts remain assessed; ambiguous free text and names are not blindly accented; recognizer spelling is not typed accent evidence. | Explicit choices, exact alternatives, ambiguity, NFC and original provenance covered by 16 policy tests. |
| P2-03 | Workshop | Wrong Italian morphology/agreement cannot be silently repaired and credited; assistance remains explicit. | Explicit assistance and input-form validation implemented; focused engine and browser regressions pass. |
| P2-04 | Workshop | Valid auxiliary + participle, ho/sto/sono wrappers, multiword time phrases, predicate agreement and alternative expressions; meaning/construction-aware slots; English gloss and reaction continuity. | Bounded construction repairs validated across 21 lessons/168 activities for both genders (376 answers); focused compound, agreement, time-phrase and alternative tests pass. Broader semantics remain later scope. |
| P2-05 | Workshop | Typed/free-entry/accent drafts persist after input, reload, pause and disposal; disposed callbacks cannot save into another session. | Saved drafts, drill drafts and profile/session callbacks validated in seven focused browser checks. |
| P2-06 | Data | saveNow/import/reset report real failure; preserve unsaved recoverable work; both IndexedDB and fallback failure tested. | Implemented: failed saves reject, unsaved state stays exportable, staged restore verified. 17 focused persistence checks pass; banner tested in Chromium/WebKit. |
| P2-07 | Data | Profile/cloud identity cannot merge different learners accidentally; explicit association and stale callback guards. | Stable learner identity and guarded cloud operations implemented; focused identity conflict/late-response checks pass. |
| P2-08 | Data | List and membership deletion tombstones survive stale backup and cross-device merge; custom deletions/reset rules preserved. | List/membership tombstones and deliberate re-add merging implemented and regression tested. |
| P2-09 | Data | Stable prospective award identities preserve legitimate concurrent awards without duplication; old XP/checkmarks remain intact. | Prospective award ledger with historical baseline implemented; concurrent/deduplicated/reset tests pass. |
| P2-10 | Performance/Data | Validated append and incremental objective/session indexes remove whole-lifetime normalization from each answer. Semantics match replay across representative histories. | Incremental indexes/append implemented; replay equivalence tests and 1k/10k/50k desktop measurements recorded. Independent fork-isolation regression fixed; 1k/10k/50k replay/checkpoint/merge checks pass. Immutable event/map copying remains O(n), explicitly measured. |
| P2-11 | Performance/Data | Safe compaction/snapshots tested against epoch resets, manual unchecks, old backups, event conflicts and multi-device merges; no arbitrary loss of provenance. | Verified lossless replay checkpoint implemented and tested; retains events/fences and makes no storage-reduction claim. Destructive compaction deferred until replica/backup acknowledgment is safe. |
| P2-12 | Performance | Compact startup data; large tables/course stages lazy; remove eager vocabulary attachment; direct current-player routes with legacy compatibility. | Compact indexes and selected-stage/lesson loading implemented; exact completion descriptor equivalence checked for all 8,143 entries. Fresh Home source requests fall 9.05→5.12 MB; full 3.46 MB dictionary retained. Direct current and explicit legacy routes pass. |
| P2-13 | Performance | Missing/truncated course pack isolated; other stages and Home remain usable; visible retry/recovery. | Missing/truncated stage and retry checks pass; another stage, Home drafts and manual completion fences remain usable. |
| P2-14 | Curriculum | Correct verified near/far alternatives, veduto and other valid answers, pizza/casa explanations, ce/ne functions, contextual models and malformed spoken strings. | Bounded reviewed fixes applied to source authors and all seven packs; regeneration, 256-lesson traversal and 781 single-error paths pass. |
| P2-15 | Curriculum | Teach required vuole/deve, plural/person forms and relevant paradigms before main/reserve/repair assessment; no unannounced prerequisite jumps. | 19 complete person/form teaching models added before first relevant checks; prerequisite fixtures pass. |
| P2-16 | Curriculum | Error-specific repairs cover actual facets such as farewell, feminine elision and negation; advanced prerequisites bridge prior stages. | Per-facet repair rendering and authored repairs/advanced bridges implemented; fixtures and error paths pass. |
| P2-17 | Integration | Home/Learn resume label and destination agree for existing lesson types; avoid new broad navigation redesign. | Learn hero uses the resumed title/subtitle/link; Home preserves exact session ID. Integration browser regression passes. |
| P2-18 | Integration/Workshop | Retire misleading learner-facing fit verdicts; actual optional assistant availability/lifecycle accurately described; release resources safely. | Misleading fit verdicts removed; optional availability described accurately; 20 assistant guard checks include release during initial adapter probing. |
| P2-19 | Integration | Feedback/toasts do not obscure Continue; reveal state, language annotations, persistent announcements, headings, zoom and enlarged-text behavior improved and verified. | Zoom enabled; persistent answer/storage announcements; reveal state/language labels; top-positioned lesson toasts; enlarged-text/reduced-height Continue and toast checks pass in Chromium; the same seven checks pass in WebKit. |
| P2-20 | Offline | Content-hashed update reuses unchanged assets and activates atomically; interrupted update preserves prior usable build. | Exact per-asset SHA-256 verification/reuse and atomic activation implemented; real update/reuse/corruption/interruption browser checks pass. |
| P2-21 | Offline | Lazy-loaded installed lessons—including first visits—remain available offline; missing/corrupt assets give recovery; no silent offline regression. | All existing course packs remain installed atomically; offline first lesson and exact-feedback resume checks pass. Rechecked after lazy-loader integration: all seven stages open offline; draft/feedback and migration checks pass. |
| P2-22 | Offline | Required fonts/runtime assets self-hosted and deliberately cached; optional packs kept separate; no accidental network prerequisite after installation. | Fonts self-hosted with licenses; existing optional WebLLM runtime pinned/self-hosted in separate retained cache. Cold offline runtime import, cache integrity, reuse and interrupted-update browser checks pass. |
| P2-23 | Integration | Applicable deterministic, regression, browser and simulator checks on integrated output; compare performance reproducibly; preserve UI/progress contracts. | Passed locally: 46 deterministic suites/commands, all 24 Chromium suites (including documented fixture retries), four WebKit suites, 48 routes/46 flows, packaged-site subset, simulator UI. Exact evidence in integrated-validation.json and linked reports. |
| P2-24 | Integration | Reviewed first repair release committed/pushed, Pages deployment succeeds, live identity and existing/fresh installation update/offline behavior verified. Report exact release and unresolved limitations. | Local release stamped and assembled; publication/verification are the final release gate and are reported with exact commit and deployment in the task. This source ledger does not pre-claim a successful deployment. |

## Later scope retained but not authorised for implementation yet

The following work remains in the full plan. Phase 0/1 contracts and inventory may describe it; implementation stops after Phase 2.

| Plan sections | Later work package and acceptance scope | Phase / owner |
| --- | --- | --- |
| 3 | Shared daily plan; Home/Learn/Course/Play/Me roles; exact cross-surface continuation; scope/stage/practice distinction; settings sheet. | 3 / Product |
| 3, 10 | Shared lesson shell, dropdowns, back/pause, stable progress, centered rails, fixed reachable actions, viewport and keyboard; preserve bespoke design. | 3 / UI |
| 4 | Canonical grouped review across games/lessons, exact overdue target reconciliation, supported repair, prospective reward balance. | 3 / Learning |
| 4–5 | Short non-writing word lessons, five-case verb completion, per-case/manual controls, varied short visits, targeted repair and voluntary continuation. | 3 / Learning |
| 5, 10 | Full verb catalogue: formal Lei, participles/gerunds, current-verb progressive, aspect contrasts, accepted auxiliaries and morphology, simple/progressive mixed review. | 3, 6 / Language |
| 5, 10 | Sense-aware dictionary/reference migration, noun-phrase articles/plurals, accepted irregular explanations, missing common verbs and reference topics; game alternatives. | 3, 6 / Language |
| 5 | Complete zero–C2 rewrite: teach-before-test, everyday lexical breadth, listening/reading/production/interaction/mediation, transfer, appropriate authentic licensed audio. | 6 / Curriculum |
| 5, 12 | Independent language review, actual educator approval and learner trials; CEFR completion distinct from certification; advanced coverage documented. | 6–7 / Editorial |
| 6 | Cohesive workshop assistance versus assessment; shared AI hints, explanations, contextual practice and intent-to-sentence help. | 3, 5 / Workshop |
| 7 | Saved conversation inbox, name/agreement/level/support/topic/register/participants setup; mixed typed/choice/cloze/free response; keyboard controls and exact drafts/resume. | 5 / Conversations |
| 7 | Dynamic meaning-responsive multi-participant dialogue; level includes lower levels; constrained new-word exceptions; help/lookup with noun/verb forms. | 5 / Conversations |
| 7 | Manual speech, foreground hands-free turns, natural recast default, optional pause/explain or later corrections, microphone lifecycle/echo/interruption handling. | 5 / Speech |
| 7 | Italian Dialogue Coach, word-finding, progressively simpler explanations, optional explicit translation, new-word learning without compulsory lesson interruption. | 5 / Coach |
| 7 | Living source-linked summaries of vocabulary/forms/corrections; selected drills/learn/list/star; edits invalidate notes; correct evidence and completion. | 5 / Learning |
| 7–9 | Transcript/notes saved by default, raw audio explicit opt-in, local profiles, optional export/delete, no automatic cloud transcript/inference fallback. | 4–5 / Data |
| 8 | Shared cancellable AI service, bounded context/history retrieval, level/construction/rule validation, uncertainty handling and generated-assessment safeguards. | 4 / AI |
| 9 | Production pack manifest/hashes/runtime/license/hosting, guided install/repair/remove, compatibility/rollback, separate text/speech readiness. | 4 / Offline |
| 10–11 | Module/UI boundaries, CSS ownership, typed session schemas, incremental legacy retirement, maintainable build/check/author tools. | 3–7 / Integration |
| 12 | Full per-level dialogue/validity corpus; 100+ turn resume; 30–60 minute speech sessions; interrupted writes/downloads; offline cold reopens; all modes and summary learning actions. | 4–7 / QA |
| 12 | Whole-programme migration/accessibility/recovery verification, exact live release, compatible export/rollback and honest remaining-scope report. | 7 / Integration |

## Evidence handling

Tests are evidence only for the behavior they actually assert. Green traversal is not linguistic approval; a model response is not proof of correct Italian; a simulator run is not a physical-phone benchmark. Record commands, build IDs, runtime versions, sample inputs and failure reasons alongside each completed item. Update this ledger as work lands, and do not mark the active goal complete while any Phase 0–2 requirement is missing or unverified.
