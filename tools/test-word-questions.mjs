#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildShortWordQuestion } from '../js/learning/word-questions.js';
import { gradePairActivity } from '../js/learning/lesson-activities.js';
import { gradeQuestion } from '../js/learning/diagnose.js';
import { hasPluralForm, isPluralOnly } from '../js/data.js';
const words = JSON.parse(fs.readFileSync(new URL('../data/vocab.json', import.meta.url)));
const word = (it, pos = 'noun') => words.find(e => e.it === it && e.pos === pos);
const target = (entry, skill, extra = {}) => ({ id: `${entry.id}::short-test::${skill}`, skill, shortWord: true, ...extra });
const q = (entry, skill, options = {}, extra = {}) => buildShortWordQuestion(entry, target(entry, skill, extra), options);
let count = 0;
function test(name, fn) { try { fn(); count++; } catch (error) { console.error(`FAIL ${name}`); throw error; } }
function valid(question) {
  assert.ok(question); assert.equal(question.type, 'mc'); assert.ok(question.choices.length >= 2 && question.choices.length <= 4);
  assert.equal(question.meta.mode, 'recognition'); assert.equal(question.meta.evidenceMode, 'recognition'); assert.equal(question.meta.supportOnly, true);
  assert.equal(new Set(question.choices.map(c => c.label.toLocaleLowerCase('it'))).size, question.choices.length);
  assert.equal(question.choices.filter(c => c.correct).length, 1);
  for (const choice of question.choices) assert.equal(gradeQuestion(question, choice.value).ok, choice.correct, JSON.stringify({ question, choice }));
}
test('known noun checks have independently verified answers', () => {
  const e = word('casa');
  for (const [skill, expected] of [['meaning', 'home'], ['recall', 'casa'], ['article', 'la'], ['plural', 'case']]) {
    const question = q(e, skill, { pool: words }); valid(question); assert.ok(question.answer.includes(expected));
  }
});
test('noun article checks distinguish singular and plural', () => {
  const e = word('libro');
  assert.deepEqual(q(e, 'article', {}, { number: 'singular' }).answer, ['il']);
  assert.deepEqual(q(e, 'article', {}, { number: 'plural' }).answer, ['i']);
  assert.deepEqual(q(word('studente'), 'article', {}, { number: 'singular' }).answer, ['lo']);
});
test('gender alternatives are accepted without becoming distractors', () => {
  const e = word('insegnante'); const question = q(e, 'article', { variant: 1 }, { number: 'plural' }); valid(question);
  assert.deepEqual(question.answer, ['gli', 'le']);
  assert.ok(!question.choices.some(c => !c.correct && ['gli', 'le'].includes(c.value)));
});
test('invariant nouns require the article to demonstrate number', () => {
  const question = q(word('crisi'), 'plural'); valid(question); assert.deepEqual(question.answer, ['le crisi']);
  assert.ok(question.prompt.includes('la crisi')); assert.equal(question.meta.diagnostic.requiresArticle, true);
  assert.ok(question.explanation.includes('noun stays the same'));
});
test('calcio sport stays sense-specific with no manufactured calci plural', () => {
  const e = word('calcio'); valid(q(e, 'meaning')); assert.deepEqual(q(e, 'meaning').answer, ['football; soccer']);
  assert.equal(q(e, 'plural'), null); assert.ok(!JSON.stringify(q(e, 'meaning')).includes('calci"'));
});
test('missing and plural-only forms do not create plural questions', () => {
  const missing = { id: 'custom:missing', it: 'oggetto', en: 'object', pos: 'noun' };
  assert.equal(q(missing, 'plural'), null); assert.equal(q(missing, 'article'), null);
  const e = word('occhiali'); assert.ok(isPluralOnly(e)); assert.equal(q(e, 'plural'), null); assert.deepEqual(q(e, 'article').answer, ['gli']);
});
test('regular adjective forms are checked separately', () => {
  const e = word('rosso', 'adj');
  ['rosso', 'rossa', 'rossi', 'rosse'].forEach((answer, formIndex) => {
    const question = q(e, 'agreement', {}, { formIndex }); valid(question); assert.deepEqual(question.answer, [answer]);
    assert.equal(gradeQuestion(question, question.choices.find(c => !c.correct).value).errorTags[0], 'agreement');
  });
});
test('two-ending adjectives have no false duplicate wrong answer', () => {
  const e = word('grande', 'adj'); const question = q(e, 'agreement', {}, { formIndex: 1 }); valid(question);
  assert.deepEqual(question.answer, ['grande']); assert.equal(question.choices.length, 2);
});
test('invariant and feminine-only adjectives do not get invented forms', () => {
  const invariant = q(word('blu', 'adj'), 'agreement', {}, { invariant: true }); valid(invariant);
  assert.deepEqual(invariant.answer, ['It stays the same.']); assert.equal(invariant.meta.answerLanguage, 'en');
  const feminine = q(word('incinta', 'adj'), 'agreement', {}, { answerForm: 'incinte', formLabel: 'feminine plural' }); valid(feminine);
  assert.deepEqual(feminine.answer, ['incinte']); assert.ok(!feminine.choices.some(c => /incinto|incinti/.test(c.label)));
});
test('prepositions and expressions never demand sentence typing', () => {
  for (const e of [word('a', 'prep'), word('con', 'prep'), word('e', 'conj'), word('a domani', 'expr')]) {
    for (const skill of ['meaning', 'recall']) for (const variant of [0, 1, 2]) {
      const question = q(e, skill, { pool: words, variant, phase: 'independent' }); valid(question);
      assert.ok(!question.prompt.includes('class="sentence"')); assert.ok(!question.prompt.includes('Write'));
    }
  }
});
test('dictionary synonym and alternate-sense overlaps cannot be wrong choices', () => {
  const e = { id: 'x:coffee', it: 'caffè', en: 'coffee', referenceMeanings: 'coffee; café', pos: 'noun' };
  const pool = [ { id: 'x:coffee2', it: 'othercoffee', en: 'coffee', pos: 'noun' }, { id: 'x:cafe', it: 'othercafe', en: 'café', pos: 'noun' }, word('libro'), word('sedia') ];
  for (const skill of ['meaning', 'recall']) {
    const question = q(e, skill, { pool }); valid(question);
    assert.ok(!question.choices.some(c => !c.correct && ['coffee', 'café', 'othercoffee', 'othercafe'].includes(c.label)));
  }
});
test('questions are deterministic and stable plain data', () => {
  const e = word('casa'), one = q(e, 'recall', { pool: words, variant: 4 });
  assert.deepEqual(one, q(e, 'recall', { pool: words, variant: 4 })); assert.deepEqual(JSON.parse(JSON.stringify(one)), one);
  assert.equal(one.meta.objectiveId, one.meta.targetId); assert.equal(one.meta.evidenceScope, 'supported-recognition');
});
test('Italian exposure metadata includes noun equivalents and honest prompts', () => {
  const e = word('casa'); const recall = q(e, 'recall'); assert.deepEqual(recall.meta.promptExposureForms, []);
  assert.ok(recall.meta.exposureForms.includes('casa')); assert.ok(recall.meta.exposureForms.includes('la casa'));
  assert.deepEqual(q(e, 'article').meta.promptExposureForms, ['casa']);
  const plural = q(e, 'plural'); assert.ok(plural.meta.exposureForms.includes('case')); assert.ok(plural.meta.exposureForms.includes('le case'));
});
test('custom markup is escaped and unsupported skills stay unavailable', () => {
  const e = { id: 'custom:test', it: '<img onerror="alert(1)">', en: 'custom object', pos: 'noun', g: 'm' };
  const question = q(e, 'meaning'); valid(question); assert.ok(question.prompt.includes('&lt;img')); assert.ok(!question.prompt.includes('<img'));
  assert.equal(q(e, 'context'), null); assert.equal(q(e, 'listening'), null);
});
test('all catalog words have supported lexical choices with an empty pool', () => {
  for (const e of words) for (const skill of ['meaning', 'recall']) valid(q(e, skill));
});
test('all supported catalog noun number checks use recorded forms', () => {
  for (const e of words.filter(e => e.pos === 'noun')) {
    if (e.g) valid(q(e, 'article'));
    if (hasPluralForm(e) && !isPluralOnly(e) && (e.g || e.it !== e.pl)) {
      const question = q(e, 'plural'); valid(question); assert.ok(question.answer.every(a => a === e.pl || a.endsWith(e.pl)));
    }
  }
});
test('real noun boards pair each number with its article and noun', () => {
  const e = word('casa'), article = target(e, 'article'), plural = target(e, 'plural');
  const board = buildShortWordQuestion(e, article, { format: 'pairs', pairTargets: [article, plural] });
  assert.equal(board.type, 'pairs'); assert.equal(board.pairs.length, 2);
  assert.deepEqual(board.pairs.map(p => [p.label, p.canonical]), [['Singular', 'la casa'], ['Plural', 'le case']]);
  assert.equal(gradePairActivity(board, { targetId: plural.id, given: 'le case' }).ok, true);
  assert.equal(gradePairActivity(board, { targetId: plural.id, given: 'la casa' }).ok, false);
  for (const row of board.pairs) { assert.equal(row.meta.mode, 'recognition'); assert.equal(row.meta.supportOnly, true); }
});
test('adjective boards accept equivalent forms by value', () => {
  const e = word('grande', 'adj'), targets = [0, 1, 2].map(formIndex => target(e, 'agreement', { id: `${e.id}::agreement-${formIndex}`, formIndex }));
  const board = buildShortWordQuestion(e, targets[0], { format: 'pairs', pairTargets: targets });
  assert.equal(board.type, 'pairs'); assert.deepEqual(board.pairs.map(p => p.canonical), ['grande', 'grande', 'grandi']);
  assert.equal(gradePairActivity(board, { targetId: targets[1].id, given: 'grande' }).ok, true);
  assert.equal(gradePairActivity(board, { targetId: targets[1].id, given: 'grandi' }).ok, false);
});
test('unhelpful identical-form boards fall back to supported choice', () => {
  const e = word('grande', 'adj'), targets = [0, 1].map(formIndex => target(e, 'agreement', { id: `${e.id}::agreement-${formIndex}`, formIndex }));
  valid(buildShortWordQuestion(e, targets[0], { format: 'pairs', pairTargets: targets }));
});
test('all recorded adjective agreement forms have supported choices', () => {
  for (const e of words.filter(e => e.pos === 'adj' && e.forms?.length === 4)) for (let formIndex = 0; formIndex < 4; formIndex++) valid(q(e, 'agreement', {}, { formIndex }));
});
test('accent-only alternatives cannot be mislabeled as wrong choices', () => {
  const e = { id: 'custom:si', it: 'sì', en: 'yes', pos: 'adv' }, pool = [{ id: 'custom:reflexive', it: 'si', en: 'oneself', pos: 'pron' }];
  const question = q(e, 'recall', { pool }); valid(question); assert.ok(!question.choices.some(c => !c.correct && c.value === 'si'));
});
test('article translation cues never mark another applicable definite article wrong', () => {
  const e = word('il', 'det');
  const ambiguous = words.filter(x => x.pos === 'det' && ['lo', "l'", 'la', 'i', 'gli', 'le'].includes(x.it));
  assert.ok(ambiguous.some(x => x.it === 'lo' && x.en.includes(',')), 'fixture exercises commas inside parentheses');
  for (const skill of ['meaning', 'recall']) for (let variant = 0; variant < 8; variant++) {
    const question = buildShortWordQuestion(e, {id: `${e.id}::lesson::meaning::${skill}`, skill}, {variant, pool: words}); valid(question);
    const wrongs = question.choices.filter(c => !c.correct).map(c => c.value);
    if (skill === 'recall') assert.ok(!wrongs.some(x => ambiguous.some(a => a.it === x)), JSON.stringify(question));
    else assert.ok(!wrongs.some(x => /^the\b/.test(x)), JSON.stringify(question));
  }
});
test('ciao never treats the recorded bye sense or synonymous goodbye as wrong', () => {
  const e = word('ciao', 'interj'); assert.match(e.en, /bye/);
  for (let variant = 0; variant < 12; variant++) {
    const question = buildShortWordQuestion(e, {id: `${e.id}::lesson::meaning::meaning`, skill:'meaning'}, {variant, pool: words}); valid(question);
    assert.ok(!question.choices.some(c => !c.correct && /^(?:bye|goodbye|farewell|hello|hi)$/i.test(c.value)), JSON.stringify(question));
  }
});
test('common lexical alternatives are conservatively excluded in both directions', () => {
  for (const [meaning, alternate] of [['help','assistance'],['quick','rapid'],['thanks','thank you'],['why','wherefore'],['happy','cheerful'],['tasty','delicious']]) {
    const e = {id:'custom:target', it:'target word', en:meaning, pos:'expr'};
    const other = {id:'custom:alternative', it:'alternative word', en:alternate, pos:'expr'};
    for (const skill of ['meaning', 'recall']) for (let variant = 0; variant < 8; variant++) {
      const question = q(e, skill, {variant, pool:[other]}); valid(question);
      assert.ok(!question.choices.some(c => !c.correct && [alternate,other.it].includes(c.value)), JSON.stringify({meaning, alternate, question}));
    }
  }
});
console.log(`${count} short-word question checks passed; ${words.length} catalog words covered.`);
