import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {data} from '../js/data.js';
import {installGrammarCourse,grammarLesson} from '../js/learning/grammar-course.js';
import {createCourseSession} from '../js/learning/course-v2-engine.js';
import {createGrammarSession} from '../js/learning/grammar-journey.js';
import {createLabSession} from '../js/learning/sentence-lab.js';
import {createPracticeSourceResolver,createCoursePracticeBinding,createGrammarPracticeBinding,createWorkshopPracticeBinding} from '../js/learning/practice-sources.js';
import {resolvePracticeGrounding,authoredExampleCards} from '../js/ai/practice-grounding.js';
import {createAIService} from '../js/ai/index.js';

const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url))),index=read('data/course-index.json');
installGrammarCourse(index.levels.map(pack=>read(pack.path)),index.legacyLevels.map(pack=>read(pack.path)));
for(const entry of read('data/vocab.json')){entry.kind='word';data.byId.set(entry.id,entry);}
const pack=read('data/sentence-lab/presente.json'),lab=pack.lessons[0];
const resolver=createPracticeSourceResolver({lookupWorkshop:id=>pack.lessons.find(lesson=>lesson.id===id),lookupWorkshopStage:()=>pack});
function workshop(agreement='m'){
 const session=createLabSession(lab);session.index=4;session.speakerAgreement=agreement;session.state={kind:'cloze',result:null};
 const binding=createWorkshopPracticeBinding({lesson:lab,stage:pack,session,blankIndex:0}),source=resolver.resolve(binding);
 return{binding,source,session};
}
function course(kind='question',id='v2-a1-essere-singular'){
 const lesson=grammarLesson(id),session=createCourseSession(lesson);session.courseV2.stepIndex=lesson.steps.findIndex(step=>step.kind===kind);
 const binding=createCoursePracticeBinding({lesson,session}),source=resolver.resolve(binding);return{lesson,session,binding,source};
}
const request=(binding,source,extra={})=>({task:'explain',text:'Please help',level:binding.kind==='workshop'?'A1':grammarLesson(binding.lessonId).level,sourceRevision:'help:test-exact-source',agreement:binding.selection?.agreement||'neutral',participants:[{id:'helper',name:'Helper'}],helpSource:binding,helpContext:{sourceId:source.sourceId,prompt:source.prompt,context:source.context},...extra});

test('real Workshop free slot binds agreement, canonical activity and the actual model example position',async()=>{
 const f=workshop(),grounding=await resolvePracticeGrounding(request(f.binding,f.source),resolver);assert.equal(grounding.rules.length,0);assert.equal(grounding.references[0].it,'Sono italiana.');assert.equal(grounding.references[0].sourceLocator.index,2);assert.equal(grounding.references[0].sourceValidated,true);assert.equal(grounding.references[0].reviewed,undefined);assert.match(grounding.references[0].reviewStatus,/not recorded/);
 assert.notEqual(JSON.stringify(f.binding),JSON.stringify(workshop('f').binding));
});
test('Workshop request agreement mismatch rejects before generation',async()=>{
 const f=workshop('f');let generated=0;const service=createAIService({practiceSources:resolver,runtime:{generate(){generated++;}},languagePolicy:{version:'test-only',validate:()=>({ok:true})}});
 await assert.rejects(service.request(request(f.binding,f.source,{agreement:'m'})),/changed or is unsupported/);assert.equal(generated,0);service.dispose();
});
test('Workshop imported slot/template/example changes and non-free sources fail closed',()=>{
 const f=workshop();for(const change of [b=>b.canonical.template='Fake ____',b=>b.canonical.blanks[0].slot.pos='verb',b=>b.references[0].it='Imported teacher claim.',b=>b.selection.blankIndex=1,b=>b.selection.activityIndex=2,b=>b.selection.agreement='invented']){const binding=structuredClone(f.binding);change(binding);assert.equal(resolver.resolve(binding),null);}
 const old=structuredClone(lab);old.activities[4].template='Changed ____.';const changed=createPracticeSourceResolver({lookupWorkshop:()=>old,lookupWorkshopStage:()=>pack});assert.equal(changed.resolve(f.binding),null,'same declared version cannot preserve a changed template');
});
test('actual Course question uses exact selected step and honest authored-source provenance',async()=>{
 const f=course(),grounding=await resolvePracticeGrounding(request(f.binding,f.source),resolver),cards=authoredExampleCards(grounding);
 assert.equal(grounding.rules.length,0);assert.equal(cards[0].examples[0].it,f.source.canonical.speak);assert.equal(cards[0].provenance.sourceRevision,'help:test-exact-source');assert.match(cards[0].provenance.reviewStatus,/not recorded/);assert.equal(cards[0].provenance.sourceValidated,true);assert.equal(cards[0].provenance.catalogueRevision,`course:2:${f.source.canonical.id}`);
});
test('Course guided override and repair are rebuilt from the exact canonical engine selection',()=>{
 const f=course(),question=f.lesson.steps.find(step=>step.kind==='question'&&step.stage!=='guided');Object.assign(f.session.courseV2,{phase:'guided',activeQuestionId:question.id,activeTargetId:question.target});
 const binding=createCoursePracticeBinding(f),source=resolver.resolve(binding);assert(source);assert.equal(source.canonical.stage,'guided');
 const forged=structuredClone(binding);forged.selection.activeQuestionId='invented';assert.equal(resolver.resolve(forged),null);
});
test('Course portfolio remains a canonical model reference and no grammar rule is inferred',()=>{
 const f=course('portfolio','v2-a1-essere-plural');assert(f.source);assert.equal(f.source.references[0].it,f.source.canonical.model);assert.deepEqual(f.source.rules,[]);assert.equal(f.binding.revisionScope.path,'data/course-v2/A1.json');
});
test('Course same-version imported question, reference and authority changes are rejected',()=>{
 const f=course();for(const change of [b=>b.canonical.answer='invented',b=>b.canonical.prompt='Changed',b=>b.references[0].reviewStatus='Reviewed grammar rule',b=>b.ruleIds=['invented'],b=>b.selection.stepIndex++]){const binding=structuredClone(f.binding);change(binding);assert.equal(resolver.resolve(binding),null);}
});
test('retained Grammar binds its exact objective/question/card and rejects invented repair IDs',()=>{
 const lesson=grammarLesson('a1-sounds-spelling'),session=createGrammarSession(lesson,{mode:'review'}),binding=createGrammarPracticeBinding({lesson,session}),source=resolver.resolve(binding);assert(source);assert.equal(source.references[0].it,lesson.objectives[0].questions[0].speak);assert.equal(binding.revisionScope.path,'data/grammar-course/A1.json');
 session.grammar.phase='repair';session.grammar.repairQuestion='invented';assert.equal(createGrammarPracticeBinding({lesson,session}),null);session.grammar.repairQuestion=lesson.objectives[0].questions[0].id;assert(resolver.resolve(createGrammarPracticeBinding({lesson,session})));
 session.grammar.phase='teach';const teaching=createGrammarPracticeBinding({lesson,session});assert.equal(resolver.resolve(teaching).references[0].it,'Chiara cerca casa.');const forged=structuredClone(teaching);forged.canonical.body='Invented authoritative grammar';assert.equal(resolver.resolve(forged),null);
});
test('paused, historical, complete and graded Workshop sources cannot be newly assisted',()=>{
 const f=workshop();for(const change of [s=>s.paused=true,s=>s.phase='complete',s=>s.state.result={ok:true}]){const session=structuredClone(f.session);change(session);assert.equal(createWorkshopPracticeBinding({lesson:lab,stage:pack,session,blankIndex:0}),null);}
 const c=course();c.session.courseV2.historyCursor=0;assert.equal(createCoursePracticeBinding(c),null);
});
test('retained Grammar repair binds the full exact selected question even when its spoken sentence stays unchanged',()=>{
 const lesson=grammarLesson('a1-sounds-spelling'),session=createGrammarSession(lesson,{mode:'review'}),question=lesson.objectives[0].questions[0];session.grammar.phase='repair';session.grammar.repairQuestion=question.id;
 const binding=createGrammarPracticeBinding({lesson,session});assert.deepEqual(binding.canonical.repairQuestion,question);
 for(const field of ['answer','explanation','options']){
  const changed=structuredClone(lesson),selected=changed.objectives[0].questions[0];selected[field]=field==='options'?['Changed accepted options']: 'Changed accepted form or explanation';assert.equal(selected.speak,question.speak);
  assert.equal(createPracticeSourceResolver({lookupGrammar:()=>changed}).resolve(binding),null,field+' mutation must revoke the old repair binding');
 }
});
test('all raw authored Course question and portfolio sources fit the bounded binding contract',()=>{
 let count=0,unsupported=[];for(const pack of index.levels.map(pack=>read(pack.path)))for(const unit of pack.units)for(const raw of unit.lessons){const lesson=grammarLesson(raw.id),session=createCourseSession(lesson);for(let i=0;i<lesson.steps.length;i++){const step=lesson.steps[i];if(!['question','portfolio'].includes(step.kind))continue;session.courseV2.stepIndex=i;const binding=createCoursePracticeBinding({lesson,session});if(!binding)unsupported.push(step.id);else {assert(resolver.resolve(binding));count++;}}}
 assert(count>2000);assert.deepEqual(unsupported,[]);
});
test('Workshop requires whole accepted phrases and their local canonical frame, never substring/fallback examples',()=>{
 const forged=structuredClone(lab);forged.activities[4].blanks[0].accept=['a'];let session=createLabSession(forged);session.index=4;session.state={kind:'cloze',result:null};session.speakerAgreement='m';assert.equal(createWorkshopPracticeBinding({lesson:forged,stage:pack,session,blankIndex:0}),null);
 forged.activities[4].blanks[0].accept=['italian'];assert.equal(createWorkshopPracticeBinding({lesson:forged,stage:pack,session,blankIndex:0}),null,'italian is not italiana');
 forged.activities[4].blanks[0].accept=['italiana'];forged.activities[4].template='Studio ____.';assert.equal(createWorkshopPracticeBinding({lesson:forged,stage:pack,session,blankIndex:0}),null,'a different role/frame is not a valid model link');
});
test('Course reviewed sense links apply only to actual selected text and its declared authored source step',()=>{
 const lesson=grammarLesson('v2-a2-habit-versus-event'),session=createCourseSession(lesson);let found=false;
 for(let i=0;i<lesson.steps.length;i++){session.courseV2.stepIndex=i;const binding=createCoursePracticeBinding({lesson,session});if(!binding)continue;const source=resolver.resolve(binding);if(source.senses.length){assert.deepEqual(source.senses.map(sense=>sense.id),['it:volta:noun:occasion']);found=true;}}
 assert(found);const other=course();assert.deepEqual(other.source.senses,[]);
});
