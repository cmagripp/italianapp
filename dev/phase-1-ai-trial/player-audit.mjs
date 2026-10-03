// Isolated synthetic data and explicitly injected test provider only. Never
// imported by product code. Preserve before/after reports independently.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {ensureServer} from '../../tests/lib.mjs';
const {chromium}=await import(pathToFileURL('/tmp/parola-grammar-tools/node_modules/playwright/index.mjs'));
const base='http://127.0.0.1:8158/',stop=await ensureServer(base),browser=await chromium.launch({channel:'chrome',headless:true});
const report={testedAt:new Date().toISOString(),scope:'Independent synthetic browser/controller fixtures, explicit test-only provider; no user records or model readiness claim'};
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:440,height:956}}),page=await context.newPage();
 await page.goto(base+'#/conversations');await page.locator('[data-new-conversation]').waitFor();
 report.import=await page.evaluate(async()=>{
  const {store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');
  const repo=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});
  await repo.createThread({level:'A2',participants:[{id:'partner',name:'Giulia'}]},{threadId:'audit-import'});
  await repo.commitTurn('audit-import',{turnId:'source',role:'learner',participantId:'learner',originalText:'Mi chiamo Ada.'});
  await repo.commitTurn('audit-import',{turnId:'partner',role:'partner',participantId:'partner',originalText:'Va bene.'});
  const bundle=await repo.exportRecords();
  bundle.records.turns.find(t=>t.turnId==='partner').correctionRefs=[{sourceTurnId:'source',sourceTurnRevision:1,original:'Mi chiamo Ada.',replacement:'Mi chiami Ada.',ruleId:'invented-rule',reason:'Mi chiamo is always incorrect: use mi chiami.'}];
  let error=null;try{await repo.importRecords(bundle,{mode:'replace'});}catch(e){error=e.message;}finally{repo.close();}
  return {error};
 });
 await page.goto(base+'#/conversations/audit-import');await page.locator('.conversation-message.partner').waitFor();
 report.import.tips=await page.locator('.conversation-correction').allTextContents();
 report.import.summaryCorrectionCount=await page.evaluate(async()=>{const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');const r=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});try{return(await r.read('audit-import')).summary.items.filter(i=>i.kind==='correction').length;}finally{r.close();}});
 await page.evaluate(async()=>{const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');const r=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});try{await r.reviseTurn('audit-import','source',{displayText:'Sono Ada.',expectedRevision:1});}finally{r.close();}});
 await page.reload();await page.locator('.conversation-message.partner').waitFor();report.import.staleTips=await page.locator('.conversation-correction').allTextContents();
 report.overlap=await page.evaluate(async()=>{
  const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js'),{createConversationController}=await import('./js/conversations/controller.js'),{installConversationProvider}=await import('./js/conversations/runtime.js');
  const repo=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});await repo.createThread({level:'A1',participants:[{id:'partner',name:'Giulia'}]},{threadId:'audit-overlap'});await repo.commitTurn('audit-overlap',{turnId:'source',role:'learner',participantId:'learner',originalText:'Mi piace il sole.'});
  let calls=0,rejectFirst,resolveSecond,releaseOldCancel,cancelCount=0;
  const first=new Promise((_,reject)=>rejectFirst=reject),second=new Promise(resolve=>resolveSecond=resolve),oldCancel=new Promise(resolve=>releaseOldCancel=resolve);
  const service={request(){return ++calls===1?first:second;},cancelScope(){if(calls===1)rejectFirst(new DOMException('Cancelled','AbortError'));}};
  const remove=installConversationProvider({readiness:()=>({written:true,recorded:false,handsfree:false}),acquire:()=>service});
  const cancel=repo.cancelGeneration.bind(repo);repo.cancelGeneration=async(...args)=>{if(++cancelCount===2)await oldCancel;return cancel(...args);};
  const c=createConversationController({repository:repo,threadId:'audit-overlap',lookup:()=>({candidates:[]}),resolveEntry:()=>null});await c.load();const a=c.reply();
  while(calls<1)await new Promise(r=>setTimeout(r,0));await c.cancel();const b=c.reply();while(calls<2)await new Promise(r=>setTimeout(r,0));
  const busyBeforeOldFinally=c.busy;releaseOldCancel();await a;const busyAfterOldFinally=c.busy,pending=(await repo.read('audit-overlap')).thread.pending;
  resolveSecond({message:{participantId:'partner',text:'Una risposta di prova.'},corrections:[],provenance:{}});await b;await c.dispose();remove();
  return {busyBeforeOldFinally,busyAfterOldFinally,newerRequestStillPending:!!pending,generationCalls:calls};
 });
 report.crossWriter=await page.evaluate(async()=>{
  const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js'),{createConversationController}=await import('./js/conversations/controller.js'),{createDraftRecovery}=await import('./js/conversations/draft-recovery.js');
  const owner={profileId:store.current.id,learnerId:store.current.learnerId},a=createConversationRepository(owner),b=createConversationRepository(owner),threadId='audit-writers';
  await a.createThread({level:'A1',participants:[{id:'partner',name:'Giulia'}]},{threadId});
  const args={threadId,lookup:()=>({candidates:[]}),resolveEntry:()=>null},ca=createConversationController({...args,repository:a}),cb=createConversationController({...args,repository:b});await ca.load();await cb.load();
  let release,started=false;const gate=new Promise(r=>release=r),save=a.saveDraft.bind(a);a.saveDraft=async(...args)=>{started=true;await gate;return save(...args);};
  let failed;const pa=ca.saveDraft('Testo A ancora non salvato.').catch(e=>failed=e.message);while(!started)await new Promise(r=>setTimeout(r,0));
  const recovery=createDraftRecovery({...owner,threadId}),mirrorBeforeB=recovery.read()?.typedText;
  await cb.saveDraft('Testo B salvato da un altro scrittore.');const mirrorAfterB=recovery.read()?.typedText||null;
  release();await pa;await ca.dispose();await cb.dispose();
  const r=createConversationRepository(owner),c=createConversationController({...args,repository:r});await c.load();
  const result={mirrorBeforeB,mirrorAfterB,firstWriterError:failed||null,databaseText:c.state.draft?.typedText,recoveredConflictText:c.recoverText()};await c.dispose();return result;
 });
 report.recoveredRecognition=await page.evaluate(async()=>{
  const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js'),{createConversationController}=await import('./js/conversations/controller.js'),{installConversationProvider}=await import('./js/conversations/runtime.js');
  const owner={profileId:store.current.id,learnerId:store.current.learnerId},threadId='audit-recognition',repo=createConversationRepository(owner);await repo.createThread({level:'A2',participants:[{id:'partner',name:'Giulia'}]},{threadId});
  const args={threadId,lookup:()=>({candidates:[]}),resolveEntry:()=>null},c=createConversationController({...args,repository:repo});await c.load();
  repo.saveDraft=async()=>{throw Error('Fixture: interrupted IndexedDB write after journal');};
  await c.saveDraft('Ieri andato al mercato.',{mode:'recorded',recognizedText:'ieri andato mercato',transcriptEdits:[{before:'ieri andato mercato',after:'Ieri andato al mercato.'}],selectedHelp:['hint-used'],inputProvenance:{mode:'recorded',recognitionUncertain:true}}).catch(()=>{});await c.dispose();
  const r=createConversationRepository(owner),next=createConversationController({...args,repository:r});await next.load();const recovered=structuredClone(next.state.draft);let generatedRequest;
  const remove=installConversationProvider({readiness:()=>({written:true,recorded:false,handsfree:false}),acquire:()=>({request:async request=>{generatedRequest=request;return{message:{participantId:'partner',text:'Una risposta di prova.'},corrections:[],provenance:{}};},cancelScope(){}})});
  await next.send();await next.dispose();remove();
  return {recoveredDraft:recovered,generationRecognizedAsUncertain:generatedRequest?.recognitionUncertain};
 });
 report.providerReplacement=await page.evaluate(async()=>{
  const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js'),{createConversationController}=await import('./js/conversations/controller.js'),{installConversationProvider}=await import('./js/conversations/runtime.js');
  const repo=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId}),threadId='audit-provider-swap';await repo.createThread({level:'A1',participants:[{id:'partner',name:'Giulia'}]},{threadId});await repo.commitTurn(threadId,{turnId:'source',role:'learner',participantId:'learner',originalText:'Mi piace il sole.'});
  let disposedA=false,callsA=0,callsB=0;
  const output=()=>({message:{participantId:'partner',text:'Una risposta di prova.'},corrections:[],provenance:{}});
  const serviceA={request:async()=>{callsA++;if(disposedA)throw Error('Fixture service A disposed');return output();},cancelScope(){}},serviceB={request:async()=>{callsB++;return output();},cancelScope(){}};
  installConversationProvider({readiness:()=>({written:true,recorded:false,handsfree:false}),acquire:()=>serviceA,dispose(){disposedA=true;}});
  const c=createConversationController({repository:repo,threadId,lookup:()=>({candidates:[]}),resolveEntry:()=>null});await c.load();const firstReply=await c.reply();
  const removeB=installConversationProvider({readiness:()=>({written:true,recorded:false,handsfree:false}),acquire:()=>serviceB});const replacementReply=await c.reply(),error=c.error;await c.dispose();removeB();
  return {firstReply,replacementReply,error,callsA,callsB};
 });
 await context.close();
}finally{await browser.close();stop();}
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'ai-player-audit.json';
if(!/^ai-[a-z0-9-]+\.json$/.test(output))throw Error('Use an ai- report filename');
await writeFile(new URL('../../docs/implementation/programme/'+output,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
