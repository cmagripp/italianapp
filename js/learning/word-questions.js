// Short, supported word checks. Distractors use dictionary meanings and recorded
// forms; no sentence is rewritten and no recognition answer certifies recall.
import { article, hasPluralForm, isPluralOnly, isUncountable, nounNumberNote } from '../data.js';
import { escapeHTML } from './questions.js';
import { createPairActivity } from './lesson-activities.js';
import { nounNumberChoices } from './lesson-content.js';

const norm = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ');
const unique = values => [...new Map(values.filter(v => typeof v === 'string' && v.trim() && !/^[-—]$/.test(v)).map(v => [norm(v), v])).values()];
const gradeKey = value => norm(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?]+$/, '').trim();
const labels = ['masculine singular', 'feminine singular', 'masculine plural', 'feminine plural'];
const definiteArticles = ['il', 'lo', 'la', "l'", 'i', 'gli', 'le'];
// Small, explicit fallback lexicon for custom entries and data-loading tests.
// The normal lesson passes the catalog, which supplies same-type distractors.
const fallback = [
  ['noun', 'casa', 'house', 'case', 'f'], ['noun', 'libro', 'book', 'libri', 'm'], ['noun', 'sedia', 'chair', 'sedie', 'f'], ['noun', 'gatto', 'cat', 'gatti', 'm'],
  ['noun', 'zaino', 'backpack', 'zaini', 'm'], ['noun', 'isola', 'island', 'isole', 'f'],
  ['adj', 'rosso', 'red'], ['adj', 'freddo', 'cold'], ['adj', 'veloce', 'fast'], ['adj', 'stanco', 'tired'],
  ['adv', 'sempre', 'always'], ['adv', 'mai', 'never'], ['adv', 'qui', 'here'], ['adv', 'lentamente', 'slowly'],
  ['prep', 'con', 'with'], ['prep', 'senza', 'without'], ['prep', 'sotto', 'under'], ['prep', 'dopo', 'after'],
  ['conj', 'e', 'and'], ['conj', 'ma', 'but'], ['conj', 'o', 'or'], ['conj', 'se', 'if'],
  ['pron', 'io', 'I'], ['pron', 'noi', 'we'], ['pron', 'chi', 'who'], ['pron', 'nessuno', 'nobody'],
  ['det', 'ogni', 'every'], ['det', 'questo', 'this'], ['det', 'alcuni', 'some'], ['det', 'nessun', 'no'],
  ['num', 'due', 'two'], ['num', 'tre', 'three'], ['num', 'quattro', 'four'], ['num', 'dieci', 'ten'],
  ['interj', 'ciao', 'hello; goodbye'], ['interj', 'grazie', 'thank you'], ['interj', 'buonanotte', 'good night'], ['interj', 'complimenti', 'congratulations'],
  ['expr', 'a domani', 'see you tomorrow'], ['expr', 'buon appetito', 'enjoy your meal'], ['expr', 'per favore', 'please'], ['expr', 'in bocca al lupo', 'good luck'],
].map(([pos, it, en, pl, g]) => ({ id: `fallback:${it}`, pos, it, en, pl, ...(g ? { g, level: 'A1' } : {}) }));

function selectedMeaning(entry) {
  const meanings = String(entry.en || '').split(';').map(s => s.trim()).filter(Boolean);
  if (entry.it === 'calcio' && isUncountable(entry)) return 'football; soccer';
  const translation = norm(entry.exEn);
  return meanings.find(m => { const plain = norm(m.replace(/\([^)]*\)/g, '')); return plain.length > 1 && translation.includes(plain); }) || meanings[0] || '';
}
// These are exclusion groups, not claims that the words are interchangeable in
// every sentence. A possibly valid translation is safer to omit than mark wrong.
const equivalentMeanings = [
  ['hi', 'hello'], ['bye', 'goodbye', 'farewell'], ['thanks', 'thank you'],
  ['ok', 'okay', 'all right', 'alright', 'fine'], ['yes', 'yeah'], ['no', 'nope'],
  ['why', 'wherefore'], ['therefore', 'thus', 'hence', 'wherefore'],
  ['happy', 'glad', 'cheerful', 'merry'], ['ill', 'sick', 'unwell'],
  ['fast', 'quick', 'rapid'], ['tasty', 'delicious'], ['angry', 'mad'],
  ['help', 'assistance'], ['beginning', 'start'], ['end', 'finish'],
  ['big', 'large'], ['little', 'small'], ['near', 'close'],
];
function meaningParts(entry) {
  // Remove complete parenthetical notes BEFORE splitting their comma lists:
  // “the (masculine singular, before s+consonant, z…)” still means “the”.
  const meanings = String(entry.referenceMeanings || entry.en || '').replace(/\([^)]*\)/g, '');
  return unique(meanings.split(/[;,/]/).map(s => norm(s).replace(/^(?:to|a|an|the)\s+/, '')).filter(Boolean));
}
function overlap(a, b) {
  const aMeanings = meaningParts(a), bMeanings = meaningParts(b);
  return aMeanings.some(x => bMeanings.some(y => x === y
    || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `)
    || equivalentMeanings.some(group => group.includes(x) && group.includes(y))));
}
function hash(value) { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.codePointAt(0), 16777619); return n >>> 0; }
function seed(value) { let n = hash(value); return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; }
function shuffled(values, rng) { const out = [...values]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
function candidateEntries(entry, pool, rng) {
  const safe = x => x && x.it && x.en && x.id !== entry.id && norm(x.it) !== norm(entry.it) && !x.inf && x.pos !== 'verb' && !overlap(entry, x);
  const source = (Array.isArray(pool) ? pool : []).filter(safe);
  const score = x => (x.pos === entry.pos ? 8 : 0) + (entry.cat && x.cat === entry.cat ? 3 : 0) + (entry.level && x.level === entry.level ? 1 : 0);
  // Shuffle before sorting to vary real distractors among equally relevant words.
  const ranked = shuffled(source, rng).sort((a, b) => score(b) - score(a));
  const backstop = shuffled(fallback.filter(safe), rng).sort((a, b) => (b.pos === entry.pos) - (a.pos === entry.pos));
  return [...ranked, ...backstop];
}
function articles(entry, plural = false) { return entry.g ? unique(String(article(entry, plural)).split('/')) : []; }
function attach(a, noun) { return a.endsWith("'") ? a + noun : `${a} ${noun}`; }
function nounForms(entry, plural = false) {
  const word = plural ? entry.pl : entry.it;
  if (!word || plural && !hasPluralForm(entry)) return [];
  return unique([word, ...articles(entry, plural).map(a => attach(a, word))]);
}
function prompt(main, instruction) { return `<div class="big md">${escapeHTML(main)}</div>${instruction ? `<div class="sub">${escapeHTML(instruction)}</div>` : ''}`; }

export function buildShortWordQuestion(entry, target, { variant = 0, phase = 'guided', pool = [], chapterId = 'word-short', contentVersion = 1, format = 'mc', pairTargets = [] } = {}) {
  if (!entry?.id || !entry.it || !target?.id || target.available === false || entry.inf || entry.pos === 'verb') return null;
  const v = Math.max(0, Math.floor(Number(variant) || 0)), rng = seed(`${entry.id}:${target.id}:${v}`), meaning = selectedMeaning(entry);
  if (!meaning) return null;
  const candidates = candidateEntries(entry, pool, rng), skill = target.skill;
  let main = entry.it, instruction = '', answers = [], wrongs = [], explanation = '', diagnostic = {}, answerLanguage = 'it', shown = [], formKey = skill, say = entry.it;
  if (skill === 'meaning') {
    answers = [meaning]; wrongs = candidates.map(selectedMeaning); instruction = v % 2 ? 'Match the meaning.' : 'What does it mean?';
    explanation = `${entry.it} — ${meaning}.`; diagnostic = { kind: 'meaning' }; answerLanguage = 'en'; shown = [entry.it];
  } else if (skill === 'recall') {
    main = meaning; instruction = v % 2 ? 'Match the Italian word.' : 'Choose the Italian word.';
    answers = [entry.it]; wrongs = candidates.map(x => x.it); explanation = `${entry.it} — ${meaning}.`;
    diagnostic = { kind: 'meaning' };
  } else if (skill === 'article') {
    if (entry.pos !== 'noun' || !entry.g) return null;
    // The singular article is the article screen; the plural article is drilled
    // with the plural phrase and on the board. Plural-only nouns ask the plural.
    const plural = isPluralOnly(entry) || target.number === 'plural';
    if (plural && !hasPluralForm(entry)) return null;
    const noun = plural ? entry.pl : entry.it;
    main = `… ${noun}`; instruction = `${plural ? 'Plural' : 'Singular'} · choose the definite article`;
    answers = articles(entry, plural); wrongs = definiteArticles; diagnostic = { kind: 'article' }; shown = [noun];
    explanation = `${answers.map(a => attach(a, noun)).join(' / ')}. Learn the article with the noun.`;
    formKey = `article-${plural ? 'plural' : 'singular'}`; say = attach(answers[0], noun);
  } else if (skill === 'plural') {
    if (!hasPluralForm(entry) || isPluralOnly(entry)) return null;
    // A noun with a gender always answers with its article ("le case"), never the
    // bare plural; a genderless custom noun can only offer the bare form.
    const invariant = norm(entry.it) === norm(entry.pl), whole = !!entry.g;
    if (invariant && !whole) return null;
    answers = whole ? nounForms(entry, true).slice(1) : [entry.pl];
    main = whole ? nounForms(entry)[1] : entry.it; instruction = whole ? 'Choose the plural with its article.' : 'Choose the plural.';
    wrongs = whole ? [...definiteArticles.map(a => attach(a, entry.pl)), ...articles(entry, true).map(a => attach(a, entry.it)), ...nounForms(entry).slice(1)] : [entry.it, ...candidates.filter(hasPluralForm).map(x => x.pl)];
    diagnostic = { kind: 'plural', plural: entry.pl, requiresArticle: whole, articles: articles(entry, true) }; shown = nounForms(entry);
    explanation = `${nounForms(entry)[1] || entry.it} → ${whole ? answers.join(' / ') : entry.pl}.${invariant ? ' The noun stays the same; the article shows the plural.' : ''}`;
    formKey = whole ? 'plural-with-article' : 'plural'; say = answers[0];
  } else if (skill === 'number') {
    // A singular-use sense: which statement is right, rather than a plural the
    // noun does not normally use. The wrong statements name a plural phrase.
    if (entry.pos !== 'noun' || !entry.g) return null;
    const number = target.fact && target.distractors?.length ? { question: target.question, fact: target.fact, distractors: target.distractors } : nounNumberChoices(entry);
    if (!number) return null;
    const phrase = attach(articles(entry)[0], entry.it);
    main = phrase; instruction = number.question || 'Which is right for this noun?';
    answers = [number.fact]; wrongs = number.distractors; answerLanguage = 'en'; shown = [entry.it];
    diagnostic = { kind: 'component', component: 'number' };
    explanation = `${phrase} is normally singular in this meaning.`; formKey = 'number'; say = phrase;
  } else if (skill === 'agreement') {
    if (entry.pos !== 'adj') return null;
    const formIndex = Number.isInteger(target.formIndex) ? target.formIndex : 0;
    const answer = target.answerForm || entry.forms?.[formIndex];
    const invariant = target.invariant || /invariable/i.test(entry.note || '') && !entry.forms?.length || entry.forms?.length === 4 && new Set(entry.forms.map(norm)).size === 1;
    if (invariant) {
      main = entry.it; instruction = 'How does this adjective change?'; answers = ['It stays the same.'];
      wrongs = ['It changes with both gender and number.', 'It changes only in the plural.']; answerLanguage = 'en';
      explanation = `${entry.it} keeps the same form in this use.`; formKey = 'agreement-invariant';
    } else {
      if (!answer) return null;
      main = entry.it; instruction = `${target.formLabel || labels[formIndex]} · choose the adjective`;
      answers = [answer]; wrongs = unique([...(entry.forms || []), entry.it]);
      // Feminine-only entries can have a recorded plural in their source note.
      const recordedPlural = String(entry.note || '').match(/plural\s+['“"]?([\p{L}’'-]+)/iu)?.[1]?.replace(/['’]$/, '');
      if (recordedPlural) wrongs.push(recordedPlural);
      explanation = `${answer} is the ${target.formLabel || labels[formIndex]} form.`; formKey = `agreement-${formIndex}-${norm(answer)}`; say = answer;
    }
    diagnostic = { kind: 'adjective' }; shown = [entry.it];
  } else return null;
  answers = unique(answers); if (!answers.length) return null;
  const accepted = new Set(answers.map(gradeKey));
  wrongs = unique(wrongs).filter(x => !accepted.has(gradeKey(x)));
  if (!wrongs.length) return null; // Never silently turn an unsupported check into typing.
  const choices = shuffled([{ label: answers[0], value: answers[0], correct: true }, ...shuffled(wrongs.slice(0, 12), rng).slice(0, 3).map(label => ({ label, value: label, correct: false }))], rng);
  const lexicalExposure = entry.pos === 'noun' && ['recall', 'plural'].includes(skill) ? nounForms(entry, skill === 'plural') : answers;
  const variantKey = `${target.id}:${formKey}:${hash([main, instruction, ...choices.map(c => norm(c.label)).sort()].join('|')).toString(36)}`;
  const result = {
    id: variantKey, type: 'mc', itemId: entry.id, prompt: prompt(main, instruction), tag: skill,
    answer: answers, choices, say, tip: explanation, lesson: [explanation, entry.note, nounNumberNote(entry)].filter(Boolean).join(' '),
    example: entry.ex || '', exampleTranslation: entry.exEn || '', explanation,
    meta: { entryId: entry.id, objectiveId: target.id, targetId: target.id, wordSlotId: target.wordSlotId || null,
      chapterId: target.chapterId || chapterId, contentVersion, kind: 'word', skill, tense: null, person: null, role: 'ordinary',
      mode: 'recognition', evidenceMode: 'recognition', supportOnly: true, activityKind: phase === 'repair' ? 'repair' : 'guided',
      shortWord: true, variantId: variantKey, contextId: `${entry.id}:short-word:${formKey}`, answerLanguage, diagnostic,
      evidenceScope: 'supported-recognition', promptExposureForms: unique(shown), exposureForms: unique(lexicalExposure),
      feedbackExposureForms: unique([entry.it, meaning, ...answers, ...lexicalExposure]),
    },
  };
  if (format !== 'pairs') return result;
  const descriptors = pairTargets.length ? pairTargets : target.wordPairTargets || [];
  const seedValue = hash(`${target.id}:${v}`);
  if (entry.pos === 'noun' && entry.g) return articleBoard(entry, target, descriptors, candidates, result, seedValue) || result;
  const rows = descriptors.slice(0, 3).map(t => {
    if (entry.pos !== 'adj' || t.skill !== 'agreement' || t.invariant) return null;
    const forms = unique([t.answerForm || entry.forms?.[t.formIndex]]), label = t.formLabel || labels[t.formIndex];
    if (!forms.length || !label) return null;
    const rowQuestion = { ...result, type: 'mc', answer: forms, choices: [], say: forms[0], explanation: `${label}: ${forms.join(' / ')}.`,
      meta: { ...result.meta, targetId: t.id, objectiveId: t.id, skill: t.skill, diagnostic: { kind: 'adjective' },
        variantId: `${t.id}:pair-${hash(forms.join('|')).toString(36)}`, contextId: `${entry.id}:word-pair:${label}`, answerLanguage: 'it',
        exposureForms: forms, promptExposureForms: [], feedbackExposureForms: unique([entry.it, ...forms]) } };
    return { targetId: t.id, label, question: rowQuestion };
  }).filter(Boolean);
  // A board of identical forms teaches no useful contrast. Keep the MC check.
  if (rows.length < 2 || new Set(rows.map(r => norm(r.question.answer[0]))).size < 2) return result;
  return createPairActivity(result, rows, { seed: seedValue });
}

// The article board: left tiles are definite articles, right tiles bare nouns.
// The noun's own singular and plural rows carry its article and plural evidence;
// two decoy nouns of the other gender from the same level make the choice real
// and record nothing. Articles are unique across rows, and so are the forms,
// except that an invariable noun legitimately pairs two articles with one form.
function articleBoard(entry, target, descriptors, candidates, result, seedValue) {
  const usedArticles = new Set(), usedForms = new Set(), ownForms = [];
  const rowQuestion = (t, form, label, say, meta) => ({ ...result, type: 'mc', answer: [form], choices: [], say, explanation: `${say}: ${label}.`,
    meta: { ...result.meta, targetId: t, objectiveId: t, answerLanguage: 'it', exposureForms: unique([form, say]), promptExposureForms: [], feedbackExposureForms: unique([entry.it, form, say]), ...meta } });
  const rows = [];
  for (const t of descriptors.slice(0, 3)) {
    if (!['article', 'plural'].includes(t.skill)) continue;
    const plural = t.skill === 'plural' || isPluralOnly(entry) || t.number === 'plural';
    if (plural && !hasPluralForm(entry) || t.skill === 'plural' && isPluralOnly(entry) || rows.some(row => row.plural === plural)) continue;
    const form = plural ? entry.pl : entry.it, forms = articles(entry, plural);
    if (!form || !forms.length) continue;
    const label = forms.join(' / '), say = attach(forms[0], form), number = plural ? 'plural' : 'singular';
    forms.forEach(a => usedArticles.add(a)); usedForms.add(norm(form)); ownForms.push(form, say);
    rows.push({ targetId: t.id, label, plural, question: rowQuestion(t.id, form, number, say, { skill: t.skill,
      diagnostic: t.skill === 'plural' ? { kind: 'plural', plural: entry.pl, requiresArticle: false } : { kind: 'article' },
      variantId: `${t.id}:pair-${hash(`${label}|${form}`).toString(36)}`, contextId: `${entry.id}:word-pair:${number}` }) });
  }
  if (!rows.length) return null;
  const genders = entry.g === 'mf' ? ['m', 'f'] : [entry.g === 'm' ? 'f' : 'm'];
  const pool = candidates.filter(x => x.pos === 'noun' && genders.includes(x.g) && x.it && !isPluralOnly(x));
  const ordered = [...pool.filter(x => x.level && x.level === entry.level), ...pool.filter(x => !x.level || x.level !== entry.level)];
  const decoys = [];
  for (let k = 0; k < 2; k++) {
    let found = null;
    for (const plural of k % 2 ? [true, false] : [false, true]) {
      const decoy = ordered.find(x => {
        if (decoys.some(d => d.entry.id === x.id)) return false;
        const form = plural ? x.pl : x.it;
        if (!form || plural && (!hasPluralForm(x) || norm(x.pl) === norm(x.it))) return false;
        const a = String(article(x, plural) || '');
        return !!a && !a.includes('/') && !usedArticles.has(a) && !usedForms.has(norm(form));
      });
      if (decoy) { found = { entry: decoy, plural }; break; }
    }
    if (!found) break;
    const form = found.plural ? found.entry.pl : found.entry.it, a = String(article(found.entry, found.plural)), say = attach(a, form);
    usedArticles.add(a); usedForms.add(norm(form)); decoys.push(found);
    const id = `${target.id}::decoy::${k}`;
    rows.push({ targetId: id, label: a, decoy: true, question: rowQuestion(id, form, found.plural ? 'plural' : 'singular', say, { entryId: found.entry.id, skill: 'article', decoy: true,
      diagnostic: { kind: 'article' }, variantId: `${id}:pair-${hash(`${a}|${form}`).toString(36)}`, contextId: `${found.entry.id}:word-pair:decoy`, feedbackExposureForms: unique([form, say]) }) });
  }
  if (rows.length < 2) return null;
  const mixed = decoys.length === 2 ? 'Two other nouns are mixed in.' : decoys.length === 1 ? 'Another noun is mixed in.' : '';
  const base = { ...result, meta: { ...result.meta, promptExposureForms: [], exposureForms: unique(ownForms), feedbackExposureForms: unique([entry.it, ...ownForms]) } };
  return createPairActivity(base, rows.map(({ targetId, label, decoy, question }) => ({ targetId, label, decoy, question })), { seed: seedValue, prompt: prompt('Match each article to its noun', mixed) });
}
