// Taught lessons: complete authored situations are kept separate from form practice.
// Untagged examples become scored contexts only after conservative exact-span and person validation.
import { conjugate, PERSONS, MISSING, splitClitic, irregularCells, TENSES, TENSE_BY_KEY } from '../conjugator.js';
import { article, withArticle, isPluralOnly, isUncountable, hasPluralForm, nounNumberNote } from '../data.js';
import { expandedForms, wordContext, buildQuestion as buildMorphologyQuestion } from './questions.js';
import { WEATHER_VERBS, TENSE_LESSONS } from './content.js';
import { buildProgressiveGroup, buildVerbMixedGroup, simpleVerbContexts, progressiveSpec, variedContextOrder } from './progressive-content.js';
import { buildProgressiveGroup as legacyProgressiveGroup } from './legacy-progressive-content.js';
export const LESSON_CONTENT_VERSION = 1;
const stages = [['present','Present','presente'],['past','Passato prossimo','passatoProssimo'],['background','Imperfetto','imperfetto'],['future','Future','futuro'],['condizionale','Conditional','condizionale']];
const clean = x => expandedForms(x).filter(f => f && f !== MISSING);
const verb = e => !!(e.inf || e.kind === 'verb');
const id = (e, chapter, key) => `${e.id}::lesson::${chapter}::${key}`;
const card = (key,title,body,examples=[],forms=[],notes=[]) => ({id:key,title,body,examples,forms,notes});
const nounLabel = (e,plural=false) => e.g ? withArticle(e,plural) : plural ? e.pl : e.it;
const target = (e,ch,key,skill,extra={}) => ({id:id(e,ch,key),skill,required:true,available:true,...extra});
// A noun is taught as singular-use when its plural is not recorded as a form ("-")
// or its note says the sense normally stays singular; plural-only nouns are not.
const SINGULAR_NOTE=/\b(?:usually|normally|mostly|often|generally|typically|almost always|almost only)\s+(?:(?:in the|used in the)\s+)?singular\b/i;
export function isSingularUse(e){ return e?.pos==='noun'&&!isPluralOnly(e)&&(isUncountable(e)||SINGULAR_NOTE.test(e.note||'')); }
const firstArticle=(e,plural=false)=>String(article(e,plural)||'').split('/')[0];
const attach=(a,w)=>!a?w:a.endsWith("'")?a+w:`${a} ${w}`;
// The regular plural pattern, used only to name a deliberately wrong option on the
// number screen; a recorded plural is always preferred to this guess.
const regularPlural=w=>{const [head,...rest]=String(w).split(' ');const guess=/io$/.test(head)?head.slice(0,-1):/o$/.test(head)?head.slice(0,-1)+'i':/[cg]a$/.test(head)?head.slice(0,-1)+'he':/a$/.test(head)?head.slice(0,-1)+'e':/e$/.test(head)?head.slice(0,-1)+'i':head;return [guess,...rest].join(' ');};
export function nounNumberChoices(e){
 if(e?.pos!=='noun'||!e.g||!e.it||!isSingularUse(e))return null;
 const singular=attach(firstArticle(e),e.it),pluralForm=hasPluralForm(e)?e.pl:regularPlural(e.it),plural=attach(firstArticle({...e,pl:pluralForm},true),pluralForm);
 return {question:'Which is right for this noun?',fact:`Normally singular: ${singular}`,distractors:[`Normally plural: ${plural}`,`Singular and plural alike: ${singular}, ${plural}`],singular,plural,invented:!hasPluralForm(e)};
}
// One line naming the article rule whenever the noun does not simply take il/i or la/le.
export function articleRuleNote(e){
 if(e?.pos!=='noun'||!e.g)return '';
 const pluralOnly=isPluralOnly(e),singular=pluralOnly?'':String(article(e)||''),plural=hasPluralForm(e)?String(article(e,true)||''):'';
 const sg=pluralOnly?'':withArticle(e),pl=plural?withArticle(e,true):'';
 const pluralPart=plural==='gli'?` The plural takes gli: ${pl}.`:plural==='gli/le'?` In the plural use gli or le: gli ${e.pl} / le ${e.pl}.`:plural==='le'&&e.g==='m'?` This masculine noun has a feminine plural with le: ${pl}.`:pl?` The plural is ${pl}.`:'';
 if(singular==="l'")return `Before a vowel sound the singular article is l': ${sg}.${pluralPart}`;
 if(singular==='lo')return `Before s + consonant, z, gn, ps, x, y or i + vowel the masculine article is lo: ${sg}.${pluralPart}`;
 if(singular==='lo/la')return `Before s + consonant, z, gn, ps, x, y or i + vowel the masculine article is lo and the feminine la: lo ${e.it} / la ${e.it}.${pluralPart}`;
 if(plural==='gli')return `This noun takes gli in the plural: ${pl}.`;
 if(plural==='le'&&e.g==='m')return `This masculine noun has a feminine plural with le: ${pl}.`;
 return '';
}
// These restrictions describe the dictionary sense taught in this course. They
// do not claim that every literary or figurative use of the lemma is impossible.
const sensePersons = { bisognare:[2], trattarsi:[2], volerci:[2,5], addirsi:[2,5], prudere:[2,5], urgere:[2,5], vigere:[2,5], rincrescere:[2,5], spettare:[2,5], verificarsi:[2,5], concernere:[2,5] };
const senseSubject = (e,p) => sensePersons[e.inf] ? e.inf==='bisognare'?'impersonal necessity':e.inf==='trattarsi'?'impersonal: si tratta di':p===2?'one thing or situation':'more than one thing' : null;
function senseForms(e, forms) {
 if(e.inf==='riflettere')return forms.filter(form=>!/(?:^|\s)rifless(?:[oaie]|ero)$/.test(form));
 if(e.inf==='inferire')return forms.filter(form=>!/(?:^|\s)(?:infert[oaie]|infersi|inferse|infersero)$/.test(form));
 return forms;
}
export function lessonParticiples(e) {
 if(['concernere','ostare'].includes(e.inf))return [];
 const selected=lessonEntry(e);
 try{return senseForms(selected,clean(conjugate(selected.inf,{aux:selected.aux,isc:selected.isc}).nonFinite.participioPassato));}catch{return [];}
}
// Each tuple is a complete reviewed utterance: Italian, translation, exact target,
// grammatical person, and (where the construction constrains it) auxiliary.
const rows = {
 credere:{present:[['Credo a Marco.','I believe what Marco says.','credo',0],['Noi crediamo a Sara.','We believe what Sara says.','crediamo',3]],past:[['Ieri ho creduto a Marco.','Yesterday I believed Marco.','ho creduto',0,'avere'],['Abbiamo creduto al suo racconto.','We believed their account.','abbiamo creduto',3,'avere']],future:[['La prossima volta crederò a Marco.','Next time I will believe Marco.','crederò',0],['Dopo questa bugia, crederete ancora a Marco?','After this lie, will you all still believe Marco?','crederete',4]]},
 parlare:{present:[['Parlo italiano.','I speak Italian.','parlo',0],['Parliamo con Sara.','We are speaking with Sara.','parliamo',3]],past:[['Ho parlato con Sara.','I spoke with Sara.','ho parlato',0,'avere'],['Abbiamo parlato del viaggio.','We talked about the trip.','abbiamo parlato',3,'avere']],future:[['Parlerò con Sara domani.','I will speak with Sara tomorrow.','parlerò',0],['Parleremo del viaggio.','We will talk about the trip.','parleremo',3]]},
 dire:{present:[['Dico la verità.','I am telling the truth.','dico',0],['Diciamo sempre la verità.','We always tell the truth.','diciamo',3]],past:[['Ho detto la verità.','I told the truth.','ho detto',0,'avere'],['Abbiamo detto tutto a Sara.','We told Sara everything.','abbiamo detto',3,'avere']],future:[['Dirò la verità.','I will tell the truth.','dirò',0],['Diremo tutto a Sara.','We will tell Sara everything.','diremo',3]]},
 andare:{present:[['Vado a scuola.','I go to school.','vado',0],['Andiamo al mercato.','We are going to the market.','andiamo',3]],past:[['Marco è andato a scuola.','Marco went to school.','è andato',2,'essere'],['Sara è andata al mercato.','Sara went to the market.','è andata',2,'essere']],future:[['Andrò a scuola domani.','I will go to school tomorrow.','andrò',0],['Andremo al mercato.','We will go to the market.','andremo',3]]},
 dormire:{present:[['Dormo otto ore.','I sleep eight hours.','dormo',0],['Dormiamo in albergo.','We are sleeping at a hotel.','dormiamo',3]],past:[['Ho dormito otto ore.','I slept eight hours.','ho dormito',0,'avere'],['Abbiamo dormito in albergo.','We slept at a hotel.','abbiamo dormito',3,'avere']],future:[['Dormirò in albergo.','I will sleep at a hotel.','dormirò',0],['Dormiremo a casa.','We will sleep at home.','dormiremo',3]]},
 capire:{present:[['Capisco la domanda.','I understand the question.','capisco',0],['Capiamo il problema.','We understand the problem.','capiamo',3]],past:[['Ho capito la domanda.','I understood the question.','ho capito',0,'avere'],['Abbiamo capito il problema.','We understood the problem.','abbiamo capito',3,'avere']],future:[['Capirò meglio con un esempio.','I will understand better with an example.','capirò',0],['Con un esempio capiremo meglio.','With an example we will understand better.','capiremo',3]]},
 essere:{present:[['Sono a casa.','I am at home.','sono',0],['Siamo in biblioteca.','We are at the library.','siamo',3]],past:[['Marco è stato a Roma.','Marco has been to Rome.','è stato',2,'essere'],['Sara è stata a Roma.','Sara has been to Rome.','è stata',2,'essere']],future:[['Sarò a casa domani.','I will be home tomorrow.','sarò',0],['Saremo in biblioteca.','We will be at the library.','saremo',3]]},
 avere:{present:[['Ho una domanda.','I have a question.','ho',0],['Abbiamo tempo.','We have time.','abbiamo',3]],past:[['Ho avuto una buona idea.','I had a good idea.','ho avuto',0,'avere'],['Abbiamo avuto un problema.','We had a problem.','abbiamo avuto',3,'avere']],future:[['Avrò tempo domani.','I will have time tomorrow.','avrò',0],['Avremo una risposta domani.','We will have an answer tomorrow.','avremo',3]]},
 alzarsi:{present:[['Mi alzo alle sette.','I get up at seven.','mi alzo',0],['Ci alziamo presto.','We get up early.','ci alziamo',3]],past:[['Marco si è alzato presto.','Marco got up early.','si è alzato',2,'essere'],['Sara si è alzata alle sette.','Sara got up at seven.','si è alzata',2,'essere']],future:[['Mi alzerò presto.','I will get up early.','mi alzerò',0],['Ci alzeremo alle sette.','We will get up at seven.','ci alzeremo',3]]},
 volere:{present:[['Voglio un caffè.','I want a coffee.','voglio',0],['Vogliamo un po’ di aiuto.','We want some help.','vogliamo',3]],past:[['Ho voluto un caffè.','I wanted a coffee.','ho voluto',0,'avere'],['Abbiamo voluto parlare con Sara.','We wanted to speak with Sara.','abbiamo voluto',3,'avere']],future:[['Dopo il viaggio vorrai riposare.','After the trip you will want to rest.','vorrai',1],['I bambini vorranno giocare.','The children will want to play.','vorranno',5]]},
 dovere:{present:[['Devo studiare.','I have to study.','devo',0],['Dobbiamo telefonare a Sara.','We have to phone Sara.','dobbiamo',3]],past:[['Ho dovuto studiare italiano.','I had to study Italian.','ho dovuto',0,'avere'],['Abbiamo dovuto comprare il pane.','We had to buy bread.','abbiamo dovuto',3,'avere']],future:[['Dovrò studiare domani.','I will have to study tomorrow.','dovrò',0],['Dovremo comprare il pane.','We will have to buy bread.','dovremo',3]]},
 potere:{present:[['Posso aiutare Marco.','I can help Marco.','posso',0],['Possiamo aprire la finestra.','We can open the window.','possiamo',3]],past:[['Ho potuto aiutare Marco.','I was able to help Marco.','ho potuto',0,'avere'],['Abbiamo potuto aprire la finestra.','We were able to open the window.','abbiamo potuto',3,'avere']],future:[['Potrò aiutare Marco domani.','I will be able to help Marco tomorrow.','potrò',0],['Potremo aprire la finestra.','We will be able to open the window.','potremo',3]]},
 piovere:{present:[['Oggi piove.','It is raining today.','piove',2],['Qui piove spesso.','It often rains here.','piove',2]],past:[['Ieri ha piovuto.','It rained yesterday.','ha piovuto',2,'avere'],['Stanotte è piovuto.','It rained last night.','è piovuto',2,'essere']],future:[['Domani pioverà.','It will rain tomorrow.','pioverà',2],['Secondo le previsioni, pioverà.','According to the forecast, it will rain.','pioverà',2]]},
 piacere:{present:[['Mi piace questo libro.','I like this book.','piace',2],['Mi piacciono questi libri.','I like these books.','piacciono',5]],past:[['Mi è piaciuto il film.','I liked the film.','è piaciuto',2,'essere'],['Mi sono piaciuti i film.','I liked the films.','sono piaciuti',5,'essere']],future:[['Ti piacerà questo libro.','You will like this book.','piacerà',2],['Ti piaceranno questi libri.','You will like these books.','piaceranno',5]]},
};
// These bounded scenes are reviewed for the named verb only. They never accept
// a different infinitive as a fill-in. Morphology supplies the six finite forms;
// the lexical construction, auxiliary, English predicate and subjects are authored.
const scenes = {
 credere: {aux:'avere', en:['believe','believes','believed'], uses:[['a Marco','what Marco says'],['al racconto di Sara',"Sara’s account"]]},
 parlare: {aux:'avere', en:['speak','speaks','spoke'], uses:[['italiano','Italian'],['con Sara','with Sara']]},
 dire: {aux:'avere', en:['tell','tells','told'], uses:[['la verità','the truth'],['tutto a Sara','Sara everything']]},
 andare: {aux:'essere', en:['go','goes','went'], uses:[['al mercato','to the market'],['a scuola','to school']]},
 dormire: {aux:'avere', en:['sleep','sleeps','slept'], uses:[['in albergo','at a hotel'],['a casa','at home']]},
 capire: {aux:'avere', en:['understand','understands','understood'], uses:[['la domanda','the question'],['il problema','the problem']]},
 essere: {aux:'essere', en:['be','is','was'], uses:[['a casa','at home'],['in biblioteca','at the library']]},
 avere: {aux:'avere', en:['have','has','had'], uses:[['una domanda','a question'],['tempo','time']]},
 alzarsi: {aux:'essere', en:['get up','gets up','got up'], uses:[['alle sette','at seven'],['presto','early']]},
 volere: {aux:'avere', en:['want','wants','wanted'], uses:[['un caffè','a coffee'],['una risposta','an answer']]},
 dovere: {aux:'avere', en:['have to','has to','had to'], uses:[['studiare italiano','study Italian'],['comprare il pane','buy bread']],futureEn:'will have to'},
 potere: {aux:'avere', en:['can','can','was able to'], uses:[['aiutare Marco','help Marco'],['aprire la finestra','open the window']],futureEn:'will be able to'},
 fare: {aux:'avere', en:['take','takes','took'], uses:[['una passeggiata','a walk'],['una pausa','a break']]},
 stare: {aux:'essere', en:['stay','stays','stayed'], uses:[['a casa','at home'],['qui con la famiglia','here with the family']]},
 dare: {aux:'avere', en:['give','gives','gave'], uses:[['un consiglio a Sara','Sara advice'],['una mano a Marco','Marco a hand']]},
 sapere: {aux:'avere', en:['know','knows','found out'], uses:[['la risposta','the answer'],['la verità','the truth']]},
 venire: {aux:'essere', en:['come','comes','came'], uses:[['a cena','to dinner'],['qui in autobus','here by bus']]},
 uscire: {aux:'essere', en:['leave','leaves','left'], uses:[['di casa','home'],['dall’ufficio','the office']]},
 mangiare: {aux:'avere', en:['eat','eats','ate'], uses:[['un panino','a sandwich'],['la pasta','pasta']]},
 bere: {aux:'avere', en:['drink','drinks','drank'], uses:[['un tè','a tea'],['un bicchiere d’acqua','a glass of water']]},
 lavorare: {aux:'avere', en:['work','works','worked'], uses:[['in ufficio','at the office'],['con Marco','with Marco']]},
 studiare: {aux:'avere', en:['study','studies','studied'], uses:[['italiano','Italian'],['in biblioteca','at the library']]},
 prendere: {aux:'avere', en:['take','takes','took'], uses:[['l’autobus','the bus'],['il treno','the train']]},
 vedere: {aux:'avere', en:['see','sees','saw'], uses:[['Marco al mercato','Marco at the market'],['un film italiano','an Italian film']]},
 arrivare: {aux:'essere', en:['arrive','arrives','arrived'], uses:[['in stazione','at the station'],['a casa','home']]},
};
const chapterTense = Object.fromEntries(stages.map(([key,,tense])=>[key,tense]));
function sceneContexts(e,ch){
 const scene=scenes[e.inf],tense=chapterTense[ch];if(!scene||!tense)return [];
 const subjects=['Io','Tu','Luca','Noi','Voi','Luca e Paolo'];
 const english=['I','You','Luca','We','You all','Luca and Paolo'];
 const out=[];
 for(let person=0;person<6;person++)for(let situation=0;situation<scene.uses.length;situation++){
  let answers=lessonForms({...e,aux:scene.aux},tense,person);if(!answers.length)continue;
  // Named subjects pin agreement; io/tu/noi/voi leave gender open.
  if(ch==='past'&&scene.aux==='essere'&&[2,5].includes(person))answers=answers.filter(x=>x.endsWith(person===2?'o':'i'));
  const answer=answers[0],[itTail,enTail]=scene.uses[situation];
  let enVerb=ch==='future'?(scene.futureEn||`will ${scene.en[0]}`):ch==='past'?scene.en[2]:ch==='background'?`used to ${scene.en[0]}`:ch==='condizionale'?`would ${scene.en[0]}`:scene.en[person===2?1:0];
  if(e.inf==='essere'&&ch!=='future'&&ch!=='background'&&ch!=='condizionale')enVerb=ch==='past'?([0,2].includes(person)?'was':'were'):(person===0?'am':person===2?'is':'are');
  if(e.inf==='potere'&&ch==='condizionale')enVerb='would be able to';
  if(e.inf==='potere'&&ch==='background')enVerb='could';
  if(e.inf==='dovere'&&ch==='background')enVerb='used to have to';
  if(e.inf==='potere'&&ch==='past'&&![0,2].includes(person))enVerb='were able to';
  let tail=['past','background'].includes(ch)&&e.inf==='credere'&&situation===0?'what Marco said':enTail;
  const midSentence=ch==='background'&&[0,1,3,4].includes(person),itSubject=midSentence?subjects[person].toLowerCase():subjects[person];
  const enSubject=midSentence&&person!==0?english[person].toLowerCase():english[person];
  out.push({id:`${e.id}:${ch}:scene-${situation}:person-${person}`,it:`${ch==='background'?'A quel tempo, ':''}${itSubject} ${answer} ${itTail}.`,en:`${ch==='background'?'Back then, ':''}${enSubject} ${enVerb} ${tail}.`,answer,answers,person,role:'ordinary',aux:ch==='past'?scene.aux:null,source:'reviewed-scene',reviewed:true});
 }
 // Polite direct address is a meaning-bearing role, not inferred from capitalization.
 for(let situation=0;situation<scene.uses.length;situation++){
  const female=situation===0,who=female?'Signora Rossi':'Signor Rossi',enWho=female?'Ms Rossi':'Mr Rossi';
  let answers=lessonForms({...e,aux:scene.aux},tense,2);if(ch==='past'&&scene.aux==='essere')answers=answers.filter(x=>x.endsWith(female?'a':'o'));
  if(!answers.length)continue;const answer=answers[0],[itTail,enTail]=scene.uses[situation];
  let en=ch==='future'?`will you ${scene.futureEn?scene.futureEn.replace(/^will /,''):scene.en[0]}`:ch==='past'?`did you ${e.inf==='sapere'?'find out':scene.en[0]}`:ch==='background'?`did you use to ${scene.en[0]}`:ch==='condizionale'?`would you ${scene.en[0]}`:`do you ${scene.en[0]}`;
  if(e.inf==='essere')en=ch==='past'?'were you':ch==='future'?'will you be':ch==='background'?'did you use to be':ch==='condizionale'?'would you be':'are you';
  if(e.inf==='potere')en=ch==='past'?'were you able to':ch==='future'?'will you be able to':ch==='background'?'could you':ch==='condizionale'?'would you be able to':'can you';
  out.push({id:`${e.id}:${ch}:formal-scene-${situation}`,it:`${who}, ${ch==='background'?'a quel tempo ':''}Lei ${answer} ${itTail}?`,en:`${enWho}, ${ch==='background'?'back then, ':''}${en} ${['past','background'].includes(ch)&&e.inf==='credere'&&situation===0?'what Marco said':enTail}?`,answer,answers,person:2,role:'formal',aux:ch==='past'?scene.aux:null,source:'reviewed-scene',reviewed:true});
 }
 return out;
}
const boundary = c => !c || !/[\p{L}’']/u.test(c);
function occurrences(sentence,answer){const out=[];let at=-1;const s=sentence.toLocaleLowerCase('it'),a=answer.toLocaleLowerCase('it');while((at=s.indexOf(a,at+1))>=0)if(boundary(s[at-1])&&boundary(s[at+a.length]))out.push(at);return out;}
const compoundSpanForms=new Map();
function containedInAuxiliaryConstruction(e,sentence,answer,at){
 const key=JSON.stringify([e.inf,e.aux,e.isc]);
 if(!compoundSpanForms.has(key))compoundSpanForms.set(key,[...new Set(TENSES.filter(t=>t.compound).flatMap(t=>Array.from({length:6},(_,person)=>lessonForms(e,t.key,person)).flat()))]);
 // This is a negative span guard, not a tense diagnosis: essere + participle
 // can also be passive. A contained participle is never this bare finite form.
 return compoundSpanForms.get(key).some(form=>form.length>answer.length&&occurrences(sentence,form).some(start=>start<=at&&start+form.length>=at+answer.length));
}
function sourceContexts(e,ch,{legacySource=false,legacyExpanded=false}={}){
 const tense=chapterTense[ch];if(!tense)return [];
 const all=Array.from({length:6},(_,person)=>lessonForms(e,tense,person).map(answer=>({person,answer}))).flat();
 const out=[];
 for(const [index,example]of(e.examples||[]).entries()){
  if(!example.it||!example.en)continue;
  // Restrict untagged examples to a single finite span. Longer compound forms
  // win over their contained auxiliary; source sentences are never rewritten.
  let found=all.flatMap(f=>occurrences(example.it,f.answer).map(at=>({...f,at})));
  if(!found.length)continue;const longest=Math.max(...found.map(f=>f.answer.length));found=found.filter(f=>f.answer.length===longest);
  if(new Set(found.map(f=>`${f.at}:${f.answer}`)).size!==1)continue;
  const uniquePersons=[...new Set(found.map(f=>f.person))];
  // Untagged imperatives can share present forms. A subject in the translation
  // is needed; otherwise preserve the example for teaching only.
  const subject=example.en.match(/^(?:(?:Today|Tomorrow|Yesterday|Now|Often|Usually|Sometimes|Tonight|Last night)[, ]+)?(I|you|he|she|we|they|it)\b/i)?.[1]?.toLowerCase();
  const persons={i:[0],you:[1,4],he:[2],she:[2],it:[2],we:[3],they:[5]}[subject]||[];
  let matching=uniquePersons.filter(p=>persons.includes(p));
  if(!matching.length&&uniquePersons.length===1&&/^(?:Marco|Sara|Maria|Marta|Luca|The [a-z]+)\b/.test(example.en))matching=uniquePersons;
  if(matching.length!==1)continue;
  const {answer,at}=found.find(f=>f.person===matching[0]);
  if(!legacySource&&!TENSE_BY_KEY[tense]?.compound&&containedInAuxiliaryConstruction(e,example.it,answer,at))continue;
  // A bare present auxiliary inside a different past construction is not the
  // selected verb's present use (e.g. avere's ho in ho parlato).
  if(ch==='present'&&['essere','avere'].includes(e.inf)&&/^\s+[\p{L}]+(?:ato|uto|ito|etto|otto|sto|so)\b/u.test(example.it.slice(at+answer.length)))continue;
  const aux=ch==='past'?/(?:^|\s)(?:sono|sei|è|siamo|siete)(?:\s|$)/u.test(answer)?'essere':'avere':null;
  out.push({id:`${e.id}:${ch}:dictionary-${index}`,it:example.it,en:example.en,answer,answers:[answer],person:matching[0],role:'ordinary',aux,source:'dictionary-exact',reviewed:false});
 }
 if(legacyExpanded){
  // Only explicit canonical prior records may restore a retired span. These
  // pools support recovery of history; the journey engine forbids their grading.
  for(const {chapter,...context}of progressiveSpec(e)?.legacyExpandedSourceContexts||[])if(chapter===ch){
   const index=out.findIndex(old=>old.id===context.id);if(index>=0)out[index]=context;else out.push(context);
  }
  out.sort((a,b)=>Number(a.id.match(/dictionary-(\d+)$/)?.[1])-Number(b.id.match(/dictionary-(\d+)$/)?.[1]));
 }
 return out;
}
// The reviewed frame pairs already contain this verb's Italian construction
// and an English predicate. Reuse them in other core tenses only where that
// construction has an unambiguous finite form and a time-neutral complement.
// Exact-scene records cannot be inflected safely and remain separately authored.
const timeBoundFrame=/\b(?:ora|adesso|oggi|ieri|domani|stamattina|stasera|stanotte|stamane|ieri sera|last night|tomorrow|yesterday|today|right now|at the moment|this morning|this evening|tonight)\b/iu;
function finiteFrameEnglish(e,ch,spec,index,enTail){
 let base=spec.en[0],past=spec.en[2],tail=enTail;
 if(e.inf==='dire'&&index===0){base='tell';past='told';}
 if(e.inf==='sapere'&&ch==='past'){base='find out';past='found out';}
 // With these first-encounter and developing-familiarity frames, the finite
 // forms describe meeting Marco or getting to know a place in every time view.
 if(e.inf==='conoscere'){
  base=index===0?'meet':'get to know';past=index===0?'met':'got to know';
 }
 if(e.inf==='ritenere'){
  base='consider';past='considered';
  if(index===0)tail='the proposal valid';
  if(index===1)tail='the answer correct';
 }
 if(e.inf==='volere'&&ch==='condizionale')base='like';
 if(e.inf==='potere'){base='be able to';past='was able to';}
 return {base:base.replace(/^can\b/,'be able to'),past,tail};
}
function reviewedFrameContexts(e,ch,{legacyExpanded=false}={}){
 if(!['past','future','condizionale'].includes(ch))return [];
 const spec=progressiveSpec(e);if(!spec?.frames?.length||!spec.en?.[0])return [];
 if(ch==='past'&&e.aux!=='avere'&&(e.aux!=='essere'||spec.subjects))return [];
 const italian=['Io','Tu','Marta','Noi','Voi','Marta e Luca'],english=['I','You','Marta','We','You all','Marta and Luca'];
 const persons=spec.persons||[0,1,2,3,4,5],out=[];
 const speak=(...parts)=>{const line=parts.filter(Boolean).join(' ').replace(/\s+([,.!?])/g,'$1');return line.replace(/^\p{L}/u,c=>c.toLocaleUpperCase('it')).replace(/[.!?]?$/,'.');};
 for(const [index,frame] of (legacyExpanded&&spec.legacyExpandedFrames?spec.legacyExpandedFrames:spec.frames).entries()){
  // The middle pair is saved for final review in the progressive chapters.
  if(index===2||index===3||e.inf==='avere'&&index===0||frame.some(x=>timeBoundFrame.test(x)))continue;
  const [itTail,enTail]=frame,{base,past,tail}=finiteFrameEnglish(e,ch,spec,index,enTail);
  for(const person of persons){
   const allAnswers=lessonForms(e,chapterTense[ch],person);
   const answers=ch==='past'&&e.aux==='essere'&&person===2?allAnswers.filter(x=>x.endsWith('a')):ch==='past'&&e.aux==='essere'&&person===5?allAnswers.filter(x=>x.endsWith('i')):allAnswers;
   if(!answers.length)continue;
   const subject=spec.subjects?.[person]||[italian[person],english[person]];
   const answer=answers[0],enPredicate=ch==='past'?past?.replace(/^was\b/,person===0||person===2?'was':'were'):`${ch==='future'?'will':'would'} ${base}`;if(!enPredicate)continue;
   const englishLine=speak(subject[1],enPredicate,tail).replace(/\{poss\}/g,['my','your','her','our','your','their'][person]);
   out.push({id:`${e.id}:${ch}:reviewed-frame-${index}:person-${person}`,it:speak(subject[0],answer,itTail),en:englishLine,answer,answers,person,role:'ordinary',aux:ch==='past'?e.aux:null,source:'reviewed-frame',reviewed:true});
  }
  if(spec.formal===false||!persons.includes(2))continue;
  const allAnswers=lessonForms(e,chapterTense[ch],2),answers=ch==='past'&&e.aux==='essere'?allAnswers.filter(x=>x.endsWith('a')):allAnswers;if(!answers.length)continue;
  const answer=answers[0];
  const enVerb=ch==='past'?/^be\b/.test(base)?`were you ${base.replace(/^be\b\s*/,'')}`:`did you ${base}`:ch==='future'?`will you ${base}`:`would you ${base}`;
  const formalEnglish=`Ms Rossi, ${enVerb} ${tail}?`.replace(/\{poss\}/g,'your');
  out.push({id:`${e.id}:${ch}:reviewed-frame-${index}:formal`,it:`Signora Rossi, Lei ${answer} ${itTail}?`,en:formalEnglish,answer,answers,person:2,role:'formal',aux:ch==='past'?e.aux:null,source:'reviewed-frame',reviewed:true});
 }
 return out;
}
export function lessonContexts(entry,chapterId,{expanded=true,legacySource=false,legacyExpanded=false}={}){
 const original=(rows[entry.inf]?.[chapterId]||[]).map(([it,en,answer,person,aux],i)=>({id:`${entry.id}:${chapterId}:situation-${i}`,it,en,answer,answers:[answer],person,role:'ordinary',aux:aux||null,source:'reviewed-sentence',reviewed:true}));
 const legacy=[...sceneContexts(entry,chapterId),...original,...sourceContexts(entry,chapterId,{legacySource,legacyExpanded})];
 return expanded?[...legacy,...reviewedFrameContexts(entry,chapterId,{legacyExpanded})]:legacy;
}
export function lessonForms(entry,tense,person) {
 if(sensePersons[entry.inf] && (!sensePersons[entry.inf].includes(person)||tense==='imperativo'))return [];
 if(['concernere','ostare'].includes(entry.inf)&&(TENSE_BY_KEY[tense]?.compound||tense==='passatoRemoto'))return [];
 entry=lessonEntry(entry);
 let c;try{c=conjugate(entry.inf,{aux:entry.aux,isc:entry.isc});}catch{return [];}
 const index=tense==='imperativo'?[1,2,3,4,5].indexOf(person):person;
 let forms=index<0?[]:clean(c.tenses[tense]?.[index]);
 if(WEATHER_VERBS.has(entry.inf)){if(person!==2||tense==='imperativo')return []; if(tense==='passatoProssimo')forms=forms.filter(f=>!/[ae]$/.test(f));}
 return senseForms(entry,forms);
}
export function formalLessonForms(e,tense,female){
 e=lessonEntry(e);
 const forms=lessonForms(e,tense,2),c=conjugate(e.inf,{aux:e.aux,isc:e.isc});
 if(!TENSE_BY_KEY[tense]?.compound||e.aux==='avere'&&!c.clitic||c.clitic&&!['si','sene'].includes(c.clitic))return forms;
 const essereForms=lessonForms({...e,aux:'essere'},tense,2);
 return forms.filter(f=>!essereForms.includes(f)||!/[oa]$/.test(f)||f.endsWith(female?'a':'o'));
}
function presentTeaching(e,c){
 const {base,clitic}=splitClitic(e.inf),cls=c?.cls||base.slice(-3),stem=base.slice(0,-3);
 const endings={are:['o','i','a','iamo','ate','ano'],ere:['o','i','e','iamo','ete','ono'],ire:['o','i','e','iamo','ite','ono']}[cls];
 const irregular=c?irregularCells(e.inf,{aux:e.aux,isc:e.isc}).presente||[]:[];
 const notes=['Io means I, tu means one informal you, lui/lei means he/she, noi means we, voi means more than one you, and loro means they. The verb ending agrees with that subject.'];
 if(!endings||irregular.length===6)notes.push('This verb does not follow the simple regular present model. Learn the actual forms shown here; do not construct it by removing three letters and attaching an ending.');
 else {
  notes.push(`The regular -${cls} model removes -${cls} and uses these endings in person order: ${endings.join(', ')}. ${irregular.length?'Some of this verb’s forms depart from that model.':`For ${base}, start from ${stem}-.`}`);
  if(c?.isc)notes.push(`This verb uses -isc- in io, tu, lui/lei/Lei and loro: ${[0,1,2,5].map(p=>lessonForms(e,'presente',p)[0]).join(', ')}. Noi and voi do not use -isc-. Other -ire verbs, such as dormire, follow a different pattern.`);
  if(/(?:care|gare)$/.test(base))notes.push('Keep the hard c/g sound: write h before i in forms such as the tu and noi forms shown here.');
  if(/(?:ciare|giare)$/.test(base))notes.push('The spelling changes when an ending begins with i: use the actual spellings in this table rather than adding a second i.');
  if(/iare$/.test(base)&&!/(?:ciare|giare)$/.test(base))notes.push('Pay attention to the written i where stem and ending meet; the actual spellings below account for this verb’s pattern.');
 }
 if(irregular.length)notes.push(`Remember these forms separately: ${irregular.map(p=>`${PERSONS[p]} ${lessonForms(e,'presente',p).join(' / ')}`).join('; ')}.`);
 if(clitic)notes.push(`The infinitive ${e.inf} includes a pronoun. Keep the pronoun before the finite verb: ${lessonForms(e,'presente',0).join(' / ')}. In the ordinary reflexive pattern: mi, ti, si, ci, vi, si.`);
 return notes;
}
function participleTeaching(e,c){
 const forms=lessonParticiples(e),{base}=splitClitic(e.inf);
 const ending=base.match(/(are|ere|ire)$/)?.[1];
 const regular=ending?base.slice(0,-3)+{are:'ato',ere:'uto',ire:'ito'}[ending]:null;
 const exceptions=forms.filter(form=>form!==regular);
 const selected=forms.length?`For ${e.inf}, learn ${forms.join(' / ')}.`:'A past participle is not available for this entry.';
 const exception=exceptions.length?(regular&&forms.includes(regular)?` Alongside ${regular}, this verb has the irregular participle ${exceptions.join(' / ')}. Learn which meaning or construction each form belongs to.`:` ${e.inf} has an irregular past participle: ${exceptions.join(' / ')}. Learn it directly; the regular ending rule alone does not produce it.`):'';
 return `${selected} For regular participles, replace the infinitive ending: -are → -ato, -ere → -uto, -ire → -ito. These are patterns with exceptions, not rules for every verb. Examples: parlare → parlato, credere → creduto, dormire → dormito.${exception}`;
}
function futureTeaching(e){
 const forms=Array.from({length:6},(_,p)=>lessonForms(e,'futuro',p));
 const endings=['ò','ai','à','emo','ete','anno'];const p=forms.findIndex(f=>f.length);
 if(p<0)return 'A future form is not available for this verb.';
 const finite=forms[p][0].split(' ').at(-1),stem=finite.endsWith(endings[p])?finite.slice(0,-endings[p].length):null;
 const {base}=splitClitic(e.inf),normal=base.endsWith('are')?`${base.slice(0,-3)}er`:base.slice(0,-1);
 return `${TENSE_LESSONS.futuro} ${stem?`For ${e.inf}, the stem is ${stem}-. ${stem!==normal?'This differs from simply dropping the final e; learn this spelling. ':''}${stem}- + ${endings[p]} → ${finite}.`:`Learn its forms individually.`} Regular -are changes to -er-; regular -ere keeps -er-; regular -ire keeps -ir-. Add the endings in person order: io -ò, tu -ai, lui/lei/Lei -à, noi -emo, voi -ete, loro -anno.`;
}
function imperfectTeaching(e) {
 const form=lessonForms(e,'imperfetto',0)[0]||lessonForms(e,'imperfetto',2)[0]||'';
 return `The imperfetto describes past habits, states and background: what used to happen or was happening. Regular endings use -avo, -avi, -ava, -avamo, -avate, -avano for -are; -evo… for -ere; and -ivo… for -ire. ${e.inf} → ${form}. Essere uses ero, eri, era, eravamo, eravate, erano; fare, dire and bere use facevo, dicevo and bevevo. A completed event is usually practised separately with the passato prossimo.`;
}
function conditionalTeaching(e) {
 const endings=['ei','esti','ebbe','emmo','este','ebbero'];
 const p=Array.from({length:6},(_,person)=>lessonForms(e,'condizionale',person)).findIndex(forms=>forms.length);
 const finite=p>=0?lessonForms(e,'condizionale',p)[0].split(' ').at(-1):'',stem=p>=0&&finite.endsWith(endings[p])?finite.slice(0,-endings[p].length):'';
 return `The condizionale presente can express a wish, a polite request or a hypothetical result. It does not state a definite future plan. Keep the future stem, including its final r, and add io -ei, tu -esti, lui/lei/Lei -ebbe, noi -emmo, voi -este, loro -ebbero. ${stem?`${e.inf}: ${stem}- + ${endings[p]} → ${finite}.`:''} Common stems include essere → sar-, avere → avr-, andare → andr-, fare → far-, volere → vorr- and potere → potr-. Vorrei un caffè means I would like a coffee; Potrebbe aiutarmi? is a polite request. A hypothetical result can be Andrei, se avessi tempo — I would go if I had time. Do not use the conditional in place of the required form after se in this pattern. The past conditional, avrei parlato, is a separate later topic.`;
}
function verbLesson(e,{legacy=false,legacyExpanded=false}={}) {
 const spec=progressiveSpec(e),priorEntry=spec?.legacyExpandedExamples?{...e,examples:spec.legacyExpandedExamples}:e;
 if(legacyExpanded)e=priorEntry;
 const previous=legacy?null:verbLesson(e,{legacy:true});
 const chapters=[];let c;try{c=conjugate(e.inf,{aux:e.aux,isc:e.isc});}catch{c=null;}
 const refs=(e.examples||[]).filter(x=>x.it&&x.en).map(x=>({it:x.it,en:x.en}));
 chapters.push({id:'meet',title:`Meet ${e.inf}`,tense:null,groups:[{id:'meaning',title:'Meaning and use',cards:[card('meaning',e.inf,e.en,(lessonContexts(e,'present').length?lessonContexts(e,'present'):refs).slice(0,1).map(x=>({it:x.it,en:x.en})),[],[e.inf==='credere'?'Credere a qualcuno means believing what that person says. Credere in qualcuno means having confidence in that person.':e.inf==='dire'?'Dire has forms to learn individually: dico in the present, detto as its past participle, and dir- as its future stem. You will meet each pattern before using it.':'Learn the meaning together with the construction.']),{...card('reference','Usage reference',e.inf==='credere'?(e.usage||e.en).replace("'credo che' takes the subjunctive","'credo che' often introduces a subjunctive clause; the mood depends on the construction and meaning"):e.usage||e.en,refs,[],['Explore these other uses whenever you want; some include grammar from later chapters.']),reference:true}],targets:[]}]});
 for(const [ch,title,tense]of stages){
  const authored=!legacy&&['present','background'].includes(ch)?simpleVerbContexts(e,{chapter:ch,legacyExpanded}):[];
  const oldAuthored=!legacy&&authored.length?simpleVerbContexts(e,{chapter:ch,legacySelection:true}):[];
  const baseline=lessonContexts(priorEntry,ch,{expanded:false,legacySource:true});
  const active=legacy?baseline:lessonContexts(e,ch,{legacyExpanded});
  const contexts=authored.length?[...authored,...active.filter(c=>!authored.some(a=>a.it===c.it&&a.en===c.en))]:active;
  const weather=WEATHER_VERBS.has(e.inf),experiencer=e.inf==='piacere';
  const groups=[];
  if(ch==='past')groups.push({id:'building',title:'Build the past',cards:[card('auxiliary','Start with the auxiliary',`${e.inf} uses ${e.aux==='both'?'an auxiliary that depends on its construction':e.aux||'its dictionary auxiliary'}. The auxiliary carries the person.`,[],[{label:'avere',form:'ho · hai · ha · abbiamo · avete · hanno',gloss:'present forms used to build the past'},{label:'essere',form:'sono · sei · è · siamo · siete · sono',gloss:'present forms used to build the past'}]),card('participle','Add the past participle',participleTeaching(e,c),[],[],[e.aux==='essere'?'With essere, agreement follows the subject: Marco è arrivato; Sara è arrivata. Formal Lei still uses è; the ending follows the addressee.':'In the simple avere constructions here, the participle does not change with the person. Object-pronoun agreement is a later topic.'])],targets:[target(e,ch,'auxiliary-part','auxiliary',{tense,person:weather?2:0,required:false,guidedOnly:true,guidedFormat:'type',available:lessonForms(e,tense,weather?2:0).length>0}),target(e,ch,'participle-part','participle',{tense,required:false,guidedOnly:true,guidedFormat:'type',available:lessonParticiples(e).length>0})]});
  if(ch==='future')groups.push({id:'stem',title:'Build the future',cards:[card('stem','Stem, then ending',futureTeaching(e))],targets:[]});
  for(const [g,ps]of [['singular',[0,1,2]],['plural',[3,4,5]]]){
   const persons=ps.filter(p=>lessonForms(e,tense,p).length&&(!weather||p===2)&&(!experiencer||[2,5].includes(p)));
   if(!persons.length)continue;
   const forms=persons.map(p=>({label:(!legacy&&progressiveSpec(e)?.subjects?.[p]?.[0])||senseSubject(e,p)||(weather?'impersonal':p===2?'lui / lei / Lei (formal you)':PERSONS[p]),form:lessonForms(e,tense,p).join(' / '),gloss:(!legacy&&progressiveSpec(e)?.subjects?.[p]?.[1])||senseSubject(e,p)||(weather?'it (weather)':p===2?'he / she / you politely':['I','you (one person)','he / she','we','you (more than one)','they'][p])}));
   const notes=[...(ch==='present'?presentTeaching(e,c):ch==='background'?[imperfectTeaching(e)]:[]),weather?'Weather use has no personal subject. Say piove, without lui or lei.':experiencer?'With piacere, the liked thing is the grammatical subject: mi piace il libro, mi piacciono i libri.':sensePersons[e.inf]?'Use the grammatical subject of this dictionary sense, not the person affected.':'Lei addresses one person politely and takes the third-person singular form. It does not add a seventh form.'];
   if(c?.clitic)notes.push('Keep the small pronouns with this verb; their form can change with the person.');
   if(e.aux==='both'&&ch==='past')notes.push('The table shows possibilities across constructions. A sentence uses only the auxiliary allowed by that particular construction.');
   if(sensePersons[e.inf])notes.push(e.inf==='bisognare'?'In the necessity meaning taught here, bisognare is impersonal: use the third-person singular.':'In the meaning taught here, the grammatical subject is the thing, situation or requirement. Practise third-person singular and plural; do not treat the person affected as the subject.');
   const ts=persons.map(p=>{const situations=contexts.filter(x=>x.person===p&&x.role!=='formal');return target(e,ch,`form-${p}`,'conjugation',{person:p,tense,role:'ordinary',subjectLabel:senseSubject(e,p),guidedFormat:p%2?'type':'match',evidenceScope:situations.length?'construction':'form',contextIds:situations.map(x=>x.id),contextAvailable:situations.length>=2});});
   if(ps.includes(2)&&!weather&&!experiencer&&!sensePersons[e.inf])ts.push(target(e,ch,'formal','address',{person:2,tense,role:'formal',evidenceScope:contexts.some(x=>x.role==='formal')?'construction':'address',contextAvailable:contexts.filter(x=>x.role==='formal').length>=2}));
   groups.push({id:g,title:weather?'Weather form':experiencer?'The thing you like':g==='singular'?'One person':'More than one person',cards:[card(`${g}-forms`,title,ch==='condizionale'?conditionalTeaching(e):TENSE_LESSONS[tense],contexts.filter(x=>persons.includes(x.person)).filter((x,i)=>i<2).map(x=>({it:x.it,en:x.en})),forms,notes)],targets:ts});
  }
  if(weather)groups[0]?.targets.push(target(e,ch,'time-meaning','timeMeaning',{tense,required:false,supplementalOnly:true}),target(e,ch,'subject-use','subjectUse',{tense,required:false,supplementalOnly:true}));
  if(sensePersons[e.inf])groups[0]?.targets.push(target(e,ch,'time-meaning','timeMeaning',{tense,required:false,supplementalOnly:true}),target(e,ch,'subject-use','subjectUse',{tense,required:false,supplementalOnly:true,fact:e.inf==='bisognare'?'An impersonal necessity construction':'The thing or situation is the grammatical subject'}));
  groups.push({id:'use',title:'Use it in a situation',cards:[card('situations','Meaning in context',contexts.length?'Notice what the speaker means, then practise the whole verb form.':'Explore the dictionary examples, then practise the forms for this chapter. More situations can be added as you learn.',contexts.filter((x,i)=>i<2).map(x=>({it:x.it,en:x.en})))],targets:[target(e,ch,'context','context',{tense,guidedFormat:'type',available:!!contexts.length,required:!['background','condizionale'].includes(ch)&&!!contexts.length,evidenceScope:'context',contextIds:contexts.map(x=>x.id),reason:contexts.length?null:'Sentence practice is not yet available for this chapter.'})]});
  if(!legacy){
   const sceneFor=(list,t)=>list.filter(x=>t.skill==='context'||x.person===t.person&&x.role===(t.role||'ordinary'));
   for(const group of groups)for(const t of group.targets){
    if(!['conjugation','address','context'].includes(t.skill))continue;
    const expanded=sceneFor(contexts,t),original=sceneFor(oldAuthored.length?oldAuthored:baseline,t);
    const oldScenes=original.length?original:sceneFor(baseline,t);
    if(expanded.length){
     const varied=variedContextOrder(expanded);
     const offset=t.skill==='context'||t.role==='formal'||!Number.isInteger(t.person)?0:t.person%varied.length;
     t.contexts=offset?[...varied.slice(offset),...varied.slice(0,offset)]:varied;
     t.legacyAuthoredContexts=oldScenes;t.authoredContexts=['present','background'].includes(ch);
     t.contextIds=t.contexts.map(x=>x.id);t.contextAvailable=t.contexts.length>=2;
     if(t.skill!=='context')t.evidenceScope='construction';
    }else if(oldScenes.length){t.legacyAuthoredContexts=oldScenes;}
   }
   const formTargets=groups.flatMap(g=>g.targets).filter(t=>['conjugation','address'].includes(t.skill)&&t.available!==false&&t.required!==false);
   const useTarget=groups.find(g=>g.id==='use')?.targets[0];
   if(useTarget?.available&&formTargets.length&&formTargets.every(t=>t.contextAvailable)){
    useTarget.required=false;useTarget.coveredByContextualForms=true;
   }
  }
  let legacyRequirements;
  if(['present','background'].includes(ch)){
   if(legacy)groups.push(legacyProgressiveGroup(e,{chapter:ch}));
   else{
    // Old target ids retain their evidence. New construction checks have their
    // own ids and cannot inherit a guessed generic usage answer.
    legacyRequirements=previous.find(c=>c.id===ch).groups.flatMap(g=>g.targets).map(t=>({id:t.id,required:t.required,available:t.available,completionRequired:!!t.completionRequired,supplementalOnly:!!t.supplementalOnly}));
    groups.forEach(g=>g.stage='forms');
    groups.push(buildProgressiveGroup(e,{chapter:ch,legacyExpanded}));
    groups.push(buildVerbMixedGroup(e,{chapter:ch,groups:groups.filter(Boolean),fallbackSimple:lessonContexts(e,ch,{legacyExpanded}),legacyExpanded}));
   }
  }
  chapters.push({id:ch,title,tense,groups:groups.filter(Boolean),...(!legacy&&legacyRequirements&&progressiveSpec(e)?{flowVersion:2,legacyRequirements}: {})});
 }
 chapters.push({id:'mixed',title:'Use what you learned',tense:null,optional:true,groups:[{id:'transfer',title:'Five cases together',cards:[card('transfer','Choose from meaning','Review the intended time and meaning. These checks use the completed chapters together.')],targets:stages.map(([ch,,tense])=>{const contexts=lessonContexts(legacy?priorEntry:e,ch,{expanded:!legacy,legacySource:legacy,legacyExpanded});return target(e,'mixed',ch,'context',{tense,sourceChapter:ch,available:!!contexts.length,required:!!contexts.length,evidenceScope:'context',reason:contexts.length?null:'Sentence practice is not yet available for this chapter.'});})}]});
 if(!legacy)for(const t of chapters.at(-1).groups[0].targets){
  const oldScenes=lessonContexts(priorEntry,t.sourceChapter,{expanded:false,legacySource:true}),expanded=lessonContexts(e,t.sourceChapter,{legacyExpanded});
  if(oldScenes.length)t.legacyAuthoredContexts=oldScenes;
  if(expanded.length){t.contexts=variedContextOrder(expanded);t.legacyAuthoredContexts=oldScenes;t.authoredContexts=['present','background'].includes(t.sourceChapter);t.contextIds=t.contexts.map(c=>c.id);}
 }
 if(!legacy){
  const mixed=chapters.find(ch=>ch.id==='mixed').groups[0];
  for(const ch of chapters.filter(ch=>['present','background'].includes(ch.id))){
   const progressive=ch.groups.find(g=>g.finalReview)?.targets.find(t=>t.progressive);
   if(progressive)mixed.targets.push({...progressive,id:id(e,'mixed',`v2-${ch.id}-progressive`),sourceChapter:ch.id,dependsOn:[],finalReview:true});
  }
 }
 for(const t of TENSES.filter(t=>!stages.some(x=>x[2]===t.key))){
  const ch=t.key==='imperfetto'?'background':t.key,weather=WEATHER_VERBS.has(e.inf),persons=(t.key==='imperativo'?[1,2,3,4,5]:[0,1,2,3,4,5]).filter(p=>lessonForms(e,t.key,p).length&&(!weather||p===2)&&(e.inf!=='piacere'||[2,5].includes(p)));
  if(!persons.length)continue;
  const description=TENSE_LESSONS[t.key]||({futuroAnteriore:'Describe something that will already have happened by a future point. Build the future auxiliary plus the past participle.',condizionalePassato:'Describe a hypothetical past result or a future event viewed from the past. Build the conditional auxiliary plus the past participle.',congiuntivoPassato:'Use a subjunctive auxiliary plus the past participle when the surrounding construction calls for a completed event in the subjunctive.',congiuntivoTrapassato:'Use the imperfect subjunctive auxiliary plus the past participle in an appropriate past or hypothetical construction.',trapassatoRemoto:'This literary form presents an event completed before another past event. It uses a passato remoto auxiliary plus the past participle.'}[t.key]||`Explore the ${t.name} forms.`);
  const groups=[];
  for(const [g,ps]of [['singular',[0,1,2]],['plural',[3,4,5]]]){
   const groupPersons=persons.filter(p=>ps.includes(p));if(!groupPersons.length)continue;
   const label=p=>senseSubject(e,p)||(weather?'impersonal':t.key==='imperativo'&&p===2?'Lei (polite singular you)':t.key==='imperativo'&&p===5?'Loro (very formal plural you)':p===2?'lui / lei / Lei':PERSONS[p]);
   groups.push({id:g,title:g==='singular'?'One person':'More than one person',cards:[card(`${g}-forms`,t.name,description,[],groupPersons.map(p=>({label:label(p),form:lessonForms(e,t.key,p).join(' / '),gloss:label(p)})),[t.key==='imperativo'?'The imperative addresses someone: it has no io form. Lei is polite singular you; Loro is a very formal plural address.':sensePersons[e.inf]?'Use the thing or situation as the grammatical subject in this dictionary sense.':'Formal Lei uses third-person singular. Keep the subject and any agreement in mind.'])],targets:groupPersons.map(p=>target(e,ch,`form-${p}`,'conjugation',{tense:t.key,person:p,subjectLabel:senseSubject(e,p),role:t.key==='imperativo'&&p===2?'formal':t.key==='imperativo'&&p===5?'formalPlural':'ordinary',guidedFormat:p%2?'type':'match',evidenceScope:'form'}))});
  }
  if(t.key!=='imperativo'&&!weather&&!sensePersons[e.inf]&&e.inf!=='piacere'&&persons.includes(2))groups[0].targets.push(target(e,ch,'formal','address',{tense:t.key,person:2,role:'formal',evidenceScope:'form'}));
  if(weather)groups[0].targets.push(target(e,ch,'time-meaning','timeMeaning',{tense:t.key,required:false,supplementalOnly:true,fact:description}),target(e,ch,'subject-use','subjectUse',{tense:t.key,required:false,supplementalOnly:true}));
  chapters.push({id:ch,title:t.key==='imperfetto'?'Past stories and background':t.name,tense:t.key,optional:true,groups});
 }
 if(spec?.sceneRevision){
  const prior=!legacy&&!legacyExpanded?verbLesson(priorEntry,{legacyExpanded:true}):null;
  const priorTargets=new Map(prior?.flatMap(chapter=>chapter.groups.flatMap(group=>group.targets||[])).map(t=>[t.id,t])||[]);
  for(const chapter of chapters)for(const t of chapter.groups.flatMap(group=>group.targets||[])){
   t.sceneRevision=spec.sceneRevision;t.legacyExpandedRevision=spec.legacyExpandedRevision;
   if(spec.retiredExpandedContextIds)t.retiredExpandedContextIds=[...spec.retiredExpandedContextIds];
   if(legacy&&['conjugation','address','context'].includes(t.skill))t.legacyAuthoredContexts=lessonContexts(priorEntry,t.sourceChapter||chapter.id,{expanded:false,legacySource:true}).filter(c=>t.skill==='context'||c.person===t.person&&c.role===(t.role||'ordinary'));
   const old=priorTargets.get(t.id);
   // Rebuild the whole canonical previous plan. Removed contexts, pool size,
   // per-person rotation and ordering must not be inferred from current IDs.
   if(old?.contexts?.length)t.legacyExpandedContexts=old.contexts;
  }
 }
 return chapters;
}
export function lessonEntry(entry){
 if(verb(entry)){
  const selected=entry.inf==='ripartire'&&entry.isc?{...entry,aux:'avere'}:entry;
  return entry.inf==='riflettere'?{...selected,en:'to think over; to reflect on',referenceMeanings:entry.en}:entry.inf==='inferire'?{...selected,en:'to infer; to deduce',referenceMeanings:entry.en}:selected;
 }
 const meanings=String(entry.en||'').split(';').map(s=>s.trim()).filter(Boolean);
 const translation=String(entry.exEn||'').toLocaleLowerCase('en');
 const taught=meanings.find(m=>{const plain=m.replace(/\([^)]*\)/g,'').trim().toLocaleLowerCase('en');return plain.length>1&&translation.includes(plain);})||meanings[0]||'';
 // Synonymous regional names retain both accepted labels for the same sport.
 return {...entry,en:entry.it==='calcio'&&entry.pos==='noun'&&isUncountable(entry)?'football; soccer':taught,referenceMeanings:entry.en||'',senseSelection:translation.includes(taught.toLocaleLowerCase('en'))?'example-supported':'first-recorded'};
}
function wordLesson(e){
 const original=e;e=lessonEntry(e);
 const noun=e.pos==='noun',adj=e.pos==='adj',ctx=wordContext(e);const examples=e.ex?[{it:e.ex,en:e.exEn||''}]:[];
 const meaning={id:'meaning',title:'Meaning',tense:null,groups:[{id:'meaning',title:'Meet the word',cards:[card('meaning',noun?nounLabel(e,isPluralOnly(e)):e.it,e.en,examples,[],e.note?[e.note]:[]),...(original.en!==e.en?[{...card('other-meanings','Dictionary meanings',original.en,[],[],['This lesson follows the meaning used above. Other uses remain in the reference.']),reference:true}]:[])],targets:[target(e,'meaning','meaning','meaning'),target(e,'meaning','recall','recall')]}]};
 const forms=[],targets=[],notes=[];
 if(noun){
  const pluralOnly=isPluralOnly(e);
  forms.push({label:pluralOnly?'Normally plural':'Singular',form:nounLabel(e,pluralOnly),gloss:e.en});
  if(hasPluralForm(e)&&!pluralOnly){forms.push({label:'Plural',form:nounLabel(e,true),gloss:'more than one'});targets.push(target(e,'forms','plural','plural',{available:!!e.g||e.it!==e.pl,reason:!e.g&&e.it===e.pl?'The article is needed to show this unchanged noun’s number. Add its gender to practise it.':null}));}
  else notes.push(nounNumberNote(e));
  if(e.g)targets.unshift(target(e,'forms','article','article',{number:pluralOnly?'plural':'singular'}));
  // A singular-use sense is checked on its number rather than on a plural it does
  // not normally use. The fact target keeps the long path answerable too.
  const number=e.g&&isSingularUse(e)?nounNumberChoices(e):null;
  if(number)targets.push(target(e,'forms','number','number',{required:false,supplementalOnly:true,fact:number.fact,question:number.question,distractors:number.distractors,answerLanguage:'en'}));
  notes.push(e.g==='f'?'This noun is feminine.':e.g==='m'?'This noun is masculine.':e.g==='mf'?'This noun can refer to masculine or feminine people; use the applicable article.':'Gender is not recorded for this noun.');
  const rule=articleRuleNote(e);if(rule)notes.push(rule);
 }
 if(adj&&e.forms?.length===4){['masculine singular','feminine singular','masculine plural','feminine plural'].forEach((label,i)=>{forms.push({label,form:e.forms[i],gloss:label});targets.push(target(e,'forms',`agreement-${i}`,'agreement',{formIndex:i,evidenceScope:'agreement'}));});}
 if(adj&&!e.forms?.length&&/invariable/i.test(e.note||'')){
  forms.push({label:'Unchanged form in this use',form:e.it,gloss:e.en});notes.push('Use the unchanged adjective form taught in this entry.');
  targets.push(target(e,'forms','agreement-invariable','agreement',{invariant:true,answerForm:e.it,formLabel:'unchanged',evidenceScope:'agreement'}));
 }else if(adj&&!e.forms?.length&&/feminine only/i.test(e.note||'')){
  const plural=(e.note||'').match(/plural\s+['“"]?([\p{L}’'-]+)/iu)?.[1]?.replace(/['’]$/,'');
  forms.push({label:'Feminine singular',form:e.it,gloss:e.en});
  targets.push(target(e,'forms','agreement-feminine-singular','agreement',{answerForm:e.it,formLabel:'feminine singular',evidenceScope:'agreement'}));
  if(plural){forms.push({label:'Feminine plural',form:plural,gloss:e.en});targets.push(target(e,'forms','agreement-feminine-plural','agreement',{answerForm:plural,formLabel:'feminine plural',evidenceScope:'agreement'}));}
 }
 if(!noun&&!adj)notes.push(e.pos==='prep'?'Learn this preposition with its construction. It does not have one universal English equivalent.':'Learn where this word fits in the phrase and what it adds to the meaning.');
 const useTarget=target(e,'use','context','context',{available:!!ctx,required:!!ctx,evidenceScope:'context',reason:ctx?null:'A suitable sentence example is not yet available.'});
 return [meaning,{id:'forms',title:adj?'Agreement':noun?'Article and number':'How to use it',tense:null,groups:[{id:'forms',title:'Notice the form',cards:[card('forms','Use the right form',e.note||'Learn the form together with its meaning.',examples,forms,notes)],targets}]},{id:'use',title:'Use it in context',tense:null,groups:[{id:'use',title:'A useful situation',cards:[card('use','Connect word and meaning',e.pos==='prep'?'Practise the construction in this example. Other constructions may use different prepositions.':'Use the word in its taught meaning.',examples)],targets:[useTarget,target(e,'use','listening','listening',{required:false,evidenceScope:'listening'})]}]}];
}
const eAux=e=>e.aux==='both'?['avere','essere']:e.aux?[e.aux]:[];
const functionFacts={noun:['Names a person, place, thing or concept.','Article and number can matter.'],adj:['Describes a noun or pronoun.','Agreement follows the noun’s gender and number.'],adv:['Modifies an action, description or another adverb.','Its role is to describe how, when or where something happens.'],prep:['Links words in a relationship.','Learn its construction; English translations vary.'],conj:['Connects words or clauses.','Learn how it links the surrounding ideas.'],pron:['Refers to a person or thing without repeating its name.','Learn the particular pronoun and its role.'],det:['Specifies a noun, such as which one or how many.','Learn its form together with the noun.'],num:['Expresses a number or order.','Learn this number expression together.'],interj:['Expresses a reaction or greeting.','Learn its situation and tone.'],expr:['Expresses a meaning as a fixed phrase.','Learn the whole expression together.']};
export function lessonExposureForms(e,answers,skill){
 const out=[...answers];
 if(e.pos!=='noun'||!['recall','context','listening','plural'].includes(skill)||skill==='plural'&&e.it===e.pl)return [...new Set(out.filter(Boolean))];
 for(const answer of answers){const bare=String(answer).replace(/^(?:(?:il|lo|la|i|gli|le)\s+|l['’])/i,'');
  if(bare.toLocaleLowerCase('it')===e.it?.toLocaleLowerCase('it')){out.push(e.it);if(e.g)out.push(withArticle(e,isPluralOnly(e)));}
  if(bare.toLocaleLowerCase('it')===e.pl?.toLocaleLowerCase('it')){out.push(e.pl);if(e.g)out.push(withArticle(e,true));}
 }
 return [...new Set(out.filter(Boolean))];
}
function finalize(entry,plan){
 plan.references=[];
 for(const chapter of plan.chapters){
  if(plan.kind==='word'){
   const facts=functionFacts[entry.pos]||functionFacts.expr;
   const first=chapter.groups[0];
   if(first){
    first.cards.push(card('word-facts','Notice its role',facts.join(' ')));
    first.targets.push(target(entry,chapter.id,'word-function','wordFunction',{required:false,supplementalOnly:true,fact:facts[0]}),target(entry,chapter.id,'word-pattern','wordPattern',{required:false,supplementalOnly:true,fact:facts[1]}));
   }
  }
  for(const group of chapter.groups){
   plan.references.push(...group.cards.filter(c=>c.reference).map(c=>({...c,chapterId:chapter.id,groupId:group.id})));
   group.cards=group.cards.filter(c=>!c.reference);
  }
  for(const group of chapter.groups)for(const t of group.targets){
   if(t.progressive||t.finalReview)continue; // Explicit authored progressive variants belong to their own construction.
   let answers=[];t.independentVariantCount=2;
   if(plan.kind==='verb'){
    const contexts=(t.contexts||(plan.flowVersion!==2?t.legacyAuthoredContexts:null)||lessonContexts(entry,t.sourceChapter||chapter.id,{expanded:plan.flowVersion===2})).filter(x=>t.skill==='context'||x.person===t.person&&x.role===(t.role||'ordinary'));
    if(['context','address','conjugation'].includes(t.skill)&&contexts.length){t.answerFormsByVariant=contexts.map(x=>x.answers||[x.answer]);t.personsByVariant=contexts.map(x=>x.person);answers=t.answerFormsByVariant.flat();t.independentVariantCount=contexts.length*2;}
    else if(t.skill==='conjugation')answers=lessonForms(entry,t.tense,t.person);
    else if(t.skill==='address'){t.answerFormsByVariant=[formalLessonForms(entry,t.tense,true),formalLessonForms(entry,t.tense,false)];answers=t.answerFormsByVariant.flat();}
    else if(t.skill==='auxiliary')answers=eAux(entry).flatMap(aux=>clean(conjugate(aux).tenses.presente[t.person??0]));
    else if(t.skill==='participle')answers=lessonParticiples(entry);
    else if(t.skill==='timeMeaning')answers=[chapter.id==='past'?'A completed event':chapter.id==='future'?'A future event':chapter.id==='background'?'Past habits or background':chapter.id==='condizionale'?'A wish, polite request or hypothetical result':'Now or a routine'];
    else if(t.skill==='subjectUse')answers=['An impersonal weather construction'];
   }else{
    if(t.skill==='meaning'){answers=String(lessonEntry(entry).en||'').split(/[;,]/).map(s=>s.trim());t.independentVariantCount=entry.ex?2:1;}
    if(t.skill==='recall'||t.skill==='listening'||t.skill==='context')answers=[entry.it,entry.pos==='noun'&&entry.g&&withArticle(entry,isPluralOnly(entry)),wordContext(entry)?.form];
    if(t.skill==='article')answers=[...String(article(entry,isPluralOnly(entry))||'').split('/'),...(hasPluralForm(entry)?String(article(entry,true)||'').split('/'):[]),withArticle(entry,isPluralOnly(entry))];
    if(t.skill==='plural')answers=!entry.g?[entry.pl]:entry.it===entry.pl?[withArticle(entry,true)]:[entry.pl,withArticle(entry,true)];
    if(t.skill==='agreement'){answers=[t.answerForm||entry.forms?.[t.formIndex]];t.independentVariantCount=entry.exEn?2:1;}
    if(t.fact){answers=[t.fact];t.independentVariantCount=0;}
    if(['recall','context','listening'].includes(t.skill)&&!wordContext(entry)&&!entry.exEn)t.independentVariantCount=1;
   }
   if(t.fact)answers=[t.fact];
   if(plan.kind==='word'&&!t.fact&&t.skill!=='agreement'){const e=lessonEntry(entry),o={id:t.id,entryId:entry.id,kind:'word',skill:t.skill,tense:null,stage:'future'};t.answerFormsByVariant=[0,1].map(variant=>buildMorphologyQuestion(e,o,{mode:'production',variant:t.skill==='plural'&&entry.it===entry.pl?1:variant,pool:[]})?.answer||answers);}
   if(plan.kind==='word'&&chapter.id==='meaning'&&t.skill==='recall'){t.answerFormsByVariant=[t.answerFormsByVariant?.[0]||answers,t.answerFormsByVariant?.[0]||answers];t.independentVariantCount=entry.exEn?2:1;}
   if(plan.kind==='word'&&entry.pos==='noun'&&!entry.g&&['recall','context','listening','plural'].includes(t.skill))t.answerFormsByVariant=t.skill==='plural'?[[entry.pl],[entry.pl]]:(t.answerFormsByVariant||[answers]).map(forms=>forms.filter(f=>[entry.it,wordContext(entry)?.form].includes(f)));
   t.answerFormsByVariant ||= [answers];
   t.exposureFormsByVariant=t.answerFormsByVariant.map(forms=>lessonExposureForms(entry,forms,t.skill));
   if(Number.isInteger(t.person))t.personsByVariant ||= [t.person];
   t.answerForms=[...new Set(answers.filter(Boolean))];
  }
 }
 return plan;
}
function briefWordLesson(plan,entry) {
 const meaning=plan.chapters.find(c=>c.id==='meaning'),forms=plan.chapters.find(c=>c.id==='forms');
 const meaningTarget=meaning?.groups.flatMap(g=>g.targets).find(t=>t.skill==='meaning');
 const recall=meaning?.groups.flatMap(g=>g.targets).find(t=>t.skill==='recall');
 if(!meaningTarget||!recall)return plan;
 // A singular-use noun is never asked its plural on the short path, whatever its data.
 const formTargets=(forms?.groups.flatMap(g=>g.targets)||[]).filter(t=>t.available!==false&&['article','plural','agreement','number'].includes(t.skill)&&!(t.skill==='plural'&&isSingularUse(entry)));
 const bySkill=Object.fromEntries(formTargets.map(t=>[t.skill,t]));
 let sequence,board=null;
 if(entry?.pos==='noun'&&bySkill.article){
  // Every noun with a gender is drilled on its article, its singular and its
  // plural: a choice for each, then an article board that mixes in other nouns.
  const {article,plural,number}=bySkill;
  if(number)sequence=[meaningTarget,recall,article,number,recall,meaningTarget];
  else if(isPluralOnly(entry)){sequence=[article,meaningTarget,recall,article,meaningTarget,recall];board={index:3,targets:[article]};}
  else if(plural){sequence=[meaningTarget,recall,article,plural,article,recall];board={index:4,targets:[article,plural]};}
  else {sequence=[meaningTarget,recall,article,article,recall,meaningTarget];board={index:3,targets:[article]};}
 } else {
  const distinctForms=new Set(formTargets.flatMap(t=>t.answerForms||[]));
  const pairTargets=formTargets.length>=2&&distinctForms.size>=2?formTargets.slice(0,3):[];
  // A matching board is one short activity; its individual rows still produce
  // supported evidence. Keep the entire ordinary lesson to six answer screens.
  sequence=[meaningTarget,recall,...(pairTargets.length?[formTargets[0],formTargets.at(-1)]:formTargets),meaningTarget,recall];
  while(sequence.length<6)sequence.push(formTargets.length?formTargets[(sequence.length-4)%formTargets.length]:sequence.length%2?recall:meaningTarget);
  if(pairTargets.length)board={index:2,targets:pairTargets};
 }
 const seen={};
 const slots=sequence.slice(0,8).map((t,i)=>{const variant=seen[t.id]||0;seen[t.id]=variant+1;const pairs=board?.index===i;return {id:`${plan.entryId}::short-word::${i}`,targetId:t.id,variant,format:pairs?'pairs':'mc',...(pairs?{pairTargetIds:board.targets.map(t=>t.id)}:{})};});
 const teaching=[{chapterId:'meaning',groupId:meaning.groups[0].id,cardId:'meaning'}];
 if(formTargets.length)teaching.push({chapterId:'forms',groupId:forms.groups[0].id,cardId:'forms'});
 plan.wordLesson={version:1,teaching,slots};
 return plan;
}
export function buildLesson(entry,{legacy=false,legacyExpanded=false}={}){if(!entry?.id)return null;const plan=finalize(entry,{version:LESSON_CONTENT_VERSION,entryId:entry.id,kind:verb(entry)?'verb':'word',...(!legacy&&verb(entry)?{flowVersion:2}:{}),title:entry.inf||entry.it,meaning:lessonEntry(entry).en||'',referenceMeanings:entry.en||'',chapters:verb(entry)?verbLesson(lessonEntry(entry),{legacy,legacyExpanded}):wordLesson(entry)});return plan.kind==='word'?briefWordLesson(plan,entry):plan;}
