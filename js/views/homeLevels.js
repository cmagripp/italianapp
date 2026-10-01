// Home "level ribbon": one slim glass row of six small progress rings (A1 → C2) that replaces the orbit pane.
// levelRibbonHTML({ current, rings }) renders it; bindLevelRibbon(el, { onSelect, current }) wires taps and arrow keys
// and returns update() (patches arcs, highlight and caption in place, springing the newly chosen ring) + destroy().
// The rings share the orbit's data shape: [{ key: 'A1'…'C2', label, learned, total, color }]. Tapping a ring only
// reports the level through onSelect; the caller (home.js) owns the store, the scene and the rest of the screen.
import { html, raw } from '../ui.js';
import { LEVELS, LEVEL_INFO } from '../data.js';
import { reducedMotion } from '../fx.js';

const noop = () => {};
const R = 17.5;                 // ring radius in the 40 × 40 viewBox (2.5 px stroke → the arc's outer edge sits at 18.75)
const CORE = 13.5;              // the disc that fills with the level colour on the current ring
const CIRC = 2 * Math.PI * R;   // ≈ 109.96

const share = (r) => r && r.total ? Math.max(0, Math.min(1, (r.learned || 0) / r.total)) : 0;
const dash = (p) => `${(CIRC * p).toFixed(2)} ${CIRC.toFixed(2)}`;
const colorOf = (r) => r.color || `var(--lvl-${r.key})`;
const nameOf = (key) => (LEVEL_INFO[key] && LEVEL_INFO[key].name) || String(key || '');
const labelOf = (r) => `${r.key} · ${nameOf(r.key)} · ${r.learned || 0} of ${r.total || 0} learned`;
const defaultRings = () => LEVELS.map(L => ({ key: L, label: L, learned: 0, total: 0 }));
const pickCurrent = (current, rings) => (rings.some(r => r.key === current) ? current : (rings[0] && rings[0].key) || null);
// "Beginner · 12 / 400 learned": the count phrase never breaks, so a long name wraps the line before it, whole
const captionHTML = (current, rings) => {
  const r = rings.find(x => x.key === current) || { learned: 0, total: 0 };
  return html`<span class="lvl-ribbon-name">${nameOf(current)}</span> · <span class="lvl-ribbon-count">${r.learned || 0} / ${r.total || 0} learned</span>`;
};

function ringHTML(r, i, current) {
  const p = share(r);
  const cur = r.key === current;
  return html`<button type="button" class="lvl-ring${cur ? ' cur' : ''}" data-level="${r.key}" aria-pressed="${cur ? 'true' : 'false'}" tabindex="${cur ? '0' : '-1'}" aria-label="${labelOf(r)}" style="--c:${colorOf(r)};--i:${i}">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle class="lvl-ring-track" cx="20" cy="20" r="${R}"/>
        <circle class="lvl-ring-core" cx="20" cy="20" r="${CORE}"/>
        <circle class="lvl-ring-arc${p ? '' : ' empty'}" cx="20" cy="20" r="${R}" transform="rotate(-90 20 20)" style="stroke-dasharray:${dash(p)}"/>
      </svg>
      <span class="lvl-ring-lab">${r.label || r.key}</span>
    </button>`;
}

// the ribbon's contents: the row of rings, then the caption line (the Browse link lives in the section head)
function innerHTML(cur, rs) {
  return html`<div class="lvl-ribbon-row">${raw(rs.map((r, i) => ringHTML(r, i, cur)).join(''))}</div>
    <div class="lvl-ribbon-cap mono">
      <span class="lvl-ribbon-caption" data-ribbon-caption>${raw(captionHTML(cur, rs))}</span>
    </div>`;
}

// levelRibbonHTML({ current: 'A1', rings }) → HTML string: <div class="lvl-ribbon glass" data-level-ribbon>…</div>
export function levelRibbonHTML({ current = null, rings = null } = {}) {
  const rs = rings && rings.length ? rings : defaultRings();
  const cur = pickCurrent(current, rs);
  return html`<div class="lvl-ribbon glass" data-level-ribbon role="group" aria-label="Your level">${raw(innerHTML(cur, rs))}</div>`;
}

// bindLevelRibbon(el, { onSelect(level, button), current, rings }) → { update({ current, rings }), destroy(), current }
// `el` is the ribbon itself or an ancestor of it; when it holds no ribbon yet and `rings` is given, one is rendered into it.
export function bindLevelRibbon(el, { onSelect = null, current = null, rings = null } = {}) {
  if (!el) return { update: noop, destroy: noop, get current() { return null; } };
  let root = el.matches && el.matches('[data-level-ribbon]') ? el : el.querySelector('[data-level-ribbon]');
  if (!root && rings) { el.insertAdjacentHTML('beforeend', levelRibbonHTML({ current, rings })); root = el.querySelector('[data-level-ribbon]'); }
  if (!root) return { update: noop, destroy: noop, get current() { return null; } };

  const buttons = () => [...root.querySelectorAll('button[data-level]')];
  let lastRings = rings && rings.length ? rings.slice() : buttons().map(b => ({ key: b.dataset.level, label: b.dataset.level, learned: 0, total: 0 }));
  let cur = current || (root.querySelector('button[data-level][aria-pressed="true"]') || {}).dataset?.level || null;

  const onClick = (e) => {
    const b = e.target.closest('button[data-level]');
    if (!b || !root.contains(b)) return;
    e.preventDefault();
    onSelect && onSelect(b.dataset.level, b);
  };
  // Arrow keys (and Home/End) move between the rings; Enter/Space are the button's own click. One ring is in the Tab
  // order at a time (roving tabindex), so the group costs a single Tab stop.
  const onKey = (e) => {
    const b = e.target && e.target.closest ? e.target.closest('button[data-level]') : null;
    if (!b || !root.contains(b)) return;
    const bs = buttons(); const i = bs.indexOf(b); if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(bs.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = bs.length - 1;
    if (j == null) return;
    e.preventDefault();
    bs.forEach((x, k) => { x.tabIndex = k === j ? 0 : -1; });
    try { bs[j].focus({ preventScroll: true }); } catch { /* ignore */ }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);

  function spring(b) {
    if (!b || reducedMotion()) return;
    buttons().forEach(x => x.classList.remove('spring'));
    void b.offsetWidth; // restart the animation when the same ring is chosen again later
    b.classList.add('spring');
  }
  function patchCaption(rs) {
    const cap = root.querySelector('[data-ribbon-caption]'); if (cap) cap.innerHTML = captionHTML(cur, rs);
  }
  function update({ current: next = cur, rings: rs = lastRings } = {}) {
    rs = rs && rs.length ? rs : lastRings;
    const prev = cur;
    cur = pickCurrent(next, rs);
    lastRings = rs.slice();
    const bs = buttons();
    const sameSet = bs.length === rs.length && bs.every((b, i) => b.dataset.level === rs[i].key);
    if (!sameSet) {
      // a different set of levels: rebuild, and give the keyboard its place back if it was inside the ribbon
      const hadFocus = root.contains(document.activeElement);
      root.innerHTML = innerHTML(cur, rs);
      if (hadFocus) { const b = root.querySelector('button[data-level].cur'); if (b) { try { b.focus({ preventScroll: true }); } catch { /* ignore */ } } }
      return;
    }
    // Patch in place: focus stays where it is, the arcs transition to their new length and only the chosen ring springs.
    const focusInside = root.contains(document.activeElement);
    bs.forEach((b, i) => {
      const r = rs[i];
      const p = share(r);
      const on = r.key === cur;
      b.style.setProperty('--c', colorOf(r));
      b.setAttribute('aria-label', labelOf(r));
      b.classList.toggle('cur', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (!focusInside || on) b.tabIndex = on ? 0 : -1; // while a ring has focus, leave its tabindex alone
      else if (b !== document.activeElement) b.tabIndex = -1;
      const arc = b.querySelector('.lvl-ring-arc');
      if (arc) { arc.style.strokeDasharray = dash(p); arc.classList.toggle('empty', !p); }
      const lab = b.querySelector('.lvl-ring-lab'); if (lab) lab.textContent = r.label || r.key;
    });
    patchCaption(rs);
    if (cur !== prev) spring(bs.find(b => b.dataset.level === cur));
  }
  return {
    update,
    get current() { return cur; },
    destroy() { root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey); },
  };
}

export default { levelRibbonHTML, bindLevelRibbon };
