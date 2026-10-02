#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLesson } from '../js/learning/lesson-content.js';
import { buildJourneyQuestion } from '../js/learning/lesson-questions.js';
import { createLetterActivity, createPairActivity, gradePairActivity } from '../js/learning/lesson-activities.js';
import { gradeQuestion } from '../js/learning/diagnose.js';
import { createLearning, recordAttempt, normalizeLearning, skillState } from '../js/learning/model.js';
import { createJourneySession, currentJourneyStep, advanceJourney, journeyAttempt, recordJourneyAttempt, journeyPairAttempt, recordJourneyPairAttempt, journeyTargetState } from '../js/learning/journey.js';

const verbs = JSON.parse(readFileSync(new URL('../data/verbs.json', import.meta.url)));
const words = JSON.parse(readFileSync(new URL('../data/vocab.json', import.meta.url)));
const START = 1700000000000, clone = value => JSON.parse(JSON.stringify(value));
let tests = 0;
function test(name, run) { try { run(); tests++; console.log(`✓ ${name}`); } catch (error) { console.error(`✗ ${name}`); throw error; } }
function harness(inf = 'credere', chapterId = 'present') {
  const entry = verbs.find(e => e.inf === inf) || words.find(e => e.it === inf), plan = buildLesson(entry);
  let learning = createLearning(START), session = createJourneySession({ id: 'activity-session', plan, chapterId, now: START }), sequence = 0;
  const h = {
    entry, plan, get learning() { return learning; }, get session() { return session; }, set session(next) { session = next; },
    step() { return currentJourneyStep(plan, session, learning, START + sequence); },
    question() { const s = h.step(); return buildJourneyQuestion(entry, s.chapter, s.target, s); },
    next() { session = advanceJourney(plan, session, learning, { now: START + ++sequence }); return h.step(); },
    record(event, pair = false) {
      assert.ok(event);
      Object.assign(event, { epochId: learning.epoch.id, deviceId: 'fixture', sequence: ++sequence, at: START + sequence });
      event.xp ??= event.ok ? event.assistance.length ? 1 : 2 : 0;
      const result = recordAttempt(learning, event); learning = result.learning;
      session = pair ? recordJourneyPairAttempt(plan, session, event, result) : recordJourneyAttempt(plan, session, event, result);
      return { event, result };
    },
    answer(q = h.question(), given = q.answer[0]) {
      const grade = gradeQuestion(q, given);
      return h.record(journeyAttempt(plan, session, q, grade, { now: START + sequence + 1 }));
    },
    pair(q, targetId, given, attempt = 0) {
      const grade = gradePairActivity(q, { targetId, given });
      return h.record(journeyPairAttempt(plan, session, q, grade, { targetId, attempt, now: START + sequence + 1 }), true);
    },
    until(predicate) {
      for (let guard = 0; guard < 300; guard++) {
        const s = h.step(); if (predicate(s)) return s;
        if (s.type === 'question' && !s.awaitingContinue) {
          const q = h.question();
          if (q.type === 'pairs') for (const pair of q.pairs) h.pair(q, pair.targetId, pair.canonical);
          h.answer(q);
        } else if (['teach', 'repair', 'recap'].includes(s.type) || s.awaitingContinue) h.next();
        else throw new Error(`Unexpected ${s.type}`);
      }
      throw new Error('Activity did not appear within bounded test traversal');
    },
  };
  return h;
}

test('letter banks preserve accents, repeated letters, spaces and apostrophes deterministically', () => {
  const q = { id: 'letters', type: 'type', answer: ["me n'andrò"], meta: { mode: 'production' }, choices: [] };
  const a = createLetterActivity(q, { seed: 7 });
  assert.equal(a.type, 'letters'); assert.equal(a.meta.mode, 'recognition'); assert.equal(a.meta.evidenceMode, 'recognition');
  assert.equal(a.meta.supportOnly, true); assert.deepEqual(a, createLetterActivity(q, { seed: 7 }));
  assert.deepEqual(a.tiles.map(t => t.text).sort(), ['m', 'e', 'n', 'a', 'n', 'd', 'r', 'ò'].sort());
  assert.equal(new Set(a.tiles.map(t => t.id)).size, a.tiles.length);
  assert.deepEqual(a.slots.filter(s => s.kind === 'fixed').map(s => s.text), [' ', "'"]);
  assert.equal(q.meta.mode, 'production'); assert.equal(q.type, 'type');
});

test('English meanings, grammar facts and long text retain their existing guided control', () => {
  for (const q of [
    { type: 'type', answer: ['to believe'], meta: { answerLanguage: 'en' } },
    { type: 'mc', answer: ['A completed event'], meta: { supportOnly: true } },
    { type: 'type', answer: ['a'.repeat(41)], meta: {} },
  ]) assert.equal(createLetterActivity(q), q);
});

test('real letter activities preserve the authored cloze and its whole accepted construction', () => {
  const h = harness('andare', 'past'); h.until(s => s.type === 'question' && s.format === 'letters');
  const s = h.step(), q = h.question(), plain = buildJourneyQuestion(h.entry, s.chapter, s.target, { ...s, format: 'type' });
  assert.equal(q.type, 'letters'); assert.equal(q.prompt, plain.prompt); assert.deepEqual(q.answer, plain.answer);
  assert.ok(q.slots.some(slot => slot.kind === 'fixed' && slot.text === ' '));
  const { event } = h.answer(q);
  assert.equal(event.mode, 'recognition'); assert.ok(event.assistance.includes('letter-bank')); assert.equal(event.xp, 1);
  assert.equal(journeyTargetState(h.learning, event.objectiveId).independentCorrect, 0);
});

test('guided rotation keeps choices, then matching, then letters before independent writing', () => {
  const h = harness(); h.until(s => s.type === 'question'); assert.equal(h.question().type, 'mc');
  h.answer(); h.next(); assert.equal(h.question().type, 'pairs');
  const q = h.question(); for (const pair of q.pairs) h.pair(q, pair.targetId, pair.canonical);
  h.answer(q); h.next(); assert.equal(h.question().type, 'letters');
  h.until(s => s.type === 'question' && s.phase === 'independent');
  assert.equal(h.question().type, 'type'); assert.equal(h.question().meta.evidenceMode, 'production');
});

test('boards use three taught same-group targets and preserve the distinct formal role', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs');
  const q = h.question(), group = h.step().group;
  assert.equal(q.pairs.length, 3); assert.equal(new Set(q.pairs.map(p => p.targetId)).size, 3);
  assert.ok(q.pairs.every(p => group.targets.some(t => t.id === p.targetId)));
  assert.ok(q.pairs.some(p => p.meta.role === 'formal' && p.label.includes('Lei')));
  assert.deepEqual(q, h.question());
  assert.notDeepEqual(q.leftOrder, q.pairs.map(p => p.id));
});

test('identical ordinary and polite forms can use either physical tile without a false error', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs');
  const q = h.question(), ordinary = q.pairs.find(p => p.meta.person === 2 && p.meta.role !== 'formal'), formal = q.pairs.find(p => p.meta.role === 'formal');
  assert.equal(ordinary.canonical, formal.canonical);
  assert.equal(gradePairActivity(q, { targetId: ordinary.targetId, given: formal.canonical }).ok, true);
  assert.equal(gradePairActivity(q, { targetId: formal.targetId, given: ordinary.canonical }).ok, true);
});

test('overlapping compound alternatives cannot consume the only form a remaining person accepts', () => {
  const h = harness('andare', 'past'); h.until(s => s.type === 'question' && s.format === 'pairs');
  const q = h.question(), ordinary = q.pairs.find(p => p.meta.person === 2 && p.meta.role !== 'formal'), formal = q.pairs.find(p => p.meta.role === 'formal');
  assert.equal(ordinary.canonical, 'è andata'); assert.equal(formal.canonical, 'è andata');
  assert.match(formal.label, /woman/);
  // Enumerate every correct tile assignment, checking that another complete
  // matching always exists after any valid first choice.
  function finish(left, right) {
    if (!left.length) return true;
    return right.some((tile, index) => gradePairActivity(q, { targetId: left[0].targetId, given: tile.text }).ok && finish(left.slice(1), right.filter((_, j) => j !== index)));
  }
  for (const pair of q.pairs) for (const tile of q.rightTiles) if (gradePairActivity(q, { targetId: pair.targetId, given: tile.text }).ok) assert.equal(finish(q.pairs.filter(p => p !== pair), q.rightTiles.filter(t => t !== tile)), true);
});

test('word article boards hold up to four rows, keep decoy rows flagged and take their own prompt', () => {
  const base = { id: 'base', type: 'mc', answer: ['la'], meta: { shortWord: true } };
  const row = (targetId, label, answer, decoy = false) => ({ targetId, label, decoy, question: { answer: [answer], meta: { skill: decoy ? 'article' : label === 'le' ? 'plural' : 'article' } } });
  const rows = [row('article', 'la', 'casa'), row('plural', 'le', 'case'), row('article::decoy::0', 'il', 'libro', true), row('article::decoy::1', 'i', 'gatti', true)];
  const board = createPairActivity(base, rows, { seed: 3, prompt: '<div class="big md">Match each article to its noun</div>' });
  assert.equal(board.type, 'pairs'); assert.equal(board.pairs.length, 4); assert.equal(board.rightTiles.length, 4);
  assert.deepEqual(board.pairs.map(p => [p.id, p.label, p.canonical, !!p.decoy]), [['article', 'la', 'casa', false], ['plural', 'le', 'case', false], ['article::decoy::0', 'il', 'libro', true], ['article::decoy::1', 'i', 'gatti', true]]);
  assert.ok(!('decoy' in board.pairs[0])); assert.equal(board.prompt, '<div class="big md">Match each article to its noun</div>');
  assert.equal(createPairActivity(base, rows).prompt, '<div class="big md">Match the pairs</div>');
  assert.equal(createPairActivity(base, [...rows, row('article::decoy::2', 'gli', 'alberi', true)]), base, 'five rows fall back to the choice');
  const invariable = createPairActivity(base, [row('article', 'il', 'caffè'), row('plural', 'i', 'caffè'), row('article::decoy::0', 'la', 'casa', true)]);
  assert.equal(invariable.type, 'pairs'); assert.deepEqual(invariable.rightTiles.map(t => t.text).sort(), ['caffè', 'caffè', 'casa']);
  assert.equal(gradePairActivity(invariable, { targetId: 'plural', given: 'caffè' }).ok, true);
});

test('an unsafe overlap pattern falls back instead of producing an unsolvable board', () => {
  const base = { id: 'base', type: 'type', answer: ['a'], meta: {} };
  const pairs = [['a', 'b'], ['b', 'c'], ['a', 'c']].map((answer, i) => ({ targetId: `target-${i}`, label: String(i), question: { answer, meta: {} } }));
  assert.equal(createPairActivity(base, pairs), base);
});

test('per-pair evidence is zero-XP, stable, deduplicated and cannot advance the active board', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs');
  const q = h.question(), active = clone(h.session.journey.current), pair = q.pairs[1], before = h.session.index;
  const grade = gradePairActivity(q, { targetId: pair.targetId, given: pair.canonical });
  const first = journeyPairAttempt(h.plan, h.session, q, grade, { targetId: pair.targetId, attempt: 0, now: START });
  const second = journeyPairAttempt(h.plan, h.session, q, grade, { targetId: pair.targetId, attempt: 0, now: START + 500 });
  assert.equal(first.id, second.id); assert.equal(first.xp, 0); assert.equal(first.countStats, false);
  const { event } = h.record(first, true);
  assert.equal(h.learning.events[event.id].xp, 0); assert.equal(h.session.index, before + 1);
  assert.deepEqual(h.session.journey.current, active); assert.equal(h.session.journey.awaitingContinue, false);
  const saved = clone(h.session); const duplicate = recordAttempt(h.learning, event);
  assert.equal(duplicate.added, false); assert.deepEqual(recordJourneyPairAttempt(h.plan, h.session, event, duplicate), saved);
  assert.equal(journeyPairAttempt(h.plan, h.session, q, grade, { targetId: pair.targetId, attempt: 1 }), null);
});

test('a pair error belongs to its actual person and triggers that person’s detour after the board', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs');
  const q = h.question(), activeId = h.step().targetId;
  const ordinary = q.pairs.find(p => p.meta.person === 2 && p.meta.role !== 'formal'), wrong = q.pairs.find(p => p.meta.person === 1).canonical;
  assert.notEqual(ordinary.targetId, activeId);
  const { event } = h.pair(q, ordinary.targetId, wrong);
  assert.equal(event.objectiveId, ordinary.targetId); assert.equal(event.person, 2); assert.equal(event.ok, false);
  assert.ok(event.errorTags.includes('person'));
  assert.ok(skillState(h.learning, ordinary.targetId).unresolvedErrors.some(e => e.tag === 'person'));
  assert.equal(h.step().targetId, activeId); assert.equal(h.step().awaitingContinue, false);
  for (const pair of q.pairs) h.pair(q, pair.targetId, pair.canonical, pair === ordinary ? 1 : 0);
  h.answer(q); h.next();
  assert.equal(h.step().type, 'repair'); assert.equal(h.step().targetId, ordinary.targetId);
  assert.equal(h.step().repairTag, 'person');
});

test('partial board evidence and UI selections survive local normalization without reward replay', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs'); const q = h.question();
  h.pair(q, q.pairs[0].targetId, q.pairs[0].canonical);
  h.session.ui = { activity: { questionId: h.step().questionId, matched: [q.pairs[0].targetId], selected: q.pairs[1].targetId } };
  const domain = normalizeLearning({ ...h.learning, session: h.session, sessions: { lesson: h.session } });
  assert.deepEqual(domain.session.journey.pairMatches, h.session.journey.pairMatches);
  assert.deepEqual(domain.session.ui.activity, h.session.ui.activity);
  h.session = domain.session;
  for (const pair of q.pairs.slice(1)) h.pair(q, pair.targetId, pair.canonical);
  const before = Object.values(h.learning.events).reduce((sum, e) => sum + e.xp, 0);
  const { event } = h.answer(q);
  assert.equal(event.xp, 1); assert.equal(Object.values(h.learning.events).reduce((sum, e) => sum + e.xp, 0), before + 1);
  assert.equal(h.step().awaitingContinue, true);
  assert.equal(journeyAttempt(h.plan, h.session, q, gradeQuestion(q, q.answer[0])), null);
  for (const pair of q.pairs) assert.equal(journeyTargetState(h.learning, pair.targetId).independentCorrect, 0);
});

test('a board cannot report correct completion before every actual pair was recorded', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs'); const q = h.question();
  const correct = gradeQuestion(q, q.answer[0]);
  assert.equal(journeyAttempt(h.plan, h.session, q, correct), null);
  for (const pair of q.pairs.slice(0, 2)) h.pair(q, pair.targetId, pair.canonical);
  assert.equal(journeyAttempt(h.plan, h.session, q, correct), null);
  assert.equal(journeyPairAttempt(h.plan, h.session, q, correct, { targetId: 'another-entry', attempt: 0 }), null);
  h.pair(q, q.pairs[2].targetId, q.pairs[2].canonical);
  assert.ok(journeyAttempt(h.plan, h.session, q, correct));
});

test('older saved questions remain executable and malformed activity state fails closed', () => {
  const h = harness(); h.until(s => s.type === 'question');
  for (const format of ['type', 'mc', 'match', 'letters', 'pairs']) {
    const saved = clone(h.session); saved.journey.current.format = format;
    assert.equal(currentJourneyStep(h.plan, saved, h.learning).type, 'question');
  }
  const malformed = clone(h.session); malformed.journey.pairMatches = { board: 'not an array' };
  assert.equal(currentJourneyStep(h.plan, malformed, h.learning).type, 'unavailable');
});

test('persisted pair evidence replays only its missing cursor update after a reload', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs'); const q = h.question();
  const oldSession = clone(h.session), pair = q.pairs[0];
  const { event } = h.pair(q, pair.targetId, pair.canonical);
  const duplicate = recordAttempt(h.learning, event); assert.equal(duplicate.added, false);
  const replayed = recordJourneyPairAttempt(h.plan, oldSession, event, duplicate);
  assert.equal(replayed.index, oldSession.index + 1);
  assert.ok(replayed.journey.pairMatches[oldSession.journey.current.questionId].includes(pair.targetId));
  assert.equal(h.learning.events[event.id].xp, 0);
  assert.deepEqual(recordJourneyPairAttempt(h.plan, replayed, event, duplicate), replayed);
  assert.deepEqual(recordJourneyPairAttempt(h.plan, oldSession, event, { added: false }), oldSession);
});

test('a persisted aggregate restores feedback once using the stored canonical result', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs'); const q = h.question();
  for (const pair of q.pairs) h.pair(q, pair.targetId, pair.canonical);
  const oldSession = clone(h.session), { event } = h.answer(q), duplicate = recordAttempt(h.learning, event);
  const replayed = recordJourneyAttempt(h.plan, oldSession, { ...event, ok: false }, duplicate);
  assert.equal(replayed.journey.awaitingContinue, true); assert.equal(replayed.journey.lastAttempt.ok, true);
  assert.equal(replayed.index, oldSession.index + 1); assert.equal(h.learning.events[event.id].xp, 1);
  assert.deepEqual(recordJourneyAttempt(h.plan, replayed, event, duplicate), replayed);
  assert.deepEqual(recordJourneyAttempt(h.plan, oldSession, event, { added: false }), oldSession);
});

test('a recovered wrong pair remains wrong and a later correct try has a distinct event identity', () => {
  const h = harness(); h.until(s => s.type === 'question' && s.format === 'pairs'); const q = h.question();
  const target = q.pairs.find(p => p.meta.person === 2), wrong = q.pairs.find(p => p.meta.person === 1).canonical;
  const stale = clone(h.session), { event } = h.pair(q, target.targetId, wrong, 0);
  const duplicate = recordAttempt(h.learning, event);
  h.session = recordJourneyPairAttempt(h.plan, stale, { ...event, ok: true, outcome: 'correct' }, duplicate);
  assert.ok(h.session.journey.pairRepairs[target.targetId]);
  assert.ok(!h.session.journey.pairMatches?.[h.step().questionId]?.includes(target.targetId));
  const fresh = h.pair(q, target.targetId, target.canonical, 1).event;
  assert.notEqual(fresh.id, event.id); assert.equal(h.learning.events[event.id].ok, false); assert.equal(h.learning.events[fresh.id].ok, true);
  assert.equal(h.learning.events[event.id].xp + h.learning.events[fresh.id].xp, 0);
});

test('varied supported activities accompany recall without consuming independent variants or mastery', () => {
  const h = harness(), supportedFormats = new Set(); let checks = 0, turns = 0;
  while (h.step().type !== 'recap' && turns++ < 300) {
    const s = h.step();
    if (s.type === 'question' && !s.awaitingContinue) {
      const q = h.question(), count = h.session.journey.variants[s.targetId]?.independent || 0;
      const evidence = journeyTargetState(h.learning, s.targetId).independentCorrect;
      const supported = s.phase !== 'independent' && ['mc', 'letters', 'pairs'].includes(q.type);
      if (supported) supportedFormats.add(q.type);
      if (s.phase === 'independent') { assert.equal(q.type, 'type'); checks++; }
      if (q.type === 'pairs') for (const pair of q.pairs) h.pair(q, pair.targetId, pair.canonical);
      h.answer(q);
      if (supported) {
        assert.equal(h.session.journey.variants[s.targetId].independent, count);
        assert.equal(journeyTargetState(h.learning, s.targetId).independentCorrect, evidence);
      }
    } else h.next();
  }
  assert.equal(h.step().type, 'recap'); assert.ok(checks >= 16);
  for (const format of ['mc', 'letters', 'pairs']) assert.ok(supportedFormats.has(format), `lesson includes ${format}`);
  const states = h.step().progress.chapters.find(c => c.id === 'present').targets;
  assert.ok(states.every(state => state.ready && (state.supportedCompletion ? state.independentCorrect === 0 : state.independentCorrect >= 2)));
});

console.log(`\n${tests} lesson activity checks passed.`);
