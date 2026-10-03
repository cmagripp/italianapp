#!/usr/bin/env node
// Bounded advanced identity, source and actual recovery gate; not a CEFR claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {refinePhase6AdvancedPack,advancedVersion} from './phase6-advanced.mjs';
import {advancedTransfers} from './phase6-advanced-transfers.mjs';
import {assessCourseAnswer,createCourseSession,currentCourseStep,submitCourseAnswer,advanceCourse} from '../js/learning/course-v2-engine.js';
import {createLearning,recordAttempt} from '../js/learning/model.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url)));
const levels=['B2','C1','C2'],packs=levels.map(l=>read('data/course-v2/'+l+'.json'));
const all=new Map(['Foundations','A1','A2','B1',...levels].flatMap(l=>read('data/course-v2/'+l+'.json').units.flatMap(u=>u.lessons)).map(l=>[l.id,l]));
const added=packs.flatMap(p=>p.units.flatMap(u=>u.lessons)).filter(l=>l.editorial?.version===advancedVersion);
assert.equal(added.length,18);
let retained=0,repaired=0;
for(const pack of packs){
 assert.deepEqual(refinePhase6AdvancedPack(structuredClone(pack)),pack,pack.level+': source refinement not idempotent');
 const baseline=JSON.parse(execFileSync('git',['show','7eeeb36:data/course-v2/'+pack.level+'.json'],{encoding:'utf8'}));
 assert.deepEqual(refinePhase6AdvancedPack(structuredClone(baseline)),pack,pack.level+': declared baseline plus authored sources does not reproduce the released pack');
 const current=new Map(pack.units.flatMap(u=>u.lessons).map(l=>[l.id,l]));
 for(const old of baseline.units.flatMap(u=>u.lessons)){
  const now=current.get(old.id);assert(now,old.id+': retained identity lost');
  const decision=pack.phase6Editorial.decisions.find(d=>d.lessonId===old.id);assert(decision);
  const copy=structuredClone(now);
  for(const id of decision.changedStepIds){const index=copy.steps.findIndex(s=>s.id===id);assert(index>=0);copy.steps[index]=structuredClone(old.steps[index]);}
  assert.deepEqual(copy,old,old.id+': retained content outside declared teaching/preparation edits changed');
  if(advancedTransfers[old.id]){assert.equal(now.steps.find(s=>s.id===old.id+'.core.transfer').body,advancedTransfers[old.id].body);repaired++;}
  retained++;
 }
 assert.equal(pack.phase6Editorial.decisions.length,baseline.units.flatMap(u=>u.lessons).length);
}
assert.equal(retained,89);assert.equal(repaired,40);
let targets=0;
for(const l of added){
 assert.equal(l.editorial.nativeItalianEducatorReview,'pending');assert.equal(l.editorial.learnerCalibration,'pending');
 for(const id of l.prerequisites)assert(all.has(id),l.id+': unresolved prerequisite '+id);
 for(const t of l.targets){
  targets++;const qs=l.steps.filter(s=>s.kind==='question'&&s.target===t.id);
  assert.equal(qs.filter(q=>q.stage==='guided').length,1);assert.equal(qs.filter(q=>q.stage==='independent'&&!q.reserve).length,2);assert(qs.filter(q=>q.reserve).length>=2);
  const semantic=q=>JSON.stringify([q.context||q.speak,q.translation||'',q.answer].map(s=>s.normalize('NFC').toLocaleLowerCase('it').replace(/\s+/g,' ').trim()));
  assert.equal(new Set(qs.map(semantic)).size,qs.length,t.id+': duplicate authored meaning context');
  const model=l.steps.findIndex(s=>s.kind==='teach'&&s.introduces?.includes(t.id));assert(model>=0&&model<l.steps.indexOf(qs[0]));
  if(t.requiresProduction)assert(qs.some(q=>q.stage==='independent'&&!q.reserve&&q.format==='type'&&!new RegExp('(?:Use|Supply) '+q.answer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.','i').test(q.translation)),t.id+': no unaided typed retrieval');
  for(const q of qs){assert.equal(assessCourseAnswer(q,q.answer).outcome,'correct');for(const option of q.options||[])if(option!==q.answer)assert.equal(assessCourseAnswer(q,option).outcome,'incorrect');}
 }
 for(const p of l.steps.filter(s=>s.kind==='portfolio')){assert(/optional/.test(p.prompt));assert.equal(assessCourseAnswer(p,p.model).outcome,'ungraded');}
 if(l.targets[0].modality==='reading'){
  const extensions=l.steps.filter(s=>s.id.startsWith(l.id+'.further-reading-'));assert.equal(extensions.length,2);assert(extensions.every(s=>!s.reserve));
  assert(extensions.every(s=>l.steps.indexOf(s)<l.steps.findIndex(x=>x.kind==='portfolio')));
 }
 if(l.editorial.authenticText)for(const p of l.steps.filter(s=>s.kind==='passage'))assert.deepEqual(p.source,l.editorial.authenticText);
}
let recovery=0,extensionsSeen=0;
for(const l of added)for(const target of l.targets){
 let learning=createLearning(),session=createCourseSession(l),failures=0,n=0,seen=new Set();
 while(n++<l.steps.length*10+80){
  const v=currentCourseStep(l,session);if(['complete','exhausted'].includes(v.kind))break;seen.add(v.step.id);
  if(v.kind==='question'){
   const wrong=v.step.target===target.id&&v.step.stage==='independent'&&failures<2;if(wrong)failures++;
   const r=submitCourseAnswer(l,session,wrong?'__wrong__':v.step.answer,{audioAvailable:true});session=r.session;if(r.event)learning=recordAttempt(learning,{...r.event,epochId:learning.epoch.id}).learning;
  }
  session=advanceCourse(l,session,learning);
 }
 assert.equal(failures,2);assert.equal(session.courseV2.phase,'complete',target.id+': recovery exhausted');recovery++;
 if(target.modality==='reading'){assert(seen.has(l.id+'.further-reading-3'));assert(seen.has(l.id+'.further-reading-4'));extensionsSeen+=2;}
}
assert.equal(targets,27);
const sources=read('data/course-v2/phase6-advanced-recorded-sources.json').passages;
assert.equal(sources.length,15);
for(const source of sources){const lesson=all.get(source.lessonId),p=lesson.steps.find(s=>s.audioId===source.id);assert.equal(p.it,source.it);assert.equal(p.recordedExcerpt.start,source.start);assert.equal(p.recordedExcerpt.end,source.end);assert(source.rightsEvidence&&source.credit&&source.licenseUrl);}
console.log(`${retained} retained lesson identities; ${repaired} explicit transfer repairs; ${added.length} new lessons; ${recovery} actual repeated-error paths; ${extensionsSeen} complete-source extension views; 15 attributed natural excerpt decisions.`);
