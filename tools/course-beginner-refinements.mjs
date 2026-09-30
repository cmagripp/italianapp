// Independent integration review of the beginner packs. Called by their authoring
// script as well as directly; stable IDs make the refinements idempotent.
import fs from 'node:fs';
import {beginnerCheckpoints, hardCLesson} from './course-beginner-checkpoints.mjs';
import {pronunciationLessons} from './course-pronunciation-lessons.mjs';
import {pathToFileURL} from 'node:url';
const byId=(pack,id)=>pack.units.flatMap(u=>u.lessons).find(l=>l.id==='v2-'+id);
const add=(l,step)=>{const i=l.steps.findIndex(s=>s.id===step.id);if(i<0)l.steps.splice(l.steps.length-1,0,step);else l.steps[i]=step;};
const choice=(l,key,facet,context,translation,answer,options,explanation,{reserve=true,format='choice',...extra}={})=>({id:l.id+'.'+key,kind:'question',target:l.targets[0].id,facet,stage:'independent',contextKey:l.id+'.'+key,reserve,format,prompt:format==='type'?'Complete the gap with the taught form.':'Choose the expression that fits.',context,translation,answer,...format==='choice'?{options}:{strict:true},speak:context.includes('___')?context.replace('___',answer):context,explanation,hint:explanation,...extra});
const reserveRows={
 'f-greet':[['polite-greeting','___, dottore.','Greet a doctor politely during the day.','Buongiorno',['Buongiorno','Arrivederci','Ciao'],'Buongiorno opens a polite daytime exchange.']],
 'f-name':[['give-name','«Come ti chiami?» «___»','Answer using the name Sara.','Mi chiamo Sara.',['Mi chiamo Sara.','Come ti chiami?','Mi chiamo Luca.'],'Mi chiamo gives your own name.']],
 'f-name-polite':[['polite-address','Dottore, ___','Ask the doctor for his name politely.','come si chiama?',['come si chiama?','come ti chiami?','mi chiamo Luca.'],'Polite address uses si chiama, whether the person is a man or a woman.']],
 'f-repair':[['request-repetition','«Non capisco. ___»','Ask politely to hear the instruction again.','Può ripetere, per favore?',['Può ripetere, per favore?','Come ti chiami?','Mi chiamo Anna.'],'Può ripetere asks the person to repeat.']],
 'f-origin':[['f-origin','«Di dove sei, Anna?» «___»','Anna is from Rome. Choose her reply.','Sono di Roma.',['Sono di Roma.','Mi chiamo Roma.','Come ti chiami?'],'Sono di gives the city you are from.']],
 'a1-essere-polite':[['polite-lei-e','Dottore, Lei ___ di Milano?','Doctor, are you from Milan?','è',[],'Polite Lei uses è, the same form as he or she.']],
 'a1-singular-gender':[['feminine-la','___ scuola è piccola.','The school is small.','La',[],'Scuola is feminine: la scuola.']],
 'a1-special-articles':[['uno-before-special-start','Anna ha ___ zaino.','Anna has a backpack.','uno',[],'Before z, the masculine indefinite article is uno.']],
 'a1-small-numbers':[['numbers-zero-five','Ho ___ libri.','I have four books. Write the number in Italian.','quattro',[],'Four is quattro.']],
 'a1-plural-articles':[['le','___ scuole sono grandi.','The schools are big.','Le',[],'The feminine plural article is le.']],
 'a1-plural-spelling':[['invariant-citta','Milano e Firenze sono due ___.','Milan and Florence are two cities.','città',[],'Città keeps its written form in the plural.']],
 'a1-adjective-agreement':[['grande-grandi','Le scuole sono ___.','The schools are big.','grandi',[],'Grande has plural grandi for both genders.']],
 'a1-present-questions':[['where-question','___ mangi, Anna?','Ask Anna where she eats.','Dove',['Dove','Non','Sì'],'Dove asks where an activity happens.']],
 'a1-present-negation':[['non-before-present','Noi ___ abitiamo a Napoli.','We do not live in Naples.','non',[],'Non comes directly before this conjugated verb.']],
 'a1-present-ere':[['plural-ere','Noi ___ a Napoli.','We live in Naples.','viviamo',[],'The noi form of vivere is viviamo.']],
 'a1-present-ire':[['plural-ire','Anna e Luca ___ domani.','Anna and Luca leave tomorrow.','partono',[],'The loro form of partire ends in -ono.']],
 'a1-present-isc':[['no-isc-noi-voi','Noi ___ la domanda.','We understand the question.','capiamo',[],'The noi form is capiamo, without -isc-.']],
 'a1-andare':[['singular-irregular','Io ___ a Napoli oggi.','I am going to Naples today.','vado',[],'Io takes the irregular form vado.'],['plural-regular','Voi ___ a Milano domani?','Are you all going to Milan tomorrow?','andate',[],'Voi takes andate.']],
 'a1-fare':[['singular-irregular','Luca ___ una torta oggi.','Luca makes a cake today.','fa',[],'The third-person singular of fare is fa.'],['plural-form','Voi ___ colazione a casa?','Do you all have breakfast at home?','fate',[],'The voi form of fare is fate.']],
 'a1-venire':[['singular-irregular','Luca ___ da Roma.','Luca comes from Rome.','viene',[],'The third-person singular of venire is viene.'],['plural-form','Voi ___ da Napoli?','Do you all come from Naples?','venite',[],'The voi form is venite.']],
 'a1-a-in-places':[['city-a','Noi andiamo ___ Firenze.','We are going to Florence.','a',[],'Use a before this city name.'],['country-in','Luca va ___ Italia.','Luca is going to Italy.','in',[],'Use in before Italia.']],
 'a1-da-con':[['origin-da','Luca viene ___ Roma.','Luca comes from Rome.','da',[],'Da introduces where he comes from.'],['company-con','Anna va a Milano ___ Luca.','Anna goes to Milan with Luca.','con',[],'Con introduces the person accompanying Anna.']],
 'a1-there-is':[['singular','___ una scuola qui.','There is a school here.','C’è',[],'One school takes c’è.'],['plural','___ tre libri qui.','There are three books here.','Ci sono',[],'More than one book takes ci sono.']],
 'a1-near-far':[['near','La scuola è ___ casa.','The school is near home.','vicina a',[],'Feminine scuola takes vicina; the location follows a.'],['far','Il mercato è ___ Roma.','The market is far from Rome.','lontano da',[],'Masculine mercato takes lontano; distance is measured from da.']],
 'a1-a-in-articles':[['a-article','Luca va ___ stazione.','Luca is going to the station.','alla',[],'A + la becomes alla.'],['in-article','Il libro è ___ frigo.','The book is in the fridge.','nel',[],'In + il becomes nel.']],
 'a1-my-possessives':[['singular-possession','Dove è ___ casa?','Where is my house?','la mia',[],'Feminine singular casa takes la mia.'],['plural-possession','___ libri sono grandi.','My books are big.','I miei',[],'Masculine plural libri takes i miei.']],
 'a1-family-possessives':[['family-no-article','___ padre è di Milano.','My father is from Milan.','Mio',[],'The singular unmodified family word padre normally has no article here.'],['other-article','___ libro è a casa.','My book is at home.','Il mio',[],'An ordinary noun such as libro keeps its article.']],
 'a1-demonstratives':[['near','___ zaino qui è piccolo.','This backpack here is small.','Questo',[],'Questo points to the nearby masculine singular object.'],['far','___ scuola là è grande.','That school over there is big.','Quella',[],'Quella points to the more distant feminine singular noun.']],
 'a1-numbers-eleven-twenty':[['a1-numbers-eleven-twenty','Ho ___ libri.','I have sixteen books. Write the number in Italian.','sedici',[],'Sixteen is sedici.']],
 'a1-tens-prices':[['a1-tens-prices','Il libro costa ___ euro.','The book costs forty euros. Write the number in Italian.','quaranta',[],'Forty is quaranta.']],
 'a1-days-clock':[['day','La lezione è ___.','The lesson is on Saturday.','sabato',[],'Saturday is sabato.'],['clock','Il treno parte ___ una.','The train leaves at one.','all’',[],'At one uses all’una; at other whole hours use alle.']],
 'a1-many-few':[['many','Anna ha ___ libri.','Anna has many books.','molti',[],'Masculine plural libri takes molti.'],['few','Ho ___ case.','I have few houses.','poche',[],'Feminine plural case takes poche.']],
 'a1-potere-requests':[['speaker','___ prendere il libro?','May I take the book?','Posso',[],'The speaker asks permission with posso.'],['addressed-person','Anna, ___ leggere?','Anna, can you read? Address her familiarly.','puoi',[],'Familiar tu takes puoi.'],['polite','Dottore, ___ aprire la porta?','Doctor, could you open the door? Address him politely.','può',[],'Polite Lei takes può.']],
 'a1-want-need':[['want','Anna ___ comprare il pane.','Anna wants to buy bread.','vuole',[],'Volere expresses wanting; Anna takes vuole.'],['need','Luca ___ chiamare Anna.','Luca has to call Anna.','deve',[],'Dovere expresses needing or having to; Luca takes deve.']],
 'a1-piacere':[['singular-or-infinitive','Mi ___ il pane.','I like bread.','piace',[],'A singular noun takes piace.'],['plural','Mi ___ gli zaini.','I like backpacks.','piacciono',[],'A plural noun takes piacciono.']],
 'a1-familiar-commands':[['positive','___ italiano, Luca.','Speak Italian, Luca.','Parla',[],'The positive tu command is parla.'],['negative','Anna, ___ italiano.','Anna, do not speak Italian.','non parlare',[],'The negative tu command uses non + infinitive.']],
 'a1-basic-links':[['addition','Vedo Anna ___ Luca.','I see Anna and Luca.','e',[],'E joins the two names.'],['contrast','Ho sete, ___ non bevo.','I am thirsty, but I am not drinking.','ma',[],'Ma marks the contrast.'],['reason','Non esco ___ piove.','I am not going out because it is raining.','perché',[],'Perché introduces the reason.']],
 'a1-past-are':[['a1-past-are','Ieri Luca ___ con Anna.','Yesterday Luca spoke with Anna.','ha parlato',[],'Use ha with Luca and the -ato participle parlato.']],
 'a1-past-ere-ire':[['ere-uto','Tu ___ un messaggio ieri.','You received a message yesterday.','hai ricevuto',[],'Ricevere has the regular participle ricevuto.'],['ire-ito','Anna ___ a casa ieri.','Anna slept at home yesterday.','ha dormito',[],'Dormire has the regular participle dormito.']],
 'a1-past-essere':[['masculine','Luca ___ a Napoli ieri.','Luca arrived in Naples yesterday.','è arrivato',[],'With essere, the masculine singular participle ends -o.'],['feminine','Anna ___ a Milano ieri.','Anna went to Milan yesterday.','è andata',[],'With essere, the feminine singular participle ends -a.']],
 'a1-first-past-message':[['a1-first-past-message','Ieri Anna ___ a casa.','Yesterday Anna ate at home.','ha mangiato',['ha mangiato','è mangiata','mangia'],'Mangiare uses avere in this completed event.']],
};
const legacyLinks={
 'a1-andare':['a1-common-irregular-present'],'a1-fare':['a1-common-irregular-present'],'a1-venire':['a1-common-irregular-present'],
 'a1-there-is':['a1-c-e-ci-sono'],'a1-my-possessives':['a1-possessives'],'a1-family-possessives':['a1-possessives'],
 'a1-demonstratives':['a1-demonstratives'],'a1-a-in-places':['a1-simple-prepositions'],'a1-da-con':['a1-simple-prepositions'],
 'a1-a-in-articles':['a1-articulated-prepositions'],'a1-tens-prices':['a1-quantity-time'],'a1-days-clock':['a1-quantity-time'],
 'a1-many-few':['a1-quantity-time'],'a1-potere-requests':['a1-modal-requests'],'a1-want-need':['a1-modal-requests'],
 'a1-familiar-commands':['a1-tu-commands'],'a1-piacere':['a1-piacere'],'a1-past-are':['a1-first-past'],
 'a1-past-ere-ire':['a1-first-past'],'a1-past-essere':['a1-first-past'],'a1-first-past-message':['a1-first-past'],
};
const facets={
 'a1-andare':['singular-irregular','singular-irregular','singular-irregular','plural-regular','plural-regular'],
 'a1-fare':['singular-irregular','singular-irregular','singular-irregular','plural-form','plural-form'],
 'a1-venire':['singular-irregular','singular-irregular','singular-irregular','plural-form','plural-form'],
 'a1-a-in-places':['city-a','country-in','city-a','country-in','city-a'],
 'a1-da-con':['origin-da','company-con','origin-da','company-con','company-con'],
 'a1-there-is':['singular','plural','singular','plural','singular'],
 'a1-near-far':['near','far','near','far','near'],
 'a1-a-in-articles':['a-article','in-article','a-article','in-article','a-article'],
 'a1-my-possessives':['singular-possession','singular-possession','plural-possession','plural-possession','plural-possession'],
 'a1-family-possessives':['family-no-article','family-no-article','other-article','family-no-article'],
 'a1-demonstratives':['near','near','far','far'],
 'a1-days-clock':['clock','clock','day','clock'],
 'a1-many-few':['many','few','many','few'],
 'a1-potere-requests':['speaker','addressed-person','polite','speaker'],
 'a1-want-need':['want','want','need','need'],
 'a1-piacere':['singular-or-infinitive','plural','singular-or-infinitive','plural'],
 'a1-familiar-commands':['positive','positive','negative','negative'],
 'a1-basic-links':['addition','contrast','reason','reason'],
 'a1-past-ere-ire':['ere-uto','ire-ito','ere-uto','ire-ito'],
 'a1-past-essere':['feminine','masculine','feminine','masculine'],
};
function matching(l,key,pairs){const id=l.id+'.'+key;if(l.steps.some(s=>s.id===id))return;const first=l.steps.findIndex(s=>s.kind==='question');l.steps.splice(first+1,0,{id,kind:'question',format:'match',target:l.targets[0].id,facet:l.targets[0].facets[0],stage:'guided',contextKey:id,prompt:'Match the pairs.',pairs,explanation:'Each pair uses the forms you have just met.',hint:'Compare each card with the examples above.'});}
export function refineBeginnerPack(pack){
 if(!['Foundations','A1'].includes(pack.level))return pack;
 for(const unit of pack.units)for(const l of unit.lessons){
  const key=l.id.slice(3),plan=facets[key];
  if(legacyLinks[key])l.legacyLessonIds=[...new Set([...(l.legacyLessonIds||[]),...legacyLinks[key]])];
  if(plan){const questions=l.steps.filter(s=>s.kind==='question'&&!s.reserve&&!s.id.includes('.review-')&&s.format!=='match');questions.forEach((q,i)=>q.facet=plan[i]||q.facet);l.targets[0].facets=[...new Set(plan)];l.targets[0].minIndependent=Math.max(2,l.targets[0].facets.length);}
  // A production goal must have fresh productive recovery material. Turn an
  // already authored bounded gap into recall rather than inventing its answer.
  if(l.targets[0].requiresProduction)for(const q of l.steps.filter(s=>s.reserve&&s.format==='choice'&&s.context?.includes('___'))){q.format='type';q.strict=true;q.prompt='Complete the gap with the taught form.';delete q.options;}
  for(const [i,row] of (reserveRows[key]||[]).entries()){
   const [facet,context,en,answer,options,why]=row;
   add(l,choice(l,'review-'+i,facet,context,en,answer,options,why,{format:options.length?'choice':'type'}));
  }
 }
 if(pack.level==='Foundations'){
  matching(byId(pack,'f-greet'),'match-greetings',[{left:'ciao',right:'hi · familiar'},{left:'buongiorno',right:'good day · polite'},{left:'arrivederci',right:'goodbye · polite'}]);
  matching(byId(pack,'f-name'),'match-name',[{left:'Mi chiamo Anna.',right:'My name is Anna.'},{left:'Come ti chiami?',right:'What is your name? · familiar'}]);
  matching(byId(pack,'f-courtesy'),'match-courtesy',[{left:'grazie',right:'thank you'},{left:'prego',right:'you’re welcome'},{left:'per favore',right:'please'}]);
  const hard=hardCLesson();const hu=pack.units[2];const hi=hu.lessons.findIndex(l=>l.id===hard.id);if(hi<0)hu.lessons.push(hard);else hu.lessons[hi]=hard;
  const sounds=byId(pack,'f-sound-c');sounds.title='Read two c patterns';sounds.outcome='I can connect familiar c spellings with their taught sounds.';sounds.targets[0].label=sounds.title;
  const hardQuestion=sounds.steps.find(s=>s.id.endsWith('.s9'));Object.assign(hardQuestion,{context:'caffè',translation:'The word means coffee. Is its first c hard or soft?',answer:'hard c',options:['hard c','soft c'],prompt:'Choose the initial sound.',speak:'Un caffè, per favore.',explanation:'Before a, c is hard in caffè.',hint:'Look at the vowel after c.',contextKey:sounds.id+'.coffee'});
  const soft=sounds.steps.find(s=>s.id.endsWith('.s8'));Object.assign(soft,{reserve:true,context:'cena',translation:'The word means dinner. Is its first c hard or soft?',answer:'soft c',options:['hard c','soft c'],prompt:'Choose the initial sound.',speak:'La cena è pronta.',explanation:'Before e, c is soft in cena.',hint:'Look at the vowel after c.',contextKey:sounds.id+'.dinner'});
  if(!sounds.steps[0].words.some(w=>w.it==='caffè'))sounds.steps[0].words.push({it:'caffè',en:'coffee',article:'il',plural:'caffè'});
  add(sounds,{id:sounds.id+'.read-note',kind:'passage',mode:'read',title:'A short message',it:'Ciao, Anna! La cena è pronta.',en:'Hi, Anna! Dinner is ready.',task:'Read the familiar greeting and the dinner message. Pronta means ready.'});
  // Give each polite/giving-name contrast its own fresh situation after a lapse.
  const courtesy=byId(pack,'f-courtesy');Object.assign(courtesy.steps.find(s=>s.reserve&&s.facet==='thank'),{context:'«Ecco il caffè.» «___»',translation:'You receive your coffee. Thank the person.',speak:'Ecco il caffè. Grazie!',contextKey:courtesy.id+'.receive-coffee'});
 }
 if(pack.level==='A1'){
  for(const [u,lesson] of pronunciationLessons()){const unit=pack.units[u],i=unit.lessons.findIndex(l=>l.id===lesson.id);if(i<0)unit.lessons.push(lesson);else unit.lessons[i]=lesson;}
  for(const lesson of beginnerCheckpoints()){const unit=pack.units.at(-1),i=unit.lessons.findIndex(l=>l.id===lesson.id);if(i<0)unit.lessons.push(lesson);else unit.lessons[i]=lesson;}

  const links=byId(pack,'a1-basic-links');add(links,choice(links,'join-people','addition','Anna ___ Luca sono a casa.','Anna and Luca are at home.','e',['e','ma','perché'],'E simply joins the two people.',{reserve:false}));
  matching(byId(pack,'a1-essere-singular'),'match-person',[{left:'io',right:'sono'},{left:'tu',right:'sei'},{left:'lui / lei / Lei',right:'è'}]);
  matching(byId(pack,'a1-noun-plurals'),'match-number',[{left:'il libro',right:'i libri'},{left:'la casa',right:'le case'},{left:'lo studente',right:'gli studenti'}]);
  // A book priced at 100 euros is plausible; a house costing 100 euros is not.
  const prices=byId(pack,'a1-tens-prices');const q=prices.steps.find(s=>s.format==='type'&&!s.reserve);Object.assign(q,{context:'Lo zaino costa ___ euro.',translation:'The backpack costs one hundred euros.',speak:'Lo zaino costa cento euro.'});
 }
 return pack;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){for(const level of ['Foundations','A1']){const path=new URL('../data/course-v2/'+level+'.json',import.meta.url),pack=refineBeginnerPack(JSON.parse(fs.readFileSync(path)));fs.writeFileSync(path,JSON.stringify(pack,null,2)+'\n');}console.log('Refined beginner matching, facets, and recovery banks.');}
