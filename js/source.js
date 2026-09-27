// Resolves a "source" spec (what to study / play with) into a list of entries.
import { store } from './store.js';
import { data, getEntry, itemsForScope, describeScope, LEVELS, CATS, LEVEL_INFO } from './data.js';

// specs: scope | learned | learned-verbs | learned-words | due | bank | list:<id> | level:<L>[:<cat>] | cat:<c> | recent | all | ids:<id,id,...>
export function resolveSource(spec = 'scope') {
  const [kind, a, b] = String(spec).split(':');
  const custom = Object.keys(store.current.custom || {});
  switch (kind) {
    case 'learned': return store.learnedIds().map(getEntry).filter(Boolean);
    case 'learned-verbs': return store.learnedIds('v:').map(getEntry).filter(Boolean);
    case 'learned-words': return store.learnedIds().filter(id => !id.startsWith('v:')).map(getEntry).filter(Boolean);
    case 'due': return store.dueIds().map(getEntry).filter(Boolean);
    case 'bank': return (store.lists.bank?.items || []).map(getEntry).filter(Boolean);
    case 'list': return (store.lists[a]?.items || []).map(getEntry).filter(Boolean);
    case 'level': return [...data.vocab, ...data.verbs, ...custom.map(getEntry)].filter(e => e && e.level === a && (!b || e.cat === b));
    case 'cat': return [...data.vocab, ...data.verbs].filter(e => e.cat === a);
    case 'recent': return (store.current.recent || []).map(getEntry).filter(Boolean);
    case 'all': return [...data.vocab, ...data.verbs, ...custom.map(getEntry).filter(Boolean)];
    case 'ids': return decodeURIComponent(a || '').split(',').map(getEntry).filter(Boolean);
    case 'scope':
    default: return itemsForScope(store.scope, store);
  }
}

export function sourceLabel(spec = 'scope') {
  const [kind, a, b] = String(spec).split(':');
  switch (kind) {
    case 'learned': return 'Everything I have learned';
    case 'learned-verbs': return 'My learned verbs';
    case 'learned-words': return 'My learned words';
    case 'due': return 'Due for review';
    case 'bank': return 'My word bank';
    case 'list': return store.lists[a]?.name || 'List';
    case 'level': return `Level ${a}${b ? ' · ' + (CATS[b]?.name || b) : ''}`;
    case 'cat': return CATS[a]?.name || a;
    case 'recent': return 'Recently viewed';
    case 'all': return 'All words & verbs';
    case 'ids': return 'Selected items';
    default: return describeScope(store.scope, store);
  }
}

// Options for the picker
export function sourceChoices() {
  const learnedV = store.learnedIds('v:').length, learnedW = store.learnedIds().length - learnedV, due = store.dueIds().length;
  const out = [
    { spec: 'scope', label: 'Current study scope', sub: describeScope(store.scope, store), count: itemsForScope(store.scope, store).length },
    { spec: 'due', label: 'Due for review', sub: 'Spaced-repetition queue', count: due },
    { spec: 'learned', label: 'Everything I have learned', sub: 'Words and verbs marked learned', count: learnedW + learnedV },
    { spec: 'learned-verbs', label: 'My learned verbs', sub: 'Verbs whose introduction you completed', count: learnedV },
    { spec: 'learned-words', label: 'My learned words', sub: 'Vocabulary you completed', count: learnedW },
    { spec: 'bank', label: 'My word bank', sub: 'Saved words', count: store.lists.bank?.items.length || 0 },
  ];
  for (const l of Object.values(store.lists)) if (l.id !== 'bank') out.push({ spec: 'list:' + l.id, label: l.name, sub: 'Custom list', count: l.items.length });
  for (const L of LEVELS) out.push({ spec: 'level:' + L, label: `Level ${L} · ${LEVEL_INFO[L].name}`, sub: 'All words and verbs at this level', count: data.vocab.filter(e => e.level === L).length + data.verbs.filter(e => e.level === L).length });
  out.push({ spec: 'recent', label: 'Recently viewed', sub: 'Last 30 entries you opened', count: (store.current.recent || []).length });
  return out;
}
