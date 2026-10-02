// score.mjs - proof that the int8 BERTino ONNX model scores a word in a blank by
// pseudo-log-likelihood (PLL). Plain-JS WordPiece tokenizer, no tokenizer library.
//
//   node score.mjs [--dir=models/fit-scorer] [--keep-accents] [--l2r] \
//        "Bene grazie, ma sono ____." stanco felice tavolo verde
//
// With no sentence given it runs the two proof cases from the plan.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// ORT_PKG=onnxruntime-web runs the same proof on the WASM backend the browser uses.
const ort = await import(process.env.ORT_PKG || 'onnxruntime-node');
if (process.env.ORT_PKG === 'onnxruntime-web') ort.env.wasm.numThreads = 1;   // GitHub Pages: no COOP/COEP, so no threads

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
    text = text.replace(/[\u0000\uFFFD]|[\p{Cc}\p{Cf}]/gu, (c) => (/\s/.test(c) ? ' ' : '')).replace(/\s+/g, ' ');
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

export async function loadScorer(dir, opts = {}) {
  const tok = makeTokenizer(readFileSync(join(dir, 'vocab.txt'), 'utf8'), opts);
  const session = await ort.InferenceSession.create(join(dir, 'model.onnx'), { graphOptimizationLevel: 'all' });

  // Pseudo-log-likelihood of `candidate` in the blank ("____") of `template`.
  // Standard PLL (Salazar et al. 2020): mask each candidate piece in turn, others visible.
  // l2r variant (Kauf & Ivanova 2023): also mask the candidate pieces to the right of the masked one,
  // which stops multi-piece words from predicting themselves from their own tail.
  async function score(template, candidate, { l2r = false } = {}) {
    const [pre, post] = template.split('____');
    const idsPre = tok.encode(pre), idsC = tok.encode(candidate), idsPost = tok.encode(post);
    const base = [tok.CLS, ...idsPre, ...idsC, ...idsPost, tok.SEP];
    const off = 1 + idsPre.length, n = idsC.length, L = base.length;
    // one batched run: row i has candidate piece i masked
    const input = new BigInt64Array(n * L), mask = new BigInt64Array(n * L).fill(1n);
    for (let i = 0; i < n; i++) for (let p = 0; p < L; p++) {
      const masked = p === off + i || (l2r && p > off + i && p < off + n);
      input[i * L + p] = BigInt(masked ? tok.MASK : base[p]);
    }
    const out = await session.run({
      input_ids: new ort.Tensor('int64', input, [n, L]),
      attention_mask: new ort.Tensor('int64', mask, [n, L]),
    });
    const logits = out.logits.data;                      // [n, L, V]
    const V = out.logits.dims[2];                        // 32102: config vocab_size, NOT vocab.txt's 31102 lines
    let pll = 0;
    const perPiece = [];
    for (let i = 0; i < n; i++) {
      const lp = logSoftmaxAt(logits, (i * L + off + i) * V, V, idsC[i]);
      perPiece.push(lp); pll += lp;
    }
    return { candidate, pieces: tok.decode(idsC), pll, mean: pll / n, perPiece };
  }
  return { tok, session, score };
}

// ---------- CLI ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.find((a) => a.startsWith(`--${name}`));
const dir = (flag('dir') || '--dir=models/fit-scorer').split('=')[1];
const keepAccents = !!flag('keep-accents');
const l2r = !!flag('l2r');
const positional = argv.filter((a) => !a.startsWith('--'));
const cases = positional.length
  ? [[positional[0], positional.slice(1)]]
  : [['Bene grazie, ma sono ____.', ['stanco', 'felice', 'tavolo', 'verde']],
     ['Mangio ____ a colazione.', ['il pane', 'la macchina', 'un caffè']]];

const t0 = performance.now();
const scorer = await loadScorer(dir, { stripAccents: !keepAccents });
console.log(`model: ${join(dir, 'model.onnx')}  loaded in ${(performance.now() - t0).toFixed(0)} ms  (stripAccents=${!keepAccents}, l2r=${l2r})`);
for (const [tpl, cands] of cases) {
  console.log(`\n${tpl}`);
  const rows = [];
  for (const c of cands) {
    const t1 = performance.now();
    const r = await scorer.score(tpl, c, { l2r });
    rows.push({ ...r, ms: performance.now() - t1 });
  }
  rows.sort((a, b) => b.pll - a.pll);
  for (const r of rows) {
    console.log(`  ${r.candidate.padEnd(12)} pieces=${JSON.stringify(r.pieces).padEnd(26)} pll=${r.pll.toFixed(2).padStart(7)}  mean/piece=${r.mean.toFixed(2).padStart(6)}  (${r.ms.toFixed(0)} ms)`);
  }
}
