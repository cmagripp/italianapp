// Hangman: guess the Italian word letter by letter from its English meaning.
import { html, raw, esc, haptic, speak } from '../ui.js';
import { store } from '../store.js';
import { shortEn, fold } from '../data.js';
import { showResults, gameHeader } from './engine.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const ACC = ['à', 'è', 'é', 'ì', 'ò', 'ù'];

function figure(miss) {
  const parts = [
    '<line x1="10" y1="110" x2="70" y2="110"/>', '<line x1="30" y1="110" x2="30" y2="10"/>', '<line x1="30" y1="10" x2="80" y2="10"/>', '<line x1="80" y1="10" x2="80" y2="25"/>',
    '<circle cx="80" cy="35" r="10"/>', '<line x1="80" y1="45" x2="80" y2="75"/>', '<line x1="80" y1="52" x2="65" y2="68"/>', '<line x1="80" y1="52" x2="95" y2="68"/>', '<line x1="80" y1="75" x2="68" y2="95"/>', '<line x1="80" y1="75" x2="92" y2="95"/>',
  ];
  return `<svg class="hang-fig" viewBox="0 0 120 120">${parts.slice(0, Math.min(miss, parts.length)).join('')}</svg>`;
}

export function startHangman(root, ctx) {
  const items = ctx.items.filter(e => /^[a-zàèéìòùú' ]+$/i.test(e.kind === 'verb' ? e.inf : e.it)).slice(0, 12);
  const total = items.length;
  let i = 0, correct = 0; const missed = []; const start = Date.now();
  const MAX = 8;

  function renderWord() {
    const e = items[i];
    if (!e) return finish();
    const word = (e.kind === 'verb' ? e.inf : e.it).toLowerCase();
    const guessed = new Set(); let miss = 0; let done = false;
    const hint = e.kind === 'verb' ? 'verb' : e.pos === 'noun' ? (e.g === 'mf' ? 'noun (m/f)' : e.g === 'f' ? 'feminine noun' : 'masculine noun') : e.pos;
    const isRevealed = (ch) => guessed.has(fold(ch)) || ch === ' ' || ch === "'";
    function draw() {
      root.innerHTML = gameHeader(ctx.backHref, Math.round((i / total) * 100), `${correct}/${total}`) + html`
        <div class="q-card"><div class="prompt">Guess the word</div><div class="big md">${shortEn(e.en)}</div><div class="sub">${hint} · ${word.replace(/[^a-zà-ú]/g, '').length} letters</div>
          ${raw(figure(miss))}
          <div class="hang-word">${raw(word.split('').map(ch => ch === ' ' ? '<span class="l space"></span>' : ch === "'" ? '<span class="l apos">\'</span>' : `<span class="l">${isRevealed(ch) || done ? esc(ch) : ''}</span>`).join(''))}</div>
          <div class="lives">${'❤️'.repeat(MAX - miss)}${'🖤'.repeat(miss)}</div>
        </div>
        <div class="keyboard">${raw(LETTERS.map(l => html`<button class="k ${guessed.has(l) ? 'used ' + (word.split('').some(ch => fold(ch) === l) ? 'hit' : 'miss') : ''}" data-l="${l}">${l}</button>`).join(''))}</div>
        <div data-feedback></div>`;
      root.querySelector('.keyboard').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-l]'); if (!b || done) return;
        const l = b.dataset.l;
        if (guessed.has(l)) return;
        guessed.add(l);
        const hit = word.split('').some(ch => fold(ch) === l);
        if (!hit) { miss++; haptic('error'); } else haptic('light');
        const allRevealed = word.split('').every(ch => isRevealed(ch));
        if (allRevealed || miss >= MAX) {
          done = true;
          const won = allRevealed;
          if (won) correct++; else missed.push(e.id);
          store.recordAnswer(e.id, won, { quality: won ? (miss <= 2 ? 5 : 4) : 1, xp: won ? 3 : 0 });
          draw();
          const fb = root.querySelector('[data-feedback]');
          fb.innerHTML = html`<div class="feedback ${won ? 'ok' : 'ko'} pop">${won ? '✓ ' + word : '✗ The word was: ' + word}<div class="detail">${e.ex || e.examples?.[0]?.it || ''}</div></div><button class="btn ${won ? 'primary' : 'accent'} block" data-next>${i + 1 >= total ? 'See results' : 'Next word'}</button>`;
          speak(word);
          fb.querySelector('[data-next]').addEventListener('click', () => { i++; renderWord(); });
        } else draw();
      });
    }
    draw();
  }
  function finish() {
    const result = { gameId: 'hangman', total, correct, wrong: total - correct, score: total ? Math.round((correct / total) * 100) : 0, missed, secs: Math.round((Date.now() - start) / 1000) };
    result.xp = correct * 3;
    store.recordGame('hangman', result);
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice });
  }
  if (!total) { root.innerHTML = '<div class="empty">No suitable words for hangman in this selection.</div>'; return; }
  renderWord();
}
