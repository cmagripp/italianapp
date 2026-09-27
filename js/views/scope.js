// Study scope: which levels / topics / lists feed Learn, Review and the default game source.
import { html, raw, esc, toast } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, LEVELS, LEVEL_INFO, CATS, itemsForScope } from '../data.js';

export async function render(root) {
  setTitle('Study scope');
  const sc = { mode: 'level', levels: ['A1'], cats: [], lists: [], ...JSON.parse(JSON.stringify(store.scope)) };
  function draw() {
    const count = itemsForScope(sc, store).length;
    const lists = Object.values(store.lists);
    root.innerHTML = html`
      <p class="muted small">Choose what “Learn”, “Review” and the games draw from by default. You can still pick any list or level when starting a game.</p>
      <div class="seg mb"><button data-mode="level" class="${sc.mode === 'level' ? 'on' : ''}">Levels & topics</button><button data-mode="lists" class="${sc.mode === 'lists' ? 'on' : ''}">My lists</button><button data-mode="learned" class="${sc.mode === 'learned' ? 'on' : ''}">Learned</button><button data-mode="all" class="${sc.mode === 'all' ? 'on' : ''}">All</button></div>
      ${sc.mode === 'level' ? raw(html`
        <div class="card"><h4>Levels</h4><div class="chips">${raw(LEVELS.map(L => html`<button class="chip ${sc.levels.includes(L) ? 'on' : ''}" data-level="${L}">${L} <span class="tiny">${LEVEL_INFO[L].name}</span></button>`).join(''))}</div></div>
        <div class="card"><h4>Topics <span class="tiny muted">(none selected = all)</span></h4><div class="chips">${raw(Object.entries(CATS).map(([k, c]) => html`<button class="chip sm ${sc.cats.includes(k) ? 'on' : ''}" data-cat="${k}">${c.icon} ${c.name}</button>`).join(''))}</div></div>`) : ''}
      ${sc.mode === 'lists' ? raw(html`<div class="card"><h4>Lists</h4><div class="list">${raw(lists.map(l => html`<label class="item"><input type="checkbox" data-list="${l.id}" ${sc.lists.includes(l.id) ? 'checked' : ''}><div class="main"><div class="hw">${l.name}</div><div class="sub">${l.items.length} items</div></div></label>`).join(''))}</div></div>`) : ''}
      ${sc.mode === 'learned' ? raw('<div class="card muted small">Only words and verbs you have already learned: ideal for consolidation.</div>') : ''}
      ${sc.mode === 'all' ? raw('<div class="card muted small">The whole dictionary, A1 to C2. New items are introduced level by level.</div>') : ''}
      <div class="sticky-actions"><button class="btn primary block" data-save>Use this scope (${count} items)</button></div>`;
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { sc.mode = b.dataset.mode; draw(); }));
    root.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { const L = b.dataset.level; sc.levels = sc.levels.includes(L) ? sc.levels.filter(x => x !== L) : [...sc.levels, L]; if (!sc.levels.length) sc.levels = [L]; draw(); }));
    root.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { const c = b.dataset.cat; sc.cats = sc.cats.includes(c) ? sc.cats.filter(x => x !== c) : [...sc.cats, c]; draw(); }));
    root.querySelectorAll('[data-list]').forEach(cb => cb.addEventListener('change', () => { const id = cb.dataset.list; sc.lists = cb.checked ? [...new Set([...sc.lists, id])] : sc.lists.filter(x => x !== id); draw(); }));
    root.querySelector('[data-save]').addEventListener('click', () => { store.setScope(sc); if (sc.mode === 'level' && sc.levels.length === 1) store.setSetting('level', sc.levels[0]); toast('Study scope saved', { kind: 'ok' }); history.length > 1 ? history.back() : (location.hash = '#/learn'); });
  }
  draw();
}
