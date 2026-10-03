#!/usr/bin/env node
// Bounded Phase 2 repairs. Called by canonical authors and usable against current
// packs without regenerating unrelated lessons or erasing intervening hand edits.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const editorialSources = [
  {topic:'Invariant vicino a / lontano da and adjective agreement',url:'https://accademiadellacrusca.it/it/consulenza/vicino-roma--vicino-a-roma/55'},
  {topic:'Visto and veduto are both past participles of vedere',url:'https://www.treccani.it/vocabolario/vedere/'},
  {topic:'Ci can mean a noi; distinct from partitive ne',url:'https://www.treccani.it/enciclopedia/ci_(La-grammatica-italiana)/'},
];
const unique = items => [...new Set(items)];
const example = (it,en) => ({it,en});
const find = (pack,id) => pack.units.flatMap(unit=>unit.lessons).find(lesson=>lesson.id===id);
const step = (lesson,suffix) => lesson.steps.find(item=>item.id===`${lesson.id}.${suffix}`);
function repair(lesson,body,examples,byFacet){
  Object.assign(lesson.targets[0].repair,{body,examples,...(byFacet?{byFacet}:{})});
}
function fullModel(lesson,body,examples){
  const card={id:`${lesson.id}.phase2-full-forms`,kind:'teach',title:'Keep every person available',body,examples,introduces:[lesson.targets[0].id]};
  const index=lesson.steps.findIndex(item=>item.id===card.id);
  if(index>=0)lesson.steps[index]=card;
  else lesson.steps.splice(lesson.steps.findIndex(item=>item.kind==='question'),0,card);
}

// These are the actual source IDs whose existing checks/bridges need repairs.
// No new course, proficiency claim, reward or completion migration is introduced.
export function repairPhaseContentPack(pack){
  let lesson;
  if((lesson=find(pack,'v2-f-greet'))){
    repair(lesson,'Ciao can greet or say goodbye to a friend. Buongiorno opens a polite daytime exchange. Arrivederci closes an exchange politely.',[
      example('Ciao, Anna!','Hi, Anna!'),example('Buongiorno, signora.','Good day, madam.'),example('Grazie, signora. Arrivederci!','Thank you, madam. Goodbye!'),
    ],{
      'familiar-greeting':{title:'Greet a friend',body:'When a familiar friend arrives, ciao is a natural greeting.',examples:[example('Ciao, Sara!','Hi, Sara!')]},
      'polite-greeting':{title:'Open a polite daytime exchange',body:'Use buongiorno when beginning this polite daytime exchange. Arrivederci is for leaving.',examples:[example('Buongiorno, dottore.','Good day, doctor.')]},
      farewell:{title:'End the exchange',body:'Arrivederci is a polite goodbye. The person is leaving, so this is a farewell rather than an arrival greeting.',examples:[example('Grazie, signora. Arrivederci!','Thank you, madam. Goodbye!')]},
    });
  }
  if((lesson=find(pack,'v2-a1-one-thing'))){
    repair(lesson,'Use un with masculine nouns, including un amico without an apostrophe. Use una before a feminine consonant. Before a feminine vowel, una becomes un’ and joins the noun: un’amica.',[
      example('È un libro. È una casa.','It is a book. It is a house.'),example('Luca è un amico. Anna è un’amica.','Luca is a male friend. Anna is a female friend.'),
    ],{
      'masculine-un':{title:'One masculine noun',body:'Masculine nouns take un here. There is no apostrophe even before the vowel of amico.',examples:[example('Un libro. Un amico.','A book. A male friend.')]},
      'feminine-una':{title:'One feminine noun before a consonant',body:'Casa is feminine and begins with a consonant, so keep una.',examples:[example('È una casa.','It is a house.')]},
      'feminine-elision':{title:'Join un’ to a feminine vowel',body:'Amica is feminine and starts with a vowel. Una loses its final a: un’amica. Join the apostrophe directly to the noun. Masculine un amico has no apostrophe.',examples:[example('Sara è un’amica. Luca è un amico.','Sara is a female friend. Luca is a male friend.')]},
    });
  }
  if((lesson=find(pack,'v2-a1-near-far'))){
    const near='Vicina a is the agreeing adjective with a feminine noun. The invariant phrase vicino a is also valid here. Both mean near; lontano da means far from.';
    const far='Lontana da is the agreeing adjective with a feminine noun. The invariant phrase lontano da is also valid here. Both mean far from; vicino a means near.';
    Object.assign(step(lesson,'s2'),{body:'With a feminine noun, the adjective can agree: La casa è vicina a Roma. The invariant location phrase vicino a is also valid: La casa è vicino a Roma.',examples:[example('La casa è vicina a Roma. La casa è vicino a Roma.','The house is near Rome. Both forms are valid.')]});
    Object.assign(step(lesson,'s3'),{body:'The adjective can agree: La scuola è lontana da Milano. The invariant location phrase lontano da is also valid.',examples:[example('La scuola è lontana da Milano. La scuola è lontano da Milano.','The school is far from Milan. Both forms are valid.')]});
    for(const question of lesson.steps.filter(item=>item.kind==='question')){
      if(question.answer==='vicina a'){question.accepted=unique([...(question.accepted||[]),'vicino a']);question.explanation=near;question.hint='Choose the near expression; adjective agreement and the invariant location phrase are both valid.';}
      if(question.answer==='lontana da'){question.accepted=unique([...(question.accepted||[]),'lontano da']);question.explanation=far;question.hint='Choose the far-from expression; the agreeing adjective and invariant phrase are both valid.';}
      // Never offer a knowingly valid second form as the intended wrong choice.
      if(question.options)question.options=question.options.filter(option=>option===question.answer||!question.accepted?.includes(option));
    }
    lesson.takeaway='Vicino a means near and lontano da means far from. The adjective may agree with the thing located; the invariant location phrases are also valid in these sentences.';
    step(lesson,'s10').body=lesson.takeaway;
    repair(lesson,lesson.takeaway,[example('La casa è vicina a Roma / vicino a Roma.','The house is near Rome: both forms are valid.'),example('La scuola è lontana da Milano / lontano da Milano.','The school is far from Milan: both forms are valid.')],{
      near:{title:'Keep the near meaning',body:near,examples:[example('La casa è vicino a Roma.','The house is near Rome.')]},
      far:{title:'Keep the far-from meaning',body:far,examples:[example('La scuola è lontano da Milano.','The school is far from Milan.')]},
    });
  }
  const presentModels = {
    'v2-a1-present-ere':['Vivere: io vivo, tu vivi, lui/lei/Lei vive, noi viviamo, voi vivete, loro vivono. Prendere: io prendo, tu prendi, lui/lei/Lei prende, noi prendiamo, voi prendete, loro prendono. Formal Lei uses the singular third-person form.',[example('Voi vivete a Roma. Anna e Luca prendono il treno.','You all live in Rome. Anna and Luca take the train.')]],
    'v2-a1-present-ire':['Dormire: io dormo, tu dormi, lui/lei/Lei dorme, noi dormiamo, voi dormite, loro dormono. Partire: io parto, tu parti, lui/lei/Lei parte, noi partiamo, voi partite, loro partono. These verbs do not add -isc-. Formal Lei takes dorme or parte.',[example('Noi dormiamo a casa. Anna e Luca partono domani.','We sleep at home. Anna and Luca leave tomorrow.')]],
    'v2-a1-andare':['Andare: io vado, tu vai, lui/lei/Lei va, noi andiamo, voi andate, loro vanno. Formal Lei uses va when addressing one person politely.',[example('Voi andate a Milano domani? Loro vanno a Roma.','Are you all going to Milan tomorrow? They go to Rome.')]],
    'v2-a1-fare':['Fare: io faccio, tu fai, lui/lei/Lei fa, noi facciamo, voi fate, loro fanno. Formal Lei uses fa when addressing one person politely.',[example('Voi fate colazione a casa? Anna e Luca fanno una torta.','Do you all have breakfast at home? Anna and Luca make a cake.')]],
    'v2-a1-venire':['Venire: io vengo, tu vieni, lui/lei/Lei viene, noi veniamo, voi venite, loro vengono. Formal Lei uses viene when addressing one person politely.',[example('Voi venite da Napoli? Anna e Luca vengono da Roma.','Do you all come from Naples? Anna and Luca come from Rome.')]],
    'v2-a1-potere-requests':['Potere: io posso, tu puoi, lui/lei/Lei può, noi possiamo, voi potete, loro possono. Follow it with the unchanged infinitive. Formal Lei uses può for a polite request.',[example('Possiamo aprire la porta? Voi potete leggere?','May we open the door? Can you all read?')]],
    'v2-a1-want-need':['Volere: io voglio, tu vuoi, lui/lei/Lei vuole, noi vogliamo, voi volete, loro vogliono. Dovere: io devo, tu devi, lui/lei/Lei deve, noi dobbiamo, voi dovete, loro devono. Follow either verb with the unchanged infinitive. In the reserve checks Anna vuole means Anna wants; Luca deve means Luca needs to or must.',[example('Anna vuole comprare il pane. Luca deve chiamare Anna.','Anna wants to buy bread. Luca needs to call Anna.'),example('Noi vogliamo comprare un libro. Voi dovete chiamare Luca.','We want to buy a book. You all need to call Luca.')]],
  };
  for(const [id,[body,examples]] of Object.entries(presentModels))if((lesson=find(pack,id))){
    fullModel(lesson,body,examples);
    lesson.targets[0].repair.body=body;
    lesson.targets[0].repair.examples=examples;
    if(id==='v2-a1-want-need'){
      for(const word of [{it:'vuole',en:'he/she/polite you wants',entryId:'v:volere'},{it:'deve',en:'he/she/polite you needs to / must',entryId:'v:dovere'}])if(!lesson.steps[0].words.some(w=>w.it===word.it))lesson.steps[0].words.push(word);
      lesson.outcome='I can choose taught present forms of volere and dovere before a known infinitive.';
      lesson.takeaway='Volere expresses wanting and dovere expresses necessity. Choose the person form, including vuole/deve for one named person, and keep the following infinitive unchanged.';
      step(lesson,'s9').body=lesson.takeaway;
    }
  }
  const a2Models = {
    'v2-a2-past-auxiliary-person':['Avere in the completed past: io ho, tu hai, lui/lei/Lei ha, noi abbiamo, voi avete, loro hanno + participle. With the following un-cliticised object in these sentences, visto or veduto does not agree with the subject.',[example('Voi avete visto Anna. Anna e Luca hanno visto il museo.','You all saw Anna. Anna and Luca saw the museum.')]],
    'v2-a2-essere-plural':['Essere in the completed past: io sono, tu sei, lui/lei/Lei è, noi siamo, voi siete, loro sono + participle. The participle agrees with the stated referent: andato/andata in the singular, andati/andate in the plural. Formal Lei takes è, with the addressed person’s stated agreement.',[example('Anna e Sara: «Voi siete andate a Roma?»','Anna and Sara: “Did you women go to Rome?”'),example('Anna e Luca: «Noi siamo andati a Milano.»','Anna and Luca: “We went to Milan.”')]],
    'v2-a2-imperfect-are':['Parlare in the imperfect: io parlavo, tu parlavi, lui/lei/Lei parlava, noi parlavamo, voi parlavate, loro parlavano. Regular -are endings are -avo, -avi, -ava, -avamo, -avate, -avano. These forms can describe a past habit or an ongoing/background action; time words are clues rather than automatic tense laws.',[example('Noi parlavamo italiano a casa. Voi parlavate spesso con Anna.','We used to speak Italian at home. You all often spoke with Anna.')]],
    'v2-a2-imperfect-ere-ire':['Leggere: io leggevo, tu leggevi, lui/lei/Lei leggeva, noi leggevamo, voi leggevate, loro leggevano. Dormire: io dormivo, tu dormivi, lui/lei/Lei dormiva, noi dormivamo, voi dormivate, loro dormivano. The imperfect can describe habit or ongoing background; context determines the intended viewpoint.',[example('Noi leggevamo ogni sera. Anna e Luca dormivano fino alle otto.','We used to read every evening. Anna and Luca used to sleep until eight.')]],
    'v2-a2-imperfect-states':['Essere: io ero, tu eri, lui/lei/Lei era, noi eravamo, voi eravate, loro erano. Avere: io avevo, tu avevi, lui/lei/Lei aveva, noi avevamo, voi avevate, loro avevano. These imperfect forms describe a state/possession from the past viewpoint.',[example('Voi eravate a casa. Anna e Luca avevano fame.','You all were at home. Anna and Luca were hungry.')]],
    'v2-a2-progressive-present':['Stare in the present: io sto, tu stai, lui/lei/Lei sta, noi stiamo, voi state, loro stanno. Add the current action’s gerund: parlare → parlando, leggere → leggendo. The progressive focuses on an action underway; the simple present can also describe now and remains natural for routines or states.',[example('Noi stiamo parlando. Voi state leggendo.','We are speaking. You all are reading.')]],
    'v2-a2-progressive-past':['Stare in the imperfect: io stavo, tu stavi, lui/lei/Lei stava, noi stavamo, voi stavate, loro stavano + gerund. This explicitly focuses on an action underway from a past viewpoint. Ordinary imperfect can also express ongoing background.',[example('Noi stavamo parlando quando Anna ha chiamato. Loro stavano leggendo.','We were speaking when Anna called. They were reading.')]],
    'v2-a2-future-are':['Parlare in the future: io parlerò, tu parlerai, lui/lei/Lei parlerà, noi parleremo, voi parlerete, loro parleranno. Add -ò, -ai, -à, -emo, -ete, -anno to parler-. These checks request the future form; the present can also naturally express a planned future event.',[example('Noi parleremo con Anna domani. Voi parlerete con Luca.','We will speak with Anna tomorrow. You all will speak with Luca.')]],
    'v2-a2-future-ere-ire':['Prendere: io prenderò, tu prenderai, lui/lei/Lei prenderà, noi prenderemo, voi prenderete, loro prenderanno. Dormire: io dormirò, tu dormirai, lui/lei/Lei dormirà, noi dormiremo, voi dormirete, loro dormiranno. These checks specifically ask for the future form.',[example('Voi prenderete il treno. Anna e Luca dormiranno a casa.','You all will take the train. Anna and Luca will sleep at home.')]],
    'v2-a2-future-irregular':['Essere: sarò, sarai, sarà, saremo, sarete, saranno. Avere: avrò, avrai, avrà, avremo, avrete, avranno. Andare: andrò, andrai, andrà, andremo, andrete, andranno. In each row the persons are io, tu, lui/lei/Lei, noi, voi, loro; formal Lei uses the third-person singular.',[example('Noi saremo a Roma. Voi andrete a Milano. Loro avranno il libro.','We will be in Rome. You all will go to Milan. They will have the book.')]],
    'v2-a2-conditional-request':['Volere: vorrei, vorresti, vorrebbe, vorremmo, vorreste, vorrebbero. Potere: potrei, potresti, potrebbe, potremmo, potreste, potrebbero. In each row the persons are io, tu, lui/lei/Lei, noi, voi, loro. Formal Lei uses potrebbe/vorrebbe; tu uses potresti/vorresti. Follow these forms with a known infinitive, or use vorrei + the desired thing.',[example('Vorremmo un caffè. Potreste ripetere, per favore?','We would like a coffee. Could you all repeat, please?')]],
    'v2-a2-conditional-plan':['Andare: andrei, andresti, andrebbe, andremmo, andreste, andrebbero. Fare: farei, faresti, farebbe, faremmo, fareste, farebbero. Volere: vorrei, vorresti, vorrebbe, vorremmo, vorreste, vorrebbero. In each row the persons are io, tu, lui/lei/Lei, noi, voi, loro.',[example('Noi andremmo a Roma. Voi fareste una visita al museo.','We would go to Rome. You all would visit the museum.')]],
  };
  for(const [id,[body,examples]] of Object.entries(a2Models))if((lesson=find(pack,id)))fullModel(lesson,body,examples);
  if((lesson=find(pack,'v2-a2-past-irregular'))){
    for(const q of lesson.steps.filter(item=>item.kind==='question'&&item.answer==='visto')){
      q.accepted=unique([...(q.accepted||[]),'veduto']);
      q.explanation='Visto is the more common past participle of vedere; veduto is also valid. Keep the auxiliary supplied by the sentence.';
    }
    step(lesson,'s2').body='Fare → fatto; vedere → visto, with veduto also valid. Visto is the everyday model here; veduto must not be treated as an error.';
    lesson.takeaway='Fare → fatto, vedere → visto (also veduto), prendere → preso, scrivere → scritto. Learn the participle with its verb and retain valid alternatives.';
    step(lesson,'s11').body=lesson.takeaway;
    repair(lesson,lesson.takeaway,[example('Ho fatto una torta. Ho visto Anna.','I made a cake. I saw Anna.'),example('Ho veduto Anna. Ho preso il libro e ho scritto una lettera.','I saw Anna. I took the book and wrote a letter.')]);
  }
  if((lesson=find(pack,'v2-a2-direct-elision-negation'))){
    repair(lesson,'Before a vowel, lo/la can shorten to l’ and join the verb: l’aspetto, l’ascolto. Li/le do not shorten. Non goes before the clitic and verb: non lo so, non la vedo.',[
      example('Il treno? L’aspetto.','The train? I am waiting for it.'),example('Il pane? Non lo compro.','The bread? I am not buying it.'),
    ],{
      elision:{title:'Join the shortened clitic',body:'In the model lo/la shortens to l’ before a vowel and joins the verb: l’aspetto, l’ascolto. Li/le do not shorten.',examples:[example('Il treno? L’aspetto. La radio? L’ascolto.','The train? I am waiting for it. The radio? I listen to it.')]},
      'non-first':{title:'Put non before the pronoun',body:'Keep the order non + object pronoun + verb: non lo so, non la chiamo. Non cannot go between the pronoun and its verb.',examples:[example('Il pane? Non lo compro. Sara? Non la chiamo.','The bread? I am not buying it. Sara? I am not calling her.')]},
    });
  }
  if((lesson=find(pack,'v2-a2-direct-singular')))step(lesson,'s10').explanation='Pizza is feminine singular, so la refers back to la pizza.';
  if((lesson=find(pack,'v2-a1-days-clock')))step(lesson,'review-1').speak='Il treno parte all’una.';
  if((lesson=find(pack,'v2-b2-dislocation')))step(lesson,'check-1').speak='La lettera, l’ho scritta ieri.';
  if((lesson=find(pack,'v2-b1-ce-ne-quantity'))){
    const body='Ne means of the already named items; ci means to/for us in these servire/mancare examples and changes to ce before ne. Ce ne servono due means we need two of them; ce ne manca una means we are missing one of them. The needed/missing items are the grammatical subject, so the verb agrees with the quantity. With voglio, Ne voglio quattro means I want four of them: no ci is required.';
    Object.assign(step(lesson,'teach-1'),{body,examples:[example('Ci servono due biglietti. Ce ne servono due.','We need two tickets. We need two of them.') ]});
    Object.assign(step(lesson,'teach-2'),{body:'Keep the two functions distinct: ce (from ci) tells for whom the items are needed or missing; ne supplies of them. Singular uno/una takes serve/manca; plural quantities take servono/mancano.',examples:[example('Ci manca una sedia. Ce ne manca una. Ce ne mancano due.','We are missing one chair. We are missing one of them. We are missing two of them.')]});
    const why={
      'check-1':'Ce is ci (for us) before ne; ne means of the places already named. Three places are the subject, so use servono.',
      'check-2':'Ce is ci (for us) before ne; ne means of the chairs. Two chairs are missing, so mancano is plural.',
      'check-3':'Ce is ci (for us) before ne. Uno is one of the tickets and is the subject, so use singular serve.',
      'check-4':'Ne means of the copies. Voglio already has io as subject and needs no ci meaning for us: Ne voglio quattro.',
      'reserve-1':'Ce is ci (for us) before ne; ne means of the cups. Six cups are the subject, so use plural servono.',
    };
    for(const [suffix,text] of Object.entries(why)){const q=step(lesson,suffix);q.explanation=text;if(q.hint)q.hint='Separate for us (ci → ce before ne) from of them (ne), then check who or what is the subject.';}
    step(lesson,'contrast-1').body=why['check-2'];
    step(lesson,'contrast-2').body=why['check-3'];
    step(lesson,'recap').body=body;
    lesson.takeaway=body;lesson.targets[0].explanation=body;
    repair(lesson,body,[example('Ce ne servono due. Ne voglio quattro.','We need two of them. I want four of them.')]);
  }
  if((lesson=find(pack,'v2-c1-u1-subjunctive-perspective')))lesson.prerequisites=unique([...lesson.prerequisites,'v2-b2-tense-relations','v2-b2-evidence-source']);
  if((lesson=find(pack,'v2-c2-u1-mood-evidence')))lesson.prerequisites=unique([...lesson.prerequisites,'v2-c1-u1-subjunctive-perspective','v2-c1-u3-qualified-conclusion']);
  return pack;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const changed=[];
  for(const level of ['Foundations','A1','A2','B1','B2','C1','C2']){
    const file=new URL(`../data/course-v2/${level}.json`,import.meta.url),before=fs.readFileSync(file,'utf8');
    const after=JSON.stringify(repairPhaseContentPack(JSON.parse(before)),null,2)+'\n';
    if(after!==before){fs.writeFileSync(file,after);changed.push(level);}
  }
  console.log(`Applied bounded content repairs: ${changed.join(', ')||'already current'}.`);
}
