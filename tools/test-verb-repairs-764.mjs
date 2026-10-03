import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLesson as metadata,lessonForms,lessonParticiples,lessonContexts} from '../js/learning/lesson-content.js';
import {simpleVerbContexts,progressiveContexts,progressiveSpec,frameEnglishForms} from '../js/learning/progressive-content.js';
import {conjugate,TENSES,MISSING} from '../js/conjugator.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createJourneyScene,retiredJourneyScene,journeySceneContexts} from '../js/learning/journey-scene.js';
import {createJourneySession,pinJourneyScene,currentJourneyStep,advanceJourney,journeyAttempt,recordJourneyAttempt} from '../js/learning/journey.js';
import {retiredJourneyForm,journeyFormSemantics} from '../js/learning/journey-form.js';
import {createLearning,normalizeLearning,mergeLearning} from '../js/learning/model.js';
import {priorCoreVectorsWithConcernereException} from './verb-reference-baseline.mjs';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),verbs=read('data/verbs.json'),verb=inf=>verbs.find(e=>e.inf===inf),fixture=read('docs/implementation/programme/verb-repairs-764-prior.json');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),copy=structuredClone,build=(e,o={})=>metadata(e,{...o,questionBuilder:buildJourneyQuestion}),targets=p=>p.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets));
const required=p=>p.chapters.map(c=>({id:c.id,targets:c.groups.flatMap(g=>g.targets).filter(t=>t.required!==false&&t.available!==false).map(t=>t.id)}));
const counts={priorPools:0,preservedPriorSelections:0,retiredContextOccurrences:0,currentSelections:0,priorFormCues:0,trattarsiRecoveryTransitions:0,validTrattarsiPriorSelections:0,currentTrattarsiContextCues:0,trattarsiPriorQuestionsExact:0,trattarsiPriorNullsExact:0,currentTrattarsiFiniteTips:0};const retiredIds=new Set();
for(const record of fixture.records){
 const entry=verb(record.id.slice(2)),plan=build(entry),prior=build(entry,{legacyExpanded:true}),fresh=targets(plan),oldTargets=targets(prior);
 assert.deepEqual(required(build(entry,{legacy:true})),record.ordinaryRequired,record.id+' ordinary completion requirements');
 assert.deepEqual(required(plan),record.expandedRequired,record.id+' current completion requirements');
 for(const chapter of record.chapters){assert.deepEqual(plan.chapters.find(c=>c.id===chapter.id)?.legacyRequirements,chapter.legacyRequirements);
  for(const old of chapter.targets){const target=oldTargets.find(t=>t.id===old.id),current=fresh.find(t=>t.id===old.id);assert(target&&current,old.id);
   assert.equal(target.contexts?.length||0,old.poolSize);assert.equal(hash(target.contexts||[]),old.poolSHA256,old.id+' exact prior full pool/order');
   if(old.poolSize)assert.equal(hash(current.legacyExpandedContexts||current.contexts),old.poolSHA256,old.id+' live prior pool');
   assert.equal(hash(current.legacyAuthoredContexts||[]),old.legacyAuthoredSHA256,old.id+' ordinary source pool');counts.priorPools++;
  }
 }
 for(const chapter of plan.chapters)for(const target of chapter.groups.flatMap(g=>g.targets)){
  for(const [variant,context]of journeySceneContexts(target,{legacy:true}).entries()){
   const snapshot={...createJourneyScene({entryId:entry.id,chapterId:chapter.id,target,variant,legacy:true}),sourceRevision:record.priorSceneRevision};
   const q=buildJourneyQuestion(entry,chapter,target,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1',sceneSnapshot:snapshot});
   if(retiredJourneyScene(snapshot,target)){assert.equal(entry.inf,'discriminare');assert.equal(q,null);retiredIds.add(context.id);counts.retiredContextOccurrences++;}
   else{assert(q,context.id);assert.equal(q.context.it,context.it);assert.equal(q.context.en,context.en);counts.preservedPriorSelections++;}
  }
  for(const [variant,context]of journeySceneContexts(target).entries()){
   const snapshot=createJourneyScene({entryId:entry.id,chapterId:chapter.id,target,variant});assert(!retiredJourneyScene(snapshot,target));
   const q=buildJourneyQuestion(entry,chapter,target,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1',sceneSnapshot:snapshot});assert(q,context.id);assert.equal(q.context.it,context.it);assert.equal(q.context.en,context.en);counts.currentSelections++;
  }
 }
}
assert.equal(retiredIds.size,49);assert.equal(progressiveSpec(verb('discriminare')).retiredExpandedContextIds.length,49);assert([...retiredIds].every(id=>/:scene-0-|:reviewed-frame-0:/.test(id)));
for(const make of [simpleVerbContexts,progressiveContexts])for(const chapter of ['present','background']){
 const scenes=make(verb('discriminare'),{chapter,section:'all'}).filter(c=>c.id.includes('scene-0-'));assert.equal(scenes.length,7);assert(scenes.every(c=>c.it.endsWith('una minoranza.')&&!c.it.includes('contro')));
 for(const [inf,index,phrase]of [['trattenere',3,'my breath'],['avviare',2,'a machine'],['candidarsi',2,'in the election'],['cogliere',2,'an opportunity'],['esercitare',0,'a profession'],['esercitare',2,'pressure']]){
  const s=make(verb(inf),{chapter,section:'all'}).find(c=>c.id.includes(`scene-${index}-0-ordinary`));assert(s,inf);assert(s.en.endsWith(phrase+'.'));assert(!s.en.includes('{poss}'));
 }
 const duty=make(verb('adempiere'),{chapter,section:'all'}).filter(c=>c.id.includes('scene-0-'));assert(duty.every(c=>c.it.endsWith('a un dovere.')&&c.en.endsWith('a duty.')));
}
assert.deepEqual(frameEnglishForms(progressiveSpec(verb('avviare')),2),['start','starts','started','starting']);
assert.deepEqual(frameEnglishForms(progressiveSpec(verb('cogliere')),2),['seize','seizes','seized','seizing']);
assert.deepEqual(frameEnglishForms(progressiveSpec(verb('esercitare')),0),['practise','practises','practised','practising']);
assert.deepEqual(frameEnglishForms(progressiveSpec(verb('esercitare')),2),['exert','exerts','exerted','exerting']);
for(const [inf,word]of [['estinguersi','dying out'],['precipitare','plunging']]){
 const now=simpleVerbContexts(verb(inf),{chapter:'background',section:'all'}),old=simpleVerbContexts(verb(inf),{chapter:'background',section:'all',legacyExpanded:true});
 assert(now.filter(c=>c.person===2).every(c=>c.en.includes('was '+word)));assert(now.filter(c=>c.person===5).every(c=>c.en.includes('were '+word)));assert(old.every(c=>c.en.includes('used to')));
}
assert.match(progressiveSpec(verb('riferirsi')).note,/stare \+ gerundio can focus on an ongoing act/);assert.equal(progressiveSpec(verb('riferirsi')).policy,'simple');
assert.match(verb('preservare').usage,/protecting food or crops/);assert.match(verb('provvedere').usage,/Provveduto is the usual.*provvisto is also attested but rare/);
assert.deepEqual(verb('istituire').examples[1],{it:'La legge del 1949 istituì il 2 giugno come festa nazionale.',en:'The 1949 law established 2 June as a national holiday.'});
assert.equal(verb('privare').examples[2].it,'Non voglio privarti del tempo per riposare.');assert.equal(verb('recarsi').examples[2].it,'Per rinnovare il passaporto, mi recherò in questura.');
for(const [inf,index]of [['istituire',1],['privare',2],['recarsi',2]])assert(!['present','past','background','future','condizionale'].flatMap(ch=>lessonContexts(verb(inf),ch)).some(c=>c.it===verb(inf).examples[index].it),'Factual source correction remains reference-only');
// The broad personal reflexive paradigm remains valid. Only this lesson's
// impersonal meaning fixes the participle and its grammatical-subject answer.
const entry=verb('trattarsi'),plan=build(entry),history=plan.questionHistory,trPrior=fixture.records.find(r=>r.id===entry.id);assert(history);assert.equal(history.retiredFormTargetIds.length,12);assert.equal(history.previousRevision,'expanded-v1');
assert.equal(conjugate(entry.inf,entry).tenses.passatoProssimo[0],'mi sono trattato/a','Personal reflexive reference is not narrowed');
// These hashes were captured with the actual archived 8517 formatter, not a
// current reconstruction. Preserve usage questions, optional source chapters,
// and explicit old-null recipes as well as the previously tested typed forms.
assert.equal(fixture.trattarsiQuestionRecipes.baseline,'8517db3');
for(const saved of fixture.trattarsiQuestionRecipes.records){
 const chapter=(saved.ordinary?history.ordinaryChapters:history.chapters).find(c=>c.id===saved.chapterId),target=chapter.groups.flatMap(g=>g.targets).find(t=>t.id===saved.targetId);
 const q=buildJourneyQuestion({...history.entry,_historicalLessonForms:true},chapter,target,{variant:saved.variant,phase:saved.phase,format:saved.format,historicalForms:true,...saved.ordinary?{}:{scenePolicy:'expanded-v1'}});
 assert.equal(!!q,saved.available,`${saved.targetId} ${saved.format} prior availability`);
 assert.equal(hash(journeyFormSemantics(q)),saved.sha256,`${saved.targetId} ${saved.format} exact archived semantics`);
 if(q)counts.trattarsiPriorQuestionsExact++;else counts.trattarsiPriorNullsExact++;
}
for(const t of TENSES)if(t.compound){assert(lessonForms(entry,t.key,2).length);assert(lessonForms(entry,t.key,2).every(a=>a.endsWith('trattato')));assert.deepEqual(lessonForms(entry,t.key,0),[]);}assert.deepEqual(lessonParticiples(entry),['trattato']);
for(const oldChapter of trPrior.chapters){const chapter=history.chapters.find(c=>c.id===oldChapter.id);for(const old of oldChapter.targets){const target=chapter.groups.flatMap(g=>g.targets).find(t=>t.id===old.id);for(const [variant,sha]of old.formCueSHA256.entries()){if(!sha)continue;const q=buildJourneyQuestion({...history.entry,_historicalLessonForms:true},chapter,target,{variant,phase:'independent',format:'type',scenePolicy:'expanded-v1',historicalForms:true});assert(q);assert.equal(hash({contextId:q.meta.contextId,variantId:q.meta.variantId,answers:q.answer,prompt:q.prompt,say:q.say}),sha);counts.priorFormCues++;}}}
function historicalSession(chapterId,targetId,{ordinary=false,variant=0,format='type'}={}){
 const chapter=(ordinary?history.ordinaryChapters:history.chapters).find(c=>c.id===chapterId),target=chapter.groups.flatMap(g=>g.targets).find(t=>t.id===targetId);let s=createJourneySession({id:'trattarsi-old',plan,chapterId});
 Object.assign(s.journey,{chapterId,phase:'practice',groupIndex:chapter.groups.findIndex(g=>g.targets.includes(target)),current:{targetId,phase:'independent',format,variant,questionId:'saved-trattarsi',supplemental:false,repairTag:null,...ordinary?{}:{scenePolicy:'expanded-v1'}}});if(ordinary)delete s.journey.verbFlowVersion;
 s.ui={questionId:'saved-trattarsi',draft:'  saved original answer  ',given:'an earlier answer',result:{ok:false,feedback:'Earlier feedback'},history:[{questionId:'past-answer',given:'si è trattato'}]};return pinJourneyScene(plan,s);
}
for(const targetId of history.retiredFormTargetIds){const chapter=history.chapters.find(c=>c.groups.some(g=>g.targets.some(t=>t.id===targetId)));
 for(const ordinary of [false,true])for(const variant of [0,1])for(const format of ['type','mc','letters','match']){
  const s=historicalSession(chapter.id,targetId,{ordinary,variant,format}),before=copy(s),learning=createLearning(1);assert(s.journey.current.formSnapshot,targetId);assert(retiredJourneyForm(s.journey.current.formSnapshot,history));assert.equal(currentJourneyStep(plan,s).type,'corrected');
  assert.equal(journeyAttempt(plan,s,{type:'type',meta:{targetId}},{ok:true}),null);assert.deepEqual(recordJourneyAttempt(plan,s,{id:'forged',targetId,ok:true},{}),s);
  const next=advanceJourney(plan,s,learning,{now:25}),step=currentJourneyStep(plan,next);assert.equal(step.type,'question');assert.notEqual(step.questionId,before.journey.current.questionId);assert.equal(step.formSnapshot.sourceRevision,history.currentRevision);assert.deepEqual(next.sceneCorrectionRecovery.at(-1).ui,before.ui);assert.deepEqual(next.sceneCorrectionRecovery.at(-1).journey,before.journey);assert.equal(next.index,before.index);assert.deepEqual(next.answeredEventIds,before.answeredEventIds);assert.deepEqual(learning.events,{});counts.trattarsiRecoveryTransitions++;
 }
}
for(const ordinary of [false,true])for(const [chapterId,suffix]of [['present','form-2'],['background','form-2'],['past','participle-part']]){
 const targetId=entry.id+'::lesson::'+chapterId+'::'+suffix,s=historicalSession(chapterId,targetId,{ordinary}),before=copy(s);assert.equal(currentJourneyStep(plan,s).type,'question');assert(!retiredJourneyForm(s.journey.current.formSnapshot,history));assert.deepEqual(pinJourneyScene(plan,s),before);const l=createLearning(1);l.session=s;l.sessions[entry.id+'|lesson']=s;const merged=mergeLearning(normalizeLearning(copy(l),2),createLearning(1),3);assert.deepEqual(merged.session.ui,s.ui);assert.deepEqual(merged.session.journey.current.formSnapshot,s.journey.current.formSnapshot);counts.validTrattarsiPriorSelections++;
}
for(const chapter of plan.chapters)for(const target of chapter.groups.flatMap(g=>g.targets))for(let variant=0;variant<(target.contexts?.length||0);variant++){
 const q=buildJourneyQuestion(entry,chapter,target,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1'});if(!q?.context)continue;assert.match(q.prompt,/impersonal: si tratta di/);assert(!q.prompt.includes('lui/lei'));counts.currentTrattarsiContextCues++;
}
for(const chapter of plan.chapters)for(const target of chapter.groups.flatMap(g=>g.targets))if(target.skill==='conjugation'&&target.person===2){
 for(const variant of [0,1])for(const format of ['type','mc','letters','match','pairs']){
  const q=buildJourneyQuestion(entry,chapter,target,{variant,format,phase:'independent',scenePolicy:'expanded-v1'});if(!q||q.context)continue;
  assert.match(q.tip,/impersonal si/);assert(!q.tip.includes('lui/lei'));assert(!q.lesson.includes('With essere, the participle agrees with the subject'));
  if(TENSES.find(t=>t.key===target.tense)?.compound){assert.equal(q.meta.diagnostic.compound.agreementRule,'impersonal-fixed');assert.deepEqual(q.meta.diagnostic.compound.participles,['trattato']);}
  counts.currentTrattarsiFiniteTips++;
 }
}
const c=conjugate('concernere',{aux:'avere'});assert.equal(c.nonFinite.participioPassato,MISSING);assert.equal(c.nonFinite.infinitoPassato,MISSING);assert.equal(c.nonFinite.gerundioPassato,MISSING);assert.equal(c.nonFinite.participioPresente,'concernente');assert.equal(c.nonFinite.gerundio,'concernendo');assert(c.defective.includes('participioPassato'));assert(c.defective.includes('passatoRemoto'));
for(const tense of TENSES.filter(t=>t.compound||t.key==='passatoRemoto'))assert.deepEqual(c.tenses[tense.key],Array(6).fill(MISSING));assert.deepEqual(lessonParticiples(verb('concernere')),[]);
const core=verbs.map(e=>({id:e.id,cases:['presente','passatoProssimo','imperfetto','futuro','condizionale'].map(k=>conjugate(e.inf,e).tenses[k])}));assert.equal(hash(priorCoreVectorsWithConcernereException(core)),fixture.coreArraySHA256);
const report={status:'passed',baseline:fixture.baseline,entries:fixture.records.length,...counts,uniqueRetiredContextIds:retiredIds.size,trattarsiRetiredFormTargets:history.retiredFormTargetIds.length,unchangedOtherCoreParadigms:1185,explicitDefectiveReferenceRepair:'v:concernere',independentAgentReview:'pending',nativeItalianEducatorReview:'pending',scope:'Declared corrections and exact prior/current source/prompt transitions; not every generated question or a whole-catalogue linguistic approval.'};console.log(JSON.stringify(report,null,2));if(process.argv.includes('--report'))fs.writeFileSync(new URL('docs/implementation/programme/verb-repairs-764-checks.json',root),JSON.stringify(report,null,2)+'\n');
