// Adaptive learning's data model. No browser or store dependencies: identical evidence
// produces identical progress, including after an offline merge or backup import.
import { schedule } from '../srs.js';
import { grammarSkill } from './grammar-state.js';
import { courseSkill } from './course-v2-state.js';
import { savedSubmission } from './answer-policy.js';
import { canonicalObjectiveId, canonicalizeAttempt, objectiveRegistryRevision, objectiveMappingSignature, OBJECTIVE_MAPPING_VERSION } from './objectives.js';

export const LEARNING_VERSION = 6;
const DAY = 86400e3;
const SHORT_REVIEW = 10 * 60e3;
const REPEAT_DELAY = 8 * 3600e3;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const finite = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const text = (s, fallback = '') => typeof s === 'string' ? s : fallback;
const unique = (xs) => [...new Set(xs)];
const strings = (xs) => unique(Array.isArray(xs) ? xs.filter(x => typeof x === 'string' && x && !BAD_KEYS.has(x)) : []);
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const unsupported = domain => finite(domain?.version) > LEARNING_VERSION;
// Short word lessons and course vocabulary boards never produce unaided production evidence.
const SUPPORTED_WORD_POLICIES = new Set(['word-short-v1', 'word-lesson-match-v1', 'word-lab-drill-v1']);
const canonicalEvents = new WeakSet();
const indexStats = { normalizedEvents:0, builds:0, appends:0, replayedEvents:0, checkpointHits:0 };
const CHECKPOINT_POLICY='learning-v6-lossless-2-grammar-evidence';

// Also used for session UI state. Never preserve functions, DOM nodes, prototypes,
// undefined values or cycles from an accidental caller-supplied question object.
function plain(value, depth = 0, ancestors = new Set()) {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object' || depth > 24 || ancestors.has(value)) return undefined;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return undefined;
  const seen = new Set(ancestors); seen.add(value);
  if (Array.isArray(value)) return value.map(x => plain(x, depth + 1, seen)).filter(x => x !== undefined);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (BAD_KEYS.has(key)) continue;
    const v = plain(value[key], depth + 1, seen);
    if (v !== undefined) out[key] = v;
  }
  return out;
}
const stable = (value) => JSON.stringify(plain(value));

function normalizeSession(raw) {
  const p = plain(raw);
  if (!p || !text(p.id) || !text(p.entryId)) return null;
  const deferred = {};
  for (const [id, at] of Object.entries(p.deferred || {})) if (!BAD_KEYS.has(id)) deferred[id] = finite(at);
  return {
    ...p,
    id: p.id, entryId: p.entryId, mode: text(p.mode, 'lesson'),
    objectiveIds: strings(p.objectiveIds),
    activeObjectiveId: text(p.activeObjectiveId) || null,
    deferred, answeredEventIds: strings(p.answeredEventIds),
    completedObjectiveIds: strings(p.completedObjectiveIds),
    reviewedObjectiveIds: strings(p.reviewedObjectiveIds),
    index: Math.max(0, Math.floor(finite(p.index))),
    createdAt: finite(p.createdAt), updatedAt: finite(p.updatedAt, finite(p.createdAt)),
  };
}

// New chapter sessions coexist with the former skill-loop sessions, including
// their exact saved questions. Switching lesson UI must not overwrite a draft.
export function learningSessionKey(session) {
  if(session.reviewVisit)return `review:${session.id}`;
  return session.entryId + '|' + (session.journey ? 'journey:' : '') + (session.mode || 'lesson');
}

function normalizeEvent(raw, epochId) {
  indexStats.normalizedEvents++;
  if (!raw || typeof raw !== 'object' || !text(raw.id) || BAD_KEYS.has(raw.id) || !text(raw.objectiveId) || BAD_KEYS.has(raw.objectiveId) || BAD_KEYS.has(raw.sessionId)) return null;
  if (raw.epochId !== epochId) return null;
  const outcome = (raw.policy === 'grammar-v2' ? ['correct', 'incorrect', 'skipped', 'revealed', 'ungraded'] : ['correct', 'incorrect', 'skipped', 'revealed']).includes(raw.outcome) ? raw.outcome : raw.ok === true ? 'correct' : 'incorrect';
  const components = [];
  for (const c of Array.isArray(raw.components) ? raw.components : []) {
    if (!c || !text(c.skill) || BAD_KEYS.has(c.skill) || typeof c.ok !== 'boolean') continue;
    components.push({ skill: c.skill, ok: c.ok, ...(text(c.errorTag) ? { errorTag: c.errorTag } : {}) });
  }
  return {
    id: raw.id, epochId, deviceId: text(raw.deviceId), sequence: Math.max(0, Math.floor(finite(raw.sequence))),
    sessionId: text(raw.sessionId), index: Math.max(0, Math.floor(finite(raw.index))), at: finite(raw.at),
    objectiveId: raw.objectiveId, entryId: text(raw.entryId), kind: raw.kind === 'verb' ? 'verb' : 'word',
    ...(raw.reviewPolicy==='unified-review-v1'?{reviewPolicy:'unified-review-v1'}:{}),
    ...(raw.caseCoveragePolicy==='verb-case-coverage-v1'?{caseCoveragePolicy:'verb-case-coverage-v1'}:{}),
    ...(raw.canonicalObjectiveId?{canonicalObjectiveId:canonicalObjectiveId(raw.objectiveId),objectiveMappingVersion:OBJECTIVE_MAPPING_VERSION}:{}),
    skill: text(raw.skill, 'recall'), tense: text(raw.tense) || null,
    person: typeof raw.person === 'number' && Number.isInteger(raw.person) ? raw.person : text(raw.person) || null,
    // the lesson boards and the short word screens are recognition by nature; a workshop drill may type the word (still guided, never independent)
    mode: raw.mode === 'production' && (!SUPPORTED_WORD_POLICIES.has(raw.wordPolicy) || raw.wordPolicy === 'word-lab-drill-v1') ? 'production' : 'recognition',
    variantId: text(raw.variantId), contextId: text(raw.contextId),
    ok: outcome === 'correct' && raw.ok === true, outcome,
    assistance: strings(raw.assistance).filter(x => x !== 'none'), firstAttempt: raw.firstAttempt === true,
    errorTags: strings(raw.errorTags), components,
    ...(savedSubmission(raw.submission)?{submission:savedSubmission(raw.submission)}:{}),
    xp: Math.max(0, Math.min(3, finite(raw.xp))),
    ...(raw.kind === 'grammar' && raw.policy === 'grammar-v1' ? {
      kind:'grammar', policy:'grammar-v1', contentVersion:Math.max(1,Math.floor(finite(raw.contentVersion,1))),
      grammarPhase:['guided','independent','repair'].includes(raw.grammarPhase)?raw.grammarPhase:'guided',
    } : {}),
    ...(raw.kind === 'grammar' && raw.policy === 'grammar-v2' ? {
      kind:'grammar', policy:'grammar-v2', contentVersion:Math.max(2,Math.floor(finite(raw.contentVersion,2))),
      grammarPhase:['guided','independent','repair','portfolio'].includes(raw.grammarPhase)?raw.grammarPhase:'guided',
      facet:text(raw.facet), requiredFacets:strings(raw.requiredFacets),
      minIndependent:Math.max(2,Math.min(20,Math.floor(finite(raw.minIndependent,2)))),
      requiresProduction:raw.requiresProduction===true,
      modality:['language','reading','listening'].includes(raw.modality)?raw.modality:'language',
      exposureGroup:text(raw.exposureGroup), responseMode:text(raw.responseMode),
      ...(raw.skill==='course-completion'&&outcome==='ungraded'?{completedTargets:strings(raw.completedTargets),lessonFinished:true}:{}),
      ...(outcome==='ungraded'?{xp:0,ok:false}:{}),
    } : {}),
    ...(raw.policy === 'journey-v1' ? {
      policy: 'journey-v1', targetId: text(raw.targetId, raw.objectiveId),
      chapterId: text(raw.chapterId), contentVersion: Math.max(1, Math.floor(finite(raw.contentVersion, 1))),
      role: text(raw.role) || null,
      ...(raw.contextPolicy==='distinct-scene'||/::v2-/.test(text(raw.targetId,raw.objectiveId))?{contextPolicy:'distinct-scene'}:{}),
      activityKind: raw.wordPolicy==='word-short-v1' ? raw.activityKind==='repair'?'repair':'guided' : ['word-lesson-match-v1','word-lab-drill-v1'].includes(raw.wordPolicy) ? 'guided' : ['guided', 'independent', 'repair'].includes(raw.activityKind) ? raw.activityKind : 'guided',
      ...(Number.isInteger(raw.availableVariants) && raw.availableVariants >= 0 ? { availableVariants: raw.availableVariants } : {}),
      ...(raw.wordPolicy === 'word-short-v1' ? { wordPolicy: 'word-short-v1', wordSlotId: text(raw.wordSlotId) } : {}),
      // A course lesson's vocabulary board is supported recognition of a dictionary word.
      ...(raw.wordPolicy === 'word-lesson-match-v1' ? { wordPolicy: 'word-lesson-match-v1', wordSlotId: text(raw.wordSlotId), courseLessonId: text(raw.courseLessonId) } : raw.wordPolicy === 'word-lab-drill-v1' ? { wordPolicy: 'word-lab-drill-v1', labLessonId: text(raw.labLessonId) } : {}),
    } : {}),
  };
}

export function createLearning(now = Date.now()) {
  const learning={
    version: LEARNING_VERSION, createdAt: finite(now),
    // A common initial epoch lets independently migrated devices merge their work.
    epoch: { id: 'initial', at: 0 }, events: {}, completions: {},
    preferences: { stage: 'present', expansions: [], updatedAt: 0, coreOrderVersion: 2 },
    session: null, sessions: {},
  };
  canonicalEvents.add(learning.events);return learning;
}

export const completionKey = (entryId, caseId = 'word') => `${encodeURIComponent(entryId)}|${caseId}`;
function normalizeCompletions(raw) {
  const records = {};
  for (const value of Object.values(raw || {})) {
    if (!value || !text(value.entryId) || !text(value.caseId) || !text(value.id) || typeof value.checked !== 'boolean'
      || BAD_KEYS.has(value.entryId) || BAD_KEYS.has(value.caseId)) continue;
    const record = { entryId:value.entryId, caseId:value.caseId, id:value.id, checked:value.checked,
      at:Math.max(0,finite(value.at)), source:value.source === 'legacy' ? 'legacy' : 'manual',...(value.flowVersion===2||text(value.id).startsWith('verb-flow-v2:')?{flowVersion:2}:{}) };
    const key = completionKey(record.entryId,record.caseId);
    records[key] = newest(records[key],record,'at');
  }
  return records;
}
// Explicit completion is enrollment, never answer evidence or independent mastery.
// False records are tombstones: deleting a checkbox must survive an offline merge.
export function completionRecord(domain, entryId, caseId = 'word') {
  if (unsupported(domain)) return null;
  const own=domain?.completions?.[completionKey(entryId,caseId)], all=domain?.completions?.[completionKey(entryId,'*')];
  if(own?.source==='manual' && all?.source==='legacy')return own;
  return newest(own,all,'at') || null;
}
export function setCompletionRecord(domain, record, now = Date.now()) {
  if (unsupported(domain)) throw new Error('Update Parola before changing this learning data.');
  const learning = normalizeLearning(domain,now);
  learning.completions = normalizeCompletions({ ...learning.completions, [completionKey(record.entryId,record.caseId)]:record });
  return learning;
}

export function normalizeLearning(raw, now = Date.now()) {
  const fresh = createLearning(now);
  const p = plain(raw);
  if (!p || Array.isArray(p)) return fresh;
  // A newer client owns this schema. Preserve its plain payload without applying
  // v1 event/session reductions that would silently discard unfamiliar fields.
  if (unsupported(p)) return p;
  const epoch = p.epoch && text(p.epoch.id) ? { id: p.epoch.id, at: finite(p.epoch.at) } : fresh.epoch;
  const events = {};
  for (const candidate of Object.values(p.events || {})) {
    const event = normalizeEvent(candidate, epoch.id);
    if (!event) continue;
    if (!events[event.id] || stable(event) > stable(events[event.id])) events[event.id] = event;
  }
  const preferences = {
    ...(p.preferences && !Array.isArray(p.preferences) ? p.preferences : {}),
    stage: text(p.preferences?.stage, 'present'),
    expansions: strings(p.preferences?.expansions).sort(), updatedAt: finite(p.preferences?.updatedAt),
    legacyTenses: unique([...strings(p.preferences?.legacyTenses), ...(finite(p.version) < 2 && ['future', 'background'].includes(p.preferences?.stage) ? ['imperfetto'] : []),
      ...(finite(p.preferences?.coreOrderVersion) < 2 && p.preferences?.stage === 'background' ? ['futuro'] : [])]).sort(),
    coreOrderVersion: 2,
  };
  const sessions = {};
  for (const candidate of Object.values(p.sessions || {})) {
    const session = normalizeSession(candidate);
    if (session) {
      const key = learningSessionKey(session);
      sessions[key] = newest(sessions[key], session, 'updatedAt');
    }
  }
  const session = normalizeSession(p.session);
  if (session) {
    const key = learningSessionKey(session);
    sessions[key] = newest(sessions[key], session, 'updatedAt');
  }
  const learning={
    ...p, version: Math.max(LEARNING_VERSION, Math.floor(finite(p.version, LEARNING_VERSION))),
    createdAt: finite(p.createdAt, fresh.createdAt), epoch, events, completions:normalizeCompletions(p.completions), preferences, session, sessions,
  };
  canonicalEvents.add(events);return learning;
}

function newest(a, b, clockKey) {
  if (!a) return b;
  if (!b) return a;
  const order = cmp(finite(a[clockKey]), finite(b[clockKey])) || cmp(stable(a), stable(b));
  return order > 0 ? a : b;
}

export function mergeLearning(a, b, now = Date.now()) {
  const left = normalizeLearning(a, now), right = normalizeLearning(b, now);
  if (unsupported(left) || unsupported(right)) throw new Error('This learning data uses a newer version of Parola. Update the app before merging it.');
  const epochOrder = cmp(left.epoch.at, right.epoch.at) || cmp(left.epoch.id, right.epoch.id);
  // Reset is an epoch boundary: an old backup or offline writer cannot resurrect
  // either old attempts or an old unfinished session.
  if (epochOrder) return normalizeLearning(epochOrder > 0 ? left : right, now);
  const events = { ...left.events };
  for (const [id, event] of Object.entries(right.events)) {
    if (!events[id] || stable(event) > stable(events[id])) events[id] = event;
  }
  const sessions = { ...left.sessions };
  for (const [key, session] of Object.entries(right.sessions)) sessions[key] = newest(sessions[key], session, 'updatedAt');
  const completions = { ...left.completions };
  for (const [key, record] of Object.entries(right.completions)) completions[key] = newest(completions[key],record,'at');
  return normalizeLearning({
    ...newest(left, right, 'createdAt'),
    version: Math.max(left.version, right.version), createdAt: Math.min(left.createdAt, right.createdAt),
    epoch: left.epoch, events, completions,
    preferences: newest(left.preferences, right.preferences, 'updatedAt'),
    session: newest(left.session, right.session, 'updatedAt'), sessions,
  }, now);
}

export function resetLearning(old, now = Date.now(), resetId) {
  const previous = normalizeLearning(old, now);
  if (unsupported(previous)) throw new Error('This learning data uses a newer version of Parola. Update the app before resetting it.');
  const at = Math.max(finite(now), previous.epoch.at + 1);
  return {
    ...createLearning(now),
    epoch: { id: text(resetId) || `reset:${at}`, at },
    preferences: { ...previous.preferences, expansions: [...previous.preferences.expansions] },
  };
}

export function recordAttempt(domain, event) {
  if (unsupported(domain)) return { learning:domain, added: false, skill: skillState(domain, text(event?.objectiveId), finite(event?.at)) };
  const previous=evidenceFor(domain,finite(event?.at)),learning={...previous.learning};
  const normalized = normalizeEvent(canonicalizeAttempt(event), learning.epoch.id);
  if (!normalized || learning.events[normalized.id]) {
    return { learning, added: false, skill: skillState(learning, text(event?.objectiveId), finite(event?.at)) };
  }
  learning.events = { ...learning.events, [normalized.id]: normalized };
  canonicalEvents.add(learning.events);
  // Checkpoints describe an exact event set. New evidence invalidates that
  // snapshot without deleting any historical event or manual completion fence.
  delete learning.checkpoint;
  appendEvidence(previous,learning,normalized);
  return { learning, added: true, skill: skillState(learning, normalized.objectiveId, normalized.at) };
}

function compareEvents(a, b) {
  return cmp(a.at, b.at) || cmp(a.deviceId, b.deviceId) || cmp(a.sequence, b.sequence) || cmp(a.id, b.id);
}
function orderedEvents(domain) { return Object.values(domain.events).sort(compareEvents); }
const independent = (e) => e.mode === 'production' && e.firstAttempt && e.assistance.length === 0 && (e.policy !== 'journey-v1' || e.activityKind === 'independent') && (e.outcome === 'correct' || e.outcome === 'incorrect');
const variantKey = (e) => e.contextPolicy==='distinct-scene' ? [e.contextId || 'unvaried',e.person ?? ''].join('|') : [e.variantId || 'unvaried', e.contextId || '', e.person ?? ''].join('|');

function tracker(skill) {
  return { skill, seen: 0, correct: 0, independentCorrect: 0, unresolved: false, errorTag: null, lastFailureAt: 0, confirmationVariants: [], confirmations: 0 };
}
function fail(t, tag, at, mode = 'production') {
  t.unresolved = true; t.errorTag = tag || t.skill; t.lastFailureAt = at;
  t.evidenceMode = mode;
  t.confirmationVariants = []; t.confirmations = 0;
}
function confirm(t, event, eligible) {
  t.correct++;
  if (!eligible) return;
  t.independentCorrect++;
  if (t.unresolved) {
    t.confirmationVariants = unique([...t.confirmationVariants, variantKey(event)]);
    t.confirmations = t.confirmationVariants.length;
    if (t.confirmations >= 2) t.unresolved = false;
  }
}

function analyze(domain, objectiveId, now, all, positions, events, chronology = new Map()) {
  const last = events[events.length - 1];
  if (last?.kind === 'grammar') return applyReviewSchedule(events,last.policy === 'grammar-v2' ? courseSkill(events,now) : grammarSkill(events,now),now);
  const scheduleEvents=events;
  const journey = last?.policy === 'journey-v1';
  // A new content policy never upgrades legacy evidence, even if an imported
  // custom target accidentally reuses an older objective identifier.
  if (journey) events = events.filter(e => e.policy === 'journey-v1' && e.contentVersion === last.contentVersion);
  const required = journey ? 2 : 4;
  const result = {
    objectiveId, entryId: last?.entryId || null, kind: last?.kind || null, skill: last?.skill || null, tense: last?.tense || null,
    attempts: 0, recognitionCorrect: 0, recognitionReady:false, recognitionRemembered:false, productionAttempts: 0, productionQuestions: 0, independentCorrect: 0, requiredCorrect: required,
    variantCount: 0, independentPersons: [], spacedSuccess: false,
    ready: false, remembered: false, status: 'new', readyAt: null, rememberedAt: null, readyPeriods: [],
    unresolvedErrors: [], components: {}, personEvidence: {}, sessionEvidence: {},
    srs: { s: 0, ef: 2.5, iv: 0, due: 0, reps: 0, lapses: 0 }, due: 0, isDue: false,
    firstAt: events[0]?.at ?? null, lastAt: last?.at ?? null, firstCorrectAt: null, firstCorrectPosition: null,
    ...(journey ? { policy: 'journey-v1', role: last.role, chapterId: last.chapterId, contentVersion: last.contentVersion } : {}),
  };
  if (!events.length) return result;
  const main = tracker(last.skill || 'practice');
  const variations = new Set(), persons = new Set(), previousVariants = new Map();
  const previousProduction = new Map(), advanced = new Set(), failed = new Set();
  const checks = [], delayed = [], recognitionChecks=[];
  let previousRecognition=null;
  // A verb chapter already has separately taught forms and contextual checks.
  // One intervening activity is enough to space its two unaided recalls;
  // adjacent answers, copied forms, and duplicate scenes remain ineligible.
  const evidenceGap = journey && last.kind === 'verb' ? 2 : 3;
  let readySession = null, previousIndependent = null;

  for (const e of events) {
    if (e.outcome === 'skipped') continue; // a choice to skip is not a memory lapse
    result.attempts++; main.seen++;
    if (e.ok && e.outcome === 'correct' && result.firstCorrectAt === null) { result.firstCorrectAt = e.at; result.firstCorrectPosition = chronology.get(e.id) ?? 0; }
    if (e.mode === 'production') result.productionQuestions++;
    const key = variantKey(e);
    const pos = positions.get(e.id);
    const previous = previousVariants.get(key);
    const repeatIsSpaced = !previous || (previous.sessionId === e.sessionId
      ? pos - positions.get(previous.id) >= evidenceGap
      : e.at - previous.at >= REPEAT_DELAY);
    const qualifying = independent(e);
    const priorProduction = previousProduction.get(e.sessionId);
    const spaced = (!!priorProduction && pos - positions.get(priorProduction.id) >= evidenceGap)
      || (journey && previousIndependent && previousIndependent.sessionId !== e.sessionId && e.at - previousIndependent.at >= REPEAT_DELAY);
    const eligible = qualifying && e.ok && repeatIsSpaced && (!journey || !previousIndependent || spaced);
    const recognitionIndependent=e.mode==='recognition' && e.firstAttempt && !e.assistance.length && e.outcome==='correct';
    const recognitionSeparated=!previousRecognition || (previousRecognition.sessionId===e.sessionId
      ? pos-positions.get(previousRecognition.id)>=evidenceGap : e.at-previousRecognition.at>=REPEAT_DELAY);
    const recognitionEligible=recognitionIndependent && recognitionSeparated && repeatIsSpaced;
    if(recognitionIndependent){if(recognitionEligible)recognitionChecks.push(e);previousRecognition=e;}
    if (qualifying) { checks.push(e.ok); result.productionAttempts++; previousProduction.set(e.sessionId, e); previousIndependent = e; }
    // A correction/reveal cannot immediately become a fresh first-attempt win.
    // Ordinary recognition questions are spacers, not production successes.
    if (e.mode === 'production' || e.outcome === 'revealed' || e.assistance.length) previousVariants.set(key, e);
    if (e.mode === 'recognition' && e.ok) result.recognitionCorrect++;
    // Successful support is a teaching activity in a chapter, not a new failure.
    // It contributes no independent credit and cannot erase previous retrieval.
    const needsRepair = !e.ok || e.outcome === 'revealed' || (!journey && (e.assistance.length > 0 || !e.firstAttempt));
    if (needsRepair) fail(main, e.errorTags[0] || (e.outcome === 'revealed' ? 'revealed' : e.assistance.length ? 'assisted' : 'needs-practice'), e.at,e.mode);
    else if (e.ok) confirm(main, e, eligible || recognitionEligible && main.evidenceMode==='recognition');
    for (const c of e.components) {
      const t = result.components[c.skill] ||= tracker(c.skill);
      t.seen++;
      if (!c.ok) fail(t, c.errorTag || c.skill, e.at,e.mode);
      else confirm(t, e, qualifying && repeatIsSpaced && (!journey || eligible) || recognitionEligible && t.evidenceMode==='recognition');
      // Only an explicit person diagnosis justifies person-specific remediation.
      // A wrong participle/auxiliary family must not invent a person error.
      if (c.skill === 'person' && e.person !== null && !BAD_KEYS.has(String(e.person))) {
        const p = result.personEvidence[String(e.person)] ||= { ...tracker('person'), person: e.person };
        p.seen++;
        if (!c.ok) fail(p, c.errorTag || 'person', e.at,e.mode);
        else confirm(p, e, qualifying && repeatIsSpaced && (!journey || eligible) || recognitionEligible && p.evidenceMode==='recognition');
      }
    }
    if (eligible) {
      result.independentCorrect++; variations.add(key);
      if (e.person !== null) persons.add(e.person);
      if (spaced) result.spacedSuccess = true;
    }
    const session = result.sessionEvidence[e.sessionId] ||= { independentCorrect: 0, independentPersons: [], variants: [], correctAfterError: 0, lastAt: e.at };
    session.lastAt = e.at;
    if (needsRepair) session.correctAfterError = 0;
    if (eligible) {
      session.independentCorrect++; session.variants = unique([...session.variants, key]); session.correctAfterError++;
      if (e.person !== null) session.independentPersons = unique([...session.independentPersons, e.person]);
    }

    // Failure can always shorten a schedule. Successful massed practice cannot
    // advance it repeatedly, including when a learner closes/reopens the screen.
    if (!e.ok || e.outcome === 'revealed') {
      if (!failed.has(e.sessionId)) { result.srs = schedule(result.srs, 1, e.at); failed.add(e.sessionId); }
      else result.srs.due = Math.min(result.srs.due || Infinity, e.at + SHORT_REVIEW);
    } else if (needsRepair) {
      result.srs.due = Math.min(result.srs.due || Infinity, e.at + SHORT_REVIEW);
    } else if ((eligible || recognitionEligible || SUPPORTED_WORD_POLICIES.has(e.wordPolicy)) && !advanced.has(e.sessionId) && !failed.has(e.sessionId)
      && (!result.srs.due || e.at >= result.srs.due || (!result.srs.reps && !result.srs.lapses))) {
      result.srs = schedule(result.srs, eligible || recognitionEligible ? 4 : 3, e.at); advanced.add(e.sessionId);
    } else if (!result.srs.due) result.srs.due = e.at + SHORT_REVIEW;

    const unresolved = main.unresolved || Object.values(result.components).some(t => t.unresolved) || Object.values(result.personEvidence).some(t => t.unresolved);
    const recentRequired = journey ? 2 : 3;
    const ready = result.independentCorrect >= required && variations.size >= 2 && checks.length >= recentRequired && checks.slice(-recentRequired).every(Boolean) && result.spacedSuccess && !unresolved;
    // Completion milestones use intersecting readiness intervals. A later lapse
    // can reopen practice without rewriting an honestly completed chapter.
    if (ready && !result.ready) result.readyPeriods.push({ start: chronology.get(e.id) ?? 0, end: null, at: e.at });
    if (!ready && result.ready) result.readyPeriods[result.readyPeriods.length - 1].end = chronology.get(e.id) ?? 0;
    if (!ready) {
      result.readyAt = null; readySession = null; delayed.length = 0; result.rememberedAt = null;
    } else if (result.readyAt === null) {
      result.readyAt = e.at; readySession = e.sessionId;
    } else if (eligible && e.sessionId !== readySession && e.at >= result.readyAt + DAY) {
      delayed.push(e);
      if (delayed.length >= 2 && new Set(delayed.map(variantKey)).size >= 2 && result.rememberedAt === null) result.rememberedAt = e.at;
    }
    result.ready = ready;
  }
  result.variantCount = variations.size;
  result.independentPersons = [...persons].sort((a, b) => cmp(String(a), String(b)));
  result.unresolvedErrors = [...Object.values(result.personEvidence), ...Object.values(result.components), main].filter(t => t.unresolved).map(t => ({ skill: t.skill, tag: t.errorTag, at: t.lastFailureAt, evidenceMode:t.evidenceMode || 'production',confirmations: t.confirmations, ...(t.person !== undefined ? { person: t.person } : {}) }));
  result.remembered = result.ready && result.rememberedAt !== null;
  result.recognitionReady=recognitionChecks.length>=2;
  result.recognitionRemembered=result.recognitionReady && recognitionChecks.some((e,i)=>i>0&&e.sessionId!==recognitionChecks[0].sessionId&&e.at-recognitionChecks[0].at>=DAY);
  result.status = result.remembered ? 'remembered' : result.ready ? 'ready' : result.attempts ? 'practicing' : 'new';
  result.due = result.srs.due; result.isDue = !!result.due && result.due <= now;
  return applyReviewSchedule(scheduleEvents,result,now);
}

// A bounded review uses its declared evidence mode. It can repair/space that
// schedule without making recognition a written-production milestone. Replaying
// equivalent aliases advances one schedule once per session; raw IDs stay saved.
function applyReviewSchedule(events,state,now) {
  if(state.kind==='grammar') {
    const last=events.at(-1);
    events=events.filter(e=>e.policy===last?.policy && e.contentVersion===last?.contentVersion);
  }
  if(!events.some(e=>e.reviewPolicy==='unified-review-v1')&&new Set(events.map(e=>e.objectiveId)).size<2)return state;
  const grammarQualified=state.kind==='grammar'?new Set([
    ...(state.responseEvidence?.recognition.qualifiedEventIds || []),
    ...(state.responseEvidence?.written.qualifiedEventIds || [])]):null;
  const lanes={recognition:{s:0,ef:2.5,iv:0,due:0,reps:0,lapses:0},production:{s:0,ef:2.5,iv:0,due:0,reps:0,lapses:0}};
  const failed=new Set(),advanced=new Set(),recognitionVariants=new Map();
  let recognizedAt=null,recognizedSession=null,recognitionSuccesses=0,previousRecognition=null,recognitionDelayed=false;
  for(const e of events){
    if(['skipped','ungraded'].includes(e.outcome))continue;
    const mode=e.mode==='production'?'production':'recognition',sessionKey=mode+'|'+e.sessionId;
    let srs=lanes[mode];
    if(!e.ok||e.outcome==='revealed'){
      if(!failed.has(sessionKey)){lanes[mode]=schedule(srs,1,e.at);failed.add(sessionKey);}
      continue;
    }
    let assessed=e.firstAttempt&&!e.assistance.length && (mode==='recognition'||independent(e))
      && (!grammarQualified || e.grammarPhase==='independent' && grammarQualified.has(e.id));
    if(mode==='recognition' && !grammarQualified) {
      const previous=recognitionVariants.get(variantKey(e));
      const separated=!previousRecognition||(previousRecognition.sessionId===e.sessionId?e.index-previousRecognition.index>=2:e.at-previousRecognition.at>=REPEAT_DELAY);
      const fresh=!previous||(previous.sessionId===e.sessionId?e.index-previous.index>=3:e.at-previous.at>=REPEAT_DELAY);
      assessed=assessed&&separated&&fresh;
      recognitionVariants.set(variantKey(e),e);
    }
    if(!assessed){if(!srs.due)srs.due=e.at+SHORT_REVIEW;continue;}
    if(mode==='recognition'){
      recognitionSuccesses++;recognizedAt ??= e.at;recognizedSession ??= e.sessionId;previousRecognition=e;
      if(e.sessionId!==recognizedSession&&e.at-recognizedAt>=DAY)recognitionDelayed=true;
    }
    if(!advanced.has(sessionKey)&&!failed.has(sessionKey)&&(!srs.due||e.at>=srs.due)){
      lanes[mode]=schedule(srs,4,e.at);advanced.add(sessionKey);
    }
  }
  const scheduled=Object.entries(lanes).filter(([,s])=>s.due).sort((a,b)=>a[1].due-b[1].due||a[0].localeCompare(b[0]));
  state.recognitionSrs=lanes.recognition;state.productionSrs=lanes.production;
  state.schedulingMode=scheduled[0]?.[0] || null;state.srs=scheduled[0]?.[1] || state.srs;
  state.due=state.srs.due;state.isDue=!!state.due&&state.due<=now;
  if(state.kind!=='grammar') {
    state.recognitionReady=state.recognitionReady||recognitionSuccesses>=2;
    state.recognitionRemembered=state.recognitionRemembered||recognitionSuccesses>=2&&recognitionDelayed;
  }
  return state;
}

const evidenceCache = new WeakMap();
const fingerprint=value=>{let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
function eventDigest(events) {
  let sum=0,xor=0,count=0;
  for(const event of Object.values(events)){const hash=fingerprint(JSON.stringify(event));sum=(sum+hash)>>>0;xor^=hash;count++;}
  return `${count}:${sum}:${xor>>>0}`;
}
function checkpointFor(learning) {
  const c=learning.checkpoint;
  if(!c||c.version!==1||c.learningVersion!==LEARNING_VERSION||c.policyVersion!==CHECKPOINT_POLICY||c.epochId!==learning.epoch.id||c.epochAt!==learning.epoch.at
    ||!Array.isArray(c.orderedIds)||!c.summaries||c.eventDigest!==eventDigest(learning.events)||c.completionDigest!==fingerprint(stable(learning.completions))||c.summaryDigest!==fingerprint(stable(c.summaries)))return null;
  if(c.orderedIds.length!==Object.keys(learning.events).length||new Set(c.orderedIds).size!==c.orderedIds.length||c.orderedIds.some(id=>!Object.hasOwn(learning.events,id)))return null;
  if(c.orderedIds.some((id,index)=>index>0&&compareEvents(learning.events[c.orderedIds[index-1]],learning.events[id])>0))return null;
  return c;
}
function appendEvidence(previous,learning,event) {
  const session=previous.bySession.get(event.sessionId) || [];
  const monotonic=(!previous.events.length||compareEvents(previous.events.at(-1),event)<=0)
    && (!session.length||cmp(session.at(-1).index,event.index)<0||session.at(-1).index===event.index&&compareEvents(session.at(-1),event)<=0);
  if(!monotonic)return; // Imported/backdated evidence rebuilds in deterministic order.
  const bySession=new Map(previous.bySession),byObjective=new Map(previous.byObjective),summaries=new Map(previous.summaries);
  bySession.set(event.sessionId,[...session,event]);
  const objectiveId=canonicalObjectiveId(event.objectiveId);
  byObjective.set(objectiveId,[...(byObjective.get(objectiveId) || []),event]);
  summaries.delete(objectiveId);
  // Forks can append the same ID at different coordinates. Keep each domain's
  // indexes isolated, including summaries that have not been requested yet.
  const positions=new Map(previous.positions),chronology=new Map(previous.chronology);
  positions.set(event.id,session.length);chronology.set(event.id,previous.events.length);
  const context={...previous,learning,events:[...previous.events,event],positions,chronology,bySession,byObjective,summaries,
    eventsRef:learning.events,epochId:learning.epoch.id,epochAt:learning.epoch.at};
  evidenceCache.set(learning,context);indexStats.appends++;
}
function evidenceFor(domain, now) {
  const cacheable = domain && typeof domain === 'object';
  const cached = cacheable && evidenceCache.get(domain);
  if (cached && cached.mappingRevision===objectiveRegistryRevision() && cached.eventsRef === domain.events && cached.epochId === domain.epoch?.id && cached.epochAt === domain.epoch?.at) return cached;
  const learning=domain?.version===LEARNING_VERSION&&canonicalEvents.has(domain.events)?domain:normalizeLearning(domain,now);
  const checkpoint=checkpointFor(learning);
  const events=checkpoint?checkpoint.orderedIds.map(id=>learning.events[id]):orderedEvents(learning);
  indexStats.builds++;if(checkpoint)indexStats.checkpointHits++;
  const positions = new Map(), bySession = new Map(), byObjective = new Map(), chronology = new Map(events.map((e, i) => [e.id, i]));
  for (const e of events) {
    if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, []);
    const objectiveId=canonicalObjectiveId(e.objectiveId);
    if (!byObjective.has(objectiveId)) byObjective.set(objectiveId, []);
    bySession.get(e.sessionId).push(e); byObjective.get(objectiveId).push(e);
  }
  for (const group of bySession.values()) {
    group.sort((a, b) => cmp(a.index, b.index) || compareEvents(a, b));
    group.forEach((e, i) => positions.set(e.id, i));
  }
  const summaries=checkpoint&&checkpoint.mappingSignature===objectiveMappingSignature()?new Map(Object.entries(checkpoint.summaries)):new Map();
  const context = { learning, events, positions, chronology, byObjective,bySession, summaries, mappingRevision:objectiveRegistryRevision(),eventsRef: domain?.events, epochId: domain?.epoch?.id, epochAt: domain?.epoch?.at };
  if (cacheable) evidenceCache.set(domain, context);
  return context;
}
function summaryFrom(context, id, now) {
  const requested=id;id=canonicalObjectiveId(id);
  if (!context.summaries.has(id)) {const events=context.byObjective.get(id) || [];indexStats.replayedEvents+=events.length;context.summaries.set(id, analyze(context.learning, id, 0, context.events, context.positions,events, context.chronology));}
  // Callers can decorate their returned summary without corrupting the cache.
  const summary = plain(context.summaries.get(id));
  summary.objectiveId=requested;summary.canonicalObjectiveId=id;
  summary.isDue = !!summary.due && summary.due <= now;
  return summary;
}

export function skillState(domain, objectiveId, now = Date.now()) {
  if (unsupported(domain)) return { ...analyze(null, objectiveId, now, [], new Map(), []), status: 'unknown', unsupported: true };
  return summaryFrom(evidenceFor(domain, now), objectiveId, now);
}

export function allSkills(domain, now = Date.now()) {
  if (unsupported(domain)) return [];
  const context = evidenceFor(domain, now);
  return [...context.byObjective.keys()].sort().map(id => summaryFrom(context, id, now));
}

// A lossless replay checkpoint, deliberately retaining the entire v5 event log.
// Older clients can ignore it safely. No storage reduction or destructive log
// compaction is claimed until replica/backup acknowledgement is implemented.
export function checkpointLearning(domain,now=Date.now()) {
  const learning=normalizeLearning(domain,now);
  if(unsupported(learning))throw new Error('Update Parola before checkpointing this learning data.');
  delete learning.checkpoint;
  const context=evidenceFor(learning,now),summaries=Object.fromEntries(allSkills(learning,0).map(s=>[s.objectiveId,s]));
  learning.checkpoint={version:1,learningVersion:LEARNING_VERSION,policyVersion:CHECKPOINT_POLICY,mappingVersion:OBJECTIVE_MAPPING_VERSION,mappingSignature:objectiveMappingSignature(),epochId:learning.epoch.id,epochAt:learning.epoch.at,
    eventDigest:eventDigest(learning.events),completionDigest:fingerprint(stable(learning.completions)),orderedIds:context.events.map(e=>e.id),summaries,summaryDigest:fingerprint(stable(summaries))};
  return learning;
}
export const learningIndexStats=()=>({...indexStats});

export function createSession({ id, entryId, objectiveIds, now = Date.now(), mode = 'lesson' }) {
  const ids = strings(objectiveIds);
  return normalizeSession({
    id, entryId, objectiveIds: ids, activeObjectiveId: ids[0] || null, mode,
    deferred: {}, answeredEventIds: [], completedObjectiveIds: [], reviewedObjectiveIds: [],
    index: 0, createdAt: finite(now), updatedAt: finite(now),
  });
}

function reviewed(state, sessionId) {
  const evidence = state.sessionEvidence[sessionId];
  return state.ready && !!evidence && evidence.independentCorrect >= 2 && evidence.variants.length >= 2 && evidence.correctAfterError >= 2;
}

export function selectNext(domain, rawSession, objectives, { now = Date.now() } = {}) {
  const learning=domain?.version===LEARNING_VERSION&&canonicalEvents.has(domain.events)?domain:normalizeLearning(domain,now),session = normalizeSession(rawSession);
  if (unsupported(learning)) return { done: false, blocked: true, objective: null, reason: 'unsupported-version' };
  if (!session) return { done: false, blocked: true, objective: null, reason: 'invalid-session' };
  const descriptors = new Map((Array.isArray(objectives) ? objectives : []).filter(o => o && text(o.id)).map(o => [o.id, o]));
  const states = new Map();
  const stateFor = (id) => { if (!states.has(id)) states.set(id, skillState(learning, id, now)); return states.get(id); };
  const complete = (id) => {
    const state = stateFor(id);
    if (session.mode !== 'review' && session.mode !== 'checkpoint') return state.ready;
    if (!reviewed(state, session.id)) return false;
    const required = session.mode === 'checkpoint' ? descriptors.get(id)?.personsRequired || [] : [];
    const covered = state.sessionEvidence[session.id]?.independentPersons || [];
    return required.every(person => covered.some(p => String(p) === String(person)));
  };
  const pending = session.objectiveIds.filter(id => !Object.hasOwn(session.deferred, id) && !complete(id));
  if (!pending.length) return { done: true, reason: session.objectiveIds.some(id => Object.hasOwn(session.deferred, id)) ? 'finished-with-deferred' : 'ready' };
  const activeId = pending.includes(session.activeObjectiveId) ? session.activeObjectiveId : pending[0];
  const active = descriptors.get(activeId);
  if (!active) return { done: false, blocked: true, objective: null, objectiveId: activeId, reason: 'content-unavailable' };
  const activeState = stateFor(activeId);
  const history = evidenceFor(learning,now).bySession.get(session.id) || [];
  let lastProductionIndex = -1;
  history.forEach((e, i) => { if (e.objectiveId === activeId && e.mode === 'production') lastProductionIndex = i; });
  const intervening = lastProductionIndex < 0 ? Infinity : history.length - lastProductionIndex - 1;
  const needsSpacer = intervening < 2;
  let chosen = active, spacer = false;
  if (needsSpacer) {
    // Prefer familiar material. A provided supplemental objective can supply a
    // small recognition scaffold at cold start; it never becomes the main goal.
    // The caller supplies an already curriculum/scope-filtered descriptor pool.
    const alternatives = [...descriptors.values()].filter(o => o.id !== activeId && !Object.hasOwn(session.deferred, o.id));
    // A different entry's recall task avoids showing the very answer we need to
    // check independently (especially a word with only one spelling). Prefer two
    // different supplied spacers over exposing that answer again on a fan card.
    const differentEntry = alternatives.filter(o => o.entryId !== active.entryId);
    let candidates = differentEntry.length ? differentEntry : alternatives;
    const lastEntry = history.at(-1)?.entryId;
    const varied = candidates.filter(o => o.entryId !== lastEntry);
    if (varied.length) candidates = varied;
    const familiar = candidates.filter(o => stateFor(o.id).attempts > 0);
    const lastPosition = (id) => history.reduce((at, e, i) => e.objectiveId === id ? i : at, -1);
    familiar.sort((a, b) => cmp(lastPosition(a.id), lastPosition(b.id)) || cmp(stateFor(a.id).due || Infinity, stateFor(b.id).due || Infinity) || cmp(a.id, b.id));
    if (!familiar.length) candidates.sort((a, b) => cmp(lastPosition(a.id), lastPosition(b.id)) || cmp(a.id, b.id));
    chosen = familiar[0] || candidates[0] || active; spacer = true;
  }
  const state = stateFor(chosen.id);
  // A whole-form failure accompanies a diagnosed component failure. Select the
  // actionable diagnosis before the generic parent blocker so the question
  // builder can actually isolate that part. Exact-person repair stays first.
  const genericErrors = new Set(['conjugation', 'context', 'needs-practice', 'assisted', 'revealed', 'uncertain']);
  const repairPriority = error => error.person !== undefined ? 0 : genericErrors.has(error.tag) ? 2 : 1;
  const error = [...state.unresolvedErrors].sort((a, b) => repairPriority(a) - repairPriority(b))[0];
  const lastAttempt = history.filter(e => e.objectiveId === chosen.id).at(-1);
  const mode = spacer && chosen.id === activeId ? 'recognition'
    : !state.attempts || (lastAttempt && !lastAttempt.ok) ? 'recognition' : 'production';
  return {
    objective: chosen, activeObjectiveId: activeId, mode, variant: mode === 'production' ? state.productionQuestions : state.attempts,
    repairTag: error?.tag || null, repairPerson: error?.person ?? null, spacer,
    reason: spacer ? 'spaced-check' : error ? 'targeted-repair' : state.attempts ? 'independent-practice' : 'introduction',
  };
}

export function applySessionAttempt(rawSession, event, result) {
  const session = normalizeSession(rawSession);
  if (!session || !event?.id || result?.added === false || session.answeredEventIds.includes(event.id)) return session;
  session.answeredEventIds.push(event.id);
  session.index = Math.max(session.index + 1, finite(event.index) + 1);
  session.updatedAt = Math.max(session.updatedAt, finite(event.at));
  const state = result?.skill;
  if (state?.objectiveId === event.objectiveId) {
    if (state.ready) session.completedObjectiveIds = unique([...session.completedObjectiveIds, event.objectiveId]);
    if (session.mode === 'review' && reviewed(state, session.id)) session.reviewedObjectiveIds = unique([...session.reviewedObjectiveIds, event.objectiveId]);
    // Checkpoint coverage also depends on descriptor requirements, which only
    // selectNext receives. Do not certify it here from a generic ready flag.
    if (session.mode !== 'checkpoint' && session.activeObjectiveId === event.objectiveId && (session.mode === 'review' ? reviewed(state, session.id) : state.ready)) session.activeObjectiveId = null;
  }
  return session;
}

export function deferObjective(rawSession, objectiveId, now = Date.now()) {
  const session = normalizeSession(rawSession);
  if (!session || !session.objectiveIds.includes(objectiveId)) return session;
  session.deferred = { ...session.deferred, [objectiveId]: finite(now) };
  if (session.activeObjectiveId === objectiveId) session.activeObjectiveId = null;
  session.updatedAt = Math.max(session.updatedAt, finite(now));
  return session;
}
