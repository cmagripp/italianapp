// The "Parole utili" deck: data/useful-words.json, a hand-curated set of function words (question words, connectors,
// indefinites, object and reflexive pronouns, time and place, quantity), each pointing at a dictionary entry by id.
// Fetched once on demand and cached; the groups resolve against the loaded dictionary (js/data.js), so an id that no
// longer exists is skipped rather than shown as an empty row. tools/test-useful-words.mjs checks the file itself.
//
//   loadUsefulWords() → Promise<set>   set = { version, groups: [{ id, title, it, entries: [{ entryId, note }] }] }
//   usefulWords()     → set | null     the cached set (null until the first load resolved)
//   usefulGroups(set) → [{ id, title, it, items: [{ entry, note }] }]   dictionary entries in file order
//   usefulIds(set)    → [id]           every resolvable id, in deck order, each once
//   idsSource(ids)    → 'ids:…'        the games' id-list source spec (js/source.js), URL-encoded
//   matchingHref(ids) → '#/games?pick=matching&src=ids:…'   the Matching game's deep link on those ids
//   usefulDeckCard(set) → a learn card (js/views/learnCards.js) for the deck; its detail line carries the counts once loaded
import { getEntry } from './data.js';

export const USEFUL_LIST = 'useful';
export const USEFUL_HREF = `#/browse?list=${USEFUL_LIST}`;
export const USEFUL_TITLE = 'Parole utili';
export const USEFUL_EN = 'Useful words';

let pending = null, cached = null;

function normalise(raw) {
  const groups = Array.isArray(raw?.groups) ? raw.groups : [];
  return {
    version: Number(raw?.version) || 0,
    groups: groups.filter(g => g && typeof g === 'object').map(g => ({
      id: String(g.id ?? ''), title: String(g.title ?? ''), it: String(g.it ?? ''),
      entries: (Array.isArray(g.entries) ? g.entries : []).filter(e => e && typeof e.entryId === 'string').map(e => ({ entryId: e.entryId, note: typeof e.note === 'string' ? e.note : '' })),
    })),
  };
}

export function loadUsefulWords(base = '') {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch(`${base}data/useful-words.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} loading useful-words.json`); return r.json(); })
      .then(raw => { cached = normalise(raw); return cached; })
      .catch(err => { pending = null; throw err; }); // a failed fetch (offline before the first load) is retried on the next call
  }
  return pending;
}
export const usefulWords = () => cached;

export function usefulGroups(set = cached) {
  if (!set) return [];
  return set.groups.map(g => ({ id: g.id, title: g.title, it: g.it, items: g.entries.map(e => ({ entry: getEntry(e.entryId), note: e.note })).filter(x => x.entry) }));
}
export function usefulIds(set = cached) {
  const seen = new Set();
  return usefulGroups(set).flatMap(g => g.items.map(x => x.entry.id)).filter(id => !seen.has(id) && seen.add(id));
}
export const idsSource = (ids) => 'ids:' + encodeURIComponent(ids.join(','));
export const matchingHref = (ids) => `#/games?pick=matching&src=${idsSource(ids)}`;

export function usefulDeckCard(set = cached) {
  const n = set ? usefulIds(set).length : 0, g = set ? set.groups.length : 0;
  return { key: 'deck:useful', kicker: 'Deck', title: USEFUL_TITLE, en: USEFUL_EN, detail: n ? `${n} words · ${g} groups` : 'Questions, links, pronouns', icon: 'sparkle', accent: 'var(--amalfi)', href: USEFUL_HREF, deck: USEFUL_LIST };
}
