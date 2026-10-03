// Completion/enrollment is separate from graded answer evidence. Real store,
// catalog, reducer, lesson plans and recommendations; no network or browser data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {data} from '../js/data.js';
import {createLearning,normalizeLearning,mergeLearning,resetLearning,recordAttempt,skillState,completionRecord,setCompletionRecord,LEARNING_VERSION} from '../js/learning/model.js';
import {lessonPlan,lessonObjectives,eligibleSkills,reviewItems,reviewableTenses,recommendLesson} from '../js/learning/integration.js';
import {journeyCaseProgress,journeyChapterCompletions,createJourneySession,chooseJourneyChapter,currentJourneyStep,advanceJourney,journeyWordCompletion} from '../js/learning/journey.js';
class Storage { values=new Map();getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);} }
globalThis.localStorage=new Storage();globalThis.window=new EventTarget();globalThis.document=new EventTarget();
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,storage:{persist:async()=>true}}});
data.vocab=JSON.parse(fs.readFileSync(new URL('../data/vocab.json',import.meta.url))).map(e=>({...e,kind:'word'}));
data.verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))).map(e=>({...e,kind:'verb',it:e.inf}));
data.byId=new Map([...data.vocab,...data.verbs].map(e=>[e.id,e]));data.loaded=true;
const {store}=await import('../js/store.js');
const START=1700000000000,DAY=86400e3,copy=x=>JSON.parse(JSON.stringify(x));let now=START,seq=0,passed=0;
const originalNow=Date.now;Date.now=()=>now;
const verb=data.verbs.find(e=>e.inf==='credere'),word=data.vocab.find(e=>e.it==='casa'&&e.pos==='noun');
const test=async(name,fn)=>{await fn();passed++;console.log('✓',name);};
function scope(entries){store.current.scope={mode:'lists',lists:['bank']};store.current.lists.bank.items=entries.map(e=>e.id);}
function fresh(){store.current.learning=createLearning(now);store.current.items={};store.current.stats={xp:0,days:{},games:{}};delete store.current.rewards;scope([verb,word]);}
function evidence(target,patch={}){
  const n=++seq;
  const e={id:`proof:${n}`,epochId:store.learning.epoch.id,deviceId:'proof',sequence:n,sessionId:'proof',index:n,at:++now,
    policy:'journey-v1',contentVersion:1,entryId:verb.id,kind:'verb',objectiveId:target.id,targetId:target.id,
    chapterId:target.chapterId,skill:target.skill,tense:target.tense,person:target.person,role:target.role,
    mode:target.completionRequired?'recognition':'production',activityKind:target.completionRequired?'guided':'independent',variantId:`v${n}`,contextId:`c${n}`,
    firstAttempt:true,assistance:[],components:[],errorTags:[],ok:true,outcome:'correct',xp:0,...patch};
  store.current.learning=recordAttempt(store.learning,e).learning;return e;
}
function completeCase(chapterId,entry=verb){
 const targets=lessonObjectives(entry).filter(t=>t.chapterId===chapterId && t.available!==false && (t.required!==false||t.completionRequired) && !t.supplementalOnly);
 for(let round=0;round<2;round++)for(const t of targets){evidence(t,{entryId:entry.id,sessionId:`lesson:${chapterId}`});for(let i=0;i<2;i++)evidence({id:'spacing',skill:'meaning'},{entryId:entry.id,mode:'recognition',activityKind:'guided'});}
 return targets;
}
try {
 await store.init();
 await test('one checked case enrolls only that case without XP, answers, or whole-verb completion',()=>{
  fresh();const before=copy(store.current.stats);assert.equal(store.setCompletion(verb,{caseId:'past',checked:true}),true);
  const state=store.completionState(verb);assert.equal(state.complete,false);assert.deepEqual(state.cases.filter(c=>c.checked).map(c=>c.id),['past']);
  assert.equal(store.isLearned(verb.id),false);assert.deepEqual(store.learning.events,{});assert.deepEqual(store.current.stats,before);
  const queue=eligibleSkills(store,now);assert.ok(queue.length);assert.ok(queue.every(s=>s.tense==='passatoProssimo'&&!s.ready&&s.independentCorrect===0));
  assert.deepEqual(reviewableTenses(store,verb),['passatoProssimo']);assert.equal(reviewItems(store,now+DAY).length,queue.length);
 });
 await test('all and individual checkboxes are reversible; evidence, drafts, Starred and XP are unchanged',()=>{
  fresh();const target=lessonObjectives(verb).find(t=>t.chapterId==='future'&&t.person===0);evidence(target,{ok:false,outcome:'incorrect'});
  const session=createJourneySession({id:'saved',plan:lessonPlan(verb),chapterId:'future',now});session.ui={draft:'creder',paused:true};store.saveLearningSession(session);
  const starred=store.createList('Starred');store.addToList(starred,word.id);const events=copy(store.learning.events),saved=copy(store.learning.session),xp=store.current.stats.xp;
  store.setCompletion(verb,{checked:true});assert.equal(store.isLearned(verb.id),true);assert.ok(store.learnedIds().includes(verb.id));
  store.setCompletion(verb,{caseId:'background',checked:false});assert.equal(store.isLearned(verb.id),false);assert.equal(store.completionState(verb).completed,4);
  assert.ok(eligibleSkills(store,now+DAY).every(s=>s.tense!=='imperfetto'&&s.tense!=='imperfettoProgressivo'));
  store.setCompletion(verb,{checked:false});assert.equal(eligibleSkills(store,now+DAY).length,0);
  assert.deepEqual(store.learning.events,events);assert.deepEqual(store.learning.session,saved);assert.equal(store.current.stats.xp,xp);assert.deepEqual(store.lists[starred].items,[word.id]);
 });
 await test('natural partial case completion immediately enrolls that case, but unfinished mistakes do not',()=>{
  fresh();const present=completeCase('present');const past=lessonObjectives(verb).find(t=>t.chapterId==='past'&&t.person===0);evidence(past,{ok:false,outcome:'incorrect'});
  const p=journeyCaseProgress(lessonPlan(verb),store.learning);assert.equal(p.cases.find(c=>c.id==='present').ready,true);assert.equal(p.complete,false);
  const eligible=eligibleSkills(store,now);assert.ok(eligible.some(s=>s.objectiveId===present[0].id));assert.ok(eligible.every(s=>s.tense==='presente'));
 });
 await test('clearing demonstrated completion suppresses old proof; genuinely fresh lesson proof restores it',()=>{
  fresh();completeCase('present');const before=copy(store.learning.events);assert.equal(store.completionState(verb).cases[0].checked,true);
  store.setCompletion(verb,{caseId:'present',checked:false});assert.equal(store.completionState(verb).cases[0].checked,false);assert.equal(eligibleSkills(store,now+DAY).length,0);
  assert.deepEqual(store.learning.events,before);const t=lessonObjectives(verb).find(t=>t.chapterId==='present'&&t.person===0);assert.equal(skillState(store.learning,t.id).ready,true);
  let session=createJourneySession({id:'again',plan:lessonPlan(verb),chapterId:'present',now});session=chooseJourneyChapter(lessonPlan(verb),session,'present',{learning:store.learning,redo:true,now});
  assert.equal(currentJourneyStep(lessonPlan(verb),session,store.learning).type,'teach');
  completeCase('present');assert.equal(store.completionState(verb).cases[0].checked,true);assert.ok(eligibleSkills(store,now).length);assert.ok(Object.keys(store.learning.events).length>Object.keys(before).length);
 });
 await test('unavailable cases stay exempt; Mark all cannot assert unsupported forms',()=>{
  fresh();const e=data.verbs.find(e=>e.inf==='solere');store.setCompletion(e,{checked:true});const s=store.completionState(e);
  assert.ok(s.cases.some(c=>c.exempt));assert.ok(s.cases.filter(c=>c.exempt).every(c=>!c.checked));assert.equal(s.complete,true);
 });
 await test('word enrollment requires completion and remains distinct from unaided mastery',()=>{
  fresh();const t=lessonObjectives(word).find(t=>t.skill==='meaning');evidence(t,{entryId:word.id,kind:'word',mode:'recognition',activityKind:'guided',ok:false,outcome:'incorrect'});
  assert.equal(eligibleSkills(store,now+DAY).length,0);store.setCompletion(word,{checked:true});assert.equal(store.isLearned(word.id),true);assert.ok(eligibleSkills(store,now+DAY).length);
  assert.equal(skillState(store.learning,t.id).ready,false);store.setCompletion(word,{checked:false});store.markLearned(word.id,'word');assert.equal(store.isLearned(word.id),false);assert.equal(reviewItems(store,now+DAY).length,0);
 });
 await test('fresh supported short-word completion can supersede an uncheck without fake production credit',()=>{
  fresh();store.setCompletion(word,{checked:false});const plan=lessonPlan(word);
  for(const slot of plan.wordLesson.slots)evidence({id:slot.targetId,skill:'meaning'},{entryId:word.id,kind:'word',sessionId:'new-word',wordPolicy:'word-short-v1',wordSlotId:slot.id,mode:'recognition',activityKind:'guided'});
  assert.equal(store.completionState(word).complete,true);assert.ok(eligibleSkills(store,now).length);assert.ok(Object.values(store.learning.events).every(e=>!skillState(store.learning,e.objectiveId).ready));
 });
 // A course lesson's vocabulary boards: one row event per word skill, as the course engine emits them.
 const boardRows=()=>lessonObjectives(word).filter(t=>['meaning','recall','article','plural'].includes(t.skill));
 const boardRow=(target,sessionId,patch={})=>{const boardId=`v2-casa.words-check.${target.chapterId}.1`;
  return evidence(target,{entryId:word.id,kind:'word',sessionId,policy:'journey-v1',wordPolicy:'word-lesson-match-v1',wordSlotId:`${boardId}:${target.skill}`,courseLessonId:'v2-casa',
   chapterId:target.chapterId,mode:'recognition',activityKind:'guided',variantId:boardId,contextId:'v2-casa',assistance:['matching'],xp:0,countStats:false,...patch});};
 await test('matching every vocabulary board row in one course session completes the word as supported recognition',()=>{
  fresh();assert.deepEqual(boardRows().map(t=>t.skill),['meaning','recall','article','plural']);
  for(const t of boardRows().slice(0,3))boardRow(t,'course-v2:1');
  assert.equal(store.completionState(word).complete,false,'the plural row is still missing');
  boardRow(boardRows()[3],'course-v2:1');
  const state=journeyWordCompletion(lessonPlan(word),store.learning);assert.equal(state.complete,true);assert.equal(state.source,'course');assert.equal(state.completedAt,now);
  assert.equal(store.completionState(word).complete,true);assert.equal(store.completionState(word).source,'course');
  assert.ok(Object.values(store.learning.events).every(e=>e.mode==='recognition'&&e.activityKind==='guided'&&e.xp===0&&!skillState(store.learning,e.objectiveId).ready));
  // The learned flag and its single reward come from the credit step, gated on completionState (isLearned follows the flag until then).
  assert.equal(store.current.stats.xp,0);assert.equal(store.getItem(word.id),null);assert.equal(store.isLearned(word.id),false);
  store.markLearned(word.id,'word');assert.equal(store.getItem(word.id).learned,true);assert.equal(store.isLearned(word.id),true);assert.equal(store.current.stats.xp,10);assert.equal(store.current.stats.wordsLearned,1);
  store.markLearned(word.id,'word');assert.equal(store.current.stats.xp,10);assert.ok(eligibleSkills(store,now+DAY).some(s=>s.entryId===word.id));
  assert.deepEqual(Object.values(store.learning.completions),[],'no manual or legacy record is written for board evidence');
 });
 await test('a mismatch on that word in the session leaves it uncredited until a clean session',()=>{
  fresh();for(const t of boardRows())boardRow(t,'course-v2:2');
  boardRow(boardRows()[0],'course-v2:2',{ok:false,outcome:'incorrect',errorTags:['matching-mismatch'],firstAttempt:true});
  assert.equal(journeyWordCompletion(lessonPlan(word),store.learning).complete,false);assert.equal(store.completionState(word).complete,false);assert.equal(store.isLearned(word.id),false);
  for(const t of boardRows())boardRow(t,'course-v2:3');
  assert.equal(store.completionState(word).complete,true);assert.equal(journeyWordCompletion(lessonPlan(word),store.learning).source,'course');
 });
 await test('board rows split across two sessions, an older epoch or an uncheck do not complete the word',()=>{
  fresh();for(const t of boardRows().slice(0,2))boardRow(t,'course-v2:4');for(const t of boardRows().slice(2))boardRow(t,'course-v2:5');
  assert.equal(store.completionState(word).complete,false);
  fresh();for(const t of boardRows())boardRow(t,'course-v2:6');assert.equal(store.completionState(word).complete,true);
  store.setCompletion(word,{checked:false});assert.equal(store.completionState(word).complete,false);assert.equal(store.isLearned(word.id),false);
  now+=10;for(const t of boardRows())boardRow(t,'course-v2:7');assert.equal(store.completionState(word).complete,true,'a fresh drill after the uncheck restores it');assert.equal(store.isLearned(word.id),true);
  store.current.learning=resetLearning(store.learning,++now,'reset-boards');assert.equal(store.completionState(word).complete,false);assert.equal(store.isLearned(word.id),false);
 });
 await test('board credit covers the four board skills: a noun needs its article and plural rows, a singular-use noun its article row, an adjective only meaning and recall',()=>{
  fresh();const adj=data.vocab.find(e=>e.pos==='adj'&&e.forms?.length===4),targets=lessonObjectives(adj);
  const slotTargets=[...new Set(lessonPlan(adj).wordLesson.slots.map(s=>s.targetId))].map(id=>targets.find(t=>t.id===id));
  assert.deepEqual(slotTargets.map(t=>t.skill),['meaning','recall','agreement','agreement']);
  // The boards never ask agreement, so an adjective's agreement stays with its own lesson.
  for(const t of slotTargets.slice(0,2))boardRow(t,'course-v2:8',{entryId:adj.id,wordSlotId:`v2-adj.words-check.meaning.1:${t.skill}`,courseLessonId:'v2-adj'});
  assert.equal(store.completionState(adj).complete,true);
  // A noun's slots name meaning, recall, article and plural: all four rows are required (the plural row is the board slot's second target).
  assert.deepEqual([...new Set(lessonPlan(word).wordLesson.slots.map(s=>lessonObjectives(word).find(t=>t.id===s.targetId).skill))],['meaning','recall','article','plural']);
  // A singular-use noun has a number screen instead of a plural; the boards cannot ask it, so article is its last required row.
  const calcio=data.vocab.find(e=>e.it==='calcio'&&e.pos==='noun'),calcioTargets=lessonObjectives(calcio);
  const calcioSlots=[...new Set(lessonPlan(calcio).wordLesson.slots.map(s=>s.targetId))].map(id=>calcioTargets.find(t=>t.id===id));
  assert.deepEqual(calcioSlots.map(t=>t.skill),['meaning','recall','article','number']);
  for(const t of calcioSlots.slice(0,2))boardRow(t,'course-v2:9',{entryId:calcio.id,wordSlotId:`v2-calcio.words-check.meaning.1:${t.skill}`,courseLessonId:'v2-calcio'});
  assert.equal(store.completionState(calcio).complete,false,'the article row is still missing');
  boardRow(calcioSlots[2],'course-v2:9',{entryId:calcio.id,wordSlotId:'v2-calcio.words-check.forms.1:article',courseLessonId:'v2-calcio'});
  assert.equal(store.completionState(calcio).complete,true);
 });
 await test('independent device edits merge per case and false tombstones survive stale backups',()=>{
  fresh();store.setCompletion(verb,{caseId:'present',checked:true});const a=copy(store.learning);now+=10;store.setCompletion(verb,{caseId:'present',checked:false});const b=copy(store.learning);
  const c=setCompletionRecord(a,{entryId:verb.id,caseId:'future',checked:true,at:now+1,id:'other-device'});
  const ab=mergeLearning(b,c),ba=mergeLearning(c,b);assert.deepEqual(ab,ba);assert.equal(completionRecord(ab,verb.id,'present').checked,false);assert.equal(completionRecord(ab,verb.id,'future').checked,true);
  assert.deepEqual(mergeLearning(ab,a),ab);assert.deepEqual(mergeLearning(resetLearning(ab,now+100,'reset'),ab).completions,{});
 });
 await test('v2 migration preserves actual evidence, exact draft, XP and Starred; legacy flags enroll without mastery',async()=>{
  fresh();const profile=copy(store.current);profile.learning.version=2;delete profile.learning.completions;
  profile.items[verb.id]={learned:true,learnedAt:START-1,last:START,due:START};profile.stats.xp=42;
  const session=createJourneySession({id:'v9-draft',plan:lessonPlan(word),now});session.ui={draft:'retained',paused:true};profile.learning.session=session;profile.learning.sessions.saved=session;
  profile.lists.starred={id:'starred',name:'Starred',items:[word.id]};await store.importJSON(JSON.stringify({profile}));
  assert.equal(store.learning.version,LEARNING_VERSION);assert.equal(LEARNING_VERSION,5);assert.equal(store.current.stats.xp,42);assert.equal(store.learning.session.ui.draft,'retained');assert.deepEqual(store.lists.starred.items,[word.id]);
  assert.equal(store.completionState(verb).complete,true);assert.deepEqual(store.learning.events,{});assert.ok(eligibleSkills(store,now+DAY).every(s=>!s.ready));
  const newer={...copy(store.learning),version:LEARNING_VERSION+1};assert.deepEqual(normalizeLearning(newer),newer);assert.throws(()=>mergeLearning(store.learning,newer),/newer version/);
 });
 await test('manual overrides survive profile reload, import union, and profile switching',async()=>{
  fresh();store.setCompletion(verb,{caseId:'past',checked:true});store.setCompletion(word,{checked:false});await store.saveNow();const original=store.current.id,backup=store.exportJSON();
  await store.createProfile('Other');assert.equal(store.completionState(verb).complete,false);await store.switchProfile(original);
  assert.equal(store.completionState(verb).cases.find(c=>c.id==='past').checked,true);await store.importJSON(backup,{merge:true});assert.equal(completionRecord(store.learning,word.id,'word').checked,false);
 });
 await test('fully manually completed entries are not suggested as untouched lessons',()=>{
  fresh();scope([verb]);store.setCompletion(verb,{checked:true});const next=recommendLesson(store,{now});assert.ok(!next || next.mode==='review');
 });
 await test('finishing the remaining lesson after partial manual completion keeps one automatic completion reward',()=>{
  fresh();for(const id of ['present','past','background','condizionale'])store.setCompletion(verb,{caseId:id,checked:true});
  assert.equal(store.current.stats.xp,0);completeCase('future');assert.equal(store.isLearned(verb.id),true);assert.equal(store.getItem(verb.id).learned,false);
  const events=copy(store.learning.events);store.markLearned(verb.id,'verb');assert.equal(store.current.stats.xp,30);store.markLearned(verb.id,'verb');assert.equal(store.current.stats.xp,30);assert.deepEqual(store.learning.events,events);
 });
 await test('completed advanced chapters remain optional reviews; marking core cases does not enroll them',()=>{
  fresh();store.learning.preferences.expansions=['requests'];const advanced=lessonObjectives(verb).find(t=>t.chapterId==='imperativo'&&t.available!==false&&!t.supplementalOnly);
  assert.ok(advanced);evidence(advanced);store.setCompletion(verb,{checked:true});assert.ok(!eligibleSkills(store,now).some(s=>s.objectiveId===advanced.id));
  completeCase('imperativo');assert.ok(journeyChapterCompletions(lessonPlan(verb),store.learning).find(c=>c.id==='imperativo').ready);
  assert.ok(eligibleSkills(store,now).some(s=>s.objectiveId===advanced.id));store.learning.preferences.expansions=[];assert.ok(!eligibleSkills(store,now).some(s=>s.objectiveId===advanced.id));
 });
 await test('mixed review remains optional after all core cases and cannot introduce an unchecked tense',()=>{
  fresh();const mixed=lessonObjectives(verb).filter(t=>t.chapterId==='mixed'&&t.available!==false);for(const t of mixed)evidence(t);
  store.setCompletion(verb,{caseId:'present',checked:true});const ids=new Set(eligibleSkills(store,now).map(s=>s.objectiveId));
  assert.ok(mixed.every(t=>!ids.has(t.id)));store.setCompletion(verb,{checked:true});assert.ok(mixed.every(t=>eligibleSkills(store,now).some(s=>s.objectiveId===t.id)));
  store.setCompletion(verb,{caseId:'past',checked:false});assert.ok(mixed.every(t=>!eligibleSkills(store,now).some(s=>s.objectiveId===t.id)));
 });
 await test('a real fresh classic word pass reverses an uncheck without inventing answers or repeating a bonus',()=>{
  fresh();store.setCompletion(word,{checked:true});store.setCompletion(word,{checked:false});
  const questions=[{meta:{skill:'meaning'}},{meta:{skill:'article'}},{meta:{skill:'recall'}}],run=store.beginLegacyLessonRun(word,{questions,passScore:50});
  const result={answers:questions.map(q=>({q,ok:true}))},events=copy(store.learning.events),done=store.finishLegacyLessonRun(run,result);
  assert.equal(done.complete,true);assert.equal(done.learnedNow,true);assert.equal(done.xp,0);assert.equal(store.isLearned(word.id),true);assert.deepEqual(store.learning.events,events);
  assert.equal(store.finishLegacyLessonRun(run,result).learnedNow,false);store.setCompletion(word,{checked:false});store.finishLegacyLessonRun(run,result);assert.equal(store.isLearned(word.id),false);
 });
 await test('classic completion rejects a failure, a newer uncheck, a profile change and a reset',async()=>{
  fresh();const questions=[{meta:{skill:'meaning'}}],result={answers:questions.map(q=>({q,ok:true}))};
  let run=store.beginLegacyLessonRun(word,{questions,passScore:50});store.finishLegacyLessonRun(run,{answers:[{q:questions[0],ok:false}]});assert.equal(store.isLearned(word.id),false);
  run=store.beginLegacyLessonRun(word,{questions,passScore:50});store.setCompletion(word,{checked:false});assert.equal(store.finishLegacyLessonRun(run,result).complete,false);
  run=store.beginLegacyLessonRun(word,{questions,passScore:50});store.current.learning=resetLearning(store.learning,++now,'new-reset');assert.equal(store.finishLegacyLessonRun(run,result).complete,false);
  run=store.beginLegacyLessonRun(word,{questions,passScore:50});const profile=store.current.id;await store.createProfile('Changed during run');assert.equal(store.finishLegacyLessonRun(run,result).complete,false);await store.switchProfile(profile);
 });
 await test('classic verbs enroll only successfully taught or tested supported cases',()=>{
  fresh();store.setCompletion(verb,{caseId:'present',checked:true});
  const questions=[{meta:{skill:'conjugation',tense:'passatoProssimo'}},{meta:{skill:'conjugation',tense:'futuro'}},{meta:{skill:'recall'}}];
  const run=store.beginLegacyLessonRun(verb,{questions,passScore:66,taughtTenses:[{tense:'imperfetto',at:now}]});
  const result={answers:questions.map((q,i)=>({q,ok:i!==1}))};const done=store.finishLegacyLessonRun(run,result);
  assert.deepEqual(store.completionState(verb).cases.filter(c=>c.checked).map(c=>c.id),['present','past','background']);assert.equal(done.complete,false);assert.equal(done.learnedNow,false);assert.equal(done.xp,0);assert.deepEqual(store.learning.events,{});
 });
 await test('a tense check before an uncheck cannot be reused by a later classic drill',()=>{
  fresh();const taughtAt=now;store.setCompletion(verb,{caseId:'background',checked:false});now+=10;
  const questions=[{meta:{skill:'conjugation',tense:'presente'}}],run=store.beginLegacyLessonRun(verb,{questions,passScore:66,taughtTenses:[{tense:'imperfetto',at:taughtAt}]});
  store.finishLegacyLessonRun(run,{answers:questions.map(q=>({q,ok:true}))});assert.equal(store.completionState(verb).cases.find(c=>c.id==='background').checked,false);assert.equal(store.completionState(verb).cases[0].checked,true);
 });
 await test('fresh legacy adaptive evidence can complete its tested case; stale readiness cannot undo an uncheck',()=>{
  fresh();const target={id:`${verb.id}::presente::conjugation`,skill:'conjugation',tense:'presente',required:true};
  const prove=sessionId=>{for(let i=0;i<4;i++){evidence(target,{policy:null,sessionId});for(let j=0;j<2;j++)evidence({id:'spacer',skill:'meaning'},{policy:null,sessionId,mode:'recognition'});}};
  prove('old-legacy');assert.equal(skillState(store.learning,target.id).ready,true);store.setCompletion(verb,{caseId:'present',checked:false});
  store.completeLegacyEvidence(verb,[target],{sessionId:'old-legacy'});assert.equal(store.completionState(verb).cases[0].checked,false);
  prove('new-legacy');store.completeLegacyEvidence(verb,[target],{sessionId:'new-legacy'});assert.equal(store.completionState(verb).cases[0].checked,true);assert.equal(store.isLearned(verb.id),false);assert.equal(store.current.stats.xp,0);
 });
 await test('merged manual cases cannot earn an automatic completion bonus from stale raw item flags',async()=>{
  fresh();store.setCompletion(verb,{caseId:'present',checked:true});const remote=store.exportJSON();
  fresh();for(const id of ['past','background','future','condizionale'])store.setCompletion(verb,{caseId:id,checked:true});
  assert.equal(store.getItem(verb.id).learned,false);await store.importJSON(remote,{merge:true});assert.equal(store.isLearned(verb.id),true);assert.equal(store.getItem(verb.id).learned,false);
  store.markLearned(verb.id,'verb');assert.equal(store.getItem(verb.id).learned,true);assert.equal(store.current.stats.xp,0);assert.equal(store.current.stats.verbsLearned||0,0);
  store.setCompletion(word,{checked:true});store.getItem(word.id).learned=false;delete store.getItem(word.id).learnedAt;store.markLearned(word.id,'word');assert.equal(store.current.stats.xp,0);assert.equal(store.current.stats.wordsLearned||0,0);
 });
 console.log(`\n${passed} completion/enrollment checks passed.`);
} finally {await store.saveNow();clearTimeout(store._saveTimer);Date.now=originalNow;}
