#!/usr/bin/env node
// The fit scorer (sentence workshop layer 2, docs/PLAN-SENTENCE-WORKSHOP-2026-10-02.md §8): the pure parts of
// js/workers/fit-scorer.worker.js and js/learning/fit-scorer.js, run in Node without ONNX Runtime.
//   - the WordPiece tokenizer on the real vocabulary (lower-casing, accent stripping, punctuation and control characters,
//     continuation pieces, [UNK], the special ids) and its verbatim identity with models/fit-scorer/score.mjs, the proof;
//   - the masked batch for a candidate (one row per piece with [MASK] at that piece, int64 layout, the length limit) and
//     the pseudo-log-likelihood read off mocked 32,102-column logits (log-softmax over every column, padding included);
//   - scoreCandidates over a mocked session (order, memo, [UNK]) and handleRequest's replies;
//   - fitScores: the 0..1 scale from the authored options, the fallback span, the notes;
//   - the main-thread module outside a browser: support, status, argument errors;
//   - the published files: model, vocabulary and ONNX Runtime Web present with the documented sizes and hashes, and the
//     cache name shared by sw.js, the page module and the worker.
// Usage: node tools/test-fit-scorer.mjs   (exit 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const W = await import('../js/workers/fit-scorer.worker.js');
const M = await import('../js/learning/fit-scorer.js');

let passed = 0;
const failures = [];
const check = (name, cond, detail) => { if (cond) passed++; else failures.push(name + (detail === undefined ? '' : `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const throws = (name, fn, re) => { try { fn(); check(name, false, 'did not throw'); } catch (e) { check(name, re.test(e.message), e.message); } };
const rejects = async (name, promise, want) => {
  try { await promise; check(name, false, 'did not reject'); }
  catch (e) { check(name, want instanceof RegExp ? want.test(e.message) : e instanceof want, `${e.constructor.name}: ${e.message}`); }
};

// ---------- published files ----------
const SHA256 = {
  'models/fit-scorer/model.onnx': '5a5d101247ce8a3bc43e74c0015ff889c057a5528431456bbd8447f718a32ea0',
  'models/fit-scorer/vocab.txt': 'd0f9754a1666044fe5acecaf4ac1ce546cf329c4c1fd8995642954414ec57303',
};
check('FIT_FILES lists the model, the vocabulary and the two runtime files', same(M.FIT_FILES.map((f) => f.path), ['models/fit-scorer/model.onnx', 'models/fit-scorer/vocab.txt', 'vendor/ort/ort.wasm.bundle.min.mjs', 'vendor/ort/ort-wasm-simd-threaded.wasm']));
for (const f of M.FIT_FILES) {
  const file = path.join(ROOT, f.path);
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  check(`${f.path} is on disk`, exists);
  if (exists) check(`${f.path} has the documented size`, fs.statSync(file).size === f.bytes, `${fs.statSync(file).size} bytes on disk, FIT_FILES says ${f.bytes}`);
  check(`${f.path} has a media type for its cache entry`, typeof f.type === 'string' && f.type.includes('/'));
}
for (const [rel, want] of Object.entries(SHA256)) {
  if (!fs.existsSync(path.join(ROOT, rel))) continue;
  check(`${rel} sha256 matches models/fit-scorer/README.md`, createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex') === want);
}
check('FIT_BYTES is the sum of the files', M.FIT_BYTES === 68696037 + 242585 + 73054 + 14239897);
const modelReadme = read('models/fit-scorer/README.md');
for (const f of M.FIT_FILES) {
  const name = f.path.slice(f.path.lastIndexOf('/') + 1);
  const m = modelReadme.match(new RegExp(`\\| \`${name.replace(/\./g, '\\.')}\` \\| ([\\d,]+)`));
  check(`models/fit-scorer/README.md documents ${name} at the FIT_FILES size`, m && Number(m[1].replace(/,/g, '')) === f.bytes, m ? m[1] : 'not in the README tables');
}
const bundle = read('vendor/ort/ort.wasm.bundle.min.mjs');
check('vendor/ort is ONNX Runtime Web 1.30.0', bundle.slice(0, 200).includes('ONNX Runtime Web v1.30.0'));
check('the bundle loads the SIMD runtime file that ships next to it', bundle.includes('ort-wasm-simd-threaded.wasm') && bundle.includes('wasmBinary'));
const vocabText = read('models/fit-scorer/vocab.txt');
check('vocab.txt has 31,102 lines (line number = token id)', vocabText.replace(/\n$/, '').split('\n').length === 31102);

// ---------- one cache name, served by sw.js ----------
const cacheName = (src) => src.match(/const FIT_CACHE\s*=\s*'([^']+)'/)?.[1];
const sw = read('sw.js');
check('FIT_CACHE is the same in sw.js, the page module and the worker', cacheName(sw) === M.FIT_CACHE && W.FIT_CACHE === M.FIT_CACHE && M.FIT_CACHE === 'parola-fit-scorer-v1', { sw: cacheName(sw), page: M.FIT_CACHE, worker: W.FIT_CACHE });
check('sw.js activate keeps FIT_CACHE', /k\s*!==\s*FIT_CACHE/.test(sw));
check('sw.js fetch serves models/ and vendor/ort/ from FIT_CACHE', /'\.\/models\/'/.test(sw) && /'\.\/vendor\/ort\/'/.test(sw) && /caches\.open\(FIT_CACHE\)/.test(sw));
const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] || '';
check('sw.js never precaches the model, the runtime or the worker', !/models\/|vendor\/|js\/workers\//.test(shell));
check('the worker is where the page module expects it', fs.existsSync(path.join(ROOT, 'js/workers/fit-scorer.worker.js')) && /new URL\('\.\.\/workers\/fit-scorer\.worker\.js'/.test(read('js/learning/fit-scorer.js')));
// A string wasmPaths prefix makes onnxruntime-web import ort-wasm-simd-threaded.mjs, which is not shipped (the glue is bundled).
check('the worker points the runtime at the .wasm only, keeping the bundled glue', /wasmPaths\s*=\s*\{\s*wasm:/.test(read('js/workers/fit-scorer.worker.js')) && !/wasmPaths\s*=\s*(VENDOR|'|")/.test(read('js/workers/fit-scorer.worker.js')) && !fs.existsSync(path.join(ROOT, 'vendor/ort/ort-wasm-simd-threaded.mjs')));

// ---------- tokenizer ----------
const tok = W.makeTokenizer(vocabText);
const pieces = (s) => tok.decode(tok.encode(s));
check('special ids [PAD] [UNK] [CLS] [SEP] [MASK]', same([tok.PAD, tok.UNK, tok.CLS, tok.SEP, tok.MASK], [0, 101, 102, 103, 104]));
check('vocabulary entries (31,102 lines, one empty)', tok.vocab.size === 31101, tok.vocab.size);
check('a sentence: lower-cased words, punctuation on its own', same(pieces('Bene grazie, ma sono stanco.'), ['bene', 'grazie', ',', 'ma', 'sono', 'stanco', '.']));
check('accents are stripped (the accented rows are untrained)', same(pieces('caffè è perché'), ['caffe', 'e', 'perche']));
check('the accented rows exist in vocab.txt but are never emitted', tok.vocab.has('caffè') && tok.vocab.has('è') && !tok.encode('un caffè è').includes(tok.vocab.get('caffè')) && !tok.encode('un caffè è').includes(tok.vocab.get('è')));
check('stripAccents: false keeps them (not what the app does)', same(W.makeTokenizer(vocabText, { stripAccents: false }).decode(W.makeTokenizer(vocabText, { stripAccents: false }).encode('caffè')), ['caffè']));
check('upper case folds', same(pieces('Stanco STANCO'), ['stanco', 'stanco']));
check('apostrophes and brackets split off', same(pieces("l'amico (ciao)"), ['l', "'", 'amico', '(', 'ciao', ')']));
check('a tab is whitespace, a control character is dropped', same(pieces('ciao\tcome sta\u0000i'), ['ciao', 'come', 'stai']));
check('continuation pieces carry ##', same(pieces('stanchissimo'), ['stanchi', '##ssimo']) && same(pieces('straordinariamente'), ['straordinaria', '##mente']));
check('a two-word candidate', same(pieces('un caffè'), ['un', 'caffe']) && same(pieces('il pane'), ['il', 'pane']));
check('[UNK] for characters the vocabulary cannot cover', same(tok.encode('😀'), [tok.UNK]) && same(tok.encode('ж'), [tok.UNK]));
check('[UNK] for a token over 100 characters', same(tok.encode('a'.repeat(101)), [tok.UNK]) && !tok.encode('a'.repeat(100)).includes(tok.UNK));
check('blank text encodes to nothing', tok.encode('   ').length === 0 && tok.encode('').length === 0);
const between = (src, from, to) => { const a = src.indexOf(from); const b = a < 0 ? -1 : src.indexOf(to, a); return a < 0 || b < 0 ? null : src.slice(a, b); };
const workerSrc = read('js/workers/fit-scorer.worker.js'), proofSrc = read('models/fit-scorer/score.mjs');
const tokW = between(workerSrc, 'function isPunct(ch) {', '// ---------- scoring ----------'), tokP = between(proofSrc, 'function isPunct(ch) {', '// ---------- scoring ----------');
check('the worker tokenizer is verbatim the one in models/fit-scorer/score.mjs', tokW !== null && tokW === tokP);
const lsW = between(workerSrc, 'function logSoftmaxAt(', '\n}\n'), lsP = between(proofSrc, 'function logSoftmaxAt(', '\n}\n');
check('the worker logSoftmaxAt is verbatim the one in models/fit-scorer/score.mjs', lsW !== null && lsW === lsP);

// ---------- masked batch ----------
const tpl = 'Bene grazie, ma sono ____.';
check('splitTemplate', same(W.splitTemplate('a ____ b'), ['a ', ' b']) && W.BLANK === '____');
const b = W.maskedBatch(tok, tpl, 'stanco');     // [CLS] bene grazie , ma sono [MASK] . [SEP]
check('one piece: one row of 9, candidate at offset 6', same(b.dims, [1, 9]) && b.offset === 6 && same(b.pieceIds, [tok.vocab.get('stanco')]));
check('int64 tensors', b.input instanceof BigInt64Array && b.mask instanceof BigInt64Array && b.input.length === 9 && b.mask.length === 9);
check('the row is [CLS] prefix [MASK] suffix [SEP]', b.input[0] === BigInt(tok.CLS) && b.input[1] === BigInt(tok.vocab.get('bene')) && b.input[6] === BigInt(tok.MASK) && b.input[7] === BigInt(tok.vocab.get('.')) && b.input[8] === BigInt(tok.SEP));
check('attention mask is all ones', [...b.mask].every((v) => v === 1n));
const b2 = W.maskedBatch(tok, tpl, 'stanchissimo');   // two pieces
const row = (i) => [...b2.input.slice(i * 10, (i + 1) * 10)].map(Number);
check('two pieces: two rows of 10', same(b2.dims, [2, 10]) && b2.pieceIds.length === 2);
check('row 0 masks piece 0 and shows piece 1', row(0)[6] === tok.MASK && row(0)[7] === b2.pieceIds[1]);
check('row 1 shows piece 0 and masks piece 1', row(1)[6] === b2.pieceIds[0] && row(1)[7] === tok.MASK);
check('the rows agree everywhere else', row(0).every((v, p) => p === 6 || p === 7 || v === row(1)[p]));
check('candidate spacing and case do not change the batch', same([...W.maskedBatch(tok, tpl, '  Stanco ').input].map(String), [...b.input].map(String)));
throws('a template without a blank is refused', () => W.maskedBatch(tok, 'no blank here', 'x'), /exactly one ____/);
throws('a template with two blanks is refused', () => W.maskedBatch(tok, '____ e ____', 'x'), /exactly one ____/);
throws('an empty candidate is refused', () => W.maskedBatch(tok, tpl, '   '), /empty/);
throws('a sentence over 512 pieces is refused', () => W.maskedBatch(tok, 'ciao '.repeat(520) + '____.', 'stanco'), /more than the model's 512/);

// ---------- pseudo-log-likelihood arithmetic ----------
const V = 32102;
const lp = (x, others = 0) => x - Math.log(Math.exp(x) + others + (V - 1));   // one bumped column among V zeros
check('logSoftmaxAt on a small row', near(W.logSoftmaxAt(new Float32Array([1, 2, 3]), 0, 3, 2), 3 - Math.log(Math.E + Math.E ** 2 + Math.E ** 3), 1e-6));
check('logSoftmaxAt honours the offset and the width', near(W.logSoftmaxAt(new Float32Array([9, 9, 0, 0]), 2, 2, 1), -Math.log(2), 1e-6));
const at = (L, i, p, c) => (i * L + p) * V + c;
const logits = new Float32Array(1 * 9 * V);
logits[at(9, 0, 6, b.pieceIds[0])] = 3; logits[at(9, 0, 6, 5)] = 1;
const want1 = 3 - Math.log(Math.exp(3) + Math.exp(1) + (V - 2));
const r1 = W.pllFromLogits(logits, [1, 9, V], b);
check('PLL of a one-piece candidate is the log-softmax at its masked position', near(r1.pll, want1, 1e-5) && r1.perPiece.length === 1 && near(r1.perPiece[0], want1, 1e-5), r1);
logits[at(9, 0, 2, b.pieceIds[0])] = 50; logits[at(9, 0, 7, 3)] = 50;
check('other positions do not enter the PLL', near(W.pllFromLogits(logits, [1, 9, V], b).pll, want1, 1e-5));
logits[at(9, 0, 6, 32000)] = 8;      // beyond vocab.txt's 31,102 rows: padding of the embedding matrix
check('the softmax is normalised over all 32,102 columns, padding included', near(W.pllFromLogits(logits, [1, 9, V], b).pll, 3 - Math.log(Math.exp(3) + Math.exp(1) + Math.exp(8) + (V - 3)), 1e-5));
const logits2 = new Float32Array(2 * 10 * V);
logits2[at(10, 0, 6, b2.pieceIds[0])] = 2; logits2[at(10, 1, 7, b2.pieceIds[1])] = 4;
const r2 = W.pllFromLogits(logits2, [2, 10, V], b2);
check('a two-piece PLL sums the pieces, each read from its own row', near(r2.pll, lp(2) + lp(4), 1e-5) && near(r2.perPiece[0], lp(2), 1e-5) && near(r2.perPiece[1], lp(4), 1e-5), r2);
throws('logits of another batch shape are refused', () => W.pllFromLogits(logits, [2, 9, V], b), /do not match/);
throws('short logits are refused', () => W.pllFromLogits(new Float32Array(10), [1, 9, V], b), /values/);

// ---------- scoring over a mocked session ----------
const bump = { stanco: 6, felice: 3, verde: 0, tavolo: -4 };
const calls = [];
const runBatch = async (batch) => {
  calls.push(batch);
  const [n, L] = batch.dims;
  const data = new Float32Array(n * L * V);
  const x = bump[tok.decode(batch.pieceIds).join(' ')] ?? 1;
  for (let i = 0; i < n; i++) data[at(L, i, batch.offset + i, batch.pieceIds[i])] = x;
  return { data, dims: [n, L, V] };
};
const rows = await W.scoreCandidates(runBatch, tok, tpl, ['stanco', 'felice', 'verde', 'tavolo', 'stanco']);
check('rows come back in the candidates\' order', same(rows.map((r) => r.candidate), ['stanco', 'felice', 'verde', 'tavolo', 'stanco']));
check('a repeated candidate is scored once', calls.length === 4);
check('PLLs follow the logits', rows[0].pll > rows[1].pll && rows[1].pll > rows[2].pll && rows[2].pll > rows[3].pll && near(rows[0].pll, lp(6), 1e-5) && near(rows[3].pll, lp(-4), 1e-5));
check('rows carry pieces, perPiece and unknown', same(rows[0].pieces, ['stanco']) && rows[0].perPiece.length === 1 && rows.every((r) => r.unknown === false));
const memo = new Map();
calls.length = 0;
await W.scoreCandidates(runBatch, tok, tpl, ['stanco', 'felice', 'verde'], memo);
const again = await W.scoreCandidates(runBatch, tok, tpl, ['stanco', 'felice', 'verde', 'tavolo'], memo);
check('memo: a later call scores only the new word', calls.length === 4 && memo.size === 4 && same(again.map((r) => r.candidate), ['stanco', 'felice', 'verde', 'tavolo']));
await W.scoreCandidates(runBatch, tok, 'Mangio ____ a colazione.', ['stanco'], memo);
check('memo is keyed by template and candidate', calls.length === 5 && memo.size === 5);
const small = new Map();
for (let i = 0; i < W.MEMO_MAX + 5; i++) await W.scoreCandidates(runBatch, tok, tpl, [`parola${i}`], small);
check(`memo holds at most MEMO_MAX (${W.MEMO_MAX}) results`, small.size === W.MEMO_MAX && !small.has(`${tpl}\u0000parola0`) && small.has(`${tpl}\u0000parola${W.MEMO_MAX + 4}`));
const unk = await W.scoreCandidates(runBatch, tok, tpl, ['😀']);
check('a candidate with an uncoverable piece is flagged unknown', unk[0].unknown === true && same(unk[0].pieces, ['[UNK]']));
await rejects('no candidates', W.scoreCandidates(runBatch, tok, tpl, []), /no candidates/);
await rejects('logits narrower than the vocabulary', W.scoreCandidates(async () => ({ data: new Float32Array(0), dims: [1, 9, 100] }), tok, tpl, ['stanco']), /no usable logits/);
const scorer = { loadMs: 7, score: (template, candidates) => W.scoreCandidates(runBatch, tok, template, candidates) };
const ok = await W.handleRequest({ id: 1, template: tpl, candidates: ['stanco', 'tavolo'] }, async () => scorer);
check('handleRequest answers { id, scores, ms }', ok.id === 1 && ok.scores.length === 2 && ok.scores[0].candidate === 'stanco' && typeof ok.ms === 'number' && !('error' in ok));
check('handleRequest answers a warm-up with the load time', same(await W.handleRequest({ id: 2, warm: true }, async () => scorer), { id: 2, ready: true, loadMs: 7 }));
const bad = await W.handleRequest({ id: 3, template: 'no blank', candidates: ['x'] }, async () => scorer);
check('a bad template becomes { id, error }', bad.id === 3 && /exactly one ____/.test(bad.error) && !('scores' in bad));
const failed = await W.handleRequest({ id: 4, template: tpl, candidates: ['x'] }, async () => { throw new Error('model.onnx: HTTP 404'); });
check('a load failure becomes { id, error }', same(failed, { id: 4, error: 'model.onnx: HTTP 404' }));

// ---------- fit mapping and notes ----------
const measured = [{ candidate: 'stanco', pll: -3.06 }, { candidate: 'felice', pll: -6.05 }, { candidate: 'verde', pll: -10.90 }, { candidate: 'tavolo', pll: -15.07 }];   // README, int8 WASM
const scored = M.fitScores(measured);   // three authored options, the learner's word last
check('sorted by pll, best first', same(scored.map((r) => r.candidate), ['stanco', 'felice', 'verde', 'tavolo']));
check('the best authored option scores 1, the worst 0', scored[0].fit === 1 && scored[2].fit === 0 && scored[0].note === 'natural' && scored[2].note === 'odd here');
check('an authored option in between sits on the scale', near(scored[1].fit, (-6.05 + 10.90) / (-3.06 + 10.90), 1e-9) && scored[1].note === 'natural');
check('a learner word below the scale clamps to 0, "odd here"', scored[3].fit === 0 && scored[3].note === 'odd here');
check('every row keeps its fields and gains fit and note', scored.every((r) => typeof r.candidate === 'string' && typeof r.pll === 'number' && typeof r.fit === 'number' && typeof r.note === 'string'));
const mixed = M.fitScores([{ candidate: 'verde', pll: -10.9 }, { candidate: 'stanco', pll: -3.06 }, { candidate: 'felice', pll: -6.05 }, { candidate: 'contento', pll: -5 }]);
check('the authored order does not matter, the last row is the learner\'s', near(mixed.find((r) => r.candidate === 'contento').fit, (-5 + 10.9) / 7.84, 1e-9) && mixed.find((r) => r.candidate === 'contento').note === 'natural');
check('a learner word above every authored option clamps to 1', M.fitScores([{ pll: -5 }, { pll: -7 }, { pll: -1 }])[0].fit === 1);
const two = M.fitScores([{ candidate: 'a', pll: -2 }, { candidate: 'b', pll: -4 }, { candidate: 'c', pll: -3 }, { candidate: 'd', pll: -3.5 }], 2);
check('`authored` overrides how many leading rows are the reference', two.find((r) => r.candidate === 'c').fit === 0.5 && two.find((r) => r.candidate === 'd').fit === 0.25 && two.find((r) => r.candidate === 'd').note === 'unusual here');
const one = M.fitScores([{ candidate: 'a', pll: -3 }, { candidate: 'w', pll: -4 }]);
check(`a single authored option: the scale runs FALLBACK_SPAN (${M.FALLBACK_SPAN}) nats below it`, one.find((r) => r.candidate === 'a').fit === 1 && near(one.find((r) => r.candidate === 'w').fit, 1 - 1 / M.FALLBACK_SPAN, 1e-9));
const alike = M.fitScores([{ pll: -3 }, { pll: -3 }, { pll: -6 }]);
check('authored options that score alike: the fallback span, not a division by zero', alike[0].fit === 1 && alike[1].fit === 1 && alike[2].fit === 0 && alike.every((r) => Number.isFinite(r.fit)));
check('the fallback never applies when two authored options differ', M.fitScores([{ pll: -3 }, { pll: -3.5 }, { pll: -4 }])[2].fit === 0);
check('one row alone', same(M.fitScores([{ pll: -3 }]).map((r) => r.fit), [1]));
check('nothing in, nothing out', same(M.fitScores([]), []) && same(M.fitScores(null), []));
check('a row without a finite pll gets fit 0', M.fitScores([{ pll: -3 }, { pll: -5 }, { pll: NaN }]).find((r) => Number.isNaN(r.pll)).fit === 0);
check('notes at the thresholds', M.fitNote(1) === 'natural' && M.fitNote(0.6) === 'natural' && M.fitNote(0.599) === 'unusual here' && M.fitNote(0.2) === 'unusual here' && M.fitNote(0.199) === 'odd here' && M.fitNote(0) === 'odd here');
check('the thresholds are the documented ones', M.FIT_NATURAL === 0.6 && M.FIT_UNUSUAL === 0.2);

// ---------- the page module outside a browser ----------
const support = M.fitScorerSupport();
check('no Worker here: unsupported, with a reason', support.supported === false && /Workers/.test(support.reason), support);
check('status outside a browser', same(await M.fitScorerStatus(), { installed: false, bytes: 0, version: 'bertino-int8-1' }));
check('constants', M.FIT_CACHE === 'parola-fit-scorer-v1' && M.FIT_SCORER_VERSION === 'bertino-int8-1');
await rejects('scoreFit: template without a blank', M.scoreFit('no blank', ['a']), TypeError);
await rejects('scoreFit: template with two blanks', M.scoreFit('a ____ b ____', ['a']), TypeError);
await rejects('scoreFit: no candidates', M.scoreFit('a ____ b', []), TypeError);
await rejects('scoreFit: a blank candidate', M.scoreFit('a ____ b', ['ok', '  ']), TypeError);
await rejects('scoreFit: not installed', M.scoreFit('a ____ b', ['ok']), /not installed/);
await rejects('warmFitScorer: not installed', M.warmFitScorer(), /not installed/);
await rejects('installFitScorer: unsupported here', M.installFitScorer(), /cannot run here/);
await M.removeFitScorer();
M.releaseFitScorer();
check('remove and release are harmless outside a browser', true);

const total = passed + failures.length;
if (failures.length) { console.error(`tools/test-fit-scorer.mjs: ${failures.length} of ${total} checks failed`); failures.forEach((f) => console.error('  - ' + f)); process.exit(1); }
console.log(`tools/test-fit-scorer.mjs: OK — ${total} checks: files and hashes, one cache name, tokenizer (verbatim with score.mjs), masked batch, PLL arithmetic over 32,102 columns, mocked session, fit mapping and notes, page module outside a browser`);
