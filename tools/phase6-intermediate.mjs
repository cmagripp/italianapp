// Deterministic, bounded A2/B1 compilation. Meaning-bearing records live in
// phase6-intermediate-lessons.mjs; retained lessons are never rewritten here.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {a2Language,b1Language,a2Input,b1Input,intermediateUnits,W} from './phase6-intermediate-lessons.mjs';
export const intermediateVersion='phase6-intermediate-1';
const sources=['https://www.unistrapg.it/profilo_lingua_italiana/site/index.html','https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4'];
const editorial={version:intermediateVersion,author:'Parola curriculum workstream',sourceRefs:sources,textOrigin:'Original authored teaching, messages and fictional situations; no third-party text copied.',agentReview:'passed independent agent editorial/source-preservation review',agentReviewRecord:'docs/implementation/phase-6/ai-intermediate-review.md',nativeItalianEducatorReview:'pending',learnerCalibration:'pending'};
const senseKey=w=>'phase6-intermediate-sense:'+w.it.normalize('NFC').toLocaleLowerCase('it').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
const link=(entryId,caseId='present')=>({entryId,...entryId.startsWith('v:')?{caseId}:{}});
const forms=(words,id)=>words.map(w=>({id:senseKey(w),it:w.it,en:w.en,firstStepId:id+'.words',...w.article?{article:w.article}:{},...w.plural?{plural:w.plural}:{}}));
const cases={
 'v2-a2-service-appointment':{'v:potere':'condizionale','v:confermare':'present'},
 'v2-a2-service-cancel':{'v:prenotare':'past','v:annullare':'present'},
 'v2-a2-travel-problem':{'v:perdere':'past','v:aspettare':'background'},
 'v2-b1-personal-change':{'v:trasferirsi':'past'},
 'v2-b1-choice-reasons':{'v:preferire':'condizionale'}
};
const listeningModels=new Set(['v2-a2-travel-problem','v2-a2-health-history','v2-b1-choice-reasons','v2-b1-account-help']);
// Additional meanings encountered in the authored messages are deliberately
// glossed before the source; these are local help, not global word acquisition.
const localHelp={
 'v2-a2-service-appointment':[W('fissare','to arrange/set'),W('visita','visit/appointment','la','visite')],
 'v2-a2-listen-appointment-change':[W('spostarla','to reschedule it (the feminine visit)')],
 'v2-a2-shopping-exchange':[W('caricatore','charger','il','caricatori'),W('difettoso','faulty (masculine singular)'),W('articolo','item','l’','articoli'),W('riavere','to get back'),W('cambiarla','to exchange it (a feminine item)')],
 'v2-a2-food-needs':[W('biscotto','biscuit','il','biscotti'),W('biscotti','biscuits'),W('controllo','I check'),W('aspetto','I wait'),W('bevanda','drink','la','bevande')],
 'v2-a2-listen-shop-clarify':[W('noci','walnuts'),W('senza latte','without milk'),W('bevanda','drink','la','bevande')],
 'v2-a2-health-history':[W('scriverle','to write them (the feminine plural instructions)')],
 'v2-a2-read-practical-messages':[W('scriverle','to write them (the feminine plural instructions)')],
 'v2-b1-opinion-clarify':[W('intendo','I mean/intend'),W('intendi','you mean/intend (tu)'),W('intende','he/she means; you mean (Lei)')],
 'v2-b1-listen-followup-account':[W('segnalato','reported (participle)'),W('inviarmelo','to send it to me (a masculine document)'),W('prepararlo','to prepare it (a masculine document)')],
 'v2-b1-group-plan':[W('invitarla','to invite her'),W('visitarlo','to visit it (the masculine museum)')],
 'v2-b1-listen-group-revision':[W('chiedergli','to ask him')],
 'v2-b1-account-help':[W('reimposta','reset (tu command)'),W('reimposti','reset (Lei command)'),W('inserisca','enter/insert (Lei command)'),W('scaduto','expired'),W('includo','I include'),W('privati','private (masculine plural)')],
 'v2-b1-relay-decision':[W('referente','contact person','il/la','referenti')],
 'v2-b1-read-relay-brief':[W('riceverlo','to receive it (a masculine document)'),W('privati','private (masculine plural)')]
};
export function compileIntermediateLanguage(record){
 const id=record.id,words=[...record.words,...localHelp[id]||[]],steps=[{id:id+'.words',kind:'words',title:'Language for this situation',body:'Read the meanings and relevant forms before using the situation. Named whole phrases are taught as chunks where their internal grammar comes later.',words}],targets=[];
 for(const facet of record.facets){
  if(facet.questions.length!==7)throw Error(id+'.'+facet.key+': one guided, two independent and four fresh repair questions required');
  const target=id+'.'+facet.key;
  targets.push({id:target,label:facet.label,explanation:facet.body,facets:[facet.key],minIndependent:2,requiresProduction:true,modality:'language',repair:{title:facet.label,body:facet.body,examples:facet.examples}});
  steps.push({id:id+'.teach-'+facet.key,kind:'teach',title:facet.label,body:facet.body,examples:facet.examples,introduces:[target]},
   {id:id+'.'+facet.key+'-guided',kind:'question',target,facet:facet.key,stage:'guided',contextKey:id+'.'+facet.key+'-guided',...facet.questions[0]});
 }
 const [mode,title,it,en]=record.passage,source=id+'.scene',listen=listeningModels.has(id)||mode==='listen';
 steps.push({id:source,kind:'passage',mode:listen?'listen':'read',title,it,en,task:'Follow how the speaker uses the taught wording. This supported model is separate from the new independent question contexts.',...listen?{audioId:source}:{}});
 // Separate contrasts by intervening use, rather than echoing an answer in an
 // automatic teaching card. A repair is another authored situation.
 for(let round=1;round<7;round++)for(const facet of record.facets){const key=id+'.'+facet.key+'-'+round;
  steps.push({id:key,kind:'question',target:id+'.'+facet.key,facet:facet.key,stage:'independent',contextKey:key,...round>=3?{reserve:true}:{},...facet.questions[round]});
 }
 const [modeApplication,prompt,model,rubric,partnerPrompt]=record.portfolio;
 steps.push({id:id+'.application',kind:'portfolio',title:'Use it in a connected exchange',mode:modeApplication,prompt:prompt+' This is optional practice with self-review; it does not certify open writing, speaking, interaction or mediation.',model,rubric,...partnerPrompt?{partnerPrompt}:{}},
  {id:id+'.recap',kind:'teach',title:'Keep the useful relationship',body:record.facets.map(f=>f.label+'.').join(' ')+' The reserve questions are same-visit repair; a later eligible review checks retained recall.',examples:record.facets.map(f=>f.examples[0]),introduces:[]});
 return {id,title:record.title,outcome:record.outcome,minutes:10,prerequisites:record.prerequisites,related:(record.related||[]).map(entryId=>link(entryId,cases[id]?.[entryId]||'present')),legacyLessonIds:[],takeaway:record.facets.map(f=>f.body).join(' '),targets,steps,editorial:{...editorial},curriculum:{practiceOutcomeScope:'Teaching and optional practice goal; readiness covers the listed controlled targets, not demonstrated open performance.',domains:record.domains,introducedSenses:forms(words,id),forms:record.facets.map(f=>({id:id+'.'+f.key,modelStepId:id+'.teach-'+f.key,description:f.body})),retrievalPolicy:'Existing exact-target scheduler. Listed vocabulary encounters are exposure, and same-visit reserves are repair; only a later eligible attempt establishes retained evidence.'}};
}
export function compileIntermediateInput(record){
 const {id,modality}=record,target=id+'.detail',words=[...record.words,...localHelp[id]||[]];
 const steps=[{id:id+'.words',kind:'words',title:'Language in these sources',body:'Read the meanings before following the source. Use the exact source to answer; a translation or transcript is support.',words},
  {id:id+'.model',kind:'teach',title:'Follow purpose and useful details',body:record.body,examples:[record.model],introduces:[target]}];
 for(const [index,scene] of record.scenes.entries()){
  const source=id+'.source-'+index,reserve=index>=3;
  steps.push({id:source,kind:'passage',mode:modality==='listening'?'listen':'read',title:index?'A different source':'One together',it:scene.it,en:scene.en,task:'Find the source detail requested in the next question.',...modality==='listening'?{audioId:source}:{},...reserve?{reserve:true}:{}},
   {id:id+'.check-'+index,kind:'question',format:'choice',target,facet:'source-detail',modality,stage:index?'independent':'guided',contextKey:source,exposureGroup:source,prompt:scene.prompt,answer:scene.answer,options:scene.options,explanation:scene.explanation,hint:index?'Keep the requested source detail and any condition or uncertainty. Replay or reread if needed.':scene.explanation,speak:scene.it,...modality==='listening'?{audioId:source}:{passageId:source},...reserve?{reserve:true}:{}});
 }
 const [mode,prompt,model,rubric]=record.portfolio;
 steps.push({id:id+'.application',kind:'portfolio',title:'Use the information for a recipient',mode,prompt:prompt+' This is optional practice with self-review; open production and mediation are not graded.',model,rubric},
  {id:id+'.recap',kind:'teach',title:'Preserve what the source actually states',body:'Keep the final action, timeline, quantity, source attribution and uncertainty. Do not add missing details. Reading a listening transcript is recorded assistance.',examples:[record.model],introduces:[]});
 return {id,title:record.title,outcome:record.outcome,minutes:10,prerequisites:record.prerequisites,related:[],legacyLessonIds:[],takeaway:record.body,targets:[{id:target,label:record.assessmentLabel,explanation:record.body,facets:['source-detail'],modality,minIndependent:2,requiresProduction:false,repair:{title:'Follow the requested detail',body:record.body,examples:[record.model]}}],steps,editorial:{...editorial},curriculum:{practiceOutcomeScope:'Teaching and optional practice goal; readiness covers the listed controlled targets, not demonstrated open performance.',domains:record.domains,introducedSenses:forms(words,id),forms:[],retrievalPolicy:'Exact-source reception is separate from later exact-target review and the optional open brief.'}};
}
export function refinePhase6IntermediatePack(pack){
 if(!intermediateUnits[pack.level])return pack;
 const language=new Map((pack.level==='A2'?a2Language:b1Language).map(r=>[r.id,r]));
 const input=new Map((pack.level==='A2'?a2Input:b1Input).map(r=>[r.id,r]));
 for(const source of intermediateUnits[pack.level]){
  const unit={id:source.id,title:source.title,description:source.description,lessons:[...source.language.map(id=>compileIntermediateLanguage(language.get(id))),compileIntermediateInput(input.get(source.input))]},index=pack.units.findIndex(u=>u.id===unit.id);
  if(index<0)pack.units.push(unit);else pack.units[index]=unit;
 }
 pack.curriculumRelease={version:intermediateVersion,scope:'A2/B1 practical connected services, accounts, plans, viewpoints and faithful source use; retained baseline identity preserved.',nativeItalianEducatorReview:'pending',learnerCalibration:'pending',proficiencyClaim:'No certified CEFR claim; portfolios remain optional unassessed production, interaction and mediation.'};
 return pack;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 for(const level of ['A2','B1']){const file=new URL('../data/course-v2/'+level+'.json',import.meta.url),pack=JSON.parse(fs.readFileSync(file));refinePhase6IntermediatePack(pack);fs.writeFileSync(file,JSON.stringify(pack,null,2)+'\n');}
}
