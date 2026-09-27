// My lists: word bank, custom lists, learned collections.
import { html, raw, esc, promptDialog, confirmDialog, toast } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';

export async function render(root) {
  setTitle('My lists');
  function draw() {
    const lists = Object.values(store.lists);
    const learnedW = store.learnedIds().filter(id => !id.startsWith('v:')).length, learnedV = store.learnedIds('v:').length;
    const custom = Object.keys(store.current.custom || {}).length;
    root.innerHTML = html`
      <div class="list">
        ${raw(lists.map(l => html`<a class="item" href="#/list/${encodeURIComponent(l.id)}"><span style="font-size:24px">${l.id === 'bank' ? '⭐' : '📋'}</span><div class="main"><div class="hw">${l.name}</div><div class="sub">${l.items.length} items</div></div>${l.id !== 'bank' ? raw(html`<button class="icon-btn" data-menu="${l.id}" aria-label="List options">⋯</button>`) : ''}</a>`).join(''))}
        <a class="item" href="#/list/learned-words"><span style="font-size:24px">✅</span><div class="main"><div class="hw">Learned words</div><div class="sub">${learnedW} words</div></div></a>
        <a class="item" href="#/list/learned-verbs"><span style="font-size:24px">🏁</span><div class="main"><div class="hw">Learned verbs</div><div class="sub">${learnedV} verbs</div></div></a>
        <a class="item" href="#/list/custom"><span style="font-size:24px">✏️</span><div class="main"><div class="hw">My custom words</div><div class="sub">${custom} added by you</div></div></a>
      </div>
      <div class="row gap mt"><button class="btn primary grow" data-new>＋ New list</button><a class="btn ghost grow" href="#/add">Add a word</a></div>
      <p class="tiny muted mt">Tip: open any word and tap “＋ List” to file it. Lists can be used as the source for every game and as your study scope.</p>`;
    root.querySelector('[data-new]').addEventListener('click', async () => { const name = await promptDialog('Name of the new list', { placeholder: 'e.g. Restaurant words' }); if (name) { store.createList(name); draw(); } });
    root.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const id = b.dataset.menu; const l = store.lists[id];
      const { sheet } = await import('../ui.js');
      const s = sheet(html`<button class="btn block mb" data-a="rename">Rename</button><button class="btn block mb" data-a="play">Play with this list</button><button class="btn block mb" data-a="scope">Study this list</button><button class="btn danger block" data-a="delete">Delete list</button>`, { title: l.name });
      s.body.addEventListener('click', async (e2) => {
        const a = e2.target.closest('[data-a]'); if (!a) return; s.close();
        if (a.dataset.a === 'rename') { const n = await promptDialog('Rename list', { value: l.name }); if (n) { store.renameList(id, n); draw(); } }
        else if (a.dataset.a === 'delete') { if (await confirmDialog(`Delete “${l.name}”? The words themselves are kept.`, { ok: 'Delete', danger: true })) { store.deleteList(id); draw(); } }
        else if (a.dataset.a === 'play') location.hash = `#/games?pick=quiz&src=list:${id}`;
        else if (a.dataset.a === 'scope') { store.setScope({ mode: 'lists', lists: [id] }); toast('Study scope set to ' + l.name, { kind: 'ok' }); }
      });
    }));
  }
  draw();
}
