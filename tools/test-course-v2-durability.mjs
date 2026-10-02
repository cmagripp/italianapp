import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createLearning,normalizeLearning,recordAttempt,mergeLearning,resetLearning,setCompletionRecord,skillState} from '../js/learning/model.js';
import {courseSkill} from '../js/learning/course-v2-state.js';
import {placementQuestions,placementRecommendation,assessPlacement} from '../js/learning/course-v2-placement.js';
const time=1700000000000,target={id:'v2-durable.agreement',facets:['singular','plural'],minIndependent:3,requiresProduction:true,modality:'language'};
const event=(n,facet,mode='recognition')=>({id:'v2:'+n,at:time+n*1000,index:n,sessionId:'v2:lesson',deviceId:'device1',sequence:n,entryId:'g:v2-durable',objectiveId:target.id,kind:'grammar',policy:'grammar-v2',contentVersion:2,skill:facet,facet,requiredFacets:target.facets,minIndependent:3,requiresProduction:true,modality:'language',mode,responseMode:mode,variantId:'q'+n,contextId:'context'+n,exposureGroup:'family'+n,outcome:'correct',ok:true,grammarPhase:'independent',firstAttempt:true,assistance:[],xp:2});
let a=createLearning(time);const add=(l,e)=>recordAttempt(l,{...e,epochId:l.epoch.id}).learning;
a=add(a,event(1,'singular','production'));a=add(a,event(2,'plural'));assert(!courseSkill(Object.values(a.events),time,target).ready);
a=add(a,event(4,'plural'));assert(courseSkill(Object.values(a.events),time,target).ready);
let b=add(createLearning(time),{...event(6,'singular'),sessionId:'device2:review',deviceId:'device2',at:time+86400000,outcome:'incorrect',ok:false,errorTags:['agreement']});
const left=mergeLearning(a,b),right=mergeLearning(b,a);assert.deepEqual(left,right);assert(!courseSkill(Object.values(left.events),time+86400000,target).ready);assert(courseSkill(Object.values(left.events),time+86400000,target).enrolled);
const draft={id:'saved-v2',entryId:'g:v2-durable',mode:'lesson',objectiveIds:[target.id],updatedAt:time+1,courseV2:{version:2,phase:'step',draft:'È una casa',optionOrder:[2,0,1],portfolios:{writing:{draft:'Un testo.',criteria:[1],recording:{key:'private-local-blob'}}},flags:[{stepId:'q1',answer:'sono'}]}};
let saved=normalizeLearning({...left,sessions:{'g:v2-durable|lesson':draft},session:draft});saved=setCompletionRecord(saved,{entryId:'v:credere',caseId:'present',checked:true,id:'manual',at:time+1});
const normalized=normalizeLearning(JSON.parse(JSON.stringify({...saved,version:4})));
assert.equal(normalized.version,5);assert.deepEqual(normalized.sessions['g:v2-durable|lesson'].courseV2,draft.courseV2);assert.deepEqual(normalized.completions,saved.completions);assert.deepEqual(normalized.events,saved.events);
const finish={...event(10,'course-completion'),id:'receipt',objectiveId:'v2-durable.course-finish',skill:'course-completion',outcome:'ungraded',ok:false,xp:0,completedTargets:[target.id]};
const withReceipt=add(saved,finish);assert.equal(withReceipt.events.receipt.lessonFinished,true);assert.deepEqual(withReceipt.events.receipt.completedTargets,[target.id]);
const reset=resetLearning(withReceipt,time+2*86400000,'reset');const merged=mergeLearning(reset,withReceipt);assert.deepEqual(merged.events,{});assert.deepEqual(merged.sessions,{});assert.deepEqual(merged.completions,{});
// Lesson vocabulary boards: the word-lesson-match-v1 fields survive normalisation and merge as supported recognition.
const boardId='v2-durable.words-check.meaning.1',wordTarget=skill=>`w:casa|noun::lesson::${skill==='meaning'||skill==='recall'?'meaning':'forms'}::${skill}`;
const row=(n,skill,patch={})=>({id:`course-v2:1:v2:1:${boardId}:w:casa|noun:${skill}`,sessionId:'course-v2:1',index:1,at:time+n*1000,deviceId:'device1',sequence:n,
  policy:'journey-v1',wordPolicy:'word-lesson-match-v1',courseLessonId:'v2-durable',wordSlotId:`${boardId}:${skill}`,entryId:'w:casa|noun',kind:'word',
  objectiveId:wordTarget(skill),targetId:wordTarget(skill),contentVersion:1,chapterId:'meaning',skill,role:null,activityKind:'guided',mode:'recognition',
  variantId:boardId,contextId:'v2-durable',ok:true,outcome:'correct',assistance:['matching'],firstAttempt:true,errorTags:[],components:[],xp:0,countStats:false,...patch});
let w=add(createLearning(time),row(20,'meaning'));
const storedRow=w.events[row(20,'meaning').id];
assert.ok(storedRow,'a board row is accepted');
assert.equal(storedRow.policy,'journey-v1');assert.equal(storedRow.wordPolicy,'word-lesson-match-v1');assert.equal(storedRow.wordSlotId,`${boardId}:meaning`);assert.equal(storedRow.courseLessonId,'v2-durable');
assert.equal(storedRow.mode,'recognition');assert.equal(storedRow.activityKind,'guided');assert.equal(storedRow.xp,0);assert.equal(storedRow.kind,'word');assert.equal(storedRow.targetId,wordTarget('meaning'));assert.equal(storedRow.chapterId,'meaning');
assert.deepEqual(storedRow.assistance,['matching']);assert.equal(storedRow.firstAttempt,true);assert.equal(storedRow.ok,true);
w=add(w,row(21,'recall',{mode:'production',activityKind:'independent',assistance:[]}));
assert.equal(w.events[row(21,'recall').id].mode,'recognition','a forged production row is forced back to recognition');assert.equal(w.events[row(21,'recall').id].activityKind,'guided');
w=add(w,row(22,'article',{id:`course-v2:1:v2:2:${boardId}:w:casa|noun:article:miss:1`,chapterId:'forms',ok:false,outcome:'incorrect',errorTags:['matching-mismatch'],firstAttempt:true}));
const missRow=w.events[`course-v2:1:v2:2:${boardId}:w:casa|noun:article:miss:1`];
assert.equal(missRow.ok,false);assert.equal(missRow.outcome,'incorrect');assert.deepEqual(missRow.errorTags,['matching-mismatch']);assert.equal(missRow.wordPolicy,'word-lesson-match-v1');assert.equal(missRow.chapterId,'forms');
for(const skill of ['meaning','recall','article']){const state=skillState(w,wordTarget(skill),time+1e6);assert.equal(state.ready,false,skill);assert.equal(state.independentCorrect,0,skill);assert.equal(state.policy,'journey-v1');}
assert.equal(skillState(w,wordTarget('meaning'),time+1e6).recognitionCorrect,1);assert.ok(skillState(w,wordTarget('meaning'),time+1e6).due>time+20000,'a supported success schedules a review like the short word lesson');
assert.equal(skillState(w,wordTarget('article'),time+1e6).unresolvedErrors[0].tag,'matching-mismatch');
const roundTrip=normalizeLearning(JSON.parse(JSON.stringify(w)));assert.deepEqual(roundTrip.events,w.events);assert.deepEqual(normalizeLearning(JSON.parse(JSON.stringify({...w,version:4}))).events,w.events);
const mergedRows=mergeLearning(w,a),mergedBack=mergeLearning(a,w);assert.deepEqual(mergedRows,mergedBack);
for(const id of Object.keys(w.events))assert.deepEqual(mergedRows.events[id],w.events[id]);
assert.deepEqual(mergeLearning(resetLearning(w,time+3*86400000,'reset-rows'),w).events,{});
const six=Array.from({length:6},()=>({correct:true,assisted:false}));assert.deepEqual(placementRecommendation('A1',six),{continueAt:'A2'});assert.equal(placementRecommendation('A1',six.map((a,i)=>({...a,correct:i===0}))).level,'Foundations');assert(!placementRecommendation('B2',six.map((a,i)=>({...a,assisted:i===3}))).continueAt);assert(!placementRecommendation('B2',six.slice(0,3),{stopped:true}).continueAt);assert.equal(assessPlacement({kind:'question',format:'choice',answer:'È',options:['È','E']},'E').correct,false);
const levels=['A1','A2','B1','B2','C1','C2'];
const lessons=levels.flatMap(level=>JSON.parse(fs.readFileSync(new URL(`../data/course-v2/${level}.json`,import.meta.url))).units.flatMap(u=>u.lessons.map(l=>({...l,level}))));
assert.deepEqual(placementQuestions([], 'B2'),[],'An unavailable set must not dereference a missing group');
for(const [i,level] of levels.entries()){
 const queue=placementQuestions(lessons,level);assert.equal(queue.length,6,`${level}: placement must offer a full conservative sample`);
 const answers=queue.map(item=>{const q=lessons.find(l=>l.id===item.lessonId).steps.find(q=>q.id===item.questionId);return assessPlacement(q,q.answer);});
 assert(answers.every(a=>a.correct),level);
 const result=placementRecommendation(level,answers);
 assert.equal(result.continueAt||result.level,levels[i+1]||'C2',`${level}: a complete successful set must allow the next stage`);
}
console.log('V2 durability: facets, cross-device merge, v4 migration, completion receipt, portfolios, reset, vocabulary board rows, and conservative placement passed.');
