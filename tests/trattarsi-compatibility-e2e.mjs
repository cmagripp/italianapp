import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadPlaywright,launchBrowser,ensureServer,boot,gotoRoute,reloadApp,contextOptions} from './lib.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/trattarsi-compatibility-legacy.json',import.meta.url)));
const hash=value=>createHash('sha256').update(value).digest('hex');
for(const row of fixture.records)assert.equal(hash(JSON.stringify(row.descriptor)),row.descriptorSHA256);
assert.equal(fixture.records.filter(row=>row.descriptor===null).length,6,'The fixture records actual old absence, including available match recipes.');
const {chromium,webkit,devices}=await loadPlaywright(),stop=await ensureServer();
const engine=process.env.COURSE_BROWSER==='webkit'?'webkit':'chromium';
const browser=engine==='webkit'?await webkit.launch():await launchBrowser(chromium);
const context=await browser.newContext(contextOptions(devices['iPhone 13'],{viewport:{width:375,height:667},reducedMotion:'reduce'}));
const page=await context.newPage(),results=[],errors=[];
const counts={priorUsage:0,priorWrongUsage:0,priorMixedContext:0,priorParticiple:0,priorNull:0,retiredForms:0,currentFinite:0,fixedFeedback:0};
page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.stack||error.message));
const check=async(name,run)=>{
  try{await run();results.push(name);console.log('PASS',name);}
  catch(error){fs.writeFileSync(`/tmp/parola-trattarsi-${engine}-failure.json`,JSON.stringify({name,error:String(error),state:await saved(),html:await page.locator('#view').innerHTML(),text:await page.locator('#view').textContent(),errors},null,2)+'\n');throw error;}
};
const saved=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js');return {session:store.learning.session,events:structuredClone(store.learning.events),completions:structuredClone(store.learning.completions),xp:store.current.stats.xp};});
const noCredit=(after,before)=>{assert.deepEqual(after.events,before.events);assert.deepEqual(after.completions,before.completions);assert.equal(after.xp,before.xp);};
const href=source=>`/learn/verb/v%3Atrattarsi?session=${encodeURIComponent(source.id)}`;
const plain=html=>page.evaluate(html=>{const el=document.createElement('div');el.innerHTML=html;return el.textContent;},html);
async function seed({old=null,chapterId=old?.chapterId||'present',targetId=old?.targetId||'v:trattarsi::lesson::present::form-2',variant=old?.variant||0,format=old?.format||'type',phase=old?.phase||'independent',answered=false}={}){
  await gotoRoute(page,'/home');
  return page.evaluate(async opt=>{
    const {store}=await import('./js/store.js'),{getEntry}=await import('./js/data.js');
    const {buildLesson}=await import('./js/learning/lesson-content.js'),{buildJourneyQuestion}=await import('./js/learning/lesson-questions.js');
    const {createJourneySession,pinJourneyScene,currentJourneyStep}=await import('./js/learning/journey.js');
    store.setSetting('tts',false);store.setSetting('accentStrict',true);store.setSetting('adaptiveLearning',true);
    const entry=getEntry('v:trattarsi'),plan=buildLesson(entry,{questionBuilder:buildJourneyQuestion});
    const chapters=opt.old?(opt.old.ordinary?plan.questionHistory.ordinaryChapters:plan.questionHistory.chapters):plan.chapters;
    const chapter=chapters.find(c=>c.id===opt.chapterId),target=chapter.groups.flatMap(g=>g.targets).find(t=>t.id===opt.targetId);
    const session=createJourneySession({id:'trattarsi-browser-'+crypto.randomUUID(),plan,chapterId:chapter.id,caseMode:true});
    Object.assign(session.journey,{chapterId:chapter.id,phase:opt.phase==='guided'?'guided':'practice',groupIndex:chapter.groups.findIndex(g=>g.targets.includes(target)),serial:1,
      queue:chapter.groups.flatMap(g=>g.targets).filter(t=>t.id!==target.id).map(t=>t.id),current:{targetId:target.id,phase:opt.phase,format:opt.format,variant:opt.variant,
        questionId:session.id+':journey:1',supplemental:false,repairTag:null,...opt.old?.ordinary?{}:{scenePolicy:'expanded-v1'},questionRevision:opt.old?plan.questionHistory.previousRevision:plan.questionHistory.currentRevision}});
    if(opt.old?.ordinary)delete session.journey.verbFlowVersion;
    session.journey.variants[target.id]={guided:opt.phase==='guided'?opt.variant+1:0,independent:opt.phase==='independent'?opt.variant+1:0,repair:0};
    session.ui={version:2,questionId:session.journey.current.questionId,draft:'  exact prior trattarsi draft  ',given:opt.answered?'si è trattata':'',
      result:opt.answered?{ok:true,outcome:'correct',feedback:'Exact earlier accepted feminine response',components:[],errorTags:[]}:null,
      assistance:[],exposures:{},history:[],historyCursor:null,overview:false,caseDrafts:{},formDecks:{},historyReturnScroll:0,mapOpen:false,paused:false,visits:{}};
    if(opt.answered){
      const event={id:session.journey.current.questionId,sessionId:session.id,index:0,at:Date.now()-1000,objectiveId:target.id,targetId:target.id,entryId:entry.id,
        kind:'verb',skill:target.skill,tense:target.tense,person:target.person,role:target.role,policy:'journey-v1',contentVersion:plan.version,chapterId:chapter.id,
        mode:'production',activityKind:'independent',firstAttempt:true,ok:true,outcome:'correct',assistance:[],variantId:target.id+':old-form',contextId:target.id+':old-form',xp:0,countStats:false};
      store.recordLearningAttempt(event);session.index=1;session.answeredEventIds=[event.id];session.journey.awaitingContinue=true;
      session.journey.lastAttempt={id:event.id,targetId:target.id,variant:opt.variant,ok:true,outcome:'correct',errorTags:[]};
    }
    if(opt.old?.descriptor)session.journey.current.formSnapshot={version:1,entryId:entry.id,targetId:target.id,chapterId:chapter.id,sourceRevision:plan.questionHistory.previousRevision,
      scenePolicy:opt.old.ordinary?null:'expanded-v1',variant:opt.variant,format:opt.format,phase:opt.phase,repairTag:null,descriptor:opt.old.descriptor};
    const pinned=pinJourneyScene(plan,session);store.saveLearningSession(pinned);await store.saveNow();
    const step=currentJourneyStep(plan,pinned),q=step.type==='question'?buildJourneyQuestion(entry,step.chapter,step.target,{...step,questionHistory:plan.questionHistory}):null;
    return {id:pinned.id,questionId:pinned.journey.current.questionId,form:pinned.journey.current.formSnapshot||null,q,type:step.type,currentRevision:plan.questionHistory.currentRevision};
  },{old,chapterId,targetId,variant,format,phase,answered});
}
async function oldQuestion(old,{advance=false,wrong=false}={}){
  const source=await seed({old}),before=await saved();assert.equal(source.type,'question');assert.deepEqual(source.form.descriptor,old.descriptor);
  await gotoRoute(page,href(source));await page.locator('.journey-prompt').waitFor();
  assert.equal(await page.locator('.journey-prompt').textContent(),await plain(old.descriptor.prompt));noCredit(await saved(),before);
  await reloadApp(page);await page.locator('.journey-prompt').waitFor();const resumed=await saved();noCredit(resumed,before);
  assert.deepEqual(resumed.session.journey.current.formSnapshot,source.form);assert.equal(resumed.session.ui.draft,before.session.ui.draft);
  if(old.descriptor.type==='mc')await page.locator('[data-choice]').filter({hasText:wrong?'A general routine':old.descriptor.answer[0]}).click();
  else{await page.locator('[data-answer]').fill(old.descriptor.answer[0]);await page.locator('[data-check]').click();}
  await page.locator('[data-continue]').waitFor();const answered=await saved();assert.equal(answered.session.ui.result.ok,!wrong);
  if(old.targetId.endsWith('progressive-usage')){const event=answered.events[source.questionId];assert.equal(event.mode,'recognition');assert.equal(event.skill,'progressiveUsage');}
  await reloadApp(page);await page.locator('[data-continue]').waitFor();assert.deepEqual((await saved()).session.ui.result,answered.session.ui.result);noCredit(await saved(),answered);
  if(advance){
    await page.locator('[data-continue]').click();
    if(old.targetId.endsWith('progressive-usage')){
      await page.locator('.journey-intro').waitFor();const teaching=await saved();noCredit(teaching,answered);assert.equal(teaching.session.journey.phase,'teach');
      const recovery=teaching.session.sceneCorrectionRecovery.at(-1);assert.equal(recovery.reason,'prior-target-finished');assert.deepEqual(recovery.current,answered.session.journey.current);assert.deepEqual(recovery.journey,answered.session.journey);
      assert.deepEqual({...recovery.ui,history:answered.session.ui.history},answered.session.ui);assert.deepEqual(recovery.ui.history.slice(0,-1),answered.session.ui.history);
      assert.deepEqual(recovery.ui.history.at(-1).formSnapshot,source.form);assert.equal(recovery.ui.history.at(-1).given,answered.session.ui.given);
      // The newly appended Back page uses the existing bounded display shape;
      // the complete original result above remains exact in recovery.ui.result.
      const {errorTags,...displayResult}=answered.session.ui.result;
      assert.deepEqual(recovery.ui.history.at(-1).result,{...displayResult,accentIssue:displayResult.accentIssue===true,components:displayResult.components.map(c=>({skill:c.skill,ok:c.ok}))});
      for(let step=0;step<8&&!(await page.locator('.journey-prompt').count());step++){await page.locator('[data-continue]').click();noCredit(await saved(),answered);}
    }
    if(old.chapterId==='mixed'){
      // These archived cursors have no completed source case. Continue must
      // recap safely instead of enrolling further mixed questions from it.
      await page.locator('.journey-recap').waitFor();const next=await saved();noCredit(next,answered);
      assert.equal(next.session.journey.phase,'recap');assert.equal(next.session.journey.current,null);
      assert.equal(await page.locator('[data-answer], [data-check], [data-choice], [data-pair-left], [data-answer-audio]').count(),0);
    }else{
      await page.locator('.journey-prompt').waitFor();const next=await saved();noCredit(next,answered);
      assert.notEqual(next.session.journey.current.questionId,source.questionId);assert.equal(next.session.journey.current.formSnapshot.sourceRevision,source.currentRevision);
    }
    let found=false;
    for(let step=0;step<10;step++){
      await page.locator('[data-lesson-back]').click();await page.locator('.journey-history-banner').waitFor();const history=await saved();
      if(history.session.ui.history[history.session.ui.historyCursor]?.questionId===source.questionId){found=true;break;}
    }
    assert(found,'The exact prior answer remains available through Back after the new teaching pages.');assert.equal(await page.locator('.journey-prompt').textContent(),await plain(old.descriptor.prompt));
    await reloadApp(page);await page.locator('.journey-history-banner').waitFor();noCredit(await saved(),answered);
  }
}
try{
  await boot(page);
  await check('Both ordinary progressive-usage chapters retain their exact old available prompts, choices and saved feedback',async()=>{
    for(const old of fixture.records.filter(r=>r.targetId.endsWith('progressive-usage'))){await oldQuestion(old,{advance:old.variant===0});counts.priorUsage++;}
  });
  await check('Incorrect old-only usage feedback also archives exactly before current teaching, without fabricating repair credit',async()=>{
    for(const old of fixture.records.filter(r=>r.targetId.endsWith('progressive-usage')&&r.variant===0)){await oldQuestion(old,{advance:true,wrong:true});counts.priorWrongUsage++;}
  });
  await check('Ordinary and expanded mixed background retain exact old context/cue and Back/reload receipt',async()=>{
    for(const old of fixture.records.filter(r=>r.chapterId==='mixed'&&r.format==='type'&&r.descriptor)){assert.equal(old.descriptor.context.it,'Si trattava di un semplice malinteso.');assert.match(old.descriptor.prompt,/lui\/lei/);await oldQuestion(old,{advance:old.variant===0});counts.priorMixedContext++;}
  });
  await check('Valid old guided participle shapes remain exact and answerable under both old policies',async()=>{
    for(const old of fixture.records.filter(r=>r.targetId.endsWith('participle-part'))){await oldQuestion(old);counts.priorParticiple++;}
  });
  await check('All six actual old-null recipes stay unavailable without materializing a new question or losing saved state',async()=>{
    for(const old of fixture.records.filter(r=>r.descriptor===null)){
      const source=await seed({old}),before=await saved();assert.equal(source.form,null);assert.equal(source.type,'unavailable');
      await gotoRoute(page,href(source));await page.getByText('This saved lesson cannot open yet',{exact:true}).waitFor();
      assert.equal(await page.locator('[data-answer], [data-check], [data-choice], [data-continue], [data-pair-left], [data-answer-audio]').count(),0);
      await reloadApp(page);await page.getByText('This saved lesson cannot open yet',{exact:true}).waitFor();const after=await saved();noCredit(after,before);
      assert.deepEqual(after.session.journey.current,before.session.journey.current);assert.deepEqual(after.session.ui,before.session.ui);assert.equal(after.session.id,before.session.id);counts.priorNull++;
    }
  });
  await check('Previously accepted feminine compound receipts are preserved until explicit corrected Continue',async()=>{
    for(const old of fixture.records.filter(r=>r.targetId.endsWith('::past::form-2'))){
      assert(old.descriptor.answer.includes('si è trattata'));const source=await seed({old,answered:true}),before=await saved();assert.equal(source.type,'corrected');
      await gotoRoute(page,href(source));await page.getByText('This example has been corrected',{exact:true}).waitFor();assert.equal(await page.locator('[data-answer], [data-check], [data-answer-audio]').count(),0);
      await reloadApp(page);await page.getByText('This example has been corrected',{exact:true}).waitFor();const pending=await saved();noCredit(pending,before);assert.deepEqual(pending.session.ui,before.session.ui);
      await page.locator('[data-continue]').click();await page.locator('.journey-prompt').waitFor();const after=await saved();noCredit(after,before);
      const recovery=after.session.sceneCorrectionRecovery.at(-1);assert.deepEqual(recovery.current,before.session.journey.current);assert.deepEqual(recovery.journey,before.session.journey);assert.deepEqual(recovery.ui,before.session.ui);
      assert.notEqual(after.session.journey.current.questionId,source.questionId);assert.equal(after.session.index,before.session.index);assert.deepEqual(after.session.answeredEventIds,before.session.answeredEventIds);assert.equal(after.session.journey.current.formSnapshot.sourceRevision,source.currentRevision);counts.retiredForms++;
    }
  });
  await check('Every core current finite case and both cue variants identify the impersonal construction',async()=>{
    for(const chapterId of ['present','past','background','future','condizionale'])for(const variant of [0,1]){
      const source=await seed({chapterId,targetId:`v:trattarsi::lesson::${chapterId}::form-2`,variant});await gotoRoute(page,href(source));await page.locator('[data-answer]').waitFor();
      const prompt=await page.locator('.journey-prompt').textContent();assert.match(prompt,/impersonal: si tratta di/);assert(!prompt.includes('lui/lei'));
      await page.locator('[data-answer]').fill(source.q.answer[0]);await page.locator('[data-check]').click();await page.locator('[data-continue]').waitFor();assert.equal((await saved()).session.ui.result.ok,true);counts.currentFinite++;
    }
  });
  await check('Current compound and participle feedback explain fixed trattato instead of inventing feminine agreement',async()=>{
    const source=await seed({chapterId:'past',targetId:'v:trattarsi::lesson::past::form-2'});await gotoRoute(page,href(source));await page.locator('[data-answer]').waitFor();
    assert.deepEqual(source.q.answer,['si è trattato']);await page.locator('[data-answer]').fill('si è trattata');await page.locator('[data-check]').click();await page.locator('[data-continue]').waitFor();
    const feedbackCheck=async()=>{
      const answered=await saved();assert.equal(answered.session.ui.result.ok,false);const feedback=await page.locator('.journey-feedback').textContent();assert.match(feedback,/keep the participle masculine singular: trattato/);assert.match(feedback,/word after di does not control its ending/);assert(!feedback.includes('match the participle to the subject: masculine/feminine'));
      await reloadApp(page);await page.locator('[data-continue]').waitFor();assert.deepEqual((await saved()).session.ui.result,answered.session.ui.result);noCredit(await saved(),answered);counts.fixedFeedback++;
    };
    await feedbackCheck();
    // Follow the real failed attempt through its teaching page and targeted
    // repair, rather than synthesizing a scaffold that the engine never chose.
    await page.locator('[data-continue]').click();await page.locator('[data-continue]').click();
    await page.locator('.journey-prompt').waitFor();const repair=await saved();assert.equal(repair.session.journey.current.phase,'repair');assert.equal(repair.session.journey.current.repairTag,'agreement');assert.deepEqual(repair.session.journey.current.formSnapshot.descriptor.answer,['o']);
    if(await page.locator('[data-choice]').count()){
      const index=await page.locator('[data-choice]').evaluateAll(buttons=>buttons.find(button=>button.querySelector('.journey-choice-label')?.textContent.trim()==='a')?.dataset.choice);assert.notEqual(index,undefined);await page.locator(`[data-choice="${index}"]`).click();
    }else{await page.locator('[data-answer]').fill('a');await page.locator('[data-check]').click();}
    await page.locator('[data-continue]').waitFor();await feedbackCheck();
  });
  assert.deepEqual(errors,[]);
  const sources=['js/learning/lesson-content.js','js/learning/lesson-questions.js','js/learning/diagnose.js','js/learning/journey-form.js','js/learning/journey.js','js/views/learnJourney.js','js/learning/verb-question-history-data.js'];
  fs.writeFileSync(new URL(`../docs/implementation/programme/trattarsi-compatibility-${engine}.json`,import.meta.url),JSON.stringify({date:'2026-10-04',engine,status:'passed',checks:results.length,results,counts,baseline:fixture.baseline,
    fixtureRecords:fixture.records.length,sourceSHA256:Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(new URL('../'+p,import.meta.url)))])),fixtureSHA256:hash(fs.readFileSync(new URL('./fixtures/trattarsi-compatibility-legacy.json',import.meta.url))),testSHA256:hash(fs.readFileSync(new URL('./trattarsi-compatibility-e2e.mjs',import.meta.url))),errors,
    scope:'Bounded archived recipe/actual route/controller/local persistence checks with synthetic learners. No whole-catalogue linguistic, native-human or release claim.'},null,2)+'\n');
  console.log(results.length+' '+engine+' trattarsi compatibility browser checks passed. '+JSON.stringify(counts));
}finally{await context.close();await browser.close();stop();}
