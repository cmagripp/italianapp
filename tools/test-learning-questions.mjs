#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CORE_STAGES, EXPANSIONS, ANCHOR_VERBS, allowedTenses, objectivesFor, stageObjectives } from '../js/learning/curriculum.js';
import { buildQuestion, wordContext, expandedForms, annotateGameQuestion } from '../js/learning/questions.js';
import { gradeQuestion } from '../js/learning/diagnose.js';
import { isUncountable, isPluralOnly, withArticle, nounNumberNote } from '../js/data.js';

const verbs = JSON.parse(fs.readFileSync(new URL('../data/verbs.json', import.meta.url)));
const words = JSON.parse(fs.readFileSync(new URL('../data/vocab.json', import.meta.url)));
const byVerb = inf => verbs.find(e => e.inf === inf);
const byWord = (it, pos = 'noun') => words.find(e => e.it === it && e.pos === pos);
let checks = 0;
const test = (name, fn) => { try { fn(); checks++; } catch (error) { console.error(`FAIL: ${name}`); throw error; } };
const objective = (e, skill, tense = null, stage = 'background') => objectivesFor(e, { stage }).find(o => o.skill === skill && (!tense || o.tense === tense));
const qFor = (inf, skill, tense, variant = 0, mode = 'production') => {
  const e = byVerb(inf), o = objective(e, skill, tense);
  assert.ok(o, `${inf}/${skill}/${tense} objective exists`);
  return buildQuestion(e, o, { mode, variant, pool: verbs, allowedTenses: allowedTenses({ stage: 'background' }), rng: () => .37 });
};
const wrong = (q, answer, tag) => {
  const r = gradeQuestion(q, answer); assert.equal(r.ok, false); assert.ok(r.errorTags.includes(tag), JSON.stringify(r)); return r;
};

test('curriculum follows learner stage, never lexical CEFR', () => {
  assert.deepEqual(allowedTenses(), ['presente']);
  assert.deepEqual(allowedTenses({ stage: 'past' }), ['presente', 'passatoProssimo']);
  assert.deepEqual(allowedTenses({ stage: 'future' }), ['presente', 'passatoProssimo', 'futuro']);
  assert.deepEqual(allowedTenses({ preferences: { stage: 'background' } }), ['presente', 'passatoProssimo', 'futuro', 'imperfetto']);
  assert.ok(allowedTenses({stage:'future',legacyTenses:['imperfetto']}).includes('imperfetto'));
  assert.equal(objectivesFor({ ...byVerb('parlare'), level: 'C2' }).some(o => o.tense === 'congiuntivoPresente'), false);
  assert.equal(allowedTenses({ stage: 'present', expansions: ['opinions'] }).includes('congiuntivoPresente'), true);
});

test('four finite checkpoint blueprints have practical size and true person requirements', () => {
  assert.equal(ANCHOR_VERBS.length, 24);
  for (const s of CORE_STAGES) {
    const os = stageObjectives(verbs, s.id); assert.ok(os.length >= 3 && os.length <= 7);
    assert.ok(os.every(o => o.tense === s.tense && o.checkpoint));
    for (const o of os.filter(o => o.skill === 'conjugation')) assert.deepEqual(o.personsRequired, [0, 1, 2, 3, 4, 5]);
  }
});

for (const inf of ANCHOR_VERBS) for (const stage of CORE_STAGES) {
  test(`${inf}: ${stage.id} taught content, variants, grading, serialization`, () => {
    const e = byVerb(inf); assert.ok(e);
    const os = objectivesFor(e, { stage: stage.id });
    const o = os.find(o => o.skill === 'conjugation' && o.tense === stage.tense); assert.ok(o);
    const variants = new Set(), persons = new Set();
    for (let variant = 0; variant < 12; variant++) {
      for (const mode of ['recognition', 'production']) {
        const q = buildQuestion(e, o, { mode, variant, allowedTenses: allowedTenses({ stage: stage.id }), pool: verbs, rng: () => .31 });
        assert.ok(q); assert.equal(q.meta.tense, stage.tense);
        assert.equal(q.type, mode === 'production' ? 'type' : 'mc');
        assert.ok(!q.prompt.includes('undefined'));
        assert.ok(q.meta.contextId.includes('predicate'));
        assert.ok(q.answer.every(a => gradeQuestion(q, a).ok), JSON.stringify(q));
        const plain = JSON.parse(JSON.stringify(q)); assert.deepEqual(plain, q);
        for (const choice of q.choices) assert.equal(gradeQuestion(q, choice.label).ok, choice.correct, choice.label);
        assert.ok((q.meta.diagnostic.tenseForms || []).every(f => allowedTenses({ stage: stage.id }).includes(f.tense)));
        variants.add(q.meta.variantId); persons.add(q.meta.person);
      }
    }
    assert.equal(variants.size, 12); assert.equal(persons.size, 6);
  });
}

test('every anchor has authored completed/background contrast with correct semantic metadata', () => {
  for (const inf of ANCHOR_VERBS) {
    const ids = new Set();
    for (let v = 0; v < 8; v++) {
      const q = qFor(inf, 'context', 'imperfetto', v);
      assert.ok(q); assert.equal(q.meta.contextualMeaning, v % 2 === 0 ? 'background' : 'completed');
      assert.equal(q.meta.tense, v % 2 === 0 ? 'imperfetto' : 'passatoProssimo');
      assert.ok(q.answer.every(a => gradeQuestion(q, a).ok)); ids.add(q.meta.variantId);
    }
    assert.equal(ids.size, 8);
  }
});

test('no automatic fallback to unlearned tense, including a requested expansion', () => {
  const e = byVerb('parlare');
  const o = objectivesFor(e, { expansions: ['opinions'] }).find(o => o.tense === 'congiuntivoPresente');
  assert.equal(buildQuestion(e, o, { allowedTenses: ['presente'] }), null);
  assert.equal(buildQuestion(e, { ...o, tense: 'madeUp' }), null);
});

test('weather form generation restricts everyday persons', () => {
  for (const inf of ['piovere', 'nevicare']) for (let v = 0; v < 12; v++) {
    const q = qFor(inf, 'conjugation', 'presente', v);
    assert.equal(q.meta.person, 2); assert.equal(q.answer[0], inf === 'piovere' ? 'piove' : 'nevica');
  }
});

test('defective forms never become questions', () => {
  const e = byVerb('solere');
  assert.ok(e);
  assert.equal(objectivesFor(e, { stage: 'past' }).some(o => o.tense === 'passatoProssimo'), false);
  assert.equal(buildQuestion(e, { id: 'fake', entryId: e.id, kind: 'verb', stage: 'past', tense: 'passatoProssimo', skill: 'conjugation' }, { allowedTenses: ['passatoProssimo'] }), null);
});

test('valid gender and alternative auxiliary forms accepted without a pinned context', () => {
  const q = qFor('andare', 'conjugation', 'passatoProssimo');
  assert.equal(gradeQuestion(q, 'sono andata').ok, true);
  assert.equal(gradeQuestion(q, 'Sono  andato.').ok, true);
  const both = qFor('correre', 'conjugation', 'passatoProssimo');
  assert.equal(gradeQuestion(both, 'ho corso').ok, true);
  assert.equal(gradeQuestion(both, 'sono corsa').ok, true);
  const aux = qFor('correre', 'auxiliary', 'passatoProssimo', 0, 'recognition');
  assert.equal(aux.type, 'type'); assert.equal(gradeQuestion(aux, 'essere').ok, true); assert.equal(gradeQuestion(aux, 'avere').ok, true);
});

test('compound diagnoses isolate auxiliary, person, participle, agreement, clitic', () => {
  const q = qFor('andare', 'conjugation', 'passatoProssimo');
  const aux = wrong(q, 'ho andato', 'auxiliary'); assert.ok(aux.components.some(c => c.skill === 'participle' && c.ok));
  wrong(q, 'siamo andato', 'auxiliaryPerson');
  wrong(qFor('prendere', 'conjugation', 'passatoProssimo'), 'ho prenduto', 'participle');
  const agreement = wrong(qFor('andare', 'agreement', 'passatoProssimo'), 'è andato', 'agreement');
  assert.ok(agreement.components.some(c => c.skill === 'participle' && c.ok));
  wrong(qFor('alzarsi', 'conjugation', 'passatoProssimo'), 'sono alzato', 'clitic');
  wrong(qFor('alzarsi', 'conjugation', 'presente'), 'alzo', 'clitic');
});

test('person and tense diagnoses require clear known alternatives', () => {
  wrong(qFor('parlare', 'conjugation', 'presente', 1), 'parla', 'person');
  wrong(qFor('parlare', 'conjugation', 'presente', 1), 'parlavi', 'tense');
  wrong(qFor('andare', 'conjugation', 'presente'), 'ando', 'irregular');
  wrong(qFor('andare', 'conjugation', 'presente'), 'random text', 'uncertain');
  const r = gradeQuestion(qFor('parlare', 'conjugation', 'presente'), 'parlo');
  assert.ok(r.components.some(c => c.skill === 'tense' && c.ok), 'later success clears tense evidence');
});

test('accent preference preserves grammar evidence and assisted/revealed semantics', () => {
  const q = qFor('parlare', 'conjugation', 'futuro');
  const permissive = gradeQuestion(q, 'parlero'); assert.equal(permissive.ok, true); assert.equal(permissive.accentIssue, true); assert.ok(permissive.components.every(c => c.ok));
  const strict = gradeQuestion(q, 'parlero', { accentStrict: true }); assert.equal(strict.ok, false); assert.ok(strict.components.some(c => c.skill === 'conjugation' && c.ok));
  assert.equal(gradeQuestion(q, 'parlerò', { assistance: ['hint'] }).assisted, true);
  const revealed = gradeQuestion(q, 'parlerò', { revealed: true }); assert.equal(revealed.outcome, 'revealed'); assert.equal(revealed.ok, false); assert.deepEqual(revealed.components, []);
});

test('article gender/number and plural morphology', () => {
  for (const [it, expected] of [['casa', 'la'], ['studente', 'lo'], ['amico', "l'"]]) {
    const e = byWord(it); assert.ok(e);
    const q = buildQuestion(e, objective(e, 'article'), { mode: 'production' }); assert.ok(q.answer.includes(expected)); assert.equal(gradeQuestion(q, expected).ok, true);
  }
  const e = byWord('casa');
  const q = buildQuestion(e, objective(e, 'plural'), { mode: 'production' }); assert.equal(gradeQuestion(q, 'case').ok, true); wrong(q, 'casi', 'plural');
  const full = buildQuestion(e, objective(e, 'plural'), { mode: 'production', variant: 1 }); assert.equal(gradeQuestion(full, 'le case').ok, true);
  const articleError = wrong(full, 'i case', 'article'); assert.ok(articleError.components.some(c => c.skill === 'plural' && c.ok));
  const recall = buildQuestion(e, objective(e, 'recall'), { mode: 'production' }); assert.equal(gradeQuestion(recall, 'la casa').ok, true); wrong(recall, 'il casa', 'article');
});

test('words have meaning, recall, authored context and true listening variation', () => {
  const e = byWord('casa'); assert.ok(wordContext(e));
  for (const skill of ['meaning', 'recall', 'context', 'listening']) {
    const o = objective(e, skill); assert.ok(o);
    const qs = [0, 1].map(variant => buildQuestion(e, o, { mode: 'production', variant, pool: words, rng: () => .2 }));
    assert.notEqual(qs[0].meta.variantId, qs[1].meta.variantId);
    assert.ok(qs[0].prompt !== qs[1].prompt || qs[0].say !== qs[1].say);
    for (const q of qs) assert.ok(q.answer.every(a => gradeQuestion(q, a).ok));
    if (skill === 'listening') for (const q of qs) assert.equal(q.meta.audioIsPrompt, true);
  }
  const pluralOnly = byWord('occhiali'); assert.equal(objectivesFor(pluralOnly).some(o => o.skill === 'plural'), false);
  const uncountable = { id: 'w:test-uncountable', it: 'acqua', pos: 'noun', g: 'f', pl: '-', en: 'water' }; assert.equal(objectivesFor(uncountable).some(o => o.skill === 'plural'), false);
});

test('noun number follows the taught sense and preserves countable invariable forms', () => {
  const nouns = words.filter(e => e.pos === 'noun');
  assert.ok(nouns.every(e => typeof e.pl === 'string' && e.pl.trim()), 'every noun explicitly declares its number form');
  const football = byWord('calcio');
  assert.equal(football.pl, '-'); assert.equal(isUncountable(football), true);
  assert.ok(football.note.includes('kick'));
  assert.equal(objectivesFor(football).some(o => o.skill === 'plural'), false);
  const automation = byWord('domotica');
  assert.equal(automation.pl, '-');
  assert.equal(objectivesFor(automation).some(o => o.skill === 'plural'), false);
  for (const it of ['maturità', 'extrema ratio', 'vexata quaestio']) {
    const e = byWord(it); assert.equal(e.pl, e.it); assert.equal(isUncountable(e), false); assert.equal(isPluralOnly(e), false);
    assert.equal(withArticle(e, true), `le ${it}`);
    const o = objective(e, 'plural'); assert.ok(o);
    const q = buildQuestion(e, o, { mode: 'production', variant: 1 }); assert.equal(gradeQuestion(q, `le ${it}`).ok, true);
  }
});

test('custom missing and placeholder plurals cannot become adaptive questions or context answers', () => {
  for (const pl of [undefined, null, '', '   ', '-', '—', ' - ', ' — ', 123]) {
    const e = { id: 'c:unknown-plural', kind: 'word', pos: 'noun', g: 'f', it: 'parola', en: 'word', pl, ex: 'Oggi — qui.', exEn: 'Today — here.' };
    assert.equal(objectivesFor(e).some(o => o.skill === 'plural'), false, String(pl));
    const forced = { id: e.id + '::word::plural', entryId: e.id, kind: 'word', skill: 'plural' };
    assert.equal(buildQuestion(e, forced, { mode: 'production' }), null, String(pl));
    const articleQ = buildQuestion(e, objective(e, 'article'), { mode: 'production', variant: 1 });
    assert.equal(articleQ.meta.number, 'singular');
    assert.deepEqual(articleQ.answer, ['la parola']);
    assert.ok(articleQ.lesson.includes(nounNumberNote(e)));
    assert.equal(wordContext(e), null, 'placeholder punctuation must not count as an authored noun occurrence');
  }
});

test('adaptive plural choices never include missing forms and teaching avoids repeated number notes', () => {
  const e = byWord('bar'), o = objective(e, 'plural');
  const pool = [undefined, null, '', ' ', '-', '—', ' - ', ' — ', 123].map((pl, index) => ({ id: `c:bad-${index}`, kind: 'word', pos: 'noun', g: 'm', it: `word${index}`, en: `meaning${index}`, pl }));
  for (let variant = 0; variant < 2; variant++) {
    const q = buildQuestion(e, o, { mode: 'recognition', variant, pool, rng: () => .7 });
    assert.equal(q.type, 'mc');
    for (const choice of q.choices) assert.ok(/^(?:i )?bars?$/.test(choice.label), choice.label);
  }
  const milk = byWord('latte'), q = buildQuestion(milk, objective(milk, 'meaning'));
  assert.ok(q.lesson.includes(milk.note)); assert.ok(q.lesson.includes(nounNumberNote(milk)));
  for (const it of ['calcio', 'piselli']) {
    const entry = byWord(it), taught = buildQuestion(entry, objective(entry, 'meaning'));
    assert.equal(taught.lesson, entry.note, 'an explicit source number explanation is sufficient');
  }
  const noted = { ...milk, note: nounNumberNote(milk) };
  assert.equal(buildQuestion(noted, objective(noted, 'meaning')).lesson, noted.note);
});

test('custom content uses safe form-only fallback and escapes all prompts', () => {
  const e = { id: 'c:demo', kind: 'verb', inf: 'programmare', en: 'to program', aux: 'avere' };
  const o = objectivesFor(e).find(o => o.skill === 'conjugation');
  const q = buildQuestion(e, o, { mode: 'production' }); assert.ok(q); assert.equal(q.answer[0], 'programmo'); assert.ok(!q.meta.contextId.includes('predicate'));
  const malicious = { id: 'c:html', it: '<img onerror=bad>', en: '<script>bad</script>', pos: 'expr' };
  const mq = buildQuestion(malicious, objective(malicious, 'recall'), { mode: 'production' });
  assert.equal(mq.prompt.includes('<script>'), false); assert.equal(mq.prompt.includes('onerror=bad'), false);
  assert.equal(wordContext({ it: 're', ex: 'Il regalo è qui.' }), null);
});

test('injected randomness and genuine variants survive regeneration', () => {
  const e = byVerb('andare'), o = objective(e, 'conjugation', 'presente');
  const opts = { mode: 'recognition', variant: 7, allowedTenses: ['presente'], rng: () => .37 };
  assert.deepEqual(buildQuestion(e, o, opts), buildQuestion(e, o, opts));
  assert.equal(qFor('parlare', 'conjugation', 'presente', 0).meta.variantId, qFor('parlare', 'conjugation', 'presente', 12).meta.variantId);
});

test('targeted person repair keeps the person while varying actual cues', () => {
  for (const inf of ['andare', 'alzarsi', 'parlare']) for (const skill of ['conjugation', 'auxiliary']) {
    const e = byVerb(inf), o = objective(e, skill, 'passatoProssimo');
    const qs = [0, 1].map(variant => buildQuestion(e, o, { mode: 'production', variant, repairPerson: 1, allowedTenses: ['presente', 'passatoProssimo'] }));
    for (const q of qs) { assert.equal(q.meta.person, 1); assert.ok(q.answer.every(a => gradeQuestion(q, a).ok)); }
    assert.notEqual(qs[0].prompt, qs[1].prompt); assert.notEqual(qs[0].meta.variantId, qs[1].meta.variantId);
  }
  const e = { id: 'c:programmare', kind: 'verb', inf: 'programmare', aux: 'avere', en: 'to program' }, o = objective(e, 'conjugation', 'presente');
  const qs = [0, 1].map(variant => buildQuestion(e, o, { mode: 'production', variant, repairPerson: 1 }));
  assert.notEqual(qs[0].prompt, qs[1].prompt); assert.equal(qs[1].answer[0], 'programmi');
});

test('repair scaffolds observe only the supplied missing component', () => {
  for (const [inf, tag, component] of [['andare', 'auxiliary', 'auxiliary'], ['andare', 'auxiliaryPerson', 'auxiliary'], ['prendere', 'participle', 'participle'], ['andare', 'agreement', 'agreement'], ['alzarsi', 'clitic', 'clitic'], ['farcela', 'clitic', 'clitic']]) {
    const e = byVerb(inf), o = objective(e, 'conjugation', 'passatoProssimo');
    const q = buildQuestion(e, o, { mode: 'recognition', repairTag: tag, repairPerson: 1, allowedTenses: ['presente', 'passatoProssimo'] });
    assert.equal(q.meta.objectiveId, o.id); assert.equal(q.meta.scaffold, true); assert.equal(q.meta.skill, component);
    assert.equal(q.meta.mode, 'recognition'); assert.equal(q.meta.evidenceMode, 'recognition');
    assert.equal(q.meta.person, 1); assert.ok(q.prompt.includes('blank'));
    const r = gradeQuestion(q, q.answer[0]); assert.equal(r.ok, true);
    assert.ok(r.components.some(c => c.skill === component && c.ok));
    assert.ok(!r.components.some(c => c.skill === 'conjugation' || c.skill === 'tense'));
    for (const c of q.choices) assert.equal(gradeQuestion(q, c.label).ok, c.correct);
    const full = buildQuestion(e, o, { mode: 'production', repairTag: tag, repairPerson: 1, allowedTenses: ['presente', 'passatoProssimo'] });
    assert.equal(full.meta.skill, 'conjugation'); assert.equal(full.meta.scaffold, undefined);
  }
  const e = { id: 'c:fake-participle', kind: 'verb', inf: 'programmare', en: 'to program', aux: 'avere' };
  const o = objective(e, 'conjugation', 'passatoProssimo');
  const q = buildQuestion(e, o, { mode: 'recognition', repairTag: 'participle', allowedTenses: ['passatoProssimo'] });
  assert.equal(q.meta.mode, 'recognition'); assert.equal(q.meta.evidenceMode, 'recognition');
});

test('legacy game metadata matches objectives and actual evidence without invented variants', () => {
  const e = byVerb('andare');
  const legacy = { type: 'type', prompt: 'andare, io, passato prossimo', answer: ['sono andato/a'], tag: 'Conjugate' };
  const q = annotateGameQuestion({ ...legacy }, e, { skill: 'conjugation', tense: 'passatoProssimo', person: 0, allowedTenses: ['presente', 'passatoProssimo'] });
  assert.equal(q.meta.objectiveId, objective(e, 'conjugation', 'passatoProssimo').id);
  assert.equal(q.meta.person, 0); assert.equal(q.meta.mode, 'production'); assert.equal(q.meta.source, 'game');
  wrong(q, 'ho andato', 'auxiliary'); assert.equal(gradeQuestion(q, 'sono andata').ok, true);
  const second = annotateGameQuestion({ ...legacy }, e, { skill: 'conjugation', tense: 'passatoProssimo', person: 0 });
  assert.equal(q.meta.variantId, second.meta.variantId); assert.equal(q.prompt, legacy.prompt);
  const en = annotateGameQuestion({ type: 'type', prompt: 'English', answer: ['go'] }, e, { skill: 'meaning' }); assert.equal(en.meta, undefined);
  const unsupported = annotateGameQuestion({ type: 'type', prompt: 'Detect tense', answer: ['presente'] }, e, { skill: 'tense' }); assert.equal(unsupported.meta, undefined);
  const weather = annotateGameQuestion({ type: 'type', prompt: 'io, piovere', answer: ['piovo'] }, byVerb('piovere'), { skill: 'conjugation', tense: 'presente', person: 0 }); assert.equal(weather.meta, undefined);
  const w = byWord('casa');
  for (const skill of ['meaning', 'recall', 'article', 'plural']) {
    const game = annotateGameQuestion({ type: 'mc', prompt: 'word', answer: [w.it] }, w, { skill });
    assert.equal(game.meta.objectiveId, objective(w, skill).id); assert.equal(game.meta.mode, 'recognition');
  }
  const command = annotateGameQuestion({ type: 'type', prompt: 'tu, parlare, imperative', answer: ['parla'] }, byVerb('parlare'), { skill: 'conjugation', tense: 'imperativo', person: 0 });
  assert.equal(command.meta.person, 1); assert.equal(gradeQuestion(command, 'parla').ok, true);
});

console.log(`Learning curriculum/questions/diagnosis: ${checks} test groups passed.`);
