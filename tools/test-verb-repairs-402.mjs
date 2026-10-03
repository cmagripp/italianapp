import {priorCoreVectorsWithConcernereException} from './verb-reference-baseline.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLesson,lessonForms,lessonParticiples,lessonContexts} from '../js/learning/lesson-content.js';
import {verbQuestionHistory} from '../js/learning/verb-question-history.js';
import {simpleVerbContexts,progressiveContexts} from '../js/learning/progressive-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {conjugate,TENSES} from '../js/conjugator.js';
const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))),verb=inf=>verbs.find(e=>e.inf===inf);
const fixture=JSON.parse(fs.readFileSync(new URL('../docs/implementation/programme/verb-repairs-402-prior.json',import.meta.url)));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const semanticHash=x=>hash(canonical(x));
const targets=plan=>plan.chapters.flatMap(ch=>ch.groups.flatMap(g=>g.targets));
const required=plan=>plan.chapters.map(ch=>({id:ch.id,targets:ch.groups.flatMap(g=>g.targets).filter(t=>t.required!==false&&t.available!==false).map(t=>t.id)}));
let pools=0,recipes=0,descriptors=0;
for(const record of fixture.records){
 const entry=verb(record.id.slice(2)),plan=buildLesson(entry),prior=buildLesson(entry,{legacyExpanded:true}),ordinary=buildLesson(entry,{legacy:true});
 assert.deepEqual(required(ordinary),record.ordinaryRequired,record.id+' old ordinary requirements');
 const history=verbQuestionHistory(entry.id);
 if(history){
  assert.equal(history.previousRevision,'expanded-v1');assert.equal(history.currentRevision,entry.inf+'-lesson-scope-2026-10-03-1');
  assert.equal(semanticHash(history.chapters),record.expandedTargetVectorsSHA256,record.id+' full expanded target vectors');
  assert.equal(semanticHash(history.ordinaryChapters),record.ordinaryTargetVectorsSHA256,record.id+' full ordinary target vectors');
  assert.deepEqual(history.entry,record.priorEntry);assert.deepEqual(plan.questionHistory.currentEntry,entry);
  assert.doesNotThrow(()=>JSON.stringify(plan),'History attachment has no back-reference cycle');
  assert(plan.retiredTargetDescriptors.every(t=>t.available===false&&t.required===false&&!targets(plan).some(current=>current.id===t.id)));
  const expected=history.chapters.flatMap(ch=>ch.groups.flatMap(g=>g.targets)).filter(t=>entry.inf==='succedere'
   ?(['conjugation','address'].includes(t.skill)&&(![2,5].includes(t.person)||t.role!=='ordinary'||t.tense==='imperativo'))||(t.answerForms||[]).some(form=>/(?:^|\s)succedut[oaie]$/.test(form))
   :(t.answerForms||[]).some(form=>/(?:^|\s)bisognat[ae]$/.test(form))).map(t=>t.id);
  assert.deepEqual(history.retiredFormTargetIds,expected,'Only declared invalid selected-sense form recipes retire');
  assert.equal(expected.length,entry.inf==='succedere'?90:7);assert(!expected.some(id=>id.includes('auxiliary-part')));
  recipes+=history.chapters.flatMap(ch=>ch.groups.flatMap(g=>g.targets)).length+history.ordinaryChapters.flatMap(ch=>ch.groups.flatMap(g=>g.targets)).length;
 }
 for(const oldChapter of record.chapters)for(const old of oldChapter.targets){
  const chapter=prior.chapters.find(ch=>ch.id===oldChapter.id),t=targets(prior).find(t=>t.id===old.id);
  assert(t,old.id);assert.equal(t.contexts?.length||0,old.poolSize);assert.equal(hash(t.contexts||[]),old.poolSHA256,old.id);pools++;
  // Audit fingerprints keep the prior prompt bank out of the committed
  // inventory. Runtime recovery regenerates only trusted source recipes.
  for(const [variant,descriptorSHA256]of old.formQuestionDescriptorSHA256.entries())if(descriptorSHA256){
   const q=buildJourneyQuestion(history?.entry||record.priorEntry,chapter,t,{variant,format:'type',phase:'independent',scenePolicy:'expanded-v1',historicalForms:!!history});
   assert(q,old.id);assert.equal(hash({contextId:q.meta.contextId,variantId:q.meta.variantId,answers:q.answer,prompt:q.prompt,say:q.say}),descriptorSHA256,old.id+' prior form cue '+variant);descriptors++;
  }
 }
 if(entry.inf==='toccare')assert.deepEqual(required(plan),record.expandedRequired,'Broad form requirements stay unchanged; this does not establish construction-specific meaning');
}
const succedere=verb('succedere'),bisognare=verb('bisognare');
for(const tense of TENSES.map(t=>t.key))for(let p=0;p<6;p++){
 const happen=lessonForms(succedere,tense,p),necessary=lessonForms(bisognare,tense,p);
 assert(!happen.some(form=>/succedut/.test(form)));assert(!necessary.some(form=>/bisognat[ae]$/.test(form)));
 if(![2,5].includes(p)||tense==='imperativo')assert.deepEqual(happen,[]);
 if(p!==2||tense==='imperativo')assert.deepEqual(necessary,[]);
}
assert.deepEqual(lessonParticiples(succedere),['successo']);assert.deepEqual(lessonParticiples(bisognare),['bisognato']);
for(const entry of [succedere,bisognare]){
 const plan=buildLesson(entry),forms=targets(plan).filter(t=>['conjugation','address'].includes(t.skill));
 assert(forms.every(t=>t.role==='ordinary'&&[2,5].includes(t.person)));assert(!forms.some(t=>t.tense==='imperativo'));
 const past=plan.chapters.find(ch=>ch.id==='past'),notes=past.groups.find(g=>g.id==='building').cards.flatMap(c=>c.notes||[]).join(' ');
 assert(!notes.includes('ending follows the addressee'));
 assert.match(notes,entry.inf==='succedere'?/agree with the event/:/no personal subject.*masculine singular/);
 assert.equal(past.groups.find(g=>g.id==='singular').title,entry.inf==='succedere'?'One event or situation':'Impersonal necessity');
}
for(const inf of ['trattarsi','volerci','addirsi','prudere','urgere','vigere','rincrescere','spettare','verificarsi','concernere']){
 const t=targets(buildLesson(verb(inf))).find(t=>t.id.endsWith('::past::auxiliary-part'));
 assert.equal(t.person,0);assert.equal(t.available,false,'Unreviewed impersonal auxiliary targets are not newly enabled');
}
const crollare=verb('crollare'),crollarePlan=buildLesson(crollare),crollarePrior=simpleVerbContexts(crollare,{chapter:'background',section:'all',legacyExpanded:true});
assert(crollarePrior.every(c=>c.en.includes('used to collapse')));
const collapse=simpleVerbContexts(crollare,{chapter:'background',section:'all'});
assert(collapse.filter(c=>c.person===2).every(c=>c.en.startsWith('The wall was collapsing ')));
assert(collapse.filter(c=>c.person===5).every(c=>c.en.startsWith('The walls were collapsing ')));
const retired=targets(crollarePlan)[0].retiredExpandedContextIds;
assert.equal(retired.length,4);assert(retired.every(id=>/background:v2:simple:scene-[0-3]-2-ordinary$/.test(id)));
const curarsi=verb('curarsi');
for(const chapter of ['present','background']){
 const current=[...simpleVerbContexts(curarsi,{chapter,section:'all'}),...progressiveContexts(curarsi,{chapter,section:'all'})];
 assert(current.every(c=>!c.en.includes('seek')&&c.en.includes('treatment')));
 assert(simpleVerbContexts(curarsi,{chapter,section:'all',legacyExpanded:true}).every(c=>c.en.includes('seek')||c.en.includes('sought')));
}
assert.equal(curarsi.examples[0].it,'Se ti curerai in ospedale, porterò io la tua valigia.');
assert(!['present','past','background','future','condizionale'].flatMap(ch=>lessonContexts(curarsi,ch)).some(c=>c.it===curarsi.examples[0].it),'Neutral reference example does not silently expand active source pools');
assert(!targets(buildLesson(curarsi))[0].retiredExpandedContextIds?.length,'Treatment wording refinement preserves valid prior questions');
const core=verbs.map(e=>({id:e.id,cases:['presente','passatoProssimo','imperfetto','futuro','condizionale'].map(k=>conjugate(e.inf,e).tenses[k])}));
assert.equal(hash(priorCoreVectorsWithConcernereException(core)),fixture.baselineReferenceCasesSHA256,'All1185 other broad five-case paradigms remain exact; concernere explicit reference exception');
console.log(`${pools} old context pools/order, ${recipes} full prior target vectors, ${descriptors} captured form cues and all ordinary saved requirements preserved.`);
console.log('Exact selected-sense retirement declarations (90 + 7), five bounded linguistic changes, and 1185 other broad core paradigms and the explicit concernere reference exception pass. Controller recovery/human review are separate gates.');
