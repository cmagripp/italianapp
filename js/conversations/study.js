import { buildConversationSummary } from './summary.js';
import { buildShortWordQuestion } from '../learning/word-questions.js';
import { buildQuestion } from '../learning/questions.js';
import { lessonObjectives } from '../learning/integration.js';
import { objectivesFor } from '../learning/curriculum.js';
import { gradeQuestion } from '../learning/diagnose.js';
import { createPairActivity } from '../learning/lesson-activities.js';
import { activityState, activityAction, activityActionFromButton, activityHTML, focusActivity } from '../learning/activity-panel.js';
import { TENSE_BY_KEY } from '../conjugator.js';

const POLICY = 1, MAX_ITEMS = 16;
const clone = value => structuredClone(value);
const norm = value => String(value || '').normalize('NFC').toLocaleLowerCase('it').trim();
const stable = value => JSON.stringify(value);
const abort = () => new DOMException('The conversation or learner changed.', 'AbortError');
const refMatches = (ref, turn) => turn && turn.revision === ref.revision && Number.isSafeInteger(ref.start) &&
  Number.isSafeInteger(ref.end) && ref.start >= 0 && ref.end > ref.start && turn.displayText.slice(ref.start, ref.end) === ref.quote;
const allowedGiven = (plan, target, given) => target.question?.choices.some(c => c.value === given) ||
  plan.activities.some(a => a.type === 'pairs' && a.targets.some(t => t.id === target.id) && a.question.rightTiles.some(tile => tile.text === given));

/** Rebuild from local reference records and exact current messages, rather than
 * trusting imported summary meanings, guessed tenses or saved question HTML. */
export function conversationStudyItems(state, services) {
  return buildConversationSummary({ ...state, previous: state.summary }, services).items
    .filter(item => item.kind === 'vocabulary' && !item.invalidated);
}

function observedVerb(item, ref, turn, lookup) {
  const candidate = lookup(ref.quote, { sentence: turn.displayText }).candidates.find(c => c.id === item.entryId);
  if (!candidate) return null;
  const matches = candidate.matches || [], contextual = matches.filter(m => m.contextMatched);
  const finite = (contextual.length ? contextual : matches).filter(m => m.kind === 'finite' && m.tense && Number.isInteger(m.person));
  // A shared form such as sono does not establish io versus loro. A progressive
  // or nonfinite reading without a canonical finite target remains lexical.
  const signatures = new Set(finite.map(m => stable([m.tense, m.person])));
  if (signatures.size !== 1) return null;
  const match = finite.find(m => {
    const text = norm(turn.displayText), form = norm(m.form);
    let at = -1;
    while ((at = text.indexOf(form, at + 1)) >= 0) if (at <= ref.start && at + form.length >= ref.end) return true;
    return false;
  });
  return match || null;
}

export function buildConversationStudyPlan(state, { selections, format = 'choice', lookup, resolveEntry, pool = [], owner, epochId } = {}) {
  if (!['choice', 'match', 'cards'].includes(format)) throw new TypeError('Choose a supported study activity.');
  if (!Array.isArray(selections) || !selections.length || selections.length > MAX_ITEMS) throw new TypeError('Choose one to sixteen conversation items.');
  const available = conversationStudyItems(state, { lookup, resolveEntry }), used = new Set();
  const targets = selections.map(selection => {
    const item = available.find(row => row.id === selection.itemId), ref = item?.sourceRefs[selection.sourceIndex || 0];
    const turn = state.turns.find(row => row.turnId === ref?.turnId), entry = resolveEntry(item?.entryId);
    if (!item || !ref || !entry || used.has(item.id) || !refMatches(ref, turn)) throw new TypeError('A selected study source changed.');
    used.add(item.id);
    const objectives = lessonObjectives(entry);
    let question = null, observed = null;
    if (item.pos === 'verb') {
      observed = observedVerb(item, ref, turn, lookup);
      if(observed)observed={...observed,tenseLabel:TENSE_BY_KEY[observed.tense]?.name||observed.tenseLabel||'Verb form'};
      const target = observed && objectives.find(t => t.available !== false && t.skill === 'conjugation' && t.tense === observed.tense && t.person === observed.person);
      if (target) {
        question = buildQuestion(entry, { ...target, entryId: entry.id }, { mode: 'recognition', variant: 1, repairPerson: observed.person, allowedTenses: [observed.tense], pool, rng: () => .5 });
        if (!question?.answer.some(answer => norm(answer) === norm(observed.form)) || question.type !== 'mc') question = null;
        if (question) {
          question.choices = question.choices.map(choice => choice.correct ? { ...choice, label: observed.form, value: observed.form } : { ...choice, value: choice.label });
          question.say=observed.form;
          question.meta.chapterId = target.chapterId;
        }
      }
      if (!question) {
        observed = null;
        const target = [...objectives, ...objectivesFor(entry, { stage: 'present' })].find(t => t.available !== false && t.skill === 'recall' && (!t.tense || t.tense === 'meaning'));
        if (target) {
          question = buildQuestion(entry, { ...target, entryId: entry.id }, { mode: 'recognition', variant: 0, pool, rng: () => .5 });
          if (question) question.meta.chapterId = target.chapterId;
        }
      }
    } else {
      const target = objectives.find(t => t.available !== false && t.skill === 'meaning');
      if (target) question = buildShortWordQuestion(entry, target, { pool, phase: 'guided', variant: 0 });
    }
    if (question?.type !== 'mc' || question.choices.length < 2) question = null; // A card is preferable to unexpected typing.
    const source = { ...clone(ref), threadId: state.thread.threadId };
    const label = observed ? `${entry.inf} · ${observed.personLabel || ''} · ${observed.tenseLabel}` : item.pos === 'verb' ? entry.en : item.label || item.word;
    if (question) {
      question = { ...question, id: item.id, choices: question.choices.map(c => ({ ...c, value: c.value ?? c.label })),
        meta: { ...question.meta, mode: 'recognition', evidenceMode: 'recognition', supportOnly: true,
          activityKind: 'guided', contextId: stable(['conversation-study-v1', source]), source } };
    }
    return { id: item.id, entryId: entry.id, label, word: entry.inf || entry.it, meaning: entry.en,
      source, sentence: turn.displayText, observed, question };
  });
  const activities = [];
  if (format === 'match') for (let index = 0; index < targets.length; index += 4) {
    const group = targets.slice(index, index + 4), rows = group.filter(t => t.question);
    const q = rows.length > 1 && createPairActivity(rows[0].question, rows.map(t => ({ targetId: t.id, label: t.label, question: t.question })), { seed: index, prompt: '<div class="big md">Match what you practised</div>' });
    if (q?.type === 'pairs' && rows.length === group.length) activities.push({ id: `match:${index}`, type: 'pairs', question: { ...q, id: `match:${index}`, meta: { ...q.meta, shortWord: true } }, targets: group });
    else for (const target of group) activities.push({ id: target.id, type: target.question ? 'choice' : 'card', question: target.question, targets: [target] });
  } else for (const target of targets) activities.push({ id: target.id, type: format === 'cards' || !target.question ? 'card' : 'choice', question: target.question, targets: [target] });
  const plan = { policyVersion: POLICY, owner: clone(owner), epochId, threadId: state.thread.threadId, sourceRevision: state.thread.contentRevision,
    selections: clone(selections), format, targets, activities };
  // Exact serialized comparison avoids a short hash collision granting replay.
  plan.fingerprint = stable(plan);
  return plan;
}

export function restoreConversationStudy(plan, saved) {
  const fresh = { policyVersion: POLICY, sessionId: crypto.randomUUID(), fingerprint: plan.fingerprint, owner: plan.owner, epochId: plan.epochId,
    threadId: plan.threadId, sourceRevision: plan.sourceRevision, sourceRefs: plan.targets.map(t => t.source), selections: plan.selections,
    format: plan.format, index: 0, answers: {}, activity: {}, flipped: false };
  if (!saved || saved.policyVersion !== POLICY || saved.fingerprint !== plan.fingerprint || typeof saved.sessionId !== 'string' || saved.sessionId.length > 100) return fresh;
  const answers = {};
  for (const [id, value] of Object.entries(saved.answers || {}).slice(0, 256)) {
    const target = plan.targets.find(t => t.id === value?.targetId), question = target?.question;
    if (!question || !Number.isInteger(value.attempt) || value.attempt < 0 || value.attempt > 100 || !allowedGiven(plan, target, value.given)) continue;
    const expected = `${saved.sessionId}:${value.targetId}:${value.attempt}`;
    if (id !== expected) continue;
    const grade = gradeQuestion(question, value.given, { assistance: ['conversation-study'], accentStrict: true });
    answers[id] = { targetId: value.targetId, given: value.given, attempt: value.attempt, eventId: id, at: Number(value.at) || 0, ok: grade.ok };
  }
  let index = Number.isInteger(saved.index) ? Math.max(0, Math.min(saved.index, plan.activities.length)) : 0;
  const answered = Object.values(answers);
  for (let n = 0; n < index; n++) {
    const a = plan.activities[n];
    if (a.type === 'choice' && !answered.some(value => value.targetId === a.targets[0].id && value.attempt === 0) ||
        a.type === 'pairs' && !a.targets.every(t => answered.some(value => value.targetId === t.id && value.ok))) { index = n; break; }
  }
  const activity = plan.activities[index];
  let board = {};
  if (activity?.type === 'pairs') {
    const prior = activityState(activity.question, saved.activity);
    const matches = prior.matches.filter(match => answered.some(a => a.targetId === match.leftId && a.ok));
    const attempts = Object.fromEntries(activity.targets.map(t => [t.id, answered.filter(a => a.targetId === t.id).length]));
    board = activityState(activity.question, { ...prior, matches, attempts });
  }
  return { ...fresh, sessionId: saved.sessionId, index, answers, activity: board, flipped: activity?.type === 'card' && saved.flipped === true };
}

export function conversationStudyAttempt(plan, state, target, given, attempt = 0, at = Date.now()) {
  const question = target.question, grade = gradeQuestion(question, given, { assistance: ['conversation-study', ...(plan.format === 'match' ? ['matching'] : [])], accentStrict: true });
  const event = { ...question.meta, id: `${state.sessionId}:${target.id}:${attempt}`, sessionId: state.sessionId, epochId: plan.epochId,
    index: state.index, at, objectiveId: question.meta.objectiveId, entryId: target.entryId, kind: question.meta.kind,
    policy: 'journey-v1', chapterId: question.meta.chapterId, contentVersion: question.meta.contentVersion || 1,
    activityKind: 'guided', mode: 'recognition', firstAttempt: attempt === 0, assistance: ['conversation-study', ...(plan.format === 'match' ? ['matching'] : [])],
    ok: grade.ok, outcome: grade.outcome, errorTags: grade.errorTags, components: grade.components, submission: grade.submission,
    xp: 0, countStats: false };
  return { event, grade, source: { ...clone(target.source), owner: clone(plan.owner), epochId: plan.epochId } };
}

/** In-place sheet. Save/resume stores study UI only; replay never emits evidence.
 * Only an actual choice/match invokes the host's owner/epoch-guarded callback. */
export async function openConversationStudy({ repository, threadId, isCurrent, lookup, resolveEntry, pool = [], epochId,
  onAssessedAnswer = async () => null, onClose = () => {} } = {}) {
  const { sheet, html, raw, speak, stopSpeech } = await import('../ui.js');
  let closed = false, busy = false, plan = null, session = null, available = [], error = '', generation = 0;
  const current = () => !closed && isCurrent(), guard = () => { if (!current()) throw abort(); };
  const panel = sheet('', { title: 'Practise this conversation', onClose: () => { closed = true; generation++; stopSpeech(); onClose(); } });
  const close = panel.close;
  panel.close = (...args) => { closed = true; generation++; stopSpeech(); close(...args); };
  const services = { lookup, resolveEntry };
  const source = async () => { guard(); const state = await repository.read(threadId); guard(); return state; };
  const check = async () => {
    const state = await source(), rebuilt = buildConversationStudyPlan(state, { ...services, selections: plan.selections, format: plan.format, owner: repository.owner, epochId, pool });
    if (rebuilt.fingerprint !== plan.fingerprint) throw new Error('These conversation words changed. Close practice and choose them again.');
    return state;
  };
  const persist = async () => {
    const state = await check(), summary = buildConversationSummary({ ...state, previous: state.summary }, services);
    guard(); await repository.saveSummary(threadId, { ...summary, studyState: clone(session) }, { sourceRevision: state.thread.contentRevision }); guard();
  };
  function draw() {
    if (!current()) return;
    if (!plan) {
      panel.body.innerHTML = html`<p class="small muted">Choose the words and the sentence you want to revisit. Supported answers count as practice; seeing a card does not mark a word learned.</p><div class="conversation-study-selection">${raw(available.map((item, index) => html`<label class="conversation-study-item"><span><input type="checkbox" data-study-select="${index}" ${index < 8 ? 'checked' : ''}> ${item.label || item.word}</span><small>${item.meaning}</small>${item.sourceRefs.length > 1 ? raw(html`<select data-study-source="${index}" aria-label="Sentence for ${item.word}">${raw(item.sourceRefs.map((ref, n) => html`<option value="${n}">${item.sourceLabels?.[n] || ref.quote}</option>`).join(''))}</select>`) : ''}</label>`).join(''))}</div><fieldset><legend>How would you like to practise?</legend><label><input type="radio" name="study-format" value="choice" checked> Choose an answer</label><label><input type="radio" name="study-format" value="match"> Match pairs</label><label><input type="radio" name="study-format" value="cards"> Flashcards</label></fieldset><button type="button" class="btn primary block" data-study-begin ${!available.length ? 'disabled' : ''}>Start selected practice</button><p role="alert">${error}</p>`;
      return;
    }
    const activity = plan.activities[session.index], target = activity?.targets[0];
    if (!activity) { panel.body.innerHTML = '<p>Selected practice complete.</p><p class="small muted">You can keep learning these words in their lessons. Viewing a card does not mark a word learned.</p><button type="button" class="btn secondary block" data-study-again>Choose words again</button><button type="button" class="btn primary block" data-study-return>Back to the conversation</button>'; return; }
    const answer = Object.values(session.answers).find(a => a.targetId === target.id && a.attempt === 0), feedback = answer && gradeQuestion(target.question, answer.given, { assistance: ['conversation-study'], accentStrict: true });
    let content = '';
    if (activity.type === 'pairs') content = activityHTML(activity.question, session.activity);
    else if (activity.type === 'card') content = html`<h2 lang="it">${target.word}</h2>${session.flipped ? raw(html`<p>${target.meaning}</p>${target.observed ? raw(html`<p lang="it">${target.observed.form} · ${target.observed.tenseLabel}</p>`) : ''}`) : raw('<button class="btn secondary" type="button" data-study-flip>Show meaning</button>')}`;
    else content = html`${raw(target.question.prompt)}<div class="choices">${raw(target.question.choices.map((choice, index) => html`<button type="button" class="choice" data-study-choice="${index}" ${busy || answer ? 'disabled' : ''}>${choice.label}</button>`).join(''))}</div>${feedback ? raw(html`<p role="status">${feedback.ok ? 'Matched.' : 'The reference answer is: ' + target.question.answer.join(' / ')}</p>`) : ''}`;
    const done = activity.type === 'card' || activity.type === 'pairs' && activityState(activity.question, session.activity).complete || activity.type === 'choice' && !!answer;
    panel.body.innerHTML = html`<p class="small muted">${session.index + 1} / ${plan.activities.length}</p>${raw(content)}<details><summary>See the original sentence</summary>${raw(activity.targets.map((t,index) => html`<p lang="it">${t.sentence}</p><button type="button" class="btn ghost sm" data-study-hear-original="${index}">Hear original</button>`).join(''))}</details><p role="alert">${error}</p>${error?raw('<button type="button" class="btn secondary block" data-study-again>Choose words again</button>'):''}<button type="button" class="btn primary block" data-study-next ${busy || !done ? 'disabled' : ''}>${session.index + 1 === plan.activities.length ? 'Finish practice' : 'Next'}</button><button type="button" class="btn ghost block" data-study-return>Back to the conversation</button>`;
    if(busy)panel.body.querySelectorAll('[data-pair-left],[data-pair-right]').forEach(button=>{button.disabled=true;});
  }
  async function run(work) {
    if (busy || !current()) return;
    busy = true; const epoch = generation; error = '';
    if (plan) draw(); else panel.body.querySelector('[data-study-begin]')?.setAttribute('disabled', '');
    try { await work(); } catch (failure) { if (current() && failure.name !== 'AbortError') error = failure.message; }
    finally { if (current() && epoch === generation) { busy = false; draw(); } }
  }
  async function assess(target, given, attempt) {
    await check(); guard();
    const assessed = conversationStudyAttempt(plan, session, target, given, attempt), recorded = await onAssessedAnswer(assessed); guard();
    // The host's stable event wins after a previous profile save succeeded but
    // the conversation-state save failed. Re-clicking cannot rewrite evidence.
    const previous = recorded?.event?.submission?.originalText;
    const value = typeof previous === 'string' && allowedGiven(plan, target, previous) ? previous : given;
    session.answers[assessed.event.id] = { targetId: target.id, given: value, attempt, eventId: assessed.event.id, at: recorded?.event?.at || assessed.event.at,
      ok: gradeQuestion(target.question, value, { assistance: ['conversation-study'], accentStrict: true }).ok };
    return value;
  }
  panel.body.addEventListener('click', event => {
    if (event.target.closest('[data-study-return]')) { panel.close(); return; }
    const hearOriginal=event.target.closest('[data-study-hear-original]');
    if(hearOriginal)void run(async()=>{await check();guard();const target=plan.activities[session.index].targets[Number(hearOriginal.dataset.studyHearOriginal)];if(target)speak(target.sentence,{force:true});});
    if (event.target.closest('[data-study-again]')) void run(async () => {
      const state = await source(), summary = buildConversationSummary({ ...state, previous: state.summary }, services);
      delete summary.studyState; await repository.saveSummary(threadId, summary, { sourceRevision: state.thread.contentRevision }); guard();
      available = conversationStudyItems(state, services).map(item => ({ ...item, sourceLabels: item.sourceRefs.map(ref => state.turns.find(t => t.turnId === ref.turnId)?.displayText.slice(0, 80)) }));
      plan = null; session = null;
    });
    if (event.target.closest('[data-study-begin]')) void run(async () => {
      const selections = [...panel.body.querySelectorAll('[data-study-select]:checked')].map(input => ({ itemId: available[Number(input.dataset.studySelect)].id, sourceIndex: Number(panel.body.querySelector(`[data-study-source="${input.dataset.studySelect}"]`)?.value || 0) }));
      const format = panel.body.querySelector('[name=study-format]:checked')?.value || 'choice', state = await source();
      plan = buildConversationStudyPlan(state, { ...services, selections, format, owner: repository.owner, epochId, pool }); session = restoreConversationStudy(plan, null);
      try { await persist(); } catch (failure) { plan = null; session = null; throw failure; }
    });
    const choice = event.target.closest('[data-study-choice]');
    if (choice && !choice.disabled) void run(async () => { const target = plan.activities[session.index].targets[0],given=await assess(target, target.question.choices[Number(choice.dataset.studyChoice)].value, 0); await persist();guard();if(gradeQuestion(target.question,given,{assistance:['conversation-study'],accentStrict:true}).ok)speak(target.question.say||target.observed?.form||target.word); });
    if (event.target.closest('[data-study-flip]')) void run(async () => { await check(); session.flipped = true; await persist(); });
    if (event.target.closest('[data-study-next]') && !event.target.closest('[data-study-next]').disabled) void run(async () => { await check(); session.index++; session.activity = {}; session.flipped = false; await persist(); });
    const pairAction = activityActionFromButton(event.target.closest('button'));
    if (pairAction && plan?.activities[session.index]?.type === 'pairs') void run(async () => {
      await check(); const activity = plan.activities[session.index]; let result = activityAction(activity.question, session.activity, pairAction); if (!result) return;
      const tapped=pairAction.type==='pair-left'?activity.targets.find(t=>t.id===pairAction.id):activity.targets.find(t=>t.question.meta.kind==='verb'&&activity.question.rightTiles.some(tile=>tile.id===pairAction.id&&tile.pairId===t.id));
      const tappedItalian=pairAction.type==='pair-left'?tapped?.word:tapped&&activity.question.rightTiles.find(tile=>tile.id===pairAction.id)?.text;
      let correctTarget=null;
      if (result.pair) {
        const target = activity.targets.find(t => t.id === result.pair.targetId), prior = Object.values(session.answers).filter(a => a.targetId === target.id);
        const given = await assess(target, result.pair.given, prior.length);
        if(gradeQuestion(target.question,given,{assistance:['conversation-study'],accentStrict:true}).ok)correctTarget=target;
        if (given !== result.pair.given) {
          const tile = activity.question.rightTiles.find(t => t.text === given && !activityState(activity.question, session.activity).matches.some(m => m.rightId === t.id));
          const base = { ...activityState(activity.question, session.activity), leftId: target.id, rightId: null };
          result = tile && activityAction(activity.question, base, { type: 'pair-right', id: tile.id });
          if (!result) { await persist(); throw new Error('A prior saved answer was restored. Close and reopen this practice.'); }
        }
      }
      session.activity = result.state; await persist();guard();if(correctTarget)speak(correctTarget.question.say||correctTarget.observed?.form||correctTarget.word);else if(tappedItalian)speak(tappedItalian,{force:true});queueMicrotask(() => {if(current())focusActivity(panel.body, result.focus);});
    });
  });
  try {
    const state = await source(); available = conversationStudyItems(state, services).map(item => ({ ...item, sourceLabels: item.sourceRefs.map(ref => state.turns.find(t => t.turnId === ref.turnId)?.displayText.slice(0, 80)) }));
    const saved = state.summary?.studyState;
    if (saved?.epochId === epochId && stable(saved.owner) === stable(repository.owner)) {
      try { const rebuilt = buildConversationStudyPlan(state, { ...services, selections: saved.selections, format: saved.format, owner: repository.owner, epochId, pool });
        if (saved.fingerprint === rebuilt.fingerprint) { plan = rebuilt; session = restoreConversationStudy(plan, saved); } } catch { /* Unsupported/imported/stale state is never assessment evidence. */ }
    }
    draw();
  } catch (failure) { if (current()) { error = failure.message; draw(); } }
  return panel;
}
