#!/usr/bin/env node
// A real new-learner run: count questions, not their separate feedback screens.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,contextOptions,ensureServer,boot,gotoRoute,reloadApp} from './lib.mjs';
import {journeyQuestion,solveJourneyQuestion,advanceJourneyPage} from './journey-driver.mjs';

const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer();
const browser=process.env.VERB_BROWSER==='webkit'?await webkit.launch({headless:true}):await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 16 Pro Max']||devices['iPhone 13'],{reducedMotion:'reduce'}));
const page=await context.newPage(),errors=[],trace=[];
page.on('pageerror',error=>errors.push(error.message));
const snapshot=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js');return {session:store.learning.session,events:store.learning.events,xp:store.current.stats.xp};});
try{
 await boot(page);
 await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setSetting('tts',false);});
 await gotoRoute(page,'/learn/verb/v%3Aavere?chapter=present');
 const forms=['ho','hai','ha','abbiamo','avete','hanno'];
 const expected=q=>['conjugation','address','context'].includes(q.meta.skill)&&Number.isInteger(q.meta.person)?forms[q.meta.person]:q.answer[0];
 let resumed=false;
 for(let turn=0;turn<110;turn++){
  const pane=page.locator('[data-journey]'),phase=await pane.getAttribute('data-phase');
  if(phase==='recap')break;
  assert(!['blocked','unavailable','complete'].includes(phase),`Unexpected ${phase}`);
  if(phase==='paused'){
   const before=await snapshot(),visit=before.session.ui.visits.present;
   assert(visit.boundary);assert.equal(visit.eventIds.length,8);assert.equal(visit.limit,8);
   await advanceJourneyPage(page);const after=await snapshot();
   assert.deepEqual(after.events,before.events);assert.equal(after.xp,before.xp);
   assert.equal(after.session.ui.visits.present.number,visit.number+1);
   assert.equal(after.session.ui.visits.present.eventIds.length,0);
  }else if(phase==='question'){
   const q=await journeyQuestion(page),before=await snapshot();
   trace.push({type:q.type,skill:q.meta.skill,context:q.context?.it||null,phase:q.meta.activityKind});
   assert(!q.meta.tense?.includes('Progressivo'),'Possessive avere does not invent progressive exercises');
   if(!resumed&&q.type==='type'){
    await page.locator('[data-answer]').fill(expected(q).slice(0,1));
    const draft=await snapshot();await reloadApp(page);const restored=await snapshot();
    assert.equal(await page.locator('[data-answer]').inputValue(),expected(q).slice(0,1));
    assert.equal(restored.session.journey.current.questionId,draft.session.journey.current.questionId);
    assert.deepEqual(restored.events,draft.events);assert.equal(restored.xp,draft.xp);resumed=true;
   }
   await solveJourneyQuestion(page,q,{expected});
   const after=await snapshot();assert(after.session.journey.awaitingContinue);
   assert.equal(after.session.journey.current.questionId,before.session.journey.current.questionId,'Feedback does not advance the question');
   const next=await page.locator('[data-feedback-bar] [data-continue]').boundingBox();
   assert(next&&next.y>=0&&next.y+next.height<=(await page.evaluate(()=>innerHeight))+1,'Continue is visible without page scrolling');
  }else await advanceJourneyPage(page);
 }
 assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'),'recap');
 assert(resumed,'A saved written answer was restored');
 assert(trace.length<=15,`Avere present must retain its short budget, including an order-dependent supported spacing check; got ${trace.length}`);
 assert.equal(trace.filter(q=>q.type==='type').length,8,'Eight production targets receive unaided writing');
 assert(new Set(trace.map(q=>q.type)).size>=3,'The short lesson still mixes exercise types');
 const production=trace.filter(q=>q.phase==='independent');
 assert(production.every(q=>q.context),'Unaided answers retain full authored sentences');
 assert.equal(new Set(production.map(q=>q.context)).size,8,'Every unaided target has a distinct full scene');
 const result=await page.evaluate(async()=>{const {store}=await import('./js/store.js');const {getEntry}=await import('./js/data.js');const {buildLesson}=await import('./js/learning/lesson-content.js');const {journeyCaseProgress}=await import('./js/learning/journey.js');const {caseCoverage}=await import('./js/learning/case-coverage.js');const {skillState}=await import('./js/learning/model.js');const plan=buildLesson(getEntry('v:avere'));return {case:journeyCaseProgress(plan,store.learning).cases.find(c=>c.id==='present'),coverage:caseCoverage(plan,store.learning,'present').complete,ready:skillState(store.learning,'v:avere::lesson::present::form-0').ready};});
 assert(result.case.ready,'Bounded practice still earns case completion');assert(result.coverage);assert.equal(result.ready,false,'Completion does not claim consolidated readiness');assert.deepEqual(errors,[]);
 console.log(`PASS Avere Present: ${trace.length} exercises, ${trace.filter(q=>q.type==='type').length} written, ${new Set(trace.map(q=>q.type)).size} formats; reload and completion verified.`);
 // A v13 prompt at variant 2 wrapped around a two-scene pool. Expanding that
 // pool must not turn its saved English cue into a different Italian cloze.
 await gotoRoute(page,'/home');
 const old=await page.evaluate(async()=>{
  const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js');
  const {buildLesson}=await import('./js/learning/lesson-content.js');
  const {createLearning}=await import('./js/learning/model.js');store.current.learning=createLearning(Date.now());
  const {createJourneySession,currentJourneyStep,advanceJourney}=await import('./js/learning/journey.js');
  const plan=buildLesson(getEntry('v:avere'));let s=createJourneySession({id:'v13-avere-saved',plan,chapterId:'present',caseMode:true,caseCoveragePolicy:null});
  while(currentJourneyStep(plan,s,store.learning).type==='teach')s=advanceJourney(plan,s,store.learning);
  s.journey.current.variant=2;s.journey.current.format='type';delete s.journey.current.scenePolicy;
  s.ui={version:2,questionId:s.journey.current.questionId,draft:'h',given:'',assistance:[],exposures:{},mapOpen:false};
  store.saveLearningSession(s);await store.saveNow();return {id:s.id,questionId:s.journey.current.questionId};
 });
 await gotoRoute(page,'/learn/verb/v%3Aavere?session='+old.id);
 const oldQuestion=await journeyQuestion(page);
 assert.equal(oldQuestion.context.it,'Io ho una sorella.');assert.match(oldQuestion.prompt,/I have a sister/);
 assert(!oldQuestion.prompt.includes('class="blank"'),'The legacy English cue is unchanged');
 await reloadApp(page);assert.equal(await page.locator('[data-answer]').inputValue(),'h');
 assert.equal((await snapshot()).session.journey.current.questionId,old.questionId);
 await page.locator('[data-answer]').fill('ho');await page.locator('[data-check]').click();
 const answered=await snapshot();await reloadApp(page);assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'),'feedback');
 assert.deepEqual((await snapshot()).events,answered.events);
 await page.locator('[data-continue]').click();await page.locator('[data-lesson-back]').click();
 assert.match(await page.locator('.journey-main').innerText(),/I have a sister/);
 assert.deepEqual((await snapshot()).events,answered.events,'History does not submit the old answer again');
 console.log('PASS Pre-update v2 draft, feedback and Back retain their original sentence.');
 assert.deepEqual(errors,[]);
}finally{
 fs.writeFileSync(new URL(`report-verb-pacing-${process.env.VERB_BROWSER||'chromium'}.json`,import.meta.url),JSON.stringify({trace,errors},null,2));
 await browser.close();stop();
}
