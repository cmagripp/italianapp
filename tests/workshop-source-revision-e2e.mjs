import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions,boot,gotoRoute,reloadApp} from './lib.mjs';

const prior=JSON.parse(fs.readFileSync(new URL('./fixtures/workshop-source-revision-legacy.json',import.meta.url),'utf8'));
const ID=prior.lessonId,INDEX=prior.activityIndex,CURRENT=ID+'.4:agreement-v2',TYPED='  resto  ';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium';
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),checks=[],errors=[];let context,page;
const check=async(label,run)=>{try{await run();checks.push(label);console.log('PASS',label);}catch(error){console.log('FAIL',label,await page.evaluate(()=>({hash:location.hash,text:document.querySelector('main')?.innerText})));throw error;}};
async function fresh({futurePack=false}={}){
 await context?.close();context=await browser.newContext(contextOptions(undefined,{viewport:{width:430,height:932},reducedMotion:'reduce'}));page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 if(futurePack){
  const pack=JSON.parse(fs.readFileSync(new URL('../data/sentence-lab/strutture.json',import.meta.url),'utf8'));
  await page.route('**/data/sentence-lab/strutture.json',route=>{
   const response=structuredClone(pack);
   if(futurePack.enabled)response.lessons.find(lesson=>lesson.id===ID).activities[INDEX].templateRevision=futurePack.revision;
   return route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
  });
 }
 await boot(page);
 await page.evaluate(async()=>{
  const {store}=await import('./js/store.js');store.setSetting('tts',false);
  const {installConversationProvider}=await import('./js/conversations/runtime.js');
  // Readiness exposes actual help availability. No inference is requested and
  // this explicit fixture supplies no real model or language-quality evidence.
  window.removeRevisionProvider=installConversationProvider({readiness:()=>({written:true}),acquire:()=>{throw new Error('No model inference belongs to this source revision test');}});
 });
}
const credit=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js');return JSON.stringify({xp:store.current.stats.xp,items:store.current.items,events:store.learning.events,completions:store.learning.completions,lab:store.labRecord('frasi')});});
const snapshot=()=>page.evaluate(async id=>{const {store}=await import('./js/store.js'),{readLabSession}=await import('./js/learning/sentence-lab-data.js');return structuredClone(readLabSession(store,id));},ID);
async function seed({agreement='f',legacy=null,revision}={}){
 await gotoRoute(page,'/home');
 const saved=await page.evaluate(async({id,index,agreement,legacy,hasRevision,revision})=>{
  const {store}=await import('./js/store.js'),lab=await import('./js/learning/sentence-lab-data.js'),engine=await import('./js/learning/sentence-lab.js');await lab.loadSentenceLab();
  const lesson=lab.labLesson(id);let session;
  if(legacy)session=structuredClone(legacy);
  else{
   session=engine.createLabSession(lesson);session.speakerAgreement=agreement;
   engine.advanceLab(lesson,session);
   engine.answerLab(lesson,session,lesson.activities[1].answer,{speakerGender:agreement});engine.advanceLab(lesson,session);
   engine.answerLab(lesson,session,['quindi','però'],{speakerGender:agreement});engine.advanceLab(lesson,session);
   if(session.index!==index)throw new Error('Fresh source must be reached through actual engine advancement');
   session.state.ui={touched:true,values:[''],active:0,drafts:{},freeOpen:{},inputSources:{}};
  }
  if(hasRevision)session.state.templateRevision=revision;
  store.setSetting('gender',agreement);lab.writeLabSession(store,session);await store.saveNow();return structuredClone(lab.readLabSession(store,id));
 },{id:ID,index:INDEX,agreement,legacy,hasRevision:Object.hasOwn(arguments[0]||{},'revision'),revision});
 return saved;
}
async function open(query=''){
 await gotoRoute(page,'/lab/frasi/'+ID+query);await page.locator('[data-lab-lesson]').waitFor();
}
async function persistedBaseline(raw){
 // The old committed engine predates the shared learning-session metadata.
 // Establish the loaded baseline before testing readonly recovery, and bind
 // every original field (including the entire unknown state) exactly.
 await reloadApp(page);const loaded=await snapshot();
 assert.deepEqual(loaded,{...raw,activeObjectiveId:null,answeredEventIds:[],completedObjectiveIds:[],deferred:{},objectiveIds:[],reviewedObjectiveIds:[]});
 return loaded;
}
async function source(){return page.evaluate(async id=>{
 const {store}=await import('./js/store.js'),lab=await import('./js/learning/sentence-lab-data.js'),engine=await import('./js/learning/sentence-lab.js');
 const {createWorkshopPracticeBinding,createPracticeSourceResolver}=await import('./js/learning/practice-sources.js');
 const lesson=lab.labLesson(id),session=structuredClone(lab.readLabSession(store,id)),view=engine.currentLabStep(lesson,session);
 const binding=createWorkshopPracticeBinding({lesson,stage:lab.labStageOf(id),session,blankIndex:0}),resolved=binding&&createPracticeSourceResolver().resolve(binding);
 return {view,binding,resolved};
},ID);}
async function assertCurrentSource(agreement){
 const data=await source(),word=agreement==='f'?'stanca':'stanco',template=`Sono ${word}, quindi stasera ____ a casa.`;
 assert.notEqual(data.view.available,false);
 assert.equal(data.view.activity.template,template);assert.equal(data.binding.selection.templateRevision,CURRENT);assert.equal(data.resolved.canonical.template,template);
 assert.ok(data.resolved.prompt.includes(template));assert.ok(data.resolved.references.length>0);
 assert.ok(data.resolved.references.every(reference=>reference.it.startsWith(`Sono ${word},`)));
 assert.match(await page.locator('.lab-sentence').innerText(),new RegExp(`^Sono ${word}, quindi stasera`));
 assert.equal(await page.locator('[data-lab-ai-help]').count(),1);
 return data;
}
async function answerResto(){
 if(await page.locator('[data-lab-free-input="0"]').count()===0)await page.locator('[data-lab-free="0"]').click();
 await page.locator('[data-lab-free-input="0"]').fill(TYPED);await page.locator('[data-lab-free-submit="0"]').click();
 await page.locator('[data-lab-check]').click();await page.locator('[data-lab-next]').waitFor();return (await snapshot()).state.result;
}
async function chooseAgreement(agreement){await page.locator('[data-lab-agreement]').click();await page.getByRole('menuitemradio',{name:agreement==='f'?'Feminine · sono stanca':'Masculine · sono stanco',exact:true}).click();}
async function reachCurrentCloze(){
 await page.locator('[data-lab-next]').click();await page.locator('[data-lab-order]').waitFor();
 for(const word of ['Oggi','piove,','quindi','prendo',"l'ombrello."])await page.locator('[data-lab-token]').filter({hasText:new RegExp('^'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
 await page.locator('[data-lab-check]').click();await page.locator('[data-lab-next]').click();await page.locator('[data-lab-cloze]').waitFor();
 await page.locator('[data-lab-option="quindi"][data-blank="0"]').click();await page.locator('[data-lab-option="però"][data-blank="1"]').click();
 await page.locator('[data-lab-check]').click();await page.locator('[data-lab-next]').click();await page.waitForFunction(id=>document.querySelector('[data-lab-lesson]')?.dataset.activity===id,ID+'.4');
}

try{
 for(const agreement of ['f','m'])await check('Fresh '+agreement+' source displays, helps and grades the matching tiredness form',async()=>{
  await fresh();const saved=await seed({agreement});assert.equal(saved.state.templateRevision,CURRENT);const before=await credit();await open();await assertCurrentSource(agreement);assert.equal(await credit(),before);
  const result=await answerResto();assert.equal(result.sentence,`Sono ${agreement==='f'?'stanca':'stanco'}, quindi stasera ${TYPED} a casa.`);assert.equal(result.blanks[0].submission.originalText,TYPED);assert.equal(result.speakerAgreement,agreement);assert.equal(result.outcome,'correct');
  assert.equal(await credit(),before,'One cloze does not complete a lesson or grant word mastery');
  await page.evaluate(()=>import('./js/store.js').then(m=>m.store.saveNow()));await reloadApp(page);assert.deepEqual((await snapshot()).state.result,result);assert.equal(await credit(),before);
 });
 await check('Unmarked feminine legacy draft retains exact old text and entered bytes across reload and pause',async()=>{
  await fresh();await seed({legacy:prior.pending});const before=await credit();await open();assert.match(await page.locator('.lab-sentence').innerText(),/^Sono stanco,/);assert.equal(await page.locator('[data-lab-free-input="0"]').inputValue(),prior.draft);
  const s=await snapshot();assert(!Object.hasOwn(s.state,'templateRevision'));assert.deepEqual(s.history,prior.pending.history);assert.deepEqual(s.state.attempts,prior.pending.state.attempts);
  const selected=await source();assert.equal(selected.view.activity.template,prior.activity.template);assert.equal(selected.binding,null,'Legacy masculine quote is not feminine canonical help');assert.equal(await page.locator('[data-lab-ai-help]').count(),0);
  await page.evaluate(()=>import('./js/store.js').then(m=>m.store.saveNow()));await reloadApp(page);assert.equal(await page.locator('[data-lab-free-input="0"]').inputValue(),prior.draft);
  await page.locator('[data-lab-pause]').click();await page.evaluate(()=>import('./js/store.js').then(m=>m.store.saveNow()));await reloadApp(page);await page.locator('[data-lab-resume]').click();assert.equal(await page.locator('[data-lab-free-input="0"]').inputValue(),prior.draft);
  await gotoRoute(page,'/home');await open();assert.match(await page.locator('.lab-sentence').innerText(),/^Sono stanco,/);assert.equal((await snapshot()).state.ui.drafts[0],prior.draft);assert.equal(await credit(),before);
 });
 await check('Unmarked feminine legacy feedback and history remain exact when opened and reloaded',async()=>{
  await fresh();await seed({legacy:prior.answered});const before=await credit();await open();assert.equal(await page.locator('.lab-sentence').textContent(),prior.answered.state.result.sentence);
  const s=await snapshot();assert.deepEqual(s.state.result,prior.answered.state.result);assert.deepEqual(s.state.attempts,prior.answered.state.attempts);assert.deepEqual(s.history,prior.answered.history);assert.equal(s.state.ui.drafts[0],prior.answered.state.ui.drafts[0]);
  await page.evaluate(()=>import('./js/store.js').then(m=>m.store.saveNow()));await reloadApp(page);assert.deepEqual((await snapshot()).state.result,prior.answered.state.result);assert.equal(await credit(),before);
 });
 await check('Explicit agreement change preserves an answered feminine sentence and its result until Continue',async()=>{
  await fresh();await seed({agreement:'f'});await open();const before=await credit(),result=await answerResto(),saved=await snapshot();await chooseAgreement('m');
  assert.equal((await snapshot()).speakerAgreement,'m');assert.deepEqual((await snapshot()).state.result,result);assert.deepEqual((await snapshot()).state.attempts,saved.state.attempts);assert.deepEqual((await snapshot()).history,saved.history);assert.equal((await snapshot()).state.ui.drafts[0],TYPED);
  assert.equal(await page.locator('.lab-sentence').textContent(),result.sentence);assert.equal(await credit(),before);
  await page.evaluate(()=>import('./js/store.js').then(m=>m.store.saveNow()));await reloadApp(page);assert.equal(await page.locator('.lab-sentence').textContent(),result.sentence);assert.deepEqual((await snapshot()).state.result,result);
  await page.locator('[data-lab-next]').click();assert.equal((await snapshot()).index,INDEX+1);assert.deepEqual((await snapshot()).history.at(-1).result,result);assert.equal(await credit(),before);
 });
 await check('Known legacy Continue keeps old history; explicit restart reaches the current feminine source',async()=>{
  await fresh();const old=await seed({legacy:prior.answered});const before=await credit();await open();await page.locator('[data-lab-next]').click();
  const advanced=await snapshot();assert.equal(advanced.index,INDEX+1);assert.deepEqual(advanced.history.at(-1).result,prior.answered.state.result);assert.equal(advanced.id,old.id);assert.equal(await credit(),before);
  await open('?restart=1');await page.locator('[data-lab-model]').waitFor();await reachCurrentCloze();assert.notEqual((await snapshot()).id,old.id);assert.equal((await snapshot()).state.templateRevision,CURRENT);await assertCurrentSource('f');assert.equal(await credit(),before);
 });
 for(const [label,revision,saved] of [['unknown','future-workshop-source',prior.pending],['null',null,prior.answered]])await check('Explicit '+label+' revision is readonly and preserves draft/results through reload, Back and restart links',async()=>{
  await fresh();const seeded=await persistedBaseline(await seed({legacy:saved,revision})),before=await credit();await open();await page.locator('[data-lab-source-unavailable]').waitFor();
  assert.equal(await page.locator('[data-lab-agreement],[data-lab-next],[data-lab-check],[data-lab-free-submit],[data-lab-ai-help]').count(),0);assert.equal(await page.locator('[data-lab-pause]').isDisabled(),true);
  assert.ok((await page.locator('[data-lab-preserved-draft]').allTextContents()).includes(saved.state.ui.drafts[0]));
  if(saved.state.result)assert.equal(await page.locator('[data-lab-preserved-result]').textContent(),saved.state.result.sentence);
  assert.equal(await page.locator('[data-lab-source-unavailable] a[href="#/profile"]').count(),1);assert.equal((await source()).binding,null);
  assert.deepEqual(await snapshot(),seeded);assert.equal(await credit(),before);
  await page.evaluate(()=>{for(const attr of ['data-lab-next','data-lab-check','data-lab-agreement','data-lab-pause']){const b=document.createElement('button');b.setAttribute(attr,'');document.querySelector('[data-lab-source-unavailable]').append(b);b.click();b.remove();}});
  assert.deepEqual(await snapshot(),seeded);assert.equal(await credit(),before);
  await page.locator('[data-lab-source-reload]').click();await page.locator('[data-lab-source-unavailable]').waitFor();assert.deepEqual(await snapshot(),seeded);
  await page.locator('[data-lab-back]').click();await page.locator('[data-lab-page]').waitFor();assert.deepEqual(await snapshot(),seeded);await open('?restart=1');await page.locator('[data-lab-source-unavailable]').waitFor();assert.deepEqual(await snapshot(),seeded);assert.equal(await credit(),before);
 });
 await check('A later compatible authored source resumes an unknown draft without replacing its session/history',async()=>{
  const fixture={enabled:false,revision:'test-only-compatible-future-source'};await fresh({futurePack:fixture});const seeded=await persistedBaseline(await seed({legacy:prior.pending,revision:fixture.revision})),before=await credit();await open();await page.locator('[data-lab-source-unavailable]').waitFor();assert.deepEqual(await snapshot(),seeded);
  fixture.enabled=true;await page.locator('[data-lab-source-reload]').click();await page.locator('[data-lab-cloze]').waitFor();assert.equal(await page.locator('[data-lab-free-input="0"]').inputValue(),prior.draft);assert.match(await page.locator('.lab-sentence').innerText(),/^Sono stanca,/);
  const after=await snapshot();assert.equal(after.id,seeded.id);assert.equal(after.state.templateRevision,fixture.revision);assert.deepEqual(after.history,seeded.history);assert.deepEqual(after.state.attempts,seeded.state.attempts);assert.equal(after.state.ui.drafts[0],prior.draft);assert.equal(await credit(),before);
 });
 assert.deepEqual(errors,[]);
 const fingerprints=Object.fromEntries(['js/learning/lab-template-source.js','js/learning/sentence-lab.js','js/views/labFrasiLesson.js','js/learning/sentence-lab-activities.js','js/learning/practice-authored-sources.js','data/sentence-lab/strutture.json','tests/workshop-source-revision-e2e.mjs','tests/fixtures/workshop-source-revision-legacy.json'].map(path=>[path,createHash('sha256').update(fs.readFileSync(new URL('../'+path,import.meta.url))).digest('hex')]));
 fs.writeFileSync(`docs/implementation/programme/workshop-source-revision-${name}.json`,JSON.stringify({browser:name,scope:'Actual Workshop route/source in the programme worktree, committed e14366b legacy fixture, real store/reload and canonical help binding. Future-compatible source is an explicit browser response fixture; no real model/language-quality claim.',baseline:prior.baseline,baselineNormalization:'Normal persisted loading adds only activeObjectiveId:null, answeredEventIds:[], completedObjectiveIds:[], deferred:{}, objectiveIds:[], reviewedObjectiveIds:[]; every original session/state/draft/result/history/timestamp field is asserted exact before capturing the recovery baseline.',sourceSHA256:fingerprints,checks,errors},null,2)+'\n');
}finally{await context?.close();await browser.close();stop();}
