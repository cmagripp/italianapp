// Matching pairs: Italian ↔ English (or verb ↔ participle / infinitive ↔ conjugated form).
// Two columns of equal-height glass tiles; matched pairs dissolve, wrong pairs shake.
import { html, raw, esc, haptic, speak } from '../ui.js';
import { store } from '../store.js';
import { headword, shortEn, shuffle, fold } from '../data.js';
import { conjugate, primary, PERSONS, MISSING } from '../conjugator.js';
import { showResults, gameTop, pad2 } from './engine.js';
import fx from '../fx.js';

export function startMatching(root, ctx) {
  const mode = ctx.options?.mode || 'translate';
  const all = ctx.items.slice();
  const roundSize = 6;
  let r = 0, mistakes = 0, matched = 0; const missed = new Set(); const start = Date.now();
  const total = all.length;

  function pairFor(e) {
    if (e.kind === 'verb' && (mode === 'participle' || mode === 'conj')) {
      const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
      if (mode === 'participle') { const pp = primary(c.nonFinite.participioPassato); if (pp && pp !== MISSING) return [e.inf, pp]; }
      if (mode === 'conj') { const p = Math.floor(Math.random() * 6); const f = primary(c.tenses.presente[p]); if (f && f !== MISSING) return [`${e.inf} (${PERSONS[p]})`, f]; }
    }
    return [e.kind === 'verb' ? e.inf : headword(e), shortEn(e.en)];
  }
  // A round never shows the same text twice (three A1 words mean "you're welcome"): an item whose word or meaning is
  // already on the board waits for a later round, so every tile has exactly one partner.
  const pending = all.map(e => { const [a, b] = pairFor(e); return { e, a, b }; });
  const rounds = [];
  while (pending.length) {
    const round = []; const seenA = new Set(), seenB = new Set();
    for (let i = 0; i < pending.length && round.length < roundSize;) {
      const p = pending[i];
      if (seenA.has(fold(p.a)) || seenB.has(fold(p.b))) { i++; continue; }
      seenA.add(fold(p.a)); seenB.add(fold(p.b)); round.push(p); pending.splice(i, 1);
    }
    rounds.push(round);
  }
  function renderRound() {
    const pairs = rounds[r];
    if (!pairs) return finish();
    const items = pairs.map(p => p.e);
    const left = shuffle(pairs.map(p => ({ id: p.e.id, text: p.a })));
    const right = shuffle(pairs.map(p => ({ id: p.e.id, text: p.b })));
    root.innerHTML = gameTop(ctx.backHref, { i: matched, total, count: `${pad2(matched)} / ${pad2(total)}` }) + html`
      <div class="match-head"><span class="kicker">Round ${r + 1} / ${rounds.length}</span><span class="small muted">Tap a word, then its match.</span></div>
      <div class="match-grid" role="group" aria-label="Pairs">${raw(left.map((c, i) => html`<button type="button" class="m" data-side="a" data-id="${c.id}">${c.text}</button><button type="button" class="m" data-side="b" data-id="${right[i].id}">${right[i].text}</button>`).join(''))}</div>`;
    fx.mount(root);
    fx.mount(root.querySelector('.match-grid'), { stagger: 30 });
    let sel = null; let busy = false;
    root.querySelector('.match-grid').addEventListener('click', (ev) => {
      const b = ev.target.closest('.m'); if (!b || busy || b.classList.contains('done')) return;
      if (!sel) { sel = b; b.classList.add('sel'); return; }
      if (sel === b) { b.classList.remove('sel'); sel = null; return; }
      if (sel.dataset.side === b.dataset.side) { sel.classList.remove('sel'); sel = b; b.classList.add('sel'); return; }
      const ok = sel.dataset.id === b.dataset.id;
      const id = b.dataset.id;
      if (ok) {
        haptic('success');
        sel.classList.remove('sel'); sel.classList.add('done'); b.classList.add('done');
        sel.setAttribute('disabled', ''); b.setAttribute('disabled', '');
        matched++;
        const e = items.find(x => x.id === id);
        if (!missed.has(id)) store.recordAnswer(id, true, { quality: 4, xp: 2 }); else store.recordAnswer(id, false, { quality: 2 });
        if (e && mode === 'translate') speak(e.kind === 'verb' ? e.inf : e.it);
        sel = null;
        const top = root.querySelector('.game-top');
        if (top) top.outerHTML = gameTop(ctx.backHref, { i: matched, total, count: `${pad2(matched)} / ${pad2(total)}` });
        if (root.querySelectorAll('.m:not(.done)').length === 0) { busy = true; setTimeout(() => { r++; renderRound(); }, 520); }
      } else {
        haptic('error'); mistakes++; missed.add(sel.dataset.id); missed.add(id);
        const a = sel; a.classList.add('bad'); b.classList.add('bad');
        busy = true;
        setTimeout(() => { a.classList.remove('bad', 'sel'); b.classList.remove('bad'); busy = false; }, 420);
        sel = null;
      }
    });
  }
  function finish() {
    const correct = Math.max(0, total - missed.size);
    const result = { gameId: 'matching', total, correct, wrong: missed.size, score: total ? Math.round((correct / total) * 100) : 0, missed: [...missed], secs: Math.round((Date.now() - start) / 1000) };
    result.xp = correct * 2 + (mistakes === 0 && total >= 6 ? 10 : 0);
    // recordAnswer already awarded 2 XP per matched pair: the game record adds only the perfect-run bonus
    store.recordGame('matching', { ...result, xp: result.xp - correct * 2 });
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice, extraHTML: html`<p class="center results-line">${mistakes} wrong tap${mistakes === 1 ? '' : 's'}</p>` });
  }
  renderRound();
}
