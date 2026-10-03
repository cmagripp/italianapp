import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,ensureServer,boot,gotoRoute,contextOptions} from './lib.mjs';
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer();
const browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width:440,height:956},reducedMotion:'reduce'}));
const page=await context.newPage(),results=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
try{
 await boot(page);
 await gotoRoute(page,'/profile');
 await check('Me shows progress and opens preferences in a separate settings sheet',async()=>{
  assert.equal(await page.locator('[data-seg="theme"]').count(),0);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  assert.equal(await page.getByRole('dialog',{name:'Settings',exact:true}).count(),1);
  await page.locator('[data-seg="theme"][data-v="light"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  await page.locator('[data-pick="studyMinutes"]').click();
  await page.getByRole('menuitemradio',{name:/15 minutes/}).click();
  assert.equal(await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();return store.settings.studyMinutes;}),15);
 });
 await check('Nested dialogs preserve the settings sheet, focus and scroll lock',async()=>{
  await page.locator('[data-pick="studyMinutes"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.sheet-wrap.open').count(),1);
  await page.locator('[data-new-user]').click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.getByRole('dialog',{name:'Settings',exact:true}).count(),1);
  assert(await page.evaluate(()=>document.body.classList.contains('no-scroll')));
  assert.equal(await page.evaluate(()=>document.querySelector('.me-settings-sheet').hasAttribute('inert')),false);
  await page.locator('[data-new-user]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.sheet-wrap.open').count(),1);
  assert(await page.evaluate(()=>document.querySelector('.me-settings-sheet').contains(document.activeElement)));
  const done=page.locator('[data-close-settings]');await done.focus();await page.keyboard.press('Tab');
  assert(await page.evaluate(()=>document.querySelector('.me-settings-sheet').contains(document.activeElement)));
  assert.equal(await done.evaluate(el=>el===document.activeElement),false);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.sheet-wrap.open').count(),0);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('no-scroll')),false);
  assert.equal(await page.evaluate(()=>document.querySelector('#view').hasAttribute('inert')),false);
  assert.equal(await page.getByRole('button',{name:'Settings',exact:true}).evaluate(el=>el===document.activeElement),true);
 });
 await check('Study time survives reload; completed vocabulary opens a filtered list',async()=>{
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-settings]');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  assert.equal(await page.locator('[data-pick="studyMinutes"] .val').textContent(),'15');
  await page.locator('[data-close-settings]').click();
  await page.getByRole('link',{name:/Completed vocabulary/}).click();
  await page.waitForSelector('[data-state-menu]');assert.equal((await page.locator('[data-state-menu]').textContent()).trim(),'Learned');
 });
 await check('Home and Learn share the same exact next activity without creating a session',async()=>{
  await gotoRoute(page,'/home');
  const before=await page.evaluate(async()=>{const {store}=await import('./js/store.js');return Object.keys(store.learning.sessions);});
  const home=await page.locator('[data-continue-shared]').getAttribute('href');
  await gotoRoute(page,'/learn');
  assert.equal(await page.locator('[data-start][data-continue-shared]').getAttribute('href'),home);
  const after=await page.evaluate(async()=>{const {store}=await import('./js/store.js');return Object.keys(store.learning.sessions);});
  assert.deepEqual(after,before);
 });
 await check('A verb overview cannot replace the actual lesson in Continue',async()=>{
  await gotoRoute(page,'/learn/verb/v:mangiare?chapter=present');await page.waitForSelector('[data-journey]');
  await gotoRoute(page,'/home');const prior=await page.locator('[data-continue-shared]').getAttribute('href');assert.match(prior,/v%3Amangiare/);
  await gotoRoute(page,'/learn/verb/v:credere');await page.waitForSelector('.journey-overview');
  await gotoRoute(page,'/home');assert.equal(await page.locator('[data-continue-shared]').getAttribute('href'),prior);
  await gotoRoute(page,'/learn');assert.equal(await page.locator('[data-start][data-continue-shared]').getAttribute('href'),prior);
  assert.equal(await page.locator('[data-hero] [data-title]').innerText(),'mangiare');
 });
 await check('Play connects Review, the workshop and Conversations with honest local availability',async()=>{
  await gotoRoute(page,'/games');
  const links=page.locator('.play-practice-links');
  assert.match(await links.locator('[data-conversation-availability]').innerText(),/Replies aren’t available/);
  for(const [name,hash,selector] of [['Review','#/review','[data-review-queue]'],['Sentence workshop','#/lab/frasi','[data-lab-page]'],['Conversations','#/conversations','[data-new-conversation]']]){
   await links.getByRole('link',{name:new RegExp(name)}).click();
   await page.waitForFunction(h=>location.hash===h,hash);
   await page.locator(selector).waitFor();
   await gotoRoute(page,'/games');
  }
 });
 await check('Practice history preserves recognition and assistance without changing learning evidence',async()=>{
  await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{data}=await import('./js/data.js');
   const coffee=data.vocab.find(e=>e.it==='caffè'&&!e.legacyGrouping),now=Date.now()-35*9*3600e3;
   for(let i=0;i<35;i++)store.recordLearningAttempt({id:`history-test:${i}`,sessionId:`history-visit:${i}`,index:0,at:now+i*9*3600e3,objectiveId:`${coffee.id}::word::meaning`,entryId:coffee.id,kind:'word',skill:'meaning',mode:'recognition',firstAttempt:true,ok:true,outcome:'correct',variantId:`history-choice:${i}`,contextId:`coffee-context:${i}`,assistance:i===34?['hint']:[],xp:0});
   await store.saveNow();window.__historyBefore=JSON.stringify(store.learning);
  });
  await gotoRoute(page,'/profile');await page.locator('[data-learning-history]').click();
  await page.getByRole('dialog',{name:'My practice',exact:true}).waitFor();
  await page.locator('[data-history-search]').fill('caffè');
  assert.equal(await page.locator('[data-history-row]').count(),1);
  assert.equal(await page.locator('.me-history-state').textContent(),'Recognised again later');
  await page.locator('[data-history-tab="answers"]').click();
  assert.equal(await page.locator('[data-history-row]').count(),30);
  assert.match(await page.locator('[data-history-row]').first().innerText(),/Correct · with support/);
  await page.locator('[data-history-more]').click();assert.equal(await page.locator('[data-history-row]').count(),35);
  assert.equal(await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.learning)===window.__historyBefore),true);
  await page.keyboard.press('Escape');
 });
 await check('Offline conversation settings distinguish each mode and keep saved data accessible',async()=>{
  await page.locator('[data-settings]').click();await page.locator('[data-offline-ai]').click();
  const dialog=page.getByRole('dialog',{name:'Offline conversations',exact:true});
  await dialog.waitFor();assert.match(await dialog.innerText(),/not available in this release/);
  assert.equal(await dialog.getByText('Unavailable',{exact:true}).count(),3);
  assert.equal(await dialog.getByRole('link',{name:'Saved conversations'}).getAttribute('href'),'#/conversations');
  await page.keyboard.press('Escape');await page.locator('[data-close-settings]').click();
 });
 await check('Changing learner closes practice history and leaves the new learner empty',async()=>{
  await page.locator('[data-learning-history]').click();
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.createProfile('History isolation');});
  await page.getByRole('dialog',{name:'My practice',exact:true}).waitFor({state:'hidden'});
  await gotoRoute(page,'/profile');await page.locator('[data-learning-history]').click();
  assert.equal(await page.locator('[data-history-row]').count(),0);
  await page.keyboard.press('Escape');
 });
 await check('Home and Learn resume the same saved conversation draft without awarding learning',async()=>{
  const id=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');
   const repo=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});
   try{const thread=await repo.createThread({name:'Ada',level:'A1',topic:'general',participants:[{id:'partner-1',name:'Marco'}]},{title:'Weekend plans'});await repo.saveDraft(thread.threadId,{typedText:'Vorrei un caffè.',turnId:'resume-draft'},{expectedRevision:0});window.__conversationLearning=JSON.stringify(store.learning);return thread.threadId;}finally{repo.close();}
  });
  const href='#/conversations/'+encodeURIComponent(id);
  await gotoRoute(page,'/home');assert.equal(await page.locator('[data-continue-shared]').getAttribute('href'),href);
  await gotoRoute(page,'/learn');const start=page.locator('[data-start][data-continue-shared]');assert.equal(await start.getAttribute('href'),href);assert.equal(await page.locator('[data-hero] [data-title]').innerText(),'Weekend plans');
  await start.click();await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='Vorrei un caffè.');assert.equal(await page.locator('[data-conversation-draft]').inputValue(),'Vorrei un caffè.');
  assert.equal(await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.learning)===window.__conversationLearning),true);
  await page.evaluate(async id=>{const {store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');const repo=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});try{await repo.updateThread(id,{archived:true});}finally{repo.close();}},id);
  await gotoRoute(page,'/home');assert.notEqual(await page.locator('[data-continue-shared]').getAttribute('href'),href);
 });
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(new URL('./report-programme-navigation.json',import.meta.url),JSON.stringify({results,errors},null,2));await browser.close();stop();}
