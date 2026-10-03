import assert from 'node:assert/strict';
import {createLanguagePolicy} from '../js/ai/language-policy.js';
import {createGrounding} from '../js/ai/grounding.js';

const source='Independent bounded language-policy fixture, not production coverage';
const sense=(id,level,forms,confirmUse)=>({id,level,verified:true,source,forms:forms.map(([text,level])=>({id:text,text,level})),confirmUse});
const senses=[
 sense('io','A1',[['io','A1']]),sense('study','A1',[['studio','A1'],['studia','A1'],['studierò','B1']]),sense('italian','A1',[['italiano','A1']]),
 sense('il','A1',[['il','A1']]),sense('la','A1',[['la','A1']]),sense('essere','A1',[['è','A1']]),sense('alto','A1',[['alto','A1']]),
 sense('capital-city','A1',[['capitale','A1']],({text})=>text==='La capitale è Roma.'),
 sense('capital-money','B1',[['capitale','B1']],({text})=>text==='Il capitale è alto.'),
 sense('roommate','A2',[['coinquilino','A2'],['coinquilini','A2']]),sense('coffee','A1',[['caffè','A1']]),sense('bere','A1',[['bevo','A1']]),
];
const simple=new Set(['Io studio italiano.','La capitale è Roma.','Il capitale è alto.','Il coinquilino studia.','Io bevo caffè.','Marco studia italiano.','Io studio italiano 2.']);
const constructions=[{id:'present',level:'A1',verified:true,source,confirmUse:({text})=>simple.has(text)},{id:'future',level:'B1',verified:true,source,confirmUse:({text})=>text==='Io studierò italiano.'}];
function analyze(text){
 const lexemes=[],names=[],numbers=[];
 for(const m of text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)){
  const range={start:m.index,end:m.index+m[0].length},lower=m[0].toLowerCase();
  if(['Roma','Marco'].includes(m[0])){names.push(range);continue;}
  if(/^\d+$/.test(m[0])){numbers.push(range);continue;}
  const record=senses.find(s=>s.forms.some(f=>f.text===lower)&&(!s.id.startsWith('capital-')||s.id===(text.startsWith('La')?'capital-city':'capital-money')));
  if(record)lexemes.push({...range,senseId:record.id,formId:lower});
 }
 return {lexemes,names,numbers,constructions:[{id:text.includes('studierò')?'future':'present',start:0,end:text.length}]};
}
const policy=createLanguagePolicy({version:'fixture-v1',senses,constructions,analyze});
const request={level:'A1',scope:'thread:one',sourceRevision:3,knownNames:['Roma'],participants:[{id:'marco',name:'Marco'}]};
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS',name);}
await test('Known simple words and a separately verified construction are accepted',async()=>assert.equal((await policy.validate('Io studio italiano.',{request})).ok,true));
await test('A common lemma cannot authorize an untaught future form',async()=>{
 const low=await policy.validate('Io studierò italiano.',{request});assert.equal(low.ok,false);assert(low.reasons.includes('sense or form exceeds the selected level'));assert(low.reasons.includes('construction exceeds the selected level'));
 assert.equal((await policy.validate('Io studierò italiano.',{request:{...request,level:'B1'}})).ok,true);
});
await test('Identical surfaces retain distinct meaning levels and contextual checks',async()=>{
 assert.equal((await policy.validate('La capitale è Roma.',{request})).ok,true);
 assert.equal((await policy.validate('Il capitale è alto.',{request})).ok,false);
 assert.equal((await policy.validate('Il capitale è alto.',{request:{...request,level:'B1'}})).ok,true);
 const wrong=createLanguagePolicy({version:'wrong-sense-fixture',senses,constructions,analyze:text=>{const result=analyze(text);result.lexemes.find(l=>l.senseId==='capital-money').senseId='capital-city';return result;}});
 assert((await wrong.validate('Il capitale è alto.',{request})).reasons.includes('contextual meaning is unresolved'));
});
const exception={senseId:'roommate',forms:['coinquilino'],scope:request.scope,sourceRevision:3,selectedBy:'learner'};
await test('Identical forms of one sense require independent grammatical identity checks',async()=>{
 // Artificial levels isolate the identity invariant, not an Italian syllabus.
 const speak={id:'speak',level:'A1',verified:true,source,forms:[{id:'present-third',text:'parla',level:'A1'},{id:'command-second',text:'parla',level:'A2'}]};
 const rules=[{id:'command',level:'A1',verified:true,source,confirmUse:({text})=>text==='Parla!'}];
 const make=(record,formId)=>createLanguagePolicy({version:'form-identity-fixture',senses:[record],constructions:rules,analyze:()=>({lexemes:[{senseId:'speak',formId,start:0,end:5}],constructions:[{id:'command',start:0,end:6}]})});
 assert.equal((await make(speak,'present-third').validate('Parla!',{request})).ok,false);
 const verified={...speak,confirmUse:({formId,text})=>formId==='command-second'&&text==='Parla!'};
 assert.equal((await make(verified,'present-third').validate('Parla!',{request})).ok,false);
 assert.equal((await make(verified,'command-second').validate('Parla!',{request})).ok,false);
 assert.equal((await make(verified,'command-second').validate('Parla!',{request:{...request,level:'A2'}})).ok,true);
});
await test('A deliberate new word is scoped to its exact revision and chosen surface',async()=>{
 assert.equal((await policy.validate('Il coinquilino studia.',{request})).ok,false);
 const approved=await policy.validate('Il coinquilino studia.',{request:{...request,wordExceptions:[exception]}});assert.equal(approved.ok,true);assert.deepEqual(approved.exceptionSenseIds,['roommate']);
 for(const patch of [{scope:'thread:other'},{sourceRevision:4},{forms:['coinquilini']},{selectedBy:'model'}])assert.equal((await policy.validate('Il coinquilino studia.',{request:{...request,wordExceptions:[{...exception,...patch}]}})).ok,false);
});
await test('A word exception cannot raise the construction level',async()=>{
 const response=await policy.validate('Io studierò italiano.',{request:{...request,wordExceptions:[{...exception,senseId:'study',forms:['studierò']}]}});
 assert.equal(response.ok,false);assert(response.reasons.includes('construction exceeds the selected level'));
});
await test('Configured names and numeric expressions still require verified sentence structure',async()=>{
 assert.equal((await policy.validate('Marco studia italiano.',{request})).ok,true);
 assert.equal((await policy.validate('Marco studia italiano.',{request:{...request,participants:[]}})).ok,false);
 assert.equal((await policy.validate('Io studio italiano 2.',{request})).ok,true);
 assert.equal((await policy.validate('Marco italiano studia 2.',{request})).ok,false);
});
await test('Unknown words, malformed agreement and missing accents are not certified',async()=>{
 for(const text of ['Io studia italiano.','Io studio klingon.','Io bevo caffe.'])assert.equal((await policy.validate(text,{request})).ok,false,text);
 assert.equal((await policy.validate('Io bevo caffè.',{request})).ok,true);
});
await test('Missing construction proof and overlapping lexical claims fail closed',async()=>{
 for(const mutate of [a=>({...a,constructions:[]}),a=>({...a,lexemes:[...a.lexemes,a.lexemes[0]]})]){
  const bad=createLanguagePolicy({version:'malformed-fixture',senses,constructions,analyze:text=>mutate(analyze(text))});assert.equal((await bad.validate('Io studio italiano.',{request})).ok,false);
 }
});
await test('Registry claims need reviewed sources, form levels and construction verifiers',async()=>{
 assert.throws(()=>createLanguagePolicy({version:'x',senses:[{...senses[0],source:''}],constructions,analyze}));
 assert.throws(()=>createLanguagePolicy({version:'x',senses:[{...senses[0],forms:[{id:'io',text:'io'}]}],constructions,analyze}));
 assert.throws(()=>createLanguagePolicy({version:'x',senses,constructions:[{...constructions[0],confirmUse:null}],analyze}));
});
await test('Grounding word exceptions do not retrieve higher-level grammar rules',async()=>{
 const facts=createGrounding({senses:[{id:'roommate',verified:true,level:'A2',keywords:['coinquilino']}],rules:[{id:'roommate',verified:true,level:'B2',keywords:['coinquilino']}]});
 const scoped={...request,text:'coinquilino',wordExceptions:[exception]};assert.equal(facts.retrieve(scoped).senses.length,1);assert.equal(facts.retrieve(scoped).rules.length,0);
 assert.equal(facts.retrieve({...scoped,sourceRevision:4}).senses.length,0);
 assert.equal(facts.retrieve({...scoped,wordExceptions:[],allowedSenseIds:['roommate']}).senses.length,0);
});
console.log(`${count} bounded language-policy checks passed; no production registry or model enabled.`);
