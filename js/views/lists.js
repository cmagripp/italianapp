// My lists: the word bank pane, custom lists with a glass dropdown menu, learned and custom collections.
import { html, raw, esc, tr, icon, promptDialog, confirmDialog, toast } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { dropdown, mount } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const listRow = ({ href, name, sub, count, color, iconName, menu = null }) => html`<div class="list-row">
  <a class="lr-main" href="${href}"><span class="qi" style="--qc:${color}">${ic(iconName)}</span><span class="lr-text"><span class="lr-name">${name}</span><span class="lr-sub">${sub}</span></span><span class="lr-count">${count}</span></a>
  ${menu ? raw(html`<button type="button" class="icon-btn" data-menu="${menu}" aria-label="List options" aria-haspopup="menu">${ic('dots', { size: 20 })}</button>`) : ''}
</div>`;

export async function render(root) {
  setTitle('My lists');
  function draw() {
    const bank = store.lists.bank;
    const custom = Object.values(store.lists).filter(l => l.id !== 'bank');
    const learnedW = store.learnedIds().filter(id => !id.startsWith('v:')).length, learnedV = store.learnedIds('v:').length;
    const customN = Object.keys(store.current.custom || {}).length;
    const bankLearned = bank.items.filter(id => store.isLearned(id)).length;
    root.innerHTML = html`<div class="pg pg-lists">
      <div class="pg-head row between gap"><div><span class="kicker">Collections</span><div class="title it">${raw(tr('Le mie liste', 'My lists'))}</div></div><button type="button" class="btn sm primary" data-new>${ic('plus', { size: 16 })}New list</button></div>
      <a class="bank-pane glass" href="#/list/bank"><span class="qi lg" style="--qc:var(--gold)">${ic('star')}</span><span class="bp-main"><span class="bp-name">My word bank</span><span class="bp-sub">${plural(bank.items.length, 'item', 'items')} · ${bankLearned} learned · starred from any entry</span></span><span class="bp-count">${bank.items.length}</span></a>
      <div class="section">
        <div class="grp-kicker"><span class="kicker">Custom lists</span><span class="kicker">${custom.length}</span></div>
        ${custom.length
          ? raw(`<div class="list">${custom.map(l => listRow({ href: '#/list/' + encodeURIComponent(l.id), name: l.name, sub: plural(l.items.length, 'item', 'items'), count: l.items.length, color: 'var(--amalfi)', iconName: 'list', menu: l.id })).join('')}</div>`)
          : raw(html`<div class="empty"><p>${raw(tr('Nessuna lista, per ora.', 'No lists yet.'))}</p><p class="small muted">Group words any way you like: a list can be your study scope or the source for every game.</p></div>`)}
      </div>
      <div class="section">
        <div class="grp-kicker"><span class="kicker">Learned &amp; custom</span></div>
        <div class="list">
          ${raw(listRow({ href: '#/list/learned-words', name: 'Learned words', sub: `${learnedW} words`, count: learnedW, color: 'var(--ok)', iconName: 'check' }))}
          ${raw(listRow({ href: '#/list/learned-verbs', name: 'Learned verbs', sub: `${learnedV} verbs`, count: learnedV, color: 'var(--olive)', iconName: 'flame' }))}
          ${raw(listRow({ href: '#/list/custom', name: 'My custom words', sub: `${customN} added by you`, count: customN, color: 'var(--terracotta)', iconName: 'edit' }))}
        </div>
      </div>
      <p class="tiny muted lists-tip">Open any entry and tap “List” to file it. Lists work as the source for every game and as your study scope.</p>
    </div>`;
    root.querySelector('[data-new]').addEventListener('click', async () => { const name = await promptDialog('Name of the new list', { placeholder: 'e.g. Restaurant words' }); if (name) { store.createList(name); draw(); } });
    root.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', (ev) => { ev.preventDefault(); openMenu(b, b.dataset.menu); }));
    mount(root.firstElementChild);
  }
  function openMenu(anchor, id) {
    const l = store.lists[id]; if (!l) return;
    const opt = (v, label, sub, ico, cls = '') => `<button type="button" class="opt act ${cls}" role="menuitem" data-value="${v}"><span class="opt-main"><span class="opt-label">${esc(label)}</span>${sub ? `<span class="opt-sub">${esc(sub)}</span>` : ''}</span>${icon(ico, { size: 18 })}</button>`;
    const content = `<div class="dropdown-title">${esc(l.name)}</div><div class="dropdown-list">${opt('rename', 'Rename', '', 'edit')}${opt('play', 'Play with this list', 'Quiz, flashcards and more', 'play')}${opt('scope', 'Study this list', 'Set as study scope', 'book')}${opt('delete', 'Delete list', 'The words themselves are kept', 'trash', 'danger')}</div>`;
    dropdown(anchor, content, { align: 'end', width: 264, onSelect: async (v) => {
      if (v === 'rename') { const n = await promptDialog('Rename list', { value: l.name }); if (n) { store.renameList(id, n); draw(); } }
      else if (v === 'delete') { if (await confirmDialog(`Delete “${l.name}”? The words themselves are kept.`, { ok: 'Delete', danger: true })) { store.deleteList(id); draw(); } }
      else if (v === 'play') location.hash = `#/games?pick=quiz&src=list:${id}`;
      else if (v === 'scope') { store.setScope({ mode: 'lists', lists: [id] }); toast('Study scope set to ' + l.name, { kind: 'ok' }); }
    } });
  }
  draw();
}
