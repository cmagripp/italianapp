// Reference hub (#/reference): the CODEX scene — instant search, quick verb chips, words by topic,
// recently viewed, learned items and the grammar index. Also exports the shared row/link helpers
// used by referenceEntry.js.
import { html, raw, esc, levelBadge, icon, fmtNum, secHead } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, search, headword, shortEn, CATS, getEntry, LEVELS } from '../data.js';
import { conjugate, splitClitic } from '../conjugator.js';
import { stage, STAGE_LABEL } from '../srs.js';
import { setScene, mount } from '../fx.js';
import { IT_POS } from '../components.js';
import { loadGrammar, topicRow } from './grammar.js';

const ic = (name, opts) => raw(icon(name, opts));
export const refHref = (id) => '#/reference/' + encodeURIComponent(id);
export const byLevel = (a, b) => LEVELS.indexOf(a.level || 'C2') - LEVELS.indexOf(b.level || 'C2') || String(a.it || a.inf).localeCompare(String(b.it || b.inf));

// Verb group from the infinitive (clitics stripped): -are · -ere · -ire · -rre
export function verbGroup(e) { const b = splitClitic(e.inf || e.it || '').base; return /rre$/.test(b) ? '-rre' : '-' + b.slice(-3); }

// Entry row for the codex: .row-entry with a mono VERB/WORD tag, level chip and stage dot.
export function refRow(e, { showLevel = true, sub = null, extra = '' } = {}) {
  const st = stage(store.getItem(e.id));
  const learned = store.isLearned(e.id);
  const hw = e.kind === 'verb' ? e.inf : headword(e);
  const s = sub != null ? sub : e.kind === 'verb'
    ? `${shortEn(e.en)}${e.trans ? ' · ' + e.trans : ''}`
    : `${shortEn(e.en)} · ${e.pos === 'noun' ? (e.g === 'mf' ? 'm/f' : e.g || 'nome') : (IT_POS[e.pos] || e.pos || '')}`;
  return html`<a class="row-entry glass-flat ref-row" href="${refHref(e.id)}" data-id="${e.id}">
    <span class="dot stage-${st}" title="${STAGE_LABEL[st]}"></span>
    <span class="re-main"><span class="re-hw">${hw}</span><span class="re-sub">${s}</span></span>
    <span class="re-side"><span class="re-tag ${e.kind}">${e.kind === 'verb' ? 'verb' : 'word'}</span>${showLevel ? raw(levelBadge(e.level || 'A1')) : ''}${learned ? raw(`<span class="check-mark" title="Learned">${icon('check', { size: 18 })}</span>`) : ''}${raw(extra)}</span>
  </a>`;
}
export const refList = (entries) => `<div class="list">${entries.map(e => refRow(e)).join('')}</div>`;

// The build stores the engine's verdict on every dictionary verb (irregularEngine), so the chip does not have to conjugate
// all 1,185 verbs on tap; a custom verb (no field) still asks the engine.
const isIrregular = (e) => (typeof e.irregularEngine === 'boolean' ? e.irregularEngine : conjugate(e.inf, { aux: e.aux, isc: e.isc }).irregular);
const GROUP_CHIPS = [
  { key: 'are', label: '-are', kicker: 'Verbi', title: 'Verbs in -are', filter: e => verbGroup(e) === '-are' },
  { key: 'ere', label: '-ere', kicker: 'Verbi', title: 'Verbs in -ere', filter: e => verbGroup(e) === '-ere' },
  { key: 'ire', label: '-ire', kicker: 'Verbi', title: 'Verbs in -ire', filter: e => verbGroup(e) === '-ire' },
  { key: 'rre', label: '-rre', kicker: 'Verbi', title: 'Verbs in -rre', filter: e => verbGroup(e) === '-rre' },
  { key: 'irregular', label: 'irregolari', kicker: 'Verbi', title: 'Irregular verbs', filter: e => isIrregular(e) },
  { key: 'a1', label: 'top A1', kicker: 'Verbi', title: 'The A1 verbs', filter: e => e.level === 'A1', keepOrder: true },
];
const PAGE = 40;

export async function render(root) {
  setTitle('Reference');
  setScene('reference');
  const nW = data.vocab.length, nV = data.verbs.length;
  const recent = (store.current.recent || []).map(getEntry).filter(Boolean).slice(0, 6);
  const learned = store.learnedIds().map(id => ({ e: getEntry(id), at: store.getItem(id)?.learnedAt || 0 })).filter(x => x.e).sort((a, b) => b.at - a.at).map(x => x.e);
  const topics = await loadGrammar();

  root.innerHTML = html`
    <div class="ref-hero">
      <span class="kicker">Codex · ${fmtNum(nW)} parole · ${fmtNum(nV)} verbi</span>
      <h1 class="ref-title">Ogni parola,<br><em>spiegata.</em></h1>
    </div>
    <div class="glass ref-search">
      <div class="search-box"><span class="ico">${ic('search')}</span><input class="input" id="q" type="search" placeholder="cerca…" aria-label="Search Italian or English" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="search"><button type="button" class="icon-btn clear-q hidden" data-clear aria-label="Clear search">${ic('x', { size: 18 })}</button></div>
    </div>
    <div id="ref-panel" class="ref-panel" hidden></div>
    <div id="ref-browse">
      ${raw(secHead('Verbi', 'Verbs by group'))}
      <div class="chips scroll ref-chips">${raw(GROUP_CHIPS.map(c => html`<button type="button" class="chip" data-group="${c.key}">${c.label}</button>`).join(''))}</div>
      ${raw(secHead('Parole', 'Words by topic', { cls: 'mt-l' }))}
      <div class="ref-topics">${raw(Object.entries(CATS).map(([k, c]) => html`<button type="button" class="ref-topic" data-topic="${k}"><span class="rt-glyph" aria-hidden="true">${c.icon}</span><span class="rt-name">${c.name}</span></button>`).join(''))}</div>
      ${recent.length ? raw(html`${raw(secHead('Di recente', 'Recently viewed', { cls: 'mt-l' }))}${raw(refList(recent))}`) : ''}
      ${learned.length ? raw(html`${raw(secHead('Imparate', 'My learned', { cls: 'mt-l', href: '#/list/learned-words', more: 'All' }))}${raw(refList(learned.slice(0, 6)))}`) : ''}
      ${raw(secHead('Grammatica', 'Grammar', { cls: 'mt-l', href: '#/grammar', more: 'Index' }))}
      <div class="gram-list">${raw(topics.map(topicRow).join(''))}</div>
    </div>`;
  mount(root);

  const q = root.querySelector('#q'), clear = root.querySelector('[data-clear]');
  const panel = root.querySelector('#ref-panel'), browse = root.querySelector('#ref-browse');
  let active = null;      // { kind:'search'|'group'|'topic', key }
  let entries = [], shown = 0;

  function paintList(append = false) {
    const list = panel.querySelector('[data-list]');
    const slice = entries.slice(shown, shown + PAGE);
    shown += slice.length;
    if (append) list.insertAdjacentHTML('beforeend', slice.map(e => refRow(e)).join(''));
    else list.innerHTML = slice.map(e => refRow(e)).join('');
    const more = panel.querySelector('[data-more]');
    if (more) { more.classList.toggle('hidden', shown >= entries.length); more.textContent = `Show ${Math.min(PAGE, entries.length - shown)} more`; }
  }
  function showPanel({ kicker, title, list, empty = '' }) {
    entries = list; shown = 0;
    panel.hidden = false;
    panel.innerHTML = html`<div class="sec-head panel-head"><div><span class="kicker">${kicker}</span><span class="title">${title}</span></div><span class="panel-side"><span class="panel-count">${fmtNum(list.length)}</span><button type="button" class="icon-btn" data-close aria-label="Close">${ic('x', { size: 18 })}</button></span></div>
      ${list.length ? raw(html`<div class="list" data-list></div><p class="center mt"><button type="button" class="btn sm ghost" data-more>Show more</button></p>`) : raw(empty)}`;
    if (list.length) paintList();
  }
  function closePanel() {
    active = null; panel.hidden = true; panel.innerHTML = ''; browse.classList.remove('hidden');
    root.querySelectorAll('[data-group].on, [data-topic].on').forEach(b => b.classList.remove('on'));
  }
  function markActive() {
    root.querySelectorAll('[data-group], [data-topic]').forEach(b => b.classList.toggle('on', !!active && ((active.kind === 'group' && b.dataset.group === active.key) || (active.kind === 'topic' && b.dataset.topic === active.key))));
  }
  let timer = null;
  const doSearch = () => {
    const v = q.value.trim();
    clear.classList.toggle('hidden', !v);
    if (!v) { if (active?.kind === 'search') closePanel(); return; }
    active = { kind: 'search', key: v }; markActive();
    browse.classList.add('hidden');
    const hits = search(v, { limit: 60 });
    showPanel({ kicker: 'Risultati', title: `“${v}”`, list: hits, empty: html`<div class="empty"><p>Nessun risultato per “${v}”.</p><a class="btn sm" href="#/add?it=${encodeURIComponent(v)}">${ic('plus', { size: 16 })} Add it as a custom word</a></div>` });
  };
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doSearch, 70); });
  q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { q.blur(); clearTimeout(timer); doSearch(); } if (ev.key === 'Escape') { q.value = ''; doSearch(); } });

  root.addEventListener('click', onClick);
  function onClick(ev) {
    if (ev.target.closest('[data-clear]')) { q.value = ''; doSearch(); q.focus(); return; }
    if (ev.target.closest('[data-close]')) { if (active?.kind === 'search') { q.value = ''; } closePanel(); return; }
    if (ev.target.closest('[data-more]')) { paintList(true); return; }
    const g = ev.target.closest('[data-group]');
    if (g) {
      const c = GROUP_CHIPS.find(x => x.key === g.dataset.group);
      if (active?.kind === 'group' && active.key === c.key) { closePanel(); return; }
      let list = data.verbs.filter(c.filter); if (!c.keepOrder) list = list.slice().sort(byLevel);
      active = { kind: 'group', key: c.key }; markActive(); browse.classList.remove('hidden');
      showPanel({ kicker: c.kicker, title: c.title, list, empty: '<div class="empty"><p>Niente qui.</p></div>' });
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const t = ev.target.closest('[data-topic]');
    if (t) {
      const key = t.dataset.topic;
      if (active?.kind === 'topic' && active.key === key) { closePanel(); return; }
      const list = [...data.vocab.filter(e => e.cat === key), ...data.verbs.filter(e => e.cat === key)].sort(byLevel);
      active = { kind: 'topic', key }; markActive(); browse.classList.remove('hidden');
      showPanel({ kicker: 'Parole', title: CATS[key]?.name || key, list, empty: '<div class="empty"><p>Niente qui.</p></div>' });
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  return () => { clearTimeout(timer); root.removeEventListener('click', onClick); };
}
