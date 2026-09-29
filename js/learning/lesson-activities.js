// Pure supported activities. All rendered text is data; UI state lives in the
// session, while only validated attempt metadata belongs in the learning log.
import { gradeQuestion } from './diagnose.js';

const normalize = text => String(text ?? '').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ');
function shuffled(values, seed = 0) {
  const out = values.slice();
  let n = (Number(seed) || 0) + 31;
  for (let i = out.length - 1; i > 0; i--) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const j = n % (i + 1); [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createLetterActivity(question, { seed = 0 } = {}) {
  if (!question?.answer?.length || question.meta?.answerLanguage === 'en' || question.meta?.supportOnly) return question;
  const canonical = String(question.answer[0]).normalize('NFC');
  if (!canonical || canonical.length > 60) return question;
  const tiles = [], slots = [];
  for (const letter of Array.from(canonical)) {
    if (/[\p{L}\p{N}]/u.test(letter)) {
      tiles.push({ id: `letter:${tiles.length}`, text: letter });
      slots.push({ kind: 'letter' });
    } else slots.push({ kind: 'fixed', text: letter });
  }
  if (!tiles.length || tiles.length > 40) return question;
  return { ...question, type: 'letters', choices: [], canonical, tiles: shuffled(tiles, seed), slots,
    meta: { ...question.meta, mode: 'recognition', evidenceMode: 'recognition', activityKind: 'letters', supportOnly: true } };
}

export function createPairActivity(question, pairs, { seed = 0 } = {}) {
  const valid = (pairs || []).filter(pair => pair?.targetId && pair.question?.answer?.length);
  if (valid.length !== 3 || new Set(valid.map(pair => pair.targetId)).size !== 3) return question;
  const rows = valid.map(pair => ({ id: pair.targetId, targetId: pair.targetId, label: pair.label,
    answers: pair.question.answer.slice(), canonical: pair.question.answer[0], question: pair.question,
    meta: { ...pair.question.meta, mode: 'recognition', evidenceMode: 'recognition', activityKind: 'pairs' } }));
  // If accepted sets overlap, all tiles in that connected group use a shared
  // valid form. A grammatical match must never consume the only tile another
  // person can accept (e.g. ordinary è andato/a versus formal feminine è andata).
  const pending = new Set(rows);
  while (pending.size) {
    const component = [pending.values().next().value]; pending.delete(component[0]);
    for (let i = 0; i < component.length; i++) for (const row of pending) {
      if (row.answers.some(answer => component[i].answers.some(other => normalize(answer) === normalize(other)))) { component.push(row); pending.delete(row); }
    }
    if (component.length > 1) {
      const common = component[0].answers.find(answer => component.every(row => row.answers.some(other => normalize(other) === normalize(answer))));
      if (!common) return question;
      for (const row of component) row.canonical = common;
    }
  }
  return { ...question, type: 'pairs', choices: [],
    prompt: '<div class="big md">Match the pairs</div>',
    pairs: rows, leftOrder: shuffled(rows.map(pair => pair.id), seed + 101),
    rightTiles: shuffled(rows.map((pair, index) => ({ id: `pair-form:${index}`, pairId: pair.id, text: pair.canonical })), seed),
    meta: { ...question.meta, mode: 'recognition', evidenceMode: 'recognition', activityKind: 'pairs', supportOnly: true } };
}

export function gradePairActivity(question, { targetId, given } = {}) {
  const pair = question?.type === 'pairs' && question.pairs?.find(row => row.targetId === targetId);
  if (!pair || typeof given !== 'string') return null;
  // Compare values rather than tile identities: lui/lei and formal Lei may
  // legitimately share a form, and their identical tiles are interchangeable.
  const grade = gradeQuestion(pair.question, given, { assistance: ['matching'], accentStrict: true });
  if (pair.answers.some(answer => normalize(answer) === normalize(given))) return { ...grade, ok: true, outcome: 'correct', errorTags: [] };
  return grade;
}
