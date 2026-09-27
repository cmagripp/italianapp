// fx.js — motion and bespoke interactive pieces of the "Notte italiana" design system.
// Aurora backdrop + scene tinting, rotary dial, card fan, poster reel, glass dropdown, confetti, stamps,
// typewriter, rising letters, parallax, mount stagger, orbit rings, ticker, count-up.
// Everything is defensive (missing elements → no-op) and works with pointer events on iOS.

const doc = document;
const html = doc.documentElement;
const noop = () => {};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// ---------- scenes ----------
const LEVEL_COLORS = {
  A1: ['#34d399', '#38bdf8', '#f2c14e'],
  A2: ['#22d3ee', '#a78bfa', '#f2c14e'],
  B1: ['#fbbf24', '#e0673f', '#38bdf8'],
  B2: ['#fb7a4b', '#f2c14e', '#a78bfa'],
  C1: ['#a78bfa', '#38bdf8', '#f43f5e'],
  C2: ['#f43f5e', '#f2c14e', '#a78bfa'],
};
export const SCENES = {
  home: ['#f2c14e', '#38bdf8', '#e0673f'],
  learn: ['#34d399', '#38bdf8', '#f2c14e'],
  games: ['#e0673f', '#a78bfa', '#2dd4bf'],
  reference: ['#38bdf8', '#f2c14e', '#a3b86c'],
  words: ['#38bdf8', '#f2c14e', '#a3b86c'],
  profile: ['#f2c14e', '#2dd4bf', '#a78bfa'],
  ...LEVEL_COLORS,
};
const LEVELS = Object.keys(LEVEL_COLORS);

// setScene('B1') | setScene('games') | setScene(['#f2c14e','#38bdf8','#e0673f'], { level: 'A2' })
export function setScene(levelOrColors, { level = null } = {}) {
  let colors = null;
  if (Array.isArray(levelOrColors)) colors = levelOrColors;
  else if (typeof levelOrColors === 'string') {
    const key = levelOrColors.trim();
    colors = SCENES[key] || null;
    if (LEVELS.includes(key)) level = key;
  }
  if (level && LEVELS.includes(level)) html.dataset.level = level;
  else if (level === false) delete html.dataset.level;
  if (colors) colors.slice(0, 3).forEach((c, i) => html.style.setProperty(`--orb-${i + 1}`, c));
  return colors;
}

// ---------- aurora + shared scroll loop ----------
let auroraEl = null;
const parallaxItems = new Set();
let scrollRaf = 0;
let scrollBound = false;

function onScrollFrame() {
  scrollRaf = 0;
  const y = window.scrollY || html.scrollTop || 0;
  const bar = doc.getElementById('topbar');
  if (bar) bar.classList.toggle('scrolled', y > 8);
  if (reducedMotion()) return;
  if (auroraEl) auroraEl.style.setProperty('--py', `${(-y * 0.08).toFixed(1)}px`);
  for (const { el, factor } of parallaxItems) {
    if (!el.isConnected) { parallaxItems.delete(el); continue; }
    el.style.transform = `translate3d(0, ${(-y * factor).toFixed(1)}px, 0)`;
  }
}
function bindScroll() {
  if (scrollBound) return;
  scrollBound = true;
  window.addEventListener('scroll', () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(onScrollFrame); }, { passive: true });
  doc.addEventListener('visibilitychange', () => html.classList.toggle('paused', doc.hidden));
  onScrollFrame();
}

const GRAIN = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .9 0"/></filter><rect width="200" height="200" filter="url(#n)"/></svg>');

// Creates (or adopts) <div class="aurora"><div class="orb"></div>×3<div class="grain"></div></div> before #view.
export function mountAurora() {
  let a = doc.querySelector('.aurora');
  if (!a) {
    a = doc.createElement('div'); a.className = 'aurora';
    const view = doc.getElementById('view');
    if (view && view.parentNode) view.parentNode.insertBefore(a, view); else doc.body.prepend(a);
  }
  a.setAttribute('aria-hidden', 'true');
  while (a.querySelectorAll('.orb').length < 3) { const o = doc.createElement('div'); o.className = 'orb'; a.append(o); }
  let g = a.querySelector('.grain');
  if (!g) { g = doc.createElement('div'); g.className = 'grain'; a.append(g); }
  if (!g.style.backgroundImage) g.style.backgroundImage = `url("${GRAIN}")`;
  auroraEl = a;
  bindScroll();
  return a;
}

// parallax(el, 0.15) → unregister fn. Uses the single shared rAF scroll listener.
export function parallax(el, factor = 0.15) {
  if (!el) return noop;
  const item = { el, factor };
  parallaxItems.add(item);
  bindScroll();
  onScrollFrame();
  return () => { parallaxItems.delete(item); el.style.transform = ''; };
}

// mount(rootEl) → adds .mount + --i to direct children so CSS staggers their rise-in.
export function mount(rootEl, { stagger = 50, selector = null } = {}) {
  if (!rootEl) return rootEl;
  const kids = selector ? [...rootEl.querySelectorAll(selector)] : [...rootEl.children];
  kids.forEach((k, i) => {
    if (k.classList.contains('no-mount')) return;
    k.classList.remove('mount');
    void k.offsetWidth; // restart the animation if already mounted
    k.style.setProperty('--i', String(i));
    if (stagger !== 50) k.style.setProperty('--stagger', `${stagger}ms`);
    k.classList.add('mount');
  });
  return rootEl;
}

// ---------- rotary dial ----------
// dial(el, { items:[{key,label,sub}], index, onChange(i, item) }) → { select(i), destroy(), index }
export function dial(el, { items = [], index = 0, onChange = null, step = 30, radius = 280 } = {}) {
  if (!el) return { select: noop, destroy: noop, get index() { return 0; } };
  el.classList.add('dial');
  el.setAttribute('role', 'listbox');
  el.tabIndex = 0;
  el.innerHTML = `<div class="dial-arc" aria-hidden="true"></div><div class="dial-notch" aria-hidden="true"></div><div class="dial-items"></div>`;
  const wrap = el.querySelector('.dial-items');
  const els = items.map((it, i) => {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'dial-item'; b.dataset.i = String(i);
    if (it.key != null) b.dataset.key = String(it.key);
    b.setAttribute('role', 'option');
    b.innerHTML = `<span class="dial-label">${esc(it.label)}</span>${it.sub ? `<span class="dial-sub">${esc(it.sub)}</span>` : ''}`;
    wrap.append(b);
    return b;
  });
  const n = items.length;
  let cur = clamp(index | 0, 0, Math.max(0, n - 1));
  let offset = 0;
  const pxPerStep = Math.max(40, radius * Math.sin(step * Math.PI / 180));

  function layout() {
    const pos = cur + offset;
    els.forEach((b, i) => {
      const d = i - pos;
      const a = d * step;
      const rad = a * Math.PI / 180;
      const x = Math.sin(rad) * radius;
      const y = (1 - Math.cos(rad)) * radius;
      const dist = Math.abs(d);
      // neighbours shrink to .8 (still ≥ 40px tall) and fade out completely by two steps away
      const s = Math.max(.5, 1 - dist * .2);
      const o = Math.max(0, 1 - Math.max(0, dist - .2) * .6);
      b.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px) rotate(${(a * .6).toFixed(1)}deg) scale(${s.toFixed(3)})`;
      b.style.opacity = o.toFixed(2);
      b.style.pointerEvents = o < .1 ? 'none' : '';
      const on = i === cur && Math.abs(offset) < .01;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  function select(i, { silent = false } = {}) {
    const next = clamp(i | 0, 0, Math.max(0, n - 1));
    const changed = next !== cur;
    cur = next; offset = 0;
    layout();
    if (changed && !silent && onChange) onChange(cur, items[cur]);
    return cur;
  }

  // pointer drag / swipe (horizontal); vertical page scrolling stays native thanks to touch-action: pan-y
  let startX = 0, startCur = 0, moved = false, pid = null, lastX = 0, lastT = 0, vel = 0;
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pid = e.pointerId; startX = lastX = e.clientX; startCur = cur; moved = false; vel = 0; lastT = performance.now();
    el.classList.add('dragging');
    try { el.setPointerCapture(pid); } catch { /* ignore */ }
  };
  const move = (e) => {
    if (pid === null || e.pointerId !== pid) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 6) moved = true;
    const now = performance.now();
    vel = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
    offset = clamp(-(dx / pxPerStep), -startCur - .35, (n - 1 - startCur) + .35);
    cur = startCur;
    layout();
  };
  const up = (e) => {
    if (pid === null || e.pointerId !== pid) return;
    pid = null;
    el.classList.remove('dragging');
    if (!moved) { offset = 0; layout(); return; }
    const fling = Math.abs(vel) > .5 ? -Math.sign(vel) * Math.min(5, Math.round(Math.abs(vel) * 3)) : 0;
    const target = Math.round(startCur + offset + fling * (Math.abs(offset) > .15 ? 1 : 0));
    offset = 0;
    select(target);
  };
  const click = (e) => {
    const b = e.target.closest('.dial-item'); if (!b || moved) { moved = false; return; }
    select(Number(b.dataset.i));
  };
  const key = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select(cur - 1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select(cur + 1); }
    else if (e.key === 'Home') { e.preventDefault(); select(0); }
    else if (e.key === 'End') { e.preventDefault(); select(n - 1); }
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('click', click);
  el.addEventListener('keydown', key);
  layout();
  return {
    select,
    get index() { return cur; },
    destroy() {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.removeEventListener('click', click); el.removeEventListener('keydown', key);
      el.innerHTML = ''; el.classList.remove('dial', 'dragging');
    },
  };
}

// ---------- card fan ----------
// fan(el, [{front, back, tint, key}], { onFlip(i, flipped, card), onAllFlipped() }) → { flipAll(), spread(bool), destroy(), cards }
export function fan(el, cards = [], { onFlip = null, onAllFlipped = null, spread: startSpread = false } = {}) {
  if (!el) return { flipAll: noop, spread: noop, destroy: noop, cards: [] };
  el.classList.add('fan');
  el.innerHTML = '';
  const n = cards.length;
  const els = cards.map((c, i) => {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'fan-card'; b.dataset.i = String(i);
    if (c.key != null) b.dataset.key = String(c.key);
    if (c.tint) b.style.setProperty('--tint', c.tint);
    b.innerHTML = `<span class="flip"><span class="face front">${c.front ?? ''}</span><span class="face back">${c.back ?? ''}</span></span>`;
    el.append(b);
    return b;
  });
  const seen = new Set();
  let isSpread = !!startSpread;
  let lifted = -1;
  let allFired = false;

  function layout() {
    const mid = (n - 1) / 2;
    const w = el.clientWidth || 340;
    const cols = n <= 4 ? 2 : 3;
    const gap = 12;
    const cw = Math.min(124, Math.floor((w - gap * (cols - 1)) / cols));
    const ch = Math.round(cw * 1.42);
    el.style.setProperty('--fw', `${cw}px`);
    el.style.setProperty('--fh', `${ch}px`);
    const rows = Math.ceil(n / cols);
    el.classList.toggle('spread', isSpread);
    el.style.height = isSpread ? `${rows * ch + (rows - 1) * gap + 16}px` : `${ch + 90}px`;
    els.forEach((b, i) => {
      const lift = i === lifted ? -18 : 0;
      if (isSpread) {
        const r = Math.floor(i / cols), c = i % cols;
        const gridW = cols * cw + (cols - 1) * gap;
        const x = -gridW / 2 + c * (cw + gap);
        const y = r * (ch + gap) + 8 + lift;
        b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        b.style.zIndex = i === lifted ? 20 : 1;
      } else {
        const rot = n > 1 ? ((i - mid) / (n - 1)) * 52 : 0;
        const dy = Math.pow(Math.abs(i - mid), 2) * 6 + 12 + lift;
        b.style.transform = `translate(-50%, 0) rotate(${rot.toFixed(2)}deg) translateY(${dy.toFixed(1)}px)`;
        b.style.zIndex = i === lifted ? 20 : 1 + i;
      }
    });
  }
  const click = (e) => {
    const b = e.target.closest('.fan-card'); if (!b) return;
    const i = Number(b.dataset.i);
    const flipped = b.classList.toggle('flipped');
    b.classList.toggle('lift', true);
    els.forEach((x) => { if (x !== b) x.classList.remove('lift'); });
    lifted = i;
    layout();
    if (flipped) seen.add(i);
    onFlip && onFlip(i, flipped, cards[i]);
    if (!allFired && seen.size === n && n > 0) { allFired = true; onAllFlipped && onAllFlipped(); }
  };
  el.addEventListener('click', click);
  let ro = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(() => layout()); ro.observe(el); }
  layout();
  return {
    cards: els,
    flipAll(toBack = null) {
      const target = toBack == null ? !els.every(b => b.classList.contains('flipped')) : !!toBack;
      els.forEach((b, i) => { b.classList.toggle('flipped', target); if (target) seen.add(i); });
      if (target && !allFired && n > 0) { allFired = true; onAllFlipped && onAllFlipped(); }
    },
    spread(on = null) { isSpread = on == null ? !isSpread : !!on; layout(); return isSpread; },
    layout,
    destroy() { el.removeEventListener('click', click); ro && ro.disconnect(); el.innerHTML = ''; el.style.height = ''; el.classList.remove('fan', 'spread'); },
  };
}

// ---------- reel ----------
// reel(el) → marks the poster nearest the centre .active, tilts neighbours. Returns { update(), scrollTo(i), destroy() }.
export function reel(el) {
  if (!el) return { update: noop, scrollTo: noop, destroy: noop };
  el.classList.add('reel');
  let raf = 0;
  function update() {
    raf = 0;
    const posters = el.querySelectorAll('.poster');
    if (!posters.length) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    let best = null, bestD = Infinity;
    posters.forEach((p) => {
      const r = p.getBoundingClientRect();
      const d = (r.left + r.width / 2) - cx;
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = p; }
      p.style.setProperty('--ry', `${clamp(-d / 24, -12, 12).toFixed(1)}deg`);
    });
    posters.forEach(p => p.classList.toggle('active', p === best));
  }
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  el.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  requestAnimationFrame(update);
  setTimeout(update, 120);
  return {
    update,
    scrollTo(i, smooth = true) {
      const p = el.querySelectorAll('.poster')[i]; if (!p) return;
      const left = p.offsetLeft - (el.clientWidth - p.offsetWidth) / 2;
      el.scrollTo({ left, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
    },
    destroy() { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); },
  };
}

// ---------- glass dropdown ----------
// dropdown(anchorEl, contentHTML | [{value,label,sub,selected}], { onSelect(value, el), align:'start'|'end', width }) → { close(), el }
let openDropdown = null;
export function dropdown(anchorEl, content, { onSelect = null, align = 'start', width = null, onClose = null } = {}) {
  if (!anchorEl) return { close: noop, el: null };
  if (openDropdown) openDropdown.close();
  const layer = doc.createElement('div');
  layer.className = 'dropdown-layer';
  const panel = doc.createElement('div');
  panel.className = 'dropdown glass-strong';
  panel.setAttribute('role', 'menu');
  if (Array.isArray(content)) {
    panel.innerHTML = `<div class="dropdown-list">${content.map(o => `<button type="button" class="opt${o.selected ? ' on' : ''}" role="menuitemradio" aria-checked="${o.selected ? 'true' : 'false'}" data-value="${esc(o.value)}"><span class="opt-main"><span class="opt-label">${esc(o.label)}</span>${o.sub ? `<span class="opt-sub">${esc(o.sub)}</span>` : ''}</span><svg class="ic ic-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button>`).join('')}</div>`;
  } else panel.innerHTML = String(content ?? '');
  const backdrop = doc.createElement('div');
  backdrop.className = 'dropdown-backdrop';
  layer.append(backdrop, panel);
  doc.body.append(layer);
  anchorEl.setAttribute('aria-expanded', 'true');

  function place() {
    const r = anchorEl.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(width || Math.max(220, r.width), vw - 24);
    panel.style.width = `${w}px`;
    const ph = panel.offsetHeight;
    let left = align === 'end' ? r.right - w : r.left;
    left = clamp(left, 12, vw - w - 12);
    const below = r.bottom + 8 + ph <= vh - 12;
    const top = below ? r.bottom + 8 : Math.max(12, r.top - 8 - ph);
    panel.classList.toggle('up', !below);
    panel.style.left = `${left}px`; panel.style.top = `${top}px`;
    panel.style.setProperty('--ox', `${clamp(r.left + r.width / 2 - left, 16, w - 16)}px`);
  }
  place();
  requestAnimationFrame(() => { place(); panel.classList.add('open'); });

  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    panel.classList.remove('open');
    anchorEl.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', close, true);
    if (openDropdown === api) openDropdown = null;
    setTimeout(() => layer.remove(), reducedMotion() ? 0 : 200);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', close);
  panel.addEventListener('click', (e) => {
    const o = e.target.closest('[data-value]'); if (!o) return;
    const keep = onSelect && onSelect(o.dataset.value, o) === false;
    if (!keep) close();
  });
  doc.addEventListener('keydown', onKey);
  window.addEventListener('resize', place);
  setTimeout(() => window.addEventListener('scroll', close, true), 50);
  const api = { close, el: panel };
  openDropdown = api;
  return api;
}

// ---------- confetti ----------
// confetti(colors, { duration: 900, count, origin: {x:.5, y:.45} }) → cancel fn. Canvas overlay that removes itself.
export function confetti(colors = ['#f2c14e', '#38bdf8', '#e0673f', '#2dd4bf'], { duration = 900, count = 110, origin = { x: .5, y: .45 } } = {}) {
  if (reducedMotion() || !doc.body) return noop;
  const c = doc.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  c.style.cssText = `position:fixed;inset:0;width:${W}px;height:${H}px;z-index:300;pointer-events:none;`;
  doc.body.append(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const cols = colors && colors.length ? colors : ['#f2c14e'];
  const ps = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 11;
    return { x: W * origin.x, y: H * origin.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6, r: 3 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3, col: cols[Math.floor(Math.random() * cols.length)], shape: Math.random() < .3 ? 'c' : 'r' };
  });
  const t0 = performance.now();
  let done = false, raf = 0;
  const fadeMs = 300;
  function frame(t) {
    const el = t - t0;
    ctx.clearRect(0, 0, W, H);
    const alpha = el > duration ? Math.max(0, 1 - (el - duration) / fadeMs) : 1;
    ctx.globalAlpha = alpha;
    for (const p of ps) {
      p.vy += .32; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
      if (p.shape === 'c') { ctx.beginPath(); ctx.arc(0, 0, p.r * .6, 0, 6.283); ctx.fill(); }
      else ctx.fillRect(-p.r, -p.r * .5, p.r * 2, p.r);
      ctx.restore();
    }
    if (el < duration + fadeMs && !done) raf = requestAnimationFrame(frame);
    else { done = true; c.remove(); }
  }
  raf = requestAnimationFrame(frame);
  return () => { done = true; cancelAnimationFrame(raf); c.remove(); };
}

// ---------- stamp ----------
// stamp(el, 'IMPARATO', 'ok'|'ko'|'info') → the injected .stamp element (replaces a previous one in el).
export function stamp(el, text, kind = 'ok') {
  if (!el) return null;
  el.querySelector(':scope > .stamp')?.remove();
  const s = doc.createElement('div');
  s.className = `stamp ${kind || ''}`.trim();
  s.setAttribute('role', 'status');
  s.textContent = text;
  el.append(s);
  return s;
}

// ---------- typewriter ----------
// typewriter(el, 'Vado al mare domani.', { msPerWord: 60 }) → Promise<void>; words appear one by one in .tw-word spans.
export function typewriter(el, text, { msPerWord = 60, keep = false } = {}) {
  if (!el) return Promise.resolve();
  const words = String(text ?? '').split(/(\s+)/).filter(s => s.length);
  if (!keep) el.innerHTML = '';
  el.classList.add('tw');
  if (reducedMotion() || msPerWord <= 0) { el.append(doc.createTextNode(words.join(''))); return Promise.resolve(); }
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      if (!el.isConnected) return resolve();
      const w = words[i++];
      if (w == null) return resolve();
      if (/^\s+$/.test(w)) { el.append(doc.createTextNode(w)); tick(); return; }
      const span = doc.createElement('span'); span.className = 'tw-word'; span.textContent = w; el.append(span);
      setTimeout(tick, msPerWord);
    };
    tick();
  });
}

// ---------- rising letters ----------
// riseLetters(el) → wraps each character of el's text in <span style="--i"> and adds .rise (30ms stagger via CSS).
export function riseLetters(el) {
  if (!el) return el;
  const text = el.textContent || '';
  el.textContent = '';
  el.classList.remove('rise'); void el.offsetWidth;
  let i = 0;
  for (const ch of text) {
    const s = doc.createElement('span');
    if (/\s/.test(ch)) { s.className = 'sp'; s.innerHTML = '&nbsp;'; }
    else { s.textContent = ch; s.style.setProperty('--i', String(i++)); }
    el.append(s);
  }
  el.classList.add('rise');
  return el;
}

// ---------- orbit ----------
// orbit(el, { rings:[{key,label,learned,total,color}], current:'A1', center:{value, label} }) → { update(data) }
export function orbit(el, { rings = [], current = null, center = null, onSelect = null } = {}) {
  if (!el) return { update: noop };
  el.classList.add('orbit');
  const R = 150, cx = R, cy = R;
  function draw({ rings: rs = rings, current: cur = current, center: ce = center } = {}) {
    const n = rs.length || 1;
    const gapR = (R - 44) / n;
    const circles = rs.map((r, i) => {
      const rad = R - 10 - i * gapR;
      const circ = 2 * Math.PI * rad;
      const p = r.total ? Math.min(1, (r.learned || 0) / r.total) : 0;
      const col = r.color || `var(--lvl-${r.key})`;
      const isCur = r.key === cur;
      return `<g class="ring${isCur ? ' cur' : ''}" data-key="${esc(r.key)}" style="--c:${col}">
        <circle class="track" cx="${cx}" cy="${cy}" r="${rad.toFixed(1)}"/>
        <circle class="fill" cx="${cx}" cy="${cy}" r="${rad.toFixed(1)}" stroke-dasharray="${(circ * p).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" style="--i:${i}"/>
        <circle class="hit" cx="${cx}" cy="${cy}" r="${rad.toFixed(1)}"/>
        <text class="lab" x="${(cx + 6).toFixed(1)}" y="${(cy - rad + 4).toFixed(1)}">${esc(r.label || r.key)}</text>
      </g>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${2 * R} ${2 * R}" aria-hidden="true">${circles}</svg>
      <div class="center">${ce ? `<div class="xp">${esc(ce.value)}</div><div class="lab">${esc(ce.label || '')}</div>` : ''}</div>`;
  }
  draw();
  if (onSelect) el.addEventListener('click', (e) => { const g = e.target.closest('.ring'); if (g) onSelect(g.dataset.key); });
  return { update: draw };
}

// ---------- ticker ----------
// ticker(el, ['casa', 'andare', …]) → fills a marquee; returns { update(items) }.
export function ticker(el, items = []) {
  if (!el) return { update: noop };
  el.classList.add('ticker');
  el.setAttribute('aria-hidden', 'true');
  function fill(list) {
    const seq = (list && list.length ? list : ['parola']).map(w => `<span>${esc(w)}</span>`).join('<i>·</i>');
    el.innerHTML = `<div class="track">${seq}<i>·</i>${seq}<i>·</i></div>`;
  }
  fill(items);
  return { update: fill };
}

// ---------- count-up ----------
// countUp(el, 87, { duration: 900, suffix: '%' }) → Promise<void>
export function countUp(el, to, { from = 0, duration = 900, suffix = '', decimals = 0 } = {}) {
  if (!el) return Promise.resolve();
  const fmt = (v) => v.toFixed(decimals) + suffix;
  if (reducedMotion()) { el.textContent = fmt(to); return Promise.resolve(); }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (t) => {
      const k = clamp((t - t0) / duration, 0, 1);
      el.textContent = fmt(from + (to - from) * ease(k));
      if (k < 1 && el.isConnected) requestAnimationFrame(tick); else { el.textContent = fmt(to); resolve(); }
    };
    requestAnimationFrame(tick);
  });
}

// ---------- small helpers ----------
export function sheen(btn) { if (!btn) return; btn.classList.remove('sheen'); void btn.offsetWidth; btn.classList.add('sheen'); }
export function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
export function pulse(el) { if (!el) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

// Accordions: <div class="acc"><button class="acc-head">…</button><div class="acc-body"><div class="acc-inner">…</div></div></div>
doc.addEventListener('click', (e) => {
  const head = e.target.closest('.acc > .acc-head');
  if (!head) return;
  const acc = head.parentElement;
  const open = acc.classList.toggle('open');
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
});

export default { mountAurora, setScene, SCENES, dial, fan, reel, dropdown, confetti, stamp, typewriter, riseLetters, parallax, mount, orbit, ticker, countUp, sheen, shake, pulse, reducedMotion };
