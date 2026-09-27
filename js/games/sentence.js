// Sentence builder: reorder the shuffled words of an example sentence.
import { html, raw, esc, haptic, speak } from '../ui.js';
import { store } from '../store.js';
import { shuffle } from '../data.js';
import { showResults, gameHeader } from './engine.js';

function tokenize(s) { return s.replace(/([,.;:!?«»"])/g, ' $1 ').split(/\s+/).filter(Boolean); }

export function startSentence(root, ctx) {
  const items = ctx.items.map(e => { const ex = e.kind === 'verb' ? (e.examples || [])[Math.floor(Math.random() * (e.examples || []).length)] : (e.ex ? { it: e.ex, en: e.exEn } : null); return ex && tokenize(ex.it).length >= 3 && tokenize(ex.it).length <= 14 ? { e, ex } : null; }).filter(Boolean).slice(0, 10);
  const total = items.length;
  let i = 0, correct = 0; const missed = []; const start = Date.now();

  function render() {
    const cur = items[i];
    if (!cur) return finish();
    const tokens = tokenize(cur.ex.it);
    const words = tokens.filter(t => !/^[,.;:!?«»"]$/.test(t));
    const punct = tokens.filter(t => /^[,.;:!?«»"]$/.test(t));
    const bank = shuffle(words.map((w, idx) => ({ w, idx })));
    const chosen = [];
    function draw(state = '') {
      root.innerHTML = gameHeader(ctx.backHref, Math.round((i / total) * 100), `${correct}/${total}`) + html`
        <div class="q-card"><div class="prompt">Build the sentence</div><div class="big md">${cur.ex.en}</div><div class="sub tiny">${cur.e.kind === 'verb' ? cur.e.inf : cur.e.it} · tap the words in order</div></div>
        <div class="answer-area" data-answer>${raw(chosen.map(c => html`<button class="chip-word ${state}" data-rm="${c.idx}">${c.w}</button>`).join(''))}</div>
        <div class="bank-area">${raw(bank.map(c => html`<button class="chip-word ${chosen.includes(c) ? 'used' : ''}" data-add="${c.idx}">${c.w}</button>`).join(''))}</div>
        <div class="row gap mt"><button class="btn ghost grow" data-clear>Clear</button><button class="btn primary grow" data-check ${chosen.length !== words.length ? 'disabled' : ''}>Check</button></div>
        <div data-feedback></div>`;
      root.querySelector('.bank-area').addEventListener('click', (ev) => { const b = ev.target.closest('[data-add]'); if (!b) return; const c = bank.find(x => x.idx === Number(b.dataset.add)); if (c && !chosen.includes(c)) { chosen.push(c); draw(); } });
      root.querySelector('[data-answer]').addEventListener('click', (ev) => { const b = ev.target.closest('[data-rm]'); if (!b) return; const k = chosen.findIndex(x => x.idx === Number(b.dataset.rm)); if (k >= 0) { chosen.splice(k, 1); draw(); } });
      root.querySelector('[data-clear]').addEventListener('click', () => { chosen.length = 0; draw(); });
      root.querySelector('[data-check]').addEventListener('click', () => {
        const ok = chosen.every((c, k) => c.w === words[k]);
        haptic(ok ? 'success' : 'error');
        if (ok) correct++; else missed.push(cur.e.id);
        store.recordAnswer(cur.e.id, ok, { quality: ok ? 4 : 2, xp: ok ? 3 : 0 });
        draw(ok ? 'ok' : 'ko');
        root.querySelectorAll('.bank-area button, [data-check], [data-clear]').forEach(b => b.setAttribute('disabled', ''));
        const fb = root.querySelector('[data-feedback]');
        fb.innerHTML = html`<div class="feedback ${ok ? 'ok' : 'ko'} pop">${ok ? '✓ Perfetto!' : '✗ Correct order:'}<div class="detail">${cur.ex.it}</div></div><button class="btn ${ok ? 'primary' : 'accent'} block" data-next>${i + 1 >= total ? 'See results' : 'Next'}</button>`;
        speak(cur.ex.it);
        fb.querySelector('[data-next]').addEventListener('click', () => { i++; render(); });
      });
    }
    draw();
    void punct;
  }
  function finish() {
    const result = { gameId: 'sentence', total, correct, wrong: total - correct, score: total ? Math.round((correct / total) * 100) : 0, missed, secs: Math.round((Date.now() - start) / 1000) };
    result.xp = correct * 3;
    store.recordGame('sentence', result);
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice });
  }
  if (!total) { root.innerHTML = '<div class="empty">No example sentences available for this selection.</div>'; return; }
  render();
}
