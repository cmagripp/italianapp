// Whole-course coverage: Italian strings must have local help even while offline.
// Deliberate spelling gaps are fragments, not dictionary words.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSentenceLookup,tokenizeItalianSentence} from '../js/learning/sentence-lookup.js';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url)));
const lookup=createSentenceLookup({vocab:read('data/vocab.json'),verbs:read('data/verbs.json')});
const norm=s=>String(s||'').toLocaleLowerCase('it').replace(/[’‘]/g,"'").trim();
const missing=new Map();let tokens=0,sentences=0;
for(const level of ['Foundations','A1','A2','B1','B2','C1','C2'])for(const l of read('data/course-v2/'+level+'.json').units.flatMap(u=>u.lessons)){
 const glosses=new Set(l.steps.flatMap(s=>[...s.words||[],...s.background||[]]).flatMap(w=>[w.it,w.plural].filter(Boolean).map(s=>norm(s).replace(/^(il |lo |la |gli |le |i |l')/,''))));
 for(const step of l.steps){
  const text=[...step.examples||[]].map(e=>e.it);
  if(step.kind==='words')text.push(...step.words.map(w=>w.it));
  for(const name of ['context','speak','it','model'])if(step[name])text.push(step[name]);
  for(const sentence of text){sentences++;
   for(const t of tokenizeItalianSentence(sentence).filter(t=>t.type==='word')){
    if(sentence[t.start-1]==='_'||sentence[t.end]==='_')continue;
    tokens++;const key=norm(t.text);
    if(glosses.has(key)||lookup(t.text,{sentence}).candidates.length)continue;
    if(!missing.has(key))missing.set(key,{lesson:l.id,sentence});
   }
  }
 }
}
assert.equal(missing.size,0,'Missing authored-course word help: '+JSON.stringify([...missing]));
// Independent morphology checks include ordinary, invariant and literary nouns.
for(const [word,singular,plural] of [['chilo','il chilo','i chili'],['caffè','il caffè','i caffè'],['ascia','l’ascia','le asce'],['organizzatrice','l’organizzatrice','le organizzatrici']]){
 const c=lookup(word,{sentence:singular}).candidates.find(c=>c.pos==='noun');assert(c,word);assert.equal(norm(c.singular),norm(singular));assert.equal(norm(c.plural),norm(plural));
}
console.log(`Course word help: ${tokens} tokens in ${sentences} Italian strings, zero unresolved words.`);
