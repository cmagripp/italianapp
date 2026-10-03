#!/usr/bin/env node
// Reproducible Phase 0/1 inventory. This tool never rewrites teaching packs or learner data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolveLessonWords, wordsCheckPlan } from '../js/learning/course-words.js';
import { conjugate, PERSONS, TENSES, MISSING } from '../js/conjugator.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const programme = process.argv.includes('--programme');
const destination = path.join(root, programme?'docs/implementation/programme':'docs/implementation/phase-0-2');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const unique = values => [...new Set(values)];
const levels = ['Foundations', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const coreCases = ['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale'];
const baseline = programme?'7eeeb36fee685ee0d7e3abd62f1499d51dee59cb':'bd60180cc4eea7d9c0bd45e41584048ec752fba1';
const vocab = read('data/vocab.json'), verbs = read('data/verbs.json');
const dictionary = new Map([...vocab, ...verbs].map(entry => [entry.id, entry]));
const reference = read('data/grammar.json');
const packs = levels.map(level => read(`data/course-v2/${level}.json`));
const allLessons = packs.flatMap(pack => pack.units.flatMap(unit => unit.lessons.map(lesson => ({...lesson, level:pack.level, unitId:unit.id}))));
const lessonIds = new Set(allLessons.map(lesson => lesson.id));

// Authored editorial decisions are provisional until reviewed by an Italian educator.
// A maintain decision retains the bounded target; it does not certify the complete level.
const urgent = {
  'v2-f-greet': ['repair-farewell'],
  'v2-a1-one-thing': ['repair-feminine-elision'],
  'v2-a1-near-far': ['valid-invariant-location'],
  'v2-a1-want-need': ['untaught-modal-persons'],
  'v2-a1-andare': ['untaught-plural-persons'],
  'v2-a1-fare': ['untaught-plural-persons'],
  'v2-a1-venire': ['untaught-plural-persons'],
  'v2-a1-present-ere': ['full-present-models'],
  'v2-a1-present-ire': ['full-present-models'],
  'v2-a1-potere-requests': ['full-present-models'],
  'v2-a1-days-clock': ['spoken-elision'],
  'v2-a2-past-auxiliary-person': ['full-auxiliary-persons'],
  'v2-a2-essere-plural': ['full-auxiliary-persons-and-agreement'],
  'v2-a2-imperfect-are': ['full-imperfect-models'],
  'v2-a2-imperfect-ere-ire': ['full-imperfect-models'],
  'v2-a2-imperfect-states': ['full-imperfect-models'],
  'v2-a2-progressive-present': ['full-stare-persons'],
  'v2-a2-progressive-past': ['full-stare-persons'],
  'v2-a2-future-are': ['full-future-models'],
  'v2-a2-future-ere-ire': ['full-future-models'],
  'v2-a2-future-irregular': ['full-future-models'],
  'v2-a2-conditional-request': ['full-conditional-models'],
  'v2-a2-conditional-plan': ['full-conditional-models'],
  'v2-a2-direct-singular': ['pizza-explanation'],
  'v2-a2-past-irregular': ['valid-veduto'],
  'v2-a2-direct-elision-negation': ['repair-negation'],
  'v2-b1-ce-ne-quantity': ['ce-ne-functions'],
  'v2-b2-dislocation': ['spoken-elision'],
  'v2-c1-u1-subjunctive-perspective': ['advanced-entry-bridge'],
  'v2-c2-u1-mood-evidence': ['advanced-entry-bridge'],
};
const bridges = {
  Foundations: [],
  A1: ['v2-f-greet', 'v2-f-name-polite', 'v2-f-repair', 'v2-f-sound-c', 'v2-f-keep-c-hard'],
  A2: ['v2-a1-essere-plural', 'v2-a1-avere-plural', 'v2-a1-are-plural', 'v2-a1-present-ere', 'v2-a1-present-ire', 'v2-a1-past-essere'],
  B1: ['v2-a2-story-contrast', 'v2-a2-direct-attached', 'v2-a2-indirect-groups', 'v2-a2-future-irregular', 'v2-a2-conditional-plan', 'v2-a2-real-if'],
  B2: ['v2-b1-subjunctive-bridge', 'v2-b1-reporting-information', 'v2-b1-che-cui', 'v2-b1-impersonal-si', 'v2-b1-cause-links', 'v2-b1-capstone-relay'],
  C1: ['v2-b2-tense-relations', 'v2-b2-mixed-condition', 'v2-b2-evidence-source', 'v2-b2-actor-control', 'v2-b2-capstone-mediation'],
  C2: ['v2-c1-u1-subjunctive-perspective', 'v2-c1-u2-past-subjunctive-time', 'v2-c1-u3-qualified-conclusion', 'v2-c1-u6-participle-gerund', 'v2-c1-u10-conditional-politeness', 'v2-c1-u12-reduced-formal-clauses'],
};
const stagePlan = {
  Foundations: {
    reception:'Understand a familiar greeting, supplied name/origin and request for repetition; distinguish sounds in an explicitly taught tiny lexicon.',
    production:'Use a greeting, name/origin chunk and help phrase with a model; practise sound contrasts through self-comparison.',
    interaction:'Open, maintain and close a supported first exchange; request a repeat or slower delivery.',
    mediation:'Relay the meaning of a taught greeting/help phrase to a peer with support.',
    lexicalStrands:[['first-contact','ciao','buongiorno','arrivederci','nome'],['polite-help','grazie','prego','scusi','per favore','non capisco','ripeti'],['known-sounds','casa','cena','caffè','chiave','che']],
    forms:['Mi chiamo / Come ti chiami / Come si chiama as explained chunks','Sono di + supplied place','c/ch through known words; meaning before discrimination'],
    exit:'Fresh supported greeting with a name, a help request and leave-taking; separate listening identification and optional recorded self-review.',
    gaps:['No independently assessed listening target','No integrated beginner exit','Sound checks mostly expose spelling'],
  },
  A1: {
    reception:'Recover names, numbers, time, prices and familiar intentions from short signs, messages and clearly delivered exchanges.',
    production:'Describe self/family/home and daily activities; ask useful questions and write a short familiar message.',
    interaction:'Handle a café/shop exchange, simple directions or appointment; choose tu/Lei from an explicit relationship.',
    mediation:'Pass on a short familiar notice or arrangement without changing names, numbers or time.',
    lexicalStrands:[['identity-family','nome','famiglia','madre','padre','amico'],['home-places','casa','scuola','stazione','negozio','strada'],['food-shopping','pane','acqua','caffè','pizza','prezzo','euro'],['time-routine','oggi','domani','giorno','ora','lavoro','colazione'],['clothes-weather-health','camicia','scarpa','pioggia','sole','freddo','dolore']],
    forms:['Full required present persons including formal Lei for essere/avere, -are/-ere/-ire/-isc and high-frequency irregulars','Article, plural, adjective and possessive forms; question/negation/preposition contrasts','Selected completed-past chunks; full auxiliary persons before reuse'],
    exit:'Fresh introduction, familiar transaction, short message/sign, and simple taught past account; retain separate reading/listening/portfolio/self-review strands.',
    gaps:['Clothes/weather/basic-health strands need dedicated communicative teaching','Only one reading and one listening target','No integrated A1 stage exit'],
  },
  A2: {
    reception:'Understand routine services, appointments, plans, short accounts and changes of arrangement in clear connected language.',
    production:'Tell a connected past account distinguishing event/background/habit and action underway; express plans and polite requests.',
    interaction:'Solve a routine service or travel change; ask follow-up and repair misunderstanding.',
    mediation:'Relay an arrangement or short service message, retaining conditions, quantities and practical actions.',
    lexicalStrands:[['travel-services','biglietto','treno','autobus','prenotazione','albergo'],['appointments-plans','appuntamento','orario','medico','ufficio'],['past-routine','prima','poi','ieri','spesso','mentre'],['people-reference','qualcuno','qualcosa','nessuno','niente','tutti'],['changing-plans','problema','ritardo','cambiare','potere','volere','dovere']],
    forms:['Full taught persons of passato prossimo/imperfetto/futuro/conditional including auxiliary and agreement','stare present/imperfect + own verb gerund with aspect/context','Direct/indirect clitics, elision, negation, attachment and tu/voi/Lei commands'],
    exit:'Fresh service dialogue plus appointment change and connected past message; comprehension and open responses remain separate evidence.',
    gaps:['Only 7/58 baseline related-entry links','Partial person models in past/future lessons','No integrated A2 stage exit'],
  },
  B1: {
    reception:'Follow connected everyday narratives, explanations, practical rules and reported messages.',
    production:'Compose a connected account, explanation, advice or opinion with clear time/reference and meaningful clause links.',
    interaction:'Maintain an independent everyday exchange, revise a plan and ask clarifying follow-up.',
    mediation:'Relay information from a voicemail/service/rule to another person, preserving the source and required action.',
    lexicalStrands:[['accounts-change','ricordo','esperienza','abitudine','cambiamento'],['requests-problems','richiesta','soluzione','consiglio','bisogno'],['cause-consequence','perché','poiché','quindi','nonostante'],['reference-quantity','ci','ne','ce ne','cui','tutto'],['opinions-reports','penso','spero','dubbio','messaggio','regola']],
    forms:['Earlier past, tense relationships and real conditional sequences','Combined clitics, ci/ne/ce ne with distinct functions and clear antecedents','Explicit present-subjunctive bridges before opinion/wish/judgment frames; passive/impersonal si'],
    exit:'Fresh connected account, service problem with follow-up, practical listening update and source relay; delayed retrieval on another occasion.',
    gaps:['Natural unscripted interaction remains unassessed','Sustained listening corpus still narrow','Linked lexical retrieval needs planned later contexts'],
  },
  B2: {
    reception:'Follow sustained arguments, viewpoint, reported exchanges and institutional/news/narrative register.',
    production:'Defend and qualify opinions, express hypotheticals, negotiate a remedy and revise coherent writing with a rubric.',
    interaction:'Respond to objections, clarify intent and negotiate with multiple speakers across follow-up turns.',
    mediation:'Compare sources and relay audience-relevant information without overstating evidence or hiding agents.',
    lexicalStrands:[['argument-evidence','argomento','prova','fonte','vantaggio','limite'],['negotiation-institutions','reclamo','compromesso','accordo','rimedio'],['stance-condition','sebbene','tuttavia','qualora','ipotesi'],['register-report','resoconto','intervista','comunicato','racconto'],['cohesion-reference','cui','il quale','pertanto','mentre']],
    forms:['Productive present/imperfect/past/pluperfect subjunctive with timeline models','Past conditional and mixed counterfactuals; reported speech and command shifts','Passive/si, complex relatives, dislocation/cleft, controlled nonfinite clauses, narrative past recognition'],
    exit:'Fresh qualified argument with two sources, negotiated objection, listening relay and revised mediation; retained performance beyond the familiar dossier.',
    gaps:['Only one independent listening target','Longer natural multi-speaker material required','Optional discussion portfolio cannot attest interaction competence'],
  },
  C1: {
    reception:'Interpret extended implicit stance, presupposition and source relationships across professional/academic discourse and varied natural voices.',
    production:'Produce organised extended arguments and precise professional/academic correspondence; reformulate with appropriate certainty/register.',
    interaction:'Manage discussion, qualify claims, negotiate disagreement and repair misunderstanding through real follow-up.',
    mediation:'Synthesize complementary/conflicting sources, retaining attribution, limitations and audience needs.',
    lexicalStrands:[['claim-certainty','riscontro','ipotesi','evidenza','plausibile','smentire'],['professional-discourse','verbale','relazione','istanza','delibera'],['nuance-reformulation','precisare','rettificare','sfumatura','invece'],['sources-audience','attribuzione','testimonianza','bilancio','destinatario'],['discussion-register','obiezione','concessione','intervento','replica']],
    forms:['Full relative-time subjunctive/conditional paradigms and epistemic future distinctions','Controlled compound gerund/participle clauses, reference/focus and concessive relations','Institutional si/passive, nominalisation and compact clauses without lost agents/time'],
    exit:'Fresh extended natural listening and complex reading, sustained argument, discussion follow-up and multi-source synthesis with reviewed rubric.',
    gaps:['24 lessons reuse only 12 principal reading dossiers','Only one interact portfolio and no actual partner prompt','14 audio clips ~7.21 minutes, dominated by synthetic practice','No baseline vocabulary matching boards'],
  },
  C2: {
    reception:'Interpret difficult natural speech and nuanced text, including supported irony, ambiguity, colloquial variation and competing readings.',
    production:'Reformulate and edit precisely for audience/style without changing scope, conditions, attribution or certainty.',
    interaction:'Manage delicate disagreement and repair; shift register and expression flexibly in unscripted follow-up.',
    mediation:'Synthesize demanding contested evidence and explain decision-relevant unknowns to different audiences.',
    lexicalStrands:[['precision-scope','connotazione','collocazione','ambiguità','sfumatura'],['idiom-pragmatics','ironia','allusione','sottinteso','equivoco'],['register-style','colloquiale','retorica','parafrasi','stile'],['evidence-decision','riserva','accessibilità','limite','dossier'],['interaction-repair','fraintendimento','rettifica','obiezione','mediazione']],
    forms:['Mood/evidence, aspect perspective, unreal/mixed conditions and quantifier/pronoun scope','Register-sensitive dislocation, literary tense/order and presupposition','Implicit hypotheses, modal inference, relative possession and agent-preserving compression'],
    exit:'Unseen difficult listening/text, substantial stylistic reformulation, demanding audience mediation and real interaction repair, with retained performance and educator feedback.',
    gaps:['24 lessons reuse only 12 principal reading dossiers','No interact portfolio or partner prompt','14 audio clips ~7.63 minutes, dominated by synthetic practice','Lexical nuance/pragmatic targets need dedicated fresh contexts'],
  },
};

// The local reference has twelve topics. Missing topics are explicit authoring work,
// never guessed links to a vaguely similar page.
const referenceRules = [
  [/article|gender|one-thing|singular-gender|di-articles/, ['articles']],
  [/noun-plural|plural-article|plural-spelling/, ['plurals','articles']],
  [/adjective|possessive|demonstrative|near-far|many-few|compar|superlative/, ['adjectives']],
  [/sound|hard-c|vowels|accents|silent-h|consonants|intonation|g-and-gh|sc-and-sch|gn-and-gli|spelling/, ['spelling']],
  [/essere|avere|present|are-singular|are-plural|andare|fare|venire|modal|want-need|potere|future|conditional|subjunctive|past|imperfect|timeline|tense|hypoth|condition|aspect|mood|progressive/, ['tenses']],
  [/past-essere|past-auxiliary|auxiliary-choice|essere-travel|essere-plural|past-regular|past-irregular|reflexive-past|earlier-essere/, ['auxiliaries']],
  [/habit|story|background|aspect-perspective|imperfect|simple-versus-progressive|progressive-past/, ['passato-imperfetto']],
  [/reflexive/, ['reflexives']],
  [/isc/, ['isc']],
  [/command|imperative|formal-request/, ['imperative']],
  [/pronoun|direct-|indirect-|recipient|ci-place|ne-quantity|ce-ne|object-agreement|everyone|nobody|someone|reference|relative|che-cui|dislocation|topic-focus/, ['pronouns']],
  [/preposition|a-in|da-con|da-origin|da-duration|del-dal|di-articles|a-articles|in-su-da|near-far|relative-prepositions/, ['prepositions']],
];
const missingReferenceRules = [
  [/sound|vowels|consonants|intonation|g-and-gh|sc-and-sch|gn-and-gli/, 'phonology-listening-and-self-comparison'],
  [/subjunctive|congiuntivo|mood|stance|viewpoint/, 'mood-selection-and-relative-time'],
  [/progressive|gerund|actor-control|nonfinite|participle|infinitive-control|infinitive-clause/, 'aspect-and-nonfinite-actor-control'],
  [/cause|links|connect|concession|concessive|purpose|cohesion|parallelism|ellipsis/, 'clause-links-and-cohesion'],
  [/read-|listen-|listening|evidence|source|claim|interpret|dossier|mediate|mediation|audience|synth|relay|capstone/, 'source-reasoning-and-mediation'],
  [/request|polite|register|variation|discussion|negotiate|reformulation|presupposition|circumlocution/, 'register-pragmatics-and-interaction'],
];

const norm = value => String(value||'').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g,"'");
const tokens = value => norm(value).match(/[a-zàèéìòù]+(?:'[a-zàèéìòù]+)?/gu)||[];
const decision = (kind, lesson, step) => {
  if (kind==='repair' && urgent[lesson.id]) return {action:'repair',reason:`Address all assessed facets; ${urgent[lesson.id].join(', ')}.`,phase:2};
  if (step?.kind==='teach' && /^The next example changes the setting\./.test(step.body||'')) return {action:'replace',reason:'Replace generic transfer wording with a target-specific new contrast; keep its ID as an alias.',phase:6};
  if (step?.kind==='teach' && /\.contrast-/.test(step.id)) return {action:'merge',reason:'Integrate this echoed answer explanation with its originating feedback after checking that no prerequisite/model is lost.',phase:6};
  if (urgent[lesson.id]) return {action:'repair',reason:`Retain outcome and IDs; correct ${urgent[lesson.id].join(', ')}.`,phase:2};
  if (['C1','C2'].includes(lesson.level)) return {action:'repair',reason:'Retain this bounded source/form target; add unseen extended transfer, planned lexical retrieval and skill breadth in Phase 6.',phase:6};
  return {action:'maintain',reason:`Retain the bounded ${lesson.targets.map(t=>t.modality||'language').join('/')} outcome and its authored ${lesson.targets.flatMap(t=>t.facets).join(', ')} contrasts; further language review pending.`,phase:null};
};

function buildInventory() {
  const errors=[], sourceFiles = levels.map(level=>`data/course-v2/${level}.json`).concat(['data/vocab.json','data/verbs.json','data/grammar.json','data/course-v2/audio.json','data/course-v2/legacy-map.json']);
  const lexical = new Map(), linkedVerbs = new Set(), lessons=[];
  const addError = (condition,message)=>{if(!condition)errors.push(message);};
  for (const lesson of allLessons) {
    addError(lesson.prerequisites.every(id=>lessonIds.has(id)), `${lesson.id}: unresolved prerequisite`);
    const file=`data/course-v2/${lesson.level}.json`, source={file,id:lesson.id,unitId:lesson.unitId};
    const resolved=resolveLessonWords(lesson,{vocab,verbs}), lookup=new Map(resolved.map(item=>[item.gloss,item.entry]));
    const wordPlan=wordsCheckPlan(lesson,resolved);
    const wordSources=lesson.steps.filter(s=>s.kind==='words').flatMap(step=>step.words.map((gloss,index)=>{
      const entry=lookup.get(gloss), key=sha(`${norm(gloss.it)}\0${gloss.en}`).slice(0,12), senseId=`course-sense:${key}`;
      const occurrence={sourceId:`${step.id}.word-${index}`,lessonId:lesson.id,level:lesson.level,it:gloss.it,en:gloss.en,entryId:entry?.id||null,explicitEntryId:gloss.entryId||null,senseId};
      if(!lexical.has(senseId))lexical.set(senseId,{id:senseId,it:gloss.it,en:gloss.en,currentEntryId:entry?.id||null,senseStatus:'proposed-semantic-key-requires-editor-review',sourceIds:[],lessonIds:[],levels:[],retrievalLessonIds:[]});
      const record=lexical.get(senseId);record.sourceIds.push(occurrence.sourceId);record.lessonIds.push(lesson.id);record.levels.push(lesson.level);
      if(entry?.id.startsWith('v:'))linkedVerbs.add(entry.id);
      if(wordPlan.steps.some(step=>step.entryIds.includes(entry?.id)))record.retrievalLessonIds.push(lesson.id);
      return {...occurrence,article:gloss.article||entry?.article||null,gender:entry?.g||null,plural:gloss.plural||entry?.pl||null,usage:gloss.note||null,dictionaryMeaning:entry?.en||null,resolution:entry?'runtime-lookup-candidate':'phrase-or-unresolved'};
    }));
    for(const link of lesson.related||[]){addError(dictionary.has(link.entryId),`${lesson.id}: unknown related ${link.entryId}`);if(link.entryId.startsWith('v:'))linkedVerbs.add(link.entryId);}
    const matchedReferences=unique(referenceRules.filter(([pattern])=>pattern.test(lesson.id)).flatMap(([,ids])=>ids));
    const missingReferences=unique(missingReferenceRules.filter(([pattern])=>pattern.test(lesson.id)).map(([,id])=>id));
    const questions=lesson.steps.filter(step=>step.kind==='question');
    const routeIds=kind=>lesson.steps.filter(step=>step.kind===kind).map(step=>step.id);
    const targets=lesson.targets.map(target=>({
      sourceId:target.id,label:target.label,modality:target.modality,requiresProduction:!!target.requiresProduction,facets:target.facets,minIndependent:target.minIndependent,
      teachingSourceIds:lesson.steps.filter(s=>s.kind==='teach'&&s.introduces?.includes(target.id)).map(s=>s.id),
      guidedSourceIds:questions.filter(s=>s.target===target.id&&s.stage==='guided').map(s=>s.id),
      independentSourceIds:questions.filter(s=>s.target===target.id&&s.stage==='independent'&&!s.reserve).map(s=>s.id),
      reserveSourceIds:questions.filter(s=>s.target===target.id&&s.reserve).map(s=>s.id),
      repair:{sourceId:`${target.id}.repair`,title:target.repair.title,body:target.repair.body,examples:target.repair.examples,decision:decision('repair',lesson),facetVariants:Object.entries(target.repair.byFacet||{}).map(([facet,content])=>({sourceId:`${target.id}.repair.byFacet.${facet}`,facet,...content,decision:decision('repair',lesson)}))},
    }));
    const reviewVariants=lesson.steps.filter(step=>step.reserve||/\.(?:review|reserve)-/.test(step.id)).map(step=>step.id);
    const warningCodes=[];
    if(!lesson.referenceTopics?.length)warningCodes.push('no-context-reference-link');
    if(!lesson.related?.length)warningCodes.push('no-related-dictionary-link');
    if(!wordPlan.steps.length)warningCodes.push('no-synthesized-word-retrieval');
    if(['C1','C2'].includes(lesson.level)&&!lesson.prerequisites.length)warningCodes.push('no-cross-level-bridge');
    if(urgent[lesson.id])warningCodes.push(...urgent[lesson.id]);
    lessons.push({source,...source,level:lesson.level,title:lesson.title,outcome:lesson.outcome,minutes:lesson.minutes,
      decision:decision('lesson',lesson),existingPrerequisiteIds:lesson.prerequisites,stageEntryBridgeIds:bridges[lesson.level],legacyIds:lesson.legacyLessonIds||[],
      targets,vocabulary:wordSources,related:lesson.related||[],referenceTopics:{existing:lesson.referenceTopics||[],proposedExistingTopicIds:matchedReferences,missingTopicIds:missingReferences,status:'editorial-map-only-no-ui-integration'},
      pipeline:{wordsSourceIds:routeIds('words'),teachingSourceIds:routeIds('teach'),passageSourceIds:routeIds('passage'),portfolioSourceIds:routeIds('portfolio'),guidedSourceIds:questions.filter(s=>s.stage==='guided').map(s=>s.id),independentSourceIds:questions.filter(s=>s.stage==='independent'&&!s.reserve).map(s=>s.id),reserveReviewSourceIds:reviewVariants,delayedReview:'not-established-by-reserve-flag; map later source occurrences and future spaced checkpoints explicitly'},
      variants:lesson.steps.map(step=>({sourceId:step.id,kind:step.kind,role:step.reserve?'reserve':/\.(?:review|reserve)-/.test(step.id)?'review':step.stage||step.mode||step.kind,targetId:step.target||null,facet:step.facet||null,contextKey:step.contextKey||null,context:step.context||null,format:step.format||null,answer:step.answer||null,accepted:step.accepted||[],audioId:step.audioId||null,passageId:step.passageId||null,decision:decision('step',lesson,step)})),
      passages:lesson.steps.filter(s=>s.kind==='passage').map(s=>({sourceId:s.id,mode:s.mode,audioId:s.audioId||null,wordCount:tokens(s.it).length,textHash:sha(s.it)})),
      portfolios:lesson.steps.filter(s=>s.kind==='portfolio').map(s=>({sourceId:s.id,mode:s.mode,partnerPrompt:s.partnerPrompt||null,prompt:s.prompt,rubric:s.rubric,assessmentStatus:'optional-self-review-or-external-assessment; not-automatic-proficiency'})),
      wordRetrieval:{sourceIds:wordPlan.steps.map(s=>s.id),entryIds:unique(wordPlan.steps.flatMap(s=>s.entryIds)),excludedEntryIds:wordPlan.excluded},warnings:warningCodes,
      editorialStatus:{agentReview:'inventory-and-targeted-fixtures',nativeItalianHumanReview:'pending',learnerCalibration:'pending'},
    });
  }
  const lexicon=[...lexical.values()].map(item=>({...item,sourceIds:unique(item.sourceIds),lessonIds:unique(item.lessonIds),levels:unique(item.levels),retrievalLessonIds:unique(item.retrievalLessonIds),laterExposureLessonIds:unique(item.lessonIds).slice(1),delayedRetrievalStatus:'later-exposure-is-not-independent-delayed-evidence'}));
  const paradigmCatalog=[],fullParadigms=[];
  for(const entry of verbs){
    const paradigm=conjugate(entry.inf,entry), availability={};
    for(const key of coreCases){const forms=paradigm.tenses[key]||[];availability[key]={availablePersons:forms.map((form,i)=>form&&form!==MISSING?PERSONS[i]:null).filter(Boolean),missingPersons:PERSONS.filter((_,i)=>!forms[i]||forms[i]===MISSING)};}
    paradigmCatalog.push({entryId:entry.id,level:entry.level,lemma:entry.inf,auxiliary:entry.aux,transitivity:entry.trans,irregular:!!paradigm.irregular,defective:paradigm.defective,courseLinked:linkedVerbs.has(entry.id),fiveCoreCases:availability,source:'data/verbs.json + js/conjugator.js; engine output requires construction-specific editorial review'});
    if(linkedVerbs.has(entry.id))fullParadigms.push({entryId:entry.id,lemma:entry.inf,persons:PERSONS,formalLei:'Uses third-person singular forms with explicitly polite addressee; is not a seventh morphological person.',auxiliary:paradigm.aux,auxiliaryByConstructionReview:entry.aux==='both'?'required':entry.trans==='vr'?'reflexive construction':'retain dictionary construction and verify examples',tenses:paradigm.tenses,nonFinite:paradigm.nonFinite,defective:paradigm.defective,sourceLessonIds:lessons.filter(l=>l.vocabulary.some(w=>w.entryId===entry.id)||l.related.some(r=>r.entryId===entry.id)).map(l=>l.id),teachingStatus:'linked forms are available; no automatic assertion that all cells were taught or assessed'});
  }
  const stats=levels.map(level=>{
    const ls=lessons.filter(l=>l.level===level), qs=ls.flatMap(l=>l.variants).filter(s=>s.kind==='question');
    return {level,units:packs.find(p=>p.level===level).units.length,lessons:ls.length,minutes:ls.reduce((n,l)=>n+l.minutes,0),questions:qs.length,independentQuestions:qs.filter(q=>q.role==='independent').length,reserveReviewVariants:ls.reduce((n,l)=>n+l.pipeline.reserveReviewSourceIds.length,0),repairVariants:ls.reduce((n,l)=>n+l.targets.length,0),facetRepairVariants:ls.reduce((n,l)=>n+l.targets.reduce((count,t)=>count+t.repair.facetVariants.length,0),0),targetModalities:Object.fromEntries(['language','reading','listening'].map(mode=>[mode,ls.flatMap(l=>l.targets).filter(t=>t.modality===mode).length])),portfolios:Object.fromEntries(['write','speak','interact','mediate'].map(mode=>[mode,ls.flatMap(l=>l.portfolios).filter(t=>t.mode===mode).length])),relatedLessons:ls.filter(l=>l.related.length).length,vocabularyGlosses:ls.reduce((n,l)=>n+l.vocabulary.length,0),vocabularySenseCandidates:unique(ls.flatMap(l=>l.vocabulary.map(w=>w.senseId))).length,wordBoardLessons:ls.filter(l=>l.wordRetrieval.sourceIds.length).length,distinctReadPassages:unique(ls.flatMap(l=>l.passages.filter(p=>p.mode==='read').map(p=>p.textHash))).length};
  });
  for(const [level,ids] of Object.entries(bridges))for(const id of ids)addError(lessonIds.has(id),`${level}: unknown authored bridge ${id}`);
  const seen=new Set();for(const lesson of lessons)for(const s of lesson.variants){addError(!seen.has(s.sourceId),`duplicate step ${s.sourceId}`);seen.add(s.sourceId);}
  const visit=(id,stack=new Set(),done=new Set())=>{if(stack.has(id)){errors.push(`prerequisite cycle ${id}`);return;}if(done.has(id))return;stack.add(id);for(const before of lessons.find(l=>l.id===id)?.existingPrerequisiteIds||[])visit(before,stack,done);stack.delete(id);done.add(id);};
  for(const id of lessonIds)visit(id);
  assert.equal(errors.length,0,errors.join('\n'));
  return {schemaVersion:1,baselineCommit:baseline,scope:programme?'Full programme source inventory; publication and proficiency gates remain separate':'Phase 0 inventory and Phase 1 curriculum/language contract; bounded Phase 2 repairs only',decisionVocabulary:['maintain','repair','merge','replace'],reviewPolicy:{agentReview:'inventory plus targeted linguistic-source and regression review',nativeItalianEducatorReview:'pending; never implied by automated or agent review',fullC2Claim:'not-established',publication:'Phase 6 editorial programme; no mass curriculum release in this phase'},sourceFiles:sourceFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),stats,summary:{units:packs.reduce((n,p)=>n+p.units.length,0),lessons:lessons.length,authoredSteps:seen.size,authoredQuestions:lessons.flatMap(l=>l.variants).filter(s=>s.kind==='question').length,reserveReviewVariants:stats.reduce((n,s)=>n+s.reserveReviewVariants,0),repairVariants:stats.reduce((n,s)=>n+s.repairVariants,0),vocabularySenseCandidates:lexicon.length,dictionaryWords:vocab.length,dictionaryVerbs:verbs.length,courseLinkedFullParadigms:fullParadigms.length},stagePlan,bridges,referenceCatalog:reference.map(t=>({id:t.id,title:t.title,sections:t.sections?.map(s=>s.title)||[]})),lessons,vocabularySenses:lexicon,verbParadigmCatalog:paradigmCatalog,courseLinkedFullParadigms:fullParadigms,legacyMappings:read('data/course-v2/legacy-map.json').mapping};
}

const escape=value=>String(value||'').replace(/\|/g,'\\|').replace(/\n/g,' ');
function buildMap(inventory){
  const out=[
    '# Foundations–C2 curriculum map — Phases 0–2',
    '',
    `Baseline: \`${baseline}\`. The inventory reconciles ${inventory.summary.lessons} lessons in ${inventory.summary.units} units, ${inventory.summary.authoredQuestions} authored questions, ${inventory.summary.reserveReviewVariants} reserve/review question variants and ${inventory.summary.repairVariants} target repair variants. Every authored step has a source ID and a maintain/repair/merge/replace decision in [curriculum-inventory.json](curriculum-inventory.json).`,
    '',
    'This is a complete source inventory and an authored coverage map, not a claim that all teaching is editorially approved or that the current course develops full C2 proficiency. Agent/source review, automated validation, native Italian educator review, learner calibration and device validation are separate gates. Native Italian human review and learner calibration are pending.',
    '',
    '## Shared language and authoring contract',
    '',
    '- Map outcome → vocabulary sense/construction → prerequisite model → guided use → independent fresh use → targeted repair → later retrieval. A tooltip, exposure or reserve flag is not proof of teaching or delayed retention.',
    '- Keep lesson/target/step IDs stable for bounded repairs. A replacement or merge retains explicit source IDs and legacy aliases; old completion and evidence are preserved without awarding new skills.',
    '- `course-sense:*` IDs in this report are deterministic proposed semantic keys from Italian plus contextual English gloss. They are not a released dictionary migration. Existing entry IDs remain intact; runtime lookup candidates and unresolved phrases need sense review.',
    '- All dictionary verbs have a five-core-case availability record. Every course-linked verb has complete engine paradigms for all fifteen tense/mood sets plus participle/gerund forms. Missing cells and construction-specific auxiliaries remain visible. Availability is not teaching, mastery or permission to invent unnatural progressive examples.',
    '- Formal Lei uses third-person singular morphology but requires an explicit polite addressee. Supply referent/agreement or admit reviewed alternatives. State/person/tense/meaning changes never become accent-only corrections.',
    '- Typed answer tolerance follows the shared accent contract; explicit choices retain meaningful e/è distinctions. Match valid alternatives within the task constraint and keep false distractors outside every accepted answer.',
    '- An optional open portfolio or self-review is practice until assessed. Course traversal, speaking practice, natural interaction and certified proficiency remain different facts.',
    '- Phase 2 patches only urgent incorrect grading/teaching and the prerequisites/models needed for existing routes. Catalogue integration belongs to Phase 3; full skill breadth, authentic corpus and lesson rewrite remain Phase 6.',
    '',
    '## Verified inventory',
    '',
    '| Stage | Units / lessons | Questions / normal independent | Reserve/review / repairs | Language / reading / listening targets | Write / speak / interact / mediate | Related lessons / word-board lessons |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...inventory.stats.map(s=>`| ${s.level} | ${s.units} / ${s.lessons} | ${s.questions} / ${s.independentQuestions} | ${s.reserveReviewVariants} / ${s.repairVariants} | ${Object.values(s.targetModalities).join(' / ')} | ${Object.values(s.portfolios).join(' / ')} | ${s.relatedLessons} / ${s.wordBoardLessons} |`),
    '',
    'Counts describe the audited source and do not measure proficiency. Synthesized word boards are recorded separately from authored questions. Reserve/review variants may be used during the same visit and do not establish a delayed-review schedule.',
    '',
    '## Authored stage outcomes, bridges and lexical strands',
  ];
  for(const level of levels){const plan=stagePlan[level];out.push('',`### ${level}`,'',`**Reception:** ${plan.reception}`,`**Production:** ${plan.production}`,`**Interaction:** ${plan.interaction}`,`**Mediation:** ${plan.mediation}`,'',`**Entry refresh:** ${bridges[level].length?bridges[level].map(id=>`\`${id}\``).join(', '):'No prior course required; explain the task and meaning before testing.'}`,'',`**Required forms:** ${plan.forms.join('; ')}.`,'',...plan.lexicalStrands.map(([strand,...words])=>`- ${strand}: ${words.join(', ')}. Contextual senses and taught/retrieved occurrences must be checked before publication.`),'',`**Exit evidence:** ${plan.exit}`,'',`**Remaining breadth:** ${plan.gaps.join('; ')}.`);}
  out.push('','## Every unit and lesson: outcome, prerequisites and disposition','','Each row keeps the current bounded communicative outcome. Repair decisions for advanced breadth are Phase 6 work, with a specific urgent Phase 2 list below. Proposed references map to existing local pages when possible; `new:` identifies a missing reference subject.');
  for(const pack of packs)for(const unit of pack.units){out.push('',`### ${unit.id} — ${unit.title}`,'',unit.description||'','', '| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |','| --- | --- | --- | --- | --- |');for(const raw of unit.lessons){const l=inventory.lessons.find(l=>l.id===raw.id);out.push(`| \`${l.id}\` | ${escape(l.outcome)} | ${l.existingPrerequisiteIds.map(id=>`\`${id}\``).join(', ')||'entry'} | ${l.decision.action}${l.decision.phase?` / ${l.decision.phase}`:''} | ${[...l.referenceTopics.proposedExistingTopicIds,...l.referenceTopics.missingTopicIds.map(id=>'new:'+id)].join(', ')||'communicative chunks; review support rather than force a grammar link'} |`);}}
  out.push('','## Vocabulary, paradigms and reference coverage','','The JSON records every opening gloss with its source ID, contextual meaning, current lookup candidate, proposed sense key, noun forms where supplied, actual board eligibility, later occurrences and review status. Function phrases retain combined meanings; an unresolved phrase is an authoring task, not an automatic dictionary entry. Ambiguous legacy completion must never imply that all new senses were mastered.','',`The dictionary contains ${vocab.length} word entries and ${verbs.length} verb entries. ${inventory.summary.courseLinkedFullParadigms} verbs are explicitly linked from course glosses or related entries; their full paradigms are included. Every other verb has a five-core-case availability/exemption record so later catalogue integration can select and review it without losing whole-verb rules.`,'','The twelve current reference topics cover articles, plurals, adjectives, tense forms, past contrast, auxiliaries, reflexives, spelling, -isc, commands/Lei, pronouns and prepositions. They do not by themselves supply the missing phonology listening, mood-selection timelines, nonfinite actor control, cohesion, source reasoning, mediation, pragmatics and register coverage. The per-lesson map identifies the applicable existing and missing subjects. Adding a menu link is Phase 3; authoring the missing material is Phase 6.','','## Bounded Phase 2 editorial repair list','','| Source lesson | Verified repair | Progress / publication constraint |','| --- | --- | --- |',...Object.entries(urgent).map(([id,codes])=>`| \`${id}\` | ${codes.join(', ')} | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |`),'','The independent audit also names the legacy pizza/casa explanation, malformed spoken elision and ambiguous distractors. Each must be reproduced against its actual source before mutation. Already-correct main examples are retained; disputed stylistic claims require educator adjudication.','','## Validation and editorial release gates','','Run `node tools/audit-phase-curriculum.mjs --write` to regenerate this report and its JSON from canonical sources; run `--check` to verify exact reproducibility. The tool validates source IDs, prerequisite references/cycles, dictionary links, complete route inventory and authored stage bridge references. It does not grade language quality.','','Phase 2 fixtures cover the actual repaired answer variants, untouched invalid alternatives, taught modal/plural persons, repair facets and source idempotence. Existing all-correct and single-error traversal checks remain required. Native Italian educator review, all-clip perceptual audio review, beginner trials, authentic media rights and advanced open-performance assessment remain explicit external editorial gates. No agent review is labelled native human review.','');
  return out.join('\n');
}

function buildProgrammeMap(inventory){
  const out=['# Programme curriculum coverage','',`Implementation baseline: ${baseline}. Current canonical source: ${inventory.summary.lessons} lessons, ${inventory.summary.units} units and ${inventory.summary.authoredQuestions} authored questions.`, '',
    'This report describes source coverage. It does not certify Italian accuracy, speaking ability or CEFR proficiency. Independent agent language review, Italian educator review, learner calibration and device checks are tracked separately. Historical planning gaps remain in the detailed inventory as baseline editorial leads; current publication decisions use the band review reports.', '',
    '| Stage | Units | Lessons | Questions | Reading targets | Listening targets |', '| --- | --- | --- | --- | --- | --- |',
    ...inventory.stats.map(s=>`| ${s.level} | ${s.units} | ${s.lessons} | ${s.questions} | ${s.targetModalities.reading} | ${s.targetModalities.listening} |`), '',
    'Every source step, target, prerequisite, vocabulary candidate, related entry, reference gap and reserve/repair variant is retained in curriculum-inventory.json. A reserve flag does not establish delayed evidence. Optional open portfolios are practice until assessed.', '',
    'The beginner band has a separate authored inventory and recovery/audio checks in ../phase-6/beginner-coverage.md. Subsequent bands require their own authoring and independent review records.', '',
    'New dictionary senses use editorial sense IDs. Older course-sense proposal keys in this inventory are diagnostics and must be reconciled with reviewed catalogue records before AI level policy relies on them.', '',
    'Regenerate with node tools/audit-phase-curriculum.mjs --programme --write; verify with --programme --check. The archived Phase 0–2 evidence remains unchanged.',''];
  return out.join('\n');
}
const inventory=buildInventory(), outputs=new Map([
  ['curriculum-inventory.json',JSON.stringify(inventory,null,2)+'\n'],
  ['curriculum-map.md',programme?buildProgrammeMap(inventory):buildMap(inventory)],
]);
if(process.argv.includes('--write')){fs.mkdirSync(destination,{recursive:true});for(const [name,content] of outputs)fs.writeFileSync(path.join(destination,name),content);}
if(process.argv.includes('--check'))for(const [name,content] of outputs)assert.equal(fs.readFileSync(path.join(destination,name),'utf8'),content,`${name}: stale; run --write after canonical-source changes`);
console.log(JSON.stringify({status:'valid',mode:process.argv.includes('--write')?'write':process.argv.includes('--check')?'check':'read-only',...inventory.summary},null,2));
