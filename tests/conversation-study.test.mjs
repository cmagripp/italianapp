import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentenceLookup } from '../js/learning/sentence-lookup.js';
import { buildConversationSummary } from '../js/conversations/summary.js';
import { conversationStudyItems, buildConversationStudyPlan, restoreConversationStudy, conversationStudyAttempt } from '../js/conversations/study.js';
import { createLearning, recordAttempt, allSkills } from '../js/learning/model.js';
import { conjugate } from '../js/conjugator.js';

const vocab = JSON.parse(await readFile(new URL('../data/vocab.json', import.meta.url))).map(e => ({ ...e, kind: 'word' }));
const verbs = JSON.parse(await readFile(new URL('../data/verbs.json', import.meta.url))).map(e => ({ ...e, kind: 'verb', it: e.inf }));
const pool = [...vocab, ...verbs], entries = new Map(pool.map(e => [e.id, e]));
const lookup = createSentenceLookup({ vocab, verbs }), resolveEntry = id => entries.get(id);
const owner = { profileId: 'study-profile', learnerId: 'study-learner' }, services = { lookup, resolveEntry };
const state = text => ({ thread: { threadId: 'thread', ownerId: JSON.stringify(Object.values(owner)), contentRevision: 1, setup: {} },
  turns: [{ turnId: 'turn', revision: 1, role: 'learner', displayText: text }] });
const plan = (s, ids, extra = {}) => buildConversationStudyPlan(s, { ...services, selections: conversationStudyItems(s, services).filter(i => ids.includes(i.entryId)).map(i => ({ itemId: i.id })),
  owner, epochId: 'initial', pool, ...extra });

test('one selected word supports choice and flashcard study without a four-word minimum', () => {
  const s = state('casa'), p = plan(s, ['w:casa|noun']);
  assert.equal(p.targets.length, 1); assert.equal(p.activities[0].type, 'choice'); assert(p.targets[0].question.choices.length >= 2);
  const cards = plan(s, ['w:casa|noun'], { format: 'cards' }); assert.equal(cards.activities[0].type, 'card');
  assert.equal(restoreConversationStudy(p, null).index, 0);
});
test('unambiguous verb questions use only the encountered canonical tense and person', () => {
  const p = plan(state('Oggi studio italiano.'), ['v:studiare']), t = p.targets[0], q = t.question;
  assert.equal(t.observed.tense, 'presente'); assert.equal(q.meta.tense, 'presente'); assert.equal(q.meta.person, 0);
  assert.equal(q.meta.objectiveId, 'v:studiare::lesson::present::form-0');
  const forms = conjugate('studiare').tenses.presente;
  for (const choice of q.choices) assert(forms.includes(choice.label), choice.label);
  assert.deepEqual(q.meta.diagnostic.tenseForms, []);
});
test('person-ambiguous sono has lexical recognition only, without a guessed verb case', () => {
  const t = plan(state('Sono felice.'), ['v:essere']).targets[0];
  assert.equal(t.observed, null); assert.equal(t.question.meta.tense, null); assert.equal(t.question.meta.person, null);
  assert.equal(t.question.meta.mode, 'recognition'); assert.equal(t.question.meta.objectiveId, 'v:essere::meaning::recall');
});
test('an explicit lexical choice retains the encountered complete compound form and feminine source', () => {
  const s = state('Ieri sono andata al cinema.');
  s.turns[0].sourceContext = { lexicalChoices: [{ start: 10, end: 16, quote: 'andata', entryId: 'v:andare', revision: 1 }] };
  const t = plan(s, ['v:andare']).targets[0];
  assert.equal(t.observed.form, 'sono andata'); assert.equal(t.question.meta.tense, 'passatoProssimo');
  assert(t.question.choices.some(c => c.correct && c.label === 'sono andata'));
  assert.equal(t.question.say,'sono andata');
  assert.equal(t.source.quote, 'andata'); assert.equal(t.source.revision, 1);
});
test('imported summary glosses, tense guesses and stale selections cannot replace local sources', () => {
  const s = state('casa'); s.summary = { items: [{ id: 'fake', kind: 'vocabulary', entryId: 'v:studiare', meaning: 'invented', caseId: 'future' }] };
  const p = plan(s, ['w:casa|noun']); assert.notEqual(p.targets[0].meaning, 'invented');
  assert.throws(() => buildConversationStudyPlan(s, { ...services, selections: [{ itemId: 'fake' }], owner, epochId: 'initial', pool }), /source changed/);
});
test('a real graded answer records supported recognition with exact source context and no completion', () => {
  const p = plan(state('Oggi studio italiano.'), ['v:studiare']), session = restoreConversationStudy(p, null), t = p.targets[0];
  const given = t.question.choices.find(c => c.correct).value, answer = conversationStudyAttempt(p, session, t, given, 0, 100);
  assert.equal(answer.event.mode, 'recognition'); assert.deepEqual(answer.event.assistance, ['conversation-study']);
  assert(answer.event.contextId.includes('"revision":1')); assert.equal(answer.source.owner.profileId, owner.profileId);
  const recorded = recordAttempt(createLearning(), answer.event), repeated = recordAttempt(recorded.learning, answer.event);
  assert.equal(recorded.added, true); assert.equal(repeated.added, false); assert.equal(Object.keys(repeated.learning.events).length, 1);
  assert.deepEqual(repeated.learning.completions, {}); assert(allSkills(repeated.learning).every(s => !s.ready));
});
test('restoration validates answers instead of trusting outcomes or fabricated event IDs', () => {
  const p = plan(state('casa'), ['w:casa|noun']), saved = restoreConversationStudy(p, null), t = p.targets[0], wrong = t.question.choices.find(c => !c.correct).value;
  saved.index = 1; saved.answers.bad = { targetId: t.id, given: wrong, attempt: 0, ok: true };
  let resumed = restoreConversationStudy(p, saved); assert.equal(resumed.index, 0); assert.equal(Object.keys(resumed.answers).length, 0);
  const id = `${saved.sessionId}:${t.id}:0`; saved.answers = { [id]: { targetId: t.id, given: wrong, attempt: 0, ok: true } };
  resumed = restoreConversationStudy(p, saved); assert.equal(resumed.answers[id].ok, false); assert.equal(resumed.index, 1);
});
test('source version, owner, epoch and reference changes invalidate a prior session fingerprint', () => {
  const s = state('casa'), p = plan(s, ['w:casa|noun']), saved = restoreConversationStudy(p, null);
  for (const patch of [{ epochId: 'reset' }, { owner: { ...owner, learnerId: 'other' } }]) {
    const changed = plan(s, ['w:casa|noun'], patch); assert.notEqual(restoreConversationStudy(changed, saved).sessionId, saved.sessionId);
  }
  const changed = structuredClone(s); changed.turns[0].revision++; changed.thread.contentRevision++;
  assert.notEqual(restoreConversationStudy(plan(changed, ['w:casa|noun']), saved).sessionId, saved.sessionId);
});
test('summary preserves study UI only for the exact owner and source ranges', () => {
  const s = state('casa'), p = plan(s, ['w:casa|noun']); s.summary = { studyState: restoreConversationStudy(p, null) };
  assert(buildConversationSummary({ ...s, previous: s.summary }, services).studyState);
  for (const change of [x => x.thread.contentRevision++, x => x.thread.ownerId = '["other","learner"]', x => x.turns[0].displayText = 'case']) {
    const changed = structuredClone(s); change(changed); assert.equal(buildConversationSummary({ ...changed, previous: changed.summary }, services).studyState, undefined);
  }
});
test('matching supports small groups, uses source targets and falls back to choice for a single item', () => {
  const s = state('casa libro'), p = plan(s, ['w:casa|noun', 'w:libro|noun'], { format: 'match' });
  assert.equal(p.activities[0].type, 'pairs'); assert.equal(p.activities[0].question.pairs.length, 2);
  assert.equal(plan(s, ['w:casa|noun'], { format: 'match' }).activities[0].type, 'choice');
  const saved = restoreConversationStudy(p, null); saved.activity = { version: 1, id: p.activities[0].id, type: 'pairs', matches: [{ leftId: p.targets[0].id, rightId: p.activities[0].question.rightTiles.find(t => t.pairId === p.targets[0].id).id }] };
  assert.equal(restoreConversationStudy(p, saved).activity.matches.length, 0); // No matching answer was recorded.
});
