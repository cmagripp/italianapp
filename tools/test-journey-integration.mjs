#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { data } from '../js/data.js';
import { createLearning, recordAttempt, learningSessionKey, normalizeLearning, setCompletionRecord } from '../js/learning/model.js';
import { createJourneySession, skipJourneyTarget, chooseJourneyChapter } from '../js/learning/journey.js';
import { lessonPlan, lessonObjectives, recommendLesson, eligibleSkills, dueSkills, activeObjectives, practiceHref } from '../js/learning/integration.js';

data.verbs = JSON.parse(readFileSync(new URL('../data/verbs.json', import.meta.url))).map(e=>({...e,kind:'verb',it:e.inf}));
data.vocab = JSON.parse(readFileSync(new URL('../data/vocab.json', import.meta.url))).map(e=>({...e,kind:'word'}));
data.byId = new Map([...data.verbs,...data.vocab].map(e=>[e.id,e])); data.loaded=true;
const NOW=1700000000000, DAY=86400e3;
const verb=name=>data.verbs.find(e=>e.inf===name);
const word=name=>data.vocab.find(e=>e.it===name&&e.pos==='noun');
let passed=0;
function test(name,run){run();passed++;console.log(`✓ ${name}`);}
function fixture(entries=[verb('credere'),word('casa')]){
  let serial=0;
  const store={learning:createLearning(NOW),current:{custom:{},customDeleted:{},items:{}},
    lists:{bank:{id:'bank',items:entries.map(e=>e.id)}},scope:{mode:'lists',lists:['bank']},
    isLearned(){return false;},dueIds(){return [];}};
  store.answer=(entry,target,patch={})=>{
    const sequence=++serial;
    const event={id:`i:${sequence}`,epochId:store.learning.epoch.id,deviceId:'integration',sequence,
      sessionId:'evidence',index:sequence,at:NOW+sequence,objectiveId:target.id,targetId:target.id,
      entryId:entry.id,kind:entry.kind,skill:target.skill,tense:target.tense,person:target.person,
      policy:'journey-v1',contentVersion:lessonPlan(entry).version,chapterId:target.chapterId,
      mode:'production',activityKind:'independent',variantId:`v${sequence}`,contextId:`c${sequence}`,
      ok:false,outcome:'incorrect',firstAttempt:true,assistance:[],errorTags:['uncertain'],components:[],xp:0,...patch};
    store.learning=recordAttempt(store.learning,event).learning;
  };
  store.save=session=>{store.learning.sessions[learningSessionKey(session)]=session;};
  store.complete=(entry,caseId)=>{store.learning=setCompletionRecord(store.learning,{entryId:entry.id,caseId,checked:true,at:NOW,id:`completion:${entry.id}:${caseId}`});};
  return store;
}
const target=(entry,predicate)=>lessonObjectives(entry).find(predicate);
test('unfinished lesson resumes before a due review; voluntary review remains separate',()=>{
  const e=verb('credere'),w=word('casa'),s=fixture();
  s.answer(w,target(w,t=>t.skill==='recall'));
  s.complete(w,'word');
  const session=createJourneySession({id:'paused',plan:lessonPlan(e),now:NOW+2});
  session.ui={paused:true,draft:'cre'};s.save(session);
  assert.equal(recommendLesson(s,{now:NOW+DAY}).session.id,'paused');
  assert.equal(recommendLesson(s,{now:NOW+DAY,review:true}).entry.id,w.id);
});
test('recommendations stay within the selected scope',()=>{
  const e=verb('dire'),s=fixture([word('casa')]);
  s.save(createJourneySession({id:'outside',plan:lessonPlan(e),now:NOW}));
  s.answer(e,target(e,t=>t.skill==='conjugation'));
  assert.equal(recommendLesson(s,{now:NOW+DAY}).entry.id,word('casa').id);
  assert.equal(dueSkills(s,NOW+DAY).length,0);
});
test('review links preserve target and review mode',()=>{
  const e=verb('credere'),s=fixture([e]),t=target(e,t=>t.skill==='conjugation');s.answer(e,t);
  s.complete(e,'present');
  const next=recommendLesson(s,{now:NOW+DAY});assert.equal(next.mode,'review');assert.equal(next.objectiveId,t.id);
  const href=practiceHref(next.entry,next.objectiveId,next.mode);
  assert.equal(new URLSearchParams(href.split('?')[1]).get('objective'),t.id);
  assert.equal(new URLSearchParams(href.split('?')[1]).get('mode'),'review');
});
test('helper facts and supplied construction parts never become independent due targets',()=>{
  const e=verb('piovere'),s=fixture([e]);
  const support=lessonObjectives(e).filter(t=>t.supplementalOnly||t.guidedOnly);assert(support.length);
  support.forEach(t=>s.answer(e,t,{mode:'recognition',activityKind:'guided'}));
  assert.equal(eligibleSkills(s,NOW+DAY).length,0);
});
test('optional expansion review follows enrollment without losing its events',()=>{
  const e=verb('credere'),s=fixture([e]),t=target(e,t=>t.tense==='imperativo');assert(t);
  const targets=lessonObjectives(e).filter(o=>o.chapterId==='imperativo'&&o.available!==false&&o.required!==false&&!o.supplementalOnly);
  for(let round=0;round<2;round++)for(const o of targets)s.answer(e,o,{ok:true,outcome:'correct',errorTags:[]});
  s.answer(e,t);const eventCount=Object.keys(s.learning.events).length;assert.equal(dueSkills(s,NOW+DAY).length,0);
  s.learning.preferences.expansions=['requests'];assert.equal(dueSkills(s,NOW+DAY)[0].objectiveId,t.id);
  s.learning.preferences.expansions=[];assert.equal(dueSkills(s,NOW+DAY).length,0);
  assert.equal(Object.keys(s.learning.events).length,eventCount);
});
test('a completed imperfetto remains reviewable independently of beginner stage',()=>{
  const e=verb('credere'),s=fixture([e]),t=target(e,t=>t.chapterId==='background');s.answer(e,t);
  s.complete(e,'background');
  assert.equal(s.learning.preferences.stage,'present');
  assert.equal(dueSkills(s,NOW+DAY)[0].objectiveId,t.id);
});
test('explicit defer survives other reviews and suppresses automatic re-insertion',()=>{
  const e=verb('credere'),s=fixture([e]),t=target(e,t=>t.chapterId==='present'&&t.person===0);
  s.complete(e,'present');
  s.answer(e,t);let session=createJourneySession({id:'skip',plan:lessonPlan(e),now:NOW+10,chapterId:'present'});
  session=skipJourneyTarget(lessonPlan(e),session,t.id,{now:NOW+20,learning:s.learning});s.save(session);
  s.save(createJourneySession({id:'different-review',plan:lessonPlan(e),mode:'review',targetId:target(e,t=>t.person===1).id,now:NOW+30}));
  assert(!eligibleSkills(s,NOW+DAY).some(x=>x.objectiveId===t.id));
  session=chooseJourneyChapter(lessonPlan(e),session,'present',{now:NOW+40,learning:s.learning});s.save(session);
  assert(eligibleSkills(s,NOW+DAY).some(x=>x.objectiveId===t.id));
});
test('new attempts after an explicit return supersede an older deferred timestamp',()=>{
  const e=verb('credere'),s=fixture([e]),t=target(e,t=>t.person===0);s.answer(e,t);
  s.complete(e,'present');
  const session=createJourneySession({id:'old-skip',plan:lessonPlan(e),now:NOW});session.deferred[t.id]=NOW+20;s.save(session);
  s.answer(e,t,{at:NOW+30});assert(eligibleSkills(s,NOW+DAY).some(x=>x.objectiveId===t.id));
});
test('migration keeps old imperfetto objectives after the common-tense reorder',()=>{
  const e=verb('credere'),s=fixture([e]);
  s.learning=normalizeLearning({...s.learning,version:1,preferences:{stage:'future',expansions:[]}},NOW);
  assert(activeObjectives(e,s.learning).some(t=>t.tense==='imperfetto'));
});
test('unvisited optional targets do not force review after explicit core deferrals',()=>{
  const e=verb('credere'),w=word('casa'),s=fixture([e,w]);
  const session=createJourneySession({id:'covered',plan:lessonPlan(e),now:NOW});session.journey.phase='complete';
  for(const t of lessonObjectives(e).filter(t=>!t.optional)) {session.deferred[t.id]=NOW;session.journey.skipped[t.id]=NOW;}
  s.save(session);assert.equal(recommendLesson(s,{now:NOW+DAY}).entry.id,w.id);
});

test('a completed run recommends another supported core case, never an empty Meet or mixed recap',()=>{
 const e=verb('credere'),s=fixture([e]),session=createJourneySession({id:'case-done',plan:lessonPlan(e),now:NOW,chapterId:'future',caseMode:true});
 session.journey.phase='complete';s.save(session);
 const recommendation=recommendLesson(s,{now:NOW});assert.equal(recommendation.mode,'lesson');assert.equal(recommendation.chapterId,'present');assert.equal(recommendation.objectiveId,undefined);
});
test('promoted conditional evidence remains reviewable without optional expansion enrollment',()=>{
 const e=verb('credere'),s=fixture([e]),t=target(e,t=>t.chapterId==='condizionale'&&t.skill==='conjugation');
 s.complete(e,'condizionale');
 assert.equal(t.optional,false);s.answer(e,t);assert.equal(dueSkills(s,NOW+DAY)[0].objectiveId,t.id);
 s.learning.preferences.expansions=[];assert.equal(dueSkills(s,NOW+DAY)[0].objectiveId,t.id);
});

console.log(`\n${passed} taught-lesson integration checks passed.`);
