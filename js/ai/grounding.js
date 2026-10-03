export const LEVELS = Object.freeze(['Foundations', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export function levelIncludes(ceiling, level) {
  const top = LEVELS.indexOf(ceiling), current = LEVELS.indexOf(level);
  return top >= 0 && current >= 0 && current <= top;
}
const normalized = value => String(value || '').normalize('NFC').toLocaleLowerCase('it');

/** Content is supplied by the verified dictionary/reference, never by an LLM.
 * Retrieval is lexical and bounded; a rule's confirmCorrection is a separate
 * deterministic verifier. Merely retrieving a rule does not validate a claim. */
export function createGrounding({ senses = [], rules = [], version = 'unversioned' } = {}) {
  const select = (records, request, limit, allowWordException = false) => {
    const text = normalized(request.text);
    return records.filter(record => record.verified === true &&
      (levelIncludes(request.level, record.level) || allowWordException && wordException(request,record.id)) &&
      (request.requestedIds?.includes(record.id) || (record.keywords || []).some(word => text.includes(normalized(word)))))
      .slice(0, limit);
  };
  return {
    version,
    retrieve(request) { return { version, senses: select(senses, request, 5, true), rules: select(rules, request, 5) }; },
  };
}

export function groundingForPrompt(grounding) {
  const safeRecord = ({ id, level, lemma, forms, definition, explanation, examples, source }) =>
    Object.fromEntries(Object.entries({ id, level, lemma, forms, definition, explanation, examples, source }).filter(([, value]) => value !== undefined));
  return { version: grounding.version, senses: grounding.senses.map(safeRecord), rules: grounding.rules.map(safeRecord) };
}
import { wordException } from './language-scope.js';
