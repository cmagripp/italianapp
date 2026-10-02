// Browse by level / topic / kind: level hero strip, chip filters, sticky-kicker groups, dropdown actions, paging.
// `#/browse?list=useful` is the "Parole utili" deck instead: the curated function-word set, grouped (renderUseful below).
import { html, raw, toast, tr, icon, pct, levelBadge } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, LEVELS, LEVEL_INFO, CATS, POS_NAME, fold, headword } from '../data.js';
import { entryRow, stageOf } from '../components.js';
import { stage } from '../srs.js';
import { dropdown, mount, setScene } from '../fx.js';
import { shortCat } from './words.js';
import { USEFUL_LIST, USEFUL_TITLE, USEFUL_EN, loadUsefulWords, usefulGroups, idsSource, matchingHref } from '../useful-words.js';

const ic = (name, opts) => raw(icon(name, opts));
const POS_ORDER = ['noun', 'verb', 'adj', 'adv', 'expr', 'prep', 'conj', 'pron', 'num', 'det', 'interj'];
const POS_PLURAL = { noun: 'Nouns', verb: 'Verbs', adj: 'Adjectives', adv: 'Adverbs', expr: 'Expressions', prep: 'Prepositions', conj: 'Conjunctions', pron: 'Pronouns', num: 'Numbers', det: 'Determiners', interj: 'Interjections' };
const STATES = [['', 'All'], ['unlearned', 'To learn'], ['learned', 'Learned'], ['mastered', 'Mastered']];
const PAGE = 80;
// Pages shown per history entry (the router stamps history.state.pid before rendering): coming back from an entry re-paints
// as many rows as were open, so the restored scroll position lands on the rows the learner was reading.
const shownMemory = new Map();
const historyKey = () => (history.state && history.state.pid) || null;

export async function render(root, params, query) {
  if (query.list === USEFUL_LIST) return renderUseful(root);
  const level = params.level && params.level !== 'all' ? params.level : null;
  if (level && !LEVELS.includes(level)) { setTitle('Browse'); root.innerHTML = html`<div class="empty"><p>${raw(tr('Livello sconosciuto.', 'Unknown level.'))}</p><a class="btn primary" href="#/browse">Browse everything</a></div>`; return; }
  const cat = params.cat || null;
  const kind = query.kind || null;
  setTitle(level && cat ? `${level} · ${CATS[cat]?.name || cat}` : level ? `Level ${level}` : cat ? (CATS[cat]?.name || cat) : kind === 'verb' ? 'All verbs' : 'Browse');
  if (level) setScene(level);
  const filter = { pos: query.pos || '', state: query.state || '' };
  const custom = Object.values(store.current.custom || {});
  const base = [...data.vocab, ...data.verbs, ...custom].filter(e => (!level || e.level === level) && (!cat || e.cat === cat) && (!kind || e.kind === kind));
  const groupBy = level && !cat ? 'cat' : !level ? 'level' : 'pos';
  const hc = level ? `var(--lvl-${level})` : cat ? 'var(--amalfi)' : kind === 'verb' ? 'var(--terracotta)' : 'var(--gold)';
  const src = level ? `level:${level}${cat ? ':' + cat : ''}` : cat ? `cat:${cat}` : 'all';
  const q = kind ? `?kind=${kind}` : '';
  const posOf = (e) => (e.kind === 'verb' ? 'verb' : e.pos);
  const posHere = POS_ORDER.filter(p => base.some(e => posOf(e) === p));
  const catsHere = Object.keys(CATS).filter(c => base.some(e => e.cat === c));
  const memo = historyKey() && shownMemory.get(historyKey());
  let shown = memo && memo.pos === filter.pos && memo.state === filter.state ? memo.shown : PAGE;
  const remember = () => { const k = historyKey(); if (k) shownMemory.set(k, { shown, pos: filter.pos, state: filter.state }); };
  let cache = null; // the filtered, grouped and sorted entries: computed once per filter change, not on every page

  function apply() {
    let items = base;
    if (filter.pos === 'verb') items = items.filter(e => e.kind === 'verb');
    else if (filter.pos) items = items.filter(e => e.kind === 'word' && e.pos === filter.pos);
    if (filter.state) items = items.filter(e => stage(store.getItem(e.id)) === filter.state || (filter.state === 'learned' && store.isLearned(e.id)) || (filter.state === 'unlearned' && !store.isLearned(e.id)));
    return items;
  }
  const sortKey = (e) => fold(e.kind === 'verb' ? e.inf : e.it);
  function grouped(items) {
    const keyOf = (e) => (groupBy === 'cat' ? e.cat : groupBy === 'level' ? (e.level || 'A1') : posOf(e));
    const order = groupBy === 'cat' ? Object.keys(CATS) : groupBy === 'level' ? LEVELS : POS_ORDER;
    const m = new Map();
    for (const e of items) { const k = keyOf(e); if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
    const keys = [...order.filter(k => m.has(k)), ...[...m.keys()].filter(k => !order.includes(k))];
    return keys.map(k => ({ key: k, items: m.get(k).sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'it')) }));
  }
  function groupLabel(k) {
    if (groupBy === 'cat') return html`<span class="glyph">${CATS[k]?.icon || ''}</span>${CATS[k]?.name || k}`;
    if (groupBy === 'level') return html`<i class="gdot" style="--c:var(--lvl-${k})"></i>Level ${k} · ${LEVEL_INFO[k]?.name || ''}`;
    return html`<i class="gdot" style="--c:${hc}"></i>${POS_PLURAL[k] || POS_NAME[k] || k}`;
  }

  function hero() {
    const total = base.length; const learned = base.filter(e => store.isLearned(e.id)).length; const p = pct(learned, total);
    const words = base.filter(e => e.kind === 'word').length; const verbs = total - words;
    const done = Math.floor(p / 10);
    const rail = html`<div class="rail-wrap"><div class="rail">${raw([...Array(10)].map((_, i) => `<span class="${i < done ? 'done' : (i === done && learned && p < 100 ? 'cur' : '')}"></span>`).join(''))}</div><span class="rail-count">${learned} / ${total}</span></div>`;
    const meta = html`<div class="hmeta"><span><b>${words}</b> words</span><span><b>${verbs}</b> verbs</span><span><b>${p}%</b> learned</span></div>`;
    let body;
    if (level) body = html`<span class="kicker">Level${cat ? raw(html`<span>·</span><span class="glyph">${CATS[cat]?.icon || ''}</span><span>${CATS[cat]?.name || cat}</span>`) : ''}</span><span class="big">${level}</span><span class="hname">${LEVEL_INFO[level].name} · ${LEVEL_INFO[level].it}</span><span class="hdesc">${LEVEL_INFO[level].desc}</span>`;
    else if (cat) body = html`<span class="kicker"><span class="glyph">${CATS[cat]?.icon || ''}</span><span>Topic · all levels</span></span><span class="big txt">${CATS[cat]?.name || cat}</span><span class="hdesc">Every word and verb on this topic, from A1 to C2.</span>`;
    else if (kind === 'verb') body = html`<span class="kicker">All verbs</span><span class="big txt">${raw(tr('Tutti i verbi', 'All the verbs'))}</span><span class="hdesc">Every verb with full conjugation tables, grouped by level.</span>`;
    else body = html`<span class="kicker">Everything</span><span class="big txt">${raw(tr('Tutte le parole', 'All the words'))}</span><span class="hdesc">The whole dictionary, grouped by level.</span>`;
    return html`<div class="lvl-hero glass glass-tint" style="--hc:${hc};--tint:color-mix(in srgb, ${hc} 12%, transparent)">${raw(body)}${raw(meta)}${raw(rail)}</div>`;
  }

  const stateLabel = () => (filter.state ? (STATES.find(([v]) => v === filter.state) || STATES[0])[1] : 'State');
  // At most three rows before the content: level chips (when browsing all levels), topic chips (when no topic is set) and one
  // row that merges the learning-state picker (a chip that opens a dropdown) with the part-of-speech chips.
  function filters() {
    const rows = [];
    if (!level) rows.push(html`<div class="chips scroll" aria-label="Level"><a class="chip lvl-chip on" style="--c:${hc}" href="#/browse${cat ? '/all/' + cat : ''}${q}">All levels</a>${raw(LEVELS.map(L => html`<a class="chip lvl-chip" style="--c:var(--lvl-${L})" href="#/browse/${L}${cat ? '/' + cat : ''}${q}">${L}</a>`).join(''))}</div>`);
    if (!cat) rows.push(html`<div class="chips scroll" aria-label="Topic"><a class="chip on" href="#/browse/${level || 'all'}${q}">All topics</a>${raw(catsHere.map(c => html`<a class="chip" href="#/browse/${level || 'all'}/${c}${q}"><span class="glyph">${CATS[c]?.icon || ''}</span>${shortCat(c)}</a>`).join(''))}</div>`);
    const stateChip = html`<button type="button" class="chip state-chip ${filter.state ? 'on' : ''}" data-state-menu aria-haspopup="menu" aria-expanded="false" aria-label="Learning state">${stateLabel()}${ic('chevronDown', { size: 14 })}</button>`;
    const posChips = posHere.length > 1 ? html`<span class="filter-sep" aria-hidden="true"></span><button type="button" class="chip ${!filter.pos ? 'on' : ''}" data-pos="">All</button>${raw(posHere.map(p => html`<button type="button" class="chip ${filter.pos === p ? 'on' : ''}" data-pos="${p}">${POS_NAME[p] || p}</button>`).join(''))}` : '';
    rows.push(html`<div class="chips scroll filter-row" aria-label="State and part of speech">${raw(stateChip)}${raw(posChips)}</div>`);
    return rows.join('');
  }

  function current() {
    if (!cache) { const items = apply(); const groups = grouped(items); cache = { items, groups, ordered: groups.flatMap(g => g.items), learned: items.filter(e => store.isLearned(e.id)).length }; }
    return cache;
  }
  const groupHTML = (g) => html`<section class="grp" data-key="${String(g.key)}"><div class="grp-head"><span class="kicker">${raw(groupLabel(g.key))}</span><span class="kicker n">${g.total}</span></div><div class="list">${raw(g.items.map(e => entryRow(e, { showLevel: false })).join(''))}</div></section>`;
  const moreLabel = (left) => html`Show ${Math.min(PAGE, left)} more <span class="mono">· ${left} left</span>`;
  function body() {
    const { items, groups, ordered, learned } = current();
    const visible = new Set(ordered.slice(0, shown).map(e => e.id));
    const vis = groups.map(g => ({ key: g.key, total: g.items.length, items: g.items.filter(e => visible.has(e.id)) })).filter(g => g.items.length);
    const left = ordered.length - shown;
    return html`<div class="count-row"><span class="kicker">${items.length} · ${learned} learned</span><button type="button" class="btn sm" data-actions aria-haspopup="menu">${ic('play', { size: 16 })}Play · Study${ic('chevronDown', { size: 16 })}</button></div>
      ${items.length
        ? raw(vis.map(groupHTML).join(''))
        : raw(html`<div class="empty"><p>${raw(tr('Niente qui, per ora.', 'Nothing here, for now.'))}</p><p class="small muted">Try another filter.</p></div>`)}
      ${left > 0 ? raw(html`<button type="button" class="btn ghost block more-btn" data-more>${raw(moreLabel(left))}</button>`) : ''}`;
  }
  // "Show more" appends the next page to the groups already on screen instead of re-sorting and re-rendering every row shown so far
  function showMore() {
    const { groups, ordered } = current();
    const from = shown; shown += PAGE; remember();
    const add = new Set(ordered.slice(from, shown).map(e => e.id));
    const bodyEl = root.querySelector('[data-body]'), more = bodyEl.querySelector('[data-more]');
    for (const g of groups) {
      const items = g.items.filter(e => add.has(e.id));
      if (!items.length) continue;
      const sec = bodyEl.querySelector(`.grp[data-key="${CSS.escape(String(g.key))}"]`);
      if (sec) sec.querySelector('.list').insertAdjacentHTML('beforeend', items.map(e => entryRow(e, { showLevel: false })).join(''));
      else (more || bodyEl).insertAdjacentHTML(more ? 'beforebegin' : 'beforeend', groupHTML({ key: g.key, total: g.items.length, items }));
    }
    const left = ordered.length - shown;
    if (more) { if (left > 0) more.innerHTML = moreLabel(left); else more.remove(); }
  }

  function bindBody() {
    root.querySelector('[data-more]')?.addEventListener('click', showMore);
    root.querySelector('[data-actions]')?.addEventListener('click', (ev) => {
      dropdown(ev.currentTarget, [
        { value: 'quiz', label: 'Play a quiz', sub: 'Multiple choice with these entries' },
        { value: 'flashcards', label: 'Flashcards', sub: 'Flip through them one by one' },
        { value: 'scope', label: 'Set as study scope', sub: 'Learn hub, review and games' },
      ], { align: 'end', width: 272, onSelect: (v) => {
        if (v === 'scope') { store.setScope({ mode: 'level', levels: level ? [level] : LEVELS.slice(), cats: cat ? [cat] : [] }); toast('Study scope updated', { kind: 'ok' }); }
        else location.hash = `#/games?pick=${v}&src=${src}`;
      } });
    });
  }
  function redrawBody() { root.querySelector('[data-body]').innerHTML = body(); bindBody(); }
  function draw() {
    root.innerHTML = html`<div class="pg pg-browse">${raw(hero())}<div class="filters">${raw(filters())}</div><div data-body>${raw(body())}</div></div>`;
    root.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => { filter.pos = b.dataset.pos; shown = PAGE; cache = null; remember(); root.querySelectorAll('[data-pos]').forEach(x => x.classList.toggle('on', x === b)); redrawBody(); }));
    root.querySelector('[data-state-menu]')?.addEventListener('click', (ev) => {
      const chip = ev.currentTarget;
      dropdown(chip, STATES.map(([v, l]) => ({ value: v, label: l, sub: v === '' ? 'Every entry' : v === 'unlearned' ? 'Not yet learned' : v === 'learned' ? 'Marked learned' : 'Stage: mastered', selected: filter.state === v })), { width: 240, onSelect: (v) => {
        filter.state = v; shown = PAGE; cache = null; remember();
        chip.classList.toggle('on', !!v); chip.innerHTML = stateLabel() + icon('chevronDown', { size: 14 });
        redrawBody();
      } });
    });
    bindBody();
    mount(root.firstElementChild);
  }
  draw();
}

// ---------- the "Parole utili" deck (#/browse?list=useful) ----------
// The curated function-word set as data/useful-words.json groups it: the browse hero in the amalfi tint, one Play (the
// Matching game on the whole set) beside the count with a menu for the other games, then every group under a sticky
// head that carries its own Play (Matching on that group alone). A row opens the word's lesson and shows the set's
// one-line usage note under the meaning.
const USEFUL_GAMES = [
  { value: 'matching', label: 'Matching', sub: 'Pair each word with its meaning' },
  { value: 'flashcards', label: 'Flashcards', sub: 'Flip through them one by one' },
  { value: 'quiz', label: 'Play a quiz', sub: 'Multiple choice on the set' },
];
// the first two senses: "him; it (direct object)" says more than entryRow's first sense alone for a clitic, and still fits one line
const twoSenses = (en) => String(en || '').split(';').slice(0, 2).map(s => s.trim()).filter(Boolean).join('; ');
function usefulRow(e, note) {
  const st = stageOf(e.id), learned = store.isLearned(e.id);
  return html`<a class="row-entry glass-flat uw-row" href="#/learn/word/${encodeURIComponent(e.id)}" data-id="${e.id}">
    <span class="dot stage-${st}"></span>
    <span class="re-main"><span class="re-hw">${headword(e)}</span><span class="re-sub">${twoSenses(e.en)} · ${POS_NAME[e.pos] || e.pos}</span>${note ? raw(html`<span class="re-note">${note}</span>`) : ''}</span>
    <span class="re-side">${raw(levelBadge(e.level || 'A1'))}${learned ? raw(`<span class="check-mark" title="Learned">${icon('check', { size: 18 })}</span>`) : ''}</span>
  </a>`;
}
async function renderUseful(root) {
  setTitle(USEFUL_TITLE);
  let set = null;
  try { set = await loadUsefulWords(); } catch (err) { console.warn(err); }
  const groups = usefulGroups(set);
  const all = groups.flatMap(g => g.items.map(x => x.entry));
  if (!all.length) { root.innerHTML = html`<div class="empty"><p>${raw(tr('Le parole utili non si caricano.', 'The useful words could not be loaded.'))}</p><a class="btn primary" href="#/words">Words</a></div>`; return; }
  const ids = all.map(e => e.id);
  const learned = all.filter(e => store.isLearned(e.id)).length, p = pct(learned, all.length), done = Math.floor(p / 10);
  const hc = 'var(--amalfi)';
  const rail = html`<div class="rail-wrap"><div class="rail">${raw([...Array(10)].map((_, i) => `<span class="${i < done ? 'done' : (i === done && learned && p < 100 ? 'cur' : '')}"></span>`).join(''))}</div><span class="rail-count">${learned} / ${all.length}</span></div>`;
  const groupHTML = (g) => html`<section class="grp" data-key="${g.id}">
      <div class="grp-head"><span class="kicker"><i class="gdot" style="--c:${hc}"></i>${g.title}<span class="uw-it">· ${g.it}</span></span><span class="side"><span class="kicker n">${g.items.length}</span><a class="btn xs ghost" href="${matchingHref(g.items.map(x => x.entry.id))}" data-play-group="${g.id}" aria-label="Play matching: ${g.title}">${ic('play', { size: 14 })}Play</a></span></div>
      <div class="list">${raw(g.items.map(x => usefulRow(x.entry, x.note)).join(''))}</div>
    </section>`;
  root.innerHTML = html`<div class="pg pg-browse pg-useful">
    <div class="lvl-hero glass glass-tint" style="--hc:${hc};--tint:color-mix(in srgb, ${hc} 12%, transparent)">
      <span class="kicker"><span class="glyph">${ic('sparkle', { size: 16 })}</span><span>Deck · every level</span></span>
      <span class="big txt">${USEFUL_TITLE}</span>
      <span class="hname">${USEFUL_EN}</span>
      <span class="hdesc">The small words that hold every sentence together: questions, links, pronouns, time, place and quantity.</span>
      <div class="hmeta"><span><b>${all.length}</b> words</span><span><b>${groups.length}</b> groups</span><span><b>${p}%</b> learned</span></div>
      ${raw(rail)}
    </div>
    <div class="count-row"><span class="kicker">${all.length} · ${learned} learned</span><span class="acts"><a class="btn sm primary" href="${matchingHref(ids)}" data-play>${ic('play', { size: 16 })}Play</a><button type="button" class="btn sm" data-actions aria-haspopup="menu" aria-label="More games on this deck">${ic('chevronDown', { size: 16 })}</button></span></div>
    ${raw(groups.map(groupHTML).join(''))}
  </div>`;
  root.querySelector('[data-actions]').addEventListener('click', (ev) => dropdown(ev.currentTarget, USEFUL_GAMES, { align: 'end', width: 272, onSelect: (v) => { location.hash = `#/games?pick=${v}&src=${idsSource(ids)}`; } }));
  mount(root.firstElementChild);
}
