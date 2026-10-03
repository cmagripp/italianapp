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

test('real Workshop free slot binds its exact chosen source, agreement and bounded editorial scope',async()=>{
 const f=workshop(),grounding=await resolvePracticeGrounding(request(f.binding,f.source),resolver);assert.equal(grounding.rules.length,0);assert.equal(grounding.references[0].it,'Sono di Roma e sono italiano.');assert.equal(grounding.references[0].sourceLocator.field,'sourceExamples');assert.equal(grounding.references[0].sourceLocator.index,0);assert.equal(grounding.references[0].sourceValidated,true);assert.equal(grounding.references[0].reviewed,undefined);assert.equal(grounding.references[0].reviewStatus,'independent-agent-review');assert.equal(grounding.references[0].reviewScope,'chosen-form-translation-agreement');assert.equal(grounding.references[0].nativeItalianEducatorReview,'pending');assert.equal(workshop('f').source.references[0].it,'Sono di Roma e sono italiana.');
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

const workshopPacks=['presente','passato','futuro','strutture'].map(stage=>read('data/sentence-lab/'+stage+'.json'));
const workshopRows=workshopPacks.flatMap(stage=>stage.lessons.flatMap(lesson=>lesson.activities.flatMap((activity,activityIndex)=>(activity.kind==='dialogue'?activity.turns:activity.kind==='cloze'?[activity]:[]).flatMap((turn,turnIndex)=>(turn.blanks||[]).flatMap((blank,blankIndex)=>blank.free?[{stage,lesson,activity,activityIndex,turn,turnIndex:activity.kind==='dialogue'?turnIndex:null,blank,blankIndex}]:[])))));
function chosenWorkshop(row,agreement='m'){
 const session=createLabSession(row.lesson);Object.assign(session,{index:row.activityIndex,speakerAgreement:agreement,state:{kind:row.activity.kind,result:null,...row.turnIndex===null?{}:{turnIndex:row.turnIndex}}});
 const binding=createWorkshopPracticeBinding({lesson:row.lesson,stage:row.stage,session,blankIndex:row.blankIndex}),ownResolver=createPracticeSourceResolver({lookupWorkshop:()=>row.lesson,lookupWorkshopStage:()=>row.stage});return {session,binding,source:binding&&ownResolver.resolve(binding),resolver:ownResolver};
}
test('all 46 current Workshop slots have bounded exact chosen sources for m; only the fixed male quote is unavailable for f',()=>{
 assert.equal(workshopRows.length,46);let male=0,female=0,maxChars=0;const unavailable=[];
 for(const row of workshopRows)for(const agreement of ['m','f']){
  const f=chosenWorkshop(row,agreement);if(!f.binding){unavailable.push([row.lesson.id,row.activityIndex,row.turnIndex,row.blankIndex,agreement]);continue;}
  assert(f.source);maxChars=Math.max(maxChars,JSON.stringify(f.binding).length);assert(JSON.stringify(f.binding).length<=15000);assert.deepEqual(f.source.rules,[]);
  agreement==='m'?male++:female++;
  for(const ref of f.source.references){const authored=row.blank.sourceExamples[ref.sourceLocator.index];assert.equal(ref.it,authored.it);assert.equal(ref.en,authored.en);assert.equal(ref.reviewScope,'chosen-form-translation-agreement');assert.equal(ref.reviewed,undefined);assert.equal(ref.verified,undefined);assert.equal(ref.nativeItalianEducatorReview,'pending');assert(['any',agreement].includes(ref.applicability));}
 }
 assert.equal(male,46);assert.equal(female,45);assert.deepEqual(unavailable,[['sl-strutture-03-quindi-allora-pero',3,null,0,'f']]);assert(maxChars>6800);
});
test('every chosen source has exact review-record Italian, translation and subject agreement without blessing all accepted alternatives',()=>{
 const review=read('docs/implementation/programme/workshop-source-examples-independent-review.json');let count=0;
 for(const row of workshopRows)for(const [index,ex]of row.blank.sourceExamples.entries()){
  const entry=review.examples.find(entry=>entry.lessonId===row.lesson.id&&entry.activityIndex===row.activityIndex&&entry.turnIndex===row.turnIndex&&entry.blankIndex===row.blankIndex&&entry.exampleIndex===index);assert(entry);
  for(const field of ['it','en','agreement','subjectScope','subjectAgreement'])assert.equal(ex[field],entry[field]);count++;
 }
 assert.equal(count,60);
});
test('fixed-speaker and group example cards identify whose agreement is quoted',()=>{
 for(const [id,scope,label]of [['sl-strutture-03-quindi-allora-pero','speaker','Example: a man speaking.'],['sl-passato-05-raccontami','group','Example: a male or mixed group.']]){
  const row=workshopRows.find(row=>row.lesson.id===id&&row.blank.sourceExamples.some(ex=>ex.subjectScope===scope)),f=chosenWorkshop(row,scope==='group'?'f':'m'),cards=authoredExampleCards({references:f.source.references});assert.equal(cards[0].contextLabel,label);assert.equal(cards[0].provenance.subjectScope,scope);assert.equal(cards[0].provenance.nativeItalianEducatorReview,'pending');
 }
});
test('an explicit malformed or inapplicable source never falls back to preceding model examples',()=>{
 const mutations=[blank=>blank.sourceExamples[0].values[0]='invented',blank=>blank.sourceExamples[0].it='Sono italiana.',blank=>blank.sourceExamples[0].reviewStatus='model-reviewed',blank=>blank.sourceExamples[0].extra='imported',blank=>blank.sourceExamples[0].subjectAgreement='f',blank=>blank.sourceExamples=[],blank=>blank.sourceExamples=null];
 for(const mutate of mutations){const changed=structuredClone(lab),blank=changed.activities[4].blanks[0];mutate(blank);const session=createLabSession(changed);Object.assign(session,{index:4,speakerAgreement:'m',state:{kind:'cloze',result:null}});assert.equal(createWorkshopPracticeBinding({lesson:changed,stage:pack,session,blankIndex:0}),null);}
});
test('the whole activity and chosen source revision revoke old bindings even if the selected Italian is unchanged',()=>{
 const f=workshop();for(const mutate of [a=>a.blanks[0].sourceExamples[0].en='Changed translation',a=>a.blanks[0].accept.push('new accepted option'),a=>a.blanks[0].sourceExamples[0].sourceNote='Changed exact source note',a=>a.blanks[0].sourceExamples[1].en='Changed other agreement source']){
  const changed=structuredClone(lab);mutate(changed.activities[4]);assert.equal(createPracticeSourceResolver({lookupWorkshop:()=>changed,lookupWorkshopStage:()=>pack}).resolve(f.binding),null);
 }
});
test('a multi-blank source binds all exact accepted fills, not just the currently selected slot',()=>{
 const row=workshopRows.find(row=>row.turn.blanks.length>1),changed=structuredClone(row.lesson),a=changed.activities[row.activityIndex],turn=row.turnIndex===null?a:a.turns[row.turnIndex],other=(row.blankIndex+1)%turn.blanks.length;
 turn.blanks[row.blankIndex].sourceExamples[0].values[other]='invented';const session=createLabSession(changed);Object.assign(session,{index:row.activityIndex,speakerAgreement:'m',state:{kind:a.kind,result:null,...row.turnIndex===null?{}:{turnIndex:row.turnIndex}}});assert.equal(createWorkshopPracticeBinding({lesson:changed,stage:row.stage,session,blankIndex:row.blankIndex}),null);
});
test('declared legacy sources without explicit examples retain conservative whole-phrase/frame matching',()=>{
 const legacy=structuredClone(lab);delete legacy.activities[4].blanks[0].sourceExamples;const session=createLabSession(legacy);Object.assign(session,{index:4,speakerAgreement:'m',state:{kind:'cloze',result:null}});
 assert.equal(createWorkshopPracticeBinding({lesson:legacy,stage:pack,session,blankIndex:0}).references[0].it,'Sono italiana.');
 for(const answer of ['a','italian']){legacy.activities[4].blanks[0].accept=[answer];assert.equal(createWorkshopPracticeBinding({lesson:legacy,stage:pack,session,blankIndex:0}),null);}
 legacy.activities[4].blanks[0].accept=['italiana'];legacy.activities[4].template='Studio ____.';assert.equal(createWorkshopPracticeBinding({lesson:legacy,stage:pack,session,blankIndex:0}),null);
});

test('the actual group quote subject reaches the task prompt independently of learner agreement',async()=>{
 const row=workshopRows.find(row=>row.lesson.id==='sl-passato-05-raccontami'&&row.blank.sourceExamples.some(ex=>ex.subjectScope==='group')),f=chosenWorkshop(row,'f');let prompt;
 const service=createAIService({practiceSources:f.resolver,runtime:{generate(task){prompt=task.messages[0].content;return JSON.stringify({participantId:'helper',text:'Guarda questo esempio.',corrections:[]});}},languagePolicy:{version:'test-only',validate:()=>({ok:true})}});
 const response=await service.request(request(f.binding,f.source,{level:'A2',agreement:'f'}));assert(prompt.includes('"subjectScope":"group"'));assert(prompt.includes('"subjectAgreement":"male-or-mixed-group"'));assert(prompt.includes('"applicability":"any"'));assert.equal(response.corrections.length,0);assert.equal(response.teaching[0].contextLabel,'Example: a male or mixed group.');service.dispose();
});

test('fully reconstructed imported Workshop selections cannot mint invented turn locators or extra source fields',()=>{
 const f=workshop(),forged=structuredClone(f.binding);forged.selection.turnIndex=123;
 for(const ref of forged.references){ref.sourceLocator.turnIndex=123;ref.id=ref.id.replace(':turn-cloze:',':turn-123:');}
 assert.equal(resolver.resolve(forged),null);
 const extra=structuredClone(f.binding);extra.selection.importedAuthority='invented';assert.equal(resolver.resolve(extra),null);
 const session=structuredClone(f.session);session.state.kind='dialogue';session.state.turnIndex=0;assert.equal(createWorkshopPracticeBinding({lesson:lab,stage:pack,session,blankIndex:0}),null);
 const row=workshopRows.find(row=>row.turnIndex!==null),dialogue=chosenWorkshop(row);assert(dialogue.source);
 for(const turnIndex of [null,-1,1.5,row.activity.turns.length,'1']){const altered=structuredClone(dialogue.binding);altered.selection.turnIndex=turnIndex;assert.equal(dialogue.resolver.resolve(altered),null);}
});
