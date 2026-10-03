// Actual bundled voice and repeated offline worker reopens; desktop evidence only.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(process.env.PAROLA_TRIAL_PLAYWRIGHT || '/tmp/parola-grammar-tools/node_modules/playwright/index.mjs'));
await mkdir(path.join(root, 'measurements'), { recursive: true });
const context = await chromium.launchPersistentContext(path.join(root, 'measurements/browser-profile'), { channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'], viewport: { width: 1000, height: 900 } });
const page = context.pages()[0], requests = [], errors = [], results = [];
page.on('request', r => requests.push({ url: r.url(), method: r.method() }));
page.on('pageerror', e => errors.push(String(e)));
let cancellation, synthesisCancellation;
try {
  await page.goto('http://127.0.0.1:8132/'); await page.waitForFunction(() => window.trial?.manifest);
  const id = await page.evaluate(() => window.trial.manifest.models.find(m => m.model_id.startsWith('Qwen3-1.7B'))?.model_id || window.trial.manifest.models[0].model_id);
  await page.evaluate(id => window.trial.install(id), id);
  for (let reopen = 0; reopen < 3; reopen++) {
    await context.setOffline(true); await page.reload(); await page.waitForFunction(() => window.trial?.manifest);
    await page.click('#probe');
    const loaded = await page.evaluate(id => window.trial.load(id), id);
    await page.selectOption('#voice', 'piper');
    const speech = await page.evaluate(() => window.trial.speak('Non voglio tre biglietti. Ne voglio due, per il diciassette novembre. Perché?'));
    const fixture = await page.evaluate(() => window.trial.fixture('/assets/fixtures/learner-error.wav', { reference: 'Ieri io andare al mercato, ma non comprare niente.', history: [] }));
    results.push({ reopen: reopen + 1, networkDisabled: true, freshWorkers: true, loaded, speech, fixture });
    if (reopen === 2) {
      synthesisCancellation = await page.evaluate(async () => {
        const original = HTMLMediaElement.prototype.play; let playbackCalls = 0;
        HTMLMediaElement.prototype.play = function (...args) { playbackCalls++; return original.apply(this, args); };
        try {
          const speech = window.trial.speak('Questa frase serve a verificare che fermare la sintesi interrompa la risposta prima che inizi la riproduzione.');
          await new Promise(resolve => setTimeout(resolve, 10)); await window.trial.stop();
          let error = null; try { await speech; } catch (e) { error = e.message; }
          return { error, playbackCalls, noDelayedPlayback: playbackCalls === 0 };
        } finally { HTMLMediaElement.prototype.play = original; }
      });
      cancellation = await page.evaluate(async () => {
        const before = (await window.trial.report()).turns.filter(t => t.role === 'assistant').length;
        const turn = window.trial.turn('Spiega in italiano, con esempi, la differenza tra il passato prossimo e l’imperfetto.');
        let duplicateRejected = false; try { await window.trial.turn('Duplicate send'); } catch (e) { duplicateRejected = e.message === 'A turn is already running.'; }
        await new Promise(resolve => setTimeout(resolve, 100)); const start = performance.now(); await window.trial.stop();
        const cancelled = await turn, after = (await window.trial.report()).turns.filter(t => t.role === 'assistant').length;
        return { stopMs: performance.now() - start, row: cancelled, duplicateRejected, assistantCountBefore: before, assistantCountAfter: after, noLateAssistantCommitted: before === after };
      });
    }
    await page.evaluate(() => window.trial.unload());
  }
} catch (error) { errors.push(String(error)); }
finally {
  const report = await page.evaluate(() => window.trial?.report()).catch(() => null);
  await writeFile(path.join(root, 'measurements/speech-offline.json'), JSON.stringify({ testedAt: new Date().toISOString(), context: 'Mac Chrome M1 Max; local Paola voice playback events; no human listening or phone performance claim', results, cancellation, synthesisCancellation, report, requests, errors }, null, 2));
  await context.setOffline(false); await page.evaluate(() => window.trial?.unload()).catch(() => {}); await context.close();
}
console.log(JSON.stringify({ reopens: results.map(r => ({ reopen: r.reopen, speech: r.speech, fixtureOk: r.fixture.ok })), cancellation, synthesisCancellation, errors }, null, 2));
if (errors.length || results.length !== 3 || results.some(r => !r.fixture.ok) || !cancellation?.noLateAssistantCommitted || !cancellation?.duplicateRejected || !synthesisCancellation?.noDelayedPlayback) process.exitCode = 1;
