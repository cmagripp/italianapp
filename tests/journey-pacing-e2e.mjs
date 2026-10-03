import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,ensureServer,boot,gotoRoute,reloadApp,contextOptions} from './lib.mjs';
import {journeyQuestion,solveJourneyQuestion,advanceJourneyPage} from './journey-driver.mjs';
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer(),engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium';
const browser=engine==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width:375,height:667},reducedMotion:'reduce'}));
await context.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel:()=>{},speak:u=>{const calls=JSON.parse(sessionStorage.getItem('pacing-speech')||'[]');calls.push(u.text);sessionStorage.setItem('pacing-speech',JSON.stringify(calls));}}}));
const page=await context.newPage(),results=[],errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
const check=async(name,run)=>{await run();results.push(name);console.log('PASS',name);};
const snapshot=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();return {session:store.learning.session,events:Object.keys(store.learning.events).sort(),xp:store.current.stats.xp};});
async function visibleNext(selector){const metrics=await page.locator(selector).evaluate(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:r.top,bottom:r.bottom,height:r.height,viewport:visualViewport?.height||innerHeight,hit:b===hit||b.contains(hit),scrollY,width:innerWidth,scrollWidth:document.documentElement.scrollWidth};});assert(metrics.top>=0&&metrics.bottom<=metrics.viewport+1,JSON.stringify(metrics));assert(metrics.hit);assert(metrics.height>=44);assert.equal(metrics.scrollY,0);assert(metrics.scrollWidth<=metrics.width+1);}
async function mountFixture(typed=false){await gotoRoute(page,'/games');await page.evaluate(async typed=>{const {runDrill}=await import('./js/games/engine.js'),{store}=await import('./js/store.js'),{mountActivityViewport}=await import('./js/learning/activity-viewport.js');store.setSetting('tts',true);store.setSetting('accentStrict',false);sessionStorage.setItem('pacing-speech','[]');const root=document.querySelector('#view');window.__fixtureViewport?.destroy();window.__fixture?.destroy();const q=typed?{type:'type',itemId:'v:parlare',prompt:'Write the form.',answer:['avrò'],say:'Avrò tempo domani.'}:{type:'mc',itemId:'v:parlare',prompt:'Choose the form.',answer:['parlo'],choices:[{label:'parlo',correct:true},{label:'parli',correct:false}],say:'Parlo italiano.'};window.__fixture=runDrill(root,[q,q],{gameId:'pacing-fixture'});window.__fixtureViewport=mountActivityViewport(root,{kind:'practice',panelSelector:'.drill-main'});},typed);}
try{
 await boot(page);
 await check('Games speak the complete correct and incorrect sentence once with visible Continue',async()=>{
  await mountFixture();await page.locator('[data-choice="0"]').click();await visibleNext('[data-next]');assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('pacing-speech'))),['Parlo italiano.']);
  await page.locator('[data-next]').click();await page.locator('[data-choice="1"]').click();await visibleNext('[data-next]');assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('pacing-speech'))),['Parlo italiano.','Parlo italiano.']);
 });
 await check('Accent restoration speaks the full sentence once and updates the same field',async()=>{
  await mountFixture(true);await page.locator('[data-answer]').fill('avro');await page.locator('[data-check]').click();assert.equal(await page.locator('[data-answer]').inputValue(),'avrò');assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('pacing-speech'))),['Avrò tempo domani.']);await visibleNext('[data-next]');
 });
 await check('Queued game answer and Continue handlers stop at learner or epoch changes',async()=>{
  await mountFixture();const before=await snapshot();await page.evaluate(async()=>{const {store}=await import('./js/store.js');window.__originalLearner=store.current.learnerId;store.current.learnerId='different-learner';});await page.locator('[data-choice="0"]').click();assert.equal(await page.locator('[data-drill]').getAttribute('data-state'),'question');assert.equal((await snapshot()).xp,before.xp);
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.current.learnerId=window.__originalLearner;});await page.locator('[data-choice="0"]').click();const answered=await snapshot();await page.evaluate(async()=>{const {store}=await import('./js/store.js');window.__epoch=store.learning.epoch.id;store.learning.epoch.id='changed-epoch';});await page.locator('[data-next]').click();assert.equal(await page.evaluate(()=>window.__fixture.state.i),0);assert.equal((await snapshot()).xp,answered.xp);
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.learning.epoch.id=window.__epoch;window.__fixture.destroy();window.__fixtureViewport.destroy();store.setSetting('tts',false);});
 });
 await gotoRoute(page,'/learn/verb/v%3Aparlare?chapter=present');
 await check('An eight-answer visit has a stable count, reloadable feedback and a saved voluntary stop',async()=>{
  for(let n=0;n<80;n++){
   const phase=await page.locator('[data-journey]').getAttribute('data-phase');
   if(phase==='question'){await solveJourneyQuestion(page,await journeyQuestion(page));await page.locator('[data-journey][data-phase="feedback"]').waitFor();await visibleNext('[data-continue]');const s=await snapshot(),v=s.session.ui.visits.present;assert(v.eventIds.length<=8);assert.equal(v.limit,8);
    if(v.eventIds.length===8){assert.equal(await page.locator('[data-continue]').textContent(),'Finish this visit');const text=await page.locator('.journey-feedback-dock').textContent();await reloadApp(page);assert.equal(await page.locator('.journey-feedback-dock').textContent(),text);const after=await snapshot();assert.equal(after.xp,s.xp);assert.deepEqual(after.events,s.events);assert.equal(after.session.ui.visits.present.eventIds.length,8);await visibleNext('[data-continue]');await page.locator('[data-continue]').click();break;}
   }else await advanceJourneyPage(page);
  }
  await page.locator('[data-journey][data-phase="paused"]').waitFor();assert.match(await page.locator('.journey-main').textContent(),/This visit is saved/);assert.equal(await page.locator('[data-resume]').textContent(),'Start the next visit');
 });
 await check('Home and Learn resume the exact saved next question and the next visit keeps coverage separate from readiness',async()=>{
  const saved=await snapshot(),q=saved.session.journey.current;assert(q);assert.equal(saved.session.journey.caseCoveragePolicy,'verb-case-coverage-v1');
  await reloadApp(page);assert.equal((await snapshot()).session.journey.current.questionId,q.questionId);
  await gotoRoute(page,'/home');const href=await page.locator('[data-continue-shared]').getAttribute('href');assert(href.includes(encodeURIComponent(saved.session.id)));await gotoRoute(page,'/learn');assert.equal(await page.locator('[data-continue-shared]').getAttribute('href'),href);await page.locator('[data-continue-shared]').click();await page.locator('[data-resume]').click();assert.equal((await snapshot()).session.journey.current.questionId,q.questionId);assert.equal((await snapshot()).session.ui.visits.present.eventIds.length,0);
  for(let n=0;n<100;n++){const phase=await page.locator('[data-journey]').getAttribute('data-phase');if(phase==='recap'||phase==='complete')break;if(phase==='question')await solveJourneyQuestion(page,await journeyQuestion(page));else await advanceJourneyPage(page);}
  const final=await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{journeyCaseProgress}=await import('./js/learning/journey.js'),{skillState}=await import('./js/learning/model.js');return {case:journeyCaseProgress(buildLesson(getEntry('v:parlare')),store.learning).cases.find(c=>c.id==='present'),skill:skillState(store.learning,'v:parlare::lesson::present::form-0'),visit:store.learning.session.ui.visits.present};});assert(final.case.ready);assert.equal(final.skill.ready,false);assert.equal(final.skill.remembered,false);assert(final.visit.number>=3);
 });
 assert.deepEqual(errors,[]);console.log(`${results.length} journey/game checks passed in ${engine}.`);
}finally{fs.mkdirSync(new URL('../docs/implementation/programme/',import.meta.url),{recursive:true});fs.writeFileSync(new URL(`../docs/implementation/programme/journey-pacing-${engine}.json`,import.meta.url),JSON.stringify({results,errors},null,2));await browser.close();stop();}
