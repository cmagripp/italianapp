#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildLesson } from '../js/learning/lesson-content.js';
import { buildJourneyQuestion } from '../js/learning/lesson-questions.js';
import { createLearning, recordAttempt, skillState } from '../js/learning/model.js';
import { createJourneySession, currentJourneyStep, advanceJourney, journeyAttempt, recordJourneyAttempt, journeyPairAttempt, recordJourneyPairAttempt, journeyCaseProgress, chooseJourneyChapter } from '../js/learning/journey.js';
import { gradeQuestion } from '../js/learning/diagnose.js';
import { gradePairActivity } from '../js/learning/lesson-activities.js';
import { caseCoverage, CASE_COVERAGE_POLICY } from '../js/learning/case-coverage.js';

const verbs = JSON.parse(fs.readFileSync(new URL('../data/verbs.json', import.meta.url)));
const norm = s => String(s || '').normalize('NFC').trim().toLocaleLowerCase('it').replace(/\s+/g, ' ');

export function runCase(inf, chapterId = 'present', { legacy = false } = {}) {
  const entry = { ...verbs.find(e => e.inf === inf), kind: 'verb' };
  assert(entry, inf);
  const plan = buildLesson(entry);
  let learning = createLearning(1), serial = 0;
  let session = createJourneySession({ id: `pacing-${inf}-${chapterId}`, plan, now: 1, chapterId, caseMode: true, ...(legacy ? { caseCoveragePolicy:null } : {}) });
  const trace = [];
  const expose = forms => { session.ui ||= { exposures: {} }; for (const form of forms || []) if (form) session.ui.exposures[norm(form)] = session.index; };
  const save = event => {
    Object.assign(event, { deviceId: 'pacing-test', sequence: ++serial, epochId: learning.epoch.id });
    const result = recordAttempt(learning, event); learning = result.learning; return result;
  };
  for (let i = 0; i < 1500; i++) {
    const step = currentJourneyStep(plan, session, learning, serial + 10);
    if (['recap', 'complete'].includes(step.type)) {
      const status = journeyCaseProgress(plan, learning).cases.find(c => c.id === chapterId);
      assert(status.ready || status.exempt, `${inf}/${chapterId} reached recap without readiness or an explicit unavailable-case exemption`);
      return { entry, plan, session, learning, trace, status };
    }
    trace.push({ type: step.type, group: step.group?.id, phase: step.phase, pass: session.journey.phase, format: step.format, target: step.target?.id, supplemental: step.supplemental, variant: step.variant, index: session.index, awaitingContinue: step.awaitingContinue });
    if (step.type === 'teach') {
      for (const row of step.card?.forms || []) expose(row.form.split(/\s*\/\s*/));
      const shown = norm([step.card?.body, ...(step.card?.notes || []), ...(step.card?.examples || []).map(x => x.it)].join(' '));
      for (const target of step.chapter.groups.flatMap(g => g.targets || [])) {
        const q = buildJourneyQuestion(entry, step.chapter, target);
        expose(q?.answer.filter(a => shown.includes(norm(a))));
      }
    }
    if (step.awaitingContinue || ['teach', 'repair'].includes(step.type)) {
      session = advanceJourney(plan, session, learning, { now: serial + 10 });
      continue;
    }
    assert.equal(step.type, 'question', `${inf}/${chapterId}: ${step.type}/${step.reason}: ${JSON.stringify(trace.slice(-6))}`);
    const q = buildJourneyQuestion(entry, step.chapter, step.target, step);
    assert(q, step.target.id);
    trace.at(-1).contextId = q.meta?.contextId;
    trace.at(-1).sentence = q.context?.it;
    trace.at(-1).pairTargets = q.pairs?.map(pair => pair.targetId) || [];
    const assistance = (q.meta.exposureForms || q.answer).some(a => session.ui?.exposures[norm(a)] !== undefined && session.index - session.ui.exposures[norm(a)] < 1) ? ['visible-form'] : [];
    expose(q.meta.promptExposureForms); expose(q.choices.map(c => c.value ?? c.label));
    if (q.type === 'pairs') for (const pair of q.pairs) {
      const grade = gradePairActivity(q, { targetId: pair.targetId, given: pair.canonical });
      const event = journeyPairAttempt(plan, session, q, grade, { targetId: pair.targetId, now: serial + 10 });
      session = recordJourneyPairAttempt(plan, session, event, save(event)); expose(pair.answers);
    }
    const grade = gradeQuestion(q, q.answer[0]);
    assert(grade.ok, `${inf}/${chapterId}: ${JSON.stringify(q)}`);
    const event = journeyAttempt(plan, session, q, grade, { assistance, now: serial + 10 });
    assert(event);
    session = recordJourneyAttempt(plan, session, event, save(event));
    trace.at(-1).assistance = assistance;
    trace.at(-1).ready = skillState(learning, step.target.id).ready;
    trace.at(-1).correct = skillState(learning, step.target.id).independentCorrect;
    expose(q.answer); expose(q.meta.feedbackExposureForms);
  }
  throw new Error(`${inf}/${chapterId} exceeded traversal bound: ${JSON.stringify(trace.slice(-8))}`);
}

const budgets = [
  ['avere', 'present', 14], ['viaggiare', 'present', 24],
  ['piovere', 'present', 10], ['credere', 'present', 13],
  ['viaggiare', 'background', 24], ['avere', 'past', 12],
  ['avere', 'future', 10], ['avere', 'condizionale', 10],
  ['piacere', 'future', 7],
];
for (const [inf, chapter, maximum] of budgets) {
  const run = runCase(inf, chapter), questions = run.trace.filter(s => s.type === 'question' && !s.awaitingContinue);
  const count = key => Object.fromEntries([...new Set(questions.map(q => q[key]))].map(value => [value, questions.filter(q => q[key] === value).length]));
  const required = run.plan.chapters.find(c => c.id === chapter).groups.flatMap(g => g.targets).filter(t => (t.required !== false || t.completionRequired) && t.available !== false && !t.supplementalOnly);
  const production = required.filter(t => !t.completionRequired && !t.guidedOnly);
  const coverage = caseCoverage(run.plan,run.learning,chapter,{sessionId:run.session.id});
  assert.equal(run.session.journey.caseCoveragePolicy,CASE_COVERAGE_POLICY);
  assert(coverage.complete,`${inf}/${chapter}: every required target must be covered before recap`);
  for (const target of required) {
    const state=coverage.states.get(target.id);
    assert(state.supported,`${inf}/${chapter}: ${target.id} missing supported check`);
    assert(state.covered,`${inf}/${chapter}: ${target.id} not covered`);
    if(production.includes(target)) {
      assert(state.production,`${inf}/${chapter}: ${target.id} missing unaided production`);
      assert(skillState(run.learning,target.id).independentCorrect>=1,`${inf}/${chapter}: ${target.id} missing genuine production evidence`);
    }
  }
  assert(questions.length <= maximum, `${inf}/${chapter}: ${questions.length} prompts exceeds ${maximum}`);
  assert.equal(questions.filter(q => q.phase === 'independent').length, production.length,
    `${inf}/${chapter}: every production target needs one unaided retrieval for finished case coverage`);
  assert(questions.filter(q => q.supplemental).length <= (inf === 'piovere' ? 12 : required.length),
    `${inf}/${chapter}: too many support screens`);
  if (['avere','viaggiare','credere'].includes(inf)) {
    for (const format of ['mc','pairs','type']) assert(questions.some(q => q.format === format), `${inf}/${chapter}: missing ${format}`);
    const independent = questions.filter(q => q.phase === 'independent');
    assert(independent.every(q => q.sentence && q.contextId), `${inf}/${chapter}: unaided verb checks need complete scenes`);
    assert.equal(new Set(independent.map(q => q.sentence)).size,production.length, `${inf}/${chapter}: every unaided target needs its own complete scene`);
    const repeats = questions.filter(q => q.sentence).reduce((map, q) => map.set(q.sentence, (map.get(q.sentence) || 0) + 1), new Map());
    assert(Math.max(...repeats.values()) <= 2, `${inf}/${chapter}: same sentence shown on too many exercise prompts: ${JSON.stringify(questions.filter(q=>repeats.get(q.sentence)>2).map(q=>({group:q.group,phase:q.phase,format:q.format,target:q.target,contextId:q.contextId,sentence:q.sentence})))}`);
  }
  if (inf === 'avere' && chapter === 'present') {
    const singular = questions.filter(q => q.group === 'singular' && q.phase === 'guided' && !q.supplemental);
    const board = singular.find(q => q.format === 'pairs');
    assert(board?.pairTargets.some(id => id.endsWith('::form-0')), 'matching board should replace the first simple-form prompts');
    assert(singular.some(q => q.target.endsWith('::formal')), 'formal Lei still needs its own supported check');
    assert.equal(skillState(run.learning,'v:avere::lesson::present::form-0').ready,false,'finished coverage must not claim consolidated readiness');
  }
  console.log(JSON.stringify({ inf, chapter, required: required.length, cards: run.trace.filter(s => s.type === 'teach').length, questions: questions.length, uniqueSentences: new Set(questions.map(q => q.sentence).filter(Boolean)).size, byPhase: count('phase'), byFormat: count('format'), supplemental: questions.filter(q => q.supplemental).length, byGroup: count('group') }));
  if (process.env.VERB_PACING_DETAIL === `${inf}:${chapter}`) console.log(questions.map(q => `${q.index} ${q.group} ${q.pass}/${q.phase.slice(0,1)} ${q.format} ${q.supplemental?'supp':''} ${q.target.split('::').at(-1)} v${q.variant} ${q.assistance?.length?'assisted':''} ->${q.correct ?? '-'}${q.ready?' ready':''}`).join('\n'));
}

// A saved historical policy still requires both varied, spaced productions.
// New coverage is never retroactively assigned to those immutable events.
{
  const old=runCase('viaggiare','present',{legacy:true});
  const questions=old.trace.filter(s=>s.type==='question'&&!s.awaitingContinue);
  const required=old.plan.chapters.find(c=>c.id==='present').groups.flatMap(g=>g.targets).filter(t=>t.required&&t.available!==false&&!t.supplementalOnly);
  assert.equal(old.session.journey.caseCoveragePolicy,undefined);
  assert.equal(questions.length,42);assert.equal(questions.filter(q=>q.phase==='independent').length,32);
  for(const target of required)assert(skillState(old.learning,target.id).ready,target.id);
  assert.equal(caseCoverage(old.plan,old.learning,'present').complete,false);
  assert(Object.values(old.learning.events).every(e=>e.caseCoveragePolicy===undefined));
}

// Saved pre-expansion variants use the exact old scene cycle, including an
// answer retained through feedback and a repair of that same failed scene.
{
  const entry = { ...verbs.find(e => e.inf === 'viaggiare'), kind: 'verb' };
  const plan = buildLesson(entry), chapter = plan.chapters.find(c => c.id === 'present');
  const target = chapter.groups.flatMap(g => g.targets).find(t => t.legacyAuthoredContexts?.length === 2 && t.contexts?.length > 2);
  assert(target, 'expected expanded contextual target');
  let learning = createLearning(1);
  let session = createJourneySession({ id: 'saved-v2-variant', plan, learning, now: 1, chapterId: 'present', caseMode: true, caseCoveragePolicy:null });
  session.journey.phase = 'checkpoint'; session.journey.groupIndex = chapter.groups.findIndex(g => g.targets.includes(target));
  session.journey.current = { targetId: target.id, phase: 'independent', format: 'type', variant: 2,
    questionId: 'saved-v2-variant:journey:42', supplemental: false, repairTag: null };
  session.journey.variants[target.id] = { guided: 0, independent: 3, repair: 0 };
  session.journey.serial = 42; session.ui = { version: 2, draft: 'old draft', exposures: {} };
  let step = currentJourneyStep(plan, session, learning, 2);
  assert.equal(Object.hasOwn(step, 'scenePolicy'), true);
  assert.equal(step.scenePolicy, undefined);
  const oldQuestion = buildJourneyQuestion(entry, chapter, target, step);
  const freshQuestion = buildJourneyQuestion(entry, chapter, target, { ...step, scenePolicy: 'expanded-v1' });
  assert.equal(oldQuestion.meta.contextId, target.legacyAuthoredContexts[0].id);
  assert.notEqual(oldQuestion.meta.contextId, freshQuestion.meta.contextId);
  assert.equal(session.ui.draft, 'old draft');
  session = chooseJourneyChapter(plan, session, 'past', { learning, now: 2 });
  session = chooseJourneyChapter(plan, session, 'present', { learning, now: 2 });
  step = currentJourneyStep(plan, session, learning, 2);
  assert.equal(session.ui.draft, 'old draft');
  assert.equal(step.questionId, 'saved-v2-variant:journey:42');
  assert.equal(buildJourneyQuestion(entry, chapter, target, step).meta.contextId, oldQuestion.meta.contextId);
  const event = journeyAttempt(plan, session, oldQuestion, { ok: false, outcome: 'incorrect', errorTags: ['uncertain'], components: [] }, { now: 3 });
  Object.assign(event, { deviceId: 'pacing-test', sequence: 1, epochId: learning.epoch.id });
  const result = recordAttempt(learning, event); learning = result.learning;
  session = recordJourneyAttempt(plan, session, event, result);
  assert.equal(session.journey.lastAttempt.scenePolicy, undefined);
  step = currentJourneyStep(plan, session, learning, 4);
  assert.equal(buildJourneyQuestion(entry, chapter, target, step).meta.contextId, oldQuestion.meta.contextId);
  session = advanceJourney(plan, session, learning, { now: 5 });
  session = advanceJourney(plan, session, learning, { now: 6 });
  step = currentJourneyStep(plan, session, learning, 7);
  assert.equal(step.type, 'question'); assert.equal(step.phase, 'repair');
  assert.equal(step.scenePolicy, undefined);
  assert.equal(buildJourneyQuestion(entry, chapter, target, step).meta.contextId, oldQuestion.meta.contextId);
}
const unavailablePast = runCase('concernere', 'past');
assert.equal(unavailablePast.status.exempt, true);
assert.equal(unavailablePast.status.ready, false);
assert.equal(unavailablePast.status.source, null);
assert.equal(unavailablePast.status.completedAt, null);
assert.equal(unavailablePast.trace.filter(step => step.type === 'question' && !step.awaitingContinue).length, 0);

// The shorter gap is still evidence, not an automatic retry allowance. One
// other activity separates the two full answers; a second cue for the same
// scene, assistance, or a fresh error cannot complete the target.
function evidence(rows, kind = 'verb') {
  const targetId = `v:pacing-proof::lesson::present::v2-${kind}`;
  let learning = createLearning(1);
  for (const [i, row] of rows.entries()) {
    const support = row.support === true, reveal = row.reveal === true, wrong = row.wrong === true;
    const event = { id: `pacing-event-${i}`, sessionId: 'pacing-evidence', index: i, at: i + 2,
      epochId: learning.epoch.id, deviceId: 'pacing-test', sequence: i + 1,
      policy: 'journey-v1', targetId, objectiveId: targetId, entryId: 'v:pacing-proof', kind,
      chapterId: 'present', contentVersion: 1, skill: 'conjugation', person: 0,
      contextPolicy: 'distinct-scene', contextId: row.scene || `support-${i}`, variantId: `cue-${i}`,
      activityKind: support ? 'guided' : 'independent', mode: support ? 'recognition' : 'production',
      ok: !wrong && !reveal, outcome: reveal ? 'revealed' : wrong ? 'incorrect' : 'correct',
      firstAttempt: !reveal, assistance: row.hint ? ['hint'] : [], errorTags: wrong ? ['person'] : [], components: [] };
    learning = recordAttempt(learning, event).learning;
  }
  return skillState(learning, targetId);
}
const A = { scene: 'scene-a' }, B = { scene: 'scene-b' }, gap = { support: true };
assert.equal(evidence([A, B]).ready, false, 'adjacent answers are massed practice');
assert.equal(evidence([A, gap, A]).ready, false, 'two cues for one scene are one context');
assert.equal(evidence([A, gap, { ...B, hint: true }]).ready, false, 'hints cannot earn recall');
assert.equal(evidence([A, gap, { ...B, reveal: true }]).ready, false, 'reveals cannot earn recall');
assert.equal(evidence([A, gap, B]).ready, true, 'one intervening activity spaces distinct unaided verb scenes');
assert.equal(evidence([A, gap, B], 'word').ready, false, 'word journey spacing is unchanged');
const repaired = evidence([A, gap, B, { scene: 'scene-c', wrong: true }, gap, { scene: 'scene-d' }, gap, { scene: 'scene-e' }]);
assert.equal(repaired.ready, true, 'two varied confirmations repair a later error');
console.log(`${budgets.length} verb pacing paths, saved-scene repair, and spacing evidence passed.`);
