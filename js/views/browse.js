// Browse by level / topic / kind: level hero strip, chip filters, sticky-kicker groups, dropdown actions, paging.
import { html, raw, toast, tr, icon, pct } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, LEVELS, LEVEL_INFO, CATS, POS_NAME, fold } from '../data.js';
import { entryRow } from '../components.js';
import { stage } from '../srs.js';
import { dropdown, mount, setScene } from '../fx.js';
import { shortCat } from './words.js';

const ic = (name, opts) => raw(icon(name, opts));
const POS_ORDER = ['noun', 'verb', 'adj', 'adv', 'expr', 'prep', 'conj', 'pron', 'num', 'det', 'interj'];
const POS_PLURAL = { noun: 'Nouns', verb: 'Verbs', adj: 'Adjectives', adv: 'Adverbs', expr: 'Expressions', prep: 'Prepositions', conj: 'Conjunctions', pron: 'Pronouns', num: 'Numbers', det: 'Determiners', interj: 'Interjections' };
const STATES = [['', 'All'], ['unlearned', 'To learn'], ['learned', 'Learned'], ['mastered', 'Mastered']];
const PAGE = 80;

export async function render(root, params, query) {
  const level = params.level && params.level !== 'all' ? params.level : null;
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
  let shown = PAGE;

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

  function body() {
    const items = apply();
    const learned = items.filter(e => store.isLearned(e.id)).length;
    const groups = grouped(items);
    const ordered = groups.flatMap(g => g.items);
    const visible = new Set(ordered.slice(0, shown).map(e => e.id));
    const vis = groups.map(g => ({ key: g.key, total: g.items.length, items: g.items.filter(e => visible.has(e.id)) })).filter(g => g.items.length);
    const left = ordered.length - shown;
    return html`<div class="count-row"><span class="kicker">${items.length} · ${learned} learned</span><button type="button" class="btn sm" data-actions aria-haspopup="menu">${ic('play', { size: 16 })}Play · Study${ic('chevronDown', { size: 16 })}</button></div>
      ${items.length
        ? raw(vis.map(g => html`<section class="grp"><div class="grp-head"><span class="kicker">${raw(groupLabel(g.key))}</span><span class="kicker n">${g.total}</span></div><div class="list">${raw(g.items.map(e => entryRow(e, { showLevel: false })).join(''))}</div></section>`).join(''))
        : raw(html`<div class="empty"><p>${raw(tr('Niente qui, per ora.', 'Nothing here, for now.'))}</p><p class="small muted">Try another filter.</p></div>`)}
      ${left > 0 ? raw(html`<button type="button" class="btn ghost block more-btn" data-more>Show ${Math.min(PAGE, left)} more <span class="mono">· ${left} left</span></button>`) : ''}`;
  }

  function bindBody() {
    root.querySelector('[data-more]')?.addEventListener('click', () => { shown += PAGE; redrawBody(); });
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
    root.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => { filter.pos = b.dataset.pos; shown = PAGE; root.querySelectorAll('[data-pos]').forEach(x => x.classList.toggle('on', x === b)); redrawBody(); }));
    root.querySelector('[data-state-menu]')?.addEventListener('click', (ev) => {
      const chip = ev.currentTarget;
      dropdown(chip, STATES.map(([v, l]) => ({ value: v, label: l, sub: v === '' ? 'Every entry' : v === 'unlearned' ? 'Not yet learned' : v === 'learned' ? 'Marked learned' : 'Stage: mastered', selected: filter.state === v })), { width: 240, onSelect: (v) => {
        filter.state = v; shown = PAGE;
        chip.classList.toggle('on', !!v); chip.innerHTML = stateLabel() + icon('chevronDown', { size: 14 });
        redrawBody();
      } });
    });
    bindBody();
    mount(root.firstElementChild);
  }
  draw();
}
