# Plan: vocabulary inside lessons, noun forms everywhere, and the missing function-word grammar

Status: proposal for review, 1 October 2026. Nothing in this plan is implemented yet.

## 1. What the app does today (audit findings)

**Lesson vocabulary is shown, never taught or credited.** Every course lesson (241 lessons in `data/course-v2/`) opens with a `words` step: a list of glosses `{it, en, article?, plural?, note?}` with a speaker button and a Continue button. It is not graded. Of the 1,040 glosses, 3 carry a dictionary `entryId`; the rest are plain strings. The dictionary link lives in the lesson's `related` list instead, which has only 27 word links across the whole course and feeds the "Build on this lesson" cards and the Together session. By design the course never marks a word learned: `js/learning/course-v2-state.js` says so, `tools/test-course-v2-content.mjs` asserts that completions stay empty, `tests/course-v2-e2e.mjs` checks the same, and `docs/COURSE-V2-CONTRACT.md` states "Grammar does not complete words". So a learner who reads the glosses in a lesson still has to open each word separately to get it onto the learned list.

**The word lesson is a six-screen recognition path.** `#/learn/word/:id` shows a meaning card and a forms card (singular and plural with articles, gender note), then six multiple-choice screens: meaning, recall, article, plural, meaning, recall. All six correct in one session marks the word learned and awards 10 XP. The article screen asks for the definite article of the singular (or the plural for odd attempts); the plural screen asks for the bare plural (or article plus plural for invariable nouns). There is one pairs board, only when the noun has two form targets, and it is a singular → plural board, not article matching. Context and listening questions never appear. Article and plural skills do enter Review, which replays the same screens.

**Noun data is complete enough.** All 4,613 nouns have gender; 4,318 have a usable plural (3,868 distinct, 358 invariable, 92 plural-only), and 295 are marked singular-use. Article forms are derived in `js/data.js` (`article`, `withArticle`, `isPluralOnly`, `nounNumberNote`).

**Matching exists in three places**, none of which does "match the lesson's new words": the course engine's `match` question (pairs of left/right, 7 uses in the whole course, must belong to a grammar target), the word lesson's pairs board (forms of one word), and the standalone Matching game (headword to English, records no learning evidence).

**Grammar coverage of the requested topics** (full detail in the audit notes at the end):

| Topic | State | Where | Gaps |
| --- | --- | --- | --- |
| Direct object pronouns lo / la / li / le, "it" | Partly | A2 unit 7 (three lessons) + A2 placement with modals | mi / ti / ci / vi as objects never taught; no l' elision until B2; no "non lo"; attachment only after modals; participle agreement (l'ho vista) only at B2 |
| Indirect pronouns mi / ti / gli / le / ci / vi | Covered | A2 unit 8, consolidated at B1 (double pronouns) | formal Le; attaching one clitic to an infinitive |
| Articulated prepositions (alle, al, della …) | Partly | A1 "a or in + article" (al, alla, nel, nella), A2 (del, dal, sul) | allo, all', agli, ai, alle as a system; della, dello, dei, degli, delle; nello, nei, nelle, negli; sulla, sui, sulle; dalla, dai, dalle; no table lesson |
| Connectors (quindi, dunque, allora, perché, poiché …) | Partly | A1 (e, ma, perché), A2 (perché, poi, quindi), B1, B2, C1 | dunque, allora, però, invece, infatti, anche, siccome never taught; "perché = why" never drilled |
| Question words (quando, chi, che cosa, come, quanto, quale) | Weak | Chunks only (Come ti chiami, Quanto costa, dove) | no lesson has a question-word target |
| Indefinites (qualcosa, qualcuno, da qualche parte, niente, nessuno, ognuno, tutto) | Mostly missing | A2 quantity (qualche, alcuni), C2 negation scope | everything else |

The dictionary already holds the useful function words (category "Communication & function words", 378 entries): quando, chi, che cosa, perché, poiché, quindi, dunque, allora, qualcosa, qualcuno, da qualche parte, ovunque, dappertutto, and the clitics mi, ti, lo, la, ci, vi, li, le, ne. Only the reflexive `si` is missing.

## 2. Proposed update, in four parts

### Part A. Lesson vocabulary becomes a taught, credited step

1. **Link glosses to the dictionary at load time.** A new module `js/learning/course-words.js` resolves each gloss in a lesson's `words` step to a dictionary entry (article-stripped lookup through the existing sentence lookup, exact headword first, then plural and `fem` forms). No pack JSON changes, so the beginner and intermediate generators keep working. A new deterministic check `tools/test-course-words.mjs` reports coverage per level and lists unresolved glosses; the target is every gloss at Foundations, A1 and A2 resolved, and unresolved glosses elsewhere added to the dictionary in a follow-up content pass.
2. **A vocabulary drill step after the glosses.** The engine inserts a synthesised `words-check` step ("Le parole di oggi") right after the `words` step whenever at least three glosses resolve. It is one or two matching boards built from the resolved entries:
   - Board 1, meaning: Italian headword (with article for nouns) on the left, English on the right, four to six pairs; longer lists run in rounds.
   - Board 2, forms (only when the lesson introduces nouns): article to noun, mixing singular and plural rows (il → libro, i → libri, la → casa, le → case), so the learner matches the article and sees the plural at the same time.
   The boards reuse the engine's existing `match` UI and grading; mismatches are logged as they are today. The step is not a grammar target, so the lesson's target rules are untouched.
3. **Credit.** Finishing the boards records recognition evidence for each resolved word on the same skill ids the word lesson uses (`meaning`, `recall`, and for nouns `forms::article` and `forms::plural`), under a new completion policy `word-lesson-match-v1`. `journeyWordCompletion` accepts that policy when the required skills were all matched correctly in one session, which flips `isLearned` and calls `markLearned` (10 XP each, learned list grows, Review starts scheduling the word's article and plural). Words already learned are still drilled for reinforcement but earn nothing again. A mismatch on a word leaves it uncredited for that session; the lesson can be replayed or the word opened on its own.
4. **Contract and checks.** Update `docs/COURSE-V2-CONTRACT.md` ("Grammar targets never complete verb cases; the vocabulary drill completes words"), narrow the empty-completion assertions in `tools/test-course-v2-content.mjs`, `tools/test-grammar-course.mjs` and `tests/course-v2-e2e.mjs` to verb cases, and add engine fixtures for the synthesised step (resume mid-board, all-correct traversal, a learner who already knows half the words).
5. **Together session.** Unchanged in shape (grammar, one verb tense, up to three words), but the "words" part now draws from the lesson's unresolved or still-unlearned words first, so the session no longer re-teaches what the drill just credited.

### Part B. Every learned noun carries its article, singular and plural

1. **Word lesson slots for nouns become** meaning, recall, article (singular), plural with article, article (plural), recall. The plural screen always asks for the full phrase with its article ("le case"), not the bare plural. Singular-use nouns keep their "normally singular" note and skip the plural screens; plural-only nouns drill the plural article.
2. **Article matching board.** The pairs board becomes an article board for the noun's own forms plus two decoy nouns of the other gender from the same level, so matching "il" to "libro" is a real choice.
3. **Grammar check on new words.** The same rules apply to words credited by the lesson drill (Part A): a noun is only credited when its article row and plural row were matched.
4. **Review.** No new skills; article and plural are already reviewed. The review runner uses the new slot order so the plural-with-article question appears there too.

### Part C. New grammar content and the useful-words set

New lessons, written to the existing contract, with the ids and placement below. Beginner packs are generated by `tools/author-course-beginner.mjs`, so the lessons are added as generator records; B1 goes through `tools/author-course-intermediate.mjs`.

| Level | Unit | Lessons |
| --- | --- | --- |
| A1 | new unit "Ask and answer" | question words 1 (chi, che cosa / cosa, dove, quando); question words 2 (come, perché, quanto / quanta / quanti / quante, quale / quali); matching questions to answers, "perché" as why and because |
| A1 | new unit "Prepositions and articles" | a + article as a system (al, allo, all', alla, ai, agli, alle) with times (alle otto); di + article (del, dello, dell', della, dei, degli, delle) |
| A2 | extend unit 13 | in / su / da + article (nel, nello, nella, nei, negli, nelle, sul, sulla, sui, sulle, dal, dalla, dai, dalle) |
| A2 | extend unit 7 "Keep track of people and things" | mi / ti / ci / vi as direct objects; l' and "non lo"; attaching the pronoun (per vederlo, vedendolo, guardalo) |
| A2 | new unit "Someone, something, somewhere" | qualcuno / qualcosa / qualche / da qualche parte; nessuno / niente with non; everyday links (allora, però, invece, anche, infatti, dunque) |
| B1 | new unit "Agree and connect" | participle agreement after lo / la / li / le (l'ho vista, li ho visti); ognuno / tutti / tutto / ovunque / dappertutto; cause links (siccome, poiché, dato che, perciò) |

Each lesson's `words` step introduces the function words it teaches, so with Part A those words become learned through the lesson.

**Useful words.** A curated set of about 60 function words (question words, connectors, indefinites, object pronouns, time and place adverbs) in `data/useful-words.json`, each pointing at an existing dictionary entry (plus a new entry for reflexive `si`). It appears as a "Parole utili" deck in the Learn hub's Parole section and on the Words page, playable through the short-word lesson and the Matching game, and the new lessons draw their glosses from it.

### Part D. Documentation and checks

README, `docs/GRAMMAR-COURSE.md` (lesson and unit counts), the course contract, `docs/SCHEMA.md` for the useful-words file, and the audit notes. All 33 deterministic checks plus the new `test-course-words` run in CI; the course and journey browser suites gain the new paths.

## 3. Sequencing

Four rounds, each with the usual loop: build with parallel Fable subagents on disjoint files, integrate, preview on the iPhone frame, your review, push to main on your word.

1. Round 1, engine: Part A (resolution, drill step, credit, contract and checks). Visible result: open any A1 lesson, match the words, see them on the learned list.
2. Round 2, nouns: Part B.
3. Round 3, content: Part C, likely split over two reviews (A1 and A2 first, then B1 and the useful-words deck).
4. Round 4: Part D and a final audit.

## 4. Risks and decisions to confirm

1. **Audio for new units.** Every unit must have a listening passage with generated, reviewed audio (`tools/build-course-audio.py` with the Kokoro model and macOS `afconvert`; the assets check verifies hashes and the review file). This sandbox has neither the model nor `afconvert`. Options: (a) I try the pipeline here with `ffmpeg` in place of `afconvert` and the model downloaded through the proxy; (b) you run the audio build on your Mac after the content lands and I wire the manifest; (c) new lessons go into existing units only, which already have their listening passages, and the new A1 and A2 units become extensions of neighbouring units. I recommend trying (a) and falling back to (b); (c) limits the structure.
2. **Credit rule.** Proposed: a word is credited when its rows are matched correctly in the lesson drill, not only when the whole lesson is finished. Confirm.
3. **Noun strictness.** Proposed: a noun is never credited (in a lesson or on its own) without its article and plural rows. Learners who find the plural hard will fail more often; the repair screen re-teaches the form. Confirm.
4. **Unresolved glosses.** About 1,040 glosses need resolving; the check will show how many fall outside the dictionary. Those get added as entries in Round 3 rather than blocking Round 1.
5. **Content review.** `docs/GRAMMAR-COURSE.md` requires an independent cross-review of new lessons and editorial fixtures written without the answer key. The content round includes a separate reviewing subagent for that.

## 5. Audit notes (reference)

- Lesson format and engine: `docs/COURSE-V2-CONTRACT.md`; `js/learning/course-v2-engine.js` (step dispatch, `assessCourseAnswer`, match grading); `js/views/learnCourse.js` (words step, `data-course-next`, finish receipt); `js/learning/course-v2-activities.js` (word cards, match UI).
- Related vocabulary and Together session: `js/learning/grammar-course.js` `relatedVocabulary`; `js/views/courseSession.js` `buildCourseSession`.
- Learned criterion: `js/store.js` `isLearned`, `markLearned`, `setCompletion`; `js/learning/journey.js` `journeyWordCompletion`, `shortWordProgress`; `js/learning/lesson-content.js` `wordLesson`, `briefWordLesson`; `js/learning/word-questions.js` `buildShortWordQuestion`; `js/views/learnJourney.js` (markLearned on complete).
- Noun data: `data/SCHEMA.md`; `js/data.js` 113–166; `tools/test-noun-forms.mjs`; `docs/NOUN-FORMS-AUDIT-2026-09-29.md`.
- Checks: `tools/test-course-v2-content.mjs` (structure, traversal, recovery), `tools/test-course-v2-lexicon.mjs` (every Italian token glossable), `tools/test-course-v2-assets.mjs` (audio, unit count 78), `tools/test-course-v2-editorial.mjs`.
- Authoring: `tools/author-course-beginner.mjs` (Foundations, A1, A2), `tools/author-course-intermediate.mjs` (B1, B2), hand-written JSON for C1 and C2; `tools/build-course-audio.py`, `tools/review-course-audio.py`.
