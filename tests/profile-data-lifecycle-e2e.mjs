import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions()),page=await context.newPage(),results=[];
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
try{
 await page.goto(BASE+'#/home');await page.waitForFunction(async()=>!!(await import('./js/store.js')).store.current);
 await check('Deleting a local user clears progress, old-schema recovery, all conversation owners and synchronous draft copies',async()=>{
  const r=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js'),{createDraftRecovery}=await import('./js/conversations/draft-recovery.js');
   const original={id:store.current.id,learnerId:store.current.learnerId},setup={level:'A1',participants:[{id:'giulia',name:'Giulia'}]},repos=[];
   for(const learnerId of [original.learnerId,'previous-import']){const repo=createConversationRepository({profileId:original.id,learnerId});await repo.createThread(setup,{threadId:'private'});await repo.commitTurn('private',{turnId:'private-text',role:'learner',participantId:'learner',originalText:'Una frase privata.'});createDraftRecovery({profileId:original.id,learnerId,threadId:'private'}).write({typedText:'Private unsent draft'});repos.push(repo);}
   const database=await new Promise((yes,no)=>{const req=indexedDB.open('italiano-db-v6',1);req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error);});
   await new Promise((yes,no)=>{const tx=database.transaction('kv','readwrite');for(const key of ['recovery:'+original.id,'merge-recovery:'+original.id,'migration-latest:'+original.id,'migration:learning-v6-unified-review-1:'+original.id+':hash'])tx.objectStore('kv').put({profileId:original.id,private:'Earlier progress'},key);tx.oncomplete=yes;tx.onabort=()=>no(tx.error);});
   await store.createProfile('Keep this user');const keeper=store.current.id;await store.deleteProfile(original.id);
   const keys=await new Promise((yes,no)=>{const req=database.transaction('kv').objectStore('kv').getAllKeys();req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error);});database.close();
   const threads=[];for(const repo of repos){threads.push((await repo.list()).length);repo.close();}
   return {threads,keys,originalId:original.id,keeper,active:store.current.id,profiles:store.profiles.map(p=>p.id),localKeys:Object.keys(localStorage)};
  });
  assert.deepEqual(r.threads,[0,0]);assert.equal(r.active,r.keeper);assert.ok(r.profiles.includes(r.keeper));assert.ok(!r.profiles.includes(r.originalId));assert.ok(!r.keys.some(key=>String(key).includes(r.originalId)));assert.ok(!r.localKeys.some(key=>key.includes(r.originalId)));
 });
 await check('A failed conversation deletion keeps the user available for a clear retry',async()=>{
  const r=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');await store.createProfile('Retry deletion');const id=store.current.id,repo=createConversationRepository({profileId:id,learnerId:store.current.learnerId});await repo.createThread({level:'A1',participants:[{id:'p',name:'Giulia'}]},{threadId:'not-removed'});repo.close();
   const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...args){if(this.name==='parola-conversations'&&mode==='readwrite')throw new DOMException('Test deletion blocked','QuotaExceededError');return original.call(this,names,mode,...args);};let error;
   try{await store.deleteProfile(id);}catch(e){error=e.name;}finally{IDBDatabase.prototype.transaction=original;}
   const result={error,exists:store.profiles.some(p=>p.id===id),active:store.current.id,id};await store.deleteProfile(id);result.retried=!store.profiles.some(p=>p.id===id);return result;
  });
  assert.equal(r.error,'QuotaExceededError');assert.equal(r.exists,true);assert.equal(r.active,r.id);assert.equal(r.retried,true);
 });
}finally{fs.writeFileSync(`docs/implementation/programme/profile-data-lifecycle-${process.env.COURSE_BROWSER||'chromium'}.json`,JSON.stringify({browser:process.env.COURSE_BROWSER||'chromium',checks:results},null,2));await context.close();await browser.close();stop();}
