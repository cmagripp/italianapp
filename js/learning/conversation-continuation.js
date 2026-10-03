// A read-only bridge from durable conversations to the shared daily plan.
// Cache only navigation metadata; transcripts remain in their own repository.
const cached=new WeakMap(),loads=new WeakMap();
const identity=store=>JSON.stringify([store.current.id,store.current.learnerId,store.learning.epoch.id]);
export function conversationContinuation(store){
  const value=cached.get(store);
  return value?.owner===identity(store)?value.activity:null;
}
export async function loadConversationContinuation(store,{repositoryFactory,databases}={}){
  const owner=identity(store),lease={owner};loads.set(store,lease);cached.delete(store);
  const current=()=>loads.get(store)===lease&&identity(store)===owner;
  let repository;
  try{
    // A new learner need not load conversation storage or create its database.
    const inventory=databases || (globalThis.indexedDB?.databases?()=>globalThis.indexedDB.databases():null);
    if(inventory && !(await inventory()).some(db=>db.name==='parola-conversations'))return null;
    if(!current())return null;
    const factory=repositoryFactory || (await import('../conversations/storage.js')).createConversationRepository;
    if(!current())return null;
    repository=factory({profileId:store.current.id,learnerId:store.current.learnerId,isCurrent:current});
    for(const thread of await repository.list()){
      if(!current())return null;
      if(thread.archived||thread.deletedAt)continue;
      const state=await repository.read(thread.threadId);
      if(!current())return null;
      if(state.thread.archived||state.thread.deletedAt)continue;
      const draft=state.draft?.typedText?.trim();
      if(!state.turns.length&&!draft&&!state.thread.pending)continue;
      const activity={id:`continue:conversation:${thread.threadId}`,kind:'continue',activity:'conversation',threadId:thread.threadId,
        href:`#/conversations/${encodeURIComponent(thread.threadId)}`,label:`Continue ${state.thread.title || 'your conversation'}`,
        reason:draft?'Your unsent message is saved.':'Return to your saved conversation.',estimatedMinutes:3,
        updatedAt:Math.max(Number(state.thread.updatedAt)||0,Number(state.draft?.updatedAt)||0)};
      cached.set(store,{owner,activity});return activity;
    }
  }catch{
    // A storage failure must not prevent lessons from opening. The conversation
    // player retains its own recovery/error surface; no records are rewritten.
  }finally{repository?.close();}
  return null;
}
