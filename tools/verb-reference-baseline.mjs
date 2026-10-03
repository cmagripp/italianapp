// Keep old checkpoint invariants exact while making one explicitly sourced
// defective-reference repair visible. No other entry/vector is projected.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {conjugate,MISSING} from '../js/conjugator.js';
const before=JSON.parse(fs.readFileSync(new URL('../docs/implementation/programme/verb-repairs-764-prior.json',import.meta.url))).concernereBefore;
export function priorCoreVectorsWithConcernereException(vectors){
 const current=conjugate('concernere',{aux:'avere'});
 assert.equal(current.nonFinite.participioPassato,MISSING);
 assert.deepEqual(current.tenses.passatoRemoto,Array(6).fill(MISSING));
 assert.deepEqual(current.tenses.passatoProssimo,Array(6).fill(MISSING));
 for(const key of ['presente','imperfetto','futuro','condizionale'])assert.deepEqual(current.tenses[key],before.tenses[key]);
 const old=vectors.find(v=>v.id==='v:concernere');assert(old);
 assert.deepEqual(old.cases[1],Array(6).fill(MISSING));
 assert.deepEqual(before.tenses.passatoProssimo,['ho concernuto','hai concernuto','ha concernuto','abbiamo concernuto','avete concernuto','hanno concernuto']);
 return vectors.map(v=>v.id==='v:concernere'?{...v,cases:v.cases.map((value,index)=>index===1?before.tenses.passatoProssimo:value)}:v);
}
