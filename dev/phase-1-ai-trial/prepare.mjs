import { build } from 'esbuild';
import { prebuiltAppConfig } from '@mlc-ai/web-llm';
import { mkdir, readFile, writeFile, readdir, copyFile, rename, stat, statfs } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MODEL_IDS } from './core.mjs';
const root = path.dirname(fileURLToPath(import.meta.url)), assetRoot = path.join(root, 'assets');
const pins = JSON.parse(await readFile(path.join(root, 'pins.json')));
const requested = process.argv.find(a => a.startsWith('--models='))?.split('=')[1]?.split(',') || ['baseline'];
const aliases = { baseline: MODEL_IDS[0], gemma: MODEL_IDS[1], qwen35: MODEL_IDS[2], qwen17: 'Qwen3-1.7B-q4f16_1-MLC', qwen2: 'Qwen3.5-2B-q4f16_1-MLC', qwen4: 'Qwen3.5-4B-q4f16_1-MLC', llama3: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', phi4: 'Phi-4-mini-instruct-q4f16_1-MLC' };
const selected = requested.map(id => aliases[id] || id);
const fetchJSON = async url => { const response = await fetch(url); if (!response.ok) throw Error(`${response.status}: ${url}`); return response.json(); };
const shaFile = async file => { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); };
const minimumFreeBytes = Number(process.argv.find(a => a.startsWith('--min-free-gib='))?.slice(15) || 5) * 1024 ** 3;
const assets = [];
async function download(url, relative, expected, expectedBytes = 0) {
  const dest = path.join(assetRoot, relative); await mkdir(path.dirname(dest), { recursive: true });
  let exists = false; try { await stat(dest); exists = !expected || await shaFile(dest) === expected; } catch {}
  if (!exists) { const disk = await statfs(assetRoot); if (disk.bavail * disk.bsize < minimumFreeBytes + expectedBytes) throw Error('Trial disk budget reached; preserve at least five GiB free.'); console.log(`Provision ${relative}`); const response = await fetch(url); if (!response.ok) throw Error(`Download ${response.status}: ${url}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(dest + '.partial'));
    if (expected && await shaFile(dest + '.partial') !== expected) throw Error(`Hash mismatch: ${relative}`);
    await rename(dest + '.partial', dest); }
  const bytes = (await import('node:fs/promises')).stat(dest).then(s => s.size);
  assets.push({ path: `assets/${relative}`, url, bytes: await bytes, sha256: await shaFile(dest) });
}
async function repository(repo, folder, filter, subtree = '') {
  if (!pins.repositories[repo]) throw Error(`No reviewed immutable revision for ${repo}`);
  const info = await fetchJSON(`https://huggingface.co/api/models/${repo}/revision/${pins.repositories[repo]}`), revision = info.sha;
  const files = await fetchJSON(`https://huggingface.co/api/models/${repo}/tree/${revision}${subtree ? '/' + subtree : ''}?recursive=true`);
  for (const file of files.filter(f => f.type === 'file' && filter(f.path))) await download(`https://huggingface.co/${repo}/resolve/${revision}/${file.path}`, `${folder}/${file.path}`, file.lfs?.oid, file.size);
  const originalTerms = repo.includes('/Qwen3') ? 'Apache-2.0 (original Qwen model; preserve conversion attribution)' : repo.includes('/Llama-3.2') ? 'Llama 3.2 Community License and Acceptable Use Policy (original Meta model; retain conversion attribution)' : repo.includes('/Phi-4-mini-instruct') ? 'MIT (Microsoft Phi-4-mini-instruct; preserve original copyright and conversion attribution)' : repo.includes('/gemma3') ? 'Gemma Terms of Use' : repo.startsWith('onnx-community/whisper-') ? 'MIT (Whisper)' : repo === 'rhasspy/piper-voices' ? 'MIT model; voice-specific MODEL_CARD and dataset terms' : null;
  return { repository: repo, revision, license: originalTerms || info.cardData?.license || 'review upstream terms', source: `https://huggingface.co/${repo}/tree/${revision}` };
}
await mkdir(assetRoot, { recursive: true });
for (const entry of ['webllm-entry', 'llm-worker', 'quality-entry', 'asr-worker', 'vad-entry', 'tts-worker']) await build({ entryPoints: [path.join(root, `${entry}.mjs`)], bundle: true, format: 'esm', platform: 'browser', external: ['fs', 'path'], outfile: path.join(assetRoot, `${entry}.mjs`), minify: true,
  plugins: [{ name: 'piper-local-only-trial', setup(builder) { builder.onLoad({ filter: /piper-tts-web\.js$/ }, async ({ path: file }) => ({ contents: (await readFile(file, 'utf8'))
    .replace('const HF_BASE = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main";', 'const HF_BASE = new URL("./models/tts/", self.location.href).href.replace(/\\/$/, "");')
    .replace('ort.env.wasm.numThreads = navigator.hardwareConcurrency;', 'ort.env.wasm.numThreads = 1;'), loader: 'js' })); } }] });
async function copyRuntime(packageRoot, folder) {
  const source = path.join(root, 'node_modules', packageRoot, 'dist');
  await mkdir(path.join(assetRoot, folder), { recursive: true });
  for (const file of (await readdir(source)).filter(f => /^ort-wasm.*\.(mjs|wasm)$/.test(f))) await copyFile(path.join(source, file), path.join(assetRoot, folder, file));
}
const asrORT = '@huggingface/transformers/node_modules/onnxruntime-web';
await copyRuntime(asrORT, 'ort-asr');
await copyRuntime('onnxruntime-web', 'ort-tts');
// VAD may resolve its own ORT version. Copy that exact runtime, never mix WASM and JS versions.
let vadORT = '@ricky0123/vad-web/node_modules/onnxruntime-web';
try { await readdir(path.join(root, 'node_modules', vadORT)); } catch { vadORT = 'onnxruntime-web'; }
await copyRuntime(vadORT, 'ort-vad');
await mkdir(path.join(assetRoot, 'vad'), { recursive: true });
for (const file of ['silero_vad_legacy.onnx', 'silero_vad_v5.onnx', 'vad.worklet.bundle.min.js']) await copyFile(path.join(root, 'node_modules/@ricky0123/vad-web/dist', file), path.join(assetRoot, 'vad', file));
const binary = { sha: pins.binaryRevision };
const models = [];
for (const id of selected) {
  const record = prebuiltAppConfig.model_list.find(m => m.model_id === id); if (!record) throw Error(`Not a compatible WebLLM 0.2.85 candidate: ${id}`);
  const repo = record.model.split('huggingface.co/')[1];
  const provenance = await repository(repo, `models/llm/${id}/resolve/main`, name => !name.startsWith('.') && !name.endsWith('.md'));
  const wasmName = record.model_lib.split('/').at(-1), binaryURL = record.model_lib.replace('/main/', `/${binary.sha}/`);
  await download(binaryURL, `models/llm/${id}/${wasmName}`);
  models.push({ ...record, model: `./models/llm/${id}/resolve/main/`, model_lib: `./models/llm/${id}/${wasmName}`, provenance: { ...provenance, binaryRevision: binary.sha }, role: id === MODEL_IDS[0] ? 'existing resource baseline; free generation is trial-only' : 'challenger' });
}
const asr = await repository('onnx-community/whisper-tiny', 'models/asr/whisper-tiny', name => !name.startsWith('.') && (!name.startsWith('onnx/') || ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'].includes(name)) && !name.endsWith('.md'));
const asrBase = process.argv.includes('--asr-base') ? await repository('onnx-community/whisper-base', 'models/asr/whisper-base', name => !name.startsWith('.') && (!name.startsWith('onnx/') || ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'].includes(name)) && !name.endsWith('.md')) : null;
const tts = await repository('rhasspy/piper-voices', 'models/tts', name => name.endsWith('.onnx') || name.endsWith('.onnx.json') || name.endsWith('MODEL_CARD'), 'it/it_IT/paola/medium');
for (const ext of ['wasm', 'data']) await download(`https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.${ext}`, `piper/piper_phonemize.${ext}`);
const walk = async folder => { for (const entry of await readdir(folder, { withFileTypes: true })) { const full = path.join(folder, entry.name); if (entry.isDirectory()) await walk(full); else if (!full.endsWith('.partial') && full !== path.join(assetRoot, 'manifest.json') && !assets.some(a => path.join(root, a.path) === full)) assets.push({ path: path.relative(root, full), bytes: (await stat(full)).size, sha256: await shaFile(full), source: 'pinned package-lock.json build' }); } };
await walk(assetRoot);
const manifest = { schema: 1, preparedAt: new Date().toISOString(), versions: { webllm: '0.2.85', transformers: '4.3.0', vad: '0.0.31', piperWeb: '1.0.5', piperPhonemize: '1.0.0', ortASR: JSON.parse(await readFile(path.join(root, 'node_modules', asrORT, 'package.json'))).version, ortVAD: JSON.parse(await readFile(path.join(root, 'node_modules', vadORT, 'package.json'))).version, ortTTS: JSON.parse(await readFile(path.join(root, 'node_modules/onnxruntime-web/package.json'))).version }, models, asr, asrBase, tts, assets };
await writeFile(path.join(assetRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Prepared ${models.length} models; ${assets.reduce((n, a) => n + a.bytes, 0).toLocaleString()} local bytes. No production files changed.`);
