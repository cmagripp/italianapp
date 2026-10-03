import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,ensureServer,contextOptions,boot,gotoRoute} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium';
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),checks=[],errors=[];let context,page,passed=false;
const check=async(label,run)=>{await run();checks.push(label);console.log('PASS',label);};
const sheet=()=>page.locator('.sheet-wrap.open').getByRole('dialog',{name:'A little help'});
async function fresh(){
 await context?.close();context=await browser.newContext(contextOptions(undefined,{viewport:{width:430,height:932},reducedMotion:'reduce'}));page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await boot(page);
}
async function provider({reply='Pensa alla persona che parla.',delay=false,unsupported=false}={}){
 await page.evaluate(async({reply,delay,unsupported})=>{
  const {createAIService,createGrounding}=await import('./js/ai/index.js'),{createPracticeSourceResolver}=await import('./js/learning/practice-sources.js'),runtime=await import('./js/conversations/runtime.js');
  window.helpRequests=[];window.helpReply=reply;window.helpDelay=delay;
  // Explicit synthetic generator and permissive language fixture. The actual
  // catalogue/source resolver is exercised; this proves no model quality.
  window.helpService=createAIService({practiceSources:unsupported?undefined:createPracticeSourceResolver(),grounding:createGrounding({rules:[{id:'unrelated-test-rule',verified:true,level:'A1',source:'https://example.test',explanation:'UNRELATED TEST AUTHORITY',keywords:['unrelated']}] }),languagePolicy:{version:'test-only',validate:()=>({ok:true})},runtime:{async generate(task){helpRequests.push(task);if(helpDelay)await new Promise(resolve=>window.releaseHelp=resolve);return JSON.stringify({participantId:'helper',text:helpReply,corrections:[]});}}});
  window.removeHelpProvider=runtime.installConversationProvider({readiness:()=>({written:true}),acquire:async()=>helpService});
 },{reply,delay,unsupported});
}
async function journey(entryId='v:domandare'){
 const seeded=await page.evaluate(async entryId=>{
  const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{createJourneySession}=await import('./js/learning/journey.js'),{createJourneyScene}=await import('./js/learning/journey-scene.js');
  store.setSetting('adaptiveLearning',true);store.setSetting('tts',false);
  const entry=getEntry(entryId),plan=buildLesson(entry),chapter=plan.chapters.find(chapter=>chapter.id==='present'),targets=chapter.groups.flatMap(group=>group.targets),target=targets.find(target=>target.skill==='conjugation'&&target.person===0);
  const session=createJourneySession({id:crypto.randomUUID(),plan,chapterId:chapter.id,caseMode:true,now:Date.now()}),scene=createJourneyScene({entryId,chapterId:chapter.id,target,variant:0});
  Object.assign(session.journey,{phase:'practice',serial:1,queue:[target.id],current:{targetId:target.id,phase:'independent',format:'type',variant:0,questionId:`${session.id}:journey:1`,supplemental:false,repairTag:null,scenePolicy:'expanded-v1',sceneRevision:scene.sourceRevision,sceneSnapshot:scene}});
  session.journey.variants[target.id]={guided:0,independent:1,repair:0};session.ui={version:2,questionId:session.journey.current.questionId,draft:'doman',given:'',assistance:[],exposures:{},history:[],overview:false};store.saveLearningSession(session);await store.saveNow();return{id:session.id,answer:scene.context.answer,sentence:scene.context.it};
 },entryId);
 await gotoRoute(page,`/learn/verb/${encodeURIComponent(entryId)}?session=${encodeURIComponent(seeded.id)}`);await page.locator('[data-answer]').waitFor();return seeded;
}
const state=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js');return{session:store.learning.session,events:Object.values(store.learning.events),completions:store.learning.completions};});
async function request(task='hint',text='Keep my original question'){
 await page.locator(`[data-ai-journey-help="${task}"]`).click();await sheet().waitFor();await sheet().locator('[data-assistance-intent]').fill(text);await sheet().locator('[data-assistance-request]').click();
}
try{
 await check('Real Journey keeps authored help while production AI controls remain unavailable',async()=>{
  await fresh();await journey();assert.equal(await page.locator('[data-ai-journey-help]').count(),0);assert.equal(await page.locator('[data-help]').count(),1);assert.equal((await state()).events.length,0);
 });
 await check('Original help question persists through reopen without trusting or replaying a generated response',async()=>{
  await fresh();await provider();await journey();await page.locator('[data-ai-journey-help="hint"]').click();await sheet().waitFor();await sheet().locator('[data-assistance-intent]').fill('My unchanged question');await page.evaluate(async()=>await(await import('./js/store.js')).store.saveNow());await sheet().locator('[data-assistance-close]').click();await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-answer]').waitFor();await provider();await page.locator('[data-ai-journey-help="hint"]').click();await sheet().waitFor();assert.equal(await sheet().locator('[data-assistance-intent]').inputValue(),'My unchanged question');assert.equal(await sheet().locator('[data-assistance-wording]').count(),0);assert.equal(await page.evaluate(()=>helpRequests.length),0);assert.equal((await state()).events.length,0);assert.equal(await page.locator('[data-answer]').inputValue(),'doman');
 });
 await check('Hint exposure binds exact scene and original draft; only the subsequent canonical answer records assisted evidence',async()=>{
  await fresh();await provider();const source=await journey();await request();await sheet().locator('[data-assistance-wording]').waitFor();let saved=await state();assert.equal(saved.events.length,0);assert.equal(await sheet().getByText(source.sentence,{exact:true}).count(),0);assert(saved.session.ui.assistance.includes('hint'));assert.equal(saved.session.aiAssistance.history[0].originalText,'Keep my original question');assert.match(saved.session.aiAssistance.history[0].sourceRevision,/^help:[a-f0-9]{64}$/);assert.deepEqual(saved.session.aiAssistance.history[0].practiceSource.ruleIds,[]);await sheet().locator('[data-assistance-close]').click();await page.locator('[data-answer]').fill(source.answer);await page.locator('[data-check]').click();saved=await state();assert.equal(saved.events.length,1);assert(saved.events[0].assistance.includes('hint'));assert.equal(saved.events[0].ok,true);assert.equal(Object.keys(saved.completions).length,0);
 });
 await check('Explanation uses the selected authored example and does not retrieve an unrelated lexical rule',async()=>{
  await fresh();await provider({reply:'Guarda questo esempio.'});const source=await journey();await request('explain','unrelated');await sheet().locator('[data-assistance-wording]').waitFor();assert.equal(await sheet().getByText('Example from this lesson',{exact:true}).count(),1);assert.equal(await sheet().getByText(source.sentence,{exact:true}).count(),1);assert(!await sheet().textContent().then(text=>text.includes('UNRELATED TEST AUTHORITY')));assert.equal(await sheet().getByRole('link',{name:'Reference source'}).count(),0);assert.equal((await state()).events.length,0);const prompt=await page.evaluate(()=>helpRequests[0].messages[0].content);assert(prompt.includes(source.sentence));assert(!prompt.includes('UNRELATED TEST AUTHORITY'));
 });
 await check('Unsupported installed provider source fails before generation and leaves authored help available',async()=>{
  await fresh();await provider({unsupported:true});await journey();await request();await sheet().getByRole('alert').filter({hasText:'verified help binding'}).waitFor();assert.equal(await page.evaluate(()=>helpRequests.length),0);assert.equal((await state()).session.aiAssistance.history.length,0);assert.equal(await page.locator('[data-help]').count(),1);
 });
 await check('A canonical answer disclosed as a hint is rejected before receipts or grading',async()=>{
  await fresh();await provider();const source=await journey();await page.evaluate(answer=>helpReply=`Usa ${answer}.`,source.answer);await request();await sheet().getByRole('alert').filter({hasText:'revealed the answer'}).waitFor();assert.equal(await sheet().locator('[data-assistance-wording]').count(),0);assert.equal((await state()).session.aiAssistance.history.length,0);assert.equal((await state()).events.length,0);
 });
 await check('Changing the unfinished answer revokes an in-flight suggestion without replacing either original draft',async()=>{
  await fresh();await provider({delay:true});await journey();await request();await page.waitForFunction(()=>helpRequests.length===1);await page.evaluate(()=>{const input=document.querySelector('[data-answer]');input.value='new own answer';input.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>!document.querySelector('.sheet-wrap.open'));assert.equal(await sheet().count(),0);await page.evaluate(()=>releaseHelp());assert.equal(await page.locator('[data-answer]').inputValue(),'new own answer');const saved=await state();assert.equal(saved.session.aiAssistance.history.length,0);assert.equal(Object.values(saved.session.aiAssistance.drafts)[0].originalText,'Keep my original question');
 });
 await check('Navigation, provider removal, learner replacement and epoch reset revoke late Journey help',async()=>{
  for(const change of ['navigation','provider','learner','epoch']){
   await fresh();await provider({delay:true});await journey();await request();await page.waitForFunction(()=>helpRequests.length===1);
   if(change==='navigation')await gotoRoute(page,'/profile');
   else await page.evaluate(async change=>{const {store}=await import('./js/store.js');if(change==='provider')removeHelpProvider();if(change==='epoch')await store.resetProgress();if(change==='learner'){const profile=structuredClone(store.current);profile.learnerId=crypto.randomUUID();await store.importJSON(JSON.stringify({profile}));}},change);
   const before=await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current));await page.evaluate(()=>releaseHelp());await page.waitForTimeout(50);assert.equal(await sheet().count(),0);assert.equal(await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current)),before,change+' cannot write after revocation');
  }
 });
 await check('Journey lazy Grammar dispatch retains its original view ownership across the child import',async()=>{
  await fresh();const id=await page.evaluate(async()=>{const {grammarCourse}=await import('./js/learning/grammar-course.js');return grammarCourse.lessons[0].id;});let release,seen=false;await page.route('**/js/views/learnGrammar.js',async route=>{seen=true;await new Promise(resolve=>release=resolve);await route.continue();});await page.evaluate(id=>location.hash='#/learn/word/'+encodeURIComponent('g:'+id),id);for(let n=0;n<100&&!seen;n++)await page.waitForTimeout(20);assert(seen,'child import intercepted');await gotoRoute(page,'/profile');await page.locator('[data-settings]').waitFor();const before=await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current));release();await page.waitForTimeout(400);assert.equal(await page.locator('[data-settings]').count(),1);assert.equal(await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current)),before);
 });
 await check('Already open Journey completion controls cannot write after learner replacement',async()=>{
  await fresh();const seeded=await journey();await gotoRoute(page,`/learn/verb/v%3Adomandare?session=${seeded.id}&overview=1`);await page.locator('[data-completion-menu]').click();await page.locator('.completion-dropdown [data-completion-case]:not([disabled])').first().waitFor();
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.current.learnerId='replacement:'+crypto.randomUUID();});const before=await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current));await page.locator('.completion-dropdown [data-completion-case]:not([disabled])').first().click();assert.equal(await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current)),before);assert.equal((await state()).events.length,0);
 });
 assert.deepEqual(errors,[]);passed=true;
}finally{
 fs.writeFileSync(new URL(`../docs/implementation/programme/ai-journey-assistance-${name}.json`,import.meta.url),JSON.stringify({browser:name,passed,scope:'Real Journey routes and canonical catalogue; injected test-only generator/language fixture; no production model claim',checks,errors},null,2)+'\n');await context?.close();await browser.close();await stop();
}
