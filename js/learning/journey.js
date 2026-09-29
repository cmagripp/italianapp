// Pure chapter sequencing. Teaching and supported activities never masquerade as
// independent evidence; the event reducer remains the only source of readiness.
import { createSession, applySessionAttempt, skillState, LEARNING_VERSION } from './model.js';

export const JOURNEY_VERSION = 1;
const copy = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' ? value : '';
const norm = value => text(value).normalize('NFC').trim().toLocaleLowerCase('it').replace(/\s+/g, ' ');
const groups = chapter => chapter?.groups || [];
const targets = chapter => groups(chapter).flatMap(group => group.targets || []);
const allTargets = plan => (plan.chapters || []).flatMap(targets);
const available = target => !!target && target.available !== false;
const required = target => available(target) && target.required !== false && !target.supplementalOnly;
const taughtTargets = group => (group?.targets || []).filter(target => available(target) && !target.supplementalOnly);
const chapterFor = (plan, session) => plan.chapters?.find(chapter => chapter.id === session.journey?.chapterId);
const targetFor = (plan, id) => allTargets(plan).find(target => target.id === id);
const groupFor = (chapter, id) => groups(chapter).find(group => group.targets?.some(target => target.id === id));
const changed = (session, now) => { session.updatedAt = Math.max(session.updatedAt || 0, now); return session; };
const record = value => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const clock = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const stringList = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const mapOf = (value, valid) => record(value) && Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && valid(item));
const phases = new Set(['teach', 'guided', 'practice', 'checkpoint', 'review', 'repair-teach', 'repair', 'recap', 'complete']);

// A supported version number alone does not make an imported cursor executable.
// Preserve malformed payloads for export/recovery and show the unavailable state;
// never coerce a corrupt queue into an apparent completion or discard history.
function compatible(plan, session) {
  const j = session?.journey;
  if (!record(plan) || !Array.isArray(plan.chapters) || !record(session) || !record(j)
    || j.version !== JOURNEY_VERSION || session.entryId !== plan.entryId || j.planVersion !== plan.version
    || !text(session.id) || !text(session.entryId) || !integer(session.index)
    || !stringList(session.answeredEventIds) || !stringList(session.objectiveIds) || !mapOf(session.deferred, clock)
    || !(j.chapterId === null || typeof j.chapterId === 'string') || !phases.has(j.phase)
    || !integer(j.groupIndex) || !integer(j.cardIndex) || !integer(j.serial) || !stringList(j.queue)
    || !mapOf(j.variants, value => record(value) && ['guided', 'independent', 'repair'].every(key => integer(value[key])))
    || !mapOf(j.lastAnswered, integer) || !mapOf(j.failures, integer) || !mapOf(j.skipped, clock) || !mapOf(j.covered, clock)
    || typeof j.awaitingContinue !== 'boolean' || !(j.focusTargetId === null || typeof j.focusTargetId === 'string')) return false;
  if (j.current !== null && (!record(j.current) || !text(j.current.targetId) || !text(j.current.questionId)
    || !['guided', 'independent', 'repair'].includes(j.current.phase) || !['type', 'mc', 'match'].includes(j.current.format)
    || !integer(j.current.variant) || typeof j.current.supplemental !== 'boolean'
    || !(j.current.repairTag == null || typeof j.current.repairTag === 'string'))) return false;
  if (j.lastAttempt !== null && (!record(j.lastAttempt) || !text(j.lastAttempt.id) || !text(j.lastAttempt.targetId)
    || typeof j.lastAttempt.ok !== 'boolean' || !['correct', 'incorrect', 'revealed', 'skipped'].includes(j.lastAttempt.outcome)
    || !stringList(j.lastAttempt.errorTags) || !(j.lastAttempt.variant === undefined || integer(j.lastAttempt.variant)))) return false;
  if (j.repairReturn !== null && (!record(j.repairReturn) || !phases.has(j.repairReturn.phase) || typeof j.repairReturn.supplemental !== 'boolean')) return false;
  if (j.blocked !== undefined && typeof j.blocked !== 'boolean' && typeof j.blocked !== 'string') return false;
  if (j.limitedTargets !== undefined && !mapOf(j.limitedTargets, value => typeof value === 'boolean')) return false;
  if (j.personRepairs !== undefined && !mapOf(j.personRepairs, value => integer(value) && value <= 5)) return false;
  if ((j.awaitingContinue || ['repair', 'repair-teach'].includes(j.phase)) && (!j.current || !j.lastAttempt)) return false;
  return true;
}

export function journeyTargetState(learning, target, now = Date.now()) {
  const state = skillState(learning, typeof target === 'string' ? target : target?.id, now);
  // Older whole-verb records are retained, never promoted into a chapter target.
  return state.policy === 'journey-v1' ? state : { ...state, ready: false, remembered: false, status: 'new', independentCorrect: 0, requiredCorrect: 2 };
}

function eligibleTargets(plan, session, chapter = chapterFor(plan, session)) {
  const j = session.journey;
  return targets(chapter).filter(target => (j.focusTargetId ? available(target) && !target.supplementalOnly && !target.guidedOnly : required(target)) && !Object.hasOwn(j.skipped, target.id)
    && (!j.focusTargetId || target.id === j.focusTargetId));
}

function variantFor(session, target, phase) {
  const j = session.journey;
  if (phase === 'repair' && j.lastAttempt?.targetId === target.id) return j.lastAttempt.variant || 0;
  const next = j.variants[target.id]?.[phase] || 0;
  const person = j.personRepairs?.[target.id], persons = target.personsByVariant;
  if (phase === 'independent' && person !== undefined && Array.isArray(persons) && persons.length) {
    for (let i = 0; i < persons.length; i++) if (persons[(next + i) % persons.length] === person) return next + i;
  }
  return next;
}

function answersFor(session, target, phase = 'independent') {
  const variants = target.exposureFormsByVariant || target.answerFormsByVariant;
  const index = variantFor(session, target, phase);
  const candidates = Array.isArray(variants) && variants.length ? variants[index % variants.length] : target.answerForms || target.answers || [];
  return (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean).map(norm);
}

function exposed(session, target, phase = 'independent') {
  const j = session.journey;
  if (typeof j.lastAnswered[target.id] === 'number' && session.index - j.lastAnswered[target.id] < 2) return true;
  return answersFor(session, target, phase).some(form => {
    const at = session.ui?.exposures?.[form];
    return typeof at === 'number' && session.index - at < 2;
  });
}

function setQuestion(plan, session, target, phase, { supplemental = false, repairTag = null } = {}) {
  const j = session.journey;
  const counter = j.variants[target.id] ||= { guided: 0, independent: 0, repair: 0 };
  const variant = variantFor(session, target, phase);
  counter[phase] = variant + 1;
  j.serial++;
  let format = phase === 'independent' || (supplemental && !target.supplementalOnly) ? 'type' : target.guidedFormat || 'mc';
  // Change how the small step is answered after recurring difficulty. Both
  // formats remain supported evidence and keep the failed person/context.
  if (phase === 'repair' && (j.failures[target.id] || 0) >= 2) format = j.failures[target.id] % 2 ? 'mc' : 'type';
  j.current = { targetId: target.id, phase, format,
    variant, questionId: `${session.id}:journey:${j.serial}`, supplemental, repairTag };
  j.awaitingContinue = false;
  session.activeObjectiveId = target.id;
}

function startGroup(plan, session, learning, now) {
  const j = session.journey, chapter = chapterFor(plan, session), group = groups(chapter)[j.groupIndex];
  j.cardIndex = 0; j.current = null; j.phase = 'teach';
  if (!group) return startPass(plan, session, learning, 'checkpoint', eligibleTargets(plan, session).map(target => target.id), now);
  if (!(group.cards || []).length) return startPass(plan, session, learning, 'guided', taughtTargets(group).map(target => target.id), now);
  return session;
}

function startPass(plan, session, learning, phase, queue, now) {
  const j = session.journey;
  j.phase = phase; j.queue = [...new Set(queue)]; j.current = null; j.awaitingContinue = false;
  j.blocked = false;
  return schedule(plan, session, learning, now);
}

function finishPass(plan, session, learning, now) {
  const j = session.journey, chapter = chapterFor(plan, session), group = groups(chapter)[j.groupIndex];
  if (j.phase === 'guided') return startPass(plan, session, learning, 'practice', (group?.targets || []).filter(required).map(target => target.id), now);
  if (j.phase === 'practice') { j.groupIndex++; return startGroup(plan, session, learning, now); }
  // A previously-ready form may have failed while serving as a contrast. Keep
  // that reopened target in this chapter even if it left the original queue.
  if (j.phase === 'checkpoint') {
    const pending = eligibleTargets(plan, session).filter(target => !journeyTargetState(learning, target, now).ready);
    if (pending.length) return startPass(plan, session, learning, 'checkpoint', pending.map(target => target.id), now);
  }
  j.phase = 'recap'; j.current = null; j.awaitingContinue = false;
  j.covered[j.chapterId] = now;
  // Meet is an introduction, not an assessment. Its final Continue starts the
  // first teaching chapter directly; no empty practice/recap screen is needed.
  if (chapter?.id === 'meet' && !targets(chapter).some(target => available(target) && !target.supplementalOnly)
    && session.mode !== 'review') {
    const index = plan.chapters.findIndex(c => c.id === chapter.id);
    const next = plan.chapters.slice(index + 1).find(c => !c.optional);
    if (next) { j.chapterId = next.id; j.groupIndex = 0; return startGroup(plan, session, learning, now); }
  }
  return session;
}

function reviewed(learning, target, session, now) {
  const state = journeyTargetState(learning, target, now), evidence = state.sessionEvidence?.[session.id];
  return state.ready && evidence?.independentCorrect >= 2 && evidence.variants?.length >= 2 && evidence.correctAfterError >= 2;
}

function schedule(plan, session, learning, now) {
  const j = session.journey, chapter = chapterFor(plan, session);
  j.blocked = false;
  j.queue = j.queue.filter(id => available(targetFor(plan, id)) && !Object.hasOwn(j.skipped, id));
  if (j.phase === 'checkpoint') j.queue = j.queue.filter(id => !journeyTargetState(learning, id, now).ready);
  if (j.phase === 'review') j.queue = j.queue.filter(id => !reviewed(learning, targetFor(plan, id), session, now));
  if (!j.queue.length) return finishPass(plan, session, learning, now);
  if (j.phase === 'guided') { setQuestion(plan, session, targetFor(plan, j.queue.shift()), 'guided'); return session; }
  // Rotate people/activities from this same chapter. Never inject another entry.
  const limited = target => (target.independentVariantCount ?? target.variantCount) === 1 || j.limitedTargets?.[target.id];
  const possible = j.queue.filter(id => !limited(targetFor(plan, id)));
  if (!possible.length && j.phase !== 'practice') { j.blocked = 'limited-variants'; j.current = null; return session; }
  const next = j.queue.findIndex(id => !limited(targetFor(plan, id)) && !exposed(session, targetFor(plan, id)));
  if (next >= 0) { setQuestion(plan, session, targetFor(plan, j.queue.splice(next, 1)[0]), 'independent'); return session; }
  // A focused review can use a different person or skill as a brief contrast.
  // These are supported activities, not extra completion requirements.
  const alternatives = targets(chapter).filter(target => available(target) && !j.queue.includes(target.id)
    && !Object.hasOwn(j.skipped, target.id) && !exposed(session, target, 'guided')
    && !j.queue.some(id => answersFor(session, target, 'guided').some(answer => answersFor(session, targetFor(plan, id)).includes(answer)))
    && (session.mode === 'review' || groups(chapter).indexOf(groupFor(chapter, target.id)) <= j.groupIndex));
  alternatives.sort((a, b) => Number(!!b.supplementalOnly) - Number(!!a.supplementalOnly)
    || (j.lastAnswered[a.id] ?? -1) - (j.lastAnswered[b.id] ?? -1));
  if (alternatives.length) { setQuestion(plan, session, alternatives[0], 'guided', { supplemental: true }); return session; }
  // A final choice can expose every queued form. Use two other already-taught
  // people as short supported contrasts while keeping the first target cold.
  // Their queue positions remain intact, and support never gains mastery.
  const waiting = targetFor(plan, possible[0] || j.queue[0]);
  const waitingAnswers = answersFor(session, waiting);
  const contrasts = targets(chapter).filter(target => available(target) && target.id !== waiting.id
    && !Object.hasOwn(j.skipped, target.id)
    && (session.mode === 'review' || groups(chapter).indexOf(groupFor(chapter, target.id)) <= j.groupIndex)
    && (j.lastAnswered[target.id] === undefined || session.index - j.lastAnswered[target.id] >= 2)
    && !answersFor(session, target, 'guided').some(answer => waitingAnswers.includes(answer)));
  contrasts.sort((a, b) => (j.lastAnswered[a.id] ?? -1) - (j.lastAnswered[b.id] ?? -1));
  if (contrasts.length) { setQuestion(plan, session, contrasts[0], 'guided', { supplemental: true }); return session; }
  // Early groups may defer their checks to the chapter checkpoint after all
  // forms have been taught. At the checkpoint a lack of safe content is an
  // explicit pause/skip decision, never an automatic completion or retry cap.
  if (j.phase === 'practice') return finishPass(plan, session, learning, now);
  j.blocked = 'more-context-needed'; j.current = null;
  return session;
}

export function createJourneySession({ id, plan, now = Date.now(), mode = 'lesson', chapterId = null, targetId = null }) {
  const chapter = targetId ? plan.chapters?.find(c => targets(c).some(t => t.id === targetId))
    : plan.chapters?.find(c => c.id === chapterId) || plan.chapters?.find(c => !c.optional && (mode !== 'review' || targets(c).some(required))) || plan.chapters?.[0];
  const session = createSession({ id, entryId: plan.entryId, objectiveIds: allTargets(plan).filter(available).map(target => target.id), now, mode });
  session.journey = { version: JOURNEY_VERSION, planVersion: plan.version, chapterId: chapter?.id || null, groupIndex: 0, cardIndex: 0,
    phase: 'teach', current: null, queue: [], serial: 0, variants: {}, lastAnswered: {}, failures: {}, skipped: {}, covered: {},
    awaitingContinue: false, lastAttempt: null, repairReturn: null, focusTargetId: targetId || null, blocked: false, limitedTargets: {}, personRepairs: {} };
  if (!chapter) session.journey.phase = 'complete';
  else if (mode === 'review') startPass(plan, session, null, 'review', eligibleTargets(plan, session).map(target => target.id), now);
  else startGroup(plan, session, null, now);
  return session;
}

export function currentJourneyStep(plan, session, learning = null, now = Date.now()) {
  if (!compatible(plan, session) || (learning?.version > LEARNING_VERSION)) return { type: 'unavailable', reason: 'version-mismatch' };
  const j = session.journey, chapter = chapterFor(plan, session);
  const target = targetFor(plan, j.current?.targetId), group = target ? groupFor(chapter, target.id) : groups(chapter)[j.groupIndex];
  const base = { chapter, group, target, awaitingContinue: j.awaitingContinue, phase: j.current?.phase || j.phase,
    ...(j.current || {}), helpSuggested: !!target && (j.failures[target.id] || 0) >= 2 };
  if (j.phase === 'complete') return { ...base, type: 'complete' };
  if (!chapter) return { ...base, type: 'unavailable', reason: 'chapter-unavailable' };
  if (j.blocked) return { ...base, target: targetFor(plan, j.queue[0]), type: 'blocked', reason: j.blocked, progress: journeyProgress(plan, session, learning, now) };
  if (j.phase === 'recap') return { ...base, type: 'recap', progress: journeyProgress(plan, session, learning, now) };
  if (j.phase === 'teach') return { ...base, type: 'teach', card: group?.cards?.[j.cardIndex] || null };
  if (j.phase === 'repair-teach') return { ...base, phase: 'repair', type: 'repair', repairTag: j.lastAttempt?.errorTags?.[0] || 'uncertain' };
  if (!target) return { ...base, type: 'unavailable', reason: 'target-unavailable' };
  return { ...base, type: 'question' };
}

export function advanceJourney(plan, oldSession, learning, { now = Date.now() } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION) return oldSession;
  const session = copy(oldSession), j = session.journey, chapter = chapterFor(plan, session);
  if (j.phase === 'teach') {
    const group = groups(chapter)[j.groupIndex];
    j.cardIndex++;
    if (j.cardIndex >= (group?.cards || []).length) startPass(plan, session, learning, 'guided', taughtTargets(group).map(target => target.id), now);
  } else if (j.phase === 'repair-teach') {
    j.phase = 'repair';
    setQuestion(plan, session, targetFor(plan, j.current.targetId), 'repair', { repairTag: j.lastAttempt?.errorTags?.[0] || 'uncertain', supplemental: j.current.supplemental });
  } else if (j.phase === 'recap') {
    // The only way beyond a recap with unfinished forms is the learner's
    // explicit continue action. Keep those forms pending for a later visit.
    for (const target of targets(chapter).filter(required)) if (!journeyTargetState(learning, target, now).ready) {
      j.skipped[target.id] = now; session.deferred[target.id] = now;
    }
    const index = plan.chapters.findIndex(c => c.id === j.chapterId);
    const next = session.mode !== 'review' && plan.chapters.slice(index + 1).find(c => !c.optional);
    if (next) { j.chapterId = next.id; j.groupIndex = 0; startGroup(plan, session, learning, now); }
    else { j.phase = 'complete'; j.current = null; }
  } else if (j.awaitingContinue) {
    j.awaitingContinue = false;
    const last = j.lastAttempt, current = j.current;
    if (!last.ok || last.outcome === 'revealed') {
      if (j.phase !== 'repair') j.repairReturn = { phase: j.phase, supplemental: current.supplemental };
      j.phase = 'repair-teach';
    } else {
      if (j.phase === 'repair') {
        j.phase = j.repairReturn?.phase || 'checkpoint';
        if (j.phase !== 'guided' && !j.repairReturn?.supplemental) j.queue.push(current.targetId);
        j.repairReturn = null;
      } else if (!current.supplemental && ((j.phase === 'review' && !reviewed(learning, targetFor(plan, current.targetId), session, now))
        || (j.phase === 'checkpoint' && !journeyTargetState(learning, current.targetId, now).ready))) j.queue.push(current.targetId);
      schedule(plan, session, learning, now);
    }
  }
  return changed(session, now);
}

// Build metadata for the one current question. Store stamps epoch/device/sequence
// and rewards; no raw answer or generated HTML enters the shared evidence log.
export function journeyAttempt(plan, session, question, grade, { assistance = [], now = Date.now() } = {}) {
  if (!compatible(plan, session) || !session.journey.current || session.journey.awaitingContinue) return null;
  const j = session.journey, current = j.current, target = targetFor(plan, current.targetId), chapter = chapterFor(plan, session);
  if (!target || question?.meta?.targetId && question.meta.targetId !== target.id) return null;
  const help = [...new Set(assistance.filter(x => typeof x === 'string'))];
  const independent = current.phase === 'independent' && question.type !== 'mc' && question.meta?.mode !== 'recognition';
  return { id: current.questionId, sessionId: session.id, index: session.index, at: now,
    policy: 'journey-v1', targetId: target.id, objectiveId: target.id, entryId: plan.entryId, kind: plan.kind,
    chapterId: chapter.id, contentVersion: plan.version, role: target.role || null,
    skill: question.meta?.skill || target.skill, tense: target.tense || chapter.tense || null, person: question.meta?.person ?? target.person ?? null,
    activityKind: current.phase, mode: independent ? 'production' : 'recognition',
    variantId: text(question.meta?.variantId), contextId: text(question.meta?.contextId),
    ...(Number.isInteger(question.meta?.variantCount) ? { availableVariants: question.meta.variantCount } : {}),
    ok: grade.ok === true, outcome: grade.outcome || (grade.ok ? 'correct' : 'incorrect'), assistance: help, firstAttempt: true,
    errorTags: grade.errorTags || [], components: grade.components || [],
  };
}

export function recordJourneyAttempt(plan, oldSession, event, result) {
  if (!compatible(plan, oldSession) || !event || event.id !== oldSession.journey.current?.questionId
    || oldSession.answeredEventIds.includes(event.id) || result?.added === false) return oldSession;
  const session = applySessionAttempt(oldSession, event, result), j = session.journey;
  j.awaitingContinue = true;
  j.lastAttempt = { id: event.id, targetId: event.objectiveId, variant: j.current.variant, ok: event.ok, outcome: event.outcome, errorTags: event.errorTags || [] };
  j.lastAnswered[event.objectiveId] = session.index;
  // An answer copied from support has not tried this variant independently.
  // Retry that same useful context after a gap rather than letting scheduling
  // parity strand every credited answer on the other variant forever.
  if (event.activityKind === 'independent' && event.ok && event.assistance?.length) j.variants[event.objectiveId].independent = j.current.variant;
  const personError = result?.skill?.unresolvedErrors?.find(error => error.person !== undefined);
  if (personError) (j.personRepairs ||= {})[event.objectiveId] = personError.person;
  else if (j.personRepairs) delete j.personRepairs[event.objectiveId];
  if (event.activityKind === 'independent' && event.availableVariants === 1) (j.limitedTargets ||= {})[event.objectiveId] = true;
  if (!event.ok) j.failures[event.objectiveId] = (j.failures[event.objectiveId] || 0) + 1;
  session.activeObjectiveId = j.current.targetId;
  return session;
}

export function skipJourneyTarget(plan, oldSession, targetId = null, { now = Date.now(), learning = null } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION) return oldSession;
  const session = copy(oldSession), j = session.journey;
  if (j.phase === 'teach' && !targetId) {
    const group = groups(chapterFor(plan, session))[j.groupIndex];
    for (const target of taughtTargets(group)) { j.skipped[target.id] = now; session.deferred[target.id] = now; }
    j.groupIndex++;
    startGroup(plan, session, learning, now);
    return changed(session, now);
  }
  const id = targetId || j.current?.targetId || (j.blocked && j.queue[0]);
  if (!targetFor(plan, id)) return session;
  j.skipped[id] = now; session.deferred[id] = now;
  if (j.phase === 'repair' || j.phase === 'repair-teach') j.phase = j.repairReturn?.phase || 'checkpoint';
  j.current = null; j.awaitingContinue = false; j.repairReturn = null; j.blocked = false;
  schedule(plan, session, learning, now);
  return changed(session, now);
}

export function chooseJourneyChapter(plan, oldSession, chapterId, { now = Date.now(), learning = null } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION || !plan.chapters.some(c => c.id === chapterId)) return oldSession;
  const session = copy(oldSession), j = session.journey;
  j.chapterId = chapterId; j.groupIndex = 0; j.focusTargetId = null; j.awaitingContinue = false; j.repairReturn = null;
  for (const target of targets(chapterFor(plan, session))) { delete j.skipped[target.id]; delete session.deferred[target.id]; }
  if (session.mode === 'review') startPass(plan, session, learning, 'review', eligibleTargets(plan, session).map(t => t.id), now);
  else startGroup(plan, session, learning, now);
  return changed(session, now);
}

export function retryJourneyPending(plan, oldSession, learning, { now = Date.now() } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION) return oldSession;
  const session = copy(oldSession), j = session.journey;
  const pending = targets(chapterFor(plan, session)).filter(target => (j.focusTargetId ? available(target) && !target.supplementalOnly && !target.guidedOnly : required(target))
    && (!j.focusTargetId || target.id === j.focusTargetId)
    && (session.mode === 'review' ? !reviewed(learning, target, session, now) : !journeyTargetState(learning, target, now).ready));
  for (const target of pending) { delete j.skipped[target.id]; delete session.deferred[target.id]; }
  startPass(plan, session, learning, session.mode === 'review' ? 'review' : 'checkpoint', pending.map(target => target.id), now);
  return changed(session, now);
}

// UI can postpone an independent prompt whose exact answer appears elsewhere on
// screen. The postponed prompt does not produce a wrong answer, XP, or a lapse.
export function deferJourneyTarget(plan, oldSession, learning, { now = Date.now() } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION || !oldSession.journey.current || oldSession.journey.awaitingContinue) return oldSession;
  const session = copy(oldSession), j = session.journey, id = j.current.targetId;
  j.lastAnswered[id] = session.index;
  if (!j.current.supplemental) j.queue.push(id);
  j.current = null;
  schedule(plan, session, learning, now);
  return changed(session, now);
}

export function journeyProgress(plan, session, learning = null, now = Date.now()) {
  const chapters = (plan.chapters || []).map(chapter => {
    const states = targets(chapter).filter(required).map(target => ({ target, ...journeyTargetState(learning, target, now), skipped: !!session?.journey?.skipped?.[target.id] }));
    const ready = states.filter(state => state.ready).length;
    return { id: chapter.id, title: chapter.title, optional: !!chapter.optional, targets: states, total: states.length, ready,
      remembered: states.filter(state => state.remembered).length, pending: states.filter(state => !state.ready),
      covered: !!session?.journey?.covered?.[chapter.id], complete: states.length ? ready === states.length : !!session?.journey?.covered?.[chapter.id] };
  });
  return { chapters, currentChapterId: session?.journey?.chapterId || null, complete: chapters.filter(c => !c.optional).every(c => c.complete),
    covered: chapters.filter(c => !c.optional).every(c => c.covered), pending: chapters.flatMap(c => c.pending) };
}
