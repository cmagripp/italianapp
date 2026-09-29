// One active learning objective, with repeated independent checks and an explicit way to pause or defer it.
// Persist the question recipe, never question HTML; rebuilding it also validates imported sessions against the curriculum.
import { html, raw, icon, speak, stopSpeech } from '../ui.js';
import { setTitle, setChrome } from '../app.js';
import { store } from '../store.js';
import { getEntry, itemsForScope } from '../data.js';
import { objectivesFor, allowedTenses, CORE_STAGES, stageObjectives } from '../learning/curriculum.js';
import { buildQuestion } from '../learning/questions.js';
import { gradeQuestion } from '../learning/diagnose.js';
import { createSession, selectNext, applySessionAttempt, deferObjective, skillState, allSkills, LEARNING_VERSION } from '../learning/model.js';
import { recommend, practiceHref } from '../learning/integration.js';

const VERSION = 1;
const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => globalThis.crypto?.randomUUID?.() || `lesson-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalize = text => String(text || '').normalize('NFC').trim().toLocaleLowerCase('it').replace(/\s+/g, ' ');
const entryName = entry => entry.inf || entry.it;
const safeText = value => typeof value === 'string' ? value : '';
const stageName = stage => (Array.isArray(CORE_STAGES) ? CORE_STAGES.find(s => (s.id || s.key) === stage)?.label : CORE_STAGES?.[stage]?.label) || ({ present: 'Present · now and routines', past: 'Past · what happened', completedPast: 'Past · what happened', background: 'Past · how things were', future: 'Future · plans and predictions' }[stage]) || 'Everyday Italian';
const rngFor = seed => { let state = Number(seed) >>> 0; return () => { state += 0x6D2B79F5; let n = Math.imul(state ^ state >>> 15, 1 | state); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; };

// Prompts originate in our question module. Keep a small allowlist even there so imported/custom entry text cannot
// become active content if a future question author accidentally forgets to escape it.
function promptHTML(source) {
  const template = document.createElement('template');
  template.innerHTML = safeText(source);
  const allowed = new Set(['DIV', 'SPAN', 'P', 'STRONG', 'EM', 'B', 'I', 'BR', 'SUP', 'SUB']);
  for (const element of [...template.content.querySelectorAll('*')].reverse()) {
    if (!allowed.has(element.tagName)) { element.replaceWith(document.createTextNode(element.textContent || '')); continue; }
    const classes = (element.getAttribute('class') || '').split(/\s+/).filter(c => /^[a-z][a-z0-9_-]{0,40}$/i.test(c));
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
    if (classes.length) element.className = classes.join(' ');
  }
  return template.innerHTML;
}

export async function render(root, params = {}, query = {}) {
  const ownerId = store.current.id;
  if (store.learning.version > LEARNING_VERSION) {
    setTitle('Update Parola');
    root.innerHTML = '<div class="adaptive-learn"><article class="adaptive-card glass"><h1>Your progress needs a newer version</h1><p>This progress was saved by a newer version. Update or reload Parola before continuing. Your saved learning has been preserved.</p><button type="button" class="btn primary block" data-refresh-app>Reload Parola</button><a class="btn secondary block" href="#/profile">Profile and backups</a></article></div>';
    root.querySelector('[data-refresh-app]').addEventListener('click', () => location.reload());
    return;
  }
  const mode = query.mode === 'checkpoint' ? 'checkpoint' : query.mode === 'review' || location.hash.startsWith('#/review') ? 'review' : 'lesson';
  if (!params.id && !query.id) {
    const requestedSession = query.session && Object.values(store.learning.sessions || {}).find(s => s.id === query.session);
    if (requestedSession) return render(root, { id: requestedSession.entryId }, { ...query, mode: requestedSession.mode, ...(requestedSession.objectiveIds.length === 1 ? { objective: requestedSession.objectiveIds[0] } : {}) });
    const suggestion = recommend(store, { review: mode === 'review' });
    if (suggestion?.entry) return render(root, { id: suggestion.entry.id }, { ...query, mode: suggestion.mode || mode, ...(suggestion.objectiveId ? { objective: suggestion.objectiveId } : {}), ...(suggestion.session ? { session: suggestion.session.id } : {}) });
  }
  const domain = () => store.learning;
  const preferences = domain().preferences || {};
  const stage = query.stage || preferences.stage || domain().curriculum?.stage || 'present';
  const expansions = preferences.expansions || domain().curriculum?.expansions || [];
  const scoped = itemsForScope(store.scope, store);
  const savedLast = domain().session;
  const requestedId = params.id || query.id;
  const entry = requestedId ? getEntry(requestedId) : getEntry(savedLast?.mode === mode ? savedLast.entryId : null) || scoped.find(e => !store.isLearned(e.id)) || scoped[0];
  if (!entry) {
    root.innerHTML = '<div class="empty"><h1>Choose something to practice</h1><p>Your current scope has no available entries.</p><a class="btn primary" href="#/scope">Choose a scope</a></div>';
    return;
  }
  const entryObjectives = objectivesFor(entry, { stage, expansions });
  const requiredObjectives = entryObjectives.filter(o => o.required !== false && !o.optional);
  let objectives = query.objective ? entryObjectives.filter(o => o.id === query.objective) : requiredObjectives;
  if (mode === 'checkpoint') {
    const checkpoints = stageObjectives(scoped.filter(e => e.kind === 'verb').concat(entry), stage);
    objectives = objectives.map(o => ({ ...o, ...(checkpoints.find(c => c.id === o.id) || {}) }));
  }
  if (!objectives.length) {
    root.innerHTML = html`<div class="empty"><h1>This step is not available</h1><p>Choose a step in your current course to continue. Your previous practice is saved.</p><a class="btn primary" href="#/learn">Choose a step</a><a class="btn secondary" href="#/reference/${encodeURIComponent(entry.id)}">Open reference</a></div>`;
    return;
  }
  // Supplemental descriptors only space the active check. They never enter the session's required objective list.
  const scopeIds = new Set(scoped.map(e => e.id));
  const familiarIds = new Set(allSkills(domain()).filter(s => scopeIds.has(s.entryId) && s.entryId !== entry.id).map(s => s.entryId));
  const freshSpacers = scoped.filter(e => e.id !== entry.id && !familiarIds.has(e.id) && e.kind === entry.kind).slice(0, 2)
    .flatMap(e => objectivesFor(e, { stage, expansions }).filter(o => o.skill === 'recall' || o.skill === 'meaning').slice(0, 1).map(o => ({ ...o, spacerOnly: true })));
  const supplemental = [...entryObjectives, ...[...familiarIds].slice(0, 8).flatMap(id => objectivesFor(getEntry(id), { stage, expansions })), ...freshSpacers];
  const descriptors = [...new Map([...supplemental, ...objectives].map(o => [o.id, o])).values()];
  const saved = query.session ? Object.values(domain().sessions || {}).find(s => s.id === query.session) : domain().sessions?.[`${entry.id}|${mode}`] || savedLast;
  const matches = saved && saved.entryId === entry.id && saved.mode === mode && saved.objectiveIds?.join('|') === objectives.map(o => o.id).join('|') && (saved.ui?.phase !== 'complete' || query.session === saved.id);
  let session = matches ? clone(saved) : createSession({ id: uid(), entryId: entry.id, objectiveIds: objectives.map(o => o.id), now: Date.now(), mode });
  // Keep this exact session across reloads/back navigation. A new link without its
  // session id starts a fresh review after completion, instead of reopening the old summary.
  const hash = location.hash.slice(1), questionMark = hash.indexOf('?');
  const path = questionMark < 0 ? hash : hash.slice(0, questionMark);
  const routeQuery = new URLSearchParams(questionMark < 0 ? '' : hash.slice(questionMark + 1));
  routeQuery.set('session', session.id);
  if (path === '/learn/practice') routeQuery.set('id', entry.id);
  if (query.objective) routeQuery.set('objective', query.objective);
  if (mode !== 'lesson') routeQuery.set('mode', mode);
  history.replaceState(history.state, '', '#' + path + '?' + routeQuery);
  let ui = session.ui?.version === VERSION ? session.ui : { version: VERSION, phase: 'new', taught: [], exposures: {}, checkpoint: 0, xp: 0 };
  ui.taught = Array.isArray(ui.taught) ? ui.taught.filter(id => descriptors.some(o => o.id === id)) : [];
  ui.exposures = ui.exposures && typeof ui.exposures === 'object' ? ui.exposures : {};
  ui.assistance = Array.isArray(ui.assistance) ? ui.assistance.filter(a => ['hint', 'visible-form', 'answer-audio'].includes(a)) : [];
  ui.xp = Math.max(0, Number(ui.xp) || 0);
  let question = null;
  let disposed = false;
  let submitting = false;
  const objective = () => descriptors.find(o => o.id === ui.current?.objectiveId);
  const questionEntry = () => getEntry(objective()?.entryId) || entry;
  const stateFor = obj => skillState(domain(), obj.id, Date.now());
  const deferred = () => objectives.filter(o => Object.hasOwn(session.deferred || {}, o.id));
  const save = () => { if (store.current.id !== ownerId) return; session.ui = ui; session.updatedAt = Date.now(); store.saveLearningSession(session); };
  const readyCount = () => objectives.filter(o => stateFor(o).ready).length;
  const showName = () => ui.phase !== 'question' || !question?.answer?.some(a => normalize(a) === normalize(entryName(questionEntry())));

  setTitle(entry.kind === 'verb' ? 'Verb practice' : 'Word practice');
  setChrome({ tabs: false, back: true });
  store.pushRecent(entry.id);

  function regenerate() {
    const current = ui.current;
    const obj = objective();
    if (!current || !obj || typeof current.seed !== 'number') return null;
    const eligibleTenses = allowedTenses({ stage, expansions });
    if (obj.tense && obj.tense !== 'meaning' && !eligibleTenses.includes(obj.tense)) return null;
    return buildQuestion(questionEntry(), obj, {
      mode: current.mode, variant: current.variant, repairTag: current.repairTag || null, repairPerson: current.repairPerson ?? null,
      pool: Array.isArray(current.poolIds) ? current.poolIds.map(id => getEntry(id)).filter(Boolean) : scoped.filter(e => e.kind === entry.kind), allowedTenses: eligibleTenses, rng: rngFor(current.seed),
    });
  }

  function expose() {
    for (const answer of question?.answer || []) ui.exposures[normalize(answer)] = session.index || 0;
  }

  function exposeText(text) {
    const content = normalize(text);
    for (const answer of Object.keys(ui.exposures)) {
      const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (answer && new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(content)) ui.exposures[answer] = session.index || 0;
    }
  }

  function trackQuestionExposure() {
    const template = document.createElement('template'); template.innerHTML = promptHTML(question.prompt);
    exposeText(template.content.textContent);
    for (const choice of question.choices || []) exposeText(choice.label);
    if (showName()) exposeText(entryName(questionEntry()));
    if (ui.hintVisible) exposeText(question.tip);
    if (question.answer.some(answer => typeof ui.exposures[normalize(answer)] === 'number' && (session.index || 0) - ui.exposures[normalize(answer)] < 2) && !ui.assistance.includes('visible-form')) ui.assistance.push('visible-form');
  }

  function beginNext() {
    stopSpeech();
    const selection = selectNext(domain(), session, descriptors, { now: Date.now() });
    ui.given = ''; ui.draft = ''; ui.result = null; ui.assistance = []; ui.hintVisible = false;
    if (selection.done) {
      ui.phase = 'complete'; ui.current = null; question = null;
      if (requiredObjectives.every(o => stateFor(o).ready)) store.markLearned(entry.id, entry.kind);
      save(); draw(); return;
    }
    const obj = typeof selection.objective === 'string' ? descriptors.find(o => o.id === selection.objective) : selection.objective;
    if (!obj) { ui.phase = 'unavailable'; save(); draw(); return; }
    session.activeObjectiveId = selection.activeObjectiveId || (!selection.spacer ? obj.id : session.activeObjectiveId);
    ui.current = { objectiveId: obj.id, entryId: obj.entryId, mode: selection.mode, variant: selection.variant, repairTag: selection.repairTag || null, repairPerson: selection.repairPerson ?? null, spacer: !!selection.spacer, reason: safeText(selection.reason), seed: Math.floor(Math.random() * 0xFFFFFFFF), id: uid(), startedAt: Date.now(), poolIds: scoped.filter(e => e.kind === obj.kind).slice(0, 100).map(e => e.id) };
    question = regenerate();
    if (!question) { ui.phase = 'unavailable'; save(); draw(); return; }
    const recentlyExposed = question.answer.some(answer => {
      const at = ui.exposures[normalize(answer)];
      return typeof at === 'number' && (session.index || 0) - at < 2;
    });
    if (recentlyExposed) ui.assistance.push('visible-form');
    ui.phase = ui.taught.includes(obj.id) || stateFor(obj).attempts > 0 ? 'question' : 'intro';
    if (ui.phase === 'intro') { expose(); exposeText(question.lesson); exposeText(question.example); }
    save(); draw(true);
  }

  function continuePractice() {
    const answered = session.index || 0;
    if (answered >= (ui.checkpoint || 0) + 10) {
      ui.checkpoint = answered;
      ui.phase = 'checkpoint';
      save(); draw(true);
    } else beginNext();
  }

  async function answer(given, revealed = false) {
    if (submitting || ui.phase !== 'question' || !question || store.current.id !== ownerId) return;
    if (!revealed && !String(given).trim()) { root.querySelector('[data-answer]')?.focus(); return; }
    submitting = true;
    try {
      stopSpeech();
      ui.given = String(given).slice(0, 500);
      const result = gradeQuestion(question, ui.given, { revealed, assistance: ui.assistance, accentStrict: !!store.settings.accentStrict });
      const current = ui.current;
      const meta = question.meta;
      const event = {
        id: current.id, eventId: current.id, questionId: current.id, questionVersion: 1, sessionId: session.id, index: session.index || 0,
        objectiveId: meta.objectiveId || current.objectiveId, entryId: meta.entryId || questionEntry().id, kind: meta.kind || questionEntry().kind,
        skill: meta.skill, tense: meta.tense || null, person: meta.person ?? null,
        mode: meta.mode, exerciseMode: meta.mode, variantId: meta.variantId, contextId: meta.contextId,
        outcome: result.outcome, ok: result.ok, correct: result.ok, assistance: [...ui.assistance], firstAttempt: true,
        errorTags: result.errorTags || [], components: result.components || [], componentResults: result.components || [],
        at: Date.now(), elapsedMs: Math.max(0, Date.now() - current.startedAt),
      };
      const xpBefore = store.current.stats.xp || 0;
      const recorded = await store.recordLearningAttempt(event);
      session = applySessionAttempt(session, recorded.event || event, recorded);
      ui.xp += Math.max(0, (store.current.stats.xp || 0) - xpBefore);
      ui.result = { ok: !!result.ok, outcome: result.outcome, feedback: safeText(result.feedback), errorTags: result.errorTags || [], components: result.components || [], accentIssue: !!result.accentIssue };
      ui.phase = 'feedback';
      expose(); // Every feedback panel displays the answer, including a correct multiple-choice selection.
      save();
      if (!disposed) draw(true);
    } finally { submitting = false; }
  }

  function skipStep() {
    const id = session.activeObjectiveId || objective()?.id;
    if (!id) return;
    const completed = objectives.find(o => o.id === id);
    if (mode === 'lesson' && completed && stateFor(completed).ready) { beginNext(); return; }
    session = deferObjective(session, id, Date.now());
    ui.current = null;
    save();
    beginNext();
  }

  function resumeDeferred(id) {
    if (!objectives.some(o => o.id === id)) return;
    session.deferred = { ...session.deferred }; delete session.deferred[id];
    session.activeObjectiveId = id;
    beginNext();
  }

  const arrow = () => raw(icon('arrow', { size: 20 }));
  function actionButtons() {
    return html`<div class="adaptive-control-row"><button type="button" class="btn ghost" data-skip-step>${ui.current?.spacer ? 'Skip main step' : 'Skip this step'}</button><button type="button" class="btn ghost" data-pause>Pause</button></div>`;
  }

  function progressHTML() {
    const obj = objective();
    if (!obj) return '';
    const state = stateFor(obj);
    const reviewing = mode === 'review' || mode === 'checkpoint';
    const evidence = state.sessionEvidence?.[session.id] || {};
    const requiredPersons = mode === 'checkpoint' ? obj.personsRequired || [] : [];
    const covered = requiredPersons.filter(p => (evidence.independentPersons || []).includes(p)).length;
    const count = reviewing ? requiredPersons.length ? covered : Number(evidence.independentCorrect) || 0 : Number(state.independentCorrect) || 0;
    const needed = reviewing ? requiredPersons.length || 2 : Number(state.requiredCorrect) || 4;
    const stepReady = reviewing ? (session.reviewedObjectiveIds || []).includes(obj.id) && (!requiredPersons.length || covered === requiredPersons.length) : state.ready;
    const label = reviewing ? stepReady ? 'This review is demonstrated' : 'Checking what stayed with you' : state.remembered ? 'Remembered later' : state.ready ? 'Ready for the next step' : 'Building confidence';
    const progressNote = reviewing ? requiredPersons.length ? 'Use every person independently in this checkpoint. Helped answers stay useful practice.' : 'Two varied, independent answers in this review, with space between them.'
      : state.ready ? 'You have demonstrated this skill. Later reviews help it stay with you.'
      : state.unresolvedErrors?.length ? 'A recent difficulty still needs fresh, independent confirmation. Your earlier successes are kept.'
      : count >= needed && state.variantCount < 2 ? 'The next checks need different prompts. Repeating the same answer alone is not enough.'
      : 'Several varied answers, including a check after a gap. Helped answers are useful practice.';
    return html`<section class="adaptive-progress" aria-label="Learning evidence">
      <div class="adaptive-progress-line"><span>${label}</span><span>${Math.min(count, needed)} / ${needed} ${requiredPersons.length ? 'persons checked' : 'independent checks'}</span></div>
      <div class="adaptive-evidence" aria-hidden="true">${raw(Array.from({ length: needed }, (_, i) => `<span class="${i < count ? 'earned' : ''}"></span>`).join(''))}</div>
      <p>${progressNote}</p>
    </section>`;
  }

  function introHTML() {
    const obj = objective();
    return html`<article class="adaptive-card adaptive-intro glass">
      <div class="adaptive-eyebrow">One useful step</div><h1 tabindex="-1" data-focus>${obj.label}</h1>
      <p class="adaptive-lead">${obj.description || obj.explanation || 'We will build this skill with a few different examples, then check it independently.'}</p>
      <div class="adaptive-teaching"><span class="kicker">Notice this</span><p>${question.lesson || obj.explanation || question.tip}</p>${question.example ? raw(html`<p class="adaptive-example" lang="it">${question.example}</p>`) : ''}</div>
      <p class="adaptive-reassurance">We will keep practicing this step until you can use it consistently. You can skip or pause whenever you choose.</p>
      <button type="button" class="btn primary block" data-start>Start practice ${arrow()}</button>
      ${raw(actionButtons())}
    </article>`;
  }

  function questionHTML() {
    const q = question;
    const typed = q.type !== 'mc' || !q.choices?.length;
    const limitedScope = scoped.filter(e => e.kind === entry.kind).length < 3;
    return html`<article class="adaptive-card glass q-card" data-question-id="${ui.current.id}" data-objective="${objective().id}">
      <div class="adaptive-eyebrow">${ui.current.spacer ? 'A little variety' : ui.current.repairTag ? 'Let’s work on this part' : q.meta.mode === 'production' ? 'Try it from memory' : 'Find the right answer'}</div>
      ${ui.current.spacer ? raw(html`<p class="adaptive-spacer-note">A short practice break before returning to ${objectives.find(o => o.id === session.activeObjectiveId)?.label || 'your main step'}.</p>`) : ''}
      <div class="adaptive-prompt" tabindex="-1" data-focus>${raw(promptHTML(q.prompt))}</div>
      ${limitedScope ? raw('<aside class="adaptive-scope-note"><p>This small scope gives us fewer ways to space memory checks. You can keep practicing or skip this step without losing progress.</p><a href="#/scope">Add a few practice items</a></aside>') : ''}
      ${q.meta.variantCount === 1 ? raw('<aside class="adaptive-scope-note"><p>Only one reliable example is available for this item. You can practice it or skip this step; another example is needed before we can mark the skill ready.</p></aside>') : ''}
      ${q.meta.audioIsPrompt ? raw(html`<button type="button" class="btn secondary adaptive-audio" data-audio>${raw(icon('speaker', { size: 20 }))} Listen to the question</button>`) : ''}
      ${typed ? raw(html`<form data-answer-form autocomplete="off"><label class="adaptive-input-label" for="adaptive-answer">${q.meta.answerLanguage === 'en' ? 'Your answer in English' : 'Your answer in Italian'}</label><input id="adaptive-answer" data-answer type="text" value="${ui.draft || ''}" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-describedby="adaptive-answer-help"><div class="adaptive-accents" role="group" aria-label="Accented letters">${raw(['à', 'è', 'é', 'ì', 'ò', 'ù', "'"].map(letter => html`<button type="button" data-insert="${letter}" aria-label="Insert ${letter}">${letter}</button>`).join(''))}</div><p id="adaptive-answer-help" class="adaptive-input-help">Take your time. Press Enter or choose Check answer.</p><button class="btn primary block" type="submit" data-check>Check answer ${arrow()}</button></form>`) : raw(html`<div class="adaptive-choices">${raw(q.choices.map((choice, i) => html`<button type="button" class="choice" data-choice="${i}"><span class="adaptive-choice-number" aria-hidden="true">${i + 1}</span><span class="choice-label">${choice.label}</span></button>`).join(''))}</div>`)}
      ${ui.hintVisible ? raw(html`<aside class="adaptive-hint" role="status"><span class="kicker">A small hint</span><p>${q.tip || objective().explanation}</p></aside>`) : ''}
      <div class="adaptive-help-row"><button type="button" class="btn secondary" data-hint ${ui.hintVisible ? raw('disabled') : ''}>${ui.hintVisible ? 'Hint shown' : 'Hint'}</button><button type="button" class="btn secondary" data-reveal>I don’t know</button></div>
      ${!q.meta.audioIsPrompt && q.say ? raw('<button type="button" class="adaptive-audio-help" data-audio>Hear the answer · counts as help</button>') : ''}
      ${raw(actionButtons())}
    </article>`;
  }

  function feedbackHTML() {
    const result = ui.result;
    const revealed = result.outcome === 'revealed';
    const helped = ui.assistance.length > 0 || revealed;
    const title = revealed ? 'Let’s look at it together' : result.ok ? helped ? 'Good supported practice' : 'That’s right' : 'One part to work on';
    const components = Array.isArray(result.components) ? result.components : [];
    const actual = question.answer[0] || '';
    return html`<article class="adaptive-card adaptive-feedback glass ${result.ok ? 'is-correct' : 'is-repair'}" aria-live="polite" aria-atomic="true">
      <div class="adaptive-feedback-symbol" aria-hidden="true">${result.ok ? '✓' : '↻'}</div>
      <h1 tabindex="-1" data-focus>${title}</h1>
      ${ui.given ? raw(html`<p class="adaptive-your-answer"><span>Your answer</span>${ui.given}</p>`) : ''}
      <div class="adaptive-answer"><span class="kicker">${result.ok ? 'The form' : 'A correct answer'}</span><p lang="it">${actual}</p></div>
      <p class="adaptive-feedback-text">${result.feedback || (result.ok ? 'Keep going: a different example will help us check this again.' : 'Read the example, then try a smaller step.')}</p>
      ${components.length ? raw(html`<div class="adaptive-components">${raw(components.map(c => html`<span class="${c.ok ? 'is-correct' : 'needs-work'}">${c.ok ? '✓' : '↻'} ${String(c.skill || '').replace(/([A-Z])/g, ' $1').replaceAll('-', ' ')}</span>`).join(''))}</div>`) : ''}
      ${!result.ok && (question.lesson || question.example) ? raw(html`<aside class="adaptive-teaching"><span class="kicker">Try this approach</span><p>${question.lesson || question.tip}</p>${question.example ? raw(html`<p class="adaptive-example" lang="it">${question.example}</p>`) : ''}</aside>`) : ''}
      <p class="adaptive-reassurance">${helped ? 'This was practice with help. We’ll check it again independently after a gap.' : result.ok ? 'One answer is part of the picture. We’ll use varied checks before moving on.' : 'Your other progress is kept. The next question will focus on what needs practice.'}</p>
      <button type="button" class="btn primary block" data-next>Continue ${arrow()}</button>
      ${raw(actionButtons())}
    </article>`;
  }

  function deferredHTML() {
    const items = deferred();
    if (!items.length) return '';
    return html`<section class="adaptive-deferred"><h2>Saved for later</h2><p>These steps remain unfinished. Resume one whenever you are ready.</p>${raw(items.map(o => html`<div class="adaptive-deferred-row"><span>${o.label}</span><button type="button" class="btn secondary sm" data-resume-objective="${o.id}">Resume</button></div>`).join(''))}</section>`;
  }

  function summaryHTML() {
    const complete = ui.phase === 'complete';
    const checkpoint = ui.phase === 'checkpoint';
    const allReady = complete && deferred().length === 0;
    const title = checkpoint ? 'A moment to check in' : complete ? allReady ? 'Ready for the next step' : 'Your practice is saved' : 'Take a breather';
    const message = checkpoint ? 'You have done ten more practice questions. Keep working on this step, or take a break. There is no question limit.' : complete ? allReady ? 'You have demonstrated these skills in varied practice. We’ll revisit them later to help them last.' : 'You chose to leave some steps for later. They are saved without being marked ready.' : 'Your exact place is saved, including any help you used. Pick up here when you are ready.';
    const recommendation = complete ? recommend(store, { kind: entry.kind, excludeObjectives: Object.keys(session.deferred || {}) }) : null;
    const next = recommendation?.entry && !(recommendation.entry.id === entry.id && (!recommendation.objectiveId || objectives.some(o => o.id === recommendation.objectiveId))) ? recommendation : null;
    const extra = complete ? entryObjectives.filter(o => o.optional || o.required === false) : [];
    return html`<article class="adaptive-card adaptive-summary glass"><div class="adaptive-eyebrow">${complete && allReady ? 'Ben fatto' : 'Your pace'}</div><h1 tabindex="-1" data-focus>${title}</h1><p class="adaptive-lead">${message}</p>
      <div class="adaptive-summary-stats"><div><strong>${readyCount()}</strong><span>steps ready</span></div><div><strong>${deferred().length}</strong><span>saved for later</span></div><div><strong>+${ui.xp}</strong><span>practice XP</span></div></div>
      ${!complete ? raw(html`<button type="button" class="btn primary block" data-resume>${checkpoint ? 'Keep practicing' : 'Resume practice'} ${arrow()}</button>`) : next ? raw(html`<a class="btn primary block" href="${practiceHref(next.entry, next.objectiveId, next.mode)}">Continue learning ${arrow()}</a>`) : ''}
      <a class="btn secondary block" href="#/learn">${checkpoint ? 'Take a break' : 'Back to Learn'}</a>
      ${checkpoint ? raw('<button type="button" class="btn ghost block" data-skip-step>Skip this step</button>') : ''}
      ${raw(deferredHTML())}
      ${extra.length ? raw(html`<section class="adaptive-deferred"><h2>Extra practice</h2><p>Optional ways to use and hear this word. Choose one when you want more.</p>${raw(extra.map(o => html`<a class="adaptive-extra-link" data-extra-practice href="${practiceHref(entry, o.id)}"><span>${o.label}</span>${arrow()}</a>`).join(''))}</section>`) : ''}
    </article>`;
  }

  function draw(focus = false) {
    if (disposed || store.current.id !== ownerId) return;
    if (ui.phase === 'question' && question) { trackQuestionExposure(); save(); }
    const obj = objective();
    const active = ['intro', 'question', 'feedback'].includes(ui.phase);
    const content = ui.phase === 'intro' ? introHTML() : ui.phase === 'question' ? questionHTML() : ui.phase === 'feedback' ? feedbackHTML() : ui.phase === 'unavailable' ? html`<article class="adaptive-card glass"><h1 data-focus tabindex="-1">This example needs more context</h1><p>We do not have a reliable question for this step yet. Your progress is saved; you can skip this step or choose another.</p>${raw(actionButtons())}<a class="btn secondary block" href="#/learn">Choose another step</a>${raw(deferredHTML())}</article>` : summaryHTML();
    root.innerHTML = html`<div class="adaptive-learn" data-adaptive data-phase="${ui.phase}">
      <header class="adaptive-heading"><div><span class="kicker">${entry.kind === 'verb' ? stageName(stage) : 'Words for everyday life'}</span><div class="adaptive-entry">${showName() ? entryName(questionEntry()) : questionEntry().kind === 'verb' ? 'Verb practice' : 'Word practice'}</div></div><a class="adaptive-reference" href="#/reference/${encodeURIComponent(questionEntry().id)}" aria-label="Open full reference">${raw(icon('book', { size: 20 }))}<span>Reference</span></a></header>
      ${active ? raw(html`<div class="adaptive-step"><span>${obj.label}</span><span>${mode === 'review' ? 'Review' : 'Focused practice'}</span></div>`) : ''}
      ${raw(content)}
      ${active ? raw(progressHTML()) : ''}
      ${active && deferred().length ? raw(html`<details class="adaptive-later"><summary>${deferred().length} step${deferred().length === 1 ? '' : 's'} saved for later</summary>${raw(deferredHTML())}</details>`) : ''}
      <p class="adaptive-bottom-note">One step at a time. Your progress saves on this device.</p>
    </div>`;
    root.querySelector('[data-answer-form]')?.addEventListener('submit', event => { event.preventDefault(); answer(root.querySelector('[data-answer]').value); });
    root.querySelector('.adaptive-reference')?.addEventListener('click', () => { if (ui.phase === 'question') { if (!ui.assistance.includes('visible-form')) ui.assistance.push('visible-form'); expose(); save(); } });
    root.querySelector('[data-answer]')?.addEventListener('input', event => { ui.draft = event.target.value.slice(0, 500); save(); });
    root.querySelectorAll('[data-insert]').forEach(button => button.addEventListener('click', () => {
      const input = root.querySelector('[data-answer]'); if (!input) return;
      input.setRangeText(button.dataset.insert, input.selectionStart, input.selectionEnd, 'end');
      ui.draft = input.value; save(); input.focus();
    }));
    root.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => answer(question.choices[Number(button.dataset.choice)].label)));
    root.querySelector('[data-start]')?.addEventListener('click', () => { ui.taught.push(obj.id); ui.phase = 'question'; if (!ui.assistance.includes('visible-form')) ui.assistance.push('visible-form'); expose(); save(); draw(true); });
    root.querySelector('[data-hint]')?.addEventListener('click', () => { if (!ui.assistance.includes('hint')) ui.assistance.push('hint'); ui.hintVisible = true; expose(); save(); draw(); });
    root.querySelector('[data-reveal]')?.addEventListener('click', () => answer('', true));
    root.querySelector('[data-audio]')?.addEventListener('click', () => { if (!question.meta.audioIsPrompt) { if (!ui.assistance.includes('answer-audio')) ui.assistance.push('answer-audio'); expose(); save(); } speak(question.say); });
    root.querySelector('[data-next]')?.addEventListener('click', () => { ui.draft = ''; continuePractice(); });
    root.querySelector('[data-skip-step]')?.addEventListener('click', skipStep);
    root.querySelector('[data-pause]')?.addEventListener('click', () => { ui.resumePhase = ui.phase; ui.phase = 'paused'; stopSpeech(); save(); draw(true); });
    root.querySelector('[data-resume]')?.addEventListener('click', () => {
      if (ui.phase === 'checkpoint') beginNext();
      else { ui.phase = ['intro', 'question', 'feedback', 'unavailable'].includes(ui.resumePhase) ? ui.resumePhase : 'question'; save(); draw(true); }
    });
    root.querySelectorAll('[data-resume-objective]').forEach(button => button.addEventListener('click', () => resumeDeferred(button.dataset.resumeObjective)));
    if (focus) root.querySelector('[data-focus]')?.focus({ preventScroll: true });
  }

  if (ui.current && objective()) {
    question = regenerate();
    const recorded = domain().events?.[ui.current.id];
    if (question && recorded && !(session.answeredEventIds || []).includes(recorded.id)) {
      // Recover a save that committed the answer just before the app closed, but not its session cursor.
      session = applySessionAttempt(session, recorded, { added: true, skill: stateFor(objective()) });
      const result = gradeQuestion(question, ui.given || '', { revealed: recorded.outcome === 'revealed', assistance: recorded.assistance, accentStrict: !!store.settings.accentStrict });
      ui.result = { ok: recorded.ok, outcome: recorded.outcome, feedback: safeText(result.feedback), components: recorded.components, errorTags: recorded.errorTags };
      ui.phase = 'feedback'; expose();
    }
    if (!question || !['intro', 'question', 'feedback', 'paused', 'checkpoint', 'unavailable'].includes(ui.phase)) beginNext();
    else { if (ui.phase === 'feedback' && !ui.result) ui.phase = 'question'; save(); draw(); }
  } else if (ui.phase === 'complete') { save(); draw(); }
  else beginNext();
  return () => { disposed = true; stopSpeech(); save(); };
}
