import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),read=path=>JSON.parse(fs.readFileSync(new URL(path,root))),digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const ledger=read('docs/implementation/programme/verb-language-reviews.json'),inventory=read('docs/implementation/programme/verb-language-inventory.json');
const current=execFileSync(process.execPath,['tools/inventory-phase6-verb-language.mjs','--view','--from','0','--count','1186'],{cwd:root,maxBuffer:100*1024*1024,encoding:'utf8'}).trim().split('\n').map(JSON.parse);
assert.equal(current.length,1186);assert.equal(ledger.records.length,892);assert.deepEqual(ledger.records.map(record=>record.index),Array.from({length:892},(_,i)=>i));
assert.equal(new Set(ledger.records.map(record=>record.id)).size,892);
assert.deepEqual(ledger.coverage,{individuallyRead:892,from:0,through:891,total:1186,unread:294,allGeneratedContextsRead:0});
assert.equal(ledger.reviewedRange.records,892);assert.equal(ledger.reviewedRange.remainingUnrecorded,294);
for(const evidence of ledger.evidence){
 assert.equal(digest(fs.readFileSync(new URL(evidence.record,root))),evidence.sha256,evidence.record+' exact reviewer evidence');
 assert.equal(evidence.range[1]-evidence.range[0]+1,evidence.records);
}
const namedRepairs=new Set(read('docs/implementation/programme/verb-repairs-764.json').records.map(record=>record.id));
const revisionIds=new Set();let sampleIds=0;
for(const record of ledger.records){
 const raw=current[record.index];assert.equal(raw.id,record.id);
 for(const key of ['sourceSHA256','policySHA256','compiledSHA256','nonFiniteSHA256'])assert.equal(record[key],raw[key],record.id+' '+key+' reviewed current source');
 assert.equal(record.scope.allRenderedContexts,false);assert.equal(record.scope.allQuestions,false);assert.equal(record.scope.nativeHuman,false);
 assert(Array.isArray(record.reviewedSampleIds));assert.equal(new Set(record.reviewedSampleIds).size,record.reviewedSampleIds.length);sampleIds+=record.reviewedSampleIds.length;
 const availableIds=new Set(raw.cases.flatMap(row=>row.samples.map(sample=>sample.id)));
 for(const id of record.reviewedSampleIds)assert(availableIds.has(id),record.id+' exact declared representative identity');
 if(record.readEvidence)assert.equal(digest(fs.readFileSync(new URL(record.readEvidence.record,root))),record.readEvidence.sha256);
 if(record.fingerprintRevision){
  revisionIds.add(record.id);assert.equal(record.fingerprintRevision.wholeCatalogueApproval,false);
  assert(record.fingerprintRevision.changedFields.length);assert(record.fingerprintRevision.proof.every(path=>fs.existsSync(new URL(path,root))));
  for(const field of record.fingerprintRevision.changedFields)assert.notEqual(record.fingerprintRevision.previousReadFingerprints[field],record[field]);
  assert(namedRepairs.has(record.id)||['v:entrarci','v:cascarci','v:restarci','v:uscirne','v:volerci'].includes(record.id),'Only separately declared field revisions can update review pins');
 }
}
assert.equal(revisionIds.size,22);assert.equal(sampleIds,12851);assert.equal(ledger.representativeCoverage.distinctDeclaredIds,sampleIds);
assert.equal(inventory.summary.currentScopedAgentReviews,892);assert.equal(inventory.summary.fullRenderedContextReviews,0);
assert.equal(current.slice(892).filter(record=>record.review.currentFingerprint).length,0,'Later scratch reads must not silently enter this bounded checkpoint');
assert.equal(ledger.gates.nativeHumanItalianReview,'pending');assert.equal(ledger.gates.allGeneratedContextsAndQuestions,'pending');
console.log(JSON.stringify({status:'passed',readRecords:892,unreadRecords:294,explicitFingerprintRevisions:22,declaredRepresentativeIds:sampleIds,fullGeneratedQuestionApproval:false,nativeHumanReview:'pending'}));
