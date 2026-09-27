// Entry detail: full word card or verb card with conjugation tables.
import { html, raw, esc, relTime } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, headword } from '../data.js';
import { wordCard, verbCard, bindConjSection, actionBar, bindActionBar } from '../components.js';
import { stage, STAGE_LABEL } from '../srs.js';

export async function render(root, params) {
  const e = getEntry(params.id);
  if (!e) { root.innerHTML = '<div class="empty"><div class="big">🤷</div>Entry not found.</div>'; return; }
  setTitle(e.kind === 'verb' ? e.inf : headword(e));
  store.pushRecent(e.id);
  const it = store.getItem(e.id);
  const st = stage(it);
  const progress = html`<div class="card tight row gap"><span class="stage ${st}"></span><div class="grow small"><b>${STAGE_LABEL[st]}</b>${it && it.seen ? raw(html` · seen ${it.seen}× · ${it.ok} right / ${it.ko} wrong · next review ${relTime(it.due)}`) : ''}</div>${e.kind === 'verb' && !store.isLearned(e.id) ? raw(html`<a class="btn xs primary" href="#/learn/verb/${encodeURIComponent(e.id)}">Learn</a>`) : e.kind === 'word' && !store.isLearned(e.id) ? raw(html`<a class="btn xs primary" href="#/learn/word/${encodeURIComponent(e.id)}">Learn</a>`) : ''}</div>`;
  const lists = store.listsContaining(e.id).map(l => l.name);
  const listsHTML = lists.length ? html`<div class="tiny muted mt">In lists: ${lists.join(', ')}</div>` : '';
  if (e.kind === 'verb') {
    const { html: body, conj } = verbCard(e);
    root.innerHTML = body + progress + html`<div class="card">${raw(actionBar(e))}${raw(listsHTML)}</div>
      <div class="grid2"><a class="tile" href="#/game/conj-drill?src=ids:${encodeURIComponent(e.id)}&tenses=presente,passatoProssimo,imperfetto,futuro"><span class="ico">📝</span><span class="name">Drill this verb</span><span class="desc">type the forms</span></a><a class="tile" href="#/game/conj-choice?src=ids:${encodeURIComponent(e.id)}&tenses=presente,passatoProssimo,imperfetto,futuro,condizionale,congiuntivoPresente"><span class="ico">🎯</span><span class="name">Pick the form</span><span class="desc">multiple choice</span></a></div>`;
    bindConjSection(root, conj);
  } else {
    root.innerHTML = wordCard(e) + progress + html`<div class="card">${raw(actionBar(e))}${raw(listsHTML)}</div>`;
  }
  bindActionBar(root, e, () => { root.querySelector('.card:has([data-act])').innerHTML = actionBar(e) + listsHTML; });
}
