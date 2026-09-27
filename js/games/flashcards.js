// Flashcards with self-grading (SRS quality 1–5).
import { html, raw, esc, speak, speakBtn, haptic } from '../ui.js';
import { store } from '../store.js';
import { headword, shortEn, withArticle, isPluralOnly } from '../data.js';
import { conjugate, primary } from '../conjugator.js';
import { showResults, gameHeader } from './engine.js';

export function startFlashcards(root, ctx) {
  const items = ctx.items.slice();
  const total = items.length;
  let i = 0, correct = 0; const missed = []; const start = Date.now();
  let flipped = false;
  const dir = ctx.options?.dir || 'it-en';

  function front(e) {
    if (dir === 'en-it') return html`<div class="en">${shortEn(e.en)}</div><div class="hint">${e.kind === 'verb' ? 'verb' : e.pos}${e.pos === 'noun' ? ' · ' + (e.g === 'mf' ? 'm/f' : e.g) : ''} · tap to flip</div>`;
    const w = e.kind === 'verb' ? e.inf : headword(e);
    return html`<div class="word ${w.length > 14 ? 'long' : ''}">${w}</div><div class="hint">tap to flip</div>`;
  }
  function back(e) {
    if (dir === 'en-it') {
      const w = e.kind === 'verb' ? e.inf : headword(e);
      return html`<div class="word ${w.length > 14 ? 'long' : ''}">${w}</div>${e.kind === 'word' && e.pos === 'noun' && e.pl && e.pl !== '-' && !isPluralOnly(e) ? raw(html`<div class="ex">pl. ${withArticle(e, true)}</div>`) : ''}<div class="ex">${e.kind === 'verb' ? (e.examples?.[0]?.it || '') : (e.ex || '')}</div>`;
    }
    const extra = e.kind === 'verb' ? html`<div class="ex">${e.aux} · ${primary(conjugate(e.inf, { aux: e.aux, isc: e.isc }).nonFinite.participioPassato)}</div><div class="ex">${e.examples?.[0]?.it || ''}<br><span class="muted">${e.examples?.[0]?.en || ''}</span></div>` : html`${e.pos === 'noun' && e.pl && e.pl !== '-' && !isPluralOnly(e) ? raw(html`<div class="ex">pl. ${withArticle(e, true)}</div>`) : ''}<div class="ex">${e.ex || ''}<br><span class="muted">${e.exEn || ''}</span></div>`;
    return html`<div class="en">${e.en}</div>${raw(extra)}`;
  }
  function render() {
    const e = items[i];
    if (!e) return finish();
    flipped = false;
    const say = e.kind === 'verb' ? e.inf : (e.pos === 'noun' && !isPluralOnly(e) ? withArticle(e) : e.it);
    root.innerHTML = gameHeader(ctx.backHref, Math.round((i / total) * 100), `${i + 1}/${total}`) + html`
      <div class="flash" data-flash><div class="inner">
        <div class="face front">${raw(front(e))}</div>
        <div class="face back">${raw(back(e))}</div>
      </div></div>
      <div class="row gap mb" style="justify-content:center">${raw(speakBtn(say, 'lg'))}<a class="btn sm ghost" href="#/entry/${encodeURIComponent(e.id)}">Details</a></div>
      <div class="grade" data-grade style="visibility:hidden">
        <button class="btn danger" data-q="1">Again<small>forgot</small></button>
        <button class="btn" data-q="3">Hard<small>barely</small></button>
        <button class="btn primary" data-q="4">Good<small>knew it</small></button>
        <button class="btn accent" data-q="5">Easy<small>instantly</small></button>
      </div>
      <p class="center tiny muted mt">Flip the card, then rate how well you knew it.</p>`;
    const card = root.querySelector('[data-flash]');
    card.addEventListener('click', () => { flipped = !flipped; card.classList.toggle('flipped', flipped); root.querySelector('[data-grade]').style.visibility = 'visible'; if (flipped && dir === 'en-it') speak(say); });
    root.querySelector('[data-grade]').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-q]'); if (!b) return;
      const q = Number(b.dataset.q);
      const ok = q >= 3;
      haptic(ok ? 'success' : 'error');
      store.recordAnswer(e.id, ok, { quality: q, xp: ok ? 2 : 0 });
      if (ok) correct++; else missed.push(e.id);
      i++; render();
    });
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
