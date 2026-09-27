// Words tab: big glass search bar with instant results, quick tiles, a reel of level posters and a glass grid of topics.
import { html, raw, tr, icon, fmtNum, secHead } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, LEVELS, LEVEL_INFO, CATS, search } from '../data.js';
import { entryRow } from '../components.js';
import { reel, mount } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));

// Short topic names for tiles and chips (the full CATS name is used on the browse hero).
export const SHORT_CAT = {
  basics: 'Basics', people: 'People', body: 'Body & health', emotions: 'Emotions', food: 'Food & drink', home: 'Home', clothing: 'Clothing', daily: 'Daily life',
  shopping: 'Shopping', city: 'City', travel: 'Travel', nature: 'Nature', animals: 'Animals', time: 'Time', numbers: 'Numbers', colors: 'Colours', work: 'Work',
  school: 'School', tech: 'Tech & media', arts: 'Arts', sports: 'Sports', society: 'Society', economy: 'Economy', science: 'Science', abstract: 'Ideas',
  communication: 'Function words', description: 'Describing', expressions: 'Idioms',
};
export const shortCat = (k) => SHORT_CAT[k] || String(CATS[k]?.name || k).split(/[,&]/)[0].trim();

const kindTag = (e) => `<span class="re-tag ${e.kind}">${e.kind === 'verb' ? 'verb' : 'word'}</span>`;

export async function render(root) {
  setTitle('Words');
  const lists = Object.values(store.lists);
  const learnedW = store.learnedIds().filter(id => !id.startsWith('v:')).length, learnedV = store.learnedIds('v:').length;
  const byLevel = {}; const byCat = {};
  for (const e of [...data.vocab, ...data.verbs]) {
    const L = (byLevel[e.level] ||= { words: 0, verbs: 0, learned: 0 });
    if (e.kind === 'verb') L.verbs++; else L.words++;
    if (store.isLearned(e.id)) L.learned++;
    byCat[e.cat] = (byCat[e.cat] || 0) + 1;
  }
  const myLevel = store.settings.level || 'A1';

  root.innerHTML = html`<div class="pg pg-words">
    <div class="pg-head">
      <span class="kicker">Dizionario · ${fmtNum(data.vocab.length)} words · ${fmtNum(data.verbs.length)} verbs</span>
      <div class="title it">${raw(tr('Cerca una parola', 'Look up a word'))}</div>
    </div>
    <div class="sbar" data-sbar>
      <span class="ico">${ic('search', { size: 22 })}</span>
      <input id="q" type="search" placeholder="cerca…" aria-label="Search Italian or English" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="search">
      <button type="button" class="icon-btn clear" data-clear aria-label="Clear search">${ic('x', { size: 18 })}</button>
    </div>
    <div id="results" class="results"></div>
    <div id="browse" class="browse">
      <div class="qgrid">
        <a class="qtile wide" href="#/lists" style="--qc:var(--gold)"><span class="qi">${ic('list')}</span><span class="qt"><span class="name">My lists</span><span class="desc">${lists.length} list${lists.length === 1 ? '' : 's'} · word bank ${store.lists.bank.items.length}</span></span><span class="chev">${ic('chevronRight', { size: 20 })}</span></a>
        <a class="qtile" href="#/reference" style="--qc:var(--amalfi)"><span class="qi">${ic('book')}</span><span class="qt"><span class="name">Reference</span><span class="desc">Full overview</span></span></a>
        <a class="qtile" href="#/add" style="--qc:var(--terracotta)"><span class="qi">${ic('plus')}</span><span class="qt"><span class="name">Add a word</span><span class="desc">Custom entries</span></span></a>
        <a class="qtile" href="#/list/learned-words" style="--qc:var(--ok)"><span class="qi">${ic('check')}</span><span class="qt"><span class="name">Learned words</span><span class="desc">${learnedW} words</span></span></a>
        <a class="qtile" href="#/list/learned-verbs" style="--qc:var(--olive)"><span class="qi">${ic('flame')}</span><span class="qt"><span class="name">Learned verbs</span><span class="desc">${learnedV} verbs</span></span></a>
      </div>
      <div class="section">
        ${raw(secHead('By level', raw(tr('Livelli', 'Levels'))))}
        <div class="reel lvl-reel" data-reel>${raw(LEVELS.map(L => {
          const c = byLevel[L] || { words: 0, verbs: 0, learned: 0 }; const total = c.words + c.verbs; const p = total ? Math.round((c.learned / total) * 100) : 0;
          return html`<a class="poster" href="#/browse/${L}" style="--lc:var(--lvl-${L})"><span class="poster-glyph">${L === myLevel ? '●' : ''}</span><span class="poster-kicker">${LEVEL_INFO[L].name}</span><span class="poster-title">${L}</span><span class="poster-it">${LEVEL_INFO[L].it}</span><span class="sub">${fmtNum(c.words)} words · ${c.verbs} verbs</span><span class="poster-bar"><i style="width:${Math.max(p ? 4 : 0, p)}%"></i></span><span class="poster-pct">${p}% learned</span></a>`;
        }).join(''))}</div>
      </div>
      <div class="section">
        ${raw(secHead('By topic', raw(tr('Temi', 'Topics'))))}
        <div class="topic-grid">${raw(Object.entries(CATS).map(([k, c]) => html`<a class="topic" href="#/browse/all/${k}"><span class="trow"><span class="glyph">${c.icon}</span><span class="tcount">${byCat[k] || 0}</span></span><span class="tname">${shortCat(k)}</span></a>`).join(''))}</div>
      </div>
      <div class="section">
        ${raw(secHead('Everything', raw(tr('Tutto', 'All of it'))))}
        <div class="list">
          <a class="row-entry glass-flat big-row" href="#/browse?kind=verb"><span class="qi" style="--qc:var(--terracotta)">${ic('dial')}</span><span class="re-main"><span class="re-hw">All verbs</span><span class="re-sub">${fmtNum(data.verbs.length)} verbs · every mood and tense</span></span><span class="re-side">${ic('chevronRight', { size: 20 })}</span></a>
          <a class="row-entry glass-flat big-row" href="#/browse"><span class="qi" style="--qc:var(--amalfi)">${ic('sparkle')}</span><span class="re-main"><span class="re-hw">All words</span><span class="re-sub">${fmtNum(data.vocab.length + data.verbs.length)} entries · A1 to C2</span></span><span class="re-side">${ic('chevronRight', { size: 20 })}</span></a>
        </div>
      </div>
    </div>
  </div>`;

  const page = root.firstElementChild;
  const q = root.querySelector('#q'), results = root.querySelector('#results'), browse = root.querySelector('#browse'), sbar = root.querySelector('[data-sbar]');
  let t = null; let kind = '';
  const doSearch = () => {
    const v = q.value.trim();
    sbar.classList.toggle('has', !!v);
    if (!v) { results.innerHTML = ''; browse.classList.remove('hidden'); return; }
    browse.classList.add('hidden');
    const LIMIT = 60;
    const hits = search(v, { limit: LIMIT, kind: kind || null });
    const seg = html`<div class="seg" role="group" aria-label="Kind">${raw(['', 'word', 'verb'].map(k => html`<button type="button" class="${kind === k ? 'on' : ''}" data-kind="${k}">${k === '' ? 'All' : k === 'word' ? 'Words' : 'Verbs'}</button>`).join(''))}</div>`;
    const head = html`<div class="res-head"><span class="kicker">${hits.length ? `${hits.length}${hits.length === LIMIT ? '+' : ''} result${hits.length === 1 ? '' : 's'}` : 'No results'} for “${v}”</span>${raw(seg)}</div>`;
    const addHref = `#/add?it=${encodeURIComponent(v)}`;
    results.innerHTML = head + (hits.length
      ? `<div class="list">${hits.map(e => entryRow(e, { extra: kindTag(e) })).join('')}</div>` + html`<p class="center mt"><a class="btn sm ghost" href="${addHref}">${ic('plus', { size: 16 })}Not what you meant? Add a custom word</a></p>`
      : html`<div class="empty"><p>${raw(tr(`Nessun risultato per “${v}”.`, `No match for “${v}”.`))}</p><a class="btn primary" href="${addHref}">Add “${v}” as a custom word</a></div>`);
  };
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(doSearch, 120); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(t); q.blur(); doSearch(); } });
  root.querySelector('[data-clear]').addEventListener('click', () => { q.value = ''; clearTimeout(t); doSearch(); q.focus(); });
  results.addEventListener('click', (ev) => { const b = ev.target.closest('[data-kind]'); if (!b) return; kind = b.dataset.kind; doSearch(); });

  const r = reel(root.querySelector('[data-reel]'));
  r.scrollTo(Math.max(0, LEVELS.indexOf(myLevel)), false);
  mount(page);
  mount(browse, { stagger: 70 });
  return () => { clearTimeout(t); r.destroy(); };
}
