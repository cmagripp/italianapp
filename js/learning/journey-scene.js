// A saved question owns its selected sentence, not a pointer into a mutable
// sentence array. Only bounded data is stored; trusted templates render it.
export const JOURNEY_SCENE_VERSION = 1;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const string = (value, max, empty = false) => typeof value === 'string' && value.length <= max && (empty || value.length > 0);
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const keys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
const contextKeys = ['id','it','en','answer','answers','person','role','subjectLabel','aux','source'];
const snapshotKeys = ['version','entryId','targetId','chapterId','scenePolicy','sourceRevision','variant','poolSize','englishCue','context'];
export const retiredJourneyScene = (snapshot,target) => !!snapshot?.context?.id
  &&snapshot.sourceRevision===target?.legacyExpandedRevision
  && !!target?.retiredExpandedContextIds?.includes(snapshot.context.id);
export function retiredJourneyQuestion(current,target){
  if(!current||!target?.retiredExpandedContextIds?.length)return false;
  if(current.sceneSnapshot)return retiredJourneyScene(current.sceneSnapshot,target);
  if(current.scenePolicy==='expanded-v1'&&current.sceneRevision===(target.sceneRevision||'expanded-v1'))return false;
  const pool=current.scenePolicy==='expanded-v1'?journeySceneContexts(target,{legacy:true})
    :(target.legacyAuthoredContexts||[]).filter(context=>target.progressive||target.skill==='context'
      ||context.person===target.person&&(context.role||'ordinary')===(target.role||'ordinary'));
  return !!pool.length&&target.retiredExpandedContextIds.includes(pool[current.variant%pool.length]?.id);
}

export function validJourneyScene(snapshot) {
  const c = snapshot?.context;
  return record(snapshot) && keys(snapshot, snapshotKeys) && snapshot.version === JOURNEY_SCENE_VERSION
    && ['entryId','targetId','chapterId','sourceRevision'].every(key => string(snapshot[key], 500))
    && snapshot.scenePolicy === 'expanded-v1' && integer(snapshot.variant, 1000000)
    && integer(snapshot.poolSize, 2000) && snapshot.poolSize > 0 && typeof snapshot.englishCue === 'boolean'
    && snapshot.englishCue === (Math.floor(snapshot.variant / snapshot.poolSize) % 2 === 1)
    && record(c) && keys(c, contextKeys) && string(c.id, 500) && string(c.it, 4000) && string(c.en, 4000, true)
    && string(c.answer, 250) && Array.isArray(c.answers) && c.answers.length > 0 && c.answers.length <= 12
    && c.answers.every(answer => string(answer, 250)) && c.answers.includes(c.answer)
    && integer(c.person, 5) && ['ordinary','formal'].includes(c.role)
    && (c.subjectLabel === null || string(c.subjectLabel, 200, true))
    && (c.aux === null || ['avere','essere','both'].includes(c.aux)) && string(c.source, 200, true)
    && c.it.toLocaleLowerCase('it').includes(c.answer.toLocaleLowerCase('it'));
}

export function journeySceneContexts(target, { legacy = false } = {}) {
  if (!target || target.skill === 'progressiveUsage') return [];
  const pool = legacy && target.legacyExpandedContexts ? target.legacyExpandedContexts : target.contexts || [];
  if (target.progressive) return pool;
  if (!['conjugation','context','address'].includes(target.skill)) return [];
  return pool.filter(context => target.skill === 'context'
    || context.person === target.person && (context.role || 'ordinary') === (target.role || 'ordinary'));
}

export function createJourneyScene({ entryId, chapterId, target, variant = 0, legacy = false }) {
  const pool = journeySceneContexts(target, { legacy });
  if (!pool.length || !integer(variant, 1000000)) return null;
  const selected = pool[variant % pool.length];
  const context = Object.fromEntries(contextKeys.map(key => [key,
    key === 'answers' ? [...(selected.answers || [selected.answer])]
      : key === 'role' ? selected.role || 'ordinary'
      : key === 'source' ? selected.source || ''
      : ['subjectLabel','aux'].includes(key) ? selected[key] ?? null : selected[key]]));
  const snapshot = { version: JOURNEY_SCENE_VERSION, entryId, targetId: target.id, chapterId,
    scenePolicy: 'expanded-v1', sourceRevision: legacy && target.legacyExpandedRevision
      ? target.legacyExpandedRevision : target.sceneRevision || 'expanded-v1',
    variant, poolSize: pool.length, englishCue: Math.floor(variant / pool.length) % 2 === 1, context };
  return validJourneyScene(snapshot) ? snapshot : null;
}

export function journeySceneMatches(snapshot, { entryId, chapterId, target, variant }) {
  if (!validJourneyScene(snapshot) || snapshot.entryId !== entryId || snapshot.chapterId !== chapterId
    || snapshot.targetId !== target?.id || snapshot.variant !== variant) return false;
  // Imports may supply data, never new teaching. Bind the entire selected
  // sentence, translation, forms, source, order and cue to an authored revision.
  const legacy = snapshot.sourceRevision === target.legacyExpandedRevision;
  if (!legacy && snapshot.sourceRevision !== (target.sceneRevision || 'expanded-v1')) return false;
  if (legacy && !target.legacyExpandedContexts) return false;
  const expected = createJourneyScene({entryId,chapterId,target,variant,legacy});
  return !!expected && expected.sourceRevision === snapshot.sourceRevision && expected.poolSize === snapshot.poolSize
    && expected.englishCue === snapshot.englishCue && contextKeys.every(key => key === 'answers'
      ? snapshot.context.answers.length === expected.context.answers.length
        && snapshot.context.answers.every((answer,index)=>answer===expected.context.answers[index])
      : snapshot.context[key] === expected.context[key]);
}
