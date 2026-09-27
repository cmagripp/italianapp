# PAROLA — Design brief: "Notte italiana"

This is the authoritative visual and interaction brief. Every engineer implements exactly these tokens, components and motions. Read it fully before touching CSS or views.

## 1. Concept

A night drive along the Italian coast. Deep ink-blue darkness, sodium-lamp gold, terracotta and Amalfi turquoise glowing through frosted glass. Every screen is a **scene**: a slowly drifting aurora of colour behind glass panes, Italian words set huge in a high-contrast serif, precise mono labels, and motion everywhere it helps — panning backdrops, zooming scene transitions, fanned card hands, a rotary dial for tenses, floating cards, stamps that slam down when something is learned.

The app must read as **bespoke**. Explicitly avoid: uniform white rounded cards on grey, emoji used as icons, centred-hero-block layouts repeated on every screen, default system-blue links, purple SaaS gradients, generic pill chips, flat lists of identical rows. Replace them with the components in §3.

Principles: (1) one dominant Italian word per scene; (2) depth through glass, light edges and layered backdrops, never through heavy drop shadows; (3) motion is cinematic and physical: ease-out zooms, springs, slow pans — never bouncy cartoon; (4) colour is keyed to CEFR level so the learner always feels where they are; (5) everything is laid out on an 8pt grid inside 16px gutters, nothing overlaps unless it is a deliberate fan/stack.

## 2. Tokens

Fonts (Google Fonts, `font-display: swap`, preconnect):
`https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap`
- `--font-display: "Fraunces", "Iowan Old Style", "Palatino", Georgia, serif;` Italian words, headings, numbers on hero counters. Use `font-variation-settings: "opsz" 144` for ≥40px, `"opsz" 24` for small; italics for greetings and emphasis; `"SOFT" 50` allowed on the meet card.
- `--font-text: "Manrope", -apple-system, "SF Pro Text", "Segoe UI", sans-serif;` all UI text.
- `--font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;` labels, level/pos/tense tags, counters, step "03 / 12". Always uppercase with `letter-spacing: .12em`, 11–12px.

Type scale (px): 11 label · 13 small · 15 body · 17 lead · 22 h3 · 28 h2 · 36 h1 · 48 display · 64 hero-word (clamp to 40–64 by word length).

Colour tokens (define on `:root`, redefine in dark; **default theme = dark**; light is opt-in "Mezzogiorno"):

Dark ("Notte", default):
```
--bg-0:#070912; --bg-1:#0d1120; --bg-2:#141a2e;
--ink:#f3efe7; --ink-2:#b8b4ab; --ink-3:#7f7c75; --ink-4:#4d4b47;
--glass: rgba(255,255,255,.06); --glass-strong: rgba(255,255,255,.10); --glass-border: rgba(255,255,255,.14); --glass-highlight: rgba(255,255,255,.28);
--gold:#f2c14e; --gold-2:#ffd97a; --terracotta:#e0673f; --amalfi:#38bdf8; --turquoise:#2dd4bf; --lemon:#fde68a; --olive:#a3b86c; --wine:#b8323f; --plaster:#f4efe6;
--lvl-A1:#34d399; --lvl-A2:#22d3ee; --lvl-B1:#fbbf24; --lvl-B2:#fb7a4b; --lvl-C1:#a78bfa; --lvl-C2:#f43f5e;
--ok:#34d399; --ko:#fb7185; --warn:#fbbf24; --info:#38bdf8;
--stage-new:#8b90a3; --stage-learning:#fbbf24; --stage-review:#38bdf8; --stage-mastered:#34d399;
--shadow-1: 0 10px 30px rgba(0,0,0,.35); --shadow-2: 0 24px 60px rgba(0,0,0,.5);
```
Light ("Mezzogiorno"):
```
--bg-0:#f4efe6; --bg-1:#fbf8f2; --bg-2:#ffffff;
--ink:#171722; --ink-2:#55556a; --ink-3:#8a8a99; --ink-4:#c9c7c0;
--glass: rgba(255,255,255,.58); --glass-strong: rgba(255,255,255,.78); --glass-border: rgba(20,20,40,.08); --glass-highlight: rgba(255,255,255,.9);
--gold:#d99a12; --gold-2:#f2c14e; --terracotta:#c9502a; --amalfi:#0891b2; --turquoise:#0d9488; --lemon:#f4d35e; --olive:#7d9a3c; --wine:#9f2a36;
--lvl-A1:#0f9f6e; --lvl-A2:#0891b2; --lvl-B1:#d19a10; --lvl-B2:#d9552a; --lvl-C1:#7c5cd6; --lvl-C2:#d61f45;
--ok:#0f9f6e; --ko:#d9365a; --warn:#d19a10; --info:#0891b2;
--shadow-1: 0 10px 30px rgba(40,30,10,.10); --shadow-2: 0 24px 60px rgba(40,30,10,.16);
```
Theme switching: `:root[data-theme="light"]` → light set; `:root[data-theme="dark"]` and default (no attribute, and `prefers-color-scheme: dark` OR no preference) → dark. Body always sets `background: var(--bg-0); color: var(--ink)`.

Spacing: 4 · 8 · 12 · 16 · 24 · 32 · 48. Radii: `--r-s:12px; --r-m:20px; --r-l:28px; --r-pill:999px`. Borders: 1px glass border; hairlines `rgba(255,255,255,.08)` (dark) / `rgba(20,20,40,.06)` (light).

Motion: `--ease-out: cubic-bezier(.2,.8,.2,1); --ease-in-out: cubic-bezier(.65,0,.35,1); --ease-spring: cubic-bezier(.34,1.4,.64,1); --t-fast:160ms; --t-base:260ms; --t-slow:420ms; --t-scene:700ms; --t-ambient:70s;` `prefers-reduced-motion: reduce` → ambient/parallax/float off, transitions cut to 120ms fades.

Z-layers: backdrop 0 · content 1 · floating panes 5 · sticky docks 10 · top/tab bars 50 · sheets/dropdowns 100 · toast 200.

## 3. Components (class names are binding)

- **Aurora backdrop** `.aurora` (fixed, full-screen, `z:0`, `pointer-events:none`): 3 radial-gradient orbs (`.aurora .orb` ×3, 60–80vw, blur 60px, opacity .55 dark / .75 light) drifting on 60–90s keyframes with different paths, plus `.grain` overlay (SVG feTurbulence data-URI, opacity .08 dark / .05 light, `mix-blend-mode: overlay`). Orb colours set by CSS vars `--orb-1/--orb-2/--orb-3`, keyed to the current level (`fx.setScene(level)`) or to a section (home: gold/amalfi/terracotta; games: terracotta/violet/turquoise; reference: amalfi/gold/olive). Scroll parallax: orbs translateY(−scrollY×0.08) via rAF. Implemented in `js/fx.js` as `mountAurora()` / `setScene({colors})`.
- **Glass pane** `.glass` — `background: var(--glass); backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: …; border:1px solid var(--glass-border); border-radius: var(--r-m); box-shadow: var(--shadow-1), inset 0 1px 0 var(--glass-highlight);` Variants `.glass-strong`, `.glass-flat` (no blur, for lists of many rows — max 6 blurred panes per screen for iOS performance), `.glass-tint` with `--tint` (level colour at 12%).
- **Top bar** `#topbar`: transparent over the aurora with a bottom hairline that appears after 8px scroll; title in `--font-display` 20px; back button is a 40px glass circle with an SVG chevron; EN toggle is a glass pill that becomes gold when always-on (`.on`), label "EN" in mono.
- **Tab bar** `#tabs`: a floating glass dock, 16px from the sides and 10px above the safe area (`border-radius: var(--r-l)`), five SVG icons (home, learn, play, words, me) with mono labels; the active tab has a gold dot and a soft glow.
- **Buttons** `.btn` (56px tall, radius pill, `--font-text` 700, press = `transform: scale(.97)` + brightness) — `.btn.primary`: gold→gold-2 gradient with a moving sheen (`::after` sweep on hover/focus and once on mount); `.btn.secondary`: glass; `.btn.ghost`: hairline; `.btn.danger`: wine. Sizes `.sm` 40px, `.xs` 32px. Icon buttons `.icon-btn` 40px glass circle.
- **Chips** `.chip` (36px, glass, mono uppercase 11px) — `.on` = level colour fill with dark text; scrollable row `.chips.scroll` with edge fade masks.
- **Headword block** `.headword`: article in `--ink-2` italic, word in `--font-display` 48–64px weight 600, tight leading; below: `.headword-en` tap-for-English reveal — an inline glass pill "EN" that slides open to reveal the translation (`.itx` mechanism keeps working); speak button `.speak` 44px glass circle with SVG speaker that pulses while speaking.
- **Level chip** `.lvl.lvl-A1…C2`: mono, 1px border in level colour, level colour text on dark; filled when active.
- **Tags row** `.tags`: mono labels separated by `·` (e.g. `VERBO · -ARE · IRREGOLARE · AUX. AVERE`).
- **Progress rail** `.rail`: vertical (walkthrough) or horizontal (drills) rail of segments; done = level colour, current = gold glow, todo = hairline; with mono counter `03 / 12`.
- **Orbit** `.orbit` (home): concentric rings for A1–C2 rendered as SVG; each ring's stroke-dasharray shows learned/total; the current level ring glows; centre shows XP in display serif.
- **Entry row** `.row-entry`: glass-flat, 64px, Italian headword in display 20px, meaning in `--ink-2` 14px, right side level chip + stage dot with glow; pressed = scale .985.
- **Section header** `.sec-head`: mono kicker (e.g. `TONIGHT`) + display title, optional right link in gold.
- **Tense table** `.tense-table`: 6 rows; person in mono, form in display 20px; irregular cells get a terracotta left rule and `.irr`; alt forms in `--ink-3` small; a speak button per row; row reveal animation (stagger 40ms) when the table mounts.
- **Rotary dial** `.dial` (`fx.dial(el, {items, index, onChange})`): a half-circle arc at the top of its container; items positioned on the arc; drag/swipe horizontally or tap to rotate; the selected item snaps to top-centre at 1.0 scale in gold, neighbours shrink and fade by distance; spring easing; supports keyboard arrows. Used to choose tense (walkthrough/reference/drill options) and, on home, to choose level.
- **Card fan** `.fan` (`fx.fan(el, cards, {onFlip})`): 6 cards fanned like a hand along an arc (rotate −22°…+22°, translateY by |i−2.5|²×6px), each `.fan-card` has front (person, mono) and back (form, display) with a 3D flip on tap; tapped card lifts to front (`z` + translateY(−18px)); a "spread" toggle lays them in a 2×3 grid. Glass cards with level-tinted backs.
- **Reel** `.reel`: horizontal scroll-snap row of tall poster cards (`.poster`, 200×280, radius 24, gradient in section colours + big display title + mono subtitle); the centred card scales to 1.0 and tilts back into place (`perspective: 900px`), neighbours 0.92 and dimmed (IntersectionObserver or scroll listener updates `.active`).
- **Glass dropdown** `.dropdown` (`fx.dropdown(anchorEl, contentHTML)`): anchored panel that slides down 8px + fades in with blur, spring; closes on outside tap/Escape; options list with check marks. Used for scope, list and tense pickers where a full sheet is too heavy.
- **Bottom sheet** `.sheet`: glass-strong, drag handle, 28px top radius, spring in.
- **Question card** `.q-card`: glass, kicker in mono (e.g. `PRESENTE · TU`), prompt in display; `.choices .choice`: 56px glass rows with mono index letters (A B C D) at left, press depth; `.correct` = ok tint with check icon and a 300ms pulse, `.wrong` = ko tint with shake; `.feedback` bar slides up from the bottom of the card with the explanation; typed input `.input.big` glass, display font 24px, accent bar `.accents` of 40px glass keys.
- **Results** `.results`: score in display 72px with an animated count-up, ring of level colour, a stamp `.stamp` ("PERFETTO" / "IMPARATO" / "RIPROVA") that scales from 1.6→1 with a −12° rotation and a thud, particle burst (`fx.confetti(colors)`, canvas, 900ms) on ≥80%.
- **Walkthrough scene** `.scene`: `height: 100dvh` (fallback 100vh) snap card; layout grid rows `auto 1fr auto`: header (mono step counter + title), body (centred content, max-width 560), footer (CTA + hint). Scene backdrop hue shifts per card via `--orb-*`; entering scene: `transform: scale(1.06); filter: blur(6px); opacity:0` → identity over `--t-scene`; letters of the headword rise in with 30ms stagger (`.rise > span`).
- **Float** `.float`: `animation: float 6s ease-in-out infinite` (translateY ±6px, slight rotate ±.5°), with a soft glow `box-shadow: 0 0 60px -20px <level colour>`.
- **Ticker** `.ticker`: a slow marquee line (display italic 18px, `--ink-2`) of Italian words, 40s loop, edge-masked.
- **Stage dot** `.dot.stage-*`: 8px with 12px glow in the stage colour.
- **Toast** `#toast`: glass-strong pill above the tab dock; `.ok` gold text, `.ko` ko text.
- **Empty state** `.empty`: display italic sentence + one primary action; no emoji.
- **Icons**: inline SVG (24px, stroke 1.75, round caps), a small set in `js/icons.js`: home, book, play, search, user, chevron, speaker, star, list, check, x, plus, dial, spread, flip, flame, orbit. Emoji may remain only as avatar choices and category glyphs inside the browse tiles (rendered small, 18px).

## 4. Motion spec

- Scene/route transition (`#view`): outgoing scale .98 + fade 160ms; incoming from scale 1.03 + translateY(8px) + fade 260ms `--ease-out`.
- Panes mount with 24px rise + fade, staggered 50ms in reading order (add `.mount` on render; CSS handles it).
- Tables/rows stagger 40ms. Dial rotation spring 420ms. Fan flip 420ms 3D. Reel scale 260ms.
- Success: choice pulse + gold sheen sweep on the CTA; completion: stamp thud (scale 1.6→1, rotate −12°, 320ms `--ease-spring`) then confetti.
- Failure: 250ms shake, ko tint; never a red full-screen.
- Ambient: aurora orbs drift, ticker scrolls, floats bob; all paused when `document.hidden` and disabled under reduced motion.
- Parallax: aurora orbs at 0.08×scroll; hero words at 0.15× (walkthrough meet card), via a single rAF scroll listener in `fx.js`.

## 5. Per-screen guidance

- **Home**: aurora in gold/amalfi/terracotta. Greeting in display italic 36px ("Buonasera, Caleb."), mono date/streak line; `.ticker` of recently learned words. "TONIGHT" glass pane: three display counters (to review / new words / new verbs) with mono labels and a level-coloured rail; primary CTA "Continue" with sheen; the weekly dots become a 7-segment rail. **Orbit** of levels with XP in the centre; tapping a ring sets the level. "Word of the night" and "Verb of the night" as two `.float` glass cards side-by-side (stacked at <360px), each with headword, meaning reveal, speak. **Reel** of game posters (5 posters) leading to `#/games`. No plain lists on home.
- **Learn hub**: level-coloured scene. "NEXT UP" as a **deck**: the next 3 verbs as stacked glass cards (peeking 8px offsets, slight rotations), the top card shows infinitive + meaning reveal; tapping starts the walkthrough. Same for words. Review pane with a ring showing due count and a "Review now" CTA. Scope shown as a mono line with a **glass dropdown** to change it.
- **Verb walkthrough** (`#/learn/verb/:id`, tab bar hidden, top bar minimal): vertical scroll-snap scenes, rail on the right edge, ~12 scenes as in the feature spec; Meet scene with the hero word rising letter by letter, article/aux/level tags, EN reveal, speak; tense scenes use the **card fan** (persons) with a quick check after all flips; the patterns scene uses **glass dropdowns**; the auxiliary scene uses two big glass tiles; examples scene types the sentence word by word (60ms/word) with tap-to-reveal English; the drill scene hosts the question runner; completion scene stamps IMPARATO + confetti + next CTA.
- **Word walkthrough**: 6–8 scenes in the same language (meet, forms flip cards, example with tap-the-word, listen & pick, type it, quick check, completion).
- **Review**: question runner on a level-tinted scene; rail on top.
- **Games hub**: reel of 21 posters grouped in two reels (Vocabulary, Verbs) with section kickers; tapping a poster opens the source picker as a bottom sheet (glass) with the **dial** for tenses where relevant.
- **Games**: question runner as specified; **crossword**: grid perfectly centred, sized to the width, in a glass frame that scrolls internally when tall; current clue in a glass strip above a **keyboard dock** fixed to the bottom (glass-strong, above the safe area), check/results inside the dock; **hangman**: word slots centred, minimalist SVG figure drawn stroke by stroke (draw-on animation), keyboard dock; **matching**: 2-column glass tiles, matched pairs dissolve; **flashcards**: 3D flip with the rest of the deck peeking behind, rate bar of four glass buttons; **sentence builder**: chips fly into the answer line; **speed round**: gold timer rail draining, streak counter in display.
- **Words/search**: search field as a big glass bar with the display placeholder "cerca…"; results as entry rows; browse as a **reel** of level posters + a glass grid of topics (small glyph + mono name).
- **Browse/list/lists**: entry rows in glass-flat groups with sticky mono kickers; filters as chips; list actions in a glass dropdown.
- **Entry / Reference**: **Codex** layout — identity block (headword, tags, at-a-glance strip), **dial** to pick the tense with the tense table animating in below, fan toggle, accordion sections (`.acc` glass rows that expand with height animation) for the rest; sticky mini-header with the infinitive when scrolled past the headword; jump chips.
- **Grammar**: reading layout on glass, display headings, examples in tense-table style.
- **Profile**: avatar in a gold ring, XP in display, heat-map cells glowing by intensity, settings as glass rows with dial-like segmented controls, backup & cloud sync panes, users as a horizontal reel of avatar cards.
- **Scope**: level dial at the top (selected level colours the scene), topics as chips, lists as glass rows.

## 6. Accessibility & iOS

Text contrast ≥ 4.5:1 (ink on glass over dark is fine; in light mode `.glass` must sit on `--bg-0` and use `--ink`). Inputs ≥16px. Tap targets ≥ 40px. Safe areas via `env(safe-area-inset-*)`. `100dvh` with `100vh` fallback. `backdrop-filter` with `-webkit-` prefix; at most 6 blurred panes per screen; animate only transform/opacity; `will-change` only on the aurora orbs and the active fan card. `prefers-reduced-motion` respected. Dark is the default; the theme setting offers Auto / Notte / Mezzogiorno.

## 7. Implemented CSS & JS reference

(Appended by the design-system engineer after implementation: every token, class and `fx.js` API actually shipped, with one-line usage notes. Feature engineers use exactly these.)
