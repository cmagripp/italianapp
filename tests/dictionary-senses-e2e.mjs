import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,ensureServer,boot,gotoRoute,reloadApp,contextOptions} from './lib.mjs';
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer();
const browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width:440,height:956},reducedMotion:'reduce'}));
const page=await context.newPage(),results=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
const route=(kind,id)=>gotoRoute(page,`/${kind}/${encodeURIComponent(id)}`);
const state=id=>page.evaluate(async id=>{const {store}=await import('./js/store.js');return {complete:store.completionState(id).complete,xp:store.current.stats.xp,events:Object.keys(store.learning.events)};},id);
try{
 await boot(page);
 await check('Old headword completion is retained without learning all newly split senses',async()=>{
  await route('entry','w:pesca|noun');
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setCompletion('w:pesca|noun',{checked:true});await store.saveNow();});
  await reloadApp(page);assert((await state('w:pesca|noun')).complete);
  assert.match(await page.locator('[data-legacy-sense-note]').textContent(),/earlier word completion is kept/);
  assert.equal(await page.locator('[data-sense]').count(),2);
  for(const id of ['w:pesca|noun#peach','w:pesca|noun#fishing'])assert.equal((await state(id)).complete,false);
  const before=await state('w:pesca|noun');
  await route('entry','w:pesca|noun#peach');await page.locator('[data-completion-menu]').click();await page.locator('[data-completion-item]').click();await page.keyboard.press('Escape');
  assert((await state('w:pesca|noun#peach')).complete);assert.equal((await state('w:pesca|noun#fishing')).complete,false);
  const after=await state('w:pesca|noun');assert.deepEqual(after,before);
  await page.evaluate(async()=>(await import('./js/store.js')).store.saveNow());await reloadApp(page);
  assert((await state('w:pesca|noun#peach')).complete);assert.equal((await state('w:pesca|noun#fishing')).complete,false);
 });
 await check('Both dictionary URLs expose the same meaning-specific article and plural',async()=>{
  for(const kind of ['entry','reference']){
   await route(kind,'w:capitale|noun#capital-city');
   assert.match(await page.locator('[data-headword]').innerText(),/la\s*capitale/);
   assert.equal(await page.locator('[data-completion-menu]').count(),1);
   await page.locator('[data-fview="grid"]').click();
   assert.deepEqual(await page.locator('[data-forms-grid] .f .val > span').allTextContents(),['la capitale','le capitali']);
  }
  await route('entry','w:capitale|noun#financial-capital');
  assert.match(await page.locator('[data-headword]').innerText(),/il\s*capitale/);
 });
 await check('Starred state is shared by dictionary and flashcards and survives a reload',async()=>{
  await page.locator('[data-entry-star]').click();assert.equal(await page.locator('[data-entry-star]').getAttribute('aria-pressed'),'true');
  await reloadApp(page);assert.equal(await page.locator('[data-entry-star]').getAttribute('aria-pressed'),'true');
  await gotoRoute(page,'/game/flashcards?src=ids:'+encodeURIComponent('w:capitale|noun#financial-capital'));
  await page.locator('[data-star]').waitFor();assert.equal(await page.locator('[data-star]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-star]').click();await route('reference','w:capitale|noun#financial-capital');
  assert.equal(await page.locator('[data-entry-star]').getAttribute('aria-pressed'),'false');
 });
 await check('Accepted irregular alternatives are never crossed out in reference explanations',async()=>{
  await route('entry','v:vedere');
  assert(!(await page.locator('.why-reg s').allTextContents()).some(text=>/\bveduto\b/.test(text)));
 });
 await check('Meaning selectors remain usable in both themes on a narrow phone',async()=>{
  for(const theme of ['light','dark']){
   await page.setViewportSize({width:375,height:812});
   await page.evaluate(async theme=>(await import('./js/store.js')).store.setSetting('theme',theme),theme);
   await route('entry','w:capitale|noun#capital-city');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   for(const a of await page.locator('.entry-sense a').all()){const box=await a.boundingBox();assert(box.width>40);assert(box.x>=0&&box.x+box.width<=376);}
  }
  await page.screenshot({path:'/tmp/parola-dictionary-senses.png',fullPage:true});
 });
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(new URL('./report-dictionary-senses.json',import.meta.url),JSON.stringify({browser:process.env.COURSE_BROWSER||'chromium',results,errors},null,2));await browser.close();stop();}
