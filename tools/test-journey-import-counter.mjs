#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLesson as buildLessonMetadata} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createLearning,normalizeLearning,recordAttempt,skillState} from '../js/learning/model.js';
import {createJourneySession,currentJourneyStep,pinJourneyScene,journeyAttempt,recordJourneyAttempt,advanceJourney} from '../js/learning/journey.js';
const buildLesson=(entry,options={})=>buildLessonMetadata(entry,{...options,questionBuilder:buildJourneyQuestion});
const entry={...JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))).find(v=>v.inf==='parlare'),kind:'verb'};
const plan=buildLesson(entry),chapter=plan.chapters.find(c=>c.id==='present'),target=chapter.groups.flatMap(g=>g.targets).find(t=>t.skill==='conjugation'&&t.person===0);
const copy=value=>JSON.parse(JSON.stringify(value));
let count=0;
for(const existing of [false,true]){
 const source=createJourneySession({id:'counter-import-'+existing,plan,chapterId:'present',caseMode:true,now:1});
 Object.assign(source.journey,{phase:'practice',serial:1,queue:[target.id],current:{targetId:target.id,phase:'independent',format:'type',variant:0,questionId:source.id+':journey:1',supplemental:false,repairTag:null,scenePolicy:'expanded-v1',sceneRevision:target.sceneRevision||'expanded-v1'}});
 if(existing)source.journey.variants[target.id]={guided:3,independent:8,repair:5};
 source.ui={questionId:source.journey.current.questionId,draft:'parlo',assistance:['hint'],result:null};
 const original=createLearning(1);original.session=source;original.sessions[entry.id+'|lesson']=source;
 const learning=normalizeLearning(copy(original),2),session=pinJourneyScene(plan,learning.session),before=copy(session),step=currentJourneyStep(plan,session),q=buildJourneyQuestion(entry,chapter,target,step);
 assert.equal(step.type,'question');assert(q);
 const event=journeyAttempt(plan,session,q,{ok:true,outcome:'correct'},{now:100,assistance:['hint']});
 assert.deepEqual(event.assistance,['hint']);
 const recorded=recordAttempt(learning,{...event,deviceId:'counter-test',sequence:1,epochId:learning.epoch.id});
 const saved=recordJourneyAttempt(plan,session,event,recorded);
 assert.equal(saved.index,1);assert(saved.journey.awaitingContinue);assert.equal(saved.journey.current.questionId,session.journey.current.questionId);
 assert.deepEqual(saved.journey.variants[target.id],{guided:existing?3:0,independent:0,repair:existing?5:0});
 assert.deepEqual(session,before);assert.equal(skillState(recorded.learning,target.id,100).ready,false);
 assert.deepEqual(recordJourneyAttempt(plan,saved,event,recorded),saved);
 const replay=recordAttempt(recorded.learning,{...event,deviceId:'counter-test',sequence:1,epochId:learning.epoch.id});assert.equal(Object.keys(replay.learning.events).length,1);
 const resumed=normalizeLearning({...recorded.learning,session:saved,sessions:{[entry.id+'|lesson']:saved}},101).session;
 assert(resumed.journey.awaitingContinue);assert.equal(resumed.ui.draft,'parlo');assert.equal(advanceJourney(plan,resumed,recorded.learning,{now:102}).index,1);
 console.log('PASS Imported assisted question '+(existing?'preserves existing counters':'initializes only its missing counter')+' and replays once');count++;
}
console.log(`${count} imported Journey counter checks passed.`);
