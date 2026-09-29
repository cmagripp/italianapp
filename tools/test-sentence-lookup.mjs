#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createSentenceLookup, tokenizeItalianSentence } from '../js/learning/sentence-lookup.js';
import { hasPluralForm, isPluralOnly, withArticle } from '../js/data.js';
import { conjugate, primary } from '../js/conjugator.js';
import { lessonContexts } from '../js/learning/lesson-content.js';
import { progressiveContexts } from '../js/learning/progressive-content.js';

const vocab = JSON.parse(readFileSync(new URL('../data/vocab.json', import.meta.url)));
const verbs = JSON.parse(readFileSync(new URL('../data/verbs.json', import.meta.url)));
const lookup = createSentenceLookup({ vocab, verbs });
const candidate = (token, id, options) => lookup(token, options).candidates.find(c => c.id === id);
const noun = it => vocab.find(e => e.it === it && e.pos === 'noun');
const coreChapters=['present','past','background','future','conditional'];
const reviewedScenes=entry=>[...coreChapters.flatMap(chapter=>lessonContexts(entry,chapter).filter(s=>s.reviewed)),...progressiveContexts(entry),...progressiveContexts(entry,{chapter:'background'})];
let passed = 0;
function test(name, run) { try { run(); passed++; console.log(`✓ ${name}`); } catch (e) { console.error(`✗ ${name}`); throw e; } }

test('Italian tokens retain Unicode, elision, hyphens, punctuation and exact offsets', () => {
  const text = '«L’amico è qui»: un’e-mail, perché sì! 12…';
  const tokens = tokenizeItalianSentence(text);
  assert.equal(tokens.map(t => t.text).join(''), text);
  assert.deepEqual(tokens.filter(t => t.type === 'word').map(t => t.text), ['L’amico', 'è', 'qui', 'un’e-mail', 'perché', 'sì', '12']);
  for (const t of tokens) assert.equal(text.slice(t.start, t.end), t.text);
  assert.deepEqual(tokenizeItalianSentence(''), []);
});

test('first full-catalog lookup builds once and returns a real noun', () => {
  const start = performance.now();
  const c = candidate('casa', 'w:casa|noun');
  const elapsed = performance.now() - start;
  assert.equal(c.singular, 'la casa'); assert.equal(c.plural, 'le case');
  assert.equal(c.gender, 'f'); assert.equal(c.genderLabel, 'feminine');
  console.log(`  Lazy full-catalog first lookup: ${Math.round(elapsed)} ms (${verbs.length} verbs)`);
});

test('every catalog noun has its recorded article/number forms and plural alias', () => {
  let checked = 0;
  for (const e of vocab.filter(e => e.pos === 'noun')) {
    const c = candidate(e.it, e.id);
    assert.ok(c, e.id); assert.equal(c.gender, e.g, e.id);
    assert.equal(c.singular, isPluralOnly(e) ? null : withArticle(e), e.id);
    assert.equal(c.plural, hasPluralForm(e) ? withArticle(e, true) : null, e.id);
    if (hasPluralForm(e)) assert.equal(candidate(e.pl, e.id)?.plural, withArticle(e, true), e.id);
    checked++;
  }
  assert.ok(checked > 4500);
});

test('plural-only and invariant nouns remain distinct', () => {
  const glasses = candidate('occhiali', noun('occhiali').id);
  assert.equal(glasses.singular, null); assert.equal(glasses.plural, 'gli occhiali');
  assert.match(glasses.numberNote, /normally used in the plural/);
  const coffee = candidate('caffè', noun('caffè').id);
  assert.equal(coffee.singular, 'il caffè'); assert.equal(coffee.plural, 'i caffè');
});

test('sense-specific singular use and gender-changing plurals come from catalog data', () => {
  const football = candidate('calcio', noun('calcio').id);
  assert.equal(football.plural, null); assert.match(football.meaning, /football/);
  assert.match(football.numberNote, /in this meaning/);
  assert.equal(candidate('uova', noun('uovo').id).plural, 'le uova');
});

test('unknown custom genders and plurals never acquire invented articles or inflections', () => {
  const local = createSentenceLookup({ vocab: [
    { id: 'c:unknown', it: 'widgetx', en: 'a custom thing', pos: 'noun' },
    { id: 'c:dash', it: 'massx', en: 'a substance', pos: 'noun', g: 'f', pl: '—' },
    { id: 'c:both', it: 'artista', en: 'artist', pos: 'noun', g: 'mf', pl: 'artisti' },
  ] });
  const unknown = local('widgetx').candidates[0];
  assert.equal(unknown.singular, 'widgetx'); assert.equal(unknown.gender, null); assert.equal(unknown.singularArticle, null);
  assert.equal(unknown.plural, null); assert.match(unknown.numberNote, /not yet recorded/);
  assert.equal(local('massx').candidates[0].plural, null);
  assert.equal(local('artista').candidates[0].singular, "l'artista");
  assert.equal(local('artista').candidates[0].gender, 'mf');
});

test('feminine aliases use explicit plurals in source notes without extrapolating', () => {
  assert.equal(candidate('amiche', 'w:amico|noun:feminine').plural, 'le amiche');
  assert.equal(candidate('attrici', 'w:attore|noun:feminine').singular, "l'attrice");
  const cat = candidate('gatta', 'w:gatto|noun:feminine');
  assert.equal(cat.gender, 'f'); assert.equal(cat.singular, 'la gatta');
  assert.equal(cat.plural, null); assert.match(cat.numberNote, /not yet recorded/);
});

test('a separate exact feminine entry supplies its recorded plural for the same meaning', () => {
  const local = createSentenceLookup({ vocab: [
    { id: 'm', it: 'customo', fem: 'customa', pl: 'customi', pos: 'noun', g: 'm', en: 'custom role' },
    { id: 'f', it: 'customa', pl: 'custome', pos: 'noun', g: 'f', en: 'custom role' },
  ] });
  assert.equal(local('customa').candidates.find(c => c.id === 'm:feminine').plural, 'le custome');
});

test('article and articulated-preposition contractions expose the actual noun', () => {
  for (const token of ['l’amico', "dell'amico", "all'amico", "nell'amico", "dall'amico", "sull'amico"]) {
    const result = lookup(token);
    assert.ok(result.candidates.some(c => c.id === 'w:amico|noun'), token);
    assert.equal(result.contraction.base, 'amico');
  }
  const office = lookup('all’ufficio');
  assert.equal(office.contraction.prefix, "all'");
  assert.equal(office.candidates.find(c => c.pos === 'noun').plural, 'gli uffici');
  assert.match(lookup('della').candidates.find(c => c.pos === 'prep').meaning, /of/);
});

test('l’ remains article-or-clitic ambiguous and can lead to an auxiliary', () => {
  assert.equal(lookup("l'amico").contraction.ambiguous, true);
  const have = lookup("l'ho", { sentence: "L'ho comprato ieri." });
  assert.ok(have.candidates.some(c => c.infinitive === 'avere'));
  assert.match(have.contraction.meaning, /object pronoun/);
});

test('accented function words and finite verbs never collapse into their unaccented homographs', () => {
  assert.ok(lookup('è').candidates.some(c => c.infinitive === 'essere'));
  assert.ok(!lookup('e').candidates.some(c => c.infinitive === 'essere'));
  assert.ok(lookup('dà').candidates.some(c => c.infinitive === 'dare'));
  assert.ok(!lookup('da').candidates.some(c => c.infinitive === 'dare'));
  assert.ok(lookup('sì').candidates.some(c => c.meaning === 'yes'));
  assert.ok(!lookup('si').candidates.some(c => c.meaning === 'yes'));
  assert.deepEqual(lookup('E\u0300').candidates.map(c => c.id), lookup('è').candidates.map(c => c.id));
});

test('noun/verb homographs and syncretic person readings remain available', () => {
  const door = lookup('porta');
  assert.equal(door.status, 'ambiguous');
  assert.ok(door.candidates.some(c => c.pos === 'noun' && c.meaning === 'door'));
  assert.ok(door.candidates.some(c => c.infinitive === 'portare'));
  const be = candidate('sono', 'v:essere');
  assert.deepEqual(be.matches.filter(m => m.tense === 'presente').map(m => m.person), [0, 5]);
  const state = lookup('stato');
  assert.ok(state.candidates.some(c => c.pos === 'noun'));
  assert.ok(state.candidates.some(c => c.infinitive === 'essere'));
});

test('a tense hint does not pretend to resolve a person but an explicit subject can', () => {
  const uncertain = candidate('sono', 'v:essere', { tense: 'presente' });
  assert.equal(uncertain.matches.filter(m => m.contextMatched).length, 0);
  const explicit = candidate('sono', 'v:essere', { sentence: 'Loro sono qui.', tense: 'presente' });
  assert.deepEqual(explicit.matches.filter(m => m.contextMatched).map(m => m.person), [5]);
});

test('articles rank likely noun readings first without removing homographic verbs', () => {
  const question = lookup('domanda', { sentence: 'Capisco la domanda.', entry: verbs.find(e => e.inf === 'domandare') });
  assert.equal(question.candidates[0].label, 'la domanda');
  assert.equal(question.candidates[0].pos, 'noun');
  assert.ok(question.candidates.some(c => c.infinitive === 'domandare'));
  assert.ok(!question.candidates.find(c => c.infinitive === 'domandare').matches.some(m => m.contextMatched));
  const door = lookup('porta', { sentence: 'Chiudi la porta.' });
  assert.equal(door.candidates[0].label, 'la porta'); assert.equal(door.status, 'ambiguous');
  assert.ok(door.candidates.some(c => c.infinitive === 'portare'));
  for (const [token, sentence] of [["dell'entrata", "Il colore dell'entrata."], ['stato', 'Le leggi dello stato.']]) {
    const result = lookup(token, { sentence });
    assert.equal(result.candidates[0].pos, 'noun', token);
    assert.ok(result.candidates.some(c => c.pos === 'verb'), token);
  }
  // Do not carry an article hint across punctuation to the next clause.
  assert.deepEqual(lookup('domanda', { sentence: 'La. Domanda.' }).candidates.map(c => c.id), lookup('domanda').candidates.map(c => c.id));
});

test('compound context identifies the whole form without translating the auxiliary as every verb', () => {
  const c = candidate('andata', 'v:andare', { sentence: 'Sara è andata a Roma.', tense: 'passatoProssimo' });
  assert.ok(c.matches.some(m => m.form === 'è andata' && m.tense === 'passatoProssimo' && m.person === 2 && m.contextMatched));
  assert.ok(!lookup('ho', { sentence: 'Ho mangiato.' }).candidates.some(c => c.infinitive === 'mangiare'));
  assert.ok(lookup('mangiato', { sentence: 'Ho mangiato.' }).candidates.some(c => c.infinitive === 'mangiare'));
});

test('reflexive and pronominal finite components require the actual clitic context', () => {
  assert.ok(!lookup('alzo').candidates.some(c => c.infinitive === 'alzarsi'));
  const reflexive = candidate('alzo', 'v:alzarsi', { sentence: 'Mi alzo alle sette.' });
  assert.ok(reflexive.matches.some(m => m.form === 'mi alzo' && m.contextMatched));
  const leave = candidate('vado', 'v:andarsene', { sentence: 'Me ne vado adesso.' });
  assert.ok(leave.matches.some(m => m.form === 'me ne vado'));
});

test('progressive lexical help preserves whole constructions and never assigns helper meanings to every verb', () => {
  for(const [token,id,sentence,form,tense] of [
    ['svegliando','v:svegliarsi','Mi sto svegliando.','mi sto svegliando','presenteProgressivo'],
    ['vestendo','v:vestirsi','Mi stavo vestendo.','mi stavo vestendo','imperfettoProgressivo'],
    ['lavandomi','v:lavarsi','Stavo lavandomi.','stavo lavandomi','imperfettoProgressivo'],
  ]) {
    const found=candidate(token,id,{sentence});
    assert(found,token);assert(found.matches.some(m=>m.form===form&&m.tense===tense&&m.contextMatched));
    assert(found.exposureForms.includes(form));
  }
  assert(!candidate('svegliando','v:svegliarsi'));
  assert(!candidate('svegliando','v:svegliarsi',{sentence:'Ti sto svegliando.'}));
  assert(!lookup('stavo',{sentence:'Mi stavo vestendo.'}).candidates.some(c=>c.infinitive==='vestirsi'));
  assert(candidate('stavo','v:stare',{sentence:'Mi stavo vestendo.'}));
});

test('imperative persons, explicit formal role and core form tables preserve correct metadata', () => {
  const imperative = candidate('vada', 'v:andare', { tense: 'imperativo', role: 'formal' });
  assert.ok(imperative.matches.some(m => m.tense === 'imperativo' && m.person === 2 && m.personLabel === 'Lei (formal you)'));
  assert.deepEqual(imperative.forms.map(f => f.tense), ['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale']);
  assert.equal(imperative.forms[0].forms[0].form, 'vado');
  assert.equal(imperative.forms[2].forms[0].form, 'andavo');
  assert.equal(imperative.forms[4].forms[0].form, 'andrei');
  assert.match(imperative.meaning, /to go/);
});

test('weather help uses impersonal forms and does not show invented personal weather exercises', () => {
  const rain = candidate('piove', 'v:piovere');
  assert.equal(rain.forms[0].forms.length, 1);
  assert.equal(rain.forms[0].forms[0].personLabel, 'impersonal');
  assert.ok(!rain.forms[1].forms[0].form.includes('piovuta'));
  assert.ok(!lookup('piovo').candidates.some(c => c.infinitive === 'piovere'));
});

test('all catalog verb infinitives and ordinary third-person present forms resolve locally', () => {
  for (const e of verbs) {
    assert.ok(candidate(e.inf, e.id), e.id);
    const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
    const form = primary(c.tenses.presente?.[2]);
    if (!form || form === '—') continue;
    const token = form.split(/\s+/).at(-1);
    assert.ok(candidate(token, e.id, { sentence: form }), `${e.id}: ${form}`);
  }
});

test('recorded determiner and adjective variants retain their source meanings', () => {
  for (const [token, id] of [['mia', 'w:mio|det'], ['tutti', 'w:tutto|det'], ['quel', 'w:quello|det'], ['buone', 'w:buono|adj'], ['signor', 'w:signore|noun']]) assert.ok(candidate(token, id), token);
  assert.equal(candidate('aver', 'v:avere').infinitive, 'avere');
  assert.ok(lookup('un’e-mail').candidates.some(c => c.id === 'w:email|noun'));
});

test('a multiword entry is shown as a phrase rather than falsely translating its component', () => {
  const local = createSentenceLookup({ vocab: [{ id: 'phrase', it: 'extrema ratio', pl: 'extrema ratio', g: 'f', pos: 'noun', en: 'last resort', note: 'Invariable.' }] });
  assert.equal(local('ratio').status, 'unavailable');
  const c = local('ratio', { sentence: 'È una extrema ratio.' }).candidates[0];
  assert.equal(c.word, 'extrema ratio'); assert.match(c.note, /whole phrase/);
});

test('names are conservative and do not suppress ordinary homographs', () => {
  assert.ok(lookup('Sara').candidates.some(c => c.source === 'name'));
  assert.ok(!lookup('sara').candidates.some(c => c.source === 'name'));
  const withHomograph = createSentenceLookup({ verbs: [{ id: 'v:marcare', inf: 'marcare', en: 'to mark', aux: 'avere' }] });
  assert.ok(withHomograph('Marco').candidates.some(c => c.infinitive === 'marcare'));
  assert.ok(withHomograph('Marco').candidates.some(c => c.source === 'name'));
  assert.equal(lookup('Neropolis').status, 'unavailable');
  assert.equal(lookup('Roma').candidates.find(c => c.source === 'name').meaning, 'Rome');
});

test('unresolved tokens retain supplied or exactly recorded sentence translations', () => {
  const first = lookup('unrecordedxx', { sentence: { it: 'Una frase.', en: 'A sentence.' } });
  assert.equal(first.status, 'unavailable'); assert.equal(first.sentence.en, 'A sentence.');
  const e = noun('casa');
  const second = lookup('unrecordedxx', { sentence: e.ex });
  assert.equal(second.sentence.en, e.exEn);
  const third = lookup('unrecordedxx', { sentence: 'A new sentence without a translation.' });
  assert.equal(third.sentence.en, ''); assert.match(third.message, /not been recorded/);
  assert.equal(lookup('unrecordedxx', { sentence: e.ex + ' Changed.' }).sentence.en, '');
});

test('exposure metadata contains noun aliases and fully expanded displayed constructions', () => {
  const home = candidate('casa', 'w:casa|noun');
  for (const form of ['casa', 'la casa', 'case', 'le case']) assert.ok(home.exposureForms.includes(form));
  const go = candidate('vado', 'v:andare');
  for (const form of ['andare', 'vado', 'sono andato', 'sono andata', 'andata','andavo','andrei']) assert.ok(go.exposureForms.includes(form), form);
});

test('lookup is deterministic, serializable, mutation-free and never interprets HTML', () => {
  const raw = { id: 'c:unsafe', it: 'widget', pos: 'noun', en: '<img src=x onerror=evil()>', g: 'f' };
  const before = JSON.stringify(raw); Object.freeze(raw);
  const local = createSentenceLookup({ vocab: [raw, { id: 'c:prototype', it: '__proto__', pos: 'noun' }], verbs: [{ id: 'c:invalid', inf: 'not-a-verb', en: 'unknown' }] });
  const a = local('widget'), b = local('widget');
  assert.deepEqual(a, b); assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.equal(a.candidates[0].meaning, raw.en); assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(local('not-a-verb').candidates[0].forms, []);
  assert.doesNotThrow(() => local('__proto__', null));
});

test('authored lookup supplements supply complete noun details without replacing custom senses', () => {
  for (const [it, singular, plural] of [['riforma', 'la riforma', 'le riforme'], ['danni', 'il danno', 'i danni'], ['gas', 'il gas', 'i gas'], ['auto', "l'auto", 'le auto'], ['lavoratori', 'il lavoratore', 'i lavoratori'],['momento','il momento','i momenti'],['spiegazione','la spiegazione','le spiegazioni'],['testo','il testo','i testi']]) {
    const c = lookup(it).candidates.find(c => c.source === 'curated');
    assert.equal(c.singular, singular); assert.equal(c.plural, plural);
  }
  const local = createSentenceLookup({ vocab: [{ id: 'c:gas', it: 'gas', en: 'my authored sense', pos: 'noun', g: 'm', pl: '-' }] });
  assert.equal(local('gas').candidates.length, 1);
  assert.equal(local('gas').candidates[0].id, 'c:gas'); assert.equal(local('gas').candidates[0].plural, null);
  assert.equal(lookup('riposare').candidates.find(c => c.pos === 'verb').meaning, 'to rest');
  assert.equal(candidate('menu','w:menù|noun').plural,'i menù');
});

test('every token in five core tenses and both progressive context sets has local lexical help', () => {
  let checked = 0;
  for (const e of verbs) for (const sentence of reviewedScenes(e)) {
    for (const token of tokenizeItalianSentence(sentence.it)) {
      if (token.type !== 'word') continue;
      assert.notEqual(lookup(token.text, { sentence }).status, 'unavailable', `${token.text}: ${sentence.it}`);
      checked++;
    }
  }
  assert.ok(checked > 6700);
  console.log(`  Reviewed core lesson contexts: ${checked}/${checked} tokens identified.`);
});

test('catalog sentence and lesson-context audit reports honest coverage gaps', () => {
  const sentences = vocab.filter(e => e.ex).map(e => ({ it: e.ex, en: e.exEn }));
  for (const e of verbs) {
    sentences.push(...e.examples || []);
    for (const chapter of coreChapters) sentences.push(...lessonContexts(e, chapter));
    sentences.push(...progressiveContexts(e),...progressiveContexts(e,{chapter:'background'}));
  }
  const counts = new Map();
  for (const sentence of sentences) for (const token of tokenizeItalianSentence(sentence.it)) {
    if (token.type !== 'word') continue;
    const key = token.text.toLocaleLowerCase('it');
    const record = counts.get(key) || { token: token.text, count: 0, sentence };
    record.count++; counts.set(key, record);
  }
  const missing = [...counts.values()].filter(row => lookup(row.token, { sentence: row.sentence }).status === 'unavailable');
  for (const token of ['tutti', 'mia', 'tutta', 'questa', 'sua', 'quel', 'signor', 'contro', 'aver', 'oltre', 'ad', "vent'anni", "dov'è"]) assert.ok(!missing.some(row => row.token.toLocaleLowerCase('it') === token), token);
  assert.ok(sentences.length > 12000); assert.ok(counts.size > 15000);
  const occurrences = [...counts.values()].reduce((n, row) => n + row.count, 0);
  const unresolved = missing.reduce((n, row) => n + row.count, 0);
  console.log(`  Corpus: ${sentences.length} sentences, ${counts.size} distinct forms; ${occurrences - unresolved}/${occurrences} token occurrences identified.`);
  console.log(`  Most frequent unresolved forms: ${missing.sort((a, b) => b.count - a.count).slice(0,12).map(r => `${r.token} (${r.count})`).join(', ')}.`);
});

console.log(`\n${passed} sentence lookup checks passed.`);
