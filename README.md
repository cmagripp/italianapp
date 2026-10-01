# Parola — Italian words & verbs

A mobile-first Italian course, dictionary and verb trainer that runs entirely in the browser: no build step, no server, works offline once loaded, and keeps every user's progress on their device. The **Everyday Italian** course teaches from absolute beginnings (Foundations) through C2-oriented work; alongside it sit a 6,943-word / 1,185-verb dictionary with taught word and verb lessons, skill-based review, games and a reference codex. The interface is a bespoke cinematic system ("Notte italiana", see `DESIGN.md`): a drifting aurora behind frosted-glass panes, a high-contrast display serif for Italian words, level-keyed colour, a rotary tense dial, fanned person cards, poster reels, glass drop-downs, stamps and confetti.

**Live app:** https://cmagripp.github.io/italianapp/ (deployed from `main`). On iPhone, open it in Safari and use *Share → Add to Home Screen* to install it as an app. To host your own copy, see *Hosting* below.

## What's inside

| | |
|---|---|
| **Everyday Italian course** | Foundations plus A1–C2 in 78 units and 241 short lessons (`data/course-v2/`: Foundations 3 units / 8 lessons, A1 12/55, A2 14/51, B1 12/38, B2 13/41, C1 12/24, C2 12/24). A lesson prepares the words it needs, teaches one pattern, moves from guided to independent checks (choice, matching, word order, typed answers) and ends with a recap; each unit also has reading, listening and an open response (writing, speaking, interaction or mediation) with a model answer and self-review criteria. A wrong answer opens teaching for that target and a different example. Pause, Back (earlier steps are shown read-only), typed drafts, chosen tokens and feedback survive reloads, and Italian words in sentences open a word inspector with their forms. Open responses, speech and recordings are saved but not graded. The lesson player is `js/views/learnCourse.js`, reached through `#/learn/grammar/:id` (`js/views/learnGrammar.js`, which still plays lessons of the earlier course). Completing lessons records course work, not a CEFR level. |
| **My Course & sessions** | **My Course** (`#/course`, `js/views/course.js`): choose a stage (new learners start at Foundations) and open any unit or lesson with Start / Resume / Revisit; nothing is locked. It also shows a skill profile (grammar, reading and listening checks; writing, recordings and interaction are listed as practice, not assessed), any work saved in the earlier 129-lesson course (`data/grammar-course/`, still playable; `data/course-v2/legacy-map.json` records what replaced each lesson) and optional extra verb forms. **Already know some Italian?** (`#/course/placement`, `js/views/coursePlacement.js`) is an optional check of six questions per stage that suggests where to begin; it marks nothing complete and awards no XP or level. **Start a session** (`#/learn/session`, `js/views/courseSession.js`) builds a short saved sequence: *Together* (the next grammar lesson, one verb tense and up to three words), *Grammar*, *Verbs* or *Words*; any part can be saved for later. |
| **Learn tab** | Your learning path (resume or start), the My Course summary with its stage selector, the next grammar lesson and the session menu, then vocabulary: next-verb and next-word decks drawn from your study scope (a level, your lists, learned items or everything), the review pane and the verb lab. Daily goals, streaks and XP. |
| **Verb lessons** | `#/learn/verb/:id` (`js/views/learnJourney.js`; sequencing in `js/learning/journey.js`, content in `js/learning/lesson-content.js`): a short introduction, then five tense lessons — Present, Completed past (passato prossimo), Past background (imperfetto), Future and Conditional. Each one teaches before it asks: the six persons and formal *Lei*, auxiliary, participle and agreement for the past, the future stem; then matching, choice and typed recall and sentences in context. Present and imperfetto add a progressive section (*sto parlando*, *stavo parlando*), or explain why the verb's chosen meaning keeps the simple form, and finish with a contextual review; the per-verb policy is authored in `data/verb-progressive/` and compiled into `js/learning/verb-progressive-data.js`. Once the five are done, *Mix your tenses* reviews them together. Requests and commands, narrative tenses, subjunctives and other compound forms are opt-in chapters (My Course → Additional verb forms, or a link from a grammar lesson). Your place is saved at the exact step. |
| **Word lessons** | `#/learn/word/:id`: a short lesson — meet the word (meaning, example, what kind of word it is), notice its forms (article and number for nouns, the recorded agreement forms for adjectives), then about six answer screens on meaning, recall and those forms. Forms a custom entry does not record are not invented. Learn also offers a short multi-word session. |
| **Learning evidence & review** | Every answer in lessons, reviews and supported games is stored as an event against one skill (meaning, recall, a tense and person, auxiliary, participle, agreement, article, plural, context, a course target's facet…) in the profile's learning store (schema 5). `js/learning/model.js` replays those events deterministically: a skill counts as learned only after separated, unaided correct answers in different examples (hints, revealed answers, choices and matching count as supported practice), a mistake needs fresh successes to clear, and *remembered* needs two more unaided successes in a later session at least a day afterwards. Each skill carries its own spaced-repetition schedule (SM-2 variant). **Review** (`#/review`, `js/views/review.js`; eligibility and recommendations in `js/learning/integration.js`) lists the skills that are due and draws verb forms only from tenses you have completed. |
| **Original walkthrough (optional)** | Turning off **Me → Adaptive lessons** brings back the original walkthrough for the verb and word cards on Learn: a scrollable stack of full-screen scenes, each an exercise — meet the word, meaning check, patterns that open to examples, choose the auxiliary, one scene per tense with the six persons as a fanned hand of cards, examples that type themselves with a cloze, participle and gerund, a nine-question drill and a stamped completion that adds the verb to your **learned list** (words get a seven-scene version). Review then uses the classic runner (recognition tasks for weak items, typing, cloze and conjugation for strong ones) unless you have course skills to review. Lessons opened from a course session or a grammar lesson stay taught lessons, and recorded evidence is kept. |
| **Dictionary** | 6,943 words and 1,185 verbs (339 irregular), organised by CEFR level (A1–C2) and 28 topics (`data/stats.json`). Every noun has gender, article and plural (or a note on why it is normally singular or plural); adjectives have all four forms; every entry has an example sentence with translation and, from B2 up, register/usage notes. Audit reports for noun forms and verb content are in `docs/`. |
| **Verb cards** | Meaning, group (-are/-ere/-ire/-rre, regular/irregular), auxiliary, transitivity, government patterns ("reggenza": *pensare a qualcuno*, *cercare di fare*…), usage notes, three examples, and full conjugation tables for all 15 moods and tenses, generated by a built-in conjugation engine (regular paradigms, spelling changes, 200+ irregular bases and 300+ listed prefixed derivatives, defective verbs, reflexive and pronominal verbs like *andarsene*, *farcela*, *cavarsela*; 2,802 spot checks). |
| **Reference codex** | Pick any word or verb and get a full overview page: identity and at-a-glance strip, why it is irregular (computed cell by cell), verb family, every tense on a rotary dial with fanned persons, patterns, usage, examples, related words, your progress and actions. For words: forms as flip cards, the exact article and plural rule for that word, gender cues, related words and synonyms. Plus twelve grammar reference topics with live examples from the dictionary and a practice link. |
| **21 games** | Flashcards, quick quiz, type it, matching, hangman, crossword, fill-in-the-blank, word scramble, sentence builder, articles (il/la/lo…), plurals, dictation, Italian→English, speed round; verb games: conjugation drill (choose tenses), pick the form, tense detective, essere or avere?, participles & gerunds, prepositions, verb mix. Every game can be played with **your learned verbs/words, your word bank, any custom list, a level, a topic, or the due-for-review queue**. Questions from the shared game runner also record evidence for the skill they test. |
| **Word bank & lists** | Search in Italian or English, star words into your word bank, create custom lists, add your own words/verbs (custom verbs are conjugated too), and use any list as study scope or game source. |
| **Always-available translation** | Every Italian text is tap-to-reveal; the **EN** button in the top bar switches to always-visible translations. |
| **Pronunciation & course audio** | Italian text-to-speech on every word, form and sentence (uses the device's Italian voice; iOS Safari ships one). The course adds 126 bundled clips in `audio/course-v2/`: 124 synthetic practice recordings, labelled as synthetic in the app, and two attributed public-domain LibriVox excerpts. Clips stream when online; **Save unit audio offline** in a lesson's *i* menu downloads one unit's clips into a separate cache. Optional microphone responses stay on the device in their own IndexedDB store; they are not uploaded or included in backups, and resetting progress or deleting the user removes them. |
| **Users & persistence** | Multiple users per device, each with their own progress, learning evidence, lists, custom words and settings, stored in IndexedDB. Export/import JSON backups to move between devices. |

## Hosting (GitHub Pages)

The repo contains two workflows:

- `.github/workflows/deploy.yml` runs on every push to `main` (and on demand). One step validates the source data (a schema error fails the deploy), builds the dictionary data (an incomplete build fails it too) and runs 31 deterministic checks: noun forms, module parsing (`tools/check-modules.mjs`), the conjugation engine, the course v2 content/engine/durability/assets/lexicon/editorial suites, the earlier grammar course, the learning model, questions, store/sync and store durability, integration and completion, lesson content, sentence lookup, word questions, the short-word and journey models, lesson activities, the progressive-form build (`tools/build-verb-progressive.mjs --check`), progressive content, verb flow, pacing and scene variety, journey integration, then `tools/stamp-sw.mjs` (stamps the service-worker version from a content hash) and `tools/check-shell.mjs`, which checks that `sw.js` precaches every module, stylesheet and startup data file and that the stamp is current. The first failure stops the job before anything is uploaded. `tools/build-site.mjs` then assembles the deployable files into `dist/` (source data, docs, tests, tools and dev files stay out of the site), the 19 Playwright browser suites run in parallel through the reusable `.github/workflows/browser.yml`, and the site deploys only when every job is green.
- `.github/workflows/check.yml` runs on pull requests to `main`: the same deterministic checks, the cloud-sync SQL test against an isolated PostgreSQL engine (`tools/test-learning-sql.mjs` with PGlite), and the same 19 Playwright browser suites (through `browser.yml`) in Chromium, with `course-v2-e2e`, `verb-flow-v2-e2e` and `verb-pacing-e2e` repeated in WebKit.

1. In the GitHub repository go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to `main` (or merge a pull request into it). The *Deploy to GitHub Pages* workflow runs and prints the URL, normally `https://<your-user>.github.io/italianapp/`.
3. Open the URL on your iPhone in Safari → Share → **Add to Home Screen**. The app then runs full-screen and keeps its data (Safari only evicts storage for sites you never revisit; installed web apps are exempt).

Any static host works too (Netlify, Vercel, Cloudflare Pages, an S3 bucket): upload the repository as-is, at the domain root or under any sub-path (every URL in the app is relative). `data/vocab.json`, `data/verbs.json` and `data/stats.json` must exist, which `node tools/build-data.mjs` produces; `data/grammar.json`, the course packs (`data/course-v2/`, `data/grammar-course/`), `js/learning/verb-progressive-data.js` and `audio/course-v2/` are used as they are in the repository.

**Updates and offline use.** `sw.js` installs one versioned cache (`VERSION`) holding the whole shell: HTML, manifest, icon, every stylesheet and JS module, the dictionary data, `data/grammar.json`, the seven course packs, the earlier course's packs and the course audio catalogue. Installation is atomic: the new worker takes over only after every listed file has been fetched (revalidated with the server, so an unchanged file comes back as a 304), and a failed or partial update leaves the previous complete version in use. Listed files are then served from that cache, so a change to any of them reaches installed apps only through a new `VERSION`. The version is stamped from a content hash: run `node tools/stamp-sw.mjs` after changing a shell file or course data (the deploy workflow runs it too, and `tools/check-shell.mjs` fails when the stamp is stale). On activation the previous version's cache is deleted, while the course-audio cache (`parola-course-audio-v2`) is kept across upgrades. An app that is open while a new worker takes over reloads itself on its next navigation, so old and new modules never mix, and an installed app looks for a new worker whenever it returns to the foreground. Course audio is not precached: `audio/course-v2/` requests are answered from the audio cache for downloaded units (with byte-range responses, so offline playback can seek) and from the network otherwise. Other requests go to the network, with `index.html` as the offline fallback for navigations.

## Running locally

```bash
node tools/build-data.mjs                # merge data/vocab/*.json + data/verbs/*.json → data/vocab.json, verbs.json, stats.json (exits 1 if any entry or file had to be skipped)
node tools/build-verb-progressive.mjs    # compile data/verb-progressive/*.json → js/learning/verb-progressive-data.js (--check only verifies)
node tools/test-conjugator.mjs           # 2,802 conjugation spot checks
node tools/check-shell.mjs               # sw.js precache list vs the file tree (run after adding a module or stylesheet)
python3 -m http.server 8000              # or any static server, then open http://localhost:8000
```

The tools are plain Node ES modules without dependencies; CI uses Node 22.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app shell, PWA manifest, offline cache (atomic shell precache + separate course-audio cache)
DESIGN.md                                 the design brief and the implemented token/component reference
css/app.css                               design system tokens and components (dark "Notte" default, light "Mezzogiorno")
css/learn.css, reference.css, games.css, views-*.css   screen-specific styles
css/course.css, grammar-course.css, journey.css, adaptive.css   course pages, lesson player, taught verb/word lessons, retained adaptive loop
js/fx.js, js/icons.js                     aurora, dial, fan, reel, dropdown, stamp, confetti, typewriter; SVG icons
js/app.js                                 router + shell
js/store.js                               per-user persistence (IndexedDB), lists, custom words, stats, learning evidence and saved lessons
js/sync.js                                optional Supabase sync (revision-checked) and its setup SQL
js/srs.js                                 spaced repetition scheduling
js/data.js                                dictionary loading, search, articles/plurals, scope resolution
js/conjugator.js, js/irregular.js         conjugation engine and irregular-verb table
js/components.js                          word cards, verb cards, conjugation tables
js/learning/                              evidence model (model.js), review eligibility and recommendations (integration.js), curriculum,
                                          verb/word lesson builders and chapter sequencing (lesson-content.js, journey.js), course v2 engine,
                                          state, placement and media, sentence lookup, progressive-form data
js/views/*.js                             screens: home, learn hub, course, coursePlacement, courseSession, learnGrammar + learnCourse
                                          (lesson players), learnVerb/learnWord (original walkthrough, hand off to learnJourney when
                                          adaptive lessons are on), learnJourney, learnAdaptive (earlier adaptive loop, kept for saved
                                          sessions), walkthrough scene engine, review, games, words, reference codex, grammar, lists, profile…
js/games/*.js                             game engine, question generators, and the 21 games
data/vocab/*.json, data/verbs/*.json      dictionary source data by level (see data/SCHEMA.md); data/grammar.json (see docs/GRAMMAR.md)
data/course-v2/                           Everyday Italian packs (Foundations–C2), audio catalogue and review records, legacy-map.json
data/grammar-course/                      the earlier 129-lesson course, kept for saved work
data/verb-progressive/                    per-verb progressive-form policy (see its CONTRACT.md)
audio/course-v2/                          course audio clips (.m4a), one folder per stage
docs/                                     course plan and contract, release notes, audits
dev/fx.html                               component playground
tools/                                    validator, data/course/progressive builders, site build (build-site.mjs), service-worker stamp (stamp-sw.mjs), course authoring and audio scripts, check suites
tests/                                    Playwright browser suites (see tests/README.md)
```

## Adding data

Add entries to any file under `data/vocab/` or `data/verbs/` following `data/SCHEMA.md`, validate with `node tools/validate.mjs <file>`, then rebuild with `node tools/build-data.mjs`. Duplicates across files are merged automatically (the lowest CEFR level wins). A new verb also needs a progressive-form record in `data/verb-progressive/` (`tools/build-verb-progressive.mjs` checks that every dictionary verb has one) before the module is recompiled.

Course lessons live in `data/course-v2/<stage>.json` following `docs/COURSE-V2-CONTRACT.md`; the Foundations–A2 and B1–B2 packs are generated by `tools/author-course-beginner.mjs` and `tools/author-course-intermediate.mjs`. After a change, run `node tools/build-course-map.mjs` (rewrites `legacy-map.json`) and the course checks, then `node tools/stamp-sw.mjs`. Course audio is produced offline with `tools/build-course-audio.py` (an open-source text-to-speech model and macOS `afconvert`; versions in `docs/GRAMMAR-COURSE.md`) and checked with `tools/review-course-audio.py`, an automated intelligibility check rather than a pronunciation rating; the generated clips and `data/course-v2/audio.json` are committed, so the app needs no model or paid service. See `docs/GRAMMAR-COURSE.md` for the course's evidence rules and release checks.

## Cloud sync across devices (optional)

Progress lives on the device by default. To sync a user across devices, create a free [Supabase](https://supabase.com) project, enable Email auth, run the SQL shown under **Me → Cloud sync → Show setup SQL** in the project's SQL editor, then paste the project URL and anon key into the app and sign in. The SQL (the `SETUP_SQL` constant in `js/sync.js`) creates a `parola_profiles` table with row-level security so each account can only read and write its own row, a `revision` column, a `parola_save_profile` function that saves only when the stored revision is unchanged, and a trigger that rejects any update that does not advance the revision.

**Projects set up before the learning-evidence release need the updated SQL.** Run it again (when signed in, the button reads **Show setup SQL / update sync**); every statement is safe to re-run. Until then sync stops with a message asking you to update it and your progress stays on the device; there is no fallback that writes without the revision check. Older copies of the app are rejected by the trigger rather than overwriting newer data, so reload installed devices after updating. `docs/ADAPTIVE-LEARNING-RELEASE.md` has the rollout steps.

Each sync pulls the cloud copy, merges it into the local profile and saves the result with the revision check, retrying when another device saved in between; changes are pushed automatically. Learning evidence merges by event identity (answers from both devices count, XP is not doubled), per-item progress keeps the newest answer, lists are unioned, custom words keep the newest edit and deleted ones stay deleted, and a progress reset wins over older cloud data. Saved lesson positions and settings stay on each device, and microphone recordings are never uploaded. Because lists are unioned, removing a word from a list or deleting a list on one device is undone by the next sync with a device that still has it. If an automatic sync fails, **Me → Cloud sync** shows the last error next to the sync time.

## Backups and multiple devices

Progress is per user and per device. Use **Me → Export backup** to download a JSON file and **Import backup** on another device (merge or replace). The backup includes learning evidence and saved lesson positions, but not microphone recordings: keep those with a recording's **Save recording** action. A course lesson's *i* menu can also export that lesson's written work. Keep a backup before clearing Safari's website data.

## Testing

Nothing needs npm scripts or a build step.

**Deterministic checks (Node).** `tools/` holds 29 `test-*.mjs` suites plus `check-modules.mjs` (every browser JS file parses as a module) and `check-shell.mjs`. The `run:` block in `.github/workflows/deploy.yml` is the canonical list and order; note that `build-data.mjs` rewrites `data/*.json`.

| Area | Suites |
|---|---|
| Dictionary and engine | `test-noun-forms`, `test-conjugator` |
| Everyday Italian course | `test-course-v2-content --recovery` (every lesson completes, every authored single-error path), `test-course-v2-engine`, `-durability`, `-assets`, `-lexicon`, `-editorial` |
| Earlier grammar course | `test-grammar-course`, `test-grammar-durability`, `test-grammar-lexicon` |
| Learning model and storage | `test-learning-model`, `test-learning-questions`, `test-learning-store-sync`, `test-store-durability`, `test-learning-integration`, `test-learning-completion` |
| Verb and word lessons | `test-lesson-content`, `test-sentence-lookup`, `test-word-questions`, `test-short-word-model`, `test-journey-model`, `test-lesson-activities`, `test-journey-integration` |
| Verb flow | `build-verb-progressive --check`, `test-progressive-content`, `test-verb-flow-v2`, `test-verb-pacing`, `test-verb-scene-variety` |
| Cloud sync SQL | `test-learning-sql` runs the setup SQL in PGlite; it needs `@electric-sql/pglite@0.5.8` installed under the directory named by `PGLITE_DIR` and runs only in the pull-request workflow |

**Browser suites (Playwright).** `tests/` holds 20 scripts (plus the shared helpers `lib.mjs` and `journey-driver.mjs`) that drive the real app in headless Chromium at phone sizes. They need Node plus the `playwright` package and a browser; `tests/README.md` explains where the scripts look for them (`PLAYWRIGHT_DIR`, `CHROME`) and the server they start on port 8123.

```bash
(python3 -m http.server 8123 --bind 127.0.0.1 >/dev/null 2>&1 &)   # or let the scripts start it
node tests/e2e.mjs            # every route + the original walkthroughs (guessed and passed), classic review, all 21 games and their picker, list, search/browse, entry actions, scope, custom word/verb, theme, users, backup round-trip, SRS and persistence flows
node tests/layout-audit.mjs   # every route × 3 phone viewports × light/dark: overflow, tap targets, overlaps, small inputs, clipped headings
node tests/journey-e2e.mjs    # default taught verb and word lessons: teaching, formal address, feedback, recall, repairs, exact resume
node tests/course-v2-e2e.mjs  # Everyday Italian lessons, repair, read-only history, placement, audio (COURSE_BROWSER=webkit for WebKit)
node tests/offline-e2e.mjs    # real service-worker install, failed update and offline resume
```

The others cover the earlier grammar course and its offline upgrade (`grammar-course-e2e`, `grammar-offline-e2e`), the verb flow and pacing (`verb-flow-v2-e2e`, `verb-pacing-e2e`; `VERB_BROWSER=webkit` for WebKit), the lesson overview, actions, activities and study tools (`lesson-*-e2e`), short word lessons, practice controls, the review layout, the completion menu, evidence from games (`game-learning-e2e`), noun forms, and earlier adaptive sessions (`adaptive-e2e`). The pull-request workflow runs every suite except `layout-audit.mjs`. All suites exit non-zero on failure; `e2e.mjs` and `layout-audit.mjs` also print a report, write `tests/report-*.json`, accept route filters as arguments (`node tests/e2e.mjs game/ review`) and take screenshots into `tests/shots/` with `SHOTS=1`.

These checks cover software behaviour in emulated phone browsers; they are not a physical iPhone test and do not measure language learning.
