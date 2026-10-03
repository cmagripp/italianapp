#!/usr/bin/env node
// A2/B1 bounded editorial release gate. Runtime recovery is also exercised by
// test-course-v2-content --available --recovery. No proficiency inference.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {refinePhase6IntermediatePack} from './phase6-intermediate.mjs';
import {CORE_STAGES} from '../js/learning/curriculum.js';
import {assessCourseAnswer,createCourseSession,currentCourseStep,submitCourseAnswer,advanceCourse} from '../js/learning/course-v2-engine.js';
import {createLearning,recordAttempt} from '../js/learning/model.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url)));
const levels=['A2','B1'],packs=levels.map(level=>read('data/course-v2/'+level+'.json'));
const all=new Map(['Foundations','A1','A2','B1','B2','C1','C2'].flatMap(level=>read('data/course-v2/'+level+'.json').units.flatMap(u=>u.lessons)).map(l=>[l.id,l]));
const added=packs.flatMap(p=>p.units.flatMap(u=>u.lessons)).filter(l=>l.editorial?.version==='phase6-intermediate-1');
assert.equal(added.length,24);
let preserved=0;
for(const pack of packs){
 const rebuilt=refinePhase6IntermediatePack(structuredClone(pack));
 assert.deepEqual(rebuilt,pack,pack.level+': source compilation is not idempotent');
 const baseline=JSON.parse(execFileSync('git',['show','7eeeb36:data/course-v2/'+pack.level+'.json'],{encoding:'utf8'}));
 const lessons=new Map(pack.units.flatMap(u=>u.lessons).map(l=>[l.id,l]));
 for(const old of baseline.units.flatMap(u=>u.lessons)){
  const retained=lessons.get(old.id);assert(retained,old.id+': retained lesson missing');
  assert.deepEqual(retained,old,old.id+': historical source changed');preserved++;
 }
}
for(const lesson of added){
 assert.equal(lesson.editorial.nativeItalianEducatorReview,'pending');
 assert.equal(lesson.editorial.learnerCalibration,'pending');
 assert(lesson.prerequisites.length,lesson.id+': explicit bridge missing');
 for(const id of lesson.prerequisites)assert(all.has(id),lesson.id+': unknown prerequisite '+id);
 for(const related of lesson.related)if(related.caseId)assert(CORE_STAGES.some(c=>c.id===related.caseId),lesson.id+': unknown reference case '+related.caseId);
 for(const target of lesson.targets){
  const questions=lesson.steps.filter(s=>s.kind==='question'&&s.target===target.id);
  assert.equal(questions.filter(q=>q.stage==='guided').length,1);
  assert(questions.filter(q=>q.reserve).length>=2,target.id+': two fresh repair variants required');
  assert(questions.filter(q=>q.stage==='independent').length>=4);
  assert.equal(new Set(questions.map(q=>q.contextKey)).size,questions.length);
  const semantic=q=>JSON.stringify([q.context||q.speak,q.translation||'',q.answer].map(s=>s.normalize('NFC').toLocaleLowerCase('it').replace(/\s+/g,' ').trim()));
  assert.equal(new Set(questions.map(semantic)).size,questions.length,target.id+': repeated authored situation despite distinct IDs');
  const model=lesson.steps.findIndex(s=>s.kind==='teach'&&s.introduces.includes(target.id));
  assert(model>=0&&model<lesson.steps.indexOf(questions[0]),target.id+': test precedes teaching');
  for(const q of questions){
   assert.equal(assessCourseAnswer(q,q.answer).outcome,'correct');
   for(const wrong of q.options||[])if(wrong!==q.answer)assert.equal(assessCourseAnswer(q,wrong).outcome,'incorrect');
   if(q.audioId)assert(lesson.steps.some(s=>s.kind==='passage'&&s.audioId===q.audioId&&s.mode==='listen'));
   if(q.passageId)assert(lesson.steps.some(s=>s.kind==='passage'&&s.id===q.passageId&&s.mode==='read'));
  }
 }
 for(const q of lesson.steps.filter(s=>s.kind==='portfolio')){
  assert(/optional practice|self-review/.test(q.prompt),q.id+': open response mislabelled as graded');
  assert.equal(assessCourseAnswer(q,q.model).outcome,'ungraded');
 }
}

// Repeated errors must recover on a new source, not reuse a supplied answer as
// independent evidence. This checks every added target through real state.
let repeatedPaths=0;
for(const lesson of added)for(const target of lesson.targets){
 let learning=createLearning(),session=createCourseSession(lesson),failures=0,iterations=0;
 while(iterations++<lesson.steps.length*10+80){
  const view=currentCourseStep(lesson,session);if(['complete','exhausted'].includes(view.kind))break;
  if(view.kind==='question'){
   const wrong=view.step.target===target.id&&view.step.stage==='independent'&&failures<2;
   if(wrong)failures++;
   const result=submitCourseAnswer(lesson,session,wrong?'__wrong__':view.step.answer,{audioAvailable:true});session=result.session;
   if(result.event)learning=recordAttempt(learning,{...result.event,epochId:learning.epoch.id}).learning;
  }
  session=advanceCourse(lesson,session,learning);
 }
 assert.equal(failures,2,target.id+': repeated-error fixture did not reach two errors');
 assert.equal(session.courseV2.phase,'complete',target.id+': repeated-error recovery exhausted');repeatedPaths++;
}
// Independent source-linked listening does not count if the transcript was
// displayed. This must also hold for a known-word sound discrimination task.
const listening=added.find(l=>l.id==='v2-a2-listen-appointment-change');
let session=createCourseSession(listening);
while(currentCourseStep(listening,session).step?.id!==listening.id+'.check-1'){
 const view=currentCourseStep(listening,session);
 if(view.kind==='question')session=submitCourseAnswer(listening,session,view.step.answer,{audioAvailable:true}).session;
 session=advanceCourse(listening,session,createLearning());
}
session.courseV2.transcripts.push(listenAudioId(listening));
const supported=submitCourseAnswer(listening,session,currentCourseStep(listening,session).step.answer,{audioAvailable:true});
assert(supported.event.assistance.includes('transcript-or-audio-unavailable'));
function listenAudioId(l){return l.steps.find(s=>s.id===l.id+'.check-1').audioId;}
console.log(`${preserved} historical lessons preserved exactly; ${added.length} new lessons; ${repeatedPaths} repeated-error recovery paths; source and assistance boundaries checked.`);
