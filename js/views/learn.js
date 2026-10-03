// Learn hub shell: one model (learnData.js), the current view's name as the top bar's title — "Panoramica" or
// "Sezioni" with a small chevron that opens the glass view menu (fx.dropdown) — and a body that one of two views fills:
// the dashboard (learnDash.js) or the sections (learnSections.js). A horizontal swipe on the body slides to the other
// view. Switching keeps the route; the chosen view is remembered per profile. The next screen's setTitle() puts the
// text title back, so nothing here restores the top bar.
import { html, toast, icon } from '../ui.js';
import { setTitleNode, captureViewOwnership } from '../app.js';
import { store } from '../store.js';
import { data, itemsForScope, describeScope, LEVELS, LEVEL_INFO } from '../data.js';
import { setScene, dropdown, mount, reducedMotion } from '../fx.js';
import { bindCourseMenu } from './course.js';
import { loadGrammarCourse } from '../learning/grammar-course.js';
import {loadConversationContinuation} from '../learning/conversation-continuation.js';
import { learnModel, LEARN_VIEW_KEY, QUEUE_KEY, readPref, writePref } from './learnData.js';

export { nextNew } from './learnData.js';

const VIEWS = [
  { key: 'panoramica', label: 'Panoramica', sub: 'Your path, in progress, up next' },
  { key: 'sezioni', label: 'Sezioni', sub: 'Corso · Vocabolario · Ripasso · Laboratorio' },
];
const viewIndex = (key) => VIEWS.findIndex(v => v.key === key);
const loaders = { panoramica: () => import('./learnDash.js').then(m => m.renderDash), sezioni: () => import('./learnSections.js').then(m => m.renderSections) };

// a horizontal drag that starts inside one of these belongs to it (its own horizontal scrolling or dragging)
const SWIPE_IGNORE = '.reel, .dial, .chips.scroll, .fan, .deck.live, .flash, .tabs, .gtable-wrap, input, select, textarea, [contenteditable="true"], [data-no-swipe]';
const SWIPE_MIN = 56;  // travel that switches the view
const SWIPE_SLOP = 10; // travel before the direction of a drag is judged
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wait = (ms) => new Promise(r => setTimeout(r, ms));

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

// The title: the current view's name in the top bar's serif style plus a chevron, one 44px tap target that opens the
// view menu. A real element (not a string) because it is handed to the top bar's title slot. The zero-height anchor
// span centred under the name is what the dropdown is placed against, so the menu hangs centred under the title.
function buildTitle() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'learn-title';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.dataset.learnTitle = '';
  btn.innerHTML = `<span class="learn-title-text" data-view-name></span>${icon('chevronDown', { size: 18 })}<span class="learn-title-anchor" aria-hidden="true"></span>`;
  return btn;
}
function labelTitle(btn, key, animate = false) {
  const v = VIEWS[viewIndex(key)] || VIEWS[0];
  const text = btn.querySelector('[data-view-name]');
  text.textContent = v.label;
  btn.dataset.view = v.key;
  if (animate && !reducedMotion()) { text.classList.remove('swap'); void text.offsetWidth; text.classList.add('swap'); }
}

export async function render(root) {
  const owned=captureViewOwnership(root);
  await Promise.all([loadGrammarCourse(),loadConversationContinuation(store)]);
  if(!owned())return;
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
  if (viewIndex(view) < 0) view = 'panoramica';

  // dir: +1 slides the body left (towards Sezioni), −1 right (towards Panoramica), 0 is a plain redraw
  async function fill(body, dir = 0) {
    const mine = ++seq;
    stopView();
    const model = learnModel(store);
    const ctx = { store, redraw, bindScopeMenu, bindSessionMenu };
    // hold the body's height while the next view mounts so the switch never jumps the page
    const held = body.offsetHeight || 0;
    if (held) body.style.minHeight = `${held}px`;
    const slide = dir && !reducedMotion();
    // the old view leaves the way the finger went (a fade under reduced motion) while the next one loads
    if (dir) { body.classList.add('leaving'); body.style.transform = slide ? `translateX(${dir * -56}px)` : ''; body.style.opacity = '0'; }
    const [renderView] = await Promise.all([loaders[view]().catch(err => { console.error(err); return null; }), dir ? wait(reducedMotion() ? 120 : 160) : null]);
    if (mine !== seq || !body.isConnected || !owned()) return;
    body.classList.remove('leaving');
    body.innerHTML = '';
    body.dataset.view = view;
    let out = null;
    if (renderView) { try { out = await renderView(body, model, ctx); } catch (err) { console.error(err); body.innerHTML = html`<div class="empty"><p>This view could not load.</p><a class="btn secondary sm" href="#/course">Open your course</a></div>`; } }
    else body.innerHTML = html`<div class="empty"><p>This view could not load.</p><a class="btn secondary sm" href="#/course">Open your course</a></div>`;
    if (mine !== seq || !owned()) { if (typeof out === 'function') { try { out(); } catch { /* ignore */ } } return; }
    viewCleanup = out;
    bindCourseMenu(body, redraw);
    body.querySelectorAll('[data-scope-menu]').forEach(bindScopeMenu);
    body.querySelectorAll('[data-session-menu]').forEach(bindSessionMenu);
    if (dir) {
      // the new view enters from the other side: placed there without a transition, then released
      body.classList.add('no-anim');
      body.style.transform = slide ? `translateX(${dir * 40}px)` : '';
      body.style.opacity = '0';
      void body.offsetWidth;
      body.classList.remove('no-anim');
      body.style.transform = ''; body.style.opacity = '';
    }
    mount(body);
    if (held) setTimeout(() => { if (mine === seq) body.style.minHeight = ''; }, reducedMotion() ? 0 : 480);
  }

  function draw() {
    if(!owned())return;
    cleanup();
    const model = learnModel(store);
    const lvl = model.stage.level;
    setScene(lvl === 'Foundations' ? 'A1' : lvl);
    // the view's name takes the title slot of the top bar; the body starts directly under it
    const title = buildTitle();
    labelTitle(title, view);
    setTitleNode(title, 'Learn');
    root.innerHTML = html`<div class="learn" data-learn><div class="learn-body" data-learn-body></div></div>`;
    const wrap = root.querySelector('[data-learn]');
    const body = wrap.querySelector('[data-learn-body]');
    let menu = null;
    const select = (key, { dir = 0 } = {}) => {
      if (!loaders[key] || key === view) return;
      const d = dir || Math.sign(viewIndex(key) - viewIndex(view));
      view = writePref(store, LEARN_VIEW_KEY, key);
      labelTitle(title, view, true);
      fill(body, d);
    };

    // the title opens the view menu: the two views, the current one ticked
    const openMenu = () => {
      if (menu) { menu.close(); return; }
      title.setAttribute('aria-expanded', 'true');
      const anchor = title.querySelector('.learn-title-anchor') || title;
      let api = null;
      api = dropdown(anchor, VIEWS.map(v => ({ value: v.key, label: v.label, sub: v.sub, selected: v.key === view })), {
        width: 240,
        onSelect: (key) => select(key),
        onClose: () => {
          menu = null;
          title.setAttribute('aria-expanded', 'false');
          // keyboard users get their place back: focus that moved into the panel returns to the title
          const panel = api && api.el;
          if (panel && panel.contains(document.activeElement) && title.isConnected) { try { title.focus({ preventScroll: true }); } catch { /* ignore */ } }
        },
      });
      menu = api;
      // the same hook as the body carries: each option names the view it opens
      if (api.el) api.el.querySelectorAll('[data-value]').forEach(o => { o.dataset.view = o.dataset.value; });
    };
    const onTitleKey = (ev) => {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); const n = VIEWS[viewIndex(view) + 1]; if (n) select(n.key); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); const p = VIEWS[viewIndex(view) - 1]; if (p) select(p.key); }
    };

    // A horizontal swipe on the body slides to the neighbouring view (left → Sezioni, right → Panoramica). The drag is
    // judged after a small slop: mostly vertical drags are left to the page, and drags that start inside a horizontal
    // scroller (reel, dial, chip row) belong to it. While the finger moves the body follows it a little, rubber-banded
    // at the ends; past SWIPE_MIN the release switches, otherwise the body springs back.
    let drag = null, suppressUntil = 0;
    const follow = (dx) => {
      const i = viewIndex(view);
      const open = dx < 0 ? i < VIEWS.length - 1 : i > 0;
      return clamp(dx * (open ? .3 : .08), -56, 56);
    };
    const onDown = (ev) => {
      if ((ev.pointerType === 'mouse' && ev.button !== 0) || !ev.isPrimary) return;
      if (ev.target.closest(SWIPE_IGNORE)) return;
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, axis: '', dx: 0 };
    };
    const onMove = (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.axis) {
        if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) * 1.25 ? 'h' : 'v';
        if (drag.axis !== 'h') return;
        body.classList.add('dragging');
        try { wrap.setPointerCapture(drag.id); } catch { /* ignore */ }
        try { getSelection()?.removeAllRanges(); } catch { /* ignore */ }
      }
      if (drag.axis !== 'h') return;
      drag.dx = dx;
      if (!reducedMotion()) body.style.transform = `translateX(${follow(dx).toFixed(1)}px)`;
    };
    const finish = (ev, cancelled) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const { axis, dx } = drag; drag = null;
      if (axis !== 'h') return;
      body.classList.remove('dragging');
      body.style.transform = '';
      suppressUntil = Date.now() + 400;
      if (cancelled || Math.abs(dx) < SWIPE_MIN) return;
      const next = VIEWS[viewIndex(view) + (dx < 0 ? 1 : -1)];
      if (next) select(next.key, { dir: dx < 0 ? 1 : -1 });
    };
    const onUp = (ev) => finish(ev, false);
    const onCancel = (ev) => finish(ev, true);
    // the click that follows a mouse drag must not open the card under the pointer
    const onClickCapture = (ev) => { if (Date.now() < suppressUntil) { ev.stopPropagation(); ev.preventDefault(); } };

    title.addEventListener('click', openMenu);
    title.addEventListener('keydown', onTitleKey);
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerup', onUp);
    wrap.addEventListener('pointercancel', onCancel);
    wrap.addEventListener('click', onClickCapture, true);
    bound.push(() => {
      title.removeEventListener('click', openMenu); title.removeEventListener('keydown', onTitleKey);
      wrap.removeEventListener('pointerdown', onDown); wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerup', onUp); wrap.removeEventListener('pointercancel', onCancel);
      wrap.removeEventListener('click', onClickCapture, true);
      if (menu) menu.close({ restoreFocus: false });
    });
    mount(wrap);
    return fill(body);
  }
  function redraw() { draw(); }
  await draw();
  return cleanup;
}
