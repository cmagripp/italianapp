// Small synchronous recovery journal for an input that may outlive the page
// before its IndexedDB transaction completes. No microphone audio is mirrored.
const PREFIX='parola.conversation-draft:';
export const draftStorage=()=>{try{return globalThis.localStorage;}catch{return null;}};
export function createDraftRecovery({profileId,learnerId,threadId,storage=draftStorage()}){
 const owns=key=>{if(!key?.startsWith(PREFIX))return false;try{const owner=JSON.parse(key.slice(PREFIX.length));return owner[0]===profileId&&owner[1]===learnerId&&owner[2]===threadId;}catch{return false;}};
 const keys=()=>Array.from({length:storage?.length||0},(_,i)=>storage.key(i)).filter(owns);
 const valid=value=>value?.version===1&&value.profileId===profileId&&value.learnerId===learnerId&&value.threadId===threadId&&typeof value.typedText==='string'&&value.typedText.length<=4000&&typeof value.writeId==='string'&&typeof value.clientId==='string'&&typeof value.turnId==='string';
 return {
  list(){try{return keys().flatMap(key=>{try{const value=JSON.parse(storage.getItem(key));return valid(value)?[value]:[];}catch{return [];}}).sort((a,b)=>(a.at||0)-(b.at||0)||a.writeId.localeCompare(b.writeId));}catch{return [];}},
  read(){return this.list().at(-1)||null;},
  write(value){try{const key=PREFIX+JSON.stringify([profileId,learnerId,threadId,value.clientId]);storage.setItem(key,JSON.stringify({...value,version:1,profileId,learnerId,threadId,at:Date.now()}));return true;}catch{return false;}},
  clear(writeId){try{for(const key of keys()){let value;try{value=JSON.parse(storage.getItem(key));}catch{}if(!writeId||value?.writeId===writeId)storage.removeItem(key);}}catch{}},
 };
}
export function clearProfileDraftRecovery(profileId,storage=draftStorage()){
 const keys=Array.from({length:storage?.length||0},(_,i)=>storage.key(i));
 for(const key of keys)if(key?.startsWith(PREFIX)){let owner;try{owner=JSON.parse(key.slice(PREFIX.length));}catch{}if(owner?.[0]===profileId)storage.removeItem(key);}
}
export function canRecoverDraft(mirror,state){
 if(!mirror)return false;
 if(state.turns.some(t=>t.turnId===mirror.turnId))return false;
 const draft=state.draft,base=mirror.base||{};
 if(!draft)return (base.revision||0)===0;
 return draft.turnId===mirror.turnId&&(
  draft.revision===base.revision&&(draft.writeId||null)===(base.writeId||null)
  || draft.clientId===mirror.clientId&&Array.isArray(mirror.priorWriteIds)&&mirror.priorWriteIds.includes(draft.writeId));
}
