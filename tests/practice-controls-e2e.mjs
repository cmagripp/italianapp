#!/usr/bin/env node
// Practice controls: real phone interactions, manual feedback and honest flashcard history.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadPlaywright,launchBrowser,contextOptions,ensureServer,boot,gotoRoute,reloadApp,TESTS_DIR,SHOTS_DIR} from './lib.mjs';
import {journeyQuestion,solveJourneyQuestion,reachJourneyActivity} from './journey-driver.mjs';
const {chromium,devices}=await loadPlaywright(),stopServer=await ensureServer(),browser=await launchBrowser(chromium);
const results=[],errors=[],screenshots=[];let context,page;
fs.mkdirSync(SHOTS_DIR,{recursive:true});
const game=(id,ids=null,extra={})=>'/game/'+id+'?'+new URLSearchParams({src:ids?'ids:'+ids.join(','):'level:A1',count:'6',...extra});
const fixtureIds=['w:casa|noun','w:libro|noun','w:caffè|noun'];
// A layout test needs a playable crossword; a random six-item level sample
// can legitimately contain too few single words to build one.
const crosswordIds=[...fixtureIds,'w:cane|noun','w:gatto|noun','w:pane|noun'];
async function fresh(width=390,theme='light'){
 await context?.close();context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width,height:width===375?667:844},reducedMotion:'reduce'}));
 await context.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel:()=>{},speak:u=>{const a=JSON.parse(sessionStorage.getItem('practice-speech')||'[]');a.push({text:u.text,lang:u.lang});sessionStorage.setItem('practice-speech',JSON.stringify(a));}}}));
 page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/fonts\.g(oogleapis|static)\.com/.test(m.location()?.url||''))errors.push(m.text());});await boot(page);
 await page.evaluate(async theme=>{const{store}=await import('./js/store.js');store.setSetting('theme',theme);store.setSetting('tts',false);store.setLearningPreference('stage','future');},theme);
 await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
}
async function check(name,run){
 if(process.env.PRACTICE_SKIP_LAYOUT&&/^\d+px/.test(name))return;
 if(process.env.PRACTICE_ONLY&&name.startsWith('Lesson feedback'))return;
 if(process.env.PRACTICE_FILTER&&!name.toLowerCase().includes(process.env.PRACTICE_FILTER.toLowerCase())&&name!=='No application errors')return;
 const start=Date.now();try{const detail=await run();results.push({name,ok:true,ms:Date.now()-start,detail});console.log('PASS',name);}catch(error){await shot('failure').catch(()=>{});results.push({name,ok:false,error:error.stack,visible:await page?.locator('body').innerText().catch(()=> '')});console.error('FAIL',name,error.message);throw error;}
}
async function shot(name){const file=path.join(SHOTS_DIR,'practice-controls-'+name+'.png');await page.screenshot({path:file,fullPage:false,animations:'disabled'});screenshots.push(file);}
async function state(){return page.evaluate(async()=>{const{store}=await import('./js/store.js');await store.saveNow();return{xp:store.current.stats.xp,items:store.current.items,day:store.today(),events:store.learning.events,lists:store.lists};});}
function unchanged(a,b){assert.equal(a.xp,b.xp);assert.deepEqual(a.items,b.items);assert.deepEqual(a.day,b.day);assert.deepEqual(a.events,b.events);}
const flash=()=>page.locator('[data-flash]');
async function flashId(){return decodeURIComponent((await page.locator('[data-details]').getAttribute('href')).split('/entry/')[1]);}
async function progress(){return page.locator('.game-top [role=progressbar]').evaluate(e=>({now:Number(e.getAttribute('aria-valuenow')),max:Number(e.getAttribute('aria-valuemax')),done:e.querySelectorAll('.rail .done').length}));}
async function phoneLayout(label,{controlSelector='#view button, #view a.btn, [data-dock] button'}={}){
 const geometry=await page.evaluate(selector=>{
  const shown=e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!e.closest('[aria-hidden=true]');
  const nodes=[...document.querySelectorAll(selector)].filter(shown);
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,x:scrollX,english:document.querySelector('#enToggle')&&rect(document.querySelector('#enToggle')),inputs:[...document.querySelectorAll('input[data-answer]')].filter(shown).map(e=>parseFloat(getComputedStyle(e).fontSize)),controls:nodes.map(e=>({name:(e.getAttribute('aria-label')||e.textContent).trim().slice(0,80),...rect(e),disabled:e.disabled,smallCell:e.matches('.cw .c')}))};
 },controlSelector);
 assert(geometry.scroll<=geometry.width+1,label+' has no horizontal page overflow');assert.equal(geometry.x,0);if(geometry.english)assert(geometry.english.right<=geometry.width+1,label+' header fits');
 for(const c of geometry.controls){if(c.smallCell)continue;assert(c.height>=40,label+' tap height: '+JSON.stringify(c));assert(c.x>=-1&&c.right<=geometry.width+1,label+' control fits: '+JSON.stringify(c));}
 for(const font of geometry.inputs)assert(font>=16,label+' input avoids iOS focus zoom');return geometry;
}
async function visibleControl(selector){
 const control=(typeof selector==='string'?page.locator(selector):selector).first(),handle=await control.elementHandle();assert(handle,String(selector)+' exists');
 await page.waitForFunction(e=>{const r=e.getBoundingClientRect();if(r.width<=0||r.height<=0||r.y<0||r.bottom>innerHeight+1)return false;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit);},handle,{timeout:2000});
}
async function reachable(selector){const b=(typeof selector==='string'?page.locator(selector):selector).first();await b.scrollIntoViewIfNeeded();const r=await b.boundingBox();assert(r&&r.y>=0&&r.y+r.height<=await page.evaluate(()=>innerHeight)+1,selector+' reachable');assert(await b.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit);}),selector+' not obscured');}
async function mountDrill(kind){
 await gotoRoute(page,game(kind==='tense'?'tense-detective':'typing'));
 await page.evaluate(async kind=>{const{store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js'),Q=await import('./js/games/questions.js'),{runDrill}=await import('./js/games/engine.js'),{setChrome}=await import('./js/app.js');
 const questions=kind==='tense'?[Q.qTenseDetective(getEntry('v:parlare')),Q.qTenseDetective(getEntry('v:credere')),Q.qTenseDetective(getEntry('v:dormire'))]:[Q.qTypeIt(getEntry('w:casa|noun')),Q.qTypeIt(getEntry('w:libro|noun'))];
 if(questions.some(q=>!q))throw Error('Expected authored drill question unavailable');setChrome({tabs:false,back:true});window.__practiceQs=questions;window.__practiceRunner=runDrill(document.querySelector('.practice-host'),questions,{gameId:kind==='tense'?'tense-detective':'typing'});
 },kind);
}
try{
 await check('Flashcard Hear, Details and Star are on the card and never flip or grade it',async()=>{
  await fresh();await gotoRoute(page,game('flashcards',fixtureIds));await page.locator('[data-flip]').waitFor();const before=await state(),id=await flashId();
  for(const sel of['[data-hear]','[data-details]','[data-star]'])assert.equal(await flash().locator(sel).count(),1,sel+' is on-card');
  assert.equal(await page.locator('[data-grade]').isVisible(),false);await page.locator('[data-hear]').click();assert.equal(await flash().evaluate(e=>e.classList.contains('flipped')),false);unchanged(before,await state());
  const speech=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('practice-speech')||'[]'));assert.equal(speech.length,1);assert.equal(speech[0].lang,'it-IT');assert(speech[0].text.length>0);
  await page.locator('[data-star]').click();assert.equal(await page.locator('[data-star]').getAttribute('aria-pressed'),'true');assert.equal(await flash().evaluate(e=>e.classList.contains('flipped')),false);unchanged(before,await state());
  const list=Object.values((await state()).lists).find(l=>l.name.trim().toLowerCase()==='starred');assert(list?.items.includes(id));await page.locator('[data-details]').click();await page.waitForFunction(()=>location.hash.startsWith('#/entry/'));unchanged(before,await state());
  return{id,starredList:list.id};
 });
 await check('Starred reuses an existing list and survives reload, removal and re-add without changing reviews',async()=>{
  await fresh();const listId=await page.evaluate(async()=>{const{store}=await import('./js/store.js');const id=store.createList('sTaRrEd');await store.saveNow();return id;});
  await gotoRoute(page,game('flashcards',['w:casa|noun']));const before=await state();await page.locator('[data-star]').click();const starred=await state();assert.deepEqual(starred.lists[listId].items,['w:casa|noun']);assert.equal(Object.values(starred.lists).filter(l=>l.name.toLowerCase()==='starred').length,1);unchanged(before,starred);
  await reloadApp(page);assert.equal(await page.locator('[data-star]').getAttribute('aria-pressed'),'true');await page.locator('[data-star]').click();assert.deepEqual((await state()).lists[listId].items,[]);await page.locator('[data-star]').click();await reloadApp(page);assert.deepEqual((await state()).lists[listId].items,['w:casa|noun']);unchanged(before,await state());
  await gotoRoute(page,'/list/'+encodeURIComponent(listId));assert.match(await page.locator('#view').innerText(),/casa/);await shot('starred-list');
 });
 await check('Previous flashcards are read-only history and completed progress never moves backwards',async()=>{
  await fresh();await gotoRoute(page,game('flashcards',fixtureIds));const firstId=await flashId(),before=await state();assert.equal((await progress()).now,0);
  await page.locator('[data-flip]').click();await page.locator('[data-q="4"]').evaluate(b=>{window.__oldGrade=b;b.click();b.click();});const rated=await state();assert.equal(rated.xp,before.xp+2);assert.equal(rated.items[firstId].seen,1);assert.equal((await progress()).now,1);assert.equal((await progress()).done,1);const secondId=await flashId();assert.notEqual(secondId,firstId);
  await page.locator('[data-previous]').click();assert.equal(await page.locator('[data-flash-session]').getAttribute('data-flash-mode'),'history');assert.equal(await flashId(),firstId);assert.equal(await page.locator('[data-grade] button:not([disabled])').count(),0);assert.equal((await progress()).now,1);assert.equal((await progress()).done,1);unchanged(rated,await state());
  await page.evaluate(()=>window.__oldGrade.click());await page.locator('[data-flip]').click();await page.locator('[data-hear]').click();unchanged(rated,await state());await page.locator('[data-forward]').click();assert.equal(await flashId(),secondId);assert.equal(await page.locator('[data-flash-session]').getAttribute('data-flash-mode'),'current');
  await page.locator('[data-flip]').click();await page.locator('[data-q="1"]').click();const secondRated=await state();assert.equal(secondRated.xp,rated.xp);assert.equal(secondRated.items[secondId].ko,1);assert.equal((await progress()).now,2);
  await page.locator('[data-previous]').click();await page.locator('[data-previous]').click();assert.equal(await flashId(),firstId);assert.equal((await progress()).now,2);unchanged(secondRated,await state());await shot('flash-history');
 });
 await check('Finishing and replaying flashcards add no duplicate XP, and leaving releases practice layout',async()=>{
  await fresh();await gotoRoute(page,game('flashcards',fixtureIds));const before=await state(),ratedIds=[];
  for(const q of[4,1,5]){ratedIds.push(await flashId());await page.locator('[data-flip]').click();await page.locator(`[data-q="${q}"]`).evaluate(b=>{window.__lastRating=b;b.click();b.click();});}
  await page.locator('[data-replay]').waitFor();const done=await state();assert.equal(done.xp,before.xp+4);assert(ratedIds.every(id=>done.items[id].seen===1));await page.evaluate(()=>window.__lastRating.click());unchanged(done,await state());
  await page.locator('[data-replay]').click();await page.locator('[data-flip]').waitFor();assert.equal((await progress()).now,0);unchanged(done,await state());await gotoRoute(page,'/home');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('practice-viewport')),false);assert.equal(await page.evaluate(()=>document.body.style.getPropertyValue('--practice-height')),'');await page.evaluate(()=>window.__lastRating.click());unchanged(done,await state());
 });
 await check('Tense Detective correct and wrong feedback wait for Continue and reject duplicate callbacks',async()=>{
  await fresh();await mountDrill('tense');const before=await state();
  for(const ok of[true,false]){
   const i=await page.evaluate(()=>window.__practiceRunner.state.i),prompt=await page.locator('.q-card').innerText();
   const choice=await page.evaluate(({i,ok})=>window.__practiceQs[i].choices.findIndex(c=>!!c.correct===ok),{i,ok});assert(choice>=0);
   await page.locator(`[data-choice="${choice}"]`).evaluate(b=>{b.click();b.click();});assert.equal(await page.locator('[data-feedback-bar]').count(),1);assert.equal(await page.locator('[data-choice]:not([disabled])').count(),0);const answered=await state();assert.equal((await progress()).now,i+1);assert.equal((await progress()).done,i+1);await page.waitForTimeout(1100);
   assert.equal(await page.evaluate(()=>window.__practiceRunner.state.i),i,'ordinary practice never advances on a timer');assert.equal(await page.locator('.q-card').innerText(),prompt);unchanged(answered,await state());
   await visibleControl('[data-feedback-bar] [data-next]');await shot('tense-'+(ok?'correct':'wrong'));await page.locator('[data-feedback-bar] [data-next]').evaluate(b=>{b.click();b.click();});assert.equal(await page.evaluate(()=>window.__practiceRunner.state.i),i+1,'a stale Continue cannot skip a new question');unchanged(answered,await state());
  }
  const after=await state();assert.equal(after.xp,before.xp+2);assert.equal(after.day.correct-(before.day.correct||0),1);assert.equal(after.day.wrong-(before.day.wrong||0),1);await page.evaluate(()=>window.__practiceRunner.destroy());
 });
 await check('Typed ordinary practice retains feedback and a keyboard Continue is a single transition',async()=>{
  await fresh(390,'dark');await mountDrill('type');const checkHeight=(await page.locator('[data-check]').boundingBox()).height;assert(checkHeight>=56&&checkHeight<=72,'a lone typed Check keeps a compact button height');await shot('390-dark-typing-compact-check');assert.equal(await page.evaluate(()=>window.__practiceQs[0].answer[0]),'casa');await page.locator('[data-answer]').fill('casa');await page.locator('[data-check]').click();const answered=await state();await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>window.__practiceRunner.state.i),0);await visibleControl('[data-next]');await page.locator('[data-next]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__practiceRunner.state.i),1);unchanged(answered,await state());await page.evaluate(()=>window.__practiceRunner.destroy());
 });
 await check('A keyboard-sized practice viewport keeps typed input and feedback reachable',async()=>{
  await fresh();await gotoRoute(page,game('typing',fixtureIds));await page.setViewportSize({width:390,height:480});await page.locator('[data-answer]').fill('sbagliato');await reachable('[data-answer]');await reachable('[data-check]');await page.locator('[data-check]').click();await visibleControl('[data-next]');assert.equal(await page.evaluate(()=>scrollY),0);await phoneLayout('keyboard feedback');await shot('keyboard-feedback');await gotoRoute(page,'/home');assert.equal(await page.evaluate(()=>document.body.classList.contains('practice-viewport')),false);
 });
 await check('Matching waits after the board is complete; the timed speed round still advances automatically',async()=>{
  await fresh();await gotoRoute(page,game('matching',null,{count:'8'}));const ids=await page.locator('.m[data-side=a]').evaluateAll(nodes=>nodes.map(e=>e.dataset.id));assert(ids.length>=4);
  for(const id of ids){await page.locator(`.m[data-side=a][data-id=${JSON.stringify(id)}]`).click();await page.locator(`.m[data-side=b][data-id=${JSON.stringify(id)}]`).click();}
  await page.locator('.match-session[data-state=feedback]').waitFor();const answered=await state(),count=await progress();assert.equal(count.now,ids.length);await page.waitForTimeout(1100);assert.equal(await page.locator('.match-session[data-state=feedback]').count(),1);unchanged(answered,await state());await visibleControl('[data-next]');await shot('matching-complete');
  await page.locator('[data-next]').evaluate(b=>{b.click();b.click();});assert.equal(await page.locator('.m[data-side=a]:not(.done)').count(),8-ids.length);unchanged(answered,await state());
  await gotoRoute(page,game('speed',null,{seconds:'30'}));const old=await page.locator('[data-c]').first().elementHandle();await old.click();await page.waitForFunction(e=>!e.isConnected,old,{timeout:2500});assert.equal(await page.locator('[data-next]').count(),0,'speed remains intentionally timed');
 });
 await check('Sentence and Hangman feedback keep Continue visible and advance exactly once',async()=>{
  await fresh(375);await gotoRoute(page,game('sentence',fixtureIds));const tokenCount=await page.locator('[data-add]').count();assert(tokenCount>=3);
  for(let i=0;i<tokenCount;i++)await page.locator(`[data-add="${i}"]`).click();await page.locator('[data-check]').click();await visibleControl('[data-next]');const sentence=await state();assert.equal((await progress()).now,1);await page.waitForTimeout(800);assert.equal((await progress()).now,1);await shot('sentence-feedback');await page.locator('[data-next]').evaluate(b=>{b.click();b.click();});assert.equal((await progress()).now,1);unchanged(sentence,await state());
  await gotoRoute(page,game('hangman',['w:casa|noun','w:libro|noun','w:mano|noun']));const answer=await page.evaluate(async()=>{const{getEntry,shortEn}=await import('./js/data.js'),meaning=document.querySelector('.hang-card .big').textContent;return['w:casa|noun','w:libro|noun','w:mano|noun'].map(getEntry).find(e=>shortEn(e.en)===meaning)?.it;});assert(['casa','libro','mano'].includes(answer));
  for(const letter of new Set(answer))await page.keyboard.press(letter);await visibleControl('[data-dock] [data-next]');const hang=await state();assert.equal((await progress()).now,1);await page.waitForTimeout(800);await shot('hangman-feedback');await page.locator('[data-dock] [data-next]').focus();await page.keyboard.press('Enter');assert.equal((await progress()).now,1);assert.equal(await page.locator('[data-dock] [data-next]').count(),0);unchanged(hang,await state());
 });
 await check('Lesson feedback uses the practice pop-in and still preserves its saved answer until Continue',async()=>{
  await fresh(375,'dark');await gotoRoute(page,'/learn/verb/v:capire?chapter=present');await reachJourneyActivity(page,'mc');const q=await journeyQuestion(page);const form=['capisco','capisci','capisce','capiamo','capite','capiscono'][q.meta.person];assert(q.answer.includes(form));await solveJourneyQuestion(page,q,{expected:()=>form});assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'),'feedback');assert.equal(await page.locator('[data-feedback-bar]').count(),1);assert.equal(await page.locator('[data-feedback-bar] [data-continue]').count(),1);const answered=await state();await visibleControl('[data-feedback-bar] [data-continue]');await shot('lesson-feedback');await page.waitForTimeout(1000);await reloadApp(page);assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'),'feedback');unchanged(answered,await state());await page.locator('[data-continue]').click();assert.notEqual(await page.locator('[data-journey]').getAttribute('data-phase'),'feedback');unchanged(answered,await state());
  await gotoRoute(page,'/learn/verb/v:parlare?chapter=present');await reachJourneyActivity(page,'mc');const other=await journeyQuestion(page),wrong=other.choices.findIndex(c=>!other.answer.includes(c.value||c.label));await page.locator(`[data-choice="${wrong}"]`).click();assert.equal(await page.locator('[data-feedback-bar]').getAttribute('data-feedback-state'),'incorrect');await visibleControl('[data-feedback-bar] [data-continue]');await shot('lesson-wrong-feedback');const missed=await state();await page.waitForTimeout(1000);assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'),'feedback');unchanged(missed,await state());
 });
 for(const width of[375,390])for(const theme of['light','dark'])await check(`${width}px ${theme}: ratings and all game types fit and keep controls reachable`,async()=>{
  await fresh(width,theme);await gotoRoute(page,game('flashcards',fixtureIds));await page.locator('[data-flip]').click();const layout=await phoneLayout('flashcards');
  const ratings=await page.locator('[data-grade] button').evaluateAll(nodes=>nodes.map(e=>e.getBoundingClientRect().toJSON()));assert.equal(ratings.length,4);const card=await flash().boundingBox();
  for(let i=0;i<ratings.length;i++){assert(Math.abs(ratings[i].x-card.x)<=2,'ratings align to card');assert(Math.abs(ratings[i].width-card.width)<=2,'each rating spans card width');if(i)assert(ratings[i].y-ratings[i-1].bottom>=6,'stacked ratings have separation');await reachable(`[data-q="${[1,3,4,5][i]}"]`);}await page.evaluate(()=>scrollTo(0,0));await shot(`${width}-${theme}-flashcards`);
  const visits=[];for(const id of['quiz','typing','matching','sentence','speed','hangman','crossword','tense-detective']){
   await gotoRoute(page,game(id,id==='crossword'?crosswordIds:null,id==='speed'?{seconds:'30'}:{}));await page.waitForTimeout(150);assert.doesNotMatch(await page.locator('#view').innerText(),/too few|no questions|unknown game/i);const g=await phoneLayout(id);visits.push({id,controls:g.controls.length});assert(g.controls.length>1,id+' renders controls');
   const primary={quiz:'[data-choice], [data-check]',typing:'[data-check]',matching:'.m',sentence:'[data-add]',speed:'[data-c]',hangman:'[data-dock] .k',crossword:'[data-dock] .k','tense-detective':'[data-choice]'}[id];await reachable(primary);const lastControl=page.locator('#view button:not([disabled]), #view a.btn').last();if(id==='crossword')await page.locator('.practice-host').evaluate(e=>e.scrollTop=e.scrollHeight);if(await lastControl.isVisible())await reachable(lastControl);await page.evaluate(()=>{scrollTo(0,0);document.querySelector('.practice-host')?.scrollTo(0,0);document.querySelector('.drill-main')?.scrollTo(0,0);});await shot(`${width}-${theme}-${id}`);
  }return{ratings:ratings.map(r=>({width:r.width,height:r.height})),visits};
 });
 await check('No application errors',async()=>assert.deepEqual(errors,[]));
}catch(error){if(!results.some(r=>!r.ok))results.push({name:'Harness startup',ok:false,error:error.stack});process.exitCode=1;}
finally{fs.writeFileSync(path.join(TESTS_DIR,process.env.PRACTICE_FILTER?'report-practice-controls-targeted.json':process.env.PRACTICE_SKIP_LAYOUT?'report-practice-controls-functional.json':'report-practice-controls.json'),JSON.stringify({results,errors,screenshots},null,2));await browser.close();stopServer();}
console.log(`${results.filter(r=>r.ok).length}/${results.length} practice control checks passed.`);
