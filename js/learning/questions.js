// Pure, serializable question generation. No UI, store, DOM or network dependency.
import { conjugate, regularParadigm, accepted, PERSONS, IMP_PERSONS, TENSE_BY_KEY, MISSING, splitClitic } from '../conjugator.js';
import { article, isPluralOnly, isUncountable } from '../data.js';
import { allowedTenses as curriculumTenses, entryKind, objectiveId } from './curriculum.js';
import { ANCHOR_CONTEXTS, TENSE_LESSONS, ERROR_TIPS, WEATHER_VERBS } from './content.js';

export const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ').replace(/\s*'\s*/g, "'");
const unique = a => [...new Set(a.filter(x => typeof x === 'string' && x && x !== MISSING))];
export function expandedForms(form) {
  return unique((Array.isArray(form) ? form : accepted(form)).flatMap(s => String(s).split('|')).flatMap(s => {
    if (/o\/a\b/.test(s)) return [s.replace(/o\/a\b/g, 'o'), s.replace(/o\/a\b/g, 'a')];
    if (/i\/e\b/.test(s)) return [s.replace(/i\/e\b/g, 'i'), s.replace(/i\/e\b/g, 'e')];
    const m = s.match(/^([^ /]+)\/([^ /]+) (.+)$/);
    return m ? [`${m[1]} ${m[3]}`, `${m[2]} ${m[3]}`] : [s];
  }));
}
const shuffle = (values, rng) => {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.max(0, Math.min(i, Math.floor(rng() * (i + 1)))); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
const usable = f => expandedForms(f).length > 0;
const textPrompt = (heading, sub = '') => `<div class="big md">${escapeHTML(heading)}</div>${sub ? `<div class="sub">${escapeHTML(sub)}</div>` : ''}`;
const gapPrompt = (before, after, sub) => `<div class="sentence">${escapeHTML(before)}<span class="blank">…</span>${escapeHTML(after)}</div><div class="sub">${escapeHTML(sub)}</div>`;
const shortEn = e => String(e.en || '').split(';')[0].trim();
const word = e => e.inf || e.it || '';
const eConj = e => conjugate(word(e), { aux: e.aux, isc: e.isc });
const safeVariant = v => Math.max(0, Math.floor(Number(v) || 0));

function makeQuestion(e, o, opts, spec) {
  const answers = expandedForms(spec.answer);
  if (!answers.length) return null;
  const keys = new Set(answers.map(norm));
  const seen = new Set(keys);
  const wrongs = unique(spec.wrongs || []).filter(a => { const key = norm(a); if (seen.has(key)) return false; seen.add(key); return true; });
  const type = opts.mode === 'recognition' && wrongs.length ? 'mc' : 'type';
  const mode = type === 'mc' ? 'recognition' : 'production';
  const choices = type === 'mc' ? shuffle([{ label: answers[0], correct: true }, ...shuffle(wrongs, opts.rng).slice(0, 3).map(label => ({ label, correct: false }))], opts.rng) : [];
  const meta = {
    objectiveId: o.id, entryId: e.id, kind: entryKind(e), skill: o.skill,
    tense: o.tense, person: null, mode, evidenceMode: mode,
    variantId: `${o.id}:${spec.variantKey || 'base'}`, contextId: spec.contextId || `${o.id}:${spec.variantKey || 'base'}`,
    answerLanguage: 'it', ...spec.meta,
  };
  return {
    type, itemId: e.id, prompt: spec.prompt, tag: spec.tag || o.label, answer: answers, choices,
    say: spec.say || answers[0], tip: opts.repairTag && ERROR_TIPS[opts.repairTag] ? ERROR_TIPS[opts.repairTag] : spec.tip || o.explanation,
    lesson: spec.lesson || o.explanation, example: spec.example || '', meta,
  };
}

function articleAnswers(e, plural) { return unique(String(article(e, plural) || '').split('/')); }
function nounForms(e, plural) {
  const w = plural ? e.pl : e.it;
  return unique([w, ...articleAnswers(e, plural).map(a => a.endsWith("'") ? a + w : `${a} ${w}`)]);
}
function englishAnswers(e) {
  return unique(String(e.en || '').split(';').flatMap(s => {
    const full = s.trim();
    const noTo = full.replace(/^to\s+/i, '');
    return [full, noTo, noTo.replace(/\s*\([^)]*\)/g, '').trim()];
  }));
}
const lexKey = e => norm(shortEn(e)).replace(/^to /, '');
function safeSynonyms(e, pool) {
  return pool.filter(x => x.id !== e.id && entryKind(x) === entryKind(e) && x.pos === e.pos && lexKey(x) === lexKey(e)).map(word);
}

// Exact authored word match, with Unicode letter boundaries. Never guess by longest
// conjugation token or rewrite sentence grammar to invent a second context.
export function wordContext(e) {
  if (!e.ex || !e.it) return null;
  const lemma = e.it.replace(/[.!?]+$/, '');
  const alternatives = [];
  const possessives = { mio: ['mia', 'miei', 'mie'], tuo: ['tua', 'tuoi', 'tue'], suo: ['sua', 'suoi', 'sue'], nostro: ['nostra', 'nostri', 'nostre'], vostro: ['vostra', 'vostri', 'vostre'], questo: ['questa', 'questi', 'queste'], quello: ['quella', 'quelli', 'quelle', 'quel', "quell'", 'quei', 'quegli'], quale: ['qual', 'quali'] };
  if (['det', 'pron'].includes(e.pos)) alternatives.push(...(possessives[lemma] || []));
  const preps = { a: ['al', 'allo', 'alla', 'ai', 'agli', 'alle', "all'"], di: ['del', 'dello', 'della', 'dei', 'degli', 'delle', "dell'"], da: ['dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', "dall'"], in: ['nel', 'nello', 'nella', 'nei', 'negli', 'nelle', "nell'"], su: ['sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', "sull'"] };
  const tail = lemma.match(/^(.*\s)?(a|di|da|in|su)$/);
  if (tail && ['prep', 'expr', 'adv'].includes(e.pos)) alternatives.push(...preps[tail[2]].map(a => (tail[1] || '') + a));
  const candidates = unique([e.it, lemma, ...alternatives, ...(e.forms || []), ...(e.pl && e.pl !== '-' ? [e.pl] : []), ...(e.fem ? [e.fem] : [])]).sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    const hay = e.ex.toLocaleLowerCase('it'), needle = candidate.toLocaleLowerCase('it');
    let at = hay.indexOf(needle);
    while (at >= 0) {
      const end = at + needle.length;
      const endsElided = candidate.endsWith("'") || candidate.endsWith('’');
      if (!/\p{L}/u.test(hay[at - 1] || '') && (endsElided || !/\p{L}/u.test(hay[end] || ''))) return { before: e.ex.slice(0, at), after: e.ex.slice(end), form: e.ex.slice(at, end), sentence: e.ex, en: e.exEn || '', id: `${e.id}:dictionary-example` };
      at = hay.indexOf(needle, at + 1);
    }
  }
  return null;
}

function wordQuestion(e, o, opts) {
  const v = safeVariant(opts.variant), ctx = wordContext(e);
  const samePool = opts.pool.filter(x => entryKind(x) === entryKind(e) && x.id !== e.id && lexKey(x) !== lexKey(e));
  const useContext = !!ctx && v % 2 === 1;
  const baseAnswers = e.pos === 'noun' ? nounForms(e, isPluralOnly(e)) : [word(e)];
  const defaults = { lesson: e.note || o.explanation, example: e.ex ? `${e.ex}${e.exEn ? ` — ${e.exEn}` : ''}` : `${word(e)} — ${e.en || ''}` };
  if (o.skill === 'meaning') {
    const inSentence = !!e.ex && v % 2 === 1;
    return makeQuestion(e, o, opts, { ...defaults,
      prompt: inSentence ? textPrompt(e.ex, `What does the learned word or expression “${word(e)}” mean in this situation? Answer in English.`) : textPrompt(word(e), 'What does it mean? Answer in English.'),
      answer: englishAnswers(e), wrongs: samePool.map(shortEn), say: word(e),
      variantKey: inSentence ? 'meaning-in-sentence' : 'meaning-alone', contextId: inSentence ? `${e.id}:dictionary-example` : `${e.id}:meaning`,
      meta: { variantCount: e.ex ? 2 : 1, answerLanguage: 'en', diagnostic: { kind: 'meaning' } },
    });
  }
  if (o.skill === 'recall') {
    const fromSituation = !ctx && !!e.exEn && v % 2 === 1;
    const answer = useContext ? [ctx.form] : [...baseAnswers, ...safeSynonyms(e, opts.pool)];
    return makeQuestion(e, o, opts, { ...defaults,
      prompt: useContext ? gapPrompt(ctx.before, ctx.after, `Complete the sentence with the learned word meaning “${shortEn(e)}”.`) : fromSituation ? textPrompt(e.exEn, `Recall the Italian dictionary form of the expression for “${shortEn(e)}” used in this situation.`) : textPrompt(shortEn(e), `Write the Italian ${entryKind(e) === 'verb' ? 'infinitive' : e.pos === 'noun' ? 'noun; its article is optional' : 'word or expression'}.`),
      answer, wrongs: samePool.map(word), variantKey: useContext ? 'recall-in-sentence' : fromSituation ? 'recall-from-situation' : 'recall-from-meaning', contextId: useContext ? ctx.id : fromSituation ? `${e.id}:dictionary-example` : `${e.id}:translation`,
      meta: { variantCount: ctx || e.exEn ? 2 : 1, diagnostic: { kind: 'recall', noun: e.pos === 'noun', bareAnswers: [useContext ? ctx.form : word(e)], articles: articleAnswers(e, isPluralOnly(e)) } },
    });
  }
  if (o.skill === 'article') {
    if (e.pos !== 'noun') return null;
    const plural = isPluralOnly(e) || (v % 2 === 1 && usable(e.pl) && !isUncountable(e));
    const target = plural ? e.pl : e.it;
    const wholePhrase = v % 2 === 1 && (isPluralOnly(e) || !usable(e.pl) || isUncountable(e));
    const answers = wholePhrase ? nounForms(e, plural).slice(1) : articleAnswers(e, plural);
    return makeQuestion(e, o, opts, { ...defaults,
      prompt: wholePhrase ? textPrompt(target, `Write this ${plural ? 'plural' : 'singular'} noun with its definite article.`) : gapPrompt('', ` ${target}`, `Supply only the definite article. ${plural ? 'Plural' : 'Singular'}${e.g === 'mf' ? '; either applicable gender is accepted' : `; ${e.g === 'f' ? 'feminine' : 'masculine'}`}.`),
      answer: answers, wrongs: ['il', 'lo', 'la', "l'", 'i', 'gli', 'le'].map(a => wholePhrase ? a.endsWith("'") ? a + target : `${a} ${target}` : a),
      say: nounForms(e, plural)[1] || target, example: nounForms(e, plural).slice(1).join(' / '),
      variantKey: wholePhrase ? 'article-whole-phrase' : plural ? 'article-plural' : 'article-singular',
      meta: { diagnostic: { kind: 'article' }, number: plural ? 'plural' : 'singular' },
    });
  }
  if (o.skill === 'plural') {
    if (e.pos !== 'noun' || !usable(e.pl) || isUncountable(e) || isPluralOnly(e)) return null;
    const withArt = v % 2 === 1;
    const full = nounForms(e, true);
    const answer = withArt ? full.slice(1) : [e.pl];
    const stems = unique([e.it, e.it.replace(/o$/, 'i'), e.it.replace(/a$/, 'e'), e.it.replace(/e$/, 'i'), e.it + 's', ...samePool.filter(x => x.pl).map(x => x.pl)]);
    return makeQuestion(e, o, opts, { ...defaults,
      prompt: textPrompt(withArt ? nounForms(e, false)[1] || e.it : e.it, withArt ? 'Write the plural with its definite article.' : 'Write only the plural noun, without its article.'),
      answer, wrongs: withArt ? stems.map(s => `i ${s}`) : stems,
      variantKey: withArt ? 'plural-with-article' : 'plural-bare',
      meta: { diagnostic: { kind: 'plural', plural: e.pl, requiresArticle: withArt, articles: articleAnswers(e, true) } },
    });
  }
  if (o.skill === 'context') {
    if (!ctx) return null;
    // Two genuinely different retrieval cues: Italian sentence completion and
    // retrieval from the authored English situation. The underlying context ID
    // remains the same; changing the counter never invents another source text.
    const fromSituation = v % 2 === 1 && !!ctx.en;
    return makeQuestion(e, o, opts, { ...defaults,
      prompt: fromSituation ? textPrompt(ctx.en, `Recall the Italian dictionary form of the learned word for “${shortEn(e)}” in this situation.`) : gapPrompt(ctx.before, ctx.after, `Use the learned word for “${shortEn(e)}”.`),
      answer: fromSituation ? baseAnswers : [ctx.form], wrongs: samePool.filter(x => x.pos === e.pos).map(word),
      variantKey: fromSituation ? 'context-from-english-situation' : 'context-italian-gap', contextId: ctx.id,
      meta: { variantCount: ctx.en ? 2 : 1, diagnostic: { kind: 'recall' } },
    });
  }
  if (o.skill === 'listening') {
    const sentenceAudio = !!e.ex && v % 2 === 1;
    const wholeSentence = sentenceAudio && !ctx;
    const say = sentenceAudio ? e.ex : (e.pos === 'noun' ? nounForms(e, isPluralOnly(e))[1] || e.it : e.it);
    return makeQuestion(e, o, opts, { ...defaults,
      prompt: textPrompt('Listen in Italian', wholeSentence ? 'Optional sentence dictation: listen and write the whole example sentence.' : sentenceAudio ? `Listen to the sentence. Write the word meaning “${shortEn(e)}” as you hear it.` : 'Listen, then write the word. A noun’s article is optional.'),
      answer: wholeSentence ? [e.ex] : sentenceAudio ? [ctx.form] : baseAnswers, wrongs: wholeSentence ? [] : samePool.map(word), say,
      variantKey: wholeSentence ? 'listen-whole-example' : sentenceAudio ? 'listen-in-sentence' : 'listen-alone', contextId: sentenceAudio ? `${e.id}:dictionary-example` : `${e.id}:audio`,
      meta: { variantCount: e.ex ? 2 : 1, audioIsPrompt: true, diagnostic: { kind: 'listening' } },
    });
  }
  return null;
}

const AUX_TENSE = { passatoProssimo: 'presente', trapassatoProssimo: 'imperfetto', trapassatoRemoto: 'passatoRemoto', futuroAnteriore: 'futuro', condizionalePassato: 'condizionale', congiuntivoPassato: 'congiuntivoPresente', congiuntivoTrapassato: 'congiuntivoImperfetto' };
const AUXILIARIES = { avere: conjugate('avere', { aux: 'avere' }), essere: conjugate('essere', { aux: 'essere' }) };
export const AUXILIARY_WORDS = unique(Object.values(AUXILIARIES).flatMap(c => Object.values(c.tenses).flatMap(f => (f || []).flatMap(expandedForms)))).filter(f => !f.includes(' '));

function finiteDiagnostic(e, c, tense, person, answer, permitted, extra = {}) {
  const personForms = (c.tenses[tense] || []).flatMap((f, p) => p === person ? [] : expandedForms(f).map(answer => ({ answer, person: p })));
  const semanticPerson = tense === 'imperativo' ? [1, 2, 3, 4, 5][person] : person;
  const tenseForms = permitted.filter(k => k !== tense && c.tenses[k]).flatMap(k => {
    const index = k === 'imperativo' ? [1, 2, 3, 4, 5].indexOf(semanticPerson) : semanticPerson;
    return index < 0 ? [] : expandedForms(c.tenses[k][index]).map(answer => ({ answer, tense: k }));
  });
  const diagnostic = { kind: 'verb', expected: answer, personForms, tenseForms, ...extra };
  const reg = regularParadigm(word(e), { aux: e.aux, isc: e.isc });
  diagnostic.regularized = expandedForms(reg.tenses[tense]?.[person]);
  if (AUX_TENSE[tense]) {
    const auxKeys = c.auxBoth ? ['avere', 'essere'] : [c.aux];
    diagnostic.compound = {
      auxKeys,
      auxForms: auxKeys.flatMap(k => expandedForms(AUXILIARIES[k].tenses[AUX_TENSE[tense]][person])),
      allAuxForms: Object.fromEntries(Object.entries(AUXILIARIES).map(([k, ac]) => [k, ac.tenses[AUX_TENSE[tense]].flatMap(expandedForms)])),
      participles: unique(answer.map(a => a.split(' ').at(-1))),
      citationParticiples: expandedForms(c.nonFinite.participioPassato),
      clitic: !!c.clitic,
      checkAgreement: c.aux === 'essere' && !c.auxBoth,
    };
  } else if (c.clitic) diagnostic.clitic = true;
  return diagnostic;
}

function personsFor(e, c, tense) {
  if (WEATHER_VERBS.has(word(e))) return usable(c.tenses[tense]?.[2]) ? [2] : [];
  return (c.tenses[tense] || []).map((f, i) => usable(f) ? i : -1).filter(i => i >= 0);
}
const frameFor = tense => ({ presente: ['Di solito, ', 'Ogni settimana, '], passatoProssimo: ['Ieri, ', 'La settimana scorsa, '], imperfetto: ['In quel periodo, ', 'Ogni giorno, a quei tempi, '], futuro: ['Domani, ', 'La settimana prossima, '] }[tense]);

function contextualSpec(e, c, tense, person, variant) {
  const predicates = ANCHOR_CONTEXTS[word(e)], frame = frameFor(tense);
  if (!predicates || !frame) return null;
  const n = Math.floor(variant / 6) % predicates.length;
  const p = PERSONS[person];
  return { before: `${frame[n % frame.length]}${p} `, after: ` ${predicates[n]}.`, id: `${e.id}:${tense}:p${person}:predicate${n}`, predicate: predicates[n] };
}

// A repair isolates the part that actually failed. Its parent objective remains
// the whole construction, but even a typed gap is recognition evidence: the
// supplied surrounding form must never count as independently produced grammar.
function componentScaffold(e, o, opts, c, tense, person) {
  const tag = opts.repairTag, v = safeVariant(opts.variant);
  if (opts.mode !== 'recognition' || o.skill !== 'conjugation') return null;
  if (!['auxiliary', 'auxiliaryPerson', 'participle', 'agreement', 'clitic'].includes(tag)) return null;
  const forms = expandedForms(c.tenses[tense]?.[person]);
  if (!forms.length) return null;
  const skill = tag === 'auxiliaryPerson' ? 'auxiliary' : tag;
  const target = { ...o, skill };
  let spec;
  if (['auxiliary', 'auxiliaryPerson'].includes(tag) && AUX_TENSE[tense]) {
    const keys = c.auxBoth ? ['avere', 'essere'] : [c.aux];
    const auxForms = keys.flatMap(k => expandedForms(AUXILIARIES[k].tenses[AUX_TENSE[tense]][person]));
    const full = forms[0], aux = auxForms.find(a => full.includes(a));
    if (!aux) return null;
    const at = full.indexOf(aux);
    spec = {
      prompt: gapPrompt(`${PERSONS[person]} ${full.slice(0, at)}`, full.slice(at + aux.length), `One part at a time: supply only the auxiliary for ${word(e)} in ${TENSE_BY_KEY[tense]?.name || tense}.${c.auxBoth ? ' Either auxiliary is accepted in this form exercise without a meaning context.' : ''}`),
      answer: auxForms, wrongs: Object.values(AUXILIARIES).flatMap(ac => ac.tenses[AUX_TENSE[tense]].flatMap(expandedForms)),
      meta: { diagnostic: { kind: 'auxiliary', auxKeys: keys, inflected: true, auxForms, allAuxForms: Object.fromEntries(Object.entries(AUXILIARIES).map(([k, ac]) => [k, ac.tenses[AUX_TENSE[tense]].flatMap(expandedForms)])) } },
    };
  } else if (tag === 'participle' && AUX_TENSE[tense]) {
    const answer = unique(forms.map(f => f.split(' ').at(-1)));
    const full = forms[0], pp = full.split(' ').at(-1), stem = splitClitic(word(e)).base.replace(/(are|ere|ire|rre)$/, '');
    spec = {
      prompt: gapPrompt(`${PERSONS[person]} ${full.slice(0, -pp.length)}`, '', `The auxiliary is supplied. Complete only the past participle for ${word(e)}.${c.aux === 'essere' ? ' Either applicable gender is accepted.' : ''}`),
      answer, wrongs: [stem + 'ato', stem + 'uto', stem + 'ito', word(e)],
      meta: { diagnostic: { kind: 'participle', expected: answer } },
    };
  } else if (tag === 'agreement' && AUX_TENSE[tense] && c.aux === 'essere' && !c.auxBoth) {
    const plural = person >= 3, feminine = v % 2 === 0;
    const ending = plural ? feminine ? 'e' : 'i' : feminine ? 'a' : 'o';
    const full = forms.find(f => f.endsWith(ending));
    if (!full) return null;
    const group = plural ? feminine ? 'an all-female group' : 'a male or mixed group' : feminine ? 'a female subject' : 'a male subject';
    spec = {
      prompt: gapPrompt(`${PERSONS[person]} ${full.slice(0, -1)}`, '', `Complete only the last letter of the participle. This example refers to ${group}; the auxiliary and participle stem are supplied.`),
      answer: [ending], wrongs: ['o', 'a', 'i', 'e'],
      meta: { diagnostic: { kind: 'component', component: 'agreement' } },
    };
  } else if (tag === 'clitic' && c.clitic) {
    const full = forms[0];
    const prefix = full.match(/^(?:(?:mi|ti|si|ci|vi|me|te|se|ce|ve|ne|la|lo)\s+)+(?:l['’])?/u)?.[0];
    if (!prefix) return null;
    const answer = prefix.trim();
    spec = {
      prompt: gapPrompt(`${PERSONS[person]} `, ` ${full.slice(prefix.length)}`, `Restore only the pronoun${answer.includes(' ') ? 's' : ''} for ${word(e)}. The verb form is supplied.${answer.endsWith("'") ? ' Include the apostrophe.' : ''}`),
      answer: [answer], wrongs: ['mi', 'ti', 'si', 'ci', 'vi', 'me ne', 'te ne', 'se ne', 'ce ne', 've ne', 'ce la', "ce l'"],
      meta: { diagnostic: { kind: 'component', component: 'clitic' } },
    };
  }
  if (!spec) return null;
  const q = makeQuestion(e, target, opts, { ...spec, lesson: TENSE_LESSONS[tense] || o.explanation, example: `${PERSONS[person]} ${forms.join(' / ')}`, variantKey: `repair-${tag}:${tense}:p${person}:${spec.answer.join('|')}`,
    meta: { ...spec.meta, person, scaffold: true, scaffoldSkill: skill, mode: 'recognition', evidenceMode: 'recognition' } });
  return q;
}

function verbQuestion(e, o, opts) {
  const v = safeVariant(opts.variant);
  if (o.skill === 'recall') {
    // An infinitive recall is independent from every finite-tense objective.
    const contexts = ANCHOR_CONTEXTS[word(e)];
    const phrase = contexts && v % 2 ? `___ ${contexts[0]}` : '';
    let formCue = '';
    if (!contexts && v % 2) {
      try { const c = eConj(e); const p = personsFor(e, c, 'presente')[0]; formCue = expandedForms(c.tenses.presente?.[p])[0] || ''; } catch { /* no fabricated example */ }
    }
    return makeQuestion(e, o, opts, {
      prompt: phrase ? textPrompt(phrase, `Supply the infinitive meaning “${shortEn(e)}”.`) : formCue ? textPrompt(formCue, 'Give the infinitive of this present-tense verb form.') : textPrompt(shortEn(e), 'Write the Italian infinitive.'),
      answer: [word(e), ...safeSynonyms(e, opts.pool)], wrongs: opts.pool.filter(x => entryKind(x) === 'verb' && lexKey(x) !== lexKey(e)).map(word),
      example: `${word(e)} — ${e.en || ''}`, variantKey: phrase ? 'infinitive-phrase' : formCue ? 'infinitive-from-present' : 'infinitive-meaning',
      meta: { tense: null, diagnostic: { kind: 'recall' } },
    });
  }
  const permitted = opts.allowedTenses.length ? opts.allowedTenses : curriculumTenses({ stage: o.stage || 'present' });
  if (!permitted.includes(o.tense)) return null;
  let c;
  try { c = eConj(e); } catch { return null; }
  const available = personsFor(e, c, o.tense);
  if (!available.length) return null;
  const requestedPerson = o.tense === 'imperativo' ? [1, 2, 3, 4, 5].indexOf(opts.repairPerson) : opts.repairPerson;
  const pinned = Number.isInteger(opts.repairPerson) && available.includes(requestedPerson);
  let person = pinned ? requestedPerson : available[v % available.length], tense = o.tense;
  const persons = tense === 'imperativo' ? IMP_PERSONS : PERSONS;
  const lesson = TENSE_LESSONS[tense] || o.explanation;
  const scaffold = componentScaffold(e, o, opts, c, tense, person);
  if (scaffold) return scaffold;
  if (o.skill === 'participle') {
    let answer = expandedForms(c.nonFinite.participioPassato);
    if (!answer.length) return null;
    const reg = regularParadigm(word(e), { aux: e.aux, isc: e.isc });
    const base = splitClitic(word(e)).base.replace(/(are|ere|ire|rre)$/, '');
    const contextual = v % 2 === 1 && ANCHOR_CONTEXTS[word(e)];
    const pastForms = expandedForms(c.tenses.passatoProssimo[2]);
    const past = pastForms.find(f => /o$/.test(f)) || pastForms[0] || '';
    const aux = past.split(' ').slice(0, -1).join(' ');
    // A masculine named subject pins down the citation -o form without claiming
    // that every use of a both-auxiliary verb permits the same auxiliary.
    const context = contextual && !c.auxBoth && !!aux;
    const schematic = v % 2 === 1 && !context && !!aux;
    const fixedParticiple = schematic && !!c.clitic && !answer.includes(past.split(' ').at(-1));
    if (fixedParticiple) answer = [past.split(' ').at(-1)];
    return makeQuestion(e, o, opts, {
      prompt: context ? gapPrompt(`Ieri Marco ${aux} `, ` ${ANCHOR_CONTEXTS[word(e)][0]}.`, `Supply the past participle of ${word(e)}.`) : schematic ? gapPrompt(`${aux} `, '', fixedParticiple ? `Complete the participle as used in ${word(e)}. Its pronoun fixes the participle ending in this construction.` : `Form practice: complete the masculine-singular participle for ${word(e)}. This is a form pattern, not a sentence about a particular meaning.`) : textPrompt(word(e), 'Write the past participle in its dictionary form (masculine singular).'),
      answer, wrongs: [base + 'ato', base + 'uto', base + 'ito', ...expandedForms(reg.nonFinite.participioPassato), word(e)],
      example: `${word(e)} → ${answer.join(' / ')}`, lesson, tip: 'Recall the past participle. For an irregular form, learn a short example as well as the infinitive.',
      variantKey: context ? 'participle-in-sentence' : schematic ? 'participle-in-form' : 'participle-citation',
      meta: { person: context ? 2 : null, diagnostic: { kind: 'participle', expected: answer } },
    });
  }
  if (o.skill === 'auxiliary') {
    if (!usable(c.nonFinite.participioPassato)) return null;
    const answers = c.auxBoth ? ['avere', 'essere'] : [c.aux];
    const inflected = pinned || v % 2 === 1;
    if (inflected) {
      const aux = answers.flatMap(k => expandedForms(AUXILIARIES[k].tenses.presente[person]));
      const showPattern = pinned && v % 2 === 1;
      const whole = expandedForms(c.tenses.passatoProssimo[person])[0] || '';
      const pp = whole.split(' ').at(-1) || expandedForms(c.nonFinite.participioPassato)[0];
      const prefix = whole.includes(aux[0]) ? whole.slice(0, whole.indexOf(aux[0])) : '';
      return makeQuestion(e, o, opts, {
        prompt: showPattern ? gapPrompt(`${persons[person]} ${prefix}`, ` ${pp}`, `Write only the auxiliary for ${word(e)}; ${persons[person]} is the subject. This is auxiliary-form practice.${c.auxBoth ? ' Either auxiliary is accepted without a meaning context.' : ''}`) : textPrompt(`${persons[person]} …`, `Write only the present-tense auxiliary for ${word(e)} in the passato prossimo.${c.auxBoth ? ' With no sentence context, either auxiliary is accepted; its meaning can change with context.' : ''}`),
        answer: aux, wrongs: Object.values(AUXILIARIES).flatMap(ac => ac.tenses.presente.flatMap(expandedForms)),
        lesson, example: expandedForms(c.tenses.passatoProssimo[person]).join(' / '),
        variantKey: `auxiliary-${showPattern ? 'pattern' : 'form'}-p${person}`, meta: { person, diagnostic: { kind: 'auxiliary', auxKeys: answers, inflected: true, auxForms: aux, allAuxForms: Object.fromEntries(Object.entries(AUXILIARIES).map(([k, ac]) => [k, ac.tenses.presente.flatMap(expandedForms)])) } },
      });
    }
    // Both genuinely permitted answers are accepted. We never mark one wrong
    // merely because the dictionary's primary display form uses the other.
    return makeQuestion(e, o, opts, {
      prompt: textPrompt(word(e), `Which auxiliary can form its passato prossimo? Write avere or essere.${c.auxBoth ? ' Either is possible; the choice can depend on meaning.' : ''}`),
      answer: answers, wrongs: ['avere', 'essere'], lesson,
      example: expandedForms(c.tenses.passatoProssimo[person]).join(' / '), variantKey: 'auxiliary-choice',
      meta: { diagnostic: { kind: 'auxiliary', auxKeys: answers, inflected: false } },
    });
  }
  if (o.skill === 'agreement') {
    if (c.aux !== 'essere' || c.auxBoth || !ANCHOR_CONTEXTS[word(e)]) return null;
    const subjects = [{ label: 'Maria', person: 2, gender: 'f' }, { label: 'Marco', person: 2, gender: 'm' }, { label: 'Maria e Anna', person: 5, gender: 'f' }, { label: 'Marco e Luca', person: 5, gender: 'm' }];
    const subject = subjects[v % subjects.length]; person = subject.person;
    const ending = person === 5 ? (subject.gender === 'f' ? 'e' : 'i') : (subject.gender === 'f' ? 'a' : 'o');
    const answer = expandedForms(c.tenses[tense][person]).filter(f => f.endsWith(ending));
    if (!answer.length) return null;
    const wrongs = expandedForms(c.tenses[tense][person]).filter(f => !answer.includes(f));
    for (const a of answer) for (const last of ['o', 'a', 'i', 'e']) wrongs.push(a.slice(0, -1) + last);
    return makeQuestion(e, o, opts, {
      prompt: gapPrompt(`Ieri ${subject.label} `, ` ${ANCHOR_CONTEXTS[word(e)][Math.floor(v / 4) % 2]}.`, `Use ${word(e)} in the passato prossimo. Write the whole verb form.`),
      answer, wrongs, lesson, example: `${subject.label} ${answer[0]} ${ANCHOR_CONTEXTS[word(e)][0]}.`,
      variantKey: `agreement-${subject.gender}-p${person}-predicate${Math.floor(v / 4) % 2}`,
      meta: { person, subjectGender: subject.gender, subjectNumber: person === 5 ? 'plural' : 'singular', diagnostic: finiteDiagnostic(e, c, tense, person, answer, permitted, { subjectGender: subject.gender }) },
    });
  }
  if (o.skill === 'context') {
    if (tense !== 'imperfetto' || !ANCHOR_CONTEXTS[word(e)] || !permitted.includes('passatoProssimo')) return null;
    const background = v % 2 === 0;
    tense = background ? 'imperfetto' : 'passatoProssimo';
    person = pinned ? requestedPerson : Math.floor(v / 2) % 2 ? 3 : 0;
    const n = Math.floor(v / 4) % 2;
    const predicate = ANCHOR_CONTEXTS[word(e)][n];
    const before = background ? `In quel periodo, ${PERSONS[person]} ` : `Ieri, ${PERSONS[person]} `;
    const intent = background ? 'Describe a past habit or ongoing background, without presenting one completed episode.' : 'Present one completed past episode, rather than its background.';
    const answer = expandedForms(c.tenses[tense][person]);
    return makeQuestion(e, o, opts, {
      prompt: gapPrompt(before, ` ${predicate}.`, `${intent} Choose between our everyday past forms (passato prossimo and imperfetto), using ${word(e)}.`),
      answer, wrongs: expandedForms(c.tenses[background ? 'passatoProssimo' : 'imperfetto'][person]),
      lesson: TENSE_LESSONS.imperfetto,
      example: `${before}${answer[0]} ${predicate}. ${background ? 'The speaker describes how things were.' : 'The speaker presents a completed episode.'}`,
      tip: 'Use the meaning requested by the speaker: completed episode or habit/background. A time expression alone does not determine the answer.',
      variantKey: `past-meaning-${background ? 'background' : 'completed'}-p${person}-predicate${n}`,
      meta: { tense, person, contextualMeaning: background ? 'background' : 'completed', diagnostic: finiteDiagnostic(e, c, tense, person, answer, permitted) },
    });
  }
  if (o.skill !== 'conjugation') return null;
  const answer = expandedForms(c.tenses[tense][person]);
  const contextVariant = pinned ? (v % 2) * 6 + person : v;
  const context = contextualSpec(e, c, tense, person, contextVariant);
  const diagnostic = finiteDiagnostic(e, c, tense, person, answer, permitted);
  const title = TENSE_BY_KEY[tense]?.name || tense;
  const wrongs = [...diagnostic.personForms.map(f => f.answer), ...diagnostic.tenseForms.map(f => f.answer), ...diagnostic.regularized];
  return makeQuestion(e, o, opts, {
    prompt: context ? gapPrompt(context.before, context.after, `${word(e)} · ${title}. Write the whole verb form.`) : pinned && v % 2 ? textPrompt(`${persons[person]} …`, `Use ${word(e)} in ${title}. ${['First-person singular', 'Second-person singular', 'Third-person singular', 'First-person plural', 'Second-person plural', 'Third-person plural'][tense === 'imperativo' ? [1, 2, 3, 4, 5][person] : person]}; supply the complete verb form.`) : textPrompt(word(e), `${persons[person]} · ${title}. Write the whole verb form.${c.auxBoth && AUX_TENSE[tense] ? ' With no meaning context, either auxiliary is accepted.' : ''}${WEATHER_VERBS.has(word(e)) ? ' Everyday weather use: impersonal third-person singular.' : ''}`),
    answer, wrongs, lesson,
    example: context ? `${context.before}${answer[0]}${context.after}` : `${persons[person]} ${answer.join(' / ')}`,
    tip: `Start with ${persons[person]}, then build the ${title} form.${c.clitic ? ' Include the pronoun.' : ''}`,
    variantKey: context ? `${tense}:p${person}:predicate${Math.floor(contextVariant / 6) % 2}` : `${tense}:p${person}${pinned && v % 2 ? ':person-definition' : ''}`,
    contextId: context?.id,
    meta: { person: tense === 'imperativo' ? [1, 2, 3, 4, 5][person] : person, diagnostic },
  });
}

export function buildQuestion(entry, objective, { mode = 'recognition', variant = 0, repairTag = null, repairPerson = null, pool = [], allowedTenses = [], rng = Math.random } = {}) {
  if (!entry?.id || !objective || objective.entryId !== entry.id) return null;
  const opts = { mode, variant, repairTag, repairPerson, pool: Array.isArray(pool) ? pool : [], allowedTenses: Array.isArray(allowedTenses) ? allowedTenses : [], rng };
  return entryKind(entry) === 'verb' ? verbQuestion(entry, objective, opts) : wordQuestion(entry, objective, opts);
}

// Attach structured evidence to supported legacy game questions without changing
// their prompts, callbacks, accepted variants or rewards. Unknown game types do
// not enter mastery tracking. The actual game prompt has one stable variant ID;
// regenerating/shuffling choices never creates fictitious independent contexts.
export function annotateGameQuestion(q, entry, { skill, tense = null, person = null, allowedTenses = [] } = {}) {
  if (!q || !entry?.id || !['meaning', 'recall', 'article', 'plural', 'conjugation', 'auxiliary', 'participle'].includes(skill)) return q;
  const kind = entryKind(entry);
  if (kind === 'verb' && skill === 'meaning') return q; // English production is not Italian infinitive retrieval.
  const objectiveTense = kind === 'verb' ? tense || 'meaning' : null;
  const o = { id: objectiveId(entry.id, objectiveTense, skill), entryId: entry.id, kind, stage: 'future', tense: objectiveTense, skill, label: q.tag || skill, explanation: '' };
  const standardPerson = tense === 'imperativo' && Number.isInteger(person) ? [1, 2, 3, 4, 5][person] : person;
  const model = buildQuestion(entry, o, { mode: q.type === 'type' ? 'production' : 'recognition', repairPerson: standardPerson, allowedTenses: [...new Set([...allowedTenses, ...(tense ? [tense] : [])])], rng: () => .5 });
  if (!model) return q;
  if (Number.isInteger(standardPerson) && model.meta.person !== standardPerson) return q;
  const diagnostic = { ...model.meta.diagnostic };
  if (skill === 'plural') diagnostic.requiresArticle = false; // legacy plural questions accept the bare noun or its article
  q.meta = {
    ...model.meta, person: Number.isInteger(standardPerson) ? standardPerson : null,
    mode: q.type === 'type' ? 'production' : 'recognition', evidenceMode: q.type === 'type' ? 'production' : 'recognition',
    variantId: `game:${o.id}:${tense || 'lexical'}:${person ?? 'none'}:v1`, contextId: `game:${entry.id}:${skill}:${tense || 'lexical'}:${person ?? 'none'}`,
    diagnostic, source: 'game',
  };
  return q;
}
