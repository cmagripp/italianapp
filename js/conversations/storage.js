// Conversations are local records, separate from the profile's progress JSON
// and from downloaded models. Successful writes mean a completed transaction.
export const CONVERSATION_SCHEMA_VERSION=1;
import {assertValidatedInputSpelling} from '../ai/input-spelling.js';
import {clearProfileDraftRecovery,createDraftRecovery,draftStorage} from './draft-recovery.js';
const DB='parola-conversations',STORES=['threads','turns','drafts','summaries','recordings','snapshots'];
const LEVELS=['A1','A2','B1','B2','C1','C2'];
export class ConversationConflict extends Error {constructor(message='This conversation changed. Reload it before saving.'){super(message);this.name='ConversationConflict';}}
const text=(value,max=100000)=>{if(typeof value!=='string'||value.length>max)throw new TypeError('Invalid conversation text');return value;};
const id=value=>{text(value,200);if(!value||/\p{C}/u.test(value))throw new TypeError('Invalid conversation identity');return value;};
const clone=value=>structuredClone(value);
const now=()=>Date.now();
const uuid=()=>crypto.randomUUID();
const TURN_CONTENT=['turnId','role','participantId','originalText','displayText','submittedText','inputProvenance','acceptedEdits','correctionRefs','policySnapshot','modelVersion','sourceContext','revision','sequence','at'];
const canonical=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
const stable=value=>JSON.stringify(canonical(value));
const inputSubmissionOf=turn=>Object.fromEntries(['turnId','revision','originalText','submittedText','displayText','policySnapshot','inputProvenance'].map(key=>[key,turn[key]??null]));
const sameTurn=(a,b)=>stable(Object.fromEntries(TURN_CONTENT.map(k=>[k,a[k]])))===stable(Object.fromEntries(TURN_CONTENT.map(k=>[k,b[k]])));
const sameSubmission=(a,b)=>{const fields=TURN_CONTENT.filter(k=>!['revision','sequence','at'].includes(k));return stable(Object.fromEntries(fields.map(k=>[k,k==='displayText'?a.displayText??a.originalText:a[k]])))===stable(Object.fromEntries(fields.map(k=>[k,k==='displayText'?b.displayText??b.originalText:b[k]])));};
const sameDraft=(a,b)=>stable(Object.fromEntries(Object.entries(a).filter(([k])=>!['ownerId','revision','updatedAt'].includes(k))))===stable(Object.fromEntries(Object.entries(b).filter(([k])=>!['ownerId','revision','updatedAt'].includes(k))));
function validateSourceRange(item,ref,source){
 const derived=['vocabulary','meaning-choice','correction'].includes(item.kind),hasRange=['start','end','quote'].some(k=>k in ref);
 if(!derived&&!hasRange)return;
 if(!Number.isSafeInteger(ref.start)||!Number.isSafeInteger(ref.end)||ref.start<0||ref.end<=ref.start||ref.end>source.displayText.length||typeof ref.quote!=='string'||source.displayText.slice(ref.start,ref.end)!==ref.quote)throw new TypeError('A study note does not match its source words');
}
function safe(value,depth=0){
 if(depth>24)throw new TypeError('Conversation data is too deeply nested');
 if(value==null)return;
 if(typeof value==='number'&&!Number.isFinite(value))throw new TypeError('Invalid numeric conversation value');
 if(['function','symbol','bigint'].includes(typeof value))throw new TypeError('Invalid conversation value');
 if(typeof value!=='object')return;
 if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError('Recordings must be saved only through Save recording');
 for(const [key,child] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new TypeError('Unsafe conversation record');safe(child,depth+1);}
}
export function validateSetup(setup){
 safe(setup);if(!setup||!LEVELS.includes(setup.level))throw new TypeError('Choose a conversation level');
 const participants=setup.participants;
 if(!Array.isArray(participants)||participants.length<1||participants.length>3)throw new TypeError('Choose one to three conversation partners');
 const seen=new Set();
 for(const p of participants){id(p.id);text(p.name,100);if(!p.name.trim()||seen.has(p.id)||['learner','system'].includes(p.id)||p.active!=null&&typeof p.active!=='boolean')throw new TypeError('Partners need distinct identities');seen.add(p.id);}
 if(!participants.some(p=>p.active!==false))throw new TypeError('Keep at least one active conversation partner');
 if(setup.register!=null&&!['informal','formal'].includes(setup.register))throw new TypeError('Choose informal or polite address');
 if(setup.mode!=null&&!['conversation','coach'].includes(setup.mode))throw new TypeError('Choose a conversation or coach');
 if(setup.goal!=null)text(setup.goal,200);
 const agreement=setup.agreement || 'flexible';
 if(!['masculine','feminine','flexible'].includes(agreement))throw new TypeError('Invalid agreement preference');
 const support=setup.support || 'guided',correctionStyle=setup.correctionStyle || 'natural';
 if(!['guided','cloze','free'].includes(support)||!['natural','pause','afterward'].includes(correctionStyle))throw new TypeError('Invalid conversation support');
 return {...clone(setup),name:text(setup.name || '',100),topic:text(setup.topic || 'general',200),agreement,support,correctionStyle,participants:clone(participants)};
}
// Deleting a local user removes every learner identity previously imported
// into that profile, including archived threads and recovery snapshots.
export async function deleteConversationsForProfile(profileId,{indexedDB=globalThis.indexedDB,storage=draftStorage()}={}){
 id(profileId);if(!indexedDB){clearProfileDraftRecovery(profileId,storage);return;}
 const database=await new Promise((resolve,reject)=>{
  let absent=false,settled=false;const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{absent=true;request.transaction.abort();};
  request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;resolve(request.result);};
  request.onerror=()=>{if(settled)return;settled=true;absent?resolve(null):reject(request.error);};
  request.onblocked=()=>{settled=true;reject(new Error('Close other Parola windows before deleting this user.'));};
 });
 if(!database){clearProfileDraftRecovery(profileId,storage);return;}
 try{await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORES,'readwrite');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Conversation deletion did not finish. Retry deleting this user.'));
  for(const name of STORES){const request=tx.objectStore(name).openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;let owner;try{owner=JSON.parse(cursor.value.ownerId);}catch{}if(owner?.[0]===profileId)cursor.delete();cursor.continue();};}
 });clearProfileDraftRecovery(profileId,storage);}finally{database.close();}
}
export function createConversationRepository({profileId,learnerId,indexedDB=globalThis.indexedDB,isCurrent=()=>true,onError=()=>{}}={}){
 id(profileId);id(learnerId);
 const ownerId=JSON.stringify([profileId,learnerId]),owner={profileId,learnerId};
 let opening=null,connection=null,closed=false;const active=new Set();
 const assertOwner=()=>{if(closed||!isCurrent())throw new DOMException('The active learner or conversation changed.','AbortError');};
 const key=threadId=>[ownerId,id(threadId)];
 async function db(){
  assertOwner();
  if(!opening)opening=new Promise((resolve,reject)=>{
   if(!indexedDB)return reject(new Error('Conversation storage is unavailable on this device.'));
   const request=indexedDB.open(DB,1);let settled=false;
   request.onupgradeneeded=()=>{
    const db=request.result;
    for(const name of STORES){const keys=name==='turns'?['ownerId','threadId','turnId']:name==='recordings'?['ownerId','threadId','audioId']:name==='snapshots'?['ownerId','snapshotId']:['ownerId','threadId'];
     const store=db.createObjectStore(name,{keyPath:keys});store.createIndex('owner','ownerId');
     if(['turns','recordings'].includes(name))store.createIndex('thread',['ownerId','threadId']);
    }
   };
   request.onsuccess=()=>{const opened=request.result;if(settled||closed||!isCurrent()){opened.close();if(!settled)reject(new DOMException('Closed','AbortError'));return;}settled=true;connection=opened;connection.onversionchange=()=>{opened.close();if(connection===opened){connection=null;opening=null;}};resolve(opened);};
   request.onerror=()=>{settled=true;reject(request.error||new Error('Conversation storage could not open.'));};
   request.onblocked=()=>{settled=true;reject(new Error('Close the other Parola window, then retry saving.'));};
  }).catch(error=>{opening=null;throw error;});
  return opening;
 }
 async function transaction(names,mode,work,{signal,guard:requestGuard}={}){
  // Owner checks protect a mounted repository. Reply guards additionally bind
  // this transaction to one generation and provider, right through commit.
  const guard=()=>{assertOwner();if(signal?.aborted)throw new DOMException('Reply cancelled.','AbortError');requestGuard?.();};
  try{
   guard();const database=await db();guard();
   return await new Promise((resolve,reject)=>{
    const tx=database.transaction(names,mode);active.add(tx);let result,failure;
    const cleanup=()=>{active.delete(tx);signal?.removeEventListener('abort',abort);};
    const abort=()=>{failure ||= new DOMException('Reply cancelled.','AbortError');try{tx.abort();}catch{cleanup();reject(failure);}};
    const request=operation=>{guard();return new Promise((yes,no)=>{
     const req=operation();req.onsuccess=()=>{try{guard();yes(req.result);}catch(error){no(error);}};req.onerror=()=>no(req.error);
    });};
    const api={get:(name,k)=>request(()=>tx.objectStore(name).get(k)),all:(name,index,k)=>request(()=>tx.objectStore(name).index(index).getAll(k)),put:(name,value)=>request(()=>tx.objectStore(name).put(value)),del:(name,k)=>request(()=>tx.objectStore(name).delete(k)),guard};
    tx.oncomplete=()=>{cleanup();try{guard();resolve(result);}catch(error){reject(error);}};
    tx.onerror=tx.onabort=()=>{cleanup();reject(failure||tx.error||new Error('This conversation could not be saved. Your draft is kept.'));};
    signal?.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>{guard();return work(api);}).then(value=>{guard();result=value;}).catch(error=>{failure=error;abort();});
   });
  }catch(error){if(mode==='readwrite'&&error.name!=='AbortError'&&!(error instanceof ConversationConflict))onError(error);throw error;}
 }
 async function threadIn(tx,threadId,{allowDeleted=false,revision}={}){
  const thread=await tx.get('threads',key(threadId));tx.guard();
  if(!thread||(!allowDeleted&&thread.deletedAt))throw new ConversationConflict('This conversation was removed or is no longer available.');
  if(revision!=null&&thread.revision!==revision)throw new ConversationConflict();
  return thread;
 }
 const touch=(thread,{content=false}={})=>({...thread,updatedAt:now(),revision:thread.revision+1,contentRevision:thread.contentRevision+(content?1:0)});
 async function invalidateSummary(tx,thread,changedTurnId){
  const summary=await tx.get('summaries',key(thread.threadId));
  const items=(summary?.items||[]).map(item=>changedTurnId&&item.sourceRefs?.some(ref=>ref.turnId===changedTurnId)?{...item,invalidated:true}:item);
  await tx.put('summaries',{...(summary||{}),ownerId,threadId:thread.threadId,revision:(summary?.revision||0)+1,throughTurnRevision:summary?.throughTurnRevision||0,dirty:true,requiredRevision:thread.contentRevision,items,updatedAt:now()});
 }
 async function removeRecords(tx,name,threadId){
  const rows=await tx.all(name,'thread',key(threadId));
  for(const row of rows)await tx.del(name,[ownerId,threadId,name==='turns'?row.turnId:row.audioId]);
 }
 return {
  owner:clone(owner),
  async createThread(setup,{threadId=uuid(),title=''}={}){
   const checked=validateSetup(setup);id(threadId);
   const row={schemaVersion:1,ownerId,...owner,threadId,title:text(title||checked.topic,200),setup:checked,createdAt:now(),updatedAt:now(),revision:1,contentRevision:0,nextSequence:1,archived:false,deletedAt:null,pending:null};
   return transaction(['threads','drafts','summaries'],'readwrite',async tx=>{
    if(await tx.get('threads',key(threadId)))throw new ConversationConflict('That conversation already exists.');
    await tx.put('threads',row);return clone(row);
   });
  },
  async list({archived=false}={}){
   return transaction(['threads'],'readonly',async tx=>(await tx.all('threads','owner',ownerId)).filter(t=>!t.deletedAt&&t.archived===archived).sort((a,b)=>b.updatedAt-a.updatedAt||a.threadId.localeCompare(b.threadId)));
  },
  async read(threadId){
   return transaction(['threads','turns','drafts','summaries'],'readonly',async tx=>{
    const thread=await threadIn(tx,threadId),turns=await tx.all('turns','thread',key(threadId)),draft=await tx.get('drafts',key(threadId)),summary=await tx.get('summaries',key(threadId));
    tx.guard();return {thread,turns:turns.sort((a,b)=>a.sequence-b.sequence),draft:draft||null,summary:summary||null};
   });
  },
  async updateThread(threadId,patch,{expectedRevision}={}){
   safe(patch);if(Object.keys(patch).some(k=>!['title','archived','setup'].includes(k)))throw new TypeError('Unsupported conversation update');
   const values={...patch};if('title'in values)values.title=text(values.title,200);if('archived'in values&&typeof values.archived!=='boolean')throw new TypeError('Invalid archive status');if(values.setup)values.setup=validateSetup(values.setup);
   return transaction(['threads','turns','summaries'],'readwrite',async tx=>{const current=await threadIn(tx,threadId,{revision:expectedRevision});
    if(values.setup){const turns=await tx.all('turns','thread',key(threadId));if(turns.some(t=>(t.role==='partner'||t.sourceContext?.kind==='participant-change')&&!values.setup.participants.some(p=>p.id===(t.role==='partner'?t.participantId:t.sourceContext.participantId))))throw new TypeError('Keep previous partners in the conversation history; mark them inactive when they leave.');}
    const changed=values.setup&&stable(values.setup)!==stable(current.setup),row={...touch(current,{content:!!changed}),...values,pending:null};
    if(changed){
     for(const partner of values.setup.participants){
      const prior=current.setup.participants.find(p=>p.id===partner.id),wasActive=!!prior&&prior.active!==false,isActive=partner.active!==false;
      if(wasActive===isActive)continue;
      const action=isActive?'join':'leave',displayText=`${partner.name} ${isActive?'joined':'left'} the conversation.`;
      await tx.put('turns',{ownerId,threadId,turnId:uuid(),role:'system',participantId:'system',originalText:displayText,displayText,revision:1,sequence:row.nextSequence++,at:now(),history:[],sourceContext:{kind:'participant-change',participantId:partner.id,action}});
     }
     await invalidateSummary(tx,row);
    }
    await tx.put('threads',row);return row;});
  },
  async saveDraft(threadId,draft,{expectedRevision}={}){
   safe(draft);text(draft.typedText || '');if(draft.recognizedText!=null)text(draft.recognizedText);
   if(Object.keys(draft).some(k=>!['turnId','mode','typedText','recognizedText','transcriptEdits','selectedHelp','policySnapshot','support','inputProvenance','clientId','writeId'].includes(k)))throw new TypeError('Unsupported draft field');
   if(draft.clientId!=null)id(draft.clientId);if(draft.writeId!=null)id(draft.writeId);
   return transaction(['threads','drafts'],'readwrite',async tx=>{
    const thread=await threadIn(tx,threadId),previous=await tx.get('drafts',key(threadId));
    if(expectedRevision!=null&&(previous?.revision||0)!==expectedRevision)throw new ConversationConflict('A newer draft is already saved.');
    const row={...clone(draft),ownerId,threadId,turnId:id(draft.turnId||previous?.turnId||uuid()),revision:(previous?.revision||0)+1,updatedAt:now()};
    await tx.put('drafts',row);await tx.put('threads',{...thread,updatedAt:row.updatedAt});return row;
   });
  },
  async commitTurn(threadId,input,{expectedRevision,draftRevision,requestId,inputSpelling,signal,guard}={}){
   safe(input);const turnId=id(input.turnId),role=input.role;
   if(Object.keys(input).some(k=>!['turnId','role','participantId','originalText','displayText','submittedText','inputProvenance','acceptedEdits','correctionRefs','policySnapshot','modelVersion','sourceContext'].includes(k)))throw new TypeError('Unsupported message field');
   if(!['learner','partner','system'].includes(role))throw new TypeError('Invalid conversation role');
   const originalText=text(input.originalText),displayText=text(input.displayText??originalText);
   if(inputSpelling&&role!=='partner')throw new TypeError('Spelling receipts belong to a checked reply');
   const spellingScope=`conversation:${profileId}:${learnerId}:${threadId}`;
   const preparedInput=(receipt,sourceTurnRevision)=>receipt?{...input,sourceContext:{...input.sourceContext,inputSpelling:clone(receipt),inputSpellingSourceRevision:sourceTurnRevision},correctionRefs:(input.correctionRefs||[]).map(c=>c.sourceTurnId===receipt.source.inputSubmission.turnId&&c.sourceTurnRevision===receipt.source.inputSubmission.revision?{...c,sourceTurnRevision}:c)}:input;
   return transaction(['threads','turns','drafts','summaries'],'readwrite',async tx=>{
    // Check duplicate identity before the expected revision: a retry after a
    // successful commit returns that same turn, without advancing the thread.
    const thread=await threadIn(tx,threadId),existing=await tx.get('turns',[ownerId,threadId,turnId]);
    if(existing){
     const submitted=existing.revision===1?existing:existing.history?.find(row=>row.revision===1);
     if(inputSpelling){
      const saved=submitted?.sourceContext?.inputSpelling;
      if(!saved)throw new ConversationConflict('This reply has different spelling sources');
      assertValidatedInputSpelling(inputSpelling,{inputSubmission:saved.source.inputSubmission,scope:spellingScope,sourceRevision:saved.source.sourceRevision});
     }
     if(!submitted||!sameSubmission(submitted,preparedInput(inputSpelling,submitted.sourceContext?.inputSpellingSourceRevision)))throw new ConversationConflict('A different message already uses this identity.');return existing;
    }
    if(expectedRevision!=null&&thread.revision!==expectedRevision)throw new ConversationConflict();
    if(requestId&&(thread.pending?.status!=='pending'||thread.pending.id!==requestId||thread.pending.sourceRevision!==thread.contentRevision))throw new ConversationConflict('This reply belongs to an earlier version of the conversation.');
    if(role==='partner'&&!thread.setup.participants.some(p=>p.id===input.participantId&&p.active!==false))throw new TypeError('Unknown or inactive conversation partner');
    if(role==='learner'&&input.participantId!=='learner')throw new TypeError('Invalid learner identity');
    const draft=role==='learner'?await tx.get('drafts',key(threadId)):null;
    if(draftRevision!=null&&draft?.revision!==draftRevision)throw new ConversationConflict('Your draft changed before Send.');
    let sourceTurnRevision=null,changedTurnId=null;
    if(inputSpelling){
     if(!requestId)throw new ConversationConflict('Spelling checking needs the current reply');
     const source=await tx.get('turns',[ownerId,threadId,id(inputSpelling.source?.inputSubmission?.turnId)]);
     if(!source||source.role!=='learner')throw new ConversationConflict('The checked message is unavailable');
     assertValidatedInputSpelling(inputSpelling,{inputSubmission:inputSubmissionOf(source),scope:spellingScope,sourceRevision:thread.pending.sourceRevision});
     sourceTurnRevision=source.revision;
     if(inputSpelling.outcome==='restore-display'){
      const {history=[],...prior}=source;sourceTurnRevision++;
      await tx.put('turns',{...source,displayText:inputSpelling.effectiveText,revision:sourceTurnRevision,editedAt:now(),
       history:[...history,{...prior,editReason:'accent-restoration'}],
       sourceContext:{...source.sourceContext,inputSpelling:clone(inputSpelling),inputSpellingRevision:sourceTurnRevision}});
      changedTurnId=source.turnId;
     }
    }
    const row={...clone(preparedInput(inputSpelling,sourceTurnRevision)),ownerId,threadId,turnId,role,originalText,displayText,revision:1,sequence:thread.nextSequence,at:now(),history:[]};
    const next={...touch(thread,{content:true}),nextSequence:thread.nextSequence+1,pending:null};
    await tx.put('turns',row);await tx.put('threads',next);
    if(draft&&draft.turnId===turnId)await tx.del('drafts',key(threadId));
    await invalidateSummary(tx,next,changedTurnId);return row;
   },{signal,guard});
  },
  async reviseTurn(threadId,turnId,{displayText,submittedText,reason='learner-edit',expectedRevision}={}){
   text(displayText);if(submittedText!=null)text(submittedText);
   return transaction(['threads','turns','summaries'],'readwrite',async tx=>{
    const thread=await threadIn(tx,threadId),record=await tx.get('turns',[ownerId,threadId,id(turnId)]);
    if(!record||record.revision!==expectedRevision)throw new ConversationConflict();
    const {history=[],...prior}=record;
    const row={...record,displayText,submittedText:submittedText??record.submittedText,revision:record.revision+1,editedAt:now(),history:[...history,{...prior,editReason:reason}],correctionRefs:[]};
    const next={...touch(thread,{content:true}),pending:null};await tx.put('turns',row);await tx.put('threads',next);await invalidateSummary(tx,next,turnId);return row;
   });
  },
  async beginGeneration(threadId,{requestId=uuid(),modelVersion,policyVersion,signal,guard}={}){
   return transaction(['threads'],'readwrite',async tx=>{const thread=await threadIn(tx,threadId),pending={id:id(requestId),sourceRevision:thread.contentRevision,status:'pending',startedAt:now(),modelVersion,policyVersion};await tx.put('threads',{...thread,pending});return pending;},{signal,guard});
  },
  async chooseMeaning(threadId,turnId,choice,{expectedRevision}={}){
   safe(choice);id(choice.entryId);if(choice.senseId!=null)id(choice.senseId);
   if(Object.keys(choice).some(key=>!['start','end','quote','entryId','senseId'].includes(key)))throw new TypeError('Invalid meaning selection');
   return transaction(['threads','turns','summaries'],'readwrite',async tx=>{
    const thread=await threadIn(tx,threadId),record=await tx.get('turns',[ownerId,threadId,id(turnId)]);
    if(!record||record.revision!==expectedRevision)throw new ConversationConflict();
    validateSourceRange({kind:'vocabulary'},choice,record);
    const {history=[],...prior}=record,revision=record.revision+1;
    const choices=(record.sourceContext?.lexicalChoices||[]).filter(c=>c.start!==choice.start||c.end!==choice.end).map(c=>({...c,revision}));
    choices.push({...clone(choice),revision});
    const row={...record,revision,history:[...history,{...prior,editReason:'meaning-selection'}],sourceContext:{...record.sourceContext,lexicalChoices:choices}};
    const next={...touch(thread,{content:true}),pending:null};await tx.put('turns',row);await tx.put('threads',next);await invalidateSummary(tx,next,turnId);return row;
   });
  },
  async cancelGeneration(threadId,requestId){
   return transaction(['threads'],'readwrite',async tx=>{const thread=await threadIn(tx,threadId);if(thread.pending?.id!==requestId)return false;await tx.put('threads',{...thread,pending:null});return true;});
  },
  async saveSummary(threadId,summary,{sourceRevision}={}){
   safe(summary);if(!Array.isArray(summary.items))throw new TypeError('A summary needs source-linked items');
   return transaction(['threads','turns','summaries'],'readwrite',async tx=>{
    const thread=await threadIn(tx,threadId);if(thread.contentRevision!==sourceRevision)throw new ConversationConflict('New messages need a fresh summary.');
    const turns=await tx.all('turns','thread',key(threadId)),byId=new Map(turns.map(t=>[t.turnId,t]));
    for(const item of summary.items){if(!item.sourceRefs?.length)throw new TypeError('Summary items need message sources');for(const ref of item.sourceRefs){const source=byId.get(ref.turnId),historical=item.kind==='note'&&item.author==='learner'&&item.invalidated===true&&source?.history?.find(h=>h.revision===ref.revision);if(!source||!Number.isSafeInteger(ref.revision)||ref.revision<1||source.revision!==ref.revision&&!historical)throw new ConversationConflict('A summary source changed.');validateSourceRange(item,ref,historical||source);}}
    const previous=await tx.get('summaries',key(threadId)),row={...clone(summary),ownerId,threadId,revision:(previous?.revision||0)+1,throughTurnRevision:sourceRevision,requiredRevision:sourceRevision,dirty:false,updatedAt:now()};await tx.put('summaries',row);return row;
   });
  },
  async saveRecording(threadId,turnId,blob,{consentAt,audioId=uuid(),duration}={}){
   if(!Number.isFinite(consentAt)||consentAt<=0)throw new TypeError('Save recording requires an explicit choice.');
   if(!(blob instanceof Blob)||blob.size>64*1024*1024)throw new TypeError('This recording cannot be saved.');
   const bytes=await blob.arrayBuffer(),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');assertOwner();
   return transaction(['threads','turns','recordings'],'readwrite',async tx=>{
    await threadIn(tx,threadId);const turn=await tx.get('turns',[ownerId,threadId,id(turnId)]);if(!turn)throw new ConversationConflict('Send the message before saving its recording.');
    const previous=await tx.get('recordings',[ownerId,threadId,id(audioId)]);
    if(previous&&(previous.turnId!==turnId||previous.sha256!==sha256||previous.mimeType!==(blob.type||'audio/webm')))throw new ConversationConflict('A different recording already uses this identity.');
    if(previous)return {audioId,consentAt:previous.consentAt,mimeType:previous.mimeType,bytes:previous.byteLength,duration:previous.duration,sha256};
    const row={ownerId,threadId,turnId,audioId:id(audioId),consentAt,mimeType:blob.type||'audio/webm',bytes,byteLength:bytes.byteLength,sha256,duration:Number(duration)||0,createdAt:now()};await tx.put('recordings',row);
    const metadata={audioId,consentAt,mimeType:row.mimeType,bytes:bytes.byteLength,duration:row.duration,sha256};
    await tx.put('turns',{...turn,recordingRefs:[...(turn.recordingRefs||[]).filter(r=>r.audioId!==audioId),metadata]});return metadata;
   });
  },
  async recording(threadId,audioId){
   return transaction(['threads','recordings'],'readonly',async tx=>{await threadIn(tx,threadId);const row=await tx.get('recordings',[ownerId,threadId,id(audioId)]);return row?{...row,blob:new Blob([row.bytes],{type:row.mimeType})}:null;});
  },
  async deleteThread(threadId){
   assertOwner();
   const {discardPendingBackupContainingConversation}=await import('./profile-backup.js');
   await discardPendingBackupContainingConversation(profileId,learnerId,threadId);assertOwner();
   await transaction(['threads','turns','drafts','summaries','recordings','snapshots'],'readwrite',async tx=>{
    const thread=await threadIn(tx,threadId,{allowDeleted:true});if(thread.deletedAt)return;
    await tx.put('threads',{schemaVersion:1,ownerId,...owner,threadId,revision:thread.revision+1,contentRevision:thread.contentRevision+1,deletedAt:now(),updatedAt:now(),pending:null});
    await removeRecords(tx,'turns',threadId);await removeRecords(tx,'recordings',threadId);await tx.del('drafts',key(threadId));await tx.del('summaries',key(threadId));
    // Removing a conversation also removes its private text/audio from local
    // recovery snapshots. Only the minimal tombstone remains in the live store.
    for(const snapshot of await tx.all('snapshots','owner',ownerId)){
     for(const name of Object.keys(snapshot.records))snapshot.records[name]=snapshot.records[name].filter(r=>r.threadId!==threadId);
     await tx.put('snapshots',snapshot);
    }
   });
   createDraftRecovery({...owner,threadId}).clear();
  },
  async exportRecords({includeAudio=false}={}){
   return transaction(STORES.filter(n=>n!=='snapshots'),'readonly',async tx=>{
    const records={};for(const name of STORES.filter(n=>n!=='snapshots'&&n!=='recordings'))records[name]=await tx.all(name,'owner',ownerId);
    records.recordings=includeAudio?await tx.all('recordings','owner',ownerId):[];
    return {schemaVersion:1,app:'parola-conversations',learnerId,exportedAt:now(),audioIncluded:includeAudio,records};
   });
  },
  async importRecords(bundle,{mode='merge',expectedRecords=null,operationId=null,validateOnly=false}={}){
   if(bundle?.app!=='parola-conversations'||bundle.schemaVersion!==1)throw new TypeError('Unsupported conversation backup version');
   if(bundle.learnerId!==learnerId)throw new TypeError('This conversation backup belongs to another learner');
   if(!['merge','replace'].includes(mode))throw new TypeError('Invalid restore mode');
   if(operationId!=null){id(operationId);if(operationId.length>180)throw new TypeError('Invalid backup operation identity');}
   const records=clone(bundle.records);safe({...records,recordings:[]});
   for(const name of STORES.filter(n=>n!=='snapshots'))if(!Array.isArray(records[name]))throw new TypeError('Incomplete conversation backup');
   if(!bundle.audioIncluded&&records.recordings.length)throw new TypeError('Unexpected recordings in a transcript-only backup');
   const threads=new Map(),turns=new Map();
   for(const row of records.threads){
    id(row.threadId);if(threads.has(row.threadId)||!Number.isSafeInteger(row.revision)||row.revision<1||!Number.isSafeInteger(row.contentRevision)||row.contentRevision<0)throw new TypeError('Invalid conversation revision');
    if(!row.deletedAt){row.setup=validateSetup(row.setup);text(row.title,200);}
    Object.assign(row,{ownerId,...owner,pending:null});threads.set(row.threadId,row);
   }
   for(const row of records.turns){
    const thread=threads.get(row.threadId),turnKey=JSON.stringify([row.threadId,id(row.turnId)]);
    if(!thread||thread.deletedAt||turns.has(turnKey)||!Number.isSafeInteger(row.sequence)||row.sequence<1||!Number.isSafeInteger(row.revision)||row.revision<1)throw new TypeError('Invalid saved message identity');
    text(row.originalText);text(row.displayText);
    if(!['learner','partner','system'].includes(row.role)||row.role==='partner'&&!thread.setup.participants.some(p=>p.id===row.participantId)||row.role==='learner'&&row.participantId!=='learner')throw new TypeError('Invalid saved speaker');
    row.ownerId=ownerId;turns.set(turnKey,row);
   }
   for(const thread of threads.values())if(!thread.deletedAt){
    const sequence=records.turns.filter(t=>t.threadId===thread.threadId).map(t=>t.sequence);
    if(new Set(sequence).size!==sequence.length||!Number.isSafeInteger(thread.nextSequence)||thread.nextSequence<=sequence.reduce((n,x)=>Math.max(n,x),0))throw new TypeError('Invalid message order');
   }
   for(const name of ['drafts','summaries']){
    const seen=new Set();for(const row of records[name]){if(seen.has(row.threadId)||!threads.has(row.threadId)||threads.get(row.threadId).deletedAt)throw new TypeError('Orphaned conversation notes or draft');seen.add(row.threadId);row.ownerId=ownerId;if(name==='drafts'){id(row.turnId);text(row.typedText||'');if(!Number.isSafeInteger(row.revision)||row.revision<1)throw new TypeError('Invalid draft revision');}
     else {if(!Array.isArray(row.items))throw new TypeError('Invalid summary items');for(const item of row.items){if(!item.sourceRefs?.length)throw new TypeError('Summary item has no message source');for(const ref of item.sourceRefs){const source=turns.get(JSON.stringify([row.threadId,ref.turnId]));if(!source||!Number.isSafeInteger(ref.revision)||ref.revision<1)throw new TypeError('Summary item has an invalid message source');const prior=source.revision===ref.revision?source:source.history?.find(h=>h.revision===ref.revision);if(prior)validateSourceRange(item,ref,prior);if(source.revision!==ref.revision){row.dirty=true;item.invalidated=true;}}}}
    }
   }
   const audioIds=new Set();
   for(const audio of records.recordings){
    const audioKey=JSON.stringify([audio.threadId,id(audio.audioId)]);
    if(audioIds.has(audioKey)||!(audio.bytes instanceof ArrayBuffer)||audio.bytes.byteLength!==audio.byteLength||audio.bytes.byteLength>64*1024*1024||!audio.consentAt||!turns.has(JSON.stringify([audio.threadId,audio.turnId])))throw new TypeError('Invalid saved recording');
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',audio.bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==audio.sha256)throw new TypeError('A recording is damaged');audio.ownerId=ownerId;audioIds.add(audioKey);
   }
   assertOwner();
   if(validateOnly)return {valid:true};
   // Validation (including audio hashes) finishes before opening the write
   // transaction. Its receipt commits with the records, so recovery cannot
   // replay an old replacement over work made after a successful import.
   const operationIdentity=operationId?[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable({mode,records}))))].map(n=>n.toString(16).padStart(2,'0')).join(''):null;
   const operationSnapshot=operationId?`backup-op:${operationId}`:null;
   const imported=await transaction(STORES,'readwrite',async tx=>{
    if(operationSnapshot){
     const receipt=await tx.get('snapshots',[ownerId,operationSnapshot]);
     if(receipt?._importComplete){
      if(receipt._importIdentity!==operationIdentity)throw new ConversationConflict('This backup operation belongs to a different file.');
      return {imported:receipt._imported,snapshotId:operationSnapshot,alreadyApplied:true};
     }
    }
    const previous={};for(const name of STORES.filter(n=>n!=='snapshots'))previous[name]=await tx.all(name,'owner',ownerId);
    if(expectedRecords&&stable({...previous,recordings:[]})!==stable({...expectedRecords,recordings:[]}))throw new ConversationConflict('Conversations changed while this import was pending. Export your current conversations, then cancel and restart the import.');
    const local=new Map(previous.threads.map(t=>[t.threadId,t])),accepted=new Set();
    for(const remote of threads.values()){
     const current=local.get(remote.threadId);
     // An old backup or a redacted recovery snapshot must never erase local
     // deletion fences. Restoring other conversations keeps those fences too.
     if(current?.deletedAt)continue;
     if(mode==='merge'&&current&&!remote.deletedAt){
      if(current.contentRevision>remote.contentRevision)continue;
      const existingTurns=previous.turns.filter(t=>t.threadId===current.threadId),incomingTurns=records.turns.filter(t=>t.threadId===current.threadId);
      // A revision is a counter, not ancestry. Every retained original must be
      // present unchanged or in a descendant's explicit edit history.
      const descends=existingTurns.every(t=>incomingTurns.some(r=>r.turnId===t.turnId&&r.originalText===t.originalText&&r.sequence===t.sequence&&(sameTurn(r,t)||r.revision>t.revision&&r.history?.some(h=>sameTurn(h,t)))));
      if(!descends||current.contentRevision===remote.contentRevision&&existingTurns.length!==incomingTurns.length)throw new ConversationConflict('Two versions of the same conversation conflict. Your current copy is kept.');
      const draft=previous.drafts.find(d=>d.threadId===current.threadId),incomingDraft=records.drafts.find(d=>d.threadId===current.threadId);
      if(draft){
       if(incomingDraft&&!sameDraft(draft,incomingDraft))throw new ConversationConflict('Both copies have a different unsent draft. Export your current draft before choosing Replace.');
       if(!incomingDraft&&!incomingTurns.some(t=>t.turnId===draft.turnId&&t.originalText===draft.typedText))records.drafts.push(draft);
      }
      if(current.contentRevision===remote.contentRevision&&current.updatedAt>=remote.updatedAt&&!incomingDraft)continue;
     }
     accepted.add(remote.threadId);
    }
    if(mode==='merge')for(const audio of previous.recordings){
     if(!accepted.has(audio.threadId)||records.recordings.some(a=>a.threadId===audio.threadId&&a.audioId===audio.audioId))continue;
     const currentTurn=previous.turns.find(t=>t.threadId===audio.threadId&&t.turnId===audio.turnId),incomingTurn=records.turns.find(t=>t.threadId===audio.threadId&&t.turnId===audio.turnId);
     if(incomingTurn&&currentTurn?.originalText===incomingTurn.originalText){records.recordings.push(audio);incomingTurn.recordingRefs=[...(incomingTurn.recordingRefs||[]).filter(r=>r.audioId!==audio.audioId),...(currentTurn.recordingRefs||[]).filter(r=>r.audioId===audio.audioId)];}
    }
    const snapshotId=operationSnapshot||uuid();await tx.put('snapshots',{ownerId,snapshotId,createdAt:now(),schemaVersion:1,records:previous,...(operationId?{_importComplete:true,_importIdentity:operationIdentity,_imported:accepted.size}:{})});
    const deletions=new Set([...accepted].filter(id=>threads.get(id).deletedAt));
    // Imported deletions are as private as local deletions: recovery copies
    // cannot retain a transcript or recording the learner removed elsewhere.
    if(deletions.size)for(const snapshot of await tx.all('snapshots','owner',ownerId)){
     for(const name of Object.keys(snapshot.records))snapshot.records[name]=snapshot.records[name].filter(r=>!deletions.has(r.threadId));
     await tx.put('snapshots',snapshot);
    }
    const remove=mode==='replace'?new Set(previous.threads.filter(t=>!t.deletedAt).map(t=>t.threadId)):accepted;
    for(const name of ['turns','recordings'])for(const threadId of remove)await removeRecords(tx,name,threadId);
    for(const name of ['drafts','summaries','threads'])for(const threadId of remove)await tx.del(name,key(threadId));
    for(const name of STORES.filter(n=>n!=='snapshots'))for(const row of records[name])if(accepted.has(row.threadId))await tx.put(name,row);
    return {imported:accepted.size,snapshotId};
   });
   for(const thread of records.threads)if(thread.deletedAt){
    createDraftRecovery({...owner,threadId:thread.threadId}).clear();
    const {discardPendingBackupContainingConversation}=await import('./profile-backup.js');
    await discardPendingBackupContainingConversation(profileId,learnerId,thread.threadId,{exceptOperationId:operationId});
   }
   return imported;
  },
  async recoverySnapshots(){
   return transaction(['snapshots'],'readonly',async tx=>(await tx.all('snapshots','owner',ownerId)).map(s=>({snapshotId:s.snapshotId,createdAt:s.createdAt,threads:s.records.threads.filter(t=>!t.deletedAt).length})).sort((a,b)=>b.createdAt-a.createdAt));
  },
  async deleteRecoverySnapshot(snapshotId){return transaction(['snapshots'],'readwrite',tx=>tx.del('snapshots',[ownerId,id(snapshotId)]));},
  async restoreSnapshot(snapshotId){
   const snapshot=await transaction(['snapshots'],'readonly',tx=>tx.get('snapshots',[ownerId,id(snapshotId)]));
   if(!snapshot)throw new ConversationConflict('This recovery copy is no longer available.');
   return this.importRecords({schemaVersion:1,app:'parola-conversations',learnerId,audioIncluded:true,records:snapshot.records},{mode:'replace'});
  },
  async removeProfileData(){
   return transaction(STORES,'readwrite',async tx=>{
    for(const name of STORES)for(const row of await tx.all(name,'owner',ownerId))await tx.del(name,name==='turns'?[ownerId,row.threadId,row.turnId]:name==='recordings'?[ownerId,row.threadId,row.audioId]:name==='snapshots'?[ownerId,row.snapshotId]:key(row.threadId));
   });
  },
  close(){closed=true;for(const tx of active)try{tx.abort();}catch{}active.clear();connection?.close();connection=null;opening=null;},
 };
}
