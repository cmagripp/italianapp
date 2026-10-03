import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions,boot,gotoRoute} from './lib.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium',browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions(undefined,{viewport:{width:390,height:844},reducedMotion:'reduce'})),page=await context.newPage(),checks=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
await boot(page,BASE);await gotoRoute(page,'/conversations');await page.locator('[data-new-conversation]').click();await page.getByRole('button',{name:'Start conversation',exact:true}).click();await page.locator('[data-start-dialogue]').waitFor();
await page.evaluate(async()=>{const{installConversationProvider}=await import('./js/conversations/runtime.js'),{createAIService}=await import('./js/ai/index.js');const senses=[{id:'coffee',lemma:'caffè',forms:['il caffè'],verified:true,source:'test-only-word',level:'A1'},{id:'tea',lemma:'tè',forms:['il tè'],verified:true,source:'test-only-word',level:'A1'}];const service=createAIService({grounding:{retrieve:()=>({version:'fixture',rules:[],senses})},languagePolicy:{version:'explicit-test-policy',validate:()=>({ok:true})},runtime:{generate:()=>JSON.stringify({participantId:'partner-1',text:'Preferisci un caffè o un tè?',corrections:[],replySupport:{prefix:'Vorrei un ',suffix:'.',choices:[{surface:'caffè',senseId:'coffee'},{surface:'tè',senseId:'tea'}]}})}});installConversationProvider({readiness:()=>({written:true}),acquire:()=>service,dispose:()=>service.dispose()});});
await page.locator('[data-start-dialogue]').click();await page.locator('[data-reply-choice]').first().waitFor();await page.locator('[data-voice]').click();await page.locator('[data-conversation-draft]').fill('Vorrei un caffè.');

const geometry=async()=>page.evaluate(()=>{
 const selectors=['[data-conversation-draft]','.conversation-send','[data-keyboard]'];
 return{height:innerHeight,width:innerWidth,scrollY,scrollWidth:document.documentElement.scrollWidth,messages:document.querySelector('.conversation-messages').getBoundingClientRect().height,
 controls:selectors.map(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{selector,top:r.top,bottom:r.bottom,left:r.left,right:r.right,hit:el===hit||el.contains(hit)};})};
});
for(const theme of ['dark','light'])for(const width of [375,390,430])for(const height of [430,480]){
 await page.evaluate(async theme=>{const{store}=await import('./js/store.js');store.setSetting('theme',theme);},theme);await page.setViewportSize({width,height});await page.locator('[data-conversation-draft]').focus();
 const measured=await geometry();assert.equal(measured.scrollY,0);assert(measured.scrollWidth<=width+1);assert(measured.messages>=60,'keep some conversation visible');
 for(const control of measured.controls){assert(control.top>=0&&control.bottom<=height+1,JSON.stringify(control));assert(control.left>=0&&control.right<=width+1,JSON.stringify(control));assert(control.hit,JSON.stringify(control));}
 for(const selector of ['[data-speech-close]','[data-reply-choice="0"]']){
  await page.locator(selector).scrollIntoViewIfNeeded();assert(await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&(hit===el||el.contains(hit));}),selector+' remains reachable inside help');
 }
 assert.equal(await page.evaluate(()=>scrollY),0);assert.equal(await page.locator('[data-conversation-draft]').inputValue(),'Vorrei un caffè.');assert.equal(await page.locator('.conversation-message.learner').count(),0);
 checks.push({theme,width,height,geometry:measured});console.log('PASS',theme,width+'x'+height,'reply help and voice controls keep composer reachable');
}
const url=page.url();await page.locator('[data-speech-close]').click();await page.reload();await page.waitForFunction(()=>document.querySelector('[data-conversation-draft]')?.value==='Vorrei un caffè.');assert.equal(page.url(),url);assert.equal(await page.locator('.conversation-message.learner').count(),0);assert.deepEqual(errors,[]);
console.log('PASS exact unsent draft survives compact controls and reload');
}finally{fs.writeFileSync(`docs/implementation/programme/conversation-compact-${name}.json`,JSON.stringify({browser:name,checks,errors,evidence:'Explicit test provider; viewport resizing is a compact layout check, not physical keyboard or model-quality validation.'},null,2)+'\n');await browser.close();stop();}
