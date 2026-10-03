export class AIValidationError extends Error {
  constructor(reasons, raw) { super(`AI response rejected: ${reasons.join('; ')}`); this.name = 'AIValidationError'; this.reasons = reasons; this.raw = raw; }
}
const hasInternal = text => /<\/?think>|\[INST\]|<\|[^>]*\|>|```/.test(text);
const isText = (value, max) => typeof value === 'string' && !!value.trim() && value.length <= max && !hasInternal(value);
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const protectedTokens = text => (String(text).match(/\b\d+(?:[.,:]\d+)*\b|\b(?:non|mai|nessuno|nessuna|niente|nulla|zero|due|tre|quattro|cinque|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti)\b/gi) || []).map(token => token.toLocaleLowerCase('it')).sort();
export function preservesProtectedMeaning(original, replacement, protectedNames = []) {
  return JSON.stringify(protectedTokens(original)) === JSON.stringify(protectedTokens(replacement)) &&
    protectedNames.every(name => original.includes(name) === replacement.includes(name));
}

/** Validation protects structure, provenance and claims with injected verifiers.
 * It is deliberately not a proof that free Italian prose is pedagogically right. */
export function validateResponse(raw, { request, grounding, participants }) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw.replace(/^<think>\s*<\/think>\s*/, '')) : raw; }
  catch { throw new AIValidationError(['invalid JSON'], raw); }
  let replySupport=null;
  if(request.requestReplySupport&&value&&Object.hasOwn(value,'replySupport')){replySupport=value.replySupport;value={...value};delete value.replySupport;}
  if (exactKeys(value, ['participantId', 'text', 'corrections'])) value = { ...value, vocabulary: [] };
  if (Array.isArray(value?.corrections)) value = { ...value, corrections: value.corrections.map(c => exactKeys(c, ['original', 'replacement', 'ruleId']) ? { ...c, reason: 'Verified reference explanation only.' } : c) };
  const reasons = [];
  if (!exactKeys(value, ['participantId', 'text', 'corrections', 'vocabulary'])) reasons.push('unexpected response fields');
  if (!participants.some(p => p.id === value?.participantId)) reasons.push('unknown participant');
  if (!isText(value?.text, 1200)) reasons.push('empty, oversized or internal output');
  const sentences = typeof value?.text === 'string' ? value.text.match(/[^.!?]+[.!?]/g) || [] : [];
  if (typeof value?.text === 'string' && value.text.trim() === request.text.trim()) reasons.push('partner echoes the learner instead of responding');
  if (sentences.length >= 3 && new Set(sentences.map(s => s.trim().toLowerCase())).size < sentences.length) reasons.push('repeated sentences');
  if (!Array.isArray(value?.corrections) || value.corrections.length > 1) reasons.push('invalid correction list');
  else for (const correction of value.corrections) {
    if (!exactKeys(correction, ['original', 'replacement', 'ruleId', 'reason']) || !['original', 'replacement', 'reason'].every(key => isText(correction[key], 600))) { reasons.push('invalid correction'); continue; }
    if (!request.text.includes(correction.original)) reasons.push('correction source is not the learner text');
    if (request.recognitionUncertain) reasons.push('uncertain recognition cannot be graded');
    const rule = grounding.rules.find(item => item.id === correction.ruleId);
    if (!rule || typeof rule.confirmCorrection !== 'function' || rule.confirmCorrection(correction, request) !== true) reasons.push('unsupported correction');
    if (!rule || typeof rule.source !== 'string' || !rule.source.trim() || !isText(rule.explanation, 600)) reasons.push('verified correction source unavailable');
    if (!preservesProtectedMeaning(correction.original, correction.replacement, request.protectedNames || [])) reasons.push('correction changes protected meaning');
  }
  if (!Array.isArray(value?.vocabulary) || value.vocabulary.length > 5) reasons.push('invalid vocabulary list');
  else for (const item of value.vocabulary) {
    if (!exactKeys(item, ['senseId', 'sourceText']) || !isText(item.sourceText, 300) || !grounding.senses.some(sense => sense.id === item.senseId)) reasons.push('unverified vocabulary');
    else if (!`${request.text}\n${value.text}`.includes(item.sourceText)) reasons.push('vocabulary has no source');
  }
  if(replySupport!=null){
    if(!exactKeys(replySupport,['prefix','suffix','choices'])||!['prefix','suffix'].every(key=>typeof replySupport[key]==='string'&&replySupport[key].length<=200&&!hasInternal(replySupport[key]))||!Array.isArray(replySupport.choices)||replySupport.choices.length<2||replySupport.choices.length>4)reasons.push('invalid reply support');
    else {
      const seen=new Set();
      for(const choice of replySupport.choices){
        const sense=grounding.senses.find(s=>s.id===choice?.senseId),surfaces=[sense?.lemma,...(sense?.forms||[])];
        if(!exactKeys(choice,['surface','senseId'])||!isText(choice.surface,100)||!sense?.verified||!sense.source||!surfaces.includes(choice.surface)||seen.has(choice.surface))reasons.push('reply support has an unverified or repeated word');
        seen.add(choice?.surface);
      }
    }
  }
  if (reasons.length) throw new AIValidationError([...new Set(reasons)], raw);
  // Explanations displayed as rule authority come from the verified reference,
  // while the model's proposed wording is retained only for audit provenance.
  const corrections = value.corrections.map(c => { const rule = grounding.rules.find(r => r.id === c.ruleId); return { ...c, reason: rule.explanation, source: rule.source || null }; });
  return { message: { participantId: value.participantId, text: value.text.trim() }, corrections, vocabulary: value.vocabulary,
    ...(request.requestReplySupport?{replySupport}:{}),
    provenance: { sourceRevision: request.sourceRevision ?? null, groundingVersion: grounding.version, task: request.task,
      generatedReasons: value.corrections.map(c => c.reason), validation: 'structure and verified metadata; free prose still requires language evaluation', masteryAwarded: false } };
}
