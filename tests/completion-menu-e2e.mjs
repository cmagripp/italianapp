#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, reloadApp, answerOracle, TESTS_DIR, SHOTS_DIR } from './lib.mjs';
import { journeyQuestion, solveJourneyQuestion } from './journey-driver.mjs';

const {chromium,devices}=await loadPlaywright(), stop=await ensureServer(), browser=await launchBrowser(chromium);
const results=[], errors=[]; let context,page;
const menu='.completion-dropdown', trigger='[data-completion-menu]';
async function fresh({width=390,height=844,theme='light'}={}) {
  await context?.close();
  context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width,height},reducedMotion:'reduce'}));
  page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
  await boot(page);
  await page.evaluate(async theme=>(await import('./js/store.js')).store.setSetting('theme',theme),theme);
}
async function check(name,run) {
  try {await run();results.push({name,ok:true});console.log('PASS',name);}
  catch(error) {results.push({name,ok:false,error:error.stack});throw error;}
}
async function state(id) {return page.evaluate(async id=>(await import('./js/store.js')).store.completionState(id),id);}
async function evidence() {return page.evaluate(async()=>{const {store}=await import('./js/store.js');return {
  events:Object.keys(store.learning.events).sort(),xp:store.current.stats.xp,
  practice:Object.fromEntries(Object.entries(store.current.items).filter(([,v])=>v.seen).map(([id,v])=>[id,{seen:v.seen,ok:v.ok,ko:v.ko}]))};});}
async function open() {await page.locator(trigger).click();await page.locator(menu).waitFor({state:'visible'});}
async function checked(id,value) {assert.equal(await page.locator(`[data-completion-case="${id}"]`).getAttribute('aria-checked'),String(value));}
async function currentDraft() {return page.evaluate(async()=>{const s=(await import('./js/store.js')).store.learning.session;return {id:s.id,index:s.index,journey:s.journey,draft:s.ui?.draft,activity:s.ui?.activity,caseDrafts:s.ui?.caseDrafts};});}

try {
  await check('Word completion toggles persist without answers or XP',async()=>{
    await fresh();await gotoRoute(page,'/entry/w:casa|noun');const before=await evidence();
    assert.equal(await page.locator('[data-act="learned"]').count(),0);
    await open();await page.locator('[data-completion-item]').click();
    assert.equal((await state('w:casa|noun')).complete,true);
    assert.equal(await page.locator('[data-completion-item]').getAttribute('aria-checked'),'true');
    assert.equal(await page.locator(trigger).getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');await page.locator(menu).waitFor({state:'detached'});
    assert.equal(await page.locator(trigger).evaluate(el=>el===document.activeElement),true);
    await page.evaluate(async()=>(await import('./js/store.js')).store.saveNow());await reloadApp(page);
    assert.equal((await state('w:casa|noun')).complete,true);
    await open();await page.locator('[data-completion-item]').click();assert.equal((await state('w:casa|noun')).complete,false);
    assert.deepEqual(await evidence(),before);
  });
  await check('Both dictionary links share completion dropdowns without rewards',async()=>{
    await fresh();const before=await evidence();
    for(const id of ['w:casa|noun','v:credere']) {
      await gotoRoute(page,'/reference/'+encodeURIComponent(id));
      for(const complete of [true,false,true,false]) {
        await open();
        if(id.startsWith('v:'))await page.locator(`[data-completion-all="${complete}"]`).click();
        else await page.locator('[data-completion-item]').click();
        assert.equal((await state(id)).complete,complete);
        assert.equal(await page.locator(trigger).evaluate(el=>el.classList.contains('is-complete')),complete);
        await page.keyboard.press('Escape');
      }
    }
    assert.deepEqual(await evidence(),before);
  });
  await check('A fresh classic word check restores completion after uncheck, without replaying stale rewards',async()=>{
    await fresh();
    await page.evaluate(async()=>{
      const {store}=await import('./js/store.js');
      store.setSetting('adaptiveLearning',false);store.setSetting('tts',false);
      store.setCompletion('w:casa|noun',{checked:true});store.setCompletion('w:casa|noun',{checked:false});
    });
    const before=await evidence();
    await gotoRoute(page,'/learn/word/w%3Acasa%7Cnoun');
    const scope='.wt-scene[data-key="quick"]';
    await page.locator(scope).waitFor({state:'attached'});
    const showScene=async key=>{
      // Shorten reaching the saved scene only. Its real question runner,
      // answers, Continue callbacks and completion path are exercised below.
      await page.evaluate(key=>{
        for(const scene of document.querySelectorAll('.wt-scene'))scene.hidden=false;
        const scene=document.querySelector(`.wt-scene[data-key="${key}"]`);
        document.querySelector('.wt-scenes').scrollTop=scene.offsetTop;
      },key);
      await page.waitForFunction(key=>{
        const scene=document.querySelector(`.wt-scene[data-key="${key}"]`),deck=document.querySelector('.wt-scenes');
        return scene&&deck&&Math.abs(scene.offsetTop-deck.scrollTop)<3;
      },key);
    };
    await showScene('quick');await page.locator(`${scope} [data-choice]`).first().waitFor();
    for(let i=0;i<3;i++) {
      const q=await answerOracle(page,scope,'w:casa|noun');
      assert.equal(q.type,'mc');assert(q.index>=0,`A known casa answer is present: ${q.tag}`);
      await page.locator(`${scope} [data-choice="${q.index}"]`).click();
      await page.locator(`${scope} [data-next]`).click();
    }
    await page.locator(`${scope} .wt-results`).waitFor();
    assert.match(await page.locator(`${scope} .wt-res-line`).innerText(),/3 of 3 correct/);
    assert.equal((await state('w:casa|noun')).complete,true,'actual fresh classic answers restore completion');
    const passed=await evidence();assert.deepEqual(passed.events,before.events,'classic completion does not manufacture adaptive attempts');
    assert.equal(passed.xp-before.xp,6,'three real answers earn six XP; an earlier manual completion does not earn a second learned bonus');
    await showScene('finito');await page.locator('.fin-xp').waitFor({state:'visible'});
    assert.match(await page.locator('.fin-xp').innerText(),/\+6\b/,'the displayed reward matches the actual reward');
    await showScene('quick');await showScene('finito');assert.deepEqual(await evidence(),passed,'revisiting completed scenes awards nothing twice');
    await page.evaluate(async()=>(await import('./js/store.js')).store.setCompletion('w:casa|noun',{checked:false}));
    await showScene('quick');await showScene('finito');assert.equal((await state('w:casa|noun')).complete,false,'a stale pass cannot undo a newer uncheck');
    assert.deepEqual(await evidence(),passed);
    await page.evaluate(async()=>(await import('./js/store.js')).store.saveNow());await reloadApp(page);
    assert.equal((await state('w:casa|noun')).complete,false);assert.deepEqual(await evidence(),passed);
  });
  await check('Five individual verb cases determine whole-item completion',async()=>{
    await fresh();await gotoRoute(page,'/entry/v:credere');const before=await evidence();await open();
    const ids=['present','past','background','future','condizionale'];
    for(const id of ids){await page.locator(`[data-completion-case="${id}"]`).click();await checked(id,true);}
    assert.equal((await state('v:credere')).complete,true);
    await page.locator('[data-completion-case="past"]').click();await checked('past',false);
    assert.equal((await state('v:credere')).complete,false);
    await page.locator('[data-completion-all="true"]').click();assert.equal((await state('v:credere')).complete,true);
    await page.locator('[data-completion-all="false"]').click();
    assert((await state('v:credere')).cases.every(row=>!row.checked));assert.deepEqual(await evidence(),before);
  });
  await check('Overview cards update in place and cleared cases stay cleared',async()=>{
    await fresh();await gotoRoute(page,'/learn/verb/v:credere');const before=await evidence();await open();
    await page.locator('[data-completion-case="present"]').click();
    assert.equal(await page.locator('[data-tense-case="present"]').evaluate(el=>el.classList.contains('is-complete')),true);
    assert.match(await page.locator('.journey-overview-progress').innerText(),/1 of 5/);
    await page.locator('[data-completion-all="true"]').click();
    assert.equal(await page.locator('.journey-tense-card.is-complete').count(),5);
    assert.equal(await page.locator('[data-open-lesson="mixed"]').count(),1);
    await page.locator('[data-completion-case="present"]').click();
    assert.equal(await page.locator('.journey-tense-card.is-complete').count(),4);
    assert.equal(await page.locator('[data-open-lesson="mixed"]').count(),0);
    await page.evaluate(async()=>(await import('./js/store.js')).store.saveNow());await reloadApp(page);
    assert.equal(await page.locator('.journey-tense-card.is-complete').count(),4);
    assert.equal((await state('v:credere')).cases.find(row=>row.id==='present').checked,false);
    assert.deepEqual(await evidence(),before);
  });
  await check('Editing completion preserves a saved in-progress lesson draft',async()=>{
    await fresh();await gotoRoute(page,'/learn/verb/v:credere?chapter=present');
    let drafted=false;
    for(let i=0;i<45&&!drafted;i++) {
      const phase=await page.locator('[data-journey]').getAttribute('data-phase');
      if(phase==='question') {
        if(await page.locator('[data-activity-letter]').count()) {await page.locator('[data-activity-letter]').first().click();drafted=true;}
        else if(await page.locator('[data-answer]').count()) {await page.locator('[data-answer]').fill('cre');drafted=true;}
        else await solveJourneyQuestion(page,await journeyQuestion(page));
      } else if(await page.locator('[data-continue]').count()) await page.locator('[data-continue]').click();
      else throw Error(`No draft activity at ${phase}`);
    }
    assert(drafted,'Reached an actual partial answer');
    await page.locator('[data-pause]').click();await page.locator('[data-overview]').click();
    const before=await currentDraft(), proof=await evidence();await open();
    await page.locator('[data-completion-case="future"]').click();await page.locator('[data-completion-case="future"]').click();
    assert.deepEqual(await currentDraft(),before);assert.deepEqual(await evidence(),proof);
    await page.keyboard.press('Escape');await page.locator('[data-resume-lesson]').click();
    assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'),'question');
    const after=await currentDraft();assert.equal(after.draft,before.draft);assert.deepEqual(after.activity,before.activity);
  });
  await check('Compact menus fit light and dark phone screens and clean up on navigation',async()=>{
    fs.mkdirSync(SHOTS_DIR,{recursive:true});
    for(const [width,height,theme] of [[375,667,'light'],[390,844,'dark'],[320,480,'light']]) {
      await fresh({width,height,theme});await gotoRoute(page,'/entry/v:credere');await open();
      const bounds=await page.locator(menu).boundingBox();assert(bounds.x>=8&&bounds.x+bounds.width<=width-8);
      assert(bounds.y>=0&&bounds.y+bounds.height<=height-8,JSON.stringify(bounds));
      await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.completionCase),'condizionale');
      await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.completionAll),'true');
      await page.screenshot({path:path.join(SHOTS_DIR,`completion-menu-${width}-${theme}.png`),animations:'disabled'});
      await gotoRoute(page,'/words');assert.equal(await page.locator(menu).count(),0);
    }
  });
  await check('No application errors',async()=>assert.deepEqual(errors,[]));
} finally {
  fs.writeFileSync(path.join(TESTS_DIR,'report-completion-menu.json'),JSON.stringify({results,errors},null,2));
  await browser.close();stop();
}
console.log(`${results.length} completion menu checks passed`);
