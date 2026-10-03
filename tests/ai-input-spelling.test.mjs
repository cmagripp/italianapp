import test from 'node:test';
import assert from 'node:assert/strict';
import {createInputSpellingValidator,assertValidatedInputSpelling,isValidatedInputSpelling,assertInputSpellingRequest} from '../js/ai/input-spelling.js';
import {createAIService} from '../js/ai/index.js';
import {preservesProtectedMeaning} from '../js/ai/validation.js';

// Explicit synthetic sources and meaning verifiers test the boundary only.
// This fixture is never installed as a product dictionary or provider.
const rows=[
 {id:'test:coffee',revision:'coffee-v1',forms:['caffè']},
 {id:'test:why',revision:'why-v1',forms:['perché']},
 {id:'test:be',revision:'be-v1',forms:['è']},
].map(row=>({...row,source:'https://example.test/explicit-spelling-fixture',reviewStatus:'independent-agent-review'}));
function context(text='Vorrei un caffe.',strictAccents=false){
 return {scope:'conversation:profile:learner:thread',sourceRevision:3,protectedNames:[],
  inputSubmission:{turnId:'learner-one',revision:1,originalText:text,submittedText:text,displayText:text,
   policySnapshot:{version:'conversation-v1',strictAccents,level:'A1',support:'free'},inputProvenance:{mode:'written'}}};
}
function proposal(ctx,candidate,tokens=['caffe']){
 const references=tokens.map(token=>{
  const row=token.toLowerCase().startsWith('caff')?rows[0]:token.toLowerCase().startsWith('perch')?rows[1]:rows[2];
  const base=ctx.inputSubmission.displayText.normalize('NFC'),start=base.indexOf(token.normalize('NFC'));
  return {id:row.id,revision:row.revision,start,end:start+token.normalize('NFC').length};
 });
 return {status:'candidate',candidate,references};
}
const policy=(confirmInterpretation=()=>true,registry={version:'test-fixture-v1',lookup:id=>rows.find(row=>row.id===id)})=>createInputSpellingValidator({registry,confirmInterpretation});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const request=ctx=>({task:'conversation',level:'A1',text:ctx.inputSubmission.displayText,scope:ctx.scope,sourceRevision:ctx.sourceRevision,inputSubmission:ctx.inputSubmission,protectedNames:ctx.protectedNames});
const reply=()=>JSON.stringify({participantId:'partner',text:'Lo vuoi caldo?',corrections:[]});
const language={version:'test-only-language',validate:()=>({ok:true})};

test('strict-off receipt restores only supported accents and retains immutable submission policy',async()=>{
 const ctx=context(),receipt=await policy().validate(proposal(ctx,'Vorrei un caffè.'),ctx);
 assert.equal(receipt.outcome,'restore-display');assert.equal(receipt.effectiveText,'Vorrei un caffè.');
 assert.equal(receipt.source.inputSubmission.originalText,'Vorrei un caffe.');assert.equal(receipt.comparison.accentStrict,false);
 assert.equal(receipt.comparison.policyVersion,1);assert.equal(receipt.masteryAwarded,false);assert.equal(receipt.assessment,'spelling-display-only');
 assert.deepEqual(receipt.differences,[{start:14,end:15,before:'e',after:'è',kind:'missing'}]);
 assert.equal(receipt.references[0].source,rows[0].source);assert.equal(assertValidatedInputSpelling(receipt,ctx),receipt);
});
test('strict-on returns supported spelling feedback without changing the effective learner message',async()=>{
 const ctx=context(undefined,true),receipt=await policy().validate(proposal(ctx,'Vorrei un caffè.'),ctx);
 assert.equal(receipt.outcome,'spelling-feedback');assert.equal(receipt.effectiveText,ctx.inputSubmission.displayText);
 assert.equal(receipt.candidateNFC,'Vorrei un caffè.');assert.equal(receipt.comparison.ok,false);assert.equal(receipt.masteryAwarded,false);
});
test('direction, uppercase and decomposed Unicode use NFC offsets while retaining raw originals',async()=>{
 const ctx=context('PERCHE\u0300 vuoi un caffe?'),receipt=await policy().validate(proposal(ctx,'PERCHÉ vuoi un caffè?',['PERCHE\u0300','caffe']),ctx);
 assert.equal(receipt.outcome,'restore-display');assert.equal(receipt.originalNFC,'PERCHÈ vuoi un caffe?');
 assert.equal(receipt.source.inputSubmission.originalText,'PERCHE\u0300 vuoi un caffe?');
 assert.deepEqual(receipt.differences[0],{start:5,end:6,before:'È',after:'É',kind:'direction'});
 assert.equal(receipt.effectiveText,'PERCHÉ vuoi un caffè?');
});
test('case, whitespace, punctuation, apostrophe, words, quantity and negation rewrites are rejected',async()=>{
 const ctx=context("Non voglio due caffe, per favore."),candidates=[
  "non voglio due caffè, per favore.","Non  voglio due caffè, per favore.","Non voglio due caffè, per favore!",
  "Non voglio due caffè, per' favore.","Non voglio tre caffè, per favore.","Voglio due caffè, per favore.",
  "Non volevo due caffè, per favore.",
 ];
 let calls=0;const validator=policy(()=>{calls++;return true;});
 for(const candidate of candidates){const receipt=await validator.validate(proposal(ctx,candidate),ctx);assert.equal(receipt.outcome,'unsupported');assert.equal(receipt.reason,'non-accent-rewrite');assert.equal(receipt.effectiveText,ctx.inputSubmission.displayText);}
 assert.equal(calls,0);
});
test('conjunction unchanged and unresolved e/è never trigger a blanket homograph replacement',async()=>{
 const ctx=context('Marco e Anna sono a casa.'),unchanged=await policy().validate({status:'unchanged'},ctx);
 assert.equal(unchanged.outcome,'unchanged');assert.equal(unchanged.effectiveText,ctx.inputSubmission.displayText);
 const ambiguous=context('Marco e a casa.'),receipt=await policy(()=>false).validate(proposal(ambiguous,'Marco è a casa.',['e']),ambiguous);
 assert.equal(receipt.outcome,'clarify');assert.equal(receipt.candidateNFC,null);assert.equal(receipt.effectiveText,ambiguous.inputSubmission.displayText);
});
test('a protected name resembling an unaccented dictionary form cannot be changed',async()=>{
 const ctx=context('Parlo con Caffe.'),p=proposal(ctx,'Parlo con Caffè.',['Caffe']);ctx.protectedNames=['Caffe'];
 let calls=0;const receipt=await policy(()=>{calls++;return true;}).validate(p,ctx);
 assert.equal(receipt.outcome,'unsupported');assert.equal(receipt.reason,'protected-meaning-change');assert.equal(calls,0);
});
test('every changed whole word requires an exact current reviewed registry reference',async()=>{
 const ctx=context(),p=proposal(ctx,'Vorrei un caffè.');
 for(const refs of [[],[...p.references,...p.references],[{...p.references[0],start:14,end:15}],[{...p.references[0],revision:'obsolete'}],[{...p.references[0],id:'invented'}]]){
  const receipt=await policy().validate({...p,references:refs},ctx);assert.equal(receipt.outcome,'unsupported');
 }
 const unreviewed=policy(()=>true,{version:'test-only',lookup:()=>({...rows[0],reviewStatus:'pending'})});
 assert.equal((await unreviewed.validate(p,ctx)).reason,'unreviewed-spelling-reference');
 const wrong=policy(()=>true,{version:'test-only',lookup:()=>({...rows[0],forms:['café']})});
 assert.equal((await wrong.validate(p,ctx)).reason,'reference-form-mismatch');
});
test('a review flag or grammatical candidate alone cannot substitute for independent interpretation',async()=>{
 const ctx=context(),p=proposal(ctx,'Vorrei un caffè.');
 const absent=createInputSpellingValidator({registry:{version:'test-only',lookup:()=>rows[0]}});
 assert.equal((await absent.validate(p,ctx)).outcome,'unsupported');
 assert.equal((await policy(()=>({ok:true})).validate(p,ctx)).outcome,'clarify');
 assert.equal((await policy().validate({...p,verified:true},ctx)).outcome,'unsupported');
});
test('a changed registry epoch during lookup or interpretation cannot mint display authority',async()=>{
 for(const phase of ['lookup','interpretation']){
  const registry={version:'test-v1',lookup(){if(phase==='lookup')registry.version='test-v2';return rows[0];}};
  const validator=policy(()=>{if(phase==='interpretation')registry.version='test-v2';return true;},registry),ctx=context();
  const receipt=await validator.validate(proposal(ctx,'Vorrei un caffè.'),ctx);
  assert.equal(receipt.outcome,'unsupported');assert.equal(receipt.reason,'spelling-registry-changed');
 }
});
test('JSON, imported lookalikes and structured clones lose receipt authority; minted receipts are deeply frozen',async()=>{
 const ctx=context(),receipt=await policy().validate(proposal(ctx,'Vorrei un caffè.'),ctx);
 assert.equal(isValidatedInputSpelling(receipt,ctx),true);
 for(const clone of [JSON.parse(JSON.stringify(receipt)),structuredClone(receipt),{...receipt}]){
  assert.equal(isValidatedInputSpelling(clone,ctx),false);assert.throws(()=>assertValidatedInputSpelling(clone,ctx),/unvalidated/);
 }
 assert.throws(()=>{receipt.source.inputSubmission.policySnapshot.strictAccents=true;},TypeError);
 assert.throws(()=>{receipt.references[0].form='invented';},TypeError);
});
test('receipt assertion binds exact source, saved policy, provenance, scope and revision independent of key order',async()=>{
 const ctx=context(),receipt=await policy().validate(proposal(ctx,'Vorrei un caffè.'),ctx);
 const ordered={...ctx,inputSubmission:{...ctx.inputSubmission,policySnapshot:{support:'free',level:'A1',strictAccents:false,version:'conversation-v1'}}};
 assert.equal(isValidatedInputSpelling(receipt,ordered),true);
 for(const change of [
  c=>c.scope+=':other',c=>c.sourceRevision++,c=>c.inputSubmission.turnId='other',c=>c.inputSubmission.revision++,
  c=>c.inputSubmission.originalText='changed',c=>c.inputSubmission.displayText='changed',c=>c.inputSubmission.submittedText=null,
  c=>c.inputSubmission.policySnapshot.strictAccents=true,c=>c.inputSubmission.inputProvenance.mode='recorded',
 ]){const changed=structuredClone(ctx);change(changed);assert.equal(isValidatedInputSpelling(receipt,changed),false);}
 ctx.inputSubmission.policySnapshot.strictAccents=true;assert.equal(receipt.source.inputSubmission.policySnapshot.strictAccents,false);
});
test('missing historical submission or policy preserves continuation with unsupported spelling',async()=>{
 for(const change of [c=>c.inputSubmission.submittedText=null,c=>c.inputSubmission.policySnapshot=null,c=>delete c.inputSubmission.policySnapshot.strictAccents,c=>c.inputSubmission.policySnapshot.version='unknown']){
  const ctx=context();change(ctx);const receipt=await policy().validate(proposal(ctx,'Vorrei un caffè.'),ctx);assert.equal(receipt.outcome,'unsupported');assert.equal(receipt.effectiveText,ctx.inputSubmission.displayText);
 }
});
test('recognized, confirmed and edited transcripts never acquire typed spelling penalties',async()=>{
 for(const strict of [false,true])for(const provenance of [
  {mode:'recorded',recognizedText:'Vorrei un caffe.',recognitionUncertain:false},
  {mode:'handsfree',recognizedText:'Vorrei un caffe.',transcriptEdits:[{before:'Vorrei un caffe.',after:'Vorrei un caffe, grazie.',at:1}],recognitionUncertain:false},
  {mode:'written',recognizedText:'Vorrei un caffe.',transcriptEdits:[],recognitionUncertain:false},
  null,
 ]){const ctx=context(undefined,strict);ctx.inputSubmission.inputProvenance=provenance;const receipt=await policy().validate(proposal(ctx,'Vorrei un caffè.'),ctx);assert.equal(receipt.outcome,'unsupported');assert.equal(receipt.reason,'spelling-attribution-unavailable');assert.equal(receipt.candidateNFC,null);assert.equal(receipt.effectiveText,ctx.inputSubmission.displayText);}
});
test('malformed descriptors and incompatible tasks cannot reach model inference',async()=>{
 let calls=0;const service=createAIService({runtime:{generate(){calls++;return reply();}},languagePolicy:language}),ctx=context();
 for(const mutate of [r=>delete r.inputSubmission.revision,r=>r.inputSubmission.authority='invented',r=>r.text='another message',r=>r.task='intent',r=>r.opening=true]){
  const r=structuredClone(request(ctx));mutate(r);await assert.rejects(service.request(r),TypeError);
 }
 assert.equal(calls,0);service.dispose();assert.equal(assertInputSpellingRequest({task:'conversation'}),null);
});
test('service uses verified effective text for grounding, model prompt, language and correction source validation',async()=>{
 const ctx=context(),seen=[],rule={id:'test:correction',verified:true,source:'test-only rule',explanation:'Explicit fixture only.',level:'A1',confirmCorrection:()=>true};
 const service=createAIService({inputSpelling:{validator:policy(),checkInput:r=>{seen.push(['check',r.text]);return proposal(ctx,'Vorrei un caffè.');}},
  grounding:{retrieve(r){seen.push(['grounding',r.text]);return {version:'test-only',senses:[],rules:[rule]};}},
  runtime:{generate(task){seen.push(['prompt',JSON.parse(task.messages.at(-1).content).text]);return JSON.stringify({participantId:'partner',text:'Lo vuoi caldo?',corrections:[{original:'caffè',replacement:'caffè',ruleId:rule.id}]});}},
  languagePolicy:{version:'test-only',validate(text,{request:r}){seen.push(['language',r.text]);return {ok:true};}},
  isCurrent:r=>r.text===ctx.inputSubmission.displayText,
 });
 const result=await service.request(request(ctx));assert.equal(result.corrections[0].original,'caffè');assert.equal(result.inputSpelling.outcome,'restore-display');assert.equal(isValidatedInputSpelling(result.inputSpelling,ctx),true);
 assert.deepEqual(seen,[['check','Vorrei un caffe.'],['grounding','Vorrei un caffè.'],['prompt','Vorrei un caffè.'],['language','Vorrei un caffè.']]);
 assert.equal(ctx.inputSubmission.displayText,'Vorrei un caffe.');service.dispose();
});
test('strict-on service uses original display and omits authority descriptors from model input',async()=>{
 const ctx=context(undefined,true);let captured;
 const service=createAIService({inputSpelling:{validator:policy(),checkInput:()=>proposal(ctx,'Vorrei un caffè.')},runtime:{generate(task){captured=task;return reply();}},languagePolicy:language});
 const result=await service.request(request(ctx)),user=JSON.parse(captured.messages.at(-1).content);
 assert.equal(user.text,'Vorrei un caffe.');assert.equal(user.inputSubmission,undefined);assert.equal(user.turnId,undefined);
 assert.equal(result.inputSpelling.outcome,'spelling-feedback');service.dispose();
});
test('absent or failed checker produces unsupported receipt and preserves an ordinary reply, including legacy null submission',async()=>{
 for(const variant of ['absent','failed','legacy']){
  const ctx=context();if(variant==='legacy')ctx.inputSubmission.submittedText=null;
  let captured,calls=0;const service=createAIService({...(variant==='failed'?{inputSpelling:{validator:policy(),checkInput(){throw new Error('Unavailable');}}}:{}),
   runtime:{generate(task){calls++;captured=task;return reply();}},languagePolicy:language});
  const result=await service.request(request(ctx));assert.equal(result.inputSpelling.outcome,'unsupported');assert.equal(JSON.parse(captured.messages.at(-1).content).text,'Vorrei un caffe.');assert.equal(calls,1);service.dispose();
 }
});
test('cancellation or original-source replacement during spelling preflight stops inference',async()=>{
 for(const phase of ['checker','interpretation']){
  const ctx=context(),started=deferred(),release=deferred();let current=true,calls=0;
  const validator=policy(async()=>{if(phase==='interpretation'){started.resolve();await release.promise;}return true;});
  const service=createAIService({inputSpelling:{validator,async checkInput(){if(phase==='checker'){started.resolve();await release.promise;}return proposal(ctx,'Vorrei un caffè.');}},
   runtime:{generate(){calls++;return reply();}},languagePolicy:language,isCurrent:()=>current});
  const pending=service.request(request(ctx));await started.promise;
  if(phase==='checker')service.cancelScope(ctx.scope);else current=false;release.resolve();
  await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,0);service.dispose();
 }
});
test('model-authored receipt fields and unbranded checker output cannot authorize an edit',async()=>{
 const ctx=context();let calls=0;
 const fake=createAIService({inputSpelling:{checkInput:()=>proposal(ctx,'Vorrei un caffè.'),validator:{validate:()=>({version:1,outcome:'restore-display',effectiveText:'invented'})}},
  runtime:{generate(){calls++;return reply();}},languagePolicy:language});
 await assert.rejects(fake.request(request(ctx)),/unvalidated/);assert.equal(calls,0);fake.dispose();
 const service=createAIService({runtime:{generate:()=>JSON.stringify({participantId:'partner',text:'Lo vuoi caldo?',corrections:[],inputSpelling:{outcome:'restore-display'}})},languagePolicy:language});
 await assert.rejects(service.request(request(ctx)),/unexpected response fields/);service.dispose();
});

test('ordinary response rules cannot bypass the spelling boundary for confirmed or mixed recognized input',async()=>{
 const rule={id:'test:accent-correction',verified:true,source:'https://example.test/independent-accent-rule',explanation:'Explicit fixture only.',level:'A1',confirmCorrection:correction=>correction.original==='caffe'&&correction.replacement==='caffè'};
 for(const strict of [false,true])for(const provenance of [{mode:'recorded',recognitionUncertain:false},{mode:'handsfree',recognitionUncertain:false},{mode:'written',recognizedText:'Vorrei un caffe.',recognitionUncertain:false},{mode:'typed',transcriptEdits:[],recognitionUncertain:false}]){
  const ctx=context(undefined,strict);ctx.inputSubmission.inputProvenance=provenance;
  const service=createAIService({grounding:{retrieve:()=>({version:'test-only',senses:[],rules:[rule]})},runtime:{generate:()=>JSON.stringify({participantId:'partner',text:'Lo vuoi caldo?',corrections:[{original:'caffe',replacement:'caffè',ruleId:rule.id}]})},languagePolicy:language});
  await assert.rejects(service.request({...request(ctx),recognitionUncertain:false}),/recognition or mixed input cannot receive an accent-only spelling correction/);service.dispose();
 }
 const typed=context(),service=createAIService({grounding:{retrieve:()=>({version:'test-only',senses:[],rules:[rule]})},runtime:{generate:()=>JSON.stringify({participantId:'partner',text:'Lo vuoi caldo?',corrections:[{original:'caffe',replacement:'caffè',ruleId:rule.id}]})},languagePolicy:language});
 assert.equal((await service.request(request(typed))).corrections[0].replacement,'caffè');service.dispose();
});
test('confirmed recognition still permits independently supported grammatical corrections',async()=>{
 const ctx=context('Io vuole un caffe.');ctx.inputSubmission.inputProvenance={mode:'recorded',recognizedText:'Io vuole un caffe.',recognitionUncertain:false};
 const rule={id:'test:grammar-correction',verified:true,source:'https://example.test/independent-grammar-rule',explanation:'Explicit fixture only.',level:'A1',confirmCorrection:correction=>correction.original==='Io vuole'&&correction.replacement==='Io voglio'};
 const service=createAIService({grounding:{retrieve:()=>({version:'test-only',senses:[],rules:[rule]})},runtime:{generate:()=>JSON.stringify({participantId:'partner',text:'Lo vuoi caldo?',corrections:[{original:'Io vuole',replacement:'Io voglio',ruleId:rule.id}]})},languagePolicy:language});
 const result=await service.request({...request(ctx),recognitionUncertain:false});assert.equal(result.inputSpelling.outcome,'unsupported');assert.equal(result.corrections[0].replacement,'Io voglio');service.dispose();
});

test('decomposed protected names retain exact accents through NFC spelling and ordinary correction checks',async()=>{
 const name='Jose\u0301';assert.equal(preservesProtectedMeaning('Parlo con José.','Parlo con Josè.',[name]),false);
 assert.equal(preservesProtectedMeaning('Parlo con Jose\u0301.','Parlo con José.',[name]),true);
 assert.equal(preservesProtectedMeaning('Non parlo con Jose\u0301.','Non parlo con José.',[name]),true);
 const ctx=context('Parlo con Jose\u0301.');ctx.protectedNames=[name];let called=0;
 const registry={version:'test-only-name-v1',lookup:id=>({id,revision:'name-v1',source:'https://example.test/name-fixture',reviewStatus:'independent-agent-review',forms:['Josè']})};
 const validator=createInputSpellingValidator({registry,confirmInterpretation:()=>{called++;return true;}});
 const receipt=await validator.validate({status:'candidate',candidate:'Parlo con Josè.',references:[{id:'test:name',revision:'name-v1',start:10,end:14}]},ctx);
 assert.equal(receipt.outcome,'unsupported');assert.equal(receipt.reason,'protected-meaning-change');assert.equal(called,0);assert.equal(receipt.source.inputSubmission.originalText,'Parlo con Jose\u0301.');
 const same=await validator.validate({status:'candidate',candidate:'Parlo con José.',references:[]},ctx);assert.equal(same.outcome,'unchanged');assert.equal(same.effectiveText,'Parlo con Jose\u0301.');
 const ordinary=context('Parlo con José.');ordinary.protectedNames=[name];const rule={id:'test:name-correction',verified:true,source:'https://example.test/name-fixture',explanation:'Explicit fixture only.',level:'A1',confirmCorrection:()=>true};
 const service=createAIService({grounding:{retrieve:()=>({version:'test-only',senses:[],rules:[rule]})},runtime:{generate:()=>JSON.stringify({participantId:'partner',text:'Va bene.',corrections:[{original:'José',replacement:'Josè',ruleId:rule.id}]})},languagePolicy:language});
 await assert.rejects(service.request(request(ordinary)),/correction changes protected meaning/);service.dispose();
});
