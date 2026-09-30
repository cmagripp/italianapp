import { html, raw, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { LEVELS, LEVEL_INFO } from '../data.js';
import { recommendLesson, practiceHref, lessonSessions } from '../learning/integration.js';
import { setScene, dropdown } from '../fx.js';
import { EXPANSIONS } from '../learning/curriculum.js';
import { loadGrammarCourse, grammarCourse, grammarLesson, grammarProgress, grammarHref, courseLevel, nextGrammarLesson, grammarSessions } from '../learning/grammar-course.js';

export function coursePreview() {
  const vocabulary=lessonSessions(store).find(x=>x.step.type!=='complete'&&!x.progress.complete) || recommendLesson(store),grammarSession=grammarSessions(store)[0];
  const grammarWins=grammarSession && (!vocabulary?.session || grammarSession.updatedAt>=vocabulary.session.updatedAt);
  const next=nextGrammarLesson(store);
  const active=grammarWins?grammarLesson(grammarSession.entryId):null;
  let href=active?grammarHref(active):vocabulary?.session?practiceHref(vocabulary.entry)+'?session='+encodeURIComponent(vocabulary.session.id):next?grammarHref(next):'#/course';
  const queue=store.learning.sessions['course:everyday|course'];
  const resumeQueue=queue?.course&&!queue.course.finished&&queue.updatedAt>=Math.max(vocabulary?.session?.updatedAt || 0,grammarSession?.updatedAt || 0);
  if(resumeQueue)return html`<section class="course-preview glass pad-l"><div class="kicker">Your learning path</div><h2 class="display">Everyday Italian</h2><p>Continue your saved session, one part at a time.</p><div class="course-actions"><a class="btn primary" href="#/learn/session">Resume session ${raw(icon('arrow',{size:18}))}</a></div></section>`;
  if(queue?.course&&!queue.course.finished&&queue.course.items.some(item=>item.id===(active?.id || vocabulary?.entry?.id)))href+=(href.includes('?')?'&':'?')+'courseSession=1';
  const title=active?.title || (vocabulary?.session?(vocabulary.entry.inf || vocabulary.entry.it):'Everyday Italian');
  const description=active?active.outcome:vocabulary?.session?'Continue from where you stopped.':next?next.outcome:'Your progress, at your pace. Revisit a lesson or explore another level.';
  return html`<section class="course-preview glass pad-l"><div class="kicker">Your learning path</div><h2 class="display">${title}</h2><p>${description}</p><div class="course-actions"><a class="btn primary" href="${href}">${active||vocabulary?.session?'Resume lesson':'Start a lesson'} ${raw(icon('arrow',{size:18}))}</a></div></section>`;
}
export function courseSummary() {
  const level=courseLevel(store),lessons=grammarCourse.lessons.filter(l=>l.level===level),completed=lessons.filter(l=>grammarProgress(l,store.learning).complete).length;
  return html`<section class="course-summary glass-flat"><div><span class="kicker">My Course</span><h2>Everyday Italian</h2><p>${level} · ${LEVEL_INFO[level]?.name || ''}</p><p>${completed} / ${lessons.length} grammar lessons completed</p></div><button type="button" class="icon-btn" data-course-menu aria-label="Change course level" aria-haspopup="menu" aria-expanded="false">${raw(icon('chevronDown',{size:20}))}</button></section>`;
}
export function bindCourseMenu(root,redraw) {
  const button=root.querySelector('[data-course-menu]');if(!button)return;
  button.addEventListener('click',()=>dropdown(button,[...LEVELS.map(level=>({value:level,label:`Everyday Italian · ${level}`,sub:LEVEL_INFO[level]?.name || '',selected:level===courseLevel(store)})),{value:'outline',label:'Course outline',sub:'Browse every unit and lesson'}],{align:'end',width:300,onSelect:value=>{if(value==='outline'){location.hash='#/course';return;}store.setLearningPreference('courseLevel',value);redraw();}}));
}
export async function render(root) {
  await loadGrammarCourse();setTitle('Your course');
  function draw(){
    const level=courseLevel(store);setScene(level);
    const pack=grammarCourse.levels.find(l=>l.level===level),next=nextGrammarLesson(store);
    root.innerHTML=html`<div class="course-page"><header><span class="kicker">Grammar, words, and verbs · your pace</span><h1 class="display">Build your Italian,<br>one idea at a time.</h1><p>Follow the recommended order, or open any lesson. Your place and progress are always saved.</p></header>${raw(courseSummary())}<h2 id="path-title">Your lessons</h2><div class="course-outline">${raw(pack.units.map(unit=>{
      const lessons=unit.lessons.map(l=>grammarLesson(l.id));const count=lessons.filter(l=>grammarProgress(l,store.learning).complete).length;
      return html`<details class="course-unit glass-flat" ${lessons.some(l=>l.id===next?.id)?raw('open'):''}><summary><span>${unit.title}</span><small>${count} / ${lessons.length} ${raw(icon('chevronDown',{size:16}))}</small></summary><p>${unit.description}</p><ul class="course-skills">${raw(lessons.map(lesson=>{const p=grammarProgress(lesson,store.learning),session=grammarSessions(store).find(s=>s.entryId==='g:'+lesson.id);return html`<li class="${p.complete?'is-complete':''}"><div><strong>${p.complete?'✓ ':''}${lesson.title}</strong><span>${lesson.outcome}</span><small>${lesson.minutes} min · ${p.complete?'Completed':session?'In progress':'Grammar'}</small></div><a class="btn secondary sm" href="${grammarHref(lesson)}">${p.complete?'Revisit':session?'Resume':'Start'}</a></li>`;}).join(''))}</ul></details>`;
    }).join(''))}</div><details class="course-unit glass-flat"><summary>Additional verb forms ${raw(icon('chevronDown',{size:16}))}</summary><p>Grammar lessons open relevant forms when you choose them. You can also make these chapters available in your verb lessons.</p>${raw(EXPANSIONS.map(x=>html`<label class="course-expansion"><input type="checkbox" data-expansion="${x.id}" ${(store.learning.preferences.expansions || []).includes(x.id)?raw('checked'):''}><span><strong>${x.label}</strong></span></label>`).join(''))}</details><a class="btn secondary" href="#/grammar">Grammar reference</a><a class="btn ghost" href="#/learn">Back to Learn</a></div>`;
    bindCourseMenu(root,draw);
    root.querySelectorAll('[data-expansion]').forEach(input=>input.addEventListener('change',()=>{const selected=new Set(store.learning.preferences.expansions || []);if(input.checked)selected.add(input.dataset.expansion);else selected.delete(input.dataset.expansion);store.setLearningPreference('expansions',[...selected]);}));
  }
  draw();
}
