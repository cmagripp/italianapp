#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {data} from '../js/data.js';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createLearning,recordAttempt,skillState,setCompletionRecord,normalizeLearning,mergeLearning,resetLearning} from '../js/learning/model.js';
import {createJourneySession,currentJourneyStep,advanceJourney,journeyAttempt,recordJourneyAttempt,journeyPairAttempt,recordJourneyPairAttempt,journeyCaseProgress,skipJourneyTarget} from '../js/learning/journey.js';
import {caseCoverage,CASE_COVERAGE_POLICY} from '../js/learning/case-coverage.js';
import {journeyVisit,recordJourneyVisit,nextJourneyVisit} from '../js/learning/journey-visit.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
import {gradePairActivity} from '../js/learning/lesson-activities.js';
const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))).map(e=>({...e,kind:'verb'}));
data.verbs=verbs;data.byId=new Map(verbs.map(e=>[e.id,e]));
const entry=inf=>verbs.find(e=>e.inf===inf),norm=s=>String(s||'').normalize('NFC').trim().toLocaleLowerCase('it').replace(/\s+/g,' ');
let count=0;const test=(name,run)=>{run();count++;console.log('PASS',name);};
function traverse(inf,{learning=createLearning(1),chapterId='present',failOnce=false,failPair=false,legacy=false,skipBefore=null}={}){
 const e=entry(inf),plan=buildLesson(e),id=`pacing:${inf}:${chapterId}:${Object.keys(learning.events).length}`;
 let session=createJourneySession({id,plan,learning,now:1,chapterId,caseMode:true,...(legacy?{caseCoveragePolicy:null}:{})}),serial=Object.keys(learning.events).length,written=0,maxWritten=0,visit=journeyVisit(session),didFail=false;const trace=[],visits=[];
 if(skipBefore)for(let n=0;n<20&&currentJourneyStep(plan,session,learning).group?.id!==skipBefore;n++)session=skipJourneyTarget(plan,session,null,{now:1,learning});
 const expose=forms=>{session.ui||={exposures:{}};for(const form of forms||[])if(form)session.ui.exposures[norm(form)]=session.index;};
 const save=event=>{Object.assign(event,{deviceId:'pacing-test',sequence:++serial,epochId:learning.epoch.id});const result=recordAttempt(learning,event);learning=result.learning;return result;};
 for(let n=0;n<650;n++){
  const step=currentJourneyStep(plan,session,learning,serial+10);
  if(['recap','complete'].includes(step.type)){if(visit.eventIds.length)visits.push(visit.eventIds.length);return {plan,session,learning,trace,visits,maxWritten,didFail};}
  if(step.type==='teach')expose((step.card?.forms||[]).flatMap(f=>f.form.split(/\s*\/\s*/)));
  if(step.awaitingContinue||['teach','repair'].includes(step.type)){
   session=advanceJourney(plan,session,learning,{now:serial+10});
   if(visit.eventIds.length===visit.limit){visits.push(visit.eventIds.length);visit=nextJourneyVisit(session,visit);}
   continue;
  }
  assert.equal(step.type,'question',`${inf}/${chapterId} blocked ${step.reason}`);
  const q=buildJourneyQuestion(e,step.chapter,step.target,step);assert(q);
  trace.push({format:q.type,phase:step.phase,group:step.group.id,targetId:step.target.id});written=q.type==='type'?written+1:0;maxWritten=Math.max(maxWritten,written);
  const assistance=(q.meta.exposureForms||q.answer).some(a=>session.ui?.exposures[norm(a)]!==undefined&&session.index-session.ui.exposures[norm(a)]<1)?['visible-form']:[];
  expose(q.meta.promptExposureForms);expose((q.choices||[]).map(c=>c.value??c.label));
  if(q.type==='pairs')for(const p of q.pairs){
   let attempt=0;if(failPair&&!didFail){const bad=gradePairActivity(q,{targetId:p.targetId,given:'nonsense'}),event=journeyPairAttempt(plan,session,q,bad,{targetId:p.targetId,attempt,now:serial+10});assert(!bad.ok);session=recordJourneyPairAttempt(plan,session,event,save(event));didFail=true;attempt++;}
   const grade=gradePairActivity(q,{targetId:p.targetId,given:p.canonical}),event=journeyPairAttempt(plan,session,q,grade,{targetId:p.targetId,attempt,now:serial+10});if(event)session=recordJourneyPairAttempt(plan,session,event,save(event));expose(p.answers);
  }
  const fail=failOnce&&!didFail&&step.phase==='independent'&&step.group.id===(skipBefore||'singular');
  const grade=gradeQuestion(q,fail?'nonsense':q.answer[0]);if(fail)didFail=true;else assert(grade.ok);
  const event=journeyAttempt(plan,session,q,grade,{assistance,now:serial+10});assert(event);session=recordJourneyAttempt(plan,session,event,save(event));
  visit=recordJourneyVisit(session,visit,event);const again=recordJourneyVisit(session,visit,event);assert.deepEqual(again,visit,'reload cannot count a screen twice');expose(q.answer);expose(q.meta.feedbackExposureForms);
 }
 throw new Error(`${inf} did not finish`);
}
let cold,old;
test('New cases cover every target and halve production while historical sessions keep consolidation',()=>{
 cold=traverse('parlare');old=traverse('parlare',{legacy:true});
 assert.equal(cold.trace.length,24);assert.equal(cold.trace.filter(t=>t.format==='type').length,16);assert.equal(cold.visits.length,3);
 assert.equal(old.trace.length,42);assert.equal(old.trace.filter(t=>t.format==='type').length,32);
 assert.equal(old.session.journey.caseCoveragePolicy,undefined);
 const coverage=caseCoverage(cold.plan,cold.learning,'present',{sessionId:cold.session.id});assert(coverage.complete);
 for(const state of coverage.states.values()){assert(state.supported,state.id);assert(state.production,state.id);assert(state.covered,state.id);assert(skillState(cold.learning,state.id).independentCorrect>=1,state.id);}
 assert(journeyCaseProgress(cold.plan,cold.learning).cases.find(c=>c.id==='present').ready);
 assert.equal(skillState(cold.learning,'v:parlare::lesson::present::form-0').ready,false);
 assert(skillState(old.learning,'v:parlare::lesson::present::form-0').ready);
});
test('Representative regular, irregular, pronominal, weather and other cases finish within bounded visits',()=>{
 for(const [inf,chapterId] of [['credere','present'],['dire','present'],['alzarsi','present'],['andarsene','present'],['piovere','present'],['parlare','past'],['parlare','future'],['parlare','background']]){
  const h=traverse(inf,{chapterId});assert(h.visits.every(n=>n<=8));assert(h.visits.length<=3);assert(journeyCaseProgress(h.plan,h.learning).cases.find(c=>c.id===chapterId).ready);assert(h.trace.some(t=>['mc','pairs','letters'].includes(t.format)));
 }
});
test('Recognition, assisted production, a forced last match and a cursor cannot fabricate coverage',()=>{
 const mutate=change=>{const l=JSON.parse(JSON.stringify(cold.learning));change(l);return normalizeLearning(l);};
 const noProduction=mutate(l=>{for(const e of Object.values(l.events))if(e.mode==='production')e.mode='recognition';});assert.equal(caseCoverage(cold.plan,noProduction,'present').complete,false);
 const helped=mutate(l=>{for(const e of Object.values(l.events))if(e.mode==='production')e.assistance=['visible-form'];});assert.equal(caseCoverage(cold.plan,helped,'present').complete,false);
 const forced=mutate(l=>{for(const e of Object.values(l.events))if(e.id.includes(':pair:'))e.assistance=['matching','forced-last-pair'];});assert.equal(skillState(forced,'v:parlare::lesson::present::form-1').independentCorrect,1);assert.equal(skillState(forced,'v:parlare::lesson::present::form-1').ready,false);
 const blank=createLearning(1);blank.sessions[cold.session.id]=cold.session;assert.equal(caseCoverage(cold.plan,blank,'present').complete,false);
});
test('Last mixed transfer follows all form coverage and uses fresh situations',()=>{
 const c=caseCoverage(cold.plan,cold.learning,'present',{sessionId:cold.session.id});const finalIds=cold.plan.chapters.find(ch=>ch.id==='present').groups.filter(g=>g.finalReview).flatMap(g=>g.targets).map(t=>t.id);
 const events=Object.values(cold.learning.events),lastNonfinal=Math.max(...events.filter(e=>e.mode==='production'&&!finalIds.includes(e.objectiveId)).map(e=>e.index));
 for(const id of finalIds){const state=c.states.get(id),event=cold.learning.events[state.productionEventId];assert(event.index>lastNonfinal);assert(!state.guidedContexts.includes(state.productionContextId));}
 const reused=JSON.parse(JSON.stringify(cold.learning));for(const e of Object.values(reused.events))if(finalIds.includes(e.objectiveId)&&e.mode==='production')e.contextId=c.states.get(e.objectiveId).guidedContexts[0];
 assert.equal(caseCoverage(cold.plan,normalizeLearning(reused),'present').complete,false);
});
test('Wrong answers require targeted successful repair then a fresh whole-form production',()=>{
 const h=traverse('parlare',{failOnce:true});assert(h.didFail);assert(h.trace.some(t=>t.phase==='repair'));assert(caseCoverage(h.plan,h.learning,'present').complete);
 const bad=Object.values(h.learning.events).find(e=>!e.ok),later=Object.values(h.learning.events).filter(e=>e.objectiveId===bad.objectiveId&&e.index>bad.index);
 assert(later.some(e=>e.activityKind==='repair'&&e.ok));assert(later.some(e=>e.mode==='production'&&e.ok&&!e.assistance.length));
 const noRepair=JSON.parse(JSON.stringify(h.learning));for(const e of Object.values(noRepair.events))if(e.activityKind==='repair')delete noRepair.events[e.id];assert.equal(caseCoverage(h.plan,normalizeLearning(noRepair),'present').complete,false);
});
test('A wrong match remains a repair obligation even after the board is correctly finished',()=>{
 const h=traverse('parlare',{failPair:true});assert(h.didFail);assert(caseCoverage(h.plan,h.learning,'present').complete);
 const bad=Object.values(h.learning.events).find(e=>!e.ok),later=Object.values(h.learning.events).filter(e=>e.objectiveId===bad.objectiveId&&e.index>bad.index);
 assert(later.some(e=>e.activityKind==='repair'&&e.ok));assert(later.some(e=>e.mode==='production'&&e.ok&&!e.assistance.length));
});
test('Skipped simple forms cannot trap a progressive visit in uncreditable final transfers',()=>{
 const h=traverse('parlare',{skipBefore:'progressive',failOnce:true});assert(h.didFail);assert(h.trace.some(t=>t.phase==='repair'));
 assert(h.trace.length<=20,'The partial visit has a finite supported/unaided/repair budget');
 const coverage=caseCoverage(h.plan,h.learning,'present',{sessionId:h.session.id});assert.equal(coverage.complete,false);
 const chapter=h.plan.chapters.find(c=>c.id==='present'),progressive=chapter.groups.find(g=>g.id==='progressive');
 for(const target of progressive.targets.filter(t=>t.available!==false&&(t.required!==false||t.completionRequired)&&!t.supplementalOnly))assert(coverage.states.get(target.id).covered,target.id);
 const wrong=Object.values(h.learning.events).find(e=>!e.ok),later=Object.values(h.learning.events).filter(e=>e.objectiveId===wrong.objectiveId&&e.index>wrong.index);
 assert(later.some(e=>e.activityKind==='repair'&&e.ok));assert(later.some(e=>e.mode==='production'&&e.ok&&!e.assistance.length));
 assert.equal(journeyCaseProgress(h.plan,h.learning).cases.find(c=>c.id==='present').ready,false);
 for(const target of chapter.groups.filter(g=>g.finalReview).flatMap(g=>g.targets))assert(Object.hasOwn(h.session.deferred,target.id),'Final transfers are explicitly saved for later');
 const legacy=traverse('parlare',{skipBefore:'progressive',failOnce:true,legacy:true});assert(legacy.didFail);assert.equal(legacy.session.journey.caseCoveragePolicy,undefined);
 const legacyWrong=Object.values(legacy.learning.events).find(e=>!e.ok),legacyLater=Object.values(legacy.learning.events).filter(e=>e.objectiveId===legacyWrong.objectiveId&&e.index>legacyWrong.index);
 assert(legacyLater.some(e=>e.activityKind==='repair'&&e.ok));assert(legacyLater.filter(e=>e.mode==='production'&&e.ok&&!e.assistance.length).length>=2,'Historical failed constructions retain two later unaided successes');
});
test('Normalization, merge and reset preserve policy without regrading historical events',()=>{
 const normalized=normalizeLearning(cold.learning),merged=mergeLearning(createLearning(1),normalized);assert(caseCoverage(cold.plan,merged,'present').complete);
 assert(Object.values(merged.events).every(e=>e.caseCoveragePolicy===CASE_COVERAGE_POLICY));assert(Object.values(old.learning.events).every(e=>e.caseCoveragePolicy===undefined));
 assert.equal(caseCoverage(cold.plan,resetLearning(merged,10000,'reset-pacing'),'present').complete,false);
 const clock=JSON.parse(JSON.stringify(cold.learning));for(const event of Object.values(clock.events))event.at=10000-event.index;
 assert(caseCoverage(cold.plan,normalizeLearning(clock),'present').complete,'session ordering survives a backward wall clock');
});
test('Manual uncheck fences old coverage and historical completion remains available',()=>{
 const unchecked=setCompletionRecord(cold.learning,{entryId:'v:parlare',caseId:'present',checked:false,id:'uncheck',at:10000});assert.equal(caseCoverage(cold.plan,unchecked,'present').complete,false);assert.equal(journeyCaseProgress(cold.plan,unchecked).cases.find(c=>c.id==='present').ready,false);
 const manual=setCompletionRecord(createLearning(1),{entryId:'v:parlare',caseId:'present',checked:true,id:'manual',at:5,flowVersion:2});assert(journeyCaseProgress(cold.plan,manual).cases.find(c=>c.id==='present').ready);assert.equal(caseCoverage(cold.plan,manual,'present').complete,false);
});
test('Visit counts survive serialization, exclude pair sub-rows and remain a presentation boundary',()=>{
 let visit=journeyVisit(cold.session,{...journeyVisit(cold.session),eventIds:cold.session.answeredEventIds.filter(id=>!id.includes(':pair:')).slice(0,8),boundary:true});
 assert.equal(visit.eventIds.length,8);assert.deepEqual(journeyVisit(cold.session,JSON.parse(JSON.stringify(visit))),visit);
 const next=nextJourneyVisit(cold.session,visit);assert.equal(next.eventIds.length,0);assert.equal(next.number,visit.number+1);assert.equal(journeyCaseProgress(cold.plan,cold.learning).cases.find(c=>c.id==='present').ready,true);
});
console.log(`${count} journey pacing checks passed.`);
