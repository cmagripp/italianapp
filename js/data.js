// Data loading, indexes, search and lexical helpers (articles, plurals, categories, levels).
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const LEVEL_INFO = {
  A1: { name: 'Beginner', it: 'Principiante', desc: 'Survival words: greetings, family, food, numbers, time.', color: '#2e9e5b' },
  A2: { name: 'Elementary', it: 'Elementare', desc: 'Everyday life: shopping, travel, health, home, feelings.', color: '#4fa3d9' },
  B1: { name: 'Intermediate', it: 'Intermedio', desc: 'Experiences, opinions, work, services, nature.', color: '#e0a325' },
  B2: { name: 'Upper-intermediate', it: 'Intermedio superiore', desc: 'Argument and nuance: society, science, culture.', color: '#e0662f' },
  C1: { name: 'Advanced', it: 'Avanzato', desc: 'Precision and register: formal, technical, literary.', color: '#b04ec7' },
  C2: { name: 'Mastery', it: 'Padronanza', desc: 'Native-level range: rare, learned and literary words.', color: '#c8102e' },
};
export const CATS = {
  basics: { name: 'Basics & greetings', icon: '👋' }, people: { name: 'People & family', icon: '👨‍👩‍👧' }, body: { name: 'Body & health', icon: '🫀' },
  emotions: { name: 'Emotions & character', icon: '💛' }, food: { name: 'Food & drink', icon: '🍝' }, home: { name: 'Home', icon: '🏠' },
  clothing: { name: 'Clothing & fashion', icon: '👗' }, daily: { name: 'Daily life', icon: '☀️' }, shopping: { name: 'Shopping & money', icon: '🛍️' },
  city: { name: 'City & places', icon: '🏙️' }, travel: { name: 'Travel & transport', icon: '✈️' }, nature: { name: 'Nature & weather', icon: '🌿' },
  animals: { name: 'Animals & plants', icon: '🐈' }, time: { name: 'Time & calendar', icon: '⏰' }, numbers: { name: 'Numbers & quantity', icon: '🔢' },
  colors: { name: 'Colours & shapes', icon: '🎨' }, work: { name: 'Work & professions', icon: '💼' }, school: { name: 'School & learning', icon: '🎓' },
  tech: { name: 'Technology & media', icon: '📱' }, arts: { name: 'Arts & culture', icon: '🎭' }, sports: { name: 'Sports & leisure', icon: '⚽' },
  society: { name: 'Society, politics & law', icon: '🏛️' }, economy: { name: 'Economy & business', icon: '📈' }, science: { name: 'Science', icon: '🔬' },
  abstract: { name: 'Ideas & abstract', icon: '💭' }, communication: { name: 'Communication & function words', icon: '💬' },
  description: { name: 'Describing things', icon: '✨' }, expressions: { name: 'Expressions & idioms', icon: '🗣️' },
};
export const POS_NAME = { noun: 'noun', adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', pron: 'pronoun', num: 'number', det: 'determiner', interj: 'interjection', expr: 'expression', verb: 'verb' };
export const GENDER_NAME = { m: 'masculine', f: 'feminine', mf: 'masc./fem.' };

export const data = { vocab: [], verbs: [], byId: new Map(), loaded: false, stats: null };

// A failed response (500 from the host, a captive-portal page) is reported by status instead of as a JSON parse error.
const getJSON = (url) => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} loading ${url}`); return r.json(); });
export async function loadData(base = '') {
  const [v, vb, st] = await Promise.all([
    getJSON(base + 'data/vocab.json'),
    getJSON(base + 'data/verbs.json'),
    getJSON(base + 'data/stats.json').catch(() => null),
  ]);
  data.vocab = v; data.verbs = vb; data.stats = st;
  data.byId = new Map();
  for (const e of v) { e.kind = 'word'; data.byId.set(e.id, e); }
  for (const e of vb) { e.kind = 'verb'; e.it = e.inf; data.byId.set(e.id, e); }
  data.loaded = true;
  searchIndex = null;
  return data;
}

// custom words are registered by the app after the profile loads
export function registerCustom(customMap) {
  for (const id of [...data.byId.keys()]) if (id.startsWith('c:')) data.byId.delete(id);
  for (const e of Object.values(customMap || {})) { e.kind = e.pos === 'verb' ? 'verb' : 'word'; if (e.kind === 'verb') e.inf = e.it; data.byId.set(e.id, e); }
  searchIndex = null;
}

export const getEntry = (id) => data.byId.get(id) || null;
export const isVerb = (e) => !!e && e.kind === 'verb';

// ---------- text helpers ----------
export const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'");

// Built lazily on the first search (folding 8,000+ entries is not paid on the boot path) and dropped whenever the
// entries change (loadData, registerCustom); null = stale.
let searchIndex = null;
function buildSearchIndex() {
  searchIndex = [];
  for (const e of data.byId.values()) {
    const it = fold(e.it), en = fold(e.en);
    // inflected forms a learner meets in texts and on the cards: the plural, the feminine, the four adjective forms
    const forms = new Set();
    if (e.pl && !/^[-—]$/.test(e.pl)) forms.add(fold(e.pl));
    if (e.fem) forms.add(fold(e.fem));
    for (const f of e.forms || []) if (f) forms.add(fold(f));
    forms.delete(it);
    searchIndex.push({ e, it, en, forms: [...forms], enParts: en.split(/;|,/).map(x => x.trim().replace(/^to /, '').replace(/^(the|a|an) /, '')) });
  }
}

export function search(query, { limit = 40, kind = null } = {}) {
  const q = fold(query).trim();
  if (!q) return [];
  if (!searchIndex) buildSearchIndex();
  // the indexed English parts are stored without "to" / "the" / "a", so the query loses them too; "to …" asks for a verb
  const qNoTo = q.replace(/^to /, '').replace(/^(the|a|an) /, '');
  const wantVerb = /^to /.test(q);
  // headwords are shown with their article ("la casa", "l'acqua", "gli uomini"), so the query is also tried without it
  const qNoArt = q.replace(/^(il|lo|la|i|gli|le|un|uno|una) |^(l|un)'/, '');
  const qs = qNoArt && qNoArt !== q ? [q, qNoArt] : [q];
  const results = [];
  for (const r of searchIndex) {
    if (kind && r.e.kind !== kind) continue;
    let score = 0, m;
    if (r.it === q) score = 100;
    else if (r.enParts.some(p => p === q || p === qNoTo)) score = wantVerb && r.e.kind === 'verb' ? 98 : 95;
    else if (qs.length > 1 && r.it === qs[1]) score = 97; // "il quale" is the pronoun itself before "quale"
    else if (qs.some(x => r.forms.includes(x))) score = 90;
    else if ((m = qs.find(x => r.it.startsWith(x)))) score = 80 - Math.min(20, r.it.length - m.length);
    else if (r.enParts.some(p => p.startsWith(qNoTo))) score = 70;
    else if (qs.some(x => r.it.includes(x))) score = qs.some(x => r.it.split(' ').includes(x)) ? 60 : 50; // a whole word of a phrase (a casa) above a fragment (casamatta)
    else if (r.en.includes(qNoTo)) score = 40;
    if (score) results.push({ e: r.e, score: score - LEVELS.indexOf(r.e.level) * 0.5 });
  }
  results.sort((a, b) => b.score - a.score || a.e.it.length - b.e.it.length);
  return results.slice(0, limit).map(r => r.e);
}

// ---------- articles ----------
function startsLo(w) {
  const s = fold(w);
  return /^(s[bcdfghjklmnpqrstvwxz]|z|gn|ps|pn|x|y|i[aeiou])/.test(s); // loanwords in j- sound /dʒ/ and take il: il jazz, i jeans
}
function startsVowel(w) { return /^h?[aeiouàèéìíîòóùú]/.test(fold(w)); } // a leading h is silent: l'hotel, gli hobby

export function article(entry, plural = false) {
  if (!entry || entry.pos !== 'noun') return '';
  const w = plural ? entry.pl : entry.it;
  if (!w || w === '-') return '';
  const g = entry.g;
  if (g === 'mf') {
    // -ista / -a nouns: the listed -i plural is the masculine one (the feminine is -e), so only the masculine article fits
    if (plural && /a$/.test(fold(entry.it)) && /i$/.test(fold(w))) return (startsLo(w) || startsVowel(w)) ? 'gli' : 'i';
    return plural ? (startsLo(w) || startsVowel(w) ? 'gli/le' : 'i/le') : (startsVowel(w) ? "l'" : (startsLo(w) ? 'lo/la' : 'il/la'));
  }
  if (g === 'f') return plural ? 'le' : (startsVowel(w) ? "l'" : 'la');
  // uovo → le uova, braccio → le braccia; the same gender switch with a plural not in -a: le orecchie, le carceri, le greggi
  if (plural && ((/o$/.test(fold(entry.it)) && /a$/.test(fold(w))) || /^(orecchio|carcere|gregge)$/.test(fold(entry.it)))) return 'le';
  if (plural && fold(entry.it) === 'dio') return 'gli'; // the one plural that takes gli before a consonant: gli dei
  if (plural) return (startsLo(w) || startsVowel(w)) ? 'gli' : 'i';
  return startsVowel(w) ? "l'" : (startsLo(w) ? 'lo' : 'il');
}
export const withArticle = (entry, plural = false) => {
  const a = article(entry, plural); const w = plural ? entry.pl : entry.it;
  if (!a) return w; return a.endsWith("'") ? a + w : a + ' ' + w;
};
// A noun stored in its plural form (occhiali, affari, media): the note says so in one of the usual phrasings, and an
// invariable singular (serie, crisi, caricabatterie) is never one, whatever else its note says about plurals.
const PLURAL_ONLY_RE = /(plural[- ]only|solo (al )?plurale|plurale tantum|plural noun|only in the plural|always plural|plurale|^plural\b|(usually|normally|mostly|often|generally|almost only|almost always|only|literary|feminine|masculine|the) plural|plural (of|form|feminine|masculine|in\b)|used in the plural|in the plural)/i;
export function isPluralOnly(e) {
  if (e.pos !== 'noun' || e.pl !== e.it) return false;
  const note = e.note || '';
  if (!PLURAL_ONLY_RE.test(note) || /invariab/i.test(note)) return false;
  // the head noun must look plural (lenti a contatto, generalità); a loanword (jeans, social) only when the note opens by saying so
  return /[iea]$/.test(fold(e.it).split(' ')[0]) || /^(plural[- ]only|always plural|usually plural)/i.test(note);
}
export function isUncountable(e) { return e.pos === 'noun' && (e.pl === '-' || e.pl === '—'); }

// Display headword: nouns with article, verbs as infinitive
export function headword(e) {
  if (!e) return '';
  if (e.kind === 'verb') return e.inf;
  if (e.pos === 'noun') { if (isPluralOnly(e)) return withArticle(e, true); return withArticle(e, false); }
  return e.it;
}

export function levelIndex(l) { return LEVELS.indexOf(l); }

// ---------- scope resolution ----------
// scope: { mode: 'level'|'lists'|'learned'|'all', levels:[], cats:[], lists:[] }
export function itemsForScope(scope, store, { kind = null } = {}) {
  let ids = [];
  const custom = Object.keys(store.current.custom || {});
  if (scope.mode === 'lists') {
    const set = new Set();
    for (const lid of scope.lists || []) for (const id of (store.lists[lid]?.items || [])) set.add(id);
    ids = [...set];
  } else if (scope.mode === 'learned') {
    ids = store.learnedIds();
  } else if (scope.mode === 'all') {
    ids = [...data.vocab.map(e => e.id), ...data.verbs.map(e => e.id), ...custom];
  } else { // level
    const lv = new Set(scope.levels && scope.levels.length ? scope.levels : ['A1']);
    const cats = new Set(scope.cats || []);
    const ok = (e) => lv.has(e.level) && (!cats.size || cats.has(e.cat));
    ids = [...data.vocab.filter(ok).map(e => e.id), ...data.verbs.filter(ok).map(e => e.id), ...custom.filter(id => { const e = store.current.custom[id]; return lv.has(e.level || 'A1') && (!cats.size || cats.has(e.cat)); })];
  }
  let entries = ids.map(getEntry).filter(Boolean);
  if (kind) entries = entries.filter(e => e.kind === kind);
  return entries;
}

export function describeScope(scope, store) {
  if (scope.mode === 'lists') { const names = (scope.lists || []).map(id => store.lists[id]?.name).filter(Boolean); return names.length ? names.join(', ') : 'No lists selected'; }
  if (scope.mode === 'learned') return 'Everything I have learned';
  if (scope.mode === 'all') return 'All words & verbs';
  const lv = (scope.levels || []).join(', ') || 'A1';
  const cats = (scope.cats || []).map(c => CATS[c]?.name).filter(Boolean);
  return `Level ${lv}${cats.length ? ' · ' + cats.join(', ') : ''}`;
}

// ---------- misc ----------
export function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function pickN(arr, n) { return shuffle(arr).slice(0, n); }
export function sample(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
// deterministic daily pick
export function dailyPick(arr, salt = 0) {
  if (!arr.length) return null;
  const d = new Date(); const seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate() + salt * 7919;
  return arr[seed % arr.length];
}
export function shortEn(en) { return String(en || '').split(';')[0].trim(); }
export function enChoices(e) { return String(e.en || '').split(';').map(s => s.trim()).filter(Boolean); }

// Words that form good distractors: same pos (and gender for nouns) and similar level
export function distractors(target, pool, n, { sameKind = true } = {}) {
  let cands = pool.filter(e => e.id !== target.id && (!sameKind || e.kind === target.kind) && fold(shortEn(e.en)) !== fold(shortEn(target.en)) && e.it !== target.it);
  if (target.kind === 'word') {
    const same = cands.filter(e => e.pos === target.pos);
    if (same.length >= n) cands = same;
  }
  const near = cands.filter(e => Math.abs(levelIndex(e.level) - levelIndex(target.level)) <= 1);
  if (near.length >= n) cands = near;
  const out = pickN(cands, n);
  if (out.length < n) {
    const all = [...data.vocab, ...data.verbs].filter(e => e.id !== target.id && (!sameKind || e.kind === target.kind) && (target.kind !== 'word' || e.pos === target.pos));
    for (const e of shuffle(all)) { if (out.length >= n) break; if (!out.includes(e) && fold(shortEn(e.en)) !== fold(shortEn(target.en))) out.push(e); }
  }
  return out;
}
