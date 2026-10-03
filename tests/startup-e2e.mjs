// Startup response inventory plus isolated, retryable course stages and route compatibility.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,loadPlaywright,launchBrowser,contextOptions} from './lib.mjs';
let failStage=null,truncatedStage=null;
const types={'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html',file=path.resolve(ROOT,name);res.setHeader('Cache-Control','no-store');if(name===failStage){res.writeHead(503);res.end('Simulated missing stage');return;}if(name===truncatedStage){res.setHeader('Content-Type','application/json');res.end('{"version":2,"units":[');return;}if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
const {chromium,devices}=await loadPlaywright(),browser=await launchBrowser(chromium),rows=[];
try {
 for(const route of ['home','learn/verb/v%3Acredere','profile']){
  const context=await browser.newContext(contextOptions(devices['iPhone 13'],{reducedMotion:'reduce'})),page=await context.newPage(),inventory=new Map(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const u=r.url();if(!u.startsWith(base))return;const rel=u.slice(base.length).split(/[?#]/)[0],f=path.join(ROOT,rel);if(fs.existsSync(f)&&fs.statSync(f).isFile())inventory.set(rel,fs.statSync(f).size);});
  const t=performance.now();await page.goto(base+'index.html#/'+route,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#view')?.children.length&&!document.querySelector('#view .loading')&&document.querySelector('#view')?.textContent.trim().length>40);await page.waitForTimeout(200);
  const row={route,firstContentMs:+(performance.now()-t).toFixed(1),requests:inventory.size,sourceBytes:[...inventory.values()].reduce((a,b)=>a+b,0),courseStageRequests:[...inventory.keys()].filter(p=>/^data\/(?:course-v2|grammar-course)\/(?!audio)/.test(p)).length,fullLessonCode:inventory.has('js/learning/progressive-content.js'),modules:[...inventory.keys()].filter(p=>p.startsWith('js/')).sort()};rows.push(row);assert.deepEqual(errors,[]);if(!process.argv.includes('--baseline')){assert.equal(row.courseStageRequests,0);if(route==='home'||route==='profile')assert.equal(row.fullLessonCode,false);if(route.startsWith('learn/verb')){assert.ok(inventory.has('js/views/learnJourney.js'));assert.equal(inventory.has('js/views/learnVerb.js'),false);assert.equal(inventory.has('js/views/learnAdaptive.js'),false);}}console.log(JSON.stringify({...row,modules:undefined}));await context.close();
 }
 if(!process.argv.includes('--baseline')){
  const context=await browser.newContext(contextOptions(devices['iPhone 13'],{reducedMotion:'reduce'})),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'index.html#/home',{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-continue]');
  const selected=await page.evaluate(async()=>{const {grammarCourse}=await import('./js/learning/grammar-course.js');return {a1:grammarCourse.levels.find(p=>p.level==='A1').units[0].lessons[0].id,foundation:grammarCourse.levels[0].units[0].lessons[0].id};});
  failStage='data/course-v2/A1.json';await page.evaluate(id=>location.hash='#/learn/grammar/'+id,selected.a1);await page.waitForSelector('[data-course-retry]');assert.match(await page.locator('#view').innerText(),/saved work is kept/);
  await page.evaluate(id=>location.hash='#/learn/grammar/'+id,selected.foundation);await page.waitForSelector('[data-course-lesson]');assert.equal(await page.locator('[data-course-lesson]').getAttribute('data-course-lesson'),selected.foundation);
  failStage=null;truncatedStage='data/course-v2/A1.json';await page.evaluate(id=>location.hash='#/learn/grammar/'+id,selected.a1);await page.waitForSelector('[data-course-retry]');truncatedStage=null;await page.locator('[data-course-retry]').click();await page.waitForSelector('[data-course-lesson]');assert.equal(await page.locator('[data-course-lesson]').getAttribute('data-course-lesson'),selected.a1);
  const before=await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setCompletion('v:credere',{caseId:'present',checked:true});const l=store.learning.session;l.courseV2.draft='Una bozza precisa';store.saveLearningSession(l);await store.saveNow();return {entryId:l.entryId,draft:l.courseV2.draft,completions:store.learning.completions};});
  await page.evaluate(()=>location.hash='#/home');await page.waitForSelector('[data-continue]');const kept=await page.evaluate(async()=>{const {store}=await import('./js/store.js');return {entryId:store.learning.session.entryId,draft:store.learning.session.courseV2.draft,completions:store.learning.completions};});assert.deepEqual(kept,before);
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setSetting('adaptiveLearning',false);});await page.evaluate(()=>location.hash='#/learn/verb/v%3Acredere');await page.waitForSelector('body.walkthrough');
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setSetting('adaptiveLearning',true);});await page.evaluate(()=>location.hash='#/learn/verb/v%3Acredere?legacy=1');await page.waitForSelector('[data-adaptive]');
  assert.deepEqual(errors,[]);await context.close();console.log('PASS missing/truncated stage isolation and retry, Home draft/check preservation, classic/legacy direct routes');
 }
 const report=path.join(ROOT,process.env.STARTUP_REPORT || 'docs/implementation/programme/startup-performance.json');const before=fs.existsSync(report)?JSON.parse(fs.readFileSync(report)):{};
 if(process.argv.includes('--baseline')){fs.writeFileSync(report,JSON.stringify({measurement:'Cold local static-server Chromium with iPhone viewport, service workers blocked. Response source bytes exclude transfer compression and offline shell installation; this is not a physical-phone timing.',baseline:rows},null,2)+'\n');}
 else {fs.writeFileSync(report,JSON.stringify({...before,measuredAt:new Date().toISOString(),current:rows},null,2)+'\n');}
} finally {await browser.close();await new Promise(r=>server.close(r));}
