// Grammar evidence is independent of dictionary completion. Pure and replayable.
import { schedule } from '../srs.js';

function replayOrder(events) {
  const sessions=new Map();
  const tie=(a,b)=>(a.at-b.at) || String(a.deviceId || '').localeCompare(String(b.deviceId || '')) || ((a.sequence || 0)-(b.sequence || 0)) || String(a.id || '').localeCompare(String(b.id || ''));
  for(const event of events){if(!sessions.has(event.sessionId))sessions.set(event.sessionId,[]);sessions.get(event.sessionId).push(event);}
  const ordered=[];
  for(const group of sessions.values()){
    let at=0;
    for(const event of group.sort((a,b)=>a.index-b.index || tie(a,b))){at=Math.max(at,event.at);ordered.push({...event,at});}
  }
  // Session indexes preserve answer order when an offline device clock moves back.
  return ordered.sort((a,b)=>a.at-b.at || String(a.sessionId).localeCompare(String(b.sessionId)) || a.index-b.index || tie(a,b));
}

export function grammarSkill(events, now = Date.now()) {
  events=replayOrder(events);
  const last = events.at(-1);
  const relevant = events.filter(e => e.policy === 'grammar-v1' && e.contentVersion === last?.contentVersion);
  const state = { objectiveId:last?.objectiveId, entryId:last?.entryId, kind:'grammar', skill:last?.skill,
    attempts:0, ready:false, remembered:false, readyAt:null, due:0, isDue:false,
    independentCorrect:0, requiredCorrect:2, unresolvedErrors:[], sessionEvidence:{},
    srs:{s:0,ef:2.5,iv:0,due:0,reps:0,lapses:0}, lastAt:last?.at || null };
  let successes = [], previous = null;
  const exposed = new Map();
  for (const e of relevant) {
    if (e.outcome === 'skipped') continue;
    state.attempts++;
    const independent = e.grammarPhase === 'independent' && e.firstAttempt && !e.assistance.length;
    const exposure = exposed.get(e.variantId);
    const separated = !previous || (previous.sessionId === e.sessionId ? e.index-previous.index >= 2 : e.at-previous.at >= 8*3600e3);
    const fresh = !exposure || (exposure.sessionId === e.sessionId ? e.index-exposure.index >= 3 : e.at-exposure.at >= 8*3600e3);
    const eligible=independent && separated && fresh;
    if (!e.ok) {
      successes=[];
      state.unresolvedErrors=[{tag:e.errorTags?.[0] || e.skill,skill:e.skill,at:e.at}];
    } else if (eligible) {
      if (!successes.some(x=>x.contextId===e.contextId)) successes.push(e);
      previous=e;
      if (successes.length >= 2) {
        state.ready=true; state.readyAt ||= e.at; state.unresolvedErrors=[];
      }
    }
    // A repeated reveal or answer cannot manufacture independent evidence.
    exposed.set(e.variantId,e);
    state.independentCorrect=successes.length;
    const sessionEvidence=state.sessionEvidence[e.sessionId];
    const firstFailure=!e.ok && (!sessionEvidence || sessionEvidence.ok);
    const spacedSuccess=e.ok && eligible && (!state.srs.due || e.at>=state.srs.due) && !sessionEvidence;
    const shortRepair=e.ok && independent && fresh && state.unresolvedErrors.length && state.srs.lapses>0 && e.at>=state.srs.due && !sessionEvidence;
    if (state.ready && (firstFailure || spacedSuccess || shortRepair)) {
      state.srs=schedule(state.srs,e.ok ? spacedSuccess?5:3 : 1,e.at);
      state.sessionEvidence[e.sessionId]={at:e.at,ok:e.ok};
    }
  }
  state.due=state.srs.due;
  state.isDue=state.ready && state.due<=now;
  state.remembered=state.ready && state.srs.reps>=2 && !state.unresolvedErrors.length;
  state.status=state.ready ? state.remembered?'remembered':'ready' : state.attempts?'learning':'new';
  return state;
}
