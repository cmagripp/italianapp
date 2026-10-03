import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT,loadPlaywright,launchBrowser,contextOptions} from './lib.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),actual=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const fixture=Buffer.from('<!doctype html><title>Retained scorer compatibility</title><p>Controlled old client</p>');
const oldModule='js/learning/fit-scorer.js',workerModule='js/workers/fit-scorer.worker.js';
const retired=name=>[oldModule,workerModule].includes(name)||name.startsWith('models/fit-scorer/')||name.startsWith('vendor/ort/');
const body=name=>name==='fixture.html'?fixture:fs.readFileSync(path.join(ROOT,name));
const sw=(version,old)=>{const files=['./fixture.html',...(old?['./'+oldModule]:[])],hashes=Object.fromEntries(files.map(file=>[file,hash(body(file.slice(2)))]));return actual.replace(/const VERSION = '[^']+';/,`const VERSION = '${version}';`).replace(/const SHELL = \[[\s\S]*?\];/,`const SHELL = ${JSON.stringify(files)};`).replace(/const ASSET_HASHES = \{[^\n]+\};/,`const ASSET_HASHES = ${JSON.stringify(hashes)};`);};
let current=sw('parola-fit-before',true),removed=false,offline=false,partial=false;const requests=[];
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://fixture').pathname.slice(1);requests.push(name);res.setHeader('Cache-Control','no-store');
 if(offline){res.destroy();return;}
 if(name==='sw.js'){res.setHeader('Content-Type','text/javascript');res.end(current);return;}
 if(removed&&retired(name)){res.statusCode=404;res.end('This optional experiment has been retired.');return;}
 if(partial&&name==='models/fit-scorer/model.onnx'){res.setHeader('Content-Type','application/octet-stream');res.end(Buffer.alloc(1024));return;}
 try{const data=body(name);res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.wasm')?'application/wasm':/\.(m?js)$/.test(name)?'text/javascript':'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/`;
const {chromium,webkit}=await loadPlaywright(),engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium',browser=engine==='webkit'?await webkit.launch():await launchBrowser(chromium),checks=[],errors=[];
const context=await browser.newContext(contextOptions(undefined,{serviceWorkers:'allow'})),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
const check=async(name,run)=>{await run();checks.push(name);console.log('PASS',name);};
const saved={draft:'  Sono stanca e vorrei un caffè.  ',result:{outcome:'accepted',sentence:'Sono stanca.',assistance:['legacy-construction'],given:'tired'},history:[{id:'existing-step',answer:'sono stanca'}],xp:17};
let initialStatus;
try{
 await page.goto(base+'fixture.html');await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 await check('The actual previous module installs its pinned local model/runtime and worker before retirement',async()=>{
  initialStatus=await page.evaluate(async saved=>{window.fit=await import('./js/learning/fit-scorer.js');localStorage.setItem('retained-workshop-fixture',JSON.stringify(saved));return fit.installFitScorer();},saved);assert.equal(initialStatus.installed,true);assert(initialStatus.bytes>83000000);
 });
 await check('An actual worker update retires publication and keeps the verified old download and saved learner record',async()=>{
  current=sw('parola-fit-after',false);removed=true;
  assert.equal(await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();const changed=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Update timed out')),20000);reg.addEventListener('updatefound',()=>{const w=reg.installing;w.addEventListener('statechange',()=>{if(['activated','redundant'].includes(w.state)){clearTimeout(timer);resolve(w.state);}});},{once:true});});await reg.update();return changed;}),'activated');
  assert.deepEqual(await page.evaluate(()=>fit.fitScorerStatus()),initialStatus);const keys=await page.evaluate(()=>caches.keys());assert(keys.includes('parola-fit-scorer-v1'));assert(!keys.includes('parola-fit-before'));
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('retained-workshop-fixture'))),saved);
 });
 await check('The retained module cold-starts the actual cached worker while the retired worker URL returns404',async()=>{
  const result=await page.evaluate(async()=>{const response=await fetch('./js/workers/fit-scorer.worker.js');const workerText=await response.text();const warm=await fit.warmFitScorer({timeoutMs:45000});fit.releaseFitScorer();return {ok:response.ok,workerText,warm};});
  assert(result.ok);assert.equal(hash(result.workerText),hash(body(workerModule)));assert.equal(result.warm.ready,true);
 });
 await check('A fresh worker also starts with origin unavailable and leaves the saved record exact',async()=>{
  offline=true;try{assert.equal((await page.evaluate(()=>fit.warmFitScorer({timeoutMs:45000}))).ready,true);await page.evaluate(()=>fit.releaseFitScorer());}finally{offline=false;}
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('retained-workshop-fixture'))),saved);
 });
 await check('A partial optional install is never complete; removed publication reports failure without rewriting learner work',async()=>{
  await page.evaluate(()=>fit.removeFitScorer());removed=false;partial=true;
  const truncated=await page.evaluate(async()=>{try{await fit.installFitScorer();return null;}catch(error){return error.message;}});assert.match(truncated,/1024 bytes instead/);assert.equal((await page.evaluate(()=>fit.fitScorerStatus())).installed,false);
  removed=true;partial=false;const unavailable=await page.evaluate(async()=>{try{await fit.installFitScorer();return null;}catch(error){return error.message;}});assert.match(unavailable,/HTTP 404/);assert.equal((await page.evaluate(()=>fit.fitScorerStatus())).installed,false);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('retained-workshop-fixture'))),saved);
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(ROOT,`docs/implementation/programme/fit-retirement-${engine}.json`),JSON.stringify({engine,checks,errors,swSHA256:hash(actual),oldModuleSHA256:hash(body(oldModule)),oldWorkerSHA256:hash(body(workerModule)),installedBytes:initialStatus.bytes,scope:'Actual locally supplied prior module, pinned model/runtime, Cache API, worker startup and SW update with a minimal controlled shell. Saved record is a synthetic storage fixture; actual Workshop route coverage is separately required. Worker startup establishes compatibility only, not useful linguistic scoring or production AI readiness.'},null,2)+'\n');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
