// Reviewed everyday predicates. These are deliberately separate from dictionary examples:
// a learner's tense enrollment must not be bypassed by an untagged example sentence.
export const ANCHOR_CONTEXTS = {
  essere: ['a casa', 'in biblioteca'], avere: ['tempo per leggere', 'bisogno di aiuto'],
  fare: ['una passeggiata', 'una domanda'], andare: ['al mercato', 'a scuola'],
  stare: ['a casa', 'qui con la famiglia'], dare: ['una mano a Marco', 'un consiglio a Sara'],
  dire: ['la verità', 'qualcosa di importante'], potere: ['parlare con Sara', 'telefonare a Marco'],
  volere: ['un po’ di aiuto', 'parlare con Sara'], dovere: ['studiare italiano', 'telefonare a Marco'],
  sapere: ['la risposta', 'la verità'], venire: ['a cena', 'qui in autobus'],
  uscire: ['di casa', 'dall’ufficio'], mangiare: ['un panino', 'la pasta'],
  bere: ['un bicchiere d’acqua', 'un tè'], parlare: ['con Sara', 'del viaggio'],
  alzarsi: ['alle sette', 'presto'], lavorare: ['in ufficio', 'con Marco'],
  studiare: ['italiano', 'in biblioteca'], prendere: ['l’autobus', 'un caffè'],
  vedere: ['Marco al mercato', 'un film italiano'], capire: ['la domanda', 'il problema'],
  dormire: ['a casa', 'in albergo'], arrivare: ['in stazione', 'a casa'],
};

export const TENSE_LESSONS = {
  presente: 'Use the presente for what happens now or regularly. Start with the person, then choose the matching ending. Common verbs such as essere and andare have forms to learn individually.',
  passatoProssimo: 'Build the passato prossimo with the present of avere or essere plus a past participle. Learn the auxiliary with the verb in its context. With essere, the participle agrees with the subject.',
  imperfetto: 'Use the imperfetto to describe a past habit, a state or an action in progress as background. Use the passato prossimo to present a completed episode. The intended meaning matters, not a single word such as ieri.',
  futuro: 'Use the futuro semplice to say what will happen. Learn the future stem, then add ò, ai, à, emo, ete, anno. The present can also describe a scheduled plan, so these form exercises explicitly request the future.',
  condizionale: 'The present conditional expresses wishes, polite requests and hypothetical outcomes. Learn the conditional stem and the endings ei, esti, ebbe, emmo, este, ebbero.',
  imperativo: 'The imperative gives a request or instruction. Its person pattern differs from the indicative; formal Lei and informal tu have different forms.',
  trapassatoProssimo: 'The trapassato prossimo presents an event before another past event. Use the imperfetto of the auxiliary plus the past participle.',
  passatoRemoto: 'The passato remoto presents completed past events, especially in narration, with regional differences in spoken use. Many common verbs have irregular forms.',
  congiuntivoPresente: 'The congiuntivo presente occurs in constructions expressing wishes, doubts and opinions. The surrounding construction determines the mood; a form drill checks the conjugation only.',
  congiuntivoImperfetto: 'The congiuntivo imperfetto is used in several past, hypothetical and wish constructions. Learn it with the surrounding sentence and its tense relationship.',
};

export const ERROR_TIPS = {
  person: 'Check who is doing the action. Match the ending or auxiliary to the requested person.',
  tense: 'You used a different tense. Read the time or intended meaning in the prompt, then build that form.',
  auxiliary: 'Keep the participle and change the auxiliary. Learn avere or essere with this verb and its meaning.',
  auxiliaryPerson: 'The auxiliary is the right verb, but its person is different. Check io, tu, lui/lei, noi, voi or loro.',
  participle: 'Focus on the past participle. Some common participles are irregular and need their own example.',
  agreement: 'With essere, match the participle to the subject: masculine/feminine and singular/plural.',
  clitic: 'Keep the small pronoun with the verb and match it to the subject. For example: mi alzo, ti alzi, si alza.',
  accent: 'The form is otherwise right. Notice the written accent; it can distinguish verb forms.',
  article: 'Check the noun’s gender, number and first sound before choosing its article.',
  plural: 'Recall the plural of this noun. Some plurals change spelling; some nouns stay the same.',
  meaning: 'Revisit the meaning in the example, then try to retrieve it without looking.',
  recall: 'Connect the Italian word with its meaning, then try a fresh retrieval without the answer visible.',
  spelling: 'Listen or look carefully at the spelling, then try the word again after another question.',
  uncertain: 'Let’s break this into a smaller step. Compare the model with your answer; one answer alone does not tell us exactly why it was difficult.',
};

// Weather senses use impersonal third-person singular in the everyday course.
// Full/figurative paradigms can still be consulted in the reference.
export const WEATHER_VERBS = new Set(['piovere', 'nevicare', 'grandinare', 'tuonare', 'lampeggiare', 'diluviare', 'piovigginare', 'nevischiare', 'albeggiare', 'imbrunire', 'annottare']);
