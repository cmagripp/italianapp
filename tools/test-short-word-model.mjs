#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {data} from '../js/data.js';
import {buildLesson as buildLessonMetadata} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createLearning,recordAttempt,skillState,normalizeLearning,mergeLearning} from '../js/learning/model.js';
import {createJourneySession,currentJourneyStep,advanceJourney,journeyAttempt,recordJourneyAttempt,journeyPairAttempt,recordJourneyPairAttempt,journeyProgress,journeyWordCompletion,skipJourneyTarget,retryJourneyPending,upgradeShortWordSession,chooseJourneyChapter} from '../js/learning/journey.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
import {gradePairActivity} from '../js/learning/lesson-activities.js';
const buildLesson=(entry,options={})=>buildLessonMetadata(entry,{...options,questionBuilder:buildJourneyQuestion});
const vocab=JSON.parse(fs.readFileSync(new URL('../data/vocab.json',import.meta.url)));data.vocab=vocab;
const START=1700000000000,copy=x=>JSON.parse(JSON.stringify(x));let passed=0;
function test(name,fn){try{fn();console.log(`✓ ${name}`);passed++;}catch(e){console.error(`✗ ${name}`);throw e;}}
function harness(entry,options={}){
 const plan=buildLesson(entry);let session=createJourneySession({id:'short-word',plan,now:START,...options}),learning=createLearning(START),n=0;
 const stamp=e=>Object.assign(e,{epochId:learning.epoch.id,deviceId:'word-test',sequence:++n,at:START+n});
 const h={entry,plan,questions:[],get session(){return session;},set session(value){session=value;},get learning(){return learning;},set learning(value){learning=value;},step(){return currentJourneyStep(plan,session,learning,START+n);},next(){session=advanceJourney(plan,session,learning,{now:START+n});},question(){const s=h.step();return buildJourneyQuestion(entry,s.chapter,s.target,s);},
  // A board is matched row by row the way the view does it: every row, decoys
  // included, goes through journeyPairAttempt and the store before the aggregate.
  match(q,pair,given=pair.canonical,attempt=0){const grade=gradePairActivity(q,{targetId:pair.targetId,given});const event=stamp(journeyPairAttempt(plan,session,q,grade,{targetId:pair.targetId,attempt,now:START+n}));assert.ok(event);const r=recordAttempt(learning,event);learning=r.learning;session=recordJourneyPairAttempt(plan,session,event,r);return {event,grade,added:r.added};},
  answer({wrong=false,revealed=false}={}){const s=h.step(),q=h.question();assert.ok(q);assert.ok(['mc','pairs'].includes(q.type),q.type);h.questions.push(q);
   if(q.type==='pairs'&&!wrong&&!revealed)for(const pair of q.pairs)if(pair.decoy||!session.journey.pairMatches?.[session.journey.current.questionId]?.includes(pair.targetId))h.match(q,pair);
   const grade=gradeQuestion(q,wrong?'not the requested answer':q.answer[0],{revealed});const e=stamp(journeyAttempt(plan,session,q,grade,{now:START+n}));assert.ok(e);const r=recordAttempt(learning,e);learning=r.learning;session=recordJourneyAttempt(plan,session,e,r);return{q,e,r};
  },until(predicate,max=100){for(let i=0;i<max;i++){const s=h.step();if(predicate(s))return s;if(s.type==='question'&&!s.awaitingContinue)h.answer();else if(['teach','repair','recap'].includes(s.type)||s.awaitingContinue)h.next();else throw Error(`Unexpected ${s.type}`);}throw Error('word lesson did not finish');}};return h;
}
const word=(it,pos='noun')=>vocab.find(e=>e.it===it&&e.pos===pos);
const DEFINITE=['il','lo','la',"l'",'i','gli','le'];
const targetsOf=plan=>plan.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets));
const slotSkills=plan=>plan.wordLesson.slots.map(s=>targetsOf(plan).find(t=>t.id===s.targetId).skill+(s.format==='pairs'?'*':''));
const formsCard=plan=>plan.chapters.find(c=>c.id==='forms').groups[0].cards[0];
function checkBoard(board,entry,{own,decoys=2}){
 assert.equal(board.type,'pairs');assert.equal(board.pairs.length,own.length+decoys,'rows');
 const ownRows=board.pairs.filter(p=>!p.decoy),decoyRows=board.pairs.filter(p=>p.decoy);
 assert.deepEqual(ownRows.map(p=>[p.label,p.canonical,p.meta.skill]),own,'own rows: article → bare form');
 assert.equal(decoyRows.length,decoys);
 const otherGender=entry.g==='m'?'f':'m';
 for(const row of decoyRows){
  const decoy=vocab.find(e=>e.id===row.question.meta.entryId);assert.ok(decoy,'a decoy is a real dictionary noun');assert.equal(decoy.pos,'noun');assert.equal(decoy.level,entry.level,'same level');assert.equal(decoy.g,otherGender,'other gender');
  assert.ok(DEFINITE.includes(row.label));assert.ok([decoy.it,decoy.pl].includes(row.canonical));assert.equal(row.question.meta.decoy,true);
 }
 const labels=board.pairs.map(p=>p.label);assert.equal(new Set(labels).size,labels.length,'unique articles');
 assert.equal(new Set(decoyRows.map(p=>p.canonical).concat(ownRows[0].canonical)).size,decoyRows.length+1,'decoy forms differ from the noun and each other');
 assert.equal(board.rightTiles.length,board.pairs.length);assert.ok(board.prompt.includes('Match each article to its noun'));
 assert.deepEqual([...new Set(board.pairs.map(p=>p.meta.mode))],['recognition']);
}
function pairEvents(h){return Object.values(h.learning.events).filter(e=>e.id.includes(':pair:'));}

test('a new noun lesson teaches meaning and forms then six supported screens with a real article board',()=>{
 const h=harness(word('casa'));assert.equal(h.step().card.id,'meaning');h.next();assert.equal(h.step().card.id,'forms');h.next();
 h.until(s=>s.type==='recap');assert.equal(h.questions.length,6);assert.equal(h.questions.filter(q=>q.type==='pairs').length,1);assert.equal(h.questions.find(q=>q.type==='pairs').pairs.length,4);
 const progress=journeyProgress(h.plan,h.session,h.learning);assert.equal(progress.complete,true);assert.equal(progress.answered,6);assert.equal(progress.independentMastery,false);
 const events=Object.values(h.learning.events);assert.ok(events.every(e=>e.mode==='recognition'));assert.ok(events.every(e=>!skillState(h.learning,e.objectiveId).ready));
 assert.equal(events.filter(e=>e.wordPolicy==='word-short-v1').length,6);assert.ok(events.filter(e=>e.id.includes(':pair:')).every(e=>e.xp===0));
 h.next();assert.equal(h.step().type,'complete');
});
test('casa: meaning, recall, article, plural with its article, article board with two masculine decoys, recall',()=>{
 const h=harness(word('casa')),e=h.entry;assert.deepEqual(slotSkills(h.plan),['meaning','recall','article','plural','article*','recall']);
 h.until(s=>s.type==='recap');const [meaning,recall,article,plural,board,recall2]=h.questions;
 assert.equal(meaning.meta.skill,'meaning');assert.equal(recall.meta.skill,'recall');assert.deepEqual(recall.answer,['casa']);assert.equal(recall2.meta.skill,'recall');
 assert.deepEqual(article.answer,['la']);assert.ok(article.prompt.includes('Singular'));assert.ok(article.choices.every(c=>DEFINITE.includes(c.label)),'article choices are definite articles');
 assert.deepEqual(plural.answer,['le case'],'the plural answer carries its article');assert.ok(plural.prompt.includes('la casa'));
 assert.ok(!plural.choices.some(c=>c.label==='case'),'never the bare plural');
 assert.ok(plural.choices.filter(c=>!c.correct).every(c=>/^(?:il|lo|la|i|gli|le) cas[ae]$/.test(c.label)),JSON.stringify(plural.choices));
 checkBoard(board,e,{own:[['la','casa','article'],['le','case','plural']]});
 assert.equal(gradePairActivity(board,{targetId:board.pairs[1].targetId,given:'casa'}).errorTags[0],'plural');
 assert.equal(gradePairActivity(board,{targetId:board.pairs[0].targetId,given:'case'}).errorTags[0],'article');
 const targets=targetsOf(h.plan),articleTarget=targets.find(t=>t.skill==='article'),pluralTarget=targets.find(t=>t.skill==='plural');
 assert.deepEqual(pairEvents(h).map(x=>[x.objectiveId,x.skill]).sort(),[[articleTarget.id,'article'],[pluralTarget.id,'plural']].sort(),'own rows record article and plural evidence; decoys record nothing');
 assert.deepEqual(Object.values(h.learning.events).filter(x=>x.wordPolicy==='word-short-v1').map(x=>x.wordSlotId),h.plan.wordLesson.slots.map(s=>s.id));
 assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);
 assert.ok(!JSON.stringify(formsCard(h.plan).notes).includes('article is'),'a regular la/le noun names no special article rule');
});
test('caffè: the invariable plural answers i caffè and the board pairs il and i with the same form',()=>{
 const h=harness(word('caffè')),e=h.entry;assert.deepEqual(slotSkills(h.plan),['meaning','recall','article','plural','article*','recall']);
 h.until(s=>s.type==='recap');const plural=h.questions[3],board=h.questions[4];
 assert.deepEqual(h.questions[2].answer,['il']);assert.deepEqual(plural.answer,['i caffè']);assert.ok(plural.explanation.includes('article shows the plural'));
 checkBoard(board,e,{own:[['il','caffè','article'],['i','caffè','plural']]});
 assert.equal(board.rightTiles.filter(t=>t.text==='caffè').length,2);
 for(const row of board.pairs.filter(p=>!p.decoy))assert.equal(gradePairActivity(board,{targetId:row.targetId,given:'caffè'}).ok,true);
 assert.equal(gradePairActivity(board,{targetId:board.pairs[0].targetId,given:board.pairs[2].canonical}).ok,false);
 assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);assert.ok(JSON.stringify(formsCard(h.plan).forms).includes('i caffè'));
});
test('occhiali: plural-only nouns ask the plural article, then meaning, recall and a three-row board',()=>{
 const h=harness(word('occhiali')),e=h.entry;assert.deepEqual(slotSkills(h.plan),['article','meaning','recall','article*','meaning','recall']);
 h.until(s=>s.type==='recap');assert.deepEqual(h.questions[0].answer,['gli']);assert.ok(h.questions[0].prompt.includes('Plural'));
 checkBoard(h.questions[3],e,{own:[['gli','occhiali','article']]});
 assert.ok(!h.questions.some(q=>q.meta.skill==='plural'));assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);
 assert.ok(JSON.stringify(formsCard(h.plan).notes).includes('normally used in the plural'));
});
test('calcio: singular-use nouns get a number screen instead of a plural, and no board',()=>{
 for(const it of ['calcio','latte']){
  const h=harness(word(it));assert.deepEqual(slotSkills(h.plan),['meaning','recall','article','number','recall','meaning'],it);
  h.until(s=>s.type==='recap');const number=h.questions[3];
  assert.equal(number.type,'mc');assert.equal(number.meta.skill,'number');assert.equal(number.meta.answerLanguage,'en');
  assert.deepEqual(number.answer,[`Normally singular: il ${it}`]);assert.ok(number.prompt.includes('Which is right for this noun?'));
  assert.ok(number.choices.some(c=>!c.correct&&/^Normally plural: i /.test(c.label)),'a plural statement with an invented plural is a wrong option');
  assert.ok(!number.choices.some(c=>c.label==='-'));assert.ok(!h.questions.some(q=>q.meta.skill==='plural'||q.type==='pairs'));
  assert.ok(number.lesson.includes('Normally singular in this meaning'));if(it==='calcio')assert.ok(number.lesson.includes('kicks'));
  assert.equal(gradeQuestion(number,number.choices.find(c=>!c.correct).label).errorTags[0],'number');
  assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);
 }
 const pane=harness(word('pane'));assert.deepEqual(slotSkills(pane.plan),['meaning','recall','article','number','recall','meaning'],'a usually-singular note counts as singular use');
 pane.until(s=>s.type==='recap');assert.ok(pane.questions[3].choices.some(c=>c.label==='Normally plural: i pani'),'a recorded plural is used rather than an invented one');
});
test('albero and zaino: l’ and lo nouns keep their articles through the choice, the plural and the board, and the card names the rule',()=>{
 for(const [it,sg,pl,rule] of [['albero',"l'",'gli',/Before a vowel sound the singular article is l': l'albero\. The plural takes gli: gli alberi\./],['zaino','lo','gli',/the masculine article is lo: lo zaino\. The plural takes gli: gli zaini\./]]){
  const h=harness(word(it)),e=h.entry;assert.deepEqual(slotSkills(h.plan),['meaning','recall','article','plural','article*','recall']);
  assert.match(formsCard(h.plan).notes.join(' '),rule);assert.deepEqual(formsCard(h.plan).forms.map(f=>f.form),[`${sg==="l'"?sg:sg+' '}${e.it}`,`${pl} ${e.pl}`]);
  h.until(s=>s.type==='recap');
  assert.deepEqual(h.questions[2].answer,[sg]);assert.deepEqual(h.questions[3].answer,[`${pl} ${e.pl}`]);
  checkBoard(h.questions[4],e,{own:[[sg,e.it,'article'],[pl,e.pl,'plural']]});
  assert.ok(h.questions[4].pairs.filter(p=>p.decoy).every(p=>['la','le'].includes(p.label)),'feminine decoys use la and le');
  assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);
 }
 assert.match(formsCard(buildLesson(word('uovo'))).notes.join(' '),/feminine plural with le: le uova/);
});
test('non-nouns keep the six-screen path without article, plural or number screens',()=>{
 const adj=harness(word('rosso','adj'));assert.deepEqual(slotSkills(adj.plan),['meaning','recall','agreement*','agreement','meaning','recall']);
 const adv=harness(word('sempre','adv'));assert.deepEqual(slotSkills(adv.plan),['meaning','recall','meaning','recall','meaning','recall']);
 for(const h of [adj,adv]){h.until(s=>s.type==='complete');assert.equal(h.questions.length,6);assert.ok(h.questions.every(q=>!['article','plural','number'].includes(q.meta.skill)));assert.ok(h.questions.every(q=>!q.pairs?.some(p=>p.decoy)));assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);}
});
test('a noun is not credited until every slot, including the board and the plural, has been answered',()=>{
 const h=harness(word('casa'));
 for(let i=0;i<6;i++){h.until(s=>s.type==='question'&&!s.awaitingContinue);assert.equal(journeyWordCompletion(h.plan,h.learning).complete,false,`before slot ${i}`);h.answer();h.next();}
 assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);
});
test('decoy rows pass through the board without evidence; a wrong own row records an article error',()=>{
 const h=harness(word('casa'));h.until(s=>s.type==='question'&&s.format==='pairs');const q=h.question();
 const decoy=q.pairs.find(p=>p.decoy),own=q.pairs.find(p=>!p.decoy),before=Object.keys(h.learning.events).length,saved=copy(h.session);
 const miss=h.match(q,decoy,own.canonical);assert.equal(miss.event.decoy,true);assert.equal(miss.added,false);assert.equal(miss.event.ok,false);
 const hit=h.match(q,decoy,decoy.canonical,1);assert.equal(hit.added,false);assert.equal(Object.keys(h.learning.events).length,before);assert.deepEqual(h.session,saved,'decoy matches change no session state');
 const wrong=h.match(q,own,decoy.canonical);assert.equal(wrong.added,true);assert.equal(wrong.event.ok,false);assert.equal(wrong.event.objectiveId,own.targetId);assert.ok(wrong.event.errorTags.includes(own.meta.skill==='plural'?'plural':'article'));assert.equal(wrong.event.xp,0);
 assert.equal(journeyAttempt(h.plan,h.session,q,gradeQuestion(q,q.answer[0])),null,'the board is not complete before its own rows');
 for(const pair of q.pairs.filter(p=>!p.decoy))h.match(q,pair,pair.canonical,pair===own?1:0);
 assert.ok(journeyAttempt(h.plan,h.session,q,gradeQuestion(q,q.answer[0])),'decoy rows are not required for the aggregate');
 h.answer();h.until(s=>s.type==='complete');assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);
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
 for(const e of [word('caffè'),{id:'custom:test',kind:'word',it:'testword',en:'a test item',pos:'noun'},{id:'custom:expression',kind:'word',it:'per esempio',en:'for example',pos:'expr'},{id:'custom:gendered',kind:'word',it:'quaderno di prova',en:'test notebook',pos:'noun',g:'m',level:'A1'}]){
  const h=harness(e);h.until(s=>s.type==='complete');assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);assert.ok(h.questions.length<=8);assert.ok(h.questions.every(q=>q.answer.every(x=>x&&!/^[-—]$/.test(x))));
  if(e.id==='custom:gendered'){assert.deepEqual(slotSkills(h.plan),['meaning','recall','article','article*','recall','meaning']);const board=h.questions.find(q=>q.type==='pairs');assert.equal(board.pairs.filter(p=>!p.decoy).length,1);assert.equal(board.pairs.filter(p=>p.decoy).length,2);assert.ok(!h.questions.some(q=>q.meta.skill==='plural'));}
 }
});
test('wrong answers and reveals do not complete slots; support repairs the current meaning without a typing loop',()=>{
 for(const revealed of [false,true]){const h=harness(word('casa'));h.until(s=>s.type==='question');const id=h.session.journey.wordShort.slotId;h.answer({wrong:!revealed,revealed});
  assert.equal(h.session.journey.wordShort.completed[id],undefined);h.next();assert.equal(h.step().type,'repair');h.next();assert.equal(h.step().phase,'repair');assert.equal(h.session.journey.wordShort.slotId,id);
  h.answer();h.next();h.until(s=>s.type==='complete');assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);assert.ok(h.questions.length<10);
 }
});
test('a wrong plural choice repairs the plural with its article before the board',()=>{
 const h=harness(word('casa'));h.until(s=>s.type==='question'&&s.target.skill==='plural');const {e}=h.answer({wrong:true});assert.equal(e.skill,'plural');assert.equal(e.ok,false);
 h.next();assert.equal(h.step().type,'repair');h.next();const repair=h.question();assert.deepEqual(repair.answer,['le case']);assert.equal(h.step().phase,'repair');
 h.answer();h.next();h.until(s=>s.type==='complete');assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);assert.equal(journeyWordCompletion(h.plan,h.learning).complete,true);
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
 assert.deepEqual(h.questions.map(q=>q.type==='pairs'?'board':q.meta.skill),['meaning','recall','article','plural','board','recall'],'review replays the noun order');
 assert.deepEqual(h.questions[3].answer,['le case']);assert.equal(h.questions[4].pairs.length,4);
 for(const it of ['calcio','occhiali']){const r=harness(word(it),{mode:'review',targetId:buildLesson(word(it)).wordLesson.slots[0].targetId});r.until(s=>s.type==='complete');assert.deepEqual(r.questions.map(q=>q.type==='pairs'?'board':q.meta.skill),it==='calcio'?['meaning','recall','article','number','recall','meaning']:['article','meaning','recall','board','meaning','recall']);}
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

test('retry and continued teaching recover missing or borrowed completion references without losing evidence',()=>{
 const h=harness(word('casa'));h.until(s=>s.type==='complete');
 const events=copy(h.learning.events),slots=h.plan.wordLesson.slots,saved=copy(h.session);
 saved.journey.wordShort.completed[slots[0].id]='missing-event';
 saved.journey.wordShort.completed[slots[1].id]=saved.journey.wordShort.completed[slots[2].id];
 const before=JSON.stringify(saved);
 assert.equal(journeyProgress(h.plan,saved,h.learning).pending.length,2);
 const selected=chooseJourneyChapter(h.plan,saved,'forms',{learning:h.learning});
 const continued=advanceJourney(h.plan,selected,h.learning);
 assert.equal(currentJourneyStep(h.plan,continued,h.learning).type,'question');
 assert.equal(continued.journey.wordShort.slotId,slots[0].id);
 const retry=retryJourneyPending(h.plan,saved,h.learning);
 assert.equal(currentJourneyStep(h.plan,retry,h.learning).type,'question');
 assert.equal(retry.journey.wordShort.completed[slots[0].id],undefined);assert.equal(retry.journey.wordShort.completed[slots[1].id],undefined);
 for(const slot of slots.slice(2))assert.equal(retry.journey.wordShort.completed[slot.id],saved.journey.wordShort.completed[slot.id]);
 assert.equal(JSON.stringify(saved),before);assert.deepEqual(h.learning.events,events);
 h.session=retry;const count=h.questions.length;h.until(s=>s.type==='complete');
 assert.equal(h.questions.length-count,2);assert.equal(journeyProgress(h.plan,h.session,h.learning).complete,true);
 for(const [id,event] of Object.entries(events))assert.deepEqual(h.learning.events[id],event);
});

console.log(`\n${passed} short word controller checks passed.`);
