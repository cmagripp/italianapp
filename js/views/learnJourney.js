// Taught, resumable lessons. Sequencing and learning evidence live in journey.js;
// this view persists only the current input, assistance and presentation state.
import { html, raw, icon, speak, stopSpeech, keyboardViewportHeight } from '../ui.js';
import { setScene, reducedMotion, dropdown } from '../fx.js';
import { setTitle, setChrome } from '../app.js';
import { store } from '../store.js';
import { getEntry, itemsForScope } from '../data.js';
import { LEARNING_VERSION } from '../learning/model.js';
import { CORE_STAGES, EXPANSIONS } from '../learning/curriculum.js';
import { buildLesson, lessonForms } from '../learning/lesson-content.js';
import { conjugate, TENSE_BY_KEY } from '../conjugator.js';
import { WEATHER_VERBS } from '../learning/content.js';
import { buildJourneyQuestion } from '../learning/lesson-questions.js';
import { createSentencePanel } from '../learning/sentence-panel.js';
import { gradePairActivity } from '../learning/lesson-activities.js';
import { activityHTML, activityState, activityAction, activityActionFromButton, focusActivity, letterAnswer } from '../learning/activity-panel.js';
import { lessonOverviewHTML } from '../learning/lesson-overview.js';
import { progressiveForms, progressiveInfo } from '../learning/progressive-content.js';
import { gradeQuestion } from '../learning/diagnose.js';
import { feedbackHTML as gameFeedbackHTML } from '../games/engine.js';
import { createJourneySession, currentJourneyStep, advanceJourney, recordJourneyAttempt,
  skipJourneyTarget, chooseJourneyChapter, upgradeShortWordSession, journeyProgress, journeyCaseProgress, journeyAttempt, retryJourneyPending, journeyPairAttempt, recordJourneyPairAttempt } from '../learning/journey.js';
import { recommendLesson as recommend, practiceHref } from '../learning/integration.js';

const uid = () => globalThis.crypto?.randomUUID?.() || `journey-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = x => JSON.parse(JSON.stringify(x));
const normalize = x => String(x || '').normalize('NFC').trim().toLocaleLowerCase('it').replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const nameOf = e => e.inf || e.it;
const texts = x => Array.isArray(x) ? x : x ? [x] : [];
const phaseName = step => ['teach','repair'].includes(step.type) ? 'Learn'
  : step.type === 'question' ? step.phase === 'independent' && step.format === 'type' ? 'Recall' : 'Practise' : null;

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
  plan.chapters = plan.chapters.filter(c=>!c.optional || c.id==='mixed' || c.id==='background' || extraTenses.has(c.tense));
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
    ? clone(prior) : createJourneySession({ id: uid(), plan, now: Date.now(), mode, chapterId, caseMode:entry.kind==='verb'&&mode==='lesson',
      targetId: mode === 'review' && allTargets.some(t => t.id === oldObjective) ? oldObjective : undefined });
  if (chapterId && !query.session && mode !== 'review') session = chooseJourneyChapter(plan, session, chapterId, { now: Date.now(), learning:store.learning });
  // Older releases saved an empty introduction recap. Resume at the next real
  // teaching card without pretending that the introduction included practice.
  if (session.journey?.phase === 'recap' && session.journey.chapterId === 'meet'
    && !plan.chapters.find(c=>c.id==='meet')?.groups.some(g=>g.targets?.some(t=>t.available!==false)))
    session = advanceJourney(plan, session, store.learning, { now: Date.now() });
  const upgraded = upgradeShortWordSession(plan,session,{now:Date.now()});
  if(upgraded!==session) {
    session=upgraded;
    session.ui={...session.ui,historyCursor:null,questionId:null,draft:'',given:'',result:null,activity:null,assistance:[],hint:false,forms:false};
  }
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
  ui.overview = entry.kind==='verb' && mode==='lesson' && (query.overview==='1'
    || !query.session&&!chapterId || !!query.session&&ui.overview===true);
  ui.formDecks = ui.formDecks && typeof ui.formDecks === 'object' && !Array.isArray(ui.formDecks)
    ? Object.fromEntries(Object.entries(ui.formDecks).filter(([key,value])=>!['__proto__','prototype','constructor'].includes(key)&&Number.isInteger(value)&&value>=0)) : {};
  // History stores bounded presentation descriptors, never HTML or a copy of the
  // learning state. Reconstruct every page from the current trusted lesson plan.
  const historyStep = snapshot => {
    const chapter = plan.chapters.find(c=>c.id===snapshot?.chapterId);
    const group = chapter?.groups.find(g=>g.id===snapshot.groupId);
    const card = group?.cards?.find(c=>c.id===snapshot.cardId);
    let target = chapter?.groups.flatMap(g=>g.targets||[]).find(t=>t.id===snapshot.targetId);
    const slot=plan.wordLesson?.slots.find(s=>s.id===snapshot.wordSlotId&&s.targetId===target?.id);
    if(slot)target={...target,shortWord:true,wordSlotId:slot.id,wordPairTargets:(slot.pairTargetIds||[]).map(id=>allTargets.find(t=>t.id===id)).filter(Boolean)};
    return { ...snapshot, chapter, group, card, target };
  };
  const safeResult = result => result && typeof result==='object' && typeof result.ok==='boolean' ? {
    ok:result.ok, outcome:['correct','incorrect','revealed'].includes(result.outcome)?result.outcome:'incorrect',
    feedback:typeof result.feedback==='string'?result.feedback.slice(0,3000):'',
    accentIssue:result.accentIssue===true,
    components:Array.isArray(result.components)?result.components.slice(0,20).filter(c=>c&&typeof c.skill==='string'&&typeof c.ok==='boolean').map(c=>({skill:c.skill.slice(0,80),ok:c.ok})):[],
  } : null;
  const safeSnapshot = source => {
    if (!source || typeof source!=='object' || source.version!==1 || source.entryId!==entry.id || source.contentVersion!==plan.version
      || !['teach','question','repair','recap','complete','blocked'].includes(source.type)) return null;
    const snapshot = { version:1, entryId:entry.id, contentVersion:plan.version, type:source.type };
    for (const key of ['chapterId','groupId','cardId','targetId','questionId','repairTag','wordSlotId']) snapshot[key]=typeof source[key]==='string'?source[key].slice(0,300):'';
    snapshot.variant=Number.isInteger(source.variant)&&source.variant>=0&&source.variant<1000000?source.variant:0;
    snapshot.phase=['guided','independent','repair'].includes(source.phase)?source.phase:'guided';
    snapshot.format=['choice','mc','type','match','letters','pairs'].includes(source.format)?source.format:'type';
    snapshot.activity=source.activity&&typeof source.activity==='object'&&JSON.stringify(source.activity).length<20000?clone(source.activity):null;
    snapshot.given=typeof source.given==='string'?source.given.slice(0,500):'';
    snapshot.result=safeResult(source.result);
    snapshot.awaitingContinue=source.awaitingContinue===true;
    snapshot.helpSuggested=source.helpSuggested===true;
    snapshot.pendingCount=Number.isInteger(source.pendingCount)&&source.pendingCount>=0?Math.min(source.pendingCount,10000):0;
    snapshot.scrollTop=Number.isFinite(source.scrollTop)&&source.scrollTop>=0?Math.min(source.scrollTop,100000):0;
    snapshot.index=Number.isInteger(source.index)&&source.index>=0?source.index:0;
    if(snapshot.wordSlotId&&!plan.wordLesson?.slots.some(s=>s.id===snapshot.wordSlotId&&s.targetId===snapshot.targetId))return null;
    const restored=historyStep(snapshot);
    if(!restored.chapter || source.type==='teach'&&!restored.card || ['question','repair'].includes(source.type)&&!restored.target)return null;
    return snapshot;
  };
  ui.history=Array.isArray(ui.history)?ui.history.slice(-40).map(safeSnapshot).filter(Boolean):[];
  ui.historyCursor=Number.isInteger(ui.historyCursor)&&ui.historyCursor>=0&&ui.historyCursor<ui.history.length?ui.historyCursor:null;
  ui.historyReturnScroll=Number.isFinite(ui.historyReturnScroll)&&ui.historyReturnScroll>=0?Math.min(ui.historyReturnScroll,100000):0;
  ui.caseDrafts=ui.caseDrafts&&typeof ui.caseDrafts==='object'&&!Array.isArray(ui.caseDrafts)
    ?Object.fromEntries(Object.entries(ui.caseDrafts).filter(([id,draft])=>plan.chapters.some(c=>c.id===id)&&draft&&typeof draft==='object').slice(0,24)):{};
  const translationVisibility = new Map();
  let renderedStep = '', renderedScene = '', fragmentIndex = 0;
  let disposed = false, submitting = false, question = null, recoveredQuestionId = null;
  let tableTense = null, tableDropdown = null, tableButton = null, tableRestoreFocus = true;
  const stepNow = () => currentJourneyStep(plan, session, store.learning, Date.now());
  let step = stepNow();
  const save = () => {
    if (disposed || store.current.id !== owner) return;
    session.ui = ui; session.updatedAt = Date.now(); store.saveLearningSession(session);
  };
  function updateRoute() {
    const route = new URLSearchParams(); route.set('session', session.id);
    if (mode === 'review') route.set('mode', mode);
    if (ui.overview) route.set('overview','1');
    history.replaceState(history.state, '', `#/learn/${entry.kind === 'verb' ? 'verb' : 'word'}/${encodeURIComponent(entry.id)}?${route}`);
  }
  updateRoute();
  setTitle(`${nameOf(entry)} · lesson`); setChrome({ tabs: false, back: false }); store.pushRecent(entry.id);
  document.body.classList.add('journey-viewport');
  if(entry.kind==='verb') {
    tableButton=document.createElement('button');
    tableButton.type='button';tableButton.className='icon-btn journey-info-toggle';
    tableButton.setAttribute('data-conjugation-toggle','');
    tableButton.setAttribute('aria-label','Verb forms and usage');
    tableButton.setAttribute('aria-haspopup','dialog');
    tableButton.setAttribute('aria-expanded','false');
    tableButton.setAttribute('aria-controls','journey-conjugation-panel');
    tableButton.innerHTML='<svg class="ic ic-info" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>';
    document.querySelector('#enToggle')?.before(tableButton);
    tableButton.addEventListener('click',toggleTable);
  }
  window.scrollTo(0,0);
  const fitViewport = () => {
    const keyboardHeight = keyboardViewportHeight();
    const height = keyboardHeight ?? window.innerHeight;
    if (keyboardHeight === null) document.body.style.removeProperty('--journey-viewport-height');
    else document.body.style.setProperty('--journey-viewport-height',`${keyboardHeight}px`);
    document.body.classList.toggle('journey-compact',height<600);
    const panel = root.querySelector('.journey-main'), input = document.activeElement;
    if (panel && input?.matches('[data-answer]')) {
      const bottom = input.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
      if (bottom > 0) panel.scrollTop += bottom + 16;
    }
  };
  fitViewport();
  window.visualViewport?.addEventListener('resize',fitViewport);
  window.visualViewport?.addEventListener('scroll',fitViewport);
  window.addEventListener('resize',fitViewport);
  window.addEventListener('pageshow',fitViewport);
  window.addEventListener('orientationchange',fitViewport);
  document.addEventListener('focusin',fitViewport);
  document.addEventListener('focusout',fitViewport);

  const words = createSentencePanel(root, {
    context(sentence) {
      const shown = ui.overview?{chapter:{tense:'presente'}}:reviewingHistory() ? historyStep(ui.history[ui.historyCursor]) : step;
      const q = ui.overview?null:reviewingHistory() ? snapshotQuestion(shown) : question;
      return { entry, tense:shown.chapter?.tense, role:q?.meta?.role,
        translation:sentence?.closest('.journey-example')?.querySelector('[data-translation]')?.textContent || q?.context?.en || q?.exampleTranslation || '' };
    },
    onReveal(result) {
      for (const candidate of result.candidates || []) {
        expose(candidate.exposureForms);
        expose([candidate.meaning,...String(candidate.meaning||'').split(/[;,]/).flatMap(s=>[s,s.trim().replace(/^to\s+/i,''),s.trim().replace(/^to\s+/i,'').replace(/\([^)]*\)/g,'').trim()]),
          ...[candidate.singularArticle,candidate.pluralArticle].filter(Boolean).flatMap(s=>String(s).split(/\s*[\/|]\s*/))]);
      }
      if (step.type==='question'&&!step.awaitingContinue&&!ui.assistance.includes('hint')) ui.assistance.push('hint');
      save();
    },
  });
  function updateScrollCue() {
    const panel=root.querySelector('.journey-main');
    root.querySelector('.journey-page')?.classList.toggle('has-more-content',!!panel&&panel.scrollHeight-panel.scrollTop-panel.clientHeight>16);
  }
  function expose(answer) {
    for (const a of texts(answer)) if (normalize(a)) ui.exposures[normalize(a)] = session.index || 0;
  }
  function recoverQuestion() {
    if (!question || recoveredQuestionId===step.questionId) return;
    recoveredQuestionId=step.questionId;
    const events=store.learning.events || {};
    if (question.type==='pairs') {
      let activity=activityState({...question,id:step.questionId},ui.activity);
      const prefix=`${step.questionId}:pair:`;
      const saved=Object.values(events).filter(event=>event.id.startsWith(prefix))
        .sort((a,b)=>a.index-b.index||a.at-b.at||a.id.localeCompare(b.id));
      for(const event of saved) {
        session=recordJourneyPairAttempt(plan,session,event,{added:false,learning:store.learning});
        const pair=question.pairs.find(pair=>pair.targetId===event.objectiveId);
        if(!pair || !session.answeredEventIds.includes(event.id))continue;
        const attempt=Number(event.id.slice(`${prefix}${encodeURIComponent(pair.targetId)}:`.length));
        if(Number.isInteger(attempt)&&attempt>=0)activity.attempts[pair.id]=Math.max(activity.attempts[pair.id]||0,attempt+1);
      }
      // Events contain no raw answers. Keep saved physical matches first, then
      // restore a missing correct match with an equivalent available form.
      const matched=session.journey.pairMatches?.[step.questionId] || [];
      for(const pair of question.pairs)if(matched.includes(pair.targetId)&&!activity.matches.some(match=>match.leftId===pair.id)) {
        const tile=question.rightTiles.find(tile=>!activity.matches.some(match=>match.rightId===tile.id)
          &&pair.answers.some(answer=>normalize(answer)===normalize(tile.text)));
        if(tile)activity.matches.push({leftId:pair.id,rightId:tile.id});
      }
      ui.activity=activityState({...question,id:step.questionId},activity);
    }
    const event=events[step.questionId];
    if(event) {
      session=recordJourneyAttempt(plan,session,event,{added:false,learning:store.learning});
      if(session.journey.awaitingContinue&&session.answeredEventIds.includes(event.id)
        &&(!ui.result||ui.result.ok!==event.ok||ui.result.outcome!==event.outcome
          ||JSON.stringify(ui.result.errorTags||[])!==JSON.stringify(event.errorTags||[])
          ||JSON.stringify(ui.result.components||[])!==JSON.stringify(event.components||[]))) {
        ui.result={ok:event.ok,outcome:event.outcome,errorTags:event.errorTags||[],components:event.components||[],
          feedback:event.ok?'':`Use ${question.answer[0]}. ${question.explanation||''}`};
        // A canonical event survives even if the optional saved draft did not.
        if(gradeQuestion(question,ui.given||'').ok!==event.ok)ui.given='';
      }
      if(session.journey.awaitingContinue) {
        expose(question.answer);expose(question.meta?.feedbackExposureForms);
        for(const choice of question.choices||[])expose(choice.value??choice.label);
        if(event.outcome==='revealed')for(const pair of question.pairs||[])expose(pair.answers);
      }
    }
    step=stepNow();
  }
  function prepare() {
    step = stepNow();
    if(session.journey.wordShort && step.type==='recap') {
      session=advanceJourney(plan,session,store.learning,{now:Date.now()});
      step=stepNow();
    }
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
        ui.questionId = step.questionId; ui.draft = ''; ui.given = ''; ui.result = null; ui.activity=null;
        ui.hint = false; ui.forms = false; ui.assistance = [];
        for (const answer of question.meta?.exposureForms || question.answer || []) {
          const last = ui.exposures[normalize(answer)];
          if (typeof last === 'number' && (session.index || 0) - last < 2) ui.assistance.push('visible-form');
        }
        expose(question.meta?.promptExposureForms);
        for (const choice of question.choices || []) expose(choice.value ?? choice.label);
        for (const pair of question.pairs || []) expose(pair.answers);
      }
      recoverQuestion();
      if (question?.type==='pairs' && !step.awaitingContinue) {
        const activity=activityState({...question,id:step.questionId},ui.activity);
        const hidden=new Set(activity.matches.map(pair=>pair.rightId));
        for(const tile of question.rightTiles)if(!hidden.has(tile.id))expose(tile.text);
        if(activity.feedback)expose([activity.feedback.given,activity.feedback.expected]);
      }
    } else question = null;
    save();
  }
  function formsHTML(forms = []) {
    if (!forms.length) return '';
    return html`<table class="journey-forms"><tbody>${raw(forms.map(row => html`<tr><td>${row.label}${row.gloss ? raw(html`<small>${row.gloss}</small>`) : ''}</td><td lang="it">${row.form}</td></tr>`).join(''))}</tbody></table>`;
  }
  function formDeckHTML(forms = [], key = '') {
    if (!forms.length) return '';
    const active = Math.min(forms.length-1, ui.formDecks[key] || 0);
    return html`<section class="journey-form-stack" aria-label="Forms to listen to">
      <div class="journey-form-list" data-form-track data-form-key="${key}" role="group" aria-label="Forms. Select a row to listen.">
        ${raw(forms.map((row,i)=>html`<button type="button" class="journey-form-row ${i===active?'is-active':''}" data-form-card="${i}" data-form-say="${row.form}" aria-pressed="${i===active}" aria-label="Listen to ${row.label}: ${row.form}${row.gloss?` · ${row.gloss}`:''}">
          <span class="journey-form-subject"><span class="journey-form-person">${row.label}</span>${row.gloss?raw(html`<span class="journey-form-gloss">${row.gloss}</span>`):''}</span>
          <span class="journey-form-value" lang="it">${row.form}</span><span class="journey-form-sound" aria-hidden="true">${raw(icon('speaker',{size:19}))}</span>
        </button>`).join(''))}
      </div>
    </section>`;
  }
  function examplesHTML(examples = []) {
    if (!examples.length) return '';
    return html`<section class="journey-examples" aria-label="Examples in conversation"><div class="journey-example-deck" tabindex="${examples.length>1?'0':'-1'}" aria-label="${examples.length>1?'Examples. Swipe left or right to explore.':'Example in conversation'}">${raw(examples.map(ex=>{
      const key = `${ex.it}|${ex.en||''}`, shown = translationVisibility.get(key) !== false;
      const translationId = `journey-translation-${++fragmentIndex}`;
      return html`<article class="journey-example" data-example-key="${key}"><span class="journey-example-kicker">In conversation</span>
        <div class="journey-example-line"><p lang="it" data-italian-sentence>${ex.it}</p><button type="button" class="journey-audio" data-say="${ex.it}" aria-label="Listen to the example">${raw(icon('speaker', { size: 19 }))}</button></div>
        ${ex.en?raw(html`<button type="button" class="journey-translation-toggle" data-translation-toggle aria-controls="${translationId}" aria-expanded="${shown}">${shown?'Hide translation':'Show translation'}</button><p class="journey-translation" id="${translationId}" data-translation ${shown?'':raw('hidden')}>${ex.en}</p>`):''}
      </article>`;
    }).join(''))}</div></section>`;
  }
  function cardHTML(card, { title = true, displayStep = step } = {}) {
    if (!card) return '';
    const meet = title && ['meet','meaning'].includes(displayStep.chapter?.id) && card.id==='meaning';
    const key = `${displayStep.chapter?.id||''}:${displayStep.group?.id||''}:${card.id||card.title}`;
    const body=texts(card.body), notes=[...texts(card.notes)];
    // Keep the forms in view; the remaining teaching explanation sits beside the pattern notes.
    if(card.forms?.length && body.length===1) {
      const split=body[0].match(/^(.+?[.!?])\s+([\s\S]+)$/);
      if(split){body[0]=split[1];notes.unshift(split[2]);}
    }
    return html`<section class="journey-teaching ${meet?'is-meet':''}">
      <div class="journey-kicker">${displayStep.chapter?.title||'Your lesson'}${!meet&&displayStep.group?.title?` · ${displayStep.group.title}`:''}</div>
      <div class="journey-intro">${title?raw(html`<div class="journey-intro-title"><h1 data-focus tabindex="-1">${card.title}</h1>${meet?raw(html`<button type="button" class="journey-hero-audio" data-say="${entry.kind==='word'?card.title:nameOf(entry)}" aria-label="Listen to ${card.title}">${raw(icon('speaker',{size:25}))}</button>`):''}</div>`):''}
        ${raw(body.map(p=>html`<p>${p}</p>`).join(''))}</div>
      ${raw(formDeckHTML(card.forms,key))}
      ${notes.length?raw(html`<aside class="journey-insight"><div class="journey-insight-heading">${raw(icon('sparkle',{size:18}))}<span>Remember</span></div>${raw(notes.map(p=>html`<p>${p}</p>`).join(''))}</aside>`):''}
      ${raw(examplesHTML(card.examples))}
    </section>`;
  }
  function formIndex(track) {
    return Math.max(0,Math.min(track.children.length-1,ui.formDecks[track.dataset.formKey]||0));
  }
  function updateFormDeck(track) {
    const active = formIndex(track);
    track.querySelectorAll('[data-form-card]').forEach((card,i)=>{
      card.classList.toggle('is-active',i===active);card.setAttribute('aria-pressed',String(i===active));
    });
  }
  function moveForm(track, index, { focus = false } = {}) {
    const cards = [...track.querySelectorAll('[data-form-card]')];
    const next = Math.max(0,Math.min(cards.length-1,index)), card = cards[next]; if (!card) return;
    ui.formDecks[track.dataset.formKey] = next;
    updateFormDeck(track);
    if (focus) card.focus();
    save();
  }
  function progressHTML(progress, stage, displayStep = step) {
    const current = progress.chapters.find(c=>c.id===displayStep.chapter?.id);
    const done = progress.wordShort?progress.answered:current?.ready||0;
    const total = progress.wordShort?progress.total:current?.total||0;
    const label = progress.wordShort?'Word checks completed':'Chapter skills ready';
    return html`<div class="journey-progress-line"><ol class="journey-stages" aria-label="Chapter stages">${raw((entry.kind==='word'?['Learn','Practise']:['Learn','Practise','Recall']).map(name=>html`<li ${name===stage?raw('aria-current="step"'):''}>${name}</li>`).join(''))}</ol>
      ${total?raw(html`<div class="journey-progress-summary" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-valuetext="${done} of ${total} ${label.toLowerCase()}"><span>${done}/${total}</span><span class="journey-progress-meter" aria-hidden="true"><span style="width:${100*done/total}%"></span></span></div>`):''}</div>`;
  }
  function revealTeaching(card, chapter = step.chapter) {
    expose(card?.exposureForms);
    for (const row of card?.forms || []) expose(String(row.form).split(/\s*\/\s*/));
    // Track complete answers found in prose/examples as well as isolated forms.
    const shown = normalize([card?.body, ...(card?.notes || []), ...(card?.examples || []).map(x=>x.it)].join(' '));
    for (const target of chapter?.groups?.flatMap(g=>g.targets || []) || []) {
      const q = buildJourneyQuestion(entry, chapter, target, { variant: 0, format: 'type' });
      for (const a of q?.answer || []) if (a && shown.includes(normalize(a))) expose(a);
    }
  }
  const reviewingHistory = () => ui.historyCursor !== null;
  function capturePage() {
    if (reviewingHistory() || ui.paused) return;
    const progress = journeyProgress(plan,session,store.learning);
    const pending = progress.wordShort ? progress.pending : step.type==='complete' ? progress.chapters.filter(c=>!c.optional).flatMap(c=>c.pending)
      : progress.chapters.find(c=>c.id===step.chapter?.id)?.pending || [];
    const snapshot = safeSnapshot({version:1,entryId:entry.id,contentVersion:plan.version,
      type:step.type,chapterId:step.chapter?.id,groupId:step.group?.id,cardId:step.card?.id,targetId:step.target?.id,wordSlotId:step.target?.wordSlotId,
      phase:step.phase,questionId:step.questionId,variant:step.type==='repair'?session.journey.lastAttempt?.variant:step.variant,
      format:step.format,repairTag:step.repairTag,awaitingContinue:step.awaitingContinue,helpSuggested:step.helpSuggested,
      given:ui.given||ui.draft,result:ui.result,activity:ui.activity,pendingCount:pending.length,index:session.index||0,
      scrollTop:root.querySelector('.journey-main')?.scrollTop||0});
    if (!snapshot) return;
    const key = s=>[s.type,s.chapterId,s.groupId,s.cardId,s.questionId,s.index,s.awaitingContinue].join('|');
    if (ui.history.length && key(ui.history.at(-1))===key(snapshot)) ui.history[ui.history.length-1]=snapshot;
    else ui.history.push(snapshot);
    ui.history=ui.history.slice(-40);
  }
  function snapshotQuestion(snapshot) {
    return snapshot.target ? buildJourneyQuestion(entry,snapshot.chapter,snapshot.target,{
      variant:snapshot.variant,format:snapshot.format,phase:snapshot.phase,repairTag:snapshot.repairTag,
    }) : null;
  }
  function exposeHistory(snapshot) {
    const past = historyStep(snapshot);
    if(past.type==='teach')revealTeaching(past.card,past.chapter);
    else if(past.type==='repair'){
      const cards=past.chapter.groups.flatMap(g=>g.cards||[]);
      const cardId=repairCardId(past);
      revealTeaching(cards.find(c=>c.id===cardId)||past.card||past.group?.cards?.[0],past.chapter);
      if(past.helpSuggested)expose(snapshotQuestion({...past,phase:'independent',format:'type'})?.answer);
    } else if(past.type==='question'){
      const q=snapshotQuestion(past);
      expose(q?.meta?.promptExposureForms);
      for(const c of q?.choices||[])expose(c.value??c.label);
      for(const pair of q?.pairs||[])expose(pair.answers);
      if(past.awaitingContinue){expose(q?.answer);expose(q?.meta?.feedbackExposureForms);}
    }
    // Looking back for help is supported practice. Preserve the active draft and
    // question, while preventing the revisit from counting as unaided recall.
    if(step.type==='question'&&!step.awaitingContinue&&!ui.assistance.includes('visible-form'))ui.assistance.push('visible-form');
  }
  function browseHistory(cursor) {
    if (!ui.history.length) return;
    if (!reviewingHistory()) ui.historyReturnScroll=root.querySelector('.journey-main')?.scrollTop||0;
    ui.historyCursor=Math.max(0,Math.min(ui.history.length-1,cursor));
    exposeHistory(ui.history[ui.historyCursor]);stopSpeech();save();draw(true);
  }
  function resumeCurrent() {
    ui.historyCursor=null;stopSpeech();save();draw(true);
    const panel=root.querySelector('.journey-main');if(panel)panel.scrollTop=ui.historyReturnScroll||0;
  }
  function historyHTML(snapshot) {
    const past=historyStep(snapshot);
    const banner=html`<aside class="journey-history-banner"><p>Previous page · ${ui.historyCursor+1} of ${ui.history.length}</p><p>Your current lesson is saved.</p><button type="button" data-lesson-current>Return to current lesson ${raw(icon('chevronRight',{size:16}))}</button></aside>`;
    let content='';
    if(past.type==='teach')content=cardHTML(past.card,{displayStep:past});
    else if(past.type==='repair')content=repairHTML(past,snapshot);
    else if(past.type==='question'){
      const q=snapshotQuestion(past);
      content=q?html`<section class="journey-exercise-card q-card glass-flat"><div class="journey-kicker">${phaseName(past)||'Practise'} · ${past.chapter.title}</div><div class="journey-prompt" data-focus tabindex="-1">${raw(promptHTML(q.prompt))}</div>
        ${['letters','pairs'].includes(q.type)?raw(activityHTML({...q,id:past.questionId},past.activity,{readOnly:true,review:past.result?.outcome!=='revealed'})):q.choices?.length?raw(html`<div class="journey-choices">${raw(q.choices.map((c,i)=>{
          const value=c.value??c.label,chosen=normalize(past.given)===normalize(value),right=(q.answer||[]).some(a=>normalize(a)===normalize(value));
          return html`<button type="button" class="journey-choice choice ${past.awaitingContinue&&right?'is-correct':past.awaitingContinue&&chosen?'is-wrong':''}" disabled aria-pressed="${chosen}"><span class="journey-choice-marker" aria-hidden="true">${String.fromCharCode(65+i)}</span><span class="journey-choice-label" lang="${q.meta?.answerLanguage==='en'?'en':'it'}">${c.label}</span>${past.awaitingContinue&&(right||chosen)?raw(html`<small>${right?'Correct':'Your answer'}</small>`):''}</button>`;
        }).join(''))}</div>`):raw(html`<p class="journey-given"><span>${past.awaitingContinue?'Your answer':'Your draft'}</span><span lang="${q.meta?.answerLanguage==='en'?'en':'it'}">${past.given||'—'}</span></p>`)}</section>
        ${past.awaitingContinue?raw(feedbackHTML(past.result,q,past.given)):raw('<p class="journey-note">You left this question without submitting an answer.</p>')}`:'<p>This earlier exercise is no longer available.</p>';
    } else if(['recap','complete'].includes(past.type))content=html`<section class="journey-recap"><div class="journey-kicker">Previous recap</div><h1 data-focus tabindex="-1">${past.type==='complete'?'A little more Italian.':`Your progress · ${past.chapter.title}`}</h1><p>${past.pendingCount?'A few parts were saved for more practice.':'You worked through this part of the lesson.'}</p></section>`;
    else content='<h1 data-focus tabindex="-1">This part was saved for later</h1><p>Your practice is preserved in the current lesson.</p>';
    return banner+content;
  }
  function closeTable({restoreFocus=true}={}) {
    const opened=tableDropdown;
    tableRestoreFocus=restoreFocus;
    tableDropdown=null;
    opened?.close({restoreFocus});
    tableButton?.setAttribute('aria-expanded','false');
  }
  function tableHTML() {
    const ongoing=['presenteProgressivo','imperfettoProgressivo'].includes(tableTense)&&progressiveInfo(entry).supported;
    const tense=ongoing?tableTense:TENSE_BY_KEY[tableTense]?tableTense:'presente',weather=WEATHER_VERBS.has(entry.inf);
    const tenseName=ongoing?(tense==='imperfettoProgressivo'?'Stavo + gerundio':'Sto + gerundio'):TENSE_BY_KEY[tense].name;
    const grammar=conjugate(entry.inf,{aux:entry.aux,isc:entry.isc});
    const selectedTargets=plan.chapters.find(c=>c.tense===tense)?.groups.flatMap(g=>g.targets||[])||[];
    const constrained=selectedTargets.some(t=>t.subjectLabel);
    const rows=Array.from({length:6},(_,person)=>{
      const forms=ongoing?progressiveForms(entry,person,{chapter:tense==='imperfettoProgressivo'?'background':'present'}):lessonForms(entry,tense,person);expose(forms);
      const subject=selectedTargets.find(t=>t.person===person&&t.subjectLabel)?.subjectLabel;
      const label=subject|| (weather&&person===2?'impersonal':tense==='imperativo'&&person===2?'Lei':tense==='imperativo'&&person===5?'Loro':['io','tu','lui / lei / Lei','noi','voi','loro'][person]);
      const gloss=subject|| (weather&&person===2?'it · weather':tense==='imperativo'&&person===2?'you · formal':tense==='imperativo'&&person===5?'you · formal plural':['I','you · informal','he / she / you · formal','we','you · plural','they'][person]);
      return {label,gloss,form:forms.length?forms.join(' / '):'—'};
    });
    const notes=[];
    if(weather)notes.push('Weather expressions use the impersonal third-person singular.');
    else if(constrained)notes.push('Use the grammatical subject of the meaning taught here. The person affected is not the subject.');
    else notes.push('Formal Lei takes the same verb form as lui and lei.');
    if(tense==='imperativo')notes.push('The imperative addresses someone, so it has no io form. Loro is a very formal plural address.');
    if(TENSE_BY_KEY[tense]?.compound){
      if(grammar.auxBoth)notes.push('This verb can use avere or essere, depending on its meaning and construction. Both are shown here.');
      if(grammar.aux==='essere'||grammar.auxBoth)notes.push('With essere, the participle agrees with the subject. With formal Lei, its ending follows the person you address.');
      else notes.push('In these avere forms, the participle stays the same.');
    }
    if(ongoing)notes.push(tense==='imperfettoProgressivo'?'An action in progress at a past moment. For a past habit, use the simple imperfetto.':'An action in progress now. For a general routine, use the simple present.');
    if(entry.inf==='piacere')notes.push('The thing you like is the subject: mi piace il libro; mi piacciono i libri. The table also includes forms for other subjects.');
    const content=html`<header class="journey-panel-header"><div><span class="journey-kicker">Verb forms</span><h2 id="journey-conjugation-title">${entry.inf}</h2></div><button type="button" data-conjugation-close aria-label="Close verb forms">${raw(icon('x',{size:22}))}</button></header>
      <div class="journey-conjugation-tabs" role="group" aria-label="Choose a tense">${raw([['presente','Present'],['passatoProssimo','Passato prossimo'],['imperfetto','Imperfetto'],['futuro','Future'],['condizionale','Conditional'],...(progressiveInfo(entry).supported?[['presenteProgressivo','Happening now'],['imperfettoProgressivo','Happening then']]:[])].map(([key,label])=>html`<button type="button" data-conjugation-tense="${key}" aria-pressed="${tense===key}">${label}</button>`).join(''))}</div>
      <section class="journey-conjugation-content" tabindex="0" aria-label="${tenseName} forms"><h3>${tenseName}</h3>${raw(formsHTML(rows.filter(row=>row.form!=='—')))}${raw(notes.map(note=>html`<p>${note}</p>`).join(''))}</section>`;
    save();
    return content;
  }
  function renderTable() {
    if(!tableDropdown?.el)return;
    tableDropdown.el.innerHTML=tableHTML();
    tableDropdown.reposition();
  }
  function revealTableTense({focus=false}={}) {
    const selected=tableDropdown?.el.querySelector('[data-conjugation-tense][aria-pressed="true"]');
    if(!selected)return;
    const track=selected.parentElement,buttonBox=selected.getBoundingClientRect(),trackBox=track.getBoundingClientRect();
    // Keep the chosen tense visible without scrolling the lesson or the page.
    if(buttonBox.right>trackBox.right-6)track.scrollLeft+=buttonBox.right-trackBox.right+6;
    else if(buttonBox.left<trackBox.left+6)track.scrollLeft+=buttonBox.left-trackBox.left-6;
    if(focus)selected.focus({preventScroll:true});
  }
  function tableClick(event) {
    const button=event.target.closest('button');
    if(!button||!tableDropdown?.el.contains(button))return;
    if(button.hasAttribute('data-conjugation-close'))closeTable();
    else if(button.hasAttribute('data-conjugation-tense')) {
      tableTense=button.dataset.conjugationTense;renderTable();
      revealTableTense({focus:true});
    }
  }
  function tableKey(event) {
    if(event.key!=='Tab'||!tableDropdown?.el)return;
    const controls=[...tableDropdown.el.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')].filter(el=>!el.hidden);
    const first=controls[0],last=controls.at(-1);
    if(!first)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus({preventScroll:true});}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true});}
  }
  function toggleTable() {
    if(tableDropdown){closeTable();return;}
    if(entry.kind!=='verb'||disposed||ui.paused||!tableButton?.isConnected)return;
    const shown=ui.overview?null:reviewingHistory()?historyStep(ui.history[ui.historyCursor]):step;
    tableTense=shown?.target?.progressive?shown.target.tense:shown?.chapter?.tense||'presente';
    if(step.type==='question'&&!step.awaitingContinue&&!ui.assistance.includes('visible-form'))ui.assistance.push('visible-form');
    stopSpeech();
    if(document.activeElement?.matches('[data-answer]'))document.activeElement.blur();
    tableRestoreFocus=true;
    const opened=dropdown(tableButton,tableHTML(),{align:'end',width:380,onClose(){
      opened.el.removeEventListener('click',tableClick);opened.el.removeEventListener('keydown',tableKey);
      if(tableDropdown===opened)tableDropdown=null;
      tableButton?.setAttribute('aria-expanded','false');
      if(tableRestoreFocus&&tableButton?.isConnected&&!tableButton.hidden)tableButton.focus({preventScroll:true});
    }});
    tableDropdown=opened;
    opened.el.id='journey-conjugation-panel';opened.el.classList.add('journey-conjugation-dropdown');
    opened.el.setAttribute('role','dialog');opened.el.setAttribute('aria-modal','true');
    opened.el.setAttribute('aria-labelledby','journey-conjugation-title');
    opened.el.addEventListener('click',tableClick);opened.el.addEventListener('keydown',tableKey);
    opened.reposition();revealTableTense();opened.el.querySelector('[data-conjugation-close]')?.focus({preventScroll:true});
    save();
  }
  function primary(label, attrs = 'data-continue') { return html`<button type="button" class="btn primary journey-primary" ${raw(attrs)}>${label}</button>`; }
  function actionsHTML(learning = true) {
    const dots = html`<span class="journey-action-dots" aria-hidden="true">${raw([0,1,2].map(i=>html`<span data-action-dot="${i}" class="${i===0?'is-current':''}"></span>`).join(''))}</span>`;
    const actions = [html`<button type="button" class="btn journey-action" data-continue aria-describedby="journey-action-status"><span>${learning?'Continue':'Try it together'}</span>${raw(dots)}</button>`,
      html`<a class="btn journey-action" href="#/reference/${encodeURIComponent(entry.id)}" aria-describedby="journey-action-status"><span>Examples and forms</span>${raw(dots)}</a>`,
      html`<button type="button" class="btn journey-action" data-skip aria-describedby="journey-action-status"><span>Skip · save for later</span>${raw(dots)}</button>`];
    return html`<footer class="journey-action-dock" aria-label="Lesson actions">
      <div class="journey-action-track" data-action-track tabindex="0" role="group" aria-label="Lesson actions. Swipe, or use Left and Right arrows. Home and End reach the first and last action.">${raw(actions.join(''))}</div>
      <span class="journey-sr-only" id="journey-action-status" data-action-status aria-live="polite" aria-atomic="true">Action 1 of 3</span>
    </footer>`;
  }
  function actionIndex(track) {
    const cards=[...track.children],origin=cards[0]?.offsetLeft||0;
    return cards.reduce((best,card,i)=>Math.abs(card.offsetLeft-origin-track.scrollLeft)<Math.abs(cards[best].offsetLeft-origin-track.scrollLeft)?i:best,0);
  }
  function updateActions() {
    const track = root.querySelector('[data-action-track]'); if (!track) return;
    const index = actionIndex(track);
    root.querySelectorAll('[data-action-dot]').forEach(dot=>dot.classList.toggle('is-current',Number(dot.dataset.actionDot)===index));
    const status=root.querySelector('[data-action-status]');
    const text=`Action ${index+1} of ${track.children.length}`;
    if(status?.textContent!==text)status.textContent=text;
  }
  function moveAction(direction, {focus=false,edge=null}={}) {
    const track = root.querySelector('[data-action-track]'); if (!track) return;
    const focused=[...track.children].indexOf(document.activeElement);
    const current=focus&&focused>=0?focused:actionIndex(track);
    const next = edge==='first'?0:edge==='last'?track.children.length-1:Math.max(0,Math.min(track.children.length-1,current+direction));
    const card=track.children[next];
    track.scrollTo({left:card.offsetLeft-track.children[0].offsetLeft,behavior:reducedMotion()?'instant':'smooth'});
    if(focus)card.focus({preventScroll:true});
  }
  function moveExample(track, key) {
    const cards=[...track.children],center=track.getBoundingClientRect().left+track.clientWidth/2;
    const index=cards.reduce((best,card,i)=>Math.abs(card.getBoundingClientRect().left+card.clientWidth/2-center)<Math.abs(cards[best].getBoundingClientRect().left+cards[best].clientWidth/2-center)?i:best,0);
    const next=key==='Home'?0:key==='End'?cards.length-1:Math.max(0,Math.min(cards.length-1,index+(key==='ArrowRight'?1:-1)));
    const card=cards[next],delta=card.getBoundingClientRect().left+card.getBoundingClientRect().width/2-center;
    track.scrollTo({left:track.scrollLeft+delta,behavior:reducedMotion()?'instant':'smooth'});
    track.focus({preventScroll:true});
  }
  function repairCardId(shown) {
    if(shown.target?.progressive) return ['auxiliary','auxiliaryPerson','person'].includes(shown.repairTag)?'progressive-stare':'progressive-forms';
    return ['auxiliary','auxiliaryPerson'].includes(shown.repairTag)?'auxiliary':['participle','agreement'].includes(shown.repairTag)&&entry.kind==='verb'?'participle':null;
  }
  function repairHTML(displayStep = step, snapshot = null) {
    const cards = displayStep.chapter?.groups.flatMap(g => g.cards || []) || [];
    const cardId = repairCardId(displayStep);
    const card = cards.find(c => c.id === cardId) || displayStep.card || displayStep.group?.cards?.[0];
    const result=snapshot?snapshot.result:ui.result;
    if(!snapshot)revealTeaching(card);
    if (!displayStep.helpSuggested) return html`<h1 data-focus tabindex="-1">Let’s work on this part</h1>${result?.feedback ? raw(html`<p>${result.feedback}</p>`) : ''}${raw(cardHTML(card, { title: false, displayStep }))}`;
    const model = buildJourneyQuestion(entry, displayStep.chapter, displayStep.target, { variant: snapshot?snapshot.variant:session.journey.lastAttempt?.variant || 0, format: 'type', phase: 'independent' });
    if (!model) return cardHTML(card,{displayStep});
    if(!snapshot)expose(model.answer);
    const answer = model.answer[0], compound = model.meta?.diagnostic?.compound;
    const pieces = answer.split(' ');
    const labels = {gerund:'gerundio',auxiliary:displayStep.target?.progressive?'form of stare':'auxiliary',participle:'past participle',person:'person',clitic:'pronoun',article:'article',plural:'plural'};
    const kept = (result?.components || []).filter(c=>c.ok&&labels[c.skill]).map(c=>labels[c.skill]);
    const rows = compound && pieces.length > 1 ? [
      ...(pieces.length > 2 ? [{label:'Pronoun',form:pieces.slice(0,-2).join(' ')}] : []),
      {label:'Auxiliary',form:pieces.at(-2)}, {label:'Past participle',form:pieces.at(-1)},
    ] : [{label:'Requested form',form:answer}];
    return html`<h1 data-focus tabindex="-1">Let’s work through an example</h1>
      ${kept.length ? raw(html`<p>You already had the ${kept.join(' and ')} right. Keep that part as you build the answer.</p>`) : ''}
      ${result?.feedback ? raw(html`<p>${result.feedback}</p>`) : ''}
      <div class="journey-prompt">${raw(promptHTML(model.prompt))}</div>${raw(formsHTML(rows))}
      ${model.context ? raw(examplesHTML([model.context])) : raw(html`<p class="journey-answer" lang="it">${answer}</p>`)}
      <p>${model.tip || 'Use the model to connect the meaning with its form. We’ll practise a smaller step next.'}</p>
      <p class="journey-note">You can take your time, pause, or save this part for later.</p>`;
  }
  function feedbackHTML(result = ui.result, displayQuestion = question, given = ui.given, {showNext=false} = {}) {
    if (!result || !displayQuestion) return '';
    const pairs=displayQuestion.type==='pairs';
    const correct=displayQuestion.answer?.[0]||'';
    const title=pairs?(result.ok?'All pairs matched.':'Here are the forms.'):result.ok?'That’s right.':result.outcome==='revealed'?'Here’s the answer.':`Use ${correct}.`;
    const explanation=result.ok?(displayQuestion.context?(result.accentIssue?result.feedback:displayQuestion.meta?.role==='formal'?'Lei is formal you; it uses the third-person singular.':''):displayQuestion.explanation||(result.accentIssue?result.feedback:'')):result.feedback;
    const detail=pairs?'':html`${!displayQuestion.choices?.length?raw(html`<p class="journey-given"><span>Your answer</span><span lang="it">${given||'—'}</span></p>`):''}
      ${!result.ok?raw(html`<p class="journey-answer" lang="it">${correct}</p>`):''}
      ${explanation?raw(html`<p>${explanation}</p>`):''}
      ${displayQuestion.context?raw(html`<div class="journey-feedback-context"><p lang="it" data-italian-sentence>${displayQuestion.context.it}</p><p class="journey-translation">${displayQuestion.context.en}</p></div>`):''}
      ${!result.ok?raw('<p class="journey-note">We’ll work on this part together, then try another example.</p>'):''}`;
    return html`<aside class="journey-feedback ${result.ok?'is-correct':''}">${raw(gameFeedbackHTML({ok:result.ok,title:html`${title}`,detail,nextAttribute:'data-continue',showNext}))}</aside>`;
  }
  function exerciseHTML() {
    if (!question) return html`<h1 data-focus tabindex="-1">Let’s use the reference</h1><p>There isn’t a reliable exercise for this part yet. You can read its examples and continue.</p>${raw(primary('Continue with this part saved', 'data-skip'))}<a class="btn secondary" href="#/reference/${encodeURIComponent(entry.id)}">Examples and forms</a>`;
    const answered = !!step.awaitingContinue;
    const choices = question.choices || [];
    const interactive = ['letters','pairs'].includes(question.type);
    return html`<section class="journey-exercise-card q-card" data-activity="${question.type}"><div class="journey-prompt" data-focus tabindex="-1">${raw(promptHTML(question.prompt))}</div>
      ${interactive ? raw(activityHTML({...question,id:step.questionId},ui.activity,{readOnly:answered})) : choices.length ? raw(html`${!answered&&step.format==='match'?raw('<p class="journey-match-cue">Match the form.</p>'):''}<div class="journey-choices">${raw(choices.map((c,i) => {
        const value = c.value ?? c.label;
        const chosen = normalize(ui.given) === normalize(value);
        const right = (question.answer || []).some(a => normalize(a) === normalize(value)) || c.correct === true;
        return html`<button type="button" data-choice="${i}" class="journey-choice choice ${answered && right ? 'is-correct' : answered && chosen ? 'is-wrong' : ''}" ${answered ? raw('disabled') : ''} aria-pressed="${chosen}"><span class="journey-choice-marker" aria-hidden="true">${String.fromCharCode(65+i)}</span><span class="journey-choice-label" lang="${question.meta?.answerLanguage==='en'?'en':'it'}">${c.label}</span>${answered && (right || chosen) ? raw(html`<small>${right ? 'Correct' : 'Your answer'}</small>`) : ''}</button>`;
      }).join(''))}</div>`) : raw(html`<form data-answer-form autocomplete="off"><label for="journey-answer">${question.meta?.answerLanguage === 'en' ? 'Your answer in English' : 'Your answer in Italian'}</label><input id="journey-answer" data-answer type="text" value="${ui.draft || ''}" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" ${answered ? raw('readonly') : ''}>
      ${answered ? '' : raw(html`<div class="journey-accents" aria-label="Accented letters">${raw(['à','è','é','ì','ò','ù',"'"].map(c=>html`<button type="button" data-letter="${c}" aria-label="Insert ${c}">${c}</button>`).join(''))}</div><button type="submit" class="btn primary journey-primary" data-check ${ui.draft?.trim() ? '' : raw('disabled')}>Check answer</button>`)}</form>`)}
      </section>
      ${ui.hint && !answered ? raw(html`<aside class="journey-help"><h2>A hint</h2><p>${question.tip || step.target?.explanation || 'Look at the person and the form you are practising.'}</p>${ui.forms ? raw((step.group?.cards || []).map(c=>cardHTML(c, { title: false })).join('')) : raw('<button type="button" class="btn ghost" data-show-forms>Show the lesson</button>')}</aside>`) : ''}
      ${!answered ? raw(html`<div class="journey-tools"><button type="button" class="btn ghost" data-help aria-expanded="${!!ui.hint}">${ui.hint ? 'Close help' : 'Help me'}</button><button type="button" class="btn ghost" data-reveal>Show answer</button><button type="button" class="btn ghost" data-skip>Skip · save for later</button></div>${question.say ? raw(html`<button type="button" class="journey-listen" data-answer-audio>${raw(icon('speaker', { size: 17 }))} ${question.meta?.audioIsPrompt ? 'Listen to the question' : 'Hear the form'}</button>`) : ''}`) : ''}`;
  }
  function summaryHTML(complete) {
    const progress = journeyProgress(plan, session, store.learning);
    if(progress.wordShort) {
      const pending=progress.pending.length,next=recommend(store,{kind:'word'});
      return html`<section class="journey-recap"><div class="journey-recap-mark" aria-hidden="true">${raw(icon(pending?'book':'check',{size:30}))}</div><div class="journey-kicker">Your word lesson</div>
        <h1 data-focus tabindex="-1">${pending?'Saved for another try':`${nameOf(entry)} · complete`}</h1>
        <p>${pending?'Your place is saved. Practise the remaining questions when you’re ready.':'You’ve learned its meaning and practised recognising it. We’ll bring it back to help it stick.'}</p>
        ${pending?raw(primary('Practise remaining questions','data-retry')):next&&next.entry.id!==entry.id?raw(html`<a class="btn primary journey-primary" href="${practiceHref(next.entry)}">Learn ${nameOf(next.entry)}</a>`):raw('<a class="btn primary journey-primary" href="#/learn">Keep learning</a>')}
        <a class="btn ghost" href="#/words">Back to Words</a></section>`;
    }
    const summaries = progress.chapters || [];
    const pending = complete ? summaries.filter(c=>!c.optional).flatMap(c=>c.pending) : summaries.find(c=>c.id===step.chapter?.id)?.pending || [];
    if(entry.kind==='verb' && mode==='lesson') {
      const cases=journeyCaseProgress(plan,store.learning,session);
      const pending=summaries.find(c=>c.id===step.chapter?.id)?.pending||[];
      const at=cases.cases.findIndex(c=>c.id===step.chapter?.id);
      const next=cases.cases.slice(at+1).find(c=>c.available!==false&&!c.ready)
        || cases.cases.find(c=>c.id!==step.chapter?.id&&c.available!==false&&!c.ready);
      const title=step.chapter?.title||'This tense';
      return html`<section class="journey-recap"><div class="journey-recap-mark" aria-hidden="true">${raw(icon(pending.length?'book':'check',{size:30}))}</div><div class="journey-kicker">${cases.complete?'Your verb is complete':'Your pace, your next step'}</div>
        <h1 data-focus tabindex="-1">${pending.length?`${title} · a little more practice`:`${title} · complete`}</h1>
        <p>${pending.length?'Your work is saved. Practise the remaining forms now, or return whenever you’re ready.':cases.complete?`You’ve completed the core lessons for ${nameOf(entry)}. You can revisit any of them or try a mixed review.`:'You’ve learned and practised this tense. Continue when you’re ready, or come back another time.'}</p>
        ${pending.length?raw(primary('Practise remaining forms','data-retry')):''}
        ${next?raw(primary(`Next: ${next.title}`,`data-next-lesson="${next.id}"`)):''}
        <button type="button" class="btn ${next||pending.length?'ghost':'primary journey-primary'}" data-overview>Back to ${nameOf(entry)}</button>
        ${cases.complete?raw('<button type="button" class="btn ghost" data-open-lesson="mixed">Mix your tenses</button>'):''}
      </section>`;
    }
    const optional = plan.chapters.filter(c => c.optional);
    const next = recommend(store, { kind: entry.kind });
    return html`<section class="journey-recap"><div class="journey-recap-mark" aria-hidden="true">${raw(icon(pending.length?'book':'check',{size:30}))}</div><div class="journey-kicker">${complete?'Your lesson':'Chapter recap'}</div><h1 data-focus tabindex="-1">${complete ? 'A little more Italian.' : `Your progress · ${step.chapter?.title || 'this chapter'}`}</h1>
      <p>${pending.length ? 'A few parts could use another try. Keep practising, or save them for later and move on.' : complete ? 'You’ve worked through this lesson. We’ll bring these forms back as you keep learning.' : 'You’ve learned the forms and used them in practice. They’ll return as you continue.'}</p>
      ${!complete && pending.length ? raw(primary('Practise these forms', 'data-retry')) : ''}
      ${!complete ? raw(primary(pending.length ? 'Continue with these forms saved for later' : mode === 'review' ? 'Finish this review' : 'Continue to the next part')) : next && next.entry.id !== entry.id ? raw(html`<a class="btn primary journey-primary" href="${practiceHref(next.entry)}">Learn ${nameOf(next.entry)}</a>`) : raw('<a class="btn primary journey-primary" href="#/learn">Keep learning</a>')}
      ${complete && optional.length ? raw(html`<section class="journey-extras"><h2>Explore more</h2><p>When you’re ready, add these forms to this verb.</p>${raw(optional.map(c=>html`<button type="button" class="btn secondary" data-chapter="${c.id}">${c.title}</button>`).join(''))}</section>`) : ''}
      <button type="button" class="btn ghost" data-map aria-expanded="${!!ui.mapOpen}" aria-controls="journey-recap-map">Choose a chapter</button>
      ${ui.mapOpen?raw(html`<nav id="journey-recap-map" class="journey-map" aria-label="Lesson chapters">${raw(plan.chapters.map(c=>html`<button type="button" data-chapter="${c.id}" aria-current="${step.chapter?.id===c.id?'step':'false'}">${c.title}${c.optional?raw('<small>Explore more</small>'):''}</button>`).join(''))}</nav>`):''}
      <a class="btn ghost" href="#/review">Review another day</a></section>`;
  }
  function draw(focus = false) {
    if (disposed || store.current.id !== owner) return;
    const contentScroll = focus ? 0 : root.querySelector('.journey-main')?.scrollTop || 0;
    closeTable({restoreFocus:false});
    prepare();
    const overview=!!ui.overview;
    const past=!overview&&reviewingHistory()?ui.history[ui.historyCursor]:null;
    const displayStep=past?historyStep(past):step;
    const displayQuestion=past&&past.type==='question'?snapshotQuestion(displayStep):past?null:question;
    const paused = !!ui.paused;
    if(tableButton)tableButton.hidden=paused;
    const feedback = displayStep.type === 'question' && displayStep.awaitingContinue;
    const phase = overview ? 'overview' : paused ? 'paused' : feedback ? 'feedback' : displayStep.type;
    const stepKey = [past?`history-${ui.historyCursor}`:'current',phase,displayStep.chapter?.id,displayStep.group?.id,displayStep.card?.id,displayStep.questionId,session.journey?.cardIndex].join('|');
    const enter = stepKey !== renderedStep; renderedStep = stepKey; fragmentIndex = 0;
    const palettes={meet:['#f2c14e','#38bdf8','#34d399'],present:['#34d399','#38bdf8','#f2c14e'],past:['#e0673f','#f2c14e','#a78bfa'],future:['#38bdf8','#a78bfa','#34d399'],background:['#a78bfa','#38bdf8','#f2c14e']};
    const scene = phase==='repair'||phase==='feedback'&&!(past?past.result:ui.result)?.ok?['#e0673f','#f2c14e','#38bdf8']:palettes[displayStep.chapter?.id]||['#38bdf8','#f2c14e','#a3b86c'];
    if (renderedScene!==scene.join('|')) {setScene(scene,{level:entry.level||'A1'});renderedScene=scene.join('|');}
    const progress = journeyProgress(plan,session,store.learning);
    const answerIsName = displayQuestion?.answer?.some(a => normalize(a) === normalize(nameOf(entry)));
    const hideName = !overview && displayStep.type === 'question' && (entry.kind === 'word' || !feedback && answerIsName);
    setTitle(hideName ? entry.kind === 'verb' ? 'Verb lesson' : 'Word lesson' : `${nameOf(entry)} · lesson`);
    const stage = phaseName(displayStep);
    const floatingActions = !overview && !paused && !past && ['teach','repair'].includes(step.type);
    const cases=entry.kind==='verb'?journeyCaseProgress(plan,store.learning,session):null;
    if (!past && mode === 'lesson' && (cases?cases.complete:step.type==='complete'&&progress.complete) && !store.isLearned(entry.id)) store.markLearned(entry.id,entry.kind);
    let content;
    if(overview) {
      const intro=plan.chapters.find(c=>c.id==='meet')?.groups.flatMap(g=>g.cards||[]).find(c=>c.id==='meaning');
      for(const chapter of plan.chapters.filter(c=>!c.optional))revealTeaching(intro?{...intro,notes:[],examples:[],exposureForms:[]}:null,chapter);
      content=lessonOverviewHTML({entry,plan,progress:cases,session});
    }
    else if (paused) content = html`<h1 data-focus tabindex="-1">Your place is saved</h1><p>Come back to this question whenever you’re ready.</p>${raw(primary('Resume lesson', 'data-resume'))}${entry.kind==='verb'&&mode==='lesson'?raw('<button type="button" class="btn ghost" data-overview>Back to your verb</button>'):''}<a class="btn ghost" href="#/learn">Back to Learn</a>`;
    else if(past)content=historyHTML(past);
    else if (step.type === 'teach') {
      revealTeaching(step.card);
      content = cardHTML(step.card);
    } else if (step.type === 'question') content = exerciseHTML();
    else if (step.type === 'repair') content = repairHTML();
    else if (step.type === 'recap' || step.type === 'complete') content = summaryHTML(step.type === 'complete');
    else if (step.type === 'unavailable') content = html`<h1 data-focus tabindex="-1">This saved lesson cannot open yet</h1><p>Its saved progress is preserved. Reload the app to check for an update, or return to your other lessons.</p><a class="btn primary" href="#/learn">Back to Learn</a>`;
    else content = html`<h1 data-focus tabindex="-1">Save this part for later</h1><p>We need another useful example before checking this part again. Your practice so far is saved.</p>${raw(primary('Continue with this part saved', 'data-skip'))}<a class="btn ghost" href="#/reference/${encodeURIComponent(entry.id)}">Read the available examples</a>`;
    const lessonHeader=overview?html`<header class="journey-header is-overview"><div class="journey-overview-top"><span class="journey-kicker">Choose your next step</span><a href="#/learn">All lessons ${raw(icon('chevronRight',{size:16}))}</a></div></header>`:html`<header class="journey-header"><div class="journey-top"><div class="journey-history-controls"><button type="button" data-lesson-back aria-label="Previous lesson page" ${paused||!ui.history.length||past&&ui.historyCursor===0?raw('disabled'):''}>${raw(icon('chevron',{size:16}))}<span>Back</span></button></div>
      <span class="journey-location">${progress.wordShort?'Word lesson':displayStep.chapter?.title||'Lesson recap'}</span>
      <button type="button" class="btn ghost" data-pause ${paused ? raw('hidden') : ''}>Pause</button></div>
      ${past?raw(html`<div class="journey-history-controls"><button type="button" data-lesson-forward aria-label="Next lesson page">Forward ${raw(icon('chevronRight',{size:16}))}</button><button type="button" data-lesson-current>Current lesson</button></div>`):''}
      ${raw(progressHTML(progress,stage,displayStep))}</header>`;
    root.innerHTML = html`<div class="journey-page ${floatingActions?'has-action-dock':''}" data-journey data-history="${!!past}" data-phase="${phase}" data-chapter="${overview?'overview':displayStep.chapter?.id || ''}" data-group="${displayStep.group?.id || ''}" data-target="${displayStep.target?.id || ''}">
      ${raw(lessonHeader)}
      <main class="journey-main ${enter&&!reducedMotion()?'journey-enter':''}" tabindex="0" aria-label="Lesson content">${legacy && !prior && !ui.legacyDismissed ? raw(html`<aside class="journey-legacy"><p>Your previous practice is saved.</p><a href="${practiceHref(entry, null, mode)}${mode === 'lesson' ? '?' : '&'}legacy=1&session=${encodeURIComponent(legacy.id)}">Resume your previous question</a><button type="button" data-dismiss-legacy aria-label="Dismiss saved question notice">×</button></aside>`) : ''}${raw(content)}</main>
      ${feedback&&!past&&!paused?raw(html`<div class="journey-feedback-dock">${raw(feedbackHTML(ui.result,question,ui.given,{showNext:true}))}</div>`):''}
    </div>
    ${floatingActions?raw(actionsHTML(step.type==='teach')):''}`;
    if (displayQuestion?.type==='letters') {
      const activity=past?past.activity:ui.activity;
      const typed=letterAnswer({...displayQuestion,id:displayStep.questionId},activity).trim();
      for(const blank of root.querySelectorAll('.journey-prompt .blank')) {
        if (typed) blank.textContent=typed;
        blank.classList.toggle('is-building',!!typed);
      }
    }
    words.decorate();
    root.querySelector('.journey-overview-meaning')?.addEventListener('toggle',event=>{
      if(event.target.open) {
        const intro=plan.chapters.find(c=>c.id==='meet')?.groups.flatMap(g=>g.cards||[]).find(c=>c.id==='meaning');
        for(const chapter of plan.chapters.filter(c=>!c.optional))revealTeaching(intro,chapter);
        save();
      }
      updateScrollCue();
    });
    root.querySelector('.journey-main').scrollTop = past&&focus?past.scrollTop:contentScroll;
    requestAnimationFrame(updateScrollCue);
    for (const track of root.querySelectorAll('[data-form-track]')) updateFormDeck(track);
    if (focus) requestAnimationFrame(() => root.querySelector('[data-focus]')?.focus({ preventScroll: true }));
    save();
    // A saved final tile may precede the aggregate event if the app closes.
    // Stable attempt IDs make resuming completion safe without replaying audio.
    if (!overview && !paused && !past && !submitting && step.type==='question' && !step.awaitingContinue
      && ['letters','pairs'].includes(question?.type)) {
      const activity=activityState({...question,id:step.questionId},ui.activity);
      if (activity.submitted || activity.complete) queueMicrotask(()=>submit(question.type==='letters'
        ? letterAnswer({...question,id:step.questionId},ui.activity) : question.answer[0],false,{silent:true}));
    }
  }
  async function submit(given, revealed = false, { silent = false } = {}) {
    if (submitting || ui.paused || ui.overview || reviewingHistory() || tableDropdown || step.type !== 'question' || step.awaitingContinue || !question || store.current.id !== owner) return;
    if (!revealed && !String(given || '').trim()) return;
    submitting = true;
    try {
      if(!silent)stopSpeech(); document.activeElement?.blur?.();
      const result = gradeQuestion(question, given, { revealed, assistance: ui.assistance, accentStrict: store.settings.accentStrict });
      ui.given = String(given || '').slice(0,500); ui.draft = ui.given;
      const event = journeyAttempt(plan, session, question, result, { assistance: [...ui.assistance, ...(revealed ? ['reveal'] : [])], now: Date.now() });
      if (!event) return;
      const recorded = store.recordLearningAttempt(event);
      session = recordJourneyAttempt(plan, session, recorded.event || event, { ...recorded, ...result });
      ui.result = { ok: result.ok, outcome: result.outcome, feedback: result.feedback, accentIssue: result.accentIssue, errorTags: result.errorTags || [], components: result.components || [] };
      expose(question.answer);
      if(revealed)for(const pair of question.pairs||[])expose(pair.answers);
      expose(question.meta?.feedbackExposureForms);
      for (const c of question.choices || []) expose(c.value ?? c.label);
      save(); draw();
      if (!silent && result.ok && recorded.added !== false && !step.target?.supplementalOnly) {
        const unaccented = value => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        const answer = question.meta?.answerLanguage === 'en' ? nameOf(entry)
          : question.answer.find(a=>unaccented(a)===unaccented(given)) || question.answer[0];
        speak(answer);
      }
    } finally { submitting = false; }
  }
  function showOverview() {
    if(entry.kind!=='verb'||mode!=='lesson')return;
    if(!ui.overview)capturePage();
    if(step.type==='question'&&!step.awaitingContinue&&!ui.assistance.includes('visible-form'))ui.assistance.push('visible-form');
    saveCaseDraft();
    ui.overview=true;ui.paused=false;ui.mapOpen=false;ui.historyCursor=null;
    stopSpeech();updateRoute();save();draw(true);
  }
  function saveCaseDraft() {
    if(!step.chapter)return;
    ui.caseDrafts[step.chapter.id]={questionId:ui.questionId,draft:ui.draft,given:ui.given,result:safeResult(ui.result),
      activity:ui.activity?clone(ui.activity):null,assistance:[...ui.assistance],hint:!!ui.hint,forms:!!ui.forms,
      scrollTop:ui.overview?ui.caseDrafts[step.chapter.id]?.scrollTop||0:root.querySelector('.journey-main')?.scrollTop||0};
  }
  function restoreCaseDraft(chapterId,redo) {
    const draft=!redo&&ui.caseDrafts[chapterId];
    ui.questionId=typeof draft?.questionId==='string'?draft.questionId.slice(0,300):null;
    ui.draft=typeof draft?.draft==='string'?draft.draft.slice(0,500):'';
    ui.given=typeof draft?.given==='string'?draft.given.slice(0,500):'';
    ui.result=safeResult(draft?.result);
    ui.activity=draft?.activity&&JSON.stringify(draft.activity).length<20000?clone(draft.activity):null;
    ui.assistance=Array.isArray(draft?.assistance)?draft.assistance.filter(x=>['hint','visible-form','answer-audio','reveal'].includes(x)):[];
    ui.hint=!!draft?.hint;ui.forms=!!draft?.forms;
    return Number.isFinite(draft?.scrollTop)?Math.max(0,Math.min(draft.scrollTop,100000)):0;
  }
  function openLesson(chapterId,{redo=false}={}) {
    if(!plan.chapters.some(chapter=>chapter.id===chapterId))return;
    const resume=step.chapter?.id===chapterId&&!['recap','complete'].includes(step.type)&&!redo;
    let contentScroll=resume?ui.caseDrafts[chapterId]?.scrollTop||0:0;
    if(!resume) {
      if(!ui.overview)capturePage();
      saveCaseDraft();save();
      session=chooseJourneyChapter(plan,session,chapterId,{now:Date.now(),learning:store.learning,redo});
      contentScroll=restoreCaseDraft(chapterId,redo);
      recoveredQuestionId=null;
    }
    ui.overview=false;ui.paused=false;ui.mapOpen=false;ui.historyCursor=null;
    stopSpeech();updateRoute();save();draw(true);
    root.querySelector('.journey-main').scrollTop=contentScroll;
  }
  const click = ev => {
    const b = ev.target.closest('button'); if (!b || b.disabled || !root.contains(b)) return;
    if(b.hasAttribute('data-overview')) {showOverview();return;}
    if(b.hasAttribute('data-resume-lesson')) {openLesson(step.chapter?.id);return;}
    if(b.hasAttribute('data-open-lesson')) {openLesson(b.dataset.openLesson);return;}
    if(b.hasAttribute('data-redo-lesson')) {openLesson(b.dataset.redoLesson,{redo:true});return;}
    if(b.hasAttribute('data-next-lesson')) {openLesson(b.dataset.nextLesson);return;}
    if (b.hasAttribute('data-lesson-back')) {browseHistory(reviewingHistory()?ui.historyCursor-1:ui.history.length-1);return;}
    if (b.hasAttribute('data-lesson-forward')) {if(ui.historyCursor>=ui.history.length-1)resumeCurrent();else browseHistory(ui.historyCursor+1);return;}
    if (b.hasAttribute('data-lesson-current')) {resumeCurrent();return;}
    if (b.hasAttribute('data-form-card')) {const track=b.closest('[data-form-track]');moveForm(track,Number(b.dataset.formCard));speak(b.dataset.formSay,{force:true});return;}
    if (b.hasAttribute('data-translation-toggle')) {const example=b.closest('.journey-example'),translation=example.querySelector('[data-translation]'),shown=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(shown));b.textContent=shown?'Hide translation':'Show translation';translation.hidden=!shown;translationVisibility.set(example.dataset.exampleKey,shown);updateScrollCue();return;}
    if (b.hasAttribute('data-say')) {ev.stopPropagation();speak(b.dataset.say,{force:true});return;}
    if (b.hasAttribute('data-pause')) {closeTable({restoreFocus:false});ui.historyCursor=null;ui.paused=true;stopSpeech();save();draw(true);return;}
    if(reviewingHistory())return;
    const activityMove=activityActionFromButton(b);
    if(activityMove && step.type==='question' && !step.awaitingContinue && question && ['letters','pairs'].includes(question.type)) {
      const result=activityAction({...question,id:step.questionId},ui.activity,activityMove);
      if(!result)return;
      if(result.pair) {
        const grade=gradePairActivity(question,{targetId:result.pair.targetId,given:result.pair.given});
        const event=journeyPairAttempt(plan,session,question,grade,{targetId:result.pair.targetId,attempt:result.pair.attempt,now:Date.now()});
        if(!event)return;
        const recorded=store.recordLearningAttempt(event);
        session=recordJourneyPairAttempt(plan,session,recorded.event||event,{...recorded,...grade});
        expose([result.pair.given,result.pair.expected]);
        if(grade.ok&&recorded.added!==false)speak(result.pair.given);
      }
      ui.activity=result.state;save();
      if(result.answer!==undefined) {submit(result.answer);return;}
      if(result.complete) {submit(question.answer[0],false,{silent:true});return;}
      draw();focusActivity(root,result.focus);
      if(result.pair) {
        const panel=root.querySelector('.journey-main'), status=root.querySelector('[data-activity-status]');
        if(panel&&status) {
          const bottom=status.getBoundingClientRect().bottom-panel.getBoundingClientRect().bottom;
          if(bottom>0)panel.scrollTop+=bottom+12;
        }
      }
      return;
    }
    if (b.hasAttribute('data-choice')) { const c=question?.choices?.[Number(b.dataset.choice)]; if(c) submit(c.value ?? c.label); return; }
    if (b.hasAttribute('data-continue')) { capturePage();session=advanceJourney(plan,session,store.learning,{now:Date.now()}); ui.paused=false; save(); draw(true); }
    else if (b.hasAttribute('data-resume')) { ui.paused=false;save();draw(true); }
    else if (b.hasAttribute('data-map')) { ui.mapOpen=!ui.mapOpen;draw(); }
    else if (b.hasAttribute('data-chapter')) { capturePage();session=chooseJourneyChapter(plan,session,b.dataset.chapter,{now:Date.now(),learning:store.learning});ui.mapOpen=false;ui.paused=false;ui.questionId=null;save();draw(true); }
    else if (b.hasAttribute('data-skip')) { capturePage();session=skipJourneyTarget(plan,session,step.target?.id,{now:Date.now(),learning:store.learning});save();draw(true); }
    else if (b.hasAttribute('data-retry')) { capturePage();session=retryJourneyPending(plan,session,store.learning,{now:Date.now()});save();draw(true); }
    else if (b.hasAttribute('data-help')) { ui.hint=!ui.hint;if(ui.hint&&!ui.assistance.includes('hint'))ui.assistance.push('hint');save();draw(); }
    else if (b.hasAttribute('data-show-forms')) { ui.forms=true;if(!ui.assistance.includes('visible-form'))ui.assistance.push('visible-form');for(const c of step.group?.cards||[])revealTeaching(c);save();draw(); }
    else if (b.hasAttribute('data-reveal')) submit('',true);
    else if (b.hasAttribute('data-answer-audio')) { if(!question.meta?.audioIsPrompt&&!ui.assistance.includes('answer-audio'))ui.assistance.push('answer-audio');save();speak(question.say,{force:true}); }
    else if (b.hasAttribute('data-dismiss-legacy')) { ui.legacyDismissed=true;draw(); }
    else if (b.hasAttribute('data-letter')) { const input=root.querySelector('[data-answer]');if(!input)return;const at=input.selectionStart??input.value.length;const end=input.selectionEnd??at;input.value=input.value.slice(0,at)+b.dataset.letter+input.value.slice(end);ui.draft=input.value;input.focus();input.setSelectionRange(at+1,at+1);root.querySelector('[data-check]').disabled=!input.value.trim();save(); }
  };
  const input = ev => { if(!reviewingHistory()&&ev.target.matches('[data-answer]')) {ui.draft=ev.target.value.slice(0,500);const b=root.querySelector('[data-check]');if(b)b.disabled=!ui.draft.trim();save();} };
  const form = ev => { if(ev.target.matches('[data-answer-form]')) {ev.preventDefault();submit(ui.draft);} };
  const scroll = ev => { if(ev.target.matches?.('.journey-main'))updateScrollCue(); if (ev.target.matches?.('[data-action-track]')) updateActions(); };
  const keydown = ev => {
    const track=ev.target.closest?.('[data-form-track]');
    if(track&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(ev.key)){ev.preventDefault();const current=Number(ev.target.closest('[data-form-card]')?.dataset.formCard??formIndex(track));const next=ev.key==='Home'?0:ev.key==='End'?track.children.length-1:current+(['ArrowRight','ArrowDown'].includes(ev.key)?1:-1);moveForm(track,next,{focus:true});return;}
    if(ev.target.closest?.('[data-action-track]')&&['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){ev.preventDefault();moveAction(ev.key==='ArrowRight'?1:-1,{focus:true,edge:ev.key==='Home'?'first':ev.key==='End'?'last':null});return;}
    const examples=ev.target.closest?.('.journey-example-deck');
    if(examples&&['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){ev.preventDefault();moveExample(examples,ev.key);}
  };
  root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('submit',form);root.addEventListener('scroll',scroll,true);root.addEventListener('keydown',keydown);
  draw();
  return () => { words.destroy();closeTable({restoreFocus:false});tableButton?.removeEventListener('click',toggleTable);tableButton?.remove();save();disposed=true;stopSpeech();document.body.classList.remove('journey-viewport','journey-compact','journey-has-reference');document.body.style.removeProperty('--journey-viewport-height');window.visualViewport?.removeEventListener('resize',fitViewport);window.visualViewport?.removeEventListener('scroll',fitViewport);window.removeEventListener('resize',fitViewport);window.removeEventListener('pageshow',fitViewport);window.removeEventListener('orientationchange',fitViewport);document.removeEventListener('focusin',fitViewport);document.removeEventListener('focusout',fitViewport);root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('submit',form);root.removeEventListener('scroll',scroll,true);root.removeEventListener('keydown',keydown); };
}
