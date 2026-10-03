import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLesson as metadata,formalLessonForms} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {journeyFormSemantics,retiredJourneyForm} from '../js/learning/journey-form.js';
import {createJourneySession,pinJourneyScene,currentJourneyStep,advanceJourney,journeyAttempt,journeyPairAttempt,recordJourneyAttempt} from '../js/learning/journey.js';
import {TENSES,conjugate} from '../js/conjugator.js';
import {createLearning,normalizeLearning,mergeLearning} from '../js/learning/model.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),verbs=read('data/verbs.json'),prior=read('docs/implementation/programme/formal-ci-prior.json');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),copy=v=>structuredClone(v),build=e=>metadata(e,{questionBuilder:buildJourneyQuestion}),targets=p=>p.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets));
const changed=new Set(['v:entrarci','v:cascarci','v:restarci','v:starci','v:uscirne']),counts={priorDescriptors:0,currentGenderQuestions:0,agreementDiagnoses:0,recoveryTransitions:0,pairFences:0,unchangedFormalFamilies:0};
function oldSession(plan,chapterId,targetId,{ordinary=false,variant=0,format='type'}={}){
 const chapter=(ordinary?plan.questionHistory.ordinaryChapters:plan.questionHistory.chapters).find(c=>c.id===chapterId);
 let s=createJourneySession({id:'formal-ci-history',plan,chapterId});
 Object.assign(s.journey,{chapterId,phase:format==='pairs'?'guided':'practice',groupIndex:chapter.groups.findIndex(g=>g.targets.some(t=>t.id===targetId)),current:{targetId,phase:format==='pairs'?'guided':'independent',format,variant,questionId:'saved-formal-ci',supplemental:false,repairTag:null,...ordinary?{}:{scenePolicy:'expanded-v1'}}});
 if(ordinary)delete s.journey.verbFlowVersion;
 s.ui={questionId:'saved-formal-ci',draft:'  original typed answer  ',given:'earlier answer',result:{ok:false,feedback:'Exact earlier feedback'},history:[{questionId:'earlier',given:'ci sono stato'}]};
 return pinJourneyScene(plan,s);
}
for(const old of prior.records){
 const entry=verbs.find(e=>e.id===old.entryId),plan=build(entry),history=plan.questionHistory;
 assert(history);assert.deepEqual(history.retiredFormTargetIds,old.retiredTargetIds);
 assert.deepEqual(plan.chapters.map(c=>({id:c.id,targets:c.groups.flatMap(g=>g.targets).filter(t=>t.available!==false&&t.required!==false).map(t=>t.id)})),old.required,'Completion scope is unchanged');
 for(const d of old.descriptors){
  const chapter=(d.ordinary?history.ordinaryChapters:history.chapters).find(c=>c.id===d.chapterId),target=chapter.groups.flatMap(g=>g.targets).find(t=>t.id===d.targetId);
  const q=buildJourneyQuestion({...history.entry,_historicalLessonForms:true},chapter,target,{variant:d.variant,format:d.format,phase:'independent',historicalForms:true,...d.ordinary?{}:{scenePolicy:'expanded-v1'}});
  assert.equal(hash(journeyFormSemantics(q)),d.sha256,d.targetId+' exact old descriptor');counts.priorDescriptors++;
 }
 for(const targetId of old.retiredTargetIds){
  const chapter=plan.chapters.find(c=>c.groups.some(g=>g.targets.some(t=>t.id===targetId))),target=targets(plan).find(t=>t.id===targetId);
  for(const variant of [0,1])for(const format of ['type','mc','letters','match']){
   const q=buildJourneyQuestion(entry,chapter,target,{variant,format,phase:'independent',scenePolicy:'expanded-v1'});
   assert(q);assert(q.prompt.includes(variant?'Signor Rossi':'Signora Rossi'));
   assert(q.answer.length>=1&&q.answer.every(a=>a.endsWith(variant?'o':'a')),targetId+' requested gender only');
   assert(q.say.endsWith(variant?'o':'a'));assert(q.answer.every(a=>q.meta.diagnostic.expected.includes(a)));counts.currentGenderQuestions++;
   if(format==='type'){
    const wrong=q.answer[0].slice(0,-1)+(variant?'a':'o'),result=gradeQuestion(q,wrong,{accentStrict:true});
    assert.equal(result.ok,false);assert.deepEqual(result.errorTags,['agreement'],targetId+' ending feedback');
    for(const skill of ['person','auxiliary','participle'])assert(result.components.some(c=>c.skill===skill&&c.ok),targetId+' retains '+skill);
    assert(result.components.some(c=>c.skill==='agreement'&&!c.ok));counts.agreementDiagnoses++;
   }
  }
  for(const ordinary of [false,true])for(const variant of [0,1]){
   const s=oldSession(plan,chapter.id,targetId,{ordinary,variant}),learning=createLearning(1),before=copy(s);
   assert(retiredJourneyForm(s.journey.current.formSnapshot,history));assert.equal(currentJourneyStep(plan,s).type,'corrected');
   assert.equal(journeyAttempt(plan,s,{meta:{targetId},type:'type'},{ok:true}),null);
   assert.equal(journeyPairAttempt(plan,s,{pairs:[]},{ok:true},{targetId}),null);
   assert.deepEqual(recordJourneyAttempt(plan,s,{id:'forged',targetId,ok:true},{}),s);
   const next=advanceJourney(plan,s,learning,{now:20}),step=currentJourneyStep(plan,next);
   assert.equal(step.type,'question');assert.notEqual(step.questionId,'saved-formal-ci');assert.equal(step.formSnapshot.sourceRevision,history.currentRevision);
   assert.deepEqual(next.sceneCorrectionRecovery.at(-1).ui,before.ui);assert.deepEqual(next.sceneCorrectionRecovery.at(-1).journey,before.journey);
   assert.equal(next.index,s.index);assert.deepEqual(next.answeredEventIds,s.answeredEventIds);assert.deepEqual(learning.events,{});counts.recoveryTransitions++;
  }
  const group=chapter.groups.find(g=>g.targets.includes(target)),other=group.targets.find(t=>t.skill==='conjugation'&&t.person===1);
  if(other)for(const ordinary of [false,true]){
   const s=oldSession(plan,chapter.id,other.id,{ordinary,format:'pairs'});
   assert.equal(s.journey.current.formSnapshot.descriptor.type,'pairs');assert.equal(currentJourneyStep(plan,s).type,'corrected');counts.pairFences++;
  }
 }
 // A valid prior present cue retains its exact identity/draft/feedback; source
 // tampering stays unavailable instead of being reinterpreted as a new answer.
 const present=targets(plan).find(t=>t.id.endsWith('::present::formal'));
 const s=oldSession(plan,'present',present.id),before=copy(s);assert.equal(currentJourneyStep(plan,s).type,'question');assert.deepEqual(pinJourneyScene(plan,s),before);
 const learning=createLearning(1);learning.session=s;learning.sessions[entry.id+'|lesson']=s;
 const normalized=normalizeLearning(copy(learning),2),merged=mergeLearning(normalized,createLearning(1),3);
 assert.deepEqual(merged.session.journey.current.formSnapshot,s.journey.current.formSnapshot);assert.deepEqual(merged.session.ui,s.ui);
 for(const alter of [x=>x.sourceRevision='unknown',x=>x.descriptor.answer=['invented'],x=>x.descriptor.prompt+=' edited',x=>x.variant++]){
  const bad=copy(s);alter(bad.journey.current.formSnapshot);const priorBad=copy(bad);assert.equal(currentJourneyStep(plan,bad).type,'unavailable');assert.deepEqual(pinJourneyScene(plan,bad),priorBad);
 }
}
// The catalogue-wide comparison catches accidental loss of object-clitic,
// reflexive, dual-auxiliary or non-compound alternatives. Volerci has no formal
// learner target, but the helper now uses the same subject-agreement rule.
for(const old of prior.catalogueFormalSHA256){
 const entry=verbs.find(e=>e.id===old.id);if(changed.has(old.id)||old.id==='v:volerci'||old.id==='v:trattarsi'||old.id==='v:concernere')continue;
 assert.equal(hash(TENSES.flatMap(t=>[false,true].map(f=>formalLessonForms(entry,t.key,f)))),old.sha256,old.id+' unrelated formal answers');counts.unchangedFormalFamilies++;
}
for(const inf of ['farcela','cavarsela','avercela','andarsene','pensarci']){
 const e=verbs.find(e=>e.inf===inf);assert(e,inf);const f=formalLessonForms(e,'passatoProssimo',true),m=formalLessonForms(e,'passatoProssimo',false);
 if(inf==='andarsene'){assert(f.every(a=>a.endsWith('a')));assert(m.every(a=>a.endsWith('o')));}
 else assert.deepEqual(f,m,inf+' object agreement unchanged');
}
assert(!targets(build(verbs.find(e=>e.inf==='volerci'))).some(t=>t.skill==='address'),'No personal formal lesson invented for impersonal need');
const result={status:'passed',baseline:prior.commit,entries:[...changed],...counts,scope:'Exact authored form agreement and source-bound legacy recovery; not whole-catalogue linguistic approval or native human review.'};
console.log(JSON.stringify(result,null,2));if(process.argv.includes('--report'))fs.writeFileSync(new URL('../docs/implementation/programme/formal-ci-checks.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
