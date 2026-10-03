// One bounded current-only source revision; old source fields remain exact.
export const workshopTemplatePrior = Object.freeze({
  commit: 'e14366b', path: 'data/sentence-lab/strutture.json',
  rawSHA256: '75965da68e980339053dc289fbc65198cb0e75f72f992a0b25811f41396e61f2',
  jsonSHA256: '1b0bfbe7835840aa678753fe19694584831716b6d24c0f807f84bf7498c52564',
});
export const workshopTemplateReview = Object.freeze({
  reviewStatus: 'independent-agent-review',
  reviewRecord: 'docs/implementation/programme/workshop-template-stanco-independent-review.json',
  reviewScope: 'chosen-form-translation-agreement', nativeItalianEducatorReview: 'pending',
});
export const workshopTemplateRevisions = [{
  stage: 'strutture', lessonId: 'sl-strutture-03-quindi-allora-pero', activityIndex: 3, blankIndex: 0,
  activityId: 'sl-strutture-03-quindi-allora-pero.4',
  templateRevision: 'sl-strutture-03-quindi-allora-pero.4:agreement-v2',
  templateByAgreement: {m: 'Sono stanco, quindi stasera ____ a casa.', f: 'Sono stanca, quindi stasera ____ a casa.'},
  legacyTemplate: {revision: 'sl-strutture-03-quindi-allora-pero.4:original-v1', template: 'Sono stanco, quindi stasera ____ a casa.', en: "I'm tired, so tonight I'm staying at home."},
  sourceExamplesByAgreement: Object.fromEntries(['m', 'f'].map(agreement => [agreement, [{
    agreement, values: ['resto'], it: `Sono ${agreement === 'f' ? 'stanca' : 'stanco'}, quindi stasera resto a casa.`,
    en: 'I am tired, so tonight I am staying at home.', subjectAgreement: agreement, subjectScope: 'speaker',
    sourceNote: 'The adjective agrees with this first-person singular speaker; resto is the same present-tense verb for either agreement.',
    ...workshopTemplateReview,
  }]])),
}];

export function withoutWorkshopTemplateRevisions(pack) {
  const prior = structuredClone(pack);
  for (const lesson of prior.lessons || []) for (const [activityIndex, activity] of (lesson.activities || []).entries()) {
    const row = workshopTemplateRevisions.find(row => row.lessonId === lesson.id && row.activityIndex === activityIndex && row.activityId === activity.id);
    for (const field of ['templateRevision', 'templateByAgreement', 'legacyTemplate']) {
      if (!row && Object.hasOwn(activity, field)) throw new Error(`Unexpected template declaration: ${activity.id}.${field}`);
      if (row) delete activity[field];
    }
    for (const [blankIndex, blank] of (activity.blanks || []).entries()) {
      if ((!row || blankIndex !== row.blankIndex) && Object.hasOwn(blank, 'sourceExamplesByAgreement')) throw new Error(`Unexpected example declaration: ${activity.id}.blank-${blankIndex}`);
      if (row && blankIndex === row.blankIndex) delete blank.sourceExamplesByAgreement;
    }
    // Dialogue turns have no declared template revision in this bounded slice.
    for (const turn of activity.turns || []) {
      if (['templateRevision', 'templateByAgreement', 'legacyTemplate'].some(field => Object.hasOwn(turn, field)) || (turn.blanks || []).some(blank => Object.hasOwn(blank, 'sourceExamplesByAgreement'))) throw new Error(`Unexpected dialogue template declaration: ${activity.id}`);
    }
  }
  return prior;
}
