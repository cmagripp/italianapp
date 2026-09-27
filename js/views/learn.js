// Learn hub: scope line (glass dropdown), NEXT UP decks (verbs / words), review ring, verb lab tiles.
import { html, raw, esc, tr, enPill, speakBtn, levelBadge, secHead, relTime, toast, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, itemsForScope, describeScope, LEVELS, LEVEL_INFO, CATS, article, withArticle, isPluralOnly } from '../data.js';
import { IT_POS } from '../components.js';
import { conjugate } from '../conjugator.js';
import { setScene, dropdown, mount, reducedMotion } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));

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

const fit = (w) => { const n = String(w || '').length; return n <= 8 ? 44 : n <= 12 ? 38 : n <= 18 ? 30 : n <= 26 ? 24 : 20; };
const pad2 = (n) => String(n).padStart(2, '0');

function deckCard(e, i, n) {
  const isVerb = e.kind === 'verb';
  const isNoun = e.pos === 'noun';
  const plural = isNoun && isPluralOnly(e);
  const art = isNoun ? article(e, plural) : '';
  const word = isVerb ? e.inf : (plural ? e.pl : e.it);
  const say = isVerb ? e.inf : (isNoun ? withArticle(e, plural) : e.it);
  const href = `#/learn/${isVerb ? 'verb' : 'word'}/${encodeURIComponent(e.id)}`;
  let tags;
  if (isVerb) {
    const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
    tags = html`<span>verbo</span><span>${c.group}</span><span>${c.irregular ? 'irregolare' : 'regolare'}</span><span>aux. ${e.aux === 'both' ? 'avere / essere' : e.aux}</span>`;
  } else tags = html`<span>${IT_POS[e.pos] || e.pos}</span>${isNoun ? raw(html`<span>${e.g === 'mf' ? 'm · f' : e.g}</span>`) : ''}${e.cat && CATS[e.cat] ? raw(html`<span>${CATS[e.cat].name}</span>`) : ''}`;
  return html`<article class="deck-card" data-pos="${i}" data-href="${href}" ${i ? raw('aria-hidden="true" inert') : ''}>
    <div class="deck-top"><span class="kicker">${isVerb ? 'Next verb' : 'Next word'}</span><span class="rail-count">${pad2(i + 1)} / ${pad2(n)}</span></div>
    <div class="deck-hw">${art ? raw(html`<span class="article">${art}</span>`) : ''}<span class="word" style="--hw:${fit(word)}px">${word}</span></div>
    <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(say))}</div>
    <div class="tags">${raw(levelBadge(e.level || 'A1'))}${raw(tags)}</div>
    <div class="deck-actions"><a class="btn primary grow" href="${href}">${isVerb ? 'Learn this verb' : 'Learn this word'}${ic('arrow', { size: 20 })}</a>${n > 1 ? raw(html`<button type="button" class="icon-btn deck-next" aria-label="Show the next card">${ic('refresh', { size: 20 })}</button>`) : ''}</div>
  </article>`;
}

function deckHTML(kind, entries) {
  if (!entries.length) return html`<div class="empty deck-empty"><p>${kind === 'verb' ? 'No new verbs left in this scope.' : 'No new words left in this scope.'}</p><a class="btn secondary sm" href="#/scope">${ic('orbit', { size: 16 })}Widen the scope</a></div>`;
  return html`<div class="deck live" data-deck="${kind}">${raw(entries.map((e, i) => deckCard(e, i, entries.length)).join(''))}</div>`;
}

// Stacked cards: the top card is live, the two behind peek out; "next" (or a horizontal swipe) sends the top card to the back.
function bindDeck(deck) {
  const cards = () => [...deck.querySelectorAll(':scope > .deck-card')];
  const place = () => cards().forEach(c => { const top = c.dataset.pos === '0'; if (top) { c.removeAttribute('aria-hidden'); c.removeAttribute('inert'); } else { c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', ''); } });
  let busy = false;
  function cycle() {
    const cs = cards(); if (cs.length < 2 || busy) return;
    const n = cs.length;
    const top = cs.find(c => c.dataset.pos === '0');
    busy = true;
    const finish = () => { cs.forEach(c => { c.dataset.pos = String((Number(c.dataset.pos) + n - 1) % n); }); top.classList.remove('leaving'); place(); busy = false; };
    if (reducedMotion()) { finish(); return; }
    top.classList.add('leaving');
    setTimeout(finish, 240);
  }
  // pointer swipe (horizontal) → cycle; vertical scrolling stays native (touch-action: pan-y)
  let sx = 0, sy = 0, pid = null;
  const down = (e) => { if (e.target.closest('a, button, .itx')) return; pid = e.pointerId; sx = e.clientX; sy = e.clientY; };
  const up = (e) => { if (pid === null || e.pointerId !== pid) return; pid = null; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) cycle(); };
  const click = (e) => {
    if (e.target.closest('.deck-next')) { cycle(); return; }
    const card = e.target.closest('.deck-card[data-pos="0"]');
    if (card && !e.target.closest('a, button, .itx, input')) location.hash = card.dataset.href;
  };
  deck.addEventListener('pointerdown', down); deck.addEventListener('pointerup', up); deck.addEventListener('pointercancel', () => { pid = null; }); deck.addEventListener('click', click);
  place();
  return () => { deck.removeEventListener('pointerdown', down); deck.removeEventListener('pointerup', up); deck.removeEventListener('click', click); };
}

function scopeOptions() {
  const sc = store.scope;
  const cur = sc.mode === 'level' ? 'level:' + ((sc.levels && sc.levels[0]) || 'A1') : sc.mode;
  const lists = Object.values(store.lists);
  const count = (scope) => itemsForScope(scope, store).length;
  return [
    ...LEVELS.map(L => ({ value: 'level:' + L, label: `Level ${L}`, sub: `${LEVEL_INFO[L].name} · ${count({ mode: 'level', levels: [L], cats: [] })} items`, selected: cur === 'level:' + L && !(sc.cats && sc.cats.length) })),
    { value: 'lists', label: 'My lists', sub: `${lists.length} list${lists.length === 1 ? '' : 's'} · ${count({ mode: 'lists', lists: lists.map(l => l.id) })} items`, selected: cur === 'lists' },
    { value: 'learned', label: 'Learned', sub: `${store.learnedIds().length} items`, selected: cur === 'learned' },
    { value: 'all', label: 'All words & verbs', sub: `${data.vocab.length + data.verbs.length} items`, selected: cur === 'all' },
  ];
}
function applyScopeChoice(v) {
  if (v.startsWith('level:')) store.setScope({ mode: 'level', levels: [v.slice(6)], cats: [] });
  else if (v === 'lists') { const cur = store.scope.lists || []; store.setScope({ mode: 'lists', lists: cur.length ? cur : Object.keys(store.lists) }); }
  else store.setScope({ mode: v });
}

export async function render(root) {
  setTitle('Learn');
  let cleanups = [];
  const cleanup = () => { cleanups.forEach(f => { try { f(); } catch { /* ignore */ } }); cleanups = []; };

  function draw() {
    cleanup();
    const day = store.today();
    const s = store.settings;
    const lvl = LEVELS.includes(s.level) ? s.level : 'A1';
    setScene(lvl);
    const due = store.dueIds().length;
    const newWordsDone = (day.new || 0) - (day.newVerbs || 0);
    const newVerbsDone = day.newVerbs || 0;
    const verbs = nextNew('verb', 3);
    const words = nextNew('word', 3);
    const scopeAll = itemsForScope(store.scope, store);
    const learnedInScope = scopeAll.filter(e => store.isLearned(e.id)).length;
    const learnedVerbs = store.learnedIds('v:').length;
    const nextDue = Object.values(store.current.items).filter(it => (it.learned || it.seen > 0) && it.due && it.due > Date.now()).reduce((m, it) => Math.min(m, it.due), Infinity);
    const ringPct = Math.min(100, Math.round((due / Math.max(1, s.dailyReviews || 40)) * 100));
    const sessionN = Math.min(words.length, Math.max(1, s.dailyNew - newWordsDone) || 5);

    root.innerHTML = html`
      <div class="learn">
        <div class="scope-line glass-flat">
          <div class="scope-main"><span class="kicker">Scope</span><div class="scope-desc mono">${describeScope(store.scope, store)}</div><div class="tiny muted">${learnedInScope} / ${scopeAll.length} learned</div></div>
          <button type="button" class="btn sm secondary" data-scope-menu aria-haspopup="menu" aria-expanded="false">Change${ic('chevronDown', { size: 16 })}</button>
          <a class="icon-btn" href="#/scope" aria-label="Scope details">${ic('chevronRight', { size: 20 })}</a>
        </div>

        <section class="next-up">
          <div class="sec-head"><div><span class="kicker">Next up</span><span class="title">${raw(tr('Verbi', 'Verbs'))}</span></div><span class="mono sec-side">${newVerbsDone} / ${s.dailyVerbs} today</span></div>
          ${raw(deckHTML('verb', verbs))}
        </section>

        <section class="next-up">
          <div class="sec-head"><div><span class="kicker">Next up</span><span class="title">${raw(tr('Parole', 'Words'))}</span></div><span class="mono sec-side">${newWordsDone} / ${s.dailyNew} today</span></div>
          ${raw(deckHTML('word', words))}
          ${words.length ? raw(html`<a class="btn ghost sm block session-link" href="#/learn/word/${encodeURIComponent(words[0].id)}?auto=1">${ic('play', { size: 16 })}Start a session of ${sessionN} word${sessionN === 1 ? '' : 's'}</a>`) : ''}
        </section>

        <section class="review-pane glass pad-l">
          <div class="sec-head in-pane"><div><span class="kicker">Review</span><span class="title">${raw(tr('Ripasso', 'Review'))}</span></div><a class="more" href="#/games?pick=flashcards">Flashcards</a></div>
          <div class="review-body">
            <div class="ring" style="--p:${ringPct}"><span>${due}</span></div>
            <div class="review-text">
              ${due ? raw(html`<div class="review-num">${due} item${due === 1 ? '' : 's'} due</div><div class="small muted">Adaptive: flashcards, typing and quizzes on what you are about to forget.</div>`) : raw(html`<div class="review-num it">${raw(tr('Niente da ripassare', 'Nothing to review'))}.</div><div class="small muted">${nextDue < Infinity ? 'Next item due ' + relTime(nextDue) : 'Learn something new and it will show up here.'}</div>`)}
            </div>
          </div>
          ${due ? raw(html`<a class="btn primary block" href="#/review">Review now${ic('arrow', { size: 20 })}</a>`) : raw(html`<a class="btn secondary block" href="#/review?mode=extra">Review ahead${ic('arrow', { size: 20 })}</a>`)}
        </section>

        <section class="verb-lab">
          ${raw(secHead('Verb lab', 'Laboratorio', { href: '#/games', more: 'All games' }))}
          <div class="lab-grid">
            <a class="tile" href="${learnedVerbs ? '#/game/conj-drill?src=learned-verbs&tenses=presente,passatoProssimo' : '#/game/conj-drill?src=scope&tenses=presente'}"><span class="ico">${ic('edit', { size: 22 })}</span><span class="name">Conjugation drill</span><span class="desc">${learnedVerbs ? `${learnedVerbs} learned verb${learnedVerbs === 1 ? '' : 's'}` : 'verbs in your scope'}</span></a>
            <a class="tile" href="#/game/verb-quiz?src=scope"><span class="ico">${ic('sparkle', { size: 22 })}</span><span class="name">Verb mix</span><span class="desc">current scope</span></a>
            <a class="tile" href="#/browse?kind=verb"><span class="ico">${ic('book', { size: 22 })}</span><span class="name">All verbs</span><span class="desc">${data.verbs.length} with full tables</span></a>
            <a class="tile" href="#/lists"><span class="ico">${ic('list', { size: 22 })}</span><span class="name">My lists</span><span class="desc">word bank &amp; custom</span></a>
          </div>
        </section>
      </div>`;

    const view = root.querySelector('.learn');
    mount(view);
    view.querySelectorAll('.deck.live').forEach(d => cleanups.push(bindDeck(d)));
    const menuBtn = view.querySelector('[data-scope-menu]');
    menuBtn.addEventListener('click', () => {
      dropdown(menuBtn, scopeOptions(), { align: 'end', width: 280, onSelect: (v) => { applyScopeChoice(v); toast(describeScope(store.scope, store), { kind: 'ok' }); draw(); } });
    });
  }
  draw();
  return cleanup;
}
