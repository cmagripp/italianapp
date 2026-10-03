import { deleteCourseRecordings } from './learning/course-v2-media.js';
// Persistent per-user storage: profiles, item progress (SRS), lists, custom words, settings and stats.
// Primary storage is IndexedDB (large quota, survives Safari homescreen installs); localStorage is the fallback.
import { schedule as srsSchedule } from './srs.js';
import { data, LEVELS } from './data.js'; // data.js imports nothing, so no cycle
import { LEARNING_VERSION, createLearning, normalizeLearning, mergeLearning, resetLearning, recordAttempt, skillState, allSkills, learningSessionKey, completionKey, completionRecord, setCompletionRecord, checkpointLearning } from './learning/model.js';
import { entryCompletion, loadFullCompletion, hasCompletionDescriptor } from './learning/completion-state.js';
import {migrateStoredProfile,verifyMigrationSnapshot,migrationBackupJSON} from './learning/migrate-profile.js';

import {PROFILE_STORAGE,legacyRoster,legacyProfileCandidates,deleteLegacyProfile} from './learning/legacy-profile.js';

const DB_NAME = PROFILE_STORAGE.database;
const KV = 'kv';
const LS_PROFILES = PROFILE_STORAGE.profiles;
const LS_CURRENT = PROFILE_STORAGE.current;
const LS_PENDING = PROFILE_STORAGE.pending; // unsaved profile mirrored on pagehide (see init)

function openDB() {
  return new Promise((resolve) => {
    // open() itself throws (SecurityError) with Safari's "Block all cookies" and in some private / embedded contexts:
    // that must fall back to localStorage like a failed open does, not reject and leave the app on its spinner
    try {
      if (!('indexedDB' in window) || !window.indexedDB) return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(KV); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}
let dbPromise = null, storageBackend = null;
const db = () => (dbPromise ||= openDB().then(value => { storageBackend = value ? 'indexedDB' : 'localStorage'; return value; }));

function localSet(key, value) {
  let pending = null, serialized;
  try {
    serialized = JSON.stringify(value);
    const raw = localStorage.getItem(LS_PENDING);
    if (raw && key === 'profile:' + value?.id) {
      try { if (JSON.parse(raw)?.id === value.id) pending = raw; } catch { /* malformed mirror is unrelated */ }
    }
    try { localStorage.setItem(PROFILE_STORAGE.fallback + key, serialized); }
    catch (error) {
      // A recovered mirror can consume the space needed to replace its primary.
      // Both operations are synchronous; restore that mirror if replacement fails.
      if (!pending) throw error;
      localStorage.removeItem(LS_PENDING);
      try { localStorage.setItem(PROFILE_STORAGE.fallback + key, serialized); }
      catch (retryError) { localStorage.setItem(LS_PENDING, pending); throw retryError; }
    }
    if (pending && localStorage.getItem(LS_PENDING) === pending) localStorage.removeItem(LS_PENDING);
    return true;
  } catch { return false; }
}

async function kvGet(key) {
  const readFallback=()=>{const raw=localStorage.getItem(PROFILE_STORAGE.fallback+key);return raw===null?undefined:JSON.parse(raw);};
  const d = await db();
  if (!d) return readFallback();
  const existing=await new Promise((resolve,reject)=>{
    try{const request=d.transaction(KV,'readonly').objectStore(KV).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||storageError());}catch(error){reject(error);}
  });
  if(existing!==undefined)return existing;
  const fallback=readFallback();if(fallback===undefined)return undefined;
  // IndexedDB may become available after a prior fallback-only launch. Promote
  // its exact v6 copy before consulting any older generation. Recheck the target
  // inside the write transaction so a concurrent new primary always wins.
  return new Promise((resolve,reject)=>{
    let value=fallback,failure;
    try{
      const tx=d.transaction(KV,'readwrite'),kv=tx.objectStore(KV),get=kv.get(key);
      tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(failure||tx.error||storageError());
      get.onsuccess=()=>{
        if(get.result!==undefined){value=get.result;return;}
        kv.put(fallback,key);const verify=kv.get(key);
        verify.onsuccess=()=>{if(JSON.stringify(verify.result)!==JSON.stringify(fallback)){failure=new Error('The saved fallback progress could not be verified. Its original copy is kept.');tx.abort();}};
      };
    }catch(error){reject(error);}
  });
}
async function kvSet(key, value) {
  const d = await db();
  if (!d) return localSet(key, value);
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(KV, 'readwrite');
      tx.objectStore(KV).put(value, key);
      tx.oncomplete = () => resolve(true);
      // a transaction that fails at commit (quota exceeded, I/O error) fires only `abort`, not `error`: without this
      // handler the save promise never settles and everything that awaits it (switch user, import, reset, sync) hangs
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch { resolve(false); }
  });
}
async function kvDel(key) {
  const d = await db();
  try { localStorage.removeItem(PROFILE_STORAGE.fallback + key); } catch { return false; }
  if (!d) return true;
  return new Promise((resolve) => {
    try { const tx = d.transaction(KV, 'readwrite'); tx.objectStore(KV).delete(key); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); tx.onabort = () => resolve(false); } catch { resolve(false); }
  });
}

async function deleteProfileStorage(profileId){
 const exact=new Set(['profile:'+profileId,'recovery:'+profileId,'merge-recovery:'+profileId,'migration-latest:'+profileId]);
 const matches=(key,value)=>exact.has(key)||String(key).startsWith('migration:')&&value?.profileId===profileId;
 const database=await db();
 {
  const keys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(key=>key?.startsWith(PROFILE_STORAGE.fallback));
  for(const key of keys){let value;try{value=JSON.parse(localStorage.getItem(key));}catch{}if(matches(key.slice(PROFILE_STORAGE.fallback.length),value))localStorage.removeItem(key);}
 }
 if(!database)return;
 await new Promise((resolve,reject)=>{const tx=database.transaction(KV,'readwrite'),request=tx.objectStore(KV).openCursor();tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('User deletion did not finish. Retry deleting this user.'));request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(matches(cursor.key,cursor.value))cursor.delete();cursor.continue();};});
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const clone = value => JSON.parse(JSON.stringify(value));
const safeKey = key => typeof key === 'string' && key && !['__proto__','constructor','prototype'].includes(key);
const stamp = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const checksum = value => { let hash=2166136261;for(const char of JSON.stringify(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16); };
const storageError = () => new Error('Your changes could not be saved on this device. Export a backup, free some space, then retry.');

// Existing totals become a baseline once, without inventing historical awards.
// New non-adaptive awards are mergeable; adaptive XP remains identified by events.
function normalizeRewards(p) {
  const epochId=p.learning.epoch.id,raw=p.rewards;
  if(raw?.version>1)throw new Error('This reward data uses a newer version of Parola. Update the app before changing it.');
  if(!raw || raw.version!==1 || raw.epochId!==epochId) {
    p.rewards={version:1,epochId,legacyXP:Math.max(0,(Number(p.stats.xp)||0)-(Number(p.stats.learningXP)||0)),
      legacyDayXP:Object.fromEntries(Object.entries(p.stats.days || {}).map(([day,v])=>[day,Number(v.xp)||0])),awards:{},evidenceDays:{}};
    return;
  }
  const awards={};
  for(const [id,a] of Object.entries(raw.awards || {}))if(safeKey(id)&&a&&a.id===id&&a.epochId===epochId&&Number.isFinite(a.xp)&&typeof a.dayKey==='string')
    awards[id]={id,epochId,kind:String(a.kind || 'activity'),sourceId:String(a.sourceId || ''),xp:a.xp,at:stamp(a.at),dayKey:a.dayKey,policyVersion:1};
  p.rewards={...raw,version:1,epochId,legacyXP:Math.max(0,Number(raw.legacyXP)||0),legacyDayXP:{...(raw.legacyDayXP || {})},awards,evidenceDays:{...(raw.evidenceDays || {})}};
  // A compatible older client may have earned aggregate XP while retaining an
  // unfamiliar ledger. Preserve that excess as unknown legacy provenance.
  const recorded=p.rewards.legacyXP+awardXP(p.rewards)+(Number(p.stats.learningXP)||0);
  if((Number(p.stats.xp)||0)>recorded)p.rewards.legacyXP+=(Number(p.stats.xp)||0)-recorded;
}
const awardXP = rewards => Object.values(rewards?.awards || {}).reduce((sum,a)=>sum+a.xp,0);
const ensureRewards = p => {if(!p.rewards||p.rewards.version!==1||p.rewards.epochId!==p.learning.epoch.id)normalizeRewards(p);};
function mergeRewards(a,b,epochOrder) {
  if(epochOrder>0)return clone(b);
  if(epochOrder<0)return clone(a);
  const awards={...a.awards};
  for(const [id,record] of Object.entries(b.awards))if(!awards[id] || JSON.stringify(record)>JSON.stringify(awards[id]))awards[id]=record;
  const legacyDayXP={...a.legacyDayXP};
  for(const [day,xp] of Object.entries(b.legacyDayXP))legacyDayXP[day]=Math.max(Number(legacyDayXP[day])||0,Number(xp)||0);
  const evidenceDays={...a.evidenceDays};
  for(const [id,day] of Object.entries(b.evidenceDays))if(!evidenceDays[id]||day<evidenceDays[id])evidenceDays[id]=day;
  return {...a,legacyXP:Math.max(a.legacyXP,b.legacyXP),legacyDayXP,awards,evidenceDays};
}
function normalizeListChanges(p) {
  p.listsDeleted ||= {};p.listItemAdded ||= {};p.listItemDeleted ||= {};
  for(const [id,list] of Object.entries(p.lists)) {
    if(!safeKey(id)||!list)continue;
    if(id!=='bank' && stamp(p.listsDeleted[id])){delete p.lists[id];continue;}
    const added=p.listItemAdded[id] ||= {},removed=p.listItemDeleted[id] ||= {};
    for(const itemId of list.items)if(safeKey(itemId)&&added[itemId]===undefined)added[itemId]=stamp(list.created || p.created);
    list.items=[...new Set(list.items)].filter(itemId=>safeKey(itemId)&&(!stamp(removed[itemId])||stamp(added[itemId])>stamp(removed[itemId])));
  }
  p.scope.lists=(p.scope.lists || []).filter(id=>!!p.lists[id]);
}
function mergeLists(local,remote) {
  for(const id of Object.keys(remote.listsDeleted || {}))if(safeKey(id)&&id!=='bank')local.listsDeleted[id]=Math.max(stamp(local.listsDeleted[id]),stamp(remote.listsDeleted[id]));
  for(const field of ['listItemAdded','listItemDeleted'])for(const [listId,changes] of Object.entries(remote[field] || {}))if(safeKey(listId)) {
    const target=local[field][listId] ||= {};
    for(const [itemId,at] of Object.entries(changes))if(safeKey(itemId))target[itemId]=Math.max(stamp(target[itemId]),stamp(at));
  }
  for(const [id,list] of Object.entries(remote.lists))if(safeKey(id)&&list&&!stamp(local.listsDeleted[id])) {
    const previous=local.lists[id];
    local.lists[id]=previous ? {...(stamp(list.modified || list.created)>stamp(previous.modified || previous.created)?list:previous),items:[...new Set([...previous.items,...list.items])]} : clone(list);
  }
  normalizeListChanges(local);
}

export const DEFAULT_SETTINGS = {
  showEn: 'tap',        // 'tap' = reveal on tap, 'always' = always visible
  dailyNew: 8,          // new words per day
  dailyVerbs: 2,        // new verbs per day
  dailyReviews: 10,
  studyMinutes: 10,     // daily plan budget; existing review limits are preserved
  tts: true,
  ttsRate: 0.9,
  level: 'A1',
  theme: 'auto',
  accentStrict: false,  // require accents in typed answers
  adaptiveLearning: true,
  haptics: true,
};

// ---------- laboratorio records (the sentence workshop, docs/SENTENCE-LAB-CONTRACT.md §6) ----------
// profile.lab = { frasi: { done: { [lessonId]: at }, sentences: [{ it, en, lessonId, at }] } }: saved with the profile,
// merged on sync (newest `at` per lesson wins, sentences unioned by it+at), cleared by resetProgress, in every backup.
const LAB_SENTENCES_MAX = 200;
const LAB_BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const freshLabRecord = () => ({ done: {}, sentences: [] });
const freshLab = () => ({ frasi: freshLabRecord() });
// newest LAB_SENTENCES_MAX sentences, one per text+time, oldest first
function labSentences(list) {
  const seen = new Set(), out = [];
  for (const s of [...list].sort((a, b) => a.at - b.at)) { const key = `${s.it}|${s.at}`; if (seen.has(key)) continue; seen.add(key); out.push(s); }
  return out.slice(-LAB_SENTENCES_MAX);
}
function normalizeLabRecord(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const done = {};
  for (const [id, at] of Object.entries(r.done && typeof r.done === 'object' ? r.done : {})) { const t = Number(at); if (id && !LAB_BAD_KEYS.has(id) && Number.isFinite(t) && t > 0) done[id] = t; }
  const sentences = (Array.isArray(r.sentences) ? r.sentences : [])
    .filter(s => s && typeof s === 'object' && typeof s.it === 'string' && s.it.trim())
    .map(s => ({ it: s.it.trim(), en: typeof s.en === 'string' ? s.en.trim() : '', lessonId: typeof s.lessonId === 'string' ? s.lessonId : null, at: Math.max(0, Number(s.at) || 0) }));
  return { done, sentences: labSentences(sentences) };
}
function normalizeLab(raw) {
  const lab = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const key of new Set(['frasi', ...Object.keys(lab)])) if (!LAB_BAD_KEYS.has(key)) out[key] = normalizeLabRecord(lab[key]);
  return out;
}
function mergeLab(local, remote) {
  const a = normalizeLab(local), b = normalizeLab(remote), out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key] || freshLabRecord(), y = b[key] || freshLabRecord();
    const done = { ...x.done };
    for (const [id, at] of Object.entries(y.done)) done[id] = Math.max(done[id] || 0, at);
    out[key] = { done, sentences: labSentences([...x.sentences, ...y.sentences]) };
  }
  return out;
}

function newProfile(name, avatar) {
  const now = Date.now();
  return {
    id: uid(), learnerId:'learner:'+uid(), name, avatar: avatar || '🇮🇹', created: now, version: 2,
    learning: createLearning(now),
    settings: { ...DEFAULT_SETTINGS },
    items: {},
    lists: { bank: { id: 'bank', name: 'My word bank', items: [], created: now, builtin: true } },
    custom: {},
    customDeleted: {},
    stats: { xp: 0, streak: 0, bestStreak: 0, lastActive: null, days: {}, games: {}, verbsLearned: 0, wordsLearned: 0 },
    scope: { mode: 'level', levels: ['A1'], cats: [], lists: [] },
    recent: [],
    lab: freshLab(),
  };
}
// Fill in whatever a stored, older or imported profile lacks (custom, lists.bank, name, stats.days, a valid level…):
// every screen assumes the full shape, and a hand-edited or foreign backup must not crash Lists, Add word or Me.
function normalize(p) {
  const fresh = newProfile(p.name || 'Learner', p.avatar);
  // Older backups share a deterministic identity without treating their name
  // or their cloud account as evidence that two different learners are one.
  p.learnerId ||= p.id ? 'legacy:'+p.id : fresh.learnerId;
  p.name ||= fresh.name; p.avatar ||= fresh.avatar;
  p.settings = { ...fresh.settings, ...(p.settings || {}) };
  p.settings.studyMinutes = [5,10,15,20,30].includes(Number(p.settings.studyMinutes)) ? Number(p.settings.studyMinutes) : 10;
  if (!LEVELS.includes(p.settings.level)) p.settings.level = DEFAULT_SETTINGS.level;
  p.items ||= {}; p.lists ||= fresh.lists; p.lists.bank ||= fresh.lists.bank; p.custom ||= {};
  for (const l of Object.values(p.lists)) if (l && !Array.isArray(l.items)) l.items = [];
  p.stats = { ...fresh.stats, ...(p.stats || {}) }; p.stats.days ||= {}; p.stats.games ||= {};
  p.scope = { ...fresh.scope, ...(p.scope || {}) }; p.recent ||= [];
  const oldLearningVersion=p.learning?.version || 0;
  p.learning = normalizeLearning(p.learning);
  if(oldLearningVersion<3) {
    const chapterEntries=new Set(Object.values(p.learning.events || {}).filter(e=>e.policy==='journey-v1').map(e=>e.entryId));
    for(const [entryId,item] of Object.entries(p.items))if(item?.learned && !chapterEntries.has(entryId)) {
      const key=completionKey(entryId,'*');
      p.learning.completions[key] ||= {entryId,caseId:'*',checked:true,at:Number(item.learnedAt || item.last || 0),id:`legacy:${entryId}`,source:'legacy'};
    }
  }
  p.customDeleted ||= {};
  p.lab = normalizeLab(p.lab);
  if(!Number.isFinite(p.stats.learningXP))p.stats.learningXP=learningXP(p.learning);
  normalizeRewards(p);
  normalizeListChanges(p);
  p.version = Math.max(2, Number(p.version) || 1);
  return p;
}

// An installation identity is deliberately outside profile backups. The random suffix on
// each event also prevents collisions if two tabs read the same sequence concurrently.
let fallbackDevice = null;
function nextLearningIdentity() {
  let device, sequence = 1;
  try {
    device = localStorage.getItem('it.learningDevice');
    if (!device) { device = 'd:' + uid(); localStorage.setItem('it.learningDevice', device); }
    sequence = (Number(localStorage.getItem('it.learningSequence')) || 0) + 1;
    localStorage.setItem('it.learningSequence', String(sequence));
  } catch { device = fallbackDevice ||= 'd:' + uid(); }
  return { deviceId: device, sequence, id: device + ':' + sequence + ':' + uid() };
}
const learningXP = (domain) => Object.values(domain?.events || {}).reduce((n, e) => n + (Number(e.xp) || 0), 0);
const entryCompletionRecords = (domain,id) => ['*','word','present','past','background','future','condizionale']
  .map(caseId=>domain?.completions?.[completionKey(id,caseId)]).filter(Boolean);
const legacyCase = tense => ({presente:'present',passatoProssimo:'past',imperfetto:'background',futuro:'future',condizionale:'condizionale'}[tense]);

class Store extends EventTarget {
  constructor() { super(); this.profiles = []; this.current = null; this._saveTimer = null; this._dirty = false; this._saveQueue = Promise.resolve(); this._mirrorSerial = 0;this._revision=0;this._saveError=null;this._transition=null; }
  get saveError() { return this._saveError; }
  _failedSave(error=storageError(),profileId=this.current?.id) {
    this._saveError={profileId,message:error.message};this.emit('saveError',this._saveError);return error;
  }
  _saved(profileId) { this._saveError=null;this.emit('saveSuccess',{profileId});return {ok:true,durable:true,profileId}; }

  async init() {
    // Know whether saves need an unload mirror before creating the first profile.
    await db();
    let indexExists=false;
    try { const raw=localStorage.getItem(LS_PROFILES);indexExists=raw!==null;this.profiles=JSON.parse(raw||'[]'); } catch { throw new Error('The saved user list could not be read. Your progress has been kept; retry before resetting it.'); }
    if(!Array.isArray(this.profiles))throw new Error('The saved user list could not be read. Export your previous progress before resetting it.');
    if(!indexExists){const legacy=legacyRoster();if(legacy.profiles.length){this.profiles=legacy.profiles;if(!this._persistIndex())throw storageError();if(legacy.current)this._setCurrentId(legacy.current);}}
    let curId = null;
    try { curId = localStorage.getItem(LS_CURRENT); } catch { /* ignore */ }
    if (this.profiles.length === 0) {
      const p = newProfile('Learner');
      this.profiles.push({ id: p.id, learnerId:p.learnerId,name: p.name, avatar: p.avatar, created: p.created });
      if(!this._persistIndex())throw storageError();
      this.current = p;
      this.touchDay(); // the first launch is day 1 of the streak like every later one (and marks the profile dirty, so it is really written)
      await this.saveNow();
      this._setCurrentId(p.id);
    } else {
      const id = this.profiles.some(p => p.id === curId) ? curId : this.profiles[0].id;
      await this.switchProfile(id);
    }
    // persistent storage request (iOS ignores, but harmless)
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }
    // An IndexedDB write started during unload may never commit (a change made in the 400 ms before the app is closed or
    // reloaded was lost), so a dirty profile is also mirrored synchronously to localStorage and picked up on the next start.
    window.addEventListener('pagehide', () => { this._mirrorPending();void this.saveNow().catch(()=>{}); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden')void this.saveNow().catch(()=>{}); });
    return this;
  }
  _mirrorPending() {
    if (!this.current || !this._dirty || storageBackend === 'localStorage') return;
    const snapshot = JSON.stringify({ id: this.current.id, at: Date.now(), write: ++this._mirrorSerial, profile: this.current });
    try { localStorage.setItem(LS_PENDING, snapshot); return snapshot; } catch { /* quota */ }
  }
  // A mirror stays until its corresponding write commits. An older queued write
  // must never remove a newer snapshot made while it was still in flight.
  _takePending(id) {
    let raw = null;
    try { raw = localStorage.getItem(LS_PENDING); } catch { return null; }
    if (!raw) return null;
    try {
      const pend = JSON.parse(raw);
      if (!pend || pend.id !== id) return null;
      if (pend.profile && pend.profile.id === id) return pend.profile;
      localStorage.removeItem(LS_PENDING); return null;
    } catch { try { localStorage.removeItem(LS_PENDING); } catch { /* ignore */ } return null; }
  }

  _persistIndex() { try { localStorage.setItem(LS_PROFILES, JSON.stringify(this.profiles));return true; } catch {return false;} }
  _setCurrentId(id) { try { localStorage.setItem(LS_CURRENT, id); } catch { /* ignore */ } }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  on(type, fn) { this.addEventListener(type, fn); return () => this.removeEventListener(type, fn); }

  async switchProfile(id) {
    const loadSerial=this._profileLoadSerial=(this._profileLoadSerial||0)+1;
    const isCurrent=()=>this._profileLoadSerial===loadSerial;
    await this.saveNow();
    const meta = this.profiles.find(x => x.id === id);
    let p = await kvGet('profile:' + id);
    const primaryBefore=p===undefined?undefined:clone(p);
    let legacySource=null;
    if(p===undefined&&meta?.legacySource){legacySource=await legacyProfileCandidates(id);p=legacySource.pending||legacySource.primary||legacySource.fallback;}
    const pending = this._takePending(id);
    let pendingRaw=null;try{pendingRaw=localStorage.getItem(LS_PENDING);}catch{}
    if (pending) p = pending;
    if (!p) { p = newProfile(meta ? meta.name : 'Learner', meta && meta.avatar); p.id = id; }
    if(p.learning?.version>LEARNING_VERSION){const error=new Error('This profile needs a newer version of Parola. Update the app before using it.');error.profileBackup=migrationBackupJSON(p);throw error;}
    if((legacySource&&(legacySource.primary||legacySource.pending||legacySource.fallback))||((primaryBefore||pending)&&(p.learning?.version||0)<LEARNING_VERSION)){
      const candidate=normalize(clone(p));
      await migrateStoredProfile({database:await db(),storage:localStorage,profileId:id,primaryBefore,original:p,candidate,isCurrent,storagePrefix:PROFILE_STORAGE.fallback,legacySource});
      p=candidate;
      if(pendingRaw)try{if(localStorage.getItem(LS_PENDING)===pendingRaw)localStorage.removeItem(LS_PENDING);}catch{}
    }else normalize(p);
    const migrationPointer=await kvGet('migration-latest:'+id);
    if(!isCurrent())throw new Error('The selected profile changed. Retry opening it.');
    this.current = p;
    this.hasPreUpdateBackup=migrationPointer?.learnerId===p.learnerId;
    this._dirty=!!pending;
    this._revision++;this._saveError=null;
    if(meta){meta.learnerId=p.learnerId;this._persistIndex();}
    this._setCurrentId(id);
    this.touchDay();
    if (pending) this.save();
    this.emit('profile', p);
    this.emit('change');
    return p;
  }

  async createProfile(name, avatar) {
    await this.saveNow();
    const p = newProfile(name || 'Learner', avatar);
    normalize(p);
    if(!await kvSet('profile:' + p.id,p))throw this._failedSave();
    const previous=this.profiles;
    this.profiles=[...previous,{ id: p.id,learnerId:p.learnerId, name: p.name, avatar: p.avatar, created: p.created }];
    if(!this._persistIndex()){this.profiles=previous;await kvDel('profile:'+p.id);throw this._failedSave();}
    await this.switchProfile(p.id);
    return p;
  }
  async deleteProfile(id) {
    if(!this.profiles.some(p=>p.id===id))return;
    await this.saveNow();
    const wasCurrent = !!this.current && this.current.id === id;
    // a save still pending for the deleted user (switchProfile starts with saveNow) would re-create its record after kvDel
    if (wasCurrent) { clearTimeout(this._saveTimer); this._dirty = false; }
    const {deleteConversationsForProfile}=await import('./conversations/storage.js');
    const {deleteProfileBackupJournal}=await import('./conversations/profile-backup.js');
    await deleteProfileBackupJournal(id);
    await deleteConversationsForProfile(id);
    await deleteCourseRecordings(id+'|');
    await deleteLegacyProfile(id);
    await deleteProfileStorage(id);
    this.profiles = this.profiles.filter(p => p.id !== id);
    if (this.profiles.length === 0) { const p = newProfile('Learner'); this.profiles.push({ id: p.id, name: p.name, avatar: p.avatar, created: p.created }); await kvSet('profile:' + p.id, p); }
    this._persistIndex();
    if (wasCurrent || !this.current) await this.switchProfile(this.profiles[0].id);
    try { const raw = localStorage.getItem(LS_PENDING); if (raw && JSON.parse(raw).id === id) localStorage.removeItem(LS_PENDING); } catch { /* ignore */ }
    try { localStorage.removeItem('it.sync.' + id); } catch { /* ignore */ } // the deleted user's cloud tokens must not stay on the device
    this.emit('change');
  }
  renameProfile(name, avatar) {
    this.current.name = name; if (avatar) this.current.avatar = avatar;
    const meta = this.profiles.find(p => p.id === this.current.id); if (meta) { meta.name = name; meta.avatar = this.current.avatar; }
    this._persistIndex(); this.save();
  }

  save() {
    this._dirty = true;
    this._revision++;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {void this.saveNow().catch(()=>{});}, 400);
    this.emit('change');
  }
  async saveNow({retryFailed=true}={}) {
    if(this._transition){await this._transition.catch(()=>{});return this.saveNow({retryFailed});}
    // Retry also clears a failed replacement warning by durably saving the
    // retained active profile, even when that operation never made it dirty.
    if(retryFailed&&this.current&&this._saveError)this._dirty=true;
    if (!this.current || !this._dirty) return this._saveQueue;
    clearTimeout(this._saveTimer);
    const meta = this.profiles.find(p => p.id === this.current.id);
    if (meta) { meta.lastActive = Date.now();meta.learnerId=this.current.learnerId;this._persistIndex(); }
    const cur = this.current;
    const snapshot = JSON.parse(JSON.stringify(cur));
    if (storageBackend === 'localStorage') {
      // The fallback is already synchronous and durable before this call returns.
      // A second full profile mirror would unnecessarily consume its small quota.
      this._dirty = !localSet('profile:' + cur.id, snapshot);
      if (this._dirty)throw this._failedSave(storageError(),cur.id);
      return this._saved(cur.id);
    }
    // Mirror before clearing dirty: a reload can interrupt the IndexedDB commit
    // even after saveNow was called. Clean callers also await the queued commit.
    const mirrored = this._mirrorPending();
    this._dirty = false;
    this._saveQueue = this._saveQueue.catch(()=>{}).then(async () => {
      const ok = await kvSet('profile:' + cur.id, snapshot);
      if (ok) { try { if (mirrored && localStorage.getItem(LS_PENDING) === mirrored) localStorage.removeItem(LS_PENDING); } catch { /* ignore */ }return this._saved(cur.id); }
      else if (this.current === cur) {
        // Keep the latest profile, including edits made while this snapshot was
        // queued, available for recovery and for the next save attempt.
        this._dirty = true; this._mirrorPending();
      }
      throw this._failedSave(storageError(),cur.id);
    });
    return this._saveQueue;
  }

  // Destructive replacements are prepared off-screen. The old-schema snapshot
  // is read/verified before the new primary is written, and kept for recovery.
  async _commitProfile(candidate,{kind='import',silent=false,expected=this.current,revision=this._revision}={}) {
    if(Object.keys(candidate.custom||{}).some(id=>!hasCompletionDescriptor(id)))await loadFullCompletion();
    await this.saveNow({retryFailed:false});
    if(this.current!==expected||this._revision!==revision)throw new Error('Profile changed before saving. Your current progress has been kept; retry.');
    const profileId=expected.id,primary='profile:'+profileId,recoveryKey=(kind==='merge'?'merge-recovery:':'recovery:')+profileId;
    const run=(async()=>{
      const before=clone(expected),recovery={version:1,profileId,kind,at:Date.now(),checksum:checksum(before),profile:before};
      if(!await kvSet(recoveryKey,recovery))throw this._failedSave(new Error('A recovery copy could not be saved. Your current progress has been kept. Export a backup, then retry.'),profileId);
      const savedRecovery=await kvGet(recoveryKey);
      if(!savedRecovery?.profile||savedRecovery.checksum!==checksum(savedRecovery.profile)||JSON.stringify(savedRecovery.profile)!==JSON.stringify(before))
        throw this._failedSave(new Error('The recovery copy could not be verified. Your current progress has been kept.'),profileId);
      const unchanged=()=>this.current===expected&&this._revision===revision;
      if(!unchanged())throw new Error('Profile changed while preparing the save. Your current progress has been kept; retry.');
      let written=false;
      try {
        if(!await kvSet(primary,candidate))throw storageError();
        written=true;
        const verified=await kvGet(primary);
        if(!verified||JSON.stringify(verified)!==JSON.stringify(candidate))throw new Error('The saved changes could not be verified.');
        if(!unchanged())throw new Error('Profile changed while saving. Your current progress has been kept; retry.');
      } catch(error) {
        // A concurrent edit is still on the original object. Restore that latest
        // state rather than replacing it with an older captured snapshot.
        const previous=this.current===expected?clone(expected):before;
        if(written&&!await kvSet(primary,previous)) {
          this._dirty=this.current===expected;
          throw this._failedSave(new Error('The save failed and the old copy could not be restored. Your recovery backup is kept; export your current progress before closing the app.'),profileId);
        }
        throw this._failedSave(error,profileId);
      }
      if(candidate.learnerId!==expected.learnerId)this.hasPreUpdateBackup=false;
      this.current=candidate;this._dirty=false;this._revision++;
      const meta=this.profiles.find(p=>p.id===profileId);
      if(meta){meta.name=candidate.name;meta.avatar=candidate.avatar;meta.learnerId=candidate.learnerId;this._persistIndex();}
      this._saved(profileId);
      if(!silent){this.emit('profile',candidate);this.emit('change');}
      return {ok:true,durable:true,profileId,recoveryKey};
    })();
    this._transition=run;
    try{return await run;}finally{if(this._transition===run)this._transition=null;}
  }
  async recoveryBackup() {
    const migration=await kvGet('migration-latest:'+this.current.id);
    const recovery=await kvGet('recovery:'+this.current.id) || await kvGet('merge-recovery:'+this.current.id) || (migration&&await kvGet(migration.recoveryKey));
    if(!recovery?.profile||(recovery.kind==='migration'?!await verifyMigrationSnapshot(recovery):recovery.checksum!==checksum(recovery.profile)))throw new Error('No verified recovery backup is available for this user.');
    return JSON.stringify({app:'italiano',exported:new Date(recovery.at).toISOString(),profile:recovery.profile});
  }
  async preUpdateBackup(){const pointer=await kvGet('migration-latest:'+this.current.id),snapshot=pointer&&await kvGet(pointer.recoveryKey);if(!await verifyMigrationSnapshot(snapshot)||(snapshot.profile.learnerId||'legacy:'+snapshot.profile.id)!==this.current.learnerId)throw new Error('No verified pre-update backup is available for this learner.');return migrationBackupJSON(snapshot.profile);}
  async previousAppBackups(){
    const profileId=this.current.id,learnerId=this.current.learnerId,legacy=await legacyProfileCandidates(profileId),pointer=await kvGet('migration-latest:'+profileId),snapshot=pointer&&await kvGet(pointer.recoveryKey);
    if(this.current.id!==profileId||this.current.learnerId!==learnerId)throw new Error('The selected learner changed.');
    const verified=await verifyMigrationSnapshot(snapshot),baseline=verified?snapshot.legacySource||{}:{},seen=new Set(),copies=[];
    const add=(kind,profile)=>{if(!profile||(profile.learnerId||'legacy:'+profile.id)!==learnerId)return;const encoded=JSON.stringify(profile);if(seen.has(encoded))return;seen.add(encoded);copies.push({kind,json:migrationBackupJSON(profile)});};
    for(const source of [baseline,legacy])for(const kind of ['primary','pending','fallback']){const profile=source[kind];if(profile&&JSON.stringify(profile)!==JSON.stringify(verified?snapshot.profile:null))add(kind,profile);}
    for(const backup of [...(baseline.backups||[]),...(legacy.backups||[])])add('recovery',backup.snapshot?.profile);
    if(this.current.id!==profileId||this.current.learnerId!==learnerId)throw new Error('The selected learner changed.');
    return copies;
  }
  async restoreRecovery() { const backup=await this.recoveryBackup();return this.importJSON(backup); }

  // ---------- settings ----------
  get settings() { return this.current.settings; }
  setSetting(k, v) { this.current.settings[k] = v; this.save(); this.emit('settings', { k, v }); }

  // ---------- adaptive evidence (separate from the legacy whole-item SRS) ----------
  get learning() { return this.current.learning ||= createLearning(); }
  recordLearningAttempt(input) {
    const identity = nextLearningIdentity();
    const event = { ...identity, ...input, epochId: this.learning.epoch.id, at: input.at ?? Date.now() };
    event.xp = input.xp ?? (event.ok ? (event.assistance?.length ? 1 : 2) : 0);
    const before = skillState(this.learning, event.objectiveId, event.at);
    const result = recordAttempt(this.learning, event);
    this.current.learning = result.learning;
    if (result.added) {
      const stored = result.learning.events[event.id];
      const points = stored?.xp || 0;
      ensureRewards(this.current);
      this.current.rewards.evidenceDays[stored.id]=todayKey(new Date(stored.at));
      this.current.stats.learningXP = (Number(this.current.stats.learningXP)||0)+points;
      const day = this._day();
      if (input.countStats !== false && stored.outcome !== 'ungraded') {
        if (stored.outcome !== 'skipped') {
          if (stored.ok) day.correct = (day.correct || 0) + 1;
          else day.wrong = (day.wrong || 0) + 1;
        }
        if (before.due && before.due <= event.at && !before.sessionEvidence[event.sessionId]) day.reviews = (day.reviews || 0) + 1;
      }
      this.addXP(points, false,{evidence:true});
      this.save();
    }
    return { ...result, event: result.learning.events[event.id] || event };
  }
  saveLearningSession(session) {
    const domain = this.learning;
    if (domain.version > LEARNING_VERSION) return;
    domain.session = session ? { ...session, updatedAt: Date.now() } : null;
    domain.sessions ||= {};
    if (session) domain.sessions[learningSessionKey(session)] = domain.session;
    this.save();
  }
  setLearningPreference(key, value) {
    if (this.learning.version > LEARNING_VERSION) return;
    if (!['stage', 'expansions', 'courseLevel'].includes(key)) return;
    if (key === 'courseLevel' && !['Foundations',...LEVELS].includes(value)) return;
    this.learning.preferences = { ...this.learning.preferences, [key]: value, updatedAt: Date.now() };
    this.current.learning = normalizeLearning(this.learning);
    this.save();
  }
  learningSkills(now = Date.now()) { return allSkills(this.learning, now); }
  completionState(entryOrId) {
    const entry=typeof entryOrId==='string' ? data.byId.get(entryOrId) || this.current.custom?.[entryOrId] : entryOrId;
    return entryCompletion(entry && (entry.kind ? entry : {...entry,kind:entry.pos==='verb'?'verb':'word'}),this.learning,this.current.items[entry?.id]);
  }
  setCompletion(entryOrId,{caseId=null,checked}={}) {
    if(typeof checked!=='boolean' || this.learning.version>LEARNING_VERSION)return false;
    const entry=typeof entryOrId==='string' ? data.byId.get(entryOrId) || this.current.custom?.[entryOrId] : entryOrId;
    if(!entry)return false;
    const state=this.completionState(entry), ids=state.cases.length ? state.cases.filter(c=>c.available && (!caseId || c.id===caseId)).map(c=>c.id) : caseId ? [] : ['word'];
    if(!ids.length)return false;
    const at=Math.max(Date.now(),...Object.values(this.learning.completions || {}).map(c=>(c.at || 0)+1));
    for(const id of ids)this.current.learning=setCompletionRecord(this.learning,{entryId:entry.id,caseId:id,checked,at,id:`verb-flow-v2:${uid()}`,source:'manual',flowVersion:2},at);
    const item=this.ensureItem(entry.id), complete=this.completionState(entry).complete;
    item.learned=complete;item.last=at;
    if(complete)item.learnedAt ||= at;
    if(checked && !item.due)item.due=at+8*3600e3;
    this.save();void this.saveNow().catch(()=>{});
    return true;
  }
  // Classic walkthroughs do not create adaptive answer evidence. A live run
  // can enroll its actual taught/tested cases without weakening markLearned's
  // protection against a stale completion screen undoing a later uncheck.
  beginLegacyLessonRun(entry,{questions=[],passScore=100,taughtTenses=[]}={}) {
    if(!entry?.id || this.learning.version>LEARNING_VERSION || !questions.length)return null;
    const startedAt=Math.max(Date.now(),...entryCompletionRecords(this.learning,entry.id).map(c=>c.at+1));
    return {entry,questions:[...questions],passScore,startedAt,taughtTenses:[...taughtTenses],profileId:this.current.id,epochId:this.learning.epoch.id,finished:false};
  }
  finishLegacyLessonRun(run,result) {
    const rejected={complete:false,learnedNow:false,xp:0,caseIds:[]};
    if(!run || run.finished)return rejected;
    run.finished=true;
    if(run.profileId!==this.current.id || run.epochId!==this.learning.epoch.id || this.learning.version>LEARNING_VERSION)return rejected;
    const answers=result?.answers;
    if(!Array.isArray(answers) || answers.length!==run.questions.length || !answers.every((a,i)=>a.q===run.questions[i] && typeof a.ok==='boolean')
      || Math.round(answers.filter(a=>a.ok).length/answers.length*100)<run.passScore)return rejected;
    const taught=run.taughtTenses.filter(check=>{
      if(!check || !Number.isFinite(check.at))return false;
      const override=completionRecord(this.learning,run.entry.id,legacyCase(check.tense));
      return !override || override.checked || check.at>override.at;
    }).map(check=>check.tense);
    const ids=run.entry.kind==='verb' ? [...new Set([...taught,...answers.filter(a=>a.ok&&a.q.meta?.skill==='conjugation').map(a=>a.q.meta.tense)].map(legacyCase).filter(Boolean))] : ['word'];
    return this._completeLegacyCases(run.entry,ids,run.startedAt);
  }
  completeLegacyEvidence(entry,objectives,{sessionId}={}) {
    if(!entry?.id || !sessionId || this.learning.version>LEARNING_VERSION)return {complete:false,learnedNow:false,xp:0,caseIds:[]};
    const groups=new Map();
    for(const objective of objectives || []) {
      const id=entry.kind==='verb'?legacyCase(objective.tense):'word';
      if(!id || objective.required===false)continue;
      if(!groups.has(id))groups.set(id,[]);groups.get(id).push(objective);
    }
    const ids=[];
    for(const [id,required] of groups) {
      const override=completionRecord(this.learning,entry.id,id), cutoff=override?.checked===false?override.at:-Infinity;
      const evidence={...this.learning,events:Object.fromEntries(Object.entries(this.learning.events || {}).filter(([,e])=>e.at>cutoff))};
      if(required.every(o=>skillState(evidence,o.id).ready) && required.every(o=>Object.values(evidence.events).some(e=>e.objectiveId===o.id&&e.entryId===entry.id&&e.sessionId===sessionId&&e.ok)))ids.push(id);
    }
    return this._completeLegacyCases(entry,ids);
  }
  _completeLegacyCases(entry,caseIds,startedAt=Infinity) {
    const before=this.isLearned(entry.id), state=this.completionState(entry), xp=this.current.stats.xp;
    const ids=caseIds.filter(id=>(entry.kind!=='verb' || state.cases.some(c=>c.id===id&&c.available))
      && !(completionRecord(this.learning,entry.id,id)?.at>=startedAt));
    const at=Math.max(Date.now(),...entryCompletionRecords(this.learning,entry.id).map(c=>c.at+1));
    for(const caseId of ids)this.current.learning=setCompletionRecord(this.learning,{entryId:entry.id,caseId,checked:true,at,id:uid(),source:'legacy'});
    const complete=this.completionState(entry).complete;
    if(complete)this.markLearned(entry.id,entry.kind);
    else if(ids.length){const item=this.ensureItem(entry.id);item.learned=false;item.last=at;this.save();}
    return {complete,learnedNow:!before&&complete,xp:this.current.stats.xp-xp,caseIds:ids};
  }

  // ---------- items / SRS ----------
  getItem(id) { return this.current.items[id] || null; }
  ensureItem(id) { return (this.current.items[id] ||= { s: 0, ef: 2.5, iv: 0, due: 0, reps: 0, lapses: 0, seen: 0, ok: 0, ko: 0, learned: false, first: Date.now() }); }
  markLearned(id, kind) {
    if(this.learning.version>LEARNING_VERSION)return;
    // A stale completed screen must not undo an explicit uncheck. Fresh lesson
    // proof after that choice is required before automatic completion resumes.
    const records=entryCompletionRecords(this.learning,id);
    if(records.some(c=>!c.checked) && !this.completionState(id).complete)return;
    if(!records.length && !Object.values(this.learning.events || {}).some(e=>e.entryId===id && e.policy==='journey-v1'))
      this.current.learning=setCompletionRecord(this.learning,{entryId:id,caseId:'*',checked:true,at:Date.now(),id:`legacy:${id}`,source:'legacy'});
    const it = this.ensureItem(id);
    if (!it.learned) {
      // the reward (XP, learned counters, today's new items) is for the first time only: "Unmarked" keeps learnedAt, so
      // toggling Mark learned on an entry cannot farm 30 XP and a "new verb" per tap
      const completion=this.completionState(id);
      const manuallyComplete=completion.complete && (completion.cases.length
        ? completion.cases.filter(c=>c.available).every(c=>c.source==='manual') : completion.source==='manual');
      // Concurrent manual case edits can complete the whole entry while both
      // devices retain a partial legacy item flag. Reconciling that flag is not
      // a newly passed lesson and must not award its completion bonus.
      const first = !it.learnedAt && !manuallyComplete;
      it.learned = true; it.learnedAt = Date.now(); it.last = Date.now(); // `last` is what cloud sync compares: newest copy wins
      if (it.s < 1) it.s = 1;
      if (!it.due) { it.due = Date.now() + 8 * 3600e3; it.iv = 0; }
      if (first) {
        if (kind === 'verb') this.current.stats.verbsLearned = (this.current.stats.verbsLearned || 0) + 1;
        else this.current.stats.wordsLearned = (this.current.stats.wordsLearned || 0) + 1;
        const day = this._day(); day.new = (day.new || 0) + 1; if (kind === 'verb') day.newVerbs = (day.newVerbs || 0) + 1;
        this.addXP(kind === 'verb' ? 30 : 10, false,{id:`${this.learning.epoch.id}|completion|${id}`,kind:'completion',sourceId:id});
      }
    }
    this.save();
  }
  unlearn(id) { if(!this.setCompletion(id,{checked:false})){const it=this.current.items[id];if(it){it.learned=false;it.last=Date.now();this.save();}} }
  // record an answer: quality 0-5 (>=3 correct)
  recordAnswer(id, correct, opts = {}) {
    const it = this.ensureItem(id);
    const q = typeof opts.quality === 'number' ? opts.quality : (correct ? (opts.hint ? 3 : 4) : 1);
    const was = it.due;
    Object.assign(it, srsSchedule(it, q));
    it.seen++; if (correct) it.ok++; else it.ko++;
    it.last = Date.now();
    const day = this._day();
    if (correct) day.correct = (day.correct || 0) + 1; else day.wrong = (day.wrong || 0) + 1;
    if (was && was <= Date.now()) day.reviews = (day.reviews || 0) + 1;
    this.addXP(correct ? (opts.xp || 2) : 0, false);
    this.save();
    return it;
  }
  isLearned(id) { const it = this.current.items[id]; return entryCompletionRecords(this.learning,id).length && (data.byId.has(id)||this.current.custom?.[id]) ? this.completionState(id).complete : !!it?.learned; }
  // a custom verb (c:…) is a verb too: the 'v:' prefix alone would file it under the learned words
  isVerbId(id) { return id.startsWith('v:') || (id.startsWith('c:') && this.current.custom?.[id]?.pos === 'verb'); }
  // progress keyed to an id the dictionary no longer has (an entry renamed or dropped by a data rebuild, a backup from
  // another version) is kept but not counted: Home/Learn/Me would otherwise promise reviews that Review cannot show
  known(id) { return !data.loaded || data.byId.has(id) || (id.startsWith('c:') && !!this.current.custom?.[id]); }
  learnedIds(prefix) { return Object.keys(this.current.items).filter(id => this.isLearned(id) && this.known(id) && (!prefix || (prefix === 'v:' ? this.isVerbId(id) : id.startsWith(prefix)))); }
  learnedWordIds() { return this.learnedIds().filter(id => !this.isVerbId(id)); }
  dueIds(now = Date.now()) { return Object.entries(this.current.items).filter(([id, it]) => (it.learned || it.seen > 0) && this.known(id) && it.due && it.due <= now).map(([id]) => id); }

  // ---------- lists ----------
  get lists() { return this.current.lists; }
  createList(name) { const id = 'l:' + uid(); this.current.lists[id] = { id, name: name || 'New list', items: [], created: Date.now() }; this.save(); return id; }
  renameList(id, name) { if (this.current.lists[id]) { this.current.lists[id].name = name;this.current.lists[id].modified=Date.now(); this.save(); } }
  deleteList(id) { if (id === 'bank') return;normalizeListChanges(this.current);this.current.listsDeleted[id]=Math.max(Date.now(),stamp(this.current.listsDeleted[id])+1); delete this.current.lists[id]; this.current.scope.lists = (this.current.scope.lists || []).filter(x => x !== id); this.save(); }
  addToList(listId, itemId) { const l = this.current.lists[listId]; if (!l || !safeKey(itemId)) return false; if (!l.items.includes(itemId)) {normalizeListChanges(this.current);const added=this.current.listItemAdded[listId] ||= {};added[itemId]=Math.max(Date.now(),stamp(this.current.listItemDeleted[listId]?.[itemId])+1,stamp(added[itemId])+1);l.items.push(itemId); this.save(); return true; } return false; }
  removeFromList(listId, itemId) { const l = this.current.lists[listId]; if (!l || !safeKey(itemId)) return;normalizeListChanges(this.current);const removed=this.current.listItemDeleted[listId] ||= {};removed[itemId]=Math.max(Date.now(),stamp(this.current.listItemAdded[listId]?.[itemId])+1,stamp(removed[itemId])+1); l.items = l.items.filter(x => x !== itemId); this.save(); }
  inList(listId, itemId) { const l = this.current.lists[listId]; return !!(l && l.items.includes(itemId)); }
  listsContaining(itemId) { return Object.values(this.current.lists).filter(l => l.items.includes(itemId)); }

  // ---------- custom words ----------
  addCustomWord(entry) {
    const id = 'c:' + uid();
    this.current.custom[id] = { ...entry, id, custom: true, created: Date.now() };
    this.addToList('bank', id);
    this.save();
    return id;
  }
  updateCustomWord(id, patch) { if (this.current.custom[id]) { Object.assign(this.current.custom[id], patch, { modified: Date.now() }); this.save(); } }
  removeCustomWord(id) {
    delete this.current.custom[id];
    (this.current.customDeleted ||= {})[id] = Date.now();
    for (const l of Object.values(this.current.lists)) l.items = l.items.filter(x => x !== id);
    delete this.current.items[id];
    this.current.recent = (this.current.recent || []).filter(x => x !== id);
    for (const [key, session] of Object.entries(this.learning.sessions || {})) if (session.entryId === id) delete this.learning.sessions[key];
    if (this.learning.session?.entryId === id) this.learning.session = null;
    // Keep lightweight historical attempt IDs/XP for merge deduplication. This
    // tombstoned entry is excluded from every active/review/resume lookup.
    this.save();
  }

  // ---------- stats ----------
  _day() { const k = todayKey(); return (this.current.stats.days[k] ||= { new: 0, reviews: 0, correct: 0, wrong: 0, xp: 0, games: 0, time: 0 }); }
  touchDay() {
    const st = this.current.stats; const today = todayKey();
    // lastActive after today = the clock went back past midnight (time-zone change westwards, a clock correction):
    // that day was already counted, so nothing changes until the calendar catches up (the streak must not drop to 1)
    if (st.lastActive && st.lastActive > today) return;
    if (st.lastActive !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      if (st.lastActive === todayKey(y)) st.streak = (st.streak || 0) + 1;
      else if (st.lastActive !== today) st.streak = 1;
      st.bestStreak = Math.max(st.bestStreak || 0, st.streak);
      st.lastActive = today;
      this._day();
      this.save();
    }
  }
  addXP(n, doSave = true,{id=null,kind='activity',sourceId='',evidence=false}={}) {
    if(!n)return false;
    this.touchDay();ensureRewards(this.current);
    if(!evidence) {
      const epochId=this.learning.epoch.id,awardId=id || `${epochId}|activity|${nextLearningIdentity().id}`;
      if(this.current.rewards.awards[awardId])return false;
      this.current.rewards.awards[awardId]={id:awardId,epochId,kind,sourceId,xp:n,at:Date.now(),dayKey:todayKey(),policyVersion:1};
    }
    this.current.stats.xp += n;this._day().xp += n;if(doSave)this.save();return true;
  }
  recordGame(gameId, result) {
    const g = (this.current.stats.games[gameId] ||= { played: 0, best: 0, total: 0 });
    g.played++; g.total += result.score || 0; g.best = Math.max(g.best, result.score || 0);
    this._day().games++;
    this.addXP(result.xp || 0, false,{kind:'game',sourceId:gameId});
    this.save();
  }
  today() { return this._day(); }
  pushRecent(id) { const r = this.current.recent.filter(x => x !== id); r.unshift(id); this.current.recent = r.slice(0, 30); this.save(); }

  // ---------- scope ----------
  get scope() { return this.current.scope; }
  setScope(patch) { Object.assign(this.current.scope, patch); this.save(); this.emit('scope'); }

  // ---------- laboratorio (sentence workshop) ----------
  get lab() { return this.current.lab ||= freshLab(); }
  // { done: { [lessonId]: at }, sentences: [{ it, en, lessonId, at }] } for one lab key ('frasi'); created when missing
  labRecord(key = 'frasi') { if (!key || LAB_BAD_KEYS.has(key)) key = 'frasi'; const lab = this.lab; if (!lab[key]) lab[key] = freshLabRecord(); return lab[key]; }
  // First completion of a lesson is worth 15 XP; later completions keep the first timestamp. -> { first, at }
  completeLabLesson(key, lessonId) {
    if (!lessonId || LAB_BAD_KEYS.has(lessonId)) return { first: false, at: null };
    const record = this.labRecord(key);
    if (record.done[lessonId]) return { first: false, at: record.done[lessonId] };
    const at = Date.now();
    record.done[lessonId] = at;
    this.addXP(15, false,{id:`${this.learning.epoch.id}|lab|${key}|${lessonId}`,kind:'lab',sourceId:`${key}|${lessonId}`});
    this.save();
    return { first: true, at };
  }
  // "Le mie frasi": the learner's own composed sentences, newest LAB_SENTENCES_MAX kept. -> the saved record or null
  saveLabSentence(key, { it, en = '', lessonId = null } = {}) {
    const text = String(it ?? '').trim();
    if (!text) return null;
    const record = this.labRecord(key);
    const entry = { it: text, en: String(en ?? '').trim(), lessonId: typeof lessonId === 'string' ? lessonId : null, at: Date.now() };
    record.sentences = labSentences([...record.sentences, entry]);
    this.save();
    return entry;
  }

  // ---------- export / import ----------
  exportJSON() { return JSON.stringify({ app: 'italiano', exported: new Date().toISOString(), profile: this.current }, null, 0); }
  async importJSON(text, { merge = false, silent = false, backupOperationId = null } = {}) {
    if(backupOperationId!==null&&(typeof backupOperationId!=='string'||!backupOperationId||backupOperationId.length>200))throw new TypeError('Invalid backup operation');
    const obj = JSON.parse(text);
    const p = clone(obj.profile || obj);
    if (!p || typeof p!=='object' || Array.isArray(p) || !p.items || !p.lists || Array.isArray(p.items) || Array.isArray(p.lists)) throw new Error('Not a valid backup file');
    if (p.learning?.version > LEARNING_VERSION) throw new Error('This progress uses a newer version of Parola. Update the app before importing or syncing it. Your current progress has been kept.');
    if(p.rewards?.version>1)throw new Error('This reward data uses a newer version of Parola. Your current progress has been kept.');
    const expected=this.current,revision=this._revision;
    if(!p.id&&!p.learnerId)p.learnerId=expected.learnerId;
    normalize(p);
    let candidate;
    if (merge) {
      if(p.learnerId!==expected.learnerId)throw new Error('This backup belongs to a different learner. Your current progress has been kept. Use Replace only to restore that learner deliberately.');
      const cur = normalize(clone(expected));
      const remoteLearning = normalizeLearning(p.learning);
      const epochOrder = (remoteLearning.epoch.at - cur.learning.epoch.at) || (remoteLearning.epoch.id < cur.learning.epoch.id ? -1 : remoteLearning.epoch.id > cur.learning.epoch.id ? 1 : 0);
      // Reset generations also protect legacy progress from a stale cloud copy.
      if (epochOrder > 0) { cur.items = {}; cur.stats = newProfile(cur.name).stats; cur.recent = []; }
      cur.rewards=mergeRewards(cur.rewards,p.rewards,epochOrder);
      cur.learning = mergeLearning(cur.learning, p.learning);
      if (epochOrder >= 0) for (const [id, it] of Object.entries(p.items)) { const c = cur.items[id]; if (!c || (it.last || 0) > (c.last || 0)) cur.items[id] = it; }
      // the lab records follow the legacy progress: a newer remote reset generation replaces them, an older one is ignored
      if (epochOrder > 0) cur.lab = freshLab();
      if (epochOrder >= 0) cur.lab = mergeLab(cur.lab, p.lab);
      mergeLists(cur,p);
      for (const [id, w] of Object.entries(p.custom || {})) { const c = cur.custom[id]; if (!c || (w.modified || w.created || 0) > (c.modified || c.created || 0)) cur.custom[id] = w; }
      for (const [id, at] of Object.entries(p.customDeleted || {})) if (id.startsWith('c:')) cur.customDeleted[id] = Math.max(cur.customDeleted[id] || 0, Number(at) || 0);
      for (const id of Object.keys(cur.customDeleted)) {
        delete cur.custom[id]; delete cur.items[id];
        for (const list of Object.values(cur.lists)) list.items = list.items.filter(x => x !== id);
        for (const [key, session] of Object.entries(cur.learning.sessions || {})) if (session.entryId === id) delete cur.learning.sessions[key];
        if (cur.learning.session?.entryId === id) cur.learning.session = null;
      }
      cur.stats.learningXP = learningXP(cur.learning);
      cur.stats.xp = cur.rewards.legacyXP+awardXP(cur.rewards)+cur.stats.learningXP;
      if (epochOrder >= 0) {
        cur.stats.bestStreak = Math.max(cur.stats.bestStreak || 0, p.stats?.bestStreak || 0);
        for (const [d, v] of Object.entries(p.stats?.days || {})) if (!cur.stats.days[d]) cur.stats.days[d] = v;
      }
      const dayXP={...cur.rewards.legacyDayXP};
      for(const a of Object.values(cur.rewards.awards))dayXP[a.dayKey]=(Number(dayXP[a.dayKey])||0)+a.xp;
      for(const [id,day] of Object.entries(cur.rewards.evidenceDays))if(cur.learning.events[id])dayXP[day]=(Number(dayXP[day])||0)+cur.learning.events[id].xp;
      for(const [day,xp] of Object.entries(dayXP))(cur.stats.days[day] ||= {new:0,reviews:0,correct:0,wrong:0,xp:0,games:0,time:0}).xp=xp;
      candidate=cur;
    } else {
      p.id = expected.id; // explicit restore keeps the slot but adopts the saved learner identity
      candidate=p;
    }
    if(backupOperationId)candidate.lastBackupImportId=backupOperationId;else if(!silent)delete candidate.lastBackupImportId;
    return this._commitProfile(candidate,{kind:merge?'merge':'import',silent,expected,revision});
  }
  async resetProgress() {
    const expected=this.current,revision=this._revision,p=clone(expected);
    p.learning = resetLearning(p.learning, Date.now(), 'reset:' + uid());
    p.items = {}; p.stats = newProfile(p.name).stats; p.recent = []; p.lab = freshLab();
    delete p.rewards;normalizeRewards(p);
    const result=await this._commitProfile(p,{kind:'reset',expected,revision});
    try{await deleteCourseRecordings(p.id+'|');return {...result,recordingsDeleted:true};}
    catch(error){this.emit('recordingError',{profileId:p.id,message:'Progress was reset, but saved recordings could not be removed. Retry their removal on this device.'});return {...result,recordingsDeleted:false};}
  }
  async checkpointEvidence() {
    const expected=this.current,revision=this._revision,candidate=clone(expected);
    candidate.learning=checkpointLearning(expected.learning);
    return this._commitProfile(candidate,{kind:'checkpoint',expected,revision});
  }
}

export const store = new Store();
