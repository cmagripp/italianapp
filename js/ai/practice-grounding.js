import {levelIncludes} from './grounding.js';
import {AIValidationError} from './validation.js';
import {sourceFingerprint} from './source-fingerprint.js';

// Practice sources require an explicit trusted catalogue resolver contract.
// A learner's question, requestedIds and imported session prose cannot select
// teaching authority. Conversation retrieval remains a separate operation.
export async function resolvePracticeGrounding(request,resolver){
 if(typeof resolver?.resolve!=='function'||!request.helpSource)throw new AIValidationError(['This practice source has no verified help binding.'],null);
 const binding=structuredClone(request.helpSource),fingerprint=sourceFingerprint(binding);
 if(fingerprint.length>16000)throw new AIValidationError(['This practice binding is too large.'],null);
 const source=await resolver.resolve(binding,{request});
 if(!source||source.bindingFingerprint!==fingerprint||source.sourceId!==request.helpContext?.sourceId||source.prompt!==request.helpContext?.prompt||source.context!==(request.helpContext?.context||''))throw new AIValidationError(['This practice source changed or is unsupported.'],null);
 const reviewed=record=>record?.verified===true&&typeof record.id==='string'&&typeof record.source==='string'&&!!record.source.trim()&&levelIncludes(request.level,record.level);
 const senses=(source.senses||[]).filter(reviewed).slice(0,5),rules=(source.rules||[]).filter(reviewed).slice(0,5);
 const references=(source.references||[]).filter(record=>record?.kind==='authored-example'&&(record.sourceValidated===true||record.reviewed===true)&&typeof record.id==='string'&&typeof record.it==='string'&&record.it.length<=4000&&typeof record.sourceRevision==='string'&&levelIncludes(request.level,record.level)).slice(0,2).map(record=>structuredClone(record));
 if(!senses.length&&!rules.length&&!references.length)throw new AIValidationError(['This practice source has no supported reference.'],null);
 return {version:source.version,senses,rules,references,practiceSource:{bindingFingerprint:fingerprint,sourceId:source.sourceId,sourceRevision:request.sourceRevision,referenceIds:references.map(reference=>reference.id),senseIds:senses.map(sense=>sense.id),ruleIds:rules.map(rule=>rule.id)}};
}

export function authoredExampleCards(grounding){
 return (grounding.references||[]).map(reference=>({kind:'authored-example',id:reference.id,title:reference.sourceCategory==='source-excerpt'?'Excerpt from this source':'Example from this lesson',examples:[{it:reference.it,en:reference.en||''}],source:reference.attribution?.url||null,attribution:reference.attribution||null,provenance:{kind:reference.sourceCategory==='source-excerpt'?'source-excerpt':'authored-lesson-example',sourceValidated:reference.sourceValidated===true||reference.reviewed===true,sourceRevision:grounding.practiceSource?.sourceRevision||reference.sourceRevision,catalogueRevision:reference.sourceRevision,reviewStatus:reference.reviewStatus,reviewRecord:reference.reviewRecord||null,sourceCategory:reference.sourceCategory||null,sourceLocator:reference.sourceLocator||null}}));
}
