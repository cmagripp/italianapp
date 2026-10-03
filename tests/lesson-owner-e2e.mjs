// Old lesson callbacks must not write into a replacement learner or reset epoch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions,boot} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),browser=process.env.COURSE_BROWSER==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions()),page=await context.newPage(),results=[];
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
async function snapshot(){return page.evaluate(async()=>{const {store}=await import('./js/store.js');return {learner:store.current.learnerId,epoch:store.learning.epoch.id,events:store.learning.events,sessions:store.learning.sessions,xp:store.current.stats.xp,lab:store.current.lab};});}
async function change(kind){await page.evaluate(async kind=>{const {store}=await import('./js/store.js');if(kind==='reset')await store.resetProgress();else{const profile=structuredClone(store.current);profile.learnerId=crypto.randomUUID();await store.importJSON(JSON.stringify({profile}));}},kind);}
async function course(){await boot(page);await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{loadGrammarLesson}=await import('./js/learning/grammar-course.js'),{createCourseSession}=await import('./js/learning/course-v2-engine.js');store.setSetting('tts',false);const lesson=await loadGrammarLesson('v2-f-greet'),session=createCourseSession(lesson,{learning:store.learning});session.courseV2.stepIndex=lesson.steps.findIndex(s=>s.kind==='question'&&s.format==='choice');store.saveLearningSession(session);await store.saveNow();location.hash='#/learn/grammar/v2-f-greet';});await page.locator('[data-choice]').first().waitFor();}
async function workshop(){await page.goto(BASE+'#/lab/frasi/sl-presente-01-chi-sono');await page.locator('[data-lab-lesson]').waitFor();}
try{
 for(const kind of ['reset','replacement']){
  await check(`A course answer cannot record into a ${kind} learner state`,async()=>{await course();await page.evaluate(()=>window.oldLessonButton=document.querySelector('[data-choice]'));await change(kind);const before=await snapshot();await page.evaluate(()=>oldLessonButton.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.deepEqual(await snapshot(),before);});
  await check(`A workshop continuation cannot advance a ${kind} learner state`,async()=>{await workshop();await page.evaluate(()=>window.oldLessonButton=document.querySelector('[data-lab-next]'));assert.equal(await page.evaluate(()=>!!oldLessonButton),true);await change(kind);const before=await snapshot();await page.evaluate(()=>oldLessonButton.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.deepEqual(await snapshot(),before);});
 }
}finally{fs.writeFileSync(`docs/implementation/programme/lesson-owner-${process.env.COURSE_BROWSER||'chromium'}.json`,JSON.stringify({checks:results},null,2));await context.close();await browser.close();stop();}
