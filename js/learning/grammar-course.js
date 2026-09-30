import { LEVELS, getEntry } from '../data.js';
import { skillState } from './model.js';

export const grammarCourse = { levels:[], lessons:[], byId:new Map(), ready:false };
let pending;
export function installGrammarCourse(levels) {
  grammarCourse.levels=levels;
  grammarCourse.lessons=levels.flatMap(level=>level.units.flatMap(unit=>unit.lessons.map(lesson=>({...lesson,level:level.level,unitId:unit.id,unitTitle:unit.title,contentVersion:level.version || 1}))));
  grammarCourse.byId=new Map(grammarCourse.lessons.map(lesson=>[lesson.id,lesson]));
  grammarCourse.ready=true;
  return grammarCourse;
}
export function loadGrammarCourse() {
  return pending ||= Promise.all(LEVELS.map(async level=>{
    const response=await fetch(`data/grammar-course/${level}.json`);
    if(!response.ok)throw new Error('Grammar course could not load. Reconnect and try again.');
    return response.json();
  })).then(installGrammarCourse).catch(error=>{pending=null;throw error;});
}
export const grammarLesson=id=>grammarCourse.byId.get(String(id).replace(/^g:/,''));
export const grammarEntry=lesson=>({id:`g:${lesson.id}`,kind:'grammar',it:lesson.title,en:lesson.outcome,level:lesson.level});
export const grammarHref=(lesson,mode='lesson',objective=null)=>`#/learn/grammar/${encodeURIComponent(typeof lesson==='string'?lesson:lesson.id)}${mode==='review'?`?mode=review${objective?'&objective='+encodeURIComponent(objective):''}`:''}`;
export const courseLevel=store=>LEVELS.includes(store.learning.preferences.courseLevel)?store.learning.preferences.courseLevel:store.settings.level || 'A1';
export function grammarProgress(lesson,learning,now=Date.now()) {
  const skills=lesson.objectives.map(o=>({...skillState(learning,o.id,now),label:o.label}));
  return {complete:skills.length>0&&skills.every(s=>s.ready),completed:skills.filter(s=>s.ready).length,total:skills.length,skills};
}
export function grammarReviewSkills(store,now=Date.now()) {
  return grammarCourse.lessons.flatMap(lesson=>grammarProgress(lesson,store.learning,now).skills.filter(s=>s.ready).map(s=>({...s,lessonId:lesson.id,label:lesson.objectives.find(o=>o.id===s.objectiveId)?.label})));
}
export function nextGrammarLesson(store) {
  const lessons=grammarCourse.lessons.filter(l=>l.level===courseLevel(store));
  return lessons.find(l=>!grammarProgress(l,store.learning).complete) || null;
}
export function grammarSessions(store) {
  return Object.values(store.learning.sessions || {}).filter(s=>s.grammar && s.mode==='lesson' && grammarLesson(s.entryId) && s.grammar.phase!=='complete')
    .sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function relatedVocabulary(lesson,store,{kind=null,unfinished=false}={}) {
  return (lesson?.related || []).map(link=>({entry:getEntry(link.entryId),caseId:link.caseId || null}))
    .filter(x=>x.entry && (!kind || x.entry.kind===kind) && (!unfinished || (x.entry.kind==='verb' && x.caseId
      ? !store.completionState(x.entry).cases.find(c=>c.id===x.caseId)?.checked : !store.isLearned(x.entry.id))));
}
