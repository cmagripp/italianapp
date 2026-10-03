// Bounded advanced editorial refinement. Retained targets, questions, source
// passages and progress identities stay intact; specified transfer cards change.
import {advancedTransfers} from './phase6-advanced-transfers.mjs';
import {advancedLanguage} from './phase6-advanced-lessons.mjs';
import {advancedReading} from './phase6-advanced-reading.mjs';
import {advancedListening,naturalSources} from './phase6-advanced-listening.mjs';
import {compileIntermediateLanguage,compileIntermediateInput} from './phase6-intermediate.mjs';
import {advancedSupport} from './phase6-advanced-support.mjs';
import {tokenizeItalianSentence} from '../js/learning/sentence-lookup.js';
export const advancedVersion='phase6-advanced-1';
export const advancedUnits={
 B2:[['v2-b2-community-evidence','A community proposal with evidence','Build a qualified recommendation and read a connected community dossier.','v2-b2-community-argument','v2-b2-read-community-dossier'],['v2-b2-workshop-register','Negotiate and follow real speakers','Retain conditions in a practical negotiation and follow cultural interview relationships.','v2-b2-workshop-negotiation','v2-b2-listen-cultural-interviews'],['v2-b2-service-relay','A service brief for its recipient','Attribute a transport decision and adapt an extended update to a traveller.','v2-b2-transport-brief','v2-b2-read-service-update']],
 C1:[['v2-c1-evidence-proposal','A sustained proposal with limits','Distinguish observation from cause and keep evidence limits in a recommendation.','v2-c1-evidence-limits','v2-c1-read-research-brief'],['v2-c1-interview-stance','Stance in natural interviews','Follow qualification, reformulation, hope and commitment in extended spoken accounts.','v2-c1-spoken-position','v2-c1-listen-interview-stance'],['v2-c1-reader-reformulation','Reformulation and a reader’s perspective','Restore actors in a public brief and track a literary narrator’s correction of an imagined reader.','v2-c1-audience-reformulation','v2-c1-read-pascal-preface']],
 C2:[['v2-c2-editorial-interpretation','Scope, implication and literary argument','Keep negation scope and implied contrasts precise while following an authentic extended argument.','v2-c2-editorial-inference','v2-c2-read-pascal-second-preface'],['v2-c2-spoken-distance','Distance, register and implied meaning','Attribute an unconfirmed account and distinguish figurative speech from a literal commitment.','v2-c2-register-attribution','v2-c2-listen-implicit-register'],['v2-c2-comparative-brief','A synthesis that preserves conflict','Align measures, rank sources with reasons and retain unresolved questions in a recipient’s brief.','v2-c2-comparative-synthesis','v2-c2-read-comparison-dossier']]
};
const advancedEditorial={version:advancedVersion,author:'Parola curriculum workstream',agentReview:'passed independent agent source/key/support/recovery review',agentReviewRecord:'docs/implementation/phase-6/advanced-independent-review.md',nativeItalianEducatorReview:'pending',learnerCalibration:'pending',sourceRefs:['https://www.unistrapg.it/profilo_lingua_italiana/site/index.html','https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4'],proficiencyClaim:'Editorial advanced band placement, not CEFR certification. Controlled source/form readiness is separate from optional open performance.'};
const supportedWords=text=>[...new Set(tokenizeItalianSentence(text).filter(t=>t.type==='word').map(t=>t.text.toLocaleLowerCase('it').replace(/[’‘]/g,"'")))].map(w=>advancedSupport.get(w)).filter(Boolean).map(w=>({...w}));
function advancedMetadata(lesson,record){
 lesson.editorial={...advancedEditorial,textOrigin:record.source?'Attributed authentic source excerpts with original meaning guides and questions.':'Original authored fictional scenes, or separately attributed natural interview transcripts.',...record.source?{authenticText:record.source}:{}};
 lesson.curriculum.introducedSenses=lesson.curriculum.introducedSenses.map(w=>({...w,id:w.id.replace('phase6-intermediate-sense:','phase6-advanced-sense:')}));
 lesson.minutes=record.modality?18:14;
 for(const step of lesson.steps){const texts=[step.it,step.context,step.speak,step.kind==='portfolio'?step.model:null,...(step.examples||[]).map(e=>e.it),...(step.words||[]).map(w=>w.it)].filter(Boolean);const support=supportedWords(texts.join(' '));if(support.length)step.background=support;}
 if(!record.modality){
  // Small frame-level additions are explicitly taught with the preparation;
  // the larger authentic-source glossary stays available on demand in lookup.
  const first=lesson.steps[0],known=new Set(first.words.map(w=>w.it));
  for(const w of lesson.steps.flatMap(s=>s.background||[]))if(!known.has(w.it)){first.words.push({...w});known.add(w.it);}
 }
 return lesson;
}
export function compileAdvancedLanguage(record){return advancedMetadata(compileIntermediateLanguage(record),record);}
export function compileAdvancedInput(record){
 const lesson=advancedMetadata(compileIntermediateInput(record),record);
 for(const [index,scene] of record.scenes.entries()){
  const passage=lesson.steps.find(s=>s.id===record.id+'.source-'+index);
  if(record.source){passage.source={...record.source};passage.title=record.source.title+' · section '+(index+1);}
  if(scene.media){const source=naturalSources[scene.media.key];passage.source={title:source.title,author:source.credit,year:source.workYear||source.date.slice(0,4),url:source.article,license:source.textLicense||source.license,licenseUrl:source.textLicenseUrl||source.licenseUrl,changes:'Original spoken interview/reading excerpt, cropped and AAC encoded; transcript punctuation standardised; English meaning guide and pedagogy added.'};passage.title=source.title;passage.recordedExcerpt={...scene.media};}
 }
 if(record.modality==='reading'){
  // On a clean path the graded reserves are skipped. Offer their full source
  // sections before asking for an optional complete-dossier interpretation.
  const index=lesson.steps.findIndex(s=>s.kind==='portfolio');
  const extensions=record.scenes.slice(3).map((scene,i)=>{const original=lesson.steps.find(s=>s.id===record.id+'.source-'+(i+3));return {...structuredClone(original),id:record.id+'.further-reading-'+(i+3),reserve:false,title:'Read the remaining section '+(i+4),task:'Optional source extension for the complete-dossier application. This passage does not assess another target.'};});
  lesson.steps.splice(index,0,...extensions);
  lesson.steps.find(s=>s.kind==='portfolio').prompt+=' The remaining selected source sections are available just before this task; readiness does not establish comprehension of every section.';
 }
 return lesson;
}
const preparation={
 'v2-c1-u1-future-perfect-conjecture':[{it:'referente',en:'contact person'}],
 'v2-c2-u5-literary-tenses':[{it:'posò',en:'he/she put down (posare, literary past event)'},{it:'posare',en:'to put down; remote-past persons: posai, posasti, posò, posammo, posaste, posarono'}],
 'v2-c2-u9-modal-inference':[{it:'chiuderla',en:'to close it (the feminine door)'}],
 'v2-c2-u9-relative-precision':[{it:'accolta',en:'accepted (feminine participle agreeing with the proposal)'}],
 'v2-c2-u11-condense-expand':[{it:'precede',en:'comes before (third-person singular of precedere)'}],
 'v2-c2-u12-production':[{it:'attivato',en:'activated (participle of attivare)'}]
};
export function refinePhase6AdvancedPack(pack){
 if(!['B2','C1','C2'].includes(pack.level))return pack;
 const decisions=[];
 for(const unit of pack.units)for(const lesson of unit.lessons){
  if(lesson.editorial?.version===advancedVersion)continue;
  const replacement=advancedTransfers[lesson.id];
  if(replacement){
   const transfer=lesson.steps.find(s=>s.id===lesson.id+'.core.transfer');
   if(!transfer||transfer.kind!=='teach')throw Error(lesson.id+': historical transfer-card identity missing');
   Object.assign(transfer,structuredClone(replacement));
  }
  for(const word of preparation[lesson.id]||[])if(!lesson.steps[0].words.some(w=>w.it===word.it))lesson.steps[0].words.push({...word});
  decisions.push({lessonId:lesson.id,unitId:unit.id,decision:replacement?'repair-specific-transfer-model-retain-goal-and-identities':'retain-authored-frame-and-identities-pending-full-review',changedStepIds:[...replacement?[lesson.id+'.core.transfer']:[],...preparation[lesson.id]?[lesson.id+'.words']:[]],targetIds:lesson.targets.map(t=>t.id),questionIds:lesson.steps.filter(s=>s.kind==='question').map(s=>s.id),nativeItalianEducatorReview:'pending',agentLanguageReview:replacement?'passed independent agent review of the declared replacement/preparation slice; complete retained questions remain pending':'Existing independent semantic fixtures cover selected responses; complete retained-source review remains pending.'});
 }
 const language=new Map(advancedLanguage[pack.level].map(r=>[r.id,r]));
 const inputs=new Map([...advancedReading[pack.level],...advancedListening[pack.level]].map(r=>[r.id,r]));
 for(const [id,title,description,languageId,inputId] of advancedUnits[pack.level]){
  const unit={id,title,description,lessons:[compileAdvancedLanguage(language.get(languageId)),compileAdvancedInput(inputs.get(inputId))]},index=pack.units.findIndex(u=>u.id===id);
  if(index<0)pack.units.push(unit);else pack.units[index]=unit;
 }
 pack.phase6Editorial={version:advancedVersion,baselineCommit:'7eeeb36',decisions,additions:advancedUnits[pack.level].map(u=>({unitId:u[0],lessonIds:u.slice(3),decision:'new outcome and source contexts; no prior completion inferred'})),identityPolicy:'Retained goals, targets, question IDs, exact assessed sources and legacy mappings remain. Specified teaching clarification does not award a new skill. Added outcomes carry new identities and no copied completion.',naturalMediaScope:'Attributed authentic recorded interviews and literary excerpts. Supported synthetic language models remain separate; they do not close the natural-audio gate.',nativeItalianEducatorReview:'pending',learnerCalibration:'pending'};
 return pack;
}
