// Real lesson actions at enlarged text and narrow zoom-equivalent reflow.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPlaywright,launchBrowser,ensureServer,boot,gotoRoute,reloadApp,contextOptions} from './lib.mjs';
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer(),engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium',browser=engine==='webkit'?await webkit.launch():await launchBrowser(chromium),results=[],errors=[];
async function scaleText(page,factor){
 // Snapshot every original computed value before changing any ancestor. Each
 // fixture has a fresh document, so scaling never accumulates between routes.
 await page.evaluate(factor=>{const elements=[...document.querySelectorAll('body *')].filter(e=>e.namespaceURI==='http://www.w3.org/1999/xhtml'&&e.getClientRects().length),original=elements.map(e=>{const s=getComputedStyle(e);return[e,parseFloat(s.fontSize),s.lineHeight];});for(const[e,font,line]of original){e.style.fontSize=font*factor+'px';if(line!=='normal')e.style.lineHeight=parseFloat(line)*factor+'px';}window.dispatchEvent(new Event('resize'));},factor);
 await page.waitForTimeout(100);
}
const saved=page=>page.evaluate(async()=>{const {store}=await import('./js/store.js');return{session:store.learning.session,events:store.learning.events,items:store.current.items,xp:store.current.stats.xp};});
async function fixture(page,theme,kind){
 await boot(page);
 const source=await page.evaluate(async({theme,kind})=>{const {store}=await import('./js/store.js'),{loadGrammarLesson}=await import('./js/learning/grammar-course.js'),{createCourseSession}=await import('./js/learning/course-v2-engine.js');store.setSetting('theme',theme);store.setSetting('tts',false);const lesson=await loadGrammarLesson('v2-f-name-polite'),session=createCourseSession(lesson),stepIndex=lesson.steps.findIndex(s=>s.kind==='portfolio');if(stepIndex<0)throw new Error('Expected the real first-contact portfolio');if(kind==='portfolio')session.courseV2.stepIndex=stepIndex;else{session.courseV2.stepIndex=lesson.steps.length;session.courseV2.phase='paused';session.courseV2.deferred=lesson.targets.map(t=>t.id);}store.saveLearningSession(session);await store.saveNow();return{id:lesson.id,sessionId:session.id,stepIndex,portfolioId:lesson.steps[stepIndex].id};},{theme,kind});
 await gotoRoute(page,'/learn/grammar/'+source.id);await page.locator('.grammar-footer .btn').first().waitFor();return source;
}
async function inspectButtons(page){
 const rows=[];
 for(const button of await page.locator('.grammar-footer .btn').all()){
  await button.scrollIntoViewIfNeeded();
  const row=await button.evaluate(e=>{const r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const text=range.getBoundingClientRect(),panel=e.closest('.grammar-footer').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{label:e.textContent.trim(),rect:r.toJSON(),text:text.toJSON(),hit:hit===e||e.contains(hit),whiteSpace:getComputedStyle(e).whiteSpace,textVisible:text.top>=Math.max(0,panel.top)-1&&text.bottom<=Math.min(innerHeight,panel.bottom)+1,clipped:text.left<r.left-1||text.right>r.right+1||text.top<r.top-1||text.bottom>r.bottom+1};});
  assert(!row.clipped,'Full action label must be visible: '+row.label);assert(row.textVisible,'The entire label fits the visible footer: '+row.label);assert(row.hit,'Action remains reachable after its panel scrolls: '+row.label);assert.equal(row.whiteSpace,'normal');rows.push(row);
 }
 assert(rows.length);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page-level horizontal scrolling');return rows;
}
try{
 for(const theme of ['dark','light'])for(const mode of [{name:'200-percent-text',viewport:{width:375,height:667},scale:2},{name:'zoom-equivalent-reflow',viewport:{width:320,height:225},scale:1}])for(const kind of ['portfolio','deferred-finish']){
  const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:mode.viewport,reducedMotion:'reduce'})),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  try{
   const source=await fixture(page,theme,kind),before=await saved(page);await scaleText(page,mode.scale);const controls=await inspectButtons(page);
   if(kind==='portfolio'){
    assert.equal(controls[0].label,'Continue without a response');await page.locator('[data-course-next]').click();const after=await saved(page);assert(after.session.courseV2.stepIndex>source.stepIndex);assert.deepEqual(after.events,before.events,'An empty portfolio adds no answer evidence');assert.equal(after.xp,before.xp);assert.deepEqual(after.items,before.items);
    // Return to an actual portfolio, save its draft, and reload. Layout changes
    // must not replace the selected step or manufacture consolidation credit.
    await gotoRoute(page,'/home');await reloadApp(page);await fixture(page,theme,'portfolio');await page.locator('[data-portfolio-draft]').fill('Questa è la mia bozza precisa.');await page.evaluate(async()=>{await(await import('./js/store.js')).store.saveNow();});const draft=await saved(page);await reloadApp(page);await page.locator('[data-portfolio-draft]').waitFor();assert.equal(await page.locator('[data-portfolio-draft]').inputValue(),'Questa è la mia bozza precisa.');assert.equal((await saved(page)).session.id,draft.session.id);assert.deepEqual((await saved(page)).events,draft.events);await scaleText(page,mode.scale);await inspectButtons(page);
   }else{
    assert(controls.some(c=>c.label==='Return to unfinished skills'));const next=page.locator('.grammar-footer a').filter({hasText:'Next lesson'}),href=await next.getAttribute('href');assert(href);await next.scrollIntoViewIfNeeded();await next.click();await page.waitForFunction(h=>location.hash===h,href);await page.locator('[data-course-lesson]').waitFor();const after=await saved(page);assert.deepEqual(after.events,before.events);assert.equal(after.xp,before.xp);assert.deepEqual(after.items,before.items);assert(await page.evaluate(async id=>Object.values((await import('./js/store.js')).store.learning.sessions).some(s=>s.id===id),source.sessionId),'The original deferred session remains resumable');
   }
   results.push({theme,mode:mode.name,viewport:mode.viewport,kind,lessonId:source.id,controls});console.log('PASS '+theme+' '+mode.name+' '+kind);
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`docs/implementation/programme/learning-text-reflow-${engine}.json`,JSON.stringify({date:'2026-10-03',engine,checks:results.length,results,errors,scope:'Controlled200% computed-font/line-height override and320×225 CSS reflow proxy for400% zoom of1280×900. Real authored lesson/controller/storage; not OS font settings, browser UI zoom, physical device or assistive-technology certification.'},null,2)+'\n');console.log(results.length+' '+engine+' lesson text/reflow checks passed.');
}finally{await browser.close();stop();}
