// Question generators for vocabulary and verb drills.
// Every generator returns a runner question or null when nothing usable can be built (defective verbs, no example…).
import { html, raw, esc, enPill, icon } from '../ui.js';
import { article, withArticle, isPluralOnly, isUncountable, headword, shortEn, enChoices, distractors, shuffle, pickN, sample, fold, data } from '../data.js';
import { conjugate, irregularCells, splitClitic, PERSONS, IMP_PERSONS, TENSE_BY_KEY, MISSING, primary, accepted } from '../conjugator.js';
import { checkTyped } from './engine.js';
import { store } from '../store.js';
import { allowedTenses } from '../learning/curriculum.js';
import { annotateGameQuestion } from '../learning/questions.js';
const courseTenses = () => allowedTenses(store.current?.learning || {});

const it = (e) => e.kind === 'verb' ? e.inf : e.it;
// "d'accordo" has 8 letters, "a domani" 7: apostrophes and spaces do not count
export const letterCount = (w) => String(w || '').replace(/[^\p{L}]/gu, '').length;
const enOf = (e) => shortEn(e.en);
const hw = (e) => e.kind === 'verb' ? e.inf : headword(e);
const conjOf = (e) => conjugate(e.inf, { aux: e.aux, isc: e.isc });
// A form a defective verb lacks is '—' (MISSING); an imperative may be missing entirely (null).
export const usable = (f) => f != null && f !== MISSING && primary(f) !== '' && primary(f) !== MISSING;
const usablePersons = (t) => (Array.isArray(t) ? t.map((f, i) => (usable(f) ? i : -1)).filter(i => i >= 0) : []);
const meaning = (e) => html`<div class="q-en">${raw(enPill(e.en))}</div>`;

// Stable evidence wrappers preserve the legacy question contract and its graders.
export function qTranslateMC(e, pool, dir = 'it-en') {
  return annotateGameQuestion(makeTranslateMC(e, pool, dir), e, { skill: dir === 'it-en' && e.kind !== 'verb' ? 'meaning' : 'recall' });
}
export function qTypeIt(e) { return annotateGameQuestion(makeTypeIt(e), e, { skill: 'recall' }); }
export function qTypeEn(e) { return annotateGameQuestion(makeTypeEn(e), e, { skill: 'meaning' }); }
export function qGender(e) { return annotateGameQuestion(makeGender(e), e, { skill: 'article' }); }
export function qPlural(e) { return annotateGameQuestion(makePlural(e), e, { skill: 'plural' }); }
export function qPluralMC(e, pool) { return annotateGameQuestion(makePluralMC(e, pool), e, { skill: 'plural' }); }
export function qConjType(e, tense, person = null) { return makeConjType(e, tense, person); }
export function qConjMC(e, tense, pool = [], person = null) { return makeConjMC(e, tense, pool, person); }
export function qAux(e) { return annotateGameQuestion(makeAux(e), e, { skill: 'auxiliary', tense: 'passatoProssimo' }); }
export function qParticiple(e, typed = true) { return annotateGameQuestion(makeParticiple(e, typed), e, { skill: 'participle', tense: 'passatoProssimo' }); }

export function mcChoices(correctLabel, wrongLabels, extra = {}) {
  const seen = new Set([fold(correctLabel)]);
  const wrongs = wrongLabels.filter(l => l != null && l !== '' && l !== MISSING && !seen.has(fold(l)) && seen.add(fold(l)));
  return shuffle([{ label: correctLabel, correct: true, ...extra }, ...wrongs.map(l => ({ label: l }))]);
}

// ---------- vocabulary ----------
function makeTranslateMC(e, pool, dir = 'it-en') {
  const wrong = distractors(e, pool, 3);
  if (dir === 'it-en') {
    return { type: 'mc', itemId: e.id, tag: 'What does it mean?', prompt: html`<div class="big">${hw(e)}</div>`, say: it(e), choices: mcChoices(enOf(e), wrong.map(enOf)), answer: enOf(e), explain: e.ex ? html`<i>${e.ex}</i> — ${e.exEn}` : '' };
  }
  return { type: 'mc', itemId: e.id, tag: 'Choose the Italian', prompt: html`<div class="big md">${enOf(e)}</div>`, say: it(e), choices: mcChoices(hw(e), wrong.map(hw)), answer: hw(e) };
}

function makeTypeIt(e) {
  const answers = [it(e)];
  if (e.pos === 'noun') answers.push(withArticle(e, isPluralOnly(e)));
  // another entry with the very same meaning (per favore / per piacere, prego / di niente) is a right answer too
  const key = fold(enOf(e));
  for (const x of [...data.vocab, ...data.verbs]) if (x.id !== e.id && x.kind === e.kind && fold(enOf(x)) === key) answers.push(it(x));
  const hint = e.pos === 'noun' ? (e.g === 'mf' ? 'noun' : e.g === 'f' ? 'feminine noun' : 'masculine noun') : (e.kind === 'verb' ? 'verb (infinitive)' : e.pos);
  const letters = letterCount(e.it);
  return { type: 'type', itemId: e.id, tag: 'Type the Italian', prompt: html`<div class="big md">${enOf(e)}</div><div class="sub">${hint}${letters > 2 ? ' · ' + letters + ' letters' : ''}</div>`, say: it(e), answer: answers, placeholder: 'In italiano…', explain: e.ex ? html`<i>${e.ex}</i>` : '' };
}

// "to", a leading article and trailing punctuation never count ("careful!" = "careful"); a sense with a qualifier
// ("stop (bus, tram, metro)") is also right without it, and a comma-separated sense ("sapling, young shoot") by either part.
const enKey = (s) => fold(s).trim().replace(/^to /, '').replace(/^(the|a|an) /, '').replace(/[.!?]+$/, '').trim();
function makeTypeEn(e) {
  const senses = enChoices(e);
  const keys = new Set(senses.flatMap(a => { const core = a.replace(/\s*\([^)]*\)/g, '').trim(); return [a, core, ...(/\band\b/.test(core) ? [] : core.split(/,\s*/))]; }).map(enKey).filter(Boolean));
  return { type: 'type', itemId: e.id, tag: 'Type the English', prompt: html`<div class="big">${hw(e)}</div>`, say: it(e), answer: senses, placeholder: 'In English…', accept: (v) => ({ ok: keys.has(enKey(v)) }) };
}

function makeGender(e) {
  if (e.pos !== 'noun' || isPluralOnly(e)) return null;
  const correct = article(e, false);
  const opts = e.g === 'mf' ? ['il/la', "l'", 'lo/la'] : ['il', 'la', 'lo', "l'"];
  const choices = [...new Set([correct, ...opts])].slice(0, 4).map(l => ({ label: l, correct: l === correct }));
  return { type: 'mc', itemId: e.id, tag: 'Which article?', center: true, prompt: html`<div class="big"><span class="blank">?</span> ${e.it}</div><div class="sub">${enOf(e)}</div>`, say: withArticle(e, false), choices: shuffle(choices), answer: correct, explain: e.g === 'mf' ? 'This noun has one form for both genders.' : `${esc(e.it)} is ${e.g === 'f' ? 'feminine' : 'masculine'}${/^(lo|gli)/.test(correct) ? ' (lo before s+consonant, z, gn, ps, x, y)' : correct === "l'" ? ' (l\' before a vowel)' : ''}.` };
}

function makePlural(e) {
  if (e.pos !== 'noun' || isUncountable(e) || isPluralOnly(e)) return null;
  return { type: 'type', itemId: e.id, tag: 'Type the plural', prompt: html`<div class="big">${withArticle(e, false)}</div><div class="sub">${enOf(e)}</div>`, say: withArticle(e, true), answer: [e.pl, withArticle(e, true)], placeholder: 'Plural…', explain: e.note && /plural|invariab|irregular/i.test(e.note) ? esc(e.note) : '' };
}

function makePluralMC(e, pool) {
  if (e.pos !== 'noun' || isUncountable(e) || isPluralOnly(e)) return null;
  const wrongs = new Set();
  const base = e.it;
  const cands = [base.replace(/o$/, 'i'), base.replace(/a$/, 'e'), base.replace(/e$/, 'i'), base + 's', base.replace(/o$/, 'a'), base.replace(/a$/, 'i'), base.replace(/co$/, 'ci'), base.replace(/co$/, 'chi'), base.replace(/go$/, 'gi'), base.replace(/go$/, 'ghi'), base.replace(/ca$/, 'che'), base.replace(/io$/, 'ii'), base];
  for (const c of cands) { if (c !== e.pl) wrongs.add(c); if (wrongs.size >= 3) break; }
  // an -e noun or an invariable one (cane, città, bar) has too few look-alikes of its own: other nouns' plurals fill the choices
  for (const d of distractors(e, pool, 6)) { if (wrongs.size >= 3) break; if (d.pl && d.pl !== '-' && d.pl !== '—' && fold(d.pl) !== fold(e.pl)) wrongs.add(d.pl); }
  const wl = [...wrongs].filter(x => x !== e.pl).slice(0, 3);
  return { type: 'mc', itemId: e.id, tag: 'Choose the plural', center: true, prompt: html`<div class="big">${withArticle(e, false)}</div><div class="sub">${enOf(e)}</div>`, say: withArticle(e, true), choices: mcChoices(e.pl, wl), answer: e.pl };
}

// Find the inflected form of the word inside the example sentence.
// Verbs: the compound-tense forms contribute their words separately, so clitics and auxiliaries are removed again (they
// are not this verb — except for essere/avere themselves) and, when several tokens match ("ho mangiato"), the longest one
// wins, which is the participle. One-letter tokens (è, e, a…) are never blanked.
const GENERIC = ['mi', 'ti', 'si', 'ci', 'vi', 'ne', 'la', 'lo', 'le', 'li', 'me', 'te', 'se', 'ce', 've', ''];
const AUX_WORDS = ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'sono', 'sei', 'è', 'siamo', 'siete', 'ero', 'eri', 'era', 'eravamo', 'eravate', 'erano', 'avevo', 'avevi', 'aveva', 'avevamo', 'avevate', 'avevano', 'sarò', 'sarai', 'sarà', 'saremo', 'sarete', 'saranno', 'avrò', 'avrai', 'avrà', 'avremo', 'avrete', 'avranno', 'sia', 'siano', 'abbia', 'abbiano', 'fossi', 'fosse', 'fossero', 'avessi', 'avesse', 'avessero', 'sarei', 'sarebbe', 'sarebbero', 'avrei', 'avrebbe', 'avrebbero', 'fui', 'fu', 'furono', 'ebbi', 'ebbe', 'ebbero', 'essendo', 'avendo', 'stato', 'stata', 'stati', 'state', 'avuto'];
export function findInSentence(sentence, entry, allowed = null) {
  const words = sentence.split(/(\s+|[,.;:!?«»"()])/);
  const forms = new Set();
  if (entry.kind === 'verb') {
    const c = conjOf(entry);
    for (const [key, t] of Object.entries(c.tenses)) if ((!allowed || allowed.includes(key)) && t) for (const f of t) { if (!usable(f)) continue; for (const a of accepted(f)) for (const w of a.split(' ')) forms.add(fold(w)); }
    forms.add(fold(entry.inf));
    if ((!allowed || allowed.includes('passatoProssimo')) && usable(c.nonFinite.participioPassato)) forms.add(fold(primary(c.nonFinite.participioPassato)));
    if (!allowed && usable(c.nonFinite.gerundio)) forms.add(fold(primary(c.nonFinite.gerundio)));
    if ((!allowed || allowed.includes('passatoProssimo')) && usable(c.nonFinite.participioPassato)) for (const a of accepted(c.nonFinite.participioPassato)) { forms.add(fold(a)); forms.add(fold(a).replace(/o$/, 'a')); forms.add(fold(a).replace(/o$/, 'i')); forms.add(fold(a).replace(/o$/, 'e')); }
    for (const g of GENERIC) forms.delete(fold(g));
    const self = fold(c.root || c.base);
    if (self !== 'essere' && self !== 'avere') for (const g of AUX_WORDS) forms.delete(fold(g));
    else if (self === 'essere') for (const g of ['avuto']) forms.delete(g);
  } else {
    forms.add(fold(entry.it));
    if (entry.pl && entry.pl !== '-') forms.add(fold(entry.pl));
    if (entry.fem) forms.add(fold(entry.fem));
    if (entry.forms) for (const f of entry.forms) forms.add(fold(f));
    if (entry.pos === 'adj' && !entry.forms) { const b = entry.it; forms.add(fold(b.replace(/o$/, 'a'))); forms.add(fold(b.replace(/o$/, 'i'))); forms.add(fold(b.replace(/o$/, 'e'))); forms.add(fold(b.replace(/e$/, 'i'))); }
  }
  // multi-word lemma
  const lemma = fold(entry.it);
  if (lemma.includes(' ')) {
    const fs = fold(sentence);
    const isL = (ch) => !!ch && /\p{L}/u.test(ch);
    let idx = fs.indexOf(lemma);
    while (idx >= 0 && isL(fs[idx - 1])) idx = fs.indexOf(lemma, idx + 1);
    if (idx < 0) return null;
    let end = idx + lemma.length;
    // "fino a" inside "fino alle otto": the blank covers the whole articulated preposition, never half a word
    if (isL(fs[end]) || fs[end] === "'") {
      const tail = /(^| )(a|di|da|in|su|con)$/.test(lemma) ? fs.slice(end).match(/^(ll'|lla|llo|lle|l|gli|i)(?!\p{L})/u) : null;
      if (!tail) return null;
      end += tail[0].length;
    }
    return { start: idx, end, form: sentence.slice(idx, end) };
  }
  let pos = 0, best = null;
  for (const w of words) {
    const whole = fold(w);
    const clean = forms.has(whole) ? whole : whole.replace(/^l'|^un'|^d'|^all'|^dell'|^nell'|^sull'|^dall'|^quest'|^quell'/, '');
    const offset = w.length - clean.length;
    if (clean.length > 1 && forms.has(clean) && (!best || clean.length > best.len)) best = { start: pos + offset, end: pos + w.length, form: w.slice(offset), len: clean.length };
    pos += w.length;
  }
  return best ? { start: best.start, end: best.end, form: best.form } : null;
}

// The example sentence with the gap; the whole sentence is tap-to-reveal English.
function sentencePrompt(before, after, mark, en) {
  return html`<div class="sentence itx block" role="button" tabindex="0"><div class="it">${before}<span class="blank">${mark}</span>${after}</div><div class="tr">${en}</div><div class="reveal-hint">tap for English</div></div>`;
}

export function qCloze(e, { typed = false, pool = [] } = {}) {
  const sentences = e.kind === 'verb' ? (e.examples || []) : (e.ex ? [{ it: e.ex, en: e.exEn }] : []);
  for (const s of shuffle(sentences)) {
    const hit = findInSentence(s.it, e, e.kind === 'verb' ? courseTenses() : null);
    if (!hit) continue;
    const before = s.it.slice(0, hit.start), after = s.it.slice(hit.end);
    const prompt = sentencePrompt(before, after, typed ? '…' : '?', s.en);
    if (typed) return { type: 'type', itemId: e.id, tag: 'Fill in the blank', prompt: prompt + html`<div class="sub">${e.kind === 'verb' ? 'verb: ' + e.inf : enOf(e)}</div>`, say: s.it, answer: [hit.form], placeholder: 'Missing word…' };
    let wrongs;
    if (e.kind === 'verb') {
      const c = conjOf(e);
      // the gap holds one word, so a distractor is the bare verb form: no clitic ("si alza" → alza), no auxiliary ("ha mangiato" → mangiato)
      const pick = (t, i) => (t && usable(t[i]) ? primary(t[i]).split(' ').pop().replace(/\/[ae]$/, '') : null);
      const own = [...courseTenses().flatMap(key => [0, 1, 2, 5].map(p => pick(c.tenses[key], p))), e.inf].filter(Boolean);
      const other = distractors(e, pool, 1)[0];
      const oc = other ? conjOf(other) : null;
      const cands = shuffle([...new Set(own.filter(f => fold(f) !== fold(hit.form)))]).slice(0, 2);
      if (oc) { const f = pick(oc.tenses.presente, Math.floor(Math.random() * 6)); if (f && fold(f) !== fold(hit.form) && !cands.some(x => fold(x) === fold(f))) cands.push(f); }
      while (cands.length < 3) { const f = own.find(x => !cands.includes(x) && fold(x) !== fold(hit.form)); if (!f) break; cands.push(f); }
      wrongs = cands;
    } else wrongs = distractors(e, pool, 3).map(d => d.it);
    // a lower-case lemma capitalised only by its position ("Chi è…", «D'accordo!») would give the answer away among lower-case choices
    const label = /^\p{Lu}/u.test(hit.form) && /^\p{Ll}/u.test(e.it) ? hit.form[0].toLowerCase() + hit.form.slice(1) : hit.form;
    return { type: 'mc', itemId: e.id, tag: 'Fill in the blank', center: true, prompt, say: s.it, choices: mcChoices(label, wrongs), answer: label, explain: esc(s.en) };
  }
  return null;
}

export function qScramble(e) {
  const w = it(e);
  if (w.length < 4 || w.includes(' ')) return null;
  let letters; let tries = 0;
  do { letters = shuffle(w.split('')).join(''); tries++; } while (letters === w && tries < 10);
  return { type: 'type', itemId: e.id, tag: 'Unscramble', prompt: html`<div class="big scramble">${letters}</div><div class="sub">${enOf(e)}</div>`, say: w, answer: [w], placeholder: 'Word…' };
}

export function qDictation(e) {
  // a noun of either gender is read with one article ("il cantante", never "il/la cantante"); both articles are accepted.
  // A plural-only noun is read with its plural article (gli occhiali), which is then a right answer too.
  const full = e.kind === 'verb' ? e.inf : (e.pos === 'noun' ? withArticle(e, isPluralOnly(e)) : e.it);
  const text = full.replace(/^(\S+?)\/\S+ /, '$1 ');
  return { type: 'type', itemId: e.id, tag: 'Listen and type', prompt: html`<div class="big dict">${raw(icon('ear', { size: 44 }))}</div><div class="sub">Tap the speaker, then type what you hear</div>`, say: text, autoSay: true, answer: [text, it(e), full], placeholder: 'What did you hear?', explain: esc(enOf(e)) };
}

// ---------- verbs ----------
export const DRILL_TENSES = ['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale', 'congiuntivoPresente', 'passatoRemoto', 'imperativo', 'congiuntivoImperfetto', 'trapassatoProssimo'];
const personsOf = (tense) => (tense === 'imperativo' ? IMP_PERSONS : PERSONS);
const tagFor = (tense, p) => `${TENSE_BY_KEY[tense].name} · ${personsOf(tense)[p]}`;

// Picks a usable (tense, person) cell: the requested one, another person of the same tense, or another drill tense.
// Irregular cells are preferred half of the time so drills spend more time where learners slip.
function pickCell(e, c, tense, person = null) {
  const irr = c.irregular ? irregularCells(e.inf, { aux: e.aux, isc: e.isc }) : {};
  const choose = (t) => {
    const forms = c.tenses[t]; if (!forms) return null;
    const ok = usablePersons(forms); if (!ok.length) return null;
    if (person != null && ok.includes(person)) return { tense: t, p: person };
    const irrOk = (irr[t] || []).filter(i => ok.includes(i));
    const from = irrOk.length && Math.random() < .5 ? irrOk : ok;
    return { tense: t, p: sample(from) };
  };
  const first = choose(tense);
  if (first) return first;
  for (const t of shuffle(courseTenses().filter(k => k !== tense))) { const alt = choose(t); if (alt) return alt; }
  return null;
}

export function verbForm(e, tense, person) {
  const c = conjOf(e);
  const t = c.tenses[tense];
  if (!t || !usable(t[person])) return null;
  return { conj: c, form: t[person], persons: personsOf(tense) };
}

function makeConjType(e, tense, person = null) {
  const c = conjOf(e);
  const cell = pickCell(e, c, tense, person); if (!cell) return null;
  const persons = personsOf(cell.tense);
  const form = c.tenses[cell.tense][cell.p];
  const T = TENSE_BY_KEY[cell.tense];
  return annotateGameQuestion({ type: 'type', itemId: e.id, tag: tagFor(cell.tense, cell.p), prompt: html`<div class="big md">${e.inf}</div><div class="sub"><b>${persons[cell.p]}</b> · ${T.en}${e.aux === 'both' && T.compound ? ' (use avere)' : ''}</div>${raw(meaning(e))}`, say: primary(form), answer: accepted(form), accept: (v) => checkTyped(v, accepted(form)), placeholder: `${persons[cell.p]} …`, explain: c.irregular ? 'Irregular verb.' : '' }, e, { skill: 'conjugation', tense: cell.tense, person: cell.p, allowedTenses: courseTenses() });
}

function makeConjMC(e, tense, pool = [], person = null) {
  const c = conjOf(e);
  const cell = pickCell(e, c, tense, person); if (!cell) return null;
  const t = c.tenses[cell.tense]; const p = cell.p;
  const persons = personsOf(cell.tense);
  const correct = primary(t[p]);
  const wrong = new Set();
  // other persons of the same tense
  for (const i of shuffle(usablePersons(t).filter(i => i !== p))) { const f = primary(t[i]); if (f !== correct) wrong.add(f); if (wrong.size >= 2) break; }
  // same person, other tense
  for (const tk of shuffle(courseTenses().filter(k => k !== cell.tense && c.tenses[k] && k !== 'imperativo'))) { const f = c.tenses[tk][Math.min(p, 5)]; if (!usable(f)) continue; const pf = primary(f); if (pf !== correct && !wrong.has(pf)) { wrong.add(pf); break; } }
  // a form of another verb in the same cell
  if (wrong.size < 3) { const others = pool.filter(x => x.kind === 'verb' && x.id !== e.id); if (others.length) { const o = sample(others); const oc = conjOf(o); const f = oc.tenses[cell.tense] ? oc.tenses[cell.tense][p] : null; if (usable(f) && primary(f) !== correct) wrong.add(primary(f)); } }
  if (!wrong.size) return null;
  const T = TENSE_BY_KEY[cell.tense];
  return annotateGameQuestion({ type: 'mc', itemId: e.id, tag: tagFor(cell.tense, p), center: true, prompt: html`<div class="big md">${e.inf}</div><div class="sub"><b>${persons[p]}</b> · ${T.en}</div>${raw(meaning(e))}`, say: correct, choices: mcChoices(correct, [...wrong].slice(0, 3)), answer: correct }, e, { skill: 'conjugation', tense: cell.tense, person: p, allowedTenses: courseTenses() });
}

export function qTenseDetective(e) {
  const c = conjOf(e);
  const tenses = courseTenses().filter(k => k !== 'imperativo' && usablePersons(c.tenses[k]).length);
  if (tenses.length < 2) return null;
  // a form shared by several tenses (facciamo: presente = congiuntivo presente) must not offer the twin as a distractor
  for (let tries = 0; tries < 8; tries++) {
    const tense = sample(tenses);
    const p = sample(usablePersons(c.tenses[tense]));
    const form = primary(c.tenses[tense][p]);
    const T = TENSE_BY_KEY[tense];
    const others = tenses.filter(k => k !== tense && (!usable(c.tenses[k][p]) || fold(primary(c.tenses[k][p])) !== fold(form)));
    if (others.length < 1) continue;
    const wrongT = pickN(others, 3).map(k => TENSE_BY_KEY[k].name);
    return { type: 'mc', itemId: e.id, tag: 'Which tense is this?', center: true, prompt: html`<div class="big md">${PERSONS[p]} ${form}</div><div class="sub">${e.inf}</div>${raw(meaning(e))}`, say: form, choices: mcChoices(T.name, wrongT), answer: T.name, explain: esc(T.en) };
  }
  return null;
}

export function qPersonDetective(e) {
  const c = conjOf(e);
  const tenses = courseTenses().filter(k => c.tenses[k] && usablePersons(c.tenses[k]).length === 6);
  if (!tenses.length) return null;
  const tense = sample(tenses);
  const t = c.tenses[tense];
  const unique = PERSONS.map((_, i) => primary(t[i]));
  const p = Math.floor(Math.random() * 6);
  const form = unique[p];
  const validPersons = PERSONS.filter((_, i) => unique[i] === form);
  const wrongs = pickN(PERSONS.filter(x => !validPersons.includes(x)), 3);
  if (!wrongs.length) return null;
  const T = TENSE_BY_KEY[tense];
  return { type: 'mc', itemId: e.id, tag: 'Who is the subject?', center: true, prompt: html`<div class="big md">${form}</div><div class="sub">${e.inf} · ${T.name}</div>`, say: form, choices: shuffle([{ label: validPersons.join(' / '), correct: true }, ...wrongs.map(l => ({ label: l }))]), answer: validPersons.join(' / ') };
}

function makeAux(e) {
  const c = conjOf(e);
  if (!usable(c.nonFinite.participioPassato)) return null;
  const pp = primary(c.nonFinite.participioPassato);
  const choices = [{ label: 'avere', correct: e.aux === 'avere' }, { label: 'essere', correct: e.aux === 'essere' }, { label: 'both (depends on meaning)', correct: e.aux === 'both' }];
  const aux = (choices.find(x => x.correct) || {}).label;
  if (!choices.some(x => x.correct)) return null;
  const sayForm = c.tenses.passatoProssimo && usable(c.tenses.passatoProssimo[2]) ? primary(c.tenses.passatoProssimo[2]) : e.inf;
  return { type: 'mc', itemId: e.id, tag: 'Which auxiliary?', center: true, prompt: html`<div class="big md">${e.inf}</div><div class="sub">passato prossimo: <span class="blank">?</span> ${pp}</div>`, say: sayForm, choices, answer: aux, explain: e.aux === 'essere' ? ('This use of ' + esc(e.inf) + ' takes essere; the participle agrees with the subject.') : e.aux === 'both' ? 'The auxiliary depends on the sense or construction. ' + esc(e.usage || 'Check the reference examples for this verb.') : 'Transitive verbs (and many intransitive ones) take avere.' };
}

function makeParticiple(e, typed = true) {
  const c = conjOf(e);
  const pp = c.nonFinite.participioPassato;
  if (!usable(pp)) return null;
  if (typed) return { type: 'type', itemId: e.id, tag: 'Participio passato', prompt: html`<div class="big md">${e.inf}</div><div class="sub">past participle · ${c.irregular ? 'irregular?' : 'regular'}</div>`, say: primary(pp), answer: accepted(pp), placeholder: 'participio…' };
  // pronominal verbs (andarsene, alzarsi): the participle is that of the base verb, so distractors are built on its stem
  const stem = splitClitic(e.inf).base.replace(/(are|ere|ire|rre)$/, '');
  const okSet = new Set(accepted(pp).map(fold));
  // the three regular endings, then the look of a strong participle (preso, visto, letto) built on the stem's vowel
  const vowelEnd = /[aeiou]$/.test(stem);
  const strong = vowelEnd ? [stem + 'sto', stem + 'so'] : [stem.slice(0, -1) + 'so', stem.slice(0, -1) + 'tto'];
  const wrong = new Set([stem + 'ato', stem + 'uto', stem + 'ito', ...strong].filter(x => x.length > 3 && !okSet.has(fold(x))));
  return { type: 'mc', itemId: e.id, tag: 'Participio passato', center: true, prompt: html`<div class="big md">${e.inf}</div><div class="sub">past participle</div>`, say: primary(pp), choices: mcChoices(primary(pp), [...wrong].slice(0, 3)), answer: primary(pp) };
}

export function qGerund(e) {
  const c = conjOf(e);
  const g = c.nonFinite.gerundio;
  if (!usable(g)) return null;
  return { type: 'type', itemId: e.id, tag: 'Gerundio', prompt: html`<div class="big md">${e.inf}</div><div class="sub">gerund (sto …)</div>`, say: primary(g), answer: accepted(g), placeholder: '-ando / -endo' };
}

const PREPS = ['a', 'di', 'da', 'in', 'con', 'su', 'per', 'tra'];
export function qPattern(e) {
  const pats = (e.patterns || []).map(p => ({ p, m: p.match(/^(\S+)\s+(a|di|da|in|con|su|per|tra|fra)\s+(qualcuno|qualcosa|fare|un|una|il|la|lo|l'|le|i|gli|.+)$/i) })).filter(x => x.m);
  if (!pats.length) return null;
  const { p, m } = sample(pats);
  const prep = m[2].toLowerCase();
  const rest = p.slice(m[1].length + 1 + m[2].length + 1);
  // "essere di un posto" and "essere in un posto" are both patterns: with the same verb and remainder the prompt
  // "essere ? un posto" has two right answers, so every twin preposition is offered and accepted (never a distractor)
  const remainderOf = (o) => fold(o.p.slice(o.m[1].length + 1 + o.m[2].length + 1));
  const twins = [...new Set(pats.filter(o => o !== undefined && fold(o.m[1]) === fold(m[1]) && remainderOf(o) === fold(rest)).map(o => o.m[2].toLowerCase()).filter(x => x !== prep))];
  const alias = (x) => (prep === 'tra' && x === 'fra') || (prep === 'fra' && x === 'tra');
  const wrong = pickN(PREPS.filter(x => x !== prep && !alias(x) && !twins.includes(x)), Math.max(2, 3 - twins.length));
  if (wrong.length < 2) return null;
  const choices = shuffle([{ label: prep, correct: true }, ...twins.map(t => ({ label: t, correct: true })), ...wrong.map(l => ({ label: l }))]);
  const explain = esc((e.patterns || []).join(' · ')) + (twins.length ? ` — ${esc([prep, ...twins].join(' / '))} all work here.` : '');
  return { type: 'mc', itemId: e.id, tag: 'Which preposition?', center: true, prompt: html`<div class="big md">${m[1]} <span class="blank">?</span> ${rest}</div>${raw(meaning(e))}`, say: p, choices, answer: prep, explain };
}

export function qVerbTranslateMC(e, pool) { return qTranslateMC(e, pool.filter(x => x.kind === 'verb'), 'it-en'); }

// Build a mixed question set for an entry list
export function mixedQuestions(entries, pool, { perItem = 1, verbTenses = courseTenses(), typedRatio = 0.35 } = {}) {
  const qs = [];
  for (const e of entries) {
    for (let k = 0; k < perItem; k++) {
      let q = null;
      const r = Math.random();
      if (e.kind === 'verb') {
        if (r < 0.25) q = qTranslateMC(e, pool, Math.random() < 0.5 ? 'it-en' : 'en-it');
        else if (r < 0.5) q = qConjMC(e, sample(verbTenses), pool);
        else if (r < 0.7) q = qConjType(e, sample(verbTenses));
        else if (r < 0.8 && verbTenses.includes('passatoProssimo')) q = qAux(e);
        else if (r < 0.9) q = qCloze(e, { pool });
        else q = verbTenses.includes('passatoProssimo') ? qParticiple(e, Math.random() < typedRatio) : qConjType(e, sample(verbTenses));
      } else {
        if (r < 0.3) q = qTranslateMC(e, pool, 'it-en');
        else if (r < 0.5) q = qTranslateMC(e, pool, 'en-it');
        else if (r < 0.65) q = qTypeIt(e);
        else if (r < 0.8) q = qGender(e) || qCloze(e, { pool });
        else if (r < 0.9) q = qCloze(e, { pool });
        else q = qPluralMC(e, pool) || qTranslateMC(e, pool, 'it-en');
      }
      qs.push(q || qTranslateMC(e, pool, 'it-en'));
    }
  }
  return shuffle(qs);
}
