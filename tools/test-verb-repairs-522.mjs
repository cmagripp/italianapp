import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLesson,lessonContexts} from '../js/learning/lesson-content.js';
import {simpleVerbContexts,progressiveContexts,progressiveSpec,frameEnglishForms} from '../js/learning/progressive-content.js';
import {conjugate} from '../js/conjugator.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createJourneyScene,retiredJourneyScene,journeySceneContexts} from '../js/learning/journey-scene.js';
const root=new URL('../',import.meta.url),read=path=>JSON.parse(fs.readFileSync(new URL(path,root))),verbs=read('data/verbs.json'),verb=inf=>verbs.find(e=>e.inf===inf),fixture=read('docs/implementation/programme/verb-repairs-522-prior.json');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),targets=plan=>plan.chapters.flatMap(ch=>ch.groups.flatMap(g=>g.targets));
const required=plan=>plan.chapters.map(ch=>({id:ch.id,targets:ch.groups.flatMap(g=>g.targets).filter(t=>t.required!==false&&t.available!==false).map(t=>t.id)}));
let pools=0,retired=0,preserved=0,current=0;const retiredIds=new Set();
for(const record of fixture.records){
 const entry=verb(record.id.slice(2)),plan=buildLesson(entry),prior=buildLesson(entry,{legacyExpanded:true}),freshTargets=targets(plan),priorTargets=targets(prior);
 assert.deepEqual(required(buildLesson(entry,{legacy:true})),record.ordinaryRequired);assert.deepEqual(required(plan),record.expandedRequired,'Current required targets/completion do not change');
 for(const oldChapter of record.chapters){assert.deepEqual(plan.chapters.find(c=>c.id===oldChapter.id).legacyRequirements,oldChapter.legacyRequirements);
  for(const old of oldChapter.targets){const t=priorTargets.find(t=>t.id===old.id),fresh=freshTargets.find(t=>t.id===old.id);assert.equal(t.contexts?.length||0,old.poolSize);assert.equal(hash(t.contexts||[]),old.poolSHA256,old.id);if(old.poolSize)assert.equal(hash(fresh.legacyExpandedContexts||fresh.contexts),old.poolSHA256,old.id);assert.equal(hash(fresh.legacyAuthoredContexts||[]),old.legacyAuthoredSHA256,old.id);pools++;}
 }
 for(const chapter of plan.chapters)for(const t of chapter.groups.flatMap(g=>g.targets)){
  for(const [variant,old] of journeySceneContexts(t,{legacy:true}).entries()){
   const snap={...createJourneyScene({entryId:entry.id,chapterId:chapter.id,target:t,variant,legacy:true}),sourceRevision:record.priorSceneRevision};
   const question=buildJourneyQuestion(entry,chapter,t,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1',sceneSnapshot:snap});
   if(retiredJourneyScene(snap,t)){assert.equal(question,null,'Invalid old agreement cannot be graded');retired++;retiredIds.add(old.id);}else{assert(question,old.id);assert.equal(question.context.it,old.it);assert.equal(question.context.en,old.en);preserved++;}
  }
  for(const [variant,context] of journeySceneContexts(t).entries()){const snap=createJourneyScene({entryId:entry.id,chapterId:chapter.id,target:t,variant});assert(!retiredJourneyScene(snap,t));const question=buildJourneyQuestion(entry,chapter,t,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1',sceneSnapshot:snap});assert(question,context.id);assert.equal(question.context.it,context.it);assert.equal(question.context.en,context.en);current++;}
 }
}
const fingere=verb('fingere'),retirement=progressiveSpec(fingere).retiredExpandedContextIds;assert.equal(retirement.length,20);assert.equal(retiredIds.size,20);
for(const chapter of ['present','background'])for(const make of [simpleVerbContexts,progressiveContexts]){
 const now=make(fingere,{chapter,section:'all'}).filter(c=>c.id.includes('scene-3-')),old=make(fingere,{chapter,section:'all',legacyExpanded:true}).filter(c=>c.id.includes('scene-3-'));assert.equal(now.length,7);assert(now.every(c=>c.it.endsWith('di avere freddo.')&&c.en.endsWith('to be cold.')));assert(old.every(c=>c.it.endsWith('di essere sorpreso.')));
 assert(old.filter(c=>[0,1].includes(c.person)&&c.role==='ordinary').every(c=>!retirement.includes(c.id)),'Coherent earlier masculine io/tu quotes remain valid');
 const exaggerate=make(verb('esagerare'),{chapter,section:'all'});assert(exaggerate.filter(c=>/scene-[03]-/.test(c.id)).every(c=>c.en.includes(chapter==='present'?'overdo':'overd')));assert(exaggerate.filter(c=>/scene-[12]-/.test(c.id)).every(c=>c.en.includes('exaggerat')));
 assert(make(verb('mantenere'),{chapter,section:'all'}).filter(c=>c.id.includes('scene-2-')).every(c=>c.en.includes('keep')&&c.en.endsWith('the promise.')));
 assert(make(verb('provocare'),{chapter,section:'all'}).every(c=>/caus/.test(c.en)&&!c.en.includes('provok')));
}
assert.deepEqual(frameEnglishForms(progressiveSpec(verb('mantenere')),2),['keep','keeps','kept','keeping']);assert.deepEqual(frameEnglishForms(progressiveSpec(verb('mantenere')),2,{legacyExpanded:true}),['maintain','maintains','maintained','maintaining']);
for(const ch of ['past','future','condizionale'])assert(lessonContexts(verb('esagerare'),ch).filter(c=>c.id.includes('reviewed-frame-0')).every(c=>c.en.includes(ch==='past'&&c.role==='ordinary'?'overdid':'overdo')));
assert.match(verb('evitare').usage,/Evita!.*one person.*evitiamo!.*speaker and others/);assert.match(verb('mentire').usage,/Mento is the more frequent.*present indicative and subjunctive.*imperative.*third-person plural.*reference currently gives the mento series/);
assert.equal(verb('rovinare').examples[1].it,'Non rovinare la sorpresa.');assert.equal(verb('rovinare').examples[1].en,"Don't spoil the surprise.");assert(!targets(buildLesson(verb('rovinare'))).some(t=>t.contexts?.some(c=>c.it===verb('rovinare').examples[1].it)),'Reference-only replacement does not create a new graded requirement');
const forms=verbs.map(e=>({id:e.id,cases:['presente','passatoProssimo','imperfetto','futuro','condizionale'].map(k=>conjugate(e.inf,e).tenses[k])}));assert.equal(hash(forms),fixture.coreArraySHA256,'All1186 broad core paradigms unchanged');
const report={status:'passed',pools,retiredOccurrences:retired,uniqueRetiredScenes:retiredIds.size,preservedValidOldSelections:preserved,currentSelections:current,unchangedCoreParadigms:verbs.length};console.log(JSON.stringify(report));
if(process.argv.includes('--report'))fs.writeFileSync(new URL('docs/implementation/programme/verb-repairs-522-checks.json',root),JSON.stringify(report,null,2)+'\n');
