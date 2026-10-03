// Selected form prompts are bound to authored current/prior recipes. Imported
// text is checked against that recipe and is never used as a rendering template.
const canonical=value=>Array.isArray(value)?value.map(canonical):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const stable=value=>JSON.stringify(canonical(value));
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const string=(value,max=500,empty=false)=>typeof value==='string'&&value.length<=max&&(empty||value.length>0);
const integer=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000;
const exactKeys=(value,keys)=>record(value)&&Object.keys(value).every(key=>keys.includes(key));
const questionBuilders=new WeakMap();
// Only trusted full-player callers bind this function; no module load or imported
// session can install a formatter or persist one in the learning data.
export function bindJourneyQuestionBuilder(plan,builder){
 if(record(plan)&&typeof builder==='function')questionBuilders.set(plan,builder);
 return plan;
}
export const journeyQuestionBuilder=plan=>plan&&typeof plan==='object'?questionBuilders.get(plan)||null:null;
const metaKeys=['skill','tense','person','role','variantId','contextId','evidenceScope','scaffoldSkill','supportOnly','answerLanguage'];
const semanticKeys=['type','prompt','answer','say','example','exampleTranslation','tip','lesson','explanation','context','meta','pairs'];
export function journeyFormSemantics(question){
 if(!question)return null;
 return {type:question.type,prompt:question.prompt||'',answer:[...(question.answer||[])],
  ...Object.fromEntries(['say','example','exampleTranslation','tip','lesson','explanation'].map(key=>[key,question[key]||''])),
  context:question.context?{it:question.context.it,en:question.context.en||''}:null,
  meta:Object.fromEntries(metaKeys.map(key=>[key,question.meta?.[key]??null])),
  pairs:(question.pairs||[]).map(pair=>({targetId:pair.targetId,label:pair.label,answers:[...pair.answers],canonical:pair.canonical,question:journeyFormSemantics(pair.question)}))};
}
function validSemantics(value,depth=0){
 return depth<=1&&exactKeys(value,semanticKeys)&&['type','mc','letters','pairs'].includes(value.type)
  &&string(value.prompt,8000,true)&&['say','example','exampleTranslation','tip','lesson','explanation'].every(key=>string(value[key],8000,true))
  &&Array.isArray(value.answer)&&value.answer.length>0&&value.answer.length<=12&&value.answer.every(answer=>string(answer,250))
  &&(value.context===null||exactKeys(value.context,['it','en'])&&string(value.context.it,4000)&&string(value.context.en,4000,true))
  &&exactKeys(value.meta,metaKeys)&&metaKeys.every(key=>value.meta[key]===null||typeof value.meta[key]==='boolean'||Number.isInteger(value.meta[key])&&value.meta[key]>=0&&value.meta[key]<=5||string(value.meta[key],500,true))
  &&Array.isArray(value.pairs)&&value.pairs.length<=4&&value.pairs.every(pair=>exactKeys(pair,['targetId','label','answers','canonical','question'])&&string(pair.targetId)&&string(pair.label,500,true)&&string(pair.canonical,250)&&Array.isArray(pair.answers)&&pair.answers.length<=12&&pair.answers.every(answer=>string(answer,250))&&validSemantics(pair.question,depth+1));
}
export function validJourneyForm(snapshot){
 return exactKeys(snapshot,['version','entryId','targetId','chapterId','sourceRevision','scenePolicy','variant','format','phase','repairTag','descriptor'])&&snapshot.version===1
  &&['entryId','targetId','chapterId','sourceRevision'].every(key=>string(snapshot[key]))&&integer(snapshot.variant)
  &&[null,'expanded-v1'].includes(snapshot.scenePolicy)&&['type','mc','match','letters','pairs'].includes(snapshot.format)
  &&['guided','independent','repair'].includes(snapshot.phase)&&(snapshot.repairTag===null||string(snapshot.repairTag,200))
  &&validSemantics(snapshot.descriptor)&&JSON.stringify(snapshot).length<=32000;
}
export function priorJourneyFormRevision(history,revision){
 const aliases=history?.previousRevisionAliases||[];
 return !!history&&string(revision)&& (revision===history.previousRevision||Array.isArray(aliases)&&aliases.length<=8&&aliases.every(alias=>string(alias))&&aliases.includes(revision));
}
export function journeyFormRecipe(plan,current){
 const history=plan?.questionHistory;if(!history||!current)return null;
 const revision=current.formSnapshot?.sourceRevision??current.questionRevision??current.sceneSnapshot?.sourceRevision??current.sceneRevision??history.previousRevision;
 const prior=priorJourneyFormRevision(history,revision);
 if(!prior&&revision!==history.currentRevision)return null;
 const chapters=prior?(current.scenePolicy==='expanded-v1'?history.chapters:history.ordinaryChapters):plan.chapters;
 const chapter=chapters?.find(c=>c.id===current.chapterId),target=chapter?.groups?.flatMap(g=>g.targets||[]).find(t=>t.id===current.targetId);
 const entry=prior?{...history.entry,_historicalLessonForms:true}:history.currentEntry;
 return entry&&chapter&&target?{entry,chapter,target,prior,revision,history}:null;
}
export function createJourneyForm(plan,current,question){
 const recipe=journeyFormRecipe(plan,current);if(!recipe||!question)return null;
 const snapshot={version:1,entryId:plan.entryId,targetId:current.targetId,chapterId:current.chapterId,sourceRevision:recipe.revision,
  scenePolicy:current.scenePolicy||null,variant:current.variant,format:current.format,phase:current.phase,repairTag:current.repairTag||null,descriptor:journeyFormSemantics(question)};
 return validJourneyForm(snapshot)?snapshot:null;
}
export function journeyFormMatches(snapshot,plan,current,build){
 if(typeof build!=='function'||!validJourneyForm(snapshot)||snapshot.entryId!==plan.entryId||snapshot.targetId!==current.targetId||snapshot.chapterId!==current.chapterId
  ||current.questionRevision!==undefined&&current.questionRevision!==snapshot.sourceRevision
  ||snapshot.variant!==current.variant||snapshot.format!==current.format||snapshot.phase!==current.phase||snapshot.repairTag!==(current.repairTag||null)||snapshot.scenePolicy!==(current.scenePolicy||null))return false;
 const recipe=journeyFormRecipe(plan,{...current,formSnapshot:snapshot});if(!recipe)return false;
 const question=build(recipe.entry,recipe.chapter,recipe.target,{...current,formSnapshot:undefined,questionHistory:undefined,historicalForms:recipe.prior});
 return !!question&&stable(journeyFormSemantics(question))===stable(snapshot.descriptor);
}
export function retiredJourneyForm(snapshot,history){
 if(!validJourneyForm(snapshot)||!priorJourneyFormRevision(history,snapshot.sourceRevision))return false;
 const retired=new Set(history.retiredFormTargetIds||[]),bad=(targetId,descriptor)=>retired.has(targetId)&&descriptor.context===null;
 return bad(snapshot.targetId,snapshot.descriptor)||snapshot.descriptor.pairs.some(pair=>bad(pair.targetId,pair.question));
}
