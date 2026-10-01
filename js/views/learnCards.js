// Learn hub cards: the tilted poster reel of the Play page (fx.reel mechanics, 200×184 posters) restyled as glass cards
// on the theme tokens with a level-tinted wash and top hairline. Every card shares one inner layout so nothing clips:
// kicker top-left, level chip top-right, then one block — the Italian serif headline (2 lines) over the English line
// (1 line) and one mono detail line, with the icon / progress ring at its left (next, lab) or the speaker at its right
// (verb, word), vertically centred on the headline + English pair. The block sits centred under the top row, so a
// one-line headline leaves even air above and below instead of an empty upper half.
//
//   learnReel(container, cards, { kind, ariaLabel, onSelect }) → { update(cards?), scrollTo(i, smooth?), destroy(), el, cards }
//   learnCardHTML(card, { kind }) → '<a class="poster lc …">' (href) | '<button class="poster lc …">' (no href)
//
// card: { key, kicker, title, en, detail, level?, accent?, icon?, href?, ring? (0-100), say?, tags? [strings] }
//   level  'A1'…'C2' → the wash, hairline and chip use var(--lvl-<level>); accent (any CSS colour) overrides the wash.
//   icon   a js/icons.js name, drawn beside the headline (inside the ring when there is one).
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

// ---------- type sizing ----------
// The poster's text column is 168px wide, 124px when an icon, ring or speaker sits beside the headline. The headline
// shrinks with its text so two lines hold it and no word is split: the longest word must fit one line and the whole
// title two (a wrap wastes ~10% of a line). Fraunces runs ~0.42–0.54em per character, so the estimate is conservative
// and the reel re-measures (fitTitles) once the cards are in the DOM and again when the web fonts land.
const SIZES = [28, 25, 22, 19, 17];
const LINE = 1.18;
const FULL_W = 168, NARROW_W = 124;
const EM = { next: 0.48, lab: 0.48, verb: 0.46, word: 0.42 }; // average advance per character, in em, by headline style
function titleSize(t, width, em) {
  const s = String(t ?? '').trim(); if (!s) return SIZES[0];
  const words = s.split(/\s+/);
  const longest = Math.max(...words.map(w => w.length));
  const max = Math.min(width / (longest * em), (1.8 * width) / (s.length * em));
  return SIZES.find(z => z <= max) ?? SIZES[SIZES.length - 1];
}
// the English line is one line (ellipsis after): it steps down from 14px to 11px; italic Fraunces runs ~0.43em a character
const enSize = (t, width) => { const n = String(t ?? '').trim().length; if (!n) return 14; const max = width / (n * 0.43); return [14, 13, 12, 11].find(z => z <= max) ?? 11; };

// Measured fit: with the cards laid out, every headline is set back to its estimated size and stepped down while it
// runs past two lines or breaks a word in two (lines > words). Runs on render and once the web fonts are ready, so a
// fallback font never leaves a wrong size behind.
function fitTitles(container) {
  for (const t of container.querySelectorAll('.lc-title')) {
    const card = t.closest('.lc'); if (!card || !t.clientHeight) continue;
    if (!card.dataset.ts0) card.dataset.ts0 = card.style.getPropertyValue('--ts') || `${SIZES[0]}px`;
    const top = parseFloat(card.dataset.ts0) || SIZES[0];
    const words = (t.textContent.match(/\S+/g) || []).length || 1;
    for (const z of SIZES) {
      if (z > top) continue;
      card.style.setProperty('--ts', `${z}px`);
      const lines = Math.round(t.scrollHeight / (z * LINE));
      if (lines <= 2 && lines <= words) break;
    }
  }
}

function ringHTML(p, iconName) {
  const r = 15.5, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
  const inner = iconName ? icon(iconName, { size: 16 }) : `<span class="lc-pct">${pct}%</span>`;
  return `<span class="lc-ring lc-lead" role="img" aria-label="${pct}% done"><svg class="lc-ring-svg" viewBox="0 0 36 36" aria-hidden="true"><circle class="t" cx="18" cy="18" r="${r}"/><circle class="f" cx="18" cy="18" r="${r}" stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/></svg>${inner}</span>`;
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

  // the lead (ring with the icon inside, or the icon alone) sits left of the text block, the speaker right of it
  const lead = hasRing ? ringHTML(card.ring, ico) : ico ? `<span class="lc-icon lc-lead" aria-hidden="true">${icon(ico, { size: 18 })}</span>` : '';
  const sayBtn = say ? `<span class="speak sm lc-say" role="button" tabindex="0" data-say="${esc(say)}" aria-label="Listen: ${esc(say)}">${icon('speaker')}</span>` : '';
  const width = lead || sayBtn ? NARROW_W : FULL_W;

  const attrs = [`class="poster lc lc-${k}${level ? ` lc-lvl-${level}` : ''}"`, `style="--lc:${esc(accent)};--ts:${titleSize(title, width, EM[k])}px;--es:${enSize(en, width)}px"`];
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

  const inner = html`<span class="lc-top"><span class="lc-kicker">${card.kicker ?? ''}</span>${level ? raw(levelBadge(level)) : ''}</span>
    <span class="lc-main">${raw(lead)}<span class="lc-title">${title}</span><span class="lc-en">${en}</span><span class="lc-detail">${detail}</span>${raw(sayBtn)}</span>`;
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
  const render = () => { container.innerHTML = list.map(c => learnCardHTML(c, { kind: k })).join(''); fitTitles(container); };
  render();
  // the first measure runs on whatever font is in place; the web fonts (when they arrive) get a second one
  try { document.fonts?.ready?.then(() => { if (container.isConnected) fitTitles(container); }); } catch { /* no Font Loading API */ }
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
