// Each lexical construction is authored for this verb and sense. Morphology
// supplies only the finite form; an unknown verb never borrows another's lesson.
import { conjugate, splitClitic, MISSING } from '../conjugator.js';
import { VERB_PROGRESSIVE_DATA } from './verb-progressive-data.js';
export { PROGRESSIVE_SOURCES } from './legacy-progressive-content.js';
export const PROGRESSIVE_TENSE = 'presenteProgressivo';
const STARE = ['sto','stai','sta','stiamo','state','stanno'];
const STARE_PAST = ['stavo','stavi','stava','stavamo','stavate','stavano'];
const PRONOUNS = ['mi','ti','si','ci','vi','si'];
const LABELS = ['io','tu','lui / lei','noi','voi','loro'];
const SUBJECTS = [['Io','I'],['Tu','You'],['Lei','She'],['Noi','We'],['Voi','You'],['Loro','They']];
const clean = value => String(value||'').split('|').map(form=>form.trim()).filter(form=>form&&form!==MISSING);
const key = (entry,suffix,chapter='present') => `${entry.id}::lesson::${chapter}::${suffix}`;
const card = (id,title,body,examples=[],forms=[],notes=[]) => ({id,title,body,examples,forms,notes});
const sentence = (...parts) => parts.filter(Boolean).join(' ').replace(/\s+([,.!?])/g,'$1').replace(/[.!?]?$/,'.');
const asExamples = contexts => contexts.map(({it,en})=>({it,en}));
export const progressiveSpec = entry => Object.hasOwn(VERB_PROGRESSIVE_DATA,entry?.inf)?VERB_PROGRESSIVE_DATA[entry.inf]:null;
export function progressiveInfo(entry,{chapter='present'}={}) {
  const spec=progressiveSpec(entry),inf=entry?.inf||'',{base,clitic}=splitClitic(inf);
  let gerund='';try{gerund=clean(conjugate(base,{isc:entry?.isc}).nonFinite.gerundio)[0]||'';}catch{}
  const regular=base.endsWith('are')?base.slice(0,-3)+'ando':/(ere|ire)$/.test(base)?base.slice(0,-3)+'endo':'';
  const persons=spec?.persons||[0,1,2,3,4,5];
  return {supported:!!spec&&spec.policy!=='simple',reviewed:!!spec,policy:spec?.policy||'unreviewed',persons,
    weather:spec?.subjects?.['2']?.[0]==='',formal:spec?.formal!==false&&persons.includes(2),clitic,gerund,
    helperForms:[...(chapter==='background'?STARE_PAST:STARE)],irregular:!!gerund&&gerund!==regular,
    limitation:spec?.note||'This verb needs a reviewed usage lesson before progressive practice is available.',sense:spec?.sense||''};
}
function exactProgressiveForms(scene){
  const forms=scene.answers||[scene.answer];
  return [...new Set(forms.flatMap(form=>{
    // Enclisis is a grammatical alternative for an already-authored clitic
    // construction, not a way to license a new progressive meaning.
    const match=form.match(/^(mi|ti|si|ci|vi|ne|lo|la|li|le|me ne|te ne|se ne|ce ne|ve ne|me la|te la|se la|ce la|ve la) (sto|stai|sta|stiamo|state|stanno|stavo|stavi|stava|stavamo|stavate|stavano) (\p{L}+(?:ando|endo))$/u);
    return match?[form,`${match[2]} ${match[3]}${match[1].replace(/ /g,'')}`]:[form];
  }))];
}
export function progressiveForms(entry,person,{chapter='present'}={}) {
  const spec=progressiveSpec(entry),info=progressiveInfo(entry,{chapter});
  if(!info.supported||!Number.isInteger(person)||!info.persons.includes(person))return [];
  if(spec.progressiveExamples){
    return [...new Set(spec.progressiveExamples.filter(s=>s.person===person).flatMap(exactProgressiveForms))]
      .map(form=>chapter==='background'?pastProgressive(form):form);
  }
  const {clitic,gerund,helperForms}=info;if(!gerund||clitic&&!['si','sene'].includes(clitic))return [];
  const helper=helperForms[person];
  if(clitic==='si')return [`${PRONOUNS[person]} ${helper} ${gerund}`,`${helper} ${gerund}${PRONOUNS[person]}`];
  if(clitic==='sene'){const pron=['me ne','te ne','se ne','ce ne','ve ne','se ne'][person];return [`${pron} ${helper} ${gerund}`,`${helper} ${gerund}${pron.replace(' ','')}`];}
  return [`${helper} ${gerund}`];
}
function pastProgressive(text){return text.replace(/\b(sto|stai|sta|stiamo|state|stanno)\b/gi,word=>STARE_PAST[STARE.indexOf(word.toLowerCase())]);}
function englishProgressive(subject,person,predicate,past=false,formal=false){
  const helper=past?(person===0||person===2&&!formal?'was':'were'):(person===0?'am':person===2&&!formal?'is':'are');
  return `${subject} ${helper} ${predicate}`;
}
function englishPossessive(text,person,formal=false){
  return text.replace(/\{poss\}/g,formal?'your':['my','your','her','our','your','their'][person]);
}
function englishSimple(subject,person,spec,past,formal){
  if(past){
    if(spec.imperfectEn||spec.policy==='simple'){const predicate=(spec.imperfectEn||spec.en[2]).replace(/^was\b/,person===0||person===2&&!formal?'was':'were');return `${subject} ${predicate}`;}
    return `${subject} used to ${spec.en[0]}`;
  }
  const base=spec.en[0];
  const predicate=/^be(?: |$)/.test(base)?base.replace(/^be\b/,person===0?'am':person===2&&!formal?'is':'are'):person===2&&!formal?spec.en[1]:base;
  return `${subject} ${predicate}`;
}
function authoredContexts(entry,{chapter='present',progressive=false,section='practice',legacySelection=false,legacyExpanded=false}={}){
  const spec=progressiveSpec(entry);if(!spec||progressive&&spec.policy==='simple')return [];
  const past=chapter==='background',family=progressive?'progressive':'simple',exact=spec[progressive?'progressiveExamples':'simpleExamples'];
  const make=(scene,index)=>({...scene,answers:scene.answers||[scene.answer],role:scene.role||'ordinary',
    id:`${entry.id}:${chapter}:v2:${family}:scene-${index}`,source:'verb-specific-v2',reviewed:true,contextPolicy:'distinct-scene'});
  // Frames 2–3 are held for the chapter's final review. Extra authored frames
  // (when present) enlarge practice without showing those review situations.
  const selected=index=>section==='all'||(section==='mixed'?legacySelection?index>=2&&index<(spec.legacyFrameCount??spec.frames?.length??exact?.length):index===2||index===3:legacySelection?index<2:index<2||index>=4);
  if(exact){
    return exact.flatMap((scene,index)=>{
      if(scene.section ? section!=='all'&&scene.section!==section : !selected(index))return [];
      if(!past)return [make(progressive?{...scene,answers:exactProgressiveForms(scene)}:scene,index)];
      if(progressive){
        if(scene.past)return [make({...scene,...scene.past,answers:exactProgressiveForms(scene.past)},index)];
        const answers=exactProgressiveForms(scene).map(pastProgressive);
        const it=pastProgressive(scene.it).replace(/\b(ora|adesso)\b/gi,'in quel momento').replace(/\boggi\b/g,'quel giorno');
        const en=scene.en.replace(/\bam\b/g,'was').replace(/\bis\b/g,'was').replace(/\bare\b/g,'were').replace(/\bnow\b/g,'at that moment').replace(/\btoday\b/g,'that day');
        return [make({...scene,it,en,answer:answers[0],answers},index)];
      }
      // Exact idioms require an authored past sentence; don't translate them by
      // string replacement or silently practise the present in the past chapter.
      if(scene.past)return [make({...scene,...scene.past},index)];
      return [];
    });
  }
  let c;try{c=conjugate(entry.inf,{aux:entry.aux,isc:entry.isc});}catch{return [];}
  const people=spec.persons||[0,1,2,3,4,5],roles=people.map(person=>({person,role:'ordinary'}));
  if(spec.formal!==false&&people.includes(2))roles.push({person:2,role:'formal'});
  const frames=legacyExpanded&&spec.legacyExpandedFrames?spec.legacyExpandedFrames:legacySelection&&spec.legacyFrames?spec.legacyFrames:spec.frames;
  return frames.flatMap(([itSuffix,enSuffix],index)=>!selected(index)?[]:roles.flatMap(({person,role})=>{
    const formal=role==='formal',subject=formal?['Signora Rossi, Lei','Ms Rossi, you']:spec.subjects?.[person]||SUBJECTS[person];
    let frameSpec=!legacySelection&&entry.inf==='dire'&&index===0?{...spec,en:['tell','tells','told','telling']}:spec;
    const priorEnglish=legacyExpanded?spec.legacyExpandedEn:legacySelection?spec.legacyEn:null;
    if(priorEnglish)frameSpec={...frameSpec,en:priorEnglish};
    // A reviewed episode can use an ongoing English imperfect without changing
    // the progressive policy. Explicit prior values preserve saved old scenes.
    const priorField=legacyExpanded?'legacyExpandedImperfectEn':legacySelection?'legacyImperfectEn':null;
    if(priorField&&Object.hasOwn(spec,priorField))frameSpec={...frameSpec,imperfectEn:spec[priorField]};
    const answers=progressive?progressiveForms(entry,person,{chapter}):clean(c.tenses[past?'imperfetto':'presente']?.[person]);
    if(!answers.length)return [];
    const it=sentence(subject[0],answers[0],itSuffix);
    const en=englishPossessive(sentence(progressive?englishProgressive(subject[1],person,frameSpec.en[3],past,formal):englishSimple(subject[1],person,frameSpec,past,formal),enSuffix),person,formal);
    return [make({it,en,answer:answers[0],answers,person,role,subjectLabel:!formal&&spec.subjects?.[person]?(subject[0]||'impersonal'):null},`${index}-${person}-${role}`)];
  }));
}
export const progressiveContexts = (entry,options={})=>authoredContexts(entry,{...options,progressive:true});
export const simpleVerbContexts = (entry,options={})=>authoredContexts(entry,{...options,progressive:false});
// A target spanning several people should switch the situation as well as the
// person on consecutive questions. Keep the authored array separately so an
// already-open lesson can reconstruct its original question sequence.
export function variedContextOrder(contexts){
  const buckets=new Map();
  for(const context of contexts){
    const scene=String(context.id||'').replace(/(?::-person-\d+|-\d+-(?:ordinary|formal)|:formal)$/,'');
    if(!buckets.has(scene))buckets.set(scene,[]);
    buckets.get(scene).push(context);
  }
  if(buckets.size<2)return contexts;
  const groups=[...buckets.values()],ordered=[];
  for(let round=0;ordered.length<contexts.length;round++)for(let group=0;group<groups.length;group++){
    const bucket=groups[group];if(round>=bucket.length)continue;
    ordered.push(bucket[(round+group)%bucket.length]);
  }
  return ordered;
}
function contextTarget(entry,chapter,suffix,contexts,{progressive=false,person=null,role='ordinary',finalReview=false,dependsOn=[],legacyContexts=contexts}={}){
  const legacyAuthoredContexts=legacyContexts,ordered=variedContextOrder(contexts),answers=ordered.map(c=>c.answers),tense=progressive?(chapter==='background'?'imperfettoProgressivo':PROGRESSIVE_TENSE):(chapter==='background'?'imperfetto':'presente');
  return {id:key(entry,`v2-${suffix}`,chapter),skill:progressive?'progressive':'context',tense,person,role,required:true,
    available:contexts.length>0,progressive,authoredContexts:true,contextPolicy:'distinct-scene',flowVersion:2,finalReview,dependsOn,
    guidedFormat:person%2?'letters':'mc',evidenceScope:'construction',contexts:ordered,legacyAuthoredContexts,contextIds:ordered.map(c=>c.id),
    explanation:progressiveSpec(entry)?.note||'',answerForms:[...new Set(answers.flat())],answerFormsByVariant:answers,
    exposureFormsByVariant:answers,personsByVariant:ordered.map(c=>c.person),independentVariantCount:new Set(ordered.map(c=>c.id)).size};
}
export function buildProgressiveGroup(entry,{chapter='present',legacyExpanded=false}={}){
  const info=progressiveInfo(entry,{chapter}),past=chapter==='background';
  if(!entry?.id||!info.reviewed)return null;
  const contexts=progressiveContexts(entry,{chapter,legacyExpanded}),legacyContexts=progressiveContexts(entry,{chapter,legacySelection:true}),simple=simpleVerbContexts(entry,{chapter,legacyExpanded});
  const group={id:'progressive',stage:'progressive',title:info.supported?(past?'Happening then':'Happening now'):'Choosing the natural form',cards:[],targets:[]};
  if(!info.supported){
    group.cards.push(card('simple-usage',`${entry.inf} · natural usage`,past?`For ${entry.inf} in the sense “${info.sense}”, use the simple imperfetto for the past state or situation. A different sense can behave differently.`:info.limitation,asExamples(simple.slice(0,2)),[],[
      'English -ing does not always call for stare + gerundio. Use the construction that fits this Italian meaning.'
    ]));
    return group;
  }
  const example=contexts[0],contrast=simple.find(c=>c.person===example?.person&&c.role===example?.role);
  group.cards.push(card('progressive-meaning',`${entry.inf} · ${past?'happening then':'happening now'}`,
    `${info.limitation} ${past?'Stavo + gerundio focuses on an action underway at a past moment. The simple imperfetto can also express an ongoing action, a habit or background.':'The simple present can also describe what is happening now. Stare + gerundio explicitly highlights an action in progress.'}`,
    asExamples([contrast,example].filter(Boolean)),[],[past?'Choose the viewpoint you mean; both forms can describe an ongoing situation.':'A routine normally uses the simple present. The drills label the requested construction so that another valid viewpoint is not treated as a mistake.']));
  group.cards.push(card('progressive-forms',`Build ${example?.answer||info.gerund}`,
    `Regular -are → -ando; -ere and -ire → -endo. ${entry.inf} uses ${info.gerund}.${info.irregular?' This gerundio is an exception to learn.':''}`,
    [],info.persons.map(person=>({label:info.weather?'impersonal':progressiveSpec(entry)?.subjects?.[person]?.[0]|| (person===2&&info.formal?'lui / lei / Lei':LABELS[person]),form:progressiveForms(entry,person,{chapter}).join(' / '),gloss:person===2&&info.formal?'he / she / you · formal':specSubject(entry,person)})),[
      'The gerundio stays the same. Stare carries the person.',...(info.formal?[`Formal Lei uses ${past?'stava':'sta'}, just like lui and lei.`]:[]),
      ...(info.clitic?[`Keep the pronoun with the construction: ${progressiveForms(entry,info.persons[0],{chapter}).join(' or ')}.`]:[])
    ]));
  for(const person of info.persons){
    const scenes=contexts.filter(c=>c.person===person&&c.role!=='formal');
    if(scenes.length)group.targets.push(contextTarget(entry,chapter,`progressive-form-${person}`,scenes,{progressive:true,person,legacyContexts:legacyContexts.filter(c=>c.person===person&&c.role!=='formal')}));
  }
  const formal=contexts.filter(c=>c.role==='formal');
  if(formal.length)group.targets.push(contextTarget(entry,chapter,'progressive-formal',formal,{progressive:true,person:2,role:'formal',legacyContexts:legacyContexts.filter(c=>c.role==='formal')}));
  group.targets.push(
    {id:key(entry,'v2-progressive-gerund',chapter),skill:'progressiveFact',flowVersion:2,tense:past?'imperfettoProgressivo':PROGRESSIVE_TENSE,required:false,supplementalOnly:true,available:true,fact:info.gerund,question:`Gerundio · ${entry.inf}`,distractors:[entry.inf],answerLanguage:'it',answerForms:[info.gerund],independentVariantCount:0},
    {id:key(entry,'v2-progressive-focus',chapter),skill:'progressiveFact',flowVersion:2,tense:past?'imperfettoProgressivo':PROGRESSIVE_TENSE,required:false,supplementalOnly:true,available:true,fact:'An action underway',question:`${past?'Stavo':'Sto'} + gerundio focuses on…`,distractors:['A routine','A completed event'],answerLanguage:'en',answerForms:['An action underway'],independentVariantCount:0}
  );
  return group;
}
function specSubject(entry,person){return progressiveSpec(entry)?.subjects?.[person]?.[1]||SUBJECTS[person][1];}
export function buildVerbMixedGroup(entry,{chapter='present',groups=[],fallbackSimple=[],legacyExpanded=false}={}){
  const info=progressiveInfo(entry,{chapter});if(!info.reviewed)return null;
  const simple=simpleVerbContexts(entry,{chapter,section:'mixed',legacyExpanded}),progressive=progressiveContexts(entry,{chapter,section:'mixed',legacyExpanded});
  const oldSimple=simpleVerbContexts(entry,{chapter,section:'mixed',legacySelection:true}),oldProgressive=progressiveContexts(entry,{chapter,section:'mixed',legacySelection:true});
  const group={id:'mixed-review',stage:'mixed',finalReview:true,title:info.supported?'Use both forms':'Use it in context',cards:[],targets:[]};
  group.cards.push(card('mixed-intro',info.supported?'Now use both forms':'Put it into practice',info.supported?
    `Practise ${entry.inf} in fresh situations. Alternate the ${chapter==='background'?'simple imperfetto':'simple present'} and stare + gerundio. The small label tells you which viewpoint to use.`:
    `Use ${entry.inf} naturally in new situations. ${info.limitation}`,[],[],['If a form needs more practice, we will work on it here before continuing.']));
  const dependencies=progressive=>groups.filter(g=>(g.id==='progressive')===progressive).flatMap(g=>g.targets||[]).filter(t=>t.required!==false&&t.available!==false).map(t=>t.id);
  const simpleScenes=simple.length?simple:fallbackSimple;
  if(simpleScenes.length)group.targets.push(contextTarget(entry,chapter,'mixed-simple',simpleScenes,{finalReview:true,dependsOn:dependencies(false),legacyContexts:oldSimple.length?oldSimple:fallbackSimple}));
  if(progressive.length)group.targets.push(contextTarget(entry,chapter,'mixed-progressive',progressive,{progressive:true,finalReview:true,dependsOn:dependencies(true),legacyContexts:oldProgressive}));
  return group;
}
