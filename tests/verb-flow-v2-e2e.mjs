#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,contextOptions,ensureServer,boot,gotoRoute,reloadApp,SHOTS_DIR} from './lib.mjs';
import {journeyQuestion,solveJourneyQuestion,advanceJourneyPage} from './journey-driver.mjs';
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer();
const browser=process.env.VERB_BROWSER==='webkit'?await webkit.launch({headless:true}):await launchBrowser(chromium);
const errors=[],results=[];let context,page;
async function fresh(width=440,height=956){
 await context?.close();context=await browser.newContext(contextOptions(devices['iPhone 16 Pro Max']||devices['iPhone 13'],{viewport:{width,height},screen:{width,height},reducedMotion:'reduce'}));
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await boot(page);
 await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setSetting('theme','dark');store.setSetting('tts',false);});
}
async function check(name,fn){await fn();results.push(name);console.log('PASS',name);}
async function saved(){return page.evaluate(async()=>{const {store}=await import('./js/store.js');return {session:store.learning.session,events:Object.values(store.learning.events),xp:store.current.stats.xp};});}
async function visibleControls(){
 const geometry=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,
  button:document.querySelector('[data-feedback-bar] [data-continue],.journey-action-track [data-continue]')?.getBoundingClientRect().toJSON(),
  stages:[...document.querySelectorAll('.journey-stages li')].map(e=>({label:e.textContent,rect:e.getBoundingClientRect().toJSON()}))}));
 assert(geometry.sw<=geometry.w+1);assert(geometry.sh<=geometry.h+1,'page itself does not scroll');
 if(geometry.button)assert(geometry.button.top>=0&&geometry.button.bottom<=geometry.h+1,'Continue stays visible');
 for(const s of geometry.stages)assert(s.rect.left>=0&&s.rect.right<=geometry.w+1,'stage fits');
}
try{
 await check('Phone lesson teaches viaggiare, keeps stable milestones and waits at feedback',async()=>{
  await fresh();await gotoRoute(page,'/learn/verb/v%3Aviaggiare?chapter=present');
  assert.equal(await page.locator('.journey-progress-summary').count(),0);
  assert.deepEqual(await page.locator('.journey-stages li').allTextContents(),['Present forms','Happening now','Mixed review']);
  const seen=[];let mixedError=false,mixedSimple=false,mixedProgressive=false;
  for(let n=0;n<350;n++){
   const pane=page.locator('[data-journey]'),phase=await pane.getAttribute('data-phase'),group=await pane.getAttribute('data-group');
   const active=await page.locator('.journey-stages [aria-current]').textContent().catch(()=>null);if(active)seen.push(active);
   if(phase==='recap')break;
   assert(!['blocked','unavailable','complete'].includes(phase),phase);
   if(phase==='teach'&&group==='progressive'){
    const text=await page.locator('.journey-main').innerText();assert(!/mangiando|Four ways/.test(text));
    if(/Build/.test(text))assert(/viaggiando/.test(text));
    await visibleControls();
   }
   if(phase==='paused'){
    const before=await saved(),visit=before.session.ui.visits.present;
    assert(visit.boundary);assert.equal(visit.eventIds.length,8);
    await advanceJourneyPage(page);const after=await saved();
    assert.deepEqual(after.events,before.events);assert.equal(after.xp,before.xp);
    assert.equal(after.session.ui.visits.present.number,visit.number+1);
   }else if(phase==='question'){
    const q=await journeyQuestion(page);
    if(group==='mixed-review'){if(q.meta.skill==='progressive')mixedProgressive=true;else mixedSimple=true;}
    if(group==='mixed-review'&&q.meta.skill==='progressive'&&q.type==='type'&&!mixedError){
     await page.locator('[data-answer]').fill('sono viaggiando');await page.locator('[data-check]').click();mixedError=true;
    }else await solveJourneyQuestion(page,q,{expected:q=>q.meta.skill==='progressive'&&!q.meta.scaffold?['sto','stai','sta','stiamo','state','stanno'][q.meta.person]+' viaggiando':q.answer[0]});
    const before=await saved();await page.waitForTimeout(100);assert.equal((await saved()).session.journey.current.questionId,before.session.journey.current.questionId);
    await visibleControls();
    if(group==='mixed-review'&&mixedError){fs.mkdirSync(SHOTS_DIR,{recursive:true});await page.screenshot({path:SHOTS_DIR+'/verb-v2-mixed-phone.png'});}
   }else await advanceJourneyPage(page);
  }
  assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'),'recap');
  assert(mixedSimple&&mixedProgressive&&mixedError);
  const first=seen.indexOf('Happening now'),last=seen.indexOf('Mixed review');assert(first>0&&last>first);assert(!seen.slice(first).includes('Present forms'));assert(!seen.slice(last).includes('Happening now'));
  assert.match(await page.locator('.journey-main').innerText(),/complete/i);
 });
 await check('Old typed draft survives update and reload, then upgrades after Continue',async()=>{
  await fresh(375,667);
  const seeded=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js');
   const {createJourneySession,advanceJourney,currentJourneyStep}=await import('./js/learning/journey.js');
   const plan=buildLesson(getEntry('v:viaggiare'),{legacy:true,questionBuilder:(await import('./js/learning/lesson-questions.js')).buildJourneyQuestion});let s=createJourneySession({id:'old-viaggiare-draft',plan,chapterId:'present',caseMode:true});
   while(currentJourneyStep(plan,s,store.learning).type==='teach')s=advanceJourney(plan,s,store.learning);
   s.journey.current.format='type';s.ui={version:2,questionId:s.journey.current.questionId,draft:'viagg',given:'',assistance:[],exposures:{},mapOpen:false};
   store.saveLearningSession(s);await store.saveNow();return {id:s.id,questionId:s.journey.current.questionId};
  });
  await gotoRoute(page,'/learn/verb/v%3Aviaggiare?session='+seeded.id);assert.equal(await page.locator('[data-answer]').inputValue(),'viagg');
  await reloadApp(page);assert.equal(await page.locator('[data-answer]').inputValue(),'viagg');
  assert.equal((await saved()).session.journey.current.questionId,seeded.questionId);
  await page.locator('[data-answer]').fill('viaggio');await page.locator('[data-check]').click();
  const before=await saved();await page.locator('[data-continue]').click();const after=await saved();
  assert.equal(after.session.id,seeded.id);assert.equal(after.session.journey.verbFlowVersion,2);assert.deepEqual(after.events,before.events);assert.equal(after.xp,before.xp);
  assert(after.session.verbFlowArchive);assert.match(await page.locator('.journey-main').innerText(),/earlier answers are saved/);await visibleControls();
 });
 await check('An inactive old case retains its own exact draft when reopened after another case upgrades',async()=>{
  await fresh();
  const seeded=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js');
   const {createJourneySession,advanceJourney,currentJourneyStep,chooseJourneyChapter}=await import('./js/learning/journey.js');
   const {buildJourneyQuestion}=await import('./js/learning/lesson-questions.js');
   const e=getEntry('v:viaggiare'),plan=buildLesson(e,{legacy:true,questionBuilder:(await import('./js/learning/lesson-questions.js')).buildJourneyQuestion});let s=createJourneySession({id:'two-old-cases',plan,chapterId:'present',caseMode:true});
   while(currentJourneyStep(plan,s,store.learning).type==='teach')s=advanceJourney(plan,s,store.learning);
   s.journey.current.format='type';const presentId=s.journey.current.questionId;
   const presentDraft={questionId:presentId,draft:'viagg',given:'',result:null,activity:null,assistance:[],hint:false,forms:false};
   s=chooseJourneyChapter(plan,s,'past',{learning:store.learning});
   while(currentJourneyStep(plan,s,store.learning).type==='teach')s=advanceJourney(plan,s,store.learning);
   s.journey.current.format='type';const step=currentJourneyStep(plan,s,store.learning),q=buildJourneyQuestion(e,step.chapter,step.target,step);
   s.ui={version:2,questionId:step.questionId,draft:'h',given:'',assistance:[],exposures:{},caseDrafts:{present:presentDraft},mapOpen:false};
   store.saveLearningSession(s);await store.saveNow();return {id:s.id,answer:q.answer[0],presentId};
  });
  await gotoRoute(page,'/learn/verb/v%3Aviaggiare?session='+seeded.id);
  assert.equal(await page.locator('[data-answer]').inputValue(),'h');assert.equal(seeded.answer,'ho');
  await page.locator('[data-answer]').fill('ho');await page.locator('[data-check]').click();await page.locator('[data-continue]').click();
  assert.equal((await saved()).session.journey.verbFlowVersion,2);
  await page.locator('[data-pause]').click();await page.getByRole('button',{name:'Back to your verb',exact:true}).click();
  await page.locator('[data-open-lesson="present"]').click();
  assert.equal((await saved()).session.journey.current.questionId,seeded.presentId);assert.equal(await page.locator('[data-answer]').inputValue(),'viagg');
  await reloadApp(page);assert.equal(await page.locator('[data-answer]').inputValue(),'viagg');
  await page.locator('[data-answer]').fill('viaggio');await page.locator('[data-check]').click();const before=await saved();
  await page.locator('[data-continue]').click();const after=await saved();assert.equal(after.session.journey.verbFlowVersion,2);assert.deepEqual(after.events,before.events);
 });
 await check('New progress stages fit small phones in both teaching and feedback',async()=>{
  await fresh(375,667);await gotoRoute(page,'/learn/verb/v%3Aviaggiare?chapter=present');await visibleControls();
  while(await page.locator('[data-journey]').getAttribute('data-phase')==='teach')await page.locator('[data-continue]').click();
  await solveJourneyQuestion(page,await journeyQuestion(page));await visibleControls();
  fs.mkdirSync(SHOTS_DIR,{recursive:true});await page.screenshot({path:SHOTS_DIR+'/verb-v2-small-phone.png'});
 });
 await check('A saved review cannot introduce progressive material that was never learned',async()=>{
  await fresh();
  const seed=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js');
   const {createJourneySession}=await import('./js/learning/journey.js'),{setCompletionRecord}=await import('./js/learning/model.js');
   const entry=getEntry('v:viaggiare'),plan=buildLesson(entry,{questionBuilder:(await import('./js/learning/lesson-questions.js')).buildJourneyQuestion}),target=plan.chapters.find(c=>c.id==='present').groups.find(g=>g.id==='progressive').targets.find(t=>t.required);
   store.current.learning=setCompletionRecord(store.learning,{entryId:entry.id,caseId:'present',checked:true,id:'historical-completion',at:Date.now()-10000});
   const session=createJourneySession({id:'stale-new-review',plan,mode:'review',chapterId:'present',targetId:target.id});
   session.ui={version:2,questionId:session.journey.current.questionId,draft:'sto',assistance:[]};
   store.saveLearningSession(session);await store.saveNow();return {id:session.id,target:target.id};
  });
  const before=await saved();await gotoRoute(page,'/learn/verb/v%3Aviaggiare?mode=review&session='+seed.id);
  assert.equal(await page.locator('[data-answer]').count(),0);assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'),'recap');
  const after=await saved();assert.equal(after.session.id,seed.id);assert.deepEqual(after.events,before.events);assert.equal(after.xp,before.xp);
  await reloadApp(page);assert.equal(await page.locator('[data-answer]').count(),0);
 });
 assert.deepEqual(errors,[]);console.log(`${results.length} verb browser checks passed (${process.env.VERB_BROWSER||'chromium'}).`);
}catch(error){
 console.error('Lesson failure state',await page?.evaluate(()=>({phase:document.querySelector('[data-journey]')?.dataset,answer:document.querySelector('[data-answer]')?.value,active:document.activeElement?.outerHTML})).catch(()=>null));throw error;
}finally{fs.writeFileSync(new URL(`report-verb-flow-v2-${process.env.VERB_BROWSER||'chromium'}.json`,import.meta.url),JSON.stringify({results,errors},null,2));await browser.close();stop();}
