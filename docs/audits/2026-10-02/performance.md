# Parola — performance, offline, resilience and accessibility audit

Branch `claude/dreamy-darwin-fqjhm8`, commit `bd60180`, 2 October 2026. Read-only review of `/home/user/italianapp`; all scripts, logs, JSON and screenshots are in `scratchpad/audit2/perf/` (names in parentheses; not committed). Chromium 1194 / Playwright 1.63, iPhone 13 profile at 430×932. Servers: `python3 -m http.server` :8132 (no compression, `Last-Modified` only) and `throttle-server.mjs` (GitHub-Pages-like `ETag` + `Cache-Control: max-age=600`, optional gzip, optional slow-4G pacing: 150 ms RTT, 1.6 Mbps shared). CDP throttling: `Network.emulateNetworkConditions` (slow 4G) and `Emulation.setCPUThrottlingRate` 4×. Medians of 3 unless noted. **Caveat:** three other audit agents ran Chromium/Node workloads on the same 4-core host throughout (load average 6–13), so CPU-bound absolute timings are pessimistic; network-bound numbers are unaffected and relative comparisons hold. The `boot-isolated.json` pass ran last, under less load; the earliest smoke test (load ≈1) gave 958 ms for a fast cold `#/home`.

## 1. Verdict

The offline story is excellent and the resilience paths are real: atomic shell install with revalidation, IndexedDB→localStorage fallback, unload mirror, old-schema migration, per-route error boundary, and every screen including lessons, review and games works offline. The app's problems are **what it makes the phone do before it shows anything and on every answer**:

1. The first screen waits for the whole dictionary, all thirteen course packs and a 1.23 MB JS graph that includes 655 KB of verb data Home never uses (8.4 MB raw / 1.9 MB gzip, 64 requests). Slow 4G cold start: 11 s with gzip, 48 s uncompressed. Even SW-served, paint is gated by ~0.7–1 s of main-thread parse/evaluate at 1× CPU and 3–5 s at 4×.
2. The evidence log is replayed and deep-copied on every answer, every Home render and every save, and is never compacted: answer cost grows from 0 ms to 50 ms (2k events), 0.5 s (6k) and 2.6 s (24k); Home from 10 ms to 2.4 s, 9 s and 12 s.
3. Accessibility is above average for a bespoke design system but has concrete, cheap-to-fix gaps (semantics of the tap-to-reveal pattern, live regions, headings, `lang`, tiny mono labels, zoom lock).

## 2. Measurement tables

### 2.1 Precache / shell size (`shell-bytes.mjs`)

| | files | raw | gzip -6 | brotli -5 |
|---|---|---|---|---|
| sw.js SHELL (133 entries = 132 files; `./` and `./index.html` are the same file) | 132 | **10.36 MB** | 2.29 MB | 2.12 MB |
| JSON data | 31 | 7.69 MB | ≈1.6 MB | |
| JS | 87 | 2.28 MB | ≈0.6 MB | |
| CSS | 13 | 368 KB | ≈60 KB | |
| `data/vocab.json` | 1 | 2.44 MB | 755 KB | 590 KB |
| `data/verbs.json` | 1 | 1.01 MB | 296 KB | 235 KB |
| `js/learning/verb-progressive-data.js` | 1 | 655 KB | 161 KB | 120 KB |
| course-v2 packs (7) | 7 | 2.87 MB | 337 KB | |
| grammar-course legacy packs (6) | 6 | 703 KB | 101 KB | |

Cache Storage after install: 12.2 MB (`navigator.storage.estimate()`: caches 12,198,400 B, indexedDB 2.7 KB, SW registration 10.5 KB). GitHub Pages serves gzip (no brotli), so ≈2.3 MB over the wire per full install; parse cost on the phone is the raw size.

### 2.2 Boot (`boot.mjs` → `boot-isolated.json`, `boot-contended.json`, `boot-slow-gzip.json`)

"Spinner gone" = the boot placeholder replaced by the first screen (MutationObserver on `#view`), ms after navigation start; SW blocked; *cold* = fresh context, *warm* = same context (HTTP cache).

| profile | route | cache | spinner gone | FCP | requests | transfer | JS | JSON | long tasks n / total / max | DOM nodes | JS heap | vocab.json parse |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fast (isolated) | #/home | cold | **1712 ms** | 228 | 64 | 8.39 MB | 34 / 1.23 MB | 6.79 MB | 3 / 1044 / 564 ms | 299 | 18.0 MB | 98 ms |
| fast | #/home | warm | 1316 | 200 | 66 | 11 KB | | | 2 / 370 / 370 | 299 | 58.8 MB* | 268 |
| fast | #/learn | cold | 1551 | 220 | 68 | 8.49 MB | 38 / 1.33 MB | 6.79 MB | 5 / 959 / 302 | 258 | 18.5 MB | 67 |
| fast | #/learn | warm | 1585 | 176 | 68 | 0 | | | 2 / 499 / 296 | 258 | 56.5 MB* | 150 |
| cpu4x (isolated) | #/home | cold | **3320** | 408 | 64 | 8.39 MB | 34 / 1.23 MB | 6.79 MB | 5 / 958 / 742 | 299 | 18.0 MB | 186 |
| cpu4x | #/home | warm | 2143 | 1264 | 65 | 0 | | | 2 / 565 / 503 | 299 | 58.3 MB* | 265 |
| cpu4x | #/learn | cold | 2798 | 440 | 70 | 8.50 MB | 38 / 1.33 MB | 6.79 MB | 8 / 1898 / 813 | 258 | 18.5 MB | 151 |
| cpu4x | #/learn | warm | 2495 | 336 | 70 | 0 | | | 7 / 1102 / 418 | 258 | 56.3 MB* | 268 |
| slow4g, uncompressed (:8132, CDP) | #/home | cold | **47 985** | 2820 | 66 | 8.40 MB | | | 4 / 1649 / 848 | 299 | 18.0 MB | 28 503† |
| slow4g, uncompressed | #/learn | cold | 48 197 | 2736 | 70 | 8.50 MB | | | 11 / 2337 / 1052 | 258 | 20.1 MB | 28 879† |
| slow4g + gzip (server-paced :8136) + cpu4x | #/home | cold | **11 091** | 892 | 66 | **1.88 MB** | | | 3 / 962 / 694 | 299 | 18.0 MB | 158 |
| slow4g + gzip + cpu4x | #/home | warm | 2333 | 328 | 66 | 1 KB | | | 3 / 666 / 571 | 299 | 58.7 MB* | 258 |
| slow4g + gzip + cpu4x | #/learn | cold | 11 320 | 852 | 70 | 1.91 MB | | | 6 / 1403 / 452 | 258 | 33.7 MB | 193 |
| slow4g + gzip + cpu4x | #/learn | warm | 2176 | 404 | 74 | 0 | | | 6 / 1038 / 355 | 258 | 56.2 MB | 238 |

\* warm heaps are read before GC runs on the 7 MB of parsed JSON garbage (cold runs got a GC during the slower load) — transient, not a leak. † includes waiting for the body under throttling (`Response.json()` wrapper). First-pass contended numbers (`boot-contended.json`) for fast/cpu4x were 10–35 % higher.

**What loads before the first screen** (cold `#/home`): 64 requests — 34 JS modules (1.23 MB: `verb-progressive-data.js` 640 KB, `journey.js` 65 KB, `lesson-content.js` 60 KB, `store.js` 38 KB, `questions.js` 34 KB, `model.js` 33 KB, `fx.js` 32 KB, `irregular.js` 30 KB, `conjugator.js` 30 KB, `games/questions.js` 27 KB, `components.js` 24 KB, `games/engine.js` 23 KB…), 13 stylesheets (368 KB), 16 JSON files (6.79 MB: vocab, verbs, stats, 7 course-v2 packs, 6 grammar-course packs). `#/learn` adds `sentence-lab.js`, `sentence-lookup.js`, `course-v2-glosses.js`, `course-v2-engine.js`, `grammar-lexicon.js`, `verb-lexicon*.js`, `learnDash.js`, `learnCards.js` (38 modules, 1.33 MB). No failed request and no unhandled rejection in 60 boots. No double fetch from the `preload as=fetch` hints (one request per file).

**Why:** `boot()` (`app.js:202-217`) starts `loadData()` and `loadGrammarCourse()` and **awaits both before `render()`**, then runs `attachLessonVocabulary()`. The verb-data module is a static import chain: `store.js:6-7` → `learning/integration.js:5` → `lesson-content.js:7` → `progressive-content.js:4` → `verb-progressive-data.js` (also pulling `conjugator.js`, `irregular.js`, `journey.js`, `questions.js`; 900 KB raw / 245 KB gz). Home additionally imports the games engine (`views/home.js` → `games/index.js` → `games/engine.js` + `games/questions.js` + `learning/diagnose.js`, 82 KB) for the games reel. JSON is parsed on the main thread inside `Response.json()` (`data.js:29`); packs parse in the same window (7 × 76–294 ms).

**CPU profile of a cold `#/home` boot** (`profile.mjs`, CDP sampling profiler, inclusive times): at 1× — `boot()` 615 ms of which `attachLessonVocabulary()` **580 ms** (`wordsCheckSteps` 308, `resolveLessonWords` 255; `course-words.js norm()` is the top self-time function), Home `render()` 392 ms (`recommendLesson` 55, `reviewItems` 33, `fx.mount` 37), JSON parse 51 ms + `Response.json` 8 ms, GC 154 ms. At 4× — `attachLessonVocabulary()` 1161 ms, `render()` 720 ms, JSON 136 + 106 ms, GC 452 ms. `#/learn` at 4× — `attachLessonVocabulary()` 3031 ms, `buildLesson` 1836 ms, `learnCards.fitText` 268 ms, `fx.update` 242 ms. Trace (`trace.mjs`, 1×, late run): RunMicrotasks 666 ms, `v8.callFunction` 337 ms, Layout 55 ms, GC 53 ms before spinner-gone at 1258 ms.

Memory after opening screens (`runtime.json`, `performance.memory`): Home 19.1 MB, Learn 18.8, course lesson (question) 24.6, verb lesson 22.2, word lesson 23.1, workshop lesson 24.7, review 22.4, crossword 24.5. DOM nodes 88–414 (crossword largest).

### 2.3 Service worker install, update, SW-served boot (`sw-install.mjs` → `sw-install-*.json`, server logs `srv81*.log`)

| server | first boot (no SW) | SW install (register→installed) | install-only traffic | update install (only `sw.js` changed) | storage |
|---|---|---|---|---|---|
| fast + gzip (:8147) | 3.45 s | **2.78 s** | 69 req: 37×200 = 295 KB, 32×304 | **4.9 s, 134 req: 1×200 (4 KB) + 133×304** | 12.2 MB caches |
| slow 4G + gzip (:8136) | 12.8 s | **9.65 s** | 94 req: 59×200 = 407 KB, 35×304 | 9.15 s, 134 req, 133×304 | 12.2 MB |
| slow 4G uncompressed (:8133) | 46.6 s | 11.05 s | 105 req: 65×200 = 1.48 MB, 40×304 | 9.75 s, 134 req, 133×304 | |

The page's own files revalidate as 304s during install (good: `sw.js:41-44`); the full bodies are the views, games, sentence-lab packs, `grammar.json`, `useful-words.json`, `audio.json` the page had not touched. An update costs one conditional round trip per shell file whatever changed (`cache: 'no-cache'` forces it regardless of `max-age=600`; on GitHub Pages Fastly's per-content ETag gives the same 304 pattern). After the update the next hash navigation reloaded itself (`navType: reload`, `controller: true`).

SW-served boots (worker controlling the page, 64/64 responses `fromServiceWorker`, 0–1 server requests): fast-gzip run — 1× CPU **2624 ms** (long tasks 737 ms, max 681), 4× **9209 ms** (4821 ms, max 2156); slow4g-gzip run — 1× 3812, 4× 8553 (both runs contended; compare 3320 ms for cold 4× without SW in the isolated pass). SW serving removes the network but not the parse/evaluate gate, and 64 `cache.match` round trips add overhead.

### 2.4 Storage and the evidence log (`storage.mjs` → `storage.json`)

2,000 events seeded through `store.recordLearningAttempt` (journey-v1 shape, 160 A1 entries × 6 objectives), then 4,000 and 18,000 injected directly plus 20 real attempts at each size:

| events | profile JSON | per-attempt (median / p90 / max) | `completionState(verb)` cold | `allSkills` cold / warm | `dueSkills` cold / warm | `reviewItems` | `recommendLesson` | `normalizeLearning` | JSON round-trip (save) | `saveNow` | IDB usage | heap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 1 KB | – | 14 ms | 0 / 0 | 13 / 23 ms | 5 ms | 6 ms | 0 | 0 | 6 ms | 5 KB | 18 MB |
| 2,000 | **1.26 MB** | **50 / 122 / 1072 ms** (36 / 90 / 584 in a quieter run) | 66 ms | 338 / 46 | **1863 / 1395** | 1452 | 976 | 44 | 64 | 393 | 162 KB | 113 MB |
| 6,020 | 3.59 MB | **509 / – / 877 ms** | 135 | 300 / 65 | 4788 / 4077 | 4698 | 4331 | 201 | 156 | 695 | 447 KB | 178 MB |
| 24,040 | **14.05 MB** | **2602 / – / 4329 ms** | 985 | 1138 / 60 | 20 554 / 20 034 | 13 874 | 14 721 | 327 | 201 | 874 | 1.69 MB | 260 MB |

Home render with 24k events: 12.1 s (long tasks of 9.5, 10.5, 27.7, 52.9 and 114 s appeared during the seeding/measurement sequence); reboot with 24k events: 18.1 s to first screen (one 16.9 s long task), heap 143 MB. Compaction: 24,040 events before save, 24,040 after `normalizeLearning` — nothing prunes the log. localStorage holds only `it.profiles` (111 B), `it.currentProfile`, `it.learningDevice`, `it.learningSequence`, plus the full-profile mirror `it.pendingProfile` while a save is pending.

Code facts: `recordLearningAttempt` (`store.js:346-369`) → `skillState()` (rebuilds the evidence context on a cache miss, `model.js:392-411`) → `recordAttempt()` which **deep-copies and re-normalises every event** (`model.js:237-245` → `normalizeLearning` → `plain()` + `normalizeEvent()` per event) and returns a new object, which misses the `WeakMap` caches (`model.js:392`, `journey.js:727`) so the next read replays the log; `save()` then `JSON.parse(JSON.stringify(profile))` on the 400 ms debounce (`store.js:316`); `eligibleSkills()` (`integration.js:52-119`) calls `allSkills()` and per scoped entry `lessonObjectives()`/`journeyChapterCompletions()`; Home calls `reviewItems()` and `recommendLesson()` (`views/home.js:107,123`), each running `eligibleSkills`. `resetProgress` is the only path that drops events (new epoch); `removeCustomWord` deliberately keeps tombstoned events (`store.js:545`). The pending-save mirror catches quota errors silently (`store.js:237`): with a ~5 MB localStorage budget (UTF-16 doubles the byte count) the mirror stops working at a profile of ≈2.5 MB, i.e. ≈4,000 events — inferred from the measured sizes.

### 2.5 Runtime (`runtime.mjs` → `runtime.json`, `leak2.mjs`)

| screen | blur panes visible / total | infinite animations | idle rAF/s · timeouts/s · new intervals | DOM nodes | listeners | heap |
|---|---|---|---|---|---|---|
| Home | **5** / 5 | 6 (3 orbs, ticker, 2 night-card floats) | 0 · 0 · 0 | 299 | 43 | 19.1 MB |
| Learn | 2 / 2 | 3 (orbs) | 0 · 0 · 0 | 258 | 58 | 18.8 |
| Course / Games / Words / Me | 1–2 | 3 (+ avatar spin on Me) | 0 · 0 · 0 | 223–407 | 50–103 | 19–21.5 |
| verb / word / course lesson, workshop lesson | 0–1 / 1 | 3 | 0 · 0 · 0 | 88–200 | 88–161 | 22–24.7 |
| review, quiz, crossword, entry | 1–2 / 1–3 | 3 | 0 · 0 · 0 | 134–414 | 48–106 | 22–24.5 |

`#topbar::before` blur is inactive at scroll top (opacity 0, `app.css:175`). All screens stay within DESIGN.md's 6-pane budget. Under `prefers-reduced-motion: reduce`: 0 running animations on every screen (orbs still carry a static `filter: blur(60px)`, a one-off raster cost); the shared scroll loop returns early (`fx.js:59`). Leak loop Home→Learn→verb lesson→Home ×20: heap after GC 15.0 → 17.3 (loop 1) → 18.1 (10) → 18.2 MB (20) — a plateau; CDP listener count 39 → 57 (+0.9/loop); attached DOM constant at 299 nodes; a heap snapshot after 10 loops shows **0 detached DOM nodes**; no intervals created; window/visualViewport listeners constant.

### 2.6 Offline (`offline.mjs` → `offline.json`; real SW install on the GitHub-Pages-like server, `setOffline(true)`, reload)

**21/21 routes rendered with 0 failed requests, 0 page errors, 0 console errors**: Home, Learn, Course, Play, Words, Me, course lesson `v2-a1-essere-singular` (driven to a question), verb lesson mangiare/present (to a question), word lesson casa, workshop list + `sl-presente-01-chi-sono`, Review, quiz, dictation, entry/reference/grammar pages, search, browse, scope, lists.
- Speech is local (`ui.js:195-214`, `lang = 'it-IT'`); dictation and speaker buttons ran without error (no voices in headless).
- Course audio is on demand by design; passages fall back to `speak()` (`learnCourse.js:227`); downloaded units are served with byte ranges (`sw.js:64-77`).
- Fit scorer: `fitScorerStatus()` → `installed:false`; `installFitScorer()` resolved `installed:true, 83,264,743 B` while offline — the files came through the sandbox's HTTP cache, so this result is inconclusive for a real device; the scorer code itself is precached and `fitNote/scoreFit` degrade to the fallback span.
- Assistant: `assistant.js:12,121` imports WebLLM from `https://esm.run/@mlc-ai/web-llm@0.2.85` at runtime; offline `enableAssistant()` returned null without throwing (breaker/support path). Its 340 MB of weights live in `webllm/*` caches that activation preserves (`sw.js:17,46`).
- Fonts: loaded as a `media="print"` sheet switched on `onload` (`index.html:22`) — never blocks paint. Offline reload still rendered Fraunces/Manrope/JetBrains Mono because the HTTP cache held the 24 h CSS and 1-year font files; nothing in the app controls that (cross-origin, `sw.js:93`), so after the CSS entry expires an offline cold start renders the fallback stack with different metrics (`onlineMetrics`/`offlineMetrics` identical here only because the cache was warm).

### 2.7 Update while a lesson is open (`update.mjs` → `update.json`) — PASS

Verb lesson opened and one question answered (1 event, session index 1, phase `feedback`); server switched `sw.js` VERSION; `registration.update()` → `activated`, `controllerchange` while the lesson stayed on screen (same document, no errors); continuing on the old modules still worked (phase → `repair`, 0 errors); the next hash navigation produced `navType: reload` with **events 1, XP 0, same session id/index/question id, `it.pendingProfile` empty**, caches `[parola-course-audio-v2, parola-v15-…-upd2]`; reopening the lesson resumed at the same question.

Code path: `skipWaiting` + `clients.claim` (`sw.js:44,46`); the page flags `swUpdated` on the second `controllerchange` (`app.js:88,230-231`) and `render()` reloads **before** running the outgoing screen's cleanup (`app.js:112` vs `:117`). Safe here because every lesson/placement screen persists per action (`learnJourney.js:217`, `learnGrammar.js:28,86-111`, `coursePlacement.js:13,30`) and the reload's `pagehide` runs `_mirrorPending()` + `saveNow()` (`store.js:230`). `reg.update()` on every return to the foreground (`app.js:234`).

### 2.8 Resilience (`resilience.mjs` → `resilience.json`, `throttle-server.mjs --break`)

| scenario | result |
|---|---|
| `window.indexedDB` throws `SecurityError` (Safari "Block all cookies"/embedded) | boots; profile saved to `localStorage` `kv:profile:<id>` (975 B) |
| `indexedDB.open()` → `onerror` | boots; localStorage fallback |
| `localStorage.setItem` throws `QuotaExceededError` (IDB healthy) | boots, saves via IDB; mirror silently skipped; no `saveError` |
| IDB `put` aborts (quota/I-O) | `saveError` emitted once, profile stays dirty, 1 040 B mirror in `it.pendingProfile` (`store.js:331-334`) |
| v1 profile (no `learning`/`lab`/`scope`, legacy `items`, invalid level/theme) | normalised: version 2, level→A1, learning v5, 3 legacy completions, `isLearned('v:essere')` true, unknown-id progress kept but uncounted |
| `data/course-v2/A1.json` truncated (HTTP 200, invalid JSON) | Home boots; **Learn and Course show "Qualcosa è andato storto … Expected double-quoted property name"** — every view awaiting `loadGrammarCourse()` (`learn.js:81`, `course.js:57`, `courseSession.js:38`, `learnGrammar.js:18`, `coursePlacement.js:10`) re-throws because `pending` resets on failure (`grammar-course.js:45`) |
| `data/vocab.json` → 500 / truncated | "Could not load the dictionary… Retry" (`app.js:219`) |
| `data/stats.json` → 404 | boots (optional, `data.js:34`) |
| schema skew: 50 entries stripped of `pl/forms/ex/en/level/cat`, one id-only entry | browse, entry, word lesson, quiz, review render with blanks, 0 errors |

Sync (`sync.js`, read only, no network): pull → merge via `importJSON(merge:true)` → `saveNow` → `parola_save_profile(expected_revision)` with 5 conflict retries, 30 s timeout, one token refresh, device-local sessions excluded; the merge re-normalises the whole log (cost = `normalizeLearning` above) and `schedulePush` fires 15 s after every `change`, i.e. after every answer.

### 2.9 Accessibility (`a11y.mjs` → `a11y.json`; repo `tests/layout-audit.mjs` run from a scratchpad copy → `la/tests/report-layout.json`)

Layout audit (48 routes × 3 viewports × 2 themes, seeded): **44/48 routes clean, 271/288 combos clean, 0 console errors**, crossword centred (Δ0 px). Failures, all "overlapping interactive elements": `/learn/word/w:casa|noun` (12 per combo at 390×664/375×667: `journey-action-track`/Continue over `journey-word` and `journey-audio` buttons), `/game/crossword` (12: fixed keyboard dock over clue buttons at the bottom), `/game/flashcards` (3: Hear/Details/Star over the flip button), `/learn` (1: adjacent dial items by 9 px).

| screen (dark) | focusables | Tab stops (with visible ring) | unnamed icon buttons | custom controls w/o role | live regions present | headings (h1) | Italian text w/o `lang` | `.itx` w/o state | min font (<12 px / <11 px) | contrast fails / sampled | 1.3× text: wide / clipped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Home | 27 | 22 (22) | 0 | 0 | 0 | h1 (1) + div title | 7 | 3 | 10 px (58 / 45) | 0 / 29 | 7 / 0 |
| Learn | 23 | 24 (24) | 0 | 0 | 0 | h2 only (0) | 1 | 0 | **8 px** (42 / 37) | 3 / 22 | 3 / 2 |
| Course lesson question | 12 | 8 (8) | 0 | 0 | 0 | h1 (1) | 3 | 0 | 11 (6 / 0) | 1 / 11 | 0 / 0 |
| Verb lesson question | 16 | 16 (15†) | 0 | 0 | 0 | **none** (0) | 4 | 0 | 11 (2 / 0) | 0 / 12 | 0 / 0 |
| Workshop cloze | 11 | 8 (8) | 0 | 0 | 0 | h1 (1) | 0 | 0 | 11 (4 / 0) | 1 / 11 | 0 / 1 |
| Game quiz | 8 | 8 (8) | 0 | 0 | 0 | **none** (0) | 5 | 0 | 11 (3 / 0) | 0 / 6 | 0 / 0 |
| Me | 47 | 47 (47) | 0 | 0 | 1 (sync status) | **none** (0) | 7 | 7 | 10 (51 / 19) | 2 / 22 | 0 / 2 |

† the one stop without a ring is `main.journey-main` (programmatic focus target, `journey.css:38`). Stops below the focusable count on lesson screens are the walk starting after the already-focused `main`, not unreachable controls. Order is view → tab bar, correct. `#toast` does not exist until the first toast (`ui.js:88`).

Italian without `lang` (samples): Home `span.it "Buonasera"`, `"VENERDÌ 2 OTTOBRE"`, `"Il piano di oggi"`, `div.night-hw "la pantofola"`, `a.word "pantofola"`; Me section titles `"Il tuo ritmo"`, `"Obiettivi"`…; lesson/game choice buttons (`"A mangi"`, `"B mangiamo"`, `div.big "diciassette"`). The `tr()`/`trBlock()`/`enPill()` helpers (`ui.js:60-69`) emit `role="button" tabindex="0"` with no `aria-expanded`/`aria-label` and the English is `display:none` until tapped (`app.css:490-491`).

Measured contrast (median of 8 background pixels sampled from screenshots around/inside the text box):

| theme | element | colour | size | contrast |
|---|---|---|---|---|
| dark | `span.kicker "IL TUO PERCORSO"` (`--ink-3` over glass + aurora) | #8f8c85 | 11 px | **4.34:1** |
| dark | `span.lc-en` (Learn poster subtitle, over tinted poster) | #b8b4ab | 10 px | **3.42:1** |
| dark | tab label "HOME", choice marker "A" (`--ink-3`) | #8f8c85 | 10–11 px | 4.31–4.32:1 |
| light | kickers "A1 · PRACTISE", "PRESENTE · LEZIONE", date (`--ink-3`) | #6b6b7a | 11 px | 4.39–4.42:1 |
| light | `span.mono.sec-side "2 THREADS"` over tinted glass | #6b6b7a | 11 px | **3.92:1** |
| light | `span "COSTRUISCI"` (lab kicker uses `--gold`, not `--gold-text`) | #d99a12 | 11 px | **2.04:1** |
| light | `.btn.accent "Continue"` white on terracotta | #fff | 16 px/700 | **3.81:1** |
| light | `.lvl.lvl-A1` filled badge, white text on pale fill (Me) | #fff | 11 px | **1.1:1** (verify on device) |
| light | feedback title / `b` in `--ko` | #d9365a | 16–19 px | 4.43:1 |
| dark | disabled `.btn.primary "Check"` | | 16 px | 2.89:1 (disabled, exempt) |

Token arithmetic (`css/app.css` `:root`/`[data-theme=light]`): dark `--ink-2` 9.6:1 on bg-0 / 8.6 on glass, `--ink-3` 5.9 / 5.3 (worst case at an orb centre, unblurred: 1.3), `--ink-4` 2.3; light `--ink-2` 6.3, `--ink-3` 4.6 / 4.9, `--gold-text` 4.9 / 5.3, `--gold` 1.5 (must never be text in light). Orb opacity .55 dark / .75 light; the aurora is what pulls the kickers below 4.5.

1.3× font scaling (every element's computed size ×1.3, `html { overflow-x: clip }` hides page overflow): Home night cards overflow the viewport by 28 px (right card content cut, EN pill over the title), poster title "Flashcards" breaks as "Flashcard/s"; Learn dial items +32 px, `.dash-stage-text` and `.lc-en` clipped 35–38 px; workshop kicker clipped 41 px; Me Export/Import buttons clip 4 px; lessons and quiz survive.

### 2.10 iOS specifics (code review)

- `viewport-fit=cover` with `env(safe-area-inset-*)` tokens (`index.html:5`, `app.css:43-44`) used by the top bar, docks, sheets; **`maximum-scale=1`** (`index.html:5`) disables pinch zoom in a standalone app (inference: Safari ignores it in the browser but honours it in home-screen apps).
- Height: `--app-height: 100dvh` with `100vh` in standalone (`app.css:41,91-94`), `html.is-standalone` set before first paint (`index.html:25`) and used for the aurora in full-screen surfaces (`app.css:877-880`); aurora `min-height: 100lvh` with negative bottom inset.
- Scroll restoration manual with per-entry scroll memory and `pid`-based depth tracking so a back-swipe never leaves the app (`app.js:92-110`).
- Keyboard overlap: `keyboardViewportHeight()` (`ui.js:12-21`) feeds `--journey-viewport-height`/`--practice-height` in lessons, course, placement, review and games (`play.js:55-62`); crossword/hangman use a fixed custom-key dock (`games/engine.js:127-165`), typed answers use the sticky `.feedback-bar` inside the practice viewport.
- Speech: utterances are `it-IT` with a preferred local Italian voice (`ui.js:183-189`); `speechSynthesis.cancel()` immediately followed by `speak()` (`ui.js:200-211`) is a known WebKit pattern that can swallow the utterance; auto-speak without a gesture at `games/engine.js:223` (`autoSay`), `learnWord.js:100,202` (`setTimeout`), `flashcards.js:161` — iOS needs one prior user activation per page session (inference).
- Storage: `navigator.storage.persist()` requested (`store.js:227`; ignored on iOS); README's claim that home-screen apps are exempt from the 7-day eviction matches WebKit's stated policy (inference). The 83 MB scorer (`fit-scorer.js:21-27`: 68.7 MB model + 14.2 MB wasm + 0.3 MB) and 340 MB WebLLM (`docs/ASSISTANT-EXPERIMENT.md:19`) share the origin's quota with the 100 KB–14 MB profile; WebKit evicts per origin, so low-disk eviction would take the progress with it (inference; the exact iOS quota is undocumented and depends on free space).

## 3. Findings

**Critical**

- **C1 — First screen blocked on 8.4 MB of data and 1.23 MB of JS** (§2.2; `app.js:202-217`, import chain `store.js:6-7` → `integration.js:5` → `lesson-content.js:7` → `progressive-content.js:4`). Cold: 1.7 s / 3.3 s (4×) / 11 s slow 4G gzip; SW-served 2.6 s / 8.6–9.2 s (4×); ~1 s of long tasks at 1× before paint. Fix: compact index for Home/Words/search, per-level entry files, per-level course packs, dynamic import of verb data and lesson builders, drop `attachLessonVocabulary` from boot (H1). Expected: data before first paint 8.4 MB → ≈0.6 MB raw (0.2 MB gz); first screen ≈0.5 s (1×), ≈1.5 s (4×), ≈3 s slow 4G; SW-served 4× ≈1.5 s.
- **C2 — Evidence log replayed on every answer/render/save and never compacted** (§2.4; `model.js:237-245, 392-411`, `journey.js:727-751`, `store.js:316, 346-369`, `integration.js:52-131`). 50 ms → 0.5 s → 2.6 s per answer at 2k/6k/24k events; Home 2.4 s → 9 s → 12 s; reboot 18 s and 14 MB profile at 24k; the unload mirror silently dies past ≈2.5 MB (`store.js:237`). Fix: keep the evidence context alive and append the new event (normalise one event, not the domain), cache `allSkills` per `learning` identity across `recordAttempt`, snapshot with `structuredClone`, and compact: roll events older than N days into per-objective summaries (keep ids in a compact Set for merge dedupe). Expected: O(1) answers (<5 ms), Home <50 ms independent of history, profile <300 KB, mirror safe.

**High**

- **H1 — `attachLessonVocabulary()` at boot** (`app.js:216`, `grammar-course.js:24-35`): 580 ms (1×) / 1.2 s (4×) on Home, 3.0 s on Learn at 4× — for every v2 lesson although `grammarLesson()` already attaches lazily (`grammar-course.js:48`). Fix: remove the boot call, attach per lesson on open (memoised). Expected: −0.6/−1.2 s first screen.
- **H2 — Home computes `reviewItems()` and `recommendLesson()` on every render** (`home.js:107,123`): both call `eligibleSkills` → 2.4 s at 2k events. Fix: compute once per profile version (cache keyed on `learning` identity + scope), render the hero immediately with a placeholder count. Depends on C2 for the big win.
- **H3 — Update revalidates all 132 files; install re-downloads 37–65 files the page never used** (§2.3; `sw.js:44`). 134 requests / 4.9–9.8 s per update; 0.3–1.5 MB extra on first install. Fix: `stamp-sw.mjs` already hashes every file — emit `{url, hash}` pairs, have install copy unchanged entries from the previous cache (`oldCache.match` → `newCache.put`) and fetch only changed ones. Expected: update 134 → 1 + changed requests, <1 s on slow 4G.
- **H4 — Screen-reader semantics**: tap-to-reveal spans are buttons with hidden content and no state (`ui.js:60-69`, `app.css:490`), no live region exists before feedback/toast is injected (`ui.js:88`; `games/engine.js:117` inserts `role=status` together with its text), headings missing on verb lesson/games/Me and the top-bar title is a `div` (`index.html:57`), Italian greeting/date/word-of-the-day/section titles/choice buttons/game prompts lack `lang="it"` (§2.9). Fix: `aria-expanded` + sr-only "show English" hint on `.itx`, `lang="it"` in `tr()`/`enPill()`/night-hw/choices/`.q-card .big`, a persistent `#toast` and a persistent feedback live region, `h1` in the top bar (or `aria-level`) and `h2` section titles on Me (the `.itx` section titles double as buttons). Expected: VoiceOver reads Italian with the Italian voice, announces results and toasts, and exposes a navigable outline.
- **H5 — Course-pack parse failure takes down Learn, Course, placement and lessons with a raw JSON error** (§2.8; `grammar-course.js:36-46`, `learn.js:81`). Fix: per-pack `try/catch`, keep good packs, remember the failure, show "Course unavailable — retry" inside the view (boot already tolerates it, `app.js:203`). Expected: a single bad pack degrades one level instead of the whole Learn tab.

**Medium**

- **M1 — Text size and zoom**: 45–58 elements under 11 px on Home, dial subs 8 px, all `px` (no Dynamic Type); `maximum-scale=1` blocks zoom in standalone; at 1.3× the Home cards/posters and Learn dial break (§2.9). Fix: 12 px floor for mono labels, `font: -apple-system-body`-based rem scale or `clamp()` typography, remove `maximum-scale`, let night cards/posters wrap.
- **M2 — Contrast** (§2.9): light `--gold` used as text (`COSTRUISCI` 2.0:1), `.btn.accent` 3.8:1, `.lvl` filled badge ~1.1:1 (verify), `--ink-3` kickers 4.3–4.4:1 over glass+aurora in both themes, `.lc-en` 10 px at 3.4:1. Fix: `--gold-text` for all gold text in light, lighter `--ink-3` in dark (#9c9992 ≈ 6.9:1 on bg-0) and darker in light (#5f5f6e), darker accent fill or dark text, badge fill/ink pairing, 11 px → 12 px for `.lc-en`.
- **M3 — Fonts not under app control offline** (§2.6): three Google families (many unicode-range subsets) per cold start, fallback metrics after the 24 h CSS expires offline. Fix: self-host subsetted woff2 (Latin + Latin-ext, inferred ≈100–150 KB total) in the shell with `font-display: swap`. Expected: identical rendering offline, fewer cross-origin requests.
- **M4 — Origin quota shared with 423 MB of optional ML assets** (§2.10): a low-disk eviction on iOS is per origin and would include the profile. Fix: show `storage.estimate()` and a warning before the 83 MB/340 MB downloads in Me/Workshop, nudge cloud sync/backup when they are installed. (Inference about WebKit eviction granularity.)
- **M5 — Boot JS graph includes the games engine on Home and 170 KB of workshop/lexicon modules on Learn** (§2.2). Fix: split `games/index.js` metadata from `engine.js`; dynamic-import `sentence-lab*`/`*-lexicon*` from the Learn views that need them. Expected: −80 KB on Home, −170 KB on Learn before paint, fewer SW round trips.
- **M6 — Layout overlaps** (layout audit): word-lesson action dock over example-sentence buttons at ≤390 px, crossword dock over the last clues, flashcard tools over the flip button, Learn dial items 9 px apart. Fix: bottom padding equal to the dock height on `.journey-page`/`.cw-frame`, z-order/padding for the flashcard tools.

**Low**

- **L1 — Warm-boot heap of 56–59 MB** is pre-GC garbage from parsing 7 MB of JSON (§2.2); becomes irrelevant with C1.
- **L2 — Slow listener growth** (+0.9 listeners per Home→Learn→lesson→Home loop, heap plateau +3 MB, 0 detached nodes): find the one listener added per navigation (likely a `store.on` or document listener in a view without matching removal); harmless at 20 loops.
- **L3 — Speech**: `cancel()`+`speak()` (`ui.js:200-211`) and gesture-less auto-speak (`games/engine.js:223`, `learnWord.js:100,202`, `flashcards.js:161`) may be silent on iOS until the first tap (inference). Fix: skip `cancel()` when nothing is speaking; gate auto-speak on a `userActivation` flag.
- **L4 — Learn dial exposes double Tab stops** (listbox container + each option button); harmless.
- **L5 — SW-served boot pays 64 `cache.match` round trips**; bundling the boot modules (or at least the 13 packs into one file per level) halves them. Folds into C1/M5.

## 4. Strengths

- Atomic, versioned shell install with revalidation (`sw.js:39-46`): a partial deploy cannot replace a working app (the repo's own `tests/offline-e2e.mjs`); unchanged files cost a 304; audio, fit-scorer and WebLLM caches survive updates; `check-shell.mjs`/`stamp-sw.mjs` keep SHELL and VERSION honest; `dist/` built by `build-site.mjs` keeps `docs/` out of the deploy (previous audit's observation 4 is resolved).
- Offline is complete: 21/21 routes including every lesson type, review and games, zero failed requests.
- Persistence is defensive and verified: IDB→localStorage fallback (even a throwing `indexedDB` getter), `pagehide`/`visibilitychange` saves, synchronous unload mirror with careful quota handling (`store.js:32-52, 234-251`), `onabort` on transactions, `normalize()` for old/foreign profiles.
- Boot resilience: dictionary failure → Retry screen; course failure caught at boot so Home works; per-route error boundary (`app.js:144-149`); 0 unhandled rejections in 60 boots.
- Update flow is simple and correct (skipWaiting + claim + reload on next navigation) and lesson state is saved per action — verified intact across an update.
- Sensible boot ordering: `modulepreload` + `preload as=fetch` (`index.html:40-49`, no double fetch), fonts never block paint, first-screen module fetched in parallel with the profile read (`app.js:205-206`), lazy search index (`data.js:61-76`), lazy `grammarLesson()` attachment.
- Disciplined motion: transform/opacity only, orbs paused when hidden (`fx.js:70`, `app.css:168`), reduced-motion handled in 13 stylesheet blocks and honoured (0 animations), one shared rAF scroll loop, 0 idle timers.
- Accessibility foundations: global `:focus-visible` ring (`app.css:123`) on 100 % of Tab stops, 0 unnamed icon buttons, native `<button>`s for chips/choices, `lang="it"` on lesson examples/forms/answers and the workshop, live regions in the lesson player (`activity-panel.js:91-117`), sheets that take focus, make the app `inert` and restore focus (`ui.js:110-127`), 16 px inputs, 40 px+ targets, keyboard support for dial/fan/action track.
- iOS care: safe-area insets everywhere, standalone `100vh` fix, `visualViewport` keyboard handling in every typed-answer surface, manual scroll restoration with per-entry memory, back-swipe-aware depth, `touch-action: manipulation`.

## 5. Proposals (priority order, effort S/M/L)

1. **Lazy data model (M)** — `data/index.json` (id, it, en, level, pos, cat, g, pl + verb inf/en/level/aux/isc: 1.06 MB raw / 218 KB gz, measured) for Home/Words/search; full entries per level (`data/vocab/<level>.json`, 215–560 KB each) or per entry on demand; course packs per level, loaded when the Learn tab or `courseLevel(store)` needs them; `verb-progressive-data.js` as a dynamic import (or JSON) inside `progressive-content.js`; drop `attachLessonVocabulary` from boot. Expected: −7.8 MB before first paint, first screen ≈0.5 s (1×)/≈1.5 s (4×)/≈3 s slow 4G, SW-served 4× ≈1.5 s.
2. **Incremental, compacted evidence log (M)** — append-only evidence context, per-event normalisation, `structuredClone` snapshots, time-based roll-up of old events into per-objective summaries with id sets for merge dedupe, `allSkills`/`eligibleSkills` cache keyed on `learning` identity + scope. Expected: answers <5 ms, Home <50 ms at any history, profile <300 KB, mirror and sync payload small.
3. **Hash-aware service-worker update (S)** — per-file hashes from `stamp-sw.mjs`, copy unchanged entries from the previous cache, fetch only changed files; also stop installing views the page cannot reach offline-first (or accept the one-off 0.3 MB). Expected: 134 → ~3 requests per update, <1 s on slow 4G.
4. **Accessibility pass (S)** — `lang="it"` in `tr()`/`enPill()`/choices/prompts/night cards; `aria-expanded` + sr-only hint on `.itx`; persistent `#toast` and feedback live regions; `h1` top bar, `h2` sections; `--gold-text` for gold text in light; `--ink-3` lightened/darkened; 12 px floor; remove `maximum-scale=1`; rem/Dynamic-Type scale and wrap-safe cards. Expected: WCAG AA contrast/zoom/name-role-value conformance on the audited screens.
5. **Code-split by tab (S)** — games metadata separated from the engine; workshop/lexicon modules dynamic from the Learn views. Expected: −80 KB Home, −170 KB Learn before paint.
6. **Self-hosted subset fonts in the shell (S)** — three families, Latin/Latin-ext subsets, `font-display: swap`. Expected: identical offline rendering, no Google round trips on cold start.
7. **Course-pack failure isolation (S)** — per-pack try/catch and an in-view retry. Expected: no dead Learn tab from one bad file.
8. **Storage transparency (S)** — `storage.estimate()` and pre-download warnings in Me/Workshop; backup nudge when ML assets are installed.
9. **Layout fixes (S)** — dock-height bottom padding in word lessons and crossword, flashcard tool z-order, dial spacing.
10. **Compression (none)** — GitHub Pages already gzips (2.3 MB shell); brotli would save a further ~10 % only by changing host; minification of the 2.3 MB JS would save ~0.2 MB gz — low value next to 1–5.

## 6. Verified vs inferred

**Verified by measurement or test** (files cited): all boot timings and payloads (`boot-*.json`, 60 runs); CPU profiles and trace (`profile-*.log`, `trace-1x.log`); SW install/update/SW-served boots and server request logs (`sw-install-*.json`, `srv81*.log`); evidence-log scaling and storage usage (`storage.json`); blur-pane/animation/timer counts, reduced-motion behaviour and the 20-loop leak check with heap snapshot (`runtime.json`, `leak2.json`); offline behaviour of 21 routes, fit-scorer/assistant calls, font status (`offline.json`); update-during-lesson (`update.json`); the nine resilience scenarios (`resilience.json`); Tab walks, focus rings, names/roles, live regions, headings, `lang` coverage, font sizes, measured contrast and 1.3× layout (`a11y.json`, `ax-*.png`); the layout audit (`la/tests/report-layout.json`); shell/compact-index/gzip sizes (`shell-bytes.mjs`, token script); every file:line reference.

**Inferred (not measured here)**: real-device iPhone timings (all numbers are Chromium on a loaded 4-core host; the earliest unloaded smoke test ran 40 % faster than the "isolated" pass); the localStorage mirror cut-off (~5 MB budget assumption); WebKit per-origin eviction and quota behaviour; `maximum-scale=1` being honoured in standalone; iOS speech-synthesis activation rules and the `cancel()`+`speak()` drop; Google Fonts behaviour on a device after the CSS cache expires; the fit-scorer "install offline" result (sandbox cache artefact); the light-theme `.lvl` badge contrast (needs a device check); self-hosted font size estimate; GitHub Pages ETag semantics (standard behaviour, not observed live).
