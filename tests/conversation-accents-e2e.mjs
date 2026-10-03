import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium';
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(undefined,{viewport:{width:440,height:956}})),page=await context.newPage(),results=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=async(label,fn)=>{try{await fn();}catch(error){console.log('FAIL SNAPSHOT',await page.evaluate(async()=>({hash:location.hash,ui:document.querySelector('main')?.innerText,requests:window.accentRequests,record:await window.accentRead?.().catch(e=>e.message)})));throw error;}results.push(label);console.log('PASS',label);};
async function fixture(){await page.evaluate(async()=>{
 const {createAIService,createInputSpellingValidator}=await import('./js/ai/index.js'),{installConversationProvider}=await import('./js/conversations/runtime.js');
 const {createConversationRepository}=await import('./js/conversations/storage.js'),{store}=await import('./js/store.js');
 window.accentRequests=[];window.accentRuntime=[];window.accentHold=null;window.accentRelease=null;
 window.accentValidator=createInputSpellingValidator({registry:{version:'test-only-v1',lookup:id=>id==='coffee'?{id,revision:'1',source:'Explicit test fixture, not a production registry',reviewStatus:'independent-agent-review',forms:['caffè']}:null},confirmInterpretation:({baseNFC,candidateNFC})=>baseNFC==='Vorrei un caffe.'&&candidateNFC==='Vorrei un caffè.'});
 window.accentProposal={status:'candidate',candidate:'Vorrei un caffè.',references:[{id:'coffee',revision:'1',start:10,end:15}]};
 const service=createAIService({requireLanguageValidation:false,inputSpelling:{validator:accentValidator,async checkInput(request){accentRequests.push(request);if(accentHold)await accentHold;return accentProposal;}},runtime:{async generate(task){accentRuntime.push(JSON.parse(task.messages.at(-1).content));return JSON.stringify({participantId:'partner-1',text:'Certo, ecco il caffè.',corrections:[]});},cancel(){window.accentRelease?.();}}});
 window.removeAccentProvider=installConversationProvider({readiness:()=>({written:true,recorded:false,handsfree:false,reason:null}),acquire:()=>service,dispose:()=>service.dispose()});
 window.accentOwner={profileId:store.current.id,learnerId:store.current.learnerId};
 window.accentRead=async(threadId=window.accentThread)=>{const r=createConversationRepository(accentOwner);try{return await r.read(threadId);}finally{r.close();}};
 window.accentNew=async strict=>{const r=createConversationRepository(accentOwner);try{const thread=await r.createThread({name:'Ada',level:'A1',support:'free',participants:[{id:'partner-1',name:'Giulia'}]});accentThread=thread.threadId;store.setSetting('accentStrict',strict);location.hash='#/conversations/'+encodeURIComponent(accentThread);return accentThread;}finally{r.close();}};
 });}
async function openThread(strict){await page.evaluate(strict=>accentNew(strict),strict);await page.waitForFunction(()=>document.querySelector('[data-start-dialogue]')&&document.querySelector('[data-conversation-draft]:not([disabled])')?.value==='');}
async function sendCoffee(){await page.locator('[data-conversation-draft]').fill('Vorrei un caffe.');await page.locator('.conversation-send').click();await page.waitForFunction(()=>document.querySelectorAll('.conversation-message.partner').length===1);}
try{
 await page.goto(BASE+'#/conversations');await page.locator('[data-new-conversation]').waitFor();await fixture();
 await check('Strict-off submit restores the same bubble, keeps original and saved policy, and awards no learning credit',async()=>{
  await openThread(false);const before=await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.learning));await sendCoffee();
  assert.match(await page.locator('.conversation-message.learner > p').innerText(),/Vorrei un caffè\./);assert.equal(await page.locator('.conversation-message.learner').count(),1);
  assert.equal(await page.locator('[data-spelling-note] summary').innerText(),'Accent added');assert.equal(await page.locator('.conversation-edited').count(),0);
  await page.locator('[data-spelling-note] summary').click();assert.match(await page.locator('[data-spelling-note]').innerText(),/You wrote: Vorrei un caffe\./);
  const r=await page.evaluate(async()=>({state:await accentRead(),request:accentRequests.at(-1),runtime:accentRuntime.at(-1),learning:JSON.stringify((await import('./js/store.js')).store.learning)}));
  const learner=r.state.turns[0];assert.equal(learner.originalText,'Vorrei un caffe.');assert.equal(learner.submittedText,learner.originalText);assert.equal(learner.displayText,'Vorrei un caffè.');assert.equal(learner.revision,2);assert.equal(learner.policySnapshot.strictAccents,false);assert.equal(learner.history[0].editReason,'accent-restoration');assert.equal(learner.history[0].displayText,learner.originalText);assert.equal(r.state.thread.contentRevision,2);assert.equal(r.state.turns[1].sourceContext.inputSpellingSourceRevision,2);assert.equal(r.request.text,'Vorrei un caffe.');assert.equal(r.runtime.text,'Vorrei un caffè.');assert.equal(r.learning,before);
 });
 await check('Reload retains the correction and its original; an explicit later edit makes the note historical',async()=>{
  await page.reload();await page.locator('[data-spelling-note]').waitFor();assert.equal(await page.locator('[data-spelling-note] summary').innerText(),'Accent added');
  await fixture();await page.evaluate(async()=>{accentThread=decodeURIComponent(location.hash.split('/')[2]);const{createConversationRepository}=await import('./js/conversations/storage.js');const r=createConversationRepository(accentOwner);const state=await r.read(accentThread);await r.reviseTurn(accentThread,state.turns[0].turnId,{displayText:'Vorrei un tè.',expectedRevision:2});r.close();});
  await page.reload();await page.locator('[data-spelling-note]').waitFor();assert.equal(await page.locator('[data-spelling-note] summary').innerText(),'Earlier spelling note');assert.match(await page.locator('.conversation-message.learner > p').innerText(),/Vorrei un tè/);assert.equal(await page.locator('.conversation-edited').count(),1);await fixture();
 });
 await check('Saved strict-on policy wins even if Settings changes while the spelling check waits',async()=>{
  await openThread(true);await page.evaluate(()=>{accentHold=new Promise(resolve=>accentRelease=resolve);});
  await page.locator('[data-conversation-draft]').fill('Vorrei un caffe.');await page.locator('.conversation-send').click();await page.waitForFunction(()=>accentRequests.length===1);
  await page.evaluate(async()=>{(await import('./js/store.js')).store.setSetting('accentStrict',false);accentRelease();});
  await page.waitForFunction(()=>document.querySelectorAll('.conversation-message.partner').length===1);
  assert.match(await page.locator('.conversation-message.learner > p').innerText(),/Vorrei un caffe\./);assert.equal(await page.locator('[data-spelling-note] summary').innerText(),'A spelling note');
  const r=await page.evaluate(async()=>({state:await accentRead(),runtime:accentRuntime.at(-1)}));const t=r.state.turns[0];assert.equal(t.policySnapshot.strictAccents,true);assert.equal(t.displayText,t.originalText);assert.equal(r.state.turns[1].sourceContext.inputSpelling.outcome,'spelling-feedback');assert.equal(t.revision,1);assert.deepEqual(t.history,[]);assert.equal(r.runtime.text,'Vorrei un caffe.');
 });
 await check('Confirmed speech spelling is not treated as a typed mistake or automatically rewritten',async()=>{
  await openThread(true);
  await page.evaluate(async()=>{const{createConversationRepository}=await import('./js/conversations/storage.js');const r=createConversationRepository(accentOwner);await r.saveDraft(accentThread,{turnId:'confirmed-speech',typedText:'Vorrei un caffe.',mode:'recorded',inputProvenance:{mode:'recorded',recognizedText:'Vorrei un caffe.',recognitionUncertain:false,transcriptEdits:[]}});r.close();});
  await page.reload();await page.locator('[data-conversation-draft]:not([disabled])').waitFor();await fixture();await page.evaluate(()=>{accentThread=decodeURIComponent(location.hash.split('/')[2]);});await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='Vorrei un caffe.');await page.locator('.conversation-send').click();await page.waitForFunction(()=>document.querySelectorAll('.conversation-message.partner').length===1);
  const r=await page.evaluate(()=>accentRead());assert.equal(r.turns[0].revision,1);assert.equal(r.turns[0].displayText,'Vorrei un caffe.');assert.equal(r.turns[1].sourceContext.inputSpelling.outcome,'unsupported');assert.equal(r.turns[1].sourceContext.inputSpelling.inputOrigin,'recognition-or-mixed');assert.equal(await page.locator('[data-spelling-note]').count(),0);
 });
 const storage=await page.evaluate(async()=>{
  const {createConversationRepository}=await import('./js/conversations/storage.js');
  const r=createConversationRepository({profileId:'accent-atomic',learnerId:'one'}),out=[];
  const descriptor=t=>Object.fromEntries(['turnId','revision','originalText','submittedText','displayText','policySnapshot','inputProvenance'].map(key=>[key,t[key]??null]));
  const prepare=async id=>{
   await r.createThread({level:'A1',support:'free',participants:[{id:'partner-1',name:'Giulia'}]},{threadId:id});
   let source=await r.commitTurn(id,{turnId:'learner',role:'learner',participantId:'learner',originalText:'Vorrei un caffe.',displayText:'Vorrei un caffe.',submittedText:'Vorrei un caffe.',policySnapshot:{version:'conversation-v1',strictAccents:id==='strict-existing-notes'},inputProvenance:{mode:'written'}});
   if(id.endsWith('existing-notes')){source=await r.chooseMeaning(id,'learner',{start:10,end:15,quote:'caffe',entryId:'test:coffee'},{expectedRevision:1});const state=await r.read(id);await r.saveSummary(id,{items:[{id:'my-note',kind:'note',author:'learner',text:'My own word note',sourceRefs:[{turnId:'learner',revision:source.revision}]}]},{sourceRevision:state.thread.contentRevision});}
   const token=await r.beginGeneration(id),scope=`conversation:accent-atomic:one:${id}`,receipt=await accentValidator.validate(accentProposal,{inputSubmission:descriptor(source),scope,sourceRevision:token.sourceRevision});
   const input={turnId:'partner',role:'partner',participantId:'partner-1',originalText:'Certo.',correctionRefs:[{ruleId:'test-grammar-only',original:'caffè',replacement:'caffè',sourceTurnId:'learner',sourceTurnRevision:source.revision}]};
   return {source,token,receipt,input,options:{requestId:token.id,inputSpelling:receipt}};
  };
  for(const mode of ['quota-after-source','abort-after-source','copied-receipt','newer-edit','newer-message','changed-owner','duplicate','strict-existing-notes','restore-existing-notes']){
   const p=await prepare(mode),before=await r.read(mode),put=IDBObjectStore.prototype.put,signal=new AbortController();let error=null,triggered=false,first=null,retry=null;
   if(mode==='quota-after-source'||mode==='abort-after-source')IDBObjectStore.prototype.put=function(value,...args){
    if(this.name==='turns'&&value.role==='partner'&&mode==='quota-after-source')throw new DOMException('Injected quota failure','QuotaExceededError');
    const result=put.call(this,value,...args);if(!triggered&&this.name==='turns'&&value.role==='learner'&&value.revision===2&&mode==='abort-after-source'){triggered=true;queueMicrotask(()=>signal.abort());}return result;
   };
   if(mode==='copied-receipt')p.options.inputSpelling=structuredClone(p.receipt);
   if(mode==='newer-edit')await r.reviseTurn(mode,'learner',{displayText:'Vorrei un tè.',expectedRevision:1});
   if(mode==='newer-message')await r.commitTurn(mode,{turnId:'new-learner',role:'learner',participantId:'learner',originalText:'Anzi, un tè.'});
   if(mode==='changed-owner'){
    const {createInputSpellingValidator}=await import('./js/ai/input-spelling.js');p.options.inputSpelling=await createInputSpellingValidator().validate(null,{...p.receipt.source,scope:'conversation:wrong:owner:'+mode});
   }
   try{first=await r.commitTurn(mode,p.input,{...p.options,signal:signal.signal});if(mode==='duplicate')retry=await r.commitTurn(mode,p.input,p.options);}catch(e){error=e.name;}finally{IDBObjectStore.prototype.put=put;}
   const after=await r.read(mode),{buildConversationSummary}=await import('./js/conversations/summary.js');const rebuilt=buildConversationSummary({thread:after.thread,turns:after.turns,previous:after.summary},{lookup:()=>({candidates:[]}),resolveEntry:()=>null});
   out.push({mode,error,triggered,before,after,rebuilt,first,retry});
  }
  const exported=await r.exportRecords(),copy=createConversationRepository({profileId:'accent-import',learnerId:'one'});await copy.importRecords(exported);const imported=await copy.read('duplicate');copy.close();r.close();return {cases:out,imported};
 });
 await check('Quota failure and cancellation after source write roll back both the accent and partner',async()=>{
  for(const mode of ['quota-after-source','abort-after-source']){const r=storage.cases.find(r=>r.mode===mode);assert.equal(r.error,mode==='quota-after-source'?'QuotaExceededError':'AbortError');assert.deepEqual(r.after,r.before,mode);}
 });
 await check('Cloned, wrong-owner and stale receipts cannot rewrite a source or save a partner',async()=>{
  for(const mode of ['copied-receipt','changed-owner','newer-edit','newer-message']){const r=storage.cases.find(r=>r.mode===mode);assert.ok(r.error,mode);assert.equal(r.after.turns.filter(t=>t.role==='partner').length,0,mode);assert.equal(r.after.turns[0].displayText,mode==='newer-edit'?'Vorrei un tè.':'Vorrei un caffe.',mode);}
 });
 await check('Strict-on notes preserve the unchanged chosen meaning and personal note; a restored source invalidates prior references',async()=>{
  const strict=storage.cases.find(r=>r.mode==='strict-existing-notes');assert.equal(strict.error,null);assert.deepEqual(strict.after.turns[0],strict.before.turns[0]);assert.equal(strict.after.turns[1].sourceContext.inputSpellingSourceRevision,2);assert.equal(strict.rebuilt.items[0].invalidated,false);assert.deepEqual(strict.after.summary.items,strict.before.summary.items);
  const restored=storage.cases.find(r=>r.mode==='restore-existing-notes');assert.equal(restored.error,null);assert.equal(restored.after.turns[0].revision,3);assert.equal(restored.after.turns[0].sourceContext.lexicalChoices[0].revision,2);assert.equal(restored.rebuilt.items[0].invalidated,true);assert.equal(restored.after.summary.items[0].invalidated,true);
 });
 await check('Exact retry is idempotent; correction references use final source revision and import preserves recorded history',async()=>{
  const r=storage.cases.find(r=>r.mode==='duplicate');assert.equal(r.error,null);assert.deepEqual(r.first,r.retry);assert.equal(r.after.turns.length,2);assert.equal(r.after.turns[0].revision,2);assert.equal(r.after.turns[0].history.length,1);assert.equal(r.after.turns[1].correctionRefs[0].sourceTurnRevision,2);assert.equal(r.after.thread.contentRevision,2);assert.equal(storage.imported.turns[0].displayText,'Vorrei un caffè.');assert.equal(storage.imported.turns[0].originalText,'Vorrei un caffe.');assert.deepEqual(storage.imported.turns[0].history,r.after.turns[0].history);
 });
 // Start with genuine saved receipts, then forge only the declared imported
 // field. Otherwise-valid controls ensure rejection is not a stale schema or
 // origin accident. Serialized receipts explain history; they grant no power
 // to rewrite a learner message or award evidence.
 const importedNotes=await page.evaluate(async()=>{
  const {createConversationRepository}=await import('./js/conversations/storage.js'),{store}=await import('./js/store.js');
  const {compareSubmission}=await import('./js/learning/answer-policy.js');
  const owner={profileId:store.current.id,learnerId:store.current.learnerId},sourceProfile='accent-note-import-source';
  const source=createConversationRepository({profileId:sourceProfile,learnerId:owner.learnerId}),target=createConversationRepository(owner),cases=[];
  const fields=['turnId','revision','originalText','submittedText','displayText','policySnapshot','inputProvenance'];
  const descriptor=t=>Object.fromEntries(fields.map(key=>[key,t[key]??null]));
  try{
   for(const kind of ['valid-strict-current','original','submitted','policy','provenance','strict-policy','valid-strict-history','valid-restore-current','valid-restore-history','effective-does-not-match-candidate','candidate-has-no-accent-change']){
    const strict=!['valid-restore-current','valid-restore-history','effective-does-not-match-candidate','candidate-has-no-accent-change'].includes(kind);
    const thread=await source.createThread({name:'Ada',level:'A1',support:'free',participants:[{id:'partner-1',name:'Giulia'}]}),threadId=thread.threadId;
    const learner=await source.commitTurn(threadId,{turnId:crypto.randomUUID(),role:'learner',participantId:'learner',originalText:'Vorrei un caffe.',submittedText:'Vorrei un caffe.',policySnapshot:{version:'conversation-v1',strictAccents:strict,level:'A1',support:'free'},inputProvenance:{mode:'written',assistance:[]}});
    const token=await source.beginGeneration(threadId),receipt=await accentValidator.validate(accentProposal,{scope:`conversation:${sourceProfile}:${owner.learnerId}:${threadId}`,sourceRevision:token.sourceRevision,inputSubmission:descriptor(learner)});
    if(receipt.version!==1||receipt.inputOrigin!=='typed'||receipt.outcome!==(strict?'spelling-feedback':'restore-display'))throw new Error('Imported note control must be a genuine current typed receipt');
    await source.commitTurn(threadId,{turnId:crypto.randomUUID(),role:'partner',participantId:'partner-1',originalText:'Certo.'},{requestId:token.id,inputSpelling:receipt});
    if(kind.endsWith('-history')){const saved=await source.read(threadId);await source.reviseTurn(threadId,learner.turnId,{displayText:'Vorrei un tè.',expectedRevision:saved.turns[0].revision});}
    cases.push({kind,threadId,learnerId:learner.turnId});
   }
   const bundle=JSON.parse(JSON.stringify(await source.exportRecords()));
   for(const row of cases){
    const partner=bundle.records.turns.find(t=>t.threadId===row.threadId&&t.role==='partner'),receipt=partner.sourceContext.inputSpelling,submission=receipt.source.inputSubmission;
    if(row.kind==='original'){submission.originalText='Vorrei un altro caffe.';receipt.originalNFC=submission.originalText.normalize('NFC');}
    if(row.kind==='submitted')submission.submittedText='Vorrei un altro caffe.';
    if(row.kind==='policy')submission.policySnapshot.level='B1';
    if(row.kind==='provenance')submission.inputProvenance.assistance=['An imported claim'];
    if(row.kind==='strict-policy')submission.policySnapshot.strictAccents=false;
    if(row.kind==='effective-does-not-match-candidate')receipt.effectiveText='Vorrei un tè.';
    if(row.kind==='candidate-has-no-accent-change'){
     receipt.candidateNFC=receipt.baseNFC;receipt.effectiveText=receipt.baseNFC;
     receipt.comparison=compareSubmission(submission.displayText,receipt.candidateNFC,{accentStrict:submission.policySnapshot.strictAccents,inputMode:'typed',language:'it',trailingPunctuation:false});
     receipt.differences=receipt.comparison.accentDifferences;receipt.references=[];
    }
    // A genuine restored turn also retains a legacy receipt copy. Corrupt both
    // copies in these imported cases so a still-valid fallback does not hide
    // the exact malformed receipt being tested.
    const learner=bundle.records.turns.find(t=>t.threadId===row.threadId&&t.role==='learner');
    if(learner.sourceContext?.inputSpelling)learner.sourceContext.inputSpelling=structuredClone(receipt);
    row.receipt=receipt;
   }
   await target.importRecords(bundle);
   for(const row of cases)row.savedLearner=(await target.read(row.threadId)).turns.find(t=>t.turnId===row.learnerId);
   return {cases,learning:JSON.stringify(store.learning)};
  }finally{source.close();target.close();}
 });
 for(const row of importedNotes.cases)await check('Imported spelling note: '+row.kind,async()=>{
  await page.evaluate(id=>{accentThread=id;location.hash='#/conversations/'+encodeURIComponent(id);},row.threadId);
  await page.waitForFunction(id=>document.querySelector(`[data-turn="${id}"]`)&&document.querySelector('[data-conversation-draft]:not([disabled])'),row.learnerId);
  const learner=page.locator(`[data-turn="${row.learnerId}"]`),expected=row.kind.startsWith('valid-')?1:0;
  assert.equal(await learner.locator('[data-spelling-note]').count(),expected,row.kind);
  if(expected){
   const title=row.kind.endsWith('-history')?'Earlier spelling note':row.kind.includes('-restore-')?'Accent added':'A spelling note';
   assert.equal(await learner.locator('[data-spelling-note] summary').innerText(),title);
   await learner.locator('[data-spelling-note] summary').click();
   assert.match(await learner.locator('[data-spelling-note]').innerText(),/Vorrei un caffè\./);
   assert.match(await learner.locator('[data-spelling-note]').innerText(),/You wrote: Vorrei un caffe\./);
  }
  assert.equal(await learner.locator(':scope > p').innerText(),row.savedLearner.displayText);
  const saved=await page.evaluate(async({threadId,learnerId})=>({learner:(await accentRead(threadId)).turns.find(t=>t.turnId===learnerId),learning:JSON.stringify((await import('./js/store.js')).store.learning)}),row);
  assert.deepEqual(saved.learner,row.savedLearner,'Import/display cannot rewrite the saved learner or its history');
  assert.equal(saved.learning,importedNotes.learning,'Imported spelling history awards no learning evidence');
 });
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`docs/implementation/programme/conversation-accents-${name}.json`,JSON.stringify({browser:name,scope:'Actual controller/storage/UI with explicit test-only spelling registry, interpretation checker and runtime. No production language-quality claim.',checks:results,importedNoteCases:importedNotes.cases.map(({kind,receipt,savedLearner})=>({kind,expectedNoteCount:kind.startsWith('valid-')?1:0,receipt,savedLearner}))},null,2)+'\n');
}finally{await context.close();await browser.close();stop();}
