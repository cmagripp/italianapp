import assert from 'node:assert/strict';
import fs from 'node:fs';
import {data} from '../js/data.js';
import {createLearning,recordAttempt,skillState,setCompletionRecord,normalizeLearning,mergeLearning,learningSessionKey} from '../js/learning/model.js';
import {lessonObjectives,reviewItems,familiarReviewItems,eligibleSkills,entryCompletion} from '../js/learning/integration.js';
import {canonicalObjectiveId,objectiveAliases,declareObjective,declareAlias} from '../js/learning/objectives.js';
import {dailyPlan,continuation} from '../js/learning/daily-plan.js';
import {createReviewVisit,reviewAttempt,advanceReviewVisit,currentReviewQuestion,compatibleReviewVisit,reviewTargetEligible,reviewQuestion} from '../js/learning/review-session.js';
import {installGrammarCourse,installGrammarIndex,grammarCourse} from '../js/learning/grammar-course.js';
import {createJourneySession} from '../js/learning/journey.js';
import {lessonPlan} from '../js/learning/integration.js';

data.vocab=JSON.parse(fs.readFileSync(new URL('../data/vocab.json',import.meta.url))).map(e=>({...e,kind:'word'}));
data.verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))).map(e=>({...e,kind:'verb',it:e.inf}));
data.byId=new Map([...data.vocab,...data.verbs].map(e=>[e.id,e]));data.loaded=true;
const START=1700000000000,DAY=86400e3,HOUR=3600e3;
const noun=name=>data.vocab.find(e=>e.it===name&&e.pos==='noun'),verb=name=>data.verbs.find(e=>e.inf===name);
let passed=0,sequence=0;
const test=(name,fn)=>{fn();passed++;console.log('✓',name);};
function fixture(entries=[noun('casa'),verb('credere')]) {
  return {learning:createLearning(START),settings:{studyMinutes:10},current:{id:'fixture',items:{},customDeleted:{}},
    lists:{bank:{id:'bank',items:entries.map(e=>e.id)}},scope:{mode:'lists',lists:['bank']},
    dueIds(now){return Object.entries(this.current.items).filter(([,x])=>x.due&&x.due<=now).map(([id])=>id);}};
}
function enroll(store,entry,caseId='word',at=START){store.learning=setCompletionRecord(store.learning,{entryId:entry.id,caseId,checked:true,at,id:`check:${entry.id}:${caseId}:${at}`});}
function attempt(store,objective,patch={}) {
  const n=++sequence,event={id:`event:${n}`,epochId:store.learning.epoch.id,deviceId:'fixture',sequence:n,
    sessionId:`s:${n}`,index:0,at:START+n,entryId:objective.entryId,kind:objective.kind,
    objectiveId:objective.id,skill:objective.skill,tense:objective.tense || null,mode:'recognition',
    variantId:`v:${n}`,contextId:`context:${n}`,firstAttempt:true,assistance:[],components:[],errorTags:[],
    outcome:'incorrect',ok:false,xp:0,...patch};
  const recorded=recordAttempt(store.learning,event);store.learning=recorded.learning;return recorded;
}

test('one completed verb case becomes one row, with no invented attempts or other cases',()=>{
  const s=fixture(),e=verb('credere');enroll(s,e,'past');
  const before=JSON.stringify(s.learning),rows=reviewItems(s,START+DAY);
  assert.equal(rows.length,1);assert.equal(rows[0].caseId,'past');assert(rows[0].targets.length>=6);
  assert(rows[0].targets.every(t=>t.enrolled&&!t.ready&&t.independentCorrect===0&&t.tense==='passatoProssimo'));
  assert.equal(JSON.stringify(s.learning),before);
  const visit=createReviewVisit(s,rows,{id:'manual',now:START+DAY,limit:4});
  assert.equal(visit.reviewVisit.total,4);assert(visit.reviewVisit.questions.every(q=>q.caseId==='past'));
});
test('outside-scope due work stays accessible; new discovery respects the selected list',()=>{
  const inside=noun('casa'),outside=verb('andare'),s=fixture([inside]);enroll(s,outside,'future');
  const old={id:`${outside.id}::futuro::conjugation`,entryId:outside.id,kind:'verb',skill:'conjugation',tense:'futuro'};attempt(s,old);
  const rows=reviewItems(s,START+DAY);assert(rows.some(r=>r.entryId===outside.id&&r.outOfScope&&r.caseId==='future'));
  const plan=dailyPlan(s,{now:START+DAY,minutes:5});assert(plan.steps.some(x=>x.kind==='review'));assert(plan.steps.some(x=>x.kind==='new'&&x.entryId===inside.id));
  assert(plan.estimatedMinutes<=5);assert(!plan.steps.some(x=>x.kind==='new'&&x.entryId===outside.id));
});
test('an aggregate item lapse remains due beside a later adaptive schedule',()=>{
  const e=noun('casa'),s=fixture([e]);enroll(s,e);
  const target=lessonObjectives(e).find(o=>o.skill==='meaning');attempt(s,target,{ok:true,outcome:'correct',at:START+DAY});
  s.current.items[e.id]={learned:true,due:START,seen:90};
  const rows=reviewItems(s,START+DAY+1);assert.equal(rows.length,1);assert(rows[0].targets.some(t=>t.legacyItem));
});
test('equivalent article game and lesson identities replay one exact difficulty without rewriting history',()=>{
  const e=noun('casa'),s=fixture([e]);enroll(s,e);
  const article=lessonObjectives(e).find(o=>o.skill==='article'),game={id:`${e.id}::word::article`,entryId:e.id,kind:'word',skill:'article'};
  const original=attempt(s,game,{at:START+HOUR});assert.equal(canonicalObjectiveId(article.id),game.id);
  const rows=reviewItems(s,START+DAY);assert(rows[0].targets.some(t=>t.objectiveId===game.id));
  const visit=createReviewVisit(s,rows,{id:'article-review',now:START+DAY,objective:game.id,limit:1});
  const q=currentReviewQuestion(visit).question;const result=reviewAttempt(visit,q.choices.find(c=>c.correct).value,{now:START+DAY});
  assert.equal(result.event.objectiveId,game.id);s.learning=recordAttempt(s.learning,result.event).learning;
  assert.equal(s.learning.events[original.learning.events['event:'+sequence]?.id]?.objectiveId,game.id);
  assert.equal(skillState(s.learning,article.id,START+DAY).due,skillState(s.learning,game.id,START+DAY).due);
  assert(skillState(s.learning,game.id,START+DAY).due>START+DAY);assert.equal(skillState(s.learning,game.id).independentCorrect,0);
  const imported=normalizeLearning(JSON.parse(JSON.stringify(s.learning)),START+DAY);
  assert.deepEqual(skillState(imported,game.id,START+DAY),skillState(mergeLearning(s.learning,imported,START+DAY),game.id,START+DAY));
  assert(objectiveAliases().some(a=>a.legacyId===article.id&&a.relation==='equivalent'&&a.mappingVersion===1));
});
test('broad legacy conjugation and partial plural remain diagnostic identities',()=>{
  const e=verb('credere'),s=fixture([e]);enroll(s,e,'present');
  const broad={id:`${e.id}::presente::conjugation`,entryId:e.id,kind:'verb',skill:'conjugation',tense:'presente'};attempt(s,broad);
  const person=lessonObjectives(e).find(o=>o.chapterId==='present'&&o.person===0&&o.skill==='conjugation');
  assert.notEqual(canonicalObjectiveId(broad.id),canonicalObjectiveId(person.id));
  const visit=createReviewVisit(s,reviewItems(s,START+DAY),{id:'broad',now:START+DAY,objective:broad.id,limit:1});
  const frame=currentReviewQuestion(visit);assert.equal(frame.objectiveId,broad.id);
  const result=reviewAttempt(visit,frame.question.choices.find(c=>c.correct).value,{now:START+DAY});
  assert.equal(result.event.objectiveId,broad.id);assert.equal(result.event.mode,'recognition');
  s.learning=recordAttempt(s.learning,result.event).learning;assert.equal(skillState(s.learning,person.id).attempts,0);
  const w=noun('casa'),plural=lessonObjectives(w).find(o=>o.skill==='plural');assert.notEqual(canonicalObjectiveId(plural.id),`${w.id}::word::plural`);
});
test('delayed recognition lengthens its own schedule, preserves ease and never grants typed mastery',()=>{
  const s=fixture(),e=noun('casa'),o={id:`${e.id}::word::recall`,entryId:e.id,kind:'word',skill:'recall'};
  attempt(s,o,{at:START,reviewPolicy:'unified-review-v1'});
  for(let i=0;i<3;i++)attempt(s,o,{at:START+(i+1)*DAY,ok:true,outcome:'correct',reviewPolicy:'unified-review-v1'});
  const state=skillState(s.learning,o.id,START+4*DAY);assert(state.srs.iv>=3);assert.equal(state.srs.ef,2.5);
  assert.equal(state.ready,false);assert.equal(state.independentCorrect,0);assert.equal(state.productionAttempts,0);
  assert.equal(state.recognitionReady,true);assert.equal(state.recognitionRemembered,true);assert.equal(state.unresolvedErrors.length,0);
});
test('recognition repairs do not hide a separate written-production lapse',()=>{
  const s=fixture([noun('casa')]),e=noun('casa'),o={id:`${e.id}::word::recall`,entryId:e.id,kind:'word',skill:'recall'};enroll(s,e);
  attempt(s,o,{at:START,mode:'production',components:[{skill:'recall',ok:false}],reviewPolicy:'unified-review-v1'});
  attempt(s,o,{at:START+DAY,ok:true,outcome:'correct',reviewPolicy:'unified-review-v1'});
  const state=skillState(s.learning,o.id,START+DAY);
  assert(state.productionSrs.due<=START+DAY);assert(state.recognitionSrs.due>START+DAY);assert.equal(state.schedulingMode,'production');
  assert(state.unresolvedErrors.some(error=>error.evidenceMode==='production'));
  const visit=createReviewVisit(s,reviewItems(s,START+DAY),{id:'writing-repair',now:START+DAY,limit:1,objective:o.id});
  assert.equal(currentReviewQuestion(visit).question.type,'type');assert.equal(currentReviewQuestion(visit).objectiveId,o.id);
});
test('an unmapped earlier diagnostic remains visible without proof for another target',()=>{
  const s=fixture([noun('casa')]),e=noun('casa');enroll(s,e);
  const old={id:'retired:casa-check',entryId:e.id,kind:'word',skill:'retired-custom-skill'};attempt(s,old);
  const rows=reviewItems(s,START+DAY);assert.equal(rows.length,1);assert.equal(rows[0].objectiveId,old.id);assert.equal(rows[0].contentUnavailable,true);assert(rows[0].href.startsWith('#/entry/'));
  assert.equal(createReviewVisit(s,rows,{id:'unavailable-diagnostic',now:START+DAY}).reviewVisit.total,0);
  assert.equal(skillState(s.learning,lessonObjectives(e).find(o=>o.skill==='recall').id).attempts,0);
});
test('a bounded mixed visit keeps its denominator, evidence IDs, draft and feedback through normalization',()=>{
  const s=fixture([noun('casa'),noun('libro'),verb('credere')]);enroll(s,noun('casa'));enroll(s,noun('libro'));enroll(s,verb('credere'),'present');
  const visit=createReviewVisit(s,reviewItems(s,START+DAY),{id:'mixed',now:START+DAY,limit:5});
  const v=visit.reviewVisit;assert.equal(v.total,5);assert.equal(new Set(v.questions.slice(0,3).map(q=>q.rowId)).size,3);
  v.draft='a saved draft';v.paused=true;s.learning.sessions[learningSessionKey(visit)]=visit;
  const roundtrip=normalizeLearning(JSON.parse(JSON.stringify(s.learning)),START+DAY).sessions[learningSessionKey(visit)];
  assert(compatibleReviewVisit(roundtrip,s));assert.equal(roundtrip.reviewVisit.draft,'a saved draft');assert.equal(roundtrip.reviewVisit.paused,true);
  v.paused=false;const q=currentReviewQuestion(visit).question,result=reviewAttempt(visit,q.answer[0],{now:START+DAY});
  const first=recordAttempt(s.learning,result.event),repeat=recordAttempt(first.learning,result.event);assert(first.added);assert(!repeat.added);
  const feedback=clone(visit);assert.deepEqual(feedback.reviewVisit.result,visit.reviewVisit.result);
  advanceReviewVisit(visit,{now:START+DAY+1});assert.equal(v.total,5);assert.equal(v.index,1);assert.equal(v.phase,'question');
  const other=createReviewVisit(s,reviewItems(s,START+DAY),{id:'other',now:START+DAY});assert.notEqual(learningSessionKey(visit),learningSessionKey(other));
});
function clone(value){return JSON.parse(JSON.stringify(value));}
test('unchecking a case fences a saved review without deleting evidence or other cases',()=>{
  const s=fixture(),e=verb('credere');enroll(s,e,'present');enroll(s,e,'past');
  const rows=reviewItems(s,START+DAY),visit=createReviewVisit(s,rows.filter(r=>r.caseId==='present'),{id:'fenced',now:START+DAY,limit:2});
  const history=JSON.stringify(s.learning.events);
  s.learning=setCompletionRecord(s.learning,{entryId:e.id,caseId:'present',checked:false,at:START+DAY+1,id:'fence'});
  assert.equal(reviewTargetEligible(s,currentReviewQuestion(visit),START+DAY+2),false);
  assert(reviewItems(s,START+2*DAY).every(r=>r.caseId==='past'));assert.equal(JSON.stringify(s.learning.events),history);
});
test('Home and Learn continuation describes exact saved case, workshop, course and review destinations',()=>{
  const s=fixture(),e=verb('credere');
  const journey=createJourneySession({id:'journey',plan:lessonPlan(e),chapterId:'future',now:START});journey.ui={draft:'creder',paused:true};s.learning.sessions.a=journey;
  let next=continuation(s,{now:START});assert.equal(next.caseId,'future');assert.equal(next.label,'Continue credere · Future');assert(next.href.includes('session=journey'));assert(next.href.includes('chapter=future'));
  s.learning.sessions.b={id:'lab',entryId:'lab:frasi:at-the-cafe',lessonId:'at-the-cafe',title:'At the café',phase:'activity',paused:true,updatedAt:START+1};
  next=continuation(s,{now:START});assert.equal(next.label,'Continue the workshop · At the café');assert(next.href.includes('/lab/frasi/at-the-cafe?session=lab'));
  s.learning.sessions.c={id:'course',entryId:'course:everyday',index:0,updatedAt:START+2,course:{items:[{kind:'verb',title:'credere',caseTitle:'Present',caseId:'present'}],skipped:[],finished:false}};
  next=continuation(s,{now:START});assert.equal(next.href,'#/learn/session');assert(next.label.includes('credere · Present'));
  s.learning.sessions.c.previewOnly=true;assert.equal(continuation(s,{now:START}).sessionId,'lab');
  enroll(s,noun('casa'));const review=createReviewVisit(s,reviewItems(s,START+DAY),{id:'resume-review',now:START+DAY,limit:1});s.learning.sessions.d=review;
  const plan=dailyPlan(s,{now:START+DAY,minutes:5});assert.equal(plan.continuation.sessionId,'resume-review');assert(plan.steps.some(a=>a.kind==='new'));assert(plan.estimatedMinutes<=5);
  assert.deepEqual(dailyPlan(s,{now:START+DAY,minutes:5}),plan);
});
test('grammar targets group once and preserve authored policy and exact course snapshot continuation',()=>{
  const pack=JSON.parse(fs.readFileSync(new URL('../data/course-v2/Foundations.json',import.meta.url)));installGrammarCourse([pack]);
  const lesson=grammarCourse.lessons[0],target=lesson.targets[0],s=fixture([]);
  const independent=lesson.steps.filter(step=>step.kind==='question'&&step.target===target.id&&step.stage==='independent'&&step.format==='choice');
  for(let i=0;i<6;i++){const q=independent[i%independent.length];attempt(s,{id:target.id,entryId:`g:${lesson.id}`,kind:'grammar',skill:q.facet},{
    at:START+i*DAY,ok:true,outcome:'correct',policy:'grammar-v2',contentVersion:2,grammarPhase:'independent',facet:q.facet,requiredFacets:target.facets,minIndependent:target.minIndependent,
    requiresProduction:target.requiresProduction,modality:target.modality,variantId:q.id,contextId:q.contextKey,exposureGroup:q.id});}
  const rows=reviewItems(s,START+10*DAY);assert.equal(rows.length,1);assert.equal(rows[0].entry.kind,'grammar');assert.equal(rows[0].contentUnavailable,undefined);assert(rows[0].href.startsWith('#/review?target='));
  const visit=createReviewVisit(s,rows,{id:'grammar-review',now:START+10*DAY,limit:2});assert(visit.reviewVisit.total>0);
  const frame=currentReviewQuestion(visit),result=reviewAttempt(visit,frame.question.answer[0],{now:START+10*DAY});assert.equal(result.event.objectiveId,target.id);assert.equal(result.event.policy,'grammar-v2');
  s.learning.sessions.g={id:'g-session',entryId:`g:${lesson.id}`,mode:'lesson',updatedAt:START+11*DAY,courseV2:{phase:'step',stepIndex:4,draft:'Buon',activeTargetId:target.id}};
  const next=continuation(s,{now:START+11*DAY});assert(next.href.includes('session=g-session'));assert.equal(next.label,`Continue ${lesson.title}`);
});
test('legacy grammar skill names and lazy outlines keep their real authored review action',()=>{
  const legacy=JSON.parse(fs.readFileSync(new URL('../data/grammar-course/A1.json',import.meta.url)));installGrammarCourse([], [legacy]);
  const lesson=grammarCourse.legacyLessons[0],target=lesson.objectives[0],s=fixture([]);
  for(let i=0;i<5;i++)attempt(s,{id:target.id,entryId:`g:${lesson.id}`,kind:'grammar',skill:target.errorTag},{at:START+i*DAY,ok:true,outcome:'correct',policy:'grammar-v1',grammarPhase:'independent',variantId:target.questions[i].id,contextId:target.questions[i].context || target.questions[i].answer});
  const rows=familiarReviewItems(s,START+10*DAY);assert.equal(rows.length,1);assert.equal(rows[0].targets[0].contentUnavailable,false);assert(rows[0].href.startsWith('#/review?target='));
  const visit=createReviewVisit(s,rows,{id:'legacy-grammar-review',now:START+10*DAY,limit:1}),frame=currentReviewQuestion(visit);assert(frame);assert.equal(frame.question.meta.policy,'grammar-v1');
  const answer=reviewAttempt(visit,frame.question.answer[0],{now:START+10*DAY});assert.equal(answer.event.objectiveId,target.id);assert.equal(answer.event.kind,'grammar');assert.equal(answer.event.reviewPolicy,'unified-review-v1');
  grammarCourse.indexOnly=true;assert.equal(familiarReviewItems(s,START+10*DAY)[0].targets[0].contentUnavailable,false);
  installGrammarIndex(JSON.parse(fs.readFileSync(new URL('../data/course-index.json',import.meta.url))));
  const lazy=familiarReviewItems(s,START+10*DAY);assert.equal(lazy.length,1);assert.equal(lazy[0].targets[0].contentUnavailable,false);assert(lazy[0].href.startsWith('#/review?target='));
  const unsupported=structuredClone(legacy);unsupported.units[0].lessons[0].objectives[0].questions=[{format:'essay',prompt:'An unsupported graded essay',answer:'a supplied model'}];installGrammarCourse([], [unsupported]);
  const unavailable=familiarReviewItems(s,START+10*DAY);assert.equal(unavailable[0].contentUnavailable,true);assert.equal(unavailable[0].href,`#/learn/grammar/${lesson.id}`);assert.equal(unavailable[0].targets[0].objectiveId,target.id);
  assert.equal(createReviewVisit(s,unavailable,{id:'unsupported-grammar',now:START+10*DAY}).reviewVisit.total,0);
});
test('equivalent mappings reject changes to sense, case or evidence mode',()=>{
  declareObjective({id:'mapping-old',entryId:'mapping-entry',skill:'article',evidenceModes:['recognition']});
  declareObjective({id:'mapping-new',entryId:'mapping-entry',skill:'article',evidenceModes:['production']});
  assert.throws(()=>declareAlias({legacyId:'mapping-old',canonicalId:'mapping-new',relation:'equivalent'}),/same evidence modes/);
  declareObjective({id:'mapping-other-sense',entryId:'mapping-entry',senseId:'different',skill:'article',evidenceModes:['recognition']});
  assert.throws(()=>declareAlias({legacyId:'mapping-old',canonicalId:'mapping-other-sense',relation:'equivalent'}),/same sense/);
});
test('reading and listening review preserve complete sources and require actual listening evidence',()=>{
  const packs=['Foundations','A1'].map(level=>JSON.parse(fs.readFileSync(new URL(`../data/course-v2/${level}.json`,import.meta.url))));installGrammarCourse(packs);
  const weather=grammarCourse.lessons.find(l=>l.id==='v2-a1-weather-conditions');
  const reading=grammarCourse.lessons.find(l=>l.id==='v2-a1-read-a-message'),listening=grammarCourse.lessons.find(l=>l.id==='v2-f-listen-first-contact');
  const row=lesson=>({id:`g:${lesson.id}|grammar`,entryId:`g:${lesson.id}`,entry:{id:`g:${lesson.id}`,kind:'grammar'},label:lesson.title,caseId:'grammar',targets:[{objectiveId:lesson.targets[0].id,skill:'practical-detail',due:START}]});
  const weatherRow=row(weather),weatherQuestion=reviewQuestion(weatherRow,weatherRow.targets[0]);assert(weatherQuestion.prompt.includes(weatherQuestion.sourceStep.context));assert(weatherQuestion.prompt.includes(weatherQuestion.sourceStep.translation));
  const readRow=row(reading),read=reviewQuestion(readRow,readRow.targets[0]);assert(read.prompt.includes(read.say));assert(read.prompt.includes('course-passage'));
  const s=fixture([]),listenRow=row(listening),unheard=createReviewVisit(s,[listenRow],{id:'unheard',now:START,limit:1});
  const q=currentReviewQuestion(unheard).question,asset=JSON.parse(fs.readFileSync(new URL('../data/course-v2/audio.json',import.meta.url))).assets.find(a=>a.id===q.audioId);
  assert(q.listening);assert.equal(asset.spokenText.trim(),q.say.trim());assert(asset.reviewed);assert(fs.existsSync(new URL('../'+asset.src,import.meta.url)));
  const unsupported=reviewAttempt(unheard,q.answer[0],{now:START});assert(unsupported.event.assistance.includes('audio-unavailable'));s.learning=recordAttempt(s.learning,unsupported.event).learning;
  assert.equal(skillState(s.learning,listenRow.targets[0].objectiveId).independentCorrect,0);
  const heard=createReviewVisit(s,[listenRow],{id:'heard',now:START+DAY,limit:1}),heardQ=currentReviewQuestion(heard).question;
  const independent=reviewAttempt(heard,heardQ.answer[0],{now:START+DAY,audioAvailable:true});assert.deepEqual(independent.event.assistance,[]);s.learning=recordAttempt(s.learning,independent.event).learning;
  assert.equal(skillState(s.learning,listenRow.targets[0].objectiveId).independentCorrect,1);
});
console.log(`\n${passed} unified learning/review checks passed.`);
