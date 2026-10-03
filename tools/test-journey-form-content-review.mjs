// Independent controller review by the curriculum source author. This covers
// exact current cues and every declared recovery transition, not learner trials.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLesson as buildLessonMetadata} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createJourneySession,pinJourneyScene,currentJourneyStep,advanceJourney} from '../js/learning/journey.js';
const buildLesson=(entry,options={})=>buildLessonMetadata(entry,{...options,questionBuilder:buildJourneyQuestion});
const entries=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url)));
let currentQuestions=0,transitions=0;
for(const inf of ['succedere','bisognare']){
 const entry=entries.find(e=>e.inf===inf),plan=buildLesson(entry);
 for(const chapter of plan.chapters)for(const target of chapter.groups.flatMap(g=>g.targets)){
  if(target.available===false||!['context','conjugation'].includes(target.skill))continue;
  for(let variant=0;variant<Math.max(2,(target.contexts?.length||0)*2);variant++){
   const q=buildJourneyQuestion(entry,chapter,target,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1'});
   assert(q,target.id);
   assert(!/lui\/lei|Signor.*Rossi|he \/ she|Formal Lei/.test(q.prompt),target.id+' fresh event/impersonal cue');
   assert.match(q.prompt,inf==='bisognare'?/impersonal necessity/:/one thing or situation|more than one thing/);
   currentQuestions++;
  }
 }
 for(const ordinary of [false,true])for(const id of plan.questionHistory.retiredFormTargetIds){
  const prior=ordinary?plan.questionHistory.ordinaryChapters:plan.questionHistory.chapters;
  const chapter=prior.find(ch=>ch.groups.some(g=>g.targets.some(t=>t.id===id)));assert(chapter,id);
  let session=createJourneySession({id:'independent-content-review',plan,chapterId:'present'});
  Object.assign(session.journey,{chapterId:chapter.id,phase:'practice',current:{targetId:id,phase:'independent',format:'type',variant:0,questionId:'old-exact',supplemental:false,repairTag:null,...ordinary?{}:{scenePolicy:'expanded-v1'}}});
  session.ui={questionId:'old-exact',draft:'exact draft',result:{ok:false,feedback:'old feedback'},history:[]};
  session=pinJourneyScene(plan,session);assert.equal(currentJourneyStep(plan,session).type,'corrected',id);
  const next=advanceJourney(plan,session,null,{now:100});
  assert.equal(currentJourneyStep(plan,next).type,'question',id+' Continue');assert.notEqual(next.journey.current.questionId,'old-exact');
  assert.equal(next.index,session.index);assert.deepEqual(next.answeredEventIds,session.answeredEventIds);
  assert.deepEqual(next.sceneCorrectionRecovery.at(-1).ui,session.ui);
  assert.deepEqual(next.sceneCorrectionRecovery.at(-1).journey,session.journey);
  assert.equal(next.journey.current.formSnapshot.sourceRevision,plan.questionHistory.currentRevision);
  transitions++;
 }
}
assert.equal(currentQuestions,150);assert.equal(transitions,194);
console.log(`${currentQuestions} current form/context/mixed cues and ${transitions} exact declared ordinary/expanded recovery transitions pass; old draft/feedback/receipt vectors are preserved without a new attempt.`);
