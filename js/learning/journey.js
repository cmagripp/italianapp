// Pure chapter sequencing. Teaching and supported activities never masquerade as
// independent evidence; the event reducer remains the only source of readiness.
import { createSession, applySessionAttempt, skillState, completionRecord, LEARNING_VERSION } from './model.js';

export const JOURNEY_VERSION = 1;
export const CORE_JOURNEY_CASES = ['present', 'past', 'background', 'future', 'condizionale'];
export const coreJourneyChapters = plan => CORE_JOURNEY_CASES.map(id => plan?.chapters?.find(c => c.id === id)).filter(Boolean);
const copy = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' ? value : '';
const norm = value => text(value).normalize('NFC').trim().toLocaleLowerCase('it').replace(/\s+/g, ' ');
const groups = chapter => chapter?.groups || [];
const targets = chapter => groups(chapter).flatMap(group => group.targets || []);
const allTargets = plan => (plan.chapters || []).flatMap(targets);
const available = target => !!target && target.available !== false;
const required = target => available(target) && (target.required !== false || target.completionRequired) && !target.supplementalOnly;
const taughtTargets = group => (group?.targets || []).filter(target => available(target) && !target.supplementalOnly && !target.coveredByContextualForms);
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
    || !['guided', 'independent', 'repair'].includes(j.current.phase) || !['type', 'mc', 'match', 'letters', 'pairs'].includes(j.current.format)
    || !integer(j.current.variant) || typeof j.current.supplemental !== 'boolean'
    || !(j.current.repairTag == null || typeof j.current.repairTag === 'string')
    || !(j.current.scenePolicy === undefined || j.current.scenePolicy === 'expanded-v1'))) return false;
  if (j.lastAttempt !== null && (!record(j.lastAttempt) || !text(j.lastAttempt.id) || !text(j.lastAttempt.targetId)
    || typeof j.lastAttempt.ok !== 'boolean' || !['correct', 'incorrect', 'revealed', 'skipped'].includes(j.lastAttempt.outcome)
    || !stringList(j.lastAttempt.errorTags) || !(j.lastAttempt.variant === undefined || integer(j.lastAttempt.variant))
    || !(j.lastAttempt.scenePolicy === undefined || j.lastAttempt.scenePolicy === 'expanded-v1'))) return false;
  if (j.repairReturn !== null && (!record(j.repairReturn) || !phases.has(j.repairReturn.phase) || typeof j.repairReturn.supplemental !== 'boolean')) return false;
  if (j.blocked !== undefined && typeof j.blocked !== 'boolean' && typeof j.blocked !== 'string') return false;
  if (j.limitedTargets !== undefined && !mapOf(j.limitedTargets, value => typeof value === 'boolean')) return false;
  if (j.personRepairs !== undefined && !mapOf(j.personRepairs, value => integer(value) && value <= 5)) return false;
  if (j.pairMatches !== undefined && !mapOf(j.pairMatches, stringList)) return false;
  if (j.pairRepairs !== undefined && !mapOf(j.pairRepairs, value => record(value) && text(value.id) && text(value.targetId) && integer(value.variant) && stringList(value.errorTags))) return false;
  if (j.writtenRun !== undefined && !integer(j.writtenRun)) return false;
  if (j.varietyRound !== undefined && !integer(j.varietyRound)) return false;
  if (j.checkpointNextGroup !== undefined && j.checkpointNextGroup !== null && !integer(j.checkpointNextGroup)) return false;
  if (j.verbFlowVersion !== undefined && j.verbFlowVersion !== 2) return false;
  if (j.caseMode !== undefined && typeof j.caseMode !== 'boolean') return false;
  if (j.redoStartIndex !== undefined && j.redoStartIndex !== null && !integer(j.redoStartIndex)) return false;
  if (j.wordShort !== undefined && (!record(j.wordShort) || j.wordShort.version !== 1 || !integer(j.wordShort.teachingIndex)
    || !(j.wordShort.slotId === null || typeof j.wordShort.slotId === 'string') || !mapOf(j.wordShort.completed, value => typeof value === 'string') || !mapOf(j.wordShort.skipped, clock))) return false;
  if (j.caseCursors !== undefined && !mapOf(j.caseCursors, value => record(value) && typeof value.chapterId === 'string'
    && compatible(plan, { ...session, journey: { ...j, ...value, caseCursors: undefined } }))) return false;
  if ((j.awaitingContinue || ['repair', 'repair-teach'].includes(j.phase)) && (!j.current || !j.lastAttempt)) return false;
  return true;
}

export function journeyTargetState(learning, target, now = Date.now()) {
  const state = skillState(learning, typeof target === 'string' ? target : target?.id, now);
  if (target?.completionRequired && state.policy === 'journey-v1') {
    const ready = state.firstCorrectAt !== null;
    return { ...state, ready, remembered: false, requiredCorrect: 0, supportedCompletion: true,
      readyPeriods: ready ? [{ start: state.firstCorrectPosition, at: state.firstCorrectAt, end: null }] : [] };
  }
  // Older whole-verb records are retained, never promoted into a chapter target.
  return state.policy === 'journey-v1' ? state : { ...state, ready: false, remembered: false, status: 'new', independentCorrect: 0, requiredCorrect: 2 };
}

const redoCache = new WeakMap();
const completionEvidenceCache = new WeakMap();
function completionEvidence(learning, entryId, chapterId) {
  const override = completionRecord(learning,entryId,chapterId);
  if (!override || override.checked || !learning) return learning;
  let cache = completionEvidenceCache.get(learning);
  if (!cache || cache.events !== learning.events || cache.completions !== learning.completions) {
    cache = {events:learning.events,completions:learning.completions,domains:new Map()}; completionEvidenceCache.set(learning,cache);
  }
  if (!cache.domains.has(override.id)) cache.domains.set(override.id,{...learning,events:Object.fromEntries(Object.entries(learning.events || {}).filter(([,e])=>e.at>override.at))});
  return cache.domains.get(override.id);
}
function readyForRun(learning, target, session, now) {
  const manual=completionRecord(learning,session.entryId,session.journey.chapterId);
  if(session.journey.redoStartIndex==null&&manual?.checked&&(manual.flowVersion===2||!target.flowVersion))return true;
  if (!journeyTargetState(completionEvidence(learning,session.entryId,session.journey.chapterId), target, now).ready) return false;
  const start = session.journey.redoStartIndex;
  if (start === undefined || start === null || !learning) return true;
  let cache = redoCache.get(learning);
  const key = `${session.id}:${start}`;
  if (!cache || cache.events !== learning.events) { cache = { events: learning.events, runs: new Map() }; redoCache.set(learning, cache); }
  if (!cache.runs.has(key)) cache.runs.set(key, { ...learning, events: Object.fromEntries(Object.entries(learning.events || {})
    .filter(([, e]) => e.sessionId === session.id && e.index >= start)) });
  return journeyTargetState(cache.runs.get(key), target, now).ready;
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

function exposed(session, target, phase = 'independent', gap = 2) {
  const j = session.journey;
  if (typeof j.lastAnswered[target.id] === 'number' && session.index - j.lastAnswered[target.id] < gap) return true;
  return answersFor(session, target, phase).some(form => {
    const at = session.ui?.exposures?.[form];
    return typeof at === 'number' && session.index - at < gap;
  });
}

function setQuestion(plan, session, target, phase, { supplemental = false, repairTag = null, activityFormat = null } = {}) {
  const j = session.journey;
  const counter = j.variants[target.id] ||= { guided: 0, independent: 0, repair: 0 };
  const variant = variantFor(session, target, phase);
  counter[phase] = variant + 1;
  j.serial++;
  let format = phase === 'independent' || (supplemental && !target.supplementalOnly) ? 'type' : target.guidedFormat || 'mc';
  if (phase === 'guided' && !supplemental && !target.supplementalOnly) {
    const group = groupFor(chapterFor(plan, session), target.id), taught = taughtTargets(group), position = taught.findIndex(t => t.id === target.id);
    const matchable = taught.filter(t => !t.guidedOnly && ['conjugation', 'address', 'progressive'].includes(t.skill) && Number.isInteger(t.person));
    if (plan.kind === 'verb' && position === 1 && variant === 0 && matchable.length >= 3 && matchable.some(t => t.id === target.id)) format = 'pairs';
    else if (!target.guidedOnly && ((position + variant) % 3 === 2 || (matchable.length < 3 && position === 1))) format = 'letters';
    else if (plan.kind === 'verb' && position === 0 && !target.guidedOnly) format = 'mc';
    else if (format === 'match') format = 'mc';
  }
  // Change how the small step is answered after recurring difficulty. Both
  // formats remain supported evidence and keep the failed person/context.
  if (phase === 'repair' && (j.failures[target.id] || 0) >= 2) format = j.failures[target.id] % 3 === 0 ? 'letters' : j.failures[target.id] % 2 ? 'mc' : 'type';
  if (activityFormat && phase !== 'independent') format = activityFormat;
  if (format === 'pairs' && groupFor(chapterFor(plan, session), target.id)?.targets?.some(t => Object.hasOwn(j.skipped, t.id))) format = 'mc';
  if (format === 'match') format = 'mc';
  j.current = { targetId: target.id, phase, format,
    variant, questionId: `${session.id}:journey:${j.serial}`, supplemental, repairTag,
    ...(plan.kind === 'verb' && (phase !== 'repair' || j.lastAttempt?.scenePolicy === 'expanded-v1')
      ? { scenePolicy: 'expanded-v1' } : {}) };
  j.awaitingContinue = false;
  session.activeObjectiveId = target.id;
}

function inCurrentSection(chapter, session, target) {
  if(chapter?.flowVersion!==2 || session.mode==='review')return true;
  const current=groups(chapter)[session.journey.groupIndex];
  return current?.finalReview || groupFor(chapter,target.id)?.stage===current?.stage;
}
function sectionPending(plan,session,learning,now){
  return eligibleTargets(plan,session).filter(t=>inCurrentSection(chapterFor(plan,session),session,t)&&!readyForRun(learning,t,session,now));
}
function startGroup(plan, session, learning, now) {
  const j = session.journey, chapter = chapterFor(plan, session), group = groups(chapter)[j.groupIndex];
  j.cardIndex = 0; j.current = null; j.phase = 'teach';
  if (!group) return startPass(plan, session, learning, 'checkpoint', eligibleTargets(plan, session).map(target => target.id), now);
  if(group.finalReview){
    for(const target of group.targets||[])if(target.dependsOn?.some(id=>Object.hasOwn(j.skipped,id))){j.skipped[target.id]=now;session.deferred[target.id]=now;}
  }
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
  if (j.phase === 'practice') {
    const nextIndex=j.groupIndex+1,next=groups(chapter)[nextIndex];
    if(chapter?.flowVersion===2 && next && next.stage!==group?.stage){
      const pending=sectionPending(plan,session,learning,now);
      if(pending.length){j.checkpointNextGroup=nextIndex;return startPass(plan,session,learning,'checkpoint',pending.map(t=>t.id),now);}
    }
    j.groupIndex++; return startGroup(plan, session, learning, now);
  }
  // A previously-ready form may have failed while serving as a contrast. Keep
  // that reopened target in this chapter even if it left the original queue.
  if (j.phase === 'checkpoint') {
    const pending = chapter?.flowVersion===2 ? sectionPending(plan,session,learning,now) : eligibleTargets(plan, session).filter(target => !(chapter.id==='mixed'&&target.flowVersion&&journeyCaseProgress(plan,learning,null,now).cases.find(c=>c.id===target.sourceChapter)?.updateAvailable) && !readyForRun(learning, target, session, now));
    if (pending.length) return startPass(plan, session, learning, 'checkpoint', pending.map(target => target.id), now);
    if(j.checkpointNextGroup!=null){j.groupIndex=j.checkpointNextGroup;j.checkpointNextGroup=null;return startGroup(plan,session,learning,now);}
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

function reviewTargetAllowed(plan, session, learning, chapter, target, now) {
  if(!learning)return true;
  const source=journeyCaseProgress(plan,learning,null,now).cases.find(c=>c.id===(chapter.id==='mixed'?target?.sourceChapter:chapter.id));
  const demonstrated=target?.flowVersion===2&&!!journeyTargetState(learning,target,now).readyPeriods?.length;
  // Review draws from completed cases. An old case completion cannot enroll a
  // new construction until that target has its own demonstrated evidence.
  if(session.mode==='review'&&target?.flowVersion===2){
    if(!source?.ready||source.updateAvailable&&!demonstrated)return false;
  }
  if(chapter.id!=='mixed')return true;
  return !!source?.ready&&(!target?.flowVersion||!source.updateAvailable||demonstrated);
}
function schedule(plan, session, learning, now) {
  const j = session.journey, chapter = chapterFor(plan, session);
  const reviewAllowed = target => reviewTargetAllowed(plan,session,learning,chapter,target,now);
  const exposureGap = plan.kind === 'verb' ? 1 : 2;
  j.blocked = false;
  j.queue = j.queue.filter(id => available(targetFor(plan, id)) && reviewAllowed(targetFor(plan,id)) && !Object.hasOwn(j.skipped, id));
  const pairFailure = Object.values(j.pairRepairs || {}).find(failure => targets(chapter).some(t => t.id === failure.targetId)
    && reviewAllowed(targetFor(plan,failure.targetId)) && !Object.hasOwn(j.skipped, failure.targetId));
  if (pairFailure) {
    delete j.pairRepairs[pairFailure.targetId];
    j.lastAttempt = { ...pairFailure, ok: false, outcome: 'incorrect' };
    j.repairReturn = { phase: j.phase, supplemental: false };
    j.queue = j.queue.filter(id => id !== pairFailure.targetId);
    setQuestion(plan, session, targetFor(plan, pairFailure.targetId), 'repair', { repairTag: pairFailure.errorTags[0] || 'person' });
    j.phase = 'repair-teach';
    return session;
  }
  if (j.phase === 'checkpoint') j.queue = j.queue.filter(id => !readyForRun(learning, targetFor(plan, id), session, now));
  if (j.phase === 'review') j.queue = j.queue.filter(id => !reviewed(learning, targetFor(plan, id), session, now));
  if (!j.queue.length) return finishPass(plan, session, learning, now);
  if (j.phase === 'guided') { setQuestion(plan, session, targetFor(plan, j.queue.shift()), 'guided'); return session; }
  const support = j.queue.findIndex(id => targetFor(plan, id)?.completionRequired);
  if (support >= 0) { setQuestion(plan, session, targetFor(plan, j.queue.splice(support, 1)[0]), 'guided'); return session; }
  // Rotate people/activities from this same chapter. Never inject another entry.
  const limited = target => (target.independentVariantCount ?? target.variantCount) === 1 || j.limitedTargets?.[target.id];
  const possible = j.queue.filter(id => !limited(targetFor(plan, id)));
  if (!possible.length && j.phase !== 'practice') { j.blocked = 'limited-variants'; j.current = null; return session; }
  if (plan.kind !== 'verb' && session.mode !== 'review' && ['practice', 'checkpoint'].includes(j.phase) && (j.writtenRun || 0) >= 2) {
    const candidates = targets(chapter).filter(target => inCurrentSection(chapter,session,target) && available(target) && !target.supplementalOnly && !target.guidedOnly
      && !Object.hasOwn(j.skipped, target.id) && groups(chapter).indexOf(groupFor(chapter, target.id)) <= j.groupIndex);
    // Prefer a different taught form, keeping the next independent item cold.
    const waiting = targetFor(plan, possible[0] || j.queue[0]);
    candidates.sort((a, b) => Number(answersFor(session, a, 'guided').some(answer => answersFor(session, waiting).includes(answer)))
      - Number(answersFor(session, b, 'guided').some(answer => answersFor(session, waiting).includes(answer)))
      || Number(j.queue.includes(a.id)) - Number(j.queue.includes(b.id)) || (j.lastAnswered[a.id] ?? -1) - (j.lastAnswered[b.id] ?? -1));
    if (candidates.length) {
      const target = candidates[0], group = groupFor(chapter, target.id), round = j.varietyRound || 0;
      const matchable = taughtTargets(group).filter(t => !t.guidedOnly && ['conjugation', 'address', 'progressive'].includes(t.skill) && Number.isInteger(t.person));
      const format = round % 3 === 2 && plan.kind === 'verb' && matchable.length >= 3 && matchable.some(t => t.id === target.id) ? 'pairs' : round % 3 === 0 ? 'mc' : 'letters';
      j.varietyRound = round + 1; j.writtenRun = 0;
      setQuestion(plan, session, target, 'guided', { supplemental: true, activityFormat: format });
      return session;
    }
  }
  const next = j.queue.findIndex(id => !limited(targetFor(plan, id)) && !exposed(session, targetFor(plan, id), 'independent', exposureGap));
  if (next >= 0) { setQuestion(plan, session, targetFor(plan, j.queue.splice(next, 1)[0]), 'independent'); return session; }
  // The group practice pass can leave exposed forms for the later checkpoint.
  // Advancing to the next teaching group gives a real gap without repeatedly
  // cycling through support prompts on already-taught material.
  if (plan.kind === 'verb' && j.phase === 'practice') return finishPass(plan, session, learning, now);
  // A focused review can use a different person or skill as a brief contrast.
  // These are supported activities, not extra completion requirements.
  const alternatives = targets(chapter).filter(target => inCurrentSection(chapter,session,target) && available(target) && reviewAllowed(target) && !j.queue.includes(target.id)
    && !Object.hasOwn(j.skipped, target.id) && !exposed(session, target, 'guided', exposureGap)
    && !j.queue.some(id => answersFor(session, target, 'guided').some(answer => answersFor(session, targetFor(plan, id)).includes(answer)))
    && (session.mode === 'review' || groups(chapter).indexOf(groupFor(chapter, target.id)) <= j.groupIndex));
  alternatives.sort((a, b) => Number(!!b.supplementalOnly) - Number(!!a.supplementalOnly)
    || (j.lastAnswered[a.id] ?? -1) - (j.lastAnswered[b.id] ?? -1));
  if (alternatives.length) { setQuestion(plan, session, alternatives[0], 'guided', { supplemental: true,
    activityFormat: plan.kind === 'verb' ? alternatives[0].supplementalOnly ? 'mc' : 'letters' : null }); return session; }
  // A final choice can expose every queued form. Use two other already-taught
  // people as short supported contrasts while keeping the first target cold.
  // Their queue positions remain intact, and support never gains mastery.
  const waiting = targetFor(plan, possible[0] || j.queue[0]);
  const waitingAnswers = answersFor(session, waiting);
  const contrasts = targets(chapter).filter(target => inCurrentSection(chapter,session,target) && available(target) && reviewAllowed(target) && target.id !== waiting.id
    && !Object.hasOwn(j.skipped, target.id)
    && (session.mode === 'review' || groups(chapter).indexOf(groupFor(chapter, target.id)) <= j.groupIndex)
    && (j.lastAnswered[target.id] === undefined || session.index - j.lastAnswered[target.id] >= exposureGap)
    && !answersFor(session, target, 'guided').some(answer => waitingAnswers.includes(answer)));
  contrasts.sort((a, b) => (j.lastAnswered[a.id] ?? -1) - (j.lastAnswered[b.id] ?? -1));
  if (contrasts.length) { setQuestion(plan, session, contrasts[0], 'guided', { supplemental: true,
    activityFormat: plan.kind === 'verb' ? contrasts[0].supplementalOnly ? 'mc' : 'letters' : null }); return session; }
  // Early groups may defer their checks to the chapter checkpoint after all
  // forms have been taught. At the checkpoint a lack of safe content is an
  // explicit pause/skip decision, never an automatic completion or retry cap.
  if (j.phase === 'practice') return finishPass(plan, session, learning, now);
  j.blocked = 'more-context-needed'; j.current = null;
  return session;
}

function wordSlots(plan) { return plan.wordLesson?.slots || []; }
function validWordCompletion(plan,session,learning,slot,eventId) {
  const event=learning?.events?.[eventId];
  const override=completionRecord(learning,plan.entryId,'word');
  return !!event&&(!override || override.checked || event.at>override.at)&&event.epochId===learning.epoch?.id&&event.contentVersion===plan.version&&event.wordPolicy==='word-short-v1'&&event.wordSlotId===slot.id&&event.sessionId===session.id&&event.objectiveId===slot.targetId&&event.ok;
}
function wordLocation(plan, targetId) {
  for (const chapter of plan.chapters || []) {
    const groupIndex = groups(chapter).findIndex(group => group.targets?.some(target => target.id === targetId));
    if (groupIndex >= 0) return { chapter, groupIndex };
  }
  return null;
}
function startWordSlot(plan, session, learning = null) {
  const j=session.journey, word=j.wordShort;
  // A backup can retain a cursor after its referenced event was removed or
  // replaced. Recheck completion against the same evidence used by progress,
  // so retry/continue can recover without changing any immutable event.
  if(learning)for(const slot of wordSlots(plan))if(word.completed[slot.id]&&!validWordCompletion(plan,session,learning,slot,word.completed[slot.id]))delete word.completed[slot.id];
  const slot=wordSlots(plan).find(slot=>!word.completed[slot.id]&&!Object.hasOwn(word.skipped,slot.id));
  j.awaitingContinue=false;j.current=null;j.repairReturn=null;j.blocked=false;
  if(!slot){j.phase='recap';word.slotId=null;return session;}
  const location=wordLocation(plan,slot.targetId),target=targetFor(plan,slot.targetId);
  if(!location||!available(target)){j.phase='guided';j.blocked='word-content-unavailable';return session;}
  word.slotId=slot.id;j.chapterId=location.chapter.id;j.groupIndex=location.groupIndex;j.phase='guided';
  setQuestion(plan,session,target,'guided',{activityFormat:slot.format||'mc'});
  j.current.variant=slot.variant;
  return session;
}
function startWordTeaching(plan, session, learning = null) {
  const j=session.journey, ref=plan.wordLesson?.teaching?.[j.wordShort.teachingIndex];
  if(!ref)return startWordSlot(plan,session,learning);
  const chapter=plan.chapters.find(c=>c.id===ref.chapterId),groupIndex=groups(chapter).findIndex(g=>g.id===ref.groupId);
  const cardIndex=groups(chapter)[groupIndex]?.cards?.findIndex(c=>c.id===ref.cardId);
  if(!chapter||groupIndex<0||cardIndex<0)return startWordSlot(plan,session,learning);
  j.chapterId=chapter.id;j.groupIndex=groupIndex;j.cardIndex=cardIndex;j.current=null;j.phase='teach';j.awaitingContinue=false;j.blocked=false;
  return session;
}
export function upgradeShortWordSession(plan, oldSession, {now=Date.now()}={}) {
  if(plan.kind!=='word'||!plan.wordLesson||oldSession?.journey?.wordShort||!compatible(plan,oldSession))return oldSession;
  const session=copy(oldSession),j=session.journey;
  j.legacyWordCursor={chapterId:j.chapterId,groupIndex:j.groupIndex,cardIndex:j.cardIndex,phase:j.phase,current:j.current,queue:j.queue,awaitingContinue:j.awaitingContinue,skipped:copy(j.skipped),deferred:copy(session.deferred)};
  j.wordShort={version:1,teachingIndex:0,slotId:null,completed:{},skipped:{}};
  j.focusTargetId=null;j.queue=[];j.current=null;j.awaitingContinue=false;j.lastAttempt=null;j.repairReturn=null;
  session.objectiveIds=[...new Set(wordSlots(plan).map(slot=>slot.targetId))];
  for(const id of session.objectiveIds){delete session.deferred[id];delete j.skipped[id];}
  startWordTeaching(plan,session);
  return changed(session,now);
}
function advanceShortWord(plan, oldSession, learning, now) {
  const session=copy(oldSession),j=session.journey,word=j.wordShort;
  if(j.phase==='teach'){word.teachingIndex++;startWordTeaching(plan,session,learning);}
  else if(j.phase==='recap'){j.phase='complete';j.current=null;}
  else if(j.phase==='repair-teach'){
    const slot=wordSlots(plan).find(slot=>slot.id===word.slotId);
    if(slot){j.phase='repair';setQuestion(plan,session,targetFor(plan,slot.targetId),'repair',{activityFormat:'mc',repairTag:j.lastAttempt?.errorTags?.[0]||'meaning'});j.current.variant=slot.variant;}
  }else if(j.awaitingContinue){
    j.awaitingContinue=false;
    if(!j.lastAttempt?.ok){j.phase='repair-teach';}
    else startWordSlot(plan,session,learning);
  }
  return changed(session,now);
}

export function createJourneySession({ id, plan, learning = null, now = Date.now(), mode = 'lesson', chapterId = null, targetId = null, caseMode = false }) {
  const chapter = targetId ? plan.chapters?.find(c => targets(c).some(t => t.id === targetId))
    : plan.chapters?.find(c => c.id === chapterId) || plan.chapters?.find(c => !c.optional && (mode !== 'review' || targets(c).some(required))) || plan.chapters?.[0];
  const session = createSession({ id, entryId: plan.entryId, objectiveIds: allTargets(plan).filter(available).map(target => target.id), now, mode });
  session.journey = { ...(plan.flowVersion===2?{verbFlowVersion:2}:{}),version: JOURNEY_VERSION, planVersion: plan.version, chapterId: chapter?.id || null, groupIndex: 0, cardIndex: 0,
    phase: 'teach', current: null, queue: [], serial: 0, variants: {}, lastAnswered: {}, failures: {}, skipped: {}, covered: {},
    awaitingContinue: false, lastAttempt: null, repairReturn: null, focusTargetId: targetId || null, blocked: false, limitedTargets: {}, personRepairs: {}, caseMode: !!caseMode, caseCursors: {}, redoStartIndex: null };
  if (!chapter) session.journey.phase = 'complete';
  else if (mode === 'review') startPass(plan, session, learning, 'review', eligibleTargets(plan, session).map(target => target.id), now);
  else startGroup(plan, session, learning, now);
  return plan.kind==='word'&&plan.wordLesson ? upgradeShortWordSession(plan,session,{now}) : session;
}

export function currentJourneyStep(plan, session, learning = null, now = Date.now()) {
  if (!compatible(plan, session) || (learning?.version > LEARNING_VERSION)) return { type: 'unavailable', reason: 'version-mismatch' };
  const j = session.journey, chapter = chapterFor(plan, session);
  let target = targetFor(plan, j.current?.targetId);
  if(target&&j.wordShort){const slot=wordSlots(plan).find(s=>s.id===j.wordShort.slotId);target={...target,shortWord:true,wordSlotId:j.wordShort.slotId,wordPairTargets:(slot?.pairTargetIds||[]).map(id=>targetFor(plan,id)).filter(Boolean)};}
  const group = target ? groupFor(chapter, target.id) : groups(chapter)[j.groupIndex];
  const base = { chapter, group, target, awaitingContinue: j.awaitingContinue, phase: j.current?.phase || j.phase,
    scenePolicy: j.current?.scenePolicy,
    ...(j.current || {}), helpSuggested: !!target && (j.failures[target.id] || 0) >= 2 };
  if (j.phase === 'complete') return { ...base, type: 'complete' };
  if (!chapter) return { ...base, type: 'unavailable', reason: 'chapter-unavailable' };
  if (j.blocked) return { ...base, target: targetFor(plan, j.queue[0]), type: 'blocked', reason: j.blocked, progress: journeyProgress(plan, session, learning, now) };
  if (j.phase === 'recap') return { ...base, type: 'recap', progress: journeyProgress(plan, session, learning, now) };
  if (j.phase === 'teach') return { ...base, type: 'teach', card: group?.cards?.[j.cardIndex] || null };
  if (session.mode === 'review' && target?.flowVersion === 2 && !reviewTargetAllowed(plan,session,learning,chapter,target,now))
    return { ...base, type: 'unavailable', reason: 'review-target-not-learned' };
  if (j.phase === 'repair-teach') return { ...base, phase: 'repair', type: 'repair', repairTag: j.lastAttempt?.errorTags?.[0] || 'uncertain' };
  if (!target) return { ...base, type: 'unavailable', reason: 'target-unavailable' };
  return { ...base, type: 'question' };
}

// Imported and saved review cursors can retain a prompt that predates a content
// update. Replace only an ineligible v2 prompt; retain the session and evidence.
export function reconcileJourneyReview(plan, oldSession, learning, { now = Date.now() } = {}) {
  if(!learning||!compatible(plan,oldSession)||oldSession.mode!=='review'||learning.version>LEARNING_VERSION)return oldSession;
  const chapter=chapterFor(plan,oldSession),target=targetFor(plan,oldSession.journey.current?.targetId);
  if(!chapter||!target?.flowVersion||reviewTargetAllowed(plan,oldSession,learning,chapter,target,now))return oldSession;
  const session=copy(oldSession),j=session.journey;
  j.current=null;j.awaitingContinue=false;j.lastAttempt=null;j.repairReturn=null;j.blocked=false;j.phase='review';
  j.queue=j.focusTargetId===target.id?[]:j.queue.filter(id=>id!==target.id);
  schedule(plan,session,learning,now);
  return changed(session,now);
}

export function advanceJourney(plan, oldSession, learning, { now = Date.now() } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION) return oldSession;
  if(oldSession.journey.wordShort)return advanceShortWord(plan,oldSession,learning,now);
  const session = copy(oldSession), j = session.journey, chapter = chapterFor(plan, session);
  if (j.phase === 'teach') {
    const group = groups(chapter)[j.groupIndex];
    j.cardIndex++;
    if (j.cardIndex >= (group?.cards || []).length) startPass(plan, session, learning, group?.finalReview?'checkpoint':'guided', taughtTargets(group).map(target => target.id), now);
  } else if (j.phase === 'repair-teach') {
    j.phase = 'repair';
    setQuestion(plan, session, targetFor(plan, j.current.targetId), 'repair', { repairTag: j.lastAttempt?.errorTags?.[0] || 'uncertain', supplemental: j.current.supplemental });
  } else if (j.phase === 'recap') {
    // The only way beyond a recap with unfinished forms is the learner's
    // explicit continue action. Keep those forms pending for a later visit.
    for (const target of targets(chapter).filter(required)) if (!readyForRun(learning, target, session, now)) {
      j.skipped[target.id] = now; session.deferred[target.id] = now;
    }
    const index = plan.chapters.findIndex(c => c.id === j.chapterId);
    const next = session.mode !== 'review' && !j.caseMode && plan.chapters.slice(index + 1).find(c => !c.optional);
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
      } else if (plan.kind === 'verb' && j.phase === 'guided' && current.format === 'pairs' && !current.supplemental) {
        // One successful board has already asked for three forms. Keep one
        // letter activity in the first matching group for format variety,
        // then let later boards replace their separate guided questions.
        const group = groupFor(chapter, current.targetId);
        const matching = g => taughtTargets(g).filter(t => !t.guidedOnly
          && ['conjugation', 'address', 'progressive'].includes(t.skill) && Number.isInteger(t.person));
        const firstMatchingGroup = groups(chapter).find(g => matching(g).length >= 3);
        const letterTargetId = group === firstMatchingGroup ? matching(group)[2]?.id : null;
        const matched = new Set(j.pairMatches?.[current.questionId] || []);
        j.queue = j.queue.filter(id => id === letterTargetId || !matched.has(id) || j.pairRepairs?.[id]);
      } else if (!current.supplemental && ((j.phase === 'review' && !reviewed(learning, targetFor(plan, current.targetId), session, now))
        || (j.phase === 'checkpoint' && !readyForRun(learning, targetFor(plan, current.targetId), session, now)))) j.queue.push(current.targetId);
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
  // Decoy rows on a word's article board are matched in the activity only; the
  // board is complete once every evidence-bearing row was recorded.
  if (question.type === 'pairs' && grade.ok && !question.pairs?.filter(pair => !pair.decoy).every(pair => j.pairMatches?.[current.questionId]?.includes(pair.targetId))) return null;
  const help = [...new Set([...assistance.filter(x => typeof x === 'string'), ...(question.type === 'letters' ? ['letter-bank'] : question.type === 'pairs' ? ['matching'] : [])])];
  const independent = current.phase === 'independent' && question.type === 'type' && question.meta?.mode !== 'recognition';
  return { id: current.questionId, sessionId: session.id, index: session.index, at: now,
    policy: 'journey-v1', targetId: target.id, objectiveId: target.id, entryId: plan.entryId, kind: plan.kind,
    chapterId: chapter.id, contentVersion: plan.version, role: question.meta?.role || target.role || null,
    skill: question.meta?.skill || target.skill, tense: target.tense || chapter.tense || null, person: question.meta?.person ?? target.person ?? null,
    activityKind: current.phase, mode: independent ? 'production' : 'recognition',
    variantId: text(question.meta?.variantId), contextId: text(question.meta?.contextId),
    ...(question.meta?.contextPolicy?{contextPolicy:question.meta.contextPolicy}:{}),
    ...(Number.isInteger(question.meta?.variantCount) ? { availableVariants: question.meta.variantCount } : {}),
    ok: grade.ok === true, outcome: grade.outcome || (grade.ok ? 'correct' : 'incorrect'), assistance: help, firstAttempt: true,
    errorTags: grade.errorTags || [], components: grade.components || [],
    ...(j.wordShort ? {wordPolicy:'word-short-v1',wordSlotId:j.wordShort.slotId,mode:'recognition',activityKind:current.phase==='repair'?'repair':'guided'} : {}),
  };
}

// A match records the selected person's evidence immediately, while the board
// stays current. Its single completion event owns XP; sub-attempts cannot farm it.
export function journeyPairAttempt(plan, session, question, grade, { targetId, attempt = 0, now = Date.now() } = {}) {
  if (!compatible(plan, session) || session.journey.awaitingContinue || session.journey.current?.format !== 'pairs' || question?.type !== 'pairs' || !grade || !integer(attempt)) return null;
  const current = session.journey.current, pair = question.pairs?.find(row => row.targetId === targetId), target = targetFor(plan, targetId), chapter = chapterFor(plan, session);
  const group = groupFor(chapter, current.targetId);
  // A decoy row (another noun's article on the word's board) belongs to the
  // activity, not to this word's evidence. The result carries no objective, so
  // the learning log rejects it and nothing is recorded for either noun.
  if (pair?.decoy) return { id: `${current.questionId}:pair:${encodeURIComponent(targetId)}:${attempt}`, sessionId: session.id, index: session.index, at: now,
    decoy: true, objectiveId: null, entryId: plan.entryId, ok: grade.ok === true, outcome: grade.outcome || (grade.ok ? 'correct' : 'incorrect'), assistance: ['matching'], errorTags: [], components: [], xp: 0, countStats: false };
  if (!pair || !target || !group?.targets?.some(t => t.id === targetId) || session.journey.pairMatches?.[current.questionId]?.includes(targetId)) return null;
  return { id: `${current.questionId}:pair:${encodeURIComponent(targetId)}:${attempt}`, sessionId: session.id, index: session.index, at: now,
    policy: 'journey-v1', targetId, objectiveId: targetId, entryId: plan.entryId, kind: plan.kind,
    chapterId: chapter.id, contentVersion: plan.version, role: question.meta?.role || target.role || null,
    skill: pair.meta?.skill || target.skill, tense: target.tense || chapter.tense || null, person: pair.meta?.person ?? target.person ?? null,
    activityKind: 'guided', mode: 'recognition', variantId: text(pair.meta?.variantId), contextId: text(pair.meta?.contextId),
    ok: grade.ok === true, outcome: grade.outcome || (grade.ok ? 'correct' : 'incorrect'), assistance: ['matching'], firstAttempt: attempt === 0,
    errorTags: grade.errorTags || [], components: grade.components || [], xp: 0, countStats: false,
  };
}

export function recordJourneyPairAttempt(plan, oldSession, event, result) {
  if (!compatible(plan, oldSession) || !event || event.decoy || oldSession.journey.current?.format !== 'pairs' || oldSession.journey.awaitingContinue
    || oldSession.answeredEventIds.includes(event.id)) return oldSession;
  const recovery = recoverStoredAttempt(event, result);
  if (!recovery) return oldSession;
  ({ event, result } = recovery);
  const current = oldSession.journey.current, target = targetFor(plan, event.objectiveId), chapter = chapterFor(plan, oldSession);
  if (!target || event.sessionId !== oldSession.id || event.entryId !== plan.entryId || event.policy !== 'journey-v1'
    || !groupFor(chapter, current.targetId)?.targets?.some(t => t.id === target.id)
    || !event.id.startsWith(`${current.questionId}:pair:${encodeURIComponent(target.id)}:`) || event.mode !== 'recognition') return oldSession;
  const session = applySessionAttempt(oldSession, event, result), j = session.journey;
  j.lastAnswered[target.id] = session.index;
  if (event.ok) {
    const matched = (j.pairMatches ||= {})[current.questionId] ||= [];
    if (!matched.includes(target.id)) matched.push(target.id);
  } else {
    j.failures[target.id] = (j.failures[target.id] || 0) + 1;
    (j.pairRepairs ||= {})[target.id] = { id: event.id, targetId: target.id, variant: current.variant, errorTags: event.errorTags || [] };
    const person = result?.skill?.unresolvedErrors?.find(error => error.person !== undefined)?.person;
    if (person !== undefined) (j.personRepairs ||= {})[target.id] = person;
  }
  session.activeObjectiveId = current.targetId;
  return session;
}

// Saving the immutable event and the resumable cursor are separate writes. If
// a reload happens between them, replay only the already-stored canonical event
// into the missing cursor state. The store still awards no second XP or stats.
function recoverStoredAttempt(event, result) {
  if (result?.added !== false) return { event, result };
  const learning = result?.learning, stored = learning?.events?.[event.id];
  if (!stored || learning.version > LEARNING_VERSION || stored.epochId !== learning.epoch?.id
    || stored.sessionId !== event.sessionId || stored.objectiveId !== event.objectiveId) return null;
  return { event: stored, result: { ...result, added: true, skill: skillState(learning, stored.objectiveId, stored.at) } };
}

export function recordJourneyAttempt(plan, oldSession, event, result) {
  if (!compatible(plan, oldSession) || !event || event.id !== oldSession.journey.current?.questionId
    || oldSession.answeredEventIds.includes(event.id)) return oldSession;
  const recovery = recoverStoredAttempt(event, result);
  if (!recovery) return oldSession;
  ({ event, result } = recovery);
  if (event.sessionId !== oldSession.id || event.entryId !== plan.entryId || event.objectiveId !== oldSession.journey.current.targetId || event.policy !== 'journey-v1') return oldSession;
  const session = applySessionAttempt(oldSession, event, result), j = session.journey;
  j.awaitingContinue = true;
  j.lastAttempt = { id: event.id, targetId: event.objectiveId, variant: j.current.variant, ok: event.ok, outcome: event.outcome, errorTags: event.errorTags || [],
    ...(j.current.scenePolicy ? { scenePolicy: j.current.scenePolicy } : {}) };
  j.lastAnswered[event.objectiveId] = session.index;
  if(j.wordShort&&event.wordPolicy==='word-short-v1'&&event.wordSlotId===j.wordShort.slotId&&event.ok)j.wordShort.completed[event.wordSlotId]=event.id;
  // An answer copied from support has not tried this variant independently.
  // Retry that same useful context after a gap rather than letting scheduling
  // parity strand every credited answer on the other variant forever.
  if (event.activityKind === 'independent' && event.ok && event.assistance?.length) j.variants[event.objectiveId].independent = j.current.variant;
  const personError = result?.skill?.unresolvedErrors?.find(error => error.person !== undefined);
  if (personError) (j.personRepairs ||= {})[event.objectiveId] = personError.person;
  else if (j.personRepairs) delete j.personRepairs[event.objectiveId];
  if (event.activityKind === 'independent' && event.availableVariants === 1) (j.limitedTargets ||= {})[event.objectiveId] = true;
  if (!event.ok) j.failures[event.objectiveId] = (j.failures[event.objectiveId] || 0) + 1;
  if (event.mode === 'production') j.writtenRun = (j.writtenRun || 0) + 1;
  else if (['mc', 'pairs', 'letters'].includes(j.current.format)) j.writtenRun = 0;
  session.activeObjectiveId = j.current.targetId;
  return session;
}

export function skipJourneyTarget(plan, oldSession, targetId = null, { now = Date.now(), learning = null } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION) return oldSession;
  const session = copy(oldSession), j = session.journey;
  if(j.wordShort){
    if(j.phase==='teach'){j.wordShort.teachingIndex++;startWordTeaching(plan,session,learning);}
    else {const slot=wordSlots(plan).find(slot=>slot.id===j.wordShort.slotId);if(slot){j.wordShort.skipped[slot.id]=now;session.deferred[slot.targetId]=now;j.skipped[slot.targetId]=now;}startWordSlot(plan,session,learning);}
    return changed(session,now);
  }
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

const cursorKeys = ['verbFlowVersion','legacyFlow','checkpointNextGroup', 'chapterId', 'groupIndex', 'cardIndex', 'phase', 'queue', 'current', 'awaitingContinue', 'lastAttempt', 'repairReturn', 'focusTargetId', 'blocked', 'redoStartIndex'];
export function chooseJourneyChapter(plan, oldSession, chapterId, { now = Date.now(), learning = null, redo = false, restart = false } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION || !plan.chapters.some(c => c.id === chapterId)) return oldSession;
  if(oldSession.journey.wordShort){const session=copy(oldSession),index=plan.wordLesson.teaching.findIndex(ref=>ref.chapterId===chapterId);session.journey.wordShort.teachingIndex=index<0?plan.wordLesson.teaching.length:index;startWordTeaching(plan,session,learning);return changed(session,now);}
  const session = copy(oldSession), j = session.journey;
  if (j.chapterId === chapterId && !redo && !restart && !['recap', 'complete'].includes(j.phase)) return changed(session, now);
  const cursors = j.caseCursors ||= {};
  if (j.chapterId) cursors[j.chapterId] = Object.fromEntries(cursorKeys.filter(key => j[key] !== undefined).map(key => [key, copy(j[key])]));
  const saved = cursors[chapterId];
  if (!redo && !restart && saved && !['recap', 'complete'].includes(saved.phase)) {
    Object.assign(j, saved);
    if(saved.legacyFlow)delete j.verbFlowVersion;
    session.activeObjectiveId = j.current?.targetId || null;
    return changed(session, now);
  }
  j.chapterId = chapterId; j.groupIndex = 0; j.checkpointNextGroup=null; j.focusTargetId = null; j.awaitingContinue = false; j.repairReturn = null;
  j.lastAttempt = null; j.blocked = false; j.redoStartIndex = redo ? session.index : null;
  delete cursors[chapterId];
  for (const target of targets(chapterFor(plan, session))) { delete j.skipped[target.id]; delete session.deferred[target.id]; }
  if (session.mode === 'review') startPass(plan, session, learning, 'review', eligibleTargets(plan, session).map(t => t.id), now);
  else {
    const chapter=chapterFor(plan,session);
    if(!redo&&chapter?.flowVersion===2){const pending=groups(chapter).findIndex(g=>g.targets?.some(t=>required(t)&&!readyForRun(learning,t,session,now)));if(pending>=0)j.groupIndex=pending;}
    startGroup(plan, session, learning, now);
  }
  return changed(session, now);
}

export function retryJourneyPending(plan, oldSession, learning, { now = Date.now() } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION) return oldSession;
  const session = copy(oldSession), j = session.journey;
  if(j.wordShort){j.wordShort.skipped={};for(const slot of wordSlots(plan)){delete session.deferred[slot.targetId];delete j.skipped[slot.targetId];}startWordSlot(plan,session,learning);return changed(session,now);}
  const pending = targets(chapterFor(plan, session)).filter(target => (j.focusTargetId ? available(target) && !target.supplementalOnly && !target.guidedOnly : required(target))
    && (!j.focusTargetId || target.id === j.focusTargetId)
    && (session.mode === 'review' ? !reviewed(learning, target, session, now) : !readyForRun(learning, target, session, now)));
  for (const target of pending) { delete j.skipped[target.id]; delete session.deferred[target.id]; }
  const chapter=chapterFor(plan,session);
  if(session.mode!=='review'&&chapter?.flowVersion===2){
    const first=groups(chapter).findIndex(g=>g.targets?.some(t=>pending.some(p=>p.id===t.id)));
    j.groupIndex=Math.max(0,first);j.checkpointNextGroup=null;startGroup(plan,session,learning,now);
  }else startPass(plan, session, learning, session.mode === 'review' ? 'review' : 'checkpoint', pending.map(target => target.id), now);
  return changed(session, now);
}

// UI can postpone an independent prompt whose exact answer appears elsewhere on
// screen. The postponed prompt does not produce a wrong answer, XP, or a lapse.
export function deferJourneyTarget(plan, oldSession, learning, { now = Date.now() } = {}) {
  if (!compatible(plan, oldSession) || learning?.version > LEARNING_VERSION || !oldSession.journey.current || oldSession.journey.awaitingContinue) return oldSession;
  if(oldSession.journey.wordShort)return oldSession; // Recognition intentionally keeps its visible choices.
  const session = copy(oldSession), j = session.journey, id = j.current.targetId;
  j.lastAnswered[id] = session.index;
  if (!j.current.supplemental) j.queue.push(id);
  j.current = null;
  schedule(plan, session, learning, now);
  return changed(session, now);
}

export function journeyProgress(plan, session, learning = null, now = Date.now()) {
  if(session?.journey && Object.hasOwn(session.journey,'wordShort'))return shortWordProgress(plan,session,learning,now);
  const chapters = (plan.chapters || []).map(chapter => {
    const states = targets(chapter).filter(required).map(target => ({ target, ...journeyTargetState(learning, target, now),
      ...(session?.journey?.chapterId === chapter.id && (session.journey.redoStartIndex != null || completionRecord(learning,plan.entryId,chapter.id)?.checked) ? { ready: readyForRun(learning, target, session, now) } : {}),
      skipped: !!session?.journey?.skipped?.[target.id] }));
    const ready = states.filter(state => state.ready).length;
    return { id: chapter.id, title: chapter.title, optional: !!chapter.optional, targets: states, total: states.length, ready,
      remembered: states.filter(state => state.remembered).length, pending: states.filter(state => !state.ready),
      covered: !!session?.journey?.covered?.[chapter.id], complete: states.length ? ready === states.length : !!session?.journey?.covered?.[chapter.id] };
  });
  return { chapters, currentChapterId: session?.journey?.chapterId || null, complete: plan.kind === 'verb' && coreJourneyChapters(plan).length === CORE_JOURNEY_CASES.length ? journeyCaseProgress(plan, learning, session, now).complete : chapters.filter(c => !c.optional).every(c => c.complete),
    covered: chapters.filter(c => !c.optional).every(c => c.covered), pending: chapters.flatMap(c => c.pending) };
}

function shortWordProgress(plan,session,learning,now) {
  // Progress is also rendered beside the unavailable screen. Do not execute an
  // imported cursor rejected by currentJourneyStep, or fall back to legacy
  // mastery when its short-word state is malformed. Leave the payload intact.
  const valid=record(session.journey.wordShort) && compatible(plan,session) && !(learning?.version>LEARNING_VERSION);
  const word=valid?session.journey.wordShort:{completed:{},skipped:{}};
  const slots=wordSlots(plan).map(slot=>{
    const done=validWordCompletion(plan,session,learning,slot,word.completed[slot.id]);
    return {...slot,target:targetFor(plan,slot.targetId),ready:done,completed:done,supportedCompletion:true,skipped:Object.hasOwn(word.skipped,slot.id)};
  });
  const chapters=plan.chapters.map(chapter=>{
    const ids=new Set(targets(chapter).map(t=>t.id)),states=slots.filter(slot=>ids.has(slot.targetId));
    return {id:chapter.id,title:chapter.title,optional:!states.length,targets:states,total:states.length,ready:states.filter(s=>s.completed).length,remembered:0,pending:states.filter(s=>!s.completed),covered:valid&&!!session.journey.covered[chapter.id],complete:valid&&states.every(s=>s.completed)};
  });
  return {wordShort:true,unavailable:!valid,chapters,currentChapterId:valid?session.journey.chapterId:null,total:slots.length,answered:slots.filter(s=>s.completed).length,
    complete:valid&&slots.length>0&&slots.every(s=>s.completed),covered:valid&&['recap','complete'].includes(session.journey.phase),pending:slots.filter(s=>!s.completed),independentMastery:false};
}

// Intersect intervals rather than replaying the whole event log for each prefix.
// The first overlap proves that every required target was ready simultaneously.
function milestone(states) {
  if (!states.length || states.some(state => !state.readyPeriods?.length)) return null;
  const cursors = states.map(() => 0);
  while (cursors.every((cursor, i) => cursor < states[i].readyPeriods.length)) {
    const intervals = states.map((state, i) => state.readyPeriods[cursors[i]]);
    const start = Math.max(...intervals.map(period => period.start));
    const end = Math.min(...intervals.map(period => period.end ?? Infinity));
    if (start < end) return Math.max(...intervals.filter(period => period.start === start).map(period => period.at));
    intervals.forEach((period, i) => { if ((period.end ?? Infinity) === end) cursors[i]++; });
  }
  return null;
}
const caseCache = new WeakMap();
export function journeyChapterCompletions(plan, learning, now = Date.now()) {
  let cached = learning && caseCache.get(learning);
  if (!cached || cached.events !== learning?.events || cached.completions !== learning?.completions || cached.plan !== plan) {
    cached = { events: learning?.events, completions:learning?.completions, plan, cases: (plan?.chapters || []).filter(c=>!['meet','mixed'].includes(c.id)).map(chapter => {
      const states = targets(chapter).filter(required).map(target => journeyTargetState(learning, target, now));
      const core=CORE_JOURNEY_CASES.includes(chapter.id);
      const override = core ? completionRecord(learning,plan.entryId,chapter.id) : null;
      const evidence = core ? completionEvidence(learning,plan.entryId,chapter.id) : learning;
      const completionStates = evidence === learning ? states : targets(chapter).filter(required).map(target=>journeyTargetState(evidence,target,now));
      const available = targets(chapter).some(target => required(target) && !target.guidedOnly && !target.completionRequired);
      const demonstratedAt = available ? milestone(completionStates) : null;
      const historicalAt=chapter.legacyRequirements?milestone(chapter.legacyRequirements.filter(required).map(t=>journeyTargetState(evidence,t,now))):null;
      const completedAt = available && override?.checked ? override.at : demonstratedAt ?? historicalAt, ready = completedAt !== null;
      const updateAvailable=ready&&demonstratedAt===null&&!!chapter.flowVersion&&(!override?.checked&&historicalAt!==null||override?.checked&&override.flowVersion!==2);
      return { id: chapter.id, title: chapter.title, tense: chapter.tense, optional:!!chapter.optional, ready, completedAt,
        updateAvailable, source:ready && override?.checked ? override.source : ready ? 'lesson' : null, manual:override?.source === 'manual',
        available, exempt: !available, limitation: available ? null : 'This entry has no supported forms for this case in the current course.',
        started: states.some(state => state.attempts > 0), pending: states.filter(state => !state.ready).length,
        total: states.length, reviewNeeded: ready && states.some(state => !state.ready) };
    }) };
    if (learning) caseCache.set(learning, cached);
  }
  return cached.cases.map(item=>({...item}));
}
export function journeyCaseProgress(plan, learning, session = null, now = Date.now()) {
  const all=journeyChapterCompletions(plan,learning,now);
  const cases = CORE_JOURNEY_CASES.map(id=>all.find(c=>c.id===id)).filter(Boolean).map(item => {
    const cursor = session?.journey?.chapterId === item.id ? session.journey : session?.journey?.caseCursors?.[item.id];
    return { ...item, started: item.started || !!cursor && (cursor.groupIndex > 0 || cursor.cardIndex > 0 || cursor.phase !== 'teach') };
  });
  const completed = cases.filter(item => item.ready).length, total = cases.filter(item => !item.exempt).length;
  const complete = cases.length === CORE_JOURNEY_CASES.length && total > 0 && completed === total;
  return { cases, complete, completed, total, caseCount: CORE_JOURNEY_CASES.length, nextChapterId: cases.find(item => !item.ready && !item.exempt)?.id || null, mixedAvailable: complete && total > 0 };
}

// Completion of the short word lesson can be recovered from synced events even
// though its device-local cursor is intentionally omitted from cloud snapshots.
// A course lesson's vocabulary boards credit the same word only with the short
// lesson's own coverage: every distinct available slot target (meaning and recall
// always, article and plural when available) matched in one session, with no
// mismatch on that word in that session. The boards ask only those four skills,
// so an adjective's agreement targets stay with its own lesson and are not required.
const COURSE_BOARD_SKILLS = ['meaning','recall','article','plural'];
const courseMatchTargets = plan => [...new Set(wordSlots(plan).map(slot => slot.targetId))]
  .filter(id => { const target = targetFor(plan, id); return available(target) && COURSE_BOARD_SKILLS.includes(target?.skill); });
export function journeyWordCompletion(plan, learning) {
  const override = completionRecord(learning,plan.entryId,'word');
  if (override?.checked) return {complete:true,completedAt:override.at,source:override.source};
  const slots = wordSlots(plan), sessions = new Map(), boards = new Map(), missed = new Set();
  const matchTargets = courseMatchTargets(plan);
  for (const event of Object.values(learning?.events || {})) {
    if (event.entryId !== plan.entryId || event.contentVersion !== plan.version
      || event.epochId !== learning.epoch?.id || override && event.at <= override.at) continue;
    if (event.wordPolicy === 'word-lesson-match-v1') {
      if (!event.ok) { missed.add(event.sessionId); continue; }
      if (!matchTargets.includes(event.objectiveId)) continue;
      if (!boards.has(event.sessionId)) boards.set(event.sessionId,new Map());
      boards.get(event.sessionId).set(event.objectiveId,Math.max(event.at,boards.get(event.sessionId).get(event.objectiveId) || 0));
      continue;
    }
    if (!event.ok || event.wordPolicy !== 'word-short-v1') continue;
    const slot = slots.find(slot=>slot.id===event.wordSlotId && slot.targetId===event.objectiveId);
    if (!slot) continue;
    if (!sessions.has(event.sessionId)) sessions.set(event.sessionId,new Map());
    sessions.get(event.sessionId).set(slot.id,event.at);
  }
  for (const found of sessions.values()) if (slots.length && slots.every(slot=>found.has(slot.id)))
    return {complete:true,completedAt:Math.max(...found.values()),source:'lesson'};
  for (const [sessionId,found] of boards) if (matchTargets.length && !missed.has(sessionId) && matchTargets.every(id=>found.has(id)))
    return {complete:true,completedAt:Math.max(...found.values()),source:'course'};
  return {complete:false,completedAt:null,source:null};
}

// Upgrade only between screens. The view keeps an old active question (and its
// draft/feedback) on the old content until Continue; this function then moves
// to a compatible point without touching events, deferred work or manual marks.
export function upgradeVerbJourneySession(plan, oldSession, learning, {now=Date.now()}={}) {
  if(plan?.kind!=='verb'||plan.flowVersion!==2||!oldSession?.journey||oldSession.journey.verbFlowVersion===2||!compatible(plan,oldSession))return oldSession;
  const session=copy(oldSession),j=session.journey;
  session.verbFlowArchive ||= {journey:copy(j),ui:copy(session.ui||{})};
  j.verbFlowVersion=2;j.checkpointNextGroup=null;
  session.objectiveIds=allTargets(plan).filter(available).map(t=>t.id);
  const chapter=chapterFor(plan,session);
  if(chapter?.flowVersion===2){
    const oldTarget=j.current?.targetId,target=targetFor(plan,oldTarget);
    const oldGroup=groups(chapter)[j.groupIndex];
    const keepSimple=oldGroup?.stage==='forms'&&(!oldTarget||target&&!target.flowVersion)
      && !['recap','complete'].includes(j.phase);
    if(keepSimple){
      // Cursor ids for simple forms remain stable. Rebuild only the unanswered
      // next screen; saved evidence and the serial counter are unchanged.
      j.queue=j.queue.filter(id=>targetFor(plan,id));
      if(j.current&&!target){j.current=null;startGroup(plan,session,learning,now);}
    }else{
      const forms=groups(chapter).filter(g=>g.stage==='forms').flatMap(g=>g.targets||[]).filter(required);
      const pending=forms.filter(t=>!Object.hasOwn(j.skipped,t.id)&&!readyForRun(learning,t,session,now));
      j.current=null;j.awaitingContinue=false;j.lastAttempt=null;j.repairReturn=null;j.focusTargetId=null;
      if(pending.length){j.groupIndex=Math.max(0,groups(chapter).findIndex(g=>g.id==='progressive')-1);j.checkpointNextGroup=j.groupIndex+1;startPass(plan,session,learning,'checkpoint',pending.map(t=>t.id),now);}
      else {j.groupIndex=Math.max(0,groups(chapter).findIndex(g=>g.id==='progressive'));startGroup(plan,session,learning,now);}
    }
    session.flowUpdateNotice='Your earlier answers are saved. This lesson now includes verb-specific usage and a final review.';
  }
  j.legacyFlow=false;
  // Inactive drafts keep the exact old prompt until that case is opened. The
  // view restores its legacy plan, then upgrades at that question's Continue.
  for(const cursor of Object.values(j.caseCursors||{}))if(cursor.verbFlowVersion!==2)cursor.legacyFlow=true;
  return changed(session,now);
}

export function journeyStageProgress(plan,session,learning,now=Date.now()){
  const chapter=chapterFor(plan,session),j=session?.journey;
  if(plan?.kind!=='verb'||plan.flowVersion!==2||!chapter||!j)return null;
  if(chapter.flowVersion!==2){
    if(chapter.id==='meet')return [{id:'meet',label:'Meet the verb',current:true,done:false}];
    if(chapter.id==='mixed')return [{id:'review',label:'Mixed review',current:!['recap','complete'].includes(j.phase),done:['recap','complete'].includes(j.phase)}];
    const group=groups(chapter)[j.groupIndex],phase=j.repairReturn?.phase||j.phase;
    const active=phase==='checkpoint'||!group?'review':group.id==='use'?'use':'forms';
    const stages=[{id:'forms',label:'Learn the forms'},{id:'use',label:'Use in context'},{id:'review',label:'Review'}].filter(s=>s.id!=='use'||groups(chapter).some(g=>g.id==='use'));
    return stages.map((s,i)=>({...s,current:!['recap','complete'].includes(j.phase)&&s.id===active,done:i<stages.findIndex(s=>s.id===active)||['recap','complete'].includes(j.phase)}));
  }
  const group=groups(chapter)[j.groupIndex],active=group?.stage||'mixed';
  const progressive=groups(chapter).find(g=>g.stage==='progressive');
  const labels=[{id:'forms',label:chapter.id==='background'?'Past forms':'Present forms'},
    {id:'progressive',label:progressive?.targets.length?(chapter.id==='background'?'Happening then':'Happening now'):'Natural usage'},
    {id:'mixed',label:'Mixed review'}];
  return labels.map((item,index)=>{
    const ts=groups(chapter).filter(g=>g.stage===item.id).flatMap(g=>g.targets||[]).filter(required);
    const passed=index<labels.findIndex(s=>s.id===active)||['recap','complete'].includes(j.phase);
    const done=passed&&(ts.length?ts.every(t=>readyForRun(learning,t,session,now)):true);
    return {...item,done,deferred:passed&&!done,current:!['recap','complete'].includes(j.phase)&&item.id===active};
  });
}
