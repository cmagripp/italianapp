import { LEVELS, getEntry, data } from '../data.js';
import { skillState } from './model.js';
import { courseSkill } from './course-v2-state.js';
import { attachCourseVocabulary } from './course-vocabulary.js';

export const COURSE_LEVELS = ['Foundations',...LEVELS];
export const grammarCourse = { levels:[], lessons:[], legacyLessons:[], allLessons:[], byId:new Map(), vocabularyLinks:new Map(), workshops:[], ready:false, indexOnly:false };
const flatten=levels=>levels.flatMap(level=>level.units.flatMap(unit=>unit.lessons.map(lesson=>({...lesson,...(Array.isArray(lesson.steps)?{steps:lesson.steps.filter(s=>!s?.synthesized)}:{}),level:level.level,unitId:unit.id,unitTitle:unit.title,contentVersion:level.version || 1}))));
let pending;const stages=new Map(),stagePending=new Map();let vocabularyAttached=new WeakSet();
const stageKey=(level,legacy)=>`${legacy?'legacy':'v2'}:${level}`;
const digest=value=>{let h=2166136261;for(const c of JSON.stringify(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
function rebuild(){grammarCourse.lessons=flatten(grammarCourse.levels);grammarCourse.legacyLessons=flatten(grammarCourse.legacyLevels);grammarCourse.allLessons=[...grammarCourse.legacyLessons,...grammarCourse.lessons];grammarCourse.byId=new Map(grammarCourse.allLessons.map(l=>[l.id,l]));}
export function installGrammarCourse(levels,legacyLevels=[],dictionary=null) {
 grammarCourse.levels=levels;grammarCourse.legacyLevels=legacyLevels;grammarCourse.vocabularyLinks=new Map();grammarCourse.workshops=[];grammarCourse.ready=true;grammarCourse.indexOnly=false;stages.clear();stagePending.clear();vocabularyAttached=new WeakSet();
 for(const pack of levels)stages.set(stageKey(pack.level,false),pack);for(const pack of legacyLevels)stages.set(stageKey(pack.level,true),pack);
 rebuild();if(dictionary)attachLessonVocabulary(dictionary);return grammarCourse;
}
export function installGrammarIndex(index){
 const valid=p=>p&&typeof p.level==='string'&&typeof p.path==='string'&&typeof p.digest==='string'&&Array.isArray(p.units)&&p.units.every(u=>Array.isArray(u.lessons)&&u.lessons.every(l=>typeof l.id==='string'&&Array.isArray(l.targets||l.objectives)&&Array.isArray(l.steps)));
 if(index?.version!==1||!Array.isArray(index.levels)||!Array.isArray(index.legacyLevels)||!index.levels.every(valid)||!index.legacyLevels.every(valid)||!COURSE_LEVELS.every(level=>index.levels.some(p=>p.level===level))||!LEVELS.every(level=>index.legacyLevels.some(p=>p.level===level)))throw new Error('Your course outline could not load. Reconnect and retry.');
 grammarCourse.levels=index.levels;grammarCourse.legacyLevels=index.legacyLevels;grammarCourse.workshops=Array.isArray(index.workshops)?index.workshops:[];grammarCourse.vocabularyLinks=new Map(flatten(index.levels).map(lesson=>[lesson.id,Array.isArray(lesson.vocabularyLinks)?lesson.vocabularyLinks:[]]));grammarCourse.ready=true;grammarCourse.indexOnly=true;stages.clear();stagePending.clear();vocabularyAttached=new WeakSet();rebuild();return grammarCourse;
}
// The synchronous authoring API remains available when course-words is imported.
// Browser navigation loads that engine only when a selected lesson needs boards.
export function attachLessonVocabulary({vocab=[],verbs=[]}={},selected=null){
 if(!grammarCourse.ready||!Array.isArray(vocab)||!vocab.length)return grammarCourse;
 for(const lesson of selected?[selected]:grammarCourse.lessons){if(lesson.contentVersion!==2||!Array.isArray(lesson.steps)||vocabularyAttached.has(lesson)||!stages.has(stageKey(lesson.level,false)))continue;if(attachCourseVocabulary(lesson,{vocab,verbs}))vocabularyAttached.add(lesson);}
 return grammarCourse;
}
export function loadGrammarCourse(){
 if(grammarCourse.ready)return Promise.resolve(grammarCourse);
 return pending ||= fetch('data/course-index.json').then(r=>{if(!r.ok)throw new Error('Your course outline could not load. Reconnect and retry.');return r.json();}).then(installGrammarIndex).catch(e=>{pending=null;throw e;});
}
export async function loadGrammarStage(level,{legacy=false}={}){
 await loadGrammarCourse();const key=stageKey(level,legacy);if(stages.has(key))return stages.get(key);if(stagePending.has(key))return stagePending.get(key);
 const packs=legacy?grammarCourse.legacyLevels:grammarCourse.levels,descriptor=packs.find(p=>p.level===level);
 if(!descriptor)throw new Error('This course stage is unavailable.');
 const request=fetch(descriptor.path).then(async r=>{if(!r.ok)throw new Error();const pack=await r.json();if(pack.level!==level||pack.version!==(descriptor.version||1)||digest(pack)!==descriptor.digest)throw new Error();
  if(!Array.isArray(pack.units)||pack.units.some(u=>!Array.isArray(u.lessons)||u.lessons.some(l=>legacy?!Array.isArray(l.objectives)||l.objectives.some(o=>!Array.isArray(o.questions)):!Array.isArray(l.steps)||!Array.isArray(l.targets))))throw new Error();
  stages.set(key,pack);packs[packs.indexOf(descriptor)]=pack;
  // Preserve already loaded lesson objects/boards while replacing this stage.
  const newLessons=flatten([pack]),oldIds=new Set(newLessons.map(l=>l.id)),field=legacy?'legacyLessons':'lessons';grammarCourse[field]=grammarCourse[field].filter(l=>!oldIds.has(l.id));grammarCourse[field].push(...newLessons);
  const order=new Map(flatten(packs).map((l,i)=>[l.id,i]));grammarCourse[field].sort((a,b)=>order.get(a.id)-order.get(b.id));grammarCourse.allLessons=[...grammarCourse.legacyLessons,...grammarCourse.lessons];grammarCourse.byId=new Map(grammarCourse.allLessons.map(l=>[l.id,l]));return pack;
 }).catch(()=>{throw new Error(`The ${level} course stage could not load. Your saved work is kept. Reconnect and retry.`);}).finally(()=>stagePending.delete(key));
 stagePending.set(key,request);return request;
}
export async function loadGrammarLesson(id){
 await loadGrammarCourse();const lesson=grammarLesson(id);if(!lesson)return null;await loadGrammarStage(lesson.level,{legacy:lesson.contentVersion!==2});const loaded=grammarLesson(id);
 if(loaded.contentVersion===2){await import('./course-words.js');attachLessonVocabulary(data,loaded);}return loaded;
}
export function grammarLesson(id){return grammarCourse.byId.get(String(id).replace(/^g:/,''));}
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
  const explicit=lesson?.related || [],seen=new Set(explicit.map(link=>link.entryId));
  const links=[...explicit];
  for(const entryId of [...(lesson?.wordEntryIds || []),...(grammarCourse.vocabularyLinks.get(lesson?.id) || [])])if(!seen.has(entryId)){seen.add(entryId);links.push({entryId});}
  return links.map(link=>({entry:getEntry(link.entryId),caseId:link.caseId || null}))
    .filter(x=>x.entry && !x.entry.legacyGrouping && !store.current?.customDeleted?.[x.entry.id] && (!kind || x.entry.kind===kind) && (!unfinished || (x.entry.kind==='verb' && x.caseId
      ? !store.completionState(x.entry).cases.find(c=>c.id===x.caseId)?.checked : !store.isLearned(x.entry.id))));
}
