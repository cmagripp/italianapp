#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLabSession, currentLabStep, answerLab, advanceLab, compatibleLabSession, fillTemplate} from '../js/learning/sentence-lab.js';
import {initialLabTemplateRevision, resolveLabTemplate} from '../js/learning/lab-template-source.js';
import {workshopTemplateRevisions, workshopTemplatePrior, workshopTemplateReview, withoutWorkshopTemplateRevisions} from './workshop-template-revisions.mjs';
const root = new URL('../', import.meta.url), raw = fs.readFileSync(new URL(workshopTemplatePrior.path, root), 'utf8'), pack = JSON.parse(raw);
const sha = value => createHash('sha256').update(value).digest('hex');
const prior = withoutWorkshopTemplateRevisions(pack);
assert.equal(sha(JSON.stringify(prior)), workshopTemplatePrior.jsonSHA256, 'all original activity fields/identities/accepts/examples/reactions remain exact');
const row = workshopTemplateRevisions[0], lesson = pack.lessons.find(lesson => lesson.id === row.lessonId), activity = lesson.activities[row.activityIndex];
assert.equal(activity.id, row.activityId);
for (const field of ['templateRevision', 'templateByAgreement', 'legacyTemplate']) assert.deepEqual(activity[field], row[field]);
assert.deepEqual(activity.blanks[0].sourceExamplesByAgreement, row.sourceExamplesByAgreement);
const oldLesson = prior.lessons.find(lesson => lesson.id === row.lessonId), oldActivity = oldLesson.activities[row.activityIndex];
const reviewRaw = fs.readFileSync(new URL(workshopTemplateReview.reviewRecord, root), 'utf8'), review = JSON.parse(reviewRaw);
assert.equal(review.examples.length, 2);
for (const agreement of ['m', 'f']) {
  const chosen = row.sourceExamplesByAgreement[agreement][0], independent = review.examples.find(example => example.agreement === agreement);
  assert(independent);
  for (const field of ['it', 'en', 'agreement', 'subjectAgreement', 'subjectScope']) assert.deepEqual(chosen[field], independent[field]);
  assert.equal(chosen.reviewStatus, 'independent-agent-review');
}
const dictionary = {vocab: JSON.parse(fs.readFileSync(new URL('data/vocab.json', root))), verbs: JSON.parse(fs.readFileSync(new URL('data/verbs.json', root)))};
const cases = [], check = (name, fn) => {fn(); cases.push(name);};
const fresh = agreement => {
  const session = createLabSession(lesson, {now: 1}); session.speakerAgreement = agreement;
  // The immediately preceding real authored cloze is already answered. An
  // explicit Continue initializes the next activity with its current revision.
  session.index = row.activityIndex - 1;
  session.state = {kind: lesson.activities[session.index].kind, misses: 0, attempts: [], last: null, result: {ok: true, outcome: 'correct', sentence: 'Earlier saved sentence.'}, revealed: false, done: true};
  advanceLab(lesson, session, {now: 2}); return session;
};
for (const agreement of ['m', 'f']) {
  check(`${agreement}: fresh Continue stamps current source`, () => assert.equal(fresh(agreement).state.templateRevision, activity.templateRevision));
  const session = fresh(agreement), snapshot = structuredClone(session), view = currentLabStep(lesson, session);
  check(`${agreement}: lookup selects authored template without mutation`, () => {assert.equal(view.activity.template, activity.templateByAgreement[agreement]); assert.deepEqual(session, snapshot);});
  check(`${agreement}: selected source example fills all accepted blanks`, () => {const ex = view.activity.blanks[0].sourceExamples[0]; assert.equal(ex.agreement, agreement); assert.equal(ex.subjectAgreement, agreement); assert.equal(ex.it, fillTemplate(view.activity.template, ex.values)); ex.values.forEach((value, i) => assert(view.activity.blanks[i].accept.includes(value)));});
  const result = answerLab(lesson, session, ['resto'], {dictionary, speakerGender: agreement === 'm' ? 'f' : 'm', now: 3}).result;
  check(`${agreement}: grading uses same pinned template`, () => {assert(result.ok); assert.equal(result.sentence, fillTemplate(view.activity.template, ['resto']));});
  const answered = structuredClone(session);
  check(`${agreement}: repeated answer preserves exact result and session`, () => {assert.deepEqual(answerLab(lesson, session, ['dormo'], {now: 4}).result, result); assert.deepEqual(session, answered);});
  session.speakerAgreement = agreement === 'm' ? 'f' : 'm';
  check(`${agreement}: preference change preserves stored answer`, () => {assert.deepEqual(currentLabStep(lesson, session).result, result); assert.deepEqual(session.state.result, answered.state.result);});
  advanceLab(lesson, session, {now: 5});
  check(`${agreement}: Continue archives exact answered revision`, () => {assert.deepEqual(session.history.at(-1).result, result); assert.equal(session.history.at(-1).state.templateRevision, activity.templateRevision);});

  const legacy = fresh(agreement); delete legacy.state.templateRevision;
  legacy.state.ui = {drafts: ['rest'], values: ['resto'], touched: true}; legacy.state.attempts = [{sentence: fillTemplate(oldActivity.template, ['rest'])}];
  const pending = structuredClone(legacy);
  check(`${agreement}: unmarked legacy lookup preserves draft and exact old template`, () => {assert(compatibleLabSession(lesson, legacy)); assert.equal(currentLabStep(lesson, legacy).activity.template, oldActivity.template); assert.deepEqual(legacy, pending);});
  check(`${agreement}: explicit exact legacy marker resolves old template`, () => {const state = {...legacy.state, templateRevision: activity.legacyTemplate.revision}; assert.equal(resolveLabTemplate(activity, state, agreement).activity.template, oldActivity.template);});
  const legacyResult = answerLab(lesson, legacy, ['resto'], {dictionary, now: 6}).result;
  check(`${agreement}: old pending recipe grades exact old wording`, () => {assert.equal(legacyResult.sentence, fillTemplate(oldActivity.template, ['resto'])); assert(!Object.hasOwn(legacy.state, 'templateRevision')); assert.deepEqual(legacy.state.ui, pending.state.ui);});
  const oldAnswered = structuredClone(legacy);
  check(`${agreement}: legacy answered lookup preserves result`, () => {assert.deepEqual(currentLabStep(lesson, legacy).result, legacyResult); assert.deepEqual(legacy, oldAnswered);});
  advanceLab(lesson, legacy, {now: 7});
  check(`${agreement}: old result archives without revision rewrite`, () => {assert.deepEqual(legacy.history.at(-1).result, legacyResult); assert(!Object.hasOwn(legacy.history.at(-1).state, 'templateRevision'));});
  for (const revision of ['unreviewed-future', null, {}, 42, '', undefined]) {
    check(`${agreement}: unsupported ${JSON.stringify(revision)} preserves pending state without grading or advance`, () => {
      const unknown = structuredClone(pending); unknown.state.templateRevision = revision; const before = structuredClone(unknown);
      const unavailable = currentLabStep(lesson, unknown); assert.equal(unavailable.available, false); assert.equal(unavailable.kind, 'unavailable'); assert.equal(unavailable.activity, null);
      const response = answerLab(lesson, unknown, ['resto'], {dictionary, now: 8}); assert.equal(response.result, null); assert(response.unavailable);
      advanceLab(lesson, unknown, {now: 9}); assert.deepEqual(unknown, before);
    });
  }
  check(`${agreement}: unsupported answered source keeps result without completion`, () => {
    const unknown = structuredClone(oldAnswered); unknown.state.templateRevision = 'unreviewed-future'; const before = structuredClone(unknown);
    assert.deepEqual(currentLabStep(lesson, unknown).result, legacyResult); assert.deepEqual(answerLab(lesson, unknown, ['dormo']).result, legacyResult);
    advanceLab(lesson, unknown); assert.deepEqual(unknown, before);
  });
  check(`${agreement}: fresh/restart source initializes current revision`, () => {
    const boundedLesson = {...lesson, activities: [activity]}, restarted = createLabSession(boundedLesson, {now: 10}); restarted.speakerAgreement = agreement;
    assert.equal(restarted.state.templateRevision, activity.templateRevision); assert.equal(currentLabStep(boundedLesson, restarted).activity.template, activity.templateByAgreement[agreement]);
  });
}
for (const changes of [{templateRevision: activity.legacyTemplate.revision}, {templateByAgreement: {m: activity.template}}, {legacyTemplate: {...activity.legacyTemplate, template: 'Altered ____ source.'}}, {templateByAgreement: {m: activity.template, f: 'No blank.'}}, {templateRevision: null}, {legacyTemplate: {...activity.legacyTemplate, en: 'Altered translation.'}}, {blanks: activity.blanks.map(blank => ({...blank, sourceExamplesByAgreement: null}))}]) {
  check('malformed trusted declaration unavailable', () => {const source = {...activity, ...changes}; assert(!resolveLabTemplate(source, {templateRevision: activity.templateRevision}, 'f').available); assert.deepEqual(initialLabTemplateRevision(source), {});});
}
check('unversioned activities retain exact source and reject injected revision', () => {assert.equal(resolveLabTemplate(oldActivity, {}, 'f').activity, oldActivity); assert.deepEqual(initialLabTemplateRevision(oldActivity), {}); assert(!resolveLabTemplate(oldActivity, {templateRevision: activity.templateRevision}, 'f').available);});
check('legacy feminine own-speaker source remains explicitly unsupported', () => {const source = resolveLabTemplate(activity, {}, 'f'); assert(source.legacy); assert(source.activity.blanks[0].sourceExamples.every(ex => ex.agreement === 'm'));});
check('baseline projection rejects declarations outside the single authored locator', () => {
  for (const field of ['templateRevision', 'templateByAgreement', 'legacyTemplate']) {
    const hostile = structuredClone(pack), other = hostile.lessons.find(lesson => lesson.id === row.lessonId).activities[2]; other[field] = activity[field];
    assert.throws(() => withoutWorkshopTemplateRevisions(hostile), /Unexpected template declaration/);
  }
  const hostile = structuredClone(pack), other = hostile.lessons.find(lesson => lesson.id === row.lessonId).activities[2];
  other.blanks[0].sourceExamplesByAgreement = activity.blanks[0].sourceExamplesByAgreement;
  assert.throws(() => withoutWorkshopTemplateRevisions(hostile), /Unexpected example declaration/);
});
const report = {schemaVersion: 1, date: '2026-10-04', status: 'passed', scope: 'One stanco/stanca current-only cloze revision. Exact old authored source, pending drafts, attempts, answers and archived history retained; unknown revisions cannot grade/advance. Source-help and browser verification are separate integration gates.', checks: {cases: cases.length, currentProfiles: 2, changedActivities: 1, unchangedPriorPack: true}, prior: workshopTemplatePrior, sourcePins: {packSHA256: sha(raw), declarationsSHA256: sha(fs.readFileSync(new URL('tools/workshop-template-revisions.mjs', root)))}, independentChosenSource: {path: workshopTemplateReview.reviewRecord, sha256: sha(reviewRaw), examples: 2}, cases, gates: {independentChosenSource: 'two chosen current contexts passed', nativeItalianEducator: 'pending', browserPersistence: 'separate learning agent gate', canonicalHelpBinding: 'separate AI agent gate'}};
if (process.argv.includes('--report')) fs.writeFileSync(new URL('docs/implementation/programme/workshop-template-stanco-engine.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({status: report.status, ...report.checks}));
