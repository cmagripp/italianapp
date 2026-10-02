import { LEVELS, getEntry, data } from '../data.js';
import { skillState } from './model.js';
import { courseSkill } from './course-v2-state.js';
import { resolveLessonWords, wordsCheckSteps, lessonWordIds } from './course-words.js';

export const COURSE_LEVELS = ['Foundations',...LEVELS];
export const grammarCourse = { levels:[], lessons:[], legacyLessons:[], allLessons:[], byId:new Map(), ready:false };
// Each installed lesson owns its steps array (the raw pack stays untouched by the vocabulary attachment below).
const flatten=levels=>levels.flatMap(level=>level.units.flatMap(unit=>unit.lessons.map(lesson=>({...lesson,...(Array.isArray(lesson.steps)?{steps:lesson.steps.filter(s=>!s?.synthesized)}:{}),level:level.level,unitId:unit.id,unitTitle:unit.title,contentVersion:level.version || 1}))));
let pending,vocabularyAttached=false;
export function installGrammarCourse(levels, legacyLevels=[], dictionary=null) {
  grammarCourse.levels=levels;
  grammarCourse.lessons=flatten(levels);
  grammarCourse.legacyLessons=flatten(legacyLevels);
  grammarCourse.allLessons=[...grammarCourse.legacyLessons,...grammarCourse.lessons];
  grammarCourse.byId=new Map(grammarCourse.allLessons.map(lesson=>[lesson.id,lesson]));
  grammarCourse.ready=true;
  vocabularyAttached=false;
  if(dictionary)attachLessonVocabulary(dictionary);
  return grammarCourse;
}
// Once per install: the "Le parole di oggi" boards go right after each v2 lesson's opening words step.
// lesson.steps is spliced in place, so grammarCourse.lessons and byId keep sharing the same lesson objects.
export function attachLessonVocabulary({vocab=[],verbs=[]}={}) {
  if(vocabularyAttached || !grammarCourse.ready || !Array.isArray(vocab) || !vocab.length)return grammarCourse;
  for(const lesson of grammarCourse.lessons){
    if(lesson.contentVersion!==2 || !Array.isArray(lesson.steps))continue;
    const at=lesson.steps.findIndex(s=>s?.kind==='words');
    if(at>=0)lesson.steps.splice(at+1,0,...wordsCheckSteps(lesson,resolveLessonWords(lesson,{vocab,verbs})));
    lesson.wordEntryIds=lessonWordIds(lesson);
  }
  vocabularyAttached=true;
  return grammarCourse;
}
export function loadGrammarCourse() {
  const pack=async(path,level)=>{
    const response=await fetch(`data/${path}/${level}.json`);
    if(!response.ok)throw new Error('Your course could not load. Reconnect and try again.');
    return response.json();
  };
  return pending ||= Promise.all([
    Promise.all(COURSE_LEVELS.map(level=>pack('course-v2',level))),
    Promise.all(LEVELS.map(level=>pack('grammar-course',level))),
  ]).then(([levels,legacy])=>installGrammarCourse(levels,legacy)).catch(error=>{pending=null;throw error;});
}
export function grammarLesson(id) {
  if(!vocabularyAttached && grammarCourse.ready && data.vocab.length)attachLessonVocabulary({vocab:data.vocab,verbs:data.verbs});
  return grammarCourse.byId.get(String(id).replace(/^g:/,''));
}
export const grammarEntry=lesson=>({id:`g:${lesson.id}`,kind:'grammar',it:lesson.title,en:lesson.outcome,level:lesson.level});
export const grammarHref=(lesson,mode='lesson',objective=null)=>`#/learn/grammar/${encodeURIComponent(typeof lesson==='string'?lesson:lesson.id)}${mode==='review'?`?mode=review${objective?'&objective='+encodeURIComponent(objective):''}`:''}`;
export const courseLevel=store=>COURSE_LEVELS.includes(store.learning.preferences.courseLevel)?store.learning.preferences.courseLevel:grammarCourse.levels.some(l=>l.level==='Foundations')?'Foundations':store.settings.level || 'A1';
export function grammarProgress(lesson,learning,now=Date.now()) {
  const targets=lesson.targets || lesson.objectives;
  const events=lesson.targets?Object.values(learning.events || {}).filter(e=>e.entryId==='g:'+lesson.id):[];
  const skills=targets.map(o=>({...lesson.targets?courseSkill(events.filter(e=>e.objectiveId===o.id),now,o):skillState(learning,o.id,now),objectiveId:o.id,label:o.label}));
  const practiced=lesson.targets?(events.some(e=>e.lessonFinished&&targets.every(t=>e.completedTargets?.includes(t.id)))||Object.values(learning.sessions || {}).some(s=>s.entryId==='g:'+lesson.id&&s.mode==='lesson'&&s.courseV2?.phase==='complete')):false;
  return {complete:skills.length>0&&skills.every(s=>s.ready||lesson.targets&&s.readyAt!==null)&&(!lesson.targets||practiced),practiced,completed:skills.filter(s=>s.ready).length,total:skills.length,skills};
}
export function grammarReviewSkills(store,now=Date.now()) {
  return grammarCourse.allLessons.flatMap(lesson=>grammarProgress(lesson,store.learning,now).skills.filter(s=>s.ready||s.readyAt!=null).map(s=>({...s,lessonId:lesson.id})));
}
export function nextGrammarLesson(store) {
  const lessons=grammarCourse.lessons.filter(l=>l.level===courseLevel(store));
  return lessons.find(l=>!grammarProgress(l,store.learning).complete) || null;
}
export function grammarSessions(store) {
  return Object.values(store.learning.sessions || {}).filter(s=>(s.grammar||s.courseV2) && s.mode==='lesson' && grammarLesson(s.entryId) && (s.courseV2||s.grammar).phase!=='complete')
    .sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function relatedVocabulary(lesson,store,{kind=null,unfinished=false}={}) {
  return (lesson?.related || []).map(link=>({entry:getEntry(link.entryId),caseId:link.caseId || null}))
    .filter(x=>x.entry && (!kind || x.entry.kind===kind) && (!unfinished || (x.entry.kind==='verb' && x.caseId
      ? !store.completionState(x.entry).cases.find(c=>c.id===x.caseId)?.checked : !store.isLearned(x.entry.id))));
}
