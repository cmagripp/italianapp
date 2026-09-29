import assert from 'node:assert/strict';
import {
  createLearning, normalizeLearning, mergeLearning, resetLearning, recordAttempt,
  skillState, allSkills, createSession, selectNext, applySessionAttempt, deferObjective,
} from '../js/learning/model.js';

const START = 1700000000000;
const DAY = 86400e3;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

function fixture() {
  let learning = createLearning(START), sequence = 0;
  const indices = new Map();
  return {
    get learning() { return learning; },
    set learning(value) { learning = value; },
    add(patch = {}) {
      const sessionId = patch.sessionId || 'lesson';
      const index = indices.get(sessionId) || 0;
      const event = {
        id: `device-a:${++sequence}`, epochId: learning.epoch.id, deviceId: 'device-a', sequence,
        sessionId, index, at: START + sequence * 1000,
        objectiveId: 'v:andare:past:form', entryId: 'v:andare', kind: 'verb', skill: 'conjugation', tense: 'passatoProssimo', person: 0,
        mode: 'production', variantId: `prompt-${sequence}`, contextId: '', ok: true, outcome: 'correct',
        assistance: [], firstAttempt: true, errorTags: [], components: [], xp: 2,
        ...patch,
      };
      indices.set(sessionId, index + 1);
      const result = recordAttempt(learning, event); learning = result.learning;
      return { event, result };
    },
    spacer(patch = {}) { return this.add({ objectiveId: 'w:casa:recall', entryId: 'w:casa', kind: 'word', skill: 'recall', tense: null, person: null, mode: 'recognition', ...patch }); },
    ready(patch = {}) {
      for (let i = 0; i < 4; i++) {
        this.add({ variantId: `template-${i % 2}`, ...patch });
        if (i < 3) { this.spacer(); this.spacer(); }
      }
      return skillState(learning, patch.objectiveId || 'v:andare:past:form', START);
    },
  };
}
const ID = 'v:andare:past:form';
const descriptors = [
  { id: ID, entryId: 'v:andare', kind: 'verb', stage: 'past', tense: 'passatoProssimo', skill: 'conjugation' },
  { id: 'v:andare:past:aux', entryId: 'v:andare', kind: 'verb', stage: 'past', tense: 'passatoProssimo', skill: 'auxiliary' },
  { id: 'w:casa:recall', entryId: 'w:casa', kind: 'word', skill: 'recall' },
];

test('new domains have a shared initial epoch and retain no inferred mastery', () => {
  assert.deepEqual(createLearning(START).epoch, createLearning(START + DAY).epoch);
  const empty = normalizeLearning(null, START);
  assert.equal(skillState(empty, ID, START).status, 'new');
  assert.equal(skillState(empty, ID, START).ready, false);
  assert.deepEqual(allSkills(empty, START), []);
});

test('one lucky production answer and repeated recognition cannot bypass a skill', () => {
  const f = fixture(); f.add();
  for (let i = 0; i < 12; i++) f.add({ mode: 'recognition' });
  const state = skillState(f.learning, ID, START);
  assert.equal(state.independentCorrect, 1);
  assert.equal(state.recognitionCorrect, 12);
  assert.equal(state.ready, false);
});

test('four correct answers still require genuine variation and intervening questions', () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) f.add();
  assert.equal(skillState(f.learning, ID, START).spacedSuccess, false);
  assert.equal(skillState(f.learning, ID, START).ready, false);
  const repeated = fixture();
  for (let i = 0; i < 8; i++) repeated.add({ variantId: 'same-prompt' });
  assert.equal(skillState(repeated.learning, ID, START).independentCorrect, 1);
  assert.equal(skillState(repeated.learning, ID, START).ready, false);
});

test('varied independent repeated retrieval becomes ready, not remembered', () => {
  const f = fixture(), state = f.ready();
  assert.equal(state.independentCorrect, 4);
  assert.equal(state.variantCount, 2);
  assert.equal(state.spacedSuccess, true);
  assert.equal(state.ready, true);
  assert.equal(state.remembered, false);
  assert.deepEqual(state.independentPersons, [0]);
});

test('assisted and retried answers cannot contribute production mastery', () => {
  const f = fixture();
  for (let i = 0; i < 8; i++) f.add({ assistance: ['hint'] });
  assert.equal(skillState(f.learning, ID, START).independentCorrect, 0);
  assert.equal(skillState(f.learning, ID, START).ready, false);
  for (let i = 0; i < 4; i++) f.add({ firstAttempt: false });
  assert.equal(skillState(f.learning, ID, START).independentCorrect, 0);
  assert.equal(skillState(f.learning, ID, START).unresolvedErrors.length, 1);
});

test('wrong recognition blocks an already ready skill until varied production repair', () => {
  const f = fixture(); assert.equal(f.ready().ready, true);
  f.add({ mode: 'recognition', ok: false, outcome: 'incorrect', errorTags: ['auxiliary'] });
  assert.equal(skillState(f.learning, ID, START).ready, false);
  f.add({ variantId: 'repair-one' });
  assert.equal(skillState(f.learning, ID, START).ready, false);
  f.add({ variantId: 'repair-two' });
  assert.equal(skillState(f.learning, ID, START).ready, true);
});

test('correct assistance and revealing an answer also require subsequent repair', () => {
  for (const patch of [{ assistance: ['answer-audio'] }, { ok: false, outcome: 'revealed' }]) {
    const f = fixture(); f.ready(); f.add(patch);
    assert.equal(skillState(f.learning, ID, START).ready, false);
    f.add({ variantId: 'repair-a' });
    assert.equal(skillState(f.learning, ID, START).ready, false);
    f.add({ variantId: 'repair-b' });
    assert.equal(skillState(f.learning, ID, START).ready, true);
  }
});

test('component errors cannot be cleared by unrelated or unobserved successes', () => {
  const f = fixture(); f.ready();
  f.add({ mode: 'recognition', ok: false, outcome: 'incorrect', components: [{ skill: 'auxiliary', ok: false, errorTag: 'wrong-auxiliary' }, { skill: 'participle', ok: true }] });
  f.add({ components: [{ skill: 'participle', ok: true }] });
  f.add({ components: [{ skill: 'participle', ok: true }] });
  let state = skillState(f.learning, ID, START);
  assert.equal(state.ready, false);
  assert.equal(state.components.auxiliary.confirmations, 0);
  assert.equal(state.components.participle.independentCorrect, 2);
  f.add({ components: [{ skill: 'auxiliary', ok: true }] });
  assert.equal(skillState(f.learning, ID, START).ready, false);
  f.add({ components: [{ skill: 'auxiliary', ok: true }] });
  state = skillState(f.learning, ID, START);
  assert.equal(state.components.auxiliary.unresolved, false);
  assert.equal(state.ready, true);
});

test('a repeated component error restarts its confirmation sequence only', () => {
  const f = fixture(); f.ready();
  f.add({ mode: 'recognition', ok: false, outcome: 'incorrect', components: [{ skill: 'auxiliary', ok: false }, { skill: 'participle', ok: false }] });
  f.add({ components: [{ skill: 'auxiliary', ok: true }, { skill: 'participle', ok: true }] });
  f.add({ components: [{ skill: 'auxiliary', ok: true }, { skill: 'participle', ok: true }] });
  f.add({ mode: 'recognition', ok: false, outcome: 'incorrect', components: [{ skill: 'auxiliary', ok: false }] });
  const state = skillState(f.learning, ID, START);
  assert.equal(state.components.auxiliary.confirmations, 0);
  assert.equal(state.components.auxiliary.unresolved, true);
  assert.equal(state.components.participle.unresolved, false);
});

test('a correct component is retained even when another makes the full answer wrong', () => {
  const f = fixture();
  f.add({ ok: false, outcome: 'incorrect', components: [{ skill: 'auxiliary', ok: false }, { skill: 'participle', ok: true }] });
  const state = skillState(f.learning, ID, START);
  assert.equal(state.independentCorrect, 0);
  assert.equal(state.components.participle.independentCorrect, 1);
  assert.equal(state.components.auxiliary.independentCorrect, 0);
});

test('a tu person error cannot be repaired by successful io or noi answers', () => {
  const f = fixture(); f.ready();
  f.add({ mode: 'recognition', ok: false, outcome: 'incorrect', person: 1, components: [{ skill: 'person', ok: false, errorTag: 'person' }] });
  f.add({ person: 0, components: [{ skill: 'person', ok: true }] });
  f.add({ person: 3, components: [{ skill: 'person', ok: true }] });
  assert.equal(skillState(f.learning, ID, START).components.person.unresolved, false);
  assert.equal(skillState(f.learning, ID, START).personEvidence['1'].unresolved, true);
  assert.equal(skillState(f.learning, ID, START).ready, false);
  f.spacer(); f.spacer();
  const session = createSession({ id: 'lesson', entryId: 'v:andare', objectiveIds: [ID], now: START });
  assert.equal(selectNext(f.learning, session, descriptors, { now: START }).repairPerson, 1);
  f.add({ person: 1, variantId: 'tu-context-a', components: [{ skill: 'person', ok: true }] });
  assert.equal(skillState(f.learning, ID, START).ready, false);
  f.add({ person: 1, variantId: 'tu-context-b', components: [{ skill: 'person', ok: true }] });
  assert.equal(skillState(f.learning, ID, START).personEvidence['1'].unresolved, false);
  assert.equal(skillState(f.learning, ID, START).ready, true);
});

test('remembered requires two varied successes in another session after 24 hours', () => {
  const f = fixture(); const ready = f.ready();
  f.add({ sessionId: 'later', at: ready.readyAt + DAY - 1, variantId: 'later-a' });
  assert.equal(skillState(f.learning, ID, START).remembered, false);
  f.add({ sessionId: 'later', at: ready.readyAt + DAY + 1, variantId: 'later-b' });
  assert.equal(skillState(f.learning, ID, START).remembered, false);
  f.add({ sessionId: 'later', at: ready.readyAt + DAY + 2, variantId: 'later-c' });
  assert.equal(skillState(f.learning, ID, START).remembered, true);
  f.add({ sessionId: 'later', at: ready.readyAt + DAY + 3, mode: 'recognition', ok: false, outcome: 'incorrect' });
  assert.equal(skillState(f.learning, ID, START).remembered, false);
});

test('same-session practice advances SRS at most once; wrong evidence brings it sooner', () => {
  const f = fixture(); f.ready();
  const ready = skillState(f.learning, ID, START);
  assert.equal(ready.srs.reps, 1);
  f.add({ sessionId: 'reopened', at: START + 100000, variantId: 'fresh' });
  assert.equal(skillState(f.learning, ID, START).srs.reps, 1);
  f.add({ sessionId: 'reopened', at: START + 110000, ok: false, outcome: 'incorrect' });
  const state = skillState(f.learning, ID, START);
  assert.equal(state.srs.reps, 0);
  assert.equal(state.due, START + 110000 + 600000);
  f.add({ sessionId: 'reopened-again', at: START + 111000, variantId: 'new-after-lapse' });
  assert.equal(skillState(f.learning, ID, START).srs.reps, 0);
  assert.equal(skillState(f.learning, ID, START).due, state.due);
  f.add({ sessionId: 'meaningful-review', at: state.due + 1, variantId: 'new-after-due' });
  assert.equal(skillState(f.learning, ID, START).srs.reps, 1);
});

test('one event cannot count or reward twice, including after export/import and merge', () => {
  const f = fixture(); const { event } = f.add();
  const again = recordAttempt(f.learning, event);
  assert.equal(again.added, false);
  const imported = normalizeLearning(JSON.parse(JSON.stringify(f.learning)), START);
  const merged = mergeLearning(f.learning, imported, START);
  assert.equal(Object.keys(merged.events).length, 1);
  assert.equal(Object.values(merged.events).reduce((n, e) => n + e.xp, 0), 2);
  assert.equal(skillState(merged, ID, START).independentCorrect, 1);
});

test('offline merges commute, associate and keep concurrent skill evidence', () => {
  const a = fixture(), b = fixture(), c = fixture();
  a.add({ id: 'a', deviceId: 'a', at: START, variantId: 'a' });
  b.add({ id: 'b', deviceId: 'b', at: START, objectiveId: 'v:andare:past:aux', variantId: 'b' });
  c.add({ id: 'c', deviceId: 'c', at: START, variantId: 'c' });
  const ab = mergeLearning(a.learning, b.learning, START), ba = mergeLearning(b.learning, a.learning, START);
  assert.deepEqual(ab, ba);
  assert.deepEqual(mergeLearning(ab, c.learning, START), mergeLearning(a.learning, mergeLearning(b.learning, c.learning, START), START));
  assert.equal(allSkills(ab, START).length, 2);
  assert.equal(Object.keys(mergeLearning(ab, ab, START).events).length, 2);
});

test('conflicting copies of an event have one deterministic identity', () => {
  const a = fixture(), b = fixture();
  a.add({ id: 'same', ok: true }); b.add({ id: 'same', ok: false, outcome: 'incorrect' });
  assert.deepEqual(mergeLearning(a.learning, b.learning, START), mergeLearning(b.learning, a.learning, START));
  assert.equal(Object.keys(mergeLearning(a.learning, b.learning, START).events).length, 1);
});

test('reset epochs prevent old backups, pending events and sessions from returning', () => {
  const f = fixture(); const { event } = f.add();
  f.learning.session = createSession({ id: 'session', entryId: 'v:andare', objectiveIds: [ID], now: START });
  const reset = resetLearning(f.learning, START + 5000, 'reset-b');
  assert.equal(recordAttempt(reset, event).added, false);
  assert.deepEqual(mergeLearning(reset, f.learning, START), mergeLearning(f.learning, reset, START));
  assert.deepEqual(mergeLearning(f.learning, reset, START).events, {});
  assert.equal(mergeLearning(f.learning, reset, START).session, null);
  const later = resetLearning(reset, START - 1000, 'clock-went-back');
  assert.ok(later.epoch.at > reset.epoch.at);
});

test('session state is plain, resumable, deduplicated and preserves safe UI extras', () => {
  const f = fixture();
  let session = createSession({ id: 'lesson', entryId: 'v:andare', objectiveIds: [ID], now: START });
  session.ui = { question: { prompt: 'Example', options: ['a', 'b'] }, phase: 'feedback' };
  session.accidentalCallback = () => false;
  const { event, result } = f.add();
  session = applySessionAttempt(session, event, result);
  assert.equal(session.index, 1);
  assert.equal(applySessionAttempt(session, event, result).index, 1);
  f.learning.session = session; f.learning.sessions = { 'v:andare|lesson': session };
  const restored = normalizeLearning(JSON.parse(JSON.stringify(f.learning)), START);
  assert.deepEqual(restored.sessions['v:andare|lesson'].ui, session.ui);
  assert.equal(restored.session.accidentalCallback, undefined);
});

test('session map merges preserve independent entries and latest checkpoint', () => {
  const a = createLearning(START), b = createLearning(START);
  a.session = createSession({ id: 'a', entryId: 'v:andare', objectiveIds: [ID], now: START });
  b.session = createSession({ id: 'b', entryId: 'w:casa', objectiveIds: ['w:casa:recall'], now: START + 1 });
  const merged = mergeLearning(a, b, START);
  assert.equal(Object.keys(merged.sessions).length, 2);
  assert.equal(merged.session.id, 'b');
});

test('selection holds the active objective, inserts two spacers and has no retry cap', () => {
  const f = fixture();
  let session = createSession({ id: 'lesson', entryId: 'v:andare', objectiveIds: [ID, descriptors[1].id], now: START });
  let selection = selectNext(f.learning, session, descriptors, { now: START });
  assert.equal(selection.mode, 'recognition');
  let attempt = f.add({ mode: 'recognition' }); session = applySessionAttempt(session, attempt.event, attempt.result);
  assert.equal(selectNext(f.learning, session, descriptors, { now: START }).mode, 'production');
  attempt = f.add({ ok: false, outcome: 'incorrect' }); session = applySessionAttempt(session, attempt.event, attempt.result);
  for (let i = 0; i < 2; i++) {
    selection = selectNext(f.learning, session, [descriptors[0]], { now: START });
    assert.equal(selection.spacer, true);
    assert.equal(selection.objective.id, ID); // no other objective was taught
    attempt = f.add({ mode: 'recognition' }); session = applySessionAttempt(session, attempt.event, attempt.result);
  }
  assert.equal(selectNext(f.learning, session, descriptors, { now: START }).mode, 'production');
  for (let i = 0; i < 30; i++) {
    attempt = f.add({ ok: false, outcome: 'incorrect' }); session = applySessionAttempt(session, attempt.event, attempt.result);
  }
  assert.equal(selectNext(f.learning, session, descriptors, { now: START }).activeObjectiveId, ID);
  assert.equal(selectNext(f.learning, session, descriptors, { now: START }).done, undefined);
});

test('cold-start supplemental questions space checks without changing the main objective', () => {
  const f = fixture(); f.add();
  const session = createSession({ id: 'lesson', entryId: 'v:andare', objectiveIds: [ID], now: START });
  const selection = selectNext(f.learning, session, descriptors, { now: START });
  assert.equal(selection.spacer, true);
  assert.notEqual(selection.objective.id, ID);
  assert.equal(selection.activeObjectiveId, ID);
  assert.equal(selection.mode, 'recognition');
  assert.notEqual(selection.objective.entryId, 'v:andare');
});

test('two different-entry spacers keep a single-answer word eligible for cold retrieval', () => {
  const f = fixture();
  const target = { id: 'w:casa:recall', entryId: 'w:casa', kind: 'word', skill: 'recall' };
  const spacers = [
    { id: 'w:libro:recall', entryId: 'w:libro', kind: 'word', skill: 'recall', spacerOnly: true },
    { id: 'w:pane:recall', entryId: 'w:pane', kind: 'word', skill: 'recall', spacerOnly: true },
  ];
  let session = createSession({ id: 'lesson', entryId: target.entryId, objectiveIds: [target.id], now: START });
  let attempt = f.add({ objectiveId: target.id, entryId: target.entryId, kind: 'word', skill: 'recall' });
  session = applySessionAttempt(session, attempt.event, attempt.result);
  const first = selectNext(f.learning, session, [target, ...spacers], { now: START });
  assert.equal(first.spacer, true); assert.notEqual(first.objective.entryId, target.entryId);
  attempt = f.add({ objectiveId: first.objective.id, entryId: first.objective.entryId, kind: 'word', skill: 'recall', mode: 'recognition' });
  session = applySessionAttempt(session, attempt.event, attempt.result);
  const second = selectNext(f.learning, session, [target, ...spacers], { now: START });
  assert.equal(second.spacer, true); assert.notEqual(second.objective.entryId, first.objective.entryId);
  attempt = f.add({ objectiveId: second.objective.id, entryId: second.objective.entryId, kind: 'word', skill: 'recall', mode: 'recognition' });
  session = applySessionAttempt(session, attempt.event, attempt.result);
  const resumed = selectNext(f.learning, session, [target, ...spacers], { now: START });
  assert.equal(resumed.objective.id, target.id); assert.equal(resumed.mode, 'production');
  assert.equal(resumed.spacer, false);
});

test('a clear production error triggers a supported repair before another full production check', () => {
  const f = fixture();
  let session = createSession({ id: 'lesson', entryId: 'v:andare', objectiveIds: [ID], now: START });
  let attempt = f.add({ ok: false, outcome: 'incorrect', errorTags: ['auxiliary'], components: [{ skill: 'auxiliary', ok: false }] });
  session = applySessionAttempt(session, attempt.event, attempt.result);
  for (let i = 0; i < 2; i++) {
    const selected = selectNext(f.learning, session, descriptors, { now: START });
    assert.equal(selected.spacer, true);
    attempt = f.add({ objectiveId: selected.objective.id, entryId: selected.objective.entryId, kind: selected.objective.kind, skill: selected.objective.skill, mode: 'recognition' });
    session = applySessionAttempt(session, attempt.event, attempt.result);
  }
  const repair = selectNext(f.learning, session, descriptors, { now: START });
  assert.equal(repair.objective.id, ID); assert.equal(repair.mode, 'recognition'); assert.equal(repair.repairTag, 'auxiliary');
  attempt = f.add({ mode: 'recognition', components: [{ skill: 'auxiliary', ok: true }] });
  session = applySessionAttempt(session, attempt.event, attempt.result);
  assert.equal(selectNext(f.learning, session, descriptors, { now: START }).mode, 'production');
  for (let i = 0; i < 4; i++) f.add({ mode: 'recognition', components: [{ skill: 'auxiliary', ok: true }] });
  assert.equal(skillState(f.learning, ID, START).independentCorrect, 0);
  assert.equal(skillState(f.learning, ID, START).ready, false);
});

test('explicit skip advances without mastery or a lapse and remains skipped this session', () => {
  const f = fixture(); f.add({ ok: false, outcome: 'incorrect' });
  const session = createSession({ id: 'lesson', entryId: 'v:andare', objectiveIds: [ID, descriptors[1].id], now: START });
  const skipped = deferObjective(session, ID, START + 5);
  assert.equal(selectNext(f.learning, skipped, descriptors, { now: START }).objective.id, descriptors[1].id);
  assert.equal(skillState(f.learning, ID, START).ready, false);
  assert.equal(skillState(f.learning, ID, START).srs.lapses, 1);
  assert.equal(Object.hasOwn(session.deferred, ID), false); // pure
  const newSession = createSession({ id: 'next', entryId: 'v:andare', objectiveIds: [ID], now: START + DAY });
  assert.equal(selectNext(f.learning, newSession, descriptors, { now: START }).objective.id, ID);
});

test('missing content blocks rather than certifying or silently advancing an objective', () => {
  const session = createSession({ id: 'lesson', entryId: 'v:andare', objectiveIds: ['missing', ID], now: START });
  const selected = selectNext(createLearning(START), session, descriptors, { now: START });
  assert.equal(selected.done, false);
  assert.equal(selected.blocked, true);
  assert.equal(selected.objectiveId, 'missing');
});

test('review selects an already ready objective for two later varied checks', () => {
  const f = fixture(); const ready = f.ready();
  let session = createSession({ id: 'review', entryId: 'v:andare', objectiveIds: [ID], now: ready.readyAt + DAY, mode: 'review' });
  assert.equal(selectNext(f.learning, session, descriptors, { now: ready.readyAt + DAY }).objective.id, ID);
  for (let i = 0; i < 2; i++) {
    const attempt = f.add({ sessionId: 'review', at: ready.readyAt + DAY + i + 1, variantId: `review-${i}` });
    session = applySessionAttempt(session, attempt.event, attempt.result);
    assert.equal(!!selectNext(f.learning, session, descriptors, { now: ready.readyAt + DAY }).done, i === 1);
  }
  assert.deepEqual(session.reviewedObjectiveIds, [ID]);
});

test('a checkpoint requires fresh checks and its explicitly required person coverage', () => {
  const f = fixture(); const ready = f.ready();
  let session = createSession({ id: 'checkpoint', entryId: 'v:andare', objectiveIds: [ID], now: ready.readyAt + DAY, mode: 'checkpoint' });
  const pool = [{ ...descriptors[0], personsRequired: [0, 1, 2, 3, 4, 5] }];
  assert.equal(selectNext(f.learning, session, pool, { now: START }).done, undefined);
  for (let person = 0; person < 6; person++) {
    const attempt = f.add({ sessionId: 'checkpoint', at: ready.readyAt + DAY + person + 1, variantId: `checkpoint-${person}`, person });
    session = applySessionAttempt(session, attempt.event, attempt.result);
    assert.equal(!!selectNext(f.learning, session, pool, { now: START }).done, person === 5);
  }
  assert.deepEqual(skillState(f.learning, ID, START).sessionEvidence.checkpoint.independentPersons, [0, 1, 2, 3, 4, 5]);
});

test('summary cache remains time-correct and does not leak caller mutation', () => {
  const f = fixture(); f.ready();
  const first = skillState(f.learning, ID, START);
  assert.equal(first.isDue, false);
  first.components.injected = { unresolved: true };
  assert.equal(skillState(f.learning, ID, START + 2 * DAY).isDue, true);
  assert.equal(skillState(f.learning, ID, START).components.injected, undefined);
  f.learning.preferences.stage = 'future';
  assert.equal(skillState(f.learning, ID, START).ready, true);
});

test('normalization drops raw answers/callbacks and preserves capped reward metadata', () => {
  const f = fixture(); f.add({ rawAnswer: 'private text', html: '<script>bad</script>', xp: 99, callback: () => {} });
  const event = Object.values(f.learning.events)[0];
  assert.equal(event.rawAnswer, undefined); assert.equal(event.html, undefined); assert.equal(event.callback, undefined);
  assert.equal(event.xp, 3);
  const future = { ...f.learning, version: 99, futureField: { retained: true } };
  const ignored = recordAttempt(future, { ...event, id: 'new' });
  assert.equal(ignored.added, false);
  assert.deepEqual(ignored.learning.futureField, { retained: true });
});

test('future schemas roundtrip intact and cannot be interpreted, merged, or reset by v1', () => {
  const f = fixture(); f.ready();
  const future = JSON.parse(JSON.stringify(f.learning));
  future.version = 99;
  future.futureField = { format: ['new', { retained: true }] };
  Object.values(future.events)[0].futureEvidence = { scoring: { weight: 12 }, tokens: ['a', 'b'] };
  future.preferences.futureOption = { enabled: true };
  future.session = { id: 'future', futureState: { version: 4 } };
  assert.deepEqual(normalizeLearning(future, START), future);
  assert.deepEqual(normalizeLearning(JSON.parse(JSON.stringify(normalizeLearning(future, START))), START), future);
  const record = recordAttempt(future, { id: 'new', objectiveId: ID, at: START });
  assert.equal(record.added, false); assert.deepEqual(record.learning, future);
  assert.equal(skillState(future, ID, START).status, 'unknown');
  assert.equal(skillState(future, ID, START).ready, false);
  assert.deepEqual(allSkills(future, START), []);
  const session = createSession({ id: 'old-client', entryId: 'v:andare', objectiveIds: [ID], now: START });
  assert.equal(selectNext(future, session, descriptors, { now: START }).reason, 'unsupported-version');
  assert.throws(() => mergeLearning(f.learning, future, START), /newer version/);
  assert.throws(() => mergeLearning(future, f.learning, START), /newer version/);
  assert.throws(() => resetLearning(future, START, 'reset'), /newer version/);
  assert.deepEqual(normalizeLearning({ version: 99, payload: { unfamiliar: true } }, START), { version: 99, payload: { unfamiliar: true } });
});

console.log(`\n${passed} adaptive model checks passed.`);
