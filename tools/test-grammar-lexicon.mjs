import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSentenceLookup, tokenizeItalianSentence } from '../js/learning/sentence-lookup.js';
import {
  GRAMMAR_LOOKUP_ENTRIES, GRAMMAR_LOOKUP_ENTRY_PATCHES, GRAMMAR_LOOKUP_ALIASES,
  GRAMMAR_LOOKUP_FUNCTIONS, GRAMMAR_LOOKUP_NAMES, GRAMMAR_LOOKUP_PLACES,
  GRAMMAR_LOOKUP_FORM_NOTES,
} from '../js/learning/grammar-lexicon.js';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const vocab = read('../data/vocab.json');
const verbs = read('../data/verbs.json');
const lookup = createSentenceLookup({ vocab, verbs });
const candidate = (word, sentence, id) => {
  const result = lookup(word, { sentence });
  const found = result.candidates.find(item => item.id === id);
  assert(found, `${word} in “${sentence}” should resolve to ${id}; got ${result.candidates.map(x => x.id).join(', ') || 'unavailable'}`);
  return found;
};

const ids = GRAMMAR_LOOKUP_ENTRIES.map(e => e.id);
assert.equal(new Set(ids).size, ids.length, 'Curated lookup entries need stable, unique IDs.');
for (const e of GRAMMAR_LOOKUP_ENTRIES) {
  assert(e.lookupSource === 'curated' && e.it && e.en && e.pos, `Incomplete curated entry ${e.id}`);
  if (e.pos === 'noun') assert(['m', 'f', 'mf'].includes(e.g) && e.pl, `Missing reviewed noun gender/number ${e.id}`);
  if (e.pos === 'verb form') assert(!e.inf, `Do not generate a paradigm for a standalone verb form ${e.id}`);
}
const catalogLemmas = new Set([...vocab, ...verbs].map(e => e.inf || e.it));
for (const [lemma, forms] of Object.entries(GRAMMAR_LOOKUP_ALIASES)) {
  assert(catalogLemmas.has(lemma), `Alias refers to missing catalog lemma ${lemma}`);
  assert(forms.length && new Set(forms).size === forms.length, `Alias forms not unique for ${lemma}`);
}
for (const { lemma, form, note } of GRAMMAR_LOOKUP_FORM_NOTES) {
  assert(GRAMMAR_LOOKUP_ALIASES[lemma]?.includes(form), `A form note lacks its explicit alias: ${lemma}/${form}`);
  assert(note && !/in this sentence|here it/i.test(note), `Form note must be valid without a particular sentence: ${lemma}/${form}`);
}
assert(GRAMMAR_LOOKUP_ENTRY_PATCHES['w:collega|noun']?.femPl === 'colleghe');
assert(GRAMMAR_LOOKUP_FUNCTIONS.some(([word, pos]) => word === 'gliela' && pos === 'pron'));
assert(GRAMMAR_LOOKUP_NAMES.includes('Marta'));
assert(GRAMMAR_LOOKUP_PLACES.some(([place]) => place === 'piemonte'));

const zuppa = candidate('zuppa', 'Per cena mangio una zuppa.', 'grammar:zuppa|noun');
assert.equal(zuppa.singular, 'la zuppa');
assert.equal(zuppa.plural, 'le zuppe');
const richieste = candidate('richieste', 'Le richieste saranno esaminate domani.', 'grammar:richiesta|noun');
assert.equal(richieste.singular, 'la richiesta');
assert.equal(richieste.plural, 'le richieste');
const colleghe = candidate('colleghe', 'Le colleghe lavorano qui.', 'w:collega|noun:feminine');
assert.equal(colleghe.genderLabel, 'feminine');
assert.equal(colleghe.singular, 'la collega');
assert.equal(colleghe.plural, 'le colleghe');
const regno = candidate('Regno', 'Il Regno d’Italia fu proclamato nel 1861.', 'grammar:regno|noun');
assert.equal(regno.singular, 'il regno');
assert.equal(regno.plural, 'i regni');
const marta = candidate('Marta', 'Marta è italiana.', 'name:marta');
assert.equal(marta.pos, 'proper noun');
assert(!('singular' in marta) && !('plural' in marta) && !('genderLabel' in marta));
const italy = candidate('d’Italia', 'Il Regno d’Italia fu proclamato nel 1861.', 'name:italia');
assert.equal(italy.meaning, 'Italy');
assert.equal(italy.pos, 'proper noun');
assert(!('singular' in italy) && !('plural' in italy) && !('genderLabel' in italy));
const gliela = candidate('gliela', 'Domani gliela restituisco.', 'function:gliela:pron');
assert.match(gliela.meaning, /to him, her, or them/);
const trasferi = candidate('trasferì', 'La famiglia si trasferì a Torino.', 'v:trasferirsi');
assert(trasferi.matches?.some(match => match.tense === 'passatoRemoto' && match.contextMatched), 'Reflexive form should match its attested full phrase.');
assert(!lookup('trasferì', { sentence: 'Il dipendente trasferì il materiale.' }).candidates.some(c => c.id === 'v:trasferirsi'), 'A reflexive verb alias needs its matching si in context.');
const bella = candidate('bellissima', 'La casa è bellissima.', 'w:bello|adj');
assert.match(bella.note, /superlative/);
const clipped = candidate('leggerlo', 'Voglio leggerlo stasera.', 'v:leggere');
assert.match(clipped.note, /Leggere \+ lo/);
const explicit = candidate('iniziò', 'La riunione iniziò alle otto.', 'grammar:iniziò|form');
assert.equal(explicit.pos, 'verb form');
assert(!('forms' in explicit), 'A standalone verified form must not display an invented conjugation table.');

const gaps = new Map();
let sentenceCount = 0, tokenCount = 0;
for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
  const pack = read(`../data/grammar-course/${level}.json`);
  for (const unit of pack.units) for (const lesson of unit.lessons) {
    const sentences = lesson.objectives.flatMap(objective => [
      ...objective.teach.flatMap(card => card.examples.map(example => example.it)),
      ...objective.questions.map(q => q.speak).filter(Boolean),
    ]);
    for (const sentence of sentences) {
      sentenceCount++;
      for (const token of tokenizeItalianSentence(sentence).filter(t => t.type === 'word')) {
        tokenCount++;
        const result = lookup(token.text, { sentence });
        if (result.status === 'unavailable') gaps.set(token.text, sentence);
      }
    }
  }
}
assert.equal(gaps.size, 0, `Every authored grammar token needs lookup help: ${JSON.stringify([...gaps])}`);
console.log(`Grammar lexicon validated: ${GRAMMAR_LOOKUP_ENTRIES.length} curated entries, ${Object.values(GRAMMAR_LOOKUP_ALIASES).flat().length} explicit aliases, ${tokenCount} word tokens in ${sentenceCount} authored sentences, zero lookup gaps.`);
