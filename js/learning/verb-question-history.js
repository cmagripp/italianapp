import {VERB_QUESTION_HISTORY_DATA} from './verb-question-history-data.js';
export const hasVerbQuestionHistory=entryId=>Object.hasOwn(VERB_QUESTION_HISTORY_DATA,entryId);
// Source records are trusted local data; imported snapshots cannot add recipes.
// Shared context references keep the preserved pools compact and exact.
export function verbQuestionHistory(entryId){
 const source=VERB_QUESTION_HISTORY_DATA[entryId];if(!source)return null;
 const {contextPool,...record}=structuredClone(source);
 for(const chapter of [...record.chapters,...record.ordinaryChapters])for(const group of chapter.groups)for(const target of group.targets)
  for(const field of ['contexts','legacyAuthoredContexts','legacyExpandedContexts'])if(Object.hasOwn(target,field+'Refs')){
   target[field]=target[field+'Refs'].map(index=>structuredClone(contextPool[index]));delete target[field+'Refs'];
  }
 return record;
}
