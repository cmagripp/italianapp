import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createLearning,recordAttempt,skillState,mergeLearning,normalizeLearning,resetLearning,checkpointLearning} from '../js/learning/model.js';
import {courseSkill} from '../js/learning/course-v2-state.js';
import {grammarSkill} from '../js/learning/grammar-state.js';
import {installGrammarCourse,grammarCourse,grammarProgress} from '../js/learning/grammar-course.js';
import {createReviewVisit,currentReviewQuestion,reviewAttempt} from '../js/learning/review-session.js';

const TIME=1700000000000,DAY=86400e3;
const target={id:'grammar-mode.core',facets:['singular','plural'],minIndependent:2,requiresProduction:false,modality:'language'};
const make=(n,{sessionId='lesson',index=n*3,at=TIME+n*1000,facet=target.facets[n%2],mode='recognition',...patch}={})=>({
  id:`grammar-mode:${n}`,entryId:'g:grammar-mode',objectiveId:target.id,kind:'grammar',policy:'grammar-v2',contentVersion:2,
  sessionId,index,at,facet,skill:facet,requiredFacets:target.facets,minIndependent:2,requiresProduction:false,
  modality:'language',mode,responseMode:mode,grammarPhase:'independent',firstAttempt:true,assistance:[],
  variantId:`question:${n}`,contextId:`context:${n}`,exposureGroup:`family:${n}`,outcome:'correct',ok:true,xp:2,...patch});
const add=(learning,event)=>recordAttempt(learning,{...event,epochId:learning.epoch.id}).learning;
const replay=events=>events.reduce(add,createLearning(TIME));
const state=learning=>skillState(learning,target.id,TIME+20*DAY);
let passed=0;
function test(name,run){run();passed++;console.log(`PASS ${name}`);}

test('recognition course completion and its old remembered milestone retain no written claim',()=>{
  let learning=replay([make(0),make(1)]);
  assert.equal(state(learning).ready,true);assert.equal(state(learning).recognitionReady,true);
  assert.equal(state(learning).recognitionRemembered,false);assert.equal(state(learning).productionReady,false);
  learning=add(learning,make(2,{sessionId:'recognition-review',at:TIME+2*DAY,index:0,reviewPolicy:'unified-review-v1'}));
  assert.equal(state(learning).remembered,true,'Old mixed-response course retention remains compatible');
  assert.equal(state(learning).recognitionRemembered,false,'One delayed context is not the new complete lane proof');
  learning=add(learning,make(3,{sessionId:'recognition-review',at:TIME+2*DAY+3000,index:3,reviewPolicy:'unified-review-v1'}));
  const s=state(learning);assert.equal(s.recognitionRemembered,true);assert.equal(s.recognitionIndependentCorrect,4);
  assert.equal(s.writtenIndependentCorrect,0);assert.equal(s.productionRemembered,false);
  assert(s.recognitionSrs.reps>=1);assert.equal(s.productionSrs.reps,0);
});

test('one typed answer can complement old course completion without claiming written readiness',()=>{
  const events=[make(0,{mode:'production',requiresProduction:true}),make(1,{requiresProduction:true})];
  const direct=courseSkill(events,TIME+DAY,{...target,requiresProduction:true});
  assert.equal(direct.ready,true);assert.equal(direct.independentCorrect,2);
  assert.equal(direct.productionIndependentCorrect,1);assert.equal(direct.productionReady,false);
  assert.equal(direct.recognitionIndependentCorrect,1);assert.equal(direct.recognitionReady,false);
});

test('later recognition does not manufacture delayed written evidence',()=>{
  let learning=replay([make(0,{mode:'production'}),make(1,{mode:'production'})]);
  assert.equal(state(learning).productionReady,true);
  for(let n=2;n<4;n++)learning=add(learning,make(n,{sessionId:'recognition',at:TIME+2*DAY+n*1000,index:(n-2)*3,reviewPolicy:'unified-review-v1'}));
  assert.equal(state(learning).remembered,true);assert.equal(state(learning).productionRemembered,false);
  assert.equal(state(learning).writtenResponseRemembered,false);assert.equal(state(learning).recognitionReady,true);
  for(let n=4;n<6;n++)learning=add(learning,make(n,{mode:'production',sessionId:'writing',at:TIME+3*DAY+n*1000,index:(n-4)*3,reviewPolicy:'unified-review-v1'}));
  assert.equal(state(learning).productionRemembered,true);assert.equal(state(learning).writtenResponseRemembered,true);
  assert.equal(state(learning).recognitionRemembered,false);
});

test('required facets cannot be replaced by several typed answers to only one distinction',()=>{
  const learning=replay([make(0,{mode:'production'}),make(1,{mode:'production',facet:'singular'}),make(2,{mode:'production',facet:'singular'})]);
  const s=state(learning);assert.equal(s.productionIndependentCorrect,3);assert.equal(s.productionReady,false);
  assert.deepEqual(s.responseEvidence.written.facetEvidence,{singular:3,plural:0});
});

test('checking different facets in the same context cannot invent a second distinct written context',()=>{
  const learning=replay([make(0,{mode:'production',contextId:'the same sentence'}),make(1,{mode:'production',contextId:'the same sentence'})]);
  const s=state(learning);assert.equal(s.ready,true,'The original course rubric stays compatible');
  assert.equal(s.productionIndependentCorrect,1);assert.equal(s.productionReady,false);
  assert.deepEqual(s.responseEvidence.written.facetEvidence,{singular:1,plural:1});
});

test('typed reading and listening answers retain comprehension modality without grammatical production claims',()=>{
  for(const modality of ['reading','listening']){
    const events=[make(0,{mode:'production',modality}),make(1,{mode:'production',modality}),
      make(2,{mode:'production',modality,sessionId:'later',index:0,at:TIME+2*DAY}),
      make(3,{mode:'production',modality,sessionId:'later',index:3,at:TIME+2*DAY+3000})];
    const s=state(replay(events));assert.equal(s.ready,true);assert.equal(s.remembered,true);
    assert.equal(s.modality,modality);assert.equal(s.writtenResponseReady,true);assert.equal(s.writtenResponseRemembered,true);
    assert.equal(s.writtenIndependentCorrect,4);assert.equal(s.productionIndependentCorrect,0);
    assert.equal(s.productionReady,false);assert.equal(s.productionRemembered,false);
  }
});

test('guided, assisted, forced-last-pair and ungraded responses earn no independent lane or scheduling repetitions',()=>{
  for(const mode of ['recognition','production']){
    const learning=replay([
      make(0,{mode,grammarPhase:'guided',reviewPolicy:'unified-review-v1'}),
      make(1,{mode,grammarPhase:'guided',sessionId:'later',at:TIME+2*DAY,reviewPolicy:'unified-review-v1'}),
      make(2,{mode,assistance:['hint'],sessionId:'hint',at:TIME+3*DAY,reviewPolicy:'unified-review-v1'}),
      make(3,{mode,assistance:['matching-retry'],firstAttempt:false,sessionId:'pair',at:TIME+4*DAY,reviewPolicy:'unified-review-v1'}),
      make(4,{mode,outcome:'ungraded',ok:false,grammarPhase:'portfolio',sessionId:'portfolio',at:TIME+5*DAY,reviewPolicy:'unified-review-v1'})]);
    const s=state(learning);assert.equal(s.ready,false);assert.equal(s.recognitionReady,false);assert.equal(s.productionReady,false);
    assert.equal(s.recognitionIndependentCorrect,0);assert.equal(s.writtenIndependentCorrect,0);
    assert.equal(s.recognitionSrs.reps,0);assert.equal(s.productionSrs.reps,0);
  }
});

test('seeing an answer family in guidance does not become fresh evidence by changing response format',()=>{
  const learning=replay([make(0,{grammarPhase:'guided',reviewPolicy:'unified-review-v1'}),
    make(1,{mode:'production',facet:'singular',exposureGroup:'family:0',reviewPolicy:'unified-review-v1'}),
    make(2,{mode:'production',facet:'plural',reviewPolicy:'unified-review-v1'})]);
  const s=state(learning);assert.equal(s.writtenIndependentCorrect,1);assert.equal(s.productionReady,false);
  assert.deepEqual(s.responseEvidence.written.qualifiedEventIds,['grammar-mode:2']);
});

test('recognition repair cannot conceal a written error, including two repeated misconceptions',()=>{
  const oneFacet=e=>({...e,facet:'singular',requiredFacets:['singular']});
  let learning=replay([oneFacet(make(0,{mode:'production'})),oneFacet(make(1,{mode:'production'}))]);
  for(let n=2;n<4;n++)learning=add(learning,oneFacet(make(n,{mode:'production',ok:false,outcome:'incorrect',sessionId:'mistakes',index:(n-2)*3,at:TIME+2*DAY+n*1000,reviewPolicy:'unified-review-v1'})));
  for(let n=4;n<6;n++)learning=add(learning,oneFacet(make(n,{sessionId:'recognition-repair',index:(n-4)*3,at:TIME+3*DAY+n*1000,reviewPolicy:'unified-review-v1'})));
  assert.equal(state(learning).ready,true,'Existing course repair and completion stay compatible');
  assert.equal(state(learning).productionReady,false);assert.equal(state(learning).recognitionReady,true);
  assert.equal(state(learning).responseEvidence.written.unresolvedErrors[0].remaining,2);
  learning=add(learning,oneFacet(make(6,{mode:'production',sessionId:'written-repair',index:0,at:TIME+4*DAY,reviewPolicy:'unified-review-v1'})));
  assert.equal(state(learning).productionReady,false);assert.equal(state(learning).responseEvidence.written.unresolvedErrors[0].remaining,1);
  learning=add(learning,oneFacet(make(7,{mode:'production',sessionId:'written-repair',index:3,at:TIME+4*DAY+3000,reviewPolicy:'unified-review-v1'})));
  assert.equal(state(learning).productionReady,true);assert.equal(state(learning).productionRemembered,false);
  assert.equal(state(learning).responseEvidence.written.unresolvedErrors.length,0);
});

test('conflicting imported response metadata keeps old completion but earns no invented mode proof',()=>{
  const events=[make(0,{responseMode:'production',requiresProduction:true}),make(1,{requiresProduction:true})];
  const s=state(replay(events));assert.equal(s.ready,true);assert.equal(s.productionIndependentCorrect,0);
  assert.equal(s.recognitionIndependentCorrect,1);assert.equal(s.productionReady,false);assert.equal(s.recognitionReady,false);
});

test('legacy recognition grammar remains completed and separately identifies its response evidence',()=>{
  const legacy=Array.from({length:4},(_,n)=>({...make(n),policy:'grammar-v1',contentVersion:1,
    sessionId:n<2?'legacy':'legacy-review',index:(n%2)*3,at:TIME+(n<2?n*1000:2*DAY+n*1000),reviewPolicy:'unified-review-v1'}));
  const old=grammarSkill(legacy,TIME+5*DAY),s=state(replay(legacy));
  assert.equal(old.ready,true);assert.equal(old.remembered,true);assert.equal(s.ready,old.ready);assert.equal(s.remembered,old.remembered);
  assert.equal(s.recognitionReady,true);assert.equal(s.recognitionRemembered,true);assert.equal(s.productionReady,false);
  const failed=grammarSkill([...legacy,{...legacy.at(-1),id:'legacy-failure',outcome:'incorrect',ok:false,index:6,at:TIME+3*DAY}],TIME+4*DAY);
  assert.equal(failed.ready,true,'Old completed legacy grammar is retained after a lapse');
  assert.equal(failed.recognitionReady,false);assert.equal(failed.recognitionRemembered,false);
});

test('new content cannot inherit an old grammar policy’s written proof',()=>{
  const old=[make(0,{mode:'production',policy:'grammar-v1',contentVersion:1}),make(1,{mode:'production',policy:'grammar-v1',contentVersion:1})];
  const learning=replay([...old,make(2,{sessionId:'new-policy',at:TIME+2*DAY}),make(3,{sessionId:'new-policy',at:TIME+2*DAY+3000})]);
  assert.equal(state(learning).ready,true);assert.equal(state(learning).productionIndependentCorrect,0);
  assert.equal(Object.keys(learning.events).length,4);
});

test('derived policy rebuilds old checkpoints without changing events, saved drafts or merge/reset fences',()=>{
  const original=replay([make(0),make(1)]),draft={id:'exact-draft',entryId:'g:grammar-mode',objectiveIds:[target.id],updatedAt:TIME+1000,
    courseV2:{version:2,phase:'step',stepIndex:4,draft:'Siamo',result:{ok:true,answer:'Siamo'},historyCursor:0}};
  const saved=normalizeLearning({...original,session:draft,sessions:{'g:grammar-mode|lesson':draft}});
  const checkpoint=checkpointLearning(saved,TIME+DAY);
  assert.equal(checkpoint.checkpoint.policyVersion,'learning-v6-lossless-2-grammar-evidence');
  const oldCheckpoint=JSON.parse(JSON.stringify(checkpoint));oldCheckpoint.checkpoint.policyVersion='learning-v6-lossless-1';
  oldCheckpoint.checkpoint.summaries[target.id].productionReady=true;
  const restored=normalizeLearning(oldCheckpoint),s=state(restored);
  assert.equal(s.productionReady,false);assert.equal(s.recognitionReady,true);
  assert.deepEqual(restored.events,saved.events);assert.deepEqual(restored.sessions,saved.sessions);assert.deepEqual(restored.session,saved.session);
  const later=replay([make(2,{sessionId:'replica',at:TIME+2*DAY})]);
  assert.deepEqual(state(mergeLearning(saved,later)),state(mergeLearning(later,saved)));
  const reset=resetLearning(saved,TIME+3*DAY,'grammar-reset');assert.equal(Object.keys(mergeLearning(reset,restored).events).length,0);
});

test('actual authored lesson completion still follows its original mixed-response rubric',()=>{
  const pack=JSON.parse(fs.readFileSync(new URL('../data/course-v2/Foundations.json',import.meta.url)));installGrammarCourse([pack]);
  const lesson=grammarCourse.lessons.find(l=>l.targets.every(t=>!t.requiresProduction));assert(lesson);
  const events=lesson.targets.flatMap((t,i)=>Array.from({length:Math.max(t.minIndependent,t.facets.length)},(_,n)=>({
    ...make(i*20+n,{facet:t.facets[n%t.facets.length],index:(i*20+n)*3}),objectiveId:t.id,entryId:`g:${lesson.id}`,
    requiredFacets:t.facets,minIndependent:t.minIndependent,requiresProduction:t.requiresProduction,modality:t.modality}))); 
  const receipt={...make(999),entryId:`g:${lesson.id}`,objectiveId:`${lesson.id}.course-finish`,
    skill:'course-completion',outcome:'ungraded',ok:false,xp:0,completedTargets:lesson.targets.map(t=>t.id)};
  const learning=replay([...events,receipt]);assert.equal(grammarProgress(lesson,learning).complete,true);
  for(const t of lesson.targets){const s=skillState(learning,t.id);assert.equal(s.ready,true);assert.equal(s.productionReady,false);}
});

test('Review requests and repairs the retained written error after the old mixed course rubric is satisfied',()=>{
  const pack=JSON.parse(fs.readFileSync(new URL('../data/course-v2/A1.json',import.meta.url)));installGrammarCourse([pack]);
  const lesson=grammarCourse.lessons.find(l=>l.id==='v2-a1-weather-conditions'),t=lesson.targets[0];
  const questions=lesson.steps.filter(q=>q.kind==='question' && q.target===t.id && q.stage==='independent');
  const typed=questions.filter(q=>q.format==='type'),choices=questions.filter(q=>q.format==='choice');
  const authored=(n,q,patch={})=>({...make(n),entryId:`g:${lesson.id}`,objectiveId:t.id,facet:q.facet,skill:q.facet,
    requiredFacets:t.facets,minIndependent:t.minIndependent,requiresProduction:t.requiresProduction,modality:t.modality,
    mode:q.format==='type'?'production':'recognition',responseMode:q.format==='type'?'production':'recognition',
    variantId:q.id,contextId:q.contextKey,exposureGroup:q.exposureGroup,...patch});
  let learning=replay([authored(0,typed[0]),authored(1,typed[1]),
    authored(2,typed[0],{sessionId:'written-error',index:0,at:TIME+2*DAY,ok:false,outcome:'incorrect'}),
    authored(3,choices[0],{sessionId:'choice-repair',index:0,at:TIME+3*DAY}),
    authored(4,choices[1],{sessionId:'choice-repair',index:3,at:TIME+3*DAY+3000})]);
  const before=skillState(learning,t.id,TIME+20*DAY);
  assert.equal(before.ready,true);assert.equal(before.unresolvedErrors.length,0);
  assert.equal(before.productionReady,false);assert.equal(before.responseEvidence.written.unresolvedErrors.length,1);
  const row={id:`g:${lesson.id}|grammar`,entry:{id:`g:${lesson.id}`,kind:'grammar'},label:lesson.title,caseId:'grammar',targets:[before]};
  const store={learning,current:{id:'grammar-learner'}},visit=createReviewVisit(store,[row],{id:'written-error-review',now:TIME+20*DAY,limit:1});
  const frame=currentReviewQuestion(visit);assert.equal(frame.question.type,'type');
  const attempt=reviewAttempt(visit,frame.question.answer[0],{now:TIME+20*DAY});
  learning=add(learning,attempt.event);const after=skillState(learning,t.id,TIME+20*DAY);
  assert.equal(after.responseEvidence.written.unresolvedErrors.length,0);assert.equal(after.productionReady,true);
  assert.equal(after.productionRemembered,false,'Successful repair is not delayed retention');
});

console.log(`${passed} grammar response-evidence checks passed.`);
