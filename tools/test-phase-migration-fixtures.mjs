// Synthetic legacy backups through the real store/model. No personal data/network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { data } from '../js/data.js';
import { LEARNING_VERSION, normalizeLearning, mergeLearning, skillState, completionRecord } from '../js/learning/model.js';
import { lessonPlan, eligibleSkills } from '../js/learning/integration.js';
import { readLabSession } from '../js/learning/sentence-lab-data.js';

const ROOT = new URL('../tests/fixtures/phase-0-2/', import.meta.url);
const fixture = name => JSON.parse(fs.readFileSync(new URL(name, ROOT), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
class Storage {
  values = new Map();
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.values.set(k, String(v)); }
  removeItem(k) { this.values.delete(k); }
}
globalThis.localStorage = new Storage();
globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false, storage: { persist: async () => true } } });
data.vocab = JSON.parse(fs.readFileSync(new URL('../data/vocab.json', import.meta.url))).map(e => ({ ...e, kind: 'word' }));
data.verbs = JSON.parse(fs.readFileSync(new URL('../data/verbs.json', import.meta.url))).map(e => ({ ...e, it: e.inf, kind: 'verb' }));
data.byId = new Map([...data.vocab, ...data.verbs].map(e => [e.id, e])); data.loaded = true;
const { store } = await import('../js/store.js');
const manifest = fixture('manifest.json');
const at = manifest.fixtureTime + 3600e3;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('✓', name); };
const load = async name => { await store.importJSON(JSON.stringify(fixture(name))); return store.current; };

try {
  await store.init();
  await test('fixtures are declared synthetic and use the audited old schema', () => {
    assert.equal(manifest.synthetic, true); assert.equal(manifest.sourceLearningVersion, 5);
    for (const { file } of manifest.files) assert.ok(fixture(file));
  });
  await test('old aggregate XP and checks survive without invented answer evidence', async () => {
    const p = await load('legacy-v0-profile.json');
    assert.equal(p.stats.xp, 60); assert.equal(p.items['v:andare'].seen, 17);
    assert.equal(store.isLearned('v:andare'), true); assert.deepEqual(store.learning.events, {});
    assert.equal(completionRecord(store.learning, 'v:andare', 'present').source, 'legacy');
    assert.equal(skillState(store.learning, 'v:andare::presente::conjugation', at).status, 'new');
    assert.equal(p.items['w:retired-legacy|noun'].learned, true);
    assert.equal(store.learnedIds().includes('w:retired-legacy|noun'), false);
    assert.equal(p.custom['c:fixture-note'].it, 'coinquilina');
  });
  await test('old backup normalization and repeated round trips are idempotent', async () => {
    await load('legacy-v0-profile.json'); const before = clone(store.current);
    await store.importJSON(store.exportJSON(), { merge: true });
    await store.importJSON(store.exportJSON(), { merge: true });
    assert.equal(store.current.stats.xp, before.stats.xp);
    assert.deepEqual(store.learning.completions, before.learning.completions);
    assert.deepEqual(store.current.custom, before.custom); assert.deepEqual(store.current.lists, before.lists);
    assert.equal(store.learning.version, LEARNING_VERSION);
  });
  await test('legacy game difficulty and exact partial question survive migration', async () => {
    await load('legacy-v2-evidence-and-draft.json');
    assert.equal(Object.keys(store.learning.events).length, 1);
    const event = Object.values(store.learning.events)[0];
    assert.equal(event.objectiveId, 'v:andare::presente::conjugation'); assert.equal(event.ok, false);
    assert.equal(store.learning.session.ui.draft, 'and');
    assert.deepEqual(store.learning.session.ui.current.answers, ['vado']);
    assert.equal(store.current.stats.xp, 60);
  });
  await test('five available core cases survive separate manual checks and unchecks', async () => {
    await load('current-v5-partial-profile.json');
    const cases = store.completionState('v:andare').cases;
    assert.deepEqual(cases.map(c => c.id), ['present', 'past', 'background', 'future', 'condizionale']);
    assert.equal(cases.find(c => c.id === 'present').checked, true);
    assert.equal(cases.find(c => c.id === 'past').checked, false); assert.equal(store.isLearned('v:andare'), false);
    assert.equal(completionRecord(store.learning, 'v:andare', 'past').id, 'manual-uncheck-past');
    assert.ok(eligibleSkills(store, at).filter(s => s.entryId === 'v:andare').every(s => s.tense !== 'passatoProssimo'));
  });
  await test('manual all/individual edits neither create answers nor alter XP', async () => {
    const events = clone(store.learning.events), xp = store.current.stats.xp;
    store.setCompletion('v:andare', { checked: true });
    store.setCompletion('v:andare', { caseId: 'past', checked: false });
    assert.deepEqual(store.learning.events, events); assert.equal(store.current.stats.xp, xp);
    assert.equal(store.completionState('v:andare').completed, 4);
    await store.saveNow();
  });
  await test('supported word and assisted verb evidence do not become unaided mastery', async () => {
    await load('current-v5-partial-profile.json');
    for (const id of ['word-supported-answer', 'journey-assisted-answer']) {
      const e = store.learning.events[id]; assert.equal(skillState(store.learning, e.objectiveId, at).ready, false);
      assert.equal(skillState(store.learning, e.objectiveId, at).independentCorrect, 0);
    }
    const plan = lessonPlan(data.byId.get('w:casa|noun'));
    assert.ok(plan.wordLesson.slots.length <= 6);
    assert.equal(store.learning.events['word-supported-answer'].mode, 'recognition');
  });
  await test('legacy, chapter, grammar and workshop sessions coexist with exact drafts', async () => {
    const sessions = store.learning.sessions;
    assert.equal(sessions['v:andare|lesson'].ui.draft, 'and');
    assert.equal(sessions['v:andare|journey:lesson'].ui.draft, 'sono and');
    assert.equal(sessions['g:v2-a1-essere-singular|lesson'].ui.draft, 'Anna e');
    const lab = readLabSession(store, 'sl-presente-01-chi-sono');
    assert.equal(lab.state.ui.drafts[0], 'tedes'); assert.equal(lab.paused, true);
    const ids = Object.keys(sessions).sort(); await store.importJSON(store.exportJSON());
    assert.deepEqual(Object.keys(store.learning.sessions).sort(), ids);
    assert.equal(readLabSession(store, 'sl-presente-01-chi-sono').state.ui.drafts[0], 'tedes');
  });
  await test('recorded event IDs prevent repeated backup XP and duplicate responses', async () => {
    const before = clone(store.current), backup = store.exportJSON();
    await store.importJSON(backup, { merge: true }); await store.importJSON(backup, { merge: true });
    assert.deepEqual(store.learning.events, before.learning.events); assert.equal(store.current.stats.xp, 64);
    assert.equal(store.recordLearningAttempt(before.learning.events['grammar-partial-answer']).added, false);
    assert.equal(store.current.stats.xp, 64);
  });
  await test('new reset wins stale merge without removing lists or custom words', async () => {
    await load('reset-v5-profile.json');
    const retained = clone({ lists: store.current.lists, custom: store.current.custom });
    await store.importJSON(JSON.stringify(fixture('stale-backup-before-reset.json')), { merge: true });
    assert.equal(store.learning.epoch.id, 'reset:fixture'); assert.deepEqual(store.learning.events, {});
    assert.deepEqual(store.current.items, {}); assert.equal(store.current.stats.xp, 0);
    assert.deepEqual(store.current.lab.frasi, { done: {}, sentences: [] });
    assert.deepEqual(store.current.lists, retained.lists); assert.deepEqual(store.current.custom, retained.custom);
  });
  await test('pure epoch merge is commutative and stale manual fences cannot return', () => {
    const old = fixture('stale-backup-before-reset.json').profile.learning;
    const reset = fixture('reset-v5-profile.json').profile.learning;
    assert.deepEqual(mergeLearning(old, reset, at), mergeLearning(reset, old, at));
    assert.deepEqual(mergeLearning(reset, old, at).completions, {});
    assert.deepEqual(normalizeLearning(normalizeLearning(old, at), at), normalizeLearning(old, at));
  });
  await test('local learners isolate history, drafts and profile-specific accents', async () => {
    await load('current-v5-partial-profile.json'); const a = store.current.id;
    const b = (await store.createProfile('Synthetic isolated B')).id;
    await load('other-local-learner.json'); assert.equal(store.settings.accentStrict, true);
    assert.deepEqual(store.learning.events, {}); assert.equal(store.learning.session, null);
    await store.switchProfile(a); assert.equal(store.settings.accentStrict, false);
    assert.ok(store.learning.events['legacy-game-miss']); assert.equal(store.learning.session.ui.draft, 'sono and');
    assert.notEqual(a, b);
  });
  await test('future learning schema is preserved by normalization and refused by import', async () => {
    const future = clone(store.current); future.learning.version = LEARNING_VERSION + 1;
    future.learning.futureField = { retained: true }; assert.deepEqual(normalizeLearning(future.learning), future.learning);
    const before = clone(store.current); await assert.rejects(store.importJSON(JSON.stringify({ profile: future })), /newer version/i);
    assert.deepEqual(store.current, before);
  });
  await test('recordings and cloud identities are explicitly separate synthetic inventories', () => {
    const sidecar = fixture('recordings-and-cloud-sidecar.json');
    assert.equal(sidecar.profileJSONContainsRecordings, false);
    assert.ok(sidecar.recordingStore.records.every(r => r.key.startsWith(sidecar.profileId + '|')));
    assert.equal(sidecar.cloudBindings[0].accountId, sidecar.cloudBindings[1].accountId);
    assert.notEqual(sidecar.cloudBindings[0].localProfileId, sidecar.cloudBindings[1].localProfileId);
    const exported = JSON.parse(store.exportJSON()); assert.equal(exported.recordingStore, undefined);
    assert.equal(exported.profile.access, undefined); assert.equal(exported.profile.refresh, undefined);
  });
  console.log(`\n${passed} synthetic old-profile preservation checks passed. Design-only and baseline regression gates remain in the manifest.`);
} finally { clearTimeout(store._saveTimer); }
