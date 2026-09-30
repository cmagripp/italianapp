// Route-level recommendations. Grammar readiness is independent of dictionary CEFR.
import { data, getEntry, itemsForScope } from '../data.js';
import { objectivesFor, allowedTenses, CORE_STAGES, EXPANSIONS, ANCHOR_VERBS, stageObjectives } from './curriculum.js';
import { allSkills, skillState, completionRecord } from './model.js';
import { buildLesson } from './lesson-content.js';
import { grammarReviewSkills, grammarLesson, grammarEntry, grammarHref } from './grammar-course.js';
import { currentJourneyStep, journeyProgress, journeyCaseProgress, journeyWordCompletion, journeyChapterCompletions } from './journey.js';
export { journeyCaseProgress, coreJourneyChapters } from './journey.js';

const lessonCache = new WeakMap();
export function lessonPlan(entry) {
  if (!entry) return null;
  if (!lessonCache.has(entry)) lessonCache.set(entry, buildLesson(entry));
  return lessonCache.get(entry);
}
export function lessonObjectives(entry) {
  return lessonPlan(entry)?.chapters.flatMap(c => c.groups.flatMap(g => g.targets.map(t => ({ ...t, entryId:entry.id,
    kind:entry.kind, chapterId:c.id, chapterTitle:c.title, optional:!!c.optional, label:learningLabel(t,c) })))) || [];
}
export function entryCompletion(entry, learning, item = null, now = Date.now()) {
  if (!entry) return {complete:false,cases:[]};
  const plan=lessonPlan(entry);
  if(entry.kind==='verb') {
    const progress=journeyCaseProgress(plan,learning,null,now);
    return {...progress,cases:progress.cases.map(c=>({...c,checked:c.ready}))};
  }
  const state=journeyWordCompletion(plan,learning), override=completionRecord(learning,entry.id,'word');
  return {...state,complete:state.complete || !override && !!item?.learned,cases:[]};
}
const chapterForTense = tense => ({presente:'present',presenteProgressivo:'present',passatoProssimo:'past',imperfetto:'background',imperfettoProgressivo:'background',futuro:'future',condizionale:'condizionale'}[tense]);
export function reviewableTenses(store, entry, now = Date.now()) {
  const selected=new Set(store.learning.preferences?.expansions || []);
  return journeyChapterCompletions(lessonPlan(entry),store.learning,now).filter(c=>c.ready && (!c.optional
    || EXPANSIONS.some(e=>selected.has(e.id)&&e.tenses.includes(c.tense)))).map(c=>c.tense);
}
function learningLabel(target, chapter) {
  const names = {meaning:'Meaning',recall:'Recall the word',article:'Articles',plural:'Plural',context:'Use in a sentence',agreement:'Agreement',listening:'Listening',address:'Formal you'};
  const people = ['io','tu','lui / lei','noi','voi','loro'];
  return `${chapter?.title || ''}${target.skill === 'conjugation' ? ` · ${people[target.person] || 'verb forms'}` : ` · ${names[target.skill] || 'Practice'}`}`;
}
export function skillLabel(entry, state) {
  if(entry.kind==='grammar'){const lesson=grammarLesson(entry.id);return (lesson?.targets || lesson?.objectives || []).find(o=>o.id===state?.objectiveId)?.label || 'Grammar';}
  return lessonObjectives(entry).find(o=>o.id===state?.objectiveId)?.label || ({meaning:'Meaning',recall:'Recall',article:'Articles',plural:'Plurals',conjugation:'Verb forms',auxiliary:'The auxiliary',participle:'Past participle',agreement:'Agreement',context:'Use in a sentence',listening:'Listening'}[state?.skill] || 'Practice');
}

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
  const completion = new Map();
  const status = entry => {if(!completion.has(entry.id))completion.set(entry.id,entryCompletion(entry,store.learning,store.current.items?.[entry.id],now));return completion.get(entry.id);};
  const evidenceSkills=allSkills(store.learning,now);
  const skills = evidenceSkills.filter(s => {
    const entry = getEntry(s.entryId);
    if (!entry || !scopeIds.has(entry.id)) return false;
    const journeyObjective = lessonObjectives(entry).find(o=>o.id===s.objectiveId);
    if(entry.kind==='verb') {
      // Mixed practice was offered only after the full core course. Keep that
      // boundary after an uncheck too, so its spacing contrasts cannot need an
      // unchecked tense or strand a single remaining mixed target.
      if(journeyObjective?.chapterId==='mixed' && !status(entry).complete)return false;
      const chapterId=journeyObjective?.sourceChapter || journeyObjective?.chapterId || chapterForTense(s.tense);
      const chapter=journeyChapterCompletions(lessonPlan(entry),store.learning,now).find(c=>c.id===chapterId || !chapterId && c.tense===s.tense);
      if(!chapter?.ready)return false;
      if(chapter.optional && !EXPANSIONS.some(e=>(store.learning.preferences?.expansions || []).includes(e.id)&&e.tenses.includes(chapter.tense)))return false;
    } else if(!status(entry).complete)return false;
    if (journeyObjective) {
      if (journeyObjective.supplementalOnly || journeyObjective.guidedOnly || journeyObjective.available === false) return false;
      const deferredAt = Math.max(0, ...Object.values(store.learning.sessions || {}).filter(x=>x.journey && x.entryId===entry.id).map(x=>x.deferred?.[s.objectiveId] || 0));
      if (deferredAt && deferredAt >= (s.lastAt || 0)) return false;
      // A visited background chapter stays reviewable; other extras follow the
      // learner's enrollment without deleting their evidence when switched off.
      if (journeyObjective.optional && !['background', 'mixed'].includes(journeyObjective.chapterId)) {
        const selected = new Set(store.learning.preferences?.expansions || []);
        return EXPANSIONS.some(e => selected.has(e.id) && e.tenses.includes(journeyObjective.tense));
      }
      return true;
    }
    // Completed core cases are enrolled individually, irrespective of the old
    // global course-stage setting. Explicit games keep their own broad scope.
    if (entry.kind==='verb')return true;
    if (s.tense && s.tense !== 'meaning' && !allowed.has(s.tense)) return false;
    if (!objectiveIds.has(entry.id)) objectiveIds.set(entry.id, new Set(activeObjectives(entry, store.learning).map(o => o.id)));
    return objectiveIds.get(entry.id).has(s.objectiveId);
  });
  const known=new Set(skills.map(s=>s.objectiveId));
  const candidateIds=new Set([...evidenceSkills.map(s=>s.entryId),...Object.values(store.learning.completions || {}).map(c=>c.entryId)]);
  for(const entry of scopedEntries(store)) {
    if(!candidateIds.has(entry.id))continue;
    if(entry.kind!=='verb') {
      if(!skills.some(s=>s.entryId===entry.id) && status(entry).complete) {
        const objective=lessonObjectives(entry).find(o=>o.skill==='meaning' && o.available!==false);
        if(objective)skills.push({...skillState(store.learning,objective.id,now),objectiveId:objective.id,entryId:entry.id,kind:entry.kind,skill:objective.skill,
          enrolled:true,due:(status(entry).completedAt || store.current.items?.[entry.id]?.learnedAt || 0)+8*3600e3});
      }
      continue;
    }
    const enrolled=status(entry).cases.filter(c=>c.checked);
    if(!enrolled.length)continue;
    for(const objective of lessonObjectives(entry)) {
      const chapter=enrolled.find(c=>c.id===objective.chapterId);
      if(!chapter || known.has(objective.id) || objective.supplementalOnly || objective.guidedOnly || objective.available===false || objective.required===false)continue;
      const state=skillState(store.learning,objective.id,now);
      // A manually known case gets a real diagnostic review, not synthetic
      // correct attempts. Natural completions already have target schedules.
      if(state.attempts)continue;
      skills.push({...state,objectiveId:objective.id,entryId:entry.id,kind:entry.kind,skill:objective.skill,tense:objective.tense,
        chapterId:objective.chapterId,enrolled:true,due:(chapter.completedAt || 0)+8*3600e3});
    }
  }
  return [...skills,...grammarReviewSkills(store,now)];
}
export function dueSkills(store, now = Date.now()) {
  return eligibleSkills(store, now).filter(s => s.due && s.due <= now).sort((a, b) => a.due - b.due || a.objectiveId.localeCompare(b.objectiveId));
}
export function reviewItems(store, now = Date.now()) {
  const skills = dueSkills(store, now);
  // Legacy evidence is deliberately not inflated into per-skill mastery. Items with
  // adaptive records use the skill queue; older items enter a fresh diagnostic loop.
  const known = new Set([...allSkills(store.learning, now).map(s => s.entryId),...skills.map(s=>s.entryId)]);
  const scopeIds = new Set(scopedEntries(store).map(e => e.id));
  return [...skills.map(s => ({ entry: s.kind==='grammar' ? grammarEntry(grammarLesson(s.entryId)) : getEntry(s.entryId), objectiveId: s.objectiveId, skill: s })),
    ...store.dueIds(now).filter(id => !known.has(id) && scopeIds.has(id)).map(id => ({ entry: getEntry(id), objectiveId: null })).filter(x => x.entry?.kind!=='verb'
      && x.entry && entryCompletion(x.entry,store.learning,store.current.items?.[x.entry.id],now).complete)];
}
export function practiceHref(entry, objectiveId = null, mode = 'lesson') {
  if(entry.kind==='grammar')return grammarHref(grammarLesson(entry.id),mode,objectiveId);
  const query = new URLSearchParams();
  if (objectiveId) query.set('objective', objectiveId);
  if (mode !== 'lesson') query.set('mode', mode);
  return '#/learn/' + (entry.kind === 'verb' ? 'verb' : 'word') + '/' + encodeURIComponent(entry.id) + (query.size ? '?' + query : '');
}

// New lessons resume their named journey. Due reviews remain a separate, voluntary
// choice, and the old recommender is retained for exact legacy-session recovery.
export function recommendLesson(store, { kind = null, review = false, now = Date.now() } = {}) {
  const scope = scopedEntries(store, kind), ids = new Set(scope.map(e=>e.id));
  const sessions = Object.values(store.learning.sessions || {}).filter(s=>s.journey && s.mode==='lesson' && ids.has(s.entryId))
    .sort((a,b)=>b.updatedAt-a.updatedAt);
  if (!review) for (const session of sessions) {
    const entry = getEntry(session.entryId), plan = lessonPlan(entry);
    const completion=entryCompletion(entry,store.learning,store.current.items?.[entry.id],now);
    if(completion.complete || completion.cases.some(c=>c.id===session.journey.chapterId && c.checked))continue;
    const step = currentJourneyStep(plan,session,store.learning,now);
    if (step.type !== 'complete') return {entry,session,mode:'lesson',reason:`Continue ${nameFor(entry)} from where you stopped.`};
  }
  const due = reviewItems(store,now).filter(x=>!kind||x.entry.kind===kind);
  if (due.length) return {...due[0],mode:'review',reason:'A short review of something you have already learned.'};
  if (review) {
    const ahead=eligibleSkills(store,now).filter(s=>!kind||s.kind===kind).sort((a,b)=>(a.due||Infinity)-(b.due||Infinity));
    return ahead.length ? {entry:ahead[0].kind==='grammar'?grammarEntry(grammarLesson(ahead[0].entryId)):getEntry(ahead[0].entryId),objectiveId:ahead[0].objectiveId,mode:'review',reason:'Practise something familiar.'} : null;
  }
  const anchors = new Map(['credere','parlare','essere','avere','dormire','capire','dire','andare',...ANCHOR_VERBS].map((x,i)=>[x,i]));
  const candidates=scope.slice().sort((a,b)=>(anchors.get(a.inf)??100)-(anchors.get(b.inf)??100));
  for (const entry of candidates) {
    if(entryCompletion(entry,store.learning,store.current.items?.[entry.id],now).complete)continue;
    const session=sessions.find(s=>s.entryId===entry.id);
    if (!session) return {entry,mode:'lesson',reason:entry.kind==='verb'?'Choose a tense: present, passato prossimo, imperfetto, future or conditional.':'Learn a word through its meaning, forms and real examples.'};
    if (!journeyProgress(lessonPlan(entry),session,store.learning,now).complete) {
      if (entry.kind==='verb') {
        const cases=journeyCaseProgress(lessonPlan(entry),store.learning,session,now);
        const unfinished=new Set(cases.cases.filter(c=>!c.exempt&&!c.ready).map(c=>c.id));
        const chapter=journeyProgress(lessonPlan(entry),session,store.learning,now).chapters.find(c=>unfinished.has(c.id)&&c.pending.some(t=>!t.skipped));
        if(chapter)return {entry,mode:'lesson',chapterId:chapter.id,reason:'Continue one of this verb’s five core cases.'};
        continue;
      }
      const pending=journeyProgress(lessonPlan(entry),session,store.learning,now).chapters.filter(c=>!c.optional).flatMap(c=>c.pending).find(t=>!t.skipped);
      if(pending)return {entry,objectiveId:pending.target.id,mode:'review',reason:'Return to a part you wanted to practise.'};
    }
  }
  return null;
}
const nameFor = entry => entry.inf || entry.it;
export function lessonSessions(store) {
  return Object.values(store.learning.sessions || {}).filter(s=>s.journey&&s.mode==='lesson'&&getEntry(s.entryId)&&!store.current.customDeleted?.[s.entryId])
    .sort((a,b)=>b.updatedAt-a.updatedAt).map(session=>{const entry=getEntry(session.entryId),plan=lessonPlan(entry);return {entry,session,step:currentJourneyStep(plan,session,store.learning),progress:journeyProgress(plan,session,store.learning)};});
}
export function recommend(store, { kind = null, review = false, now = Date.now(), excludeObjectives = [] } = {}) {
  const excluded = new Set(excludeObjectives);
  const due = reviewItems(store, now).filter(x => (!kind || x.entry.kind === kind) && !excluded.has(x.objectiveId));
  if (due.length) return { ...due[0], mode: 'review', reason: due[0].skill ? 'A skill is ready for another independent check.' : 'Check what you remember from an earlier lesson.' };
  if (review) {
    const eligible = eligibleSkills(store, now).filter(s => (!kind || s.kind === kind) && !excluded.has(s.objectiveId)).sort((a, b) => (a.due || Infinity) - (b.due || Infinity));
    if (eligible.length) return { entry: eligible[0].kind==='grammar'?grammarEntry(grammarLesson(eligible[0].entryId)):getEntry(eligible[0].entryId), objectiveId: eligible[0].objectiveId, mode: 'review', reason: 'Practice ahead of your next scheduled review.' };
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
