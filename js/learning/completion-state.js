// Completion reads need only target descriptors, not lesson teaching/prompt code.
import {completionRecord} from './model.js';
import {journeyCaseProgress,journeyWordCompletion,CORE_JOURNEY_CASES} from './journey.js';
import {conjugate,MISSING} from '../conjugator.js';
let index=null,fullResolver=null;const plans=new Map();
export function installCompletionIndex(value){
 if(value?.version!==1||!Array.isArray(value.chapters)||!Array.isArray(value.plans)||!value.entries||value.plans.some(p=>!['verb','word'].includes(p.kind)||!Array.isArray(p.chapters)||p.chapters.some(i=>!value.chapters[i]))||Object.values(value.entries).some(i=>!value.plans[i]))throw new Error('Completion details could not load. Retry after reconnecting.');
 index=value;plans.clear();
}
export const registerCompletionResolver=resolver=>{fullResolver=resolver;};
export const loadFullCompletion=()=>import('./integration.js');
export const hasCompletionDescriptor=id=>index&&Object.hasOwn(index.entries,id);
export function completionPlan(entry){
 if(!entry||!hasCompletionDescriptor(entry.id))return null;if(plans.has(entry.id))return plans.get(entry.id);
 const recipe=index.plans[index.entries[entry.id]],expand=t=>({id:entry.id+t[0],...(recipe.kind==='verb'?{guidedOnly:!!(t[1]&1),completionRequired:!!(t[1]&2)}:{skill:t[1],available:t[2]!==0})});
 const plan={entryId:entry.id,version:recipe.version,kind:recipe.kind,chapters:recipe.chapters.map(i=>{const c=index.chapters[i];return {...c,groups:[{targets:c.targets.map(expand)}],...(c.legacy?{legacyRequirements:c.legacy.map(expand)}:{})};}),...(recipe.slots?{wordLesson:{slots:recipe.slots.map(([id,targetId])=>({id:entry.id+id,targetId:entry.id+targetId}))}}:{})};
 plans.set(entry.id,plan);return plan;
}
export function entryCompletion(entry,learning,item=null,now=Date.now()){
 if(fullResolver)return fullResolver(entry,learning,item,now);
 if(!entry)return {complete:false,cases:[]};
 const plan=completionPlan(entry);
 if(plan){if(entry.kind==='verb'){const state=journeyCaseProgress(plan,learning,null,now);return {...state,cases:state.cases.map(c=>({...c,checked:c.ready}))};}const state=journeyWordCompletion(plan,learning),override=completionRecord(learning,entry.id,'word');return {...state,complete:state.complete||!override&&!!item?.learned,cases:[]};}
 // Newly created custom entries have no generated recipe. Their authoring route
 // loads the full resolver before use; this fallback keeps standalone/old API
 // callers' explicit manual choices available without inventing answer proof.
 if(entry.kind!=='verb'){const choice=completionRecord(learning,entry.id,'word');return {complete:choice?choice.checked:!!item?.learned,completedAt:choice?.at??null,source:choice?.source??null,cases:[]};}
 let tenses={};try{tenses=conjugate(entry.inf,{aux:entry.aux,isc:entry.isc}).tenses;}catch{/* unavailable forms remain unchecked */}
 const names=['Present','Passato prossimo','Imperfetto','Future','Conditional'],keys=['presente','passatoProssimo','imperfetto','futuro','condizionale'];
 const cases=CORE_JOURNEY_CASES.map((id,i)=>{const available=(tenses[keys[i]]||[]).some(f=>f&&f!==MISSING),choice=completionRecord(learning,entry.id,id);return {id,title:names[i],tense:keys[i],available,exempt:!available,checked:available&&!!choice?.checked,ready:available&&!!choice?.checked,completedAt:choice?.at??null,source:choice?.source??null};});
 return {cases,complete:cases.some(c=>c.available)&&cases.filter(c=>c.available).every(c=>c.checked)};
}
