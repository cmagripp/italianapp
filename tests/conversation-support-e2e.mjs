import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions(undefined,{viewport:{width:440,height:956}})),page=await context.newPage(),results=[];
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
const install=()=>page.evaluate(async()=>{
 const {installConversationProvider}=await import('./js/conversations/runtime.js'),{createAIService}=await import('./js/ai/index.js');
 const senses=[{id:'coffee',lemma:'caffè',forms:['il caffè'],verified:true,source:'test-only-reviewed-word',level:'A1'},{id:'tea',lemma:'tè',forms:['il tè'],verified:true,source:'test-only-reviewed-word',level:'A1'}];
 const service=createAIService({grounding:{retrieve:()=>({version:'fixture',rules:[],senses})},languagePolicy:{version:'explicit-test-policy',validate:()=>({ok:true})},runtime:{generate:()=>JSON.stringify({participantId:'partner-1',text:'Preferisci un caffè o un tè?',corrections:[],replySupport:{prefix:'Vorrei un ',suffix:'.',choices:[{surface:'caffè',senseId:'coffee'},{surface:'tè',senseId:'tea'}]}})}});
 installConversationProvider({readiness:()=>({written:true}),acquire:()=>service,dispose:()=>service.dispose()});
});
try{
 await page.goto(BASE+'#/conversations');await page.locator('[data-new-conversation]').click();await page.getByRole('button',{name:'Start conversation',exact:true}).click();await page.locator('[data-start-dialogue]').waitFor();await install();
 await check('A generated frame offers choices without sending a fictitious learner answer',async()=>{
  await page.locator('[data-start-dialogue]').click();await page.locator('[data-reply-choice]').first().waitFor();assert.equal(await page.locator('.conversation-message.learner').count(),0);await page.locator('[data-reply-choice="0"]').click();await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]').value==='Vorrei un caffè.');assert.equal(await page.locator('[data-conversation-draft]').inputValue(),'Vorrei un caffè.');assert.equal(await page.locator('.conversation-message.learner').count(),0);
 });
 await check('Using a suggested word records assistance and never awards mastery',async()=>{
  await page.locator('.conversation-send').click();await page.waitForFunction(()=>document.querySelectorAll('.conversation-message.partner').length===2);
  const r=await page.evaluate(async()=>{const{store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js'),repo=createConversationRepository({profileId:store.current.id,learnerId:store.current.learnerId});const state=await repo.read(decodeURIComponent(location.hash.split('/')[2]));repo.close();return {turn:state.turns.find(t=>t.role==='learner'),evidence:Object.keys(store.learning.events).length};});
  assert.equal(r.turn.inputProvenance.generatedSupport,true);assert.equal(r.turn.inputProvenance.assistance[0].type,'reply-frame-choice');assert.equal(r.evidence,0);
 });
 await check('The learner may replace the offered vocabulary with their own word and edit the complete reply',async()=>{
  await page.locator('[data-reply-own]').fill('succo');await page.locator('[data-reply-use-own]').click();await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]').value==='Vorrei un succo.');assert.equal(await page.locator('[data-conversation-draft]').inputValue(),'Vorrei un succo.');await page.locator('[data-conversation-draft]').fill('Vorrei un succo, grazie.');await page.locator('.conversation-send').click();await page.waitForFunction(()=>document.querySelectorAll('.conversation-message.learner').length===2);assert.match(await page.locator('.conversation-message.learner').last().innerText(),/Vorrei un succo, grazie/);
 });
 await check('A reload never treats imported model metadata as a newly verified suggestion; explicit Help regenerates it',async()=>{
  await page.reload();await page.locator('[data-help]').waitFor();assert.equal(await page.locator('[data-reply-choice]').count(),0);await install();const before=await page.locator('.conversation-message').count();await page.locator('[data-help]').click();await page.locator('[data-reply-choice]').first().waitFor();assert.equal(await page.locator('.conversation-message').count(),before);
 });
 await check('Blank replies initially hide word choices, and the learner can deliberately reveal help',async()=>{
  await page.locator('[data-conversation-menu]').click();await page.getByRole('menuitemradio',{name:'Conversation preferences'}).click();await page.locator('[data-setting="support"]').click();await page.getByRole('menuitemradio',{name:'Complete a reply'}).click();await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.locator('[data-help]').click();await page.locator('[data-reply-options]').waitFor();assert.equal(await page.locator('[data-reply-choice]').first().isVisible(),false);await page.locator('[data-reply-options]').click();assert.equal(await page.locator('[data-reply-choice]').first().isVisible(),true);
 });
}finally{fs.writeFileSync(`docs/implementation/programme/conversation-support-${process.env.COURSE_BROWSER||'chromium'}.json`,JSON.stringify({browser:process.env.COURSE_BROWSER||'chromium',evidence:'Explicit test provider and policy; no production Italian quality claim',checks:results},null,2));await context.close();await browser.close();stop();}
