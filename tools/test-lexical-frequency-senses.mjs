#!/usr/bin/env node
// Independent integration checks for the exact editorial source/meaning batch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {applyEditorialSenses} from './lexical-senses.mjs';
import {frequencySenses} from './lexical-frequency-senses.mjs';
import {validateVocab} from './validate.mjs';
import {data,article,isPluralOnly,hasPluralForm} from '../js/data.js';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildShortWordQuestion} from '../js/learning/word-questions.js';
import {gradePairActivity} from '../js/learning/lesson-activities.js';
import {createLearning,recordAttempt,skillState,completionRecord,setCompletionRecord,normalizeLearning} from '../js/learning/model.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url)));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const frequency=read('data/lexical-senses/frequency.json'),review=read('docs/implementation/programme/frequency-sense-independent-review.json');
const generated=read('data/vocab.json'),byId=new Map(generated.map(e=>[e.id,{...e,kind:'word'}])),active=[...byId.values()].filter(e=>!e.legacyGrouping);
data.vocab=active;data.byId=byId;
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
check('All 43 exact authored children match every independently reviewed field and fingerprint',()=>{
 assert.equal(frequency.entries.length,20);assert.equal(frequency.entries.flatMap(g=>g.senses).length,43);
 assert.deepEqual(frequency.entries,frequencySenses);assert.equal(hash(frequency.entries),review.registryEntriesSHA256);
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+review.sourceFile,import.meta.url))).digest('hex'),review.sourceFileSHA256);
 for(const group of frequency.entries)for(const sense of group.senses){
  const id=group.entryId+'#'+sense.key,record=review.records.find(r=>r.childId===id);assert(record,id);assert.deepEqual(sense,record.fields);assert.equal(hash(sense),record.fieldsSHA256);
  const child=byId.get(id);assert(child,id);assert.deepEqual(validateVocab([child],id),[]);
  for(const key of review.reviewedFields.filter(key=>!['key','sources'].includes(key)))assert.deepEqual(child[key],sense[key],id+' '+key);
  assert.deepEqual(child.sense.provenance.sources,sense.sources);assert.equal(child.sense.provenance.reviewStatus,'independent-agent-review');
 }
});
check('The exact batch preserves original parents and keeps English edits out of stable identities',()=>{
 const parents=frequency.entries.map(g=>{const {legacyGrouping,senseEntryIds,...parent}=byId.get(g.entryId);delete parent.kind;return parent;});
 const result=applyEditorialSenses(structuredClone(parents),frequency);
 for(const parent of parents){const {legacyGrouping,senseEntryIds,...retained}=result.find(e=>e.id===parent.id);assert.deepEqual(retained,parent);assert(legacyGrouping);assert(senseEntryIds.length>=2);}
 const changed=structuredClone(frequency);changed.entries[0].senses[0].en='updated English wording';
 assert.deepEqual(applyEditorialSenses(structuredClone(parents),changed).map(e=>[e.id,e.senseId]),result.map(e=>[e.id,e.senseId]));
});
check('Legacy parent completion, article evidence and XP never become child proof during normalization',()=>{
 for(const group of frequency.entries){
  let learning=createLearning(1);learning=setCompletionRecord(learning,{entryId:group.entryId,caseId:'word',checked:true,id:'old-parent-check',at:2,source:'manual'});
  learning=recordAttempt(learning,{id:'old-parent-article',epochId:learning.epoch.id,sessionId:'old-parent-session',index:0,entryId:group.entryId,objectiveId:group.entryId+'::word::article',kind:'word',skill:'article',mode:'recognition',at:3,ok:true,outcome:'correct',firstAttempt:true,assistance:[],xp:2}).learning;
  const normalized=normalizeLearning(learning);assert.equal(normalized.events['old-parent-article'].xp,2);assert(completionRecord(normalized,group.entryId,'word').checked);
  for(const sense of group.senses){const childId=group.entryId+'#'+sense.key;assert.equal(completionRecord(normalized,childId,'word'),null);
   for(const target of buildLesson(byId.get(childId)).chapters.flatMap(c=>c.groups.flatMap(g=>g.targets))){const state=skillState(normalized,target.id);assert.equal(state.ready,false);assert.equal(state.independentCorrect,0);assert.equal(state.due,0);}
  }
 }
});
check('Every new meaning has exact source context, supported recognition and whole-sentence playback on its noun board',()=>{
 let boards=0;
 for(const group of frequency.entries)for(const sense of group.senses){
  const entry=byId.get(group.entryId+'#'+sense.key),plan=buildLesson(entry),targets=plan.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets)),slot=plan.wordLesson.slots.find(s=>s.format==='pairs');
  if(!slot)continue;
  const target={...targets.find(t=>t.id===slot.targetId),wordPairTargets:slot.pairTargetIds.map(id=>targets.find(t=>t.id===id))};
  const board=buildShortWordQuestion(entry,target,{format:'pairs',pool:active});assert.equal(board.type,'pairs',entry.id);boards++;
  assert.equal(board.context.it,entry.ex);assert.equal(board.say,entry.ex);assert(board.prompt.includes(entry.ex.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')));
  assert.equal(board.meta.supportOnly,true);assert.equal(board.meta.evidenceMode,'recognition');
  for(const row of board.pairs.filter(p=>!p.decoy)){
   assert.equal(row.meta.entryId,entry.id);assert.equal(row.meta.mode,'recognition');assert.equal(row.meta.supportOnly,true);assert(row.targetId.startsWith(entry.id+'::'));
   const plural=row.meta.skill==='plural'||isPluralOnly(entry),expectedForm=plural?entry.pl:entry.it;
   assert.equal(row.canonical,expectedForm);assert.equal(row.label,article(entry,plural));assert.equal(gradePairActivity(board,{targetId:row.targetId,given:expectedForm}).ok,true);
  }
 }
 assert(boards>=35,'Most newly authored countable and plural-only nouns exercise their real pair boards');
});
check('Gender-changing and plural-only homographs retain their own article/form identities',()=>{
 const own=id=>{const e=byId.get(id),plan=buildLesson(e),targets=plan.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets)),slot=plan.wordLesson.slots.find(s=>s.format==='pairs'),t={...targets.find(t=>t.id===slot.targetId),wordPairTargets:slot.pairTargetIds.map(id=>targets.find(t=>t.id===id))};return buildShortWordQuestion(e,t,{format:'pairs',pool:active}).pairs.filter(p=>!p.decoy).map(p=>[p.label,p.canonical,p.meta.entryId]);};
 assert.deepEqual(own('w:capitale|noun#capital-city').map(r=>r.slice(0,2)),[['la','capitale'],['le','capitali']]);
 assert.deepEqual(own('w:capitale|noun#financial-capital').map(r=>r.slice(0,2)),[['il','capitale'],['i','capitali']]);
 assert(isPluralOnly(byId.get('w:media|noun#mass-media')));assert(hasPluralForm(byId.get('w:media|noun#mass-media')));
 assert.deepEqual(own('w:media|noun#mass-media').map(r=>r.slice(0,2)),[['i','media']]);
 assert.deepEqual(own('w:media|noun#average').map(r=>r.slice(0,2)),[['la','media'],['le','medie']]);
});
check('Pinned inventory keeps exact residual scope and never grants blanket semantic approval',()=>{
 const report=read('docs/implementation/programme/lexical-collision-review.json');assert.equal(report.scope.inventoryGroups,935);assert.equal(report.scope.sourceRecords,2004);
 assert.equal(report.rows.length,935);assert(report.rows.every(r=>r.semanticApproval===false));assert.equal(report.scope.activeSplitParents,27);assert.equal(report.scope.activeSplitChildren,57);
 assert.equal(report.scope.activeSplitParentsInInventory,21);assert.equal(report.scope.unsplitInventoryGroups,914);assert.equal(report.rows.filter(r=>r.authoredChildrenReview).length,20);
 assert.equal(report.rows.filter(r=>r.classification==='source-conflict').length,11);assert.equal(Object.values(report.counts).reduce((a,b)=>a+b,0),935);
});
console.log(`${checks} independent frequency-sense integration checks passed.`);
