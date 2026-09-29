// Journey questions reuse conservative morphology diagnostics, never synthetic sentences.
import { buildQuestion, escapeHTML, expandedForms, wordContext } from './questions.js';
import { lessonContexts, lessonForms, formalLessonForms, lessonExposureForms, lessonEntry, LESSON_CONTENT_VERSION } from './lesson-content.js';
import { conjugate, PERSONS, TENSE_BY_KEY } from '../conjugator.js';
import { withArticle } from '../data.js';
import { WEATHER_VERBS } from './content.js';
const esc=escapeHTML;
const unique=xs=>[...new Set(xs.filter(Boolean))];
const text=(a,b='')=>`<div class="big md">${esc(a)}</div><div class="sub">${esc(b)}</div>`;
function seeded(n){let x=(Number(n)||0)+17;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function choices(q,wrong,recognition,rng){const keys=new Set(q.answer.map(x=>x.toLocaleLowerCase('it')));const pool=unique(wrong).filter(x=>!keys.has(x.toLocaleLowerCase('it'))).slice(0,3);q.type=recognition&&pool.length?'mc':'type';q.choices=q.type==='mc'?[{label:q.answer[0],value:q.answer[0],correct:true},...pool.map(label=>({label,value:label,correct:false}))]:[];for(let i=q.choices.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[q.choices[i],q.choices[j]]=[q.choices[j],q.choices[i]];}return q;}
export function buildJourneyQuestion(entry,chapter,target,{variant=0,format='type',phase='independent',repairTag=null}={}){
 if(!entry?.id||!chapter?.id||!target?.id||target.available===false)return null;
 entry=lessonEntry(entry);
 const v=Math.abs(Math.floor(Number(variant)||0)),rng=seeded(v),kind=entry.inf?'verb':'word';
 const supported=phase!=='independent'||format!=='type';
 const showChoices=supported&&format!=='type';
 const core=['presente','passatoProssimo','futuro'];
 const stageIndex=chapter.id==='present'?0:chapter.id==='past'?1:2;
 const permitted=[...core.slice(0,stageIndex+1),...(chapter.optional&&target.tense?[target.tense]:[])];
 const o={id:target.id,entryId:entry.id,kind,skill:target.skill,tense:target.tense||null,stage:'future',label:target.skill,explanation:''};
 let q;
 const source=target.sourceChapter||chapter.id;
 const contexts=kind==='verb'&&['conjugation','context','address'].includes(target.skill)?lessonContexts(entry,source).filter(c=>target.skill==='context'||c.person===target.person&&c.role===(target.role||'ordinary')):[];
 const smallRepair=phase==='repair'&&['auxiliary','auxiliaryPerson','participle','agreement','clitic'].includes(repairTag);
 if(target.supplementalOnly){
  const time=chapter.id==='past'?'A completed event':chapter.id==='future'?'A future event':'Now or a routine';
  const answer=target.fact||(target.skill==='timeMeaning'?time:'An impersonal weather construction');
  const prompt=target.skill==='timeMeaning'?'Which meaning are we practising in this chapter?':target.skill==='subjectUse'?'In its everyday weather use, what kind of subject does the verb have?':target.skill==='wordFunction'?'Recall the role of the word type taught in this lesson.':'Which pattern matters for the word type taught in this lesson?';
  const wrong=target.skill==='timeMeaning'?['A completed event','A future event','Now or a routine']:target.skill==='subjectUse'?['A person called Lei','A group addressed as voi']:target.skill==='wordFunction'?['An action conjugated for six people.','A number used only for counting.','A noun’s definite article.']:['Always conjugate it in the past.','Always attach a masculine plural ending.'];
  q={prompt:text(prompt),answer:[answer],choices:[],say:'',tip:answer,lesson:answer,example:'',meta:{diagnostic:{kind:'component',component:target.skill},variantId:`${target.id}:fact`,contextId:`${target.id}:fact`,supportOnly:true}};
  choices(q,wrong,true,rng);
 }else if(kind==='verb'&&contexts.length&&format!=='match'&&!smallRepair){
  const context=contexts[v%contexts.length],englishCue=Math.floor(v/contexts.length)%2===1;
  const at=context.it.toLocaleLowerCase('it').indexOf(context.answer.toLocaleLowerCase('it'));if(at<0)return null;
  const e=context.aux?{...entry,aux:context.aux}:entry;
  q=buildQuestion(e,{...o,skill:'conjugation'},{mode:'production',repairPerson:context.person,allowedTenses:permitted,variant:v,rng});if(!q)return null;
  q.answer=context.answers||[context.answer];
  const personCue=context.role==='formal'?'Lei · formal':context.person===1?'tu · informal':context.person===4?'voi · plural':PERSONS[context.person];
  const instruction=`${personCue} · ${TENSE_BY_KEY[target.tense]?.name||target.tense}`;
  q.prompt=englishCue?text(context.en,instruction):`<div class="sub">${esc(context.en)}</div><div class="sentence">${esc(context.it.slice(0,at))}<span class="blank">…</span>${esc(context.it.slice(at+context.answer.length))}</div><div class="sub">${esc(instruction)}</div>`;
  q.example=context.it;q.exampleTranslation=context.en;q.context={it:context.it,en:context.en};q.say=context.it;
  q.lesson=`${context.it} — ${context.en}`;q.tip=`${context.role==='formal'?'Lei means one person addressed politely. ':context.person===1?'Tu means one person addressed informally. ':context.person===4?'Voi addresses more than one person. ':''}Write the complete missing verb form, including its auxiliary or pronoun when needed. ${context.aux?`This construction uses ${context.aux}.`:'Match the person and tense shown.'}`;
  q.meta={...q.meta,skill:target.skill,person:context.person,role:context.role||'ordinary',variantId:`${context.id}:${englishCue?'english-retrieval':'italian-gap'}`,contextId:context.id,evidenceScope:'construction',contextSource:context.source};
  if(q.meta.diagnostic.compound){q.meta.diagnostic.compound.participles=q.answer.map(x=>x.split(' ').at(-1));q.meta.diagnostic.compound.checkAgreement=context.aux==='essere';}
  choices(q,[...(q.meta.diagnostic.personForms||[]).map(x=>x.answer),...(q.meta.diagnostic.tenseForms||[]).map(x=>x.answer)],showChoices,rng);
 }else if(kind==='verb'&&target.skill==='address'&&!smallRepair){
  const female=v%2===0,c=conjugate(entry.inf,{aux:entry.aux,isc:entry.isc});
  let answers=formalLessonForms(entry,target.tense,female);if(!answers.length)return null;
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
  q.meta.supportOnly=true;
 }else if(kind==='verb'){
  const repairContext=smallRepair?contexts[v%contexts.length]:null,e=repairContext?.aux?{...entry,aux:repairContext.aux}:entry;
  const person=repairContext?.person??target.person??(WEATHER_VERBS.has(entry.inf)?2:0),answers=lessonForms(e,target.tense,person);if(!answers.length)return null;
  q=buildQuestion(e,{...o,skill:'conjugation'},{mode:smallRepair||showChoices?'recognition':'production',variant:v,repairPerson:person,repairTag:phase==='repair'?repairTag:null,allowedTenses:permitted,rng});if(!q)return null;
  if(!q.meta.scaffold){
   q.answer=answers;
   const who=WEATHER_VERBS.has(entry.inf)?'impersonal weather use (no personal subject)':target.tense==='imperativo'&&person===2?'Lei (polite singular you)':target.tense==='imperativo'&&person===5?'Loro (very formal plural you)':PERSONS[person];
   const cue=v%2?(target.tense==='imperativo'?['','one listener addressed informally','one listener addressed politely','a group including yourself','several listeners addressed together','several listeners addressed very formally'][person]:['I','you — one person','he / she','we','you — more than one person','they'][person]):who;
   const personCue=person===1?'tu · informal':person===4?'voi · plural':v%2&&!WEATHER_VERBS.has(entry.inf)?cue:who;
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
 q.meta={...q.meta,entryId:entry.id,objectiveId:target.id,targetId:target.id,chapterId:chapter.id,contentVersion:LESSON_CONTENT_VERSION,kind,skill:q.meta?.skill||target.skill,tense:target.tense||null,person:q.meta?.person??target.person??null,role:q.meta?.role||target.role||'ordinary',mode:recognition?'recognition':'production',evidenceMode:recognition?'recognition':'production',activityKind:format==='match'?'matching':phase,evidenceScope:q.meta?.evidenceScope||target.evidenceScope||target.skill};
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
  :kind==='verb'&&observed==='auxiliary'?`${q.answer.join(' / ')} is the auxiliary here. Add the participle to build the complete past form.`
  :kind==='verb'&&observed==='participle'?`${q.answer.join(' / ')} is the past participle of ${entry.inf}. Combine it with the auxiliary for the intended person.`
  :kind==='verb'&&observed==='agreement'?`The ending ${q.answer.join(' / ')} gives the participle the requested gender and number.`
  :kind==='verb'&&observed==='clitic'?`Keep ${q.answer.join(' / ')} with this verb. The pronoun is part of the construction.`
  :target.skill==='address'?'Lei addresses the listener politely; its verb uses third-person singular grammar.'
  :kind==='verb'?`${entry.inf}: ${q.answer.join(' / ')} is the requested ${TENSE_BY_KEY[target.tense]?.name||'verb'} form.`
  :target.skill==='agreement'?`${q.answer.join(' / ')} is the ${target.formLabel||['masculine singular','feminine singular','masculine plural','feminine plural'][target.formIndex]} form. Match the adjective to the noun.`
  :`${entry.it} — ${entry.en}. ${target.skill==='article'?'Learn this article with the noun.':target.skill==='plural'?entry.it===entry.pl?'The noun keeps its spelling; the article shows the plural.':'Notice the plural ending or spelling change.':''}`;
 return q;
}
