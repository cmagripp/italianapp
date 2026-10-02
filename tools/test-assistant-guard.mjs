#!/usr/bin/env node
// The assistant's guards in Node: support detection, the crash-loop breaker (loading flag on reload, two trips, reset),
// enabling and disabling with a fake runtime, and that assistantPick never throws. WebGPU and the real model cannot run
// here; the runtime is a fake injected through enableAssistant's options.importRuntime.
import assert from 'node:assert/strict';

const MODEL = 'Qwen3-0.6B-q4f16_1-MLC', KEY = 'it.assistant';
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(String(key)) ?? null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
}
const storage = () => globalThis.localStorage;
const stored = () => { const raw = storage().getItem(KEY); return raw == null ? null : JSON.parse(raw); };
const setNavigator = value => Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value });
const adapter = (features = ['shader-f16']) => ({ features: new Set(features) });
const gpuWith = (result) => ({ requestAdapter: async () => (typeof result === 'function' ? result() : result) });
const goodGpu = () => gpuWith(() => adapter());
const tick = () => new Promise(resolve => setImmediate(resolve));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let serial = 0;
async function fresh(record) {
  globalThis.localStorage = new MemoryStorage();
  if (record !== undefined) storage().setItem(KEY, typeof record === 'string' ? record : JSON.stringify(record));
  return import(new URL(`../js/learning/assistant.js?guard=${++serial}`, import.meta.url));
}
// A fake WebLLM: CreateMLCEngine returns `engine`; every chat request is recorded.
function fakeRuntime({ answer = '{"choice": 1}', create, onCreate } = {}) {
  const runtime = { created: [], requests: [], interrupts: 0, unloads: 0, cacheDeletes: 0, active: 0, maxActive: 0 };
  runtime.engine = {
    chat: { completions: { create: async request => {
      runtime.requests.push(request); runtime.active++; runtime.maxActive = Math.max(runtime.maxActive, runtime.active);
      try { return create ? await create(request) : { choices: [{ message: { role: 'assistant', content: typeof answer === 'function' ? answer(request) : answer } }] }; }
      finally { runtime.active--; }
    } } },
    interruptGenerate() { runtime.interrupts++; },
    async unload() { runtime.unloads++; },
  };
  runtime.module = {
    CreateMLCEngine: async (model, config, chatOpts) => {
      runtime.created.push({ model, config, chatOpts });
      if (onCreate) await onCreate({ model, config, chatOpts });
      return runtime.engine;
    },
    deleteModelAllInfoInCache: async () => { runtime.cacheDeletes++; },
  };
  runtime.importRuntime = async () => runtime.module;
  return runtime;
}
const candidates = [{ id: 'react-a', text: 'Stanco? Hai lavorato molto?' }, { id: 'react-b', text: 'Allora  prendiamo\nun panino!' }, { id: 'react-c', text: 'Capisco. Andiamo?' }];
const ask = (api, extra = {}) => api.assistantPick({ question: 'The learner said "Bene grazie, ma ho fame." after being asked how they are.', candidates, ...extra });

let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`✓ ${name}`); } catch (error) { console.error(`✗ ${name}`); throw error; } }

await test('support detection: navigator, WebGPU, memory hint, remembered adapter result', async () => {
  setNavigator(undefined);
  let api = await fresh();
  assert.deepEqual(api.assistantSupport(), { supported: false, reason: 'no-navigator', device: { webgpu: false, memoryHint: null, adapter: null } });
  setNavigator({});
  assert.equal(api.assistantSupport().reason, 'no-webgpu');
  setNavigator({ gpu: {} });
  assert.equal(api.assistantSupport().reason, 'no-webgpu', 'a gpu object without requestAdapter is no WebGPU');
  setNavigator({ gpu: goodGpu(), deviceMemory: 2 });
  assert.deepEqual(api.assistantSupport(), { supported: false, reason: 'low-memory', device: { webgpu: true, memoryHint: 2, adapter: null } });
  setNavigator({ gpu: goodGpu(), deviceMemory: 8 });
  assert.deepEqual(api.assistantSupport(), { supported: true, device: { webgpu: true, memoryHint: 8, adapter: null } });
  setNavigator({ gpu: goodGpu() });
  assert.deepEqual(api.assistantSupport(), { supported: true, device: { webgpu: true, memoryHint: null, adapter: null } }, 'Safari reports no deviceMemory');
  assert.equal(api.assistantState().model, MODEL);
  // the async probe: no adapter, no 16-bit shaders, then a good adapter; the sync check reflects the last probe
  setNavigator({ gpu: gpuWith(null) });
  api = await fresh();
  assert.equal((await api.probeAssistantSupport()).reason, 'no-adapter');
  assert.deepEqual(api.assistantSupport().device, { webgpu: true, memoryHint: null, adapter: false });
  setNavigator({ gpu: gpuWith(() => adapter([])) });
  assert.equal((await api.probeAssistantSupport()).reason, 'no-f16');
  setNavigator({ gpu: gpuWith(() => { throw new Error('boom'); }) });
  assert.equal((await api.probeAssistantSupport()).reason, 'adapter-error');
  setNavigator({ gpu: goodGpu() });
  assert.deepEqual(await api.probeAssistantSupport(), { supported: true, device: { webgpu: true, memoryHint: null, adapter: true } });
  setNavigator({});
  assert.equal((await api.probeAssistantSupport()).reason, 'no-webgpu', 'a non-adapter failure is returned without probing');
});

await test('module load: a clean start, garbage in storage, and no write without a trip', async () => {
  setNavigator({ gpu: goodGpu() });
  for (const record of [undefined, 'not json', '42', '{"enabled":"yes","trips":"-3","loading":"true"}']) {
    const api = await fresh(record);
    assert.deepEqual(api.assistantState(), { enabled: false, loaded: false, loading: false, error: null, breaker: { trips: 0, tripped: false, lastTripAt: null, lastTrip: null }, model: MODEL });
  }
  const api = await fresh();
  assert.equal(stored(), null, 'nothing is written to storage at module load unless a trip is counted');
  assert.equal(api.ASSISTANT_MODEL, MODEL);
});

await test('breaker: a loading flag left from a killed page counts a trip on the next start', async () => {
  const before = Date.now();
  const api = await fresh({ enabled: true, trips: 0, loading: true, busy: false, lastTripAt: null, lastTrip: null });
  const state = api.assistantState();
  assert.deepEqual({ enabled: state.enabled, trips: state.breaker.trips, tripped: state.breaker.tripped, lastTrip: state.breaker.lastTrip }, { enabled: true, trips: 1, tripped: false, lastTrip: 'load' });
  assert.ok(state.breaker.lastTripAt >= before);
  const record = stored();
  assert.deepEqual({ ...record, lastTripAt: null }, { enabled: true, trips: 1, loading: false, busy: false, lastTripAt: null, lastTrip: 'load' }, 'the flag is cleared so a reload does not count again');
  assert.equal(record.lastTripAt, state.breaker.lastTripAt);
  const again = await fresh(stored());
  assert.equal(again.assistantState().breaker.trips, 1, 'a clean restart after the trip adds nothing');
});

await test('breaker: a busy flag counts too; two trips switch the assistant off; the third start adds nothing', async () => {
  const api = await fresh({ enabled: true, trips: 1, loading: false, busy: true });
  const state = api.assistantState();
  assert.deepEqual({ enabled: state.enabled, trips: state.breaker.trips, tripped: state.breaker.tripped, lastTrip: state.breaker.lastTrip }, { enabled: false, trips: 2, tripped: true, lastTrip: 'pick' });
  assert.deepEqual({ enabled: stored().enabled, trips: stored().trips, busy: stored().busy }, { enabled: false, trips: 2, busy: false });
  assert.equal((await fresh(stored())).assistantState().breaker.tripped, true);
  assert.equal((await fresh({ trips: 5 })).assistantState().breaker.tripped, true, 'any count of two or more is tripped');
});

await test('enableAssistant refuses when tripped or unsupported, without importing anything, and never throws', async () => {
  const runtime = fakeRuntime();
  let api = await fresh({ enabled: true, trips: 2 });
  let state = await api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime });
  assert.deepEqual({ enabled: state.enabled, loaded: state.loaded, error: state.error, tripped: state.breaker.tripped }, { enabled: false, loaded: false, error: 'tripped', tripped: true });
  setNavigator({});
  api = await fresh();
  state = await api.enableAssistant(undefined, { importRuntime: runtime.importRuntime });
  assert.deepEqual({ enabled: state.enabled, loaded: state.loaded, error: state.error }, { enabled: false, loaded: false, error: 'no-webgpu' });
  assert.equal(stored(), null, 'a refusal writes nothing');
  setNavigator({ gpu: gpuWith(null) });
  api = await fresh({ enabled: true });
  state = await api.enableAssistant(null, { importRuntime: runtime.importRuntime });
  assert.deepEqual({ enabled: state.enabled, error: state.error, support: api.assistantSupport().reason }, { enabled: false, error: 'no-adapter', support: 'no-adapter' });
  assert.deepEqual({ enabled: stored().enabled, loading: stored().loading }, { enabled: false, loading: false }, 'a device without an adapter withdraws the opt-in');
  setNavigator({ gpu: gpuWith(() => adapter([])) });
  api = await fresh();
  assert.equal((await api.enableAssistant()).error, 'no-f16');
  assert.equal(runtime.created.length, 0, 'the runtime was never imported or created');
  setNavigator({ gpu: goodGpu() });
  api = await fresh();
  state = await api.enableAssistant('not a function', { importRuntime: async () => { throw new Error('offline'); } });
  assert.deepEqual({ enabled: state.enabled, loaded: state.loaded, loading: state.loading, trips: state.breaker.trips }, { enabled: false, loaded: false, loading: false, trips: 0 });
  assert.match(state.error, /offline/);
  assert.deepEqual({ enabled: stored().enabled, loading: stored().loading, trips: stored().trips }, { enabled: false, loading: false, trips: 0 }, 'a thrown load error clears the flag and is not a trip');
  state = await api.enableAssistant(() => {}, { importRuntime: async () => ({ CreateMLCEngine: async () => { throw Object.assign(new Error('shader-f16 missing'), { name: 'ShaderF16SupportError' }); } }) });
  assert.equal(state.error, 'ShaderF16SupportError: shader-f16 missing');
});

await test('resetAssistantBreaker clears the trips and lets the learner opt in again', async () => {
  const api = await fresh({ enabled: false, trips: 2, lastTripAt: 123, lastTrip: 'timeout' });
  assert.equal(api.assistantState().breaker.tripped, true);
  const state = api.resetAssistantBreaker();
  assert.deepEqual({ enabled: state.enabled, breaker: state.breaker, error: state.error }, { enabled: false, breaker: { trips: 0, tripped: false, lastTripAt: null, lastTrip: null }, error: null });
  assert.deepEqual(stored(), { enabled: false, trips: 0, loading: false, busy: false, lastTripAt: null, lastTrip: null });
  const runtime = fakeRuntime();
  assert.equal((await api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime })).loaded, true);
});

await test('enableAssistant loads the model with the fixed id and a 1,024-token window, reports progress, records the loading flag', async () => {
  const progress = [];
  let midLoad;
  const runtime = fakeRuntime({ onCreate: ({ config }) => {
    midLoad = { stored: stored(), state: api.assistantState() };
    config.initProgressCallback({ text: 'Loading model from cache[12/40]', progress: 0.3, timeElapsed: 2 });
    config.initProgressCallback({ text: 'Finish loading on WebGPU', progress: 1, timeElapsed: 9 });
    config.initProgressCallback({ progress: 7 });
  } });
  const api = await fresh({ enabled: false, trips: 1, lastTripAt: 5, lastTrip: 'load' });
  let throwing = 0;
  const first = api.enableAssistant(report => { progress.push(report); if (progress.length === 1) { throwing++; throw new Error('a careless view'); } }, { importRuntime: runtime.importRuntime });
  const second = api.enableAssistant(() => progress.push('second caller'), { importRuntime: runtime.importRuntime });
  assert.equal(api.assistantState().loading, true);
  const [state, same] = await Promise.all([first, second]);
  assert.deepEqual(state, same);
  assert.deepEqual({ enabled: state.enabled, loaded: state.loaded, loading: state.loading, error: state.error, trips: state.breaker.trips }, { enabled: true, loaded: true, loading: false, error: null, trips: 1 });
  assert.equal(runtime.created.length, 1, 'concurrent callers share one load');
  assert.equal(runtime.created[0].model, MODEL);
  assert.deepEqual(runtime.created[0].chatOpts, { context_window_size: 1024 });
  assert.equal(typeof runtime.created[0].config.initProgressCallback, 'function');
  assert.deepEqual(progress, [{ text: 'Loading model from cache[12/40]', progress: 0.3 }, { text: 'Finish loading on WebGPU', progress: 1 }, { text: '', progress: 1 }]);
  assert.equal(throwing, 1, 'a throwing progress callback does not break the load');
  assert.deepEqual({ enabled: midLoad.stored.enabled, loading: midLoad.stored.loading, trips: midLoad.stored.trips }, { enabled: true, loading: true, trips: 1 }, 'the loading flag is in storage while the model loads');
  assert.deepEqual({ loading: midLoad.state.loading, loaded: midLoad.state.loaded }, { loading: true, loaded: false });
  assert.deepEqual({ enabled: stored().enabled, loading: stored().loading, trips: stored().trips, lastTrip: stored().lastTrip }, { enabled: true, loading: false, trips: 1, lastTrip: 'load' }, 'the flag is cleared after the load; an earlier trip stays until a good answer');
  await api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime });
  assert.equal(runtime.created.length, 1, 'enabling a loaded assistant creates nothing');
  globalThis.loadedApi = api; globalThis.loadedRuntime = runtime;
});

await test('assistantPick returns null without an engine and never throws, whatever it is given', async () => {
  const api = await fresh();
  assert.equal(await ask(api), null);
  for (const args of [undefined, null, {}, { question: 'x' }, { question: 'x', candidates: 'nope' }, { question: 'x', candidates: [] }, { question: 'x', candidates: [{ text: 'no id' }, { id: 'blank', text: '  ' }, null] }, { candidates }]) {
    assert.equal(await api.assistantPick(args), null);
  }
  const tripped = await fresh({ enabled: true, trips: 2 });
  assert.equal(await ask(tripped), null);
  assert.equal(await ask(globalThis.loadedApi, { question: '   ' }), null, 'a pick needs a situation');
  assert.equal(globalThis.loadedRuntime.requests.length, 0);
});

await test('assistantPick asks for a JSON choice at temperature 0 and maps the index back to the candidate id', async () => {
  const api = globalThis.loadedApi, runtime = globalThis.loadedRuntime;
  assert.deepEqual(await ask(api), { id: 'react-b' });
  assert.equal(runtime.requests.length, 1);
  const request = runtime.requests[0];
  assert.deepEqual({ temperature: request.temperature, stream: request.stream, type: request.response_format.type, thinking: request.extra_body.enable_thinking }, { temperature: 0, stream: false, type: 'json_object', thinking: false });
  assert.ok(Number.isInteger(request.max_tokens) && request.max_tokens > 0 && request.max_tokens <= 32);
  const schema = JSON.parse(request.response_format.schema);
  assert.deepEqual(schema, { type: 'object', properties: { choice: { type: 'integer', enum: [0, 1, 2] } }, required: ['choice'], additionalProperties: false });
  assert.deepEqual(request.messages.map(m => m.role), ['system', 'user']);
  const user = request.messages[1].content;
  assert.ok(user.includes('The learner said "Bene grazie, ma ho fame."'));
  assert.ok(user.includes('0: Stanco? Hai lavorato molto?') && user.includes('1: Allora prendiamo un panino!') && user.includes('2: Capisco. Andiamo?'), 'candidates are numbered and whitespace-normalised');
  assert.ok(!user.includes('react-'), 'candidate ids never reach the prompt');
  assert.deepEqual({ trips: api.assistantState().breaker.trips, lastTrip: api.assistantState().breaker.lastTrip, error: api.assistantState().error }, { trips: 0, lastTrip: null, error: null }, 'a good answer resets the trips');
  assert.deepEqual({ trips: stored().trips, busy: stored().busy }, { trips: 0, busy: false });
  assert.deepEqual(await api.assistantPick({ question: 'Only one way to react.', candidates: [candidates[2]] }), { id: 'react-c' });
  assert.equal(runtime.requests.length, 1, 'a single candidate is returned without asking the model');
  const many = Array.from({ length: 20 }, (_, i) => ({ id: i, text: `Candidate ${i}` }));
  runtime.engine.chat.completions.create = async request => { runtime.requests.push(request); return { choices: [{ message: { content: '{"choice": 11}' } }] }; };
  assert.deepEqual(await api.assistantPick({ question: 'Pick one.', candidates: many }), { id: 11 });
  assert.deepEqual(JSON.parse(runtime.requests.at(-1).response_format.schema).properties.choice.enum.length, 12, 'at most twelve candidates are offered');
});

await test('assistantPick tolerates bad answers and thrown errors (null, no trip) and keeps the engine', async () => {
  const api = globalThis.loadedApi, runtime = globalThis.loadedRuntime;
  const answers = ['nonsense', '{"choice": 7}', '{"choice": "1"}', '{"choice": -1}', '{"choice": 1.5}', '{"pick": 1}', '', null, '{"choice": 1', '[1]'];
  for (const content of answers) {
    runtime.engine.chat.completions.create = async () => ({ choices: [{ message: { content } }] });
    assert.equal(await ask(api), null, `answer ${JSON.stringify(content)}`);
  }
  runtime.engine.chat.completions.create = async () => ({ choices: [{ message: { content: '<think>\n\n</think>\n\n{"choice": 2}' } }] });
  assert.deepEqual(await ask(api), { id: 'react-c' }, 'an empty thinking block before the JSON is tolerated');
  runtime.engine.chat.completions.create = async () => ({ choices: [] });
  assert.equal(await ask(api), null);
  runtime.engine.chat.completions.create = async () => { throw Object.assign(new Error('Device lost'), { name: 'DeviceLostError' }); };
  assert.equal(await ask(api), null);
  const state = api.assistantState();
  assert.deepEqual({ loaded: state.loaded, trips: state.breaker.trips, error: state.error }, { loaded: true, trips: 0, error: 'DeviceLostError: Device lost' });
  assert.equal(stored().busy, false);
});

await test('assistantPick falls back to a plain-integer schema when the runtime rejects the enum schema', async () => {
  const api = globalThis.loadedApi, runtime = globalThis.loadedRuntime;
  const seen = [];
  runtime.engine.chat.completions.create = async request => {
    const schema = JSON.parse(request.response_format.schema); seen.push(schema.properties.choice);
    if (schema.properties.choice.enum) throw Object.assign(new Error('Failed to compile the JSON schema'), { name: 'GrammarMatcherInitError' });
    return { choices: [{ message: { content: '{"choice": 0}' } }] };
  };
  assert.deepEqual(await ask(api), { id: 'react-a' });
  assert.deepEqual(seen, [{ type: 'integer', enum: [0, 1, 2] }, { type: 'integer' }]);
  assert.deepEqual(await ask(api), { id: 'react-a' });
  assert.equal(seen.length, 3, 'from then on the plain schema is used directly');
  assert.deepEqual(seen[2], { type: 'integer' });
  runtime.engine.chat.completions.create = async request => { runtime.requests.push(request); return { choices: [{ message: { content: '{"choice": 1}' } }] }; };
});

await test('assistantPick runs one answer at a time', async () => {
  const api = globalThis.loadedApi, runtime = globalThis.loadedRuntime;
  runtime.maxActive = 0;
  runtime.engine.chat.completions.create = async () => { runtime.active++; runtime.maxActive = Math.max(runtime.maxActive, runtime.active); await sleep(5); runtime.active--; return { choices: [{ message: { content: '{"choice": 0}' } }] }; };
  const results = await Promise.all([ask(api), ask(api), ask(api)]);
  assert.deepEqual(results, [{ id: 'react-a' }, { id: 'react-a' }, { id: 'react-a' }]);
  assert.equal(runtime.maxActive, 1);
  assert.equal(stored().busy, false);
});

await test('a timed-out answer interrupts the model and counts a trip; the second trip switches the assistant off', async () => {
  const api = globalThis.loadedApi, runtime = globalThis.loadedRuntime;
  let busyDuring;
  runtime.engine.chat.completions.create = async () => { busyDuring = stored().busy; return new Promise(() => {}); };
  assert.equal(await ask(api, { maxMs: 20 }), null);
  assert.equal(busyDuring, true, 'the busy flag is in storage while the model answers');
  let state = api.assistantState();
  assert.deepEqual({ loaded: state.loaded, enabled: state.enabled, trips: state.breaker.trips, tripped: state.breaker.tripped, lastTrip: state.breaker.lastTrip, error: state.error, interrupts: runtime.interrupts }, { loaded: true, enabled: true, trips: 1, tripped: false, lastTrip: 'timeout', error: 'timeout', interrupts: 1 });
  assert.deepEqual({ trips: stored().trips, busy: stored().busy, enabled: stored().enabled }, { trips: 1, busy: false, enabled: true });
  assert.equal(await ask(api, { maxMs: 20 }), null);
  await tick();
  state = api.assistantState();
  assert.deepEqual({ loaded: state.loaded, enabled: state.enabled, trips: state.breaker.trips, tripped: state.breaker.tripped, interrupts: runtime.interrupts, unloads: runtime.unloads }, { loaded: false, enabled: false, trips: 2, tripped: true, interrupts: 3, unloads: 1 });
  assert.deepEqual({ trips: stored().trips, enabled: stored().enabled, busy: stored().busy, loading: stored().loading }, { trips: 2, enabled: false, busy: false, loading: false });
  const requests = runtime.requests.length;
  assert.equal(await ask(api), null);
  assert.equal(runtime.requests.length, requests, 'a tripped assistant is not consulted');
  assert.equal((await api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime })).error, 'tripped');
  assert.equal(runtime.created.length, 1);
  api.resetAssistantBreaker();
  runtime.engine.chat.completions.create = async () => ({ choices: [{ message: { content: '{"choice": 2}' } }] });
  assert.equal((await api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime })).loaded, true);
  assert.equal(runtime.created.length, 2, 'after a reset the model is loaded again');
  assert.deepEqual(await ask(api), { id: 'react-c' });
  assert.equal(api.assistantState().breaker.trips, 0);
});

await test('a late answer after a timeout is discarded and the next pick proceeds', async () => {
  const api = globalThis.loadedApi, runtime = globalThis.loadedRuntime;
  let release;
  runtime.engine.chat.completions.create = async () => new Promise(resolve => { release = () => resolve({ choices: [{ message: { content: '{"choice": 0}' } }] }); });
  assert.equal(await ask(api, { maxMs: 15 }), null);
  release();
  await tick();
  runtime.engine.chat.completions.create = async () => ({ choices: [{ message: { content: '{"choice": 1}' } }] });
  assert.deepEqual(await ask(api), { id: 'react-b' });
  assert.equal(api.assistantState().breaker.trips, 0);
});

await test('disableAssistant unloads the engine, clears the opt-in, keeps the trips and never touches the weight cache', async () => {
  const api = globalThis.loadedApi, runtime = globalThis.loadedRuntime;
  runtime.engine.chat.completions.create = async () => { await sleep(30); return { choices: [{ message: { content: '{"choice": 0}' } }] }; };
  const pending = ask(api);
  const unloads = runtime.unloads;
  const state = await api.disableAssistant();
  assert.deepEqual({ enabled: state.enabled, loaded: state.loaded, loading: state.loading, unloads: runtime.unloads - unloads }, { enabled: false, loaded: false, loading: false, unloads: 1 });
  assert.equal(await pending, null, 'an answer in flight when the assistant is switched off is dropped');
  assert.deepEqual({ enabled: stored().enabled, trips: stored().trips, busy: stored().busy }, { enabled: false, trips: 0, busy: false });
  assert.equal(runtime.cacheDeletes, 0);
  assert.equal(await ask(api), null);
  assert.deepEqual(await api.disableAssistant(), state, 'disabling twice is harmless');
  assert.equal((await api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime })).loaded, true);
  assert.equal(runtime.created.length, 3);
  await api.disableAssistant();
});

await test('disableAssistant during a load abandons it: the engine is unloaded as soon as it arrives', async () => {
  let release;
  const runtime = fakeRuntime({ onCreate: () => new Promise(resolve => { release = resolve; }) });
  const api = await fresh();
  const loading = api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime });
  await tick();
  assert.deepEqual({ enabled: stored().enabled, loading: stored().loading }, { enabled: true, loading: true });
  const state = await api.disableAssistant();
  assert.deepEqual({ enabled: state.enabled, loaded: state.loaded, loading: state.loading }, { enabled: false, loaded: false, loading: true });
  assert.equal(stored().loading, true, 'the download is still running, so a death still counts');
  release();
  const done = await loading;
  assert.deepEqual({ enabled: done.enabled, loaded: done.loaded, loading: done.loading, unloads: runtime.unloads }, { enabled: false, loaded: false, loading: false, unloads: 1 });
  assert.deepEqual({ enabled: stored().enabled, loading: stored().loading }, { enabled: false, loading: false });
});

await test('a graceful pagehide clears the loading flag, a back-forward restore re-arms it, so a reload is not a crash', async () => {
  const target = new EventTarget();
  globalThis.addEventListener = target.addEventListener.bind(target);
  try {
    let release;
    const runtime = fakeRuntime({ onCreate: () => new Promise(resolve => { release = resolve; }) });
    const api = await fresh();
    const loading = api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime });
    await tick();
    assert.equal(stored().loading, true);
    target.dispatchEvent(new Event('pagehide'));
    assert.equal(stored().loading, false);
    assert.equal(api.assistantState().loading, true, 'the page itself still knows the load is running');
    target.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    assert.equal(stored().loading, true);
    target.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    assert.equal(stored().loading, true, 'a fresh pageshow changes nothing');
    release();
    assert.equal((await loading).loaded, true);
    assert.equal(stored().loading, false);
    target.dispatchEvent(new Event('pagehide'));
    assert.equal(stored().loading, false);
    assert.equal((await fresh(stored())).assistantState().breaker.trips, 0);
  } finally { delete globalThis.addEventListener; }
});

await test('blocked storage: the module still works in memory and nothing throws', async () => {
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('SecurityError'); } };
  globalThis.localStorage = blocked;
  const api = await import(new URL(`../js/learning/assistant.js?guard=blocked-${++serial}`, import.meta.url));
  assert.equal(api.assistantState().breaker.trips, 0);
  const runtime = fakeRuntime();
  assert.equal((await api.enableAssistant(() => {}, { importRuntime: runtime.importRuntime })).loaded, true);
  assert.deepEqual(await ask(api), { id: 'react-b' });
  runtime.engine.chat.completions.create = () => new Promise(() => {});
  assert.equal(await ask(api, { maxMs: 10 }), null);
  assert.equal(api.assistantState().breaker.trips, 1);
  assert.equal(api.resetAssistantBreaker().breaker.trips, 0);
  assert.equal((await api.disableAssistant()).loaded, false);
  delete globalThis.localStorage;
  const bare = await import(new URL(`../js/learning/assistant.js?guard=bare-${++serial}`, import.meta.url));
  assert.equal(bare.assistantState().enabled, false);
  assert.equal(await ask(bare), null);
});

console.log(`\n${passed} assistant guard checks passed (WebGPU and the real model are not exercised here).`);
