#!/usr/bin/env node
// Real service-worker upgrade, offline grammar navigation, persisted UI state,
// and a stored v3 profile migrating to v5 without losing earlier learning.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, loadPlaywright, launchBrowser, contextOptions, boot, gotoRoute, reloadApp} from './lib.mjs';

const siteRoot=path.resolve(ROOT,process.env.SITE_ROOT || '.');
const actualWorker=fs.readFileSync(path.join(siteRoot,'sw.js'),'utf8');
const currentVersion=actualWorker.match(/const VERSION = '([^']+)'/)?.[1];
assert(currentVersion,'The app service worker needs a named cache version');
let workerSource=`self.addEventListener('install',e=>e.waitUntil(caches.open('parola-grammar-previous').then(c=>c.put('./previous-build-marker',new Response('old'))).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`;
let failInstall=false;
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.m4a':'audio/mp4','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:8173');
  const name=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  res.setHeader('Cache-Control','no-store');
  if(name==='sw.js'){res.setHeader('Content-Type',mime['.js']);res.end(workerSource);return;}
  if(failInstall&&name==='data/course-v2/A2.json'){res.statusCode=503;res.end('Simulated interrupted install');return;}
  const file=path.resolve(siteRoot,name);
  if(!file.startsWith(siteRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise((resolve,reject)=>server.once('error',reject).listen(8173,'127.0.0.1',resolve));
const base='http://127.0.0.1:8173/';
const {chromium,devices}=await loadPlaywright();
const browser=await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'],{serviceWorkers:'allow',reducedMotion:'reduce'}));
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{await fn();console.log('PASS',name);};
async function updateWorker(){
 return page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.getRegistration();
  if(!registration)throw Error('No service-worker registration');
  const terminal=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Worker update timed out')),30000);
   registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker.addEventListener('statechange',()=>{
     if(['activated','redundant'].includes(worker.state)){clearTimeout(timer);resolve(worker.state);}
    });
   },{once:true});
  });
  await registration.update();return terminal;
 });
}
async function snapshot(){
 return page.evaluate(async()=>{
  const {store}=await import('./js/store.js');
  await store.saveNow();
  return {
   version:store.learning.version,
   learned:store.learnedIds().sort(),
   casa:store.getItem('w:casa|noun'),
   essere:store.getItem('v:essere'),
   completions:store.learning.completions,
   xp:store.current.stats.xp,
   bank:[...store.lists.bank.items].sort(),
   session:store.learning.session,
  };
 });
}
try{
 await boot(page,base);
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await check('A persisted v3 vocabulary/course profile is migrated without losing progress',async()=>{
  await page.evaluate(async()=>{
   const {store}=await import('./js/store.js');
   store.setSetting('tts',false);
   store.markLearned('w:casa|noun','word');
   store.markLearned('v:essere','verb');
   if(!store.setCompletion('w:casa|noun',{checked:true}))throw Error('Could not save word completion');
   store.recordAnswer('w:casa|noun',true);
   store.addToList('bank','w:casa|noun');
   store.addToList('bank','v:essere');
   await store.saveNow();
  });
  await gotoRoute(page,'/learn/session?start=together');
  const before=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js');
   const session=store.learning.session;
   if(!session?.course)throw Error('Combined course session did not start');
   store.learning.version=3;
   store.save();await store.saveNow();
   return {version:3,learned:store.learnedIds().sort(),casa:store.getItem('w:casa|noun'),essere:store.getItem('v:essere'),completions:store.learning.completions,xp:store.current.stats.xp,bank:[...store.lists.bank.items].sort(),session};
  });
  assert(before.learned.includes('w:casa|noun'));
  assert(before.learned.includes('v:essere'));
  assert(before.bank.includes('w:casa|noun'));
  assert(before.xp>0);
  assert(Object.keys(before.completions).length>0);
  await gotoRoute(page,'/home');
  workerSource=actualWorker;
  assert.equal(await updateWorker(),'activated');
  await reloadApp(page);
  const after=await snapshot();
  assert.equal(after.version,6);
  for(const field of ['learned','casa','essere','completions','xp','bank'])assert.deepEqual(after[field],before[field],`Migration lost ${field}`);
  assert.equal(after.session?.id,before.session.id);
  assert.deepEqual(after.session?.course,before.session.course);
 });
 await check('The real updated worker caches every grammar level and survives an interrupted later update',async()=>{
  const keys=await page.evaluate(()=>caches.keys());
  assert(keys.includes(currentVersion));assert(!keys.includes('parola-grammar-previous'));
  const cached=await page.evaluate(async()=>{
   const cache=await caches.open((await caches.keys()).find(k=>k.startsWith('parola-v')));
   return Promise.all(['A1','A2','B1','B2','C1','C2'].map(async level=>{
    const response=await cache.match('./data/grammar-course/'+level+'.json');
    return {level,status:response?.status,pack:response?await response.json():null};
   }));
  });
  for(const item of cached){assert.equal(item.status,200,item.level);assert.equal(item.pack?.level,item.level);assert(item.pack.units?.length>=5);}
  failInstall=true;
  // A changed pack must be fetched; unchanged hashes are intentionally reused.
  workerSource=actualWorker.replace(currentVersion,currentVersion+'-incomplete-test').replace(/const ASSET_HASHES = (\{.*\});/,(_,raw)=>{const hashes=JSON.parse(raw);hashes['./data/course-v2/A2.json']='0'.repeat(64);return 'const ASSET_HASHES = '+JSON.stringify(hashes)+';';});
  assert.equal(await updateWorker(),'redundant');
  assert((await page.evaluate(()=>caches.keys())).includes(currentVersion));
  failInstall=false;
  workerSource=actualWorker;
 });
 await check('New course packs and downloaded audio remain usable offline, including byte-range playback',async()=>{
  const count=await page.evaluate(async()=>{const cache=await caches.open((await caches.keys()).find(k=>k.startsWith('parola-v')));let count=0;for(const level of ['Foundations','A1','A2','B1','B2','C1','C2']){if(!(await cache.match('./data/course-v2/'+level+'.json')))throw Error('Missing '+level);count++;}return count;});
  assert.equal(count,7);
  const asset=await page.evaluate(async()=>{const {loadCourseAudio,downloadUnitAudio}=await import('./js/learning/course-v2-media.js');const manifest=await loadCourseAudio(),asset=manifest.assets[0];if(!asset)throw Error('Missing bundled audio');await downloadUnitAudio(manifest,asset.unitId);return asset;});
  workerSource=actualWorker.replace(currentVersion,currentVersion+'-successful-test');
  assert.equal(await updateWorker(),'activated');
  assert((await page.evaluate(()=>caches.keys())).includes('parola-course-audio-v2'),'A later shell update must preserve optional downloads');
  await context.setOffline(true);
  const range=await page.evaluate(async src=>{const r=await fetch(src,{headers:{Range:'bytes=0-63'}});return {status:r.status,bytes:(await r.arrayBuffer()).byteLength,range:r.headers.get('content-range')};},asset.src);
  assert.equal(range.status,206);assert.equal(range.bytes,64);assert.match(range.range,/^bytes 0-63\//);
  await context.setOffline(false);
 });
 await check('All seven new course stages open from the installed cache offline',async()=>{
  await context.setOffline(true);
  await reloadApp(page);
  await gotoRoute(page,'/course');
  assert(await page.locator('.course-unit').count()>=3);
  const first=await page.evaluate(async()=>{
   const {grammarCourse}=await import('./js/learning/grammar-course.js');
   return Object.fromEntries(grammarCourse.levels.map(l=>[l.level,l.units[0].lessons[0].id]));
  });
  assert.deepEqual(Object.keys(first),['Foundations','A1','A2','B1','B2','C1','C2']);
  for(const [level,id] of Object.entries(first)){
   await gotoRoute(page,'/learn/grammar/'+id);
   assert.equal(await page.locator('[data-course-lesson]').count(),1,`${level} ${id} offline`);
  }
 });
 await check('Offline grammar feedback survives reload without duplicate XP or attempts',async()=>{
  await gotoRoute(page,'/learn/grammar/b1-background-event');
  await page.locator('[data-grammar-next]').click();
  const q=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js');
   const {grammarLesson}=await import('./js/learning/grammar-course.js');
   const {currentGrammarQuestion}=await import('./js/learning/grammar-journey.js');
   const session=store.learning.session;return currentGrammarQuestion(grammarLesson(session.entryId),session);
  });
  assert.equal(q.format,'choice');
  await page.locator(`[data-choice="${q.options.indexOf(q.answer)}"]`).click();
  assert.equal(await page.locator('[data-feedback-state="correct"]').count(),1);
  const before=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js');await store.saveNow();
   return {events:Object.keys(store.learning.events).length,xp:store.current.stats.xp,questionId:store.learning.session.grammar.questionId,result:store.learning.session.grammar.result};
  });
  await reloadApp(page);
  const after=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js');
   return {events:Object.keys(store.learning.events).length,xp:store.current.stats.xp,questionId:store.learning.session.grammar.questionId,result:store.learning.session.grammar.result};
  });
  assert.deepEqual(after,before);
  assert.equal(await page.locator('[data-feedback-state="correct"]').count(),1);
 });
 await check('An offline typed grammar draft resumes exactly after reload',async()=>{
  await page.locator('[data-grammar-next]').click();
  await page.locator('[data-grammar-next]').click();
  const q=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js');
   const {grammarLesson}=await import('./js/learning/grammar-course.js');
   const {currentGrammarQuestion}=await import('./js/learning/grammar-journey.js');
   const session=store.learning.session;return currentGrammarQuestion(grammarLesson(session.entryId),session);
  });
  assert.equal(q.format,'type');
  await page.locator('[data-grammar-input]').fill('Una bozza da conservare');
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});
  const before=await page.evaluate(async()=>{const {store}=await import('./js/store.js');return {questionId:store.learning.session.grammar.questionId,draft:store.learning.session.grammar.draft,events:Object.keys(store.learning.events).length};});
  await reloadApp(page);
  const after=await page.evaluate(async()=>{const {store}=await import('./js/store.js');return {questionId:store.learning.session.grammar.questionId,draft:store.learning.session.grammar.draft,events:Object.keys(store.learning.events).length};});
  assert.deepEqual(after,before);
  assert.equal(await page.locator('[data-grammar-input]').inputValue(),'Una bozza da conservare');
 });
 await check('New-course feedback and drafts also survive an offline reload',async()=>{
  const id=await page.evaluate(async()=>{const {grammarCourse,loadGrammarStage,loadGrammarLesson}=await import('./js/learning/grammar-course.js'),{createCourseSession}=await import('./js/learning/course-v2-engine.js'),{store}=await import('./js/store.js');await loadGrammarStage('A1');const selected=grammarCourse.lessons.find(l=>l.steps.some(s=>s.kind==='question'&&s.format==='type'));const l=await loadGrammarLesson(selected.id);const session=createCourseSession(l);session.courseV2.stepIndex=l.steps.findIndex(s=>s.kind==='question'&&s.format==='type');store.saveLearningSession(session);await store.saveNow();return l.id;});
  await gotoRoute(page,'/learn/grammar/'+id);
  await page.locator('[data-course-input]').fill('La bozza offline');
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});
  await reloadApp(page);assert.equal(await page.locator('[data-course-input]').inputValue(),'La bozza offline');
  const answer=await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{grammarLesson}=await import('./js/learning/grammar-course.js'),{currentCourseStep}=await import('./js/learning/course-v2-engine.js');const s=store.learning.session;return currentCourseStep(grammarLesson(s.entryId),s).step.answer;});
  await page.locator('[data-course-input]').fill(answer);await page.locator('[data-check-course]').click();
  const before=await snapshot();await reloadApp(page);const after=await snapshot();
  assert.equal(after.xp,before.xp);assert.deepEqual(after.session.courseV2.result,before.session.courseV2.result);assert.equal(await page.locator('[data-feedback-state="correct"]').count(),1);
 });
 assert.deepEqual(errors,[]);
 console.log('7 grammar offline/update/migration checks passed.');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
