import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions,boot,gotoRoute} from './lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium';
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),checks=[],errors=[];let context,page,passed=false;
const check=async(label,run)=>{await run();checks.push(label);console.log('PASS',label);};
const sheet=()=>page.locator('.sheet-wrap.open').getByRole('dialog',{name:/Help me say it|A little help/});
async function fresh(){
 await context?.close();context=await browser.newContext(contextOptions(undefined,{viewport:{width:430,height:932},reducedMotion:'reduce'}));
 await context.addInitScript(()=>{
  window.helpSpeech=[];Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;}}});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices(){return[];},addEventListener(){},removeEventListener(){},speak(call){helpSpeech.push(call.text);}}});
 });
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await boot(page);
}
async function provider(reply='inglese',delay=false){
 await page.evaluate(async({reply,delay})=>{
  const {createPracticeSourceResolver}=await import('./js/learning/practice-sources.js');const {createAIService,createGrounding}=await import('./js/ai/index.js'),runtime=await import('./js/conversations/runtime.js');
  window.helpRequests=[];window.helpGroundings=[];window.helpReply=reply;window.helpDelay=delay;window.helpAcquires=0;
  // Explicit fixture for service/lifecycle tests, never bundled or installed in
  // the production app. It supplies no evidence about a real model's quality.
  const grounding=createGrounding({rules:[{id:'test-only-help-rule',verified:true,level:'Foundations',explanation:'This is an authored test reference, not generated teaching.',examples:['Ciao.'],source:'https://example.test/authored-rule',keywords:['test-reference']}],version:'test-only-grounding'});
  window.helpService=createAIService({grounding,practiceSources:createPracticeSourceResolver(),languagePolicy:{version:'test-only-language-policy',async validate(text,context){helpGroundings.push(context.grounding);return{ok:true};}},runtime:{async generate(task){
   helpRequests.push(task);if(helpDelay)await new Promise(resolve=>window.releaseHelp=resolve);
   return JSON.stringify({participantId:'helper',text:helpReply,corrections:[]});
  }}});
  window.removeHelpProvider=runtime.installConversationProvider({readiness:()=>({written:true,recorded:false,handsfree:false}),acquire:async()=>{helpAcquires++;return helpService;}});
 },{reply,delay});
}
async function lab(id='sl-presente-01-chi-sono',index=4,agreement='m',turnIndex=null){
 await page.evaluate(async({id,index,agreement,turnIndex})=>{
  const {store}=await import('./js/store.js'),lab=await import('./js/learning/sentence-lab-data.js'),engine=await import('./js/learning/sentence-lab.js');await lab.loadSentenceLab();
  const lesson=lab.labLesson(id),session=engine.createLabSession(lesson);session.index=index;session.speakerAgreement=agreement;
  session.state=null;engine.currentLabStep(lesson,session);if(turnIndex!==null)session.state.turnIndex=turnIndex;session.state.ui={touched:true};lab.writeLabSession(store,session);await store.saveNow();
 },{id,index,agreement,turnIndex});await gotoRoute(page,'/lab/frasi/'+id);await page.locator('[data-lab-controls]').waitFor();
}
async function course(kind='choice',legacy=false){
 const id=await page.evaluate(async({kind,legacy})=>{
  const {store}=await import('./js/store.js'),content=await import('./js/learning/grammar-course.js');
  await content.loadGrammarCourse();let lesson;
  if(legacy){await content.loadGrammarStage('A1',{legacy:true});lesson=content.grammarCourse.legacyLessons.find(l=>l.level==='A1'&&l.objectives[0].questions.some(q=>q.format===kind));
   const {createGrammarSession}=await import('./js/learning/grammar-journey.js'),session=createGrammarSession(lesson,{mode:'review'});session.grammar.questionId=lesson.objectives[0].questions.find(q=>q.format===kind).id;store.saveLearningSession(session);
  }else{await content.loadGrammarStage('Foundations');await content.loadGrammarStage('A1');const selected=content.grammarCourse.lessons.find(l=>l.steps?.some(s=>s.kind===kind||s.kind==='question'&&s.format===kind&&s.speak));lesson=await content.loadGrammarLesson(selected.id);
   const {createCourseSession}=await import('./js/learning/course-v2-engine.js'),session=createCourseSession(lesson,{learning:store.learning});session.courseV2.stepIndex=lesson.steps.findIndex(s=>s.kind===kind||s.kind==='question'&&s.format===kind&&s.speak);store.saveLearningSession(session);
  }await store.saveNow();return lesson.id;
 },{kind,legacy});await gotoRoute(page,'/learn/grammar/'+id+(legacy?'?mode=review':''));await page.locator(legacy?'[data-grammar-lesson]':'[data-course-lesson]').waitFor();return id;
}
const state=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js');return {session:store.learning.session,events:Object.values(store.learning.events),items:store.current.items,completions:store.learning.completions};});
const labState=()=>page.evaluate(async()=>{const {store}=await import('./js/store.js'),{readLabSession}=await import('./js/learning/sentence-lab-data.js');return readLabSession(store,'sl-presente-01-chi-sono');});
async function request(task='intent',draft='I want to say that I am English'){
 await page.locator(task==='intent'?'[data-lab-ai-help]':`[data-ai-lesson-help="${task}"]`).click();await sheet().waitFor();
 if(draft)await sheet().locator('[data-assistance-intent]').fill(draft);await sheet().locator('[data-assistance-request]').click();
}
try{
 await check('Unavailable production help stays hidden while authored workshop and lesson help remain available',async()=>{
  await fresh();await lab();assert.equal(await page.locator('[data-lab-ai-help]').count(),0);assert.equal(await page.locator('[data-lab-free]').count(),1);
  await course();assert.equal(await page.locator('[data-ai-lesson-help]').count(),0);assert.equal(await page.locator('[data-hint]').count(),1);
  const readiness=await page.evaluate(async()=>(await import('./js/conversations/runtime.js')).conversationReadiness());assert.equal(readiness.written,false);
 });
 await check('The original workshop intention persists on reopen without generation, evidence or restored-output trust',async()=>{
  await fresh();await provider();await lab();await page.locator('[data-lab-ai-help]').click();await sheet().waitFor();await sheet().locator('[data-assistance-intent]').fill('Keep my original intention');
  await page.waitForFunction(async()=>{const {store}=await import('./js/store.js');await store.saveNow();return Object.values(store.learning.sessions).some(s=>Object.values(s.aiAssistance?.drafts||{}).some(d=>d.originalText==='Keep my original intention'));});
  await sheet().locator('[data-assistance-close]').click();await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-lab-controls]').waitFor();await provider();await page.locator('[data-lab-ai-help]').click();await sheet().waitFor();
  assert.equal(await sheet().locator('[data-assistance-intent]').inputValue(),'Keep my original intention');assert.equal(await sheet().locator('[data-assistance-wording]').count(),0);assert.equal(await page.evaluate(()=>helpRequests.length),0);assert.equal((await state()).events.length,0);
 });
 await check('Validated wording is explicitly inserted as an unsent draft, retains intention and produces only assisted workshop practice',async()=>{
  await fresh();await provider();await lab();const before=await state();await request();await sheet().locator('[data-assistance-use]').waitFor();assert.equal((await state()).events.length,before.events.length);
  assert.equal(await page.evaluate(()=>helpSpeech.length),0);await sheet().locator('[data-assistance-hear]').click();await page.waitForFunction(()=>helpSpeech.length===1);assert.equal(await page.evaluate(()=>helpSpeech[0]),'inglese');
  await page.evaluate(()=>{const button=document.querySelector('[data-assistance-use]');button.click();button.click();});await page.locator('[data-lab-free-input]').waitFor();assert.equal(await page.locator('[data-lab-free-input]').inputValue(),'inglese');
  let saved=await labState();assert.equal(saved.state.ui.values[0],'');assert.equal(saved.aiAssistance.history.length,1);assert.equal(saved.aiAssistance.history[0].originalText,'I want to say that I am English');assert.match(saved.aiAssistance.history[0].sourceRevision,/^help:[a-f0-9]{64}$/);
  assert.equal(await page.locator('[data-lab-ai-source]').getByText('I want to say that I am English',{exact:true}).count(),1);
  await page.locator('[data-lab-free-submit]').click();saved=await labState();assert(saved.state.ui.inputSources[0].assistance.includes('ai-intent'));await page.locator('[data-lab-check]').click();saved=await labState();assert.equal(saved.state.result.outcome,'accepted');assert(saved.state.result.assistance.includes('ai-intent'));
  const after=await state();assert.equal(Object.keys(after.completions).length,0);assert.equal(Object.values(after.items).some(item=>item.learned),false);assert(after.events.every(event=>event.assistance.includes('ai-intent')));
 });
 await check('A new suggested word uses real canonical drills but keeps their answers assisted and cannot mark the word learned',async()=>{
  await fresh();await provider('tedesco');await lab();await request('intent','I would like to say that I am German');await sheet().locator('[data-assistance-use]').click();await page.locator('[data-lab-free-submit]').click();await page.locator('[data-drill-start]').waitFor();await page.locator('[data-drill-start]').click();
  for(let n=0;n<3;n++){
   const drill=(await labState()).state.ui.activeDrill.drills[n];
   if(drill.type==='mc')await page.locator(`[data-drill-choice="${drill.choices.findIndex(choice=>choice.correct)}"]`).click();
   else{await page.locator('[data-drill-input]').fill(drill.answers[0]);await page.locator('[data-drill-check]').click();}
   await page.locator('[data-drill-next]').click();
  }
  await page.locator('[data-drill-done]').click();const after=await state(),saved=await labState();assert.equal(after.events.length,3);assert(after.events.every(event=>event.assistance.includes('ai-intent')));assert.equal(Object.values(after.items).some(item=>item.learned),false);assert.equal(Object.keys(after.completions).length,0);assert(saved.state.ui.inputSources[0].assistance.includes('ai-intent'));
 });
 await check('An edited source or navigation cancels late wording before receipts or input writes',async()=>{
  await fresh();await provider('inglese',true);await lab();await request();await page.waitForFunction(()=>helpRequests.length===1);
  await page.evaluate(()=>{const button=document.querySelector('[data-lab-option]');button.click();});await page.waitForFunction(()=>!document.querySelector('.sheet-wrap.open'));
  await page.evaluate(()=>releaseHelp());assert.equal((await labState()).aiAssistance.history.length,0);assert.equal((await labState()).state.ui.values[0],'italiano');
  await request();await page.waitForFunction(()=>helpRequests.length===2);await gotoRoute(page,'/learn');await page.evaluate(()=>releaseHelp());assert.equal((await labState()).aiAssistance.history.length,0);
 });
 await check('Provider removal and learning epoch reset revoke open help and reject late output',async()=>{
  await fresh();await provider('inglese',true);await lab();await request();await page.waitForFunction(()=>helpRequests.length===1);await page.evaluate(()=>{removeHelpProvider();releaseHelp();});assert.equal(await sheet().count(),0);assert.equal((await labState()).aiAssistance.history.length,0);assert.equal(await page.locator('[data-lab-ai-help]').count(),0);
  await provider('inglese',true);await request();await page.waitForFunction(()=>helpRequests.length===1);await page.evaluate(async()=>{await (await import('./js/store.js')).store.resetProgress();releaseHelp();});assert.equal(await sheet().count(),0);assert.equal((await state()).events.length,0);assert.equal((await labState()),null);
 });
 await check('Course hint exposure is ungraded and a subsequent canonical answer records assistance with one spoken sentence',async()=>{
  await fresh();await provider('Pensa alla persona che parla.');await course();const before=await state();await request('hint','A little help');await sheet().locator('[data-assistance-wording]').waitFor();assert.equal(await sheet().locator('article').count(),0,'answer-bearing example and teaching cards are not shown for hints');assert.equal((await state()).events.length,before.events.length);assert((await state()).session.courseV2.assistance.includes('hint'));await sheet().locator('[data-assistance-close]').click();
  const q=await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{grammarLesson}=await import('./js/learning/grammar-course.js'),{currentCourseStep}=await import('./js/learning/course-v2-engine.js');return currentCourseStep(grammarLesson(store.learning.session.entryId),store.learning.session).step;});
  await page.locator(`[data-choice="${q.options.indexOf(q.answer)}"]`).click();const after=await state();assert.equal(after.events.length,before.events.length+1);assert(after.events.at(-1).assistance.includes('hint'));assert.equal(Object.keys(after.completions).length,0);await page.waitForFunction(()=>helpSpeech.length===1);assert.equal(await page.evaluate(()=>helpSpeech[0]),q.speak);
 });
 await check('A hint containing the canonical answer is rejected before display or assistance receipt',async()=>{
  await fresh();await provider();await course();await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{grammarLesson}=await import('./js/learning/grammar-course.js'),{currentCourseStep}=await import('./js/learning/course-v2-engine.js');helpReply=currentCourseStep(grammarLesson(store.learning.session.entryId),store.learning.session).step.answer;});
  await request('hint','Please help');await sheet().getByRole('alert').filter({hasText:'revealed the answer'}).waitFor();assert.equal(await sheet().locator('[data-assistance-wording]').count(),0);assert.equal((await state()).session.aiAssistance.history.length,0);assert.equal((await state()).events.length,0);
 });
 await check('Explanation cards copy the exact canonical example without borrowing unrelated retrieved rules',async()=>{
  await fresh();await provider('Guarda la scheda.');await course();const q=await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{grammarLesson}=await import('./js/learning/grammar-course.js'),{currentCourseStep}=await import('./js/learning/course-v2-engine.js');return currentCourseStep(grammarLesson(store.learning.session.entryId),store.learning.session).step;});await request('explain','test-reference');await sheet().locator('[data-assistance-wording]').waitFor();
  assert.equal(await sheet().getByText(q.speak,{exact:true}).count(),1);assert.equal(await sheet().getByText('This is an authored test reference, not generated teaching.',{exact:true}).count(),0);assert.equal(await sheet().getByRole('link',{name:'Reference source'}).count(),0);assert.equal((await state()).events.length,0);
 });
 await check('Course portfolio wording preserves its original intention and remains an editable ungraded draft across reopen',async()=>{
  await fresh();await provider('Vorrei due biglietti.');const id=await course('portfolio');await page.locator('[data-ai-lesson-help="intent"]').click();await sheet().waitFor();await sheet().locator('[data-assistance-intent]').fill('I would like two tickets');await sheet().locator('[data-assistance-request]').click();await sheet().locator('[data-assistance-use]').click();await page.locator('[data-portfolio-draft]').waitFor();assert.equal(await page.locator('[data-portfolio-draft]').inputValue(),'Vorrei due biglietti.');
  let saved=await state(),work=Object.values(saved.session.courseV2.portfolios)[0];assert.equal(work.aiHelp.originalText,'I would like two tickets');assert.equal(saved.events.length,0);assert.equal(Object.keys(saved.completions).length,0);
  await page.reload({waitUntil:'domcontentloaded'});await page.locator(`[data-course-lesson="${id}"]`).waitFor();assert.equal(await page.locator('[data-portfolio-draft]').inputValue(),'Vorrei due biglietti.');assert.equal(await page.getByText('I would like two tickets',{exact:true}).count(),1);assert.equal(await page.evaluate(()=>helpSpeech.length),0);assert.equal((await state()).events.length,0);
 });
 await check('Legacy Grammar help retains the exact original question and closes on learner replacement',async()=>{
  await fresh();await provider('Pensa alla persona che parla.');await course('choice',true);await request('hint','A little help');await sheet().locator('[data-assistance-wording]').waitFor();const before=await state();assert(before.session.grammar.assistance.includes('hint'));assert.equal(before.events.length,0);
  await page.evaluate(async()=>{const {store}=await import('./js/store.js'),profile=structuredClone(store.current);profile.learnerId=crypto.randomUUID();await store.importJSON(JSON.stringify({profile}));});assert.equal(await sheet().count(),0);const after=await state();await page.evaluate(()=>document.querySelector('[data-choice]')?.click());assert.deepEqual(await state(),after);
 });
 await check('Workshop agreement changes revoke late wording while preserving the original saved intention',async()=>{
  await fresh();await provider('inglese',true);await lab();await request('intent','Preserve this original intention');await page.waitForFunction(()=>helpRequests.length===1);
  const initial=await labState();await page.evaluate(()=>{document.querySelector('[data-lab-agreement]').click();document.querySelector('.dropdown-layer[data-active] [data-value="f"]').click();});await page.waitForFunction(()=>!document.querySelector('.sheet-wrap.open'));
  await page.evaluate(()=>releaseHelp());await page.waitForTimeout(50);const saved=await labState();assert.equal(saved.speakerAgreement,'f');assert.equal(saved.aiAssistance.history.length,0);assert.equal(Object.values(saved.aiAssistance.drafts)[0].originalText,'Preserve this original intention');assert.equal(initial.speakerAgreement,'m');assert.equal((await state()).events.length,0);
  await page.locator('[data-lab-ai-help]').click();await sheet().waitFor();assert.equal(await sheet().locator('[data-assistance-intent]').inputValue(),'','a draft bound to another agreement is not silently reused');assert.equal(await page.evaluate(()=>helpRequests.length),1);
 });
 await check('An unsupported Workshop free slot keeps authored help without binding an unrelated model example',async()=>{
  await fresh();await provider();await lab('sl-strutture-03-quindi-allora-pero',3,'f');assert.equal(await page.locator('[data-lab-ai-help]').count(),0);assert.equal(await page.locator('[data-lab-free]').count(),1);assert.equal(await page.evaluate(()=>helpRequests.length),0);assert.equal((await state()).events.length,0);
 });
 await check('Workshop chosen source cards follow the actual speaker agreement without adding evidence',async()=>{
  for(const agreement of ['m','f']){
   await fresh();await provider('inglese');await lab('sl-presente-01-chi-sono',4,agreement);await request();await sheet().locator('[data-assistance-wording]').waitFor();
   const expected=agreement==='m'?'Sono di Roma e sono italiano.':'Sono di Roma e sono italiana.';assert.equal(await sheet().getByText(expected,{exact:true}).count(),1);assert.equal(await sheet().getByText('Example: a '+(agreement==='m'?'man':'woman')+' speaking.',{exact:true}).count(),1);
   const refs=await page.evaluate(()=>helpGroundings[0].references);assert.equal(refs[0].reviewScope,'chosen-form-translation-agreement');assert.equal(refs[0].applicability,agreement);assert.equal(refs[0].nativeItalianEducatorReview,'pending');assert.equal((await state()).events.length,0);
  }
 });
 await check('A female viewer sees an explicitly labelled male-or-mixed group quote, not a claim about her own gender',async()=>{
  await fresh();await provider('siamo tornati');await lab('sl-passato-05-raccontami',3,'f',7);await request('intent','We came home');await sheet().locator('[data-assistance-wording]').waitFor();assert.equal(await sheet().getByText('La sera siamo tornati a casa e abbiamo visto un film.',{exact:true}).count(),1);assert.equal(await sheet().getByText('Example: a male or mixed group.',{exact:true}).count(),1);assert.equal((await state()).events.length,0);
 });
 await check('Imported canonical source tampering is rejected by the real resolver before generation',async()=>{
  await fresh();await provider();await course();const failure=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),{grammarLesson}=await import('./js/learning/grammar-course.js'),{createCoursePracticeBinding,createPracticeSourceResolver}=await import('./js/learning/practice-sources.js');const lesson=grammarLesson(store.learning.session.entryId),binding=createCoursePracticeBinding({lesson,session:store.learning.session}),source=createPracticeSourceResolver().resolve(binding);binding.canonical.answer='An imported answer';
   try{await helpService.request({task:'explain',text:'Please help',level:lesson.level,participants:[{id:'helper',name:'Helper'}],helpSource:binding,helpContext:{sourceId:source.sourceId,prompt:source.prompt,context:source.context}});return null;}catch(error){return error.message;}
  });assert.match(failure,/changed or is unsupported/);assert.equal(await page.evaluate(()=>helpRequests.length),0);assert.equal((await state()).events.length,0);
 });
 await check('Authentic passage help preserves exact excerpt, source attribution and its separate licence',async()=>{
  await fresh();await provider('Guarda il testo della fonte.');const selected=await page.evaluate(async()=>{
   const {store}=await import('./js/store.js'),content=await import('./js/learning/grammar-course.js'),{createCourseSession}=await import('./js/learning/course-v2-engine.js');const lesson=await content.loadGrammarLesson('v2-c1-read-pascal-preface'),session=createCourseSession(lesson,{learning:store.learning});session.courseV2.stepIndex=lesson.steps.findIndex(step=>step.id==='v2-c1-read-pascal-preface.check-0');store.saveLearningSession(session);await store.saveNow();const question=lesson.steps[session.courseV2.stepIndex],passage=lesson.steps.find(step=>step.id===question.passageId);return {id:lesson.id,credit:passage.source,excerpt:passage.it.slice(0,100)};
  });await gotoRoute(page,'/learn/grammar/'+selected.id);await page.locator('[data-course-lesson]').waitFor();await request('explain','Help me follow this passage');await sheet().locator('[data-assistance-wording]').waitFor();assert.equal(await sheet().getByText('Excerpt from this source',{exact:true}).count(),1);assert(await sheet().innerText().then(text=>text.includes(selected.excerpt)&&text.includes(selected.credit.author)&&text.includes(selected.credit.license)&&text.includes(selected.credit.changes)));assert.equal(await sheet().getByRole('link',{name:'Reference source'}).getAttribute('href'),selected.credit.url);assert.equal(await sheet().getByRole('link',{name:'Source licence'}).getAttribute('href'),selected.credit.licenseUrl);assert.equal((await state()).events.length,0);
 });
 await check('Retained Grammar repair explains only its selected canonical question without adding evidence',async()=>{
  await fresh();await provider('Guarda questo esempio.');const id=await course('choice',true),speak=await page.evaluate(async()=>{const {store}=await import('./js/store.js'),{grammarLesson}=await import('./js/learning/grammar-course.js'),session=store.learning.session,lesson=grammarLesson(session.entryId),question=lesson.objectives[session.grammar.objectiveIndex].questions.find(question=>question.id===session.grammar.questionId);session.grammar.phase='repair';session.grammar.repairQuestion=question.id;store.saveLearningSession(session);await store.saveNow();return question.speak;});await gotoRoute(page,'/learn/grammar/'+id+'?mode=review');await page.locator('[data-grammar-lesson]').waitFor();await request('explain','Help me understand');await sheet().locator('[data-assistance-wording]').waitFor();assert.equal(await sheet().getByText(speak,{exact:true}).count(),1);assert.equal((await state()).events.length,0);assert.equal(Object.keys((await state()).completions).length,0);
 });
 await check('Delayed initial workshop, Course audio and retained Grammar loads cannot replace a screen already left',async()=>{
  for(const host of ['workshop','course','grammar']){
   await fresh();const target=await page.evaluate(async host=>{const {grammarCourse}=await import('./js/learning/grammar-course.js');if(host==='workshop')return{path:'data/sentence-lab/presente.json',href:'#/lab/frasi/sl-presente-01-chi-sono'};if(host==='course')return{path:'data/course-v2/audio.json',href:'#/learn/grammar/'+grammarCourse.lessons[0].id};const pack=grammarCourse.legacyLevels[0];return{path:pack.path,href:'#/learn/grammar/'+pack.units[0].lessons[0].id};},host);
   let release,seen=false;const pattern='**/'+target.path;
   await page.route(pattern,async route=>{seen=true;await new Promise(resolve=>release=resolve);await route.continue();});await page.evaluate(href=>location.hash=href,target.href);
   for(let n=0;n<100&&!seen;n++)await page.waitForTimeout(20);assert(seen,host+' initial load was intercepted');await page.evaluate(()=>location.hash='#/profile');await page.locator('[data-settings]').waitFor();const before=await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current));release();await page.waitForTimeout(500);
   assert.equal(await page.locator('[data-settings]').count(),1,host+' must preserve Profile');assert.equal(await page.evaluate(()=>location.hash),'#/profile');assert.equal(await page.evaluate(async()=>JSON.stringify((await import('./js/store.js')).store.current)),before);await page.unroute(pattern);
  }
 });
 assert.deepEqual(errors,[]);passed=true;
}finally{
 fs.writeFileSync(new URL(`../docs/implementation/programme/ai-assistance-${name}.json`,import.meta.url),JSON.stringify({browser:name,passed,scope:'Explicit test-only provider and language-policy fixture; validates persistence, source leases and assisted-only integration, not real Italian model quality.',checks,errors},null,2));
 await context?.close();await browser.close();stop();
}
