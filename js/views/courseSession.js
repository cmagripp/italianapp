import { html, raw, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, itemsForScope } from '../data.js';
import { setScene } from '../fx.js';
import { lessonPlan } from '../learning/integration.js';
import { journeyChapterCompletions } from '../learning/journey.js';
const casesFor=entry=>journeyChapterCompletions(lessonPlan(entry),store.learning);
import { grammarCourse, loadGrammarCourse, grammarLesson, grammarProgress, grammarHref, courseLevel, nextGrammarLesson, relatedVocabulary } from '../learning/grammar-course.js';

export function sessionItemComplete(item) {
  if(item.kind==='grammar'){const lesson=grammarLesson(item.id);return lesson?grammarProgress(lesson,store.learning).complete:false;}
  if(item.kind==='verb')return !!casesFor(getEntry(item.id)).find(c=>c.id===item.caseId)?.ready;
  return store.isLearned(item.id);
}
export function sessionItemHref(item) {
  if(item.kind==='grammar')return grammarHref(item.id)+'?courseSession=1';
  const query=new URLSearchParams({courseSession:'1'});if(item.caseId)query.set('chapter',item.caseId);if(item.fromGrammar)query.set('fromGrammar',item.fromGrammar);
  return `#/learn/${item.kind}/${encodeURIComponent(item.id)}?${query}`;
}
export function buildCourseSession(mode='together') {
  const lesson=nextGrammarLesson(store) || grammarCourse.lessons.filter(l=>l.level===courseLevel(store)).at(-1),items=[];
  if(['together','grammar'].includes(mode)&&lesson&&!grammarProgress(lesson,store.learning).complete)items.push({kind:'grammar',id:lesson.id,title:lesson.title});
  if(['together','verbs'].includes(mode)){
    const related=relatedVocabulary(lesson,store,{kind:'verb',unfinished:true});
    const candidates=[...related,...itemsForScope(store.scope,store,{kind:'verb'}).map(entry=>({entry,caseId:null}))];
    for(const x of candidates){const cases=casesFor(x.entry);const c=x.caseId?cases.find(c=>c.id===x.caseId&&c.available&&!c.ready):cases.find(c=>!c.optional&&c.available&&!c.ready);if(c){items.push({kind:'verb',id:x.entry.id,title:x.entry.inf,caseId:c.id,caseTitle:c.label || c.title || c.id,fromGrammar:x.caseId?lesson?.id:null});break;}}
  }
  if(['together','words'].includes(mode)){
    const related=relatedVocabulary(lesson,store,{kind:'word',unfinished:true}).map(x=>x.entry),scoped=itemsForScope(store.scope,store,{kind:'word'}).filter(e=>!store.isLearned(e.id));
    const seen=new Set();for(const entry of [...related,...scoped]){if(seen.has(entry.id))continue;seen.add(entry.id);items.push({kind:'word',id:entry.id,title:entry.it});if(seen.size===3)break;}
  }
  return {id:'course:'+Date.now()+':'+Math.random().toString(36).slice(2),entryId:'course:everyday',mode:'course',createdAt:Date.now(),updatedAt:Date.now(),index:0,objectiveIds:[],course:{version:1,level:courseLevel(store),mode,items,skipped:[],finished:false}};
}
export async function render(root,params,query={}) {
  await loadGrammarCourse();setTitle('Your session');
  if(query.start==='grammar'&&!nextGrammarLesson(store)){location.hash='#/course';return;}
  let session=store.learning.sessions['course:everyday|course'];
  if(query.start || !session?.course || session.course.finished)session=buildCourseSession(query.start || 'together');
  if(query.start)history.replaceState(null,'',location.pathname+location.search+'#/learn/session');
  const owner=store.current.id;
  function draw(){
    if(store.current.id!==owner)return;
    const next=session.course.items.findIndex((item,i)=>!session.course.skipped.includes(i)&&!sessionItemComplete(item));
    session.index=next<0?session.course.items.length:next;session.course.finished=next<0;store.saveLearningSession(session);setScene(session.course.level);
    root.innerHTML=html`<div class="course-page"><header><span class="kicker">${session.course.level} · Everyday Italian</span><h1 class="display">${next<0?'A little more Italian.':'One step, then the next.'}</h1><p>${next<0?'Your work is saved. Come back when you’re ready for more.':'A short session of related ideas. Finish a part, then choose whether to continue.'}</p></header><ol class="session-steps">${raw(session.course.items.map((item,i)=>html`<li class="glass-flat"><div><small>${item.kind==='grammar'?'Grammar':item.kind==='verb'?'Verb · '+item.caseTitle:'Word'}</small><strong>${item.title}</strong><small>${sessionItemComplete(item)?'✓ Complete':session.course.skipped.includes(i)?'Saved for later':i===next?'Up next':'Later in this session'}</small></div><a class="btn secondary sm" href="${sessionItemHref(item)}">${sessionItemComplete(item)?'Revisit':i===next?'Continue':'Open'}</a></li>`).join(''))}</ol>${next>=0?raw(html`<a class="btn primary block" href="${sessionItemHref(session.course.items[next])}">Continue · ${session.course.items[next].title} ${raw(icon('arrow',{size:18}))}</a><button type="button" class="btn ghost" data-save-part>Save this part for later</button>`):raw('<a class="btn primary" href="#/course">Your course</a>')}<a class="btn secondary" href="#/learn">Back to Learn</a></div>`;
    root.querySelector('[data-save-part]')?.addEventListener('click',()=>{session.course.skipped.push(next);draw();});
  }
  draw();
}
