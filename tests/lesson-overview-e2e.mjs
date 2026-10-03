#!/usr/bin/env node
// Five-case verb overview and explicit progression, using real lesson answers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, reloadApp, TESTS_DIR, SHOTS_DIR } from './lib.mjs';
import { journeyQuestion, solveJourneyQuestion, reachJourneyActivity } from './journey-driver.mjs';

const { chromium, webkit, devices } = await loadPlaywright();
const engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium';
const stopServer = await ensureServer(), browser = engine==='webkit'?await webkit.launch({headless:true}):await launchBrowser(chromium);
const results = [], errors = [], screenshots = [];
let context, page, completed;
const ids = ['present', 'past', 'background', 'future', 'condizionale'];
const present = ['credo','credi','crede','crediamo','credete','credono'];
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function fresh(width = 390, theme = 'light') {
  await context?.close();
  context = await browser.newContext(contextOptions(devices['iPhone 13'], { viewport: { width, height: width === 375 ? 667 : 844 }, reducedMotion: 'reduce' }));
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error'&&!/fonts\.g(oogleapis|static)\.com/.test(m.location()?.url||''))errors.push(m.text()); });
  await boot(page);
  await page.evaluate(async theme => { const {store}=await import('./js/store.js');store.setSetting('theme',theme);store.setSetting('tts',false); },theme);
  await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
}
async function check(name, run) {
  if(process.env.OVERVIEW_FILTER&&!name.toLowerCase().includes(process.env.OVERVIEW_FILTER.toLowerCase())&&name!=='No application errors')return;
  const start=Date.now();
  try {const detail=await run();results.push({name,ok:true,ms:Date.now()-start,detail});console.log('PASS',name);}
  catch(error){results.push({name,ok:false,error:error.stack,visible:await page?.locator('body').innerText().catch(()=> '')});console.error('FAIL',name,error.message);throw error;}
}
async function state() {
  return page.evaluate(async()=>{
    const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js');
    const {buildLesson}=await import('./js/learning/lesson-content.js');
    const {currentJourneyStep,journeyCaseProgress}=await import('./js/learning/journey.js');
    await store.saveNow();const entryId=decodeURIComponent(location.hash.split('?')[0].split('/')[3]);
    const session=Object.values(store.learning.sessions).filter(s=>s.entryId===entryId&&s.journey).sort((a,b)=>b.updatedAt-a.updatedAt)[0]||null,plan=buildLesson(getEntry(entryId));
    return {session,plan,step:session?currentJourneyStep(plan,session,store.learning):{type:'overview'},cases:journeyCaseProgress(plan,store.learning,session),events:Object.values(store.learning.events),xp:store.current.stats.xp,learned:store.isLearned(entryId),phase:document.querySelector('[data-journey]')?.dataset.phase};
  });
}
function unchanged(a,b) {
  const sort=events=>[...events].sort((x,y)=>x.id.localeCompare(y.id));
  assert.deepEqual(sort(a.events),sort(b.events));assert.equal(a.xp,b.xp);
}
function expected(q) {
  if(q.meta?.entryId==='v:parlare'&&q.meta?.skill==='progressive'&&!q.meta.scaffold) {
    const forms=q.meta.tense==='imperfettoProgressivo'?['stavo','stavi','stava','stavamo','stavate','stavano']:['sto','stai','sta','stiamo','state','stanno'];const form=forms[q.meta.person]+' parlando';assert(q.answer.includes(form));return form;
  }
  if(q.meta?.entryId==='v:credere'&&q.meta.tense==='presente'&&Number.isInteger(q.meta.person)&&!q.meta.scaffold&&['conjugation','address'].includes(q.meta.skill)) {
    assert(q.answer.includes(present[q.meta.person]),'independently checked credere present form');return present[q.meta.person];
  }
  return q.answer[0];
}
async function finishCase(id, limit=320) {
  let answers=0;
  for(let i=0;i<limit;i++) {
    const s=await state();assert.equal(s.step.chapter?.id,id,'a case cannot automatically enter another tense');
    if(s.phase==='recap')return {state:s,answers};
    if(s.phase==='paused'){const before=s;await page.locator('[data-resume]').click();unchanged(before,await state());continue;}
    assert(!['overview','complete','unavailable','blocked'].includes(s.phase),`case remains answerable: ${s.phase}`);
    if(s.step.type==='question'&&!s.step.awaitingContinue){await solveJourneyQuestion(page,await journeyQuestion(page),{expected});answers++;}
    else await page.locator('[data-continue]').click();
  }
  throw new Error('Correct real answers did not complete the selected case');
}
async function shot(name) {
  const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,x:scrollX,english:document.querySelector('#enToggle')?.getBoundingClientRect().toJSON()}));
  assert(bounds.scroll<=bounds.width+1,name+' no horizontal overflow');assert.equal(bounds.x,0,name+' no horizontal focus pan');assert(bounds.english.right<=bounds.width+1,name+' English toggle stays in viewport');
  const file=path.join(SHOTS_DIR,`lesson-overview-${name}.png`);await page.screenshot({path:file,fullPage:false,animations:'disabled'});screenshots.push(file);
}
async function returnToOverview() {
  // The compact lesson header keeps navigation behind explicit Pause.
  await page.locator('[data-pause]').click();
  assert.equal((await state()).phase,'paused');
  await page.getByRole('button',{name:'Back to your verb',exact:true}).click();
  assert.equal((await state()).phase,'overview');
}
async function assertCompleteCard(id) {
  const card=page.locator(`[data-tense-case="${id}"]`);
  assert(await card.evaluate(c=>c.classList.contains('is-complete')));assert.match(await card.locator('.journey-tense-status').innerText(),/Complete/i);
  assert.equal(await card.locator(`[data-redo-lesson="${id}"]`).count(),1);
}
try {
  await check('A new verb meets its meaning and offers five selectable core cases',async()=>{
    await fresh();await gotoRoute(page,'/learn/verb/v:credere');const s=await state();
    assert.equal(s.session,null,'Preview alone must not create an in-progress lesson');
    assert.equal(s.phase,'overview');assert.deepEqual(s.cases.cases.map(c=>c.id),ids);assert.equal(s.cases.total,5);assert.equal(s.cases.completed,0);
    for(const id of ids)assert.equal(await page.locator(`[data-tense-case="${id}"] [data-open-lesson="${id}"]`).count(),1);
    assert.match(await page.locator('[data-tense-case="background"]').innerText(),/imperfetto/i);
    assert.match(await page.locator('[data-journey]').innerText(),/believe/i);assert.equal(s.events.length,0);assert.equal(s.learned,false);
    await shot('new-five-case-hub');
  });
  await check('Real Present practice ends with an explicit choice and cannot complete the whole verb',async()=>{
    await page.locator('[data-open-lesson="present"]').click();
    const result=await finishCase('present');completed=result.state;
    assert.equal(completed.cases.cases.find(c=>c.id==='present').ready,true);assert.equal(completed.cases.completed,1);assert.equal(completed.cases.complete,false);assert.equal(completed.learned,false);
    assert.equal(await page.locator('[data-next-lesson="past"]').count(),1);assert(await page.locator('[data-overview]').last().isVisible());
    await page.waitForTimeout(750);const still=await state();unchanged(completed,still);assert.equal(still.phase,'recap');assert.equal(still.step.chapter.id,'present');
    await shot('present-end-choice');return {actualAnswers:result.answers};
  });
  await check('Returning and reloading keeps the completed case visibly marked without new evidence',async()=>{
    await page.locator('[data-overview]').last().click();assert.equal((await state()).phase,'overview');await assertCompleteCard('present');
    unchanged(completed,await state());await reloadApp(page);assert.equal((await state()).phase,'overview');await assertCompleteCard('present');unchanged(completed,await state());
    assert.equal((await state()).cases.cases.find(c=>c.id==='background').ready,false);await shot('saved-present-complete');
  });
  await check('Explicit redo teaches and asks fresh answers while preserving earlier completion and history',async()=>{
    const before=await state();await page.locator('[data-redo-lesson="present"]').click();const started=await state();
    assert.equal(started.step.chapter.id,'present');assert.equal(started.phase,'teach');unchanged(before,started);
    assert.equal(started.cases.cases.find(c=>c.id==='present').ready,true,'past completion remains recorded during redo');
    await reachJourneyActivity(page,'mc');await solveJourneyQuestion(page,await journeyQuestion(page),{expected});
    const answered=await state();assert(answered.events.length>before.events.length);assert(answered.xp>before.xp);
    assert(before.events.every(e=>answered.events.some(a=>a.id===e.id)),'redo preserves prior event identities');
    const result=await finishCase('present');
    const freshEvents=result.state.events.filter(e=>!before.events.some(b=>b.id===e.id));
    for(const person of [0,1,2,3,4,5])assert(freshEvents.filter(e=>e.person===person&&e.role!=='formal'&&e.mode==='production'&&e.ok&&!e.assistance.length).length>=1,`redo asks fresh unaided written coverage for person ${person}`);
    assert(freshEvents.some(e=>e.role==='formal'&&e.mode==='production'&&e.ok&&!e.assistance.length));
    assert.equal(result.state.cases.completed,1);return {newAnswers:freshEvents.length};
  });
  await check('Next starts only the chosen case and overview Resume returns to its exact saved position',async()=>{
    const before=await state();await page.locator('[data-next-lesson="past"]').click();const past=await state();
    assert.equal(past.step.chapter.id,'past');assert.equal(past.phase,'teach');unchanged(before,past);
    await returnToOverview();assert.equal((await state()).phase,'overview');await assertCompleteCard('present');
    assert.equal(await page.locator('[data-resume-lesson]').count(),1);await reloadApp(page);await page.locator('[data-resume-lesson]').click();
    const resumed=await state();assert.equal(resumed.session.id,past.session.id);assert.equal(resumed.step.chapter.id,'past');assert.equal(resumed.session.journey.cardIndex,past.session.journey.cardIndex);assert.equal(resumed.session.journey.groupIndex,past.session.journey.groupIndex);unchanged(past,resumed);
  });
  await check('Switching cases preserves an unfinished written answer and its help without duplicate evidence',async()=>{
    await fresh();await gotoRoute(page,'/learn/verb/v:credere?chapter=present');
    await reachJourneyActivity(page,q=>q.type==='type'&&q.meta.mode==='production',{expected,limit:150});
    await page.locator('[data-answer]').fill('my unfinished answer');await page.locator('[data-help]').click();const before=await state();
    await returnToOverview();await page.locator('[data-open-lesson="past"]').click();
    assert.equal((await state()).step.chapter.id,'past');assert.equal((await state()).phase,'teach');unchanged(before,await state());
    await returnToOverview();await page.locator('[data-open-lesson="present"]').click();
    const restored=await state();assert.equal(restored.step.questionId,before.step.questionId);assert.equal(await page.locator('[data-answer]').inputValue(),'my unfinished answer');assert(restored.session.ui.assistance.includes('hint'));unchanged(before,restored);
    await reloadApp(page);assert.equal((await state()).step.questionId,before.step.questionId);assert.equal(await page.locator('[data-answer]').inputValue(),'my unfinished answer');unchanged(before,await state());
  });
  await check('A pre-overview journey keeps its exact saved future question, help and earlier history',async()=>{
    await fresh();
    const fixture=await page.evaluate(async()=>{
      const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js');
      const {buildLesson}=await import('./js/learning/lesson-content.js');
      const {createJourneySession,currentJourneyStep,advanceJourney}=await import('./js/learning/journey.js');
      const plan=buildLesson(getEntry('v:credere'));
      let session=createJourneySession({id:'pre-overview-future',plan,chapterId:'future',now:Date.now(),mode:'lesson'});
      for(let i=0;i<20&&currentJourneyStep(plan,session,store.learning).type==='teach';i++)session=advanceJourney(plan,session,store.learning,{now:Date.now()});
      // Version-one journey cursors had no selected-case boundary flag. This
      // fixture represents a saved written check from its future chapter.
      delete session.journey.caseMode;session.journey.phase='practice';session.journey.current.phase='independent';session.journey.current.format='type';
      session.ui={version:2,questionId:session.journey.current.questionId,draft:'creder',given:'',assistance:['hint'],hint:true,exposures:{},mapOpen:false};
      store.recordLearningAttempt({id:'older-supported-future',sessionId:'older-session',entryId:plan.entryId,objectiveId:session.journey.current.targetId,targetId:session.journey.current.targetId,kind:'verb',skill:'conjugation',tense:'futuro',person:0,chapterId:'future',contentVersion:plan.version,policy:'journey-v1',mode:'recognition',activityKind:'guided',variantId:'earlier-future-teaching',contextId:'earlier-cue',firstAttempt:true,ok:true,outcome:'correct',assistance:['visible-form'],components:[],errorTags:[]});
      store.markLearned('w:casa|noun','word');store.addToList('bank','w:casa|noun');store.saveLearningSession(session);await store.saveNow();
      return {id:session.id,qid:session.journey.current.questionId,events:Object.values(store.learning.events),xp:store.current.stats.xp};
    });
    await gotoRoute(page,'/learn/verb/v:credere?session='+fixture.id);
    const restored=await state();assert.equal(restored.phase,'question');assert.equal(restored.session.id,fixture.id);assert.equal(restored.session.ui.questionId,fixture.qid);
    assert.equal(restored.step.chapter.id,'future');assert.equal(await page.locator('[data-answer]').inputValue(),'creder');assert(restored.session.ui.assistance.includes('hint'));unchanged(fixture,restored);
    assert.equal(restored.cases.cases.find(c=>c.id==='background').ready,false,'migration does not invent imperfetto proof');
    await reloadApp(page);const again=await state();assert.equal(again.session.ui.questionId,fixture.qid);assert.equal(await page.locator('[data-answer]').inputValue(),'creder');unchanged(restored,again);
    assert.equal(await page.evaluate(async()=>{const {store}=await import('./js/store.js');return store.isLearned('w:casa|noun')&&store.current.lists.bank.items.includes('w:casa|noun');}),true);
    await shot('legacy-question-preserved');
  });
  await check('Progressive constructions retain real irregular forms, pronouns and sense restrictions',async()=>{
    const fixtures=[['dire',['sto dicendo']],['fare',['sto facendo']],['bere',['sto bevendo']],['tradurre',['sto traducendo']],['lavarsi',['mi sto lavando','sto lavandomi']],['andarsene',['me ne sto andando','sto andandomene']]];
    const actual=await page.evaluate(async fixtures=>{
      const {getEntry}=await import('./js/data.js');const {progressiveForms,buildProgressiveGroup}=await import('./js/learning/progressive-content.js');
      return {forms:fixtures.map(([inf])=>progressiveForms(getEntry('v:'+inf),0)),weather:[progressiveForms(getEntry('v:piovere'),0),progressiveForms(getEntry('v:piovere'),2)],belief:buildProgressiveGroup(getEntry('v:credere'))};
    },fixtures);
    fixtures.forEach(([,forms],i)=>forms.forEach(form=>assert(actual.forms[i].includes(form),form)));
    assert.deepEqual(actual.weather[0],[]);assert(actual.weather[1].includes('sta piovendo'));
    assert(!actual.belief.targets.some(t=>t.skill==='progressive'&&t.required));
    assert.equal(actual.belief.targets.length,0);assert(actual.belief.cards.some(c=>/belief/.test(c.body)));
  });
  await check('A real progressive group teaches stare and gerundio, repairs the helper and reaches fresh written proof',async()=>{
    await fresh(390,'dark');await gotoRoute(page,'/learn/verb/v:parlare?chapter=present');
    for(let i=0;i<12&&(await state()).step.group?.id!=='progressive';i++) {
      assert.equal((await state()).phase,'teach');await page.locator('[data-skip]').click();
    }
    assert.equal((await state()).step.group.id,'progressive');
    let teaching='';
    while((await state()).phase==='teach'){teaching+=' '+await page.locator('.journey-main').innerText();await page.locator('[data-continue]').click();}
    assert.match(teaching,/action in progress/i);assert.match(teaching,/gerundio/);
    for(const form of ['sto','stai','sta','stiamo','state','stanno'])assert(teaching.includes(form));assert(teaching.includes('sto parlando'));
    await reachJourneyActivity(page,q=>q.type==='type'&&q.meta.mode==='production'&&q.meta.person===0&&q.meta.skill==='progressive',{expected,limit:160});
    const target=(await state()).step.target.id;
    await page.locator('[data-answer]').fill('sono parlando');await page.locator('[data-check]').click();const wrong=(await state()).events.at(-1);
    assert.equal(wrong.ok,false);assert(wrong.errorTags.includes('auxiliary'));assert(wrong.components.some(c=>c.skill==='gerund'&&c.ok));
    await page.locator('[data-continue]').click();assert.equal((await state()).phase,'repair');await page.locator('[data-continue]').click();
    const scaffold=await journeyQuestion(page);assert(scaffold.meta.scaffold);assert(scaffold.answer.includes('sto'));
    await solveJourneyQuestion(page,scaffold);assert.equal((await state()).events.at(-1).mode,'recognition');
    const result=await finishCase('present');
    const independent=result.state.events.filter(e=>e.skill==='progressive'&&e.mode==='production'&&e.ok&&!e.assistance.length);
    for(const person of [0,1,2,3,4,5])assert(independent.filter(e=>e.person===person&&e.role!=='formal').length>=1,`fresh unaided whole progressive person ${person}`);
    assert(independent.some(e=>e.role==='formal'));
    assert(independent.some(e=>e.objectiveId===target&&e.at>=wrong.at&&e.id!==wrong.id),'the failed whole construction has a fresh later unaided success');
    assert(result.state.events.some(e=>e.objectiveId===target&&e.activityKind==='repair'&&e.ok&&e.index>wrong.index),'successful targeted repair precedes the fresh whole construction');
    assert(result.answers<=20,'A partial progressive visit terminates instead of repeating an uncreditable final transfer');
    const coverage=await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{caseCoverage}=await import('./js/learning/case-coverage.js');const plan=buildLesson(getEntry('v:parlare')),session=store.learning.session,c=caseCoverage(plan,store.learning,'present',{sessionId:session.id}),chapter=plan.chapters.find(ch=>ch.id==='present');return {complete:c.complete,states:[...c.states.values()],finalIds:chapter.groups.filter(g=>g.finalReview).flatMap(g=>g.targets).map(t=>t.id),deferred:session.deferred};});
    assert.equal(coverage.complete,false);assert(coverage.states.some(s=>!s.covered),'Skipped simple targets remain uncovered');
    for(const id of coverage.finalIds)assert(Object.hasOwn(coverage.deferred,id),'Mixed transfer is saved for later after an explicit earlier skip');
    assert.equal(result.state.cases.cases.find(c=>c.id==='present').ready,false,'skipping the earlier simple-present parts does not certify the whole case');
    await shot('progressive-repair-and-proof');return {remainingQuestions:result.answers,independent:independent.length,complete:false};
  });
  await check('A real progressive group follows full simple coverage with fresh mixed transfer before completion',async()=>{
    await fresh();await gotoRoute(page,'/learn/verb/v:parlare?chapter=present');const result=await finishCase('present',130);
    assert(result.answers<=26,'A normal full present case remains bounded');assert(result.state.cases.cases.find(c=>c.id==='present').ready);
    const coverage=await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{caseCoverage}=await import('./js/learning/case-coverage.js');const plan=buildLesson(getEntry('v:parlare')),session=store.learning.session,c=caseCoverage(plan,store.learning,'present',{sessionId:session.id}),finalIds=plan.chapters.find(ch=>ch.id==='present').groups.filter(g=>g.finalReview).flatMap(g=>g.targets).map(t=>t.id);return {complete:c.complete,states:[...c.states.values()],finalIds,events:store.learning.events,deferred:session.deferred};});
    assert(coverage.complete);assert(coverage.states.every(s=>s.supported&&s.production&&s.covered));
    const finalStates=coverage.states.filter(s=>coverage.finalIds.includes(s.id)),earlier=coverage.states.filter(s=>!coverage.finalIds.includes(s.id)),lastEarlier=Math.max(...earlier.map(s=>coverage.events[s.productionEventId].index));
    assert.equal(finalStates.length,2,'Both simple and progressive mixed targets remain required');
    for(const state of finalStates){assert(coverage.events[state.productionEventId].index>lastEarlier);assert(!state.guidedContexts.includes(state.productionContextId));assert(!Object.hasOwn(coverage.deferred,state.id));}
    return {questions:result.answers,finalTransfers:finalStates.length};
  });
  for(const width of [375,390])for(const theme of ['light','dark'])await check(`${width}px ${theme}: five-case overview fits and remains navigable`,async()=>{
    await fresh(width,theme);await gotoRoute(page,'/learn/verb/v:dire');
    assert.equal((await state()).phase,'overview');
    await page.locator('.journey-overview-meaning summary').click();assert.match(await page.locator('[data-journey]').innerText(),/detto/);await page.locator('.journey-overview-meaning summary').click();
    const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,x:scrollX,y:scrollY}));
    assert(bounds.scroll<=bounds.width+1);assert.equal(bounds.x,0);assert.equal(bounds.y,0);
    for(const id of ids){const button=page.locator(`[data-open-lesson="${id}"]`);await button.scrollIntoViewIfNeeded();assert(await button.isVisible());assert(await button.getAttribute('aria-label')||await button.innerText());}
    await page.locator('.journey-main').evaluate(panel=>{panel.scrollTop=0;});await shot(`${width}-${theme}`);
    await page.locator('[data-open-lesson="background"]').click();assert.equal((await state()).step.chapter.id,'background');assert.equal((await state()).phase,'teach');
    await page.locator('[data-conjugation-toggle]').click();
    for(const tense of ['presente','passatoProssimo','imperfetto','futuro','condizionale'])assert.equal(await page.locator(`.journey-conjugation-dropdown [data-conjugation-tense="${tense}"]`).count(),1);
    assert.match(await page.locator('.journey-conjugation-dropdown').innerText(),/dicevo/);await page.keyboard.press('Escape');
  });
  await check('Conditional opens as a core lesson, teaches the endings and keeps its exact written form',async()=>{
    await fresh();await gotoRoute(page,'/learn/verb/v:credere?chapter=condizionale');
    assert.equal((await state()).step.chapter.id,'condizionale');assert.equal((await state()).phase,'teach');
    let teaching='';while((await state()).phase==='teach'){teaching+=' '+await page.locator('.journey-main').innerText();await page.locator('[data-continue]').click();}
    for(const ending of ['-ei','-esti','-ebbe','-emmo','-este','-ebbero'])assert(teaching.includes(ending),ending+' explicitly taught');
    await reachJourneyActivity(page,q=>q.type==='type'&&q.meta.mode==='production'&&q.meta.person===0,{limit:150});
    const q=await journeyQuestion(page);assert(q.answer.includes('crederei'));await page.locator('[data-answer]').fill('crederei');await page.locator('[data-check]').click();
    const answered=await state();assert.equal(answered.events.at(-1).ok,true);assert.equal(answered.events.at(-1).tense,'condizionale');
    await reloadApp(page);unchanged(answered,await state());assert.equal((await state()).phase,'feedback');await shot('conditional-feedback');
    await finishCase('condizionale');assert.equal(await page.locator('[data-next-lesson="present"]').count(),1,'choosing the last case first still offers the first unfinished case');assert.equal((await state()).step.chapter.id,'condizionale');
  });
  await check('Imperfetto lesson teaches the named verb’s past progressive and simple contrast',async()=>{
    await fresh();await gotoRoute(page,'/learn/verb/v:mangiare?chapter=background');
    for(let i=0;i<12&&(await state()).step.group?.id!=='progressive';i++){assert.equal((await state()).phase,'teach');await page.locator('[data-skip]').click();}
    assert.equal((await state()).step.group.id,'progressive');let text='';
    while((await state()).phase==='teach'){text+=' '+await page.locator('.journey-main').innerText();if((await state()).step.card?.id==='progressive-contrast'){await shot('past-progressive-contrast');await page.setViewportSize({width:375,height:667});await shot('past-progressive-contrast-375');await page.setViewportSize({width:390,height:844});}await page.locator('[data-continue]').click();}
    for(const form of ['stavo mangiando','mangiavo'])assert(text.includes(form),form+' viewpoint taught');
    assert.match(text,/simple imperfetto can also express an ongoing action/);assert(!text.includes('ho mangiato'));
    for(const form of ['stavo','stavi','stava','stavamo','stavate','stavano'])assert(text.includes(form));
    await page.locator('[data-conjugation-toggle]').click();await page.locator('[data-conjugation-tense="imperfettoProgressivo"]').click();
    assert.match(await page.locator('.journey-conjugation-dropdown').innerText(),/stavo mangiando/);await page.keyboard.press('Escape');
    const forms=await page.evaluate(async()=>{const{getEntry}=await import('./js/data.js');const{progressiveForms}=await import('./js/learning/progressive-content.js');return progressiveForms(getEntry('v:lavarsi'),0,{chapter:'background'});});
    assert(forms.includes('mi stavo lavando'));assert(forms.includes('stavo lavandomi'));
  });
  await check('An impersonal verb drawer teaches the real subject and omits invented personal forms',async()=>{
    await fresh();await gotoRoute(page,'/learn/verb/v:bisognare?chapter=present');const before=await state();
    await page.locator('[data-conjugation-toggle]').click();const drawer=page.locator('.journey-conjugation-dropdown');
    assert.equal(await drawer.locator('.journey-forms tr').count(),1);assert.equal((await drawer.locator('.journey-forms td[lang="it"]').innerText()).trim(),'bisogna');
    assert.doesNotMatch(await drawer.locator('.journey-forms').innerText(),/\bio\b|\btu\b|lui|Lei|—/);unchanged(before,await state());await shot('impersonal-drawer');
    await drawer.locator('[data-conjugation-tense="condizionale"]').click();assert.equal((await drawer.locator('.journey-forms td[lang="it"]').innerText()).trim(),'bisognerebbe');unchanged(before,await state());
  });
  await check('No application errors',async()=>assert.deepEqual(errors,[]));
}catch(error){if(!results.some(r=>!r.ok))results.push({name:'Harness startup',ok:false,error:error.stack});process.exitCode=1;}
finally{fs.writeFileSync(path.join(TESTS_DIR,(process.env.OVERVIEW_FILTER?'report-lesson-overview-targeted':'report-lesson-overview')+(engine==='webkit'?'-webkit':'')+'.json'),JSON.stringify({browser:engine,results,errors,screenshots},null,2));await browser.close();stopServer();}
console.log(`${results.filter(r=>r.ok).length}/${results.length} lesson overview checks passed.`);
