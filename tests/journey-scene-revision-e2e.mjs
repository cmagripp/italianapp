import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,ensureServer,boot,gotoRoute,reloadApp,contextOptions} from './lib.mjs';
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer();
const engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium';
const browser=engine==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width:375,height:667},reducedMotion:'reduce'}));
await context.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel:()=>{},speak:utterance=>{const calls=JSON.parse(sessionStorage.getItem('scene-speech')||'[]');calls.push(utterance.text);sessionStorage.setItem('scene-speech',JSON.stringify(calls));}}}));
const page=await context.newPage(),results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
const check=async(name,run)=>{await run();results.push(name);console.log('PASS',name);};
const saved=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js');return {session:store.learning.session,events:Object.keys(store.learning.events).length,xp:store.current.stats.xp};});
async function seed({fresh=false,malformed=false,progressive=false}={}){
 return page.evaluate(async({fresh,malformed,progressive})=>{
  const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{createJourneySession}=await import('./js/learning/journey.js'),{createJourneyScene}=await import('./js/learning/journey-scene.js');
  store.setSetting('tts',false);store.setSetting('adaptiveLearning',true);
  const entry=getEntry('v:domandare'),plan=buildLesson(entry,{questionBuilder:(await import('./js/learning/lesson-questions.js')).buildJourneyQuestion}),chapter=plan.chapters.find(c=>c.id==='present');
  const targets=chapter.groups.flatMap(g=>g.targets),target=targets.find(t=>progressive?t.progressive&&t.person===0:t.skill==='conjugation'&&t.person===0),next=targets.find(t=>t.skill==='conjugation'&&t.person===1);
  const session=createJourneySession({id:`scene-browser-${crypto.randomUUID()}`,plan,chapterId:'present',caseMode:true,now:Date.now()});
  const variant=target.contexts.findIndex(c=>c.it.includes(fresh||malformed?'a Sara come sta':'una cosa'));
  Object.assign(session.journey,{phase:'practice',serial:1,queue:[target.id,next.id],current:{targetId:target.id,phase:'independent',format:'type',variant,questionId:`${session.id}:journey:1`,supplemental:false,repairTag:null,scenePolicy:'expanded-v1'}});
  session.journey.variants[target.id]={guided:0,independent:variant+1,repair:0};
  session.journey.variants[next.id]={guided:0,independent:next.contexts.findIndex(c=>c.it.includes('a Sara come sta')),repair:0};
  if(fresh||malformed)session.journey.current.sceneSnapshot=createJourneyScene({entryId:entry.id,chapterId:'present',target,variant});
  if(malformed)session.journey.current.sceneSnapshot.context.answers=['invented'];
  session.ui={version:2,questionId:session.journey.current.questionId,draft:progressive?'sto doman':'doman',given:'',result:null,assistance:[],exposures:{},history:[],historyCursor:null,overview:false};
  store.saveLearningSession(session);await store.saveNow();return {id:session.id,questionId:session.journey.current.questionId,target:target.id,variant};
 },{fresh,malformed,progressive});
}
async function seedRetired(inf,{answered=false,legacy=false}={}){
 return page.evaluate(async({inf,answered,legacy})=>{
  const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{createJourneySession}=await import('./js/learning/journey.js'),{createJourneyScene}=await import('./js/learning/journey-scene.js');
  const entry=getEntry(`v:${inf}`),plan=buildLesson(entry,{legacy,questionBuilder:(await import('./js/learning/lesson-questions.js')).buildJourneyQuestion}),chapter=plan.chapters.find(c=>c.id==='present'),target=chapter.groups.flatMap(g=>g.targets).find(t=>t.skill==='conjugation'&&t.person===(inf==='domandare'?0:4));
  const pool=legacy?target.legacyAuthoredContexts:target.legacyExpandedContexts,variant=pool.findIndex(c=>target.retiredExpandedContextIds.includes(c.id)),old=pool[variant];
  const session=createJourneySession({id:`retired-browser-${crypto.randomUUID()}`,plan,chapterId:'present',caseMode:true,now:Date.now()});
  Object.assign(session.journey,{phase:'practice',serial:1,queue:[target.id],current:{targetId:target.id,phase:'independent',format:'type',variant,questionId:`${session.id}:journey:1`,supplemental:false,repairTag:null,...(!legacy?{scenePolicy:'expanded-v1'}:{})}});
  session.journey.variants[target.id]={guided:0,independent:variant+1,repair:0};
  session.ui={version:2,questionId:session.journey.current.questionId,draft:answered?old.answer:'saved draft',given:answered?old.answer:'',result:answered?{ok:true,outcome:'correct',feedback:'Earlier saved feedback',components:[],errorTags:[]}:null,assistance:[],exposures:{},history:[],historyCursor:null,overview:false};
  if(answered){
   const event={id:session.journey.current.questionId,sessionId:session.id,index:0,at:Date.now()-1000,objectiveId:target.id,targetId:target.id,entryId:entry.id,kind:'verb',skill:'conjugation',tense:'presente',person:old.person,role:old.role,policy:'journey-v1',mode:'production',activityKind:'independent',firstAttempt:true,ok:true,outcome:'correct',assistance:[],contextId:old.id,variantId:`${old.id}:italian-gap`,xp:0,countStats:false};
   store.recordLearningAttempt(event);session.index=1;session.answeredEventIds=[event.id];session.journey.awaitingContinue=true;session.journey.lastAttempt={id:event.id,targetId:target.id,variant,ok:true,outcome:'correct',errorTags:[]};
   const group=chapter.groups.find(g=>g.targets.includes(target)),scene=legacy?undefined:createJourneyScene({entryId:entry.id,chapterId:'present',target,variant,legacy:true});
   session.ui.history=[{version:1,entryId:entry.id,contentVersion:plan.version,...(!legacy?{verbFlowVersion:2,scenePolicy:'expanded-v1',sceneSnapshot:scene}:{}),type:'question',chapterId:'present',groupId:group.id,targetId:target.id,questionId:event.id,variant,phase:'independent',format:'type',awaitingContinue:true,given:old.answer,result:session.ui.result,index:1}];
  }
  store.saveLearningSession(session);await store.saveNow();return {id:session.id,entryId:entry.id,questionId:session.journey.current.questionId,old,answered};
 },{inf,answered,legacy});
}
try{
 await boot(page);const source=await seed();await gotoRoute(page,`/learn/verb/v%3Adomandare?session=${encodeURIComponent(source.id)}`);
 await check('A real saved expanded question pins its old sentence and exact unfinished draft',async()=>{
  await page.locator('[data-answer]').waitFor();assert.equal(await page.locator('[data-answer]').inputValue(),'doman');
  assert.match(await page.locator('.journey-prompt').textContent(),/una cosa/);assert.doesNotMatch(await page.locator('.journey-prompt').textContent(),/a Sara/);
  const state=await saved();assert.equal(state.session.journey.current.questionId,source.questionId);assert.equal(state.session.journey.current.sceneSnapshot.context.it,'Io domando una cosa.');assert.equal(state.session.index,0);
  await page.locator('[data-answer]').fill('domand');await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});await reloadApp(page);
  await page.locator('[data-answer]').waitFor();assert.equal(await page.locator('[data-answer]').inputValue(),'domand');assert.match(await page.locator('.journey-prompt').textContent(),/una cosa/);
 });
 await check('Submitted feedback and full sentence playback survive reload without new evidence',async()=>{
  await page.locator('[data-answer-audio]').click();assert((await page.evaluate(()=>JSON.parse(sessionStorage.getItem('scene-speech')||'[]'))).includes('Io domando una cosa.'));
  await page.locator('[data-answer]').fill('domando');await page.locator('[data-check]').click();await page.locator('[data-continue]').waitFor();
  const before=await saved();assert(before.session.journey.awaitingContinue);assert.equal(before.events,1);assert.equal(before.session.journey.current.sceneSnapshot.context.it,'Io domando una cosa.');
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});await reloadApp(page);await page.locator('[data-continue]').waitFor();
  const after=await saved();assert.equal(after.events,before.events);assert.equal(after.xp,before.xp);assert.equal(after.session.journey.current.questionId,source.questionId);assert.deepEqual(after.session.ui.result,before.session.ui.result);assert.equal(after.session.ui.given,'domando');
  assert.match(await page.locator('.journey-prompt').textContent(),/una cosa/);
 });
 await check('Continue selects current content; Back and reload retain the old feedback page and current draft',async()=>{
  await page.locator('[data-continue]').click();await page.locator('[data-answer]').waitFor();
  assert.match(await page.locator('.journey-prompt').textContent(),/a Sara come sta/);
  await page.locator('[data-answer]').fill('domand');const current=await saved();assert.notEqual(current.session.journey.current.questionId,source.questionId);
  assert.equal(current.session.journey.current.sceneSnapshot.context.it,'Tu domandi a Sara come sta.');
  await page.locator('[data-lesson-back]').click();await page.locator('.journey-history-banner').waitFor();assert.match(await page.locator('.journey-prompt').textContent(),/una cosa/);
  assert.match(await page.locator('.journey-given').first().textContent(),/domando/);
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});await reloadApp(page);await page.locator('.journey-history-banner').waitFor();assert.match(await page.locator('.journey-prompt').textContent(),/una cosa/);
  await page.locator('[data-lesson-current]').first().click();await page.locator('[data-answer]').waitFor();assert.equal(await page.locator('[data-answer]').inputValue(),'domand');assert.match(await page.locator('.journey-prompt').textContent(),/a Sara come sta/);
  const after=await saved();assert.equal(after.session.journey.current.questionId,current.session.journey.current.questionId);assert.equal(after.events,1);
 });
 await check('A fresh scene shows the corrected sentence from first paint and retains its exact draft',async()=>{
  await gotoRoute(page,'/home');const source=await seed({fresh:true});await gotoRoute(page,`/learn/verb/v%3Adomandare?session=${encodeURIComponent(source.id)}`);await page.locator('[data-answer]').waitFor();
  assert.match(await page.locator('.journey-prompt').textContent(),/a Sara come sta/);assert.equal(await page.locator('[data-answer]').inputValue(),'doman');
  await reloadApp(page);await page.locator('[data-answer]').waitFor();assert.match(await page.locator('.journey-prompt').textContent(),/a Sara come sta/);assert.equal((await saved()).session.journey.current.questionId,source.questionId);
 });
 await check('A saved progressive question preserves its original construction, answer and full-sentence audio',async()=>{
  await gotoRoute(page,'/home');const source=await seed({progressive:true});await gotoRoute(page,`/learn/verb/v%3Adomandare?session=${encodeURIComponent(source.id)}`);await page.locator('[data-answer]').waitFor();
  assert.equal(await page.locator('[data-answer]').inputValue(),'sto doman');assert.match(await page.locator('.journey-prompt').textContent(),/una cosa/);
  const snapshot=(await saved()).session.journey.current.sceneSnapshot;assert.equal(snapshot.context.it,'Io sto domandando una cosa.');assert.deepEqual(snapshot.context.answers,['sto domandando']);
  await page.locator('[data-answer-audio]').click();assert((await page.evaluate(()=>JSON.parse(sessionStorage.getItem('scene-speech')||'[]'))).includes(snapshot.context.it));
  await page.locator('[data-answer]').fill('sto domandando');await page.locator('[data-check]').click();await page.locator('[data-continue]').waitFor();
  await reloadApp(page);await page.locator('[data-continue]').waitFor();assert.equal((await saved()).session.journey.current.sceneSnapshot.context.it,snapshot.context.it);
 });
 await check('An imported malformed scene is preserved unavailable without replacing its draft or awarding evidence',async()=>{
  await gotoRoute(page,'/home');const source=await seed({malformed:true}),before=await saved();
  await gotoRoute(page,`/learn/verb/v%3Adomandare?session=${encodeURIComponent(source.id)}`);await page.getByText('This saved lesson cannot open yet',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-answer]').count(),0);assert.equal(await page.locator('[data-check]').count(),0);
  const after=await saved();assert.deepEqual(after.session.journey.current,before.session.journey.current);assert.equal(after.session.ui.draft,'doman');assert.equal(after.events,before.events);assert.equal(after.xp,before.xp);
  await reloadApp(page);await page.getByText('This saved lesson cannot open yet',{exact:true}).waitFor();assert.deepEqual((await saved()).session.journey.current,before.session.journey.current);
 });
 for(const inf of ['fiorire','peggiorare','sparire','emanare'])await check(`Retired ${inf} source waits for explicit Continue and preserves its old receipt without credit`,async()=>{
  await gotoRoute(page,'/home');const source=await seedRetired(inf,{answered:inf==='fiorire'}),before=await saved();
  await gotoRoute(page,`/learn/verb/${encodeURIComponent(source.entryId)}?session=${encodeURIComponent(source.id)}`);await page.getByText('This example has been corrected',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-answer]').count(),0);assert.equal(await page.locator('[data-check]').count(),0);assert.equal(await page.locator('[data-answer-audio]').count(),0);assert.equal((await saved()).session.journey.current.questionId,source.questionId);
  await reloadApp(page);await page.getByText('This example has been corrected',{exact:true}).waitFor();
  const pending=await saved();assert.equal(pending.events,before.events);assert.equal(pending.xp,before.xp);assert.equal(pending.session.ui.draft,before.session.ui.draft);assert.deepEqual(pending.session.ui.result,before.session.ui.result);
  await page.locator('[data-continue]').click();await page.locator('[data-answer]').waitFor();const after=await saved();
  assert.notEqual(after.session.journey.current.questionId,source.questionId);assert.equal(after.events,before.events);assert.equal(after.xp,before.xp);assert.equal(after.session.index,before.session.index);
  const recovery=after.session.sceneCorrectionRecovery.at(-1);assert.equal(recovery.current.questionId,source.questionId);assert.equal(recovery.ui.draft,before.session.ui.draft);assert.equal(recovery.ui.given,before.session.ui.given);assert.deepEqual(recovery.journey.lastAttempt,before.session.journey.lastAttempt);
  if(source.answered){assert.equal(recovery.ui.result.feedback,'Earlier saved feedback');assert.equal(recovery.ui.history[0].given,source.old.answer);assert(after.session.answeredEventIds.includes(source.questionId));}
  assert.doesNotMatch(await page.locator('.journey-prompt').textContent(),/sono fiorite|sono peggiorate|sono sparite|saranno emanate/);
  const questionId=after.session.journey.current.questionId;await reloadApp(page);await page.locator('[data-answer]').waitFor();assert.equal((await saved()).session.journey.current.questionId,questionId);assert.equal((await saved()).events,before.events);
 });
 await check('Domandare retires only the old wording and uses the corrected sentence with the same source ID',async()=>{
  await gotoRoute(page,'/home');const source=await seedRetired('domandare'),before=await saved();await gotoRoute(page,`/learn/verb/${encodeURIComponent(source.entryId)}?session=${encodeURIComponent(source.id)}`);await page.getByText('This example has been corrected',{exact:true}).waitFor();
  const old=(await saved()).session.journey.current.sceneSnapshot;assert.equal(old.context.it,'Io domando una domanda.');
  await page.locator('[data-continue]').click();await page.locator('[data-answer]').waitFor();assert.match(await page.locator('.journey-prompt').textContent(),/a Sara come sta/);
  const after=await saved();assert.equal(after.session.journey.current.sceneSnapshot.context.id,old.context.id);assert.notEqual(after.session.journey.current.sceneSnapshot.sourceRevision,old.sourceRevision);assert.notEqual(after.session.journey.current.questionId,source.questionId);assert.equal(after.events,before.events);assert.equal(after.xp,before.xp);
  await reloadApp(page);await page.locator('[data-answer]').waitFor();assert.match(await page.locator('.journey-prompt').textContent(),/a Sara come sta/);
 });
 await check('An ordinary v1 false-tense cursor also transitions explicitly instead of grading its retired sentence',async()=>{
  await gotoRoute(page,'/home');const source=await seedRetired('fiorire',{legacy:true}),before=await saved();await gotoRoute(page,`/learn/verb/${encodeURIComponent(source.entryId)}?session=${encodeURIComponent(source.id)}`);await page.getByText('This example has been corrected',{exact:true}).waitFor();assert.equal(await page.locator('[data-check]').count(),0);
  await page.locator('[data-continue]').click();await page.locator('[data-answer]').waitFor();assert.doesNotMatch(await page.locator('.journey-prompt').textContent(),/sono fiorite/);const after=await saved();assert.equal(after.events,before.events);assert.equal(after.xp,before.xp);assert.notEqual(after.session.journey.current.questionId,source.questionId);assert.equal(after.session.sceneCorrectionRecovery.at(-1).ui.draft,'saved draft');
 });
 async function odiareAlias({retired=false,changed=false}={}){
  return page.evaluate(async({retired,changed})=>{
   const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{createJourneySession}=await import('./js/learning/journey.js'),{createJourneyScene,journeySceneContexts}=await import('./js/learning/journey-scene.js');
   const entry=getEntry('v:odiare'),plan=buildLesson(entry,{questionBuilder:(await import('./js/learning/lesson-questions.js')).buildJourneyQuestion}),chapter=plan.chapters.find(c=>c.id==='present'),target=chapter.groups.flatMap(g=>g.targets).find(t=>retired?t.id.endsWith('v2-mixed-simple'):t.skill==='conjugation'&&t.person===0);
   const pool=journeySceneContexts(target,{legacy:true}),variant=pool.findIndex(c=>retired?target.retiredExpandedContextIds.includes(c.id):c.it==='Odio alzarmi presto.');
   const scene=createJourneyScene({entryId:entry.id,chapterId:'present',target,variant,legacy:true,sourceRevision:target.legacyExpandedRevisionAliases[0]});
   if(changed)scene.context.en='I love getting up early.';
   const session=createJourneySession({id:'alias-browser:'+crypto.randomUUID(),plan,chapterId:'present',caseMode:true,now:Date.now()});
   Object.assign(session.journey,{phase:'practice',serial:1,queue:[target.id],current:{targetId:target.id,phase:'independent',format:'type',variant,questionId:session.id+':journey:1',supplemental:false,repairTag:null,scenePolicy:'expanded-v1',sceneRevision:scene.sourceRevision,sceneSnapshot:scene}});
   session.ui={version:2,questionId:session.journey.current.questionId,draft:'odia',given:'',result:null,assistance:[],exposures:{},history:[],historyCursor:null,overview:false};
   store.saveLearningSession(session);await store.saveNow();return {id:session.id,scene};
  },{retired,changed});
 }
 await check('An actual prior odiare alias keeps its valid Italian, draft and receipt through page reload',async()=>{
  await gotoRoute(page,'/home');const source=await odiareAlias(),before=await saved();await gotoRoute(page,`/learn/verb/v%3Aodiare?session=${encodeURIComponent(source.id)}`);await page.locator('[data-answer]').waitFor();assert.match(await page.locator('.journey-prompt').textContent(),/alzarmi presto/);assert.equal(await page.locator('[data-answer]').inputValue(),'odia');
  await reloadApp(page);await page.locator('[data-answer]').waitFor();assert.deepEqual((await saved()).session.journey.current.sceneSnapshot,source.scene);
  await page.locator('[data-answer]').fill('odio');await page.locator('[data-check]').click();await page.locator('[data-continue]').waitFor();const answered=await saved();assert.equal(answered.events,before.events+1);await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});await reloadApp(page);await page.locator('[data-continue]').waitFor();const resumed=await saved();assert.deepEqual(resumed.session.ui.result,answered.session.ui.result);assert.equal(resumed.events,answered.events);assert.deepEqual(resumed.session.journey.current.sceneSnapshot,source.scene);
 });
 await check('Prior aliases reject changed translation and still require explicit retirement recovery without credit',async()=>{
  await gotoRoute(page,'/home');let source=await odiareAlias({changed:true}),before=await saved();await gotoRoute(page,`/learn/verb/v%3Aodiare?session=${encodeURIComponent(source.id)}`);await page.getByText('This saved lesson cannot open yet',{exact:true}).waitFor();assert.equal(await page.locator('[data-answer]').count(),0);assert.equal((await saved()).events,before.events);
  await gotoRoute(page,'/home');source=await odiareAlias({retired:true});before=await saved();await gotoRoute(page,`/learn/verb/v%3Aodiare?session=${encodeURIComponent(source.id)}`);await page.getByText('This example has been corrected',{exact:true}).waitFor();assert.equal(await page.locator('[data-check]').count(),0);await reloadApp(page);await page.getByText('This example has been corrected',{exact:true}).waitFor();await page.locator('[data-continue]').click();await page.locator('[data-answer]').waitFor();const after=await saved();assert.equal(after.events,before.events);assert.equal(after.xp,before.xp);assert.equal(after.session.sceneCorrectionRecovery.at(-1).current.sceneSnapshot.sourceRevision,source.scene.sourceRevision);assert.notEqual(after.session.journey.current.sceneSnapshot.sourceRevision,source.scene.sourceRevision);assert.match(after.session.journey.current.sceneSnapshot.context.it,/rumore di notte/);
 });
 await check('A supported imported question with empty variant counters saves assisted feedback and resumes once',async()=>{
  await gotoRoute(page,'/home');const source=await seed({fresh:true});
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');const session=JSON.parse(JSON.stringify(store.learning.session));session.journey.variants={};store.saveLearningSession(session);await store.saveNow();});
  const before=await saved();await gotoRoute(page,`/learn/verb/v%3Adomandare?session=${encodeURIComponent(source.id)}`);await page.locator('[data-answer]').waitFor();
  await page.locator('[data-help]').click();await page.locator('[data-answer]').fill('domando');await page.locator('[data-check]').click();await page.locator('[data-continue]').waitFor();
  const answered=await saved();assert.equal(answered.events,before.events+1);assert.equal(answered.session.index,1);assert.deepEqual(answered.session.journey.variants[source.target],{guided:0,independent:source.variant,repair:0});
  const evidence=await page.evaluate(async target=>{const {store}=await import('./js/store.js'),{skillState}=await import('./js/learning/model.js');return {event:store.learning.events[store.learning.session.ui.questionId],ready:skillState(store.learning,target).ready};},source.target);
  assert(evidence.event.assistance.includes('hint'));assert.equal(evidence.ready,false);await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});
  await reloadApp(page);await page.locator('[data-continue]').waitFor();const resumed=await saved();assert.equal(resumed.events,answered.events);assert.equal(resumed.xp,answered.xp);assert.deepEqual(resumed.session.ui.result,answered.session.ui.result);assert.equal(resumed.session.journey.current.questionId,source.questionId);
  await page.locator('[data-continue]').click();assert.equal((await saved()).events,answered.events);
 });
 assert.deepEqual(errors,[]);fs.mkdirSync('docs/implementation/programme',{recursive:true});fs.writeFileSync(`docs/implementation/programme/journey-scene-${engine}.json`,JSON.stringify({engine,checks:results.length,results,pageErrors:errors},null,2)+'\n');console.log(`${results.length} ${engine} scene revision browser checks passed.`);
}finally{await browser.close();stop();}
