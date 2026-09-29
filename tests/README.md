# Browser tests

`node tests/adaptive-e2e.mjs` exercises the default adaptive learner in a fresh phone-sized browser profile: repeated
independent success after mistakes, hints/reveals, exact question and draft resumption, explicit defer/resume, voluntary
check-ins, solvable word/verb practice, focused review, six-person checkpoints, narrow-scope handling, and preservation
of learning saved by a newer application version. It writes `tests/report-adaptive-e2e.json` and a phone screenshot.

The route visits in the older `e2e.mjs` suite use adaptive learning by default, including `/course` and `/review`.
Its four classic walkthrough fixtures and classic review-runner fixture temporarily opt out through the existing
`adaptiveLearning` preference; each restores the preference afterwards. Games, lists, profiles, backups, and other
regression flows continue with the default setting. Run both suites to cover the two retained experiences.

Playwright scripts drive the real app in headless Chromium at phone sizes. There is no test runner, no `package.json`
and no build step: they are plain Node ES modules.

| Script | What it does | Report |
|---|---|---|
| `tests/e2e.mjs` | Visits every route collecting console, page and network errors, then plays the main flows end to end: verb introduction (Meet → Forms → Drill → results), word introduction, the same two walkthroughs passed with the in-page answer oracle (drill passed → item learned → bonus XP, stamp and "Next verb / word"), spaced-repetition review (with its effect on the SRS state), all 21 games to their results screen (each round recorded in the stats with its XP), the games source picker (Games tab → Start, and a list as the preset source), search in English and its All / Words / Verbs segment, browse filters, adding a custom word and a custom verb, creating a list and adding an item, deleting a list through its menu, the entry action bar (word bank, list picker, mark learned, listen), the study scope screen, switching theme, the EN translation toggle, the twelve grammar topics, exporting a backup, a backup round trip (reset → import), creating and switching users, SM-2 scheduling through the store, and a reload to check that progress persisted. | `tests/report-e2e.json` |
| `tests/layout-audit.mjs` | Visits the same routes at three viewports (iPhone 13 390×664, 375×667, 430×932) in both themes and reports horizontal overflow, elements wider than the viewport, tap targets under 40px, overlapping interactive elements, crossword grid centring, inputs under 16px (iOS zoom) and clipped headings. | `tests/report-layout.json` |

`tests/lib.mjs` holds the shared pieces (route list, Playwright lookup, server check, error collection, seeding, and the
answer oracle: `answerOracle(page, rootSel, id)` reads the question card shown inside `rootSel` and computes the accepted
answer from `js/data.js` and `js/conjugator.js`, so a flow can pass a drill instead of guessing).

## Prerequisites

* Node 18 or newer.
* The `playwright` npm package and a Chromium build. The scripts look for `playwright` on the normal lookup path
  (a `node_modules` next to the repo, or `NODE_PATH`), then in `PLAYWRIGHT_DIR`, then in any
  `<tmp>/*/*/scratchpad/node_modules/playwright` checkout under the system temp directory. Point them at your copy with
  `PLAYWRIGHT_DIR=/path/containing/node_modules`.
* Chromium: `CHROME=/path/to/chrome` (default `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; when that path does
  not exist Playwright's own bundled Chromium is used, if installed).
* The app served over HTTP. The scripts default to `http://127.0.0.1:8123/` and, when nothing answers there, start
  `python3 -m http.server 8123 --bind 127.0.0.1` from the repo root for the duration of the run. To use your own server:

```bash
cd /path/to/italianapp && (python3 -m http.server 8123 --bind 127.0.0.1 >/dev/null 2>&1 &)
```

## Running

```bash
node tests/adaptive-e2e.mjs              # new lesson loops, repeated evidence, hints, skip and resume
node tests/game-learning-e2e.mjs         # shared game runner feeds accurate evidence without duplicate rewards
node tests/offline-e2e.mjs               # actual worker upgrade, failed precache and offline reload/resume
node tests/e2e.mjs                       # all routes + all flows (≈7 min)
node tests/layout-audit.mjs              # all routes × 3 viewports × 2 themes (≈2 min, viewports run in parallel)

node tests/e2e.mjs game/ review          # filters: only routes/flows whose name contains one of the arguments
node tests/layout-audit.mjs profile 375x667   # filters match "viewport/theme:route", so "375x667", "light" or "/home" all work
SHOTS=1 node tests/e2e.mjs               # also write screenshots into tests/shots/
BASE=http://localhost:8000/ node tests/e2e.mjs   # another server
```

Filters are OR-ed: a route or flow runs when its name contains *any* argument, so `game/ review` runs the 21 game routes,
the `/review` route and the `review` flow, and `profile 375x667` audits `/profile` at every viewport plus every route at
375×667. Route names look like `route:/game/quiz?src=level:A1`, flow names like `flow:game:quiz`, so `flow:` alone runs
every flow and no route. Flows that need learned items (`review`, `persistence`, `import-backup`) seed the fresh profile
themselves when `seed-learned` is not part of the run; `verb-intro-pass` / `word-intro-pass` first wipe the item's
progress so the learned bonus is paid deterministically; `games-picker` and `entry-actions` create the "E2E list" when
the `lists` flow did not run; `scope` restores the scope it found.

Both scripts print a readable report, write the JSON report next to themselves and exit with status 1 when anything
failed (2 on a fatal harness error), so they can gate a CI job or a pre-push hook. The layout audit prints one line
per route with the findings aggregated over the six viewport×theme combos (`taps<40 11–46` = the count varies between
combos, `(2/6: 375x667/dark, …)` = only some combos are affected), followed by the worst offenders per category; the
per-combo detail is in the JSON.

Environment variables: `BASE`, `AUTOSTART=0` (never start a server), `PLAYWRIGHT_DIR`, `CHROME`, `HEADLESS=0`,
`SHOTS=1`, `SEED=0` (layout audit: do not seed learned items into the fresh profile), `SOFT=taps,inputs`
(layout audit: downgrade categories to warnings; categories are `overflow, wide, taps, overlaps, crossword, inputs,
headings, console`), `MIN_TAP` (default 40), `CENTRE_TOL` (default 6).

## What counts as a failure

**e2e** — a route fails when it logs a console error, page error or failed same-origin request, renders an empty
`#view`, shows an error state ("Qualcosa è andato storto", "not found", "Unknown game") or a game cannot start
("needs at least …"). Placeholder views ("Coming soon") are warnings. A flow fails when it throws, does not reach the
results screen, or its store-level assertion fails (custom word stored, custom verb stored and shown with its
conjugation, list created with an item, list deleted, theme applied, EN toggle setting, SM-2 intervals — first correct
answer 8 h, second 3 days, a wrong one 10 minutes —, backup round trip restores learned items / XP / lists, a new user
starts empty and switching back keeps the first user's progress, learned count identical after reload; the review
increments `seen`, moves the answered items out of the due queue and grows today's review count; every game round adds
one play to `stats.games.<id>` and a correct answer raises the XP; the pass flows reach 66 % (verb) / 50 % (word) with
the oracle, mark the item learned, pay the learned bonus and show the next-item link; the picker starts the game with
the chosen source and a list-sourced round only lists that list's items; the entry actions add / remove the item in the
word bank, a list and the learned set; `/scope` saves the added level; browse rows belong to the level / topic / kind
and the count row shows the real total; the Verbs segment lists verbs only and a missing word offers the add link). Controls that
needed a DOM click because a real click was intercepted or timed out (1.5 s) are listed as warnings; on a loaded
machine these warnings can differ between runs while the pass/fail result does not. The percentages in the game
details are derived from "N of M correct" (the score ring animates for ~1 s after the results appear); the answers
themselves are random, so scores differ between runs.

**layout** — every finding is a failure unless its category is listed in `SOFT`:

* *overflow*: `document.documentElement.scrollWidth > window.innerWidth`.
* *wide*: a visible element inside `#view`, `#topbar` or `#tabs` whose box extends past the viewport (top-most
  offender only; children of scrollable or clipping containers are skipped).
* *taps*: visible `button, a.btn, .choice, .chip, .k, .m, #tabs a` shorter than 40px.
* *overlaps*: two visible interactive elements (`a[href], button, input, select, textarea, [role=button], [tabindex]`)
  whose boxes intersect by more than 4px in both directions, excluding ancestor/descendant pairs and anything inside
  `.fan, .deck, .reel, .stack`. Inline elements are compared fragment by fragment so wrapped spans do not collide.
  Fixed/sticky chrome (top bar, tab dock, sticky actions) is checked at scroll-top for the top bar and at scroll-bottom
  for the bottom bars, i.e. only where content cannot scroll out from under it.
* *crossword*: on the crossword route, `|centre of .cw − viewport/2| ≤ 6px`, and the grid must exist.
* *inputs*: visible `input, select, textarea` with `font-size < 16px` (iOS Safari zooms on focus).
* *headings*: visible `h1–h3` with `scrollWidth > clientWidth`.

The audit seeds 30 learned A1 items into the fresh profile first so lists, review and "learned" sources have content,
and emulates `prefers-reduced-motion: reduce` so measurements are not taken mid-animation.

## Selector policy (for the redesign)

Every run uses a fresh browser profile (empty IndexedDB, service worker blocked) and the scripts only rely on these
hooks, so class names and markup can change freely as long as they stay:

```
#view #topbar #tabs a[data-tab] #enToggle #backBtn #q #toast
[data-next] [data-answer] [data-check] [data-skip] [data-results] [data-hint] button.choice
[data-flash] [data-grade] [data-q] [data-add] [data-rm] [data-feedback-bar]
.cw (crossword grid) .k (keyboard keys) .m (matching tiles)
.wt-rail span.cur  .wt-scene[data-i][data-key]  [data-cta] [data-pat] .fan-card .tw-tap.target  .finito .stamp   (walkthrough deck)
.result-hero [data-replay] [data-practice]                                                          (results screens)
.dropdown-layer .dropdown.open [data-value=…]                                                       (glass drop-downs)
[data-f=…] [data-save] [data-seg=…] [data-v=…]                                                      (add-word form, profile segments)
[data-new] [data-pick] [data-menu=…] [data-act=ok|cancel]                                           (lists, dialogs)
[data-export] [data-file] [data-new-user] [data-user=…] [data-kind]                                 (profile, entry, search segment)
[data-next-verb] [data-next-word]                                                                   (Finito scene)
.q-card .prompt / .big / .sentence .blank  .choice-label  .aux-tile .aux-word                       (question card, read by the answer oracle)
[data-start] [data-src-pick]                                                                        (games source picker)
[data-actions] [data-act=bank|lists|learned] [data-say] input[data-list=…]                          (entry action bar, list picker)
button[data-level=…] [data-scope-dock] [data-save]                                                  (study scope)
```

plus a few visible labels found by role/text: "New list", "Save", "Add words", "Save to my word bank",
"Export backup", the theme buttons "Auto / Light / Dark", and results screens matching "*N of M correct*".
Bottom sheets and dialogs are found through `[role="dialog"]`. Store-level checks go through `import('./js/store.js')`
(and `./js/data.js`, `./js/conjugator.js`, `./js/views/grammar.js`, `./js/games/index.js`) in the page. The answer
oracle recognises questions by their `.prompt` tag ("What does it mean?", "Presente · io", "Quick check · Futuro",
"Which auxiliary?", "Participio passato", "Which preposition?", "Fill in the blank", "Which article?", "Choose the
plural", "Ascolta", "Scrivi / Type the Italian"…); a renamed tag makes the pass flows guess again and fail.

## Reading the JSON reports

`report-e2e.json`: `routes[]` (`route, ok, ms, errors[], warnings[], text, shot`), `flows[]` (`name, ok, ms, detail,
errors[], warnings[]`), `consoleErrors[]` (`at, text`) and `summary`.

`report-layout.json`: `results[]` — one entry per viewport × theme × route with `findings` (`overflow, wide[], taps[],
overlaps[], crossword, inputs[], headings[], counts`), `consoleErrors[]`, `failures`, `warnings`, `categories[]` —
plus `summary.byCategory` and `summary.worstRoutes`. Lists inside `findings` are capped at 12 items; `counts` has the
full numbers.

Games pick random items on every visit, so individual layout findings on game routes can differ between runs; the
categories and the non-game routes are stable.
