import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { data } from '../js/data.js';
import { createLearning, recordAttempt, createSession, skillState, selectNext, setCompletionRecord } from '../js/learning/model.js';
import { objectivesFor, stageObjectives, CORE_STAGES } from '../js/learning/curriculum.js';
import { activeObjectives, eligibleSkills, dueSkills, reviewItems, recommend, courseProgress, practiceHref } from '../js/learning/integration.js';
import { buildQuestion } from '../js/learning/questions.js';
import { gradeQuestion } from '../js/learning/diagnose.js';

data.vocab = JSON.parse(await readFile(new URL('../data/vocab.json', import.meta.url), 'utf8')).map(e => ({ ...e, kind: 'word' }));
data.verbs = JSON.parse(await readFile(new URL('../data/verbs.json', import.meta.url), 'utf8')).map(e => ({ ...e, kind: 'verb', it: e.inf }));
data.byId = new Map([...data.vocab, ...data.verbs].map(e => [e.id, e])); data.loaded = true;
const START = 1700000000000, DAY = 86400e3;
const verb = name => data.verbs.find(e => e.inf === name);
const word = name => data.vocab.find(e => e.it === name && e.pos === 'noun');
let passed = 0;
function test(name, run) { try { run(); passed++; console.log(`✓ ${name}`); } catch (err) { console.error(`✗ ${name}`); throw err; } }

function fixture({ stage = 'present', entries = null } = {}) {
  let sequence = 0;
  const indices = new Map();
  const store = {
    learning: createLearning(START), current: { custom: {}, customDeleted: {}, items: {} },
    lists: { bank: { id: 'bank', items: entries?.map(e => e.id) || [] } },
    scope: entries ? { mode: 'lists', lists: ['bank'] } : { mode: 'level', levels: ['A1'], cats: [] },
    isLearned(id) { return !!this.current.items[id]?.learned; },
    learnedIds() { return Object.keys(this.current.items).filter(id => this.current.items[id].learned); },
    dueIds(now = Date.now()) { return Object.keys(this.current.items).filter(id => this.current.items[id].due && this.current.items[id].due <= now); },
  };
  store.learning.preferences.stage = stage;
  store.completeCase=(entry,caseId)=>{store.learning=setCompletionRecord(store.learning,{entryId:entry.id,caseId,checked:true,at:START,id:`complete:${entry.id}:${caseId}`});};
  store.add = (objective, patch = {}) => {
    const sessionId = patch.sessionId || 'initial', index = indices.get(sessionId) || 0;
    const event = {
      id: `fixture:${++sequence}`, epochId: store.learning.epoch.id, deviceId: 'fixture', sequence,
      sessionId, index, at: START + sequence * 1000,
      objectiveId: objective.id, entryId: objective.entryId, kind: objective.kind, skill: objective.skill, tense: objective.tense || null, person: null,
      mode: 'production', variantId: `question-${sequence}`, contextId: `context-${sequence}`, ok: true, outcome: 'correct',
      assistance: [], firstAttempt: true, errorTags: [], components: [], xp: 0, ...patch,
    };
    indices.set(sessionId, index + 1);
    const recorded = recordAttempt(store.learning, event); store.learning = recorded.learning;
    return recorded;
  };
  store.spacer = (patch = {}) => store.add({ id: 'fixture-spacer', entryId: 'fixture-entry', kind: 'word', skill: 'meaning' }, { mode: 'recognition', ...patch });
  store.master = (objective, { remembered = false, persons = null, at = START } = {}) => {
    const sessionId = `lesson:${objective.id}`, values = persons || [null, null, null, null];
    values.forEach((person, i) => {
      store.add(objective, { sessionId, person, at: at + i * 3000, variantId: `lesson-${i}`, contextId: `lesson-context-${i}` });
      if (i < values.length - 1) { store.spacer({ sessionId, at: at + i * 3000 + 1000 }); store.spacer({ sessionId, at: at + i * 3000 + 2000 }); }
    });
    const ready = skillState(store.learning, objective.id, at);
    assert.equal(ready.ready, true, 'fixture must establish actual ready evidence');
    if (remembered) {
      for (let i = 0; i < 2; i++) store.add(objective, { sessionId: `later:${objective.id}`, at: ready.readyAt + DAY + i * 1000, person: values[i], variantId: `later-${i}`, contextId: `later-context-${i}` });
      assert.equal(skillState(store.learning, objective.id, at + 2 * DAY).remembered, true);
    }
  };
  return store;
}

test('due skills are ordered by their schedules and keep skill-level identities', () => {
  const store = fixture();
  const first = objectivesFor(verb('andare'))[1], second = objectivesFor(verb('parlare'))[1];
  store.completeCase(verb('andare'),'present');store.completeCase(verb('parlare'),'present');
  store.add(first, { ok: false, outcome: 'incorrect', at: START + 1000 });
  store.add(second, { ok: false, outcome: 'incorrect', at: START + 500 });
  const due = dueSkills(store, START + DAY);
  assert.deepEqual(due.slice(0,2).map(s => s.objectiveId), [second.id, first.id]);
  assert.equal(recommend(store, { now: START + DAY }).objectiveId, second.id);
  assert.equal(recommend(store, { now: START + DAY }).mode, 'review');
});

test('a completed core conditional is reviewable independently of old expansion preferences', () => {
  const store = fixture();
  const expanded = objectivesFor(verb('andare'), { stage: 'present', expansions: ['requests'] }).find(o => o.tense === 'condizionale');
  store.add(expanded, { ok: false, outcome: 'incorrect' });
  assert.equal(dueSkills(store, START + DAY).some(s => s.objectiveId === expanded.id), false);
  store.completeCase(verb('andare'),'condizionale');store.learning.preferences.expansions = ['requests'];
  assert.equal(dueSkills(store, START + DAY).some(s => s.objectiveId === expanded.id), true);
  store.learning.preferences.expansions = [];
  assert.equal(dueSkills(store, START + DAY).some(s => s.objectiveId === expanded.id), true);
  assert.equal(Object.keys(store.learning.events).length, 1);
});

test('legacy learned/due items enter diagnosis without fabricated skill readiness', () => {
  const entry = verb('andare'), store = fixture({ entries: [entry] });
  store.current.items[entry.id] = { learned: true, due: START - 1, seen: 90, ok: 90, s: 5 };
  store.learning=setCompletionRecord(store.learning,{entryId:entry.id,caseId:'*',checked:true,at:START-DAY,id:'legacy-known',source:'legacy'});
  const queue = reviewItems(store, START);
  assert.ok(queue.length>0); assert.ok(queue.every(x=>x.objectiveId && !x.skill.ready));
  for (const objective of activeObjectives(entry, store.learning)) assert.equal(skillState(store.learning, objective.id, START).ready, false);
});

test('completed word meaning records are eligible; an unfinished attempt alone is not', () => {
  const entry = word('casa'), store = fixture({ entries: [entry] });
  const meaning = objectivesFor(entry).find(o => o.skill === 'meaning');
  store.add(meaning, { ok: false, outcome: 'incorrect' });
  assert.deepEqual(eligibleSkills(store,START+DAY),[]);
  store.completeCase(entry,'word');
  assert.equal(eligibleSkills(store, START + DAY)[0].objectiveId, meaning.id);
  assert.equal(recommend(store, { kind: 'word', now: START + DAY }).objectiveId, meaning.id);
});

test('automatic review respects the selected list for both adaptive and legacy items', () => {
  const inside = verb('parlare'), outside = verb('andare'), store = fixture({ entries: [inside] });
  const outsideObjective = objectivesFor(outside)[1];
  store.add(outsideObjective, { ok: false, outcome: 'incorrect' });
  store.current.items[verb('essere').id] = { learned: true, due: START - 1 };
  assert.deepEqual(dueSkills(store, START + DAY), []);
  assert.deepEqual(reviewItems(store, START + DAY), []);
  assert.equal(recommend(store, { now: START + DAY }).entry.id, inside.id);
});

test('deleted custom entries remain excluded even before a stale data index is rebuilt', () => {
  const entry = { id: 'c:deleted-fixture', it: 'test', en: 'test', pos: 'noun', g: 'm', pl: 'test', kind: 'word', level: 'A1' };
  data.byId.set(entry.id, entry);
  try {
    const store = fixture();
    store.current.customDeleted[entry.id] = START;
    store.add(objectivesFor(entry)[0], { ok: false, outcome: 'incorrect' });
    store.current.items[entry.id] = { due: START - 1, learned: true };
    assert.equal(reviewItems(store, START + DAY).some(x => x.entry.id === entry.id), false);
  } finally { data.byId.delete(entry.id); }
});

test('unfinished sessions are filtered by current curriculum and preserve checkpoint mode', () => {
  const entry = verb('andare'), store = fixture({ entries: [entry] });
  const present = objectivesFor(entry)[1];
  const advanced = objectivesFor(entry, { expansions: ['requests'] }).find(o => o.tense === 'condizionale');
  const valid = createSession({ id: 'valid', entryId: entry.id, objectiveIds: [present.id], mode: 'checkpoint', now: START });
  valid.ui = { phase: 'question' };
  const inactive = createSession({ id: 'inactive', entryId: entry.id, objectiveIds: [advanced.id], now: START + 1 });
  inactive.ui = { phase: 'question' };
  store.learning.sessions = { valid, inactive };
  const next = recommend(store, { now: START });
  assert.equal(next.session.id, 'valid');
  assert.equal(next.objectiveId, present.id); assert.equal(next.mode, 'checkpoint');
});

test('excluded/skipped objectives cannot return through a multi-objective resume link', () => {
  const entry = word('casa'), store = fixture({ entries: [entry] });
  const objectives = objectivesFor(entry).slice(0, 2);
  const session = createSession({ id: 'multi', entryId: entry.id, objectiveIds: objectives.map(o => o.id), now: START });
  session.ui = { phase: 'question' };
  store.learning.sessions = { multi: session };
  const next = recommend(store, { now: START, excludeObjectives: [objectives[0].id] });
  assert.equal(next.objectiveId, objectives[1].id);
});

test('new foundation verbs teach their meaning before asking for their forms', () => {
  const entry = verb('parlare'), store = fixture({ entries: [entry] });
  const next = recommend(store, { kind: 'verb', now: START });
  assert.equal(next.entry.id, entry.id);
  assert.equal(next.objectiveId, objectivesFor(entry)[0].id);
  assert.equal(next.mode, 'lesson');
  store.master(objectivesFor(entry)[0]);
  const afterMeaning = recommend(store, { kind: 'verb', now: START });
  assert.equal(afterMeaning.mode, 'checkpoint');
  assert.equal(afterMeaning.objectiveId, objectivesFor(entry)[1].id);
});

test('foundation recommendations never silently expand a restricted scope', () => {
  const entry = verb('parlare'), store = fixture({ entries: [entry] });
  for (const o of stageObjectives([entry], 'present')) assert.equal(o.entryId, entry.id);
  const next = recommend(store, { kind: 'verb', now: START });
  assert.equal(next.entry.id, entry.id);
  store.scope = { mode: 'lists', lists: [] };
  assert.equal(recommend(store, { kind: 'verb', now: START }), null);
});

test('course checkpoints are finite and readiness alone never means course completion', () => {
  const store = fixture();
  const progress = courseProgress(store, START);
  assert.deepEqual(progress.map(stage => stage.total), [7, 5, 3, 4, 3]);
  assert.equal(progress.reduce((n, stage) => n + stage.total, 0), 22);
  assert.ok(progress.every(stage => !stage.complete));
  const o = stageObjectives(data.verbs, 'present')[0];
  store.master(o, { persons: [0, 1, 2, 3] });
  const partial = courseProgress(store, START)[0].checkpoints.find(c => c.objective.id === o.id);
  assert.equal(partial.state.ready, true);
  assert.equal(partial.ready, false); assert.equal(partial.coverage, false);
});

test('all finite checkpoints can complete through actual evidence and delayed recall', () => {
  const store = fixture({ stage: 'future' });
  for (const stage of CORE_STAGES) for (const o of stageObjectives(data.verbs, stage.id)) {
    store.master(o, { remembered: true, persons: o.personsRequired || null });
  }
  const progress = courseProgress(store, START + 3 * DAY);
  assert.ok(progress.every(stage => stage.complete));
  assert.equal(progress.reduce((n, stage) => n + stage.remembered, 0), 22);
  assert.ok(Object.keys(store.learning.events).length < 500);
});

test('a recent wrong or assisted answer removes remembered status despite old delayed wins', () => {
  const store = fixture(), o = objectivesFor(verb('andare'))[1];
  store.master(o, { remembered: true });
  assert.equal(skillState(store.learning, o.id, START + 3 * DAY).remembered, true);
  store.add(o, { at: START + 3 * DAY, sessionId: 'recent', mode: 'recognition', ok: false, outcome: 'incorrect', components: [{ skill: 'person', ok: false }], person: 1 });
  assert.equal(skillState(store.learning, o.id, START + 3 * DAY).remembered, false);
  store.add(o, { at: START + 3 * DAY + 1000, sessionId: 'recent', assistance: ['hint'] });
  assert.equal(skillState(store.learning, o.id, START + 3 * DAY).ready, false);
});

test('real question/diagnosis metadata keeps a person repair attached to that person', () => {
  const entry = verb('parlare'), store = fixture({ entries: [entry] }), o = objectivesFor(entry)[1];
  store.master(o);
  const q = buildQuestion(entry, o, { mode: 'production', variant: 1, allowedTenses: ['presente'], pool: [entry], rng: () => 0.5 });
  assert.equal(q.meta.person, 1);
  const result = gradeQuestion(q, 'parla');
  assert.equal(result.ok, false); assert.ok(result.components.some(c => c.skill === 'person' && !c.ok));
  store.add(o, { ...q.meta, at: START + DAY, ok: result.ok, outcome: result.outcome, errorTags: result.errorTags, components: result.components });
  store.spacer({ at: START + DAY + 1000 }); store.spacer({ at: START + DAY + 2000 });
  const session = createSession({ id: 'initial', entryId: entry.id, objectiveIds: [o.id], now: START });
  const selection = selectNext(store.learning, session, [o], { now: START + DAY });
  assert.equal(selection.repairPerson, 1);
  const variants = [0, 1].map(variant => buildQuestion(entry, o, { mode: 'production', variant, repairPerson: selection.repairPerson, allowedTenses: ['presente'], pool: [entry], rng: () => 0.5 }));
  assert.ok(variants.every(q => q.meta.person === 1));
  assert.notEqual(variants[0].meta.variantId, variants[1].meta.variantId);
});

test('a real whole-form auxiliary mistake selects its component scaffold before the generic failure', () => {
  const entry = verb('andare'), store = fixture({ stage: 'past', entries: [entry] });
  const o = objectivesFor(entry, { stage: 'past' }).find(o => o.tense === 'passatoProssimo' && o.skill === 'conjugation');
  const options = { allowedTenses: ['presente', 'passatoProssimo'], pool: [entry], rng: () => .5 };
  const full = buildQuestion(entry, o, { ...options, mode: 'production', variant: 0 });
  assert.equal(full.meta.person, 0);
  const wrong = gradeQuestion(full, 'ho andato');
  assert.deepEqual(wrong.errorTags, ['auxiliary']);
  assert.equal(wrong.components[0].skill, 'conjugation');
  store.add(o, { ...full.meta, ok: wrong.ok, outcome: wrong.outcome, errorTags: wrong.errorTags, components: wrong.components });
  store.spacer(); store.spacer();
  const session = createSession({ id: 'initial', entryId: entry.id, objectiveIds: [o.id], now: START });
  const selection = selectNext(store.learning, session, [o], { now: START });
  assert.equal(selection.mode, 'recognition');
  assert.equal(selection.repairTag, 'auxiliary');
  const repair = buildQuestion(entry, o, { ...options, ...selection });
  assert.equal(repair.meta.scaffold, true);
  assert.equal(repair.meta.skill, 'auxiliary');
  const correct = gradeQuestion(repair, repair.answer[0]);
  store.add(o, { ...repair.meta, ok: correct.ok, outcome: correct.outcome, errorTags: correct.errorTags, components: correct.components });
  const state = skillState(store.learning, o.id, START);
  assert.equal(state.ready, false);
  assert.equal(state.independentCorrect, 0);
  assert.ok(state.unresolvedErrors.some(error => error.tag === 'auxiliary'));
  const next = selectNext(store.learning, session, [o], { now: START });
  assert.equal(next.mode, 'production');
  const retry = buildQuestion(entry, o, { ...options, ...next });
  assert.equal(retry.meta.scaffold, undefined);
  assert.equal(retry.meta.skill, 'conjugation');
});

test('real partial scaffolds cannot certify full conjugation and return to whole-form production', () => {
  const entry = verb('andare'), store = fixture({ stage: 'past', entries: [entry] });
  const o = objectivesFor(entry, { stage: 'past' }).find(o => o.tense === 'passatoProssimo' && o.skill === 'conjugation');
  for (let variant = 0; variant < 6; variant++) {
    const q = buildQuestion(entry, o, { mode: 'recognition', repairTag: 'auxiliary', variant, allowedTenses: ['presente', 'passatoProssimo'], pool: [entry], rng: () => .5 });
    assert.equal(q.meta.objectiveId, o.id);
    assert.equal(q.meta.scaffold, true);
    assert.equal(q.meta.mode, 'recognition');
    assert.equal(q.meta.evidenceMode, 'recognition');
    const grade = gradeQuestion(q, q.answer[0]);
    assert.equal(grade.ok, true);
    assert.equal(grade.components.some(c => c.skill === 'conjugation'), false);
    store.add(o, { ...q.meta, ok: grade.ok, outcome: grade.outcome, components: grade.components });
  }
  const state = skillState(store.learning, o.id, START);
  assert.equal(state.ready, false); assert.equal(state.independentCorrect, 0);
  const session = createSession({ id: 'initial', entryId: entry.id, objectiveIds: [o.id], now: START });
  const selected = selectNext(store.learning, session, [o], { now: START });
  assert.equal(selected.mode, 'production');
  const full = buildQuestion(entry, o, { mode: selected.mode, repairTag: 'auxiliary', variant: selected.variant, allowedTenses: ['presente', 'passatoProssimo'], pool: [entry], rng: () => .5 });
  assert.equal(full.meta.mode, 'production');
  assert.equal(full.meta.skill, 'conjugation');
  assert.equal(full.meta.scaffold, undefined);
  assert.ok(full.answer.every(answer => answer.includes(' ')));
});

test('practice links preserve single objective and session mode', () => {
  const entry = verb('andare'), id = objectivesFor(entry)[1].id;
  const href = practiceHref(entry, id, 'checkpoint');
  const params = new URLSearchParams(href.split('?')[1]);
  assert.equal(params.get('objective'), id); assert.equal(params.get('mode'), 'checkpoint');
});

console.log(`\n${passed} recommendation/course integration checks passed.`);
