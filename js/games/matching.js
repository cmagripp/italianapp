// Matching pairs: Italian ↔ English (or verb ↔ participle / infinitive ↔ conjugated form).
import { html, raw, esc, haptic, speak } from '../ui.js';
import { store } from '../store.js';
import { headword, shortEn, shuffle, pickN } from '../data.js';
import { conjugate, primary, PERSONS } from '../conjugator.js';
import { showResults, gameHeader } from './engine.js';

export function startMatching(root, ctx) {
  const mode = ctx.options?.mode || 'translate';
  const all = ctx.items.slice();
  const roundSize = 6;
  const rounds = [];
  for (let i = 0; i < all.length; i += roundSize) rounds.push(all.slice(i, i + roundSize));
  let r = 0, mistakes = 0, matched = 0; const missed = new Set(); const start = Date.now();
  const total = all.length;

  function pairFor(e) {
    if (mode === 'participle' && e.kind === 'verb') { const c = conjugate(e.inf, { aux: e.aux, isc: e.isc }); return [e.inf, primary(c.nonFinite.participioPassato)]; }
    if (mode === 'conj' && e.kind === 'verb') { const c = conjugate(e.inf, { aux: e.aux, isc: e.isc }); const p = Math.floor(Math.random() * 6); return [`${e.inf} (${PERSONS[p]})`, primary(c.tenses.presente[p])]; }
    return [e.kind === 'verb' ? e.inf : headword(e), shortEn(e.en)];
  }
  function renderRound() {
    const items = rounds[r];
    if (!items) return finish();
    const pairs = items.map(e => ({ e, ...(([a, b]) => ({ a, b }))(pairFor(e)) }));
    const left = shuffle(pairs.map(p => ({ id: p.e.id, text: p.a, side: 'a' })));
    const right = shuffle(pairs.map(p => ({ id: p.e.id, text: p.b, side: 'b' })));
    root.innerHTML = gameHeader(ctx.backHref, Math.round((matched / total) * 100), `${matched}/${total}`) + html`<p class="center muted small">Tap a word, then its match.</p>
      <div class="match-grid">${raw(left.map((c, i) => html`<button class="m" data-side="a" data-id="${c.id}">${c.text}</button><button class="m" data-side="b" data-id="${right[i].id}">${right[i].text}</button>`).join(''))}</div>`;
    let sel = null;
    root.querySelector('.match-grid').addEventListener('click', (ev) => {
      const b = ev.target.closest('.m'); if (!b || b.classList.contains('done')) return;
      if (!sel) { sel = b; b.classList.add('sel'); return; }
      if (sel === b) { b.classList.remove('sel'); sel = null; return; }
      if (sel.dataset.side === b.dataset.side) { sel.classList.remove('sel'); sel = b; b.classList.add('sel'); return; }
      const ok = sel.dataset.id === b.dataset.id;
      const id = b.dataset.id;
      if (ok) {
        haptic('success'); sel.classList.add('done'); b.classList.add('done'); sel.classList.remove('sel');
        matched++;
        const e = items.find(x => x.id === id);
        if (!missed.has(id)) store.recordAnswer(id, true, { quality: 4, xp: 2 }); else store.recordAnswer(id, false, { quality: 2 });
        if (e && mode === 'translate') speak(e.kind === 'verb' ? e.inf : e.it);
        sel = null;
        root.querySelector('.game-top .bar-fill').style.width = Math.round((matched / total) * 100) + '%';
        root.querySelector('.game-top .score').textContent = `${matched}/${total}`;
        if (root.querySelectorAll('.m:not(.done)').length === 0) setTimeout(() => { r++; renderRound(); }, 500);
      } else {
        haptic('error'); mistakes++; missed.add(sel.dataset.id); missed.add(id);
        const a = sel; a.classList.add('bad'); b.classList.add('bad');
        setTimeout(() => { a.classList.remove('bad', 'sel'); b.classList.remove('bad'); }, 400);
        sel = null;
      }
    });
  }
  function finish() {
    const correct = Math.max(0, total - missed.size);
    const result = { gameId: 'matching', total, correct, wrong: missed.size, score: total ? Math.round((correct / total) * 100) : 0, missed: [...missed], secs: Math.round((Date.now() - start) / 1000) };
    result.xp = correct * 2 + (mistakes === 0 && total >= 6 ? 10 : 0);
    store.recordGame('matching', result);
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice, extraHTML: html`<p class="center muted">${mistakes} wrong taps</p>` });
  }
  renderRound();
}
