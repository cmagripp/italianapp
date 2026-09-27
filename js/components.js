// Shared UI components: entry rows, word cards, verb cards, conjugation tables (dial + fan), list picker, action bar.
import { html, raw, esc, tr, trBlock, enPill, speakBtn, sheet, toast, promptDialog, levelBadge, icon } from './ui.js';
import { store } from './store.js';
import { CATS, POS_NAME, GENDER_NAME, article, withArticle, isPluralOnly, isUncountable, headword, shortEn, getEntry } from './data.js';
import { conjugate, splitClitic, PERSONS, IMP_PERSONS, TENSES, primary, accepted } from './conjugator.js';
import { stage, STAGE_LABEL } from './srs.js';
import { dial, fan, dropdown } from './fx.js';

const ic = (name, opts) => raw(icon(name, opts));
export const IT_POS = { noun: 'nome', adj: 'aggettivo', adv: 'avverbio', prep: 'preposizione', conj: 'congiunzione', pron: 'pronome', num: 'numero', det: 'determinante', interj: 'interiezione', expr: 'espressione', verb: 'verbo' };
const IT_GENDER = { m: 'maschile', f: 'femminile', mf: 'm · f' };

export function stageOf(id) { return stage(store.getItem(id)); }

// Headword size keyed to word length (64 → 40px), per the type scale.
export function hwSize(word) { const n = String(word || '').length; return n <= 7 ? 64 : n <= 10 ? 56 : n <= 14 ? 48 : n <= 20 ? 40 : 34; }

// ---------- entry rows ----------
export function entryRow(e, { showLevel = true, extra = '', href = null } = {}) {
  const st = stageOf(e.id);
  const learned = store.isLearned(e.id);
  const hw = e.kind === 'verb' ? e.inf : headword(e);
  const sub = e.kind === 'verb' ? `${shortEn(e.en)}${e.trans ? ' · ' + e.trans : ''}` : `${shortEn(e.en)}${e.pos === 'noun' ? ' · ' + (e.g === 'mf' ? 'm/f' : e.g) : ''}${e.pos !== 'noun' ? ' · ' + (POS_NAME[e.pos] || e.pos) : ''}`;
  return html`<a class="row-entry glass-flat" href="${href || '#/entry/' + encodeURIComponent(e.id)}" data-id="${e.id}">
    <span class="dot stage-${st}" title="${STAGE_LABEL[st]}"></span>
    <span class="re-main"><span class="re-hw">${hw}${e.kind === 'verb' ? raw('<span class="kind">verbo</span>') : ''}</span><span class="re-sub">${sub}</span></span>
    <span class="re-side">${showLevel ? raw(levelBadge(e.level || 'A1')) : ''}${learned ? raw(`<span class="check-mark" title="Learned">${icon('check', { size: 18 })}</span>`) : ''}${raw(extra)}</span>
  </a>`;
}

export function entryList(entries, opts = {}) {
  if (!entries.length) return html`<div class="empty"><p>Niente qui, per ora.</p></div>`;
  return `<div class="list">${entries.map(e => entryRow(e, opts)).join('')}</div>`;
}

// ---------- word ----------
export function wordHero(e) {
  const isNoun = e.pos === 'noun';
  const art = isNoun ? article(e, isPluralOnly(e)) : '';
  const word = isPluralOnly(e) ? e.pl : e.it;
  const cat = CATS[e.cat];
  // --hw lives on .hw-line so the article scales with the word (see .headword .article)
  return html`<div class="headword" data-headword>
    <div class="hw-line" style="--hw:${hwSize(word)}px">${art ? raw(`<span class="article">${esc(art)}</span>`) : ''}<span class="word">${word}</span></div>
    <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(isNoun ? withArticle(e, isPluralOnly(e)) : e.it, 'lg'))}</div>
    <div class="tags">${raw(levelBadge(e.level || 'A1'))}<span>${IT_POS[e.pos] || e.pos}</span>${isNoun ? raw(html`<span>${IT_GENDER[e.g] || e.g}</span>`) : ''}${e.custom ? raw('<span>custom</span>') : ''}</div>
    ${cat ? raw(html`<span class="hw-cat">${cat.name}</span>`) : ''}
  </div>`;
}

export function wordForms(e) {
  if (e.pos === 'noun') {
    const sg = isPluralOnly(e) ? null : withArticle(e, false);
    const pl = isUncountable(e) ? null : withArticle(e, true);
    const cells = [];
    if (sg) cells.push(['Singolare', sg]);
    if (pl) cells.push(['Plurale', pl]);
    if (e.fem) cells.push(['Femminile', e.fem]);
    if (e.femPl) cells.push(['Femminile plurale', e.femPl]);
    if (isUncountable(e)) cells.push(['Plurale', 'uncountable (no plural)']);
    if (isPluralOnly(e)) cells.push(['Nota', 'plural-only noun']);
    return html`<div class="forms-grid">${raw(cells.map(([l, v]) => html`<div class="f"><div class="lab">${l}</div><div class="val"><span>${v}</span>${v.includes('(') ? '' : raw(speakBtn(v, 'sm'))}</div></div>`).join(''))}</div>`;
  }
  if (e.pos === 'adj' && e.forms && e.forms.length === 4) {
    const labs = ['Masch. sing.', 'Femm. sing.', 'Masch. plur.', 'Femm. plur.'];
    return html`<div class="forms-grid">${raw(e.forms.map((f, i) => html`<div class="f"><div class="lab">${labs[i]}</div><div class="val"><span>${f}</span>${raw(speakBtn(f, 'sm'))}</div></div>`).join(''))}</div>`;
  }
  if (e.pos === 'adj') return html`<div class="note">Invariable adjective: the same form is used for all genders and numbers.</div>`;
  return '';
}

export function wordCard(e) {
  const forms = wordForms(e);
  return html`${raw(wordHero(e))}
    ${forms ? raw(html`<div class="card"><div class="sec-head in-pane"><div><span class="kicker">Forme</span></div></div>${raw(forms)}</div>`) : ''}
    ${e.ex ? raw(html`<div class="card"><div class="sec-head in-pane"><div><span class="kicker">Esempio</span></div></div><div class="example">${raw(trBlock(e.ex, e.exEn))}${raw(speakBtn(e.ex))}</div></div>`) : ''}
    ${e.note ? raw(html`<div class="card"><div class="sec-head in-pane"><div><span class="kicker">Nota</span></div></div><div class="note">${e.note}</div></div>`) : ''}`;
}

// ---------- verbs ----------
const AUX_LABEL = { avere: 'avere', essere: 'essere', both: 'avere / essere' };
const TRANS_LABEL = { vt: 'transitive', vi: 'intransitive', vr: 'reflexive / pronominal', 'vt/vi': 'transitive & intransitive' };

export function verbHero(e, conj) {
  const cat = CATS[e.cat];
  return html`<div class="headword" data-headword>
    <div class="hw-line" style="--hw:${hwSize(e.inf)}px"><span class="word">${e.inf}</span></div>
    <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(e.inf, 'lg'))}</div>
    <div class="tags">${raw(levelBadge(e.level || 'A1'))}<span>verbo</span><span>${conj.group}</span><span>${conj.irregular ? 'irregolare' : 'regolare'}</span><span>aux. ${AUX_LABEL[e.aux] || e.aux}</span></div>
    ${cat ? raw(html`<span class="hw-cat">${cat.name}</span>`) : ''}
  </div>`;
}

export function verbUsage(e, conj) {
  const patterns = (e.patterns || []).map(p => html`<span class="pattern">${p}</span>`).join('');
  const pp = accepted(conj.nonFinite.participioPassato);
  return html`<div class="card">
    <div class="sec-head in-pane"><div><span class="kicker">Reggenza</span><span class="title">Cases &amp; patterns</span></div></div>
    <div class="mb-s">${raw(patterns)}</div>
    <dl class="kv mt">
      <dt>Type</dt><dd>${TRANS_LABEL[e.trans] || e.trans}</dd>
      <dt>Auxiliary</dt><dd>${AUX_LABEL[e.aux] || e.aux}${e.aux === 'both' ? raw(' <span class="tiny muted">(essere when intransitive, avere with an object)</span>') : ''}</dd>
      <dt>Participle</dt><dd class="bold">${pp[0]}${pp.length > 1 ? raw(` <span class="muted">/ ${esc(pp.slice(1).join(' / '))}</span>`) : ''}</dd>
      <dt>Gerund</dt><dd class="bold">${primary(conj.nonFinite.gerundio)}</dd>
    </dl>
  </div>
  <div class="card">
    <div class="sec-head in-pane"><div><span class="kicker">Uso</span><span class="title">How to use it</span></div></div>
    <p>${e.usage}</p>
    ${e.related && e.related.length ? raw(html`<div class="tags">${raw(e.related.map(r => html`<span>${r}</span>`).join(''))}</div>`) : ''}
  </div>
  <div class="card">
    <div class="sec-head in-pane"><div><span class="kicker">Esempi</span></div></div>
    ${raw((e.examples || []).map(x => html`<div class="example">${raw(trBlock(x.it, x.en))}${raw(speakBtn(x.it))}</div>`).join(''))}
  </div>`;
}

export const TENSE_HELP = {
  presente: 'What happens now or habitually. Also used for the near future in speech.',
  passatoProssimo: 'Completed actions in the past with present relevance; the everyday past tense in speech. Auxiliary + past participle.',
  imperfetto: 'Ongoing, habitual or background actions in the past; descriptions, age, weather, time.',
  trapassatoProssimo: 'An action completed before another past action ("had done").',
  passatoRemoto: 'Completed past actions with no link to the present; literary and narrative (and spoken in the South).',
  trapassatoRemoto: 'Rare, literary: an action just before a passato remoto action (after dopo che, appena).',
  futuro: 'Future actions, predictions, and suppositions about the present ("sarà a casa" = he is probably home).',
  futuroAnteriore: 'An action completed before a future moment; also supposition about the past.',
  condizionale: 'Would: polite requests, wishes, hypotheses, reported information.',
  condizionalePassato: 'Would have; also the "future in the past" in reported speech.',
  congiuntivoPresente: 'After verbs of opinion, doubt, emotion, wish (penso che, spero che, benché) about the present.',
  congiuntivoPassato: 'Same triggers, for a completed action ("penso che sia partito").',
  congiuntivoImperfetto: 'Subjunctive after past-tense triggers and in "se" hypotheticals ("se avessi tempo…").',
  congiuntivoTrapassato: 'Past-perfect subjunctive for unreal past hypotheses ("se avessi saputo…").',
  imperativo: 'Commands and instructions. The Lei form uses the subjunctive.',
};

// ----- regular paradigm (used only to highlight irregular cells) -----
const RE = {
  are: { pres: ['o', 'i', 'a', 'iamo', 'ate', 'ano'], imperf: ['avo', 'avi', 'ava', 'avamo', 'avate', 'avano'], pr: ['ai', 'asti', 'ò', 'ammo', 'aste', 'arono'], subj: ['i', 'i', 'i', 'iamo', 'iate', 'ino'], subjImp: ['assi', 'assi', 'asse', 'assimo', 'aste', 'assero'], pp: 'ato', fut: 'er' },
  ere: { pres: ['o', 'i', 'e', 'iamo', 'ete', 'ono'], imperf: ['evo', 'evi', 'eva', 'evamo', 'evate', 'evano'], pr: ['ei', 'esti', 'é', 'emmo', 'este', 'erono'], subj: ['a', 'a', 'a', 'iamo', 'iate', 'ano'], subjImp: ['essi', 'essi', 'esse', 'essimo', 'este', 'essero'], pp: 'uto', fut: 'er' },
  ire: { pres: ['o', 'i', 'e', 'iamo', 'ite', 'ono'], imperf: ['ivo', 'ivi', 'iva', 'ivamo', 'ivate', 'ivano'], pr: ['ii', 'isti', 'ì', 'immo', 'iste', 'irono'], subj: ['a', 'a', 'a', 'iamo', 'iate', 'ano'], subjImp: ['issi', 'issi', 'isse', 'issimo', 'iste', 'issero'], pp: 'ito', fut: 'ir' },
};
const FUT_END = ['ò', 'ai', 'à', 'emo', 'ete', 'anno'];
const COND_END = ['ei', 'esti', 'ebbe', 'emmo', 'este', 'ebbero'];
const ISC_PRES = ['isco', 'isci', 'isce', 'iamo', 'ite', 'iscono'];
const ISC_SUBJ = ['isca', 'isca', 'isca', 'iamo', 'iate', 'iscano'];
const AUX = {
  avere: { pres: ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'], imperf: ['avevo', 'avevi', 'aveva', 'avevamo', 'avevate', 'avevano'], pr: ['ebbi', 'avesti', 'ebbe', 'avemmo', 'aveste', 'ebbero'], fut: ['avrò', 'avrai', 'avrà', 'avremo', 'avrete', 'avranno'], cond: ['avrei', 'avresti', 'avrebbe', 'avremmo', 'avreste', 'avrebbero'], subj: ['abbia', 'abbia', 'abbia', 'abbiamo', 'abbiate', 'abbiano'], subjImp: ['avessi', 'avessi', 'avesse', 'avessimo', 'aveste', 'avessero'] },
  essere: { pres: ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'], imperf: ['ero', 'eri', 'era', 'eravamo', 'eravate', 'erano'], pr: ['fui', 'fosti', 'fu', 'fummo', 'foste', 'furono'], fut: ['sarò', 'sarai', 'sarà', 'saremo', 'sarete', 'saranno'], cond: ['sarei', 'saresti', 'sarebbe', 'saremmo', 'sareste', 'sarebbero'], subj: ['sia', 'sia', 'sia', 'siamo', 'siate', 'siano'], subjImp: ['fossi', 'fossi', 'fosse', 'fossimo', 'foste', 'fossero'] },
};
const COMPOUND = { passatoProssimo: 'pres', trapassatoProssimo: 'imperf', trapassatoRemoto: 'pr', futuroAnteriore: 'fut', condizionalePassato: 'cond', congiuntivoPassato: 'subj', congiuntivoTrapassato: 'subjImp' };
const REFL = ['mi', 'ti', 'si', 'ci', 'vi', 'si'];
function joinR(stem, end, cls) {
  const f = end[0];
  if (cls === 'are') {
    if (/[cg]$/.test(stem) && (f === 'e' || f === 'i')) return stem + 'h' + end;
    if (/(ci|gi)$/.test(stem) && (f === 'e' || f === 'i')) return stem.slice(0, -1) + end;
    if (/i$/.test(stem) && f === 'i') return stem.slice(0, -1) + end;
    return stem + end;
  }
  if (/i$/.test(stem) && f === 'i') return stem.slice(0, -1) + end;
  return stem + end;
}
// regularForm('fare', 'presente', 0) → 'fo' (what a regular -are verb would give); null when no regular paradigm applies.
export function regularForm(inf, tenseKey, personIdx, { aux = 'avere', isc = false } = {}) {
  const { base, clitic } = splitClitic(String(inf || '').toLowerCase());
  if (/rre$/.test(base)) return null;
  const cls = base.slice(-3);
  const E = RE[cls]; if (!E) return null;
  const stem = base.slice(0, -3);
  const i = personIdx;
  if (clitic && clitic !== 'si') return null;
  const pron = clitic === 'si' ? REFL[i] + ' ' : '';
  const useIsc = cls === 'ire' && isc;
  const pres = (k) => joinR(stem, useIsc ? ISC_PRES[k] : E.pres[k], cls);
  const subj = (k) => joinR(stem, useIsc ? ISC_SUBJ[k] : E.subj[k], cls);
  const futStem = joinR(stem, E.fut, cls);
  const simple = {
    presente: () => pres(i),
    imperfetto: () => joinR(stem, E.imperf[i], cls),
    passatoRemoto: () => joinR(stem, E.pr[i], cls),
    futuro: () => futStem + FUT_END[i],
    condizionale: () => futStem + COND_END[i],
    congiuntivoPresente: () => subj(i),
    congiuntivoImperfetto: () => joinR(stem, E.subjImp[i], cls),
  };
  if (simple[tenseKey]) return pron + simple[tenseKey]();
  if (COMPOUND[tenseKey]) {
    const a = clitic === 'si' || aux === 'essere' ? 'essere' : 'avere';
    let pp = cls === 'ere' && /c$/.test(stem) ? stem + 'iuto' : cls === 'ere' && /sist$/.test(stem) ? stem + 'ito' : joinR(stem, E.pp, cls);
    if (a === 'essere') pp = i < 3 ? pp + '/a' : pp.slice(0, -1) + 'i/e';
    return pron + AUX[a][COMPOUND[tenseKey]][i] + ' ' + pp;
  }
  if (tenseKey === 'imperativo') {
    if (clitic) return null;
    const forms = [cls === 'are' ? pres(2) : pres(1), subj(2), pres(3), pres(4), subj(5)];
    return forms[i] ?? null;
  }
  return null;
}

// Tense table: <div class="tense-table"><div class="trow [irr]" style="--i:n"><span class="person">io</span><span class="form">sono<span class="alt">…</span></span><button class="speak sm">…</button></div>…</div>
export function conjTable(conj, key) {
  const t = conj.tenses[key];
  if (!t) return html`<div class="muted small">No ${key} forms.</div>`;
  const persons = key === 'imperativo' ? IMP_PERSONS : PERSONS;
  const rows = t.map((f, i) => {
    const alt = accepted(f); const main = alt[0]; const rest = alt.slice(1);
    const reg = conj.irregular ? regularForm(conj.inf, key, i, { aux: conj.aux, isc: conj.isc }) : null;
    const irr = reg != null && reg !== main;
    return html`<div class="trow ${irr ? 'irr' : ''}" style="--i:${i}"><span class="person">${persons[i]}</span><span class="form">${main}${rest.length ? raw(`<span class="alt">also: ${esc(rest.join(', '))}</span>`) : ''}</span>${raw(speakBtn(main, 'sm'))}</div>`;
  }).join('');
  return `<div class="tense-table" data-tense="${esc(key)}">${rows}</div>`;
}

function fanCards(conj, key) {
  const t = conj.tenses[key] || [];
  const persons = key === 'imperativo' ? IMP_PERSONS : PERSONS;
  const longest = (s) => Math.max(...String(s).split(' ').map(w => w.length));
  // "lui/lei" may break after the slash (never mid-word) so the index stays inside the card's exposed strip
  return t.map((f, i) => { const form = primary(f); return { key: persons[i], front: esc(persons[i]).replace('/', '/<wbr>'), back: `<span class="form ${longest(form) > 7 ? 'long' : ''}">${esc(form)}</span><span class="sub">${esc(persons[i])}</span>` }; });
}

const TENSE_ITEMS = TENSES.map(t => ({ key: t.key, label: t.name, sub: t.mood }));

// Conjugation pane: dial to pick the tense, table (or card fan) below, non-finite forms. Bind with bindConjSection(root, conj).
// The tools row (table/fan toggle + "Tutti i tempi" dropdown) sits under the title, above the dial, so the menu opens downward.
export function conjSection(e, conj, { defaultTense = 'presente' } = {}) {
  const nf = conj.nonFinite;
  return html`<div class="card conj-card" data-conj data-tense="${defaultTense}">
    <div class="conj-head">
      <div class="sec-head in-pane" style="margin:0"><div><span class="kicker">Forme</span><span class="title">Modi e tempi</span></div></div>
      <div class="conj-tools">
        <div class="view-toggle" role="group" aria-label="Table or cards"><button type="button" class="on" data-view="table" aria-label="Table">${ic('list', { size: 18 })}</button><button type="button" data-view="fan" aria-label="Card fan">${ic('spread', { size: 18 })}</button></div>
        <button type="button" class="btn xs secondary dial-menu" data-dial-menu aria-label="All tenses" aria-haspopup="menu" aria-expanded="false">${ic('list', { size: 16 })}Tutti i tempi</button>
      </div>
    </div>
    <div class="dial-wrap">
      <div class="dial" data-dial aria-label="Tense"><div class="tabs">${raw(TENSE_ITEMS.map(t => html`<button type="button" class="tab ${t.key === defaultTense ? 'on' : ''}" data-tense="${t.key}">${t.label}</button>`).join(''))}</div></div>
    </div>
    <div class="tense-note" data-tense-note>${TENSE_HELP[defaultTense]}</div>
    <div data-conj-table>${raw(conjTable(conj, defaultTense))}</div>
    <div class="nonfinite">
      <div class="nf"><div class="lab">Infinito</div><div class="val">${nf.infinito}</div></div>
      <div class="nf"><div class="lab">Participio passato</div><div class="val">${primary(nf.participioPassato)}</div></div>
      <div class="nf"><div class="lab">Gerundio</div><div class="val">${primary(nf.gerundio)}</div></div>
      <div class="nf"><div class="lab">Infinito passato</div><div class="val">${primary(nf.infinitoPassato)}</div></div>
    </div>
  </div>`;
}
export function bindConjSection(root, conj) {
  const card = root.querySelector('.conj-card'); if (!card) return null;
  const dialEl = card.querySelector('[data-dial]');
  const tableEl = card.querySelector('[data-conj-table]');
  const noteEl = card.querySelector('[data-tense-note]');
  const items = TENSE_ITEMS.filter(t => conj.tenses[t.key]);
  let key = card.dataset.tense || 'presente';
  let view = 'table';
  let fanApi = null;
  const idx = (k) => Math.max(0, items.findIndex(i => i.key === k));
  function show() {
    if (fanApi) { fanApi.destroy(); fanApi = null; }
    if (view === 'fan') {
      tableEl.innerHTML = `<div data-fan></div><div class="fan-tools"><button type="button" class="btn xs ghost" data-fan-flip>${icon('flip', { size: 16 })}Flip all</button><button type="button" class="btn xs ghost" data-fan-spread>${icon('spread', { size: 16 })}Spread</button></div>`;
      fanApi = fan(tableEl.querySelector('[data-fan]'), fanCards(conj, key));
    } else tableEl.innerHTML = conjTable(conj, key);
    if (noteEl) noteEl.textContent = TENSE_HELP[key] || '';
    card.dataset.tense = key;
  }
  const d = dial(dialEl, { items, index: idx(key), onChange: (i, it) => { key = it.key; show(); } });
  card.addEventListener('click', (ev) => {
    const v = ev.target.closest('[data-view]');
    if (v) { if (v.dataset.view === view) return; view = v.dataset.view; card.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b === v)); show(); return; }
    if (ev.target.closest('[data-fan-flip]')) { fanApi && fanApi.flipAll(); return; }
    const sp = ev.target.closest('[data-fan-spread]');
    if (sp) { const on = fanApi && fanApi.spread(); sp.classList.toggle('on', !!on); return; }
    const t = ev.target.closest('.tab[data-tense]');
    if (t) { d.select(idx(t.dataset.tense)); return; }
    const menu = ev.target.closest('[data-dial-menu]');
    if (menu) dropdown(menu, items.map(i => ({ value: i.key, label: i.label, sub: i.sub, selected: i.key === key })), { align: 'end', width: 272, onSelect: (v) => d.select(idx(v)) });
  });
  return { select: (k) => d.select(idx(k)), get tense() { return key; }, destroy: () => { d.destroy(); fanApi && fanApi.destroy(); } };
}

export function verbCard(e) {
  const conj = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  return { html: verbHero(e, conj) + verbUsage(e, conj) + conjSection(e, conj), conj };
}

// ---------- list picker ----------
// openListPicker(itemId, { onChange }) — onChange fires after every add / remove / new list so the page behind (bank button,
// "In lists" line) can repaint instead of showing the state from before the sheet opened.
export function openListPicker(itemId, { onChange = null } = {}) {
  const render = () => {
    const lists = Object.values(store.lists);
    return html`<div class="list">${raw(lists.map(l => html`<label class="row-entry glass-flat"><input type="checkbox" data-list="${l.id}" ${l.items.includes(itemId) ? 'checked' : ''}><span class="re-main"><span class="re-hw">${l.name}</span><span class="re-sub">${l.items.length} items</span></span></label>`).join(''))}</div>
      <button type="button" class="btn secondary block mt" data-new-list>${ic('plus', { size: 18 })} New list</button>`;
  };
  const changed = () => { if (onChange) { try { onChange(); } catch { /* ignore */ } } };
  const s = sheet(render(), { title: 'Save to list' });
  s.body.addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[data-list]'); if (!cb) return;
    if (cb.checked) { store.addToList(cb.dataset.list, itemId); toast('Added to ' + store.lists[cb.dataset.list].name, { kind: 'ok' }); }
    else store.removeFromList(cb.dataset.list, itemId);
    changed();
  });
  s.body.addEventListener('click', async (ev) => {
    if (!ev.target.closest('[data-new-list]')) return;
    const name = await promptDialog('Name of the new list', { placeholder: 'e.g. Kitchen words' });
    if (name) { const id = store.createList(name); store.addToList(id, itemId); s.body.innerHTML = render(); changed(); }
  });
}

export function actionBar(e) {
  const learned = store.isLearned(e.id);
  const inBank = store.inList('bank', e.id);
  return html`<div class="action-bar">
    <button type="button" class="btn sm ${inBank ? 'on' : ''}" data-act="bank">${ic('star', { size: 16 })}${inBank ? 'In word bank' : 'Word bank'}</button>
    <button type="button" class="btn sm" data-act="lists">${ic('plus', { size: 16 })}List</button>
    <button type="button" class="btn sm ${learned ? 'on' : ''}" data-act="learned">${ic('check', { size: 16 })}${learned ? 'Learned' : 'Mark learned'}</button>
    ${e.custom ? raw(`<button type="button" class="btn sm danger" data-act="delete-custom">${icon('trash', { size: 16 })}Delete</button>`) : ''}
  </div>`;
}
// Binds the [data-act] handler on `root` — bind it on the view's own element (the one that leaves with the view), not on the
// persistent #view — and returns an unbind function for the view's cleanup. A previous binding on the same element is replaced.
export function bindActionBar(root, e, rerender) {
  if (root.__actionBarHandler) root.removeEventListener('click', root.__actionBarHandler);
  const handler = async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'bank') { if (store.inList('bank', e.id)) { store.removeFromList('bank', e.id); toast('Removed from word bank'); } else { store.addToList('bank', e.id); toast('Saved to word bank', { kind: 'ok' }); } rerender && rerender(); }
    else if (act === 'lists') openListPicker(e.id, { onChange: () => rerender && rerender() });
    else if (act === 'learned') { if (store.isLearned(e.id)) { store.unlearn(e.id); toast('Unmarked'); } else { store.markLearned(e.id, e.kind); toast('Marked as learned', { kind: 'ok' }); } rerender && rerender(); }
    else if (act === 'delete-custom') { const { confirmDialog } = await import('./ui.js'); if (await confirmDialog('Delete this custom word?', { ok: 'Delete', danger: true })) { store.removeCustomWord(e.id); const { registerCustom } = await import('./data.js'); registerCustom(store.current.custom); location.hash = '#/lists'; } }
  };
  root.__actionBarHandler = handler;
  root.addEventListener('click', handler);
  return () => { if (root.__actionBarHandler === handler) { root.removeEventListener('click', handler); root.__actionBarHandler = null; } };
}
