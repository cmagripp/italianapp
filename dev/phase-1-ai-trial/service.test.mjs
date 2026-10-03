import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { RequestQueue, createAIService, createGrounding, prepareTask, validateResponse } from '../../js/ai/index.js';
import { createPackManager, validatePackManifest } from '../../js/ai/packs.js';
const delay = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const request = { task: 'conversation', text: 'Ieri ho andato al mercato, ma non ho comprato 2 mele.', level: 'A2', sourceRevision: 4 };
const rule = { id: 'andare', verified: true, level: 'A2', source: 'reviewed-rule-revision-1', explanation: 'Andare usa essere.', keywords: ['andato'], confirmCorrection: c => c.original === 'ho andato' && c.replacement === 'sono andato' };
const grounding = createGrounding({ rules: [rule], version: 'test-reviewed' });
const reply = () => ({ participantId: 'partner', text: 'Sei andato al mercato. Che cosa hai visto?', corrections: [{ original: 'ho andato', replacement: 'sono andato', ruleId: 'andare', reason: 'Andare usa essere.' }], vocabulary: [] });
const validation = input => validateResponse(input, { request, grounding: grounding.retrieve(request), participants: [{ id: 'partner', name: 'Giulia' }] });

test('one generator runs at a time; queued priority is stable', async () => {
  const queue = new RequestQueue(), first = deferred(), order = [];
  const a = queue.enqueue(async () => { order.push('a'); await first.promise; });
  const b = queue.enqueue(async () => order.push('b'), { priority: 0 });
  const c = queue.enqueue(async () => order.push('c'), { priority: 10 });
  const d = queue.enqueue(async () => order.push('d'), { priority: 10 });
  assert.deepEqual(order, ['a']); first.resolve(); await Promise.all([a, b, c, d]); assert.deepEqual(order, ['a', 'c', 'd', 'b']);
});
test('active cancellation rejects now and excludes late output before next generation', async () => {
  const finish = deferred(), controller = new AbortController(); let cancelled = 0, nextStarted = false;
  const queue = new RequestQueue({ onCancel() { cancelled++; } });
  const a = queue.enqueue(() => finish.promise, { signal: controller.signal });
  const rejection = assert.rejects(a, { name: 'AbortError' }); controller.abort(); await rejection;
  const b = queue.enqueue(() => { nextStarted = true; return 'next'; }); await delay();
  assert.equal(nextStarted, false); assert.equal(cancelled, 1); finish.resolve('stale'); assert.equal(await b, 'next');
});
test('scope cancellation leaves unrelated tasks intact', async () => {
  const first = deferred(), queue = new RequestQueue(); const a = queue.enqueue(() => first.promise, { scope: 'thread-a' });
  const b = queue.enqueue(() => 'b', { scope: 'thread-b' }); const rejected = assert.rejects(a, { name: 'AbortError' });
  queue.cancelScope('thread-a'); await rejected; first.resolve(); assert.equal(await b, 'b');
});
test('queued cancellation never invokes the model', async () => {
  const first = deferred(), queue = new RequestQueue(), controller = new AbortController(); let ran = false;
  const a = queue.enqueue(() => first.promise); const b = queue.enqueue(() => { ran = true; }, { signal: controller.signal });
  const rejected = assert.rejects(b, { name: 'AbortError' }); controller.abort(); await rejected; first.resolve(); await a; assert.equal(ran, false);
});
test('service snapshots input and rejects an edited source revision', async () => {
  const generated = deferred(); let currentRevision = 4, captured;
  const service = createAIService({ grounding, requireLanguageValidation: false, isCurrent: r => r.sourceRevision === currentRevision, runtime: { generate(task) { captured = task; return generated.promise; } } });
  const input = { ...request }; const pending = service.request(input); input.text = 'changed'; await delay();
  assert.match(captured.messages.at(-1).content, /ho andato/); currentRevision = 5; generated.resolve(JSON.stringify(reply()));
  await assert.rejects(pending, { name: 'AbortError' });
});
test('supported response retains source provenance and never awards mastery', () => {
  const result = validation(reply()); assert.equal(result.provenance.sourceRevision, 4); assert.equal(result.provenance.masteryAwarded, false);
});
test('metadata validators reject fabricated corrections, vocabulary and participants', () => {
  const falseCorrection = reply(); falseCorrection.corrections[0].replacement = 'ho stato'; assert.throws(() => validation(falseCorrection), /unsupported correction/);
  const participant = reply(); participant.participantId = 'invented'; assert.throws(() => validation(participant), /unknown participant/);
  const vocab = reply(); vocab.vocabulary = [{ senseId: 'invented', sourceText: 'mercato' }]; assert.throws(() => validation(vocab), /unverified vocabulary/);
});
test('correction quote must exist and uncertain recognition cannot become a penalty', () => {
  const quote = reply(); quote.corrections[0].original = 'unseen'; assert.throws(() => validation(quote), /source/);
  assert.throws(() => validateResponse(reply(), { request: { ...request, recognitionUncertain: true }, grounding: grounding.retrieve(request), participants: [{ id: 'partner' }] }), /uncertain recognition/);
});
test('protected negation and quantities survive even a permissive verifier', () => {
  const permissive = { version: 'test', senses: [], rules: [{ id: 'unsafe', confirmCorrection: () => true }] };
  const raw = reply(); raw.corrections = [{ original: 'non ho comprato 2 mele', replacement: 'ho comprato 3 mele', ruleId: 'unsafe', reason: 'Unsupported meaning change.' }];
  assert.throws(() => validateResponse(raw, { request, grounding: permissive, participants: [{ id: 'partner' }] }), /protected meaning/);
  for (const [original, replacement] of [['ho comprato mele', 'non ho comprato mele'], ['ho comprato due mele', 'ho comprato due mele e tre pere']]) {
    const input = { ...request, text: original }; raw.corrections[0] = { original, replacement, ruleId: 'unsafe', reason: 'Unsafe.' };
    assert.throws(() => validateResponse(raw, { request: input, grounding: permissive, participants: [{ id: 'partner' }] }), /protected meaning/);
  }
});
test('internal reasoning, unexpected fields and repeated output fail', () => {
  const raw = reply(); raw.text = '<think>analysis</think>Va bene.'; assert.throws(() => validation(raw), /internal/);
  assert.throws(() => validation({ ...reply(), mastery: true }), /unexpected/);
  const repeated = reply(); repeated.text = 'Va bene. Va bene. Va bene.'; assert.throws(() => validation(repeated), /repeated/);
});
test('grounding respects cumulative level and explicit scoped word exception', () => {
  const facts = createGrounding({ senses: [{ id: 'a1', verified: true, level: 'A1', keywords: ['mercato'] }, { id: 'b2', verified: true, level: 'B2', keywords: ['mercato'] }] });
  assert.deepEqual(facts.retrieve(request).senses.map(s => s.id), ['a1']);
  assert.deepEqual(facts.retrieve({ ...request, allowedSenseIds: ['b2'] }).senses.map(s => s.id), ['a1']);
  assert.deepEqual(facts.retrieve({ ...request,scope:'thread:one',sourceRevision:1,wordExceptions:[{senseId:'b2',forms:['mercato'],selectedBy:'learner',scope:'thread:one',sourceRevision:1}] }).senses.map(s => s.id), ['a1', 'b2']);
});
test('context omits drafts and oversized old messages without dropping latest input', () => {
  const task = prepareTask({ ...request, history: [{ role: 'user', status: 'committed', content: 'x'.repeat(20000) }, { role: 'user', status: 'draft', content: 'draft-secret' }, { role: 'assistant', status: 'committed', content: 'Recent turn.' }] }, grounding.retrieve(request), { maxContextChars: 4000 });
  assert.equal(task.historyTurns, 1); assert.equal(task.messages[1].content, 'Recent turn.'); assert.match(task.messages.at(-1).content, /ho andato/);
});
test('opening is setup data with no invented learner turn or prior history', () => {
  const input = { ...request, opening: true, text: '', learnerName: 'Marta', topic: 'a walk', register: 'Lei', addresseeId: 'marco', participants: [{ id: 'giulia', name: 'Giulia', active: false }, { id: 'marco', name: 'Marco', active: true }], history: [{ role: 'user', status: 'committed', content: 'old-conversation-secret' }] };
  const task = prepareTask(input, grounding.retrieve(input));
  assert.equal(task.historyTurns, 0); assert.equal(task.messages.length, 2); assert(!task.messages.some(m => m.content.includes('old-conversation-secret')));
  assert.deepEqual(JSON.parse(task.messages.at(-1).content).setup, { learnerName: 'Marta', topic: 'a walk', register: 'Lei', addresseeId: 'marco' });
  assert.equal(JSON.parse(task.messages.at(-1).content).learnerMessage, null);
  assert.deepEqual(task.participants.map(p => p.id), ['marco']);
  const schema = JSON.parse(task.responseFormat.schema); assert.deepEqual(schema.properties.participantId.enum, ['marco']); assert.equal(schema.properties.corrections.maxItems, 0);
  assert.throws(() => prepareTask({ ...input, opening: false }, grounding.retrieve(input)), /learner text/);
  assert.throws(() => prepareTask({ ...input, text: 'fictitious learner words' }, grounding.retrieve(input)), /learner text/);
  assert.throws(() => prepareTask({ ...input, addresseeId: 'giulia' }, grounding.retrieve(input)), /active addressee/);
});
test('targeted ordinary group turns retain active setup and reject another speaker', () => {
  const input = { ...request, learnerName: 'Marta', topic: 'the station', register: 'tu', addresseeId: 'marco', participants: [{ id: 'giulia', name: 'Giulia', active: true }, { id: 'marco', name: 'Marco', active: true }] };
  const task = prepareTask(input, grounding.retrieve(input));
  const content = JSON.parse(task.messages.at(-1).content); assert.equal(content.text, input.text); assert.equal(content.setup.register, 'tu');
  assert.match(task.messages[0].content, /"active":true/);
  assert.throws(() => validateResponse({ ...reply(), participantId: 'giulia' }, { request: input, grounding: grounding.retrieve(input), participants: task.participants }), /unknown participant/);
});

class MemoryCache {
  records = new Map();
  async match(url) { return this.records.get(String(url))?.clone(); }
  async put(url, response) { const bytes = await response.arrayBuffer(); this.records.set(String(url), new Response(bytes, { headers: response.headers })); }
  async delete(url) { return this.records.delete(String(url)); }
}
class MemoryCaches {
  records = new Map();
  async open(name) { if (!this.records.has(name)) this.records.set(name, new MemoryCache()); return this.records.get(name); }
  async keys() { return [...this.records.keys()]; }
  async delete(name) { return this.records.delete(name); }
}
const origin = 'https://parola.test', sha = async data => Buffer.from(await webcrypto.subtle.digest('SHA-256', data)).toString('hex');
async function fixture(revision = 'a'.repeat(40)) {
  const bodies = [new TextEncoder().encode('first verified shard'), new TextEncoder().encode('second verified shard')];
  return { bodies, pack: { schema: 1, id: 'italian-test', revision, runtime: { name: 'test-local', version: '1.0.0' }, notices: ['Apache-2.0; source attribution'],
    assets: await Promise.all(bodies.map(async (body, i) => ({ url: `${origin}/packs/${revision}/${i}.bin`, bytes: body.byteLength, sha256: await sha(body), kind: 'weights' }))) } };
}
function manager(cacheStorage, fetchImpl, extra = {}) { return createPackManager({ cacheStorage, fetchImpl, subtle: webcrypto.subtle, origin, storageEstimate: async () => ({ usage: 0, quota: 1e9 }), ...extra }); }
test('verified install resumes after interruption and activates only when complete', async () => {
  const { pack, bodies } = await fixture(), caches = new MemoryCaches(), seen = [], controller = new AbortController();
  const packs = manager(caches, async url => { seen.push(url); return new Response(bodies[pack.assets.findIndex(a => a.url === url)]); });
  await assert.rejects(packs.install(pack, { signal: controller.signal, onProgress(p) { if (p.phase === 'verified') controller.abort(); } }), { name: 'AbortError' });
  assert.equal(await packs.active(pack.id), null); assert.equal(seen.length, 1);
  await packs.install(pack); assert.equal(seen.length, 2); assert.equal((await packs.active(pack.id, { verify: true })).revision, pack.revision);
});
test('corrupt replacement and low storage preserve the earlier active revision', async () => {
  const old = await fixture(), replacement = await fixture('b'.repeat(40)), caches = new MemoryCaches();
  const packs = manager(caches, async url => new Response(old.bodies[old.pack.assets.findIndex(a => a.url === url)])); await packs.install(old.pack);
  const broken = manager(caches, async () => new Response('wrong'));
  await assert.rejects(broken.install(replacement.pack), /integrity|size/); assert.equal((await broken.active(old.pack.id)).revision, old.pack.revision);
  const low = manager(caches, async () => { throw Error('must not download'); }, { storageEstimate: async () => ({ quota: 5, usage: 4 }) });
  await assert.rejects(low.install(replacement.pack), /Insufficient/); assert.equal((await low.active(old.pack.id)).revision, old.pack.revision);
});
test('offline reads detect corruption and removal touches only owned pack caches', async () => {
  const { pack, bodies } = await fixture(), caches = new MemoryCaches(); await caches.open('learner-records');
  const packs = manager(caches, async url => new Response(bodies[pack.assets.findIndex(a => a.url === url)])); await packs.install(pack);
  assert.equal(await (await packs.response(pack.id, pack.assets[0].url)).text(), 'first verified shard');
  await (await caches.open(`parola-ai-pack-v1:${pack.id}:${pack.revision}`)).put(pack.assets[0].url, new Response('bad'));
  await assert.rejects(packs.active(pack.id, { verify: true }), /damaged/); await packs.remove(pack.id); assert.equal(await packs.active(pack.id), null); assert.ok((await caches.keys()).includes('learner-records'));
});
test('manifest permits pinned allowlisted model host weights and keeps runtime code local', async () => {
  const { pack } = await fixture(); pack.assets[0].url = pack.assets[0].url.replace(origin, 'https://huggingface.co');
  assert.throws(() => validatePackManifest(pack, origin), /asset/);
  assert.equal(validatePackManifest(pack, origin, [origin, 'https://huggingface.co']).assets.length, 2);
  pack.assets[0].kind = 'runtime'; assert.throws(() => validatePackManifest(pack, origin, [origin, 'https://huggingface.co']), /asset/);
});

const { createAudioController } = await import('../../js/ai/audio-controller.js');
function audioFixture(overrides = {}) {
  const events = [], raw = new Float32Array([.1, .2]); let callbacks;
  const capture = { async start(options) { callbacks = options; events.push('capture-start'); }, async finish() { return raw; }, async stop() { events.push('capture-stop'); } };
  const recognizer = { async transcribe() { events.push('recognize'); return { recognizedText: 'Ieri io andare al mercato.' }; } };
  const player = { async speak(text) { events.push(`play:${text}`); }, async stop() { events.push('play-stop'); } };
  const controller = createAudioController({ capture, recognizer, player, onDraft(draft) { events.push(draft ? `draft:${draft.text}` : 'draft-cleared'); }, async onSend(draft) { events.push(`send:${draft.text}`); return { message: { text: 'Che cosa hai comprato?' } }; }, ...overrides });
  return { controller, events, raw, endpoint(audio = raw) { callbacks.onUtterance(audio); } };
}
test('manual Stop creates an unsent editable transcript, preserving original recognition', async () => {
  let sent; const fixture = audioFixture({ async onSend(draft) { sent = draft; return { message: { text: 'Va bene.' } }; } });
  await fixture.controller.start('manual'); const draft = await fixture.controller.stopRecording(); assert.equal(draft.recognizedText, 'Ieri io andare al mercato.');
  assert.equal(sent, undefined); assert.equal(fixture.controller.retainedAudio(), fixture.raw);
  await fixture.controller.edit('Ieri sono andato al mercato.'); await fixture.controller.sendDraft();
  assert.equal(sent.recognizedText, 'Ieri io andare al mercato.'); assert.equal(sent.edited, true); assert.equal(fixture.controller.retainedAudio(), null);
});
test('handsfree capture stops before recognition/playback and resumes only after completion', async () => {
  const fixture = audioFixture(); await fixture.controller.start('handsfree'); fixture.endpoint(); await delay(); await delay();
  const lastStart = fixture.events.lastIndexOf('capture-start'), play = fixture.events.findIndex(e => e.startsWith('play:'));
  assert.ok(fixture.events.indexOf('capture-stop', 2) < fixture.events.indexOf('recognize')); assert.ok(play < lastStart); assert.equal(fixture.controller.snapshot.state, 'listening'); await fixture.controller.pause();
});
test('uncertain handsfree recognition pauses for editable review without a grammar send', async () => {
  const fixture = audioFixture({ recognizer: { async transcribe() { return { recognizedText: 'e a riondare', uncertain: true }; } } });
  await fixture.controller.start('handsfree'); fixture.endpoint(); await delay();
  assert.equal(fixture.controller.snapshot.state, 'review'); assert.ok(!fixture.events.some(e => e.startsWith('send:'))); await fixture.controller.pause();
});
test('pause rejects late recognition and returning foreground never restarts microphone', async () => {
  const recognition = deferred(); const fixture = audioFixture({ recognizer: { transcribe() { return recognition.promise; } } });
  await fixture.controller.start('manual'); const stopped = fixture.controller.stopRecording(); await delay(); const rejected = assert.rejects(stopped, { name: 'AbortError' });
  await fixture.controller.lifecycle(); const starts = fixture.events.filter(e => e === 'capture-start').length; recognition.resolve({ recognizedText: 'Late words' }); await rejected; await delay();
  assert.equal(fixture.controller.snapshot.state, 'paused'); assert.equal(fixture.controller.snapshot.draft, null); assert.equal(fixture.events.filter(e => e === 'capture-start').length, starts);
});

test('streaming SHA-256 matches WebCrypto across irregular chunk boundaries', async () => {
  const { createSHA256 } = await import('../../js/ai/sha256.js');
  for (const size of [0, 1, 55, 56, 63, 64, 65, 4097, 1048576]) {
    const bytes = new Uint8Array(size); for (let i = 0; i < size; i++) bytes[i] = (i * 19 + 7) % 256;
    const hash = createSHA256(); for (let i = 0; i < size; i += 37) hash.update(bytes.subarray(i, i + 37)); assert.equal(hash.hex(), await sha(bytes));
  }
});
test('minimal generated metadata is expanded with verified deterministic source links', async () => {
  const facts = createGrounding({ senses: [{ id: 'housemate', lemma: 'coinquilino', forms: ['la coinquilina'], verified: true, level: 'A2', keywords: ['casa'] }], version: 'verified' });
  const service = createAIService({ grounding: facts, requireLanguageValidation: false, runtime: { async generate() { return JSON.stringify({ participantId: 'partner', text: 'Si chiama coinquilina. Vive con te.', corrections: [] }); } } });
  const response = await service.request({ task: 'coach', text: 'Vive con me in casa.', level: 'A2' });
  assert.deepEqual(response.vocabulary, [{ senseId: 'housemate', sourceText: 'coinquilina' }]); assert.equal(response.provenance.masteryAwarded, false);
});

test('teaching cards and correction explanations copy references, never generated claims', async () => {
  const facts = createGrounding({ version: 'reviewed', senses: [{ id: 'housemate', verified: true, level: 'A2', lemma: 'coinquilino', definition: 'Reviewed definition.', forms: ['la coinquilina'], examples: ['Reviewed example.'], source: 'reference-rev-1', keywords: ['appartamento'] }], rules: [rule] });
  const coach = createAIService({ grounding: facts, requireLanguageValidation: false, runtime: { async generate() { return JSON.stringify({ participantId: 'partner', text: 'Come si chiama il tuo coinquilino?', corrections: [] }); } } });
  const result = await coach.request({ ...request, task: 'coach', text: 'Vive con me in un appartamento.' });
  assert.equal(result.teaching[0].definition, 'Reviewed definition.'); assert.equal(result.teaching[0].source, 'reference-rev-1'); assert.deepEqual(result.teaching[0].examples, ['Reviewed example.']);
  const proposed = { participantId: 'partner', text: 'Che cosa hai visto?', corrections: [{ original: 'ho andato', replacement: 'sono andato', ruleId: 'andare' }] };
  const accepted = validation(proposed); assert.equal(accepted.corrections[0].reason, rule.explanation);
  assert.equal(accepted.corrections[0].source, rule.source);
  assert.throws(() => validateResponse(proposed, { request, grounding: { ...grounding.retrieve(request), rules: [{ ...rule, source: null }] }, participants: [{ id: 'partner' }] }), /source unavailable/);
});
test('microphone permission failure releases capture and exposes an error state', async () => {
  let stopped = false; const fixture = audioFixture({ capture: { async start() { throw Error('Permission denied'); }, async stop() { stopped = true; } } });
  await assert.rejects(fixture.controller.start('manual'), /Permission denied/); assert.equal(fixture.controller.snapshot.state, 'error'); assert.equal(stopped, true);
});

test('runtime probe failure preserves old pack and verified assets alone do not claim readiness', async () => {
  const old = await fixture(), next = await fixture('c'.repeat(40)), caches = new MemoryCaches();
  const bodies = new Map([...old.pack.assets.map((a, i) => [a.url, old.bodies[i]]), ...next.pack.assets.map((a, i) => [a.url, next.bodies[i]])]);
  const packs = manager(caches, async url => new Response(bodies.get(url)));
  const installed = await packs.install(old.pack); assert.equal(installed.readiness.writtenGeneration, false); assert.equal(installed.readiness.italianTeachingQuality, false);
  await assert.rejects(packs.install(next.pack, { async probe() { return { written: true, modelRevision: 'wrong', runtimeVersion: next.pack.runtime.version }; } }), /compatibility probe/);
  assert.equal((await packs.active(old.pack.id)).revision, old.pack.revision);
  const ready = await packs.install(next.pack, { async probe({ response }) { assert.ok(await response(next.pack.assets[0].url)); return { written: true, speech: false, modelRevision: next.pack.revision, runtimeVersion: next.pack.runtime.version }; } });
  assert.equal(ready.readiness.writtenGeneration, true); assert.equal(ready.readiness.speechPipeline, false); assert.equal(ready.readiness.physicalPhone, false);
});

test('a manifest cannot overwrite an active revision with changed asset hashes', async () => {
  const { pack, bodies } = await fixture(), caches = new MemoryCaches(); const packs = manager(caches, async url => new Response(bodies[pack.assets.findIndex(a => a.url === url)]));
  await packs.install(pack); const changed = structuredClone(pack); changed.assets[0].sha256 = 'f'.repeat(64);
  await assert.rejects(packs.install(changed), /immutable revision/); assert.equal(await (await packs.response(pack.id, pack.assets[0].url)).text(), 'first verified shard');
});

test('recognition and generation failures remain recoverable and never start playback', async () => {
  const recognition = audioFixture({ recognizer: { async transcribe() { throw Error('Recognizer failed'); } } }); await recognition.controller.start('manual'); await assert.rejects(recognition.controller.stopRecording(), /Recognizer/); assert.equal(recognition.controller.snapshot.state, 'error'); assert.equal(recognition.controller.retainedAudio(), null);
  const generation = audioFixture({ async onSend() { throw Error('Model unavailable'); } }); await generation.controller.start('manual'); await generation.controller.stopRecording(); await assert.rejects(generation.controller.sendDraft(), /Model unavailable/); assert.equal(generation.controller.snapshot.state, 'error'); assert.ok(!generation.events.some(e => e.startsWith('play:'))); assert.equal(generation.controller.snapshot.draft.recognizedText, 'Ieri io andare al mercato.');
});

test('production requires a language validator; at most one rejected proposal is repaired and audited', async () => {
  let calls = 0; const runtime = { async generate() { calls++; return JSON.stringify(reply()); } };
  const blocked = createAIService({ runtime, grounding }); await assert.rejects(blocked.request(request), /language policy unavailable/); assert.equal(calls, 0);
  const languagePolicy = { version: 'reviewed-level-profile', validate() { return calls === 1 ? { ok: false, reasons: ['unknown construction'] } : { ok: true }; } };
  const repaired = createAIService({ runtime, grounding, languagePolicy, requireLanguageValidation: true, repairAttempts: 1 }); const response = await repaired.request(request);
  assert.equal(calls, 2); assert.equal(response.provenance.rejectedAttempts.length, 1); assert.equal(response.provenance.languageRangeVerified, true);
  const persistent = createAIService({ runtime, grounding, languagePolicy: { validate() { return { ok: false, reasons: ['unknown construction'] }; } }, repairAttempts: 1 });
  await assert.rejects(persistent.request(request), error => error.attempts.length === 2); assert.equal(calls, 4);
});
