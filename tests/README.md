# Browser tests

Two Playwright scripts drive the real app in headless Chromium at phone sizes. There is no test runner, no `package.json`
and no build step: they are plain Node ES modules.

| Script | What it does | Report |
|---|---|---|
| `tests/e2e.mjs` | Visits every route collecting console, page and network errors, then plays the main flows end to end: verb introduction (Meet → Forms → Drill → results), word introduction, spaced-repetition review, all 21 games to their results screen, search, adding a custom word and a custom verb, creating a list and adding an item, deleting a list through its menu, switching theme, the EN translation toggle, the twelve grammar topics, exporting a backup, a backup round trip (reset → import), creating and switching users, SM-2 scheduling through the store, and a reload to check that progress persisted. | `tests/report-e2e.json` |
| `tests/layout-audit.mjs` | Visits the same routes at three viewports (iPhone 13 390×664, 375×667, 430×932) in both themes and reports horizontal overflow, elements wider than the viewport, tap targets under 40px, overlapping interactive elements, crossword grid centring, inputs under 16px (iOS zoom) and clipped headings. | `tests/report-layout.json` |

`tests/lib.mjs` holds the shared pieces (route list, Playwright lookup, server check, error collection, seeding).

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
node tests/e2e.mjs                       # all routes + all flows (≈5–6 min)
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
themselves when `seed-learned` is not part of the run.

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
starts empty and switching back keeps the first user's progress, learned count identical after reload). Controls that
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
[data-export] [data-file] [data-new-user] [data-user=…] [data-kind]                                 (profile, entry)
```

plus a few visible labels found by role/text: "New list", "Save", "Add words", "Save to my word bank",
"Export backup", the theme buttons "Auto / Light / Dark", and results screens matching "*N of M correct*".
Bottom sheets and dialogs are found through `[role="dialog"]`. Store-level checks go through `import('./js/store.js')`
(and `./js/data.js`, `./js/views/grammar.js`, `./js/games/index.js`) in the page.

## Reading the JSON reports

`report-e2e.json`: `routes[]` (`route, ok, ms, errors[], warnings[], text, shot`), `flows[]` (`name, ok, ms, detail,
errors[], warnings[]`), `consoleErrors[]` (`at, text`) and `summary`.

`report-layout.json`: `results[]` — one entry per viewport × theme × route with `findings` (`overflow, wide[], taps[],
overlaps[], crossword, inputs[], headings[], counts`), `consoleErrors[]`, `failures`, `warnings`, `categories[]` —
plus `summary.byCategory` and `summary.worstRoutes`. Lists inside `findings` are capped at 12 items; `counts` has the
full numbers.

Games pick random items on every visit, so individual layout findings on game routes can differ between runs; the
categories and the non-game routes are stable.
