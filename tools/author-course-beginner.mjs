// Authored v2 beginner course. Run: node tools/author-course-beginner.mjs
// Each lesson below supplies its own lexicon, models, checks, and transfer text.
import { mkdir, writeFile } from 'node:fs/promises';
import { refineBeginnerPack } from './course-beginner-refinements.mjs';

const ROOT = new URL('../data/course-v2/', import.meta.url);
const sources = [
  { title: 'CEFR Companion Volume', url: 'https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4' },
  { title: 'CILS guidelines', url: 'https://cils.unistrasi.it/public/articoli/72/linee_guida_cils.pdf' },
  { title: 'Italian A1 reference syllabus (four certifying bodies)', url: 'https://www.unistrapg.it/sites/default/files/docs/certificazioni/sillabo-4-enti-A1.pdf' },
];
const packs = {
  Foundations: { version: 2, level: 'Foundations', title: 'Foundations', sources, units: [] },
  A1: { version: 2, level: 'A1', title: 'A1 · Everyday beginnings', sources, units: [] },
  A2: { version: 2, level: 'A2', title: 'A2 · Everyday independence', sources, units: [] },
};
const portfolioPlan = {};
let previousLesson = null;
const W = (it, en, article, plural, note) => ({ it, en, ...(article ? { article } : {}), ...(plural ? { plural } : {}), ...(note ? { note } : {}) });
const C = (context, translation, answer, options, speak, explanation, hint, extra = {}) => ({ format: 'choice', prompt: 'Choose the expression that fits this situation.', context, translation, answer, options, speak, explanation, hint, ...extra });
const M = (context, answer, options, speak, explanation, hint) => ({ format: 'choice', prompt: 'What does this Italian expression mean?', context, answer, options, speak, explanation, hint });
const T = (context, translation, answer, speak, explanation, hint, accepted = []) => ({ format: 'type', prompt: 'Complete the Italian sentence with the taught form.', context, translation, answer, ...(accepted.length ? { accepted } : {}), speak, explanation, hint, strict: true });
const O = (translation, answer, tokens, explanation, hint) => ({ format: 'order', prompt: 'Put these supplied words in a natural order.', translation, answer, tokens, speak: answer, explanation, hint });
const X = (pairs, explanation, hint, speak) => ({ format: 'match', prompt: 'Match each Italian beginning with its fitting ending.', translation: 'Make natural Italian sentences.', pairs, explanation, hint, speak });
// Facets name meaningful contrasts; the first question is guided, so every
// listed facet must also occur in an independent question below.
const facetPlan = {
  'f-greet': [['familiar-greeting','polite-greeting','farewell'], ['familiar-greeting','polite-greeting','farewell','polite-greeting','familiar-greeting']],
  'f-name': [['give-name','ask-name'], ['give-name','give-name','give-name','ask-name']],
  'f-name-polite': [['polite-address','familiar-address'], ['polite-address','polite-address','familiar-address','polite-address']],
  'f-courtesy': [['thank','reply-to-thanks','get-attention','please-in-request'], ['reply-to-thanks','thank','get-attention','please-in-request','reply-to-thanks']],
  'f-repair': [['state-nonunderstanding','request-repetition'], ['state-nonunderstanding','state-nonunderstanding','request-repetition','request-repetition']],
  'f-sound-c': [['hard-c','soft-c'], ['hard-c','soft-c','hard-c','soft-c']],
  'a1-essere-singular': [['io-sono','tu-sei','singular-e'], ['io-sono','tu-sei','singular-e','io-sono']],
  'a1-essere-polite': [['polite-lei-e','familiar-tu-sei'], ['polite-lei-e','polite-lei-e','familiar-tu-sei','polite-lei-e']],
  'a1-essere-plural': [['noi-siamo','voi-siete','loro-sono'], ['noi-siamo','voi-siete','loro-sono','noi-siamo']],
  'a1-singular-gender': [['masculine-il','feminine-la'], ['masculine-il','feminine-la','masculine-il','feminine-la']],
  'a1-one-thing': [['masculine-un','feminine-una','feminine-elision'], ['masculine-un','feminine-una','feminine-elision','masculine-un']],
  'a1-special-articles': [['lo-before-special-start','uno-before-special-start','definite-elision'], ['lo-before-special-start','uno-before-special-start','definite-elision','uno-before-special-start','lo-before-special-start']],
  'a1-avere-singular': [['io-ho','tu-hai','singular-ha'], ['io-ho','tu-hai','singular-ha','io-ho']],
  'a1-avere-plural': [['noi-abbiamo','voi-avete','loro-hanno'], ['noi-abbiamo','voi-avete','loro-hanno','noi-abbiamo']],
  'a1-small-numbers': [['numbers-zero-five','numbers-six-ten'], ['numbers-zero-five','numbers-zero-five','numbers-six-ten','numbers-zero-five']],
  'a1-age-states': [['age-with-avere','hunger-with-avere','thirst-with-avere'], ['age-with-avere','age-with-avere','hunger-with-avere','thirst-with-avere']],
  'a1-noun-plurals': [['o-to-i','a-to-e','e-to-i'], ['o-to-i','a-to-e','e-to-i','o-to-i']],
  'a1-plural-articles': [['i','gli','le'], ['i','le','gli','le','i']],
  'a1-plural-spelling': [['ca-to-che','invariant-citta'], ['ca-to-che','invariant-citta','ca-to-che','invariant-citta']],
  'a1-adjective-agreement': [['four-form-adjective','grande-grandi'], ['four-form-adjective','four-form-adjective','grande-grandi','grande-grandi']],
};
const legacyMap = {
  'a1-essere-singular': ['a1-first-sentence','a1-essere'], 'a1-essere-polite': ['a1-essere'], 'a1-essere-plural': ['a1-essere'],
  'a1-singular-gender': ['a1-noun-gender','a1-definite-articles'], 'a1-one-thing': ['a1-indefinite-articles'],
  'a1-special-articles': ['a1-indefinite-articles','a1-definite-articles'],
  'a1-avere-singular': ['a1-avere'], 'a1-avere-plural': ['a1-avere'],
  'a1-noun-plurals': ['a1-plurals'], 'a1-plural-articles': ['a1-definite-articles','a1-plurals'],
  'a1-plural-spelling': ['a1-plurals'], 'a1-adjective-agreement': ['a1-adjective-agreement'],
};
const reservePlan = {
  'f-greet': [
    ['familiar-greeting', C('«___, Sara!»', 'Greet your friend Sara when she arrives.', 'Ciao', ['Ciao','Arrivederci','Buongiorno'], 'Ciao, Sara!', 'Ciao is natural with this friend.', 'This is an arrival between peers.')],
    ['farewell', C('«Grazie, signora. ___!»', 'Thank the woman and end the exchange politely.', 'Arrivederci', ['Arrivederci','Buongiorno','Ciao'], 'Grazie, signora. Arrivederci!', 'Arrivederci is a polite farewell.', 'The exchange is ending.')],
  ],
  'f-name': [
    ['ask-name', C('«Ciao! ___»', 'Ask a new peer for their name.', 'Come ti chiami?', ['Come ti chiami?','Mi chiamo Anna.','Arrivederci!'], 'Ciao! Come ti chiami?', 'The familiar question asks for a name.', 'Choose the question, not its answer.')],
  ],
  'f-name-polite': [
    ['familiar-address', C('«Ciao! ___»', 'In a class role-play, ask another student for their name.', 'Come ti chiami?', ['Come ti chiami?','Come si chiama?','Mi chiamo Luca.'], 'Ciao! Come ti chiami?', 'A familiar student takes the ti question.', 'The peer is addressed as tu.')],
  ],
  'f-courtesy': [
    ['thank', C('«Ecco il libro.» «___»', 'Someone returns your book; thank them.', 'Grazie!', ['Grazie!','Prego!','Scusi!'], 'Ecco il libro. Grazie!', 'Grazie thanks the helper.', 'You have received help.')],
    ['reply-to-thanks', C('«Grazie per il libro.» «___»', 'Someone thanks you for a book; reply naturally.', 'Prego!', ['Prego!','Scusi!','Per favore!'], 'Grazie per il libro. Prego!', 'Prego is the reply to grazie.', 'You are responding to thanks.')],
    ['get-attention', C('___, dottore.', 'Get a doctor’s attention politely.', 'Scusi', ['Scusi','Prego','Grazie'], 'Scusi, dottore.', 'Scusi politely gets attention.', 'You need to address someone first.')],
    ['please-in-request', C('Un libro, ___.', 'Ask for a book politely.', 'per favore', ['per favore','prego','grazie'], 'Un libro, per favore.', 'Per favore softens the request.', 'The request is being made now.')],
  ],
  'f-repair': [
    ['state-nonunderstanding', C('«Scusi, ___.»', 'You cannot follow the spoken instruction.', 'non capisco', ['non capisco','mi chiamo','prego'], 'Scusi, non capisco.', 'Non capisco states that you did not understand.', 'Describe your difficulty.')],
  ],
  'f-sound-c': [
    ['hard-c', C('casa', 'Which taught word begins with the same hard c sound as casa?', 'come', ['come','ciao','cena'], 'Come ti chiami?', 'Casa and come begin with hard c.', 'Compare the first sound.', { prompt: 'Which word begins with the same sound as casa?' })],
  ],
  'a1-essere-singular': [
    ['io-sono', C('Io ___ Luca.', 'I am Luca.', 'sono', ['sono','sei','è'], 'Io sono Luca.', 'Io takes sono.', 'This is the speaker.')],
    ['tu-sei', C('Tu ___ Anna?', 'Are you Anna? (familiar)', 'sei', ['sei','sono','è'], 'Tu sei Anna?', 'Tu takes sei.', 'This is familiar you.')],
    ['singular-e', C('Luca ___ di Milano.', 'Luca is from Milan.', 'è', ['è','e','sei'], 'Luca è di Milano.', 'One named person takes è.', 'Use the accented word meaning is.')],
  ],
  'a1-essere-polite': [
    ['familiar-tu-sei', C('Anna, tu ___ di Napoli?', 'Ask your friend Anna whether she is from Naples.', 'sei', ['sei','è','sono'], 'Anna, tu sei di Napoli?', 'A familiar friend addressed as tu takes sei.', 'This is not a formal address.')],
  ],
  'a1-essere-plural': [
    ['noi-siamo', C('Noi ___ di Roma.', 'We are from Rome.', 'siamo', ['siamo','siete','sono'], 'Noi siamo di Roma.', 'Noi takes siamo.', 'The subject means we.')],
    ['voi-siete', C('Voi ___ Anna e Luca?', 'Are you two Anna and Luca?', 'siete', ['siete','siamo','sono'], 'Voi siete Anna e Luca?', 'Voi takes siete.', 'Two people are addressed.')],
    ['loro-sono', C('Luca e Sara ___ di Milano.', 'Luca and Sara are from Milan.', 'sono', ['sono','siamo','siete'], 'Luca e Sara sono di Milano.', 'Two named people take sono.', 'The subject means they.')],
  ],
};
Object.assign(reservePlan, {
  'a1-singular-gender': [
    ['masculine-il', C('___ libro è piccolo.', 'The book is small.', 'Il', ['Il','La','Lo'], 'Il libro è piccolo.', 'Libro is taught with il.', 'Recall il libro.')],
  ],
  'a1-one-thing': [
    ['masculine-un', C('Ho ___ libro.', 'I have a book.', 'un', ['un','una','uno'], 'Ho un libro.', 'Libro takes un.', 'Use masculine singular before l.')],
    ['feminine-una', C('Anna ha ___ casa.', 'Anna has a house.', 'una', ['una','un','un’'], 'Anna ha una casa.', 'Casa is a feminine consonant noun.', 'Use the full feminine form.')],
    ['feminine-elision', C('Sara è ___.', 'Sara is a female friend.', 'un’amica', ['un’amica','un amica','un amico'], 'Sara è un’amica.', 'Un’amica joins apostrophe and noun.', 'Feminine amica begins with a vowel.')],
  ],
  'a1-special-articles': [
    ['lo-before-special-start', C('___ zaino è piccolo.', 'The backpack is small.', 'Lo', ['Lo','Il','L’'], 'Lo zaino è piccolo.', 'Zaino begins with z and takes lo.', 'Use the definite z form.')],
    ['definite-elision', C('___ è qui.', 'The male friend is here.', 'L’amico', ['L’amico','Il amico','Lo amico'], 'L’amico è qui.', 'A singular definite article shortens before the vowel.', 'Join l’ to amico.')],
  ],
  'a1-avere-singular': [
    ['io-ho', C('Io ___ uno zaino.', 'I have a backpack.', 'ho', ['ho','hai','ha'], 'Io ho uno zaino.', 'Io takes ho.', 'The speaker owns it.')],
    ['tu-hai', C('Tu ___ un libro?', 'Do you have a book?', 'hai', ['hai','ha','ho'], 'Tu hai un libro?', 'Tu takes hai.', 'The owner is familiar you.')],
    ['singular-ha', C('Luca ___ uno zaino.', 'Luca has a backpack.', 'ha', ['ha','hai','ho'], 'Luca ha uno zaino.', 'A named singular owner takes ha.', 'The owner is Luca.')],
  ],
  'a1-avere-plural': [
    ['noi-abbiamo', C('Noi ___ una casa.', 'We have a house.', 'abbiamo', ['abbiamo','avete','hanno'], 'Noi abbiamo una casa.', 'Noi takes abbiamo.', 'The owners are we.')],
    ['voi-avete', C('Voi ___ un libro?', 'Do you all have a book?', 'avete', ['avete','abbiamo','hanno'], 'Voi avete un libro?', 'Voi takes avete.', 'The owners are plural you.')],
    ['loro-hanno', C('Luca e Sara ___ uno zaino.', 'Luca and Sara have a backpack.', 'hanno', ['hanno','hano','avete'], 'Luca e Sara hanno uno zaino.', 'Two named owners take hanno with h.', 'The owners mean they.')],
  ],
  'a1-small-numbers': [
    ['numbers-six-ten', M('nove', '9', ['9','7','5'], 'Ho nove libri.', 'Nove means 9.', 'Recall the second number group.')],
  ],
  'a1-age-states': [
    ['age-with-avere', C('Luca ___ otto anni.', 'Luca is eight years old.', 'ha', ['ha','è','hai'], 'Luca ha otto anni.', 'Age uses avere; Luca takes ha.', 'Use have for this age.')],
    ['hunger-with-avere', C('Tu ___ fame?', 'Are you hungry?', 'hai', ['hai','sei','ha'], 'Tu hai fame?', 'Fame uses avere; tu takes hai.', 'Use the familiar-you form of have.')],
    ['thirst-with-avere', C('Io ___ sete.', 'I am thirsty.', 'ho', ['ho','sono','ha'], 'Io ho sete.', 'Sete uses avere; io takes ho.', 'Use the I form of have.')],
  ],
  'a1-noun-plurals': [
    ['o-to-i', C('Ci sono tre ___.', 'There are three books.', 'libri', ['libri','libro','libre'], 'Ci sono tre libri.', 'Libro ends -o and becomes libri.', 'Make the -o noun plural.')],
    ['a-to-e', C('Qui ci sono tre ___.', 'There are three houses here.', 'case', ['case','casa','casi'], 'Qui ci sono tre case.', 'Casa becomes case in the plural.', 'Change -a to -e.')],
    ['e-to-i', C('Vedo tre ___.', 'I see three male students.', 'studenti', ['studenti','studente','studentes'], 'Vedo tre studenti.', 'Studente becomes studenti.', 'Change -e to -i.')],
  ],
  'a1-plural-articles': [
    ['i', C('___ libri sono piccoli.', 'The books are small.', 'I', ['I','Gli','Le'], 'I libri sono piccoli.', 'Il libro becomes i libri.', 'Use the plural of il.')],
    ['gli', C('___ studenti hanno i libri.', 'The male students have the books.', 'Gli', ['Gli','I','Le'], 'Gli studenti hanno i libri.', 'Lo studente becomes gli studenti.', 'Use the plural of lo.')],
  ],
  'a1-plural-spelling': [
    ['ca-to-che', C('Ho tre ___.', 'I have three female friends.', 'amiche', ['amiche','amice','amica'], 'Ho tre amiche.', 'Amica becomes amiche with h.', 'Keep the hard c sound.')],
  ],
  'a1-adjective-agreement': [
    ['four-form-adjective', C('Le case sono ___.', 'The houses are small.', 'piccole', ['piccole','piccoli','piccola'], 'Le case sono piccole.', 'Feminine plural case takes piccole.', 'Match le case.')],
  ],
});
Object.assign(facetPlan, {
  'a1-are-singular': [['io-o','tu-i','singular-a','polite-lei-a'], ['io-o','tu-i','singular-a','polite-lei-a','io-o']],
  'a1-are-plural': [['noi-iamo','voi-ate','loro-ano'], ['noi-iamo','voi-ate','loro-ano','noi-iamo']],
  'a1-present-questions': [['where-question','yes-no-question'], ['where-question','where-question','yes-no-question','where-question']],
  'a1-present-negation': [['non-before-present'], Array(4).fill('non-before-present')],
  'a1-present-ere': [['singular-ere','plural-ere'], ['singular-ere','singular-ere','plural-ere','plural-ere']],
  'a1-present-ire': [['singular-ire','plural-ire'], ['singular-ire','plural-ire','plural-ire','singular-ire']],
  'a1-present-isc': [['isc-present','no-isc-noi-voi'], ['isc-present','no-isc-noi-voi','isc-present','no-isc-noi-voi']],
});
Object.assign(reservePlan, {
  'a1-are-singular': [
    ['io-o', C('Io ___ a Napoli.', 'I live in Naples.', 'abito', ['abito','abiti','abita'], 'Io abito a Napoli.', 'Io takes -o: abito.', 'Use the first-person form.')],
    ['tu-i', C('Tu ___ italiano?', 'Do you speak Italian?', 'parli', ['parli','parlo','parla'], 'Tu parli italiano?', 'Tu takes -i: parli.', 'Address a familiar peer.')],
    ['singular-a', C('Luca ___ a Milano.', 'Luca lives in Milan.', 'abita', ['abita','abiti','abito'], 'Luca abita a Milano.', 'One named person takes -a.', 'The subject is Luca.')],
    ['polite-lei-a', C('Dottore, Lei ___ italiano?', 'Doctor, do you speak Italian?', 'parla', ['parla','parli','parlo'], 'Dottore, Lei parla italiano?', 'Polite Lei takes the -a form.', 'Use third-person singular morphology.')],
  ],
  'a1-are-plural': [
    ['noi-iamo', C('Noi ___ italiano.', 'We speak Italian.', 'parliamo', ['parliamo','parlate','parlano'], 'Noi parliamo italiano.', 'Noi takes -iamo.', 'Choose the we ending.')],
    ['voi-ate', C('Voi ___ a casa?', 'Do you all eat at home?', 'mangiate', ['mangiate','mangiamo','mangiano'], 'Voi mangiate a casa?', 'Voi takes -ate.', 'Choose the plural-you ending.')],
    ['loro-ano', C('Luca e Sara ___ italiano.', 'Luca and Sara speak Italian.', 'parlano', ['parlano','parliamo','parlate'], 'Luca e Sara parlano italiano.', 'Two named people take -ano.', 'The subject means they.')],
  ],
  'a1-present-questions': [
    ['yes-no-question', C('«___» «No, abito a Milano.»', 'Ask whether the person lives in Rome.', 'Abiti a Roma?', ['Abiti a Roma?','Dove abiti?','Abito a Roma.'], 'Abiti a Roma? No, abito a Milano.', 'A yes/no question fits a no answer.', 'Ask for confirmation, not an open place.')],
  ],
  'a1-present-ere': [
    ['singular-ere', C('Io ___ a Roma.', 'I live in Rome.', 'vivo', ['vivo','vivi','vive'], 'Io vivo a Roma.', 'Io takes vivo.', 'Use the I form.')],
  ],
  'a1-present-ire': [
    ['singular-ire', C('Tu ___ adesso?', 'Are you sleeping now?', 'dormi', ['dormi','dorme','dormo'], 'Tu dormi adesso?', 'Tu takes dormi.', 'Use familiar you.')],
  ],
  'a1-present-isc': [
    ['isc-present', C('Luca ___ la domanda.', 'Luca understands the question.', 'capisce', ['capisce','cape','capiamo'], 'Luca capisce la domanda.', 'The singular Luca form is capisce with -isc-.', 'Use the one-person -isc- form.')],
  ],
});
Object.assign(legacyMap, {
  'a1-are-singular': ['a1-present-are','a1-first-sentence'], 'a1-are-plural': ['a1-present-are'],
  'a1-present-questions': ['a1-questions-negation'], 'a1-present-negation': ['a1-questions-negation'],
  'a1-present-ere': ['a1-present-ere'], 'a1-present-ire': ['a1-present-ire'], 'a1-present-isc': ['a1-present-ire'],
});

function addUnit(level, id, title, description, records) {
  const unit = { id: `v2-${level.toLowerCase()}-u${id}`, title, description, lessons: [] };
  for (const r of records) {
    const id = `v2-${r.id}`;
    const tid = `${id}.core`;
    const [facets, questionFacets] = facetPlan[r.id] || [[r.facet || r.id], Array(r.questions.length).fill(r.facet || r.id)];
    if (r.questions.length !== questionFacets.length) throw new Error(`${id}: facet plan does not cover every question`);
    for (const facet of facets) if (!questionFacets.slice(1).includes(facet)) throw new Error(`${id}: ${facet} has no independent check`);
    const steps = [];
    const step = (kind, data) => {
      const s = { id: `${id}.s${steps.length + 1}`, kind, ...data };
      steps.push(s);
      return s;
    };
    step('words', { title: 'Words for this exchange', body: 'Listen and read these before answering.', words: r.words });
    for (const model of r.models) step('teach', { title: model[0], body: model[1], examples: [{ it: model[2], en: model[3] }], introduces: [tid] });
    const addPassage = () => {
      if (!r.passage) return;
      const s = step('passage', { title: r.passage[0], it: r.passage[1], en: r.passage[2], mode: r.passage[3] || 'read', task: r.passage[4] || 'Notice how the taught expression works in this short exchange.' });
      if (s.mode === 'listen') s.audioId = s.id;
    };
    const passageBeforeQuestion = r.production && r.questions.at(-1)?.format === 'type'
      ? r.questions.length - 1 : 2;
    r.questions.forEach((q, i) => {
      if (i === passageBeforeQuestion) addPassage();
      step('question', {
        target: tid, facet: questionFacets[i], stage: i === 0 ? 'guided' : 'independent',
        contextKey: `${id}.${i === 0 ? 'guided' : `independent-${i}`}`, ...q,
      });
    });
    for (const [facet, q] of (r.reserves || reservePlan[r.id] || [])) {
      step('question', { target: tid, facet, stage: 'independent', reserve: true,
        contextKey: `${id}.reserve-${steps.length + 1}`, ...q });
    }
    if (r.questions.length < 3) addPassage();
    const portfolio = r.portfolio || portfolioPlan[r.id];
    if (portfolio) step('portfolio', {
      title: portfolio[0], prompt: portfolio[1], mode: portfolio[2], model: portfolio[3],
      rubric: portfolio[4], ...(portfolio[5] ? { partnerPrompt: portfolio[5] } : {}),
    });
    step('teach', { title: 'Keep this', body: r.takeaway, examples: [{ it: r.models.at(-1)[2], en: r.models.at(-1)[3] }], introduces: [] });
    const related = (r.related || []).map(([entryId, caseId]) => ({ entryId, ...(caseId ? { caseId } : {}) }));
    unit.lessons.push({ id, title: r.title, outcome: r.outcome, minutes: r.minutes || 7, prerequisites: previousLesson ? [previousLesson] : [], related,
      legacyLessonIds: r.legacyLessonIds || legacyMap[r.id] || [], takeaway: r.takeaway,
      targets: [{ id: tid, label: r.title, explanation: r.takeaway, facets, minIndependent: Math.max(2, facets.length), requiresProduction: Boolean(r.production), modality: r.modality || 'language', repair: { title: `Try ${r.title.toLowerCase()} again`, body: r.models[0][1], examples: [{ it: r.models[0][2], en: r.models[0][3] }] } }], steps });
    previousLesson = id;
  }
  packs[level].units.push(unit);
}

// Foundations: whole expressions are assessed as chunks, not as conjugation mastery.
addUnit('Foundations', 1, 'Make first contact', 'Greet, exchange names, and choose familiar or polite address.', [
  { id: 'f-greet', title: 'Begin and end an exchange', outcome: 'I can greet someone and take leave.', takeaway: 'Ciao is familiar; buongiorno is a polite greeting; arrivederci ends an exchange.', words: [W('ciao','hello or goodbye (familiar)'),W('buongiorno','good morning or good day'),W('arrivederci','goodbye'),W('signora','madam'),W('a domani','see you tomorrow')], models: [
    ['A friendly beginning', 'Use ciao with a friend. Use buongiorno in a polite daytime exchange.', 'Ciao, Anna!', 'Hi, Anna!'],
    ['A polite ending', 'Arrivederci is a useful goodbye in a polite exchange.', 'Buongiorno, signora. Arrivederci!', 'Good day, madam. Goodbye!']
  ], questions: [
    M('Ciao, Anna!', 'Hi, Anna!', ['Hi, Anna!','Goodbye, madam.','Thank you, Anna.'], 'Ciao, Anna!', 'Ciao opens this familiar exchange.', 'The people know each other.'),
    C('___, signora.', 'You greet a woman politely in the morning.', 'Buongiorno', ['Buongiorno','Ciao','Arrivederci'], 'Buongiorno, signora.', 'Buongiorno fits a polite daytime greeting.', 'This is an opening, not a farewell.'),
    C('Anna: «A domani!» Luca: «___!»', 'Anna says “See you tomorrow!” Luca says goodbye.', 'Arrivederci', ['Arrivederci','Buongiorno','Grazie'], 'Anna: «A domani!» Luca: «Arrivederci!»', 'Arrivederci closes the conversation.', 'Choose the leave-taking word.'),
    M('Buongiorno!', 'Good morning!', ['Good morning!','Goodbye!','Please!'], 'Buongiorno!', 'Buongiorno is a daytime greeting.', 'Look for a greeting used at the start.'),
    C('«___, Luca!»', 'You greet your friend Luca informally.', 'Ciao', ['Ciao','Buongiorno','Arrivederci'], 'Ciao, Luca!', 'Ciao fits a greeting between friends.', 'The relationship is familiar.'),
  ], passage: ['Two short greetings', 'Anna: «Ciao, Luca!»\nLuca: «Ciao, Anna!»\nAnna: «Arrivederci!»', 'Anna: “Hi, Luca!”\nLuca: “Hi, Anna!”\nAnna: “Goodbye!”', 'listen'], related: [] },
  { id: 'f-name', title: 'Exchange names', outcome: 'I can ask and give a name with a model.', takeaway: 'Mi chiamo… and Come ti chiami? are useful whole phrases; their verb parts are explained later.', words: [W('Mi chiamo…','My name is…','', '', 'Learn this as a whole expression.'),W('Come ti chiami?','What is your name? (familiar)','', '', 'A whole question for someone you call tu.')], models: [
    ['Give a name', 'Say Mi chiamo followed by a name. Keep the whole expression together.', 'Mi chiamo Anna.', 'My name is Anna.'],
    ['Ask a peer', 'Ask Come ti chiami? when you speak to someone familiarly.', 'Come ti chiami? Mi chiamo Luca.', 'What is your name? My name is Luca.']
  ], questions: [
    M('Mi chiamo Anna.', 'My name is Anna.', ['My name is Anna.','Your name is Anna.','Goodbye, Anna.'], 'Mi chiamo Anna.', 'Mi chiamo gives the speaker’s name.', 'The speaker is talking about herself.'),
    C('«Come ti chiami?» «___»', 'A peer asks your name; you answer “My name is Luca.”', 'Mi chiamo Luca.', ['Mi chiamo Luca.','Come ti chiami?','Buongiorno Luca.'], 'Come ti chiami? Mi chiamo Luca.', 'Mi chiamo Luca answers the question with a name.', 'Answer rather than repeat the question.'),
    O('My name is Anna.', 'Mi chiamo Anna.', ['Anna.','chiamo','Mi'], 'Keep Mi chiamo together before the supplied name.', 'Begin with Mi chiamo.'),
    C('«___» «Mi chiamo Sara.»', 'Ask Sara her name in a familiar exchange.', 'Come ti chiami?', ['Come ti chiami?','Mi chiamo Sara.','Arrivederci!'], 'Come ti chiami? Mi chiamo Sara.', 'Come ti chiami? is the taught familiar name question.', 'Select a question, not an answer.'),
  ], passage: ['First meeting', 'Luca: «Ciao! Come ti chiami?»\nSara: «Mi chiamo Sara. E tu?»\nLuca: «Mi chiamo Luca.»', 'Luca: “Hi! What is your name?”\nSara: “My name is Sara. And you?”\nLuca: “My name is Luca.”', 'read'], related: [] },
  { id: 'f-name-polite', title: 'Ask a name politely', outcome: 'I can choose a polite name question for a stranger.', takeaway: 'Come si chiama? is the polite whole question; Come ti chiami? is familiar. Do not infer the full reflexive pattern yet.', words: [W('Come si chiama?','What is your name? (polite)'),W('Lei','you (polite, singular)'),W('signora','madam')], models: [
    ['Two social relationships', 'Use Come ti chiami? with a peer you call tu. Use Come si chiama? for polite Lei address.', 'Buongiorno, signora. Come si chiama?', 'Good morning, madam. What is your name?'],
  ], questions: [
    C('Buongiorno, signora. ___', 'You ask a woman you have just met for her name politely.', 'Come si chiama?', ['Come si chiama?','Come ti chiami?','Mi chiamo?'], 'Buongiorno, signora. Come si chiama?', 'The polite situation calls for Come si chiama?', 'She is a stranger, not a familiar peer.'),
    M('Come si chiama?', 'What is your name? (polite)', ['What is your name? (polite)','My name is…','Where are you from?'], 'Come si chiama?', 'This is the polite name question.', 'It is a question asked of someone.'),
    C('«Ciao! ___»', 'You meet a peer and ask for their name.', 'Come ti chiami?', ['Come ti chiami?','Come si chiama?','Mi chiamo Marco.'], 'Ciao! Come ti chiami?', 'Ciao and a peer cue familiar ti.', 'Use the familiar form.'),
    C('«Buongiorno. ___» «Mi chiamo Anna.»', 'A clerk asks a customer her name politely.', 'Come si chiama?', ['Come si chiama?','Come ti chiami?','Arrivederci?'], 'Buongiorno. Come si chiama? Mi chiamo Anna.', 'A polite service exchange takes Come si chiama?', 'Buongiorno marks the polite setting.'),
  ], passage: ['At reception', 'Addetta: «Buongiorno. Come si chiama?»\nAnna: «Mi chiamo Anna Rossi.»', 'Receptionist: “Good morning. What is your name?”\nAnna: “My name is Anna Rossi.”', 'listen'], portfolio: ['Introduce yourself', 'Practise a two-line polite introduction with a fictional name.', 'speak', 'Buongiorno. Mi chiamo Anna. E Lei, come si chiama?', ['Use buongiorno to open politely.','Give a name using Mi chiamo.','Ask the polite question.']], related: [] },
]);

addUnit('Foundations', 2, 'Keep the exchange going', 'Use courtesy and repair phrases in short conversations.', [
  { id: 'f-courtesy', title: 'Thank and ask politely', outcome: 'I can use grazie, prego, scusi and per favore in their different jobs.', takeaway: 'Grazie thanks someone; prego responds; scusi gets attention; per favore softens a request.', words: [W('grazie','thank you'),W('prego','you are welcome'),W('scusi','excuse me (polite)'),W('per favore','please'),W('un caffè','a coffee'),W('ecco','here is')], models: [
    ['Thank and answer', 'Grazie thanks someone. Prego is a natural answer to thanks.', '«Grazie!» «Prego!»', '“Thank you!” “You are welcome!”'],
    ['Get attention', 'Scusi attracts attention politely. Per favore belongs inside a request.', 'Scusi, per favore.', 'Excuse me, please.']
  ], questions: [
    C('«Grazie!» «___»', 'Someone thanks you; answer “You are welcome.”', 'Prego!', ['Prego!','Scusi!','Ciao!'], 'Grazie! Prego!', 'Prego answers grazie.', 'This is a reply to thanks.'),
    C('«Ecco il libro.» «___»', 'Someone hands you a book; thank them.', 'Grazie!', ['Grazie!','Prego!','Scusi!'], 'Ecco il libro. Grazie!', 'Grazie thanks the person who helped.', 'You received something.'),
    C('___, signora.', 'You need to get a stranger’s attention politely.', 'Scusi', ['Scusi','Prego','Grazie'], 'Scusi, signora.', 'Scusi politely gets attention.', 'You are beginning a request.'),
    C('Un caffè, ___.', 'You ask for a coffee politely.', 'per favore', ['per favore','prego','grazie'], 'Un caffè, per favore.', 'Per favore makes the request polite.', 'The request is still being made.'),
    C('«Grazie per il caffè.» «___»', 'A customer thanks you for a coffee.', 'Prego!', ['Prego!','Scusi!','Buongiorno!'], 'Grazie per il caffè. Prego!', 'Prego responds to thanks.', 'This is the reply to grazie.'),
  ], passage: ['A small favour', 'Luca: «Scusi. Un caffè, per favore.»\nBarista: «Ecco il caffè.»\nLuca: «Grazie!»\nBarista: «Prego!»', 'Luca: “Excuse me. A coffee, please.”\nBarista: “Here is the coffee.”\nLuca: “Thank you!”\nBarista: “You are welcome!”', 'listen'], related: [] },
  { id: 'f-repair', title: 'Ask for a repeat', outcome: 'I can say I do not understand and ask for repetition.', takeaway: 'Non capisco and Può ripetere, per favore? are whole repair expressions. Their internal grammar comes later.', words: [W('Non capisco.','I do not understand.'),W('Può ripetere, per favore?','Could you repeat, please? (polite)')], models: [
    ['Say what happened', 'Use Non capisco when you have not understood.', 'Scusi, non capisco.', 'Excuse me, I do not understand.'],
    ['Ask for a repeat', 'Può ripetere, per favore? asks politely for the same message again.', 'Può ripetere, per favore?', 'Could you repeat, please?']
  ], questions: [
    M('Non capisco.', 'I do not understand.', ['I do not understand.','I am from Rome.','My name is Luca.'], 'Non capisco.', 'Non capisco states a problem understanding.', 'This phrase names a communication problem.'),
    C('«Scusi, ___.»', 'You did not understand what the receptionist said.', 'non capisco', ['non capisco','mi chiamo','prego'], 'Scusi, non capisco.', 'Non capisco explains why you need help.', 'State that you did not understand.'),
    C('«Scusi. ___»', 'Ask a stranger to say the message again.', 'Può ripetere, per favore?', ['Può ripetere, per favore?','Come ti chiami?','Arrivederci!'], 'Scusi. Può ripetere, per favore?', 'Può ripetere requests repetition politely.', 'Ask for the same words again.'),
    M('Può ripetere, per favore?', 'Could you repeat, please?', ['Could you repeat, please?','What is your name?','Thank you very much.'], 'Può ripetere, per favore?', 'This whole question asks for repetition.', 'Look for a request to hear something again.'),
  ], passage: ['When a name is missed', 'Addetta: «Come si chiama?»\nLuca: «Scusi, non capisco. Può ripetere, per favore?»\nAddetta: «Come si chiama?»', 'Receptionist: “What is your name?”\nLuca: “Sorry, I do not understand. Could you repeat, please?”\nReceptionist: “What is your name?”', 'read'], portfolio: ['Repair an exchange', 'Practise asking for a repeat after a polite greeting.', 'interact', 'Buongiorno. Scusi, non capisco. Può ripetere, per favore?', ['Open politely.','Say what you did not understand.','Ask for repetition as a whole phrase.'], 'Buongiorno. Come si chiama?'], related: [] },
]);

addUnit('Foundations', 3, 'Connect meaning and sound', 'Use supported origin phrases and hear familiar spelling patterns.', [
  { id: 'f-origin', title: 'Say where you are from', outcome: 'I can use Sono di with a supplied place name.', takeaway: 'Sono di Roma means I am from Rome. Keep sono di as a whole origin frame for now.', words: [W('Sono di…','I am from…'),W('Di dove sei?','Where are you from? (familiar)'),W('Roma','Rome'),W('Milano','Milan'),W('Napoli','Naples')], models: [
    ['An origin frame', 'Say Sono di plus the supplied city name. You do not need a general preposition rule yet.', 'Sono di Roma.', 'I am from Rome.']
  ], questions: [
    M('Sono di Roma.', 'I am from Rome.', ['I am from Rome.','I live in Rome.','I am called Roma.'], 'Sono di Roma.', 'Sono di expresses origin in this frame.', 'The speaker names where they are from.'),
    C('«Di dove sei?» «___»', 'The supplied place is Milano; answer “I am from Milan.”', 'Sono di Milano.', ['Sono di Milano.','Sono di Roma.','Mi chiamo Milano.'], 'Di dove sei? Sono di Milano.', 'Sono di Milano gives the requested origin.', 'Keep Sono di and choose Milano.'),
    O('I am from Naples.', 'Sono di Napoli.', ['Napoli.','di','Sono'], 'The taught frame is Sono di + city.', 'Begin with Sono di.'),
    C('«Sono di Roma. E tu?» «___»', 'A speaker from Rome asks you; your supplied city is Napoli.', 'Sono di Napoli.', ['Sono di Napoli.','Sono di Roma.','Come ti chiami?'], 'Sono di Roma. E tu? Sono di Napoli.', 'The reply keeps the origin frame and changes the supplied city.', 'Use your supplied city, Napoli.'),
  ], passage: ['Two origins', 'Anna: «Ciao, sono Anna. Sono di Roma.»\nLuca: «Mi chiamo Luca. Sono di Napoli.»', 'Anna: “Hi, I am Anna. I am from Rome.”\nLuca: “My name is Luca. I am from Naples.”', 'listen'], related: [] },
  { id: 'f-sound-c', title: 'Hear two c sounds', outcome: 'I can recognize hard and soft c in words whose meanings I know.', takeaway: 'C before a or o is hard in casa and come. C before e is soft in cena. In ciao the i signals soft c but is not a separate vowel sound.', words: [W('casa','house','la','case'),W('come','how'),W('cena','dinner','la','cene'),W('ciao','hi or bye')], models: [
    ['Hear hard c', 'In casa and come, c before a or o has a hard sound. Listen to both known words.', 'La casa è a Roma.', 'The house is in Rome.'],
    ['Hear soft c', 'In cena, c before e is soft. Ciao also begins with soft c; its written i cues that sound and is not a separate vowel.', 'Ciao! La cena è pronta.', 'Hi! Dinner is ready.']
  ], questions: [
    C('La ___ è a Roma.', 'Choose the familiar word meaning house, with hard c.', 'casa', ['casa','cena','ciao'], 'La casa è a Roma.', 'Casa has hard c before a and means house.', 'The target means house.'),
    C('cena', 'Choose the known word with the same soft initial c sound as cena.', 'ciao', ['ciao','casa','come'], 'Ciao, Anna!', 'Ciao and cena begin with a soft c sound.', 'Compare the first sound, not the meaning.', { prompt: 'Which word begins with the same soft c sound as cena?' }),
    C('casa', 'Choose the known word with the same hard initial c as casa.', 'come', ['come','cena','ciao'], 'Come ti chiami?', 'Come and casa begin with hard c.', 'Compare the first sound, not the meaning.', { prompt: 'Which word starts with the same hard c sound as casa?' }),
    C('cena', 'Choose the known word with the same soft initial c as cena; the i in ciao is a spelling cue.', 'ciao', ['ciao','casa','come'], 'Ciao, Anna!', 'Ciao and cena start with soft c.', 'Compare the first sound, not the meaning.', { prompt: 'Which word starts with the same soft c sound as cena?' }),
  ], passage: ['Familiar sounds in a small exchange', 'Anna: «Ciao! Come ti chiami?»\nLuca: «Mi chiamo Luca. La cena è pronta.»', 'Anna: “Hi! What is your name?”\nLuca: “My name is Luca. Dinner is ready.”', 'listen'], portfolio: ['Say familiar c words', 'Practise casa, cena and ciao aloud after the models. Notice two initial sounds.', 'speak', 'casa — cena — ciao', ['Identify the different initial sound in casa.','Use the same soft initial sound in cena and ciao.','Do not pronounce the i in ciao as a separate vowel.']], related: [['w:casa|noun']] },
]);

addUnit('A1', 1, 'Say who you are', 'Turn familiar identity phrases into reusable essere forms.', [
  { id: 'a1-essere-singular', title: 'Use sono, sei and è', outcome: 'I can choose essere for I, familiar you, and one other person.', takeaway: 'Io sono, tu sei, and Anna è identify three different people. The pronoun may be omitted when the form is clear.', words: [W('io','I'),W('tu','you (familiar)'),W('Anna','a woman’s name'),W('di Roma','from Rome')], models: [
    ['Three people, three forms', 'Use sono with io, sei with tu, and è with one named person. Sono, sei and è are present forms of essere.', 'Io sono Anna. Tu sei Luca.', 'I am Anna. You are Luca.'],
    ['The name is enough', 'With a named singular person, use è. The accent distinguishes è (is) from e (and).', 'Anna è di Roma.', 'Anna is from Rome.']
  ], questions: [
    C('Io ___ Anna.', 'I am Anna.', 'sono', ['sono','sei','è'], 'Io sono Anna.', 'Io takes sono.', 'The speaker says “I.”'),
    C('Tu ___ di Roma?', 'Are you from Rome? (familiar)', 'sei', ['sei','sono','è'], 'Tu sei di Roma?', 'Tu takes sei.', 'The person addressed is tu.'),
    C('Anna ___ di Napoli.', 'Anna is from Naples.', 'è', ['è','e','sei'], 'Anna è di Napoli.', 'One named person takes è with an accent.', 'The subject is Anna.'),
    T('Io ___ di Milano.', 'I am from Milan.', 'sono', 'Io sono di Milano.', 'The speaker is io, so use sono.', 'Use the io form.'),
  ], passage: ['Two introductions', 'Anna: «Io sono Anna. Tu sei Luca?»\nLuca: «Sì. Anna è di Roma?»\nAnna: «Sì, sono di Roma.»', 'Anna: “I am Anna. Are you Luca?”\nLuca: “Yes. Is Anna from Rome?”\nAnna: “Yes, I am from Rome.”', 'read'], production: true, related: [['v:essere','present']] },
  { id: 'a1-essere-polite', title: 'Use Lei è politely', outcome: 'I can ask or tell who a person is using polite Lei.', takeaway: 'Lei addresses one person politely but takes the same verb form è as one other person. The social relationship controls the choice.', words: [W('Lei','you (polite)'),W('il medico','the doctor'),W('la signora','the woman / madam'),W('di Firenze','from Florence')], models: [
    ['Polite address', 'When you address one person as Lei, use è, not sei. Use tu sei with a familiar peer.', 'Signora, Lei è di Firenze?', 'Madam, are you from Florence?']
  ], questions: [
    C('Signora, Lei ___ di Firenze?', 'Ask a woman politely whether she is from Florence.', 'è', ['è','sei','sono'], 'Signora, Lei è di Firenze?', 'Polite Lei uses è.', 'Lei is polite singular you.'),
    C('Dottore, Lei ___ il medico?', 'Ask a doctor politely whether he is the doctor.', 'è', ['è','sei','sono'], 'Dottore, Lei è il medico?', 'The person addressed as Lei takes è.', 'Look at the address Dottore.'),
    C('Luca, tu ___ di Roma?', 'Ask your friend Luca whether he is from Rome.', 'sei', ['sei','è','sono'], 'Luca, tu sei di Roma?', 'A familiar friend addressed as tu takes sei.', 'This is not polite Lei.'),
    T('Signora, Lei ___ Anna Rossi?', 'Madam, are you Anna Rossi?', 'è', 'Signora, Lei è Anna Rossi?', 'The polite addressee Lei uses è.', 'Use the accented form.'),
  ], passage: ['At a clinic', 'Addetta: «Buongiorno, signora. Lei è Anna Rossi?»\nAnna: «Sì, sono Anna Rossi.»', 'Receptionist: “Good morning, madam. Are you Anna Rossi?”\nAnna: “Yes, I am Anna Rossi.”', 'listen'], production: true, related: [['v:essere','present']] },
  { id: 'a1-essere-plural', title: 'Introduce two or more people', outcome: 'I can use siamo, siete and sono with plural people.', takeaway: 'Noi siamo, voi siete, loro sono are plural forms of essere. The verb says who is meant even without the pronoun.', words: [W('noi','we'),W('voi','you all'),W('loro','they'),W('di Milano','from Milan')], models: [
    ['People together', 'Use siamo for we, siete for you all, and sono for they. These are all forms of essere.', 'Noi siamo di Milano. Voi siete di Roma.', 'We are from Milan. You all are from Rome.'],
    ['Without a pronoun', 'Sono can mean “I am” or “they are”; a name or context resolves the difference.', 'Anna e Luca sono di Napoli.', 'Anna and Luca are from Naples.']
  ], questions: [
    C('Noi ___ di Milano.', 'We are from Milan.', 'siamo', ['siamo','siete','sono'], 'Noi siamo di Milano.', 'Noi takes siamo.', 'The subject means we.'),
    C('Voi ___ di Roma?', 'Are you all from Rome?', 'siete', ['siete','siamo','sono'], 'Voi siete di Roma?', 'Voi takes siete.', 'This is plural you.'),
    C('Anna e Luca ___ di Napoli.', 'Anna and Luca are from Naples.', 'sono', ['sono','siamo','siete'], 'Anna e Luca sono di Napoli.', 'Two named people take sono.', 'The subject means they.'),
    T('Noi ___ Anna e Luca.', 'We are Anna and Luca.', 'siamo', 'Noi siamo Anna e Luca.', 'Noi takes siamo.', 'Use the we form.'),
  ], passage: ['A group arrives', 'Anna: «Noi siamo Anna e Luca.»\nAddetta: «Voi siete di Milano?»\nAnna: «No, siamo di Roma.»', 'Anna: “We are Anna and Luca.”\nReceptionist: “Are you both from Milan?”\nAnna: “No, we are from Rome.”', 'read'], portfolio: ['Make a short introduction', 'Introduce yourself and a friend, then ask two people where they are from.', 'interact', 'Sono Anna. Luca è di Roma. Voi siete di Roma?', ['Use sono for yourself.','Use è for one other person.','Use siete for two people addressed.'], 'Siamo di Roma. E voi?'], production: true, related: [['v:essere','present']] },
]);

addUnit('A1', 2, 'Name familiar things', 'Learn noun gender and singular articles with known objects and people.', [
  { id: 'a1-singular-gender', title: 'Name a familiar noun', outcome: 'I can use il or la with familiar singular nouns.', takeaway: 'Learn a noun with its article: il libro and il pane are masculine; la casa and la scuola are feminine. Endings help, but -e does not settle gender.', words: [W('libro','book','il','libri'),W('casa','house','la','case'),W('pane','bread','il'),W('scuola','school','la','scuole')], models: [
    ['Names come with an article', 'Il introduces these masculine nouns; la introduces these feminine nouns. The article is part of the form you learn.', 'Il libro è qui. La casa è qui.', 'The book is here. The house is here.'],
    ['An -e noun', 'An ending in -e does not by itself tell you gender. Learn il pane with its article.', 'Il pane è qui.', 'The bread is here.']
  ], questions: [
    C('___ libro è qui.', 'The book is here.', 'Il', ['Il','La','Lo'], 'Il libro è qui.', 'Libro is taught as il libro.', 'Recall the article shown with libro.'),
    C('___ casa è qui.', 'The house is here.', 'La', ['La','Il','Le'], 'La casa è qui.', 'Casa is taught as la casa.', 'Recall the article shown with casa.'),
    C('___ pane è qui.', 'The bread is here.', 'Il', ['Il','La','I'], 'Il pane è qui.', 'Pane is masculine despite its -e ending.', 'Use the article taught with pane.'),
    T('___ scuola è qui.', 'The school is here.', 'La', 'La scuola è qui.', 'Scuola is taught as la scuola.', 'It is a feminine singular noun.'),
  ], passage: ['Four useful nouns', 'Anna: «Il libro è qui?»\nLuca: «Sì. Il pane è qui, e la scuola è qui.»', 'Anna: “Is the book here?”\nLuca: “Yes. The bread is here, and the school is here.”', 'read'], production: true, related: [['w:libro|noun'],['w:casa|noun']] },
  { id: 'a1-one-thing', title: 'Introduce one thing', outcome: 'I can distinguish un, una and un’ with a familiar noun.', takeaway: 'Use un with a masculine noun, una with a feminine consonant, and un’ before a feminine vowel. The apostrophe joins directly to the noun.', words: [W('amico','male friend','un','amici'),W('amica','female friend','un’','amiche'),W('libro','book','il','libri'),W('casa','house','la','case')], models: [
    ['A new thing', 'Use un libro for a book and una casa for a house. The noun still determines the form.', 'È un libro. È una casa.', 'It is a book. It is a house.'],
    ['A friend', 'Un amico has no apostrophe. A feminine amica begins with a vowel, so write un’amica without a space.', 'Luca è un amico. Anna è un’amica.', 'Luca is a male friend. Anna is a female friend.']
  ], questions: [
    C('È ___ libro.', 'It is a book.', 'un', ['un','una','un’'], 'È un libro.', 'Libro is masculine and takes un.', 'Use the masculine form.'),
    C('È ___ casa.', 'It is a house.', 'una', ['una','un','uno'], 'È una casa.', 'Casa begins with a consonant and is feminine.', 'Use the full feminine form.'),
    C('Anna è ___.', 'Anna is a female friend.', 'un’amica', ['un’amica','un amica','un amico'], 'Anna è un’amica.', 'Feminine amica takes un’ joined to the noun.', 'The apostrophe replaces the last a of una.'),
    T('Luca è ___ amico.', 'Luca is a male friend.', 'un', 'Luca è un amico.', 'Masculine amico takes un, without apostrophe.', 'The friend is male.'),
  ], passage: ['Two friends', 'Anna è un’amica. Luca è un amico. La casa è qui.', 'Anna is a female friend. Luca is a male friend. The house is here.', 'listen'], production: true, related: [['w:amico|noun'],['w:casa|noun']] },
  { id: 'a1-special-articles', title: 'Name a student or a backpack', outcome: 'I can use lo/uno and l’ with their taught nouns.', takeaway: 'Use lo and uno before masculine z or s plus another consonant; use l’ before a singular vowel noun. Keep gender separate from the opening sound.', words: [W('studente','male student','lo','studenti'),W('zaino','backpack','lo','zaini'),W('amico','male friend','l’','amici'),W('amica','female friend','l’','amiche')], models: [
    ['Special masculine starts', 'Lo studente and lo zaino are definite. For one new student or backpack, use uno.', 'Lo zaino è qui. È uno zaino.', 'The backpack is here. It is a backpack.'],
    ['A vowel start', 'The singular definite article shortens before a vowel: l’amico and l’amica. A masculine new friend is un amico; a feminine one is un’amica.', 'L’amico è qui. L’amica è qui.', 'The male friend is here. The female friend is here.']
  ], questions: [
    C('___ zaino è qui.', 'The backpack is here.', 'Lo', ['Lo','Il','La'], 'Lo zaino è qui.', 'Zaino begins with z, so the taught definite form is lo.', 'Look at the first sound of zaino.'),
    C('È ___ studente.', 'He is a male student.', 'uno', ['uno','un','una'], 'È uno studente.', 'Masculine studente starts with s plus a consonant.', 'Use the special indefinite form.'),
    C('___ è qui.', 'The female friend is here.', 'L’amica', ['L’amica','La amica','Lo amica'], 'L’amica è qui.', 'Before the vowel of amica, the definite article is l’.', 'Join the article to amica with no space.'),
    T('È ___ zaino.', 'It is a backpack.', 'uno', 'È uno zaino.', 'Zaino takes uno when introduced as one new thing.', 'Use the masculine z form.'),
    C('___ studente è qui.', 'The male student is here.', 'Lo', ['Lo','Il','La'], 'Lo studente è qui.', 'Studente begins with s plus another consonant, so use lo.', 'Use the special definite form.'),
  ], passage: ['A student arrives', 'Lo studente è qui. È uno studente di Roma. L’amica è qui.', 'The student is here. He is a student from Rome. The female friend is here.', 'read'], portfolio: ['Identify a familiar object', 'Write two short sentences identifying a known backpack and then naming a student.', 'write', 'Lo zaino è qui. Luca è uno studente.', ['Use lo before zaino.','Use uno before studente.','Write article and noun together naturally.']], production: true, related: [['w:studente|noun'],['w:amico|noun']] },
]);

addUnit('A1', 3, 'Say what you have', 'Use avere for possessions, ages, and basic physical states.', [
  { id: 'a1-avere-singular', title: 'Say what one person has', outcome: 'I can use ho, hai and ha for possessions.', takeaway: 'Io ho, tu hai, and Anna ha come from avere. The written h is silent but distinguishes these forms.', words: [W('io','I'),W('tu','you (familiar)'),W('un libro','a book'),W('uno zaino','a backpack')], models: [
    ['Three owners', 'Use ho for I, hai for familiar you, and ha for one other person.', 'Io ho un libro. Tu hai uno zaino.', 'I have a book. You have a backpack.'],
    ['A silent h', 'Write h in ho, hai and ha even though you do not hear it.', 'Anna ha una casa.', 'Anna has a house.']
  ], questions: [
    C('Io ___ un libro.', 'I have a book.', 'ho', ['ho','hai','ha'], 'Io ho un libro.', 'Io takes ho.', 'The owner is the speaker.'),
    C('Tu ___ uno zaino?', 'Do you have a backpack? (familiar)', 'hai', ['hai','ho','ha'], 'Tu hai uno zaino?', 'Tu takes hai.', 'The person addressed is tu.'),
    C('Anna ___ una casa.', 'Anna has a house.', 'ha', ['ha','hai','ho'], 'Anna ha una casa.', 'One named person takes ha.', 'The owner is Anna.'),
    T('Io ___ una casa.', 'I have a house.', 'ho', 'Io ho una casa.', 'The first-person form is ho with silent h.', 'Use the io form.'),
  ], passage: ['What they have', 'Anna: «Io ho un libro. Tu hai uno zaino?»\nLuca: «Sì. Marco ha una casa.»', 'Anna: “I have a book. Do you have a backpack?”\nLuca: “Yes. Marco has a house.”', 'listen'], production: true, related: [['v:avere','present']] },
  { id: 'a1-avere-plural', title: 'Say what a group has', outcome: 'I can choose abbiamo, avete and hanno.', takeaway: 'Noi abbiamo, voi avete, and loro hanno are the plural present forms of avere. Hanno has silent h.', words: [W('noi','we'),W('voi','you all'),W('loro','they'),W('libri','books')], models: [
    ['Plural owners', 'Use abbiamo for we, avete for you all, and hanno for they.', 'Noi abbiamo un libro. Voi avete uno zaino.', 'We have a book. You all have a backpack.'],
    ['The written h returns', 'Hanno is the they form. Keep its h even though it is silent.', 'Anna e Luca hanno una casa.', 'Anna and Luca have a house.']
  ], questions: [
    C('Noi ___ un libro.', 'We have a book.', 'abbiamo', ['abbiamo','avete','hanno'], 'Noi abbiamo un libro.', 'Noi takes abbiamo.', 'The owners are we.'),
    C('Voi ___ uno zaino?', 'Do you all have a backpack?', 'avete', ['avete','abbiamo','hanno'], 'Voi avete uno zaino?', 'Voi takes avete.', 'This is plural you.'),
    C('Anna e Luca ___ una casa.', 'Anna and Luca have a house.', 'hanno', ['hanno','hano','abbiamo'], 'Anna e Luca hanno una casa.', 'They take hanno with a silent written h.', 'Two named people mean they.'),
    T('Noi ___ una casa.', 'We have a house.', 'abbiamo', 'Noi abbiamo una casa.', 'Noi takes abbiamo.', 'Use the we form.'),
  ], passage: ['A shared home', 'Anna e Luca hanno una casa a Roma. Noi abbiamo un libro qui.', 'Anna and Luca have a house in Rome. We have a book here.', 'read'], production: true, related: [['v:avere','present']] },
  { id: 'a1-small-numbers', title: 'Read small numbers', outcome: 'I can recognize and say zero through ten in practical information.', takeaway: 'Learn number words in small groups, then connect the spoken word to a digit. Age and prices use this knowledge later.', words: [W('zero','0'),W('uno','1'),W('due','2'),W('tre','3'),W('quattro','4'),W('cinque','5'),W('sei','6'),W('sette','7'),W('otto','8'),W('nove','9'),W('dieci','10'),W('numero','number','il','numeri')], models: [
    ['Zero to five', 'Listen to zero, uno, due, tre, quattro and cinque. Match each to its digit.', 'Il numero è due.', 'The number is two.'],
    ['Six to ten', 'Listen to sei, sette, otto, nove and dieci. A number can answer a short question by itself.', 'Il numero è otto.', 'The number is eight.']
  ], questions: [
    M('tre', '3', ['3','2','4'], 'Il numero è tre.', 'Tre is 3.', 'Listen to the number model.'),
    C('Il numero è ___.', 'The number shown is 2.', 'due', ['due','tre','dieci'], 'Il numero è due.', 'Due means two.', 'Choose the word for 2.'),
    M('otto', '8', ['8','7','10'], 'Il numero è otto.', 'Otto means 8.', 'Use the second number group.'),
    T('Il numero è ___.', 'The number shown is 5.', 'cinque', 'Il numero è cinque.', 'Cinque means five.', 'Recall the word for 5.'),
  ], passage: ['A number at reception', 'Addetta: «Il numero è tre?»\nLuca: «No, il numero è cinque.»', 'Receptionist: “Is the number three?”\nLuca: “No, the number is five.”', 'listen'], production: true, related: [] },
  { id: 'a1-age-states', title: 'Give an age and a need', outcome: 'I can use avere to state a modeled age or hunger and thirst.', takeaway: 'Italian uses avere in ho otto anni, ho fame and ho sete. Use fictional people for age practice; larger numbers come later.', words: [W('anni','years'),W('otto','8'),W('nove','9'),W('fame','hunger'),W('sete','thirst')], models: [
    ['Age uses avere', 'Say ho otto anni for “I am eight years old.” The age here belongs to a fictional child.', 'Luca ha otto anni. Anna ha nove anni.', 'Luca is eight. Anna is nine.'],
    ['Food and drink needs', 'Say ho fame for “I am hungry” and ho sete for “I am thirsty.”', 'Ho fame. Tu hai sete?', 'I am hungry. Are you thirsty?']
  ], questions: [
    C('Io ___ otto anni.', 'In a fictional child role-play, I am eight years old.', 'ho', ['ho','sono','ha'], 'Io ho otto anni.', 'Age uses avere; io takes ho.', 'Use have, not be.'),
    C('Anna ___ nove anni.', 'The fictional child Anna is nine years old.', 'ha', ['ha','è','hai'], 'Anna ha nove anni.', 'A named person takes ha for age.', 'Use the form of avere for Anna.'),
    C('Io ___ fame.', 'I am hungry.', 'ho', ['ho','sono','è'], 'Io ho fame.', 'Ho fame is the taught phrase for hunger.', 'Italian uses avere here.'),
    T('Tu ___ sete?', 'Are you thirsty? (familiar)', 'hai', 'Tu hai sete?', 'Tu takes hai in the phrase avere sete.', 'The person addressed is tu.'),
  ], passage: ['Two basic facts', 'Luca: «Ho otto anni. Ho fame.»\nAnna: «Io ho sete.»', 'Luca: “I am eight. I am hungry.”\nAnna: “I am thirsty.”', 'read'], portfolio: ['Introduce a fictional person', 'Describe a fictional person using a supplied age and one need.', 'write', 'Anna ha nove anni. Anna ha sete.', ['Use ha for Anna.','Use a number that has been introduced.','Use avere for thirst or hunger.']], production: true, related: [['v:avere','present']] },
]);

addUnit('A1', 4, 'Describe one or several things', 'Build regular plurals, plural articles and simple adjective agreement.', [
  { id: 'a1-noun-plurals', title: 'Make familiar nouns plural', outcome: 'I can form regular plurals of taught nouns.', takeaway: 'Libro → libri, casa → case, studente → studenti. A noun ending alone does not say which article to use.', words: [W('libro','book','il','libri'),W('casa','house','la','case'),W('studente','male student','lo','studenti')], models: [
    ['Two common changes', 'A regular -o noun changes to -i; a regular -a noun changes to -e.', 'Un libro, due libri. Una casa, due case.', 'One book, two books. One house, two houses.'],
    ['Nouns ending in -e', 'Many nouns ending in -e change to -i, as studente → studenti.', 'Uno studente, due studenti.', 'One student, two students.']
  ], questions: [
    C('Ho due ___.', 'I have two books.', 'libri', ['libri','libro','libre'], 'Ho due libri.', 'Libro changes -o to -i.', 'Two requires the plural.'),
    C('Anna ha due ___.', 'Anna has two houses.', 'case', ['case','casa','casi'], 'Anna ha due case.', 'Casa changes -a to -e.', 'Recall the feminine regular plural.'),
    C('Tre ___ sono qui.', 'Three male students are here.', 'studenti', ['studenti','studente','studentes'], 'Tre studenti sono qui.', 'Studente changes -e to -i.', 'Use the plural of studente.'),
    T('Ho tre ___.', 'I have three books.', 'libri', 'Ho tre libri.', 'Tre requires libri, the plural of libro.', 'Change -o to -i.'),
  ], passage: ['An inventory', 'Anna ha due libri. Luca ha tre libri. Le case sono a Roma.', 'Anna has two books. Luca has three books. The houses are in Rome.', 'read'], production: true, related: [['w:libro|noun'],['w:casa|noun']] },
  { id: 'a1-plural-articles', title: 'Put an article before a plural', outcome: 'I can choose i, gli and le for taught plurals.', takeaway: 'Il libro → i libri; lo studente → gli studenti; la casa → le case. Learn the plural article after the noun plural.', words: [W('i libri','the books'),W('gli studenti','the male students'),W('le case','the houses'),W('le amiche','the female friends')], models: [
    ['Regular plural articles', 'Il becomes i before a regular masculine plural; la becomes le before a feminine plural.', 'I libri sono qui. Le case sono qui.', 'The books are here. The houses are here.'],
    ['The lo family', 'Lo studente becomes gli studenti. Also use gli before a masculine plural vowel, as gli amici.', 'Gli studenti sono qui.', 'The male students are here.']
  ], questions: [
    C('___ libri sono qui.', 'The books are here.', 'I', ['I','Gli','Le'], 'I libri sono qui.', 'Il libro becomes i libri.', 'Use the plural of il.'),
    C('___ case sono qui.', 'The houses are here.', 'Le', ['Le','I','Gli'], 'Le case sono qui.', 'La casa becomes le case.', 'Use the plural of la.'),
    C('___ studenti sono qui.', 'The male students are here.', 'Gli', ['Gli','I','Le'], 'Gli studenti sono qui.', 'Lo studente becomes gli studenti.', 'The singular form was lo studente.'),
    T('___ amiche sono qui.', 'The female friends are here.', 'Le', 'Le amiche sono qui.', 'A feminine plural takes le.', 'Amiche is plural feminine.'),
    C('___ libri sono a casa.', 'The books are at home.', 'I', ['I','Gli','Le'], 'I libri sono a casa.', 'Il libro becomes i libri.', 'Use the plural of il libro.'),
  ], passage: ['At school', 'Gli studenti sono qui. Le amiche di Anna sono qui. I libri sono in casa.', 'The students are here. Anna’s female friends are here. The books are at home.', 'listen'], production: true, related: [['w:libro|noun'],['w:studente|noun']] },
  { id: 'a1-plural-spelling', title: 'Keep a hard sound in the plural', outcome: 'I can write amiche and know that città does not change.', takeaway: 'Amica → amiche keeps hard c before e with h. Città is invariant: one city, two città; the article or number shows plural.', words: [W('amica','female friend','l’','amiche'),W('amiche','female friends'),W('città','city','la','città','The noun form does not change in the plural.')], models: [
    ['A spelling change', 'Amica becomes amiche. The h keeps the hard c sound before e.', 'Un’amica, due amiche.', 'One female friend, two female friends.'],
    ['A noun that stays the same', 'Città stays città; say una città or due città.', 'Una città, due città.', 'One city, two cities.']
  ], questions: [
    C('Anna ha due ___.', 'Anna has two female friends.', 'amiche', ['amiche','amice','amica'], 'Anna ha due amiche.', 'Amica changes -ca to -che.', 'Keep hard c before e with h.'),
    C('Roma e Napoli sono due ___.', 'Rome and Naples are two cities.', 'città', ['città','citte','cittàe'], 'Roma e Napoli sono due città.', 'Città is invariant.', 'The noun does not change after due.'),
    C('Le ___ sono qui.', 'The female friends are here.', 'amiche', ['amiche','amica','amice'], 'Le amiche sono qui.', 'Le signals plural; write amiche with h.', 'Recall amica → amiche.'),
    T('Due ___ sono vicine.', 'Two cities are close together.', 'città', 'Due città sono vicine.', 'Città keeps the same written form in singular and plural.', 'Do not add an ending.'),
  ], passage: ['A visit', 'Le amiche sono di due città: Roma e Napoli.', 'The female friends are from two cities: Rome and Naples.', 'read'], production: true, related: [['w:amico|noun']] },
  { id: 'a1-adjective-agreement', title: 'Match a basic description', outcome: 'I can match piccolo or grande to a familiar noun.', takeaway: 'Piccolo changes for gender and number: piccolo, piccola, piccoli, piccole. Grande is singular for both genders; grandi is plural.', words: [W('piccolo','small (masculine singular)'),W('piccola','small (feminine singular)'),W('piccoli','small (masculine plural)'),W('piccole','small (feminine plural)'),W('grande','big (singular)'),W('grandi','big (plural)')], models: [
    ['Four endings', 'A four-form adjective agrees with its noun: il libro piccolo, la casa piccola, i libri piccoli, le case piccole.', 'La casa è piccola. I libri sono piccoli.', 'The house is small. The books are small.'],
    ['One singular form, one plural form', 'Grande works with either singular gender, and grandi with either plural gender.', 'Il libro è grande. Le case sono grandi.', 'The book is big. The houses are big.']
  ], questions: [
    C('La casa è ___.', 'The house is small.', 'piccola', ['piccola','piccolo','piccole'], 'La casa è piccola.', 'Feminine singular casa takes piccola.', 'Match la casa.'),
    C('I libri sono ___.', 'The books are small.', 'piccoli', ['piccoli','piccole','piccolo'], 'I libri sono piccoli.', 'Masculine plural libri takes piccoli.', 'Match i libri.'),
    C('Le case sono ___.', 'The houses are big.', 'grandi', ['grandi','grande','grandie'], 'Le case sono grandi.', 'Grande changes to grandi in the plural.', 'Le case is plural.'),
    T('Il libro è ___.', 'The book is big.', 'grande', 'Il libro è grande.', 'Grande is the singular form for either gender.', 'Use the singular form.'),
  ], passage: ['A room', 'La casa è piccola. I libri sono grandi. Le case sono grandi.', 'The house is small. The books are big. The houses are big.', 'listen'], portfolio: ['Describe a room', 'Describe one familiar object and two houses using a taught adjective.', 'write', 'Il libro è piccolo. Le case sono grandi.', ['Make the adjective match the noun.','Use an introduced noun and adjective.','Keep singular and plural clear.']], production: true, related: [['w:libro|noun'],['w:casa|noun']] },
]);

addUnit('A1', 5, 'Talk about everyday actions', 'Use -are verbs, questions and negation for familiar routines.', [
  { id: 'a1-are-singular', title: 'Say who speaks or lives somewhere', outcome: 'I can use regular -are verbs with I, you, and one other person.', takeaway: 'For parlare, use parlo, parli, parla. Abitare follows the same endings: abito, abiti, abita. Polite Lei uses the same form as one other person.', words: [W('parlare','to speak'),W('abitare','to live in a place'),W('italiano','Italian'),W('a Roma','in Rome')], models: [
    ['A regular -are pattern', 'Remove -are, then use -o for io, -i for tu, and -a for lui/lei or polite Lei.', 'Io parlo italiano. Tu parli italiano.', 'I speak Italian. You speak Italian.'],
    ['Use the same endings with abitare', 'Abito, abiti and abita have the same person pattern.', 'Anna abita a Roma. Lei abita a Roma?', 'Anna lives in Rome. Do you live in Rome, madam?']
  ], questions: [
    C('Io ___ italiano.', 'I speak Italian.', 'parlo', ['parlo','parli','parla'], 'Io parlo italiano.', 'Io takes -o: parlo.', 'Use the io ending.'),
    C('Tu ___ a Roma?', 'Do you live in Rome? (familiar)', 'abiti', ['abiti','abito','abita'], 'Tu abiti a Roma?', 'Tu takes -i: abiti.', 'This is familiar you.'),
    C('Anna ___ italiano.', 'Anna speaks Italian.', 'parla', ['parla','parlo','parli'], 'Anna parla italiano.', 'One named person takes -a: parla.', 'The subject is Anna.'),
    C('Signora, Lei ___ a Roma?', 'Madam, do you live in Rome?', 'abita', ['abita','abiti','abito'], 'Signora, Lei abita a Roma?', 'Polite Lei takes the -a form.', 'Use the same form as for one other person.'),
    T('Io ___ a Milano.', 'I live in Milan.', 'abito', 'Io abito a Milano.', 'Abitare follows the -are pattern: io abito.', 'Remove -are and add -o.'),
  ], passage: ['Two places', 'Anna: «Io abito a Roma. Tu abiti a Milano?»\nLuca: «No, abito a Napoli.»', 'Anna: “I live in Rome. Do you live in Milan?”\nLuca: “No, I live in Naples.”', 'listen'], production: true, related: [['v:parlare','present'],['v:abitare','present']] },
  { id: 'a1-are-plural', title: 'Talk about a group action', outcome: 'I can use -iamo, -ate and -ano for regular -are verbs.', takeaway: 'Parliamo is we speak, parlate is you all speak, and parlano is they speak. Other regular -are verbs reuse these endings.', words: [W('mangiare','to eat'),W('a casa','at home'),W('noi','we'),W('voi','you all'),W('loro','they')], models: [
    ['Three plural endings', 'For parlare, remove -are and add -iamo, -ate, or -ano for noi, voi, and loro.', 'Noi parliamo. Voi parlate. Loro parlano.', 'We speak. You all speak. They speak.'],
    ['Transfer to another verb', 'Mangiare gives mangiamo, mangiate, mangiano in these three persons.', 'Noi mangiamo a casa.', 'We eat at home.']
  ], questions: [
    C('Noi ___ italiano.', 'We speak Italian.', 'parliamo', ['parliamo','parlate','parlano'], 'Noi parliamo italiano.', 'Noi takes -iamo.', 'Choose the we ending.'),
    C('Voi ___ italiano?', 'Do you all speak Italian?', 'parlate', ['parlate','parliamo','parlano'], 'Voi parlate italiano?', 'Voi takes -ate.', 'Choose the plural-you ending.'),
    C('Anna e Luca ___ a casa.', 'Anna and Luca eat at home.', 'mangiano', ['mangiano','mangiamo','mangiate'], 'Anna e Luca mangiano a casa.', 'Two named people mean loro and take -ano.', 'The subject means they.'),
    T('Noi ___ a casa.', 'We eat at home.', 'mangiamo', 'Noi mangiamo a casa.', 'Mangiare gives noi mangiamo.', 'Use the -iamo ending.'),
  ], passage: ['A shared meal', 'Anna e Luca mangiano a casa. Noi mangiamo a casa domani.', 'Anna and Luca eat at home. We eat at home tomorrow.', 'read'], production: true, related: [['v:parlare','present'],['v:mangiare','present']] },
  { id: 'a1-present-questions', title: 'Ask a simple question', outcome: 'I can ask a yes/no or dove question using a taught present form.', takeaway: 'A yes/no question can keep statement word order and use a question mark and voice contour. Dove asks where; the verb still agrees with its person.', words: [W('dove','where'),W('qui','here'),W('abiti','you live (familiar)'),W('abita','you live (polite)')], models: [
    ['A yes/no question', 'Keep the taught verb form and raise the question in speech or writing.', 'Tu abiti a Roma?', 'Do you live in Rome?'],
    ['Ask where', 'Put dove before the verb. Address a friend with abiti and a polite addressee with abita.', 'Dove abiti, Luca? Dove abita, signora?', 'Where do you live, Luca? Where do you live, madam?']
  ], questions: [
    C('___ abiti, Luca?', 'Where do you live, Luca?', 'Dove', ['Dove','Chi','Non'], 'Dove abiti, Luca?', 'Dove asks for a place.', 'The reply would name a city.'),
    C('Signora, dove ___?', 'Madam, where do you live?', 'abita', ['abita','abiti','abito'], 'Signora, dove abita?', 'A polite addressee takes abita.', 'Use the Lei form already taught.'),
    C('«___» «Sì, abito a Roma.»', 'Ask Luca whether he lives in Rome.', 'Abiti a Roma?', ['Abiti a Roma?','Dove abiti?','Abito a Roma.'], 'Abiti a Roma? Sì, abito a Roma.', 'A yes/no answer fits Abiti a Roma?', 'The reply is sì, not a city name.'),
    O('Where do you live, Luca?', 'Dove abiti, Luca?', ['Luca?','abiti,','Dove'], 'Dove introduces the place question; abiti addresses Luca.', 'Start with dove.'),
  ], passage: ['Finding a friend', 'Anna: «Abiti a Roma, Luca?»\nLuca: «No, abito a Napoli.»\nAnna: «Dove abita Sara?»', 'Anna: “Do you live in Rome, Luca?”\nLuca: “No, I live in Naples.”\nAnna: “Where does Sara live?”', 'listen'], related: [['v:abitare','present']] },
  { id: 'a1-present-negation', title: 'Say what does not happen', outcome: 'I can put non before a known present verb.', takeaway: 'Put non immediately before the conjugated verb: non parlo, non mangiamo. It does not change the verb ending.', words: [W('non','not'),W('parlo','I speak'),W('mangiamo','we eat'),W('oggi','today')], models: [
    ['One small word', 'Place non before the conjugated present verb.', 'Non parlo italiano.', 'I do not speak Italian.'],
    ['The ending stays', 'The person ending remains the same in a negative sentence.', 'Noi non mangiamo a casa oggi.', 'We are not eating at home today.']
  ], questions: [
    C('Io ___ parlo italiano.', 'I do not speak Italian.', 'non', ['non','no','sono'], 'Io non parlo italiano.', 'Non goes immediately before parlo.', 'Place the negative word before the verb.'),
    C('Noi ___ mangiamo a casa.', 'We do not eat at home.', 'non', ['non','no','né'], 'Noi non mangiamo a casa.', 'Non comes before the verb mangiamo.', 'The verb form stays mangiamo.'),
    C('Anna ___ abita a Roma.', 'Anna does not live in Rome.', 'non', ['non','no','nessuno'], 'Anna non abita a Roma.', 'Non precedes abita.', 'Put the negative before the finite verb.'),
    T('Tu ___ parli italiano?', 'Do you not speak Italian? (familiar)', 'non', 'Tu non parli italiano?', 'Non precedes parli even in a question.', 'Keep tu parli and add the negative before parli.'),
  ], passage: ['A change in plans', 'Anna: «Oggi mangiamo a casa?»\nLuca: «No, oggi non mangiamo a casa.»', 'Anna: “Are we eating at home today?”\nLuca: “No, today we are not eating at home.”', 'read'], portfolio: ['A short routine exchange', 'Write one question about where someone lives and one negative answer using a familiar place.', 'write', 'Abiti a Roma? No, non abito a Roma.', ['Ask with a taught verb form.','Place non before the verb.','Use a familiar city.']], production: true, related: [['v:parlare','present']] },
]);

addUnit('A1', 6, 'Expand everyday actions', 'Use regular -ere, -ire and -isc present patterns with useful routines.', [
  { id: 'a1-present-ere', title: 'Use vivere and prendere', outcome: 'I can choose present -ere forms for familiar persons.', takeaway: 'Vivere gives vivo, vivi, vive, viviamo, vivete, vivono. Prendere follows the same person endings with its own stem.', words: [W('vivere','to live'),W('prendere','to take'),W('treno','train','il','treni'),W('vicino','nearby')], models: [
    ['Vivere in the present', 'Remove -ere and use -o, -i, -e for singular persons; -iamo, -ete, -ono for plural persons.', 'Io vivo a Roma. Tu vivi a Milano. Anna vive a Napoli.', 'I live in Rome. You live in Milan. Anna lives in Naples.'],
    ['Another -ere verb', 'Prendere uses the same endings with prend-.', 'Noi prendiamo il treno. Voi prendete il treno.', 'We take the train. You all take the train.']
  ], questions: [
    C('Anna ___ a Roma.', 'Anna lives in Rome.', 'vive', ['vive','vivi','vivo'], 'Anna vive a Roma.', 'One named person takes vive.', 'Use the singular third-person ending.'),
    C('Tu ___ a Milano?', 'Do you live in Milan?', 'vivi', ['vivi','vive','vivo'], 'Tu vivi a Milano?', 'Tu takes vivi.', 'The addressee is familiar you.'),
    C('Voi ___ il treno?', 'Are you all taking the train?', 'prendete', ['prendete','prendiamo','prendono'], 'Voi prendete il treno?', 'Voi takes the -ete ending.', 'This is plural you.'),
    T('Noi ___ il treno.', 'We take the train.', 'prendiamo', 'Noi prendiamo il treno.', 'Prendere gives noi prendiamo.', 'Use the we ending.'),
  ], passage: ['The train', 'Anna vive a Roma. Luca vive a Napoli. Oggi prendono il treno insieme.', 'Anna lives in Rome. Luca lives in Naples. Today they take the train together.', 'listen'], production: true, related: [['v:vivere','present'],['v:prendere','present']] },
  { id: 'a1-present-ire', title: 'Use dormire and partire', outcome: 'I can use ordinary -ire endings with a known verb.', takeaway: 'Dormire gives dormo, dormi, dorme, dormiamo, dormite, dormono. Partire follows the same pattern in these forms.', words: [W('dormire','to sleep'),W('partire','to leave'),W('presto','early'),W('stasera','this evening')], models: [
    ['Ordinary -ire forms', 'Remove -ire and use -o, -i, -e, -iamo, -ite, -ono. Not every -ire verb adds -isc-.', 'Io dormo. Tu dormi. Luca dorme.', 'I sleep. You sleep. Luca sleeps.'],
    ['Leaving', 'Partire follows the same ordinary -ire pattern.', 'Noi partiamo presto. Voi partite stasera.', 'We leave early. You all leave this evening.']
  ], questions: [
    C('Luca ___ adesso.', 'Luca is sleeping now.', 'dorme', ['dorme','dormi','dormo'], 'Luca dorme adesso.', 'One named person takes dorme.', 'Use the he form.'),
    C('Noi ___ presto.', 'We leave early.', 'partiamo', ['partiamo','partite','partono'], 'Noi partiamo presto.', 'Noi takes partiamo.', 'Use the we form.'),
    C('Voi ___ stasera?', 'Are you all leaving this evening?', 'partite', ['partite','partiamo','partono'], 'Voi partite stasera?', 'Voi takes -ite.', 'This is plural you.'),
    T('Io ___ adesso.', 'I am sleeping now.', 'dormo', 'Io dormo adesso.', 'Dormire gives io dormo.', 'Use the I form of the ordinary -ire pattern.'),
  ], passage: ['Tomorrow morning', 'Luca dorme adesso. Domani Anna e Luca partono presto.', 'Luca is sleeping now. Tomorrow Anna and Luca leave early.', 'read'], production: true, related: [['v:dormire','present'],['v:partire','present']] },
  { id: 'a1-present-isc', title: 'Use capire', outcome: 'I can use the taught -isc- forms of capire.', takeaway: 'Capire has capisco, capisci, capisce, capiamo, capite, capiscono. The -isc- part is absent in noi and voi.', words: [W('capire','to understand'),W('domanda','question','la','domande'),W('adesso','now'),W('bene','well')], models: [
    ['The -isc- group', 'Capire adds -isc- in io, tu, lui/lei and loro, but not in noi and voi.', 'Io capisco. Tu capisci. Anna capisce.', 'I understand. You understand. Anna understands.'],
    ['Two forms without -isc-', 'Say noi capiamo and voi capite.', 'Noi capiamo la domanda. Voi capite?', 'We understand the question. Do you all understand?']
  ], questions: [
    C('Io ___ la domanda.', 'I understand the question.', 'capisco', ['capisco','capo','capiamo'], 'Io capisco la domanda.', 'Io uses capisco with -isc-.', 'Use the io form.'),
    C('Noi ___ adesso.', 'We understand now.', 'capiamo', ['capiamo','capisciamo','capiscono'], 'Noi capiamo adesso.', 'Noi is one of the forms without -isc-.', 'Use the we form.'),
    C('Anna e Luca ___ bene.', 'Anna and Luca understand well.', 'capiscono', ['capiscono','capite','capiamo'], 'Anna e Luca capiscono bene.', 'The they form is capiscono.', 'Two named people mean loro.'),
    T('Voi ___ la domanda?', 'Do you all understand the question?', 'capite', 'Voi capite la domanda?', 'Voi uses capite without -isc-.', 'Use the plural-you form.'),
  ], passage: ['A question repeated', 'Anna: «Non capisco la domanda.»\nLuca: «Io capisco la domanda.»', 'Anna: “I do not understand the question.”\nLuca: “I understand the question.”', 'listen'], portfolio: ['Explain a question', 'In a fictional classroom, say who understands a question and who does not.', 'write', 'Anna capisce la domanda. Luca non capisce.', ['Use the correct capire form.','Keep non before the verb when needed.','Use a familiar person or name.']], production: true, related: [['v:capire','present']] },
]);

addUnit('A1', 7, 'Go places and do things', 'Use selected irregular presents and basic place relationships.', [
  { id: 'a1-andare', title: 'Say where you go', outcome: 'I can use selected present forms of andare in a plan.', takeaway: 'Andare is irregular: vado, vai, va, andiamo. Use the form that fits the traveler.', words: [W('andare','to go'),W('vado','I go'),W('vai','you go'),W('va','he/she/polite you goes'),W('andiamo','we go'),W('domani','tomorrow')], models: [
    ['One traveler', 'Say io vado, tu vai, Anna va, or polite Lei va.', 'Io vado a Roma. Tu vai a Milano?', 'I am going to Rome. Are you going to Milan?'],
    ['Together', 'Noi andiamo means we go. The present can also describe a planned trip tomorrow.', 'Domani andiamo a Napoli.', 'Tomorrow we are going to Naples.']
  ], questions: [
    C('Io ___ a Roma.', 'I go to Rome.', 'vado', ['vado','vai','va'], 'Io vado a Roma.', 'Io takes vado.', 'The traveler is I.'),
    C('Tu ___ a Milano?', 'Are you going to Milan?', 'vai', ['vai','vado','va'], 'Tu vai a Milano?', 'Tu takes vai.', 'The traveler is familiar you.'),
    C('Anna ___ a Napoli.', 'Anna is going to Naples.', 'va', ['va','vai','vado'], 'Anna va a Napoli.', 'One named traveler takes va.', 'The traveler is Anna.'),
    C('Noi ___ a Roma domani.', 'We are going to Rome tomorrow.', 'andiamo', ['andiamo','vanno','andate'], 'Noi andiamo a Roma domani.', 'Noi takes andiamo.', 'The travelers are we.'),
    T('Domani noi ___ a Milano.', 'Tomorrow we are going to Milan.', 'andiamo', 'Domani noi andiamo a Milano.', 'The we form is andiamo.', 'Use the form taught for noi.'),
  ], passage: ['A small trip', 'Anna: «Domani vado a Roma.»\nLuca: «Noi andiamo a Napoli.»', 'Anna: “Tomorrow I am going to Rome.”\nLuca: “We are going to Naples.”', 'listen'], production: true, related: [['v:andare','present']] },
  { id: 'a1-fare', title: 'Say what you do or make', outcome: 'I can use selected forms of fare in familiar activities.', takeaway: 'Fare is irregular: faccio, fai, fa, facciamo. Learn these common forms with their person.', words: [W('fare','to do or make'),W('colazione','breakfast','la'),W('torta','cake','la','torte'),W('oggi','today')], models: [
    ['One person acts', 'Say io faccio, tu fai, Anna fa. Fare can mean do or make depending on its object.', 'Io faccio colazione. Anna fa una torta.', 'I have breakfast. Anna makes a cake.'],
    ['We do something', 'The we form is facciamo.', 'Oggi facciamo una torta.', 'Today we are making a cake.']
  ], questions: [
    C('Io ___ colazione.', 'I have breakfast.', 'faccio', ['faccio','fai','fa'], 'Io faccio colazione.', 'The I form is faccio.', 'The subject is io.'),
    C('Tu ___ una torta?', 'Are you making a cake?', 'fai', ['fai','fa','faccio'], 'Tu fai una torta?', 'The familiar-you form is fai.', 'The subject is tu.'),
    C('Anna ___ colazione.', 'Anna has breakfast.', 'fa', ['fa','fai','faccio'], 'Anna fa colazione.', 'One named person takes fa.', 'The subject is Anna.'),
    C('Noi ___ una torta oggi.', 'We are making a cake today.', 'facciamo', ['facciamo','fanno','fate'], 'Noi facciamo una torta oggi.', 'The we form is facciamo.', 'The subject is noi.'),
    T('Oggi noi ___ colazione a casa.', 'Today we have breakfast at home.', 'facciamo', 'Oggi noi facciamo colazione a casa.', 'The we form of fare is facciamo.', 'Use noi facciamo.'),
  ], passage: ['Breakfast', 'Anna fa colazione. Luca fa una torta. Noi facciamo colazione insieme.', 'Anna has breakfast. Luca makes a cake. We have breakfast together.', 'read'], production: true, related: [['v:fare','present']] },
  { id: 'a1-venire', title: 'Say who comes', outcome: 'I can use selected present forms of venire.', takeaway: 'Venire has vengo, vieni, viene, veniamo in these familiar persons. With origin, use da: vengo da Roma.', words: [W('venire','to come'),W('vengo','I come'),W('vieni','you come'),W('viene','he/she/polite you comes'),W('veniamo','we come')], models: [
    ['One person comes', 'Say io vengo, tu vieni, and Anna viene.', 'Io vengo da Roma. Tu vieni da Milano?', 'I come from Rome. Do you come from Milan?'],
    ['We come', 'Noi veniamo is the we form.', 'Noi veniamo da Napoli.', 'We come from Naples.']
  ], questions: [
    C('Io ___ da Roma.', 'I come from Rome.', 'vengo', ['vengo','vieni','viene'], 'Io vengo da Roma.', 'Io takes vengo.', 'The speaker says I.'),
    C('Tu ___ da Milano?', 'Do you come from Milan?', 'vieni', ['vieni','vengo','viene'], 'Tu vieni da Milano?', 'Tu takes vieni.', 'This is familiar you.'),
    C('Anna ___ da Napoli.', 'Anna comes from Naples.', 'viene', ['viene','vieni','vengo'], 'Anna viene da Napoli.', 'One named person takes viene.', 'The subject is Anna.'),
    C('Noi ___ da Roma.', 'We come from Rome.', 'veniamo', ['veniamo','vengono','venite'], 'Noi veniamo da Roma.', 'Noi takes veniamo.', 'The subject is we.'),
    T('Oggi noi ___ da Milano.', 'Today we come from Milan.', 'veniamo', 'Oggi noi veniamo da Milano.', 'The we form of venire is veniamo.', 'Use noi veniamo.'),
  ], passage: ['Where they come from', 'Luca viene da Milano. Anna viene da Napoli. Noi veniamo da Roma.', 'Luca comes from Milan. Anna comes from Naples. We come from Rome.', 'listen'], production: true, related: [['v:venire','present']] },
  { id: 'a1-a-in-places', title: 'Go to a city or country', outcome: 'I can use a with taught cities and in with taught countries.', takeaway: 'Use a with a city: a Roma. Use in with a country: in Italia. Learn destination phrases with the place name.', words: [W('Roma','Rome'),W('Milano','Milan'),W('Italia','Italy'),W('Svizzera','Switzerland')], models: [
    ['Cities', 'Use a before these city names when saying where someone goes.', 'Vado a Roma. Andiamo a Milano.', 'I go to Rome. We go to Milan.'],
    ['Countries', 'Use in before these country names.', 'Vado in Italia. Andiamo in Svizzera.', 'I go to Italy. We go to Switzerland.']
  ], questions: [
    C('Vado ___ Roma.', 'I am going to Rome.', 'a', ['a','in','da'], 'Vado a Roma.', 'Roma is a city and takes a in this destination phrase.', 'The destination is a city.'),
    C('Andiamo ___ Italia.', 'We are going to Italy.', 'in', ['in','a','da'], 'Andiamo in Italia.', 'Italia is a country and takes in.', 'The destination is a country.'),
    C('Anna va ___ Milano.', 'Anna is going to Milan.', 'a', ['a','in','da'], 'Anna va a Milano.', 'Milano is a city.', 'Use the city destination form.'),
    C('Noi andiamo ___ Svizzera.', 'We are going to Switzerland.', 'in', ['in','a','da'], 'Noi andiamo in Svizzera.', 'Svizzera is a country.', 'Use the country destination form.'),
    T('Luca va ___ Napoli.', 'Luca goes to Naples.', 'a', 'Luca va a Napoli.', 'Napoli is a city and uses a here.', 'Choose the preposition used with cities.'),
  ], passage: ['Two travel plans', 'Anna va a Roma. Luca va in Svizzera. Domani andiamo a Milano.', 'Anna goes to Rome. Luca goes to Switzerland. Tomorrow we go to Milan.', 'read'], production: true, related: [['v:andare','present']] },
  { id: 'a1-da-con', title: 'Come from and go with', outcome: 'I can use da for source and con for a companion.', takeaway: 'Vengo da Roma gives a source; vado con Luca names a companion. These answer different questions.', words: [W('da','from'),W('con','with'),W('amica','female friend','l’','amiche'),W('treno','train','il','treni')], models: [
    ['A source', 'Da tells where someone comes from in vengo da + city.', 'Vengo da Napoli.', 'I come from Naples.'],
    ['A companion', 'Con introduces the person going with you.', 'Vado a Roma con Anna.', 'I am going to Rome with Anna.']
  ], questions: [
    C('Vengo ___ Napoli.', 'I come from Naples.', 'da', ['da','a','con'], 'Vengo da Napoli.', 'Da marks the source of the movement.', 'The question is where from.'),
    C('Vado a Roma ___ Luca.', 'I go to Rome with Luca.', 'con', ['con','da','in'], 'Vado a Roma con Luca.', 'Con names a companion.', 'The person travels with you.'),
    C('Anna viene ___ Milano.', 'Anna comes from Milan.', 'da', ['da','con','a'], 'Anna viene da Milano.', 'Da marks origin.', 'Milano is where she comes from.'),
    C('Noi andiamo ___ Sara.', 'We go with Sara.', 'con', ['con','da','a'], 'Noi andiamo con Sara.', 'Con links the travelers and Sara.', 'Sara is a companion.'),
    T('Vado a Napoli ___ Anna.', 'I go to Naples with Anna.', 'con', 'Vado a Napoli con Anna.', 'Con introduces the accompanying person.', 'Who goes with you?'),
  ], passage: ['A trip together', 'Luca viene da Milano. Anna viene da Roma. Oggi vanno a Napoli con Sara.', 'Luca comes from Milan. Anna comes from Rome. Today they go to Naples with Sara.', 'listen'], portfolio: ['Describe a trip', 'Write where a fictional traveler comes from and who goes with them.', 'write', 'Luca viene da Milano. Va a Roma con Anna.', ['Use da for the source.','Use con for the companion.','Use a taught movement verb and city.']], production: true, related: [['v:venire','present'],['v:andare','present']] },
]);

addUnit('A1', 8, 'Find things and places', 'Express what is present and locate familiar people or objects.', [
  { id: 'a1-there-is', title: 'Say what is there', outcome: 'I can choose c’è or ci sono for one or several things.', takeaway: 'C’è goes with one count noun or a mass noun; ci sono goes with plurals. These phrases also keep their form in questions.', words: [W('c’è','there is'),W('ci sono','there are'),W('stazione','station','la','stazioni'),W('libri','books'),W('acqua','water','l’')], models: [
    ['One thing', 'Use c’è before one count noun or an uncountable amount.', 'C’è una stazione qui. C’è acqua.', 'There is a station here. There is water.'],
    ['Several things', 'Use ci sono with a plural noun.', 'Ci sono due libri qui.', 'There are two books here.']
  ], questions: [
    C('___ una stazione qui.', 'There is a station here.', 'C’è', ['C’è','Ci sono','Sono ci'], 'C’è una stazione qui.', 'One station takes c’è.', 'The noun is singular.'),
    C('___ due libri qui.', 'There are two books here.', 'Ci sono', ['Ci sono','C’è','Sono ci'], 'Ci sono due libri qui.', 'Two books take ci sono.', 'The noun is plural.'),
    C('___ acqua?', 'Is there water?', 'C’è', ['C’è','Ci sono','È ci'], 'C’è acqua?', 'Water is treated as a mass noun here and takes c’è.', 'This is not a count plural.'),
    C('___ due stazioni qui?', 'Are there two stations here?', 'Ci sono', ['Ci sono','C’è','Sono ci'], 'Ci sono due stazioni qui?', 'Two stations take ci sono, also in a question.', 'The number two signals plural.'),
    T('___ una casa qui.', 'There is a house here.', 'C’è', 'C’è una casa qui.', 'One house takes c’è.', 'Use the singular existence phrase.'),
  ], passage: ['Near a station', 'C’è una stazione qui. Ci sono due case vicino alla stazione.', 'There is a station here. There are two houses near the station.', 'listen'], production: true, related: [['w:casa|noun']] },
  { id: 'a1-near-far', title: 'Say where a place is', outcome: 'I can say a familiar thing is near or far from a known place.', takeaway: 'Vicino a means near; lontano da means far from. As adjectives, vicino/vicina and lontano/lontana agree with the thing located.', words: [W('vicino a','near (masculine)'),W('vicina a','near (feminine)'),W('lontano da','far from (masculine)'),W('lontana da','far from (feminine)')], models: [
    ['Near a place', 'Use vicino/vicina a. A feminine casa takes vicina.', 'La casa è vicina a Roma.', 'The house is near Rome.'],
    ['Far from a place', 'Use lontano/lontana da. A feminine scuola takes lontana.', 'La scuola è lontana da Milano.', 'The school is far from Milan.']
  ], questions: [
    C('La casa è ___ Roma.', 'The house is near Rome.', 'vicina a', ['vicina a','lontana da','vicino a'], 'La casa è vicina a Roma.', 'Vicina a agrees with casa and says near.', 'The subject is feminine and nearby.'),
    C('La scuola è ___ Milano.', 'The school is far from Milan.', 'lontana da', ['lontana da','vicina a','lontano da'], 'La scuola è lontana da Milano.', 'Lontana da agrees with scuola and says far from.', 'The subject is feminine and far away.'),
    C('Il libro è ___ Luca.', 'The book is near Luca.', 'vicino a', ['vicino a','vicina a','lontano da'], 'Il libro è vicino a Luca.', 'Vicino a agrees with libro and says near.', 'The subject is masculine and nearby.'),
    C('La casa è ___ Napoli.', 'The house is far from Naples.', 'lontana da', ['lontana da','vicina a','lontano da'], 'La casa è lontana da Napoli.', 'Lontana da expresses distance and agrees with casa.', 'The subject is feminine and far away.'),
    T('La scuola è ___ Roma.', 'The school is near Rome.', 'vicina a', 'La scuola è vicina a Roma.', 'Vicina a agrees with scuola and says near.', 'Use the feminine near phrase.'),
  ], passage: ['Two distances', 'La casa è vicina a Roma. La scuola è lontana da Milano.', 'The house is near Rome. The school is far from Milan.', 'read'], production: true, related: [['w:casa|noun'],['w:scuola|noun']] },
  { id: 'a1-a-in-articles', title: 'Join a or in to an article', outcome: 'I can use al/alla and nel/nella with familiar places.', takeaway: 'A + il/la gives al/alla; in + il/la gives nel/nella. Choose the place meaning first, then its article.', words: [W('mercato','market','il','mercati'),W('stazione','station','la','stazioni'),W('frigo','fridge','il','frighi'),W('casa','house','la','case')], models: [
    ['Going to a place', 'Use al for a + il and alla for a + la.', 'Vado al mercato. Vado alla stazione.', 'I go to the market. I go to the station.'],
    ['Inside a place', 'Use nel for in + il and nella for in + la.', 'Il pane è nel frigo. Il libro è nella casa.', 'The bread is in the fridge. The book is in the house.']
  ], questions: [
    C('Vado ___ mercato.', 'I go to the market.', 'al', ['al','alla','nel'], 'Vado al mercato.', 'A + il mercato becomes al mercato.', 'The destination uses a + il.'),
    C('Il pane è ___ frigo.', 'The bread is in the fridge.', 'nel', ['nel','al','nella'], 'Il pane è nel frigo.', 'In + il frigo becomes nel frigo.', 'The bread is inside.'),
    C('Vado ___ stazione.', 'I go to the station.', 'alla', ['alla','al','nella'], 'Vado alla stazione.', 'A + la stazione becomes alla stazione.', 'The destination has feminine article la.'),
    C('Il libro è ___ casa.', 'The book is in the house.', 'nella', ['nella','alla','nel'], 'Il libro è nella casa.', 'In + la casa becomes nella casa.', 'The book is inside the house.'),
    T('Anna va ___ mercato.', 'Anna goes to the market.', 'al', 'Anna va al mercato.', 'A + il mercato becomes al mercato.', 'Use the joined destination form.'),
  ], passage: ['On an errand', 'Anna va al mercato. Luca va alla stazione. Il pane è nel frigo.', 'Anna goes to the market. Luca goes to the station. The bread is in the fridge.', 'listen'], portfolio: ['Locate a familiar item', 'Write where a fictional person goes and where a known item is.', 'write', 'Anna va al mercato. Il pane è nel frigo.', ['Use a joined a + article form for the destination.','Use a joined in + article form for a location.','Choose an introduced place.']], production: true, related: [['w:scuola|noun'],['w:casa|noun']] },
]);

addUnit('A1', 9, 'Say whose and which', 'Identify possessions and choose nearby or more distant things.', [
  { id: 'a1-my-possessives', title: 'Say something is mine', outcome: 'I can match mio/mia/miei/mie to a known noun.', takeaway: 'The thing owned determines the form: il mio libro, la mia casa, i miei libri, le mie case.', words: [W('mio','my (masculine singular)'),W('mia','my (feminine singular)'),W('miei','my (masculine plural)'),W('mie','my (feminine plural)')], models: [
    ['One possession', 'Use il mio with libro and la mia with casa.', 'Il mio libro è qui. La mia casa è vicina.', 'My book is here. My house is nearby.'],
    ['Several possessions', 'Use i miei with libri and le mie with case.', 'I miei libri sono qui. Le mie case sono grandi.', 'My books are here. My houses are big.']
  ], questions: [
    C('Questo è ___ libro.', 'This is my book.', 'il mio', ['il mio','la mia','i miei'], 'Questo è il mio libro.', 'Libro is masculine singular, so use il mio.', 'Match the possessed noun.'),
    C('Questa è ___ casa.', 'This is my house.', 'la mia', ['la mia','il mio','le mie'], 'Questa è la mia casa.', 'Casa is feminine singular, so use la mia.', 'Match the possessed noun.'),
    C('___ libri sono qui.', 'My books are here.', 'I miei', ['I miei','Le mie','Il mio'], 'I miei libri sono qui.', 'Libri is masculine plural.', 'Match the plural masculine noun.'),
    C('___ case sono grandi.', 'My houses are big.', 'Le mie', ['Le mie','I miei','La mia'], 'Le mie case sono grandi.', 'Case is feminine plural.', 'Match the plural feminine noun.'),
    T('Dove sono ___ libri?', 'Where are my books?', 'i miei', 'Dove sono i miei libri?', 'Libri takes i miei.', 'Use masculine plural.'),
  ], passage: ['Looking for books', 'Anna: «Dove sono i miei libri?»\nLuca: «I tuoi libri sono qui.»', 'Anna: “Where are my books?”\nLuca: “Your books are here.”', 'read'], production: true, related: [['w:libro|noun'],['w:casa|noun']] },
  { id: 'a1-family-possessives', title: 'Talk about your family', outcome: 'I can say mia madre and tuo padre without an article.', takeaway: 'With one close family member, normally omit the article: mia madre, tuo padre. Keep the article with an ordinary noun: il mio amico.', words: [W('madre','mother','la','madri'),W('padre','father','il','padri'),W('tuo','your (masculine singular)'),W('tua','your (feminine singular)')], models: [
    ['A close family member', 'Say mia madre and tuo padre, without an article, for one close family member.', 'Mia madre è qui. Tuo padre è a Roma.', 'My mother is here. Your father is in Rome.'],
    ['An ordinary noun', 'Outside this common family pattern, keep the article before the possessive.', 'Il mio amico è qui.', 'My male friend is here.']
  ], questions: [
    C('___ madre è qui.', 'My mother is here.', 'Mia', ['Mia','La mia','Il mio'], 'Mia madre è qui.', 'A singular close family member normally has no article.', 'Say mia madre.'),
    C('___ padre è a Roma.', 'Your father is in Rome.', 'Tuo', ['Tuo','Il tuo','Tua'], 'Tuo padre è a Roma.', 'A singular close family member normally has no article.', 'Use the masculine your form.'),
    C('___ amico è qui.', 'My male friend is here.', 'Il mio', ['Il mio','Mio','La mia'], 'Il mio amico è qui.', 'Amico is not the singular close-family exception.', 'Keep the article.'),
    T('___ madre è di Napoli.', 'Your mother is from Naples.', 'Tua', 'Tua madre è di Napoli.', 'Tua matches feminine madre without an article.', 'Use the feminine your form.'),
  ], passage: ['Family and friends', 'Mia madre è di Roma. Tuo padre è di Napoli. Il mio amico è di Milano.', 'My mother is from Rome. Your father is from Naples. My male friend is from Milan.', 'listen'], production: true, related: [['w:amico|noun']] },
  { id: 'a1-demonstratives', title: 'Point to this or that', outcome: 'I can select questo/questa and quel/quella for familiar things.', takeaway: 'Questo/questa point to something near. Quel/quella identify something farther away or already mentioned; match gender.', words: [W('questo','this (masculine)'),W('questa','this (feminine)'),W('quel','that (masculine before ordinary consonant)'),W('quella','that (feminine)')], models: [
    ['Near the speaker', 'Use questo libro and questa casa for things near you.', 'Questo libro è piccolo. Questa casa è grande.', 'This book is small. This house is big.'],
    ['Farther away', 'Use quel libro and quella casa for things indicated away from you.', 'Quel libro è grande. Quella casa è piccola.', 'That book is big. That house is small.']
  ], questions: [
    C('___ libro qui è mio.', 'This book here is mine.', 'Questo', ['Questo','Questa','Quel'], 'Questo libro qui è mio.', 'Libro is masculine and qui signals near.', 'Choose the near masculine form.'),
    C('___ casa qui è mia.', 'This house here is mine.', 'Questa', ['Questa','Questo','Quella'], 'Questa casa qui è mia.', 'Casa is feminine and qui signals near.', 'Choose the near feminine form.'),
    C('___ libro là è di Luca.', 'That book over there belongs to Luca.', 'Quel', ['Quel','Questo','Quella'], 'Quel libro là è di Luca.', 'Libro is masculine and là points away.', 'Choose the distant masculine form.'),
    T('___ casa là è grande.', 'That house over there is big.', 'Quella', 'Quella casa là è grande.', 'Quella agrees with casa and points away.', 'Use the distant feminine form.'),
  ], passage: ['Two houses', 'Anna: «Questa casa è mia. Quella casa là è di Luca.»', 'Anna: “This house is mine. That house over there belongs to Luca.”', 'read'], portfolio: ['Choose familiar things', 'Describe one nearby item and one more distant item for a fictional shopper.', 'write', 'Questo libro è piccolo. Quella casa là è grande.', ['Use a near and a distant form.','Match noun gender.','Use familiar nouns and adjectives.']], production: true, related: [['w:libro|noun'],['w:casa|noun']] },
]);

addUnit('A1', 10, 'Buy and arrange things', 'Use introduced numbers, prices, times and amounts in a short transaction.', [
  { id: 'a1-numbers-eleven-twenty', title: 'Recognize eleven through twenty', outcome: 'I can read and use selected numbers from eleven to twenty.', takeaway: 'Learn undici through venti in two small groups, then retrieve the words in practical counts.', words: [W('undici','11'),W('dodici','12'),W('tredici','13'),W('quattordici','14'),W('quindici','15'),W('sedici','16'),W('diciassette','17'),W('diciotto','18'),W('diciannove','19'),W('venti','20')], models: [
    ['Eleven to fifteen', 'Hear and read undici, dodici, tredici, quattordici and quindici.', 'Il numero è dodici.', 'The number is twelve.'],
    ['Sixteen to twenty', 'Hear and read sedici, diciassette, diciotto, diciannove and venti.', 'Il numero è venti.', 'The number is twenty.']
  ], questions: [
    M('dodici', '12', ['12','11','20'], 'Il numero è dodici.', 'Dodici means twelve.', 'Recall the first group.'),
    C('Il numero è ___.', 'The shown number is 15.', 'quindici', ['quindici','quattordici','diciotto'], 'Il numero è quindici.', 'Quindici means fifteen.', 'Choose the number word for 15.'),
    M('diciotto', '18', ['18','17','19'], 'Il numero è diciotto.', 'Diciotto means eighteen.', 'Recall the second group.'),
    T('Il numero è ___.', 'The shown number is 20.', 'venti', 'Il numero è venti.', 'Venti means twenty.', 'Write the word for 20.'),
  ], passage: ['A numbered ticket', 'Addetta: «Il numero è quindici.»\nLuca: «Il mio numero è diciotto.»', 'Receptionist: “The number is fifteen.”\nLuca: “My number is eighteen.”', 'listen'], production: true, related: [] },
  { id: 'a1-tens-prices', title: 'Ask and understand a price', outcome: 'I can use introduced tens in a simple euro price.', takeaway: 'Learn trenta, quaranta, cinquanta and cento as price words before using them; quanto costa? asks a price.', words: [W('trenta','30'),W('quaranta','40'),W('cinquanta','50'),W('cento','100'),W('euro','euro'),W('Quanto costa?','How much does it cost?')], models: [
    ['Ask the price', 'Quanto costa? is a useful whole question about one item. Prices use numbers you have learned.', 'Quanto costa il libro? Costa trenta euro.', 'How much is the book? It costs thirty euros.'],
    ['More prices', 'Hear and read quaranta, cinquanta and cento in prices.', 'Lo zaino costa cinquanta euro.', 'The backpack costs fifty euros.']
  ], questions: [
    C('Il libro costa ___ euro.', 'The book costs 30 euros.', 'trenta', ['trenta','quaranta','cinquanta'], 'Il libro costa trenta euro.', 'Trenta means thirty.', 'Choose the price 30.'),
    C('Lo zaino costa ___ euro.', 'The backpack costs 50 euros.', 'cinquanta', ['cinquanta','quaranta','trenta'], 'Lo zaino costa cinquanta euro.', 'Cinquanta means fifty.', 'Choose the price 50.'),
    M('Quanto costa?', 'How much does it cost?', ['How much does it cost?','Where is it?','Who owns it?'], 'Quanto costa?', 'Quanto costa? asks for a price.', 'This is a shop question.'),
    T('La casa costa ___ euro.', 'In this fictional price exercise, the house costs 100 euros.', 'cento', 'La casa costa cento euro.', 'Cento means one hundred.', 'Write the number word for 100.'),
  ], passage: ['At a bookshop', 'Anna: «Quanto costa il libro?»\nCommessa: «Costa venti euro.»\nAnna: «E lo zaino?»\nCommessa: «Cinquanta euro.»', 'Anna: “How much is the book?”\nShop assistant: “It costs twenty euros.”\nAnna: “And the backpack?”\nShop assistant: “Fifty euros.”', 'listen'], production: true, related: [['w:libro|noun']] },
  { id: 'a1-days-clock', title: 'Make a simple appointment', outcome: 'I can use a taught day and alle/all’una with a clock time.', takeaway: 'Say alle otto, alle nove, but all’una. Use a named day to place a routine event.', words: [W('lunedì','Monday'),W('martedì','Tuesday'),W('sabato','Saturday'),W('alle otto','at eight'),W('alle nove','at nine'),W('all’una','at one')], models: [
    ['At eight or nine', 'Use alle before most stated clock hours: alle otto, alle nove.', 'Il treno parte lunedì alle otto.', 'The train leaves Monday at eight.'],
    ['At one', 'Use all’una before one o’clock.', 'Il treno parte sabato all’una.', 'The train leaves Saturday at one.']
  ], questions: [
    C('Il treno parte lunedì ___ otto.', 'The train leaves Monday at eight.', 'alle', ['alle','alla','all’'], 'Il treno parte lunedì alle otto.', 'Use alle with otto.', 'The hour is eight.'),
    C('La lezione inizia sabato ___.', 'The lesson starts Saturday at one.', 'all’una', ['all’una','alle una','alla uno'], 'La lezione inizia sabato all’una.', 'One o’clock uses all’una.', 'The hour is one.'),
    C('Il treno parte ___ alle nove.', 'The train leaves Tuesday at nine.', 'martedì', ['martedì','lunedì','sabato'], 'Il treno parte martedì alle nove.', 'Martedì means Tuesday.', 'Choose the named day.'),
    T('La lezione inizia ___ nove.', 'The lesson starts at nine.', 'alle', 'La lezione inizia alle nove.', 'Use alle before nove.', 'This is a clock hour other than one.'),
  ], passage: ['Two departures', 'Il treno parte lunedì alle otto. La lezione inizia martedì all’una.', 'The train leaves Monday at eight. The lesson starts Tuesday at one.', 'read'], production: true, related: [['w:tempo|noun']] },
  { id: 'a1-many-few', title: 'Say many or few', outcome: 'I can match molto/poco to familiar count and mass nouns.', takeaway: 'With count nouns, molto/poco agree: molti libri, poche case. With water, use singular molta acqua or poca acqua.', words: [W('molti','many (masculine plural)'),W('molte','many (feminine plural)'),W('pochi','few (masculine plural)'),W('poche','few (feminine plural)'),W('molta acqua','a lot of water'),W('poca acqua','little water')], models: [
    ['Counted things', 'Use plural forms with counted nouns: molti libri, poche case.', 'Ho molti libri. Anna ha poche case.', 'I have many books. Anna has few houses.'],
    ['Water as an amount', 'Acqua is a mass noun here. Use a singular feminine amount word.', 'C’è molta acqua. C’è poca acqua.', 'There is a lot of water. There is little water.']
  ], questions: [
    C('Ho ___ libri.', 'I have many books.', 'molti', ['molti','molte','molta'], 'Ho molti libri.', 'Libri is masculine plural, so use molti.', 'Match the count noun.'),
    C('Anna ha ___ case.', 'Anna has few houses.', 'poche', ['poche','pochi','poca'], 'Anna ha poche case.', 'Case is feminine plural, so use poche.', 'Match the count noun.'),
    C('C’è ___ acqua.', 'There is a lot of water.', 'molta', ['molta','molte','molti'], 'C’è molta acqua.', 'Acqua takes singular feminine molta here.', 'Treat water as an amount.'),
    T('C’è ___ acqua.', 'There is little water.', 'poca', 'C’è poca acqua.', 'Acqua takes singular feminine poca.', 'Use the little-amount word.'),
  ], passage: ['At the table', 'Ci sono molti libri, ma c’è poca acqua. Anna porta molta acqua.', 'There are many books, but there is little water. Anna brings a lot of water.', 'listen'], portfolio: ['Plan a simple shop trip', 'Write one price or time and one statement about the amount of a familiar item.', 'write', 'Il libro costa venti euro. Ho pochi libri.', ['Use a number or time already introduced.','Choose a quantity form that matches its noun.','Keep the Italian message short and clear.']], production: true, related: [['w:libro|noun']] },
]);

addUnit('A1', 11, 'Ask, respond and express preferences', 'Make familiar requests, say what you want, and give a brief reason.', [
  { id: 'a1-potere-requests', title: 'Ask if you can do something', outcome: 'I can use posso, puoi and polite può before an infinitive.', takeaway: 'Posso asks what I may do; puoi addresses a familiar person; può addresses one person politely as Lei.', words: [W('potere','can / may'),W('posso','I can'),W('puoi','you can (familiar)'),W('può','you can (polite)'),W('entrare','to enter'),W('aprire','to open')], models: [
    ['May I?', 'Put an infinitive after posso.', 'Posso entrare?', 'May I come in?'],
    ['Ask someone else', 'Use puoi for a familiar person and può for polite Lei.', 'Puoi aprire la porta? Signora, può aprire la porta?', 'Can you open the door? Madam, can you open the door?']
  ], questions: [
    C('___ entrare?', 'May I come in?', 'Posso', ['Posso','Puoi','Può'], 'Posso entrare?', 'Posso is the I form.', 'The speaker asks about their own action.'),
    C('Luca, ___ aprire la porta?', 'Luca, can you open the door?', 'puoi', ['puoi','posso','può'], 'Luca, puoi aprire la porta?', 'A familiar Luca takes puoi.', 'Address a familiar person.'),
    C('Signora, ___ entrare?', 'Madam, may you come in?', 'può', ['può','puoi','posso'], 'Signora, può entrare?', 'Polite Lei uses può.', 'This is a formal addressee.'),
    T('___ aprire la porta?', 'May I open the door?', 'Posso', 'Posso aprire la porta?', 'Use posso for the speaker.', 'Ask permission for yourself.'),
  ], passage: ['At a door', 'Anna: «Posso entrare?»\nLuca: «Sì. Puoi aprire la porta.»', 'Anna: “May I come in?”\nLuca: “Yes. You can open the door.”', 'listen'], production: true, related: [['v:potere','present']] },
  { id: 'a1-want-need', title: 'Say what you want or need to do', outcome: 'I can use voglio and devo with a known infinitive.', takeaway: 'Voglio + infinitive says what I want to do; devo + infinitive says what I need to do. Vuoi asks a familiar person about a wish.', words: [W('voglio','I want'),W('vuoi','you want (familiar)'),W('devo','I need to / must'),W('comprare','to buy'),W('chiamare','to call')], models: [
    ['Want to act', 'Use voglio or vuoi before the unchanged infinitive.', 'Voglio comprare il pane. Vuoi comprare il pane?', 'I want to buy bread. Do you want to buy bread?'],
    ['Need to act', 'Use devo before the infinitive for something necessary.', 'Devo chiamare Anna.', 'I need to call Anna.']
  ], questions: [
    C('Io ___ comprare il pane.', 'I want to buy bread.', 'voglio', ['voglio','vuoi','devo'], 'Io voglio comprare il pane.', 'Voglio expresses my wish.', 'This is a desire, not a need.'),
    C('Tu ___ comprare il pane?', 'Do you want to buy bread?', 'vuoi', ['vuoi','voglio','devo'], 'Tu vuoi comprare il pane?', 'Tu takes vuoi.', 'The addressee is familiar you.'),
    C('Io ___ chiamare Anna oggi.', 'I need to call Anna today.', 'devo', ['devo','voglio','vuoi'], 'Io devo chiamare Anna oggi.', 'Devo expresses a need.', 'The speaker says this is necessary.'),
    T('Io ___ comprare un libro.', 'I need to buy a book.', 'devo', 'Io devo comprare un libro.', 'Devo + infinitive expresses necessity.', 'Use the I need form.'),
  ], passage: ['Two errands', 'Anna: «Devo comprare il pane.»\nLuca: «Io voglio comprare un libro.»', 'Anna: “I need to buy bread.”\nLuca: “I want to buy a book.”', 'read'], production: true, related: [['v:volere','present'],['v:dovere','present']] },
  { id: 'a1-piacere', title: 'Say what you like', outcome: 'I can choose mi piace or mi piacciono for a known thing.', takeaway: 'Mi piace goes with one thing or an infinitive; mi piacciono goes with several things. The liked thing controls the verb.', words: [W('mi piace','I like (one thing or action)'),W('mi piacciono','I like (several things)'),W('pizza','pizza','la','pizze'),W('libri','books')], models: [
    ['One thing or action', 'Use mi piace before a singular thing or a verb in the infinitive.', 'Mi piace la pizza. Mi piace leggere.', 'I like pizza. I like reading.'],
    ['Several things', 'Use mi piacciono before plural things.', 'Mi piacciono i libri.', 'I like the books.']
  ], questions: [
    C('Mi ___ la pizza.', 'I like pizza.', 'piace', ['piace','piacciono','piaci'], 'Mi piace la pizza.', 'Singular pizza takes piace.', 'The liked thing is one singular noun.'),
    C('Mi ___ i libri.', 'I like the books.', 'piacciono', ['piacciono','piace','piacete'], 'Mi piacciono i libri.', 'Plural libri takes piacciono.', 'The liked things are plural.'),
    C('Mi ___ leggere.', 'I like reading.', 'piace', ['piace','piacciono','piaci'], 'Mi piace leggere.', 'An infinitive as liked activity takes piace.', 'The liked activity is one action.'),
    T('Mi ___ le case piccole.', 'I like the small houses.', 'piacciono', 'Mi piacciono le case piccole.', 'Plural case takes piacciono.', 'The liked things are several houses.'),
  ], passage: ['At lunch', 'Anna: «Mi piace la pizza.»\nLuca: «A me piacciono i libri e la pizza.»', 'Anna: “I like pizza.”\nLuca: “I like books and pizza.”', 'listen'], production: true, related: [['v:piacere','present']] },
  { id: 'a1-familiar-commands', title: 'Ask a familiar person to act', outcome: 'I can use a taught tu command and its negative.', takeaway: 'Parla, prendi and dormi are familiar tu commands. To tell someone not to act, use non + infinitive: non parlare.', words: [W('parla','speak!'),W('prendi','take!'),W('dormi','sleep!'),W('non parlare','do not speak!'),W('non prendere','do not take!')], models: [
    ['A positive tu command', 'Speak to one familiar person: Parla, Prendi, Dormi.', 'Prendi il libro, per favore.', 'Take the book, please.'],
    ['A negative tu command', 'For a familiar one-person negative command, put non before the infinitive.', 'Non prendere il libro.', 'Do not take the book.']
  ], questions: [
    C('___ il libro, per favore.', 'Take the book, please. (familiar one-person command)', 'Prendi', ['Prendi','Prende','Prendere'], 'Prendi il libro, per favore.', 'Prendi is the taught tu command.', 'The request is positive and familiar.'),
    C('___ adesso, Luca.', 'Speak now, Luca. (familiar command)', 'Parla', ['Parla','Parli','Parlare'], 'Parla adesso, Luca.', 'Parla is the taught positive tu command.', 'Address Luca familiarly.'),
    C('Luca, ___ il libro.', 'Luca, do not take the book.', 'non prendere', ['non prendere','non prendi','prendi'], 'Luca, non prendere il libro.', 'Negative tu uses non + infinitive.', 'This tells Luca not to act.'),
    T('Anna, ___ adesso.', 'Anna, do not speak now. (familiar)', 'non parlare', 'Anna, non parlare adesso.', 'Negative tu uses non parlare.', 'Put non before the infinitive.'),
  ], passage: ['A short instruction', 'Anna: «Luca, prendi il libro, per favore.»\nLuca: «Questo libro?»\nAnna: «No, non prendere quel libro.»', 'Anna: “Luca, take the book, please.”\nLuca: “This book?”\nAnna: “No, do not take that book.”', 'read'], production: true, related: [['v:prendere','present'],['v:parlare','present']] },
  { id: 'a1-basic-links', title: 'Join a simple reason', outcome: 'I can distinguish e, ma and perché in a short statement.', takeaway: 'E adds a fact, ma contrasts one, and perché gives a reason. Choose the relation the speaker means.', words: [W('e','and'),W('ma','but'),W('perché','because'),W('piove','it is raining'),W('resto','I stay')], models: [
    ['Add and contrast', 'Use e to add a compatible fact; use ma to contrast one.', 'Ho un libro e uno zaino. Ho fame, ma non mangio.', 'I have a book and a backpack. I am hungry, but I am not eating.'],
    ['Give a reason', 'Use perché before the reason.', 'Resto a casa perché piove.', 'I am staying home because it is raining.']
  ], questions: [
    C('Ho un libro ___ uno zaino.', 'I have a book and a backpack.', 'e', ['e','ma','perché'], 'Ho un libro e uno zaino.', 'E adds another possession.', 'Both facts go together.'),
    C('Ho fame, ___ non mangio.', 'I am hungry, but I am not eating.', 'ma', ['ma','e','perché'], 'Ho fame, ma non mangio.', 'Ma marks a contrast.', 'The second fact goes against expectation.'),
    C('Resto a casa ___ piove.', 'I stay home because it is raining.', 'perché', ['perché','ma','e'], 'Resto a casa perché piove.', 'Perché introduces the reason.', 'The rain explains the choice.'),
    T('Vado a casa ___ ho fame.', 'I go home because I am hungry.', 'perché', 'Vado a casa perché ho fame.', 'Perché gives the reason for going home.', 'The second clause explains why.'),
  ], passage: ['A simple plan', 'Anna: «Ho fame, ma il pane è a casa.»\nLuca: «Andiamo a casa perché abbiamo fame.»', 'Anna: “I am hungry, but the bread is at home.”\nLuca: “We are going home because we are hungry.”', 'listen'], portfolio: ['Explain a choice', 'Write two short sentences: add or contrast one fact, then give a simple reason.', 'write', 'Ho fame, ma non mangio. Vado a casa perché ho sete.', ['Use e or ma for the intended relation.','Use perché before a reason.','Keep the vocabulary familiar.']], production: true, related: [] },
]);

addUnit('A1', 12, 'Describe a first completed event', 'Report a small completed event with taught auxiliaries and participles.', [
  { id: 'a1-past-are', title: 'Say what you did yesterday', outcome: 'I can use avere plus a regular -ato participle for a completed act.', takeaway: 'Ieri ho parlato and ieri ho mangiato describe finished events. Put a form of avere before the participle.', words: [W('ieri','yesterday'),W('parlato','spoken'),W('mangiato','eaten'),W('comprato','bought')], models: [
    ['A finished event', 'For these -are verbs, replace -are with -ato. Use ho, hai or ha before the participle.', 'Ieri ho mangiato a casa. Anna ha comprato il pane.', 'Yesterday I ate at home. Anna bought bread.']
  ], questions: [
    C('Ieri io ___ a casa.', 'Yesterday I ate at home.', 'ho mangiato', ['ho mangiato','sono mangiato','mangio'], 'Ieri io ho mangiato a casa.', 'Mangiare takes avere here; io ho + mangiato.', 'A completed eating event needs the taught past form.'),
    C('Ieri Anna ___ il pane.', 'Yesterday Anna bought bread.', 'ha comprato', ['ha comprato','è comprata','compra'], 'Ieri Anna ha comprato il pane.', 'Anna ha + comprato reports a finished purchase.', 'Use her auxiliary and -ato.'),
    C('Ieri tu ___ con Luca.', 'Yesterday you spoke with Luca.', 'hai parlato', ['hai parlato','sei parlato','parli'], 'Ieri tu hai parlato con Luca.', 'Tu hai + parlato reports a finished conversation.', 'Use the familiar-you auxiliary.'),
    T('Ieri io ___ il pane.', 'Yesterday I bought bread.', 'ho comprato', 'Ieri io ho comprato il pane.', 'Io ho + comprato is a completed purchase.', 'Use ho and the -ato form.'),
  ], passage: ['Yesterday', 'Ieri Anna ha comprato il pane. Luca ha mangiato a casa.', 'Yesterday Anna bought bread. Luca ate at home.', 'read'], production: true, related: [['v:mangiare','past'],['v:avere','past']] },
  { id: 'a1-past-ere-ire', title: 'Finish another kind of verb', outcome: 'I can use the taught -uto and -ito participles with avere.', takeaway: 'For selected regular verbs, ricevere → ricevuto and dormire → dormito. Learn the actual participle with its verb before using it.', words: [W('ricevere','to receive'),W('ricevuto','received'),W('dormire','to sleep'),W('dormito','slept'),W('messaggio','message','il','messaggi')], models: [
    ['An -ere participle', 'Ricevere becomes ricevuto. Use the appropriate avere form first.', 'Anna ha ricevuto un messaggio.', 'Anna received a message.'],
    ['An -ire participle', 'Dormire becomes dormito.', 'Ieri Luca ha dormito.', 'Yesterday Luca slept.']
  ], questions: [
    C('Anna ___ un messaggio.', 'Anna received a message.', 'ha ricevuto', ['ha ricevuto','è ricevuta','riceve'], 'Anna ha ricevuto un messaggio.', 'Ricevere uses ricevuto after ha.', 'Use the taught -uto participle.'),
    C('Ieri Luca ___.', 'Yesterday Luca slept.', 'ha dormito', ['ha dormito','è dormito','dorme'], 'Ieri Luca ha dormito.', 'Dormire uses dormito after ha.', 'Use the taught -ito participle.'),
    C('Io ___ un messaggio ieri.', 'I received a message yesterday.', 'ho ricevuto', ['ho ricevuto','sono ricevuto','ricevo'], 'Io ho ricevuto un messaggio ieri.', 'The speaker uses ho + ricevuto.', 'Use the I auxiliary.'),
    T('Tu ___ ieri?', 'Did you sleep yesterday?', 'hai dormito', 'Tu hai dormito ieri?', 'Familiar tu uses hai + dormito.', 'Use the you auxiliary with dormito.'),
  ], passage: ['A short message', 'Anna: «Ieri ho ricevuto un messaggio.»\nLuca: «Io ho dormito molto.»', 'Anna: “Yesterday I received a message.”\nLuca: “I slept a lot.”', 'listen'], production: true, related: [['v:dormire','past'],['v:avere','past']] },
  { id: 'a1-past-essere', title: 'Say you went or arrived', outcome: 'I can use selected essere past forms with stated subject agreement.', takeaway: 'Andare and arrivare take essere in these completed events. The participle matches the person: Anna è andata, Luca è arrivato.', words: [W('andato','gone (masculine)'),W('andata','gone (feminine)'),W('arrivato','arrived (masculine)'),W('arrivata','arrived (feminine)')], models: [
    ['A completed trip', 'Use essere with andare: Luca è andato, Anna è andata.', 'Luca è andato a Roma. Anna è andata a Milano.', 'Luca went to Rome. Anna went to Milan.'],
    ['An arrival', 'Arrivare also takes essere here. Match -o/-a to the named person.', 'Luca è arrivato. Anna è arrivata.', 'Luca arrived. Anna arrived.']
  ], questions: [
    C('Ieri Anna ___ a Roma.', 'Yesterday Anna went to Rome.', 'è andata', ['è andata','ha andato','è andato'], 'Ieri Anna è andata a Roma.', 'Andare takes essere; Anna takes feminine andata.', 'Use the female named traveler.'),
    C('Ieri Luca ___ a Milano.', 'Yesterday Luca went to Milan.', 'è andato', ['è andato','ha andato','è andata'], 'Ieri Luca è andato a Milano.', 'Andare takes essere; Luca takes masculine andato.', 'Use the male named traveler.'),
    C('Anna ___ ieri.', 'Anna arrived yesterday.', 'è arrivata', ['è arrivata','ha arrivato','è arrivato'], 'Anna è arrivata ieri.', 'Arrivare takes essere; Anna takes arrived feminine.', 'Use the named female subject.'),
    T('Luca ___ ieri.', 'Luca arrived yesterday.', 'è arrivato', 'Luca è arrivato ieri.', 'Luca takes è arrivato.', 'Use essere and masculine agreement.'),
  ], passage: ['Two arrivals', 'Anna è arrivata a Roma ieri. Luca è arrivato oggi.', 'Anna arrived in Rome yesterday. Luca arrived today.', 'read'], production: true, related: [['v:andare','past']] },
  { id: 'a1-first-past-message', title: 'Send a short note about yesterday', outcome: 'I can choose a taught completed form in a simple message.', takeaway: 'A message about a finished event uses a modeled passato prossimo form with the correct auxiliary and person; a time word helps but the finished meaning decides.', words: [W('ieri','yesterday'),W('oggi','today'),W('messaggio','message','il','messaggi'),W('arrivata','arrived (female)')], models: [
    ['A useful two-line note', 'Use one finished action you have learned, then say where or when it happened.', 'Ieri ho comprato il pane. Anna è arrivata a Roma.', 'Yesterday I bought bread. Anna arrived in Rome.']
  ], questions: [
    C('Ieri io ___ il pane.', 'Yesterday I bought bread.', 'ho comprato', ['ho comprato','è comprato','compro'], 'Ieri io ho comprato il pane.', 'The speaker uses ho comprato for a completed purchase.', 'Use the learned completed form.'),
    C('Ieri Anna ___ a Roma.', 'Yesterday Anna arrived in Rome.', 'è arrivata', ['è arrivata','ha arrivato','è arrivato'], 'Ieri Anna è arrivata a Roma.', 'Arrivare takes essere and Anna takes -a.', 'Use the female arrival form.'),
    C('Ieri Luca ___ a casa.', 'Yesterday Luca ate at home.', 'ha mangiato', ['ha mangiato','è mangiato','mangia'], 'Ieri Luca ha mangiato a casa.', 'Luca takes ha + mangiato for finished eating.', 'Use the taught avere past.'),
    O('Yesterday Anna bought bread.', 'Ieri Anna ha comprato il pane.', ['pane.','il','comprato','ha','Anna','Ieri'], 'Keep the subject and its auxiliary together before the participle.', 'Start with Ieri Anna.'),
  ], passage: ['A note after a trip', 'Ieri sono andata a Roma. Ho comprato il pane. Luca è arrivato oggi.', 'Yesterday I, a woman, went to Rome. I bought bread. Luca arrived today.', 'listen'], portfolio: ['Write a short past note', 'Write two sentences about fictional completed events using only taught verbs and stated people.', 'write', 'Ieri Anna è arrivata a Roma. Luca ha comprato il pane.', ['Use a completed event form.','Choose the correct auxiliary.','Make the essere participle agree with the named person.']], production: false, related: [['v:mangiare','past'],['v:andare','past']] },
]);

// A2 records specify their own situations and feedback. The two fresh reserves
// let a learner recover a late choice or productive error within the lesson.
const Q = (it, en, answer, options, why, hint) => C(it,en,answer,options,it.replace('___',answer),why,hint);
const Y = (it, en, answer, why, hint) => T(it,en,answer,it.replace('___',answer),why,hint);
const AL = (id,title,outcome,takeaway,words,models,checks,passage,legacyLessonIds=[],facet=id) => ({
  id,title,outcome,takeaway,words:words.map(w=>Array.isArray(w)?W(...w):W(w,w)),models,
  questions:checks.slice(0,4),reserves:checks.slice(4).map((q,i)=>[Array.isArray(facet)?facet[i%facet.length]:facet,q]),
  passage,legacyLessonIds,production:checks.some(q=>q.format==='type'),facet,
});
facetPlan['a2-auxiliary-choice']=[['avere-action','essere-movement'],['avere-action','avere-action','essere-movement','essere-movement']];
const X2 = (pairs,speak,why,hint) => ({...X(pairs.map(([left,right])=>({left,right})),why,hint,speak),prompt:'Match each known Italian cue to the expression it calls for.'});
Object.assign(portfolioPlan, {
  'a2-reflexive-evening':['Describe a day','Write four short sentences about a fictional person’s morning and evening routine.','write','Anna si alza alle sette. Si lava la mattina. Io mi alzo alle otto. Mi lavo la sera.',['Use mi/si with stated subjects.','Keep present reflexive forms consistent.','Use words learned in this unit.']],
  'a2-short-story':['Tell a past afternoon','Record or write a three-sentence fictional story: one background state and two finished events.','speak','Anna era a casa. Aveva fame. Poi ha mangiato.',['Set the scene in imperfect.','Use a completed form for the event.','Keep time and subject clear.']],
  'a2-pronoun-placement':['Leave a short message','Write a short message using a stated object and then its direct pronoun.','write','Ho il libro. Lo posso leggere oggi. Posso leggerlo anche domani.',['Name the referent first.','Use the correct direct pronoun.','Place it before the modal or attach it correctly.']],
  'a2-formal-request':['Ask a stranger and a friend','Practise one polite request to a stranger and a familiar request to a friend.','interact','Signora, potrebbe ripetere? Luca, puoi ripetere?',['Keep Lei and tu roles distinct.','Use the matching form in each request.','Add a courtesy expression where natural.'],'Buongiorno. Non ho capito.'],
  'a2-real-if':['Plan around the weather','Write two short real possibilities and their results for a fictional afternoon.','write','Se piove, resto a casa. Se non piove, andrò al museo.',['Use se plus present for the possible condition.','Use a present or taught future result.','Keep the two outcomes coherent.']],
  'a2-past-auxiliary-person':['Send a note about yesterday','Write two short completed events about fictional people using a known avere verb.','write','Ieri Anna ha visto Luca. Noi abbiamo visitato il museo.',['Name each subject.','Use its matching form of avere.','Keep the participle of the chosen verb.']],
  'a2-auxiliary-choice':['Retell a small trip','Write two connected sentences: one finished action and one completed movement.','write','Anna ha comprato il pane. Poi è andata a casa.',['Use avere for the finished purchase.','Use essere for the movement.','Match the participle to Anna.']],
  'a2-imperfect-states':['Set a past scene','Describe a fictional person’s past place and condition in two short sentences.','write','Luca era a casa. Aveva fame.',['Use imperfect for the background.','Keep the person clear.','Choose essere or avere for the state.']],
  'a2-progressive-past':['Tell what was happening','Say or write one action in progress when a second event happened.','speak','Anna stava leggendo quando Luca ha chiamato.',['Use stare plus gerund for the action underway.','Use a completed form for the second event.','Keep both actors clear.']],
  'a2-direct-reference':['Keep the object clear','Write two short exchanges that name an object and then replace it with a direct pronoun.','write','Il libro? Lo leggo oggi. La lettera? La leggo domani.',['Name each object first.','Choose a pronoun matching its gender and number.','Place the pronoun before the finite verb.']],
  'a2-near-plan':['Share two plans','Write one fixed near plan and one longer-term intention using the taught forms.','write','Domani prendo il treno per Roma. Un giorno andrò a Napoli.',['Use present for the arranged plan.','Use future for the longer-term intention.','Give a time cue for each.']],
  'a2-quantity':['Make a small shopping request','Practise a request with two different taught quantities and familiar items.','interact','Vorrei qualche libro e un po’ di pane, per favore.',['Use qualche with a singular-form count noun.','Use un po’ di with bread.','Keep the request polite.'],'Buongiorno. Che cosa desidera?'],
  'a2-negative-commands':['Give two clear instructions','Write one negative instruction to a friend and one to a polite stranger.','write','Luca, non parlare adesso. Signora, non parli adesso, per favore.',['Distinguish familiar tu from polite Lei.','Use the correct negative form in each line.','Keep the addressee explicit.']],
  'a2-preposition-contractions':['Describe a short visit','Write two sentences about where a fictional person goes and where a book is.','write','Anna va al museo. Il libro è sul tavolo.',['Use al for a destination.','Use sul for a surface.','Keep the noun and article combination natural.']],
});

addUnit('A2', 1, 'Describe a daily routine', 'Use a small reflexive pattern in ordinary routines.', [
  AL('a2-reflexive-me-you','Talk about my and your routine','I can use mi and ti with alzarsi.','Use mi alzo for me and ti alzi for familiar you. Keep the pronoun before the finite verb.',
    [['alzarsi','to get up'],['mi alzo','I get up'],['ti alzi','you get up'],['presto','early'],['tardi','late']],
    [['My routine','The subject and reflexive pronoun stay together.','Io mi alzo presto.','I get up early.'],['Your routine','For familiar you, use tu ti alzi.','Tu ti alzi tardi?','Do you get up late?']],
    [X2([['io','mi alzo'],['tu','ti alzi']],'Io mi alzo presto. Tu ti alzi tardi?','Match each known subject with its reflexive form.','Choose the pronoun that refers back to the subject.'),Q('Tu ___ tardi?','Do you get up late?','ti alzi',['ti alzi','mi alzo','si alza'],'Tu takes ti alzi.','Address one familiar person.'),Q('Io ___ alle sette.','I get up at seven.','mi alzo',['mi alzo','si alza','ti alzi'],'The I form is mi alzo.','The speaker is the subject.'),Y('Tu ___ alle otto?','Do you get up at eight?','ti alzi','Use ti alzi with tu.','Write the pronoun and verb together.'),Q('Io ___ tardi la domenica.','I get up late on Sunday.','mi alzo',['mi alzo','ti alzi','si alza'],'The day does not change the I form.','Use mi for myself.'),Y('Tu ___ presto oggi?','Do you get up early today?','ti alzi','The familiar-you reflexive is ti alzi.','Include both ti and alzi.')],
    ['Morning at home','Io mi alzo alle sette. Tu ti alzi alle otto?','I get up at seven. Do you get up at eight?','listen'],['a2-reflexive-present']),
  AL('a2-reflexive-he-we','Describe someone else’s routine','I can use si or ci with alzarsi.','Luca si alza, while noi ci alziamo. The pronoun and verb both change with the subject.',
    [['si alza','he or she gets up'],['ci alziamo','we get up'],['insieme','together']],
    [['One person','A named singular person takes si alza.','Luca si alza presto.','Luca gets up early.'],['A group including me','Noi takes ci alziamo.','Noi ci alziamo insieme.','We get up together.']],
    [Q('Luca ___ presto.','Luca gets up early.','si alza',['si alza','ci alziamo','mi alzo'],'A singular third person takes si alza.','Luca is one other person.'),Q('Noi ___ alle sette.','We get up at seven.','ci alziamo',['ci alziamo','si alza','ti alzi'],'Noi takes ci alziamo.','The subject means we.'),Q('Anna ___ tardi.','Anna gets up late.','si alza',['si alza','mi alzo','ci alziamo'],'Anna is a singular third person.','Use si for Anna.'),Y('Noi ___ presto.','We get up early.','ci alziamo','The we form is ci alziamo.','Use ci before alziamo.'),Q('Luca ___ alle otto?','Does Luca get up at eight?','si alza',['si alza','ti alzi','ci alziamo'],'The question still has Luca as its subject.','Use the third-person form.'),Y('Noi ___ tardi oggi.','We get up late today.','ci alziamo','Noi ci alziamo states our routine.','Write both words.')],
    ['A shared morning','Anna si alza presto. Noi ci alziamo alle otto.','Anna gets up early. We get up at eight.','read'],['a2-reflexive-present']),
  AL('a2-reflexive-evening','Describe washing in a routine','I can use mi lavo, ti lavi and si lava with a stated person.','Lavarsi follows the same present pattern as alzarsi: mi lavo, ti lavi, si lava.',
    [['lavarsi','to wash oneself'],['mi lavo','I wash'],['ti lavi','you wash'],['si lava','he or she washes'],['prima','before']],
    [['My action','The action returns to the speaker.','Mi lavo prima di dormire.','I wash before sleeping.'],['Another person','Use si with a named person.','Anna si lava la mattina.','Anna washes in the morning.']],
    [Q('Io ___ la mattina.','I wash in the morning.','mi lavo',['mi lavo','ti lavi','si lava'],'The speaker uses mi lavo.','The subject is I.'),Q('Anna ___ la mattina.','Anna washes in the morning.','si lava',['si lava','mi lavo','ti lavi'],'Anna takes si lava.','The subject is another person.'),Q('Tu ___ la sera?','Do you wash in the evening?','ti lavi',['ti lavi','si lava','mi lavo'],'Tu takes ti lavi.','Address one familiar person.'),Y('Io ___ prima di dormire.','I wash before sleeping.','mi lavo','Mi lavo is the I form.','Write both parts.'),Q('Luca ___ presto.','Luca washes early.','si lava',['si lava','ti lavi','mi lavo'],'Luca takes si lava.','Luca is the subject.'),Y('Tu ___ la mattina?','Do you wash in the morning?','ti lavi','The familiar-you form is ti lavi.','Write pronoun and verb.')],
    ['Before bed','Luca si lava la sera. Io mi lavo prima di dormire.','Luca washes in the evening. I wash before sleeping.','listen'],['a2-reflexive-present']),
]);

addUnit('A2', 2, 'Report more completed events', 'Broaden familiar avere past forms through selected verbs.', [
  AL('a2-past-regular','Report a finished visit','I can use a modeled regular participle with avere.','A completed visit uses ho/hai/ha + visitato. The already learned ricevere and dormire use ricevuto and dormito.',
    [['visitare','to visit'],['visitato','visited'],['museo','museum','il','musei'],['ricevuto','received'],['dormito','slept']],
    [['A visit','Visitare has the regular participle visitato after avere.','Ieri ho visitato il museo.','Yesterday I visited the museum.'],['Other endings','Learn ricevuto and dormito with their own verbs.','Anna ha ricevuto un messaggio.','Anna received a message.']],
    [Q('Ieri io ___ il museo.','Yesterday I visited the museum.','ho visitato',['ho visitato','sono visitato','ho visitare'],'Avere plus visitato reports a completed visit.','The visitor is I.'),Q('Anna ___ il museo.','Anna visited the museum.','ha visitato',['ha visitato','è visitata','ha visita'],'Anna takes ha visitato.','Use her auxiliary and participle.'),Q('Io ___ un messaggio.','I received a message.','ho ricevuto',['ho ricevuto','sono ricevuto','ho ricevo'],'Ricevere has ricevuto here.','Choose the taught -uto participle.'),Y('Luca ___ ieri.','Luca slept yesterday.','ha dormito','Dormire takes avere and dormito.','Use ha with the learned participle.'),Q('Ieri tu ___ un messaggio?','Did you receive a message yesterday?','hai ricevuto',['hai ricevuto','sei ricevuto','hai ricevere'],'Tu takes hai ricevuto.','Keep the completed past.'),Y('Ieri tu ___ il museo.','Yesterday you visited the museum.','hai visitato','Tu takes hai before visitato.','Use familiar you + a completed visit.')],
    ['An afternoon note','Ieri Anna ha visitato il museo. Poi ha ricevuto un messaggio.','Yesterday Anna visited the museum. Then she received a message.','read'],['a2-passato-regular']),
  AL('a2-past-irregular','Use four common past forms','I can retrieve fatto, visto, preso and scritto.','Learn these participles with their verbs: fare → fatto, vedere → visto, prendere → preso, scrivere → scritto.',
    [['fatto','done or made'],['visto','seen'],['preso','taken'],['scritto','written'],['lettera','letter','la','lettere']],
    [['Make and see','These two do not follow a simple regular ending.','Ho fatto una torta. Ho visto Anna.','I made a cake. I saw Anna.'],['Take and write','Use preso with prendere and scritto with scrivere.','Luca ha preso il libro e ha scritto una lettera.','Luca took the book and wrote a letter.']],
    [Q('Ieri ho ___ Anna.','Yesterday I saw Anna.','visto',['visto','veduto','fatto'],'Vedere uses the taught participle visto.','The action is seeing.'),Q('Luca ha ___ una lettera.','Luca wrote a letter.','scritto',['scritto','scrivuto','preso'],'Scrivere uses scritto.','The action is writing.'),Q('Anna ha ___ il libro.','Anna took the book.','preso',['preso','prenduto','fatto'],'Prendere uses preso.','The action is taking.'),Y('Io ho ___ una torta.','I made a cake.','fatto','Fare uses fatto in the past.','Recall fare → fatto.'),Q('Tu hai ___ il museo?','Did you see the museum?','visto',['visto','veduto','preso'],'Vedere uses visto after hai.','The question does not change the participle.'),Y('Sara ha ___ il pane.','Sara took the bread.','preso','The participle of prendere is preso.','Use the irregular form.')],
    ['A short note','Ho visto Anna al museo. Ha fatto una torta e ha scritto una lettera.','I saw Anna at the museum. She made a cake and wrote a letter.','listen'],['a2-irregular-participles']),
  AL('a2-past-auxiliary-person','Choose the person in the past','I can pair an avere auxiliary with a taught participle.','The auxiliary carries person: ho, hai, ha, abbiamo, avete. With these verbs, the participle stays the same for the subject.',
    [['ho visto','I saw'],['hai visto','you saw'],['ha visto','he or she saw'],['abbiamo visto','we saw'],['avete visto','you all saw']],
    [['One person','Use ho for I, hai for familiar you, ha for a named singular person.','Io ho visto Luca. Tu hai visto Anna?','I saw Luca. Did you see Anna?'],['Groups','Noi abbiamo and voi avete introduce the same participle.','Noi abbiamo visto il museo.','We saw the museum.']],
    [Q('Noi ___ Anna.','We saw Anna.','abbiamo visto',['abbiamo visto','avete visto','ha visto'],'Noi takes abbiamo.','The subject means we.'),Q('Voi ___ il museo?','Did you all see the museum?','avete visto',['avete visto','abbiamo visto','hai visto'],'Voi takes avete.','Address several people.'),Q('Io ___ Luca.','I saw Luca.','ho visto',['ho visto','ha visto','hai visto'],'Io takes ho.','The speaker is the subject.'),Y('Tu ___ Anna?','Did you see Anna?','hai visto','Tu takes hai before visto.','Use the familiar-you auxiliary.'),Q('Luca ___ la lettera.','Luca saw the letter.','ha visto',['ha visto','hai visto','hanno visto'],'A named singular person takes ha.','The subject is Luca.'),Y('Noi ___ Anna ieri.','We saw Anna yesterday.','abbiamo visto','Noi takes abbiamo with visto.','Use the we auxiliary.')],
    ['At the museum','Noi abbiamo visto il museo. Anna ha visto una lettera.','We saw the museum. Anna saw a letter.','read'],['a2-passato-regular']),
]);

addUnit('A2', 3, 'Describe travel and change', 'Use essere past forms, agreement, and reflexive completion.', [
  AL('a2-essere-travel','Report a completed trip','I can use sono or sei with andato/andata.','Andare takes essere in the completed past. For a clearly stated singular person, -o describes a man and -a a woman.',
    [['sono andato','I went (male speaker)'],['sono andata','I went (female speaker)'],['sei andato','you went (male)'],['sei andata','you went (female)']],
    [['I traveled','A male speaker says sono andato; a female speaker says sono andata.','Anna: «Sono andata a Roma.»','Anna: “I went to Rome.”'],['Ask someone','Use sei plus an ending matching the familiar addressee.','Luca, sei andato a Milano?','Luca, did you go to Milan?']],
    [Q('Anna: «Ieri ___ a Roma.»','Anna says, “Yesterday I went to Rome.”','sono andata',['sono andata','sono andato','ho andato'],'Anna is a female speaker.','Use sono and -a.'),Q('Luca: «Ieri ___ a Roma.»','Luca says, “Yesterday I went to Rome.”','sono andato',['sono andato','sono andata','ho andato'],'Luca is a male speaker.','Use sono and -o.'),Q('Anna, ___ a Milano?','Anna, did you go to Milan?','sei andata',['sei andata','sei andato','hai andata'],'Anna is the female addressee.','Use sei and -a.'),Y('Luca, ___ a Napoli?','Luca, did you go to Naples?','sei andato','Luca is a male addressee: sei andato.','Use the you auxiliary plus -o.'),Q('Sara: «Oggi ___ a casa.»','Sara says, “Today I went home.”','sono andata',['sono andata','sono andato','ho andata'],'Sara is a woman speaking as I.','Use feminine agreement.'),Y('Marco: «Ieri ___ a Milano.»','Marco says, “Yesterday I went to Milan.”','sono andato','Marco uses the masculine I form.','Write auxiliary and -o participle.')],
    ['After a trip','Anna: «Sono andata a Roma.» Luca: «Io sono andato a Milano.»','Anna: “I went to Rome.” Luca: “I went to Milan.”','listen'],['a2-passato-essere']),
  AL('a2-essere-plural','Report where a group went','I can make plural participles agree after essere.','A women-only group takes -e: sono andate. A men or mixed group takes -i: sono andati.',
    [['siamo andati','we went (men or mixed)'],['siamo andate','we went (women)'],['sono andati','they went (men or mixed)'],['sono andate','they went (women)']],
    [['Women together','Use -e for a group described as all women.','Anna e Sara sono andate a Roma.','Anna and Sara went to Rome.'],['A mixed group','Use -i for a mixed or all-male group.','Anna e Luca sono andati a Milano.','Anna and Luca went to Milan.']],
    [Q('Anna e Sara ___ a Roma.','Anna and Sara went to Rome.','sono andate',['sono andate','sono andati','hanno andato'],'Two women take -e.','Look at both travelers.'),Q('Anna e Luca ___ a Roma.','Anna and Luca went to Rome.','sono andati',['sono andati','sono andate','hanno andato'],'A mixed group takes -i.','One traveler is male.'),Q('Anna e Sara: «Noi ___ a casa.»','Anna and Sara say, “We went home.”','siamo andate',['siamo andate','siamo andati','abbiamo andato'],'The women speakers use siamo andate.','The we group is women-only.'),Y('Luca e Marco ___ a Milano.','Luca and Marco went to Milan.','sono andati','Two male travelers take sono andati.','Use plural essere and -i.'),Q('Sara e Giulia ___ a Napoli.','Sara and Giulia went to Naples.','sono andate',['sono andate','sono andati','hanno andate'],'Two women take sono andate.','Use -e.'),Y('Anna e Luca: «Noi ___ a Roma.»','Anna and Luca say, “We went to Rome.”','siamo andati','A mixed we group takes siamo andati.','Use -i for this group.')],
    ['Two journeys','Anna e Sara sono andate a Roma. Luca e Marco sono andati a Napoli.','Anna and Sara went to Rome. Luca and Marco went to Naples.','read'],['a2-passato-essere']),
  AL('a2-reflexive-past','Tell when you got up','I can use a modeled reflexive past with essere and agreement.','A completed reflexive action takes essere: mi sono alzato/alzata; Anna si è alzata. Match the ending to the person.',
    [['mi sono alzato','I got up (male)'],['mi sono alzata','I got up (female)'],['si è alzato','he got up'],['si è alzata','she got up']],
    [['My completed routine','A male speaker says mi sono alzato; a female speaker says mi sono alzata.','Anna: «Mi sono alzata presto.»','Anna: “I got up early.”'],['Someone else','A named person takes si è plus agreement.','Luca si è alzato alle sette.','Luca got up at seven.']],
    [Q('Anna: «Ieri ___ presto.»','Anna says, “Yesterday I got up early.”','mi sono alzata',['mi sono alzata','mi sono alzato','mi ho alzata'],'Anna is a female speaker.','Use mi sono and -a.'),Q('Luca ___ alle sette.','Luca got up at seven.','si è alzato',['si è alzato','si è alzata','ha alzato'],'Luca takes si è alzato.','Match the male subject.'),Q('Sara ___ tardi.','Sara got up late.','si è alzata',['si è alzata','si è alzato','ha alzata'],'Sara takes si è alzata.','Match the female subject.'),Y('Luca: «Ieri ___ tardi.»','Luca says, “Yesterday I got up late.”','mi sono alzato','A male speaker uses mi sono alzato.','Include pronoun, auxiliary and participle.'),Q('Giulia ___ presto ieri.','Giulia got up early yesterday.','si è alzata',['si è alzata','si è alzato','ha alzata'],'The female subject takes -a.','The completed reflexive needs essere.'),Y('Anna ___ alle otto.','Anna got up at eight.','si è alzata','Anna takes si è alzata.','Write all three parts.')],
    ['Two mornings','Ieri Anna si è alzata presto. Luca si è alzato tardi.','Yesterday Anna got up early. Luca got up late.','listen'],['a2-reflexive-past']),
  AL('a2-auxiliary-choice','Choose the auxiliary for a known verb','I can choose avere for a completed action or essere for known movement.','Mangiare and comprare take avere here; andare and arrivare take essere here, with subject agreement.',
    [['ha mangiato','he or she ate'],['ha comprato','he or she bought'],['è andato','he went'],['è arrivata','she arrived']],
    [['A completed action','Avere introduces the taught eating and buying participles.','Luca ha mangiato il pane.','Luca ate the bread.'],['A movement or arrival','Andare and arrivare take essere in these cases; the ending agrees.','Anna è arrivata a Roma.','Anna arrived in Rome.']],
    [Q('Luca ___ il pane.','Luca ate the bread.','ha mangiato',['ha mangiato','è mangiato','ha andato'],'Mangiare takes avere here.','The action is eating.'),Q('Anna ___ un libro.','Anna bought a book.','ha comprato',['ha comprato','è comprata','ha arrivato'],'Comprare takes avere here.','The action is buying.'),Q('Luca ___ a Roma.','Luca went to Rome.','è andato',['è andato','ha andato','è andata'],'Andare takes essere and Luca takes -o.','The action is going.'),Y('Anna ___ a Milano.','Anna arrived in Milan.','è arrivata','Arrivare takes essere and Anna takes -a.','Use the movement auxiliary and agreement.'),Q('Sara ___ il pane.','Sara ate the bread.','ha mangiato',['ha mangiato','è mangiata','ha andata'],'Mangiare takes avere regardless of Sara being female.','The participle does not agree with the subject here.'),Y('Sara ___ a Napoli.','Sara went to Naples.','è andata','Andare takes essere and Sara takes -a.','Use the learned movement form.')],
    ['One day, two verbs','Anna ha comprato il pane. Poi è andata a casa.','Anna bought bread. Then she went home.','read'],['a2-choose-auxiliary'],['avere-action','essere-movement']),
]);

addUnit('A2', 4, 'Set the scene in the past', 'Learn imperfect forms in descriptions and repeated past routines.', [
  AL('a2-imperfect-are','Describe a past routine','I can use parlavo and parlava for a past routine.','For a familiar -are verb, -avo describes what I used to do; -ava describes one other person.',
    [['parlavo','I used to speak'],['parlava','he or she used to speak'],['mangiavo','I used to eat'],['da piccolo','when I was little (male)'],['spesso','often']],
    [['My old routine','Use parlavo for a repeated speaking habit in the past.','Da piccolo parlavo italiano a casa.','When I was little, I used to speak Italian at home.'],['Someone else','Use parlava for a named singular person.','Anna parlava spesso con Luca. Io mangiavo a casa.','Anna often spoke with Luca. I used to eat at home.']],
    [Q('Da piccolo, io ___ italiano a casa.','As a boy, I used to speak Italian at home.','parlavo',['parlavo','parlava','ho parlato'],'The subject I takes parlavo for this routine.','This happened repeatedly.'),Q('Anna ___ spesso con Luca.','Anna often spoke with Luca.','parlava',['parlava','parlavo','ha parlato'],'Anna takes parlava.','Often marks a past habit.'),Q('Io ___ con mia madre ogni sera.','I used to speak with my mother every evening.','parlavo',['parlavo','parlava','ho parlato'],'Every evening describes repetition.','The subject is I.'),Y('Luca ___ italiano a casa.','Luca used to speak Italian at home.','parlava','Luca is a singular other person: parlava.','Use the imperfect -ava form.'),Q('Sara ___ spesso al telefono.','Sara often spoke on the phone.','parlava',['parlava','parlavo','ha parlato'],'Sara takes parlava for this former habit.','The subject is Sara.'),Y('Io ___ spesso con Anna.','I used to speak with Anna often.','parlavo','Io parlavo is the habitual past.','Use the I imperfect.')],
    ['When we were children','Da piccoli, io e Luca parlavamo spesso a casa. Anna parlava con noi.','As children, Luca and I often spoke at home. Anna spoke with us.','read'],['a2-imperfetto']),
  AL('a2-imperfect-ere-ire','Describe what someone used to do','I can use taught -ere/-ire imperfect forms in habitual contexts.','Leggere → leggevo/leggeva; dormire → dormivo/dormiva. These describe habitual or ongoing past activity.',
    [['leggevo','I used to read'],['leggeva','he or she used to read'],['dormivo','I used to sleep'],['dormiva','he or she used to sleep']],
    [['Reading then','Use leggevo for me, leggeva for a singular other person.','Da piccolo leggevo ogni sera.','As a boy, I used to read every evening.'],['Sleeping then','Dormire has dormivo and dormiva here.','Anna dormiva fino alle otto.','Anna used to sleep until eight.']],
    [Q('Io ___ ogni sera.','I used to read every evening.','leggevo',['leggevo','leggeva','ho letto'],'The repeated I action is leggevo.','Every evening is habitual.'),Q('Anna ___ ogni sera.','Anna used to read every evening.','leggeva',['leggeva','leggevo','legge'],'Anna takes leggeva.','Use the third-person imperfect.'),Q('Da piccolo io ___ molto.','As a boy, I used to sleep a lot.','dormivo',['dormivo','dormiva','dormo'],'The I imperfect is dormivo.','This describes a former routine.'),Y('Luca ___ fino alle otto.','Luca used to sleep until eight.','dormiva','Luca takes dormiva.','Use the -iva form for a singular other person.'),Q('Sara ___ spesso il giornale.','Sara often read the newspaper.','leggeva',['leggeva','leggevo','legge'],'Spesso cues a habit and Sara takes leggeva.','Use the third-person form.'),Y('Io ___ fino alle otto.','I used to sleep until eight.','dormivo','Io takes dormivo.','Use the I imperfect of dormire.')],
    ['Old habits','Anna leggeva ogni sera. Luca dormiva fino alle otto.','Anna used to read every evening. Luca used to sleep until eight.','listen'],['a2-imperfetto']),
  AL('a2-imperfect-states','Set a past scene','I can use ero, era, avevo and aveva for past states.','The imperfect can set a scene or describe a state: ero/era for being, avevo/aveva for having.',
    [['ero','I was'],['era','he or she was'],['avevo','I had'],['aveva','he or she had'],['stanco','tired (male)'],['stanca','tired (female)']],
    [['Being then','Ero and era describe an ongoing past state.','Anna era stanca. Io ero a casa.','Anna was tired. I was at home.'],['Having then','Avevo and aveva describe a past possession or condition.','Luca aveva fame. Io avevo un libro.','Luca was hungry. I had a book.']],
    [Q('Anna ___ stanca quando Luca è arrivato.','Anna was tired when Luca arrived; describe the background state.','era',['era','ero','è stata'],'Era sets her past state.','Anna is the subject.'),Q('Io ___ a casa quando Anna ha chiamato.','I was at home when Anna called; describe the background.','ero',['ero','era','sono stato'],'Ero describes my past setting.','The subject is I.'),Q('Luca ___ fame quando Sara è arrivata.','Luca was hungry when Sara arrived; describe the background.','aveva',['aveva','avevo','ha avuto'],'Hunger uses avere; Luca takes aveva.','This is a past state.'),Y('Io ___ un libro quando Anna ha chiamato.','I had a book when Anna called; describe the background.','avevo','Io avevo describes past possession.','Use the I form of avere in the imperfect.'),Q('Sara ___ sete quando Luca ha chiamato.','Sara was thirsty when Luca called; describe the background.','aveva',['aveva','era','avevo'],'Sete uses avere and Sara takes aveva.','Describe the past state.'),Y('Io ___ stanco quando Anna è arrivata.','I, a man, was tired when Anna arrived; describe the background.','ero','The I state is ero stanco.','Use the imperfect of essere.')],
    ['A quiet afternoon','Ieri Anna era stanca e aveva fame. Io ero a casa.','Yesterday Anna was tired and hungry. I was at home.','read'],['a2-imperfetto']),
]);

addUnit('A2', 5, 'Tell a past story', 'Contrast the background with completed events in short narratives.', [
  AL('a2-habit-versus-event','Distinguish habit from one event','I can choose imperfect for a habit and passato prossimo for one completed occasion.','Ogni giorno calls for a repeated past routine; ieri once can frame a completed event. Meaning, not the time word alone, decides.',
    [['ogni giorno','every day'],['una volta','once'],['parlavo','I used to speak'],['ho parlato','I spoke (one event)']],
    [['A repeated routine','Use imperfect for what happened regularly.','Da piccolo parlavo italiano ogni giorno.','As a boy, I spoke Italian every day.'],['One completed occasion','Use passato prossimo for one bounded event.','Ieri ho parlato con Anna.','Yesterday I spoke with Anna.']],
    [Q('Da piccolo io ___ italiano ogni giorno.','As a boy I used to speak Italian every day.','parlavo',['parlavo','ho parlato','parlo'],'The repeated habit takes imperfect.','Every day describes a routine.'),Q('Ieri io ___ con Anna una volta.','Yesterday I spoke with Anna once.','ho parlato',['ho parlato','parlavo','parlo'],'One finished conversation takes passato prossimo.','Once is one completed event.'),Q('Anna ___ ogni sera con Luca.','Anna used to speak with Luca every evening.','parlava',['parlava','ha parlato','parla'],'Every evening is repeated past action.','Use Anna’s imperfect.'),Y('Ieri Anna ___ con Luca.','Yesterday Anna spoke with Luca on one occasion.','ha parlato','A bounded conversation takes ha parlato.','Use the completed event.'),Q('Io ___ spesso a casa.','I used to eat at home often.','mangiavo',['mangiavo','ho mangiato','mangio'],'Spesso marks a past routine.','Use the imperfect of mangiare.'),Y('Ieri io ___ a casa.','Yesterday I ate at home once.','ho mangiato','One finished meal takes ho mangiato.','Use the completed event form.')],
    ['Then and yesterday','Da piccolo mangiavo a casa ogni giorno. Ieri ho mangiato al ristorante.','As a boy I ate at home every day. Yesterday I ate at a restaurant.','read'],['a2-past-contrast']),
  AL('a2-story-contrast','Set a scene, then report an event','I can distinguish a background state from an event in a short story.','Era and avevo set the scene. A completed act such as ha chiamato or è arrivata moves the story forward.',
    [['era','was'],['avevo','I had'],['ha chiamato','he or she called'],['è arrivata','she arrived'],['mentre','while']],
    [['Background','Imperfect describes the state already in progress.','Ero a casa e avevo fame.','I was at home and hungry.'],['Event','Passato prossimo identifies what happened next.','Anna ha chiamato.','Anna called.']],
    [Q('Io ___ a casa quando Anna ha chiamato.','I was at home when Anna called.','ero',['ero','sono stato','sono'],'The home setting is background.','Anna’s call is the event.'),Q('A un certo punto, Anna ___ mentre io ero a casa.','At one point, Anna called while I was at home.','ha chiamato',['ha chiamato','chiamava','chiama'],'The call is a bounded event here.','The home setting is ongoing.'),Q('Luca ___ fame quando è arrivata Anna.','Luca was hungry when Anna arrived.','aveva',['aveva','ha avuto','ha'],'His hunger is a background state.','The arrival moves the story.'),Y('Anna ___ mentre Luca aveva fame.','Anna arrived while Luca was hungry.','è arrivata','The arrival is a completed event and Anna takes -a.','Use essere and agreement.'),Q('La casa ___ silenziosa quando Luca ha chiamato.','The house was quiet when Luca called.','era',['era','è stata','ha'],'The quiet setting precedes the event.','Use imperfect for the scene.'),Y('A un certo punto, Luca ___ quando Anna era a casa.','At one point, Luca called while Anna was at home.','ha chiamato','The call is the event.','Use the completed past of chiamare.')],
    ['A small interruption','Anna era a casa e aveva fame. Poi Luca ha chiamato.','Anna was at home and hungry. Then Luca called.','listen'],['a2-past-contrast']),
  AL('a2-short-story','Retell a two-event afternoon','I can choose a background imperfect and two completed actions.','Keep the scene in imperfect and completed actions in passato prossimo. Do not convert every past verb to one tense.',
    [['prima','before; first'],['poi','then'],['era','was'],['ha preso','he or she took'],['è uscita','she went out']],
    [['Set the scene','Describe the place or condition before the action.','Era una giornata calda.','It was a warm day.'],['Continue the events','Use completed forms for the ordered actions.','Anna ha preso il libro. Poi è uscita.','Anna took the book. Then she went out.']],
    [Q('La giornata ___ calda. Poi Anna è uscita.','The day was hot. Then Anna went out.','era',['era','è stata','ha'],'The temperature sets the scene.','It is background description.'),Q('Anna ___ il libro. Poi è uscita.','Anna took the book. Then she went out.','ha preso',['ha preso','prendeva','prende'],'Taking the book is a completed step.','It moves the story forward.'),Q('Luca ___ stanco. Poi ha dormito.','Luca was tired. Then he slept.','era',['era','erano','ha'],'Tiredness is the background state.','The later sleep is the event.'),Y('Anna era a casa. Poi ___.','Anna was at home. Then she went out.','è uscita','Anna’s departure is a completed event with essere.','Use feminine agreement.'),Q('Prima Anna ___ fame; poi ha mangiato.','First Anna was hungry; then she ate.','aveva',['aveva','ha avuto','era'],'The hunger is the state before eating.','Fame uses avere.'),Y('Luca era a casa. Poi ___ il libro.','Luca was at home. Then he took the book.','ha preso','The taking is a completed action.','Use ha plus preso.')],
    ['An afternoon','Era una giornata calda. Anna aveva fame. Ha preso il pane, poi è uscita.','It was a hot day. Anna was hungry. She took the bread, then went out.','read'],['a2-past-contrast']),
]);

addUnit('A2', 6, 'Show an action in progress', 'Use stare plus gerund only where ongoing viewpoint matters.', [
  AL('a2-progressive-present','Say what is happening right now','I can use sto, stai or sta plus a taught gerund.','Use stare plus -ando/-endo for an action in progress at this moment: sto parlando, Anna sta leggendo.',
    [['sto parlando','I am speaking'],['stai parlando','you are speaking'],['sta leggendo','he or she is reading'],['adesso','now']],
    [['An -are action','Parlare becomes parlando after a form of stare.','Sto parlando con Anna.','I am speaking with Anna.'],['An -ere action','Leggere becomes leggendo.','Anna sta leggendo.','Anna is reading.']],
    [Q('Io ___ con Anna adesso.','I am speaking with Anna right now.','sto parlando',['sto parlando','stai parlando','ho parlato'],'Io takes sto with parlando.','The action is happening now.'),Q('Tu ___ con Luca?','Are you speaking with Luca now?','stai parlando',['stai parlando','sto parlando','parliato'],'Tu takes stai with parlando.','Address a familiar person.'),Q('Anna ___ un libro adesso.','Anna is reading a book now.','sta leggendo',['sta leggendo','sto leggendo','ha letto'],'Anna takes sta; leggere gives leggendo.','Use the ongoing form.'),Y('Io ___ un libro adesso.','I am reading a book now.','sto leggendo','Io sto leggendo describes an action underway.','Use sto plus leggendo.'),Q('Luca ___ con Marco.','Luca is speaking with Marco now.','sta parlando',['sta parlando','sto parlando','ha parlato'],'Luca takes sta parlando.','The action is ongoing.'),Y('Tu ___ un libro?','Are you reading a book now?','stai leggendo','Tu takes stai; the gerund is leggendo.','Write both words.')],
    ['At home now','Anna sta leggendo. Luca sta parlando con Marco.','Anna is reading. Luca is speaking with Marco.','listen'],['a2-progressive-now']),
  AL('a2-simple-versus-progressive','Choose a habit or an ongoing act','I can distinguish parlo from sto parlando by meaning.','Simple present can report a habit; stare + gerund highlights what is unfolding now. Both may be possible in some contexts; these prompts specify the intended meaning.',
    [['ogni giorno','every day'],['proprio adesso','right now'],['parlo','I speak'],['sto parlando','I am speaking']],
    [['A routine','Use simple present for a regular habit.','Parlo con Anna ogni giorno.','I speak with Anna every day.'],['A live action','Use progressive when the speaker emphasizes the action in progress.','Sto parlando con Anna proprio adesso.','I am speaking with Anna right now.']],
    [Q('Io ___ con Anna ogni giorno.','I speak with Anna every day as a habit.','parlo',['parlo','sto parlando','ho parlato'],'The prompt asks for a regular habit.','Every day is the routine.'),Q('Io ___ con Anna proprio adesso.','I am in the middle of speaking with Anna right now; use stare + gerund.','sto parlando',['sto parlando','stai parlando','ho parlato'],'The emphasis is on an action underway.','Use stare plus gerund.'),Q('Luca ___ italiano ogni giorno.','Luca speaks Italian every day as a habit.','parla',['parla','sta parlando','ha parlato'],'The prompt specifies a habit.','Use simple present.'),Y('Luca sta ___ con Sara proprio adesso.','Luca is in the middle of speaking with Sara right now.','parlando','Sta parlando highlights an action unfolding now.','Use sta plus the gerund.'),Q('Tu ___ con Marco ogni giorno.','You speak with Marco daily as a habit.','parli',['parli','stai parlando','hai parlato'],'Daily habitual speech uses the simple present here.','The prompt says habit.'),Y('Io sto ___ con Marco proprio adesso.','I am in the middle of speaking with Marco.','parlando','The ongoing viewpoint takes sto parlando.','Use the I progressive.')],
    ['Two different days','Parlo con Anna ogni giorno. Oggi sto parlando con Anna proprio adesso.','I speak with Anna every day. Today I am speaking with Anna right now.','read'],['a2-progressive-now']),
  AL('a2-progressive-past','Describe an action underway then','I can use stavo or stava plus gerund for an ongoing past action.','Stavo parlando sets an action in progress in the past. An event such as ha chiamato can interrupt it. Ordinary imperfetto may also describe an ongoing action; progressive adds explicit focus.',
    [['stavo parlando','I was speaking'],['stavi parlando','you were speaking'],['stava leggendo','he or she was reading'],['ha chiamato','called'],['mentre','while']],
    [['My action underway','Use stavo plus the gerund for me.','Stavo parlando quando Anna ha chiamato.','I was speaking when Anna called.'],['Another person underway','Use stava for a named person and stavi for familiar tu.','Luca stava leggendo mentre io parlavo.','Luca was reading while I spoke.']],
    [Q('Io ___ quando Anna ha chiamato.','I was in the middle of speaking when Anna called.','stavo parlando',['stavo parlando','sto parlando','ho parlato'],'The action was underway before the call.','Use past stare plus gerund.'),Q('Luca ___ quando Sara è arrivata.','Luca was in the middle of reading when Sara arrived.','stava leggendo',['stava leggendo','stavo leggendo','ha letto'],'Luca takes stava.','The reading was underway.'),Q('Anna ___ quando Luca ha chiamato.','Anna was in the middle of speaking when Luca called.','stava parlando',['stava parlando','stavo parlando','ha parlato'],'Anna takes stava parlando.','Use the singular third-person past progressive.'),Y('Io ___ quando Luca è arrivato.','I was in the middle of reading when Luca arrived.','stavo leggendo','The I past progressive is stavo leggendo.','Use stavo plus leggendo.'),Q('Tu ___ quando ho chiamato?','Were you in the middle of speaking when I called?','stavi parlando',['stavi parlando','stavo parlando','hai parlato'],'Familiar tu takes stavi.','The action was in progress.'),Y('Anna ___ quando ho chiamato.','Anna was in the middle of reading when I called.','stava leggendo','Anna takes stava leggendo.','Use past stare plus gerund.')],
    ['An interruption','Luca stava leggendo. Anna ha chiamato e Luca ha parlato con Giulia.','Luca was reading. Anna called and Luca spoke with Giulia.','listen'],['a2-progressive-past']),
]);

addUnit('A2', 7, 'Keep track of people and things', 'Use direct objects after their referents are established.', [
  AL('a2-direct-singular','Replace one known object','I can use lo or la for a clear singular object.','Lo replaces a masculine singular direct object; la replaces a feminine singular one. Put it before a finite verb.',
    [['lo','him or it (masculine direct object)'],['la','her or it (feminine direct object)'],['libro','book','il','libri'],['lettera','letter','la','lettere']],
    [['A masculine object','Il libro is masculine: lo leggo.','Il libro? Lo leggo oggi.','The book? I am reading it today.'],['A feminine object','La lettera is feminine: la leggo.','La lettera? La leggo oggi.','The letter? I am reading it today.']],
    [X2([['il libro','lo'],['la lettera','la']],'Il libro? Lo leggo. La lettera? La leggo.','The known noun determines the direct pronoun.','Match gender of each singular object.'),Q('La lettera? Io ___ leggo oggi.','The letter? I read it today.','la',['la','lo','le'],'Lettera is feminine singular.','Replace la lettera.'),Q('Luca? Io ___ vedo al museo.','Luca? I see him at the museum.','lo',['lo','la','gli'],'Luca is a male direct object here.','Who is seen?'),Y('Anna? Io ___ vedo oggi.','Anna? I see her today.','la','Anna is a female direct object.','Put la before vedo.'),Q('Il pane? Io ___ compro.','The bread? I buy it.','lo',['lo','la','li'],'Pane is masculine singular.','Replace il pane.'),Y('La pizza? Io ___ compro oggi.','The pizza? I buy it today.','la','Casa is feminine singular.','Put la before compro.')],
    ['At the shop','Anna: «Il pane?» Luca: «Lo compro io.» Anna: «E la pizza?» Luca: «La compro domani.»','Anna: “The bread?” Luca: “I’ll buy it.” Anna: “And the pizza?” Luca: “I’ll buy it tomorrow.”','read'],['a2-direct-object-pronouns']),
  AL('a2-direct-plural','Replace several known objects','I can use li or le for a clear plural object.','Li replaces a masculine plural direct object; le replaces a feminine plural one. The referenced noun tells you which.',
    [['li','them (masculine direct object)'],['le','them (feminine direct object)'],['libri','books'],['lettere','letters']],
    [['Masculine plural','I libri become li when already known.','I libri? Li leggo oggi.','The books? I read them today.'],['Feminine plural','Le lettere become le.','Le lettere? Le leggo oggi.','The letters? I read them today.']],
    [Q('I libri? Io ___ leggo oggi.','The books? I read them today.','li',['li','le','lo'],'I libri is masculine plural.','Replace the books.'),Q('Le lettere? Io ___ leggo oggi.','The letters? I read them today.','le',['le','li','la'],'Le lettere is feminine plural.','Replace the letters.'),Q('I musei? Noi ___ visitiamo.','The museums? We visit them.','li',['li','le','lo'],'Musei is masculine plural.','Replace the museums.'),Y('Le case? Io ___ vedo da qui.','The houses? I see them from here.','le','Case is feminine plural.','Put le before vedo.'),Q('I libri? Anna ___ prende.','The books? Anna takes them.','li',['li','le','gli'],'Anna takes a masculine plural direct object.','Replace i libri.'),Y('Le pizze? Luca ___ compra.','The pizzas? Luca buys them.','le','Pizze is feminine plural.','Use le before compra.')],
    ['A choice of books','Luca: «I libri?» Anna: «Li prendo io.» Luca: «E le lettere?» Anna: «Le leggo domani.»','Luca: “The books?” Anna: “I’ll take them.” Luca: “And the letters?” Anna: “I’ll read them tomorrow.”','listen'],['a2-direct-object-pronouns']),
  AL('a2-direct-reference','Follow the object in a dialogue','I can choose a direct pronoun from its stated referent.','Before selecting lo, la, li or le, identify the object named in the previous line; grammatical gender and number belong to that noun.',
    [['il messaggio','the message'],['la lettera','the letter'],['i libri','the books'],['le pizze','the pizzas']],
    [['One referent','The earlier noun controls the later pronoun.','Anna: «Leggi il messaggio?» Luca: «Sì, lo leggo.»','Anna: “Do you read the message?” Luca: “Yes, I read it.”'],['Plural referent','Choose li or le from the named plural object.','I libri? Li prendo io.','The books? I’ll take them.']],
    [Q('«Leggi il messaggio?» «Sì, ___ leggo.»','“Do you read the message?” “Yes, I read it.”','lo',['lo','la','le'],'Messaggio is masculine singular.','Track the previous noun.'),Q('«Leggi la lettera?» «Sì, ___ leggo.»','“Do you read the letter?” “Yes, I read it.”','la',['la','lo','li'],'Lettera is feminine singular.','Track the previous noun.'),Q('«Prendi i libri?» «Sì, ___ prendo.»','“Are you taking the books?” “Yes, I take them.”','li',['li','le','lo'],'Libri is masculine plural.','Replace the books.'),Y('«Compri le pizze?» «Sì, ___ compro.»','“Are you buying the pizzas?” “Yes, I buy them.”','le','Pizze is feminine plural.','Use the plural feminine pronoun.'),Q('«Vedi Anna?» «Sì, ___ vedo.»','“Do you see Anna?” “Yes, I see her.”','la',['la','lo','le'],'Anna is the female person seen.','Choose the direct object.'),Y('«Vedi Luca?» «Sì, ___ vedo.»','“Do you see Luca?” “Yes, I see him.”','lo','Luca is the male person seen.','Use lo before vedo.')],
    ['Who reads the letter?','Anna: «Leggi la lettera?» Luca: «Sì, la leggo adesso.» Anna: «E i libri?» Luca: «Li leggo domani.»','Anna: “Are you reading the letter?” Luca: “Yes, I’m reading it now.” Anna: “And the books?” Luca: “I’ll read them tomorrow.”','read'],['a2-direct-object-pronouns']),
]);

addUnit('A2', 8, 'Give things to people', 'Distinguish recipients and choose a natural clitic position.', [
  AL('a2-indirect-me-you','Name me or you as recipient','I can use mi or ti for a recipient with dare or scrivere.','Mi means to me and ti means to you in these modeled exchanges. Put the pronoun before the finite verb.',
    [['mi','to me'],['ti','to you'],['dare','to give'],['scrivere','to write']],
    [['To me','Use mi before the finite verb when I receive something.','Anna mi scrive una lettera.','Anna writes me a letter.'],['To you','Use ti when the addressee receives it.','Ti do il libro.','I give you the book.']],
    [Q('Anna ___ scrive una lettera.','Anna writes me a letter.','mi',['mi','ti','la'],'The recipient is me.','Choose to me.'),Q('Io ___ do il libro.','I give you the book.','ti',['ti','mi','lo'],'The recipient is you.','Choose to you.'),Q('Luca ___ dà il pane.','Luca gives me the bread.','mi',['mi','ti','lo'],'I receive the bread.','Use mi.'),Y('Io ___ scrivo un messaggio.','I write you a message.','ti','The addressee receives the message.','Use ti before scrivo.'),Q('Sara ___ scrive oggi.','Sara writes to you today.','ti',['ti','mi','la'],'The addressee is the recipient.','Choose ti.'),Y('Anna ___ dà la lettera.','Anna gives me the letter.','mi','The speaker receives the letter.','Use mi before dà.')],
    ['A small exchange','Anna mi scrive un messaggio. Io ti do il libro.','Anna writes me a message. I give you the book.','read'],['a2-indirect-object-pronouns']),
  AL('a2-indirect-him-her','Choose the named recipient','I can use gli for a male recipient and le for a female recipient.','Gli means to him; le means to her. The recipient receives something, while the direct object is the thing given.',
    [['gli','to him'],['le','to her'],['dò','I give'],['scrivo','I write']],
    [['To him','Luca receives a thing: gli do il libro.','Luca? Gli do il libro.','Luca? I give him the book.'],['To her','Anna receives a thing: le scrivo.','Anna? Le scrivo una lettera.','Anna? I write her a letter.']],
    [Q('Luca? Io ___ do il libro.','Luca? I give him the book.','gli',['gli','le','lo'],'Luca is a male recipient.','Who receives the book?'),Q('Anna? Io ___ scrivo un messaggio.','Anna? I write her a message.','le',['le','gli','la'],'Anna is a female recipient.','Who receives the message?'),Q('Marco? Sara ___ dà il pane.','Marco? Sara gives him the bread.','gli',['gli','le','lo'],'Marco receives the bread.','Use the male-recipient form.'),Y('Sara? Io ___ do la lettera.','Sara? I give her the letter.','le','Sara is a female recipient.','Put le before do.'),Q('Giulia? Luca ___ scrive oggi.','Giulia? Luca writes to her today.','le',['le','gli','la'],'Giulia receives the message.','Use le.'),Y('Luca? Io ___ scrivo domani.','Luca? I write to him tomorrow.','gli','Luca is the recipient.','Use gli before scrivo.')],
    ['Two letters','Io scrivo a Luca: gli scrivo una lettera. Scrivo anche ad Anna: le scrivo un messaggio.','I write to Luca: I write him a letter. I also write to Anna: I write her a message.','listen'],['a2-indirect-object-pronouns']),
  AL('a2-indirect-groups','Address our or your group as recipient','I can use ci and vi for group recipients in a clear exchange.','Ci can mean to us and vi to you all when a person gives or writes something to that group. The thing given remains a separate direct object.',
    [['ci','to us'],['vi','to you all'],['dà','gives'],['scrive','writes']],
    [['To our group','Ci identifies we as the recipients.','Anna ci scrive un messaggio.','Anna writes us a message.'],['To your group','Vi identifies several addressees as recipients.','Luca vi dà il libro.','Luca gives you all the book.']],
    [Q('Anna ___ scrive un messaggio.','Anna writes us a message.','ci',['ci','vi','li'],'Our group receives the message.','Choose to us.'),Q('Luca ___ dà il libro.','Luca gives you all the book.','vi',['vi','ci','li'],'The addressees are plural you.','Choose to you all.'),Q('Sara ___ porta il pane.','Sara brings us the bread.','ci',['ci','vi','lo'],'Our group receives it.','Use ci.'),Y('Io ___ scrivo domani.','I write to you all tomorrow.','vi','Vi marks a plural-you recipient.','Put vi before scrivo.'),Q('Marco ___ scrive una lettera.','Marco writes to us a letter.','ci',['ci','vi','le'],'We receive the letter.','Use ci.'),Y('Anna ___ dà la pizza.','Anna gives you all the pizza.','vi','The recipients are several addressees.','Use vi.')],
    ['A group message','Anna ci scrive un messaggio. Io vi scrivo domani.','Anna writes us a message. I write you all tomorrow.','listen'],['a2-indirect-object-pronouns']),
  AL('a2-pronoun-placement','Keep a pronoun with a two-verb phrase','I can place a direct pronoun before a modal or attach it to an infinitive.','With posso vedere, both lo posso vedere and posso vederlo are standard. The attached form drops the infinitive’s final -e.',
    [['lo posso vedere','I can see it'],['posso vederlo','I can see it'],['la voglio leggere','I want to read it'],['voglio leggerla','I want to read it']],
    [['Before the modal','Place the object pronoun before the conjugated modal.','Il libro? Lo posso vedere.','The book? I can see it.'],['Attached to the infinitive','You can attach it to the infinitive after dropping -e.','Il libro? Posso vederlo.','The book? I can see it.']],
    [Q('Il libro? ___ oggi.','The book? I can see it today. Use the pronoun before posso.','Lo posso vedere',['Lo posso vedere','La posso vedere','Gli posso vedere'],'Lo is masculine and stands before posso.','The prompt specifies early placement.'),Q('Il libro? Posso ___ oggi.','The book? I can see it today. Attach the pronoun to the infinitive.','vederlo',['vederlo','vedere lo','vederla'],'Vedere loses final -e before lo.','Attach to the infinitive.'),Q('La lettera? ___ oggi.','The letter? I want to read it today. Put the pronoun before voglio.','La voglio leggere',['La voglio leggere','Lo voglio leggere','Le voglio leggere'],'Lettera takes la before voglio.','Choose early placement.'),Y('La lettera? Voglio ___ oggi.','The letter? I want to read it today. Attach it to the infinitive.','leggerla','Leggere loses -e and attaches la.','Use the late-placement form.'),Q('Il messaggio? Voglio ___ oggi.','The message? I want to read it today. Attach the pronoun.','leggerlo',['leggerlo','leggere lo','leggerla'],'Messaggio takes lo attached to legger-.','Choose the masculine object.'),Y('Il libro? Posso ___ domani.','The book? I can see it tomorrow. Attach the pronoun.','vederlo','Attach lo to veder-.','Drop final -e first.')],
    ['Two ways to ask','Il libro? Lo posso vedere oggi. La lettera? Voglio leggerla domani.','The book? I can see it today. The letter? I want to read it tomorrow.','read'],['a2-pronoun-placement']),
]);

addUnit('A2', 9, 'Plan ahead', 'Use modeled future forms for plans beyond the present.', [
  AL('a2-future-are','Make a future plan','I can use parlerò, parlerai or parlerà for a future conversation.','For this modeled -are verb, parl- takes future endings -erò, -erai, -erà. The subject tells which ending is needed.',
    [['parlerò','I will speak'],['parlerai','you will speak'],['parlerà','he or she will speak'],['domani','tomorrow']],
    [['My plan','Io parlerò names a later conversation.','Domani parlerò con Anna.','Tomorrow I will speak with Anna.'],['Someone else','Tu parlerai and Anna parlerà identify the person.','Anna parlerà con Luca domani.','Anna will speak with Luca tomorrow.']],
    [Q('Domani io ___ con Anna.','Tomorrow I will speak with Anna.','parlerò',['parlerò','parlerai','parlerà'],'The I future is parlerò.','Look at the subject.'),Q('Domani tu ___ con Luca?','Will you speak with Luca tomorrow?','parlerai',['parlerai','parlerò','parlerà'],'Tu takes parlerai.','Address one familiar person.'),Q('Anna ___ con Marco domani.','Anna will speak with Marco tomorrow.','parlerà',['parlerà','parlerò','parlerai'],'Anna takes parlerà.','A named singular subject.'),Y('Io ___ con Sara domani.','I will speak with Sara tomorrow.','parlerò','Io takes parlerò.','Keep the final accent.'),Q('Luca ___ con Anna più tardi.','Luca will speak with Anna later.','parlerà',['parlerà','parlerai','parlerò'],'Luca takes third-person parlerà.','Use the singular named-person form.'),Y('Tu ___ con Sara domani?','Will you speak with Sara tomorrow?','parlerai','The familiar-you future is parlerai.','Use the -ai ending.')],
    ['A conversation tomorrow','Domani parlerò con Anna. Lei parlerà con Luca più tardi.','Tomorrow I will speak with Anna. She will speak with Luca later.','listen'],['a2-future-regular']),
  AL('a2-future-ere-ire','Extend the regular future','I can use prenderò and dormirò for two later actions.','Prendere keeps prender- before future endings; dormire keeps dormir-. Learn these common forms in context.',
    [['prenderò','I will take'],['prenderà','he or she will take'],['dormirò','I will sleep'],['dormirà','he or she will sleep']],
    [['An -ere plan','Prenderò names a later act of taking.','Domani prenderò il treno.','Tomorrow I will take the train.'],['An -ire plan','Dormirò and dormirà are future forms of dormire.','Luca dormirà a casa.','Luca will sleep at home.']],
    [Q('Domani io ___ il treno.','Tomorrow I will take the train.','prenderò',['prenderò','prenderà','prendo'],'Io takes prenderò.','Use the learned -ere future.'),Q('Domani Anna ___ il treno.','Tomorrow Anna will take the train.','prenderà',['prenderà','prenderò','prende'],'Anna takes prenderà.','Use third person.'),Q('Stasera io ___ a casa.','Tonight I will sleep at home.','dormirò',['dormirò','dormirà','dormo'],'Io takes dormirò.','Use the -ire future.'),Y('Stasera Luca ___ a casa.','Tonight Luca will sleep at home.','dormirà','Luca takes dormirà.','Use third person of dormire.'),Q('Domani io ___ il libro.','Tomorrow I will take the book.','prenderò',['prenderò','prenderà','prendo'],'The I future is prenderò.','The action is later.'),Y('Domani io ___ a casa.','Tomorrow I will sleep at home.','dormirò','The I future of dormire is dormirò.','Keep the accent.')],
    ['Tomorrow evening','Domani prenderò il treno. Anna dormirà a Milano.','Tomorrow I will take the train. Anna will sleep in Milan.','read'],['a2-future-regular']),
  AL('a2-future-irregular','Use three common future stems','I can use sarò, avrò and andrò in a plan.','Essere, avere and andare have future stems sar-, avr-, and andr-. Learn the useful I forms and the modeled third-person forms.',
    [['sarò','I will be'],['avrò','I will have'],['andrò','I will go'],['sarà','he or she will be'],['andrà','he or she will go']],
    [['My future','Use sarò, avrò, andrò for my future state, possession or trip.','Domani sarò a Roma.','Tomorrow I will be in Rome.'],['Someone else','A named singular person takes sarà or andrà.','Anna andrà a Milano.','Anna will go to Milan.']],
    [Q('Domani io ___ a Roma.','Tomorrow I will be in Rome.','sarò',['sarò','sarà','andrò'],'Essere gives sarò for I.','The meaning is be.'),Q('Domani io ___ un libro nuovo.','Tomorrow I will have a new book.','avrò',['avrò','sarò','avrà'],'Avere gives avrò for I.','The meaning is have.'),Q('Domani Anna ___ a Milano.','Tomorrow Anna will go to Milan.','andrà',['andrà','andrò','sarà'],'Anna takes andrà.','The meaning is go.'),Y('Domani io ___ a Napoli.','Tomorrow I will go to Naples.','andrò','Andare has andrò for I.','Keep the final accent.'),Q('Domani Luca ___ a casa.','Tomorrow Luca will be at home.','sarà',['sarà','sarò','andrà'],'Luca takes sarà for will be.','The meaning is be.'),Y('Domani io ___ tempo.','Tomorrow I will have time.','avrò','Avere has avrò for I.','Use the future of have.')],
    ['Two plans','Domani andrò a Roma. Anna sarà a Milano.','Tomorrow I will go to Rome. Anna will be in Milan.','read'],['a2-future-irregular']),
  AL('a2-near-plan','Choose a present or future plan','I can use present for an arranged near plan and future for a later prediction or intention.','Italian often uses present for a scheduled near plan; future forms give an explicit future viewpoint. Prompts here specify the intended framing.',
    [['stasera','this evening'],['domani','tomorrow'],['vado','I go'],['andrò','I will go'],['parto','I leave'],['prenderò','I will take']],
    [['Arranged plan','A stated near arrangement may use present.','Stasera vado a casa di Anna.','This evening I am going to Anna’s home.'],['Explicit future','Use future to project a later action.','Domani andrò a Roma.','Tomorrow I will go to Rome.']],
    [Q('Ho già il biglietto: domani ___ a Roma.','I already have the ticket: tomorrow I am going to Rome. Use the arranged-present framing.','vado',['vado','andrò','sono andato'],'A booked near plan can use vado.','The prompt requests arranged present.'),Q('Un giorno ___ a Roma.','One day I will go to Rome. Use an explicit future intention.','andrò',['andrò','vado','sono andato'],'Un giorno looks ahead without a current arrangement.','Choose future.'),Q('Stasera ___ con Anna: è già deciso.','This evening I am speaking with Anna; it is arranged. Use present.','parlo',['parlo','parlerò','ho parlato'],'The prompt specifies a fixed near plan.','Use present.'),Y('Un giorno ___ con Anna in italiano.','One day I will speak with Anna in Italian. Use future.','parlerò','The explicit future intention takes parlerò.','Use the I future.'),Q('Domani alle otto ___ il treno: ho il biglietto.','Tomorrow at eight I take the train; I have a ticket. Use scheduled present.','prendo',['prendo','prenderò','ho preso'],'An arranged departure can use present.','The ticket makes the plan concrete.'),Y('Un giorno ___ il treno per Roma.','One day I will take the train to Rome. Use future.','prenderò','Prendere has future prenderò.','Use the explicit future viewpoint.')],
    ['A booked journey','Domani prendo il treno per Roma: ho già il biglietto. Un giorno andrò anche a Napoli.','Tomorrow I take the train to Rome: I already have the ticket. One day I will also go to Naples.','read'],['a2-future-regular']),
]);

addUnit('A2', 10, 'Ask politely and imagine', 'Use small conditional chunks before broad hypothetical syntax.', [
  AL('a2-conditional-request','Make a polite request','I can use vorrei, potrei and potrebbe in a polite exchange.','Vorrei asks for a desired thing; potrei asks whether I may; potrebbe addresses someone politely about their ability or willingness.',
    [['vorrei','I would like'],['potrei','could I'],['potrebbe','could you (polite)'],['acqua','water'],['un po’ d’acqua','a little water (whole phrase)']],
    [['What I would like','Vorrei is a polite request for something.','Vorrei un caffè, per favore.','I would like a coffee, please.'],['Could I or could you','Potrei asks about my action; potrebbe addresses a person politely.','Potrebbe ripetere, per favore?','Could you repeat, please?']],
    [Q('___ un caffè, per favore.','I would like a coffee, please.','Vorrei',['Vorrei','Potrei','Potrebbe'],'Vorrei states what the speaker would like.','The request is for a thing.'),Q('___ entrare, per favore?','Could I come in, please?','Potrei',['Potrei','Potrebbe','Vorrei'],'Potrei asks permission for my own action.','The speaker asks about self.'),Q('Signora, ___ ripetere?','Madam, could you repeat?','potrebbe',['potrebbe','potrei','vorrei'],'Potrebbe addresses the woman politely.','The addressee would repeat.'),Y('___ un po’ d’acqua, per favore.','I would like a little water, please. Use the taught conditional of volere.','Vorrei','Vorrei makes the request polite.','Ask for the desired drink.'),Q('Dottore, ___ parlare più piano?','Doctor, could you speak more slowly?','potrebbe',['potrebbe','potrei','vorrei'],'The doctor is the polite addressee.','Ask about the doctor’s action.'),Y('___ vedere il libro?','Could I see the book? Use the taught conditional of potere.','Potrei','Potrei asks about my ability or permission.','The speaker would see it.')],
    ['At the counter','Cliente: «Vorrei un caffè.» Barista: «Certo.» Cliente: «Potrebbe portare anche acqua?»','Customer: “I would like a coffee.” Barista: “Certainly.” Customer: “Could you bring water too?”','listen'],['a2-conditional-politeness']),
  AL('a2-conditional-plan','Say what I would do','I can use vorrei, andrei and farei for a tentative plan.','Conditional forms can make a wish or tentative idea less direct: vorrei visitare, andrei, farei.',
    [['andrei','I would go'],['farei','I would do'],['vorrei visitare','I would like to visit'],['se possibile','if possible']],
    [['A wish','Vorrei plus infinitive expresses a polite wish.','Vorrei visitare Roma.','I would like to visit Rome.'],['A tentative act','Andrei and farei express what I would do in a possible situation.','Andrei a Roma. Farei una visita al museo.','I would go to Rome. I would visit the museum.']],
    [Q('___ visitare Roma, se possibile.','I would like to visit Rome, if possible.','Vorrei',['Vorrei','Potrebbe','Andrei'],'Vorrei introduces an infinitive wish.','A wish plus visitare.'),Q('Se possibile, ___ a Roma.','If possible, I would go to Rome.','andrei',['andrei','andrò','vado'],'Andrei is the tentative I form.','The trip is conditional.'),Q('Se possibile, ___ una visita al museo.','If possible, I would visit the museum.','farei',['farei','farò','faccio'],'Farei gives a tentative I action.','Use would do.'),Y('___ parlare con Anna.','I would like to speak with Anna. Use the taught conditional of volere.','Vorrei','Vorrei can precede an infinitive.','Use the polite-wish form.'),Q('Con più tempo, ___ a Milano.','With more time, I would go to Milan.','andrei',['andrei','andrò','sono andato'],'The imagined time favors the conditional.','Use would go.'),Y('Con più tempo, ___ una torta.','With more time, I would make a cake.','farei','Farei expresses what I would do.','Use conditional fare.')],
    ['A possible weekend','Vorrei visitare Roma. Con più tempo, andrei anche a Napoli.','I would like to visit Rome. With more time, I would go to Naples too.','read'],['a2-conditional-politeness']),
  AL('a2-formal-request','Address Lei politely','I can distinguish familiar puoi from polite potrebbe in a real request.','Use familiar puoi with a peer; polite potrebbe with Lei or a stranger. The conditional softens a request without changing who acts.',
    [['puoi','can you (familiar)'],['potrebbe','could you (polite)'],['signora','madam'],['aiutarmi','help me (whole infinitive phrase)']],
    [['To a friend','A familiar peer can receive puoi plus infinitive.','Luca, puoi aiutarmi?','Luca, can you help me?'],['To a stranger','Use potrebbe for a polite Lei request.','Signora, potrebbe aiutarmi?','Madam, could you help me?']],
    [Q('Luca, ___ ripetere?','Luca, can you repeat? (familiar)','puoi',['puoi','potrebbe','potrei'],'A friend takes familiar puoi.','Luca is addressed as tu.'),Q('Signora, ___ ripetere?','Madam, could you repeat? (polite)','potrebbe',['potrebbe','puoi','potrei'],'A stranger takes polite potrebbe.','Use Lei register.'),Q('Anna, ___ portare il libro?','Anna, can you bring the book? (friend)','puoi',['puoi','potrebbe','potrei'],'The friend takes puoi.','Use familiar address.'),Y('Dottore, ___ parlare più piano?','Doctor, could you speak more slowly? (polite)','potrebbe','Potrebbe suits polite Lei address.','The doctor is the addressee.'),Q('Scusi, ___ aiutarmi?','Excuse me, could you help me? (polite)','potrebbe',['potrebbe','puoi','potrei'],'Scusi marks a polite stranger request.','Use potrebbe.'),Y('Marco, ___ aiutarmi?','Marco, can you help me? (familiar)','puoi','Marco is addressed familiarly.','Use puoi.')],
    ['At reception and at home','Alla reception: «Scusi, potrebbe ripetere?» A casa: «Luca, puoi ripetere?»','At reception: “Excuse me, could you repeat?” At home: “Luca, can you repeat?”','listen'],['a2-conditional-politeness']),
]);

addUnit('A2', 11, 'Compare and measure', 'Make bounded comparisons and describe quantities.', [
  AL('a2-compare-more-less','Compare two things','I can use più or meno with di for two compared nouns or people.','Più/meno + adjective + di compares two nouns or people. The adjective still agrees with what is described.',
    [['più','more'],['meno','less'],['di','than'],['alto','tall (male)'],['alta','tall (female)']],
    [['More','Luca is the person described; più alto di compares him with Marco.','Luca è più alto di Marco.','Luca is taller than Marco.'],['Less','Meno makes the inverse scale comparison.','Anna è meno alta di Sara.','Anna is less tall than Sara.']],
    [Q('Luca è ___ alto di Marco.','Luca is taller than Marco.','più',['più','meno','molto'],'Più marks the greater degree.','The translation says taller.'),Q('Anna è ___ alta di Sara.','Anna is less tall than Sara.','meno',['meno','più','molto'],'Meno marks the lesser degree.','The translation says less tall.'),Q('Anna è più alta ___ Sara.','Anna is taller than Sara.','di',['di','che','a'],'Two named people compared here use di.','The second term is Sara.'),Y('La casa è ___ grande di quella.','The house is less big than that one.','meno','Meno marks lesser size.','Use less.'),Q('Sara è ___ alta di Anna.','Sara is taller than Anna.','più',['più','meno','troppo'],'Più marks taller.','Compare the people.'),Y('Luca è più alto ___ Marco.','Luca is taller than Marco.','di','Di introduces the second person.','Use the taught comparison marker.')],
    ['Two friends','Sara è più alta di Anna. Luca è meno alto di Marco.','Sara is taller than Anna. Luca is less tall than Marco.','read'],['a2-comparatives']),
  AL('a2-compare-activities','Compare two actions','I can use più or meno with che when comparing two activities.','When one person does one action more or less than another action, use più/meno ... che between the actions.',
    [['leggo','I read'],['scrivo','I write'],['cammino','I walk'],['corro','I run'],['più che','more than'],['meno che','less than']],
    [['Two activities','Compare leggere with scrivere for the same person.','Leggo più che scrivo.','I read more than I write.'],['Reverse amount','Meno gives the lower frequency of the first activity.','Scrivo meno che leggo.','I write less than I read.']],
    [Q('Leggo più ___ scrivo.','I read more than I write.','che',['che','di','a'],'Two actions are compared with che.','The second term is another verb.'),Q('Scrivo ___ che leggo.','I write less than I read.','meno',['meno','più','molto'],'Meno gives the lower amount.','The translation says less.'),Q('Cammino più ___ corro.','I walk more than I run.','che',['che','di','da'],'Two activities need che.','Both sides are verbs.'),Y('Parlo ___ che scrivo.','I speak more than I write.','più','Più marks greater frequency.','Use more.'),Q('Leggo ___ che parlo.','I read less than I speak.','meno',['meno','più','troppo'],'Meno marks lesser frequency.','Use less.'),Y('Scrivo più ___ leggo.','I write more than I read.','che','Two actions are compared with che.','Use the action comparison marker.')],
    ['Reading and writing','Anna legge più che scrive. Luca scrive meno che legge.','Anna reads more than she writes. Luca writes less than he reads.','listen'],['a2-comparatives']),
  AL('a2-relative-superlative','Identify the tallest in a known group','I can use il più or la più with a defined group.','A relative superlative identifies the highest degree within a stated group: il più alto, la più alta. Keep article and adjective agreement.',
    [['il più alto','the tallest (male)'],['la più alta','the tallest (female)'],['del gruppo','in the group'],['della classe','in the class'],['della famiglia','in the family']],
    [['A man in a group','Il più alto refers to a man compared with his group.','Luca è il più alto del gruppo.','Luca is the tallest in the group.'],['A woman in a group','La più alta refers to a woman.','Sara è la più alta del gruppo.','Sara is the tallest in the group.']],
    [Q('Luca è ___ del gruppo.','Luca is the tallest in the group.','il più alto',['il più alto','la più alta','più alto'],'Luca needs masculine article and adjective.','The group has one highest member.'),Q('Sara è ___ del gruppo.','Sara is the tallest in the group.','la più alta',['la più alta','il più alto','più alta'],'Sara needs feminine article and adjective.','The group has one highest member.'),Q('Marco è ___ della classe.','Marco is the tallest in the class.','il più alto',['il più alto','la più alta','più alto'],'Marco takes masculine il.','Use the relative superlative.'),Y('Anna è ___ della classe.','Anna is the tallest in the class.','la più alta','Anna takes la più alta.','Include the article.'),Q('Luca è ___ della famiglia.','Luca is the tallest in the family.','il più alto',['il più alto','la più alta','più alto'],'The male person takes il più alto.','Compare him within the family.'),Y('Giulia è ___ del gruppo.','Giulia is the tallest in the group.','la più alta','Use la più alta for Giulia.','Include the feminine article.')],
    ['A class photo','Sara è la più alta della classe. Marco è il più alto del suo gruppo.','Sara is the tallest in the class. Marco is the tallest in his group.','read'],['a2-superlatives']),
  AL('a2-absolute-superlative','Emphasize a very strong quality','I can use -issimo/-issima with a taught adjective.','Bellissimo and bellissima express a very high degree without comparing a group. The ending agrees with the described noun.',
    [['bellissimo','very beautiful (masculine)'],['bellissima','very beautiful (feminine)'],['grandissimo','very big (masculine)'],['grandissima','very big (feminine)']],
    [['A masculine thing','Il libro is masculine: bellissimo or grandissimo.','Il libro è bellissimo.','The book is very beautiful.'],['A feminine thing','La casa is feminine: bellissima or grandissima.','La casa è grandissima.','The house is very big.']],
    [Q('Il libro è ___.','The book is very beautiful. Use -issimo.','bellissimo',['bellissimo','bellissima','il più bello'],'The masculine singular book takes bellissimo.','This is high degree without a group.'),Q('La casa è ___.','The house is very big. Use -issima.','grandissima',['grandissima','grandissimo','la più grande'],'The feminine singular house takes grandissima.','This is high degree without a comparison group.'),Q('La lettera è ___.','The letter is very beautiful. Use -issima.','bellissima',['bellissima','bellissimo','la più bella'],'Feminine letter takes bellissima.','Use the absolute form.'),Y('Il museo è ___.','The museum is very big. Use -issimo.','grandissimo','Masculine museo takes grandissimo.','Use the high-degree suffix.'),Q('Lo zaino è ___.','The backpack is very big. Use -issimo.','grandissimo',['grandissimo','grandissima','il più grande'],'Zaino is masculine singular.','No group is compared.'),Y('La casa è ___.','The house is very beautiful. Use -issima.','bellissima','Casa is feminine singular.','Use the agreeing absolute form.')],
    ['Two impressions','Il museo è grandissimo. La casa di Anna è bellissima.','The museum is very big. Anna’s house is very beautiful.','listen'],['a2-superlatives']),
  AL('a2-quantity','Choose a useful quantity','I can distinguish qualche, alcuni and un po’ di in familiar shopping contexts.','Qualche takes a singular noun but means a few; alcuni takes a masculine plural noun; un po’ di can precede a mass noun.',
    [['qualche','a few (with singular noun)'],['alcuni','some (masculine plural)'],['un po’ di','a little'],['pane','bread'],['libri','books']],
    [['A few singular-form items','After qualche, the noun stays singular.','Compro qualche libro.','I buy a few books.'],['Other quantities','Use alcuni libri or un po’ di pane as modeled.','Ho alcuni libri e un po’ di pane.','I have some books and a little bread.']],
    [Q('Compro ___ libro.','I buy a few books. Keep libro singular.','qualche',['qualche','alcuni','un po’ di'],'Qualche takes singular libro.','The prompt says singular noun form.'),Q('Compro ___ libri.','I buy some books, using a form that agrees with libri.','alcuni',['alcuni','qualche','una'],'Alcuni agrees with plural libri.','The noun is plural.'),Q('Vorrei ___ pane.','I would like a little bread.','un po’ di',['un po’ di','alcuni','qualche'],'Un po’ di measures bread.','Bread is a mass noun here.'),Y('Ho ___ libro nello zaino.','I have a few books in my backpack. Keep libro singular.','qualche','Qualche precedes singular libro.','A few with singular form.'),Q('Anna ha ___ messaggi.','Anna has some messages.','alcuni',['alcuni','qualche','un po’ di'],'Alcuni fits plural messaggi.','The noun is plural.'),Y('Luca ha ___ pane.','Luca has a little bread.','un po’ di','Un po’ di fits a quantity of bread.','Use the modeled little-of expression.')],
    ['At the shop','Vorrei un po’ di pane. Anna compra qualche libro; Luca compra alcuni quaderni.','I would like a little bread. Anna buys a few books; Luca buys some notebooks.','read'],['a2-quantity-patterns']),
]);

addUnit('A2', 12, 'Give clear instructions', 'Distinguish familiar commands from polite Lei commands.', [
  AL('a2-tu-commands','Give a familiar instruction','I can use familiar tu commands for taught verbs.','For the modeled verbs, parla, prendi and dormi address one familiar person. A positive command does not include tu.',
    [['parla','speak!'],['prendi','take!'],['dormi','sleep!'],['aspetta','wait!']],
    [['An -are command','Parla or aspetta addresses a familiar person.','Luca, parla più piano.','Luca, speak more slowly.'],['Other verbs','Prendi and dormi are taught familiar command forms.','Anna, prendi il libro.','Anna, take the book.']],
    [Q('Luca, ___ più piano.','Luca, speak more slowly.','parla',['parla','parli','parlare'],'Parla is the positive familiar command.','Address Luca directly.'),Q('Anna, ___ il libro.','Anna, take the book.','prendi',['prendi','prende','prendere'],'Prendi is the taught command.','Address Anna directly.'),Q('Marco, ___ qui.','Marco, wait here.','aspetta',['aspetta','aspetti','aspettare'],'Aspetta is the familiar command.','The prompt addresses Marco.'),Y('Luca, ___ adesso.','Luca, sleep now.','dormi','Dormi is the familiar tu command.','Use the taught imperative.'),Q('Sara, ___ un momento.','Sara, wait a moment.','aspetta',['aspetta','aspetti','aspettare'],'A friend takes aspetta.','Use familiar address.'),Y('Anna, ___ più piano.','Anna, speak more slowly.','parla','Parla addresses one familiar person.','Use the -a command.')],
    ['At home','Anna: «Luca, prendi il libro.» Luca: «Un momento!» Anna: «Va bene, aspetta.»','Anna: “Luca, take the book.” Luca: “One moment!” Anna: “All right, wait.”','read'],['a2-negative-commands']),
  AL('a2-voi-commands','Address more than one person','I can use voi commands with familiar verbs.','For the taught verbs, plural-you commands are parlate, prendete and dormite. Put non before the same plural command to prohibit an action.',
    [['parlate','speak! (plural you)'],['prendete','take! (plural you)'],['dormite','sleep! (plural you)'],['non parlate','do not speak! (plural you)']],
    [['Positive to a group','Use parlate or prendete with more than one addressee.','Anna e Luca, parlate piano.','Anna and Luca, speak quietly.'],['Negative to a group','Non precedes the plural command.','Anna e Luca, non parlate adesso.','Anna and Luca, do not speak now.']],
    [Q('Anna e Luca, ___ piano.','Anna and Luca, speak quietly.','parlate',['parlate','parla','parli'],'Two addressees take parlate.','Use plural you.'),Q('Anna e Sara, ___ il libro.','Anna and Sara, take the book.','prendete',['prendete','prendi','prenda'],'Two addressees take prendete.','The request is to both women.'),Q('Luca e Marco, ___ adesso.','Luca and Marco, sleep now.','dormite',['dormite','dormi','dorma'],'Two addressees take dormite.','Address the group.'),Y('Anna e Luca, ___ adesso.','Anna and Luca, do not speak now.','non parlate','Negative plural you is non parlate.','Use non before the plural command.'),Q('Sara e Giulia, ___ il pane.','Sara and Giulia, take the bread.','prendete',['prendete','prendi','prenda'],'Two people take the voi command.','Use prendete.'),Y('Luca e Marco, ___ il libro.','Luca and Marco, take the book.','prendete','Prendete is the group command.','Use plural-you form.')],
    ['Instructions for two','Anna e Luca, prendete il libro e parlate piano.','Anna and Luca, take the book and speak quietly.','read'],['a2-negative-commands']),
  AL('a2-lei-commands','Give a polite instruction','I can use formal Lei commands for taught verbs.','Formal Lei uses parli, prenda, aspetti in these modeled instructions. Address the listener politely; do not switch to familiar tu forms.',
    [['parli','speak! (polite)'],['prenda','take! (polite)'],['aspetti','wait! (polite)'],['signora','madam']],
    [['A polite request to speak','Parli addresses one person formally.','Signora, parli più piano, per favore.','Madam, speak more slowly, please.'],['Polite take and wait','Prenda and aspetti are formal commands.','Prenda il libro e aspetti qui.','Take the book and wait here.']],
    [Q('Signora, ___ più piano.','Madam, please speak more slowly.','parli',['parli','parla','parlare'],'Formal Lei takes parli.','This is a polite address.'),Q('Dottore, ___ il libro.','Doctor, please take the book.','prenda',['prenda','prendi','prende'],'Prenda is the taught polite command.','Address the doctor formally.'),Q('Signora, ___ qui.','Madam, please wait here.','aspetti',['aspetti','aspetta','aspettare'],'Aspetti is the formal command.','This is polite Lei.'),Y('Dottore, ___ più piano.','Doctor, please speak more slowly.','parli','Formal Lei uses parli.','Use polite command morphology.'),Q('Scusi, ___ il messaggio.','Excuse me, please take the message.','prenda',['prenda','prendi','prendere'],'Scusi marks formal address.','Use prenda.'),Y('Signora, ___ un momento.','Madam, please wait a moment.','aspetti','Aspetti is the polite form.','Use Lei register.')],
    ['At reception','Addetta: «Signora, aspetti qui, per favore. Poi prenda il messaggio.»','Receptionist: “Madam, please wait here. Then take the message.”','listen'],['a2-polite-commands']),
  AL('a2-negative-commands','Tell someone not to act','I can form a negative familiar or polite instruction.','Negative tu uses non + infinitive: non parlare. Negative formal Lei uses non + polite command: non parli.',
    [['non parlare','do not speak (familiar)'],['non prendere','do not take (familiar)'],['non parli','do not speak (polite)'],['non prenda','do not take (polite)']],
    [['To a friend','Use non plus the infinitive with familiar tu.','Luca, non parlare adesso.','Luca, do not speak now.'],['To a stranger','Use non plus the formal Lei command.','Signora, non parli adesso.','Madam, please do not speak now.']],
    [Q('Luca, ___ adesso.','Luca, do not speak now. (familiar)','non parlare',['non parlare','non parli','non parla'],'Familiar negative uses non + infinitive.','Luca is addressed as tu.'),Q('Signora, ___ adesso.','Madam, please do not speak now.','non parli',['non parli','non parlare','non parla'],'Polite negative uses non parli.','The addressee is Lei.'),Q('Anna, ___ il libro.','Anna, do not take the book. (familiar)','non prendere',['non prendere','non prenda','non prendi'],'Familiar negative uses the infinitive.','Use tu register.'),Y('Dottore, ___ il libro.','Doctor, please do not take the book.','non prenda','Polite Lei uses non prenda.','Use the formal command.'),Q('Scusi, ___ qui.','Excuse me, please do not wait here.','non aspetti',['non aspetti','non aspettare','non aspetta'],'Scusi cues formal Lei.','Use the polite command after non.'),Y('Sara, ___ qui.','Sara, do not wait here. (familiar)','non aspettare','Familiar negative uses non + infinitive.','Use the tu form.')],
    ['Two notices','A Luca: «Non parlare adesso.» Alla signora: «Non parli adesso, per favore.»','To Luca: “Do not speak now.” To the woman: “Please do not speak now.”','read'],['a2-negative-commands']),
]);

addUnit('A2', 13, 'Locate and measure time', 'Choose da and common contracted prepositions in bounded contexts.', [
  AL('a2-da-origin','Say where someone comes from','I can use da with venire for a named place.','Vengo da Roma names origin or departure. In this lesson the place is a city and needs no article.',
    [['vengo da','I come from'],['viene da','he or she comes from'],['Roma','Rome'],['Milano','Milan']],
    [['My origin','Use vengo da before a city.','Vengo da Roma.','I come from Rome.'],['Someone else','A named third person uses viene da.','Anna viene da Milano.','Anna comes from Milan.']],
    [Q('Io ___ Roma.','I come from Rome.','vengo da',['vengo da','viene da','vengo a'],'Io takes vengo da.','The city is the origin.'),Q('Anna ___ Milano.','Anna comes from Milan.','viene da',['viene da','vengo da','viene a'],'Anna takes viene da.','The city is where she comes from.'),Q('Luca ___ Napoli.','Luca comes from Naples.','viene da',['viene da','vengo da','va da'],'Luca takes viene da.','The city is the source.'),Y('Io ___ Milano.','I come from Milan.','vengo da','Vengo da names my origin.','Use the I form plus da.'),Q('Sara ___ Roma?','Does Sara come from Rome?','viene da',['viene da','vengo da','viene a'],'A question keeps Sara as subject.','Use third person.'),Y('Anna ___ Napoli.','Anna comes from Naples.','viene da','Anna takes viene da.','Write verb and preposition.')],
    ['At the station','Anna viene da Milano. Luca viene da Roma. Io vengo da Napoli.','Anna comes from Milan. Luca comes from Rome. I come from Naples.','listen'],['a2-da-place-time']),
  AL('a2-da-duration','Say how long a state has lasted','I can use da with present for a state continuing up to now.','Abito qui da due anni means I have lived here for two years and still live here. Italian uses present in this ongoing frame.',
    [['da due anni','for two years (continuing)'],['da ieri','since yesterday'],['abito qui','I live here'],['studio italiano','I study Italian'],['lavora','he or she works']],
    [['A continuing residence','Present plus da names duration up to now.','Abito qui da due anni.','I have lived here for two years.'],['A continuing activity','The same frame works with an activity still underway.','Studio italiano da sei mesi.','I have studied Italian for six months.']],
    [Q('Abito qui ___ due anni.','I have lived here for two years and still live here.','da',['da','per','di'],'Present plus da gives ongoing duration.','The situation continues now.'),Q('Studio italiano ___ sei mesi.','I have studied Italian for six months and still do.','da',['da','per','a'],'Da marks duration continuing to now.','The studying continues.'),Q('Anna abita a Roma ___ ieri.','Anna has lived in Rome since yesterday and still does.','da',['da','per','di'],'Da ieri means since yesterday.','The state is ongoing.'),Y('Io studio italiano ___ un anno.','I have studied Italian for one year and still do.','da','Ongoing duration takes da.','The present verb continues now.'),Q('Luca lavora qui ___ tre anni.','Luca has worked here for three years and still does.','da',['da','per','su'],'Da marks duration up to now.','He still works here.'),Y('Anna abita qui ___ due mesi.','Anna has lived here for two months and still does.','da','Da names the ongoing duration.','Use the continuing-state frame.')],
    ['A new neighbor','Anna abita qui da due anni. Luca studia italiano da sei mesi.','Anna has lived here for two years. Luca has studied Italian for six months.','read'],['a2-da-place-time']),
  AL('a2-del-dal','Read source and possession contractions','I can understand del and dal with masculine singular nouns.','Di + il becomes del in a relation such as the book of the teacher; da + il becomes dal for from the person or place.',
    [['del','of the (di + il)'],['dal','from the (da + il)'],['museo','museum','il','musei'],['professore','teacher','il','professori']],
    [['A relation','Del joins di and il before a masculine noun.','Il libro del professore è qui.','The teacher’s book is here.'],['From a place or person','Dal joins da and il.','Vengo dal museo.','I come from the museum.']],
    [Q('Il libro ___ professore è qui.','The teacher’s book is here.','del',['del','dal','al'],'Del means of the.','The teacher is the owner.'),Q('Vengo ___ museo.','I come from the museum.','dal',['dal','del','nel'],'Dal means from the.','The museum is the point of departure.'),Q('La lettera ___ professore è qui.','The teacher’s letter is here.','del',['del','dal','sul'],'Del marks whose letter it is.','The relation is of the.'),Y('Luca viene ___ museo.','Luca comes from the museum.','dal','Da + il contracts to dal.','Mark the source of movement.'),Q('Il messaggio ___ dottore è qui.','The doctor’s message is here.','del',['del','dal','al'],'Del gives the relationship to the doctor.','The relation is of the.'),Y('La casa ___ professore è grande.','The teacher’s house is big.','del','The owner follows del.','Use di + il.')],
    ['After a visit','Vengo dal museo. Il libro del professore è nel mio zaino.','I come from the museum. The teacher’s book is in my backpack.','read'],['a2-da-place-time']),
  AL('a2-preposition-contractions','Use common place contractions','I can use al, nel and sul with familiar place nouns.','A + il becomes al; in + il becomes nel; su + il becomes sul. Learn each with its place meaning.',
    [['al','to the (a + il)'],['nel','in the (in + il)'],['sul','on the (su + il)'],['tavolo','table','il','tavoli'],['museo','museum','il','musei']],
    [['Destination and inside','Vado al museo; sono nel museo.','Vado al museo. Sono nel museo.','I go to the museum. I am in the museum.'],['On a surface','Sul tavolo means on the table.','Il libro è sul tavolo.','The book is on the table.']],
    [Q('Vado ___ museo.','I go to the museum.','al',['al','nel','sul'],'A + il contracts to al for this destination.','The motion goes to the museum.'),Q('Sono ___ museo.','I am inside the museum.','nel',['nel','al','sul'],'In + il gives nel.','The location is inside.'),Q('Il libro è ___ tavolo.','The book is on the table.','sul',['sul','nel','al'],'Su + il gives sul.','The book rests on top.'),Y('Anna va ___ museo.','Anna goes to the museum.','al','Al marks destination to the museum.','Use a + il.'),Q('Il messaggio è ___ libro.','The message is in the book.','nel',['nel','sul','al'],'Nel means inside the book.','Use in + il.'),Y('La lettera è ___ tavolo.','The letter is on the table.','sul','Sul marks the surface.','Use su + il.')],
    ['At the museum','Anna va al museo. Luca è nel museo. Il libro è sul tavolo.','Anna goes to the museum. Luca is inside the museum. The book is on the table.','read'],['a2-da-place-time']),
]);

addUnit('A2', 14, 'Connect and understand a small story', 'Link causes, referents, and real possibilities.', [
  AL('a2-link-reason-sequence','Link a reason and sequence','I can use perché, poi and quindi for different relations.','Perché gives a reason; poi marks what happens next; quindi introduces a consequence. Context decides which relation is intended.',
    [['perché','because'],['poi','then'],['quindi','so; therefore'],['piove','it is raining']],
    [['Reason','Give the reason after perché.','Resto a casa perché piove.','I stay home because it is raining.'],['Next versus result','Poi orders events; quindi gives a consequence.','Piove; quindi resto a casa.','It is raining, so I stay home.']],
    [Q('Resto a casa ___ piove.','I stay home because it is raining.','perché',['perché','poi','quindi'],'Perché introduces the reason.','Rain explains staying.'),Q('Prima mangio, ___ leggo.','First I eat, then I read.','poi',['poi','perché','quindi'],'Poi orders the second action.','The prompt says then.'),Q('Piove; ___ resto a casa.','It is raining, so I stay home.','quindi',['quindi','poi','perché'],'Quindi gives the consequence.','Staying follows from the rain.'),Y('Vado al museo ___ voglio vedere i libri.','I go to the museum because I want to see the books.','perché','Perché introduces the reason.','The second clause answers why.'),Q('Anna ha preso il libro; ___ è uscita.','Anna took the book; then she went out.','poi',['poi','perché','quindi'],'Poi reports the next event.','This is sequence.'),Y('Ho fame; ___ mangio.','I am hungry, so I eat.','quindi','Quindi links cause to consequence.','The eating follows from hunger.')],
    ['Why Anna stayed home','Pioveva, quindi Anna era a casa. Poi Luca ha chiamato.','It was raining, so Anna was at home. Then Luca called.','listen'],['a2-linking-ideas']),
  AL('a2-relative-che','Identify a thing with che','I can join two short ideas with relative che.','Relative che means who or that in these short clauses and does not change form for person, gender or number.',
    [['che','who; that; which'],['il libro che leggo','the book that I read'],['la donna che parla','the woman who speaks']],
    [['A thing','The second clause identifies the already named noun.','Il libro che leggo è piccolo.','The book that I am reading is small.'],['A person','Che can also identify a person.','La donna che parla è Anna.','The woman who is speaking is Anna.']],
    [Q('Il libro ___ leggo è piccolo.','The book that I read is small.','che',['che','di','da'],'Che links book to the identifying action.','The relative clause identifies the book.'),Q('La donna ___ parla è Anna.','The woman who speaks is Anna.','che',['che','di','a'],'Che also identifies a person.','The next clause tells which woman.'),Q('I libri ___ leggo sono piccoli.','The books that I read are small.','che',['che','chi','quali'],'Che stays unchanged with plural books.','The relative does not agree.'),Y('Luca è l’uomo ___ parla con Anna.','Luca is the man who speaks with Anna.','che','Che identifies the man.','Use the unchanged relative.'),Q('La casa ___ vedo è grande.','The house that I see is big.','che',['che','cui','di'],'Che introduces the direct identifying clause.','The speaker sees the house.'),Y('Anna è la donna ___ legge.','Anna is the woman who is reading.','che','Relative che identifies Anna.','Use the same form for a woman.')],
    ['A person in the museum','La donna che parla con Luca è Anna. Il libro che Anna legge è piccolo.','The woman speaking with Luca is Anna. The book Anna is reading is small.','read'],['a2-relative-che']),
  AL('a2-real-if','Talk about a real possibility','I can use se with present for an open real condition.','Se plus present can state a real possibility; the other clause can use present or a learned future form. This lesson does not teach hypothetical se + subjunctive.',
    [['se','if'],['piove','it rains'],['resto','I stay'],['andrò','I will go'],['rispondo','I answer']],
    [['A real possibility now','Se piove, resto a casa describes what I do if rain happens.','Se piove, resto a casa.','If it rains, I stay home.'],['A possible future result','The result may use an already learned future form.','Se non piove, andrò al museo.','If it does not rain, I will go to the museum.']],
    [Q('___ piove, resto a casa.','If it rains, I stay home.','Se',['Se','Perché','Quindi'],'Se introduces the condition.','The rain is possible.'),Q('Se non piove, io ___ al museo.','If it does not rain, I will go to the museum.','andrò',['andrò','andrei','sono andato'],'The result is a real future plan.','Use the learned I future.'),Q('Se Anna chiama, io ___.','If Anna calls, I answer.','rispondo',['rispondo','risponderei','ho risposto'],'An open present condition may take a present result.','The prompt says I answer.'),Y('___ ho tempo, leggo il libro.','If I have time, I read the book.','Se','Se begins the real condition.','The time may be available.'),Q('___ Luca arriva, mangiamo.','If Luca arrives, we eat.','Se',['Se','Perché','Poi'],'The arrival is the condition.','Use if.'),Y('Se non piove, io ___ a Roma.','If it does not rain, I will go to Rome.','andrò','The possible future result uses andrò.','Use the taught future form.')],
    ['A possible afternoon','Se piove, Anna resta a casa. Se non piove, andrà al museo.','If it rains, Anna stays home. If it does not rain, she will go to the museum.','listen'],['a2-linking-ideas']),
]);

function addSourceLesson(id,title,outcome,modality,words,models,sources,portfolio) {
  const lessonId=`v2-${id}`,targetId=`${lessonId}.detail`,steps=[];
  const step=(kind,data)=>{const s={id:`${lessonId}.s${steps.length+1}`,kind,...data};steps.push(s);return s;};
  step('words',{title:'Words in the short sources',body:'Read or hear these before answering.',words:words.map(w=>Array.isArray(w)?W(...w):W(w,w))});
  for(const m of models)step('teach',{title:m[0],body:m[1],examples:[{it:m[2],en:m[3]}],introduces:[targetId]});
  sources.forEach((s,i)=>{
    const passage=step('passage',{title:s[0],it:s[1],en:s[2],mode:modality==='listening'?'listen':'read',...(i===sources.length-1?{reserve:true}:{}),task:i===0?'Follow the short model before the guided question.':'Use this source to answer the next question.'});
    if(modality==='listening')passage.audioId=passage.id;
    step('question',{target:targetId,facet:'find-stated-detail',stage:i===0?'guided':'independent',...(i===sources.length-1?{reserve:true}:{}),
      contextKey:`${lessonId}.source-${i}`,format:'choice',prompt:s[3],answer:s[4],options:s[5],
      ...(modality==='listening'?{audioId:passage.id}:{passageId:passage.id}),
      explanation:s[6],hint:s[7],speak:s[8]});
  });
  step('portfolio',{title:portfolio[0],prompt:portfolio[1],mode:portfolio[2],model:portfolio[3],rubric:portfolio[4]});
  step('teach',{title:'Keep this strategy',body:modality==='listening'?'Listen for the requested detail before checking the transcript.':'Find the named person, action or time in the Italian source before opening the translation.',examples:[{it:models.at(-1)[2],en:models.at(-1)[3]}],introduces:[]});
  packs.A2.units.at(-1).lessons.push({id:lessonId,title,outcome,minutes:7,prerequisites:[previousLesson],related:[],legacyLessonIds:[],
    takeaway:modality==='listening'?'Listen for the requested detail in a new short exchange.':'Find a requested detail in a new short Italian text.',
    targets:[{id:targetId,label:title,explanation:outcome,facets:['find-stated-detail'],minIndependent:2,requiresProduction:false,modality,
      repair:{title:'Find the detail again',body:models[0][1],examples:[{it:models[0][2],en:models[0][3]}]}}],steps});
  previousLesson=lessonId;
}

addSourceLesson('a2-read-small-story','Read a short past story','I can find who did what in a short past narrative.','reading',
  [['mentre','while'],['poi','then'],['ha chiamato','called'],['è arrivato','arrived (male)']],
  [['Look for the event','First locate the completed action in the short story.','Anna era a casa. Luca ha chiamato.','Anna was at home. Luca called.'],['Track the named person','A pronoun or event belongs to the person named nearby.','Luca ha chiamato Anna.','Luca called Anna.']],
  [
    ['A call','Anna era al museo. Poi Luca ha chiamato. Anna è uscita.','Anna was at the museum. Then Luca called. Anna went out.','Who called Anna?','Luca',['Luca','Anna','Marco'],'Luca is the named caller.','Find ha chiamato.','Luca ha chiamato Anna.'],
    ['Bread at home','Luca era a casa quando Sara ha comprato il pane. Poi hanno mangiato.','Luca was at home when Sara bought bread. Then they ate.','Who bought the bread?','Sara',['Sara','Luca','Anna'],'Sara is the person who bought it.','Find ha comprato.','Sara ha comprato il pane.'],
    ['A visitor','Anna leggeva un libro quando Marco è arrivato. Anna ha preso il libro.','Anna was reading a book when Marco arrived. Anna took the book.','Who arrived?','Marco',['Marco','Anna','Luca'],'Marco is the named arrival.','Find è arrivato.','Marco è arrivato.'],
    ['Rain and a train','Pioveva. Anna ha preso il treno per Milano. Luca era a casa.','It was raining. Anna took the train to Milan. Luca was at home.','What did Anna take?','il treno',['il treno','il libro','la pizza'],'Anna took the train.','Find ha preso.','Anna ha preso il treno.'],
    ['A message first','Ieri Sara ha scritto un messaggio a Luca. Poi è andata al museo.','Yesterday Sara wrote Luca a message. Then she went to the museum.','What did Sara do first?','ha scritto un messaggio',['ha scritto un messaggio','è andata al museo','ha preso il treno'],'Scrivere precedes poi.','First action comes before poi.','Sara ha scritto un messaggio.'],
    ['A later call','Luca stava leggendo a casa. Giulia ha chiamato; Luca ha parlato con Giulia.','Luca was reading at home. Giulia called; Luca spoke with Giulia.','Who called?','Giulia',['Giulia','Luca','Sara'],'Giulia is the subject of ha chiamato.','Track the named caller.','Giulia ha chiamato Luca.'],
  ],['Retell a small story','Write two sentences about the background and event from one source, then compare with the model.','write','Luca stava leggendo a casa. Giulia ha chiamato.',['Name the background action.','Name the completed event.','Keep the actors clear.']]);

addSourceLesson('a2-listen-service','Understand a short spoken request','I can identify the request or answer in a new service exchange.','listening',
  [['vorrei','I would like'],['potrebbe','could you (polite)'],['biglietto','ticket','il','biglietti'],['acqua','water'],['parte','he or she / it leaves'],['subito','right away']],
  [['Listen for the request','A speaker may ask for an item using vorrei.','Vorrei un biglietto, per favore.','I would like a ticket, please.'],['Listen for the answer','The reply may name a time, quantity or place.','Il treno parte alle otto.','The train leaves at eight.']],
  [
    ['At the counter','Cliente: «Vorrei un biglietto per Roma.» Addetta: «Certo, un biglietto per Roma.»','Customer: “I would like a ticket to Rome.” Clerk: “Certainly, one ticket to Rome.”','Where does the customer want to go?','Roma',['Roma','Milano','Napoli'],'The request names Roma.','Listen after per.','Il cliente vuole andare a Roma.'],
    ['A coffee','Cliente: «Vorrei un caffè, per favore.» Barista: «Subito.»','Customer: “I would like a coffee, please.” Barista: “Right away.”','What does the customer ask for?','un caffè',['un caffè','un libro','un biglietto'],'The customer asks for coffee.','Listen after vorrei.','Vorrei un caffè, per favore.'],
    ['Departure time','Viaggiatrice: «Quando parte il treno?» Addetto: «Parte alle otto.»','Traveler: “When does the train leave?” Clerk: “It leaves at eight.”','When does the train leave?','alle otto',['alle otto','alle sette','alle nove'],'The reply gives eight o’clock.','Listen to the clerk’s answer.','Il treno parte alle otto.'],
    ['At reception','Ospite: «Potrebbe ripetere, per favore?» Addetta: «Sì, il museo è vicino.»','Guest: “Could you repeat, please?” Receptionist: “Yes, the museum is nearby.”','What does the guest ask the clerk to do?','ripetere',['ripetere','scrivere','aspettare'],'The guest asks for repetition.','Listen after potrebbe.','L’ospite chiede di ripetere.'],
    ['Some water','Cliente: «Vorrei un po’ d’acqua.» Barista: «Certo.»','Customer: “I would like a little water.” Barista: “Certainly.”','What does the customer request?','acqua',['acqua','pane','caffè'],'The requested drink is water.','Listen for the word after un po’.','Vorrei un po’ d’acqua.'],
    ['Two tickets','Cliente: «Vorrei due biglietti per Milano.» Addetta: «Due per Milano, certo.»','Customer: “I would like two tickets to Milan.” Clerk: “Two to Milan, certainly.”','How many tickets are requested?','due',['due','uno','tre'],'The customer asks for two tickets.','Listen before biglietti.','Vorrei due biglietti per Milano.'],
  ],['Practise a service request','Record or rehearse a short request for a ticket or drink, then compare it with the model.','speak','Buongiorno. Vorrei un biglietto per Roma, per favore.',['Open politely.','Name the requested thing clearly.','Use a courtesy expression.']]);

await mkdir(ROOT, { recursive: true });
const selectedLevel = process.argv.includes('--level') ? process.argv[process.argv.indexOf('--level') + 1] : null;
if (selectedLevel && !Object.hasOwn(packs, selectedLevel)) throw new Error(`Unknown level: ${selectedLevel}`);
for (const [level, pack] of Object.entries(packs)) {
  if (selectedLevel && level !== selectedLevel) continue;
  if (!pack.units.length) continue;
  if (level==='Foundations' || level==='A1') refineBeginnerPack(pack);
  await writeFile(new URL(`${level}.json`, ROOT), `${JSON.stringify(pack, null, 2)}\n`);
  const lessons = pack.units.reduce((n, u) => n + u.lessons.length, 0);
  console.log(`${level}: ${pack.units.length} units, ${lessons} lessons`);
}
