import {buildConversationSummary} from './summary.js';
import {conversationReadiness,acquireConversationService,conversationProviderRevision} from './runtime.js';
import {createDraftRecovery,canRecoverDraft} from './draft-recovery.js';
const DRAFT_METADATA=['recognizedText','transcriptEdits','selectedHelp','policySnapshot','support','inputProvenance'];
const metadataOf=draft=>Object.fromEntries(Object.entries(draft||{}).filter(([key])=>DRAFT_METADATA.includes(key)));

// One controller belongs to one mounted thread and learner. Drafts and sent
// messages commit before inference; leaving/backgrounding cancels a reply.
export function createConversationController({repository,threadId,isCurrent=()=>true,lookup,resolveEntry,resolveRule=()=>null,onChange=()=>{},onReply=()=>{}}){
 let state=null,closed=false,closing=false,busy=false,sending=false,error=null,service=null,request=null,draftQueue=Promise.resolve(),draftFailure=null,draftSerial=0,knownDraft=null,draftTurnId=null,recoveryConflicts=[],generation=0,readSerial=0;
 const recovery=createDraftRecovery({...repository.owner,threadId}),clientId=crypto.randomUUID(),pendingWrites=[];
 let serviceRevision=-1,replySupport=null;
 const scope=`conversation:${repository.owner.profileId}:${repository.owner.learnerId}:${threadId}`;
 const current=()=>!closed&&isCurrent();
 const guard=()=>{if(!current())throw new DOMException('The conversation changed.','AbortError');};
 const publish=()=>{if(current()&&!closing)onChange({state,busy:busy||sending,error,recoveryConflict:recoveryConflicts[0]||null,readiness:conversationReadiness(),replySupport:replySupport?.sourceRevision===state?.thread.contentRevision&&replySupport.providerRevision===conversationProviderRevision()?replySupport:null});};
 const refresh=async()=>{const serial=++readSerial,next=await repository.read(threadId);guard();if(serial===readSerial)state=next;return next;};
 async function summary(){
  const source=await refresh(),result=buildConversationSummary({thread:source.thread,turns:source.turns,previous:source.summary},{lookup,resolveEntry,resolveRule});
  await repository.saveSummary(threadId,result,{sourceRevision:source.thread.contentRevision});await refresh();
 }
 async function cancel(){
  generation++;
  const pending=request;request=null;service?.cancelScope(scope);busy=false;
  if(pending&&current())await repository.cancelGeneration(threadId,pending.id);
  if(current()){await refresh();publish();}
 }
 async function reply({opening=false,task=null}={}){
  guard();if(closing)throw new DOMException('Conversation closing','AbortError');if(busy)return false;
  if(!conversationReadiness().written){error=conversationReadiness().reason;publish();return false;}
  busy=true;error=null;publish();
  const epoch=++generation,running=()=>current()&&generation===epoch,guardRun=()=>{if(!running())throw new DOMException('Reply cancelled.','AbortError');};let token;
  try{
   await draftQueue;if(draftFailure)throw draftFailure;
   await refresh();guardRun();
   const source=state,learner=[...source.turns].reverse().find(t=>t.role==='learner'),setup=source.thread.setup;
   if(!opening&&!learner)throw new Error('Write a message to continue.');
   if(!service||serviceRevision!==conversationProviderRevision()){service=await acquireConversationService({scope,isCurrent:current});serviceRevision=conversationProviderRevision();}guardRun();
   token=await repository.beginGeneration(threadId,{policyVersion:'conversation-v1'});guardRun();request=token;
   const response=await service.request({scope,task:task||(setup.mode==='coach'?'coach':'conversation'),opening,requestReplySupport:setup.support!=='free',level:setup.level,text:opening?'':learner.displayText,learnerName:setup.name,topic:setup.topic,register:setup.register||'informal',
    agreement:setup.agreement,support:setup.support,correctionStyle:setup.correctionStyle,participants:setup.participants.filter(p=>p.active!==false),
    protectedNames:[setup.name,...setup.participants.map(p=>p.name)].filter(Boolean),recognitionUncertain:!!learner?.inputProvenance?.recognitionUncertain,
    sourceRevision:token.sourceRevision,history:source.turns.filter(t=>['learner','partner'].includes(t.role)&&t.turnId!==learner?.turnId).map(t=>({role:t.role==='learner'?'user':'assistant',content:t.displayText,status:'committed'})),
    goal:setup.goal||null},{scope});
   guardRun();if(request!==token)throw new DOMException('Reply cancelled.','AbortError');
   const corrections=(response.corrections||[]).map(c=>({...c,sourceTurnId:learner?.turnId,sourceTurnRevision:learner?.revision}));
   const turn=await repository.commitTurn(threadId,{turnId:crypto.randomUUID(),role:'partner',participantId:response.message.participantId,originalText:response.message.text,
    correctionRefs:corrections,modelVersion:response.provenance?.runtime?.modelVersion||null,policySnapshot:{version:'conversation-v1',level:setup.level,correctionStyle:setup.correctionStyle},
    sourceContext:{...response.provenance,teaching:response.teaching||[],protectedNames:[setup.name,...setup.participants.map(p=>p.name)].filter(Boolean)}},{requestId:token.id});
   request=null;await summary();guardRun();replySupport=response.replySupport?{...response.replySupport,sourceRevision:state.thread.contentRevision,providerRevision:conversationProviderRevision(),partnerTurnId:turn.turnId}:null;try{onReply(turn);}catch{}return turn;
  }catch(caught){
   if(token&&current())await repository.cancelGeneration(threadId,token.id).catch(()=>{});
   if(running()&&caught.name!=='AbortError')error=caught.name==='AIValidationError'?'The reply needs another check. Your message is saved; try again.':caught.message;
   return false;
  }finally{if(request===token)request=null;if(running()){busy=false;await refresh().catch(()=>{});if(running())publish();}}
 }
 return {
  get state(){return state;},get busy(){return busy||sending;},get error(){return error;},
  async load(){
   await refresh();
   for(const mirror of recovery.list()){
    if(state.draft?.writeId===mirror.writeId||state.turns.some(t=>t.turnId===mirror.turnId&&t.originalText===mirror.typedText))recovery.clear(mirror.writeId);
    else if(canRecoverDraft(mirror,state)){
     const metadata=metadataOf(mirror.metadata);
     if(mirror.mode==='recorded'&&!metadata.inputProvenance)metadata.inputProvenance={mode:'recorded',recognitionUncertain:true,recoveredWithoutProvenance:true};
     await repository.saveDraft(threadId,{...metadata,typedText:mirror.typedText,turnId:mirror.turnId,mode:mirror.mode||'written',clientId:mirror.clientId,writeId:mirror.writeId},{expectedRevision:state.draft?.revision||0});recovery.clear(mirror.writeId);await refresh();
    }
    else recoveryConflicts.push(mirror);
   }
   knownDraft=state.draft;draftTurnId=knownDraft?.turnId||null;if(state.thread.pending)await repository.cancelGeneration(threadId,state.thread.pending.id);await summary();publish();return state;
  },
  saveDraft(typedText,extras={}){
   guard();if(closing)return Promise.reject(new DOMException('Conversation closing','AbortError'));
   if(recoveryConflicts.length)return Promise.reject(new Error('Save the recovered draft before writing a new one.'));
   const serial=++draftSerial,turnId=draftTurnId ||= knownDraft?.turnId||crypto.randomUUID(),writeId=crypto.randomUUID();
   const priorWriteIds=pendingWrites.slice(-1000);pendingWrites.push(writeId);
   recovery.write({typedText,metadata:{...metadataOf(knownDraft),...metadataOf(extras)},mode:extras.mode||knownDraft?.mode||'written',turnId,clientId,writeId,base:{revision:knownDraft?.revision||0,writeId:knownDraft?.writeId||null},priorWriteIds});
   const write=draftQueue.catch(()=>{}).then(async()=>{
    guard();const previous=knownDraft,content=metadataOf(previous);
    const saved=await repository.saveDraft(threadId,{...content,...extras,typedText,mode:extras.mode||previous?.mode||'written',turnId:previous?.turnId||turnId,clientId,writeId},{expectedRevision:previous?.revision||0});
    guard();knownDraft=saved;draftFailure=null;recovery.clear(writeId);pendingWrites.splice(pendingWrites.indexOf(writeId),1);if(state)state={...state,draft:saved};if(serial===draftSerial)publish();return saved;
   });
   draftQueue=write.catch(caught=>{draftFailure=caught;error='Your draft could not be saved. Keep this page open and retry.';publish();});
   return write;
  },
  async send({strictAccents=false}={}){
   guard();if(busy||sending)return {committed:false,turnId:null,reply:null,error:'A reply is already in progress.'};sending=true;publish();
   let committed=null;
   try{
    await draftQueue;if(draftFailure)throw draftFailure;await refresh();
    const draft=state.draft;if(!draft?.typedText?.trim())return {committed:false,turnId:null,reply:null,error:'Write or record a message first.'};
    if(draft.revision!==knownDraft?.revision||draft.turnId!==knownDraft?.turnId)throw new Error('This draft changed in another window. Reopen the conversation before sending.');
    const snapshot={strictAccents,level:state.thread.setup.level,support:state.thread.setup.support,version:'conversation-v1'};
    committed=await repository.commitTurn(threadId,{turnId:draft.turnId,role:'learner',participantId:'learner',originalText:draft.typedText,displayText:draft.typedText,submittedText:draft.typedText,
     inputProvenance:draft.inputProvenance||{mode:draft.mode||'written',assistance:draft.selectedHelp||[]},policySnapshot:snapshot},{expectedRevision:state.thread.revision,draftRevision:draft.revision});
    knownDraft=null;draftTurnId=null;await summary();publish();const partner=await reply();return {committed:true,turnId:committed.turnId,reply:partner||null,error:partner?null:error};
   }catch(caught){
    if(current()&&caught.name!=='AbortError'){error=caught.message;publish();}
    return {committed:!!committed,turnId:committed?.turnId||null,reply:null,error:caught.message};
   }finally{sending=false;publish();}
  },
  reply,cancel,
  async help(){
   guard();if(busy||sending)return null;if(!conversationReadiness().written)throw new Error(conversationReadiness().reason);
   busy=true;error=null;publish();const epoch=++generation;
   try{
    await draftQueue;if(draftFailure)throw draftFailure;await refresh();const sourceRevision=state.thread.contentRevision,setup=state.thread.setup;
    if(!service||serviceRevision!==conversationProviderRevision()){service=await acquireConversationService({scope,isCurrent:current});serviceRevision=conversationProviderRevision();}
    const response=await service.request({scope,task:state.draft?.typedText.trim()?'intent':'hint',text:state.draft?.typedText.trim()||'Aiutami a rispondere.',level:setup.level,requestReplySupport:true,support:setup.support,sourceRevision,learnerName:setup.name,topic:setup.topic,register:setup.register||'informal',agreement:setup.agreement,participants:setup.participants.filter(p=>p.active!==false),history:state.turns.filter(t=>['learner','partner'].includes(t.role)).map(t=>({role:t.role==='learner'?'user':'assistant',content:t.displayText,status:'committed'}))},{scope});
    guard();if(generation!==epoch)throw new DOMException('Help cancelled.','AbortError');await refresh();if(state.thread.contentRevision!==sourceRevision)throw new Error('The conversation changed. Ask for help again.');
    replySupport=response.replySupport?{...response.replySupport,sourceRevision,providerRevision:conversationProviderRevision(),partnerTurnId:state.turns.at(-1)?.turnId}:null;
    if(!replySupport)error='No checked reply suggestion is available. You can still look up words or write your own reply.';return replySupport;
   }catch(caught){if(current()&&generation===epoch&&caught.name!=='AbortError')error=caught.message;return null;}
   finally{if(current()&&generation===epoch){busy=false;publish();}}
  },
  async refresh(){await refresh();publish();return state;},
  recoverText(){return recoveryConflicts[0]?.typedText||'';},
  dismissRecoveredDraft(){if(recoveryConflicts.length)recovery.clear(recoveryConflicts.shift().writeId);publish();},
  async edit(turnId,displayText){await cancel();const turn=state.turns.find(t=>t.turnId===turnId);if(!turn||turn.role!=='learner')throw new Error('Choose one of your messages to edit.');await repository.reviseTurn(threadId,turnId,{displayText,expectedRevision:turn.revision});await summary();publish();},
  async configure(patch){await cancel();replySupport=null;const setup={...state.thread.setup,...patch};await repository.updateThread(threadId,{setup},{expectedRevision:state.thread.revision});await summary();publish();},
  async chooseMeaning(itemId,entryId){
   await cancel();const item=state.summary?.items.find(item=>item.id===itemId&&item.kind==='meaning-choice'),candidate=item?.candidates.find(c=>c.entryId===entryId),ref=item?.sourceRefs[0];
   if(!candidate||!ref)throw new Error('The word or its meaning changed. Reopen the conversation notes.');
   await repository.chooseMeaning(threadId,ref.turnId,{start:ref.start,end:ref.end,quote:ref.quote,entryId,senseId:candidate.senseId},{expectedRevision:ref.revision});await summary();publish();
  },
  async addNote(turnId,text){await refresh();const turn=state.turns.find(t=>t.turnId===turnId);if(!turn)throw new Error('The source message changed.');const result=buildConversationSummary({thread:state.thread,turns:state.turns,previous:state.summary},{lookup,resolveEntry,resolveRule});result.items.push({id:crypto.randomUUID(),kind:'note',author:'learner',text,sourceRefs:[{turnId,revision:turn.revision}]});await repository.saveSummary(threadId,result,{sourceRevision:state.thread.contentRevision});await refresh();publish();},
  async dispose(){if(closed||closing)return;closing=true;await cancel().catch(()=>{});await draftQueue;closed=true;service?.cancelScope(scope);repository.close();},
 };
}
