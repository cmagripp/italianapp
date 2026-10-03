import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer();
const name=process.env.COURSE_BROWSER||'chromium',browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions()),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(BASE);await page.waitForFunction(()=>!!document.querySelector('main'));
 const results=await page.evaluate(async()=>{
  const {createConversationRepository}=await import('./js/conversations/storage.js');
  const {createConversationController}=await import('./js/conversations/controller.js');
  const {installConversationProvider,conversationProviderRevision}=await import('./js/conversations/runtime.js');
  const out=[];
  for(const mode of ['replace-during-request','replace-before-transaction','cancel-after-transaction-start','cancel-after-partner-put','replace-after-partner-put','throwing-cancel','rejecting-cancel']){
   const owner={profileId:'test-commit-boundary',learnerId:mode},repository=createConversationRepository(owner),threadId=crypto.randomUUID();
   await repository.createThread({level:'A1',support:'free',participants:[{id:'partner-1',name:'Giulia'}]},{threadId});
   let controller,responseReady=false,triggered=false,latestRemoval=null,cancellation=null,oldDisposed=false,onReply=0;
   const log=[],replacement={readiness:()=>({written:false}),acquire:()=>{throw new Error('Not used');}};
   const response={message:{participantId:'partner-1',text:'Preferisci il caffè caldo?'},corrections:[],vocabulary:[],teaching:[],provenance:{testOnly:true}};
   const old={readiness:()=>({written:true,recorded:false,handsfree:false}),dispose:()=>{oldDisposed=true;},acquire:()=>({cancelScope(){if(mode==='throwing-cancel')throw new Error('Injected provider cleanup failure');if(mode==='rejecting-cancel')return Promise.reject(new Error('Injected async cleanup failure'));},async request(){
    if(mode==='replace-during-request'){latestRemoval=installConversationProvider(replacement);log.push('provider replaced while service response pending');}
    if(['throwing-cancel','rejecting-cancel'].includes(mode)){triggered=true;log.push('provider cancelScope throws during explicit cancellation');cancellation=controller.cancel();}
    responseReady=true;return response;
   }})};
   latestRemoval=installConversationProvider(old);const startProvider=conversationProviderRevision();
   controller=createConversationController({repository,threadId,lookup:()=>({candidates:[]}),resolveEntry:()=>null,onReply:()=>{onReply++;}});await controller.load();await controller.saveDraft('Vorrei un caffe.');
   const original=IDBDatabase.prototype.transaction,originalPut=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,...args){
    const result=originalPut.call(this,value,...args);
    if(responseReady&&!triggered&&this.name==='turns'&&value.role==='partner'&&['cancel-after-partner-put','replace-after-partner-put'].includes(mode)){
     triggered=true;queueMicrotask(()=>{log.push(mode+' before transaction completion');if(mode==='cancel-after-partner-put')cancellation=controller.cancel();else latestRemoval=installConversationProvider(replacement);});
    }
    return result;
   };
   IDBDatabase.prototype.transaction=function(stores,...args){
    const names=typeof stores==='string'?[stores]:Array.from(stores),selected=this.name==='parola-conversations'&&responseReady&&!triggered&&names.includes('turns')&&names.includes('drafts');
    if(selected&&mode==='replace-before-transaction'){
     triggered=true;latestRemoval=installConversationProvider(replacement);log.push('provider replaced after response guard and before native partner transaction');
    }
    const transaction=original.call(this,stores,...args);
    if(selected&&mode==='cancel-after-transaction-start'){
     triggered=true;queueMicrotask(()=>{log.push('controller.cancel after native partner transaction exists, before first IDB get');cancellation=controller.cancel();});
    }
    return transaction;
   };
   let result;
   try{result=await controller.send();if(cancellation)await cancellation;}finally{IDBDatabase.prototype.transaction=original;IDBObjectStore.prototype.put=originalPut;}
   const saved=await repository.read(threadId),busyAfterCancellation=controller.busy;
   latestRemoval=installConversationProvider({readiness:()=>({written:true}),acquire:()=>({cancelScope(){},async request(){return response;}})});
   const retried=await controller.reply(),afterRetry=await repository.read(threadId);
   out.push({mode,busyAfterCancellation,startProvider,endProvider:conversationProviderRevision(),triggered,oldDisposed,log,send:{committed:result.committed,reply:result.reply?.displayText||null,error:result.error},onReply,retry:{text:retried?.displayText,roles:afterRetry.turns.map(t=>t.role),original:afterRetry.turns[0].originalText,contentRevision:afterRetry.thread.contentRevision},roles:saved.turns.map(t=>t.role),texts:saved.turns.map(t=>t.displayText),pending:saved.thread.pending,contentRevision:saved.thread.contentRevision});
   await controller.dispose();latestRemoval?.();
  }
  return out;
 });
 for(const result of results){
  assert.equal(result.busyAfterCancellation,false,result.mode);assert.equal(result.send.committed,true,result.mode);assert.equal(result.send.reply,null,result.mode);
  assert.deepEqual(result.roles,['learner'],result.mode);assert.deepEqual(result.texts,['Vorrei un caffe.'],result.mode);
  assert.equal(result.contentRevision,1,result.mode);assert.notEqual(result.pending?.status,'pending',result.mode);
  assert.deepEqual(result.retry.roles,['learner','partner'],result.mode);assert.equal(result.retry.original,'Vorrei un caffe.',result.mode);assert.equal(result.retry.contentRevision,2,result.mode);assert.equal(result.onReply,1,result.mode);
  console.log('PASS',result.mode,'keeps learner-only; retry commits once');
 }
 const held=await page.evaluate(async()=>{
  const {createConversationRepository}=await import('./js/conversations/storage.js'),{createConversationController}=await import('./js/conversations/controller.js'),{installConversationProvider}=await import('./js/conversations/runtime.js');
  const out=[];
  for(const mode of ['sync-cleanup-failure','async-cleanup-failure']){
   const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
   const firstStarted=deferred(),firstRelease=deferred(),secondStarted=deferred(),secondRelease=deferred();let calls=0;
   const repository=createConversationRepository({profileId:'held-cancel',learnerId:mode}),threadId=crypto.randomUUID();await repository.createThread({level:'A1',support:'free',participants:[{id:'partner-1',name:'Giulia'}]},{threadId});
   const remove=installConversationProvider({readiness:()=>({written:true}),acquire:()=>({cancelScope(){if(mode==='sync-cleanup-failure')throw new Error('Injected stop failure');return Promise.reject(new Error('Injected async stop failure'));},async request(){const index=++calls;if(index===1){firstStarted.resolve();await firstRelease.promise;}else{secondStarted.resolve();await secondRelease.promise;}return {message:{participantId:'partner-1',text:index===1?'Old reply':'New reply'},corrections:[]};}})});
   const controller=createConversationController({repository,threadId,lookup:()=>({candidates:[]}),resolveEntry:()=>null});await controller.load();await controller.saveDraft('First learner message');
   const first=controller.send();await firstStarted.promise;await controller.cancel();const busyAfterCancel=controller.busy;
   const settled=await Promise.race([first,new Promise(resolve=>setTimeout(()=>resolve('still-waiting'),1000))]);
   await controller.saveDraft('Second learner message');const second=controller.send();await secondStarted.promise;firstRelease.resolve();await Promise.resolve();await Promise.resolve();const busyAfterLateOldReply=controller.busy;
   secondRelease.resolve();const secondResult=await second,saved=await repository.read(threadId);await controller.dispose();let closed=false;try{await repository.read(threadId);}catch(error){closed=error.name==='AbortError';}remove();
   out.push({mode,busyAfterCancel,settled:settled==='still-waiting'?settled:{committed:settled.committed,reply:settled.reply},busyAfterLateOldReply,secondReply:secondResult.reply?.displayText,roles:saved.turns.map(t=>t.role),texts:saved.turns.map(t=>t.displayText),closed});
  }
  return out;
 });
 for(const result of held){assert.equal(result.busyAfterCancel,false,result.mode);assert.notEqual(result.settled,'still-waiting',result.mode);assert.equal(result.settled.committed,true,result.mode);assert.equal(result.settled.reply,null,result.mode);assert.equal(result.busyAfterLateOldReply,true,result.mode);assert.equal(result.secondReply,'New reply',result.mode);assert.deepEqual(result.roles,['learner','learner','partner'],result.mode);assert.deepEqual(result.texts,['First learner message','Second learner message','New reply'],result.mode);assert.equal(result.closed,true,result.mode);console.log('PASS',result.mode,'settles immediately, preserves newer send and closes storage');}
 assert.deepEqual(errors,[]);
 const report={browser:name,scope:'Explicit test-only provider; real controller, repository and browser IndexedDB. No production model or language quality claim.',results,held};
 fs.writeFileSync('docs/implementation/programme/conversation-commit-boundary-'+name+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();stop();}
