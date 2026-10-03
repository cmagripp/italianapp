import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer();
const browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(undefined,{viewport:{width:440,height:956}})),page=await context.newPage(),results=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
async function testProvider(){await page.evaluate(async()=>{
 const {installConversationProvider}=await import('./js/conversations/runtime.js'),{createAIService}=await import('./js/ai/index.js');
 window.testCalls=[];window.testHold=null;
 const service=createAIService({requireLanguageValidation:false,runtime:{async generate(task){testCalls.push(task);if(window.testHold)await window.testHold;const input=JSON.parse(task.messages.at(-1).content);return JSON.stringify({participantId:'partner-1',text:input.opening?'Ciao! Come stai?':'Anche a me piace il caffè. Vuoi un caffè?',corrections:[]});},cancel(){window.testRelease?.();}},isCurrent:()=>true});
 window.removeTestProvider=installConversationProvider({readiness:()=>({written:true,recorded:false,handsfree:false,reason:null}),acquire:()=>service,dispose:()=>service.dispose()});
 });}
try{
 await page.goto(BASE+'#/conversations');await page.locator('[data-new-conversation]').waitFor();
 await check('Setup creates a real saved thread; absent installed model never invents a greeting',async()=>{
  await page.locator('[data-new-conversation]').click();await page.locator('.conversation-name input').fill('Ada');await page.getByRole('button',{name:'Start conversation',exact:true}).click();
  await page.locator('[data-start-dialogue]').waitFor();assert.equal(await page.locator('[data-start-dialogue]').isDisabled(),true);
  assert.equal(await page.locator('.conversation-message').count(),0);assert.match(await page.locator('[data-conversation-status]').innerText(),/offline conversation pack/);
 });
 await check('Draft survives reload and remains isolated from progress',async()=>{
  await page.locator('[data-conversation-draft]').fill('Vorrei un caffè.');
  await page.waitForFunction(async()=>{const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');const r=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});try{return(await r.read(decodeURIComponent(location.hash.split('/')[2]))).draft?.typedText==='Vorrei un caffè.';}finally{r.close();}});
  await page.reload();await page.locator('[data-conversation-draft]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]').value==='Vorrei un caffè.');
  assert.equal(await page.evaluate(async()=>Object.keys((await import('./js/store.js')).store.learning.events).length),0);
 });
 await check('Explicit test provider supplies a greeting without a fictitious learner message',async()=>{
  await testProvider();await page.locator('[data-conversation-draft]').fill('');await page.waitForTimeout(80);await page.locator('[data-start-dialogue]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.conversation-message.partner').length===1);
  const r=await page.evaluate(()=>({roles:testCalls[0].messages.map(m=>m.role),last:JSON.parse(testCalls[0].messages.at(-1).content)}));
  assert.equal(r.last.opening,true);assert.equal(r.last.learnerMessage,null);assert.equal(await page.locator('.conversation-message.learner').count(),0);
 });
 await check('Send is durable and produces one actual partner reply; vocabulary notes do not award mastery',async()=>{
  await page.locator('[data-conversation-draft]').fill('Mi piace il caffè.');await page.locator('.conversation-send').click();
  await page.waitForFunction(()=>document.querySelectorAll('.conversation-message.partner').length===2);
  assert.equal(await page.locator('.conversation-message.learner').count(),1);assert.equal(await page.locator('[data-conversation-draft]').inputValue(),'');
  await page.locator('[data-summary]').click();await page.locator('.conversation-study-item').first().waitFor();
  assert.match(await page.locator('.conversation-summary').innerText(),/coffee/i);
  assert.equal(await page.evaluate(async()=>Object.keys((await import('./js/store.js')).store.learning.events).length),0);
  await page.keyboard.press('Escape');
 });
 await check('Word lookup displays noun forms; message notes and original edited text persist',async()=>{
  await page.locator('.conversation-message.learner [data-lookup-word="caffè"]').click();await page.locator('.journey-word-dialog[open]').waitFor();
  assert.match(await page.locator('.journey-word-dialog').innerText(),/Singular/);assert.match(await page.locator('.journey-word-dialog').innerText(),/Plural/);await page.keyboard.press('Escape');
  const id=await page.locator('.conversation-message.learner').getAttribute('data-turn');
  await page.evaluate(async turnId=>{const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');const r=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId}),threadId=decodeURIComponent(location.hash.split('/')[2]);const state=await r.read(threadId);await r.reviseTurn(threadId,turnId,{displayText:'Non mi piace il caffè.',expectedRevision:1});r.close();},id);
  await page.reload();await page.locator('.conversation-message.learner').waitFor();assert.match(await page.locator('.conversation-message.learner').innerText(),/Non mi piace/);assert.match(await page.locator('.conversation-message.learner').innerText(),/original kept/);
 });
 await check('Composer and summary remain visible with internal scrolling in a long conversation',async()=>{
  await page.evaluate(async()=>{const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');const r=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId}),threadId=decodeURIComponent(location.hash.split('/')[2]);for(let n=0;n<35;n++)await r.commitTurn(threadId,{turnId:'long-'+n,role:n%2?'learner':'partner',participantId:n%2?'learner':'partner-1',originalText:'Parliamo della nostra giornata. Come stai oggi?'});r.close();});
  await page.reload();await page.locator('.conversation-message').nth(35).waitFor();
  const box=await page.locator('.conversation-send').boundingBox();assert.ok(box.y+box.height<=956);assert.ok(box.y>=0);
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight,height:innerHeight,inner:document.querySelector('[data-messages]').scrollHeight,visible:document.querySelector('[data-messages]').clientHeight}));assert.ok(size.scroll<=size.height+1);assert.ok(size.inner>size.visible);
  await page.screenshot({path:'/tmp/parola-conversation-player.png'});
 });
 await check('An interrupted latest draft restores from its exact writer ancestry after reload',async()=>{
  await page.evaluate(async()=>{
   const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js'),{createDraftRecovery}=await import('./js/conversations/draft-recovery.js');
   const owner={profileId:store.current.id,learnerId:store.current.learnerId},threadId=decodeURIComponent(location.hash.split('/')[2]),r=createConversationRepository(owner);
   const state=await r.read(threadId),saved=await r.saveDraft(threadId,{typedText:'Prima bozza',turnId:'recovered-turn',clientId:'writer',writeId:'first-write'},{expectedRevision:state.draft?.revision||0});
   createDraftRecovery({...owner,threadId}).write({typedText:'La mia bozza più recente.',turnId:'recovered-turn',clientId:'writer',writeId:'last-write',base:{revision:0,writeId:null},priorWriteIds:['first-write']});r.close();
  });
  await page.reload();await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='La mia bozza più recente.');
  assert.equal(await page.locator('[data-conversation-draft]').getAttribute('readonly'),null);
 });
 await check('Conflicting recovered text stays accessible and never replaces another saved draft automatically',async()=>{
  await page.evaluate(async()=>{const{store}=await import('./js/store.js'),{createDraftRecovery}=await import('./js/conversations/draft-recovery.js');createDraftRecovery({profileId:store.current.id,learnerId:store.current.learnerId,threadId:decodeURIComponent(location.hash.split('/')[2])}).write({typedText:'Different unsent text',turnId:'different-turn',clientId:'other-writer',writeId:'conflict',base:{revision:0},priorWriteIds:[]});});
  await page.reload();await page.locator('[data-recovered-draft]').waitFor();assert.equal(await page.locator('[data-conversation-draft]').inputValue(),'La mia bozza più recente.');
  await page.locator('[data-recovered-draft]').click();assert.equal(await page.locator('.conversation-recovered-text').inputValue(),'Different unsent text');await page.locator('[data-keep-current]').click();
  assert.equal(await page.locator('[data-conversation-draft]').getAttribute('readonly'),null);
 });
 await check('Immediate in-app navigation keeps the latest input for exact resume',async()=>{
  const url=page.url();await page.locator('[data-conversation-draft]').fill('A presto, ci sentiamo domani.');await page.locator('a[aria-label="All conversations"]').click();await page.locator('[data-new-conversation]').waitFor();
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='A presto, ci sentiamo domani.');
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(`docs/implementation/programme/conversation-player-${process.env.COURSE_BROWSER||'chromium'}.json`,JSON.stringify({environment:process.env.COURSE_BROWSER||'chromium',model:'explicit test-only provider; no model quality claim',checks:results},null,2));
}finally{await context.close();await browser.close();stop();}
