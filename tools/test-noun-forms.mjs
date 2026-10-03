import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { article, withArticle, isUncountable, isPluralOnly, hasPluralForm, nounNumberNote } from '../js/data.js';

const vocab = JSON.parse(await readFile(new URL('../data/vocab.json', import.meta.url), 'utf8'));
const nouns = vocab.filter(e => e.pos === 'noun');
const noun = it => nouns.find(e => e.it === it);
let passed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

test('every built-in noun has an explicit usable plural or a singular-use marker', () => {
  assert(nouns.length>=4614,'All retained noun entries and later reviewed additions are audited');
  assert.equal(nouns.filter(e => typeof e.pl !== 'string' || !e.pl.trim()).length, 0);
  for (const e of nouns) {
    assert.equal(hasPluralForm(e) || isUncountable(e), true, e.id);
    if (hasPluralForm(e)) assert.ok(article(e, true), `${e.id} needs a plural article`);
    else assert.equal(article(e, true), '', `${e.id} must not produce an article for a placeholder`);
  }
});

test('calcio keeps the football sense singular without claiming all senses lack a plural', () => {
  const e = noun('calcio');
  assert.equal(e.en, 'football; soccer');
  assert.equal(e.pl, '-');
  assert.equal(hasPluralForm(e), false);
  assert.equal(withArticle(e), 'il calcio');
  assert.equal(article(e, true), '');
  assert.equal(nounNumberNote(e), 'Normally singular in this meaning. Other meanings or specialized uses may have a plural.');
});

test('regular and invariable nouns both expose real plurals with their articles', () => {
  for (const [it, sg, pl] of [['casa', 'la casa', 'le case'], ['città', 'la città', 'le città'], ['film', 'il film', 'i film']]) {
    const e = noun(it);
    assert.equal(hasPluralForm(e), true, it);
    assert.equal(isPluralOnly(e), false, it);
    assert.equal(withArticle(e), sg);
    assert.equal(withArticle(e, true), pl);
    assert.equal(nounNumberNote(e), '');
  }
});

test('entries presented in the plural retain that form without an absolute only claim', () => {
  for (const [it, plural] of [['occhiali', 'gli occhiali'], ['piselli', 'i piselli'], ['cuffie', 'le cuffie']]) {
    const e = noun(it);
    assert.equal(isPluralOnly(e), true, it);
    assert.equal(hasPluralForm(e), true, it);
    assert.equal(withArticle(e, true), plural);
    assert.equal(nounNumberNote(e), 'This entry is normally used in the plural.');
  }
});

test('both singular-use markers reject a plural article, including surrounding whitespace', () => {
  for (const pl of ['-', '—', ' - ', ' — ']) {
    const e = { pos: 'noun', it: 'latte', g: 'm', pl };
    assert.equal(hasPluralForm(e), false);
    assert.equal(isUncountable(e), true);
    assert.equal(article(e, true), '');
    assert.equal(nounNumberNote(e), 'Normally singular in this meaning. Other meanings or specialized uses may have a plural.');
  }
});

test('unknown custom plurals stay unknown without a fabricated form or uncountable label', () => {
  for (const pl of [undefined, null, '', '   ', 123]) {
    const e = { pos: 'noun', it: 'customword', g: 'f', pl };
    assert.equal(hasPluralForm(e), false);
    assert.equal(isUncountable(e), false);
    assert.equal(article(e, true), '');
    assert.notEqual(withArticle(e, true), e.it);
    assert.equal(nounNumberNote(e), 'Plural not yet recorded for this entry.');
  }
});

test('number helpers ignore nonnouns and absent entries', () => {
  for (const e of [null, undefined, {}, { pos: 'adj', it: 'bello', pl: 'belli' }]) {
    assert.equal(hasPluralForm(e), false);
    assert.equal(nounNumberNote(e), '');
  }
});

// Legacy UI imports register listeners and read documentElement. An inert event
// target permits generator tests without a browser, store initialization, or DOM.
globalThis.document = Object.assign(new EventTarget(), { documentElement: {} });
globalThis.window = {};
const { qPlural, qPluralMC } = await import('../js/games/questions.js');

test('legacy plural games reject unknown custom forms and singular-use markers', () => {
  for (const pl of [undefined, null, '', '  ', '-', '—', ' - ', ' — ', 123]) {
    const e = { id: 'c:unknown-plural', kind: 'word', pos: 'noun', g: 'm', it: 'test', en: 'test', pl };
    assert.equal(qPlural(e), null, String(pl));
    assert.equal(qPluralMC(e, []), null, String(pl));
  }
  assert.equal(qPlural(noun('calcio')), null);
  assert.equal(qPlural(noun('occhiali')), null);
  assert.deepEqual(qPlural(noun('città')).answer, ['città', 'le città']);
});

test('legacy plural distractors exclude unknown forms from a custom pool', () => {
  const e = noun('bar');
  const pool = [undefined, null, '', '  ', '-', '—', ' - ', ' — ', 123].map((pl, index) => ({ id: `c:bad-${index}`, kind: 'word', pos: 'noun', g: 'm', it: `word${index}`, en: `meaning${index}`, pl }));
  const q = qPluralMC(e, pool);
  assert.equal(q.answer, 'bar');
  for (const choice of q.choices) assert.ok(['bar', 'bars'].includes(choice.label), choice.label);
});

console.log(`\n${passed} noun-form checks passed. Audited ${nouns.length} nouns: ${nouns.filter(hasPluralForm).length} recorded plurals, ${nouns.filter(isUncountable).length} singular-use markers, ${nouns.filter(isPluralOnly).length} entries presented in the plural.`);
