// Speed round: answer as many multiple-choice questions as possible before the gold timer rail drains.
import { html, raw, esc, haptic, speak, speakBtn, icon } from '../ui.js';
import { store } from '../store.js';
import { shuffle, sample } from '../data.js';
import { qTranslateMC, qConjMC } from './questions.js';
import { showResults,gameActivityFence } from './engine.js';
import fx from '../fx.js';

export function startSpeed(root, ctx) {
  const items = shuffle(ctx.items);
  const pool = ctx.pool;
  const DURATION = Math.max(3, Number(ctx.options?.seconds) || 60);
  const verbsOnly = ctx.options?.mode === 'conj';
  let idx = 0, correct = 0, wrong = 0, streak = 0, best = 0, xpGiven = 0; const missed = new Set(); const answered = new Set();
  const start = Date.now(); let timer = null; let ended = false;
  const current=gameActivityFence(ctx.isActive);let nextTimer=null;
  const stop=()=>{ended=true;clearInterval(timer);clearTimeout(nextTimer);};

  function nextQ() {
    for (let tries = 0; tries < items.length; tries++) {
      const e = items[idx % items.length]; idx++;
      const q = verbsOnly && e.kind === 'verb'
        ? (qConjMC(e, sample(ctx.options?.tenses || ['presente', 'passatoProssimo', 'imperfetto', 'futuro']), pool) || qTranslateMC(e, pool))
        : qTranslateMC(e, pool, Math.random() < 0.5 ? 'it-en' : 'en-it');
      if (q) return q;
    }
    return null;
  }
  root.innerHTML = html`<div class="game-top"><a class="icon-btn" href="${ctx.backHref}" aria-label="Quit">${raw(icon('x', { size: 20 }))}</a><div class="rail-wrap"><div class="timer-rail" aria-hidden="true"><div class="fill" data-fill style="width:100%"></div></div><span class="rail-count timer" data-timer>${DURATION}s</span></div></div>
    <div class="speed-stats" aria-live="polite">
      <div class="ss ok"><span class="num" data-correct>0</span><span class="lab">correct</span></div>
      <div class="ss streak"><span class="num" data-streak>0</span><span class="lab">streak</span></div>
      <div class="ss ko"><span class="num" data-wrong>0</span><span class="lab">wrong</span></div>
    </div>
    <div class="speed-q" data-q></div>`;
  fx.mount(root);
  const qArea = root.querySelector('[data-q]');
  const fill = root.querySelector('[data-fill]');
  const timerEl = root.querySelector('[data-timer]');
  const stat = (sel, v) => { const el = root.querySelector(sel); if (el) el.textContent = String(v); };
  let firstQ = true;

  function render() {
    if (ended || !current()) return stop();
    clearTimeout(nextTimer);
    const q = nextQ();
    if (!q) return finish();
    const questionIndex=idx;let locked=false;
    qArea.innerHTML = html`<div class="q-card"><div class="prompt">${q.tag}</div>${raw(q.prompt)}</div>
      <div class="choices">${raw(q.choices.map((c, k) => html`<button type="button" class="choice center" data-c="${k}">${c.label}</button>`).join(''))}</div>`;
    // only the first question rises in: in a timed round the choices must not move after every answer
    if (firstQ) { fx.mount(qArea, { stagger: 30 }); firstQ = false; }
    qArea.querySelector('.choices').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-c]'); if (!b || b.disabled || ended || locked || !current() || idx!==questionIndex) return;
      locked=true;
      const c = q.choices[Number(b.dataset.c)];
      const ok = !!c.correct;
      haptic(ok ? 'success' : 'error');
      if (ok) { correct++; streak++; best = Math.max(best, streak); } else { wrong++; streak = 0; missed.add(q.itemId); }
      if (!answered.has(q.itemId)) { answered.add(q.itemId); store.recordAnswer(q.itemId, ok, { quality: ok ? 4 : 1, xp: ok ? 1 : 0 }); if (ok) xpGiven++; }
      stat('[data-correct]', correct); stat('[data-wrong]', wrong); stat('[data-streak]', streak);
      const sEl = root.querySelector('[data-streak]'); if (sEl && ok) fx.pulse(sEl.parentElement);
      qArea.querySelectorAll('[data-c]').forEach((x, k) => { x.setAttribute('disabled', ''); if (q.choices[k].correct) x.classList.add('correct'); else if (k === Number(b.dataset.c)) x.classList.add('wrong'); else x.classList.add('dim'); });
      if(q.say)speak(q.say);
      nextTimer=setTimeout(render, ok ? 260 : 700);
    });
  }
  const tick = () => {
    if(!current())return stop();
    const leftMs = Math.max(0, DURATION * 1000 - (Date.now() - start));
    const pct = (leftMs / (DURATION * 1000)) * 100;
    if (fill) { fill.style.width = pct.toFixed(1) + '%'; fill.classList.toggle('low', leftMs < 10000); }
    if (timerEl) timerEl.textContent = Math.ceil(leftMs / 1000) + 's';
    if (leftMs <= 0) finish();
  };
  timer = setInterval(tick, 100);
  function finish() {
    if (ended || !current()) return stop(); ended = true; clearInterval(timer);clearTimeout(nextTimer);
    const total = correct + wrong;
    const result = { gameId: 'speed', total, correct, wrong, score: total ? Math.round((correct / total) * 100) : 0, missed: [...missed], secs: DURATION };
    result.xp = correct + best * 2;
    // recordAnswer already awarded 1 XP per item first answered right: the game record adds the rest
    store.recordGame('speed', { ...result, xp: result.xp - xpGiven });
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice, extraHTML: html`<div class="grid3 mb speed-summary"><div class="stat"><div class="num">${correct}</div><div class="lab">correct</div></div><div class="stat"><div class="num gold">${best}</div><div class="lab">best streak</div></div><div class="stat"><div class="num">${total ? Math.round(DURATION / total * 10) / 10 : 0}s</div><div class="lab">per answer</div></div></div>` });
  }
  render();
  return stop;
}
