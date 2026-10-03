/** Cards copy reviewed source material; generated partner prose is never
 * converted into a dictionary definition or grammatical authority. */
export function verifiedTeachingCards(request, grounding, corrections) {
  const sourced = record => typeof record.source === 'string' && !!record.source.trim();
  const senses = request.task === 'coach' || request.task === 'explain' ? grounding.senses.filter(sourced) : [];
  const ruleIds = new Set(corrections.map(c => c.ruleId));
  const rules = grounding.rules.filter(rule => sourced(rule) && (ruleIds.has(rule.id) || request.task === 'explain'));
  return [
    ...senses.map(sense => ({ kind: 'sense', id: sense.id, level: sense.level, title: sense.lemma,
      definition: sense.definition, forms: [...(sense.forms || [])], examples: [...(sense.examples || [])], source: sense.source || null })),
    ...rules.map(rule => ({ kind: 'rule', id: rule.id, level: rule.level, explanation: rule.explanation,
      examples: [...(rule.examples || [])], source: rule.source || null })),
  ];
}
