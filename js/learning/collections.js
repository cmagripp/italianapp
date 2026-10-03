// The same Starred list is used by cards, dictionary entries and study summaries.
// Older profiles may have more than one such list; preserve them and remove a
// starred item from all of them when the learner explicitly unstars it.
export const starredLists = store => Object.values(store.lists || {})
  .filter(list => list && String(list.name || '').trim().toLocaleLowerCase() === 'starred')
  .sort((a,b) => (a.created || 0) - (b.created || 0) || a.id.localeCompare(b.id));
export const isStarred = (store,id) => starredLists(store).some(list => store.inList(list.id,id));
export function toggleStarred(store,id) {
  const lists=starredLists(store), on=lists.some(list=>store.inList(list.id,id));
  if(on) for(const list of lists) store.removeFromList(list.id,id);
  else store.addToList(lists[0]?.id || store.createList('Starred'),id);
  void store.saveNow().catch(()=>{}); // The persistent storage banner owns retry/export.
  return !on;
}
