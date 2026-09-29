import { conjugate, MISSING, TENSE_BY_KEY } from '../conjugator.js';
import { isPluralOnly, hasPluralForm } from '../data.js';
import { ANCHOR_CONTEXTS, TENSE_LESSONS } from './content.js';

export const CORE_STAGES = [
  { id: 'present', label: 'Present', tense: 'presente', description: 'Now and everyday routines' },
  { id: 'past', label: 'Past: what happened', tense: 'passatoProssimo', description: 'Completed events, auxiliaries and participles' },
  { id: 'background', label: 'Imperfetto', tense: 'imperfetto', description: 'Past habits, descriptions and background' },
  { id: 'future', label: 'Future', tense: 'futuro', description: 'Plans and predictions' },
  { id: 'condizionale', label: 'Conditional', tense: 'condizionale', description: 'Wishes, polite requests and hypothetical results' },
];
export const EXPANSIONS = [
  { id: 'requests', label: 'Requests and commands', tenses: ['condizionale', 'imperativo'] },
  { id: 'stories', label: 'More detailed stories', tenses: ['trapassatoProssimo', 'passatoRemoto'] },
  { id: 'opinions', label: 'Opinions and hypotheses', tenses: ['congiuntivoPresente', 'congiuntivoImperfetto'] },
  { id: 'advanced', label: 'Other compound forms', tenses: ['futuroAnteriore', 'condizionalePassato', 'congiuntivoPassato', 'congiuntivoTrapassato', 'trapassatoRemoto'] },
];
export const ANCHOR_VERBS = Object.keys(ANCHOR_CONTEXTS);
export const entryKind = e => e && (e.kind === 'verb' || e.pos === 'verb' || e.inf) ? 'verb' : 'word';
const validForm = f => !!f && f !== MISSING;
export const objectiveId = (entryId, tense, skill) => `${entryId}::${tense || 'word'}::${skill}`;

export function allowedTenses(learningOrPreferences = {}) {
  const p = learningOrPreferences?.preferences || learningOrPreferences?.curriculum || learningOrPreferences || {};
  const stage = typeof p === 'string' ? p : p.stage || p.coreStage || 'present';
  const idx = Math.max(0, CORE_STAGES.findIndex(s => s.id === stage));
  const selected = p.expansions || p.enrolledExpansions || [];
  const ids = new Set(Array.isArray(selected) ? selected.map(x => typeof x === 'string' ? x : x?.id) : Object.keys(selected).filter(k => selected[k]));
  return [...new Set([...CORE_STAGES.slice(0, idx + 1).map(s => s.tense), ...(p.legacyTenses || []).filter(t => ['imperfetto', 'futuro'].includes(t)), ...EXPANSIONS.filter(e => ids.has(e.id)).flatMap(e => e.tenses)])];
}

function objective(e, stage, tense, skill, label, explanation, extra = {}) {
  return { id: objectiveId(e.id, tense, skill), entryId: e.id, kind: entryKind(e), stage, tense: tense || null, skill, label, description: explanation, explanation, ...extra };
}

export function objectivesFor(entry, { stage = 'present', expansions = [], legacyTenses = [] } = {}) {
  if (!entry?.id) return [];
  if (entryKind(entry) === 'word') {
    const out = [
      objective(entry, 'words', null, 'meaning', 'Understand the meaning', 'Connect the word with its meaning and an example.'),
      objective(entry, 'words', null, 'recall', 'Recall the Italian', 'Retrieve the Italian word from its meaning, without an answer list.'),
    ];
    if (entry.pos === 'noun' && entry.g) out.push(objective(entry, 'words', null, 'article', 'Choose the article', 'Learn the article together with the noun; gender, number and first sound matter.'));
    if (hasPluralForm(entry) && !isPluralOnly(entry)) out.push(objective(entry, 'words', null, 'plural', 'Build the plural', 'Remember this noun’s plural, including spelling changes and invariable forms.'));
    // The source sentence is reused only when its exact target can be safely located.
    if (entry.ex && entry.it && entry.ex.toLocaleLowerCase('it').includes(entry.it.toLocaleLowerCase('it'))) out.push(objective(entry, 'words', null, 'context', 'Use the word in context', 'Use the learned word in its dictionary example.', { optional: true, required: false }));
    out.push(objective(entry, 'words', null, 'listening', 'Listen and recall', 'Listen to the Italian and write what you hear.', { optional: true, required: false }));
    return out;
  }
  const current = CORE_STAGES.find(s => s.id === stage) || CORE_STAGES[0];
  let c;
  try { c = conjugate(entry.inf || entry.it, { aux: entry.aux, isc: entry.isc }); } catch { return []; }
  const tenses = allowedTenses({ stage, expansions, legacyTenses });
  const out = [objective(entry, stage, 'meaning', 'recall', 'Recall the verb', 'Connect the meaning with the infinitive, then retrieve it without help.')];
  for (const tense of tenses) {
    if (!c.tenses[tense]?.some(validForm)) continue;
    const label = TENSE_BY_KEY[tense]?.name || tense;
    out.push(objective(entry, stage, tense, 'conjugation', label, TENSE_LESSONS[tense] || `Build the requested ${label} form. Check the person and any auxiliary.`));
    if (tense === 'passatoProssimo' && validForm(c.nonFinite.participioPassato)) {
      out.push(objective(entry, stage, tense, 'auxiliary', 'Choose the auxiliary', 'Choose avere or essere for this verb. Some verbs allow either auxiliary, depending on meaning.'));
      out.push(objective(entry, stage, tense, 'participle', 'Recall the participle', 'Build or recall the past participle; common irregular forms need individual practice.'));
      // Without authored meaning, agreement cannot be inferred for a both-auxiliary/custom verb.
      if (c.aux === 'essere' && !c.auxBoth && ANCHOR_CONTEXTS[entry.inf]) out.push(objective(entry, stage, tense, 'agreement', 'Match the participle', 'With essere, match the participle to the explicitly named subject.'));
    }
    if (tense === 'imperfetto' && ANCHOR_CONTEXTS[entry.inf]) out.push(objective(entry, stage, tense, 'context', 'Choose the everyday past', 'Distinguish a completed episode from a past habit or background; read the intended meaning of the whole prompt.'));
  }
  return out;
}

export function stageObjectives(entries, stage = 'present') {
  const blueprint = {
    present: [['essere', 'conjugation'], ['avere', 'conjugation'], ['parlare', 'conjugation'], ['prendere', 'conjugation'], ['dormire', 'conjugation'], ['capire', 'conjugation'], ['andare', 'conjugation']],
    past: [['mangiare', 'conjugation'], ['andare', 'auxiliary'], ['andare', 'agreement'], ['prendere', 'participle'], ['alzarsi', 'conjugation']],
    background: [['parlare', 'conjugation'], ['essere', 'conjugation'], ['mangiare', 'context']],
    future: [['parlare', 'conjugation'], ['dormire', 'conjugation'], ['andare', 'conjugation'], ['essere', 'conjugation']],
    condizionale: [['volere', 'conjugation'], ['potere', 'conjugation'], ['andare', 'conjugation']],
  };
  const tense = CORE_STAGES.find(s => s.id === stage)?.tense;
  return (blueprint[stage] || []).flatMap(([inf, skill]) => {
    const e = entries.find(x => (x.inf || x.it) === inf);
    const o = e && objectivesFor(e, { stage }).find(x => x.tense === tense && x.skill === skill);
    return o ? [{ ...o, checkpoint: true, ...(skill === 'conjugation' ? { personsRequired: [0, 1, 2, 3, 4, 5] } : {}) }] : [];
  });
}
