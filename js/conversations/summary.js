// A conversation's study index is rebuilt from its exact messages and local
// reference records. It neither asks a model for definitions nor awards credit.
import {tokenizeItalianSentence} from '../learning/sentence-lookup.js';
import {preservesProtectedMeaning} from '../ai/validation.js';
const CASES={presente:'present',presenteProgressivo:'present',passatoProssimo:'past',imperfetto:'background',imperfettoProgressivo:'background',futuro:'future',condizionale:'condizionale'};
const STUDY_POS=new Set(['noun','verb','adj','adv','expr','interj']);
const refKey=ref=>JSON.stringify([ref.turnId,ref.revision,ref.start,ref.end]);
const sourceRef=(turn,token)=>({turnId:turn.turnId,revision:turn.revision,start:token.start,end:token.end,quote:token.text});
const entryId=(candidate,resolveEntry)=>resolveEntry(candidate.id)?candidate.id:candidate.id.endsWith(':feminine')&&resolveEntry(candidate.id.slice(0,-9))?candidate.id.slice(0,-9):null;
function formCases(candidate){
 const matches=candidate.matches||[],contextual=matches.filter(m=>m.contextMatched),choices=contextual.length?contextual:matches;
 return [...new Set(choices.map(m=>CASES[m.tense]).filter(Boolean))];
}
function summaryWord(candidate,id){
 const cases=formCases(candidate);
 return {entryId:id,senseId:candidate.senseId||null,word:candidate.word,label:candidate.label,meaning:candidate.meaning,pos:candidate.pos,
  ...(candidate.pos==='noun'?{gender:candidate.gender,singular:candidate.singular,plural:candidate.plural,numberNote:candidate.numberNote}:{}),
  ...(candidate.pos==='verb'?{caseId:cases.length===1?cases[0]:null,possibleCases:cases,matches:candidate.matches||[]}:{}),
  referenceSource:candidate.source,completionAwarded:false};
}
export function buildConversationSummary({thread,turns,previous=null},{lookup,resolveEntry,resolveRule=()=>null}={}){
 if(typeof lookup!=='function'||typeof resolveEntry!=='function')throw new TypeError('Conversation notes require the local dictionary');
 const items=new Map(),byId=new Map(turns.map(t=>[t.turnId,t]));
 const add=(key,value,ref)=>{
  if(!items.has(key))items.set(key,{id:key,...value,sourceRefs:[]});
  const item=items.get(key);if(!item.sourceRefs.some(r=>refKey(r)===refKey(ref)))item.sourceRefs.push(ref);
 };
 for(const turn of turns){
  if(!['learner','partner'].includes(turn.role))continue;
  const sentence=turn.displayText;
  for(const token of tokenizeItalianSentence(sentence).filter(t=>t.type==='word')){
   const result=lookup(token.text,{sentence});
   const readings=result.candidates.filter(c=>STUDY_POS.has(c.pos)&&entryId(c,resolveEntry)&&!resolveEntry(entryId(c,resolveEntry)).legacyGrouping);
   const candidates=[...new Map(readings.map(c=>[entryId(c,resolveEntry),c])).values()];
   if(!candidates.length)continue;
   const selected=turn.sourceContext?.lexicalChoices?.find(choice=>choice.revision===turn.revision&&choice.start===token.start&&choice.end===token.end);
   const chosen=candidates.find(c=>entryId(c,resolveEntry)===selected?.entryId&&(selected.senseId==null||c.senseId===selected.senseId));
   const candidate=chosen||(candidates.length===1?candidates[0]:null),ref=sourceRef(turn,token);
   if(candidate){
    const word=summaryWord(candidate,entryId(candidate,resolveEntry)),key=`word:${word.entryId}:${word.caseId||''}`;
    add(key,{kind:'vocabulary',...word,meaningSelection:chosen?'learner-choice':'single-dictionary-reading'},ref);
   }else{
    // Ranking a homograph is not sense disambiguation. The learner can open
    // every reading, but this item has no automatic Learn/completion target.
    const key=`meaning:${turn.turnId}:${turn.revision}:${token.start}`;
    add(key,{kind:'meaning-choice',word:token.text,candidates:candidates.map(c=>summaryWord(c,entryId(c,resolveEntry))),completionAwarded:false},ref);
   }
  }
  for(const correction of turn.correctionRefs||[]){
   const source=byId.get(correction.sourceTurnId),rule=resolveRule(correction.ruleId);
   if(!source||source.revision!==correction.sourceTurnRevision||source.role!=='learner'||source.inputProvenance?.recognitionUncertain||!rule?.verified||typeof rule.confirmCorrection!=='function'||typeof rule.source!=='string'||!rule.source.trim()||typeof rule.explanation!=='string'||!rule.explanation.trim())continue;
   if(typeof correction.original!=='string'||!correction.original||!source.displayText.includes(correction.original)||rule.confirmCorrection(correction,{text:source.displayText,recognitionUncertain:false,agreement:thread.setup.agreement})!==true)continue;
   const names=[thread.setup.name,...(thread.setup.participants||[]).map(p=>p.name),...(source.sourceContext?.protectedNames||[])].filter(Boolean);
   if(!preservesProtectedMeaning(correction.original,correction.replacement,names))continue;
   const start=source.displayText.indexOf(correction.original),ref=sourceRef(source,{start,end:start+correction.original.length,text:correction.original});
   add(`correction:${source.turnId}:${source.revision}:${rule.id}:${start}`,{kind:'correction',ruleId:rule.id,original:correction.original,replacement:correction.replacement,explanation:rule.explanation,reference:rule.source,completionAwarded:false},ref);
  }
 }
 // Learner-authored notes stay recoverable after an edit, visibly invalidated.
 // Generated notes never survive merely because an earlier model asserted them.
 for(const note of previous?.items||[])if(note.kind==='note'&&note.author==='learner'&&typeof note.text==='string'&&note.sourceRefs?.length){
  const invalidated=note.sourceRefs.some(ref=>!byId.has(ref.turnId)||byId.get(ref.turnId).revision!==ref.revision);
  items.set(`note:${note.id}`,{...structuredClone(note),invalidated});
 }
 // Study UI is replayable only for this exact owner/thread/source revision.
 // The study module regenerates canonical questions and compares its full
 // fingerprint before restoring answers; preserving UI never emits evidence.
 const study=previous?.studyState,refs=study?.sourceRefs;
 const keepStudy=study?.policyVersion===1&&study.sourceRevision===thread.contentRevision&&study.threadId===thread.threadId&&
  typeof study.fingerprint==='string'&&study.fingerprint.length<=200000&&
  thread.ownerId===JSON.stringify([study.owner?.profileId,study.owner?.learnerId])&&
  Array.isArray(refs)&&refs.length>0&&refs.length<=16&&refs.every(ref=>{
   const source=byId.get(ref.turnId);
   return source?.revision===ref.revision&&Number.isSafeInteger(ref.start)&&Number.isSafeInteger(ref.end)&&ref.start>=0&&ref.end>ref.start&&source.displayText.slice(ref.start,ref.end)===ref.quote;
  });
 return {policyVersion:1,throughTurnRevision:thread.contentRevision,generatedAt:Date.now(),items:[...items.values()],masteryAwarded:false,
  ...(keepStudy?{studyState:structuredClone(study)}:{})};
}
