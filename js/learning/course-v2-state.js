// Replayable evidence for authored course targets. It never changes dictionary completion.
import { schedule } from '../srs.js';
import { grammarEvidence } from './grammar-evidence.js';

const HOUR = 3600e3;
const emptySrs = () => ({ s:0, ef:2.5, iv:0, due:0, reps:0, lapses:0 });
const clean = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g,"'").replace(/[.!?,;:]+$/g,'').trim().replace(/\s+/g,' ');

function replayOrder(events) {
  const sessions = new Map();
  const tie = (a,b) => (Number(a.at || 0)-Number(b.at || 0)) || String(a.deviceId || '').localeCompare(String(b.deviceId || ''))
    || (Number(a.sequence || 0)-Number(b.sequence || 0)) || String(a.id || '').localeCompare(String(b.id || ''));
  for (const event of events || []) {
    if (event?.policy !== 'grammar-v2' || !event.sessionId) continue;
    if (!sessions.has(event.sessionId)) sessions.set(event.sessionId,[]);
    sessions.get(event.sessionId).push(event);
  }
  const ordered=[];
  for (const group of sessions.values()) {
    let at=0;
    for (const e of group.sort((a,b)=>Number(a.index || 0)-Number(b.index || 0) || tie(a,b))) {
      at=Math.max(at,Number(e.at || 0));
      ordered.push({...e,at});
    }
  }
  return ordered.sort((a,b)=>a.at-b.at || String(a.sessionId).localeCompare(String(b.sessionId)) || Number(a.index || 0)-Number(b.index || 0) || tie(a,b));
}

function rubric(events,target) {
  const last=events.at(-1);
  const facets=Array.isArray(target?.facets) && target.facets.length ? [...new Set(target.facets)]
    : Array.isArray(last?.requiredFacets) && last.requiredFacets.length ? [...new Set(last.requiredFacets)] : [last?.facet || 'core'];
  return {
    facets, minIndependent:Math.max(2,Number(target?.minIndependent ?? last?.minIndependent ?? 2) || 2),
    requiresProduction:target?.requiresProduction === true || (!target && last?.requiresProduction === true),
    modality:target?.modality || last?.modality || 'language',
  };
}

const exposureOf=e=>clean(e.exposureGroup || e.variantId || e.contextId);
const separated=(prior,e,shortRepair=false)=>!prior || (prior.sessionId===e.sessionId
  ? Number(e.index)-Number(prior.index)>=2
  : Number(e.at)-Number(prior.at)>=(shortRepair ? 10*60e3 : 8*HOUR));

export function courseSkill(inputEvents,now=Date.now(),target=null) {
  const ordered=replayOrder(inputEvents);
  const last=ordered.at(-1);
  const relevant=ordered.filter(e=>e.contentVersion===(last?.contentVersion || 2)
    && (!target || e.objectiveId===target.id));
  const r=rubric(relevant,target);
  const state={objectiveId:target?.id || last?.objectiveId,entryId:last?.entryId,kind:'grammar',
    attempts:0,practiceAttempts:0,ready:false,enrolled:false,remembered:false,readyAt:null,due:0,isDue:false,
    independentCorrect:0,requiredCorrect:r.minIndependent,requiredFacets:r.facets,
    facetEvidence:Object.fromEntries(r.facets.map(f=>[f,0])),requiresProduction:r.requiresProduction,modality:r.modality,
    unresolvedErrors:[],sessionEvidence:{},srs:emptySrs(),lastAt:last?.at || null};
  const credits=new Map(r.facets.map(f=>[f,[]]));
  const evidence=grammarEvidence(r);
  const exposures=new Map();
  const lastCredit={};
  let production=false, everReady=false;
  for (const e of relevant) {
    if (e.outcome==='skipped') continue;
    if(e.outcome==='correct' || e.outcome==='incorrect')state.attempts++;
    else state.practiceAttempts++;
    const facet=r.facets.includes(e.facet) ? e.facet : null;
    const group=exposureOf(e);
    const previousExposure=exposures.get(group);
    const independent=e.outcome==='correct' && e.ok===true && e.grammarPhase==='independent'
      && e.firstAttempt===true && !(e.assistance || []).length && e.modality===r.modality;
    const shortRepair=everReady && state.srs.lapses>0 && e.at>=state.srs.due;
    const fresh=!!group && (!previousExposure || (previousExposure.sessionId!==e.sessionId
      && e.at-previousExposure.at >= (shortRepair ? 10*60e3 : 8*HOUR)));
    const eligible=facet && independent && fresh && separated(lastCredit[facet],e,shortRepair);
    const firstFailure=e.outcome==='incorrect' && facet && everReady
      && (!state.sessionEvidence[e.sessionId] || state.sessionEvidence[e.sessionId].ok);
    if (e.outcome==='incorrect' && facet) {
      // A lapse suspends earned evidence; it does not erase the learner's history.
      const earlier=state.unresolvedErrors.find(x=>x.facet===facet);
      // Keep real prior successes. One slip needs a fresh discriminating check;
      // repeated unresolved mistakes need two. Other facets are never erased.
      const count=(earlier?.count||0)+1;
      state.unresolvedErrors=state.unresolvedErrors.filter(x=>x.facet!==facet);
      state.unresolvedErrors.push({facet,tag:e.errorTags?.[0] || 'needs-review',at:e.at,count,remaining:count>1?2:1});
      if (firstFailure) {
        state.srs=schedule(state.srs,1,e.at);
        state.sessionEvidence[e.sessionId]={at:e.at,ok:false};
      }
    } else if (eligible) {
      const bucket=credits.get(facet);
      const context=clean(e.contextId || e.variantId);
      state.unresolvedErrors=state.unresolvedErrors.map(error=>error.facet===facet?{...error,remaining:error.remaining-1}:error).filter(error=>error.remaining>0);
      if (context && !bucket.some(x=>x.context===context)) {
        bucket.push({context,event:e});
      }
      lastCredit[facet]=e;
    }
    // A guided, revealed or ungraded encounter still exposes the answer family.
    if (group) exposures.set(group,e);
    const all=[...credits.values()].flat();
    production=all.some(x=>x.event.mode==='production' || x.event.responseMode==='production');
    state.independentCorrect=all.length;
    for (const f of r.facets) state.facetEvidence[f]=credits.get(f).length;
    state.ready=all.length>=r.minIndependent && r.facets.every(f=>credits.get(f).length>0)
      && (!r.requiresProduction || production) && !state.unresolvedErrors.length;
    if (state.ready && !everReady) {
      everReady=true;
      state.readyAt=e.at;
      state.srs=schedule(state.srs,5,e.at);
      state.sessionEvidence[e.sessionId]={at:e.at,ok:true};
    } else if (everReady && eligible && state.ready && e.at>=state.srs.due && !state.sessionEvidence[e.sessionId]) {
      state.srs=schedule(state.srs,shortRepair?3:5,e.at);
      state.sessionEvidence[e.sessionId]={at:e.at,ok:true};
    }
    evidence.observe(e,{eligible,facet,context:clean(e.contextId || e.variantId),blocked:!!state.unresolvedErrors.length});
  }
  state.due=state.srs.due;
  state.enrolled=everReady;
  state.isDue=everReady && !!state.due && state.due<=now;
  state.remembered=state.ready && state.srs.reps>=2 && !state.unresolvedErrors.length;
  state.status=state.ready ? state.remembered?'remembered':'ready' : state.attempts?'learning':'new';
  return {...state,...evidence.summary()};
}
