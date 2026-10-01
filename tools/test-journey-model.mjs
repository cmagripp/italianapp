#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLearning, recordAttempt, normalizeLearning, mergeLearning, resetLearning, skillState, learningSessionKey, LEARNING_VERSION } from '../js/learning/model.js';
import { createJourneySession, currentJourneyStep, advanceJourney, journeyAttempt, recordJourneyAttempt, journeyPairAttempt, recordJourneyPairAttempt, skipJourneyTarget, retryJourneyPending, chooseJourneyChapter, deferJourneyTarget, journeyProgress, journeyTargetState, journeyCaseProgress } from '../js/learning/journey.js';
import { buildLesson } from '../js/learning/lesson-content.js';
import { buildJourneyQuestion } from '../js/learning/lesson-questions.js';
import { gradeQuestion } from '../js/learning/diagnose.js';
import { gradePairActivity } from '../js/learning/lesson-activities.js';
const START = 1700000000000, DAY = 86400e3;
const clone = v => JSON.parse(JSON.stringify(v));
let count = 0;
function test(name, run) { try { run(); count++; console.log(`✓ ${name}`); } catch (e) { console.error(`✗ ${name}`); throw e; } }
const target = (key, person, extra = {}) => ({ id: `v:fixture::lesson::present::${key}`, skill: 'conjugation', tense: 'presente', person, role: 'ordinary', required: true, available: true, answerForms: [`form-${key}`], ...extra });
const mainTargets = [target('io', 0), target('tu', 1), target('lei', 2), target('formal', 2, { role: 'formal', skill: 'address', answerForms: ['form-lei'] })];
const plan = { version: 1, entryId: 'v:fixture', kind: 'verb', title: 'fixture', meaning: 'to practise', chapters: [
  { id: 'meet', title: 'Meet', groups: [{ id: 'meet', cards: [{ id: 'meaning', title: 'Meaning', body: 'A complete meaning.' }], targets: [] }] },
  { id: 'present', title: 'Present', tense: 'presente', groups: [
    { id: 'one', cards: [{ id: 'first', title: 'First group' }, { id: 'second', title: 'One bite at a time' }], targets: mainTargets.slice(0, 2) },
    { id: 'two', cards: [{ id: 'second-group', title: 'Another group' }], targets: mainTargets.slice(2) },
  ] },
] };
function harness(p = plan, options = {}) {
  let learning = options.learning || createLearning(START), time = options.now || START, serial = 0;
  let session = createJourneySession({ id: options.id || 'journey', plan: p, now: time, ...options });
  return {
    p, get learning() { return learning; }, set learning(x) { learning = x; },
    get session() { return session; }, set session(x) { session = x; },
    get now() { return time; }, step() { return currentJourneyStep(p, session, learning, time); },
    next() { session = advanceJourney(p, session, learning, { now: ++time }); return this.step(); },
    skip(id) { session = skipJourneyTarget(p, session, id, { now: ++time, learning }); return this.step(); },
    question() {
      const s = this.step(); assert.equal(s.type, 'question');
      return { type: s.phase === 'independent' ? 'type' : 'mc', answer: s.target.answerForms || ['ok'], meta: { targetId: s.target.id, skill: s.target.skill, mode: s.phase === 'independent' ? 'production' : 'recognition', variantId: `${s.target.id}:${s.variant % 2}`, contextId: `${s.target.id}:context-${s.variant % 2}` } };
    },
    pairAnswer(q, targetId, given, attempt = 0) {
      const grade = gradePairActivity(q, { targetId, given });
      const event = journeyPairAttempt(p, session, q, grade, { targetId, attempt, now: ++time }); assert.ok(event);
      Object.assign(event, { deviceId: 'test', sequence: ++serial, epochId: learning.epoch.id });
      const result = recordAttempt(learning, event); learning = result.learning;
      session = recordJourneyPairAttempt(p, session, event, result); return grade;
    },
    answer(patch = {}, q = this.question()) {
      const s = this.step(), grade = { ok: true, outcome: 'correct', errorTags: [], components: [{ skill: s.target.skill, ok: true }], ...patch };
      const event = journeyAttempt(p, session, q, grade, { now: ++time, assistance: patch.assistance || [] });
      assert.ok(event); Object.assign(event, { deviceId: 'test', sequence: ++serial, epochId: learning.epoch.id, xp: grade.ok ? 2 : 0 });
      const result = recordAttempt(learning, event); learning = result.learning;
      const before = session; session = recordJourneyAttempt(p, session, event, result);
      assert.equal(session.index, before.index + 1); assert.equal(this.step().awaitingContinue, true);
      return { event, result, before };
    },
    until(predicate, max = 250) {
      for (let i = 0; i < max; i++) {
        const s = this.step(); if (predicate(s)) return s;
        if (s.type === 'question' && !s.awaitingContinue) this.answer();
        else if (['teach', 'repair', 'recap'].includes(s.type) || s.awaitingContinue) this.next();
        else throw new Error(`Unexpected ${s.type}: ${JSON.stringify(s)}`);
      }
      throw new Error('Journey did not reach requested state within safety bound');
    },
  };
}
function addEvidence(learning, patches) {
  let serial = Object.keys(learning.events).length;
  for (const patch of patches) {
    const n = ++serial;
    learning = recordAttempt(learning, { id: `e${n}`, epochId: learning.epoch.id, deviceId: 'test', sequence: n, sessionId: 'evidence', index: n - 1, at: START + n,
      entryId: plan.entryId, kind: 'verb', objectiveId: mainTargets[0].id, targetId: mainTargets[0].id, policy: 'journey-v1', chapterId: 'present', contentVersion: 1, activityKind: 'independent', skill: 'conjugation', person: 0, role: 'ordinary', tense: 'presente', mode: 'production', variantId: `v${n % 2}`, contextId: `c${n % 2}`, ok: true, outcome: 'correct', firstAttempt: true, assistance: [], components: [], errorTags: [], ...patch }).learning;
  }
  return learning;
}
const gap = () => [{ objectiveId: mainTargets[1].id, mode: 'recognition', activityKind: 'guided' }, { objectiveId: mainTargets[2].id, mode: 'recognition', activityKind: 'guided' }];

test('Meet continues straight to Present teaching without an empty practice or recap', () => {
  const h = harness(); assert.equal(h.step().type, 'teach');
  const present = h.next(); assert.equal(present.type, 'teach'); assert.equal(present.chapter.id, 'present');
  assert.equal(present.card.id, 'first');
  const intro = journeyProgress(plan, h.session, h.learning).chapters[0];
  assert.equal(intro.covered, true); assert.equal(intro.total, 0); assert.equal(intro.ready, 0); assert.equal(intro.remembered, 0);
  assert.equal(h.session.index, 0); assert.deepEqual(h.learning.events, {});
  assert.equal(h.next().card.id, 'second');
  const q = h.next(); assert.equal(q.phase, 'guided'); assert.equal(q.target.id, mainTargets[0].id);
  h.answer(); assert.equal(journeyTargetState(h.learning, q.target).independentCorrect, 0);
  assert.equal(h.step().type, 'question'); assert.equal(h.step().awaitingContinue, true);
});

test('a saved old Meet recap continues without resetting its session, history, or UI', () => {
  const h = harness();
  const old = clone(h.session);
  old.journey.phase = 'recap'; old.journey.groupIndex = 1; old.journey.covered.meet = START;
  old.ui = { version: 2, exposures: { fixture: 0 }, paused: true, draft: '' };
  const restored = normalizeLearning({ ...h.learning, session: old }).session;
  assert.equal(currentJourneyStep(plan, restored, h.learning).type, 'recap');
  const resumed = advanceJourney(plan, restored, h.learning, { now: START + 1 });
  const step = currentJourneyStep(plan, resumed, h.learning);
  assert.equal(step.type, 'teach'); assert.equal(step.chapter.id, 'present'); assert.equal(step.card.id, 'first');
  assert.equal(resumed.id, old.id); assert.equal(resumed.journey.covered.meet, START);
  assert.deepEqual(resumed.ui, old.ui); assert.deepEqual(resumed.answeredEventIds, old.answeredEventIds);
  assert.equal(resumed.index, 0); assert.deepEqual(h.learning.events, {});
  assert.equal(restored.journey.phase, 'recap');
});

test('Meet with an actual assessment retains its legitimate practice and recap', () => {
  const assessed = clone(plan);
  assessed.chapters[0].groups[0].targets = [target('meaning', null, { skill: 'meaning' })];
  const h = harness(assessed);
  const step = h.next(); assert.equal(step.type, 'question'); assert.equal(step.chapter.id, 'meet');
  assert.equal(step.phase, 'guided');
  h.skip(); assert.equal(h.step().type, 'recap'); assert.equal(h.step().chapter.id, 'meet');
});

test('each person and formal-address target needs two separated, varied independent answers', () => {
  const h = harness(); h.until(s => s.type === 'complete');
  const p = journeyProgress(plan, h.session, h.learning, h.now); assert.equal(p.complete, true);
  for (const t of mainTargets) { const s = journeyTargetState(h.learning, t); assert.equal(s.ready, true); assert.equal(s.independentCorrect, 2); assert.equal(s.variantCount, 2); }
  assert.notEqual(mainTargets[2].id, mainTargets[3].id);
  assert.equal(journeyTargetState(h.learning, mainTargets[3]).role, 'formal');
  assert.ok(Object.values(h.learning.events).every(e => e.entryId === plan.entryId));
});

test('two adjacent or copied answers cannot satisfy the new target policy', () => {
  let d = addEvidence(createLearning(START), [{}, {}]);
  assert.equal(skillState(d, mainTargets[0].id).independentCorrect, 1); assert.equal(skillState(d, mainTargets[0].id).ready, false);
  d = addEvidence(createLearning(START), [{}, ...gap(), { assistance: ['visible-form'] }]);
  assert.equal(skillState(d, mainTargets[0].id).independentCorrect, 1); assert.equal(skillState(d, mainTargets[0].id).ready, false);
  d = addEvidence(d, [...gap(), { variantId: 'fresh-1' }, ...gap(), { variantId: 'fresh-2' }]);
  assert.equal(skillState(d, mainTargets[0].id).ready, true);
});

test('a wrong checkpoint answer detours to explanation and support, then requires two fresh full answers', () => {
  const h = harness(); h.until(s => s.type === 'question' && h.session.journey.phase === 'checkpoint');
  const id = h.step().target.id, before = journeyTargetState(h.learning, id).independentCorrect;
  h.answer({ ok: false, outcome: 'incorrect', errorTags: ['auxiliary'], components: [{ skill: 'auxiliary', ok: false, errorTag: 'auxiliary' }] });
  assert.equal(h.next().type, 'repair'); assert.equal(h.step().target.id, id);
  assert.equal(h.next().phase, 'repair');
  h.answer({ components: [{ skill: 'auxiliary', ok: true }] });
  assert.equal(journeyTargetState(h.learning, id).independentCorrect, before);
  h.next(); let retries = 0;
  h.until(s => {
    if (s.type === 'question' && !s.awaitingContinue && s.target.id === id && s.phase === 'independent') {
      h.answer({ components: [{ skill: 'auxiliary', ok: true }] }); retries++;
      if (retries === 1) assert.equal(journeyTargetState(h.learning, id).ready, false);
      h.next(); return retries === 2;
    }
    return false;
  });
  assert.equal(journeyTargetState(h.learning, id).ready, true);
});


test('a ready person failed during a supported contrast reopens the chapter requirement', () => {
  const h = harness(); h.until(s => s.type === 'complete');
  const t = mainTargets[0], j = h.session.journey;
  assert.equal(journeyTargetState(h.learning, t).ready, true);
  j.phase = 'checkpoint'; j.current = { targetId: t.id, phase: 'guided', format: 'type', variant: 0, questionId: 'contrast-failure', supplemental: true };
  j.queue = []; j.awaitingContinue = false;
  h.answer({ ok: false, outcome: 'incorrect', errorTags: ['person'], components: [{ skill: 'person', ok: false, errorTag: 'person' }] });
  h.next(); h.next(); h.answer({ components: [{ skill: 'person', ok: true }] }); h.next();
  assert.notEqual(h.step().type, 'recap'); assert.equal(journeyTargetState(h.learning, t).ready, false);
  h.until(s => {
    if (s.type === 'question' && !s.awaitingContinue && s.target.id === t.id) {
      h.answer({ components: [{ skill: 'person', ok: true }] }); h.next();
      return h.step().type === 'recap';
    }
    return s.type === 'recap';
  });
  assert.equal(journeyTargetState(h.learning, t).ready, true);
});

test('assisted checkpoint successes stay in the checkpoint until independent repair or skip', () => {
  const h = harness(); h.until(s => s.type === 'question' && h.session.journey.phase === 'checkpoint');
  const id = h.step().target.id;
  const beforeHint = journeyTargetState(h.learning, id).independentCorrect;
  h.answer({ assistance: ['hint'] }); h.next();
  assert.notEqual(h.step().type, 'recap'); assert.equal(journeyTargetState(h.learning, id).ready, false);
  assert.equal(journeyTargetState(h.learning, id).independentCorrect, beforeHint, 'the hint grants no independent evidence');
  h.until(s => s.type === 'question' && !s.awaitingContinue && s.target.id === id && s.phase === 'independent');
  h.answer();
  const ready = journeyTargetState(h.learning, id);
  assert.equal(ready.independentCorrect, 2); assert.equal(ready.variantCount, 2);
  assert.equal(ready.spacedSuccess, true); assert.equal(ready.ready, true);
});

test('repeated mistakes offer help without an automatic retry cap', () => {
  const h = harness(plan, { chapterId: 'present' }); h.until(s => s.type === 'question');
  const id = h.step().target.id;
  const formats = new Set();
  for (let i = 0; i < 6; i++) {
    h.answer({ ok: false, outcome: 'incorrect', errorTags: ['person'] }); assert.equal(h.next().type, 'repair');
    assert.equal(h.step().target.id, id); if (i) assert.equal(h.step().helpSuggested, true);
    assert.equal(h.next().phase, 'repair'); formats.add(h.step().format);
  }
  assert.equal(journeyTargetState(h.learning, id).ready, false);
  assert.deepEqual([...formats].sort(), ['letters', 'mc', 'type']);
});

test('skip is a deferred choice, never evidence, XP, or target completion', () => {
  const h = harness(plan, { chapterId: 'present' }); h.until(s => s.type === 'question');
  const id = h.step().target.id, index = h.session.index;
  h.skip(); assert.equal(h.session.index, index); assert.deepEqual(h.learning.events, {});
  h.until(s => s.type === 'recap');
  assert.ok(h.session.deferred[id]); assert.ok(h.session.journey.skipped[id]);
  assert.equal(journeyProgress(plan, h.session, h.learning).complete, false);
  const restored = normalizeLearning({ ...h.learning, session: h.session }).session;
  assert.ok(restored.deferred[id]); assert.ok(restored.journey.skipped[id]);
  h.session = retryJourneyPending(plan, restored, h.learning, { now: h.now + 1 });
  assert.equal(h.session.journey.skipped[id], undefined); assert.equal(h.session.deferred[id], undefined);
  h.until(s => s.type === 'recap'); assert.equal(journeyTargetState(h.learning, id).ready, true);
});

test('skipping a teaching group defers its forms without testing untaught material', () => {
  const h = harness(plan, { chapterId: 'present' }); h.skip();
  assert.equal(h.step().card.id, 'second-group');
  assert.ok(h.session.deferred[mainTargets[0].id]); assert.ok(h.session.deferred[mainTargets[1].id]);
  assert.equal(h.session.index, 0);
});


test('explicit chapter restart clears that chapter’s deferred targets and keeps others pending', () => {
  const h = harness(plan, { chapterId: 'present' }); h.skip();
  const outside = 'another-chapter-target'; h.session.deferred[outside] = START; h.session.journey.skipped[outside] = START;
  assert.ok(h.session.deferred[mainTargets[0].id]);
  h.session = chooseJourneyChapter(plan, h.session, 'present', { now: h.now + 1, learning: h.learning, restart: true });
  assert.equal(h.step().type, 'teach'); assert.equal(h.session.deferred[mainTargets[0].id], undefined);
  assert.equal(h.session.journey.skipped[mainTargets[0].id], undefined);
  assert.equal(h.session.deferred[outside], START); assert.equal(h.session.journey.skipped[outside], START);
});

test('exact question, draft, hints, feedback and answered counter survive normalization', () => {
  const h = harness(plan, { chapterId: 'present' }); h.until(s => s.type === 'question');
  h.session.ui = { version: 2, draft: 'unfinished', assistance: ['hint'], exposures: { 'form-io': 1 }, paused: true };
  const saved = normalizeLearning({ ...h.learning, session: h.session });
  assert.deepEqual(saved.session, h.session); assert.equal(saved.sessions['v:fixture|journey:lesson'].journey.current.questionId, h.step().questionId);
  h.session = saved.session; const { event, result } = h.answer();
  const resumed = normalizeLearning({ ...h.learning, session: h.session }).session;
  assert.deepEqual(resumed.journey, h.session.journey);
  assert.equal(recordJourneyAttempt(plan, resumed, event, result).index, resumed.index);
  assert.equal(recordAttempt(h.learning, event).added, false);
});

test('legacy sessions coexist locally and legacy evidence never gains chapter credit', () => {
  const h = harness();
  const legacy = { id: 'old', entryId: plan.entryId, mode: 'lesson', objectiveIds: [mainTargets[0].id], index: 4, createdAt: START, updatedAt: START, ui: { draft: 'old answer' } };
  let d = normalizeLearning({ version: 1, epoch: { id: 'initial', at: 0 }, sessions: { old: legacy, fresh: h.session } }, START);
  assert.equal(d.version, LEARNING_VERSION); assert.equal(Object.keys(d.sessions).length, 2);
  assert.equal(d.sessions['v:fixture|lesson'].ui.draft, 'old answer');
  assert.equal(learningSessionKey(h.session), 'v:fixture|journey:lesson');
  d = addEvidence(d, [{ policy: undefined }, ...gap(), { policy: undefined }, ...gap(), { policy: undefined }, ...gap(), { policy: undefined }]);
  assert.equal(skillState(d, mainTargets[0].id).ready, true);
  assert.equal(journeyTargetState(d, mainTargets[0]).ready, false);
  d = addEvidence(d, [{}]); assert.equal(journeyTargetState(d, mainTargets[0]).independentCorrect, 1); assert.equal(journeyTargetState(d, mainTargets[0]).ready, false);
});

test('reset and deterministic merge preserve only current epoch target metadata', () => {
  const h = harness(); h.until(s => s.type === 'complete');
  const d = normalizeLearning({ ...h.learning, session: h.session });
  const other = addEvidence(createLearning(START), [{ objectiveId: 'second', targetId: 'second' }]);
  assert.deepEqual(mergeLearning(d, other), mergeLearning(other, d));
  assert.equal(mergeLearning(d, other).events.e1.policy, 'journey-v1');
  const reset = resetLearning(d, START + DAY, 'new-epoch');
  assert.deepEqual(mergeLearning(reset, d).events, {}); assert.deepEqual(mergeLearning(reset, d).sessions, {});
});

test('future learning and content versions fail closed with intact original payload', () => {
  const h = harness(); const future = { version: 999, events: { next: { novel: ['untouched'] } }, epoch: { id: 'initial', at: 0 } };
  assert.deepEqual(normalizeLearning(future), future);
  assert.equal(currentJourneyStep(plan, h.session, future).type, 'unavailable');
  assert.equal(advanceJourney(plan, h.session, future), h.session);
  const newerPlan = { ...plan, version: 2 }; assert.equal(currentJourneyStep(newerPlan, h.session).type, 'unavailable');
});



test('malformed imported journey cursors are preserved and cannot execute', () => {
  const h = harness(plan, { chapterId: 'present' });
  const patches = [
    { queue: {} }, { skipped: [] }, { variants: 'bad' }, { variants: { one: { guided: 0, independent: '1', repair: 0 } } },
    { lastAnswered: null }, { failures: [] }, { covered: true }, { groupIndex: -1 }, { cardIndex: 'first' }, { serial: null },
    { phase: 'unrecognized-phase' }, { awaitingContinue: 'false' }, { current: { targetId: mainTargets[0].id } },
    { lastAttempt: ['wrong'] }, { repairReturn: 'repair' }, { focusTargetId: [] }, { blocked: {} },
    { limitedTargets: [] }, { personRepairs: { one: 99 } }, { phase: 'repair-teach', current: null, lastAttempt: null },
  ];
  for (const patch of patches) {
    const raw = clone(h.session); Object.assign(raw.journey, patch);
    const imported = normalizeLearning({ ...h.learning, session: raw }).session;
    const before = clone(imported);
    assert.equal(currentJourneyStep(plan, imported, h.learning).type, 'unavailable', JSON.stringify(patch));
    assert.equal(advanceJourney(plan, imported, h.learning), imported);
    assert.equal(skipJourneyTarget(plan, imported), imported);
    assert.equal(chooseJourneyChapter(plan, imported, 'present'), imported);
    assert.equal(retryJourneyPending(plan, imported, h.learning), imported);
    assert.equal(deferJourneyTarget(plan, imported, h.learning), imported);
    assert.equal(journeyAttempt(plan, imported, {}, {}), null);
    assert.equal(recordJourneyAttempt(plan, imported, { id: 'ignored' }, {}), imported);
    assert.deepEqual(imported, before);
  }
  const earlier = clone(h.session);
  delete earlier.journey.limitedTargets; delete earlier.journey.personRepairs; delete earlier.journey.blocked;
  assert.equal(currentJourneyStep(plan, earlier, h.learning).type, 'teach');
});

test('general reviews start at the first checkable chapter, and optional focused reviews remain usable', () => {
  const h = harness(plan, { mode: 'review' });
  assert.equal(h.step().type, 'question'); assert.equal(h.step().chapter.id, 'present');
  const p = clone(plan); p.chapters[1].groups[0].targets[0].required = false;
  const focused = harness(p, { mode: 'review', targetId: mainTargets[0].id });
  assert.equal(focused.step().type, 'question'); assert.equal(focused.step().target.id, mainTargets[0].id);
  focused.until(s => s.type === 'recap'); assert.equal(journeyTargetState(focused.learning, mainTargets[0]).ready, true);
});

test('a context diagnosis records the actual person and returns to that person after support', () => {
  const t = target('context', undefined, { skill: 'context', answerForms: ['a', 'b', 'c'], answerFormsByVariant: [['a'], ['b'], ['c']], personsByVariant: [0, 1, 2] });
  const supplements = [target('fact-a', null, { required: false, supplementalOnly: true }), target('fact-b', null, { required: false, supplementalOnly: true })];
  const p = { ...plan, chapters: [{ id: 'present', title: 'Context', groups: [{ id: 'context', cards: [], targets: [t, ...supplements] }] }] };
  const h = harness(p, { mode: 'review', targetId: t.id });
  h.session.journey.current.variant = 1; h.session.journey.variants[t.id].independent = 2;
  const q = h.question(); q.meta.person = 1;
  const wrong = h.answer({ ok: false, outcome: 'incorrect', errorTags: ['person'], components: [{ skill: 'person', ok: false, errorTag: 'person' }] }, q);
  assert.equal(wrong.event.person, 1); assert.equal(h.session.journey.personRepairs[t.id], 1);
  h.next(); const repair = h.next(); assert.equal(repair.variant, 1);
  h.answer({ components: [{ skill: 'person', ok: true }] }); h.next();
  h.until(s => s.type === 'question' && s.phase === 'independent');
  assert.equal(t.personsByVariant[h.step().variant % 3], 1);
  assert.equal(journeyTargetState(h.learning, t).ready, false);
});

test('later focused review skips teaching, checks the requested target twice, then remembers it', () => {
  const h = harness(); h.until(s => s.type === 'complete');
  const r = harness(plan, { id: 'later', learning: h.learning, mode: 'review', targetId: mainTargets[0].id, now: START + 2 * DAY });
  assert.equal(r.step().type, 'question'); assert.equal(r.step().target.id, mainTargets[0].id);
  r.answer(); r.next(); assert.notEqual(r.step().type, 'recap');
  r.until(s => s.type === 'recap');
  const state = journeyTargetState(r.learning, mainTargets[0], r.now);
  assert.equal(state.sessionEvidence.later.independentCorrect, 2); assert.equal(state.remembered, true);
  assert.equal(r.next().type, 'complete');
});

test('a later failure revokes remembered and two new spaced confirmations clear the issue', () => {
  let d = addEvidence(createLearning(START), [{}, ...gap(), {}]);
  d = addEvidence(d, [{ sessionId: 'later', at: START + 2 * DAY, variantId: 'later-a' }, ...gap().map(x => ({ ...x, sessionId: 'later', at: START + 2 * DAY + 1 })), { sessionId: 'later', at: START + 2 * DAY + 2, variantId: 'later-b' }]);
  assert.equal(skillState(d, mainTargets[0].id).remembered, true);
  d = addEvidence(d, [{ sessionId: 'wrong', at: START + 3 * DAY, ok: false, outcome: 'incorrect', errorTags: ['person'] }]);
  assert.equal(skillState(d, mainTargets[0].id).remembered, false); assert.equal(skillState(d, mainTargets[0].id).ready, false);
});

test('limited custom content blocks explicitly rather than loops, auto-skips, or certifies', () => {
  const p = { ...plan, chapters: [{ id: 'single', title: 'Custom', groups: [{ id: 'one', cards: [], targets: [target('alone', 0)] }] }] };
  const h = harness(p); h.until(s => s.type === 'blocked');
  assert.equal(h.step().reason, 'more-context-needed'); assert.equal(journeyProgress(p, h.session, h.learning).complete, false);
  h.skip(); assert.equal(h.step().type, 'recap'); assert.ok(h.session.deferred[target('alone', 0).id]);
  const limited = clone(p); limited.chapters[0].groups[0].targets[0].independentVariantCount = 1;
  const r = harness(limited); r.until(s => s.type === 'blocked'); assert.equal(r.step().reason, 'limited-variants');
});

test('supplemental same-word activities permit spacing without becoming lesson requirements', () => {
  const main = target('word', null, { skill: 'recall' });
  const supplements = [target('gender', null, { skill: 'fact', required: false, supplementalOnly: true }), target('number', null, { skill: 'fact', required: false, supplementalOnly: true })];
  const p = { ...plan, kind: 'word', chapters: [{ id: 'single', title: 'Word', groups: [{ id: 'one', cards: [{ id: 'facts' }], targets: [main, ...supplements] }] }] };
  const h = harness(p); h.until(s => s.type === 'recap');
  assert.equal(journeyProgress(p, h.session, h.learning).chapters[0].total, 1);
  assert.equal(journeyTargetState(h.learning, main).ready, true);
  for (const t of supplements) assert.equal(journeyTargetState(h.learning, t).independentCorrect, 0);
});

test('answer exposure rotates ordinary and formal targets sharing a surface form', () => {
  const h = harness(plan, { mode: 'review', targetId: mainTargets[3].id });
  h.session.ui = { exposures: { 'form-lei': 0 } };
  h.session = deferJourneyTarget(plan, h.session, h.learning, { now: START + 1 });
  assert.equal(h.step().phase, 'guided'); assert.notEqual(h.step().target.id, mainTargets[2].id); assert.notEqual(h.step().target.id, mainTargets[3].id);
  h.answer(); h.next();
  assert.equal(h.step().target.id, mainTargets[3].id); assert.equal(h.step().phase, 'independent');
});


test('bare noun exposure defers phrase recall while article-only checks remain independent', () => {
  const t = target('phrase', null, { skill: 'recall', answerForms: ['la casa'], answerFormsByVariant: [['la casa']], exposureFormsByVariant: [['la casa', 'casa']] });
  const supports = [target('fact-a', null, { required: false, supplementalOnly: true }), target('fact-b', null, { required: false, supplementalOnly: true })];
  const p = { ...plan, kind: 'word', chapters: [{ id: 'word', title: 'Word', groups: [{ id: 'word', cards: [], targets: [t, ...supports] }] }] };
  const h = harness(p, { mode: 'review', targetId: t.id }); h.session.ui = { exposures: { casa: 0 } };
  h.session = deferJourneyTarget(p, h.session, h.learning);
  assert.equal(h.step().phase, 'guided'); assert.equal(h.step().target.supplementalOnly, true);
  h.answer(); h.next(); h.answer(); h.next(); assert.equal(h.step().target.id, t.id); assert.equal(h.step().phase, 'independent');
  const article = { ...t, skill: 'article', answerFormsByVariant: [['la']], exposureFormsByVariant: [['la']] };
  p.chapters[0].groups[0].targets[0] = article;
  const a = harness(p, { mode: 'review', targetId: article.id }); a.session.ui = { exposures: { casa: 0 } };
  assert.equal(a.step().phase, 'independent');
});

test('real compound component scaffolds remain recognition evidence and return to whole-form retrieval', () => {
  const entry = JSON.parse(readFileSync(new URL('../data/verbs.json', import.meta.url))).find(e => e.inf === 'andare');
  const p = buildLesson(entry), h = harness(p, { chapterId: 'past' });
  h.until(s => s.type === 'question' && s.target.skill === 'conjugation');
  let s = h.step(); const q = buildJourneyQuestion(entry, s.chapter, s.target, { ...s, phase: 'independent', format: 'type' });
  const wrong = gradeQuestion(q, 'ho andato'); assert.equal(wrong.ok, false); assert.ok(wrong.errorTags.includes('auxiliary'));
  h.answer(wrong, q); h.next(); s = h.next();
  assert.equal(s.phase, 'repair');
  const repair = buildJourneyQuestion(entry, s.chapter, s.target, s);
  assert.equal(repair.meta.mode, 'recognition'); assert.equal(repair.meta.scaffold, true);
  h.answer(gradeQuestion(repair, repair.answer[0]), repair);
  assert.equal(journeyTargetState(h.learning, s.target).independentCorrect, 0);
  h.next(); assert.notEqual(h.step().phase, 'repair');
});


test('correct supported successes preserve established readiness without adding independent credit', () => {
  let d = addEvidence(createLearning(START), [{}, ...gap(), {}]);
  const before = skillState(d, mainTargets[0].id); assert.equal(before.ready, true);
  d = addEvidence(d, [{ mode: 'recognition', activityKind: 'guided', assistance: ['visible-form'] }]);
  const after = skillState(d, mainTargets[0].id);
  assert.equal(after.ready, true); assert.equal(after.independentCorrect, before.independentCorrect);
  assert.deepEqual(after.unresolvedErrors, []);
});

test('v1 stage enrollment migrates without silently removing imperfetto access', () => {
  for (const stage of ['future', 'background']) {
    const d = normalizeLearning({ ...createLearning(START), version: 1, preferences: { stage, expansions: [] } });
    assert.deepEqual(d.preferences.legacyTenses, stage === 'background' ? ['futuro','imperfetto'] : ['imperfetto']);
    assert.deepEqual(normalizeLearning(d).preferences.legacyTenses, d.preferences.legacyTenses);
  }
  assert.deepEqual(normalizeLearning(createLearning(START)).preferences.legacyTenses, []);
});


const fiveCasePlan = { ...plan, chapters: ['present','past','background','future','condizionale'].map(ch => ({
  ...plan.chapters[1], id: ch, title: ch, groups: plan.chapters[1].groups.map(g => ({ ...g,
    targets: g.targets.map(t => ({ ...t, id: t.id.replace('::present::', `::${ch}::`) })) }))
})) };
test('five cases are independently selectable and only all five complete the verb; Meet and mixed are not requirements', () => {
  const h=harness(fiveCasePlan,{caseMode:true,chapterId:'future'});
  for(const [i,ch] of ['future','present','background','past','condizionale'].entries()) {
    if(i)h.session=chooseJourneyChapter(fiveCasePlan,h.session,ch,{learning:h.learning,now:h.now});
    h.until(s=>s.type==='recap');
    const progress=journeyCaseProgress(fiveCasePlan,h.learning,h.session,h.now);
    assert.equal(progress.completed,i+1);assert.equal(progress.complete,i===4);
    assert.equal(progress.cases.find(c=>c.id===ch).ready,true);
    h.next();assert.equal(h.step().type,'complete');assert.equal(h.session.journey.chapterId,ch);
  }
  assert.equal(journeyProgress(fiveCasePlan,h.session,h.learning,h.now).complete,true);
  assert.equal(journeyCaseProgress(fiveCasePlan,h.learning,null,h.now).complete,true,'event history alone retains completion');
  assert.equal(journeyCaseProgress(fiveCasePlan,normalizeLearning(clone(h.learning)),null,h.now).mixedAvailable,true);
});
test('switching unfinished cases restores exact cursor while question serial and evidence counters never rewind', () => {
  const h=harness(fiveCasePlan,{caseMode:true,chapterId:'present'});h.until(s=>s.type==='question');
  const original=clone(h.session.journey.current);h.answer();
  const awaiting=clone(h.session.journey);
  h.session=chooseJourneyChapter(fiveCasePlan,h.session,'past',{learning:h.learning,now:h.now});
  h.until(s=>s.type==='question');h.answer();const serial=h.session.journey.serial,index=h.session.index;
  h.session=normalizeLearning({...h.learning,session:h.session}).session;
  h.session=chooseJourneyChapter(fiveCasePlan,h.session,'present',{learning:h.learning,now:h.now});
  assert.deepEqual(h.session.journey.current,original);assert.equal(h.session.journey.awaitingContinue,true);
  assert.deepEqual(h.session.journey.queue,awaiting.queue);assert.equal(h.session.index,index);assert.equal(h.session.journey.serial,serial);
  h.next();assert.ok(h.session.journey.serial>serial);
});
test('redo preserves earned green completion while requiring fresh spaced independent checks', () => {
  const h=harness(fiveCasePlan,{caseMode:true,chapterId:'present'});h.until(s=>s.type==='recap');
  const before=Object.keys(h.learning.events).length,at=journeyCaseProgress(fiveCasePlan,h.learning).cases[0].completedAt;
  h.session=chooseJourneyChapter(fiveCasePlan,h.session,'present',{redo:true,learning:h.learning,now:h.now});
  assert.equal(h.step().type,'teach');assert.equal(journeyProgress(fiveCasePlan,h.session,h.learning).chapters[0].complete,false);
  h.until(s=>s.type==='question'&&s.phase==='independent');h.answer({ok:false,outcome:'incorrect',errorTags:['person'],components:[{skill:'conjugation',ok:false,errorTag:'person'}]});
  assert.equal(journeyCaseProgress(fiveCasePlan,h.learning).cases[0].ready,true);
  assert.equal(journeyCaseProgress(fiveCasePlan,h.learning).cases[0].reviewNeeded,true);
  h.next();h.until(s=>s.type==='recap',400);
  assert.equal(journeyProgress(fiveCasePlan,h.session,h.learning).chapters[0].complete,true);
  assert.equal(journeyCaseProgress(fiveCasePlan,h.learning).cases[0].completedAt,at);
  const fresh=Object.values(h.learning.events).slice(before).filter(e=>e.mode==='production'&&e.ok&&!e.assistance.length);
  for(const t of fiveCasePlan.chapters[0].groups.flatMap(g=>g.targets))assert.ok(fresh.filter(e=>e.objectiveId===t.id).length>=2,t.id);
});
test('case milestone never combines target successes that were not ready at the same time', () => {
  const a=mainTargets[0],b=mainTargets[1],p={...fiveCasePlan,chapters:fiveCasePlan.chapters.map((ch,i)=>i?ch:{...ch,groups:[{id:'only',cards:[],targets:[a,b]}]})};
  let learning=addEvidence(createLearning(START),[{},...gap(),{}, {ok:false,outcome:'incorrect',errorTags:['person']}]);
  learning=addEvidence(learning,[{objectiveId:b.id},...gap(),{objectiveId:b.id}]);
  assert.equal(journeyTargetState(learning,a).ready,false);assert.equal(journeyTargetState(learning,b).ready,true);
  assert.equal(journeyCaseProgress(p,learning).cases[0].ready,false);
  learning=addEvidence(learning,[{},...gap(),{}]);assert.equal(journeyCaseProgress(p,learning).cases[0].ready,true);
});
test('a legacy background enrollment retains its previously available future without changing new chapter order', () => {
  const raw={...createLearning(START),preferences:{stage:'background',expansions:[]}};
  const upgraded=normalizeLearning(raw);assert.ok(upgraded.preferences.legacyTenses.includes('futuro'));
  assert.equal(upgraded.preferences.coreOrderVersion,2);
  const fresh=createLearning(START);fresh.preferences.stage='background';assert.ok(!normalizeLearning(fresh).preferences.legacyTenses.includes('futuro'));
});


test('unsupported cases stay visible and exempt, without pretending their forms were learned',()=>{
 const p=clone(fiveCasePlan);p.chapters[3].groups=[];
 const h=harness(p,{caseMode:true,chapterId:'present'});
 for(const id of ['present','past','background','condizionale']){
  h.session=chooseJourneyChapter(p,h.session,id,{learning:h.learning,now:h.now});h.until(s=>s.type==='recap');
 }
 const progress=journeyCaseProgress(p,h.learning,h.session);
 assert.equal(progress.total,4);assert.equal(progress.caseCount,5);assert.equal(progress.complete,true);
 const absent=progress.cases.find(c=>c.id==='future');assert.equal(absent.ready,false);assert.equal(absent.available,false);assert.equal(absent.exempt,true);assert.ok(absent.limitation);
 const empty={...p,chapters:p.chapters.map(c=>({...c,groups:[]}))};
 assert.equal(journeyCaseProgress(empty,createLearning()).complete,false,'no available curriculum cannot automatically mark the entry learned');
});
test('a required supported usage explanation gates completion without granting independent mastery',()=>{
 const p=clone(fiveCasePlan),rule=target('usage',null,{skill:'progressiveUsage',required:false,guidedOnly:true,completionRequired:true,answerForms:['An ongoing action']});
 p.chapters[0].groups.push({id:'usage',cards:[{id:'rule'}],targets:[rule]});
 const h=harness(p,{caseMode:true,chapterId:'present'});h.until(s=>s.type==='teach'&&s.group.id==='usage');
 assert.equal(journeyCaseProgress(p,h.learning).cases[0].ready,false);
 h.next();h.answer();h.next();h.until(s=>s.type==='recap');
 const state=journeyTargetState(h.learning,rule);assert.equal(state.ready,true);assert.equal(state.supportedCompletion,true);assert.equal(state.independentCorrect,0);
 assert.equal(skillState(h.learning,rule.id).ready,false);assert.equal(journeyCaseProgress(p,h.learning).cases[0].ready,true);
});

// This mirrors browser exposure bookkeeping while using real teaching, prompts,
// answer diagnostics and event normalization. It catches queues whose supported
// choices reveal the next answer and whose scheduling can otherwise cycle.
for (const [file, property, value, chapterId] of [['verbs', 'inf', 'credere'], ['verbs', 'inf', 'parlare'], ['verbs', 'inf', 'piovere'], ['vocab', 'it', 'casa'], ['verbs', 'inf', 'credere', 'imperativo'], ['verbs', 'inf', 'piovere', 'background'], ['verbs', 'inf', 'bisognare'], ['verbs', 'inf', 'trattarsi']]) test(`real ${value}${chapterId ? ' ' + chapterId : ''} chapters finish with exposure-aware independent evidence`, () => {
  const entry = JSON.parse(readFileSync(new URL(`../data/${file}.json`, import.meta.url))).find(e => e[property] === value);
  const p = buildLesson(entry), h = harness(p, { chapterId });
  const norm = a => String(a).normalize('NFC').trim().toLocaleLowerCase('it').replace(/\s+/g, ' ');
  let activityCount = 0, passes = 0, progressiveError = false, progressiveRepair = false; const trace=[];
  const expose = forms => { h.session.ui ||= { exposures: {} }; for (const form of forms) if (form) h.session.ui.exposures[norm(form)] = h.session.index; };
  while (h.step().type !== 'complete' && passes++ < 1500) {
    const s = h.step();
    if (s.type === 'teach') {
      for (const row of s.card?.forms || []) expose(String(row.form).split(/\s*\/\s*/));
      const shown = norm([s.card?.body, ...(s.card?.notes || []), ...(s.card?.examples || []).map(x => x.it)].join(' '));
      for (const t of s.chapter.groups.flatMap(g => g.targets || [])) {
        const q = buildJourneyQuestion(entry, s.chapter, t, { variant: 0, format: 'type' });
        for (const a of q?.answer || []) if (a && shown.includes(norm(a))) expose([a]);
      }
      h.next();
    } else if (s.type === 'question' && !s.awaitingContinue) {
      const q = buildJourneyQuestion(entry, s.chapter, s.target, s); assert.ok(q, `${value}/${s.target.id} missing question`);
      const assistance = (q.meta.exposureForms || q.answer).some(a => typeof h.session.ui?.exposures?.[norm(a)] === 'number' && h.session.index - h.session.ui.exposures[norm(a)] < (p.kind === 'verb' ? 1 : 2)) ? ['visible-form'] : [];
      expose(q.meta.promptExposureForms || []); expose((q.choices || []).map(c => c.value ?? c.label));
      if (q.type === 'pairs') {
        expose(q.pairs.flatMap(pair => pair.answers));
        const matched = new Set();
        for (const pair of q.pairs) {
          assert.equal(h.pairAnswer(q, pair.targetId, pair.canonical).ok, true); matched.add(pair.id);
          expose([pair.canonical, ...q.rightTiles.filter(tile => !matched.has(tile.pairId)).map(tile => tile.text)]);
        }
      }
      const injectError = value === 'parlare' && !progressiveError && s.target.skill === 'progressive' && s.target.person === 0;
      const grade = gradeQuestion(q, injectError ? 'sono parlando' : q.answer[0]);
      if(injectError){progressiveError=true;assert.ok(grade.errorTags.includes('auxiliary'));}
      else assert.equal(grade.ok, true, `${value}: expected answer not accepted`);
      if(value==='parlare'&&q.meta.scaffold&&q.meta.skill==='auxiliary'&&s.target.progressive){progressiveRepair=true;assert.equal(q.meta.mode,'recognition');}
      h.answer({ ...grade, assistance }, q); activityCount++; trace.push([s.target.id,s.phase,s.variant,q.type,assistance,h.session.index,q.meta.variantId]);
      expose(q.answer); expose(q.meta.feedbackExposureForms || []); expose((q.choices || []).map(c => c.value ?? c.label));
    } else if (s.awaitingContinue || ['recap', 'repair'].includes(s.type)) h.next();
    else { console.log(JSON.stringify({phase:h.session.journey.phase,queue:h.session.journey.queue,trace:trace.slice(-15),exposures:h.session.ui?.exposures},null,2)); throw new Error(`${value} blocked at ${s.chapter?.id}/${s.target?.skill}: ${s.type} ${s.reason}`); }
  }
  if(h.step().type !== 'complete') console.log(JSON.stringify({phase:h.session.journey.phase,queue:h.session.journey.queue,trace:trace.slice(0,20).concat(trace.slice(-8)),states:journeyProgress(p,h.session,h.learning).chapters.find(c=>c.id===h.step().chapter.id)?.targets.map(s=>({id:s.target.id,ready:s.ready,n:s.independentCorrect,v:s.variantCount,errs:s.unresolvedErrors,spaced:s.spacedSuccess}))},null,2));
  assert.equal(h.step().type, 'complete', `${value}: ${activityCount} answers did not finish (${h.step().chapter?.id})`);
  assert.equal(chapterId ? journeyProgress(p,h.session,h.learning).chapters.find(c=>c.id===chapterId).complete : journeyProgress(p, h.session, h.learning).complete, true);
  if(value==='parlare'){assert.equal(progressiveError,true);assert.equal(progressiveRepair,true);}
  assert.ok(activityCount < 450, `${value}: excessive all-correct lesson length ${activityCount}`);
});

console.log(`\n${count} journey model checks passed.`);
