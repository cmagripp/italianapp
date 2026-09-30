#!/usr/bin/env node
// Review and legacy Learn drills share a bounded answer/feedback layout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadPlaywright,launchBrowser,contextOptions,ensureServer,boot,gotoRoute,SHOTS_DIR,TESTS_DIR} from './lib.mjs';
const {chromium,devices}=await loadPlaywright(),stopServer=await ensureServer(),browser=await launchBrowser(chromium);
fs.mkdirSync(SHOTS_DIR,{recursive:true});
let checks=0,failure=null;const errors=[],screenshots=[];
async function visibleContinue(page,scope=''){
 const selector=`${scope} [data-feedback-bar] [data-next]`.trim();
 await page.locator(selector).waitFor();
 const geometry=await page.locator(selector).evaluate(button=>{
  const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {top:r.top,bottom:r.bottom,height:r.height,viewport:visualViewport?.height||innerHeight,hit:hit===button||button.contains(hit),scrollY,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
 });
 assert(geometry.top>=0&&geometry.bottom<=geometry.viewport+1,JSON.stringify(geometry));assert(geometry.hit,JSON.stringify(geometry));assert(geometry.height>=44);assert.equal(geometry.scrollY,0);assert(geometry.scrollWidth<=geometry.width+1);
}
try{
 {
  const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width:390,height:844},reducedMotion:'reduce'}));
  await context.addInitScript(()=>{
   const viewport=new EventTarget();Object.assign(viewport,{height:innerHeight,offsetTop:0,scale:1});
   Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});window.__viewport=viewport;
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await boot(page);
  await page.evaluate(async()=>{
   const{store}=await import('./js/store.js');store.setSetting('tts',false);store.setSetting('adaptiveLearning',false);
   for(const id of['w:casa|noun','w:libro|noun','w:caffè|noun']){store.markLearned(id,'word');Object.assign(store.current.items[id],{s:4,due:Date.now()-1000});}
   Math.random=()=>.1;
  });
  for(const route of ['/game/typing?src=level:A1','/review?typed=1']) {
   await page.evaluate(()=>Object.assign(window.__viewport,{height:innerHeight-80,offsetTop:0,scale:1}));
   await gotoRoute(page,route);await page.locator('[data-answer]').waitFor();
   const measure=()=>page.evaluate(()=>({height:document.body.getBoundingClientRect().height,screen:innerHeight,override:document.body.style.getPropertyValue('--practice-height')}));
   let geometry=await measure();assert.equal(geometry.override,'','normal standalone shortfall must not shrink the shell');assert(Math.abs(geometry.height-geometry.screen)<1);
   await page.locator('[data-answer]').focus();
   await page.evaluate(()=>{Object.assign(window.__viewport,{height:innerHeight-300,offsetTop:40});window.__viewport.dispatchEvent(new Event('resize'));});
   geometry=await measure();assert.equal(geometry.override,`${geometry.screen-260}px`,'keyboard height includes the visual offset');assert(Math.abs(geometry.height-geometry.screen)<1,'background shell keeps its full CSS height');
   await page.evaluate(()=>{window.__viewport.offsetTop=60;window.__viewport.dispatchEvent(new Event('scroll'));});
   geometry=await measure();assert.equal(geometry.override,`${geometry.screen-240}px`,'viewport panning updates the usable area');
   await page.locator('[data-answer]').blur();assert.equal((await measure()).override,'','blur clears even a stale keyboard metric');
   await page.locator('[data-answer]').focus();assert.notEqual((await measure()).override,'','refocus updates without waiting for another resize');
   await page.evaluate(()=>{window.__viewport.height=innerHeight-80;window.__viewport.offsetTop=0;window.dispatchEvent(new Event('pageshow'));});
   assert.equal((await measure()).override,'','resume returns to CSS baseline');
   await page.evaluate(()=>{Object.assign(window.__viewport,{height:innerHeight-300,scale:1.5});window.__viewport.dispatchEvent(new Event('resize'));});
   assert.equal((await measure()).override,'','pinch zoom is not a keyboard');
   await page.evaluate(()=>{window.__viewport.scale=1;document.activeElement.readOnly=true;window.__viewport.dispatchEvent(new Event('resize'));});
   assert.equal((await measure()).override,'','read-only input does not trigger keyboard sizing');
   await gotoRoute(page,'/home');
   await page.evaluate(()=>{window.__viewport.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('pageshow'));});
   assert.equal((await measure()).override,'','disposed route cannot restore a height override');
   checks++;
  }
  await context.close();
 }
 for (const changed of ['route','profile']) {
  const context=await browser.newContext(contextOptions(devices['iPhone 13'],{reducedMotion:'reduce'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await boot(page);
  let release;
  const requested=new Promise(resolve=>{release=resolve;});
  let held;
  await page.route('**/js/games/hangman.js',route=>{held=route;release();});
  await page.evaluate(()=>location.hash='#/game/hangman?src=level:A1');
  await Promise.race([requested,new Promise((_,reject)=>setTimeout(()=>reject(Error('Hangman import was not requested')),10000))]);
  let before;
  if(changed==='route') {
   await gotoRoute(page,'/game/crossword?src=level:A1');await page.locator('[data-dock]').waitFor();
   before=await page.evaluate(()=>({className:document.body.className,height:document.documentElement.style.getPropertyValue('--game-dock'),dock:document.querySelector('[data-dock]').outerHTML}));
  } else {
   await page.evaluate(async()=>{const{store}=await import('./js/store.js');await store.createProfile('Another learner');});
  }
  await held.continue();await page.evaluate(()=>import('./js/games/hangman.js'));await page.waitForTimeout(50);
  if(changed==='route') {
   assert.deepEqual(await page.evaluate(()=>({className:document.body.className,height:document.documentElement.style.getPropertyValue('--game-dock'),dock:document.querySelector('[data-dock]').outerHTML})),before,'stale Hangman cannot clear the current Crossword dock');
   assert.equal(await page.locator('[data-dock]').count(),1);
  } else {
   assert.equal(await page.locator('[data-dock]').count(),0,'a delayed game cannot mount for a different profile');
   assert.equal(await page.locator('.practice-host').innerHTML(),'');
  }
  checks++;await context.close();
 }
 for(const [width,height,theme] of [[375,667,'light'],[390,844,'dark']]){
  const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width,height},reducedMotion:'reduce'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await boot(page);
  await page.evaluate(async theme=>{const{store}=await import('./js/store.js');store.setSetting('adaptiveLearning',false);store.setSetting('theme',theme);store.setSetting('tts',false);for(const id of['w:casa|noun','w:libro|noun']){store.markLearned(id,'word');Object.assign(store.current.items[id],{s:0,due:Date.now()-1000});}await store.saveNow();},theme);
  await gotoRoute(page,'/review');await page.locator('[data-drill]').waitFor();
  assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('practice-viewport')),true);
  assert.equal(await page.locator('[data-runner]').evaluate(e=>e.classList.contains('practice-host')),true);
  await page.locator('[data-choice]').first().click();await visibleContinue(page);
  const count=await page.locator('.rail-count').textContent();await page.waitForTimeout(500);assert.equal(await page.locator('.rail-count').textContent(),count);
  const reviewShot=path.join(SHOTS_DIR,`review-layout-${width}-${theme}.png`);
  await page.screenshot({path:reviewShot,animations:'disabled'});screenshots.push(reviewShot);checks++;
  await gotoRoute(page,'/home');assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('practice-viewport')),false);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('no-tabs')),false);
  await page.evaluate(async()=>{const{store}=await import('./js/store.js');for(const id of['w:casa|noun','w:libro|noun'])Object.assign(store.current.items[id],{s:4,due:Date.now()-1000});window.__realRandom=Math.random;Math.random=()=>.1;});
  await gotoRoute(page,'/review?typed=1');await page.locator('[data-answer]').waitFor();await page.evaluate(()=>{Math.random=window.__realRandom;delete window.__realRandom;});
  await page.setViewportSize({width,height:430});await page.locator('[data-answer]').fill('incorrect');await page.locator('[data-check]').click();await visibleContinue(page);checks++;
  await page.setViewportSize({width,height});await gotoRoute(page,'/learn/word/w%3Acasa%7Cnoun');
  await page.locator('.wt-scene[data-key="quick"]').waitFor({state:'attached'});
  // Activate the real saved legacy scene directly; only the reaching step is
  // shortened, while its production host, question and feedback render normally.
  await page.evaluate(()=>{for(const scene of document.querySelectorAll('.wt-scene'))scene.hidden=false;const scene=document.querySelector('.wt-scene[data-key="quick"]');document.querySelector('.wt-scenes').scrollTop=scene.offsetTop;});
  const scope='.wt-scene[data-key="quick"]';await page.locator(`${scope} [data-choice]`).first().waitFor();
  await page.locator(`${scope} [data-choice]`).first().click();await visibleContinue(page,scope);
  const legacyShot=path.join(SHOTS_DIR,`legacy-drill-layout-${width}-${theme}.png`);
  await page.screenshot({path:legacyShot,animations:'disabled'});screenshots.push(legacyShot);checks++;
  await gotoRoute(page,'/home');assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('walkthrough')),false);
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log(`${checks} Review/legacy layout checks passed; no application errors.`);
}catch(error){failure=error.stack||String(error);throw error;}
finally{
 fs.writeFileSync(path.join(TESTS_DIR,'report-review-layout.json'),JSON.stringify({passed:checks,errors,failure,screenshots},null,2));
 await browser.close();await stopServer();
}
