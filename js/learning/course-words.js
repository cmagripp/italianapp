// Lesson vocabulary drill ("Le parole di oggi"): resolve the glosses of a course-v2 lesson's
// opening `words` step to dictionary entries and synthesise matching boards over them.
// Pure and deterministic: no DOM, storage, network or randomness; importable in Node.
import { LEVELS, article, withArticle, hasPluralForm, isPluralOnly } from '../data.js';
import { conjugate, accepted, splitClitic } from '../conjugator.js';
import { buildLesson } from './lesson-content.js';

const norm = s => String(s ?? '').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ');
// Index and gloss keys drop trailing punctuation, so "Quanto costa?", "Mi chiamo…" and the headword "quanto costa?" meet.
const keyOf = s => norm(s).replace(/[\s.!?…,;:]+$/u, '').trim();
const ARTICLE = /^(?:(?:il|lo|la|i|gli|le|un|uno|una)\s+|(?:l|un)')/;
const usable = v => typeof v === 'string' && !!v.trim() && !['-', '—'].includes(v.trim());
const kindOf = e => e.kind || (e.inf ? 'verb' : 'word');
const levelRank = e => { const r = LEVELS.indexOf(e.level); return r < 0 ? LEVELS.length : r; };
const TITLE = 'Le parole di oggi', MAX_PAIRS = 6, MIN_WORDS = 3;
const PROMPTS = { meaning: 'Match each word to its meaning', recall: 'Now from the English', forms: 'Match the article to its noun' };

// ---------- dictionary index (one per dictionary snapshot) ----------
const indexes = new WeakMap();
const add = (map, key, e) => { if (!usable(key)) return; key = keyOf(key); if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(e); };
// Closed-class words whose agreement or truncated forms the dictionary lists only in the note (the schema's `forms` field
// holds an adjective's four endings): the possessive, demonstrative, quantity and question determiners, the truncated
// bel/buon/gran, and the articulated prepositions, which the dictionary enters under the masculine singular (del, al, dal, nel, sul).
const CLOSED_CLASS_FORMS = new Map(Object.entries({
  mio: ['mia', 'miei', 'mie'], tuo: ['tua', 'tuoi', 'tue'], suo: ['sua', 'suoi', 'sue'], nostro: ['nostra', 'nostri', 'nostre'], vostro: ['vostra', 'vostri', 'vostre'],
  questo: ['questa', 'questi', 'queste', "quest'"], quello: ['quel', 'quella', 'quelli', 'quelle', 'quei', 'quegli', "quell'"], tutto: ['tutta', 'tutti', 'tutte'], altro: ['altra', 'altri', 'altre'],
  quanto: ['quanta', 'quanti', 'quante'], quale: ['quali', 'qual'], troppo: ['troppa', 'troppi', 'troppe'], nessuno: ['nessun', 'nessuna', "nessun'"],
  bello: ['bel', 'bei', 'begli', "bell'"], buono: ['buon', "buon'"], grande: ['gran'],
  del: ['dello', 'della', "dell'", 'dei', 'degli', 'delle'], al: ['allo', 'alla', "all'", 'ai', 'agli', 'alle'], dal: ['dallo', 'dalla', "dall'", 'dai', 'dagli', 'dalle'],
  nel: ['nello', 'nella', "nell'", 'nei', 'negli', 'nelle'], sul: ['sullo', 'sulla', "sull'", 'sui', 'sugli', 'sulle'],
}));
// A noun's feminine plural is supplied, never inferred: `femPl`, or the note's "Plural: amici (m), amiche (f)" /
// "Feminine: amica, pl. amiche." (the same readings as sentence-lookup.js).
function femininePlural(e) {
  if (usable(e.femPl)) return e.femPl;
  const note = String(e.note || '');
  const pair = note.match(/\bPlural:\s*[\p{L}’' -]+\s*\(m\),\s*([\p{L}’' -]+)\s*\(f\)/u);
  if (pair) return pair[1].trim();
  const named = note.match(/\bFeminine:\s*([\p{L}’' -]+),\s*pl\.\s*([\p{L}’' -]+)[.;]/u);
  return named && norm(named[1]) === norm(e.fem) ? named[2].trim() : '';
}
function dictionaryIndex(vocab, verbs) {
  const cached = indexes.get(vocab);
  if (cached && cached.verbs === verbs) return cached;
  const headwords = new Map(), plurals = new Map(), fems = new Map(), forms = new Map(), byId = new Map(), verbEntries = [];
  // Raw JSON entries (Node) carry no `kind`; mirror loadData without touching the originals.
  for (const raw of [...(Array.isArray(vocab) ? vocab : []), ...(Array.isArray(verbs) ? verbs : [])]) {
    if (!raw || typeof raw !== 'object' || !raw.id) continue;
    const e = raw.kind ? raw : { ...raw, kind: kindOf(raw), it: raw.inf || raw.it };
    byId.set(e.id, e);
    add(headwords, e.inf || e.it, e);
    if (e.kind === 'verb') { if (usable(e.inf)) verbEntries.push(e); continue; }
    if (e.pos === 'noun') {
      if (hasPluralForm(e) && norm(e.pl) !== norm(e.it)) add(plurals, e.pl, e);
      if (usable(e.fem)) { add(fems, e.fem, e); add(fems, femininePlural(e), e); }
    }
    for (const f of Array.isArray(e.forms) ? e.forms : []) if (norm(f) !== norm(e.it)) add(forms, f, e);
    for (const f of CLOSED_CLASS_FORMS.get(norm(e.it)) || []) add(forms, f, e);
  }
  // Verbs by English token, so a gloss finds the few verbs worth conjugating without the whole paradigm index.
  const verbsByToken = new Map();
  verbEntries.forEach((e, i) => { for (const t of new Set(senses(e.en).flatMap(s => s.split(' ')))) { if (!verbsByToken.has(t)) verbsByToken.set(t, []); verbsByToken.get(t).push(i); } });
  const index = { verbs, headwords, plurals, fems, forms, byId, verbEntries, verbsByToken, conjugated: null };
  indexes.set(vocab, index);
  return index;
}
// Conjugated forms of the given verbs, keyed by the whole form ("mi alzo", "ho mangiato", "sono andata", "va'"): each cell
// of the paradigm with its alternatives and agreement variants, the non-finite forms (present participle aside), the
// participle's agreement forms and, for enclisis, the gerund and imperative forms.
const variants = cell => accepted(cell).flatMap(f => /o\/a\b/.test(f) ? [f.replace(/o\/a\b/g, 'o'), f.replace(/o\/a\b/g, 'a')] : /i\/e\b/.test(f) ? [f.replace(/i\/e\b/g, 'i'), f.replace(/i\/e\b/g, 'e')] : [f]).filter(usable);
let stareForms = null;
function conjugatedIndexFor(entries) {
  const forms = new Map(), attachable = new Map(), infinitives = new Map();
  for (const e of entries) {
    let c; try { c = conjugate(e.inf, { aux: e.aux, isc: e.isc }); } catch { continue; }
    add(infinitives, e.inf, e);
    for (const [tense, cells] of Object.entries(c.tenses)) if (Array.isArray(cells)) for (const cell of cells) for (const f of variants(cell)) { add(forms, f, e); if (tense === 'imperativo') add(attachable, f, e); }
    for (const [part, value] of Object.entries(c.nonFinite)) {
      if (part === 'participioPresente') continue;
      for (const f of variants(value)) {
        add(forms, f, e);
        if (part === 'participioPassato' && /o$/.test(f)) for (const end of ['a', 'i', 'e']) add(forms, f.slice(0, -1) + end, e);
        if (part === 'gerundio') { add(attachable, f, e); if (c.clitic && f.endsWith(c.clitic)) add(attachable, f.slice(0, -c.clitic.length), e); }
      }
    }
  }
  if (!stareForms) { const t = conjugate('stare', { aux: 'essere' }).tenses; stareForms = new Set([...t.presente, ...t.imperfetto].flatMap(accepted).map(keyOf)); }
  return { forms, attachable, infinitives, stare: stareForms };
}
// The whole dictionary, built on the first lookup that needs it: conjugating every verb costs a few hundred milliseconds.
const conjugatedIndex = index => index.conjugated ||= conjugatedIndexFor(index.verbEntries);

// ---------- resolution ----------
// English senses are memoised: the same dictionary strings are compared with every gloss.
// Contractions are spelt out, so a gloss "I do not understand" meets the entry "I don't understand".
const CONTRACTIONS = [[/\b(what|where|how|it|that|there|he|she|who)'s\b/g, '$1 is'], [/\blet's\b/g, 'let us'], [/\bcan't\b/g, 'cannot'], [/\bwon't\b/g, 'will not'], [/n't\b/g, ' not'], [/\bi'm\b/g, 'i am'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will']];
const senseCache = new Map();
function senses(s) {
  s = String(s ?? '');
  if (!senseCache.has(s)) {
    let text = s.toLocaleLowerCase('en').replace(/[’‘]/g, "'");
    for (const [pattern, spelt] of CONTRACTIONS) text = text.replace(pattern, spelt);
    senseCache.set(s, text.replace(/\([^)]*\)/g, ' ').replace(/[!?.…]+/g, ' ').split(/[;,/·]/).map(p => p.replace(/^\s*(?:to|the|a|an)\s+/, '').trim().replace(/\s+/g, ' ')).filter(Boolean));
  }
  return senseCache.get(s);
}
// The needle as a whole word or word sequence of the hay (senses are single-spaced).
const wordIn = (needle, hay) => hay === needle || hay.startsWith(needle + ' ') || hay.endsWith(' ' + needle) || hay.includes(' ' + needle + ' ');
function englishScore(gloss, e) {
  const want = senses(gloss.en), have = senses(e.en);
  if (have.some(h => want.includes(h))) return 2;
  if (/^\d+$/.test(String(gloss.en ?? '').trim()) && e.pos === 'num') return 2; // "uno" glossed as "1"
  if (have.some(h => want.some(w => wordIn(h, w) || wordIn(w, h)))) return 1;
  return 0;
}
// Several entries share the headword: the one whose English carries the gloss, then the lowest level, then file order (stable sort).
const pick = (list, gloss) => list.length === 1 ? list[0] : [...list].sort((a, b) => englishScore(gloss, b) - englishScore(gloss, a) || levelRank(a) - levelRank(b))[0];
// The verbs whose English carries the gloss (a positive score needs a shared token, so the token index is only a shortcut).
function englishVerbs(gloss, index) {
  const candidates = new Set();
  for (const t of new Set(senses(gloss.en).flatMap(s => s.split(' ')))) for (const i of index.verbsByToken.get(t) || []) candidates.add(i);
  return [...candidates].sort((a, b) => a - b).map(i => index.verbEntries[i]).filter(e => englishScore(gloss, e) > 0);
}
function glossKeys(it) {
  const full = keyOf(it);
  const stripped = full.replace(ARTICLE, '');
  return full ? [...new Set([full, stripped])] : [];
}
// "non" and the clitics that precede a finite form or an infinitive: "mi piacciono", "non parlare", "non mi piace", "l'ho visto",
// "me lo dica". A lone me/te/se/ce/ve is not one (se piove, se fossi), only the combined form before lo/la/li/le/ne.
const PROCLITICS = /^(?:non\s+)?(?:(?:me|te|se|ce|ve)\s+(?:lo|la|li|le|ne)\s+|(?:mi|ti|ci|vi|si|lo|la|li|le|gli|ne)\s+|l')?/;
const ENCLITICS = ['gliene', 'glielo', 'gliela', 'glieli', 'gliele', 'mene', 'melo', 'mela', 'meli', 'mele', 'tene', 'telo', 'tela', 'teli', 'tele', 'cene', 'celo', 'cela', 'celi', 'cele', 'vene', 'velo', 'vela', 'veli', 'vele', 'sene', 'selo', 'sela', 'seli', 'sele', 'gli', 'mi', 'ti', 'ci', 'vi', 'si', 'lo', 'la', 'li', 'le', 'ne'];
// The whole gloss ("non" and a proclitic aside) is one form of a dictionary verb: a paradigm cell such as "mi alzo", "ho mangiato",
// "sono andata" or "vada", a participle or gerund, stare + gerund ("sto parlando", "stava leggendo"), or an infinitive,
// gerund or imperative carrying an enclitic ("aiutarmi", "leggendolo", "guardalo", "dimmi"). Phrases with any other word
// ("vorrei visitare", "vengo da", "abito qui", "se piove") are constructions, not forms, and stay unresolved. Behind lo, la,
// le, li, gli or l' a single word is read as a clitic + verb ("lo vedo", "l'ascolto") only when the verb's English carries
// the gloss: "la conferma" and "lo scarico" name nouns, not confermare and scaricare.
const ARTICLE_LIKE = /^(?:(?:lo|la|le|li|gli)\s|l')/;
function conjugatedForm(key, conjugated, gloss) {
  const { forms, attachable, infinitives, stare } = conjugated;
  const lookup = (map, k) => { const list = map.get(k); return list?.length ? pick(list, gloss) : null; };
  const bare = key.replace(PROCLITICS, '');
  if (!bare) return null;
  const cell = lookup(forms, key) || (bare !== key ? lookup(forms, bare) : null);
  if (cell) return bare !== key && ARTICLE_LIKE.test(key) && !bare.includes(' ') && !englishScore(gloss, cell) ? null : cell;
  const words = bare.split(' ');
  if (words.length === 2 && stare.has(words[0])) return lookup(attachable, words[1]);
  if (words.length !== 1) return null;
  const { base, clitic } = splitClitic(bare);
  const infinitive = clitic ? lookup(infinitives, keyOf(base)) : null;
  if (infinitive) return infinitive;
  for (const enclitic of ENCLITICS) {
    if (!bare.endsWith(enclitic) || bare.length <= enclitic.length) continue;
    const host = bare.slice(0, -enclitic.length);
    // dimmi, fammi, vattene: the apostrophe imperative doubles the clitic's first consonant
    const hit = lookup(attachable, host) || (host.endsWith(enclitic[0]) ? lookup(attachable, host.slice(0, -1) + "'") : null);
    if (hit) return hit;
  }
  return null;
}
function resolveGloss(gloss, index, verbForms, depth = 0) {
  if (!gloss || typeof gloss !== 'object') return null;
  const keys = glossKeys(gloss.it);
  const found = map => { for (const key of keys) { const list = map.get(key); if (list?.length) return pick(list, gloss); } return null; };
  const byId = usable(gloss.entryId) ? index.byId.get(gloss.entryId) : null;
  const word = found(index.headwords) || byId || found(index.plurals) || found(index.fems) || found(index.forms);
  // A word whose English carries nothing of the gloss yields to a form of a verb whose English does: "abiti · you live"
  // is abitare, not the plural of abito. Only such verbs are conjugated for that, so the words (and the boards) come out
  // the same with or without the whole-dictionary index. A gloss no word rule claims is looked up across every verb.
  let entry = word;
  if (keys.length && (!word || !englishScore(gloss, word))) {
    const verb = word ? conjugatedForm(keys[0], conjugatedIndexFor(englishVerbs(gloss, index)), gloss) : verbForms ? conjugatedForm(keys[0], conjugatedIndex(index), gloss) : null;
    if (verb) entry = verb;
  }
  if (entry || depth) return entry || null;
  // "il collega / la collega": the first alternative stands for the gloss.
  const alternative = String(gloss.it ?? '').split(/\s*\/\s*/)[0];
  return alternative && alternative !== gloss.it ? resolveGloss({ ...gloss, it: alternative }, index, verbForms, 1) : null;
}

/**
 * One record per gloss of the lesson's first `words` step that names a dictionary entry; verbs come back with
 * entry.kind === 'verb'. A gloss resolves by exact headword, then its `entryId`, then as a plural, feminine, adjective or
 * closed-class form, then as a conjugated form of a verb. `verbForms: false` skips that last step (and the cost of
 * conjugating every verb) for callers that only need the words, such as the board synthesis.
 */
export function resolveLessonWords(lesson, { vocab = [], verbs = [], verbForms = true } = {}) {
  const step = (lesson?.steps || []).find(s => s?.kind === 'words');
  if (!step || !Array.isArray(step.words)) return [];
  const index = dictionaryIndex(vocab, verbs), out = [];
  for (const gloss of step.words) { const entry = resolveGloss(gloss, index, verbForms !== false); if (entry) out.push({ gloss, entry }); }
  return out;
}

// ---------- synthesis ----------
// buildLesson is the authority for objective ids and the content version; only the ids are kept per entry.
const objectiveCache = new Map();
function objectives(entry) {
  if (!objectiveCache.has(entry.id)) {
    const plan = buildLesson(entry), targets = new Map(), bySkill = {};
    for (const chapter of plan?.chapters || []) for (const group of chapter.groups) for (const t of group.targets) targets.set(t.id, t);
    for (const slot of plan?.wordLesson?.slots || []) { const t = targets.get(slot.targetId); if (t && t.available !== false && !bySkill[t.skill]) bySkill[t.skill] = t.id; }
    objectiveCache.set(entry.id, { version: plan?.version ?? null, bySkill });
  }
  return objectiveCache.get(entry.id);
}
const firstSense = s => String(s ?? '').split(';')[0].trim();
const shortGloss = s => String(s ?? '').split(' · ')[0].trim();
const firstArticle = a => String(a || '').split('/')[0];
const speakable = (a, w) => a ? (a.endsWith("'") ? a + w : a + ' ' + w) : w;

// Words that reach the boards: distinct entries in gloss order, both board texts unique on the board.
function boardWords(resolved, excluded) {
  const words = [], seen = new Set();
  for (const r of resolved || []) if (r?.entry && kindOf(r.entry) === 'word' && !seen.has(r.entry.id)) { seen.add(r.entry.id); words.push(r); }
  if (words.length < MIN_WORDS) return [];
  const out = [], lefts = new Set(), rights = new Set();
  for (const { gloss, entry } of words) {
    const o = objectives(entry);
    if (!o.bySkill.meaning || !o.bySkill.recall || excluded.has(entry.id)) continue;
    const it = entry.pos === 'noun' ? withArticle(entry, isPluralOnly(entry)) : entry.it;
    if (!usable(it) || lefts.has(norm(it))) continue;
    let en = firstSense(entry.en);
    if (!en || rights.has(en.toLocaleLowerCase('en'))) en = shortGloss(gloss.en);
    if (!en || rights.has(en.toLocaleLowerCase('en'))) continue;
    lefts.add(norm(it)); rights.add(en.toLocaleLowerCase('en'));
    out.push({ entry, it, en, objectives: o });
  }
  return out;
}
// Near-equal rounds of at most six, in order (seven words become 4 + 3, never 6 + 1).
function rounds(items) {
  const count = Math.ceil(items.length / MAX_PAIRS), size = Math.ceil(items.length / count), out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
// Every available article/plural slot of a noun becomes a row; a noun whose row cannot be formed (null) can never be credited.
function formsRows(words) {
  const rows = [];
  for (const { entry, objectives: o } of words) {
    if (entry.pos !== 'noun' || !entry.g) continue;
    const onlyPlural = isPluralOnly(entry), base = { entryId: entry.id, contentVersion: o.version };
    const row = (skill, plural) => {
      const form = plural ? entry.pl : entry.it, a = firstArticle(article(entry, plural));
      return usable(form) && a ? { left: a, right: form, ...base, skill, objectiveId: o.bySkill[skill], form: plural ? 'plural' : 'singular', say: speakable(a, form) } : null;
    };
    if (o.bySkill.article) rows.push(row('article', onlyPlural));
    if (o.bySkill.plural) rows.push(row('plural', true));
  }
  return rows;
}
// A round is a set of rows with distinct articles and distinct forms, i.e. a matching in the article×form multigraph.
// Such rows split into R balanced rounds exactly when R is at least the largest multiplicity of one article or form,
// and rounds of two to six rows need 2R ≤ N ≤ 6R.
const multiplicity = rows => { const n = new Map(); for (const r of rows) for (const k of [`a:${r.left}`, `f:${norm(r.right)}`]) n.set(k, (n.get(k) || 0) + 1); return Math.max(0, ...n.values()); };
const roundsNeeded = rows => Math.max(Math.ceil(rows.length / MAX_PAIRS), multiplicity(rows));
const feasible = rows => !rows.length || (rows.length >= 2 && rows.length >= 2 * roundsNeeded(rows));
function packForms(rows) {
  if (!rows.length) return [];
  if (!feasible(rows)) return null;
  const N = rows.length, R = roundsNeeded(rows), clash = (round, r) => round.some(y => y.left === r.left || norm(y.right) === norm(r.right));
  // Rows go in word order, singular before plural; a plural row prefers its singular's round or a later one.
  const search = (sizes, min) => {
    const out = sizes.map(() => []), placed = new Map();
    const go = i => {
      if (i === N) return out.every(x => x.length >= min);
      const r = rows[i], start = r.skill === 'plural' ? placed.get(r.entryId) ?? 0 : 0;
      for (let k = 0; k < R; k++) {
        const at = (start + k) % R, round = out[at];
        if (round.length >= sizes[at] || clash(round, r)) continue;
        round.push(r); if (r.skill === 'article') placed.set(r.entryId, at);
        if (go(i + 1)) return true;
        round.pop(); if (r.skill === 'article') placed.delete(r.entryId);
      }
      return false;
    };
    return go(0) ? out : null;
  };
  return search(Array.from({ length: R }, (_, i) => Math.floor(N / R) + (i < N % R ? 1 : 0)), Math.floor(N / R)) || search(Array(R).fill(MAX_PAIRS), 2);
}
// The noun to leave out when the rows cannot all be placed: the one whose removal keeps the most rows while restoring
// feasibility (the later word on a tie); failing that, the last noun on a most-repeated article or form.
function exclusion(rows, words) {
  const nouns = words.filter(w => rows.some(r => r.entryId === w.entry.id)), without = w => rows.filter(r => r.entryId !== w.entry.id);
  let best = null;
  for (const w of nouns) { const rest = without(w); if (feasible(rest) && (!best || rest.length >= without(best).length)) best = w; }
  if (best) return best;
  const n = multiplicity(rows), count = new Map();
  for (const r of rows) for (const k of [`a:${r.left}`, `f:${norm(r.right)}`]) count.set(k, (count.get(k) || 0) + 1);
  return nouns.filter(w => rows.some(r => r.entryId === w.entry.id && (count.get(`a:${r.left}`) === n || count.get(`f:${norm(r.right)}`) === n))).at(-1) || nouns.at(-1);
}
const step = (lesson, board, round, pairs) => ({ id: `${lesson.id}.words-check.${board}.${round}`, kind: 'words-check', synthesized: true, format: 'match', board, round, title: TITLE, prompt: PROMPTS[board], pairs, entryIds: [...new Set(pairs.map(p => p.entryId))] });

/** Steps plus the ids of nouns left off every board because a required forms row could not be placed. */
export function wordsCheckPlan(lesson, resolved) {
  const excluded = new Set();
  if (!lesson?.id) return { steps: [], excluded: [] };
  let words, forms;
  for (;;) {
    words = boardWords(resolved, excluded);
    if (words.length < 2) return { steps: [], excluded: [...excluded] };
    const rows = formsRows(words);
    if (rows.includes(null)) { excluded.add(words.find(w => formsRows([w]).includes(null)).entry.id); continue; }
    forms = packForms(rows);
    if (forms) break;
    excluded.add(exclusion(rows, words).entry.id);
  }
  const pair = (w, skill, left, right) => ({ left, right, entryId: w.entry.id, skill, objectiveId: w.objectives.bySkill[skill], contentVersion: w.objectives.version, say: w.it });
  const steps = [];
  rounds(words).forEach((round, i) => steps.push(step(lesson, 'meaning', i + 1, round.map(w => pair(w, 'meaning', w.it, w.en)))));
  rounds(words).forEach((round, i) => steps.push(step(lesson, 'recall', i + 1, round.map(w => pair(w, 'recall', w.en, w.it)))));
  forms.forEach((round, i) => steps.push(step(lesson, 'forms', i + 1, round)));
  return { steps, excluded: [...excluded] };
}

/** Synthesised steps for a lesson, in order: meaning rounds, recall rounds, forms rounds. Empty below three resolved words. */
export const wordsCheckSteps = (lesson, resolved) => wordsCheckPlan(lesson, resolved).steps;

/** Entry ids credited by this lesson's boards, in first-appearance order; [] when the lesson has none. */
export function lessonWordIds(lesson) {
  const ids = [];
  for (const s of lesson?.steps || []) if (s?.kind === 'words-check') for (const id of s.entryIds || []) if (!ids.includes(id)) ids.push(id);
  return ids;
}
