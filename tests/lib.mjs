// Shared helpers for the Playwright suites (tests/e2e.mjs, tests/layout-audit.mjs).
// No npm scripts, no test runner: plain Node ES modules driving a Chromium instance.
//
// Environment knobs (all optional):
//   BASE            app URL, default http://127.0.0.1:8123/
//   AUTOSTART=0     do not start `python3 -m http.server` when BASE is down
//   PLAYWRIGHT_DIR  directory that contains node_modules/playwright (NODE_PATH also works)
//   CHROME          Chromium executable (default /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
//   HEADLESS=0      show the browser
//   SHOTS=1         write screenshots into tests/shots/
//   SEED=0          do not seed learned items into the fresh profile (layout audit only)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TESTS_DIR = path.join(ROOT, 'tests');
export const SHOTS_DIR = path.join(TESTS_DIR, 'shots');
export const BASE = (process.env.BASE || 'http://127.0.0.1:8123/').replace(/\/?$/, '/');
export const CHROME = process.env.CHROME || process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const SHOTS = process.env.SHOTS === '1';
const DEFAULT_PW_DIR = '/tmp/claude-0/-home-user-italianapp/03954d52-f5f5-57d3-b1d0-493b05f9b4dc/scratchpad';

export const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- playwright resolution ----------
export async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_DIR, ...(process.env.NODE_PATH || '').split(path.delimiter), DEFAULT_PW_DIR].filter(Boolean);
  let resolved = null;
  try { resolved = require.resolve('playwright'); } catch { /* not on the default lookup path */ }
  for (const c of candidates) {
    if (resolved) break;
    for (const dir of [c, path.dirname(c)]) {
      try { resolved = require.resolve('playwright', { paths: [dir] }); break; } catch { /* keep looking */ }
    }
  }
  if (!resolved) throw new Error(`Cannot find the playwright package. Set PLAYWRIGHT_DIR (or NODE_PATH) to the directory that contains node_modules/playwright, e.g.\n  PLAYWRIGHT_DIR=${DEFAULT_PW_DIR} node tests/e2e.mjs`);
  const dir = path.dirname(resolved);
  const entry = fs.existsSync(path.join(dir, 'index.mjs')) ? path.join(dir, 'index.mjs') : resolved;
  const mod = await import(pathToFileURL(entry).href);
  const pw = mod.chromium ? mod : (mod.default || mod);
  return { chromium: pw.chromium, devices: pw.devices, from: dir };
}

export async function launchBrowser(chromium) {
  const executablePath = fs.existsSync(CHROME) ? CHROME : undefined;
  return chromium.launch({ executablePath, headless: process.env.HEADLESS !== '0' });
}

// Context options shared by both suites: iPhone-ish device, service worker blocked so the live files are tested,
// ignoreHTTPSErrors because the sandbox egress proxy re-terminates TLS for Google Fonts.
export function contextOptions(device, extra = {}) {
  return { ...device, locale: 'en-US', ignoreHTTPSErrors: true, serviceWorkers: 'block', ...extra };
}

// ---------- static server ----------
export async function serverUp(base = BASE) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(base + 'index.html', { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}
// Starts `python3 -m http.server` for a loopback BASE when nothing is listening. Returns a stop() function.
export async function ensureServer(base = BASE) {
  if (await serverUp(base)) return () => {};
  const u = new URL(base);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(u.hostname);
  if (process.env.AUTOSTART === '0' || !loopback) throw new Error(`Nothing is serving ${base}. Start the app first:\n  cd ${ROOT} && (python3 -m http.server ${u.port || 80} --bind 127.0.0.1 >/dev/null 2>&1 &)`);
  const port = u.port || '8123';
  const child = spawn('python3', ['-m', 'http.server', port, '--bind', u.hostname === 'localhost' ? '127.0.0.1' : u.hostname], { cwd: ROOT, stdio: 'ignore' });
  child.on('error', () => { /* reported through the readiness loop below */ });
  for (let i = 0; i < 40; i++) { await wait(150); if (await serverUp(base)) break; }
  if (!(await serverUp(base))) { try { child.kill(); } catch { /* ignore */ } throw new Error(`Could not start a static server on ${base} (python3 -m http.server ${port}).`); }
  console.log(`(started python3 -m http.server ${port} for this run)`);
  return () => { try { child.kill(); } catch { /* ignore */ } };
}

// ---------- routes ----------
export const STATIC_ROUTES = [
  '/home', '/learn', '/games', '/words', '/search', '/profile',
  '/browse/A1', '/browse/A1/food', '/browse?kind=verb',
  '/lists', '/list/bank', '/scope', '/add',
  '/entry/v:essere', '/entry/v:andarsene', '/entry/w:casa|noun',
  '/learn/verb/v:mangiare', '/learn/word/w:casa|noun', '/review',
  '/reference', '/reference/v:essere', '/reference/w:casa|noun', '/grammar/articles',
];
// Fallback only: the live list is read from js/games/index.js in the browser (discoverGameIds).
export const FALLBACK_GAME_IDS = ['flashcards', 'quiz', 'typing', 'matching', 'hangman', 'crossword', 'cloze', 'scramble', 'sentence', 'gender', 'plurals', 'dictation', 'reverse', 'speed', 'conj-drill', 'conj-choice', 'tense-detective', 'aux', 'participles', 'patterns', 'verb-quiz'];
export const gameRoute = (id) => `/game/${id}?src=level:A1`;

export async function discoverGameIds(page) {
  try {
    const ids = await page.evaluate(() => import('./js/games/index.js').then(m => m.GAMES.map(g => g.id)));
    if (Array.isArray(ids) && ids.length) return ids;
  } catch { /* fall through */ }
  return FALLBACK_GAME_IDS;
}
export async function allRoutes(page) { return [...STATIC_ROUTES, ...(await discoverGameIds(page)).map(gameRoute)]; }

// CLI args are case-insensitive substring filters ("game/" "profile" "flow:review"); args starting with -- are ignored.
export function cliFilters(argv = process.argv.slice(2)) { return argv.filter(a => !a.startsWith('--')); }
export function matches(name, filters) { return !filters.length || filters.some(f => name.toLowerCase().includes(f.toLowerCase())); }
export const routeSlug = (r) => r.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 70) || 'root';

// ---------- error collection ----------
// sink.current is set by the harness so every console/page error is attributed to the route or flow being exercised.
export function makeSink() { return { current: 'boot', errors: [], warnings: [], push(kind, text) { (kind === 'warn' ? this.warnings : this.errors).push({ at: this.current, text: String(text).slice(0, 600) }); } }; }
const isFontNoise = (url, text) => /fonts\.g(oogleapis|static)\.com/.test(url || '') || (/fonts\.g(oogleapis|static)\.com/.test(text || ''));
export function attachCollectors(page, sink, base = BASE) {
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const url = (m.location && m.location().url) || '';
    if (isFontNoise(url, m.text())) return;
    sink.push('error', m.text());
  });
  page.on('pageerror', e => sink.push('error', `PAGEERROR ${e.message}${e.stack ? '\n' + String(e.stack).split('\n').slice(1, 3).join('\n') : ''}`));
  page.on('response', r => { const u = r.url(); if (u.startsWith(base) && r.status() >= 400) sink.push('error', `HTTP ${r.status()} ${u.slice(base.length)}`); });
  page.on('requestfailed', r => { const u = r.url(); if (u.startsWith(base)) sink.push('error', `REQUEST FAILED ${u.slice(base.length)} ${r.failure()?.errorText || ''}`); });
  page.on('dialog', d => d.accept().catch(() => {}));
}

// ---------- navigation ----------
export async function boot(page, base = BASE) {
  // domcontentloaded: the `load` event waits for the Google Fonts stylesheet, which can be slow or blocked offline.
  await page.goto(base + 'index.html#/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page);
}
export async function reloadApp(page) {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page);
}
export async function waitForBoot(page) {
  await page.waitForFunction(() => import('./js/data.js').then(m => m.data.loaded).catch(() => false), null, { timeout: 20000 });
  await settle(page);
}
// Waits until #view stops changing (scene transitions + lazy view modules), bounded by `max` ms.
export async function settle(page, { min = 250, max = 3000 } = {}) {
  await page.waitForTimeout(min);
  const t0 = Date.now(); let last = null; let stable = 0;
  while (Date.now() - t0 < max) {
    let snap = null;
    try { snap = await page.evaluate(() => { const v = document.querySelector('#view'); return (v ? v.className + '|' + v.innerHTML.length : 'no-view') + '|' + document.readyState; }); } catch { break; }
    if (snap === last) { if (++stable >= 2) break; } else stable = 0;
    last = snap; await page.waitForTimeout(120);
  }
}
export async function gotoRoute(page, route) {
  const target = '#' + route;
  const cur = await page.evaluate(() => location.hash);
  if (cur === target) { await page.evaluate(() => { location.hash = '#/home'; }); await settle(page, { min: 150, max: 1500 }); }
  await page.evaluate((h) => { location.hash = h; }, target);
  await settle(page);
}
export async function viewText(page, n = 220) {
  return page.evaluate((n) => (document.querySelector('#view')?.innerText || '').replace(/\s*\n+\s*/g, ' | ').trim().slice(0, n), n);
}

// Marks A1 items learned (and due) straight through the store so review, lists and "learned" sources have content.
export async function seedProgress(page, { words = 20, verbs = 10 } = {}) {
  return page.evaluate(async ({ words, verbs }) => {
    const { store } = await import('./js/store.js');
    const { data } = await import('./js/data.js');
    const a1 = data.vocab.filter(e => e.level === 'A1').slice(0, words);
    const v1 = data.verbs.filter(e => e.level === 'A1').slice(0, verbs);
    for (const e of a1) { store.markLearned(e.id, 'word'); store.current.items[e.id].due = Date.now() - 1000; }
    for (const e of v1) { store.markLearned(e.id, 'verb'); store.current.items[e.id].due = Date.now() - 1000; }
    if (a1[0]) store.addToList('bank', a1[0].id);
    if (v1[0]) store.addToList('bank', v1[0].id);
    store.setSetting('dailyReviews', 20);
    await store.saveNow();
    return { learned: store.learnedIds().length, words: store.learnedIds().filter(id => !id.startsWith('v:')).length, verbs: store.learnedIds('v:').length, xp: store.current.stats.xp };
  }, { words, verbs });
}

// ---------- screenshots & reports ----------
export async function shot(page, name) {
  if (!SHOTS) return null;
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const file = path.join(SHOTS_DIR, name.replace(/[^a-z0-9_.-]+/gi, '_') + '.png');
  // own timeout: the glass/blur-heavy pages can take a few seconds to paint on the first capture
  try { await page.screenshot({ path: file, fullPage: false, timeout: 15000 }); return path.relative(ROOT, file); }
  catch (err) { console.log(`  (screenshot ${path.basename(file)} failed: ${String(err.message).split('\n')[0].slice(0, 100)})`); return null; }
}
export function writeReport(name, data) {
  const file = path.join(TESTS_DIR, `report-${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return path.relative(ROOT, file);
}
export const ms = (t) => `${Math.round(t)}ms`;
export const pad = (s, n) => String(s).padEnd(n);
