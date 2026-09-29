#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {data} from '../js/data.js';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createLearning,recordAttempt,skillState,normalizeLearning,mergeLearning} from '../js/learning/model.js';
import {createJourneySession,currentJourneyStep,advanceJourney,journeyAttempt,recordJourneyAttempt,journeyPairAttempt,recordJourneyPairAttempt,journeyProgress,skipJourneyTarget,retryJourneyPending,upgradeShortWordSession,chooseJourneyChapter} from '../js/learning/journey.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
import {gradePairActivity} from '../js/learning/lesson-activities.js';
const vocab=JSON.parse(fs.readFileSync(new URL('../data/vocab.json',import.meta.url)));data.vocab=vocab;
const START=1700000000000,copy=x=>JSON.parse(JSON.stringify(x));let passed=0;
function test(name,fn){try{fn();console.log(`✓ ${name}`);passed++;}catch(e){console.error(`✗ ${name}`);throw e;}}
function harness(entry,options={}){
 const plan=buildLesson(entry);let session=createJourneySession({id:'short-word',plan,now:START,...options}),learning=createLearning(START),n=0;
 const stamp=e=>Object.assign(e,{epochId:learning.epoch.id,deviceId:'word-test',sequence:++n,at:START+n});
 const h={entry,plan,questions:[],get session(){return session;},set session(value){session=value;},get learning(){return learning;},set learning(value){learning=value;},step(){return currentJourneyStep(plan,session,learning,START+n);},next(){session=advanceJourney(plan,session,learning,{now:START+n});},question(){const s=h.step();return buildJourneyQuestion(entry,s.chapter,s.target,s);},
  answer({wrong=false,revealed=false}={}){const s=h.step(),q=h.question();assert.ok(q);assert.ok(['mc','pairs'].includes(q.type),q.type);h.questions.push(q);
   if(q.type==='pairs'&&!wrong&&!revealed)for(const pair of q.pairs){const grade=gradePairActivity(q,{targetId:pair.targetId,given:pair.canonical});const event=stamp(journeyPairAttempt(plan,session,q,grade,{targetId:pair.targetId,attempt:0,now:START+n}));const r=recordAttempt(learning,event);learning=r.learning;session=recordJourneyPairAttempt(plan,session,event,r);}
   const grade=gradeQuestion(q,wrong?'not the requested answer':q.answer[0],{revealed});const e=stamp(journeyAttempt(plan,session,q,grade,{now:START+n}));assert.ok(e);const r=recordAttempt(learning,e);learning=r.learning;session=recordJourneyAttempt(plan,session,e,r);return{q,e,r};
  },until(predicate,max=100){for(let i=0;i<max;i++){const s=h.step();if(predicate(s))return s;if(s.type==='question'&&!s.awaitingContinue)h.answer();else if(['teach','repair','recap'].includes(s.type)||s.awaitingContinue)h.next();else throw Error(`Unexpected ${s.type}`);}throw Error('word lesson did not finish');}};return h;
}
const word=(it,pos='noun')=>vocab.find(e=>e.it===it&&e.pos===pos);
test('a new noun lesson teaches meaning and forms then six supported screens with real matching',()=>{
 const h=harness(word('casa'));assert.equal(h.step().card.id,'meaning');h.next();assert.equal(h.step().card.id,'forms');h.next();
 h.until(s=>s.type==='recap');assert.equal(h.questions.length,6);assert.equal(h.questions.filter(q=>q.type==='pairs').length,1);assert.equal(h.questions.find(q=>q.type==='pairs').pairs.length,2);
 const progress=journeyProgress(h.plan,h.session,h.learning);assert.equal(progress.complete,true);assert.equal(progress.answered,6);assert.equal(progress.independentMastery,false);
 const events=Object.values(h.learning.events);assert.ok(events.every(e=>e.mode==='recognition'));assert.ok(events.every(e=>!skillState(h.learning,e.objectiveId).ready));
 assert.equal(events.filter(e=>e.wordPolicy==='word-short-v1').length,6);assert.ok(events.filter(e=>e.id.includes(':pair:')).every(e=>e.xp===0));
 h.next();assert.equal(h.step().type,'complete');
});
test('adjective matching covers agreement without exceeding eight actual correct answers',()=>{
 const e=vocab.find(e=>e.pos==='adj'&&e.forms?.length===4&&new Set(e.forms).size===4),h=harness(e);h.until(s=>s.type==='recap');
 assert.equal(h.questions.length,6);const board=h.questions.find(q=>q.type==='pairs');assert.equal(board.pairs.length,3);assert.equal(h.questions.length-1+board.pairs.length,8);
 assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);
});
test('every word type finishes with choices and no obligatory sentence or phrase writing',()=>{
 for(const pos of ['noun','adj','adv','prep','conj','pron','det','num','interj','expr']){
  const e=vocab.find(e=>e.pos===pos),h=harness(e);h.until(s=>s.type==='complete');assert.ok(h.questions.length>=6&&h.questions.length<=8,pos);
  assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true,pos);assert.ok(h.questions.every(q=>['mc','pairs'].includes(q.type)));assert.ok(h.questions.every(q=>!['context','listening'].includes(q.meta.skill)));
 }
});
test('invariant nouns and sparse custom words remain bounded without invented forms',()=>{
 for(const e of [word('caffè'),{id:'custom:test',kind:'word',it:'testword',en:'a test item',pos:'noun'},{id:'custom:expression',kind:'word',it:'per esempio',en:'for example',pos:'expr'}]){
  const h=harness(e);h.until(s=>s.type==='complete');assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);assert.ok(h.questions.length<=8);assert.ok(h.questions.every(q=>q.answer.every(x=>x&&!/^[-—]$/.test(x))));
 }
});
test('wrong answers and reveals do not complete slots; support repairs the current meaning without a typing loop',()=>{
 for(const revealed of [false,true]){const h=harness(word('casa'));h.until(s=>s.type==='question');const id=h.session.journey.wordShort.slotId;h.answer({wrong:!revealed,revealed});
  assert.equal(h.session.journey.wordShort.completed[id],undefined);h.next();assert.equal(h.step().type,'repair');h.next();assert.equal(h.step().phase,'repair');assert.equal(h.session.journey.wordShort.slotId,id);
  h.answer();h.next();h.until(s=>s.type==='complete');assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);assert.ok(h.questions.length<10);
 }
});
test('skipping a slot stays pending at the final recap until an explicit retry',()=>{
 const h=harness(word('casa'));h.until(s=>s.type==='question');const id=h.session.journey.wordShort.slotId;
 h.session=skipJourneyTarget(h.plan,h.session,null,{learning:h.learning,now:START+10});h.until(s=>s.type==='recap');
 let p=journeyProgress(h.plan,h.session,h.learning);assert.equal(p.complete,false);assert.equal(p.pending.length,1);assert.equal(p.pending[0].id,id);
 h.session=retryJourneyPending(h.plan,h.session,h.learning);h.answer();h.next();assert.equal(h.step().type,'recap');assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);
});
test('word reviews use the same short supported path, including old sentence targets',()=>{
 const e=word('casa'),p=buildLesson(e),old=p.chapters.find(c=>c.id==='use').groups[0].targets[0];
 const h=harness(e,{mode:'review',targetId:old.id});h.until(s=>s.type==='complete');assert.equal(h.questions.length,6);assert.ok(h.questions.every(q=>q.meta.mode==='recognition'&&q.meta.skill!=='context'));
});
test('upgrading a saved long word lesson preserves event history, serial identity and typed history',()=>{
 const h=harness(word('casa'));h.until(s=>s.type==='question');h.answer();const before=copy(h.learning.events);
 const old=copy(h.session);delete old.journey.wordShort;old.ui={version:2,draft:'a phrase',history:[{type:'question',given:'a phrase'}]};old.journey.serial=30;old.journey.skipped['saved-skip']=START;old.deferred['saved-skip']=START;
 const upgraded=upgradeShortWordSession(h.plan,old,{now:START+100});assert.equal(upgraded.id,old.id);assert.equal(upgraded.index,old.index);assert.equal(upgraded.journey.serial,30);assert.deepEqual(upgraded.ui.history,old.ui.history);assert.ok(upgraded.journey.legacyWordCursor);assert.equal(upgraded.journey.legacyWordCursor.skipped['saved-skip'],START);assert.equal(upgraded.journey.legacyWordCursor.deferred['saved-skip'],START);
 assert.deepEqual(h.learning.events,before);h.session=upgraded;h.until(s=>s.type==='complete');assert.ok(h.session.journey.serial>30);assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);
});
test('short slot evidence survives backup/merge and cannot be completed by a forged cursor alone',()=>{
 const h=harness(word('casa'));h.until(s=>s.type==='recap');h.learning.session=h.session;
 const restored=normalizeLearning(copy(h.learning));assert.equal(journeyProgress(h.plan,restored.session,restored).complete,true);
 const merged=mergeLearning(restored,restored);assert.equal(Object.keys(merged.events).length,Object.keys(restored.events).length);assert.equal(journeyProgress(h.plan,merged.session,merged).complete,true);
 assert.equal(journeyProgress(h.plan,h.session,createLearning()).complete,false);
});
test('explicit form-card selection remains supported and cannot return to the old independent loop',()=>{
 const h=harness(word('casa'));h.session=chooseJourneyChapter(h.plan,h.session,'forms');assert.equal(h.step().card.id,'forms');h.until(s=>s.type==='complete');assert.ok(h.questions.every(q=>q.meta.mode==='recognition'));
});

test('the short-word policy cannot accidentally be imported as unaided production evidence',()=>{
 const h=harness(word('casa'));h.until(s=>s.type==='question');const {e}=h.answer();
 const raw={...e,id:'unexpected-production',mode:'production',activityKind:'independent',assistance:[]};
 const result=recordAttempt(h.learning,raw);assert.equal(result.learning.events[raw.id].mode,'recognition');assert.equal(result.learning.events[raw.id].activityKind,'guided');assert.equal(result.skill.independentCorrect,0);assert.equal(result.skill.ready,false);
});

test('malformed imported short-word cursors preserve their payload and render incomplete progress safely',()=>{
 const h=harness(word('casa'));h.until(s=>s.type==='complete');
 for(const corrupt of [j=>j.wordShort.completed=null,j=>j.wordShort.skipped=null,j=>j.wordShort=null,j=>j.wordShort.version=2,j=>j.queue={}]){
  const saved=copy(h.session);corrupt(saved.journey);
  const learning=normalizeLearning({...copy(h.learning),session:saved});
  const restored=learning.session,before=JSON.stringify(restored);
  assert.equal(currentJourneyStep(h.plan,restored,learning).type,'unavailable');
  const progress=journeyProgress(h.plan,restored,learning);
  assert.equal(progress.wordShort,true);assert.equal(progress.unavailable,true);assert.equal(progress.complete,false);assert.equal(progress.covered,false);assert.equal(progress.answered,0);
  assert.equal(progress.pending.length,h.plan.wordLesson.slots.length);assert.ok(progress.chapters.every(chapter=>!chapter.complete));
  assert.equal(retryJourneyPending(h.plan,restored,learning),restored);assert.equal(JSON.stringify(restored),before);
 }
});

console.log(`\n${passed} short word controller checks passed.`);
