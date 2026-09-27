// Entry codex: identity block, at-a-glance strip, sticky jump bar, dial-driven tense table (verbs) or flip-card forms (words),
// accordion sections, progress row, action bar and practice links.
import { html, raw, esc, relTime, tr, trBlock, speakBtn, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, headword, article, withArticle, isPluralOnly, isUncountable, search } from '../data.js';
import { wordHero, wordForms, verbHero, conjSection, bindConjSection, actionBar, bindActionBar } from '../components.js';
import { conjugate, primary, accepted } from '../conjugator.js';
import { stage, STAGE_LABEL } from '../srs.js';
import { setScene, mount, fan, reducedMotion } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));
const AUX_LABEL = { avere: 'avere', essere: 'essere', both: 'avere / essere' };
const TRANS_LABEL = { vt: 'transitive', vi: 'intransitive', vr: 'reflexive / pronominal', 'vt/vi': 'transitive & intransitive' };

const acc = (id, kicker, title, body, open = false) => html`<div class="acc ${open ? 'open' : ''}" id="${id}"><button type="button" class="acc-head" aria-expanded="${open ? 'true' : 'false'}"><span><span class="kicker">${kicker}</span><span class="title">${title}</span></span>${ic('chevronDown', { size: 20 })}</button><div class="acc-body"><div class="acc-inner"><div class="in">${raw(body)}</div></div></div></div>`;

function jumpBar(e, sections) {
  const isNoun = e.kind === 'word' && e.pos === 'noun';
  const hw = e.kind === 'verb' ? e.inf : isNoun && isPluralOnly(e) ? e.pl : e.it;
  const art = isNoun ? article(e, isPluralOnly(e)) : '';
  return html`<div class="jump-bar" data-jump><span class="jb-word">${art ? raw(`<span class="article">${esc(art)}</span>`) : ''}${hw}</span><div class="chips scroll">${raw(sections.map(([id, l]) => html`<button type="button" class="chip" data-jump-to="${id}">${l}</button>`).join(''))}</div></div>`;
}

// ---------- verbs ----------
function verbPage(e) {
  const conj = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const nf = conj.nonFinite; const pp = accepted(nf.participioPassato); const ger = primary(nf.gerundio);
  // a long form (proponendo, sopravvissuto…) takes the whole row instead of being hyphenated in a half-width tile
  const wide = (s) => (String(s).length > 8 ? 'wide' : '');
  const glance = html`<div class="glance">
    <div class="g"><span class="gt"><span class="lab">Ausiliare</span><span class="val">${AUX_LABEL[e.aux] || e.aux}</span></span></div>
    <div class="g ${wide(pp[0])}"><span class="gt"><span class="lab">Participio</span><span class="val">${pp[0]}</span></span>${raw(speakBtn(pp[0], 'sm'))}</div>
    <div class="g ${wide(ger)}"><span class="gt"><span class="lab">Gerundio</span><span class="val">${ger}</span></span>${raw(speakBtn(ger, 'sm'))}</div>
    <div class="g multi ${conj.irregular ? 'irr' : ''}"><span class="gt"><span class="lab">Gruppo</span><span class="val">${conj.group} · ${conj.irregular ? 'irregolare' : 'regolare'}</span></span></div>
  </div>`;
  const patterns = (e.patterns || []).map(p => html`<span class="pat"><span class="pattern">${p}</span>${raw(speakBtn(p, 'sm'))}</span>`).join('');
  const reggenza = html`${patterns ? raw(`<div class="pat-list">${patterns}</div>`) : ''}<dl class="kv">
    <dt>Type</dt><dd>${TRANS_LABEL[e.trans] || e.trans}</dd>
    <dt>Auxiliary</dt><dd>${AUX_LABEL[e.aux] || e.aux}${e.aux === 'both' ? raw(' <span class="tiny muted">(essere when intransitive, avere with an object)</span>') : ''}</dd>
    <dt>Participle</dt><dd class="bold">${pp[0]}${pp.length > 1 ? raw(` <span class="muted">/ ${esc(pp.slice(1).join(' / '))}</span>`) : ''}</dd>
    <dt>Gerund</dt><dd class="bold">${ger}</dd>
  </dl>`;
  const related = (e.related || []).map(r => {
    const hit = search(r, { limit: 3 }).find(x => (x.kind === 'verb' ? x.inf : x.it) === r);
    return hit ? html`<a class="chip" href="#/entry/${encodeURIComponent(hit.id)}">${r}</a>` : html`<span class="chip">${r}</span>`;
  }).join('');
  const uso = html`<p>${e.usage || 'No usage note yet.'}</p>${related ? raw(`<div class="chips rel-chips">${related}</div>`) : ''}`;
  const esempi = (e.examples || []).map(x => html`<div class="example">${raw(trBlock(x.it, x.en))}${raw(speakBtn(x.it))}</div>`).join('') || html`<p class="muted">No examples yet.</p>`;
  const sections = [['forme', 'Forme'], ['reggenza', 'Reggenza'], ['uso', 'Uso'], ['esempi', 'Esempi'], ['pratica', 'Pratica']];
  const body = verbHero(e, conj) + glance + jumpBar(e, sections)
    + html`<div id="forme">${raw(conjSection(e, conj))}</div>`
    + acc('reggenza', 'Reggenza', 'Cases & patterns', reggenza, true)
    + acc('uso', 'Uso', 'How to use it', uso, false)
    + acc('esempi', 'Esempi', 'In context', esempi, true);
  return { body, conj };
}
function drillsHTML(e) {
  const ids = encodeURIComponent(e.id);
  return html`<div id="pratica" class="section"><div class="grp-kicker"><span class="kicker">Pratica</span><span class="kicker">Just this verb</span></div><div class="drill-grid">
    <a class="qtile" href="#/game/conj-drill?src=ids:${ids}&tenses=presente,passatoProssimo,imperfetto,futuro" style="--qc:var(--terracotta)"><span class="qi">${ic('edit')}</span><span class="qt"><span class="name">Drill this verb</span><span class="desc">Type the forms</span></span></a>
    <a class="qtile" href="#/game/conj-choice?src=ids:${ids}&tenses=presente,passatoProssimo,imperfetto,futuro,condizionale,congiuntivoPresente" style="--qc:var(--amalfi)"><span class="qi">${ic('dial')}</span><span class="qt"><span class="name">Pick the form</span><span class="desc">Multiple choice</span></span></a>
  </div></div>`;
}

// ---------- words ----------
function formCells(e) {
  const cells = [];
  if (e.pos === 'noun') {
    if (!isPluralOnly(e)) cells.push(['Singolare', withArticle(e, false)]);
    if (!isUncountable(e)) cells.push(['Plurale', withArticle(e, true)]);
    if (e.fem) cells.push(['Femminile', e.fem]);
    if (e.femPl) cells.push(['Femminile plurale', e.femPl]);
  } else if (e.pos === 'adj' && e.forms && e.forms.length === 4) {
    ['Masch. sing.', 'Femm. sing.', 'Masch. plur.', 'Femm. plur.'].forEach((l, i) => cells.push([l, e.forms[i]]));
  }
  return cells;
}
function wordPage(e) {
  const cells = formCells(e);
  const hasForms = cells.length > 0 || e.pos === 'adj' || e.pos === 'noun';
  const formsCard = hasForms ? html`<div class="card forms-card" id="forme" data-forms-card>
    <div class="conj-head"><div class="sec-head in-pane" style="margin:0"><div><span class="kicker">Forme</span><span class="title">${e.pos === 'noun' ? 'Singolare e plurale' : 'Genere e numero'}</span></div></div>
      ${cells.length ? raw(html`<div class="view-toggle" role="group" aria-label="Cards or grid"><button type="button" class="on" data-fview="fan" aria-label="Flip cards">${ic('flip', { size: 18 })}</button><button type="button" data-fview="grid" aria-label="Grid">${ic('list', { size: 18 })}</button></div>`) : ''}
    </div>
    <div data-forms-body>${cells.length ? '' : raw(wordForms(e))}</div>
  </div>` : '';
  const sections = [];
  if (hasForms) sections.push(['forme', 'Forme']);
  if (e.ex) sections.push(['esempio', 'Esempio']);
  if (e.note) sections.push(['nota', 'Nota']);
  sections.push(['progressi', 'Progressi']);
  const body = wordHero(e) + jumpBar(e, sections) + formsCard
    + (e.ex ? acc('esempio', 'Esempio', 'In context', html`<div class="example">${raw(trBlock(e.ex, e.exEn))}${raw(speakBtn(e.ex))}</div>`, true) : '')
    + (e.note ? acc('nota', 'Nota', 'Good to know', html`<div class="note">${e.note}</div>`, true) : '');
  return { body, cells };
}
function bindForms(codex, e, cells) {
  const card = codex.querySelector('[data-forms-card]'); if (!card || !cells.length) return () => {};
  const bodyEl = card.querySelector('[data-forms-body]');
  const tint = `var(--lvl-${e.level || 'A1'})`;
  let view = 'fan'; let api = null; let timer = null;
  // with every back up the overlapping hand cuts the forms short ("il conigli"), so the cards spread at the same time
  const flipAllSpread = (toBack = null) => {
    if (!api) return;
    api.flipAll(toBack);
    if (api.cards.every(c => c.classList.contains('flipped'))) { api.spread(true); bodyEl.querySelector('[data-fan-spread]')?.classList.add('on'); }
  };
  function show() {
    if (api) { api.destroy(); api = null; } clearTimeout(timer);
    if (view === 'fan') {
      bodyEl.innerHTML = `<div data-fan></div><div class="fan-tools"><button type="button" class="btn sm ghost" data-fan-flip>${icon('flip', { size: 16 })}Flip all</button><button type="button" class="btn sm ghost" data-fan-spread>${icon('spread', { size: 16 })}Spread</button></div>`;
      // the form sits in .form like the other fans, so a long word (otorinolaringoiatra) takes the smaller .long size instead of breaking mid-word at 19px
      const longWord = (v) => String(v).split(/\s+/).some(w => w.length > 9);
      api = fan(bodyEl.querySelector('[data-fan]'), cells.map(([l, v]) => ({ key: l, front: esc(l), back: `<span class="form ${longWord(v) ? 'long' : ''}">${esc(v)}</span><span class="sub">${esc(l)}</span>`, tint })));
      timer = setTimeout(() => flipAllSpread(true), reducedMotion() ? 0 : 480);
    } else bodyEl.innerHTML = wordForms(e);
  }
  card.addEventListener('click', (ev) => {
    const v = ev.target.closest('[data-fview]');
    if (v) { if (v.dataset.fview === view) return; view = v.dataset.fview; card.querySelectorAll('[data-fview]').forEach(b => b.classList.toggle('on', b === v)); show(); return; }
    if (ev.target.closest('[data-fan-flip]')) { flipAllSpread(); return; }
    const sp = ev.target.closest('[data-fan-spread]');
    if (sp) { const on = api && api.spread(); sp.classList.toggle('on', !!on); }
  });
  show();
  return () => { clearTimeout(timer); api && api.destroy(); };
}

// ---------- shared blocks ----------
function progressHTML(e) {
  const it = store.getItem(e.id); const st = stage(it); const learned = store.isLearned(e.id);
  const line = it && it.seen ? `seen ${it.seen}× · ${it.ok} right · ${it.ko} wrong · next ${relTime(it.due)}` : learned ? `learned ${relTime(it.learnedAt)} · next review ${relTime(it.due)}` : 'Not started yet · learn it in a short walkthrough';
  return html`<div class="card prog-row"><span class="dot stage-${st}"></span><span class="pt"><b>${STAGE_LABEL[st]}</b><span class="pm">${line}</span></span>${!learned ? raw(html`<a class="btn sm primary" href="#/learn/${e.kind}/${encodeURIComponent(e.id)}">${ic('sparkle', { size: 16 })}Learn</a>`) : ''}</div>`;
}
function actionsHTML(e) {
  const lists = store.listsContaining(e.id).map(l => l.name);
  return actionBar(e) + (lists.length ? html`<div class="in-lists">In lists: ${raw(lists.map(n => html`<b>${n}</b>`).join(', '))}</div>` : '');
}

export async function render(root, params) {
  const e = getEntry(params.id);
  if (!e) { root.innerHTML = html`<div class="empty"><p>${raw(tr('Voce non trovata.', 'Entry not found.'))}</p><a class="btn primary" href="#/words">Search the dictionary</a></div>`; return; }
  setTitle(e.kind === 'verb' ? e.inf : headword(e));
  setScene(e.level || 'A1');
  store.pushRecent(e.id);
  const isVerb = e.kind === 'verb';
  const page = isVerb ? verbPage(e) : wordPage(e);
  root.innerHTML = html`<div class="pg codex" data-kind="${e.kind}">${raw(page.body)}<div id="progressi" data-progress>${raw(progressHTML(e))}</div><div class="card" data-actions>${raw(actionsHTML(e))}</div>${isVerb ? raw(drillsHTML(e)) : ''}</div>`;
  const codex = root.firstElementChild;
  const cleanups = [];
  if (isVerb) { const c = bindConjSection(codex, page.conj); if (c) cleanups.push(() => c.destroy()); }
  else cleanups.push(bindForms(codex, e, page.cells));
  // bound on the codex element (which leaves with the view) and unbound on cleanup, so it never outlives this entry
  cleanups.push(bindActionBar(codex, e, () => { codex.querySelector('[data-actions]').innerHTML = actionsHTML(e); codex.querySelector('[data-progress]').innerHTML = progressHTML(e); }));

  // sticky jump bar: reveals the headword once the identity block has scrolled under the top bar
  const bar = codex.querySelector('[data-jump]'); const hw = codex.querySelector('[data-headword]');
  const topOffset = () => (document.getElementById('topbar')?.getBoundingClientRect().bottom || 52) + 4;
  if (bar && hw && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => { bar.classList.toggle('stuck', !en.isIntersecting && en.boundingClientRect.bottom <= topOffset() + 8); }, { rootMargin: `-${Math.round(topOffset())}px 0px 0px 0px`, threshold: 0 });
    io.observe(hw);
    cleanups.push(() => io.disconnect());
  }
  bar?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-jump-to]'); if (!b) return;
    const target = codex.querySelector('#' + b.dataset.jumpTo); if (!target) return;
    if (target.classList.contains('acc') && !target.classList.contains('open')) { target.classList.add('open'); target.querySelector('.acc-head')?.setAttribute('aria-expanded', 'true'); }
    const y = target.getBoundingClientRect().top + window.scrollY - topOffset() - bar.offsetHeight - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
  mount(codex);
  return () => cleanups.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}
