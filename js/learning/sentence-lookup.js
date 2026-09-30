// Offline lexical help. Returned strings are data, never HTML; callers must escape them.
import { article, withArticle, hasPluralForm, isPluralOnly, nounNumberNote, GENDER_NAME } from '../data.js';
import { conjugate, accepted, PERSONS, IMP_PERSONS, TENSE_BY_KEY, MISSING } from '../conjugator.js';
import { progressiveForms } from './progressive-content.js';
import { GRAMMAR_LOOKUP_ENTRIES, GRAMMAR_LOOKUP_ENTRY_PATCHES, GRAMMAR_LOOKUP_ALIASES, GRAMMAR_LOOKUP_FUNCTIONS, GRAMMAR_LOOKUP_NAMES, GRAMMAR_LOOKUP_PLACES, GRAMMAR_LOOKUP_FORM_NOTES } from './grammar-lexicon.js';

const norm = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ');
const usable = value => typeof value === 'string' && !!value.trim() && !['-', MISSING].includes(value.trim());
const unique = values => [...new Set(values.filter(usable))];
const CORE = [['presente', 'Present'], ['passatoProssimo', 'Past · passato prossimo'], ['imperfetto', 'Imperfetto'], ['futuro', 'Future'], ['condizionale', 'Conditional · condizionale presente']];
const WEATHER = new Set(['piovere', 'nevicare', 'grandinare', 'tuonare', 'lampeggiare', 'diluviare', 'piovigginare', 'nevischiare', 'albeggiare', 'imbrunire', 'annottare']);
const NONFINITE = { infinito: 'Infinitive', infinitoPassato: 'Past infinitive', participioPassato: 'Past participle', participioPresente: 'Present participle', gerundio: 'Gerund', gerundioPassato: 'Past gerund' };
// Explicitly authored lookup-only gaps found in the lesson/example corpus. These
// are not new learning entries and never override a supplied catalog or custom entry.
const SUPPLEMENT = [
  ['riforma', 'reform', 'f', 'riforme'], ['discorso', 'speech; discussion', 'm', 'discorsi'],
  ['discussione', 'discussion', 'f', 'discussioni'], ['danno', 'damage; harm', 'm', 'danni'],
  ['gas', 'gas', 'm', 'gas'], ['stagione', 'season', 'f', 'stagioni'],
  ['condizione', 'condition', 'f', 'condizioni'], ['auto', 'car', 'f', 'auto'],
  ['termine', 'term; end', 'm', 'termini'], ['difesa', 'defence; defense', 'f', 'difese'],
  ['dichiarazione', 'statement; declaration', 'f', 'dichiarazioni'], ['lavoratore', 'worker', 'm', 'lavoratori'],
  // Treccani vocabolario entries momento / spiegazione / testo3; explicit
  // regular plurals, not an inference applied to unknown catalogue nouns.
  ['momento', 'moment', 'm', 'momenti'], ['spiegazione', 'explanation', 'f', 'spiegazioni'],
  ['testo', 'text; written passage', 'm', 'testi'],
].map(([it, en, g, pl]) => ({ id: `lookup:${it}|noun`, it, en, g, pl, pos: 'noun', lookupSource: 'curated', ...(it === pl ? { note: 'Invariable noun.' } : {}) }));
SUPPLEMENT.push(...GRAMMAR_LOOKUP_ENTRIES);
SUPPLEMENT.push({ id: 'lookup:riposare|verb', inf: 'riposare', en: 'to rest', pos: 'verb', aux: 'avere', lookupSource: 'curated' });

// Expand only alternatives explicitly supplied by the existing conjugator.
function forms(value) {
  return unique(accepted(value).flatMap(s => {
    if (/o\/a\b/.test(s)) return [s.replace(/o\/a\b/g, 'o'), s.replace(/o\/a\b/g, 'a')];
    if (/i\/e\b/.test(s)) return [s.replace(/i\/e\b/g, 'i'), s.replace(/i\/e\b/g, 'e')];
    return [s];
  }));
}

/** Word tokens keep Italian apostrophes attached; separators retain their exact text. */
export function tokenizeItalianSentence(text) {
  const source = String(text ?? '');
  const out = [];
  const pattern = /[\p{L}\p{M}\p{N}]+(?:[-'’‘][\p{L}\p{M}\p{N}]+)*['’‘]?/gu;
  let end = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > end) out.push({ text: source.slice(end, match.index), start: end, end: match.index, type: 'separator' });
    end = match.index + match[0].length;
    out.push({ text: match[0], start: match.index, end, type: 'word' });
  }
  if (end < source.length) out.push({ text: source.slice(end), start: end, end: source.length, type: 'separator' });
  return out;
}

// Small explicit glosses for grammatical words which may be absent from a custom catalog.
// A gloss is a range of uses, not a claimed translation of the current sentence.
const FUNCTIONS = [
  ['io', 'pron', 'I'], ['tu', 'pron', 'you (singular, informal)'], ['lui', 'pron', 'he; him'],
  ['lei', 'pron', 'she; her; you (formal singular)'], ['noi', 'pron', 'we; us'], ['voi', 'pron', 'you (plural)'], ['loro', 'pron', 'they; them; their'],
  ['mi', 'pron', 'me; to me; myself'], ['ti', 'pron', 'you; to you; yourself'], ['si', 'pron', 'oneself; themselves; an impersonal or passive pronoun'],
  ['ci', 'pron', 'us; to us; ourselves; there'], ['vi', 'pron', 'you; to you; yourselves; there'], ['ne', 'pron', 'of it; of them; from there'],
  ['lo', 'pron', 'him; it (masculine singular)'], ['la', 'pron', 'her; it (feminine singular)'], ['li', 'pron', 'them (masculine plural)'],
  ['le', 'pron', 'them (feminine plural); to her; to you (formal)'], ['gli', 'pron', 'to him; to them'],
  ['me', 'pron', 'me; stressed or combined form of mi'], ['te', 'pron', 'you; stressed or combined form of ti'],
  ['se', 'pron', 'combined form of si before another pronoun'], ['ce', 'pron', 'combined form of ci before another pronoun'], ['ve', 'pron', 'combined form of vi before another pronoun'],
  ['il', 'det', 'the (masculine singular)'], ['lo', 'det', 'the (masculine singular)'], ['la', 'det', 'the (feminine singular)'],
  ["l'", 'det', 'the (singular, before a vowel)'], ['i', 'det', 'the (masculine plural)'], ['gli', 'det', 'the (masculine plural)'], ['le', 'det', 'the (feminine plural)'],
  ['un', 'det', 'a; an (masculine)'], ['uno', 'det', 'a; an (masculine)'], ['una', 'det', 'a; an (feminine)'], ["un'", 'det', 'a; an (feminine, before a vowel)'],
  ['a', 'prep', 'to; at'], ['di', 'prep', 'of; from'], ['da', 'prep', 'from; since; by; at someone’s place'], ['in', 'prep', 'in; into; to'],
  ['con', 'prep', 'with'], ['su', 'prep', 'on; about'], ['per', 'prep', 'for; through; in order to'], ['tra', 'prep', 'between; among; in (a period of time)'], ['fra', 'prep', 'between; among; in (a period of time)'],
  ['e', 'conj', 'and'], ['ed', 'conj', 'and (variant of e)'], ['o', 'conj', 'or'], ['oppure', 'conj', 'or; or else'], ['ma', 'conj', 'but'],
  ['che', 'conj', 'that'], ['che', 'pron', 'who; which; what'], ['se', 'conj', 'if; whether'], ['perché', 'conj', 'why; because'],
  ['non', 'adv', 'not'], ['sì', 'adv', 'yes'], ['no', 'adv', 'no'], ['qui', 'adv', 'here'], ['qua', 'adv', 'here'], ['lì', 'adv', 'there'], ['là', 'adv', 'there'],
  ['oggi', 'adv', 'today'], ['ieri', 'adv', 'yesterday'], ['domani', 'adv', 'tomorrow'], ['sempre', 'adv', 'always'], ['mai', 'adv', 'ever; never (with non)'],
  ['già', 'adv', 'already'], ['ancora', 'adv', 'still; again; yet'], ['anche', 'adv', 'also; too; even'], ['poi', 'adv', 'then; later'],
  ['molto', 'adv', 'very; a lot'], ['bene', 'adv', 'well'], ['male', 'adv', 'badly'], ['come', 'adv', 'how; like; as'], ['dove', 'adv', 'where'], ['quando', 'adv', 'when'],
  ['ad', 'prep', 'to; at (variant of a)'], ['contro', 'prep', 'against'], ['oltre', 'prep', 'beyond; in addition to'],
  ['qual', 'det', 'which; what (shortened quale)'], ['nessun', 'det', 'no; not any'], ['nessuna', 'det', 'no; not any'],
  ['alcuni', 'det', 'some; a few'], ['alcune', 'det', 'some; a few'], ['stanotte', 'adv', 'tonight; last night, depending on the sentence'],
];
FUNCTIONS.push(...GRAMMAR_LOOKUP_FUNCTIONS);
// These closed-class forms and shortened headwords are explicitly listed here;
// no general suffix rule is used to manufacture forms for arbitrary entries.
const LEXICAL_ALIASES = {
  mio: ['mia', 'miei', 'mie'], tuo: ['tua', 'tuoi', 'tue'], suo: ['sua', 'suoi', 'sue'],
  nostro: ['nostra', 'nostri', 'nostre'], vostro: ['vostra', 'vostri', 'vostre'],
  questo: ['questa', 'questi', 'queste'], quello: ['quel', 'quella', 'quelli', 'quelle', 'quei', 'quegli'],
  tutto: ['tutta', 'tutti', 'tutte'], altro: ['altra', 'altri', 'altre'],
  signore: ['signor'], buono: ['buon'], bello: ['bel', 'bei'], 'e-mail': ['email', 'mail'],
  'menù': ['menu'],
  avere: ['aver'], essere: ['esser'], fare: ['far'], dire: ['dir'],
};
for(const [lemma,aliases] of Object.entries(GRAMMAR_LOOKUP_ALIASES)) LEXICAL_ALIASES[lemma]=unique([...(LEXICAL_ALIASES[lemma] || []),...aliases]);
const PREPOSITIONS = new Map();
for (const [base, gloss, words] of [
  ['di', 'of / from the; some (partitive use)', ['del', 'dello', 'della', "dell'", 'dei', 'degli', 'delle']],
  ['a', 'to / at the', ['al', 'allo', 'alla', "all'", 'ai', 'agli', 'alle']],
  ['da', 'from / by / at the', ['dal', 'dallo', 'dalla', "dall'", 'dai', 'dagli', 'dalle']],
  ['in', 'in / into the', ['nel', 'nello', 'nella', "nell'", 'nei', 'negli', 'nelle']],
  ['su', 'on / about the', ['sul', 'sullo', 'sulla', "sull'", 'sui', 'sugli', 'sulle']],
  ['con', 'with the', ['col', 'coi']],
]) for (const word of words) PREPOSITIONS.set(word, { base, meaning: gloss });
const ELISIONS = new Map([
  ["l'", { meaning: 'the; or an elided object pronoun (him, her, it), depending on context', ambiguous: true }],
  ["un'", { meaning: 'a / an (feminine)', ambiguous: false }],
  ["d'", { meaning: 'of / from (elided di)', ambiguous: false }],
  ["c'", { meaning: 'elided ci: there; us, depending on context', ambiguous: true }],
  ["m'", { meaning: 'elided mi: me / myself', ambiguous: false }],
  ["t'", { meaning: 'elided ti: you / yourself', ambiguous: false }],
  ["s'", { meaning: 'elided si: oneself / themselves; impersonal si', ambiguous: false }],
  ["n'", { meaning: 'elided ne: of it / of them / from there', ambiguous: false }],
  ["quest'", { meaning: 'this (before a vowel)', ambiguous: false }],
  ["quell'", { meaning: 'that (before a vowel)', ambiguous: false }],
  ["com'", { meaning: 'how (elided come)', ambiguous: false }],
  ["dov'", { meaning: 'where (elided dove)', ambiguous: false }],
  ["vent'", { meaning: 'twenty (elided venti)', ambiguous: false }],
  ["trent'", { meaning: 'thirty (elided trenta)', ambiguous: false }],
  ["quarant'", { meaning: 'forty (elided quaranta)', ambiguous: false }],
  ["cinquant'", { meaning: 'fifty (elided cinquanta)', ambiguous: false }],
  ["sessant'", { meaning: 'sixty (elided sessanta)', ambiguous: false }],
  ["settant'", { meaning: 'seventy (elided settanta)', ambiguous: false }],
  ["ottant'", { meaning: 'eighty (elided ottanta)', ambiguous: false }],
  ["novant'", { meaning: 'ninety (elided novanta)', ambiguous: false }],
]);
const NAMES = new Set(['Marco', 'Sara', 'Luca', 'Maria', 'Anna', 'Paolo', 'Giulia', 'Giovanni', 'Francesca', 'Giuseppe', 'Paola', 'Rossi', 'Bianchi'].map(norm));
for(const name of GRAMMAR_LOOKUP_NAMES)NAMES.add(norm(name));
const PLACES = new Map([['roma', 'Rome'], ['italia', 'Italy'], ['milano', 'Milan'], ['napoli', 'Naples'], ['torino', 'Turin'], ['firenze', 'Florence'], ['venezia', 'Venice'], ['bologna', 'Bologna']]);

for(const [place,meaning] of GRAMMAR_LOOKUP_PLACES)PLACES.set(norm(place),meaning);

function contractionFor(key) {
  const apostrophe = key.indexOf("'");
  if (apostrophe < 0 || apostrophe === key.length - 1) return null;
  const prefix = key.slice(0, apostrophe + 1), base = key.slice(apostrophe + 1);
  const preposition = PREPOSITIONS.get(prefix);
  if (preposition) return { prefix, base, meaning: `${preposition.meaning} (${preposition.base} + l')`, ambiguous: false };
  const elision = ELISIONS.get(prefix);
  return elision ? { prefix, base, ...elision } : null;
}

function followsArticle(key, contraction, sentence) {
  const definiteContraction = c => !!c && (PREPOSITIONS.has(c.prefix) || c.prefix === "un'");
  if (definiteContraction(contraction)) return true;
  const articles = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una']);
  const tokens = tokenizeItalianSentence(sentence).filter(t => t.type === 'word');
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], tokenKey = norm(token.text), elision = contractionFor(tokenKey);
    if (elision?.base === key && definiteContraction(elision)) return true;
    if (tokenKey !== key || !i) continue;
    const previous = tokens[i - 1], previousKey = norm(previous.text);
    if (!sentence.slice(previous.end, token.start).trim() && (articles.has(previousKey) || PREPOSITIONS.has(previousKey))) return true;
  }
  return false;
}

function sentenceText(value) { return typeof value === 'string' ? value : typeof value?.it === 'string' ? value.it : ''; }
function phraseIn(sentence, phrase) {
  if (!sentence || !phrase) return false;
  const haystack = norm(sentence), needle = norm(phrase);
  if (!haystack.includes(needle)) return false;
  const pattern = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{M}])${pattern}(?=$|[^\\p{L}\\p{M}])`, 'u').test(haystack);
}
function exposures(values) {
  // Seeing a construction also exposes the words it contains. Preserve accents.
  return unique(values.flatMap(value => [value, ...tokenizeItalianSentence(value).filter(t => t.type === 'word').map(t => t.text)]));
}
function nounCandidate(entry, variant) {
  const e = variant || entry;
  const gender = Object.hasOwn(GENDER_NAME, e.g) ? e.g : null;
  const onlyPlural = isPluralOnly(e);
  const nounForm = plural => gender ? withArticle(e, plural) : (plural ? e.pl : e.it);
  const singular = onlyPlural ? null : nounForm(false);
  const plural = hasPluralForm(e) ? nounForm(true) : null;
  return {
    gender, genderLabel: gender ? GENDER_NAME[gender] : 'Gender not recorded',
    singular, plural, singularArticle: singular && gender ? article(e) : null, pluralArticle: plural && gender ? article(e, true) : null,
    numberNote: nounNumberNote(e), label: onlyPlural ? plural : singular,
    exposureForms: exposures(unique([singular, plural, e.it, hasPluralForm(e) ? e.pl : null])),
  };
}

function explicitFemininePlural(entry) {
  if (usable(entry.femPl)) return entry.femPl;
  const note = String(entry.note || '');
  const pairs = note.match(/\bPlural:\s*[\p{L}’' -]+\s*\(m\),\s*([\p{L}’' -]+)\s*\(f\)/u);
  if (pairs) return pairs[1].trim();
  const named = note.match(/\bFeminine:\s*([\p{L}’' -]+),\s*pl\.\s*([\p{L}’' -]+)[.;]/u);
  return named && norm(named[1]) === norm(entry.fem) ? named[2].trim() : '';
}

/** Build once per catalog snapshot. No DOM, storage, network, catalog mutation or guessing. */
export function createSentenceLookup({ vocab = [], verbs = [] } = {}) {
  const entries = [...(Array.isArray(vocab) ? vocab : []), ...(Array.isArray(verbs) ? verbs : [])].filter(e => e && typeof e === 'object')
    .map(e=>GRAMMAR_LOOKUP_ENTRY_PATCHES[e.id]?{...e,...GRAMMAR_LOOKUP_ENTRY_PATCHES[e.id]}:e);
  const supplied = new Set(entries.map(e => `${norm(e.inf || e.it)}|${e.kind === 'verb' || e.inf ? 'verb' : e.pos}`));
  for (const e of SUPPLEMENT) if (!supplied.has(`${norm(e.inf || e.it)}|${e.pos}`)) entries.push(e);
  const lexical = new Map(), phrases = new Map(), reverse = new Map(), paradigms = new Map();
  let verbsIndexed = false, translations = null;
  const verbEntries = entries.filter(e => e.kind === 'verb' || e.pos === 'verb' || usable(e.inf));
  const femaleEntries = new Map(entries.filter(e => e.pos === 'noun' && e.g === 'f').map(e => [`${norm(e.it)}|${norm(e.en)}`, e]));
  function add(map, key, value) { if (!usable(key)) return; key = norm(key); if (!map.has(key)) map.set(key, []); map.get(key).push(value); }
  function addLexical(form, record) {
    if (!usable(form)) return;
    add(lexical, form, record);
    if (/\s/.test(form.trim())) for (const token of tokenizeItalianSentence(form)) if (token.type === 'word') add(phrases, token.text, { ...record, phrase: form });
  }
  entries.forEach((e, i) => {
    const id = String(e.id || `local:${i}`), word = e.inf || e.it;
    if (!usable(word)) return;
    addLexical(word, { e, id });
    for (const alias of Object.hasOwn(LEXICAL_ALIASES, norm(word)) ? LEXICAL_ALIASES[norm(word)] : []) addLexical(alias, { e, id });
    if (hasPluralForm(e)) addLexical(e.pl, { e, id });
    for (const form of Array.isArray(e.forms) ? e.forms : []) addLexical(form, { e, id });
    if (e.pos === 'noun' && usable(e.fem)) {
      // Feminine forms are separate supplied evidence; never generate their plural.
      const recorded = femaleEntries.get(`${norm(e.fem)}|${norm(e.en)}`);
      const female = { ...e, it: e.fem, g: 'f', pl: explicitFemininePlural(e) || recorded?.pl || '' };
      addLexical(e.fem, { e, id: id + ':feminine', variant: female });
      if (hasPluralForm(female)) addLexical(female.pl, { e, id: id + ':feminine', variant: female });
    }
  });

  function paradigm(e) {
    if (!paradigms.has(e)) {
      const inf = e.inf || e.it || '';
      // Unknown custom strings must not become fabricated regular verbs.
      let result = null;
      if (/^[\p{L}]+(?:are|ere|ire|rre|arsi|ersi|irsi|rsi|cela|celo|sela|selo|sene|cene|ci|ne|la|lo)$/u.test(norm(inf))) {
        try { result = conjugate(inf, { aux: e.aux, isc: e.isc }); } catch { /* A malformed local entry remains a dictionary-only result. */ }
      }
      paradigms.set(e, result);
    }
    return paradigms.get(e);
  }

  function indexVerbs() {
    if (verbsIndexed) return;
    verbsIndexed = true;
    for (const e of verbEntries) {
      const c = paradigm(e); if (!c) continue;
      const seen = new Set();
      function index(form, meta) {
        const key = `${norm(form)}|${meta.tense || ''}|${meta.person ?? ''}|${meta.kind}|${meta.fullForm || ''}`;
        if (seen.has(key)) return; seen.add(key);
        add(reverse, form, { e, ...meta, form });
      }
      for (const [tense, cells] of Object.entries(c.tenses)) {
        if (!Array.isArray(cells)) continue;
        cells.forEach((cell, cellIndex) => {
          const person = tense === 'imperativo' ? [1, 2, 3, 4, 5][cellIndex] : cellIndex;
          if (WEATHER.has(norm(c.inf)) && (person !== 2 || tense === 'imperativo')) return;
          for (const form of forms(cell)) {
            if (WEATHER.has(norm(c.inf)) && TENSE_BY_KEY[tense]?.compound && /[ae]$/.test(form)) continue;
            if (TENSE_BY_KEY[tense]?.compound) {
              // Only the participle belongs to this lexical verb. The auxiliary has its own entry.
              const participle = form.split(/\s+/).at(-1);
              indexParticiple(participle);
            } else {
              const words = form.split(/\s+/), word = words.at(-1);
              index(word, { tense, person, kind: 'finite', ...(words.length > 1 ? { fullForm: form } : {}) });
            }
          }
        });
      }
      function indexParticiple(form) { index(form, { tense: null, person: null, kind: 'participle' }); }
      for (const [key, value] of Object.entries(c.nonFinite)) {
        for (const form of forms(value)) {
          if (form.includes(' ')) continue;
          index(form, { tense: null, person: null, kind: key.startsWith('participio') ? 'participle' : key.startsWith('gerundio') ? 'gerund' : 'infinitive', nonFinite: key });
        }
      }
      // A separated reflexive gerund belongs to its lexical verb only when the
      // whole reviewed construction, including the correct clitic, is present.
      // Never index the helper as if it were every progressive lexical verb.
      for (const chapter of ['present','background']) for (let person=0;person<6;person++) {
        for (const fullForm of progressiveForms(e,person,{chapter})) {
          index(fullForm.split(/\s+/).at(-1),{fullForm,person,kind:'finite',tense:chapter==='background'?'imperfettoProgressivo':'presenteProgressivo'});
        }
      }
    }
  }

  function sentenceInfo(sentence, translation, entry) {
    const it = sentenceText(sentence);
    if (!it) return null;
    const supplied = typeof translation === 'string' && translation.trim() ? translation : typeof sentence?.en === 'string' ? sentence.en : '';
    if (supplied) return { it, en: supplied };
    const examples = [entry, ...(Array.isArray(entry?.examples) ? entry.examples : [])].filter(Boolean);
    for (const e of examples) if (norm(e.ex || e.it) === norm(it) && usable(e.exEn || (e !== entry ? e.en : ''))) return { it, en: e.exEn || e.en };
    if (!translations) {
      translations = new Map();
      for (const e of entries) {
        if (usable(e.ex) && usable(e.exEn)) translations.set(norm(e.ex), e.exEn);
        for (const example of Array.isArray(e.examples) ? e.examples : []) if (usable(example.it) && usable(example.en)) translations.set(norm(example.it), example.en);
      }
    }
    return { it, en: translations.get(norm(it)) || '' };
  }

  function verbDetails(e, records, context, options) {
    const inf = e.inf || e.it, c = paradigm(e), matches = [];
    const addMatch = record => {
      const progressiveLabel=record.tense==='presenteProgressivo'?'Present progressive':record.tense==='imperfettoProgressivo'?'Past progressive':null;
      const label = record.tense ? progressiveLabel || TENSE_BY_KEY[record.tense]?.name || record.tense : NONFINITE[record.nonFinite] || (record.kind === 'participle' ? 'Past participle' : record.kind === 'gerund' ? 'Gerund' : 'Infinitive');
      const personLabel = record.person === 2 && options.role === 'formal' ? 'Lei (formal you)' : record.tense === 'imperativo' ? IMP_PERSONS[[1, 2, 3, 4, 5].indexOf(record.person)] : record.person == null ? '' : PERSONS[record.person];
      const row = { form: record.fullForm || record.form, kind: record.kind, tense: record.tense || null, tenseLabel: label, person: record.person ?? null, personLabel, contextMatched: !!record.contextMatched };
      if (!matches.some(m => m.form === row.form && m.tenseLabel === row.tenseLabel && m.person === row.person)) matches.push(row);
    };
    for (const record of records) {
      if (record.fullForm && !phraseIn(context, record.fullForm)) continue;
      const pronouns = [['io'], ['tu'], ['lui', 'lei'], ['noi'], ['voi'], ['loro']][record.person] || [];
      const explicitSubject = pronouns.some(pronoun => phraseIn(context, `${pronoun} ${record.form}`));
      addMatch({ ...record, contextMatched: !!record.fullForm || explicitSubject });
    }
    if (c && context && records.some(r => r.kind === 'participle')) for (const [tense, cells] of Object.entries(c.tenses)) {
      if (!TENSE_BY_KEY[tense]?.compound || !Array.isArray(cells)) continue;
      cells.forEach((cell, person) => {
        if (WEATHER.has(norm(inf)) && person !== 2) return;
        for (const form of forms(cell)) if ((!WEATHER.has(norm(inf)) || !/[ae]$/.test(form)) && phraseIn(context, form) && records.some(r => norm(r.form) === norm(form.split(/\s+/).at(-1)))) addMatch({ form, tense, person, kind: 'finite', contextMatched: true });
      });
    }
    matches.sort((a, b) => Number(b.contextMatched) - Number(a.contextMatched) || Number(b.tense === options.tense) - Number(a.tense === options.tense));
    const coreForms = c ? CORE.map(([tense, label]) => ({ tense, label, forms: (c.tenses[tense] || []).flatMap((form, person) => usable(form) && (!WEATHER.has(norm(inf)) || person === 2) ? [{ person, personLabel: WEATHER.has(norm(inf)) ? 'impersonal' : PERSONS[person], form: WEATHER.has(norm(inf)) ? forms(form).filter(f => !TENSE_BY_KEY[tense]?.compound || !/[ae]$/.test(f)).join(' / ') : form.replace(/\|/g, ' / ') }] : []) })).filter(row => row.forms.length) : [];
    return {
      infinitive: inf, matches, forms: coreForms,
      exposureForms: exposures(unique([inf, ...matches.map(m => m.form), ...(c ? CORE.flatMap(([tense]) => (c.tenses[tense] || []).flatMap((form, person) => !WEATHER.has(norm(inf)) || person === 2 ? forms(form).filter(f => !WEATHER.has(norm(inf)) || !TENSE_BY_KEY[tense]?.compound || !/[ae]$/.test(f)) : [])) : [])])),
    };
  }

  return function lookup(token, options = {}) {
    options = options && typeof options === 'object' ? options : {};
    const text = String(token ?? '').trim(), key = norm(text);
    const context = sentenceText(options.sentence);
    const sentence = sentenceInfo(options.sentence, options.translation, options.entry);
    const contraction = contractionFor(key);
    const keys = unique([key, contraction?.base]);
    indexVerbs();
    const grouped = new Map();
    for (const query of keys) {
      for (const record of lexical.get(query) || []) {
        if (!grouped.has(record.id)) grouped.set(record.id, { ...record, matches: [] });
      }
      for (const record of phrases.get(query) || []) {
        if (phraseIn(context, record.phrase) && !grouped.has(record.id)) grouped.set(record.id, { ...record, matches: [] });
      }
      for (const record of reverse.get(query) || []) {
        if (record.fullForm && !phraseIn(context, record.fullForm)) continue;
        const id = String(record.e.id || `verb:${record.e.inf || record.e.it}`);
        if (!grouped.has(id)) grouped.set(id, { e: record.e, id, matches: [] });
        grouped.get(id).matches.push(record);
      }
    }
    const candidates = [...grouped.values()].map(({ e, id, variant, matches, phrase }) => {
      const verb = e.kind === 'verb' || e.pos === 'verb' || usable(e.inf);
      const word = variant?.it || e.inf || e.it;
      const note = [phrase ? `Part of the recorded phrase “${phrase}”. The meaning shown is for the whole phrase.` : '', String(e.note || ''),...GRAMMAR_LOOKUP_FORM_NOTES.filter(x=>norm(x.lemma)===norm(word)&&norm(x.form)===key).map(x=>x.note)].filter(Boolean).join(' ');
      const base = { id, source: e.lookupSource || (verb && matches.length ? 'conjugation' : 'catalog'), word, label: word, meaning: String(e.en || 'Meaning not recorded for this entry.'), pos: verb ? 'verb' : e.pos || 'word', note, exposureForms: exposures([word]) };
      if (verb) return { ...base, ...verbDetails(e, matches, context, options) };
      return e.pos === 'noun' ? { ...base, ...nounCandidate(e, variant) } : base;
    });
    for (const query of keys) {
      for (const [word, pos, meaning] of FUNCTIONS) if (query === norm(word) && !candidates.some(c => norm(c.word) === query && c.pos === pos)) candidates.push({ id: `function:${word}:${pos}`, source: 'function', word, label: word, meaning, pos, note: '', exposureForms: [word] });
      const prep = PREPOSITIONS.get(query);
      if (prep && !candidates.some(c => norm(c.word) === query && c.pos === 'prep')) candidates.push({ id: `preposition:${query}`, source: 'function', word: query, label: query, meaning: prep.meaning, pos: 'prep', note: `${prep.base} + a definite article`, exposureForms: [query] });
      const properText=contraction ? text.slice(text.search(/['’‘]/)+1) : text;
      if (/^\p{Lu}/u.test(properText) && (NAMES.has(query) || PLACES.has(query))) candidates.push({ id: `name:${query}`, source: 'name', word: properText, label: properText, meaning: PLACES.get(query) || 'A person’s name or surname', pos: 'proper noun', note: 'A name, not an ordinary vocabulary translation.', exposureForms: [text] });
      if (/^\d+$/u.test(query)) candidates.push({ id: `number:${query}`, source: 'number', word: query, label: query, meaning: `Number ${query}`, pos: 'number', note: '', exposureForms: [query] });
    }
    // Articles are a useful ordering hint, not proof: la/lo can also be clitics.
    // Preserve every reading and never set contextMatched from this preference.
    const nounHint = followsArticle(key, contraction, context);
    const priority = candidate => (nounHint && candidate.pos === 'noun' ? 6 : 0) + (candidate.id === options.entry?.id ? 4 : 0) + (candidate.matches?.some(m => m.contextMatched) ? 3 : 0) + (candidate.source === 'name' ? 1 : 0);
    candidates.sort((a, b) => priority(b) - priority(a) || a.label.localeCompare(b.label, 'it') || a.id.localeCompare(b.id));
    const status = candidates.length > 1 ? 'ambiguous' : candidates.length ? 'found' : 'unavailable';
    return {
      token: text, status, candidates, contraction, sentence,
      message: status === 'unavailable' ? (sentence?.en ? 'This form is not yet identified in the offline dictionary. Use the sentence translation for context.' : 'This form is not yet identified in the offline dictionary. A translation has not been recorded for this sentence.') : status === 'ambiguous' ? 'Several readings are possible. Use the sentence and part of speech to choose.' : '',
    };
  };
}
