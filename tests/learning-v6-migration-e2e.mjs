import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions,boot,reloadApp} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer();
const browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions());
const page=await context.newPage(),results=[],fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/phase-0-2/current-v5-partial-profile.json',import.meta.url),'utf8'));
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
const seed=()=>page.evaluate(async fixture=>{
 const {store}=await import('./js/store.js');await store.saveNow();clearTimeout(store._saveTimer);store._dirty=false;
 const old=structuredClone(fixture.profile);old.id=store.current.id;
 const db=await new Promise((yes,no)=>{const r=indexedDB.open('italiano-db-v6',1);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
 await new Promise((yes,no)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(old,'profile:'+old.id);tx.oncomplete=yes;tx.onabort=()=>no(tx.error);});db.close();localStorage.removeItem('it.v6.pendingProfile');return old;
},fixture);
const stored=()=>page.evaluate(async()=>{
 const db=await new Promise(yes=>{const r=indexedDB.open('italiano-db-v6',1);r.onsuccess=()=>yes(r.result);});
 const value=await new Promise(yes=>{const r=db.transaction('kv','readonly').objectStore('kv').get('profile:'+localStorage.getItem('it.v6.currentProfile'));r.onsuccess=()=>yes(r.result);});db.close();return value;
});
try{
 await boot(page);
 await check('The v5 profile migrates with a verified exact old-schema copy, retaining drafts/checks/XP',async()=>{
  const old=await seed();await reloadApp(page);
  const result=await page.evaluate(async()=>{const {store}=await import('./js/store.js');return {current:structuredClone(store.current),backup:JSON.parse(await store.preUpdateBackup()).profile};});
  assert.equal(result.current.learning.version,6);assert.deepEqual(result.backup,old);
  for(const k of ['items','lists','custom'])assert.deepEqual(result.current[k],old[k]);
  assert.equal(result.current.stats.xp,old.stats.xp);assert.deepEqual(result.current.learning.completions,old.learning.completions);
  assert.equal(result.current.learning.session.ui.draft,old.learning.session.ui.draft);
  assert.deepEqual(Object.keys(result.current.learning.events).sort(),Object.keys(old.learning.events).sort());
  await reloadApp(page);assert.deepEqual(await page.evaluate(async()=>JSON.parse(await (await import('./js/store.js')).store.preUpdateBackup()).profile),old);
 });
 await check('A failed pre-update snapshot leaves v5 active on disk and offers the original export before retry',async()=>{
  const old=await seed();await page.evaluate(()=>localStorage.setItem('test-fail-migration','yes'));
  await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(localStorage.getItem('test-fail-migration')==='yes'&&typeof key==='string'&&key.startsWith('migration:'))throw new DOMException('Test storage full','QuotaExceededError');return put.call(this,value,key);};});
  await page.reload();await page.locator('[data-export-prior]').waitFor();assert.deepEqual(await stored(),old);
  const downloadWait=page.waitForEvent('download');await page.locator('[data-export-prior]').click();const download=await downloadWait;
  const path=await download.path();assert.deepEqual(JSON.parse(fs.readFileSync(path,'utf8')).profile,old);
  await page.evaluate(()=>localStorage.removeItem('test-fail-migration'));await page.locator('[data-retry-start]').click();await page.waitForFunction(()=>!!document.querySelector('.pg,.learn-hero,[data-daily-plan]'));
  assert.equal((await stored()).learning.version,6);
 });
 await check('Migration refuses a changed primary and rolls back verification failure atomically',async()=>{
  const r=await page.evaluate(async()=>{
   const {migrateStoredProfile}=await import('./js/learning/migrate-profile.js');
   const db=await new Promise(yes=>{const r=indexedDB.open('italiano-db-v6',1);r.onsuccess=()=>yes(r.result);});
   const profileId='isolated-migration',original={id:profileId,learning:{version:5}},candidate={id:profileId,learning:{version:6}},primary='profile:'+profileId;
   const put=value=>new Promise(yes=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(value,primary);tx.oncomplete=yes;});
   await put(original);let changed;try{await migrateStoredProfile({database:db,profileId,primaryBefore:{...original,name:'other'},original,candidate});}catch(e){changed=e.message;}
   const get=IDBObjectStore.prototype.get;
   IDBObjectStore.prototype.get=function(key){const r=get.call(this,key);if(key===primary)r.addEventListener('success',()=>{if(r.result?.learning?.version===6)r.result.learning.version=99;});return r;};
   let failed;try{await migrateStoredProfile({database:db,profileId,primaryBefore:original,original,candidate});}catch(e){failed=e.message;}finally{IDBObjectStore.prototype.get=get;}
   const current=await new Promise(yes=>{const r=db.transaction('kv','readonly').objectStore('kv').get(primary);r.onsuccess=()=>yes(r.result);});db.close();return {changed,failed,current};
  });
  assert.match(r.changed,/another window/);assert.match(r.failed,/could not be verified/);assert.equal(r.current.learning.version,5);
 });
 await check('The localStorage fallback preserves the old primary when the replacement cannot be saved',async()=>{
  const r=await page.evaluate(async()=>{
   const {migrateStoredProfile}=await import('./js/learning/migrate-profile.js');const original={id:'fallback',learning:{version:5}},candidate={id:'fallback',learning:{version:6}},values=new Map([['kv:profile:fallback',JSON.stringify(original)]]);
   const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(k==='kv:profile:fallback'&&JSON.parse(v).learning.version===6)throw new DOMException('Test quota','QuotaExceededError');values.set(k,v);},removeItem:k=>values.delete(k)};
   let backup;try{await migrateStoredProfile({database:null,storage,profileId:'fallback',primaryBefore:original,original,candidate});}catch(e){backup=JSON.parse(e.profileBackup).profile;}
   return {backup,current:JSON.parse(values.get('kv:profile:fallback')),copies:[...values.keys()].filter(k=>k.startsWith('kv:migration:')).length};
  });
  assert.equal(r.backup.learning.version,5);assert.deepEqual(r.backup,r.current);assert.equal(r.copies,1);
 });
 await check('Fallback migration rechecks a raced primary and cannot write a different profile into the slot',async()=>{
  const r=await page.evaluate(async()=>{
   const {migrateStoredProfile}=await import('./js/learning/migrate-profile.js');const original={id:'scope',learnerId:'one',learning:{version:5}},candidate={...original,learning:{version:6}},remote={...original,draft:'A newer draft'},values=new Map([['kv:profile:scope',JSON.stringify(original)]]);
   const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);if(k.startsWith('kv:migration:'))values.set('kv:profile:scope',JSON.stringify(remote));},removeItem:k=>values.delete(k)};
   let race,scope;try{await migrateStoredProfile({database:null,storage,profileId:'scope',primaryBefore:original,original,candidate});}catch(e){race=e.message;}
   try{await migrateStoredProfile({database:null,storage,profileId:'scope',primaryBefore:remote,original:remote,candidate:{...candidate,learnerId:'other'}});}catch(e){scope=e.message;}
   return {race,scope,current:JSON.parse(values.get('kv:profile:scope'))};
  });
  assert.match(r.race,/another window/);assert.match(r.scope,/identity/);assert.equal(r.current.draft,'A newer draft');assert.equal(r.current.learning.version,5);
 });
 await check('An un-restorable fallback primary is reported honestly and keeps a discoverable verified backup',async()=>{
  const r=await page.evaluate(async()=>{
   const {migrateStoredProfile,verifyMigrationSnapshot}=await import('./js/learning/migrate-profile.js');const original={id:'rollback',learnerId:'one',learning:{version:5}},candidate={...original,learning:{version:6}},values=new Map([['kv:profile:rollback',JSON.stringify(original)]]);let wrote=false;
   const storage={getItem:k=>{const value=values.get(k)??null;if(k==='kv:profile:rollback'&&wrote)return JSON.stringify({...JSON.parse(value),verify:'bad'});return value;},setItem:(k,v)=>{if(k==='kv:profile:rollback'){if(wrote)throw Error('Rollback blocked');wrote=true;}values.set(k,v);},removeItem:k=>values.delete(k)};
   let error;try{await migrateStoredProfile({database:null,storage,profileId:'rollback',primaryBefore:original,original,candidate});}catch(e){error=e.message;}
   const pointer=JSON.parse(values.get('kv:migration-latest:rollback')),snapshot=JSON.parse(values.get('kv:'+pointer.recoveryKey));
   const verified=await verifyMigrationSnapshot(snapshot),tampered=await verifyMigrationSnapshot({...snapshot,learnerId:'wrong'});
   return {error,version:JSON.parse(values.get('kv:profile:rollback')).learning.version,verified,tampered,backupVersion:snapshot.profile.learning.version};
  });
  assert.match(r.error,/previous primary could not be restored/);assert(!r.error.includes('previous copy is kept'));assert.equal(r.version,6);assert.equal(r.backupVersion,5);assert(r.verified);assert.equal(r.tampered,false);
 });
}finally{fs.writeFileSync(new URL(`../docs/implementation/programme/learning-v6-migration-${process.env.COURSE_BROWSER||'chromium'}.json`,import.meta.url),JSON.stringify({browser:process.env.COURSE_BROWSER||'chromium',results},null,2));await browser.close();stop();}
