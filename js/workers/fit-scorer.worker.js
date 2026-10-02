// Fit scorer worker (sentence workshop layer 2, docs/PLAN-SENTENCE-WORKSHOP-2026-10-02.md §8): scores a word in a blank
// by pseudo-log-likelihood (PLL) with the int8 BERTino masked-language model in models/fit-scorer/ (its README documents
// the model, the tokenizer rule and the recipe) through ONNX Runtime Web on WebAssembly, one thread, inside this
// dedicated worker so a 100 to 300 ms forward pass never blocks the page. js/learning/fit-scorer.js starts it as a
// module worker (new Worker(url, { type: 'module' })) and is its only client.
//
// Protocol: in { id, template, candidates } (or { id, warm: true } to load the model without scoring); out
// { id, scores: [{ candidate, pll, pieces, perPiece, unknown }], ms } in the candidates' order, or { id, error }, plus one
// { type: 'ready', loadMs } the first time the model has been loaded. Requests are answered one at a time, in order;
// { cancel: id } drops a request that has not started yet (the page gave up on it), which then gets no reply.
//
// The model, the vocabulary and the runtime's .wasm are read from the FIT_CACHE cache, where js/learning/fit-scorer.js
// put them, and fetched from the site only when they are not there; the runtime's module is imported by URL, which a page
// the service worker controls also gets from that cache (sw.js). So the scorer works offline once installed, and online
// before the service worker has claimed the page.
//
// Everything before the message loop is pure and is imported in Node by tools/test-fit-scorer.mjs: the WordPiece
// tokenizer (lower-cased, ACCENTS STRIPPED even though vocab.txt has accented rows, which are untrained: README), the masked
// batch for a candidate and the log-softmax arithmetic that reads the PLL off the 32,102-column logits. The tokenizer and
// logSoftmaxAt are copied verbatim from models/fit-scorer/score.mjs, the Node proof of the recipe; the check compares them.

// Must equal FIT_CACHE in sw.js and js/learning/fit-scorer.js (tools/check-shell.mjs checks).
export const FIT_CACHE = 'parola-fit-scorer-v1';
export const BLANK = '____';
const MAX_LEN = 512;                                                   // model_max_length (tokenizer_config.json)
const VENDOR = new URL('../../vendor/ort/', import.meta.url).href;    // the worker lives in js/workers/, two levels down
const MODEL_DIR = new URL('../../models/fit-scorer/', import.meta.url).href;
const ORT_MODULE = VENDOR + 'ort.wasm.bundle.min.mjs', ORT_WASM = VENDOR + 'ort-wasm-simd-threaded.wasm';
const MODEL_FILE = MODEL_DIR + 'model.onnx', VOCAB_FILE = MODEL_DIR + 'vocab.txt';
const now = () => (globalThis.performance && typeof performance.now === 'function' ? performance.now() : Date.now());

// ---------- WordPiece tokenizer (BERT, uncased) ----------
// Mirrors transformers' BasicTokenizer + WordpieceTokenizer for Latin-script text.
// Not implemented: CJK character splitting (irrelevant for Italian).
function isPunct(ch) {
  const cp = ch.codePointAt(0);
  if ((cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) || (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126)) return true;
  return /\p{P}/u.test(ch);
}
export function makeTokenizer(vocabText, { lowercase = true, stripAccents = true } = {}) {
  const vocab = new Map();
  vocabText.split('\n').forEach((t, i) => { t = t.replace(/\r$/, ''); if (t.length) vocab.set(t, i); });
  const id = (t) => vocab.get(t);
  const UNK = id('[UNK]'), CLS = id('[CLS]'), SEP = id('[SEP]'), MASK = id('[MASK]'), PAD = id('[PAD]');

  function basic(text) {
    // clean: drop control chars, normalise whitespace
    text = text.replace(/[\u0000�]|[\p{Cc}\p{Cf}]/gu, (c) => (/\s/.test(c) ? ' ' : '')).replace(/\s+/g, ' ');
    if (lowercase) text = text.toLowerCase();
    if (stripAccents) text = text.normalize('NFD').replace(/\p{Mn}/gu, '');
    const out = [];
    for (const word of text.trim().split(' ')) {
      let cur = '';
      for (const ch of word) {
        if (isPunct(ch)) { if (cur) out.push(cur); out.push(ch); cur = ''; } else cur += ch;
      }
      if (cur) out.push(cur);
    }
    return out;
  }
  function wordpiece(token) {
    if ([...token].length > 100) return [UNK];
    const pieces = [];
    let start = 0;
    while (start < token.length) {
      let end = token.length, found;
      while (start < end) {
        const sub = (start > 0 ? '##' : '') + token.slice(start, end);
        if (vocab.has(sub)) { found = vocab.get(sub); break; }
        end--;
      }
      if (found === undefined) return [UNK];
      pieces.push(found);
      start = end;
    }
    return pieces;
  }
  const encode = (text) => basic(text).flatMap(wordpiece);          // ids, no specials
  const ids2tokens = new Array(vocab.size); for (const [t, i] of vocab) ids2tokens[i] = t;
  return { vocab, encode, decode: (ids) => ids.map((i) => ids2tokens[i]), UNK, CLS, SEP, MASK, PAD };
}

// ---------- scoring ----------
function logSoftmaxAt(logits, offset, vocabSize, target) {
  let max = -Infinity;
  for (let i = 0; i < vocabSize; i++) if (logits[offset + i] > max) max = logits[offset + i];
  let sum = 0;
  for (let i = 0; i < vocabSize; i++) sum += Math.exp(logits[offset + i] - max);
  return logits[offset + target] - max - Math.log(sum);
}
export { logSoftmaxAt };

// The text before and after the one blank of a template.
export function splitTemplate(template) {
  const parts = String(template ?? '').split(BLANK);
  if (parts.length !== 2) throw new Error(`the template must contain exactly one ${BLANK}`);
  return parts;
}

// One batched run per candidate: row i is [CLS] prefix candidate suffix [SEP] with candidate piece i replaced by [MASK]
// and the other pieces visible (standard PLL, Salazar et al. 2020). int64 tensors as BigInt64Array, the layout ORT wants.
export function maskedBatch(tok, template, candidate) {
  const [pre, post] = splitTemplate(template);
  const idsPre = tok.encode(pre), idsC = tok.encode(String(candidate ?? '')), idsPost = tok.encode(post);
  if (!idsC.length) throw new Error('the candidate is empty');
  const base = [tok.CLS, ...idsPre, ...idsC, ...idsPost, tok.SEP];
  const L = base.length, n = idsC.length, offset = 1 + idsPre.length;
  if (L > MAX_LEN) throw new Error(`the sentence has ${L} pieces, more than the model's ${MAX_LEN}`);
  const input = new BigInt64Array(n * L), mask = new BigInt64Array(n * L).fill(1n);
  for (let i = 0; i < n; i++) for (let p = 0; p < L; p++) input[i * L + p] = BigInt(p === offset + i ? tok.MASK : base[p]);
  return { input, mask, dims: [n, L], offset, pieceIds: idsC };
}

// PLL of the batch's candidate from the logits of its run: for row i, log-softmax over the whole vocabulary axis at the
// masked position, read at the true piece id; the sum over the pieces is the PLL (higher is better, in nats).
export function pllFromLogits(logits, dims, batch) {
  const [n, L, V] = dims;
  if (dims.length !== 3 || n !== batch.dims[0] || L !== batch.dims[1]) throw new Error(`logits of shape [${dims}] do not match a batch of [${batch.dims}]`);
  if (logits.length !== n * L * V) throw new Error(`logits have ${logits.length} values, not ${n * L * V}`);
  const perPiece = [];
  let pll = 0;
  for (let i = 0; i < n; i++) {
    const lp = logSoftmaxAt(logits, (i * L + batch.offset + i) * V, V, batch.pieceIds[i]);
    perPiece.push(lp); pll += lp;
  }
  return { pll, perPiece };
}

// Scores every candidate in a template (one run each). runBatch({ input, mask, dims }) resolves to the logits tensor
// { data: Float32Array, dims: [n, L, V] }; the worker binds it to the ONNX session, the check to a mock. `unknown` marks a
// candidate with a piece the vocabulary cannot cover ([UNK]): its PLL is not meaningful. `memo` remembers up to MEMO_MAX
// results by template and candidate across calls, so a learner trying several words in one blank does not pay for the
// blank's authored options again each time (a repeated candidate within one call is scored once the same way).
export const MEMO_MAX = 256;
export async function scoreCandidates(runBatch, tok, template, candidates, memo = new Map()) {
  if (!Array.isArray(candidates) || !candidates.length) throw new Error('no candidates to score');
  const out = [];
  for (const raw of candidates) {
    const candidate = String(raw ?? '');
    const key = `${template}\u0000${candidate}`;
    let row = memo.get(key);
    if (!row) {
      const batch = maskedBatch(tok, template, candidate);
      const logits = await runBatch(batch);
      if (!logits || !logits.dims || logits.dims[2] < tok.vocab.size) throw new Error('the model returned no usable logits');
      const { pll, perPiece } = pllFromLogits(logits.data, logits.dims, batch);
      row = { pll, perPiece, pieces: tok.decode(batch.pieceIds), unknown: batch.pieceIds.includes(tok.UNK) };
      if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);
      memo.set(key, row);
    }
    out.push({ candidate, ...row });
  }
  return out;
}

// One request to one reply. `ready()` resolves to the loaded scorer { score(template, candidates), loadMs }; a load failure
// or a bad request becomes { id, error } so the page always hears back.
export async function handleRequest(msg, ready) {
  try {
    const scorer = await ready();
    if (msg.warm) return { id: msg.id, ready: true, loadMs: scorer.loadMs };
    const t0 = now();
    const scores = await scorer.score(msg.template, msg.candidates);
    return { id: msg.id, scores, ms: now() - t0 };
  } catch (e) {
    return { id: msg.id, error: String((e && e.message) || e) };
  }
}

// ---------- runtime (worker only) ----------
async function fromCache(url) {
  try { return (await (await caches.open(FIT_CACHE)).match(url)) || null; } catch { return null; }
}
async function loadFile(url) {
  const response = (await fromCache(url)) || await fetch(url);
  if (!response.ok) throw new Error(`${url.slice(url.lastIndexOf('/') + 1)}: HTTP ${response.status}`);
  return response;
}
export async function loadScorer() {
  const t0 = now();
  const ort = await import(ORT_MODULE);
  ort.env.logLevel = 'error';
  ort.env.wasm.numThreads = 1;        // GitHub Pages sends no COOP/COEP, so no SharedArrayBuffer, so no threads
  ort.env.wasm.proxy = false;         // this is already a worker
  // Where the runtime fetches its .wasm when the cache does not have it. The object form, with `wasm` only: a string
  // prefix (or an `mjs` entry) makes the runtime import a separate ort-wasm-simd-threaded.mjs from there instead of the
  // Emscripten glue bundled into ort.wasm.bundle.min.mjs, and that file is not shipped.
  ort.env.wasm.wasmPaths = { wasm: ORT_WASM };
  const [wasm, model, vocab] = await Promise.all([fromCache(ORT_WASM), loadFile(MODEL_FILE), loadFile(VOCAB_FILE)]);
  if (wasm) ort.env.wasm.wasmBinary = await wasm.arrayBuffer();   // the cached runtime: no request at all
  const tok = makeTokenizer(await vocab.text());
  if (tok.MASK === undefined || tok.CLS === undefined) throw new Error('vocab.txt has no special tokens');
  const session = await ort.InferenceSession.create(new Uint8Array(await model.arrayBuffer()), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  for (const name of ['input_ids', 'attention_mask']) if (!session.inputNames.includes(name)) throw new Error(`the model has no ${name} input`);
  if (!session.outputNames.includes('logits')) throw new Error('the model has no logits output');
  const runBatch = async ({ input, mask, dims }) => {
    const out = await session.run({ input_ids: new ort.Tensor('int64', input, dims), attention_mask: new ort.Tensor('int64', mask, dims) });
    return out.logits;
  };
  // The session's first run costs several hundred milliseconds more than the rest (arena and kernel set-up), so it is
  // paid here, while the page is warming the scorer, and not by the learner's first word.
  await runBatch(maskedBatch(tok, 'Ciao, come ____?', 'stai'));
  const memo = new Map();
  return { score: (template, candidates) => scoreCandidates(runBatch, tok, template, candidates, memo), loadMs: now() - t0, tok };
}

const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope && typeof self.postMessage === 'function';
if (inWorker) {
  let loading = null;
  const ready = () => loading ||= loadScorer().then(
    (scorer) => { self.postMessage({ type: 'ready', loadMs: scorer.loadMs }); return scorer; },
    (e) => { loading = null; throw e; },                 // the next request tries again
  );
  const cancelled = new Set();
  let queue = Promise.resolve();
  self.onmessage = (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.cancel !== undefined) { if (cancelled.size > 1000) cancelled.clear(); cancelled.add(msg.cancel); return; }
    if (msg.id === undefined) return;
    queue = queue.then(async () => {
      if (cancelled.delete(msg.id)) return;              // the page gave up before its turn: not scored, no reply
      self.postMessage(await handleRequest(msg, ready));
      cancelled.delete(msg.id);                          // a cancel that raced the reply
    });
  };
}
