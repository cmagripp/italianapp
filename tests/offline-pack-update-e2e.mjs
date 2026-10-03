import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT,loadPlaywright,launchBrowser,contextOptions} from './lib.mjs';
const actual=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixture=Buffer.from('<!doctype html><title>Offline pack update fixture</title><main>Controlled storage fixture</main>');
const files=['./fixture.html','./js/ai/packs.js','./js/ai/queue.js','./js/ai/sha256.js'];
const body=name=>name==='fixture.html'?fixture:fs.readFileSync(path.join(ROOT,name));
const hashes=Object.fromEntries(files.map(file=>[file,hash(body(file.slice(2)))]));
const asset=Buffer.from('Verified synthetic offline pack asset; no model or speech inference.'),digest=hash(asset),revision='a'.repeat(40);
const pack={schema:1,id:'fixture',revision,runtime:{name:'test-only',version:'1'},notices:['Synthetic fixture; no inference/quality claim.'],assets:[{kind:'weights',url:`/fixture-pack/${digest}.bin`,sha256:digest,bytes:asset.length}]};
const worker=version=>actual.replace(/const VERSION = '[^']+';/,`const VERSION = '${version}';`).replace(/const SHELL = \[[\s\S]*?\];/,`const SHELL = ${JSON.stringify(files)};`).replace(/const ASSET_HASHES = \{[^\n]+\};/,`const ASSET_HASHES = ${JSON.stringify(hashes)};`);
let current=worker('parola-fixture-before'),bad=false,networkUnavailable=false;
const requests=[];
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://fixture').pathname.slice(1);requests.push(name);if(networkUnavailable){res.destroy();return;}res.setHeader('Cache-Control','no-store');
 if(name==='sw.js'){res.setHeader('Content-Type','text/javascript');res.end(current);return;}
 if(name.startsWith('fixture-pack/')){res.end(bad?Buffer.from('corrupt replacement'):asset);return;}
 try{res.setHeader('Content-Type',name.endsWith('.html')?'text/html':'text/javascript');res.end(body(name));}catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/`;
const {chromium,webkit}=await loadPlaywright(),engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium',browser=engine==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(undefined,{serviceWorkers:'allow'})),page=await context.newPage(),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=async(name,run)=>{await run();checks.push(name);console.log('PASS',name);};
const active=()=>page.evaluate(async()=>{const {createPackManager}=await import('./js/ai/packs.js');return createPackManager().active('fixture',{verify:true});});
async function update(){return page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration(),result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Update timed out')),20000);reg.addEventListener('updatefound',()=>{const w=reg.installing;w.addEventListener('statechange',()=>{if(['activated','redundant'].includes(w.state)){clearTimeout(timer);resolve(w.state);}});},{once:true});});await reg.update();return result;});}
try{
 await page.goto(base+'fixture.html');await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 await check('Verified installed pack state/assets and learner recovery are preserved across an actual worker activation',async()=>{
  const installed=await page.evaluate(async pack=>{const {createPackManager}=await import('./js/ai/packs.js');const installed=await createPackManager().install(pack);localStorage.setItem('fixture-learner',JSON.stringify({draft:'Vorrei un caffè.',xp:17,events:['existing-event']}));for(const name of ['parola-fit-scorer-v1','webllm/model','parola-ai-pack-v10:unrelated','other-stale-shell'])await(await caches.open(name)).put('/preserved-marker',new Response(name));return installed;},pack);
  assert.equal(installed.readiness.assetsVerified,true);assert.equal(installed.readiness.italianTeachingQuality,false);assert.equal(installed.readiness.writtenGeneration,false);
  const before=await active();current=worker('parola-fixture-after');assert.equal(await update(),'activated');assert.deepEqual(await active(),before);
  const keys=await page.evaluate(()=>caches.keys());assert(keys.includes('parola-ai-pack-v1:state'));assert(keys.includes(`parola-ai-pack-v1:fixture:${revision}`));assert(keys.includes('parola-fit-scorer-v1'));assert(keys.includes('webllm/model'));assert(!keys.includes('parola-ai-pack-v10:unrelated'));assert(!keys.includes('other-stale-shell'));assert(!keys.includes('parola-fixture-before'));
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('fixture-learner'))),{draft:'Vorrei un caffè.',xp:17,events:['existing-event']});
 });
 await check('An offline document reload with fresh globals verifies the exact installed asset and active pointer without network or provider',async()=>{
  const cold=await context.newPage();await cold.goto(base+'fixture.html');await cold.evaluate(async()=>{await navigator.serviceWorker.ready;});networkUnavailable=true;try{await cold.reload();const found=await cold.evaluate(async()=>{const {createPackManager}=await import('./js/ai/packs.js'),manager=createPackManager(),pack=await manager.active('fixture',{verify:true});return {revision:pack.revision,text:await(await manager.response('fixture',pack.assets[0].url)).text()};});assert.deepEqual(found,{revision,text:asset.toString()});}finally{await cold.close();networkUnavailable=false;}
 });
 await check('A corrupt replacement keeps the verified previous pack active and repair/remove stays scoped',async()=>{
  bad=true;const next={...pack,revision:'b'.repeat(40),assets:[{...pack.assets[0],url:`/fixture-pack/${'b'.repeat(40)}/${digest}.bin`}]};
  const failed=await page.evaluate(async next=>{const {createPackManager}=await import('./js/ai/packs.js');try{await createPackManager().install(next);return null;}catch(e){return e.message;}},next);assert.match(failed,/verification|bytes|digest|corrupt|integrity|larger|network error/i);assert.equal((await active()).revision,revision);
  bad=false;await page.evaluate(async next=>{const {createPackManager}=await import('./js/ai/packs.js');await createPackManager().install(next);},next);assert.equal((await active()).revision,next.revision);
  await page.evaluate(async()=>{const {createPackManager}=await import('./js/ai/packs.js');await createPackManager().remove('fixture');});assert.equal(await active(),null);const keys=await page.evaluate(()=>caches.keys());assert(!keys.some(k=>k.startsWith('parola-ai-pack-v1:fixture:')));assert(keys.includes('webllm/model'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fixture-learner')).xp),17);
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(ROOT,`docs/implementation/programme/offline-pack-update-${engine}.json`),JSON.stringify({engine,checks,errors,swSha256:hash(actual),scope:'Origin network disabled at the test server for the offline reload (WebKit browser offline emulation bypasses SW navigation); actual Cache API and SW install/update with exact application handler and a minimal controlled shell. Verified synthetic asset only; no real model/provider/audio/physical-device claim.'},null,2)+'\n');console.log(`${checks.length} ${engine} offline pack update checks passed.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
