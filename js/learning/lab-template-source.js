// Select only a source-declared Workshop cloze template. Reading an old state
// never upgrades it; explicit unsupported revision markers remain unavailable.
const own = (object, key) => !!object && Object.hasOwn(object, key);
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 5000;
const revision = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
const blankCount = template => (template.match(/_{2,}/g) || []).length;
const declared = activity => ['templateRevision', 'templateByAgreement', 'legacyTemplate'].some(key => own(activity, key));

function validSource(activity) {
  const variants = activity?.templateByAgreement, legacy = activity?.legacyTemplate;
  return activity?.kind === 'cloze' && revision(activity.templateRevision)
    && record(variants) && Object.keys(variants).sort().join(',') === 'f,m'
    && text(activity.template) && text(variants.m) && text(variants.f)
    && record(legacy) && Object.keys(legacy).sort().join(',') === 'en,revision,template'
    && revision(legacy.revision) && legacy.revision !== activity.templateRevision
    && text(legacy.template) && typeof legacy.en === 'string'
    && legacy.template === activity.template && legacy.en === activity.en
    && Array.isArray(activity.blanks) && activity.blanks.length > 0
    && [activity.template, variants.m, variants.f, legacy.template].every(template => blankCount(template) === activity.blanks.length)
    && activity.blanks.every(blank => record(blank.sourceExamplesByAgreement)
      && Object.keys(blank.sourceExamplesByAgreement).sort().join(',') === 'f,m'
      && ['m', 'f'].every(gender => Array.isArray(blank.sourceExamplesByAgreement[gender]) && blank.sourceExamplesByAgreement[gender].length > 0));
}

export function initialLabTemplateRevision(activity) {
  return declared(activity) && validSource(activity) ? {templateRevision: activity.templateRevision} : {};
}

export function resolveLabTemplate(activity, state, agreement = 'm') {
  const unavailable = {available: false, reason: 'This saved sentence version is unavailable. Your draft and earlier results are kept.'};
  if (!declared(activity)) return own(state, 'templateRevision') ? unavailable : {available: true, activity, revision: null, legacy: false};
  if (!validSource(activity) || !['m', 'f'].includes(agreement)) return unavailable;
  // Truly absent is the original saved recipe. Null, empty, malformed or unknown
  // markers are not proof of that recipe and must not be silently upgraded.
  if (!own(state, 'templateRevision') || state.templateRevision === activity.legacyTemplate.revision) {
    return {available: true, activity: {...activity, template: activity.legacyTemplate.template, en: activity.legacyTemplate.en},
      revision: activity.legacyTemplate.revision, legacy: true, agreement};
  }
  if (state.templateRevision !== activity.templateRevision) return unavailable;
  return {available: true, activity: {...activity, template: activity.templateByAgreement[agreement],
    blanks: activity.blanks.map(blank => ({...blank, sourceExamples: blank.sourceExamplesByAgreement[agreement]}))},
    revision: activity.templateRevision, legacy: false, agreement};
}
