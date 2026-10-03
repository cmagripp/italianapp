import {getEntry} from '../data.js';
import {buildLesson} from './lesson-content.js';
import {buildJourneyQuestion} from './lesson-questions.js';
import {journeySceneMatches,retiredJourneyScene} from './journey-scene.js';
import {journeyFormMatches,retiredJourneyForm} from './journey-form.js';
import {sourceFingerprint} from '../ai/source-fingerprint.js';
import {createAuthoredPracticeResolver} from './practice-authored-sources.js';
export {createCoursePracticeBinding,createGrammarPracticeBinding,createWorkshopPracticeBinding} from './practice-authored-sources.js';

export const PRACTICE_SOURCE_VERSION='canonical-practice-sources-v1';
const copy=value=>structuredClone(value),same=(a,b)=>sourceFingerprint(a)===sourceFingerprint(b);
export const practicePromptText=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity])).replace(/\s+/g,' ').trim();
const questionSource=question=>({prompt:question.prompt,answer:question.answer,context:question.context||null,contextId:question.meta?.contextId||null,variantId:question.meta?.variantId||null,type:question.type});
const bindingKeys=new Set(['version','kind','sourceId','entryId','contentVersion','chapterId','targetId','questionId','variant','phase','format','repairTag','scenePolicy','sceneRevision','sceneSnapshot','formSnapshot','questionRevision','question','wordSlotId']);
export function createJourneyPracticeBinding({entry,plan,step,question,sessionId}){
 if(step?.type!=='question'||step.awaitingContinue||!question)return null;
 return {version:1,kind:'journey',sourceId:`journey:${sessionId}:${step.questionId}`,entryId:entry.id,contentVersion:plan.version,chapterId:step.chapter.id,targetId:step.target.id,questionId:step.questionId,
  variant:step.variant,phase:step.phase,format:step.format,repairTag:step.repairTag||null,scenePolicy:step.scenePolicy||null,sceneRevision:step.sceneRevision??step.sceneSnapshot?.sourceRevision??null,sceneSnapshot:copy(step.sceneSnapshot||null),
  ...step.formSnapshot!==undefined?{formSnapshot:copy(step.formSnapshot)}:{},...step.questionRevision!==undefined?{questionRevision:step.questionRevision}:{},wordSlotId:step.target.shortWord?step.target.wordSlotId:null,question:copy(questionSource(question))};
}
function exactReviewedSense(entry){
 const sense=entry.sense,provenance=sense?.provenance;
 if(!entry.parentEntryId||entry.senseId!==sense?.senseId||!['independent-agent-review','independent-agent-review-passed'].includes(provenance?.reviewStatus)||!provenance.sources?.length||!sense.contentVersion)return null;
 return {id:entry.senseId,verified:true,level:sense.level,lemma:entry.it,definition:sense.glosses.join('; '),forms:[entry.it,...entry.pl?[entry.pl]:[]],examples:entry.ex?[{it:entry.ex,en:entry.exEn||''}]:[],source:provenance.sources[0],sourceRevision:sense.contentVersion,reviewStatus:provenance.reviewStatus};
}

// Rule links are optional and must come from a trusted, reviewed registry.
// Topic/target/context IDs and authored examples are never promoted to rules.
export function createPracticeSourceResolver({lookupEntry=getEntry,lessonFor=buildLesson,questionFor=buildJourneyQuestion,resolveRuleLinks=()=>[],...authoredOptions}={}){
 const authored=createAuthoredPracticeResolver(authoredOptions);
 return {version:PRACTICE_SOURCE_VERSION,resolve(binding,context){
  if(binding?.kind!=='journey'){
   const source=authored.resolve(binding,context);if(!source)return null;
   source.senses=(source.senseEntryIds||[]).map(lookupEntry).filter(Boolean).map(exactReviewedSense).filter(Boolean);
   source.rules=resolveRuleLinks({binding,source})||[];return source;
  }
  if(binding?.version!==1||Object.keys(binding).some(key=>!bindingKeys.has(key))||binding.kind!=='journey'||typeof binding.sourceId!=='string'||binding.sourceId.length>200||typeof binding.questionId!=='string'||!binding.questionId||binding.questionId.length>200||!Number.isSafeInteger(binding.variant)||binding.variant<0||binding.variant>1000000||!['guided','independent','repair'].includes(binding.phase)||!['type','mc','match','letters','pairs'].includes(binding.format))return null;
  if(!/^[wv]:/.test(binding.entryId))return null;
  const entry=lookupEntry(binding.entryId);if(!entry)return null;
  const plan=lessonFor(entry,{questionBuilder:questionFor}),chapter=plan.chapters.find(chapter=>chapter.id===binding.chapterId);let target=chapter?.groups.flatMap(group=>group.targets||[]).find(target=>target.id===binding.targetId);
  if(!target||plan.version!==binding.contentVersion)return null;
  // The revision recipe comes only from the loaded catalogue, never an
  // imported questionHistory object. Its descriptor also binds explanations,
  // spoken feedback and matching components, beyond the displayed answer.
  if(plan.questionHistory&&!binding.formSnapshot)return null;
  if(binding.formSnapshot&&(!journeyFormMatches(binding.formSnapshot,plan,binding,questionFor)||retiredJourneyForm(binding.formSnapshot,plan.questionHistory)))return null;
  if(binding.wordSlotId){
   const slot=plan.wordLesson?.slots.find(slot=>slot.id===binding.wordSlotId&&slot.targetId===target.id&&slot.variant===binding.variant&&slot.format===binding.format);
   if(!slot)return null;const targets=plan.chapters.flatMap(chapter=>chapter.groups.flatMap(group=>group.targets||[]));
   target={...target,shortWord:true,wordSlotId:slot.id,wordPairTargets:(slot.pairTargetIds||[]).map(id=>targets.find(target=>target.id===id)).filter(Boolean)};
  }
  if(binding.sceneSnapshot&&(!journeySceneMatches(binding.sceneSnapshot,{entryId:entry.id,chapterId:chapter.id,target,variant:binding.variant})||retiredJourneyScene(binding.sceneSnapshot,target)))return null;
  if(binding.sceneSnapshot&&binding.sceneRevision!==binding.sceneSnapshot.sourceRevision)return null;
  const options={variant:binding.variant,phase:binding.phase,format:binding.format,repairTag:binding.repairTag,scenePolicy:binding.scenePolicy,...binding.sceneSnapshot?{sceneSnapshot:binding.sceneSnapshot}:{},...binding.formSnapshot?{formSnapshot:binding.formSnapshot,questionRevision:binding.questionRevision,questionHistory:plan.questionHistory}:{}};
  const question=questionFor(entry,chapter,target,options);if(!question||!same(binding.question,questionSource(question)))return null;
  const sense=exactReviewedSense(entry),senses=sense?[sense]:[],references=[];
  // Only an exact saved/revalidated scene can supply an authored example.
  if(binding.sceneSnapshot){
   const pool=binding.sceneSnapshot.sourceRevision===target.legacyExpandedRevision?target.legacyExpandedContexts||[]:target.contexts||[];
   const context=pool.find(context=>context.id===binding.sceneSnapshot.context.id&&context.it===binding.sceneSnapshot.context.it&&context.en===binding.sceneSnapshot.context.en);
   if(context?.reviewed===true&&question.context?.it===context.it&&question.meta?.contextId===context.id)references.push({kind:'authored-example',id:context.id,it:context.it,en:context.en||'',level:entry.level,reviewed:true,reviewStatus:'authored-catalogue-reviewed-example',sourceRevision:binding.sceneSnapshot.sourceRevision,sourceCategory:context.source});
  }
  const rules=resolveRuleLinks({entry,plan,chapter,target,question,binding})||[];
  if(!senses.length&&!references.length&&!rules.length)return null;
  return {version:PRACTICE_SOURCE_VERSION,bindingFingerprint:sourceFingerprint(binding),sourceId:binding.sourceId,prompt:practicePromptText(question.prompt),context:question.context?`${question.context.it}\n${question.context.en||''}`:'',senses,rules,references};
 }};
}
