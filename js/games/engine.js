// Shared game engine: question runner (multiple choice / typed answers), feedback bar, results screen,
// the quit + rail header, letter keyboards and the fixed keyboard dock used by crossword and hangman.
import { html, raw, esc, toast, haptic, speak, speakBtn, icon, $, $$ } from '../ui.js';
import { store } from '../store.js';
import { getEntry, headword, shortEn } from '../data.js';
import { normalizeAnswer, stripAccents } from '../conjugator.js';
import { entryRow } from '../components.js';
import fx from '../fx.js';
import { gradeQuestion } from '../learning/diagnose.js';
import { expandedForms } from '../learning/questions.js';

export const ACCENTS = ['à', 'è', 'é', 'ì', 'ò', 'ù'];
// Three tidy rows: 9 · 9 · 8 (+ backspace) keys — fits 375px with 44px-tall keys.
export const KEY_ROWS = ['abcdefghi', 'jklmnopqr', 'stuvwxyz'];
export const pad2 = (n) => String(Math.max(0, n | 0)).padStart(2, '0');
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
  const loose = (s) => stripAccents(s);
  const hasArt = noArt(a) !== a;
  if (expanded.includes(a)) return { ok: true, exact: true };
  if (!accentStrict && expanded.map(loose).includes(loose(a))) return { ok: true, exact: false, accentIssue: true };
  // the bare word (answer without article) against the forms without their article
  if (!hasArt) {
    const bare = expanded.map(noArt);
    if (bare.includes(a)) return { ok: true, exact: true };
    if (!accentStrict && bare.map(loose).includes(loose(a))) return { ok: true, exact: false, accentIssue: true };
    return { ok: false };
  }
  // an article was typed but did not match any accepted form: right word, wrong article?
  const bareA = noArt(a);
  if (expanded.map(noArt).includes(bareA) || (!accentStrict && expanded.map(x => loose(noArt(x))).includes(loose(bareA)))) return { ok: false, articleIssue: true };
  return { ok: false };
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

export function typedInputHTML({ placeholder = 'Type in Italian…', big = true, value = '' } = {}) {
  return html`<input class="input ${big ? 'big' : ''}" data-answer type="text" placeholder="${placeholder}" value="${value}" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-label="Your answer">
    ${raw(accentBar())}
    <button type="button" class="btn primary block mt" data-check>Check</button>`;
}

// ---------- header: quit button + progress rail + mono counter ----------
// gameTop('#/games', { i: 2, total: 12 }) → segments (done / current / todo) and "03 / 12"; `count` overrides the text.
export function gameTop(backHref, { i = 0, total = 0, count = null } = {}) {
  const useSegments = total > 0 && total <= 20;
  const segs = useSegments ? Array.from({ length: total }, (_, k) => `<span class="${k < i ? 'done' : k === i ? 'cur' : ''}"></span>`).join('') : '';
  const bar = `<div class="bar thin"><div class="bar-fill" style="width:${total ? Math.round((Math.min(i, total) / total) * 100) : 0}%"></div></div>`;
  const text = count != null ? count : (total ? `${pad2(Math.min(i + 1, total))} / ${pad2(total)}` : '');
  return html`<div class="game-top"><a class="icon-btn" href="${backHref}" aria-label="Quit">${ic('x', { size: 20 })}</a><div class="rail-wrap">${raw(useSegments ? `<div class="rail" aria-hidden="true">${segs}</div>` : bar)}<span class="rail-count">${text}</span></div></div>`;
}
// Legacy signature kept for callers that pass a percentage.
export function gameHeader(backHref, progress, scoreText) {
  return html`<div class="game-top"><a class="icon-btn" href="${backHref}" aria-label="Quit">${ic('x', { size: 20 })}</a><div class="rail-wrap"><div class="bar thin"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, Number(progress) || 0))}%"></div></div><span class="rail-count">${scoreText}</span></div></div>`;
}

// ---------- feedback bar (slides up, sticky at the bottom) ----------
// title / detail are HTML strings (escape what you interpolate).
export function feedbackHTML({ ok, title, detail = '', nextLabel = 'Continue', say = null, accent = null } = {}) {
  return `<div class="feedback-bar" data-feedback-bar>
    <div class="feedback ${ok ? 'ok' : 'ko'}" role="status"><span class="fb-ic">${icon(ok ? 'check' : 'x', { size: 20 })}</span><div class="fb-main"><div class="fb-title">${title}</div>${detail ? `<div class="detail">${detail}</div>` : ''}</div>${say ? speakBtn(say, 'sm') : ''}</div>
    <button type="button" class="btn ${accent || (ok ? 'primary' : 'accent')} block" data-next>${esc(nextLabel)}</button></div>`;
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
// The feedback bar is rendered inline after the choices and scrolled into view; inside a walkthrough scene it is also
// sticky to the bottom of the scrolling scene body (css/learn.css), so a wrong answer never strands the learner.
export function runDrill(root, questions, opts = {}) {
  const { title = 'Drill', gameId = 'drill', onDone = null, xpPer = 2, autoAdvance = true, passScore = null, record = true, backHref = '#/games' } = opts;
  const total = questions.length;
  const state = { i: 0, correct: 0, wrong: 0, missed: [], perItem: {}, start: Date.now(), answers: [] };
  let locked = false;
  let dead = false;
  const evidenceSessionId = `game:${gameId}:${globalThis.crypto?.randomUUID?.() || Date.now() + ':' + Math.random().toString(36).slice(2)}`;
  const exposure = new Map();
  const answerKey = value => stripAccents(normalizeAnswer(value));
  let assistance = new Set();
  const exposeAnswers = q => { for (const a of expandedForms(q.answer || [])) exposure.set(answerKey(a), state.i); };
  const onAnswerAudio = ev => {
    const q = questions[state.i];
    if (dead || locked || !q?.meta || q.meta.audioIsPrompt || q.meta.answerLanguage === 'en') return;
    if (ev.target.closest?.('[data-say]')) { assistance.add('answer-audio'); exposeAnswers(q); }
  };
  root.addEventListener('click', onAnswerAudio, true);
  const stopEvidenceListeners = () => root.removeEventListener('click', onAnswerAudio, true);

  function renderQ() {
    locked = false;
    if (dead) return;
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
      body = html`<div class="typed">${raw(typedInputHTML({ placeholder: q.placeholder || 'Type your answer…' }))}<button type="button" class="btn ghost block mt" data-skip>I don't know</button></div>`;
    }
    root.innerHTML = gameTop(backHref, { i: state.i, total }) + html`<div class="q-card">${q.tag ? raw(html`<div class="prompt">${q.tag}</div>`) : ''}${raw(q.prompt)}${q.say ? raw(`<div class="q-say">${speakBtn(q.say)}</div>`) : ''}</div>` + body + '<div data-feedback></div>';
    fx.mount(root);
    if (q.type !== 'mc') {
      const input = root.querySelector('[data-answer]');
      bindAccentBar(root, input);
      setTimeout(() => { if (root.contains(input)) input.focus({ preventScroll: true }); }, 60);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitTyped(); } });
      root.querySelector('[data-check]').addEventListener('click', submitTyped);
      root.querySelector('[data-skip]').addEventListener('click', () => grade(false, '', q, '', { revealed: true }));
    } else {
      root.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => { if (locked) return; const idx = Number(b.dataset.choice); const c = q.choices[idx]; grade(!!c.correct, c.label, q, idx); }));
    }
    if (q.autoSay && q.say) speak(q.say);
  }
  function submitTyped() {
    if (locked) return;
    const q = questions[state.i];
    const input = root.querySelector('[data-answer]');
    const res = q.accept ? q.accept(input.value) : checkTyped(input.value, q.answer);
    grade(!!res.ok, input.value, q, null, res);
  }
  function grade(ok, given, q, choiceIdx, res = {}) {
    if (locked || dead) return;
    locked = true;
    haptic(ok ? 'success' : 'error');
    if (ok) state.correct++; else { state.wrong++; if (q.itemId) state.missed.push(q.itemId); }
    state.answers.push({ q, ok, given });
    if (q.itemId && record) {
      const pi = (state.perItem[q.itemId] ||= { ok: 0, ko: 0 });
      if (ok) pi.ok++; else pi.ko++;
      store.recordAnswer(q.itemId, ok, { quality: ok ? (res.accentIssue ? 3 : 4) : 1, xp: ok ? xpPer : 0 });
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
      const input = root.querySelector('[data-answer]'); input.setAttribute('disabled', '');
      input.classList.add(ok ? 'is-ok' : 'is-ko');
      root.querySelector('[data-check]')?.remove();
      root.querySelector('[data-skip]')?.remove();
      root.querySelector('[data-accents]')?.remove();
      if (!ok) fx.shake(input);
    }
    const answerText = String(Array.isArray(q.answer) ? q.answer[0] : (q.answer || (q.choices || []).find(c => c.correct)?.label || '')).split('|')[0];
    const title = ok
      ? (res.accentIssue ? `Correct — mind the accent: <b>${esc(answerText)}</b>` : 'Correct!')
      : res.articleIssue ? `Right word, wrong article — it is <b>${esc(answerText)}</b>`
        : `Not quite — the answer is <b>${esc(answerText)}</b>`;
    const fb = root.querySelector('[data-feedback]');
    fb.innerHTML = feedbackHTML({ ok, title, detail: q.explain || '', nextLabel: state.i + 1 >= total ? 'See results' : 'Continue' });
    requestAnimationFrame(() => { if (root.contains(fb)) revealInScroller(fb.firstElementChild || fb); });
    if (q.say && !ok) speak(q.say);
    const nextBtn = fb.querySelector('[data-next]');
    nextBtn.addEventListener('click', next);
    // Enter checked the answer (the field is disabled now): Enter again continues, without a hunt for the button
    nextBtn.focus({ preventScroll: true });
    if (ok && autoAdvance && q.type === 'mc') setTimeout(() => { if (locked && !dead && root.contains(fb)) next(); }, 700);
    if (ok && res.accentIssue) toast('Remember the accent: ' + answerText);
  }
  function next() { if (dead) return; state.i++; renderQ(); }
  function finish() {
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
  return { state, destroy() { dead = true; stopEvidenceListeners(); } };
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
