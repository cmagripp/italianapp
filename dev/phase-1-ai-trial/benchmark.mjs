// Run after prepare.mjs and server.mjs. Real browser/model inference; no fake runtime.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const playwright = await import(pathToFileURL(process.env.PAROLA_TRIAL_PLAYWRIGHT || '/tmp/parola-grammar-tools/node_modules/playwright/index.mjs'));
const headed = process.env.PAROLA_TRIAL_HEADLESS !== '1';
const outputFile = process.argv.find(a => a.startsWith('--output='))?.slice(9) || 'desktop-browser.json';
await mkdir(path.join(root, 'measurements'), { recursive: true });
const context = await playwright.chromium.launchPersistentContext(path.join(root, 'measurements/browser-profile'), { channel: 'chrome', headless: !headed,
  args: ['--enable-unsafe-webgpu', '--use-fake-ui-for-media-stream'], viewport: { width: 1000, height: 900 } });
const page = context.pages()[0]; const requests = [], errors = [];
page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.goto('http://127.0.0.1:8132/'); await page.waitForFunction(() => !!window.trial?.manifest);
// This origin belongs only to the disposable trial. Ensure revised trial runtimes cannot be hidden by an earlier development cache.
await page.evaluate(async () => { for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister(); for (const key of await caches.keys()) await caches.delete(key); });
await page.reload(); await page.waitForFunction(() => !!window.trial?.manifest);
const ids = await page.evaluate(() => window.trial.manifest.models.map(m => m.model_id));
const selection = process.argv.find(a => a.startsWith('--model='))?.slice(8); const results = [];
try {
  for (const id of ids.filter(id => !selection || id.includes(selection))) {
    console.log(`Actual browser inference: ${id}`);
    try {
      await page.evaluate(() => { window.trial.rows.length = 0; });
      await page.click('#probe');
      const install = await page.evaluate(id => window.trial.install(id), id);
      const loaded = await page.evaluate(id => window.trial.load(id), id);
      await page.evaluate(async () => { await window.trial.smoke(11); });
      let fixture;
      if (process.env.PAROLA_TRIAL_FIXTURE) fixture = await page.evaluate(url => window.trial.fixture(url, { reference: 'Ieri io andare al mercato, ma non comprare niente.', history: [] }), process.env.PAROLA_TRIAL_FIXTURE);
      const report = await page.evaluate(() => window.trial.report());
      results.push({ id, install, loaded, fixture, report, requests: requests.splice(0), errors: errors.splice(0) });
      // A fresh page/worker after network disable tests actual cache availability.
      await page.evaluate(() => window.trial.unload()); await context.setOffline(true); await page.reload(); await page.waitForFunction(() => !!window.trial?.manifest);
      const cold = await page.evaluate(async id => { const loaded = await window.trial.load(id); const row = await window.trial.turn('Ciao! Vorrei un tè, per favore.', { history: [] }); return { loaded, row }; }, id);
      results.at(-1).coldOfflineReopen = cold;
      await context.setOffline(false); await page.evaluate(() => window.trial.unload());
    } catch (error) { results.push({ id, error: String(error.message || error), partialReport: await page.evaluate(() => window.trial.report()).catch(() => null), requests: requests.splice(0), errors: errors.splice(0) }); await context.setOffline(false); await page.reload(); await page.waitForFunction(() => !!window.trial?.manifest); }
    await writeFile(path.join(root, 'measurements', path.basename(outputFile)), JSON.stringify({ testedAt: new Date().toISOString(), context: 'macOS Chrome on M1 Max; not simulated or physical phone performance', headed, results }, null, 2));
  }
} finally { await context.close(); }
console.log(JSON.stringify(results.map(r => ({ id: r.id, error: r.error, summary: r.report?.summaries, coldOfflineReopen: r.coldOfflineReopen?.row?.ok })), null, 2));
