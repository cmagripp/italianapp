// Question generators for vocabulary and verb drills.
import { html, raw, esc } from '../ui.js';
import { article, withArticle, isPluralOnly, isUncountable, headword, shortEn, enChoices, distractors, shuffle, pickN, sample, fold, data } from '../data.js';
import { conjugate, PERSONS, IMP_PERSONS, TENSE_BY_KEY, primary, accepted } from '../conjugator.js';
import { checkTyped } from './engine.js';

const it = (e) => e.kind === 'verb' ? e.inf : e.it;
const enOf = (e) => shortEn(e.en);
const hw = (e) => e.kind === 'verb' ? e.inf : headword(e);

export function mcChoices(correctLabel, wrongLabels, extra = {}) {
  return shuffle([{ label: correctLabel, correct: true, ...extra }, ...wrongLabels.map(l => ({ label: l }))]);
}

// ---------- vocabulary ----------
export function qTranslateMC(e, pool, dir = 'it-en') {
  const wrong = distractors(e, pool, 3);
  if (dir === 'it-en') {
    return { type: 'mc', itemId: e.id, tag: 'What does it mean?', prompt: html`<div class="big">${hw(e)}</div>`, say: it(e), choices: mcChoices(enOf(e), wrong.map(enOf)), answer: enOf(e), explain: e.ex ? html`<i>${e.ex}</i> — ${e.exEn}` : '' };
  }
  return { type: 'mc', itemId: e.id, tag: 'Choose the Italian', prompt: html`<div class="big md">${enOf(e)}</div>`, say: it(e), choices: mcChoices(hw(e), wrong.map(hw)), answer: hw(e) };
}

export function qTypeIt(e) {
  const answers = [it(e)];
  if (e.pos === 'noun') answers.push(withArticle(e, false));
  const hint = e.pos === 'noun' ? (e.g === 'mf' ? 'noun' : e.g === 'f' ? 'feminine noun' : 'masculine noun') : (e.kind === 'verb' ? 'verb (infinitive)' : e.pos);
  return { type: 'type', itemId: e.id, tag: 'Type the Italian', prompt: html`<div class="big md">${enOf(e)}</div><div class="sub">${hint}${e.it.length > 2 ? ' · ' + e.it.length + ' letters' : ''}</div>`, say: it(e), answer: answers, placeholder: 'In italiano…', explain: e.ex ? html`<i>${e.ex}</i>` : '' };
}

export function qTypeEn(e) {
  const answers = enChoices(e).flatMap(a => [a, a.replace(/^to /, ''), a.replace(/^(the|a|an) /, '')]);
  return { type: 'type', itemId: e.id, tag: 'Type the English', prompt: html`<div class="big">${hw(e)}</div>`, say: it(e), answer: answers, placeholder: 'In English…', accept: (v) => { const a = fold(v).trim().replace(/^to /, '').replace(/^(the|a|an) /, '').replace(/[.!?]$/, ''); return { ok: answers.some(x => fold(x) === a) }; } };
}

export function qGender(e) {
  if (e.pos !== 'noun' || isPluralOnly(e)) return null;
  const correct = article(e, false);
  const opts = e.g === 'mf' ? ['il/la', "l'", 'lo/la'] : ['il', 'la', 'lo', "l'"];
  const choices = [...new Set([correct, ...opts])].slice(0, 4).map(l => ({ label: l, correct: l === correct }));
  return { type: 'mc', itemId: e.id, tag: 'Which article?', center: true, prompt: html`<div class="big">___ ${e.it}</div><div class="sub">${enOf(e)}</div>`, say: withArticle(e, false), choices: shuffle(choices), answer: correct, explain: e.g === 'mf' ? 'This noun has one form for both genders.' : `${e.it} is ${e.g === 'f' ? 'feminine' : 'masculine'}${/^(lo|gli)/.test(correct) ? " (lo before s+consonant, z, gn, ps, x, y)" : correct === "l'" ? ' (l\' before a vowel)' : ''}.` };
}

export function qPlural(e) {
  if (e.pos !== 'noun' || isUncountable(e) || isPluralOnly(e)) return null;
  return { type: 'type', itemId: e.id, tag: 'Type the plural', prompt: html`<div class="big">${withArticle(e, false)}</div><div class="sub">${enOf(e)}</div>`, say: withArticle(e, true), answer: [e.pl, withArticle(e, true)], placeholder: 'Plural…', explain: e.note && /plural|invariab|irregular/i.test(e.note) ? e.note : '' };
}

export function qPluralMC(e, pool) {
  if (e.pos !== 'noun' || isUncountable(e) || isPluralOnly(e)) return null;
  const wrongs = new Set();
  const base = e.it;
  const cands = [base.replace(/o$/, 'i'), base.replace(/a$/, 'e'), base.replace(/e$/, 'i'), base + 's', base.replace(/o$/, 'a'), base.replace(/a$/, 'i'), base.replace(/co$/, 'ci'), base.replace(/co$/, 'chi'), base.replace(/go$/, 'gi'), base.replace(/go$/, 'ghi'), base.replace(/ca$/, 'che'), base.replace(/io$/, 'ii'), base];
  for (const c of cands) { if (c !== e.pl && c !== base + 's' || (c === base + 's' && wrongs.size < 1)) wrongs.add(c); if (wrongs.size >= 3) break; }
  const wl = [...wrongs].filter(x => x !== e.pl).slice(0, 3);
  return { type: 'mc', itemId: e.id, tag: 'Choose the plural', center: true, prompt: html`<div class="big">${withArticle(e, false)}</div><div class="sub">${enOf(e)}</div>`, say: withArticle(e, true), choices: mcChoices(e.pl, wl), answer: e.pl };
}

// Find the inflected form of the word inside the example sentence
export function findInSentence(sentence, entry) {
  const words = sentence.split(/(\s+|[,.;:!?«»"()])/);
  const forms = new Set();
  if (entry.kind === 'verb') {
    const c = conjugate(entry.inf, { aux: entry.aux, isc: entry.isc });
    for (const t of Object.values(c.tenses)) if (t) for (const f of t) for (const a of accepted(f)) for (const w of a.split(' ')) forms.add(fold(w));
    forms.add(fold(entry.inf)); forms.add(fold(primary(c.nonFinite.participioPassato))); forms.add(fold(primary(c.nonFinite.gerundio)));
    for (const a of accepted(c.nonFinite.participioPassato)) { forms.add(fold(a)); forms.add(fold(a).replace(/o$/, 'a')); forms.add(fold(a).replace(/o$/, 'i')); forms.add(fold(a).replace(/o$/, 'e')); }
    // remove clitics/auxiliaries that are too generic
    for (const g of ['mi', 'ti', 'si', 'ci', 'vi', 'ne', 'la', 'lo', 'le', 'li', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'sono', 'sei', 'è', 'siamo', 'siete', 'me', 'te', 'se', 'ce', 've', 'ero', 'era', 'avevo', 'aveva']) forms.delete(g);
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
    const idx = fold(sentence).indexOf(lemma);
    if (idx >= 0) return { start: idx, end: idx + lemma.length, form: sentence.slice(idx, idx + lemma.length) };
    return null;
  }
  let pos = 0;
  for (const w of words) {
    const clean = fold(w).replace(/^l'|^un'|^d'|^all'|^dell'|^nell'|^sull'|^dall'|^quest'|^quell'/, '');
    const offset = w.length - clean.length;
    if (clean && forms.has(clean)) return { start: pos + offset, end: pos + w.length, form: w.slice(offset) };
    pos += w.length;
  }
  return null;
}

export function qCloze(e, { typed = false, pool = [] } = {}) {
  const sentences = e.kind === 'verb' ? (e.examples || []) : (e.ex ? [{ it: e.ex, en: e.exEn }] : []);
  for (const s of shuffle(sentences)) {
    const hit = findInSentence(s.it, e);
    if (!hit) continue;
    const before = s.it.slice(0, hit.start), after = s.it.slice(hit.end);
    const prompt = html`<div class="sentence">${before}<span class="blank">${typed ? '…' : '?'}</span>${after}</div><div class="sub"><span class="itx inline" role="button" tabindex="0"><span class="it">translation ▾</span><span class="tr">${s.en}</span></span></div>`;
    if (typed) return { type: 'type', itemId: e.id, tag: 'Fill in the blank', prompt: prompt + html`<div class="sub tiny">${e.kind === 'verb' ? 'verb: ' + e.inf : enOf(e)}</div>`, say: s.it, answer: [hit.form], placeholder: 'Missing word…' };
    let wrongs;
    if (e.kind === 'verb') {
      const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
      const own = [c.tenses.presente[1], c.tenses.presente[2], c.tenses.presente[5], c.tenses.imperfetto[0], c.tenses.futuro[2], c.tenses.passatoProssimo[2], c.tenses.condizionale[0], c.tenses.congiuntivoPresente[0], c.nonFinite.participioPassato, c.nonFinite.gerundio, e.inf].map(primary);
      const other = distractors(e, pool, 1)[0];
      const oc = other ? conjugate(other.inf, { aux: other.aux, isc: other.isc }) : null;
      const cands = shuffle([...new Set(own.filter(f => fold(f) !== fold(hit.form)))]).slice(0, 2);
      if (oc) { const f = primary(oc.tenses.presente[Math.floor(Math.random() * 6)]); if (fold(f) !== fold(hit.form)) cands.push(f); }
      while (cands.length < 3) { const f = own.find(x => !cands.includes(x) && fold(x) !== fold(hit.form)); if (!f) break; cands.push(f); }
      wrongs = cands;
    } else wrongs = distractors(e, pool, 3).map(d => d.it);
    return { type: 'mc', itemId: e.id, tag: 'Fill in the blank', center: true, prompt, say: s.it, choices: mcChoices(hit.form, wrongs), answer: hit.form, explain: s.en };
  }
  return null;
}

export function qScramble(e) {
  const w = it(e);
  if (w.length < 4 || w.includes(' ')) return null;
  let letters; let tries = 0;
  do { letters = shuffle(w.split('')).join(''); tries++; } while (letters === w && tries < 10);
  return { type: 'type', itemId: e.id, tag: 'Unscramble', prompt: html`<div class="big" style="letter-spacing:.12em">${letters}</div><div class="sub">${enOf(e)}</div>`, say: w, answer: [w], placeholder: 'Word…' };
}

export function qDictation(e) {
  const text = e.kind === 'verb' ? e.inf : (e.pos === 'noun' && !isPluralOnly(e) ? withArticle(e, false) : e.it);
  return { type: 'type', itemId: e.id, tag: 'Listen and type', prompt: html`<div class="big">🔊</div><div class="sub">Tap the speaker, then type what you hear</div>`, say: text, autoSay: true, answer: [text, it(e)], placeholder: 'What did you hear?', explain: `${enOf(e)}` };
}

// ---------- verbs ----------
export const DRILL_TENSES = ['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale', 'congiuntivoPresente', 'passatoRemoto', 'imperativo', 'congiuntivoImperfetto', 'trapassatoProssimo'];

export function verbForm(e, tense, person) {
  const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const t = c.tenses[tense];
  if (!t) return null;
  return { conj: c, form: t[person], persons: tense === 'imperativo' ? IMP_PERSONS : PERSONS };
}

export function qConjType(e, tense, person = null) {
  const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const t = c.tenses[tense]; if (!t) return null;
  const persons = tense === 'imperativo' ? IMP_PERSONS : PERSONS;
  const p = person == null ? Math.floor(Math.random() * persons.length) : person;
  const form = t[p];
  const T = TENSE_BY_KEY[tense];
  return { type: 'type', itemId: e.id, tag: T.name, prompt: html`<div class="big md">${e.inf}</div><div class="sub"><b>${persons[p]}</b> · ${T.en}${e.aux === 'both' && T.compound ? ' (use avere)' : ''}</div><div class="tiny muted mt"><span class="itx inline" role="button" tabindex="0"><span class="it">meaning ▾</span><span class="tr">${e.en}</span></span></div>`, say: primary(form), answer: accepted(form), accept: (v) => checkTyped(v, accepted(form)), placeholder: `${persons[p]} …`, explain: c.irregular ? 'Irregular verb.' : '' };
}

export function qConjMC(e, tense, pool = [], person = null) {
  const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const t = c.tenses[tense]; if (!t) return null;
  const persons = tense === 'imperativo' ? IMP_PERSONS : PERSONS;
  const p = person == null ? Math.floor(Math.random() * persons.length) : person;
  const correct = primary(t[p]);
  const wrong = new Set();
  // other persons of the same tense
  for (const i of shuffle([0, 1, 2, 3, 4, 5].filter(i => i !== p && i < t.length))) { const f = primary(t[i]); if (f !== correct) wrong.add(f); if (wrong.size >= 2) break; }
  // same person, other tense
  for (const tk of shuffle(DRILL_TENSES.filter(k => k !== tense && c.tenses[k] && k !== 'imperativo'))) { const f = primary(c.tenses[tk][Math.min(p, 5)]); if (f !== correct && !wrong.has(f)) { wrong.add(f); break; } }
  // a plausible wrong regularisation for irregular verbs
  if (wrong.size < 3) { const others = pool.filter(x => x.kind === 'verb' && x.id !== e.id); if (others.length) { const o = sample(others); const oc = conjugate(o.inf, { aux: o.aux, isc: o.isc }); const f = oc.tenses[tense] ? primary(oc.tenses[tense][p]) : null; if (f && f !== correct) wrong.add(f); } }
  const T = TENSE_BY_KEY[tense];
  return { type: 'mc', itemId: e.id, tag: T.name, center: true, prompt: html`<div class="big md">${e.inf}</div><div class="sub"><b>${persons[p]}</b> · ${T.en}</div><div class="tiny muted mt"><span class="itx inline" role="button" tabindex="0"><span class="it">meaning ▾</span><span class="tr">${e.en}</span></span></div>`, say: correct, choices: mcChoices(correct, [...wrong].slice(0, 3)), answer: correct };
}

export function qTenseDetective(e) {
  const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const tenses = DRILL_TENSES.filter(k => c.tenses[k] && k !== 'imperativo');
  const tense = sample(tenses);
  const p = Math.floor(Math.random() * 6);
  const form = primary(c.tenses[tense][p]);
  const T = TENSE_BY_KEY[tense];
  const wrongT = pickN(tenses.filter(k => k !== tense), 3).map(k => TENSE_BY_KEY[k].name);
  return { type: 'mc', itemId: e.id, tag: 'Which tense is this?', center: true, prompt: html`<div class="big md">${PERSONS[p]} ${form}</div><div class="sub">${e.inf} · <span class="itx inline" role="button" tabindex="0"><span class="it">meaning ▾</span><span class="tr">${e.en}</span></span></div>`, say: form, choices: mcChoices(T.name, wrongT), answer: T.name, explain: T.en };
}

export function qPersonDetective(e) {
  const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const tenses = ['presente', 'imperfetto', 'futuro', 'condizionale', 'passatoRemoto', 'congiuntivoPresente'].filter(k => c.tenses[k]);
  const tense = sample(tenses);
  const t = c.tenses[tense];
  const unique = PERSONS.map((_, i) => primary(t[i]));
  const p = Math.floor(Math.random() * 6);
  const form = unique[p];
  const validPersons = PERSONS.filter((_, i) => unique[i] === form);
  const wrongs = pickN(PERSONS.filter(x => !validPersons.includes(x)), 3);
  const T = TENSE_BY_KEY[tense];
  return { type: 'mc', itemId: e.id, tag: 'Who is the subject?', center: true, prompt: html`<div class="big md">${form}</div><div class="sub">${e.inf} · ${T.name}</div>`, say: form, choices: shuffle([{ label: validPersons.join(' / '), correct: true }, ...wrongs.map(l => ({ label: l }))]), answer: validPersons.join(' / ') };
}

export function qAux(e) {
  const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const pp = primary(c.nonFinite.participioPassato);
  const aux = e.aux === 'both' ? 'avere / essere' : e.aux;
  const choices = [{ label: 'avere', correct: e.aux === 'avere' }, { label: 'essere', correct: e.aux === 'essere' }, { label: 'both (depends on meaning)', correct: e.aux === 'both' }];
  return { type: 'mc', itemId: e.id, tag: 'Which auxiliary?', center: true, prompt: html`<div class="big md">${e.inf}</div><div class="sub">passato prossimo: ___ ${pp}</div>`, say: primary(c.tenses.passatoProssimo[2]), choices, answer: aux, explain: e.aux === 'essere' ? (e.trans === 'vr' ? 'Reflexive and pronominal verbs always take essere.' : 'Intransitive verbs of motion, change or state take essere; the participle agrees with the subject.') : e.aux === 'both' ? 'Essere when used intransitively, avere when there is a direct object.' : 'Transitive verbs (and many intransitive ones) take avere.' };
}

export function qParticiple(e, typed = true) {
  const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const pp = c.nonFinite.participioPassato;
  if (typed) return { type: 'type', itemId: e.id, tag: 'Past participle', prompt: html`<div class="big md">${e.inf}</div><div class="sub">participio passato · ${c.irregular ? 'irregular?' : 'regular'}</div>`, say: primary(pp), answer: accepted(pp), placeholder: 'participio…' };
  const stem = e.inf.replace(/(are|ere|ire|arsi|ersi|irsi|rre|rsi)$/, '');
  const wrong = new Set([stem + 'ato', stem + 'uto', stem + 'ito', stem + 'to', stem + 'so'].filter(x => !accepted(pp).includes(x)));
  return { type: 'mc', itemId: e.id, tag: 'Past participle', center: true, prompt: html`<div class="big md">${e.inf}</div><div class="sub">participio passato</div>`, say: primary(pp), choices: mcChoices(primary(pp), [...wrong].slice(0, 3)), answer: primary(pp) };
}

export function qGerund(e) {
  const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const g = c.nonFinite.gerundio;
  return { type: 'type', itemId: e.id, tag: 'Gerund', prompt: html`<div class="big md">${e.inf}</div><div class="sub">gerundio (sto …)</div>`, say: primary(g), answer: accepted(g), placeholder: '-ando / -endo' };
}

const PREPS = ['a', 'di', 'da', 'in', 'con', 'su', 'per', 'tra'];
export function qPattern(e) {
  const pats = (e.patterns || []).map(p => ({ p, m: p.match(/^(\S+)\s+(a|di|da|in|con|su|per|tra|fra)\s+(qualcuno|qualcosa|fare|un|una|il|la|lo|l'|le|i|gli|.+)$/i) })).filter(x => x.m);
  if (!pats.length) return null;
  const { p, m } = sample(pats);
  const prep = m[2].toLowerCase();
  const rest = p.slice(m[1].length + 1 + m[2].length + 1);
  const wrong = pickN(PREPS.filter(x => x !== prep && x !== (prep === 'tra' ? 'fra' : '')), 3);
  return { type: 'mc', itemId: e.id, tag: 'Which preposition?', center: true, prompt: html`<div class="big md">${m[1]} <span class="blank">?</span> ${rest}</div><div class="sub"><span class="itx inline" role="button" tabindex="0"><span class="it">meaning ▾</span><span class="tr">${e.en}</span></span></div>`, say: p, choices: mcChoices(prep, wrong), answer: prep, explain: (e.patterns || []).join(' · ') };
}

export function qVerbTranslateMC(e, pool) { return qTranslateMC(e, pool.filter(x => x.kind === 'verb'), 'it-en'); }

// Build a mixed question set for an entry list
export function mixedQuestions(entries, pool, { perItem = 1, verbTenses = ['presente', 'passatoProssimo'], typedRatio = 0.35 } = {}) {
  const qs = [];
  for (const e of entries) {
    for (let k = 0; k < perItem; k++) {
      let q = null;
      const r = Math.random();
      if (e.kind === 'verb') {
        if (r < 0.25) q = qTranslateMC(e, pool, Math.random() < 0.5 ? 'it-en' : 'en-it');
        else if (r < 0.5) q = qConjMC(e, sample(verbTenses), pool);
        else if (r < 0.7) q = qConjType(e, sample(verbTenses));
        else if (r < 0.8) q = qAux(e);
        else if (r < 0.9) q = qCloze(e, { pool });
        else q = qParticiple(e, Math.random() < typedRatio);
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
