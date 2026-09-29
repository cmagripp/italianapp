// Reference entry (#/reference/:id): the Codex page for one verb or one word.
// Verb: identity · at a glance · why it's irregular · family · conjugation (dial + table/fan + all tenses) ·
//       cases & patterns · usage · examples · related · progress. Word: identity · forms (fan) · article rule ·
//       gender cues · related · example · note · progress. Sticky glass mini-header with jump chips.
import { html, raw, esc, trBlock, enPill, speakBtn, levelBadge, icon, relTime, toast, secHead } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, getEntry, article, withArticle, headword, isPluralOnly, isUncountable, hasPluralForm, nounNumberNote, CATS, shortEn, fold, LEVELS } from '../data.js';
import { hwSize, IT_POS, TENSE_HELP, openListPicker } from '../components.js';
import { conjugate, regularParadigm, irregularCells, irregularAlternatives, splitClitic, primary, accepted, PERSONS, IMP_PERSONS, TENSES, TENSE_BY_KEY, MISSING } from '../conjugator.js';
import { stage, STAGE_LABEL } from '../srs.js';
import { setScene, mount, dial, fan, dropdown, riseLetters, reducedMotion } from '../fx.js';
import { refRow, refHref, byLevel } from './reference.js';

const ic = (name, opts) => raw(icon(name, opts));
const AUX_LABEL = { avere: 'avere', essere: 'essere', both: 'avere / essere' };
const TRANS_IT = { vt: 'transitivo', vi: 'intransitivo', vr: 'riflessivo', 'vt/vi': 'trans. / intrans.' };
const TRANS_EN = { vt: 'transitive', vi: 'intransitive', vr: 'reflexive / pronominal', 'vt/vi': 'transitive & intransitive' };
const GENDER_IT = { m: 'maschile', f: 'femminile', mf: 'm · f' };
const NF_NAME = { participioPassato: 'Participio passato', gerundio: 'Gerundio' };
const tenseName = (k) => TENSE_BY_KEY[k]?.name || NF_NAME[k] || k;
const LO_RE = /^(s[bcdfghjklmnpqrstvwxz]|z|gn|ps|pn|x|y|i[aeiou])/; // same rule as article() in data.js
const VOWEL_RE = /^h?[aeiouàèéìíîòóùú]/; // a leading h is silent (l'hotel, gli hobby): same test as startsVowel() in data.js
const link = (e, text) => html`<a class="ref-link" href="${refHref(e.id)}">${text || (e.kind === 'verb' ? e.inf : e.it)}</a>`;
const chipLink = (e, cls = '') => html`<a class="chip ${cls}" href="${refHref(e.id)}">${e.kind === 'verb' ? e.inf : e.it}</a>`;
const joinIt = (arr) => arr.map(f => `<span class="wf">${esc(f)}</span>`).join('<i>·</i>');
const conjOf = (e) => conjugate(e.inf, { aux: e.aux, isc: e.isc });
// display size for a form inside a fan card (longest word decides)
const wordFs = (form) => { const n = Math.max(...String(form).split(/\s+/).map(w => w.length)); return n <= 5 ? 22 : n <= 7 ? 19 : n <= 9 ? 16 : n <= 11 ? 14 : 12; };
// essere/andare/stare/dare/fare/dire change stem so completely that "regular would be esso · essi…" is noise
const SUPPLETIVE = /^(essere|andare|stare|dare|fare|dire)$/;

// Cells that differ from the regular paradigm. The engine compares -rre verbs with a contracted stem (propor-), which
// flags every cell; their real stem is the imperfetto's (propon-), so for them a cell counts as irregular only when it
// differs from both the contracted paradigm and the expanded -ere one (proponere): proponevo, proponiamo and the
// gerund are regular, propongo, proposto and proposi are not.
const NF_KEYS = ['participioPassato', 'gerundio'];
function diffCells(actual, reg) {
  const out = {};
  for (const t of TENSES) {
    if (t.compound) continue;
    const k = t.key, a = actual.tenses[k], r = reg.tenses[k];
    if (!a && !r) continue;
    if (!a || !r) { out[k] = (a || r).map((_, i) => i); continue; }
    const idx = a.map((f, i) => (primary(f) !== primary(r[i]) ? i : -1)).filter(i => i >= 0);
    if (idx.length) out[k] = idx;
  }
  for (const k of NF_KEYS) if (primary(actual.nonFinite[k]) !== primary(reg.nonFinite[k])) out[k] = [0];
  return out;
}
function irregularCellsFor(e, conj) {
  const meta = { aux: e.aux, isc: e.isc };
  const base = irregularCells(e.inf, meta);
  if (!/rre$/.test(conj.base) || !conj.tenses.imperfetto) return base;
  const stem = primary(conj.tenses.imperfetto[0]).split(' ').pop().replace(/evo$/, '');
  if (!stem) return base;
  let alt;
  try { alt = diffCells(conj, regularParadigm(stem + 'ere' + (conj.clitic || ''), meta)); } catch { return base; }
  const out = {};
  for (const k of Object.keys(base)) { const both = base[k].filter(i => (alt[k] || []).includes(i)); if (both.length) out[k] = both; }
  return out;
}

// ---------- shared: progress card, mini header, jumps ----------
function progressCard(e, actions) {
  const it = store.getItem(e.id); const st = stage(it); const lists = store.listsContaining(e.id).map(l => l.name);
  const stats = it && it.seen ? html`<div class="prog-stats"><div class="stat"><div class="num">${it.seen}</div><div class="lab">seen</div></div><div class="stat"><div class="num ok">${it.ok || 0}</div><div class="lab">right</div></div><div class="stat"><div class="num ko">${it.ko || 0}</div><div class="lab">wrong</div></div><div class="stat"><div class="num small-num">${it.due ? relTime(it.due).replace(/^in /, '') : '—'}</div><div class="lab">${it.due && it.due <= Date.now() ? 'due now' : 'next review'}</div></div></div>` : html`<p class="muted small">Not practised yet — learn it, then it enters your spaced-repetition queue.</p>`;
  return html`${raw(secHead('I tuoi progressi', 'Your progress', { cls: 'in-pane' }))}
    <div class="prog-row"><span class="dot stage-${st}"></span><b>${STAGE_LABEL[st]}</b>${store.isLearned(e.id) ? raw(html`<span class="re-tag">learned ${it?.learnedAt ? relTime(it.learnedAt) : ''}</span>`) : ''}</div>
    ${raw(stats)}
    <div class="action-bar">${raw(actions)}</div>
    ${lists.length ? raw(html`<div class="tiny muted mt">In lists: ${lists.join(', ')}</div>`) : ''}`;
}
function learnedBtn(e) { const on = store.isLearned(e.id); return html`<button type="button" class="btn sm ${on ? 'on' : ''}" data-act="learned">${ic('check', { size: 16 })}${on ? 'Learned' : 'Mark learned'}</button>`; }
const listBtn = () => html`<button type="button" class="btn sm" data-act="lists">${ic('plus', { size: 16 })}List</button>`;
const jumpChips = (jumps, cls = '') => jumps.map(j => html`<button type="button" class="chip sm ${cls}" data-jump="${j.id}">${j.label}</button>`).join('');

function mountMini(root, word, jumps) {
  const el = document.createElement('div');
  el.className = 'ref-mini glass-strong';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html`<span class="mini-word">${word}</span><div class="chips scroll mini-jumps">${raw(jumpChips(jumps))}</div>`;
  document.body.append(el);
  // shown once the page's own jump-chip row has scrolled away (never on top of it); the headword is the fallback anchor
  const hw = root.querySelector('.ref-jumps') || root.querySelector('[data-headword]');
  let io = null;
  if (hw && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(([en]) => { const show = !en.isIntersecting && en.boundingClientRect.top < 0; el.classList.toggle('show', show); el.setAttribute('aria-hidden', show ? 'false' : 'true'); }, { rootMargin: '-56px 0px 0px 0px', threshold: 0 });
    io.observe(hw);
  }
  const onClick = (ev) => { const j = ev.target.closest('[data-jump]'); if (j) jumpTo(root, j.dataset.jump); };
  el.addEventListener('click', onClick);
  return () => { io && io.disconnect(); el.remove(); };
}
function jumpTo(root, id) {
  const el = root.querySelector('#' + id); if (!el) return;
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

// ====================================================================================
// VERB
// ====================================================================================
function dialItems() {
  return TENSES.map(t => {
    if (t.key === 'imperativo') return { key: t.key, label: 'Imperativo', sub: 'modo' };
    let label = t.name;
    if (fold(label).startsWith(t.mood) && label.length > t.mood.length + 1) label = label.slice(t.mood.length + 1);
    return { key: t.key, label: label[0].toUpperCase() + label.slice(1), sub: t.mood };
  });
}
const rowIsIrr = (conj, cells, key, i) => (TENSE_BY_KEY[key]?.compound ? !!cells.participioPassato && !(conj.defective || []).includes('participioPassato') : (cells[key] || []).includes(i));

function tenseTable(conj, key, cells, { compact = false } = {}) {
  const t = conj.tenses[key];
  const info = TENSE_BY_KEY[key];
  if (!t) return html`<div class="ref-noform"><span class="kicker">${info?.name || key}</span><span>No form in use — this verb is defective in the ${info?.name || key}.</span></div>`;
  const persons = key === 'imperativo' ? IMP_PERSONS : PERSONS;
  const rows = t.map((f, i) => {
    const alt = accepted(f); const main = alt[0]; const rest = alt.slice(1);
    const missing = main === MISSING;
    const irr = !missing && rowIsIrr(conj, cells, key, i);
    return html`<div class="trow${irr ? ' irr' : ''}${missing ? ' none' : ''}" style="--i:${i}"><span class="person">${persons[i]}</span><span class="form">${missing ? raw('<span class="faint">—</span><span class="alt">no form in use</span>') : raw(html`${main}${rest.length ? raw(`<span class="alt">also: ${esc(rest.join(', '))}</span>`) : ''}`)}</span>${missing ? raw('<span></span>') : raw(speakBtn(main, 'sm'))}</div>`;
  }).join('');
  return `<div class="tense-table${compact ? ' compact' : ''}" data-tense="${esc(key)}">${rows}</div>`;
}
function fanCards(conj, key, cells) {
  const t = conj.tenses[key] || [];
  const persons = key === 'imperativo' ? IMP_PERSONS : PERSONS;
  return t.map((f, i) => { const form = primary(f); const irr = form !== MISSING && rowIsIrr(conj, cells, key, i); return { key: persons[i], front: `<span class="pl">${esc(persons[i]).replace('/', '/<wbr>')}</span>`, back: `<span class="form${irr ? ' irr' : ''}" style="font-size:${wordFs(form)}px">${esc(form)}</span><span class="sub">${esc(persons[i])}${irr ? ' · irr.' : ''}</span>`, tint: irr ? 'var(--terracotta)' : null, len: Math.max(...form.split(' ').map(w => w.length)) }; });
}
const MOODS = [['indicativo', 'Indicativo'], ['condizionale', 'Condizionale'], ['congiuntivo', 'Congiuntivo'], ['imperativo', 'Imperativo']];

// Which verbs share this verb's irregular base (proporre → porre, imporre, disporre…)
function familyOf(conj) {
  const root = conj.root; const out = [];
  for (const v of data.verbs) {
    if (v.inf === conj.inf) continue;
    const b = splitClitic(v.inf).base;
    if (!b.endsWith(root)) continue;
    if (b !== root && conjOf(v).root !== root) continue;
    out.push(v);
  }
  out.sort((a, b) => (splitClitic(a.inf).base === root ? -1 : splitClitic(b.inf).base === root ? 1 : 0) || byLevel(a, b));
  return out;
}

// The explanation: which tenses/persons differ from the regular paradigm, plus derivation, clitics, defectiveness, spelling.
function explainVerb(e, conj, cells) {
  const meta = { aux: e.aux, isc: e.isc };
  const reg = regularParadigm(e.inf, meta);
  const isRre = /rre$/.test(conj.base);
  const defective = conj.defective || [];
  const keys = Object.keys(cells).filter(k => !defective.includes(k));
  const items = keys.map(k => {
    const persons = k === 'imperativo' ? IMP_PERSONS : PERSONS;
    const isNF = !!NF_NAME[k];
    const idx = cells[k];
    const forms = isNF ? [primary(conj.nonFinite[k])] : idx.map(i => primary(conj.tenses[k][i]));
    const regForms = isRre || SUPPLETIVE.test(conj.root) ? null : isNF ? [primary(reg.nonFinite[k])] : idx.map(i => primary(reg.tenses[k][i]));
    const all = !isNF && idx.length === persons.length;
    return { key: k, name: tenseName(k), persons: isNF ? (k === 'participioPassato' ? 'non-finite' : 'non-finite') : all ? 'all persons' : idx.map(i => persons[i]).join(' · '), forms, regForms };
  });
  const simpleIrr = items.filter(i => !NF_NAME[i.key]);
  const pp = !!cells.participioPassato && !defective.includes('participioPassato');
  const ger = !!cells.gerundio;
  const lead = []; const notes = [];
  const rootE = getEntry('v:' + conj.root);
  const stem = isRre ? primary(conj.tenses.imperfetto[0]).split(' ').pop().replace(/evo$/, '') : conj.base.slice(0, -3);
  if (conj.root === 'essere') lead.push('The most irregular verb of all: each tense has its own stem (<b>sono</b>, <b>ero</b>, <b>fui</b>, <b>sarò</b>, <b>sia</b>, <b>fossi</b>) and the participle <b>stato</b> is borrowed from <i>stare</i>.');
  if (conj.prefix) {
    if (rootE) lead.push(html`<b>${conj.base}</b> is <b>${conj.prefix}-</b> + <b>${conj.root}</b>: it is conjugated like ${raw(link(rootE))}, with the same irregular forms.`);
    else lead.push(html`<b>${conj.base}</b> belongs to the <b>-${conj.root}</b> family (<b>${conj.prefix}-</b> + <b>-${conj.root}</b>): all these verbs share the same irregular forms.`);
  }
  if (conj.clitic) {
    const prons = [...new Set(conj.tenses.presente.map(f => primary(f).split(' ').slice(0, -1).join(' ')).filter(Boolean))];
    const attached = conj.tenses.imperativo ? primary(conj.tenses.imperativo[0]) : primary(conj.nonFinite.gerundio);
    lead.push(html`Pronominal verb: <b>${conj.base}</b> + <b>${conj.clitic}</b>. The pronoun${prons.length > 1 ? 's' : ''} <b>${prons.join(' · ')}</b> ${prons.length > 1 ? 'go' : 'goes'} before the conjugated verb and attach${prons.length > 1 ? '' : 'es'} to the imperative, infinitive and gerund (<b>${attached}</b>, <b>${primary(conj.nonFinite.gerundio)}</b>); compound tenses take <b>${conj.aux}</b>${conj.aux === 'essere' ? ' and the participle agrees' : ''} (<b>${primary(conj.tenses.passatoProssimo[0])}</b>).`);
    const baseE = getEntry('v:' + conj.base);
    if (!conj.prefix && baseE) lead.push(html`The verb itself is conjugated like ${raw(link(baseE))}.`);
  }
  const regular = !items.length;
  // riflettere, fendere, inferire: every main form is regular, but the engine also lists irregular alternatives (riflesso)
  const alts = regular ? Object.entries(irregularAlternatives(e.inf, meta)).map(([k, byI]) => ({ name: tenseName(k).toLowerCase(), forms: [...new Set(Object.values(byI).flat())] })) : [];
  if (alts.length) lead.push(html`<b>${e.inf}</b> is regular in its main forms: each follows the <b>${conj.group}</b> paradigm (stem <b>${stem}-</b>). It also has irregular alternatives: ${raw(alts.map(a => html`<b>${a.forms.join(', ')}</b> (${a.name})`).join(' · '))}.`);
  else if (regular && !conj.clitic && !conj.prefix) lead.push(html`<b>${e.inf}</b> is regular: it follows the <b>${conj.group}</b> paradigm exactly, so every form comes from the stem <b>${stem}-</b> plus the standard endings.`);
  else if (regular) lead.push(html`Every form is regular for the <b>${conj.group}</b> paradigm (stem <b>${stem}-</b>).`);
  else {
    const n = simpleIrr.length;
    lead.push(html`Irregular in <b>${n}</b> ${n === 1 ? 'tense' : 'tenses'}${pp ? raw(`, plus the past participle <b>${esc(primary(conj.nonFinite.participioPassato))}</b>`) : ''}${ger ? raw(`${pp ? ' and' : ', plus'} the gerund <b>${esc(primary(conj.nonFinite.gerundio))}</b>`) : ''}.${pp ? ' Every compound tense inherits that participle.' : ''}${isRre ? raw(` Verbs in <b>-rre</b> are contracted infinitives: the real stem is <b>${esc(stem)}-</b> and the endings are those of <b>-ere</b>.`) : ''}`);
  }
  if (defective.length) {
    const names = defective.map(k => k === 'participioPassato' ? 'past participle' : tenseName(k).toLowerCase());
    notes.push(html`<b>Defective:</b> no ${names.join(', ')} in use${defective.includes('participioPassato') ? ' — and therefore no compound tenses' : ''}.`);
  }
  if (conj.isc) notes.push(html`Takes the <b>-isc-</b> infix in the presente, congiuntivo presente and imperativo (<b>${primary(conj.tenses.presente[0])}</b> · <b>${primary(conj.tenses.congiuntivoPresente[0])}</b> · <b>${conj.tenses.imperativo ? primary(conj.tenses.imperativo[0]) : '—'}</b>) — the regular pattern for most -ire verbs; noi and voi keep the plain stem (<b>${primary(conj.tenses.presente[3])}</b>).`);
  const b = conj.base;
  if (/[cg]are$/.test(b)) notes.push(html`<b>Spelling:</b> an <b>h</b> keeps the hard ${/care$/.test(b) ? 'c' : 'g'} sound before e and i — <b>${primary(conj.tenses.presente[1])}</b>, <b>${primary(conj.tenses.futuro[0])}</b>. A spelling rule, not an irregularity.`);
  else if (/(ciare|giare|sciare)$/.test(b) && primary(conj.tenses.presente[1]).endsWith('i') && !primary(conj.tenses.presente[1]).endsWith('ii')) notes.push(html`<b>Spelling:</b> the i of the stem is dropped before e and i — <b>${primary(conj.tenses.presente[1])}</b>, <b>${primary(conj.tenses.futuro[0])}</b>.`);
  else if (/iare$/.test(b)) notes.push(html`<b>Spelling:</b> the stem's i is not doubled before an ending in i — <b>${primary(conj.tenses.presente[1])}</b>${/ii$/.test(primary(conj.tenses.presente[1])) ? ' (here the i is stressed, so it stays)' : ''}.`);
  else if (/gnare$/.test(b)) notes.push(html`<b>Spelling:</b> the noi/voi forms may be written with or without the i — <b>${accepted(conj.tenses.presente[3]).join(' / ')}</b>.`);
  return { regular, alts, lead, items, notes };
}

function whyHTML(why) {
  return html`${raw(secHead('Irregolarità', why.regular ? (why.alts.length ? 'Regular main forms' : 'A regular verb') : "Why it's irregular", { cls: 'in-pane' }))}
    <p class="why-lead">${raw(why.lead.join(' '))}</p>
    ${why.items.length ? raw(`<ul class="why-list">${why.items.map(it => html`<li class="why-item"><span class="why-tense">${it.name}</span><span class="why-persons">${it.persons}</span><span class="why-forms">${raw(joinIt(it.forms))}</span>${it.regForms ? raw(html`<span class="why-reg">regular would be <s>${it.regForms.join(' · ')}</s></span>`) : ''}</li>`).join('')}</ul>`) : ''}
    ${raw(why.notes.map(n => `<p class="why-note">${n}</p>`).join(''))}`;
}

function renderVerb(root, e) {
  const conj = conjOf(e);
  const cells = irregularCellsFor(e, conj);
  const why = explainVerb(e, conj, cells);
  const family = familyOf(conj);
  const defective = conj.defective || [];
  const cat = CATS[e.cat];
  const pres = conj.tenses.presente;
  const pp = accepted(conj.nonFinite.participioPassato);
  const nf = conj.nonFinite;
  // aux 'both' (salire, correre…): the compound forms carry the essere form beside the avere one — show both
  const nfBoth = (f) => (conj.auxBoth ? accepted(f).join(' / ') : primary(f));
  const drillHref = `#/game/conj-drill?src=ids:${encodeURIComponent(e.id)}&tenses=presente,passatoProssimo,imperfetto,futuro`;
  const jumps = [{ id: 'conj', label: 'Forme' }, { id: 'why', label: why.regular && !why.alts.length ? 'Regolare' : 'Irregolarità' }, ...(family.length ? [{ id: 'family', label: 'Famiglia' }] : []), { id: 'patterns', label: 'Reggenza' }, { id: 'usage', label: 'Uso' }, { id: 'examples', label: 'Esempi' }, { id: 'related', label: 'Correlati' }, { id: 'progress', label: 'Progressi' }];
  const stemOf = (s) => fold(s);
  const stem = stemOf(conj.base).slice(0, -3);
  const sameStem = stem.length >= 4 ? [...data.vocab, ...data.verbs].filter(x => x.id !== e.id && fold(x.it || x.inf).startsWith(stem) && !family.includes(x)).sort(byLevel).slice(0, 8) : [];
  const sameTopic = data.verbs.filter(x => x.id !== e.id && x.cat === e.cat && x.level === e.level).slice(0, 4);
  const related = (e.related || []).map(r => { const w = r.replace(/^(il|lo|la|l'|i|gli|le|un|uno|una|un')\s*/i, '').trim(); const hit = data.vocab.find(x => fold(x.it) === fold(w)) || data.verbs.find(x => fold(x.inf) === fold(w)); return hit ? chipLink(hit) : html`<span class="chip plain">${r}</span>`; });
  const fit = (val) => { const n = Math.max(...String(val).split(/[\s/]+/).map(w => w.length)); return n > 11 ? 'xl' : n > 9 ? 'l' : n > 7 ? 'm' : ''; };
  const glance = (lab, val, irr = false) => html`<button type="button" class="g-cell ${irr ? 'irr' : ''} ${fit(val)}" data-say="${val}"><span class="g-lab">${lab}</span><span class="g-val">${val}</span></button>`;

  root.innerHTML = html`
    <div class="headword ref-id" data-headword>
      <div class="hw-line"><span class="word" style="--hw:${hwSize(e.inf)}px" data-rise>${e.inf}</span></div>
      <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(e.inf, 'lg'))}</div>
      <div class="tags">${raw(levelBadge(e.level || 'A1'))}<span>verbo</span><span>${conj.group}</span><span>${conj.irregular ? 'irregolare' : 'regolare'}</span><span>aux. ${AUX_LABEL[e.aux] || conj.aux}</span>${e.trans ? raw(html`<span>${TRANS_IT[e.trans] || e.trans}</span>`) : ''}${defective.length ? raw('<span>difettivo</span>') : ''}${e.custom ? raw('<span>custom</span>') : ''}</div>
    </div>
    <div class="glass glance ref-target" id="glance" aria-label="At a glance">
      ${raw(glance('io', primary(pres[0]), rowIsIrr(conj, cells, 'presente', 0)))}${raw(glance('tu', primary(pres[1]), rowIsIrr(conj, cells, 'presente', 1)))}${raw(glance('lui / lei', primary(pres[2]), rowIsIrr(conj, cells, 'presente', 2)))}
      ${raw(glance('participio', pp[0], !!cells.participioPassato && pp[0] !== MISSING))}${raw(glance('gerundio', primary(nf.gerundio), !!cells.gerundio))}${raw(glance('ausiliare', AUX_LABEL[e.aux] || conj.aux))}
    </div>
    <div class="chips scroll ref-jumps">${raw(jumpChips(jumps))}</div>

    <div class="card ref-target" id="why">${raw(whyHTML(why))}</div>

    ${family.length ? raw(html`<div class="card ref-target" id="family">
      ${raw(secHead('Famiglia', getEntry('v:' + conj.root) ? `Conjugated like ${conj.root}` : `The -${conj.root} family`, { cls: 'in-pane' }))}
      <p class="muted small">Verbs built on the same base share every irregular form.</p>
      <div class="family">${raw(family.map(v => chipLink(v, splitClitic(v.inf).base === conj.root ? 'root' : '')).join(''))}</div>
    </div>`) : ''}

    <div class="card glass conj-card ref-conj ref-target" id="conj" data-conj>
      <div class="conj-head">
        ${raw(secHead('Forme', 'Modi e tempi', { cls: 'in-pane' }))}
        <div class="view-toggle" role="group" aria-label="Table or cards"><button type="button" class="on" data-view="table" aria-label="Table">${ic('list', { size: 18 })}</button><button type="button" data-view="fan" aria-label="Card fan">${ic('spread', { size: 18 })}</button></div>
      </div>
      <div class="dial-wrap"><div class="dial" data-dial aria-label="Tense"></div><button type="button" class="icon-btn dial-menu" data-dial-menu aria-label="All tenses" aria-haspopup="menu">${ic('chevronDown', { size: 18 })}</button></div>
      <div class="ref-tense-head"><span class="ref-tense-name" data-tense-name></span><span class="ref-tense-en" data-tense-en></span></div>
      <div class="tense-note" data-tense-note></div>
      <div data-conj-table></div>
      ${conj.irregular ? raw('<div class="ref-legend"><i></i>irregular form (differs from the regular paradigm)</div>') : ''}
      <div class="ref-all" id="all">
        ${raw(MOODS.map(([m, name]) => { const ts = TENSES.filter(t => t.mood === m); return html`<div class="acc" data-mood="${m}"><button type="button" class="acc-head" aria-expanded="false"><span><span class="kicker">Tutti i tempi</span><span class="title">${name}<span class="acc-count">${ts.length} ${ts.length === 1 ? 'tempo' : 'tempi'}</span></span></span>${ic('chevronDown', { size: 20 })}</button><div class="acc-body"><div class="acc-inner"><div class="in" data-lazy="${m}"></div></div></div></div>`; }).join(''))}
      </div>
      <div class="nonfinite">
        <div class="nf"><div class="lab">Infinito</div><div class="val">${nf.infinito}</div></div>
        <div class="nf ${cells.participioPassato && pp[0] !== MISSING ? 'irr' : ''}"><div class="lab">Participio passato</div><div class="val">${pp[0]}${pp.length > 1 ? raw(` <span class="muted small">/ ${esc(pp.slice(1).join(' / '))}</span>`) : ''}</div></div>
        <div class="nf ${cells.gerundio ? 'irr' : ''}"><div class="lab">Gerundio</div><div class="val">${primary(nf.gerundio)}</div></div>
        <div class="nf"><div class="lab">Participio presente</div><div class="val">${primary(nf.participioPresente)}</div></div>
        <div class="nf"><div class="lab">Infinito passato</div><div class="val">${nfBoth(nf.infinitoPassato)}</div></div>
        <div class="nf"><div class="lab">Gerundio passato</div><div class="val">${nfBoth(nf.gerundioPassato)}</div></div>
      </div>
    </div>

    <div class="card ref-target" id="patterns">
      ${raw(secHead('Reggenza', 'Cases & patterns', { cls: 'in-pane' }))}
      ${(e.patterns || []).length ? raw(html`<div class="patterns">${raw(e.patterns.map(p => html`<span class="pattern">${p}</span>`).join(''))}</div>`) : raw('<p class="muted small">No pattern recorded for this verb.</p>')}
      <dl class="kv mt">
        <dt>Type</dt><dd>${TRANS_EN[e.trans] || e.trans || '—'}</dd>
        <dt>Auxiliary</dt><dd>${AUX_LABEL[e.aux] || conj.aux}${e.aux === 'both' ? raw(' <span class="tiny muted">(essere when intransitive, avere with an object)</span>') : ''}</dd>
        <dt>Participle</dt><dd class="bold">${pp[0]}${pp.length > 1 ? raw(` <span class="muted">/ ${esc(pp.slice(1).join(' / '))}</span>`) : ''}</dd>
        <dt>Gerund</dt><dd class="bold">${primary(nf.gerundio)}</dd>
      </dl>
    </div>

    <div class="card ref-target" id="usage">
      ${raw(secHead('Uso', 'How to use it', { cls: 'in-pane' }))}
      <p class="ref-usage">${e.usage || 'No usage note yet.'}</p>
    </div>

    <div class="card ref-target" id="examples">
      ${raw(secHead('Esempi', 'Examples', { cls: 'in-pane' }))}
      ${(e.examples || []).length ? raw((e.examples || []).map(x => html`<div class="example">${raw(trBlock(x.it, x.en))}${raw(speakBtn(x.it))}</div>`).join('')) : raw('<p class="muted small">No example sentences yet.</p>')}
    </div>

    <div class="card ref-target" id="related">
      ${raw(secHead('Correlati', 'Related', { cls: 'in-pane' }))}
      ${related.length ? raw(html`<div class="rel-group"><span class="kicker">Parole legate</span><div class="rel-chips">${raw(related.join(''))}</div></div>`) : ''}
      ${sameStem.length ? raw(html`<div class="rel-group"><span class="kicker">Stessa radice · ${stem}-</span><div class="rel-chips">${raw(sameStem.map(x => chipLink(x)).join(''))}</div></div>`) : ''}
      ${sameTopic.length ? raw(html`<div class="rel-group"><span class="kicker">Verbs · ${cat ? cat.name : e.cat} · ${e.level}</span><div class="list">${raw(sameTopic.map(x => refRow(x)).join(''))}</div></div>`) : ''}
      ${!related.length && !sameStem.length && !sameTopic.length ? raw('<p class="muted small">Nothing related yet.</p>') : ''}
    </div>

    <div class="card ref-target" id="progress" data-progress></div>`;

  const actions = () => html`<a class="btn sm primary" href="#/learn/verb/${encodeURIComponent(e.id)}">${ic('book', { size: 16 })}Learn</a><a class="btn sm" href="${drillHref}">${ic('edit', { size: 16 })}Drill</a>${raw(listBtn())}${raw(learnedBtn(e))}`;
  const paintProgress = () => { root.querySelector('[data-progress]').innerHTML = progressCard(e, actions()); };
  paintProgress();
  mount(root);
  riseLetters(root.querySelector('[data-rise]'));

  // conjugation: dial + table / fan + accordions
  const card = root.querySelector('[data-conj]');
  const items = dialItems();
  const dialEl = card.querySelector('[data-dial]'), tableEl = card.querySelector('[data-conj-table]'), noteEl = card.querySelector('[data-tense-note]'), nameEl = card.querySelector('[data-tense-name]'), enEl = card.querySelector('[data-tense-en]');
  let key = 'presente', view = 'table', fanApi = null;
  const idx = (k) => Math.max(0, items.findIndex(i => i.key === k));
  function show() {
    if (fanApi) { fanApi.destroy(); fanApi = null; }
    const info = TENSE_BY_KEY[key];
    nameEl.textContent = info.name; enEl.textContent = `${info.en} · ${info.mood}`;
    if (view === 'fan' && conj.tenses[key]) {
      tableEl.innerHTML = `<div class="ref-fan" data-fan></div><div class="fan-tools"><button type="button" class="btn xs ghost" data-fan-flip>${icon('flip', { size: 16 })}Flip all</button><button type="button" class="btn xs ghost" data-fan-spread>${icon('spread', { size: 16 })}Spread</button></div>`;
      const cards = fanCards(conj, key, cells);
      const fanEl = tableEl.querySelector('[data-fan]');
      fanEl.style.setProperty('--fan-n', String(cards.length));
      // long forms (proporranno) are only legible side by side: start spread
      const spread = cards.some(c => c.len > 9);
      fanApi = fan(fanEl, cards, { spread });
      tableEl.querySelector('[data-fan-spread]').classList.toggle('on', spread);
    } else tableEl.innerHTML = tenseTable(conj, key, cells);
    noteEl.textContent = TENSE_HELP[key] || '';
    card.dataset.tense = key;
  }
  // step/radius keep the two neighbours on each side inside the strip (±1 dimmed, ±2 faint but tappable — see reference.css)
  const d = dial(dialEl, { items, index: idx(key), step: 27, radius: 260, onChange: (i, it) => { key = it.key; show(); } });
  show();
  // "Flip all" turns every back up; overlapping backs are illegible in the hand, so the fan spreads at the same time
  const flipAllSpread = () => {
    if (!fanApi) return;
    fanApi.flipAll();
    const allUp = fanApi.cards.every(c => c.classList.contains('flipped'));
    if (allUp) { fanApi.spread(true); tableEl.querySelector('[data-fan-spread]')?.classList.add('on'); }
  };
  const onClick = async (ev) => {
    const j = ev.target.closest('[data-jump]'); if (j) { jumpTo(root, j.dataset.jump); return; }
    const v = ev.target.closest('[data-view]');
    if (v) { if (v.dataset.view === view) return; view = v.dataset.view; card.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b === v)); show(); return; }
    if (ev.target.closest('[data-fan-flip]')) { flipAllSpread(); return; }
    const sp = ev.target.closest('[data-fan-spread]'); if (sp) { const on = fanApi && fanApi.spread(); sp.classList.toggle('on', !!on); return; }
    const menu = ev.target.closest('[data-dial-menu]');
    if (menu) { dropdown(menu, items.map(i => ({ value: i.key, label: TENSE_BY_KEY[i.key].name, sub: TENSE_BY_KEY[i.key].en, selected: i.key === key })), { align: 'end', width: 280, onSelect: (val) => d.select(idx(val)) }); return; }
    const head = ev.target.closest('.acc-head');
    if (head) { const lazy = head.parentElement.querySelector('[data-lazy]'); if (lazy && !lazy.dataset.done) { lazy.dataset.done = '1'; lazy.innerHTML = TENSES.filter(t => t.mood === lazy.dataset.lazy).map(t => html`<div class="ref-acc-tense"><div class="ref-tense-head"><span class="ref-tense-name">${t.name}</span><span class="ref-tense-en">${t.en}</span></div>${raw(tenseTable(conj, t.key, cells, { compact: true }))}</div>`).join(''); } return; }
    const b = ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'lists') openListPicker(e.id, { onChange: paintProgress });
    else if (b.dataset.act === 'learned') { if (store.isLearned(e.id)) { store.unlearn(e.id); toast('Unmarked'); } else { store.markLearned(e.id, 'verb'); toast('Marked as learned', { kind: 'ok' }); } paintProgress(); }
  };
  root.addEventListener('click', onClick);
  const unmountMini = mountMini(root, e.inf, jumps);
  return () => { root.removeEventListener('click', onClick); d.destroy(); fanApi && fanApi.destroy(); unmountMini(); };
}

// ====================================================================================
// WORD
// ====================================================================================
function soundOf(w) {
  const s = fold(w);
  if (/^s[bcdfghjklmnpqrstvwxz]/.test(s)) return 's + consonant (the "impure s")';
  if (/^z/.test(s)) return 'z'; if (/^gn/.test(s)) return 'gn'; if (/^ps/.test(s)) return 'ps'; if (/^pn/.test(s)) return 'pn'; if (/^x/.test(s)) return 'x';
  if (/^(y|j|i[aeiou])/.test(s)) return 'the y sound (i + vowel)';
  return 'a consonant';
}
const SHORTENED = new Set(['foto', 'moto', 'auto', 'radio', 'cinema', 'bici', 'metro', 'frigo', 'tele', 'video', 'stereo', 'euro', 'chilo', 'kilo', 'zoo']);
function pluralRule(e) {
  const it = isPluralOnly(e) ? e.pl : e.it, pl = e.pl || '';
  const a = it.split(' '), b = pl.split(' ');
  const noteHint = e.note && /plural|irregular|invariab/i.test(e.note) ? e.note : '';
  const changed = a.length > 1 ? a.filter((w, i) => b[i] !== w).length : 1;
  const compound = a.length > 1 ? (changed > 1 ? ' In this compound both parts change.' : changed === 1 ? ' In this compound only one part changes.' : '') : '';
  const w = fold(a[0]), p = fold(b[0]);
  let text, kind = 'regular';
  if (!hasPluralForm(e)) { text = nounNumberNote(e); kind = 'none'; }
  else if (pl === it) {
    kind = 'invariable';
    if (/[àèéìòù]$/.test(w)) text = 'Invariable: nouns ending in a stressed vowel never change in the plural — only the article shows the number.';
    else if (/[^aeiou]$/.test(w)) text = 'Invariable: loanwords ending in a consonant keep one form (il film → i film).';
    else if (/ie$/.test(w)) text = 'Invariable: feminine nouns in -ie keep one form (la serie → le serie).';
    else if (/i$/.test(w)) text = 'Invariable: nouns in -i keep one form (la crisi → le crisi).';
    else if (SHORTENED.has(w)) text = 'Invariable: a shortened word (fotografia, motocicletta, automobile…) keeps its clipped form.';
    else if (w.length <= 3) text = 'Invariable: monosyllables keep one form.';
    else text = 'Invariable: this noun keeps the same form in the plural.';
  } else if (a.length > 1 && changed === 0) { text = 'Invariable compound: the same form serves for the plural.'; kind = 'invariable'; }
  else {
    // work on the changing part
    let s = w, q = p;
    if (a.length > 1) { const i = a.findIndex((x, k) => b[k] !== x); if (i >= 0) { s = fold(a[i]); q = fold(b[i]); } }
    // each regular branch checks that the plural really is the rule's output (uomo → uomini, dio → dèi are irregular)
    if (/[cg]a$/.test(s) && q === s.slice(0, -1) + 'hi') text = `-${s.slice(-2)} → -${q.slice(-3)}: a masculine noun in -ca/-ga takes the masculine plural, with an h to keep the hard sound (il collega → i colleghi).`;
    else if (/ca$/.test(s) && /che$/.test(q)) text = '-ca → -che: an h keeps the hard c sound in front of e.';
    else if (/ga$/.test(s) && /ghe$/.test(q)) text = '-ga → -ghe: an h keeps the hard g sound in front of e.';
    else if (/co$/.test(s) && /chi$/.test(q)) text = '-co → -chi: the hard sound is kept with an h (the usual outcome when the stress falls on the second-last syllable).';
    else if (/go$/.test(s) && /ghi$/.test(q)) text = '-go → -ghi: the hard sound is kept with an h (the usual outcome for -go nouns).';
    else if (/co$/.test(s) && /ci$/.test(q)) text = '-co → -ci: the c softens, with no h — typical when the stress falls on the third-last syllable (mèdico → medici); amico, nemico, greco and porco are famous exceptions to the -chi rule.';
    else if (/go$/.test(s) && /gi$/.test(q)) text = '-go → -gi: the g softens, with no h — usually nouns in -logo for people (psicologo → psicologi).';
    else if (/cia$/.test(s) && /cie$/.test(q) || /gia$/.test(s) && /gie$/.test(q)) text = `-${s.slice(-3)} → -${q.slice(-3)}: the i is kept because it is stressed or follows a vowel (camicia → camicie).`;
    else if (/cia$/.test(s) && /ce$/.test(q) || /gia$/.test(s) && /ge$/.test(q)) text = `-${s.slice(-3)} → -${q.slice(-2)}: the unstressed i after a consonant drops.`;
    else if (/io$/.test(s) && /ii$/.test(q)) text = '-io → -ii: the i is stressed, so the plural keeps two (zio → zii).';
    else if (/io$/.test(s) && q === s.slice(0, -1)) text = '-io → -i: the unstressed i of the ending merges with the plural -i, so only one i is written.';
    else if (/ista$/.test(s) && /ist[ie]$/.test(q) && e.g === 'mf') text = '-ista → -isti (masculine) / -iste (feminine): one singular, two plurals, chosen by the article.';
    else if (/o$/.test(s) && /a$/.test(q)) { text = 'Irregular: a masculine noun in -o with a feminine plural in -a (a relic of the Latin neuter: il braccio → le braccia).'; kind = 'irregular'; }
    else if (/ma$/.test(s) && q === s.slice(0, -1) + 'i' && e.g === 'm') text = '-ma → -mi: masculine nouns in -a (Greek origin) take the masculine plural -i.';
    else if (/a$/.test(s) && q === s.slice(0, -1) + 'i' && e.g !== 'f') text = '-a → -i: masculine nouns in -a take the masculine plural -i.';
    else if (/o$/.test(s) && q === s.slice(0, -1) + 'i') text = e.g === 'f' ? '-o → -i: the regular -o plural, even though this noun is feminine (la mano → le mani).' : '-o → -i: the regular plural of masculine nouns.';
    else if (/a$/.test(s) && q === s.slice(0, -1) + 'e') text = '-a → -e: the regular plural of feminine nouns.';
    else if (/e$/.test(s) && q === s.slice(0, -1) + 'i') text = '-e → -i: the regular plural of -e nouns, whatever the gender.';
    else { text = 'Irregular plural: this form must be learned as it is.'; kind = 'irregular'; }
  }
  return { text: text + compound + (noteHint ? ` ${noteHint}` : ''), kind };
}

function articleRule(e) {
  const plOnly = isPluralOnly(e);
  const w = plOnly ? e.pl : e.it; const first = w.split(' ')[0]; const g = e.g;
  const vowel = VOWEL_RE.test(fold(first)), lo = LO_RE.test(fold(first));
  const items = [];
  const gText = g === 'm' ? 'masculine' : g === 'f' ? 'feminine' : 'masculine or feminine (same form; the article shows which)';
  items.push({ k: 'genere', v: GENDER_IT[g] || g || '—', text: `${w} is ${gText}.` });
  if (!plOnly) {
    let why;
    if (g === 'mf') why = vowel ? `l' for both genders: the article loses its vowel before another vowel — only agreement elsewhere shows the gender.` : lo ? `lo ${first} for a man, la ${first} for a woman: lo because the noun starts with ${soundOf(first)}.` : `il ${first} for a man, la ${first} for a woman.`;
    else if (vowel) why = `l' — ${g === 'm' ? 'lo' : 'la'} is elided before a vowel (${g === 'm' ? 'masculine' : 'feminine'} singular).`;
    else if (g === 'm' && lo) why = `lo — masculine singular before ${soundOf(first)}; il is not used before this sound.`;
    else if (g === 'm') why = 'il — masculine singular before an ordinary consonant.';
    else why = 'la — feminine singular before a consonant.';
    if (vowel && /^h/.test(fold(first))) why += ' The h is silent, so the word counts as starting with a vowel.';
    items.push({ k: 'determinativo', v: withArticle(e, false), text: why });
    let ind, indText;
    if (g === 'f') { ind = vowel ? "un'" + w : 'una ' + w; indText = vowel ? "un' — feminine una is elided before a vowel; the apostrophe is what marks it as feminine." : 'una — feminine before a consonant (never shortened before a consonant).'; }
    else if (g === 'm') { ind = (lo ? 'uno ' : 'un ') + w; indText = lo ? `uno — masculine before ${soundOf(first)}, exactly where lo is used.` : `un — masculine, before consonants and vowels alike, never with an apostrophe${vowel ? ' (un ' + w + ', no apostrophe)' : ''}.`; }
    else { ind = (vowel ? "un / un' " : lo ? 'uno / una ' : 'un / una ') + w; indText = 'The indefinite article carries the gender: masculine on the left, feminine on the right.'; }
    items.push({ k: 'indeterminativo', v: ind, text: indText });
  }
  if (!hasPluralForm(e)) items.push({ k: 'plurale', v: '—', text: pluralRule(e).text });
  else {
    const plFirst = (e.pl || '').split(' ')[0]; const pv = VOWEL_RE.test(fold(plFirst)), plo = LO_RE.test(fold(plFirst));
    let why;
    if (g === 'mf' && article(e, true).includes('/')) why = (pv || plo) ? 'gli for men, le for women.' : 'i for men, le for women.';
    else if (g === 'mf') {
      // turista → i turisti / le turiste, collega → i colleghi / le colleghe, capo → i capi / le capo: the listed plural is the masculine one
      const pa = article(e, true), one = !/\s/.test(e.it) && /a$/.test(fold(e.it));
      why = `${pa} — the listed plural is the masculine one (${pa} ${e.pl}); ${one ? `for women it is le ${e.it.replace(/([cg])a$/, '$1he').replace(/a$/, 'e')}` : 'the feminine plural is a separate form (see the note)'}.`;
    }
    else if (g === 'f') why = 'le — feminine plural, never elided (le amiche).';
    else if (article(e, true) === 'le') why = 'le — this masculine noun has a feminine plural, so the plural takes the feminine article.'; // le uova, le braccia, le orecchie
    else if (pv) why = 'gli — masculine plural before a vowel (gli amici), never shortened.';
    else if (plo) why = `gli — masculine plural before ${soundOf(plFirst)}, the plural of lo.`;
    else if (article(e, true) === 'gli') why = 'gli — the one plural that takes gli before an ordinary consonant: gli dei (never i dei).';
    else why = 'i — masculine plural before an ordinary consonant, the plural of il.';
    items.push({ k: 'plurale', v: withArticle(e, true), text: plOnly ? `${nounNumberNote(e)} ${why}` : why });
    if (!plOnly) { const r = pluralRule(e); items.push({ k: 'formazione', v: `${e.it} → ${e.pl}`, text: r.text, kind: r.kind }); }
  }
  return items;
}

function genderCues(e) {
  const w = fold(e.it.split(' ')[0]); const g = e.g; const cues = [];
  const push = (end, text, status) => cues.push({ end, text, status });
  const ok = (cond) => (cond ? 'ok' : 'exception');
  if (/ista$/.test(w) && g !== 'f') push('-ista', `Nouns in -ista name people by what they do and have one form for both genders: the article decides (il / la ${e.it}). Plural -isti (m) / -iste (f).`, ok(g === 'mf'));
  else if (/ma$/.test(w) && g === 'm') push('-ma', 'A masculine noun in -a: the -ma words of Greek origin (problema, tema, sistema, clima, programma) are masculine and pluralise in -i.', 'ok');
  else if (/(tà|tù)$/.test(w)) push(w.endsWith('tà') ? '-tà' : '-tù', 'Nouns in -tà / -tù are feminine and never change in the plural (la città → le città).', ok(g === 'f'));
  else if (/ione$/.test(w)) push('-ione', 'Nouns in -ione (-zione, -sione, -gione) are feminine.', ok(g === 'f'));
  else if (/trice$/.test(w)) push('-trice', "The feminine counterpart of -tore: l'attore → l'attrice.", ok(g === 'f'));
  else if (/(tore|sore)$/.test(w)) push('-tore', 'Agent nouns in -tore / -sore are masculine; their feminine is -trice (attore → attrice).', ok(g === 'm'));
  else if (/ore$/.test(w)) push('-ore', 'Nouns in -ore are masculine (il fiore, il colore, il dolore).', ok(g === 'm'));
  else if (/ie$/.test(w)) push('-ie', 'Nouns in -ie are feminine and invariable (la serie, la specie).', ok(g === 'f'));
  else if (/(ismo|aggio|ento|one|ame|ume)$/.test(w)) push('-' + w.match(/(ismo|aggio|ento|one|ame|ume)$/)[1], 'A typically masculine suffix.', ok(g === 'm'));
  else if (/(ezza|zione|udine|ura|ice|enza|anza|ia)$/.test(w) && g === 'f') push('-' + w.match(/(ezza|zione|udine|ura|ice|enza|anza|ia)$/)[1], 'A typically feminine suffix.', 'ok');
  if (/o$/.test(w)) push('-o', g === 'm' ? 'Nouns in -o are masculine in the vast majority of cases.' : g === 'mf' ? 'Nouns in -o are normally masculine; this one serves both genders.' : "Nouns in -o are normally masculine — this is one of the few feminine exceptions (like la mano, la foto, la radio, la moto, l'auto).", ok(g === 'm'));
  else if (/a$/.test(w)) push('-a', g === 'f' ? 'Nouns in -a are feminine in the vast majority of cases.' : g === 'mf' ? 'Nouns in -a are usually feminine; this one works for both genders.' : 'Nouns in -a are usually feminine — this masculine is an exception to remember (il papà, il cinema, il poeta, il problema).', ok(g === 'f'));
  else if (/e$/.test(w)) push('-e', 'Nouns in -e can be either gender: learn each one with its article.' + (g === 'mf' ? ' This one is the same for both genders.' : ` Here: ${g === 'm' ? 'masculine' : 'feminine'}.`), 'either');
  else if (/i$/.test(w)) push('-i', "Nouns in -i are mostly feminine and invariable (la crisi, l'analisi, la tesi); il brindisi is masculine.", ok(g === 'f'));
  else if (/[^aeiou]$/.test(w)) push('cons.', 'Words ending in a consonant are loanwords: usually masculine (il film, lo sport, il bar) and invariable in the plural.', ok(g === 'm'));
  else if (/[àèéìòù]$/.test(w)) push('accent', 'Nouns ending in a stressed vowel are invariable; -tà/-tù are feminine, -é/-ì/-ù mostly masculine (il caffè, il tassì).', 'either');
  return cues;
}

function wordForms(e) {
  if (e.pos === 'noun') {
    const cells = [];
    if (!isPluralOnly(e)) cells.push({ lab: 'Singolare', val: withArticle(e, false), tint: e.g === 'f' ? 'var(--terracotta)' : 'var(--amalfi)' });
    if (hasPluralForm(e)) cells.push({ lab: 'Plurale', val: withArticle(e, true), tint: e.g === 'f' ? 'var(--terracotta)' : 'var(--amalfi)' });
    if (e.fem) cells.push({ lab: 'Femminile', val: e.fem, tint: 'var(--terracotta)' });
    if (e.femPl) cells.push({ lab: 'Femm. plurale', val: e.femPl, tint: 'var(--terracotta)' });
    return cells;
  }
  if (e.pos === 'adj' && e.forms && e.forms.length === 4) {
    const labs = ['Masch. sing.', 'Femm. sing.', 'Masch. plur.', 'Femm. plur.'];
    return e.forms.map((f, i) => ({ lab: labs[i], val: f, tint: i % 2 ? 'var(--terracotta)' : 'var(--amalfi)' }));
  }
  if (femOnly(e)) return [{ lab: 'Femm. sing.', val: e.it, tint: 'var(--terracotta)' }, { lab: 'Femm. plur.', val: femOnlyPl(e), tint: 'var(--terracotta)' }];
  return [];
}
// incinta: an adjective used only in the feminine (the entry has no forms array, but it is not invariable)
const femOnly = (e) => e.pos === 'adj' && !e.forms && /feminine only/i.test(e.note || '') && /a$/.test(e.it);
const femOnlyPl = (e) => e.it.replace(/([cg])a$/, '$1he').replace(/a$/, 'e');

function agreementItems(e) {
  const nM = getEntry('w:ragazzo|noun') ? 'ragazzo' : 'amico', nF = nM === 'ragazzo' ? 'ragazza' : 'amica';
  if (e.forms && e.forms.length === 4) {
    const [ms, fs, mp, fp] = e.forms; const two = ms === fs;
    return [
      { k: 'classe', v: two ? '-e / -i' : '-o / -a / -i / -e', text: two ? `${e.it} belongs to the -e class: one form for both genders in the singular (${ms}) and one in the plural (${mp}).` : `${e.it} belongs to the -o class: four forms, agreeing in gender and number with the noun.` },
      { k: 'singolare', v: `un ${nM} ${ms} · una ${nF} ${fs}`, text: two ? 'Same form for masculine and feminine.' : 'Masculine -o, feminine -a.' },
      { k: 'plurale', v: `${nM.slice(0, -1)}i ${mp} · ${nF.slice(0, -1)}e ${fp}`, text: two ? '-e becomes -i for both genders.' : 'Masculine -i, feminine -e.' },
    ];
  }
  if (femOnly(e)) return [{ k: 'solo femminile', v: `${e.it} · ${femOnlyPl(e)}`, text: `Used only with feminine nouns: one singular and one plural form (una donna ${e.it}, due donne ${femOnlyPl(e)}).` }];
  return [{ k: 'invariabile', v: e.it, text: 'One form for every gender and number — colours like blu, rosa, viola and most loanwords stay unchanged (i pantaloni blu).' }];
}

function renderWord(root, e) {
  const isNoun = e.pos === 'noun';
  const art = isNoun ? article(e, isPluralOnly(e)) : '';
  const word = isPluralOnly(e) ? e.pl : e.it;
  const cat = CATS[e.cat];
  const forms = wordForms(e);
  const rule = isNoun ? articleRule(e) : e.pos === 'adj' ? agreementItems(e) : [];
  // a plural-only noun is stored in the plural (occhiali, media): its ending is the plural's, not a gender cue
  const cues = isNoun && !isPluralOnly(e) ? genderCues(e) : [];
  const sameTopic = data.vocab.filter(x => x.id !== e.id && x.cat === e.cat && x.level === e.level).slice(0, 6);
  // synonyms: another entry of the same part of speech that shares a whole gloss ("house" — not "a casa" for casa via "home")
  const glosses = new Set(String(e.en || '').split(/;|,/).map(s => fold(s).trim().replace(/^(to|the|a|an) /, '')).filter(s => s.length > 2));
  const synonyms = glosses.size ? data.vocab.filter(x => x.id !== e.id && x.pos === e.pos && String(x.en || '').split(/;|,/).some(s => glosses.has(fold(s).trim().replace(/^(to|the|a|an) /, '')))).sort(byLevel).slice(0, 6) : [];
  const stem = fold(e.it.split(' ')[0]).slice(0, 5);
  const sameStem = stem.length >= 5 ? [...data.vocab, ...data.verbs].filter(x => x.id !== e.id && fold(x.it || x.inf).startsWith(stem) && !synonyms.includes(x)).sort(byLevel).slice(0, 8) : [];
  const deckIds = [...new Set([e.id, ...sameTopic.map(x => x.id), ...synonyms.map(x => x.id)])].slice(0, 12);
  const jumps = [...(forms.length ? [{ id: 'forms', label: 'Forme' }] : []), ...(rule.length ? [{ id: 'article', label: isNoun ? 'Articolo' : 'Accordo' }] : []), ...(cues.length ? [{ id: 'gender', label: 'Genere' }] : []), { id: 'related', label: 'Correlati' }, ...(e.ex ? [{ id: 'example', label: 'Esempio' }] : []), { id: 'progress', label: 'Progressi' }];
  const say = isNoun ? withArticle(e, isPluralOnly(e)) : e.it;

  root.innerHTML = html`
    <div class="headword ref-id" data-headword>
      <div class="hw-line">${art ? raw(`<span class="article">${esc(art)}</span>`) : ''}<span class="word" style="--hw:${hwSize(word)}px" data-rise>${word}</span></div>
      <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(say, 'lg'))}</div>
      <div class="tags">${raw(levelBadge(e.level || 'A1'))}<span>${IT_POS[e.pos] || e.pos}</span>${isNoun ? raw(html`<span>${GENDER_IT[e.g] || e.g}</span>`) : ''}${isUncountable(e) ? raw('<span>normally singular</span>') : ''}${isPluralOnly(e) ? raw('<span>normally plural</span>') : ''}${cat ? raw(html`<span>${cat.name}</span>`) : ''}${e.custom ? raw('<span>custom</span>') : ''}</div>
    </div>
    ${jumps.length > 2 ? raw(html`<div class="chips scroll ref-jumps">${raw(jumpChips(jumps))}</div>`) : ''}

    ${forms.length ? raw(html`<div class="card ref-target" id="forms">
      ${raw(secHead('Forme', isNoun || forms.length !== 4 ? 'Singular & plural' : 'The four forms', { cls: 'in-pane' }))}
      ${nounNumberNote(e) ? raw(html`<p class="note small" data-number-note><strong>Plural usage:</strong> ${nounNumberNote(e)}</p>`) : ''}
      <div data-fan></div>
      <div class="fan-tools"><button type="button" class="btn xs ghost" data-fan-flip>${ic('flip', { size: 16 })}Flip all</button><button type="button" class="btn xs ghost" data-fan-spread>${ic('spread', { size: 16 })}Spread</button></div>
      <div class="forms-say">${raw(forms.map(f => html`<button type="button" class="chip sm" data-say="${f.val}">${ic('speaker', { size: 14 })}${f.val}</button>`).join(''))}</div>
    </div>`) : e.pos === 'adj' ? raw(html`<div class="card"><div class="note">Invariable adjective: the same form is used for all genders and numbers.</div></div>`) : ''}

    ${rule.length ? raw(html`<div class="card ref-target" id="article">
      ${raw(secHead(isNoun ? 'Articolo' : 'Accordo', isNoun ? [!isPluralOnly(e) && withArticle(e, false), hasPluralForm(e) && withArticle(e, true)].filter(Boolean).join(' · ') : 'Agreement', { cls: 'in-pane' }))}
      <div class="rule-list">${raw(rule.map(r => html`<div class="rule-item ${r.kind || ''}"><span class="rk">${r.k}</span><span class="rv">${r.v}</span><span class="rt">${r.text}</span></div>`).join(''))}</div>
    </div>`) : ''}

    ${cues.length ? raw(html`<div class="card ref-target" id="gender">
      ${raw(secHead('Genere', 'Gender cues', { cls: 'in-pane' }))}
      <div class="cues">${raw(cues.map(c => html`<div class="cue ${c.status}"><span class="cue-end">${c.end}</span><span class="cue-body"><span class="cue-text">${c.text}</span><span class="cue-flag">${c.status === 'ok' ? 'follows the rule' : c.status === 'exception' ? 'exception' : 'no fixed rule'}</span></span></div>`).join(''))}</div>
    </div>`) : ''}

    <div class="card ref-target" id="related">
      ${raw(secHead('Correlati', 'Related', { cls: 'in-pane' }))}
      ${synonyms.length ? raw(html`<div class="rel-group"><span class="kicker">Sinonimi · same English gloss</span><div class="list">${raw(synonyms.map(x => refRow(x)).join(''))}</div></div>`) : ''}
      ${sameStem.length ? raw(html`<div class="rel-group"><span class="kicker">Stessa radice · ${stem}-</span><div class="rel-chips">${raw(sameStem.map(x => chipLink(x)).join(''))}</div></div>`) : ''}
      ${sameTopic.length ? raw(html`<div class="rel-group"><span class="kicker">${cat ? cat.name : e.cat} · ${e.level}</span><div class="list">${raw(sameTopic.map(x => refRow(x)).join(''))}</div></div>`) : ''}
      ${!synonyms.length && !sameStem.length && !sameTopic.length ? raw('<p class="muted small">Nothing related yet.</p>') : ''}
    </div>

    ${e.ex ? raw(html`<div class="card ref-target" id="example">${raw(secHead('Esempio', 'In a sentence', { cls: 'in-pane' }))}<div class="example">${raw(trBlock(e.ex, e.exEn))}${raw(speakBtn(e.ex))}</div></div>`) : ''}
    ${e.note ? raw(html`<div class="card ref-target" id="note">${raw(secHead('Nota', 'Good to know', { cls: 'in-pane' }))}<div class="note">${e.note}</div></div>`) : ''}

    <div class="card ref-target" id="progress" data-progress></div>`;

  const actions = () => html`<a class="btn sm primary" href="#/learn/word/${encodeURIComponent(e.id)}">${ic('book', { size: 16 })}Learn</a><a class="btn sm" href="#/game/flashcards?src=ids:${encodeURIComponent(deckIds.join(','))}">${ic('flip', { size: 16 })}Flashcards</a>${raw(listBtn())}${raw(learnedBtn(e))}`;
  const paintProgress = () => { root.querySelector('[data-progress]').innerHTML = progressCard(e, actions()); };
  paintProgress();
  mount(root);
  riseLetters(root.querySelector('[data-rise]'));

  let fanApi = null, flipTimer = null;
  const fanEl = root.querySelector('[data-fan]');
  const spreadBtn = root.querySelector('[data-fan-spread]');
  const flipAllSpread = (toBack = null) => {
    if (!fanApi) return;
    fanApi.flipAll(toBack);
    if (fanApi.cards.every(c => c.classList.contains('flipped'))) { fanApi.spread(true); spreadBtn?.classList.add('on'); }
  };
  if (fanEl) {
    fanEl.classList.add('ref-fan');
    fanEl.style.setProperty('--fan-n', String(forms.length));
    fanApi = fan(fanEl, forms.map(f => ({ key: f.lab, front: esc(f.lab), back: `<span class="form" style="font-size:${wordFs(f.val)}px">${esc(f.val)}</span><span class="sub">${esc(f.lab)}</span>`, tint: f.tint })));
    flipTimer = setTimeout(() => flipAllSpread(true), reducedMotion() ? 0 : 700);
  }
  const onClick = (ev) => {
    const j = ev.target.closest('[data-jump]'); if (j) { jumpTo(root, j.dataset.jump); return; }
    if (ev.target.closest('[data-fan-flip]')) { flipAllSpread(); return; }
    const sp = ev.target.closest('[data-fan-spread]'); if (sp) { const on = fanApi && fanApi.spread(); sp.classList.toggle('on', !!on); return; }
    const b = ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'lists') openListPicker(e.id, { onChange: paintProgress });
    else if (b.dataset.act === 'learned') { if (store.isLearned(e.id)) { store.unlearn(e.id); toast('Unmarked'); } else { store.markLearned(e.id, 'word'); toast('Marked as learned', { kind: 'ok' }); } paintProgress(); }
  };
  root.addEventListener('click', onClick);
  const unmountMini = mountMini(root, headword(e), jumps);
  return () => { clearTimeout(flipTimer); root.removeEventListener('click', onClick); fanApi && fanApi.destroy(); unmountMini(); };
}

// ====================================================================================
export async function render(root, params) {
  const e = getEntry(params.id);
  if (!e) {
    setTitle('Reference'); setScene('reference');
    root.innerHTML = html`<div class="empty"><p>Nessuna voce con questo nome.</p><a class="btn primary" href="#/reference">Open the codex</a></div>`;
    return;
  }
  setTitle(e.kind === 'verb' ? e.inf : headword(e));
  setScene(e.level && LEVELS.includes(e.level) ? e.level : 'reference');
  store.pushRecent(e.id);
  return e.kind === 'verb' ? renderVerb(root, e) : renderWord(root, e);
}
