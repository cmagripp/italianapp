# Fit scorer model (layer 2 of the sentence workshop)

Italian masked-language model that scores a learner's word in a blank by pseudo-log-likelihood
(see `docs/PLAN-SENTENCE-WORKSHOP-2026-10-02.md` §8, layer 2). Runs on the CPU through
ONNX Runtime Web (WebAssembly); no WebGPU, no tokenizer library.

## Model

| | |
|---|---|
| Source | [`indigo-ai/BERTino`](https://huggingface.co/indigo-ai/BERTino), Italian DistilBERT by indigo.ai |
| Architecture | DistilBertForMaskedLM: 6 layers, 768 hidden, 12 heads, 32,102-row embedding, 512 positions; about 66 M parameters |
| Training data | Paisà + ItWaC (14 M sentences, 12 GB); distilled from `dbmdz/bert-base-italian-xxl-uncased` |
| Licence | MIT (model card) |
| Casing | uncased, **accents stripped** (see Tokenizer below) |

## Files

| File | Bytes | What it is |
|---|---|---|
| `model.onnx` | 68,696,037 (68.7 MB, 65.5 MiB) | masked-LM graph, dynamic int8 (uint8 weights, `MatMulInteger` + `DynamicQuantizeLinear`), opset 18, single file, no external data |
| `vocab.txt` | 242,585 | WordPiece vocabulary, 31,102 lines, line number = token id |
| `tokenizer.json` | 731,808 | same vocabulary in the `tokenizers` fast format (for Transformers.js if ever wanted; not needed by the app) |
| `tokenizer_config.json` | 1,327 | `do_lower_case: true`, `strip_accents: null` (= strip), `model_max_length: 512` |
| `special_tokens_map.json` | 112 | `[PAD] [UNK] [CLS] [SEP] [MASK]` |
| `config.json` | 474 | original model config (`vocab_size: 32102`) |
| `score.mjs` | | Node proof of the scoring recipe, plain-JS tokenizer included (see below) |

sha256: `model.onnx` 5a5d101247ce8a3bc43e74c0015ff889c057a5528431456bbd8447f718a32ea0,
`vocab.txt` d0f9754a1666044fe5acecaf4ac1ce546cf329c4c1fd8995642954414ec57303.

Every file is under GitHub's 100 MB hard limit; `git push` will print the usual warning for files over 50 MB.
Do not put the model in Git LFS: GitHub Pages does not serve LFS objects.

Graph interface: inputs `input_ids` and `attention_mask`, both int64 `[batch, seq]`; output `logits`
float32 `[batch, seq, 32102]`. There is no `token_type_ids` input (DistilBERT).

## How it was produced (2 October 2026, Linux x86-64, Python 3.11)

```sh
pip install --user torch --index-url https://download.pytorch.org/whl/cpu          # torch 2.14.1+cpu
pip install --user transformers "optimum[onnxruntime]" onnx accelerate              # transformers 4.57.6, optimum 2.1.0,
                                                                                    # optimum-onnx 0.1.0, onnx 1.23.1,
                                                                                    # onnxruntime 1.30.0, accelerate 1.15.0
python3 -c "from huggingface_hub import snapshot_download; snapshot_download('indigo-ai/BERTino', local_dir='bertino-hf', allow_patterns=['*.json','*.txt','*.bin'])"
optimum-cli export onnx --model bertino-hf --task fill-mask bertino-onnx            # 272.9 MB fp32, max |diff| vs torch 4.5e-5
python3 -c "from onnxruntime.quantization import quantize_dynamic, QuantType; quantize_dynamic('bertino-onnx/model.onnx', 'model.onnx', weight_type=QuantType.QUInt8)"
cp bertino-hf/vocab.txt bertino-hf/special_tokens_map.json bertino-hf/config.json bertino-onnx/tokenizer.json bertino-onnx/tokenizer_config.json .
```

`accelerate` matters: without it optimum skips tied-weight deduplication, the embedding matrix is written twice
(371.5 MB fp32, 93.4 MB int8) instead of once (272.9 MB, 68.7 MB). The same commands run unchanged on a Mac.

## Tokenizer (plain JS, no library)

BERT WordPiece, as in `makeTokenizer` in `score.mjs` (about 45 lines):

1. Drop control characters, collapse whitespace, lower-case, then **strip accents**: `s.normalize('NFD').replace(/\p{Mn}/gu, '')`.
2. Split on spaces; split every punctuation character (`\p{P}` plus the ASCII symbol ranges 33-47, 58-64, 91-96, 123-126) into its own token.
3. For each token, greedy longest-match-first against the vocabulary, continuation pieces prefixed `##`; a token with no match becomes `[UNK]`; a token over 100 characters becomes `[UNK]`. (CJK splitting is omitted; irrelevant for Italian.)
4. Wrap as `[CLS] ... [SEP]`. Ids: `[PAD]`=0, `[UNK]`=101, `[CLS]`=102, `[SEP]`=103, `[MASK]`=104.

Accents must be stripped even though `vocab.txt` contains accented entries (`caffè`, `è`, `perché`): the model was
trained through the HF tokenizer with its default accent stripping, so the accented ids are untrained. Measured on the
fp32 model: in "Il cielo [MASK] blu." log p(`e`) = -1.46 but log p(`è`) = -20.51; "un caffè" in "Mangio ____ a
colazione." scores -5.99 stripped and -26.54 with the accent kept.

`vocab.txt` has 31,102 lines but the logits have 32,102 columns; the last 1,000 rows are unused padding of the
embedding matrix. Normalise the softmax over all 32,102 columns (as HF does) and index it by the `vocab.txt` line number.

## Scoring recipe (pseudo-log-likelihood)

Given a template with one blank and a candidate word or phrase:

1. Tokenize prefix, candidate and suffix separately; build `[CLS] prefix candidate suffix [SEP]`.
2. For each of the candidate's n pieces, make a copy of the sequence with that piece replaced by `[MASK]`
   (other pieces visible: standard PLL, Salazar et al. 2020). Batch the n copies into one run of shape `[n, L]`.
3. For copy i, take `logits[i, pos_i, :]`, log-softmax over the 32,102 columns, read the value at the true piece id.
4. PLL = sum of those n values. Report also PLL / n when comparing candidates with different piece counts.
5. Optional `l2r` variant (Kauf & Ivanova 2023): also mask the candidate pieces to the right of piece i, which stops a
   multi-piece word from predicting itself from its own tail. Scores shift but rankings held on the proof cases.

The app compares the learner's free-entry word against the authored options for the same blank and reports
"unusual here" when it falls well below them; the thresholds are to be tuned from the locally logged verdicts
(not set here).

## Proof (`score.mjs`)

```sh
mkdir /tmp/scorer && cd /tmp/scorer && npm i onnxruntime-node@1.30.0 onnxruntime-web@1.30.0
cp <repo>/models/fit-scorer/score.mjs . && node score.mjs --dir=<repo>/models/fit-scorer          # native CPU runtime
ORT_PKG=onnxruntime-web node score.mjs --dir=<repo>/models/fit-scorer                              # the browser's WASM backend, 1 thread
node score.mjs --dir=<repo>/models/fit-scorer "Vado al ____ a fare la spesa." supermercato cinema letto  # your own case
```

Results, PLL in nats (higher is better), standard variant, accents stripped:

| Template / candidate | fp32 PyTorch | fp32 ONNX | **int8 ONNX (node)** | **int8 ONNX (web WASM)** |
|---|---|---|---|---|
| Bene grazie, ma sono ____. stanco | -2.58 | -2.58 | **-3.06** | -3.06 |
| … felice | -5.52 | -5.52 | **-6.05** | -6.05 |
| … verde | -10.57 | -10.57 | **-10.90** | -10.90 |
| … tavolo | -15.10 | -15.10 | **-15.07** | -15.07 |
| Mangio ____ a colazione. il pane (`il`,`pane`) | -4.09 | -4.09 | **-5.42** | -5.42 |
| … un caffè (`un`,`caffe`) | -5.99 | -5.99 | **-7.53** | -7.53 |
| … la macchina (`la`,`macchina`) | -9.99 | -9.99 | **-9.99** | -9.99 |

The int8 model keeps the fp32 order in both cases (stanco > felice > verde > tavolo; il pane > un caffè > la macchina)
and the WASM backend reproduces the native numbers exactly. Per-candidate latency on a 4-core x86 container: 30 to 130 ms
native, 80 to 220 ms on single-thread WASM; session load 0.3 s native, 0.7 s WASM. Phone timings are not measured yet.

## Browser runtime (onnxruntime-web 1.30.0, MIT)

Implemented: `js/learning/fit-scorer.js` (page side: support check, install into the `parola-fit-scorer-v1` cache with
progress, `scoreFit`, the fit scale and notes) and `js/workers/fit-scorer.worker.js` (a module worker: the tokenizer and
recipe above, one ONNX session, PLL per candidate); `sw.js` keeps that cache across updates and serves `models/` and
`vendor/ort/` from it; `tools/test-fit-scorer.mjs` checks the tokenizer and arithmetic against this file and the proof.
Served from `vendor/ort/` in the repo; two files are enough:

| File (from `node_modules/onnxruntime-web/dist/`) | Bytes | Role |
|---|---|---|
| `ort.wasm.bundle.min.mjs` | 73,054 | WASM-only ESM entry with the Emscripten glue bundled in |
| `ort-wasm-simd-threaded.wasm` | 14,239,897 | the runtime (SIMD; also used single-threaded) |

Unbundled alternative: `ort.wasm.min.mjs` (50,126) + `ort-wasm-simd-threaded.mjs` (24,381) + the same `.wasm`.
Not needed: `ort-wasm-simd-threaded.jsep.wasm` (28.3 MB, WebGPU), `.jspi.wasm` (16.8 MB), `.asyncify.wasm` (26.8 MB),
and the `ort.all.*` / `ort.min.*` entries that pull WebGPU/WebNN in.

```js
import * as ort from './vendor/ort/ort.wasm.bundle.min.mjs';
// object form with `wasm` only: a string prefix (or an `mjs` entry) makes the runtime import a separate
// ort-wasm-simd-threaded.mjs from there instead of the glue bundled into ort.wasm.bundle.min.mjs, which is not shipped
ort.env.wasm.wasmPaths = { wasm: new URL('./vendor/ort/ort-wasm-simd-threaded.wasm', location.href).href };
ort.env.wasm.numThreads = 1;         // GitHub Pages sends no COOP/COEP, so no SharedArrayBuffer, so no threads
const bytes = await (await caches.open('parola-fit-scorer-v1')).match('./models/fit-scorer/model.onnx') /* or fetch */;
const session = await ort.InferenceSession.create(await bytes.arrayBuffer(), { executionProviders: ['wasm'] });
```

It runs inside a Web Worker so a 100 to 300 ms forward pass never blocks the UI, keeps the model in its own Cache like
the audio packs (the service worker never precaches it), and feeds `BigInt64Array` tensors exactly as `score.mjs` does.
The browser's `.wasm` is read from the cache too (`env.wasm.wasmBinary`), so the runtime makes no request of its own.
