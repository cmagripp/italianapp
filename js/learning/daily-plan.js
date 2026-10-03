// Read-only recommendations shared by Home and Learn. Calling this service never
// starts a lesson or writes a session. Scope affects discovery, never due work.
import { getEntry, itemsForScope } from '../data.js';
import { ANCHOR_VERBS } from './curriculum.js';
import { entryCompletion, completionPlan } from './completion-state.js';
import { grammarLesson, grammarEntry, grammarHref, nextGrammarLesson, grammarCourse, grammarProgress } from './grammar-course.js';

const name=e=>e.inf || e.it;
let services=null;
export const registerDailyPlanServices=value=>{services=value;};
const lessonPlan=entry=>services?.lessonPlan(entry) || completionPlan(entry);
const practiceHref=(entry,_objective=null,mode='lesson')=>`#/learn/${entry.kind==='verb'?'verb':'word'}/${encodeURIComponent(entry.id)}${mode!=='lesson'?'?mode='+encodeURIComponent(mode):''}`;
const withQuery=(href,values)=>{const [path,old='']=href.split('?'),query=new URLSearchParams(old);for(const [key,value] of Object.entries(values))if(value!=null&&value!=='')query.set(key,String(value));return path+(query.size?'?'+query:'');};
function sessionActivity(store,session,now) {
  if(!session?.id || session.previewOnly || session.reviewVisit?.phase==='complete')return null;
  if(session.reviewVisit) return {id:`continue:${session.id}`,kind:'continue',activity:'review',sessionId:session.id,
    entryId:session.entryId,caseId:session.reviewVisit.caseId || null,href:`#/review?session=${encodeURIComponent(session.id)}&start=1`,
    label:'Continue your short review',reason:`${session.reviewVisit.index || 0} of ${session.reviewVisit.total} checks finished.`,estimatedMinutes:2,updatedAt:session.updatedAt};
  if(session.course && !session.course.finished && Array.isArray(session.course.items)) {
    const item=session.course.items.find((x,i)=>i>=session.index&&!session.course.skipped?.includes(i));
    if(!item)return null;
    return {id:`continue:${session.id}`,kind:'continue',activity:'course',sessionId:session.id,entryId:session.entryId,
      caseId:item.caseId || null,href:'#/learn/session',label:`Continue your course · ${item.title}${item.caseTitle?` · ${item.caseTitle}`:''}`,
      reason:'Return to the next saved part of your Everyday Italian session.',estimatedMinutes:3,updatedAt:session.updatedAt};
  }
  if(session.entryId?.startsWith('lab:frasi:') && session.phase==='activity') {
    const lessonId=session.lessonId || session.entryId.slice('lab:frasi:'.length);
    return {id:`continue:${session.id}`,kind:'continue',activity:'workshop',sessionId:session.id,entryId:session.entryId,
      lessonId,href:`#/lab/frasi/${encodeURIComponent(lessonId)}?session=${encodeURIComponent(session.id)}`,
      label:session.title?`Continue the workshop · ${session.title}`:'Continue your saved sentence workshop',
      reason:session.paused?'Your paused sentence practice is saved.':'Return to the sentence you were building.',estimatedMinutes:3,updatedAt:session.updatedAt};
  }
  if(session.entryId?.startsWith('g:')) {
    const lesson=grammarLesson(session.entryId),state=session.courseV2 || session.grammar;
    if(!lesson || !state || state.phase==='complete')return null;
    const objectiveId=state.activeTargetId || lesson.objectives?.[state.objectiveIndex]?.id || null;
    return {id:`continue:${session.id}`,kind:'continue',activity:'grammar',sessionId:session.id,entryId:session.entryId,entry:grammarEntry(lesson),
      objectiveId,href:withQuery(grammarHref(lesson,session.mode),{session:session.id}),
      label:`Continue ${lesson.title}`,reason:state.paused?'Your paused course lesson is saved.':'Return to your exact course activity.',estimatedMinutes:3,updatedAt:session.updatedAt};
  }
  const entry=getEntry(session.entryId);
  if(!entry || store.current.customDeleted?.[entry.id] || session.mode==='review' || ['complete','summary'].includes(session.ui?.phase))return null;
  let caseId=null,caseTitle='',objectiveId=session.activeObjectiveId || null;
  if(session.journey) {
    if(session.journey.phase==='complete')return null;
    const plan=lessonPlan(entry),chapter=plan?.chapters.find(c=>c.id===session.journey.chapterId);
    caseId=session.journey.chapterId;caseTitle=chapter?.title || '';
    const completed=entryCompletion(entry,store.learning,store.current.items?.[entry.id],now);
    if(entry.kind==='verb' && completed.cases.some(c=>c.id===caseId&&c.checked&&!c.updateAvailable) && session.journey.phase!=='recap')return null;
    objectiveId=session.journey.current?.targetId || objectiveId;
  } else if(!session.objectiveIds?.length)return null;
  return {id:`continue:${session.id}`,kind:'continue',activity:entry.kind,entry,entryId:entry.id,caseId,objectiveId,sessionId:session.id,
    href:withQuery(practiceHref(entry,null,session.mode || 'lesson'),{session:session.id,chapter:caseId}),
    label:`Continue ${name(entry)}${entry.kind==='verb'&&caseTitle?` · ${caseTitle}`:''}`,
    reason:session.ui?.paused || session.journey?.paused?'Your paused lesson is saved.':'Pick up at your saved activity.',estimatedMinutes:3,updatedAt:session.updatedAt};
}
export function continuation(store,{now=Date.now()}={}) {
  const unique=new Map();
  // The active pointer can lag behind the saved session after a merge. Keep
  // the newest record; on a tie the saved record is the stable authority.
  for(const session of [...Object.values(store.learning.sessions || {}),store.learning.session])if(session?.id){
    const previous=unique.get(session.id);
    if(!previous || (session.updatedAt || 0)>(previous.updatedAt || 0))unique.set(session.id,session);
  }
  return [...unique.values()].map(s=>sessionActivity(store,s,now)).filter(Boolean)
    .sort((a,b)=>(b.updatedAt || 0)-(a.updatedAt || 0)||a.id.localeCompare(b.id))[0] || null;
}
function newActivities(store,now) {
  const grammar=nextGrammarLesson(store);
  const linked=new Set([...(grammar?.related || []).map(link=>link.entryId),...(grammarCourse.vocabularyLinks.get(grammar?.id) || [])]);
  const anchor=new Map(['credere','parlare','essere','avere','dormire','capire','dire','andare',...ANCHOR_VERBS].map((x,i)=>[x,i]));
  const entries=itemsForScope(store.scope,store).filter(e=>!e.legacyGrouping&&!store.current.customDeleted?.[e.id])
    .slice().sort((a,b)=>Number(linked.has(b.id))-Number(linked.has(a.id))||(anchor.get(a.inf)??100)-(anchor.get(b.inf)??100)||a.id.localeCompare(b.id));
  const activities=[];
  if(grammar)activities.push({id:`new:g:${grammar.id}`,kind:'new',activity:'grammar',entry:grammarEntry(grammar),entryId:`g:${grammar.id}`,
    href:grammarHref(grammar),label:grammar.title,reason:grammar.outcome || 'Take the next small step in your course.',estimatedMinutes:3});
  for(const entry of entries){
    const completed=entryCompletion(entry,store.learning,store.current.items?.[entry.id],now);
    if(completed.complete)continue;
    const requested=grammar?.related?.find(link=>link.entryId===entry.id)?.caseId;
    const pending=entry.kind==='verb'?(completed.cases.find(c=>c.id===requested&&!c.exempt&&!c.checked)||completed.cases.find(c=>!c.exempt&&!c.checked)):null;
    if(entry.kind==='verb'&&!pending)continue;
    const caseId=pending?.id || null,caseTitle=pending?.title || lessonPlan(entry)?.chapters.find(c=>c.id===caseId)?.title;
    activities.push({id:`new:${entry.id}:${caseId || 'word'}`,kind:'new',activity:entry.kind,entry,entryId:entry.id,caseId,
      href:withQuery(practiceHref(entry),{chapter:caseId}),label:`${name(entry)}${caseTitle?` · ${caseTitle}`:''}`,
      reason:linked.has(entry.id)?`Vocabulary for ${grammar.title}.`:entry.kind==='verb'?'A short visit to one verb case.':'Meet a useful word through meaning and choices.',estimatedMinutes:3});
    if(activities.length>=4)break;
  }
  return activities;
}
// Only recommend an unlocked workshop after its referenced grammar has been
// learned. The workshop remains freely discoverable from Play in its own path.
export function nextWorkshopActivity(store) {
  const done=store.current.lab?.frasi?.done || {};let stageOpen=true;
  for(const stage of grammarCourse.workshops){
    if(!stageOpen)break;
    for(let index=0;index<stage.lessons.length;index++){
      const lesson=stage.lessons[index];
      if(done[lesson.id])continue;
      if(index && !done[stage.lessons[index-1].id])continue;
      if(!lesson.grammarRefs?.length || !lesson.grammarRefs.every(id=>{const prior=grammarLesson(id);return prior&&grammarProgress(prior,store.learning).complete;}))continue;
      return {id:`workshop:${lesson.id}`,kind:'apply',activity:'workshop',entryId:`lab:frasi:${lesson.id}`,href:`#/lab/frasi/${encodeURIComponent(lesson.id)}`,label:lesson.title,reason:'Use the grammar you have learned in your own sentences.',estimatedMinutes:Math.max(3,Math.min(8,Number(lesson.minutes)||5))};
    }
    stageOpen=!!stage.lessons.length && !!done[stage.lessons.at(-1).id];
  }
  return null;
}
export function dailyPlan(store,{now=Date.now(),minutes=store.settings?.studyMinutes || 10}={}) {
  minutes=Math.max(5,Math.min(60,Number(minutes)||10));
  const resume=continuation(store,{now}),due=services?.reviewItems(store,now) || [],fresh=newActivities(store,now);
  const steps=[];let used=0;
  const add=activity=>{if(!activity||steps.some(s=>s.id===activity.id)||used+activity.estimatedMinutes>minutes)return false;steps.push(activity);used+=activity.estimatedMinutes;return true;};
  if(resume)add(resume);
  // Reserve new learning even with a large backlog. A review visit always has a
  // stopping point, and the remaining due rows stay available in Review.
  const review={id:'review:daily',kind:'review',activity:'review',entryId:due[0]?.entryId,caseId:due[0]?.caseId,
    entry:due[0]?.entry,href:'#/review?start=1&minutes=2',label:`Short mixed review · ${Math.min(due.length,4)} ${due.length===1?'target':'targets'}`,
    reason:'A few due words, verb cases and grammar checks.',estimatedMinutes:2};
  if(due.length && resume?.activity!=='review')add(review);
  const workshop=nextWorkshopActivity(store);
  // Apply a familiar pattern before adding another new lesson when there is
  // room. A long workshop never consumes the reserved short review budget.
  if(workshop && resume?.entryId!==workshop.entryId)add(workshop);
  for(const activity of fresh){if(resume?.entryId===activity.entryId)continue;add(activity);if(steps.filter(s=>s.kind==='new').length>=2)break;}
  if(!steps.length && due.length)add(review);
  return {version:1,minutes,estimatedMinutes:used,continuation:resume,dueCount:due.length,steps,
    suggestedNext:fresh.find(a=>a.entryId!==resume?.entryId&&!steps.some(s=>s.id===a.id)) || null,now};
}
