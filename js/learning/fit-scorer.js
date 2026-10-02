// Fit scorer (sentence workshop layer 2, docs/PLAN-SENTENCE-WORKSHOP-2026-10-02.md §8): an optional download that scores
// the learner's free-entry word in a blank against the blank's authored options with an Italian masked-language model,
// so the workshop can say "unusual here" about a word that is grammatical but odd. It only advises: per
// docs/SENTENCE-LAB-CONTRACT.md §4 the scorer adds { fit, note } to a resolved free entry and never changes its status.
//
// Main-thread API. The model (int8 BERTino, 68.7 MB), its vocabulary and the ONNX Runtime Web files (14.3 MB) are
// published with the site like the audio packs (models/fit-scorer/, vendor/ort/; models/fit-scorer/README.md) and
// downloaded on demand into their own cache, FIT_CACHE, which sw.js keeps across updates and serves those files from.
// Nothing is precached. The scoring runs in js/workers/fit-scorer.worker.js (a module worker, one WASM thread), which is
// started on the first request, kept for the lesson and released after IDLE_MS without a request (the loaded model
// holds about 150 MB, and memory is what kills web pages on phones).
//
// Pure helpers (fitScores, fitNote) and the constants are importable in Node (tools/test-fit-scorer.mjs, build-site).

// Must equal FIT_CACHE in sw.js and js/workers/fit-scorer.worker.js (tools/check-shell.mjs checks).
export const FIT_CACHE = 'parola-fit-scorer-v1';
export const FIT_SCORER_VERSION = 'bertino-int8-1';
// What an install downloads, with the byte sizes documented in models/fit-scorer/README.md: progress totals and the
// installed check come from them (a cached file of another size counts as not installed), tools/build-site.mjs checks
// the published files against them. The worker script is cached too but is not part of the size (sw.js refreshes it).
export const FIT_FILES = [
  { path: 'models/fit-scorer/model.onnx', bytes: 68696037, type: 'application/octet-stream' },
  { path: 'models/fit-scorer/vocab.txt', bytes: 242585, type: 'text/plain' },
  { path: 'vendor/ort/ort.wasm.bundle.min.mjs', bytes: 73054, type: 'text/javascript' },
  { path: 'vendor/ort/ort-wasm-simd-threaded.wasm', bytes: 14239897, type: 'application/wasm' },
];
export const FIT_BYTES = FIT_FILES.reduce((sum, f) => sum + f.bytes, 0);
// A fit is 0..1 on the scale of the blank's authored options: the best authored option is 1, the worst 0 (fitScores).
// Notes: 'natural' from FIT_NATURAL, 'unusual here' from FIT_UNUSUAL, 'odd here' below. To be tuned from the locally
// logged verdicts (README); not set in stone here.
export const FIT_NATURAL = 0.6, FIT_UNUSUAL = 0.2;
// The scale is never narrower than this many nats below the best authored option, so two authored options that score
// alike (or a single one) do not turn a word a fraction of a nat below them into "odd here".
export const MIN_SPAN = 2;
const IDLE_MS = 5 * 60 * 1000;
const BLANK = '____';
const ROOT = new URL('../../', import.meta.url);
const WORKER_URL = new URL('../workers/fit-scorer.worker.js', import.meta.url);
const fileURL = (f) => new URL(f.path, ROOT).href;

// ---------- pure ----------
export function fitNote(fit) { return fit >= FIT_NATURAL ? 'natural' : fit >= FIT_UNUSUAL ? 'unusual here' : 'odd here'; }

// Adds { fit, note } to the worker's rows ([{ candidate, pll, ... }] in the order they were asked) and sorts them by pll,
// best first. The first `authored` rows are the blank's authored options, the reference: with top = best authored pll and
// floor = min(worst authored pll, top - MIN_SPAN), fit = clamp((pll - floor) / (top - floor), 0, 1). The learner's word is
// the last row, so by construction the best authored option scores 1 and, unless MIN_SPAN applies, the worst scores 0.
export function fitScores(rows, authored = rows.length - 1) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const n = Math.min(Math.max(1, Math.floor(authored) || 1), rows.length);
  const ref = rows.slice(0, n).map((r) => Number(r.pll)).filter(Number.isFinite);
  const top = ref.length ? Math.max(...ref) : 0;
  const floor = Math.min(ref.length ? Math.min(...ref) : top, top - MIN_SPAN);
  return rows.map((r) => {
    const raw = (Number(r.pll) - floor) / (top - floor);
    const fit = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
    return { ...r, fit, note: fitNote(fit) };
  }).sort((a, b) => b.pll - a.pll);
}

// ---------- support and installation ----------
// WebAssembly SIMD probe (the runtime is the SIMD build): a module with one function returning a v128.
const SIMD_PROBE = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11];
export function fitScorerSupport() {
  const g = globalThis;
  if (typeof g.WebAssembly !== 'object' || typeof g.WebAssembly.validate !== 'function') return { supported: false, reason: 'WebAssembly is not available in this browser' };
  let simd = false;
  try { simd = g.WebAssembly.validate(new Uint8Array(SIMD_PROBE)); } catch { simd = false; }
  if (!simd) return { supported: false, reason: 'this browser has no WebAssembly SIMD (Safari 16.4 or Chrome 91 and later have it)' };
  if (typeof g.Worker !== 'function') return { supported: false, reason: 'Web Workers are not available in this browser' };
  if (typeof g.BigInt64Array !== 'function') return { supported: false, reason: 'this browser has no BigInt64Array' };
  if (!g.caches || typeof g.caches.open !== 'function') return { supported: false, reason: g.isSecureContext === false ? 'the download needs a secure (https) page' : 'the Cache API is not available (private browsing?)' };
  return { supported: true };
}

async function cachedBytes(cache, url) {
  const hit = await cache.match(url);
  if (!hit) return 0;
  const length = Number(hit.headers.get('content-length'));
  if (Number.isFinite(length) && length > 0) return length;
  try { return (await hit.blob()).size; } catch { return 0; }
}

let installed = null;   // null: not checked yet in this page
export async function fitScorerStatus() {
  const status = { installed: false, bytes: 0, version: FIT_SCORER_VERSION };
  try {
    if (!globalThis.caches || !(await caches.has(FIT_CACHE))) { installed = false; return status; }
    const cache = await caches.open(FIT_CACHE);
    let complete = true;
    for (const f of FIT_FILES) if ((await cachedBytes(cache, fileURL(f))) !== f.bytes) complete = false;
    for (const req of await cache.keys()) status.bytes += await cachedBytes(cache, req.url);
    status.installed = complete;
  } catch { status.installed = false; }
  installed = status.installed;
  return status;
}
async function ensureInstalled() { return installed ?? (await fitScorerStatus()).installed; }

let installing = null;
// Downloads the model and the runtime into FIT_CACHE, reporting { loaded, total } bytes, and resolves to the status.
// Resumable: files already cached with the right size are kept; a failed or aborted (options.signal) download leaves
// nothing partial behind. Only one install runs at a time; a second call joins it.
export function installFitScorer(onProgress, options = {}) {
  return installing ||= install(onProgress, options).finally(() => { installing = null; });
}
async function install(onProgress, { signal } = {}) {
  const support = fitScorerSupport();
  if (!support.supported) throw new Error(`The fit scorer cannot run here: ${support.reason}.`);
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  const cache = await caches.open(FIT_CACHE);
  const total = FIT_BYTES;
  let loaded = 0, reported = -1;
  const report = (force) => { if (force || loaded - reported >= 262144) { reported = loaded; progress({ loaded: Math.min(loaded, total), total }); } };
  report(true);
  for (const f of FIT_FILES) {
    const url = fileURL(f);
    if ((await cachedBytes(cache, url)) === f.bytes) { loaded += f.bytes; report(true); continue; }
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`The download failed (${f.path}: HTTP ${response.status}). Files already saved are kept.`);
    const chunks = [];
    let size = 0;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); size += value.byteLength; loaded += value.byteLength; report(false);
      }
    } else {
      const bytes = new Uint8Array(await response.arrayBuffer());
      chunks.push(bytes); size += bytes.byteLength; loaded += bytes.byteLength;
    }
    if (size !== f.bytes) throw new Error(`The download of ${f.path} came back with ${size} bytes instead of ${f.bytes}; please try again.`);
    await cache.put(url, new Response(new Blob(chunks, { type: f.type }), { status: 200, headers: { 'Content-Type': f.type, 'Content-Length': String(size) } }));
    report(true);
  }
  // The worker script too, so a learner who installs online and first scores offline has it. sw.js serves it from
  // this cache only when the network is down and refreshes the copy whenever the network answers.
  try {
    const response = await fetch(WORKER_URL, { cache: 'no-cache', signal });
    if (response.ok) await cache.put(WORKER_URL.href, response);
  } catch (e) { if (e && e.name === 'AbortError') throw e; }
  installed = null;
  return fitScorerStatus();
}

export async function removeFitScorer() {
  releaseFitScorer();
  installed = false;
  if (globalThis.caches) await caches.delete(FIT_CACHE);
}

// ---------- scoring ----------
let worker = null, nextId = 1, idleTimer = null;
const pending = new Map();
function failAll(error) { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); }
function touchIdle() { clearTimeout(idleTimer); if (!pending.size) idleTimer = setTimeout(releaseFitScorer, IDLE_MS); }
function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(WORKER_URL, { type: 'module', name: 'fit-scorer' });
  worker.onmessage = (event) => {
    const msg = event.data;
    if (!msg || msg.type === 'ready') return;
    const p = pending.get(msg.id);
    if (!p) return;                       // answered after its timeout: dropped
    pending.delete(msg.id); clearTimeout(p.timer);
    if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg);
    touchIdle();
  };
  worker.onerror = (event) => { const error = new Error(event && event.message ? event.message : 'The fit scorer stopped working.'); failAll(error); releaseFitScorer(); };
  worker.onmessageerror = () => { failAll(new Error('The fit scorer sent an unreadable reply.')); };
  return worker;
}
function request(msg, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); touchIdle(); reject(new Error(`The fit scorer did not answer within ${timeoutMs} ms.`)); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    clearTimeout(idleTimer);
    ensureWorker().postMessage({ id, ...msg });
  });
}

// Stops the worker and frees the model's memory; the next scoreFit starts it again (a few seconds on a phone).
export function releaseFitScorer() {
  clearTimeout(idleTimer); idleTimer = null;
  if (worker) { worker.terminate(); worker = null; }
  failAll(new Error('The fit scorer was released.'));
}

// Loads the model ahead of the first scoreFit (resolves to { ready, loadMs }), so a lesson can warm it while the
// learner reads. Rejects when the scorer is not installed.
export async function warmFitScorer({ timeoutMs = 60000 } = {}) {
  if (!(await ensureInstalled())) throw new Error('The fit scorer is not installed.');
  const reply = await request({ warm: true }, timeoutMs);
  touchIdle();
  return { ready: true, loadMs: reply.loadMs };
}

// Scores every candidate in the blank ("____") of `template`: the blank's authored options first, the learner's word last
// (`options.authored` overrides how many leading candidates are the reference). Resolves to
// [{ candidate, pll, pieces, perPiece, unknown, fit, note }] sorted by pll, best first (fitScores). The first call after
// a release also loads the model, which can take longer than timeoutMs on a slow phone: a timed-out call rejects but the
// worker keeps loading, so the next call succeeds; use warmFitScorer to load ahead.
export async function scoreFit(template, candidates, { timeoutMs = 4000, authored } = {}) {
  if (typeof template !== 'string' || template.split(BLANK).length !== 2) throw new TypeError(`scoreFit: the template must be a string with exactly one ${BLANK}`);
  if (!Array.isArray(candidates) || !candidates.length || candidates.some((c) => typeof c !== 'string' || !c.trim())) throw new TypeError('scoreFit: candidates must be a non-empty array of non-empty strings');
  if (!(await ensureInstalled())) throw new Error('The fit scorer is not installed.');
  const reply = await request({ template, candidates }, timeoutMs);
  return fitScores(reply.scores, authored ?? Math.max(1, candidates.length - 1));
}
