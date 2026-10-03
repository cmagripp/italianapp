// Journey questions reuse conservative morphology diagnostics, never synthetic sentences.
import { buildQuestion, escapeHTML, expandedForms, wordContext } from './questions.js';
import { lessonContexts, lessonForms, formalLessonForms, lessonExposureForms, lessonEntry, lessonParticiples, LESSON_CONTENT_VERSION } from './lesson-content.js';
import { conjugate, PERSONS, TENSE_BY_KEY } from '../conjugator.js';
import { withArticle, data } from '../data.js';
import { WEATHER_VERBS } from './content.js';
import { createLetterActivity, createPairActivity } from './lesson-activities.js';
import { progressiveForms, progressiveInfo } from './progressive-content.js';
import { progressiveForms as legacyForms, progressiveInfo as legacyInfo } from './legacy-progressive-content.js';
import { buildShortWordQuestion } from './word-questions.js';
import { journeySceneMatches, retiredJourneyScene } from './journey-scene.js';
import {journeyFormMatches,journeyFormRecipe,retiredJourneyForm} from './journey-form.js';
const esc=escapeHTML;
const scopedSubject=(entry,target,person,options)=>options.historicalForms?null:entry.inf==='bisognare'?'impersonal necessity':entry.inf==='succedere'?(target.subjectLabel||(person===5?'more than one thing':'one thing or situation')):null;
const unique=xs=>[...new Set(xs.filter(Boolean))];
const text=(a,b='')=>`<div class="big md">${esc(a)}</div><div class="sub">${esc(b)}</div>`;
function seeded(n){let x=(Number(n)||0)+17;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function choices(q,wrong,recognition,rng){const keys=new Set(q.answer.map(x=>x.toLocaleLowerCase('it')));const pool=unique(wrong).filter(x=>!keys.has(x.toLocaleLowerCase('it'))).slice(0,3);q.type=recognition&&pool.length?'mc':'type';q.choices=q.type==='mc'?[{label:q.answer[0],value:q.answer[0],correct:true},...pool.map(label=>({label,value:label,correct:false}))]:[];for(let i=q.choices.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[q.choices[i],q.choices[j]]=[q.choices[j],q.choices[i]];}return q;}
export function buildJourneyQuestion(entry,chapter,target,options={}){
 if(options.formSnapshot!==undefined){
  const plan={entryId:entry?.id,chapters:[chapter],questionHistory:options.questionHistory},current={...options,targetId:target?.id,chapterId:chapter?.id};
  if(!journeyFormMatches(options.formSnapshot,plan,current,buildJourneyQuestion)||retiredJourneyForm(options.formSnapshot,options.questionHistory))return null;
  const recipe=journeyFormRecipe(plan,current);
  return buildJourneyQuestion(recipe.entry,recipe.chapter,recipe.target,{...options,formSnapshot:undefined,questionHistory:undefined,historicalForms:recipe.prior});
 }
 const {variant=0,format='type',phase='independent',repairTag=null,scenePolicy,sceneSnapshot}=options;
 const expandedScenes=scenePolicy==='expanded-v1';
 if(!entry?.id||!chapter?.id||!target?.id||target.available===false)return null;
 if(target.shortWord)return buildShortWordQuestion(entry,target,{variant,format,phase,pool:data.vocab||[],pairTargets:target.wordPairTargets||[],chapterId:chapter.id,contentVersion:LESSON_CONTENT_VERSION});
 entry=lessonEntry(options.historicalForms?{...entry,_historicalLessonForms:true}:entry);
 const v=Math.abs(Math.floor(Number(variant)||0)),rng=seeded(v),kind=entry.inf?'verb':'word';
 if(sceneSnapshot!==undefined&&(!expandedScenes||!journeySceneMatches(sceneSnapshot,{entryId:entry.id,chapterId:chapter.id,target,variant:v})))return null;
 if(retiredJourneyScene(sceneSnapshot,target))return null;
 const fixedScene=sceneSnapshot?.context;
 const supported=phase!=='independent'||format!=='type';
 const showChoices=supported&&!['type','letters','pairs'].includes(format);
 const core=['presente','passatoProssimo','imperfetto','futuro','condizionale'];
 const stageIndex=chapter.id==='present'?0:chapter.id==='past'?1:chapter.id==='background'?2:chapter.id==='future'?3:4;
 const permitted=[...core.slice(0,stageIndex+1),...(chapter.optional&&target.tense?[target.tense]:[])];
 const o={id:target.id,entryId:entry.id,kind,skill:target.skill,tense:target.tense||null,stage:'future',label:target.skill,explanation:''};
 let q;
 const source=target.sourceChapter||chapter.id;
 const selectedContexts=expandedScenes?target.contexts:target.legacyAuthoredContexts??target.contexts;
 const contexts=kind==='verb'&&['conjugation','context','address'].includes(target.skill)?(selectedContexts??lessonContexts(entry,source,{expanded:expandedScenes})).filter(c=>target.skill==='context'||c.person===target.person&&c.role===(target.role||'ordinary')):[];
 if(!expandedScenes&&target.retiredExpandedContextIds?.includes(contexts[v%contexts.length]?.id))return null;
 const smallRepair=phase==='repair'&&['auxiliary','auxiliaryPerson','participle','agreement','clitic'].includes(repairTag);
 if(target.progressive){
  const formsFor=target.flowVersion===2?progressiveForms:legacyForms, infoFor=target.flowVersion===2?progressiveInfo:legacyInfo;
  const situations=expandedScenes?target.contexts||[]:target.legacyAuthoredContexts??target.contexts??[];
  const info=infoFor(entry,{chapter:source}),person=fixedScene?.person??situations[v%situations.length]?.person??target.person??0;
  if(target.skill==='progressiveUsage'){
   q={prompt:text(target.usageQuestion),answer:target.usageAnswers,tip:target.explanation,lesson:target.explanation,say:'',meta:{supportOnly:true,answerLanguage:'en',diagnostic:{kind:'component',component:'progressiveUsage'},variantId:`${target.id}:usage`,contextId:`${target.id}:usage`}};
   choices(q,target.usageDistractors||[],true,rng);
  }else{
   const context=fixedScene||situations[v%situations.length],englishCue=sceneSnapshot?.englishCue??(situations.length&&Math.floor(v/situations.length)%2===1);
   const answers=context?.answers||formsFor(entry,person,{chapter:source});if(!answers.length)return null;
   const tenseCue=source==='background'?'stare (imperfetto) + gerundio':'stare (present) + gerundio';
   const who=scopedSubject(entry,target,person,options)||context?.subjectLabel||((context?.role||target.role)==='formal'?'Lei · formal':person===1?'tu · informal':person===4?'voi · plural':info.weather?'impersonal weather use':PERSONS[person]);
   const diagnostic={kind:'progressive',gerund:info.gerund,clitic:info.clitic,person,stareForms:info.helperForms,otherTenseForms:infoFor(entry,{chapter:source==='background'?'present':'background'}).helperForms,personForms:Array.from({length:6},(_,p)=>formsFor(entry,p,{chapter:source}).map(answer=>({person:p,answer}))).flat()};
   q={prompt:text(v%2?entry.en:entry.inf,`${who} · ${tenseCue} · action in progress`),answer:answers,choices:[],say:answers[0],tip:`Use the matching form of stare, then ${info.gerund}. Keep any pronouns with the construction.`,lesson:`${who} → ${answers.join(' / ')}`,example:`${who} → ${answers.join(' / ')}`,meta:{diagnostic,variantId:`${target.id}:cue-${v%2}`,contextId:`${target.id}:form-cue-${v%2}`,evidenceScope:'form'}};
   if(context&&format!=='match'){
    const at=context.it.toLocaleLowerCase('it').indexOf(context.answer.toLocaleLowerCase('it'));if(at<0)return null;
    q.prompt=englishCue?text(context.en,`${who} · ${tenseCue}`):`<div class="sub">${esc(context.en)}</div><div class="sentence">${esc(context.it.slice(0,at))}<span class="blank">…</span>${esc(context.it.slice(at+context.answer.length))}</div><div class="sub">${esc(who)} · ${esc(tenseCue)}</div>`;
    q.answer=context.answers;q.context={it:context.it,en:context.en};q.example=context.it;q.exampleTranslation=context.en;q.say=context.it;
    q.meta.person=context.person;q.meta.role=context.role;q.meta.variantId=`${context.id}:${englishCue?'english-retrieval':'italian-gap'}`;q.meta.contextId=context.id;q.meta.evidenceScope='construction';
   }
   if(phase==='repair'&&['auxiliary','auxiliaryPerson','person','gerund'].includes(repairTag)){
    const gerund=repairTag==='gerund',answer=gerund?info.gerund:diagnostic.stareForms[person];
    q.answer=[answer];q.prompt=text(gerund?`stare + … · ${entry.inf}`:`${who} · … + ${info.gerund}`,gerund?'Recall the gerundio.':'Recall only the form of stare.');
    q.meta={...q.meta,skill:gerund?'gerund':'auxiliary',scaffold:true,scaffoldSkill:gerund?'gerund':'auxiliary',diagnostic:gerund?{kind:'component',component:'gerund'}:{kind:'auxiliary',inflected:true,auxKeys:['stare'],allAuxForms:{stare:diagnostic.stareForms},auxForms:[answer]},variantId:`${target.id}:repair-${gerund?'gerund':'stare'}-${v%2}`};
    delete q.context;q.example=`${who} → ${answers.join(' / ')}`;q.tip=gerund?'The gerundio does not change with the person.':`Stare carries the person: ${info.helperForms.join(', ')}.`;
    choices(q,gerund?[entry.inf]:diagnostic.stareForms,showChoices,rng);
   }else choices(q,diagnostic.personForms.map(x=>x.answer),showChoices,rng);
  }
 }else if(target.supplementalOnly){
  const time=chapter.id==='past'?'A completed event':chapter.id==='future'?'A future event':chapter.id==='background'?'Past habits or background':chapter.id==='condizionale'?'A wish, polite request or hypothetical result':'Now or a routine';
  const answer=target.fact||(target.skill==='timeMeaning'?time:'An impersonal weather construction');
  const prompt=target.question||(target.skill==='timeMeaning'?'Which meaning are we practising in this chapter?':target.skill==='subjectUse'?(target.fact?'In the meaning taught here, what is the grammatical subject?':'In its everyday weather use, what kind of subject does the verb have?'):target.skill==='wordFunction'?'Recall the role of the word type taught in this lesson.':'Which pattern matters for the word type taught in this lesson?');
  const wrong=target.skill==='timeMeaning'?['A completed event','A future event','Past habits or background','A wish, polite request or hypothetical result','Now or a routine']:target.skill==='subjectUse'?['A person called Lei','A group addressed as voi']:target.skill==='wordFunction'?['An action conjugated for six people.','A number used only for counting.','A noun’s definite article.']:['Always conjugate it in the past.','Always attach a masculine plural ending.'];
  q={prompt:text(prompt),answer:[answer],choices:[],say:'',tip:answer,lesson:answer,example:'',meta:{diagnostic:{kind:'component',component:target.skill},variantId:`${target.id}:fact`,contextId:`${target.id}:fact`,supportOnly:true,answerLanguage:target.answerLanguage||'en'}};
  choices(q,target.distractors||wrong,true,rng);
 }else if(kind==='verb'&&contexts.length&&format!=='match'&&!smallRepair){
  const context=fixedScene||contexts[v%contexts.length],englishCue=sceneSnapshot?.englishCue??(Math.floor(v/contexts.length)%2===1);
  const at=context.it.toLocaleLowerCase('it').indexOf(context.answer.toLocaleLowerCase('it'));if(at<0)return null;
  const e=context.aux?{...entry,aux:context.aux}:entry;
  q=buildQuestion(e,{...o,skill:'conjugation'},{mode:'production',repairPerson:context.person,allowedTenses:permitted,variant:v,rng});if(!q)return null;
  q.answer=context.answers||[context.answer];
  const personCue=scopedSubject(entry,target,context.person,options)||context.subjectLabel||(context.role==='formal'?'Lei · formal':context.person===1?'tu · informal':context.person===4?'voi · plural':PERSONS[context.person]);
  const instruction=`${personCue} · ${TENSE_BY_KEY[target.tense]?.name||target.tense}`;
  q.prompt=englishCue?text(context.en,instruction):`<div class="sub">${esc(context.en)}</div><div class="sentence">${esc(context.it.slice(0,at))}<span class="blank">…</span>${esc(context.it.slice(at+context.answer.length))}</div><div class="sub">${esc(instruction)}</div>`;
  q.example=context.it;q.exampleTranslation=context.en;q.context={it:context.it,en:context.en};q.say=context.it;
  q.lesson=`${context.it} — ${context.en}`;q.tip=`${context.role==='formal'?'Lei means one person addressed politely. ':context.person===1?'Tu means one person addressed informally. ':context.person===4?'Voi addresses more than one person. ':''}Write the complete missing verb form, including its auxiliary or pronoun when needed. ${context.aux?`This construction uses ${context.aux}.`:'Match the person and tense shown.'}`;
  q.meta={...q.meta,skill:target.skill,person:context.person,role:context.role||'ordinary',variantId:`${context.id}:${englishCue?'english-retrieval':'italian-gap'}`,contextId:context.id,evidenceScope:'construction',contextSource:context.source};
  if(q.meta.diagnostic.compound){q.meta.diagnostic.compound.participles=q.answer.map(x=>x.split(' ').at(-1));q.meta.diagnostic.compound.checkAgreement=context.aux==='essere';}
  choices(q,[...(q.meta.diagnostic.personForms||[]).map(x=>x.answer),...(q.meta.diagnostic.tenseForms||[]).map(x=>x.answer)],showChoices,rng);
 }else if(kind==='verb'&&target.skill==='address'&&!smallRepair){
  const female=v%2===0,c=conjugate(entry.inf,{aux:entry.aux,isc:entry.isc});
  let answers=options.historicalForms?(target.answerFormsByVariant?.[v%(target.answerFormsByVariant?.length||1)]||target.answerForms||[]):formalLessonForms(entry,target.tense,female);if(!answers.length)return null;
  q=buildQuestion(entry,{...o,skill:'conjugation'},{mode:'production',repairPerson:2,allowedTenses:permitted,variant:v,rng});if(!q)return null;
  q.answer=answers;
  q.prompt=text(`${female?'Signora':'Signor'} Rossi · Lei`, `formal · ${TENSE_BY_KEY[target.tense]?.name||target.tense}`);
  q.example=`Lei → ${answers.join(' / ')}`;q.say=`Lei ${answers[0]}`;
  q.tip='Formal Lei addresses one listener and uses third-person singular grammar. Write the complete verb form without the subject pronoun. With essere, agreement follows the person addressed.';
  q.lesson=q.tip;
  q.meta={...q.meta,skill:'address',person:2,role:'formal',evidenceScope:'form',variantId:`${target.id}:addressee-${female?'female':'male'}`,contextId:`${target.id}:formal-form`};
  if(q.meta.diagnostic.compound){q.meta.diagnostic.compound.participles=answers.map(x=>x.split(' ').at(-1));}
  choices(q,[...(q.meta.diagnostic.personForms||[]).map(x=>x.answer)],showChoices,rng);
 }else if(kind==='verb'&&target.guidedOnly){
  q=buildQuestion(entry,o,{mode:'production',variant:target.skill==='auxiliary'?1:0,repairPerson:target.person,allowedTenses:permitted,rng});if(!q)return null;
  if(target.skill==='participle'){q.answer=options.historicalForms?target.answerForms:lessonParticiples(entry);q.say=q.answer[0]||'';}
  q.meta.supportOnly=true;
 }else if(kind==='verb'){
  const repairContext=smallRepair?fixedScene||contexts[v%contexts.length]:null,e=repairContext?.aux?{...entry,aux:repairContext.aux}:entry;
  const person=repairContext?.person??target.person??(WEATHER_VERBS.has(entry.inf)?2:0),answers=options.historicalForms&&!smallRepair?(target.answerFormsByVariant?.[v%(target.answerFormsByVariant?.length||1)]||target.answerForms||[]):lessonForms(e,target.tense,person);if(!answers.length)return null;
  q=buildQuestion(e,{...o,skill:'conjugation'},{mode:smallRepair||showChoices?'recognition':'production',variant:v,repairPerson:person,repairTag:phase==='repair'?repairTag:null,allowedTenses:permitted,rng});if(!q)return null;
  if(!q.meta.scaffold){
   q.answer=answers;
   const who=target.subjectLabel|| (WEATHER_VERBS.has(entry.inf)?'impersonal weather use (no personal subject)':target.tense==='imperativo'&&person===2?'Lei (polite singular you)':target.tense==='imperativo'&&person===5?'Loro (very formal plural you)':PERSONS[person]);
   const cue=v%2?(target.tense==='imperativo'?['','one listener addressed informally','one listener addressed politely','a group including yourself','several listeners addressed together','several listeners addressed very formally'][person]:['I','you — one person','he / she','we','you — more than one person','they'][person]):who;
   const personCue=target.subjectLabel|| (person===1?'tu · informal':person===4?'voi · plural':v%2&&!WEATHER_VERBS.has(entry.inf)?cue:who);
   q.prompt=text(format==='match'?`Match · ${who}`:WEATHER_VERBS.has(entry.inf)&&v%2?entry.en:entry.inf,`${personCue} · ${TENSE_BY_KEY[target.tense]?.name||target.tense}`);
   q.example=WEATHER_VERBS.has(entry.inf)?answers.join(' / '):`${who} → ${answers.join(' / ')}`;
   q.meta.variantId=`${target.id}:cue-${v%2}`;q.meta.contextId=`${target.id}:form-cue-${v%2}`;
   choices(q,[...(q.meta.diagnostic.personForms||[]).map(x=>x.answer),...(q.meta.diagnostic.tenseForms||[]).map(x=>x.answer)],showChoices,rng);
  }
  q.meta.evidenceScope='form';
 }else if(target.skill==='agreement'){
  const i=target.formIndex??0,answer=target.answerForm||entry.forms?.[i];if(!answer)return null;
  const labels=['masculine singular','feminine singular','masculine plural','feminine plural'];
  q={prompt:text(v%2&&entry.exEn?entry.exEn:entry.en,`${target.formLabel||labels[i]} · adjective`),answer:[answer],choices:[],say:answer,tip:'Match the stated gender and number. Some adjective forms are identical.',lesson:`${entry.it}: ${entry.forms?.join(' · ')||entry.note||answer}`,example:`${target.formLabel||labels[i]} → ${answer}`,meta:{diagnostic:{kind:'adjective'},variantId:`${target.id}:cue-${v%2}`,contextId:`${target.id}:agreement-${i}`}};
  choices(q,entry.forms||[],showChoices,rng);
 }else{
  q=buildQuestion(entry,o,{mode:showChoices?'recognition':'production',variant:v,pool:[],rng});if(!q)return null;
  if(target.skill==='recall'&&chapter.id==='meaning'){
   q=buildQuestion(entry,o,{mode:showChoices?'recognition':'production',variant:0,pool:[],rng});
   if(v%2&&entry.exEn){q.prompt=text(entry.exEn,`Italian for “${entry.en}”`);q.meta.variantId=`${target.id}:dictionary-form-from-situation`;q.meta.contextId=`${target.id}:dictionary-example`;}
  }
  // The source example is the only authored context. Whole-sentence dictation
  // would measure unrelated grammar, so listening always targets the learned item.
  if(target.skill==='listening'&&!wordContext(entry)){q=buildQuestion(entry,o,{mode:showChoices?'recognition':'production',variant:0,pool:[],rng});q.meta.variantCount=1;}
  if(target.skill==='plural'&&entry.g&&entry.pl===entry.it){q=buildQuestion(entry,o,{mode:showChoices?'recognition':'production',variant:1,pool:[],rng});q.prompt=text(v%2?entry.it:withArticle(entry),'Plural · include the article');q.meta.variantId=`${target.id}:invariant-${v%2?'bare-cue':'singular-phrase'}`;}
  if(entry.pos==='noun'&&!entry.g){
   if(target.skill==='plural'){q.answer=[entry.pl];q.prompt=text(v%2?entry.en:entry.it,'Plural · noun only');q.meta.variantId=`${target.id}:bare-plural-${v%2?'meaning':'singular'}`;q.meta.diagnostic={kind:'plural',plural:entry.pl,requiresArticle:false};choices(q,[entry.it],showChoices,rng);}
   if(['recall','listening','context'].includes(target.skill)){q.answer=q.answer.filter(f=>[entry.it,wordContext(entry)?.form].includes(f));if(q.meta.diagnostic)q.meta.diagnostic.noun=false;}
  }
  if(target.skill==='context'){q.meta.evidenceScope='context';q.context={it:entry.ex,en:entry.exEn||''};q.exampleTranslation=entry.exEn||'';}
  q.choices=(q.choices||[]).map(c=>({...c,value:c.label}));
 }
 if(kind==='word'&&target.skill==='meaning'&&v%2&&entry.ex) q.prompt=q.prompt.replace('class="big md"','class="sentence"');
 if(format==='type'&&!q.meta?.supportOnly){q.type='type';q.choices=[];}
 if(q.type==='mc')q.prompt=q.prompt.replace(/Write the whole/gi,'Choose the whole').replace(/write the whole/gi,'choose the whole').replace(/Write only/gi,'Choose only').replace(/Write this/gi,'Choose this').replace(/Supply only/gi,'Choose').replace(/Give the/gi,'Choose the').replace(/Answer in English/gi,'Choose the English meaning');
 const recognition=supported||!!q.meta?.scaffold||!!q.meta?.supportOnly;
 q.meta={...q.meta,...(target.contextPolicy?{contextPolicy:target.contextPolicy}:{}),...(scenePolicy?{scenePolicy}:{}),...(sceneSnapshot?{sceneRevision:sceneSnapshot.sourceRevision}:{}),entryId:entry.id,objectiveId:target.id,targetId:target.id,chapterId:chapter.id,contentVersion:LESSON_CONTENT_VERSION,kind,skill:q.meta?.skill||target.skill,tense:target.tense||null,person:q.meta?.person??target.person??null,role:q.meta?.role||target.role||'ordinary',mode:recognition?'recognition':'production',evidenceMode:recognition?'recognition':'production',activityKind:format==='match'?'matching':phase,evidenceScope:q.meta?.evidenceScope||target.evidenceScope||target.skill};
 if(kind==='verb'&&target.authoredContexts&&!q.meta.scaffold&&Number.isInteger(q.meta.person)){
  const counterparts=target.progressive?lessonForms(entry,source==='background'?'imperfetto':'presente',q.meta.person):progressiveForms(entry,q.meta.person,{chapter:source});
  q.meta.diagnostic={...q.meta.diagnostic,counterpartForms:counterparts,viewpointMessage:target.progressive?
    'That simple form can be valid Italian. This prompt asks you to make the ongoing viewpoint explicit with stare + gerundio.':
    `That progressive form can be valid Italian. This prompt asks for the simple ${source==='background'?'imperfetto':'present'} form.`};
 }
 q.id=`${target.id}:${q.meta.variantId}`;
 q.meta.exposureForms=lessonExposureForms(entry,q.answer,target.skill);
 q.meta.promptExposureForms=[];q.meta.feedbackExposureForms=[];
 if(kind==='word'&&!target.supplementalOnly){
  const ctx=wordContext(entry);
  if(target.skill==='meaning')q.meta.promptExposureForms=[entry.it,...(v%2&&ctx?[ctx.form]:[])];
  if(target.skill==='article')q.meta.promptExposureForms=[q.meta.number==='plural'?entry.pl:entry.it];
  if(target.skill==='plural'&&(entry.g||v%2===0))q.meta.promptExposureForms=[entry.it,...(entry.g&&(entry.it===entry.pl?v%2===0:v%2===1)?[withArticle(entry)]:[])];
  if(target.skill==='context'&&v%2===0&&ctx){const visible=ctx.before+ctx.after;if(visible.toLocaleLowerCase('it').includes(entry.it.toLocaleLowerCase('it')))q.meta.promptExposureForms=[entry.it];}
  q.meta.feedbackExposureForms=[entry.it,entry.en,...entry.en.split(';').map(s=>s.trim())];
 }
 const observed=q.meta.scaffoldSkill||q.meta.skill;
 q.explanation=target.supplementalOnly?q.answer[0]
  :q.context?`${q.context.it} — ${q.context.en}${q.meta.role==='formal'?' Lei addresses the listener politely and takes third-person singular.':''}`
  :target.progressive&&observed==='auxiliary'?`${q.answer.join(' / ')} is the form of stare for this person. Add the unchanged gerundio to express the ongoing action.`
  :target.progressive&&observed==='gerund'?`${q.answer.join(' / ')} is the gerundio. It does not change for person, gender or number.`
  :kind==='verb'&&observed==='auxiliary'?`${q.answer.join(' / ')} is the auxiliary here. Add the participle to build the complete past form.`
  :kind==='verb'&&observed==='participle'?`${q.answer.join(' / ')} is the past participle of ${entry.inf}. Combine it with the auxiliary for the intended person.`
  :kind==='verb'&&observed==='agreement'?`The ending ${q.answer.join(' / ')} gives the participle the requested gender and number.`
  :kind==='verb'&&observed==='clitic'?`Keep ${q.answer.join(' / ')} with this verb. The pronoun is part of the construction.`
  :target.skill==='address'?'Lei addresses the listener politely; its verb uses third-person singular grammar.'
  :kind==='verb'?`${entry.inf}: ${q.answer.join(' / ')} is the requested ${TENSE_BY_KEY[target.tense]?.name||'verb'} form.`
  :target.skill==='agreement'?`${q.answer.join(' / ')} is the ${target.formLabel||['masculine singular','feminine singular','masculine plural','feminine plural'][target.formIndex]} form. Match the adjective to the noun.`
  :`${entry.it} — ${entry.en}. ${target.skill==='article'?'Learn this article with the noun.':target.skill==='plural'?entry.it===entry.pl?'The noun keeps its spelling; the article shows the plural.':'Notice the plural ending or spelling change.':''}`;
 if(target.finalReview&&q.context)q.explanation+=target.progressive?' Stare carries the person; the gerundio highlights the ongoing action.':` Here the label requests the simple ${source==='background'?'imperfetto':'present'} form.`;
 if(format==='letters')return createLetterActivity(q,{seed:v});
 if(format==='pairs'){
  const group=chapter.groups?.find(g=>g.targets?.some(t=>t.id===target.id));
  const eligible=(group?.targets||[]).filter(t=>t.available!==false&&!t.supplementalOnly&&!t.guidedOnly&&['conjugation','address','progressive'].includes(t.skill)&&Number.isInteger(t.person));
  if(kind==='verb'&&eligible.length>=3&&eligible.some(t=>t.id===target.id)){
   const start=eligible.findIndex(t=>t.id===target.id),selected=[...eligible.slice(start),...eligible.slice(0,start)].slice(0,3);
   const pairs=selected.map(t=>({targetId:t.id,label:(!options.historicalForms&&['v:succedere','v:bisognare'].includes(entry.id)&&t.subjectLabel)|| (t.role==='formal'?`Lei · formal${TENSE_BY_KEY[t.tense]?.compound?` (${v%2?'man':'woman'})`:''}`:t.role==='formalPlural'?'Loro · formal plural':t.person===1?'tu · informal':t.person===4?'voi · plural':PERSONS[t.person]),question:buildJourneyQuestion(entry,chapter,t,{variant:v,format:'match',phase:'guided',historicalForms:options.historicalForms,...(Object.hasOwn(options,'scenePolicy')?{scenePolicy}:{})})}));
   return createPairActivity(q,pairs,{seed:v});
  }
 }
 return q;
}
