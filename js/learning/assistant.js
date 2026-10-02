// Layer 3 of the sentence workshop: an experimental, opt-in assistant that runs a small language model on the device
// (WebLLM, Qwen3 0.6B at 4-bit, WebGPU). See docs/PLAN-SENTENCE-WORKSHOP-2026-10-02.md §8 and docs/ASSISTANT-EXPERIMENT.md.
//
// Rules this module keeps, so that the workshop behaves identically with the assistant absent, disabled or crashed:
//   - nothing is imported from the network until the learner opts in (enableAssistant); importing this module costs nothing;
//   - every export returns a plain value or null and never throws; the caller always has a deterministic fallback;
//   - the model never writes anything the learner reads: it only picks an index among candidates the caller supplies;
//   - a crash-loop breaker: a page that dies while the assistant is loading or answering counts a trip on the next start,
//     a timed-out answer counts a trip, and after two trips the assistant stays off until resetAssistantBreaker();
//   - no learner text leaves the device; the only network traffic is the one-time download of the runtime and the weights.
export const ASSISTANT_MODEL = 'Qwen3-0.6B-q4f16_1-MLC';
const RUNTIME_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.85';
const STORAGE_KEY = 'it.assistant';
const CONTEXT_WINDOW = 1024;      // tokens; the prebuilt config says 4096, which costs KV-cache memory the phone does not have
const MAX_TRIPS = 2;
const MIN_MEMORY_GB = 4;          // navigator.deviceMemory (Chromium only, rounded down to a power of two): 2 GB-class devices are refused
const MAX_CANDIDATES = 12, MAX_QUESTION_CHARS = 600, MAX_CANDIDATE_CHARS = 160, MAX_ANSWER_TOKENS = 16;

// ---- the localStorage record: { enabled, trips, loading, busy, lastTripAt, lastTrip }
// `loading` is true while the runtime and weights load, `busy` while an answer is being generated. Either flag found set at
// module load means the previous page died with the assistant working (iOS kills a page without running any script).
const emptyRecord = () => ({ enabled: false, trips: 0, loading: false, busy: false, lastTripAt: null, lastTrip: null });
function readRecord() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return emptyRecord();
    const trips = Math.max(0, Math.floor(Number(parsed.trips) || 0));
    return {
      enabled: parsed.enabled === true && trips < MAX_TRIPS,   // a tripped breaker always reads as off
      trips,
      loading: parsed.loading === true,
      busy: parsed.busy === true,
      lastTripAt: Number.isFinite(parsed.lastTripAt) ? Number(parsed.lastTripAt) : null,
      lastTrip: ['load', 'pick', 'timeout'].includes(parsed.lastTrip) ? parsed.lastTrip : null,
    };
  } catch { return emptyRecord(); }
}
function save(value = record) { try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* storage blocked: the in-memory record still rules this page */ } }

const record = readRecord();
let engine = null;          // the WebLLM engine while loaded
let loadPromise = null;     // the in-flight enableAssistant, shared by concurrent callers
let abandonLoad = null;     // 'disable' or 'release': disableAssistant or releaseAssistant was called while loading, so the engine is unloaded as soon as the load settles
let picking = 0;            // answers in flight (at most one runs; others wait in `queue`)
let queue = Promise.resolve();
let lastError = null;       // why the last enableAssistant or assistantPick gave up, for the view
let adapterProbe = null;    // { ok, reason? } from the last navigator.gpu.requestAdapter()
let plainSchema = false;    // set when the runtime rejects the enum schema; the plain-integer schema is used from then on
let listening = false;

const tripped = () => record.trips >= MAX_TRIPS;
const describe = error => String(error?.name && error?.message ? `${error.name}: ${error.message}` : error?.message || error || 'unknown error').slice(0, 240);
async function unloadQuietly(gone) {
  if (!gone) return;
  try { gone.interruptGenerate?.(); } catch { /* nothing running */ }
  try { await gone.unload(); } catch { /* the device may already be gone */ }
}
// A trip: the page died under the assistant, or an answer timed out. Two trips switch it off until the breaker is reset.
function trip(reason) {
  record.trips += 1; record.lastTripAt = Date.now(); record.lastTrip = reason; record.loading = false; record.busy = false;
  if (tripped()) { record.enabled = false; const gone = engine; engine = null; unloadQuietly(gone); }
  save();
}
if (record.loading || record.busy) trip(record.loading ? 'load' : 'pick');

// A graceful unload (navigation, reload, tab closed) runs pagehide, a memory kill does not: clearing the flags here keeps
// an impatient reload during the download from counting as a crash. A page restored from the back-forward cache
// (pageshow with persisted) re-arms them if the work is still in flight. The same for visibility: a page iOS freezes
// and later evicts while the app is in the background never crashed in front of the learner, so the flags are cleared
// while hidden and re-armed when the page is visible again. The in-memory record keeps the true flags throughout.
function listen() {
  if (listening || typeof globalThis.addEventListener !== 'function') return;
  listening = true;
  const working = () => record.loading || record.busy;
  const disarm = () => { if (working()) save({ ...record, loading: false, busy: false }); };
  const rearm = () => { if (working()) save(); };
  globalThis.addEventListener('pagehide', disarm);
  globalThis.addEventListener('pageshow', event => { if (event?.persisted) rearm(); });
  globalThis.document?.addEventListener?.('visibilitychange', () => (globalThis.document.visibilityState === 'hidden' ? disarm : rearm)());
}

// WebGPU presence and a memory hint, synchronously and without touching the network. The adapter itself is requested
// by enableAssistant (and probeAssistantSupport); its result is remembered and reflected here afterwards.
export function assistantSupport() {
  const nav = globalThis.navigator;
  const webgpu = !!nav?.gpu && typeof nav.gpu.requestAdapter === 'function';
  const memoryHint = Number.isFinite(nav?.deviceMemory) ? Number(nav.deviceMemory) : null;
  const device = { webgpu, memoryHint, adapter: adapterProbe ? adapterProbe.ok : null };
  if (!nav) return { supported: false, reason: 'no-navigator', device };
  if (!webgpu) return { supported: false, reason: 'no-webgpu', device };
  if (memoryHint !== null && memoryHint < MIN_MEMORY_GB) return { supported: false, reason: 'low-memory', device };
  if (adapterProbe && !adapterProbe.ok) return { supported: false, reason: adapterProbe.reason, device };
  return { supported: true, device };
}
async function probeAdapter() {
  try {
    const adapter = await globalThis.navigator.gpu.requestAdapter();
    if (!adapter) adapterProbe = { ok: false, reason: 'no-adapter' };
    else if (typeof adapter.features?.has === 'function' && !adapter.features.has('shader-f16')) adapterProbe = { ok: false, reason: 'no-f16' }; // the q4f16 weights need 16-bit shaders
    else adapterProbe = { ok: true };
  } catch { adapterProbe = { ok: false, reason: 'adapter-error' }; }
  return adapterProbe;
}
// Optional: the real adapter check, for a view that wants to know before offering the download. Never throws.
export async function probeAssistantSupport() {
  const sync = assistantSupport();
  if (!sync.supported && sync.reason !== adapterProbe?.reason) return sync;   // only an earlier adapter failure is worth re-probing
  await probeAdapter();
  return assistantSupport();
}

export function assistantState() {
  return {
    enabled: record.enabled, loaded: !!engine, loading: !!loadPromise, error: lastError,
    breaker: { trips: record.trips, tripped: tripped(), lastTripAt: record.lastTripAt, lastTrip: record.lastTrip },
    model: ASSISTANT_MODEL,
  };
}

const importRuntime = () => import(RUNTIME_URL);
// The learner's opt-in. onProgress({ text, progress }) follows the download and compilation; the returned state says
// whether the engine is loaded, and `error` why not. `options.importRuntime` exists for the Node checks only.
export async function enableAssistant(onProgress, options = {}) {
  try {
    if (engine) { if (!record.enabled) { record.enabled = true; save(); } return assistantState(); }
    if (!loadPromise) {
      lastError = null;
      if (tripped()) { lastError = 'tripped'; return assistantState(); }
      const support = assistantSupport();
      if (!support.supported) { lastError = support.reason; return assistantState(); }
      loadPromise = load(onProgress, options).finally(() => { loadPromise = null; });
    }
    await loadPromise;
  } catch (error) { lastError = describe(error); }
  return assistantState();   // read after the load settled, so `loading` is false here
}
async function load(onProgress, options) {
  const probe = await probeAdapter();
  if (!probe.ok) { lastError = probe.reason; record.enabled = false; save(); return assistantState(); }
  abandonLoad = null;
  record.enabled = true; record.loading = true; save();
  listen();
  const report = r => { try { onProgress?.({ text: String(r?.text ?? ''), progress: Math.min(1, Math.max(0, Number(r?.progress) || 0)) }); } catch { /* a view's callback cannot break the load */ } };
  let created;
  try {
    const runtime = await (options?.importRuntime || importRuntime)();
    created = await runtime.CreateMLCEngine(ASSISTANT_MODEL, { initProgressCallback: report, logLevel: 'ERROR' }, { context_window_size: CONTEXT_WINDOW });
  } catch (error) {
    // A thrown load error (offline, unsupported shaders, a device lost that the runtime caught) is a failure, not a crash:
    // the opt-in is withdrawn so nothing retries the 340 MB download on its own, and no trip is counted.
    lastError = describe(error); record.enabled = false; record.loading = false; save();
    return assistantState();
  }
  record.loading = false;
  if (abandonLoad || tripped()) {
    if (abandonLoad !== 'release' || tripped()) record.enabled = false;   // a release keeps the opt-in, a disable or a trip withdraws it
    save(); unloadQuietly(created); return assistantState();
  }
  engine = created; save();
  return assistantState();
}

// Switches the assistant off and frees the GPU memory. The downloaded weights stay in the browser's storage (WebLLM's
// own caches), so enabling again later does not download them again.
export async function disableAssistant() {
  try {
    record.enabled = false;
    if (loadPromise) { abandonLoad = 'disable'; save(); return assistantState(); }
    const gone = engine; engine = null; save();
    await unloadQuietly(gone);
  } catch { /* never throws */ }
  return assistantState();
}

// Frees the GPU memory without withdrawing the opt-in: for leaving a workshop lesson, since a loaded engine holds about a
// gigabyte and memory is what kills web pages on phones. The next enableAssistant loads the weights again from the
// browser's cache. During a load the engine is unloaded as soon as it arrives; an answer in flight is dropped (null).
export async function releaseAssistant() {
  try {
    if (loadPromise) { abandonLoad = abandonLoad || 'release'; return assistantState(); }   // an earlier disable still wins
    const gone = engine; engine = null;
    await unloadQuietly(gone);
  } catch { /* never throws */ }
  return assistantState();
}

export function resetAssistantBreaker() {
  record.trips = 0; record.lastTripAt = null; record.lastTrip = null; record.loading = !!loadPromise; record.busy = picking > 0;
  save(); lastError = null;
  return assistantState();
}

// ---- the one thing the model does: pick the candidate that best fits the situation.
function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) return null;
  const list = [];
  for (const candidate of candidates) {
    if (!candidate || candidate.id === undefined || candidate.id === null) continue;
    const text = String(candidate.text ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    list.push({ id: candidate.id, text: text.slice(0, MAX_CANDIDATE_CHARS) });
    if (list.length === MAX_CANDIDATES) break;
  }
  return list.length ? list : null;
}
function buildRequest(question, list, plain) {
  const choice = plain ? { type: 'integer' } : { type: 'integer', enum: list.map((_, i) => i) };
  const schema = { type: 'object', properties: { choice }, required: ['choice'], additionalProperties: false };
  const lines = list.map((candidate, i) => `${i}: ${candidate.text}`).join('\n');
  return {
    messages: [
      { role: 'system', content: 'You help an Italian learning app. Given a situation and a numbered list of candidates (replies in a short Italian conversation, words for a blank in a sentence, or explanations of a mistake), you pick the one candidate that fits the situation best. Answer only with JSON of the form {"choice": N}, where N is the number of the best candidate.' },
      { role: 'user', content: `Situation:\n${question}\n\nCandidates:\n${lines}\n\nWhich candidate number fits the situation best? Answer with {"choice": N}.` },
    ],
    temperature: 0, max_tokens: MAX_ANSWER_TOKENS, stream: false,
    response_format: { type: 'json_object', schema: JSON.stringify(schema) },  // WebLLM's JSON-schema mode (constrained decoding)
    extra_body: { enable_thinking: false },                                     // Qwen3: no <think> block
  };
}
async function complete(current, question, list) {
  try { return await current.chat.completions.create(buildRequest(question, list, plainSchema)); }
  catch (error) {
    // A runtime that cannot compile the enum schema falls back to a plain integer, which every converter accepts.
    if (plainSchema || !/schema|grammar/i.test(describe(error))) throw error;
    plainSchema = true;
    return current.chat.completions.create(buildRequest(question, list, true));
  }
}
function parseChoice(completion, count) {
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return -1;
  const start = content.indexOf('{'), end = content.lastIndexOf('}');
  if (start < 0 || end <= start) return -1;
  let parsed;
  try { parsed = JSON.parse(content.slice(start, end + 1)); } catch { return -1; }
  const choice = parsed?.choice;
  return Number.isInteger(choice) && choice >= 0 && choice < count ? choice : -1;
}
async function pick(question, list, maxMs) {
  const current = engine;
  if (!current) return null;
  picking += 1; record.busy = true; save();
  let timer = null, timedOut = false;
  const deadline = new Promise(resolve => { timer = setTimeout(() => { timedOut = true; resolve(null); }, maxMs); });
  try {
    const work = complete(current, question, list);
    work.catch(() => {});                                   // a late rejection after a timeout must not go unhandled
    const completion = await Promise.race([work, deadline]);
    if (timedOut) {
      try { current.interruptGenerate(); } catch { /* nothing to stop */ }
      lastError = 'timeout'; trip('timeout');
      return null;
    }
    if (engine !== current) return null;                    // released or switched off while the model was answering: the answer is dropped
    const choice = parseChoice(completion, list.length);
    if (choice < 0) { lastError = 'unparseable answer'; return null; }
    if (record.trips) { record.trips = 0; record.lastTripAt = null; record.lastTrip = null; } // a good answer clears earlier trips
    lastError = null;
    return { id: list[choice].id };
  } catch (error) {
    lastError = describe(error);                            // a thrown generation error is a failure, not a crash: no trip
    return null;
  } finally {
    clearTimeout(timer);
    picking -= 1; record.busy = picking > 0; save();
  }
}
// candidates: [{ id, text }]. Resolves { id } or null (no engine, breaker tripped, bad input, failure or timeout); never throws.
// A single candidate is returned without consulting the model. Answers run one at a time.
export async function assistantPick(args) {
  try {
    const { question, candidates, maxMs = 6000 } = args || {};   // inside the guard: a null argument must not reject
    const list = normalizeCandidates(candidates);
    const situation = String(question ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION_CHARS);
    if (!list || !situation || !engine || tripped()) return null;
    if (list.length === 1) return { id: list[0].id };
    const ms = Number(maxMs) > 0 ? Number(maxMs) : 6000;
    const run = queue.then(() => pick(situation, list, ms));
    queue = run.catch(() => {});
    return (await run) ?? null;
  } catch (error) { lastError = describe(error); return null; }
}
