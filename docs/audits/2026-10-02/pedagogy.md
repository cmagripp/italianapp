# Parola — pedagogy, learning model and progression audit

Branch `claude/dreamy-darwin-fqjhm8`, commit `bd60180`, 2 October 2026. Read-only review of the code plus Node simulations against the app's own pure modules (`scratchpad/audit2/pedagogy/*.mjs`, outputs in `out-*.txt`). Every line reference is to the file at this commit. Claims that come from reasoning rather than code or a run are marked **inference**.

## 1. Verdict

Parola now contains a careful, honest evidence model for *verbs* (per-person skills, unaided typed recall, spacing inside the lesson, repair that re-teaches, SM-2 scheduling per skill) and a clean authored *course* engine with facets, repair variants and deferral. Those two parts are pedagogically defensible. What is not yet one system is everything around them:

- **"Learned" means four different things.** A word becomes "learned" after 6 multiple-choice taps (word lesson), after 2–4 matching taps on a course board, after 3 workshop drills that may each be answered wrongly first, or never through games — and in every one of those paths the learning model itself says the word is only `practicing` (no production, no spacing, no retention). The store flag, the model state and the UI tick disagree by design (§3, C1).
- **Review is a per-skill list that cannot be worked through.** Every word enrols 2–4 separately scheduled skills, Home shows the skill count as "to review" (4× the number of words), and reviewing a word replays its whole six-screen recognition lesson. The 30-day simulation shows the due list growing without bound even for a learner who reviews every morning (§2.3, C2).
- **Words never leave recognition.** No path in the current UI asks for a typed word, so no word skill can ever become `ready` or `remembered`; the SM-2 ladder for words advances only at quality 3, so intervals grow slowly (8h → 2d → 3d → 4d → 6d) and the queue is dominated by re-recognition of words the learner already knows (§2.3, H1).
- **XP rewards the wrong things.** Matching four words on a board is worth 40 XP in about a minute; a 7-minute course grammar lesson is worth about 6 XP; a 15-minute verb chapter with 32 typed recalls is worth 76 XP (§2.4, H3).
- **Levels and streaks measure nothing pedagogical.** The Livelli ribbon is `learned / dictionary entries at that CEFR level` (A1 = n/930); "Current level" is a cosmetic goal; the streak counts days the app was opened (§3, M3, M4).
- **Cross-module scheduling does not exist.** The course, verb lessons, word lessons, workshop, games and review each keep their own queue; the only bridges are the three-part "Together" session and 285 `related` links. Nothing prevents a learner from learning 10 new words a day while 260 words are overdue (§3, H4).

The verb-lesson engine and the course engine should become the backbone; word learning, the board credit, the workshop drills and games should feed the same per-skill model under one credit rule, one review scheduler and one daily plan (§5).

## 2. Simulation results

All runs: `node sim-*.mjs` in this folder; they import `/home/user/italianapp/js/...` directly and never write to the repo.

### 2.1 Answers needed for a word to become "learned" (`sim-learned-paths.mjs` → `out-learned-paths.txt`)

| Path | What the learner does | Events recorded | Model state afterwards | Store/UI state | XP |
|---|---|---|---|---|---|
| (a) Word lesson `#/learn/word/:id` | 2 teaching cards, then **6 multiple-choice screens** (noun: meaning, recall, article, plural-with-article, article board with 2 decoys, recall; `lesson-content.js:490-506`). One wrong answer adds a repair card and one re-ask (7 screens). | 6 screen events + board rows, all `mode:'recognition'`, `wordPolicy:'word-short-v1'` | every skill `practicing`, 0 independent, due +8h | `journeyWordCompletion` → complete (`journey.js:794`), `markLearned` → tick, learned list, +1 "new word" | 6–8 (2 per unassisted MC, 1 for the board) **+10** |
| (b) Course board *Le parole di oggi* | **2 to 4 correct matches** (meaning, recall, article, plural rows; `course-words.js:309-313`), the last match on each board being forced (one pair left). Any mismatch on that word → no credit this session. | 2–4 events `wordPolicy:'word-lesson-match-v1'`, `assistance:['matching']`, xp 0 | every skill `practicing`, 1 attempt each, due +8h | complete `source:'course'` (`journey.js:796-797`), `markLearned` (`learnCourse.js:142-147`) | **10** |
| (c) Workshop free-entry drill | **3 drills** (meaning MC, recall MC, type with article). A miss shows the answer and the same drill repeats once; a hit on the repeat counts as right (`labFrasiLesson.js:379-383`). So 3 right out of up to 6 attempts, with the answer shown in between. | 3 events `wordPolicy:'word-lab-drill-v1'`, forced `activityKind:'guided'` (`model.js:106`) | `practicing`; `journeyWordCompletion` = **false** (policy not accepted, `journey.js:781,788`) | view calls `store.markLearned` directly (`labFrasiLesson.js:359`); no completion record is written because journey events exist (`store.js:467`), so `isLearned` falls back to `item.learned` (`store.js:508`) | 6 **+10** (+15 per workshop lesson) |
| (d) Games (quiz, type-it, conj-drill… through `runDrill`) | any number of answers | `recordAnswer` on the legacy item SRS + `recordLearningAttempt` with `source:'game'` on the *curriculum* objective id (`w:x::word::recall`, `questions.js:423-442`), not the lesson's (`w:x::lesson::meaning::recall`) | 6 unassisted typed answers in 6 sessions → still `practicing`: one game type has one `variantId` forever, so `variantCount` never reaches 2 (`model.js:368`) | never `markLearned`; unlearned entries are dropped from review (`integration.js:130`) | 2–3 per correct + 10 for a perfect run |

Consistency check: (a), (b) and (c) all end in the same place (tick, 10 XP, four `practicing` skills due in 8 h) for very different amounts and kinds of evidence; (c) does not even satisfy the app's own completion rule. The store's `learned` and the model's `ready` are different concepts and the UI shows only the former (a tick, "Learned", the learned list, the level rings); the model's `status` is shown nowhere in the word UI. Nine hours after a board, all 15 skills of the four words are due at once (run (b)).

### 2.2 Verb lesson length (`sim-verb-lessons.mjs` → `out-verb-lessons.txt`)

All-correct path, one chapter at a time; minutes are an estimate (teach 25 s, MC 8 s, letters 20 s, pairs 30 s, typed 18 s, repair 15 s) — **inference**. "indep" = unaided typed production events that count as evidence.

| verb | chapter | teach cards | questions | mc / letters / pairs / typed | indep | targets | ≈ min |
|---|---|---|---|---|---|---|---|
| parlare (regular, with progressive spec) | present | 6 | 42 | 5 / 2 / 3 / 32 | 32 | 16 | 15 |
| | past | 5 | 21 | 2 / 1 / 2 / 16 | 14 | 7 | 8.5 |
| | background (imperfetto) | 6 | 42 | 5 / 2 / 3 / 32 | 32 | 16 | 15 |
| | future | 4 | 19 | 2 / 1 / 2 / 14 | 14 | 7 | 7.5 |
| | condizionale | 3 | 19 | 2 / 1 / 2 / 14 | 14 | 7 | 7 |
| | mixed (optional) | 1 | 21 | 4 / 3 / 0 / 14 | 14 | 7 | 6 |
| | **all five + mixed** | | **164** | | | | **≈ 59** |
| dormire, andare, fare | identical shape to parlare | | 164 | | | | ≈ 59 |
| essere, avere (no progressive) | present / background | 5 | 23 | 2 / 3 / 2 / 16 | 16 | 8 | 9 |
| | **all five + mixed** | | **124** | | | | **≈ 46** |

Observations backed by the run:
- Teaching is ~12 % of screens; retrieval dominates. In the present/background chapters of a verb with a progressive policy there are **32 typed answers in one sitting** (16 targets × 2 unaided recalls). That is the acceptance spec's rule (two per person, `TAUGHT-LESSON-SPEC.md` §4) applied to 6 persons + formal + 6 progressive persons + progressive formal + 2 final-review targets.
- Irregularity does not change the length: essere/avere are *shorter* (no progressive targets); andare/fare are the same as parlare. The lesson adapts to the verb's *spec*, not to its difficulty (`lesson-content.js:291-349`).
- One wrong typed answer per chapter costs 1 repair card + 1 extra question (+0.3–0.7 min). Repair is cheap and re-teaches the right card (`learnJourney.js:669-698`).
- Spacing: everything is one session. The two unaided recalls of a target are separated by ≥ 1 intervening activity (`model.js:298`, `evidenceGap = 2` for verbs). After the chapter, every target is `ready`, SM-2 `reps 1`, `due +8h`, `remembered false`. Retention is only checked if the learner later opens Review (§2.3).
- XP (`xp-verb.mjs`): parlare 76/37/76/33/33 per chapter + 30 = 285; essere 39/37/39/33/33 + 30 = 211.

### 2.3 Thirty days of review (`sim-review-30d.mjs` → `out-review-30d-{A,B,C}.txt`, `out-review-30d-A-cap100000.txt`)

Model: a learner learns 10 new A1 words every day at 09:00 and, before that, reviews what `dueSkills(store)` lists (the real `integration.js` function against a fake store shaped like `tools/test-learning-integration.mjs`). A word review is what the app does: `practiceHref(entry, objectiveId, 'review')` opens the short word lesson again (`journey.js:400`, `upgradeShortWordSession` applies in review mode too), so one session re-asks all of the word's skills.

Variant A (word lessons), review list capped at `dailyReviews = 40` rows as the Review page shows (`review.js:92`):

| day | eligible skills | due skills | due **words** | sessions played | screens | ≈ min | words learned |
|---|---|---|---|---|---|---|---|
| 1 | 40 | 40 | 10 | 10 | 120 | 40 | 20 |
| 5 | 200 | 120 | 30 | 10 | 120 | 40 | 60 |
| 10 | 362 | 282 | 80 | 12 | 132 | 41 | 110 |
| 20 | 784 | 696 | 180 | 12 | 132 | 36 | 210 |
| 29 | 998 | **898** | **263** | 13 | 138 | 44 | 300 |

- The 40-row cap is 10 words (each word is four rows), so the learner can clear only as many words as they add; the overdue list grows linearly to 263 words / 898 skills. Home's "to review" counter shows the **skill** count (`home.js:107-108`): 898, not 263.
- End state: 1 036 skills, **all `practicing`**, 0 `ready`, 0 `remembered`. SM-2 reps distribution: reps1 = 407, reps2 = 245, reps3 = 158, reps4 = 140, reps5 = 32, reps6 = 4; intervals ≤ 6 days for 99 % of skills. The first word learned was reviewed 4 times in 30 days; each review was the full 6-screen lesson.
- Variant B (course boards instead of lessons) is identical in queue shape (782 due skills / 254 words on day 29) at half the time cost, because the board credits in ~4 taps what the lesson credits in 6 screens.

Why the queue cannot drain: words only ever produce recognition events, and the scheduler advances a recognition session at quality 3 (`model.js:361-363`), which SM-2 shortens (`srs.js:19`: ×0.7) and which lowers the ease factor each time (`srs.js:20`). So the typical word is re-asked at 8 h, 2 d, 3 d, 4 d, 6 d, 8 d… and every re-ask costs 6 screens. Meanwhile nothing a learner does in the course, workshop or games touches these schedules unless the question happens to land on the same objective id (games use a different id space, §2.1(d)).

Does review draw from all modules equally? No: course targets enter Review through `grammarReviewSkills` (`integration.js:118`, only `ready` targets); verbs through chapter completion (`integration.js:63-73`); words through completion (`integration.js:73`); workshop drills through the same word objective ids as the word lesson; games through the curriculum ids. There is no weighting or interleaving — `dueSkills` is one list sorted by due time (`integration.js:120-122`) and the Review page simply lists it.

#### 2.3.1 Uncapped review and verbs

(see the appendix at the end of this file)

### 2.4 XP per activity (code + runs)

| Activity | Time (≈) | XP | Source |
|---|---|---|---|
| Course board, 4 words matched | 1 min | 40 (10 per word) | `store.js:487`, events xp 0 (`course-v2-engine.js:306`) |
| Word lesson | 1.5 min | 16–18 (6–8 + 10) | run 2.1 |
| Workshop lesson (8 activities) + 2 new words via drills | 6–8 min | 15 + 2×16 | `store.js:593`, drills 2 XP each |
| Course grammar lesson (v2-a1-singular-gender, 3 independent checks) | 7 min authored | 6 (2 per unassisted independent correct, 0 guided) | `course-v2-engine.js:254` |
| Verb chapter present (parlare) | 15 min | 76 | `xp-verb.mjs`: 32 independent × 2 + guided |
| Whole verb, five cases | 46–59 min | 211–285 (incl. 30 completion) | `store.js:487` |
| Quiz, 10 questions, perfect | 1.5 min | 30 (2 × 10 + 10 bonus) | `engine.js:245,308` |

XP per minute therefore ranges from ≈ 1 (grammar) to ≈ 40 (boards). The reward gradient points away from production and toward recognition.

### 2.5 Course repair banks (`course-banks.mjs` → `out-course-banks.txt`; `sim-course-errors.mjs`)

| level | lessons | targets | facets | facets with < 3 independent exposure groups | facets with < 2 | production targets without a typed independent question |
|---|---|---|---|---|---|---|
| Foundations | 8 | 8 | 18 | 13 | 0 | 0 |
| A1 | 60 | 60 | 128 | **57** | 0 | 0 |
| A2 | 58 | 58 | 68 | 1 | 0 | 0 |
| B1–C2 | 130 | 134 | 141 | 0 | 0 | 0 |
| total | 256 | 260 | 355 | **71 (20 %)** | 0 | 0 |

The contract says "at least three independent variants per target are needed for repair/review" (`COURSE-V2-CONTRACT.md`, `kind:'question'`); 71 facets — concentrated in Foundations and A1, where learners make the most mistakes — have exactly two. The engine run on `v2-a1-singular-gender` shows the consequence:

- one wrong answer on `masculine-il` → repair card → the guided card again (assisted) → fresh reserve variant `s9` → lesson completes (ready 1/1);
- a second wrong answer on the same facet → no fresh variant left → the lesson ends in `exhausted` ("Come back with a fresh start"), 0/1 targets ready, and can only be finished after the 8-hour exposure gap (`course-v2-engine.js:107-109`).

So the repair loop *does* re-ask with a genuinely fresh variant (used ids and exposure groups are excluded, `course-v2-engine.js:108`), but at A1 it can do so exactly once per facet.

## 3. Findings

Ranked. Each has evidence and a recommended fix.

### Critical

**C1. "Learned" is granted for recognition only, by four inconsistent rules, and the model disagrees with the flag.**
Evidence: §2.1. `journeyWordCompletion` accepts `word-short-v1` (six MC screens, `journey.js:788-795`) and `word-lesson-match-v1` (all board rows in one session, `journey.js:781-797`, `COURSE_BOARD_SKILLS` at `:770`); the workshop bypasses it (`labFrasiLesson.js:359`); `model.js:80,106` deliberately force all of these to `recognition`/`guided`, so `skillState().ready` is false for every learned word. `store.markLearned` then awards 10 XP, a "new word" and a place in the learned list used by games, the Livelli rings, the workshop's build banks and the scope "learned" filter.
Why it matters: the learned list is the app's progress currency, yet it certifies nothing about retrieval; the vocabulary plan's own stated risk ("Credit rule … confirm", `PLAN-LESSON-VOCABULARY-2026-10-01.md` §4.2) was resolved toward the most lenient option, and the board rule is more lenient than the word lesson it claims to equal (4 taps with disappearing tiles versus 6 four-option choices).
Fix: one credit rule for all word paths, computed by the model, not by the views (§5.2). Short term: keep the tick but label it "introduced", and reserve "learned" for the first delayed unaided recall.

**C2. The review queue is unworkable: per-skill rows, 4× inflated counts, full-lesson replays, slow intervals.**
Evidence: §2.3; `review.js:90-92` lists one row per skill and each row opens the same word lesson; `home.js:108` counts rows; `journey.js:400` replays the whole short lesson in review mode; `model.js:361-363` + `srs.js:19-20` give recognition sessions quality 3. A daily reviewer reaches 263 overdue words after a month at 10 new words/day.
Fix: schedule per *entry* for words (one due date, one 3-question recognition→production check), per *target* for verbs/course; show entry counts; cap new items when overdue > N; let a review question of any module advance the schedule (§5.3).

### High

**H1. Words can never reach `ready` or `remembered`; the retention rule is unreachable for ~7 000 of the 8 100 entries.**
Evidence: §2.1(e); `briefWordLesson` builds only `mc`/`pairs` slots (`lesson-content.js:490-506`); `buildShortWordQuestion` returns MC only (`word-questions.js:82-188`); review replays the same. The legacy long word path with typed recall exists in `lesson-content.js` (`wordLesson`) but is never scheduled. `remembered` (`model.js:377-379`) needs two unaided successes a day later — impossible for words.
Fix: a typed recall (or letter bank graduating to typing) as the *review* format for words, once; production counts only there, so lessons stay short.

**H2. Workshop drills credit a word after the answer was shown.**
Evidence: `labFrasiLesson.js:379-384`: a missed drill repeats once and a hit on the repeat sets `right[view.index] = true`; `done` when `right.filter(Boolean).length === drills.length`. The events say `firstAttempt:false` but the view marks learned anyway.
Fix: route the drill result through the model (`journeyWordCompletion` with a `word-lab-drill-v1` rule: three first-attempt hits), not through the view.

**H3. XP is incoherent across sources and rewards recognition.**
Evidence: §2.4. A board gives 40 XP/min; a course lesson 1 XP/min; guided MC in a verb lesson gives the same 2 XP as an unaided typed recall (`store.js:350`, assistance-based only).
Fix: XP = f(evidence quality): 0 for supported practice, 1 recognition, 3 unaided production, bonus for delayed recall; completion bonuses only on model readiness (§5.5).

**H4. No cross-module plan; each module keeps its own queue.**
Evidence: Home "Continue" → `recommendLesson` (resume session → first due review item → next anchor verb → word) (`integration.js:143-179`); Learn hub modes (`learnData.js:52-158`) build four independent "next" items; the Together session (`courseSession.js:22-36`) = next grammar lesson + one verb case + up to three words, chosen without regard to what is due; the workshop is a linear path (`sentence-lab.js:590-609`); games pick sources (`source.js`). Nothing throttles new items against overdue ones. Daily goals (`dailyNew 8`, `dailyVerbs 2`, `dailyReviews 40`, `store.js:92-104`) are counters on Home (`home.js:110-120`), not a plan.
Fix: a daily plan generator (§5.4).

**H5. Two SRS systems coexist and disagree.**
Evidence: `store.items[id]` (legacy SM-2 per entry, `store.js:494-507`) is written by games, the classic review runner and `markLearned` (`due = +8h`, `store.js:482`) and never by journey/course; `dueIds()` (`store.js:516`) therefore lists every learned word older than 8 h that has not been played in a game. The games' "Due for review" source (`source.js:26,64`) and `learnData.js:127` read it. Meanwhile `model.js` keeps a per-skill SM-2 that games update under different objective ids (§2.1(d)).
Fix: retire the item SRS for scheduling; derive `dueIds` from the model; map game questions onto lesson objective ids.

### Medium

**M1. Course credit: the last match on every board is forced, and the mismatch rule is per-session, so replaying a lesson credits a word with no new discrimination.** Evidence: boards remove matched tiles (`learnCourse.js:231-235`; `recordCoursePairMatch` accepts only unmatched indices, `course-v2-engine.js:289-290`); credit needs no-mismatch *in this session* (`journey.js:782,796`). **Inference**: a learner who mismatches once can replay and tap through. Fix: require the forms rows to be answered as a choice or type-in at least once outside the board, or credit "introduced" only.

**M2. Thin repair banks at Foundations/A1 (71 facets with two variants).** Evidence: §2.5. A second error on the same facet ends the lesson for 8 hours. Fix: author a third variant for each (list in `out-course-thin.json`), or let the engine fall back to a *guided* re-ask marked as practice rather than `exhausted`.

**M3. Levels mean nothing.** Evidence: `home.js:18-23` rings = `isLearned` count / dictionary entries per CEFR level (A1 930, A2 984, B1 1 309, B2 1 291, C1 1 240, C2 1 204; `data/stats.json`); `profile.js:16-17` "Current level · Colours the app, picks the word of the night"; `courseLevel` (`grammar-course.js:53`) and the verb `preferences.stage` (`curriculum.js:5-11`) are separate notions. There is no "level complete" anywhere; `courseProgress` (`integration.js:240-252`) computes stage checkpoints for the *legacy* adaptive loop only and is not shown.
Fix: one progression object (§5.5).

**M4. Streak counts app opens, not learning.** Evidence: `touchDay()` runs in `init` and `switchProfile` (`store.js:219,269`) and increments `streak` on any new day (`store.js:552-566`). The week rail on Home uses `correct+new+games>0` (`home.js:121`) — a different definition. Fix: streak = days with ≥ 1 recorded answer.

**M5. Verb lessons do not adapt to difficulty.** Evidence: §2.2 — identical length for parlare and fare; irregular forms are only *mentioned* in the teaching card (`lesson-content.js:255`). Fix: weight repetition toward irregular cells and cells the learner missed; allow a shorter path for regular verbs already proven on another regular verb (transfer).

**M6. Verb review is per target, so one chapter yields 7–16 separate review sessions.** Evidence: `review.js:90-92` one row per skill; `createJourneySession(mode:'review', targetId)` focuses on that target only (`journey.js:111-113,398`). Fix: review a verb case as one session (§5.3).

### Low

**L1. Old audit finding 1 is only half closed (see §6).** The legacy walkthrough's final drill still runs with `record:false` (`learnVerb.js:413`, `learnWord.js:239`) and the legacy completion run writes completion records without any answer evidence (`store.js:446-456`).

**L2. The "Adaptive lessons" toggle creates two review runners and inconsistent due counts** (`review.js:31`, `home.js:108`, `learnData.js:124`). See §8.

**L3. Review page copy ("Strengthen a remembered skill", "Try another example", `review.js:92`) exposes model states that words can never reach; guided MC earns the same XP as unaided typed recall while letter banks earn 1 and boards 0 (`store.js:350`).**

## 4. Strengths

- The verb evidence model is rigorous and honest: unaided, first-attempt, spaced, varied production per person; assistance (hints, visible forms, answer audio, matching, letter banks) is tracked and excluded (`model.js:251-252,316-320`, `learnJourney.js:353-366`); mistakes keep a target open until two varied successes (`model.js:261-270`). This is better than most commercial apps.
- Immediate, specific feedback with the correct form, an explanation and a return to a smaller teaching step (`learnJourney.js:673-711`); repair changes format after repeated failure (`journey.js:159`).
- The course engine's facet model, fresh-variant selection, 8-hour exposure gap and explicit `exhausted`/defer states (`course-v2-engine.js:87-128,149-156`) avoid the "retry until lucky" anti-pattern.
- Spacing *within* a session is enforced everywhere (`evidenceGap`, `separated()` in `course-v2-state.js:40-42`).
- Deterministic replay from an event log (`model.js`), idempotent events, merge-safe sync — the data foundation for a unified progression already exists.
- The workshop is the only place where learned words are *used* in new sentences (build banks from `store.learnedWordIds()`, `labFrasiLesson.js:190-216`; free entry resolves against `learnedIds`, `labFrasiLesson.js:27`) — genuine transfer.
- Course `related` links: 139 of 256 lessons link 203 verb cases (122 distinct) and 82 words, and the Together session and Learn hub use them (`courseSession.js:26-33`, `learnData.js:109-120`). The verbs the course asks for are the anchors the lessons teach (essere, avere, parlare, abitare, mangiare, prendere, andare, fare…).

## 5. Proposal: one coherent progression model

### 5.1 One mastery ladder for every item, computed only by `model.js`

| state | word | verb target | course target |
|---|---|---|---|
| **introduced** | any lesson, board or drill completed (today's tick) | chapter teaching seen | lesson finished |
| **recognised** | ≥ 2 first-attempt recognition hits in different sessions | n/a | guided correct |
| **recalled** | 1 unaided typed recall (meaning→Italian with article) in a *later* session ≥ 8 h after introduction | current `ready` (2 unaided, spaced, varied) | current `ready` |
| **remembered** | a second unaided recall ≥ 1 day later | current `remembered` | current `remembered` (`reps ≥ 2`) |

"Learned" in the UI = **recalled**. The learned list, Livelli, scope filter and game sources read that state. The tick at the end of a lesson says "introduced · comes back tomorrow".

### 5.2 Credit rules (all paths write the same events; views never call `markLearned`)

- Word lesson, course board, workshop drill, game: all record events on the **lesson objective ids** (`w:x::lesson::meaning::recall` etc.; map `annotateGameQuestion` to them). The board keeps `wordPolicy:'word-lesson-match-v1'` and counts as *introduced* + one recognition hit — rewarding (the tick, a small XP burst, the recap list) without certifying.
- The first review of a word is one screen: recall MC if only introduced, else typed recall (letter bank on the first failure). That single typed success promotes to **recalled** and awards the 10 XP.
- Workshop drills count only first-attempt hits; a repeat after the answer was shown is practice.
- Verb and course rules stay as they are.

### 5.3 One scheduler

- Words: one schedule per *entry* (the min of its skills today), SM-2 quality 4 for typed success, 3 for recognition, 1 for a miss; recognition sessions never lower the ease factor. Review question = one screen, not the lesson.
- Verbs: keep per-target schedules but review a *verb case* as one session that serves every due target of that case (today a 16-target chapter is 16 separate sessions).
- Course: unchanged (`courseSkill`), but review items are the lesson, not the facet.
- Any correct answer anywhere (course step, workshop blank, game question) that maps onto a due objective advances it.
- Expose `dueEntries(store)` and use it on Home, Learn and the games' "Due" source; delete `store.items` scheduling.

### 5.4 A daily plan (replaces four module queues)

`plan(store, now)` returns, in order: (1) due reviews, capped at `dailyReviews` *entries* and interleaved verb/word/course; (2) the next course lesson (its board introduces its words); (3) one verb case from the course's `related` links for that lesson, else the anchor list; (4) new words only while overdue entries < `dailyNew`; (5) the workshop lesson whose `grammarRefs` match the course lesson. Home "Continue" walks the plan; the Together session *is* the plan. Games are offered on the plan's due set.

### 5.5 XP, levels and streak

- XP per answer: 0 supported, 1 recognition, 3 unaided production, +5 for a delayed recall that promotes to **recalled**, +10 for **remembered**. Completion bonuses (word 10, verb 30, workshop 15) move to the promotion events, so a board or a shown-answer drill cannot earn them.
- Level = course stage, with "A1 complete" = all A1 lessons `complete` and the stage's anchor verb cases **remembered**; the Livelli rings show *course* progress per stage, with the dictionary count as a secondary "vocabulary at this level: n recalled / 930".
- Streak = days with ≥ 1 recorded answer.

### 5.6 Migration for existing profiles

- Events are already append-only and replayed; nothing is deleted. Add `LEARNING_VERSION 6` whose `analyze()` computes the new states; keep `completions` as the *introduced* record.
- Existing `item.learned` without a `recalled` event becomes **introduced**; the learned list shrinks. Show this once ("x words are introduced and will be checked in review") rather than silently; keep XP already earned (XP is never recomputed, `store.js:356`).
- `store.items[id].due/s/ef` are no longer read for scheduling; keep the fields for export compatibility.
- Game and workshop events recorded under curriculum ids are re-keyed in `normalizeEvent` by a static map `${entry}::word::${skill}` → `${entry}::lesson::…` (both are deterministic from the entry).
- The classic review runner and the legacy walkthrough are removed (§8); their completion records remain valid as *introduced*.

## 6. Status of the 29 September audit findings 1–4

| # | Finding | Status now | Evidence |
|---|---|---|---|
| 1 | Lesson mistakes not retained as evidence | **Resolved for taught lessons** (every answer is an event: `learnJourney.js:888-891`, `learnCourse.js:166`, workshop `labFrasiLesson.js:407`). **Open for the legacy walkthrough**: drill `record:false` (`learnVerb.js:413`, `learnWord.js:239`); completion written from a score (`store.js:414-429`). |
| 2 | Whole-verb mastery conflates abilities | **Resolved in the model** (per-person/per-skill targets, `lesson-content.js:309-315`, `model.js`). **Open in the periphery**: the legacy item record is still the only thing games and the classic review update (`engine.js:245`), and `markLearned` still flips one flag per entry. |
| 3 | Review can introduce untaught advanced grammar | **Resolved**: classic review draws tenses from completed cases only (`review.js:17-23`, `reviewableTenses` `integration.js:31-35`); game generators use `courseTenses()` = `allowedTenses` (`games/questions.js:10,220,250,260`). |
| 4 | Walkthrough checks breadth, not durable skill | **Resolved for taught verb lessons** (two unaided, spaced, varied recalls per person; §2.2). **Not for words** (recognition only, §2.1) and **not for the legacy walkthrough** (9-question drill, 66 % pass, `learnVerb.js:382-396`). |

## 7. Verified vs inferred

Verified by code reading with line references or by a run in this folder: everything in the §2 tables, the evidence lines in §3, and §6. Inferred (reasoned, not measured): the per-screen durations behind every "≈ min"; the claim that a learner would replay a board after a mismatch (M1); the pedagogical judgement that recognition-only credit inflates the learned count (it follows from §2.1 but "inflation" is an evaluation); the proposal in §5. No browser run was needed: every mechanic evaluated here lives in pure modules that the simulations import directly.

## 8. Legacy paths

**"Adaptive lessons" off** (`store.js:102`, `profile.js:117`): `learnVerb.js:91` / `learnWord.js:59` render the original scrollable walkthrough unless the lesson was opened from a course session or grammar lesson. What it does to a learner's data:
- The verb drill (9 questions, pass at 66 %) and the word quick check (3 questions, 50 %) run with `record:false`: no item SRS, no learning events. On a pass, `finishLegacyLessonRun` writes a `source:'legacy'` completion record per *taught tense scene the learner checked* (`store.js:422-428`) and `markLearned` (30/10 XP). These records make the journey overview show "Complete" for those cases with `updateAvailable` (`journey.js:740-741`) and enrol every target of those cases into adaptive Review as pseudo-skills due in 8 h (`integration.js:105-116`) — so toggling back on dumps up to 16 diagnostic items per case into the queue.
- Review with the toggle off uses the classic runner (`review.js:32-84`) *unless* any course skill exists (`review.js:31`), in which case the adaptive list appears anyway. The classic runner updates the legacy item SRS and, for annotated questions, the per-skill model under game ids — a third evidence path.
- Home and Learn change what "due" means with the toggle (`home.js:108`, `learnData.js:124`).

Recommendation: remove the toggle, the two walkthrough views, `walkthrough.js`'s lesson scenes, the classic review runner and `beginLegacyLessonRun`/`finishLegacyLessonRun`; keep `source:'legacy'` completion records as **introduced**. The adaptive loop view `learnAdaptive.js` (reached only with `legacy=1`) can go with them once saved `mode:'lesson'` sessions without `journey` are migrated to a journey session on the same entry.

## Appendix A. §2.3.1 — Variant C (words + two verb present chapters) and the uncapped run

Variant C adds `parlare` present on day 0 and `andare` present on day 1 (`out-review-30d-C.txt`):

| day | due skills (word / verb) | due entries | review sessions | screens | ≈ min |
|---|---|---|---|---|---|
| 1 | 56 (40 / 16) | 11 | 10 | 162 | 55 |
| 2 | 72 (40 / 32) | 12 | **22** | 144 | 43 |
| 3 | 72 (56 / 16) | 15 | 22 | 144 | 43 |
| 10 | 298 (282 / 16) | 81 | 12 | 126 | 41 |
| 29 | 932 (900 / 32) | 266 | 15 | 144 | 46 |

- Verb targets behave as designed: the first review a day after the lesson promotes every target to **remembered** (`model.js:377-379`), SM-2 jumps to 8-day then 20-day intervals (quality 4, `model.js:363`), and after 30 days all 32 verb targets are `remembered` with 3–4 reps. This is the healthy half of the system.
- But each of the 16 targets of one chapter is a separate review session (`review.js:92` one row per skill; a review session focuses on one target, `journey.js:111-113`): on day 2 the learner opens 22 review sessions, 16 of them for the same verb chapter, about 4 questions each.
- The word half is unchanged: 1 036 word skills, all `practicing`, 266 entries overdue on day 29.

Uncapped run (variant A, 20 days, no 40-row cap, `out-review-30d-A-cap100000.txt`): see Appendix B.

## Appendix B. Uncapped review (variant A, 20 days, every due word reviewed, `out-review-30d-A-cap100000.txt`)

| day | due skills | due words | review sessions | screens (reviews + 10 lessons) | ≈ min/day |
|---|---|---|---|---|---|
| 1 | 40 | 10 | 10 | 120 | 40 |
| 5 | 80 | 20 | 20 | 180 | 60 |
| 10 | 116 | 30 | 30 | 240 | 77 |
| 15 | 150 | 44 | 44 | 324 | 100 |
| 19 | 191 | 55 | 55 | 390 | **120** |

- Keeping the queue at zero costs a learner of 10 words/day about 55 six-screen review sessions on day 19 (≈ 80 min of review on top of ≈ 20 min of new lessons), and the load is still rising: after 20 days 272 of 784 skills sit at the 6-day interval and the ease factor has fallen to 1.8, so the typical word comes back every 6 days indefinitely. 0 skills `ready`, 0 `remembered`.
- Compared with the capped run (§2.3), the cap merely moves the cost from time to overdue count; neither run converges, because recognition-only sessions cannot earn the quality-4 step that would let intervals grow (`model.js:363`, `srs.js:15-24`).
- **Inference**: at the app's default `dailyNew = 8`, the same curve applies with ~20 % lower numbers; the shape does not change.
