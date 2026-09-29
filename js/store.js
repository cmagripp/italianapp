// Persistent per-user storage: profiles, item progress (SRS), lists, custom words, settings and stats.
// Primary storage is IndexedDB (large quota, survives Safari homescreen installs); localStorage is the fallback.
import { schedule as srsSchedule } from './srs.js';
import { data, LEVELS } from './data.js'; // data.js imports nothing, so no cycle
import { LEARNING_VERSION, createLearning, normalizeLearning, mergeLearning, resetLearning, recordAttempt, skillState, allSkills, learningSessionKey } from './learning/model.js';

const DB_NAME = 'italiano-db';
const KV = 'kv';
const LS_PROFILES = 'it.profiles';
const LS_CURRENT = 'it.currentProfile';
const LS_PENDING = 'it.pendingProfile'; // unsaved profile mirrored on pagehide (see init)

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
let dbPromise = null;
const db = () => (dbPromise ||= openDB());

async function kvGet(key) {
  const d = await db();
  if (!d) { try { const v = localStorage.getItem('kv:' + key); return v ? JSON.parse(v) : undefined; } catch { return undefined; } }
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(KV, 'readonly');
      const req = tx.objectStore(KV).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}
async function kvSet(key, value) {
  const d = await db();
  if (!d) { try { localStorage.setItem('kv:' + key, JSON.stringify(value)); return true; } catch { return false; /* quota */ } }
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
  if (!d) { try { localStorage.removeItem('kv:' + key); } catch { /* ignore */ } return; }
  return new Promise((resolve) => {
    try { const tx = d.transaction(KV, 'readwrite'); tx.objectStore(KV).delete(key); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); tx.onabort = () => resolve(false); } catch { resolve(false); }
  });
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const DEFAULT_SETTINGS = {
  showEn: 'tap',        // 'tap' = reveal on tap, 'always' = always visible
  dailyNew: 8,          // new words per day
  dailyVerbs: 2,        // new verbs per day
  dailyReviews: 40,
  tts: true,
  ttsRate: 0.9,
  level: 'A1',
  theme: 'auto',
  accentStrict: false,  // require accents in typed answers
  adaptiveLearning: true,
  haptics: true,
};

function newProfile(name, avatar) {
  const now = Date.now();
  return {
    id: uid(), name, avatar: avatar || '🇮🇹', created: now, version: 2,
    learning: createLearning(now),
    settings: { ...DEFAULT_SETTINGS },
    items: {},
    lists: { bank: { id: 'bank', name: 'My word bank', items: [], created: now, builtin: true } },
    custom: {},
    customDeleted: {},
    stats: { xp: 0, streak: 0, bestStreak: 0, lastActive: null, days: {}, games: {}, verbsLearned: 0, wordsLearned: 0 },
    scope: { mode: 'level', levels: ['A1'], cats: [], lists: [] },
    recent: [],
  };
}
// Fill in whatever a stored, older or imported profile lacks (custom, lists.bank, name, stats.days, a valid level…):
// every screen assumes the full shape, and a hand-edited or foreign backup must not crash Lists, Add word or Me.
function normalize(p) {
  const fresh = newProfile(p.name || 'Learner', p.avatar);
  p.name ||= fresh.name; p.avatar ||= fresh.avatar;
  p.settings = { ...fresh.settings, ...(p.settings || {}) };
  if (!LEVELS.includes(p.settings.level)) p.settings.level = DEFAULT_SETTINGS.level;
  p.items ||= {}; p.lists ||= fresh.lists; p.lists.bank ||= fresh.lists.bank; p.custom ||= {};
  for (const l of Object.values(p.lists)) if (l && !Array.isArray(l.items)) l.items = [];
  p.stats = { ...fresh.stats, ...(p.stats || {}) }; p.stats.days ||= {}; p.stats.games ||= {};
  p.scope = { ...fresh.scope, ...(p.scope || {}) }; p.recent ||= [];
  p.learning = normalizeLearning(p.learning);
  p.customDeleted ||= {};
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

class Store extends EventTarget {
  constructor() { super(); this.profiles = []; this.current = null; this._saveTimer = null; this._dirty = false; this._saveQueue = Promise.resolve(); this._mirrorSerial = 0; }

  async init() {
    try { this.profiles = JSON.parse(localStorage.getItem(LS_PROFILES) || '[]'); } catch { this.profiles = []; }
    let curId = null;
    try { curId = localStorage.getItem(LS_CURRENT); } catch { /* ignore */ }
    if (this.profiles.length === 0) {
      const p = newProfile('Learner');
      this.profiles.push({ id: p.id, name: p.name, avatar: p.avatar, created: p.created });
      this._persistIndex();
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
    window.addEventListener('pagehide', () => { this._mirrorPending(); this.saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.saveNow(); });
    return this;
  }
  _mirrorPending() {
    if (!this.current || !this._dirty) return;
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

  _persistIndex() { try { localStorage.setItem(LS_PROFILES, JSON.stringify(this.profiles)); } catch { /* ignore */ } }
  _setCurrentId(id) { try { localStorage.setItem(LS_CURRENT, id); } catch { /* ignore */ } }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  on(type, fn) { this.addEventListener(type, fn); return () => this.removeEventListener(type, fn); }

  async switchProfile(id) {
    await this.saveNow();
    const meta = this.profiles.find(x => x.id === id);
    let p = await kvGet('profile:' + id);
    const pending = this._takePending(id);
    if (pending) { p = pending; this._dirty = true; }
    if (!p) { p = newProfile(meta ? meta.name : 'Learner', meta && meta.avatar); p.id = id; }
    normalize(p); // upgrade missing fields
    this.current = p;
    this._setCurrentId(id);
    this.touchDay();
    if (pending) this.save();
    this.emit('profile', p);
    this.emit('change');
    return p;
  }

  async createProfile(name, avatar) {
    const p = newProfile(name || 'Learner', avatar);
    this.profiles.push({ id: p.id, name: p.name, avatar: p.avatar, created: p.created });
    this._persistIndex();
    await kvSet('profile:' + p.id, p);
    await this.switchProfile(p.id);
    return p;
  }
  async deleteProfile(id) {
    const wasCurrent = !!this.current && this.current.id === id;
    // a save still pending for the deleted user (switchProfile starts with saveNow) would re-create its record after kvDel
    if (wasCurrent) { clearTimeout(this._saveTimer); this._dirty = false; }
    this.profiles = this.profiles.filter(p => p.id !== id);
    if (this.profiles.length === 0) { const p = newProfile('Learner'); this.profiles.push({ id: p.id, name: p.name, avatar: p.avatar, created: p.created }); await kvSet('profile:' + p.id, p); }
    this._persistIndex();
    if (wasCurrent || !this.current) await this.switchProfile(this.profiles[0].id);
    await kvDel('profile:' + id);
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
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveNow(), 400);
    this.emit('change');
  }
  async saveNow() {
    if (!this.current || !this._dirty) return this._saveQueue;
    clearTimeout(this._saveTimer);
    const meta = this.profiles.find(p => p.id === this.current.id);
    if (meta) { meta.lastActive = Date.now(); this._persistIndex(); }
    const cur = this.current;
    const snapshot = JSON.parse(JSON.stringify(cur));
    // Mirror before clearing dirty: a reload can interrupt the IndexedDB commit
    // even after saveNow was called. Clean callers also await the queued commit.
    const mirrored = this._mirrorPending();
    this._dirty = false;
    this._saveQueue = this._saveQueue.then(async () => {
      const ok = await kvSet('profile:' + cur.id, snapshot);
      if (ok) { try { if (mirrored && localStorage.getItem(LS_PENDING) === mirrored) localStorage.removeItem(LS_PENDING); } catch { /* ignore */ } }
      else if (this.current === cur) {
        // Keep the latest profile, including edits made while this snapshot was
        // queued, available for recovery and for the next save attempt.
        this._dirty = true; this._mirrorPending(); this.emit('saveError');
      }
    });
    return this._saveQueue;
  }

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
      this.current.stats.learningXP = learningXP(result.learning);
      const day = this._day();
      if (input.countStats !== false) {
        if (stored.outcome !== 'skipped') {
          if (stored.ok) day.correct = (day.correct || 0) + 1;
          else day.wrong = (day.wrong || 0) + 1;
        }
        if (before.due && before.due <= event.at && !before.sessionEvidence[event.sessionId]) day.reviews = (day.reviews || 0) + 1;
      }
      this.addXP(points, false);
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
    if (!['stage', 'expansions'].includes(key)) return;
    this.learning.preferences = { ...this.learning.preferences, [key]: value, updatedAt: Date.now() };
    this.current.learning = normalizeLearning(this.learning);
    this.save();
  }
  learningSkills(now = Date.now()) { return allSkills(this.learning, now); }

  // ---------- items / SRS ----------
  getItem(id) { return this.current.items[id] || null; }
  ensureItem(id) { return (this.current.items[id] ||= { s: 0, ef: 2.5, iv: 0, due: 0, reps: 0, lapses: 0, seen: 0, ok: 0, ko: 0, learned: false, first: Date.now() }); }
  markLearned(id, kind) {
    const it = this.ensureItem(id);
    if (!it.learned) {
      // the reward (XP, learned counters, today's new items) is for the first time only: "Unmarked" keeps learnedAt, so
      // toggling Mark learned on an entry cannot farm 30 XP and a "new verb" per tap
      const first = !it.learnedAt;
      it.learned = true; it.learnedAt = Date.now(); it.last = Date.now(); // `last` is what cloud sync compares: newest copy wins
      if (it.s < 1) it.s = 1;
      if (!it.due) { it.due = Date.now() + 8 * 3600e3; it.iv = 0; }
      if (first) {
        if (kind === 'verb') this.current.stats.verbsLearned = (this.current.stats.verbsLearned || 0) + 1;
        else this.current.stats.wordsLearned = (this.current.stats.wordsLearned || 0) + 1;
        const day = this._day(); day.new = (day.new || 0) + 1; if (kind === 'verb') day.newVerbs = (day.newVerbs || 0) + 1;
        this.addXP(kind === 'verb' ? 30 : 10, false);
      }
    }
    this.save();
  }
  unlearn(id) { const it = this.current.items[id]; if (it) { it.learned = false; it.last = Date.now(); this.save(); } }
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
  isLearned(id) { const it = this.current.items[id]; return !!(it && it.learned); }
  // a custom verb (c:…) is a verb too: the 'v:' prefix alone would file it under the learned words
  isVerbId(id) { return id.startsWith('v:') || (id.startsWith('c:') && this.current.custom?.[id]?.pos === 'verb'); }
  // progress keyed to an id the dictionary no longer has (an entry renamed or dropped by a data rebuild, a backup from
  // another version) is kept but not counted: Home/Learn/Me would otherwise promise reviews that Review cannot show
  known(id) { return !data.loaded || data.byId.has(id) || (id.startsWith('c:') && !!this.current.custom?.[id]); }
  learnedIds(prefix) { return Object.entries(this.current.items).filter(([id, it]) => it.learned && this.known(id) && (!prefix || (prefix === 'v:' ? this.isVerbId(id) : id.startsWith(prefix)))).map(([id]) => id); }
  learnedWordIds() { return this.learnedIds().filter(id => !this.isVerbId(id)); }
  dueIds(now = Date.now()) { return Object.entries(this.current.items).filter(([id, it]) => (it.learned || it.seen > 0) && this.known(id) && it.due && it.due <= now).map(([id]) => id); }

  // ---------- lists ----------
  get lists() { return this.current.lists; }
  createList(name) { const id = 'l:' + uid(); this.current.lists[id] = { id, name: name || 'New list', items: [], created: Date.now() }; this.save(); return id; }
  renameList(id, name) { if (this.current.lists[id]) { this.current.lists[id].name = name; this.save(); } }
  deleteList(id) { if (id === 'bank') return; delete this.current.lists[id]; this.current.scope.lists = (this.current.scope.lists || []).filter(x => x !== id); this.save(); }
  addToList(listId, itemId) { const l = this.current.lists[listId]; if (!l) return false; if (!l.items.includes(itemId)) { l.items.push(itemId); this.save(); return true; } return false; }
  removeFromList(listId, itemId) { const l = this.current.lists[listId]; if (!l) return; l.items = l.items.filter(x => x !== itemId); this.save(); }
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
  addXP(n, doSave = true) { if (!n) return; this.touchDay(); this.current.stats.xp += n; this._day().xp += n; if (doSave) this.save(); }
  recordGame(gameId, result) {
    const g = (this.current.stats.games[gameId] ||= { played: 0, best: 0, total: 0 });
    g.played++; g.total += result.score || 0; g.best = Math.max(g.best, result.score || 0);
    this._day().games++;
    this.addXP(result.xp || 0, false);
    this.save();
  }
  today() { return this._day(); }
  pushRecent(id) { const r = this.current.recent.filter(x => x !== id); r.unshift(id); this.current.recent = r.slice(0, 30); this.save(); }

  // ---------- scope ----------
  get scope() { return this.current.scope; }
  setScope(patch) { Object.assign(this.current.scope, patch); this.save(); this.emit('scope'); }

  // ---------- export / import ----------
  exportJSON() { return JSON.stringify({ app: 'italiano', exported: new Date().toISOString(), profile: this.current }, null, 0); }
  async importJSON(text, { merge = false, silent = false } = {}) {
    const obj = JSON.parse(text);
    const p = obj.profile || obj;
    if (!p || !p.items || !p.lists) throw new Error('Not a valid backup file');
    if (p.learning?.version > LEARNING_VERSION) throw new Error('This progress uses a newer version of Parola. Update the app before importing or syncing it. Your current progress has been kept.');
    if (merge) {
      const cur = normalize(this.current);
      const remoteLearning = normalizeLearning(p.learning);
      const epochOrder = (remoteLearning.epoch.at - cur.learning.epoch.at) || (remoteLearning.epoch.id < cur.learning.epoch.id ? -1 : remoteLearning.epoch.id > cur.learning.epoch.id ? 1 : 0);
      // Reset generations also protect legacy progress from a stale cloud copy.
      if (epochOrder > 0) { cur.items = {}; cur.stats = newProfile(cur.name).stats; cur.recent = []; }
      const localLegacyXP = Math.max(0, cur.stats.xp - (cur.stats.learningXP || 0));
      const remoteLegacyXP = epochOrder < 0 ? 0 : Math.max(0, (p.stats?.xp || 0) - (p.stats?.learningXP || 0));
      cur.learning = mergeLearning(cur.learning, p.learning);
      if (epochOrder >= 0) for (const [id, it] of Object.entries(p.items)) { const c = cur.items[id]; if (!c || (it.last || 0) > (c.last || 0)) cur.items[id] = it; }
      for (const [id, l] of Object.entries(p.lists)) { if (!cur.lists[id]) cur.lists[id] = { ...l, items: Array.isArray(l.items) ? l.items : [] }; else cur.lists[id].items = [...new Set([...(cur.lists[id].items || []), ...(l.items || [])])]; }
      for (const [id, w] of Object.entries(p.custom || {})) { const c = cur.custom[id]; if (!c || (w.modified || w.created || 0) > (c.modified || c.created || 0)) cur.custom[id] = w; }
      for (const [id, at] of Object.entries(p.customDeleted || {})) if (id.startsWith('c:')) cur.customDeleted[id] = Math.max(cur.customDeleted[id] || 0, Number(at) || 0);
      for (const id of Object.keys(cur.customDeleted)) {
        delete cur.custom[id]; delete cur.items[id];
        for (const list of Object.values(cur.lists)) list.items = list.items.filter(x => x !== id);
        for (const [key, session] of Object.entries(cur.learning.sessions || {})) if (session.entryId === id) delete cur.learning.sessions[key];
        if (cur.learning.session?.entryId === id) cur.learning.session = null;
      }
      cur.stats.learningXP = learningXP(cur.learning);
      cur.stats.xp = Math.max(localLegacyXP, remoteLegacyXP) + cur.stats.learningXP;
      if (epochOrder >= 0) {
        cur.stats.bestStreak = Math.max(cur.stats.bestStreak || 0, p.stats?.bestStreak || 0);
        for (const [d, v] of Object.entries(p.stats?.days || {})) if (!cur.stats.days[d]) cur.stats.days[d] = v;
      }
    } else {
      p.id = this.current.id; // keep current slot
      normalize(p); // a partial or foreign backup gets custom, lists.bank, name, a valid level… like a stored profile does
      this.current = p;
      const meta = this.profiles.find(x => x.id === p.id); if (meta) { meta.name = p.name; meta.avatar = p.avatar; this._persistIndex(); }
    }
    this._dirty = true;
    await this.saveNow();
    if (!silent) { this.emit('profile', this.current); this.emit('change'); }
  }
  async resetProgress() {
    const p = this.current;
    p.learning = resetLearning(p.learning, Date.now(), 'reset:' + uid());
    p.items = {}; p.stats = newProfile(p.name).stats; p.recent = [];
    this._dirty = true; await this.saveNow(); this.emit('change');
  }
}

export const store = new Store();
