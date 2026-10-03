import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer();
const browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions()),page=await context.newPage(),results=[];
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
const init=async()=>page.evaluate(async()=>{
 const {createConversationRepository}=await import('./js/conversations/storage.js');
 window.repo=createConversationRepository({profileId:'test-profile',learnerId:'test-learner'});
 window.factory=createConversationRepository;
 window.setup={name:'Ada',level:'A1',agreement:'feminine',participants:[{id:'maria',name:'Maria'}]};
 window.message=(n,extra={})=>({turnId:`turn-${n}`,role:n%2?'learner':'partner',participantId:n%2?'learner':'maria',originalText:n%2?`Ciao, sono Ada. ${n}`:`Ciao, Ada! ${n}`,...extra});
});
try{
 await page.goto(BASE+'index.html');await init();
 await check('120 committed turns and an unsent draft survive a fresh page exactly',async()=>{
  const before=await page.evaluate(async()=>{
   await repo.createThread(setup,{threadId:'long',title:'Una conversazione'});
   for(let n=1;n<=120;n++)await repo.commitTurn('long',message(n));
   await repo.saveDraft('long',{turnId:'next',typedText:'Vorrei un caffè.',mode:'written',selectedHelp:[],policySnapshot:{strictAccents:false}});
   return repo.read('long');
  });
  assert.equal(before.turns.length,120);assert.equal(before.thread.contentRevision,120);
  await page.reload();await init();assert.deepEqual(await page.evaluate(()=>repo.read('long')),before);
 });
 await check('A successful send can retry without duplicate messages or evidence; concurrent send conflicts',async()=>{
  const r=await page.evaluate(async()=>{
   const before=await repo.read('long'),input=message(121,{turnId:'next',originalText:before.draft.typedText});
   const options={expectedRevision:before.thread.revision,draftRevision:before.draft.revision};
   const first=await repo.commitTurn('long',input,options),retry=await repo.commitTurn('long',input,options);
   const result=await Promise.allSettled([repo.commitTurn('long',message(122),{expectedRevision:before.thread.revision+1}),repo.commitTurn('long',message(124),{expectedRevision:before.thread.revision+1})]);
   return {first,retry,after:await repo.read('long'),statuses:result.map(r=>r.status),error:result.find(r=>r.status==='rejected')?.reason.name};
  });
  assert.deepEqual(r.first,r.retry);assert.equal(r.after.draft,null);assert.equal(r.after.turns.length,122);
  assert.deepEqual(r.statuses.sort(),['fulfilled','rejected']);assert.equal(r.error,'ConversationConflict');
 });
 await check('A changed submission using an existing message identity is not treated as a retry',async()=>{
  const r=await page.evaluate(async()=>{
   const errors=[];for(const patch of [{displayText:'A different display'},{submittedText:'A different submission'},{policySnapshot:{strictAccents:true}},{inputProvenance:{mode:'speech'}}])try{await repo.commitTurn('long',message(1,patch));}catch(e){errors.push(e.name);}return errors;
  });
  assert.deepEqual(r,['ConversationConflict','ConversationConflict','ConversationConflict','ConversationConflict']);
 });
 await check('Editing preserves original input and invalidates generated replies and source-linked notes',async()=>{
  const r=await page.evaluate(async()=>{
   await repo.createThread(setup,{threadId:'edit'});await repo.commitTurn('edit',message(1,{originalText:'Ho andato a casa.'}));
   await repo.saveSummary('edit',{items:[{id:'go',kind:'correction',sourceRefs:[{turnId:'turn-1',revision:1,start:0,end:9,quote:'Ho andato'}],text:'Sono andata a casa.'}]},{sourceRevision:1});
   await repo.beginGeneration('edit',{requestId:'old-request'});
   const revised=await repo.reviseTurn('edit','turn-1',{displayText:'Sono andata a casa.',expectedRevision:1});
   let replyError,summaryError;
   try{await repo.commitTurn('edit',message(2),{requestId:'old-request'});}catch(e){replyError=e.name;}
   try{await repo.saveSummary('edit',{items:[{sourceRefs:[{turnId:'turn-1',revision:1}]}]},{sourceRevision:2});}catch(e){summaryError=e.name;}
   return {revised,replyError,summaryError,state:await repo.read('edit')};
  });
  assert.equal(r.revised.originalText,'Ho andato a casa.');assert.equal(r.revised.history[0].displayText,'Ho andato a casa.');
  assert.equal(r.state.summary.dirty,true);assert.equal(r.state.summary.items[0].invalidated,true);assert.equal(r.state.thread.pending,null);
  assert.equal(r.replyError,'ConversationConflict');assert.equal(r.summaryError,'ConversationConflict');
 });
 await check('A summary cannot cite a nonexistent message or an omitted revision',async()=>{
  const r=await page.evaluate(async()=>{
   const errors=[];for(const sourceRefs of [[{turnId:'missing'}],[{turnId:'turn-1'}],[{turnId:'missing',revision:1}]])try{await repo.saveSummary('edit',{items:[{sourceRefs,text:'Invented note'}]},{sourceRevision:2});}catch(e){errors.push(e.name);}
   const bad=await repo.exportRecords();bad.records.summaries.find(s=>s.threadId==='edit').items=[{sourceRefs:[{turnId:'missing'}]}];let imported;
   try{await repo.importRecords(bad);}catch(e){imported=e.message;}
   return {errors,imported};
  });
  assert.deepEqual(r.errors,['ConversationConflict','ConversationConflict','ConversationConflict']);assert.match(r.imported,/invalid message source/);
 });
 await check('An aborted quota write rolls back the full send and retains the saved draft',async()=>{
  const r=await page.evaluate(async()=>{
   await repo.createThread(setup,{threadId:'quota'});await repo.saveDraft('quota',{turnId:'turn-1',typedText:'La mia bozza'});
   const before=await repo.read('quota'),original=IDBObjectStore.prototype.put;let failures=0;
   const failing=factory({profileId:'test-profile',learnerId:'test-learner',onError:()=>failures++});
   IDBObjectStore.prototype.put=function(value,...args){if(this.name==='summaries')throw new DOMException('Test quota exhausted','QuotaExceededError');return original.call(this,value,...args);};
   let error;try{await failing.commitTurn('quota',message(1));}catch(e){error=e.name;}finally{IDBObjectStore.prototype.put=original;failing.close();}
   return {before,after:await repo.read('quota'),failures,error};
  });
  assert.equal(r.error,'QuotaExceededError');assert.equal(r.failures,1);assert.deepEqual(r.after,r.before);
 });
 await check('Learners are isolated and a changed owner cannot read or write an earlier learner',async()=>{
  const r=await page.evaluate(async()=>{
   const other=factory({profileId:'test-profile',learnerId:'other-learner'}),otherProfile=factory({profileId:'other-profile',learnerId:'test-learner'});
   const empty=[(await other.list()).length,(await otherProfile.list()).length];
   let current=true;const stale=factory({profileId:'test-profile',learnerId:'test-learner',isCurrent:()=>current});await stale.read('long');current=false;
   const errors=[];for(const action of [()=>stale.read('long'),()=>stale.commitTurn('long',message(130))])try{await action();}catch(e){errors.push(e.name);}
   other.close();otherProfile.close();stale.close();return {empty,errors};
  });
  assert.deepEqual(r.empty,[0,0]);assert.deepEqual(r.errors,['AbortError','AbortError']);
 });
 await check('A profile change during the IndexedDB result cannot return the previous learner’s transcript',async()=>{
  const r=await page.evaluate(async()=>{
   let current=true;const owned=factory({profileId:'test-profile',learnerId:'test-learner',isCurrent:()=>current});await owned.list();
   const original=IDBIndex.prototype.getAll;
   IDBIndex.prototype.getAll=function(...args){const request=original.apply(this,args);if(this.objectStore.name==='threads')request.addEventListener('success',()=>{current=false;},{once:true});return request;};
   let error,result;try{result=await owned.list();}catch(e){error=e.name;}finally{IDBIndex.prototype.getAll=original;owned.close();}return {error,result};
  });
  assert.equal(r.error,'AbortError');assert.equal(r.result,undefined);
 });
 await check('Recordings need explicit consent; transcript-only export excludes audio; hash-checked import restores it',async()=>{
  const r=await page.evaluate(async()=>{
   const blob=new Blob(['test-audio-bytes'],{type:'audio/webm'});let consentError;
   try{await repo.saveRecording('edit','turn-1',blob);}catch(e){consentError=e.message;}
   const meta=await repo.saveRecording('edit','turn-1',blob,{consentAt:Date.now(),audioId:'chosen-audio',duration:1});
   const plain=await repo.exportRecords(),full=await repo.exportRecords({includeAudio:true});
   const restored=factory({profileId:'audio-restore',learnerId:'test-learner'});await restored.importRecords(full);
   const audio=await restored.recording('edit','chosen-audio');
   const bad=structuredClone(full);new Uint8Array(bad.records.recordings[0].bytes)[0]=0;let integrityError;
   try{await restored.importRecords(bad);}catch(e){integrityError=e.message;}
   restored.close();return {consentError,meta,plainAudio:plain.records.recordings.length,fullAudio:full.records.recordings.length,restoredText:await audio.blob.text(),integrityError};
  });
  assert.match(r.consentError,/explicit choice/);assert.equal(r.plainAudio,0);assert.equal(r.fullAudio,1);assert.equal(r.restoredText,'test-audio-bytes');assert.match(r.integrityError,/damaged/);
 });
 await check('Recording identities cannot overwrite another turn’s audio and derived notes need exact source words',async()=>{
  const r=await page.evaluate(async()=>{
   await repo.commitTurn('edit',message(2));let collision,quote;
   try{await repo.saveRecording('edit','turn-2',new Blob(['replacement'],{type:'audio/webm'}),{audioId:'chosen-audio',consentAt:Date.now()});}catch(e){collision=e.name;}
   try{await repo.saveSummary('edit',{items:[{kind:'vocabulary',sourceRefs:[{turnId:'turn-2',revision:1,start:0,end:1000,quote:'Invented words'}]}]},{sourceRevision:3});}catch(e){quote=e.message;}
   const original=await repo.recording('edit','chosen-audio');return {collision,quote,turn:original.turnId,text:await original.blob.text()};
  });
  assert.equal(r.collision,'ConversationConflict');assert.match(r.quote,/source words/);assert.equal(r.turn,'turn-1');assert.equal(r.text,'test-audio-bytes');
 });
 await check('Portable JSON backup round-trips optional binary audio and a single selected thread',async()=>{
  const r=await page.evaluate(async()=>{
   const {exportConversationJSON,importConversationJSON,parseConversationJSON}=await import('./js/conversations/backup.js');
   const plain=await exportConversationJSON(repo,{threadId:'edit'}),full=await exportConversationJSON(repo,{includeAudio:true,threadId:'edit'});
   const target=factory({profileId:'json-restore',learnerId:'test-learner'});await importConversationJSON(target,full);
   const audio=await target.recording('edit','chosen-audio');const result={plain:parseConversationJSON(plain).records.recordings.length,threads:(await target.list()).map(t=>t.threadId),text:await audio.blob.text()};target.close();return result;
  });
  assert.equal(r.plain,0);assert.deepEqual(r.threads,['edit']);assert.equal(r.text,'test-audio-bytes');
 });
 await check('An 8 MiB recording survives portable JSON without recursive-regex failure',async()=>{
  const r=await page.evaluate(async()=>{
   const {exportConversationJSON,importConversationJSON}=await import('./js/conversations/backup.js');
   const bytes=new Uint8Array(8*1024*1024);bytes.fill(97);bytes[bytes.length-1]=255;
   const source=factory({profileId:'large-source',learnerId:'large-audio'}),target=factory({profileId:'large-target',learnerId:'large-audio'});
   await source.createThread(setup,{threadId:'large'});await source.commitTurn('large',message(1));
   const meta=await source.saveRecording('large','turn-1',new Blob([bytes],{type:'audio/webm'}),{audioId:'large-audio',consentAt:Date.now()});
   await importConversationJSON(target,await exportConversationJSON(source,{includeAudio:true}));const row=await target.recording('large','large-audio');
   const result={length:row.bytes.byteLength,last:new Uint8Array(row.bytes).at(-1),sameHash:row.sha256===meta.sha256};await source.removeProfileData();await target.removeProfileData();source.close();target.close();return result;
  });
  assert.equal(r.length,8*1024*1024);assert.equal(r.last,255);assert.equal(r.sameHash,true);
 });
 await check('Import keeps a recovery snapshot and deletion cannot be undone by an old merged backup',async()=>{
  const r=await page.evaluate(async()=>{
   const backup=await repo.exportRecords({includeAudio:true});
   const {snapshotId}=await repo.importRecords(backup,{mode:'replace'});
   await repo.deleteThread('edit');await repo.importRecords(backup);
   let readError;try{await repo.read('edit');}catch(e){readError=e.name;}
   await repo.restoreSnapshot(snapshotId);let restoredDeleted;
   await repo.importRecords(backup);
   try{await repo.read('edit');restoredDeleted=true;}catch{restoredDeleted=false;}
   return {readError,restoredDeleted,snapshots:await repo.recoverySnapshots(),count:(await repo.read('long')).turns.length};
  });
  assert.equal(r.readError,'ConversationConflict');assert.equal(r.restoredDeleted,false);assert(r.snapshots.length>=2);assert.equal(r.count,122);
 });
 await check('Malformed or conflicting imports leave the current conversation and draft unchanged',async()=>{
  const r=await page.evaluate(async()=>{
   const before=await repo.read('long'),bad=await repo.exportRecords();bad.records.turns.find(t=>t.threadId==='long').displayText='Unrelated changed text';let error;
   try{await repo.importRecords(bad);}catch(e){error=e.name;}
   const wrong=await repo.exportRecords();wrong.learnerId='someone-else';let identity;
   try{await repo.importRecords(wrong);}catch(e){identity=e.message;}
   return {before,after:await repo.read('long'),error,identity};
  });
  assert.deepEqual(r.before,r.after);assert.equal(r.error,'ConversationConflict');assert.match(r.identity,/another learner/);
 });
 await check('A longer divergent backup cannot overwrite local originals; a true descendant keeps an unsent draft',async()=>{
  const r=await page.evaluate(async()=>{
   const left=factory({profileId:'merge-left',learnerId:'merge-learner'}),right=factory({profileId:'merge-right',learnerId:'merge-learner'});
   await left.createThread(setup,{threadId:'branch'});await left.commitTurn('branch',message(1));
   const base=await left.exportRecords();await right.importRecords(base);
   await left.saveDraft('branch',{turnId:'local-draft',typedText:'Un messaggio non inviato.'});
   await right.commitTurn('branch',message(2));await left.importRecords(await right.exportRecords());
   const kept=(await left.read('branch')).draft;
   await left.reviseTurn('branch','turn-1',{displayText:'La mia revisione.',expectedRevision:1});
   await right.reviseTurn('branch','turn-1',{displayText:'Una revisione diversa.',expectedRevision:1});
   await right.commitTurn('branch',message(3));
   const before=await left.read('branch');let error;
   try{await left.importRecords(await right.exportRecords());}catch(e){error=e.name;}
   const after=await left.read('branch');left.close();right.close();return {kept,error,before,after};
  });
  assert.equal(r.kept.typedText,'Un messaggio non inviato.');assert.equal(r.error,'ConversationConflict');assert.deepEqual(r.after,r.before);
 });
 await check('An older remote deletion removes a longer local conversation and redacts all recovery copies',async()=>{
  const r=await page.evaluate(async()=>{
   const left=factory({profileId:'delete-left',learnerId:'delete-learner'}),right=factory({profileId:'delete-right',learnerId:'delete-learner'});
   await left.createThread(setup,{threadId:'removed'});await left.commitTurn('removed',message(1));const backup=await left.exportRecords();await right.importRecords(backup);
   await left.commitTurn('removed',message(2));await left.commitTurn('removed',message(3));
   await right.deleteThread('removed');await left.importRecords(await right.exportRecords());
   const counts=[(await left.list()).length];
   for(const snapshot of await left.recoverySnapshots())await left.restoreSnapshot(snapshot.snapshotId);
   await left.importRecords(backup);counts.push((await left.list()).length);
   const remaining=await left.exportRecords({includeAudio:true});left.close();right.close();return {counts,turns:remaining.records.turns.length,deleted:remaining.records.threads[0]?.deletedAt};
  });
  assert.deepEqual(r.counts,[0,0]);assert.equal(r.turns,0);assert(r.deleted);
 });
 await check('Two different unsent drafts cannot overwrite each other during merge',async()=>{
  const r=await page.evaluate(async()=>{
   const left=factory({profileId:'draft-left',learnerId:'draft-learner'}),right=factory({profileId:'draft-right',learnerId:'draft-learner'});
   await left.createThread(setup,{threadId:'draft-branch'});await right.importRecords(await left.exportRecords());
   await left.saveDraft('draft-branch',{typedText:'La mia bozza.'});await right.saveDraft('draft-branch',{typedText:'Un’altra bozza.'});
   let error;try{await left.importRecords(await right.exportRecords());}catch(e){error=e.message;}
   const text=(await left.read('draft-branch')).draft.typedText;left.close();right.close();return {error,text};
  });
  assert.match(r.error,/different unsent draft/);assert.equal(r.text,'La mia bozza.');
 });
 await check('Meaning selection keeps exact original text and revision provenance and refuses a stale choice',async()=>{
  const r=await page.evaluate(async()=>{
   await repo.createThread(setup,{threadId:'meaning'});await repo.commitTurn('meaning',{...message(1),originalText:'Mi piace il calcio.'});
   const choice={start:12,end:18,quote:'calcio',entryId:'w:calcio|noun|football',senseId:'calcio-football'};
   const chosen=await repo.chooseMeaning('meaning','turn-1',choice,{expectedRevision:1});let error;
   try{await repo.chooseMeaning('meaning','turn-1',choice,{expectedRevision:1});}catch(e){error=e.name;}
   return {chosen,error};
  });
  assert.equal(r.chosen.originalText,'Mi piace il calcio.');assert.equal(r.chosen.displayText,r.chosen.originalText);assert.equal(r.chosen.sourceContext.lexicalChoices[0].revision,2);assert.equal(r.chosen.history[0].revision,1);assert.equal(r.error,'ConversationConflict');
 });
 await check('Deleting a local profile removes all imported learner identities and keeps other profiles intact',async()=>{
  const r=await page.evaluate(async()=>{
   const {deleteConversationsForProfile}=await import('./js/conversations/storage.js'),owners=[factory({profileId:'remove-family',learnerId:'learner-a'}),factory({profileId:'remove-family',learnerId:'learner-b'}),factory({profileId:'keep-family',learnerId:'learner-a'})];
   for(const owner of owners){await owner.createThread(setup,{threadId:'private'});await owner.commitTurn('private',message(1));await owner.importRecords(await owner.exportRecords());}
   await deleteConversationsForProfile('remove-family');const result=[];for(const owner of owners){result.push({threads:(await owner.list()).length,snapshots:(await owner.recoverySnapshots()).length});owner.close();}return result;
  });
  assert.deepEqual(r.slice(0,2),[{threads:0,snapshots:0},{threads:0,snapshots:0}]);assert.equal(r[2].threads,1);assert.ok(r[2].snapshots>0);
 });
 await check('Partner joins and leaves are atomic history events; inactive partners cannot emit a new turn',async()=>{
  const r=await page.evaluate(async()=>{
   await repo.createThread(setup,{threadId:'partners'});const first=await repo.read('partners');
   await repo.updateThread('partners',{setup:{...setup,participants:[...setup.participants,{id:'marco',name:'Marco',active:true}]}},{expectedRevision:first.thread.revision});
   const joined=await repo.read('partners');await repo.commitTurn('partners',{turnId:'marco-hi',role:'partner',participantId:'marco',originalText:'Ciao!'});
   await repo.updateThread('partners',{setup:{...joined.thread.setup,participants:joined.thread.setup.participants.map(p=>({...p,active:p.id!=='marco'}))}});
   const left=await repo.read('partners');let inactive;try{await repo.commitTurn('partners',{turnId:'marco-old',role:'partner',participantId:'marco',originalText:'Una risposta vecchia.'});}catch(e){inactive=e.message;}
   const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='summaries')throw new DOMException('Test atomic setup failure','QuotaExceededError');return put.call(this,value,...args);};let failed;
   try{await repo.updateThread('partners',{setup:joined.thread.setup});}catch(e){failed=e.name;}finally{IDBObjectStore.prototype.put=put;}
   return {joined,left,after:await repo.read('partners'),inactive,failed};
  });
  assert.equal(r.joined.turns[0].sourceContext.action,'join');assert.equal(r.left.turns.at(-1).sourceContext.action,'leave');assert.ok(r.left.turns.some(t=>t.turnId==='marco-hi'));assert.match(r.inactive,/inactive/);assert.equal(r.failed,'QuotaExceededError');assert.deepEqual(r.after,r.left);
 });
 await check('Profile removal deletes conversations, recordings and recovery copies only for that owner',async()=>{
  const r=await page.evaluate(async()=>{
   const backup=await repo.exportRecords(),other=factory({profileId:'separate',learnerId:'test-learner'});await other.importRecords(backup);
   await repo.removeProfileData();const result={own:(await repo.list()).length,snapshots:(await repo.recoverySnapshots()).length,other:(await other.list()).length};other.close();repo.close();return result;
  });
  assert.equal(r.own,0);assert.equal(r.snapshots,0);assert(r.other>0);
 });
}finally{
 fs.writeFileSync(new URL(`../docs/implementation/programme/conversation-storage-${process.env.COURSE_BROWSER||'chromium'}.json`,import.meta.url),JSON.stringify({browser:process.env.COURSE_BROWSER||'chromium',results},null,2));
 await browser.close();stop();
}
