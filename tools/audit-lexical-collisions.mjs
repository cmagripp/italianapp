#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {reviewedInventorySHA256,distinctAttested,broadGloss,relatedContext,sourceConflict} from './lexical-collision-decisions.mjs';
import {frequencySenses} from './lexical-frequency-senses.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const inventory=read('docs/implementation/programme/lexical-collisions.json');
const pinned=inventory.collisions.map(({headword,entryId,equalLevel,records})=>({headword,entryId,equalLevel,records}));
assert.equal(hash(pinned),reviewedInventorySHA256,'Inventory changed: do not extend manual semantic decisions to unseen/changed records. Re-review and explicitly repin.');
assert.equal(pinned.length,935);assert.equal(pinned.reduce((n,c)=>n+c.records.length,0),2004);
const bucket=new Map(),register=(keys,classification)=>keys.forEach(k=>{assert(!bucket.has(k),'Duplicate manual decision '+k);assert(pinned.some(c=>c.headword===k),'Unknown manual headword '+k);bucket.set(k,classification);});
register(Object.keys(distinctAttested),'distinct-attested');register(broadGloss,'broad-gloss-needs-disambiguation');register(Object.keys(relatedContext),'related-context-variation');register(Object.keys(sourceConflict),'source-conflict');
const registry=read('data/lexical-senses/vocab.json'),frequency=read('data/lexical-senses/frequency.json'),independent=read('docs/implementation/programme/frequency-sense-independent-review.json');
assert.equal(hash(frequency.entries),independent.registryEntriesSHA256,'Frequency meanings changed since independent review');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,independent.sourceFile))).digest('hex'),independent.sourceFileSHA256,'Reviewed authored source changed');
assert.deepEqual(frequency.entries,frequencySenses);
const authoredGroups=[...registry.entries,...frequency.entries],generated=new Map(read('data/vocab.json').map(e=>[e.id,e]));
const activeGroups=authoredGroups.filter(g=>generated.get(g.entryId)?.legacyGrouping&&g.senses.every(s=>generated.get(`${g.entryId}#${s.key}`)?.parentEntryId===g.entryId));
const activeSplits=new Set(activeGroups.map(e=>e.entryId)),proposed=new Set(frequencySenses.map(e=>e.entryId));
const files=new Map();
const rows=pinned.map(c=>{
 const classification=bucket.get(c.headword)||'same-attested-sense';
 for(const r of c.records){if(!files.has(r.file))files.set(r.file,read(r.file));assert.deepEqual(files.get(r.file)[r.index],r.record,`${c.entryId}: source ${r.file}:${r.index} drifted`);}
 const active=activeSplits.has(c.entryId),candidate=proposed.has(c.entryId);
 const reason=distinctAttested[c.headword]||relatedContext[c.headword]||sourceConflict[c.headword]||(classification==='broad-gloss-needs-disambiguation'?'The supplied Italian examples share an attested usage, but the broader English gloss/notes promise further meanings or functions without a distinct prepared example. No equivalence or readiness is inferred for those extra senses.':'Manual contrast reading found the examples refer to the same attested lexical meaning. Different level, register, situation, English synonym or grammatical person does not itself establish a new meaning. This is a bounded example-level classification, not approval of every gloss, form, factual statement or possible sense.');
 return {entryId:c.entryId,headword:c.headword,sourceFingerprint:hash(c.records),classification,reason,
  semanticApproval:false,reviewScope:'All source English glosses and Italian examples contrasted manually; source translations/notes retained as evidence, not globally approved.',
  nativeItalianEducatorReview:'pending',
  resolution:active?'active-editorial-split':candidate?'independently-reviewed-split-awaiting-runtime-activation':classification==='same-attested-sense'?'retain-attested-contexts':classification==='related-context-variation'?'retain-with-context-variation-review':'needs-authoring-or-source-correction',
  ...(candidate?{authoredChildrenReview:'independent-agent-pass-for-exact-authored-fields',authoredChildrenReviewRecord:'docs/implementation/programme/frequency-sense-independent-review.json',authoredChildrenReviewFingerprint:independent.registryEntriesSHA256}:{}),
  sourceRecords:c.records.map(r=>({file:r.file,index:r.index,recordFingerprint:hash(r.record),level:r.record.level,en:r.record.en,it:r.record.ex,exEn:r.record.exEn,gender:r.record.g,plural:r.record.pl,note:r.record.note})),
  formVariation:new Set(c.records.map(r=>JSON.stringify([r.record.g,r.record.pl]))).size>1,
  proposedSenseEntryIds:candidate?frequencySenses.find(e=>e.entryId===c.entryId).senses.map(s=>`${c.entryId}#${s.key}`):[],
  activeSenseEntryIds:active?activeGroups.find(e=>e.entryId===c.entryId).senses.map(s=>`${c.entryId}#${s.key}`):[]};
});
const counts={};for(const r of rows)counts[r.classification]=(counts[r.classification]||0)+1;
const report={schemaVersion:1,reviewDate:'2026-10-03',reviewer:'independent learning workstream agent',inventoryFingerprint:reviewedInventorySHA256,
 method:'Manual contrasting of every supplied English gloss and Italian example, then explicit exception decisions. No string equality/similarity grants semantic approval. Frozen source fingerprints reject unseen or changed content.',
 scope:{inventoryGroups:rows.length,sourceRecords:2004,activeSplitParents:activeGroups.length,activeSplitChildren:activeGroups.reduce((n,e)=>n+e.senses.length,0),activeSplitParentsInInventory:rows.filter(r=>r.activeSenseEntryIds.length).length,activeSplitParentsOutsideInventory:activeGroups.filter(e=>!pinned.some(c=>c.entryId===e.entryId)).map(e=>e.entryId),unsplitInventoryGroups:rows.filter(r=>!r.activeSenseEntryIds.length).length,authoredFrequencyParents:frequencySenses.length,authoredFrequencyChildren:frequencySenses.reduce((n,e)=>n+e.senses.length,0)},
 counts,
 gates:{classification:'complete-for-pinned-gloss-and-Italian-example-inventory',fullSemanticApproval:'not-claimed',nativeItalianEducatorReview:'pending',learnerCalibration:'pending',completeTranslationsFormsAndNotesReview:'not-claimed',individualVerbLinguisticReview:'1185 retained verb records still require individual linguistic review; the separately added riavere has a bounded source/form review. Journey traversal is runtime coverage only.'},
 sourceChecks:{
  'locazione|noun':['https://www1.agenziaentrate.gov.it/sites/campania/files/public/downloads/Richiesta%20semplificata%20servizi%20per%20covid/istruzioni%20modello%20RLI.pdf'],
  'caparra|noun':['https://www.treccani.it/vocabolario/caparra/'],
  'cospicuo|adj':['https://www.treccani.it/vocabolario/cospicuo/'],
  'disinformazione|noun':['https://www.treccani.it/vocabolario/disinformazione/'],
  'idiosincrasia|noun':['https://www.treccani.it/vocabolario/idiosincrasia/']},
 rows};
fs.writeFileSync(path.join(root,'docs/implementation/programme/lexical-collision-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scope:report.scope,counts}));
