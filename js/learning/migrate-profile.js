// Boot migrations are separate from ordinary saves. A pre-update copy and the
// upgraded primary commit atomically in IndexedDB; failure keeps the old copy.
export const PROFILE_MIGRATION_POLICY='learning-v6-unified-review-1';
const encode=value=>JSON.stringify(value);
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(encode(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');
const learner=profile=>profile?.learnerId||'legacy:'+profile?.id;
export const migrationBackupJSON=profile=>encode({app:'italiano',exported:new Date().toISOString(),profile});
export async function verifyMigrationSnapshot(snapshot){return !!snapshot?.profile&&snapshot.version===1&&snapshot.policy===PROFILE_MIGRATION_POLICY&&snapshot.kind==='migration'&&snapshot.profileId===snapshot.profile.id&&snapshot.learnerId===learner(snapshot.profile)&&snapshot.hashAlgorithm==='SHA-256'&&snapshot.checksum===await digest(snapshot.profile)&&(!snapshot.legacySource||snapshot.legacySourceChecksum===await digest(snapshot.legacySource));}
export async function migrateStoredProfile({database,storage,profileId,primaryBefore,original,candidate,isCurrent=()=>true,storagePrefix='kv:',legacySource=null}){
 if(typeof profileId!=='string'||!profileId||original?.id!==profileId||candidate?.id!==profileId||learner(original)!==learner(candidate)||candidate?.learning?.version!==6)throw new TypeError('The migration profile or learner identity does not match.');
 const checksum=await digest(original),primary='profile:'+profileId,recoveryKey=`migration:${PROFILE_MIGRATION_POLICY}:${profileId}:${checksum}`,pointer='migration-latest:'+profileId;
 const recovery={version:1,policy:PROFILE_MIGRATION_POLICY,kind:'migration',profileId,learnerId:learner(original),at:Date.now(),hashAlgorithm:'SHA-256',checksum,profile:structuredClone(original),...(legacySource?{legacySource:structuredClone(legacySource),legacySourceChecksum:await digest(legacySource)}:{})};
 const verified=value=>encode(value)===encode(recovery);
 const guard=()=>{if(!isCurrent())throw new Error('The selected profile changed. Its previous progress is kept.');};
 try{
  guard();
  if(database){
   await new Promise((resolve,reject)=>{
    const tx=database.transaction('kv','readwrite'),kv=tx.objectStore('kv');let failure;
    const request=req=>new Promise((yes,no)=>{req.onsuccess=()=>yes(req.result);req.onerror=()=>no(req.error);});
    tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(failure||tx.error||new Error('The update could not be saved.'));
    Promise.resolve().then(async()=>{
     if(encode(await request(kv.get(primary)))!==encode(primaryBefore))throw new Error('This profile changed in another window. Reload before updating.');
     guard();await request(kv.put(recovery,recoveryKey));
     const saved=await request(kv.get(recoveryKey));if(!verified(saved))throw new Error('The pre-update backup could not be verified.');
     guard();await request(kv.put(candidate,primary));
     if(encode(await request(kv.get(primary)))!==encode(candidate))throw new Error('The updated progress could not be verified.');
     guard();await request(kv.put({recoveryKey,learnerId:learner(original)},pointer));guard();
    }).catch(error=>{failure=error;try{tx.abort();}catch{reject(error);}});
   });
  }else{
   const read=key=>{const value=storage.getItem(storagePrefix+key);return value==null?undefined:JSON.parse(value);};
   if(encode(read(primary))!==encode(primaryBefore))throw new Error('This profile changed in another window. Reload before updating.');
   storage.setItem(storagePrefix+recoveryKey,encode(recovery));
   const saved=read(recoveryKey);if(!verified(saved))throw new Error('The pre-update backup could not be verified.');
   // Keep the verified recovery destination before replacing the fallback
   // primary. localStorage cannot provide a multi-key transaction.
   storage.setItem(storagePrefix+pointer,encode({recoveryKey,learnerId:learner(original)}));
   guard();
   if(encode(read(primary))!==encode(primaryBefore))throw new Error('This profile changed in another window. Reload before updating.');
   try{
    storage.setItem(storagePrefix+primary,encode(candidate));
    if(encode(read(primary))!==encode(candidate))throw new Error('The updated progress could not be verified.');
    guard();
   }catch(error){
    try{if(primaryBefore===undefined)storage.removeItem(storagePrefix+primary);else storage.setItem(storagePrefix+primary,encode(primaryBefore));}
    catch(rollbackError){const failure=new Error('The pre-update backup is saved, but the previous primary could not be restored. Export the previous progress before retrying.',{cause:rollbackError});failure.rollbackFailed=true;throw failure;}
    throw error;
   }
  }
  return {recoveryKey,candidate};
 }catch(cause){
  const error=new Error(cause.rollbackFailed?cause.message:'Your progress could not be updated safely. The previous copy is kept. Export it, free some storage, then retry. '+cause.message,{cause});
  error.profileBackup=migrationBackupJSON(original);throw error;
 }
}
