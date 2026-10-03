import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url)), fixture = path.join(root, 'assets/fixtures/learner-error-padded.wav');
const { chromium } = await import(pathToFileURL(process.env.PAROLA_TRIAL_PLAYWRIGHT || '/tmp/parola-grammar-tools/node_modules/playwright/index.mjs'));
await mkdir(path.join(root, 'measurements'), { recursive: true });
const context = await chromium.launchPersistentContext(path.join(root, 'measurements/browser-profile'), { channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${fixture}`], viewport: { width: 1000, height: 900 } });
const page = context.pages()[0]; const requests = []; page.on('request', r => requests.push({ url: r.url(), method: r.method() }));
try {
  await page.goto('http://127.0.0.1:8132/'); await page.waitForFunction(() => window.trial?.manifest);
  const id = await page.evaluate(() => window.trial.manifest.models.find(m => m.model_id.startsWith('Qwen3-1.7B'))?.model_id || window.trial.manifest.models[0].model_id);
  await page.evaluate(id => window.trial.install(id), id); await page.evaluate(id => window.trial.load(id), id);
  await page.click('#clear');
  await page.evaluate(() => window.trial.setCaptureSource('simulated-microphone-replaying-synthetic-Alice-fixture'));
  await page.click('#record'); await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Recording;'), null, { timeout: 90000 });
  await page.waitForTimeout(4200); await page.click('#finish'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Editable transcript ready'), null, { timeout: 60000 });
  const beforeSend = await page.evaluate(() => window.trial.rows.length);
  await page.fill('#text', 'Ieri io andare al mercato, ma non comprare niente.');
  await page.click('#manual-send'); await page.waitForFunction(n => window.trial.rows.length > n, beforeSend, { timeout: 120000 });
  await page.click('#start'); await page.waitForFunction(() => window.trial.rows.filter(r => r.mode === 'handsfree').length >= 3, null, { timeout: 240000 });
  await page.click('#stop');
  const report = await page.evaluate(() => window.trial.report());
  if (!report.rows[0]?.transcriptEdited || report.rows[0]?.mode !== 'manual') throw Error('Manual transcript editing was not measured.');
  await writeFile(path.join(root, 'measurements/simulated-microphone.json'), JSON.stringify({ testedAt: new Date().toISOString(), context: 'Mac Chrome real capture API, synthetic fixture supplied by Chromium; not live learner/device microphone', report, requests }, null, 2));
  console.log(JSON.stringify(report.summaries, null, 2));
} catch (error) {
  const report = await page.evaluate(() => window.trial?.report()).catch(() => null);
  await writeFile(path.join(root, 'measurements/simulated-microphone.json'), JSON.stringify({ error: String(error), report, requests }, null, 2)); console.error(String(error)); process.exitCode = 1;
} finally { await page.evaluate(() => window.trial?.unload()).catch(() => {}); await context.close(); }
