import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,ensureServer,boot,gotoRoute,reloadApp,contextOptions} from './lib.mjs';
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer();
const engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium';
const browser=engine==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width:375,height:667},reducedMotion:'reduce'}));
const page=await context.newPage(),results=[],errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
const check=async(name,run)=>{await run();results.push(name);console.log('PASS',name);};
const snapshot=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js');const s=Object.values(store.learning.sessions).filter(s=>s.reviewVisit).sort((a,b)=>b.updatedAt-a.updatedAt)[0];return {session:s,xp:store.current.stats.xp,events:Object.keys(store.learning.events).length};});
async function visibleContinue(){
 const metrics=await page.locator('[data-next]').evaluate(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:r.top,bottom:r.bottom,height:r.height,viewport:visualViewport?.height||innerHeight,hit:hit===button||button.contains(hit),scrollY,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};});
 assert(metrics.top>=0&&metrics.bottom<=metrics.viewport+1,JSON.stringify(metrics));assert(metrics.hit,JSON.stringify(metrics));assert(metrics.height>=44);assert.equal(metrics.scrollY,0);assert(metrics.scrollWidth<=metrics.width+1);
}
try {
 await boot(page);
 await page.evaluate(async()=>{
  const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{setCompletionRecord}=await import('./js/learning/model.js'),{qGender}=await import('./js/games/questions.js');
  store.setSetting('tts',false);store.setSetting('adaptiveLearning',true);store.setSetting('studyMinutes',5);
  store.current.scope={mode:'lists',lists:['bank']};store.current.lists.bank.items=['w:casa|noun'];
  const now=Date.now(),entries=[['w:casa|noun','word'],['w:libro|noun','word'],['v:credere','past']];
  for(const [entryId,caseId] of entries)store.current.learning=setCompletionRecord(store.learning,{entryId,caseId,checked:true,at:now-86400e3,id:`fixture:${entryId}:${caseId}`});
  const q=qGender(getEntry('w:casa|noun'));
  store.recordLearningAttempt({...q.meta,sessionId:'real-game',index:0,at:now-2*86400e3,firstAttempt:true,assistance:[],ok:false,outcome:'incorrect',errorTags:['article'],components:[{skill:'article',ok:false}],xp:0});
  window.__gameObjective=q.meta.objectiveId;await store.saveNow();
 });
 await gotoRoute(page,'/review');
 await check('Review groups words and completed verb cases while retaining outside-scope due work',async()=>{
  await page.locator('[data-review-queue]').waitFor();assert.equal(await page.locator('[data-review-row]').count(),3);
  const rows=await page.locator('[data-review-row]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.reviewRow,text:n.textContent})));
  assert(rows.some(r=>r.id==='v:credere|past'&&r.text.includes('outside today')));assert(!rows.some(r=>r.id.startsWith('v:credere|')&&r.id!=='v:credere|past'));
 });
 await page.locator('[data-review-start]').click();await page.locator('[data-drill]').waitFor();
 await check('The short mixed visit has a fixed bounded denominator and updates the actual game difficulty',async()=>{
  const before=await snapshot(),v=before.session.reviewVisit;assert(v.total<=8);assert(v.total>=3);assert.equal(new Set(v.questions.slice(0,3).map(q=>q.rowId)).size,3);
  const frame=v.questions[v.index];assert.equal(frame.objectiveId,await page.evaluate(()=>window.__gameObjective));
  const choice=frame.question.choices.findIndex(c=>c.correct);await page.locator(`[data-choice="${choice}"]`).click();await page.locator('[data-next]').waitFor();await visibleContinue();
  const after=await snapshot();assert.equal(after.events,before.events+1);assert.equal(after.xp,before.xp+2);assert.equal(after.session.reviewVisit.total,v.total);
  const evidence=await page.evaluate(async id=>{const {store}=await import('./js/store.js'),{skillState}=await import('./js/learning/model.js');return {event:Object.values(store.learning.events).find(e=>e.id.startsWith('review:')),state:skillState(store.learning,id)};},frame.objectiveId);
  assert.equal(evidence.event.objectiveId,frame.objectiveId);assert(evidence.state.due>Date.now());assert.equal(evidence.state.independentCorrect,0);
 });
 await check('Feedback survives reload without changing rewards or duplicating evidence',async()=>{
  const before=await snapshot(),text=await page.locator('[data-feedback]').textContent();await reloadApp(page);await page.locator('[data-next]').waitFor();
  const after=await snapshot();assert.equal(after.xp,before.xp);assert.equal(after.events,before.events);assert.deepEqual(after.session.reviewVisit.result,before.session.reviewVisit.result);assert.equal(await page.locator('[data-feedback]').textContent(),text);await visibleContinue();
 });
 await page.locator('[data-next]').click();await page.locator('[data-drill][data-state="question"]').waitFor();
 await check('Pause and Home/Learn Continue return to the exact saved review',async()=>{
  const before=await snapshot();await page.locator('[data-review-pause]').click();assert.equal(await page.locator('[data-review-resume]').count(),1);
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});await gotoRoute(page,'/home');
  const href=await page.locator('[data-continue-shared]').getAttribute('href');assert(href.includes(encodeURIComponent(before.session.id)),href);assert.match(await page.locator('[data-continue-label]').textContent(),/short review/i);
  await gotoRoute(page,'/learn');assert.equal(await page.locator('[data-continue-shared]').getAttribute('href'),href);
  await page.locator('[data-continue-shared]').click();await page.locator('[data-review-resume]').waitFor();await page.locator('[data-review-resume]').click();
  const after=await snapshot();assert.equal(after.session.id,before.session.id);assert.equal(after.session.reviewVisit.index,before.session.reviewVisit.index);assert.equal(after.session.reviewVisit.total,before.session.reviewVisit.total);
 });
 await check('An uncheck fences a saved case and the visit remains finite',async()=>{
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setCompletion('v:credere',{caseId:'past',checked:false});await store.saveNow();});
  await reloadApp(page);
  for(let i=0;i<10&&!(await page.locator('[data-review-complete]').count());i++){
   const feedback=page.locator('[data-next]');
   if(await feedback.count()){const saved=await snapshot();if(saved.session.reviewVisit.result?.outcome==='skipped'){assert.equal(await page.locator('[data-choice]').count(),0);assert.equal(await page.locator('[data-answer]').count(),0);}await visibleContinue();await feedback.click();}
   else{const state=await snapshot(),frame=state.session.reviewVisit.questions[state.session.reviewVisit.index];assert.notEqual(frame.caseId,'past');const index=frame.question.choices.findIndex(c=>c.correct);await page.locator(`[data-choice="${index}"]`).click();}
   await page.waitForTimeout(80);
  }
  await page.locator('[data-review-complete]').waitFor();
  const state=await snapshot();assert.equal(state.session.reviewVisit.index,state.session.reviewVisit.total);assert.equal(state.session.reviewVisit.answers.filter(a=>a.outcome==='skipped').length>0,true);
  await gotoRoute(page,'/review');assert.equal(await page.locator('[data-review-row="v:credere|past"]').count(),0);
 });
 await check('Typed review retains its exact draft and submitted accent policy through page reload',async()=>{
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setCompletion('w:caffè|noun',{checked:true});const item=store.ensureItem('w:caffè|noun');Object.assign(item,{learned:true,seen:2,due:Date.now()-1000});await store.saveNow();});
  await gotoRoute(page,'/review?start=1&fresh=1&typed=1&target=w%3Acaff%C3%A8%7Cnoun%7Cword');await page.locator('[data-answer]').waitFor();await page.locator('[data-answer]').fill('caffe');
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});const before=await snapshot();await reloadApp(page);await page.locator('[data-answer]').waitFor();assert.equal(await page.locator('[data-answer]').inputValue(),'caffe');assert.equal((await snapshot()).session.id,before.session.id);
  await page.locator('[data-check]').click();await page.locator('[data-next]').waitFor();assert.equal(await page.locator('[data-answer]').inputValue(),'caffè');assert.match(await page.locator('.submission-note').textContent(),/caffe/);await visibleContinue();
  const submitted=await snapshot();await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setSetting('accentStrict',true);await store.saveNow();});await reloadApp(page);await page.locator('[data-next]').waitFor();assert.equal(await page.locator('[data-answer]').inputValue(),'caffè');assert.equal((await snapshot()).events,submitted.events);
 });
 await check('Listening review records unsupported guesses and preserves the complete reviewed audio source',async()=>{
  await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{loadGrammarLesson}=await import('./js/learning/grammar-course.js');
   const lesson=await loadGrammarLesson('g:v2-f-listen-first-contact'),target=lesson.targets[0],questions=lesson.steps.filter(s=>s.kind==='question'&&s.stage==='independent');
   for(let i=0;i<6;i++){const q=questions[i%questions.length];store.recordLearningAttempt({id:`listening-fixture:${i}`,entryId:`g:${lesson.id}`,objectiveId:target.id,kind:'grammar',skill:q.facet,sessionId:`listening-fixture:${i}`,index:0,at:Date.now()-(20-i)*86400e3,
    policy:'grammar-v2',contentVersion:2,grammarPhase:'independent',facet:q.facet,requiredFacets:target.facets,minIndependent:target.minIndependent,requiresProduction:false,modality:'listening',mode:'recognition',firstAttempt:true,assistance:[],ok:true,outcome:'correct',variantId:q.id,contextId:q.contextKey,exposureGroup:q.exposureGroup,xp:0});}
   await store.saveNow();
  });
  await gotoRoute(page,'/review?start=1&fresh=1&target=g%3Av2-f-listen-first-contact%7Cgrammar');await page.locator('[data-review-audio]').waitFor();
  let state=await snapshot(),q=state.session.reviewVisit.questions[0].question;assert(q.audioAsset.reviewed);assert(q.audioAsset.src.startsWith('audio/course-v2/'));assert(!(await page.locator('.q-card').textContent()).includes(q.say));
  await page.locator(`[data-choice="${q.choices.findIndex(c=>c.correct)}"]`).click();await page.locator('[data-next]').waitFor();
  const event=await page.evaluate(async id=>{const {store}=await import('./js/store.js');return store.learning.events[id+':answer:0'];},state.session.id);assert(event.assistance.includes('audio-unavailable'));assert.equal(event.modality,'listening');
 });
 await check('A complete audio replay earns listening evidence and survives exact visit reload',async()=>{
  await gotoRoute(page,'/review?start=1&fresh=1&mode=extra&target=g%3Av2-f-listen-first-contact%7Cgrammar');await page.locator('[data-review-audio]').waitFor();
  const before=await snapshot(),q=before.session.reviewVisit.questions[0].question;
  const duration=await page.locator('[data-review-audio]').evaluate(audio=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Reviewed audio did not play to completion')),12000);
   audio.addEventListener('ended',()=>{clearTimeout(timer);resolve(audio.duration);},{once:true});audio.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Reviewed audio failed to decode'));},{once:true});audio.play().catch(reject);
  }));assert(duration>0);await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});await reloadApp(page);await page.locator('[data-review-audio]').waitFor();
  const resumed=await snapshot();assert.equal(resumed.session.id,before.session.id);assert(resumed.session.reviewVisit.audioPlayed.includes(q.audioId));assert.equal(resumed.session.reviewVisit.questions[0].question.say,q.say);
  await page.locator(`[data-choice="${q.choices.findIndex(c=>c.correct)}"]`).click();await page.locator('[data-next]').waitFor();
  const event=await page.evaluate(async id=>{const {store}=await import('./js/store.js');return store.learning.events[id+':answer:0'];},before.session.id);assert.deepEqual(event.assistance,[]);await visibleContinue();
 });
 await check('Grammar review retains the authored Italian gap and the situation that determines its answer',async()=>{
  const sessionId=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{loadGrammarLesson}=await import('./js/learning/grammar-course.js'),{createReviewVisit}=await import('./js/learning/review-session.js');
   const lesson=await loadGrammarLesson('g:v2-a1-weather-conditions'),target=lesson.targets[0],row={id:`g:${lesson.id}|grammar`,entry:{id:`g:${lesson.id}`,kind:'grammar'},label:lesson.title,caseId:'grammar',targets:[{objectiveId:target.id,skill:'weather',due:0}]};
   const session=createReviewVisit(store,[row],{id:'review:authored-situation',limit:1});store.saveLearningSession(session);await store.saveNow();return session.id;
  });
  await gotoRoute(page,'/review?start=1&session='+encodeURIComponent(sessionId));await page.locator('[data-drill]').waitFor();
  const state=await snapshot(),q=state.session.reviewVisit.questions[0].question,text=await page.locator('.q-card').textContent();assert(text.includes(q.sourceStep.context));assert(text.includes(q.sourceStep.translation));
 });
 await check('Grammar Review preserves a written error after choice repair and requests its exact typed check through reload',async()=>{
  const targetId=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{loadGrammarLesson}=await import('./js/learning/grammar-course.js'),{skillState}=await import('./js/learning/model.js');
   const lesson=await loadGrammarLesson('g:v2-a1-weather-conditions'),target=lesson.targets[0],all=lesson.steps.filter(q=>q.kind==='question'&&q.target===target.id&&q.stage==='independent');
   const typed=all.filter(q=>q.format==='type'),choices=all.filter(q=>q.format==='choice'),now=Date.now(),day=86400e3;
   const events=[[typed[0],'writing',0,now-10*day,true],[typed[1],'writing',3,now-10*day+3000,true],
    [typed[0],'writing-error',0,now-4*day,false],[choices[0],'choice-repair',0,now-3*day,true],[choices[1],'choice-repair',3,now-3*day+3000,true]];
   events.forEach(([q,sessionId,index,at,ok],i)=>store.recordLearningAttempt({id:`grammar-written-fixture:${i}`,entryId:`g:${lesson.id}`,objectiveId:target.id,kind:'grammar',skill:q.facet,sessionId,index,at,
    policy:'grammar-v2',contentVersion:2,grammarPhase:'independent',facet:q.facet,requiredFacets:target.facets,minIndependent:target.minIndependent,requiresProduction:target.requiresProduction,modality:target.modality,
    mode:q.format==='type'?'production':'recognition',responseMode:q.format==='type'?'production':'recognition',firstAttempt:true,assistance:[],ok,outcome:ok?'correct':'incorrect',variantId:q.id,contextId:q.contextKey,exposureGroup:q.exposureGroup,xp:0}));
   const s=skillState(store.learning,target.id);if(!s.ready||s.unresolvedErrors.length||s.productionReady||s.responseEvidence.written.unresolvedErrors.length!==1)throw Error('Written-error fixture failed');
   await store.saveNow();return target.id;
  });
  await gotoRoute(page,'/review?start=1&fresh=1&mode=extra&target=g%3Av2-a1-weather-conditions%7Cgrammar&objective='+encodeURIComponent(targetId));
  await page.locator('[data-answer]').waitFor();await page.locator('[data-answer]').fill('Una bozza');
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();});const before=await snapshot();
  assert.equal(before.session.reviewVisit.questions[0].question.type,'type');assert.equal(before.session.reviewVisit.questions[0].objectiveId,targetId);
  await reloadApp(page);await page.locator('[data-answer]').waitFor();assert.equal(await page.locator('[data-answer]').inputValue(),'Una bozza');assert.equal((await snapshot()).session.id,before.session.id);
  await page.locator('[data-answer]').fill(before.session.reviewVisit.questions[0].question.answer[0]);await page.locator('[data-check]').click();await page.locator('[data-next]').waitFor();await visibleContinue();
  const s=await page.evaluate(async id=>{const {store}=await import('./js/store.js'),{skillState}=await import('./js/learning/model.js');return skillState(store.learning,id);},targetId);
  assert.equal(s.productionReady,true);assert.equal(s.productionRemembered,false);assert.equal(s.responseEvidence.written.unresolvedErrors.length,0);
 });
 assert.deepEqual(errors,[]);
} finally {
 fs.mkdirSync('docs/implementation/programme',{recursive:true});fs.writeFileSync(`docs/implementation/programme/unified-review-${engine}.json`,JSON.stringify({browser:engine,passed:results.length,results,errors},null,2));await context.close();await browser.close();stop();
}
