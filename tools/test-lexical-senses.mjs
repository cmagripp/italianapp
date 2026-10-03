import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {applyEditorialSenses} from './lexical-senses.mjs';
import {withArticle,loadData,data,search,getEntry,getSense,entrySenses} from '../js/data.js';
import {createSentenceLookup} from '../js/learning/sentence-lookup.js';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const registry=read('data/lexical-senses/vocab.json'),frequency=read('data/lexical-senses/frequency.json'),vocab=read('data/vocab.json'),byId=new Map(vocab.map(e=>[e.id,e]));
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS',name);};
check('Every authored sense has an explicit stable identity, level, forms and provenance',()=>{
 assert.equal(registry.entries.length,7);
 assert.equal(frequency.entries.length,20);assert.equal(frequency.entries.flatMap(g=>g.senses).length,43);
 assert.equal(vocab.filter(e=>e.senseId).length,57);
 const review=read('docs/implementation/programme/frequency-sense-independent-review.json');
 assert.equal(createHash('sha256').update(JSON.stringify(frequency.entries)).digest('hex'),review.registryEntriesSHA256,'Activated entries exactly match independent review');
 for(const group of [...registry.entries,...frequency.entries]){
  const parent=byId.get(group.entryId);assert(parent.legacyGrouping);
  assert.equal(parent.senseEntryIds.length,group.senses.length);
  for(const source of group.senses){const child=byId.get(`${group.entryId}#${source.key}`);
   assert(child&&child.parentEntryId===parent.id);assert.equal(child.sense.entryId,parent.id);
   assert.equal(child.level,source.level);assert.equal(child.pl,source.pl);assert.equal(child.g,source.g);
   assert(child.sense.provenance.sources.length);assert.equal(child.sense.provenance.reviewStatus,'independent-agent-review');
  }
 }
});
check('Sense splits preserve earlier lexical content and do not derive IDs from English',()=>{
 const base={id:'w:pesca|noun',it:'pesca',en:'fishing',level:'B1',g:'f',pl:'-',pos:'noun',cat:'sports',ex:'Vado a pesca.'};
 const fixture={...registry,entries:registry.entries.filter(e=>e.entryId===base.id)};
 const result=applyEditorialSenses([structuredClone(base)],fixture),{legacyGrouping,senseEntryIds,...old}=result[0];
 assert.deepEqual(old,base);assert(legacyGrouping);
 const copy=structuredClone(fixture);copy.entries[0].senses[0].en='a peach';
 assert.deepEqual(applyEditorialSenses([structuredClone(base)],copy).map(e=>e.id),result.map(e=>e.id));
 assert.throws(()=>applyEditorialSenses([structuredClone(base)],{...fixture,entries:[...fixture.entries,...fixture.entries]}),/Duplicate sense/);
});
check('Common meanings retain different genders and number behavior from specialist meanings',()=>{
 assert.equal(withArticle(byId.get('w:capitale|noun#capital-city')),'la capitale');
 assert.equal(withArticle(byId.get('w:capitale|noun#financial-capital')),'il capitale');
 assert.equal(withArticle(byId.get('w:pesca|noun#peach'),true),'le pesche');
 assert.equal(byId.get('w:pesca|noun#fishing').pl,'-');
 assert.equal(withArticle(byId.get('w:calcio|noun#kick'),true),'i calci');
 assert.equal(byId.get('w:calcio|noun#football').pl,'-');
 assert.equal(byId.get('w:macchia|noun').level,'C2');
 assert.equal(byId.get('w:macchia|noun#stain').level,'A2');
 assert.equal(byId.get('w:mora|noun#blackberry').cat,'food');
});
check('All duplicate sources are reported, including same-level collisions',()=>{
 const report=read('docs/implementation/programme/lexical-collisions.json');
 assert.equal(report.collisions.length,935);
 const yes=report.collisions.find(row=>row.entryId==='w:sì|adv');assert(yes.equalLevel);assert(yes.records.length>=2);
 const mora=report.collisions.find(row=>row.entryId==='w:mora|noun');assert.equal(mora.status,'editorial-split');assert.equal(mora.records.length,2);
 for(const row of report.collisions)for(const source of row.records){const originals=read(source.file);assert.deepEqual(originals[source.index],source.record);}
});
const originalFetch=globalThis.fetch;
globalThis.fetch=async path=>({ok:true,json:async()=>read(path)});
try{await loadData();}finally{globalThis.fetch=originalFetch;}
check('New discovery searches senses, while old links and legacy review IDs still resolve',()=>{
 assert(!data.vocab.some(e=>e.legacyGrouping));assert(getEntry('w:pesca|noun').legacyGrouping);
 for(const [q,id] of [['peach','w:pesca|noun#peach'],['blackberry','w:mora|noun#blackberry'],['stain','w:macchia|noun#stain'],['capital city','w:capitale|noun#capital-city']])assert.equal(search(q)[0].id,id);
 assert.equal(entrySenses('w:pesca|noun#peach').length,2);
 assert.equal(getSense('it:pesca:noun:peach').entryId,'w:pesca|noun');
});
check('Sentence lookup preserves contextual sense choices and their correct noun forms',()=>{
 const lookup=createSentenceLookup({vocab:data.vocab,verbs:[]});
 const result=lookup('capitale',{sentence:"Roma è la capitale d'Italia.",senseId:'it:capitale:noun:capital-city'});
 assert.equal(result.candidates[0].senseId,'it:capitale:noun:capital-city');
 assert.equal(result.status,'ambiguous','a supplied preference is not invented disambiguation evidence');
 assert(result.candidates.some(c=>c.id==='w:capitale|noun#financial-capital'));
});
console.log(`${passed} lexical-sense checks passed.`);
