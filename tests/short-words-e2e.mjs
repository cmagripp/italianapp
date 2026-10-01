#!/usr/bin/env node
// Short word introductions: real choices/matches, honest evidence and persistence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadPlaywright,launchBrowser,contextOptions,ensureServer,boot,gotoRoute,reloadApp,TESTS_DIR,SHOTS_DIR} from './lib.mjs';
import {journeyQuestion,solveJourneyQuestion,advanceJourneyPage} from './journey-driver.mjs';
const {chromium,devices}=await loadPlaywright(),stopServer=await ensureServer(),browser=await launchBrowser(chromium);
const results=[],errors=[],screenshots=[];let context,page;
fs.mkdirSync(SHOTS_DIR,{recursive:true});
async function fresh(width=390,theme='light'){
 await context?.close();context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width,height:width===375?667:844},reducedMotion:'reduce'}));page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/fonts\.g(oogleapis|static)\.com/.test(m.location()?.url||''))errors.push(m.text());});await boot(page);
 await page.evaluate(async theme=>{const{store}=await import('./js/store.js');store.setSetting('theme',theme);store.setSetting('tts',false);},theme);
 await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
}
async function check(name,run){
 if(process.env.SHORT_WORD_FILTER&&!name.toLowerCase().includes(process.env.SHORT_WORD_FILTER.toLowerCase())&&name!=='No application errors')return;
 const start=Date.now();try{const detail=await run();results.push({name,ok:true,ms:Date.now()-start,detail});console.log('PASS',name);}catch(error){results.push({name,ok:false,error:error.stack,visible:await page?.locator('body').innerText().catch(()=> '')});console.error('FAIL',name,error.message);throw error;}
}
const route=id=>'/learn/word/'+encodeURIComponent(id);
async function state(){return page.evaluate(async()=>{
 const{store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{currentJourneyStep,journeyProgress}=await import('./js/learning/journey.js'),{skillState}=await import('./js/learning/model.js');await store.saveNow();
 const session=store.learning.session,entry=getEntry(session.entryId),plan=buildLesson(entry),events=Object.values(store.learning.events);
 return{session,plan,step:currentJourneyStep(plan,session,store.learning),progress:journeyProgress(plan,session,store.learning),events,xp:store.current.stats.xp,learned:store.isLearned(entry.id),phase:document.querySelector('[data-journey]')?.dataset.phase,skills:[...new Set(events.filter(e=>e.entryId===entry.id).map(e=>e.objectiveId))].map(id=>skillState(store.learning,id))};
 });}
const sorted=events=>[...events].sort((a,b)=>a.id.localeCompare(b.id));
function unchanged(a,b){assert.deepEqual(sorted(a.events),sorted(b.events));assert.equal(a.xp,b.xp);}
function expected(q){
 if(q.meta?.entryId==='w:casa|noun'){
  const known={meaning:['house','home'],recall:['casa','la casa'],article:['la','la casa'],plural:['case','le case']};
  if(known[q.meta.skill]){assert(q.answer.some(a=>known[q.meta.skill].includes(a)),`known casa ${q.meta.skill}: ${q.answer}`);return q.answer.find(a=>known[q.meta.skill].includes(a));}
 }
 return q.answer[0];
}
async function nextQuestion(limit=35){
 for(let n=0;n<limit;n++){const s=await state();if(s.phase==='question')return journeyQuestion(page);assert(!['complete','unavailable','paused'].includes(s.phase));await advanceJourneyPage(page);}
 throw Error('Short teaching did not reach an activity');
}
async function finish({limit=65}={}){
 const questions=[],teaching=[];
 for(let n=0;n<limit;n++){
  const s=await state();if(s.step.type==='complete')return{...s,questions,teaching};
  assert(!['unavailable','paused','blocked'].includes(s.phase),'a short word lesson remains answerable');
  if(s.phase==='question'){
   const q=await journeyQuestion(page);assert(['mc','pairs'].includes(q.type),'default short words use choice/matching, without required writing');assert.equal(q.meta.mode,'recognition');assert.equal(await page.locator('[data-answer]').count(),0);
   questions.push({type:q.type,skill:q.meta.skill,answer:q.answer,slotId:s.session.journey.wordShort?.slotId});await solveJourneyQuestion(page,q,{expected});
  }else{if(s.phase==='teach')teaching.push(await page.locator('.journey-main').innerText());await advanceJourneyPage(page);}
 }
 throw Error('A short word lesson did not finish within the bounded correct-answer traversal');
}
async function shot(name){const file=path.join(SHOTS_DIR,'short-words-'+name+'.png');await page.screenshot({path:file,fullPage:false,animations:'disabled'});screenshots.push(file);}
function honestRecognition(s){
 assert(s.events.filter(e=>e.entryId===s.session.entryId).every(e=>e.mode==='recognition'),'choices/matches are never rewritten as independent production');
 assert(s.skills.every(skill=>!skill.ready&&!skill.remembered),'a short recognition introduction does not fabricate independent mastery or retention');
}
try{
 await check('A noun completes six to eight real short activities with article and plural teaching',async()=>{
  await fresh();await gotoRoute(page,route('w:casa|noun'));const intro=await state();assert(intro.plan.wordLesson);assert(intro.plan.wordLesson.slots.length>=6&&intro.plan.wordLesson.slots.length<=8);
  const done=await finish();assert.equal(done.progress.complete,true);assert.equal(done.learned,true);assert(done.questions.length>=6&&done.questions.length<=8);assert(done.questions.some(q=>q.type==='pairs'));assert(done.questions.some(q=>q.type==='mc'));
  const teaching=done.teaching.join(' ');assert.match(teaching,/la casa/);assert.match(teaching,/le case/);honestRecognition(done);assert.doesNotMatch(await page.locator('[data-journey]').innerText(),/mastered|remembered|independent answers/i);
  const before=await state();await reloadApp(page);unchanged(before,await state());await shot('noun-complete');return{activityPages:done.questions.length,eventCount:done.events.length};
 });
 await check('A wrong choice repairs the same word and a copied correction is not independent proof',async()=>{
  await fresh();await gotoRoute(page,route('w:casa|noun'));let q=await nextQuestion();assert.equal(q.type,'mc');const before=await state();
  const index=q.choices.findIndex(c=>!q.answer.includes(c.value||c.label));assert(index>=0);await page.locator(`[data-choice="${index}"]`).click();const wrong=await state();assert.equal(wrong.events.length,before.events.length+1);assert.equal(wrong.events.at(-1).ok,false);assert.equal(wrong.progress.complete,false);
  assert.equal(wrong.step.awaitingContinue,true);await reloadApp(page);unchanged(wrong,await state());assert.equal((await state()).phase,'feedback');await page.locator('[data-continue]').click();
  assert.equal((await state()).session.entryId,'w:casa|noun');
  for(let retry=0;retry<2;retry++){q=await nextQuestion();assert.equal(q.type,'mc');const wrongIndex=q.choices.findIndex(c=>!q.answer.includes(c.value||c.label));await page.locator(`[data-choice="${wrongIndex}"]`).click();const still=await state();assert.equal(still.progress.complete,false);assert.equal(still.session.journey.wordShort.slotId,wrong.session.journey.wordShort.slotId,'repeated misses keep the failed short slot');assert(!still.session.journey.wordShort.completed[still.session.journey.wordShort.slotId]);await page.locator('[data-continue]').click();}
  const done=await finish({limit:80});assert(done.progress.complete);honestRecognition(done);assert(done.events.filter(e=>!e.ok).length>=3);assert(done.events.some(e=>e.ok&&e.at>=wrong.events.at(-1).at));
 });
 await check('Reveal and explicit skip keep unfinished word work honest',async()=>{
  await fresh();await gotoRoute(page,route('w:casa|noun'));await nextQuestion();const before=await state();await page.locator('[data-reveal]').click();const revealed=await state();assert.equal(revealed.xp,before.xp);assert.equal(revealed.progress.complete,false);assert(revealed.events.some(e=>e.outcome==='revealed'));
  await page.locator('[data-continue]').click();
  for(let i=0;i<35;i++){const s=await state();if(s.step.type==='complete')break;if(s.phase==='question'||s.phase==='teach'||s.phase==='repair')await page.locator('[data-skip]').click();else await advanceJourneyPage(page);}
  const end=await state();assert.equal(end.progress.complete,false);assert.equal(end.learned,false);assert.equal(end.xp,before.xp);honestRecognition(end);await shot('skipped-unfinished');
 });
 await check('A partial matching board survives pause, reload and Back without duplicate awards',async()=>{
  await fresh();await gotoRoute(page,route('w:casa|noun'));let q;
  for(let i=0;i<25;i++){q=await nextQuestion();if(q.type==='pairs')break;await solveJourneyQuestion(page,q,{expected});await page.locator('[data-continue]').click();}
  assert.equal(q.type,'pairs');assert.deepEqual(q.pairs.map(p=>p.canonical).sort(),['la casa','le case'],'real article+noun forms, not sentence fragments');await shot('matching-two-rows');const pair=q.pairs[0],right=q.rightTiles.find(t=>pair.answers.includes(t.text));
  await page.locator(`[data-pair-left=${JSON.stringify(pair.id)}]`).click();await page.locator(`[data-pair-right=${JSON.stringify(right.id)}]`).click();const partial=await state();
  assert.equal(await page.locator(`[data-pair-left=${JSON.stringify(pair.id)}]`).isVisible(),true);assert.equal(await page.locator(`[data-pair-left=${JSON.stringify(pair.id)}]`).isDisabled(),true);assert.match(await page.locator(`[data-pair-left=${JSON.stringify(pair.id)}]`).getAttribute('class'),/is-matched/);await page.locator('[data-pause]').click();await reloadApp(page);await page.locator('[data-resume]').click();unchanged(partial,await state());
  assert.equal(await page.locator(`[data-pair-left=${JSON.stringify(pair.id)}]`).isVisible(),true);assert.equal(await page.locator(`[data-pair-left=${JSON.stringify(pair.id)}]`).isDisabled(),true);assert.match(await page.locator(`[data-pair-left=${JSON.stringify(pair.id)}]`).getAttribute('class'),/is-matched/);const current=await state();await page.locator('[data-lesson-back]').click();assert.equal(await page.locator('[data-journey]').getAttribute('data-history'),'true');await page.locator('[data-lesson-current]').first().click();unchanged(current,await state());
  await solveJourneyQuestion(page,q,{expected});const answered=await state();await reloadApp(page);unchanged(answered,await state());assert.equal((await state()).phase,'feedback');await shot('matching-resumed');
 });
 await check('An older long word session upgrades without deleting its answer history, XP or other progress',async()=>{
  await fresh();const old=await page.evaluate(async()=>{
   const{store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),{buildLesson}=await import('./js/learning/lesson-content.js'),{createJourneySession}=await import('./js/learning/journey.js');
   const plan=buildLesson(getEntry('w:casa|noun'));let session=createJourneySession({id:'older-long-word-lesson',plan,now:Date.now()-86400000,mode:'lesson'});delete session.journey.wordShort;
   const target=plan.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets)).find(t=>t.skill==='recall');
   store.recordLearningAttempt({id:'prior-real-word-answer',sessionId:session.id,entryId:plan.entryId,objectiveId:target.id,targetId:target.id,kind:'word',skill:'recall',chapterId:'meaning',contentVersion:plan.version,policy:'journey-v1',mode:'production',activityKind:'independent',variantId:'older-word-cue',contextId:'older-word-context',firstAttempt:true,ok:true,outcome:'correct',assistance:[],components:[],errorTags:[],at:Date.now()-86400000});
   session.index=1;session.journey.serial=Math.max(1,session.journey.serial||0);session.deferred[target.id]=12345;session.journey.skipped[target.id]=12345;session.ui={version:2,history:[],assistance:[],draft:'unfinished old spelling'};store.saveLearningSession(session);store.markLearned('w:latte|noun','word');store.addToList('bank','w:latte|noun');await store.saveNow();return{events:Object.values(store.learning.events),xp:store.current.stats.xp,id:session.id,skippedTarget:target.id};
  });await gotoRoute(page,route('w:casa|noun')+'?session='+old.id);const restored=await state();assert(restored.session.journey.wordShort);assert.equal(restored.session.id,old.id);assert(restored.session.index>=1);assert.equal(restored.session.journey.legacyWordCursor.skipped[old.skippedTarget],12345);assert.equal(restored.session.journey.legacyWordCursor.deferred[old.skippedTarget],12345);unchanged(old,restored);
  assert.equal(await page.evaluate(async()=>{const{store}=await import('./js/store.js');return store.isLearned('w:latte|noun')&&store.current.lists.bank.items.includes('w:latte|noun');}),true);
  await reloadApp(page);unchanged(old,await state());const done=await finish();assert(old.events.every(e=>done.events.some(a=>a.id===e.id&&a.mode===e.mode)));assert(done.events.filter(e=>e.wordPolicy==='word-short-v1').every(e=>e.mode==='recognition'));
 });
 await check('Back faithfully reconstructs answered short choices and matching boards as read-only history',async()=>{
  await fresh();await gotoRoute(page,route('w:casa|noun'));const first=await nextQuestion();assert.equal(first.type,'mc');const prompt=await page.locator('.journey-prompt').innerText();await solveJourneyQuestion(page,first,{expected});await page.locator('[data-continue]').click();const beforeHistory=await state();
  await page.locator('[data-lesson-back]').click();assert.equal(await page.locator('[data-journey]').getAttribute('data-history'),'true');assert.equal(await page.locator('.journey-prompt').innerText(),prompt);assert.deepEqual(await page.locator('.journey-choice-label').allTextContents(),first.choices.map(c=>c.label));
  assert.equal(await page.locator('.journey-choice:not([disabled])').count(),0);assert.equal(await page.locator('[data-check]').count(),0);unchanged(beforeHistory,await state());await shot('answered-choice-history');await page.locator('[data-lesson-current]').first().click();
  let board;for(let i=0;i<12;i++){board=await nextQuestion();if(board.type==='pairs')break;await solveJourneyQuestion(page,board,{expected});await page.locator('[data-continue]').click();}assert.equal(board.type,'pairs');await solveJourneyQuestion(page,board,{expected});await page.locator('[data-continue]').click();const beforeBoardHistory=await state();
  await page.locator('[data-lesson-back]').click();assert.equal(await page.locator('[data-journey]').getAttribute('data-history'),'true');assert.equal(await page.locator('[data-pair-left]').count(),board.pairs.length);assert.equal(await page.locator('[data-pair-right]').count(),board.rightTiles.length);
  assert.equal(await page.locator('[data-pair-left]:not([disabled]),[data-pair-right]:not([disabled])').count(),0);for(const pair of board.pairs){assert((await page.locator('[data-journey]').innerText()).includes(pair.label));assert((await page.locator('[data-journey]').innerText()).includes(pair.canonical));}unchanged(beforeBoardHistory,await state());await shot('answered-matching-history');
  await page.locator('[data-lesson-current]').first().click();assert.equal((await state()).step.questionId,beforeBoardHistory.step.questionId);unchanged(beforeBoardHistory,await state());
 });
 await check('All ten word types finish short recognition lessons without irrelevant grammar or sentence writing',async()=>{
  await fresh();const fixtures=await page.evaluate(async()=>{const{data}=await import('./js/data.js');return[...new Set(data.vocab.map(e=>e.pos))].map(pos=>{const e=data.vocab.find(e=>e.pos===pos&&e.level==='A1'&&e.ex&&e.exEn);return{id:e.id,pos,it:e.it};});});assert.equal(fixtures.length,10);
  const counts=[];for(const f of fixtures){await gotoRoute(page,route(f.id));const done=await finish();assert(done.progress.complete,f.it);assert(done.questions.length<=8,f.it+' stays short');honestRecognition(done);if(f.pos!=='noun')assert(!done.questions.some(q=>['article','plural'].includes(q.skill)));if(f.pos!=='adj')assert(!done.questions.some(q=>q.skill==='agreement'));counts.push({pos:f.pos,activities:done.questions.length});}return counts;
 });
 await check('Number usage and missing custom forms are taught honestly in the short flow',async()=>{
  await fresh();for(const[id,required,forbidden]of[['w:caffè|noun',/i caffè/,null],['w:calcio|noun',/calci.*kicks/s,'plural'],['w:latte|noun',/normally singular|uncountable/i,'plural'],['w:occhiali|noun',/normally plural/i,'plural']]){
   await gotoRoute(page,route(id));const done=await finish();assert.match(done.teaching.join(' '),required,id);if(forbidden)assert(!done.questions.some(q=>q.skill===forbidden),id+' has no invented plural drill');honestRecognition(done);
  }
  const id=await page.evaluate(async()=>{const{store}=await import('./js/store.js'),{registerCustom}=await import('./js/data.js');const id=store.addCustomWord({it:'quaderno di prova',en:'test notebook',pos:'noun',g:'m',level:'A1',cat:'school'});registerCustom(store.current.custom);return id;});await gotoRoute(page,route(id));const done=await finish();assert.match(done.teaching.join(' '),/Plural not yet recorded/);assert(!done.questions.some(q=>q.skill==='plural'));assert(done.progress.complete);honestRecognition(done);
 });
 for(const width of[375,390])for(const theme of['light','dark'])await check(`${width}px ${theme}: Words, Articoli, Play and Me share the updated readable layout`,async()=>{
  await fresh(width,theme);for(const[pathName,name]of[['/words','words'],['/grammar/articles','articoli'],['/games','play'],['/profile','me']]){
   await gotoRoute(page,pathName);const box=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,x:scrollX,english:document.querySelector('#enToggle')?.getBoundingClientRect().toJSON(),text:document.querySelector('#view')?.innerText}));assert(box.scroll<=box.width+1,name+' fits phone');assert.equal(box.x,0);assert(box.english.right<=box.width+1);assert(box.text.length>100);await shot(`${width}-${theme}-${name}`);
  }
  await gotoRoute(page,route('w:casa|noun'));await nextQuestion();assert.equal(await page.locator('[data-answer]').count(),0);await shot(`${width}-${theme}-short-word`);
 });
 await check('No application errors',async()=>assert.deepEqual(errors,[]));
}catch(error){if(!results.some(r=>!r.ok))results.push({name:'Harness startup',ok:false,error:error.stack});process.exitCode=1;}
finally{fs.writeFileSync(path.join(TESTS_DIR,process.env.SHORT_WORD_FILTER?'report-short-words-targeted.json':'report-short-words.json'),JSON.stringify({results,errors,screenshots},null,2));await browser.close();stopServer();}
console.log(`${results.filter(r=>r.ok).length}/${results.length} short word checks passed.`);
