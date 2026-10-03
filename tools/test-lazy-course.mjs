// Compact descriptor equivalence, isolated stage loading and exact old question IDs.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {data} from '../js/data.js';import {buildLesson} from '../js/learning/lesson-content.js';
import {installCompletionIndex,completionPlan,entryCompletion} from '../js/learning/completion-state.js';
import {journeyCaseProgress,journeyWordCompletion} from '../js/learning/journey.js';
import {createLearning,setCompletionRecord,recordAttempt} from '../js/learning/model.js';
import {grammarCourse,installGrammarIndex,loadGrammarCourse,loadGrammarStage,loadGrammarLesson,grammarLesson,grammarProgress} from '../js/learning/grammar-course.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),clone=x=>JSON.parse(JSON.stringify(x));
const index=read('data/course-index.json');installCompletionIndex(read('data/completion-index.json'));
data.vocab=read('data/vocab.json').map(e=>({...e,kind:'word'}));data.verbs=read('data/verbs.json').map(e=>({...e,kind:'verb',it:e.inf}));data.byId=new Map([...data.vocab,...data.verbs].map(e=>[e.id,e]));
const START=1700000000000,required=t=>t.available!==false&&(t.required!==false||t.completionRequired)&&!t.supplementalOnly;
const complete=(plan,learning)=>plan.kind==='verb'?{...journeyCaseProgress(plan,learning),cases:journeyCaseProgress(plan,learning).cases.map(c=>({...c,checked:c.ready}))}:{...journeyWordCompletion(plan,learning),cases:[]};
let passed=0;const test=async(name,fn)=>{await fn();console.log('✓',name);passed++;};
await test('every dictionary completion descriptor preserves exact required target IDs and word slots',()=>{
 for(const entry of [...data.vocab,...data.verbs]){const full=buildLesson(entry),compact=completionPlan(entry);assert.ok(compact,entry.id);
  if(entry.kind==='verb')for(const chapter of compact.chapters){const old=full.chapters.find(c=>c.id===chapter.id);assert.deepEqual(chapter.groups[0].targets.map(t=>[t.id,!!t.guidedOnly,!!t.completionRequired]),old.groups.flatMap(g=>g.targets).filter(required).map(t=>[t.id,!!t.guidedOnly,!!t.completionRequired]),entry.id+':'+chapter.id);assert.deepEqual((chapter.legacyRequirements||[]).map(t=>t.id),(old.legacyRequirements||[]).filter(required).map(t=>t.id));}
  else assert.deepEqual(compact.wordLesson.slots,full.wordLesson.slots.map(s=>({id:s.id,targetId:s.targetId})));
  assert.deepEqual(entryCompletion(entry,createLearning(START)),complete(full,createLearning(START)));
 }
});
await test('compact completion reads preserve manual fences and natural case/word proof',()=>{
 for(const entry of [data.byId.get('v:credere'),data.verbs.find(e=>e.inf==='solere'),data.byId.get('w:casa|noun'),data.vocab.find(e=>e.it==='calcio'&&e.pos==='noun'),data.vocab.find(e=>e.pos==='adj')]){
  const full=buildLesson(entry);let learning=createLearning(START),n=0;
  const targets=full.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets)).filter(required);
  for(let round=0;round<4;round++)for(const target of targets){n++;learning=recordAttempt(learning,{id:'lazy:'+n,epochId:'initial',sessionId:'proof',index:n*3,at:START+n,entryId:entry.id,objectiveId:target.id,targetId:target.id,kind:entry.kind,policy:'journey-v1',contentVersion:full.version,mode:'production',ok:true,outcome:'correct',firstAttempt:true,variantId:'variant:'+round,contextId:'context:'+round,skill:target.skill,xp:0}).learning;}
  if(entry.kind==='word'){for(const slot of full.wordLesson.slots){n++;learning=recordAttempt(learning,{id:'word:'+n,epochId:'initial',sessionId:'short-proof',index:n,at:START+n,entryId:entry.id,objectiveId:slot.targetId,kind:'word',policy:'journey-v1',contentVersion:full.version,mode:'recognition',ok:true,outcome:'correct',firstAttempt:true,variantId:slot.id,wordSlotId:slot.id,wordPolicy:'word-short-v1',xp:0}).learning;}assert.equal(entryCompletion(entry,learning).complete,true);}
  assert.deepEqual(entryCompletion(entry,learning),complete(full,learning));
  learning=setCompletionRecord(learning,{id:'uncheck',entryId:entry.id,caseId:entry.kind==='verb'?'present':'word',checked:false,source:'manual',at:START+100000});assert.deepEqual(entryCompletion(entry,learning),complete(full,learning));
  learning=setCompletionRecord(learning,{id:'check',entryId:entry.id,caseId:entry.kind==='verb'?'past':'word',checked:true,source:'manual',at:START+100001,flowVersion:2});assert.deepEqual(entryCompletion(entry,learning),complete(full,learning));
 }
});
const requests=[];let failure=null,corrupt=null;globalThis.fetch=async url=>{requests.push(url);if(url===failure)return {ok:false};const body=read(url);if(url===corrupt)body.units[0].lessons[0].title='Corrupt';return {ok:true,json:async()=>body};};
installGrammarIndex(index);
await test('outline/review descriptors expose every course and fetch no stage on lookup',async()=>{
 await loadGrammarCourse();for(const pack of [...index.levels,...index.legacyLevels])for(const unit of pack.units)for(const lesson of unit.lessons){const l=grammarLesson(lesson.id);assert.equal(l.title,lesson.title);assert.deepEqual(grammarProgress(l,createLearning(START)).skills,grammarProgress({...read(pack.path).units.find(u=>u.id===unit.id).lessons.find(l=>l.id===lesson.id),level:pack.level},createLearning(START)).skills);}
 assert.deepEqual(requests,[]);
});
await test('concurrent selected stage loads share a request; vocabulary attaches only to the selected lesson',async()=>{
 const [a,b]=await Promise.all([loadGrammarStage('A1'),loadGrammarStage('A1')]);assert.equal(a,b);assert.deepEqual(requests,['data/course-v2/A1.json']);
 const first='v2-a1-vowels-stress';await loadGrammarLesson(first);assert.ok(grammarLesson(first).steps.some(s=>s.synthesized));assert.equal(grammarCourse.lessons.filter(l=>l.steps.some(s=>s.synthesized)).length,1);
 await loadGrammarLesson(first);assert.equal(grammarLesson(first).steps.filter(s=>s.synthesized).length,new Set(grammarLesson(first).steps.filter(s=>s.synthesized).map(s=>s.id)).size);
});
await test('missing/corrupt stages remain isolated and retry successfully without losing another lesson',async()=>{
 const previous=grammarLesson(index.levels.find(p=>p.level==='A1').units[0].lessons[0].id);failure='data/course-v2/B1.json';await assert.rejects(loadGrammarStage('B1'),/saved work is kept/);assert.equal(grammarLesson(previous.id),previous);
 await loadGrammarStage('Foundations');failure=null;corrupt='data/course-v2/B1.json';await assert.rejects(loadGrammarStage('B1'),/saved work is kept/);corrupt=null;await loadGrammarStage('B1');assert.equal(grammarLesson(previous.id),previous);
});
await test('earlier grammar stage loads on demand with original objective/question IDs and exact draft meaning',async()=>{
 const descriptor=index.legacyLevels[0],l=descriptor.units[0].lessons[0],raw=read(descriptor.path).units[0].lessons[0],draft={entryId:'g:'+l.id,grammar:{phase:'question',objectiveIndex:0,questionId:raw.objectives[0].questions[0].id,draft:'Sono già qui',history:[]}};
 const before=clone(draft);await loadGrammarLesson(l.id);const loaded=grammarLesson(l.id);assert.deepEqual(loaded.objectives,raw.objectives);assert.ok(loaded.objectives[0].questions.some(q=>q.id===draft.grammar.questionId));assert.deepEqual(draft,before);assert.equal(requests.filter(p=>p.startsWith('data/grammar-course/')).length,1);
});
console.log(`\n${passed} compact completion/course loading checks passed.`);
