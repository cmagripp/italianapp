// Browse by level and category, with filters (part of speech, learned state) and bulk actions.
import { html, raw, esc, levelBadge, toast, sheet } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, LEVELS, LEVEL_INFO, CATS, POS_NAME } from '../data.js';
import { entryRow, openListPicker } from '../components.js';
import { stage } from '../srs.js';

export async function render(root, params, query) {
  const level = params.level && params.level !== 'all' ? params.level : null;
  const cat = params.cat || null;
  const kind = query.kind || null;
  setTitle(level && cat ? `${level} · ${CATS[cat]?.name || cat}` : level ? `Level ${level}` : cat ? (CATS[cat]?.name || cat) : kind === 'verb' ? 'All verbs' : 'Browse');
  const filter = { pos: query.pos || '', state: query.state || '' };
  const custom = Object.values(store.current.custom || {});
  let base = [...data.vocab, ...data.verbs, ...custom].filter(e => (!level || e.level === level) && (!cat || e.cat === cat) && (!kind || e.kind === kind));
  const PAGE = 80;
  let shown = PAGE;

  function apply() {
    let items = base;
    if (filter.pos === 'verb') items = items.filter(e => e.kind === 'verb');
    else if (filter.pos) items = items.filter(e => e.kind === 'word' && e.pos === filter.pos);
    if (filter.state) items = items.filter(e => stage(store.getItem(e.id)) === filter.state || (filter.state === 'learned' && store.isLearned(e.id)) || (filter.state === 'unlearned' && !store.isLearned(e.id)));
    return items;
  }
  function draw() {
    const items = apply();
    const learned = items.filter(e => store.isLearned(e.id)).length;
    const catsHere = [...new Set(base.map(e => e.cat))];
    const posHere = [...new Set(base.map(e => e.kind === 'verb' ? 'verb' : e.pos))];
    root.innerHTML = html`
      ${level && !cat ? raw(html`<div class="card level-card" style="border-left:6px solid ${LEVEL_INFO[level].color}"><div class="grow"><div class="bold">${LEVEL_INFO[level].name} · ${LEVEL_INFO[level].it}</div><div class="tiny muted">${LEVEL_INFO[level].desc}</div></div></div>`) : ''}
      ${!cat ? raw(html`<div class="chips scroll mb">${raw(catsHere.map(c => html`<a class="chip sm" href="#/browse/${level || 'all'}/${c}">${CATS[c]?.icon || ''} ${CATS[c]?.name || c}</a>`).join(''))}</div>`) : ''}
      ${!level ? raw(html`<div class="chips scroll mb">${raw(LEVELS.map(L => html`<a class="chip sm" href="#/browse/${L}${cat ? '/' + cat : ''}${kind ? '?kind=' + kind : ''}">${L}</a>`).join(''))}</div>`) : ''}
      <div class="chips scroll mb">
        <button class="chip sm ${!filter.pos ? 'on' : ''}" data-pos="">All</button>
        ${raw(posHere.map(p => html`<button class="chip sm ${filter.pos === p ? 'on' : ''}" data-pos="${p}">${POS_NAME[p] || p}</button>`).join(''))}
      </div>
      <div class="chips scroll mb">
        <button class="chip sm ${!filter.state ? 'on' : ''}" data-state="">Any state</button>
        <button class="chip sm ${filter.state === 'unlearned' ? 'on' : ''}" data-state="unlearned">Not learned</button>
        <button class="chip sm ${filter.state === 'learned' ? 'on' : ''}" data-state="learned">Learned</button>
        <button class="chip sm ${filter.state === 'mastered' ? 'on' : ''}" data-state="mastered">Mastered</button>
      </div>
      <div class="row between mb"><span class="small muted">${items.length} entries · ${learned} learned</span><div class="row gap-s"><button class="btn xs ghost" data-play>Play</button><button class="btn xs ghost" data-study>Set as scope</button></div></div>
      <div class="list" data-list>${raw(items.slice(0, shown).map(e => entryRow(e, { showLevel: !level })).join(''))}</div>
      ${items.length > shown ? raw('<button class="btn block mt" data-more>Show more</button>') : ''}`;
    root.querySelector('[data-more]')?.addEventListener('click', () => { shown += PAGE; draw(); });
    root.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => { filter.pos = b.dataset.pos; shown = PAGE; draw(); }));
    root.querySelectorAll('[data-state]').forEach(b => b.addEventListener('click', () => { filter.state = b.dataset.state; shown = PAGE; draw(); }));
    root.querySelector('[data-play]').addEventListener('click', () => { const src = level ? `level:${level}${cat ? ':' + cat : ''}` : cat ? `cat:${cat}` : 'all'; location.hash = `#/games?pick=quiz&src=${src}`; });
    root.querySelector('[data-study]').addEventListener('click', () => { store.setScope({ mode: 'level', levels: level ? [level] : LEVELS.slice(), cats: cat ? [cat] : [] }); toast('Study scope updated', { kind: 'ok' }); });
  }
  draw();
}
