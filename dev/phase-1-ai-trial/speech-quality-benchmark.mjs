import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { wordErrorRate } from './core.mjs';
const root = path.dirname(fileURLToPath(import.meta.url)), folder = path.join(root, 'assets/fixtures/programme');
const cases = [
  { id: 'infinitive-errors', reference: 'Ieri io andare al mercato, ma non comprare niente.' },
  { id: 'auxiliary-error', reference: 'Ieri ho andato al mercato, ma non ho comprato niente.' },
  { id: 'quantity-negation-date', reference: 'Non voglio tre biglietti. Ne voglio due, per il diciassette novembre.' },
  { id: 'agreement-error', reference: 'La mia amico è simpatico. Si chiama Carlo.' },
  { id: 'wordfinding', reference: 'Come si chiama la persona che vive con me in un appartamento? Non è la mia famiglia.' },
];
await mkdir(folder, { recursive: true });
for (const test of cases) {
  for (const [command, args] of [['say', ['-v', 'Alice', '-o', path.join(folder, `${test.id}.aiff`), test.reference]],
    ['afconvert', ['-f', 'WAVE', '-d', 'LEI16', path.join(folder, `${test.id}.aiff`), path.join(folder, `${test.id}.wav`)]]]) {
    const result = spawnSync(command, args); if (result.status !== 0) throw Error(`${command} failed: ${result.stderr}`);
  }
}
const { chromium } = await import(pathToFileURL(process.env.PAROLA_TRIAL_PLAYWRIGHT || '/tmp/parola-grammar-tools/node_modules/playwright/index.mjs'));
const context = await chromium.launch({ channel: 'chrome', headless: false }), page = await context.newPage();
const report = { testedAt: new Date().toISOString(), source: 'synthetic macOS Alice, not human learner audio', humanLearnerRecording: false,
  environment: 'Mac M1 Max32GB, macOS26.4, headedChrome, Transformers.js4.3.0 q8 WASM one thread; ASR isolated', cases, models: [], requests: [] };
page.on('request', r => report.requests.push(r.url()));
try {
  await page.goto('http://127.0.0.1:8132/quality.html');
  // Existing quality page creates an unloaded language worker only; no LLM or
  // TTS model is loaded in this isolated ASR quality comparison.
  await page.evaluate(() => {
    const worker = new Worker('/assets/asr-worker.mjs', { type: 'module' }); let sequence = 0; const pending = new Map();
    worker.onmessage = ({ data }) => { const item = pending.get(data.id); if (!item) return; pending.delete(data.id); data.error ? item.reject(Error(data.error)) : item.resolve(data.result); };
    window.speechProbe = { call(op, payload) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); worker.postMessage({ id, op, payload }); }); } };
  });
  for (const model of ['whisper-tiny', 'whisper-base']) {
    const row = { model, revision: model === 'whisper-tiny' ? 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7' : '1846881b6b3a3024392c1eea3ad983695bc23925', rows: [] };
    report.models.push(row); row.load = await page.evaluate(model => window.speechProbe.call('load', { model }), model);
    for (const test of cases) {
      const result = await page.evaluate(async id => { const response = await fetch(`/assets/fixtures/programme/${id}.wav`); const audioContext = new AudioContext({ sampleRate: 16000 }); const decoded = await audioContext.decodeAudioData(await response.arrayBuffer()); const audio = decoded.getChannelData(0); await audioContext.close(); return window.speechProbe.call('transcribe', { audio }); }, test.id);
      row.rows.push({ ...test, ...result, wer: wordErrorRate(test.reference, result.recognizedText) }); console.log(`${model} ${test.id}: ${result.recognizedText}`);
    }
  }
} finally {
  await mkdir(path.join(root, 'measurements'), { recursive: true });
  await writeFile(path.join(root, 'measurements/speech-quality.json'), JSON.stringify(report, null, 2)); await context.close();
}
