# Parola — architecture and code-organisation review

Baseline: `/home/user/italianapp`, branch `claude/dreamy-darwin-fqjhm8`, commit `bd60180` (deployed to https://cmagripp.github.io/italianapp/ by run 37044189794). Read-only review; every script, dump and this report live under `scratchpad/audit2/arch/` (`modgraph.mjs` → `modgraph.md/json`, `cssaudit.mjs` → `cssaudit.md/json`, `precache.mjs`, `refine.mjs`, `bench2.mjs` → `bench2.md`, `time-checks.sh` → `check-times.tsv`). Date: 2 October 2026.

Scope note: the app was built in six days (113 commits, 27 Sep–2 Oct; 84 authored by an AI agent, 29 by two humans) and every one of its 94 modules was created in that window. What follows judges the result as a codebase a person will now maintain, not the speed at which it was produced.

---

## 1. Verdict

Parola is a static ES-module app whose *engines* are in good shape and whose *organisation* is not. The engines (`conjugator.js`, `learning/model.js`, `course-v2-engine.js`, `sentence-lab.js`) are pure, Node-importable, contract-documented and well tested; the import graph has no cycles; the service-worker install is atomic and content-stamped; the deploy only publishes when 39 Node commands and 20 browser suites pass. Around those engines, however, five generations of learning UI were layered without consolidating the previous one: there are five lesson players, six multiple-choice renderers, five question generators, two course registries folded into one module, six session shapes in one map, and a legacy toggle that routes the *default* verb lesson through two retired modules before the real player loads. The boot path parses 1.1 MB of JavaScript of which 640 KB is a generated data table only verb lessons need, because the persistence layer statically imports the verb-lesson content builder. The evidence log is append-only with no compaction and every answer re-normalises the whole log: in Node, one answer costs ~10 ms at 250 events and ~124 ms at 3,000, while the profile that is deep-copied on every save and uploaded on every sync grows by ~615 bytes per event. 29 % of the JavaScript bytes sit on lines longer than 160 characters (16 modules have more than half their bytes on such lines; the longest line is 2,083 characters), there is no formatter or linter configuration, 91 exports are never imported, and the CSS defines 56 game selectors twice (app.css §14 and games.css). None of this is unfixable, and the pure-engine discipline makes the consolidation tractable; but the next feature should not be added until the lesson-player and question-widget layers are merged and the evidence store has a growth strategy, because every generation so far has copied the previous one's shell rather than sharing it.

---

## 2. Measurements

### 2.1 Module graph (`modgraph.mjs`; static + dynamic `import()` parsed by regex over comment-stripped source)

| Metric | Value |
|---|---|
| App modules under `js/` | 94 (2,242 KB; `js/learning/verb-progressive-data.js` alone 640 KB, generated) |
| Static import cycles (Tarjan SCC) | **0** |
| Modules nothing in `js/` imports | 1: `js/workers/fit-scorer.worker.js` (a `new Worker(new URL(...))` target; imported by `tools/test-fit-scorer.mjs`) |
| Entry point | `js/app.js` (`index.html:68`) |
| Boot static closure (index.html → app.js → static imports, transitively) | **25 modules, 1,127 KB**; 487 KB without the generated table |
| Reachable from app.js incl. dynamic imports | 93 modules, 2,229 KB (every module but the worker) |
| Exported names never imported anywhere (js/, tests/, tools/, dev/) | **91** (refined below) |
| Exports used only by tests/tools | 41 (`fit-scorer.js` ×9, `sentence-lab.js` ×10, `fit-scorer.worker.js` ×10, …) |
| sw.js SHELL entries | 134 files, **10.01 MB** precached atomically |

Boot chain that drags the 640 KB table into every page load: `app.js:2` → `store.js:7` (`entryCompletion` from `learning/integration.js`) → `integration.js:5` (`buildLesson` from `lesson-content.js`) → `lesson-content.js:7` (`progressive-content.js`) → `progressive-content.js:4` (`VERB_PROGRESSIVE_DATA`). `store.js:1` also statically imports `course-v2-media.js` for one function (`deleteCourseRecordings`, used at `store.js:293,656`).

Fan-in / fan-out (top of the table; full table in `modgraph.md`):

| module | KB | fan-out | fan-in (static, js/) | note |
|---|---:|---:|---:|---|
| js/data.js | 14.2 | 0 | 56 | clean leaf |
| js/ui.js | 13.9 | 2 | 47 | registers 4 document listeners at import (`ui.js:71-82, 216-221`) |
| js/store.js | 38.1 | 5 | 43 | imports the lesson engine (chain above) |
| js/fx.js | 31.8 | 0 | 40 | clean leaf |
| js/app.js | 14.1 | 7 + 26 dynamic | **29** | the *entry module* is imported by 29 views for `setTitle`/`setChrome` |
| js/conjugator.js | 30.2 | 1 | 25 | clean |
| js/games/engine.js | 23.5 | 8 | 17 | `feedbackHTML`/`checkTyped` are de-facto shared widgets |
| js/components.js | 24.4 | 6 | 12 | |
| js/learning/grammar-course.js | 5.5 | 4 | 12 | registry of both courses |
| js/learning/model.js | 33.2 | 3 | 7 (+15 tests) | pure |
| js/views/learnJourney.js | 88.5 | 25 | 0 (dynamic ×2) | largest module, 1,023 lines |

Per-route transitive closure of the lazily imported view (“extra” = modules not already in the boot closure):

| route | view | modules | extra | extra KB (static) |
|---|---|---:|---:|---:|
| learn/verb/:id | learnVerb.js | 42 | 17 | 348 — includes `walkthrough.js`, `games/engine.js`, `games/questions.js`, `views/learn.js`, `views/course.js`, three lexica… before the real player (`learnAdaptive` → `learnJourney`, +~140 KB) is even fetched |
| learn/word/:id | learnWord.js | 42 | 17 | 334 |
| learn/grammar/:id | learnGrammar.js | 39 | 14 | 260 (loads the legacy player *and* `learnCourse.js`) |
| lab/frasi/:id | labFrasiLesson.js | 37 | 12 | 263 |
| lab/frasi | labFrasi.js | 37 | 12 | 242 |
| learn | learn.js | 36 | 11 | 207 (the hub pulls `course-v2-engine`, `sentence-lab`, `sentence-lookup`, three lexica) |
| course/placement | coursePlacement.js | 34 | 9 | 147 |
| home | home.js | 34 | 9 | 132 (Home statically imports `games/index.js` → `games/questions.js` → `games/engine.js`) |
| games / game/:id | games.js / play.js | 32 | 7 | 111 / 104 |
| reference/:id | referenceEntry.js | 29 | 4 | 108 |
| review | review.js | 30 | 5 | 94 |
| learn/practice | learnAdaptive.js | 27 | 2 | 46 (then dynamically imports `learnJourney.js` unless `?legacy=1`) |
| the other 14 routes | | 26–30 | 1–5 | 5–67 |

Unused exports, refined (`refine.mjs`):

| verdict | count | names |
|---|---:|---|
| Dead: never referenced anywhere | 11 | `components.js: entryList, wordCard, verbCard` · `games/engine.js: gameHeader` · `games/questions.js: qVerbTranslateMC` · `icons.js: ICON_NAMES` · `sentence-lab-data.js: labLoaded, labStages` · `ui.js: iconBtn, onEnter` · `views/course.js: coursePreview` |
| Exported but used only inside its own module | 59 | e.g. `components.js: regularForm, conjTable, verbUsage` · `store.js: DEFAULT_SETTINGS` · `sync.js: schedulePush` · `course.js: courseSummary, courseSkillProfile, legacyCourseHistory` · `labFrasiLesson.js: labContext, speakerGender, buildDrills` (full list in `modgraph.md`) |
| Exported router API no view uses | 2 | `app.js: route, navigate` — all 16 navigating files assign `location.hash` directly |
| Referenced by string name (`module[name]`) | 6 | the games' `start*` (`games/index.js:21`) |
| Default exports never imported | 4 | `icons.js`, `views/homeLevels.js`, `views/learnCards.js`, `views/learnDash.js` |

### 2.2 Density (`refine.mjs`; generated data module excluded)

| module | KB | lines | % of bytes on lines > 160 chars | longest line |
|---|---:|---:|---:|---:|
| js/learning/course-v2-activities.js | 10.7 | 46 | 83 % | 2,083 |
| js/views/coursePlacement.js | 9.3 | 39 | 81 % | 1,728 |
| js/games/index.js | 7.5 | 52 | 80 % | 435 |
| js/views/course.js | 9.8 | 70 | 71 % | 1,009 |
| js/views/learnGrammar.js | 17.8 | 126 | 67 % | 953 |
| js/views/labFrasi.js | 14.7 | 141 | 60 % | 656 |
| js/learning/sentence-lab-activities.js | 21.6 | 200 | 59 % | 729 |
| js/learning/lesson-questions.js | 22.4 | 184 | 55 % | 602 |
| js/learning/lesson-content.js | 59.5 | 515 | 54 % | 1,185 |
| js/views/learnCourse.js | 30.9 | 264 | 54 % | 987 |
| js/views/courseSession.js | 5.3 | 53 | 52 % | 1,324 |
| js/views/learnAdaptive.js | 34.6 | 400 | 42 % | 1,184 |

Across `js/`: **29 % of source bytes sit on lines longer than 160 characters; 16 modules ≥ 50 %, 45 of 93 ≥ 25 %.** `css/grammar-course.css` is 22 lines for 15.4 KB (one line is 4,324 characters). The repository root holds only `.git`, `.github` and `.gitignore`: no ESLint, Prettier or EditorConfig file.

### 2.3 Precache budget (`precache.mjs`)

| area | KB |
|---|---:|
| data/vocab.json + verbs.json + stats.json + grammar.json | 3,556 |
| data/course-v2 (7 packs + audio.json) | 3,149 |
| js/ (94 modules; 640 of it the generated table) | 2,229 |
| data/grammar-course (earlier 129-lesson course, 6 packs) | 703 |
| css/ (13 sheets) | 359 |
| data/sentence-lab + useful-words | 325 |
| **total** | **10,251 KB (10.01 MB), 134 files** |

Legacy / optional share of that install: grammar-course packs 703 KB + `learnAdaptive.js` 35 + `adaptive.css` 10 + `legacy-progressive-content.js` 20 + `grammar-journey.js`/`grammar-state.js` 9 + `walkthrough.js`/`learnVerb.js`/`learnWord.js` 73 + `learnGrammar.js` 18 + `learn.css` 22 ≈ **890 KB (≈ 9 % of the install, ≈ 34 % of JS+CSS)**. `tools/check-shell.mjs:38,42` requires *every* `js/**/*.js` and `css/*.css` to be in SHELL, so nothing can be made optional without changing that check.

### 2.4 CSS (`cssaudit.mjs`)

| file | KB | lines | rules | `!important` |
|---|---:|---:|---:|---:|
| app.css | 89.5 | 881 | 654 | 10 |
| journey.css | 55.7 | 526 | 509 | 5 |
| views-c.css | 36.1 | 433 | 261 | 17 |
| games.css | 31.1 | 343 | 283 | 3 |
| views-b.css | 27.1 | 318 | 241 | 2 |
| views-a.css | 22.2 | 272 | 175 | 5 |
| learn.css | 21.8 | 269 | 209 | 2 |
| reference.css | 20.7 | 235 | 198 | 3 |
| sentence-lab.css | 20.2 | 235 | 193 | 0 |
| grammar-course.css | 15.4 | 22 | 194 | 12 |
| adaptive.css | 9.9 | 94 | 97 | 3 |
| learnhub.css | 7.4 | 90 | 41 | 0 |
| course.css | 2.3 | 28 | 28 | 0 |

All 13 are linked by `index.html:26-38`. 1,270 classes defined; **66 selectors defined in two files** (56 of them app.css §14 “games” vs games.css: `.q-card`, `.choice`, `.choices`, `.results`, `.keyboard .k`, `.cw .c`, `.match-grid .m`, `.flash`, `.dock`, …; 7 reference.css vs views-b.css; `.wt-scene .drill-host .feedback-bar` in games.css and learn.css); **72 identical declaration blocks** under different selectors (the mono-kicker block `font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3)` 7 times across app/learn/reference/views-b/views-c; `:active { transform: scale(.985); background: var(--glass-strong) }` 7 times); 62 `!important`; 37 classes never referenced from JS/HTML by token search (`app.css: cw-panel, cw-wrap, cw-input, g-f, g-m, g-mf, letter-grid, level-card, mood-title, stepper, timer-bar, kbd-space, it-text, section-head, gap-s, mt-s, mb-l`; `views-a.css: deck-*, scope-*, src-list, lab-grid`; `course.css: course-milestones, course-scope, course-stages`; `games.css: flash-tools, n1, n2`; …). The Learn hub is styled from four sheets: views-a.css (“LEARN HUB”, “LEARN · PANORAMICA”), views-c.css §7 (“LEARN · SEZIONI”), learnhub.css and learn.css.

### 2.5 CI, checks, tests, tools, docs

GitHub Actions (`gh api …/actions/runs`, `…/jobs`):

| run | build job | browser matrix (20 jobs, parallel) | deploy | wall |
|---|---:|---|---:|---:|
| 37044189794 (bd60180, 2 Oct 17:57) | 95 s | 43 s (offline-e2e) … 7 min 24 s (e2e); journey / course-v2 / verb-flow-v2 ≈ 4 min each; each job first installs Playwright (`browser.yml:29-30`) | 52 s | **10 min 01 s** |
| 36892953059 (e7596bb, 1 Oct) | 80 s | course-v2-e2e 18 min 27 s, journey-e2e 16 min 56 s, verb-pacing-e2e queued 30 min | 9 s | **34 min 25 s** |

Node checks run locally (`time-checks.sh`, 37 commands, the two file-rewriting ones excluded; the sandbox was shared with another script for part of the run — indicative only; CI does validate+build+all checks+stamp+build-site in 95 s):

| check | s | | check | s |
|---|---:|---|---|---:|
| test-lesson-content | 44.7 | | test-progressive-content | 14.5 |
| test-sentence-lookup | 40.0 | | test-fit-scorer | 9.2 |
| test-word-questions | 23.1 | | check-modules | 5.1 |
| test-short-word-model | 18.4 | | test-grammar-course | 3.4 |
| test-course-v2-lexicon | 14.9 | | 28 others | ≤ 3.1 each, 25 s together |
| **total** | **198 s** | | 8 slowest = 86 % | |

Inventory: `tools/` 50 scripts = 34 `test-*.mjs` + 2 `check-*` + 6 build/validate/stamp + **8 authoring one-offs** (`author-course-beginner.mjs` 278 KB, `author-course-intermediate.mjs` 209 KB, `course-beginner-checkpoints.mjs`, `course-beginner-refinements.mjs`, `course-pronunciation-lessons.mjs`, `audit-verb-content.mjs`, `build-course-audio.py`, `review-course-audio.py`). `tests/` 21 suites + `lib.mjs` + `journey-driver.mjs`, 5,618 lines; **`tests/report-*.json` and `tests/shots/` are git-ignored (`.gitignore:4-5`) and not committed** (`git ls-files` returns nothing) — local build output only. `docs/` 26 files, 2.4 MB, of which 2.1 MB is JSON audit output (`VERB-CONTENT-AUDIT-2026-09-29.json` 1.7 MB, three `audit-verb-usage-*.json`); 7 Markdown docs are referenced from no other file (`AUDIT-2026-10-01.md`, `TAUGHT-LESSON-RELEASE.md`, `VERB-CONTENT-AUDIT-2026-09-29.md`, `VERB-FLOW-V2.md`, `grammar-course-{a1-a2,b1-b2,c1-c2}.md`). `dist/` (109 MB with models/vendor) is git-ignored and built by `tools/build-site.mjs`, which excludes docs/tests/tools/dev.

### 2.6 Evidence-store growth (`bench2.mjs`, Node 22 in the sandbox; synthetic journey-v1 events over 400 objectives)

| events | learning JSON KB | bytes/event | one answer (`recordAttempt` + `skillState`) | JSON snapshot of the domain | `normalizeLearning` | `mergeLearning(self)` | seconds to reach this size |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 250 | 150 | 613 | 9.8 ms | 1.6 ms | 6.7 ms | 32 ms | 1.2 |
| 500 | 300 | 614 | 20.4 ms | 3.7 ms | 5.2 ms | 43 ms | 5.2 |
| 1,000 | 600 | 615 | 69.1 ms | 41.9 ms | 79.1 ms | 286 ms | 31.8 |
| 2,000 | 1,205 | 617 | 95.8 ms | 24.5 ms | 43.0 ms | 219 ms | 125 |
| 3,000 | 1,812 | 618 | 124.0 ms | 20.4 ms | 51.1 ms | 412 ms | 262 |

A first attempt to fill 20,000 events did not finish in 10 minutes (O(n²) fill: each `recordAttempt` normalises every stored event). A learner answering ~100 questions a day reaches 3,000 events in a month.

---

## 3. Findings

### Critical

**C1. The evidence log is unbounded and every answer re-processes all of it.**
Evidence: `learning/model.js:236-245` (`recordAttempt` calls `normalizeLearning(domain)` on every event) → `model.js:153-192` (`normalizeLearning` runs `plain()` deep-copy and `normalizeEvent` over *every* event) → `model.js:243` returns a *new* `learning` object, so `store.js:352` (`this.current.learning = result.learning`) invalidates the `WeakMap` cache at `model.js:392-411` and the next `skillState` re-sorts and re-indexes everything; `store.js:316` deep-copies the whole profile (`JSON.parse(JSON.stringify(cur))`) on every save (400 ms debounce, `store.js:304-309`); `sync.js:124` schedules a full-profile upload 15 s after *any* `change` (`sync.js:94-97`). Nothing prunes, compacts or summarises `learning.events` (a grep for a cap finds only `LAB_SENTENCES_MAX`, `store.js:109`). Measured: 615 B/event, 124 ms per answer at 3,000 events in Node (table 2.6); a phone will be slower.
Impact: the core loop (answer → feedback) degrades linearly with lifetime use; saves and syncs grow to multi-MB payloads; `mergeLearning` on sync is ~0.4 s at 3,000 events.
Fix (L): (1) make `recordAttempt` append-only — validate the one new event with `normalizeEvent`, keep a `normalized: true` marker on the domain and skip re-normalisation; (2) keep the evidence index incremental (append to `byObjective`/`bySession`, re-analyse only the touched objective); (3) a compaction policy: after a skill is `remembered`, fold events older than N days into a per-objective summary that `analyze()` accepts as a prefix, and cap raw events (e.g. 2,000) with oldest-first rollup; (4) make sync send a delta (events since the last revision) or at least compress; (5) add cases to `tools/test-learning-model.mjs` asserting per-answer cost is O(1) in event count.

### High

**H1. The boot path parses the verb-lesson engine and a 640 KB generated table on every screen.**
Evidence: chain in §2.1 (`store.js:7` → `integration.js:5,7` → `lesson-content.js:7` → `progressive-content.js:4`); `store.js:1` imports `course-v2-media.js` for `deleteCourseRecordings` only; boot closure 25 modules / 1,127 KB versus 487 KB without the table. `index.html:40-47` `modulepreload`s only the 8 core modules, so the other 17 boot modules load as a dependency waterfall after `store.js` is parsed.
Impact: first paint on Home waits for `journey.js` (65 KB), `lesson-content.js` (60 KB), `questions.js` (34 KB) and the table; every reload re-evaluates them.
Fix (M): move `completionState`/`isLearned` logic out of `store.js` into `learning/completion.js` imported by the views that need it (or injected at boot); convert `verb-progressive-data.js` into `data/verb-progressive.json` fetched lazily by `progressive-content.js` (the pattern `grammar-course.js:36-46` already uses for packs; `check-shell.mjs:39` would list it as data); lazy-import `course-v2-media.js` in the two store methods that need it.

**H2. Five lesson players and six multiple-choice renderers, each a copy of the previous generation.**
Players: `views/walkthrough.js` (scene deck, 409 lines) + `learnVerb.js`/`learnWord.js`; `views/learnAdaptive.js` (v1 loop, 399 lines); `views/learnJourney.js` (1,023 lines, 88 KB, 25 imports); `views/learnGrammar.js` (legacy course player *and* v2 dispatcher); `views/learnCourse.js` (264 lines); `views/labFrasiLesson.js` (460 lines); `views/coursePlacement.js` (its own mini-runner); `views/review.js` classic runner.
Copied blocks: the keyboard-viewport `fit()` block is pasted verbatim into `learnGrammar.js:30-34`, `learnCourse.js:40-44`, `labFrasiLesson.js:77-81`, `learnJourney.js:243-280` and `coursePlacement.js`, with a `--practice-height` twin in `review.js:58-72`; the `i` info button in `learnGrammar.js:35-37` and `learnCourse.js:45-47`; the `grammar-shell/grammar-header/grammar-scroll/grammar-footer` frame in `learnGrammar.js:85`, `learnCourse.js:132` and `labFrasiLesson.js:96-100`; the “Your place is saved” pause screen in `learnGrammar.js:63`, `learnCourse.js:94` and `sentence-lab-activities.js:179`; the choice/type/order/match question markup in `learnGrammar.js:39-54` is a near-verbatim copy of `course-v2-activities.js:13-29` (same `journey-choice-marker`, same accent row, same `data-token`/`data-pair-left` hooks). Multiple-choice markup exists in `games/engine.js:207`, `walkthrough.js:336`, `learnAdaptive.js:290`, `course-v2-activities.js:19`, `learnGrammar.js:44`, `sentence-lab-activities.js:192` and `activity-panel.js` (pairs/letters); an accent bar in six places with three class names (`.accents`/`[data-accents]` `engine.js:76`; `.adaptive-accents` `learnAdaptive.js:290`; `.journey-accents` `course-v2-activities.js:20`, `learnGrammar.js:45`, `sentence-lab-activities.js:90,193`). The one shared widget, `feedbackHTML` (`engine.js:114`), is imported by six players — proof that sharing works here.
Impact: a fix to keyboard handling, accessibility or feedback must be made in 5–7 places; CSS for the same widget lives in games.css, journey.css, grammar-course.css, sentence-lab.css and adaptive.css; `learnJourney.js` cannot be reviewed as a unit.
Fix (L overall, S for the first step): extract `ui/lesson-shell.js` (viewport fit, header + progress bar, footer, pause screen, history banner, info menu) and `ui/question-widgets.js` (choice, typed+accents, order, match/pairs, letters, cloze blank) as pure HTML builders plus one event-delegation binder; make `learnCourse.js`, `labFrasiLesson.js` and `learnJourney.js` consume them; delete the duplicates in `learnGrammar.js`/`learnAdaptive.js` when those modules retire (§5.3).

**H3. The default verb and word lesson is reached through two retired dispatchers.**
Evidence: `app.js:177-178` route `learn/verb/:id` → `learnVerb.js:91` `if (adaptiveLearning !== false …) return (await import('./learnAdaptive.js')).render(...)` → `learnAdaptive.js:38` `if (query.legacy !== '1') return (await import('./learnJourney.js')).render(...)`. The only producer of `legacy=1` is `tests/adaptive-e2e.mjs:17-18,219`. `learnVerb.js` statically imports `walkthrough.js`, `games/engine.js`, `games/questions.js` (route closure: 17 extra modules, 348 KB) and `learnAdaptive.js` statically imports `learning/questions.js`/`diagnose.js`, so the default lesson fetches ~90 KB of legacy code and makes three sequential module fetches before `learnJourney.js` starts downloading.
Fix (S): point `learn/verb`, `learn/word` and `learn/practice` at `learnJourney.js`; keep the walkthrough behind `learn/verb/:id?classic=1` served by `learnVerb.js` directly; delete the `legacy=1` branch.

**H4. One session map, six session shapes, nine version counters, and a key-aliasing workaround.**
Evidence: `learning.sessions` is keyed by `learningSessionKey` = `${entryId}|${journey ? 'journey:' : ''}${mode}` (`model.js:60-62`) and holds journey sessions (`journey.js:390`), v1 adaptive sessions with `ui.version 1` (`learnAdaptive.js:13,102`), v1 grammar sessions `grammar.version 1` (`grammar-journey.js:20-23`), v2 course sessions `courseV2.version 2, planVersion 3` (`course-v2-engine.js:170`), lab sessions `version 1` written under the *literal* key `lab:frasi:<id>` which the normaliser then re-keys to `lab:frasi:<id>|lab`, so reads accept both (`sentence-lab-data.js:59-72`, documented as a workaround in `docs/SENTENCE-LAB-CONTRACT.md §6`), and the course-session queue under `entryId:'course:everyday', mode:'course'` (`courseSession.js:35`). Version counters: `profile.version 2` (`store.js:148`), `LEARNING_VERSION 5` (`model.js:7`), `JOURNEY_VERSION 1` (`journey.js:5`), `LESSON_CONTENT_VERSION 1` (`lesson-content.js:9`), `ui.version 1/2` (`learnAdaptive.js:13`, `learnJourney.js:147`), activity-state `version 1` (`activity-panel.js:42-65`), `wordShort.version 1` (`journey.js:368`), per-pack `contentVersion`, `planVersion 3`. No single document lists the profile schema; `data/SCHEMA.md` covers dictionary data only.
Impact: `normalizeSession` (`model.js:40-56`) must stay permissive, so corrupt or stale sessions survive; every feature invents a key convention; merge semantics (newest by `updatedAt`) apply to shapes with no `updatedAt` discipline of their own.
Fix (M): an explicit `kind` field (`journey | course | lab | queue`) and a registry `learning/sessions.js` (`read(kind,id)`, `write`, `clear`, `list(kind)`); retire the lab alias; write `docs/PROFILE-SCHEMA.md` and a `tools/test-profile-schema.mjs` that builds a profile through every feature and asserts the shape.

**H5. Linguistic and lookup knowledge is tabulated more than once.**
- Regular paradigm: `components.js:138-200` (`RE`, `FUT_END`, `COND_END`, `ISC_*`, `AUX`, `COMPOUND`, `regularForm`) re-implements what `conjugator.js:416` (`regularParadigm`) and `:424` (`irregularCells`) already export and what `games/questions.js:209` and `learning/questions.js:190` already use. The reference codex highlights irregular cells with the copy; lessons diagnose with the engine. `components.js:190` hard-codes the `-c`/`-sist` participle rule separately from `conjugator.js:190-191`.
- Auxiliary forms: `conjugator.js:281-284` `AUX_FORMS`, `components.js:147-150` `AUX`, `learning/questions.js:179` `AUXILIARIES` (derived; fine).
- Person labels: `conjugator.js:8`, `integration.js:38`, `progressive-content.js:10`, `legacy-progressive-content.js:14` (four spellings of lui/lei).
- Tense explanations in prose: `components.js:119-135` `TENSE_HELP`, `learning/content.js:18-29` `TENSE_LESSONS`, `views/learnVerb.js:24` — three texts for the same tenses.
- Weather verbs: identical sets in `content.js:50` and `sentence-lookup.js:13`.
- Lookup lexica: `verb-lexicon.js`, `verb-lexicon-extra.js`, `grammar-lexicon.js`, `course-v2-glosses.js` (76 KB of data in JS) each define their own `noun()/adjective()/verbForm()` constructors (`verb-lexicon.js:3-4`, `verb-lexicon-extra.js:3-4`, `grammar-lexicon.js:7-17`, `course-v2-glosses.js:4-9`) with four id prefixes (`verb:`, `verb-help:`, `grammar:`, `course-v2:`), merged at runtime by `sentence-lookup.js:5-7`.
- Helpers: `replayOrder` in `grammar-state.js:4` and `course-v2-state.js:8`; HTML `esc` in `ui.js:23`, `fx.js:9`, `learning/questions.js:7`, `lesson-overview.js:5`, `activity-panel.js:3`; the Italian normaliser (`normalize('NFC').toLocaleLowerCase('it')…`) in 15 modules with 5 different apostrophe/punctuation rules; a seeded LCG shuffle in `lesson-questions.js:14`, `lesson-activities.js:6-14`, `word-questions.js:59-60`, `learnAdaptive.js:20`; `BAD_KEYS` in `model.js:11`, `store.js:110`, `learnJourney.js:149,161`.
Fix (S each, M together): one `language/text.js` (esc, normIt, fold, stripAccents, seeded rng); delete `components.regularForm` in favour of `conjugator.regularParadigm`; one `language/lexicon.js` builder over JSON packs in `data/lexicon/`; one `PERSON_LABELS` export.

**H6. CSS: two definitions of the game widgets and a design document that no longer describes the sheets.**
Evidence: §2.4 — 56 selectors defined in both app.css §14 and games.css (the later sheet wins by source order, `index.html:26-38`); `DESIGN.md:121` (“`css/learn.css`, `css/reference.css`, `css/games.css` are loaded after it and may only add feature-specific rules”) versus 13 linked sheets; DESIGN.md §1 (“avoid … emoji used as icons”) versus `data.js:11-22` `CATS[].icon` and `games/index.js:26-47` `icon: '🃏'` rendered in `browse.js:63,75-76`, `reference.js:71`, `words.js:73`; `grammar-course.css` written minified while every other sheet is formatted and sectioned; 72 identical declaration blocks; the Learn hub split over four sheets.
Impact: a change to `.choice` or `.q-card` must be checked in two files; the design contract cannot be trusted by a new contributor; specificity is already being fought with 62 `!important`s (17 in views-c.css, 12 in grammar-course.css).
Fix (M): delete the §14 block from app.css or games.css (whichever loses — measure in the browser), move the 7 reference/views-b duplicates to one place, expand grammar-course.css, add utilities for the 7× kicker and 7× `:active` blocks, rewrite DESIGN.md §7.1 to list the real sheets and which screen each owns.

**H7. The retained generations cost ≈ 890 KB of install, 3 browser suites, 3 node checks and branches in 7 files, and the toggle that keeps them is on by default.**
Evidence: the toggle `adaptiveLearning` (`store.js:102`) is read at `learnVerb.js:91`, `learnWord.js:59`, `review.js:31`, `home.js:108,123`, `learnData.js:124`, `profile.js:117`; walkthrough results are translated into completions by `store.beginLegacyLessonRun/finishLegacyLessonRun` (`store.js:409-429`); `grammar-course.js:11-16` loads and indexes both courses (`allLessons = legacy + v2`) and `grammarProgress` branches on `lesson.targets` vs `lesson.objectives` (`:54-59`); `model.js:86-89,274` keeps a `grammar-v1` branch; `integration.js:185-239` keeps the old recommender “for exact legacy-session recovery”; `lesson-content.js:8` and `lesson-questions.js:9,35` keep the pre-v2 progressive flow for sessions without `verbFlowVersion` (`learnJourney.js:121-126`).
Fix: §5.3.

### Medium

**M1. Dense single-line code is a maintainability problem here, not a style quibble.**
Evidence: §2.2 — 29 % of bytes on >160-char lines; whole functions on one line (`course-v2-activities.js:28,41,44`: 1,500–2,083 chars; `courseSession.js:35` 1,324; `lesson-content.js` has 99 lines over 160 chars). No formatter configuration exists, and the dense files are exactly the ones a reviewer must read most (players, activities, content builders). `git blame`, `git diff` and PR review work line by line: a one-token change to a 2,000-character line shows the whole line as changed, and the browser suites fail by selector (`tests/README.md` “Selector policy”), so a reviewer cannot see which attribute moved.
Fix (S, mechanical): Prettier with `printWidth 140` (or dprint), one formatting commit recorded in `.git-blame-ignore-revs`, a formatter check in `check.yml`. Risk: the stamped service-worker hash changes (`tools/stamp-sw.mjs`), which is expected.

**M2. The router API is bypassed and route metadata is hand-maintained in three places.**
Evidence: `app.js:16,18` export `route`/`navigate`; no view imports them; 16 files assign `location.hash` directly; the tab-for-prefix mapping at `app.js:122` and the scene-for-prefix mapping at `app.js:73-82` must both be edited for a new section; 29 views import `setTitle`/`setChrome` from the entry module, which also makes views un-importable in Node.
Fix (S): move `setTitle/setTitleNode/setChrome/back/navigate` to `core/shell.js`; declare routes as `{ pattern, tab, scene, loader }` in one table.

**M3. Shared Learn-hub modules import lesson engines they do not need.**
Evidence: route `learn` static closure includes `course-v2-engine.js`, `sentence-lab.js`, `sentence-lookup.js` and the three lexica (207 KB extra) because `learnData.js`/`learnSections.js` import counts and progress helpers; `home.js` statically imports `games/index.js` → `games/questions.js` → `games/engine.js` (132 KB extra) to render a list of game names.
Fix (S): expose cheap summaries (`labLessonTotal`, a course-progress summary) from small modules; keep engines behind the routes that run them.

**M4. `check-shell.mjs` makes every module mandatory in the first install.**
Evidence: `check-shell.mjs:38,42` fail when any `js/**/*.js` or `css/*.css` is absent from SHELL (only `js/workers`, `models`, `vendor` are exempt, `:25`). Combined with `cache.addAll` (`sw.js:44`), a 10 MB atomic install is the floor and legacy or experimental modules (`assistant.js`, `fit-scorer.js`, `learnAdaptive.js`) cannot be optional.
Fix (S): allow a second list `OPTIONAL` (network-first, cached on use) and let `check-shell` require every module to be in one of the two lists.

**M5. Authoring sources live in `tools/`, generated artefacts in `data/` and `js/`.**
Evidence: `data/course-v2/{Foundations,A1,A2,B1,B2}.json` are written by `tools/author-course-beginner.mjs` (278 KB) and `tools/author-course-intermediate.mjs` (209 KB, which reads the *legacy* packs `data/grammar-course/B1.json` at `:6`); `js/learning/verb-progressive-data.js` is compiled from `data/verb-progressive/*.json` (933 KB → 640 KB) by `tools/build-verb-progressive.mjs`; `tools/` mixes these 8 authoring scripts with 42 CI scripts and nothing tells a contributor which are safe to run (`build-data.mjs` and `stamp-sw.mjs` rewrite files; `author-course-*.mjs` overwrite packs).
Fix (S): `tools/check/`, `tools/build/`, `tools/author/` (or authoring sources under `data/course-v2/src/`), and a “rewrites: …” header convention tabulated in README.

**M6. `docs/` is an archive, not documentation.**
Evidence: §2.5 — 26 files; 2.1 MB of JSON audit output next to the contracts; 7 orphan docs; names mix `UPPER-KEBAB.md`, dated `PLAN-…-2026-10-02.md` and lower-case `grammar-course-a1-a2.md`; implemented plans (`PLAN-LESSON-VOCABULARY-2026-10-01.md` says “Status: implemented”), acceptance specs, release notes, two contracts, five audits and one research note sit flat; `docs/grammar-course-*.md` describe the *earlier* course; the profile schema is undocumented (H4).
Fix (S): §5.1 layout; move JSON audit output to `docs/audits/data/` or out of the repo (it is 88 % of docs/ by bytes and excluded from the site anyway).

**M7. The check pipeline is proportionate in CI minutes but top-heavy in a few suites, and the browser matrix pays 20 Playwright installs per run.**
Evidence: §2.5 — build job 95 s; 8 of 37 node checks take 86 % of local time (`test-lesson-content` 44.7 s and `test-sentence-lookup` 40.0 s build the lookup index and every lesson for all 1,185 verbs); every browser job runs `npm install playwright` + `playwright install --with-deps chromium` (`browser.yml:29-30`, ~35–40 s each → ~12 runner-minutes per run of install alone); `e2e.mjs` (7.4 min) is the wall-clock critical path; the 1 Oct run shows queueing can push the wall to 34 min. Overlap: `test-course-v2-content --recovery`, `-engine`, `-durability`, `-editorial`, `-lexicon` and `test-course-words` all load all seven packs; `test-grammar-lexicon` and `test-course-v2-lexicon` both build the sentence-lookup index; `test-learning-integration`, `-completion`, `test-journey-integration` and `test-learning-questions` all load the dictionary and overlap on recommendation/eligibility.
Fix (S/M): `actions/cache` for the pinned Playwright install; split `e2e.mjs` into two matrix entries (routes / flows); a shared `tools/lib/fixtures.mjs` that builds the lookup index and lesson plans once per process; run the three verb-lesson content suites in one process.

**M8. Store surface: 663 lines with legacy translation, lab records and completion arithmetic inline; several fragile patterns.**
Evidence: `store.js:409-456` (walkthrough-result translation) and `:582-606` (lab records) are feature code inside the persistence class; `isLearned()` (`store.js:508`) calls `completionState` → `entryCompletion` → `journeyCaseProgress`, and `learnedIds()` (`:514`) calls it for every item, so every “count learned” on Home/Learn/scope/picker (`source.js:61-72` calls `resolveSource` per option) replays journey evidence per item — not measured, flagged as a likely hotspot; `touchDay()` writes during reads (`store.js:552-566`); `sync.js:5` `LS_KEY = (profileId = store.current.id)` throws if called before `store.init` (guarded only by call order); the `profile` event carries the profile from `switchProfile` (`:271`) but is emitted from `importJSON` too (`:652`) with different timing semantics.
Fix (M): split `store.js` into `core/store/{db.js, profile.js, learning.js, lab.js, legacy.js}` composed by the class; memoise `isLearned` per `learning.events` identity.

**M9. Naming does not say which generation a module belongs to.**
Evidence: `views/learnGrammar.js` plays the *earlier* course but is the route for *every* grammar lesson; `learning/grammar-course.js` is the registry of *both* courses; `course-v2-*` vs `grammar-*` vs `journey.js` vs `lesson-*` vs `legacy-progressive-content.js`; `integration.js` holds completion, review eligibility and two recommenders; views are camelCase and engines kebab-case; the workshop mixes Italian and English (`labFrasi.js`, `sentence-lab.js`, `labButton`).
Fix (S, with the layout in §5.1).

### Low

**L1. Dead and surplus exports** (§2.1): 11 dead functions (notably `components.js: wordCard, verbCard, entryList` and `ui.js: iconBtn, onEnter`, which DESIGN.md §7.7-7.8 still documents), 59 surplus `export` keywords, 4 unused default exports. Fix (S).

**L2. Documentation drift.** README.md:33 “runs 36 deterministic checks” vs 39 commands in `deploy.yml:34-72` (36 = `test-*` + `check-*` scripts); `tests/README.md:3-14` still presents `adaptive-e2e.mjs` as a primary suite; DESIGN.md §7.5 lists `pulse` (never imported) and §7.7 `iconBtn`/`onEnter` (dead). Fix (S).

**L3. Import-time side effects** in `ui.js:71-82,216-221`, `fx.js:647-653` (document listeners) and `store.js:663` (singleton) are fine in the browser but force Node suites to shim `localStorage`/`indexedDB` (`tools/test-store-durability.mjs:4` `MemoryStorage`). Fix (S): an explicit `installGlobalHandlers()` called from `app.js`.

**L4. Housekeeping.** An untracked `shell-bytes.mjs` (1.9 KB, created 22:10 UTC today, not by this review) sits at the repository root; `docs/` carries 2.1 MB of JSON that `build-site.mjs` must actively exclude; `tests/report-*.json` in the working tree are ignored build output (correct).

---

## 4. Strengths worth keeping

- **Pure engines with contracts.** `learning/model.js` (“No browser or store dependencies: identical evidence produces identical progress”), `course-v2-engine.js`, `course-v2-state.js`, `sentence-lab.js`, `conjugator.js`, `lesson-content.js` are DOM-free, imported by 15–20 Node suites and governed by `docs/COURSE-V2-CONTRACT.md` and `docs/SENTENCE-LAB-CONTRACT.md`. The `learnCourse.js` + `course-v2-activities.js` + `course-v2-engine.js` trio (thin view, pure presentation, pure engine) is the right shape and should be the template for the consolidation.
- **No circular imports** across 94 modules; clean leaves (`data.js`, `fx.js`, `conjugator.js`, `icons.js`).
- **Deployment discipline**: atomic precache with a content-hash `VERSION` (`sw.js:7`, `tools/stamp-sw.mjs`), `check-shell.mjs` guarding cache names and the on-demand model files, `build-site.mjs` verifying every SHELL entry, import and audio clip in `dist/`, `deploy.yml` publishing only after the browser matrix passes.
- **Deterministic, replayable evidence** with device/sequence identity, epoch-based resets and revision-checked sync (`sync.js:81-113`, `SETUP_SQL`).
- **Comments that state intent**, often with the bug they prevent (`store.js:74-77`, `app.js:85-88`, `fx.js:171-173`).
- **Test breadth**: 34 node suites + 21 browser suites with a stable selector policy, WebKit passes for the course and verb flows, a real service-worker upgrade test.
- **Lazy routes** (`app.js:170-196`) and the `games/index.js` registry with lazy game modules.

---

## 5. Reorganisation proposal

### 5.1 Target layout

```
js/
  core/        app.js (router table only: {pattern, tab, scene, loader}), shell.js (setTitle/setChrome/back/navigate),
               store/ (db.js, profile.js, learning-domain.js, lab.js, legacy.js → one Store class), sync.js, data.js, srs.js, source.js
  ui/          ui.js (html/esc/sheet/toast/speak), fx.js, icons.js, components.js (entry rows, heroes, conj pane),
               lesson-shell.js (viewport fit, header/progress/footer, pause, history banner, info menu),
               question-widgets.js (choice, typed+accents, order, match/pairs, letters, cloze blank, feedback bar),
               completion-menu.js
  language/    conjugator.js, irregular.js, text.js (esc, normIt, fold, stripAccents, seeded rng), content.js (anchor contexts,
               tense prose, weather set — one copy), lexicon.js (loader over data/lexicon/*.json), sentence-lookup.js
  evidence/    model.js (+ grammar-v1 and course-v2 replayers as strategies), sessions.js (typed session registry),
               completion.js (entryCompletion/isLearned, out of the store), review.js (eligibility, due), recommend.js
  courses/
    everyday/  registry.js (v2 loader only), engine.js, state.js, words.js, placement.js, media.js, activities.js (pure HTML)
    verbs/     journey.js, lesson-content.js, progressive-content.js (fetches data/verb-progressive.json), questions.js
               (merged learning/questions + lesson-questions + word-questions), activities.js (letters/pairs)
    workshop/  sentence-lab.js, data.js, activities.js
    legacy/    grammar-course-v1.js, grammar-journey.js, legacy-progressive-content.js, walkthrough/   ← deleted in §5.3
  games/       index.js, engine.js (runDrill over ui/question-widgets), questions.js (presentation wrappers), <games>
  screens/     home/, learn/ (hub, dash, sections, data), course/ (course, session, placement, player), lesson/ (journey player),
               workshop/ (path, player), review/, words/ (words, search, browse, lists, list, entry, add, reference, grammar), play/, profile/
  workers/
css/
  tokens.css · base.css · components.css · widgets.css (question widgets, feedback, lesson shell — one copy)
  screens/<screen>.css (one per screens/ folder) · games.css · reference.css
data/
  course-v2/ (packs) + course-v2/src/ (the authoring scripts, moved from tools/) · verb-progressive/ (+ built verb-progressive.json)
  lexicon/ (the four JS lexica as JSON) · sentence-lab/ · useful-words.json · PROFILE-SCHEMA.md
tools/
  check/ (check-modules, check-shell, test-*.mjs) · build/ (build-data, build-site, build-verb-progressive, build-course-map, stamp-sw) · author/
docs/
  README.md (index: what each doc is, status) · contracts/ · specs/ · plans/ (status line in each) · releases/ · audits/ (markdown; JSON under audits/data/ or out of the repo) · research/
```

Module-boundary rules to enforce with a check (`tools/check/check-layers.mjs`, a 30-line extension of `modgraph.mjs`): `language/` and `evidence/` import nothing from `ui/`, `screens/` or `core/store`; `courses/*/engine` import nothing from `ui/`; `screens/` are the only importers of `ui/lesson-shell` and `core/shell`; `core/store` imports nothing from `courses/`.

### 5.2 Consolidation path (ordered; each step ships alone)

1. **Formatter + layer check (S).** Prettier at 140 columns on `js/`, `css/grammar-course.css` expanded; `.git-blame-ignore-revs`; `check-layers.mjs` in `check.yml` *reporting only*. Risk: SW hash churn (expected); none functional.
2. **Boot diet (M).** `evidence/completion.js` out of `store.js`; lazy `course-v2-media`; `verb-progressive-data.js` → `data/verb-progressive.json` loaded on first `progressiveSpec()` (listed in SHELL as data). Verify with `modgraph.mjs` that the boot closure drops below 500 KB. Risk: the first verb lesson waits for a 640 KB fetch — precached, so only on the very first visit; `check-shell` must learn the new data file.
3. **Direct lesson routing (S).** `learn/verb`, `learn/word`, `learn/practice` → `learnJourney.js`; classic walkthrough behind `?classic=1`; delete the `legacy=1` branch; retarget `tests/adaptive-e2e.mjs` (or drop it in step 7). Risk: `tests/e2e.mjs` fixtures that toggle `adaptiveLearning` (`e2e.mjs:752-754`) must use the new query.
4. **Shared lesson shell and question widgets (M).** Extract from `learnCourse.js` + `course-v2-activities.js` (the cleanest copy); migrate `labFrasiLesson.js`, then `learnJourney.js` (replace `exerciseHTML`, `feedbackHTML`, `fitViewport`, pause/history blocks). Move widget CSS from journey.css/grammar-course.css/sentence-lab.css/adaptive.css into `widgets.css`. Risk: the browser suites key on `data-*` hooks (`tests/README.md`) — keep `data-choice`, `data-token`, `data-pair-left`, `data-focus`, `data-feedback-bar` identical; run all 20 suites.
5. **One question builder (M).** Fold `word-questions.js` into `learning/questions.js` as word objectives, make `lesson-questions.js` a thin journey adapter, reduce `games/questions.js` to prompt-HTML wrappers around `buildQuestion` (it already annotates through it, `games/questions.js:9,24-35`), replace `labFrasiLesson.buildDrills` (`:45-58`) with the same builder. Risk: question text changes break the e2e answer oracle (`tests/lib.mjs`, recognised by `.prompt` tags) — keep tags.
6. **Session registry + profile schema (M).** `evidence/sessions.js` with `kind`; classify on read; `data/PROFILE-SCHEMA.md`; `tools/test-profile-schema.mjs`. Risk: sync merge of old-vs-new keyed sessions — keep `learningSessionKey`, add `kind` as a field, retire the lab alias after one release.
7. **Legacy retirement (§5.3).**
8. **Evidence compaction (L).** Append-only `recordAttempt`, incremental index, summary records, delta sync (C1). Risk: replay determinism — summaries must be produced by `analyze()` itself (serialise its per-objective tracker state) so that `skillState(summary + newer events)` equals `skillState(all events)`; add a differential test over the journey/course fixtures in `tools/test-journey-model.mjs` and `tools/test-course-v2-durability.mjs`.
9. **CSS and docs** (M6/H6): split app.css into tokens/base/components/widgets, delete the duplicated §14, per-screen sheets; docs index and folders.

### 5.3 Legacy retirement plan

What must keep working (user data): `profile.items` SRS records and `learned/learnedAt` flags; `learning.completions` with `source:'legacy'` and ids `legacy:<entryId>` (`store.js:178,468`); events with `policy` undefined (v1 adaptive loop, `model.js:272-279` non-journey branch, `required 4`) and `policy:'grammar-v1'` (`model.js:86-89,274`, `grammar-state.js`); `preferences.legacyTenses/coreOrderVersion` migration (`model.js:171-173`); v1 grammar sessions (`grammar.version 1`), v1 adaptive sessions (`ui.version 1`), journey sessions without `verbFlowVersion` (`learnJourney.js:121-126`); `data/course-v2/legacy-map.json` (52 KB); `lab` records.

| step | delete | keep / migrate | tests to drop or retarget |
|---|---|---|---|
| A. v1 adaptive loop (after §5.2 step 3) | `views/learnAdaptive.js` (35 KB), `css/adaptive.css` (10 KB), `integration.js:185-252` (`recommend`, `courseProgress`), `curriculum.js:70-84` (`stageObjectives`) if `test-learning-integration` is retargeted | events without `policy` (replay branch stays); v1 sessions are already superseded on open (learnJourney never reads `ui.version 1`) — drop them in `normalizeLearning` after one release | `tests/adaptive-e2e.mjs` (72 s job); the `recommend()` parts of `tools/test-learning-integration.mjs`/`-completion.mjs` |
| B. earlier grammar course | `data/grammar-course/*.json` from SHELL and repo (703 KB), `grammar-journey.js`, the inline player in `learnGrammar.js:22-124` (keep a 10-line dispatcher or route straight to `learnCourse`), `course.js: legacyCourseHistory` UI, `tools/author-course-intermediate.mjs:6` reads of the old packs | `grammar-state.js` (`grammarSkill`) so `grammar-v1` evidence still counts as *completed* for the “earlier course work” summary and never reviews; a ~10 KB `data/course-v2/legacy-titles.json` (id → title/level) for that summary instead of the packs; `legacy-map.json` for the “what replaced it” link | `tools/test-grammar-course.mjs`, `test-grammar-durability.mjs`; retarget `test-grammar-lexicon.mjs:78` and `tests/grammar-offline-e2e.mjs:112` at a v2 pack (the SW-upgrade test is valuable); drop `tests/grammar-course-e2e.mjs` |
| C. original walkthrough | `views/walkthrough.js`, `learnVerb.js` body (`renderLegacy`, ~350 lines), `learnWord.js` body, `css/learn.css` (22 KB), `review.js:32-84` classic runner, `store.beginLegacyLessonRun/finishLegacyLessonRun` (`store.js:409-429`), the `adaptiveLearning` setting and its 7 readers, `tests/e2e.mjs` classic fixtures (`:752-754`) | `items` and `legacy:` completions (data); `fx.js` scene pieces stay (used by Home/Reference); `runDrill` stays for games | `tests/e2e.mjs` walkthrough fixtures; DESIGN.md §7.4 “Scenes (walkthroughs)” |
| D. pre-v2 progressive flow | `legacy-progressive-content.js` (20 KB), `buildLesson(…,{legacy:true})` (`lesson-content.js:514`), `lesson-questions.js:9,35` flow-version branches, `learnJourney.js:121-126,434-445` held-question path | sessions holding a legacy question: one-release grace (they resume into the v2 flow at the next chapter boundary) | legacy fixtures in `tools/test-progressive-content.mjs`, `test-verb-flow-v2.mjs` |

Order: A (no data risk) → D (one release of grace) → B (needs the titles file first) → C (needs the product decision that the cinematic walkthrough is gone; the toggle default is already “on”). Each step: run `tools/test-store-durability.mjs`, `test-learning-store-sync.mjs`, a backup round-trip with a pre-retirement profile fixture (none exists today — create `tests/fixtures/profile-v2-full.json` by driving every feature once), stamp the SW. Savings when complete: ≈ 890 KB precache (−9 %), 3 browser jobs (≈ 3.5 runner-minutes per run), 2–3 node suites, 7 toggle branches, two module hops on the default lesson, and the dual-registry logic in `grammar-course.js:54-76`.

### 5.4 Top 10 code-health fixes, in priority order

| # | fix | effort | finding |
|---|---|---|---|
| 1 | Append-only `recordAttempt` + incremental evidence index; stop deep-copying/re-normalising all events per answer | L (M for the first 80 %: skip re-normalisation, keep the cache keyed on `events` identity) | C1 |
| 2 | Take `entryCompletion`/`course-v2-media` out of `store.js`; load `verb-progressive-data` as JSON on demand | M | H1 |
| 3 | Route `learn/verb`, `learn/word`, `learn/practice` straight to `learnJourney.js` | S | H3 |
| 4 | Extract `ui/lesson-shell.js` + `ui/question-widgets.js` from `learnCourse`/`course-v2-activities`; migrate the lab and journey players | M→L | H2 |
| 5 | Prettier at 140 cols, one formatting commit, formatter check in CI | S | M1 |
| 6 | Delete `components.regularForm` and the duplicated AUX/paradigm tables in favour of `conjugator.regularParadigm`; one `language/text.js`; one weather set, one person-label table | S | H5 |
| 7 | Retire the v1 adaptive loop (step A) and the pre-v2 progressive flow (step D) | S+S | H7 |
| 8 | Typed session registry + `docs/PROFILE-SCHEMA.md` + schema test | M | H4 |
| 9 | Remove the duplicated app.css §14 / games.css block; expand grammar-course.css; rewrite DESIGN.md §7.1; per-screen CSS ownership | M | H6 |
| 10 | Cache the Playwright install in `browser.yml`; split `e2e.mjs`; share lesson/lookup fixtures between the slow node suites | S | M7 |

---

## 6. Status of the earlier audits' observations

`docs/AUDIT-2026-10-01.md` (baseline f20c084):

| # | observation | status at bd60180 |
|---|---|---|
| 1 | README not updated for the course | **Resolved** — README.md:11-27 describes the course, hub, workshop, check suites and caches. |
| 2 | Deploy runs no browser suites | **Resolved** — `deploy.yml:82-88`: `browser` job (reusable `browser.yml`, 20 suites), `deploy needs: [build, browser]`. |
| 3 | 111 files / ~7 MB precache, VERSION bumped by hand | **Partly resolved / grown** — VERSION is now content-stamped (`sw.js:2-7`, `tools/stamp-sw.mjs`, checked by `check-shell`); the install is now 134 files / 10.0 MB (§2.3). |
| 4 | 2.1 MB JSON audit output deployed with the site | **Resolved for the site** (`build-site.mjs:24` excludes `docs/`; `verifySite` fails on leaks), **open in the repo** (still 2.1 MB under `docs/`). |
| 5 | No physical iPhone check recorded | **Unchanged** — nothing in the repo records one (not verifiable here). |

`docs/APPLICATION-AUDIT-2026-09-29.md` (baseline e6d33a9):

| # | finding | status |
|---|---|---|
| 1 | Lesson mistakes not retained as evidence | **Resolved** — every player records through `store.recordLearningAttempt` (`learnCourse.js:166`, `learnJourney.js`, `labFrasiLesson.js`, games `engine.js:253`). |
| 2 | Whole-verb mastery conflates skills | **Resolved** — per-objective skills (`curriculum.js:21` `objectiveId`, `model.js:420` `skillState`), per-case completions (`store.js:391-405`). |
| 3 | Review can introduce untaught grammar | **Resolved** — `review.js:18-23` draws only from `reviewableTenses` (`integration.js:31-35`); games use `allowedTenses` (`games/questions.js:10`). |
| 4 | Walkthrough checks breadth, not durable skill | **Superseded** — the journey is the default; the walkthrough remains as the opt-out (H7). |
| 5 | `sto` + citation gerund for reflexives in the walkthrough | **Resolved** — no `sto` prefix remains in `learnVerb.js`; progressive forms are built per verb (`progressive-content.js`). |
| 6 | Backups/sync need an explicit migration; auto-push without pull | **Resolved** — `importJSON` merges learning/lab/customDeleted with epoch ordering (`store.js:615-643`); `syncNow` pulls, merges, saves, then pushes with a revision check and retries (`sync.js:86-106`); `test-learning-store-sync.mjs`, `test-learning-sql.mjs`. |
| 7 | Tests incomplete: no browser E2E in deploy, SW blocked | **Largely resolved** — 20 suites gate deploys; `offline-e2e.mjs`/`grammar-offline-e2e.mjs` exercise the real worker; WebKit for three suites. Still Chromium-emulated phones, not devices. |

---

## 7. What was verified vs inferred

Verified by reading or running:
- Every file:line reference above was read in this session (`app.js`, `store.js`, `sync.js`, `data.js`, `ui.js`, `components.js`, `fx.js`, `srs.js`, `source.js`, `completion-menu.js`, `conjugator.js`, `games/engine.js`, `games/index.js`, `games/questions.js`, `learning/{model, questions, lesson-questions, word-questions, lesson-activities, activity-panel, course-v2-activities, course-v2-state, grammar-state, grammar-course, grammar-journey, integration, curriculum, sentence-lab-activities, sentence-lab-data}.js`, the heads of `course-v2-engine.js`, `sentence-lab.js`, `journey.js`, `lesson-content.js`, `progressive-content.js`, `legacy-progressive-content.js`, the lexica, `views/{learnGrammar, learnCourse, learnAdaptive, walkthrough, review}.js`, the first 140 lines of `learnJourney.js` and 130 of `labFrasiLesson.js`, `learnVerb.js:75-114`, `learn.js:1-60`, `sw.js`, `index.html`, the three workflows, `tools/{build-site, check-shell}.mjs`, `tests/README.md`, README, DESIGN §1/§7, the two contracts, both earlier audits).
- Module graph, closures, fan-in/out, unused exports: `modgraph.mjs` + `refine.mjs` (regex parser over comment-stripped source; `page.evaluate` imports in tests resolved against the site root). Not an AST: `export const {a, b} =` and re-exports are handled; an import hidden in a template string would be missed (none seen).
- Precache bytes, legacy share, density, CSS statistics: `precache.mjs`, `refine.mjs`, `cssaudit.mjs` (crude CSS rule parser; nested `@media` handled). The “unreferenced class” list is a token-search heuristic with dynamic prefixes excluded — candidates to check in the browser, not certainties.
- Timings: `check-times.tsv` (local; sandbox shared with another process for part of the run) and the GitHub Actions job timestamps for runs 37044189794 and 36892953059 (`gh api`).
- Evidence growth: `bench2.mjs` with synthetic journey-v1 events in Node 22; absolute milliseconds are sandbox numbers, the growth curve is the point.
- `tests/report-*.json` not committed: `git ls-files` + `.gitignore`.
- Repository state: `git status` clean apart from the untracked `shell-bytes.mjs` created by another process at 22:10 UTC; `data/stats.json` untouched.

Inferred (not measured):
- That a phone is slower than this Node benchmark, and that course events (more fields; `diagnostic` objects are stripped by `normalizeEvent`) are of similar size.
- That `isLearned()`/`learnedIds()` replaying journey evidence per item is a user-visible cost on Home/Learn (M8) — plausible from the call graph, unmeasured.
- Which of the duplicated app.css §14 / games.css rules wins on screen (H6): source order says games.css; per-selector specificity was not checked.
- That the three sequential dynamic imports on the default lesson route (H3) are perceptible: a function of network latency on first visit; once precached they are cache hits.
- CI runner-minute estimates (≈ 12 min of Playwright installs, ≈ 3.5 min for legacy suites) derive from job timestamps, not billing data.
- No browser suite or `build-site.mjs` was run here (the latter writes `dist/`), and no live-site bytes were fetched; “identical to live” is taken from the task statement and the successful deploy run of `bd60180`.
