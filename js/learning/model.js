// Adaptive learning's data model. No browser or store dependencies: identical evidence
// produces identical progress, including after an offline merge or backup import.
import { schedule } from '../srs.js';

export const LEARNING_VERSION = 2;
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
  return session.entryId + '|' + (session.journey ? 'journey:' : '') + (session.mode || 'lesson');
}

function normalizeEvent(raw, epochId) {
  if (!raw || typeof raw !== 'object' || !text(raw.id) || BAD_KEYS.has(raw.id) || !text(raw.objectiveId) || BAD_KEYS.has(raw.objectiveId) || BAD_KEYS.has(raw.sessionId)) return null;
  if (raw.epochId !== epochId) return null;
  const outcome = ['correct', 'incorrect', 'skipped', 'revealed'].includes(raw.outcome) ? raw.outcome : raw.ok === true ? 'correct' : 'incorrect';
  const components = [];
  for (const c of Array.isArray(raw.components) ? raw.components : []) {
    if (!c || !text(c.skill) || BAD_KEYS.has(c.skill) || typeof c.ok !== 'boolean') continue;
    components.push({ skill: c.skill, ok: c.ok, ...(text(c.errorTag) ? { errorTag: c.errorTag } : {}) });
  }
  return {
    id: raw.id, epochId, deviceId: text(raw.deviceId), sequence: Math.max(0, Math.floor(finite(raw.sequence))),
    sessionId: text(raw.sessionId), index: Math.max(0, Math.floor(finite(raw.index))), at: finite(raw.at),
    objectiveId: raw.objectiveId, entryId: text(raw.entryId), kind: raw.kind === 'verb' ? 'verb' : 'word',
    skill: text(raw.skill, 'recall'), tense: text(raw.tense) || null,
    person: typeof raw.person === 'number' && Number.isInteger(raw.person) ? raw.person : text(raw.person) || null,
    mode: raw.mode === 'production' && raw.wordPolicy !== 'word-short-v1' ? 'production' : 'recognition',
    variantId: text(raw.variantId), contextId: text(raw.contextId),
    ok: outcome === 'correct' && raw.ok === true, outcome,
    assistance: strings(raw.assistance).filter(x => x !== 'none'), firstAttempt: raw.firstAttempt === true,
    errorTags: strings(raw.errorTags), components,
    xp: Math.max(0, Math.min(3, finite(raw.xp))),
    ...(raw.policy === 'journey-v1' ? {
      policy: 'journey-v1', targetId: text(raw.targetId, raw.objectiveId),
      chapterId: text(raw.chapterId), contentVersion: Math.max(1, Math.floor(finite(raw.contentVersion, 1))),
      role: text(raw.role) || null,
      activityKind: raw.wordPolicy==='word-short-v1' ? raw.activityKind==='repair'?'repair':'guided' : ['guided', 'independent', 'repair'].includes(raw.activityKind) ? raw.activityKind : 'guided',
      ...(Number.isInteger(raw.availableVariants) && raw.availableVariants >= 0 ? { availableVariants: raw.availableVariants } : {}),
      ...(raw.wordPolicy === 'word-short-v1' ? { wordPolicy: 'word-short-v1', wordSlotId: text(raw.wordSlotId) } : {}),
    } : {}),
  };
}

export function createLearning(now = Date.now()) {
  return {
    version: LEARNING_VERSION, createdAt: finite(now),
    // A common initial epoch lets independently migrated devices merge their work.
    epoch: { id: 'initial', at: 0 }, events: {},
    preferences: { stage: 'present', expansions: [], updatedAt: 0, coreOrderVersion: 2 },
    session: null, sessions: {},
  };
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
  return {
    ...p, version: Math.max(LEARNING_VERSION, Math.floor(finite(p.version, LEARNING_VERSION))),
    createdAt: finite(p.createdAt, fresh.createdAt), epoch, events, preferences, session, sessions,
  };
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
  return normalizeLearning({
    ...newest(left, right, 'createdAt'),
    version: Math.max(left.version, right.version), createdAt: Math.min(left.createdAt, right.createdAt),
    epoch: left.epoch, events,
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
  const learning = normalizeLearning(domain, finite(event?.at));
  if (unsupported(learning)) return { learning, added: false, skill: skillState(learning, text(event?.objectiveId), finite(event?.at)) };
  const normalized = normalizeEvent(event, learning.epoch.id);
  if (!normalized || learning.events[normalized.id]) {
    return { learning, added: false, skill: skillState(learning, text(event?.objectiveId), finite(event?.at)) };
  }
  learning.events = { ...learning.events, [normalized.id]: normalized };
  return { learning, added: true, skill: skillState(learning, normalized.objectiveId, normalized.at) };
}

function compareEvents(a, b) {
  return cmp(a.at, b.at) || cmp(a.deviceId, b.deviceId) || cmp(a.sequence, b.sequence) || cmp(a.id, b.id);
}
function orderedEvents(domain) { return Object.values(domain.events).sort(compareEvents); }
const independent = (e) => e.mode === 'production' && e.firstAttempt && e.assistance.length === 0 && (e.policy !== 'journey-v1' || e.activityKind === 'independent') && (e.outcome === 'correct' || e.outcome === 'incorrect');
const variantKey = (e) => [e.variantId || 'unvaried', e.contextId || '', e.person ?? ''].join('|');

function tracker(skill) {
  return { skill, seen: 0, correct: 0, independentCorrect: 0, unresolved: false, errorTag: null, lastFailureAt: 0, confirmationVariants: [], confirmations: 0 };
}
function fail(t, tag, at) {
  t.unresolved = true; t.errorTag = tag || t.skill; t.lastFailureAt = at;
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
  const journey = last?.policy === 'journey-v1';
  // A new content policy never upgrades legacy evidence, even if an imported
  // custom target accidentally reuses an older objective identifier.
  if (journey) events = events.filter(e => e.policy === 'journey-v1' && e.contentVersion === last.contentVersion);
  const required = journey ? 2 : 4;
  const result = {
    objectiveId, entryId: last?.entryId || null, kind: last?.kind || null, skill: last?.skill || null, tense: last?.tense || null,
    attempts: 0, recognitionCorrect: 0, productionAttempts: 0, productionQuestions: 0, independentCorrect: 0, requiredCorrect: required,
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
  const checks = [], delayed = [];
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
      ? pos - positions.get(previous.id) >= 3
      : e.at - previous.at >= REPEAT_DELAY);
    const qualifying = independent(e);
    const priorProduction = previousProduction.get(e.sessionId);
    const spaced = (!!priorProduction && pos - positions.get(priorProduction.id) >= 3)
      || (journey && previousIndependent && previousIndependent.sessionId !== e.sessionId && e.at - previousIndependent.at >= REPEAT_DELAY);
    const eligible = qualifying && e.ok && repeatIsSpaced && (!journey || !previousIndependent || spaced);
    if (qualifying) { checks.push(e.ok); result.productionAttempts++; previousProduction.set(e.sessionId, e); previousIndependent = e; }
    // A correction/reveal cannot immediately become a fresh first-attempt win.
    // Ordinary recognition questions are spacers, not production successes.
    if (e.mode === 'production' || e.outcome === 'revealed' || e.assistance.length) previousVariants.set(key, e);
    if (e.mode === 'recognition' && e.ok) result.recognitionCorrect++;
    // Successful support is a teaching activity in a chapter, not a new failure.
    // It contributes no independent credit and cannot erase previous retrieval.
    const needsRepair = !e.ok || e.outcome === 'revealed' || (!journey && (e.assistance.length > 0 || !e.firstAttempt));
    if (needsRepair) fail(main, e.errorTags[0] || (e.outcome === 'revealed' ? 'revealed' : e.assistance.length ? 'assisted' : 'needs-practice'), e.at);
    else if (e.ok) confirm(main, e, eligible);
    for (const c of e.components) {
      const t = result.components[c.skill] ||= tracker(c.skill);
      t.seen++;
      if (!c.ok) fail(t, c.errorTag || c.skill, e.at);
      else confirm(t, e, qualifying && repeatIsSpaced && (!journey || eligible));
      // Only an explicit person diagnosis justifies person-specific remediation.
      // A wrong participle/auxiliary family must not invent a person error.
      if (c.skill === 'person' && e.person !== null && !BAD_KEYS.has(String(e.person))) {
        const p = result.personEvidence[String(e.person)] ||= { ...tracker('person'), person: e.person };
        p.seen++;
        if (!c.ok) fail(p, c.errorTag || 'person', e.at);
        else confirm(p, e, qualifying && repeatIsSpaced && (!journey || eligible));
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
    } else if ((eligible || e.wordPolicy === 'word-short-v1') && !advanced.has(e.sessionId) && !failed.has(e.sessionId)
      && (!result.srs.due || e.at >= result.srs.due || (!result.srs.reps && !result.srs.lapses))) {
      result.srs = schedule(result.srs, eligible ? 4 : 3, e.at); advanced.add(e.sessionId);
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
  result.unresolvedErrors = [...Object.values(result.personEvidence), ...Object.values(result.components), main].filter(t => t.unresolved).map(t => ({ skill: t.skill, tag: t.errorTag, at: t.lastFailureAt, confirmations: t.confirmations, ...(t.person !== undefined ? { person: t.person } : {}) }));
  result.remembered = result.ready && result.rememberedAt !== null;
  result.status = result.remembered ? 'remembered' : result.ready ? 'ready' : result.attempts ? 'practicing' : 'new';
  result.due = result.srs.due; result.isDue = !!result.due && result.due <= now;
  return result;
}

const evidenceCache = new WeakMap();
function evidenceFor(domain, now) {
  const cacheable = domain && typeof domain === 'object';
  const cached = cacheable && evidenceCache.get(domain);
  if (cached && cached.eventsRef === domain.events && cached.epochId === domain.epoch?.id && cached.epochAt === domain.epoch?.at) return cached;
  const learning = normalizeLearning(domain, now), events = orderedEvents(learning);
  const positions = new Map(), bySession = new Map(), byObjective = new Map(), chronology = new Map(events.map((e, i) => [e.id, i]));
  for (const e of events) {
    if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, []);
    if (!byObjective.has(e.objectiveId)) byObjective.set(e.objectiveId, []);
    bySession.get(e.sessionId).push(e); byObjective.get(e.objectiveId).push(e);
  }
  for (const group of bySession.values()) {
    group.sort((a, b) => cmp(a.index, b.index) || compareEvents(a, b));
    group.forEach((e, i) => positions.set(e.id, i));
  }
  const context = { learning, events, positions, chronology, byObjective, summaries: new Map(), eventsRef: domain?.events, epochId: domain?.epoch?.id, epochAt: domain?.epoch?.at };
  if (cacheable) evidenceCache.set(domain, context);
  return context;
}
function summaryFrom(context, id, now) {
  if (!context.summaries.has(id)) context.summaries.set(id, analyze(context.learning, id, 0, context.events, context.positions, context.byObjective.get(id) || [], context.chronology));
  // Callers can decorate their returned summary without corrupting the cache.
  const summary = plain(context.summaries.get(id));
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
  const learning = normalizeLearning(domain, now), session = normalizeSession(rawSession);
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
  const history = orderedEvents(learning).filter(e => e.sessionId === session.id).sort((a, b) => cmp(a.index, b.index) || compareEvents(a, b));
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
