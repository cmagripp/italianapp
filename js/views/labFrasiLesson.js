// The sentence workshop's lesson player (#/lab/frasi/:id): the course's full-screen shell (progress bar, Back, Pause)
// around the five activity kinds of docs/SENTENCE-LAB-CONTRACT.md §3. The pure engine (js/learning/sentence-lab.js)
// grades; this view keeps the session in store.learning.sessions (js/learning/sentence-lab-data.js), runs the three
// drills of a free-entry word, records their journey events, saves "Le mie frasi" and completes the lesson (15 XP).
// Layers 2 and 3 (fit scorer, assistant) are imported lazily inside handlers: the lesson is identical without them.
import { html, raw, esc, icon, speak, toast, keyboardViewportHeight, sheet } from '../ui.js';
import { setTitle, setChrome } from '../app.js';
import { store } from '../store.js';
import { data, getEntry, headword, shortEn, withArticle, isPluralOnly, distractors, shuffle, fold } from '../data.js';
import { setScene, confetti, reducedMotion } from '../fx.js';
import { feedbackHTML } from '../games/engine.js';
import { createSentenceLookup } from '../learning/sentence-lookup.js';
import { lessonPlan, lessonObjectives } from '../learning/integration.js';
import { grammarLesson, grammarHref } from '../learning/grammar-course.js';
import { createLabSession, compatibleLabSession, currentLabStep, answerLab, advanceLab, resolveFreeEntry, composeBuild, labSessionProgress, fillTemplate, normalizeLab } from '../learning/sentence-lab.js';
import { loadSentenceLab, labLesson, labNextLesson, labLessonIndex, readLabSession, writeLabSession, clearLabSession, LAB_KEY } from '../learning/sentence-lab-data.js';
import { labButton, labModel, labOrder, orderTokens, labCloze, labDialogue, labBuild, labComplete, labPaused, labDrill, labPicker } from '../learning/sentence-lab-activities.js';

const clone = value => JSON.parse(JSON.stringify(value));
const STAGE_TINT = { presente: 'A1', passato: 'A2', futuro: 'B1', strutture: 'B2' };
const FIT_COLORS = ['#f2c14e', '#2dd4bf', '#38bdf8'];

// One sentence lookup per dictionary load (the engine caches its own indexes by the dictionary object).
let dictionary = null, lookup = null;
export function labContext() {
  if (!dictionary || dictionary.vocab !== data.vocab || dictionary.verbs !== data.verbs) { dictionary = { vocab: data.vocab, verbs: data.verbs }; lookup = createSentenceLookup(dictionary); }
  return { dictionary, lookup, learnedIds: new Set(store.learnedIds()), speakerGender: store.settings.gender === 'f' ? 'f' : 'm' };
}
export const speakerGender = () => (store.settings.gender === 'f' ? 'f' : 'm');

// The engine's unwrap/wrap for a slot ("sono {}"): a typed "sono stanco" resolves as "stanco", a display puts it back.
function stripWrap(text, wrap) {
  if (typeof wrap !== 'string' || !wrap.includes('{}')) return text;
  const [pre, post] = wrap.split('{}').map(s => s.trim());
  let t = String(text).trim();
  const low = () => t.toLocaleLowerCase('it');
  if (pre && low().startsWith(pre.toLocaleLowerCase('it') + (/['’]$/.test(pre) ? '' : ' '))) t = t.slice(pre.length).trim();
  if (post && low().endsWith(' ' + post.toLocaleLowerCase('it'))) t = t.slice(0, -post.length).trim();
  return t;
}
const applyWrap = (wrap, form) => (typeof wrap === 'string' && wrap.trim() ? (wrap.includes('{}') ? wrap.replace('{}', form) : `${wrap.trim()} ${form}`) : form);
const sayForm = e => (e.kind === 'verb' ? e.inf : e.pos === 'noun' ? withArticle(e, isPluralOnly(e)) : e.it);

// The three quick drills of a word: meaning (choice), recall (choice), type it (with the article for a noun).
export function buildDrills(entry) {
  const pool = entry.kind === 'verb' ? data.verbs : data.vocab;
  const near = pool.filter(e => e.level === entry.level && e.id !== entry.id);
  const wrong = distractors(entry, near.length >= 8 ? near : pool, 3);
  const en = shortEn(entry.en), it = entry.kind === 'verb' ? entry.inf : headword(entry), say = sayForm(entry);
  const isNoun = entry.kind !== 'verb' && entry.pos === 'noun';
  const mc = (correct, wrongs) => { const seen = new Set([fold(correct)]); return shuffle([{ label: correct, correct: true }, ...wrongs.filter(w => w && !seen.has(fold(w)) && seen.add(fold(w))).map(label => ({ label }))]); };
  const typed = isNoun ? withArticle(entry, isPluralOnly(entry)) : it;
  return [
    { skill: 'meaning', type: 'mc', label: 'Meaning', prompt: 'What does it mean?', big: it, lang: 'it', choices: mc(en, wrong.map(d => shortEn(d.en))), answer: en, explain: `${it} · ${en}`, say },
    { skill: 'recall', type: 'mc', label: 'Recall', prompt: 'Choose the Italian', big: en, lang: 'en', choices: mc(it, wrong.map(d => (d.kind === 'verb' ? d.inf : headword(d)))), answer: it, explain: `${en} · ${it}`, say },
    { skill: isNoun ? 'article' : 'recall', type: 'type', label: isNoun ? 'With its article' : 'Type it', prompt: isNoun ? 'Type it with its article' : 'Type the Italian', big: en, lang: 'en', answers: [typed], answer: typed, explain: isNoun ? `${typed} · ${en}` : `${it} · ${en}`, say },
  ];
}
const typedMatches = (value, answers) => {
  const strict = store.settings.accentStrict === true;
  const norm = s => (strict ? String(s).normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g, "'") : fold(s)).replace(/\s+/g, ' ').trim();
  const v = norm(value);
  return answers.some(a => norm(a) === v);
};

export async function render(root, params, query = {}) {
  await loadSentenceLab();
  const lesson = labLesson(params.id);
  if (!lesson) { setTitle('Officina delle frasi'); root.innerHTML = html`<div class="empty"><p>Lesson not found.</p><a class="btn primary" href="#/lab/frasi">Back to the workshop</a></div>`; return; }
  const owner = store.current.id, place = labLessonIndex(lesson.id), stageName = place?.stage?.stage || 'presente';
  const prior = readLabSession(store, lesson.id);
  let session = prior && compatibleLabSession(lesson, prior) && prior.phase === 'activity' && query.restart !== '1' ? clone(prior) : createLabSession(lesson);
  let disposed = false, finished = false, completion = null, fitInstalled = null, assistantReady = null;
  const activities = lesson.activities;

  setTitle(lesson.title); setScene(STAGE_TINT[stageName] || 'A1'); setChrome({ tabs: false, back: false });
  document.body.classList.add('journey-viewport'); window.scrollTo(0, 0);
  const fit = () => { const height = keyboardViewportHeight(); if (height === null) document.body.style.removeProperty('--journey-viewport-height'); else document.body.style.setProperty('--journey-viewport-height', `${height}px`); };
  for (const name of ['resize', 'scroll']) window.visualViewport?.addEventListener(name, fit);
  for (const name of ['resize', 'orientationchange', 'pageshow']) window.addEventListener(name, fit);
  root.addEventListener('focusin', fit); root.addEventListener('focusout', fit); fit();

  // A session is written once the learner has done something in it: a lesson merely opened (or reopened after its
  // completion) leaves no "in progress" trace on the path page.
  const pristine = () => session.index === 0 && !(session.history || []).length && !session.paused && !session.state?.result && !(session.state?.attempts || []).length;
  const save = () => { if (!disposed && !finished && !pristine() && store.current.id === owner) writeLabSession(store, session); };
  const step = () => currentLabStep(lesson, session);
  const ui = () => { if (!session.state) return {}; return session.state.ui ||= {}; };
  const ctx = () => labContext();

  // ---------- drawing ----------
  function shell({ content, footer = '', feedback = false, kind, activityId, phase }) {
    const progress = labSessionProgress(lesson, session);
    const pct = session.phase === 'complete' ? 100 : Math.min(99, progress.percent);
    const lessonNo = place ? `Lezione ${place.index + 1} / ${place.total}` : 'Lezione';
    return html`<div class="grammar-shell course-v2-shell lab-shell" data-lab-lesson="${lesson.id}" data-kind="${kind}" data-activity="${activityId || ''}" data-phase="${phase}" data-stage="${stageName}">
      <header class="grammar-header"><button type="button" class="btn ghost" data-lab-back>${raw(icon('chevron', { size: 16 }))} Back</button><span class="kicker">${place?.stage?.title || 'Officina'} · ${lessonNo}</span><button type="button" class="btn ghost" data-lab-pause ${session.paused || phase === 'complete' ? raw('disabled') : ''}>Pause</button><div class="bar" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="bar-fill" style="width:${pct}%"></div></div></header>
      <main class="grammar-scroll lab-scroll" data-lab-scroll>${raw(content)}</main>
      ${footer ? raw(html`<footer class="grammar-footer ${feedback ? 'has-feedback' : ''}">${raw(footer)}</footer>`) : ''}
    </div>`;
  }
  const detailOf = (result, explanation = '') => `${result.sentence ? `<p lang="it" data-italian-sentence data-english="${esc(result.en || '')}">${esc(result.sentence)}</p>` : ''}${result.en ? `<p>${esc(result.en)}</p>` : ''}${explanation ? `<p>${esc(explanation)}</p>` : ''}`;
  // the per-blank maps every blank handler writes to
  const blankUi = u => { for (const k of ['bankOpen', 'freeOpen', 'drafts', 'messages', 'notes']) u[k] ||= {}; return u; };
  // A miss that is not final shows its explanation once; "Try again" dismisses it (the count is remembered per activity).
  const pendingMiss = (view, u) => !view.result && view.last && view.last.outcome === 'incorrect' && (view.state.misses || 0) > (u.seenMiss || 0);
  const missFooter = (view, u, retryLabel = 'Try again') => feedbackHTML({ ok: false, title: `Not quite${(view.state.misses || 0) < 2 ? ' · one more try' : ''}.`, detail: `<p>${esc(view.last.explanation || 'Try again.')}</p>`, nextAttribute: 'data-lab-retry', nextLabel: retryLabel, accent: 'secondary' });
  const finalFooter = (result, { explanation = '' } = {}) => {
    const title = result.outcome === 'correct' ? 'Esatto.' : result.outcome === 'accepted' ? 'Accepted · your own words.' : 'Here is the sentence.';
    return feedbackHTML({ ok: result.ok, title, detail: detailOf(result, result.ok ? '' : explanation), nextAttribute: 'data-lab-next', nextLabel: 'Continue' });
  };
  const finishLessonOnce = () => {
    if (completion) return completion;
    completion = store.completeLabLesson(LAB_KEY, lesson.id);
    finished = true; clearLabSession(store, lesson.id);
    if (completion.first && !reducedMotion()) { try { confetti(FIT_COLORS); } catch { /* decorative */ } }
    return completion;
  };
  const refsFor = () => (Array.isArray(lesson.grammarRefs) ? lesson.grammarRefs : []).map(id => { try { const l = grammarLesson(id); return l ? { title: l.title, href: grammarHref(l) } : null; } catch { return null; } }).filter(Boolean);

  function draw({ focus = false, scrollChat = false } = {}) {
    if (disposed || store.current.id !== owner) return;
    const view = step(), kind = view.kind, activity = view.activity, u = ui();
    let content = '', footer = '', feedback = false;
    if (session.paused) { content = labPaused(lesson); }
    else if (kind === 'complete') {
      const done = finishLessonOnce();
      const mine = store.labRecord(LAB_KEY).sentences.filter(s => s.lessonId === lesson.id).slice(-6).reverse();
      const next = labNextLesson(lesson.id);
      content = labComplete(lesson, { sentences: mine, first: done.first, refs: refsFor() });
      footer = html`${next ? raw(html`<a class="btn primary block" href="#/lab/frasi/${encodeURIComponent(next.id)}" data-lab-next-lesson>Next lesson · ${next.title}</a>`) : ''}<a class="btn ${next ? 'secondary' : 'primary'} block" href="#/lab/frasi" data-lab-workshop>Back to the workshop</a><a class="btn ghost block" href="#/learn">Back to Learn</a>`;
    } else if (kind === 'model') {
      content = labModel(activity, lesson, { first: view.index === 0 });
      footer = labButton('Continue', 'data-lab-next', 'primary');
    } else if (kind === 'order') {
      const tokens = orderTokens(activity);
      if (!Array.isArray(u.tokenOrder) || u.tokenOrder.length !== tokens.length) { let order = shuffle(tokens.map((_, i) => i)); if (tokens.length > 2 && order.every((ti, k) => ti === k)) order = shuffle(order); u.tokenOrder = order; }
      u.picked ||= [];
      const locked = !!view.result;
      content = labOrder(activity, u, { locked });
      if (locked) { feedback = true; footer = finalFooter(view.result, { explanation: activity.explanation }); }
      else if (pendingMiss(view, u)) { feedback = true; footer = missFooter(view, u); }
      else footer = labButton('Check', `data-lab-check${u.picked.length ? '' : ' disabled'}`, 'primary');
    } else if (kind === 'cloze') {
      const blanks = activity.blanks || [];
      if (!Array.isArray(u.values) || u.values.length !== blanks.length) u.values = blanks.map(() => '');
      u.active = Number.isInteger(u.active) && blanks[u.active] ? u.active : 0;
      blankUi(u);
      const locked = !!view.result;
      content = labCloze(activity, u, { locked, result: view.result });
      if (locked) { feedback = true; footer = finalFooter(view.result, { explanation: view.result.explanation }); }
      else if (pendingMiss(view, u)) { feedback = true; footer = missFooter(view, u); }
      else footer = labButton('Check', `data-lab-check${u.values.every(v => v) ? '' : ' disabled'}`, 'primary');
    } else if (kind === 'dialogue') {
      const state = view.state, current = state.current;
      if (current && u.turn !== current.index) Object.assign(u, { turn: current.index, values: current.blanks.map(() => ''), active: 0, bankOpen: {}, freeOpen: {}, drafts: {}, messages: {}, notes: {}, seenMiss: 0, hint: false });
      if (current && (!Array.isArray(u.values) || u.values.length !== current.blanks.length)) u.values = current.blanks.map(() => '');
      blankUi(u);
      content = labDialogue(activity, state, u, { locked: !current });
      if (state.complete) { footer = labButton('Continue', 'data-lab-next', 'primary'); }
      else if (pendingMiss(view, u)) { feedback = true; footer = missFooter(view, u); }
      else if (current) footer = labButton('Send', `data-lab-check${u.values.every(v => v) ? '' : ' disabled'}`, 'primary');
    } else if (kind === 'build') {
      u.choice ||= {};
      if (!u.yours) u.yours = learnedItemsFor(activity);
      const locked = !!view.result;
      const composed = locked ? { ok: true, it: view.result.sentence, en: view.result.en } : composeBuild(activity, choiceFor(activity, u), ctx());
      content = labBuild(activity, u, { composed, yours: u.yours, locked });
      if (locked) { feedback = true; footer = feedbackHTML({ ok: true, title: 'Saved to Le mie frasi.', detail: detailOf(view.result), nextAttribute: 'data-lab-next', nextLabel: 'Continue' }); }
      else footer = html`<div class="lab-build-actions"><button type="button" class="btn ghost" data-lab-another ${Object.keys(u.choice).length ? '' : raw('disabled')}>Another</button><button type="button" class="btn primary grow" data-lab-keep ${composed.ok ? '' : raw('disabled')}>Keep this sentence</button></div>`;
    }
    root.innerHTML = shell({ content, footer, feedback, kind: session.paused ? 'paused' : kind, activityId: activity?.id, phase: session.paused ? 'paused' : session.phase });
    save();
    if (focus) root.querySelector('[data-focus]')?.focus({ preventScroll: true });
    if (scrollChat) { const scroller = root.querySelector('[data-lab-scroll]'); if (scroller) scroller.scrollTop = scroller.scrollHeight; }
  }

  // ---------- build helpers ----------
  function choiceFor(activity, u) {
    const out = {};
    for (const role of activity.roles || []) {
      const key = u.choice?.[role.role];
      if (key === undefined || key === null || key === '') continue;
      if (typeof key === 'string' && key.startsWith('yours:')) { const item = u.yours?.[role.role]?.[Number(key.slice(6))]; if (item) out[role.role] = { it: item.it, en: item.en, entryId: item.entryId }; }
      else out[role.role] = Number(key);
    }
    return out;
  }
  // Up to four of the learner's learned words that match a role's `learned` filter, in the form the role asks for.
  function learnedItemsFor(activity) {
    const out = {};
    const c = ctx();
    for (const role of activity.roles || []) {
      const filter = role.learned;
      if (!filter || typeof filter !== 'object' || !filter.pos) continue;
      const cats = Array.isArray(filter.category) && filter.category.length ? new Set(filter.category) : null;
      const authored = new Set((role.items || []).map(item => normalizeLab(item.it || item.inf)));
      const slot = filter.pos === 'noun' ? { pos: 'noun', number: filter.number === 'pl' ? 'pl' : 'sg', article: filter.article || 'none' } : filter.pos === 'adj' ? { pos: 'adj', agree: filter.agree || null } : { pos: filter.pos, person: filter.person, tense: filter.tense };
      const list = [];
      for (const id of store.learnedWordIds()) {
        if (list.length >= 4) break;
        const e = getEntry(id);
        if (!e || e.kind === 'verb' || e.pos !== filter.pos || (cats && !cats.has(e.cat))) continue;
        let form = null;
        try {
          const r = resolveFreeEntry(e.it, slot, c);
          if (r.status === 'ok' || r.status === 'learn') form = r.entryId === e.id ? r.form : null;
          else if (r.status === 'choose') form = r.candidates.find(x => x.entryId === e.id)?.form || null;
        } catch { form = null; }
        if (!form || authored.has(normalizeLab(form)) || authored.has(normalizeLab(e.it))) continue;
        list.push({ it: form, en: shortEn(e.en), entryId: e.id });
      }
      if (list.length) out[role.role] = list;
    }
    return out;
  }

  // ---------- answers ----------
  function currentBlanks() {
    const view = step();
    if (view.kind === 'cloze') return { blanks: view.activity.blanks || [], template: view.activity.template, en: view.activity.en };
    if (view.kind === 'dialogue' && view.state.current) return { blanks: view.state.current.blanks || [], template: view.state.current.template, en: view.state.current.en };
    return null;
  }
  function submit(value) {
    const view = step();
    if (!view || view.done || session.paused) return;
    const { result } = answerLab(lesson, session, value, { ...ctx(), now: Date.now() });
    if (!result) return;
    const u = blankUi(ui());
    if (view.kind === 'order') {
      if (result.ok) speak(result.sentence);
    } else if (view.kind === 'cloze') {
      if (result.outcome === 'incorrect' && !result.revealed) {
        // keep the right blanks, clear the wrong ones so the learner can change them
        (result.blanks || []).forEach((g, i) => { if (g.outcome === 'incorrect') { u.values[i] = ''; u.notes[i] = null; } });
        u.active = (result.blanks || []).findIndex(g => g.outcome === 'incorrect');
        if (u.active < 0) u.active = 0;
      } else if (result.ok) speak(result.sentence);
    } else if (view.kind === 'dialogue') {
      if (result.sentence) { afterTurn(view, result); } else {
        (result.blanks || []).forEach((g, i) => { if (g.outcome === 'incorrect') { u.values[i] = ''; u.notes[i] = null; } });
        u.active = Math.max(0, (result.blanks || []).findIndex(g => g.outcome === 'incorrect'));
      }
    } else if (view.kind === 'build') {
      if (result.ok) { store.saveLabSentence(LAB_KEY, { it: result.sentence, en: result.en, lessonId: lesson.id }); speak(result.sentence); }
      else toast(result.explanation || 'Choose one word for each role.');
    }
    save(); draw({ scrollChat: view.kind === 'dialogue' });
  }
  // A finished "you" turn: speak the reaction, and let the assistant (layer 3) choose among several generic reactions.
  function afterTurn(view, result) {
    const turn = view.activity.turns?.[result.turnIndex];
    if (result.reaction?.it) speak(result.reaction.it);
    const generic = (turn?.reactions || []).filter(r => r.when === '*');
    const matched = (turn?.reactions || []).some(r => r.when !== '*' && (Array.isArray(r.when) ? r.when : [r.when]).some(w => normalizeLab(w) === normalizeLab(result.blanks?.[0]?.filled)));
    if (matched || generic.length < 2 || !result.reaction) return;
    pickReaction(view.activity, result.turnIndex, generic, result).catch(() => { /* the engine's choice stands */ });
  }
  async function pickReaction(activity, turnIndex, generic, result) {
    let mod;
    try { mod = await import('../learning/assistant.js'); } catch { return; }
    const state = mod.assistantState();
    if (!state.enabled) return;
    if (!state.loaded) { if (assistantReady === null) assistantReady = mod.enableAssistant().catch(() => null); return; } // loads for the next turn
    const u = ui(); u.thinking = true; draw({ scrollChat: true });
    const question = `${activity.partner || 'A friend'} asked: "${activity.turns?.[turnIndex - 1]?.it || activity.prompt}". The learner replied: "${result.sentence}" (${result.en || ''}). Which reply from ${activity.partner || 'the friend'} fits best?`;
    const pick = await mod.assistantPick({ question, candidates: generic.map((r, id) => ({ id, text: r.it })), maxMs: 6000 });
    if (disposed) return;
    u.thinking = false;
    const chosen = pick && generic[pick.id];
    const filled = session.state?.filled?.[turnIndex];
    if (chosen && filled && filled.reaction && filled.reaction.it !== chosen.it && session.state.kind === 'dialogue') {
      filled.reaction = { it: chosen.it, en: chosen.en ?? '' };
      const tr = (session.state.turnResults || []).find(r => r.turnIndex === turnIndex);
      if (tr) tr.reaction = { it: chosen.it, en: chosen.en ?? '' };
      speak(chosen.it);
    }
    save(); draw({ scrollChat: true });
  }
  function check() {
    const view = step(), u = ui();
    if (view.kind === 'order') submit((u.picked || []).map(i => orderTokens(view.activity)[i]));
    else if (view.kind === 'cloze' || view.kind === 'dialogue') { if ((u.values || []).every(v => v)) submit(u.values.slice()); }
    else if (view.kind === 'build') submit(choiceFor(view.activity, u));
  }
  function next() {
    const view = step();
    if (view.kind === 'complete') return;
    if (!view.done) return;
    advanceLab(lesson, session);
    save(); draw({ focus: true });
  }

  // ---------- free entry ----------
  function insertWord(i, display, info = null) {
    const u = blankUi(ui());
    u.values[i] = display; u.freeOpen[i] = false; u.drafts[i] = ''; u.messages[i] = null; u.notes[i] = null;
    u.entries ||= {}; u.entries[i] = info;
    const blanks = currentBlanks();
    const nextEmpty = (u.values || []).findIndex((v, k) => !v && k !== i);
    if (nextEmpty >= 0) u.active = nextEmpty;
    save(); draw();
    if (blanks && info) noteFit(i, blanks, display).catch(() => { /* advisory only */ });
  }
  // Layer 2: with the fit scorer installed, the inserted word is scored against the blank's authored options and a note
  // chip (natural / unusual here / odd here) appears beside it. Never blocks, never changes the grade.
  async function noteFit(i, { blanks, template }, word) {
    let mod;
    try { mod = await import('../learning/fit-scorer.js'); } catch { return; }
    if (fitInstalled === null) { try { fitInstalled = (await mod.fitScorerStatus()).installed; } catch { fitInstalled = false; } }
    if (!fitInstalled || disposed) return;
    const others = blanks.map((b, k) => (k === i ? '____' : b.accept?.[0] ?? b.options?.[0] ?? ''));
    const single = fillTemplate(template, others);
    const options = (blanks[i].options || []).filter(o => normalizeLab(o) !== normalizeLab(word));
    if (!options.length) return;
    const rows = await mod.scoreFit(single, [...options, word], { timeoutMs: 8000 });
    const row = rows.find(r => r.candidate === word);
    const u = ui();
    if (!row || disposed || u.values?.[i] !== word) return;
    u.notes[i] = row.note; save(); draw();
  }
  function useFreeWord(i, text) {
    const u = blankUi(ui()), blanks = currentBlanks()?.blanks || [], blank = blanks[i];
    const typed = String(text ?? '').trim();
    if (!blank || !typed) return;
    u.drafts[i] = typed;
    const wrap = blank.slot?.wrap;
    // an authored value typed by hand is used as it is (the engine grades it like a tap)
    const authored = [...(blank.options || []), ...(blank.bank || [])].find(o => normalizeLab(o) === normalizeLab(typed) || (wrap && normalizeLab(o) === normalizeLab(applyWrap(wrap, typed))));
    if (authored) { insertWord(i, authored, null); return; }
    if (!blank.free || !blank.slot) { u.messages[i] = { text: 'This blank takes one of the choices.' }; draw(); return; }
    let r;
    try { r = resolveFreeEntry(stripWrap(typed, wrap), blank.slot, ctx()); } catch (err) { console.warn(err); r = { status: 'unknown', suggestions: [] }; }
    if (r.status === 'ok') { insertWord(i, r.display, { entryId: r.entryId, it: r.it, en: r.en }); return; }
    if (r.status === 'learn') { learnThenInsert(i, r); return; }
    if (r.status === 'choose') { choose(i, r.candidates, wrap); return; }
    if (r.status === 'unfit') { u.messages[i] = { text: r.reason || 'That word does not fit this blank.' }; draw(); focusFree(i); return; }
    u.messages[i] = { text: 'That word is not in the dictionary yet.', suggestions: (r.suggestions || []).slice(0, 3) }; draw(); focusFree(i);
  }
  const focusFree = i => { const input = root.querySelector(`[data-lab-free-input="${i}"]`); if (input) input.focus({ preventScroll: true }); };
  function choose(i, candidates, wrap) {
    const s = sheet(labPicker(candidates), { title: '', cls: 'lab-sheet' });
    s.body.addEventListener('click', event => {
      const b = event.target.closest('[data-lab-candidate]'); if (!b) return;
      const c = candidates[Number(b.dataset.labCandidate)]; if (!c) return;
      s.close({ silent: true });
      const learned = store.isLearned(c.entryId);
      const info = { entryId: c.entryId, it: c.it, en: c.en, form: c.form, display: c.display || applyWrap(wrap, c.form) };
      if (learned) insertWord(i, info.display, info); else learnThenInsert(i, info);
    });
  }
  function learnThenInsert(i, info) {
    const entry = getEntry(info.entryId);
    if (!entry) { insertWord(i, info.display, info); return; }
    runDrills(entry, ({ passed }) => {
      if (disposed) return;
      // a verb is learned through its own tense chapters, never by three quick drills: the drills still run as a check
      if (passed) { if (entry.kind !== 'verb') { store.markLearned(entry.id, 'word'); toast(`${sayForm(entry)} · learned`, { kind: 'ok' }); } insertWord(i, info.display, { entryId: entry.id, it: info.it, en: info.en }); }
      else { const u = ui(); u.messages[i] = { text: `${sayForm(entry)} is not in your words yet. Pick an option, or try it again later.` }; draw(); }
    });
  }
  // The drill sheet: intro, three drills (a miss shows the answer and repeats once), then done or failed.
  function runDrills(entry, done) {
    const drills = buildDrills(entry);
    const word = { it: entry.kind === 'verb' ? entry.inf : headword(entry), en: shortEn(entry.en), say: sayForm(entry) };
    const view = { phase: 'intro', index: 0, total: drills.length, repeat: false, picked: null, draft: '', ok: null, word };
    const right = []; let settled = false;
    const finish = result => { if (settled) return; settled = true; s.close({ silent: true }); done(result); };
    const s = sheet('', { title: '', cls: 'lab-sheet lab-drill-sheet', onClose: () => finish({ passed: false, cancelled: true }) });
    const paint = () => { s.body.innerHTML = labDrill(drills[view.index], view); if (view.phase === 'drill' && drills[view.index].type === 'type' && view.ok === null) setTimeout(() => s.body.querySelector('[data-drill-input]')?.focus({ preventScroll: true }), 60); };
    const grade = ok => {
      view.ok = ok;
      recordDrill(entry, drills[view.index], ok, { repeat: view.repeat });
      if (ok) right[view.index] = true;
      if (ok || view.repeat) speak(drills[view.index].say);
      paint();
    };
    const advance = () => {
      const drill = drills[view.index];
      if (!view.ok && !view.repeat) { view.repeat = true; view.ok = null; view.picked = null; view.draft = ''; if (drill.type === 'mc') drill.choices = shuffle(drill.choices); paint(); return; }
      view.index += 1; view.repeat = false; view.ok = null; view.picked = null; view.draft = '';
      if (view.index >= drills.length) { view.phase = right.filter(Boolean).length === drills.length ? 'done' : 'failed'; paint(); return; }
      paint();
    };
    s.body.addEventListener('click', event => {
      const b = event.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-drill-start')) { view.phase = 'drill'; paint(); return; }
      if (b.hasAttribute('data-drill-skip') || b.hasAttribute('data-drill-close')) { finish({ passed: false, cancelled: b.hasAttribute('data-drill-skip') }); return; }
      if (b.hasAttribute('data-drill-done')) { finish({ passed: true }); return; }
      if (b.hasAttribute('data-drill-next')) { advance(); return; }
      if (b.hasAttribute('data-drill-choice') && view.ok === null) { const i = Number(b.dataset.drillChoice); view.picked = i; grade(!!drills[view.index].choices[i]?.correct); return; }
      if (b.hasAttribute('data-drill-accent')) { const field = s.body.querySelector('[data-drill-input]'); if (field && !field.readOnly) { field.setRangeText(b.dataset.drillAccent, field.selectionStart, field.selectionEnd, 'end'); view.draft = field.value; s.body.querySelector('[data-drill-check]')?.toggleAttribute('disabled', !view.draft.trim()); field.focus({ preventScroll: true }); } return; }
      if (b.hasAttribute('data-drill-check')) { event.preventDefault(); if (view.ok === null && view.draft.trim()) grade(typedMatches(view.draft, drills[view.index].answers)); }
    });
    s.body.addEventListener('input', event => { if (event.target.matches('[data-drill-input]')) { view.draft = event.target.value.slice(0, 80); s.body.querySelector('[data-drill-check]')?.toggleAttribute('disabled', !view.draft.trim()); } });
    s.body.addEventListener('submit', event => { if (event.target.matches('[data-drill-form]')) { event.preventDefault(); if (view.ok === null && view.draft.trim()) grade(typedMatches(view.draft, drills[view.index].answers)); } });
    paint();
  }
  // One journey-v1 event per drill answer, on the word's own lesson objective when it has one, so Review sees the word.
  function recordDrill(entry, drill, ok, { repeat = false } = {}) {
    session.drillSeq = (session.drillSeq || 0) + 1;
    let objective = null, version = 1;
    try { version = lessonPlan(entry)?.version || 1; objective = lessonObjectives(entry).find(o => o.skill === drill.skill && o.available !== false) || null; } catch { objective = null; }
    const objectiveId = objective?.id || `${entry.id}::lab::${drill.skill}`;
    try {
      store.recordLearningAttempt({
        id: `${session.id}:drill:${entry.id}:${drill.skill}:${session.drillSeq}`, sessionId: session.id, index: session.drillSeq, at: Date.now(),
        policy: 'journey-v1', wordPolicy: 'word-lab-drill-v1', targetId: objectiveId, objectiveId, entryId: entry.id, kind: entry.kind === 'verb' ? 'verb' : 'word',
        chapterId: objective?.chapterId || 'lab', contentVersion: version, role: null, skill: drill.skill, tense: null, person: null,
        activityKind: 'guided', mode: drill.type === 'type' ? 'production' : 'recognition', variantId: `lab:${drill.skill}:${drill.type}`, contextId: `lab:${lesson.id}`,
        ok, outcome: ok ? 'correct' : 'incorrect', assistance: [], firstAttempt: !repeat, errorTags: ok ? [] : [drill.skill], components: [],
      });
    } catch (err) { console.warn(err); }
  }

  // ---------- events ----------
  const click = event => {
    const b = event.target.closest('button'); if (!b || disposed || store.current.id !== owner) return;
    if (b.closest('[data-say]')) return;
    const u = blankUi(ui());
    if (b.hasAttribute('data-lab-back')) { save(); location.hash = '#/lab/frasi'; return; }
    if (b.hasAttribute('data-lab-pause')) { session.paused = true; save(); draw({ focus: true }); return; }
    if (b.hasAttribute('data-lab-resume')) { session.paused = false; save(); draw({ focus: true }); return; }
    if (session.paused) return;
    if (b.hasAttribute('data-lab-next')) { next(); return; }
    if (b.hasAttribute('data-lab-retry')) { u.seenMiss = step().state?.misses || 0; draw({ focus: true }); return; }
    if (b.hasAttribute('data-lab-check')) { check(); return; }
    if (b.hasAttribute('data-lab-hint')) { u.hint = true; draw(); return; }
    const view = step();
    if (view.done && view.kind !== 'dialogue') return;
    if (b.hasAttribute('data-lab-token')) { (u.picked ||= []).push(Number(b.dataset.labToken)); save(); draw(); return; }
    if (b.hasAttribute('data-lab-remove')) { (u.picked ||= []).splice(Number(b.dataset.labRemove), 1); save(); draw(); return; }
    if (b.hasAttribute('data-lab-blank')) { u.active = Number(b.dataset.labBlank); draw(); return; }
    if (b.hasAttribute('data-lab-option')) { const i = Number(b.dataset.blank); u.values[i] = b.dataset.labOption; u.notes[i] = null; u.messages[i] = null; const empty = u.values.findIndex((v, k) => !v && k !== i); if (empty >= 0) u.active = empty; save(); draw(); return; }
    if (b.hasAttribute('data-lab-bank')) { const i = Number(b.dataset.labBank); u.bankOpen[i] = !u.bankOpen[i]; draw(); return; }
    if (b.hasAttribute('data-lab-free')) { const i = Number(b.dataset.labFree); u.freeOpen[i] = !u.freeOpen[i]; draw(); if (u.freeOpen[i]) focusFree(i); return; }
    if (b.hasAttribute('data-lab-free-submit')) { event.preventDefault(); const i = Number(b.dataset.labFreeSubmit); useFreeWord(i, root.querySelector(`[data-lab-free-input="${i}"]`)?.value || u.drafts[i]); return; }
    if (b.hasAttribute('data-lab-suggest')) { const i = Number(b.dataset.blank); u.drafts[i] = b.dataset.labSuggest; u.messages[i] = null; draw(); focusFree(i); return; }
    if (b.hasAttribute('data-lab-accent')) { const i = Number(b.dataset.blank); const field = root.querySelector(`[data-lab-free-input="${i}"]`); if (field) { field.setRangeText(b.dataset.labAccent, field.selectionStart, field.selectionEnd, 'end'); u.drafts[i] = field.value; field.focus({ preventScroll: true }); } return; }
    if (b.hasAttribute('data-lab-pick')) { const role = b.dataset.labPick, item = b.dataset.item; u.choice ||= {}; if (String(u.choice[role]) === item) delete u.choice[role]; else u.choice[role] = item.startsWith('yours:') ? item : Number(item); save(); draw(); return; }
    if (b.hasAttribute('data-lab-another')) { u.choice = {}; save(); draw(); return; }
    if (b.hasAttribute('data-lab-keep')) { check(); return; }
  };
  const input = event => { if (event.target.matches('[data-lab-free-input]')) blankUi(ui()).drafts[Number(event.target.dataset.labFreeInput)] = event.target.value.slice(0, 80); };
  const form = event => { if (event.target.matches('[data-lab-free-form]')) { event.preventDefault(); const i = Number(event.target.dataset.labFreeForm); useFreeWord(i, event.target.querySelector('[data-lab-free-input]')?.value); } };
  root.addEventListener('click', click); root.addEventListener('input', input); root.addEventListener('submit', form);
  ui(); // the first activity's ui slot exists before the first draw
  save(); draw({ focus: true });

  return () => {
    disposed = true; save();
    root.removeEventListener('click', click); root.removeEventListener('input', input); root.removeEventListener('submit', form);
    root.removeEventListener('focusin', fit); root.removeEventListener('focusout', fit);
    for (const name of ['resize', 'scroll']) window.visualViewport?.removeEventListener(name, fit);
    for (const name of ['resize', 'orientationchange', 'pageshow']) window.removeEventListener(name, fit);
    document.body.classList.remove('journey-viewport'); document.body.style.removeProperty('--journey-viewport-height');
    setChrome({ tabs: true });
  };
}
