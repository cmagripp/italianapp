#!/usr/bin/env node
// Review regressions: visible original spelling and late legacy adaptive continuations.
import assert from 'node:assert/strict';
import {loadPlaywright,launchBrowser,contextOptions,ensureServer,boot} from './lib.mjs';
const {chromium,devices}=await loadPlaywright(),stop=await ensureServer(),browser=await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'])),page=await context.newPage();
try{
  await boot(page);
  const note=await page.evaluate(async()=>{
    const {store}=await import('./js/store.js'),root=document.querySelector('#view'),walk=await import('./js/views/walkthrough.js');
    store.setSetting('tts',false);store.setSetting('accentStrict',false);root.innerHTML='<div id="followup"></div>';
    walk.renderCheck(root.firstElementChild,{type:'type',answer:['caffè'],prompt:'Coffee'});
    root.querySelector('[data-answer]').value='caffe';root.querySelector('[data-check]').click();
    return root.querySelector('.submission-note')?.textContent||'';
  });
  assert.match(note,/As typed: caffe/);assert.match(note,/Written Italian: caffè/);
  console.log('✓ Walkthrough restores accents and retains visible original spelling.');
  for(const mode of ['dispose','replace-learner','reset-epoch']){
    const result=await page.evaluate(async mode=>{
      const {store}=await import('./js/store.js'),root=document.querySelector('#view'),{render}=await import('./js/views/learnAdaptive.js');
      delete store.learning.sessions['w:casa|noun|lesson'];store.learning.session=null;
      const dispose=await render(root,{id:'w:casa|noun'},{legacy:'1'});root.querySelector('[data-start]')?.click();
      const old=store.learning.session.id,owner=store.current.id,learner=store.current.learnerId,epoch=store.learning.epoch.id;
      const original=store.recordLearningAttempt.bind(store);let recordedId;
      store.recordLearningAttempt=input=>{
        const out=original(input);recordedId=out.event.id;
        queueMicrotask(()=>{
          if(mode==='dispose')dispose();
          if(mode==='replace-learner')store.current.learnerId='review-replacement-learner';
          if(mode==='reset-epoch')store.learning.epoch.id='review-replacement-epoch';
          const replacement=structuredClone(store.learning.session);replacement.id='review-replacement-session';store.saveLearningSession(replacement);
        });
        return out;
      };
      const choice=root.querySelector('[data-choice]');
      if(choice)choice.click();else{root.querySelector('[data-answer]').value='casa';root.querySelector('[data-answer-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
      await new Promise(r=>setTimeout(r,0));
      const result={old,current:store.learning.session.id,owner,profile:store.current.id,hasRecorded:!!store.learning.events[recordedId]};
      store.recordLearningAttempt=original;
      if(mode!=='dispose')dispose();
      result.afterDispose=store.learning.session.id;
      store.current.learnerId=learner;store.learning.epoch.id=epoch;
      return result;
    },mode);
    assert.equal(result.current,'review-replacement-session',mode);assert.equal(result.afterDispose,'review-replacement-session','cleanup cannot replace the newer session');assert.equal(result.hasRecorded,true,'the submitted event remains recorded');assert.equal(result.profile,result.owner,'same local slot');
    console.log(`✓ Late adaptive answer cannot save after ${mode}.`);
  }
}finally{await context.close();await browser.close();stop();}
