// Faults and concurrent snapshots through the real store/sync, no live account.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { data } from '../js/data.js';
const clone=x=>JSON.parse(JSON.stringify(x));
class Storage {
  values=new Map();fail=null;onWrite=null;corruptNextRead=null;
  getItem(key){const raw=this.values.get(key)??null;if(key===this.corruptNextRead){this.corruptNextRead=null;return JSON.stringify({...JSON.parse(raw),name:'Corrupted candidate'});}return raw;}
  setItem(key,value){if(this.fail?.(key))throw new Error('QuotaExceededError');this.values.set(key,String(value));this.onWrite?.(key);}
  removeItem(key){this.values.delete(key);}
}
globalThis.localStorage=new Storage();globalThis.window=new EventTarget();globalThis.document=new EventTarget();
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false,storage:{persist:async()=>true}}});
data.vocab=JSON.parse(fs.readFileSync(new URL('../data/vocab.json',import.meta.url))).map(e=>({...e,kind:'word'}));
data.verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))).map(e=>({...e,it:e.inf,kind:'verb'}));
data.byId=new Map([...data.vocab,...data.verbs].map(e=>[e.id,e]));data.loaded=true;
const {store}=await import('../js/store.js');const sync=await import('../js/sync.js');
const response=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});
const configure=()=>localStorage.setItem('it.sync.'+store.current.id,JSON.stringify({url:'https://example.invalid',anonKey:'synthetic-public',access:'synthetic-access',refresh:'synthetic-refresh',userId:'synthetic-account',enabled:true}));
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('✓',name);};
const durable=()=>JSON.parse(localStorage.getItem('kv:profile:'+store.current.id));
try {
  await store.init();await store.saveNow();
  await test('explicit failed save rejects, keeps dirty/exportable data and clears warning after retry',async()=>{
    const previous=durable(),key='kv:profile:'+store.current.id;store.setSetting('theme','dark');
    localStorage.fail=k=>k===key;await assert.rejects(store.saveNow(),/could not be saved/);
    assert.equal(store._dirty,true);assert.equal(store.saveError.profileId,store.current.id);assert.deepEqual(durable(),previous);
    assert.equal(JSON.parse(store.exportJSON()).profile.settings.theme,'dark');
    localStorage.fail=null;await store.saveNow();assert.equal(store._dirty,false);assert.equal(store.saveError,null);
  });
  await test('failed recovery preservation stops replacement before changing active or durable state',async()=>{
    const previous=clone(store.current),candidate=clone(previous);candidate.name='Must not activate';
    localStorage.fail=k=>k.startsWith('kv:recovery:');
    await assert.rejects(store.importJSON(JSON.stringify({profile:candidate})),/recovery copy could not be saved/);
    assert.deepEqual(store.current,previous);assert.deepEqual(durable(),previous);localStorage.fail=null;
  });
  await test('failed candidate write leaves previous profile active and verified recovery export available',async()=>{
    const previous=clone(store.current),candidate=clone(previous);candidate.name='Must not activate';
    localStorage.fail=k=>k==='kv:profile:'+previous.id;
    await assert.rejects(store.importJSON(JSON.stringify({profile:candidate})),/could not be saved/);
    assert.deepEqual(store.current,previous);assert.deepEqual(durable(),previous);localStorage.fail=null;
    assert.deepEqual(JSON.parse(await store.recoveryBackup()).profile,previous);
  });
  await test('read-back verification failure restores previous durable profile before reporting failure',async()=>{
    const previous=clone(store.current),candidate=clone(previous);candidate.name='Candidate';let once=true;
    localStorage.onWrite=key=>{if(once&&key==='kv:profile:'+previous.id){once=false;localStorage.corruptNextRead=key;}};
    await assert.rejects(store.importJSON(JSON.stringify({profile:candidate})),/could not be verified/);
    localStorage.onWrite=null;assert.deepEqual(store.current,previous);assert.deepEqual(durable(),previous);
  });
  await test('successful replacement keeps an old-schema copy that can be restored',async()=>{
    const previous=clone(store.current),candidate=clone(previous);candidate.name='Successful candidate';
    await store.importJSON(JSON.stringify({profile:candidate}));assert.equal(store.current.name,'Successful candidate');
    assert.deepEqual(JSON.parse(await store.recoveryBackup()).profile,previous);
    await store.restoreRecovery();assert.equal(store.current.name,previous.name);assert.equal(durable().name,previous.name);
  });
  await test('concurrent learner edit during staging is retained and replacement is refused',async()=>{
    const previous=clone(store.current),candidate=clone(previous);candidate.name='Stale candidate';let once=true;
    localStorage.onWrite=key=>{if(once&&key.startsWith('kv:recovery:')){once=false;store.setSetting('ttsRate',0.75);}};
    await assert.rejects(store.importJSON(JSON.stringify({profile:candidate})),/Profile changed/);
    localStorage.onWrite=null;assert.equal(store.current.name,previous.name);assert.equal(store.settings.ttsRate,0.75);await store.saveNow();
  });
  await test('failed reset leaves answers, XP, workshop progress and recording deletion untouched',async()=>{
    store.completeLabLesson('frasi','synthetic-before-reset');await store.saveNow();const previous=clone(store.current);
    localStorage.fail=k=>k.startsWith('kv:profile:');await assert.rejects(store.resetProgress(),/could not be saved/);localStorage.fail=null;
    assert.deepEqual(store.current,previous);assert.deepEqual(durable(),previous);
  });
  await test('failed checkpoint save preserves the complete log and a successful retry retains all fences',async()=>{
    const previous=clone(store.current);localStorage.fail=k=>k==='kv:profile:'+previous.id;
    await assert.rejects(store.checkpointEvidence(),/could not be saved/);assert.deepEqual(store.current,previous);
    localStorage.fail=null;await store.saveNow();assert.equal(store.saveError,null);await store.checkpointEvidence();
    assert.deepEqual(store.current.learning.events,previous.learning.events);assert.deepEqual(store.current.learning.completions,previous.learning.completions);assert.equal(store.current.learning.checkpoint.version,1);
  });
  await test('failed outgoing save prevents profile creation or switching',async()=>{
    const previous=clone(store.current),count=store.profiles.length;store.setSetting('haptics',false);
    localStorage.fail=k=>k.startsWith('kv:profile:');await assert.rejects(store.createProfile('Must not appear'),/could not be saved/);
    assert.equal(store.current.id,previous.id);assert.equal(store.profiles.length,count);localStorage.fail=null;await store.saveNow();
  });
  await test('list and membership tombstones defeat stale backups while deliberate newer re-add works',async()=>{
    const list=store.createList('Delete later');store.addToList(list,'w:casa|noun');store.addToList('bank','w:sempre|adv');await store.saveNow();
    const stale=store.exportJSON();store.deleteList(list);store.removeFromList('bank','w:sempre|adv');await store.saveNow();
    await store.importJSON(stale,{merge:true});assert.equal(store.lists[list],undefined);assert.equal(store.inList('bank','w:sempre|adv'),false);
    store.addToList('bank','w:sempre|adv');await store.saveNow();await store.importJSON(stale,{merge:true});assert.equal(store.inList('bank','w:sempre|adv'),true);
  });
  await test('two device workshop completions retain both prospective XP awards and daily XP exactly once',async()=>{
    await store.resetProgress();const base=store.exportJSON();store.completeLabLesson('frasi','synthetic-a');await store.saveNow();const a=store.exportJSON();
    await store.importJSON(base);store.completeLabLesson('frasi','synthetic-b');await store.saveNow();await store.importJSON(a,{merge:true});
    assert.equal(store.current.stats.xp,30);assert.equal(store.today().xp,30);assert.equal(Object.keys(store.current.rewards.awards).length,2);
    await store.importJSON(a,{merge:true});store.completeLabLesson('frasi','synthetic-a');assert.equal(store.current.stats.xp,30);assert.equal(store.today().xp,30);
  });
  await test('concurrent same-lesson completion deduplicates by stable source rather than timestamp',async()=>{
    await store.resetProgress();const base=store.exportJSON();store.completeLabLesson('frasi','same-lesson');await store.saveNow();const a=JSON.parse(store.exportJSON());
    await store.importJSON(base);store.completeLabLesson('frasi','same-lesson');a.profile.lab.frasi.done['same-lesson']-=100;
    for(const record of Object.values(a.profile.rewards.awards))record.at-=100;
    await store.importJSON(JSON.stringify(a),{merge:true});assert.equal(store.current.stats.xp,15);assert.equal(store.today().xp,15);
  });
  await test('pre-reset awards, checks and workshop completion cannot return from stale backup',async()=>{
    const stale=store.exportJSON();await store.resetProgress();await store.importJSON(stale,{merge:true});
    assert.equal(store.current.stats.xp,0);assert.deepEqual(store.current.rewards.awards,{});assert.deepEqual(store.current.lab.frasi.done,{});
  });
  await test('different learner merge is rejected before data or rewards change',async()=>{
    const previous=clone(store.current),other=clone(previous);other.learnerId='learner:other';other.name='Different learner';
    await assert.rejects(store.importJSON(JSON.stringify({profile:other}),{merge:true}),/different learner/);assert.deepEqual(store.current,previous);
  });
  await test('same cloud account cannot silently merge another learner and explicit restore remains available',async()=>{
    configure();const previous=clone(store.current),remote=clone(previous);remote.learnerId='learner:cloud-other';remote.name='Saved cloud learner';let pushes=0;
    let row={data:remote,revision:1};globalThis.fetch=async(url,opts={})=>{if(String(url).includes('/parola_profiles?'))return response([row]);pushes++;row={data:JSON.parse(opts.body).p_data,revision:2};return response({revision:2,updated_at:'synthetic'});};
    await assert.rejects(sync.syncNow(),/different learner/);assert.equal(pushes,0);assert.deepEqual(store.current,previous);assert.equal(sync.getConfig().associationRequired,true);
    await sync.useCloudLearner();assert.equal(store.current.learnerId,remote.learnerId);assert.equal(pushes,1);
    assert.equal(JSON.parse(await store.recoveryBackup()).profile.learnerId,previous.learnerId); // background merge cannot overwrite pre-adoption recovery
  });
  await test('identity-free old cloud backup requires explicit adoption before publishing its new identity',async()=>{
    configure();const previous=clone(store.current),remote=clone(previous);delete remote.learnerId;let pushes=0;let row={data:remote,revision:5};
    globalThis.fetch=async(url,opts={})=>{if(String(url).includes('/parola_profiles?'))return response([row]);pushes++;row={data:JSON.parse(opts.body).p_data,revision:6};return response({revision:6,updated_at:'synthetic'});};
    await assert.rejects(sync.syncNow(),/no learner identity/);assert.equal(pushes,0);assert.equal(store.current.learnerId,previous.learnerId);
    await sync.useCloudLearner();assert.equal(row.data.learnerId,'legacy:'+remote.id);assert.equal(pushes,1);
  });
  await test('late authentication cannot attach credentials after learner replacement in the same slot',async()=>{
    sync.signOut();let release,started;const ready=new Promise(resolve=>{started=resolve;});
    globalThis.fetch=async()=>{started();return new Promise(resolve=>{release=()=>resolve(response({access_token:'must-not-attach',refresh_token:'synthetic',user:{id:'new-account'}}));});};
    const signing=sync.signIn('synthetic@example.invalid','synthetic-password');await ready;
    const replacement=clone(store.current);replacement.learnerId='learner:replaced-during-signin';await store.importJSON(JSON.stringify({profile:replacement}));
    release();await assert.rejects(signing,/learner or sign-in changed/);assert.notEqual(sync.getConfig().access,'must-not-attach');
  });
  console.log(`\n${passed} persistence/reward/identity repair checks passed (synthetic storage and transport).`);
} finally {localStorage.fail=null;localStorage.onWrite=null;clearTimeout(store._saveTimer);sync.signOut();}
