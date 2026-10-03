// Finished case coverage is separate from consolidated readiness/remembering.
// Only explicitly versioned new attempts participate; historical proof is intact.
import {completionRecord} from './model.js';
export const CASE_COVERAGE_POLICY='verb-case-coverage-v1';
const required=t=>t.available!==false&&(t.required!==false||t.completionRequired)&&!t.supplementalOnly;
const production=t=>!t.completionRequired&&!t.guidedOnly;
const empty=t=>({id:t.id,supported:false,production:false,repairRequired:false,repaired:false,guidedContexts:[],covered:false});
const cache=new WeakMap();
export function caseCoverage(plan,learning,chapterId,{sessionId=null,startIndex=null}={}){
 const chapter=plan?.chapters?.find(c=>c.id===chapterId),needs=(chapter?.groups||[]).flatMap(g=>g.targets||[]).filter(required);
 const finals=new Set((chapter?.groups||[]).filter(g=>g.finalReview).flatMap(g=>g.targets||[]).filter(required).map(t=>t.id));
 const override=completionRecord(learning,plan?.entryId,chapterId);
 const key=`${chapterId}:${sessionId||'*'}:${startIndex??'*'}:${override&&!override.checked?override.at:0}`;
 let memo=learning&&cache.get(learning);
 if(!memo||memo.events!==learning?.events||memo.plan!==plan||memo.completions!==learning?.completions){memo={events:learning?.events,plan,completions:learning?.completions,values:new Map()};if(learning)cache.set(learning,memo);}
 if(memo.values.has(key))return memo.values.get(key);
 const byId=new Map(needs.map(t=>[t.id,t])),sessions=new Map();let completedAt=null;
 const events=Object.values(learning?.events||{}).filter(e=>e.caseCoveragePolicy===CASE_COVERAGE_POLICY&&e.policy==='journey-v1'
  &&e.kind==='verb'&&e.entryId===plan?.entryId&&e.chapterId===chapterId&&e.contentVersion===plan.version&&e.epochId===learning.epoch?.id
  &&(!sessionId||e.sessionId===sessionId)&&(startIndex==null||e.index>=startIndex)&&(!override||override.checked||e.at>override.at))
  .sort((a,b)=>a.sessionId.localeCompare(b.sessionId)||a.index-b.index||a.at-b.at||a.id.localeCompare(b.id));
 for(const event of events){
  const target=byId.get(event.objectiveId);if(!target||event.outcome==='skipped')continue;
  if(!sessions.has(event.sessionId))sessions.set(event.sessionId,new Map(needs.map(t=>[t.id,empty(t)])));
  const states=sessions.get(event.sessionId),state=states.get(target.id),sameSkill=event.skill===target.skill;
  if(!event.ok||event.outcome==='revealed'){state.production=false;state.repairRequired=true;state.repaired=false;state.covered=false;continue;}
  if(event.activityKind==='repair'){state.repaired=true;}
  if(sameSkill&&event.mode==='recognition'&&['guided','repair'].includes(event.activityKind)){
   state.supported=true;if(event.contextId&&!state.guidedContexts.includes(event.contextId))state.guidedContexts.push(event.contextId);
  }
  const unaided=sameSkill&&event.mode==='production'&&event.activityKind==='independent'&&event.firstAttempt===true
    &&!event.assistance?.length&&(!state.repairRequired||state.repaired);
  const earlierCovered=!finals.has(target.id)||needs.filter(t=>!finals.has(t.id)).every(t=>states.get(t.id).covered);
  const fresh=!finals.has(target.id)||!!event.contextId&&!state.guidedContexts.includes(event.contextId);
  if(unaided&&earlierCovered&&fresh){state.production=true;state.repairRequired=false;state.productionEventId=event.id;state.productionContextId=event.contextId;}
  state.covered=state.supported&&(!production(target)||state.production)&&!state.repairRequired;
  if(needs.length&&needs.every(t=>states.get(t.id).covered))completedAt=completedAt===null?event.at:Math.min(completedAt,event.at);
 }
 const states=sessionId?sessions.get(sessionId)||new Map(needs.map(t=>[t.id,empty(t)])):new Map(needs.map(t=>[t.id,empty(t)]));
 const result={policy:CASE_COVERAGE_POLICY,completedAt,complete:completedAt!==null,states,sessions};memo.values.set(key,result);return result;
}
