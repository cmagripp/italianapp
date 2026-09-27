// A single list (or a virtual list: learned-words, learned-verbs, custom).
import { html, raw, esc, toast, sheet } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, search } from '../data.js';
import { entryRow } from '../components.js';

export async function render(root, params) {
  const id = params.id;
  const virtual = ['learned-words', 'learned-verbs', 'custom'].includes(id);
  const list = virtual ? null : store.lists[id];
  if (!virtual && !list) { root.innerHTML = '<div class="empty">List not found.</div>'; return; }
  const name = virtual ? ({ 'learned-words': 'Learned words', 'learned-verbs': 'Learned verbs', custom: 'My custom words' })[id] : list.name;
  setTitle(name);
  const srcSpec = virtual ? (id === 'custom' ? 'ids:' : id) : (id === 'bank' ? 'bank' : 'list:' + id);
  let sortMode = 'added';

  function entries() {
    let ids;
    if (id === 'learned-words') ids = store.learnedIds().filter(x => !x.startsWith('v:'));
    else if (id === 'learned-verbs') ids = store.learnedIds('v:');
    else if (id === 'custom') ids = Object.keys(store.current.custom || {});
    else ids = list.items;
    let es = ids.map(getEntry).filter(Boolean);
    if (sortMode === 'alpha') es.sort((a, b) => (a.it || a.inf).localeCompare(b.it || b.inf, 'it'));
    else if (sortMode === 'level') es.sort((a, b) => (a.level || '').localeCompare(b.level || ''));
    else if (sortMode === 'weak') es.sort((a, b) => ((store.getItem(a.id)?.s ?? 0) - (store.getItem(b.id)?.s ?? 0)));
    return es;
  }
  function draw() {
    const es = entries();
    const playSrc = id === 'custom' ? 'ids:' + encodeURIComponent(es.map(e => e.id).join(',')) : srcSpec;
    root.innerHTML = html`
      <div class="row gap mb wrap">
        <a class="btn sm primary" href="#/games?pick=flashcards&src=${playSrc}">▶ Play</a>
        ${!virtual ? raw(html`<button class="btn sm" data-scope>Study this list</button>`) : ''}
        ${!virtual ? raw('<button class="btn sm ghost" data-add>＋ Add words</button>') : ''}
        <select class="input" style="width:auto;padding:6px 10px;font-size:14px;border-radius:10px" data-sort><option value="added">Sort: added</option><option value="alpha">A–Z</option><option value="level">Level</option><option value="weak">Weakest first</option></select>
      </div>
      <p class="small muted">${es.length} items</p>
      ${es.length ? raw(`<div class="list">${es.map(e => entryRow(e, { extra: !virtual ? `<button class="icon-btn" data-rm="${esc(e.id)}" aria-label="Remove">✕</button>` : '' })).join('')}</div>`) : raw('<div class="empty"><div class="big">🫙</div>Empty. Search for words and add them here.</div>')}`;
    root.querySelector('[data-sort]').value = sortMode;
    root.querySelector('[data-sort]').addEventListener('change', (e) => { sortMode = e.target.value; draw(); });
    root.querySelector('[data-scope]')?.addEventListener('click', () => { store.setScope({ mode: 'lists', lists: [id] }); toast('Study scope set to ' + name, { kind: 'ok' }); });
    root.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); store.removeFromList(id, b.dataset.rm); draw(); }));
    root.querySelector('[data-add]')?.addEventListener('click', openAdder);
  }
  function openAdder() {
    const s = sheet(html`<div class="search-box"><span class="ico">🔍</span><input class="input" data-q type="search" placeholder="Search to add…" autocapitalize="off" autocorrect="off"></div><div class="mt" data-res></div>`, { title: 'Add to ' + name, onClose: draw });
    const q = s.body.querySelector('[data-q]'), res = s.body.querySelector('[data-res]');
    setTimeout(() => q.focus(), 300);
    const go = () => { const hits = search(q.value, { limit: 30 }); res.innerHTML = hits.map(e => html`<div class="item" data-pick="${e.id}"><div class="main"><div class="hw">${e.it || e.inf}</div><div class="sub">${e.en}</div></div><span class="btn xs ${list.items.includes(e.id) ? 'on' : 'primary'}">${list.items.includes(e.id) ? '✓' : 'Add'}</span></div>`).join(''); };
    q.addEventListener('input', go);
    res.addEventListener('click', (ev) => { const it = ev.target.closest('[data-pick]'); if (!it) return; const eid = it.dataset.pick; if (list.items.includes(eid)) store.removeFromList(id, eid); else store.addToList(id, eid); go(); });
  }
  draw();
}
