// Games hub: two poster reels (vocabulary / verbs), a "play with what you know" hero, and the source picker sheet.
import { html, raw, esc, sheet, secHead, icon, tr } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { GAMES, TENSE_OPTIONS } from '../games/index.js';
import { TENSE_BY_KEY } from '../conjugator.js';
import { sourceChoices, resolveSource, sourceLabel } from '../source.js';
import { LEVELS, LEVEL_INFO } from '../data.js';
import { reel, dial, dropdown, mount } from '../fx.js';

let lastSrc = 'scope';
const ic = (name, opts) => raw(icon(name, opts));

// ---------- posters ----------
// Gradient pairs in the section colours (terracotta / violet / turquoise family, plus gold & amalfi accents).
const PALETTE = {
  flashcards: ['#f2c14e', '#e0673f'], quiz: ['#38bdf8', '#4c5bd4'], typing: ['#2dd4bf', '#0f766e'], matching: ['#a78bfa', '#5b3fb5'],
  hangman: ['#e0673f', '#b8323f'], crossword: ['#a3b86c', '#2f6b4f'], cloze: ['#f2c14e', '#b8860b'], scramble: ['#38bdf8', '#2dd4bf'],
  sentence: ['#e0673f', '#f2c14e'], gender: ['#f43f5e', '#b8323f'], plurals: ['#a3b86c', '#0891b2'], dictation: ['#4c5bd4', '#38bdf8'],
  reverse: ['#2dd4bf', '#38bdf8'], speed: ['#f2c14e', '#f43f5e'],
  'conj-drill': ['#e0673f', '#f2c14e'], 'conj-choice': ['#38bdf8', '#a78bfa'], 'tense-detective': ['#a78bfa', '#b8323f'], aux: ['#2dd4bf', '#a3b86c'],
  participles: ['#e0673f', '#7c2d3a'], patterns: ['#0891b2', '#2dd4bf'], 'verb-quiz': ['#f43f5e', '#a78bfa'],
};
const GLYPH = {
  flashcards: 'flip', quiz: 'sparkle', typing: 'edit', matching: 'spread', hangman: 'dots', crossword: 'list', cloze: 'edit', scramble: 'refresh',
  sentence: 'arrow', gender: 'orbit', plurals: 'plus', dictation: 'ear', reverse: 'arrow', speed: 'flame',
  'conj-drill': 'edit', 'conj-choice': 'check', 'tense-detective': 'search', aux: 'dial', participles: 'book', patterns: 'orbit', 'verb-quiz': 'sparkle',
};
const TAGLINE = {
  flashcards: 'Flip & rate', quiz: 'Mixed choice', typing: 'Type the Italian', matching: 'Pair them up', hangman: 'Letter by letter', crossword: 'Clued in English',
  cloze: 'Complete the sentence', scramble: 'Unscramble the letters', sentence: 'Order the words', gender: 'Il, la, lo…', plurals: 'Singular → plural', dictation: 'Listen & type',
  reverse: 'Type the English', speed: '60 seconds', 'conj-drill': 'Type the form', 'conj-choice': 'Multiple choice', 'tense-detective': 'Which tense? Who?', aux: 'Essere or avere',
  participles: 'Participio & gerundio', patterns: 'Which preposition?', 'verb-quiz': 'Everything, one round',
};
export const KIND_LABEL = { any: 'Vocabulary', word: 'Vocabulary', noun: 'Nouns', verb: 'Verbs' };

// posterHTML(game, { href }) → <a class="poster"> (href) or <button class="poster" data-game> (no href)
export function posterHTML(g, { href = null, stats = null } = {}) {
  const [p1, p2] = PALETTE[g.id] || ['#e0673f', '#b8323f'];
  const st = stats || (store.current?.stats?.games || {})[g.id];
  const sub = st && st.played ? `Best ${st.best}% · ${st.played} play${st.played === 1 ? '' : 's'}` : (TAGLINE[g.id] || g.desc);
  const inner = html`<span class="poster-ghost" aria-hidden="true">${g.name.slice(0, 1)}</span>
    <span class="poster-glyph">${ic(GLYPH[g.id] || 'play', { size: 22 })}</span>
    <span class="poster-kicker">${KIND_LABEL[g.kind] || 'Vocabulary'}</span>
    <span class="poster-title">${g.name}</span>
    <span class="sub">${sub}</span>`;
  const style = `--p1:${p1};--p2:${p2}`;
  return href
    ? html`<a class="poster" href="${href}" style="${style}" data-game="${g.id}" aria-label="${g.name}">${raw(inner)}</a>`
    : html`<button type="button" class="poster" style="${style}" data-game="${g.id}" aria-label="${g.name}">${raw(inner)}</button>`;
}

// ---------- source picker (bottom sheet) ----------
const kindFilter = (game) => (e) => game.kind === 'any' ? true : game.kind === 'verb' ? e.kind === 'verb' : game.kind === 'noun' ? e.pos === 'noun' : e.kind === 'word';

export function openSourcePicker(game, presetSrc) {
  const choices = sourceChoices();
  // a selection handed in by a screen (the custom-words collection plays "ids:…") is offered as its own source instead of
  // silently falling back to the study scope
  if (presetSrc && /^(ids|list):/.test(presetSrc) && !choices.some(c => c.spec === presetSrc)) {
    const n = resolveSource(presetSrc).length;
    if (n) choices.unshift({ spec: presetSrc, label: sourceLabel(presetSrc), sub: `${n} ${n === 1 ? 'item' : 'items'} chosen for this game`, count: n });
  }
  const opts = game.options || [];
  const chosen = { src: presetSrc || lastSrc, tenses: ['presente', 'passatoProssimo'] };
  if (!choices.some(c => c.spec === chosen.src)) chosen.src = 'scope';
  for (const o of opts) chosen[o.key] = o.choices[0][0];
  const tenseItems = TENSE_OPTIONS.map(([k, n]) => ({ key: k, label: n, sub: TENSE_BY_KEY[k]?.mood || '' }));
  let dialIdx = Math.max(0, tenseItems.findIndex(t => t.key === chosen.tenses[0]));

  const countFor = (c) => c.spec === chosen.src ? resolveSource(c.spec).filter(kindFilter(game)).length : c.count;
  const levelOf = (spec) => spec.startsWith('level:') ? spec.slice(6) : null;
  const current = () => choices.find(c => c.spec === chosen.src) || choices[0];
  // "Play with" is one glass row: the current source with its count; tapping it opens a dropdown of every source
  // (learned sets, word bank, lists, then the six levels) so the tense dial and Start stay above the fold.
  const sourceRow = () => {
    const c = current(); const L = levelOf(c.spec);
    return html`<button type="button" class="src-row src-pick on" data-src-pick aria-haspopup="menu" aria-expanded="false" aria-label="Play with: ${c.label}">
      <span class="src-main"><span class="src-label">${c.label}</span><span class="src-sub">${L ? `${LEVEL_INFO[L].name} · every word and verb` : c.sub}</span></span>
      <span class="src-count">${countFor(c)}</span>${ic('chevronDown', { size: 18 })}</button>`;
  };
  const sourceOptions = () => choices.map(c => ({ value: c.spec, label: c.label, sub: `${c.sub} · ${countFor(c)}`, selected: c.spec === chosen.src }));
  const tenseTags = () => chosen.tenses.map(k => html`<span>${TENSE_BY_KEY[k]?.name || k}</span>`).join('');
  const toggleLabel = () => { const k = tenseItems[dialIdx].key; return (chosen.tenses.includes(k) ? 'Remove ' : 'Add ') + tenseItems[dialIdx].label; };

  const body = html`
    <div class="srcp">
      <div class="srcp-desc">${game.desc}</div>
      ${game.tenses ? raw(html`<div class="kicker srcp-kicker">Tenses</div>
        <div class="srcp-dial"><div class="dial" data-dial aria-label="Tense"></div></div>
        <div class="srcp-tense-row"><button type="button" class="btn sm secondary" data-tense-toggle>${toggleLabel()}</button><span class="tiny muted">turn the dial, add what you want to drill</span></div>
        <div class="tags srcp-tags" data-tense-tags>${raw(tenseTags())}</div>`) : ''}
      <div class="kicker srcp-kicker">Play with</div>
      <div data-sources>${raw(sourceRow())}</div>
      ${opts.length ? raw(opts.map(o => html`<div class="kicker srcp-kicker">${o.label}</div>
        <div class="chips srcp-chips">${raw(o.choices.map(([v, l]) => html`<button type="button" class="chip ${chosen[o.key] === v ? 'on' : ''}" data-opt="${o.key}" data-val="${v}" aria-pressed="${chosen[o.key] === v ? 'true' : 'false'}">${l}</button>`).join(''))}</div>`).join('')) : ''}
      <div class="srcp-foot"><button type="button" class="btn primary block srcp-start" data-start>Start ${game.name}${ic('arrow', { size: 20 })}</button></div>
    </div>`;
  const s = sheet(body, { title: game.name, onClose: () => { dialApi && dialApi.destroy(); } });
  let dialApi = null;
  const markPicked = () => { s.body.querySelectorAll('.dial-item').forEach(b => b.classList.toggle('picked', chosen.tenses.includes(b.dataset.key))); const t = s.body.querySelector('[data-tense-toggle]'); if (t) t.textContent = toggleLabel(); const tags = s.body.querySelector('[data-tense-tags]'); if (tags) tags.innerHTML = tenseTags(); };
  if (game.tenses) {
    dialApi = dial(s.body.querySelector('[data-dial]'), { items: tenseItems, index: dialIdx, onChange: (i) => { dialIdx = i; markPicked(); } });
    markPicked();
  }
  s.body.addEventListener('click', (ev) => {
    const pick = ev.target.closest('[data-src-pick]');
    if (pick) {
      dropdown(pick, sourceOptions(), { width: Math.min(340, window.innerWidth - 32), onSelect: (v) => { chosen.src = v; const host = s.body.querySelector('[data-sources]'); host.innerHTML = sourceRow(); host.querySelector('[data-src-pick]')?.focus({ preventScroll: true }); } });
      return;
    }
    const o = ev.target.closest('[data-opt]');
    if (o) { chosen[o.dataset.opt] = o.dataset.val; s.body.querySelectorAll(`[data-opt="${o.dataset.opt}"]`).forEach(x => { const on = x === o; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }); return; }
    if (ev.target.closest('[data-tense-toggle]')) {
      const k = tenseItems[dialIdx].key;
      if (chosen.tenses.includes(k)) { if (chosen.tenses.length > 1) chosen.tenses = chosen.tenses.filter(x => x !== k); }
      else chosen.tenses.push(k);
      markPicked(); return;
    }
    if (ev.target.closest('[data-start]')) {
      lastSrc = chosen.src;
      const q = new URLSearchParams({ src: chosen.src });
      for (const o of opts) q.set(o.key, chosen[o.key]);
      if (game.tenses) q.set('tenses', chosen.tenses.join(','));
      s.close();
      location.hash = `#/game/${game.id}?${q.toString()}`;
    }
  });
}

// ---------- hub ----------
export async function render(root, params, query) {
  setTitle('Play');
  const learnedV = store.learnedIds('v:').length;
  const learnedAll = store.learnedIds().length;
  const vocab = GAMES.filter(g => g.kind === 'any' || g.kind === 'noun' || g.kind === 'word');
  const verbs = GAMES.filter(g => g.kind === 'verb');
  const reelHTML = (games) => html`<div class="reel" data-reel>${raw(games.map(g => posterHTML(g)).join(''))}</div>`;

  root.innerHTML = html`
    <div class="games-hub">
      <div class="play-hero glass pad-l">
        <div class="play-hero-top">
          <div><span class="kicker">Play with what you know</span><div class="play-hero-title">${raw(tr('Gioca', 'Play'))}, ${raw(tr('impara', 'learn'))}.</div></div>
          <span class="play-hero-ico">${ic('play', { size: 26 })}</span>
        </div>
        <p class="small muted">Every game runs on your learned verbs and words, your word bank, any list, or a whole level.</p>
        <div class="play-hero-ctas">
          <a class="btn sm ${learnedAll ? 'primary' : 'secondary'}" href="${learnedAll ? '#/game/quiz?src=learned' : '#/game/quiz?src=scope'}">${ic('sparkle', { size: 16 })}${learnedAll ? 'Quiz my learned items' : 'Quiz my scope'}</a>
          ${learnedV ? raw(html`<a class="btn sm secondary" href="#/game/conj-drill?src=learned-verbs&tenses=presente,passatoProssimo">${ic('edit', { size: 16 })}Drill my verbs</a>`) : raw(html`<a class="btn sm secondary" href="#/game/flashcards?src=scope">${ic('flip', { size: 16 })}Flashcards on my scope</a>`)}
        </div>
      </div>

      <section class="games-section">
        ${raw(secHead('Vocabulary', 'Words in play'))}
        ${raw(reelHTML(vocab))}
      </section>
      <section class="games-section">
        ${raw(secHead('Verbs', 'Tenses & forms'))}
        ${raw(reelHTML(verbs))}
      </section>
      <p class="center kicker games-foot">${GAMES.length} games · any source · tap a poster</p>
    </div>`;

  const hub = root.querySelector('.games-hub');
  mount(hub);
  const reels = [...hub.querySelectorAll('[data-reel]')].map(el => reel(el));
  hub.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-game]'); if (!b) return;
    const g = GAMES.find(x => x.id === b.dataset.game); if (g) openSourcePicker(g);
  });
  if (query && query.pick) {
    const g = GAMES.find(x => x.id === query.pick);
    if (g) {
      const i = (g.kind === 'verb' ? verbs : vocab).findIndex(x => x.id === g.id);
      const r = reels[g.kind === 'verb' ? 1 : 0]; if (r && i >= 0) setTimeout(() => r.scrollTo(i, false), 60);
      openSourcePicker(g, query.src);
      // the deep link has done its job: coming back from the game (top-bar back, swipe) must show the hub, not the sheet again
      try { history.replaceState(history.state, '', location.href.replace(/#\/games\?.*$/, '#/games')); } catch { /* ignore */ }
    }
  }
  return () => reels.forEach(r => r.destroy());
}
