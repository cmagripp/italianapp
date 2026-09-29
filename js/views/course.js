import { html, raw, icon, toast } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, headword, describeScope } from '../data.js';
import { CORE_STAGES, EXPANSIONS } from '../learning/curriculum.js';
import { courseProgress, eligibleSkills, recommend, practiceHref, reviewItems } from '../learning/integration.js';
import { setScene } from '../fx.js';

export function coursePreview({ onCourse = false } = {}) {
  const next = recommend(store);
  const stage = CORE_STAGES.find(s => s.id === store.learning.preferences?.stage) || CORE_STAGES[0];
  const n = reviewItems(store).length;
  return html`<section class="course-preview glass pad-l">
    <div class="kicker">Your learning path</div><h2 class="display">Everyday Italian</h2>
    <p>${stage.label} · learn, practice, remember.</p>
    <p class="small muted">${next?.reason || 'Choose a topic and build your skills step by step.'}</p>
    <div class="course-actions">${next ? raw(html`<a class="btn primary" href="${practiceHref(next.entry, next.objectiveId, next.mode)}">${next.session ? 'Resume practice' : 'Start practice'} ${raw(icon('arrow', { size: 18 }))}</a>`) : ''}<a class="btn secondary" href="${onCourse ? '#/review' : '#/course'}">${onCourse ? 'Review' : 'My course'}${n ? ` · ${n} to review` : ''}</a></div>
  </section>`;
}

export async function render(root) {
  setTitle('Your course'); setScene(store.settings.level || 'A1');
  function draw() {
    const stages = courseProgress(store);
    const current = store.learning.preferences?.stage || 'present';
    const completed = stages.every(s => s.complete);
    const skills = eligibleSkills(store).sort((a, b) => (a.ready ? 1 : 0) - (b.ready ? 1 : 0) || b.lastAt - a.lastAt);
    const currentIndex = stages.findIndex(s => s.id === current);
    const currentStage = stages[currentIndex];
    const nextStage = stages[currentIndex + 1];
    const expansions = store.learning.preferences?.expansions || [];
    root.innerHTML = html`<div class="course-page">
      <header><div class="kicker">Verbs & words · your pace</div><h1 class="display">${completed ? 'Everyday course complete.' : 'A little more confident, every day.'}</h1>
      <p>${completed ? 'Keep your everyday skills fresh, or explore more forms below.' : 'One skill at a time. Your mistakes shape the practice; repeated independent answers move you forward.'}</p></header>
      ${raw(coursePreview({ onCourse: true }))}
      ${currentStage?.ready === currentStage?.total && nextStage ? raw(html`<aside class="course-preview glass pad-l"><h2>Ready to add ${nextStage.label.toLowerCase()}?</h2><p>You have demonstrated this stage’s foundation skills. We’ll keep checking them later while you learn something new.</p><button class="btn primary" data-stage="${nextStage.id}">Continue to ${nextStage.label}</button></aside>`) : ''}
      <div class="course-scope"><span>Practice scope: ${describeScope(store.scope, store)}</span><a href="#/scope">Change scope</a></div>
      <section aria-labelledby="core-title"><h2 id="core-title">Present, past and future</h2><p class="small muted">Choose a stage anytime. Moving ahead keeps unfinished skills for later; it does not mark them mastered.</p>
      <div class="course-stages">${raw(stages.map((s, i) => html`<article class="course-stage glass-flat ${current === s.id ? 'is-current' : ''}">
        <div class="kicker">${i === 0 ? 'Present' : i < 3 ? 'Past' : 'Future'} · ${i + 1} of 4</div><h3>${s.label}</h3><p>${s.description || ''}</p>
        <div class="small">${s.ready} / ${s.total} milestones ready · ${s.remembered} remembered later</div>
        <progress value="${s.remembered}" max="${s.total || 1}" aria-label="${s.label}: ${s.remembered} of ${s.total} milestones remembered later"></progress>
        <button class="btn ${current === s.id ? 'primary' : 'secondary'}" data-stage="${s.id}" aria-pressed="${current === s.id}">${current === s.id ? 'Practicing this stage' : 'Choose this stage'}</button>
        <details><summary>See milestones</summary><p class="small muted">Course checkpoints use a small foundation set of verbs. Selecting one explicitly practices that verb, even outside your normal scope.</p><ul class="course-milestones">${raw(s.checkpoints.map(c => {
          const e = getEntry(c.objective.entryId);
          return html`<li><span><strong>${e ? headword(e) : c.objective.entryId}</strong> · ${c.objective.label}<small>${c.remembered ? 'Remembered later' : c.ready ? 'Ready · check again later' : !c.coverage && c.state.ready ? 'Practice remaining persons' : 'Still practicing'}</small></span><button class="btn sm ghost" data-checkpoint-stage="${s.id}" data-checkpoint="${c.objective.id}" data-entry="${c.objective.entryId}">Practice</button></li>`;
        }).join(''))}</ul></details>
      </article>`).join(''))}</div></section>
      <section aria-labelledby="skills-title"><h2 id="skills-title">What you're building</h2>
      ${skills.length ? raw(html`<ul class="course-skills">${raw(skills.slice(0, 16).map(s => { const e = getEntry(s.entryId); return html`<li><div><strong>${headword(e)}</strong><span>${s.skill.replace(/[-_]/g, ' ')}${s.tense ? ' · ' + s.tense : ''}</span><small>${s.remembered ? 'Remembered later' : s.ready ? 'Ready for the next step' : `${s.independentCorrect || 0} independent successes · practicing`}</small></div><a class="btn sm secondary" href="${practiceHref(e, s.objectiveId, s.ready ? 'review' : 'lesson')}">Practice</a></li>`; }).join(''))}</ul>`) : raw('<p>Begin a lesson to see your strengths and the skills that need another try. Previous learned words and XP have been kept; new skill evidence starts with your answers.</p>')}
      </section>
      <section class="course-expansions" aria-labelledby="extra-title"><h2 id="extra-title">Explore more when you're ready</h2><p>Optional forms stay out of automatic practice until you choose them. Turning one off keeps your progress.</p>
      ${raw(EXPANSIONS.map(x => html`<label class="course-expansion"><input type="checkbox" data-expansion="${x.id}" ${expansions.includes(x.id) ? raw('checked') : ''}><span><strong>${x.label}</strong><small>${x.description || 'Optional additional verb forms'}</small></span></label>`).join(''))}
      </section><div class="course-actions"><a class="btn secondary" href="#/learn">Back to Learn</a><a class="btn ghost" href="#/reference">Full reference</a></div>
    </div>`;
  }
  const click = ev => {
    const stage = ev.target.closest('[data-stage]');
    if (stage) { store.setLearningPreference('stage', stage.dataset.stage); draw(); toast('Learning stage updated. Your progress is kept.'); }
    const checkpoint = ev.target.closest('[data-checkpoint]');
    if (checkpoint) {
      store.setLearningPreference('stage', checkpoint.dataset.checkpointStage);
      const e = getEntry(checkpoint.dataset.entry);
      if (e) location.hash = practiceHref(e, checkpoint.dataset.checkpoint, 'checkpoint');
    }
  };
  const change = ev => {
    const c = ev.target.closest('[data-expansion]'); if (!c) return;
    const selected = new Set(store.learning.preferences?.expansions || []);
    if (c.checked) selected.add(c.dataset.expansion); else selected.delete(c.dataset.expansion);
    store.setLearningPreference('expansions', [...selected]);
    toast(c.checked ? 'Optional forms added to your practice.' : 'Optional forms paused. Progress kept.'); draw();
  };
  root.addEventListener('click', click); root.addEventListener('change', change); draw();
  return () => { root.removeEventListener('click', click); root.removeEventListener('change', change); };
}
