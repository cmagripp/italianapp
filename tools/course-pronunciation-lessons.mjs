// Small sound/spelling lessons woven into A1. Bounded checks assess taught
// orthographic knowledge; pronunciation is explicitly ungraded oral practice.
const w=(it,en,article,plural)=>({it,en,...article?{article,plural}:{}});
function lesson(s){const id='v2-a1-'+s.key,target=id+'.pattern';
 const question=(row,i)=>{const [facet,context,en,answer,options,why]=row;return {id:id+'.q'+i,kind:'question',target,facet,stage:i===0?'guided':'independent',reserve:i>4,contextKey:id+'.context-'+i,format:'choice',prompt:s.prompt,context,translation:en,answer,options,explanation:why,hint:why,speak:context.includes('___')?context.replace('___',answer):context};};
 return {id,title:s.title,outcome:s.outcome,minutes:8,prerequisites:[s.prerequisite],related:[],legacyLessonIds:['a1-sounds-spelling'],takeaway:s.takeaway,targets:[{id:target,label:s.outcome,explanation:s.takeaway,facets:s.facets,minIndependent:4,requiresProduction:false,modality:'language',repair:{title:'Compare the familiar words',body:s.body,examples:s.examples}}],steps:[
 {id:id+'.words',kind:'words',title:'Meet the words first',words:s.words},
 {id:id+'.teach',kind:'teach',title:s.title,body:s.body,examples:s.examples,introduces:[target]},question(s.checks[0],0),
 {id:id+'.notice',kind:'teach',title:'Notice the contrast',body:s.takeaway,examples:s.examples,introduces:[target]},
 ...s.checks.slice(1).map((r,i)=>question(r,i+1)),
 {id:id+'.speak',kind:'portfolio',mode:'speak',title:'Listen, then try it aloud',prompt:s.practice+' Replay the examples as often as you like. Record yourself only if useful; the app does not grade your pronunciation.',model:s.examples.map(e=>e.it).join(' '),rubric:s.rubric},
 {id:id+'.recap',kind:'teach',title:'Keep this',body:s.takeaway,examples:s.examples,introduces:[]}
 ]};}
export function pronunciationLessons(){return [
 [0,lesson({key:'vowels-stress',title:'Give vowels and stress their place',outcome:'I can recognize familiar vowel spellings and marked final stress.',prerequisite:'v2-a1-essere-plural',facets:['vowels','final-stress'],prompt:'Notice the familiar word.',
 words:[w('casa','house','la','case'),w('Roma','Rome'),w('città','city','la','città'),w('caffè','coffee','il','caffè'),w('italiano','Italian'),w('perché','why; because')],body:'Italian has five vowel letters: a, e, i, o, u. Keep vowel sounds clear when you imitate the examples. E and o each have open and closed pronunciations; spelling alone does not always tell you which. Many familiar words stress the second-to-last syllable, as in casa, but this is not a rule for every word. A written final accent marks final stress: città, caffè.',examples:[{it:'La casa è a Roma.',en:'The house is in Rome.'},{it:'Un caffè in città.',en:'A coffee in town.'}],takeaway:'Learn the sound with the word. Final written accents in città and caffè mark a stressed final vowel.',practice:'Imitate casa, Roma, città and caffè. Let the final syllable stand out in città and caffè.',rubric:['Keep both vowels audible in casa.','Stress the final syllable in città and caffè.','Use a clear voice; copying an accent perfectly is not the aim.'],checks:[
 ['vowels','casa','Which two vowel letters occur in casa?','a and a',['a and a','a and e'],'Casa is written c-a-s-a.'],
 ['vowels','Roma','Which two vowel letters occur in Roma?','o and a',['o and a','u and e'],'Roma contains o and a.'],
 ['final-stress','città','Which syllable carries the marked stress?','The final syllable',['The final syllable','The first syllable'],'The final à marks final stress.'],
 ['vowels','italiano','Which is the first vowel letter?','i',['i','e','u'],'Italiano begins with i.'],
 ['final-stress','caffè','Which syllable carries the marked stress?','The final syllable',['The final syllable','The first syllable'],'The final è marks final stress.'],
 ['vowels','caffè','Which two vowel letters occur here?','a and e',['a and e','o and u'],'Caffè contains a and an accented e.'],
 ['final-stress','perché','What does the final written accent tell you here?','Stress the last syllable',['Stress the last syllable','Stress the first syllable'],'Perché carries final stress.'],
 ]})],
 [0,lesson({key:'written-accents',title:'Keep the written accent',outcome:'I can distinguish e from è and preserve familiar final accents.',prerequisite:'v2-a1-vowels-stress',facets:['e-versus-e-accent','word-accent'],prompt:'Choose the spelling that fits.',words:[w('e','and'),w('è','is'),w('città','city','la','città'),w('caffè','coffee','il','caffè'),w('perché','why; because')],body:'È means is; e means and. The written accent changes the word. Keep the final accents in città and caffè. Perché ends with an acute é; caffè ends with a grave è. Learn these spellings with each word.',examples:[{it:'Anna e Luca. Anna è qui.',en:'Anna and Luca. Anna is here.'},{it:'Un caffè in città.',en:'A coffee in town.'}],takeaway:'Use e for and and è for is. Accents are part of the spelling, including città, caffè and perché.',practice:'Say Anna e Luca and Anna è qui, then compare their meanings.',rubric:['Keep the meanings of and and is distinct.','Retain the final stress in città and caffè.'],checks:[
 ['e-versus-e-accent','Anna ___ qui.','Anna is here.','è',['è','e'],'Is is è with an accent.'],
 ['e-versus-e-accent','Luca ___ di Roma.','Luca is from Rome.','è',['è','e'],'The verb is requires è.'],
 ['word-accent','Un ___, per favore.','A coffee, please.','caffè',['caffè','caffe'],'Caffè keeps its final accent.'],
 ['e-versus-e-accent','Anna ___ Sara sono qui.','Anna and Sara are here.','e',['e','è'],'And is e without an accent.'],
 ['word-accent','La ___ è grande.','The city is big.','città',['città','citta'],'Città keeps its final accent.'],
 ['e-versus-e-accent','Il libro ___ qui.','The book is here.','è',['è','e'],'The verb is is accented è.'],
 ['word-accent','___?','Why?','Perché',['Perché','Perche'],'Perché ends in accented é.'],
 ]})],
 [2,lesson({key:'silent-h',title:'Write h without sounding it',outcome:'I can keep the silent h in familiar avere forms.',prerequisite:'v2-a1-avere-plural',facets:['have-h','or-no-h'],prompt:'Choose the form for this meaning.',words:[w('ho','I have'),w('hai','you have · familiar'),w('ha','he/she has; formal you have'),w('hanno','they have'),w('o','or'),w('il tè','the tea','il','i tè'),w('il caffè','the coffee','il','i caffè')],body:'The h in ho, hai, ha and hanno is silent. It still belongs in their spelling. Ho means I have; o means or. They can sound alike, so use the meaning and the sentence, not an extra h sound, to choose.',examples:[{it:'Ho un libro. Tè o caffè?',en:'I have a book. Tea or coffee?'},{it:'Anna ha uno zaino.',en:'Anna has a backpack.'}],takeaway:'Silent does not mean optional: keep h in these avere forms. The word o means or.',practice:'Say ho and o without adding an h sound, then use each in its example.',rubric:['Keep h silent in ho and ha.','Choose the spelling from the meaning.'],checks:[
 ['have-h','Io ___ un libro.','I have a book.','ho',['ho','o'],'I have is ho, with silent h.'],
 ['have-h','Luca ___ uno zaino.','Luca has a backpack.','ha',['ha','a'],'Luca takes ha, with silent h.'],
 ['or-no-h','Tè ___ caffè?','Tea or coffee?','o',['o','ho'],'Or is o, without h.'],
 ['have-h','Anna e Luca ___ i libri.','Anna and Luca have the books.','hanno',['hanno','anno'],'They have is hanno.'],
 ['or-no-h','Un libro ___ uno zaino?','A book or a backpack?','o',['o','ho'],'The choice between two things uses o.'],
 ['have-h','Tu ___ una casa?','Do you have a house?','hai',['hai','ai'],'Familiar you have is hai.'],
 ['or-no-h','Roma ___ Milano?','Rome or Milan?','o',['o','ho'],'O joins alternatives.'],
 ]})],
 [3,lesson({key:'double-consonants',title:'Give double consonants time',outcome:'I can preserve a familiar single/double-consonant spelling contrast.',prerequisite:'v2-a1-adjective-agreement',facets:['single','double'],prompt:'Choose the introduced word for this meaning.',words:[w('la pala','the shovel','la','le pale'),w('la palla','the ball','la','le palle'),w('la pena','the sorrow; the penalty','la','le pene'),w('la penna','the pen','la','le penne')],body:'A double consonant is held longer. Pala and palla are different words; so are pena and penna. Listen to the whole word, keep the vowel clear, and give the written double consonant its extra time. Meaning also helps you choose the spelling.',examples:[{it:'La pala. La palla.',en:'The shovel. The ball.'},{it:'La pena. La penna.',en:'The sorrow or penalty. The pen.'}],takeaway:'Consonant length can distinguish words. Do not drop the double l in palla or double n in penna.',practice:'Compare pala–palla and pena–penna slowly, then say each at a comfortable pace.',rubric:['Give the double consonant extra time.','Keep the meanings of the paired words distinct.'],checks:[
 ['double','La ___ è qui.','The ball is here.','palla',['palla','pala'],'Ball is palla, with double l.'],
 ['single','La ___ è a casa.','The shovel is at home.','pala',['pala','palla'],'Shovel is pala, with one l.'],
 ['double','Ho una ___.','I have a pen.','penna',['penna','pena'],'Pen is penna, with double n.'],
 ['single','Che ___!','What a sorrow!','pena',['pena','penna'],'Sorrow is pena, with one n.'],
 ['double','Anna ha una ___.','Anna has a ball.','palla',['palla','pala'],'Ball is palla.'],
 ['single','Luca ha una ___.','Luca has a shovel.','pala',['pala','palla'],'Shovel is pala.'],
 ['double','La ___ è sul libro.','The pen is on the book.','penna',['penna','pena'],'Pen is penna.'],
 ]})],
 [4,lesson({key:'question-intonation',title:'Turn a statement into a question',outcome:'I can recognize a familiar question and practise its intonation.',prerequisite:'v2-a1-present-questions',facets:['question','statement'],prompt:'Read the punctuation and meaning.',words:[w('parli italiano','you speak Italian · familiar'),w('abiti a Roma','you live in Rome · familiar'),w('sì','yes'),w('no','no')],body:'A simple yes/no question can keep the same word order as a statement. In writing, the question mark shows that an answer is expected: Parli italiano? In speech, use an appropriate question contour; many neutral yes/no questions rise near the end, but Italian intonation varies by context and region.',examples:[{it:'Parli italiano. Parli italiano?',en:'You speak Italian. Do you speak Italian?'},{it:'Abiti a Roma. Abiti a Roma?',en:'You live in Rome. Do you live in Rome?'}],takeaway:'A yes/no question does not need English do. Word order may stay the same; punctuation and voice show the question.',practice:'Say each statement, then ask its question. Imagine that the other person can answer sì or no.',rubric:['Keep the Italian words in their natural order.','Use your voice to invite a response in the question.'],checks:[
 ['question','Parli italiano?','What is the speaker doing?','Asking a question',['Asking a question','Making a statement'],'The question mark asks for an answer.'],
 ['question','Abiti a Roma?','What is the speaker doing?','Asking whether this person lives in Rome',['Asking whether this person lives in Rome','Stating that this person lives in Rome'],'The speaker asks whether the person lives in Rome.'],
 ['statement','Parli italiano.','What is this written line doing?','Making a statement',['Making a statement','Asking a question'],'The full stop presents a statement.'],
 ['question','Hai un libro?','Does this line ask for an answer?','Yes',['Yes','No'],'The question mark invites an answer.'],
 ['statement','Abiti a Roma.','What is this written line doing?','Making a statement',['Making a statement','Asking a question'],'This is the statement version.'],
 ['question','Sei Luca?','What is the speaker doing?','Asking a question',['Asking a question','Making a statement'],'The speaker asks whether the person is Luca.'],
 ['statement','Hai un libro.','Does the punctuation mark this as a question?','No',['No','Yes'],'A full stop does not mark a question.'],
 ]})],
 [5,lesson({key:'g-and-gh',title:'Read g and gh in familiar words',outcome:'I can recognize the taught hard and soft g patterns.',prerequisite:'v2-a1-present-isc',facets:['soft-g','hard-g'],prompt:'Choose the taught sound or spelling.',words:[w('il gatto','the cat','il','i gatti'),w('il gelato','the ice cream','il','i gelati'),w('il giro','the tour; the turn','il','i giri'),w('gli spaghetti','spaghetti','gli','gli spaghetti'),w('il ghiaccio','the ice','il','-')],body:'G before a, o or u is normally hard, as in gatto. Before e or i it is normally soft, as in gelato and giro. Gh keeps the sound hard before e or i: spaghetti and ghiaccio. In ghiaccio, the first i is heard as a brief glide, like y in yes; h stays silent.',examples:[{it:'Il gatto. Il gelato.',en:'The cat. The ice cream.'},{it:'Gli spaghetti. Il ghiaccio.',en:'Spaghetti. Ice.'}],takeaway:'Compare soft g in gelato and giro with hard g in gatto, spaghetti and ghiaccio.',practice:'Listen to each word and imitate its first g sound. Then compare spaghetti and gelato.',rubric:['Use different g sounds in gatto and gelato.','Keep the hard sound in spaghetti and ghiaccio.'],checks:[
 ['soft-g','gelato','Is the g soft or hard in this introduced word?','Soft',['Soft','Hard'],'G before e is soft in gelato.'],
 ['soft-g','giro','Is the g soft or hard?','Soft',['Soft','Hard'],'G before i is soft in giro.'],
 ['hard-g','gatto','Is the g soft or hard?','Hard',['Hard','Soft'],'G before a is hard in gatto.'],
 ['soft-g','Il ___ è qui.','Choose the familiar word ice cream.','gelato',['gelato','ghelato'],'Soft g before e is written ge.'],
 ['hard-g','Gli spa___etti.','Complete the known word spaghetti with hard g.','gh',['gh','g'],'Gh keeps hard g before e.'],
 ['soft-g','Un ___ in città.','Choose the familiar word tour.','giro',['giro','ghiro'],'The taught word for a tour is giro with soft g.'],
 ['hard-g','Il ___iaccio.','Complete the known word ice.','gh',['gh','g'],'Ghiaccio keeps hard g with gh.'],
 ]})],
 [6,lesson({key:'sc-and-sch',title:'Read sc and sch',outcome:'I can recognize the taught soft sc and hard sc/sch patterns.',prerequisite:'v2-a1-a-in-places',facets:['soft-sc','hard-sc'],prompt:'Choose the taught sound or spelling.',words:[w('la scena','the scene','la','le scene'),w('il pesce','the fish','il','i pesci'),w('la scuola','the school','la','le scuole'),w('lo schermo','the screen','lo','gli schermi')],body:'Sc before e or i has the soft sound heard in scena and pesce. Sc before a, o or u is hard, as in scuola. Sch keeps that hard sound before e or i, as in schermo. Listen to the known word before practising its spelling.',examples:[{it:'La scena. Il pesce.',en:'The scene. The fish.'},{it:'La scuola. Lo schermo.',en:'The school. The screen.'}],takeaway:'Scena and pesce use soft sc. Scuola and schermo have the hard sound; h preserves it before e.',practice:'Compare scena with schermo, then repeat pesce and scuola.',rubric:['Distinguish soft sc from hard sc/sch.','Do not give h a separate sound.'],checks:[
 ['soft-sc','scena','Is the sc soft or hard in this word?','Soft',['Soft','Hard'],'Sc before e is soft in scena.'],
 ['soft-sc','pesce','Is the sc soft or hard?','Soft',['Soft','Hard'],'Sc before e is soft in pesce.'],
 ['hard-sc','scuola','Is the sc soft or hard?','Hard',['Hard','Soft'],'Sc before u is hard in scuola.'],
 ['soft-sc','La ___ena.','Complete the introduced word scene.','sc',['sc','sch'],'Scena has soft sc before e.'],
 ['hard-sc','Lo ___ermo.','Complete the introduced word screen.','sch',['sch','sc'],'Schermo keeps hard sc before e with h.'],
 ['soft-sc','Il pe___e.','Complete the introduced word fish.','sc',['sc','sch'],'Pesce uses soft sc.'],
 ['hard-sc','schermo','What does h do in this word?','Keeps the sc hard',['Keeps the sc hard','Adds a separate h sound'],'The h keeps sc hard before e.'],
 ]})],
 [8,lesson({key:'gn-and-gli',title:'Read gn and gli as groups',outcome:'I can recognize gn and gli in introduced everyday words.',prerequisite:'v2-a1-family-possessives',facets:['gn','gli'],prompt:'Complete the introduced word.',words:[w('il bagno','the bathroom','il','i bagni'),w('gli gnocchi','gnocchi; potato dumplings','gli','gli gnocchi'),w('la famiglia','the family','la','le famiglie'),w('il figlio','the son','il','i figli')],body:'In bagno and gnocchi, gn represents one joined sound rather than a separate g and n. In famiglia and figlio, gli likewise makes a joined sound. These are useful familiar patterns, not a rule for every spelling beginning gli: for example glicine (wisteria) is different. Imitate the words as units.',examples:[{it:'Il bagno. Gli gnocchi.',en:'The bathroom. Gnocchi.'},{it:'La famiglia. Il figlio.',en:'The family. The son.'}],takeaway:'Learn gn in bagno and gnocchi, and gli in famiglia and figlio, as joined sound patterns.',practice:'Repeat bagno, gnocchi, famiglia and figlio. Listen for a joined sound in each highlighted group.',rubric:['Do not add a separate hard g in bagno.','Keep the joined sound in famiglia and figlio.'],checks:[
 ['gn','Il ba___o.','the bathroom','gn',['gn','gli'],'Bagno contains the group gn.'],
 ['gn','Gli ___occhi.','the dumplings','gn',['gn','gli'],'Gnocchi begins with gn.'],
 ['gli','La fami___a.','the family','gli',['gli','gn'],'Famiglia contains gli.'],
 ['gn','Due ba___i.','two bathrooms','gn',['gn','gli'],'Bagni keeps gn.'],
 ['gli','Il fi___o.','the son','gli',['gli','gn'],'Figlio contains gli.'],
 ['gn','I ba___i sono qui.','The bathrooms are here.','gn',['gn','gli'],'The group gn remains in bagni.'],
 ['gli','Le fami___e.','the families','gli',['gli','gn'],'Famiglie keeps gli.'],
 ]})],
];}
