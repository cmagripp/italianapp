// Flashcards with self-grading (SRS quality 1–5): 3D flip glass card over a peeking deck, four-button rate bar,
// optional swipe (left = Again, right = Good) once the card is flipped.
import { html, raw, esc, speak, speakBtn, haptic } from '../ui.js';
import { store } from '../store.js';
import { headword, shortEn, withArticle, isPluralOnly } from '../data.js';
import { conjugate, primary, MISSING } from '../conjugator.js';
import { showResults, gameTop } from './engine.js';
import fx from '../fx.js';

export function startFlashcards(root, ctx) {
  const items = ctx.items.slice();
  const total = items.length;
  let i = 0, correct = 0; const missed = []; const start = Date.now();
  let flipped = false;
  const dir = ctx.options?.dir || 'it-en';

  const kicker = (e) => `${e.level || 'A1'} · ${e.kind === 'verb' ? 'verbo' : e.pos}${e.pos === 'noun' ? ' · ' + (e.g === 'mf' ? 'm/f' : e.g) : ''}`;
  function front(e) {
    const w = e.kind === 'verb' ? e.inf : headword(e);
    const ghost = html`<span class="ghost" aria-hidden="true">${(e.kind === 'verb' ? e.inf : e.it || w).slice(0, 1)}</span>`;
    if (dir === 'en-it') return html`${raw(ghost)}<div class="fc-kicker kicker">${kicker(e)}</div><div class="en">${shortEn(e.en)}</div><div class="hint">tap to flip</div>`;
    return html`${raw(ghost)}<div class="fc-kicker kicker">${kicker(e)}</div><div class="word ${w.length > 14 ? 'long' : w.length > 9 ? 'mid' : ''}">${w}</div><div class="hint">tap to flip</div>`;
  }
  function back(e) {
    const plural = e.kind === 'word' && e.pos === 'noun' && e.pl && e.pl !== '-' && !isPluralOnly(e) ? html`<div class="ex">pl. ${withArticle(e, true)}</div>` : '';
    if (dir === 'en-it') {
      const w = e.kind === 'verb' ? e.inf : headword(e);
      return html`<div class="word ${w.length > 14 ? 'long' : ''}">${w}</div>${raw(plural)}<div class="ex">${e.kind === 'verb' ? (e.examples?.[0]?.it || '') : (e.ex || '')}</div>`;
    }
    let extra;
    if (e.kind === 'verb') {
      const pp = primary(conjugate(e.inf, { aux: e.aux, isc: e.isc }).nonFinite.participioPassato);
      extra = html`<div class="ex mono-line">${e.aux}${pp && pp !== MISSING ? ' · ' + pp : ''}</div><div class="ex">${e.examples?.[0]?.it || ''}<br><span class="muted">${e.examples?.[0]?.en || ''}</span></div>`;
    } else extra = html`${raw(plural)}<div class="ex">${e.ex || ''}<br><span class="muted">${e.exEn || ''}</span></div>`;
    return html`<div class="en">${e.en}</div>${raw(extra)}`;
  }
  function render() {
    const e = items[i];
    if (!e) return finish();
    flipped = false;
    const say = e.kind === 'verb' ? e.inf : (e.pos === 'noun' && !isPluralOnly(e) ? withArticle(e) : e.it);
    root.innerHTML = gameTop(ctx.backHref, { i, total }) + html`
      <div class="flash" data-flash role="button" tabindex="0" aria-label="Flashcard, tap to flip" style="--fc:var(--lvl-${e.level || 'A1'})">
        <span class="swipe-tag left" aria-hidden="true">Again</span><span class="swipe-tag right" aria-hidden="true">Good</span>
        <div class="inner">
          <div class="face front">${raw(front(e))}</div>
          <div class="face back">${raw(back(e))}</div>
        </div>
      </div>
      <div class="flash-tools">${raw(speakBtn(say, 'lg'))}<a class="btn sm ghost" href="#/entry/${encodeURIComponent(e.id)}">Details</a></div>
      <div class="grade" data-grade style="visibility:hidden" role="group" aria-label="How well did you know it?">
        <button type="button" class="btn secondary" data-q="1">Again<small>forgot</small></button>
        <button type="button" class="btn secondary" data-q="3">Hard<small>barely</small></button>
        <button type="button" class="btn secondary" data-q="4">Good<small>knew it</small></button>
        <button type="button" class="btn secondary" data-q="5">Easy<small>instantly</small></button>
      </div>
      <p class="flash-hint kicker" data-hint-line>Flip the card, then rate how well you knew it</p>`;
    fx.mount(root);
    const card = root.querySelector('[data-flash]');
    const gradeBar = root.querySelector('[data-grade]');
    const hintLine = root.querySelector('[data-hint-line]');
    let graded = false;
    function flip() {
      flipped = !flipped;
      card.classList.toggle('flipped', flipped);
      gradeBar.style.visibility = 'visible';
      hintLine.textContent = 'Rate it — or swipe left for Again, right for Good';
      if (flipped && dir === 'en-it') speak(say);
    }
    function grade(q, { delay = 0 } = {}) {
      if (graded) return; graded = true;
      const ok = q >= 3;
      haptic(ok ? 'success' : 'error');
      store.recordAnswer(e.id, ok, { quality: q, xp: ok ? 2 : 0 });
      if (ok) correct++; else missed.push(e.id);
      i++;
      if (delay) setTimeout(render, delay); else render();
    }
    gradeBar.addEventListener('click', (ev) => { const b = ev.target.closest('[data-q]'); if (b) grade(Number(b.dataset.q)); });
    card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); flip(); } });

    // tap = flip; horizontal swipe (after the flip) = grade
    let pid = null, sx = 0, sy = 0, dx = 0, moved = false;
    const reduced = fx.reducedMotion();
    card.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      pid = ev.pointerId; sx = ev.clientX; sy = ev.clientY; dx = 0; moved = false;
      card.classList.add('dragging');
      try { card.setPointerCapture(pid); } catch { /* ignore */ }
    });
    card.addEventListener('pointermove', (ev) => {
      if (pid === null || ev.pointerId !== pid) return;
      dx = ev.clientX - sx; const dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) moved = true;
      if (!moved || !flipped) return;
      card.style.transform = `translateX(${dx}px) rotate(${(dx / 22).toFixed(2)}deg)`;
      card.dataset.swipe = dx > 40 ? 'right' : dx < -40 ? 'left' : '';
    });
    const up = (ev) => {
      if (pid === null || ev.pointerId !== pid) return;
      pid = null; card.classList.remove('dragging');
      const swiped = moved && flipped && Math.abs(dx) > 90;
      if (swiped) {
        card.style.transform = `translateX(${dx > 0 ? 140 : -140}%) rotate(${dx > 0 ? 18 : -18}deg)`;
        card.style.opacity = '0';
        grade(dx > 0 ? 4 : 1, { delay: reduced ? 0 : 260 });
      } else { card.style.transform = ''; card.dataset.swipe = ''; }
      setTimeout(() => { moved = false; }, 0);
    };
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
    card.addEventListener('click', () => { if (moved || graded) return; flip(); });
    if (dir === 'it-en') speak(say);
  }
  function finish() {
    const result = { gameId: 'flashcards', total, correct, wrong: total - correct, score: total ? Math.round((correct / total) * 100) : 0, missed, secs: Math.round((Date.now() - start) / 1000) };
    result.xp = correct * 2;
    store.recordGame('flashcards', result);
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice });
  }
  render();
}
