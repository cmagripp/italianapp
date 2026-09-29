// Stare + gerundio is taught by meaning, never by turning every dictionary verb
// into an ongoing event. Only the reviewed action senses below receive drills.
import { conjugate, splitClitic, MISSING } from '../conjugator.js';

export const PROGRESSIVE_SOURCES = [
  'https://www.treccani.it/vocabolario/stare/',
  'https://accademiadellacrusca.it/it/consulenza/stai-leggendo-la-risposta-sulla-perifrasi-progressiva-stare--gerundio-del-verbo-stare-e-del-verbo-essere/1413',
  'https://www.treccani.it/magazine/lingua_italiana/domande_e_risposte/grammatica/grammatica_601.html',
];
export const PROGRESSIVE_TENSE = 'presenteProgressivo';
const STARE = ['sto','stai','sta','stiamo','state','stanno'];
const STARE_PAST = ['stavo','stavi','stava','stavamo','stavate','stavano'];
const PRONOUNS = ['mi','ti','si','ci','vi','si'];
const LABELS = ['io','tu','lui / lei / Lei','noi','voi','loro'];
const GLOSSES = ['I','you · informal','he / she / you · formal','we','you · plural','they'];
const WEATHER = new Set(['piovere','nevicare']);
const ACTIONS = new Set(['parlare','mangiare','lavorare','studiare','dormire','scrivere','leggere','fare','dire','bere','tradurre',
  'aspettare','ascoltare','guardare','cucinare','camminare','correre','giocare','aprire','chiudere','partire','andare','arrivare',
  'comprare','telefonare','prendere','mettere','portare','lavare','vestirsi','lavarsi','alzarsi','svegliarsi','riposarsi','prepararsi','andarsene',...WEATHER]);
const SIMPLE_SENSES = {
  essere:'For a state or identity, use the simple present: sono, sei, è…',
  avere:'For possession, use the simple present: ho, hai, ha… A different construction, such as an experience unfolding, can behave differently.',
  sapere:'For knowing a fact or knowing how, use the simple present: so, sai, sa…',
  volere:'For wanting something, use the simple present: voglio, vuoi, vuole…',
  potere:'For ability or permission, use the simple present: posso, puoi, può…',
  dovere:'For an obligation, use the simple present: devo, devi, deve…',
  piacere:'For liking something, use piace or piacciono. The thing liked is the subject.',
  conoscere:'For knowing a person or place, use the simple present. Getting to know someone is a different situation.',
  credere:'For an ordinary belief, use credo, credi, crede… A belief changing or developing is a different situation.',
  possedere:'For possession, use the simple present.',
  appartenere:'For belonging to someone or something, use the simple present.',
  significare:'For what a word means, use the simple present.',
  sembrare:'For an ordinary impression, use the simple present.',
  preferire:'For a preference, use the simple present.',
  stare:'For location or how someone is, use the simple present. Stare also helps another verb describe an action in progress.',
};
const clean = value => String(value||'').split('|').map(form=>form.trim()).filter(form=>form&&form!==MISSING);
const key = (entry,suffix,chapter='present') => `${entry.id}::lesson::${chapter}::${suffix}`;
const card = (id,title,body,examples=[],forms=[],notes=[]) => ({id,title,body,examples,forms,notes});

// Complete authored sentences. No sentence is produced by replacing a verb in
// another verb's frame. Tuple: Italian, English, target span, person, role.
const SCENES = {
  parlare:[['Ora sto parlando con Sara.','I am speaking with Sara now.','sto parlando',0],['Stiamo parlando del viaggio.','We are talking about the trip.','stiamo parlando',3],['Signora Rossi, sta parlando con il medico?','Ms Rossi, are you speaking with the doctor?','sta parlando',2,'formal']],
  mangiare:[['Sto mangiando una mela.','I am eating an apple.','sto mangiando',0],['I bambini stanno mangiando la pasta.','The children are eating pasta.','stanno mangiando',5],['Signor Rossi, sta mangiando?','Mr Rossi, are you eating?','sta mangiando',2,'formal']],
  lavorare:[['Adesso sto lavorando.','I am working now.','sto lavorando',0],['Stiamo lavorando in ufficio.','We are working in the office.','stiamo lavorando',3],['Signora Rossi, sta lavorando da casa oggi?','Ms Rossi, are you working from home today?','sta lavorando',2,'formal']],
  studiare:[['Sto studiando italiano.','I am studying Italian.','sto studiando',0],['Gli studenti stanno studiando in biblioteca.','The students are studying in the library.','stanno studiando',5],['Signor Rossi, sta studiando il documento?','Mr Rossi, are you studying the document?','sta studiando',2,'formal']],
  dormire:[['Il bambino sta dormendo.','The baby is sleeping.','sta dormendo',2],['Stanno dormendo in camera.','They are sleeping in the bedroom.','stanno dormendo',5]],
  scrivere:[['Sto scrivendo un messaggio.','I am writing a message.','sto scrivendo',0],['Stiamo scrivendo una lettera.','We are writing a letter.','stiamo scrivendo',3],['Signora Rossi, sta scrivendo il suo indirizzo?','Ms Rossi, are you writing your address?','sta scrivendo',2,'formal']],
  leggere:[['Sto leggendo un libro.','I am reading a book.','sto leggendo',0],['Stiamo leggendo il menu.','We are reading the menu.','stiamo leggendo',3],['Signor Rossi, sta leggendo il contratto?','Mr Rossi, are you reading the contract?','sta leggendo',2,'formal']],
  fare:[['Sto facendo colazione.','I am having breakfast.','sto facendo',0],['Stiamo facendo i compiti.','We are doing our homework.','stiamo facendo',3],['Signora Rossi, sta facendo una pausa?','Ms Rossi, are you taking a break?','sta facendo',2,'formal']],
  dire:[['Sto dicendo la verità.','I am telling the truth.','sto dicendo',0],['Stanno dicendo la stessa cosa.','They are saying the same thing.','stanno dicendo',5],['Signor Rossi, sta dicendo che il treno è in ritardo?','Mr Rossi, are you saying that the train is late?','sta dicendo',2,'formal']],
  bere:[['Sto bevendo un bicchiere d’acqua.','I am drinking a glass of water.','sto bevendo',0],['Stiamo bevendo un caffè.','We are drinking a coffee.','stiamo bevendo',3]],
  tradurre:[['Sto traducendo una lettera.','I am translating a letter.','sto traducendo',0],['Stiamo traducendo il testo in italiano.','We are translating the text into Italian.','stiamo traducendo',3]],
  aspettare:[['Sto aspettando l’autobus.','I am waiting for the bus.','sto aspettando',0],['Stiamo aspettando Sara.','We are waiting for Sara.','stiamo aspettando',3]],
  ascoltare:[['Sto ascoltando la radio.','I am listening to the radio.','sto ascoltando',0],['Stiamo ascoltando la spiegazione.','We are listening to the explanation.','stiamo ascoltando',3]],
  guardare:[['Sto guardando un film.','I am watching a film.','sto guardando',0],['Stiamo guardando le foto.','We are looking at the photos.','stiamo guardando',3]],
  cucinare:[['Sto cucinando la cena.','I am cooking dinner.','sto cucinando',0],['Stiamo cucinando insieme.','We are cooking together.','stiamo cucinando',3]],
  camminare:[['Sto camminando nel parco.','I am walking in the park.','sto camminando',0],['Stiamo camminando verso casa.','We are walking toward home.','stiamo camminando',3]],
  correre:[['Sto correndo nel parco.','I am running in the park.','sto correndo',0],['I bambini stanno correndo in giardino.','The children are running in the garden.','stanno correndo',5]],
  giocare:[['Sto giocando a tennis.','I am playing tennis.','sto giocando',0],['I bambini stanno giocando in giardino.','The children are playing in the garden.','stanno giocando',5]],
  aprire:[['Sto aprendo la finestra.','I am opening the window.','sto aprendo',0],['Stiamo aprendo le valigie.','We are opening the suitcases.','stiamo aprendo',3]],
  chiudere:[['Sto chiudendo la porta.','I am closing the door.','sto chiudendo',0],['Stiamo chiudendo le finestre.','We are closing the windows.','stiamo chiudendo',3]],
  andare:[['Sto andando al lavoro.','I am on my way to work.','sto andando',0],['Stiamo andando alla stazione.','We are on our way to the station.','stiamo andando',3]],
  partire:[['Il treno sta partendo.','The train is leaving.','sta partendo',2],['Stiamo partendo adesso.','We are leaving now.','stiamo partendo',3]],
  arrivare:[['Sto arrivando alla stazione.','I am arriving at the station.','sto arrivando',0],['Gli ospiti stanno arrivando.','The guests are arriving.','stanno arrivando',5]],
  comprare:[['Sto comprando il pane.','I am buying bread.','sto comprando',0],['Stiamo comprando i biglietti.','We are buying the tickets.','stiamo comprando',3]],
  telefonare:[['Sto telefonando a Marco.','I am calling Marco.','sto telefonando',0],['Stiamo telefonando all’albergo.','We are calling the hotel.','stiamo telefonando',3]],
  prendere:[['Sto prendendo le chiavi.','I am picking up the keys.','sto prendendo',0],['Stiamo prendendo i libri dallo scaffale.','We are taking the books from the shelf.','stiamo prendendo',3]],
  mettere:[['Sto mettendo i piatti sul tavolo.','I am putting the plates on the table.','sto mettendo',0],['Stiamo mettendo i libri nello zaino.','We are putting the books in the backpack.','stiamo mettendo',3]],
  portare:[['Sto portando le valigie in camera.','I am carrying the suitcases to the bedroom.','sto portando',0],['Stiamo portando la spesa a casa.','We are taking the shopping home.','stiamo portando',3]],
  lavare:[['Sto lavando i piatti.','I am washing the dishes.','sto lavando',0],['Stiamo lavando la macchina.','We are washing the car.','stiamo lavando',3]],
  lavarsi:[['Mi sto lavando le mani.','I am washing my hands.','mi sto lavando',0],['Ci stiamo lavando le mani.','We are washing our hands.','ci stiamo lavando',3]],
  vestirsi:[['Mi sto vestendo.','I am getting dressed.','mi sto vestendo',0],['I bambini si stanno vestendo.','The children are getting dressed.','si stanno vestendo',5]],
  alzarsi:[['Mi sto alzando dal letto.','I am getting out of bed.','mi sto alzando',0],['Gli studenti si stanno alzando.','The students are standing up.','si stanno alzando',5]],
  svegliarsi:[['Mi sto svegliando.','I am waking up.','mi sto svegliando',0],['Il bambino si sta svegliando.','The baby is waking up.','si sta svegliando',2]],
  riposarsi:[['Mi sto riposando un momento.','I am resting for a moment.','mi sto riposando',0],['Ci stiamo riposando dopo il viaggio.','We are resting after the trip.','ci stiamo riposando',3]],
  prepararsi:[['Mi sto preparando per uscire.','I am getting ready to go out.','mi sto preparando',0],['Ci stiamo preparando per il viaggio.','We are getting ready for the trip.','ci stiamo preparando',3]],
  andarsene:[['Me ne sto andando.','I am leaving.','me ne sto andando',0],['Ce ne stiamo andando adesso.','We are leaving now.','ce ne stiamo andando',3]],
  piovere:[['Sta piovendo.','It is raining.','sta piovendo',2],['Fuori sta piovendo forte.','It is raining heavily outside.','sta piovendo',2]],
  nevicare:[['Sta nevicando.','It is snowing.','sta nevicando',2],['In montagna sta nevicando.','It is snowing in the mountains.','sta nevicando',2]],
};

export function progressiveForms(entry,person,{chapter='present'}={}) {
  if(!entry?.inf||!ACTIONS.has(entry.inf)||!Number.isInteger(person)||person<0||person>5||WEATHER.has(entry.inf)&&person!==2)return [];
  const {base,clitic}=splitClitic(entry.inf);
  if(clitic&&!['si','sene'].includes(clitic))return [];
  let gerunds;try{gerunds=clean(conjugate(base,{isc:entry.isc}).nonFinite.gerundio);}catch{return [];}
  const helper=(chapter==='background'?STARE_PAST:STARE)[person];
  return gerunds.flatMap(gerund=>{
    if(clitic==='si')return [`${PRONOUNS[person]} ${helper} ${gerund}`,`${helper} ${gerund}${PRONOUNS[person]}`];
    if(clitic==='sene'){const pron=['me ne','te ne','se ne','ce ne','ve ne','se ne'][person],attached=pron.replace(' ','');return [`${pron} ${helper} ${gerund}`,`${helper} ${gerund}${attached}`];}
    return [`${helper} ${gerund}`];
  });
}
export function progressiveContexts(entry,{chapter='present'}={}) {
  return (SCENES[entry?.inf]||[]).map(([originalIt,originalEn,presentAnswer,person,role='ordinary'],index)=>{
    const answers=progressiveForms(entry,person,{chapter}),answer=answers[0];
    let it=originalIt,en=originalEn;
    if(chapter==='background'){
      // These 84 bounded same-verb adaptations were reviewed individually. No
      // unseen sentence or new infinitive enters this transformation.
      it=it.replace(new RegExp(presentAnswer,'i'),answer).replace(/^(Ora|Adesso)\s+/,'').replace(/\s+adesso(?=[.!?])/,'').replace(/\boggi\b/,'quel giorno');
      en=en.replace(/\bI am\b/,'I was').replace(/\bWe are\b/,'We were').replace(/\bThey are\b/,'They were').replace(/\b(the children|The children|The students|The guests) are\b/,'$1 were').replace(/\b(the baby|The baby|The train|It) is\b/,'$1 was').replace(/\bare you\b/,'were you').replace(/\s+now(?=[.!?])/,'').replace(/\btoday\b/,'that day');
      if(entry.inf==='dire'&&role==='formal'){it=it.replace('il treno è in ritardo','il treno era in ritardo');en=en.replace('the train is late','the train was late');}
      if(role!=='formal'){
        it=`In quel momento, ${it[0].toLocaleLowerCase('it')}${it.slice(1)}`;
        en=`At that moment, ${en.startsWith('I ')?en:en[0].toLocaleLowerCase('en')+en.slice(1)}`;
      }
    }
    return {id:`${entry.id}:${chapter==='background'?'past-progressive':'progressive'}:scene-${index}`,it,en,answer,answers,person,role,source:chapter==='background'?'reviewed-past-progressive':'reviewed-progressive',reviewed:true};
  });
}
export function progressiveInfo(entry,{chapter='present'}={}) {
  const inf=entry?.inf||'',supported=ACTIONS.has(inf),{base,clitic}=splitClitic(inf);
  let gerund='';try{gerund=clean(conjugate(base,{isc:entry?.isc}).nonFinite.gerundio)[0]||'';}catch{}
  const regular=base.endsWith('are')?base.slice(0,-3)+'ando':/(ere|ire)$/.test(base)?base.slice(0,-3)+'endo':'';
  return {supported,weather:WEATHER.has(inf),clitic,gerund,helperForms:[...(chapter==='background'?STARE_PAST:STARE)],irregular:!!gerund&&gerund!==regular,
    limitation:SIMPLE_SENSES[inf]||'Whether this construction fits depends on the meaning and situation. The simple present remains useful; do not replace it automatically whenever English uses -ing.'};
}

export function buildProgressiveGroup(entry,{chapter='present'}={}) {
  if(!entry?.id||!entry.inf)return null;
  const past=chapter==='background',tense=past?'imperfettoProgressivo':PROGRESSIVE_TENSE;
  const info=progressiveInfo(entry,{chapter}),contexts=progressiveContexts(entry,{chapter}),group={id:'progressive',title:past?'Was happening · stare + gerundio':'Happening now · stare + gerundio',cards:[],targets:[]};
  const limitation=past?(SIMPLE_SENSES[entry.inf]?'For the ordinary state or stable meaning taught here, use the simple imperfetto. A different meaning or situation can behave differently.':info.limitation.replace('simple present','simple imperfetto')):info.limitation;
  const general=past?'Use the imperfetto of stare plus a gerundio to focus on an action in progress at a past moment: stavo parlando. The simple imperfetto can also describe an ongoing action, as well as a past habit or background.':'Use the present of stare plus a gerundio to highlight an action in progress: sto parlando. The ordinary present can also describe what is happening now; the progressive makes the ongoing action explicit.';
  group.cards.push(card('progressive-meaning',past?'Was happening then':'Happening now',general,
    info.supported?contexts.slice(0,2).map(({it,en})=>({it,en})):past?[{it:'Parlavo italiano ogni giorno.',en:'I used to speak Italian every day.'},{it:'Quando hai chiamato, stavo parlando con Sara.',en:'When you called, I was speaking with Sara.'}]:[{it:'Parlo italiano ogni giorno.',en:'I speak Italian every day.'},{it:'Ora sto parlando con Sara.',en:'I am speaking with Sara now.'}],[],
    [past?'Use the simple imperfetto for a past habit or background. Stavo + gerundio puts an action in progress at the centre of the scene.':'Use the simple present for a general routine. Stare + gerundio is not an automatic translation of every English -ing form.',...(!info.supported?[limitation]:[])]));
  group.cards.push(card('progressive-contrast','Four ways to describe eating','Choose the time and viewpoint you mean. The progressive zooms in on an action in progress; the simple imperfetto also covers habits and background. Passato prossimo presents an event as complete.',[
    {it:'Ora sto mangiando una mela.',en:'I am eating an apple now.'},
    {it:'Quando hai chiamato, stavo mangiando.',en:'When you called, I was in the middle of eating.'},
    {it:'Da bambino mangiavo una mela ogni pomeriggio.',en:'As a child, I used to eat an apple every afternoon.'},
    {it:'Ieri ho mangiato al ristorante.',en:'Yesterday I ate at a restaurant.'},
  ],[],['Mangiavo can also describe an action in progress: mentre mangiavo, è arrivata Sara. Stavo mangiando makes that ongoing viewpoint explicit.',
    'Ho mangiato presents the eating event as complete. It does not, by itself, mean that every bit of the food was finished.']));
  if(!info.supported){
    const usageAnswer=past?'An action in progress at a past moment':'An action in progress';
    group.targets.push({id:key(entry,'progressive-usage',chapter),skill:'progressiveUsage',tense,required:false,completionRequired:true,guidedOnly:true,available:true,progressive:true,
      usageQuestion:past?'Which meaning does stava + gerundio highlight?':'Which meaning does stare + gerundio highlight?',usageAnswers:[usageAnswer],usageDistractors:['A general routine','A completed past event'],
      explanation:general,answerForms:[usageAnswer],answerFormsByVariant:[[usageAnswer]],exposureFormsByVariant:[[usageAnswer]],independentVariantCount:0,guidedFormat:'mc'});
    return group;
  }
  group.cards.push(card('progressive-stare','Stare carries the person',past?'Choose the imperfetto form of stare for the subject. Formal Lei uses stava, the same form as lui and lei.':'Choose the present form of stare for the subject. Formal Lei uses sta, the same form as lui and lei.',[],
    info.helperForms.map((form,person)=>({label:LABELS[person],form,gloss:GLOSSES[person]}))));
  const gerundNote=`Regular -are → -ando; -ere and -ire → -endo. ${entry.inf} uses ${info.clitic?'the base gerundio ':''}${info.gerund}${info.clitic?', together with its pronoun':''}.${info.irregular?' This is a form to learn separately.':''}`;
  const notes=['The gerundio does not change for person, gender or number. The form of stare carries the person.'];
  if(info.clitic)notes.push(`Keep the pronoun: ${progressiveForms(entry,0,{chapter}).join(' or ')}. Both positions are possible; do not use the pronoun twice.`);
  if(info.weather)notes.push(`Weather expressions are impersonal: use ${past?'stava':'sta'}, without a personal subject.`);
  const persons=info.weather?[2]:[0,1,2,3,4,5];
  group.cards.push(card('progressive-forms','Add the gerundio',gerundNote,[],persons.map(person=>({label:info.weather?'impersonal':LABELS[person],form:progressiveForms(entry,person,{chapter}).join(' / '),gloss:info.weather?'it · weather':GLOSSES[person]})),notes));
  const makeTarget=(person,role='ordinary')=>{
    const authored=contexts.filter(context=>context.person===person&&context.role===role),forms=progressiveForms(entry,person,{chapter});
    const variants=authored.length?authored.map(context=>context.answers):[forms,forms];
    return {id:key(entry,role==='formal'?'progressive-formal':`progressive-form-${person}`,chapter),skill:'progressive',tense,person,role,
      required:true,available:!!forms.length,progressive:true,guidedFormat:person%2?'letters':'match',evidenceScope:authored.length?'construction':'form',
      explanation:`Match the person with stare, then add ${info.gerund}.`,contexts:authored,contextIds:authored.map(context=>context.id),
      answerForms:forms,answerFormsByVariant:variants,exposureFormsByVariant:variants,personsByVariant:variants.map(()=>person),independentVariantCount:Math.max(2,authored.length*2)};
  };
  group.targets.push(...persons.map(person=>makeTarget(person)));
  if(!info.weather)group.targets.push(makeTarget(2,'formal'));
  return group;
}
