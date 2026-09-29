// Taught, resumable lessons. Sequencing and learning evidence live in journey.js;
// this view persists only the current input, assistance and presentation state.
import { html, raw, icon, speak, stopSpeech } from '../ui.js';
import { setTitle, setChrome } from '../app.js';
import { store } from '../store.js';
import { getEntry, itemsForScope } from '../data.js';
import { LEARNING_VERSION } from '../learning/model.js';
import { CORE_STAGES, EXPANSIONS } from '../learning/curriculum.js';
import { buildLesson } from '../learning/lesson-content.js';
import { buildJourneyQuestion } from '../learning/lesson-questions.js';
import { gradeQuestion } from '../learning/diagnose.js';
import { createJourneySession, currentJourneyStep, advanceJourney, recordJourneyAttempt,
  skipJourneyTarget, chooseJourneyChapter, journeyProgress, journeyAttempt, retryJourneyPending } from '../learning/journey.js';
import { recommendLesson as recommend, practiceHref } from '../learning/integration.js';

const uid = () => globalThis.crypto?.randomUUID?.() || `journey-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = x => JSON.parse(JSON.stringify(x));
const normalize = x => String(x || '').normalize('NFC').trim().toLocaleLowerCase('it').replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const nameOf = e => e.inf || e.it;
const texts = x => Array.isArray(x) ? x : x ? [x] : [];
const phaseName = step => step.type === 'teach' ? 'Learn' : step.phase === 'independent' ? 'Recall' : 'Practise';

function promptHTML(source) {
  const template = document.createElement('template');
  template.innerHTML = typeof source === 'string' ? source : '';
  const allowed = new Set(['DIV','SPAN','P','STRONG','EM','B','I','BR','SUP','SUB']);
  for (const el of [...template.content.querySelectorAll('*')].reverse()) {
    if (!allowed.has(el.tagName)) { el.replaceWith(document.createTextNode(el.textContent || '')); continue; }
    const classes = (el.getAttribute('class') || '').split(/\s+/).filter(c => /^[a-z][a-z0-9_-]{0,40}$/i.test(c));
    for (const attribute of [...el.attributes]) el.removeAttribute(attribute.name);
    if (classes.length) el.className = classes.join(' ');
  }
  return template.innerHTML;
}

export async function render(root, params = {}, query = {}) {
  const owner = store.current.id;
  if (store.learning.version > LEARNING_VERSION) {
    root.innerHTML = '<div class="empty"><h1>Update Parola to continue</h1><p>Your saved progress is safe. Reload the app to use this lesson.</p><button class="btn primary" data-reload>Reload</button></div>';
    root.querySelector('[data-reload]').onclick = () => location.reload();
    return;
  }
  let mode = query.mode === 'review' ? 'review' : 'lesson';
  const requested = Object.values(store.learning.sessions || {}).find(s => s.id === query.session);
  const suggestion = !params.id && !query.id && !requested ? recommend(store, { review: mode === 'review' }) : null;
  if (!query.mode && !params.id && !query.id) mode = requested?.mode === 'review' || suggestion?.mode === 'review' ? 'review' : 'lesson';
  const entryId = params.id || query.id || requested?.entryId || suggestion?.entry?.id;
  const entry = entryId ? getEntry(entryId) : itemsForScope(store.scope, store)[0];
  if (!entry) {
    root.innerHTML = entryId
      ? '<div class="empty"><h1>This lesson is unavailable</h1><p>Your other lessons and saved progress are safe.</p><a class="btn primary" href="#/learn">Back to Learn</a></div>'
      : '<div class="empty"><h1>Choose something to learn</h1><a class="btn primary" href="#/scope">Choose your topics</a></div>';
    return;
  }
  const plan = buildLesson(entry, { expansions: store.learning.preferences?.expansions || [] });
  const selectedExpansions = store.learning.preferences?.expansions || [];
  const extraTenses = new Set(EXPANSIONS.filter(x=>selectedExpansions.includes(x.id)).flatMap(x=>x.tenses));
  plan.chapters = plan.chapters.filter(c=>!c.optional || c.id==='background' || extraTenses.has(c.tense));
  const allTargets = plan.chapters.flatMap(c => c.groups.flatMap(g => g.targets || []));
  const oldObjective = query.objective || suggestion?.objectiveId;
  const objectiveChapter = oldObjective && plan.chapters.find(c => c.groups.some(g => g.targets.some(t => t.id === oldObjective))
    || (c.tense && oldObjective.includes(`::${c.tense}::`)));
  const chapterId = query.chapter || (mode === 'review' ? objectiveChapter?.id : null);
  const prior = requested?.journey ? requested : Object.values(store.learning.sessions || {})
    .filter(s => s.journey && s.entryId === entry.id && s.mode === mode).sort((a,b) => b.updatedAt-a.updatedAt)[0];
  const legacy = requested && !requested.journey ? requested : store.learning.sessions?.[`${entry.id}|${mode}`];
  const focusedReviewChanged = mode === 'review' && oldObjective && prior?.journey?.focusTargetId !== oldObjective;
  let session = prior && (!query.session || prior.id === query.session) && !focusedReviewChanged && !(mode === 'review' && prior.journey?.phase === 'complete' && query.session !== prior.id)
    ? clone(prior) : createJourneySession({ id: uid(), plan, now: Date.now(), mode, chapterId,
      targetId: mode === 'review' && allTargets.some(t => t.id === oldObjective) ? oldObjective : undefined });
  if (chapterId && !query.session && mode !== 'review') session = chooseJourneyChapter(plan, session, chapterId, { now: Date.now(), learning:store.learning });
  let ui = session.ui?.version === 2 ? session.ui : { version: 2, draft: '', assistance: [], exposures: {}, mapOpen: false };
  ui.exposures = ui.exposures && typeof ui.exposures === 'object' && !Array.isArray(ui.exposures)
    ? Object.fromEntries(Object.entries(ui.exposures).filter(([key,value])=>!['__proto__','prototype','constructor'].includes(key) && Number.isFinite(value) && value >= 0)) : {};
  ui.assistance = Array.isArray(ui.assistance) ? ui.assistance.filter(x=>['hint','visible-form','answer-audio','reveal'].includes(x)) : [];
  ui.draft = typeof ui.draft === 'string' ? ui.draft.slice(0,500) : '';
  ui.given = typeof ui.given === 'string' ? ui.given.slice(0,500) : '';
  if (ui.result && typeof ui.result === 'object' && !Array.isArray(ui.result)) {
    ui.result.feedback = typeof ui.result.feedback === 'string' ? ui.result.feedback : '';
    ui.result.components = Array.isArray(ui.result.components) ? ui.result.components.filter(x=>x&&typeof x.skill==='string'&&typeof x.ok==='boolean') : [];
  } else ui.result = null;
  ui.paused = ui.paused === true; ui.mapOpen = ui.mapOpen === true;
  let disposed = false, submitting = false, question = null;
  const stepNow = () => currentJourneyStep(plan, session, store.learning, Date.now());
  let step = stepNow();
  const save = () => {
    if (disposed || store.current.id !== owner) return;
    session.ui = ui; session.updatedAt = Date.now(); store.saveLearningSession(session);
  };
  const route = new URLSearchParams(); route.set('session', session.id);
  if (mode === 'review') route.set('mode', mode);
  history.replaceState(history.state, '', `#/learn/${entry.kind === 'verb' ? 'verb' : 'word'}/${encodeURIComponent(entry.id)}?${route}`);
  setTitle(`${nameOf(entry)} · lesson`); setChrome({ tabs: false, back: true }); store.pushRecent(entry.id);

  function expose(answer) {
    for (const a of texts(answer)) if (normalize(a)) ui.exposures[normalize(a)] = session.index || 0;
  }
  function prepare() {
    step = stepNow();
    if (step.chapter && mode === 'lesson') {
      const currentStage = CORE_STAGES.findIndex(s=>s.id===store.learning.preferences.stage);
      const nextStage = CORE_STAGES.findIndex(s=>s.id===step.chapter.id);
      if (nextStage > currentStage) store.setLearningPreference('stage',step.chapter.id);
    }
    if (step.type === 'question') {
      question = buildJourneyQuestion(entry, step.chapter, step.target, {
        variant: step.variant || 0, format: step.format || 'type', phase: step.phase, repairTag: step.repairTag,
      });
      if (question && ui.questionId !== step.questionId) {
        ui.questionId = step.questionId; ui.draft = ''; ui.given = ''; ui.result = null;
        ui.hint = false; ui.forms = false; ui.assistance = [];
        for (const answer of question.meta?.exposureForms || question.answer || []) {
          const last = ui.exposures[normalize(answer)];
          if (typeof last === 'number' && (session.index || 0) - last < 2) ui.assistance.push('visible-form');
        }
        expose(question.meta?.promptExposureForms);
        for (const choice of question.choices || []) expose(choice.value ?? choice.label);
      }
    } else question = null;
    save();
  }
  function formsHTML(forms = []) {
    if (!forms.length) return '';
    return html`<table class="journey-forms"><tbody>${raw(forms.map(row => html`<tr><td>${row.label}${row.gloss ? raw(html`<small>${row.gloss}</small>`) : ''}</td><td lang="it">${row.form}</td></tr>`).join(''))}</tbody></table>`;
  }
  function examplesHTML(examples = []) {
    return examples.map(ex => html`<div class="journey-example"><div class="journey-example-line"><p lang="it">${ex.it}</p><button type="button" class="journey-audio" data-say="${ex.it}" aria-label="Listen to the example">${raw(icon('speaker', { size: 19 }))}</button></div>${ex.en ? raw(html`<p class="journey-translation">${ex.en}</p>`) : ''}</div>`).join('');
  }
  function cardHTML(card, { title = true } = {}) {
    if (!card) return '';
    return html`${title ? raw(html`<h1 data-focus tabindex="-1">${card.title}</h1>`) : ''}
      ${raw(texts(card.body).map(p => html`<p>${p}</p>`).join(''))}
      ${raw(formsHTML(card.forms))}
      ${raw(texts(card.notes).map(p => html`<p class="journey-note">${p}</p>`).join(''))}
      ${raw(examplesHTML(card.examples))}`;
  }
  function revealTeaching(card) {
    expose(card?.exposureForms);
    for (const row of card?.forms || []) expose(String(row.form).split(/\s*\/\s*/));
    // Track complete answers found in prose/examples as well as isolated forms.
    const shown = normalize([card?.body, ...(card?.notes || []), ...(card?.examples || []).map(x=>x.it)].join(' '));
    for (const target of step.chapter?.groups?.flatMap(g=>g.targets || []) || []) {
      const q = buildJourneyQuestion(entry, step.chapter, target, { variant: 0, format: 'type' });
      for (const a of q?.answer || []) if (a && shown.includes(normalize(a))) expose(a);
    }
  }
  function primary(label, attrs = 'data-continue') { return html`<button type="button" class="btn primary journey-primary" ${raw(attrs)}>${label}</button>`; }
  function repairHTML() {
    const cards = step.chapter?.groups.flatMap(g => g.cards || []) || [];
    const cardId = ['auxiliary','auxiliaryPerson'].includes(step.repairTag) ? 'auxiliary'
      : ['participle','agreement'].includes(step.repairTag) && entry.kind === 'verb' ? 'participle' : null;
    const card = cards.find(c => c.id === cardId) || step.card || step.group?.cards?.[0];
    revealTeaching(card);
    if (!step.helpSuggested) return html`<h1 data-focus tabindex="-1">Let’s work on this part</h1>${ui.result?.feedback ? raw(html`<p>${ui.result.feedback}</p>`) : ''}${raw(cardHTML(card, { title: false }))}`;
    const model = buildJourneyQuestion(entry, step.chapter, step.target, { variant: session.journey.lastAttempt?.variant || 0, format: 'type', phase: 'independent' });
    if (!model) return cardHTML(card);
    expose(model.answer);
    const answer = model.answer[0], compound = model.meta?.diagnostic?.compound;
    const pieces = answer.split(' ');
    const labels = {auxiliary:'auxiliary',participle:'past participle',person:'person',clitic:'pronoun',article:'article',plural:'plural'};
    const kept = (ui.result?.components || []).filter(c=>c.ok&&labels[c.skill]).map(c=>labels[c.skill]);
    const rows = compound && pieces.length > 1 ? [
      ...(pieces.length > 2 ? [{label:'Pronoun',form:pieces.slice(0,-2).join(' ')}] : []),
      {label:'Auxiliary',form:pieces.at(-2)}, {label:'Past participle',form:pieces.at(-1)},
    ] : [{label:'Requested form',form:answer}];
    return html`<h1 data-focus tabindex="-1">Let’s work through an example</h1>
      ${kept.length ? raw(html`<p>You already had the ${kept.join(' and ')} right. Keep that part as you build the answer.</p>`) : ''}
      ${ui.result?.feedback ? raw(html`<p>${ui.result.feedback}</p>`) : ''}
      <div class="journey-prompt">${raw(promptHTML(model.prompt))}</div>${raw(formsHTML(rows))}
      ${model.context ? raw(examplesHTML([model.context])) : raw(html`<p class="journey-answer" lang="it">${answer}</p>`)}
      <p>${model.tip || 'Use the model to connect the meaning with its form. We’ll practise a smaller step next.'}</p>
      <p class="journey-note">You can take your time, pause, or save this part for later.</p>`;
  }
  function feedbackHTML() {
    const result = ui.result;
    if (!result || !question) return '';
    const correct = question.answer?.[0] || '';
    const explanation = result.ok ? (question.explanation || (result.accentIssue ? result.feedback : '')) : result.feedback;
    return html`<aside class="journey-feedback ${result.ok ? 'is-correct' : ''}" role="status" aria-live="polite" aria-atomic="true">
      <h2>${result.ok ? 'That’s right.' : result.outcome === 'revealed' ? 'Here’s the answer.' : `Use ${correct}.`}</h2>
      ${!question.choices?.length ? raw(html`<p class="journey-given"><span>Your answer</span><span lang="it">${ui.given || '—'}</span></p>`) : ''}
      ${!result.ok ? raw(html`<p class="journey-answer" lang="it">${correct}</p>`) : ''}
      ${explanation ? raw(html`<p>${explanation}</p>`) : ''}
      ${!result.ok ? raw('<p class="journey-note">We’ll work on this part together, then try another example.</p>') : ''}
    </aside>`;
  }
  function exerciseHTML() {
    if (!question) return html`<h1 data-focus tabindex="-1">Let’s use the reference</h1><p>There isn’t a reliable exercise for this part yet. You can read its examples and continue.</p>${raw(primary('Continue with this part saved', 'data-skip'))}<a class="btn secondary" href="#/reference/${encodeURIComponent(entry.id)}">Examples and forms</a>`;
    const answered = !!step.awaitingContinue;
    const choices = question.choices || [];
    const typed = !choices.length;
    return html`<div class="journey-prompt" data-focus tabindex="-1">${raw(promptHTML(question.prompt))}</div>
      ${choices.length ? raw(html`<p class="journey-note">${answered ? '' : step.format === 'match' ? 'Tap the matching form.' : 'Tap an answer.'}</p><div class="journey-choices">${raw(choices.map((c,i) => {
        const value = c.value ?? c.label;
        const chosen = normalize(ui.given) === normalize(value);
        const right = (question.answer || []).some(a => normalize(a) === normalize(value)) || c.correct === true;
        return html`<button type="button" data-choice="${i}" class="journey-choice ${answered && right ? 'is-correct' : answered && chosen ? 'is-wrong' : ''}" ${answered ? raw('disabled') : ''} aria-pressed="${chosen}"><span lang="it">${c.label}</span>${answered && (right || chosen) ? raw(html`<small>${right ? 'Correct' : 'Your answer'}</small>`) : ''}</button>`;
      }).join(''))}</div>`) : raw(html`<form data-answer-form autocomplete="off"><label for="journey-answer">${question.meta?.answerLanguage === 'en' ? 'Your answer in English' : 'Your answer in Italian'}</label><input id="journey-answer" data-answer type="text" value="${ui.draft || ''}" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" ${answered ? raw('readonly') : ''}>
      ${answered ? '' : raw(html`<div class="journey-accents" aria-label="Accented letters">${raw(['à','è','é','ì','ò','ù',"'"].map(c=>html`<button type="button" data-letter="${c}" aria-label="Insert ${c}">${c}</button>`).join(''))}</div><button type="submit" class="btn primary journey-primary" data-check ${ui.draft?.trim() ? '' : raw('disabled')}>Check answer</button>`)}</form>`)}
      ${answered ? raw(feedbackHTML()) : ''}
      ${ui.hint && !answered ? raw(html`<aside class="journey-help"><h2>A hint</h2><p>${question.tip || step.target?.explanation || 'Look at the person and the form you are practising.'}</p>${ui.forms ? raw((step.group?.cards || []).map(c=>cardHTML(c, { title: false })).join('')) : raw('<button type="button" class="btn ghost" data-show-forms>Show the lesson</button>')}</aside>`) : ''}
      ${answered ? raw(primary('Continue')) : ''}
      ${!answered ? raw(html`<div class="journey-tools"><button type="button" class="btn ghost" data-help aria-expanded="${!!ui.hint}">${ui.hint ? 'Close help' : 'Help me'}</button><button type="button" class="btn ghost" data-reveal>Show answer</button><button type="button" class="btn ghost" data-skip>Skip · save for later</button></div>${question.say ? raw(html`<button type="button" class="journey-listen" data-answer-audio>${raw(icon('speaker', { size: 17 }))} ${question.meta?.audioIsPrompt ? 'Listen to the question' : 'Hear the form'}</button>`) : ''}`) : ''}`;
  }
  function summaryHTML(complete) {
    const progress = journeyProgress(plan, session, store.learning);
    const summaries = progress.chapters || [];
    const pending = complete ? summaries.filter(c=>!c.optional).flatMap(c=>c.pending) : summaries.find(c=>c.id===step.chapter?.id)?.pending || [];
    const optional = plan.chapters.filter(c => c.optional);
    const next = recommend(store, { kind: entry.kind });
    return html`<h1 data-focus tabindex="-1">${complete ? 'A little more Italian.' : `Your progress · ${step.chapter?.title || 'this chapter'}`}</h1>
      <p>${pending.length ? 'A few parts could use another try. Keep practising, or save them for later and move on.' : complete ? 'You’ve worked through this lesson. We’ll bring these forms back as you keep learning.' : 'You’ve learned the forms and used them in practice. They’ll return as you continue.'}</p>
      ${!complete && pending.length ? raw(primary('Practise these forms', 'data-retry')) : ''}
      ${!complete ? raw(primary(pending.length ? 'Continue with these forms saved for later' : mode === 'review' ? 'Finish this review' : 'Continue to the next part')) : next && next.entry.id !== entry.id ? raw(html`<a class="btn primary journey-primary" href="${practiceHref(next.entry)}">Learn ${nameOf(next.entry)}</a>`) : raw('<a class="btn primary journey-primary" href="#/learn">Keep learning</a>')}
      ${complete && optional.length ? raw(html`<section class="journey-extras"><h2>Explore more</h2><p>When you’re ready, add these forms to this verb.</p>${raw(optional.map(c=>html`<button type="button" class="btn secondary" data-chapter="${c.id}">${c.title}</button>`).join(''))}</section>`) : ''}
      <button type="button" class="btn ghost" data-map>Choose a chapter</button><a class="btn ghost" href="#/review">Review another day</a>`;
  }
  function draw(focus = false) {
    if (disposed || store.current.id !== owner) return;
    prepare();
    const paused = !!ui.paused;
    const feedback = step.type === 'question' && step.awaitingContinue;
    const phase = paused ? 'paused' : feedback ? 'feedback' : step.type;
    const answerIsName = question?.answer?.some(a => normalize(a) === normalize(nameOf(entry)));
    const hideName = step.type === 'question' && (entry.kind === 'word' || !feedback && answerIsName);
    const hideMeaning = step.type === 'question' && !feedback && question?.answer?.some(a => normalize(plan.meaning).includes(normalize(a)));
    setTitle(hideName ? entry.kind === 'verb' ? 'Verb lesson' : 'Word lesson' : `${nameOf(entry)} · lesson`);
    const core = plan.chapters.filter(c => !c.optional);
    const idx = core.findIndex(c => c.id === step.chapter?.id);
    const stage = phaseName(step);
    if (step.type === 'complete' && mode === 'lesson' && journeyProgress(plan,session,store.learning).complete && !store.isLearned(entry.id)) store.markLearned(entry.id,entry.kind);
    let content;
    if (paused) content = html`<h1 data-focus tabindex="-1">Your place is saved</h1><p>Come back to this question whenever you’re ready.</p>${raw(primary('Resume lesson', 'data-resume'))}<a class="btn ghost" href="#/learn">Back to Learn</a>`;
    else if (step.type === 'teach') {
      revealTeaching(step.card);
      content = html`${raw(cardHTML(step.card))}${raw(primary('Continue'))}<button type="button" class="btn ghost" data-skip>Skip · save for later</button>`;
    } else if (step.type === 'question') content = exerciseHTML();
    else if (step.type === 'repair') content = html`${raw(repairHTML())}${raw(primary('Try it together'))}<button type="button" class="btn ghost" data-skip>Skip · save for later</button>`;
    else if (step.type === 'recap' || step.type === 'complete') content = summaryHTML(step.type === 'complete');
    else if (step.type === 'unavailable') content = html`<h1 data-focus tabindex="-1">This saved lesson cannot open yet</h1><p>Its saved progress is preserved. Reload the app to check for an update, or return to your other lessons.</p><a class="btn primary" href="#/learn">Back to Learn</a>`;
    else content = html`<h1 data-focus tabindex="-1">Save this part for later</h1><p>We need another useful example before checking this part again. Your practice so far is saved.</p>${raw(primary('Continue with this part saved', 'data-skip'))}<a class="btn ghost" href="#/reference/${encodeURIComponent(entry.id)}">Read the available examples</a>`;
    root.innerHTML = html`<div class="journey-page" data-journey data-phase="${phase}" data-chapter="${step.chapter?.id || ''}" data-group="${step.group?.id || ''}" data-target="${step.target?.id || ''}">
      <header class="journey-header"><div class="journey-top"><a href="#/learn" aria-label="Back to Learn">parola</a><button type="button" class="btn ghost" data-pause ${paused ? raw('hidden') : ''}>Pause</button></div>
      <div class="journey-title"><strong>${hideName ? entry.kind === 'verb' ? 'Your verb lesson' : 'Your word lesson' : plan.title || nameOf(entry)}</strong>${!hideName && !hideMeaning && plan.meaning ? raw(html`<span>${plan.meaning}</span>`) : ''}</div>
      <button type="button" class="journey-map-toggle" data-map aria-expanded="${!!ui.mapOpen}"><span>${mode === 'review' ? 'Review · ' : ''}${step.chapter?.title || 'Lesson recap'}${idx >= 0 ? ` · Chapter ${idx + 1} of ${core.length}` : ''}</span><span aria-hidden="true">⌄</span></button>
      ${ui.mapOpen ? raw(html`<nav class="journey-map" aria-label="Lesson chapters">${raw(plan.chapters.map(c=>html`<button type="button" data-chapter="${c.id}" aria-current="${step.chapter?.id === c.id ? 'step' : 'false'}">${c.title}${c.optional ? raw('<small>Explore more</small>') : ''}</button>`).join(''))}</nav>`) : ''}
      <ol class="journey-stages" aria-label="Chapter stages">${raw(['Learn','Practise','Recall'].map(label=>html`<li ${label === stage ? raw('aria-current="step"') : ''}>${label}</li>`).join(''))}</ol></header>
      <main class="journey-main">${legacy && !prior && !ui.legacyDismissed ? raw(html`<aside class="journey-legacy"><p>Your previous practice is saved.</p><a href="${practiceHref(entry, null, mode)}${mode === 'lesson' ? '?' : '&'}legacy=1&session=${encodeURIComponent(legacy.id)}">Resume your previous question</a><button type="button" data-dismiss-legacy aria-label="Dismiss saved question notice">×</button></aside>`) : ''}${raw(content)}</main>
    </div>`;
    if (focus) requestAnimationFrame(() => root.querySelector('[data-focus]')?.focus({ preventScroll: true }));
    save();
  }
  async function submit(given, revealed = false) {
    if (submitting || ui.paused || step.type !== 'question' || step.awaitingContinue || !question || store.current.id !== owner) return;
    if (!revealed && !String(given || '').trim()) return;
    submitting = true;
    try {
      stopSpeech(); document.activeElement?.blur?.();
      const result = gradeQuestion(question, given, { revealed, assistance: ui.assistance, accentStrict: store.settings.accentStrict });
      ui.given = String(given || '').slice(0,500); ui.draft = ui.given;
      const event = journeyAttempt(plan, session, question, result, { assistance: [...ui.assistance, ...(revealed ? ['reveal'] : [])], now: Date.now() });
      const recorded = store.recordLearningAttempt(event);
      session = recordJourneyAttempt(plan, session, recorded.event || event, { ...recorded, ...result });
      ui.result = { ok: result.ok, outcome: result.outcome, feedback: result.feedback, accentIssue: result.accentIssue, errorTags: result.errorTags || [], components: result.components || [] };
      expose(question.answer);
      expose(question.meta?.feedbackExposureForms);
      for (const c of question.choices || []) expose(c.value ?? c.label);
      save(); draw();
      root.querySelector('.journey-feedback')?.scrollIntoView({ block:'nearest', behavior:'instant' });
    } finally { submitting = false; }
  }
  const click = ev => {
    const b = ev.target.closest('button'); if (!b || b.disabled || !root.contains(b)) return;
    if (b.hasAttribute('data-choice')) { const c=question?.choices?.[Number(b.dataset.choice)]; if(c) submit(c.value ?? c.label); return; }
    if (b.hasAttribute('data-continue')) { session=advanceJourney(plan,session,store.learning,{now:Date.now()}); ui.paused=false; save(); draw(true); }
    else if (b.hasAttribute('data-pause')) { ui.paused=true;stopSpeech();save();draw(true); }
    else if (b.hasAttribute('data-resume')) { ui.paused=false;save();draw(true); }
    else if (b.hasAttribute('data-map')) { ui.mapOpen=!ui.mapOpen;draw(); }
    else if (b.hasAttribute('data-chapter')) { session=chooseJourneyChapter(plan,session,b.dataset.chapter,{now:Date.now(),learning:store.learning});ui.mapOpen=false;ui.paused=false;ui.questionId=null;save();draw(true); }
    else if (b.hasAttribute('data-skip')) { session=skipJourneyTarget(plan,session,step.target?.id,{now:Date.now(),learning:store.learning});save();draw(true); }
    else if (b.hasAttribute('data-retry')) { session=retryJourneyPending(plan,session,store.learning,{now:Date.now()});save();draw(true); }
    else if (b.hasAttribute('data-help')) { ui.hint=!ui.hint;if(ui.hint&&!ui.assistance.includes('hint'))ui.assistance.push('hint');save();draw(); }
    else if (b.hasAttribute('data-show-forms')) { ui.forms=true;if(!ui.assistance.includes('visible-form'))ui.assistance.push('visible-form');for(const c of step.group?.cards||[])revealTeaching(c);save();draw(); }
    else if (b.hasAttribute('data-reveal')) submit('',true);
    else if (b.hasAttribute('data-answer-audio')) { if(!question.meta?.audioIsPrompt&&!ui.assistance.includes('answer-audio'))ui.assistance.push('answer-audio');save();speak(question.say); }
    else if (b.hasAttribute('data-say')) speak(b.dataset.say);
    else if (b.hasAttribute('data-dismiss-legacy')) { ui.legacyDismissed=true;draw(); }
    else if (b.hasAttribute('data-letter')) { const input=root.querySelector('[data-answer]');if(!input)return;const at=input.selectionStart??input.value.length;const end=input.selectionEnd??at;input.value=input.value.slice(0,at)+b.dataset.letter+input.value.slice(end);ui.draft=input.value;input.focus();input.setSelectionRange(at+1,at+1);root.querySelector('[data-check]').disabled=!input.value.trim();save(); }
  };
  const input = ev => { if(ev.target.matches('[data-answer]')) {ui.draft=ev.target.value.slice(0,500);const b=root.querySelector('[data-check]');if(b)b.disabled=!ui.draft.trim();save();} };
  const form = ev => { if(ev.target.matches('[data-answer-form]')) {ev.preventDefault();submit(ui.draft);} };
  root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('submit',form);
  draw();
  return () => { save();disposed=true;stopSpeech();root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('submit',form); };
}
