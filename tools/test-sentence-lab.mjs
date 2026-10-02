#!/usr/bin/env node
// Deterministic check for the sentence workshop (Officina delle frasi): the content packs in data/sentence-lab/<stage>.json
// against docs/SENTENCE-LAB-CONTRACT.md, an all-correct traversal of every lesson through the engine, and engine fixtures
// (an inline lesson covering every activity kind, every resolveFreeEntry status, path progress and the validator itself).
// Usage: node tools/test-sentence-lab.mjs [--require-all]
// A stage pack that does not exist yet is skipped with a line; --require-all makes every missing pack an error.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { conjugate, primary, MISSING, PERSONS } from '../js/conjugator.js';
import { createSentenceLookup } from '../js/learning/sentence-lookup.js';
import {
  createLabSession, currentLabStep, answerLab, advanceLab, resolveFreeEntry, composeBuild, labProgress, compatibleLabSession,
  normalizeLab, blankCount, fillTemplate, tenseKey, LAB_STAGES, LAB_TENSES, LAB_KINDS, LAB_ROLES, SLOT_POS, SLOT_AGREE, SLOT_NUMBER, SLOT_ARTICLE, MAX_TRIES,
} from '../js/learning/sentence-lab.js';

const requireAll = process.argv.includes('--require-all');
const root = new URL('../', import.meta.url);
const exists = p => fs.existsSync(new URL(p, root));
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const vocab = read('data/vocab.json'), verbs = read('data/verbs.json');
const dictionary = { vocab, verbs };
const lookup = createSentenceLookup(dictionary);
const makeCtx = (speakerGender = 'm', learned = []) => ({ dictionary, lookup, learnedIds: new Set(learned), speakerGender });
const courseIds = new Set(fs.readdirSync(new URL('data/course-v2/', root)).filter(f => f.endsWith('.json')).flatMap(f => {
  const pack = read(`data/course-v2/${f}`);
  return Array.isArray(pack?.units) ? pack.units.flatMap(u => (u.lessons || []).map(l => l.id)) : [];
}));
const nounByIt = new Map(), vocabByKey = new Map(), verbByInf = new Map();
for (const e of vocab) { vocabByKey.set(`${normalizeLab(e.it)}|${e.pos}`, e); if (e.pos === 'noun') nounByIt.set(normalizeLab(e.it), e); }
for (const e of verbs) verbByInf.set(normalizeLab(e.inf), e);

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const wordBag = s => normalizeLab(s).split(' ').map(normalizeLab).filter(Boolean).sort();
function multisetContains(haystack, needles) {
  const pool = [...haystack];
  return needles.every(n => { const i = pool.indexOf(n); if (i < 0) return false; pool.splice(i, 1); return true; });
}
const expectedValue = blank => blank?.accept?.[0] ?? blank?.options?.[0] ?? '';

// ---------------------------------------------------------------- content validation ----------------------------------------------------------------

function validateSlot(slot, where, ok) {
  if (slot === null || slot === undefined) return;
  if (!ok(slot && typeof slot === 'object' && !Array.isArray(slot), `${where}: slot must be an object or null`)) return;
  ok(SLOT_POS.includes(slot.pos), `${where}: slot.pos ${JSON.stringify(slot.pos)} is not one of ${SLOT_POS.join('|')}`);
  if (slot.agree != null) ok(SLOT_AGREE.includes(slot.agree), `${where}: slot.agree ${JSON.stringify(slot.agree)} is not one of ${SLOT_AGREE.join('|')}`);
  if (slot.number != null) ok(SLOT_NUMBER.includes(slot.number), `${where}: slot.number must be sg or pl`);
  if (slot.article != null) ok(SLOT_ARTICLE.includes(slot.article), `${where}: slot.article must be definite, indefinite or none`);
  if (slot.person != null) ok(Number.isInteger(slot.person) && slot.person >= 0 && slot.person <= 5, `${where}: slot.person must be 0..5`);
  if (slot.tense != null) ok(LAB_TENSES.includes(slot.tense) && slot.tense !== 'misto', `${where}: slot.tense ${JSON.stringify(slot.tense)} is not a conjugable lesson tense`);
  if (slot.category != null) ok(Array.isArray(slot.category) && slot.category.every(isStr), `${where}: slot.category must be a list of category slugs or null`);
  if (slot.wrap != null) ok(isStr(slot.wrap) && slot.wrap.includes('{}'), `${where}: slot.wrap must contain {}`);
  if (slot.pos === 'verb') ok(slot.person != null && slot.tense != null, `${where}: a verb slot needs person and tense`);
}

function validateBlank(blank, where, ok) {
  if (!ok(blank && typeof blank === 'object' && !Array.isArray(blank), `${where}: blank must be an object`)) return;
  const accept = blank.accept == null ? [] : blank.accept;
  const hasAccept = Array.isArray(accept) && accept.length > 0;
  // Every blank needs accepted values: an authored option or bank entry outside accept is a wrong choice (graded
  // incorrect, never resolved as a free entry), so a blank without accept could not be answered from its own options.
  ok(hasAccept && accept.every(isStr), `${where}: accept must be a non-empty list of strings`);
  ok(typeof blank.free === 'boolean', `${where}: free must be true or false`);
  if (blank.free === true) ok(!!blank.slot, `${where}: free entry needs a slot (typed words outside the options are resolved through it)`);
  const options = Array.isArray(blank.options) ? blank.options : [];
  ok(Array.isArray(blank.options) && options.length >= 2 && options.length <= 5 && options.every(isStr), `${where}: options must be 2 to 5 strings`);
  ok(new Set(options.map(normalizeLab)).size === options.length, `${where}: duplicate options`);
  const bank = blank.bank == null ? [] : blank.bank;
  ok(Array.isArray(bank) && bank.length <= 6 && bank.every(isStr), `${where}: bank must be 0 to 6 strings`);
  validateSlot(blank.slot, where, ok);
  if (blank.explanation != null) ok(typeof blank.explanation === 'string', `${where}: explanation must be a string`);
  if (hasAccept) {
    const tappable = new Set([...options, ...bank].map(normalizeLab)), accepted = new Set(accept.map(normalizeLab));
    for (const a of accept) ok(tappable.has(normalizeLab(a)), `${where}: accepted value "${a}" is neither an option nor in the bank`);
    ok(options.some(o => accepted.has(normalizeLab(o))), `${where}: no option is an accepted value`);
    ok(isStr(blank.explanation), `${where}: a fixed blank needs an explanation (shown on a mismatch)`);
  }
}

function validateTurn(turn, where, ok) {
  ok(isStr(turn.template) && blankCount(turn.template) >= 1 && blankCount(turn.template) <= 2, `${where}: a "you" turn has 1 or 2 blanks in its template`);
  ok(isStr(turn.en), `${where}: en missing`);
  const blanks = Array.isArray(turn.blanks) ? turn.blanks : [];
  ok(Array.isArray(turn.blanks) && blanks.length === blankCount(turn.template), `${where}: ${blanks.length} blanks for ${blankCount(turn.template)} ____ in the template`);
  blanks.forEach((b, i) => validateBlank(b, `${where} blank ${i + 1}`, ok));
  const reactions = Array.isArray(turn.reactions) ? turn.reactions : [];
  ok(Array.isArray(turn.reactions) && reactions.length > 0, `${where}: reactions missing`);
  ok(reactions.some(r => r?.when === '*'), `${where}: no "*" reaction`);
  const first = blanks[0] || {};
  const reachable = new Set([...(first.accept || []), ...(first.options || []), ...(first.bank || [])].map(normalizeLab));
  reactions.forEach((r, i) => {
    const at = `${where} reaction ${i + 1}`;
    if (!ok(r && typeof r === 'object', `${at}: must be an object`)) return;
    ok(isStr(r.it) && isStr(r.en), `${at}: it/en missing`);
    if (r.when === '*') return;
    if (!ok(Array.isArray(r.when) && r.when.length > 0 && r.when.every(isStr), `${at}: when must be "*" or a non-empty list of strings`)) return;
    for (const w of r.when) ok(reachable.has(normalizeLab(w)), `${at}: "${w}" can never be chosen for the first blank (not in accept, options or bank)`);
  });
}

// Every example of a build activity must be composable by composeBuild from the role items (either speaker gender).
function composableExample(activity, tense, example) {
  const roles = activity.roles;
  const lists = roles.map(r => (r.optional === true ? [null, ...r.items.map((_, i) => i)] : r.items.map((_, i) => i)));
  const total = lists.reduce((n, l) => n * l.length, 1);
  if (total > 4000) return null;
  const target = normalizeLab(example);
  for (let n = 0; n < total; n++) {
    let rem = n; const choice = {};
    roles.forEach((r, i) => { const pick = lists[i][rem % lists[i].length]; rem = Math.floor(rem / lists[i].length); if (pick !== null) choice[r.role] = pick; });
    for (const speakerGender of ['m', 'f']) {
      const c = composeBuild({ ...activity, tense }, choice, { speakerGender });
      if (c.ok && normalizeLab(c.it) === target) return true;
    }
  }
  return false;
}

function validateActivity(a, lesson, ok) {
  const where = a.id || `${lesson.id}.?`;
  if (a.kind === 'model') {
    ok(isStr(a.body), `${where}: body missing`);
    const pattern = Array.isArray(a.pattern) ? a.pattern : [];
    ok(pattern.length >= 2 && pattern.every(p => LAB_ROLES.includes(p?.role) && isStr(p?.label)), `${where}: pattern needs 2+ {role,label} entries with roles ${LAB_ROLES.join('|')}`);
    const examples = Array.isArray(a.examples) ? a.examples : [];
    ok(examples.length >= 1 && examples.every(e => isStr(e?.it) && isStr(e?.en)), `${where}: examples need it/en`);
    examples.forEach((e, i) => {
      if (e?.roles == null) return;
      const at = `${where} example ${i + 1}`;
      if (!ok(Array.isArray(e.roles) && e.roles.every(r => Array.isArray(r) && r.length === 2 && isStr(r[0]) && LAB_ROLES.includes(r[1])), `${at}: roles must be [token, role] pairs`)) return;
      ok(normalizeLab(e.roles.map(r => r[0]).join(' ')) === normalizeLab(e.it), `${at}: role tokens do not spell the sentence in order`);
    });
    if (a.tip != null) ok(typeof a.tip === 'string', `${where}: tip must be a string`);
    return;
  }
  if (a.kind === 'order') {
    ok(isStr(a.en) && isStr(a.answer) && isStr(a.explanation), `${where}: en, answer and explanation required`);
    const tokens = Array.isArray(a.tokens) ? a.tokens : [];
    if (!ok(tokens.length >= 2 && tokens.every(isStr), `${where}: tokens must be 2+ strings`)) return;
    const tokenBag = wordBag(tokens.join(' '));
    ok(tokenBag.join('|') === wordBag(a.answer || '').join('|'), `${where}: tokens do not form the answer exactly`);
    for (const acc of Array.isArray(a.accepted) ? a.accepted : []) ok(isStr(acc) && multisetContains(tokenBag, wordBag(acc)), `${where}: accepted answer "${acc}" cannot be formed from the tokens`);
    for (const d of Array.isArray(a.distractors) ? a.distractors : []) ok(isStr(d) && !tokenBag.includes(normalizeLab(d)), `${where}: distractor "${d}" is also a needed token`);
    return;
  }
  if (a.kind === 'cloze') {
    ok(isStr(a.template) && blankCount(a.template) >= 1, `${where}: template needs at least one ____`);
    ok(isStr(a.en), `${where}: en missing`);
    const blanks = Array.isArray(a.blanks) ? a.blanks : [];
    ok(Array.isArray(a.blanks) && blanks.length === blankCount(a.template), `${where}: ${blanks.length} blanks for ${blankCount(a.template)} ____ in the template`);
    blanks.forEach((b, i) => validateBlank(b, `${where} blank ${i + 1}`, ok));
    return;
  }
  if (a.kind === 'dialogue') {
    ok(isStr(a.partner), `${where}: partner name missing`);
    const turns = Array.isArray(a.turns) ? a.turns : [];
    if (!ok(turns.length >= 2, `${where}: a dialogue needs at least two turns`)) return;
    ok(turns.some(t => t?.speaker === 'you'), `${where}: no "you" turn`);
    turns.forEach((t, i) => {
      const at = `${where} turn ${i + 1}`;
      if (!ok(t && ['partner', 'you'].includes(t.speaker), `${at}: speaker must be partner or you`)) return;
      if (i > 0 && t.speaker === 'you') ok(turns[i - 1]?.speaker !== 'you', `${at}: two "you" turns in a row`);
      if (t.speaker === 'partner') ok(isStr(t.it) && isStr(t.en), `${at}: partner turn needs it/en`);
      else validateTurn(t, at, ok);
    });
    return;
  }
  if (a.kind === 'build') {
    // The build conjugates in its own tense (the lesson tense may be "misto"), so every build carries a conjugable one.
    ok(LAB_TENSES.includes(a.tense) && a.tense !== 'misto', `${where}: build needs its own conjugable tense (has ${JSON.stringify(a.tense)})`);
    const tense = a.tense;
    const key = tenseKey(tense);
    const roles = Array.isArray(a.roles) ? a.roles : [];
    if (!ok(roles.length >= 2 && roles.every(r => r && LAB_ROLES.includes(r.role)), `${where}: roles must be 2+ entries with roles ${LAB_ROLES.join('|')}`)) return;
    ok(new Set(roles.map(r => r.role)).size === roles.length, `${where}: duplicate roles`);
    const subject = roles.find(r => r.role === 'subject'), verb = roles.find(r => r.role === 'verb');
    const fixedVerb = !!verb && verb.fixed === true;
    ok(!!verb, `${where}: verb role required`);
    ok(!!subject || fixedVerb, `${where}: subject role required (unless the verb role is fixed)`);
    for (const r of roles) {
      const at = `${where} role ${r.role}`;
      if (r.optional != null) ok(typeof r.optional === 'boolean', `${at}: optional must be boolean`);
      if (r.fixed != null) ok(typeof r.fixed === 'boolean' && (r.role === 'verb' || r.fixed === false), `${at}: fixed is a boolean for the verb role only`);
      if (r.label != null) ok(isStr(r.label), `${at}: label must be a string`);
      if (r.learned != null) {
        ok(r.learned && typeof r.learned === 'object' && SLOT_POS.includes(r.learned.pos), `${at}: learned.pos must be one of ${SLOT_POS.join('|')}`);
        if (r.learned?.category != null) ok(Array.isArray(r.learned.category) && r.learned.category.every(isStr), `${at}: learned.category must be a list`);
        if (r.learned?.article != null) ok(SLOT_ARTICLE.includes(r.learned.article), `${at}: learned.article invalid`);
      }
      if (!ok(Array.isArray(r.items) && r.items.length >= 1, `${at}: items missing`)) continue;
      r.items.forEach((it, i) => {
        const here = `${at} item ${i + 1}`;
        if (!ok(it && typeof it === 'object', `${here}: must be an object`)) return;
        if (r.role === 'subject') {
          ok(isStr(it.it) && Number.isInteger(it.person) && it.person >= 0 && it.person <= 5, `${here}: subject items need it and person 0..5`);
          for (const field of ['gender', 'g']) if (it[field] != null) ok(['m', 'f'].includes(it[field]), `${here}: ${field} must be m or f`);
        } else if (r.role === 'verb' && !fixedVerb) ok(isStr(it.inf), `${here}: verb items need inf`);
        else ok(isStr(it.it), `${here}: items need it`);
        if (it.en != null) ok(typeof it.en === 'string', `${here}: en must be a string`);
      });
    }
    if (subject && verb && !fixedVerb && Array.isArray(subject.items) && Array.isArray(verb.items)) {
      const persons = [...new Set(subject.items.map(s => s.person).filter(p => Number.isInteger(p) && p >= 0 && p <= 5))];
      for (const v of verb.items) {
        if (!isStr(v.inf)) continue;
        let paradigm = null;
        try { paradigm = conjugate(v.inf, { aux: v.aux, isc: v.isc }); } catch { paradigm = null; }
        if (!ok(!!paradigm, `${where}: "${v.inf}" cannot be conjugated`)) continue;
        for (const p of persons) {
          const form = primary(paradigm.tenses[key]?.[p]);
          ok(!!form && form !== MISSING, `${where}: "${v.inf}" has no ${key} form for ${PERSONS[p]}`);
        }
      }
    }
    const examples = Array.isArray(a.examples) ? a.examples : [];
    ok(Array.isArray(a.examples) && examples.length >= 1 && examples.every(isStr), `${where}: examples must be 1+ sentences`);
    for (const ex of examples.filter(isStr)) {
      const result = composableExample(a, tense, ex);
      ok(result !== false, `${where}: example "${ex}" cannot be composed from the role items in ${key}`);
    }
    return;
  }
  ok(false, `${where}: unknown activity kind ${JSON.stringify(a.kind)}`);
}

// Validates one stage pack; errors are pushed to `errs`. `ids` holds lesson and activity ids across packs.
function validatePack(pack, stage, errs, ids = new Set()) {
  const ok = (cond, msg) => { if (!cond) errs.push(msg); return !!cond; };
  const expectedOrder = LAB_STAGES.indexOf(stage) + 1;
  if (!ok(pack && typeof pack === 'object' && !Array.isArray(pack), `${stage}: pack must be an object`)) return;
  ok(pack.version === 1, `${stage}: version must be 1`);
  ok(pack.stage === stage, `${stage}: stage field is ${JSON.stringify(pack.stage)}`);
  ok(pack.order === expectedOrder, `${stage}: order must be ${expectedOrder}`);
  ok(isStr(pack.title) && isStr(pack.subtitle), `${stage}: title and subtitle required`);
  const lessons = Array.isArray(pack.lessons) ? pack.lessons : [];
  ok(Array.isArray(pack.lessons) && lessons.length >= 1, `${stage}: lessons missing`);
  const idRe = new RegExp(`^sl-${stage}-\\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$`);
  for (const lesson of lessons) {
    if (!ok(lesson && typeof lesson === 'object', `${stage}: lesson must be an object`)) continue;
    const id = String(lesson.id);
    ok(idRe.test(id), `${id}: lesson id must match sl-${stage}-<nn>-<slug>`);
    ok(!ids.has(id), `${id}: duplicate lesson id`); ids.add(id);
    ok(isStr(lesson.title) && isStr(lesson.outcome), `${id}: title and outcome required`);
    ok(typeof lesson.minutes === 'number' && lesson.minutes > 0, `${id}: minutes must be a positive number`);
    ok(LAB_TENSES.includes(lesson.tense), `${id}: tense ${JSON.stringify(lesson.tense)} is not one of ${LAB_TENSES.join('|')}`);
    const refs = Array.isArray(lesson.grammarRefs) ? lesson.grammarRefs : null;
    ok(refs !== null, `${id}: grammarRefs must be a list (may be empty)`);
    for (const ref of refs || []) ok(courseIds.has(ref), `${id}: grammarRef ${JSON.stringify(ref)} is not a course v2 lesson`);
    const words = Array.isArray(lesson.vocab) ? lesson.vocab : null;
    ok(words !== null, `${id}: vocab must be a list (may be empty)`);
    for (const w of words || []) {
      if (!ok(w && isStr(w.it) && isStr(w.en) && isStr(w.pos), `${id}: vocab entries need it, en and pos`)) continue;
      const entry = w.pos === 'verb' ? verbByInf.get(normalizeLab(w.it)) : vocabByKey.get(`${normalizeLab(w.it)}|${w.pos}`);
      ok(!!entry, `${id}: vocab "${w.it}" (${w.pos}) is not a dictionary entry`);
    }
    const activities = Array.isArray(lesson.activities) ? lesson.activities : [];
    ok(activities.length >= 6 && activities.length <= 10, `${id}: ${activities.length} activities (6 to 10 required)`);
    if (!activities.length) continue;
    ok(activities[0]?.kind === 'model', `${id}: the first activity must be a model`);
    ok(activities[activities.length - 1]?.kind === 'build', `${id}: the last activity must be a build`);
    for (const kind of ['order', 'cloze', 'dialogue']) ok(activities.some(a => a?.kind === kind), `${id}: no ${kind} activity`);
    activities.forEach((a, i) => {
      if (!ok(a && typeof a === 'object', `${id}: activity ${i + 1} must be an object`)) return;
      const aid = String(a.id);
      ok(new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+$`).test(aid), `${aid}: activity id must be ${id}.<n>`);
      ok(!ids.has(aid), `${aid}: duplicate activity id`); ids.add(aid);
      ok(LAB_KINDS.includes(a.kind), `${aid}: kind ${JSON.stringify(a.kind)} is not one of ${LAB_KINDS.join('|')}`);
      ok(isStr(a.prompt), `${aid}: prompt missing`);
      if (a.hint != null) ok(typeof a.hint === 'string', `${aid}: hint must be a string`);
      if (LAB_KINDS.includes(a.kind)) validateActivity(a, lesson, ok);
    });
  }
}

// ---------------------------------------------------------------- traversal ----------------------------------------------------------------

// An all-correct learner: first accepted value in every blank (or the first option of a free-only blank, resolved through
// the dictionary), the authored answer for order, the first item of every role for the build.
function traverse(lesson, ctx) {
  const session = createLabSession(lesson, { now: 1 });
  let guard = 0, answers = 0;
  while (guard++ < 300) {
    const view = currentLabStep(lesson, session);
    if (view.kind === 'complete') break;
    const a = view.activity;
    if (a.kind === 'model') answerLab(lesson, session, null, ctx);
    else if (a.kind === 'order') {
      const r = answerLab(lesson, session, a.answer, ctx).result;
      assert.equal(r?.outcome, 'correct', `${a.id}: authored order answer rejected`);
      answers++;
    } else if (a.kind === 'cloze') {
      const r = answerLab(lesson, session, a.blanks.map(expectedValue), ctx).result;
      assert.ok(r?.ok, `${a.id}: expected cloze values rejected (${r?.explanation})`);
      answers++;
    } else if (a.kind === 'dialogue') {
      let turns = 0;
      while (!currentLabStep(lesson, session).state.complete && turns++ < 40) {
        const current = currentLabStep(lesson, session).state.current;
        assert.ok(current?.pending, `${a.id}: no pending "you" turn while the dialogue is open`);
        const r = answerLab(lesson, session, current.blanks.map(expectedValue), ctx).result;
        assert.ok(r?.ok, `${a.id} turn ${current.index + 1}: expected values rejected (${r?.explanation})`);
        assert.ok(r.reaction && isStr(r.reaction.it), `${a.id} turn ${current.index + 1}: no reaction chosen`);
        answers++;
      }
      assert.ok(currentLabStep(lesson, session).state.complete, `${a.id}: dialogue never completed`);
    } else if (a.kind === 'build') {
      const choice = Object.fromEntries(a.roles.map(r => [r.role, 0]));
      const r = answerLab(lesson, session, choice, ctx).result;
      assert.ok(r?.ok, `${a.id}: first items do not compose (${r?.explanation})`);
      assert.ok(isStr(r.sentence) && isStr(r.en), `${a.id}: composed sentence or English missing`);
      answers++;
    }
    const before = session.index;
    advanceLab(lesson, session, { now: guard + 1 });
    assert.ok(session.phase === 'complete' || session.index === before + 1, `${a.id}: could not advance after answering`);
  }
  assert.equal(session.phase, 'complete', `${lesson.id}: all-correct learner cannot finish`);
  assert.deepEqual(session.done, lesson.activities.map(a => a.id), `${lesson.id}: done list differs from the activity list`);
  assert.equal(session.sentences.length, 1, `${lesson.id}: the build should save exactly one sentence`);
  assert.equal(session.history.length, lesson.activities.length, `${lesson.id}: history should hold every activity`);
  assert.deepEqual(JSON.parse(JSON.stringify(session)), session, `${lesson.id}: session is not plain serialisable data`);
  return answers;
}

// ---------------------------------------------------------------- stage packs ----------------------------------------------------------------

const errors = [];
const packs = [];
for (const stage of LAB_STAGES) {
  const file = `data/sentence-lab/${stage}.json`;
  if (!exists(file)) {
    if (requireAll) errors.push(`${file}: missing (--require-all)`);
    else console.log(`skip: ${file} not present yet`);
    continue;
  }
  try { packs.push({ stage, file, pack: read(file) }); } catch (e) { errors.push(`${file}: ${e.message}`); }
}
const ids = new Set();
for (const { stage, pack } of packs) validatePack(pack, stage, errors, ids);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

let traversed = 0, totalAnswers = 0;
for (const { stage, pack } of packs) {
  for (const lesson of pack.lessons) {
    for (const gender of ['m', 'f']) {
      try { totalAnswers += traverse(lesson, makeCtx(gender)); } catch (e) { errors.push(`${stage}/${lesson.id} (speaker ${gender}): ${e.message}`); }
    }
    traversed++;
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

if (packs.length) {
  const total = { lessons: 0, activities: 0 };
  for (const { stage, pack } of packs) {
    const activities = pack.lessons.flatMap(l => l.activities);
    const byKind = Object.fromEntries(LAB_KINDS.map(k => [k, activities.filter(a => a.kind === k).length]));
    const clozeBlanks = activities.filter(a => a.kind === 'cloze').flatMap(a => a.blanks);
    const turns = activities.filter(a => a.kind === 'dialogue').flatMap(a => a.turns);
    const youTurns = turns.filter(t => t.speaker === 'you');
    const turnBlanks = youTurns.flatMap(t => t.blanks);
    const free = [...clozeBlanks, ...turnBlanks].filter(b => b.free === true).length;
    const slots = [...clozeBlanks, ...turnBlanks].filter(b => b.free === true && b.slot).length;
    const vocabWords = pack.lessons.reduce((n, l) => n + l.vocab.length, 0);
    console.log(`${stage}: ${pack.lessons.length} lessons, ${activities.length} activities (${LAB_KINDS.map(k => `${k} ${byKind[k]}`).join(', ')}), ${clozeBlanks.length + turnBlanks.length} blanks of which ${free} with free entry (${slots} typed slots), ${turns.length} dialogue turns (${youTurns.length} yours), ${vocabWords} useful words`);
    total.lessons += pack.lessons.length; total.activities += activities.length;
  }
  console.log(`Validated ${total.lessons} lessons and ${total.activities} activities in ${packs.length} of ${LAB_STAGES.length} stage packs; every lesson traversed and completed through the engine for both speaker genders (${totalAnswers} answers, ${traversed} lessons).`);
} else console.log('No stage packs present yet: content checks skipped, engine fixtures only.');

// ---------------------------------------------------------------- engine fixtures ----------------------------------------------------------------

let passed = 0;
function test(name, run) { try { run(); passed++; console.log(`✓ ${name}`); } catch (e) { errors.push(`${name}: ${e.message}`); console.error(`✗ ${name}\n  ${e.message}`); } }
const L = 'sl-presente-99-fixture';
const FIXTURE_PACK = {
  version: 1, stage: 'presente', order: 1, title: 'Presente', subtitle: 'Say what is true now',
  lessons: [{
    id: L, title: 'Fixture', outcome: 'Exercise every activity kind through the engine.', minutes: 4, tense: 'presente',
    grammarRefs: ['v2-a1-essere-singular'], vocab: [{ it: 'stanco', en: 'tired', pos: 'adj' }, { it: 'mangiare', en: 'to eat', pos: 'verb' }, { it: 'casa', en: 'house', pos: 'noun' }],
    activities: [
      { id: `${L}.1`, kind: 'model', prompt: 'Who + is + what', body: 'A sentence names who, then what they are.',
        pattern: [{ role: 'subject', label: 'who' }, { role: 'verb', label: 'is' }, { role: 'object', label: 'what' }],
        examples: [{ it: 'Io sono Marco.', en: 'I am Marco.', roles: [['Io', 'subject'], ['sono', 'verb'], ['Marco.', 'object']] }, { it: 'Lei è stanca.', en: 'She is tired.' }], tip: 'Io is often left out.' },
      { id: `${L}.2`, kind: 'order', prompt: 'Build the sentence', en: 'I eat bread.', answer: 'Io mangio il pane.', accepted: ['Mangio il pane.'],
        tokens: ['Io', 'mangio', 'il', 'pane.'], distractors: ['mangia'], explanation: 'Io takes mangio.', hint: 'Start with who.' },
      { id: `${L}.3`, kind: 'cloze', prompt: 'Finish the sentence', template: 'Bene grazie, ma ____ stanco.', en: 'Fine thanks, but I am tired.',
        blanks: [{ accept: ['sono'], options: ['sono', 'sei', 'è'], bank: ['siamo', 'ho'], free: false, slot: null, explanation: 'io takes sono.' }] },
      { id: `${L}.4`, kind: 'dialogue', prompt: 'At the bar', partner: 'Luca', turns: [
        { speaker: 'partner', it: 'Ciao! Come stai?', en: 'Hi! How are you?' },
        { speaker: 'you', template: 'Bene grazie, ma ____.', en: 'Fine thanks, but ____.',
          blanks: [{ accept: ['sono stanco', 'sono stanca', 'ho fame', 'ho sonno'], options: ['sono stanco', 'ho fame', 'ho sonno'], bank: ['sono stanca', 'ho sete'], free: true,
            slot: { pos: 'adj', agree: 'speaker', wrap: 'sono {}' }, explanation: 'Say how you feel: sono + adjective, or ho + fame / sonno.' }],
          reactions: [{ when: ['sono stanco', 'sono stanca'], it: 'Stanco? Hai lavorato molto?', en: 'Tired? Did you work a lot?' },
            { when: ['ho fame'], it: 'Allora prendiamo un panino!', en: "Then let's get a sandwich!" }, { when: '*', it: 'Capisco. Andiamo?', en: 'I see. Shall we go?' }] },
        { speaker: 'partner', it: 'Dai, andiamo a casa.', en: "Come on, let's go home." },
        { speaker: 'you', template: 'Va bene, ____ a casa.', en: 'All right, ____ home.',
          blanks: [{ accept: ['andiamo'], options: ['andiamo', 'vado', 'vai'], bank: [], free: false, slot: null, explanation: 'noi takes andiamo.' }],
          reactions: [{ when: '*', it: 'Perfetto!', en: 'Perfect!' }] },
        { speaker: 'partner', it: 'A dopo!', en: 'See you later!' } ] },
      { id: `${L}.5`, kind: 'cloze', prompt: 'Your word', template: 'Oggi mangio ____.', en: 'Today I eat ____.',
        blanks: [{ accept: ['la pasta', 'il pane', 'la pizza'], options: ['la pasta', 'il pane', 'la casa'], bank: ['la pizza', 'il libro'], free: true,
          slot: { pos: 'noun', number: 'sg', article: 'definite', category: ['food'] }, explanation: 'Something you can eat, with its article.' }] },
      { id: `${L}.6`, kind: 'build', prompt: 'Say it yourself', tense: 'presente', roles: [
        { role: 'subject', items: [{ it: 'Io', person: 0 }, { it: 'Mia sorella', en: 'My sister', person: 2, g: 'f' }, { it: 'Noi', person: 3 }] },
        { role: 'verb', items: [{ inf: 'mangiare', en: 'eat' }, { inf: 'bere', en: 'drink' }] },
        { role: 'object', learned: { pos: 'noun', category: ['food'], article: 'definite' }, items: [{ it: 'la pasta', en: 'pasta' }, { it: 'un caffè', en: 'a coffee' }] },
        { role: 'extra', optional: true, items: [{ it: 'a casa', en: 'at home' }, { it: 'la sera', en: 'in the evening' }] } ],
        examples: ['Io mangio la pasta a casa.', 'Mia sorella beve un caffè.'] },
    ],
  }],
};
const fixtureLesson = FIXTURE_PACK.lessons[0];
const fixtureIds = () => fixtureLesson.activities.map(a => a.id);

test('fixture pack passes the content validator', () => {
  const errs = [];
  validatePack(FIXTURE_PACK, 'presente', errs);
  assert.deepEqual(errs, []);
});

test('the content validator rejects broken packs', () => {
  const mutate = fn => { const pack = JSON.parse(JSON.stringify(FIXTURE_PACK)); fn(pack.lessons[0]); const errs = []; validatePack(pack, 'presente', errs); return errs; };
  assert.match(mutate(l => { l.activities[1].tokens = ['Io', 'mangio', 'pane.']; }).join('\n'), /tokens do not form the answer/);
  assert.match(mutate(l => { l.activities[1].accepted = ['Io mangio la pasta.']; }).join('\n'), /cannot be formed from the tokens/);
  assert.match(mutate(l => { l.activities[1].distractors = ['mangio']; }).join('\n'), /also a needed token/);
  assert.match(mutate(l => { l.activities[3].turns[1].reactions.pop(); }).join('\n'), /no "\*" reaction/);
  assert.match(mutate(l => { l.activities[3].turns.splice(2, 1); }).join('\n'), /two "you" turns in a row/);
  assert.match(mutate(l => { l.activities[3].turns[1].reactions[1].when = ['ho paura']; }).join('\n'), /can never be chosen/);
  assert.match(mutate(l => { l.activities[2].blanks[0].options = ['sei', 'è']; }).join('\n'), /neither an option nor in the bank/);
  assert.match(mutate(l => { l.activities[2].template = 'Bene grazie, ma ____ ____.'; }).join('\n'), /1 blanks for 2 ____/);
  assert.match(mutate(l => { l.activities[4].blanks[0].accept = []; }).join('\n'), /accept must be a non-empty list/);
  assert.match(mutate(l => { l.activities[4].blanks[0].slot = null; }).join('\n'), /free entry needs a slot/);
  assert.match(mutate(l => { l.activities[5].roles[1].items.push({ inf: 'dirimere', en: 'settle' }); l.activities[5].tense = 'passatoProssimo'; }).join('\n'), /"dirimere" has no passatoProssimo form/);
  assert.match(mutate(l => { delete l.activities[5].tense; }).join('\n'), /build needs its own conjugable tense/);
  assert.match(mutate(l => { l.activities[5].tense = 'misto'; }).join('\n'), /build needs its own conjugable tense/);
  assert.match(mutate(l => { l.activities[5].roles.shift(); }).join('\n'), /subject role required/);
  assert.deepEqual(mutate(l => { l.activities[5].roles = [{ role: 'verb', fixed: true, items: [{ it: 'lo mangio', en: 'eat it' }] }, { role: 'extra', optional: true, items: [{ it: 'a casa', en: 'at home' }] }]; l.activities[5].examples = ['Lo mangio a casa.', 'Lo mangio.']; }), [], 'a fixed verb role needs no subject and no conjugation');
  assert.match(mutate(l => { l.activities[5].roles[0].items[0].gender = 'x'; }).join('\n'), /gender must be m or f/);
  assert.match(mutate(l => { l.activities[5].examples = ['Io mangia la pasta.']; }).join('\n'), /cannot be composed/);
  assert.match(mutate(l => { l.vocab.push({ it: 'xyzzyq', en: 'nothing', pos: 'noun' }); }).join('\n'), /not a dictionary entry/);
  assert.match(mutate(l => { l.grammarRefs = ['v2-nope']; }).join('\n'), /not a course v2 lesson/);
  assert.match(mutate(l => { l.activities.pop(); }).join('\n'), /5 activities \(6 to 10 required\)|last activity must be a build/);
  assert.match(mutate(l => { l.activities[0].examples[0].roles = [['Io', 'subject'], ['sono', 'verb']]; }).join('\n'), /do not spell the sentence/);
  assert.match(mutate(l => { l.activities[3].turns[1].blanks[0].slot = { pos: 'verb' }; }).join('\n'), /verb slot needs person and tense/);
});

test('fixture lesson traverses for both speaker genders', () => {
  assert.equal(traverse(fixtureLesson, makeCtx('m')), 6);
  assert.equal(traverse(fixtureLesson, makeCtx('f', ['w:stanco|adj'])), 6);
});

test('createLabSession and currentLabStep expose the model first', () => {
  const session = createLabSession(fixtureLesson, { now: 10 });
  assert.deepEqual(Object.keys(session).sort(), ['createdAt', 'done', 'history', 'id', 'index', 'lessonId', 'phase', 'sentences', 'state', 'updatedAt', 'version'].sort());
  assert.equal(session.lessonId, L); assert.equal(session.index, 0); assert.equal(session.phase, 'activity');
  const step = currentLabStep(fixtureLesson, session);
  assert.equal(step.kind, 'model'); assert.equal(step.activity.id, `${L}.1`); assert.equal(step.complete, false); assert.equal(step.done, true);
  assert.equal(step.total, 6);
  assert.ok(compatibleLabSession(fixtureLesson, session));
  assert.ok(!compatibleLabSession({ ...fixtureLesson, id: 'other' }, session));
});

test('order: two wrong tries reveal the answer, then answerLab is idempotent', () => {
  const session = createLabSession(fixtureLesson, { now: 10 });
  advanceLab(fixtureLesson, session);
  assert.equal(currentLabStep(fixtureLesson, session).kind, 'order');
  const first = answerLab(fixtureLesson, session, 'Io mangia il pane.', makeCtx()).result;
  assert.equal(first.outcome, 'incorrect'); assert.equal(first.ok, false); assert.equal(first.explanation, 'Io takes mangio.'); assert.equal(first.misses, 1); assert.equal(first.revealed, false);
  assert.equal(currentLabStep(fixtureLesson, session).done, false);
  const before = session.index; advanceLab(fixtureLesson, session); assert.equal(session.index, before, 'cannot advance an unanswered activity');
  const second = answerLab(fixtureLesson, session, ['Io', 'mangia', 'il', 'pane.'], makeCtx()).result;
  assert.equal(second.outcome, 'incorrect'); assert.equal(second.revealed, true); assert.equal(second.answer, 'Io mangio il pane.'); assert.equal(second.sentence, 'Io mangio il pane.');
  assert.equal(currentLabStep(fixtureLesson, session).done, true);
  const again = answerLab(fixtureLesson, session, 'Io mangio il pane.', makeCtx()).result;
  assert.strictEqual(again, second, 'a finished activity returns the same result');
  assert.equal(session.state.attempts.length, 2);
});

test('order: tokens in an accepted variant are correct, with normalised case and punctuation', () => {
  const session = createLabSession(fixtureLesson, { now: 10 });
  advanceLab(fixtureLesson, session);
  const r = answerLab(fixtureLesson, session, ['mangio', 'il', 'pane'], makeCtx()).result;
  assert.equal(r.outcome, 'correct'); assert.equal(r.ok, true); assert.equal(r.answer, 'Io mangio il pane.');
  advanceLab(fixtureLesson, session);
  assert.equal(currentLabStep(fixtureLesson, session).kind, 'cloze');
  assert.equal(session.history.length, 2); assert.equal(session.history[1].result.outcome, 'correct');
});

const atActivity = (n, ctx = makeCtx()) => {
  const session = createLabSession(fixtureLesson, { now: 10 });
  for (let i = 1; i < n; i++) {
    const step = currentLabStep(fixtureLesson, session), a = step.activity;
    if (a.kind === 'order') answerLab(fixtureLesson, session, a.answer, ctx);
    else if (a.kind === 'cloze') answerLab(fixtureLesson, session, a.blanks.map(expectedValue), ctx);
    else if (a.kind === 'dialogue') while (!currentLabStep(fixtureLesson, session).state.complete) answerLab(fixtureLesson, session, currentLabStep(fixtureLesson, session).state.current.blanks.map(expectedValue), ctx);
    else if (a.kind === 'build') answerLab(fixtureLesson, session, { subject: 0, verb: 0, object: 0 }, ctx);
    advanceLab(fixtureLesson, session);
  }
  return session;
};

test('cloze: a fixed blank is wrong with its explanation, right with any case', () => {
  const session = atActivity(3);
  const wrong = answerLab(fixtureLesson, session, ['sei'], makeCtx()).result;
  assert.equal(wrong.outcome, 'incorrect'); assert.equal(wrong.explanation, 'io takes sono.'); assert.equal(wrong.blanks[0].outcome, 'incorrect'); assert.equal(wrong.answer, 'Bene grazie, ma sono stanco.');
  const right = answerLab(fixtureLesson, session, 'Sono', makeCtx()).result;
  assert.equal(right.outcome, 'correct'); assert.equal(right.sentence, 'Bene grazie, ma sono stanco.'); assert.equal(right.en, 'Fine thanks, but I am tired.');
  assert.equal(right.blanks[0].filled, 'sono');
});

test('cloze: second miss reveals the first accepted value and finishes the activity', () => {
  const session = atActivity(3);
  answerLab(fixtureLesson, session, ['sei'], makeCtx());
  const r = answerLab(fixtureLesson, session, ['è'], makeCtx()).result;
  assert.equal(r.revealed, true); assert.equal(r.blanks[0].filled, 'sono'); assert.equal(r.blanks[0].revealed, true); assert.equal(r.sentence, 'Bene grazie, ma sono stanco.');
  assert.equal(currentLabStep(fixtureLesson, session).done, true); assert.equal(currentLabStep(fixtureLesson, session).state.revealed, true);
});

test('cloze: a free blank with a slot accepts a dictionary word in the slot form (article added)', () => {
  const session = atActivity(5);
  assert.equal(currentLabStep(fixtureLesson, session).activity.id, `${L}.5`);
  const r = answerLab(fixtureLesson, session, ['riso'], makeCtx()).result;
  assert.equal(r.outcome, 'accepted'); assert.equal(r.ok, true); assert.equal(r.blanks[0].filled, 'il riso'); assert.equal(r.blanks[0].entryId, 'w:riso|noun'); assert.equal(r.blanks[0].status, 'learn');
  assert.equal(r.sentence, 'Oggi mangio il riso.');
  const learned = atActivity(5, makeCtx('m', ['w:riso|noun']));
  const r2 = answerLab(fixtureLesson, learned, ['il riso'], makeCtx('m', ['w:riso|noun'])).result;
  assert.equal(r2.blanks[0].status, 'ok'); assert.equal(r2.blanks[0].filled, 'il riso', 'a typed article is dropped and the slot article applied');
  const resolved = answerLab(fixtureLesson, atActivity(5), ['pasta'], makeCtx()).result;
  assert.equal(resolved.outcome, 'correct', 'a typed word that resolves to an accepted value is correct'); assert.equal(resolved.blanks[0].filled, 'la pasta'); assert.equal(resolved.blanks[0].entryId, 'w:pasta|noun');
  const bad = atActivity(5);
  const r3 = answerLab(fixtureLesson, bad, ['stanco'], makeCtx()).result;
  assert.equal(r3.outcome, 'incorrect'); assert.match(r3.explanation, /adjective; this blank needs a noun/);
  const r4 = answerLab(fixtureLesson, bad, ['xyzzyq'], makeCtx()).result;
  assert.equal(r4.revealed, true); assert.equal(r4.blanks[0].filled, 'la pasta', 'the first accepted value is revealed');
});

test('cloze: an authored option or bank entry outside accept is a wrong choice, never a free entry', () => {
  const wrongOption = answerLab(fixtureLesson, atActivity(5), ['la casa'], makeCtx()).result;
  assert.equal(wrongOption.outcome, 'incorrect', '"la casa" is a dictionary noun the slot would take, but it is an authored wrong option');
  assert.equal(wrongOption.explanation, 'Something you can eat, with its article.'); assert.equal(wrongOption.blanks[0].entryId, null);
  const wrongBank = answerLab(fixtureLesson, atActivity(5), ['Il libro'], makeCtx()).result;
  assert.equal(wrongBank.outcome, 'incorrect'); assert.equal(wrongBank.misses, 1);
  const rightBank = answerLab(fixtureLesson, atActivity(5), ['la pizza'], makeCtx()).result;
  assert.equal(rightBank.outcome, 'correct');
  const dialogue = answerLab(fixtureLesson, atActivity(4), ['ho sete'], makeCtx()).result;
  assert.equal(dialogue.outcome, 'incorrect', 'a bank entry outside accept in a dialogue turn is wrong too'); assert.equal(dialogue.reaction, null);
  const free = answerLab(fixtureLesson, atActivity(4), ['contento'], makeCtx()).result;
  assert.equal(free.outcome, 'accepted'); assert.equal(free.sentence, 'Bene grazie, ma sono contento.');
});

test('build notes: alternatives, fixed verb roles, the activity tense in a misto lesson, required roles, subject gender', () => {
  const ctx = makeCtx('f');
  // (1) a conjugator cell may hold alternatives ("devo|debbo"): the primary form is composed, any alternative is understood
  const dovere = { tense: 'presente', roles: [{ role: 'subject', items: [{ it: 'Io', person: 0 }] }, { role: 'verb', items: [{ inf: 'dovere', en: 'must' }] }, { role: 'object', items: [{ it: 'studiare', en: 'study' }] }] };
  assert.equal(conjugate('dovere').tenses.presente[0], 'devo|debbo');
  assert.equal(composeBuild(dovere, { subject: 0, verb: 0, object: 0 }, ctx).it, 'Io devo studiare.');
  assert.equal(resolveFreeEntry('debbo', { pos: 'verb', person: 0, tense: 'presente' }, ctx).form, 'devo');
  const altLesson = { id: 'sl-presente-98-alt', tense: 'presente', activities: [{ id: 'sl-presente-98-alt.1', kind: 'cloze', prompt: 'p', template: 'Oggi ____ studiare.', en: 'Today I must study.',
    blanks: [{ accept: ['devo'], options: ['devo', 'deve', 'dovete'], bank: [], free: true, slot: { pos: 'verb', person: 0, tense: 'presente' }, explanation: 'io takes devo.' }] }] };
  const altSession = createLabSession(altLesson, { now: 1 });
  const alt = answerLab(altLesson, altSession, ['debbo'], ctx).result;
  assert.equal(alt.outcome, 'correct', 'a typed alternative of an accepted form is correct'); assert.equal(alt.blanks[0].filled, 'devo'); assert.equal(alt.sentence, 'Oggi devo studiare.');
  assert.equal(answerLab(altLesson, createLabSession(altLesson, { now: 1 }), ['deve'], ctx).result.outcome, 'incorrect', 'a wrong option stays wrong');
  // (2) a fixed verb role inserts its phrase as it is, with or without a subject role
  const fixed = { tense: 'presente', roles: [{ role: 'subject', items: [{ it: 'Io', person: 0 }] }, { role: 'verb', fixed: true, items: [{ it: 'lo mangio', en: 'eat it' }, { it: 'la bevo', en: 'drink it' }] }, { role: 'extra', optional: true, items: [{ it: 'a casa', en: 'at home' }] }] };
  assert.deepEqual(composeBuild(fixed, { subject: 0, verb: 1, extra: 0 }, ctx), { ok: true, it: 'Io la bevo a casa.', en: 'I drink it at home.', reason: '', tense: 'presente', person: 0,
    parts: [{ role: 'subject', it: 'Io', en: 'I' }, { role: 'verb', it: 'la bevo', en: 'drink it' }, { role: 'extra', it: 'a casa', en: 'at home' }] });
  assert.equal(composeBuild({ ...fixed, roles: fixed.roles.slice(1) }, { verb: 'lo mangio' }, ctx).it, 'Lo mangio.');
  assert.equal(composeBuild({ ...fixed, roles: fixed.roles.slice(1) }, { verb: { it: 'lo mangio', en: 'eat it' } }, ctx).en, 'Eat it.');
  assert.equal(composeBuild({ ...fixed, tense: 'passatoProssimo' }, { subject: 0, verb: 0 }, ctx).it, 'Io lo mangio.', 'a fixed phrase is never conjugated');
  // (3) the build conjugates in its own tense; the lesson tense ("misto") is never used
  const misto = { id: 'sl-passato-98-misto', tense: 'misto', activities: [{ id: 'sl-passato-98-misto.1', kind: 'build', prompt: 'p', tense: 'passatoProssimo',
    roles: [{ role: 'subject', items: [{ it: 'Io', person: 0 }, { it: 'Mia sorella', en: 'My sister', person: 2, gender: 'f' }, { it: 'Marco', person: 2, gender: 'm' }] }, { role: 'verb', items: [{ inf: 'andare', en: 'went', aux: 'essere' }] }, { role: 'extra', items: [{ it: 'al mare', en: 'to the sea' }] }], examples: ['Io sono andata al mare.'] }] };
  const mistoSession = createLabSession(misto, { now: 1 });
  const went = answerLab(misto, mistoSession, { subject: 0, verb: 0, extra: 0 }, ctx).result;
  assert.equal(went.sentence, 'Io sono andata al mare.'); assert.equal(went.en, 'I went to the sea.');
  // (5) subject items may carry gender for the participle; past-tense verb glosses are used verbatim
  assert.equal(composeBuild(misto.activities[0], { subject: 1, verb: 0, extra: 0 }, makeCtx('m')).it, 'Mia sorella è andata al mare.');
  assert.equal(composeBuild(misto.activities[0], { subject: 2, verb: 0, extra: 0 }, makeCtx('f')).it, 'Marco è andato al mare.');
  assert.equal(composeBuild(misto.activities[0], { subject: 1, verb: 0, extra: 0 }, makeCtx('m')).en, 'My sister went to the sea.');
  // (4) a role without optional: true is required; optional: false too
  assert.deepEqual(composeBuild(misto.activities[0], { subject: 0, verb: 0 }, ctx), { ok: false, reason: 'Choose when or where.', it: '', en: '' });
  const explicit = { ...fixed, roles: fixed.roles.map(r => (r.role === 'extra' ? { ...r, optional: false } : r)) };
  assert.equal(composeBuild(explicit, { subject: 0, verb: 0 }, ctx).reason, 'Choose when or where.');
  assert.equal(composeBuild(fixed, { subject: 0, verb: 0 }, ctx).it, 'Io lo mangio.', 'optional: true may be left out');
});

test('dialogue: turns reveal one at a time, free entry fills the wrap and picks the reaction', () => {
  const ctx = makeCtx('f');
  const session = atActivity(4, ctx);
  let step = currentLabStep(fixtureLesson, session);
  assert.equal(step.kind, 'dialogue'); assert.equal(step.state.turnIndex, 1); assert.equal(step.state.partner, 'Luca'); assert.equal(step.done, false);
  assert.deepEqual(step.state.turns.map(t => [t.speaker, t.pending === true, t.reaction === true]), [['partner', false, false], ['you', true, false]]);
  assert.equal(step.state.turns[0].it, 'Ciao! Come stai?'); assert.equal(step.state.current.template, 'Bene grazie, ma ____.'); assert.equal(step.state.current.blanks.length, 1);
  const r = answerLab(fixtureLesson, session, ['tired'], ctx).result;
  assert.equal(r.outcome, 'correct', 'the English word resolves to an accepted value'); assert.equal(r.turnIndex, 1); assert.equal(r.sentence, 'Bene grazie, ma sono stanca.'); assert.equal(r.blanks[0].entryId, 'w:stanco|adj');
  assert.deepEqual(r.reaction, { it: 'Stanco? Hai lavorato molto?', en: 'Tired? Did you work a lot?' }); assert.equal(r.complete, false);
  step = currentLabStep(fixtureLesson, session);
  assert.equal(step.state.turnIndex, 3);
  assert.deepEqual(step.state.turns.map(t => [t.index, t.speaker, !!t.reaction, !!t.pending]), [[0, 'partner', false, false], [1, 'you', false, false], [1, 'partner', true, false], [2, 'partner', false, false], [3, 'you', false, true]]);
  assert.equal(step.state.turns[1].it, 'Bene grazie, ma sono stanca.'); assert.equal(step.state.turns[1].done, true); assert.equal(step.state.turns[2].it, 'Stanco? Hai lavorato molto?');
  const miss = answerLab(fixtureLesson, session, ['vado'], ctx).result;
  assert.equal(miss.outcome, 'incorrect'); assert.equal(miss.explanation, 'noi takes andiamo.'); assert.equal(miss.reaction, null); assert.equal(currentLabStep(fixtureLesson, session).state.turnIndex, 3);
  const reveal = answerLab(fixtureLesson, session, ['vai'], ctx).result;
  assert.equal(reveal.revealed, true); assert.equal(reveal.sentence, 'Va bene, andiamo a casa.'); assert.deepEqual(reveal.reaction, { it: 'Perfetto!', en: 'Perfect!' }); assert.equal(reveal.complete, true);
  step = currentLabStep(fixtureLesson, session);
  assert.equal(step.done, true); assert.equal(step.state.complete, true); assert.equal(step.state.current, null); assert.equal(step.state.remaining, 0);
  assert.deepEqual(step.state.turns.map(t => t.it).slice(-3), ['Va bene, andiamo a casa.', 'Perfetto!', 'A dopo!']);
  assert.equal(step.result.outcome, 'incorrect'); assert.equal(step.result.turns.length, 2); assert.equal(step.result.revealed, true);
  assert.strictEqual(answerLab(fixtureLesson, session, ['andiamo'], ctx).result, step.result, 'a complete dialogue returns its final result');
  assert.ok(compatibleLabSession(fixtureLesson, session));
});

test('dialogue: a tapped option is correct and takes its own reaction; an unknown free word explains and counts a miss', () => {
  const ctx = makeCtx();
  const session = atActivity(4, ctx);
  const r = answerLab(fixtureLesson, session, ['ho fame'], ctx).result;
  assert.equal(r.outcome, 'correct'); assert.equal(r.reaction.it, 'Allora prendiamo un panino!');
  const other = atActivity(4, ctx);
  const typed = answerLab(fixtureLesson, other, ['sono stanco'], ctx).result;
  assert.equal(typed.outcome, 'correct', 'typing an accepted value with its wrap is correct, not merely accepted');
  const free = atActivity(4, ctx);
  const felice = answerLab(fixtureLesson, free, ['felice'], ctx).result;
  assert.equal(felice.outcome, 'accepted'); assert.equal(felice.sentence, 'Bene grazie, ma sono felice.'); assert.equal(felice.reaction.it, 'Capisco. Andiamo?');
  const bad = atActivity(4, ctx);
  const unknown = answerLab(fixtureLesson, bad, ['xyzzyq'], ctx).result;
  assert.equal(unknown.outcome, 'incorrect'); assert.match(unknown.explanation, /not in the dictionary/); assert.equal(unknown.misses, 1);
  const english = answerLab(fixtureLesson, bad, ['sono tired'], ctx).result;
  assert.equal(english.outcome, 'correct', 'the wrap typed around an English word is stripped before resolving, and the result is an accepted value'); assert.equal(english.sentence, 'Bene grazie, ma sono stanco.');
});

test('build: composes, saves the sentence and completes the lesson', () => {
  const ctx = makeCtx();
  const session = atActivity(6, ctx);
  assert.equal(currentLabStep(fixtureLesson, session).kind, 'build');
  const missing = answerLab(fixtureLesson, session, { subject: 'Io', object: 'la pasta' }, ctx).result;
  assert.equal(missing.ok, false); assert.equal(missing.explanation, 'Choose the verb.'); assert.equal(currentLabStep(fixtureLesson, session).done, false);
  const r = answerLab(fixtureLesson, session, { subject: 'Mia sorella', verb: 'bere', object: { it: 'il tè', en: 'tea', entryId: 'w:tè|noun' }, extra: 'la sera' }, { ...ctx, now: 77 }).result;
  assert.equal(r.outcome, 'accepted'); assert.equal(r.sentence, 'Mia sorella beve il tè la sera.'); assert.equal(r.en, 'My sister drinks tea in the evening.');
  assert.deepEqual(session.sentences, [{ it: 'Mia sorella beve il tè la sera.', en: 'My sister drinks tea in the evening.', lessonId: L, at: 77 }]);
  advanceLab(fixtureLesson, session, { now: 78 });
  const step = currentLabStep(fixtureLesson, session);
  assert.equal(step.kind, 'complete'); assert.equal(step.complete, true); assert.equal(session.phase, 'complete'); assert.equal(session.state, null);
  assert.deepEqual(session.done, fixtureIds()); assert.equal(session.history.length, 6);
  assert.equal(advanceLab(fixtureLesson, session), session);
  assert.deepEqual(answerLab(fixtureLesson, session, {}, ctx), { session, result: null });
});

test('composeBuild: tenses, agreement, English glosses and failure reasons', () => {
  const build = fixtureLesson.activities[5];
  assert.deepEqual(composeBuild(build, { subject: 0, verb: 0, object: 0, extra: 0 }, makeCtx()), {
    ok: true, it: 'Io mangio la pasta a casa.', en: 'I eat pasta at home.', reason: '', tense: 'presente', person: 0,
    parts: [{ role: 'subject', it: 'Io', en: 'I' }, { role: 'verb', it: 'mangio', en: 'eat', inf: 'mangiare' }, { role: 'object', it: 'la pasta', en: 'pasta' }, { role: 'extra', it: 'a casa', en: 'at home' }],
  });
  assert.equal(composeBuild(build, { subject: 2, verb: 1, object: 1 }, makeCtx()).it, 'Noi beviamo un caffè.');
  assert.equal(composeBuild(build, { subject: 2, verb: 1, object: 1 }, makeCtx()).en, 'We drink a coffee.');
  const past = { ...build, tense: 'passatoProssimo', roles: build.roles.map(r => (r.role === 'verb' ? { ...r, items: [{ inf: 'andare', en: 'went', aux: 'essere' }] } : r)) };
  assert.equal(composeBuild(past, { subject: 0, verb: 0, object: 'a casa' }, makeCtx('f')).it, 'Io sono andata a casa.');
  assert.equal(composeBuild(past, { subject: 0, verb: 0, object: 'a casa' }, makeCtx('m')).it, 'Io sono andato a casa.');
  assert.equal(composeBuild(past, { subject: 1, verb: 0, object: 'a casa' }, makeCtx('m')).it, 'Mia sorella è andata a casa.', 'a subject item may carry its gender');
  assert.equal(composeBuild(past, { subject: 1, verb: 0, object: 'a casa' }, makeCtx('m')).en, 'My sister went a casa.');
  assert.equal(composeBuild({ ...build, tense: 'futuro' }, { subject: 1, verb: 0, object: 0 }, makeCtx()).en, 'My sister will eat pasta.');
  assert.equal(composeBuild({ ...build, tense: 'condizionale' }, { subject: 0, verb: 1, object: 1 }, makeCtx()).it, 'Io berrei un caffè.');
  assert.equal(composeBuild({ ...build, tense: 'imperfetto' }, { subject: 2, verb: 0, object: 0 }, makeCtx()).it, 'Noi mangiavamo la pasta.');
  assert.equal(composeBuild({ ...build, tense: undefined }, { subject: 0, verb: 0, object: 0 }, makeCtx()).tense, 'presente');
  const none = composeBuild(build, { subject: 0, verb: { inf: 'dirimere', en: 'settle' }, object: 0 }, makeCtx());
  assert.equal(none.ok, true);
  const noForm = composeBuild({ ...build, tense: 'passatoProssimo' }, { subject: 0, verb: { inf: 'dirimere', en: 'settled' }, object: 0 }, makeCtx());
  assert.equal(noForm.ok, false); assert.equal(noForm.reason, '“dirimere” has no Passato prossimo form for io.');
  assert.deepEqual(composeBuild(build, { verb: 0, object: 0 }, makeCtx()), { ok: false, reason: 'Choose who.', it: '', en: '' });
  assert.match(composeBuild(build, { subject: 'Tu', verb: 0, object: 0 }, makeCtx()).reason, /not one of the choices for who/);
  assert.equal(composeBuild(build, { subject: 0, verb: 0, object: 0, extra: '' }, makeCtx()).it, 'Io mangio la pasta.', 'an empty optional role is skipped');
  assert.equal(composeBuild({ roles: [] }, {}, makeCtx()).ok, false);
});

test('resolveFreeEntry: Italian adjectives agree with the speaker or the slot, from the recorded forms', () => {
  const slot = { pos: 'adj', agree: 'speaker', wrap: 'sono {}' };
  assert.deepEqual(resolveFreeEntry('stanco', slot, makeCtx('m')), { status: 'learn', entryId: 'w:stanco|adj', form: 'stanco', display: 'sono stanco', it: 'stanco', en: 'tired', pos: 'adj' });
  assert.deepEqual(resolveFreeEntry('stanco', slot, makeCtx('f', ['w:stanco|adj'])), { status: 'ok', entryId: 'w:stanco|adj', form: 'stanca', display: 'sono stanca', it: 'stanco', en: 'tired', pos: 'adj' });
  assert.equal(resolveFreeEntry('stanca', { pos: 'adj', agree: 'm-pl' }, makeCtx()).form, 'stanchi', 'an inflected form is found and re-agreed for the slot');
  assert.equal(resolveFreeEntry('Stanche', { pos: 'adj', agree: 'f-pl' }, makeCtx()).form, 'stanche');
  assert.equal(resolveFreeEntry('felice', { pos: 'adj', agree: 'f-pl' }, makeCtx()).form, 'felici');
  assert.equal(resolveFreeEntry('blu', { pos: 'adj', agree: 'f-pl' }, makeCtx()).form, 'blu', 'invariable adjectives stay unchanged');
  assert.equal(resolveFreeEntry('stanco', { pos: 'adj' }, makeCtx('f')).form, 'stanco', 'no agreement asked: the headword');
});

test('resolveFreeEntry: nouns take the article the slot asks for, plural and feminine forms resolve', () => {
  assert.equal(resolveFreeEntry('casa', { pos: 'noun', article: 'definite' }, makeCtx()).form, 'la casa');
  assert.equal(resolveFreeEntry('casa', { pos: 'noun', article: 'indefinite' }, makeCtx()).form, 'una casa');
  assert.equal(resolveFreeEntry('casa', { pos: 'noun', article: 'none' }, makeCtx()).form, 'casa');
  assert.equal(resolveFreeEntry('case', { pos: 'noun', number: 'pl', article: 'definite' }, makeCtx()).form, 'le case');
  assert.equal(resolveFreeEntry('la casa', { pos: 'noun', article: 'indefinite' }, makeCtx()).form, 'una casa', 'a typed article is dropped');
  assert.equal(resolveFreeEntry('caffè', { pos: 'noun', article: 'indefinite' }, makeCtx()).form, 'un caffè');
  assert.equal(resolveFreeEntry('caffè', { pos: 'noun', number: 'pl', article: 'definite' }, makeCtx()).form, 'i caffè');
  assert.equal(resolveFreeEntry('zaino', { pos: 'noun', article: 'indefinite' }, makeCtx()).form, 'uno zaino');
  assert.equal(resolveFreeEntry('acqua', { pos: 'noun', article: 'indefinite' }, makeCtx()).form, "un'acqua");
  assert.equal(resolveFreeEntry('amico', { pos: 'noun', article: 'indefinite' }, makeCtx()).form, 'un amico');
  const amica = resolveFreeEntry('amica', { pos: 'noun', article: 'definite' }, makeCtx());
  assert.equal(amica.entryId, 'w:amico|noun'); assert.equal(amica.form, "l'amica");
  assert.equal(resolveFreeEntry('amiche', { pos: 'noun', number: 'pl', article: 'definite' }, makeCtx()).form, 'le amiche');
  assert.equal(resolveFreeEntry('artista', { pos: 'noun', article: 'definite' }, makeCtx('f')).form, "l'artista");
  assert.equal(resolveFreeEntry('turista', { pos: 'noun', article: 'indefinite' }, makeCtx('f')).form, 'una turista', 'a noun of either gender follows the speaker');
  assert.equal(resolveFreeEntry('turista', { pos: 'noun', article: 'indefinite' }, makeCtx('m')).form, 'un turista');
  assert.deepEqual(resolveFreeEntry('fame', { pos: 'noun', number: 'pl' }, makeCtx()), { status: 'unfit', reason: '“fame” has no plural recorded in the dictionary.' });
  assert.deepEqual(resolveFreeEntry('occhiali', { pos: 'noun', number: 'sg' }, makeCtx()), { status: 'unfit', reason: '“occhiali” is only used in the plural.' });
});

test('resolveFreeEntry: verbs conjugate for the slot person and tense, from any typed form', () => {
  assert.deepEqual(resolveFreeEntry('mangiare', { pos: 'verb', person: 2, tense: 'presente' }, makeCtx()), { status: 'learn', entryId: 'v:mangiare', form: 'mangia', display: 'mangia', it: 'mangiare', en: 'to eat', pos: 'verb' });
  assert.equal(resolveFreeEntry('mangio', { pos: 'verb', person: 3, tense: 'passatoProssimo' }, makeCtx()).form, 'abbiamo mangiato');
  assert.equal(resolveFreeEntry('andare', { pos: 'verb', person: 0, tense: 'passatoProssimo' }, makeCtx('f')).form, 'sono andata');
  assert.equal(resolveFreeEntry('andare', { pos: 'verb', person: 2, tense: 'passatoProssimo' }, makeCtx('f')).form, 'è andato');
  assert.equal(resolveFreeEntry('capire', { pos: 'verb', person: 0, tense: 'presente' }, makeCtx()).form, 'capisco');
  assert.equal(resolveFreeEntry('alzarsi', { pos: 'verb', person: 1, tense: 'futuro' }, makeCtx()).form, 'ti alzerai');
  assert.equal(resolveFreeEntry('finito', { pos: 'verb', person: 5, tense: 'condizionale', wrap: 'domani {}' }, makeCtx()).display, 'domani finirebbero');
  assert.deepEqual(resolveFreeEntry('dirimere', { pos: 'verb', person: 0, tense: 'passatoProssimo' }, makeCtx()), { status: 'unfit', reason: '“dirimere” has no Passato prossimo form for io.' });
  const choose = resolveFreeEntry('andata', { pos: 'verb', person: 2, tense: 'presente' }, makeCtx());
  assert.equal(choose.status, 'choose'); assert.deepEqual(choose.candidates.map(c => [c.entryId, c.form]), [['v:andare', 'va'], ['v:andarsene', 'se ne va']]);
});

test('resolveFreeEntry: English words resolve through the senses, a picker when several fit', () => {
  const tired = resolveFreeEntry('tired', { pos: 'adj', agree: 'speaker', wrap: 'sono {}' }, makeCtx('f'));
  assert.deepEqual(tired, { status: 'learn', entryId: 'w:stanco|adj', form: 'stanca', display: 'sono stanca', it: 'stanco', en: 'tired', pos: 'adj' });
  assert.equal(resolveFreeEntry('Tired', { pos: 'adj', agree: 'speaker' }, makeCtx('m', ['w:stanco|adj'])).status, 'ok');
  assert.equal(resolveFreeEntry('eat', { pos: 'verb', person: 0, tense: 'presente' }, makeCtx()).form, 'mangio');
  assert.equal(resolveFreeEntry('to eat', { pos: 'verb', person: 4, tense: 'presente' }, makeCtx()).form, 'mangiate');
  assert.equal(resolveFreeEntry('house', { pos: 'noun', article: 'definite' }, makeCtx()).form, 'la casa');
  assert.equal(resolveFreeEntry('a coffee', { pos: 'noun', article: 'indefinite' }, makeCtx()).form, 'un caffè');
  const happy = resolveFreeEntry('happy', { pos: 'adj', agree: 'speaker', wrap: 'sono {}' }, makeCtx('f'));
  assert.equal(happy.status, 'choose');
  assert.deepEqual(happy.candidates, [
    { entryId: 'w:contento|adj', it: 'contento', en: 'glad; happy; pleased', pos: 'adj', form: 'contenta', display: 'sono contenta' },
    { entryId: 'w:felice|adj', it: 'felice', en: 'happy', pos: 'adj', form: 'felice', display: 'sono felice' },
  ]);
  const withCategory = resolveFreeEntry('happy', { pos: 'adj', category: ['emotions'] }, makeCtx());
  assert.equal(withCategory.status, 'choose'); assert.equal(withCategory.candidates.length, 2);
  assert.deepEqual(resolveFreeEntry('tired', { pos: 'noun' }, makeCtx()), { status: 'unfit', reason: '“stanco” is an adjective; this blank needs a noun.' });
});

test('resolveFreeEntry: unknown words get up to three near matches; known words of the wrong kind are unfit', () => {
  assert.deepEqual(resolveFreeEntry('xyzzyq', { pos: 'adj' }, makeCtx()), { status: 'unknown', suggestions: [] });
  assert.deepEqual(resolveFreeEntry('', { pos: 'noun' }, makeCtx()), { status: 'unknown', suggestions: [] });
  const stanc = resolveFreeEntry('stanc', { pos: 'adj' }, makeCtx());
  assert.equal(stanc.status, 'unknown'); assert.equal(stanc.suggestions[0], 'stanco'); assert.ok(stanc.suggestions.length <= 3);
  assert.equal(resolveFreeEntry('mangare', { pos: 'verb', person: 0, tense: 'presente' }, makeCtx()).suggestions[0], 'mangiare');
  const caffe = resolveFreeEntry('caffe', { pos: 'noun', category: ['food'] }, makeCtx());
  assert.equal(caffe.status, 'unknown'); assert.equal(caffe.suggestions[0], 'caffè');
  assert.ok(resolveFreeEntry('cas', { pos: 'noun' }, makeCtx()).suggestions.every(s => s.startsWith('cas')), 'prefix matches share three letters or more');
  assert.deepEqual(resolveFreeEntry('casa', { pos: 'adj' }, makeCtx()), { status: 'unfit', reason: '“casa” is a noun; this blank needs an adjective.' });
  assert.deepEqual(resolveFreeEntry('stanco', { pos: 'noun', article: 'definite' }, makeCtx()), { status: 'unfit', reason: '“stanco” is an adjective; this blank needs a noun.' });
  assert.equal(resolveFreeEntry('stanco', { pos: 'verb', person: 0, tense: 'presente' }, makeCtx()).status, 'unfit');
  assert.match(resolveFreeEntry('Marco', { pos: 'noun' }, makeCtx()).reason, /proper noun/);
  assert.equal(resolveFreeEntry('molto', { pos: 'adv' }, makeCtx()).entryId, 'w:molto|adv');
  assert.equal(resolveFreeEntry('molto', { pos: 'adj', agree: 'f-pl' }, makeCtx()).form, 'molte');
  const noLookup = resolveFreeEntry('stanco', { pos: 'adj', agree: 'f-sg' }, { dictionary, learnedIds: new Set(), speakerGender: 'm' });
  assert.equal(noLookup.form, 'stanca', 'a ctx without a lookup builds one from its dictionary');
});

test('labProgress: stages open in order, lessons unlock in order, gaps stay open', () => {
  const stages = [
    { stage: 'presente', order: 1, title: 'Presente', subtitle: 'now', lessons: [{ id: 'p1', title: 'A' }, { id: 'p2', title: 'B' }, { id: 'p3', title: 'C' }] },
    { stage: 'passato', order: 2, title: 'Passato', subtitle: 'then', lessons: [{ id: 'q1', title: 'D' }, { id: 'q2', title: 'E' }] },
    { stage: 'futuro', order: 3, lessons: [{ id: 'f1', title: 'F' }] },
  ];
  const states = progress => progress.map(s => [s.stage, s.open, s.lessons.map(l => l.state).join(' ')]);
  assert.deepEqual(states(labProgress(stages, { done: {} })), [['presente', true, 'next locked locked'], ['passato', false, 'locked locked'], ['futuro', false, 'locked']]);
  assert.deepEqual(states(labProgress(stages, undefined)), [['presente', true, 'next locked locked'], ['passato', false, 'locked locked'], ['futuro', false, 'locked']]);
  assert.deepEqual(states(labProgress(stages, { done: { p1: 5 } })), [['presente', true, 'done next locked'], ['passato', false, 'locked locked'], ['futuro', false, 'locked']]);
  assert.deepEqual(states(labProgress(stages, { done: { p1: 5, p2: 6, p3: 7 } })), [['presente', true, 'done done done'], ['passato', true, 'next locked'], ['futuro', false, 'locked']]);
  assert.deepEqual(states(labProgress(stages, { done: { p1: 5, p3: 7 } })), [['presente', true, 'done next done'], ['passato', true, 'open locked'], ['futuro', false, 'locked']], 'a synced gap: the stage opens, the gap is next');
  assert.deepEqual(states(labProgress([...stages].reverse(), { done: { p1: 5, p2: 6, p3: 7, q1: 8, q2: 9, f1: 10 } })), [['presente', true, 'done done done'], ['passato', true, 'done done'], ['futuro', true, 'done']], 'packs are sorted by order');
  const first = labProgress(stages, { done: { p1: 5 } })[0];
  assert.equal(first.done, 1); assert.equal(first.total, 3); assert.equal(first.lessons[0].at, 5); assert.equal(first.lessons[0].title, 'A'); assert.equal(first.title, 'Presente');
});

test('helpers: normalisation, blanks and tense keys', () => {
  assert.equal(normalizeLab('  Io mangio il pane.  '), 'io mangio il pane');
  assert.equal(normalizeLab("L’ amico è qui!"), "l'amico è qui");
  assert.equal(blankCount('Ciao ____, come ____?'), 2); assert.equal(blankCount('Nessun buco.'), 0);
  assert.equal(fillTemplate('Ciao ____, come ____?', ['Luca']), 'Ciao Luca, come ____?');
  assert.deepEqual(['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale', 'misto', undefined].map(tenseKey), ['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale', 'presente', 'presente']);
  for (const key of ['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale']) assert.ok(Array.isArray(conjugate('mangiare').tenses[key]), `conjugator has ${key}`);
  assert.equal(MAX_TRIES, 2);
});

if (errors.length) { console.error(`\n${errors.length} failure(s):\n${errors.join('\n')}`); process.exit(1); }
console.log(`${passed} engine fixture groups passed.`);
