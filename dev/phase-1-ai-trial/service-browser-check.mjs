import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
await build({ entryPoints: [path.join(root, 'service-browser-entry.mjs')], bundle: true, format: 'esm', platform: 'browser', outfile: path.join(root, 'assets/service-browser.mjs'), minify: true });
const revisions = ['d'.repeat(40), 'e'.repeat(40)], bodies = [Buffer.alloc(2 * 1024 * 1024, 31), Buffer.alloc(1024 * 1024, 73)], packs = [];
for (const revision of revisions) {
  const folder = path.join(root, 'assets/pack-fixtures', revision); await mkdir(folder, { recursive: true });
  const assets = [];
  for (let i = 0; i < bodies.length; i++) { await writeFile(path.join(folder, `${i}.bin`), bodies[i]); assets.push({ url: `/assets/pack-fixtures/${revision}/${i}.bin`, kind: 'weights', bytes: bodies[i].length, sha256: createHash('sha256').update(bodies[i]).digest('hex') }); }
  packs.push({ schema: 1, id: 'browser-safeguard-test', revision, assets, runtime: { name: 'probe', version: '1.0.0' }, notices: ['Synthetic test bytes; no model weights or learner data'] });
}
const { chromium } = await import(pathToFileURL(process.env.PAROLA_TRIAL_PLAYWRIGHT || '/tmp/parola-grammar-tools/node_modules/playwright/index.mjs'));
const browser = await chromium.launch({ channel: 'chrome', headless: true }), context = await browser.newContext(), page = await context.newPage();
const requests = []; page.on('request', r => { if (r.url().includes('/pack-fixtures/')) requests.push(r.url()); });
try {
  await page.goto('http://127.0.0.1:8132/quality.html');
  const checks = await page.evaluate(async ([old, next]) => {
    const { createPackManager } = await import('/assets/service-browser.mjs'); const manager = createPackManager(); const phases = [];
    const installed = await manager.install(old, { onProgress: p => phases.push(p) });
    if (installed.readiness.writtenGeneration) throw Error('Assets falsely claim runtime readiness');
    const corrupt = structuredClone(next); corrupt.assets[1].sha256 = '0'.repeat(64); let corruptionRejected = false;
    try { await manager.install(corrupt); } catch { corruptionRejected = true; }
    if (!corruptionRejected || (await manager.active(old.id)).revision !== old.revision) throw Error('Replacement failed to preserve the old pack');
    const controller = new AbortController(); let cancellationRejected = false;
    try { await manager.install(next, { signal: controller.signal, onProgress(p) { if (p.phase === 'verified') controller.abort(); } }); }
    catch (error) { cancellationRejected = error.name === 'AbortError'; }
    const ready = await manager.install(next, { async probe({ pack, response }) { const asset = await response(pack.assets[0].url); if (!asset || (await asset.blob()).size !== pack.assets[0].bytes) throw Error('Probe has no verified files'); return { written: true, speech: false, modelRevision: pack.revision, runtimeVersion: pack.runtime.version }; } });
    return { corruptionRejected, cancellationRejected, oldPackPreserved: true, resumed: true, phases, readiness: ready.readiness };
  }, packs);
  await context.setOffline(true);
  checks.offlineRead = await page.evaluate(async pack => { const { createPackManager } = await import('/assets/service-browser.mjs'); const manager = createPackManager(); await manager.active(pack.id, { verify: true }); return (await (await manager.response(pack.id, pack.assets[1].url)).blob()).size === pack.assets[1].bytes; }, packs[1]);
  checks.actualDownloadRequests = requests.length;
  const report = { testedAt: new Date().toISOString(), browser: await page.evaluate(() => navigator.userAgent), environment: 'Real Chrome CacheStorage, synthetic3MiB files, actual HTTP streams; runtime probe is a test callback, not model inference', checks };
  await mkdir(path.join(root, 'measurements'), { recursive: true }); await writeFile(path.join(root, 'measurements/service-browser.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
