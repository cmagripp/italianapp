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
 await check('Game submission visibly restores only accents and exposes original',async()=>{
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setSetting('accentStrict',false);store.setSetting('tts',false);const {runDrill}=await import('./js/games/engine.js');globalThis.__accentCleanup=runDrill(document.querySelector('#view'),[{type:'type',prompt:'A coffee, please.',answer:['Un caffè, per favore!']}],{title:'Accent test',gameId:'typing',record:false});});
  await page.locator('[data-answer]').fill('Un CAFFE, per favore!');await page.locator('[data-check]').click();
  assert.equal(await page.locator('[data-answer]').inputValue(),'Un CAFFÈ, per favore!');
  assert.equal(await page.locator('[data-feedback-state="correct"]').count(),1);
  await page.locator('.submission-note summary').click();assert.match(await page.locator('.submission-note').innerText(),/As typed: Un CAFFE, per favore!/);
  await page.evaluate(()=>globalThis.__accentCleanup?.destroy());
 });
 let seeded;
 await check('Course feedback keeps corrected field and original after reload and setting change',async()=>{
  seeded=await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{loadGrammarCourse,loadGrammarStage,loadGrammarLesson,grammarCourse}=await import('./js/learning/grammar-course.js'),{createCourseSession}=await import('./js/learning/course-v2-engine.js');await loadGrammarCourse();await loadGrammarStage('A1');const selected=grammarCourse.lessons.find(l=>l.steps?.some(q=>q.kind==='question'&&q.format==='type'&&/[àèéìòù]/i.test(q.answer)));const l=await loadGrammarLesson(selected.id);const i=l.steps.findIndex(q=>q.kind==='question'&&q.format==='type'&&/[àèéìòù]/i.test(q.answer));const q=l.steps[i],s=createCourseSession(l);s.courseV2.stepIndex=i;store.setSetting('accentStrict',false);store.saveLearningSession(s);await store.saveNow();return {id:l.id,answer:q.answer,typed:q.answer.normalize('NFD').replace(/[\u0300-\u036f]/g,'')};});
  await gotoRoute(page,'/learn/grammar/'+seeded.id);await page.locator('[data-course-input]').fill(seeded.typed);await page.locator('[data-check-course]').click();assert.equal(await page.locator('[data-course-input]').inputValue(),seeded.answer);assert.equal(await page.locator('[data-feedback-state="correct"]').count(),1);
  const before=await page.evaluate(async()=>{const {store}=await import('./js/store.js');store.setSetting('accentStrict',true);await store.saveNow();return {events:Object.keys(store.learning.events).length,xp:store.current.stats.xp};});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-feedback-state="correct"]');assert.equal(await page.locator('[data-course-input]').inputValue(),seeded.answer);
  const after=await page.evaluate(async()=>{const {store}=await import('./js/store.js');return {events:Object.keys(store.learning.events).length,xp:store.current.stats.xp};});assert.deepEqual(after,before);
  await page.locator('.submission-note summary').click();assert.match(await page.locator('.submission-note').innerText(),/As typed:/);
 });
 await check('Strict typed answers remain unchanged and incorrect',async()=>{
  await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{grammarLesson}=await import('./js/learning/grammar-course.js'),{createCourseSession}=await import('./js/learning/course-v2-engine.js');const old=store.learning.session,l=grammarLesson(old.entryId),s=createCourseSession(l);s.courseV2.stepIndex=old.courseV2.stepIndex;store.saveLearningSession(s);await store.saveNow();});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-course-input]');await page.locator('[data-course-input]').fill(seeded.typed);await page.locator('[data-check-course]').click();assert.equal(await page.locator('[data-course-input]').inputValue(),seeded.typed);assert.equal(await page.locator('[data-feedback-state="incorrect"]').count(),1);
 });
 await check('Save failure remains visible without covering Continue and clears on retry',async()=>{
  await page.evaluate(async()=>{const {store}=await import('./js/store.js');await store.saveNow();store._failedSave(new Error('Storage is full.'),store.current.id);});
  assert.equal(await page.locator('#save-status').isVisible(),true);
  const layout=await page.evaluate(()=>({banner:document.querySelector('#save-status').getBoundingClientRect().toJSON(),next:document.querySelector('[data-course-next]').getBoundingClientRect().toJSON(),height:innerHeight}));assert(layout.next.top>=layout.banner.bottom);assert(layout.next.bottom<=layout.height+1);
  await page.getByRole('button',{name:'Retry save',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#save-status').hidden);
 });
 await check('Feedback actions remain reachable with enlarged text and a reduced viewport',async()=>{
  const sizes=await page.evaluate(()=>[...document.querySelectorAll('#view h1,#view p,#view button,#view small')].map(el=>[el,getComputedStyle(el).fontSize]).map(([el,size])=>{el.dataset.testFont=el.style.fontSize;el.style.fontSize=(parseFloat(size)*2)+'px';return size;}));
  assert(sizes.length>0);
  await page.setViewportSize({width:440,height:556});
  await page.evaluate(async()=>{const {toast}=await import('./js/ui.js');toast('Your answer is saved.');});
  await page.waitForTimeout(200);
  const next=page.locator('[data-course-next]');await next.scrollIntoViewIfNeeded();
  const boxes=await page.evaluate(()=>({next:document.querySelector('[data-course-next]').getBoundingClientRect().toJSON(),toast:document.querySelector('#toast').getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight}));
  assert(boxes.next.left>=0&&boxes.next.right<=boxes.width+1);assert(boxes.next.top>=0&&boxes.next.bottom<=boxes.height+1);
  assert(boxes.toast.bottom<=boxes.next.top||boxes.toast.top>=boxes.next.bottom,'Toast covers Continue');
  assert.match(await page.locator('meta[name="viewport"]').getAttribute('content'),/width=device-width/);
  assert.doesNotMatch(await page.locator('meta[name="viewport"]').getAttribute('content'),/maximum-scale=1|user-scalable=no/);
  await page.evaluate(()=>{document.querySelectorAll('[data-test-font]').forEach(el=>{el.style.fontSize=el.dataset.testFont;delete el.dataset.testFont;});});
  await page.setViewportSize({width:440,height:956});
 });
 await check('Reference explanations preserve accented noun endings',async()=>{
  await gotoRoute(page,'/reference/w:caffè|noun');assert.match(await page.locator('#view').innerText(),/accented vowel|stressed vowel/);assert.doesNotMatch(await page.locator('#view').innerText(),/Nouns in -e can be either/);
  await gotoRoute(page,'/reference/w:città|noun');assert.match(await page.locator('#view').innerText(),/Nouns in -tà/);
 });
 await check('Learn resume title and destination name the same active verb',async()=>{
  await gotoRoute(page,'/learn/verb/v:mangiare?chapter=present');await page.waitForSelector('[data-journey]');
  await gotoRoute(page,'/learn');assert.equal(await page.locator('[data-hero] [data-title]').innerText(),'mangiare');assert.match(await page.locator('[data-hero] [data-start]').getAttribute('href'),/v%3Amangiare/);
 });
 assert.deepEqual(errors,[]);console.log(`${results.length} accent browser checks passed.`);
}finally{fs.writeFileSync(new URL('./report-accent-policy.json',import.meta.url),JSON.stringify({results,errors},null,2));await browser.close();stop();}
