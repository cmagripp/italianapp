// App shell: boot, router, top bar, floating dock, global translation toggle, scene transitions, aurora backdrop.
import { store } from './store.js';
import { loadData, registerCustom, data } from './data.js';
import { $, $$, toast, esc, closeSheets, stopSpeech } from './ui.js';
import { icon } from './icons.js';
import { mountAurora, setScene, SCENES, reducedMotion, closeDropdown } from './fx.js';
import { startAutoSync, isEnabled as syncEnabled } from './sync.js';
import { loadGrammarCourse } from './learning/grammar-course.js';

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
// navDepth = how many in-app entries lie behind the current one. A fresh push adds one; a traversal (the top-bar back
// button, the iOS back-swipe, forward) is recognised by the pid the target entry already carries (see rememberScroll)
// and moves the depth the way it went, so a swipe never makes the back button leave the app (or do nothing in standalone).
let navDepth = 0;
export function back(fallback = '#/home') {
  if (navDepth > 0 && history.length > 1) history.back();
  else navigate(fallback);
}
export function setTitle(t) { const el = $('#topTitle'); el.classList.remove('has-node'); el.textContent = t || 'Parola'; document.title = t ? `${t} · Parola` : 'Parola — Italian words & verbs'; }
// A screen may place its own control in the title slot (the Learn hub puts its view toggle there); the next setTitle restores the text title.
export function setTitleNode(node, t) { const el = $('#topTitle'); el.textContent = ''; el.appendChild(node); el.classList.add('has-node'); document.title = t ? `${t} · Parola` : 'Parola — Italian words & verbs'; }
export function setChrome({ tabs = true, back: showBack = null } = {}) {
  document.body.classList.toggle('no-tabs', !tabs);
  const b = $('#backBtn');
  b.classList.toggle('show', showBack == null ? !isTabRoute() : showBack);
}

// A malformed percent-sequence (#/entry/100%) must not throw out of the router: the raw text is used instead.
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
function parse() {
  const h = location.hash.replace(/^#/, '') || '/home';
  const qi = h.indexOf('?');
  const pathPart = qi < 0 ? h : h.slice(0, qi), q = qi < 0 ? '' : h.slice(qi + 1);
  const parts = pathPart.split('/').filter(Boolean);
  const query = {};
  // values are form-encoded by URLSearchParams in the source picker, so '+' is a space; the first '=' splits key and value
  if (q) for (const kv of q.split('&')) { if (!kv) continue; const eq = kv.indexOf('='); const k = eq < 0 ? kv : kv.slice(0, eq), v = eq < 0 ? '' : kv.slice(eq + 1); query[decode(k.replace(/\+/g, ' '))] = decode(v.replace(/\+/g, ' ')); }
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
      if (p.startsWith(':')) { if (v === undefined && !p.endsWith('?')) { ok = false; break; } params[p.slice(1).replace(/\?$/, '')] = v === undefined ? undefined : decode(v); }
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
  if (head === 'learn' || head === 'course' || head === 'review' || head === 'scope' || head === 'lab') setScene(level);
  else if (tab === 'home') setScene(SCENES.home, { level });
  else if (tab === 'games') setScene(SCENES.games, { level });
  else if (tab === 'words') setScene(SCENES.reference, { level });
  else if (tab === 'profile') setScene(SCENES.profile, { level });
  else setScene(level);
}

let renderSeq = 0;
// Views awaiting optional local data must recheck ownership before painting.
// The router's post-render check can clean up listeners, but cannot undo a late
// innerHTML write over a newer screen or a different learner's session.
export function captureViewOwnership(root,{identity=true}={}) {
  const seq=renderSeq, profile=store.current?.id, learner=store.current?.learnerId, epoch=store.learning?.epoch?.id;
  return () => seq===renderSeq && root.isConnected && (!identity || profile===store.current?.id
    && learner===store.current?.learnerId && epoch===store.learning?.epoch?.id);
}
// A deploy that lands while the app is open: the new service worker takes over at once (skipWaiting + claim) and JS is
// network-first, so the next lazily imported screen would come from the new build while the modules already in memory
// are the old one ("does not provide an export named …", until the app is force-quit). The next navigation reloads instead.
let swUpdated = false;
const onSceneIn = (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('scene-in'); };
// Scroll memory: every history entry gets an id in history.state, so back/forward restore the position that entry had
// while a new entry always starts at the top (the browser's own restoration is switched off so the two never fight).
const SESSION = Math.random().toString(36).slice(2, 8);
let pidSeq = 0, curPid = null;
const scrollMemory = new Map();
// entries of another session (before a reload) sort as "behind": an unknown direction must never leave the app
const pidSeqOf = (pid) => { const s = String(pid || ''); return s.startsWith(SESSION + ':') ? Number(s.slice(SESSION.length + 1)) || 0 : 0; };
function trackDepth() {
  const to = history.state && history.state.pid;
  if (to == null) navDepth++;
  else navDepth = Math.max(0, navDepth + (pidSeqOf(to) > pidSeqOf(curPid) ? 1 : -1));
}
try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }
function rememberScroll() {
  if (curPid != null) scrollMemory.set(curPid, window.scrollY);
  let pid = history.state && history.state.pid;
  const y = pid != null ? scrollMemory.get(pid) : undefined;
  if (pid == null) { pid = `${SESSION}:${++pidSeq}`; try { history.replaceState({ pid }, '', location.href); } catch { /* ignore */ } }
  curPid = pid;
  return y || 0;
}
async function render() {
  if (swUpdated) { swUpdated = false; location.reload(); return; } // same hash: the new build opens on the screen just chosen
  const { parts, query } = parse();
  const m = match(parts);
  const root = $('#view');
  // leaving a screen: its cleanup, any bottom sheet / dropdown still open over it, and whatever it was reading aloud
  if (currentCleanup) { try { currentCleanup(); } catch { /* ignore */ } currentCleanup = null; }
  closeSheets(); closeDropdown(); stopSpeech();
  const restoreY = rememberScroll();
  const seq = ++renderSeq;
  if (!m) { navigate('#/home', { replace: true }); return; }
  const tab = TABS.includes(parts[0]) ? parts[0] : (parts[0] === 'learn' || parts[0] === 'course' || parts[0] === 'review' || parts[0] === 'verb' || parts[0] === 'word' || parts[0] === 'lab' ? 'learn' : parts[0] === 'game' ? 'games' : ['browse', 'list', 'lists', 'entry', 'search', 'add', 'reference', 'grammar'].includes(parts[0]) ? 'words' : parts[0] === 'settings' ? 'profile' : lastTab);
  lastTab = tab;
  $$('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  setChrome({ tabs: true, back: !isTabRoute() });
  applyScene(tab, parts);
  // scene transition: outgoing scale .98 + fade 160ms, incoming from scale 1.03 + 8px + fade 260ms
  // (the boot spinner is replaced at once: fading it out would only delay the first screen)
  const animate = !reducedMotion() && root.childElementCount > 0 && !root.querySelector(':scope > .loading');
  root.classList.remove('scene-in');
  if (animate) root.classList.add('scene-out');
  try {
    const [mod] = await Promise.all([m.r.loader(m.params,query), animate ? wait(150) : null]);
    if (seq !== renderSeq) return;
    root.classList.remove('scene-out');
    root.innerHTML = '';
    root.scrollTop = 0; window.scrollTo(0, 0);
    setTitle(''); // a view that does not name itself (its "not found" branch) must not keep the previous screen's title
    const cleanup = await mod.render(root, m.params, query);
    if (seq !== renderSeq) { if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } } return; }
    if (typeof cleanup === 'function') currentCleanup = cleanup;
    if (restoreY) window.scrollTo(0, restoreY);
    if (!reducedMotion()) { root.classList.add('scene-in'); root.addEventListener('animationend', onSceneIn, { once: true }); }
  } catch (err) {
    console.error(err);
    if (seq !== renderSeq) return; // a stale render must not paint its error over the screen that replaced it
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
function learningPlayer(kind,query){return store.current?.settings?.adaptiveLearning!==false||query.courseSession||query.fromGrammar ? query.legacy==='1'?'./views/learnAdaptive.js':'./views/learnJourney.js':kind==='verb'?'./views/learnVerb.js':'./views/learnWord.js';}
route('home', () => import('./views/home.js'));
route('learn', () => import('./views/learn.js'));
route('course/placement', () => import('./views/coursePlacement.js'));
route('course', () => import('./views/course.js'));
route('learn/practice', (params,query={}) => import(query.legacy==='1'?'./views/learnAdaptive.js':'./views/learnJourney.js'));
route('learn/grammar/:id', () => import('./views/learnGrammar.js'));
route('learn/session', () => import('./views/courseSession.js'));
route('learn/verb/:id', (params,query={}) => import(learningPlayer('verb',query)));
route('learn/word/:id', (params,query={}) => import(learningPlayer('word',query)));
route('review', () => import('./views/review.js'));
route('conversations/:id?', () => import('./views/conversations.js'));
route('lab/frasi', () => import('./views/labFrasi.js'));
route('lab/frasi/:id', () => import('./views/labFrasiLesson.js'));
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
route('add', async()=>{const [view]=await Promise.all([import('./views/addWord.js'),import('./learning/integration.js')]);return view;});
route('profile', () => import('./views/profile.js'));
route('settings', () => import('./views/profile.js'));
route('scope', () => import('./views/scope.js'));

// Saving failures stay visible until a durable write succeeds. The banner is
// above the app header, keeping the lesson's Continue action reachable.
function mountSaveStatus() {
  const banner=document.createElement('section');
  banner.id='save-status';banner.hidden=true;banner.setAttribute('aria-label','Progress storage');
  const message=document.createElement('p');message.setAttribute('role','alert');
  const actions=document.createElement('div');actions.className='save-status-actions';
  const retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent='Retry save';
  const backup=document.createElement('button');backup.type='button';backup.className='btn ghost';backup.textContent='Export progress';
  actions.append(retry,backup);banner.append(message,actions);document.body.prepend(banner);
  const show=()=>{
    const failure=store.saveError;
    banner.hidden=!failure;
    document.body.classList.toggle('save-failed',!!failure);
    message.textContent=failure?'Progress is not saved yet. '+failure.message:'';
    document.body.style.setProperty('--save-status-height',failure?`${banner.offsetHeight}px`:'0px');
  };
  retry.addEventListener('click',async()=>{retry.disabled=true;try{await store.saveNow();}catch{/* banner keeps the failure visible */}finally{retry.disabled=false;show();}});
  backup.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([store.exportJSON()],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='parola-unsaved-progress.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  store.on('saveError',show);store.on('saveSuccess',show);store.on('profile',show);
  new ResizeObserver(()=>{if(!banner.hidden)document.body.style.setProperty('--save-status-height',`${banner.offsetHeight}px`);}).observe(banner);
  show();
}

async function boot() {
  mountAurora();
  setScene(SCENES.home);
  // The dictionary (3.4 MB) and the first screen's module download while the profile is read: neither waits for the other.
  const dataReady = loadData();
  const grammarReady = loadGrammarCourse().catch(error=>{ console.warn(error.message); });
  dataReady.catch(() => { /* reported below */ });
  const first = match(parse().parts);
  if (first && !['learn'].includes(parse().parts[0])) first.r.loader(first.params,parse().query).catch(() => { /* render() reports a module that cannot load */ });
  try{await store.init();}catch(error){
    $('#view').innerHTML=`<div class="empty"><h1>Keep your progress safe</h1><p>${esc(error.message)}</p>${error.profileBackup?'<button class="btn" data-export-prior>Export previous progress</button>':''}<button class="btn primary" data-retry-start>Retry</button></div>`;
    $('#view [data-retry-start]').addEventListener('click',()=>location.reload());
    $('#view [data-export-prior]')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([error.profileBackup],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='parola-pre-update-progress.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    return;
  }
  if(first&&parse().parts[0]==='learn')first.r.loader(first.params,parse().query).catch(()=>{});
  mountSaveStatus();
  applyTheme(); applyEnToggle();
  store.on('settings', () => { applyTheme(); applyEnToggle(); });
  // a user switch, delete, create or imported backup may change the level: the scene (html[data-level], aurora tint) follows at once
  store.on('profile', () => { registerCustom(store.current.custom); applyTheme(); applyEnToggle(); applyScene(lastTab, parse().parts); });
  try {
    await dataReady;
    await grammarReady;
    if(Object.keys(store.current.custom||{}).length)await import('./learning/integration.js');
    registerCustom(store.current.custom);
  } catch (err) {
    $('#view').innerHTML = `<div class="empty"><p>Could not load the dictionary.</p><p class="tiny muted">${esc(err.message)}</p><button class="btn primary" onclick="location.reload()">Retry</button></div>`;
    return;
  }
  if (syncEnabled()) startAutoSync();
  store.on('profile', () => { if (syncEnabled()) startAutoSync(); });
  $('#enToggle').addEventListener('click', () => { store.setSetting('showEn', store.settings.showEn === 'always' ? 'tap' : 'always'); toast(store.settings.showEn === 'always' ? 'English shown everywhere' : 'Tap Italian text to reveal English'); });
  $('#backBtn').addEventListener('click', () => back());
  window.addEventListener('hashchange', () => { trackDepth(); render(); });
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // the first controllerchange after a fresh install is the worker claiming this page, not an update
    let claimed = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (claimed) swUpdated = true; claimed = true; });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // an installed app resumed from the background never navigates, so it would not look for a new build for days
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => null); });
    }).catch(() => { /* offline support optional */ });
  }
}
boot();
