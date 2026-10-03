#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {progressiveForms,progressiveContexts,simpleVerbContexts} from '../js/learning/progressive-content.js';
import {createLearning,recordAttempt,normalizeLearning,skillState,setCompletionRecord} from '../js/learning/model.js';
import {createJourneySession,currentJourneyStep,advanceJourney,journeyAttempt,recordJourneyAttempt,journeyPairAttempt,recordJourneyPairAttempt,skipJourneyTarget,journeyCaseProgress,journeyStageProgress,upgradeVerbJourneySession,chooseJourneyChapter,retryJourneyPending,reconcileJourneyReview} from '../js/learning/journey.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
import {gradePairActivity} from '../js/learning/lesson-activities.js';
const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))),verb=inf=>({...verbs.find(e=>e.inf===inf),kind:'verb'});
let count=0;
const test=(name,run)=>{run();count++;console.log('PASS',name);};
function runLesson(inf,{chapterId='present',injectError=false,skipProgressive=false}={}){
 const entry=verb(inf),plan=buildLesson(entry);let learning=createLearning(1),serial=0,session=createJourneySession({id:`v2-${inf}`,plan,now:1,chapterId,caseMode:true,caseCoveragePolicy:null});
 const trace=[];let didError=false;
 const norm=s=>String(s||'').normalize('NFC').trim().toLocaleLowerCase('it').replace(/\s+/g,' ');
 const expose=forms=>{session.ui||={exposures:{}};for(const form of forms||[])if(form)session.ui.exposures[norm(form)]=session.index;};
 const save=event=>{Object.assign(event,{deviceId:'v2-test',sequence:++serial,epochId:learning.epoch.id});const result=recordAttempt(learning,event);learning=result.learning;return result;};
 for(let i=0;i<1000;i++){
  const step=currentJourneyStep(plan,session,learning,serial+10);
  trace.push({type:step.type,group:step.group?.id,stage:journeyStageProgress(plan,session,learning)?.find(s=>s.current)?.id,target:step.target?.id,phase:step.phase});
  if(['recap','complete'].includes(step.type))return {entry,plan,session,learning,trace,didError};
  if(skipProgressive&&step.group?.id==='progressive'&&step.type==='teach'){session=skipJourneyTarget(plan,session,null,{learning,now:serial+10});continue;}
  if(step.type==='teach'){
   for(const row of step.card?.forms||[])expose(row.form.split(/\s*\/\s*/));
   const shown=norm([step.card?.body,...(step.card?.notes||[]),...(step.card?.examples||[]).map(x=>x.it)].join(' '));
   for(const target of step.chapter.groups.flatMap(g=>g.targets||[])){const q=buildJourneyQuestion(entry,step.chapter,target);expose(q?.answer.filter(a=>shown.includes(norm(a))));}
  }
  if(step.awaitingContinue||['teach','repair'].includes(step.type)){session=advanceJourney(plan,session,learning,{now:serial+10});continue;}
  assert.equal(step.type,'question',`${inf} stalled: ${step.type}/${step.reason}; ${JSON.stringify(trace.slice(-8))}`);
  const q=buildJourneyQuestion(entry,step.chapter,step.target,step);assert(q,step.target.id);
  if(inf==='viaggiare'&&q.meta.skill==='progressive'&&!q.meta.scaffold){
   const expected=['sto viaggiando','stai viaggiando','sta viaggiando','stiamo viaggiando','state viaggiando','stanno viaggiando'];
   assert(q.answer.includes(expected[q.meta.person]),'Independently checked travel construction');
   assert(!/mangi|parlando/.test(q.context?.it||''),'No unrelated verb fallback');
  }
  const assistance=(q.meta.exposureForms||q.answer).some(a=>session.ui?.exposures[norm(a)]!==undefined&&session.index-session.ui.exposures[norm(a)]<1)?['visible-form']:[];
  expose(q.meta.promptExposureForms);expose(q.choices.map(c=>c.value??c.label));
  if(q.type==='pairs')for(const pair of q.pairs){const grade=gradePairActivity(q,{targetId:pair.targetId,given:pair.canonical});const event=journeyPairAttempt(plan,session,q,grade,{targetId:pair.targetId,now:serial+10});session=recordJourneyPairAttempt(plan,session,event,save(event));expose(pair.answers);}
  const fail=injectError&&!didError&&step.group?.finalReview&&step.target.progressive&&step.phase==='independent';
  const grade=gradeQuestion(q,fail?'sono viaggiando':q.answer[0]);if(fail){didError=true;assert(grade.errorTags.includes('auxiliary'));}else assert(grade.ok,JSON.stringify(q));
  const event=journeyAttempt(plan,session,q,grade,{assistance,now:serial+10});assert(event);
  session=recordJourneyAttempt(plan,session,event,save(event));expose(q.answer);expose(q.meta.feedbackExposureForms);
 }
 throw new Error(`${inf} exceeded traversal bound ${JSON.stringify(trace.slice(-15))}`);
}
test('Viaggiare uses travel contexts, all stare people, and genuinely different held-out scenes',()=>{
 const e=verb('viaggiare'),p=buildLesson(e),ch=p.chapters.find(c=>c.id==='present');
 assert.deepEqual(ch.groups.map(g=>g.id),['singular','plural','use','progressive','mixed-review']);
 assert(!JSON.stringify(ch).includes('Four ways to describe eating'));
 assert.deepEqual(progressiveForms(e,0),['sto viaggiando']);
 const initial=progressiveContexts(e),mixed=progressiveContexts(e,{section:'mixed'});
 assert(initial.length>=14&&mixed.length>=14);
 assert(initial.every(c=>!mixed.some(m=>m.id===c.id||m.it===c.it)));
 assert(initial.some(c=>c.role==='formal'&&c.answer==='sta viaggiando'));
 assert(simpleVerbContexts(e).some(c=>c.it==='Io viaggio in treno.'));
});
test('Mixed review explains a valid alternative viewpoint without calling the Italian form invalid',()=>{
 const e=verb('viaggiare'),ch=buildLesson(e).chapters.find(c=>c.id==='present');
 for(const target of ch.groups.at(-1).targets){const q=buildJourneyQuestion(e,ch,target),answer=target.progressive?'viaggio':'sto viaggiando',result=gradeQuestion(q,answer);assert.deepEqual(result.errorTags,['viewpoint']);assert.match(result.feedback,/can be valid Italian/);}
});
let completed;
test('Present completes only after section practice and explicit mixed review; errors stay within mixed review',()=>{
 completed=runLesson('viaggiare',{injectError:true});assert(completed.didError);
 const {trace,plan,learning}=completed,stages=trace.map(t=>t.stage).filter(Boolean);
 const firstProgressive=stages.indexOf('progressive'),firstMixed=stages.indexOf('mixed');
 assert(firstProgressive>0&&firstMixed>firstProgressive);
 assert(!stages.slice(firstProgressive).includes('forms'));
 assert(!stages.slice(firstMixed).includes('progressive'));
 const ch=plan.chapters.find(c=>c.id==='present'),review=ch.groups.at(-1);
 assert(review.targets.some(t=>t.progressive)&&review.targets.some(t=>!t.progressive));
 for(const t of review.targets){const s=skillState(learning,t.id);assert(s.ready);assert(s.independentCorrect>=2);assert(s.variantCount>=2);}
 assert.equal(journeyCaseProgress(plan,learning).cases.find(c=>c.id==='present').ready,true);
 assert(trace.some(t=>t.type==='repair'&&t.stage==='mixed'));
});
test('Skipping progressive leaves it and the dependent final review pending',()=>{
 const {plan,learning,session}=runLesson('viaggiare',{skipProgressive:true});
 assert.equal(journeyCaseProgress(plan,learning).cases.find(c=>c.id==='present').ready,false);
 const target=plan.chapters.find(c=>c.id==='present').groups.at(-1).targets.find(t=>t.progressive);
 assert(session.deferred[target.id]);assert.equal(skillState(learning,target.id).attempts,0);
});
test('Statives finish an appropriate usage lesson without invented progressive answers',()=>{
 const h=runLesson('credere');assert(h.trace.some(t=>t.stage==='progressive'));assert(h.trace.some(t=>t.stage==='mixed'));
 assert(!h.plan.chapters.find(c=>c.id==='present').groups.flatMap(g=>g.targets).some(t=>t.progressive));
});
test('Reopening a case preserves skipped prerequisites; explicit retry returns to teaching',()=>{
 const plan=buildLesson(verb('viaggiare')),learning=createLearning(1);
 let session=createJourneySession({id:'skipped-case-resume',plan,now:1,chapterId:'present',caseMode:true});
 while(currentJourneyStep(plan,session,learning).group.id!=='progressive')session=skipJourneyTarget(plan,session,null,{learning,now:10});
 session=skipJourneyTarget(plan,session,null,{learning,now:11});
 const skipped={...session.journey.skipped},deferred={...session.deferred};
 const dependent='v:viaggiare::lesson::present::v2-mixed-progressive';assert(skipped[dependent]);
 session=chooseJourneyChapter(plan,session,'present',{learning,now:12});
 assert.deepEqual(session.journey.skipped,skipped);assert.deepEqual(session.deferred,deferred);
 session=chooseJourneyChapter(plan,session,'background',{learning,now:13});
 session=chooseJourneyChapter(plan,session,'present',{learning,now:14});
 assert.equal(currentJourneyStep(plan,session,learning).group.id,'mixed-review');
 assert.deepEqual(session.journey.skipped,skipped);assert.deepEqual(session.deferred,deferred);
 session=retryJourneyPending(plan,session,learning,{now:15});
 assert.equal(currentJourneyStep(plan,session,learning).type,'teach');
 assert.equal(currentJourneyStep(plan,session,learning).group.id,'singular');assert(!session.journey.skipped[dependent]);
});
test('Weather has enough meaningful spacing activities to finish present and past progressive',()=>{
 for(const chapterId of ['present','background']){const h=runLesson('piovere',{chapterId});assert.equal(journeyCaseProgress(h.plan,h.learning).cases.find(c=>c.id===chapterId).ready,true);}
});
test('Changing prompt language cannot count one situation as two independent contexts',()=>{
 let l=createLearning(1);const id='v:viaggiare::lesson::present::v2-test';
 for(let n=1;n<=8;n++)l=recordAttempt(l,{id:`event-${n}`,objectiveId:n%3===1?id:'other',entryId:'v:viaggiare',kind:'verb',skill:'progressive',policy:'journey-v1',contentVersion:1,contextPolicy:'distinct-scene',chapterId:'present',sessionId:'one',index:n,deviceId:'test',sequence:n,at:n,epochId:l.epoch.id,ok:true,outcome:'correct',mode:'production',activityKind:'independent',firstAttempt:true,assistance:[],variantId:`cue-${n}`,contextId:'same-situation',person:0}).learning;
 const state=skillState(normalizeLearning(l),id);assert(state.independentCorrect>=2);assert.equal(state.variantCount,1);assert.equal(state.ready,false);
 const oldClient=JSON.parse(JSON.stringify(l));for(const e of Object.values(oldClient.events))delete e.contextPolicy;assert.equal(skillState(normalizeLearning(oldClient),id).variantCount,1,'durable target ids retain policy through older clients');
});
test('Migration preserves evidence, cursor serial, saved drafts and completed historical cases',()=>{
 const e=verb('viaggiare'),oldPlan=buildLesson(e,{legacy:true}),newPlan=buildLesson(e);
 let old=createJourneySession({id:'old',plan:oldPlan,now:1,chapterId:'present'});old.ui={version:2,draft:'viagg',exposures:{viaggio:1}};old.journey.serial=41;old.index=19;
 const l=createLearning(1),upgraded=upgradeVerbJourneySession(newPlan,old,l,{now:2});
 assert.equal(upgraded.id,old.id);assert.equal(upgraded.index,19);assert.equal(upgraded.journey.serial,41);assert.equal(upgraded.ui.draft,'viagg');assert.equal(upgraded.verbFlowArchive.ui.draft,'viagg');
 assert.deepEqual(upgradeVerbJourneySession(newPlan,upgraded,l),upgraded);
 const manual=setCompletionRecord(l,{entryId:e.id,caseId:'present',checked:true,id:'manual-old',at:2});
 const state=journeyCaseProgress(newPlan,manual).cases.find(c=>c.id==='present');assert(state.ready);assert(state.updateAvailable);
 const current=setCompletionRecord(l,{entryId:e.id,caseId:'present',checked:true,id:'manual-new',at:3,flowVersion:2});
 assert(!journeyCaseProgress(newPlan,current).cases.find(c=>c.id==='present').updateAvailable);
});
test('Review excludes unlearned v2 targets on creation and when reopening a saved cursor',()=>{
 const e=verb('viaggiare'),plan=buildLesson(e),newTarget=plan.chapters.find(c=>c.id==='mixed').groups[0].targets.find(t=>t.flowVersion===2&&t.sourceChapter==='present');
 const oldKnown=setCompletionRecord(createLearning(1),{entryId:e.id,caseId:'present',checked:true,id:'old-manual',at:2});
 const fresh=createJourneySession({id:'fresh-review',plan,learning:oldKnown,mode:'review',chapterId:'mixed',targetId:newTarget.id,now:3});
 assert.notEqual(currentJourneyStep(plan,fresh,oldKnown,4).type,'question');
 const blank=createLearning(1),neverLearned=createJourneySession({id:'never-learned-review',plan,learning:blank,mode:'review',chapterId:'mixed',targetId:newTarget.id,now:3});
 assert.notEqual(currentJourneyStep(plan,neverLearned,blank,4).type,'question');
 const legacy=createJourneySession({id:'legacy-review',plan,learning:oldKnown,mode:'review',chapterId:'mixed',now:3});
 assert(legacy.journey.current?.targetId.endsWith('::mixed::present'));
 assert(!legacy.journey.queue.includes(newTarget.id));
 const stale=createJourneySession({id:'stale-review',plan,mode:'review',chapterId:'mixed',targetId:newTarget.id,now:3});
 assert.equal(currentJourneyStep(plan,stale,oldKnown,4).reason,'review-target-not-learned');
 const recovered=reconcileJourneyReview(plan,stale,oldKnown,{now:4});
 assert.equal(recovered.id,stale.id);assert.notEqual(currentJourneyStep(plan,recovered,oldKnown,5).type,'question');
 stale.journey.pairRepairs={[newTarget.id]:{id:'saved-pair-failure',targetId:newTarget.id,variant:0,errorTags:[]}};
 const retried=retryJourneyPending(plan,stale,oldKnown,{now:5});
 assert.notEqual(currentJourneyStep(plan,retried,oldKnown,6).type,'repair','saved pair repair must also obey review eligibility');
 const updatedKnown=setCompletionRecord(createLearning(1),{entryId:e.id,caseId:'present',checked:true,id:'verb-flow-v2:manual-new',at:2,flowVersion:2});
 const allowed=createJourneySession({id:'known-review',plan,learning:updatedKnown,mode:'review',chapterId:'mixed',targetId:newTarget.id,now:3});
 assert.equal(currentJourneyStep(plan,allowed,updatedKnown,4).target.id,newTarget.id);
 const learnedTarget=plan.chapters.find(c=>c.id==='present').groups.find(g=>g.id==='progressive').targets.find(t=>t.progressive);
 assert(skillState(completed.learning,learnedTarget.id).readyPeriods.length);
 const unchecked=setCompletionRecord(completed.learning,{entryId:e.id,caseId:'present',checked:false,id:'manual-uncheck',at:Date.now()+100000});
 assert.equal(journeyCaseProgress(plan,unchecked).cases.find(c=>c.id==='present').ready,false);
 const withheld=createJourneySession({id:'unchecked-review',plan,learning:unchecked,mode:'review',chapterId:'present',targetId:learnedTarget.id,now:Date.now()+100001});
 assert.notEqual(currentJourneyStep(plan,withheld,unchecked,Date.now()+100002).type,'question','unchecked case cannot enter review even with older target evidence');
});
console.log(`${count} verb flow v2 checks passed.`);
