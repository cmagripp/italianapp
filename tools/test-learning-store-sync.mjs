// Real store/sync modules, isolated browser primitives and a fake Supabase endpoint.
// This never reads browser profiles, opens a socket or contacts a cloud account.
import assert from 'node:assert/strict';
import { recordAttempt, skillState } from '../js/learning/model.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}
globalThis.localStorage = new MemoryStorage();
globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, storage: { persist: async () => true } } });
globalThis.fetch = async () => { throw new Error('Unexpected network request: this test only permits mocked requests'); };
const { store } = await import('../js/store.js');
const sync = await import('../js/sync.js');
const clone = (value) => JSON.parse(JSON.stringify(value));
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) });
const totalLearningXP = (learning) => Object.values(learning.events).reduce((sum, e) => sum + e.xp, 0);
let count = 0, sequence = 0;
const START = 1700000000000;
const objectiveId = 'v:andare:presente:conjugation';
function attempt(patch = {}) {
  const n = ++sequence;
  return {
    id: `test:${n}`, sessionId: 'local-session', index: n, at: START + n * 1000,
    objectiveId, entryId: 'v:andare', kind: 'verb', skill: 'conjugation', tense: 'presente', person: n % 6,
    mode: 'production', variantId: `variant-${n}`, contextId: '', ok: true, outcome: 'correct',
    assistance: [], firstAttempt: true, errorTags: [], components: [], xp: 2,
    ...patch,
  };
}
function addRemote(profile, patch = {}) {
  const event = attempt({ deviceId: 'remote-device', sequence: sequence + 1, sessionId: 'remote-session', epochId: profile.learning.epoch.id, ...patch });
  const result = recordAttempt(profile.learning, event);
  profile.learning = result.learning;
  profile.stats.xp += result.added ? event.xp : 0;
  profile.stats.learningXP = totalLearningXP(profile.learning);
  return event;
}
function configureSync(profileId = store.current.id) {
  localStorage.setItem('it.sync.' + profileId, JSON.stringify({ url: 'https://example.invalid', anonKey: 'test-anon', access: 'test-access', refresh: 'test-refresh', userId: 'test-user', enabled: true, lastSync: 0, lastError: '' }));
}
async function test(name, run) {
  try { await run(); count++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

try {
  await store.init();
  const profileA = store.current.id;
  let profileB;

  await test('legacy backup migrates additively without inventing skill knowledge', async () => {
    await store.importJSON(JSON.stringify({ profile: {
      name: 'Legacy learner', items: { 'v:andare': { learned: true, seen: 17, ok: 12, ko: 5, last: START } },
      lists: { bank: { id: 'bank', name: 'My word bank', items: ['v:andare'] } },
      settings: { level: 'A2', theme: 'light' }, stats: { xp: 40, wordsLearned: 2, verbsLearned: 1 },
    } }));
    assert.equal(store.current.id, profileA);
    assert.equal(store.current.version, 2);
    assert.equal(store.current.items['v:andare'].learned, true);
    assert.equal(store.current.items['v:andare'].seen, 17);
    assert.equal(store.current.stats.xp, 40);
    assert.equal(store.current.settings.level, 'A2');
    assert.deepEqual(store.current.lists.bank.items, ['v:andare']);
    assert.equal(skillState(store.learning, objectiveId, START).status, 'new');
  });

  await test('duplicate attempts cannot double XP or daily answer totals', () => {
    const event = attempt({ id: 'stable-event' });
    const first = store.recordLearningAttempt(event);
    const xp = store.current.stats.xp, correct = store.today().correct;
    assert.equal(first.added, true); assert.equal(xp, 42);
    assert.equal(store.recordLearningAttempt(event).added, false);
    assert.equal(store.current.stats.xp, xp);
    assert.equal(store.today().correct, correct);
    assert.equal(store.current.stats.learningXP, 2);
  });

  await test('importing the same backup twice is idempotent for evidence and rewards', async () => {
    const backup = store.exportJSON();
    await store.importJSON(backup, { merge: true });
    await store.importJSON(backup, { merge: true });
    assert.equal(Object.keys(store.learning.events).length, 1);
    assert.equal(store.current.stats.xp, 42);
    assert.equal(store.current.stats.learningXP, 2);
  });

  await test('concurrent devices retain separate skills and count each adaptive reward once', async () => {
    const remote = clone(store.current);
    const event = addRemote(remote, { objectiveId: 'v:andare:passatoProssimo:auxiliary', skill: 'auxiliary', tense: 'passatoProssimo' });
    await store.importJSON(JSON.stringify({ profile: remote }), { merge: true });
    assert.ok(store.learning.events['stable-event']); assert.ok(store.learning.events[event.id]);
    assert.equal(store.learningSkills().length, 2);
    assert.equal(store.current.stats.xp, 44);
    await store.importJSON(JSON.stringify({ profile: remote }), { merge: true });
    assert.equal(store.current.stats.xp, 44);
  });

  await test('saved lesson UI survives a persisted profile round trip', async () => {
    store.saveLearningSession({
      id: 'resumable', entryId: 'v:andare', mode: 'lesson', objectiveIds: [objectiveId], activeObjectiveId: objectiveId,
      index: 3, createdAt: START, updatedAt: START, deferred: {}, answeredEventIds: ['stable-event'],
      ui: { phase: 'feedback', draft: '', current: { objectiveId, seed: 42 }, result: { ok: false, feedback: 'Use essere.' } },
    });
    await store.saveNow(); await store.switchProfile(profileA);
    assert.equal(store.learning.sessions['v:andare|lesson'].ui.phase, 'feedback');
    assert.equal(store.learning.sessions['v:andare|lesson'].ui.current.seed, 42);
    assert.equal(store.learning.session.index, 3);
  });

  await test('switching local users isolates evidence, rewards and resume state', async () => {
    profileB = (await store.createProfile('Second learner')).id;
    assert.notEqual(profileB, profileA);
    assert.deepEqual(store.learning.events, {});
    assert.equal(store.learning.session, null);
    store.recordLearningAttempt(attempt({ id: 'profile-b-event', objectiveId: 'w:libro:recall', entryId: 'w:libro', kind: 'word', skill: 'recall', tense: null }));
    await store.switchProfile(profileA);
    assert.equal(store.learning.events['profile-b-event'], undefined);
    assert.ok(store.learning.events['stable-event']);
    assert.equal(store.learning.session.id, 'resumable');
    await store.switchProfile(profileB);
    assert.ok(store.learning.events['profile-b-event']);
    assert.equal(store.learning.events['stable-event'], undefined);
    await store.switchProfile(profileA);
  });

  await test('custom-word deletion survives stale backup merges without losing reward deduplication', async () => {
    const id = store.addCustomWord({ it: 'prova', en: 'test', pos: 'noun', g: 'f', pl: 'prove', level: 'A1' });
    store.ensureItem(id).learned = true;
    const event = store.recordLearningAttempt(attempt({ objectiveId: id + ':recall', entryId: id, kind: 'word', skill: 'recall', tense: null })).event;
    store.saveLearningSession({ id: 'custom-resume', entryId: id, mode: 'lesson', objectiveIds: [event.objectiveId], index: 1, createdAt: START, ui: { phase: 'question' } });
    const stale = store.exportJSON(), xp = store.current.stats.xp;
    store.removeCustomWord(id);
    await store.importJSON(stale, { merge: true });
    await store.importJSON(stale, { merge: true });
    assert.equal(store.current.custom[id], undefined);
    assert.equal(store.current.items[id], undefined);
    assert.equal(store.current.lists.bank.items.includes(id), false);
    assert.equal(store.learning.sessions[id + '|lesson'], undefined);
    assert.notEqual(store.learning.session?.entryId, id);
    assert.ok(store.learning.events[event.id]);
    assert.equal(store.current.stats.xp, xp);
    assert.equal(store.recordLearningAttempt(event).added, false);
    assert.equal(store.current.stats.xp, xp);
  });

  await test('game evidence does not double legacy XP or daily answer totals', () => {
    store.recordAnswer('v:andare', true, { xp: 2 });
    const xp = store.current.stats.xp, day = clone(store.today());
    const result = store.recordLearningAttempt(attempt({ id: 'game-evidence', xp: 0, countStats: false }));
    assert.equal(result.added, true);
    assert.equal(store.current.stats.xp, xp);
    assert.deepEqual(store.today(), day);
  });

  await test('a due skill counts once per session even when assisted practice leaves it due', () => {
    const id = 'v:andare::presente::review-counter';
    store.recordLearningAttempt(attempt({ objectiveId: id, at: START, sessionId: 'old-counter', ok: false, outcome: 'incorrect', xp: 0, countStats: false }));
    const before = store.today().reviews || 0;
    store.recordLearningAttempt(attempt({ objectiveId: id, at: START + 86400e3, sessionId: 'current-counter', assistance: ['hint'], xp: 0 }));
    store.recordLearningAttempt(attempt({ objectiveId: id, at: START + 86401e3, sessionId: 'current-counter', assistance: ['hint'], xp: 0 }));
    assert.equal(store.today().reviews, before + 1);
  });

  await test('reset followed by stale import cannot restore old learning, legacy progress or XP', async () => {
    const stale = store.exportJSON();
    await store.resetProgress();
    const epoch = clone(store.learning.epoch);
    await store.importJSON(stale, { merge: true });
    assert.deepEqual(store.learning.epoch, epoch);
    assert.deepEqual(store.learning.events, {});
    assert.deepEqual(store.current.items, {});
    assert.equal(store.current.stats.xp, 0);
    assert.equal(store.learning.session, null);
    assert.ok(store.current.lists.bank.items.includes('v:andare'));
  });

  await test('a newer remote reset clears local progress without deleting lists', async () => {
    const afterReset = store.exportJSON();
    store.recordLearningAttempt(attempt());
    const preRemoteReset = store.exportJSON();
    await store.resetProgress();
    const remoteReset = store.exportJSON();
    await store.importJSON(preRemoteReset); // simulate an offline device restoring its pre-reset snapshot
    assert.equal(Object.keys(store.learning.events).length, 1);
    await store.importJSON(remoteReset, { merge: true });
    assert.deepEqual(store.learning.events, {}); assert.equal(store.current.stats.xp, 0);
    assert.ok(store.current.lists.bank.items.includes('v:andare'));
    await store.importJSON(afterReset, { merge: true });
    assert.deepEqual(store.learning.events, {});
  });

  await test('cloud conflicts refetch, merge concurrent evidence, and retry atomically', async () => {
    configureSync();
    store.recordLearningAttempt(attempt({ id: 'before-sync' }));
    const remote = { data: clone(store.current), revision: 7, updated_at: new Date(START).toISOString() };
    store.recordLearningAttempt(attempt({ id: 'local-during-offline' }));
    store.saveLearningSession({ id: 'local-resume', entryId: 'v:andare', mode: 'lesson', objectiveIds: [objectiveId], activeObjectiveId: objectiveId, index: 2, createdAt: START, ui: { phase: 'question' } });
    let pulls = 0, pushes = 0, remoteEvent;
    globalThis.fetch = async (url, options = {}) => {
      assert.ok(String(url).startsWith('https://example.invalid/'));
      if (String(url).includes('/parola_profiles?')) { pulls++; return response([clone(remote)]); }
      assert.ok(String(url).endsWith('/rpc/parola_save_profile'));
      const body = JSON.parse(options.body); pushes++;
      assert.equal(body.p_data.learning.session, null);
      assert.deepEqual(body.p_data.learning.sessions, {});
      if (pushes === 1) {
        remoteEvent = addRemote(remote.data, { id: 'remote-concurrent', objectiveId: 'w:pane:recall', entryId: 'w:pane', kind: 'word', skill: 'recall', tense: null });
        remote.revision++; return response({ conflict: true });
      }
      assert.equal(body.p_expected_revision, remote.revision);
      assert.ok(body.p_data.learning.events['local-during-offline']);
      assert.ok(body.p_data.learning.events[remoteEvent.id]);
      remote.data = body.p_data; remote.revision++;
      return response({ conflict: false, revision: remote.revision, updated_at: new Date(START + pushes).toISOString() });
    };
    await sync.syncNow();
    assert.equal(pulls, 2); assert.equal(pushes, 2);
    assert.ok(store.learning.events['local-during-offline']); assert.ok(store.learning.events['remote-concurrent']);
    assert.equal(store.current.stats.xp, 6);
    assert.equal(store.current.stats.learningXP, 6);
    assert.equal(store.learning.sessions['v:andare|lesson'].id, 'local-resume');
    assert.equal(sync.getConfig().lastError, '');
  });

  await test('missing cloud schema fails closed while local progress remains available', async () => {
    const before = clone(store.learning), xp = store.current.stats.xp;
    let writes = 0;
    globalThis.fetch = async (url, options = {}) => {
      if (options.method === 'POST') writes++;
      return response({ message: 'column parola_profiles.revision does not exist' }, 400);
    };
    await assert.rejects(sync.syncNow(), /Update cloud sync using Show setup SQL/);
    assert.equal(writes, 0);
    assert.deepEqual(store.learning, before); assert.equal(store.current.stats.xp, xp);
    assert.match(sync.getConfig().lastError, /progress remains on this device/);
  });

  await test('switching profiles during a pull cannot import into the newly selected user', async () => {
    configureSync(profileA);
    const remote = clone(store.current); addRemote(remote, { id: 'must-not-leak' });
    let release, started;
    const requestStarted = new Promise(resolve => { started = resolve; });
    globalThis.fetch = async () => { started(); return new Promise(resolve => { release = () => resolve(response([{ data: remote, revision: 12 }])); }); };
    const pending = sync.syncNow();
    await requestStarted;
    await store.switchProfile(profileB);
    const otherBefore = clone(store.current);
    release();
    await assert.rejects(pending, /Profile changed/);
    assert.deepEqual(store.current, otherBefore);
    assert.equal(store.learning.events['must-not-leak'], undefined);
    assert.match(sync.getConfig(profileA).lastError, /Profile changed/);
    assert.equal(sync.getConfig(profileB).enabled, false);
    await store.switchProfile(profileA);
    assert.equal(store.learning.events['must-not-leak'], undefined);
  });

  await test('a delayed sign-in response cannot attach credentials to a different profile', async () => {
    configureSync(profileA);
    const otherConfig = clone(sync.getConfig(profileB));
    let release, started;
    const requestStarted = new Promise(resolve => { started = resolve; });
    globalThis.fetch = async (url) => {
      assert.ok(String(url).endsWith('/auth/v1/token?grant_type=password'));
      started();
      return new Promise(resolve => { release = () => resolve(response({ access_token: 'signed-in-access', refresh_token: 'signed-in-refresh', user: { id: 'signed-in-user', email: 'learner@example.invalid' } })); });
    };
    const pending = sync.signIn('learner@example.invalid', 'test-only-password');
    await requestStarted; await store.switchProfile(profileB); release(); await pending;
    assert.deepEqual(sync.getConfig(profileB), otherConfig);
    assert.equal(sync.getConfig(profileA).access, 'signed-in-access');
    assert.equal(sync.getConfig(profileA).userId, 'signed-in-user');
    await store.switchProfile(profileA);
  });

  await test('a delayed unconfirmed signup stores its email only on the initiating profile', async () => {
    configureSync(profileA);
    const otherConfig = clone(sync.getConfig(profileB));
    let release, started;
    const requestStarted = new Promise(resolve => { started = resolve; });
    globalThis.fetch = async (url) => {
      assert.ok(String(url).endsWith('/auth/v1/signup')); started();
      return new Promise(resolve => { release = () => resolve(response({ user: { id: 'pending-confirmation' } })); });
    };
    const pending = sync.signUp('pending@example.invalid', 'test-only-password');
    await requestStarted; await store.switchProfile(profileB); release();
    assert.deepEqual(await pending, { ok: true, confirmed: false });
    assert.deepEqual(sync.getConfig(profileB), otherConfig);
    assert.equal(sync.getConfig(profileA).email, 'pending@example.invalid');
    await store.switchProfile(profileA);
  });

  await test('concurrent sync callers share one in-flight request chain', async () => {
    configureSync();
    let pulls = 0, pushes = 0;
    globalThis.fetch = async (url) => {
      if (String(url).includes('/parola_profiles?')) { pulls++; return response([{ data: clone(store.current), revision: 15 }]); }
      pushes++; return response({ conflict: false, revision: 16, updated_at: new Date(START).toISOString() });
    };
    await Promise.all([sync.syncNow(), sync.syncNow(), sync.syncNow()]);
    assert.equal(pulls, 1); assert.equal(pushes, 1);
  });

  await test('repeated server conflicts are bounded and never discard local attempts', async () => {
    const beforeIds = Object.keys(store.learning.events).sort();
    let pushes = 0;
    globalThis.fetch = async (url) => {
      if (String(url).includes('/parola_profiles?')) return response([{ data: clone(store.current), revision: pushes }]);
      pushes++; return response({ conflict: true });
    };
    await assert.rejects(sync.syncNow(), /Another device is still syncing/);
    assert.equal(pushes, 5);
    assert.deepEqual(Object.keys(store.learning.events).sort(), beforeIds);
  });

  await test('SQL contract includes authentication, ownership and atomic revision checks', () => {
    const sql = sync.SETUP_SQL;
    assert.match(sql, /auth\.uid\(\) is null/);
    assert.match(sql, /using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\)/);
    assert.match(sql, /where user_id = auth\.uid\(\) and revision = p_expected_revision/);
    assert.match(sql, /new\.revision <> old\.revision \+ 1/);
    assert.match(sql, /before update on public\.parola_profiles/);
    assert.match(sql, /on conflict \(user_id\) do nothing/);
    assert.match(sql, /revoke all on function public\.parola_save_profile/);
    assert.match(sql, /grant execute on function public\.parola_save_profile\(bigint, jsonb\) to authenticated/);
  });

  console.log(`\n${count} store/sync integration checks passed (mock transport; SQL not executed in PostgreSQL).`);
} finally {
  clearTimeout(store._saveTimer);
  sync.signOut();
}
