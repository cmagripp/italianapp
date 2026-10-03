import { html, raw, sheet } from '../ui.js';
import { store } from '../store.js';
import { getEntry, withArticle } from '../data.js';
import { allSkills } from '../learning/model.js';
import { grammarLesson } from '../learning/grammar-course.js';

const CASES = { present:'Present', presente:'Present', past:'Passato prossimo', passatoProssimo:'Passato prossimo', background:'Imperfetto', imperfetto:'Imperfetto', future:'Future', futuro:'Future', condizionale:'Conditional' };
const SKILLS = { meaning:'Meaning', recall:'Recall', article:'Article', plural:'Plural', agreement:'Agreement', conjugation:'Verb forms', listening:'Listening', context:'Use in a sentence', 'course-completion':'Lesson finished' };
const date = at => at ? new Date(at).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' }) : '';
const label = value => SKILLS[value] || 'Practice';
function entryLabel(id) {
  const entry = getEntry(id);
  if (entry) return entry.kind === 'verb' ? entry.inf : entry.pos === 'noun' ? withArticle(entry) : entry.it;
  return grammarLesson(id)?.title || 'Earlier lesson';
}
function skillLabel(skill) {
  return [CASES[skill.chapterId || skill.tense], label(skill.skill)].filter(Boolean).join(' · ');
}
export function progressLabel(skill) {
  if (skill.kind === 'grammar') return skill.remembered ? 'Reviewed later' : skill.ready ? 'Practised independently' : 'Practising';
  if (skill.remembered) return 'Remembered';
  if (skill.ready) return 'Recalled';
  if (skill.recognitionRemembered) return 'Recognised again later';
  if (skill.recognitionReady) return 'Recognised';
  return 'Practising';
}
export function answerLabel(event) {
  if (event.outcome === 'ungraded') return 'Not scored';
  if (event.outcome === 'skipped') return 'Skipped';
  if (event.outcome === 'revealed') return 'Answer shown';
  const result = event.ok ? 'Correct' : 'Try again';
  const supported = event.assistance?.length || event.activityKind === 'guided' || event.grammarPhase === 'guided';
  return `${result} · ${supported ? 'with support' : event.mode === 'production' ? 'written answer' : 'recognition'}`;
}

// Read only. Completion choices and recognition answers are never promoted to
// written recall by this display; it uses the shared evidence model unchanged.
export function openLearningHistory({ opener } = {}) {
  const profile = store.current.id, learner = store.current.learnerId, epoch = store.learning.epoch.id;
  const current = () => store.current.id === profile && store.current.learnerId === learner && store.learning.epoch.id === epoch;
  const skills = allSkills(store.learning).filter(s => s.attempts > 0 || s.lastAt);
  const events = Object.values(store.learning.events || {}).sort((a,b) => b.at-a.at || (b.sequence||0)-(a.sequence||0) || b.id.localeCompare(a.id));
  let tab = 'skills', count = 30, search = '', closed = false;
  const dialog = sheet('', { title:'My practice', cls:'me-history-sheet', opener, onClose:cleanup });
  const guard = () => { if (!current()) dialog.close(); };
  store.addEventListener('profile', guard); store.addEventListener('change', guard);
  function cleanup() { if (closed) return; closed=true; store.removeEventListener('profile',guard); store.removeEventListener('change',guard); }
  function draw() {
    if (!current() || closed) return;
    const source = tab === 'skills' ? [...skills].sort((a,b)=>(b.lastAt||0)-(a.lastAt||0)) : events;
    const rows = source.filter(row => `${entryLabel(row.entryId)} ${skillLabel(row)}`.toLocaleLowerCase().includes(search));
    dialog.body.innerHTML = html`<p>Recognition means choosing or matching. Recall means answering without help. Remembered means successful recall in a later visit. Grammar tracks its own lesson checks as independent practice and later review. Marking a lesson complete does not change these records.</p>
      <div class="row gap" aria-label="Practice view"><button class="btn sm ${tab==='skills'?'secondary':'ghost'} grow" data-history-tab="skills" aria-pressed="${tab==='skills'}">Skills</button><button class="btn sm ${tab==='answers'?'secondary':'ghost'} grow" data-history-tab="answers" aria-pressed="${tab==='answers'}">Answer history</button></div>
      <label class="me-history-search">Find a word or lesson<input type="search" data-history-search value="${search}" placeholder="Search your practice"></label>
      <p class="small muted" role="status">${rows.length} ${tab==='skills'?'skills':'answers'}</p>
      <div data-history-results>${rows.length?raw(rows.slice(0,count).map(row=>html`<article class="me-history-row" data-history-row><div><b>${entryLabel(row.entryId)}</b><small>${skillLabel(row)}</small><time>${date(row.lastAt || row.at)}</time></div><span class="me-history-state">${tab==='skills'?progressLabel(row):answerLabel(row)}</span>${tab==='skills'&&row.unresolvedErrors?.length?raw('<p class="small muted">A little more practice will help here.</p>'):''}${tab==='answers'&&row.submission?.originalText?raw(html`<p class="me-history-answer">${row.submission.originalText}${row.submission.displayText && row.submission.displayText!==row.submission.originalText?` → ${row.submission.displayText}`:''}</p>`):''}</article>`).join('')):raw('<p>Your practice will appear here after you answer a lesson or review question.</p>')}</div>
      ${rows.length>count?raw('<button class="btn secondary block mt" data-history-more>Show more</button>'):''}`;
  }
  dialog.body.addEventListener('click', event => {
    if (!current()) { dialog.close(); return; }
    const button=event.target.closest('[data-history-tab]');
    if (button) { tab=button.dataset.historyTab; count=30; draw(); }
    if (event.target.closest('[data-history-more]')) { count+=30; draw(); }
  });
  dialog.body.addEventListener('input', event => {
    if (!event.target.matches('[data-history-search]')) return;
    const position=event.target.selectionStart; search=event.target.value.toLocaleLowerCase(); count=30; draw();
    const input=dialog.body.querySelector('[data-history-search]'); input?.focus();
    try { input?.setSelectionRange(position,position); } catch { /* Search inputs do not expose selection in every browser. */ }
  });
  draw(); return dialog;
}
