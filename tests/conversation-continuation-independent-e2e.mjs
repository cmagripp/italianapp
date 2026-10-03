import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium',beforeMode=process.argv.includes('--before');
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),results=[],errors=[];let context,page;
async function fresh(){await context?.close();context=await browser.newContext(contextOptions(undefined,{reducedMotion:'reduce'}));page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(BASE+'#/profile',{waitUntil:'domcontentloaded'});await page.locator('[data-settings]').waitFor();}
try{
 for(const route of ['home','learn']){
  await fresh();const before=await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current));
  await page.evaluate(route=>{Object.defineProperty(IDBFactory.prototype,'databases',{configurable:true,value:()=>new Promise(resolve=>window.releaseContinuationInventory=resolve)});location.hash='#/'+route;},route);
  await page.waitForFunction(()=>typeof releaseContinuationInventory==='function');await page.evaluate(()=>location.hash='#/profile');await page.locator('[data-settings]').waitFor();
  await page.evaluate(()=>releaseContinuationInventory([]));await page.waitForTimeout(500);
  const actual=await page.evaluate(async()=>({route:location.hash,profile:!!document.querySelector('[data-settings]'),home:!!document.querySelector('.home-hero'),learn:!!document.querySelector('.course-summary'),profileJSON:JSON.stringify((await import('./js/store.js')).store.current)}));
  const result={case:`Late ${route} inventory after navigation`,passed:actual.route==='#/profile'&&actual.profile&&actual.profileJSON===before,actual:{...actual,profileJSON:undefined},profileUnchanged:actual.profileJSON===before};results.push(result);console.log(result.passed?'PASS':'REPRODUCED',result.case,JSON.stringify(result.actual));
 }
 for(const route of ['home','learn'])for(const change of ['epoch','profile','learner']){
  await fresh();await page.evaluate(route=>{window.auditRoute=route;window.auditInventoryResolvers=[];Object.defineProperty(IDBFactory.prototype,'databases',{configurable:true,value:()=>new Promise(resolve=>{auditInventoryResolvers.push(resolve);window.releaseContinuationInventory=auditInventoryResolvers[0];})});location.hash='#/'+route;},route);
  await page.waitForFunction(()=>typeof releaseContinuationInventory==='function');await page.evaluate(async change=>{const {store}=await import('./js/store.js');if(change==='epoch')await store.resetProgress();else if(change==='profile')await store.createProfile('Different learner');else{const profile=structuredClone(store.current);profile.learnerId=crypto.randomUUID();await store.importJSON(JSON.stringify({profile}));}await store.saveNow();},change);
  const before=await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current));await page.evaluate(()=>releaseContinuationInventory([]));await page.waitForTimeout(500);
  const actual=await page.evaluate(async()=>({route:location.hash,profileJSON:JSON.stringify((await import('./js/store.js')).store.current),allText:document.querySelector('#view').innerText}));
  const result={case:`Late ${route} inventory after ${change} change`,passed:actual.profileJSON===before,profileUnchanged:actual.profileJSON===before,route:actual.route};results.push(result);console.log(result.passed?'PASS':'REPRODUCED',result.case);
 }
 for(const route of ['home','learn']){
  await fresh();await page.evaluate(route=>{window.auditInventoryResolvers=[];Object.defineProperty(IDBFactory.prototype,'databases',{configurable:true,value:()=>new Promise(resolve=>auditInventoryResolvers.push(resolve))});location.hash='#/'+route;},route);
  await page.waitForFunction(()=>auditInventoryResolvers.length===1);await page.evaluate(()=>location.hash='#/profile');await page.locator('[data-settings]').waitFor();await page.evaluate(route=>location.hash='#/'+route,route);await page.waitForFunction(()=>auditInventoryResolvers.length===2);
  const before=await page.evaluate(async()=>{document.querySelector('#view').innerHTML='<p data-new-render-waiting>Waiting for the current view</p>';return JSON.stringify((await import('./js/store.js')).store.current);});
  await page.evaluate(()=>auditInventoryResolvers[0]([]));await page.waitForTimeout(500);
  const actual=await page.evaluate(async()=>({currentWait:!!document.querySelector('[data-new-render-waiting]'),profileJSON:JSON.stringify((await import('./js/store.js')).store.current)})),result={case:`Old ${route} inventory after leaving and returning to the same route`,passed:actual.currentWait&&actual.profileJSON===before,profileUnchanged:actual.profileJSON===before,currentWait:actual.currentWait};results.push(result);console.log(result.passed?'PASS':'REPRODUCED',result.case);
 }
 assert.deepEqual(errors,[]);if(!beforeMode)assert(results.every(result=>result.passed));
}finally{
 fs.writeFileSync(new URL(`../docs/implementation/programme/ai-continuation-audit-${beforeMode?'':'after-'}${name}.json`,import.meta.url),JSON.stringify({browser:name,scope:'Independent delayed native IndexedDB inventory probe. Only the first, stale request is released after an owner change; any new owner render remains pending. Normal Home today initialization can change fresh day counters, so the historical initial epoch probe that released the newest request was not evidence of bridge writes. No model fixture.',passed:results.every(result=>result.passed),results,errors},null,2));
 await context?.close();await browser.close();stop();
}
