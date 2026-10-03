// Response evidence is additive to the course rubric. Choosing an answer and
// writing one retain separate, replayable proof; comprehension is not a claim
// of general grammatical production.
export const GRAMMAR_EVIDENCE_POLICY = 'grammar-response-evidence-v1';
const DAY = 86400e3;
const clean = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('it')
  .replace(/[’‘]/g,"'").replace(/[.!?,;:]+$/g,'').trim().replace(/\s+/g,' ');

export function grammarEvidence({facets=['core'],minIndependent=2,modality='language'}={}) {
  const requiredFacets=[...new Set(facets)],requiredCorrect=Math.max(2,minIndependent);
  const makeLane=()=>({contexts:new Map(),identities:new Set(),errors:new Map(),qualifiedEventIds:[],
    ready:false,readyAt:null,readySession:null,delayed:new Set(),rememberedAt:null});
  const lanes={recognition:makeLane(),written:makeLane()};
  const modeOf=e=> {
    if (!['recognition','production'].includes(e.mode)) return null;
    // Preserve old course completion, but conflicting imported metadata cannot
    // establish a new response-mode milestone.
    if (e.responseMode && e.responseMode!==e.mode) return null;
    return e.mode==='production'?'written':'recognition';
  };
  function update(lane,e,blocked) {
    const covered=requiredFacets.every(f=>[...lane.contexts.values()].includes(f));
    const ready=lane.identities.size>=requiredCorrect && covered && !lane.errors.size && !blocked;
    if (!ready) {
      lane.readyAt=null;lane.readySession=null;lane.delayed.clear();lane.rememberedAt=null;
    } else if (!lane.ready) {
      lane.readyAt=e.at;lane.readySession=e.sessionId;
    }
    lane.ready=ready;
  }
  function observe(e,{eligible=false,facet='core',context=e.contextId,blocked=false}={}) {
    const mode=modeOf(e),lane=lanes[mode],knownFacet=requiredFacets.includes(facet);
    if (lane && knownFacet && !['skipped','ungraded'].includes(e.outcome)) {
      if (e.outcome==='incorrect' || e.outcome==='revealed') {
        const earlier=lane.errors.get(facet),count=(earlier?.count || 0)+1;
        lane.errors.set(facet,{facet,at:e.at,count,remaining:count>1?2:1,
          tag:e.errorTags?.[0] || 'needs-review',evidenceMode:e.mode});
      } else if (eligible && e.outcome==='correct' && e.ok===true
        && e.grammarPhase==='independent' && e.firstAttempt===true && !(e.assistance || []).length) {
        const identity=clean(context);
        if (identity) {
          lane.qualifiedEventIds.push(e.id);
          lane.contexts.set(`${facet}|${identity}`,facet);
          lane.identities.add(identity);
          const error=lane.errors.get(facet);
          if (error) {
            if (error.remaining<=1) lane.errors.delete(facet);
            else lane.errors.set(facet,{...error,remaining:error.remaining-1});
          }
          if (lane.ready && !blocked && !lane.errors.size && e.sessionId!==lane.readySession
            && e.at-lane.readyAt>=DAY) {
            lane.delayed.add(identity);
            if (lane.delayed.size>=2) lane.rememberedAt ??= e.at;
          }
        }
      }
    }
    for (const item of Object.values(lanes)) update(item,e,blocked);
  }
  const snapshot=lane=>({independentCorrect:lane.identities.size,requiredCorrect,requiredFacets,
    facetEvidence:Object.fromEntries(requiredFacets.map(f=>[f,[...lane.contexts.values()].filter(x=>x===f).length])),
    ready:lane.ready,remembered:lane.ready && lane.rememberedAt!==null,
    readyAt:lane.readyAt,rememberedAt:lane.rememberedAt,delayedCorrect:lane.delayed.size,
    unresolvedErrors:[...lane.errors.values()],qualifiedEventIds:[...lane.qualifiedEventIds]});
  function summary() {
    const recognition=snapshot(lanes.recognition),written=snapshot(lanes.written);
    return {grammarEvidencePolicy:GRAMMAR_EVIDENCE_POLICY,modality,
      recognitionIndependentCorrect:recognition.independentCorrect,
      writtenIndependentCorrect:written.independentCorrect,
      productionIndependentCorrect:modality==='language'?written.independentCorrect:0,
      recognitionReady:recognition.ready,recognitionRemembered:recognition.remembered,
      writtenResponseReady:written.ready,writtenResponseRemembered:written.remembered,
      productionReady:modality==='language' && written.ready,
      productionRemembered:modality==='language' && written.remembered,
      responseEvidence:{policy:GRAMMAR_EVIDENCE_POLICY,modality,recognition,written}};
  }
  return {observe,summary};
}
