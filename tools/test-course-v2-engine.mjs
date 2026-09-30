import assert from 'node:assert/strict';
import { courseSkill } from '../js/learning/course-v2-state.js';
import { createCourseSession, compatibleCourseSession, currentCourseStep, advanceCourse,
  submitCourseAnswer, deferCourseTarget, resumeCourseTargets, courseBack, courseReturnLive,
  courseSessionProgress, assessCourseAnswer, markCourseAssistance, recordCoursePairMismatch } from '../js/learning/course-v2-engine.js';

const t=Date.now();
const target={id:'v2-test.core',label:'Test',facets:['form'],minIndependent:2,requiresProduction:true,
  modality:'language',repair:{title:'Notice the form',body:'Use the model.',examples:[{it:'È qui.',en:'It is here.'}]}};
const q=(id,stage,format,answer,reserve=false)=>({id,kind:'question',target:target.id,facet:'form',stage,format,
  contextKey:id,exposureGroup:id,prompt:`Write ${answer}`,answer,accepted:[],options:format==='choice'?[answer,'No']:undefined,
  explanation:'The accent changes the meaning.',hint:'Look at the model.',reserve,strict:true});
const lesson={id:'v2-test',title:'Test',targets:[target],steps:[
  {id:'words',kind:'words',title:'Words',words:[{it:'qui',en:'here'}]},
  {id:'teach',kind:'teach',title:'Model',body:'Use è.',examples:[{it:'È qui.',en:'It is here.'}],introduces:[target.id]},
  q('guided','guided','choice','È qui.'),q('one','independent','type','È qui.'),
  {id:'portfolio',kind:'portfolio',title:'Use it',prompt:'Write a line.',model:'È qui.',rubric:['Meaning']},
  q('two','independent','choice','È là.'),
  {id:'reserve-source',kind:'passage',mode:'read',it:'È lì.',en:'It is there.',reserve:true},
  q('reserve','independent','type','È lì.',true),
  {id:'recap',kind:'teach',title:'Recap',body:'You can use è.',examples:[{it:'È qui.',en:'It is here.'}],introduces:[target.id]},
]};
const learning={events:{}};
const record=submission=>{if(submission.event)learning.events[submission.event.id]=submission.event;};
const answer=(session,value,opts={})=>{const result=submitCourseAnswer(lesson,session,value,{now:t+session.index*1000,...opts});record(result);return result;};
const next=session=>advanceCourse(lesson,session,learning);

assert.equal(assessCourseAnswer(q('typed','independent','type','È qui.'),'E qui').outcome,'incorrect');
assert.equal(assessCourseAnswer({...q('open','independent','type','È qui.'),strict:false},'È proprio qui.').outcome,'ungraded');
assert.equal(assessCourseAnswer(q('typed','independent','type','È qui.'),'È qui!').outcome,'correct');

let s=createCourseSession(lesson,{now:t});
assert.ok(compatibleCourseSession(lesson,s));
assert.equal(currentCourseStep(lesson,s).step.id,'words');
next(s);next(s);
assert.equal(currentCourseStep(lesson,s).step.id,'guided');
answer(s,'È qui.');next(s);
assert.equal(courseSkill(Object.values(learning.events),t,target).ready,false,'guided answer cannot count');
assert.equal(currentCourseStep(lesson,s).step.id,'one');
const first=answer(s,'È qui.');
assert.equal(first.event.id,answer(s,'È qui.').event?.id || first.event.id,'double submit cannot create a new ID');
assert.equal(answer(s,'È qui.').event,undefined,'double submit is idempotent');
next(s);
assert.equal(currentCourseStep(lesson,s).step.id,'portfolio');
s.courseV2.portfolios.portfolio={draft:'È qui.',criteria:[0],modelViewed:true};
next(s);
answer(s,'È là.');next(s);
assert.equal(currentCourseStep(lesson,s).step.id,'recap','reserve bank is not in main path');
next(s);
assert.equal(s.courseV2.phase,'complete');
assert.equal(courseSessionProgress(lesson,s,learning).complete,true);
assert.equal(courseSkill(Object.values(learning.events),t+1e4,target).ready,true);

// Back is read only and exposes a same-target model to the live question.
let b=createCourseSession(lesson,{now:t+100});next(b);next(b);answer(b,'È qui.');next(b);
assert.equal(currentCourseStep(lesson,b).step.id,'one');
courseBack(lesson,b);assert.equal(currentCourseStep(lesson,b).viewOnly,true);
assert.ok(b.courseV2.assistance.includes('history'));
assert.equal(submitCourseAnswer(lesson,b,'È qui.').event,undefined);
courseReturnLive(lesson,b);assert.equal(currentCourseStep(lesson,b).step.id,'one');
markCourseAssistance(lesson,b,{kind:'lookup',token:'pane'});assert.ok(!b.courseV2.assistance.includes('lookup'));
markCourseAssistance(lesson,b,{kind:'lookup',token:'È'});assert.ok(b.courseV2.assistance.includes('lookup'));

// Wrong response gets target repair, reuses the guided model, and returns to the authored application.
let r=createCourseSession(lesson,{now:t+200});next(r);next(r);answer(r,'È qui.');next(r);
answer(r,'E qui');next(r);assert.equal(r.courseV2.phase,'repair');
next(r);assert.equal(currentCourseStep(lesson,r).step.id,'guided');
answer(r,'È qui.');next(r);assert.equal(currentCourseStep(lesson,r).step.id,'reserve');
answer(r,'È lì.');next(r);assert.equal(currentCourseStep(lesson,r).step.id,'portfolio');
assert.ok(compatibleCourseSession(lesson,JSON.parse(JSON.stringify(r))));

// A deferred target remains unfinished; a later session keeps portfolio work and starts with checks.
next(r);assert.equal(currentCourseStep(lesson,r).step.id,'two');
const saved=deferCourseTarget(lesson,r,learning);
assert.equal(currentCourseStep(lesson,saved).step.id,'recap');
next(saved);
assert.equal(saved.courseV2.phase,'paused');
const resumed=resumeCourseTargets(lesson,saved,{events:Object.fromEntries(Object.entries(learning.events).filter(([,e])=>e.sessionId===saved.id))},{now:t+9*3600e3});
assert.notEqual(resumed.id,saved.id);
assert.equal(resumed.courseV2.stepIndex,lesson.steps.length);
assert.equal(resumed.courseV2.phase,'recheck');

// Graded evidence: distinct facets, production, honest lapse and delayed review.
const evidence=(id,sessionId,index,at,opts={})=>({id,policy:'grammar-v2',kind:'grammar',contentVersion:2,
  objectiveId:target.id,entryId:'g:v2-test',sessionId,index,at,variantId:id,contextId:id,exposureGroup:id,
  facet:'form',requiredFacets:['form'],minIndependent:2,requiresProduction:true,modality:'language',
  grammarPhase:'independent',mode:'recognition',responseMode:'recognition',firstAttempt:true,
  outcome:'correct',ok:true,assistance:[],errorTags:[],...opts});
const e1=evidence('a','learn',1,t,{mode:'production',responseMode:'production'});
const e2=evidence('b','learn',3,t+1000);
assert.equal(courseSkill([e1,e2],t+2000,target).ready,true,'recognition may complement production');
const lapse=evidence('bad','later',1,t+9*3600e3,{outcome:'incorrect',ok:false,errorTags:['accent']});
let skill=courseSkill([e1,e2,lapse],lapse.at,target);
assert.equal(skill.enrolled,true);assert.equal(skill.ready,false);assert.equal(skill.unresolvedErrors[0].tag,'accent');
assert.equal(skill.isDue,false);assert.equal(courseSkill([e1,e2,lapse],lapse.at+11*60e3,target).isDue,true);
const recovery=evidence('c','repair',1,lapse.at+11*60e3);
skill=courseSkill([e1,e2,lapse,recovery],recovery.at,target);
assert.equal(skill.ready,true);assert.equal(skill.srs.reps,1,'short repair schedules near-term review without claiming long retention');
const delayed=evidence('a-again','spaced',1,t+20*3600e3,{variantId:'a',exposureGroup:'a',contextId:'a'});
skill=courseSkill([e1,e2,delayed],delayed.at,target);
assert.equal(skill.remembered,true,'a spaced repeat can retain a finite bank');
const early=evidence('a-early','early',1,t+60e3,{variantId:'a',exposureGroup:'a',contextId:'a'});
assert.equal(courseSkill([e1,e2,early],t+60e3,target).srs.reps,1,'an early repeat cannot advance retention');
const uncertain=evidence('uncertain','other',1,t+30e3,{outcome:'ungraded',ok:false});
assert.equal(courseSkill([uncertain],t,target).attempts,0,'ungraded output is practice, not a wrong answer');
const guided=evidence('guided','learn',0,t-1000,{grammarPhase:'guided',exposureGroup:'a'});
assert.equal(courseSkill([guided,e1,e2],t+2000,target).ready,false,'exposed answer family cannot immediately certify');

// A placement-exposed main-path item is practice, including its XP and feedback.
const placed={...e1,id:'placement-exposure',variantId:'one',exposureGroup:'one',outcome:'ungraded',ok:false,grammarPhase:'guided',assistance:['placement'],sessionId:'placement'};
const repeated=createCourseSession(lesson,{now:t+1000});repeated.courseV2.stepIndex=3;
const repeatResult=submitCourseAnswer(lesson,repeated,'È qui.',{now:t+2000,learning:{events:{placed}}});
assert(repeatResult.event.assistance.includes('recent-repeat'));
assert.equal(repeatResult.event.xp,0);assert(repeatResult.result.assisted);

// A repeated misconception needs two separated fresh successes. Previously
// learned contexts may be revisited later but cannot bypass that separation.
const secondLapse=evidence('bad-again','later',3,lapse.at+1000,{outcome:'incorrect',ok:false});
const firstRepair=evidence('a-return','repair',1,recovery.at,{contextId:'a',exposureGroup:'a'});
const tooSoon=evidence('b-return','repair',2,recovery.at+1000,{contextId:'b',exposureGroup:'b'});
assert.equal(courseSkill([e1,e2,lapse,secondLapse,firstRepair],firstRepair.at,target).ready,false);
assert.equal(courseSkill([e1,e2,lapse,secondLapse,firstRepair,tooSoon],tooSoon.at,target).ready,false,'adjacent checks cannot resolve a repeated misconception');
const secondRepair=evidence('new-return','repair',4,recovery.at+3000);
assert.equal(courseSkill([e1,e2,lapse,secondLapse,firstRepair,tooSoon,secondRepair],secondRepair.at,target).ready,true);

// Listening requires recorded audio and a hidden transcript.
const listening={...target,id:'v2-test.listen',modality:'listening',requiresProduction:false};
const listenLesson={...lesson,targets:[listening],steps:[{...q('listen','independent','choice','Sì'),target:listening.id,modality:'listening',audioId:'clip'}]};
const ls=createCourseSession(listenLesson,{now:t});
const lsub=submitCourseAnswer(listenLesson,ls,'Sì',{now:t,audioAvailable:false});
assert.ok(lsub.event.assistance.includes('transcript-or-audio-unavailable'));
assert.equal(courseSkill([lsub.event],t,listening).independentCorrect,0);

// Matching mistakes are durable without locking the task; the eventual correct event is assisted.
const matching={...q('match','independent','match',''),pairs:[{left:'uno',right:'one'},{left:'due',right:'two'}]};
const ml={...lesson,steps:[matching]};
const ms=createCourseSession(ml,{now:t});
const mismatch=recordCoursePairMismatch(ml,ms,{left:0,right:1,now:t});
assert.equal(mismatch.event.outcome,'incorrect');assert.equal(ms.courseV2.result,null);
const matched=submitCourseAnswer(ml,ms,[0,1],{now:t+1000});
assert.equal(matched.event.outcome,'correct');assert.equal(matched.result.assisted,true);

console.log('course-v2 engine and evidence: passed');

// A taught contrast with no dedicated guided item still gets a supported replay
// after an error; its only fresh reserve must remain available for transfer.
const contrast={...target,id:'v2-contrast.roles',facets:['familiar','polite'],requiresProduction:false};
const failedQ={...q('polite-first','independent','choice','Buongiorno'),target:contrast.id,facet:'polite'};
const reserveQ={...failedQ,id:'polite-reserve',contextKey:'office',reserve:true};
const cl={id:'v2-contrast',targets:[contrast],steps:[{id:'model',kind:'teach',introduces:[contrast.id]},failedQ,reserveQ]};
const cs=createCourseSession(cl);const empty={events:{}};advanceCourse(cl,cs,empty);submitCourseAnswer(cl,cs,'No');advanceCourse(cl,cs,empty);assert.equal(cs.courseV2.phase,'repair');advanceCourse(cl,cs,empty);assert.equal(currentCourseStep(cl,cs).step.id,'polite-first');assert.equal(currentCourseStep(cl,cs).step.stage,'guided');assert(!cs.courseV2.usedQuestions.includes('polite-reserve'));
