# Everyday Italian grammar course

The course is an authored, offline curriculum. Grammar evidence is distinct from dictionary completion; incidental nouns and verbs never become learned because they appeared in a grammar question.

## Content

The initial release includes 129 lessons and 534 authored exercises across all six levels. The level-specific coverage notes document the teaching sequence and Italian reference sources.

`data/grammar-course/{A1,A2,B1,B2,C1,C2}.json` contains level → unit → lesson → objective records. Every objective has short teaching cards and at least four authored exercise variants. Questions support choice, matching, token order, and bounded written answers. All visible Italian context and speech must be natural Italian. English setups belong in prompt/translation. Sources and coverage notes accompany the level files.

Stable lesson/objective/question IDs are durable references. Editorial updates should preserve them; genuinely different objectives need new IDs. Breaking lesson structures require a content version increase. No runtime AI service or sentence substitution is used.

Run `node tools/test-grammar-course.mjs` to validate the full graph, dictionary links, exercise mechanics, and actual completion of every lesson. Run `PLAYWRIGHT_DIR=/path/to/tools node tests/grammar-course-e2e.mjs` for integrated mobile behavior.

## Evidence and review

Learning schema v4 preserves the v3 word/verb fields and adds `kind: grammar`, `policy: grammar-v1`, a content version, and a grammar phase to events. Sessions reuse the existing saved-session map under `g:<lessonId>|lesson` and `g:<lessonId>|review`; their grammar state keeps the question, shuffled controls, draft, feedback, and read-only history.

Two first-attempt unassisted successes in different contexts, separated by another activity, establish an objective. Teaching, hint-assisted answers, pair corrections, and revealed answers do not qualify. A wrong answer clears pending confirmations, gives targeted teaching, and returns to a different supported example. Completion remains historical after a later review lapse; spacing still responds to the lapse.

Only completed objectives enter the shared Review queue. Vocabulary scope does not hide learned grammar. Grammar completion does not write dictionary completion records or earn a whole-word/verb completion bonus. Existing event XP, reset epochs, deterministic merging, profile isolation, backup and JSONB cloud storage are retained. Old clients guard against newer learning versions. Replay respects session answer order even after an offline device clock moves backward. Immediate retries and assisted answers cannot inflate the review interval; a due clean repair can reschedule a lapsed objective without claiming durable recall.

## Navigation

`#/learn` keeps Resume, then My Course, Grammar, Vocabulary, Review, and Verb Lab. `#/course` shows the selected level and opens any lesson without a hard lock. Course level is a learning preference independent of vocabulary scope.

`#/learn/grammar/:id` starts/resumes a lesson. `?mode=review&objective=:id` focuses an eligible objective. `#/learn/session?start=together|grammar|verbs|words` builds a bounded session and stores its selected items. `#/learn/session` returns to that session. Each transition is explicit; skipping keeps the material unfinished. New sessions canonicalize their URL so a reload resumes the saved selection and skips. Learn surfaces a saved session, and related vocabulary provides a return to the saved grammar recap.

Existing reference URLs remain stable. Review and Verb Lab retain their visual layouts. Grammar lessons use the established full-height mobile viewport and feedback components, with internal content scrolling and persistent bottom actions.

## Release checks

The grammar course, durability, lexicon, browser, and real-service-worker offline suites run alongside the existing learning, completion, lookup, SQL-storage, and mobile layout checks. The service-worker release precaches all six levels. Updating retains existing vocabulary completion, review evidence, starred words, XP, and drafts; grammar evidence adds no separate database schema requirement.
