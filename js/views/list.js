// A single list (word bank, custom list) or a virtual collection (learned-words, learned-verbs, custom).
import { html, raw, esc, toast, sheet, tr, icon, levelBadge } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, search, headword, shortEn } from '../data.js';
import { entryRow } from '../components.js';
import { dropdown, mount } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));
const SORTS = [['added', 'Added', 'In the order you added them'], ['alpha', 'A–Z', 'Alphabetical'], ['level', 'Level', 'A1 → C2'], ['weak', 'Weakest first', 'Lowest stage first']];
const VIRTUAL = {
  'learned-words': { name: 'Learned words', kicker: 'Collection', sub: 'Words you completed', empty: 'Finish a word walkthrough and it lands here.' },
  'learned-verbs': { name: 'Learned verbs', kicker: 'Collection', sub: 'Verbs whose walkthrough you finished', empty: 'Finish a verb walkthrough and it lands here.' },
  custom: { name: 'My custom words', kicker: 'Collection', sub: 'Entries you added yourself', empty: 'Words you add yourself will show up here.' },
};

export async function render(root, params) {
  const id = params.id;
  const virtual = Object.prototype.hasOwnProperty.call(VIRTUAL, id);
  const list = virtual ? null : store.lists[id];
  if (!virtual && !list) { root.innerHTML = html`<div class="empty"><p>${raw(tr('Lista non trovata.', 'List not found.'))}</p><a class="btn primary" href="#/lists">My lists</a></div>`; return; }
  const meta = virtual ? VIRTUAL[id] : { name: list.name, kicker: id === 'bank' ? 'Word bank' : 'Custom list', sub: id === 'bank' ? 'Starred from any entry' : 'Your own selection', empty: 'Search the dictionary and add words here.' };
  const name = meta.name;
  setTitle(name);
  const srcSpec = virtual ? (id === 'custom' ? 'ids:' : id) : (id === 'bank' ? 'bank' : 'list:' + id);
  let sortMode = 'added';

  function entries() {
    let ids;
    if (id === 'learned-words') ids = store.learnedIds().filter(x => !x.startsWith('v:'));
    else if (id === 'learned-verbs') ids = store.learnedIds('v:');
    else if (id === 'custom') ids = Object.keys(store.current.custom || {});
    else ids = list.items;
    const es = ids.map(getEntry).filter(Boolean);
    if (sortMode === 'alpha') es.sort((a, b) => (a.it || a.inf).localeCompare(b.it || b.inf, 'it'));
    else if (sortMode === 'level') es.sort((a, b) => (a.level || '').localeCompare(b.level || ''));
    else if (sortMode === 'weak') es.sort((a, b) => ((store.getItem(a.id)?.s ?? 0) - (store.getItem(b.id)?.s ?? 0)));
    return es;
  }
  function draw() {
    const es = entries();
    const learned = es.filter(e => store.isLearned(e.id)).length;
    const playSrc = id === 'custom' ? 'ids:' + encodeURIComponent(es.map(e => e.id).join(',')) : srcSpec;
    const sortLabel = SORTS.find(s => s[0] === sortMode)[1];
    root.innerHTML = html`<div class="pg pg-list">
      <div class="list-hero"><span class="kicker">${meta.kicker} · ${meta.sub}</span><div class="title">${name}</div><div class="meta">${es.length} ${es.length === 1 ? 'item' : 'items'} · ${learned} learned</div></div>
      <div class="list-actions">
        <a class="btn sm primary" href="#/games?pick=flashcards&src=${playSrc}">${ic('play', { size: 16 })}Play</a>
        ${!virtual ? raw(html`<button type="button" class="btn sm" data-scope>${ic('book', { size: 16 })}Study</button>`) : ''}
        ${!virtual ? raw(html`<button type="button" class="btn sm ghost" data-add>${ic('plus', { size: 16 })}Add words</button>`) : ''}
        <button type="button" class="btn sm ghost sort-btn" data-sort aria-haspopup="menu"><span class="lab">Sort</span>${sortLabel}${ic('chevronDown', { size: 16 })}</button>
      </div>
      ${es.length
        ? raw(`<div class="list">${es.map(e => entryRow(e, { extra: !virtual ? `<button type="button" class="icon-btn rm-btn" data-rm="${esc(e.id)}" aria-label="Remove from list">${icon('x', { size: 18 })}</button>` : '' })).join('')}</div>`)
        : raw(html`<div class="empty"><p>${raw(tr('Vuota, per ora.', 'Empty, for now.'))}</p><p class="small muted">${meta.empty}</p></div>`)}
    </div>`;
    root.querySelector('[data-sort]').addEventListener('click', (ev) => dropdown(ev.currentTarget, SORTS.map(([v, l, s]) => ({ value: v, label: l, sub: s, selected: v === sortMode })), { align: 'end', width: 244, onSelect: (v) => { sortMode = v; draw(); } }));
    root.querySelector('[data-scope]')?.addEventListener('click', () => { store.setScope({ mode: 'lists', lists: [id] }); toast('Study scope set to ' + name, { kind: 'ok' }); });
    root.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); store.removeFromList(id, b.dataset.rm); draw(); }));
    root.querySelector('[data-add]')?.addEventListener('click', openAdder);
    mount(root.firstElementChild);
  }
  function openAdder() {
    const s = sheet(html`<div class="pg"><div class="sbar sm"><span class="ico">${ic('search', { size: 20 })}</span><input data-q type="search" placeholder="cerca…" aria-label="Search to add" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"></div><div class="mt" data-res><p class="pick-hint">${raw(tr('Cerca una parola da aggiungere.', 'Search for a word to add.'))}</p></div></div>`, { title: 'Add to ' + name, onClose: draw });
    const q = s.body.querySelector('[data-q]'), res = s.body.querySelector('[data-res]');
    setTimeout(() => q.focus(), 320);
    const state = (inL) => (inL ? icon('check', { size: 14 }) + 'Added' : 'Add');
    const row = (e) => { const inL = list.items.includes(e.id); return html`<button type="button" class="row-entry glass-flat pick-row ${inL ? 'in' : ''}" data-pick="${e.id}"><span class="re-main"><span class="re-hw">${e.kind === 'verb' ? e.inf : headword(e)}</span><span class="re-sub">${shortEn(e.en)}</span></span><span class="re-side">${raw(levelBadge(e.level || 'A1'))}<span class="pick-state">${raw(state(inL))}</span></span></button>`; };
    let t = null;
    const go = () => {
      const v = q.value.trim();
      const hits = v ? search(v, { limit: 30 }) : [];
      res.innerHTML = hits.length ? `<div class="list">${hits.map(row).join('')}</div>` : html`<p class="pick-hint">${v ? raw(tr(`Nessun risultato per “${v}”.`, `No match for “${v}”.`)) : 'Search for a word to add.'}</p>`;
    };
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(go, 100); });
    res.addEventListener('click', (ev) => {
      const it = ev.target.closest('[data-pick]'); if (!it) return;
      const eid = it.dataset.pick; const now = !list.items.includes(eid);
      if (now) store.addToList(id, eid); else store.removeFromList(id, eid);
      it.classList.toggle('in', now);
      it.querySelector('.pick-state').innerHTML = state(now);
    });
  }
  draw();
}
