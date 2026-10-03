import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions,boot,gotoRoute} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium';
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),checks=[],errors=[];
const context=await browser.newContext(contextOptions(undefined,{viewport:{width:390,height:664},reducedMotion:'reduce'})),page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
const check=async(name,run)=>{await run();checks.push(name);console.log('PASS',name);};
const sheet=()=>page.locator('.sheet-wrap.open [role=dialog]');
const focusMatches=selector=>page.waitForFunction(selector=>document.activeElement?.matches(selector),selector);
async function menu(selector){await page.locator(selector).focus();await page.keyboard.press('Enter');await page.locator('.dropdown-layer[data-active]').waitFor();await focusMatches('.dropdown [data-value]');}
async function newSetup(){await gotoRoute(page,'/conversations');await page.locator('[data-new-conversation]').focus();await page.keyboard.press('Enter');await sheet().waitFor();await focusMatches('.sheet-wrap.open [role=dialog]');}
try{
 await boot(page);
 for(const theme of ['dark','light']){
  await page.evaluate(async theme=>{const{store}=await import('./js/store.js');store.setSetting('theme',theme);store.setSetting('gender','m');store.setSetting('tts',false);},theme);
  await check(`${theme}: Workshop agreement selection returns focus to its replacement control`,async()=>{
   await gotoRoute(page,'/lab/frasi/sl-presente-01-chi-sono');await page.locator('[data-lab-agreement]').waitFor();
   const before=await page.evaluate(async()=>{const{store}=await import('./js/store.js');return{events:store.learning.events,xp:store.current.stats.xp};});
   const next=(await page.locator('[data-lab-agreement]').getAttribute('aria-label')).includes('feminine')?'masculine':'feminine';
   await menu('[data-lab-agreement]');await page.keyboard.press(next==='feminine'?'End':'Home');await page.keyboard.press('Enter');await focusMatches('[data-lab-agreement]');
   assert((await page.locator('[data-lab-agreement]').getAttribute('aria-label')).includes(next));assert.equal(await page.locator('.dropdown-layer[data-active]').count(),0);
   const after=await page.evaluate(async()=>{const{store}=await import('./js/store.js');return{events:store.learning.events,xp:store.current.stats.xp};});assert.deepEqual(after,before);
  });
  await check(`${theme}: Conversation setup selection retains its trigger and unfinished name`,async()=>{
   await newSetup();await sheet().getByRole('textbox',{name:'Your name'}).fill('Ada');await menu('[data-setting="level"]');await page.keyboard.press('End');await page.keyboard.press('Enter');await focusMatches('[data-setting="level"]');assert.match(await page.locator('[data-setting="level"]').innerText(),/C2/);assert.equal(await sheet().getByRole('textbox',{name:'Your name'}).inputValue(),'Ada');
  });
  await check(`${theme}: Escape dismisses only the menu; Tab closes it and resumes the sheet`,async()=>{
   await menu('[data-setting="agreement"]');await page.keyboard.press('Escape');await focusMatches('[data-setting="agreement"]');assert.equal(await sheet().count(),1);assert.equal(await page.locator('#view').evaluate(e=>e.inert),true);
   await menu('[data-setting="level"]');await page.keyboard.press('Tab');await focusMatches('[data-setting="topic"]');assert.equal(await page.locator('.dropdown-layer[data-active]').count(),0);assert.equal(await sheet().count(),1);
   await menu('[data-setting="level"]');await page.keyboard.press('Shift+Tab');await focusMatches('[data-setting="mode"]');assert.equal(await page.locator('.dropdown-layer[data-active]').count(),0);
  });
  await check(`${theme}: Partner count remains keyboard reachable at both limits`,async()=>{
   await page.locator('[data-count="1"]').focus();await page.keyboard.press('Enter');await focusMatches('[data-count="1"]');await page.keyboard.press('Enter');await focusMatches('[data-count="-1"]');assert.equal(await page.locator('[data-count="1"]').isDisabled(),true);
   await page.keyboard.press('Enter');await focusMatches('[data-count="-1"]');await page.keyboard.press('Enter');await focusMatches('[data-count="1"]');assert.equal(await page.locator('[data-count="-1"]').isDisabled(),true);
  });
  await check(`${theme}: Sheet traps first and last focus and returns to its opener`,async()=>{
   await sheet().locator('[type=submit]').focus();await page.keyboard.press('Tab');await focusMatches('.conversation-name input[name=name]');await page.keyboard.press('Shift+Tab');await focusMatches('.conversation-setup [type=submit]');await page.keyboard.press('Escape');await focusMatches('[data-new-conversation]');assert.equal(await page.locator('#view').evaluate(e=>e.inert),false);
  });
 }
 await check('Shared prompt inputs are named and an early cancellation cannot refocus a closed dialog',async()=>{
  await page.locator('[data-new-conversation]').focus();
  await page.evaluate(async()=>{const{promptDialog}=await import('./js/ui.js');window.firstPrompt='pending';void promptDialog('Add a note').then(value=>{window.firstPrompt=value;});});
  await sheet().getByRole('textbox',{name:'Add a note',exact:true}).waitFor();
  await page.evaluate(()=>{window.closedPromptFocus=0;document.querySelector('.sheet-wrap.open input').addEventListener('focus',()=>window.closedPromptFocus++);});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.firstPrompt===null);await focusMatches('[data-new-conversation]');
  await page.evaluate(async()=>{const{promptDialog}=await import('./js/ui.js');window.secondPrompt='pending';void promptDialog('Rename conversation',{value:'A chat'}).then(value=>window.secondPrompt=value);});
  const input=sheet().getByRole('textbox',{name:'Rename conversation',exact:true});await input.waitFor();await focusMatches('input[aria-label="Rename conversation"]');
  assert.equal(await page.evaluate(()=>window.closedPromptFocus),0);await input.fill('At the café');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.secondPrompt==='At the café');await focusMatches('[data-new-conversation]');
 });
 await check('Shared modal focus skips unavailable controls and resumes the parent after a nested sheet',async()=>{
  await page.locator('[data-new-conversation]').focus();
  await page.evaluate(async()=>{const{sheet}=await import('./js/ui.js');window.keyboardParent=sheet('<button data-first>First</button><button hidden>Hidden</button><button disabled>Disabled</button><button style="visibility:hidden">Invisible</button><details><summary>Details</summary><a href="#/home" data-detail>Inside details</a></details><button data-last>Last</button>',{title:'Keyboard fixture'});});
  await focusMatches('.sheet-wrap.open [role=dialog]');await page.keyboard.press('Tab');await focusMatches('[data-first]');await page.keyboard.press('Tab');await focusMatches('summary');await page.keyboard.press('Tab');await focusMatches('[data-last]');
  await page.keyboard.press('Shift+Tab');await focusMatches('summary');await page.keyboard.press('Enter');await page.keyboard.press('Tab');await focusMatches('[data-detail]');await page.keyboard.press('Tab');await focusMatches('[data-last]');
  await page.evaluate(async()=>{const{sheet}=await import('./js/ui.js');window.keyboardChild=sheet('<button data-child-first>One</button><button data-child-last>Two</button>',{title:'Nested keyboard fixture'});});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Nested keyboard fixture');assert.equal(await page.getByRole('dialog',{name:'Keyboard fixture',exact:true}).evaluate(e=>e.inert),true);
  await page.keyboard.press('Tab');await focusMatches('[data-child-first]');await page.keyboard.press('Shift+Tab');await focusMatches('[data-child-last]');await page.keyboard.press('Escape');await focusMatches('[data-last]');
  assert.equal(await page.getByRole('dialog',{name:'Keyboard fixture',exact:true}).evaluate(e=>e.inert),false);await page.keyboard.press('Escape');await focusMatches('[data-new-conversation]');
 });
 await check('Shared sheets preserve native radio-group navigation and skip disabled fieldsets',async()=>{
  await page.evaluate(async()=>{const{sheet}=await import('./js/ui.js');sheet('<button data-radio-before>Before</button><fieldset disabled><button data-disabled-field>Unavailable</button></fieldset><fieldset><legend>Practice format</legend><label><input type="radio" name="format" value="choice" data-radio-choice>Choices</label><label><input type="radio" name="format" value="match" data-radio-match checked>Matching</label><label><input type="radio" name="format" value="cards">Cards</label></fieldset><button data-radio-after>After</button>',{title:'Practice format fixture'});});
  await focusMatches('.sheet-wrap.open [role=dialog]');await page.keyboard.press('Tab');await focusMatches('[data-radio-before]');await page.keyboard.press('Tab');await focusMatches('[data-radio-match]');await page.keyboard.press('Tab');await focusMatches('[data-radio-after]');await page.keyboard.press('Shift+Tab');await focusMatches('[data-radio-match]');await page.keyboard.press('ArrowLeft');await focusMatches('[data-radio-choice]');assert(await page.locator('[data-radio-choice]').isChecked());await page.keyboard.press('Tab');await focusMatches('[data-radio-after]');await page.keyboard.press('Escape');await focusMatches('[data-new-conversation]');
 });
 assert.deepEqual(errors,[]);
}finally{
 fs.writeFileSync(`docs/implementation/programme/keyboard-accessibility-${name}.json`,JSON.stringify({environment:name,checks,errors,limits:['Browser keyboard and DOM accessibility checks, not a VoiceOver or physical-device validation.','No production model or microphone runtime involved.']},null,2)+'\n');
 await browser.close();stop();
}
