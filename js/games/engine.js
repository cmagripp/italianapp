// Shared game engine: question runner (multiple choice / typed answers), feedback bar, results screen,
// the quit + rail header, letter keyboards and the fixed keyboard dock used by crossword and hangman.
import { announceAnswer, html, raw, esc, toast, submissionNote, haptic, speak, speakBtn, icon, $, $$ } from '../ui.js';
import { store } from '../store.js';
import { getEntry, headword, shortEn } from '../data.js';
import { normalizeAnswer, stripAccents } from '../conjugator.js';
import { entryRow } from '../components.js';
import fx from '../fx.js';
import { gradeQuestion } from '../learning/diagnose.js';
import { expandedForms } from '../learning/questions.js';
import { compareSubmission } from '../learning/answer-policy.js';

export const ACCENTS = ['à', 'è', 'é', 'ì', 'ò', 'ù'];
// Three tidy rows: 9 · 9 · 8 (+ backspace) keys — fits 375px with 44px-tall keys.
export const KEY_ROWS = ['abcdefghi', 'jklmnopqr', 'stuvwxyz'];
export const pad2 = (n) => String(Math.max(0, n | 0)).padStart(2, '0');
export function gameAnswerBudget(ctx, fallback=8){const count=Number(ctx?.options?.count);return Number.isSafeInteger(count)&&count>0?count:fallback;}
export function gameActivityFence(isActive){
  const owner=store.current.id,learner=store.current.learnerId,epoch=store.learning.epoch.id;
  return ()=>store.current.id===owner&&store.current.learnerId===learner&&store.learning.epoch.id===epoch&&isActive?.()!==false;
}
const ic = (name, opts) => raw(icon(name, opts));
const BACKSPACE_SVG = '<svg class="ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9.5 5.5H19a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9.5L3.5 12z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/></svg>';

// A leading article: "la casa", "l'amico", "un'amica" (l' / un' need no space; the others do, so "lavoro" is not "la voro").
const ART_RE = /^(?:(?:il|lo|la|i|gli|le|un|uno|una)\s+|(?:l'|un')\s*)/;
const noArt = (s) => s.replace(ART_RE, '');

// checkTyped(answer, forms, { strict }) → { ok, exact, accentIssue, articleIssue }
// The bare word is always accepted; an article is accepted only when it is the entry's own (any form listed with it),
// otherwise the answer is wrong with articleIssue so the caller can say "mind the article". Missing accents pass with
// accentIssue unless the accentStrict setting (or `strict`) is on.
export function checkTyped(answer, acceptedForms, { strict = null } = {}) {
  const accentStrict = strict ?? !!store.settings.accentStrict;
  const a = normalizeAnswer(answer);
  if (!a) return { ok: false };
  const forms = (Array.isArray(acceptedForms) ? acceptedForms : [acceptedForms]).flatMap(f => String(f).split('|')).map(normalizeAnswer);
  // "il/la studente" (one form, either gender) → il studente / la studente; "andato/a" → andato / andata
  const expanded = forms
    .flatMap(f => { const m = f.match(/^([^\s/]+)\/([^\s/]+)\s+(.+)$/); return m ? [`${m[1]} ${m[3]}`, `${m[2]} ${m[3]}`] : [f]; })
    .flatMap(f => [f, f.replace(/o\/a\b/g, 'o'), f.replace(/o\/a\b/g, 'a'), f.replace(/i\/e\b/g, 'i'), f.replace(/i\/e\b/g, 'e')]);
  const hasArt = noArt(a) !== a;
  const allowed = hasArt ? expanded : [...expanded,...expanded.map(noArt)];
  const submission = compareSubmission(answer, allowed, {accentStrict,trailingPunctuation:false});
  const result = {...submission,submission};
  if (submission.ok || !hasArt) return result;
  const articleCheck = compareSubmission(noArt(a),expanded.map(noArt),{accentStrict,trailingPunctuation:false});
  return {...result,articleIssue:articleCheck.ok};
}

// Scrolls the nearest scrollable ancestor (a walkthrough scene body, a sheet…) just enough to show `el`.
// The page-level scroll is left to the browser; a scroll-snap deck is never touched.
export function revealInScroller(el, { pad = 12, behavior = null } = {}) {
  if (!el) return;
  let sc = el.parentElement;
  while (sc && sc !== document.body) {
    const cs = getComputedStyle(sc);
    if (/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 2) break;
    sc = sc.parentElement;
  }
  if (!sc || sc === document.body) return;
  const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect();
  const over = r.bottom - (b.bottom - pad);
  const under = (b.top + pad) - r.top;
  let delta = 0;
  if (over > 0) delta = over;
  if (under > 0 && r.height < b.height) delta = -under;
  if (!delta) return;
  sc.scrollBy({ top: delta, behavior: behavior || (fx.reducedMotion() ? 'auto' : 'smooth') });
}

// Accent bar: 40px glass keys (styled by app.css `.accents .chip`).
export function accentBar() {
  return html`<div class="accents mt" data-accents role="group" aria-label="Accented letters">${raw(ACCENTS.map(a => html`<button type="button" class="chip" data-ins="${a}">${a}</button>`).join(''))}<button type="button" class="chip" data-ins="'" aria-label="Apostrophe">'</button></div>`;
}
export function bindAccentBar(root, input) {
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ins]'); if (!b) return;
    ev.preventDefault();
    const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, s) + b.dataset.ins + input.value.slice(e);
    input.focus(); input.setSelectionRange(s + 1, s + 1);
  });
}

export function typedInputHTML({ placeholder = 'Type in Italian…', big = true, value = '', language = 'it' } = {}) {
  return html`<input class="input ${big ? 'big' : ''}" data-answer type="text" lang="${language==='en'?'en':'it'}" placeholder="${placeholder}" value="${value}" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-label="Your answer">
    ${raw(accentBar())}
    <button type="button" class="btn primary block mt" data-check>Check</button>`;
}

// ---------- header: quit button + progress rail + mono counter ----------
// `i` is the viewed position; `completed` is the answered/rated count. Going
// back to an earlier card must not erase the completed portion of the rail.
export function gameTop(backHref, { i = 0, total = 0, completed = i, count = null } = {}) {
  total = Math.max(0, Math.floor(Number(total) || 0));
  i = Math.max(0, Math.min(total, Math.floor(Number(i) || 0)));
  completed = Math.max(0, Math.min(total, Math.floor(Number(completed) || 0)));
  const useSegments = total > 0 && total <= 20;
  const segs = useSegments ? Array.from({ length: total }, (_, k) => `<span class="${[k < completed ? 'done' : '', k === i ? 'cur' : ''].filter(Boolean).join(' ')}"></span>`).join('') : '';
  const bar = `<div class="bar thin"><div class="bar-fill" style="width:${total ? Math.round((completed / total) * 100) : 0}%"></div></div>`;
  const text = count != null ? count : (total ? `${pad2(Math.min(i + 1, total))} / ${pad2(total)}` : '');
  return html`<div class="game-top"><a class="icon-btn" href="${backHref}" aria-label="Quit">${ic('x', { size: 20 })}</a><div class="rail-wrap" role="progressbar" aria-label="Completed" aria-valuemin="0" aria-valuemax="${total || 1}" aria-valuenow="${completed}">${raw(useSegments ? `<div class="rail" aria-hidden="true">${segs}</div>` : bar)}<span class="rail-count">${text}</span></div></div>`;
}
// Legacy signature kept for callers that pass a percentage.
export function gameHeader(backHref, progress, scoreText) {
  return html`<div class="game-top"><a class="icon-btn" href="${backHref}" aria-label="Quit">${ic('x', { size: 20 })}</a><div class="rail-wrap"><div class="bar thin"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, Number(progress) || 0))}%"></div></div><span class="rail-count">${scoreText}</span></div></div>`;
}

// ---------- feedback bar (slides up, sticky at the bottom) ----------
// title / detail are HTML strings (escape what you interpolate).
export function feedbackHTML({ ok, title, detail = '', submission = null, nextLabel = 'Continue', say = null, accent = null, nextAttribute = 'data-next', showNext = true, continue: showContinue = showNext } = {}) {
  const nextHook = /^data-[a-z][a-z0-9-]*$/.test(nextAttribute) ? nextAttribute : 'data-next';
  detail += submissionNote(submission);
  return `<div class="feedback-bar ${ok ? 'is-correct' : 'is-incorrect'}" data-feedback-bar data-feedback-state="${ok ? 'correct' : 'incorrect'}">
    <div class="feedback ${ok ? 'ok' : 'ko'}" role="status"><span class="fb-ic">${icon(ok ? 'check' : 'x', { size: 20 })}</span><div class="fb-main"><div class="fb-title">${title}</div>${detail ? `<div class="detail">${detail}</div>` : ''}</div>${say ? speakBtn(say, 'sm') : ''}</div>
    ${showContinue ? `<button type="button" class="btn ${accent || (ok ? 'primary' : 'accent')} block" ${nextHook}>${esc(nextLabel)}</button>` : ''}</div>`;
}

// ---------- letter keyboard ----------
// keyboardHTML({ backspace: true, state: { a: 'used hit' } }) → .keyboard > .krow > button.k[data-l]
export function keyboardHTML({ rows = KEY_ROWS, backspace = false, state = {} } = {}) {
  return `<div class="keyboard" role="group" aria-label="Letters">${rows.map((r, ri) => `<div class="krow">${[...r].map(l => `<button type="button" class="k ${state[l] || ''}" data-l="${l}">${l}</button>`).join('')}${backspace && ri === rows.length - 1 ? `<button type="button" class="k k-back" data-l="⌫" aria-label="Backspace">${BACKSPACE_SVG}</button>` : ''}</div>`).join('')}</div>`;
}

// ---------- keyboard dock ----------
// Fixed glass dock above the safe area. It lives on <body> (so page transforms never move it) and adds a spacer
// (.dock-space) at the end of `root` so nothing interactive can sit under it. Returns { el, set(html), measure(), destroy() }.
export function mountDock(root, innerHTML, { cls = '' } = {}) {
  const el = document.createElement('div');
  el.className = `dock ${cls}`.trim();
  el.setAttribute('data-dock', '');
  el.innerHTML = `<div class="dock-inner">${innerHTML}</div>`;
  const space = document.createElement('div');
  space.className = 'dock-space no-mount';
  space.setAttribute('aria-hidden', 'true');
  root.append(space);
  document.body.append(el);
  document.body.classList.add('has-dock');
  let raf = 0, dead = false;
  const measure = () => {
    raf = 0;
    if (dead) return;
    const h = el.offsetHeight;
    space.style.height = `${h + 12}px`;
    document.documentElement.style.setProperty('--game-dock', `${h}px`);
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(measure); };
  const ro = window.ResizeObserver ? new ResizeObserver(queue) : null;
  if (ro) ro.observe(el);
  window.addEventListener('resize', queue);
  measure();
  return {
    el, space, measure,
    set(inner) { el.querySelector('.dock-inner').innerHTML = inner; measure(); },
    destroy() {
      if (dead) return; dead = true;
      if (ro) ro.disconnect();
      window.removeEventListener('resize', queue);
      el.remove(); space.remove();
      document.body.classList.remove('has-dock');
      document.documentElement.style.removeProperty('--game-dock');
    },
  };
}

// ---------- question runner ----------
// A question: { type: 'mc'|'type', itemId, tag (mono kicker), prompt (html), say?, autoSay?, center?,
//               choices: [{label, correct, sub?, html?}], answer: string|string[], accept?(value), placeholder?, explain (html), kind? }
// Returns { state, destroy() }; destroy() stops a runner whose host is being unmounted mid-question (no further renders).
// Questions scroll inside the main region; feedback has its own bounded footer
// so Continue stays visible in games, Review and the older Learn walkthroughs.
export function runDrill(root, questions, opts = {}) {
  const { title = 'Drill', gameId = 'drill', onDone = null, xpPer = 2, autoAdvance = false, passScore = null, record = true, backHref = '#/games' } = opts;
  const total = questions.length;
  const state = { i: 0, correct: 0, wrong: 0, missed: [], perItem: {}, start: Date.now(), answers: [] };
  let locked = false;
  let dead = false;
  const current=gameActivityFence(opts.isActive),active=()=>!dead&&current();
  let finished = false;
  let advanceTimer = null, focusTimer = null;
  const evidenceSessionId = `game:${gameId}:${globalThis.crypto?.randomUUID?.() || Date.now() + ':' + Math.random().toString(36).slice(2)}`;
  const exposure = new Map();
  const answerKey = value => stripAccents(normalizeAnswer(value));
  let assistance = new Set();
  const exposeAnswers = q => { for (const a of expandedForms(q.answer || [])) exposure.set(answerKey(a), state.i); };
  const onAnswerAudio = ev => {
    const q = questions[state.i];
    if (!active() || locked || !q?.meta || q.meta.audioIsPrompt || q.meta.answerLanguage === 'en') return;
    if (ev.target.closest?.('[data-say]')) { assistance.add('answer-audio'); exposeAnswers(q); }
  };
  root.addEventListener('click', onAnswerAudio, true);
  const stopEvidenceListeners = () => root.removeEventListener('click', onAnswerAudio, true);

  function renderQ() {
    clearTimeout(advanceTimer); clearTimeout(focusTimer);
    locked = false;
    if (!active()) return;
    const q = questions[state.i];
    if (!q) return finish();
    assistance = new Set();
    if (expandedForms(q.answer || []).some(a => exposure.has(answerKey(a)) && state.i - exposure.get(answerKey(a)) < 3)) assistance.add('recent-answer-exposure');
    if (q.type === 'mc') for (const c of q.choices || []) exposure.set(answerKey(c.label), state.i);
    if (q.autoSay && !q.meta?.audioIsPrompt && q.meta?.answerLanguage !== 'en') assistance.add('answer-audio');
    let body = '';
    if (q.type === 'mc') {
      body = html`<div class="choices ${q.choices.length === 2 ? 'two' : ''}">${raw(q.choices.map((c, idx) => html`<button type="button" class="choice ${q.center ? 'center' : ''}" data-choice="${idx}"><span class="choice-label">${raw(c.html || esc(c.label))}${c.sub ? raw(`<span class="tiny muted">${esc(c.sub)}</span>`) : ''}</span></button>`).join(''))}</div>`;
    } else {
      body = html`<div class="typed">${raw(typedInputHTML({ placeholder: q.placeholder || 'Type your answer…',language:q.meta?.answerLanguage }))}<button type="button" class="btn ghost block mt" data-skip>I don't know</button></div>`;
    }
    root.innerHTML = html`<section class="drill-shell" data-drill data-state="question" data-question-type="${q.type}">` + gameTop(backHref, { i: state.i, total, completed: state.answers.length }) + '<div class="drill-main" data-drill-main>' + html`<div class="q-card">${q.tag ? raw(html`<div class="prompt">${q.tag}</div>`) : ''}${raw(q.prompt)}${q.say ? raw(`<div class="q-say">${speakBtn(q.say)}</div>`) : ''}</div>` + '<div class="drill-answer-area" data-drill-answers>' + body + '</div></div><div class="drill-feedback" data-feedback></div></section>';
    fx.mount(root);
    if (q.type !== 'mc') {
      const input = root.querySelector('[data-answer]');
      bindAccentBar(root.querySelector('.typed'), input);
      focusTimer = setTimeout(() => { if (active() && root.contains(input)) input.focus({ preventScroll: true }); }, 60);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitTyped(); } });
      root.querySelector('[data-check]').addEventListener('click', submitTyped);
      root.querySelector('[data-skip]').addEventListener('click', () => grade(false, '', q, '', { revealed: true }));
    } else {
      root.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => { if (locked) return; const idx = Number(b.dataset.choice); const c = q.choices[idx]; grade(!!c.correct, c.label, q, idx); }));
    }
    if (q.autoSay && q.say) speak(q.say);
  }
  function submitTyped() {
    if (locked || !active()) return;
    const q = questions[state.i];
    const input = root.querySelector('[data-answer]');
    const res = q.accept ? q.accept(input.value) : checkTyped(input.value, q.answer);
    grade(!!res.ok, input.value, q, null, res);
  }
  function grade(ok, given, q, choiceIdx, res = {}) {
    if (locked || !active()) return;
    locked = true;
    announceAnswer({ok,...res});
    haptic(ok ? 'success' : 'error');
    if (ok) state.correct++; else { state.wrong++; if (q.itemId) state.missed.push(q.itemId); }
    state.answers.push({ q, ok, given:res.submission?.displayText ?? given, submission:res.submission });
    const answeredIndex = state.i;
    root.querySelector('[data-drill]').dataset.state = 'feedback';
    const top = root.querySelector('.game-top');
    if (top) top.outerHTML = gameTop(backHref, { i: state.i, total, completed: state.answers.length });
    if (q.itemId && record) {
      const pi = (state.perItem[q.itemId] ||= { ok: 0, ko: 0 });
      if (ok) pi.ok++; else pi.ko++;
      store.recordAnswer(q.itemId, ok, { quality: ok ? 4 : 1, xp: ok ? xpPer : 0 });
      if (q.meta?.source === 'game' && q.meta.objectiveId) {
        const aid = [...assistance, ...(res.revealed ? ['revealed'] : [])];
        const diagnosed = gradeQuestion(q, given, { revealed: !!res.revealed, assistance: aid, accentStrict: !!store.settings.accentStrict });
        // The game's existing custom accept callback remains authoritative.
        // If it permits an additional synonym/variant, record only the directly
        // tested skill; do not invent component evidence from a disagreement.
        const consistent = diagnosed.ok === ok;
        store.recordLearningAttempt({
          ...q.meta, sessionId: evidenceSessionId, index: state.i, at: Date.now(),
          ok, outcome: res.revealed ? 'revealed' : ok ? 'correct' : 'incorrect',
          assistance: aid, firstAttempt: true,
          errorTags: consistent ? diagnosed.errorTags : ok ? [] : ['uncertain'],
          components: res.revealed ? [] : consistent ? diagnosed.components : [{ skill: q.meta.skill, ok }],
          submission:res.submission || diagnosed.submission,
          xp: 0, countStats: false,
        });
      }
    }
    exposeAnswers(q);
    if (q.type === 'mc') {
      root.querySelectorAll('[data-choice]').forEach((b, idx) => {
        const c = q.choices[idx];
        b.setAttribute('disabled', '');
        if (c.correct) b.classList.add('correct');
        else if (idx === choiceIdx) b.classList.add('wrong');
        else b.classList.add('dim');
      });
    } else {
      const input = root.querySelector('[data-answer]');
      if(ok&&res.submission)input.value=res.submission.displayText;
      input.setAttribute('disabled', '');
      input.classList.add(ok ? 'is-ok' : 'is-ko');
      root.querySelector('[data-check]')?.remove();
      root.querySelector('[data-skip]')?.remove();
      root.querySelector('[data-accents]')?.remove();
      if (!ok) fx.shake(input);
    }
    const answerText = res.submission?.matchedAnswerText || String(Array.isArray(q.answer) ? q.answer[0] : (q.answer || (q.choices || []).find(c => c.correct)?.label || '')).split('|')[0];
    const title = ok
      ? (res.accentIssue ? `Correct — accent restored: <b>${esc(answerText)}</b>` : 'Correct!')
      : res.articleIssue ? `Right word, wrong article — it is <b>${esc(answerText)}</b>`
        : `Not quite — the answer is <b>${esc(answerText)}</b>`;
    const fb = root.querySelector('[data-feedback]');
    fb.innerHTML = feedbackHTML({ ok, title, detail: q.explain || '', submission:res.submission, nextLabel: state.i + 1 >= total ? 'See results' : 'Continue' });
    requestAnimationFrame(() => { if (root.contains(fb)) revealInScroller(fb.firstElementChild || fb); });
    if (q.say) speak(q.say);
    const nextBtn = fb.querySelector('[data-next]');
    nextBtn.addEventListener('click', () => next(answeredIndex));
    // Enter checked the answer (the field is disabled now): Enter again continues, without a hunt for the button
    nextBtn.focus({ preventScroll: true });
    if (ok && autoAdvance && q.type === 'mc') advanceTimer = setTimeout(() => { if (root.contains(fb)) next(answeredIndex); }, 700);
    if (!q.say && ok && res.accentIssue) speak(res.submission?.displayText || answerText);
  }
  function next(answeredIndex) {
    if (!active() || finished || !locked || state.i !== answeredIndex) return;
    root.querySelector('[data-next]')?.setAttribute('disabled', '');
    locked = false; state.i++; renderQ();
  }
  function finish() {
    if (finished || !active()) return;
    finished = true;
    clearTimeout(advanceTimer); clearTimeout(focusTimer);
    stopEvidenceListeners();
    const secs = Math.round((Date.now() - state.start) / 1000);
    const result = { gameId, title, total, correct: state.correct, wrong: state.wrong, score: total ? Math.round((state.correct / total) * 100) : 0, missed: [...new Set(state.missed)], secs, perItem: state.perItem, answers: state.answers };
    result.xp = state.correct * xpPer + (result.score === 100 && total >= 5 ? 10 : 0);
    // recordAnswer already awarded xpPer per correct answer: the game record adds only the perfect-run bonus, so the
    // store gains exactly the "+N XP" the results screen shows
    if (record) store.recordGame(gameId, { ...result, xp: result.xp - state.correct * xpPer });
    if (onDone) return onDone(result);
    showResults(root, result, opts);
  }
  renderQ();
  return { state, destroy() { dead = true; clearTimeout(advanceTimer); clearTimeout(focusTimer); stopEvidenceListeners(); } };
}

// ---------- results ----------
function levelColor() {
  try { const c = getComputedStyle(document.documentElement).getPropertyValue('--lvl-current').trim(); return c && !c.startsWith('var(') ? c : null; } catch { return null; }
}
export function showResults(root, result, opts = {}) {
  const { backHref = '#/games', onReplay = null, onPractice = null, passScore = null, extraHTML = '' } = opts;
  const score = Math.max(0, Math.min(100, Number(result.score) || 0));
  const passed = passScore == null ? null : score >= passScore;
  const [word, kind] = score === 100 ? ['Perfetto', 'ok'] : score >= 80 ? ['Bravo', 'ok'] : score >= 50 ? ['Bene', 'info'] : ['Riprova', 'ko'];
  const missed = (result.missed || []).map(getEntry).filter(Boolean);
  const actions = [];
  if (onPractice && missed.length) actions.push('<button type="button" class="btn accent" data-practice>Practice missed</button>');
  if (onReplay) actions.push('<button type="button" class="btn primary" data-replay>Play again</button>');
  actions.push(html`<a class="btn ghost" href="${backHref}">Done</a>`);
  root.innerHTML = html`<div class="results result-hero">
      <div class="score-ring" style="--p:0"><div class="score" data-score>0%</div></div>
      <div class="results-stamp" data-stamp></div>
      <p class="results-line">${result.correct} of ${result.total} correct${result.secs ? ' · ' + result.secs + 's' : ''} · +${result.xp || 0} XP</p>
      ${passed === true ? raw('<span class="badge ok">Passed</span>') : passed === false ? raw(html`<span class="badge">Score ${passScore}% or more to pass</span>`) : ''}
    </div>
    ${raw(extraHTML)}
    ${missed.length ? raw(`<div class="section results-missed"><div class="sec-head"><div><span class="kicker">Da rivedere</span><span class="title">To review</span></div><span class="rail-count">${missed.length}</span></div><div class="list result-list">${missed.map(e => entryRow(e)).join('')}</div></div>`) : ''}
    <div class="sticky-actions results-actions n${actions.length}">${raw(actions.join(''))}</div>`;
  fx.mount(root);
  if (onReplay) root.querySelector('[data-replay]')?.addEventListener('click', onReplay);
  if (onPractice) root.querySelector('[data-practice]')?.addEventListener('click', () => onPractice(missed));
  const ring = root.querySelector('.score-ring');
  const scoreEl = root.querySelector('[data-score]');
  const reduced = fx.reducedMotion();
  requestAnimationFrame(() => { if (ring.isConnected) ring.style.setProperty('--p', String(score)); });
  fx.countUp(scoreEl, score, { suffix: '%', duration: reduced ? 0 : 900 });
  const stampHost = root.querySelector('[data-stamp]');
  const stampAt = reduced ? 0 : 650;
  setTimeout(() => {
    if (!root.contains(stampHost)) return;
    fx.stamp(stampHost, word.toUpperCase(), kind);
    if (score >= 80) {
      const lvl = levelColor();
      fx.confetti([...(lvl ? [lvl] : []), '#f2c14e', '#ffd97a', '#38bdf8', '#e0673f', '#2dd4bf'], { origin: { x: .5, y: .3 } });
      haptic('success');
    }
  }, stampAt);
  const xpEl = document.createElement('div'); xpEl.className = 'xp-float'; xpEl.textContent = `+${result.xp || 0} XP`; document.body.append(xpEl); setTimeout(() => xpEl.remove(), 1000);
}
