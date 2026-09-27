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
// #view #topbar #tabs a[data-tab] #enToggle #backBtn #q [data-next] [data-answer] [data-check] button.choice
// [data-flash] [data-grade] [data-q] .cw .k .m [data-export] [data-file] — everything else goes through roles and text.
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
async function tap(target, { timeout = 1500, label = '' } = {}) {
  const loc = (typeof target === 'string' ? page.locator(target) : target).first();
  try { await loc.click({ timeout }); return 'click'; } catch (err) {
    try { await loc.evaluate(el => el.click()); sink.push('warn', `used a DOM click for ${label || target} (real click failed: ${String(err.message).split('\n')[0].slice(0, 120)})`); return 'js'; } catch { throw err; }
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
  const m = t.match(/(\d+)%[\s\S]*?(\d+)\s+of\s+(\d+)\s+correct/i);
  return m ? `${m[1]}% (${m[2]} of ${m[3]} correct)` : (t.replace(/\s+/g, ' ').slice(0, 80));
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
async function playToResults({ maxSteps = 120, idleLimit = 20 } = {}) {
  const LETTERS = 'eaiontrlscudpmgvhbfzqkxjwy'.split('');
  const tried = new Set(); let hints = 0; let idle = 0; const actions = [];
  const act = (a) => { actions.push(a); idle = 0; };
  for (let step = 0; step < maxSteps; step++) {
    if (await isResults()) return { ok: true, steps: step, actions };
    if (await has('[data-next]')) { await tap('[data-next]', { label: '[data-next]' }); tried.clear(); act('next'); await wait(250); continue; }
    if (await has('[data-results]')) { await tap('[data-results]', { label: '[data-results]' }); act('results'); await wait(300); continue; }
    // multiple choice (drills, speed round)
    const choices = page.locator('button.choice:not([disabled])');
    const nChoices = await choices.count();
    if (nChoices) { await tap(choices.nth(Math.floor(Math.random() * nChoices)), { label: 'button.choice' }); act('choice'); await wait(300); continue; }
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

const flows = [
  { name: 'verb-intro', run: async () => {
    await gotoRoute(page, '/learn/verb/v:mangiare');
    await tap('[data-next]', { label: 'See the forms' }); await settle(page, { min: 200 });
    const forms = await has('[data-conj-table]') || /io|tu|lui/.test(await viewText(page, 400));
    await shot(page, 'e2e_verb_forms');
    await tap('[data-next]', { label: 'Start the drill' }); await settle(page, { min: 200 });
    const r = await playToResults();
    await shot(page, 'e2e_verb_results');
    if (!r.ok) throw new Error(`drill did not finish: ${r.stuck}`);
    return `${await resultsSummary()}${forms ? '' : ' (forms step not detected)'}`;
  } },
  { name: 'word-intro', run: async () => {
    await gotoRoute(page, '/learn/word/w:casa|noun');
    if (!/casa/i.test(await viewText(page, 300))) throw new Error('meet card does not show "casa"');
    await tap('[data-next]', { label: 'Quick check' }); await settle(page, { min: 200 });
    const r = await playToResults();
    if (!r.ok) throw new Error(`check did not finish: ${r.stuck}`);
    return await resultsSummary();
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
    await gotoRoute(page, '/review');
    if (/Nothing to review/i.test(await viewText(page, 120))) throw new Error('review has nothing to review after seeding');
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
  gameFlow('speed', 'seconds=4', { maxSteps: 80 }),
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
    return `clicked${d ? `, download event "${d.suggestedFilename()}"` : ' (no download event observed)'}${toast ? `, toast "${toast.trim()}"` : ''}`;
  } },
  { name: 'persistence', run: async () => {
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
