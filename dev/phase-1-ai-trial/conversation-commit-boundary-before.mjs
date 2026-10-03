import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from '../../tests/lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer();
const name=process.env.COURSE_BROWSER||'chromium',browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions()),page=await context.newPage();
try{
 await page.goto(BASE);await page.waitForFunction(()=>!!document.querySelector('main'));
 const results=await page.evaluate(async()=>{
  const {createConversationRepository}=await import('./js/conversations/storage.js');
  const {createConversationController}=await import('./js/conversations/controller.js');
  const {installConversationProvider,conversationProviderRevision}=await import('./js/conversations/runtime.js');
  const out=[];
  for(const mode of ['replace-during-request','replace-before-transaction','cancel-after-transaction-start']){
   const owner={profileId:'test-commit-boundary',learnerId:mode},repository=createConversationRepository(owner),threadId=crypto.randomUUID();
   await repository.createThread({level:'A1',support:'free',participants:[{id:'partner-1',name:'Giulia'}]},{threadId});
   let controller,responseReady=false,triggered=false,latestRemoval=null,cancellation=null,oldDisposed=false,onReply=0;
   const log=[],replacement={readiness:()=>({written:false}),acquire:()=>{throw new Error('Not used');}};
   const response={message:{participantId:'partner-1',text:'Preferisci il caffè caldo?'},corrections:[],vocabulary:[],teaching:[],provenance:{testOnly:true}};
   const old={readiness:()=>({written:true,recorded:false,handsfree:false}),dispose:()=>{oldDisposed=true;},acquire:()=>({cancelScope(){},async request(){
    if(mode==='replace-during-request'){latestRemoval=installConversationProvider(replacement);log.push('provider replaced while service response pending');}
    responseReady=true;return response;
   }})};
   latestRemoval=installConversationProvider(old);const startProvider=conversationProviderRevision();
   controller=createConversationController({repository,threadId,lookup:()=>({candidates:[]}),resolveEntry:()=>null,onReply:()=>{onReply++;}});await controller.load();await controller.saveDraft('Vorrei un caffe.');
   const original=IDBDatabase.prototype.transaction;
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
   try{result=await controller.send();if(cancellation)await cancellation;}finally{IDBDatabase.prototype.transaction=original;}
   const saved=await repository.read(threadId);out.push({mode,startProvider,endProvider:conversationProviderRevision(),triggered,oldDisposed,log,send:{committed:result.committed,reply:result.reply?.displayText||null,error:result.error},onReply,roles:saved.turns.map(t=>t.role),texts:saved.turns.map(t=>t.displayText),pending:saved.thread.pending,contentRevision:saved.thread.contentRevision});
   await controller.dispose();latestRemoval?.();
  }
  return out;
 });
 const report={browser:name,scope:'Explicit test-only provider; real controller, repository and browser IndexedDB. No production model or language quality claim.',results};
 fs.writeFileSync('/tmp/parola-ai-commit-race-'+name+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();stop();}
