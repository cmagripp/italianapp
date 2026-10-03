#!/usr/bin/env node
// Real player regressions for exact drafts, accent provenance, assistance and stale callbacks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,contextOptions,ensureServer,boot,gotoRoute,reloadApp,settle} from './lib.mjs';
const ID='sl-presente-phase2-fixture';
const fixture={id:ID,title:'Phase 2 workshop fixture',tense:'presente',vocab:[],grammarRefs:[],activities:[
  {id:ID+'.model',kind:'model',prompt:'Pattern',body:'A fixture for the player.'},
  {id:ID+'.adj',kind:'cloze',prompt:'Your feeling',template:'Oggi ____.',en:'Today I am tired.',blanks:[{accept:['sono stanco','sono stanca'],options:['sono stanco','sono stanca','sono stanchi'],bank:[],free:true,slot:{pos:'adj',agree:'speaker',wrap:'sono {}'},explanation:'Use a singular adjective.'}]},
  {id:ID+'.tea',kind:'cloze',prompt:'Your drink',template:'Bevo ____.',en:'I drink tea.',blanks:[{accept:['tè'],options:['tè','casa'],bank:[],free:true,slot:{pos:'noun',article:'none'},explanation:'A drink.'}]},
]};
const pack=JSON.parse(fs.readFileSync(new URL('../data/sentence-lab/presente.json',import.meta.url),'utf8'));pack.lessons.push(fixture);
const {chromium,devices}=await loadPlaywright(),stop=await ensureServer(),browser=await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width:430,height:932},reducedMotion:'reduce'})),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/data/sentence-lab/presente.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(pack)}));
let checks=0;
async function test(name,fn){await fn();checks++;console.log('✓ '+name);}
async function seed(index=1,accentStrict=false){
  await gotoRoute(page,'/home');
  await page.evaluate(async ({id,index,accentStrict})=>{
    const {store}=await import('./js/store.js'),data=await import('./js/learning/sentence-lab-data.js'),engine=await import('./js/learning/sentence-lab.js');
    await data.loadSentenceLab();const lesson=data.labLesson(id),s=engine.createLabSession(lesson);s.index=index;s.state=null;engine.currentLabStep(lesson,s);s.state.ui={touched:true};
    store.setSetting('accentStrict',accentStrict);store.setSetting('tts',false);data.writeLabSession(store,s);await store.saveNow();
  },{id:ID,index,accentStrict});
  await gotoRoute(page,'/lab/frasi/'+ID);await page.locator('[data-lab-cloze]').waitFor();
}
async function ownWord(text){await page.locator('[data-lab-free="0"]').click();await page.locator('[data-lab-free-input="0"]').fill(text);}
async function snapshot(){return page.evaluate(async id=>{const {store}=await import('./js/store.js'),d=await import('./js/learning/sentence-lab-data.js');return structuredClone(d.readLabSession(store,id));},ID);}
async function flush(){await page.evaluate(()=>import('./js/store.js').then(m=>m.store.saveNow()));}
try{
  await boot(page);
  await test('exact own-word drafts survive reload, accent buttons, pause and navigation',async()=>{
    await seed();const draft="  Oggi non so ancora cosa scrivere: "+'è '.repeat(48)+"l’amica  ";await ownWord(draft);assert.equal((await snapshot()).state.ui.drafts[0],draft);await flush();await reloadApp(page);assert.equal(await page.locator('[data-lab-free-input="0"]').inputValue(),draft);
    await page.locator('[data-lab-free-input="0"]').evaluate(e=>{e.setSelectionRange(e.value.length,e.value.length);});await page.locator('[data-lab-accent="à"]').click();const accented=draft+'à';assert.equal((await snapshot()).state.ui.drafts[0],accented);
    await page.locator('[data-lab-pause]').click();await flush();await reloadApp(page);await page.locator('[data-lab-resume]').click();assert.equal(await page.locator('[data-lab-free-input="0"]').inputValue(),accented);
    await gotoRoute(page,'/home');await gotoRoute(page,'/lab/frasi/'+ID);assert.equal(await page.locator('[data-lab-free-input="0"]').inputValue(),accented);
  });
  await test('malformed morphology stays in the draft and receives no rewritten credit',async()=>{
    await seed();await ownWord('stanchi');await page.locator('[data-lab-free-submit="0"]').click();assert.match(await page.locator('[data-lab-free-message="0"]').innerText(),/stated form|singular/);const s=await snapshot();assert.equal(s.state.ui.drafts[0],'stanchi');assert.equal(s.state.ui.values[0],'');assert.equal(s.state.result,null);assert.equal(await page.locator('[data-lab-check]').isDisabled(),true);
  });
  await test('accent-only restoration is visible and saved with the original submission',async()=>{
    await seed(2);await ownWord('te');await page.locator('[data-lab-free-submit="0"]').click();assert.equal(await page.locator('[data-lab-blank="0"]').innerText(),'tè');await page.locator('[data-lab-check]').click();await page.locator('.submission-note').first().waitFor();await page.locator('.submission-note summary').first().click();assert.match(await page.locator('.submission-note').first().innerText(),/As typed: te/);const s=await snapshot();assert.equal(s.state.result.blanks[0].submission.originalText,'te');assert.equal(s.state.result.blanks[0].submission.displayText,'tè');await flush();await reloadApp(page);assert.equal((await snapshot()).state.result.blanks[0].submission.originalText,'te');
    await seed(2,true);await ownWord('te');await page.locator('[data-lab-free-submit="0"]').click();assert.match(await page.locator('[data-lab-free-message="0"]').innerText(),/accent/);assert.equal((await snapshot()).state.result,null);
  });
  await test('translated English produces explicitly assisted practice',async()=>{
    await seed();await page.evaluate(()=>import('./js/store.js').then(m=>m.store.markLearned('w:stanco|adj','word')));await ownWord('tired');await page.locator('[data-lab-free-submit="0"]').click();await page.locator('[data-lab-check]').click();assert.match(await page.locator('.grammar-footer').innerText(),/Assisted practice/);const r=(await snapshot()).state.result;assert.equal(r.outcome,'accepted');assert.deepEqual(r.assistance,['translation']);assert.equal(r.blanks[0].assessed,false);assert.equal(r.blanks[0].given,'tired');
  });
  await test('legacy constructed drafts stay assisted and retain exact saved text',async()=>{
    await seed();
    const draft="  stanco e\u0300 l’amica  ";
    await gotoRoute(page,'/home');
    await page.evaluate(async ({id,draft})=>{
      const {store}=await import('./js/store.js'),d=await import('./js/learning/sentence-lab-data.js');
      const s=d.readLabSession(store,id);
      s.state.ui={values:['sono stanco'],active:0,entries:{0:{entryId:'w:stanco|adj'}},drafts:{0:draft},freeOpen:{0:true},notes:{0:'natural'}};
      d.writeLabSession(store,s);await store.saveNow();
    },{id:ID,draft});
    await gotoRoute(page,'/lab/frasi/'+ID);
    assert.equal(await page.locator('[data-lab-free-input="0"]').inputValue(),draft);
    assert.equal(await page.locator('.lab-fit-note').count(),0);
    await page.locator('[data-lab-check]').click();
    const result=(await snapshot()).state.result;
    assert.equal(result.outcome,'accepted');assert.deepEqual(result.assistance,['legacy-construction']);
    assert.equal(result.blanks[0].assessed,false);
    assert.equal(result.blanks[0].submission.inputMode,'choice');
    assert.equal((await snapshot()).state.ui.drafts[0],draft);
  });
  await test('typed drill draft resumes exactly after reload and navigation disposal',async()=>{
    await seed();await ownWord('contento');await page.locator('[data-lab-free-submit="0"]').click();await page.locator('[data-drill-start]').click();
    for(let i=0;i<2;i++){const correct=(await snapshot()).state.ui.activeDrill.drills[i].choices.findIndex(c=>c.correct);await page.locator(`[data-drill-choice="${correct}"]`).click();await page.locator('[data-drill-next]').click();}
    const draft='  contentò '+ 'draft '.repeat(20);await page.locator('[data-drill-input]').fill(draft);assert.equal((await snapshot()).state.ui.activeDrill.view.draft,draft);await flush();await reloadApp(page);await page.locator('[data-drill-input]').waitFor();assert.equal(await page.locator('[data-drill-input]').inputValue(),draft);
    await page.evaluate(()=>{window.staleDrill=document.querySelector('[data-drill-check]');});await gotoRoute(page,'/home');await gotoRoute(page,'/lab/frasi/'+ID);await page.locator('[data-drill-input]').waitFor();assert.equal(await page.locator('[data-drill-input]').inputValue(),draft);const before=(await snapshot()).drillSeq;await page.evaluate(()=>window.staleDrill.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal((await snapshot()).drillSeq,before);
  });
  await test('picker callbacks cannot mark a word or save a draft into another profile',async()=>{
    await seed();await ownWord('happy');await page.locator('[data-lab-free-submit="0"]').click();await page.locator('[data-lab-picker]').waitFor();
    const result=await page.evaluate(async()=>{const {store}=await import('./js/store.js');const stale=document.querySelector('[data-lab-candidate]'),owner=store.current.id;await store.createProfile('Workshop guard');stale.dispatchEvent(new MouseEvent('click',{bubbles:true}));await store.saveNow();return {owner,current:store.current.id,events:store.learning.events,sessions:store.learning.sessions,learned:store.learnedWordIds()};});assert.notEqual(result.current,result.owner);assert.equal(Object.keys(result.sessions).length,0);assert.equal(Object.keys(result.events).length,0);assert.equal(result.learned.length,0);
  });
  assert.deepEqual(errors,[]);console.log(`${checks} Phase 2 workshop browser checks passed; zero application errors.`);
}finally{await context.close();await browser.close();stop();}
