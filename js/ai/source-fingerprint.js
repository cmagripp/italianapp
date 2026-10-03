// Object key ordering is serialization, not source identity. Arrays retain
// order because scene pools, answers and selected activity slots depend on it.
export function sourceFingerprint(value){
 const ordered=item=>Array.isArray(item)?item.map(ordered):item&&typeof item==='object'
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,ordered(item[key])])):item;
 return JSON.stringify(ordered(value));
}
