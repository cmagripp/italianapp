import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium';
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions()),page=await context.newPage();
const checks=[],errors=[];let passed=false;
page.on('pageerror',error=>errors.push(error.message));
const check=async(label,work)=>{await work();checks.push(label);console.log('PASS',label);};
const snapshot=()=>page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current));
const active=title=>page.locator('.sheet-wrap.open').getByRole('dialog',{name:title,exact:true});
try{
 await page.goto(BASE+'#/profile');await page.locator('[data-settings]').waitFor();
 await check('History and storage status are read-only, including a late estimate after close',async()=>{
  const before=await snapshot();
  await page.locator('[data-learning-history]').click();await active('My practice').waitFor();
  await active('My practice').locator('[data-history-tab="answers"]').click();await active('My practice').locator('[data-history-search]').fill('absent');
  await page.keyboard.press('Escape');
  await page.evaluate(async()=>{
   Object.defineProperty(navigator.storage,'estimate',{configurable:true,value:()=>new Promise(resolve=>window.resolveAuditEstimate=resolve)});
   window.auditStatus=(await import('./js/views/offlineAI.js')).openOfflineAI();
  });await active('Offline conversations').waitFor();await page.keyboard.press('Escape');
  await page.evaluate(()=>resolveAuditEstimate({usage:512,quota:4096}));
  assert.equal(await active('Offline conversations').count(),0);assert.equal(await snapshot(),before);
 });
 await check('Status follows explicitly injected test-provider mode readiness and removal without generation or learning writes',async()=>{
  const before=await snapshot();
  await page.evaluate(async()=>{
   const runtime=await import('./js/conversations/runtime.js');window.auditRuntime=runtime;window.auditReady={written:true,recorded:false,handsfree:false};
   window.auditProvider={readiness:()=>auditReady,acquire:()=>{throw new Error('Status must never acquire generation');}};
   window.removeAuditProvider=runtime.installConversationProvider(auditProvider);window.auditStatus=(await import('./js/views/offlineAI.js')).openOfflineAI();
  });await active('Offline conversations').waitFor();assert.equal(await active('Offline conversations').getByText('Available',{exact:true}).count(),1);
  await page.evaluate(()=>{auditReady={written:true,recorded:true,handsfree:false};removeAuditProvider();removeAuditProvider=auditRuntime.installConversationProvider(auditProvider);});
  assert.equal(await active('Offline conversations').getByText('Available',{exact:true}).count(),2);
  await page.evaluate(()=>removeAuditProvider());assert.equal(await active('Offline conversations').getByText('Unavailable',{exact:true}).count(),3);
  await page.keyboard.press('Escape');assert.equal(await snapshot(),before);
 });
 await check('Both sheets close when the learning epoch changes; late storage work cannot reopen them',async()=>{
  await page.evaluate(async()=>{const history=await import('./js/views/learningHistory.js'),status=await import('./js/views/offlineAI.js');history.openLearningHistory();status.openOfflineAI();});
  await active('Offline conversations').waitFor();
  await page.evaluate(async()=>{await (await import('./js/store.js')).store.resetProgress();resolveAuditEstimate({usage:900,quota:4096});});
  assert.equal(await page.locator('.sheet-wrap.open').count(),0);
 });
 await check('History distinguishes supported answers, unscored answers and recognition from recall without promotion',async()=>{
  const result=await page.evaluate(async()=>{
   const {answerLabel,progressLabel}=await import('./js/views/learningHistory.js');return{
    assisted:answerLabel({ok:true,mode:'production',outcome:'correct',assistance:['hint']}),
    ungraded:answerLabel({ok:true,mode:'production',outcome:'ungraded'}),
    recognition:progressLabel({recognitionReady:true,recognitionRemembered:true,ready:false,remembered:false}),
    grammar:progressLabel({kind:'grammar',ready:true,remembered:false})};
  });assert.equal(result.assisted,'Correct · with support');assert.equal(result.ungraded,'Not scored');assert.equal(result.recognition,'Recognised again later');assert.equal(result.grammar,'Practised independently');
 });
 assert.deepEqual(errors,[]);passed=true;
}finally{
 fs.writeFileSync(new URL(`../docs/implementation/programme/ai-status-audit-${name}.json`,import.meta.url),JSON.stringify({browser:name,scope:'Independent read-only view/lifecycle audit; provider is explicitly test-only, no production model or inference',passed,checks,errors},null,2));
 await context.close();await browser.close();stop();
}
