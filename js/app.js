// App shell: boot, router, top bar, floating dock, global translation toggle, scene transitions, aurora backdrop.
import { store } from './store.js';
import { loadData, registerCustom } from './data.js';
import { $, $$, toast, esc } from './ui.js';
import { icon } from './icons.js';
import { mountAurora, setScene, SCENES, reducedMotion } from './fx.js';
import { startAutoSync, isEnabled as syncEnabled } from './sync.js';

const routes = [];
let currentCleanup = null;
let lastTab = 'home';
const TABS = ['home', 'learn', 'games', 'words', 'profile'];
const wait = (ms) => new Promise(r => setTimeout(r, ms));

export function route(pattern, loader) { routes.push({ pattern: pattern.split('/').filter(Boolean), loader }); }

export function navigate(hash, { replace = false } = {}) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  if (replace) history.replaceState(null, '', hash); else location.hash = hash;
  if (replace) render();
}
let navDepth = 0;
export function back(fallback = '#/home') {
  if (navDepth > 0 && history.length > 1) { navDepth -= 2; history.back(); }
  else navigate(fallback);
}
export function setTitle(t) { $('#topTitle').textContent = t || 'Parola'; document.title = t ? `${t} · Parola` : 'Parola — Italian words & verbs'; }
export function setChrome({ tabs = true, back: showBack = null } = {}) {
  document.body.classList.toggle('no-tabs', !tabs);
  const b = $('#backBtn');
  b.classList.toggle('show', showBack == null ? !isTabRoute() : showBack);
}

function parse() {
  const h = location.hash.replace(/^#/, '') || '/home';
  const [pathPart, q] = h.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const query = {};
  if (q) for (const kv of q.split('&')) { const [k, v = ''] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v); }
  return { parts, query };
}
function isTabRoute() { const { parts } = parse(); return parts.length === 1 && TABS.includes(parts[0]); }

function match(parts) {
  for (const r of routes) {
    if (r.pattern.length !== parts.length) {
      // allow optional trailing params marked with '?'
      const req = r.pattern.filter(p => !p.endsWith('?')).length;
      if (parts.length < req || parts.length > r.pattern.length) continue;
    }
    const params = {}; let ok = true;
    for (let i = 0; i < r.pattern.length; i++) {
      const p = r.pattern[i]; const v = parts[i];
      if (p.startsWith(':')) { if (v === undefined && !p.endsWith('?')) { ok = false; break; } params[p.slice(1).replace(/\?$/, '')] = v === undefined ? undefined : decodeURIComponent(v); }
      else if (p !== v) { ok = false; break; }
    }
    if (ok) return { r, params };
  }
  return null;
}

// Default aurora colours per section; views may refine with fx.setScene(level) afterwards.
function applyScene(tab, parts) {
  const level = store.current?.settings?.level || 'A1';
  const head = parts[0];
  if (head === 'learn' || head === 'review' || head === 'scope') setScene(level);
  else if (tab === 'home') setScene(SCENES.home, { level });
  else if (tab === 'games') setScene(SCENES.games, { level });
  else if (tab === 'words') setScene(SCENES.reference, { level });
  else if (tab === 'profile') setScene(SCENES.profile, { level });
  else setScene(level);
}

let renderSeq = 0;
const onSceneIn = (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('scene-in'); };
async function render() {
  const { parts, query } = parse();
  const m = match(parts);
  const root = $('#view');
  if (currentCleanup) { try { currentCleanup(); } catch { /* ignore */ } currentCleanup = null; }
  const seq = ++renderSeq;
  if (!m) { navigate('#/home', { replace: true }); return; }
  const tab = TABS.includes(parts[0]) ? parts[0] : (parts[0] === 'learn' || parts[0] === 'review' || parts[0] === 'verb' || parts[0] === 'word' ? 'learn' : parts[0] === 'game' ? 'games' : ['browse', 'list', 'lists', 'entry', 'search', 'add', 'reference', 'grammar'].includes(parts[0]) ? 'words' : parts[0] === 'settings' ? 'profile' : lastTab);
  lastTab = tab;
  $$('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  setChrome({ tabs: true, back: !isTabRoute() });
  applyScene(tab, parts);
  // scene transition: outgoing scale .98 + fade 160ms, incoming from scale 1.03 + 8px + fade 260ms
  const animate = !reducedMotion() && root.childElementCount > 0;
  root.classList.remove('scene-in');
  if (animate) root.classList.add('scene-out');
  try {
    const [mod] = await Promise.all([m.r.loader(), animate ? wait(150) : null]);
    if (seq !== renderSeq) return;
    root.classList.remove('scene-out');
    root.innerHTML = '';
    root.scrollTop = 0; window.scrollTo(0, 0);
    const cleanup = await mod.render(root, m.params, query);
    if (seq !== renderSeq) { if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } } return; }
    if (typeof cleanup === 'function') currentCleanup = cleanup;
    if (!reducedMotion()) { root.classList.add('scene-in'); root.addEventListener('animationend', onSceneIn, { once: true }); }
  } catch (err) {
    console.error(err);
    root.classList.remove('scene-out');
    root.innerHTML = `<div class="empty"><p>Qualcosa è andato storto.</p><p class="tiny muted">${esc(err && err.message || err)}</p><a class="btn primary" href="#/home">Go home</a></div>`;
  }
}

function applyTheme() {
  const t = store.current?.settings?.theme || 'auto';
  // Notte (dark) is the default look; Mezzogiorno (light) is opt-in.
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f4efe6' : '#070912');
}
function applyEnToggle() {
  const on = store.current?.settings?.showEn === 'always';
  document.body.classList.toggle('show-en', on);
  const b = $('#enToggle'); b.classList.toggle('on', on);
  b.innerHTML = on ? 'EN' + icon('check', { size: 14 }) : 'EN';
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.title = on ? 'English shown everywhere (tap to hide until tapped)' : 'Tap Italian text to reveal English (tap to always show)';
}

// routes
route('home', () => import('./views/home.js'));
route('learn', () => import('./views/learn.js'));
route('learn/verb/:id', () => import('./views/learnVerb.js'));
route('learn/word/:id', () => import('./views/learnWord.js'));
route('review', () => import('./views/review.js'));
route('games', () => import('./views/games.js'));
route('game/:id', () => import('./views/play.js'));
route('words', () => import('./views/words.js'));
route('search', () => import('./views/search.js'));
route('browse/:level?/:cat?', () => import('./views/browse.js'));
route('lists', () => import('./views/lists.js'));
route('list/:id', () => import('./views/list.js'));
route('entry/:id', () => import('./views/entry.js'));
route('reference', () => import('./views/reference.js'));
route('reference/:id', () => import('./views/referenceEntry.js'));
route('grammar/:topic?', () => import('./views/grammar.js'));
route('add', () => import('./views/addWord.js'));
route('profile', () => import('./views/profile.js'));
route('settings', () => import('./views/profile.js'));
route('scope', () => import('./views/scope.js'));

async function boot() {
  mountAurora();
  setScene(SCENES.home);
  await store.init();
  applyTheme(); applyEnToggle();
  store.on('settings', () => { applyTheme(); applyEnToggle(); });
  store.on('profile', () => { registerCustom(store.current.custom); applyTheme(); applyEnToggle(); });
  try {
    await loadData();
    registerCustom(store.current.custom);
  } catch (err) {
    $('#view').innerHTML = `<div class="empty"><p>Could not load the dictionary.</p><p class="tiny muted">${esc(err.message)}</p><button class="btn primary" onclick="location.reload()">Retry</button></div>`;
    return;
  }
  if (syncEnabled()) startAutoSync();
  store.on('profile', () => { if (syncEnabled()) startAutoSync(); });
  $('#enToggle').addEventListener('click', () => { store.setSetting('showEn', store.settings.showEn === 'always' ? 'tap' : 'always'); toast(store.settings.showEn === 'always' ? 'English shown everywhere' : 'Tap Italian text to reveal English'); });
  $('#backBtn').addEventListener('click', () => back());
  window.addEventListener('hashchange', () => { navDepth++; render(); });
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support optional */ });
  }
}
boot();
