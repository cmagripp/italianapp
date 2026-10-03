// Index/replay equivalence, lossless checkpoint recovery, and desktop timings.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createLearning,normalizeLearning,recordAttempt,allSkills,skillState,mergeLearning,resetLearning,setCompletionRecord,checkpointLearning,learningIndexStats,LEARNING_VERSION} from '../js/learning/model.js';
const START=1700000000000,clone=x=>JSON.parse(JSON.stringify(x));
const attempt=(n,patch={})=>({id:'index:'+n,epochId:'initial',deviceId:'synthetic-a',sequence:n,sessionId:'session:'+Math.floor(n/100),index:n%100,at:START+n,
  entryId:'w:synthetic-'+n%1000,objectiveId:'w:synthetic-'+n%1000+'::word::recall',kind:'word',skill:'recall',tense:null,person:null,
  mode:n%3?'production':'recognition',variantId:'variant:'+n%7,contextId:'scene:'+n%11,ok:n%13!==0,outcome:n%13===0?'incorrect':'correct',
  assistance:n%17===0?['hint']:[],firstAttempt:true,errorTags:n%13===0?['recall']:[],components:[],xp:n%13===0?0:2,...patch});
const make=n=>{const raw=createLearning(START);for(let i=0;i<n;i++){const e=attempt(i);raw.events[e.id]=e;}return normalizeLearning(raw,START);};
const independentReplay=domain=>allSkills(normalizeLearning(clone(domain),START),START+86400e3);
const compare=domain=>assert.deepEqual(allSkills(domain,START+86400e3),independentReplay(domain));
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('✓',name);};
test('ordered append normalizes one new event and preserves the earlier immutable domain',()=>{
  const old=make(300);allSkills(old,START);const before=learningIndexStats(),snapshot=clone(old);
  const result=recordAttempt(old,attempt(300));const after=learningIndexStats();
  assert.equal(after.normalizedEvents-before.normalizedEvents,1);assert.equal(after.builds-before.builds,0);
  assert.equal(after.appends-before.appends,1);assert.deepEqual(old,snapshot);compare(result.learning);compare(old);
});
test('forks appending the same event ID keep independent positions and uncached summaries',()=>{
  const base=make(300);skillState(base,'unrelated',START);
  const a=recordAttempt(base,attempt(300,{id:'fork:shared',sessionId:'session:2',index:100,objectiveId:'focus:branch'})).learning;
  const b0=recordAttempt(base,attempt(301,{id:'fork:spacer',sessionId:'other-session',index:0,objectiveId:'other:branch'})).learning;
  const b=recordAttempt(b0,attempt(302,{id:'fork:shared',sessionId:'other-session',index:1,objectiveId:'focus:branch'})).learning;
  compare(a);compare(b);compare(base);
  assert.equal(skillState(a,'focus:branch',START).firstCorrectPosition,300);
  assert.equal(skillState(b,'focus:branch',START).firstCorrectPosition,301);
});
test('interleaved objectives retain session spacing and chronology after multiple appends',()=>{
  let learning=make(200);for(let i=200;i<260;i++)learning=recordAttempt(learning,attempt(i,{sessionId:'interleaved',index:i-200,objectiveId:'focus:'+i%3,entryId:'w:focus',variantId:'fresh:'+i})).learning;
  compare(learning);
});
test('backdated and index-reordered arrivals rebuild to the same deterministic summaries',()=>{
  let learning=make(300);allSkills(learning,START);learning=recordAttempt(learning,attempt(900,{at:START+20,sessionId:'session:0',index:1})).learning;
  compare(learning);learning=recordAttempt(learning,attempt(901,{at:START+901,sessionId:'session:0',index:0})).learning;compare(learning);
});
test('repeated import and concurrent device merge remain commutative and replay equivalent',()=>{
  const base=make(200),a=recordAttempt(base,attempt(201)).learning,b=recordAttempt(base,attempt(202,{deviceId:'synthetic-b'})).learning;
  const merged=mergeLearning(a,b,START);compare(merged);assert.deepEqual(merged,mergeLearning(b,a,START));
  assert.deepEqual(mergeLearning(merged,clone(base),START),merged);
});
test('checkpoint round trip retains every event, aliases, manual unchecks and actual summaries',()=>{
  const base=setCompletionRecord(make(400),{entryId:'w:synthetic-1',caseId:'word',id:'manual-uncheck',checked:false,at:START+401,source:'manual'});
  const compact=checkpointLearning(base,START),loaded=normalizeLearning(clone(compact),START),before=learningIndexStats();
  compare(loaded);assert.ok(learningIndexStats().checkpointHits>before.checkpointHits);
  assert.deepEqual(compact.events,base.events);assert.deepEqual(compact.completions,base.completions);
  assert.equal(compact.version,LEARNING_VERSION);assert.ok(compact.checkpoint.orderedIds.length===400);
});
test('tampered, incomplete and unknown checkpoints fail back to retained event replay',()=>{
  const original=checkpointLearning(make(400),START);
  for(const mutate of [x=>x.checkpoint.summaries[Object.keys(x.checkpoint.summaries)[0]].ready=true,x=>x.checkpoint.orderedIds.pop(),x=>x.checkpoint.version=99,x=>x.checkpoint.eventDigest='corrupt',x=>x.completions['manual:fence']={id:'fence',entryId:'w:synthetic-1',caseId:'word',checked:false,at:START+1,source:'manual'}]) {
    const bad=clone(original);mutate(bad);const before=learningIndexStats();compare(normalizeLearning(bad,START));assert.equal(learningIndexStats().checkpointHits,before.checkpointHits);
  }
});
test('stale checkpoint plus a new event is ignored without dropping any reward identity',()=>{
  const stale=clone(checkpointLearning(make(300),START)),newEvent=attempt(500);stale.events[newEvent.id]=newEvent;
  const before=learningIndexStats();compare(normalizeLearning(stale,START));assert.equal(learningIndexStats().checkpointHits,before.checkpointHits);
  assert.ok(stale.events['index:500']);
});
test('reset supersedes checkpoints, old attempts and manual records in both merge orders',()=>{
  const checkpoint=checkpointLearning(setCompletionRecord(make(300),{entryId:'w:synthetic-1',caseId:'word',id:'old-uncheck',checked:false,at:START+1,source:'manual'}),START);
  const reset=resetLearning(checkpoint,START+1000,'reset:index');
  for(const merged of [mergeLearning(reset,checkpoint),mergeLearning(checkpoint,reset)]) {
    assert.deepEqual(merged.events,{});assert.deepEqual(merged.completions,{});assert.equal(merged.checkpoint,undefined);assert.deepEqual(allSkills(merged),[]);
  }
});
test('future learning schemas are refused without removing their checkpoint payload',()=>{
  const future={...checkpointLearning(make(30),START),version:LEARNING_VERSION+1};assert.throws(()=>checkpointLearning(future),/Update Parola/);assert.deepEqual(normalizeLearning(future),future);
});

const rows=[];
for(const count of [1000,10000,50000]) {
  const base=make(count),objective=attempt(count).objectiveId;
  let t=performance.now();allSkills(base,START);const initialRetrieval=performance.now()-t;
  let working=base;const times=[];const before=learningIndexStats();
  for(let i=0;i<5;i++){t=performance.now();working=recordAttempt(working,attempt(count+i)).learning;times.push(performance.now()-t);}
  const after=learningIndexStats();t=performance.now();skillState(working,objective,START);const warmRetrieval=performance.now()-t;
  t=performance.now();recordAttempt(normalizeLearning(clone(base),START),attempt(count));const fullReplayReference=performance.now()-t;
  const saved=checkpointLearning(working,START),restored=normalizeLearning(clone(saved),START);
  t=performance.now();allSkills(restored,START);const checkpointRetrieval=performance.now()-t;
  const imported=mergeLearning(working,clone(base),START);assert.deepEqual(allSkills(imported,START),allSkills(working,START));
  const stale=clone(saved),extra=attempt(count+10);stale.events[extra.id]=extra;compare(normalizeLearning(stale,START));
  assert.equal(after.normalizedEvents-before.normalizedEvents,5);assert.equal(after.builds-before.builds,0);
  const row={events:count,initialRetrievalMs:+initialRetrieval.toFixed(3),appendMedianMs:+times.sort((a,b)=>a-b)[2].toFixed(3),warmTargetRetrievalMs:+warmRetrieval.toFixed(3),fullNormalizationReferenceMs:+fullReplayReference.toFixed(3),checkpointRetrievalMs:+checkpointRetrieval.toFixed(3),normalizedEventsForFiveAppends:after.normalizedEvents-before.normalizedEvents,lifetimeIndexRebuildsForFiveAppends:after.builds-before.builds};
  rows.push(row);console.log(JSON.stringify(row));
}
if(process.argv.includes('--write-report'))fs.writeFileSync(new URL('../docs/implementation/phase-0-2/evidence-performance.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),runtime:process.version,platform:process.platform,measurement:'Desktop synthetic histories; timings are diagnostic, not phone measurements. Reference explicitly clones/normalizes the full history before append; checkpoints retain all events and do not reduce storage.',checksPassed:passed,sizes:rows},null,2)+'\n');
console.log(`\n${passed} index/checkpoint checks and 1k/10k/50k replay/merge/stale-checkpoint measurements passed.`);
