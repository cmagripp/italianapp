// Hangman: guess the Italian word letter by letter from its English meaning.
// Centred word slots, a minimal figure drawn stroke by stroke, gold life dots and a fixed keyboard dock.
import { html, raw, esc, haptic, speak, trBlock } from '../ui.js';
import { store } from '../store.js';
import { shortEn, fold } from '../data.js';
import { showResults, gameTop, keyboardHTML, mountDock, feedbackHTML } from './engine.js';
import fx from '../fx.js';

// gallows (4 strokes) then the figure (4 strokes) — one part per miss, 8 lives.
const PARTS = [
  { d: 'M14 122H74' }, { d: 'M30 122V12' }, { d: 'M30 12H82' }, { d: 'M82 12V26' },
  { circle: [82, 38, 11] }, { d: 'M82 49V84' }, { d: 'M82 58L66 74M82 58L98 74' }, { d: 'M82 84L70 106M82 84L94 106' },
];
const MAX = PARTS.length;
// The gallows is pre-drawn as a faint ghost (so the card is not empty before the first miss); each miss draws a part on top.
const figureSVG = () => `<svg class="hang-fig" viewBox="0 0 120 130" aria-hidden="true">${PARTS.slice(0, 4).map(p => `<path class="ghost" d="${p.d}"/>`).join('')}${PARTS.map((p, k) => p.circle
  ? `<circle class="part figure" data-part="${k}" cx="${p.circle[0]}" cy="${p.circle[1]}" r="${p.circle[2]}" pathLength="100"/>`
  : `<path class="part ${k >= 4 ? 'figure' : ''}" data-part="${k}" d="${p.d}" pathLength="100"/>`).join('')}</svg>`;

export function startHangman(root, ctx) {
  const wordOf = (e) => (e.kind === 'verb' ? e.inf : e.it).toLowerCase();
  const items = ctx.items.filter(e => /^[a-zàèéìòùú' ]+$/i.test(wordOf(e))).slice(0, 12);
  const total = items.length;
  let i = 0, correct = 0; const missed = []; const start = Date.now();
  let dead = false, finished = false;
  let dock = null; let onKey = null;
  const destroyDock = () => { if (dock) { dock.destroy(); dock = null; } if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; } };

  function renderWord() {
    if (dead || finished) return;
    destroyDock();
    const e = items[i];
    if (!e) return finish();
    const word = wordOf(e);
    const letters = word.split('');
    const guessed = new Set(); let miss = 0; let done = false; let continued = false;
    const wordIndex = i;
    const hint = e.kind === 'verb' ? 'verb' : e.pos === 'noun' ? (e.g === 'mf' ? 'noun (m/f)' : e.g === 'f' ? 'feminine noun' : 'masculine noun') : e.pos;
    const nLetters = letters.filter(ch => /[a-zà-ú]/.test(ch)).length;
    const lw = Math.max(18, Math.min(30, Math.floor((Math.min(window.innerWidth || 390, 720) - 32 - 40 - (letters.length - 1) * 5) / letters.length)));
    root.innerHTML = gameTop(ctx.backHref, { i, total }) + html`
      <div class="q-card hang-card">
        <div class="prompt">Guess the word · ${e.kind === 'verb' ? 'verbo' : (e.pos === 'noun' ? 'nome' : e.pos)}</div>
        <div class="big md">${shortEn(e.en)}</div>
        <div class="sub">${hint} · ${nLetters} letters</div>
        ${raw(figureSVG())}
        <div class="hang-word" style="--lw:${lw}px" data-word aria-label="Word">${raw(letters.map((ch, k) => ch === ' ' ? '<span class="l space"></span>' : ch === "'" ? '<span class="l apos">\'</span>' : `<span class="l" data-k="${k}"></span>`).join(''))}</div>
        <div class="lives" data-lives aria-label="Lives">${raw(Array.from({ length: MAX }, () => '<span class="dot gold"></span>').join(''))}</div>
      </div>`;
    fx.mount(root);
    dock = mountDock(root, keyboardHTML());
    const parts = [...root.querySelectorAll('.hang-fig .part')];
    const dots = [...root.querySelectorAll('[data-lives] .dot')];
    const slots = [...root.querySelectorAll('.hang-word .l[data-k]')];
    const revealed = (ch) => guessed.has(fold(ch)) || ch === ' ' || ch === "'";

    function press(l) {
      if (dead || finished || i !== wordIndex || done || guessed.has(l) || !/^[a-z]$/.test(l)) return;
      guessed.add(l);
      const hit = letters.some(ch => fold(ch) === l);
      const key = dock.el.querySelector(`.k[data-l="${l}"]`);
      if (key) { key.classList.add('used', hit ? 'hit' : 'miss'); key.setAttribute('disabled', ''); }
      if (hit) {
        haptic('light');
        slots.forEach(s => { const ch = letters[Number(s.dataset.k)]; if (fold(ch) === l && !s.textContent) { s.textContent = ch; s.classList.add('in'); } });
      } else {
        miss++; haptic('error');
        const part = parts[miss - 1]; if (part) part.classList.add('on');
        const dot = dots[MAX - miss]; if (dot) dot.classList.add('lost');
        fx.shake(root.querySelector('[data-word]'));
      }
      const allRevealed = letters.every(revealed);
      if (allRevealed || miss >= MAX) end(allRevealed);
    }
    function end(won) {
      if (dead || finished || done || i !== wordIndex) return;
      done = true;
      const top = root.querySelector('.game-top');
      if (top) top.outerHTML = gameTop(ctx.backHref, { i, total, completed: i + 1 });
      if (won) correct++; else missed.push(e.id);
      store.recordAnswer(e.id, won, { quality: won ? (miss <= 2 ? 5 : 4) : 1, xp: won ? 3 : 0 });
      slots.forEach(s => { const ch = letters[Number(s.dataset.k)]; if (!s.textContent) { s.textContent = ch; s.classList.add('miss'); } });
      const exIt = e.kind === 'verb' ? (e.examples?.[0]?.it || '') : (e.ex || '');
      const exEn = e.kind === 'verb' ? (e.examples?.[0]?.en || '') : (e.exEn || '');
      dock.set(feedbackHTML({
        ok: won,
        title: won ? `<span class="fb-word">${esc(word)}</span>` : `The word was <span class="fb-word">${esc(word)}</span>`,
        detail: exIt ? trBlock(exIt, exEn) : esc(shortEn(e.en)),
        nextLabel: i + 1 >= total ? 'See results' : 'Continue',
        say: word,
      }));
      speak(word);
      const next = dock.el.querySelector('[data-next]');
      next.addEventListener('click', () => {
        if (dead || finished || continued || i !== wordIndex) return;
        continued = true; next.disabled = true; i++; renderWord();
      });
      next.focus({ preventScroll: true });
    }
    dock.el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-l]'); if (b) press(b.dataset.l); });
    onKey = (ev) => {
      if (dead || !root.contains(slots[0] || root)) { destroyDock(); return; }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (/^[a-zA-Z]$/.test(ev.key)) { press(ev.key.toLowerCase()); ev.preventDefault(); }
      else if (ev.key === 'Enter' && done) { ev.preventDefault(); dock.el?.querySelector('[data-next]')?.click(); }
    };
    document.addEventListener('keydown', onKey);
  }
  function finish() {
    if (dead || finished) return;
    finished = true;
    destroyDock();
    const result = { gameId: 'hangman', total, correct, wrong: total - correct, score: total ? Math.round((correct / total) * 100) : 0, missed, secs: Math.round((Date.now() - start) / 1000) };
    result.xp = correct * 3;
    // recordAnswer already awarded 3 XP per solved word: the game record adds nothing more
    store.recordGame('hangman', { ...result, xp: 0 });
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice });
  }
  if (!total) { root.innerHTML = html`<div class="empty"><p>No suitable words for hangman in this selection.</p><a class="btn primary" href="${ctx.backHref}">Choose another source</a></div>`; return; }
  renderWord();
  return () => { dead = true; destroyDock(); };
}
