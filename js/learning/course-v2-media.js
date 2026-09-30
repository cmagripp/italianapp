// Downloadable lesson audio is separate from the atomic application shell.
// Microphone recordings never leave the device unless the learner exports one.
const AUDIO_CACHE='parola-course-audio-v2';
let manifestPromise, dbPromise;
export function loadCourseAudio() {
  return manifestPromise ||= fetch('data/course-v2/audio.json').then(r=>{if(!r.ok)throw new Error('Audio catalogue unavailable');return r.json();}).catch(()=>{manifestPromise=null;return {version:2,assets:[]};});
}
export function courseAudioAsset(manifest,id) { return manifest.assets?.find(asset=>asset.id===id); }
export async function downloadUnitAudio(manifest,unitId,onProgress=()=>{}) {
  if(!globalThis.caches)throw new Error('Offline audio is unavailable in this browser. You can still listen online.');
  const assets=manifest.assets.filter(asset=>asset.unitId===unitId),cache=await caches.open(AUDIO_CACHE);
  let count=0;
  for(const asset of assets){
    const url=new URL(asset.src,document.baseURI);
    if(url.origin!==location.origin)throw new Error('Only reviewed bundled audio can be downloaded.');
    const cached=await cache.match(url);
    if(!cached){const response=await fetch(url);if(!response.ok)throw new Error('The audio download was interrupted. Already saved clips are safe.');await cache.put(url,response);}
    onProgress(++count,assets.length);
  }
  return count;
}
export async function removeUnitAudio(manifest,unitId) {
  if(!globalThis.caches)return;
  const cache=await caches.open(AUDIO_CACHE);
  await Promise.all(manifest.assets.filter(asset=>asset.unitId===unitId).map(asset=>cache.delete(new URL(asset.src,document.baseURI))));
}
function recordingDB() {
  return dbPromise ||= new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('Recording storage is unavailable.'));return;}
    const request=indexedDB.open('parola-course-recordings',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('recordings');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }).catch(error=>{dbPromise=null;throw error;});
}
export async function saveCourseRecording(key,blob) {
  if(blob.size>3*1024*1024)throw new Error('This recording is too large to save. Please make a shorter response.');
  // ArrayBuffer storage avoids WebKit's intermittent Blob serialization failure
  // in IndexedDB. MIME information is retained for replay and explicit export.
  const record={bytes:await blob.arrayBuffer(),type:blob.type||'audio/webm'};
  const db=await recordingDB();
  return new Promise((resolve,reject)=>{const tx=db.transaction('recordings','readwrite'),request=tx.objectStore('recordings').put(record,key);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(request.error||tx.error||new Error('The recording could not be saved on this device.'));});
}
export async function getCourseRecording(key) {
  const db=await recordingDB();
  return new Promise((resolve,reject)=>{const request=db.transaction('recordings').objectStore('recordings').get(key);request.onsuccess=()=>{const value=request.result;resolve(value?.bytes instanceof ArrayBuffer?new Blob([value.bytes],{type:value.type}):value);};request.onerror=()=>reject(request.error);});
}
export async function deleteCourseRecordings(prefix,{exact=false}={}) {
  const db=await recordingDB();
  return new Promise((resolve,reject)=>{const tx=db.transaction('recordings','readwrite'),store=tx.objectStore('recordings'),request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){if(exact?String(cursor.key)===prefix:String(cursor.key).startsWith(prefix))cursor.delete();cursor.continue();}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
