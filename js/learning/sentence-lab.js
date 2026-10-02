// Pure engine for the sentence workshop (Officina delle frasi): lesson sessions, grading of the five activity kinds,
// free-entry resolution through the dictionary, sentence composition and path progress. No DOM, store or network:
// persistence and rendering belong to the caller (js/views/labFrasi*.js). Node-importable for tools/test-sentence-lab.mjs.
// Contract: docs/SENTENCE-LAB-CONTRACT.md.
import { conjugate, primary, MISSING, PERSONS, TENSE_BY_KEY } from '../conjugator.js';
import { withArticle, hasPluralForm, isPluralOnly, fold, POS_NAME } from '../data.js';
import { createSentenceLookup } from './sentence-lookup.js';

export const LAB_STAGES = ['presente', 'passato', 'futuro', 'strutture'];
export const LAB_TENSES = ['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale', 'misto'];
export const LAB_KINDS = ['model', 'order', 'cloze', 'dialogue', 'build'];
export const LAB_ROLES = ['subject', 'verb', 'object', 'extra', 'link'];
export const SLOT_POS = ['adj', 'noun', 'verb', 'adv', 'expr'];
export const SLOT_AGREE = ['speaker', 'm-sg', 'f-sg', 'm-pl', 'f-pl'];
export const SLOT_NUMBER = ['sg', 'pl'];
export const SLOT_ARTICLE = ['definite', 'indefinite', 'none'];
// A fixed blank (and an order activity) allows this many wrong tries before the answer is shown and the activity continues.
export const MAX_TRIES = 2;

// Lesson tense -> conjugator tense key. The conjugator names the compound past "passatoProssimo" and the simple future
// "futuro", so the keys coincide; "misto" lessons compose in the present.
const TENSE_KEY = { presente: 'presente', passatoProssimo: 'passatoProssimo', imperfetto: 'imperfetto', futuro: 'futuro', condizionale: 'condizionale', misto: 'presente' };
export const tenseKey = tense => TENSE_KEY[tense] || 'presente';
const tenseLabel = key => TENSE_BY_KEY[key]?.name || key;

// Grading equality: case, trailing punctuation, curly apostrophes and the space after an elided article are ignored.
export const normalizeLab = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('it')
  .replace(/[’‘]/g, "'").replace(/\s*'\s*/g, "'").trim().replace(/[.!?,;:…]+$/g, '').trim().replace(/\s+/g, ' ');

const BLANK = /_{2,}/g;
export const blankCount = template => (String(template ?? '').match(BLANK) || []).length;
export function fillTemplate(template, values = []) {
  let i = 0;
  return String(template ?? '').replace(BLANK, match => { const v = values[i++]; return v == null || v === '' ? match : String(v); });
}

const clone = value => JSON.parse(JSON.stringify(value));
const unique = values => [...new Set(values)];
const capitalize = s => (s ? s[0].toLocaleUpperCase('it') + s.slice(1) : s);
const isVerbEntry = e => !!e && (e.kind === 'verb' || e.pos === 'verb' || (typeof e.inf === 'string' && !!e.inf.trim()));
const entryPos = e => (isVerbEntry(e) ? 'verb' : e?.pos || 'word');
const fitsPos = (e, pos) => (pos === 'verb' ? isVerbEntry(e) : !isVerbEntry(e) && e?.pos === pos);
const headwordOf = e => (isVerbEntry(e) ? e.inf : e?.it) || '';
const withAn = name => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
const posPhrase = pos => withAn(POS_NAME[pos] || pos || 'word');
// "andato/a" -> andato | andata, "andati/e" -> andati | andate
const agreeForm = (form, gender) => String(form).replace(/o\/a\b/g, gender === 'f' ? 'a' : 'o').replace(/i\/e\b/g, gender === 'f' ? 'e' : 'i');
const wrapWith = (wrap, form) => (typeof wrap === 'string' && wrap.trim() ? (wrap.includes('{}') ? wrap.replace('{}', form) : `${wrap.trim()} ${form}`) : form);
const endSentence = s => (/[.!?…]$/.test(s) ? s : s + '.');

function safeConjugate(inf, meta = {}) {
  if (typeof inf !== 'string' || !inf.trim()) return null;
  try { return conjugate(inf, { aux: meta.aux, isc: meta.isc }); } catch { return null; }
}

// ---------------------------------------------------------------- sessions ----------------------------------------------------------------

const firstYouTurn = (turns, from = 0) => { let i = from; while (i < turns.length && turns[i]?.speaker !== 'you') i++; return i; };

function dialogueFinal(state) {
  const outcomes = state.turnResults.map(r => r.outcome);
  const outcome = outcomes.some(o => o === 'incorrect') ? 'incorrect' : outcomes.some(o => o === 'accepted') ? 'accepted' : 'correct';
  return { ok: outcome !== 'incorrect', outcome, answer: null, explanation: '', sentence: null, en: '', turns: state.turnResults.slice(), complete: true, revealed: state.turnResults.some(r => r.revealed) };
}

function initState(activity) {
  const base = { kind: activity.kind, misses: 0, attempts: [], last: null, result: null, revealed: false, done: false };
  if (activity.kind === 'model') return { ...base, done: true };
  if (activity.kind === 'dialogue') {
    const turns = Array.isArray(activity.turns) ? activity.turns : [], turnIndex = firstYouTurn(turns);
    const state = { ...base, turnIndex, filled: {}, turnResults: [], complete: turnIndex >= turns.length };
    if (state.complete) { state.done = true; state.result = dialogueFinal(state); }
    return state;
  }
  return base;
}

const stepDone = state => !!state && (state.kind === 'model' || state.kind === 'dialogue' ? !!state.done : !!state.result);

export function createLabSession(lesson, { now = Date.now() } = {}) {
  const activities = Array.isArray(lesson?.activities) ? lesson.activities : [];
  return {
    id: `lab:frasi:${lesson?.id}:${now}`, version: 1, lessonId: lesson?.id ?? null, index: 0,
    phase: activities.length ? 'activity' : 'complete', state: activities.length ? initState(activities[0]) : null,
    done: [], sentences: [], history: [], createdAt: now, updatedAt: now,
  };
}

// A saved session fits the lesson it was created for: same lesson, a reachable activity, a state of the activity's kind.
export function compatibleLabSession(lesson, session) {
  if (!session || session.version !== 1 || session.lessonId !== lesson?.id) return false;
  const activities = Array.isArray(lesson.activities) ? lesson.activities : [];
  if (!Number.isInteger(session.index) || session.index < 0 || !['activity', 'complete'].includes(session.phase)) return false;
  if (!Array.isArray(session.done) || !Array.isArray(session.sentences) || !Array.isArray(session.history)) return false;
  if (session.phase === 'complete') return session.index >= activities.length || session.index === activities.length;
  const activity = activities[session.index];
  return !!activity && !!session.state && session.state.kind === activity.kind
    && (activity.kind !== 'dialogue' || (Number.isInteger(session.state.turnIndex) && session.state.turnIndex >= 0 && session.state.turnIndex <= activity.turns.length));
}

function dialogueView(activity, state) {
  const turns = Array.isArray(activity.turns) ? activity.turns : [];
  const shown = [];
  for (let i = 0; i < Math.min(state.turnIndex, turns.length); i++) {
    const turn = turns[i];
    if (turn.speaker === 'you') {
      const f = state.filled[i];
      shown.push({ index: i, speaker: 'you', it: f?.it ?? turn.template, en: f?.en ?? turn.en ?? '', done: !!f, outcome: f?.outcome ?? null, revealed: !!f?.revealed, texts: f?.texts ?? [] });
      if (f?.reaction) shown.push({ index: i, speaker: 'partner', reaction: true, it: f.reaction.it, en: f.reaction.en ?? '' });
    } else shown.push({ index: i, speaker: 'partner', it: turn.it, en: turn.en ?? '' });
  }
  const turn = turns[state.turnIndex];
  const current = turn?.speaker === 'you'
    ? { index: state.turnIndex, speaker: 'you', pending: true, template: turn.template, en: turn.en ?? '', blanks: turn.blanks || [], hint: turn.hint || '' }
    : null;
  if (current) shown.push(current);
  return { ...state, partner: activity.partner || '', turns: shown, current, remaining: Math.max(0, turns.length - state.turnIndex) };
}

export function currentLabStep(lesson, session) {
  if (!lesson || !session) return null;
  const activities = Array.isArray(lesson.activities) ? lesson.activities : [];
  const activity = activities[session.index] || null;
  const base = { index: session.index, total: activities.length, lessonId: lesson.id };
  if (session.phase === 'complete' || !activity) return { ...base, kind: 'complete', activity: null, state: null, complete: true, done: true, result: null };
  const state = session.state && session.state.kind === activity.kind ? session.state : (session.state = initState(activity));
  const view = activity.kind === 'dialogue' ? dialogueView(activity, state) : { ...state };
  return { ...base, kind: activity.kind, activity, state: view, complete: false, done: stepDone(state), result: state.result || null, last: state.last || null };
}

export function labSessionProgress(lesson, session) {
  const total = Array.isArray(lesson?.activities) ? lesson.activities.length : 0;
  const complete = session?.phase === 'complete';
  return { index: session?.index ?? 0, total, phase: session?.phase ?? 'activity', complete, percent: complete ? 100 : Math.min(99, Math.round(100 * (session?.index ?? 0) / Math.max(1, total))) };
}

// ---------------------------------------------------------------- grading ----------------------------------------------------------------

function recordAttempt(state, result) { state.attempts = [...state.attempts, result].slice(-12); state.last = result; return result; }
function finish(state, result) { state.result = result; state.done = true; return recordAttempt(state, result); }

const expectedValue = blank => blank?.accept?.[0] ?? blank?.options?.[0] ?? '';

// A typed value may repeat the wrap ("sono stanco" for wrap "sono {}"): the wrapped part is removed before resolving.
function unwrap(text, wrap) {
  if (typeof wrap !== 'string' || !wrap.includes('{}')) return text;
  const [pre, post] = wrap.split('{}').map(s => s.trim());
  let t = String(text).trim();
  const low = () => t.toLocaleLowerCase('it');
  if (pre && low().startsWith(pre.toLocaleLowerCase('it') + (/['’]$/.test(pre) ? '' : ' '))) t = t.slice(pre.length).trim();
  if (post && low().endsWith(' ' + post.toLocaleLowerCase('it'))) t = t.slice(0, -post.length).trim();
  return t;
}

function freeEntryExplanation(resolution, blank) {
  switch (resolution?.status) {
    case 'unfit': return resolution.reason || blank?.explanation || 'That word does not fit this blank.';
    case 'choose': return 'Several words match: choose one of them.';
    case 'unknown': return `That word is not in the dictionary yet.${resolution.suggestions?.length ? ` Did you mean ${resolution.suggestions.join(', ')}?` : ''}`;
    default: return blank?.explanation || 'Fill the blank.';
  }
}

function gradeBlank(blank, value, ctx) {
  const text = String(value ?? '').trim();
  const accept = Array.isArray(blank?.accept) ? blank.accept : [];
  const wrap = blank?.slot?.wrap;
  const key = normalizeLab(text), wrappedKey = typeof wrap === 'string' && text ? normalizeLab(wrapWith(wrap, text)) : null;
  const hit = text ? accept.find(a => { const n = normalizeLab(a); return n === key || n === wrappedKey; }) : undefined;
  if (hit !== undefined) return { outcome: 'correct', given: text, filled: hit, entryId: null, explanation: '' };
  // An authored option or bank entry that is not accepted is a wrong choice, never a free entry (it may well be a
  // dictionary word of the slot's kind). Only values outside the authored lists are resolved through the dictionary.
  const authored = [...(Array.isArray(blank?.options) ? blank.options : []), ...(Array.isArray(blank?.bank) ? blank.bank : [])];
  if (text && authored.some(o => { const n = normalizeLab(o); return n === key || n === wrappedKey; })) {
    return { outcome: 'incorrect', given: text, filled: null, entryId: null, explanation: blank?.explanation || 'Not quite. Try again.' };
  }
  if (blank?.free === true && blank.slot && text) {
    const resolution = resolveFreeEntry(unwrap(text, wrap), blank.slot, ctx);
    if (resolution.status === 'ok' || resolution.status === 'learn') {
      // A typed alternative form ("debbo" for a blank that accepts "devo") resolves to the primary form: when that is an
      // accepted value the blank is right, not merely accepted.
      const resolvedKey = normalizeLab(resolution.display), formKey = normalizeLab(resolution.form);
      const same = accept.find(a => { const n = normalizeLab(a); return n === resolvedKey || n === formKey; });
      if (same !== undefined) return { outcome: 'correct', given: text, filled: same, entryId: resolution.entryId, form: resolution.form, explanation: '' };
      return { outcome: 'accepted', given: text, filled: resolution.display, entryId: resolution.entryId, form: resolution.form, en: resolution.en, status: resolution.status, explanation: '' };
    }
    return { outcome: 'incorrect', given: text, filled: null, entryId: null, explanation: freeEntryExplanation(resolution, blank), resolution };
  }
  return { outcome: 'incorrect', given: text, filled: null, entryId: null, explanation: blank?.explanation || (text ? 'Not quite. Try again.' : 'Fill the blank.') };
}

// Shared by cloze activities and dialogue turns: grade every blank, then finish or count a miss (reveal after MAX_TRIES).
function gradeBlanks(template, blanks, en, state, values, ctx) {
  const graded = blanks.map((blank, i) => gradeBlank(blank, values[i], ctx));
  const expected = blanks.map(expectedValue);
  const answer = fillTemplate(template, expected);
  const base = { answer, en: en || '', misses: state.misses, revealed: false };
  if (!graded.some(g => g.outcome === 'incorrect')) {
    const outcome = graded.every(g => g.outcome === 'correct') ? 'correct' : 'accepted';
    return { final: true, result: { ...base, ok: true, outcome, explanation: '', sentence: fillTemplate(template, graded.map(g => g.filled)), blanks: graded } };
  }
  state.misses++;
  const explanation = graded.find(g => g.outcome === 'incorrect').explanation;
  if (state.misses >= MAX_TRIES) {
    state.revealed = true;
    const filled = graded.map((g, i) => (g.outcome === 'incorrect' ? { ...g, filled: expected[i], revealed: true } : g));
    return { final: true, result: { ...base, ok: false, outcome: 'incorrect', explanation, sentence: fillTemplate(template, filled.map(g => g.filled)), blanks: filled, misses: state.misses, revealed: true } };
  }
  return { final: false, result: { ...base, ok: false, outcome: 'incorrect', explanation, sentence: null, blanks: graded, misses: state.misses } };
}

function answerOrder(activity, state, value) {
  const given = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  const right = [activity.answer, ...(Array.isArray(activity.accepted) ? activity.accepted : [])].some(a => normalizeLab(a) === normalizeLab(given));
  const base = { answer: activity.answer, given, en: activity.en || '', misses: state.misses, revealed: false };
  if (right) return finish(state, { ...base, ok: true, outcome: 'correct', explanation: '', sentence: given.trim() });
  state.misses++;
  const miss = { ...base, ok: false, outcome: 'incorrect', explanation: activity.explanation || '', sentence: null, misses: state.misses };
  if (state.misses >= MAX_TRIES) { state.revealed = true; return finish(state, { ...miss, revealed: true, sentence: activity.answer }); }
  return recordAttempt(state, miss);
}

function answerCloze(activity, state, value, ctx) {
  const values = Array.isArray(value) ? value : [value];
  const { final, result } = gradeBlanks(activity.template, activity.blanks || [], activity.en, state, values, ctx);
  return final ? finish(state, result) : recordAttempt(state, result);
}

function pickReaction(turn, text) {
  const reactions = Array.isArray(turn.reactions) ? turn.reactions : [];
  const key = normalizeLab(text);
  const match = reactions.find(r => (Array.isArray(r.when) ? r.when.some(w => normalizeLab(w) === key) : typeof r.when === 'string' && r.when !== '*' && normalizeLab(r.when) === key))
    || reactions.find(r => r.when === '*');
  return match ? { it: match.it, en: match.en ?? '' } : null;
}

function answerDialogue(activity, state, value, ctx) {
  const turns = Array.isArray(activity.turns) ? activity.turns : [];
  const turnIndex = state.turnIndex, turn = turns[turnIndex];
  if (!turn || turn.speaker !== 'you') {
    state.complete = true;
    return finish(state, dialogueFinal(state));
  }
  const values = Array.isArray(value) ? value : [value];
  const { final, result } = gradeBlanks(turn.template, turn.blanks || [], turn.en, state, values, ctx);
  if (!final) return recordAttempt(state, { ...result, turnIndex, reaction: null, complete: false });
  const texts = result.blanks.map(g => g.filled);
  const reaction = pickReaction(turn, texts[0]);
  const turnResult = { ...result, turnIndex, reaction, complete: false };
  state.filled[turnIndex] = {
    values: values.map(v => String(v ?? '')), texts, it: result.sentence, en: turn.en || '', reaction,
    outcome: result.outcome, revealed: !!result.revealed, entryIds: result.blanks.map(g => g.entryId).filter(Boolean),
  };
  state.turnResults = [...state.turnResults, turnResult];
  state.misses = 0; state.revealed = false;
  state.turnIndex = firstYouTurn(turns, turnIndex + 1);
  if (state.turnIndex >= turns.length) {
    turnResult.complete = true;
    state.complete = true; state.done = true; state.result = dialogueFinal(state);
  }
  return recordAttempt(state, turnResult);
}

// The build conjugates in the activity's own tense (a "misto" lesson still carries a tense on its build), never the lesson's.
function answerBuild(lesson, activity, state, value, ctx, session, now) {
  const composed = composeBuild(activity, value, ctx);
  if (!composed.ok) return recordAttempt(state, { ok: false, outcome: 'incorrect', answer: null, explanation: composed.reason, sentence: null, en: null, misses: state.misses, revealed: false });
  session.sentences = [...session.sentences, { it: composed.it, en: composed.en, lessonId: lesson?.id ?? null, at: now }];
  return finish(state, { ok: true, outcome: 'accepted', answer: composed.it, explanation: '', sentence: composed.it, en: composed.en, parts: composed.parts, misses: state.misses, revealed: false });
}

// order: string | tokens[]; cloze: [blank values]; dialogue: [blank values of the current "you" turn]; build: { subject, verb, object, extra }.
// Idempotent once the activity has its final result (an incorrect try on a fixed blank is not final until MAX_TRIES).
export function answerLab(lesson, session, value, ctx = {}) {
  const activities = Array.isArray(lesson?.activities) ? lesson.activities : [];
  const activity = session ? activities[session.index] : null;
  if (!session || session.phase !== 'activity' || !activity) return { session, result: null };
  const state = session.state && session.state.kind === activity.kind ? session.state : (session.state = initState(activity));
  if (state.result) return { session, result: state.result };
  const now = Number.isFinite(ctx?.now) ? ctx.now : Date.now();
  let result;
  switch (activity.kind) {
    case 'order': result = answerOrder(activity, state, value); break;
    case 'cloze': result = answerCloze(activity, state, value, ctx); break;
    case 'dialogue': result = answerDialogue(activity, state, value, ctx); break;
    case 'build': result = answerBuild(lesson, activity, state, value, ctx, session, now); break;
    default: result = finish(state, { ok: true, outcome: 'accepted', answer: null, explanation: '', sentence: null, en: '' });
  }
  session.updatedAt = now;
  return { session, result };
}

// Moves to the next activity once the current one is done; the lesson is complete after the last activity (the build).
export function advanceLab(lesson, session, { now = Date.now() } = {}) {
  if (!session || session.phase !== 'activity') return session;
  const activities = Array.isArray(lesson?.activities) ? lesson.activities : [];
  const activity = activities[session.index];
  if (!activity) { session.phase = 'complete'; session.state = null; session.updatedAt = now; return session; }
  const state = session.state && session.state.kind === activity.kind ? session.state : (session.state = initState(activity));
  if (!stepDone(state)) return session;
  session.history = [...session.history, { index: session.index, activityId: activity.id, kind: activity.kind, result: clone(state.result), state: clone(state), at: now }];
  session.done = unique([...session.done, activity.id]);
  session.index++;
  if (session.index >= activities.length) { session.phase = 'complete'; session.state = null; }
  else session.state = initState(activities[session.index]);
  session.updatedAt = now;
  return session;
}

// ---------------------------------------------------------------- free entry ----------------------------------------------------------------

// Per-dictionary indexes (entry map, reverse English senses, headwords by part of speech) are built once and cached by the
// dictionary object the ctx carries, so a caller may rebuild ctx freely.
const INDEXES = new WeakMap();
function labIndex(ctx) {
  const dictionary = ctx?.dictionary && typeof ctx.dictionary === 'object' ? ctx.dictionary : null;
  const key = dictionary || (ctx && typeof ctx === 'object' ? ctx : null);
  let index = key ? INDEXES.get(key) : null;
  if (!index) {
    const vocab = Array.isArray(dictionary?.vocab) ? dictionary.vocab : [], verbs = Array.isArray(dictionary?.verbs) ? dictionary.verbs : [];
    const byId = new Map();
    for (const e of [...vocab, ...verbs]) if (e && typeof e === 'object' && e.id) byId.set(String(e.id), e);
    index = { byId, vocab, verbs, lookup: null, english: null, heads: new Map() };
    if (key) INDEXES.set(key, index);
  }
  if (typeof ctx?.lookup === 'function') index.lookup = ctx.lookup;
  else if (!index.lookup) index.lookup = createSentenceLookup({ vocab: index.vocab, verbs: index.verbs });
  return index;
}

const englishKey = s => String(s ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/[.!?]+$/g, '').trim().replace(/\s+/g, ' ').replace(/^to /, '').replace(/^(the|a|an) /, '');
const englishSenses = e => unique(String(e.en || '').replace(/\([^)]*\)/g, ' ').split(/[;,]/).map(englishKey).filter(Boolean));
function englishIndex(index) {
  if (index.english) return index.english;
  const map = new Map();
  for (const e of index.byId.values()) for (const sense of englishSenses(e)) {
    if (!map.has(sense)) map.set(sense, []);
    const list = map.get(sense); if (!list.includes(e)) list.push(e);
  }
  return (index.english = map);
}

function headwords(index, pos) {
  if (!index.heads.has(pos)) {
    const list = [];
    for (const e of index.byId.values()) if (fitsPos(e, pos)) { const it = headwordOf(e); if (it.trim()) list.push({ e, it, key: fold(it).trim() }); }
    index.heads.set(pos, list);
  }
  return index.heads.get(pos);
}
function commonPrefix(a, b) { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; }
function withinOneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
// Up to three near matches among the headwords of the slot's part of speech: same word without accents, one edit away,
// or a shared prefix of three letters or more (closest first, the slot's categories first among equals).
function suggest(text, slot, index) {
  const q = fold(text).trim();
  if (q.length < 2) return [];
  const cats = Array.isArray(slot.category) && slot.category.length ? new Set(slot.category) : null;
  const scored = [];
  for (const h of headwords(index, slot.pos)) {
    const close = withinOneEdit(q, h.key), prefix = commonPrefix(q, h.key);
    if (!close && prefix < 3) continue;
    scored.push({ it: h.it, rank: close ? 0 : 1, prefix, cat: cats && cats.has(h.e.cat) ? 0 : 1, len: h.key.length });
  }
  scored.sort((a, b) => a.rank - b.rank || b.prefix - a.prefix || a.cat - b.cat || a.len - b.len || a.it.localeCompare(b.it, 'it'));
  return unique(scored.map(s => s.it)).slice(0, 3);
}

function normalizeSlot(slot) {
  const s = slot && typeof slot === 'object' ? slot : {};
  return {
    pos: SLOT_POS.includes(s.pos) ? s.pos : 'expr', agree: SLOT_AGREE.includes(s.agree) ? s.agree : null,
    number: s.number === 'pl' ? 'pl' : 'sg', article: SLOT_ARTICLE.includes(s.article) ? s.article : 'none',
    person: Number.isInteger(s.person) && s.person >= 0 && s.person <= 5 ? s.person : 0, tense: tenseKey(s.tense),
    category: Array.isArray(s.category) ? s.category : null, wrap: typeof s.wrap === 'string' ? s.wrap : null,
  };
}

const startsLo = w => /^(s[bcdfghjklmnpqrstvwxz]|z|gn|ps|pn|x|y|i[aeiou])/.test(fold(w));
const startsVowel = w => /^h?[aeiou]/.test(fold(w));
function indefiniteArticle(gender, word, plural) {
  if (plural) return gender === 'f' ? 'delle ' : (startsLo(word) || startsVowel(word) ? 'degli ' : 'dei ');
  if (gender === 'f') return startsVowel(word) ? "un'" : 'una ';
  return startsLo(word) ? 'uno ' : 'un ';
}

const adjectiveForms = e => {
  if (Array.isArray(e.forms) && e.forms.length === 4 && e.forms.every(f => typeof f === 'string' && f.trim())) return e.forms;
  const it = String(e.it || '');
  if (/o$/.test(it)) return [it, it.slice(0, -1) + 'a', it.slice(0, -1) + 'i', it.slice(0, -1) + 'e'];
  if (/e$/.test(it)) return [it, it, it.slice(0, -1) + 'i', it.slice(0, -1) + 'i'];
  return [it, it, it, it];
};
const AGREE_INDEX = { 'm-sg': 0, 'f-sg': 1, 'm-pl': 2, 'f-pl': 3 };

// The inflected form the slot asks for, from the dictionary entry (or its feminine noun variant). Never invents a form.
function inflect(entry, variant, slot, ctx) {
  const e = variant || entry, word = headwordOf(e);
  if (slot.pos === 'adj') {
    const agree = slot.agree === 'speaker' ? (ctx?.speakerGender === 'f' ? 'f-sg' : 'm-sg') : slot.agree || 'm-sg';
    return { ok: true, form: adjectiveForms(e)[AGREE_INDEX[agree]] };
  }
  if (slot.pos === 'noun') {
    const noun = e.g === 'mf' ? { ...e, g: ctx?.speakerGender === 'f' ? 'f' : 'm' } : e;
    const plural = slot.number === 'pl';
    if (plural && !hasPluralForm(noun)) return { ok: false, reason: `“${word}” has no plural recorded in the dictionary.` };
    if (!plural && isPluralOnly(noun)) return { ok: false, reason: `“${word}” is only used in the plural.` };
    const bare = plural ? noun.pl : noun.it;
    if (slot.article === 'definite') return { ok: true, form: withArticle(noun, plural) };
    if (slot.article === 'indefinite') return { ok: true, form: noun.g ? indefiniteArticle(noun.g, bare, plural) + bare : bare };
    return { ok: true, form: bare };
  }
  if (slot.pos === 'verb') {
    const paradigm = safeConjugate(e.inf, e);
    const cell = paradigm?.tenses?.[slot.tense]?.[slot.person];
    const form = primary(cell);
    if (!form || form === MISSING) return { ok: false, reason: `“${word}” has no ${tenseLabel(slot.tense)} form for ${PERSONS[slot.person]}.` };
    return { ok: true, form: agreeForm(form, slot.person === 0 ? ctx?.speakerGender : 'm') };
  }
  return { ok: true, form: word };
}

const ARTICLE_RE = /^(il|lo|la|i|gli|le|un|uno|una)\s+|^(l|un)['’]/i;

function resolveFitting(matches, slot, ctx) {
  const resolved = matches.map(m => ({ ...m, ...inflect(m.entry, m.variant, slot, ctx) }));
  const good = resolved.filter(r => r.ok);
  if (!good.length) return { unfit: resolved[0]?.reason || 'That word does not fit this blank.' };
  const cats = Array.isArray(slot.category) && slot.category.length ? new Set(slot.category) : null;
  const candidates = [];
  for (const r of good) {
    if (candidates.some(c => c.entryId === r.entry.id)) continue;
    candidates.push({ entryId: r.entry.id, it: headwordOf(r.entry), en: String(r.entry.en || ''), pos: entryPos(r.entry), form: r.form, display: wrapWith(slot.wrap, r.form), inCategory: !!cats && cats.has(r.entry.cat) });
  }
  if (cats) candidates.sort((a, b) => Number(b.inCategory) - Number(a.inCategory));
  if (candidates.length > 1) return { status: 'choose', candidates: candidates.map(({ inCategory, ...c }) => c) };
  const c = candidates[0];
  const learned = ctx?.learnedIds instanceof Set ? ctx.learnedIds.has(c.entryId) : Array.isArray(ctx?.learnedIds) && ctx.learnedIds.includes(c.entryId);
  return { status: learned ? 'ok' : 'learn', entryId: c.entryId, form: c.form, display: c.display, it: c.it, en: c.en, pos: c.pos };
}

// Italian candidates from the sentence lookup (headwords, plurals, feminine forms, conjugated forms), mapped back to
// dictionary entries; a feminine noun form becomes a variant entry so its article and plural follow the feminine.
function italianMatches(index, text) {
  const found = index.lookup(text);
  const matches = [], others = [];
  for (const c of found?.candidates || []) {
    const feminine = /:feminine$/.test(c.id), entry = index.byId.get(feminine ? c.id.replace(/:feminine$/, '') : c.id);
    if (!entry) { others.push(c); continue; }
    let variant = null;
    if (feminine && entry.pos === 'noun') {
      const pluralArticle = c.pluralArticle || '', bare = typeof c.plural === 'string' ? c.plural.slice(pluralArticle.length).trim() : '';
      variant = { ...entry, it: c.word || entry.fem, g: 'f', pl: bare };
    }
    matches.push({ entry, variant, candidate: c });
  }
  return { matches, others };
}

export function resolveFreeEntry(text, slot, ctx) {
  const query = String(text ?? '').trim();
  const s = normalizeSlot(slot);
  if (!query) return { status: 'unknown', suggestions: [] };
  const index = labIndex(ctx);
  let { matches, others } = italianMatches(index, query);
  if (!matches.length && s.pos === 'noun' && ARTICLE_RE.test(query)) ({ matches, others } = italianMatches(index, query.replace(ARTICLE_RE, '').trim()));
  const italianFit = matches.filter(m => fitsPos(m.entry, s.pos));
  if (italianFit.length) {
    const r = resolveFitting(italianFit, s, ctx);
    if (!r.unfit) return r;
    return { status: 'unfit', reason: r.unfit };
  }
  const englishHits = englishIndex(index).get(englishKey(query)) || [];
  const englishFit = englishHits.filter(e => fitsPos(e, s.pos));
  if (englishFit.length) {
    const r = resolveFitting(englishFit.map(entry => ({ entry, variant: null })), s, ctx);
    if (!r.unfit) return r;
    return { status: 'unfit', reason: r.unfit };
  }
  const known = matches[0]?.entry || englishHits[0];
  if (known) return { status: 'unfit', reason: `“${headwordOf(known)}” is ${posPhrase(entryPos(known))}; this blank needs ${posPhrase(s.pos)}.` };
  if (others.length) return { status: 'unfit', reason: `“${query}” is ${withAn(others[0].pos || 'grammatical word')}, not a dictionary word this blank can take.` };
  return { status: 'unknown', suggestions: suggest(query, s, index) };
}

// ---------------------------------------------------------------- build ----------------------------------------------------------------

const EN_BE = ['am', 'are', 'is', 'are', 'are', 'are'];
// English gloss of the verb item for the chosen person: present-tense agreement, "will"/"would" for the future and the
// conditional; past tenses keep the authored gloss verbatim (authors write it in the past).
function englishVerb(en, person, tense) {
  const text = String(en || '').trim().replace(/^to /, '');
  if (!text) return '';
  const [head, ...rest] = text.split(' ');
  if (tense === 'futuro') return /^will\b/.test(text) ? text : `will ${text}`;
  if (tense === 'condizionale') return /^would\b/.test(text) ? text : `would ${text}`;
  if (tense !== 'presente') return text;
  let h = head;
  if (head === 'be') h = EN_BE[person] || 'are';
  else if (person === 2) {
    if (head === 'have') h = 'has';
    else if (/(s|sh|ch|x|z|o)$/.test(head)) h = head + 'es';
    else if (/[^aeiou]y$/.test(head)) h = head.slice(0, -1) + 'ies';
    else h = head + 's';
  }
  return [h, ...rest].join(' ');
}

const roleLabel = role => role.label || ({ subject: 'who', verb: 'the verb', object: 'what', extra: 'when or where', link: 'a link word' }[role.role] || role.role);
// A subject item without "en" is glossed by its Italian text, except the subject pronouns (a closed class).
const PRONOUN_EN = { io: 'I', tu: 'you', lui: 'he', lei: 'she', noi: 'we', voi: 'you', loro: 'they' };
const subjectEn = item => String(item.en || PRONOUN_EN[normalizeLab(item.it)] || item.it || '').trim();

// A verb role conjugates its items unless it is "fixed": then its items are ready-made phrases ("lo mangio") inserted as they are.
const conjugatedRole = role => role.role === 'verb' && role.fixed !== true;

function pickItem(role, value) {
  const items = Array.isArray(role.items) ? role.items : [];
  if (value === undefined || value === null || value === '') return { missing: true };
  if (typeof value === 'number') return items[value] ? { item: items[value] } : { unknown: String(value) };
  if (typeof value === 'string') {
    const key = normalizeLab(value);
    const item = items.find(it => normalizeLab(it.it ?? it.inf) === key);
    if (item) return { item };
    if (conjugatedRole(role)) return { item: { inf: value.trim() } };
    if (role.role === 'subject') return { unknown: value };
    return { item: { it: value.trim(), en: value.trim() } };
  }
  if (typeof value === 'object') return { item: value };
  return { unknown: String(value) };
}

// Composes the chosen items in the authored role order, conjugating the verb for the subject's person in the activity's
// tense (the activity always carries one; the lesson tense, which may be "misto", is never used here). A role is required
// unless it says optional: true. Returns { ok, it, en, reason, parts }.
export function composeBuild(activity, choice = {}, ctx = {}) {
  const tense = tenseKey(activity?.tense);
  const roles = Array.isArray(activity?.roles) ? activity.roles : [];
  const picks = [];
  for (const role of roles) {
    const pick = pickItem(role, choice?.[role.role]);
    if (pick.missing) { if (role.optional === true) continue; return { ok: false, reason: `Choose ${roleLabel(role)}.`, it: '', en: '' }; }
    if (pick.unknown !== undefined) return { ok: false, reason: `“${pick.unknown}” is not one of the choices for ${roleLabel(role)}.`, it: '', en: '' };
    picks.push({ role, item: pick.item });
  }
  const subject = picks.find(p => p.role.role === 'subject')?.item;
  const person = Number.isInteger(subject?.person) && subject.person >= 0 && subject.person <= 5 ? subject.person : null;
  if (subject && person === null && picks.some(p => conjugatedRole(p.role))) return { ok: false, reason: `“${subject.it || ''}” does not say which person the verb takes.`, it: '', en: '' };
  const gender = subject?.g || subject?.gender || (person === 0 ? ctx?.speakerGender : null) || 'm';
  const parts = [];
  for (const { role, item } of picks) {
    if (conjugatedRole(role)) {
      const inf = String(item.inf || item.it || '').trim();
      if (person === null) return { ok: false, reason: 'Choose who first: the verb agrees with the subject.', it: '', en: '' };
      const paradigm = safeConjugate(inf, item);
      const form = primary(paradigm?.tenses?.[tense]?.[person]);
      if (!paradigm || !form || form === MISSING) return { ok: false, reason: `“${inf}” has no ${tenseLabel(tense)} form for ${PERSONS[person]}.`, it: '', en: '' };
      parts.push({ role: role.role, it: agreeForm(form, gender), en: englishVerb(item.en, person, tense), inf });
      continue;
    }
    const it = String(item.it || '').trim();
    if (!it) return { ok: false, reason: `Choose ${roleLabel(role)}.`, it: '', en: '' };
    parts.push({ role: role.role, it, en: role.role === 'subject' ? subjectEn(item) : String(item.en || it).trim(), ...(item.entryId ? { entryId: item.entryId } : {}) });
  }
  if (!parts.length) return { ok: false, reason: 'Nothing to say yet.', it: '', en: '' };
  const it = endSentence(capitalize(parts.map(p => p.it).join(' ').replace(/\s+/g, ' ').trim()));
  const en = endSentence(capitalize(parts.map(p => p.en).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()));
  return { ok: true, it, en, reason: '', parts, tense, person };
}

// ---------------------------------------------------------------- path progress ----------------------------------------------------------------

const stageOrder = pack => (Number.isFinite(pack?.order) ? pack.order : (LAB_STAGES.indexOf(pack?.stage) + 1 || 99));

// record = { done: { [lessonId]: at } }. Stage 1 is open; a stage opens when the previous stage's last lesson is done.
// Lessons unlock in order: the first unlocked lesson not yet done is "next", later unlocked ones (after a gap) are "open".
export function labProgress(stages, record = {}) {
  const done = record?.done && typeof record.done === 'object' ? record.done : {};
  const packs = (Array.isArray(stages) ? stages : Object.values(stages || {})).filter(p => p && typeof p === 'object').slice().sort((a, b) => stageOrder(a) - stageOrder(b));
  let previousLastDone = true, nextFound = false;
  return packs.map(pack => {
    const open = previousLastDone;
    const list = Array.isArray(pack.lessons) ? pack.lessons : [];
    const lessons = list.map((l, i) => {
      let state;
      if (done[l.id]) state = 'done';
      else if (!open || (i > 0 && !done[list[i - 1].id])) state = 'locked';
      else if (!nextFound) { state = 'next'; nextFound = true; }
      else state = 'open';
      return { id: l.id, title: l.title, state, minutes: l.minutes ?? null, tense: l.tense ?? null, outcome: l.outcome ?? '', at: done[l.id] || null };
    });
    const last = list[list.length - 1];
    previousLastDone = open && !!last && !!done[last.id];
    return { stage: pack.stage, order: stageOrder(pack), title: pack.title ?? '', subtitle: pack.subtitle ?? '', open, done: lessons.filter(l => l.state === 'done').length, total: lessons.length, lessons };
  });
}
