// Words tab: search, browse by level/category, lists.
import { html, raw, esc, levelBadge } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, LEVELS, LEVEL_INFO, CATS, search } from '../data.js';
import { entryRow } from '../components.js';

export async function render(root) {
  setTitle('Words');
  const lists = Object.values(store.lists);
  const learnedW = store.learnedIds().filter(id => !id.startsWith('v:')).length, learnedV = store.learnedIds('v:').length;
  root.innerHTML = html`
    <div class="search-box mb"><span class="ico">🔍</span><input class="input" id="q" type="search" placeholder="Search Italian or English…" autocapitalize="off" autocorrect="off" autocomplete="off" enterkeyhint="search"></div>
    <div id="results"></div>
    <div id="browse">
      <div class="grid2 mb">
        <a class="tile" href="#/lists"><span class="ico">📋</span><span class="name">My lists</span><span class="desc">${lists.length} list${lists.length === 1 ? '' : 's'} · word bank ${store.lists.bank.items.length}</span></a>
        <a class="tile" href="#/reference"><span class="ico">📖</span><span class="name">Reference</span><span class="desc">Full overview of any word or verb</span></a>
        <a class="tile" href="#/add"><span class="ico">➕</span><span class="name">Add a word</span><span class="desc">Custom words & verbs</span></a>
        <a class="tile" href="#/list/learned-words"><span class="ico">✅</span><span class="name">Learned words</span><span class="desc">${learnedW} words</span></a>
        <a class="tile" href="#/list/learned-verbs"><span class="ico">🏁</span><span class="name">Learned verbs</span><span class="desc">${learnedV} verbs</span></a>
      </div>
      <div class="section"><div class="section-head"><h2>By level</h2></div>
        <div class="list">${raw(LEVELS.map(L => html`<a class="item" href="#/browse/${L}"><div style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:900;color:#fff;background:${LEVEL_INFO[L].color}">${L}</div><div class="main"><div class="hw">${LEVEL_INFO[L].name} <span class="muted tiny">· ${LEVEL_INFO[L].it}</span></div><div class="sub">${LEVEL_INFO[L].desc}</div></div><span class="badge">${data.vocab.filter(e => e.level === L).length + data.verbs.filter(e => e.level === L).length}</span></a>`).join(''))}</div>
      </div>
      <div class="section"><div class="section-head"><h2>By topic</h2></div>
        <div class="grid3 wide">${raw(Object.entries(CATS).map(([k, c]) => html`<a class="tile" href="#/browse/all/${k}" style="min-height:70px"><span class="ico" style="font-size:22px">${c.icon}</span><span class="name" style="font-size:13px">${c.name}</span></a>`).join(''))}</div>
      </div>
      <div class="section"><div class="section-head"><h2>Verbs</h2></div><a class="item" href="#/browse?kind=verb"><span style="font-size:24px">🔤</span><div class="main"><div class="hw">All verbs</div><div class="sub">${data.verbs.length} verbs with full conjugation tables</div></div></a></div>
    </div>`;
  const q = root.querySelector('#q'), results = root.querySelector('#results'), browse = root.querySelector('#browse');
  let t = null;
  const doSearch = () => {
    const v = q.value.trim();
    if (!v) { results.innerHTML = ''; browse.classList.remove('hidden'); return; }
    browse.classList.add('hidden');
    const hits = search(v, { limit: 50 });
    results.innerHTML = hits.length ? `<div class="list">${hits.map(e => entryRow(e)).join('')}</div>` : html`<div class="empty"><div class="big">🤔</div><p>No match for “${v}”.</p><a class="btn primary" href="#/add?it=${encodeURIComponent(v)}">Add “${v}” as a custom word</a></div>`;
    if (hits.length) results.insertAdjacentHTML('beforeend', html`<p class="center mt"><a class="btn sm ghost" href="#/add?it=${encodeURIComponent(v)}">Not what you meant? Add a custom word</a></p>`);
  };
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(doSearch, 120); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { q.blur(); doSearch(); } });
}
