// Learn hub shell: one model (learnData.js), a dial-like segmented bar (Panoramica / Sezioni) placed in the top bar's
// title slot, and a body that one of two views fills — the dashboard (learnDash.js) or the sections
// (learnSections.js). Switching segments keeps the route; the chosen view is remembered per profile. The next screen's
// setTitle() puts the text title back, so nothing here restores the top bar.
import { html, raw, toast } from '../ui.js';
import { setTitleNode } from '../app.js';
import { store } from '../store.js';
import { data, itemsForScope, describeScope, LEVELS, LEVEL_INFO } from '../data.js';
import { setScene, dropdown, mount, reducedMotion } from '../fx.js';
import { bindCourseMenu } from './course.js';
import { loadGrammarCourse } from '../learning/grammar-course.js';
import { learnModel, LEARN_VIEW_KEY, QUEUE_KEY, readPref, writePref } from './learnData.js';

export { nextNew } from './learnData.js';

const VIEWS = [['panoramica', 'Panoramica'], ['sezioni', 'Sezioni']];
const loaders = { panoramica: () => import('./learnDash.js').then(m => m.renderDash), sezioni: () => import('./learnSections.js').then(m => m.renderSections) };

function scopeOptions() {
  const sc = store.scope;
  const cur = sc.mode === 'level' ? 'level:' + ((sc.levels && sc.levels[0]) || 'A1') : sc.mode;
  const lists = Object.values(store.lists);
  const count = (scope) => itemsForScope(scope, store).length;
  return [
    ...LEVELS.map(L => ({ value: 'level:' + L, label: `Level ${L}`, sub: `${LEVEL_INFO[L].name} · ${count({ mode: 'level', levels: [L], cats: [] })} items`, selected: cur === 'level:' + L && !(sc.cats && sc.cats.length) })),
    { value: 'lists', label: 'My lists', sub: `${lists.length} list${lists.length === 1 ? '' : 's'} · ${count({ mode: 'lists', lists: lists.map(l => l.id) })} items`, selected: cur === 'lists' },
    { value: 'learned', label: 'Learned', sub: `${store.learnedIds().length} items`, selected: cur === 'learned' },
    { value: 'all', label: 'All words & verbs', sub: `${data.vocab.length + data.verbs.length} items`, selected: cur === 'all' },
  ];
}
function applyScopeChoice(v) {
  if (v.startsWith('level:')) store.setScope({ mode: 'level', levels: [v.slice(6)], cats: [] });
  else if (v === 'lists') { const cur = store.scope.lists || []; store.setScope({ mode: 'lists', lists: cur.length ? cur : Object.keys(store.lists) }); }
  else store.setScope({ mode: v });
}
function sessionOptions() {
  const queue = store.learning.sessions[QUEUE_KEY];
  return [
    ...(queue?.course && !queue.course.finished ? [{ value: 'resume', label: 'Resume your session', sub: 'Continue the parts you already chose' }] : []),
    { value: 'together', label: 'Together', sub: 'Grammar, one verb tense, and up to three words' },
    { value: 'grammar', label: 'Grammar', sub: 'One clear idea, step by step' },
    { value: 'verbs', label: 'Verbs', sub: 'One relevant tense' },
    { value: 'words', label: 'Words', sub: 'A short vocabulary session' },
  ];
}

function placeKnob(seg, animate = true) {
  const on = seg.querySelector('button.on'); if (!on) return;
  seg.classList.toggle('no-anim', !animate);
  seg.style.setProperty('--kx', `${on.offsetLeft}px`); seg.style.setProperty('--kw', `${on.offsetWidth}px`);
  if (!animate) requestAnimationFrame(() => seg.classList.remove('no-anim'));
}

// the view toggle: a real element (not a string) because it is handed to the top bar's title slot
function buildSeg(view) {
  const seg = document.createElement('div');
  seg.className = 'seg mode-seg learn-seg no-anim';
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', 'Learn view');
  seg.dataset.learnSeg = '';
  seg.innerHTML = VIEWS.map(([k, l]) => html`<button type="button" role="radio" aria-checked="${view === k ? 'true' : 'false'}" tabindex="${view === k ? '0' : '-1'}" class="${view === k ? 'on' : ''}" data-view="${k}">${l}</button>`).join('');
  return seg;
}

export async function render(root) {
  await loadGrammarCourse();
  let viewCleanup = null, seq = 0;
  const bound = [];
  const stopView = () => { if (typeof viewCleanup === 'function') { try { viewCleanup(); } catch { /* ignore */ } } viewCleanup = null; };
  const cleanup = () => { stopView(); bound.splice(0).forEach(f => { try { f(); } catch { /* ignore */ } }); };

  const bindScopeMenu = (button) => {
    if (!button || button.dataset.boundMenu) return;
    button.dataset.boundMenu = '1';
    button.addEventListener('click', () => dropdown(button, scopeOptions(), { align: 'end', width: 280, onSelect: (v) => { applyScopeChoice(v); toast(describeScope(store.scope, store), { kind: 'ok' }); redraw(); } }));
  };
  const bindSessionMenu = (button) => {
    if (!button || button.dataset.boundMenu) return;
    button.dataset.boundMenu = '1';
    button.addEventListener('click', () => dropdown(button, sessionOptions(), { align: 'end', width: 300, onSelect: value => { location.hash = value === 'resume' ? '#/learn/session' : '#/learn/session?start=' + value; } }));
  };

  let view = readPref(store, LEARN_VIEW_KEY, 'panoramica');
  if (!VIEWS.some(([k]) => k === view)) view = 'panoramica';

  async function fill(body) {
    const mine = ++seq;
    stopView();
    const model = learnModel(store);
    const ctx = { store, redraw, bindScopeMenu, bindSessionMenu };
    // hold the body's height while the next view mounts so the segment switch never jumps the page
    const held = body.offsetHeight || 0;
    if (held) body.style.minHeight = `${held}px`;
    let renderView = null;
    try { renderView = await loaders[view](); } catch (err) { console.error(err); }
    if (mine !== seq || !body.isConnected) return;
    body.innerHTML = '';
    body.dataset.view = view;
    let out = null;
    if (renderView) { try { out = await renderView(body, model, ctx); } catch (err) { console.error(err); body.innerHTML = html`<div class="empty"><p>This view could not load.</p><a class="btn secondary sm" href="#/course">Open your course</a></div>`; } }
    else body.innerHTML = html`<div class="empty"><p>This view could not load.</p><a class="btn secondary sm" href="#/course">Open your course</a></div>`;
    if (mine !== seq) { if (typeof out === 'function') { try { out(); } catch { /* ignore */ } } return; }
    viewCleanup = out;
    bindCourseMenu(body, redraw);
    body.querySelectorAll('[data-scope-menu]').forEach(bindScopeMenu);
    body.querySelectorAll('[data-session-menu]').forEach(bindSessionMenu);
    mount(body);
    if (held) setTimeout(() => { if (mine === seq) body.style.minHeight = ''; }, reducedMotion() ? 0 : 480);
  }

  function draw() {
    cleanup();
    const model = learnModel(store);
    const lvl = model.stage.level;
    setScene(lvl === 'Foundations' ? 'A1' : lvl);
    // the toggle takes the title slot of the top bar; the body starts directly under it
    const seg = buildSeg(view);
    setTitleNode(seg, 'Learn');
    root.innerHTML = html`<div class="learn" data-learn><div class="learn-body" data-learn-body></div></div>`;
    const wrap = root.querySelector('[data-learn]');
    const body = wrap.querySelector('[data-learn-body]');
    const select = (key, { focus = false } = {}) => {
      if (!loaders[key]) return;
      seg.querySelectorAll('[data-view]').forEach(b => { const on = b.dataset.view === key; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      placeKnob(seg, true);
      if (key === view) return;
      view = writePref(store, LEARN_VIEW_KEY, key);
      fill(body);
    };
    const onClick = (ev) => { const b = ev.target.closest('[data-view]'); if (b) select(b.dataset.view); };
    const onKey = (ev) => {
      const keys = VIEWS.map(([k]) => k), i = keys.indexOf(view);
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); select(keys[(i + 1) % keys.length], { focus: true }); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); select(keys[(i + keys.length - 1) % keys.length], { focus: true }); }
      else if (ev.key === 'Home') { ev.preventDefault(); select(keys[0], { focus: true }); }
      else if (ev.key === 'End') { ev.preventDefault(); select(keys[keys.length - 1], { focus: true }); }
    };
    const onResize = () => placeKnob(seg, false);
    seg.addEventListener('click', onClick);
    seg.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    bound.push(() => { seg.removeEventListener('click', onClick); seg.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (seg.isConnected) placeKnob(seg, false); });
    placeKnob(seg, false);
    mount(wrap);
    return fill(body);
  }
  function redraw() { draw(); }
  await draw();
  return cleanup;
}
