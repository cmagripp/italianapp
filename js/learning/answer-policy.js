// Pure submission policy shared by every typed activity. It never supplies
// missing words, changes agreement or rewrites an open-ended response.
export const ANSWER_POLICY_VERSION = 1;
const VOWELS = { à:'a', á:'a', è:'e', é:'e', ì:'i', í:'i', ò:'o', ó:'o', ù:'u', ú:'u' };
export const foldItalianAccents = value => String(value ?? '').normalize('NFC')
  .replace(/[àáèéìíòóùú]/gi, c => c === c.toUpperCase() ? VOWELS[c.toLowerCase()].toUpperCase() : VOWELS[c]);

export function normalizeSubmission(value, { trailingPunctuation = true } = {}) {
  let text = String(value ?? '').normalize('NFC').toLocaleLowerCase('it')
    .replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ').replace(/\s*'\s*/g, "'");
  if (trailingPunctuation) text = text.replace(/[.!?,;:]+$/, '').trim();
  return text;
}

function accentEdits(original, accepted) {
  const source = original.normalize('NFC');
  const letters = [...accepted.normalize('NFC')].filter(c => /\p{L}/u.test(c));
  let index = 0, offset = 0, displayText = '';
  const differences = [];
  for (const char of source) {
    let next = char;
    if (/\p{L}/u.test(char)) {
      const model = letters[index++];
      if (model && char.toLocaleLowerCase('it') !== model.toLocaleLowerCase('it') &&
          foldItalianAccents(char).toLocaleLowerCase('it') === foldItalianAccents(model).toLocaleLowerCase('it')) {
        next = char === char.toLocaleUpperCase('it') ? model.toLocaleUpperCase('it') : model.toLocaleLowerCase('it');
        differences.push({start:offset,end:offset+char.length,before:char,after:next,
          kind:foldItalianAccents(char)===char?'missing':foldItalianAccents(next)===next?'extra':'direction'});
      }
    }
    displayText += next;
    offset += char.length;
  }
  return {displayText,differences};
}

export function compareSubmission(value, accepted, {
  accentStrict = false, inputMode = 'typed', language = 'it', trailingPunctuation = true,
} = {}) {
  const originalText = String(value ?? '');
  const normalizedText = normalizeSubmission(originalText, {trailingPunctuation});
  const forms = [...new Set((Array.isArray(accepted) ? accepted : [accepted])
    .filter(a => typeof a === 'string' && a.trim()))];
  const exact = normalizedText && forms.find(a => normalizeSubmission(a, {trailingPunctuation}) === normalizedText);
  const matches = !exact && normalizedText && language === 'it' ? forms.filter(a =>
    foldItalianAccents(normalizeSubmission(a, {trailingPunctuation})) === foldItalianAccents(normalizedText)) : [];
  const distinct = [...new Map((matches || []).map(a => [normalizeSubmission(a, {trailingPunctuation}),a])).values()];
  const matchedAnswerText = exact || (distinct.length === 1 ? distinct[0] : null);
  const accentIssue = !exact && distinct.length > 0;
  const mayRestore = inputMode === 'speech-transcript' || inputMode === 'typed' && !accentStrict;
  const ok = !!exact || distinct.length === 1 && mayRestore;
  const edited = accentIssue && matchedAnswerText ? accentEdits(originalText, matchedAnswerText) : null;
  return {
    policyVersion:ANSWER_POLICY_VERSION, inputMode, language, accentStrict:!!accentStrict,
    originalText, normalizedText, matchedAnswerText,
    matchKind:exact?'exact':distinct.length>1?'ambiguous':accentIssue?'accent-only':'invalid',
    accentDifferences:edited?.differences || [],
    displayText:ok && edited ? edited.displayText : originalText.normalize('NFC'),
    ok, exact:!!exact, accentIssue, outcome:ok?'correct':'incorrect',
  };
}

// Persist only bounded plain fields from imported/history results. The saved
// outcome and policy describe that submission, never the current settings.
export function savedSubmission(value) {
  if (!value || value.policyVersion !== ANSWER_POLICY_VERSION ||
      typeof value.originalText !== 'string' || typeof value.displayText !== 'string') return null;
  const text = s => typeof s === 'string' ? s.slice(0,12000) : '';
  return {
    policyVersion:ANSWER_POLICY_VERSION,
    inputMode:['typed','choice','speech-transcript'].includes(value.inputMode)?value.inputMode:'typed',
    language:value.language==='en'?'en':'it', accentStrict:value.accentStrict===true,
    originalText:text(value.originalText), normalizedText:text(value.normalizedText),
    matchedAnswerText:typeof value.matchedAnswerText==='string'?text(value.matchedAnswerText):null,
    matchKind:['exact','accent-only','invalid','ambiguous'].includes(value.matchKind)?value.matchKind:'invalid',
    displayText:text(value.displayText), ok:value.ok===true, exact:value.exact===true,
    accentIssue:value.accentIssue===true, outcome:value.outcome==='correct'?'correct':'incorrect',
    accentDifferences:(Array.isArray(value.accentDifferences)?value.accentDifferences:[]).slice(0,200)
      .filter(d=>Number.isInteger(d?.start)&&Number.isInteger(d?.end)&&d.start>=0&&d.end>=d.start&&d.end<=12000)
      .map(d=>({start:d.start,end:d.end,before:text(d.before).slice(0,4),after:text(d.after).slice(0,4),
        kind:['missing','extra','direction'].includes(d.kind)?d.kind:'direction'})),
  };
}
