import {priorCoreVectorsWithConcernereException} from './verb-reference-baseline.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLesson,lessonContexts} from '../js/learning/lesson-content.js';
import {simpleVerbContexts,progressiveContexts} from '../js/learning/progressive-content.js';
import {conjugate} from '../js/conjugator.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createJourneyScene,retiredJourneyScene,journeySceneContexts} from '../js/learning/journey-scene.js';
const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))),verb=inf=>verbs.find(e=>e.inf===inf);
const fixture=JSON.parse(fs.readFileSync(new URL('../docs/implementation/programme/verb-repairs-271-prior-pools.json',import.meta.url)));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const targets=plan=>plan.chapters.flatMap(ch=>ch.groups.flatMap(g=>g.targets));
const required=plan=>plan.chapters.map(ch=>({id:ch.id,targets:ch.groups.flatMap(g=>g.targets).filter(t=>t.required!==false&&t.available!==false).map(t=>t.id)}));
let pools=0,retired=0,preserved=0;
for(const record of fixture.records){
 const entry=verb(record.id.slice(2)),plan=buildLesson(entry),prior=buildLesson(entry,{legacyExpanded:true}),freshTargets=targets(plan),priorTargets=targets(prior);
 assert.deepEqual(required(buildLesson(entry,{legacy:true})),record.ordinaryRequired,'Ordinary saved completion requirements stay exact');
 for(const oldChapter of record.chapters){
  assert.deepEqual(plan.chapters.find(c=>c.id===oldChapter.id).legacyRequirements,oldChapter.legacyRequirements);
  for(const old of oldChapter.targets){
   const t=priorTargets.find(t=>t.id===old.id),fresh=freshTargets.find(t=>t.id===old.id);
   assert.equal(t.contexts?.length||0,old.poolSize);assert.equal(hash(t.contexts||[]),old.poolSHA256,old.id);
   if(old.poolSize)assert.equal(hash(fresh.legacyExpandedContexts),old.poolSHA256,old.id);
   assert.equal(hash(fresh.legacyAuthoredContexts||[]),old.legacyAuthoredSHA256,old.id);pools++;
  }
 }
 for(const chapter of plan.chapters)for(const t of chapter.groups.flatMap(g=>g.targets)){
  for(const [variant,old] of journeySceneContexts(t,{legacy:true}).entries()){
   const snap=createJourneyScene({entryId:entry.id,chapterId:chapter.id,target:t,variant,legacy:true});
   const q=buildJourneyQuestion(entry,chapter,t,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1',sceneSnapshot:snap});
   if(retiredJourneyScene(snap,t)){assert.equal(q,null,'A corrected old model cannot be graded');retired++;}
   else {assert(q,old.id);assert.equal(q.context.it,old.it);assert.equal(q.context.en,old.en);preserved++;}
   // This is the revision already written by the checkpoint engine, rather
   // than merely a newly invented previous-revision label.
   const actualSaved={...snap,sourceRevision:record.priorSceneRevision};
   const actualQuestion=buildJourneyQuestion(entry,chapter,t,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1',sceneSnapshot:actualSaved});
   if(retiredJourneyScene(actualSaved,t))assert.equal(actualQuestion,null);
   else {assert(actualQuestion,old.id+' actual previous snapshot');assert.equal(actualQuestion.context.it,old.it);assert.equal(actualQuestion.context.en,old.en);}
  }
  for(const [variant,c]of journeySceneContexts(t).entries()){
   const snap=createJourneyScene({entryId:entry.id,chapterId:chapter.id,target:t,variant});
   assert(!retiredJourneyScene(snap,t),'A corrected same-ID current scene is available');
   assert(buildJourneyQuestion(entry,chapter,t,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1',sceneSnapshot:snap}),c.id);
  }
 }
}
const odiare=verb('odiare'),odCurrent=targets(buildLesson(odiare)),odRetired=odCurrent[0].retiredExpandedContextIds;
for(const plan of [buildLesson(odiare),buildLesson(odiare,{legacy:true}),buildLesson(odiare,{legacyExpanded:true})])assert(targets(plan).every(t=>t.legacyExpandedRevisionAliases?.[0]==='expanded-v1-before-odiare-neutral-frame-2026-10-03-1'));
assert.equal(odRetired.length,12);assert(odRetired.every(id=>/:scene-3-[1-5]-(ordinary|formal)$/.test(id)));
for(const chapter of ['present','background']){
 const scenes=simpleVerbContexts(odiare,{chapter,section:'all'}).filter(c=>c.id.includes('scene-3-'));
 assert.equal(scenes.length,7);assert(scenes.every(c=>c.it.endsWith('il rumore di notte.')&&c.en.endsWith('noise at night.')));
 const coherentPrior=simpleVerbContexts(odiare,{chapter,section:'all',legacyExpanded:true}).find(c=>c.person===0&&c.id.includes('scene-3-'));
 assert(coherentPrior.it.endsWith('alzarmi presto.'));assert(!odRetired.includes(coherentPrior.id));
}
const morire=verb('morire'),moCurrent=simpleVerbContexts(morire,{chapter:'background',section:'all'}),moPrior=simpleVerbContexts(morire,{chapter:'background',section:'all',legacyExpanded:true});
assert(moCurrent.filter(c=>c.person===2).every(c=>c.en.startsWith('The plant was dying ')));
assert(moCurrent.filter(c=>c.person===5).every(c=>c.en.startsWith('The plants were dying ')));
assert(moPrior.every(c=>c.en.includes('used to die')));assert.equal(targets(buildLesson(morire))[0].retiredExpandedContextIds.length,4);
assert(progressiveContexts(morire,{chapter:'background'}).every(c=>c.en.includes('dying')));
for(const chapter of ['present','background'])assert(simpleVerbContexts(verb('riempire'),{chapter,section:'all'}).filter(c=>c.id.includes('scene-1-')).every(c=>c.en.endsWith('a glass.')));
assert.equal(verb('controllare').examples[1].en,'Did you check that the door is closed?');
assert.equal(verb('raccontare').examples[2].it,'Quando ero piccola, mia madre mi raccontava sempre le favole.');
assert.equal(verb('dimagrire').examples[2].it,'Se dimagrirai, dovrai comprare pantaloni nuovi.');
for(const inf of ['controllare','raccontare','dimagrire'])assert(!['present','past','background','future','condizionale'].flatMap(ch=>lessonContexts(verb(inf),ch)).some(c=>c.it===verb(inf).examples[inf==='controllare'?1:2].it),'The corrected reference-only examples do not silently expand required questions');
const note=conjugate('riconoscere').nonFiniteNotes.participioPresente;
assert.equal(conjugate('riconoscere').nonFinite.participioPresente,'riconoscente');assert.match(note.text,/grateful.*historical/);assert.equal(note.source,'https://www.treccani.it/vocabolario/riconoscente/');
const forms=verbs.map(e=>({id:e.id,cases:['presente','passatoProssimo','imperfetto','futuro','condizionale'].map(k=>conjugate(e.inf,e).tenses[k])}));
assert.equal(hash(priorCoreVectorsWithConcernereException(forms)),'2f8f8a32bd3fe0cb65378f43c75e85879ab4f911c897376278f18d378393ff3f','All other five-core vectors stay exact, with the explicit concernere missing-participle exception');
console.log(`${pools} prior target-pool hashes/order and ordinary completion sets preserved; ${retired} target/variant occurrences of the 16 exact invalid old scenes blocked, ${preserved} valid old selections preserved, and every current selection remains executable.`);
console.log('Seven language fixes match their intended meaning/aspect; 1185 other five-case paradigms are unchanged, with the explicit concernere reference repair. This is bounded regression evidence, not full linguistic or human review.');
