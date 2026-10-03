// Editorial source, not example generation. Every question and repair below
// is authored for a named situation. course-phase6-beginner.mjs compiles it.
export const W=(it,en,article,plural)=>({it,en,...article?{article}:{},...plural?{plural}:{}});
export const C=(context,translation,answer,options,explanation)=>({format:'choice',prompt:'Choose the reply or form that fits this situation.',context,translation,answer,options,explanation,hint:explanation,speak:context.includes('___')?context.replace('___',answer):context});
export const T=(context,translation,answer,explanation,accepted=[])=>({format:'type',prompt:'Complete the gap with the taught expression.',context,translation,answer,accepted,strict:true,explanation,hint:explanation,speak:context.replace('___',answer)});
export const F=(key,label,body,it,en,questions)=>({key,label,body,examples:[{it,en}],questions});

// Two additional fresh recall contexts per contrast. After two typed errors,
// recognition success alone cannot finish a productive target. These are
// explicit editorial variants, not answers copied from a teaching example.
export const productionRepairs={
 'f-supported-exchange':{
  introduce:[T('___ di Milano.','I am from Milan. Complete the speaker’s origin frame.','Sono','Sono identifies the speaker; keep di before the supplied city.'),T('___ Sara.','My name is Sara. Complete the name frame.','Mi chiamo','The name belongs after mi chiamo.')],
  'repair-close':[T('Scusi, non capisco. ___, per favore?','Ask politely for a repeat after stating the problem.','Può ripetere','Può ripetere requests the message again.'),T('Grazie, signora. ___!','Thank the woman and end the polite exchange.','Arrivederci','Arrivederci is the polite farewell.')]
 },
 'a1-home-rooms':{
  room:[T('La sedia è ___.','The chair is in the bedroom.','nella camera','Camera names the bedroom.', ['in camera']),T('Il tavolo è ___.','The table is in the bathroom.','in bagno','The supplied room is the bathroom.')],
  position:[T('In cucina, il pane è ___.','In the kitchen, the bread is on the table.','sul tavolo','Keep the named kitchen and use su + il: sul tavolo.'),T('Il tavolo è ___.','The table is next to the bed.','accanto al letto','Accanto al letto is the taught next-to phrase.')]
 },
 'a1-family-description':{
  relationship:[T('___ sorella è di Roma.','My sister is from Rome.','Mia','Sorella takes feminine singular mia without an article here.'),T('___ genitori sono di Milano.','My parents are from Milan.','I miei','The plural family noun keeps its article.')],
  age:[T('Tu ___ dieci anni.','You are ten years old.','hai','Tu takes hai; an age uses avere.'),T('Noi ___ venti anni.','We are twenty years old.','abbiamo','Noi takes abbiamo, including in the age expression.')]
 },
 'a1-routine-reflexive':{
  singular:[T('Io ___ la mattina.','I get up in the morning.','mi alzo','Both mi and alzo refer to io.'),T('Paolo ___ la sera.','Paolo washes himself in the evening.','si lava','One named person uses si lava.')],
  plural:[T('Eva e Paolo ___ la mattina.','Eva and Paolo wash themselves in the morning.','si lavano','Loro uses si with the plural lavano.'),T('Noi ___ alle sette.','We get up at seven.','ci alziamo','Noi uses ci alziamo.')]
 },
 'a1-work-study-day':{
  activity:[T('Tu ___ in ufficio?','Do you work at the office?','lavori','Familiar tu takes lavori.'),T('Eva ___ in biblioteca.','Eva studies at the library.','studia','One named person takes studia.')],
  finish:[T('Tu ___ alle nove?','Do you finish at nine?','finisci','The tu form is finisci, with -isc-.'),T('Eva e Paolo ___ alle sei.','Eva and Paolo finish at six.','finiscono','Two people take finiscono.')]
 },
 'a1-cafe-order':{
  request:[T('___ un caffè, per favore.','I would like a coffee, please.','Vorrei','Vorrei is the polite speaker’s request chunk.'),T('Vorrei due ___.','I would like two teas.','tè','Tè stays unchanged in the plural.')],
  price:[T('Due caffè ___ quattro euro.','Two coffees cost four euros.','costano','The plural subject takes costano.'),T('Il tè ___ tre euro.','The tea costs three euros.','costa','One tea takes costa.')]
 },
 'a1-food-preference':{
  prefer:[T('Voi ___ il riso?','Do you all prefer rice?','preferite','Voi preferite has no -isc-.'),T('Signora, Lei ___ la pasta?','Madam, do you prefer pasta?','preferisce','Polite Lei takes preferisce.')],
  liking:[T('Mi ___ mangiare la frutta.','I like eating fruit.','piace','An infinitive activity takes piace.'),T('Mi ___ i panini di questo bar.','I like the sandwiches at this café.','piacciono','The plural sandwiches take piacciono.')]
 },
 'a1-clothes-colours':{
  colour:[T('La camicia è ___.','The shirt is red.','rossa','Camicia is feminine singular: rossa.'),T('I pantaloni sono ___.','The trousers are black.','neri','Pantaloni is masculine plural: neri.')],
  wear:[T('Signora, Lei ___ una camicia blu?','Madam, are you wearing a blue shirt?','indossa','Polite Lei takes indossa.'),T('Tu ___ scarpe bianche?','Are you wearing white shoes?','indossi','Familiar tu takes indossi.')]
 },
 'a1-clothes-shop':{
  size:[T('La taglia è ___.','The size is medium.','media','The feminine word taglia takes media.'),T('Questa giacca è troppo ___.','This jacket is too large.','grande','Grande is the singular large form.')],
  permission:[T('Posso ___ una camicia?','May I try on a shirt?','provare','After posso, leave provare in the infinitive.'),T('Scusi, ___?','Excuse me, can you help me? Address the clerk politely.','può aiutarmi','Può aiutarmi asks the other person politely for help.')]
 },
 'a1-weather-conditions':{
  weather:[T('Oggi ___.','Today it is hot (weather).','fa caldo','Weather uses fa caldo.'),T('Al parco ___ oggi.','It is windy at the park today.','c’è vento','C’è vento describes the stated weather at the park.')],
  feeling:[T('Tu ___ caldo?','Do you feel hot?','hai','The person tu takes hai caldo.'),T('Eva e Paolo ___ caldo.','Eva and Paolo feel hot.','hanno','Their personal feeling uses hanno caldo.')]
 },
 'a1-weather-plan':{
  action:[T('Signora, Lei ___ oggi?','Madam, are you going out today?','esce','Polite Lei takes esce.'),T('Eva e Paolo ___ a casa.','Eva and Paolo stay at home.','restano','Two named people take restano.')],
  reason:[T('Non esco ___ fa freddo.','I do not go out because it is cold.','perché','The cold weather is the stated reason.'),T('Piove, ___ andiamo al parco.','It is raining, but we go to the park.','ma','Ma gives the requested contrast, rather than a reason.')]
 },
 'a1-health-feeling':{
  wellbeing:[T('Tu ___ bene?','Are you well?','stai','Familiar tu takes stai.'),T('Paolo ___ male.','Paolo feels unwell.','sta','One named person takes sta.')],
  symptom:[T('Signora, Lei ___ la febbre?','Madam, do you have a fever?','ha','Polite Lei takes ha la febbre.'),T('Sara dice: «Sono ___.»','Sara, a woman, says she is tired. Use the taught adjective.','stanca','The adjective describes the stated female speaker.')]
 },
 'a1-health-help':{
  help:[T('___ un medico.','I need a doctor. Complete the whole need expression.','Ho bisogno di','Ho bisogno di introduces the required person or thing.'),T('Scusi, ___?','Excuse me, can you help me? Use the taught polite chunk.','può aiutarmi','Può aiutarmi asks for help politely.')],
  appointment:[T('Vorrei un ___ oggi.','I would like an appointment today.','appuntamento','The service request is for an appointment.'),T('Vorrei un appuntamento domani ___ nove.','I would like an appointment tomorrow at nine.','alle','Alle introduces this whole-hour time.')]
 },
 'a1-calendar-dates':{
  day:[T('La lezione è il ___ gennaio.','The lesson is on the first of January.','primo','Dates use primo for day one.'),T('Il compleanno è il ___ maggio.','The birthday is on the twenty-eighth of May. Write one Italian word.','ventotto','Venti loses its final i before otto.')],
  month:[T('La lezione è il cinque ___.','The lesson is on the fifth of March.','marzo','March is marzo.'),T('Il compleanno è il ventuno ___.','The birthday is on the twenty-first of May.','maggio','May is maggio.')]
 },
 'a1-opening-times':{
  time:[T('Signora, Lei ___ alle sei?','Madam, do you close at six?','chiude','Polite Lei takes chiude.'),T('Tu ___ alle nove?','Do you open at nine?','apri','Familiar tu takes apri.')],
  state:[T('La farmacia è ___ adesso.','The pharmacy is closed now.','chiusa','Feminine singular farmacia takes chiusa.'),T('I negozi sono ___ oggi.','The shops are open today.','aperti','Masculine plural negozi takes aperti.')]
 },
 'a1-simple-directions':{
  direction:[T('La farmacia è ___.','The pharmacy is on the right.','a destra','The stated side is right: a destra.'),T('Dopo il bar, gira ___.','After the café, turn left.','a sinistra','Keep the café as the landmark and turn left after it.')],
  address:[T('Paolo, ___ a sinistra.','Paolo, turn left. Address your friend familiarly.','gira','The familiar command is gira.'),T('Signora, ___ a destra.','Madam, turn right. Use the polite taught command.','giri','The polite command is giri.')]
 },
 'a1-meet-place':{
  'place-time':[T('Ci vediamo ___ alle cinque.','Let’s meet at the café at five.','al bar','Al bar gives the supplied meeting place.'),T('Ci vediamo davanti alla stazione alle ___.','Let’s meet in front of the station at six.','sei','The supplied time is six.')],
  confirm:[T('«Alle cinque?» «Va bene, alle ___.»','Accept the five o’clock proposal exactly.','cinque','An exact confirmation keeps cinque.'),T('Alle sei non ___.','I cannot at six.','posso','Non posso declines the specified time.')]
 },
 'a1-leisure-invitation':{
  activity:[T('Signora, Lei ___ la musica?','Madam, do you listen to music?','ascolta','Polite Lei takes ascolta.'),T('Eva e Paolo ___ questo libro.','Eva and Paolo read this book.','leggono','Two named people take leggono.')],
  invite:[T('___ al cinema stasera?','Invite your friend to come to the cinema this evening. Complete the invitation frame.','Vuoi venire','Vuoi asks the friend; venire stays in the infinitive.'),T('Mi ___, non posso.','I am sorry, I cannot.','dispiace','The taught courteous refusal begins mi dispiace.')]
 },
 'a1-contact-details':{
  detail:[T('Il cognome è Neri. ___?','Ask how the surname is spelled. Use the taught whole question.','Come si scrive','Come si scrive asks for the spelling.'),T('Non capisco. Può ___?','I do not understand. Can you repeat?','ripetere','Può ripetere requests the information again.')],
  confirm:[T('«Il cognome è Bianchi.» «___?»','Confirm the surname exactly.','Bianchi','Keep the stated surname Bianchi.'),T('«Zero sei due.» «Zero ___ due?»','Confirm the middle digit in Italian.','sei','The middle digit is six.')]
 }
};

export const everydayUnits=[
{id:15,title:'Describe a home and its people',description:'Name rooms, locate useful objects, and introduce a family without guessing gender.',lessons:[
 {id:'a1-home-rooms',title:'Find things in a home',outcome:'I can say which room an object is in and describe a small home.',prerequisites:['v2-a1-there-is','v2-a1-a-in-articles'],domains:['home'],words:[W('camera','bedroom','la','camere'),W('cucina','kitchen','la','cucine'),W('bagno','bathroom','il','bagni'),W('letto','bed','il','letti'),W('tavolo','table','il','tavoli'),W('sedia','chair','la','sedie'),W('sul tavolo','on the table'),W('accanto al letto','next to the bed')],related:['w:camera|noun','w:cucina|noun','w:bagno|noun'],facets:[
 F('room','Locate a familiar object','In cucina means in the kitchen; in bagno means in the bathroom. Nella camera means in the bedroom. Say where the named object is, rather than how many there are.','Il tavolo è in cucina.','The table is in the kitchen.',[
 C('Il tavolo è ___.','The table is in the kitchen.','in cucina',['in cucina','in bagno','sul tavolo'],'Cucina is the room where this table is.'),
 C('Il letto è ___.','The bed is in the bedroom.','nella camera',['nella camera','in cucina','in bagno'],'Nella camera locates the bed in the bedroom.'),
 T('La sedia è ___.','The chair is in the kitchen.','in cucina','Use the room phrase in cucina.'),
 C('Il libro è ___.','The book is in the bathroom.','in bagno',['in bagno','in cucina','nella camera'],'The specified room is the bathroom: in bagno.'),
 T('Il tavolo è ___.','The table is in the bedroom.','nella camera','In + la gives nella; in camera is also a natural location phrase.', ['in camera'])]),
 F('position','Name a position','Su + il becomes sul: sul tavolo, on the table. Learn accanto al letto as a useful location phrase: next to the bed.','Il libro è sul tavolo. La sedia è accanto al letto.','The book is on the table. The chair is next to the bed.',[
 C('Il libro è ___.','The book is on the table.','sul tavolo',['sul tavolo','in bagno','accanto al letto'],'Sul tavolo tells you the book is on the table.'),
 T('La sedia è ___.','The chair is next to the bed.','accanto al letto','Accanto a means next to; a + il gives al.'),
 C('Il pane è ___.','The bread is on the table.','sul tavolo',['sul tavolo','accanto al letto','in bagno'],'On the table is sul tavolo, not next to the bed.'),
 T('Il libro è ___.','The book is next to the bed.','accanto al letto','Keep the introduced location phrase together.'),
 C('La sedia è ___.','The chair is on the table.','sul tavolo',['sul tavolo','in cucina','accanto al letto'],'The task specifies on the table, even if a chair usually stands on the floor.')])],passage:['read','A small room','La camera è piccola. C’è un letto. Il libro è sul tavolo. La sedia è accanto al letto.','The bedroom is small. There is a bed. The book is on the table. The chair is next to the bed.'],portfolio:['write','Describe two objects in a fictional home. Use a room and one position.','Il tavolo è in cucina. Il libro è sul tavolo.',['Name the object.','Give its room or position.','Check è for one object.']]},
 {id:'a1-family-description',title:'Introduce your family',outcome:'I can introduce relatives and distinguish their relationship, name and age.',prerequisites:['v2-a1-family-possessives','v2-a1-adjective-agreement','v2-a1-age-states'],domains:['family','personal-information'],words:[W('fratello','brother','il','fratelli'),W('sorella','sister','la','sorelle'),W('figlio','son','il','figli'),W('figlia','daughter','la','figlie'),W('genitori','parents','i'),W('anni','years','gli'),W('venti','twenty'),W('dieci','ten')],related:['w:fratello|noun','w:sorella|noun','v:avere'],facets:[
 F('relationship','Give the relationship','Mio fratello and mia sorella normally have no article when the family noun is singular and unmodified. Plural i miei genitori keeps the article.','Mia sorella è Eva. I miei genitori sono di Roma.','My sister is Eva. My parents are from Rome.',[
 C('___ sorella è Eva.','My sister is Eva.','Mia',['Mia','Mio','I miei'],'Sorella is feminine singular, so use mia without an article here.'),
 T('___ fratello è Paolo.','My brother is Paolo.','Mio','Fratello is masculine singular; this unmodified family noun uses mio.'),
 C('___ genitori sono di Napoli.','My parents are from Naples.','I miei',['I miei','Mio','Mia'],'The plural family noun keeps the article: i miei genitori.'),
 T('___ figlia è Eva.','My daughter is Eva.','Mia','Figlia is feminine singular; use mia.'),
 C('___ figlio è Paolo.','My son is Paolo.','Mio',['Mio','Mia','I miei'],'Figlio is masculine singular: mio figlio.')]),
 F('age','Give an age','A person is identified with essere, but age uses avere + number + anni. Do not change the person when changing the number.','Mio fratello è Paolo. Ha venti anni.','My brother is Paolo. He is twenty years old.',[
 C('Mia sorella ___ dieci anni.','My sister is ten years old.','ha',['ha','è','hanno'],'One person has an age: ha dieci anni.'),
 T('I miei figli ___ dieci anni.','My children are ten years old.','hanno','Two children take hanno; age uses avere.'),
 C('Io ___ venti anni.','I am twenty years old.','ho',['ho','sono','ha'],'The speaker gives their age with ho.'),
 T('Paolo ___ venti anni.','Paolo is twenty years old.','ha','One named person takes ha.'),
 C('Voi ___ venti anni?','Are you both twenty years old?','avete',['avete','siete','hanno'],'Plural you takes avete, including when giving age.')])],passage:['listen','Meet Eva’s family','Eva: «Mio fratello è Paolo. Ha venti anni. I miei genitori sono di Napoli.»','Eva: “My brother is Paolo. He is twenty years old. My parents are from Naples.”'],portfolio:['speak','Introduce two fictional relatives. Say a relationship and give one age.','Mia sorella è Eva. Ha dieci anni. Mio fratello è Paolo.',['Use mio or mia for the named relative.','Use avere for age.','Use plural forms only for multiple people.']]}
]},
{id:16,title:'Build a daily routine',description:'Use morning and evening actions, then describe where work and study fit into the day.',lessons:[
 {id:'a1-routine-reflexive',title:'Say when you get up',outcome:'I can use a few explained reflexive actions in a daily routine.',prerequisites:['v2-a1-are-plural','v2-a1-days-clock'],domains:['daily-routine'],words:[W('alzarsi','to get up'),W('lavarsi','to wash oneself'),W('mattina','morning','la','mattine'),W('sera','evening','la','sere'),W('ogni giorno','every day'),W('alle sette','at seven'),W('alle otto','at eight'),W('presto','early')],related:['v:alzarsi','v:lavarsi'],facets:[
 F('singular','Say who gets up','For these reflexive actions, mi belongs with io, ti with tu, si with lui/lei or polite Lei. Alzarsi: mi alzo, ti alzi, si alza. Lavarsi: mi lavo, ti lavi, si lava. The small word belongs before the conjugated verb.','Mi alzo alle sette. Tu ti lavi la mattina.','I get up at seven. You wash yourself in the morning.',[
 C('Io ___ alle sette.','I get up at seven.','mi alzo',['mi alzo','ti alzi','si alza'],'Io takes mi alzo; both the small word and verb refer to the speaker.'),
 T('Tu ___ alle otto.','You get up at eight.','ti alzi','Tu takes ti alzi.'),
 C('Eva ___ la mattina.','Eva washes herself in the morning.','si lava',['si lava','mi lavo','ti lavi'],'One named person takes si lava.'),
 T('Signora, Lei ___ presto?','Madam, do you get up early?','si alza','Polite Lei takes si alza, the third-person singular form.'),
 C('Io ___ la sera.','I wash myself in the evening.','mi lavo',['mi lavo','si lava','ti lavi'],'The speaker uses mi lavo.')]),
 F('plural','Describe more than one person','Alzarsi: noi ci alziamo, voi vi alzate, loro si alzano. Lavarsi: noi ci laviamo, voi vi lavate, loro si lavano. Loro uses si like a singular person, but the verb has the plural ending.','Noi ci alziamo alle otto. Loro si lavano la sera.','We get up at eight. They wash themselves in the evening.',[
 C('Noi ___ alle otto.','We get up at eight.','ci alziamo',['ci alziamo','vi alzate','si alzano'],'Noi takes ci alziamo.'),
 T('Voi ___ la mattina.','You all wash yourselves in the morning.','vi lavate','Voi takes vi lavate.'),
 C('Eva e Paolo ___ presto.','Eva and Paolo get up early.','si alzano',['si alzano','si alza','ci alziamo'],'Two named people take the plural si alzano.'),
 T('Noi ___ la sera.','We wash ourselves in the evening.','ci laviamo','Both ci and laviamo identify noi.'),
 C('Voi ___ alle sette?','Do you all get up at seven?','vi alzate',['vi alzate','ci alziamo','si alzano'],'The people addressed are voi, so vi alzate.')])],passage:['read','A morning routine','Mi alzo alle sette. Mi lavo la mattina. Eva si alza alle otto.','I get up at seven. I wash myself in the morning. Eva gets up at eight.'],portfolio:['write','Write two short sentences about a fictional morning, then one about two people.','Mi alzo alle sette. Mi lavo la mattina. Eva e Paolo si alzano alle otto.',['Keep mi/ti/si/ci/vi with the correct person.','Use a taught time.','Use a plural verb for two people.']]},
 {id:'a1-work-study-day',title:'Describe work and study',outcome:'I can describe a simple work or study routine and ask about someone else’s.',prerequisites:['v2-a1-are-plural','v2-a1-present-isc'],domains:['work','daily-routine'],words:[W('lavorare','to work'),W('studiare','to study'),W('finire','to finish'),W('ufficio','office','l’','uffici'),W('biblioteca','library','la','biblioteche'),W('pomeriggio','afternoon','il','pomeriggi'),W('alle nove','at nine'),W('alle sei','at six')],related:['v:lavorare','v:studiare','v:finire','w:ufficio|noun'],facets:[
 F('activity','Say where you work or study','Lavorare uses lavoro, lavori, lavora, lavoriamo, lavorate, lavorano; polite Lei lavora. Studiare uses studio, studi, studia, studiamo, studiate, studiano; polite Lei studia. Use in ufficio for at the office and in biblioteca for at the library.','Lavoro in ufficio. Studiamo in biblioteca.','I work at the office. We study at the library.',[
 C('Io ___ in ufficio.','I work at the office.','lavoro',['lavoro','lavori','lavora'],'Io uses lavoro.'),
 T('Voi ___ in biblioteca?','Do you all study at the library?','studiate','Studiare has voi studiate.'),
 C('Paolo ed Eva ___ in ufficio.','Paolo and Eva work at the office.','lavorano',['lavorano','lavora','lavoriamo'],'Two named people take lavorano.'),
 T('Noi ___ in biblioteca.','We study at the library.','studiamo','The noi form is studiamo, with one i.'),
 C('Signora, Lei ___ qui?','Madam, do you work here?','lavora',['lavora','lavori','lavorano'],'Polite Lei takes lavora.')]),
 F('finish','Give a finishing time','Finire adds -isc- in finisco, finisci, finisce and finiscono. Noi finiamo and voi finite have no -isc-. Polite Lei finisce. The time follows alle for these hours.','Finisco alle sei. Noi finiamo alle nove.','I finish at six. We finish at nine.',[
 C('Io ___ alle sei.','I finish at six.','finisco',['finisco','finisci','finiamo'],'Finire uses io finisco.'),
 T('Noi ___ alle nove.','We finish at nine.','finiamo','Noi finiamo has no -isc-.'),
 C('Eva ___ alle sei.','Eva finishes at six.','finisce',['finisce','finite','finisci'],'One named person takes finisce.'),
 T('Voi ___ alle sei?','Do you all finish at six?','finite','Voi finite has no -isc-.'),
 C('Paolo ed Eva ___ alle nove.','Paolo and Eva finish at nine.','finiscono',['finiscono','finisce','finiamo'],'Loro finiscono includes -isc- and the plural -ono ending.')])],passage:['listen','Two different days','Paolo: «Lavoro in ufficio. Finisco alle sei.»\nEva: «Studio in biblioteca il pomeriggio.»','Paolo: “I work at the office. I finish at six.”\nEva: “I study at the library in the afternoon.”'],portfolio:['interact','Ask a classmate about work or study and the finishing time. Practise with the supplied partner prompt.','Lavori in ufficio? Finisci alle sei?',['Ask about the other person.','Keep the familiar tu forms.','Use a time in the second question.'],'Studio in biblioteca. Finisco alle nove.']}
]},
{id:17,title:'Choose food and drink',description:'Make a small café order, understand quantities and prices, and state a preference.',lessons:[
 {id:'a1-cafe-order',title:'Order and check the bill',outcome:'I can order a familiar item politely and ask its price.',prerequisites:['v2-a1-potere-requests','v2-a1-tens-prices'],domains:['food','shopping'],words:[W('vorrei','I would like · a polite request chunk'),W('acqua','water','l’'),W('caffè','coffee','il','caffè'),W('tè','tea','il','tè'),W('panino','sandwich','il','panini'),W('il conto','the bill'),W('quanto costa?','how much does it cost?'),W('costare','to cost'),W('euro','euro','l’','euro')],related:['v:costare','w:panino|noun','w:acqua|noun','w:caffè|noun'],facets:[
 F('request','Make a small order','Use vorrei as a polite request chunk: vorrei un tè. You can also make a short noun request with per favore. Un panino is one sandwich; due panini is two.','Vorrei un panino, per favore.','I would like a sandwich, please.',[
 C('___ un tè, per favore.','I would like a tea, please.','Vorrei',['Vorrei','Grazie','Il conto'],'Vorrei begins the polite request; grazie thanks someone after help.'),
 T('Due panini, ___.','Two sandwiches, please.','per favore','Per favore makes the noun request polite.'),
 C('Vorrei ___.','I would like two coffees.','due caffè',['due caffè','un caffè','due tè'],'Due says two; caffè stays the same in the plural.'),
 T('Il conto, ___.','The bill, please.','per favore','Il conto asks for the bill, softened by per favore.'),
 C('Vorrei ___.','I would like a sandwich.','un panino',['un panino','due panini','un tè'],'The singular item is un panino.')]),
 F('price','Ask and understand a price','Quanto costa? asks the price of one thing. Quanto costano? asks about several. Here the item, rather than a person, is the subject: un panino costa, due panini costano.','Quanto costa il panino? Costa tre euro.','How much does the sandwich cost? It costs three euros.',[
 C('Quanto ___ il tè?','How much does the tea cost?','costa',['costa','costano','costi'],'The single tea takes costa.'),
 T('Quanto ___ due panini?','How much do two sandwiches cost?','costano','Two sandwiches take costano.'),
 C('«Quanto costa?» «Costa cinque euro.»','Choose the stated price.','Five euros',['Five euros','Three euros','Two euros'],'Cinque euro states five euros.'),
 T('Il caffè ___ due euro.','The coffee costs two euros.','costa','One coffee takes costa.'),
 C('«Quanto costano?» «Costano dieci euro.»','Choose the stated total.','Ten euros',['Ten euros','Two euros','Five euros'],'Dieci euro is ten euros; do not infer a different total.')])],passage:['read','A café menu','Caffè: due euro. Tè: tre euro. Panino: cinque euro.','Coffee: two euros. Tea: three euros. Sandwich: five euros.'],portfolio:['interact','Order one familiar drink and ask its price. Respond to the supplied price politely.','Vorrei un tè, per favore. Quanto costa? Grazie.',['State the item and quantity.','Ask the price of the singular item.','Thank the person after the reply.'],'Costa tre euro.']},
 {id:'a1-food-preference',title:'Choose what you prefer',outcome:'I can express a drink preference and distinguish liking one thing from several.',prerequisites:['v2-a1-present-isc','v2-a1-piacere','v2-a1-cafe-order'],domains:['food','preferences'],words:[W('preferire','to prefer'),W('pasta','pasta','la'),W('riso','rice','il'),W('frutta','fruit','la'),W('verdura','vegetables as food','la'),W('o','or'),W('anche','also; too'),W('senza zucchero','without sugar')],related:['v:preferire','v:piacere','w:frutta|noun'],facets:[
 F('prefer','Give a preference','Preferire uses preferisco, preferisci, preferisce, preferiamo, preferite, preferiscono; polite Lei preferisce. Preferisco il tè says what I prefer. The question Tè o caffè? offers alternatives with o.','Preferisco il tè senza zucchero.','I prefer tea without sugar.',[
 C('Io ___ il riso.','I prefer rice.','preferisco',['preferisco','preferisci','preferiamo'],'Io takes preferisco.'),
 T('Noi ___ la pasta.','We prefer pasta.','preferiamo','Noi preferiamo has no -isc-.'),
 C('Eva e Paolo ___ la frutta.','Eva and Paolo prefer fruit.','preferiscono',['preferiscono','preferisce','preferite'],'Two named people take preferiscono.'),
 T('Tu ___ il tè o il caffè?','Do you prefer tea or coffee?','preferisci','Familiar tu takes preferisci.'),
 C('Signora, Lei ___ il tè?','Madam, do you prefer tea?','preferisce',['preferisce','preferisci','preferite'],'Polite Lei uses preferisce.')]),
 F('liking','Say what you like','In mi piace, the thing liked controls the verb. A singular noun or an activity takes piace. Several countable things take piacciono. Pasta and frutta are singular food nouns here.','Mi piace la pasta. Mi piacciono i panini.','I like pasta. I like sandwiches.',[
 C('Mi ___ la frutta.','I like fruit.','piace',['piace','piacciono','piaci'],'La frutta is grammatically singular.'),
 T('Mi ___ i panini.','I like sandwiches.','piacciono','The plural i panini takes piacciono.'),
 C('Mi ___ il riso.','I like rice.','piace',['piace','piacciono','piaci'],'Il riso is singular, so piace.'),
 T('Mi ___ i caffè di questo bar.','I like the coffees at this café.','piacciono','The article i marks several coffees, despite the unchanged noun caffè.'),
 C('Mi ___ mangiare la pasta.','I like eating pasta.','piace',['piace','piacciono','piaci'],'The activity mangiare la pasta takes piace.')])],passage:['listen','Choose a drink','Eva: «Preferisci il tè o il caffè?»\nPaolo: «Preferisco il tè senza zucchero.»','Eva: “Do you prefer tea or coffee?”\nPaolo: “I prefer tea without sugar.”'],portfolio:['speak','Say which drink you prefer, then name a food you like.','Preferisco il tè. Mi piace la frutta.',['Use preferisco for your preference.','Use piace with a singular food noun.','Keep the meaning of your chosen item.']]}
]},
{id:18,title:'Choose and buy clothes',description:'Name clothes, match colours and describe a useful size request.',lessons:[
 {id:'a1-clothes-colours',title:'Describe the clothes you wear',outcome:'I can name familiar clothes and match their colours.',prerequisites:['v2-a1-adjective-agreement','v2-a1-are-plural'],domains:['clothes'],words:[W('camicia','shirt','la','camicie'),W('giacca','jacket','la','giacche'),W('scarpa','shoe','la','scarpe'),W('pantaloni','trousers','i'),W('rosso','red (masculine singular)'),W('nero','black (masculine singular)'),W('bianco','white (masculine singular)'),W('blu','blue · unchanged'),W('indossare','to wear; to put on clothing')],related:['v:indossare','w:camicia|noun','w:giacca|noun','w:scarpa|noun'],facets:[
 F('colour','Match the colour to the clothes','Rosso changes to rossa, rossi, rosse; nero changes to nera, neri, nere; bianco changes to bianca, bianchi, bianche. Blu is unchanged. The colour agrees with the clothes, regardless of who wears them.','La camicia è rossa. Le scarpe sono nere.','The shirt is red. The shoes are black.',[
 C('La giacca è ___.','The jacket is black.','nera',['nera','nero','neri'],'Giacca is feminine singular, so nera.'),
 T('Le scarpe sono ___.','The shoes are white.','bianche','Scarpe is feminine plural; white becomes bianche.'),
 C('I pantaloni sono ___.','The trousers are red.','rossi',['rossi','rosse','rosso'],'Pantaloni is masculine plural, so rossi.'),
 T('La camicia è ___.','The shirt is blue.','blu','Blu keeps the same form.'),
 C('Le giacche sono ___.','The jackets are red.','rosse',['rosse','rossi','rossa'],'Plural feminine giacche takes rosse.')]),
 F('wear','Say who wears them','Indossare uses indosso, indossi, indossa, indossiamo, indossate, indossano; polite Lei indossa. It can describe the clothing someone is wearing.','Indosso una camicia blu. Eva indossa una giacca nera.','I am wearing a blue shirt. Eva is wearing a black jacket.',[
 C('Io ___ una giacca.','I am wearing a jacket.','indosso',['indosso','indossi','indossa'],'Io takes indosso.'),
 T('Noi ___ scarpe nere.','We are wearing black shoes.','indossiamo','Noi takes indossiamo.'),
 C('Eva e Paolo ___ pantaloni blu.','Eva and Paolo are wearing blue trousers.','indossano',['indossano','indossa','indossate'],'Two named people take indossano.'),
 T('Voi ___ camicie bianche?','Are you all wearing white shirts?','indossate','Voi takes indossate.'),
 C('Signora, Lei ___ una giacca rossa?','Madam, are you wearing a red jacket?','indossa',['indossa','indossi','indosso'],'Polite Lei takes indossa.')])],passage:['read','Clothes for today','Eva indossa una camicia bianca. Paolo indossa pantaloni blu e scarpe nere.','Eva is wearing a white shirt. Paolo is wearing blue trousers and black shoes.'],portfolio:['write','Describe two fictional people’s clothes. Include one colour for each.','Eva indossa una giacca rossa. Paolo indossa una camicia blu.',['Give the wearer and item.','Agree the colour with the item.','Keep blu unchanged.']]},
 {id:'a1-clothes-shop',title:'Ask for a size in a shop',outcome:'I can ask for a clothing size and permission to try an item.',prerequisites:['v2-a1-clothes-colours','v2-a1-potere-requests','v2-a1-cafe-order'],domains:['clothes','shopping'],words:[W('taglia','clothing size','la','taglie'),W('piccola','small (feminine singular)'),W('media','medium (feminine singular)'),W('grande','large (singular)'),W('provare','to try; to try on'),W('questa giacca','this jacket'),W('troppo','too · before an adjective'),W('va bene','it is fine; it fits the purpose')],related:['v:provare','w:taglia|noun','w:giacca|noun'],facets:[
 F('size','Request a size','For a simple shop request, keep taglia piccola, taglia media or taglia grande together. These adjectives describe the feminine word taglia. Vorrei una taglia media is a polite request.','Vorrei una taglia media, per favore.','I would like a medium size, please.',[
 C('Vorrei una ___.','I would like a small size.','taglia piccola',['taglia piccola','taglia media','taglia grande'],'Piccola is the requested small size.'),
 T('Vorrei una taglia ___.','I would like a medium size.','media','Taglia is feminine; media is the taught medium-size expression.'),
 C('Questa giacca è troppo ___.','This jacket is too small.','piccola',['piccola','piccoli','piccolo'],'Too small is troppo piccola with feminine giacca.'),
 T('Vorrei una taglia ___.','I would like a large size.','grande','Grande is the singular large form for taglia.'),
 C('«Questa giacca va bene.»','What does the customer mean here?','This jacket is fine',['This jacket is fine','This jacket is too small','This jacket is too big'],'Va bene expresses that the item suits the customer.')]),
 F('permission','Ask before trying it on','Posso provare questa giacca? asks permission to try the jacket on. Posso is the speaker’s form of potere; provare stays in the infinitive. Può aiutarmi? is a separate polite help chunk meaning Can you help me?','Posso provare questa giacca?','May I try on this jacket?',[
 C('___ provare questa giacca?','May I try on this jacket?','Posso',['Posso','Puoi','Può'],'The speaker asks permission, so posso.'),
 T('Posso ___ questa camicia?','May I try on this shirt?','provare','After posso, use the infinitive provare.'),
 C('Scusi, ___','Ask the clerk politely for help.','può aiutarmi?',['può aiutarmi?','posso provare?','arrivederci!'],'Può aiutarmi addresses the clerk politely and asks for help.'),
 T('___ provare queste scarpe?','May I try on these shoes?','Posso','The speaker still uses posso, even with several shoes.'),
 C('Posso ___ questa giacca?','May I try on this jacket?','provare',['provare','provo','provi'],'Potere is conjugated; the next verb remains provare.')])],extraWords:[W('Può aiutarmi?','Can you help me? (polite)'),W('queste scarpe','these shoes')],passage:['listen','A shop request','Cliente: «Vorrei una taglia media. Posso provare questa giacca?»\nCommessa: «Sì, certo.»','Customer: “I would like a medium size. May I try on this jacket?”\nShop assistant: “Yes, of course.”'],portfolio:['interact','Request a size, ask to try a jacket, then respond to the partner.','Vorrei una taglia media. Posso provare questa giacca? Grazie.',['Name the size.','Ask permission with posso + provare.','Thank the shop assistant.'],'Sì, certo. Ecco la giacca.']}
]},
{id:19,title:'Talk about weather and comfort',description:'Describe the weather, distinguish it from how a person feels, and make a simple plan.',lessons:[
 {id:'a1-weather-conditions',title:'Say what the weather is like',outcome:'I can describe familiar weather and distinguish weather from personal comfort.',prerequisites:['v2-a1-fare','v2-a1-age-states'],domains:['weather'],words:[W('che tempo fa?','what is the weather like?'),W('fa caldo','it is hot (weather)'),W('fa freddo','it is cold (weather)'),W('piove','it is raining'),W('c’è il sole','it is sunny'),W('c’è vento','it is windy'),W('ho caldo','I feel hot'),W('ho freddo','I feel cold')],related:['v:fare','v:avere','w:pioggia|noun','w:sole|noun'],facets:[
 F('weather','Describe the weather','Che tempo fa? asks about the weather. Use the fixed weather expressions fa caldo, fa freddo, piove, c’è il sole and c’è vento. Weather fa stays singular; it has no personal subject here.','Oggi fa freddo. Piove.','Today it is cold. It is raining.',[
 C('Oggi ___.','Today it is hot (the weather).','fa caldo',['fa caldo','ho caldo','hai caldo'],'Weather uses fa caldo; ho caldo describes the speaker.'),
 T('Oggi ___.','Today it is raining.','piove','Piove gives the rain condition; no personal pronoun is needed.'),
 C('Oggi ___.','Today it is sunny.','c’è il sole',['c’è il sole','c’è vento','fa freddo'],'C’è il sole is the taught sunny-weather expression.'),
 T('Oggi ___.','Today it is cold (the weather).','fa freddo','Fa freddo describes the weather.'),
 C('Oggi ___.','Today it is windy.','c’è vento',['c’è vento','c’è il sole','ho freddo'],'C’è vento names windy weather.')]),
 F('feeling','Describe how a person feels','Use avere for personal comfort: ho caldo/freddo, hai caldo/freddo, ha caldo/freddo, abbiamo caldo/freddo, avete caldo/freddo, hanno caldo/freddo. Polite Lei ha caldo/freddo. Caldo and freddo stay unchanged in these expressions.','Eva ha freddo. Noi abbiamo caldo.','Eva feels cold. We feel hot.',[
 C('Io ___ freddo.','I feel cold.','ho',['ho','fa','sono'],'The speaker’s feeling uses ho freddo.'),
 T('Noi ___ caldo.','We feel hot.','abbiamo','Noi takes abbiamo; caldo stays unchanged.'),
 C('Eva e Paolo ___ freddo.','Eva and Paolo feel cold.','hanno',['hanno','fa','sono'],'Two people feel cold: hanno freddo.'),
 T('Signora, Lei ___ caldo?','Madam, do you feel hot?','ha','Polite Lei takes ha.'),
 C('Voi ___ freddo?','Do you all feel cold?','avete',['avete','fa','siete'],'Plural you takes avete freddo.')])],passage:['read','A cold day','Oggi fa freddo. Eva ha freddo. Paolo non ha freddo.','Today the weather is cold. Eva feels cold. Paolo does not feel cold.'],portfolio:['speak','Describe fictional weather, then how one person feels.','Oggi fa freddo. Io ho freddo.',['Use fa for hot or cold weather.','Use avere for a person’s feeling.','Do not make caldo/freddo agree in the avere expression.']]},
 {id:'a1-weather-plan',title:'Choose a plan for the weather',outcome:'I can give a simple weather reason and choose between going out and staying home.',prerequisites:['v2-a1-weather-conditions','v2-a1-basic-links','v2-a1-andare'],domains:['weather','leisure'],words:[W('uscire','to go out'),W('restare','to stay'),W('a casa','at home'),W('al parco','to/at the park'),W('oggi','today'),W('domani','tomorrow'),W('perché','because'),W('ma','but')],related:['v:uscire','v:restare','w:parco|noun'],facets:[
 F('action','Choose an everyday action','Uscire uses esco, esci, esce, usciamo, uscite, escono; polite Lei esce. Restare uses resto, resti, resta, restiamo, restate, restano; polite Lei resta. Say resto a casa for staying home.','Oggi resto a casa. Domani usciamo.','Today I stay home. Tomorrow we go out.',[
 C('Io ___ a casa.','I stay at home.','resto',['resto','resti','resta'],'Io takes resto.'),
 T('Noi ___ domani.','We go out tomorrow.','usciamo','Noi takes usciamo.'),
 C('Eva e Paolo ___ oggi.','Eva and Paolo go out today.','escono',['escono','esce','esco'],'Two named people take escono.'),
 T('Tu ___ oggi?','Are you going out today?','esci','Familiar tu takes esci.'),
 C('Voi ___ a casa?','Are you all staying home?','restate',['restate','restiamo','restano'],'Voi takes restate.')]),
 F('reason','Give a reason or contrast','Perché connects an action to its reason. Ma connects a contrast. A rainy day can be a reason to stay home, but someone can choose to go out despite it; follow the meaning supplied by the task.','Resto a casa perché piove. Fa freddo, ma esco.','I stay home because it is raining. It is cold, but I go out.',[
 C('Resto a casa ___ piove.','I stay home because it is raining.','perché',['perché','ma','e'],'The rain is the reason, so perché.'),
 T('Fa freddo, ___ esco.','It is cold, but I go out.','ma','Ma connects the stated contrast.'),
 C('Andiamo al parco ___ c’è il sole.','We go to the park because it is sunny.','perché',['perché','ma','o'],'Sunshine is the supplied reason.'),
 T('C’è il sole, ___ resto a casa.','It is sunny, but I stay home.','ma','Staying home is contrasted with the sunny weather.'),
 C('Non usciamo ___ piove.','We do not go out because it is raining.','perché',['perché','ma','o'],'Perché supplies the reason for not going out.')])],passage:['listen','A change of plan','Eva: «Oggi piove. Resto a casa.»\nPaolo: «Va bene. Domani andiamo al parco.»','Eva: “Today it is raining. I stay home.”\nPaolo: “All right. Tomorrow we go to the park.”'],portfolio:['write','Send a two-sentence fictional plan with one weather reason.','Oggi resto a casa perché piove. Domani vado al parco.',['Give today’s action.','Connect the reason with perché.','Give a separate plan for tomorrow.']]}
]},
{id:20,title:'Explain a simple health need',description:'Tell someone how you feel and request familiar help without diagnosing or prescribing.',lessons:[
 {id:'a1-health-feeling',title:'Say how you feel',outcome:'I can state a simple symptom and distinguish a feeling from weather.',prerequisites:['v2-a1-avere-plural','v2-a1-adjective-agreement','v2-a1-weather-conditions'],domains:['basic-health'],words:[W('Come stai?','How are you? (familiar)'),W('Come sta?','How are you? (polite)'),W('sto bene','I am well'),W('sto male','I feel unwell'),W('stare','to be; to feel in these expressions'),W('la febbre','a fever'),W('mal di testa','a headache'),W('stanco','tired (masculine singular)'),W('stanca','tired (feminine singular)')],related:['v:stare','v:avere','w:febbre|noun','w:testa|noun'],facets:[
 F('wellbeing','Ask and answer about wellbeing','Stare uses sto, stai, sta, stiamo, state, stanno; polite Lei sta. Bene and male stay unchanged. Ask Come stai? of a friend and Come sta? of someone addressed politely.','Come stai? Sto bene.','How are you? I am well.',[
 C('«Come stai?» «___ bene.»','Answer that you are well.','Sto',['Sto','Stai','Sta'],'The speaker answers with sto.'),
 T('Signora, come ___?','Madam, how are you?','sta','Polite Lei takes sta.'),
 C('Noi ___ male.','We feel unwell.','stiamo',['stiamo','state','stanno'],'Noi takes stiamo.'),
 T('Voi ___ bene?','Are you all well?','state','Voi takes state.'),
 C('Eva e Paolo ___ bene.','Eva and Paolo are well.','stanno',['stanno','sta','stiamo'],'Two named people take stanno.')]),
 F('symptom','Name a simple problem','Use avere in ho la febbre and ho mal di testa. Use essere with stanco/stanca: sono stanco for a male speaker, sono stanca for a female speaker. The symptoms do not change the person of avere.','Ho mal di testa. Eva ha la febbre.','I have a headache. Eva has a fever.',[
 C('Io ___ mal di testa.','I have a headache.','ho',['ho','sono','fa'],'The fixed symptom expression uses avere.'),
 T('Eva ___ la febbre.','Eva has a fever.','ha','Eva is one person, so ha la febbre.'),
 C('Eva dice: «Sono ___.»','Eva, a woman, says she is tired.','stanca',['stanca','stanco','stanchi'],'The adjective describes Eva, so feminine singular stanca.'),
 T('Noi ___ mal di testa.','We have headaches.','abbiamo','Noi takes abbiamo; mal di testa stays a symptom expression.'),
 C('Paolo dice: «Sono ___.»','Paolo, a man, says he is tired.','stanco',['stanco','stanca','stanche'],'The adjective describes Paolo, so masculine singular stanco.')])],passage:['read','A message to a friend','Ciao Eva. Oggi sto male. Ho mal di testa. Resto a casa.','Hi Eva. Today I feel unwell. I have a headache. I am staying home.'],portfolio:['write','Write a fictional message that states one problem and a simple plan.','Oggi sto male. Ho mal di testa. Resto a casa.',['State the feeling.','Name only the supplied symptom.','Give a simple plan using known language.']]},
 {id:'a1-health-help',title:'Ask for help and an appointment',outcome:'I can ask where a pharmacy is and request a medical appointment as a taught service exchange.',prerequisites:['v2-a1-health-feeling','v2-a1-potere-requests','v2-a1-days-clock'],domains:['basic-health','services'],words:[W('farmacia','pharmacy','la','farmacie'),W('medico','doctor','il','medici'),W('appuntamento','appointment','l’','appuntamenti'),W('oggi','today'),W('domani','tomorrow'),W('alle dieci','at ten'),W('Ho bisogno di…','I need…'),W('Può aiutarmi?','Can you help me? (polite)'),W('Dov’è…?','Where is…?')],related:['w:farmacia|noun','w:appuntamento|noun','w:medico|noun'],facets:[
 F('help','Say what help you need','Ho bisogno di + noun says what you need. Keep ho bisogno di un medico as a useful chunk for now. Dov’è la farmacia? asks for a place; può aiutarmi? asks a person politely for help.','Scusi, dov’è la farmacia? Ho bisogno di un medico.','Excuse me, where is the pharmacy? I need a doctor.',[
 C('Scusi, ___','Ask for the location of the pharmacy.','dov’è la farmacia?',['dov’è la farmacia?','come sta?','quanto costa?'],'Dov’è asks where the place is.'),
 T('Ho bisogno ___ un medico.','I need a doctor.','di','The taught expression is ho bisogno di.'),
 C('Scusi, ___','Ask someone politely to help you.','può aiutarmi?',['può aiutarmi?','posso aiutarmi?','come ti chiami?'],'Può addresses the other person politely; aiutarmi means help me.'),
 T('___ la farmacia?','Where is the pharmacy? Use the joined form.','Dov’è','Dov’è combines dove and è with an apostrophe.'),
 C('Ho bisogno di ___.','I need a doctor.','un medico',['un medico','una farmacia','un appuntamento'],'The task asks for the person un medico.')]),
 F('appointment','Request and confirm a time','Vorrei un appuntamento asks politely for an appointment. Oggi o domani? offers two days. Alle dieci means at ten. Confirm the time you heard, rather than repeating a different time.','Vorrei un appuntamento domani alle dieci.','I would like an appointment tomorrow at ten.',[
 C('Vorrei un ___.','I would like an appointment.','appuntamento',['appuntamento','medico','farmacia'],'The service request is for an appointment.'),
 T('Vorrei un appuntamento domani ___ dieci.','I would like an appointment tomorrow at ten.','alle','At ten is alle dieci.'),
 C('«Domani alle dieci.» «___»','Confirm exactly the offered day and time.','Domani alle dieci, grazie.',['Domani alle dieci, grazie.','Oggi alle dieci, grazie.','Domani alle nove, grazie.'],'Keep both domani and alle dieci from the offer.'),
 T('Un appuntamento ___, per favore.','An appointment today, please.','oggi','Oggi requests today; domani would change the day.'),
 C('«Oggi o domani?» «___»','Choose tomorrow.','Domani, per favore.',['Domani, per favore.','Oggi, per favore.','Alle dieci, grazie.'],'The question asks which day, and the supplied choice is tomorrow.')])],passage:['listen','At the reception desk','Cliente: «Vorrei un appuntamento domani.»\nAddetta: «Domani alle dieci.»\nCliente: «Alle dieci, grazie.»','Customer: “I would like an appointment tomorrow.”\nReceptionist: “Tomorrow at ten.”\nCustomer: “At ten, thank you.”'],portfolio:['interact','Request a fictional appointment and confirm the supplied day and time.','Vorrei un appuntamento domani. Domani alle dieci, grazie.',['Request an appointment politely.','Listen or read the offered day and time.','Repeat the exact details.'],'Domani alle dieci.']}
]},
{id:21,title:'Use dates and opening times',description:'Read a calendar date and arrange a visit around a simple opening time.',lessons:[
 {id:'a1-calendar-dates',title:'Say a calendar date',outcome:'I can give a day and month and distinguish the first day from other dates.',prerequisites:['v2-a1-tens-prices','v2-a1-days-clock'],domains:['dates','arrangements'],words:[W('il primo','the first (day of the month)'),W('ventuno','twenty-one'),W('ventotto','twenty-eight'),W('trentuno','thirty-one'),W('gennaio','January'),W('marzo','March'),W('maggio','May'),W('luglio','July'),W('ottobre','October'),W('dicembre','December'),W('compleanno','birthday','il','compleanni'),W('lezione','lesson','la','lezioni'),W('data','date','la','date')],related:['w:mese|noun','w:gennaio|noun','w:ottobre|noun','w:lezione|noun','w:data|noun'],facets:[
 F('day','Give the day of the month','Dates use il + day + month: il cinque maggio. The first day uses primo: il primo maggio. Twenty-one is ventuno and twenty-eight is ventotto: the final i of venti disappears before uno or otto. Thirty-one is trentuno.','Il compleanno è il ventuno marzo.','The birthday is on the twenty-first of March.',[
 C('La lezione è il ___ maggio.','The lesson is on the first of May.','primo',['primo','uno','ventuno'],'The first day of the month uses primo.'),
 T('Il compleanno è il ___ marzo.','The birthday is on the twenty-first of March. Write the number as one Italian word.','ventuno','Venti loses its final i before uno.'),
 C('La lezione è il ___ ottobre.','The lesson is on the twenty-eighth of October.','ventotto',['ventotto','ventiotto','ventuno'],'Twenty-eight is ventotto, with the final i of venti removed.'),
 T('Il compleanno è il ___ dicembre.','The birthday is on the thirty-first of December. Write the number as one Italian word.','trentuno','Thirty-one is trentuno.'),
 C('La lezione è il ___ luglio.','The lesson is on the first of July.','primo',['primo','uno','trentuno'],'Use primo for the first day, including in July.')]),
 F('month','Choose the stated month','Italian month names are normally written with a lower-case initial. Gennaio is January, marzo March, maggio May, luglio July, ottobre October and dicembre December. Keep the day and month as separate details.','La lezione è il dieci ottobre.','The lesson is on the tenth of October.',[
 C('Il compleanno è il cinque ___.','The birthday is on the fifth of May.','maggio',['maggio','marzo','luglio'],'May is maggio; marzo is March.'),
 T('La lezione è il dieci ___.','The lesson is on the tenth of October.','ottobre','October is ottobre.'),
 C('Il compleanno è il primo ___.','The birthday is on the first of January.','gennaio',['gennaio','dicembre','marzo'],'January is gennaio.'),
 T('La lezione è il ventuno ___.','The lesson is on the twenty-first of July.','luglio','July is luglio.'),
 C('Il compleanno è il dieci ___.','The birthday is on the tenth of December.','dicembre',['dicembre','ottobre','maggio'],'December is dicembre.')])],passage:['read','A calendar note','Lezione: il dieci ottobre alle nove. Compleanno di Eva: il ventuno marzo.','Lesson: on the tenth of October at nine. Eva’s birthday: on the twenty-first of March.'],portfolio:['write','Write a fictional appointment date and time. Use one of the taught months.','Appuntamento: il dieci ottobre alle nove.',['Keep the day and month.','Use primo only for day one.','Use alle before this time.']]},
 {id:'a1-opening-times',title:'Check when a place opens',outcome:'I can ask about opening and closing times and distinguish now from a regular time.',prerequisites:['v2-a1-calendar-dates','v2-a1-present-ire','v2-a1-present-ere'],domains:['time','services'],words:[W('aprire','to open'),W('chiudere','to close'),W('aperto','open (masculine singular)'),W('chiuso','closed (masculine singular)'),W('adesso','now'),W('negozio','shop','il','negozi'),W('museo','museum','il','musei'),W('a che ora?','at what time?'),W('dalle nove alle sei','from nine to six')],related:['v:aprire','v:chiudere','w:negozio|noun'],facets:[
 F('time','Ask for an opening time','Aprire uses apro, apri, apre, apriamo, aprite, aprono. Chiudere uses chiudo, chiudi, chiude, chiudiamo, chiudete, chiudono. Polite Lei apre/chiude. A che ora apre? asks when a place opens.','Il negozio apre alle nove e chiude alle sei.','The shop opens at nine and closes at six.',[
 C('Il museo ___ alle nove.','The museum opens at nine.','apre',['apre','apri','aprono'],'One museum takes apre.'),
 T('I negozi ___ alle sei.','The shops close at six.','chiudono','Several shops take chiudono.'),
 C('A che ora ___ il negozio?','At what time does the shop close?','chiude',['chiude','chiudi','chiudono'],'The singular shop is the subject, so chiude.'),
 T('I musei ___ alle dieci.','The museums open at ten.','aprono','The plural subject takes aprono.'),
 C('Noi ___ alle nove.','We open at nine.','apriamo',['apriamo','aprite','aprono'],'Noi takes apriamo.')]),
 F('state','Check whether it is open now','È aperto describes a present state; apre alle nove gives the opening time. Aperto/chiuso agree with the place: la farmacia è aperta, i negozi sono chiusi. Dalle nove alle sei gives a time range.','Il museo è aperto adesso. La farmacia è chiusa.','The museum is open now. The pharmacy is closed.',[
 C('La farmacia è ___.','The pharmacy is open.','aperta',['aperta','aperto','aperti'],'Feminine singular farmacia takes aperta.'),
 T('I negozi sono ___.','The shops are closed.','chiusi','Masculine plural negozi takes chiusi.'),
 C('«Il museo è aperto dalle nove alle sei.»','Which hours are stated?','From nine to six',['From nine to six','From six to nine','At nine only'],'Dalle… alle… gives the opening interval.'),
 T('Il negozio è ___ adesso.','The shop is closed now.','chiuso','A current closed state is è chiuso.'),
 C('Le farmacie sono ___.','The pharmacies are open.','aperte',['aperte','aperti','aperta'],'Plural feminine farmacie takes aperte.')])],passage:['listen','A telephone enquiry','Cliente: «A che ora apre il museo?»\nAddetta: «Apre alle nove e chiude alle sei.»','Customer: “At what time does the museum open?”\nReceptionist: “It opens at nine and closes at six.”'],portfolio:['interact','Ask when a fictional place opens, then confirm the time from the partner.','A che ora apre il museo? Alle nove, grazie.',['Ask about the singular place.','Keep the given time.','Distinguish opening time from being open now.'],'Il museo apre alle nove.']}
]},
{id:22,title:'Find your way',description:'Ask for a destination, follow short directions and confirm the crucial turn.',lessons:[
 {id:'a1-simple-directions',title:'Understand a short route',outcome:'I can ask for a familiar destination and distinguish left, right and straight ahead.',prerequisites:['v2-a1-near-far','v2-a1-familiar-commands'],domains:['places','directions'],words:[W('a destra','to/on the right'),W('a sinistra','to/on the left'),W('dritto','straight ahead'),W('gira','turn (familiar tu command)'),W('giri','turn (polite Lei command)'),W('vada','go (polite Lei command)'),W('stazione','station','la','stazioni'),W('strada','street; road','la','strade'),W('Dov’è…?','Where is…?')],related:['v:girare','v:andare','w:destra|noun','w:sinistra|noun'],facets:[
 F('direction','Follow the specified direction','A destra means right; a sinistra means left; dritto means straight ahead. Gira a destra is a familiar instruction. Giri a destra and vada dritto are polite instructions to one person, taught as route chunks here.','Gira a sinistra. La stazione è a destra.','Turn left. The station is on the right.',[
 C('Gira ___.','Turn right.','a destra',['a destra','a sinistra','dritto'],'Right is a destra.'),
 T('Vada ___.','Go straight ahead (polite).','dritto','Dritto gives straight ahead; it does not name a turn.'),
 C('La stazione è ___.','The station is on the left.','a sinistra',['a sinistra','a destra','dritto'],'The stated position is left: a sinistra.'),
 T('Giri ___.','Turn left (polite).','a sinistra','Left is a sinistra, including after polite giri.'),
 C('Gira ___.','Turn left.','a sinistra',['a sinistra','a destra','dritto'],'Keep the supplied direction left.')]),
 F('address','Ask and confirm politely','Scusi, dov’è la stazione? starts a polite location request. Confirm A destra? or A sinistra? when checking a turn. The route can then be repeated. Use gira to a friend, and giri in this polite exchange.','Scusi, dov’è la stazione? Giri a destra. A destra?','Excuse me, where is the station? Turn right. To the right?',[
 C('Scusi, ___','Ask where the station is.','dov’è la stazione?',['dov’è la stazione?','come si chiama?','quanto costa?'],'The request concerns a place: dov’è la stazione?'),
 T('Signora, ___ a sinistra.','Madam, turn left. Use the polite taught command.','giri','Polite Lei uses giri in this route instruction.'),
 C('«Giri a destra.» «___»','Confirm the exact turn you heard.','A destra?',['A destra?','A sinistra?','Dritto?'],'Repeat right rather than changing the route.'),
 T('Paolo, ___ a destra.','Paolo, turn right. Address your friend familiarly.','gira','Familiar tu uses gira.'),
 C('«Gira a sinistra.» «___»','Confirm the exact turn you heard.','A sinistra?',['A sinistra?','A destra?','Dritto?'],'The turn is left, so confirm a sinistra.')])],passage:['read','A route to the station','Scusi, dov’è la stazione? Vada dritto. Giri a sinistra. La stazione è a destra.','Excuse me, where is the station? Go straight ahead. Turn left. The station is on the right.'],portfolio:['interact','Ask where the station is and confirm the turn from the partner.','Scusi, dov’è la stazione? A sinistra? Grazie.',['Ask for the destination.','Use the exact left/right detail from the reply.','Thank the helper.'],'Vada dritto. Giri a sinistra.']},
 {id:'a1-meet-place',title:'Arrange where to meet',outcome:'I can propose a place and time and confirm a meeting arrangement.',prerequisites:['v2-a1-simple-directions','v2-a1-venire','v2-a1-days-clock'],domains:['places','arrangements'],words:[W('ci vediamo','we’ll see each other; let’s meet · a chunk'),W('davanti alla stazione','in front of the station'),W('al bar','at the café'),W('alle cinque','at five'),W('alle sei','at six'),W('va bene','all right'),W('non posso','I cannot'),W('allora','then; so')],related:['v:vedere','v:potere','w:stazione|noun'],facets:[
 F('place-time','Propose a meeting','Ci vediamo is a familiar arrangement chunk. Add the place and time. Davanti alla stazione means in front of the station; al bar means at the café.','Ci vediamo davanti alla stazione alle cinque.','Let’s meet in front of the station at five.',[
 C('Ci vediamo ___ alle cinque.','Let’s meet in front of the station at five.','davanti alla stazione',['davanti alla stazione','al bar','a casa'],'The supplied meeting place is in front of the station.'),
 T('Ci vediamo al bar ___ sei.','Let’s meet at the café at six.','alle','Alle introduces six o’clock.'),
 C('Ci vediamo ___ alle sei.','Let’s meet at the café at six.','al bar',['al bar','davanti alla stazione','a casa'],'At the café is al bar.'),
 T('Ci vediamo davanti ___ stazione.','Let’s meet in front of the station.','alla','The location phrase is davanti alla stazione.'),
 C('Ci vediamo al bar alle ___.','Let’s meet at the café at five.','cinque',['cinque','sei','nove'],'The specified time is five.')]),
 F('confirm','Confirm or change the time','Va bene accepts an arrangement. Non posso says you cannot; it is not confirmation. After a changed proposal, repeat the new time so both speakers agree.','Alle cinque non posso. Alle sei? Va bene, alle sei.','I cannot at five. At six? All right, at six.',[
 C('«Ci vediamo alle cinque?» «___»','Say you cannot at five.','Alle cinque non posso.',['Alle cinque non posso.','Va bene, alle cinque.','Grazie per il caffè.'],'Non posso declines that time.'),
 T('«Alle sei?» «Va bene, alle ___.»','Confirm the proposed six o’clock.','sei','The accepted time is six, so repeat sei.'),
 C('«Al bar alle cinque.» «___»','Confirm both the place and time exactly.','Al bar alle cinque, va bene.',['Al bar alle cinque, va bene.','Al bar alle sei, va bene.','Alla stazione alle cinque, va bene.'],'Both al bar and alle cinque must stay the same.'),
 T('«Alle cinque non posso. Alle sei?» «Va ___, alle sei.»','Accept the new six o’clock proposal.','bene','Va bene accepts the new proposal.'),
 C('«Davanti alla stazione alle sei.» «___»','Confirm the complete arrangement.','Davanti alla stazione alle sei.',['Davanti alla stazione alle sei.','Al bar alle sei.','Davanti alla stazione alle cinque.'],'Preserve the place and revised time.')])],passage:['listen','Agree on a meeting','Eva: «Ci vediamo al bar alle cinque?»\nPaolo: «Alle cinque non posso. Alle sei?»\nEva: «Va bene, alle sei.»','Eva: “Let’s meet at the café at five?”\nPaolo: “I cannot at five. At six?”\nEva: “All right, at six.”'],portfolio:['interact','Propose a meeting, then accept the partner’s changed time.','Ci vediamo al bar alle cinque? Va bene, alle sei.',['Propose a place and time.','Respond to the changed proposal.','Confirm the final time.'],'Alle cinque non posso. Alle sei?']}
]},
{id:23,title:'Talk about leisure and contact',description:'Choose a leisure activity, invite a friend and ask for a useful contact detail.',lessons:[
 {id:'a1-leisure-invitation',title:'Invite someone to a simple activity',outcome:'I can invite a friend and give a short acceptance or refusal.',prerequisites:['v2-a1-weather-plan','v2-a1-meet-place','v2-a1-piacere'],domains:['leisure','interaction'],words:[W('cinema','cinema','il','cinema'),W('musica','music','la'),W('ascoltare','to listen to'),W('leggere','to read'),W('stasera','this evening'),W('Vuoi venire?','Do you want to come? (familiar)'),W('volentieri','gladly; with pleasure'),W('mi dispiace','I am sorry')],related:['v:ascoltare','v:leggere','v:venire','w:cinema|noun'],facets:[
 F('activity','Describe a leisure activity','Ascoltare uses ascolto, ascolti, ascolta, ascoltiamo, ascoltate, ascoltano; polite Lei ascolta. Leggere uses leggo, leggi, legge, leggiamo, leggete, leggono; polite Lei legge. Ascolto la musica and leggo un libro say what you do.','Ascolto la musica. Noi leggiamo un libro.','I listen to music. We read a book.',[
 C('Io ___ la musica.','I listen to music.','ascolto',['ascolto','ascolti','ascolta'],'Io takes ascolto.'),
 T('Noi ___ un libro.','We read a book.','leggiamo','Noi takes leggiamo.'),
 C('Eva e Paolo ___ la musica.','Eva and Paolo listen to music.','ascoltano',['ascoltano','ascolta','ascoltate'],'Two named people take ascoltano.'),
 T('Voi ___ questo libro?','Are you all reading this book?','leggete','Voi takes leggete.'),
 C('Eva ___ un libro.','Eva reads a book.','legge',['legge','leggi','leggo'],'One named person takes legge.')]),
 F('invite','Invite and respond','Vuoi venire al cinema stasera? asks a friend whether they want to come. Sì, volentieri accepts warmly. Mi dispiace, non posso declines politely. A refusal does not mean the invitation was misunderstood.','Vuoi venire al cinema stasera? Sì, volentieri.','Do you want to come to the cinema this evening? Yes, gladly.',[
 C('«Vuoi venire al cinema?» «___»','Accept the invitation warmly.','Sì, volentieri.',['Sì, volentieri.','Mi dispiace, non posso.','Dov’è la stazione?'],'Volentieri accepts gladly.'),
 T('Mi dispiace, non ___.','I am sorry, I cannot.','posso','Non posso is the taught refusal.'),
 C('___ al cinema stasera?','Invite your friend to come to the cinema this evening.','Vuoi venire',['Vuoi venire','Voglio venire','Può venire'],'Vuoi asks the familiar other person whether they want to come.'),
 T('Sì, ___.','Yes, gladly.','volentieri','Volentieri expresses a willing acceptance.'),
 C('«Vuoi venire stasera?» «___»','Decline politely.','Mi dispiace, non posso.',['Mi dispiace, non posso.','Sì, volentieri.','Va bene, alle sei.'],'This reply clearly declines, rather than confirming a time.')])],passage:['read','An evening invitation','Ciao Paolo! Vuoi venire al cinema stasera? Ci vediamo al bar alle sei.','Hi Paolo! Do you want to come to the cinema this evening? Let’s meet at the café at six.'],portfolio:['interact','Invite a friend, then respond to the supplied refusal with a courteous goodbye.','Vuoi venire al cinema stasera? Va bene. A domani!',['Ask the friend with vuoi.','Notice whether the reply accepts or declines.','Close without pretending the invitation was accepted.'],'Mi dispiace, non posso.']},
 {id:'a1-contact-details',title:'Ask for a contact detail',outcome:'I can request and confirm a name or telephone number without changing its meaning.',prerequisites:['v2-a1-small-numbers','v2-a1-question-words-1','v2-a1-potere-requests'],domains:['personal-information','services'],words:[W('numero di telefono','telephone number','il','numeri di telefono'),W('cognome','surname','il','cognomi'),W('Come si scrive?','How is it spelled? · a chunk'),W('Può ripetere?','Can you repeat? (polite)'),W('lentamente','slowly'),W('zero','zero'),W('sei','six'),W('nove','nine'),W('due','two')],related:['w:telefono|noun','w:cognome|noun','v:ripetere'],facets:[
 F('detail','Ask for the detail you need','Qual è il suo numero di telefono? asks a person politely for their telephone number. Qual è has no apostrophe. Come si scrive? asks how a name is spelled; Può ripetere lentamente? asks for a slower repeat. These are useful whole questions at this stage.','Qual è il suo numero di telefono? Può ripetere lentamente?','What is your telephone number? Can you repeat slowly?',[
 C('___','Ask a person politely for their telephone number.','Qual è il suo numero di telefono?',['Qual è il suo numero di telefono?','Come si scrive?','Come sta?'],'The full question requests the number, rather than spelling or wellbeing.'),
 T('Può ripetere ___?','Can you repeat slowly?','lentamente','Lentamente asks for slower delivery.'),
 C('«Il cognome è Riva.» «___»','Ask how the surname is spelled.','Come si scrive?',['Come si scrive?','Come sta?','Quanto costa?'],'Come si scrive asks for the written form.'),
 T('___ è il suo numero di telefono?','What is your telephone number? Fill the first word.','Qual','Qual è has no apostrophe.'),
 C('___','Ask for a repeat after missing the number.','Può ripetere?',['Può ripetere?','Prego!','Arrivederci!'],'The taught repair phrase requests the same information again.')]),
 F('confirm','Keep the exact detail','A confirmation preserves the sequence of digits or the supplied name. Zero sei nove is 069, not 096. Ask for a repeat when unsure; do not substitute a familiar number. The short digit strings here are fictional practice, not real contact numbers.','Zero sei nove? Sì, zero sei nove.','Zero six nine? Yes, zero six nine.',[
 C('«Zero sei nove.» «___»','Confirm the stated sequence.','Zero sei nove?',['Zero sei nove?','Zero nove sei?','Sei zero nove?'],'The order is zero, six, nine.'),
 T('«Il cognome è Riva.» «___?»','Confirm the surname exactly.','Riva','Keep the supplied surname Riva.'),
 C('«Zero due sei.» «___»','Choose the stated digit sequence.','026',['026','062','206'],'Zero due sei is 026.'),
 T('«Zero nove due.» «Zero ___ due?»','Confirm the missing middle digit in Italian.','nove','The middle digit is nine, not six.'),
 C('«Il cognome è Neri.» «___»','Confirm the surname exactly.','Neri?',['Neri?','Riva?','Eva?'],'Neri is the stated surname.')])],extraWords:[W('Qual è il suo numero di telefono?','What is your telephone number? (polite)'),W('Riva','a fictional surname'),W('Neri','a fictional surname'),W('Bianchi','a fictional surname'),W('Rossi','a fictional surname'),W('il mio cognome','my surname')],passage:['listen','A careful repeat','Cliente: «Il mio cognome è Rossi.»\nAddetta: «Può ripetere, per favore?»\nCliente: «Sì, il mio cognome è Rossi.»','Customer: “My surname is Rossi.”\nReceptionist: “Could you repeat, please?”\nCustomer: “Yes, my surname is Rossi.”'],portfolio:['interact','Ask for the supplied fictional digit sequence and confirm it. Ask for a repeat if needed.','Qual è il suo numero di telefono? Può ripetere lentamente? Zero sei nove?',['Ask for the number politely.','Keep the exact digit order.','Use repetition as communication help.'],'Zero sei nove.']}
]},
];
