# Everyday Italian grammar course

Version 2 replaces the recommended course with a taught sequence from absolute beginnings through advanced C2-oriented work. It implements [the approved plan](ZERO-TO-C2-COURSE-PLAN.md); [the authoring contract](COURSE-V2-CONTRACT.md) describes the data and evidence rules. Lesson completion records course work, not a certified CEFR level.

## Curriculum and lesson flow

| Stage | Units | Short lessons |
| --- | ---: | ---: |
| Foundations | 3 | 8 |
| A1 | 12 | 55 |
| A2 | 14 | 51 |
| B1 | 12 | 38 |
| B2 | 13 | 41 |
| C1 | 12 | 24 |
| C2 | 12 | 24 |
| Total | 78 | 241 |

`data/course-v2/{Foundations,A1,A2,B1,B2,C1,C2}.json` contains explicit lesson sequences. Each unit includes reading, listening and a response with a model and self-review criteria. Each lesson prepares necessary words/chunks, drills the ones that are dictionary words on the “Le parole di oggi” boards, introduces the pattern, offers supported practice, checks fresh contexts, and applies the language. Questions use choice, matching, ordered tokens and bounded writing. Early pronunciation lessons distinguish written-pattern recognition from unassessed oral practice. Later work includes source interpretation, uncertainty, register, editing and mediation.

The former “soft/hard c → unfamiliar sentence” jump is split into meaning-first steps. `il chilo` and its meaning/sound are introduced before the spelling choice; the longer shopping sentence is a contextual application. Separate A1 lessons revisit vowels, stress, accents, silent h, doubled consonants, intonation, g/gh, sc/sch and gn/gli with supplied vocabulary.

The vocabulary drill is synthesised at runtime, never authored. `js/learning/course-words.js` resolves each gloss of a lesson's `words` step to a dictionary entry (a leading article is stripped; exact headword first, then plural and feminine forms; verbs are listed but never drilled). When at least three glosses resolve to words, `words-check` boards follow the glosses before the teaching: match each word to its meaning, then the same pairs from the English, then the article to its noun with singular and plural rows for nouns whose article is known. A board holds up to six pairs; longer lists run in rounds. A correct match speaks the Italian side; a mismatch is shown and counted. The boards are not grammar targets, so nothing is repaired or deferred, and Continue appears once every pair is matched. The finish screen lists the lesson's words with a tick for the learned ones, and the Together session's word part draws first on the lesson's words that are not yet learned.

Every target has named facets, supported examples, explicit correct-answer explanations and fresh repair variants. A wrong answer opens teaching for that target, supported practice and a different check. Hints, exposed answers, transcript/translation use and immediate retries do not certify independent evidence. Repeated unresolved errors need two separated successes; a single slip needs a fresh discriminating success. Correct work in other facets is retained. Exhausted examples offer a break or an explicit skip instead of an endless loop.

Continue is always explicit. Back shows earlier work read-only. Optional prerequisite links retain a return to the interrupted lesson. Pause, typed drafts, chosen tokens, matched pairs and feedback survive reloads. The established full-height lesson shell keeps page scrolling disabled and bottom feedback/actions visible; long content scrolls internally. Italian sentence tokens open the shared word inspector with available noun and verb forms.

## Evidence, placement and review

Learning schema v5 preserves v3/v4 vocabulary, verb cases, manual completion, XP, lists, legacy grammar evidence and saved sessions. New events use `policy: grammar-v2`, stable submission IDs, target facets, modality and assistance. Each drill match records one recognition event for its row under `policy: journey-v1` with `wordPolicy: word-lesson-match-v1`, on the same meaning, recall, article and plural skills as the short word lesson. `course-v2-state.js` replays this evidence deterministically. `course-v2-engine.js` chooses eligible authored checks; it does not generate sentences at runtime.

Independent checks must cover each target’s facets, use distinct contexts and be separated by another activity (or a later session). Production is required only for targets explicitly authored that way. A finish receipt preserves historical lesson completion after a later lapse, while the lapse still changes review scheduling. Only demonstrated targets enter Review. A drilled word is marked learned (10 XP, as its own word lesson would) when all of its rows were matched within one lesson session with no mismatch on that word; a mismatched word is listed under “Look again” with a link to its word lesson and earns nothing until a later replay, and a word already learned is drilled again without further credit. Grammar targets never complete verb cases; the vocabulary drill completes words.

The optional starting-point check is conservative, uses multiple samples per stage, and awards no completion or XP. It estimates a useful grammar/reading entry point, not speaking ability or a CEFR level. The course profile separates grammar, reading and listening checks from saved writing/mediation, personal recordings and interaction that has not been independently assessed.

Open responses are ungraded: learners can compare a model, tick specific reflection criteria, and retain their work. Free writing, pronunciation, speech and real conversation are not automatically certified. Unrecognized answers outside a tightly bounded exercise are left ungraded rather than arbitrarily marked wrong.

## Audio, local work and offline updates

`data/course-v2/audio.json` identifies bundled audio by stable source ID and content hash. Synthetic Italian practice voices are labeled as synthetic and attributed to the Apache-2.0 Kokoro model. Two literary excerpts use attributed public-domain LibriVox recordings, with source/transcript details in `recorded-sources.json` and `recorded-audio.json`. Pack-level references include the Council of Europe, Italian certification syllabi and Italian linguistic reference works.

`tools/build-course-audio.py` is an authoring tool, not a runtime dependency. It needs Kokoro ONNX v1.0/voices, kokoro-onnx 0.6.1, misaki-fork 0.9.6 and macOS `afconvert` or `ffmpeg` (`--unit <id>` limits a build to given units; untouched units keep their recorded assets). Generated AAC files are committed; no model download or paid service is required in the app. `tools/review-course-audio.py` compares the clips with an independent Whisper transcription and records its method/results in `audio-review.json`. This automated intelligibility check is not a native-speaker pronunciation rating. Listening credit requires a validated asset and completed playback without a transcript.

The lesson information menu downloads/removes audio by unit. Audio has its own cache, survives application upgrades, and supports byte-range playback offline. All seven text course packs and the legacy packs are installed atomically with the application shell. A failed update keeps the previous complete version usable. Every release that changes shell or course data must re-stamp `sw.js` (`node tools/stamp-sw.mjs`); `tools/check-shell.mjs` fails when the stamp is stale.

Optional microphone responses stay in a separate on-device IndexedDB store, scoped by profile and reset epoch. They are not uploaded or included as audio bytes in a normal JSON/cloud backup. Use the recording’s Save recording action to keep a copy; written lesson work can be exported from the information menu. Resetting progress or deleting a profile removes its recordings. WebKit uses ArrayBuffer storage to avoid Blob serialization failures.

## Compatibility and navigation

- `#/learn` retains Resume, My Course, Grammar, Vocabulary, Review and Verb Lab.
- `#/course` shows the selected stage and allows any lesson without a hard lock; new learners default to Foundations.
- `#/learn/grammar/:id` dispatches to the new or legacy player by content version.
- `#/course/placement` offers the optional starting-point check.
- Existing combined sessions, dictionary lesson returns, old grammar routes and due reviews remain valid.

The original 129 lessons remain in `data/grammar-course/`. `legacy-map.json` records a migration decision for every one. Earlier work remains accessible and earns no invented credit in the newly separated targets. No new cloud SQL migration is needed; existing JSONB learning storage carries the v5 data. Older clients retain the guard against writing a newer learning schema.

## Editorial review and release checks

Content ownership was divided by level and independently cross-reviewed: Foundations/A1 by the intermediate reviewer, A2 by the intermediate reviewer/root, B1/B2 by the beginner reviewer, and C1/C2 by the intermediate reviewer/root. Corrections included unfamiliar grammar used too early, ambiguous speaker gender, legitimate indicative/past alternatives, incoherent exchanges, answer-bearing portfolio models before checks, source-answer leakage and insufficient repair variants. Independent advanced fixtures test these distinctions rather than copying the author’s answer keys.

Required Node gates validate the curriculum graph, unit modalities, word lookup coverage, sources/assets, legacy decisions, actual completion of every lesson and every authored single-error path (traversed over the raw lesson JSON, so grammar targets alone complete no verb case or word), and the vocabulary drill (`tools/test-course-words.mjs`: every synthesised board is well formed with objective ids taken from the word lesson, step ids are unique, lessons with fewer than three resolved words get no boards, and a per-level coverage table of resolved and unresolved glosses with a floor for Foundations–A2). Separate engine/durability fixtures cover fresh evidence, repeated errors, production, assistance, review lapses, profile merges, finish receipts, saved work and resets. The existing word/verb/review suites and a real PostgreSQL-compatible JSONB round trip remain in CI.

The new player is exercised in Chromium and WebKit: teaching-first order, repair, read-only history, reloads, matching, portfolios, real audio playback, translation/transcript assistance, placement, prerequisite detours and compact/large phone layouts. A real service-worker suite verifies failed/successful upgrades, seven-stage offline navigation, downloaded audio ranges, and both old/new offline drafts/feedback. Emulated device testing does not replace a physical iPhone check.

Useful commands:

```sh
node tools/build-course-map.mjs
node tools/test-course-v2-content.mjs --recovery
node tools/test-course-v2-engine.mjs
node tools/test-course-v2-durability.mjs
node tools/test-course-v2-assets.mjs
node tools/test-course-v2-lexicon.mjs
node tools/test-course-v2-editorial.mjs
node tools/test-course-words.mjs
PLAYWRIGHT_DIR=/path/to/tools node tests/course-v2-e2e.mjs
COURSE_BROWSER=webkit PLAYWRIGHT_DIR=/path/to/tools node tests/course-v2-e2e.mjs
PLAYWRIGHT_DIR=/path/to/tools node tests/grammar-offline-e2e.mjs
```
