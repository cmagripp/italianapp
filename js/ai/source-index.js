const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Index only retrieved verified senses actually present in finalized text.
 * This produces source links, not a claim that every sense was mastered or that
 * every otherwise unknown word has been resolved. */
export function indexGroundedVocabulary(grounding, learnerText, partnerText) {
  const result = [];
  for (const sense of grounding.senses) {
    const forms = [sense.lemma, ...(sense.forms || []).map(form => form.replace(/^(?:il|lo|la|i|gli|le)\s+|^l[’']/i, ''))].filter(Boolean);
    let sourceText;
    for (const text of [partnerText, learnerText]) {
      for (const form of forms) {
        const match = String(text).match(new RegExp(`(?<![\\p{L}\\p{N}])${escape(form)}(?![\\p{L}\\p{N}])`, 'iu'));
        if (match) { sourceText = match[0]; break; }
      }
      if (sourceText) break;
    }
    if (sourceText) result.push({ senseId: sense.id, sourceText });
  }
  return result;
}
