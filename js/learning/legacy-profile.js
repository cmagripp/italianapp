import {verifyMigrationSnapshot} from './migrate-profile.js';
// Read-only access to progress written by the previous app generation. A live
// old tab can keep writing here; it must never replace the v6 authoritative copy.
export const PROFILE_STORAGE = Object.freeze({database:'italiano-db-v6',fallback:'kv6:',profiles:'it.v6.profiles',current:'it.v6.currentProfile',pending:'it.v6.pendingProfile'});
const parse=value=>{try{return JSON.parse(value);}catch{return null;}};
function oldDatabase(){return new Promise(resolve=>{try{const req=indexedDB.open('italiano-db',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('kv'))req.result.createObjectStore('kv');};req.onsuccess=()=>resolve(req.result);req.onerror=req.onblocked=()=>resolve(null);}catch{resolve(null);}});}
export function legacyRoster(storage=localStorage){
 const raw=storage.getItem('it.profiles');if(raw===null)return {profiles:[],current:null};
 const profiles=JSON.parse(raw),current=storage.getItem('it.currentProfile');
 if(!Array.isArray(profiles)||profiles.some(p=>!p||typeof p.id!=='string'||!p.id))throw new Error('The previous user list could not be read. Its progress has been kept; retry before resetting it.');
 return {profiles:profiles.map(p=>({...p,legacySource:true})),current};
}
const checksum = value => {let hash=2166136261;for(const char of JSON.stringify(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);};
const recoveryKey=(key,id)=>['recovery:','merge-recovery:'].some(prefix=>key===prefix+id)||key.startsWith('migration:');
export async function legacyProfileCandidates(profileId,storage=localStorage){
 let primary,pending=null,fallback=null;const storedBackups=[],database=await oldDatabase();
 if(database){try{await new Promise((resolve,reject)=>{
  const tx=database.transaction('kv','readonly'),request=tx.objectStore('kv').openCursor();
  request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const key=String(cursor.key);if(key==='profile:'+profileId)primary=cursor.value;else if(recoveryKey(key,profileId)&&cursor.value?.profile?.id===profileId)storedBackups.push({key,snapshot:cursor.value});cursor.continue();};
  tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('The previous progress could not be read.'));
 });}finally{database.close();}}
 // A previous launch may have used localStorage while IndexedDB was blocked.
 // Keep both candidates when storage becomes available again; do not silently
 // assume that one is newer than the other.
 try{
  fallback=parse(storage.getItem('kv:profile:'+profileId));
  const mirror=parse(storage.getItem('it.pendingProfile'));if(mirror?.id===profileId&&mirror.profile?.id===profileId)pending=mirror.profile;
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith('kv:')||!recoveryKey(key.slice(3),profileId))continue;const snapshot=parse(storage.getItem(key));if(snapshot?.profile?.id===profileId)storedBackups.push({key,snapshot});}
 }catch{}
 const backups=[];
 for(const backup of storedBackups){const snapshot=backup.snapshot;if(snapshot.kind==='migration'?await verifyMigrationSnapshot(snapshot):snapshot.checksum===checksum(snapshot.profile))backups.push(backup);}
 return {primary:primary?.id===profileId?primary:null,pending,fallback:fallback?.id===profileId?fallback:null,backups};
}
export async function deleteLegacyProfile(profileId,storage=localStorage){
 const database=await oldDatabase();
 if(database){try{await new Promise((resolve,reject)=>{const tx=database.transaction('kv','readwrite'),request=tx.objectStore('kv').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const key=String(cursor.key);if(['profile:','recovery:','merge-recovery:','migration-latest:'].some(prefix=>key===prefix+profileId)||key.startsWith('migration:')&&cursor.value?.profileId===profileId)cursor.delete();cursor.continue();};tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||new Error('The previous app’s progress could not be removed.'));});}finally{database.close();}}
 const keys=Array.from({length:storage.length},(_,i)=>storage.key(i));
 for(const key of keys){if(!key?.startsWith('kv:'))continue;const logical=key.slice(3),value=parse(storage.getItem(key));if(['profile:','recovery:','merge-recovery:','migration-latest:'].some(prefix=>logical===prefix+profileId)||logical.startsWith('migration:')&&value?.profileId===profileId)storage.removeItem(key);}
 const mirror=parse(storage.getItem('it.pendingProfile'));if(mirror?.id===profileId)storage.removeItem('it.pendingProfile');
 const roster=legacyRoster(storage).profiles.filter(p=>p.id!==profileId).map(({legacySource,...p})=>p);storage.setItem('it.profiles',JSON.stringify(roster));if(storage.getItem('it.currentProfile')===profileId){if(roster.length)storage.setItem('it.currentProfile',roster[0].id);else storage.removeItem('it.currentProfile');}
}
