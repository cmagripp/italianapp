# Independent review of the additive beginner lessons

Reviewed on 3 October 2026 by the unified learning/review workstream. This is an independent agent editorial review, not native educator approval or beginner calibration.

The review covered every authored word/gloss, teaching explanation, Italian example, ordinary and reserve question, accepted answer, distractor, passage, portfolio model and prerequisite list in `tools/phase6-beginner-lessons.mjs` and `tools/course-phase6-beginner.mjs`. The compiled additions comprise 24 lessons, 43 targets and 292 questions. The 68 retained baseline lessons were checked for exact object preservation; a complete independent language review of that retained baseline is still separate work.

No incorrect Italian conjugations, adjective/article forms, supplied names/numbers/dates, ordinary answer keys or register mismatches were found in the additions. Polite Lei has a named addressee; reflexive persons and the noun controlling piace/piacciono are explained; personal ho caldo/freddo is distinguished from weather fa caldo/freddo; first-day primo, lower-case months, apostrophes and the number contractions are taught. The accepted `in camera` variant is preserved. Input questions refer to complete distinct authored passages; listening transcript help and optional open responses remain assisted/ungraded. Required ordinary tested forms are modelled before assessment, and prerequisite references exist. Whole polite directions and request chunks are explicitly labelled where their internal grammar comes later.

## Changes requested

1. **Fresh repair identity:** three reserve questions repeat an earlier situation and answer exactly, while assigning another context key. Replace the reserve situations and validate semantic source identity, rather than treating new IDs alone as variation:
   - `v2-a1-home-rooms.position-2` / `.position-5`: `Il pane è ___.` / “The bread is on the table.” / `sul tavolo`.
   - `v2-a1-weather-conditions.weather-4` / `.weather-6`: `Oggi ___.` / “Today it is windy.” / `c’è vento`.
   - `v2-a1-simple-directions.direction-4` / `.direction-6`: `Gira ___.` / “Turn left.” / `a sinistra`.
   Changing response format from recognition to typing can be useful later retrieval, but it does not make that source a new transfer situation. These reserves are currently documented as fresh repair contexts.
2. **Assessed label versus optional mediation:** `v2-a1-exit-read-relay.detail` says “find and pass on” although its graded questions only find source details. Passing information on is an optional ungraded portfolio. Let the input compiler accept a narrower assessment label; retain the broader lesson outcome and practice task without granting assessed mediation competence.
3. **Assessed month breadth:** `v2-a1-calendar-read.detail` claims recognising all twelve month names, while readiness can follow two independent detail answers and several names appear only in preparation/distractors. Keep the full twelve-name teaching coverage, but narrow the assessed target label to finding the requested calendar detail/month, or add explicit evidence requirements if all twelve are to be assessed.

Re-review of the corrected source: **passed for the additive 24-lesson slice**. The three reserve contexts now use an explicit kitchen location, a windy park and a café landmark; each differs from its earlier situation. The compiler accepts a separate assessment label, and the two targets now assess finding the requested detail/date/month. The semantic duplicate validator compares normalized context/source, situation and answer. The rebuilt source and all 43 repeated-error recovery paths pass, while all 68 historical lesson objects remain exact. The requested preparation glosses for “Dopo il bar” and “al parco” are now present before assessment. This gate is independent agent editorial review only; native educator and beginner pacing gates remain pending.

## Runtime observations and verification

`node tools/test-phase6-beginner.mjs` passed: 68 historical lesson objects preserved, all 24 additions idempotent, 43 repeated-error recovery paths complete, source and assistance boundaries checked. These deterministic checks support recovery and schema integrity; they do not detect the editorial duplicate situations or wider assessed labels above.

Review-player cross-review also caught a presentation omission: a language question must retain both its Italian gap and its supplied English situation. The finite review player now displays both, includes the complete reading passage, and only grants unaided listening evidence after the exact reviewed bundled clip finishes. Chromium and WebKit each pass nine finite review checks, including decoding the real M4A, saving listening completion through reload, and rendering the original authored gap/situation together.

Remaining gates: native Italian educator review, learner timing/load calibration, human auditory review of synthetic practice clips, expanded pronunciation breadth, assessed open production/interaction/mediation, installed-device offline/persistence tests and actual delayed retention observation.
