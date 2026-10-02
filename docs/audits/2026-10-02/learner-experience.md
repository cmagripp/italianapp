# Parola — learner experience, navigation and cohesiveness audit (full report)

Baseline: branch `claude/dreamy-darwin-fqjhm8` at `bd60180` (identical to https://cmagripp.github.io/italianapp/), served read-only on `127.0.0.1:8131`, driven in headless Chromium with the iPhone 13 profile at 430×932 (iPhone 16 Pro Max logical size) and 375×667, dark ("Notte") and light ("Mezzogiorno"). Two learners: a brand-new profile and a seeded returning learner (30 learned A1 words + 8 verbs with due reviews, a word bank and a custom list, a 5-day streak, a paused A1 course lesson, a completed workshop lesson, a verb chapter in progress). Scripts and raw data sit in `audit2/ux/` (`walk-new.mjs`, `walk-returning.mjs`, `flows.mjs`, `probes*.mjs`, their `.json` outputs); screenshots are in `shots/` (277 files; names cited below).

No console errors, page errors or failed requests were recorded in any run (fonts.googleapis.com excluded). Every route in `js/app.js` rendered, including malformed ids (`#/entry/w:zzzz` → "Voce non trovata.", `#/game/nope` → "Gioco sconosciuto.", `#/lab/frasi/nope` → "Lesson not found.", `#/learn/grammar/nope` → "This lesson is unavailable.", unknown paths → Home).

## 1. Verdict

Parola is three good products stacked in one shell: a strong dictionary/codex, a serious taught course with a genuinely excellent sentence workshop, and a large games arcade. What it is not yet is one learner experience. The app answers "what should I do now?" three different ways on three tabs, keeps three unrelated notions of "level" that can disagree at the same moment, and ships five lesson players with different chrome, exits and end screens. The Learn tab contains two complete views of the same model and both duplicate Home and Play. Review is a list of per-word mini-lessons rather than a session, so 30 due items mean 30 separate six-screen lessons. A single verb tense chapter asked 42 questions (32 typed) before its recap.

The visual system is largely coherent and attractive (the workshop, codex, Words, Play and lesson boards are all on-brief); the problems are architectural (what lives where, which model is the source of truth) and in the connective tissue (CTAs, end screens, numbers, toasts, naming). **The content and engines are ready; the navigation layer needs one consolidation pass before this feels like one app.** Nothing blocks use; C1–C3 and H1–H4 will confuse a learner daily.

## 2. Screen-by-screen notes

Filenames refer to `shots/`. `new-*` = brand-new learner, `ret-*` = seeded returning learner, `*-375` = 375×667, `*-light` = Mezzogiorno, `course-*`/`verb-*`/`word-*`/`lab-*`/`game-*`/`review-*` = flows, `probe-*`/`p375-*` = targeted checks.

**Home** — `new-home.png`, `new-home-full.png`, `ret-home.png`, `new-home-375.png`, `new-home-light.png`
- "Buonasera, Learner." (default profile name; no first-run flow). "🔥 1 DAY · 0 XP" for a learner who has done nothing.
- Ticker for a new learner: "volere · parola · notte italiana · la pantofola" — two of four are the app's own name/theme.
- Today card: three counters, week rail, Continue + hint. New learner: "LEARN · 2 NEW VERBS" → `#/learn/verb/v:credere`, while Learn recommends the Foundations grammar lesson. With a course lesson paused at 35 %: still "LEARN · 2 NEW VERBS" (`home.js:123-125` only calls `recommendLesson`). With a verb chapter open: "RESUME · MANGIARE" even with 30 reviews due.
- Word/Verb of the day keyed to `settings.level`, not course stage. "Oggi si gioca" reel of 5 posters; "Livelli" ribbon changes `settings.level` only (toast "Level B1 · Intermedio").
- At 375 the Today card fills the first screen. Light theme clean.

**Learn — Panoramica** — `new-learn.png`, `new-learn-full.png`, `ret-learn-full.png`, `new-learn-dial-grammar.png`, `probe-hero-verbi.png`, `new-learn-375.png`, `new-learn-light.png`
- Top-bar title is a menu ("Panoramica ▾" → Panoramica/Sezioni; swipe also switches); nothing says it is a menu.
- Hero: "IL TUO PERCORSO · YOUR PATH", stage line + "CHANGE" (→ `#/course`), dial with Insieme/Grammatica/Verbi/Parole, preview title/sub, one button.
- Bug: dial on Verbi shows "credere · to believe · Present", button "Resume lesson" opens mangiare (`learnDash.js:139-142`).
- "In corso": verbose empty card; with threads, full-width cards with rings. Opening any lesson creates a 0 % thread; visiting `#/learn/session` creates a session thread and flips the hero to "Resume session".
- "Prossimi passi": reel of 4 cards (Review is the 4th). "Laboratorio": reel of 5 (Officina, Conjugation drill, Verb mix, All verbs, My lists) — three are Play/Words links labelled "VERB LAB". Officina card at y≈1109 px on a 932 px viewport.

**Learn — Sezioni** — `new-learn-sezioni-full.png`, `ret-learn-sezioni-full.png`, `p375-sezioni.png`
- Sticky indicator Corso · Vocabolario · Ripasso · Laboratorio. Corso card with "FULL LESSON | SECTION" + Start/Resume; "RESUME · WORD casa 0 % done · 1 min ago" after merely opening it. Vocabolario "LEVEL A1 · CHANGE" → `#/scope` (a third level control); "Verbi 8 / 2 TODAY", "Parole 30 / 8 TODAY" for the returning learner. Ripasso pane + "FLASHCARDS" link; Laboratorio reel + "ALL GAMES". A second rendering of `learnModel()`.

**My Course** — `new-course-full.png`, `ret-course-full.png`, `new-course-375.png`, `new-course-light.png`, `ret-course-level-menu.png`, `ret-course-skills.png`
- Headline block is a full screen at 375 before the course. "MY COURSE / Everyday Italian" card with stage dropdown; "Your skills" accordion; ghost "Already know some Italian? Find a starting point" (only route to placement); unit accordions with Start/Resume/Revisit pills; "Additional verb forms"; "Grammar reference"; "Back to Learn". Older-generation look. A paused A1 lesson is invisible while the stage is Foundations.

**Placement** — `new-placement.png`: tabs hidden, no top-bar back, in-page "‹ Your course"; honest copy; content floats in ~40 % of the screen; awards nothing (verified).

**Session** — `new-session-full.png`, `ret-session-full.png`: Grammar + Verb (abbracciare / amare — alphabetical pick, `courseSession.js:27-28`) + 3 words; opening the page saves the session.

**Course lesson player** — `course-01-words.png` … `course-26-complete.png`, `course-complete.png`, `course-feedback-wrong.png`, `course-13-repair.png`, `course-paused.png`, `course-question-after-reload.png`, `a1-02-words-check.png`, `a1-13-question-independent-type.png`, `probe-course-info-menu.png`, `probe-course-EN.png`, `p375-course-*.png`
- Chrome: top bar (title · italic *i* · EN) + in-page header (Back · "FOUNDATIONS · LEARN/WORDS/PRACTISE/A CLOSER LOOK/SAVED" · Pause) + progress bar; exits only via Pause.
- Steps: Words, *Le parole di oggi* board, Teach, guided choice/match, independent choice/type, passage, recap, complete. Feedback bar green/orange with Continue. Repair "Try begin and end an exchange again".
- Teach card vertically centred with a big empty band; the toast "1 parola imparata · 1 word learned" sits on the Continue button (`course-05-teach.png`).
- Completion: small check top-left, "LESSON COMPLETE", takeaway, targets, words with ticks, "Next lesson · Exchange names", "Back to Learn". No XP/stamp/confetti (58 XP earned). Header kicker says "SAVED".
- Reload mid-question restores the exact step; Pause screen Resume / Your course / Back to Learn. *i* menu: Course outline, Save/Remove unit audio, Export work.

**Verb lesson** — `verb-overview-full.png`, `verb-02-teach.png` … `verb-07-question-type.png`, `verb-chapter-recap.png`, `verb-overview-after-chapter.png`, `probe-verb-info-menu.png`, `p375-verb-*.png`
- Overview good ("YOUR VERB, FIVE USEFUL LESSONS", five cards). Chapter chrome: top bar ("mangiare · lesson" · ⓘ chapter menu · EN) + Back · Present · Pause + pills (Present forms / Happening now / Mixed review); no progress bar; bare text links "Help me · Show answer · Skip · save for later"; title alternates "mangiare · lesson"/"Verb lesson" (`learnJourney.js:806-807`).
- Pacing: Present chapter = 42 questions (32 typed, 5 choice, 3 pairs, 2 letters) + 6 teach cards across singular/plural/use/progressive/mixed-review; verb still not learned; recap "Next: Passato prossimo / Back to mangiare". Pairs can show "mangia" twice. Reload mid-chapter restores the exact question.

**Word lesson** — `word-01-teach.png`, `word-04-question-pairs.png`, `word-05-complete.png`: Learn | Practise segments, 0/6; six checks; +18 XP, no toast, completion "casa · complete" with "Learn aiuto" and a bare "Back to Words".

**Workshop path** — `new-lab-full.png`, `ret-lab.png`, `new-lab-light.png`: best page in the app (hero, four stages, lesson rows with states, Resume card, Le mie frasi, Strumenti). Tools pane is developer copy: "Fit scorer · 70 MB download … about 83 MB", "Qwen3 0.6B … WebGPU … crash-loop breaker" (`labFrasi.js:48-64`).

**Workshop lesson** — `lab-01-model.png` … `lab-23-path-after.png`, `probe-lab-paused.png`, `new-lab-lesson1-375.png`: shares the course shell; model card with coloured roles, order builder, cloze with options/Word bank/free entry (unknown → "That word is not in the dictionary yet."; *tedesco* → New-word sheet → three drills → toast "tedesco · learned" → "Accepted · your own words."), conversation turn by turn, Say it yourself, completion with centred check, **+15 XP chip**, Le mie frasi, Review the pattern links, three CTAs. At 375 the kicker truncates "LEZIONE 1 …"; in-page Back enabled on activity 1.

**Review** — `new-review.png`, `review-due-full.png`, `ret-review-full.png`, `review-practice.png`, `probe-review-practice.png`, `review-classic.png`, `ret-review-light.png`, `p375-review.png`
- Empty: prose + secondary button + raw gold "Back to Learn" link, rest of the screen empty (not `.empty`).
- With 30 due: "Start focused review" + 30 identical rows (11,151 px). The CTA opens `#/learn/word/w:aiuto|noun?mode=review`: the word lesson in review mode, teaching card first, then six checks. Verbs without chapter evidence never appear; scope → A2 drops due to 0. "Meaning · Meaning" label for course-learned words. Classic runner (Adaptive lessons off) is a proper mixed session.

**Play and games** — `new-games-full.png`, `games-returning.png`, `new-games-picker-*.png`, `games-quiz-picker.png`, `game-quiz-q1.png`, `game-matching.png`, `game-flashcards.png`, `game-conj-drill.png`, `game-crossword.png`, `game-results.png`, `p375-game-quiz.png`
- Hub hero "Gioca, impara." + "Quiz my scope"; two poster reels; source picker sheet with 13 sources and a tense dial. Game chrome: top-bar back **and** an X quit + rail. Results: ring, stamp RIPROVA, "3 OF 15 CORRECT · 11S · +6 XP", "Da rivedere" rows, Play again / Practice missed / DONE — the only player with the DESIGN.md results treatment.

**Words, search, browse, lists, entry, codex, grammar** — `new-words-full.png`, `new-words-search-cas.png`, `new-words-search-none.png`, `new-browse-A1.png`, `new-browse-useful.png`, `new-lists.png`, `new-list-bank.png`, `new-entry-casa-full.png`, `ret-entry-learned.png`, `new-reference.png`, `new-reference-essere.png`, `new-grammar.png`, `new-grammar-articles.png`
- Words index good (search, tiles, level posters, Decks, topics, Tutto). Reference index duplicates Words and is the only place with "Di recente / Recently viewed". Entry page vs codex = two detail pages per word; entry says "LEARN IT IN A SHORT WALKTHROUGH". Grammar topics typeset well. Lists use proper empty states.

**Me and scope** — `new-profile-full.png`, `ret-profile.png`, `new-profile-375.png`, `ret-profile-light.png`, `ret-profile-level-picker.png`, `new-scope-full.png`, `p375-scope.png`
- One 10,338 px page: hero, stat tiles, heat map ("38 LEARNING · 0 REVIEWING" vs Home "30 to review"), Goals (Current level inside), Display & sound, Backup, Cloud sync with four empty inputs + "Show setup SQL", Users, Danger zone. `#/settings` = same page. Scope page is well made but is a fourth level control.

**Chrome, Back, tabs** (`walk-new.json`): tab highlighting correct on all nested routes; Back from entry → browse → Words; Back hidden on tab routes; after a reload Back falls to Home (never leaves the app). Full-screen players hide dock and back; games show chevron + X; lessons/placement show neither.

**EN toggle**: works everywhere, gold pill + tick + toast; inside a course lesson it silently marks attempts as assisted.

**Light theme** (8 screens): consistent and legible; kicker grey #6b6b7a on #f4efe6 ≈ 4.5:1 (floor).

## 3. Findings

### Critical
**C1. Three different answers to "what should I do now".** Home → verb lesson; Learn → grammar lesson; Play → quiz; Home ignores paused course lessons (`home.js:123-125` vs `learnData.js` inProgress). Evidence `probes.json › new-ctas`, `flows.json › course-pause-reload`. Fix: one `nextStep(store)` in `learnData.js` used by Home Continue, Learn hero and In corso.

**C2. Review is not a session.** `review.js:86-94` renders rows; "Start focused review" opens one word's lesson in review mode with the answer card first; 30 due = 30 lessons; verbs without chapter evidence excluded; due filtered by scope (`integration.js:128-131`). Evidence `review-due-full.png`, `probe-review-practice.png`, `probes.json › review-model`. Fix: `#/review` = 10–20 question mixed runner over `reviewItems()` (reuse `runDrill` + journey question builders), per-item deep dive secondary, include verbs, decouple from scope.

**C3. A tense chapter is too long.** 42 questions + 6 teach cards for *mangiare* · Present; learned after 5 chapters; goal 2 verbs/day. Evidence `probes2.json › verb-chapter-length`. Fix: cap ~12 checks per chapter, schedule the rest into Review, learned after Present + one past tense.

### High
**H1.** Hero shows credere, resumes mangiare (`learnDash.js:139-142`; `probe-hero-verbi.png`). Fix: render the resumed thread in the hero when `resuming`.
**H2.** Opening a lesson creates a 0 % thread; opening the session page saves a session (`probes.json › open-creates-thread`; workshop's `pristine()` at `labFrasiLesson.js:85-86` is the model; `courseSession.js:41`). Fix: save after first interaction.
**H3.** Three levels (`settings.level`, `preferences.courseLevel`, `scope.levels`) — B1/Foundations/A1 at once (`probes.json › level-concepts`). Fix: the course stage is the level; scope = filters.
**H4.** Toast over the CTA in `.no-tabs` (`css/app.css:230`; overlap 42–47 px; `course-05-teach.png`). Fix: bottom ≈ sab + 92 px or top placement.
**H5.** Learn = two views of one model; Sezioni and Laboratorio duplicate Home/Play/Words (`learnData.js:150-156`). Fix: §5.
**H6.** Five players, five chromes/endings/exits (`course-complete.png`, `word-05-complete.png`, `verb-chapter-recap.png`, `lab-22-complete.png`, `game-results.png`, `game-quiz-q1.png`; title flicker `learnJourney.js:806-807`). Fix: shared `LessonShell` + `Completion`.
**H7.** Workshop, Review, placement buried (`probes.json › tap-distance`; `new-course-full.png`). Fix: §5.
**H8.** Numbers disagree (Home 30 vs Me 0 reviewing; "8 / 2 today"; 1-day streak at 0 XP). Fix: one `progressSummary(store)`; streak after first activity.

### Medium
**M1. Naming rule.** Inventory: tabs English; Home EN kicker → IT title (TODAY → Il piano di oggi, PLAY → Oggi si gioca, LEVELS → Livelli); Learn EN → IT (IN PROGRESS → In corso, UP NEXT → Prossimi passi, LAB → Laboratorio; Panoramica/Sezioni; dial Insieme/together); Course/session/placement all English ("Your course", "My Course", "Everyday Italian"); course lessons English kickers + "LE PAROLE DI OGGI · WORDS"; journey English (Learn/Practise, Help me, Hear the form); workshop IT kicker · EN gloss (IL MODELLO · THE PATTERN, DILLO TU · SAY IT YOURSELF, LEZIONE COMPLETATA · LESSON COMPLETE, Strumenti → Tools); Play EN → IT/EN (Gioca, impara.; Words in play; DA RIVEDERE → To review; stamps PERFETTO/RIPROVA); Words/Codex IT → EN (CODEX → Ogni parola, spiegata.; FORME → Modi e tempi; NOTA → Good to know); Me EN kicker → IT tap-to-reveal (Obiettivi, Schermo e suono, Copia di sicurezza, Zona pericolosa, Il tuo ritmo); buttons mostly English with "Avanti", "Esercitati", "Riprendi · Resume". Rule: English is the UI language (navigation, buttons, settings, states); Italian only for learnable content, stamps, and a fixed set of named places shown "Italian · English" on first appearance (Officina delle frasi · Sentence workshop, Parole utili · Useful words, Le parole di oggi · Today's words, Le mie frasi · My sentences). Spelling: UK consistently ("Practice ahead" → "Practise ahead" in `review.js`; "Practice missed" in `games/engine.js`); typographic apostrophes (`walkthrough.js:356`, `learnAdaptive.js:292` vs `coursePlacement.js`).
**M2.** Two dictionary indexes (Words, `#/reference`) and two detail pages (entry, codex); Recently viewed only on Reference. Fix: Words = index with Recent; codex = the one detail page with the entry's action row.
**M3.** "Insieme" session verb is alphabetical (*abbracciare*, *amare*; `courseSession.js:27-28`). Fix: lesson vocabulary first, then frequency.
**M4.** 194 generated repair titles "Try use sono, sei and è again" (`tools/author-course-beginner.mjs:225`, `author-course-intermediate.mjs:29`; `course-13-repair.png`).
**M5.** Course page, Review and placement are older-generation (accordions, prose, empty screens; `new-course-375.png`, `new-placement.png`, `new-review.png`). Fix: level-coloured path, `.empty` component.
**M6.** Me is a 10k-px settings wall with the sync form inline (`new-profile-full.png`). Fix: Me = progress; Settings sheet.
**M7.** Stale/inconsistent copy: "short walkthrough" (`entry.js:135`, `list.js:12-13`, `profile.js:19`); "70 MB" vs "83 MB" (`labFrasi.js:48,62,113`); developer language in tools; review rows "Check your earlier learning / Try another example" ×30 and "Meaning · Meaning"; "SAVED" kicker on completion; 25-word empty-card explanation on Learn.
**M8.** Games have two exits (back chevron + X); lessons none. Fix: one X everywhere.
**M9.** Due reviews depend on the study scope (`integration.js:128-131`). Fix: due is due.
**M10.** No "learned" moment in lessons (no toast/stamp/XP on word or verb completion; `flows.json › word-lesson`). Fix: part of H6.
**M11.** In-progress lessons from other stages invisible on `#/course` (`ret-course-full.png`). Fix: "In progress" strip regardless of stage.

### Low
**L1.** 10 px mono (`.night-extra` `views-a.css:76`, `.lc-detail` `learnhub.css:54`, `.dash-change` `views-a.css:211`) below DESIGN.md 11 px; light kicker at the 4.5:1 floor.
**L2.** 375 truncations: "PRESENTE · LEZIONE 1 …" (`new-lab-lesson1-375.png`); otherwise all players keep the CTA in view (`probes3.json › players-375`), no overflow.
**L3.** Duplicate tiles in verb matching ("mangia" ×2).
**L4.** Completion check top-left (course/word) vs centred (workshop).
**L5.** "Back to Learn" buttons duplicate the tab bar on Review, Course, Session, lesson ends.
**L6.** Workshop in-page Back enabled on activity 1 and inert.
**L7.** Home ticker filler for new learners (`home.js:129`).
**L8.** Web fonts not precached in `sw.js` (fallback serif when fonts are unreachable; `probe-toast-over-cta.png`).
**L9.** `index.html` meta description predates the course and workshop.
**L10.** No onboarding; default name "Learner" (`store.js:215`); streak "1 DAY" at first open.

## 4. Strengths
- The sentence workshop is the model for everything else (shell, roles, free entry, drills, conversations, Say it yourself, completion with XP and pattern links; session written only after the first action).
- The course pipeline is pedagogically honest (words → board → teach → guided → independent → repair → recap; assisted attempts flagged; exact resume with drafts; placement awards nothing).
- Words, Play and the codex are on-brief and fast (bilingual search with custom-word fallback, posters, 13-source picker with tense dial, rotary dial and fanned persons, results with stamp and confetti).
- The visual system holds in both themes and at 375 px; no horizontal overflow anywhere; every player's CTA in view.
- Robustness: zero errors across ~60 routes and 6 flows; friendly dead ends; Back never leaves the app.
- Candid copy about what is and isn't assessed; on-device privacy statements.

## 5. Proposed information architecture

Principles: one model and one "next step" (`learnModel()` feeds Home, Learn, Me); one level (the course stage; scope = filters inside Words/Play); each thing lives in one tab; one lesson shell and one completion screen; English UI, Italian content.

| Tab | Holds | Loses |
|---|---|---|
| **Home** (Today) | Greeting; **Today's plan** as an ordered list of 3–4 steps from `learnModel()` (Resume X · Review N due · Next lesson · Workshop lesson) with one **Continue** opening step 1; streak/XP; Word & Verb of the day | Level ribbon, games reel, decorative counters |
| **Learn** (Path) | One view: stage header (stage · unit · n/N · Change); the path: units with lesson rows, next highlighted, workshop lessons interleaved where their `grammarRefs` are met, verb chapters at the unit teaching the tense; Vocabulary block for this unit + Parole utili; "In progress" strip only when non-empty | Panoramica/Sezioni split, the dial, the Laboratorio reel, the Review pane |
| **Play** (Practice) | **Review** first (N due · Start review → mixed runner; Practise ahead), then reels and the picker | — |
| **Words** | Search; Recently viewed; lists/bank/custom; Parole utili; browse by level/topic; grammar topics; **one** detail page (codex + actions) | Reference index, entry/codex split |
| **Me** | Identity; progress (stage, words/verbs, workshop, streak, heat map, queue size); goals (level = stage, daily targets); **Settings** row → sheet (display & sound, lessons, backup, sync, users, reset) | The 10k-px scroll |

Home sketch:
```
Buonasera, Caleb.                         🇮🇹
VENERDÌ 2 OTTOBRE · 🔥 5 DAYS · 555 XP
TODAY                              5 / 7 DAYS
┌────────────────────────────────────────┐
│ 1  Resume   Use sono, sei and è   31 % │
│ 2  Review   30 due · ~8 min            │
│ 3  Lesson   Say where you are from     │
│ 4  Workshop Cosa faccio · 6 min        │
│            [ Continue ]                │  ← opens step 1; hint names it
└────────────────────────────────────────┘
WORD OF THE DAY        VERB OF THE DAY
[ la pantofola ]       [ volere ]
```
Learn sketch:
```
YOUR PATH                       Change ▾
A1 · Elementary · Unit 2 of 14 · 3 / 60 lessons   ▮▮▮▯▯▯▯▯▯▯
IN PROGRESS  (only when non-empty)
▸ Use sono, sei and è · 31 % · Resume
UNIT 2 · SAY WHO YOU ARE
✓ Use sono, sei and è                 grammar · 7 min
● Give an age and a need              grammar · 7 min   [Start]
○ Chi sono · Officina                 workshop · 6 min
○ essere · Present                    verb chapter · ~10 min
○ Say where you are from              grammar · 7 min
VOCABULARY FOR THIS UNIT        Parole utili ›
[ l'aiuto ] [ l'albero ] [ l'arte ]   3 of 8 today
```

Top 10 changes (priority; S ≤ 1 day, M = days, L = week+):
1. One `nextStep()`/`todayPlan()` in `learnData.js` feeding Home Continue, Learn hero and In corso; hero title = what the button opens — C1, H1 — **S**
2. Review runner over `reviewItems()` (reuse `runDrill` + journey question builders), verbs included, scope-independent — C2, M9 — **M**
3. Chapter pacing cap (~12 checks; remainder into Review; verb learned after two tenses) — C3, M10 — **M**
4. Save journey/course sessions only after the first interaction; build "Insieme" on Start — H2 — **S**
5. One level model (course stage drives Home/Me/Words/scope default; Scope → "Study from…" filters) — H3 — **M**
6. Toast position in `.no-tabs` — H4 — **S**
7. Collapse Learn to one view; verb games → Play, All verbs/My lists → Words, Review → Home/Play; workshop in the path — H5, H7 — **M**
8. Shared `LessonShell` + `Completion` (stamp, +XP, learned items, Next/Back, one close/pause, one options menu, stable title) — H6, M10, L4, L5, M8 — **L**
9. Naming rule + copy pass (M1 table, repair titles, walkthrough references, tools pane, review labels, spelling/apostrophes) — M1, M4, M7 — **S–M**
10. Me split (progress + Settings sheet) and a first-run sheet (name, goal, theme, "Already know some Italian?") — M6, L10, H7 — **M**

## 6. Features a learner expects
Missing/not findable: a daily plan that is a sequence; a single progress view per level (course + vocabulary + workshop + skills are on four screens); onboarding; reminders/notifications (none); pronunciation practice beyond unassessed recordings in course portfolio steps; dictionary history on Words (`store.recent` exists, shown only on Reference); reviewing/practising workshop sentences (listen only); a listening entry point outside the course (dictation game + TTS exist); per-tense "learned" state outside the verb overview.
Exists but hidden: Parole utili (end of a reel / Words › Decks); placement (bottom of `#/course`); Additional verb forms (accordion); Section toggle and swipe on Learn; lesson *i* menu (export work, offline unit audio); long-press user cards; EN toggle's assisted-practice semantics; Review ahead; classic runner and walkthroughs (Me › Adaptive lessons off); Recently viewed as a game source; the codex.

## 7. Verified vs inferred
**Verified by driving the app**: every route in §2 at 430×932 and 375×667; the Foundations lesson end to end with a wrong answer, repair, pause and reload; an A1 lesson with three boards to completion; the full *mangiare* Present chapter to its recap and a mid-chapter reload; the *casa* word lesson; workshop lesson 1 end to end with unknown word, free Italian word + drills, conversation and Say it yourself; quiz/matching/flashcards/conjugation/crossword via the picker and a quiz to results; Review empty, with 30 due, its practice target, the classic runner; Back/tab chains and Back after reload; EN toggle on four screens; light theme on eight; the three CTAs, the hero mismatch, thread creation on open, the three level concepts, toast geometry, due count vs scope, tap distances, CTA visibility at 375. Zero console/page/HTTP errors in every run.
**Verified by reading source**: CTA models (`home.js:123-125`, `learnData.js`, `learnDash.js:139-142`), `recommendLesson`/`reviewItems` (`integration.js:123-155`), session creation (`courseSession.js:41`, `labFrasiLesson.js:85-86`), toast CSS (`app.css:223-230`), title switching (`learnJourney.js:806-807`), repair-title templates, cited copy strings, lab tools copy, no fonts in `sw.js`, default profile name, no first-run flow.
**Inferred**: human time per question (bot: 58 s for 42 questions; a person typing 32 forms ≈ 10–15 min); legibility of 10–11 px mono on a 460 ppi screen; perceived weight of the Me page; aurora/blur performance on a real iPhone 16 Pro Max (not profiled); how the owner's real profile's levels drifted (mechanism verified, data not inspected).
