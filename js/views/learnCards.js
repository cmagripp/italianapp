// Learn hub cards: the tilted poster reel of the Play page (fx.reel mechanics, same 200×280 posters) restyled as glass
// cards on the theme tokens with a level-tinted wash and top hairline. Every card shares one inner layout so nothing
// clips: kicker top-left, level chip top-right, an optional icon / progress ring / speaker in the middle, then the
// Italian serif headline (2 lines), the English line (1 line) and one mono detail line at the bottom.
//
//   learnReel(container, cards, { kind, ariaLabel, onSelect }) → { update(cards?), scrollTo(i, smooth?), destroy(), el, cards }
//   learnCardHTML(card, { kind }) → '<a class="poster lc …">' (href) | '<button class="poster lc …">' (no href)
//
// card: { key, kicker, title, en, detail, level?, accent?, icon?, href?, ring? (0-100), say?, tags? [strings] }
//   level  'A1'…'C2' → the wash, hairline and chip use var(--lvl-<level>); accent (any CSS colour) overrides the wash.
//   icon   a js/icons.js name, drawn in the middle (inside the ring when there is one).
//   ring   0–100: a small progress ring; the percentage is printed inside it when there is no icon.
//   say    Italian text for the speaker button (tap reads it aloud without following the link).
//   tags   printed as the detail line when `detail` is empty, and passed as data-tags.
//   Any other primitive field is passed through as a data-attribute (data-<kebab-name>).
// opts.kind: 'next' | 'lab' | 'verb' | 'word' (class lc-<kind> and a default accent when a card has no level/accent).
import { html, raw, esc, icon, levelBadge, speak } from '../ui.js';
import { reel, reducedMotion } from '../fx.js';

const KNOWN = new Set(['key', 'kicker', 'title', 'en', 'detail', 'level', 'accent', 'icon', 'href', 'ring', 'say', 'tags', 'onSelect']);
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const KIND_ACCENT = { next: 'var(--lvl-current)', lab: 'var(--gold)', verb: 'var(--terracotta)', word: 'var(--amalfi)' };
const KINDS = Object.keys(KIND_ACCENT);

// a colour that is safe inside a style attribute: tokens, hex, rgb()/hsl()/color-mix() — never a second declaration
const safeColor = (c) => { const s = String(c ?? '').trim(); return s && /^[\w#(),.%\s/-]+$/.test(s) ? s : ''; };
const kebab = (k) => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()).replace(/[^a-z0-9-]/g, '');
// the headline shrinks with its length so two lines always hold it (28px fits ~14 chars a line on a 200px poster)
const titleSize = (t) => { const n = String(t ?? '').length; return n <= 16 ? 28 : n <= 24 ? 25 : n <= 34 ? 22 : 19; };
// the English line is one line: it steps down from 14px so ~36 characters still fit the 168px poster
const enSize = (t) => { const n = String(t ?? '').length; return n <= 20 ? 14 : n <= 27 ? 13 : n <= 33 ? 12 : 11; };

function ringHTML(p, iconName) {
  const r = 15.5, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
  const inner = iconName ? icon(iconName, { size: 16 }) : `<span class="lc-pct">${pct}%</span>`;
  return `<span class="lc-ring" role="img" aria-label="${pct}% done"><svg class="lc-ring-svg" viewBox="0 0 36 36" aria-hidden="true"><circle class="t" cx="18" cy="18" r="${r}"/><circle class="f" cx="18" cy="18" r="${r}" stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/></svg>${inner}</span>`;
}

// learnCardHTML(card, { kind }) → one card. Standalone it fills its container (In corso); inside a .lc-reel it is a poster.
export function learnCardHTML(card = {}, { kind = 'next' } = {}) {
  const k = KINDS.includes(kind) ? kind : 'next';
  const level = LEVELS.includes(card.level) ? card.level : null;
  const accent = safeColor(card.accent) || (level ? `var(--lvl-${level})` : KIND_ACCENT[k]);
  const ico = card.icon && icon(card.icon, { size: 18 }) ? String(card.icon) : null;
  const hasRing = card.ring != null && card.ring !== false && card.ring !== '';
  const tags = Array.isArray(card.tags) ? card.tags.map(t => String(t)).filter(Boolean) : [];
  const detail = card.detail != null && card.detail !== '' ? String(card.detail) : tags.join(' · ');
  const say = card.say != null && card.say !== '' ? String(card.say) : '';
  const title = String(card.title ?? '');
  const en = card.en != null ? String(card.en) : '';

  const attrs = [`class="poster lc lc-${k}${level ? ` lc-lvl-${level}` : ''}"`, `style="--lc:${esc(accent)};--ts:${titleSize(title)}px;--es:${enSize(en)}px"`];
  if (card.key != null) attrs.push(`data-key="${esc(card.key)}"`);
  attrs.push(`data-kind="${k}"`);
  if (level) attrs.push(`data-level="${level}"`);
  if (tags.length) attrs.push(`data-tags="${esc(tags.join(' '))}"`);
  for (const [name, v] of Object.entries(card)) {
    if (KNOWN.has(name) || v == null || (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')) continue;
    const dn = kebab(name); if (dn) attrs.push(`data-${dn}="${esc(v)}"`);
  }
  const label = `${card.kicker ? `${card.kicker}: ` : ''}${title}${en ? `, ${en}` : ''}`;
  attrs.push(`aria-label="${esc(label)}"`);

  const mid = (ico || hasRing || say) ? `<span class="lc-mid">
      ${hasRing ? ringHTML(card.ring, ico) : ico ? `<span class="lc-icon" aria-hidden="true">${icon(ico, { size: 18 })}</span>` : '<span></span>'}
      ${say ? `<span class="speak sm lc-say" role="button" tabindex="0" data-say="${esc(say)}" aria-label="Listen: ${esc(say)}">${icon('speaker')}</span>` : ''}
    </span>` : '<span class="lc-mid"></span>';
  const inner = html`<span class="lc-top"><span class="lc-kicker">${card.kicker ?? ''}</span>${level ? raw(levelBadge(level)) : ''}</span>
    ${raw(mid)}
    <span class="lc-body"><span class="lc-title">${title}</span><span class="lc-en">${en}</span><span class="lc-detail">${detail}</span></span>`;
  const a = attrs.join(' ');
  return card.href
    ? `<a ${a} href="${esc(card.href)}">${inner}</a>`
    : `<button type="button" ${a}>${inner}</button>`;
}

// learnReel(container, cards, opts) → the Play-page reel (fx.reel) filled with learn cards.
export function learnReel(container, cards = [], { kind = 'next', ariaLabel = '', onSelect = null } = {}) {
  const noop = () => {};
  if (!container) return { update: noop, scrollTo: noop, destroy: noop, el: null, cards: [] };
  const k = KINDS.includes(kind) ? kind : 'next';
  let list = Array.isArray(cards) ? cards.slice() : [];
  container.classList.add('reel', 'lc-reel', `lc-reel-${k}`);
  if (reducedMotion()) container.classList.add('lc-still');
  container.setAttribute('role', 'group');
  if (ariaLabel) container.setAttribute('aria-label', ariaLabel);
  const render = () => { container.innerHTML = list.map(c => learnCardHTML(c, { kind: k })).join(''); };
  render();
  const api = reel(container);

  const onClick = (ev) => {
    if (ev.target.closest('[data-say]')) return; // ui.js reads it aloud and stops the event
    const el = ev.target.closest('button.lc'); if (!el || !container.contains(el)) return;
    const i = [...container.querySelectorAll('.lc')].indexOf(el);
    const card = list[i];
    const fn = (card && typeof card.onSelect === 'function') ? card.onSelect : onSelect;
    if (fn && card) fn(card, i, el);
  };
  const onKey = (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const s = ev.target.closest && ev.target.closest('.lc-say'); if (!s) return;
    ev.preventDefault(); ev.stopPropagation();
    speak(s.dataset.say, { force: true, button: s });
  };
  container.addEventListener('click', onClick);
  container.addEventListener('keydown', onKey);

  return {
    el: container,
    get cards() { return list; },
    update(next) {
      if (Array.isArray(next)) { list = next.slice(); render(); }
      api.update();
    },
    scrollTo(i, smooth = true) { api.scrollTo(i, smooth); },
    destroy() {
      api.destroy();
      container.removeEventListener('click', onClick);
      container.removeEventListener('keydown', onKey);
      container.innerHTML = '';
      container.classList.remove('reel', 'lc-reel', `lc-reel-${k}`, 'lc-still');
    },
  };
}

export default { learnReel, learnCardHTML };
