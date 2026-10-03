#!/usr/bin/env node
// Catalogue-wide structural pacing plus real answered representative journeys.
// Counts describe authored screens; they are not measured learner durations.
import fs from 'node:fs';
import {data} from '../js/data.js';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createLearning,recordAttempt} from '../js/learning/model.js';
import {createJourneySession,currentJourneyStep,advanceJourney,journeyAttempt,recordJourneyAttempt,journeyPairAttempt,recordJourneyPairAttempt,journeyCaseProgress} from '../js/learning/journey.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
import {gradePairActivity} from '../js/learning/lesson-activities.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
const words=read('vocab').filter(e=>!e.legacyGrouping).map(e=>({...e,kind:'word'})),verbs=read('verbs').map(e=>({...e,kind:'verb'}));
data.vocab=words;data.verbs=verbs;data.byId=new Map([...words,...verbs].map(e=>[e.id,e]));
const targets=chapter=>chapter.groups.flatMap(g=>g.targets||[]),failures=[],wordHistogram={},verbHistogram={},catalogue=[];
for(const entry of words){const plan=buildLesson(entry),slots=plan.wordLesson?.slots||[];wordHistogram[slots.length]=(wordHistogram[slots.length]||0)+1;
 if(!slots.length||slots.length>8||slots.some(s=>!['mc','pairs'].includes(s.format)))failures.push({entryId:entry.id,reason:'unbounded-or-written-word'});
}
for(const entry of verbs){const plan=buildLesson(entry),cases=plan.chapters.filter(c=>['present','past','background','future','condizionale'].includes(c.id));
 for(const chapter of cases){const required=targets(chapter).filter(t=>t.available!==false&&(t.required!==false||t.completionRequired)&&!t.supplementalOnly);
  const record={entryId:entry.id,caseId:chapter.id,targets:required.length,teaching:chapter.groups.reduce((n,g)=>n+(g.cards?.length||0),0),persons:[...new Set(required.filter(t=>t.person!=null).map(t=>t.person))],guidedFormats:[...new Set(required.map(t=>t.guidedFormat||'mc'))]};catalogue.push(record);verbHistogram[required.length]=(verbHistogram[required.length]||0)+1;
 }
}
function traverse(inf,caseId='present'){
 const entry=verbs.find(e=>e.inf===inf),plan=buildLesson(entry,{questionBuilder:buildJourneyQuestion});let learning=createLearning(1),session=createJourneySession({id:`audit:${inf}:${caseId}`,plan,now:1,chapterId:caseId,caseMode:true}),serial=0,steps=0,questions=0,typed=0,teaching=0,writtenRun=0,maxWrittenRun=0;const formats={},phases={},trace=[];
 const norm=s=>String(s||'').normalize('NFC').trim().toLocaleLowerCase('it').replace(/\s+/g,' '),expose=forms=>{session.ui||={exposures:{}};for(const f of forms||[])if(f)session.ui.exposures[norm(f)]=session.index;};
 const save=event=>{Object.assign(event,{deviceId:'pacing-audit',sequence:++serial,epochId:learning.epoch.id});const result=recordAttempt(learning,event);learning=result.learning;return result;};
 for(;steps<650;steps++){
  const step=currentJourneyStep(plan,session,learning,serial+10);if(['recap','complete'].includes(step.type))break;
  if(step.type==='teach'){teaching++;expose((step.card?.forms||[]).flatMap(f=>f.form.split(/\s*\/\s*/)));
   const shown=norm([step.card?.body,...(step.card?.notes||[]),...(step.card?.examples||[]).map(e=>e.it)].join(' '));
   for(const target of targets(step.chapter)){const q=buildJourneyQuestion(entry,step.chapter,target);expose(q?.answer?.filter(answer=>shown.includes(norm(answer))));}
  }
  if(step.awaitingContinue||['teach','repair'].includes(step.type)){session=advanceJourney(plan,session,learning,{now:serial+10});continue;}
  if(step.type!=='question')return {inf,caseId,blocked:step.reason||step.type,questions,typed,teaching,maxWrittenRun,trace:trace.slice(-12)};
  const q=buildJourneyQuestion(entry,step.chapter,step.target,step);if(!q)return {inf,caseId,blocked:'missing-question',targetId:step.target.id};
  questions++;typed+=q.type==='type';writtenRun=q.type==='type'?writtenRun+1:0;maxWrittenRun=Math.max(maxWrittenRun,writtenRun);formats[q.type]=(formats[q.type]||0)+1;phases[step.phase]=(phases[step.phase]||0)+1;trace.push({format:q.type,targetId:step.target.id,phase:step.phase});
  const assistance=(q.meta.exposureForms||q.answer).some(a=>session.ui?.exposures[norm(a)]!==undefined&&session.index-session.ui.exposures[norm(a)]<1)?['visible-form']:[];
  expose(q.meta.promptExposureForms);expose((q.choices||[]).map(c=>c.value??c.label));
  if(q.type==='pairs')for(const p of q.pairs){const grade=gradePairActivity(q,{targetId:p.targetId,given:p.canonical}),event=journeyPairAttempt(plan,session,q,grade,{targetId:p.targetId,now:serial+10});if(event)session=recordJourneyPairAttempt(plan,session,event,save(event));expose(p.answers);}
  const grade=gradeQuestion(q,q.answer[0]),event=journeyAttempt(plan,session,q,grade,{assistance,now:serial+10});if(!event||!grade.ok)return {inf,caseId,blocked:'unanswerable'};
  session=recordJourneyAttempt(plan,session,event,save(event));expose(q.answer);expose(q.meta.feedbackExposureForms);
 }
 return {inf,caseId,steps,questions,typed,teaching,maxWrittenRun,formats,phases,complete:journeyCaseProgress(plan,learning).cases.find(c=>c.id===caseId)?.ready===true};
}
const samples=[['parlare'],['credere'],['dormire'],['finire'],['viaggiare'],['dire'],['essere'],['avere'],['alzarsi'],['andarsene'],['piovere'],['parlare','past'],['parlare','background'],['parlare','future'],['parlare','condizionale']].map(([inf,caseId])=>traverse(inf,caseId));
for(const sample of samples)if(sample.blocked||!sample.complete)failures.push(sample);
const full=process.env.PACING_FULL==='1',fullCounts={cases:0,exempt:0,screens:{},typed:{},visits:{}};
if(full)for(const item of catalogue){if(!item.targets){fullCounts.exempt++;continue;}const e=data.byId.get(item.entryId),result=traverse(e.inf,item.caseId);fullCounts.cases++;if(result.blocked||!result.complete)failures.push(result);else{for(const [field,value]of [['screens',result.questions],['typed',result.typed],['visits',Math.ceil(result.questions/8)]])fullCounts[field][value]=(fullCounts[field][value]||0)+1;}if(fullCounts.cases%250===0)console.error(`Traversed ${fullCounts.cases} cases; ${failures.length} failures`);}
const report={version:2,coveragePolicy:'verb-case-coverage-v1',wordEntries:words.length,verbEntries:verbs.length,wordScreenHistogram:wordHistogram,verbCaseCount:catalogue.length,verbTargetHistogram:verbHistogram,samples,...(full?{fullTraversals:fullCounts}:{}),failures,limitations:['Answered traversals use real question grading and evidence but are not beginner timing trials.','Catalogue structural/runtime checks do not replace individual Italian editorial review.','Finished coverage remains distinct from consolidated readiness and delayed retention.']};
fs.mkdirSync(new URL('../docs/implementation/programme/',import.meta.url),{recursive:true});fs.writeFileSync(new URL(`../docs/implementation/programme/journey-pacing${full?'-full':''}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
