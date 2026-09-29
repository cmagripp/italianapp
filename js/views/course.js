import { html, raw, icon, toast } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { describeScope } from '../data.js';
import { EXPANSIONS } from '../learning/curriculum.js';
import { lessonSessions, recommendLesson, practiceHref, reviewItems } from '../learning/integration.js';
import { setScene } from '../fx.js';

const linkFor = next => practiceHref(next.entry,next.objectiveId,next.mode);
export function coursePreview({onCourse=false}={}) {
  const next=recommendLesson(store);
  const reviews=reviewItems(store);
  return html`<section class="course-preview glass pad-l"><div class="kicker">Your learning path</div><h2 class="display">Everyday Italian</h2>
    <p>${next?.reason || 'Choose a word or verb and learn it step by step.'}</p>
    <div class="course-actions">${next?raw(html`<a class="btn primary" href="${linkFor(next)}">${next.session?'Resume lesson':next.mode==='review'?'A little review':'Start a lesson'} ${raw(icon('arrow',{size:18}))}</a>`):''}
    <a class="btn secondary" href="${onCourse?'#/review':'#/course'}">${onCourse?(reviews.length?'Revisit familiar words':'Review'):'My course'}</a></div>
  </section>`;
}
export async function render(root) {
  setTitle('Your course');setScene(store.settings.level||'A1');
  function draw(){
    const lessons=lessonSessions(store);
    const expansions=store.learning.preferences?.expansions||[];
    root.innerHTML=html`<div class="course-page"><header><div class="kicker">Verbs & words · your pace</div><h1 class="display">Learn it. Use it. Come back to it.</h1><p>Follow a lesson from its first example to using it yourself. Practice changes with the parts you find difficult.</p></header>
      ${raw(coursePreview({onCourse:true}))}
      <div class="course-scope"><span>Your topics: ${describeScope(store.scope,store)}</span><a href="#/scope">Change topics</a></div>
      <section aria-labelledby="lessons-title"><h2 id="lessons-title">Your lessons</h2>
        ${lessons.length?raw(html`<ul class="course-skills">${raw(lessons.slice(0,16).map(({entry,session,step,progress})=>html`<li><div><strong>${entry.inf||entry.it}</strong><span>${step.type==='complete'?(progress.chapters.filter(c=>!c.optional).some(c=>c.pending.length)?'Some practice saved for later':'Lesson covered'):step.chapter?.title||'Continue your lesson'}</span><small>${session.ui?.paused?'Paused · your place is saved':step.type==='complete'?'Return whenever you want another try':'Continue from where you stopped'}</small></div><a class="btn secondary sm" href="${practiceHref(entry)}">${step.type==='complete'?'Revisit':'Continue'}</a></li>`).join(''))}</ul>`):raw('<p>Start with a word or verb from Learn. Your lessons will appear here, ready to resume.</p>')}
      </section>
      <section aria-labelledby="path-title"><h2 id="path-title">A lesson in one verb</h2><div class="course-stages">
        ${raw([['Meet the verb','Meaning, pronunciation and a useful situation.'],['Present','Learn the forms, then practise them in everyday use.'],['Completed past','Build the auxiliary and participle together.'],['Future','Learn the stem and endings, then talk about what comes next.'],['Put it together','Use the forms you have learned in clear situations.']].map(([title,description])=>html`<article class="course-stage glass-flat"><h3>${title}</h3><p>${description}</p></article>`).join(''))}
      </div><p class="small muted">Formal you is included throughout. Pause or save a difficult part for later whenever you need to.</p></section>
      <section><h2>Words have their own path</h2><p>Meet a meaning, learn the relevant forms, and use it in real examples. Nouns include their articles and number; other kinds of words get the practice they need.</p></section>
      <section class="course-expansions" aria-labelledby="extra-title"><h2 id="extra-title">Explore more when you’re ready</h2><p>After present, past and future, a verb lesson offers past habits and background with the imperfetto. You can also choose further forms below.</p>
        ${raw(EXPANSIONS.map(x=>html`<label class="course-expansion"><input type="checkbox" data-expansion="${x.id}" ${expansions.includes(x.id)?raw('checked'):''}><span><strong>${x.label}</strong><small>Available in the lesson’s chapter map</small></span></label>`).join(''))}
      </section><div class="course-actions"><a class="btn primary" href="#/learn">Choose a lesson</a><a class="btn secondary" href="#/review">Review</a><a class="btn ghost" href="#/reference">Full reference</a></div>
    </div>`;
  }
  const change=ev=>{const c=ev.target.closest('[data-expansion]');if(!c)return;const selected=new Set(store.learning.preferences?.expansions||[]);if(c.checked)selected.add(c.dataset.expansion);else selected.delete(c.dataset.expansion);store.setLearningPreference('expansions',[...selected]);toast(c.checked?'More forms are available in your lessons.':'Optional forms hidden. Your progress is kept.');draw();};
  root.addEventListener('change',change);draw();return()=>root.removeEventListener('change',change);
}
