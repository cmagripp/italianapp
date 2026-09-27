// Speed round: answer as many multiple-choice questions as possible before the timer runs out.
import { html, raw, esc, haptic, speak } from '../ui.js';
import { store } from '../store.js';
import { shuffle, sample } from '../data.js';
import { qTranslateMC, qConjMC, DRILL_TENSES } from './questions.js';
import { showResults } from './engine.js';

export function startSpeed(root, ctx) {
  const items = shuffle(ctx.items);
  const pool = ctx.pool;
  const DURATION = ctx.options?.seconds || 60;
  const verbsOnly = ctx.options?.mode === 'conj';
  let idx = 0, correct = 0, wrong = 0, streak = 0, best = 0; const missed = new Set(); const answered = new Set();
  const start = Date.now(); let timer = null; let ended = false;

  function nextQ() {
    const e = items[idx % items.length]; idx++;
    if (verbsOnly && e.kind === 'verb') return qConjMC(e, sample(ctx.options?.tenses || ['presente', 'passatoProssimo', 'imperfetto', 'futuro']), pool) || qTranslateMC(e, pool);
    return qTranslateMC(e, pool, Math.random() < 0.5 ? 'it-en' : 'en-it');
  }
  function render() {
    if (ended) return;
    const q = nextQ();
    const left = Math.max(0, DURATION - Math.floor((Date.now() - start) / 1000));
    root.innerHTML = html`<div class="game-top"><a class="icon-btn" href="${ctx.backHref}">✕</a><div class="bar timer-bar"><div class="bar-fill" style="width:${Math.round((left / DURATION) * 100)}%"></div></div><div class="score timer" data-timer>${left}s</div></div>
      <div class="row between mb"><span class="badge ok">✓ ${correct}</span><span class="badge">streak ${streak}</span><span class="badge">✗ ${wrong}</span></div>
      <div class="q-card pop"><div class="prompt">${q.tag}</div>${raw(q.prompt)}</div>
      <div class="choices">${raw(q.choices.map((c, k) => html`<button class="choice center" data-c="${k}">${c.label}</button>`).join(''))}</div>`;
    root.querySelector('.choices').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-c]'); if (!b || ended) return;
      const c = q.choices[Number(b.dataset.c)];
      const ok = !!c.correct;
      haptic(ok ? 'success' : 'error');
      if (ok) { correct++; streak++; best = Math.max(best, streak); } else { wrong++; streak = 0; missed.add(q.itemId); }
      if (!answered.has(q.itemId)) { answered.add(q.itemId); store.recordAnswer(q.itemId, ok, { quality: ok ? 4 : 1, xp: ok ? 1 : 0 }); }
      root.querySelectorAll('[data-c]').forEach((x, k) => { x.setAttribute('disabled', ''); if (q.choices[k].correct) x.classList.add('correct'); else if (k === Number(b.dataset.c)) x.classList.add('wrong'); });
      setTimeout(render, ok ? 250 : 700);
    });
  }
  timer = setInterval(() => {
    const left = Math.max(0, DURATION - Math.floor((Date.now() - start) / 1000));
    const t = root.querySelector('[data-timer]'); if (t) t.textContent = left + 's';
    const bar = root.querySelector('.timer-bar .bar-fill'); if (bar) bar.style.width = Math.round((left / DURATION) * 100) + '%';
    if (left <= 0) finish();
  }, 250);
  function finish() {
    if (ended) return; ended = true; clearInterval(timer);
    const total = correct + wrong;
    const result = { gameId: 'speed', total, correct, wrong, score: total ? Math.round((correct / total) * 100) : 0, missed: [...missed], secs: DURATION };
    result.xp = correct + best * 2;
    store.recordGame('speed', result);
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice, extraHTML: html`<div class="grid3 mb"><div class="stat"><div class="num">${correct}</div><div class="lab">correct</div></div><div class="stat"><div class="num">${best}</div><div class="lab">best streak</div></div><div class="stat"><div class="num">${total ? Math.round(DURATION / total * 10) / 10 : 0}s</div><div class="lab">per answer</div></div></div>` });
  }
  render();
  return () => { ended = true; clearInterval(timer); };
}
