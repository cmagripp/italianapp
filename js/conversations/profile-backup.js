import {createConversationRepository} from './storage.js';
import {exportConversationJSON,parseConversationJSON} from './backup.js';
import {LEARNING_VERSION} from '../learning/model.js';
const APP='parola-profile-bundle',VERSION=1,DB='parola-backup-imports';
const clone=value=>structuredClone(value);
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function database(){return new Promise((resolve,reject)=>{
 if(!globalThis.indexedDB){reject(new Error('Full backup storage is unavailable. You can still export progress only.'));return;}
 const request=indexedDB.open(DB,1);let settled=false;
 request.onupgradeneeded=()=>request.result.createObjectStore('imports',{keyPath:'profileId'});
 request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;resolve(request.result);};
 request.onerror=()=>{settled=true;reject(request.error);};
 request.onblocked=()=>{settled=true;reject(new Error('Close other Parola windows before restoring this backup.'));};
});}
async function journal(profileId,action,value,expectedId){
 const db=await database();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('imports',action==='read'?'readonly':'readwrite'),store=tx.objectStore('imports'),get=store.get(profileId);let result,failure;
  tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('The backup recovery record could not be saved.'));
  get.onsuccess=()=>{try{const current=get.result;
   if(action==='read'){result=current||null;return;}
   if(expectedId===null&&current||typeof expectedId==='string'&&current?.id!==expectedId){failure=new Error('Another backup import is already pending for this user.');tx.abort();return;}
   if(action==='remove')store.delete(profileId);else store.put(value);result=value;
   }catch(error){failure=error;tx.abort();}
  };
 });}finally{db.close();}
}
const owner=store=>({profileId:store.current.id,learnerId:store.current.learnerId});
const sameOwner=(store,saved)=>store.current?.id===saved.profileId&&store.current?.learnerId===saved.learnerId;
const assertOwner=(store,saved)=>{if(!sameOwner(store,saved))throw new Error('The active learner changed. Open this backup for the intended user.');};
function parse(text){
 const bundle=JSON.parse(text);
 if(bundle.app!==APP||bundle.version!==VERSION||!bundle.profile?.learnerId||!bundle.profile.items||!bundle.profile.lists)throw new TypeError('Not a supported full Parola backup');
 if(bundle.profile.learning?.version>LEARNING_VERSION)throw new Error('This backup needs a newer version of Parola.');
 const conversations=parseConversationJSON(JSON.stringify(bundle.conversations));
 if(conversations.learnerId!==bundle.profile.learnerId)throw new TypeError('Progress and conversations must belong to the same learner');
 return {bundle,conversations};
}
export function isFullProfileBackup(text){try{return JSON.parse(text).app===APP;}catch{return false;}}
export async function exportFullProfileBackup(store,{includeAudio=false}={}){
 await store.saveNow();const saved=owner(store),profile=clone(store.current),revision=store._revision;
 const repository=createConversationRepository({...saved,isCurrent:()=>sameOwner(store,saved)});
 try{const conversations=JSON.parse(await exportConversationJSON(repository,{includeAudio}));assertOwner(store,saved);if(store._revision!==revision)throw new Error('Progress changed while exporting. Please try Export again.');
  return JSON.stringify({app:APP,version:VERSION,exportedAt:Date.now(),profile,conversations});
 }finally{repository.close();}
}
export async function pendingProfileBackup(store){
 const saved=owner(store),record=await journal(saved.profileId,'read');assertOwner(store,saved);
 if(!record)return null;
 return {id:record.id,stage:record.stage,createdAt:record.createdAt,profileId:record.profileId,originalLearnerId:record.originalLearnerId,targetLearnerId:record.targetLearnerId};
}
export async function originalProfileBackup(store){
 const saved=owner(store),record=await journal(saved.profileId,'read');assertOwner(store,saved);
 if(!record||await hash(record.originalProfile)!==record.originalHash)throw new Error('No verified pre-import progress is available.');
 return JSON.stringify({app:'italiano',exported:new Date(record.createdAt).toISOString(),profile:record.originalProfile});
}
export async function beginProfileBackupImport(store,text,{merge=false}={}){
 const {bundle,conversations}=parse(text);await store.saveNow();const saved=owner(store),originalProfile=clone(store.current);
 if(merge&&bundle.profile.learnerId!==saved.learnerId)throw new Error('This backup belongs to a different learner. Use Replace to restore that learner deliberately.');
 const repository=createConversationRepository({profileId:saved.profileId,learnerId:bundle.profile.learnerId,isCurrent:()=>sameOwner(store,saved)});
 let conversationBaseline;
 try{await repository.importRecords(conversations,{validateOnly:true});conversationBaseline=(await repository.exportRecords()).records;}finally{repository.close();}
 const record={id:crypto.randomUUID(),profileId:saved.profileId,originalLearnerId:saved.learnerId,targetLearnerId:bundle.profile.learnerId,createdAt:Date.now(),stage:'prepared',merge,payload:bundle,payloadHash:await hash(bundle),originalProfile,originalHash:await hash(originalProfile),conversationBaseline,baselineHash:await hash(conversationBaseline)};
 assertOwner(store,saved);if(await hash(store.current)!==record.originalHash)throw new Error('Progress changed while preparing the import. Please try again.');
 await journal(saved.profileId,'write',record,null);
 return resumeProfileBackupImport(store);
}
export async function resumeProfileBackupImport(store){
 const profileId=store.current.id;let record=await journal(profileId,'read');
 if(!record)throw new Error('No backup import is pending.');
 if(store.current.id!==profileId)throw new Error('The active user changed.');
 if(await hash(record.payload)!==record.payloadHash||await hash(record.originalProfile)!==record.originalHash||await hash(record.conversationBaseline)!==record.baselineHash)throw new Error('The pending backup could not be verified. Your current progress is kept.');
 const {bundle,conversations}=parse(JSON.stringify(record.payload));
 try{
  // The receipt and imported profile commit together. If termination happened
  // before journal advancement, resume never reapplies an old replacement over
  // progress the learner has made since that commit.
  if(store.current.lastBackupImportId!==record.id){
   if(record.stage!=='prepared'||store.current.learnerId!==record.originalLearnerId||await hash(store.current)!==record.originalHash)throw new Error('Progress changed after this import was prepared. Export the pre-import copy or cancel this pending import before choosing again.');
   await store.importJSON(JSON.stringify({profile:bundle.profile}),{merge:record.merge,backupOperationId:record.id});
  }
  const target={profileId,learnerId:record.targetLearnerId};assertOwner(store,target);
  record={...record,stage:'progress-restored'};await journal(profileId,'write',record,record.id);
  const repository=createConversationRepository({...target,isCurrent:()=>sameOwner(store,target)&&store.current.lastBackupImportId===record.id});
  try{await repository.importRecords(conversations,{mode:record.merge?'merge':'replace',expectedRecords:record.conversationBaseline,operationId:record.id});}finally{repository.close();}
  assertOwner(store,target);await journal(profileId,'remove',null,record.id);
  return {ok:true,progressRestored:true,conversationsRestored:true};
 }catch(error){
  const done=store.current?.id===profileId&&store.current.lastBackupImportId===record.id;
  const failure=new Error(done?`Progress is restored. Conversation restoration is still pending: ${error.message}`:`The backup import is pending. Your previous progress is kept: ${error.message}`);
  failure.pendingBackup=true;failure.progressRestored=done;throw failure;
 }
}
export async function cancelProfileBackupImport(store){
 const saved=owner(store),record=await journal(saved.profileId,'read');assertOwner(store,saved);if(record)await journal(saved.profileId,'remove',null,record.id);
 return {progressRestored:store.current.lastBackupImportId===record?.id};
}
export async function deleteProfileBackupJournal(profileId){if(!globalThis.indexedDB)return;const record=await journal(profileId,'read');if(record)await journal(profileId,'remove',null,record.id);}
export async function discardPendingBackupContainingConversation(profileId,learnerId,threadId,{exceptOperationId=null}={}){
 if(!globalThis.indexedDB)return;
 const record=await journal(profileId,'read');
 if(record&&record.id!==exceptOperationId&&record.targetLearnerId===learnerId&&[record.payload?.conversations?.records,record.conversationBaseline].some(records=>records?.threads?.some(thread=>thread.threadId===threadId)))await journal(profileId,'remove',null,record.id);
}
