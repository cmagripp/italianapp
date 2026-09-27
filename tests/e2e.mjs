#!/usr/bin/env node
// End-to-end regression suite: visits every route collecting console/page errors, then plays the main flows
// (verb & word introductions, review, the games, search, custom words, lists, theme, export, persistence).
//
//   node tests/e2e.mjs                 everything
//   node tests/e2e.mjs game/ review    only routes/flows whose name contains one of the filters
//   SHOTS=1 node tests/e2e.mjs         also write screenshots into tests/shots/
//
// Exit code 1 when anything failed. JSON report: tests/report-e2e.json. See tests/README.md.
//
// Selector policy (the UI is being redesigned): only ids / data-attributes / a few binding class names are used —
// #view #topbar #tabs a[data-tab] #enToggle #backBtn #q #toast [data-next] [data-answer] [data-check] [data-skip]
// [data-results] [data-hint] button.choice [data-flash] [data-grade] [data-q] [data-add] [data-rm] .cw .k .m
// [data-export] [data-file] [data-f] [data-save] [data-seg]/[data-v] [data-new] [data-pick] [data-menu] [data-act]
// [data-new-user] [data-user] [data-kind], the walkthrough deck (.wt-rail .cur / .wt-scene[data-i][data-key] / [data-cta]),
// the results hero and the glass drop-down (.dropdown-layer .dropdown.open [data-value]) — everything else goes through
// roles and text. The full list is in tests/README.md.
import fs from 'node:fs';
import {
  loadPlaywright, launchBrowser, contextOptions, ensureServer, BASE, allRoutes, cliFilters, matches, routeSlug,
  makeSink, attachCollectors, boot, reloadApp, gotoRoute, settle, viewText, seedProgress, shot, writeReport, wait, ms, pad,
} from './lib.mjs';

const filters = cliFilters();
const { chromium, devices, from } = await loadPlaywright();
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const device = devices['iPhone 13'];
const ctx = await browser.newContext(contextOptions(device));
const page = await ctx.newPage();
page.setDefaultTimeout(4000);
const sink = makeSink();
attachCollectors(page, sink);

const report = { suite: 'e2e', generatedAt: new Date().toISOString(), base: BASE, playwright: from, device: `iPhone 13 ${device.viewport.width}x${device.viewport.height}`, filters, routes: [], flows: [], consoleErrors: [], warnings: [], summary: {} };
const log = (...a) => console.log(...a);
const errorsSince = (n) => sink.errors.slice(n).map(e => e.text);

// ---------- generic helpers ----------
async function has(sel) { return (await page.locator(sel).count()) > 0; }
// Real click first (so unreachable controls surface as warnings), DOM click as a fallback so a flow can still progress.
// soft: the control may legitimately vanish while we try (a "Continue" that auto-advances after a correct answer) —
// then the tap counts as done instead of failing the flow.
async function tap(target, { timeout = 1500, label = '', js = false, soft = false } = {}) {
  const loc = (typeof target === 'string' ? page.locator(target) : target).first();
  if (js) { await loc.evaluate(el => el.click()); return 'js'; } // timed rounds: no time for the actionability checks
  try { await loc.click({ timeout }); return 'click'; } catch (err) {
    if (soft && !(await loc.count())) return 'gone';
    try { await loc.evaluate(el => el.click(), null, { timeout: 500 }); sink.push('warn', `used a DOM click for ${label || target} (real click failed: ${String(err.message).split('\n')[0].slice(0, 120)})`); return 'js'; }
    catch (err2) {
      if (soft && !(await loc.count())) return 'gone';
      throw new Error(`${String(err.message).split('\n')[0].slice(0, 100)} — DOM click for ${label || target} failed too: ${String(err2.message).split('\n')[0].slice(0, 100)}`);
    }
  }
}
async function isResults() {
  return page.evaluate(() => {
    const v = document.querySelector('#view'); if (!v) return false;
    if (v.querySelector('.result-hero, [data-replay], [data-practice]')) return true;
    return /\b\d+\s+of\s+\d+\s+correct\b/i.test(v.innerText || '');
  });
}
async function resultsSummary() {
  const t = await page.evaluate(() => document.querySelector('#view')?.innerText || '');
  // the score ring counts up for ~900ms after the results appear, so the percentage is derived from "N of M correct"
  const m = t.match(/(\d+)\s+of\s+(\d+)\s+correct/i);
  return m ? `${Number(m[2]) ? Math.round((Number(m[1]) / Number(m[2])) * 100) : 0}% (${m[1]} of ${m[2]} correct)` : (t.replace(/\s+/g, ' ').slice(0, 80));
}
async function storeEval(fn, arg) {
  // fn is a string body of an async function receiving ({ store, data }, arg)
  return page.evaluate(async ({ body, arg }) => {
    const { store } = await import('./js/store.js');
    const { data } = await import('./js/data.js');
    const f = new Function('ctx', 'arg', `return (async () => { ${body} })();`);
    return f({ store, data }, arg);
  }, { body: fn, arg });
}

// Plays any drill / game screen until the results screen shows, answering with whatever is available.
async function playToResults({ maxSteps = 120, idleLimit = 20, fast = false } = {}) {
  const LETTERS = 'eaiontrlscudpmgvhbfzqkxjwy'.split('');
  const tried = new Set(); let hints = 0; let idle = 0; const actions = [];
  const act = (a) => { actions.push(a); idle = 0; };
  for (let step = 0; step < maxSteps; step++) {
    if (await isResults()) return { ok: true, steps: step, actions };
    if (await has('[data-next]')) { await tap('[data-next]', { label: '[data-next]', js: fast, soft: true }); tried.clear(); act('next'); await wait(fast ? 120 : 250); continue; }
    if (await has('[data-results]')) { await tap('[data-results]', { label: '[data-results]' }); act('results'); await wait(300); continue; }
    // multiple choice (drills, speed round)
    const choices = page.locator('button.choice:not([disabled])');
    const nChoices = await choices.count();
    if (nChoices) { await tap(choices.nth(Math.floor(Math.random() * nChoices)), { label: 'button.choice', js: fast }); act('choice'); await wait(fast ? 120 : 300); continue; }
    // typed answer
    if (await has('input[data-answer]:not([disabled])') && await has('[data-check]')) {
      await page.locator('input[data-answer]').first().fill('prova');
      await tap('[data-check]', { label: '[data-check]' }); act('typed'); await wait(250); continue;
    }
    // flashcards: flip, then grade
    if (await has('[data-grade] [data-q]')) {
      if (await has('[data-flash]')) await tap('[data-flash]', { label: '[data-flash]' });
      await wait(300);
      const good = page.locator('[data-grade] [data-q="4"]');
      await tap((await good.count()) ? good : page.locator('[data-grade] [data-q]').nth(2), { label: '[data-q]' });
      act('grade'); await wait(250); continue;
    }
    // matching tiles
    if (await has('.m')) {
      const tiles = await page.$$eval('.m', els => els.map(e => ({ side: e.dataset.side || '', id: e.dataset.id || '', done: e.classList.contains('done') || e.hasAttribute('disabled') })));
      const open = tiles.map((t, i) => ({ ...t, i })).filter(t => !t.done);
      if (!open.length) { await wait(500); idle++; if (idle > idleLimit) break; continue; }
      const a = open.find(t => t.side === 'a') || open[0];
      const others = open.filter(t => t.i !== a.i && (!a.side || t.side !== a.side));
      const b = others.find(t => a.id && t.id === a.id) || others[Math.floor(Math.random() * others.length)];
      if (!b) { await wait(300); idle++; continue; }
      await tap(page.locator('.m').nth(a.i), { label: '.m' }); await tap(page.locator('.m').nth(b.i), { label: '.m' });
      act('match'); await wait(500); continue;
    }
    // crossword: a few hints, check (confirm dialog is auto-accepted), then results
    if (await has('.cw')) {
      if (hints < 3 && await has('[data-hint]')) { await tap('[data-hint]', { label: '[data-hint]' }); hints++; act('hint'); await wait(150); continue; }
      if (await has('[data-check]')) { await tap('[data-check]', { label: '[data-check]' }); act('check'); await wait(400); continue; }
    }
    // hangman keyboard: letters by frequency
    if (await has('.k')) {
      const l = LETTERS.find(x => !tried.has(x));
      if (l) {
        tried.add(l);
        const byText = page.locator('.k').filter({ hasText: new RegExp(`^${l}$`) });
        const key = (await byText.count()) ? byText : page.locator(`.k[data-l="${l}"]`);
        if (await key.count()) { await tap(key, { label: '.k' }); act('key'); await wait(120); continue; }
      }
    }
    // sentence builder: tap the bank words in any order, then check
    if (await has('[data-add]')) {
      const chosen = await page.$$eval('[data-answer] [data-rm]', els => els.map(e => e.dataset.rm));
      const bank = await page.$$eval('[data-add]', els => els.map(e => e.dataset.add));
      const next = bank.find(v => !chosen.includes(v));
      if (next !== undefined) { await tap(`[data-add="${next}"]`, { label: '[data-add]' }); act('word'); await wait(120); continue; }
      if (await has('[data-check]:not([disabled])')) { await tap('[data-check]:not([disabled])', { label: '[data-check]' }); act('check'); await wait(300); continue; }
    }
    if (await has('[data-skip]')) { await tap('[data-skip]', { label: '[data-skip]' }); act('skip'); await wait(200); continue; }
    await wait(200);
    if (++idle > idleLimit) break;
  }
  return { ok: await isResults(), steps: maxSteps, actions, stuck: await viewText(page, 160) };
}

// ---------- route visits ----------
async function visitRoute(route) {
  sink.current = 'route:' + route;
  const n = sink.errors.length; const t0 = Date.now();
  const rec = { route, ok: true, ms: 0, errors: [], warnings: [], text: '' };
  try {
    await gotoRoute(page, route);
    rec.text = await viewText(page, 160);
    const hash = await page.evaluate(() => location.hash);
    if (!hash.startsWith('#' + route.split('?')[0])) rec.warnings.push(`redirected to ${hash}`);
    if (!rec.text) rec.errors.push('empty #view');
    if (/Qualcosa è andato storto|not found|Unknown game|Could not load the dictionary/i.test(rec.text)) rec.errors.push(`error state: "${rec.text.slice(0, 90)}"`);
    if (/Coming soon/i.test(rec.text)) rec.warnings.push('placeholder view ("Coming soon")');
    if (route.startsWith('/game/') && /needs at least|No questions could be made|No suitable words|Need at least|No example sentences/i.test(rec.text)) rec.errors.push(`game did not start: "${rec.text.slice(0, 90)}"`);
    rec.shot = await shot(page, 'e2e_route_' + routeSlug(route));
  } catch (err) { rec.errors.push('exception: ' + err.message.split('\n')[0]); }
  rec.errors.push(...errorsSince(n));
  rec.ok = rec.errors.length === 0; rec.ms = Date.now() - t0;
  report.routes.push(rec);
  log(`  ${rec.ok ? '✓' : '✗'} ${pad(route, 44)} ${pad(ms(rec.ms), 7)} ${rec.errors[0] || rec.warnings[0] || rec.text.slice(0, 70)}`);
}

// ---------- flows ----------
const learned = { before: null };
const gameFlow = (id, query, extra = {}) => ({ name: `game:${id}`, run: async () => {
  await gotoRoute(page, `/game/${id}?src=level:A1&${query}`);
  const t = await viewText(page, 120);
  if (/needs at least|No questions|No suitable|Need at least|No example/i.test(t)) throw new Error(`game did not start: ${t}`);
  const r = await playToResults(extra);
  if (!r.ok) throw new Error(`did not reach results after ${r.steps} steps (${r.actions.length} actions): ${r.stuck}`);
  return `${await resultsSummary()} · ${r.actions.length} actions`;
} });

// ---------- walkthrough (verb / word introduction) helpers ----------
// The scene deck keeps every scene in the DOM; the current one carries the rail's .cur segment (index = data-i).
async function sceneState() {
  return page.evaluate(() => {
    const segs = [...document.querySelectorAll('.wt-rail span')];
    const i = segs.findIndex(s => s.classList.contains('cur'));
    const el = document.querySelector(`.wt-scene[data-i="${i}"]`);
    const cta = el?.querySelector('[data-cta]');
    return { i, n: segs.length, key: el?.dataset.key || null, ready: cta ? !cta.disabled : null, hasCta: !!cta, text: (el?.innerText || '').replace(/\s*\n+\s*/g, ' | ').trim().slice(0, 160) };
  });
}
// Plays the deck scene by scene: interacts with whatever the scene offers (data-next hook, fan cards, patterns, tap-the-word,
// choices, typed answers, the in-scene drill) until the CTA unlocks, then taps "Avanti". Stops on the last scene.
async function playWalkthrough({ maxScenes = 16 } = {}) {
  const seen = [];
  for (let guard = 0; guard < maxScenes * 40; guard++) {
    const st = await sceneState();
    if (st.i < 0) { await wait(200); continue; }
    if (!seen.includes(st.key)) seen.push(st.key);
    if (st.i === st.n - 1) return { ok: true, scenes: seen };
    if (st.ready) {
      await tap(`.wt-scene[data-i="${st.i}"] [data-cta]`, { label: `Avanti (${st.key})` });
      const before = st.i;
      for (let k = 0; k < 12; k++) { await wait(150); if ((await sceneState()).i !== before) break; }
      if ((await sceneState()).i === before) throw new Error(`"Avanti" did not leave scene ${before} (${st.key})`);
      continue;
    }
    const ss = `.wt-scene[data-i="${st.i}"]`;
    // a glass dropdown (Cases & patterns) takes the [data-next] hook while open: confirm it, then open the next pattern.
    // DOM clicks here: the row hands the hook to the dropdown the moment it opens, which trips a real click's retries.
    if (await has('.dropdown-layer .dropdown.open [data-value]')) { await tap('.dropdown-layer .dropdown.open [data-value]', { js: true }); await wait(450); continue; }
    if (await has(`${ss} [data-pat]:not(.seen)`)) { await tap(`${ss} [data-pat]:not(.seen)`, { js: true }); await wait(500); continue; }
    // one thing the scene marks as "next": Reveal all, Not sure — show me…
    if (await has(`${ss} [data-next]`)) { await tap(`${ss} [data-next]`, { label: `[data-next] (${st.key})` }); await wait(350); continue; }
    if (await has(`${ss} .tw-tap.target`)) { await tap(`${ss} .tw-tap.target`, { label: 'tap the word' }); await wait(300); continue; }
    if (await has(`${ss} .fan-card:not(.flipped)`)) { await tap(`${ss} .fan-card:not(.flipped)`, { label: 'fan card' }); await wait(250); continue; }
    const choices = page.locator(`${ss} button.choice:not([disabled])`);
    if (await choices.count()) { await tap(choices.nth(Math.floor(Math.random() * await choices.count())), { label: 'button.choice' }); await wait(350); continue; }
    if (await has(`${ss} input[data-answer]:not([disabled])`) && await has(`${ss} [data-check]`)) {
      await page.locator(`${ss} input[data-answer]`).first().fill('prova');
      await tap(`${ss} [data-check]`, { label: '[data-check]' }); await wait(300); continue;
    }
    // the in-scene drill's feedback bar ("Continue" auto-advances after a correct answer, so it may vanish under us)
    if (await has('[data-feedback-bar] [data-next]')) { await tap('[data-feedback-bar] [data-next]', { label: 'Continue', soft: true }); await wait(300); continue; }
    if (await has(`${ss} [data-skip]:not([hidden])`)) { await tap(`${ss} [data-skip]:not([hidden])`, { label: '[data-skip]' }); await wait(300); continue; }
    await wait(250);
  }
  const st = await sceneState();
  return { ok: false, scenes: seen, stuck: `${st.key} (${st.i + 1}/${st.n}) ready=${st.ready}: ${st.text}` };
}
async function isLearned(id) { return storeEval(`return ctx.store.isLearned(arg);`, id); }
// review, persistence and the backup round trip need learned items: seed them when such a flow runs on its own
// (e.g. `node tests/e2e.mjs review`); in a full run the seed-learned flow has already done it.
async function ensureSeeded() {
  const n = await storeEval(`return ctx.store.learnedIds().length;`);
  if (n >= 30) return n;
  const s = await seedProgress(page, { words: 20, verbs: 10 }); learned.before = s; return s.learned;
}
async function finitoSummary() {
  return page.evaluate(() => {
    const fin = document.querySelector('.wt-scene[data-key="finito"] .finito');
    const t = (fin?.innerText || '').replace(/\s+/g, ' ');
    const m = t.match(/(\d+)%\s*·\s*(\d+) of (\d+) correct/i);
    return { text: t.slice(0, 120), score: m ? `${m[1]}% (${m[2]} of ${m[3]} correct)` : null, stamp: fin?.querySelector('.stamp')?.textContent.trim() || '', escaped: /<a |<button /.test(t) };
  });
}

const flows = [
  { name: 'verb-intro', run: async () => {
    await gotoRoute(page, '/learn/verb/v:mangiare');
    const st = await sceneState();
    if (st.key !== 'meet' || !/mangiare/i.test(st.text)) throw new Error(`walkthrough did not open on the Meet scene: ${st.key} ${st.text}`);
    if (await has('.wt-scene[data-key="meet"] [data-skip]:not([hidden])')) sink.push('warn', 'skip link visible on the Meet scene');
    const r = await playWalkthrough();
    await shot(page, 'e2e_verb_finito');
    if (!r.ok) throw new Error(`walkthrough did not reach Finito (${r.scenes.join(' → ')}): ${r.stuck}`);
    const fin = await finitoSummary();
    if (fin.escaped) throw new Error(`Finito renders escaped HTML: ${fin.text}`);
    if (!fin.score) throw new Error(`Finito shows no drill score: ${fin.text}`);
    if (/\b0 of 0\b/.test(fin.score)) throw new Error(`Finito reports an empty drill: ${fin.score}`);
    const tenses = r.scenes.filter(k => k.startsWith('tense-')).length;
    return `${r.scenes.length} scenes (${tenses} tenses) → ${fin.score} · stamp ${fin.stamp || '—'} · learned=${await isLearned('v:mangiare')}`;
  } },
  { name: 'word-intro', run: async () => {
    await gotoRoute(page, '/learn/word/w:casa|noun');
    if (!/casa/i.test(await viewText(page, 300))) throw new Error('meet card does not show "casa"');
    const r = await playWalkthrough();
    await shot(page, 'e2e_word_finito');
    if (!r.ok) throw new Error(`walkthrough did not reach Finito (${r.scenes.join(' → ')}): ${r.stuck}`);
    const fin = await finitoSummary();
    if (fin.escaped) throw new Error(`Finito renders escaped HTML: ${fin.text}`);
    if (!fin.score) throw new Error(`Finito shows no check score: ${fin.text}`);
    return `${r.scenes.join(' → ')} → ${fin.score} · stamp ${fin.stamp || '—'} · learned=${await isLearned('w:casa|noun')}`;
  } },
  { name: 'seed-learned', run: async () => {
    const s = await seedProgress(page, { words: 20, verbs: 10 });
    if (s.learned < 30) throw new Error(`expected >= 30 learned, store has ${s.learned}`);
    learned.before = s;
    await gotoRoute(page, '/home');
    const t = await viewText(page, 400);
    return `${s.learned} learned (${s.words} words, ${s.verbs} verbs) · home: "${t.slice(0, 60)}"`;
  } },
  { name: 'review', run: async () => {
    await ensureSeeded();
    await gotoRoute(page, '/review');
    if (/Niente da ripassare|Nothing to review/i.test(await viewText(page, 120))) throw new Error('review has nothing to review after seeding');
    const r = await playToResults({ maxSteps: 200 });
    await shot(page, 'e2e_review_results');
    if (!r.ok) throw new Error(`review did not finish: ${r.stuck}`);
    return `${await resultsSummary()} · ${r.actions.length} actions`;
  } },
  gameFlow('quiz', 'count=6'),
  gameFlow('conj-drill', 'tenses=presente&count=3'),
  gameFlow('aux', 'count=6'),
  gameFlow('gender', 'count=6'),
  gameFlow('flashcards', 'count=5'),
  gameFlow('cloze', 'count=5'),
  gameFlow('matching', 'count=6', { maxSteps: 160 }),
  gameFlow('hangman', 'count=3', { maxSteps: 160 }),
  gameFlow('crossword', 'count=14'),
  gameFlow('sentence', 'count=3'),
  gameFlow('speed', 'seconds=8', { maxSteps: 80, fast: true }),
  gameFlow('typing', 'count=3'),
  gameFlow('scramble', 'count=5'),
  gameFlow('plurals', 'count=5'),
  gameFlow('dictation', 'count=3'),
  gameFlow('reverse', 'count=3'),
  gameFlow('conj-choice', 'tenses=presente&count=3'),
  gameFlow('tense-detective', 'count=4'),
  gameFlow('participles', 'count=4'),
  gameFlow('patterns', 'count=8'),
  gameFlow('verb-quiz', 'tenses=presente&count=3'),
  { name: 'search', run: async () => {
    await gotoRoute(page, '/search');
    const q = (await has('#q')) ? page.locator('#q') : page.locator('input[type="search"]').first();
    await q.fill('casa'); await wait(500);
    const links = await page.locator('#view a[href*="entry/"]').count();
    const t = await viewText(page, 300);
    if (!links || !/casa/i.test(t)) throw new Error(`no results for "casa": ${t.slice(0, 100)}`);
    await shot(page, 'e2e_search');
    return `${links} result links, first: "${t.slice(0, 60)}"`;
  } },
  { name: 'add-word', run: async () => {
    await gotoRoute(page, '/add?it=la%20sedia');
    const en = (await has('[data-f="en"]')) ? page.locator('[data-f="en"]') : page.getByPlaceholder(/chair/i);
    await en.fill('chair');
    const save = (await has('[data-save]')) ? page.locator('[data-save]') : page.getByRole('button', { name: /save/i });
    await tap(save, { label: 'Save to my word bank' }); await settle(page);
    const hash = await page.evaluate(() => location.hash);
    const custom = await storeEval(`return Object.values(ctx.store.current.custom).map(c => ({ it: c.it, en: c.en, pos: c.pos }));`);
    const hit = custom.find(c => c.it === 'sedia' && c.en === 'chair');
    if (!hit) throw new Error(`custom word not stored: ${JSON.stringify(custom)}`);
    if (!/^#\/entry\/c(:|%3A)/i.test(hash)) throw new Error(`expected to land on the new entry, hash is ${hash}`);
    if (!/sedia/i.test(await viewText(page, 300))) throw new Error('entry view does not show "sedia"');
    await shot(page, 'e2e_custom_word');
    return `stored ${hit.pos} "${hit.it}" = "${hit.en}", opened ${hash}`;
  } },
  { name: 'lists', run: async () => {
    await gotoRoute(page, '/lists');
    const newBtn = page.getByRole('button', { name: /new list/i });
    await tap((await newBtn.count()) ? newBtn : page.locator('[data-new]'), { label: 'New list' }); await wait(400);
    const dlg = page.locator('[role="dialog"]').last();
    await dlg.locator('input').first().fill('E2E list');
    const ok = dlg.getByRole('button', { name: /^save$/i });
    await tap((await ok.count()) ? ok : dlg.locator('[data-act="ok"]'), { label: 'Save (new list)' }); await wait(500);
    const list = await storeEval(`return Object.values(ctx.store.lists).find(l => l.name === 'E2E list') || null;`);
    if (!list) throw new Error('list "E2E list" was not created');
    await gotoRoute(page, '/list/' + encodeURIComponent(list.id));
    const addBtn = page.getByRole('button', { name: /add words/i });
    await tap((await addBtn.count()) ? addBtn : page.locator('[data-add]'), { label: 'Add words' }); await wait(400);
    const sheet = page.locator('[role="dialog"]').last();
    await sheet.locator('input').first().fill('casa'); await wait(400);
    const pick = sheet.locator('[data-pick]');
    await tap((await pick.count()) ? pick : sheet.getByText(/^Add$/).first(), { label: 'Add (first search hit)' }); await wait(400);
    const items = await storeEval(`return (ctx.store.lists[arg]?.items || []).length;`, list.id);
    await page.keyboard.press('Escape'); await wait(400);
    if (items < 1) throw new Error('item was not added to the list');
    if (!new RegExp(`\\b${items} items?\\b`).test(await viewText(page, 300))) sink.push('warn', `list view does not show "${items} items" after adding`);
    await shot(page, 'e2e_list');
    return `list ${list.id} created with ${items} item(s)`;
  } },
  { name: 'theme', run: async () => {
    await gotoRoute(page, '/profile');
    const out = [];
    for (const t of ['light', 'dark', 'auto']) {
      const byName = page.getByRole('button', { name: new RegExp(`^${t}$`, 'i') });
      await tap((await byName.count()) ? byName : page.locator(`[data-seg="theme"][data-v="${t}"]`), { label: `theme ${t}` }); await wait(300);
      const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      const setting = await storeEval(`return ctx.store.settings.theme;`);
      const expect = t === 'auto' ? null : t;
      if (attr !== expect || setting !== t) throw new Error(`after "${t}": data-theme=${attr}, settings.theme=${setting}`);
      out.push(`${t}→${attr ?? 'none'}`);
      if (t === 'light') await shot(page, 'e2e_profile_light');
    }
    return out.join(', ');
  } },
  { name: 'export', run: async () => {
    await gotoRoute(page, '/profile');
    const dl = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
    const btn = (await has('[data-export]')) ? page.locator('[data-export]') : page.getByRole('button', { name: /export backup/i });
    await tap(btn, { label: 'Export backup' });
    const d = await dl;
    const toast = await page.locator('#toast').textContent().catch(() => '');
    if (!(await has('[data-file]'))) sink.push('warn', 'import file input [data-file] not found on profile');
    if (!d) throw new Error('no download event after tapping Export backup');
    // the file must be a backup the importer accepts: { app, exported, profile: { items, lists, … } }
    const file = await d.path(); let obj = null;
    try { obj = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { throw new Error(`downloaded backup is not JSON: ${err.message}`); }
    if (!obj || !obj.profile || typeof obj.profile.items !== 'object' || typeof obj.profile.lists !== 'object') throw new Error(`downloaded backup lacks profile.items / profile.lists: ${JSON.stringify(obj).slice(0, 120)}`);
    const learned = Object.values(obj.profile.items).filter(it => it.learned).length;
    return `download "${d.suggestedFilename()}" (${fs.statSync(file).size} bytes, ${learned} learned items, ${Object.keys(obj.profile.lists).length} lists)${toast ? `, toast "${toast.trim()}"` : ''}`;
  } },
  { name: 'persistence', run: async () => {
    await ensureSeeded();
    const before = await storeEval(`await ctx.store.saveNow(); return { learned: ctx.store.learnedIds().length, words: ctx.store.learnedIds().filter(id => !id.startsWith('v:')).length, verbs: ctx.store.learnedIds('v:').length, xp: ctx.store.current.stats.xp, lists: Object.keys(ctx.store.lists).length, custom: Object.keys(ctx.store.current.custom).length };`);
    if (before.learned < 1) throw new Error('nothing learned before reload (run the seed-learned flow)');
    await reloadApp(page);
    const after = await storeEval(`return { learned: ctx.store.learnedIds().length, words: ctx.store.learnedIds().filter(id => !id.startsWith('v:')).length, verbs: ctx.store.learnedIds('v:').length, xp: ctx.store.current.stats.xp, lists: Object.keys(ctx.store.lists).length, custom: Object.keys(ctx.store.current.custom).length };`);
    const diff = Object.keys(before).filter(k => before[k] !== after[k]);
    if (diff.length) throw new Error(`lost after reload: ${diff.map(k => `${k} ${before[k]}→${after[k]}`).join(', ')}`);
    await gotoRoute(page, '/lists');
    const t = await viewText(page, 600);
    if (!new RegExp(`\\b${after.words} words\\b`).test(t) || !new RegExp(`\\b${after.verbs} verbs\\b`).test(t)) throw new Error(`lists view does not show ${after.words} words / ${after.verbs} verbs: "${t.slice(0, 120)}"`);
    return `learned ${after.learned} (${after.words} words, ${after.verbs} verbs), ${after.xp} XP, ${after.lists} lists, ${after.custom} custom — all survived reload`;
  } },
  // SM-2 scheduling through the store: first correct answer → 8h, second → 3 days, a wrong one → back in 10 minutes.
  { name: 'srs', run: async () => {
    const r = await storeEval(`
      const id = 'w:casa|noun'; const now = Date.now(); const h = (t) => Math.round((t - now) / 36e5);
      delete ctx.store.current.items[id]; // start from a pristine item: the A1 game flows may already have played (and missed) it
      const a = { ...ctx.store.recordAnswer(id, true) }, b = { ...ctx.store.recordAnswer(id, true) }, c = { ...ctx.store.recordAnswer(id, false) };
      return { a: { reps: a.reps, iv: a.iv, dueH: h(a.due) }, b: { reps: b.reps, iv: b.iv, dueH: h(b.due) }, c: { reps: c.reps, iv: c.iv, lapses: c.lapses, dueMin: Math.round((c.due - now) / 6e4) }, seen: ctx.store.getItem(id).seen, ok: ctx.store.getItem(id).ok };`);
    if (r.a.reps !== 1 || r.a.dueH !== 8) throw new Error(`first correct answer should be due in 8h with reps 1: ${JSON.stringify(r.a)}`);
    if (r.b.reps !== 2 || r.b.iv !== 3 || r.b.dueH !== 72) throw new Error(`second correct answer should be due in 3 days: ${JSON.stringify(r.b)}`);
    if (r.c.reps !== 0 || r.c.lapses !== 1 || r.c.dueMin !== 10) throw new Error(`a wrong answer should reset reps and come back in 10 minutes: ${JSON.stringify(r.c)}`);
    if (r.seen !== 3 || r.ok !== 2) throw new Error(`answer counters wrong: seen ${r.seen}, ok ${r.ok}`);
    return `correct → 8h, correct → 3d (iv 3), wrong → 10 min (lapses 1); seen 3, ok 2`;
  } },
  { name: 'en-toggle', run: async () => {
    await gotoRoute(page, '/entry/w:casa|noun');
    const before = await storeEval(`return ctx.store.settings.showEn;`);
    await tap('#enToggle', { label: 'EN toggle' }); await wait(300);
    const on = await page.evaluate(() => document.body.classList.contains('show-en'));
    const setting = await storeEval(`return ctx.store.settings.showEn;`);
    if (!on || setting !== 'always') throw new Error(`after tapping EN: body.show-en=${on}, settings.showEn=${setting}`);
    await tap('#enToggle', { label: 'EN toggle (off)' }); await wait(300);
    const off = await page.evaluate(() => document.body.classList.contains('show-en'));
    const back = await storeEval(`return ctx.store.settings.showEn;`);
    if (off || back !== 'tap') throw new Error(`EN toggle did not switch back: body.show-en=${off}, settings.showEn=${back}`);
    return `showEn ${before} → always → tap, body.show-en followed`;
  } },
  { name: 'grammar-topics', run: async () => {
    const ids = await page.evaluate(() => import('./js/views/grammar.js').then(m => m.loadGrammar()).then(ts => ts.map(t => t.id)));
    if (ids.length < 12) throw new Error(`expected 12 grammar topics, got ${ids.length}`);
    const bad = [];
    for (const id of ids) {
      await gotoRoute(page, '/grammar/' + id);
      const t = await viewText(page, 200);
      if (!t || /Qualcosa è andato storto|not found/i.test(t)) { bad.push(`${id}: ${t.slice(0, 60) || 'empty #view'}`); continue; }
      if (!(await has('#view a[href*="#/game/"]'))) bad.push(`${id}: no practice link`);
    }
    if (bad.length) throw new Error(bad.join(' · '));
    return `${ids.length} topics render with a practice link`;
  } },
  { name: 'custom-verb', run: async () => {
    await gotoRoute(page, '/add?it=dormire');
    const pos = await page.locator('[data-f="pos"]').inputValue();
    if (pos !== 'verb') throw new Error(`"dormire" was not recognised as a verb (pos=${pos})`);
    await page.locator('[data-f="en"]').fill('to sleep');
    await tap('[data-seg="isc"] [data-v="false"]', { label: 'isc: no' });
    await tap('[data-save]', { label: 'Save (custom verb)' }); await settle(page);
    const v = await storeEval(`return Object.values(ctx.store.current.custom).find(c => c.inf === 'dormire') || null;`);
    if (!v || v.pos !== 'verb' || v.isc !== false || v.aux !== 'avere') throw new Error(`custom verb not stored as expected: ${JSON.stringify(v)}`);
    const t = await viewText(page, 3000);
    if (!/dormire/i.test(t) || !(await has('#view [data-kind="verb"]'))) throw new Error(`entry view does not show the verb: ${t.slice(0, 120)}`);
    if (!/\bdormo\b/.test(t)) throw new Error(`entry view shows no conjugation ("dormo") for the custom verb: ${t.slice(0, 160)}`);
    return `custom verb ${v.id} (aux ${v.aux}, isc ${v.isc}) opened with its conjugation`;
  } },
  { name: 'list-delete', run: async () => {
    const id = await storeEval(`return ctx.store.createList('E2E delete me');`);
    await gotoRoute(page, '/lists');
    await tap(`[data-menu="${id}"]`, { label: 'List options' }); await wait(400);
    await tap('.dropdown-layer .dropdown.open [data-value="delete"]', { js: true }); await wait(400);
    const dlg = page.locator('[role="dialog"]').last();
    await tap(dlg.locator('[data-act="ok"]'), { label: 'Delete (confirm)' }); await wait(500);
    if (!(await storeEval(`return !ctx.store.lists[arg];`, id))) throw new Error('list still exists after Delete');
    if (/E2E delete me/.test(await viewText(page, 800))) throw new Error('lists view still shows the deleted list');
    return `list ${id} deleted through its menu`;
  } },
  { name: 'import-backup', run: async () => {
    await ensureSeeded();
    const before = await storeEval(`await ctx.store.saveNow(); return { json: ctx.store.exportJSON(), learned: ctx.store.learnedIds().length, xp: ctx.store.current.stats.xp, lists: Object.keys(ctx.store.lists).length };`);
    await storeEval(`await ctx.store.resetProgress();`);
    if ((await storeEval(`return ctx.store.learnedIds().length;`)) !== 0) throw new Error('resetProgress left learned items behind');
    await gotoRoute(page, '/profile');
    await page.locator('[data-file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(before.json) });
    const dlg = page.locator('[role="dialog"]').last();
    await dlg.waitFor({ timeout: 3000 });
    await tap(dlg.locator('[data-choice="replace"]'), { label: 'Replace (import)' }); await wait(600); // the sheet offers Cancel / Replace / Merge; dismissing it imports nothing
    const after = await storeEval(`return { learned: ctx.store.learnedIds().length, xp: ctx.store.current.stats.xp, lists: Object.keys(ctx.store.lists).length };`);
    const want = { learned: before.learned, xp: before.xp, lists: before.lists };
    if (JSON.stringify(after) !== JSON.stringify(want)) throw new Error(`import did not restore the backup: expected ${JSON.stringify(want)}, got ${JSON.stringify(after)}`);
    const toast = await page.locator('#toast').textContent().catch(() => '');
    return `reset → import (replace) restored ${after.learned} learned, ${after.xp} XP, ${after.lists} lists${toast.trim() ? `, toast "${toast.trim()}"` : ''}`;
  } },
  { name: 'users', run: async () => {
    await gotoRoute(page, '/profile');
    const first = await storeEval(`return { id: ctx.store.current.id, learned: ctx.store.learnedIds().length };`);
    await tap('[data-new-user]', { label: 'New user' }); await wait(400);
    const dlg = page.locator('[role="dialog"]').last();
    await dlg.locator('input').first().fill('Marco');
    await tap(dlg.locator('[data-act="ok"]'), { label: 'Save (new user)' }); await wait(600);
    const cur = await storeEval(`return { id: ctx.store.current.id, name: ctx.store.current.name, learned: ctx.store.learnedIds().length, n: ctx.store.profiles.length };`);
    if (cur.name !== 'Marco' || cur.id === first.id || cur.learned !== 0 || cur.n < 2) throw new Error(`new user is not active and empty: ${JSON.stringify(cur)}`);
    await tap(`[data-user="${first.id}"]`, { label: 'switch back to the first user' }); await wait(600);
    const back = await storeEval(`return { id: ctx.store.current.id, learned: ctx.store.learnedIds().length };`);
    if (back.id !== first.id || back.learned !== first.learned) throw new Error(`switching back lost progress: ${JSON.stringify({ first, back })}`);
    await storeEval(`await ctx.store.deleteProfile(arg);`, cur.id);
    return `created "Marco" (empty), switched back to the first user with ${back.learned} learned items, deleted Marco`;
  } },
];

async function runFlow(f) {
  sink.current = 'flow:' + f.name;
  const n = sink.errors.length; const w = sink.warnings.length; const t0 = Date.now();
  const rec = { name: f.name, ok: true, ms: 0, detail: '', errors: [], warnings: [] };
  try { rec.detail = await f.run(); } catch (err) { rec.errors.push(err.message.split('\n')[0]); rec.shot = await shot(page, 'e2e_fail_' + f.name); }
  rec.errors.push(...errorsSince(n)); rec.warnings.push(...sink.warnings.slice(w).map(x => x.text));
  rec.ok = rec.errors.length === 0; rec.ms = Date.now() - t0;
  report.flows.push(rec);
  log(`  ${rec.ok ? '✓' : '✗'} ${pad(f.name, 16)} ${pad(ms(rec.ms), 7)} ${rec.ok ? rec.detail : rec.errors[0]}`);
}

// ---------- main ----------
let exitCode = 0;
try {
  log(`Parola e2e · ${BASE} · ${report.device} · playwright from ${from}${filters.length ? ` · filters: ${filters.join(', ')}` : ''}`);
  sink.current = 'boot';
  await boot(page);
  const routes = (await allRoutes(page)).filter(r => matches('route:' + r, filters) || matches(r, filters));
  log(`\nRoutes (${routes.length})`);
  for (const r of routes) await visitRoute(r);
  const selected = flows.filter(f => matches('flow:' + f.name, filters) || matches(f.name, filters));
  log(`\nFlows (${selected.length})`);
  for (const f of selected) await runFlow(f);
} catch (err) {
  log('\nFATAL', err); exitCode = 2;
  report.fatal = String(err && err.stack || err);
} finally {
  await browser.close().catch(() => {});
  stopServer();
}

report.consoleErrors = sink.errors; report.warnings = sink.warnings;
const failedRoutes = report.routes.filter(r => !r.ok), failedFlows = report.flows.filter(f => !f.ok);
report.summary = {
  routes: { total: report.routes.length, ok: report.routes.length - failedRoutes.length, failed: failedRoutes.length },
  flows: { total: report.flows.length, ok: report.flows.length - failedFlows.length, failed: failedFlows.length },
  consoleErrors: sink.errors.length, warnings: sink.warnings.length + report.routes.reduce((a, r) => a + r.warnings.length, 0),
  failures: failedRoutes.length + failedFlows.length + (report.fatal ? 1 : 0),
};
const file = writeReport('e2e', report);

log(`\nConsole / page / network errors: ${sink.errors.length}`);
const seen = new Map();
for (const e of sink.errors) { const k = e.text.split('\n')[0].slice(0, 160); const v = seen.get(k) || { n: 0, at: new Set() }; v.n++; v.at.add(e.at); seen.set(k, v); }
[...seen.entries()].slice(0, 30).forEach(([k, v]) => log(`  - ${v.n}× ${k}  [${[...v.at].slice(0, 4).join(', ')}${v.at.size > 4 ? ', …' : ''}]`));
const warns = [...new Set([...sink.warnings.map(w => `[${w.at}] ${w.text}`), ...report.routes.flatMap(r => r.warnings.map(w => `[route:${r.route}] ${w}`))])];
if (warns.length) { log(`\nWarnings: ${warns.length}`); warns.slice(0, 20).forEach(w => log('  - ' + w)); }
const s = report.summary;
log(`\nSummary: routes ${s.routes.ok}/${s.routes.total} ok · flows ${s.flows.ok}/${s.flows.total} ok · ${s.consoleErrors} console errors · ${s.warnings} warnings → ${s.failures ? `${s.failures} FAILURES` : 'PASS'}`);
log(`Report: ${file}`);
process.exit(exitCode || (s.failures ? 1 : 0));
