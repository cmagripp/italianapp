#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assessLabBlank,answerLab,createLabSession,currentLabStep,compatibleLabSession,fillTemplate} from '../js/learning/sentence-lab.js';
import {workshopSourceExamples,workshopExamplePacks,workshopExampleReview} from './workshop-source-examples.mjs';
const root=new URL('../',import.meta.url),read=path=>JSON.parse(fs.readFileSync(new URL(path,root))),hash=value=>createHash('sha256').update(value).digest('hex');
const dictionary={vocab:read('data/vocab.json'),verbs:read('data/verbs.json')},base=new Map(),current=new Map(),pins=[];
let actualFreeSlots=0;
for(const {stage,priorJSONSHA256,priorRawSHA256} of workshopExamplePacks){
 const path=`data/sentence-lab/${stage}.json`,raw=fs.readFileSync(new URL(path,root),'utf8'),pack=JSON.parse(raw),prior=structuredClone(pack);
 for(const lesson of prior.lessons)for(const activity of lesson.activities)for(const turn of activity.kind==='cloze'?[activity]:activity.kind==='dialogue'?activity.turns:[])for(const blank of turn.blanks||[])delete blank.sourceExamples;
 assert.equal(hash(JSON.stringify(prior)),priorJSONSHA256,`${stage}: identities, templates, accepted values or other prior fields changed`);
 for(const lesson of prior.lessons)base.set(lesson.id,lesson);
 for(const lesson of pack.lessons){current.set(lesson.id,lesson);for(const activity of lesson.activities)for(const turn of activity.kind==='cloze'?[activity]:activity.kind==='dialogue'?activity.turns:[])for(const blank of turn.blanks||[])if(blank.free){assert(Array.isArray(blank.sourceExamples)&&blank.sourceExamples.length);actualFreeSlots++;}}
 pins.push({path,priorRawSHA256,priorJSONSHA256,currentSHA256:hash(raw)});
}
const review=read(workshopExampleReview.reviewRecord);assert.equal(review.examples.length,60);const reviewed=new Map(review.examples.map(example=>[JSON.stringify([example.lessonId,example.activityIndex,example.turnIndex,example.blankIndex,example.exampleIndex]),example]));
const locators=new Set();let examples=0,profileExamples=0,blankChecks=0,savedDialogues=0,maxActivityChars=0,mApplicable=0,fApplicable=0;
for(const row of workshopSourceExamples){
 const locator=JSON.stringify([row.lessonId,row.activityIndex,row.turnIndex,row.blankIndex]);assert(!locators.has(locator));locators.add(locator);
 const oldLesson=base.get(row.lessonId),newLesson=current.get(row.lessonId),activity=newLesson.activities[row.activityIndex];
 maxActivityChars=Math.max(maxActivityChars,JSON.stringify(activity).length);const turn=row.turnIndex===null?activity:activity.turns[row.turnIndex],blank=turn.blanks[row.blankIndex];
 assert.equal(activity.id,row.activityId);assert.equal(turn.template,row.template);assert.deepEqual(blank.sourceExamples,row.sourceExamples);assert(blank.free);
 mApplicable+=+row.sourceExamples.some(ex=>['m','any'].includes(ex.agreement));fApplicable+=+row.sourceExamples.some(ex=>['f','any'].includes(ex.agreement));
 for(const [exampleIndex,ex] of row.sourceExamples.entries()){
  const editorial=reviewed.get(JSON.stringify([row.lessonId,row.activityIndex,row.turnIndex,row.blankIndex,exampleIndex]));assert(editorial);
  for(const field of ['it','en','agreement','subjectAgreement','subjectScope'])assert.deepEqual(ex[field],editorial[field],`${locator} ${field}`);
  for(const [field,value] of Object.entries(workshopExampleReview))assert.equal(ex[field],value);
  assert.equal(ex.it,fillTemplate(turn.template,ex.values));assert.equal(ex.values.length,turn.blanks.length);examples++;
  for(const speakerGender of ['m','f']){
   if(ex.agreement!=='any'&&ex.agreement!==speakerGender)continue;
   for(const [i,value] of ex.values.entries()){assert(turn.blanks[i].accept.includes(value));const result=assessLabBlank(turn.blanks[i],value,{dictionary,speakerGender,learnedIds:new Set()});assert.equal(result.outcome,'correct',`${row.activityId} ${i} ${speakerGender} ${value}`);assert.equal(result.filled,value);blankChecks++;}
   const prepare=lesson=>{const session=createLabSession(lesson,{now:42});session.index=row.activityIndex;session.state=null;currentLabStep(lesson,session);if(row.turnIndex!==null)session.state.turnIndex=row.turnIndex;return session;};
   const oldSession=prepare(oldLesson),newSession=prepare(newLesson),ctx={dictionary,speakerGender,learnedIds:new Set(),now:43};
   // Adding references changes neither pending activity identity nor saved grading.
   assert.deepEqual(newSession,oldSession);
   const before=answerLab(oldLesson,oldSession,ex.values,ctx),after=answerLab(newLesson,newSession,ex.values,ctx);assert.deepEqual(after.result,before.result);assert.deepEqual(newSession,oldSession);
   const saved=JSON.parse(JSON.stringify(oldSession));assert(compatibleLabSession(newLesson,saved));
   if(row.turnIndex!==null){const oldShown=currentLabStep(oldLesson,structuredClone(saved)).state.turns.filter(t=>t.done||t.reaction),newShown=currentLabStep(newLesson,structuredClone(saved)).state.turns.filter(t=>t.done||t.reaction);assert.deepEqual(newShown,oldShown);savedDialogues++;}profileExamples++;
  }
 }
}
assert.equal(actualFreeSlots,46);assert.equal(locators.size,46);assert.equal(examples,60);assert.equal(mApplicable,46);assert.equal(fApplicable,45);
const fixed=workshopSourceExamples.find(row=>row.lessonId==='sl-strutture-03-quindi-allora-pero'&&row.activityIndex===3);assert(fixed.sourceExamples.every(ex=>ex.agreement==='m'&&ex.subjectScope==='speaker'&&ex.subjectAgreement==='m'));
assert(workshopSourceExamples.filter(row=>row.lessonId==='sl-passato-05-raccontami'&&row.turnIndex===7).every(row=>row.sourceExamples.every(ex=>ex.agreement==='any'&&ex.subjectScope==='group'&&ex.subjectAgreement==='male-or-mixed-group')));
assert(review.findings.some(finding=>finding.id==='punctuation-polish'));assert(review.findings.some(finding=>finding.id==='unexpressed-contrast'));
const report={schemaVersion:1,date:'2026-10-03',scope:'60 chosen full contexts in 46 free slots: exact reviewed Italian/English/agreement, all chosen fills, unchanged original source fields and grading/pending/saved dialogue persistence. Does not review all accepted alternatives, all reactions or native educator quality.',status:'passed',checks:{slots:46,examples,profileExamples,blankChecks,savedDialogues,maxActivityChars,mApplicable,fApplicable},sourcePins:pins,independentChosenFillReview:{path:workshopExampleReview.reviewRecord,sha256:hash(fs.readFileSync(new URL(workshopExampleReview.reviewRecord,root)))},openGaps:review.openGaps,retainedEditorialNotes:review.findings,gates:{nativeItalianEducator:'pending',fullResolverBinding:'separate AI adapter integration gate'}};
if(process.argv.includes('--report'))fs.writeFileSync(new URL('docs/implementation/programme/workshop-source-examples-integration.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,...report.checks}));
