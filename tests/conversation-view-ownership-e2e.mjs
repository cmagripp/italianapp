import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';

const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium';
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),results=[],errors=[];
let context,page;
async function fresh(){
 await context?.close();context=await browser.newContext(contextOptions(undefined,{reducedMotion:'reduce'}));page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(BASE+'#/profile');await page.locator('[data-settings]').waitFor();
}
async function holdDatabase(){
 await page.evaluate(()=>{
  const original=indexedDB.open.bind(indexedDB);window.heldConversationOpens=[];window.restoreConversationOpen=()=>{indexedDB.open=original;};
  indexedDB.open=function(name,...rest){
   const request=original(name,...rest);if(name!=='parola-conversations')return request;
   return new Proxy(request,{
    get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},
    set(target,key,value){
     if(key==='onsuccess'){
      target.onsuccess=event=>heldConversationOpens.push({release:()=>value.call(target,event),fail:()=>{target.result.close();target.onerror(new Event('error'));}});return true;
     }
     return Reflect.set(target,key,value,target);
    }
   });
  };
 });
}
async function route(hash,selector){await page.evaluate(hash=>location.hash=hash,hash);if(selector)await page.locator(selector).waitFor();}
const profileJSON=()=>page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current));
async function check(label,run){await fresh();await run();results.push(label);console.log('PASS',label);}
async function seed(){
 return page.evaluate(async()=>{
  const {store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');
  const repo=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});
  try{const thread=await repo.createThread({name:'Ada',level:'A1',participants:[{id:'partner-1',name:'Giulia',active:true}]},{title:'Saved conversation'});await repo.saveDraft(thread.threadId,{typedText:'Ci vediamo domani.'});return '#/conversations/'+encodeURIComponent(thread.threadId);}finally{repo.close();}
 });
}
try{
 await check('Opening a conversation reuses the loaded dictionary and preserves custom word lookup',async()=>{
  const hash=await seed(),requests=[];
  await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{registerCustom}=await import('./js/data.js');store.current.custom['c:conversation-dictionary-test']={id:'c:conversation-dictionary-test',it:'molo',en:'pier',pos:'noun',g:'m',pl:'moli',level:'A1'};registerCustom(store.current.custom);});
  page.on('request',request=>{if(/\/data\/(vocab|verbs|stats|completion-index)\.json/.test(request.url()))requests.push(request.url());});
  await route(hash);await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='Ci vediamo domani.');
  assert.deepEqual(requests,[]);assert.equal(await page.evaluate(async()=>(await import('./js/data.js')).getEntry('c:conversation-dictionary-test')?.en),'pier');
 });
 await check('Composer waits for the saved draft revision before accepting the first edit',async()=>{
  const hash=await seed();await holdDatabase();await route(hash);await page.waitForFunction(()=>heldConversationOpens.length===1);
  assert.equal(await page.locator('[data-conversation-draft]').isDisabled(),true);assert.equal(await page.locator('[data-summary]').isDisabled(),true);
  assert.equal(await page.locator('a[aria-label="All conversations"]').isVisible(),true);assert.match(await page.locator('[data-conversation-status]').innerText(),/Opening saved conversation/);
  await page.evaluate(()=>{const input=document.querySelector('[data-conversation-draft]');input.value='Ignored synthetic edit while loading';input.dispatchEvent(new Event('input',{bubbles:true}));heldConversationOpens[0].release();});
  await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='Ci vediamo domani.');
  assert.equal(await page.locator('[data-conversation-draft]').isEditable(),true);assert.equal(await page.locator('[data-recovered-draft]').count(),0);
  await page.locator('[data-conversation-draft]').fill('Vorrei cambiare la risposta.');await route('#/profile','[data-settings]');await page.evaluate(()=>restoreConversationOpen());await route(hash);
  await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='Vorrei cambiare la risposta.');assert.equal(await page.locator('[data-recovered-draft]').count(),0);
 });
 for(const result of ['release','fail'])await check(`Late inbox database ${result==='release'?'success':'failure'} cannot overwrite Profile`,async()=>{
  await holdDatabase();await route('#/conversations');await page.waitForFunction(()=>heldConversationOpens.length===1);
  await route('#/profile','[data-settings]');const before=await profileJSON();
  await page.evaluate(result=>heldConversationOpens[0][result](),result);await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-settings]').count(),1);assert.equal(await page.locator('[data-new-conversation]').count(),0);assert.equal(await profileJSON(),before);
 });
 for(const change of ['profile','learner','epoch'])await check(`Late inbox request after ${change} replacement cannot publish or change learning`,async()=>{
  await holdDatabase();await route('#/conversations');await page.waitForFunction(()=>heldConversationOpens.length===1);
  await page.evaluate(async change=>{
   const {store}=await import('./js/store.js');
   if(change==='profile')await store.createProfile('Different learner');
   else if(change==='epoch')await store.resetProgress();
   else{const profile=structuredClone(store.current);profile.learnerId=crypto.randomUUID();await store.importJSON(JSON.stringify({profile}));}
   await store.saveNow();
  },change);
  await page.waitForFunction(()=>heldConversationOpens.length===2);
  const before=await profileJSON();await page.evaluate(()=>{document.querySelector('#view').innerHTML='<p data-new-owner-waiting>Waiting for current conversation list</p>';heldConversationOpens[0].release();});await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-new-owner-waiting]').count(),1);assert.equal(await profileJSON(),before);
  await page.evaluate(()=>heldConversationOpens[1].release());await page.locator('[data-new-conversation]').waitFor();
 });
 await check('Old inbox completion after returning to the same route leaves current controls active',async()=>{
  await holdDatabase();await route('#/conversations');await page.waitForFunction(()=>heldConversationOpens.length===1);
  await route('#/profile','[data-settings]');await route('#/conversations');await page.waitForFunction(()=>heldConversationOpens.length===2);
  await page.evaluate(()=>heldConversationOpens[1].release());await page.locator('[data-new-conversation]').waitFor();
  await page.evaluate(()=>{document.querySelector('.conversations-hub').dataset.currentPublication='yes';heldConversationOpens[0].release();});await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-current-publication]').count(),1);await page.locator('[data-new-conversation]').click();assert.equal(await page.locator('.conversation-setup').count(),1);
 });
 await check('Leaving a player during initial storage load removes its viewport and preserves Profile',async()=>{
  const hash=await seed();await holdDatabase();await route(hash);await page.waitForFunction(()=>heldConversationOpens.length===1);
  await route('#/profile','[data-settings]');const before=await profileJSON();
  await page.evaluate(()=>heldConversationOpens[0].release());await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-settings]').count(),1);assert.equal(await page.evaluate(()=>document.body.classList.contains('conversation-viewport')),false);assert.equal(await profileJSON(),before);
 });
 await check('Old player cleanup cannot remove a newer player viewport, controls or saved draft',async()=>{
  const hash=await seed();await holdDatabase();await route(hash);await page.waitForFunction(()=>heldConversationOpens.length===1);
  await route('#/profile','[data-settings]');await route(hash);await page.waitForFunction(()=>heldConversationOpens.length===2);
  await page.evaluate(()=>heldConversationOpens[1].release());await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='Ci vediamo domani.');
  await page.evaluate(()=>{document.querySelector('.conversation-player').dataset.currentPublication='yes';heldConversationOpens[0].release();});await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-current-publication]').count(),1);assert.equal(await page.evaluate(()=>document.body.classList.contains('conversation-viewport')&&document.body.classList.contains('journey-viewport')),true);
  assert.equal(await page.locator('[data-conversation-draft]').inputValue(),'Ci vediamo domani.');await page.locator('[data-voice]').click();assert.equal(await page.locator('[data-speech-controls]').isVisible(),true);
  await page.evaluate(()=>restoreConversationOpen());await page.locator('[data-conversation-draft]').fill('A domani!');await route('#/profile','[data-settings]');await route(hash);
  await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='A domani!');
 });
 await check('A speech pack that finishes opening after navigation is released without recording or playback',async()=>{
  const hash=await seed();await route(hash);await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='Ci vediamo domani.');
  await page.evaluate(async()=>{
   const {installConversationProvider}=await import('./js/conversations/runtime.js');window.speechLifecycle={opened:0,released:0,spoken:0,recognized:0};
   window.removeLifecycleProvider=installConversationProvider({readiness:()=>({written:false,recorded:true,handsfree:false}),acquire:()=>null,
    acquireSpeech:()=>{speechLifecycle.opened++;return new Promise(resolve=>{window.releaseSpeechAcquisition=()=>resolve({recognizer:{transcribe(){speechLifecycle.recognized++;}},voice:{speak(){speechLifecycle.spoken++;},stop(){}},release(){speechLifecycle.released++;}});});}});
  });
  await page.locator('[data-voice]').click();await page.waitForFunction(()=>typeof releaseSpeechAcquisition==='function');await route('#/profile','[data-settings]');
  await page.evaluate(()=>releaseSpeechAcquisition());await page.waitForFunction(()=>speechLifecycle.released===1);
  assert.deepEqual(await page.evaluate(()=>speechLifecycle),{opened:1,released:1,spoken:0,recognized:0});assert.equal(await page.locator('[data-settings]').count(),1);
  await page.evaluate(()=>removeLifecycleProvider());
 });
 assert.deepEqual(errors,[]);
}finally{
 fs.writeFileSync(`docs/implementation/programme/conversation-view-ownership-${name}.json`,JSON.stringify({browser:name,method:'Real router and native IndexedDB; delay actual open-success delivery, including deliberate storage error delivery. No model or speech quality claim.',checks:results,errors},null,2)+'\n');
 await context?.close();await browser.close();stop();
}
