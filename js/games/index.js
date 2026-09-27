// Game registry. Each game: { id, name, icon, desc, kind: 'any'|'word'|'verb'|'noun', min, options?, start(root, ctx) }
// ctx: { items, pool, options, backHref, replay(), practice(missedEntries) }
import { runDrill } from './engine.js';
import { qTranslateMC, qTypeIt, qTypeEn, qGender, qPlural, qPluralMC, qCloze, qScramble, qDictation, qConjType, qConjMC, qTenseDetective, qPersonDetective, qAux, qParticiple, qGerund, qPattern, mixedQuestions, DRILL_TENSES } from './questions.js';
import { shuffle, sample, pickN } from '../data.js';
import { TENSE_BY_KEY } from '../conjugator.js';

const drill = (id, title, build, extra = {}) => (root, ctx) => {
  const qs = build(ctx).filter(Boolean);
  if (!qs.length) { root.innerHTML = `<div class="empty"><p>No questions could be made from this selection.</p><a class="btn primary" href="${ctx.backHref || '#/games'}">Choose another source</a></div>`; return; }
  runDrill(root, qs, { title, gameId: id, backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice, ...extra });
};
const lim = (ctx, n = 15) => shuffle(ctx.items).slice(0, ctx.options?.count || n);
const tensesOf = (ctx, def) => (ctx.options?.tenses && ctx.options.tenses.length ? ctx.options.tenses : def);

export const GAMES = [
  { id: 'flashcards', name: 'Flashcards', icon: '🃏', desc: 'Flip and rate — drives your spaced repetition.', kind: 'any', min: 1, options: [{ key: 'dir', label: 'Direction', choices: [['it-en', 'Italian → English'], ['en-it', 'English → Italian']] }], start: async (root, ctx) => (await import('./flashcards.js')).startFlashcards(root, { ...ctx, items: lim(ctx, 20) }) },
  { id: 'quiz', name: 'Quick quiz', icon: '❓', desc: 'Mixed multiple choice: meanings, forms, articles.', kind: 'any', min: 4, start: drill('quiz', 'Quick quiz', ctx => mixedQuestions(lim(ctx, 15), ctx.pool)) },
  { id: 'typing', name: 'Type it', icon: '⌨️', desc: 'See the English, type the Italian.', kind: 'any', min: 3, start: drill('typing', 'Type it', ctx => lim(ctx, 12).map(e => qTypeIt(e)), { xpPer: 3 }) },
  { id: 'matching', name: 'Matching', icon: '🔗', desc: 'Pair Italian words with their meanings.', kind: 'any', min: 4, options: [{ key: 'mode', label: 'Pairs', choices: [['translate', 'Word ↔ meaning'], ['participle', 'Verb ↔ participle'], ['conj', 'Verb ↔ present form']] }], start: async (root, ctx) => (await import('./matching.js')).startMatching(root, { ...ctx, items: lim(ctx, 18) }) },
  { id: 'hangman', name: 'Hangman', icon: '🪢', desc: 'Guess the word letter by letter.', kind: 'any', min: 3, start: async (root, ctx) => (await import('./hangman.js')).startHangman(root, { ...ctx, items: lim(ctx, 10) }) },
  { id: 'crossword', name: 'Crossword', icon: '🧩', desc: 'A mini crossword clued in English.', kind: 'any', min: 5, start: async (root, ctx) => (await import('./crossword.js')).startCrossword(root, { ...ctx, items: lim(ctx, 30) }) },
  { id: 'cloze', name: 'Fill in the blank', icon: '✍️', desc: 'Complete real example sentences.', kind: 'any', min: 3, options: [{ key: 'typed', label: 'Answer', choices: [['mc', 'Multiple choice'], ['typed', 'Type it']] }], start: drill('cloze', 'Fill in the blank', ctx => lim(ctx, 12).map(e => qCloze(e, { typed: ctx.options?.typed === 'typed', pool: ctx.pool })), { xpPer: 3 }) },
  { id: 'scramble', name: 'Word scramble', icon: '🔀', desc: 'Unscramble the letters.', kind: 'any', min: 3, start: drill('scramble', 'Word scramble', ctx => lim(ctx, 12).map(e => qScramble(e))) },
  { id: 'sentence', name: 'Sentence builder', icon: '🧱', desc: 'Put the words of a sentence in order.', kind: 'any', min: 3, start: async (root, ctx) => (await import('./sentence.js')).startSentence(root, { ...ctx, items: lim(ctx, 10) }) },
  { id: 'gender', name: 'Il, la, lo…', icon: '⚥', desc: 'Pick the right article for each noun.', kind: 'noun', min: 4, start: drill('gender', 'Articles', ctx => lim(ctx, 15).map(e => qGender(e))) },
  { id: 'plurals', name: 'Plurals', icon: '👥', desc: 'Singular → plural, including the irregular ones.', kind: 'noun', min: 4, options: [{ key: 'typed', label: 'Answer', choices: [['mc', 'Multiple choice'], ['typed', 'Type it']] }], start: drill('plurals', 'Plurals', ctx => lim(ctx, 12).map(e => (ctx.options?.typed === 'typed' ? qPlural(e) : qPluralMC(e, ctx.pool)))) },
  { id: 'dictation', name: 'Dictation', icon: '🎧', desc: 'Listen and type what you hear.', kind: 'any', min: 3, start: drill('dictation', 'Dictation', ctx => lim(ctx, 10).map(e => qDictation(e)), { xpPer: 3 }) },
  { id: 'reverse', name: 'Italian → English', icon: '🇬🇧', desc: 'Type the English meaning.', kind: 'any', min: 3, start: drill('reverse', 'Italian → English', ctx => lim(ctx, 12).map(e => qTypeEn(e))) },
  { id: 'speed', name: 'Speed round', icon: '⚡', desc: '60 seconds. How many can you get?', kind: 'any', min: 6, options: [{ key: 'mode', label: 'Questions', choices: [['translate', 'Meanings'], ['conj', 'Conjugations (verbs)']] }], start: async (root, ctx) => (await import('./speed.js')).startSpeed(root, ctx) },
  // verb games
  { id: 'conj-drill', name: 'Conjugation drill', icon: '📝', desc: 'Type the right form. Choose your tenses.', kind: 'verb', min: 1, tenses: true, start: drill('conj-drill', 'Conjugation drill', ctx => { const t = tensesOf(ctx, ['presente']); const items = lim(ctx, 8); const qs = []; for (const e of items) for (let k = 0; k < (items.length <= 3 ? 3 : 2); k++) qs.push(qConjType(e, sample(t))); return shuffle(qs); }, { xpPer: 3 }) },
  { id: 'conj-choice', name: 'Pick the form', icon: '🎯', desc: 'Multiple-choice conjugation.', kind: 'verb', min: 1, tenses: true, start: drill('conj-choice', 'Pick the form', ctx => { const t = tensesOf(ctx, ['presente', 'passatoProssimo']); const items = lim(ctx, 10); const qs = []; for (const e of items) for (let k = 0; k < (items.length <= 3 ? 3 : 2); k++) qs.push(qConjMC(e, sample(t), ctx.pool)); return shuffle(qs); }) },
  { id: 'tense-detective', name: 'Tense detective', icon: '🕵️', desc: 'Which tense — and who is the subject?', kind: 'verb', min: 2, start: drill('tense-detective', 'Tense detective', ctx => shuffle(lim(ctx, 12).flatMap(e => [qTenseDetective(e), qPersonDetective(e)])).slice(0, 14)) },
  { id: 'aux', name: 'Essere or avere?', icon: '⚖️', desc: 'Choose the auxiliary for the passato prossimo.', kind: 'verb', min: 3, start: drill('aux', 'Essere or avere?', ctx => lim(ctx, 15).map(e => qAux(e))) },
  { id: 'participles', name: 'Participles & gerunds', icon: '🧬', desc: 'Type the participio passato and gerundio.', kind: 'verb', min: 2, start: drill('participles', 'Participles & gerunds', ctx => shuffle(lim(ctx, 10).flatMap(e => [qParticiple(e, true), Math.random() < 0.4 ? qGerund(e) : null]))) },
  { id: 'patterns', name: 'Prepositions', icon: '🧭', desc: 'Which preposition does the verb take?', kind: 'verb', min: 2, start: drill('patterns', 'Verb patterns', ctx => lim(ctx, 15).map(e => qPattern(e))) },
  { id: 'verb-quiz', name: 'Verb mix', icon: '🎲', desc: 'Everything about your verbs in one round.', kind: 'verb', min: 2, tenses: true, start: drill('verb-quiz', 'Verb mix', ctx => mixedQuestions(lim(ctx, 10), ctx.pool, { perItem: 2, verbTenses: tensesOf(ctx, ['presente', 'passatoProssimo', 'imperfetto', 'futuro']) })) },
];

export const GAME_BY_ID = Object.fromEntries(GAMES.map(g => [g.id, g]));
export const TENSE_OPTIONS = DRILL_TENSES.map(k => [k, TENSE_BY_KEY[k].name]);
