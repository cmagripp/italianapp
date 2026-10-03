import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
import {createJourneySession,pinJourneyScene,currentJourneyStep,journeyAttempt,recordJourneyAttempt,advanceJourney,upgradeVerbJourneySession,chooseJourneyChapter,retryJourneyPending} from '../js/learning/journey.js';
import {createLearning,recordAttempt,normalizeLearning,mergeLearning,setCompletionRecord} from '../js/learning/model.js';
const entry=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))).find(e=>e.inf==='trattarsi');
const plan=buildLesson(entry,{questionBuilder:buildJourneyQuestion}),copy=structuredClone;
const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/trattarsi-compatibility-legacy.json',import.meta.url)));
const rows=fixture.records.filter(r=>r.targetId.endsWith('progressive-usage'));
assert.equal(rows.length,4);
let answers=0,continuations=0,tamperFences=0,caseReopens=0,mixedEnrollment=0;
function seed(row){
 const chapter=plan.questionHistory.ordinaryChapters.find(c=>c.id===row.chapterId),groupIndex=chapter.groups.findIndex(g=>g.targets.some(t=>t.id===row.targetId));
 const s=createJourneySession({id:'prior-only-'+row.chapterId+row.variant,plan,chapterId:row.chapterId,caseMode:true,now:1});
 Object.assign(s.journey,{phase:'guided',groupIndex,queue:[row.targetId],current:{targetId:row.targetId,phase:row.phase,format:row.format,variant:row.variant,questionId:s.id+':saved',supplemental:false,repairTag:null,
  questionRevision:plan.questionHistory.previousRevision,formSnapshot:{version:1,entryId:entry.id,targetId:row.targetId,chapterId:row.chapterId,sourceRevision:plan.questionHistory.previousRevision,scenePolicy:null,variant:row.variant,format:row.format,phase:row.phase,repairTag:null,descriptor:copy(row.descriptor)}}});
 delete s.journey.verbFlowVersion;
 s.journey.legacyFlow=true;
 s.ui={draft:'  original draft  ',history:[{given:'original answer'}],result:null};
 return pinJourneyScene(plan,s);
}
for(const row of rows)for(const correct of [true,false]){
 const s=seed(row),step=currentJourneyStep(plan,s);assert.equal(step.type,'question');
 assert(!plan.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets)).some(t=>t.id===row.targetId));
 const q=buildJourneyQuestion(entry,step.chapter,step.target,step);assert(q);
 const given=correct?q.answer[0]:q.choices.find(c=>!c.correct).label,grade=gradeQuestion(q,given),event=journeyAttempt(plan,s,q,grade,{now:10});
 assert(event);assert.equal(event.ok,correct);assert.equal(event.objectiveId,row.targetId);assert.equal(event.skill,'progressiveUsage');assert.equal(event.mode,'recognition');
 const learning=createLearning(1);Object.assign(event,{epochId:learning.epoch.id,deviceId:'fixture',sequence:1,xp:0});
 const result=recordAttempt(learning,event);assert(result.added);
 let answered=recordJourneyAttempt(plan,s,event,result);assert(answered.journey.awaitingContinue);assert.equal(answered.index,1);answers++;
 answered.ui={...answered.ui,given,result:grade};
 result.learning.session=answered;result.learning.sessions[entry.id+'|lesson']=answered;
 const normalized=normalizeLearning(copy(result.learning),11),merged=mergeLearning(normalized,createLearning(1),12);
 assert.deepEqual(merged.session.journey.current.formSnapshot,s.journey.current.formSnapshot);
 assert.deepEqual(merged.session.ui,answered.ui);assert.equal(currentJourneyStep(plan,merged.session).type,'question');
 const before=copy(merged),next=advanceJourney(plan,merged.session,merged,{now:15}),nextStep=currentJourneyStep(plan,next,merged);
 assert.equal(nextStep.type,'teach');assert.equal(nextStep.group.id,'progressive');assert.match(nextStep.card.title,/natural usage/);
 assert.equal(next.journey.verbFlowVersion,2);assert.deepEqual(next.verbFlowArchive.journey,merged.session.journey);assert.deepEqual(next.verbFlowArchive.ui,merged.session.ui);
 assert.deepEqual(upgradeVerbJourneySession(plan,next,merged,{now:16}),next,'The view must not replace the already-current teaching page with another migration.');
 assert.equal(next.journey.legacyFlow,false);
 const other=chooseJourneyChapter(plan,next,row.chapterId==='present'?'background':'present',{now:17,learning:merged});
 const reopened=chooseJourneyChapter(plan,other,row.chapterId,{now:18,learning:merged});
 assert.equal(reopened.journey.verbFlowVersion,2);assert.equal(reopened.journey.legacyFlow,false);
 assert.equal(currentJourneyStep(plan,reopened,merged).group.id,'progressive');
 assert.equal(upgradeVerbJourneySession(plan,reopened,merged,{now:19}),reopened);caseReopens++;
 assert.equal(next.index,answered.index);assert.deepEqual(next.answeredEventIds,answered.answeredEventIds);assert.deepEqual(merged,before);
 assert(!next.journey.queue.includes(row.targetId));
 const receipt=next.sceneCorrectionRecovery.at(-1);assert.equal(receipt.reason,'prior-target-finished');assert.deepEqual(receipt.journey,merged.session.journey);assert.deepEqual(receipt.ui,merged.session.ui);
 assert.equal(journeyAttempt(plan,next,q,grade),null);continuations++;
 // A receipt saved in the old repair-teach state also moves safely to current
 // teaching without dereferencing a target that no longer exists.
 if(!correct){const oldRepair=copy(answered);oldRepair.journey.awaitingContinue=false;oldRepair.journey.phase='repair-teach';const recovered=advanceJourney(plan,oldRepair,result.learning,{now:16});assert.equal(currentJourneyStep(plan,recovered).type,'teach');assert.equal(recovered.index,oldRepair.index);continuations++;}
 for(const alter of [s=>s.journey.current.formSnapshot.sourceRevision='future-unknown',s=>s.journey.current.formSnapshot.descriptor.answer=['invented']]){
  const bad=copy(answered);alter(bad);const beforeBad=copy(bad);assert.equal(currentJourneyStep(plan,bad).type,'unavailable');assert.equal(journeyAttempt(plan,bad,q,grade),null);assert.deepEqual(advanceJourney(plan,bad,result.learning),beforeBad);tamperFences++;
 }
}
// Mixed checkpoints must not requeue unfinished source cases that the scheduler
// excludes. Test an empty enrollment and a single explicitly completed case.
for(const enrolled of [false,true])for(const phase of ['practice','checkpoint']){
 let learning=createLearning(1);if(enrolled)learning=setCompletionRecord(learning,{entryId:entry.id,caseId:'background',checked:true,flowVersion:2,source:'manual',at:2,id:'manual-background'},2);
 const chapter=plan.chapters.find(c=>c.id==='mixed'),target=chapter.groups.flatMap(g=>g.targets).find(t=>t.sourceChapter==='background');
 let s=createJourneySession({id:`mixed-enrollment-${phase}-${enrolled}`,plan,chapterId:'mixed',caseMode:true,now:3});
 Object.assign(s.journey,{phase,groupIndex:0,queue:chapter.groups.flatMap(g=>g.targets).map(t=>t.id),current:{targetId:target.id,phase:'independent',format:'type',variant:0,questionId:s.id+':old',supplemental:false,repairTag:null,scenePolicy:'expanded-v1',questionRevision:plan.questionHistory.previousRevision}});
 s=pinJourneyScene(plan,s);const step=currentJourneyStep(plan,s);assert.equal(step.type,'question');
 const q=buildJourneyQuestion(entry,step.chapter,step.target,step),event=journeyAttempt(plan,s,q,gradeQuestion(q,q.answer[0]),{now:4});assert(event);
 Object.assign(event,{epochId:learning.epoch.id,deviceId:'mixed-fixture',sequence:1,xp:0});const result=recordAttempt(learning,event);s=recordJourneyAttempt(plan,s,event,result);
 const before=copy(result.learning),next=advanceJourney(plan,s,result.learning,{now:5});assert.deepEqual(result.learning,before);
 assert.equal(next.index,s.index);assert.deepEqual(next.answeredEventIds,s.answeredEventIds);assert.equal(next.journey.awaitingContinue,false);
 if(!enrolled){assert.equal(next.journey.phase,'recap');const retried=retryJourneyPending(plan,next,result.learning,{now:6});assert.equal(retried.journey.phase,'recap');assert.equal(retried.journey.current,null);}
 else{
  if(next.journey.current)assert.equal(next.journey.current.targetId,target.id);
  const fresh=copy(s);fresh.journey.current=null;fresh.journey.awaitingContinue=false;fresh.journey.lastAttempt=null;fresh.journey.phase='recap';fresh.journey.lastAnswered={};fresh.ui={};
  const retried=retryJourneyPending(plan,fresh,learning,{now:6});assert.equal(retried.journey.current?.targetId,target.id,'A completed source case remains available for mixed review before any new answer.');
 }
 mixedEnrollment++;
}
const report={status:'passed',baseline:fixture.baseline||'8517db3',answers,continuations,tamperFences,caseReopens,mixedEnrollment,scope:'Exact archived ordinary-only usage questions: actual answer events, no-credit current teaching transition, case-switch reopens, normalization/merge, wrong-answer recovery, mixed review enrollment, and unavailable imported-recipe fences.'};
console.log(JSON.stringify(report,null,2));if(process.argv.includes('--report'))fs.writeFileSync(new URL('../docs/implementation/programme/prior-only-journey-targets.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
