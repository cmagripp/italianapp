// Spelling display authority is minted here after independent source checks.
// Model JSON, backup records and structured clones never retain that authority.
import {compareSubmission,foldItalianAccents} from '../learning/answer-policy.js';
import {sourceFingerprint} from './source-fingerprint.js';
import {preservesProtectedMeaning,classifyInputSubmissionOrigin} from './validation.js';

export const INPUT_SPELLING_VERSION=1;
const receipts=new WeakMap(),MAX_TEXT=4000;
const fields=['turnId','revision','originalText','submittedText','displayText','policySnapshot','inputProvenance'];
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const string=(value,max=200)=>typeof value==='string'&&value.length>0&&value.length<=max;
const exact=(value,keys)=>record(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
function plain(value,depth=0){
 if(depth>10)throw new TypeError('Spelling source is too deeply nested');
 if(value===null||typeof value==='boolean'||typeof value==='string')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(!record(value)&&!Array.isArray(value))throw new TypeError('Spelling source must be plain data');
 for(const [key,child] of Object.entries(value)){
  if(['__proto__','prototype','constructor'].includes(key))throw new TypeError('Unsafe spelling source');
  plain(child,depth+1);
 }
}
function freeze(value){
 if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
 return value;
}
export function checkedInputSubmission(value){
 if(!exact(value,fields)||!string(value.turnId)||/\p{C}/u.test(value.turnId)||!Number.isSafeInteger(value.revision)||value.revision<1||
  !['originalText','displayText'].every(key=>typeof value[key]==='string'&&value[key].length<=MAX_TEXT)||
  !(value.submittedText===null||typeof value.submittedText==='string'&&value.submittedText.length<=MAX_TEXT))throw new TypeError('Spelling needs the exact saved input submission');
 plain(value);
 if(value.policySnapshot!==null&&!record(value.policySnapshot)||value.inputProvenance!==null&&!record(value.inputProvenance)||
  JSON.stringify(value.policySnapshot).length>2000||JSON.stringify(value.inputProvenance).length>32000)throw new TypeError('Spelling source metadata is unsupported');
 return freeze(structuredClone(value));
}
function checkedSource({inputSubmission,scope,sourceRevision}={}){
 if(!string(scope,500)||!(Number.isSafeInteger(sourceRevision)&&sourceRevision>=0||string(sourceRevision,500)))throw new TypeError('Spelling needs an exact request scope and revision');
 return freeze({scope,sourceRevision,inputSubmission:checkedInputSubmission(inputSubmission)});
}
export function assertInputSpellingRequest(request){
 if(request.inputSubmission===undefined)return null;
 if(!['conversation','coach'].includes(request.task)||request.opening===true||request.helpContext!==undefined)throw new TypeError('Spelling checking belongs to a submitted conversation message');
 const source=checkedSource(request);
 if(request.text!==source.inputSubmission.displayText)throw new TypeError('Spelling request does not match the saved display text');
 return source;
}
const origin=classifyInputSubmissionOrigin;
function mint(source,{outcome='unsupported',candidateNFC=null,differences=[],comparison=null,references=[],registryVersion=null,reason=null}={}){
 const submission=source.inputSubmission;
 const receipt=freeze({version:INPUT_SPELLING_VERSION,outcome,source,originalNFC:submission.originalText.normalize('NFC'),baseNFC:submission.displayText.normalize('NFC'),
  candidateNFC,effectiveText:outcome==='restore-display'?candidateNFC:submission.displayText,differences,comparison,references,registryVersion,
  inputOrigin:origin(submission),reason,assessment:'spelling-display-only',masteryAwarded:false});
 receipts.set(receipt,sourceFingerprint(source));return receipt;
}
export function assertValidatedInputSpelling(receipt,context){
 if(!record(receipt)||receipts.get(receipt)!==sourceFingerprint(checkedSource(context)))throw new TypeError('Spelling receipt is unvalidated or belongs to another source');
 return receipt;
}
export function isValidatedInputSpelling(receipt,context){
 try{assertValidatedInputSpelling(receipt,context);return true;}catch{return false;}
}
const wordRanges=text=>[...text.matchAll(/\p{L}[\p{L}\p{M}]*/gu)].map(match=>({start:match.index,end:match.index+match[0].length}));
const reviewStatuses=new Set(['independent-agent-review','independent-agent-review-passed']);

/** The registry and interpretation callback are trusted installed code, never
 * imported proposal fields. A source row is {id,revision,source,reviewStatus,
 * forms:[canonical Italian words]}; lookup(id) returns the reviewed row.
 * confirmInterpretation receives the complete exact context and trusted rows,
 * and must return true only when every changed word preserves intended meaning.
 * This module supplies no dictionary, token replacement list or language oracle. */
export function createInputSpellingValidator({registry,confirmInterpretation}={}){
 return {async validate(proposal,context){
  const source=checkedSource(context),s=source.inputSubmission,baseNFC=s.displayText.normalize('NFC');
  const unsupported=reason=>mint(source,{reason});
  if(s.submittedText===null)return unsupported('saved-submission-unavailable');
  if(!s.policySnapshot||s.policySnapshot.version!=='conversation-v1'||typeof s.policySnapshot.strictAccents!=='boolean')return unsupported('saved-policy-unavailable');
  if(origin(s)!=='typed')return unsupported('spelling-attribution-unavailable');
  if(!record(proposal)||!string(proposal.status,30))return unsupported('spelling-check-unavailable');
  if(['unchanged','clarify','unsupported'].includes(proposal.status)){
   if(!exact(proposal,['status']))return unsupported('invalid-spelling-proposal');
   return mint(source,{outcome:proposal.status,reason:proposal.status==='unsupported'?'spelling-check-unavailable':null});
  }
  if(!exact(proposal,['status','candidate','references'])||proposal.status!=='candidate'||typeof proposal.candidate!=='string'||proposal.candidate.length>MAX_TEXT||!Array.isArray(proposal.references)||proposal.references.length>32)return unsupported('invalid-spelling-proposal');
  const candidateNFC=proposal.candidate.normalize('NFC');
  if(foldItalianAccents(baseNFC)!==foldItalianAccents(candidateNFC))return unsupported('non-accent-rewrite');
  if(candidateNFC===baseNFC)return mint(source,{outcome:'unchanged'});
  const names=context.protectedNames||[];
  if(!Array.isArray(names)||names.length>20||names.some(name=>!string(name,200))||!preservesProtectedMeaning(baseNFC,candidateNFC,names))return unsupported('protected-meaning-change');
  if(!string(registry?.version,200)||typeof registry?.lookup!=='function'||typeof confirmInterpretation!=='function')return unsupported('reviewed-spelling-policy-unavailable');
  const registryVersion=registry.version;
  const comparison=compareSubmission(s.displayText,candidateNFC,{accentStrict:s.policySnapshot.strictAccents,inputMode:'typed',language:'it',trailingPunctuation:false});
  if(comparison.matchKind!=='accent-only'||!comparison.accentDifferences.length||comparison.accentDifferences.length>200)return unsupported('unsupported-accent-comparison');
  const changedWords=wordRanges(baseNFC).filter(word=>comparison.accentDifferences.some(diff=>diff.start>=word.start&&diff.end<=word.end));
  if(!changedWords.length||proposal.references.length!==changedWords.length)return unsupported('uncovered-accent-change');
  const references=[],trustedRows=[];
  for(const word of changedWords){
   const matches=proposal.references.filter(ref=>ref?.start===word.start&&ref?.end===word.end);
   if(matches.length!==1)return unsupported('uncovered-accent-change');
   const ref=matches[0];
   if(!exact(ref,['id','revision','start','end'])||!string(ref.id)||!string(ref.revision))return unsupported('invalid-spelling-reference');
   const row=await registry.lookup(ref.id);
   if(!record(row)||row.id!==ref.id||row.revision!==ref.revision||!reviewStatuses.has(row.reviewStatus)||!string(row.source,2000)||
    !Array.isArray(row.forms)||!row.forms.length||row.forms.length>32||row.forms.some(form=>!string(form,100)))return unsupported('unreviewed-spelling-reference');
   const wordText=candidateNFC.slice(word.start,word.end);
   if(!row.forms.some(form=>form.normalize('NFC').toLocaleLowerCase('it')===wordText.toLocaleLowerCase('it')))return unsupported('reference-form-mismatch');
   const trusted=freeze({id:row.id,revision:row.revision,source:row.source,reviewStatus:row.reviewStatus,forms:structuredClone(row.forms)});
   trustedRows.push(trusted);references.push({id:row.id,revision:row.revision,source:row.source,reviewStatus:row.reviewStatus,start:word.start,end:word.end,form:wordText});
  }
  if(registry.version!==registryVersion)return unsupported('spelling-registry-changed');
  const interpretation=await confirmInterpretation(freeze({source,baseNFC,candidateNFC,differences:structuredClone(comparison.accentDifferences),references:trustedRows,
   protectedNames:structuredClone(names),registryVersion}));
  if(registry.version!==registryVersion)return unsupported('spelling-registry-changed');
  if(interpretation!==true)return mint(source,{outcome:'clarify',reason:'meaning-unresolved'});
  return mint(source,{outcome:s.policySnapshot.strictAccents?'spelling-feedback':'restore-display',candidateNFC,
   differences:comparison.accentDifferences,comparison,references,registryVersion});
 }};
}
