// Taught, resumable lessons. Sequencing and learning evidence live in journey.js;
// this view persists only the current input, assistance and presentation state.
import { html, raw, icon, speak, stopSpeech } from '../ui.js';
import { setScene, reducedMotion } from '../fx.js';
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
import { gradeQuestion } from '../learning/diagnose.js';
import { createJourneySession, currentJourneyStep, advanceJourney, recordJourneyAttempt,
  skipJourneyTarget, chooseJourneyChapter, journeyProgress, journeyAttempt, retryJourneyPending } from '../learning/journey.js';
import { recommendLesson as recommend, practiceHref } from '../learning/integration.js';

const uid = () => globalThis.crypto?.randomUUID?.() || `journey-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = x => JSON.parse(JSON.stringify(x));
const normalize = x => String(x || '').normalize('NFC').trim().toLocaleLowerCase('it').replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const nameOf = e => e.inf || e.it;
const texts = x => Array.isArray(x) ? x : x ? [x] : [];
const phaseName = step => ['teach','repair'].includes(step.type) ? 'Learn'
  : step.type === 'question' ? step.phase === 'independent' ? 'Recall' : 'Practise' : null;

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
  // Older releases saved an empty introduction recap. Resume at the next real
  // teaching card without pretending that the introduction included practice.
  if (session.journey?.phase === 'recap' && session.journey.chapterId === 'meet'
    && !plan.chapters.find(c=>c.id==='meet')?.groups.some(g=>g.targets?.some(t=>t.available!==false)))
    session = advanceJourney(plan, session, store.learning, { now: Date.now() });
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
  ui.formDecks = ui.formDecks && typeof ui.formDecks === 'object' && !Array.isArray(ui.formDecks)
    ? Object.fromEntries(Object.entries(ui.formDecks).filter(([key,value])=>!['__proto__','prototype','constructor'].includes(key)&&Number.isInteger(value)&&value>=0)) : {};
  // History stores bounded presentation descriptors, never HTML or a copy of the
  // learning state. Reconstruct every page from the current trusted lesson plan.
  const historyStep = snapshot => {
    const chapter = plan.chapters.find(c=>c.id===snapshot?.chapterId);
    const group = chapter?.groups.find(g=>g.id===snapshot.groupId);
    const card = group?.cards?.find(c=>c.id===snapshot.cardId);
    const target = chapter?.groups.flatMap(g=>g.targets||[]).find(t=>t.id===snapshot.targetId);
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
    for (const key of ['chapterId','groupId','cardId','targetId','questionId','repairTag']) snapshot[key]=typeof source[key]==='string'?source[key].slice(0,300):'';
    snapshot.variant=Number.isInteger(source.variant)&&source.variant>=0&&source.variant<1000000?source.variant:0;
    snapshot.phase=['guided','independent','repair'].includes(source.phase)?source.phase:'guided';
    snapshot.format=['choice','type','match'].includes(source.format)?source.format:'type';
    snapshot.given=typeof source.given==='string'?source.given.slice(0,500):'';
    snapshot.result=safeResult(source.result);
    snapshot.awaitingContinue=source.awaitingContinue===true;
    snapshot.helpSuggested=source.helpSuggested===true;
    snapshot.pendingCount=Number.isInteger(source.pendingCount)&&source.pendingCount>=0?Math.min(source.pendingCount,10000):0;
    snapshot.scrollTop=Number.isFinite(source.scrollTop)&&source.scrollTop>=0?Math.min(source.scrollTop,100000):0;
    snapshot.index=Number.isInteger(source.index)&&source.index>=0?source.index:0;
    const restored=historyStep(snapshot);
    if(!restored.chapter || source.type==='teach'&&!restored.card || ['question','repair'].includes(source.type)&&!restored.target)return null;
    return snapshot;
  };
  ui.history=Array.isArray(ui.history)?ui.history.slice(-40).map(safeSnapshot).filter(Boolean):[];
  ui.historyCursor=Number.isInteger(ui.historyCursor)&&ui.historyCursor>=0&&ui.historyCursor<ui.history.length?ui.historyCursor:null;
  ui.historyReturnScroll=Number.isFinite(ui.historyReturnScroll)&&ui.historyReturnScroll>=0?Math.min(ui.historyReturnScroll,100000):0;
  const translationVisibility = new Map(), formIntent = new Map();
  let renderedStep = '', renderedScene = '', fragmentIndex = 0;
  let disposed = false, submitting = false, question = null;
  let tableTense = null, tableReturnFocus = null;
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
  document.body.classList.add('journey-viewport');
  window.scrollTo(0,0);
  const fitViewport = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.body.style.setProperty('--journey-viewport-height',`${height}px`);
    document.body.classList.toggle('journey-compact',height<600);
    const panel = root.querySelector('.journey-main'), input = document.activeElement;
    if (panel && input?.matches('[data-answer]')) {
      const bottom = input.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
      if (bottom > 0) panel.scrollTop += bottom + 16;
    }
  };
  fitViewport();
  window.visualViewport?.addEventListener('resize',fitViewport);
  window.addEventListener('resize',fitViewport);

  const words = createSentencePanel(root, {
    context(sentence) {
      const shown = reviewingHistory() ? historyStep(ui.history[ui.historyCursor]) : step;
      const q = reviewingHistory() ? snapshotQuestion(shown) : question;
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
  function formDeckHTML(forms = [], key = '') {
    if (!forms.length) return '';
    const active = Math.min(forms.length-1, ui.formDecks[key] || 0);
    return html`<section class="journey-form-deck" aria-label="Explore the forms">
      <div class="journey-form-track" data-form-track data-form-key="${key}" tabindex="0" aria-label="Verb or word forms. Swipe, or use the previous and next buttons.">
        ${raw(forms.map((row,i)=>html`<button type="button" class="journey-form-card ${i===active?'is-active':''}" data-form-card="${i}" data-form-say="${row.form}" aria-pressed="${i===active}" aria-label="Listen to ${row.label}: ${row.form}">
          <span class="journey-form-person">${row.label}</span>
          <span class="journey-form-value" lang="it">${row.form}</span><span class="journey-form-footer">${row.gloss?raw(html`<span class="journey-form-gloss">${row.gloss}</span>`):''}<span class="journey-form-sound" aria-hidden="true">${raw(icon('speaker',{size:19}))}<span>Listen</span></span></span>
        </button>`).join(''))}
      </div>
      <div class="journey-deck-navigation"><button type="button" data-form-prev aria-label="Previous form" ${active===0?raw('disabled'):''}>${raw(icon('chevron',{size:19}))}</button>
        <span class="journey-deck-counter" data-form-count aria-live="polite" aria-atomic="true">${active+1} / ${forms.length}</span>
        <button type="button" data-form-next aria-label="Next form" ${active===forms.length-1?raw('disabled'):''}>${raw(icon('chevronRight',{size:19}))}</button></div>
      <details class="journey-form-comparison journey-form-overview"><summary>${raw(icon('list',{size:16}))} See forms together</summary>${raw(formsHTML(forms))}</details>
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
    const cards = [...track.querySelectorAll('[data-form-card]')];
    if (!cards.length) return 0;
    if(formIntent.has(track.dataset.formKey))return Math.min(cards.length-1,formIntent.get(track.dataset.formKey));
    const origin = cards[0].offsetLeft;
    return cards.reduce((best,card,i)=>Math.abs(card.offsetLeft-origin-track.scrollLeft)<Math.abs(cards[best].offsetLeft-origin-track.scrollLeft)?i:best,0);
  }
  function updateFormDeck(track, { persist = true } = {}) {
    const cards = [...track.querySelectorAll('[data-form-card]')], deck = track.closest('.journey-form-deck');
    if (!deck || !cards.length) return;
    const active = formIndex(track), key = track.dataset.formKey;
    cards.forEach((card,i)=>{card.classList.toggle('is-active',i===active);card.setAttribute('aria-pressed',String(i===active));});
    deck.querySelector('[data-form-count]').textContent = `${active+1} / ${cards.length}`;
    deck.querySelector('[data-form-prev]').disabled = active===0;
    deck.querySelector('[data-form-next]').disabled = active===cards.length-1;
    if (persist && ui.formDecks[key] !== active) { ui.formDecks[key]=active; save(); }
  }
  function moveForm(track, index, { focus = false } = {}) {
    const cards = [...track.querySelectorAll('[data-form-card]')];
    const next = Math.max(0,Math.min(cards.length-1,index)), card = cards[next]; if (!card) return;
    ui.formDecks[track.dataset.formKey] = next;formIntent.set(track.dataset.formKey,next);
    track.scrollTo({left:card.offsetLeft-cards[0].offsetLeft,behavior:reducedMotion()?'instant':'smooth'});
    if (focus) card.focus({preventScroll:true});
    cards.forEach((button,i)=>{button.classList.toggle('is-active',i===next);button.setAttribute('aria-pressed',String(i===next));});
    const deck = track.closest('.journey-form-deck');
    deck.querySelector('[data-form-count]').textContent = `${next+1} / ${cards.length}`;
    deck.querySelector('[data-form-prev]').disabled = next===0;deck.querySelector('[data-form-next]').disabled = next===cards.length-1;
    save();
  }
  function chapterRailHTML(progress, displayStep = step) {
    const chapters = progress.chapters.filter(c=>!c.optional);
    return html`<ol class="journey-chapter-rail" aria-label="Lesson chapters">${raw(chapters.map((chapter,i)=>{
      const current=chapter.id===displayStep.chapter?.id;
      const label={meet:'Meet',meaning:'Meaning',present:'Present',past:'Past',future:'Future',mixed:'Use it',forms:'Forms',use:'Use it'}[chapter.id]||chapter.title;
      const status=chapter.complete?(chapter.id==='meet'?'introduced':'practised'):chapter.covered?'visited; more practice remains':current?'current chapter':'not yet visited';
      return html`<li class="journey-chapter-segment ${current?'is-current':''} ${chapter.covered?'is-covered':''} ${chapter.complete?'is-complete':''}" aria-label="${chapter.title}: ${status}" ${current?raw('aria-current="step"'):''}><span class="journey-chapter-mark" aria-hidden="true">${chapter.complete?raw(icon('check',{size:12})):i+1}</span><span class="journey-chapter-label">${label}</span></li>`;
    }).join(''))}</ol>`;
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
    const pending = step.type==='complete' ? progress.chapters.filter(c=>!c.optional).flatMap(c=>c.pending)
      : progress.chapters.find(c=>c.id===step.chapter?.id)?.pending || [];
    const snapshot = safeSnapshot({version:1,entryId:entry.id,contentVersion:plan.version,
      type:step.type,chapterId:step.chapter?.id,groupId:step.group?.id,cardId:step.card?.id,targetId:step.target?.id,
      phase:step.phase,questionId:step.questionId,variant:step.type==='repair'?session.journey.lastAttempt?.variant:step.variant,
      format:step.format,repairTag:step.repairTag,awaitingContinue:step.awaitingContinue,helpSuggested:step.helpSuggested,
      given:ui.given||ui.draft,result:ui.result,pendingCount:pending.length,index:session.index||0,
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
      const cardId=['auxiliary','auxiliaryPerson'].includes(past.repairTag)?'auxiliary':['participle','agreement'].includes(past.repairTag)&&entry.kind==='verb'?'participle':null;
      revealTeaching(cards.find(c=>c.id===cardId)||past.card||past.group?.cards?.[0],past.chapter);
      if(past.helpSuggested)expose(snapshotQuestion({...past,phase:'independent',format:'type'})?.answer);
    } else if(past.type==='question'){
      const q=snapshotQuestion(past);
      expose(q?.meta?.promptExposureForms);
      for(const c of q?.choices||[])expose(c.value??c.label);
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
      content=q?html`<section class="journey-exercise-card"><div class="journey-kicker">${phaseName(past)||'Practise'} · ${past.chapter.title}</div><div class="journey-prompt" data-focus tabindex="-1">${raw(promptHTML(q.prompt))}</div>
        ${q.choices?.length?raw(html`<div class="journey-choices">${raw(q.choices.map((c,i)=>{
          const value=c.value??c.label,chosen=normalize(past.given)===normalize(value),right=(q.answer||[]).some(a=>normalize(a)===normalize(value));
          return html`<button type="button" class="journey-choice ${past.awaitingContinue&&right?'is-correct':past.awaitingContinue&&chosen?'is-wrong':''}" disabled aria-pressed="${chosen}"><span class="journey-choice-marker" aria-hidden="true">${String.fromCharCode(65+i)}</span><span class="journey-choice-label" lang="${q.meta?.answerLanguage==='en'?'en':'it'}">${c.label}</span>${past.awaitingContinue&&(right||chosen)?raw(html`<small>${right?'Correct':'Your answer'}</small>`):''}</button>`;
        }).join(''))}</div>`):raw(html`<p class="journey-given"><span>${past.awaitingContinue?'Your answer':'Your draft'}</span><span lang="${q.meta?.answerLanguage==='en'?'en':'it'}">${past.given||'—'}</span></p>`)}</section>
        ${past.awaitingContinue?raw(feedbackHTML(past.result,q,past.given)):raw('<p class="journey-note">You left this question without submitting an answer.</p>')}`:'<p>This earlier exercise is no longer available.</p>';
    } else if(['recap','complete'].includes(past.type))content=html`<section class="journey-recap"><div class="journey-kicker">Previous recap</div><h1 data-focus tabindex="-1">${past.type==='complete'?'A little more Italian.':`Your progress · ${past.chapter.title}`}</h1><p>${past.pendingCount?'A few parts were saved for more practice.':'You worked through this part of the lesson.'}</p></section>`;
    else content='<h1 data-focus tabindex="-1">This part was saved for later</h1><p>Your practice is preserved in the current lesson.</p>';
    return banner+content;
  }
  function closeTable({restoreFocus=true}={}) {
    const dialog=root.querySelector('.journey-conjugation-panel');
    if(dialog?.open)dialog.close();
    root.querySelector('[data-conjugation-toggle]')?.setAttribute('aria-expanded','false');
    if(restoreFocus&&tableReturnFocus?.isConnected)tableReturnFocus.focus({preventScroll:true});
    tableReturnFocus=null;
  }
  function renderTable() {
    const dialog=root.querySelector('.journey-conjugation-panel');if(!dialog)return;
    const tense=TENSE_BY_KEY[tableTense]?tableTense:'presente',weather=WEATHER_VERBS.has(entry.inf);
    const grammar=conjugate(entry.inf,{aux:entry.aux,isc:entry.isc});
    const rows=Array.from({length:6},(_,person)=>{
      const forms=lessonForms(entry,tense,person);expose(forms);
      const label=weather&&person===2?'impersonal':tense==='imperativo'&&person===2?'Lei':tense==='imperativo'&&person===5?'Loro':['io','tu','lui / lei / Lei','noi','voi','loro'][person];
      const gloss=weather&&person===2?'it · weather':tense==='imperativo'&&person===2?'you · formal':tense==='imperativo'&&person===5?'you · formal plural':['I','you · informal','he / she / you · formal','we','you · plural','they'][person];
      return {label,gloss,form:forms.length?forms.join(' / '):'—'};
    });
    const notes=[];
    if(weather)notes.push('Weather expressions use the impersonal third-person singular.');
    else notes.push('Formal Lei takes the same verb form as lui and lei.');
    if(tense==='imperativo')notes.push('The imperative addresses someone, so it has no io form. Loro is a very formal plural address.');
    if(TENSE_BY_KEY[tense]?.compound){
      if(grammar.auxBoth)notes.push('This verb can use avere or essere, depending on its meaning and construction. Both are shown here.');
      if(grammar.aux==='essere'||grammar.auxBoth)notes.push('With essere, the participle agrees with the subject. With formal Lei, its ending follows the person you address.');
      else notes.push('In these avere forms, the participle stays the same.');
    }
    if(entry.inf==='piacere')notes.push('The thing you like is the subject: mi piace il libro; mi piacciono i libri. The table also includes forms for other subjects.');
    dialog.innerHTML=html`<header class="journey-panel-header"><div><span class="journey-kicker">Verb forms</span><h2 id="journey-conjugation-title">${entry.inf}</h2></div><button type="button" data-conjugation-close aria-label="Close verb forms">${raw(icon('x',{size:22}))}</button></header>
      <div class="journey-conjugation-tabs" role="group" aria-label="Choose a tense">${raw([['presente','Present'],['passatoProssimo','Past'],['futuro','Future']].map(([key,label])=>html`<button type="button" data-conjugation-tense="${key}" aria-pressed="${tense===key}">${label}</button>`).join(''))}</div>
      <section class="journey-conjugation-content" tabindex="0" aria-label="${TENSE_BY_KEY[tense].name} forms"><h3>${TENSE_BY_KEY[tense].name}</h3>${raw(formsHTML(rows))}${raw(notes.map(note=>html`<p>${note}</p>`).join(''))}</section>`;
    save();
  }
  function openTable(button) {
    if(entry.kind!=='verb')return;
    const shown=reviewingHistory()?historyStep(ui.history[ui.historyCursor]):step;
    tableTense=shown.chapter?.tense||'presente';tableReturnFocus=button;
    if(step.type==='question'&&!step.awaitingContinue&&!ui.assistance.includes('visible-form'))ui.assistance.push('visible-form');
    renderTable();
    const dialog=root.querySelector('.journey-conjugation-panel');
    dialog.showModal();button.setAttribute('aria-expanded','true');dialog.querySelector('[data-conjugation-close]')?.focus();
    save();
  }
  function primary(label, attrs = 'data-continue') { return html`<button type="button" class="btn primary journey-primary" ${raw(attrs)}>${label}</button>`; }
  function actionsHTML(learning = true) {
    const actions = [primary(learning ? 'Continue' : 'Try it together'),
      ...(learning && plan.references?.length ? [html`<a class="btn ghost" href="#/reference/${encodeURIComponent(entry.id)}">More meanings and examples</a>`] : []),
      html`<button type="button" class="btn ghost" data-skip>Skip · save for later</button>`];
    return html`<footer class="journey-action-dock" aria-label="Lesson actions">
      <div class="journey-action-track" data-action-track tabindex="0" aria-label="Lesson actions. Swipe left or right for more options.">${raw(actions.join(''))}</div>
      <div class="journey-action-navigation"><button type="button" data-action-prev aria-label="Previous lesson action" disabled>←</button>
        <div class="journey-action-dots" aria-hidden="true">${raw(actions.map((_,i)=>html`<span data-action-dot class="${i===0?'is-current':''}"></span>`).join(''))}</div>
        <button type="button" data-action-next aria-label="Next lesson action">→</button></div>
    </footer>`;
  }
  function updateActions() {
    const track = root.querySelector('[data-action-track]'); if (!track) return;
    const index = Math.round(track.scrollLeft / (track.clientWidth + 14));
    root.querySelectorAll('[data-action-dot]').forEach((dot,i)=>dot.classList.toggle('is-current',i===index));
    root.querySelector('[data-action-prev]').disabled = index === 0;
    root.querySelector('[data-action-next]').disabled = index >= track.children.length-1;
  }
  function moveAction(direction) {
    const track = root.querySelector('[data-action-track]'); if (!track) return;
    const index = Math.round(track.scrollLeft / (track.clientWidth + 14));
    const next = Math.max(0,Math.min(track.children.length-1,index+direction));
    track.scrollTo({left:next*(track.clientWidth+14),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function repairHTML(displayStep = step, snapshot = null) {
    const cards = displayStep.chapter?.groups.flatMap(g => g.cards || []) || [];
    const cardId = ['auxiliary','auxiliaryPerson'].includes(displayStep.repairTag) ? 'auxiliary'
      : ['participle','agreement'].includes(displayStep.repairTag) && entry.kind === 'verb' ? 'participle' : null;
    const card = cards.find(c => c.id === cardId) || displayStep.card || displayStep.group?.cards?.[0];
    const result=snapshot?snapshot.result:ui.result;
    if(!snapshot)revealTeaching(card);
    if (!displayStep.helpSuggested) return html`<h1 data-focus tabindex="-1">Let’s work on this part</h1>${result?.feedback ? raw(html`<p>${result.feedback}</p>`) : ''}${raw(cardHTML(card, { title: false, displayStep }))}`;
    const model = buildJourneyQuestion(entry, displayStep.chapter, displayStep.target, { variant: snapshot?snapshot.variant:session.journey.lastAttempt?.variant || 0, format: 'type', phase: 'independent' });
    if (!model) return cardHTML(card,{displayStep});
    if(!snapshot)expose(model.answer);
    const answer = model.answer[0], compound = model.meta?.diagnostic?.compound;
    const pieces = answer.split(' ');
    const labels = {auxiliary:'auxiliary',participle:'past participle',person:'person',clitic:'pronoun',article:'article',plural:'plural'};
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
  function feedbackHTML(result = ui.result, displayQuestion = question, given = ui.given) {
    if (!result || !displayQuestion) return '';
    const correct = displayQuestion.answer?.[0] || '';
    const explanation = result.ok ? (displayQuestion.context ? (result.accentIssue ? result.feedback : displayQuestion.meta?.role==='formal' ? 'Lei is formal you; it uses the third-person singular.' : '') : displayQuestion.explanation || (result.accentIssue ? result.feedback : '')) : result.feedback;
    return html`<aside class="journey-feedback ${result.ok ? 'is-correct' : ''}" role="status" aria-live="polite" aria-atomic="true">
      <div class="journey-feedback-heading"><span class="journey-feedback-icon" aria-hidden="true">${raw(icon(result.ok?'check':'sparkle',{size:20}))}</span><h2>${result.ok ? 'That’s right.' : result.outcome === 'revealed' ? 'Here’s the answer.' : `Use ${correct}.`}</h2></div>
      ${!displayQuestion.choices?.length ? raw(html`<p class="journey-given"><span>Your answer</span><span lang="it">${given || '—'}</span></p>`) : ''}
      ${!result.ok ? raw(html`<p class="journey-answer" lang="it">${correct}</p>`) : ''}
      ${explanation ? raw(html`<p>${explanation}</p>`) : ''}
      ${displayQuestion.context ? raw(html`<div class="journey-feedback-context"><p lang="it" data-italian-sentence>${displayQuestion.context.it}</p><p class="journey-translation">${displayQuestion.context.en}</p></div>`) : ''}
      ${!result.ok ? raw('<p class="journey-note">We’ll work on this part together, then try another example.</p>') : ''}
    </aside>`;
  }
  function exerciseHTML() {
    if (!question) return html`<h1 data-focus tabindex="-1">Let’s use the reference</h1><p>There isn’t a reliable exercise for this part yet. You can read its examples and continue.</p>${raw(primary('Continue with this part saved', 'data-skip'))}<a class="btn secondary" href="#/reference/${encodeURIComponent(entry.id)}">Examples and forms</a>`;
    const answered = !!step.awaitingContinue;
    const choices = question.choices || [];
    const typed = !choices.length;
    return html`<section class="journey-exercise-card"><div class="journey-kicker">${phaseName(step)||'Practise'} · ${step.chapter?.title||'Your lesson'}</div><div class="journey-prompt" data-focus tabindex="-1">${raw(promptHTML(question.prompt))}</div>
      ${choices.length ? raw(html`<p class="journey-note">${answered ? '' : step.format === 'match' ? 'Tap the matching form.' : 'Tap an answer.'}</p><div class="journey-choices">${raw(choices.map((c,i) => {
        const value = c.value ?? c.label;
        const chosen = normalize(ui.given) === normalize(value);
        const right = (question.answer || []).some(a => normalize(a) === normalize(value)) || c.correct === true;
        return html`<button type="button" data-choice="${i}" class="journey-choice ${answered && right ? 'is-correct' : answered && chosen ? 'is-wrong' : ''}" ${answered ? raw('disabled') : ''} aria-pressed="${chosen}"><span class="journey-choice-marker" aria-hidden="true">${String.fromCharCode(65+i)}</span><span class="journey-choice-label" lang="${question.meta?.answerLanguage==='en'?'en':'it'}">${c.label}</span>${answered && (right || chosen) ? raw(html`<small>${right ? 'Correct' : 'Your answer'}</small>`) : ''}</button>`;
      }).join(''))}</div>`) : raw(html`<form data-answer-form autocomplete="off"><label for="journey-answer">${question.meta?.answerLanguage === 'en' ? 'Your answer in English' : 'Your answer in Italian'}</label><input id="journey-answer" data-answer type="text" value="${ui.draft || ''}" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" ${answered ? raw('readonly') : ''}>
      ${answered ? '' : raw(html`<div class="journey-accents" aria-label="Accented letters">${raw(['à','è','é','ì','ò','ù',"'"].map(c=>html`<button type="button" data-letter="${c}" aria-label="Insert ${c}">${c}</button>`).join(''))}</div><button type="submit" class="btn primary journey-primary" data-check ${ui.draft?.trim() ? '' : raw('disabled')}>Check answer</button>`)}</form>`)}
      </section>${answered ? raw(feedbackHTML()) : ''}
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
    return html`<section class="journey-recap"><div class="journey-recap-mark" aria-hidden="true">${raw(icon(pending.length?'book':'check',{size:30}))}</div><div class="journey-kicker">${complete?'Your lesson':'Chapter recap'}</div><h1 data-focus tabindex="-1">${complete ? 'A little more Italian.' : `Your progress · ${step.chapter?.title || 'this chapter'}`}</h1>
      <p>${pending.length ? 'A few parts could use another try. Keep practising, or save them for later and move on.' : complete ? 'You’ve worked through this lesson. We’ll bring these forms back as you keep learning.' : 'You’ve learned the forms and used them in practice. They’ll return as you continue.'}</p>
      ${!complete && pending.length ? raw(primary('Practise these forms', 'data-retry')) : ''}
      ${!complete ? raw(primary(pending.length ? 'Continue with these forms saved for later' : mode === 'review' ? 'Finish this review' : 'Continue to the next part')) : next && next.entry.id !== entry.id ? raw(html`<a class="btn primary journey-primary" href="${practiceHref(next.entry)}">Learn ${nameOf(next.entry)}</a>`) : raw('<a class="btn primary journey-primary" href="#/learn">Keep learning</a>')}
      ${complete && optional.length ? raw(html`<section class="journey-extras"><h2>Explore more</h2><p>When you’re ready, add these forms to this verb.</p>${raw(optional.map(c=>html`<button type="button" class="btn secondary" data-chapter="${c.id}">${c.title}</button>`).join(''))}</section>`) : ''}
      <button type="button" class="btn ghost" data-map>Choose a chapter</button><a class="btn ghost" href="#/review">Review another day</a></section>`;
  }
  function draw(focus = false) {
    if (disposed || store.current.id !== owner) return;
    const contentScroll = focus ? 0 : root.querySelector('.journey-main')?.scrollTop || 0;
    closeTable({restoreFocus:false});
    prepare();
    const past=reviewingHistory()?ui.history[ui.historyCursor]:null;
    const displayStep=past?historyStep(past):step;
    const displayQuestion=past&&past.type==='question'?snapshotQuestion(displayStep):past?null:question;
    const paused = !!ui.paused;
    const feedback = displayStep.type === 'question' && displayStep.awaitingContinue;
    const phase = paused ? 'paused' : feedback ? 'feedback' : displayStep.type;
    const stepKey = [past?`history-${ui.historyCursor}`:'current',phase,displayStep.chapter?.id,displayStep.group?.id,displayStep.card?.id,displayStep.questionId,session.journey?.cardIndex].join('|');
    const enter = stepKey !== renderedStep; renderedStep = stepKey; fragmentIndex = 0;
    const palettes={meet:['#f2c14e','#38bdf8','#34d399'],present:['#34d399','#38bdf8','#f2c14e'],past:['#e0673f','#f2c14e','#a78bfa'],future:['#38bdf8','#a78bfa','#34d399'],background:['#a78bfa','#38bdf8','#f2c14e']};
    const scene = phase==='repair'||phase==='feedback'&&!(past?past.result:ui.result)?.ok?['#e0673f','#f2c14e','#38bdf8']:palettes[displayStep.chapter?.id]||['#38bdf8','#f2c14e','#a3b86c'];
    if (renderedScene!==scene.join('|')) {setScene(scene,{level:entry.level||'A1'});renderedScene=scene.join('|');}
    const progress = journeyProgress(plan,session,store.learning);
    const answerIsName = displayQuestion?.answer?.some(a => normalize(a) === normalize(nameOf(entry)));
    const hideName = displayStep.type === 'question' && (entry.kind === 'word' || !feedback && answerIsName);
    setTitle(hideName ? entry.kind === 'verb' ? 'Verb lesson' : 'Word lesson' : `${nameOf(entry)} · lesson`);
    const core = plan.chapters.filter(c => !c.optional);
    const idx = core.findIndex(c => c.id === displayStep.chapter?.id);
    const stage = phaseName(displayStep);
    const floatingActions = !paused && !past && ['teach','repair'].includes(step.type);
    if (!past && step.type === 'complete' && mode === 'lesson' && journeyProgress(plan,session,store.learning).complete && !store.isLearned(entry.id)) store.markLearned(entry.id,entry.kind);
    let content;
    if (paused) content = html`<h1 data-focus tabindex="-1">Your place is saved</h1><p>Come back to this question whenever you’re ready.</p>${raw(primary('Resume lesson', 'data-resume'))}<a class="btn ghost" href="#/learn">Back to Learn</a>`;
    else if(past)content=historyHTML(past);
    else if (step.type === 'teach') {
      revealTeaching(step.card);
      content = cardHTML(step.card);
    } else if (step.type === 'question') content = exerciseHTML();
    else if (step.type === 'repair') content = repairHTML();
    else if (step.type === 'recap' || step.type === 'complete') content = summaryHTML(step.type === 'complete');
    else if (step.type === 'unavailable') content = html`<h1 data-focus tabindex="-1">This saved lesson cannot open yet</h1><p>Its saved progress is preserved. Reload the app to check for an update, or return to your other lessons.</p><a class="btn primary" href="#/learn">Back to Learn</a>`;
    else content = html`<h1 data-focus tabindex="-1">Save this part for later</h1><p>We need another useful example before checking this part again. Your practice so far is saved.</p>${raw(primary('Continue with this part saved', 'data-skip'))}<a class="btn ghost" href="#/reference/${encodeURIComponent(entry.id)}">Read the available examples</a>`;
    root.innerHTML = html`<div class="journey-page ${floatingActions?'has-action-dock':''}" data-journey data-history="${!!past}" data-phase="${phase}" data-chapter="${displayStep.chapter?.id || ''}" data-group="${displayStep.group?.id || ''}" data-target="${displayStep.target?.id || ''}">
      <header class="journey-header"><div class="journey-top"><div class="journey-history-controls"><button type="button" data-lesson-back aria-label="Previous lesson page" ${paused||!ui.history.length||past&&ui.historyCursor===0?raw('disabled'):''}>${raw(icon('chevron',{size:16}))}<span>Back</span></button></div>
      <button type="button" class="journey-map-toggle" data-map aria-expanded="${!!ui.mapOpen}" ${past?raw('disabled'):''}><span>${displayStep.chapter?.title || 'Lesson recap'}${idx>=0?raw(html`<small>${idx+1}/${core.length}</small>`):''}</span><span aria-hidden="true">${raw(icon('chevronDown',{size:17}))}</span></button>
      <button type="button" class="btn ghost" data-pause ${paused ? raw('hidden') : ''}>Pause</button></div>
      ${past?raw(html`<div class="journey-history-controls"><button type="button" data-lesson-forward aria-label="Next lesson page">Forward ${raw(icon('chevronRight',{size:16}))}</button><button type="button" data-lesson-current>Current lesson</button></div>`):''}
      ${ui.mapOpen&&!past ? raw(html`<nav class="journey-map" aria-label="Lesson chapters">${raw(plan.chapters.map(c=>html`<button type="button" data-chapter="${c.id}" aria-current="${step.chapter?.id === c.id ? 'step' : 'false'}">${c.title}${c.optional ? raw('<small>Explore more</small>') : ''}</button>`).join(''))}</nav>`) : ''}
      ${raw(chapterRailHTML(progress,displayStep))}
      <ol class="journey-stages" aria-label="Chapter stages">${raw(['Learn','Practise','Recall'].map(label=>html`<li ${label === stage ? raw('aria-current="step"') : ''}>${label}</li>`).join(''))}</ol></header>
      <main class="journey-main ${enter&&!reducedMotion()?'journey-enter':''}" tabindex="0" aria-label="Lesson content">${legacy && !prior && !ui.legacyDismissed ? raw(html`<aside class="journey-legacy"><p>Your previous practice is saved.</p><a href="${practiceHref(entry, null, mode)}${mode === 'lesson' ? '?' : '&'}legacy=1&session=${encodeURIComponent(legacy.id)}">Resume your previous question</a><button type="button" data-dismiss-legacy aria-label="Dismiss saved question notice">×</button></aside>`) : ''}${raw(content)}</main>
      ${floatingActions?raw(actionsHTML(step.type==='teach')):''}
      ${entry.kind==='verb'&&!paused?raw(html`<button type="button" class="journey-table-tab" data-conjugation-toggle aria-label="Open verb forms" aria-expanded="false" aria-controls="journey-conjugation-panel">${raw(icon('chevron',{size:18}))}</button><dialog id="journey-conjugation-panel" class="journey-conjugation-panel" aria-labelledby="journey-conjugation-title"></dialog>`):''}
    </div>`;
    words.decorate();
    root.querySelector('.journey-main').scrollTop = past&&focus?past.scrollTop:contentScroll;
    requestAnimationFrame(updateScrollCue);
    const dialog=root.querySelector('.journey-conjugation-panel');
    if(dialog){
      dialog.addEventListener('cancel',event=>{event.preventDefault();closeTable();});
      dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeTable();});
    }
    for (const track of root.querySelectorAll('[data-form-track]')) {
      const cards=[...track.querySelectorAll('[data-form-card]')], active=Math.min(cards.length-1,ui.formDecks[track.dataset.formKey]||0);
      formIntent.set(track.dataset.formKey,active);
      if (cards[active]) track.scrollLeft=cards[active].offsetLeft-cards[0].offsetLeft;
      updateFormDeck(track,{persist:false});
    }
    if (focus) requestAnimationFrame(() => root.querySelector('[data-focus]')?.focus({ preventScroll: true }));
    save();
  }
  async function submit(given, revealed = false) {
    if (submitting || ui.paused || reviewingHistory() || root.querySelector('.journey-conjugation-panel')?.open || step.type !== 'question' || step.awaitingContinue || !question || store.current.id !== owner) return;
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
      if (result.ok && recorded.added !== false && !step.target?.supplementalOnly) {
        const unaccented = value => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        const answer = question.meta?.answerLanguage === 'en' ? nameOf(entry)
          : question.answer.find(a=>unaccented(a)===unaccented(given)) || question.answer[0];
        speak(answer);
      }
      const panel = root.querySelector('.journey-main'), feedback = root.querySelector('.journey-feedback');
      if (panel && feedback) {
        const bottom = feedback.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
        if (bottom > 0) panel.scrollTop += bottom + 16;
      }
    } finally { submitting = false; }
  }
  const click = ev => {
    const b = ev.target.closest('button'); if (!b || b.disabled || !root.contains(b)) return;
    if (b.hasAttribute('data-lesson-back')) {browseHistory(reviewingHistory()?ui.historyCursor-1:ui.history.length-1);return;}
    if (b.hasAttribute('data-lesson-forward')) {if(ui.historyCursor>=ui.history.length-1)resumeCurrent();else browseHistory(ui.historyCursor+1);return;}
    if (b.hasAttribute('data-lesson-current')) {resumeCurrent();return;}
    if (b.hasAttribute('data-conjugation-toggle')) {openTable(b);return;}
    if (b.hasAttribute('data-conjugation-close')) {closeTable();return;}
    if (b.hasAttribute('data-conjugation-tense')) {tableTense=b.dataset.conjugationTense;renderTable();root.querySelector(`[data-conjugation-tense="${tableTense}"]`)?.focus();return;}
    if (b.hasAttribute('data-form-card')) {const track=b.closest('[data-form-track]');moveForm(track,Number(b.dataset.formCard));speak(b.dataset.formSay,{force:true});return;}
    if (b.hasAttribute('data-form-prev')||b.hasAttribute('data-form-next')) {const track=b.closest('.journey-form-deck').querySelector('[data-form-track]');moveForm(track,formIndex(track)+(b.hasAttribute('data-form-next')?1:-1));return;}
    if (b.hasAttribute('data-translation-toggle')) {const example=b.closest('.journey-example'),translation=example.querySelector('[data-translation]'),shown=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(shown));b.textContent=shown?'Hide translation':'Show translation';translation.hidden=!shown;translationVisibility.set(example.dataset.exampleKey,shown);updateScrollCue();return;}
    if (b.hasAttribute('data-say')) {ev.stopPropagation();speak(b.dataset.say,{force:true});return;}
    if (b.hasAttribute('data-pause')) {closeTable({restoreFocus:false});ui.historyCursor=null;ui.paused=true;stopSpeech();save();draw(true);return;}
    if(reviewingHistory())return;
    if (b.hasAttribute('data-choice')) { const c=question?.choices?.[Number(b.dataset.choice)]; if(c) submit(c.value ?? c.label); return; }
    if (b.hasAttribute('data-action-prev')) { moveAction(-1); return; }
    if (b.hasAttribute('data-action-next')) { moveAction(1); return; }
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
  const deckGesture = ev => {const track=ev.target.closest?.('[data-form-track]');if(track)formIntent.delete(track.dataset.formKey);};
  const scroll = ev => { if(ev.target.matches?.('.journey-main'))updateScrollCue(); if (ev.target.matches?.('[data-action-track]')) updateActions();else if(ev.target.matches?.('[data-form-track]'))updateFormDeck(ev.target); };
  const keydown = ev => {
    const track=ev.target.closest?.('[data-form-track]');
    if(track&&['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){ev.preventDefault();const next=ev.key==='Home'?0:ev.key==='End'?track.children.length-1:formIndex(track)+(ev.key==='ArrowRight'?1:-1);moveForm(track,next,{focus:true});return;}
    if (ev.target.matches('[data-action-track]') && ['ArrowLeft','ArrowRight'].includes(ev.key)) {ev.preventDefault();moveAction(ev.key==='ArrowRight'?1:-1);} };
  root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('submit',form);root.addEventListener('scroll',scroll,true);root.addEventListener('keydown',keydown);root.addEventListener('pointerdown',deckGesture,{passive:true});root.addEventListener('wheel',deckGesture,{passive:true});
  draw();
  return () => { words.destroy();closeTable({restoreFocus:false});save();disposed=true;stopSpeech();document.body.classList.remove('journey-viewport','journey-compact');document.body.style.removeProperty('--journey-viewport-height');window.visualViewport?.removeEventListener('resize',fitViewport);window.removeEventListener('resize',fitViewport);root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('submit',form);root.removeEventListener('scroll',scroll,true);root.removeEventListener('keydown',keydown);root.removeEventListener('pointerdown',deckGesture);root.removeEventListener('wheel',deckGesture); };
}
