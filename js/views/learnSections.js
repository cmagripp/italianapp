// Learn hub · "Sezioni": a sticky four-segment indicator over four equal blocks — Corso, Vocabolario, Ripasso,
// Laboratorio. renderSections(container, model, ctx) draws from the model built by learnData.js and returns a cleanup
// function. The verb / word / lab reels are the shared learn cards (learnCards.js, css/learnhub.css); the indicator,
// the course card and the review pane are styled in css/views-c.css §7.
import { html, raw, tr, levelBadge, relTime, progressBar, icon } from '../ui.js';
import { store as defaultStore } from '../store.js';
import { getEntry, itemsForScope, CATS, article, withArticle, isPluralOnly } from '../data.js';
import { IT_POS } from '../components.js';
import { conjugate } from '../conjugator.js';
import { mount, reducedMotion } from '../fx.js';
import { learnReel } from './learnCards.js';
import * as dash from './learnDash.js';

const ic = (name, opts) => raw(icon(name, opts));

// ---------- new-item ordering ----------
// Same algorithm as the hub's nextNew: by level, then rotated by category so the learner sees variety. The hub's own
// export is preferred when it is there (one source of truth); this copy keeps the reels working without it.
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
import('./learnData.js').then(m => { if (typeof m?.nextNew === 'function') hubNextNew = m.nextNew; }).catch(() => { /* the model module is optional here */ });
const nextNew = (store, kind, n) => {
  if (hubNextNew) { try { return hubNextNew(kind, n, store) || []; } catch { /* fall through */ } }
  return localNextNew(store, kind, n);
};

// ---------- entries from the model ----------
// The model carries ids plus a headword; the cards need the full entry (gender, category, auxiliary) when it exists.
const verbEntry = (v) => (v && (getEntry(v.id) || { id: v.id, kind: 'verb', inf: v.name, en: v.en, level: v.level, aux: 'avere' })) || null;
const wordEntry = (w) => (w && (getEntry(w.id) || { id: w.id, kind: 'word', it: w.headword, en: w.en, level: w.level, pos: '' })) || null;
function dedupe(list, n) { const seen = new Set(); return list.filter(e => e && !seen.has(e.id) && seen.add(e.id)).slice(0, n); }
const firstEn = (en) => String(en || '').split(';')[0].trim();

// one learn card per entry: headword (with the article for nouns), English under it, level chip, kicker, speaker
function entryCard(e) {
  const isVerb = e.kind === 'verb';
  const isNoun = e.pos === 'noun';
  const plural = isNoun && isPluralOnly(e);
  const art = isNoun ? article(e, plural) : '';
  const word = isVerb ? e.inf : (plural ? e.pl : e.it);
  const say = isVerb ? e.inf : (isNoun ? withArticle(e, plural) : e.it);
  const href = `#/learn/${isVerb ? 'verb' : 'word'}/${encodeURIComponent(e.id)}`;
  let kicker, tags;
  if (isVerb) {
    const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
    const aux = e.aux === 'both' ? 'avere / essere' : (e.aux || 'avere');
    kicker = `${c.group} · aux. ${aux}`;
    tags = ['verbo', c.group, c.irregular ? 'irregolare' : 'regolare', `aux. ${aux}`];
  } else {
    const pos = IT_POS[e.pos] || e.pos || 'parola';
    const topic = e.cat && CATS[e.cat] ? CATS[e.cat].name : '';
    const gender = isNoun ? (e.g === 'mf' ? 'm · f' : e.g) : '';
    kicker = [isNoun ? gender : pos, topic].filter(Boolean).join(' · ') || pos;
    tags = [pos, gender, topic].filter(Boolean);
  }
  return { key: e.id, kicker, title: art ? `${art} ${word}` : word, en: firstEn(e.en), detail: isVerb ? 'Learn this verb' : 'Learn this word', level: e.level || 'A1', href, say, tags };
}

const BLOCKS = [
  { id: 'sez-corso', label: 'Corso', icon: 'book' },
  { id: 'sez-vocabolario', label: 'Vocabolario', icon: 'sparkle' },
  { id: 'sez-ripasso', label: 'Ripasso', icon: 'refresh' },
  { id: 'sez-laboratorio', label: 'Laboratorio', icon: 'dial' },
];
const secHead = (kicker, title, href, more, cls = 'more') => html`<div class="sec-head"><div><span class="kicker">${kicker}</span><span class="title">${title}</span></div>${href ? raw(html`<a class="${cls}" href="${href}">${raw(more)}</a>`) : ''}</div>`;
const emptyReel = (text, scopeHref) => html`<div class="empty sez-empty"><p>${text}</p><a class="btn secondary sm" href="${scopeHref}">${ic('orbit', { size: 16 })}Widen the scope</a></div>`;

// ---------- blocks ----------
// Corso: the grammar lesson (resumed when one is open, otherwise the next one), a Full lesson / Section toggle and Start.
function corsoHTML(model) {
  const stage = model.stage || {}, gram = model.next?.grammar || null;
  const threads = model.inProgress || [];
  const prog = threads.find(p => p.kind === 'grammar') || null;
  const other = threads.find(p => p.kind !== 'grammar') || null;
  const counter = Number.isFinite(stage.lessonsDone) && Number.isFinite(stage.lessonsTotal) ? `${stage.lessonsDone} / ${stage.lessonsTotal}` : '';
  const minutes = prog ? 0 : (gram?.minutes || 0);
  const headLine = [counter, minutes ? `${minutes} min` : ''].filter(Boolean).join(' · ');
  let kicker, title, sub, full = null, pct = null, pctLine = '';
  if (prog) {
    kicker = 'Resume · grammar'; title = prog.title; sub = prog.sub || 'Continue from where you stopped.'; full = prog.href;
    if (Number.isFinite(prog.pct)) pct = Math.max(0, Math.min(100, Math.round(prog.pct)));
    pctLine = [pct != null ? `${pct}% done` : '', prog.updatedAt ? relTime(prog.updatedAt) : '', stage.currentUnitTitle || ''].filter(Boolean).join(' · ');
  } else if (gram) {
    kicker = 'Up next · grammar'; title = gram.title; sub = gram.sub || gram.outcome || stage.currentUnitTitle || ''; full = gram.href;
  } else {
    kicker = 'Your course'; title = 'This level is complete'; sub = 'Revisit a lesson or choose your next level.';
  }
  const section = '#/learn/session?start=grammar';
  const cta = prog ? 'Resume' : 'Start';
  const actions = full
    ? html`<div class="sez-course-actions">
        <div class="seg sez-seg no-anim" role="radiogroup" aria-label="Lesson length" data-lesson-seg>
          <button type="button" role="radio" aria-checked="true" tabindex="0" class="on" data-lesson="full" data-href="${full}" data-cta="${cta}" data-label="${cta} lesson">Full lesson</button>
          <button type="button" role="radio" aria-checked="false" tabindex="-1" data-lesson="section" data-href="${section}" data-cta="Start" data-label="Start a grammar section">Section</button>
        </div>
        <a class="btn primary sez-start" href="${full}" aria-label="${cta} lesson" data-lesson-start>${cta}</a>
      </div>`
    : html`<div class="sez-course-actions"><a class="btn primary block sez-start" href="${stage.href || '#/course'}" data-lesson-start>Choose a lesson</a></div>`;
  // another open thread (a saved session, a verb, a word) as a quiet row under the card
  const otherRow = other ? html`<a class="sez-row glass-flat" href="${other.href}">
      <span class="sez-row-main"><span class="kicker">Resume · ${other.kind}</span><span class="sez-row-title">${other.title}</span><span class="sez-row-sub mono">${[Number.isFinite(other.pct) ? Math.round(other.pct) + '% done' : '', other.updatedAt ? relTime(other.updatedAt) : ''].filter(Boolean).join(' · ')}</span></span>
      ${ic('chevronRight', { size: 20 })}</a>` : '';
  return html`<section class="sez-block" id="sez-corso">
    ${raw(secHead('Course', 'Corso', stage.href || '#/course', 'All lessons'))}
    <article class="sez-course glass pad-l">
      <div class="sez-course-top"><span class="kicker">${kicker}</span>${headLine ? raw(html`<span class="mono sez-stage">${headLine}</span>`) : ''}</div>
      <h2>${title}</h2>
      ${sub ? raw(html`<p>${sub}</p>`) : ''}
      ${pct != null ? raw(progressBar(pct, 100, 'thin')) : ''}
      ${pctLine ? raw(html`<div class="sez-pct mono">${pctLine}</div>`) : ''}
      ${raw(actions)}
    </article>
    ${raw(otherRow)}
  </section>`;
}

// Vocabolario: a quiet scope link in the header, then the verb reel and the word reel.
function vocabolarioHTML(model, store) {
  const scope = model.scope || {}, next = model.next || {};
  const scopeHref = scope.href || '#/scope';
  const scopeShort = String(scope.label || 'Everything').split(' · ')[0];
  const verbs = dedupe([verbEntry(next.verb), ...nextNew(store, 'verb', 4)], 3);
  const words = dedupe([...((next.words?.entries) || []).map(wordEntry), ...nextNew(store, 'word', 4)], 3);
  const day = (store?.today && store.today()) || {}, s = store?.settings || {};
  const verbSide = Number.isFinite(s.dailyVerbs) ? `${day.newVerbs || 0} / ${s.dailyVerbs} today` : '';
  const wordSide = Number.isFinite(next.words?.goal) ? `${next.words.done || 0} / ${next.words.goal} today` : '';
  return html`<section class="sez-block" id="sez-vocabolario">
    ${raw(secHead('Vocabulary', 'Vocabolario', scopeHref, html`<span class="sez-scope-val">${scopeShort}</span><span class="sez-scope-dot">·</span><span class="sez-scope-act">change</span>`, 'more sez-scope-link'))}
    <div class="sez-deck" data-deck-wrap="verb">
      <div class="sez-deck-head"><span class="title">${raw(tr('Verbi', 'Verbs'))}</span>${verbSide ? raw(html`<span class="mono side">${verbSide}</span>`) : ''}</div>
      ${verbs.length ? raw(html`<div class="sez-reel" data-reel="verb"></div>`) : raw(emptyReel('No new verbs left in this scope.', scopeHref))}
    </div>
    <div class="sez-deck" data-deck-wrap="word">
      <div class="sez-deck-head"><span class="title">${raw(tr('Parole', 'Words'))}</span>${wordSide ? raw(html`<span class="mono side">${wordSide}</span>`) : ''}</div>
      ${words.length ? raw(html`<div class="sez-reel" data-reel="word"></div>`) : raw(emptyReel('No new words left in this scope.', scopeHref))}
      ${words.length && next.words?.href ? raw(html`<a class="btn ghost sm block session-link" href="${next.words.href}">${ic('play', { size: 16 })}Start a short word session</a>`) : ''}
    </div>
  </section>`;
}

// Ripasso: the whole pane is the link — review now when something is due, review ahead otherwise.
function ripassoHTML(model, store) {
  const r = model.next?.review || {};
  const due = Number(r.due) || 0;
  const goal = Math.max(1, Number(store?.settings?.dailyReviews) || 40);
  const pct = Math.min(100, Math.round((due / goal) * 100));
  const href = r.href || '#/review', ahead = r.aheadHref || '#/review?mode=extra';
  return html`<section class="sez-block" id="sez-ripasso">
    ${raw(secHead('Review', 'Ripasso', '#/games?pick=flashcards', 'Flashcards'))}
    <a class="review-pane glass pad-l" href="${due ? href : ahead}" data-review="${due ? 'now' : 'ahead'}">
      <span class="review-body">
        <span class="ring" style="--p:${pct}"><span>${due}</span></span>
        <span class="review-text">
          ${due ? raw(html`<span class="review-num">${due} item${due === 1 ? '' : 's'} due</span><span class="small muted">Adaptive: flashcards, typing and quizzes on what you are about to forget.</span>`)
                : raw(html`<span class="review-num it">${raw(tr('Niente da ripassare', 'Nothing to review'))}.</span><span class="small muted">${r.nextDueLabel || 'Learn something new and it will show up here.'}</span>`)}
        </span>
      </span>
      <span class="review-cta mono">${due ? 'Review now' : 'Review ahead'}</span>
    </a>
  </section>`;
}

const laboratorioHTML = () => html`<section class="sez-block" id="sez-laboratorio">
    ${raw(secHead('Verb lab', 'Laboratorio', '#/games', 'All games'))}
    <div class="sez-reel" data-lab-reel></div>
  </section>`;
const labCards = (model) => (model.lab || []).map(t => ({ key: t.key, kicker: 'Verb lab', title: t.title, en: '', detail: t.sub || '', icon: t.icon || 'sparkle', href: t.href }));

// ---------- indicator bar ----------
function placeKnob(seg, animate = true) {
  const on = seg.querySelector('button.on'); if (!on) return;
  seg.classList.toggle('no-anim', !animate);
  seg.style.setProperty('--kx', `${on.offsetLeft}px`); seg.style.setProperty('--kw', `${on.offsetWidth}px`);
  if (!animate) requestAnimationFrame(() => seg.classList.remove('no-anim'));
}
const navHTML = () => html`<nav class="seg sez-nav no-anim" aria-label="Sections" data-sez-nav>${raw(BLOCKS.map((b, i) => html`<button type="button" class="${i ? '' : 'on'}" data-jump="${b.id}" aria-current="${i ? 'false' : 'true'}">${ic(b.icon, { size: 18 })}<span>${b.label}</span></button>`).join(''))}</nav>`;

// ---------- entry point ----------
export function renderSections(container, model = {}, ctx = {}) {
  const store = ctx.store || defaultStore;
  container.innerHTML = html`<div class="sez">
    ${raw(navHTML())}
    ${raw(corsoHTML(model))}
    ${raw(vocabolarioHTML(model, store))}
    ${raw(ripassoHTML(model, store))}
    ${raw(laboratorioHTML())}
  </div>`;
  const view = container.querySelector('.sez');
  const cleanups = [];
  const on = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); cleanups.push(() => el.removeEventListener(ev, fn, opts)); };

  // the indicator: one knob over four equal segments; it follows the block in view and a tap scrolls to the block
  const nav = view.querySelector('[data-sez-nav]');
  const segs = [...nav.querySelectorAll('[data-jump]')];
  const blocks = BLOCKS.map(b => view.querySelector('#' + b.id)).filter(Boolean);
  let current = '', lockUntil = 0, raf = 0;
  const setOn = (id, animate = true) => {
    if (id === current) return;
    current = id;
    segs.forEach(s => { const is = s.dataset.jump === id; s.classList.toggle('on', is); s.setAttribute('aria-current', is ? 'true' : 'false'); });
    placeKnob(nav, animate && !reducedMotion());
  };
  const track = () => {
    raf = 0;
    if (Date.now() < lockUntil) return;
    const line = nav.getBoundingClientRect().bottom + 24;
    const doc = document.documentElement;
    const atEnd = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
    let id = blocks[0]?.id;
    if (atEnd) id = blocks[blocks.length - 1]?.id;
    else for (const b of blocks) if (b.getBoundingClientRect().top <= line) id = b.id;
    if (id) setOn(id);
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(track); };
  const onJump = (ev) => {
    const b = ev.target.closest('[data-jump]'); if (!b) return;
    const el = view.querySelector('#' + b.dataset.jump); if (!el) return;
    setOn(b.dataset.jump);
    lockUntil = Date.now() + (reducedMotion() ? 120 : 800);
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  on(nav, 'click', onJump);
  on(window, 'scroll', onScroll, { passive: true });
  on(window, 'resize', () => { placeKnob(nav, false); onScroll(); });
  cleanups.push(() => cancelAnimationFrame(raf));
  placeKnob(nav, false);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (nav.isConnected) placeKnob(nav, false); });
  requestAnimationFrame(track);

  // Corso: the Full lesson / Section toggle only rewrites the Start link
  const lessonSeg = view.querySelector('[data-lesson-seg]');
  const startBtn = view.querySelector('[data-lesson-start]');
  if (lessonSeg && startBtn) {
    const opts = [...lessonSeg.querySelectorAll('[data-lesson]')];
    const choose = (key, { focus = false } = {}) => {
      const pick = opts.find(o => o.dataset.lesson === key); if (!pick) return;
      opts.forEach(o => { const is = o === pick; o.classList.toggle('on', is); o.setAttribute('aria-checked', is ? 'true' : 'false'); o.tabIndex = is ? 0 : -1; if (is && focus) o.focus(); });
      placeKnob(lessonSeg, !reducedMotion());
      startBtn.setAttribute('href', pick.dataset.href);
      startBtn.textContent = pick.dataset.cta;
      startBtn.setAttribute('aria-label', pick.dataset.label);
      startBtn.dataset.lesson = key;
    };
    on(lessonSeg, 'click', (ev) => { const b = ev.target.closest('[data-lesson]'); if (b) choose(b.dataset.lesson); });
    on(lessonSeg, 'keydown', (ev) => {
      const i = opts.findIndex(o => o.classList.contains('on'));
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); choose(opts[(i + 1) % opts.length].dataset.lesson, { focus: true }); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); choose(opts[(i + opts.length - 1) % opts.length].dataset.lesson, { focus: true }); }
    });
    on(window, 'resize', () => placeKnob(lessonSeg, false));
    placeKnob(lessonSeg, false);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (lessonSeg.isConnected) placeKnob(lessonSeg, false); });
  }

  // Vocabolario: the two reels of learn cards
  const next = model.next || {};
  const verbs = dedupe([verbEntry(next.verb), ...nextNew(store, 'verb', 4)], 3);
  const words = dedupe([...((next.words?.entries) || []).map(wordEntry), ...nextNew(store, 'word', 4)], 3);
  const reels = {};
  const verbEl = view.querySelector('[data-reel="verb"]');
  if (verbEl) { reels.verb = learnReel(verbEl, verbs.map(entryCard), { kind: 'verb', ariaLabel: 'Next verbs' }); cleanups.push(() => reels.verb.destroy()); }
  const wordEl = view.querySelector('[data-reel="word"]');
  if (wordEl) { reels.word = learnReel(wordEl, words.map(entryCard), { kind: 'word', ariaLabel: 'Next words' }); cleanups.push(() => reels.word.destroy()); }

  // Laboratorio: the dashboard's shared lab reel when it exports one, otherwise the same cards from model.lab
  const labEl = view.querySelector('[data-lab-reel]');
  if (labEl) {
    let labApi = null;
    if (typeof dash.mountLabReel === 'function') { try { labApi = dash.mountLabReel(labEl, model); } catch (err) { console.error(err); labApi = null; } }
    if (!labApi) labApi = learnReel(labEl, labCards(model), { kind: 'lab', ariaLabel: 'Verb lab' });
    reels.lab = labApi;
    cleanups.push(() => { const f = labApi && (labApi.destroy || labApi); if (typeof f === 'function') f.call(labApi); });
  }
  mount(view);

  return () => { cleanups.forEach(f => { try { f(); } catch { /* ignore */ } }); cleanups.length = 0; };
}
