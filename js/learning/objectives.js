// Objective identity is independent of completion. Aliases never rewrite the
// immutable event log, and a diagnostic relation never pools assessed evidence.
export const OBJECTIVE_MAPPING_VERSION = 1;
const registry = new Map(), aliases = new Map();
let revision = 0;
let signatureRevision=-1,signature='';
const modes = ['recognition', 'production', 'listening'];
export const objectiveRegistryRevision = () => revision;
export function objectiveMappingSignature() {
  if(signatureRevision!==revision){
    const payload=JSON.stringify([...aliases.values()].sort((a,b)=>a.legacyId.localeCompare(b.legacyId)));let hash=2166136261;
    for(const c of payload)hash=Math.imul(hash^c.charCodeAt(0),16777619);
    signature=`${OBJECTIVE_MAPPING_VERSION}:${(hash>>>0).toString(16)}`;signatureRevision=revision;
  }
  return signature;
}

export function declareObjective(target) {
  if (!target?.id || !target.entryId) return null;
  const record = { id:target.id, entryId:target.entryId, ...(target.senseId?{senseId:target.senseId}:{}),
    caseId:target.sourceChapter || target.chapterId || null, skill:target.skill,
    evidenceModes:target.evidenceModes || modes, policyVersion:target.policyVersion || 1,
    contentVersion:target.contentVersion || 1, reviewDestination:target.reviewDestination || target.id,
    ...target };
  registry.set(record.id, record);
  return record;
}
export function declareAlias({legacyId,canonicalId,relation='diagnostic',rationale}) {
  if (!legacyId || !canonicalId || legacyId===canonicalId || !['equivalent','diagnostic'].includes(relation)) return null;
  if(relation==='equivalent') {
    const old=registry.get(legacyId),current=registry.get(canonicalId);
    if(old&&current&&['entryId','senseId','caseId','skill'].some(key=>(old[key] || null)!==(current[key] || null)))throw new Error('Equivalent objective aliases require the same sense, case and skill.');
    if(old&&current&&JSON.stringify([...old.evidenceModes].sort())!==JSON.stringify([...current.evidenceModes].sort()))throw new Error('Equivalent objective aliases require the same evidence modes.');
    if(canonicalObjectiveId(canonicalId)===legacyId)throw new Error('Objective aliases cannot form a cycle.');
  }
  const record={legacyId,canonicalId,relation,rationale:rationale || 'Retain the original diagnostic difficulty.',mappingVersion:OBJECTIVE_MAPPING_VERSION};
  if (JSON.stringify(aliases.get(legacyId))!==JSON.stringify(record)) {aliases.set(legacyId,record);revision++;}
  return record;
}
export function registerEntryObjectives(entry,targets=[]) {
  for (const target of targets) {
    declareObjective({...target,entryId:entry.id,kind:entry.kind,senseId:entry.senseId});
    // Both tasks select the definite article for the same stored noun and number.
    // Plural-only nouns are kept diagnostic: their older question asked for a
    // singular surface while the current lesson explicitly teaches plural use.
    if (entry.kind!=='verb' && !entry.id.startsWith('c:') && target.skill==='article' && target.number!=='plural') {
      declareObjective({...target,id:`${entry.id}::word::article`,entryId:entry.id,kind:entry.kind,senseId:entry.senseId,caseId:target.chapterId});
      declareAlias({legacyId:target.id,canonicalId:`${entry.id}::word::article`,relation:'equivalent',
        rationale:'Same dictionary noun, definite article, singular number and evidence modes.'});
    } else if(entry.kind!=='verb' && ['meaning','recall','plural','listening','context'].includes(target.skill)) {
      declareAlias({legacyId:`${entry.id}::word::${target.skill}`,canonicalId:target.id,relation:'diagnostic',
        rationale:'Keep the older broad sense/answer policy and its original assessed identity; use a compatible diagnostic question.'});
    } else if(entry.kind==='verb' && target.skill==='conjugation' && target.tense) {
      declareAlias({legacyId:`${entry.id}::${target.tense}::conjugation`,canonicalId:`${entry.id}|${target.chapterId}`,relation:'diagnostic',
        rationale:'A broad tense target cannot prove a particular person or contextual construction; diagnose the original tense target.'});
    }
  }
  return targets;
}
export function objectiveMapping(id) {return aliases.get(id) || null;}
export function canonicalObjectiveId(id) {
  let current=id;const seen=new Set();
  while (!seen.has(current)) {seen.add(current);const alias=aliases.get(current);if(alias?.relation!=='equivalent')break;current=alias.canonicalId;}
  return current;
}
export function objectiveDescriptor(id) {return registry.get(id) || [...registry.values()].find(o=>canonicalObjectiveId(o.id)===canonicalObjectiveId(id)) || null;}
export function objectiveAliases() {return [...aliases.values()].map(x=>({...x}));}
export function canonicalizeAttempt(input) {
  if (!input?.objectiveId) return input;
  const canonicalId=canonicalObjectiveId(input.objectiveId);
  return {...input,canonicalObjectiveId:canonicalId,objectiveMappingVersion:OBJECTIVE_MAPPING_VERSION};
}
export function diagnosticObjective(state) {
  return {id:state.objectiveId,entryId:state.entryId,kind:state.kind,skill:state.skill,
    tense:state.tense,person:state.person ?? null,diagnostic:true,
    reviewDestination:state.objectiveId,evidenceModes:modes,policyVersion:1,contentVersion:state.contentVersion || 1};
}
