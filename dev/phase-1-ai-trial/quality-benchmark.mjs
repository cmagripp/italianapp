// Actual free model generation, not a canned conversation test double.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(process.env.PAROLA_TRIAL_PLAYWRIGHT || '/tmp/parola-grammar-tools/node_modules/playwright/index.mjs'));
const output = process.argv.find(a => a.startsWith('--output='))?.slice(9) || 'quality-grounded.json';
const selected = process.argv.find(a => a.startsWith('--models='))?.slice(9)?.split(',') || ['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3.5-4B-q4f16_1-MLC'];
const suite = process.argv.find(a => a.startsWith('--suite='))?.slice(8) || 'development';
await mkdir(path.join(root, 'measurements'), { recursive: true });
const context = await chromium.launchPersistentContext(path.join(root, suite === 'heldout' ? 'measurements/quality-phi-heldout-profile' : 'measurements/quality-profile'), { channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'], viewport: { width: 1000, height: 800 } });
const page = context.pages()[0]; const requests = [], errors = [];
page.on('request', r => requests.push(r.url())); page.on('pageerror', e => errors.push(String(e)));
const report = { testedAt: new Date().toISOString(), suite, environment: 'MacBookPro18,4 Apple M1 Max32GB macOS26.4 headed Chrome; desktop only', runtime: 'WebLLM0.2.85', runs: [], errors, requests };
if (suite === 'heldout') report.frozenCaseSourceSha256 = createHash('sha256').update(await readFile(path.join(root, 'quality-heldout.mjs'))).digest('hex');
report.provisionedManifest = JSON.parse(await readFile(path.join(root, 'assets/manifest.json')));
const bound = setTimeout(() => { report.boundExceeded = true; context.close().catch(() => {}); }, 15 * 60 * 1000);
const save = () => writeFile(path.join(root, 'measurements', path.basename(output)), JSON.stringify(report, null, 2));
try {
  await page.goto('http://127.0.0.1:8132/quality.html' + (suite === 'heldout' ? '?suite=heldout' : ''));
  await page.evaluate(async () => { for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister(); await caches.delete('parola-quality-probe-shell-v1'); await navigator.serviceWorker.register('/quality-sw.js'); await navigator.serviceWorker.ready; });
  await page.reload(); await page.waitForFunction(() => !!window.quality);
  report.browser = await page.evaluate(async () => { const a = await navigator.gpu.requestAdapter(); return { userAgent: navigator.userAgent, adapter: a.info, features: [...a.features], deviceMemory: navigator.deviceMemory }; });
  for (const modelId of selected) {
    for (const size of (process.argv.find(a => a.startsWith('--contexts='))?.slice(11)?.split(',').map(Number) || [2048, 4096])) {
      console.log(`Load ${modelId} context ${size}`);
      const run = { modelId, context: size, rows: [] }; report.runs.push(run);
      try {
        run.load = await page.evaluate(([id, size]) => window.quality.load(id, size), [modelId, size]);
        const cases = await page.evaluate(() => window.quality.cases);
        for (const test of cases) for (const variant of (process.argv.find(a => a.startsWith('--variants='))?.slice(11)?.split(',') || ['plain', 'grounded'])) {
          const row = await page.evaluate(([test, variant]) => window.quality.run(test, variant), [test, variant]); run.rows.push(row);
          console.log(`${test.id} ${variant}: ${row.ok ? 'structural pass' : row.error}`); await save();
        }
        await page.evaluate(() => window.quality.unload());
        // Warm-cache, fresh worker and network disabled; desktop cold reopen.
        await context.setOffline(true); await page.reload(); await page.waitForFunction(() => !!window.quality);
        run.offline = await page.evaluate(async ([id, size]) => { const load = await window.quality.load(id, size); const row = await window.quality.run({ id: 'offline-new-turn', level: 'A1', text: 'Oggi vorrei un tè e una passeggiata.' }); return { load, row }; }, [modelId, size]);
        await context.setOffline(false); await page.evaluate(() => window.quality.unload());
      } catch (error) { run.error = String(error.message || error); await context.setOffline(false); await page.reload(); await page.waitForFunction(() => !!window.quality); }
      await save();
    }
  }
} finally { clearTimeout(bound); await save(); await context.close(); }
console.log(JSON.stringify(report.runs.map(r => ({ model: r.modelId, context: r.context, error: r.error, rows: r.rows.length, rejected: r.rows.filter(x => !x.ok).length, offline: r.offline?.row?.ok })), null, 2));
