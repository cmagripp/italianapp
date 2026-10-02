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
// Closed-class determiners record their agreement forms in the note; the schema's `forms` field belongs to adjectives.
const DETERMINER_FORMS = new Map(Object.entries({
  mio: ['mia', 'miei', 'mie'], tuo: ['tua', 'tuoi', 'tue'], suo: ['sua', 'suoi', 'sue'], nostro: ['nostra', 'nostri', 'nostre'], vostro: ['vostra', 'vostri', 'vostre'],
  questo: ['questa', 'questi', 'queste', "quest'"], quello: ['quel', 'quella', 'quelli', 'quelle', 'quei', 'quegli', "quell'"], tutto: ['tutta', 'tutti', 'tutte'], altro: ['altra', 'altri', 'altre'],
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
    for (const f of DETERMINER_FORMS.get(norm(e.it)) || []) add(forms, f, e);
  }
  const index = { verbs, headwords, plurals, fems, forms, byId, verbEntries, conjugated: null };
  indexes.set(vocab, index);
  return index;
}
// Conjugated forms of every dictionary verb, keyed by the whole form ("mi alzo", "ho mangiato", "sono andata", "va'"):
// each cell of the paradigm with its alternatives and agreement variants, the non-finite forms (present participle
// aside), the participle's agreement forms and, for enclisis, the gerund and imperative forms. Built on the first
// conjugated-form lookup only: conjugating every verb costs a few hundred milliseconds and the boards never need a verb.
const variants = cell => accepted(cell).flatMap(f => /o\/a\b/.test(f) ? [f.replace(/o\/a\b/g, 'o'), f.replace(/o\/a\b/g, 'a')] : /i\/e\b/.test(f) ? [f.replace(/i\/e\b/g, 'i'), f.replace(/i\/e\b/g, 'e')] : [f]).filter(usable);
function conjugatedIndex(index) {
  if (index.conjugated) return index.conjugated;
  const forms = new Map(), attachable = new Map();
  for (const e of index.verbEntries) {
    let c; try { c = conjugate(e.inf, { aux: e.aux, isc: e.isc }); } catch { continue; }
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
  const stare = conjugate('stare', { aux: 'essere' }).tenses;
  index.conjugated = { forms, attachable, stare: new Set([...stare.presente, ...stare.imperfetto].flatMap(accepted).map(keyOf)) };
  return index.conjugated;
}

// ---------- resolution ----------
const senses = s => String(s ?? '').toLocaleLowerCase('en').replace(/\([^)]*\)/g, ' ').replace(/[!?.…]+/g, ' ').split(/[;,/·]/).map(p => p.replace(/^\s*(?:to|the|a|an)\s+/, '').trim()).filter(Boolean);
const wordIn = (needle, hay) => new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(hay);
function englishScore(gloss, e) {
  const want = senses(gloss.en), have = senses(e.en);
  if (have.some(h => want.includes(h))) return 2;
  if (/^\d+$/.test(String(gloss.en ?? '').trim()) && e.pos === 'num') return 2; // "uno" glossed as "1"
  if (have.some(h => want.some(w => wordIn(h, w) || wordIn(w, h)))) return 1;
  return 0;
}
// Several entries share the headword: the one whose English carries the gloss, then the lowest level, then file order (stable sort).
const pick = (list, gloss) => list.length === 1 ? list[0] : [...list].sort((a, b) => englishScore(gloss, b) - englishScore(gloss, a) || levelRank(a) - levelRank(b))[0];
function glossKeys(it) {
  const full = keyOf(it);
  const stripped = full.replace(ARTICLE, '');
  return full ? [...new Set([full, stripped])] : [];
}
// Clitics and "non" that precede a finite form or an infinitive: "mi piacciono", "non parlare", "non mi piace", "lo vedo".
const PROCLITICS = /^(?:non\s+)?(?:(?:mi|ti|ci|vi|si|lo|la|li|le|gli|ne|me|te|se|ce|ve)\s+){0,2}/;
const ENCLITICS = ['gliene', 'glielo', 'gliela', 'glieli', 'gliele', 'mene', 'melo', 'mela', 'meli', 'mele', 'tene', 'telo', 'tela', 'teli', 'tele', 'cene', 'celo', 'cela', 'celi', 'cele', 'vene', 'velo', 'vela', 'veli', 'vele', 'sene', 'selo', 'sela', 'seli', 'sele', 'gli', 'mi', 'ti', 'ci', 'vi', 'si', 'lo', 'la', 'li', 'le', 'ne'];
// The whole gloss (clitics and "non" aside) is one form of a dictionary verb: a paradigm cell such as "mi alzo", "ho mangiato",
// "sono andata" or "vada", a participle or gerund, stare + gerund ("sto parlando", "stava leggendo"), or an infinitive,
// gerund or imperative carrying an enclitic ("aiutarmi", "leggendolo", "guardalo", "dimmi"). Phrases with any other word
// ("vorrei visitare", "vengo da", "abito qui") are constructions, not forms, and stay unresolved.
function conjugatedForm(keys, index, gloss) {
  const { forms, attachable, stare } = conjugatedIndex(index);
  const lookup = (map, key) => { const list = map.get(key); return list?.length ? pick(list, gloss) : null; };
  for (const key of keys) {
    const bare = key.replace(PROCLITICS, '');
    const cell = lookup(forms, key) || (bare && bare !== key ? lookup(forms, bare) : null);
    if (cell) return cell;
    const words = bare.split(' ');
    if (words.length === 2 && stare.has(words[0])) { const gerund = lookup(attachable, words[1]); if (gerund) return gerund; }
    if (words.length !== 1) continue;
    const { base, clitic } = splitClitic(bare);
    const infinitives = clitic ? (index.headwords.get(keyOf(base)) || []).filter(e => e.kind === 'verb') : [];
    if (infinitives.length) return pick(infinitives, gloss);
    for (const enclitic of ENCLITICS) {
      if (!bare.endsWith(enclitic) || bare.length <= enclitic.length) continue;
      const host = bare.slice(0, -enclitic.length);
      // dimmi, fammi, vattene: the apostrophe imperative doubles the clitic's first consonant
      const hit = lookup(attachable, host) || (host.endsWith(enclitic[0]) ? lookup(attachable, host.slice(0, -1) + "'") : null);
      if (hit) return hit;
    }
  }
  return null;
}
function resolveGloss(gloss, index, verbForms, depth = 0) {
  if (!gloss || typeof gloss !== 'object') return null;
  const keys = glossKeys(gloss.it);
  const found = map => { for (const key of keys) { const list = map.get(key); if (list?.length) return pick(list, gloss); } return null; };
  const byId = usable(gloss.entryId) ? index.byId.get(gloss.entryId) : null;
  const entry = found(index.headwords) || byId || found(index.plurals) || found(index.fems) || found(index.forms) || (verbForms && keys.length ? conjugatedForm(keys, index, gloss) : null);
  if (entry || depth) return entry || null;
  // "il collega / la collega": the first alternative stands for the gloss.
  const alternative = String(gloss.it ?? '').split(/\s*\/\s*/)[0];
  return alternative && alternative !== gloss.it ? resolveGloss({ ...gloss, it: alternative }, index, verbForms, 1) : null;
}

/**
 * One record per gloss of the lesson's first `words` step that names a dictionary entry; verbs come back with
 * entry.kind === 'verb'. A gloss resolves by exact headword, then its `entryId`, then as a plural, feminine, adjective or
 * determiner form, then as a conjugated form of a verb. `verbForms: false` skips that last step (and the cost of
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
