// Crossword: auto-generated grid from Italian words, clued in English.
import { html, raw, esc, haptic, toast, speak } from '../ui.js';
import { store } from '../store.js';
import { shortEn, fold, shuffle } from '../data.js';
import { showResults, gameHeader } from './engine.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

function buildGrid(words) {
  // words: [{ text (folded, letters only), clue, id }]
  const size = 15;
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const placed = [];
  const can = (w, r, c, dir) => {
    const dr = dir === 'a' ? 0 : 1, dc = dir === 'a' ? 1 : 0;
    if (r < 0 || c < 0 || r + dr * (w.length - 1) >= size || c + dc * (w.length - 1) >= size) return false;
    // cell before / after must be empty
    const br = r - dr, bc = c - dc, ar = r + dr * w.length, ac = c + dc * w.length;
    if (br >= 0 && bc >= 0 && grid[br][bc]) return false;
    if (ar < size && ac < size && grid[ar][ac]) return false;
    let crosses = 0;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      const cell = grid[rr][cc];
      if (cell) { if (cell !== w[i]) return false; crosses++; continue; }
      // neighbours perpendicular must be empty
      const n1r = rr + dc, n1c = cc + dr, n2r = rr - dc, n2c = cc - dr;
      if (n1r < size && n1c < size && grid[n1r][n1c]) return false;
      if (n2r >= 0 && n2c >= 0 && grid[n2r][n2c]) return false;
    }
    return crosses > 0 || placed.length === 0;
  };
  const put = (w, r, c, dir, meta) => {
    const dr = dir === 'a' ? 0 : 1, dc = dir === 'a' ? 1 : 0;
    for (let i = 0; i < w.length; i++) grid[r + dr * i][c + dc * i] = w[i];
    placed.push({ ...meta, text: w, r, c, dir });
  };
  const sorted = words.slice().sort((a, b) => b.text.length - a.text.length);
  const first = sorted.shift();
  put(first.text, 7, Math.max(0, Math.floor((size - first.text.length) / 2)), 'a', first);
  let remaining = sorted;
  for (let pass = 0; pass < 3 && remaining.length; pass++) {
    const left = [];
    for (const w of remaining) {
      let done = false;
      const cands = [];
      for (const p of placed) {
        for (let i = 0; i < w.text.length && !done; i++) {
          for (let j = 0; j < p.text.length; j++) {
            if (w.text[i] !== p.text[j]) continue;
            const dir = p.dir === 'a' ? 'd' : 'a';
            const r = p.dir === 'a' ? p.r - i : p.r + j;
            const c = p.dir === 'a' ? p.c + j : p.c - i;
            if (can(w.text, r, c, dir)) cands.push([r, c, dir]);
          }
        }
      }
      if (cands.length) { const [r, c, dir] = cands[Math.floor(Math.random() * cands.length)]; put(w.text, r, c, dir, w); done = true; }
      if (!done) left.push(w);
    }
    remaining = left;
  }
  // crop
  let minR = size, maxR = -1, minC = size, maxC = -1;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (grid[r][c]) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const g = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => grid[r + minR][c + minC]));
  for (const p of placed) { p.r -= minR; p.c -= minC; }
  // numbering
  placed.sort((a, b) => a.r - b.r || a.c - b.c);
  let n = 0; const numAt = {};
  for (const p of placed) { const k = `${p.r},${p.c}`; if (!numAt[k]) numAt[k] = ++n; p.num = numAt[k]; }
  return { grid: g, rows, cols, placed, numAt, unplaced: remaining };
}

export function startCrossword(root, ctx) {
  const cands = ctx.items.map(e => { const raw = e.kind === 'verb' ? e.inf : e.it; const text = fold(raw).replace(/[^a-z]/g, ''); return text.length >= 3 && text.length <= 9 && !raw.includes(' ') ? { text, clue: shortEn(e.en), id: e.id, orig: raw, e } : null; }).filter(Boolean);
  const words = shuffle(cands).slice(0, 10);
  if (words.length < 3) { root.innerHTML = '<div class="empty">Need at least 3 single words for a crossword.</div>'; return; }
  let best = null;
  for (let t = 0; t < 6; t++) { const b = buildGrid(shuffle(words)); if (!best || b.placed.length > best.placed.length) best = b; if (best.placed.length === words.length) break; }
  const { grid, rows, cols, placed, numAt } = best;
  const entered = Array.from({ length: rows }, () => Array(cols).fill(''));
  let cur = placed[0]; let pos = 0; let finished = false; const start = Date.now();
  const cellsOf = (p) => Array.from({ length: p.text.length }, (_, i) => [p.r + (p.dir === 'd' ? i : 0), p.c + (p.dir === 'a' ? i : 0)]);
  const wordsAt = (r, c) => placed.filter(p => cellsOf(p).some(([rr, cc]) => rr === r && cc === c));

  function draw() {
    const sel = new Set(cellsOf(cur).map(([r, c]) => `${r},${c}`));
    const [cr, cc] = cellsOf(cur)[pos] || [];
    const cell = Math.max(24, Math.min(40, Math.floor((Math.min(window.innerWidth, 720) - 36) / cols)));
    root.innerHTML = gameHeader(ctx.backHref, 0, `${placed.length} words`) + html`
      <div class="cw-wrap"><div class="cw" style="grid-template-columns:repeat(${cols},${cell}px);--cell:${cell}px">${raw(grid.map((row, r) => row.map((ch, c) => {
        if (!ch) return '<div class="c black"></div>';
        const k = `${r},${c}`; const num = numAt[k];
        const state = finished ? (fold(entered[r][c]) === ch ? 'ok' : 'bad') : '';
        return `<div class="c ${sel.has(k) ? 'sel' : ''} ${r === cr && c === cc ? 'cur' : ''} ${state}" data-r="${r}" data-c="${c}">${num ? `<span class="n">${num}</span>` : ''}${esc(entered[r][c])}</div>`;
      }).join('')).join(''))}</div></div>
      <div class="mt clues">
        <div class="mood-title">Across</div>${raw(placed.filter(p => p.dir === 'a').map(p => html`<div class="clue ${p === cur ? 'on' : ''}" data-w="${placed.indexOf(p)}"><b>${p.num}.</b> ${p.clue} (${p.text.length})</div>`).join(''))}
        <div class="mood-title">Down</div>${raw(placed.filter(p => p.dir === 'd').map(p => html`<div class="clue ${p === cur ? 'on' : ''}" data-w="${placed.indexOf(p)}"><b>${p.num}.</b> ${p.clue} (${p.text.length})</div>`).join(''))}
      </div>
      <div class="cw-panel">
        <div class="row between mb-s"><div class="small"><b>${cur.num} ${cur.dir === 'a' ? 'Across' : 'Down'}</b> · ${cur.clue} <span class="tiny muted">(${cur.text.length})</span></div><button class="btn xs ghost" data-hint>Hint</button></div>
        <div class="keyboard">${raw(LETTERS.map(l => `<button class="k" data-l="${l}">${l}</button>`).join(''))}<button class="k" data-l="⌫" style="width:48px">⌫</button></div>
        <div class="row gap mt">${finished ? raw('<button class="btn primary grow" data-results>See results</button>') : raw('<button class="btn primary grow" data-check>Check puzzle</button>')}</div>
      </div>`;
    root.querySelector('.cw').addEventListener('click', (ev) => {
      const cell = ev.target.closest('.c[data-r]'); if (!cell || finished) return;
      const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      const ws = wordsAt(r, c);
      if (!ws.length) return;
      const idx = ws.indexOf(cur);
      cur = (idx >= 0 && ws.length > 1 && cellsOf(cur)[pos] && cellsOf(cur)[pos][0] === r && cellsOf(cur)[pos][1] === c) ? ws[(idx + 1) % ws.length] : (ws.includes(cur) ? cur : ws[0]);
      pos = cellsOf(cur).findIndex(([rr, cc]) => rr === r && cc === c);
      draw();
    });
    root.querySelector('.clues').addEventListener('click', (ev) => { const cl = ev.target.closest('[data-w]'); if (!cl) return; cur = placed[Number(cl.dataset.w)]; pos = 0; draw(); });
    root.querySelector('.keyboard').addEventListener('click', (ev) => {
      const k = ev.target.closest('[data-l]'); if (!k || finished) return;
      const cells = cellsOf(cur);
      if (k.dataset.l === '⌫') { if (pos > 0 && !entered[cells[pos][0]][cells[pos][1]]) pos--; const [r, c] = cells[pos]; entered[r][c] = ''; draw(); return; }
      const [r, c] = cells[pos]; entered[r][c] = k.dataset.l;
      if (pos < cells.length - 1) pos++;
      else { // jump to next unfinished word
        const nextIdx = placed.findIndex((p, i) => i > placed.indexOf(cur) && cellsOf(p).some(([rr, cc]) => !entered[rr][cc]));
        if (nextIdx >= 0) { cur = placed[nextIdx]; pos = cellsOf(cur).findIndex(([rr, cc]) => !entered[rr][cc]); }
      }
      draw();
    });
    root.querySelector('[data-hint]')?.addEventListener('click', () => { const cells = cellsOf(cur); const empty = cells.find(([r, c]) => !entered[r][c]) || cells[pos]; entered[empty[0]][empty[1]] = grid[empty[0]][empty[1]]; cur.hinted = true; draw(); });
    root.querySelector('[data-check]')?.addEventListener('click', check);
    root.querySelector('[data-results]')?.addEventListener('click', results);
  }
  function check() {
    const missingCells = placed.some(p => cellsOf(p).some(([r, c]) => !entered[r][c]));
    if (missingCells && !confirm('Some cells are empty. Check anyway?')) return;
    finished = true; draw();
    const ok = placed.filter(p => cellsOf(p).every(([r, c]) => fold(entered[r][c]) === grid[r][c]));
    haptic(ok.length === placed.length ? 'success' : 'error');
    for (const p of placed) store.recordAnswer(p.id, ok.includes(p), { quality: ok.includes(p) ? (p.hinted ? 3 : 4) : 1, xp: ok.includes(p) ? 3 : 0 });
    toast(ok.length === placed.length ? 'Perfetto! Puzzle complete 🎉' : `${ok.length}/${placed.length} words correct`, { kind: ok.length === placed.length ? 'ok' : '' });
  }
  function results() {
    const ok = placed.filter(p => cellsOf(p).every(([r, c]) => fold(entered[r][c]) === grid[r][c]));
    const result = { gameId: 'crossword', total: placed.length, correct: ok.length, wrong: placed.length - ok.length, score: Math.round((ok.length / placed.length) * 100), missed: placed.filter(p => !ok.includes(p)).map(p => p.id), secs: Math.round((Date.now() - start) / 1000) };
    result.xp = ok.length * 3 + (ok.length === placed.length ? 15 : 0);
    store.recordGame('crossword', result);
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice });
  }
  draw();
}
