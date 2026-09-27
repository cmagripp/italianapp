// Learn tab: daily plan with next verbs / words to introduce, reviews, and scope.
import { html, raw, esc, progressBar, levelBadge } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, itemsForScope, describeScope, shuffle, headword, shortEn, CATS, dailyPick } from '../data.js';
import { entryRow } from '../components.js';

// deterministic-ish ordering of new items within the scope: by level, then rotate by category so the user sees variety
export function nextNew(kind, n = 5) {
  const items = itemsForScope(store.scope, store, { kind }).filter(e => !store.isLearned(e.id) && !(store.getItem(e.id)?.seen > 2));
  // order: level asc, then interleave categories
  const byCat = {};
  for (const e of items) (byCat[e.level + '|' + e.cat] ||= []).push(e);
  const keys = Object.keys(byCat).sort();
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 1000) {
    let added = false;
    for (const k of keys) { const arr = byCat[k]; if (arr.length) { out.push(arr.shift()); added = true; if (out.length >= n) break; } }
    if (!added) break;
  }
  return out;
}

export async function render(root) {
  setTitle('Learn');
  const day = store.today();
  const s = store.settings;
  const due = store.dueIds().length;
  const newWordsDone = (day.new || 0) - (day.newVerbs || 0);
  const newVerbsDone = day.newVerbs || 0;
  const verbs = nextNew('verb', 4);
  const words = nextNew('word', 6);
  const scopeAll = itemsForScope(store.scope, store);
  const learnedInScope = scopeAll.filter(e => store.isLearned(e.id)).length;
  const learnedVerbs = store.learnedIds('v:').length;

  root.innerHTML = html`
    <div class="card">
      <div class="row between"><h3 style="margin:0">Study scope</h3><a class="btn xs ghost" href="#/scope">Change</a></div>
      <div class="muted small">${describeScope(store.scope, store)}</div>
      <div class="tiny muted mt-s">${learnedInScope} / ${scopeAll.length} learned</div>${raw(progressBar(learnedInScope, scopeAll.length, 'thin'))}
    </div>

    <div class="section">
      <div class="section-head"><h2>Review</h2><a href="#/games">games</a></div>
      ${due ? raw(html`<a class="card flat row gap" href="#/review" style="display:flex"><span style="font-size:28px">🔁</span><div class="grow"><div class="bold">${due} item${due === 1 ? '' : 's'} due</div><div class="tiny muted">Adaptive review: flashcards, typing and quizzes on what you are about to forget.</div></div><span class="btn sm primary">Start</span></a>`) : raw(html`<div class="card flat muted small">Nothing due right now. Learn something new below, or <a href="#/review?mode=extra">review ahead</a>.</div>`)}
    </div>

    <div class="section">
      <div class="section-head"><h2>New verbs</h2><span class="tiny muted">${newVerbsDone}/${s.dailyVerbs} today · ${learnedVerbs} learned</span></div>
      ${verbs.length ? raw(`<div class="list">${verbs.map(e => entryRow(e, { href: '#/learn/verb/' + encodeURIComponent(e.id), extra: '<span class="btn xs primary">Learn</span>' })).join('')}</div>`) : raw('<div class="card flat muted small">No new verbs left in this scope — widen your scope or pick another level.</div>')}
    </div>

    <div class="section">
      <div class="section-head"><h2>New words</h2><span class="tiny muted">${newWordsDone}/${s.dailyNew} today</span></div>
      ${words.length ? raw(`<div class="list">${words.map(e => entryRow(e, { href: '#/learn/word/' + encodeURIComponent(e.id), extra: '<span class="btn xs primary">Learn</span>' })).join('')}</div>`) : raw('<div class="card flat muted small">No new words left in this scope.</div>')}
      ${words.length ? raw(html`<a class="btn block mt" href="#/learn/word/${encodeURIComponent(words[0].id)}?auto=1">Start a word session (${Math.min(words.length, Math.max(1, s.dailyNew - newWordsDone) || 5)} words)</a>`) : ''}
    </div>

    <div class="section">
      <div class="section-head"><h2>Verb lab</h2></div>
      <div class="grid2">
        <a class="tile" href="#/game/conj-drill?src=learned-verbs"><span class="ico">📝</span><span class="name">Conjugation drill</span><span class="desc">learned verbs</span></a>
        <a class="tile" href="#/game/verb-quiz?src=scope"><span class="ico">🎲</span><span class="name">Verb mix</span><span class="desc">current scope</span></a>
        <a class="tile" href="#/browse?kind=verb"><span class="ico">📖</span><span class="name">All verbs</span><span class="desc">${data.verbs.length} with full tables</span></a>
        <a class="tile" href="#/lists"><span class="ico">📋</span><span class="name">My lists</span><span class="desc">word bank & custom</span></a>
      </div>
    </div>`;
}
