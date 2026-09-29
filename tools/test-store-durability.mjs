// Real store with controlled IndexedDB commits; no browser profile or network.
import assert from 'node:assert/strict';

class MemoryStorage {
  values = new Map();
  limit = Infinity;
  size(values=this.values) { return [...values].reduce((n,[key,value])=>n+key.length+value.length,0); }
  getItem(key) { return this.values.get(String(key)) ?? null; }
  setItem(key,value) { const next=new Map(this.values);next.set(String(key),String(value));if(this.size(next)>this.limit)throw new Error('QuotaExceededError');this.values=next; }
  removeItem(key) { this.values.delete(String(key)); }
}
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const records = new Map(), writes = [];
let autoCommit = true;
function commit(write,ok=true) {
  const at=writes.indexOf(write);assert.notEqual(at,-1);writes.splice(at,1);
  if(ok){if(write.remove)records.delete(write.key);else records.set(write.key,clone(write.value));write.tx.oncomplete?.();}
  else write.tx.onabort?.();
}
const db = {
  createObjectStore() {},
  transaction() {
    const tx={objectStore:()=>({
      get(key){const req={};queueMicrotask(()=>{req.result=clone(records.get(key));req.onsuccess?.();});return req;},
      put(value,key){const write={tx,key,value:clone(value)};writes.push(write);if(autoCommit)queueMicrotask(()=>commit(write));},
      delete(key){const write={tx,key,remove:true};writes.push(write);if(autoCommit)queueMicrotask(()=>commit(write));},
    })};return tx;
  },
};
globalThis.localStorage=new MemoryStorage();
globalThis.window=new EventTarget();globalThis.document=new EventTarget();
globalThis.indexedDB=window.indexedDB={open(){const req={};queueMicrotask(()=>{req.result=db;req.onsuccess?.();});return req;}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{persist:async()=>true}}});
const {store}=await import('../js/store.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const mirror=()=>JSON.parse(localStorage.getItem('it.pendingProfile'));
let passed=0,fallbackStore;
async function test(name,fn){try{await fn();passed++;console.log(`✓ ${name}`);}catch(error){console.error(`✗ ${name}`);throw error;}}

try {
  await store.init();autoCommit=false;
  const profileId=store.current.id,key='profile:'+profileId;
  let listId;
  await test('an in-flight save is mirrored before unload and clean flush callers await its commit',async()=>{
    listId=store.createList('Starred');store.addToList(listId,'w:casa|noun');
    const save=store.saveNow();let flushed=false;const barrier=store.saveNow().then(()=>{flushed=true;});
    assert.deepEqual(mirror().profile.lists[listId].items,['w:casa|noun']);
    await tick();assert.equal(writes.length,1);assert.equal(flushed,false);assert.equal(records.get(key).lists[listId],undefined);
    window.dispatchEvent(new Event('pagehide'));assert.deepEqual(mirror().profile.lists[listId].items,['w:casa|noun']);
    commit(writes[0]);await save;await barrier;
    assert.equal(flushed,true);assert.deepEqual(records.get(key).lists[listId].items,['w:casa|noun']);assert.equal(mirror(),null);
  });
  await test('rapid star, unstar and re-star retain the latest mirror until all writes commit in order',async()=>{
    store.removeFromList(listId,'w:casa|noun');const remove=store.saveNow();await tick();
    store.addToList(listId,'w:casa|noun');const add=store.saveNow();
    const latest=localStorage.getItem('it.pendingProfile');assert.deepEqual(mirror().profile.lists[listId].items,['w:casa|noun']);
    commit(writes[0]);await remove;await tick();
    assert.deepEqual(records.get(key).lists[listId].items,[]);assert.equal(localStorage.getItem('it.pendingProfile'),latest);
    assert.deepEqual(store._takePending(profileId).lists[listId].items,['w:casa|noun']);
    commit(writes[0]);await add;assert.deepEqual(records.get(key).lists[listId].items,['w:casa|noun']);assert.equal(mirror(),null);
  });
  await test('identical profile snapshots in one millisecond still have distinct recovery identities',async()=>{
    const realNow=Date.now;Date.now=()=>1700000000000;
    let first,second,third;
    try {
      store.save();first=store.saveNow();await tick();
      store.removeFromList(listId,'w:casa|noun');second=store.saveNow();
      store.addToList(listId,'w:casa|noun');third=store.saveNow();
    } finally {Date.now=realNow;}
    const latest=localStorage.getItem('it.pendingProfile');
    commit(writes[0]);await first;await tick();assert.equal(localStorage.getItem('it.pendingProfile'),latest);
    commit(writes[0]);await second;await tick();assert.deepEqual(records.get(key).lists[listId].items,[]);assert.equal(localStorage.getItem('it.pendingProfile'),latest);
    commit(writes[0]);await third;assert.deepEqual(records.get(key).lists[listId].items,['w:casa|noun']);assert.equal(mirror(),null);
  });
  await test('failed writes keep the latest profile recoverable and a later save retries it',async()=>{
    store.removeFromList(listId,'w:casa|noun');const failed=store.saveNow();await tick();
    store.addToList(listId,'w:libro|noun');commit(writes[0],false);await failed;
    assert.equal(store._dirty,true);assert.deepEqual(mirror().profile.lists[listId].items,['w:libro|noun']);
    const retry=store.saveNow();await tick();commit(writes[0]);await retry;
    assert.deepEqual(records.get(key).lists[listId].items,['w:libro|noun']);assert.equal(mirror(),null);
  });
  clearTimeout(store._saveTimer);
  globalThis.localStorage=new MemoryStorage();globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  delete globalThis.indexedDB;
  ({store:fallbackStore}=await import('../js/store.js?local-storage-durability'));
  await fallbackStore.init();
  const fallbackKey='kv:profile:'+fallbackStore.current.id;
  await test('localStorage fallback writes synchronously under quota without needing two new profile copies',async()=>{
    const oldSize=localStorage.size();
    fallbackStore.current.recent=Array(50).fill('synthetic-history-entry');fallbackStore.save();
    const newSize=JSON.stringify(fallbackStore.current).length;
    localStorage.limit=oldSize+newSize+150;
    let errors=0;fallbackStore.addEventListener('saveError',()=>errors++);
    const saving=fallbackStore.saveNow();
    assert.equal(JSON.parse(localStorage.getItem(fallbackKey)).recent.length,50,'durable before the promise is awaited');
    await saving;assert.equal(fallbackStore._dirty,false);assert.equal(errors,0);assert.equal(mirror(),null);
    fallbackStore.current.recent.push('latest');fallbackStore.save();window.dispatchEvent(new Event('pagehide'));
    assert.equal(JSON.parse(localStorage.getItem(fallbackKey)).recent.at(-1),'latest');assert.equal(mirror(),null);
  });
  await test('a recovered same-profile mirror cannot block the synchronous primary replacement',async()=>{
    localStorage.limit=Infinity;
    const oldSize=localStorage.size();
    fallbackStore.current.recent=Array(100).fill('recovered-history-entry');fallbackStore.save();
    const pending=JSON.stringify({id:fallbackStore.current.id,profile:fallbackStore.current});
    localStorage.setItem('it.pendingProfile',pending);
    localStorage.limit=oldSize+pending.length+100;
    await fallbackStore.saveNow();
    assert.equal(fallbackStore._dirty,false);assert.equal(JSON.parse(localStorage.getItem(fallbackKey)).recent.length,100);assert.equal(mirror(),null);
  });
  await test('a truly full fallback restores its prior recovery mirror when replacement cannot fit',async()=>{
    localStorage.limit=Infinity;
    const pending=JSON.stringify({id:fallbackStore.current.id,profile:fallbackStore.current});localStorage.setItem('it.pendingProfile',pending);
    localStorage.limit=localStorage.size();
    fallbackStore.current.recent=Array(2000).fill('large-new-history-entry');fallbackStore.save();
    await fallbackStore.saveNow();
    assert.equal(fallbackStore._dirty,true);assert.equal(localStorage.getItem('it.pendingProfile'),pending);assert.equal(JSON.parse(localStorage.getItem(fallbackKey)).recent.length,100);
  });
  console.log(`\n${passed} store durability checks passed.`);
} finally {clearTimeout(store._saveTimer);clearTimeout(fallbackStore?._saveTimer);}
