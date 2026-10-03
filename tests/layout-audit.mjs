#!/usr/bin/env node
// Layout audit: every route × three phone viewports × both themes. Reports horizontal overflow, elements wider than the
// viewport, small tap targets, overlapping interactive elements, crossword grid centring, inputs that trigger iOS zoom
// (font-size < 16px) and clipped headings.
//
//   node tests/layout-audit.mjs                     everything (3 viewports run in parallel)
//   node tests/layout-audit.mjs game/ profile       only routes containing a filter (filters also match "375x667" / "light")
//   SHOTS=1 node tests/layout-audit.mjs             screenshots into tests/shots/layout_<viewport>_<theme>_<route>.png
//   SOFT=taps,inputs node tests/layout-audit.mjs    downgrade categories to warnings (overflow,wide,taps,overlaps,crossword,inputs,headings,console)
//
// Exit code 1 when anything failed. JSON report: tests/report-layout.json. See tests/README.md.
import {
  loadPlaywright, launchBrowser, contextOptions, ensureServer, BASE, allRoutes, cliFilters, matches, routeSlug,
  makeSink, attachCollectors, boot, gotoRoute, settle, viewText, seedProgress, shot, writeReport, wait, pad,
} from './lib.mjs';
import assert from 'node:assert/strict';

const filters = cliFilters();
const SOFT = new Set((process.env.SOFT || '').split(',').map(s => s.trim()).filter(Boolean));
const MIN_TAP = Number(process.env.MIN_TAP || 40);
const CENTRE_TOL = Number(process.env.CENTRE_TOL || 6);
const MAX_LIST = 12;
const THEMES = ['dark', 'light'];
const CATEGORIES = ['overflow', 'wide', 'taps', 'overlaps', 'crossword', 'inputs', 'headings', 'console'];

const { chromium, devices, from } = await loadPlaywright();
const VIEWPORTS = [
  { name: 'iphone13', options: { ...devices['iPhone 13'] } },
  { name: '375x667', options: { ...devices['iPhone 13'], viewport: { width: 375, height: 667 } } },
  { name: '430x932', options: { ...devices['iPhone 13'], viewport: { width: 430, height: 932 } } },
];

// ---------- in-page audit (self-contained: it is serialised into the browser) ----------
const AUDIT = ({ mode, phase, isCrossword, minTap, maxList }) => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
  const styleMemo = new Map();
  const style = (el) => { let s = styleMemo.get(el); if (!s) { s = getComputedStyle(el); styleMemo.set(el, s); } return s; };
  const desc = (el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).map(c => '.' + c).join('');
    const data = [...el.attributes].filter(a => a.name.startsWith('data-')).slice(0, 2).map(a => `[${a.name}${a.value ? '=' + a.value.slice(0, 16) : ''}]`).join('');
    const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    return `${tag}${id}${cls}${data}${text ? ` "${text}"` : ''}`;
  };
  const skip = (el) => !!el.closest('#toast, .aurora, .xp-float, [aria-hidden="true"], [inert]');
  const visMemo = new Map();
  const visible = (el) => {
    if (!el || el === document.documentElement) return true;
    if (visMemo.has(el)) return visMemo.get(el);
    // Chromium can return layout boxes for the unpainted contents of a closed
    // <details>. Only its direct summary is interactive until it is opened.
    const closed = el.closest('details:not([open])');
    if (closed && el !== closed && !closed.querySelector(':scope > summary')?.contains(el)) { visMemo.set(el, false); return false; }
    const cs = style(el);
    const v = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) !== 0 && visible(el.parentElement);
    visMemo.set(el, v); return v;
  };
  const shown = (el) => { if (!visible(el)) return false; const r = el.getBoundingClientRect(); return r.width >= 1 && r.height >= 1; };
  const clippedByAncestor = (el) => { let p = el.parentElement; while (p && p !== document.body) { if (/(auto|scroll|hidden|clip)/.test(style(p).overflowX)) return true; p = p.parentElement; } return false; };
  const isChrome = (el) => { let e = el; while (e && e !== document.body) { const p = style(e).position; if (p === 'fixed' || p === 'sticky') return true; e = e.parentElement; } return false; };
  // A scroll child's layout rectangle continues outside its painted region.
  // Compare only the portion actually exposed by its clipping ancestors.
  const paintedRects = el => [...el.getClientRects()].map(rect => {
    let {left, right, top, bottom} = rect;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = style(p), bounds = p.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    }
    return {left:Math.max(0,left), right:Math.min(vw,right), top:Math.max(0,top), bottom:Math.min(vh,bottom)};
  }).filter(r => r.right-r.left >= 1 && r.bottom-r.top >= 1);
  const receivesCenter = el => { const r=el.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return hit===el || el.contains(hit); };
  const cardControlLayer = (a,b) => {
    const control = a.closest('.flash-card-tools') ? a : b.closest('.flash-card-tools') ? b : null;
    const flip = a.matches('.flash-flip') ? a : b.matches('.flash-flip') ? b : null;
    // These are deliberately on-card controls above a full-card flip surface.
    // Exempt only a same-card pair when both actual tap centres are reachable.
    return control && flip && control.closest('.flash')===flip.closest('.flash') && receivesCenter(control) && receivesCenter(flip);
  };
  const out = { vw, vh, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, counts: {}, overflow: null, wide: [], taps: [], overlaps: [], crossword: null, inputs: [], headings: [] };
  const push = (cat, item) => { out.counts[cat] = (out.counts[cat] || 0) + 1; if (out[cat].length < maxList) out[cat].push(item); };

  // overlapping interactive elements (inline elements are compared fragment by fragment so wrapped spans do not collide)
  const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
  const items = [...document.querySelectorAll(INTERACTIVE)]
    .filter(el => !skip(el) && !el.closest('.fan, .deck, .reel, .stack') && shown(el) && style(el).pointerEvents !== 'none')
    .slice(0, 700)
    .map(el => ({ el, rects: paintedRects(el), chrome: isChrome(el) }));
  const bottomChrome = (it) => { const r = it.el.getBoundingClientRect(); return (r.top + r.bottom) / 2 > vh / 2; };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      if (cardControlLayer(A.el,B.el)) continue;
      if (A.chrome !== B.chrome) { // fixed/sticky chrome vs content: only where the content cannot scroll out from under it
        const bc = bottomChrome(A.chrome ? A : B);
        if (phase === 'top' && bc) continue;
        if (phase === 'bottom' && !bc) continue;
      }
      let hit = null;
      for (const ra of A.rects) { for (const rb of B.rects) {
        const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ix > 4 && iy > 4) { hit = { ix: round(ix), iy: round(iy) }; break; }
      } if (hit) break; }
      if (hit) push('overlaps', { a: desc(A.el), b: desc(B.el), ...hit, phase, chrome: A.chrome || B.chrome });
    }
  }
  if (mode !== 'full') return out;

  out.overflow = out.scrollWidth > vw ? { scrollWidth: out.scrollWidth, vw } : null;
  if (out.overflow) out.counts.overflow = 1;

  // elements wider than the viewport (top-most offender only; children of scroll/clip containers are skipped)
  const flagged = new Set();
  for (const el of document.querySelectorAll('#view, #view *, #topbar, #topbar *, #tabs, #tabs *, .sheet, .sheet *')) {
    if (skip(el) || !shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (clippedByAncestor(el)) continue;
    if (flagged.has(el.parentElement)) { flagged.add(el); continue; }
    flagged.add(el);
    push('wide', { el: desc(el), left: round(r.left), right: round(r.right), width: round(r.width) });
  }

  // tap targets
  for (const el of document.querySelectorAll('button, a.btn, .choice, .chip, .k, .m, #tabs a')) {
    if (skip(el) || !shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < minTap) push('taps', { el: desc(el), h: round(r.height, 1), w: round(r.width, 1) });
  }

  // crossword grid centring
  if (isCrossword) {
    const g = document.querySelector('.cw');
    if (!g) out.crossword = { found: false };
    else { const r = g.getBoundingClientRect(); const centre = r.left + r.width / 2; out.crossword = { found: true, centre: round(centre, 1), delta: round(Math.abs(centre - vw / 2), 1), width: round(r.width), left: round(r.left, 1) }; }
  }

  // inputs that make iOS Safari zoom on focus
  for (const el of document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea')) {
    if (skip(el) || !shown(el)) continue;
    const fs = parseFloat(style(el).fontSize);
    if (fs < 16) push('inputs', { el: desc(el), fontSize: fs });
  }

  // clipped headings
  for (const el of document.querySelectorAll('h1, h2, h3')) {
    if (skip(el) || !shown(el) || !el.clientWidth) continue;
    if (el.scrollWidth > el.clientWidth + 1) push('headings', { el: desc(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
  }
  return out;
};

async function auditRoute(page, route) {
  const isCrossword = /\/game\/crossword/.test(route);
  await page.waitForFunction(() => !/scene-(in|out)/.test(document.querySelector('#view')?.className || ''), null, { timeout: 2500 }).catch(() => {});
  await wait(350); // let pop-in / stamp animations finish before measuring
  await page.evaluate(() => window.scrollTo(0, 0));
  const top = await page.evaluate(AUDIT, { mode: 'full', phase: 'top', isCrossword, minTap: MIN_TAP, maxList: MAX_LIST });
  const positions = await page.evaluate(() => {
    const nodes=[...document.querySelectorAll('#view, #view *, .sheet, .sheet *')].filter(e=>!e.closest('[inert]')&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1);
    const positions=nodes.map(e=>({element:e,top:e.scrollTop}));
    // Retain references in the test page only, never in application state.
    window.__layoutScrollPositions=positions;
    nodes.forEach(e=>e.scrollTop=e.scrollHeight);
    window.scrollTo(0, document.documentElement.scrollHeight);
    return positions.length;
  });
  await wait(250);
  const bottom = await page.evaluate(AUDIT, { mode: 'overlaps', phase: 'bottom', isCrossword, minTap: MIN_TAP, maxList: MAX_LIST });
  await page.evaluate(() => { for(const {element,top} of window.__layoutScrollPositions||[])element.scrollTop=top; delete window.__layoutScrollPositions; window.scrollTo(0, 0); });
  top.internalScrollersChecked=positions;
  const seen = new Set(top.overlaps.map(o => o.a + '|' + o.b));
  for (const o of bottom.overlaps) { const k = o.a + '|' + o.b; if (!seen.has(k)) { seen.add(k); top.overlaps.push(o); } }
  if (seen.size) top.counts.overlaps = seen.size; else delete top.counts.overlaps;
  if (top.crossword && (!top.crossword.found || top.crossword.delta > CENTRE_TOL)) top.counts.crossword = 1;
  return top;
}

// ---------- per viewport run (viewports run in parallel contexts) ----------
const results = []; const sinks = {};
async function runViewport(browser, routesFor, vp) {
  const ctx = await browser.newContext(contextOptions(vp.options, { reducedMotion: 'reduce' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const sink = makeSink(); sinks[vp.name] = sink; attachCollectors(page, sink);
  let seeded = null;
  try {
    sink.current = `${vp.name}:boot`;
    await boot(page);
    if (process.env.SEED !== '0') seeded = await seedProgress(page, { words: 20, verbs: 10 });
    const routes = await routesFor(page);
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      const list = routes.filter(r => matches(`${vp.name}/${theme}:${r}`, filters));
      for (const route of list) {
        const tag = `${vp.name}/${theme}:${route}`; sink.current = tag;
        const n = sink.errors.length; const t0 = Date.now();
        const rec = { viewport: vp.name, theme, route, ms: 0, findings: null, consoleErrors: [], failures: 0, warnings: 0, categories: [] };
        try {
          await gotoRoute(page, route);
          const themeNow = await page.evaluate(() => document.documentElement.dataset.theme);
          if (themeNow !== theme) { await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await wait(150); }
          rec.findings = await auditRoute(page, route);
          if (route === '/course') {
            await page.locator('details').evaluateAll(details => details.forEach(element => { element.open = true; }));
            const expanded = await auditRoute(page, route);
            rec.expandedMilestones = expanded;
            for (const [category, count] of Object.entries(expanded.counts || {})) {
              rec.findings.counts[category] = (rec.findings.counts[category] || 0) + count;
              if (Array.isArray(expanded[category])) rec.findings[category] = [...(rec.findings[category] || []), ...expanded[category]].slice(0, MAX_LIST);
            }
          }
          rec.text = await viewText(page, 90);
          rec.shot = await shot(page, `layout_${vp.name}_${theme}_${routeSlug(route)}`);
        } catch (err) { rec.error = err.message.split('\n')[0]; }
        rec.consoleErrors = sink.errors.slice(n).map(e => e.text);
        if (rec.consoleErrors.length) rec.findings ??= { counts: {} }, rec.findings.counts.console = rec.consoleErrors.length;
        if (rec.error) rec.findings ??= { counts: {} }, rec.findings.counts.exception = 1;
        for (const [cat, c] of Object.entries(rec.findings?.counts || {})) { if (!c) continue; rec.categories.push(cat); if (SOFT.has(cat)) rec.warnings += c; else rec.failures += c; }
        rec.ms = Date.now() - t0;
        results.push(rec);
      }
      console.log(`  ${vp.name} ${vp.options.viewport.width}×${vp.options.viewport.height} ${theme}: ${list.length} routes audited`);
    }
  } finally { await ctx.close().catch(() => {}); }
  return seeded;
}

// ---------- main ----------
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const report = { suite: 'layout', generatedAt: new Date().toISOString(), base: BASE, playwright: from, viewports: VIEWPORTS.map(v => ({ name: v.name, ...v.options.viewport })), themes: THEMES, filters, soft: [...SOFT], minTap: MIN_TAP, centreTolerance: CENTRE_TOL, results: [], summary: {}, consoleErrors: [] };
let exitCode = 0;
console.log(`Parola layout audit · ${BASE} · ${VIEWPORTS.map(v => `${v.name} ${v.options.viewport.width}×${v.options.viewport.height}`).join(', ')} · themes ${THEMES.join('/')} · playwright from ${from}${filters.length ? ` · filters: ${filters.join(', ')}` : ''}`);
try {
  // Prove the geometric exceptions do not hide a real overlap. These fixtures
  // run in an isolated page and contain no application or profile state.
  const geometryPage = await browser.newPage({viewport:{width:390,height:664}});
  const measure = () => geometryPage.evaluate(AUDIT,{mode:'overlaps',phase:'top',isCrossword:false,minTap:MIN_TAP,maxList:MAX_LIST});
  await geometryPage.setContent('<button style="position:absolute;left:10px;top:10px;width:100px;height:50px">One</button><button style="position:absolute;left:50px;top:20px;width:100px;height:50px">Two</button>');
  assert.equal((await measure()).counts.overlaps,1,'ordinary overlapping targets must fail');
  await geometryPage.setContent('<div inert><button style="position:absolute;left:10px;top:10px;width:100px;height:50px">Behind modal</button></div><button style="position:absolute;left:50px;top:20px;width:100px;height:50px">Modal control</button>');
  assert.equal((await measure()).counts.overlaps||0,0,'inert background controls cannot compete with a modal');
  await geometryPage.setContent('<div style="position:absolute;left:10px;top:10px;width:100px;height:50px;overflow:auto"><button style="margin-top:70px;width:90px;height:50px">Clipped</button></div><button style="position:absolute;left:10px;top:80px;width:100px;height:50px">Visible</button>');
  assert.equal((await measure()).counts.overlaps||0,0,'a clipped scroll child is not painted over its neighbour');
  await geometryPage.setContent('<section class="flash" style="position:relative;width:300px;height:200px"><button class="flash-flip" style="position:absolute;inset:0;width:100%;height:100%">Flip</button><div class="flash-card-tools" style="position:absolute;z-index:2;top:8px;left:8px"><button style="width:80px;height:40px">Hear</button></div></section>');
  assert.equal((await measure()).counts.overlaps||0,0,'on-card controls and the exposed flip surface remain independently reachable');
  await geometryPage.addStyleTag({content:'.flash-flip{z-index:3}'});
  assert.equal((await measure()).counts.overlaps,1,'a flip surface covering its tool must still fail');
  await geometryPage.close();
  report.geometryChecks=5;
  let routesPromise = null;
  const routesFor = (page) => (routesPromise ||= allRoutes(page).then(routes=>[...routes,'/conversations','/profile?settings=1']));
  await Promise.all(VIEWPORTS.map(vp => runViewport(browser, routesFor, vp)));
} catch (err) { console.log('\nFATAL', err); report.fatal = String(err && err.stack || err); exitCode = 2; }
finally { await browser.close().catch(() => {}); stopServer(); }

// ---------- report ----------
results.sort((a, b) => VIEWPORTS.findIndex(v => v.name === a.viewport) - VIEWPORTS.findIndex(v => v.name === b.viewport) || THEMES.indexOf(a.theme) - THEMES.indexOf(b.theme));
report.results = results;
report.consoleErrors = Object.values(sinks).flatMap(s => s.errors);
// One line per route, findings aggregated over the viewport×theme combos (the JSON keeps every combo separately).
const LABEL = { exception: 'EXCEPTION', overflow: 'overflow', wide: 'wide', taps: `taps<${MIN_TAP}`, overlaps: 'overlaps', crossword: 'crossword', inputs: 'inputs<16px', headings: 'clipped-h', console: 'console' };
const combos = [...new Set(results.map(r => `${r.viewport}/${r.theme}`))];
const routeOrder = [...new Set(results.map(r => r.route))];
console.log(`\nRoutes (${routeOrder.length}) — findings aggregated over ${combos.length} viewport×theme combos; "(2/6: …)" = only in some combos`);
for (const route of routeOrder) {
  const rows = results.filter(r => r.route === route);
  const parts = [];
  for (const cat of ['exception', 'overflow', 'wide', 'taps', 'overlaps', 'crossword', 'inputs', 'headings', 'console']) {
    const hits = rows.filter(r => r.findings?.counts?.[cat]);
    if (!hits.length) continue;
    let txt;
    if (cat === 'crossword') { const ds = hits.map(r => r.findings.crossword?.found ? r.findings.crossword.delta : null); txt = ds.includes(null) ? 'crossword grid MISSING' : `crossword OFF-CENTRE Δ${Math.min(...ds)}–${Math.max(...ds)}px`; }
    else if (cat === 'overflow') { const ws = hits.map(r => r.findings.overflow.scrollWidth); txt = `overflow ${Math.min(...ws)}–${Math.max(...ws)}>vw`; }
    else if (cat === 'exception') txt = `EXCEPTION ${hits[0].error}`;
    else { const ns = hits.map(r => r.findings.counts[cat]); const lo = Math.min(...ns), hi = Math.max(...ns); txt = `${LABEL[cat]} ${lo === hi ? lo : `${lo}–${hi}`}`; }
    if (hits.length < rows.length) txt += ` (${hits.length}/${rows.length}: ${hits.map(r => `${r.viewport}/${r.theme}`).slice(0, 3).join(', ')}${hits.length > 3 ? ', …' : ''})`;
    parts.push(txt);
  }
  const fail = rows.some(r => r.failures), warn = rows.some(r => r.warnings);
  console.log(`  ${fail ? '✗' : warn ? '!' : '✓'} ${pad(route, 44)} ${parts.join(' · ') || 'clean'}`);
}

// details: worst offenders per category, deduplicated by element description
const distinct = {};
const detail = (cat, mapFn, n = 12) => {
  const seen = new Map();
  for (const r of results) for (const it of (r.findings?.[cat] || [])) { const k = mapFn(it); const v = seen.get(k) || { n: 0, where: new Set() }; v.n++; v.where.add(`${r.viewport}/${r.theme} ${r.route}`); seen.set(k, v); }
  distinct[cat] = seen.size;
  const rows = [...seen.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, n);
  if (!rows.length) return;
  console.log(`\n${LABEL[cat]} — ${seen.size} distinct element${seen.size === 1 ? '' : 's'}, ${[...seen.values()].reduce((a, v) => a + v.n, 0)} occurrences over all combos (top ${rows.length}; lists are capped at ${MAX_LIST} per route)`);
  for (const [k, v] of rows) console.log(`  ${pad(v.n + '×', 5)} ${k}\n        e.g. ${[...v.where].slice(0, 2).join(' | ')}`);
};
detail('wide', it => `${it.el}  (${it.left}→${it.right}, ${it.width}px)`);
detail('taps', it => `${it.el}  (${it.h}px tall)`);
detail('overlaps', it => `${it.a}  ×  ${it.b}  (${it.ix}×${it.iy}px${it.chrome ? ', chrome' : ''})`);
detail('inputs', it => `${it.el}  (${it.fontSize}px)`);
detail('headings', it => `${it.el}  (${it.scrollWidth}>${it.clientWidth})`);
const cw = results.filter(r => r.findings?.crossword);
if (cw.length) { console.log('\ncrossword grid centring'); for (const r of cw) console.log(`  ${r.findings.crossword.found ? (r.findings.crossword.delta > CENTRE_TOL ? '✗' : '✓') : '✗'} ${r.viewport}/${r.theme}: ${r.findings.crossword.found ? `centre ${r.findings.crossword.centre} vs ${r.findings.vw / 2} (Δ${r.findings.crossword.delta}px, width ${r.findings.crossword.width})` : 'grid not found'}`); }
if (report.consoleErrors.length) {
  console.log(`\nConsole / page / network errors: ${report.consoleErrors.length}`);
  const seen = new Map();
  for (const e of report.consoleErrors) { const k = e.text.split('\n')[0].slice(0, 160); const v = seen.get(k) || { n: 0, at: new Set() }; v.n++; v.at.add(e.at); seen.set(k, v); }
  [...seen.entries()].slice(0, 20).forEach(([k, v]) => console.log(`  - ${v.n}× ${k}  [${[...v.at].slice(0, 3).join(', ')}${v.at.size > 3 ? ', …' : ''}]`));
}

const byCategory = {};
for (const r of results) for (const [cat, c] of Object.entries(r.findings?.counts || {})) byCategory[cat] = (byCategory[cat] || 0) + c;
const failing = results.filter(r => r.failures);
const routeTotals = {};
for (const r of failing) routeTotals[r.route] = (routeTotals[r.route] || 0) + r.failures;
const cleanRoutes = routeOrder.filter(route => results.filter(r => r.route === route).every(r => !r.failures && !r.warnings));
report.summary = {
  routes: routeOrder.length, cleanRoutes: cleanRoutes.length,
  combos: results.length, clean: results.filter(r => !r.failures && !r.warnings).length, failingCombos: failing.length,
  failures: results.reduce((a, r) => a + r.failures, 0) + (report.fatal ? 1 : 0), warnings: results.reduce((a, r) => a + r.warnings, 0),
  byCategory, distinctByCategory: distinct, worstRoutes: Object.entries(routeTotals).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([route, n]) => ({ route, findings: n })),
  categories: CATEGORIES,
};
const file = writeReport('layout', report);
const s = report.summary;
const catLine = Object.entries(byCategory).map(([k, v]) => `${LABEL[k] || k} ${distinct[k] != null ? `${distinct[k]} distinct/` : ''}${v}`).join(', ') || 'no findings';
console.log(`\nSummary: ${s.cleanRoutes}/${s.routes} routes clean in every combo · ${s.clean}/${s.combos} route×viewport×theme combos clean · ${catLine} → ${s.failures ? `${s.failures} FAILURES` : 'PASS'}${s.warnings ? ` (${s.warnings} soft warnings)` : ''}`);
if (s.worstRoutes.length) console.log('Worst routes: ' + s.worstRoutes.slice(0, 6).map(w => `${w.route} (${w.findings})`).join(', '));
console.log(`Report: ${file}`);
process.exit(exitCode || (s.failures ? 1 : 0));
