import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLesson,lessonContexts} from '../js/learning/lesson-content.js';
const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('../docs/implementation/programme/verb-finite-span-prior-pools.json',import.meta.url)));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const targets=plan=>plan.chapters.flatMap(chapter=>chapter.groups.flatMap(group=>group.targets));
const required=plan=>plan.chapters.map(chapter=>({id:chapter.id,targets:chapter.groups.flatMap(group=>group.targets).filter(t=>t.required!==false&&t.available!==false).map(t=>t.id)}));
const removed=[];
for(const entry of verbs)for(const chapter of ['present','past','background','future','condizionale']){
 const current=new Set(lessonContexts(entry,chapter,{expanded:false}).map(c=>c.id));
 for(const old of lessonContexts(entry,chapter,{expanded:false,legacySource:true}))if(!current.has(old.id))removed.push(old.id);
}
assert.deepEqual(removed.sort(),fixture.records.map(record=>record.sourceContext.id).sort(),'The full catalog removes exactly the four declared invalid spans');
let pools=0;
for(const record of fixture.records){
 const entry=verbs.find(entry=>entry.id===record.id),current=buildLesson(entry),prior=buildLesson(entry,{legacyExpanded:true}),ordinary=buildLesson(entry,{legacy:true});
 assert.deepEqual(required(ordinary),record.legacyRequired,'Ordinary v1 completion requirements remain exact');
 for(const chapter of record.chapters){
  assert.deepEqual(current.chapters.find(c=>c.id===chapter.id).legacyRequirements,chapter.legacyRequirements);
  for(const saved of chapter.targets){
   const old=targets(prior).find(t=>t.id===saved.id),fresh=targets(current).find(t=>t.id===saved.id);
   assert.equal(old.contexts.length,saved.poolSize,saved.id);assert.equal(hash(old.contexts),saved.poolSHA256,saved.id);
   assert.equal(hash(fresh.legacyExpandedContexts),saved.poolSHA256,saved.id);assert.equal(hash(fresh.legacyAuthoredContexts),saved.legacyAuthoredSHA256,saved.id);
   pools++;
  }
 }
 for(const t of [...targets(current),...targets(ordinary)]){
  assert.equal(t.sceneRevision,`${entry.inf}-finite-span-2026-10-03-1`);
  assert.equal(t.legacyExpandedRevision,`expanded-v1-before-${entry.inf}-finite-span-2026-10-03-1`);
  assert(t.retiredExpandedContextIds.includes(record.sourceContext.id));
 }
 assert(!targets(current).some(t=>t.contexts?.some(c=>c.id===record.sourceContext.id)));
 const oldTarget=targets(ordinary).find(t=>t.skill==='conjugation'&&t.person===4&&t.tense==='presente');
 assert.deepEqual(oldTarget.legacyAuthoredContexts.find(c=>c.id===record.sourceContext.id),record.sourceContext);
 const currentTarget=targets(current).find(t=>t.id===oldTarget.id);
 assert.deepEqual(currentTarget.legacyExpandedContexts.find(c=>c.id===record.sourceContext.id),record.sourceContext);
 // A real second-person plural finite form stays available. The lexical verb
 // in these samples is personified only to isolate the span/person parser.
 const finite={...entry,examples:[{it:`Voi ${record.sourceContext.answer} qui.`,en:'You all do this here.'}]};
 assert.equal(lessonContexts(finite,'present').find(c=>c.source==='dictionary-exact')?.person,4);
}
for(const inf of ['fiorire','peggiorare','sparire']){
 const entry=verbs.find(e=>e.inf===inf),old=fixture.records.find(r=>r.id===entry.id).sourceContext;
 assert(lessonContexts(entry,'past').some(c=>c.it===old.it&&c.person===5&&c.answer.startsWith('sono ')),'The correct complete past construction is retained');
}
const domandare=verbs.find(e=>e.inf==='domandare'),dCurrent=targets(buildLesson(domandare)),dPrior=targets(buildLesson(domandare,{legacyExpanded:true}));
const unique=list=>[...new Map(list.flatMap(t=>t.contexts||[]).map(c=>[c.id,c])).values()];
const oldQuestions=unique(dPrior).filter(c=>c.it.includes('una domanda'));
assert.equal(oldQuestions.length,49,'Only the old tautological frame is retired');
assert.deepEqual([...dCurrent[0].retiredExpandedContextIds].sort(),oldQuestions.map(c=>c.id).sort());
const currentById=new Map(unique(dCurrent).map(c=>[c.id,c]));
for(const old of oldQuestions){const fresh=currentById.get(old.id);assert(fresh,'The corrected frame retains its target/context identity');assert(fresh.it.includes('a Sara come sta'));assert(!fresh.it.includes('una domanda'));}
assert(dPrior.some(t=>t.contexts?.some(c=>c.it==='Io domando una cosa.')),'Valid older frames remain available for exact recovery');
console.log(`All ${verbs.length} verbs scanned: exactly four invalid bare finite spans excluded; ${pools} full prior pools/order hashes and ordinary legacy requirements preserved. Genuine voi forms and correct compound past contexts remain available. Retired grading/Continue is checked separately by the scene-engine tests.`);
console.log('All 49 exact old domandare frame identities are declared retired; their corrected current models retain those identities, and valid prior frames remain available.');
