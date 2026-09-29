// Conservative deterministic grading. It diagnoses only supported, identifiable
// contrasts; edit distance is never used to invent a grammatical misconception.
import { expandedForms, AUXILIARY_WORDS } from './questions.js';
import { ERROR_TIPS } from './content.js';

const normalize = s => String(s ?? '').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ').replace(/\s*'\s*/g, "'").replace(/[.!?]+$/, '').trim();
const loose = s => normalize(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const equal = (a, b) => normalize(a) === normalize(b);
const any = (given, forms = []) => forms.some(f => equal(given, f));
const letters = s => normalize(s).replace(/[^\p{L}]/gu, '');
const stripArticle = s => normalize(s).replace(/^(?:(?:il|lo|la|i|gli|le|un|uno|una)\s+|(?:l'|un')\s*)/, '');
const lastWord = s => normalize(s).split(' ').at(-1) || '';
const rootParticiple = s => lastWord(s).replace(/[oaie]$/, '');
const component = (skill, ok, errorTag) => ({ skill, ok, ...(!ok && errorTag ? { errorTag } : {}) });

function compoundParts(text) {
  const normalized = normalize(text);
  const re = /[\p{L}àèéìòù]+/gu;
  let m;
  while ((m = re.exec(normalized))) {
    if (AUXILIARY_WORDS.some(w => equal(w, m[0]))) {
      return { aux: m[0], prefix: normalized.slice(0, m.index).trim(), participle: normalized.slice(m.index + m[0].length).trim() };
    }
  }
  return { aux: '', prefix: '', participle: lastWord(normalized) };
}

function positiveComponents(q) {
  const d = q.meta?.diagnostic || {};
  const skills = new Set([q.meta?.skill || 'recall']);
  if (d.kind === 'verb') {
    skills.add('person'); skills.add('tense');
    if (d.clitic || d.compound?.clitic) skills.add('clitic');
    if (d.compound) {
      skills.add('auxiliary'); skills.add('participle');
      if (d.compound.checkAgreement) skills.add('agreement');
    }
  }
  if (d.kind === 'auxiliary' && d.inflected) skills.add('person');
  if (d.kind === 'progressive') {
    skills.add('person'); skills.add('tense'); skills.add('auxiliary'); skills.add('gerund');
    if (d.clitic) skills.add('clitic');
  }
  if (d.kind === 'plural' && d.requiresArticle) skills.add('article');
  return [...skills].map(skill => component(skill, true));
}

function diagnoseWrong(q, given) {
  const d = q.meta?.diagnostic || {};
  const skill = q.meta?.skill || 'recall';
  const base = [component(skill, false)];
  const failure = (tag, components = base, message = null) => ({ errorTags: [tag], components, feedback: message || ERROR_TIPS[tag] || ERROR_TIPS.uncertain });
  if (!normalize(given)) return failure('uncertain', base, 'Take a look at the example, then try a smaller step. This objective will stay in practice.');

  if (d.kind === 'auxiliary') {
    if (d.inflected) {
      const family = Object.keys(d.allAuxForms || {}).filter(k => any(given, d.allAuxForms[k]));
      if (family.some(k => d.auxKeys.includes(k))) return failure('auxiliaryPerson', [component('auxiliary', true), component('person', false, 'auxiliaryPerson')]);
      if (family.length) return failure('auxiliary', [component(skill, false, 'auxiliary'), component('auxiliary', false, 'auxiliary')]);
    } else if (['avere', 'essere'].includes(normalize(given))) return failure('auxiliary', [component('auxiliary', false, 'auxiliary')]);
    return failure('uncertain');
  }

  if (d.kind === 'progressive') {
    if ((d.personForms || []).some(form => equal(form.answer, given))) return failure('person', [component(skill, false, 'person'), component('person', false, 'person')], 'Keep the gerundio and choose the form of stare for the person shown.');
    const words = normalize(given).split(' '), stare = words.find(word => d.stareForms.includes(word));
    if (words.some(word => d.otherTenseForms?.includes(word))) return failure('tense', [component(skill, false, 'tense'), component('tense', false, 'tense')], 'The action is progressive, but the form of stare must match the requested time.');
    const expectedStare = d.stareForms[d.person];
    const gerundOK = words.includes(d.gerund) || q.answer.some(answer => lastWord(answer) === lastWord(given) && lastWord(answer).startsWith(d.gerund));
    if (!stare && !gerundOK) return failure('uncertain');
    const components = [component(skill, false)], tags = [];
    if (!stare) { components.push(component('auxiliary', false, 'auxiliary')); tags.push('auxiliary'); }
    else { components.push(component('auxiliary', true), component('person', stare === expectedStare, 'person')); if (stare !== expectedStare) tags.push('person'); }
    components.push(component('gerund', gerundOK, 'gerund'));
    if (!gerundOK) tags.push('gerund');
    if (d.clitic && stare === expectedStare && gerundOK) { components.push(component('clitic', false, 'clitic')); tags.push('clitic'); }
    return failure(tags[0] || 'uncertain', components, tags.includes('gerund') ? `Use ${d.gerund} as the gerundio; it does not change with the person.` : tags.includes('clitic') ? 'Keep the required pronoun before stare or attached to the gerundio, without repeating it.' : 'Use the requested form of stare for this person and time, followed by the gerundio.');
  }

  if (d.kind === 'verb') {
    const samePerson = (d.personForms || []).filter(x => equal(x.answer, given));
    const sameTense = (d.tenseForms || []).filter(x => equal(x.answer, given));
    if (samePerson.length && !sameTense.length) return failure('person', [component(skill, false, 'person'), component('person', false, 'person')]);
    if (sameTense.length && !samePerson.length) return failure('tense', [component(skill, false, 'tense'), component('tense', false, 'tense')]);
    if (d.compound) {
      const c = d.compound, actual = compoundParts(given);
      const expected = expandedForms(q.answer).map(compoundParts);
      const family = Object.keys(c.allAuxForms).filter(k => any(actual.aux, c.allAuxForms[k]));
      const familyOK = family.some(k => c.auxKeys.includes(k));
      const auxPersonOK = any(actual.aux, c.auxForms);
      const lexicalPP = c.citationParticiples.some(p => rootParticiple(p) === rootParticiple(actual.participle));
      const participleOK = any(actual.participle, c.participles);
      const cliticOK = !c.clitic || expected.some(x => equal(x.prefix, actual.prefix));
      const components = ['conjugation', 'context'].includes(skill) ? [component(skill, false)] : [];
      const tags = [];
      if (!family.length && !lexicalPP) return failure('uncertain');
      // Only a recognized auxiliary supports a reliable family/person diagnosis.
      if (family.length) {
        components.push(component('auxiliary', familyOK, 'auxiliary'));
        if (!familyOK) tags.push('auxiliary');
        else { components.push(component('person', auxPersonOK, 'auxiliaryPerson')); if (!auxPersonOK) tags.push('auxiliaryPerson'); }
      } else if (!actual.aux) { components.push(component('auxiliary', false, 'auxiliary')); tags.push('auxiliary'); }
      // Lexical identity and inflectional agreement are separate. Wrong agreement
      // does not erase knowledge of the irregular participle itself.
      components.push(component('participle', lexicalPP, 'participle'));
      if (!lexicalPP) tags.push('participle');
      if (c.checkAgreement && lexicalPP) { components.push(component('agreement', participleOK, 'agreement')); if (!participleOK) tags.push('agreement'); }
      if (c.clitic) { components.push(component('clitic', cliticOK, 'clitic')); if (!cliticOK) tags.push('clitic'); }
      if (tags.length) return { errorTags: [...new Set(tags)], components, feedback: [...new Set(tags)].slice(0, 2).map(t => ERROR_TIPS[t]).join(' ') };
    }
    if (d.clitic) {
      // If only the leading clitic differs, the finite form is identifiable.
      const remove = s => normalize(s).replace(/^(?:(?:mi|ti|si|ci|vi|me|te|se|ce|ve|ne|la|lo)\s+)+/, '');
      if (q.answer.some(a => remove(a) === remove(given))) return failure('clitic', [component(skill, false, 'clitic'), component('clitic', false, 'clitic'), component('person', true)]);
    }
    if (any(given, d.regularized || []) && !any(given, q.answer)) return failure('irregular', [component(skill, false, 'irregular')], 'This verb has an irregular form here. Compare its stem with the model, then try a new person or context.');
    return failure('uncertain');
  }
  if (d.kind === 'article') return failure('article', [component('article', false, 'article')]);
  if (d.kind === 'plural') {
    const bare = stripArticle(given), correctBare = equal(bare, d.plural);
    if (correctBare && d.requiresArticle) return failure('article', [component('plural', true), component('article', false, 'article')]);
    return failure('plural', [component('plural', false, 'plural')]);
  }
  if (d.kind === 'participle') return failure('participle', [component('participle', false, 'participle')]);
  if (d.kind === 'adjective') return failure('agreement', [component('agreement', false, 'agreement')], 'Match the adjective to the requested gender and number; some forms stay the same.');
  if (d.kind === 'component') return failure(d.component, [component(d.component, false, d.component)]);
  if (d.kind === 'recall' && d.noun && any(stripArticle(given), d.bareAnswers)) return failure('article', [component('recall', true), component('article', false, 'article')]);
  if (d.kind === 'meaning') return failure('meaning', [component(skill, false, 'meaning')]);
  if (d.kind === 'listening') return failure('spelling', [component(skill, false, 'spelling')]);
  // A wrong vocabulary answer can reflect meaning, spelling or retrieval. Do not
  // claim to know which without a supported diagnostic contrast.
  return failure('uncertain');
}

export function gradeQuestion(q, given, { revealed = false, assistance = [], accentStrict = false } = {}) {
  const input = typeof given === 'number' && q.choices?.[given] ? q.choices[given].label : String(given ?? '');
  const answers = expandedForms(q.answer || []);
  const exact = any(input, answers) || (q.type === 'mc' && (q.choices || []).some(c => c.correct && equal(c.label, input)));
  const accentIssue = !exact && answers.some(a => loose(a) === loose(input));
  const ok = !revealed && (exact || (accentIssue && !accentStrict));
  const assisted = revealed || (Array.isArray(assistance) ? assistance.length > 0 : !!assistance);
  if (revealed) return { ok: false, outcome: 'revealed', errorTags: [], feedback: `Here is the model: ${answers[0] || ''}. We’ll check it again without help.`, components: [], exact: false, accentIssue: false, assisted: true };
  if (ok) return {
    ok: true, outcome: 'correct', errorTags: accentIssue ? ['accent'] : [],
    feedback: accentIssue ? `The form is right; notice the accent: ${answers[0]}.` : assisted ? 'Correct with support. Try a fresh question without help next.' : 'Correct. We’ll check it in another form or context too.',
    components: [...positiveComponents(q), component('orthography', !accentIssue || !accentStrict)], exact, accentIssue, assisted,
  };
  if (accentIssue) return {
    ok: false, outcome: 'incorrect', errorTags: ['accent'], feedback: `Check the accent: ${answers[0]}. The grammar is otherwise right.`,
    components: [...positiveComponents(q), component('orthography', false, 'accent')], exact: false, accentIssue: true, assisted,
  };
  const result = diagnoseWrong(q, input);
  return { ok: false, outcome: 'incorrect', ...result, exact: false, accentIssue: false, assisted };
}
