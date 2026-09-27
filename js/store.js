// Persistent per-user storage: profiles, item progress (SRS), lists, custom words, settings and stats.
// Primary storage is IndexedDB (large quota, survives Safari homescreen installs); localStorage is the fallback.
import { schedule as srsSchedule } from './srs.js';

const DB_NAME = 'italiano-db';
const KV = 'kv';
const LS_PROFILES = 'it.profiles';
const LS_CURRENT = 'it.currentProfile';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(KV); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
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
  if (!d) { try { localStorage.setItem('kv:' + key, JSON.stringify(value)); } catch { /* quota */ } return; }
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(KV, 'readwrite');
      tx.objectStore(KV).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}
async function kvDel(key) {
  const d = await db();
  if (!d) { try { localStorage.removeItem('kv:' + key); } catch { /* ignore */ } return; }
  return new Promise((resolve) => {
    try { const tx = d.transaction(KV, 'readwrite'); tx.objectStore(KV).delete(key); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); } catch { resolve(false); }
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
  haptics: true,
};

function newProfile(name, avatar) {
  const now = Date.now();
  return {
    id: uid(), name, avatar: avatar || '🇮🇹', created: now, version: 1,
    settings: { ...DEFAULT_SETTINGS },
    items: {},
    lists: { bank: { id: 'bank', name: 'My word bank', items: [], created: now, builtin: true } },
    custom: {},
    stats: { xp: 0, streak: 0, bestStreak: 0, lastActive: null, days: {}, games: {}, verbsLearned: 0, wordsLearned: 0 },
    scope: { mode: 'level', levels: ['A1'], cats: [], lists: [] },
    recent: [],
  };
}

class Store extends EventTarget {
  constructor() { super(); this.profiles = []; this.current = null; this._saveTimer = null; this._dirty = false; }

  async init() {
    try { this.profiles = JSON.parse(localStorage.getItem(LS_PROFILES) || '[]'); } catch { this.profiles = []; }
    let curId = null;
    try { curId = localStorage.getItem(LS_CURRENT); } catch { /* ignore */ }
    if (this.profiles.length === 0) {
      const p = newProfile('Learner');
      this.profiles.push({ id: p.id, name: p.name, avatar: p.avatar, created: p.created });
      this._persistIndex();
      this.current = p;
      await this.saveNow();
      this._setCurrentId(p.id);
    } else {
      const id = this.profiles.some(p => p.id === curId) ? curId : this.profiles[0].id;
      await this.switchProfile(id);
    }
    // persistent storage request (iOS ignores, but harmless)
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }
    window.addEventListener('pagehide', () => this.saveNow());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.saveNow(); });
    return this;
  }

  _persistIndex() { try { localStorage.setItem(LS_PROFILES, JSON.stringify(this.profiles)); } catch { /* ignore */ } }
  _setCurrentId(id) { try { localStorage.setItem(LS_CURRENT, id); } catch { /* ignore */ } }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  on(type, fn) { this.addEventListener(type, fn); return () => this.removeEventListener(type, fn); }

  async switchProfile(id) {
    await this.saveNow();
    let p = await kvGet('profile:' + id);
    if (!p) { const meta = this.profiles.find(x => x.id === id); p = newProfile(meta ? meta.name : 'Learner', meta && meta.avatar); p.id = id; }
    // upgrade missing fields
    const fresh = newProfile(p.name, p.avatar);
    p.settings = { ...fresh.settings, ...(p.settings || {}) };
    p.items ||= {}; p.lists ||= fresh.lists; p.lists.bank ||= fresh.lists.bank; p.custom ||= {}; p.stats = { ...fresh.stats, ...(p.stats || {}) }; p.scope = { ...fresh.scope, ...(p.scope || {}) }; p.recent ||= [];
    this.current = p;
    this._setCurrentId(id);
    this.touchDay();
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
    this.profiles = this.profiles.filter(p => p.id !== id);
    await kvDel('profile:' + id);
    if (this.profiles.length === 0) { const p = newProfile('Learner'); this.profiles.push({ id: p.id, name: p.name, avatar: p.avatar, created: p.created }); await kvSet('profile:' + p.id, p); }
    this._persistIndex();
    if (!this.current || this.current.id === id) await this.switchProfile(this.profiles[0].id);
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
    if (!this.current || !this._dirty) return;
    this._dirty = false;
    clearTimeout(this._saveTimer);
    const meta = this.profiles.find(p => p.id === this.current.id);
    if (meta) { meta.lastActive = Date.now(); this._persistIndex(); }
    await kvSet('profile:' + this.current.id, this.current);
  }

  // ---------- settings ----------
  get settings() { return this.current.settings; }
  setSetting(k, v) { this.current.settings[k] = v; this.save(); this.emit('settings', { k, v }); }

  // ---------- items / SRS ----------
  getItem(id) { return this.current.items[id] || null; }
  ensureItem(id) { return (this.current.items[id] ||= { s: 0, ef: 2.5, iv: 0, due: 0, reps: 0, lapses: 0, seen: 0, ok: 0, ko: 0, learned: false, first: Date.now() }); }
  markLearned(id, kind) {
    const it = this.ensureItem(id);
    if (!it.learned) {
      it.learned = true; it.learnedAt = Date.now();
      if (it.s < 1) it.s = 1;
      if (!it.due) { it.due = Date.now() + 8 * 3600e3; it.iv = 0; }
      if (kind === 'verb') this.current.stats.verbsLearned = (this.current.stats.verbsLearned || 0) + 1;
      else this.current.stats.wordsLearned = (this.current.stats.wordsLearned || 0) + 1;
      const day = this._day(); day.new = (day.new || 0) + 1; if (kind === 'verb') day.newVerbs = (day.newVerbs || 0) + 1;
      this.addXP(kind === 'verb' ? 30 : 10, false);
    }
    this.save();
  }
  unlearn(id) { const it = this.current.items[id]; if (it) { it.learned = false; this.save(); } }
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
  learnedIds(prefix) { return Object.entries(this.current.items).filter(([id, it]) => it.learned && (!prefix || id.startsWith(prefix))).map(([id]) => id); }
  dueIds(now = Date.now()) { return Object.entries(this.current.items).filter(([, it]) => (it.learned || it.seen > 0) && it.due && it.due <= now).map(([id]) => id); }

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
  updateCustomWord(id, patch) { if (this.current.custom[id]) { Object.assign(this.current.custom[id], patch); this.save(); } }
  removeCustomWord(id) { delete this.current.custom[id]; for (const l of Object.values(this.current.lists)) l.items = l.items.filter(x => x !== id); delete this.current.items[id]; this.save(); }

  // ---------- stats ----------
  _day() { const k = todayKey(); return (this.current.stats.days[k] ||= { new: 0, reviews: 0, correct: 0, wrong: 0, xp: 0, games: 0, time: 0 }); }
  touchDay() {
    const st = this.current.stats; const today = todayKey();
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
  async importJSON(text, { merge = false } = {}) {
    const obj = JSON.parse(text);
    const p = obj.profile || obj;
    if (!p || !p.items || !p.lists) throw new Error('Not a valid backup file');
    if (merge) {
      const cur = this.current;
      for (const [id, it] of Object.entries(p.items)) { const c = cur.items[id]; if (!c || (it.last || 0) > (c.last || 0)) cur.items[id] = it; }
      for (const [id, l] of Object.entries(p.lists)) { if (!cur.lists[id]) cur.lists[id] = l; else cur.lists[id].items = [...new Set([...cur.lists[id].items, ...l.items])]; }
      Object.assign(cur.custom, p.custom || {});
      cur.stats.xp = Math.max(cur.stats.xp, p.stats?.xp || 0);
      for (const [d, v] of Object.entries(p.stats?.days || {})) if (!cur.stats.days[d]) cur.stats.days[d] = v;
    } else {
      p.id = this.current.id; // keep current slot
      this.current = p;
      const fresh = newProfile(p.name, p.avatar);
      p.settings = { ...fresh.settings, ...(p.settings || {}) };
      p.stats = { ...fresh.stats, ...(p.stats || {}) }; p.scope = { ...fresh.scope, ...(p.scope || {}) }; p.recent ||= [];
      const meta = this.profiles.find(x => x.id === p.id); if (meta) { meta.name = p.name; meta.avatar = p.avatar; this._persistIndex(); }
    }
    this._dirty = true;
    await this.saveNow();
    this.emit('profile', this.current); this.emit('change');
  }
  async resetProgress() {
    const p = this.current;
    p.items = {}; p.stats = newProfile(p.name).stats; p.recent = [];
    this._dirty = true; await this.saveNow(); this.emit('change');
  }
}

export const store = new Store();
