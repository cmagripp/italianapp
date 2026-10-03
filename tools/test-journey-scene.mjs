#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createLearning,recordAttempt,normalizeLearning,mergeLearning} from '../js/learning/model.js';
import {createJourneySession,currentJourneyStep,pinJourneyScene,journeyAttempt,recordJourneyAttempt,advanceJourney} from '../js/learning/journey.js';
import {createJourneyScene,validJourneyScene,retiredJourneyScene,journeySceneContexts} from '../js/learning/journey-scene.js';
const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))),copy=x=>JSON.parse(JSON.stringify(x));
const results=[];const check=(name,run)=>{run();results.push(name);console.log('PASS',name);};
function fixture(inf='domandare',chapterId='present',select=t=>t.skill==='conjugation'&&t.person===0,variant=0){
 const entry={...verbs.find(e=>e.inf===inf),kind:'verb'},plan=buildLesson(entry),chapter=plan.chapters.find(c=>c.id===chapterId),target=chapter.groups.flatMap(g=>g.targets).find(select);
 const session=createJourneySession({id:`scene-${inf}`,plan,chapterId,now:1});
 Object.assign(session.journey,{phase:'practice',serial:1,queue:[target.id],current:{targetId:target.id,phase:'independent',format:'type',variant,questionId:`scene-${inf}:journey:1`,supplemental:false,repairTag:null,scenePolicy:'expanded-v1'}});
 session.ui={questionId:session.journey.current.questionId,draft:'doman',given:'',result:null};
 return {entry,plan,chapter,target,session};
}
const question=(f,s)=>buildJourneyQuestion(f.entry,f.chapter,f.target,currentJourneyStep(f.plan,s));
check('An unsnapshotted expanded cursor preserves the exact previous authored sentence and UI',()=>{
 const f=fixture(),before=copy(f.session),pinned=pinJourneyScene(f.plan,f.session),q=question(f,pinned);
 assert.equal(q.context.it,'Io domando una cosa.');assert.equal(q.context.en,'I ask one thing.');assert.equal(q.say,q.context.it);
 assert.equal(pinned.journey.current.questionId,before.journey.current.questionId);assert.deepEqual(pinned.ui,before.ui);assert.equal(pinned.index,before.index);assert.deepEqual(f.session,before);
 assert.equal(pinned.journey.current.sceneSnapshot.sourceRevision,'expanded-v1-before-domandare-usage-2026-10-03-1');
 assert.deepEqual(pinJourneyScene(f.plan,pinned),pinned);
});
check('Fresh selection uses the corrected scene without copying completion or evidence',()=>{
 const f=fixture(),scene=createJourneyScene({entryId:f.entry.id,chapterId:f.chapter.id,target:f.target,variant:1});
 const q=buildJourneyQuestion(f.entry,f.chapter,f.target,{variant:1,scenePolicy:'expanded-v1',sceneSnapshot:scene});
 assert.equal(q.context.it,'Io domando a Sara come sta.');assert.equal(q.context.en,'I ask Sara how she is.');assert.equal(q.answer[0],'domando');
 assert.equal(scene.sourceRevision,'domandare-usage-2026-10-03-1');assert.equal(f.session.index,0);
});
check('Stored feedback keeps its scene until Continue; the following selected scene is current',()=>{
 const f=fixture(),learning=createLearning(1);let session=pinJourneyScene(f.plan,f.session),q=question(f,session);
 const next=f.chapter.groups.flatMap(g=>g.targets).find(t=>t.skill==='conjugation'&&t.person===1),v=next.contexts.findIndex(c=>c.it.includes('a Sara come sta'));
 session.journey.queue=[f.target.id,next.id];session.journey.variants[next.id]={guided:0,independent:v,repair:0};
 const event=journeyAttempt(f.plan,session,q,{ok:true,outcome:'correct'},{now:100});
 const recorded=recordAttempt(learning,{...event,deviceId:'scene-test',sequence:1,epochId:learning.epoch.id});
 session=recordJourneyAttempt(f.plan,session,event,recorded);
 assert(session.journey.awaitingContinue);assert.equal(question(f,copy(session)).context.it,q.context.it);
 const advanced=advanceJourney(f.plan,session,recorded.learning,{now:101}),step=currentJourneyStep(f.plan,advanced,recorded.learning,101);
 assert.equal(step.target.id,next.id);assert.equal(step.sceneSnapshot.sourceRevision,'domandare-usage-2026-10-03-1');
 assert.notEqual(step.questionId,session.journey.current.questionId);
 assert.equal(buildJourneyQuestion(f.entry,step.chapter,step.target,step).context.it,'Tu domandi a Sara come sta.');
 assert.equal(Object.keys(recorded.learning.events).length,1);assert.equal(advanced.index,1);
});
check('Sentence, person, audio and English cue survive a later pool expansion or reorder',()=>{
 const f=fixture(),variant=f.target.contexts.length;
 const scene=createJourneyScene({entryId:f.entry.id,chapterId:f.chapter.id,target:f.target,variant,legacy:true});
 const old=buildJourneyQuestion(f.entry,f.chapter,f.target,{variant,scenePolicy:'expanded-v1',sceneSnapshot:scene});
 const target={...f.target,contexts:[...f.target.contexts].reverse().concat(f.target.contexts)};
 const next=buildJourneyQuestion(f.entry,f.chapter,target,{variant,scenePolicy:'expanded-v1',sceneSnapshot:copy(scene)});
 assert(scene.englishCue);assert.deepEqual(next.prompt,old.prompt);assert.deepEqual(next.context,old.context);assert.equal(next.say,old.say);assert.deepEqual(next.answer,old.answer);assert.equal(next.meta.person,old.meta.person);
});
check('Progressive and formal scenes retain their exact construction and accepted alternatives',()=>{
 for(const select of [t=>t.progressive&&t.person===0,t=>t.progressive&&t.role==='formal']){
  const f=fixture('domandare','present',select),session=pinJourneyScene(f.plan,f.session),q=question(f,session);
  assert(q.context.it.includes('una cosa'));assert(q.answer.every(a=>a.includes('domandando')));assert.equal(q.say,q.context.it);assert.equal(q.meta.role,f.target.role);
 }
});
check('Dictionary source translation revisions preserve the exact prior selected example',()=>{
 const f=fixture('controllare','present',t=>t.skill==='conjugation'&&t.person===0,0);
 // The question parser conservatively excludes the interrogative dictionary-1.
 // Test an actually selectable example with a later English-only revision.
 assert(!f.plan.chapters.find(c=>c.id==='past').groups.flatMap(g=>g.targets).some(t=>t.contexts?.some(c=>c.id.endsWith('dictionary-1'))));
 f.entry.examples=copy(f.entry.examples);f.entry.examples[0].en='I check my email each morning.';
 f.plan=buildLesson(f.entry);f.chapter=f.plan.chapters.find(c=>c.id==='present');f.target=f.chapter.groups.flatMap(g=>g.targets).find(t=>t.id===f.target.id);
 const v=f.target.contexts.findIndex(c=>c.id.endsWith('dictionary-0'));assert(v>=0);
 f.session.journey.current.variant=v;const pinned=pinJourneyScene(f.plan,f.session),q=question(f,pinned);
 assert.equal(q.context.it,"Controllo l'email ogni mattina.");assert.equal(q.context.en,'I check my email every morning.');assert.equal(q.answer[0],'controllo');
 const fresh=createJourneyScene({entryId:f.entry.id,chapterId:f.chapter.id,target:f.target,variant:v});
 assert.equal(fresh.context.en,'I check my email each morning.');
 assert.equal(pinned.journey.current.sceneSnapshot.sourceRevision,'expanded-v1-before-controllare-closed-2026-10-03-1');
});
check('Older non-expanded cursors still use their own legacy policy and gain no expanded snapshot',()=>{
 const f=fixture();delete f.session.journey.current.scenePolicy;
 assert.strictEqual(pinJourneyScene(f.plan,f.session),f.session);assert.equal(question(f,f.session).meta.scenePolicy,undefined);
});
check('Full learning normalization and offline merge preserve the selected scene, feedback and unfinished draft',()=>{
 const f=fixture(),session=pinJourneyScene(f.plan,f.session),learning=createLearning(1);
 session.ui.result={ok:true,outcome:'correct',feedback:'Saved supported feedback',components:[],errorTags:[]};
 learning.session=session;learning.sessions[`${f.entry.id}|lesson`]=session;
 const imported=normalizeLearning(copy(learning),2),merged=mergeLearning(imported,createLearning(1),3);
 assert.deepEqual(imported.session.journey.current.sceneSnapshot,session.journey.current.sceneSnapshot);
 assert.deepEqual(merged.session.journey.current.sceneSnapshot,session.journey.current.sceneSnapshot);
 assert.equal(merged.session.ui.draft,'doman');assert.equal(merged.session.ui.result.feedback,'Saved supported feedback');assert.equal(Object.keys(merged.events).length,0);
 const invalid=copy(learning);invalid.session.journey.current.sceneSnapshot.context.en='Invented translation';
 const preserved=normalizeLearning(invalid,2);assert.equal(currentJourneyStep(f.plan,preserved.session).type,'unavailable');assert.equal(preserved.session.ui.draft,'doman');assert.equal(preserved.session.journey.current.sceneSnapshot.context.en,'Invented translation');
});
check('Malformed, mismatched or changed-answer imports remain unavailable and unchanged',()=>{
 const f=fixture(),pinned=pinJourneyScene(f.plan,f.session),source=pinned.journey.current.sceneSnapshot;
 const edits=[s=>s.context.answers=['invented'],s=>s.context.person=5,s=>s.targetId='other',s=>s.entryId='v:other',s=>s.variant++,s=>s.poolSize=0,s=>s.context.html='<script>bad()</script>',s=>s.sourceRevision='',s=>s.sourceRevision='made-up-revision',s=>s.context.it='No target form here.',s=>s.context.it='Tu domando una domanda.',s=>s.context.en='I order a drink.',s=>s.context.source='unreviewed-import',s=>{s.poolSize=4;s.englishCue=false;}];
 for(const edit of edits){const session=copy(pinned);edit(session.journey.current.sceneSnapshot);const before=copy(session);
  assert.equal(currentJourneyStep(f.plan,session).type,'unavailable');assert.equal(buildJourneyQuestion(f.entry,f.chapter,f.target,{variant:session.journey.current.variant,scenePolicy:'expanded-v1',sceneSnapshot:session.journey.current.sceneSnapshot}),null);assert.deepEqual(pinJourneyScene(f.plan,session),before);assert.deepEqual(session,before);
 }
 assert(validJourneyScene(source));
});
check('Registered source text is escaped; imported HTML cannot substitute for an authored scene',()=>{
 const f=fixture(),target=copy(f.target);target.contexts[1].it='Io domando <img src=x onerror=alert(1)>.';
 const scene=createJourneyScene({entryId:f.entry.id,chapterId:f.chapter.id,target,variant:1});
 const q=buildJourneyQuestion(f.entry,f.chapter,f.target,{variant:1,scenePolicy:'expanded-v1',sceneSnapshot:scene});
 assert.equal(q,null);
 const trusted=buildJourneyQuestion(f.entry,f.chapter,target,{variant:1,scenePolicy:'expanded-v1',sceneSnapshot:scene});
 assert(trusted);assert(!trusted.prompt.includes('<img'));assert(trusted.prompt.includes('&lt;img'));
});
check('All four real retired compound spans require explicit correction and cannot create further answer credit',()=>{
 for(const inf of ['fiorire','peggiorare','sparire','emanare']){
  const f=fixture(inf,'present',t=>t.skill==='conjugation'&&t.person===4,0);
  const variant=f.target.legacyExpandedContexts.findIndex(c=>f.target.retiredExpandedContextIds.includes(c.id));assert(variant>=0,inf);
  f.session.journey.current.variant=variant;let session=pinJourneyScene(f.plan,f.session),step=currentJourneyStep(f.plan,session);
  assert.equal(step.type,'corrected',inf);assert.equal(buildJourneyQuestion(f.entry,f.chapter,f.target,step),null);
  const original=copy(session),dummy={type:'type',meta:{targetId:f.target.id,mode:'production'},answer:[step.sceneSnapshot.context.answer]};
  assert.equal(journeyAttempt(f.plan,session,dummy,{ok:true,outcome:'correct'}),null);
  const event={id:session.journey.current.questionId,sessionId:session.id,index:0,at:2,objectiveId:f.target.id,entryId:f.entry.id,policy:'journey-v1',ok:true,outcome:'correct'};
  assert.strictEqual(recordJourneyAttempt(f.plan,session,event,{added:true}),session);assert.deepEqual(session,original);
  const learning=createLearning(1),advanced=advanceJourney(f.plan,session,learning,{now:100});
  const fresh=currentJourneyStep(f.plan,advanced,learning,100);assert.equal(fresh.type,'question',inf);assert.notEqual(fresh.questionId,original.journey.current.questionId);
  const q=buildJourneyQuestion(f.entry,fresh.chapter,fresh.target,fresh);assert(q,inf);assert.equal(q.meta.person,4);assert(!fresh.target.retiredExpandedContextIds.includes(q.meta.contextId));
  assert.equal(advanced.index,0);assert.deepEqual(advanced.answeredEventIds,[]);assert.equal(Object.keys(learning.events).length,0);
  assert.deepEqual(advanced.sceneCorrectionRecovery[0].current,original.journey.current);assert.deepEqual(advanced.sceneCorrectionRecovery[0].ui,original.ui);
 }
});
check('Already answered retired feedback and historical events remain recoverable without replay or completion changes',()=>{
 const f=fixture('fiorire','present',t=>t.skill==='conjugation'&&t.person===4,0);let session=pinJourneyScene(f.plan,f.session);
 const event={id:session.journey.current.questionId,sessionId:session.id,index:0,at:2,objectiveId:f.target.id,entryId:f.entry.id,kind:'verb',skill:'conjugation',policy:'journey-v1',mode:'production',activityKind:'independent',firstAttempt:true,ok:true,outcome:'correct',assistance:[]};
 const initial=createLearning(1),learning=recordAttempt(initial,{...event,epochId:initial.epoch.id,deviceId:'old-scene',sequence:1}).learning;
 session.index=1;session.answeredEventIds=[event.id];session.journey.awaitingContinue=true;session.journey.lastAttempt={id:event.id,targetId:f.target.id,variant:0,ok:true,outcome:'correct',errorTags:[]};
 session.ui={...session.ui,draft:'fiorite',given:'fiorite',result:{ok:true,outcome:'correct',feedback:'Earlier saved feedback',components:[],errorTags:[]}};
 const original=copy(session),before=copy(learning),advanced=advanceJourney(f.plan,session,learning,{now:100});
 assert.deepEqual(learning,before);assert.equal(Object.keys(learning.events).length,1);assert.equal(advanced.index,1);assert.deepEqual(advanced.answeredEventIds,[event.id]);
 assert.equal(advanced.sceneCorrectionRecovery[0].ui.result.feedback,'Earlier saved feedback');assert.equal(advanced.sceneCorrectionRecovery[0].ui.given,'fiorite');assert.deepEqual(advanced.sceneCorrectionRecovery[0].journey.lastAttempt,original.journey.lastAttempt);
 const roundtrip=normalizeLearning({...learning,session:advanced,sessions:{[`${f.entry.id}|lesson`]:advanced}},101);assert.deepEqual(roundtrip.session.sceneCorrectionRecovery,advanced.sceneCorrectionRecovery);
});
check('Ordinary v1 retired questions are detected without changing harmless legacy selections',()=>{
 for(const inf of ['fiorire','peggiorare','sparire','emanare']){
  const f=fixture(inf,'present',t=>t.skill==='conjugation'&&t.person===4,0);f.plan=buildLesson(f.entry,{legacy:true});f.chapter=f.plan.chapters.find(c=>c.id==='present');f.target=f.chapter.groups.flatMap(g=>g.targets).find(t=>t.id===f.target.id);
  delete f.session.journey.verbFlowVersion;delete f.session.journey.caseCoveragePolicy;delete f.session.journey.current.scenePolicy;
  f.session.journey.current.variant=f.target.legacyAuthoredContexts.findIndex(c=>f.target.retiredExpandedContextIds.includes(c.id));assert(f.session.journey.current.variant>=0);
  assert.equal(currentJourneyStep(f.plan,f.session).type,'corrected');assert.equal(question(f,f.session),null);assert.equal(journeyAttempt(f.plan,f.session,{type:'type',meta:{targetId:f.target.id}},{ok:true}),null);
 }
});
check('Exactly 49 old domandare frame contexts retire by revision; corrected contexts with the same IDs remain usable',()=>{
 const f=fixture(),seen=new Set();
 for(const chapter of f.plan.chapters)for(const target of chapter.groups.flatMap(g=>g.targets)){
  const previous=journeySceneContexts(target,{legacy:true}),current=journeySceneContexts(target);
  for(let variant=0;variant<previous.length;variant++){
   const old=previous[variant];if(!target.retiredExpandedContextIds?.includes(old.id))continue;
   seen.add(old.id);
   const scene=createJourneyScene({entryId:f.entry.id,chapterId:chapter.id,target,variant,legacy:true});assert(retiredJourneyScene(scene,target));
   assert.equal(buildJourneyQuestion(f.entry,chapter,target,{variant,scenePolicy:'expanded-v1',sceneSnapshot:scene}),null);
   const currentVariant=current.findIndex(context=>context.id===old.id);assert(currentVariant>=0,old.id);
   const corrected=createJourneyScene({entryId:f.entry.id,chapterId:chapter.id,target,variant:currentVariant});assert(!retiredJourneyScene(corrected,target));
   const q=buildJourneyQuestion(f.entry,chapter,target,{variant:currentVariant,scenePolicy:'expanded-v1',sceneSnapshot:corrected});assert(q,old.id);assert.notEqual(corrected.context.it,old.it);assert(q.context.it.includes('a Sara come sta'));
  }
 }
 assert.equal(seen.size,49);
 const old=fixture('domandare','present',t=>t.skill==='conjugation'&&t.person===0,1),session=pinJourneyScene(old.plan,old.session);
 assert.equal(currentJourneyStep(old.plan,session).type,'corrected');assert.equal(journeyAttempt(old.plan,session,{type:'type',meta:{targetId:old.target.id}},{ok:true}),null);
 const advanced=advanceJourney(old.plan,session,createLearning(1),{now:100});assert.notEqual(advanced.journey.current.questionId,session.journey.current.questionId);assert.equal(advanced.index,0);
});
check('A future context revision with no replacement sentence continues to the actual same-person form',()=>{
 for(const inf of ['fiorire','emanare']){
  const f=fixture(inf,'present',t=>t.skill==='context',0);
  // These released words retain other valid situations. Simulate a later
  // author-declared context-only removal while retaining the exact prior pool.
  f.target.available=false;f.target.required=false;delete f.target.contexts;
  f.session.journey.current.variant=f.target.legacyExpandedContexts.findIndex(c=>f.target.retiredExpandedContextIds.includes(c.id));
  const session=pinJourneyScene(f.plan,f.session);assert.equal(currentJourneyStep(f.plan,session).type,'corrected');
  const advanced=advanceJourney(f.plan,session,createLearning(1),{now:100}),step=currentJourneyStep(f.plan,advanced);
  assert.equal(step.type,'question');assert.equal(step.target.skill,'conjugation');assert.equal(step.target.person,4);assert.notEqual(step.target.id,f.target.id);
  assert.equal(advanced.sceneCorrectionRecovery.at(-1).current.targetId,f.target.id);assert.equal(advanced.index,0);assert.deepEqual(advanced.answeredEventIds,[]);assert(buildJourneyQuestion(f.entry,step.chapter,step.target,step));
 }
});
check('Declared identical-pool odiare revisions preserve exact valid snapshots and presentation markers',()=>{
 const f=fixture('odiare','present',t=>t.skill==='conjugation'&&t.person===0,0),aliases=f.target.legacyExpandedRevisionAliases;
 assert.deepEqual(aliases,['expanded-v1-before-odiare-neutral-frame-2026-10-03-1']);
 const variant=journeySceneContexts(f.target,{legacy:true}).findIndex(c=>c.it==='Odio alzarmi presto.');assert(variant>=0);
 for(const sourceRevision of [f.target.legacyExpandedRevision,...aliases]){
  const scene=createJourneyScene({entryId:f.entry.id,chapterId:f.chapter.id,target:f.target,variant,legacy:true,sourceRevision});
  const session=copy(f.session);session.journey.current.variant=variant;session.journey.current.sceneRevision=sourceRevision;
  const pinned=pinJourneyScene(f.plan,session);assert.deepEqual(pinned.journey.current.sceneSnapshot,scene);assert.equal(pinned.journey.current.sceneRevision,sourceRevision);
  const q=question(f,pinned);assert(q);assert.equal(q.context.it,'Odio alzarmi presto.');assert.equal(q.context.en,'I hate getting up early.');assert.equal(q.say,q.context.it);
  const learning=createLearning(1);learning.session=pinned;learning.sessions[`${f.entry.id}|lesson`]=pinned;
  const normalized=normalizeLearning(copy(learning),2);assert.deepEqual(normalized.session.journey.current.sceneSnapshot,scene);assert.equal(question(f,normalized.session).context.it,q.context.it);
  assert.equal(Object.keys(normalized.events).length,0);assert.equal(normalized.session.ui.draft,'doman');
 }
});
check('A valid prior alias cannot approve altered text, unknown revision, missing historical pool or retired content',()=>{
 const f=fixture('odiare','present',t=>t.skill==='conjugation'&&t.person===0,0),alias=f.target.legacyExpandedRevisionAliases[0];
 const variant=journeySceneContexts(f.target,{legacy:true}).findIndex(c=>c.it==='Odio alzarmi presto.');
 const scene=createJourneyScene({entryId:f.entry.id,chapterId:f.chapter.id,target:f.target,variant,legacy:true,sourceRevision:alias});assert(scene);
 for(const edit of [s=>s.context.it='Tu odio alzarmi presto.',s=>s.context.en='I like getting up early.',s=>s.sourceRevision='unknown-prior-alias',s=>s.poolSize++]){
  const malformed=copy(scene);edit(malformed);assert.equal(buildJourneyQuestion(f.entry,f.chapter,f.target,{variant,scenePolicy:'expanded-v1',sceneSnapshot:malformed}),null);
 }
 const unsupported=copy(f.target);delete unsupported.legacyExpandedContexts;
 assert.equal(buildJourneyQuestion(f.entry,f.chapter,unsupported,{variant,scenePolicy:'expanded-v1',sceneSnapshot:scene}),null);
 const retired=fixture('odiare','present',t=>t.id.endsWith('v2-mixed-simple'),0),v=journeySceneContexts(retired.target,{legacy:true}).findIndex(c=>retired.target.retiredExpandedContextIds.includes(c.id));assert(v>=0);
 const prior=createJourneyScene({entryId:retired.entry.id,chapterId:retired.chapter.id,target:retired.target,variant:v,legacy:true,sourceRevision:alias});assert(retiredJourneyScene(prior,retired.target));
 const session=copy(retired.session);Object.assign(session.journey.current,{variant:v,sceneRevision:alias,sceneSnapshot:prior});assert.equal(currentJourneyStep(retired.plan,session).type,'corrected');
 assert.equal(buildJourneyQuestion(retired.entry,retired.chapter,retired.target,{variant:v,scenePolicy:'expanded-v1',sceneSnapshot:prior}),null);
 assert.equal(journeyAttempt(retired.plan,session,{type:'type',meta:{targetId:retired.target.id}},{ok:true}),null);
 const currentVariant=journeySceneContexts(retired.target).findIndex(c=>c.id===prior.context.id);assert(currentVariant>=0);
 const current=createJourneyScene({entryId:retired.entry.id,chapterId:retired.chapter.id,target:retired.target,variant:currentVariant});assert(!retiredJourneyScene(current,retired.target));
 assert(buildJourneyQuestion(retired.entry,retired.chapter,retired.target,{variant:currentVariant,scenePolicy:'expanded-v1',sceneSnapshot:current}));
});
console.log(`${results.length} scene revision checks passed.`);
