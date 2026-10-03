#!/usr/bin/env node
// The previous client really executes its shipped store on the same origin.
// Separate URL paths select source versions; IndexedDB/localStorage remain shared.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {ROOT,loadPlaywright,launchBrowser,contextOptions,boot,reloadApp} from './lib.mjs';

const BASELINE='7eeeb36fee685ee0d7e3abd62f1499d51dee59cb';
const engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium';
const baselineFiles=new Map(),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.m4a':'audio/mp4','.png':'image/png'};
const server=http.createServer((request,response)=>{
 try{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),old=pathname.startsWith('/__baseline-v5/');
  let relative=pathname.slice(old?'/__baseline-v5/'.length:1);if(!relative||relative.endsWith('/'))relative+='index.html';
  if(relative.split('/').some(part=>part==='..')||relative.includes('\\'))throw Error('Invalid path');
  let content;
  if(old){if(!baselineFiles.has(relative))baselineFiles.set(relative,execFileSync('git',['show',`${BASELINE}:${relative}`],{cwd:ROOT,maxBuffer:32*1024*1024,stdio:['ignore','pipe','ignore']}));content=baselineFiles.get(relative);}
  else content=fs.readFileSync(path.join(ROOT,relative));
  response.writeHead(200,{'Content-Type':mime[path.extname(relative)]||'application/octet-stream','Cache-Control':'no-store'});response.end(content);
 }catch{response.writeHead(404);response.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}/`;
const {chromium,webkit}=await loadPlaywright(),browser=engine==='webkit'?await webkit.launch({headless:true}):await launchBrowser(chromium);
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/phase-0-2/current-v5-partial-profile.json',import.meta.url),'utf8'));
const results=[],errors=[];
// WebKit can expose a new factory wrapper on each indexedDB access. Override
// the prototype, then assert the actual persisted backend in each fixture.
const blockIDB=()=>{Object.defineProperty(IDBFactory.prototype,'open',{configurable:true,writable:true,value(){throw new DOMException('Test: storage blocked','SecurityError');}});};
const state=page=>page.evaluate(async()=>structuredClone((await import('./js/store.js')).store.current));
const stored=(page,name,id)=>page.evaluate(async({name,id})=>{
 const database=await new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 const value=await new Promise((resolve,reject)=>{const request=database.transaction('kv','readonly').objectStore('kv').get('profile:'+id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});database.close();return value;
},{name,id});
const backups=page=>page.evaluate(async()=>{
 const {store}=await import('./js/store.js');return {original:JSON.parse(await store.preUpdateBackup()).profile,previous:(await store.previousAppBackups()).map(copy=>({kind:copy.kind,profile:JSON.parse(copy.json).profile}))};
});
const writeOld=(page,label,{mirror=false}={})=>page.evaluate(async({label,mirror})=>{
 const {store}=await import('./js/store.js');store.setSetting('mixedClientLabel',label);
 if(mirror){clearTimeout(store._saveTimer);const raw=store._mirrorPending();store._dirty=false;return {profile:structuredClone(store.current),raw};}
 await store.saveNow();return {profile:structuredClone(store.current)};
},{label,mirror});
const newEvidence=page=>page.evaluate(async()=>{
 const {store}=await import('./js/store.js');
 store.recordLearningAttempt({id:'mixed-v6-review-proof',sessionId:'mixed-v6-review',index:0,objectiveId:'w:casa|noun::word::article',entryId:'w:casa|noun',kind:'word',skill:'article',mode:'recognition',reviewPolicy:'unified-review-v1',outcome:'correct',ok:true,firstAttempt:true,assistance:[],at:Date.now()});
 store.saveLearningSession({...store.learning.session,ui:{...store.learning.session.ui,draft:'new v6 exact draft',feedback:'new v6 exact feedback'},index:7});
 store.setSetting('mixedClientLabel','v6 authoritative');await store.saveNow();return structuredClone(store.current);
});
async function pair({oldFallback=false,newFallback=false,beforeNew}={}){
 const context=await browser.newContext(contextOptions()),old=await context.newPage(),current=await context.newPage();
 for(const page of [old,current])page.on('pageerror',error=>errors.push(error.message));
 if(oldFallback)await old.addInitScript(blockIDB);if(newFallback)await current.addInitScript(blockIDB);
 await boot(old,origin+'__baseline-v5/');
 const original=await old.evaluate(async fixture=>{
  const {store}=await import('./js/store.js');await store.importJSON(JSON.stringify(fixture));store.setSetting('tts',false);await store.saveNow();return structuredClone(store.current);
 },fixture);
 assert.equal(original.learning.version,5,'The historical client runs learning schema 5');
 if(oldFallback)assert(await old.evaluate(id=>!!localStorage.getItem('kv:profile:'+id),original.id),'The real v5 client must actually use its localStorage fallback');
 if(beforeNew)await beforeNew({old,current,original});
 await boot(current,origin);
 if(newFallback)assert(await current.evaluate(id=>!!localStorage.getItem('kv6:profile:'+id),original.id),'The real v6 client must actually use its localStorage fallback');
 return {context,old,current,original};
}
async function check(name,options,test){
 if(process.env.MIXED_FILTER&&!name.toLowerCase().includes(process.env.MIXED_FILTER.toLowerCase()))return;
 const clients=await pair(options);
 try{await test(clients);results.push(name);console.log('PASS',name);}finally{await clients.context.close();}
}
let failure;
try{
 await check('A real v5 draft, history, completion, XP and learner migrate once with an exact verified original',{},async({current,original})=>{
  const now=await state(current),copies=await backups(current);
  assert.equal(now.learning.version,6);assert.equal(now.id,original.id);assert.equal(now.learnerId,original.learnerId);
  for(const key of ['items','lists','custom'])assert.deepEqual(now[key],original[key]);
  assert.equal(now.stats.xp,original.stats.xp);assert.deepEqual(now.learning.completions,original.learning.completions);
  assert.deepEqual(now.learning.session,original.learning.session);assert.deepEqual(Object.keys(now.learning.events),Object.keys(original.learning.events));
  assert.deepEqual(copies.original,original);assert(!copies.previous.some(copy=>JSON.stringify(copy.profile)===JSON.stringify(original)));
  await reloadApp(current);assert.deepEqual((await backups(current)).original,original);
  assert.equal((await stored(current,'italiano-db',original.id)).learning.version,5);
  assert.equal((await stored(current,'italiano-db-v6',original.id)).learning.version,6);
 });
 await check('A late real v5 full-profile write cannot replace v6 evidence, exact cursor, XP or original recovery',{},async({old,current,original})=>{
  const before=await newEvidence(current),late=await writeOld(old,'late old database write');await reloadApp(current);
  const after=await state(current);assert.deepEqual(after.learning,before.learning);assert.equal(after.stats.xp,before.stats.xp);assert.equal(after.settings.mixedClientLabel,'v6 authoritative');
  const copies=await backups(current);assert.deepEqual(copies.original,original);assert(copies.previous.some(copy=>copy.kind==='primary'&&JSON.stringify(copy.profile)===JSON.stringify(late.profile)));
 });
 await check('A late v5 unload mirror stays exportable and cannot override an existing v6 primary',{},async({old,current})=>{
  const before=await newEvidence(current),late=await writeOld(old,'late old unload mirror',{mirror:true});assert(late.raw);
  await reloadApp(current);const after=await state(current);assert.deepEqual(after.learning,before.learning);assert.equal(after.stats.xp,before.stats.xp);
  const copies=await backups(current);assert(copies.previous.some(copy=>copy.kind==='pending'&&JSON.stringify(copy.profile)===JSON.stringify(late.profile)));
  assert.equal(await current.evaluate(()=>localStorage.getItem('it.pendingProfile')),late.raw,'v6 does not consume the old mirror');
 });
 await check('The genuine v6 unload mirror recovers independently while retaining the old v5 mirror',{},async({old,current})=>{
  const oldMirror=await writeOld(old,'held old mirror',{mirror:true});
  const pending=await current.evaluate(async()=>{const {store}=await import('./js/store.js');store.setSetting('mixedClientLabel','v6 pending only');clearTimeout(store._saveTimer);const raw=store._mirrorPending();store._dirty=false;return {raw,profile:structuredClone(store.current)};});
  assert(pending.raw);await reloadApp(current);assert.equal((await state(current)).settings.mixedClientLabel,'v6 pending only');
  assert.equal(await current.evaluate(()=>localStorage.getItem('it.pendingProfile')),oldMirror.raw);
  const copies=await backups(current);assert(copies.previous.some(copy=>copy.kind==='pending'&&copy.profile.settings.mixedClientLabel==='held old mirror'));
 });
 await check('A pending v5 mirror is selected only at first cutover, with the alternative primary retained',{beforeNew:async({old})=>{await writeOld(old,'initial pending preferred',{mirror:true});}},async({current,original})=>{
  assert.equal((await state(current)).settings.mixedClientLabel,'initial pending preferred');
  const copies=await backups(current);assert.equal(copies.original.settings.mixedClientLabel,'initial pending preferred');
  assert(copies.previous.some(copy=>copy.kind==='primary'&&JSON.stringify(copy.profile)===JSON.stringify(original)));
  await newEvidence(current);await reloadApp(current);assert.equal((await state(current)).settings.mixedClientLabel,'v6 authoritative');
 });
 await check('Actual legacy localStorage progress migrates when IndexedDB becomes available',{oldFallback:true},async({old,current,original})=>{
  assert.equal((await state(current)).stats.xp,original.stats.xp);assert.deepEqual((await backups(current)).original,original);
  const before=await newEvidence(current),late=await writeOld(old,'late old fallback');await reloadApp(current);
  assert.deepEqual((await state(current)).learning,before.learning);
  assert((await backups(current)).previous.some(copy=>copy.kind==='fallback'&&JSON.stringify(copy.profile)===JSON.stringify(late.profile)));
 });
 await check('Actual old and new localStorage fallbacks use separate authoritative namespaces',{oldFallback:true,newFallback:true},async({old,current,original})=>{
  assert.deepEqual((await backups(current)).original,original);const before=await newEvidence(current);
  const persisted=await current.evaluate(id=>JSON.parse(localStorage.getItem('kv6:profile:'+id)),original.id);
  assert.deepEqual(persisted.learning,before.learning,'The actual fallback write durably stores new v6 evidence before the old write');
  await writeOld(old,'old kv fallback write');
  const retained=await current.evaluate(id=>JSON.parse(localStorage.getItem('kv6:profile:'+id)),original.id);
  assert.deepEqual(retained.learning,before.learning,'An old fallback save cannot modify the physically separate v6 fallback');
  await reloadApp(current);
  assert.deepEqual((await state(current)).learning,before.learning);
  const raw=await current.evaluate(id=>({old:JSON.parse(localStorage.getItem('kv:profile:'+id)),current:JSON.parse(localStorage.getItem('kv6:profile:'+id))}),original.id);
  assert.equal(raw.old.learning.version,5);assert.equal(raw.current.learning.version,6);assert.equal(raw.current.settings.mixedClientLabel,'v6 authoritative');
 });
 await check('Old roster edits and profile deletion cannot change the already cut-over v6 learner',{},async({old,current,original})=>{
  const before=await newEvidence(current);await old.evaluate(async()=>{const {store}=await import('./js/store.js');store.renameProfile('Old renamed learner');await store.saveNow();await store.createProfile('Old extra learner');});
  await reloadApp(current);assert.equal((await state(current)).id,original.id);assert.equal((await state(current)).name,before.name);
  assert.equal(await current.evaluate(async()=> (await import('./js/store.js')).store.profiles.length),1);
  await old.evaluate(async id=>{const {store}=await import('./js/store.js');await store.deleteProfile(id);},original.id);
  await reloadApp(current);assert.deepEqual((await state(current)).learning,before.learning);
 });
 await check('A new reset keeps its epoch and empty evidence even after the open v5 client saves',{},async({old,current})=>{
  await newEvidence(current);const reset=await current.evaluate(async()=>{const {store}=await import('./js/store.js');await store.resetProgress();return structuredClone(store.current);});
  await writeOld(old,'after new reset');await reloadApp(current);const after=await state(current);
  assert.equal(after.learning.epoch.id,reset.learning.epoch.id);assert.deepEqual(after.learning.events,{});assert.equal(after.stats.xp,0);assert.deepEqual(after.items,{});
 });
 await check('Deleting in v6 removes old copies and an old tab cannot resurrect the deleted v6 profile',{},async({old,current,original})=>{
  await newEvidence(current);await current.evaluate(async id=>{const {store}=await import('./js/store.js');await store.deleteProfile(id);},original.id);
  assert.equal(await stored(current,'italiano-db',original.id),undefined);assert.equal(await stored(current,'italiano-db-v6',original.id),undefined);
  const replacement=(await state(current)).id;assert.notEqual(replacement,original.id);
  await writeOld(old,'old tab after deletion');await reloadApp(current);assert.equal((await state(current)).id,replacement);
  assert(!(await current.evaluate(async()=> (await import('./js/store.js')).store.profiles)).some(profile=>profile.id===original.id));
  assert.equal(await stored(current,'italiano-db-v6',original.id),undefined);
 });
 await check('A provisional schema-6 legacy primary retains a verified earlier schema-5 recovery',{beforeNew:async({old,original})=>{
  // Represents a previous rollout that used the old physical store. The original
  // v5 client remains running while the real migration API creates its recovery.
  await old.evaluate(async original=>{
   const {migrateStoredProfile}=await import('/js/learning/migrate-profile.js');const {normalizeLearning}=await import('/js/learning/model.js');
   const database=await new Promise(resolve=>{const request=indexedDB.open('italiano-db',1);request.onsuccess=()=>resolve(request.result);});
   const candidate=structuredClone(original);candidate.learning=normalizeLearning(candidate.learning);
   await migrateStoredProfile({database,storage:localStorage,profileId:original.id,primaryBefore:original,original,candidate});database.close();
  },original);
 }},async({old,current,original})=>{
  assert.equal((await state(current)).learning.version,6);const copies=await backups(current);
  assert.equal(copies.original.learning.version,6);assert(copies.previous.some(copy=>copy.kind==='recovery'&&JSON.stringify(copy.profile)===JSON.stringify(original)));
  await writeOld(old,'older schema-5 writer after provisional rollout');await reloadApp(current);
  assert.equal((await state(current)).learning.version,6);assert((await backups(current)).previous.some(copy=>copy.kind==='recovery'&&JSON.stringify(copy.profile)===JSON.stringify(original)));
 });
 await check('Current v6 fallback progress and verified recovery survive IndexedDB becoming available',{oldFallback:true,newFallback:true},async({context,current,original})=>{
  const before=await newEvidence(current),available=await context.newPage();available.on('pageerror',error=>errors.push(error.message));
  await boot(available,origin);const after=await state(available);
  assert.deepEqual(after.learning,before.learning);assert.equal(after.stats.xp,before.stats.xp);assert.equal(after.learnerId,before.learnerId);
  assert.equal(after.settings.mixedClientLabel,'v6 authoritative');assert.deepEqual((await backups(available)).original,original);
  await available.evaluate(async()=> (await import('./js/store.js')).store.saveNow());
  assert.deepEqual((await stored(available,'italiano-db-v6',original.id)).learning,before.learning);
 });
 await check('Deleting after a fallback-to-IDB transition removes v6 fallback profiles and recovery copies',{oldFallback:true,newFallback:true},async({context,current,original})=>{
  await newEvidence(current);const available=await context.newPage();available.on('pageerror',error=>errors.push(error.message));await boot(available,origin);
  await available.evaluate(async id=> (await import('./js/store.js')).store.deleteProfile(id),original.id);
  const retained=await available.evaluate(id=>{
   const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key.startsWith('kv6:'))continue;const value=JSON.parse(localStorage.getItem(key));if(key==='kv6:profile:'+id||key==='kv6:recovery:'+id||key==='kv6:merge-recovery:'+id||key==='kv6:migration-latest:'+id||key.startsWith('kv6:migration:')&&value.profileId===id)keys.push(key);}return keys;
  },original.id);
  assert.deepEqual(retained,[],'Deleted-user profiles and verified recovery copies must be removed from both stores');
  assert.equal(await stored(available,'italiano-db-v6',original.id),undefined);
 });
 assert.deepEqual(errors,[]);
}catch(error){failure=error;console.error(error.stack);}
finally{
 fs.writeFileSync(new URL(`../docs/implementation/programme/mixed-client-migration-${engine}.json`,import.meta.url),JSON.stringify({browser:engine,baseline:BASELINE,sourceExecution:'Actual shipped baseline store and current app on one origin',namespace:{old:'italiano-db / kv: / it.*',current:'italiano-db-v6 / kv6: / it.v6.*'},serviceWorkers:'Blocked to keep both source generations open; installed-worker activation remains a separate release gate',results,errors,...(failure?{failure:failure.message}:{})},null,2));
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
if(failure)throw failure;
