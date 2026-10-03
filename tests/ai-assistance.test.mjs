import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistanceController,restoreAssistanceDraft} from '../js/learning/ai-assistance.js';
import {createAIService,createGrounding,prepareTask} from '../js/ai/index.js';
import {sourceFingerprint} from '../js/ai/source-fingerprint.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const source=()=>({sourceId:'lesson:question:one',owner:{profileId:'p',learnerId:'l'},epochId:'initial',level:'A1',prompt:'Say what you need',context:'At a ticket office',answers:['casa']});
function fixture({available=true,reply='Due biglietti, per favore.',delay=null,onUse=()=>{}}={}){
 let current=source(),installed=1,listener=()=>{};const drafts=[],viewed=[],requests=[];let acquired=0,cancelled=0;
 // Explicit test-only runtime/policy fixture. It is never installed in the app.
 const service=createAIService({practiceSources:{resolve(binding,{request}){return {version:'test-only-source',bindingFingerprint:sourceFingerprint(binding),sourceId:request.helpContext.sourceId,prompt:request.helpContext.prompt,context:request.helpContext.context||'',senses:[],rules:[],references:[{kind:'authored-example',id:'test-only-example',it:'Ciao.',level:'A1',reviewed:true,sourceRevision:'test-only'}]};}},runtime:{async generate(task){requests.push(task);if(delay)await delay.promise;return JSON.stringify({participantId:'helper',text:reply,corrections:[]});}},languagePolicy:{version:'test-only-language-fixture',async validate(){return{ok:true};}}});
 const controller=createAssistanceController({getSource:()=>current,isCurrent:()=>true,onDraft:row=>drafts.push(row),onViewed:row=>viewed.push(row),onUse,
  acquire:async()=>{acquired++;return{request:(...args)=>service.request(...args),cancelScope:scope=>{cancelled++;service.cancelScope(scope);}};},readiness:()=>({written:available}),providerRevision:()=>installed,onProviderChange:fn=>{listener=fn;return()=>{};}});
 return{controller,drafts,viewed,requests,get acquired(){return acquired;},get cancelled(){return cancelled;},changeSource(patch){current={...current,...patch};},changeProvider(){installed++;listener();},dispose(){controller.dispose();service.dispose();}};
}
test('unavailable help retains the original intention without acquiring or generating',async()=>{
 const f=fixture({available:false});await f.controller.setDraft('I would like two tickets');await assert.rejects(f.controller.request('intent'),/not available/);
 assert.equal(f.drafts.at(-1).originalText,'I would like two tickets');assert.equal(f.acquired,0);assert.equal(f.requests.length,0);f.dispose();
});
test('accepted intent is source-bound and assisted, preserves the original and uses a task-specific prompt',async()=>{
 let applied;const f=fixture({onUse:row=>{applied=row;}});await f.controller.setDraft('I would like two tickets');const result=await f.controller.request('intent');
 assert.equal(result.message.text,'Due biglietti, per favore.');assert.equal(f.controller.snapshot.draft,'I would like two tickets');assert.equal(f.viewed.length,1);assert.equal(f.viewed[0].assisted,true);
 assert.match(f.viewed[0].sourceRevision,/^help:[a-f0-9]{64}$/);const user=JSON.parse(f.requests[0].messages.at(-1).content);assert.equal(user.text,'I would like two tickets');assert.equal(user.helpContext.sourceId,source().sourceId);
 assert(!f.requests[0].messages[0].content.includes('Preferisci il tè caldo'));assert.equal(JSON.parse(f.requests[0].responseFormat.schema).properties.corrections.maxItems,0);
 await f.controller.use();assert.equal(applied.provenance.originalText,'I would like two tickets');assert.equal(applied.source.owner.learnerId,'l');assert.equal(applied.text,result.message.text);f.dispose();
});
test('editing an intention cancels pending scoped work and a late suggestion cannot be used',async()=>{
 const delay=deferred(),f=fixture({delay});await f.controller.setDraft('Two tickets');const pending=f.controller.request();while(!f.requests.length)await new Promise(r=>setTimeout(r,0));
 await f.controller.setDraft('Three tickets');delay.resolve();assert.equal(await pending,null);assert.equal(f.viewed.length,0);assert.equal(f.controller.snapshot.draft,'Three tickets');assert(f.cancelled>0);await assert.rejects(f.controller.use(),{name:'AbortError'});f.dispose();
});
test('owner, epoch or exact exercise changes reject late replies before any viewed/use callback',async()=>{
 for(const patch of [{owner:{profileId:'p',learnerId:'other'}},{epochId:'reset'},{context:'A different sentence'}]){
  const delay=deferred(),f=fixture({delay});await f.controller.setDraft('Two tickets');const pending=f.controller.request();while(!f.requests.length)await new Promise(r=>setTimeout(r,0));
  f.changeSource(patch);delay.resolve();assert.equal(await pending,null);assert.equal(f.viewed.length,0);await assert.rejects(f.controller.use(),{name:'AbortError'});f.dispose();
 }
});
test('provider replacement cancels the consumer and cannot authorize a late reply',async()=>{
 const delay=deferred(),f=fixture({delay});await f.controller.setDraft('Two tickets');const pending=f.controller.request();while(!f.requests.length)await new Promise(r=>setTimeout(r,0));
 f.changeProvider();assert.equal(await pending,null);delay.resolve();assert.equal(f.viewed.length,0);assert.equal(f.controller.snapshot.response,null);f.dispose();
});
test('unvalidated service output and a hint revealing the actual answer are rejected',async()=>{
 const s=source(),c=createAssistanceController({getSource:()=>s,readiness:()=>({written:true}),onProviderChange:()=>()=>{},acquire:async()=>({request:async()=>({message:{text:'casa'}}),cancelScope(){}})});
 await c.setDraft('Help');assert.equal(await c.request(),null);assert.match(c.snapshot.error,/language checks/);c.dispose();
 const f=fixture({reply:'Usa casa.'});assert.equal(await f.controller.request('hint'),null);assert.equal(f.viewed.length,0);assert.match(f.controller.snapshot.error,/revealed the answer/);f.dispose();
});
test('explicit use is consumed once even when the host save is still pending',async()=>{
 let uses=0;const done=deferred(),f=fixture({onUse:()=>{uses++;return done.promise;}});await f.controller.setDraft('Two tickets');await f.controller.request();const use=f.controller.use();await assert.rejects(f.controller.use(),{name:'AbortError'});done.resolve();await use;assert.equal(uses,1);f.dispose();
});
test('restoration keeps only an exact-source original draft and never a generated response',()=>{
 const s=source(),saved={policyVersion:1,sourceFingerprint:JSON.stringify(s),originalText:'My original intention',response:{text:'invented saved output'}};
 assert.equal(restoreAssistanceDraft(saved,s),'My original intention');assert.equal(restoreAssistanceDraft(saved,{...s,epochId:'reset'}),'');
 const c=createAssistanceController({getSource:()=>s,saved,onProviderChange:()=>()=>{}});assert.equal(c.snapshot.draft,saved.originalText);assert.equal(c.snapshot.response,null);c.dispose();
});
test('failed original-draft persistence blocks generation and leaves recoverable text',async()=>{
 let acquired=0;const s=source(),c=createAssistanceController({getSource:()=>s,onProviderChange:()=>()=>{},readiness:()=>({written:true}),onDraft:()=>{throw new Error('Draft save failed');},acquire:()=>{acquired++;}});
 await assert.rejects(c.setDraft('Keep this original'),/Draft save failed/);assert.equal(await c.request(),null);assert.equal(acquired,0);assert.equal(c.snapshot.draft,'Keep this original');assert.match(c.snapshot.error,/Draft save failed/);c.dispose();
});
test('help context is bounded data and cannot be attached to a conversation task',()=>{
 const grounding=createGrounding().retrieve({text:'test',level:'A1'}),base={task:'hint',text:'Help',level:'A1',helpContext:{sourceId:'q',prompt:'Choose',context:'A sentence'}};
 const prepared=prepareTask(base,grounding);assert.equal(prepared.promptRevision,'source-bound-assistance-v1');assert(!prepared.messages[0].content.includes('Preferisci il tè caldo'));
 assert.throws(()=>prepareTask({...base,task:'conversation'},grounding),/help context/);assert.throws(()=>prepareTask({...base,helpContext:{context:'x'.repeat(4001)}},grounding),/help context/);
});
test('serialized object-key order does not lose an exact-source original draft',()=>{
 const current={...source(),helpSource:{scene:{id:'scene',it:'Ciao.',answers:['Ciao']} }};
 // Reorder nested scene keys as real canonical backup serialization does.
 const savedSource={...current,helpSource:{scene:{answers:['Ciao'],it:'Ciao.',id:'scene'}}};
 const saved={policyVersion:1,sourceFingerprint:JSON.stringify(savedSource),originalText:'Keep this'};
 assert.equal(restoreAssistanceDraft(saved,current),'Keep this');assert.equal(restoreAssistanceDraft(saved,{...current,helpSource:{scene:{answers:['Other'],it:'Ciao.',id:'scene'}}}), '');
});
