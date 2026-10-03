import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {data} from '../js/data.js';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {createJourneyScene} from '../js/learning/journey-scene.js';
import {createJourneyPracticeBinding,createPracticeSourceResolver} from '../js/learning/practice-sources.js';
import {createAIService,createGrounding} from '../js/ai/index.js';
import {resolvePracticeGrounding} from '../js/ai/practice-grounding.js';

const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url)));
for(const entry of read('data/vocab.json')){entry.kind='word';data.byId.set(entry.id,entry);data.vocab.push(entry);}
for(const entry of read('data/verbs.json')){entry.kind='verb';entry.it=entry.inf;data.byId.set(entry.id,entry);}
function fixture(entryId='v:domandare'){
 const entry=data.byId.get(entryId),plan=buildLesson(entry),chapter=plan.chapters.find(chapter=>chapter.id==='present')||plan.chapters[0];
 const target=chapter.groups.flatMap(group=>group.targets).find(target=>target.skill==='conjugation'&&target.person===0)||chapter.groups.flatMap(group=>group.targets)[0];
 const sceneSnapshot=createJourneyScene({entryId,chapterId:chapter.id,target,variant:0});
 const step={type:'question',chapter,target,questionId:'test-session:journey:1',variant:0,phase:'independent',format:'type',scenePolicy:sceneSnapshot?'expanded-v1':undefined,sceneSnapshot:sceneSnapshot||undefined,sceneRevision:sceneSnapshot?.sourceRevision};
 const question=buildJourneyQuestion(entry,chapter,target,step),binding=createJourneyPracticeBinding({entry,plan,step,question,sessionId:'test-session'}),resolver=createPracticeSourceResolver();
 const source=resolver.resolve(binding);
 return {entry,plan,chapter,target,question,step,binding,resolver,source,request:{task:'explain',text:'Explain an unrelated grammar rule',level:entry.level,scope:'test',sourceRevision:'help:test',participants:[{id:'helper',name:'Helper'}],helpSource:binding,helpContext:{sourceId:binding.sourceId,prompt:source?.prompt,context:source?.context||''},requestedIds:['unrelated-rule']}};
}
test('real saved Journey scene resolves only its exact reviewed example, without rule authority',async()=>{
 const f=fixture(),grounding=await resolvePracticeGrounding(f.request,f.resolver);
 assert.equal(grounding.rules.length,0);assert.equal(grounding.senses.length,0);assert.equal(grounding.references.length,1);assert.equal(grounding.references[0].it,f.question.context.it);assert.equal(grounding.references[0].sourceRevision,f.step.sceneRevision);
 assert.equal(grounding.references[0].confirmCorrection,undefined);
});
test('tampered imported prompt, answer, scene, revision and unknown authority fields are rejected',()=>{
 const f=fixture();for(const mutate of [b=>b.question.prompt='An imported instruction',b=>b.question.answer=['false'],b=>b.sceneSnapshot.context.it='A fabricated sentence.',b=>b.sceneRevision='obsolete',b=>b.ruleIds=['invented'],b=>b.contentVersion=99]){
  const binding=structuredClone(f.binding);mutate(binding);assert.equal(f.resolver.resolve(binding),null);
 }
});
test('retired saved scenes are not usable as current help sources',()=>{
 const f=fixture();const target={...f.target,legacyExpandedRevision:'old',legacyExpandedContexts:f.target.contexts,retiredExpandedContextIds:[f.target.contexts[0].id]};
 const snapshot=createJourneyScene({entryId:f.entry.id,chapterId:f.chapter.id,target,variant:0,legacy:true}),binding={...f.binding,sceneSnapshot:snapshot,sceneRevision:'old'};
 const resolver=createPracticeSourceResolver({lessonFor:()=>({...f.plan,chapters:[{...f.chapter,groups:[{targets:[target]}]}]})});assert.equal(resolver.resolve(binding),null);
});
test('helper missing a canonical resolver or binding fails before model generation',async()=>{
 const f=fixture();let calls=0;const service=createAIService({grounding:createGrounding({rules:[{id:'unrelated-rule',verified:true,level:'A1',source:'test-only',keywords:['grammar']}] }),runtime:{generate(){calls++;}},languagePolicy:{version:'test-only',validate:()=>({ok:true})}});
 await assert.rejects(service.request(f.request),/verified help binding/);assert.equal(calls,0);service.dispose();
 await assert.rejects(resolvePracticeGrounding({...f.request,helpSource:null},f.resolver),/verified help binding/);
});
test('unrelated lexical rule and requested IDs cannot leak into practice prompt or teaching cards',async()=>{
 const f=fixture();let captured;
 const service=createAIService({practiceSources:f.resolver,grounding:createGrounding({rules:[{id:'unrelated-rule',verified:true,level:'A1',source:'test-only',explanation:'UNRELATED RULE MUST NOT APPEAR',keywords:['grammar']}] }),runtime:{generate(task){captured=task;return JSON.stringify({participantId:'helper',text:'Guarda questo esempio.',corrections:[]});}},languagePolicy:{version:'test-only',validate:()=>({ok:true})}});
 const result=await service.request(f.request);assert(!captured.messages[0].content.includes('UNRELATED RULE'));assert(captured.messages[0].content.includes(f.question.context.it));assert(captured.messages[0].content.includes('non sono regole'));assert.equal(result.teaching.length,1);assert.equal(result.teaching[0].kind,'authored-example');assert.equal(result.corrections.length,0);assert.deepEqual(result.provenance.practiceSource.ruleIds,[]);service.dispose();
});
test('authored examples cannot authorize an invented correction or verdict',async()=>{
 const f=fixture(),service=createAIService({practiceSources:f.resolver,runtime:{generate(){return JSON.stringify({participantId:'helper',text:'Guarda.',corrections:[{original:'domando',replacement:'domanda',ruleId:f.source.references[0].id}]});}},languagePolicy:{version:'test-only',validate:()=>({ok:true})}});
 await assert.rejects(service.request(f.request));service.dispose();
});
test('a selected reviewed child sense resolves exactly, without siblings or base-lemma guesses',()=>{
 const entry=data.byId.get('w:macchia|noun#stain'),plan=buildLesson(entry);
 const chapter=plan.chapters.find(chapter=>chapter.groups.some(group=>group.targets.length)),target=chapter.groups.flatMap(group=>group.targets)[0];
 const step={type:'question',chapter,target,questionId:'sense-question',variant:0,phase:'independent',format:'type'},question=buildJourneyQuestion(entry,chapter,target,step),binding=createJourneyPracticeBinding({entry,plan,step,question,sessionId:'sense-session'});
 const source=createPracticeSourceResolver().resolve(binding);assert(source);assert.deepEqual(source.senses.map(sense=>sense.id),['it:macchia:noun:stain']);assert.equal(source.rules.length,0);assert.match(source.senses[0].source,/treccani/);assert.equal(source.senses[0].reviewStatus,'independent-agent-review');
});
test('source references above the requested level and altered help context fail closed',async()=>{
 const f=fixture();await assert.rejects(resolvePracticeGrounding({...f.request,level:'Foundations'},f.resolver),/supported reference/);
 await assert.rejects(resolvePracticeGrounding({...f.request,helpContext:{...f.request.helpContext,prompt:'changed'}},f.resolver),/changed or is unsupported/);
});
test('explicit prior-revision scenes with reused IDs retain their own exact reviewed example',()=>{
 const f=fixture(),old={...f.target.contexts[0],it:'Io domando una cosa diversa.',en:'I ask something different.'};
 const target={...f.target,legacyExpandedRevision:'declared-prior',legacyExpandedContexts:[old,...f.target.contexts.slice(1)]};
 const snapshot=createJourneyScene({entryId:f.entry.id,chapterId:f.chapter.id,target,variant:0,legacy:true});
 const step={...f.step,target,sceneSnapshot:snapshot,sceneRevision:snapshot.sourceRevision},question=buildJourneyQuestion(f.entry,f.chapter,target,step),binding=createJourneyPracticeBinding({entry:f.entry,plan:f.plan,step,question,sessionId:'test-session'});
 const resolver=createPracticeSourceResolver({lessonFor:()=>({...f.plan,chapters:[{...f.chapter,groups:[{targets:[target]}]}]})}),source=resolver.resolve(binding);
 assert(source);assert.equal(source.references[0].it,old.it);assert.equal(source.references[0].sourceRevision,'declared-prior');
});
test('actual short-word slots retain exact child sense grounding and reject a different slot',()=>{
 const entry=data.byId.get('w:macchia|noun#stain'),plan=buildLesson(entry),slot=plan.wordLesson.slots[0],chapter=plan.chapters.find(chapter=>chapter.groups.some(group=>group.targets.some(target=>target.id===slot.targetId))),target={...chapter.groups.flatMap(group=>group.targets).find(target=>target.id===slot.targetId),shortWord:true,wordSlotId:slot.id};
 const step={type:'question',chapter,target,questionId:'word-question',variant:slot.variant,phase:'guided',format:slot.format},question=buildJourneyQuestion(entry,chapter,target,step),binding=createJourneyPracticeBinding({entry,plan,step,question,sessionId:'word-session'}),resolver=createPracticeSourceResolver();
 assert.deepEqual(resolver.resolve(binding).senses.map(sense=>sense.id),['it:macchia:noun:stain']);assert.equal(resolver.resolve({...binding,wordSlotId:plan.wordLesson.slots[1].id}),null);
});
test('hint output keeps complete examples internal and never displays their answer-bearing cards',async()=>{
 const f=fixture(),service=createAIService({practiceSources:f.resolver,runtime:{generate(){return JSON.stringify({participantId:'helper',text:'Pensa alla persona.',corrections:[]});}},languagePolicy:{version:'test-only',validate:()=>({ok:true})}});
 const result=await service.request({...f.request,task:'hint'});assert.deepEqual(result.teaching,[]);assert.equal(result.provenance.practiceSource.referenceIds.length,1);service.dispose();
});
test('practice help rejects a correction even when a supplied test rule would otherwise validate it',async()=>{
 const f=fixture(),rule={id:'test-only-registry-rule',verified:true,level:'A1',source:'https://example.test/reviewed-fixture',explanation:'Test-only source explanation.',confirmCorrection:()=>true};
 const resolver=createPracticeSourceResolver({resolveRuleLinks:()=>[rule]}),service=createAIService({practiceSources:resolver,runtime:{generate(){return JSON.stringify({participantId:'helper',text:'Guarda la scheda.',corrections:[{original:'ho venuto',replacement:'sono venuto',ruleId:rule.id}]});}},languagePolicy:{version:'test-only',validate:()=>({ok:true})}});
 await assert.rejects(service.request({...f.request,text:'ho venuto'}),/cannot issue a correction verdict/);service.dispose();
});
