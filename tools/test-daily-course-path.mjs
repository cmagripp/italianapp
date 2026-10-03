import assert from 'node:assert/strict';
import fs from 'node:fs';
import {data} from '../js/data.js';
import {createLearning,recordAttempt,normalizeLearning} from '../js/learning/model.js';
import {installGrammarIndex,grammarCourse,grammarLesson,grammarProgress,relatedVocabulary} from '../js/learning/grammar-course.js';
import {dailyPlan,nextWorkshopActivity,continuation} from '../js/learning/daily-plan.js';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url)));
data.vocab=read('data/vocab.json').filter(e=>!e.legacyGrouping).map(e=>({...e,kind:'word'}));data.verbs=read('data/verbs.json').map(e=>({...e,kind:'verb',it:e.inf}));data.byId=new Map([...data.vocab,...data.verbs].map(e=>[e.id,e]));data.loaded=true;
const index=read('data/course-index.json');installGrammarIndex(index);
const ciao=data.vocab.find(e=>e.it==='ciao'),casa=data.vocab.find(e=>e.it==='casa'),credere=data.verbs.find(e=>e.inf==='credere');
const now=1700000000000;
const fixture=(entries=[ciao,casa,credere])=>({current:{id:'daily-path',items:{},customDeleted:{},lab:{frasi:{done:{}}}},learning:createLearning(now),settings:{studyMinutes:10},scope:{mode:'lists',lists:['daily']},lists:{daily:{id:'daily',items:entries.map(e=>e.id)}}});
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS',name);}
test('The outline contains reviewed vocabulary links and no full teaching or repair payload',()=>{
 const lessons=index.levels.flatMap(l=>l.units.flatMap(u=>u.lessons));
 assert(lessons.find(l=>l.id==='v2-f-greet').vocabularyLinks.includes(ciao.id));
 for(const lesson of lessons){
  for(const target of lesson.targets)for(const property of ['repair','explanation','questions','examples'])assert.equal(target[property],undefined);
  for(const id of lesson.vocabularyLinks)assert(data.byId.has(id),id);
 }
 assert(fs.statSync(new URL('../data/course-index.json',import.meta.url)).size<350000);
});
test('The daily course follows grammar with its linked vocabulary and respects a chosen scope',()=>{
 const store=fixture(),before=JSON.stringify(store.learning),plan=dailyPlan(store,{now});
 assert.equal(plan.steps[0].activity,'grammar');assert.equal(plan.steps[1].entryId,ciao.id);assert.match(plan.steps[1].reason,/Vocabulary for/);
 assert.equal(JSON.stringify(store.learning),before);
 const limited=dailyPlan(fixture([casa,credere]),{now});assert(limited.steps.filter(step=>['word','verb'].includes(step.activity)).every(step=>[casa.id,credere.id].includes(step.entryId)));
});
test('Course end links include the same real vocabulary without duplicate generic verb links',()=>{
 const lesson=grammarLesson('v2-f-greet'),store=fixture();assert(relatedVocabulary(lesson,store).some(link=>link.entry.id===ciao.id));
 const selected={...lesson,related:[{entryId:credere.id,caseId:'past'}],wordEntryIds:[credere.id,ciao.id]};
 const links=relatedVocabulary(selected,store);assert.deepEqual(links.filter(link=>link.entry.id===credere.id).map(link=>link.caseId),['past']);assert.equal(links.filter(link=>link.entry.id===ciao.id).length,1);
});
test('Continue uses the newest saved session when a merged active pointer is stale',()=>{
 const store=fixture(),id='merged-verb',base={id,entryId:credere.id,mode:'lesson',createdAt:now};
 const saved={...base,updatedAt:now+200,journey:{phase:'teach',chapterId:'future',current:{targetId:'future::io'}},ui:{draft:'creder'}};
 const stale={...base,updatedAt:now+100,journey:{phase:'complete',chapterId:'present'}};
 store.learning=normalizeLearning({...store.learning,sessions:{[id]:saved},session:stale},now+300);
 const before=JSON.stringify(store.learning),resume=continuation(store,{now:now+300});
 assert.equal(resume.sessionId,id);assert.equal(resume.caseId,'future');assert.match(resume.href,/chapter=future/);
 assert.equal(JSON.stringify(store.learning),before);
 // Equal timestamps keep the saved record, independently of object order.
 store.learning.session={...stale,updatedAt:saved.updatedAt};assert.equal(continuation(store).caseId,'future');
 store.learning.session={...stale,updatedAt:saved.updatedAt+1};assert.equal(continuation(store),null);
});
test('Workshop descriptors preserve the authored path and required course links',()=>{
 for(const stage of index.workshops){const source=read(`data/sentence-lab/${stage.stage}.json`);assert.deepEqual(stage.lessons.map(l=>[l.id,l.grammarRefs]),source.lessons.map(l=>[l.id,l.grammarRefs]));assert(stage.lessons.every(l=>!l.activities));}
});
test('A workshop is recommended only after all its grammar prerequisites, without completing anything',()=>{
 const store=fixture(),workshop=index.workshops[0].lessons[0];assert.equal(nextWorkshopActivity(store),null);
 let sequence=0;
 for(const id of workshop.grammarRefs){
  const lesson=grammarLesson(id);assert(lesson,id);const sessionId=`precondition:${id}`;
  for(const target of lesson.targets)for(let n=0;n<Math.max(target.minIndependent,target.facets.length);n++){
   const event={id:`daily-proof:${++sequence}`,epochId:store.learning.epoch.id,sessionId,index:n*2,at:now+sequence,entryId:`g:${id}`,objectiveId:target.id,kind:'grammar',policy:'grammar-v2',contentVersion:2,skill:'course',facet:target.facets[n%target.facets.length],requiredFacets:target.facets,minIndependent:target.minIndependent,requiresProduction:target.requiresProduction,modality:target.modality,mode:target.requiresProduction?'production':'recognition',responseMode:target.requiresProduction?'production':'recognition',grammarPhase:'independent',firstAttempt:true,assistance:[],ok:true,outcome:'correct',variantId:`variant:${sequence}`,contextId:`context:${sequence}`,exposureGroup:`exposure:${sequence}`,xp:0};
   store.learning=recordAttempt(store.learning,event).learning;
  }
  store.learning.sessions[sessionId]={id:sessionId,entryId:`g:${id}`,mode:'lesson',courseV2:{phase:'complete'}};
  assert.equal(grammarProgress(lesson,store.learning).complete,true,id);
 }
 const before=JSON.stringify(store),next=nextWorkshopActivity(store);assert.equal(next.entryId,`lab:frasi:${workshop.id}`);assert.equal(JSON.stringify(store),before);
 const plan=dailyPlan(store,{now,minutes:15});assert(plan.steps.some(step=>step.activity==='workshop'));assert(plan.estimatedMinutes<=15);
 store.current.lab.frasi.done[workshop.id]=now;assert.notEqual(nextWorkshopActivity(store)?.entryId,next.entryId);
});
console.log(`${checks} daily course/path checks passed.`);
