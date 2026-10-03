#!/usr/bin/env node
// Real service-worker installation, failed update and offline-resume checks.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadPlaywright, launchBrowser, contextOptions, boot, gotoRoute, reloadApp } from './lib.mjs';

const actualWorker = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const currentVersion = actualWorker.match(/const VERSION = '([^']+)'/)[1];
const oldWorker = `self.addEventListener('install',e=>e.waitUntil(caches.open('parola-v5-adaptive').then(c=>c.put('./old-build-marker',new Response('old'))).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`;
let workerSource = oldWorker;
let broken = false,workingVersion=currentVersion;
const mime = { '.js': 'text/javascript', '.mjs':'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const name = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  res.setHeader('Cache-Control', 'no-store');
  if (name === 'sw.js') { res.setHeader('Content-Type', mime['.js']); res.end(workerSource); return; }
  if (broken && name === 'css/adaptive.css') { res.statusCode = 503; res.end('Simulated interrupted deployment'); return; }
  const file = path.resolve(ROOT, name);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const { chromium, devices } = await loadPlaywright();
const browser = await launchBrowser(chromium);
const context = await browser.newContext(contextOptions(devices['iPhone 13'], { serviceWorkers: 'allow', reducedMotion: 'reduce' }));
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const results = [];
const check = async (name, action) => { await action(); results.push({ name, ok: true }); console.log('PASS', name); };
async function updateWorker() {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const terminal = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker update timed out')), 30000);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker.addEventListener('statechange', () => {
          if (['activated', 'redundant'].includes(worker.state)) { clearTimeout(timeout); resolve(worker.state); }
        });
      }, { once: true });
    });
    await registration.update(); return terminal;
  });
}
try {
  await check('early optional runtime opt-in persists before first worker control',async()=>{
    const earlyContext=await browser.newContext(contextOptions(devices['iPhone 13'],{serviceWorkers:'allow',reducedMotion:'reduce'}));
    try{
      await earlyContext.addInitScript(()=>{
        window.__registerWorker=navigator.serviceWorker.register.bind(navigator.serviceWorker);
        navigator.serviceWorker.register=()=>new Promise(()=>{});
      });
      const early=await earlyContext.newPage();await boot(early,base);
      const loaded=await early.evaluate(async()=>{
        if(navigator.serviceWorker.controller)throw Error('Early-import test is already controlled');
        const api=await import('./js/learning/assistant.js'),runtime=await api.loadAssistantRuntime();
        return {exportType:typeof runtime.CreateMLCEngine,enabled:api.assistantState().enabled};
      });
      assert.deepEqual(loaded,{exportType:'function',enabled:false});
      workerSource=actualWorker;
      await early.evaluate(async()=>{
        await window.__registerWorker('./sw.js');await navigator.serviceWorker.ready;
        if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      });
      await earlyContext.setOffline(true);const cold=await earlyContext.newPage();await boot(cold,base);
      assert.equal(await cold.evaluate(async()=>typeof(await(await import('./js/learning/assistant.js')).loadAssistantRuntime()).CreateMLCEngine),'function');
    }finally{workerSource=oldWorker;await earlyContext.close();}
  });
  await boot(page, base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await check('an existing installation upgrades its complete offline shell', async () => {
    assert((await page.evaluate(() => caches.keys())).includes('parola-v5-adaptive'));
    await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      store.markLearned('v:essere', 'verb'); store.addToList('bank', 'v:essere');
      await store.saveNow();
    });
    workerSource = actualWorker;
    assert.equal(await updateWorker(), 'activated');
    const keys = await page.evaluate(() => caches.keys());
    assert(!keys.includes('parola-v5-adaptive')); assert(keys.includes(currentVersion));
    assert(await page.evaluate(async () => !!(await caches.match('./js/learning/journey.js'))));
    assert(await page.evaluate(async () => !!(await caches.match('./css/journey.css'))));
  });
  await check('a hash-identical update reuses every required asset without network downloads',async()=>{
    workingVersion=currentVersion+'-reuse-test';workerSource=actualWorker.replace(currentVersion,workingVersion);
    assert.equal(await updateWorker(),'activated');
    const stats=await page.evaluate(async version=>(await (await caches.open(version)).match('./__shell_integrity__')).json(),workingVersion);
    assert.equal(stats.stats.fetched,0);assert(stats.stats.reused>100);
  });
  await check('a corrupt cached asset is rejected offline and repaired when online',async()=>{
    await page.evaluate(async version=>{const cache=await caches.open(version);await cache.put('./css/adaptive.css',new Response('truncated'));},workingVersion);
    await context.setOffline(true);
    const status=await page.evaluate(async()=>(await fetch('./css/adaptive.css')).status);assert.equal(status,503);
    await context.setOffline(false);
    const repaired=await page.evaluate(async()=>(await fetch('./css/adaptive.css')).text());assert.equal(repaired,fs.readFileSync(path.join(ROOT,'css/adaptive.css'),'utf8'));
  });
  await check('optional self-hosted assistant runtime survives a cold offline import',async()=>{
    const files=JSON.parse(actualWorker.match(/const ASSISTANT_RUNTIME_FILES = (\{.*\});/)[1]),asset=Object.keys(files)[0];
    assert.equal(await page.evaluate(async asset=>typeof (await import(asset)).CreateMLCEngine,asset),'function');
    await context.setOffline(true);const offline=await context.newPage();await offline.goto(base);await offline.waitForSelector('#view');
    assert.equal(await offline.evaluate(async asset=>typeof (await import(asset)).CreateMLCEngine,asset),'function');
    await offline.close();await context.setOffline(false);
  });
  await check('an incomplete update cannot replace the working offline worker', async () => {
    broken = true; workerSource = actualWorker.replace(currentVersion, currentVersion + '-incomplete-test').replace(/(\"\.\/css\/adaptive\.css\":\")[a-f0-9]{64}/, '$1'+'0'.repeat(64));
    assert.equal(await updateWorker(), 'redundant');
    assert((await page.evaluate(() => caches.keys())).includes(workingVersion));
  });
  await check('course and lesson load offline while old learned items remain intact', async () => {
    await context.setOffline(true);
    await reloadApp(page);
    await gotoRoute(page, '/course');
    assert(await page.locator('#path-title').isVisible());
    assert(await page.evaluate(async () => { const { store } = await import('./js/store.js'); return store.isLearned('v:essere') && store.inList('bank', 'v:essere'); }));
    await gotoRoute(page, '/learn/verb/v:mangiare?chapter=present');
    for (let i=0; i<10 && await page.locator('[data-journey]').getAttribute('data-phase') === 'teach'; i++) await page.locator('[data-continue]').click();
    if (await page.locator('[data-choice]').count()) await page.locator('[data-choice]').first().click();
    else { await page.locator('[data-answer]').fill('sbagliato'); await page.locator('[data-check]').click(); }
    await page.locator('[data-journey][data-phase="feedback"]').waitFor();
  });
  await check('an offline answer and exact feedback resume after reload without duplicate XP', async () => {
    const before = await page.evaluate(async () => { const { store } = await import('./js/store.js'); await store.saveNow(); return { count: Object.keys(store.learning.events).length, xp: store.current.stats.xp, id: store.learning.session.ui.questionId }; });
    await reloadApp(page);
    const after = await page.evaluate(async () => { const { store } = await import('./js/store.js'); return { count: Object.keys(store.learning.events).length, xp: store.current.stats.xp, id: store.learning.session.ui.questionId }; });
    assert.deepEqual(after, before); assert(before.count > 0);
    assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'feedback');
    assert.deepEqual(errors, []);
  });
  fs.writeFileSync(path.join(ROOT, 'tests/report-offline.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(`${results.length} offline/update checks passed.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
