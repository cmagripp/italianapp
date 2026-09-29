# Parola application audit

Audited on 29 September 2026. Baseline: `cmagripp/italianapp`, `main`, commit `e6d33a9f18b71f7f4923c895ccc226421779ae15`.

The empty local repository was connected to GitHub and checked out at that commit. Audit/design documents live on `codex/adaptive-verbs-design`. Application source and production behavior have not been changed.

## Assessment

Parola already has the content, conjugation engine, offline storage and exercise components needed for adaptive verb teaching. The main missing piece is reliable evidence about *which part* of a verb the learner understands. Current lessons are largely a fixed tour; current adaptation changes review question types based on an aggregate score for the entire verb.

The recommended change is a progressive everyday course with Present, Past and Future categories, repeated demonstrations of each skill, targeted teaching after mistakes, and optional expansion courses. A single correct guess must never bypass learning. Each skill continues until demonstrated consistently or explicitly skipped by the learner. See [the implementation design](ADAPTIVE-VERB-LEARNING.md).

## What the application does

| Area | Current behavior |
| --- | --- |
| Dictionary | 6,943 words and 1,185 verbs, A1–C2, across 28 categories. Search in Italian/English and browse by level/topic. |
| Verb reference | Meaning, usage, auxiliary, patterns, examples, generated conjugations across 15 mood/tense entries, irregular forms, non-finite forms. |
| Learning | Separate word and verb walkthroughs; explanatory scenes, recognition and typing checks, final drills, learned lists. |
| Review | Item-level spaced repetition; weaker items get more recognition tasks and stronger items more production tasks. |
| Practice | 21 games, including conjugation, auxiliary selection, participles, cloze, matching and dictation. |
| Personalization | Study scopes, word bank, custom lists, custom entries, multiple local profiles, translation toggle, Italian text-to-speech. |
| Progress | XP, streaks, daily goals, learned items, review schedules, game scores. |
| Portability | JSON export/import; optional user-configured Supabase account sync. |

Counts were verified against the built dataset, not inferred from the README. They describe the repository's content; they do not certify linguistic correctness or CEFR alignment of every entry.

## How it is built

- **Frontend:** static HTML, hand-written CSS and native JavaScript ES modules. No React/Vue or application bundler. `js/app.js:166` defines the hash routes and lazily imports screens.
- **Presentation:** a shared visual-effects layer and custom components, including animated scenes, card fans, glass surfaces and tense controls. Dark/light themes and mobile layouts are already established.
- **Content:** source JSON in `data/vocab/` and `data/verbs/` is validated and merged by Node scripts into browser datasets. `js/data.js` loads and searches them.
- **Language engine:** `js/conjugator.js` plus `js/irregular.js` generate forms, accepted variants, irregular cells and clitic forms. Reuse this engine rather than duplicate conjugation rules in an adaptive module.
- **Exercises:** `js/games/questions.js` produces questions; `js/games/engine.js` renders and grades drills; `js/views/walkthrough.js` runs lesson scenes and quick checks.
- **Persistence:** one whole profile document per local user in IndexedDB, with localStorage fallback/pending-save recovery. `js/store.js:80` defines the profile shape.
- **Sync:** optional Supabase email authentication and a whole-profile JSON row. Local profiles do not require cloud accounts. Production Supabase configuration/data was not accessed.
- **Hosting:** GitHub Actions validates/builds data, tests conjugations, checks precached files, and deploys the repository to GitHub Pages on pushes to `main`/`master`.
- **Offline:** `sw.js` precaches the app shell and data. Code is network-first; dictionary data is cached and refreshed in the background.

The [successful deployment run](https://github.com/cmagripp/italianapp/actions/runs/36607536808) uses the audited commit. A read-only HTTP request to the live `js/views/learnVerb.js` returned a byte-for-byte match with the checkout. This verifies that lesson file, not every deployed asset or every user's cached version.

## Current verb-learning flow

For a typical A1/A2 verb, the learner goes through 12 scenes:

`Meet → Meaning → Patterns → Auxiliary → Present → Passato prossimo → Imperfetto → Future → Examples → Participle + gerund → Drill → Finish`

For B1–C2 dictionary entries, conditional and present subjunctive are added automatically. The controlling input is the **verb's vocabulary level**, not the learner's demonstrated grammar readiness (`js/views/learnVerb.js:95–106`).

Every tense scene starts with all available person cards and one randomly selected check. The final drill usually has nine questions; a score of at least 66% marks the verb learned. A typical nine-question lesson passes with six correct answers (`js/views/learnVerb.js:381–419`).

## Findings that matter to the redesign

### 1. Lesson mistakes are not retained as learning evidence — high priority

Quick checks return correctness/reveal information to their callbacks, but lesson callbacks mostly just unlock navigation (`js/views/walkthrough.js:300–384`, `js/views/learnVerb.js:144–147,267–271`). The custom auxiliary scene also only gives feedback and unlocks the next scene (`js/views/learnVerb.js:194–207`).

The final verb drill explicitly sets `record: false` (`js/views/learnVerb.js:413`). It keeps answers in memory, then saves a game summary and possibly a learned flag; `store.recordGame()` retains played/best/total/XP, not the answers (`js/store.js:315–320`). A failed auxiliary answer therefore does not become a persistent auxiliary weakness.

**Implication:** simply changing the next-question selector cannot make lessons meaningfully adaptive. First record structured attempts from every lesson check.

### 2. Whole-verb mastery conflates different abilities — high priority

The item record contains one SRS state and aggregate correct/wrong counts (`js/store.js:229–264`). A meaning-recognition answer and a typed conjugation answer both update that same record. There is no durable separation by tense, person, auxiliary, participle or assistance used.

**Implication:** a learner can improve an overall verb score without demonstrating a particular tense. Keep legacy item progress, but add evidence for specific skills and distinguish recognition from independent production.

### 3. Review can introduce untaught advanced grammar — high priority

At `s >= 3`, review can select conditional, subjunctive or passato remoto regardless of the learner's selected level (`js/views/review.js:14–18`). Question generation also falls back across the broad `DRILL_TENSES` list when a form is unavailable, and multiple-choice distractors can come from other advanced tenses (`js/games/questions.js:190–202,229–232`).

**Implication:** a common-tense course needs one shared eligibility policy across lessons, reviews, games, distractors, cloze content and fallbacks. Changing the lesson's tense array alone is insufficient.

### 4. The walkthrough checks breadth more than durable skill — design limitation

Each tense scene reveals all persons before a single check; meaning/auxiliary/participle successes can compensate for failed conjugations in the final score. One random question outside passato prossimo does not establish competence across all the other taught tenses (`js/views/learnVerb.js:238–275,382–396`).

**Implication:** teach one main objective at a time and report progress by skill. Immediate corrected repetition is useful practice, but it should not count as delayed independent recall.

### 5. Some exercise contexts need linguistic corrections — confirmed examples

- The non-finite scene prefixes every gerund with `sto` (`js/views/learnVerb.js:335`). For reflexives/pronominals the engine's citation forms include `alzandosi` and `andandosene`, producing mismatched first-/third-person combinations such as `sto alzandosi`. Use contextual forms such as `mi sto alzando`, or teach the citation gerund without a first-person lead-in.
- The engine supplies figurative/personal forms of weather verbs, and the lesson samples any generated person (`js/views/learnVerb.js:87,238,262`). The everyday course should use ordinary impersonal contexts such as `piove`, with explicit usage metadata.
- Generic auxiliary explanations are too broad (`js/games/questions.js:282`): auxiliary choice can depend on a particular verb, sense, or construction. The adaptive tutor must not convert these simplifications into universal error rules.

These are bounded examples from code/data inspection, not a comprehensive native-speaker audit of all content.

### 6. Backups and optional cloud sync need an explicit migration — rollout constraint

`normalize()` fills known profile fields; import merge only merges specific current fields (`js/store.js:95–104,335–342`). A new top-level adaptive field would be ignored by merge until that code changes. Putting it inside `items` is also insufficient because the entire newest item wins, potentially replacing evidence about other skills.

Automatic cloud saves upload the whole local profile after 15 seconds without first pulling (`js/sync.js:75–84,112–115`). Full pull/merge/push is a separate path. Concurrent devices can overwrite remote work. This is a code-confirmed risk; no live account was used to reproduce loss.

**Implication:** preserve all existing progress, version the new data, and test merge/idempotency/concurrent-device behavior before promising adaptive continuity across devices.

### 7. Existing tests provide a useful but incomplete safety net

The deployment workflow runs schema/build/conjugation/offline-shell checks, but not browser E2E or layout tests (`.github/workflows/deploy.yml:27–32`). Browser tests use Chromium and block service workers (`tests/lib.mjs:71–73`). Their success does not establish Safari/PWA migration or offline-update correctness.

## Baseline verification

| Check | Result |
| --- | --- |
| Validate source JSON | Passed: 9,242 source entries; 178 same-level duplicate notices. |
| Rebuild dictionary | Passed: 6,943 words and 1,185 verbs. Only `builtAt` changed; restored after checking semantic equality. |
| Conjugation engine | Passed: 2,802 / 2,802 checks. |
| Offline shell manifest | Passed: 55 shell files. |
| Live lesson source | HTTP 200; exact match with local source. |
| Focused browser checks | Passed: review route and three flows (verb-intro-pass, review, persistence); zero console/page/network errors or click fallback warnings. |
| Phone lesson inspection | At 390×664 CSS pixels: no horizontal overflow; the typical verb had 12 scenes. |

The successful lesson flow completed its final drill at 9/9 and awarded 67 XP including completion/perfect-run rewards. Review recorded 20 answers and reduced the seeded due queue from 30 to 10. A reload preserved 31 learned items, 571 XP and one list. These are isolated test fixtures, not the user's learning data. Full E2E/layout suites were not run.

Verification used fresh local test profiles. It did not inspect personal learning histories, run a full security audit, validate real cloud accounts, test every dictionary entry, or certify all Safari/offline behavior.

## Recommended implementation order

1. Centralize curriculum eligibility and correct the targeted exercise-context problems.
2. Capture lesson evidence and preserve it through persistence/import/sync.
3. Add a deterministic adaptive selector and short focused lesson flow.
4. Add everyday milestones, targeted reviews and optional expansion modules.
5. Validate returning users, mobile/offline behavior and delayed learning outcomes before general rollout.
