// Shared game engine: question runner (multiple choice / typed answers), feedback, and results screen.
import { html, raw, esc, toast, haptic, speak, speakBtn, $, $$ } from '../ui.js';
import { store } from '../store.js';
import { getEntry, headword, shortEn } from '../data.js';
import { normalizeAnswer, stripAccents } from '../conjugator.js';
import { entryRow } from '../components.js';

export const ACCENTS = ['à', 'è', 'é', 'ì', 'ò', 'ù'];

export function checkTyped(answer, acceptedForms, { strict = null } = {}) {
  const accentStrict = strict ?? !!store.settings.accentStrict;
  const a = normalizeAnswer(answer);
  if (!a) return { ok: false };
  const forms = (Array.isArray(acceptedForms) ? acceptedForms : [acceptedForms]).flatMap(f => String(f).split('|')).map(normalizeAnswer);
  // strip optional agreement marks "andato/a" -> accept andato / andata
  const expanded = forms.flatMap(f => [f, f.replace(/o\/a\b/g, 'o'), f.replace(/o\/a\b/g, 'a'), f.replace(/i\/e\b/g, 'i'), f.replace(/i\/e\b/g, 'e')]);
  if (expanded.includes(a)) return { ok: true, exact: true };
  // ignore leading article for vocabulary answers
  const noArt = (s) => s.replace(/^(il|lo|la|l'|i|gli|le|un|uno|una|un')\s*/, '');
  if (expanded.map(noArt).includes(noArt(a))) return { ok: true, exact: true };
  if (!accentStrict && expanded.map(stripAccents).includes(stripAccents(a))) return { ok: true, exact: false, accentIssue: true };
  if (expanded.map(x => stripAccents(noArt(x))).includes(stripAccents(noArt(a)))) return { ok: true, exact: false, accentIssue: true };
  return { ok: false };
}

export function accentBar() {
  return html`<div class="chips mt" data-accents>${raw(ACCENTS.map(a => html`<button type="button" class="chip sm" data-ins="${a}">${a}</button>`).join(''))}<button type="button" class="chip sm" data-ins="'">'</button></div>`;
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
  return html`<input class="input ${big ? 'big' : ''}" data-answer type="text" placeholder="${placeholder}" value="${value}" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="go">
    ${raw(accentBar())}
    <button class="btn primary block mt" data-check>Check</button>`;
}

// A question: { type: 'mc'|'type', itemId, prompt (html), say?, choices: [{label, correct, sub?}], answer: string|string[], explain (html), xp?, kind? }
export function runDrill(root, questions, opts = {}) {
  const { title = 'Drill', gameId = 'drill', onDone = null, xpPer = 2, autoAdvance = true, passScore = null, record = true, backHref = '#/games' } = opts;
  const total = questions.length;
  const state = { i: 0, correct: 0, wrong: 0, missed: [], perItem: {}, start: Date.now(), answers: [] };
  let locked = false;

  function header() {
    return html`<div class="game-top"><a class="icon-btn" href="${backHref}" aria-label="Quit">✕</a><div class="bar"><div class="bar-fill" style="width:${Math.round((state.i / total) * 100)}%"></div></div><div class="score">${state.correct}/${total}</div></div>`;
  }
  function renderQ() {
    locked = false;
    const q = questions[state.i];
    if (!q) return finish();
    let body = '';
    if (q.type === 'mc') {
      body = html`<div class="choices ${q.choices.length === 2 ? 'two' : ''}">${raw(q.choices.map((c, idx) => html`<button class="choice ${q.center ? 'center' : ''}" data-choice="${idx}">${raw(c.html || esc(c.label))}${c.sub ? raw(`<div class="tiny muted">${esc(c.sub)}</div>`) : ''}</button>`).join(''))}</div>`;
    } else {
      body = typedInputHTML({ placeholder: q.placeholder || 'Type your answer…' });
    }
    root.innerHTML = header() + html`<div class="q-card pop">${q.tag ? raw(html`<div class="prompt">${q.tag}</div>`) : ''}${raw(q.prompt)}${q.say ? raw(`<div class="mt">${speakBtn(q.say)}</div>`) : ''}</div>` + body + '<div data-feedback></div>';
    if (q.type !== 'mc') {
      const input = root.querySelector('[data-answer]');
      bindAccentBar(root, input);
      setTimeout(() => input.focus(), 50);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitTyped(); } });
      root.querySelector('[data-check]').addEventListener('click', submitTyped);
      root.querySelector('[data-check]').insertAdjacentHTML('afterend', '<button class="btn ghost block mt" data-skip>I don\'t know</button>');
      root.querySelector('[data-skip]').addEventListener('click', () => grade(false, '', q, ''));
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
    locked = true;
    haptic(ok ? 'success' : 'error');
    if (ok) state.correct++; else { state.wrong++; if (q.itemId) state.missed.push(q.itemId); }
    state.answers.push({ q, ok, given });
    if (q.itemId && record) {
      const pi = (state.perItem[q.itemId] ||= { ok: 0, ko: 0 });
      if (ok) pi.ok++; else pi.ko++;
      store.recordAnswer(q.itemId, ok, { quality: ok ? (res.accentIssue ? 3 : 4) : 1, xp: ok ? xpPer : 0 });
    }
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
      const chk = root.querySelector('[data-check]'); if (chk) chk.remove();
      const sk = root.querySelector('[data-skip]'); if (sk) sk.remove();
      if (!ok) input.classList.add('shake');
    }
    const answerText = Array.isArray(q.answer) ? q.answer[0] : (q.answer || (q.choices || []).find(c => c.correct)?.label || '');
    const fb = root.querySelector('[data-feedback]');
    fb.innerHTML = html`<div class="feedback ${ok ? 'ok' : 'ko'} pop">${ok ? (res.accentIssue ? '✓ Correct — mind the accent: ' + answerText : '✓ Correct!') : '✗ Not quite. Answer: ' + String(answerText).split('|')[0]}
      ${q.explain ? raw(`<div class="detail">${q.explain}</div>`) : ''}</div>
      <button class="btn ${ok ? 'primary' : 'accent'} block" data-next>${state.i + 1 >= total ? 'See results' : 'Continue'}</button>`;
    if (q.say && !ok) speak(q.say);
    fb.querySelector('[data-next]').addEventListener('click', next);
    if (ok && autoAdvance && q.type === 'mc') setTimeout(() => { if (locked && root.contains(fb)) next(); }, 700);
    if (ok && res.accentIssue) toast('Remember the accent: ' + String(answerText).split('|')[0]);
  }
  function next() { state.i++; renderQ(); }
  function finish() {
    const secs = Math.round((Date.now() - state.start) / 1000);
    const result = { gameId, title, total, correct: state.correct, wrong: state.wrong, score: total ? Math.round((state.correct / total) * 100) : 0, missed: [...new Set(state.missed)], secs, perItem: state.perItem, answers: state.answers };
    result.xp = state.correct * xpPer + (result.score === 100 && total >= 5 ? 10 : 0);
    if (record) store.recordGame(gameId, result);
    if (onDone) return onDone(result);
    showResults(root, result, opts);
  }
  renderQ();
  return { state };
}

export function showResults(root, result, opts = {}) {
  const { backHref = '#/games', onReplay = null, onPractice = null, passScore = null, extraHTML = '' } = opts;
  const passed = passScore == null ? null : result.score >= passScore;
  const emoji = result.score === 100 ? '🏆' : result.score >= 80 ? '🎉' : result.score >= 50 ? '👍' : '💪';
  const missed = result.missed.map(getEntry).filter(Boolean);
  root.innerHTML = html`<div class="result-hero pop">
      <div class="big">${emoji}</div>
      <h2>${result.score}%</h2>
      <p class="muted">${result.correct} of ${result.total} correct${result.secs ? ' · ' + result.secs + 's' : ''} · +${result.xp} XP</p>
      ${passed === true ? raw('<span class="badge ok">Passed</span>') : passed === false ? raw(html`<span class="badge">Score ${passScore}% or more to pass</span>`) : ''}
    </div>
    ${raw(extraHTML)}
    ${missed.length ? raw(`<div class="section"><div class="section-head"><h2>To review</h2></div><div class="list result-list">${missed.map(e => entryRow(e)).join('')}</div></div>`) : ''}
    <div class="sticky-actions">
      ${onPractice && missed.length ? raw('<button class="btn accent grow" data-practice>Practice missed</button>') : ''}
      ${onReplay ? raw('<button class="btn primary grow" data-replay>Play again</button>') : ''}
      <a class="btn ghost grow" href="${backHref}">Done</a>
    </div>`;
  if (onReplay) root.querySelector('[data-replay]')?.addEventListener('click', onReplay);
  if (onPractice) root.querySelector('[data-practice]')?.addEventListener('click', () => onPractice(missed));
  const xpEl = document.createElement('div'); xpEl.className = 'xp-float'; xpEl.textContent = `+${result.xp} XP`; document.body.append(xpEl); setTimeout(() => xpEl.remove(), 1000);
}

export function gameHeader(backHref, progress, scoreText) {
  return html`<div class="game-top"><a class="icon-btn" href="${backHref}" aria-label="Quit">✕</a><div class="bar"><div class="bar-fill" style="width:${progress}%"></div></div><div class="score">${scoreText}</div></div>`;
}
