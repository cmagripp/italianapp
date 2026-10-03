import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions()),page=await context.newPage(),results=[];
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
try{
 await page.goto(BASE+'#/home');await page.waitForFunction(async()=>!!(await import('./js/store.js')).store.current);
 await page.evaluate(async()=>{
  window.store=(await import('./js/store.js')).store;
  window.backups=await import('./js/conversations/profile-backup.js');
  window.factory=(await import('./js/conversations/storage.js')).createConversationRepository;
  window.setup={name:'Ada',level:'A1',participants:[{id:'p',name:'Giulia'}]};
  window.currentRepo=()=>factory({profileId:store.current.id,learnerId:store.current.learnerId});
  window.makeThread=async(repo,id)=>{await repo.createThread(setup,{threadId:id});await repo.commitTurn(id,{turnId:'m1',role:'learner',participantId:'learner',originalText:'Vorrei un caffè.'});};
 });
 await check('Full backup restores progress and exact transcripts, with audio only on explicit inclusion',async()=>{
  const r=await page.evaluate(async()=>{
   const source=currentRepo();await makeThread(source,'roundtrip');await source.saveRecording('roundtrip','m1',new Blob(['audio-sample'],{type:'audio/wav'}),{consentAt:Date.now(),audioId:'chosen'});
   window.transcriptBackup=await backups.exportFullProfileBackup(store);window.audioBackup=await backups.exportFullProfileBackup(store,{includeAudio:true});const first=JSON.parse(transcriptBackup),audio=JSON.parse(audioBackup),learnerId=store.current.learnerId;source.close();
   await store.createProfile('Restored');const slot=store.current.id;await backups.beginProfileBackupImport(store,transcriptBackup);let target=currentRepo();const read=await target.read('roundtrip'),none=await target.recording('roundtrip','chosen');target.close();
   await backups.beginProfileBackupImport(store,audioBackup);target=currentRepo();const recording=await target.recording('roundtrip','chosen');target.close();
   return {noAudio:first.conversations.records.recordings.length,audio:audio.conversations.records.recordings.length,slot,savedSlot:store.current.id,learnerId,savedLearner:store.current.learnerId,text:read.turns[0].originalText,none,recording:await recording.blob.text(),pending:await backups.pendingProfileBackup(store)};
  });
  assert.equal(r.noAudio,0);assert.equal(r.audio,1);assert.equal(r.slot,r.savedSlot);assert.equal(r.learnerId,r.savedLearner);assert.equal(r.text,'Vorrei un caffè.');assert.equal(r.none,null);assert.equal(r.recording,'audio-sample');assert.equal(r.pending,null);
 });
 await check('Invalid content and future formats are rejected before changing progress',async()=>{
  const r=await page.evaluate(async()=>{
   await store.saveNow();const before=JSON.stringify(store.current),errors=[];
   for(const mutate of [b=>b.profile.learning.version=999,b=>b.conversations.learnerId='different',b=>b.conversations.records.turns[0].sequence=0,b=>b.version=2]){const b=JSON.parse(transcriptBackup);mutate(b);try{await backups.beginProfileBackupImport(store,JSON.stringify(b));}catch(e){errors.push(e.message);}}
   return {errors,same:before===JSON.stringify(store.current),pending:await backups.pendingProfileBackup(store)};
  });
  assert.equal(r.errors.length,4);assert.equal(r.same,true);assert.equal(r.pending,null);
 });
 await check('Failure to save the recovery journal leaves the current profile untouched',async()=>{
  const r=await page.evaluate(async()=>{
   const before=JSON.stringify(store.current),put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='imports')throw new DOMException('Test journal quota','QuotaExceededError');return put.apply(this,args);};let error;
   try{await backups.beginProfileBackupImport(store,transcriptBackup);}catch(e){error=e.name;}finally{IDBObjectStore.prototype.put=put;}
   return {error,same:before===JSON.stringify(store.current),pending:await backups.pendingProfileBackup(store)};
  });
  assert.equal(r.error,'QuotaExceededError');assert.equal(r.same,true);assert.equal(r.pending,null);
 });
 await check('Interruption after the progress commit resumes without replacing newer progress',async()=>{
  const r=await page.evaluate(async()=>{
   await store.createProfile('Interrupted progress');const original=JSON.parse(store.exportJSON()).profile,put=IDBObjectStore.prototype.put;let error;
   IDBObjectStore.prototype.put=function(value,...args){if(this.name==='imports'&&value.stage==='progress-restored')throw new DOMException('Test journal interruption','QuotaExceededError');return put.call(this,value,...args);};
   try{await backups.beginProfileBackupImport(store,transcriptBackup);}catch(e){error={pending:e.pendingBackup,restored:e.progressRestored};}finally{IDBObjectStore.prototype.put=put;}
   const recovery=JSON.parse(await backups.originalProfileBackup(store));store.setSetting('studyMinutes',30);await store.saveNow();await backups.resumeProfileBackupImport(store);const repo=currentRepo(),threads=await repo.list();repo.close();
   return {error,original,old:recovery.profile,newMinutes:store.settings.studyMinutes,threads:threads.length,pending:await backups.pendingProfileBackup(store)};
  });
  assert.deepEqual(r.error,{pending:true,restored:true});assert.deepEqual(r.old,r.original);assert.equal(r.newMinutes,30);assert.equal(r.threads,1);assert.equal(r.pending,null);
 });
 await check('A committed conversation restore is idempotent even if journal cleanup failed and newer messages exist',async()=>{
  const r=await page.evaluate(async()=>{
   const del=IDBObjectStore.prototype.delete;let error;IDBObjectStore.prototype.delete=function(...args){if(this.name==='imports')throw new DOMException('Test cleanup interruption','QuotaExceededError');return del.apply(this,args);};
   try{await backups.beginProfileBackupImport(store,transcriptBackup);}catch(e){error=e.pendingBackup;}finally{IDBObjectStore.prototype.delete=del;}
   const repo=currentRepo();await repo.commitTurn('roundtrip',{turnId:'newer',role:'learner',participantId:'learner',originalText:'Una frase nuova.'});store.setSetting('studyMinutes',20);await store.saveNow();await backups.resumeProfileBackupImport(store);const state=await repo.read('roundtrip');repo.close();
   return {error,turns:state.turns.map(t=>t.turnId),minutes:store.settings.studyMinutes,pending:await backups.pendingProfileBackup(store)};
  });
  assert.equal(r.error,true);assert.deepEqual(r.turns,['m1','newer']);assert.equal(r.minutes,20);assert.equal(r.pending,null);
 });
 await check('Changes to conversations while restoration is pending are never silently overwritten',async()=>{
  const r=await page.evaluate(async()=>{
   const tx=IDBDatabase.prototype.transaction;let first,second;IDBDatabase.prototype.transaction=function(names,mode,...args){if(this.name==='parola-conversations'&&mode==='readwrite')throw new DOMException('Test restore interruption','QuotaExceededError');return tx.call(this,names,mode,...args);};
   try{await backups.beginProfileBackupImport(store,transcriptBackup);}catch(e){first=e.pendingBackup;}finally{IDBDatabase.prototype.transaction=tx;}
   const repo=currentRepo();await makeThread(repo,'new-while-pending');try{await backups.resumeProfileBackupImport(store);}catch(e){second=e.message;}const threads=await repo.list();repo.close();const pending=!!await backups.pendingProfileBackup(store);await backups.cancelProfileBackupImport(store);
   return {first,second,threads:threads.map(t=>t.threadId),pending};
  });
  assert.equal(r.first,true);assert.match(r.second,/Conversations changed/);assert.ok(r.threads.includes('new-while-pending'));assert.equal(r.pending,true);
 });
 await check('Deleting a conversation clears any pending import that contains its private text',async()=>{
  const r=await page.evaluate(async()=>{
   const tx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...args){if(this.name==='parola-conversations'&&mode==='readwrite')throw new DOMException('Test restore interruption','QuotaExceededError');return tx.call(this,names,mode,...args);};
   try{await backups.beginProfileBackupImport(store,transcriptBackup);}catch{}finally{IDBDatabase.prototype.transaction=tx;}
   const before=!!await backups.pendingProfileBackup(store),repo=currentRepo();await repo.deleteThread('roundtrip');repo.close();return {before,after:await backups.pendingProfileBackup(store)};
  });
  assert.equal(r.before,true);assert.equal(r.after,null);
 });
 await check('Deleting a user removes their pending backup and pre-import recovery record',async()=>{
  const r=await page.evaluate(async()=>{
   await store.createProfile('Private backup');const profileId=store.current.id,put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='imports'&&value.stage==='progress-restored')throw new DOMException('Test interruption','QuotaExceededError');return put.call(this,value,...args);};try{await backups.beginProfileBackupImport(store,transcriptBackup);}catch{}finally{IDBObjectStore.prototype.put=put;}
   const before=!!await backups.pendingProfileBackup(store);await store.deleteProfile(profileId);const db=await new Promise((yes,no)=>{const r=indexedDB.open('parola-backup-imports',1);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});const row=await new Promise((yes,no)=>{const r=db.transaction('imports').objectStore('imports').get(profileId);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});db.close();return {before,exists:!!row};
  });
  assert.equal(r.before,true);assert.equal(r.exists,false);
 });
}finally{fs.writeFileSync(`docs/implementation/programme/profile-backup-${process.env.COURSE_BROWSER||'chromium'}.json`,JSON.stringify({browser:process.env.COURSE_BROWSER||'chromium',checks:results},null,2));await context.close();await browser.close();stop();}
