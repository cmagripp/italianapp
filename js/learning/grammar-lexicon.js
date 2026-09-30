// Reviewed lookup-only additions for authored grammar examples and answer sentences.
// These are not learning entries. In particular, a standalone verb form below
// does not ask the conjugator to invent an unaudited full paradigm.
const noun = (it, en, g, pl, note = '') => ({
  id: `grammar:${it}|noun`, it, en, pos: 'noun', g, pl,
  lookupSource: 'curated', ...(note ? { note } : {}),
});
const adjective = (it, en, forms, note = '') => ({
  id: `grammar:${it}|adj`, it, en, pos: 'adj', forms,
  lookupSource: 'curated', ...(note ? { note } : {}),
});
const verbForm = (it, en, lemma, note) => ({
  id: `grammar:${it}|form`, it, en, pos: 'verb form',
  lookupSource: 'curated', note: `${note} Form of ${lemma}.`,
});

export const GRAMMAR_LOOKUP_ENTRIES = [
  noun('zuppa', 'soup', 'f', 'zuppe'),
  noun('richiesta', 'request; application', 'f', 'richieste'),
  noun('chiarezza', 'clarity', 'f', '-', 'A quality normally used as a mass noun in this sense.'),
  noun('servizio', 'service', 'm', 'servizi'),
  noun('cautela', 'caution; care', 'f', '-', 'In this sense caution is normally a mass noun; cautele can mean precautions.'),
  noun('chiusura', 'closure; closing', 'f', 'chiusure'),
  noun('raccolta', 'collection; gathering', 'f', 'raccolte'),
  noun('segreteria', 'office; secretariat', 'f', 'segreterie'),
  noun('tabellone', 'display board; scoreboard', 'm', 'tabelloni'),
  noun('partecipante', 'participant', 'mf', 'partecipanti', 'The same noun form serves both genders; the article shows the gender.'),
  noun('regno', 'kingdom; realm', 'm', 'regni', 'Capitalized in the historical name Regno d’Italia.'),
  noun('messaggero', 'messenger', 'm', 'messaggeri'),
  noun('apertura', 'opening; opening time', 'f', 'aperture'),
  adjective('necessario', 'necessary', ['necessario', 'necessaria', 'necessari', 'necessarie']),
  adjective('rapido', 'fast; quick', ['rapido', 'rapida', 'rapidi', 'rapide']),
  adjective('incompleto', 'incomplete', ['incompleto', 'incompleta', 'incompleti', 'incomplete']),
  adjective('antico', 'ancient; old', ['antico', 'antica', 'antichi', 'antiche']),
  adjective('breve', 'short; brief', ['breve', 'breve', 'brevi', 'brevi']),
  adjective('fermo', 'still; stationary; stopped', ['fermo', 'ferma', 'fermi', 'ferme']),
  adjective('corretto', 'correct', ['corretto', 'corretta', 'corretti', 'corrette']),
  adjective('assente', 'absent', ['assente', 'assente', 'assenti', 'assenti']),
  adjective('nascosto', 'hidden', ['nascosto', 'nascosta', 'nascosti', 'nascoste']),
  adjective('atteso', 'expected; awaited', ['atteso', 'attesa', 'attesi', 'attese']),
  // Each missing lexical verb is represented by an attested form only. There
  // is no grammar course need to display unattested persons or tenses here.
  verbForm('inizia', 'he/she/it begins; starts', 'iniziare', 'Third-person singular present indicative.'),
  verbForm('iniziato', 'begun; started', 'iniziare', 'Past participle.'),
  verbForm('iniziò', 'he/she/it began', 'iniziare', 'Third-person singular passato remoto.'),
  verbForm('terminato', 'finished; completed', 'terminare', 'Past participle.'),
  verbForm('terminata', 'finished; completed (feminine singular)', 'terminare', 'Feminine singular past participle.'),
  verbForm('inaugurato', 'inaugurated; opened officially', 'inaugurare', 'Past participle.'),
  verbForm('esaminate', 'examined; reviewed (feminine plural)', 'esaminare', 'Feminine plural past participle.'),
  verbForm('esaminato', 'examined; reviewed', 'esaminare', 'Past participle.'),
  verbForm('applaudì', 'he/she applauded', 'applaudire', 'Third-person singular passato remoto.'),
  verbForm('squillò', 'it rang', 'squillare', 'Third-person singular passato remoto.'),
  verbForm('ripreso', 'resumed; started again', 'riprendere', 'Past participle.'),
  verbForm('proclamò', 'he/she/it proclaimed', 'proclamare', 'Third-person singular passato remoto.'),
  verbForm('rivisto', 'reviewed; revised', 'rivedere', 'Past participle.'),
  verbForm('deviare', 'to detour; to change course', 'deviare', 'Infinitive.'),
  verbForm('deviamo', 'we detour; we change course', 'deviare', 'First-person plural present indicative.'),
  verbForm('avvenuta', 'happened; occurred (feminine singular)', 'avvenire', 'Feminine singular past participle.'),
  verbForm('puntiamo', 'we aim', 'puntare', 'First-person plural present indicative.'),
  verbForm('informare', 'to inform', 'informare', 'Infinitive.'),
];

// An alias is attached only to an existing catalog lemma. This is an explicit
// attestation of the surface form, not a suffix rule or extra conjugation.
export const GRAMMAR_LOOKUP_ALIASES = {
  leggere: ['leggerlo'], vedere: ['vederlo'], dare: ['darmi'],
  prendere: ['prenderlo'], comprare: ['comprati'], conoscere: ['conosciuti'],
  chiamare: ['chiamami'], scrivere: ['scritte', 'scritta'], aiutare: ['aiutarti'],
  nascondere: ['nascosta'], discutere: ['discussa'], superare: ['superata'],
  rinviare: ['rinviata'], prevedere: ['prevista'], avvisare: ['avvisateci'],
  notare: ['notarlo'], comunicare: ['comunicata'], risolvere: ['risolverlo'],
  confermare: ['confermarmi'], indicare: ['indicarmi'], inviare: ['inviarmi'],
  mandare: ['mandami'], potere: ['poter'], avere: ['averlo'],
  comodo: ['comodissime'], buono: ['buonissime'], bello: ['bellissima'],
};

// The singular lemma is already in the catalog, but its note explicitly
// records le colleghe. Supply that attested feminine plural to the local
// lookup copy so the popover can say la collega / le colleghe.
export const GRAMMAR_LOOKUP_ENTRY_PATCHES = {
  'w:collega|noun': { fem: 'collega', femPl: 'colleghe' },
};

export const GRAMMAR_LOOKUP_FUNCTIONS = [
  ['fino', 'prep', 'until; up to (often followed by a)'],
  ["po'", 'adv', 'a little; a bit (short for poco, often in un po’ di)'],
  ['gliela', 'pron', 'to him, her, or them + her or it (feminine singular direct object)'],
  ['quante', 'det', 'how many (feminine plural)'],
  ['quanti', 'det', 'how many (masculine plural)'],
  ['quali', 'pron', 'who; which (plural relative or interrogative)'],
  ['pur', 'conj', 'although; even though (before a gerund)'],
  ['troppe', 'det', 'too many (feminine plural)'],
];

export const GRAMMAR_LOOKUP_NAMES = ['Marta', 'Lucia', 'Elena', 'Laura'];
export const GRAMMAR_LOOKUP_PLACES = [['piemonte', 'Piedmont']];

// `lemma` confines each form note to the linked lexical candidate. Bare
// homographs therefore do not inherit a misleading grammatical explanation.
export const GRAMMAR_LOOKUP_FORM_NOTES = [
  { lemma: 'leggere', form: 'leggerlo', note: 'Leggere + lo: to read it; lo is an attached masculine singular direct-object pronoun.' },
  { lemma: 'vedere', form: 'vederlo', note: 'Vedere + lo: to see it; the final -e of the infinitive drops before lo.' },
  { lemma: 'dare', form: 'darmi', note: 'Dare + mi: to give me; the final -e of the infinitive drops before mi.' },
  { lemma: 'prendere', form: 'prenderlo', note: 'Prendere + lo: to take it; the final -e of the infinitive drops before lo.' },
  { lemma: 'comprare', form: 'comprati', note: 'Masculine plural past participle of comprare; it can agree with a counted object after ne.' },
  { lemma: 'conoscere', form: 'conosciuti', note: 'Masculine plural past participle of conoscere.' },
  { lemma: 'chiamare', form: 'chiamami', note: 'Familiar singular command chiama + mi: call me.' },
  { lemma: 'scrivere', form: 'scritte', note: 'Feminine plural past participle of scrivere.' },
  { lemma: 'scrivere', form: 'scritta', note: 'Feminine singular past participle of scrivere.' },
  { lemma: 'aiutare', form: 'aiutarti', note: 'Aiutare + ti: to help you.' },
  { lemma: 'nascondere', form: 'nascosta', note: 'Feminine singular past participle of nascondere; also used adjectivally for hidden.' },
  { lemma: 'discutere', form: 'discussa', note: 'Feminine singular past participle of discutere.' },
  { lemma: 'superare', form: 'superata', note: 'Feminine singular past participle of superare.' },
  { lemma: 'rinviare', form: 'rinviata', note: 'Feminine singular past participle of rinviare.' },
  { lemma: 'prevedere', form: 'prevista', note: 'Feminine singular past participle of prevedere: scheduled or expected.' },
  { lemma: 'avvisare', form: 'avvisateci', note: 'Plural command avvisate + ci: inform us.' },
  { lemma: 'notare', form: 'notarlo', note: 'Notare + lo: to notice it.' },
  { lemma: 'comunicare', form: 'comunicata', note: 'Feminine singular past participle of comunicare.' },
  { lemma: 'risolvere', form: 'risolverlo', note: 'Risolvere + lo: to solve it.' },
  { lemma: 'confermare', form: 'confermarmi', note: 'Confermare + mi: to confirm to me.' },
  { lemma: 'indicare', form: 'indicarmi', note: 'Indicare + mi: to tell or indicate to me.' },
  { lemma: 'inviare', form: 'inviarmi', note: 'Inviare + mi: to send to me.' },
  { lemma: 'mandare', form: 'mandami', note: 'Familiar singular command manda + mi: send me.' },
  { lemma: 'potere', form: 'poter', note: 'Poter is a shortened infinitive of potere before another infinitive.' },
  { lemma: 'avere', form: 'averlo', note: 'Avere + lo: to have it; lo attaches to the shortened infinitive aver.' },
  { lemma: 'comodo', form: 'comodissime', note: 'Feminine plural absolute superlative: extremely comfortable.' },
  { lemma: 'buono', form: 'buonissime', note: 'Feminine plural absolute superlative: extremely good.' },
  { lemma: 'bello', form: 'bellissima', note: 'Feminine singular absolute superlative: extremely beautiful.' },
];
