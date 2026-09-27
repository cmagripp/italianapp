// Sentence builder: reorder the shuffled words of an example sentence. Chips fly between the bank and the answer line.
import { html, raw, esc, haptic, speak, trBlock } from '../ui.js';
import { store } from '../store.js';
import { shuffle } from '../data.js';
import { showResults, gameTop, feedbackHTML } from './engine.js';
import fx from '../fx.js';

const PUNCT = /^[,.;:!?«»"]$/;
function tokenize(s) { return s.replace(/([,.;:!?«»"])/g, ' $1 ').split(/\s+/).filter(Boolean); }

// A fixed clone that glides from one rect to another, then calls done().
function glide(fromEl, fromRect, toRect, done) {
  if (fx.reducedMotion()) { done(); return; }
  const c = fromEl.cloneNode(true);
  c.classList.add('chip-fly'); c.classList.remove('used');
  c.removeAttribute('data-add'); c.removeAttribute('data-rm'); c.setAttribute('aria-hidden', 'true');
  c.style.left = `${fromRect.left}px`; c.style.top = `${fromRect.top}px`; c.style.width = `${fromRect.width}px`; c.style.height = `${fromRect.height}px`;
  document.body.append(c);
  c.getBoundingClientRect();
  c.style.transform = `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px)`;
  let finished = false;
  const end = () => { if (finished) return; finished = true; c.remove(); done(); };
  c.addEventListener('transitionend', end, { once: true });
  setTimeout(end, 480);
}

export function startSentence(root, ctx) {
  const items = ctx.items.map(e => { const exs = e.kind === 'verb' ? (e.examples || []) : (e.ex ? [{ it: e.ex, en: e.exEn }] : []); const ex = exs[Math.floor(Math.random() * exs.length)]; const n = ex ? tokenize(ex.it).filter(t => !PUNCT.test(t)).length : 0; return ex && n >= 3 && n <= 14 ? { e, ex } : null; }).filter(Boolean).slice(0, 10);
  const total = items.length;
  let i = 0, correct = 0; const missed = []; const start = Date.now();

  function render() {
    const cur = items[i];
    if (!cur) return finish();
    const words = tokenize(cur.ex.it).filter(t => !PUNCT.test(t));
    const bank = shuffle(words.map((w, idx) => ({ w, idx })));
    const chosen = [];
    const target = cur.e.kind === 'verb' ? cur.e.inf : cur.e.it;
    root.innerHTML = gameTop(ctx.backHref, { i, total }) + html`
      <div class="q-card"><div class="prompt">Build the sentence</div><div class="big md">${cur.ex.en}</div><div class="sub">${target} · tap the words in order</div></div>
      <div class="answer-area" data-answer aria-label="Your sentence"></div>
      <div class="bank-area" data-bank aria-label="Word bank">${raw(bank.map(c => html`<button type="button" class="chip-word" data-add="${c.idx}">${c.w}</button>`).join(''))}</div>
      <div class="row gap mt sb-actions"><button type="button" class="btn ghost grow" data-clear>Clear</button><button type="button" class="btn primary grow" data-check disabled>Check</button></div>
      <div data-feedback></div>`;
    fx.mount(root);
    const answer = root.querySelector('[data-answer]');
    const bankEl = root.querySelector('[data-bank]');
    const checkBtn = root.querySelector('[data-check]');
    let done = false;
    const sync = () => { if (chosen.length === words.length) checkBtn.removeAttribute('disabled'); else checkBtn.setAttribute('disabled', ''); };

    function add(c) {
      if (done || chosen.includes(c)) return;
      const src = bankEl.querySelector(`[data-add="${c.idx}"]`);
      const from = src.getBoundingClientRect();
      src.classList.add('used'); src.setAttribute('aria-hidden', 'true');
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip-word landing'; chip.dataset.rm = String(c.idx); chip.textContent = c.w;
      answer.append(chip);
      chosen.push(c);
      glide(src, from, chip.getBoundingClientRect(), () => chip.classList.remove('landing'));
      haptic('light');
      sync();
    }
    function remove(c) {
      if (done) return;
      const k = chosen.indexOf(c); if (k < 0) return;
      const chip = answer.querySelector(`[data-rm="${c.idx}"]`);
      const src = bankEl.querySelector(`[data-add="${c.idx}"]`);
      const from = chip.getBoundingClientRect();
      chosen.splice(k, 1); chip.remove();
      src.classList.add('landing');
      glide(chip, from, src.getBoundingClientRect(), () => { src.classList.remove('used', 'landing'); src.removeAttribute('aria-hidden'); });
      sync();
    }
    bankEl.addEventListener('click', (ev) => { const b = ev.target.closest('[data-add]'); if (!b || b.classList.contains('used')) return; const c = bank.find(x => x.idx === Number(b.dataset.add)); if (c) add(c); });
    answer.addEventListener('click', (ev) => { const b = ev.target.closest('[data-rm]'); if (!b) return; const c = bank.find(x => x.idx === Number(b.dataset.rm)); if (c) remove(c); });
    root.querySelector('[data-clear]').addEventListener('click', () => { for (const c of chosen.slice().reverse()) remove(c); });
    checkBtn.addEventListener('click', () => {
      if (done || chosen.length !== words.length) return;
      done = true;
      const ok = chosen.every((c, k) => c.w === words[k]);
      haptic(ok ? 'success' : 'error');
      if (ok) correct++; else missed.push(cur.e.id);
      store.recordAnswer(cur.e.id, ok, { quality: ok ? 4 : 2, xp: ok ? 3 : 0 });
      chosen.forEach((c, k) => { const chip = answer.querySelector(`[data-rm="${c.idx}"]`); if (chip) chip.classList.add(c.w === words[k] ? 'ok' : 'ko'); });
      if (!ok) fx.shake(answer);
      root.querySelectorAll('.bank-area button, [data-check], [data-clear]').forEach(b => b.setAttribute('disabled', ''));
      const fb = root.querySelector('[data-feedback]');
      fb.innerHTML = feedbackHTML({ ok, title: ok ? 'Perfetto!' : 'Not quite — the sentence is', detail: trBlock(cur.ex.it, cur.ex.en), nextLabel: i + 1 >= total ? 'See results' : 'Next', say: cur.ex.it });
      speak(cur.ex.it);
      fb.querySelector('[data-next]').addEventListener('click', () => { i++; render(); });
    });
  }
  function finish() {
    const result = { gameId: 'sentence', total, correct, wrong: total - correct, score: total ? Math.round((correct / total) * 100) : 0, missed, secs: Math.round((Date.now() - start) / 1000) };
    result.xp = correct * 3;
    // recordAnswer already awarded 3 XP per correct sentence: the game record adds nothing more
    store.recordGame('sentence', { ...result, xp: 0 });
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice });
  }
  if (!total) { root.innerHTML = html`<div class="empty"><p>No example sentences available for this selection.</p><a class="btn primary" href="${ctx.backHref}">Choose another source</a></div>`; return; }
  render();
}
