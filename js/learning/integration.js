// Route-level recommendations. Grammar readiness is independent of dictionary CEFR.
import { data, getEntry, itemsForScope } from '../data.js';
import { objectivesFor, allowedTenses, CORE_STAGES, ANCHOR_VERBS, stageObjectives } from './curriculum.js';
import { allSkills, skillState } from './model.js';

export function activeObjectives(entry, learning) {
  return objectivesFor(entry, learning.preferences || {});
}
function scopedEntries(store, kind = null) {
  return itemsForScope(store.scope, store, { kind }).filter(e => !store.current.customDeleted?.[e.id]);
}
export function eligibleSkills(store, now = Date.now()) {
  const allowed = new Set(allowedTenses(store.learning));
  const scopeIds = new Set(scopedEntries(store).map(e => e.id));
  const objectiveIds = new Map();
  return allSkills(store.learning, now).filter(s => {
    const entry = getEntry(s.entryId);
    if (!entry || !scopeIds.has(entry.id) || (s.tense && s.tense !== 'meaning' && !allowed.has(s.tense))) return false;
    if (!objectiveIds.has(entry.id)) objectiveIds.set(entry.id, new Set(activeObjectives(entry, store.learning).map(o => o.id)));
    return objectiveIds.get(entry.id).has(s.objectiveId);
  });
}
export function dueSkills(store, now = Date.now()) {
  return eligibleSkills(store, now).filter(s => s.due && s.due <= now).sort((a, b) => a.due - b.due || a.objectiveId.localeCompare(b.objectiveId));
}
export function reviewItems(store, now = Date.now()) {
  const skills = dueSkills(store, now);
  // Legacy evidence is deliberately not inflated into per-skill mastery. Items with
  // adaptive records use the skill queue; older items enter a fresh diagnostic loop.
  const known = new Set(allSkills(store.learning, now).map(s => s.entryId));
  const scopeIds = new Set(scopedEntries(store).map(e => e.id));
  return [...skills.map(s => ({ entry: getEntry(s.entryId), objectiveId: s.objectiveId, skill: s })),
    ...store.dueIds(now).filter(id => !known.has(id) && scopeIds.has(id)).map(id => ({ entry: getEntry(id), objectiveId: null })).filter(x => x.entry)];
}
export function practiceHref(entry, objectiveId = null, mode = 'lesson') {
  const query = new URLSearchParams();
  if (objectiveId) query.set('objective', objectiveId);
  if (mode !== 'lesson') query.set('mode', mode);
  return '#/learn/' + (entry.kind === 'verb' ? 'verb' : 'word') + '/' + encodeURIComponent(entry.id) + (query.size ? '?' + query : '');
}
export function recommend(store, { kind = null, review = false, now = Date.now(), excludeObjectives = [] } = {}) {
  const excluded = new Set(excludeObjectives);
  const due = reviewItems(store, now).filter(x => (!kind || x.entry.kind === kind) && !excluded.has(x.objectiveId));
  if (due.length) return { ...due[0], mode: 'review', reason: due[0].skill ? 'A skill is ready for another independent check.' : 'Check what you remember from an earlier lesson.' };
  if (review) {
    const eligible = eligibleSkills(store, now).filter(s => (!kind || s.kind === kind) && !excluded.has(s.objectiveId)).sort((a, b) => (a.due || Infinity) - (b.due || Infinity));
    if (eligible.length) return { entry: getEntry(eligible[0].entryId), objectiveId: eligible[0].objectiveId, mode: 'review', reason: 'Practice ahead of your next scheduled review.' };
  }
  const scope = scopedEntries(store, kind);
  const scopeIds = new Set(scope.map(e => e.id));
  const sessions = Object.values(store.learning.sessions || {}).flatMap(session => {
    if (!session || !scopeIds.has(session.entryId) || session.mode === 'review' || ['summary', 'complete'].includes(session.ui?.phase)) return [];
    const allowedIds = new Set(activeObjectives(getEntry(session.entryId), store.learning).map(o => o.id));
    const pending = (session.objectiveIds || []).filter(id => allowedIds.has(id) && !excluded.has(id) && !Object.hasOwn(session.deferred || {}, id)
      && (session.mode === 'checkpoint' || !skillState(store.learning, id, now).ready));
    if (!pending.length) return [];
    return [{ session, pending }];
  });
  sessions.sort((a, b) => b.session.updatedAt - a.session.updatedAt);
  if (sessions.length) {
    const { session, pending } = sessions[0];
    const active = pending.includes(session.activeObjectiveId) ? session.activeObjectiveId : pending[0];
    // A full unchanged session can resume as a unit. If a stage/skip choice made
    // part of it ineligible, link directly to the remaining active objective so
    // reopening the entry cannot silently reinsert a deferred or disabled step.
    const focused = session.objectiveIds.length === 1 || pending.length !== session.objectiveIds.length;
    return { entry: getEntry(session.entryId), objectiveId: focused ? active : null, session, mode: session.mode, reason: 'Continue your unfinished practice.' };
  }
  // A finite foundation path comes before open-ended dictionary discovery. Never
  // silently leave the user's scope: outside-scope milestones are explicit links.
  if (kind !== 'word') {
    const stage = store.learning.preferences?.stage || 'present';
    const checkpoints = stageObjectives(scope.filter(e => e.kind === 'verb'), stage);
    for (const objective of checkpoints) {
      if (excluded.has(objective.id)) continue;
      const state = skillState(store.learning, objective.id, now);
      const covered = !objective.personsRequired || objective.personsRequired.every(p => state.independentPersons?.includes(p));
      if (!state.ready || !covered) {
        const entry = getEntry(objective.entryId);
        const meaning = activeObjectives(entry, store.learning).find(o => o.tense === 'meaning');
        if (meaning && !excluded.has(meaning.id) && !store.isLearned(entry.id) && !skillState(store.learning, meaning.id, now).ready)
          return { entry, objectiveId: meaning.id, mode: 'lesson', reason: 'Start with this foundation verb’s meaning, then build its forms.' };
        return { entry, objectiveId: objective.id, mode: 'checkpoint', reason: 'Build a foundation skill with varied checks across the required forms.' };
      }
    }
  }
  const anchors = new Map(ANCHOR_VERBS.map((name, i) => [name, i]));
  const candidates = scope.slice().sort((a, b) => (anchors.get(a.inf) ?? 100) - (anchors.get(b.inf) ?? 100));
  for (const entry of candidates) {
    const objectives = activeObjectives(entry, store.learning);
    const unfinished = objectives.find(o => o.required !== false && !excluded.has(o.id) && !skillState(store.learning, o.id, now).ready);
    if (unfinished) return { entry, objectiveId: unfinished.id, mode: 'lesson', reason: store.isLearned(entry.id) ? 'Build on this familiar item with a focused skill.' : 'One useful skill, with practice that adjusts to you.' };
  }
  return null;
}
export function courseProgress(store, now = Date.now()) {
  return CORE_STAGES.map(stage => {
    const objectives = stageObjectives(data.verbs, stage.id);
    const checkpoints = objectives.map(objective => {
      const state = skillState(store.learning, objective.id, now);
      const persons = state.independentPersons || [];
      const coverage = !(objective.personsRequired?.length) || objective.personsRequired.every(p => persons.includes(p));
      return { objective, state, ready: !!state.ready && coverage, remembered: !!state.remembered && coverage, coverage };
    });
    return { ...stage, checkpoints, ready: checkpoints.filter(c => c.ready).length, remembered: checkpoints.filter(c => c.remembered).length, total: checkpoints.length,
      complete: checkpoints.length > 0 && checkpoints.every(c => c.remembered) };
  });
}
