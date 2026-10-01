// Learn hub · "Sezioni": jump chips over four equal blocks — Corso, Vocabolario, Ripasso, Laboratorio.
// renderSections(container, model, ctx) draws from the model built by learnData.js and returns a cleanup function.
// The decks, the review ring and the lab tiles keep the hub's look (rules in css/views-a.css, LEARN HUB); the section
// shell is styled in css/views-c.css §7.
import { html, raw, tr, enPill, speakBtn, levelBadge, relTime, progressBar, icon } from '../ui.js';
import { store as defaultStore } from '../store.js';
import { getEntry, itemsForScope, CATS, article, withArticle, isPluralOnly } from '../data.js';
import { IT_POS } from '../components.js';
import { conjugate } from '../conjugator.js';
import { mount, reducedMotion } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));
const pad2 = (n) => String(n).padStart(2, '0');
const fit = (w) => { const n = String(w || '').length; return n <= 8 ? 44 : n <= 12 ? 38 : n <= 18 ? 30 : n <= 26 ? 24 : 20; };

// ---------- new-item ordering ----------
// Same algorithm as the hub's nextNew: by level, then rotated by category so the learner sees variety. The hub's own
// export is preferred when it is there (one source of truth); this copy keeps the decks working without it.
function localNextNew(store, kind, n = 5) {
  const items = itemsForScope(store.scope, store, { kind }).filter(e => !store.isLearned(e.id));
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
let hubNextNew = null;
import('./learn.js').then(m => { if (typeof m?.nextNew === 'function') hubNextNew = m.nextNew; }).catch(() => { /* the hub shell is optional here */ });
const nextNew = (store, kind, n) => {
  if (hubNextNew && store === defaultStore) { try { return hubNextNew(kind, n) || []; } catch { /* fall through */ } }
  return localNextNew(store, kind, n);
};

// ---------- deck (stacked cards, copied from the hub) ----------
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
    tags = html`<span>verbo</span><span>${c.group}</span><span>${c.irregular ? 'irregolare' : 'regolare'}</span><span>aux. ${e.aux === 'both' ? 'avere / essere' : (e.aux || 'avere')}</span>`;
  } else tags = html`<span>${IT_POS[e.pos] || e.pos || 'parola'}</span>${isNoun ? raw(html`<span>${e.g === 'mf' ? 'm · f' : e.g}</span>`) : ''}${e.cat && CATS[e.cat] ? raw(html`<span>${CATS[e.cat].name}</span>`) : ''}`;
  return html`<article class="deck-card" data-pos="${i}" data-href="${href}" ${i ? raw('aria-hidden="true" inert') : ''}>
    <div class="deck-top"><span class="kicker">${isVerb ? 'Next verb' : 'Next word'}</span><span class="rail-count">${pad2(i + 1)} / ${pad2(n)}</span></div>
    <div class="deck-hw">${art ? raw(html`<span class="article">${art}</span>`) : ''}<span class="word" style="--hw:${fit(word)}px">${word}</span></div>
    <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(say))}</div>
    <div class="tags">${raw(levelBadge(e.level || 'A1'))}${raw(tags)}</div>
    <div class="deck-actions"><a class="btn primary grow" href="${href}">${isVerb ? 'Learn this verb' : 'Learn this word'}${ic('arrow', { size: 20 })}</a>${n > 1 ? raw(html`<button type="button" class="icon-btn deck-next" aria-label="Show the next card">${ic('refresh', { size: 20 })}</button>`) : ''}</div>
  </article>`;
}
function deckHTML(kind, entries, scopeHref) {
  if (!entries.length) return html`<div class="empty deck-empty"><p>${kind === 'verb' ? 'No new verbs left in this scope.' : 'No new words left in this scope.'}</p><a class="btn secondary sm" href="${scopeHref}">${ic('orbit', { size: 16 })}Widen the scope</a></div>`;
  return html`<div class="deck live" data-deck="${kind}">${raw(entries.map((e, i) => deckCard(e, i, entries.length)).join(''))}</div>`;
}
// The top card is live, the two behind peek out; "next" (or a horizontal swipe) sends the top card to the back.
function bindDeck(deck) {
  const cards = () => [...deck.querySelectorAll(':scope > .deck-card')];
  const place = () => cards().forEach(c => { const top = c.dataset.pos === '0'; if (top) { c.removeAttribute('aria-hidden'); c.removeAttribute('inert'); } else { c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', ''); } });
  let busy = false, timer = null;
  function cycle() {
    const cs = cards(); if (cs.length < 2 || busy) return;
    const n = cs.length;
    const top = cs.find(c => c.dataset.pos === '0');
    busy = true;
    const finish = () => { timer = null; cs.forEach(c => { c.dataset.pos = String((Number(c.dataset.pos) + n - 1) % n); }); top.classList.remove('leaving'); place(); busy = false; };
    if (reducedMotion()) { finish(); return; }
    top.classList.add('leaving');
    timer = setTimeout(finish, 240);
  }
  let sx = 0, sy = 0, pid = null;
  const down = (e) => { if (e.target.closest('a, button, .itx')) return; pid = e.pointerId; sx = e.clientX; sy = e.clientY; };
  const up = (e) => { if (pid === null || e.pointerId !== pid) return; pid = null; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) cycle(); };
  const cancel = () => { pid = null; };
  const click = (e) => {
    if (e.target.closest('.deck-next')) { cycle(); return; }
    const card = e.target.closest('.deck-card[data-pos="0"]');
    if (card && !e.target.closest('a, button, .itx, input')) location.hash = card.dataset.href;
  };
  deck.addEventListener('pointerdown', down); deck.addEventListener('pointerup', up); deck.addEventListener('pointercancel', cancel); deck.addEventListener('click', click);
  place();
  return () => { clearTimeout(timer); deck.removeEventListener('pointerdown', down); deck.removeEventListener('pointerup', up); deck.removeEventListener('pointercancel', cancel); deck.removeEventListener('click', click); };
}

// ---------- entries from the model ----------
// The model carries ids plus a headword; the deck needs the full entry (gender, category, auxiliary) when it exists.
const verbEntry = (v) => (v && (getEntry(v.id) || { id: v.id, kind: 'verb', inf: v.name, en: v.en, level: v.level, aux: 'avere' })) || null;
const wordEntry = (w) => (w && (getEntry(w.id) || { id: w.id, kind: 'word', it: w.headword, en: w.en, level: w.level, pos: '' })) || null;
function dedupe(list, n) { const seen = new Set(); return list.filter(e => e && !seen.has(e.id) && seen.add(e.id)).slice(0, n); }

const BLOCKS = [
  { id: 'sez-corso', label: 'Corso' }, { id: 'sez-vocabolario', label: 'Vocabolario' }, { id: 'sez-ripasso', label: 'Ripasso' }, { id: 'sez-laboratorio', label: 'Laboratorio' },
];
const secHead = (kicker, title, href, more) => html`<div class="sec-head"><div><span class="kicker">${kicker}</span><span class="title">${title}</span></div>${href ? raw(html`<a class="more" href="${href}">${more}</a>`) : ''}</div>`;

// ---------- blocks ----------
function corsoHTML(model) {
  const stage = model.stage || {}, prog = (model.inProgress || [])[0] || null, gram = model.next?.grammar || null;
  const stageLine = [stage.level, Number.isFinite(stage.lessonsDone) && Number.isFinite(stage.lessonsTotal) ? `${stage.lessonsDone}/${stage.lessonsTotal}` : ''].filter(Boolean).join(' · ');
  let kicker, title, sub, meta = '', href, cta, pct = null, pctLine = '';
  if (prog) {
    kicker = ['Resume', prog.kind].filter(Boolean).join(' · ');
    title = prog.title; sub = prog.sub || 'Continue from where you stopped.'; href = prog.href; cta = 'Resume lesson';
    if (Number.isFinite(prog.pct)) pct = Math.max(0, Math.min(100, Math.round(prog.pct)));
    pctLine = [pct != null ? `${pct}% done` : '', prog.updatedAt ? relTime(prog.updatedAt) : '', stage.currentUnitTitle || ''].filter(Boolean).join(' · ');
  } else if (gram) {
    kicker = 'Up next · grammar'; title = gram.title; sub = gram.sub || gram.outcome || stage.currentUnitTitle || ''; href = gram.href; cta = 'Start lesson';
    meta = html`<div class="tags">${gram.level ? raw(levelBadge(gram.level)) : ''}${gram.unit ? raw(html`<span>${gram.unit}</span>`) : ''}${gram.minutes ? raw(html`<span>${gram.minutes} min</span>`) : ''}</div>`;
  } else {
    kicker = 'Your course'; title = 'This level is complete'; sub = 'Revisit a lesson or choose your next level.'; href = stage.href || '#/course'; cta = 'Choose a lesson';
  }
  // the next grammar lesson as its own line when the card shows something else (a saved session, a verb, a word)
  const gramLine = gram && gram.href !== href ? html`<a class="sez-row glass-flat" href="${gram.href}">
      <span class="sez-row-main"><span class="kicker">Next grammar lesson</span><span class="sez-row-title">${gram.title}</span><span class="sez-row-sub mono">${[gram.unit, gram.minutes ? gram.minutes + ' min' : ''].filter(Boolean).join(' · ')}</span></span>
      ${gram.level ? raw(levelBadge(gram.level)) : ''}${ic('chevronRight', { size: 20 })}</a>` : '';
  return html`<section class="sez-block" id="sez-corso">
    ${raw(secHead('Course', 'Corso', stage.href || '#/course', 'All lessons'))}
    <article class="sez-course glass pad-l">
      <div class="sez-course-top"><span class="kicker">${kicker}</span>${stageLine ? raw(html`<span class="mono sez-stage">${stageLine}</span>`) : ''}</div>
      <h2>${title}</h2>
      ${sub ? raw(html`<p>${sub}</p>`) : ''}
      ${raw(meta)}
      ${pct != null ? raw(progressBar(pct, 100, 'thin')) : ''}
      ${pctLine ? raw(html`<div class="sez-pct mono">${pctLine}</div>`) : ''}
      <div class="sez-course-actions">
        <a class="btn primary block" href="${href}">${cta}${ic('arrow', { size: 20 })}</a>
        <button type="button" class="btn secondary block" data-session-menu aria-haspopup="menu" aria-expanded="false">Start a session${ic('chevronDown', { size: 18 })}</button>
      </div>
    </article>
    ${raw(gramLine)}
  </section>`;
}

function vocabolarioHTML(model, store) {
  const scope = model.scope || {}, next = model.next || {};
  const scopeHref = scope.href || '#/scope';
  const verbs = dedupe([verbEntry(next.verb), ...nextNew(store, 'verb', 4)], 3);
  const words = dedupe([...((next.words?.entries) || []).map(wordEntry), ...nextNew(store, 'word', 4)], 3);
  const day = (store?.today && store.today()) || {}, s = store?.settings || {};
  const verbSide = Number.isFinite(s.dailyVerbs) ? `${day.newVerbs || 0} / ${s.dailyVerbs} today` : '';
  const wordSide = Number.isFinite(next.words?.goal) ? `${next.words.done || 0} / ${next.words.goal} today` : '';
  return html`<section class="sez-block" id="sez-vocabolario">
    ${raw(secHead('Vocabulary', 'Vocabolario', '#/browse', 'Browse'))}
    <div class="scope-line glass-flat">
      <div class="scope-main"><span class="kicker">Scope</span><div class="scope-desc mono">${scope.label || 'Everything'}</div><div class="tiny muted">${scope.learned ?? 0} / ${scope.total ?? 0} learned</div></div>
      <button type="button" class="btn sm secondary" data-scope-menu aria-haspopup="menu" aria-expanded="false">Change${ic('chevronDown', { size: 16 })}</button>
      <a class="icon-btn" href="${scopeHref}" aria-label="Scope details">${ic('chevronRight', { size: 20 })}</a>
    </div>
    <div class="sez-deck">
      <div class="sez-deck-head"><span class="title">${raw(tr('Verbi', 'Verbs'))}</span>${verbSide ? raw(html`<span class="mono side">${verbSide}</span>`) : ''}</div>
      ${raw(deckHTML('verb', verbs, scopeHref))}
    </div>
    <div class="sez-deck">
      <div class="sez-deck-head"><span class="title">${raw(tr('Parole', 'Words'))}</span>${wordSide ? raw(html`<span class="mono side">${wordSide}</span>`) : ''}</div>
      ${raw(deckHTML('word', words, scopeHref))}
      ${words.length && next.words?.href ? raw(html`<a class="btn ghost sm block session-link" href="${next.words.href}">${ic('play', { size: 16 })}Start a short word session</a>`) : ''}
    </div>
  </section>`;
}

function ripassoHTML(model, store) {
  const r = model.next?.review || {};
  const due = Number(r.due) || 0;
  const goal = Math.max(1, Number(store?.settings?.dailyReviews) || 40);
  const pct = Math.min(100, Math.round((due / goal) * 100));
  const href = r.href || '#/review', ahead = r.aheadHref || '#/review?mode=extra';
  return html`<section class="sez-block" id="sez-ripasso">
    ${raw(secHead('Review', 'Ripasso', due ? ahead : '#/games?pick=flashcards', due ? 'Review ahead' : 'Flashcards'))}
    <div class="review-pane glass pad-l">
      <div class="review-body">
        <div class="ring" style="--p:${pct}"><span>${due}</span></div>
        <div class="review-text">
          ${due ? raw(html`<div class="review-num">${due} item${due === 1 ? '' : 's'} due</div><div class="small muted">Adaptive: flashcards, typing and quizzes on what you are about to forget.</div>`)
                : raw(html`<div class="review-num it">${raw(tr('Niente da ripassare', 'Nothing to review'))}.</div><div class="small muted">${r.nextDueLabel || 'Learn something new and it will show up here.'}</div>`)}
        </div>
      </div>
      ${due ? raw(html`<a class="btn primary block" href="${href}">Review now${ic('arrow', { size: 20 })}</a>`) : raw(html`<a class="btn secondary block" href="${ahead}">Review ahead${ic('arrow', { size: 20 })}</a>`)}
    </div>
  </section>`;
}

function laboratorioHTML(model) {
  const tiles = (model.lab || []).slice(0, 4);
  return html`<section class="sez-block" id="sez-laboratorio">
    ${raw(secHead('Verb lab', 'Laboratorio', '#/games', 'All games'))}
    <div class="lab-grid">${raw(tiles.map(t => html`<a class="tile" href="${t.href}" data-lab="${t.key}"><span class="ico">${raw(icon(t.icon) || icon('sparkle'))}</span><span class="name">${t.title}</span><span class="desc">${t.sub}</span></a>`).join(''))}</div>
  </section>`;
}

// ---------- entry point ----------
export function renderSections(container, model = {}, ctx = {}) {
  const store = ctx.store || defaultStore;
  container.innerHTML = html`<div class="sez">
    <nav class="chips scroll sez-jumps" aria-label="Sections">${raw(BLOCKS.map(b => html`<button type="button" class="chip sm" data-jump="${b.id}">${b.label}</button>`).join(''))}</nav>
    ${raw(corsoHTML(model))}
    ${raw(vocabolarioHTML(model, store))}
    ${raw(ripassoHTML(model, store))}
    ${raw(laboratorioHTML(model))}
  </div>`;
  const view = container.querySelector('.sez');
  const cleanups = [];

  // jump chips: smooth-scroll to the block; the chip of the block under the top bar is marked while scrolling
  const chips = [...view.querySelectorAll('[data-jump]')];
  const setOn = (id) => chips.forEach(c => c.classList.toggle('on', c.dataset.jump === id));
  const onJump = (ev) => {
    const b = ev.target.closest('[data-jump]'); if (!b) return;
    const el = view.querySelector('#' + b.dataset.jump); if (!el) return;
    setOn(b.dataset.jump);
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  view.addEventListener('click', onJump);
  cleanups.push(() => view.removeEventListener('click', onJump));
  if ('IntersectionObserver' in window) {
    const visible = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) visible.set(en.target.id, en.isIntersecting ? en.boundingClientRect.top : null);
      const order = BLOCKS.map(b => b.id).filter(id => visible.get(id) != null).sort((a, b) => visible.get(a) - visible.get(b));
      if (order.length) setOn(order[0]);
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    view.querySelectorAll('.sez-block').forEach(b => io.observe(b));
    cleanups.push(() => io.disconnect());
  }

  view.querySelectorAll('.deck.live').forEach(d => cleanups.push(bindDeck(d)));
  const sessionBtn = view.querySelector('[data-session-menu]');
  if (sessionBtn && typeof ctx.bindSessionMenu === 'function') { const off = ctx.bindSessionMenu(sessionBtn); if (typeof off === 'function') cleanups.push(off); }
  const scopeBtn = view.querySelector('[data-scope-menu]');
  if (scopeBtn && typeof ctx.bindScopeMenu === 'function') { const off = ctx.bindScopeMenu(scopeBtn); if (typeof off === 'function') cleanups.push(off); }
  mount(view);

  return () => { cleanups.forEach(f => { try { f(); } catch { /* ignore */ } }); cleanups.length = 0; };
}
