import {grammarLesson,grammarCourse} from './grammar-course.js';
import {currentCourseStep} from './course-v2-engine.js';
import {labLesson,labStageOf} from './sentence-lab-data.js';
import {sourceFingerprint} from '../ai/source-fingerprint.js';
import {COURSE_SENSE_LINKS} from './course-sense-links.js';
import {fillTemplate} from './sentence-lab.js';

const copy=value=>structuredClone(value),equal=(a,b)=>sourceFingerprint(a)===sourceFingerprint(b);
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const tokens=value=>String(value||'').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}']+/gu,' ').trim().split(/\s+/).filter(Boolean);
function relevantWorkshopExample(example,blank,template,blankIndex){
 const pieces=String(template||'').split(/_{2,}/),before=tokens(pieces[blankIndex]).slice(-2),after=tokens(pieces[blankIndex+1]).slice(0,2),words=tokens(example.it);
 while(['e','o','ma'].includes(before[0]))before.shift();
 return (blank.accept||[]).some(answer=>{
  const phrase=tokens(answer);if(!phrase.length||phrase.join('').length<2)return false;
  for(let at=0;at<=words.length-phrase.length;at++){
   if(!phrase.every((word,index)=>word===words[at+index]))continue;
   if(before.length&&!before.every((word,index)=>word===words[at-before.length+index]))continue;
   if(after.length&&!after.every((word,index)=>word===words[at+phrase.length+index]))continue;
   if(before.length||after.length||words.length===phrase.length)return true;
  }return false;
 });
}
const stageLevel={presente:'A1',passato:'A2',futuro:'B1',strutture:'B2'};
const within=value=>sourceFingerprint(value)?.length<=15000;
const editorial=lesson=>({reviewStatus:lesson.editorial?.agentReview||'authored source; independent editorial review not recorded',reviewRecord:lesson.editorial?.agentReviewRecord||null,nativeItalianEducatorReview:lesson.editorial?.nativeItalianEducatorReview||'not recorded'});
function example({id,it,en='',revision,level,lesson,category='authored-lesson-example',attribution=null,locator}){
 if(typeof it!=='string'||!it.trim())return null;
 // A bounded exact excerpt retains its offsets and attribution. Truncation
 // never silently becomes a newly authored complete sentence.
 let end=it.length;if(end>1800){const boundary=it.slice(0,1800).lastIndexOf('.');end=boundary>400?boundary+1:1800;category='source-excerpt';}
 return {kind:'authored-example',id,it:it.slice(0,end),en:end===it.length&&typeof en==='string'&&en.length<=1800?en:'',level,sourceValidated:true,sourceRevision:revision,
  sourceCategory:category,attribution:attribution?copy(attribution):null,sourceLocator:{...locator,...end<it.length?{start:0,end}:{}},...editorial(lesson)};
}
const compactReferences=values=>values.filter(Boolean).slice(0,2);
const bindingSource=source=>({sourceId:source.sourceId,canonical:source.canonical,references:source.references,revisionScope:source.revisionScope});
const sourcesFor=lesson=>{const packs=lesson.contentVersion===2?grammarCourse.levels:grammarCourse.legacyLevels,pack=packs.find(pack=>pack.level===lesson.level);return {version:lesson.contentVersion,path:pack?.path||`${lesson.contentVersion===2?'data/course-v2':'data/grammar-course'}/${lesson.level}.json`,editorialVersion:lesson.editorial?.version||null};};

function explicitWorkshopExamples({activity,blanks,blank,selection,revision,level,lesson}){
 const authored=blank.sourceExamples;
 if(!Array.isArray(authored)||!authored.length||authored.length>8)return [];
 const fields=['agreement','values','en','subjectAgreement','subjectScope','sourceNote','it','reviewStatus','reviewRecord','reviewScope','nativeItalianEducatorReview'];
 const applicable=[];
 for(const [index,ex] of authored.entries()){
  if(!record(ex)||Object.keys(ex).length!==fields.length||fields.some(field=>!Object.hasOwn(ex,field))||
   !['m','f','any'].includes(ex.agreement)||!Array.isArray(ex.values)||ex.values.length!==blanks.blanks.length||
   ex.values.some((value,at)=>typeof value!=='string'||!(blanks.blanks[at].accept||[]).includes(value))||
   typeof ex.it!=='string'||ex.it.length>1800||ex.it!==fillTemplate(blanks.template,ex.values)||
   typeof ex.en!=='string'||!ex.en.trim()||ex.en.length>1800||
   ![null,'m','f','male-or-mixed-group','f-group'].includes(ex.subjectAgreement)||![null,'speaker','group','other'].includes(ex.subjectScope)||
   !(ex.sourceNote===null||typeof ex.sourceNote==='string'&&ex.sourceNote.length<=1000)||
   ex.reviewStatus!=='independent-agent-review'||ex.reviewScope!=='chosen-form-translation-agreement'||
   typeof ex.reviewRecord!=='string'||!ex.reviewRecord.startsWith('docs/implementation/')||ex.reviewRecord.length>300||
   ex.nativeItalianEducatorReview!=='pending')return [];
  // An invariant blank cannot turn a fixed male quote into the feminine
  // learner's own sentence. Group and other subjects remain independent.
  if(ex.subjectScope==='speaker'&&['m','f'].includes(ex.subjectAgreement)&&ex.agreement!==ex.subjectAgreement)return [];
  if(ex.agreement!=='any'&&ex.agreement!==selection.agreement)continue;
  const id=activity.id+':turn-'+(selection.turnIndex??'cloze')+':blank-'+selection.blankIndex+':example-'+index;
  const ref=example({id,it:ex.it,en:ex.en,revision,level,lesson,locator:{activityId:activity.id,turnIndex:selection.turnIndex,blankIndex:selection.blankIndex,field:'sourceExamples',index}});
  applicable.push({...ref,reviewStatus:ex.reviewStatus,reviewRecord:ex.reviewRecord,reviewScope:ex.reviewScope,nativeItalianEducatorReview:ex.nativeItalianEducatorReview,
   applicability:ex.agreement,subjectAgreement:ex.subjectAgreement,subjectScope:ex.subjectScope,sourceNote:ex.sourceNote});
 }
 return compactReferences(applicable);
}
function courseSelection(lesson,selection){
 if(!record(selection)||!['step','guided','recheck','repair'].includes(selection.phase)||!Number.isSafeInteger(selection.stepIndex)||selection.stepIndex<0||selection.stepIndex>=lesson.steps.length)return null;
 const view=currentCourseStep(lesson,{courseV2:{...selection,historyCursor:null,history:[],result:null}});
 return view?.step&&!view.viewOnly&&['teach','question','repair','portfolio'].includes(view.step.kind)?view:null;
}
function courseSource(lesson,selection){
 const view=courseSelection(lesson,selection);if(!view)return null;const step=view.step,revision=`course:${lesson.contentVersion}:${step.id}`,level=lesson.level,references=[];
 const add=(it,en,locator,attribution=null)=>references.push(example({id:locator.stepId,it,en,revision,level,lesson,locator,attribution,category:attribution?'source-excerpt':'authored-lesson-example'}));
 if(step.speak)add(step.speak,step.translation||'',{stepId:step.id,field:'speak'});
 else if(step.kind==='portfolio'&&step.model)add(step.model,'',{stepId:step.id,field:'model'});
 else for(const [index,ex] of (step.examples||[]).entries())add(ex.it,ex.en||'',{stepId:step.id,field:'examples',index});
 const passageCandidates=lesson.steps.filter(source=>source.kind==='passage'&&(step.passageId?source.id===step.passageId:step.audioId&&source.audioId===step.audioId));
 const passage=passageCandidates.length===1?passageCandidates[0]:null;
 if(passage&&references.length<2)add(passage.it,passage.en,{stepId:passage.id,field:'it'},passage.source||lesson.editorial?.authenticText||null);
 if(!references.length&&step.target){
  const before=lesson.steps.indexOf(lesson.steps.find(source=>source.id===step.id));
  const teaching=lesson.steps.filter((source,index)=>source.kind==='teach'&&source.introduces?.includes(step.target)&&(before<0||index<=before)).at(-1);
  for(const [index,ex] of (teaching?.examples||[]).entries())add(ex.it,ex.en||'',{stepId:teaching.id,field:'examples',index});
 }
 return {sourceId:`course:${lesson.id}:${step.id}`,prompt:String(step.prompt||step.task||step.body||step.title||lesson.title).slice(0,4000),
  context:JSON.stringify({body:step.body,context:step.context,translation:step.translation,examples:step.examples,source:passage?{it:passage.it,en:passage.en}:null}).slice(0,4000),
  canonical:copy(step),target:copy(view.target||null),references:compactReferences(references),revisionScope:sourcesFor(lesson)};
}
export function createCoursePracticeBinding({lesson,session}){
 const c=session?.courseV2;if(!lesson||!c||c.paused||c.historyCursor!==null)return null;
 const selection={phase:c.phase,stepIndex:c.stepIndex,activeQuestionId:c.activeQuestionId||null,activeTargetId:c.activeTargetId||null,activeFacet:c.activeFacet||null};
 const source=courseSource(lesson,selection);if(!source||!source.references.length)return null;
 const binding={version:1,kind:'course',lessonId:lesson.id,selection,...bindingSource(source)};return within(binding)?binding:null;
}

function grammarSource(lesson,selection){
 if(!record(selection)||!['teach','question','repair'].includes(selection.phase))return null;
 const objective=lesson.objectives?.find(objective=>objective.id===selection.objectiveId);if(!objective)return null;
 let canonical,question=null,card=null;
 if(selection.phase==='question')question=objective.questions.find(question=>question.id===selection.questionId);
 else if(selection.phase==='teach'&&Number.isSafeInteger(selection.teachIndex))card=objective.teach[selection.teachIndex];
 else if(selection.phase==='repair'&&selection.repairQuestionId)question=objective.questions.find(question=>question.id===selection.repairQuestionId);
 if(selection.phase==='question'&&!question||selection.phase==='teach'&&!card||selection.phase==='repair'&&!question)return null;
 canonical=selection.phase==='question'?question:card||{label:objective.label,explanation:objective.explanation,repairQuestion:copy(question)};
 const revision=`grammar:${lesson.contentVersion}:${objective.id}:${selection.phase}`,refs=[];
 if(question?.speak)refs.push(example({id:question.id,it:question.speak,en:question.translation||'',revision,level:lesson.level,lesson,locator:{questionId:question.id,field:'speak'}}));
 else if(card)for(const [index,ex] of (card.examples||[]).entries())refs.push(example({id:objective.id,it:ex.it,en:ex.en||'',revision,level:lesson.level,lesson,locator:{objectiveId:objective.id,teachIndex:selection.teachIndex,field:'examples',index}}));
 else for(const [index,ex] of (objective.teach[0]?.examples||[]).entries())refs.push(example({id:objective.id,it:ex.it,en:ex.en||'',revision,level:lesson.level,lesson,locator:{objectiveId:objective.id,teachIndex:0,field:'examples',index}}));
 const sourceId=`grammar:${lesson.id}:${objective.id}:${selection.phase==='question'?question.id:selection.phase+':'+selection.teachIndex}`;
 return {sourceId,prompt:canonical.prompt||canonical.body||canonical.explanation||canonical.label||lesson.title,
  context:JSON.stringify({context:selection.phase==='question'?question.context:undefined,translation:selection.phase==='question'?question.translation:undefined,examples:card?.examples}),canonical:copy(canonical),references:compactReferences(refs),revisionScope:sourcesFor(lesson)};
}
export function createGrammarPracticeBinding({lesson,session}){
 const g=session?.grammar,objective=lesson?.objectives?.[g?.objectiveIndex];if(!objective||g.paused||g.historyCursor!==null||g.phase==='complete')return null;
 const question=objective.questions.find(question=>question.id===g.questionId)||objective.questions[g.questionIndex%objective.questions.length];
 const selection={phase:g.phase,objectiveId:objective.id,questionId:question?.id||null,teachIndex:g.teachIndex,repairQuestionId:g.repairQuestion||null};
 const source=grammarSource(lesson,selection);if(!source||!source.references.length)return null;
 const binding={version:1,kind:'grammar',lessonId:lesson.id,selection,...bindingSource(source)};return within(binding)?binding:null;
}

function workshopSource(lesson,stage,selection){
 if(!record(selection)||Object.keys(selection).length!==4||!['activityIndex','turnIndex','blankIndex','agreement'].every(key=>Object.hasOwn(selection,key))||!Number.isSafeInteger(selection.activityIndex)||selection.activityIndex<0||!Number.isSafeInteger(selection.blankIndex)||selection.blankIndex<0||!['m','f'].includes(selection.agreement))return null;
 const activity=lesson.activities?.[selection.activityIndex];if(!activity||!['cloze','dialogue'].includes(activity.kind)||activity.kind==='cloze'&&selection.turnIndex!==null||activity.kind==='dialogue'&&(!Number.isSafeInteger(selection.turnIndex)||selection.turnIndex<0||selection.turnIndex>=activity.turns.length))return null;
 const turn=activity.kind==='dialogue'&&Number.isSafeInteger(selection.turnIndex)?activity.turns[selection.turnIndex]:null;
 const blanks=activity.kind==='cloze'?activity:turn?.speaker==='you'?turn:null,blank=blanks?.blanks?.[selection.blankIndex];if(!blank?.free)return null;
 const revision='workshop:'+stage.version+':'+activity.id,level=lesson.level||stageLevel[stage.stage];
 let references;
 if(Object.hasOwn(blank,'sourceExamples'))references=explicitWorkshopExamples({activity,blanks,blank,selection,revision,level,lesson});
 else{
  const model=lesson.activities.slice(0,selection.activityIndex+1).filter(activity=>activity.kind==='model').at(-1);
  const allExamples=(activity.examples||model?.examples||[]).map((ex,index)=>({ex,index})),matched=allExamples.filter(({ex})=>relevantWorkshopExample(ex,blank,blanks.template,selection.blankIndex));
  references=compactReferences(matched.map(({ex,index})=>example({id:(activity.examples?activity:model)?.id||activity.id,it:ex.it,en:ex.en||'',revision,level,lesson,locator:{activityId:(activity.examples?activity:model)?.id||activity.id,field:'examples',index}})));
 }
 return {sourceId:`lab:${lesson.id}:${selection.activityIndex}:${activity.kind==='dialogue'?selection.turnIndex:'cloze'}:${selection.blankIndex}`,
  prompt:`Find just the wording for this blank in the sentence: ${blanks.template}. ${blanks.en||''}`,context:JSON.stringify({slot:blank.slot,help:blank.freePrompt||'',lesson:lesson.title,speakerAgreement:selection.agreement}),canonical:copy(activity),references,
  revisionScope:{version:stage.version,path:`data/sentence-lab/${stage.stage}.json`,stage:stage.stage}};
}
export function createWorkshopPracticeBinding({lesson,stage,session,blankIndex,agreement=session?.speakerAgreement}){
 if(!lesson||!stage||session?.phase!=='activity'||session.paused||session.state?.result)return null;
 const selection={activityIndex:session.index,turnIndex:session.state?.kind==='dialogue'?session.state.turnIndex:null,blankIndex,agreement};
 const source=workshopSource(lesson,stage,selection);if(!source||!source.references.length)return null;
 const binding={version:1,kind:'workshop',lessonId:lesson.id,selection,...bindingSource(source)};return within(binding)?binding:null;
}

export function createAuthoredPracticeResolver({lookupGrammar=grammarLesson,lookupWorkshop=labLesson,lookupWorkshopStage=labStageOf}={}){
 return {resolve(binding,{request}={}){
  if(binding?.version!==1||!['course','grammar','workshop'].includes(binding.kind)||!within(binding))return null;
  let source;
  if(binding.kind==='workshop'){
   const lesson=lookupWorkshop(binding.lessonId),stage=lookupWorkshopStage(binding.lessonId);if(!lesson||!stage||request&&request.agreement!==binding.selection?.agreement)return null;
   source=workshopSource(lesson,stage,binding.selection);
  }else{
   const lesson=lookupGrammar(binding.lessonId);if(!lesson||binding.kind==='course'&&lesson.contentVersion!==2||binding.kind==='grammar'&&lesson.contentVersion===2)return null;
   source=binding.kind==='course'?courseSource(lesson,binding.selection):grammarSource(lesson,binding.selection);
  }
  if(!source||!equal(binding,{version:1,kind:binding.kind,lessonId:binding.lessonId,selection:binding.selection,...bindingSource(source)}))return null;
  const selectedWords=tokens([source.canonical.context||'',source.canonical.speak||'',...source.references.map(reference=>reference.it)].join('\n'));
  const senseEntryIds=binding.kind==='course'?COURSE_SENSE_LINKS.filter(link=>{
   const phrase=tokens(link.it),appears=selectedWords.some((_,at)=>phrase.every((word,index)=>word===selectedWords[at+index]));
   return link.lessonId===binding.lessonId&&link.status==='independent-agent-context-review-passed'&&link.sourceStepIds.every(id=>lookupGrammar(binding.lessonId).steps.some(step=>step.id===id))&&appears;
  }).map(link=>link.entryId):[];
  return {version:'canonical-authored-practice-v1',bindingFingerprint:sourceFingerprint(binding),...source,senseEntryIds,senses:[],rules:[]};
 }};
}
