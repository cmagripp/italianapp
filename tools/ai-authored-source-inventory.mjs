// Catalogue support inventory, not a model or editorial quality evaluation.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createLabSession} from '../js/learning/sentence-lab.js';
import {createWorkshopPracticeBinding,createCoursePracticeBinding,createGrammarPracticeBinding,createPracticeSourceResolver} from '../js/learning/practice-sources.js';
import {installGrammarCourse,grammarLesson} from '../js/learning/grammar-course.js';
import {createCourseSession} from '../js/learning/course-v2-engine.js';
import {createGrammarSession} from '../js/learning/grammar-journey.js';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url)));
const paths=['presente','passato','futuro','strutture'].map(stage=>`data/sentence-lab/${stage}.json`),packs=paths.map(read),byId=new Map(packs.flatMap(pack=>pack.lessons.map(lesson=>[lesson.id,{lesson,pack}])));
const resolver=createPracticeSourceResolver({lookupWorkshop:id=>byId.get(id)?.lesson,lookupWorkshopStage:id=>byId.get(id)?.pack}),slots=[];
for(const pack of packs)for(const lesson of pack.lessons)for(const [activityIndex,activity] of lesson.activities.entries()){
 const turns=activity.kind==='dialogue'?activity.turns:activity.kind==='cloze'?[activity]:[];
 for(const [turnIndex,turn] of turns.entries())for(const [blankIndex,blank] of (turn.blanks||[]).entries())if(blank.free){
  const agreements={};for(const agreement of ['m','f']){
   const session=createLabSession(lesson);Object.assign(session,{index:activityIndex,speakerAgreement:agreement,state:{kind:activity.kind,result:null,...activity.kind==='dialogue'?{turnIndex}:{}}});
   const binding=createWorkshopPracticeBinding({lesson,stage:pack,session,blankIndex}),source=binding&&resolver.resolve(binding);
   agreements[agreement]={supported:!!source,referenceTexts:source?.references.map(reference=>reference.it)||[]};
  }
  slots.push({stage:pack.stage,lessonId:lesson.id,activityId:activity.id,activityIndex,turnIndex:activity.kind==='dialogue'?turnIndex:null,blankIndex,template:turn.template,accept:blank.accept,agreements});
 }
}
const courseIndex=read('data/course-index.json'),coursePacks=courseIndex.levels.map(pack=>read(pack.path)),grammarPacks=courseIndex.legacyLevels.map(pack=>read(pack.path));installGrammarCourse(coursePacks,grammarPacks);
const counts={course:{question:0,portfolio:0,unsupported:[]},grammar:{question:0,teach:0,repair:0,unsupported:[]}};
for(const pack of coursePacks)for(const unit of pack.units)for(const raw of unit.lessons){
 const lesson=grammarLesson(raw.id),session=createCourseSession(lesson);for(const [index,step] of lesson.steps.entries())if(['question','portfolio'].includes(step.kind)){session.courseV2.stepIndex=index;const binding=createCoursePracticeBinding({lesson,session});if(binding&&resolver.resolve(binding))counts.course[step.kind]++;else counts.course.unsupported.push({lessonId:lesson.id,stepId:step.id});}
}
for(const pack of grammarPacks)for(const unit of pack.units)for(const raw of unit.lessons){
 const lesson=grammarLesson(raw.id),session=createGrammarSession(lesson,{mode:'review'});for(const [objectiveIndex,objective] of lesson.objectives.entries()){
  session.grammar.objectiveIndex=objectiveIndex;for(const phase of ['question','teach','repair'])for(const [index,value] of (phase==='teach'?objective.teach:objective.questions).entries()){
   Object.assign(session.grammar,{phase,teachIndex:phase==='teach'?index:0,questionIndex:phase==='teach'?0:index,questionId:phase==='teach'?objective.questions[0]?.id:value.id,repairQuestion:phase==='repair'?value.id:null});
   const binding=createGrammarPracticeBinding({lesson,session});if(binding&&resolver.resolve(binding))counts.grammar[phase]++;else counts.grammar.unsupported.push({lessonId:lesson.id,objectiveId:objective.id,phase,id:value.id||index});
  }
 }
}
const supported=slots.filter(slot=>slot.agreements.m.supported&&slot.agreements.f.supported),report={generatedAt:new Date().toISOString(),scope:'Exact current canonical source support only; no rule, editorial or real model quality approval.',policy:'Workshop uses a whole accepted phrase with neighbouring canonical template tokens; unsupported sources have no fallback example.',packs:[...paths,...courseIndex.levels.map(pack=>pack.path),...courseIndex.legacyLevels.map(pack=>pack.path)].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(new URL('../'+path,import.meta.url))).digest('hex')})),course:counts.course,grammar:counts.grammar,lessons:byId.size,freeSlots:slots.length,supportedBothAgreements:supported.length,unsupported:slots.length-supported.length,slots};
fs.writeFileSync(new URL('../docs/implementation/programme/ai-authored-source-inventory.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({course:report.course,grammar:report.grammar,workshop:{lessons:report.lessons,freeSlots:report.freeSlots,supportedBothAgreements:report.supportedBothAgreements,unsupported:report.unsupported}}));
