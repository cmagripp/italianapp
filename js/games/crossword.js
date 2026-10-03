// Crossword: auto-generated grid from Italian words, clued in English.
// Grid centred in a glass frame that scrolls internally; the current clue and the letter keys live in a fixed dock.
import { html, raw, esc, haptic, toast, speak } from '../ui.js';
import { store } from '../store.js';
import { shortEn, fold, shuffle } from '../data.js';
import { showResults, gameTop, keyboardHTML, mountDock, pad2, gameActivityFence, gameAnswerBudget } from './engine.js';
import fx from '../fx.js';

const SIZE = 19;          // scratch grid; the result is cropped to its bounding box
const FRAME_PAD = 10;     // .cw-frame padding (px), mirrored in css/games.css
const GAP = 3;            // .cw gap (px)
const CELL_MIN = 20, CELL_MAX = 40;

const availWidth = () => Math.min(window.innerWidth || 390, 720) - 32 - FRAME_PAD * 2 - 2;
const cellFor = (cols) => Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor((availWidth() - GAP * (cols - 1)) / cols)));
// Columns that still give ≥24px cells on this screen (12 on a 375px phone, 14 at 430px).
const maxColsFor = () => Math.max(8, Math.floor((availWidth() + GAP) / (24 + GAP)));

// One layout attempt: longest word first, then every other word at the candidate crossing that keeps the
// bounding box smallest (ties broken randomly). Returns the cropped grid with numbering.
function tryLayout(words, maxCols) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const placed = [];
  let minR = SIZE, maxR = -1, minC = SIZE, maxC = -1;
  const can = (w, r, c, dir) => {
    const dr = dir === 'a' ? 0 : 1, dc = dir === 'a' ? 1 : 0;
    if (r < 0 || c < 0 || r + dr * (w.length - 1) >= SIZE || c + dc * (w.length - 1) >= SIZE) return false;
    const br = r - dr, bc = c - dc, ar = r + dr * w.length, ac = c + dc * w.length;
    if (br >= 0 && bc >= 0 && grid[br][bc]) return false;
    if (ar < SIZE && ac < SIZE && grid[ar][ac]) return false;
    let crosses = 0;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      const cell = grid[rr][cc];
      if (cell) { if (cell !== w[i]) return false; crosses++; continue; }
      const n1r = rr + dc, n1c = cc + dr, n2r = rr - dc, n2c = cc - dr;
      if (n1r < SIZE && n1c < SIZE && grid[n1r][n1c]) return false;
      if (n2r >= 0 && n2c >= 0 && grid[n2r][n2c]) return false;
    }
    return crosses > 0 || placed.length === 0;
  };
  const put = (w, r, c, dir, meta) => {
    const dr = dir === 'a' ? 0 : 1, dc = dir === 'a' ? 1 : 0;
    for (let i = 0; i < w.length; i++) grid[r + dr * i][c + dc * i] = w[i];
    placed.push({ ...meta, text: w, r, c, dir });
    minR = Math.min(minR, r); maxR = Math.max(maxR, r + dr * (w.length - 1));
    minC = Math.min(minC, c); maxC = Math.max(maxC, c + dc * (w.length - 1));
  };
  const sorted = words.slice().sort((a, b) => b.text.length - a.text.length);
  const first = sorted.splice(Math.floor(Math.random() * Math.min(3, sorted.length)), 1)[0];
  const mid = Math.floor(SIZE / 2);
  if (Math.random() < .6) put(first.text, mid, Math.floor((SIZE - first.text.length) / 2), 'a', first);
  else put(first.text, Math.floor((SIZE - first.text.length) / 2), mid, 'd', first);
  let remaining = sorted;
  for (let pass = 0; pass < 3 && remaining.length; pass++) {
    const left = [];
    for (const w of remaining) {
      let best = null, bestScore = Infinity;
      for (const p of placed) {
        for (let i = 0; i < w.text.length; i++) {
          for (let j = 0; j < p.text.length; j++) {
            if (w.text[i] !== p.text[j]) continue;
            const dir = p.dir === 'a' ? 'd' : 'a';
            const r = p.dir === 'a' ? p.r - i : p.r + j;
            const c = p.dir === 'a' ? p.c + j : p.c - i;
            if (!can(w.text, r, c, dir)) continue;
            const dr = dir === 'a' ? 0 : 1, dc = dir === 'a' ? 1 : 0;
            const rows = Math.max(maxR, r + dr * (w.text.length - 1)) - Math.min(minR, r) + 1;
            const cols = Math.max(maxC, c + dc * (w.text.length - 1)) - Math.min(minC, c) + 1;
            const score = rows * cols + Math.max(0, cols - maxCols) * 300 + Math.abs(rows - cols) * 2 + Math.random() * 4;
            if (score < bestScore) { bestScore = score; best = [r, c, dir]; }
          }
        }
      }
      if (best) put(w.text, best[0], best[1], best[2], w); else left.push(w);
    }
    remaining = left;
  }
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const g = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => grid[r + minR][c + minC]));
  for (const p of placed) { p.r -= minR; p.c -= minC; }
  placed.sort((a, b) => a.r - b.r || a.c - b.c || (a.dir === 'a' ? -1 : 1));
  let n = 0; const numAt = {};
  for (const p of placed) { const k = `${p.r},${p.c}`; if (!numAt[k]) numAt[k] = ++n; p.num = numAt[k]; }
  return { grid: g, rows, cols, placed, numAt, unplaced: remaining, area: rows * cols };
}

// Best of several attempts: most words placed, then the most compact (area per word), never wider than the screen.
function buildGrid(words, maxCols, tries = 12) {
  let best = null, bestScore = -Infinity;
  for (let t = 0; t < tries; t++) {
    const b = tryLayout(shuffle(words), maxCols);
    const perWord = b.area / Math.max(1, b.placed.length);
    const score = b.placed.length * 100 - perWord * 6 - Math.max(0, b.cols - maxCols) * 400 - Math.max(0, b.rows - 18) * 60;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best;
}

export function startCrossword(root, ctx) {
  const current=gameActivityFence(ctx.isActive);let dead=false,resultsShown=false;
  const active=()=>!dead&&current();
  const cands = ctx.items.map(e => { const orig = e.kind === 'verb' ? e.inf : e.it; const text = fold(orig).replace(/[^a-z]/g, ''); return text.length >= 3 && text.length <= 9 && !orig.includes(' ') && !orig.includes("'") ? { text, clue: shortEn(e.en), id: e.id, orig, e } : null; }).filter(Boolean);
  const seen = new Set();
  const words = shuffle(cands).filter(w => !seen.has(w.text) && seen.add(w.text)).slice(0,gameAnswerBudget(ctx));
  if (words.length < 3) { root.innerHTML = html`<div class="empty"><p>Need at least 3 single words for a crossword.</p><a class="btn primary" href="${ctx.backHref}">Choose another source</a></div>`; return; }
  const maxCols = maxColsFor();
  const { grid, rows, cols, placed, numAt } = buildGrid(words, maxCols);
  const entered = Array.from({ length: rows }, () => Array(cols).fill(''));
  let cur = placed[0]; let pos = 0; let finished = false; let armed = false; const start = Date.now();
  const cellsOf = (p) => Array.from({ length: p.text.length }, (_, i) => [p.r + (p.dir === 'd' ? i : 0), p.c + (p.dir === 'a' ? i : 0)]);
  const wordsAt = (r, c) => placed.filter(p => cellsOf(p).some(([rr, cc]) => rr === r && cc === c));
  const isFilled = (p) => cellsOf(p).every(([r, c]) => !!entered[r][c]);
  const isRight = (p) => cellsOf(p).every(([r, c]) => fold(entered[r][c]) === grid[r][c]);
  const filledCount = () => placed.filter(isFilled).length;
  const cell = cellFor(cols);

  // ----- shell (rendered once; cells, clues and the dock are then updated in place) -----
  const cellsHTML = grid.map((row, r) => row.map((ch, c) => {
    if (!ch) return '<div class="c black" aria-hidden="true"></div>';
    const num = numAt[`${r},${c}`];
    return `<div class="c" data-r="${r}" data-c="${c}" role="gridcell">${num ? `<span class="n">${num}</span>` : ''}<span class="ch"></span></div>`;
  }).join('')).join('');
  const clueBtn = (p) => html`<button type="button" class="clue" data-w="${placed.indexOf(p)}"><b>${p.num}</b><span class="clue-text">${p.clue}</span><span class="clue-len">${p.text.length}</span></button>`;
  root.innerHTML = gameTop(ctx.backHref, { i: 0, total: placed.length }) + html`
    <div class="cw-frame glass" data-frame><div class="cw" role="grid" aria-label="Crossword grid" style="grid-template-columns:repeat(${cols},${cell}px);--cell:${cell}px">${raw(cellsHTML)}</div></div>
    <div class="clues glass-flat">
      <div class="clues-col"><div class="kicker">Across</div>${raw(placed.filter(p => p.dir === 'a').map(clueBtn).join(''))}</div>
      <div class="clues-col"><div class="kicker">Down</div>${raw(placed.filter(p => p.dir === 'd').map(clueBtn).join(''))}</div>
    </div>`;
  fx.mount(root);
  const frame = root.querySelector('[data-frame]');
  const gridEl = root.querySelector('.cw');
  const cellEls = new Map();
  gridEl.querySelectorAll('.c[data-r]').forEach(el => cellEls.set(`${el.dataset.r},${el.dataset.c}`, el));

  const dockInner = () => `
    <div class="dock-clue"><div class="dc-main"><span class="dc-num" data-dc-num></span><span class="dc-text" data-dc-text></span></div><button type="button" class="btn xs ghost" data-hint>Hint</button></div>
    ${keyboardHTML({ backspace: true })}
    <div class="dock-actions"><button type="button" class="btn primary block" data-check>Check puzzle</button></div>`;
  const dock = mountDock(root, dockInner());

  function paintClue() {
    const num = dock.el.querySelector('[data-dc-num]'), text = dock.el.querySelector('[data-dc-text]');
    if (num) num.textContent = `${cur.num} ${cur.dir === 'a' ? 'Across' : 'Down'} · ${cur.text.length} letters`;
    if (text) text.textContent = cur.clue;
    root.querySelectorAll('.clue').forEach(b => {
      const p = placed[Number(b.dataset.w)];
      b.classList.toggle('on', p === cur);
      if (finished) { b.classList.toggle('solved', isRight(p)); b.classList.toggle('failed', !isRight(p)); }
    });
  }
  function paintTop() {
    const top = root.querySelector('.game-top');
    if (top) top.outerHTML = gameTop(ctx.backHref, { i: filledCount(), total: placed.length, count: `${pad2(filledCount())} / ${pad2(placed.length)}` });
  }
  function paint() {
    const sel = new Set(cellsOf(cur).map(([r, c]) => `${r},${c}`));
    const [cr, cc] = cellsOf(cur)[pos] || [];
    for (const [k, el] of cellEls) {
      const [r, c] = k.split(',').map(Number);
      el.classList.toggle('sel', sel.has(k));
      el.classList.toggle('cur', r === cr && c === cc && !finished);
      if (finished) { const ok = fold(entered[r][c]) === grid[r][c]; el.classList.toggle('ok', ok); el.classList.toggle('bad', !ok); }
      const ch = el.querySelector('.ch');
      if (ch.textContent !== entered[r][c]) ch.textContent = entered[r][c];
    }
    paintClue();
    paintTop();
    // keep the current cell visible inside the frame
    const curEl = cellEls.get(`${cr},${cc}`);
    if (curEl && frame) {
      const fr = frame.getBoundingClientRect(), r = curEl.getBoundingClientRect();
      if (r.top < fr.top + 10) frame.scrollTop -= (fr.top + 10 - r.top);
      else if (r.bottom > fr.bottom - 10) frame.scrollTop += (r.bottom - (fr.bottom - 10));
    }
  }
  function select(p, atPos = 0) { if(!active())return;cur = p; pos = Math.max(0, Math.min(p.text.length - 1, atPos)); paint(); }
  function jumpNext() {
    const idx = placed.indexOf(cur);
    for (let k = 1; k <= placed.length; k++) {
      const p = placed[(idx + k) % placed.length];
      if (!isFilled(p)) { select(p, cellsOf(p).findIndex(([r, c]) => !entered[r][c])); return; }
    }
  }
  function press(l) {
    if (!active() || finished) return;
    const cells = cellsOf(cur);
    if (l === '⌫') {
      if (pos > 0 && !entered[cells[pos][0]][cells[pos][1]]) pos--;
      const [r, c] = cells[pos]; entered[r][c] = '';
      paint(); return;
    }
    if (!/^[a-z]$/.test(l)) return;
    const [r, c] = cells[pos]; entered[r][c] = l;
    if (pos < cells.length - 1) pos++; else jumpNext();
    paint();
    if (armed) { armed = false; const b = dock.el.querySelector('[data-check]'); if (b) b.textContent = 'Check puzzle'; }
  }
  function hint() {
    if (!active() || finished) return;
    const cells = cellsOf(cur);
    const empty = cells.find(([r, c]) => !entered[r][c]) || cells[pos];
    entered[empty[0]][empty[1]] = grid[empty[0]][empty[1]];
    cur.hinted = true; haptic('light');
    pos = Math.max(pos, cells.findIndex(([r, c]) => r === empty[0] && c === empty[1]));
    if (isFilled(cur)) jumpNext(); else pos = cells.findIndex(([r, c]) => !entered[r][c]);
    paint();
  }
  function check() {
    if (!active() || finished) return;
    const allCells = new Set(placed.flatMap(p => cellsOf(p).map(([r, c]) => `${r},${c}`)));
    const empties = [...allCells].filter(k => { const [r, c] = k.split(',').map(Number); return !entered[r][c]; }).length;
    if (empties && !armed) {
      armed = true;
      toast(`${empties} empty cell${empties > 1 ? 's' : ''} — tap again to check anyway`);
      const b = dock.el.querySelector('[data-check]'); if (b) b.textContent = 'Check anyway';
      return;
    }
    finished = true;
    const ok = placed.filter(isRight);
    haptic(ok.length === placed.length ? 'success' : 'error');
    for (const p of placed) store.recordAnswer(p.id, ok.includes(p), { quality: ok.includes(p) ? (p.hinted ? 3 : 4) : 1, xp: ok.includes(p) ? 3 : 0 });
    paint();
    dock.set(`<div class="dock-clue verdict ${ok.length === placed.length ? 'ok' : ''}"><div class="dc-main"><span class="dc-num">${ok.length === placed.length ? 'Perfetto' : 'Checked'}</span><span class="dc-text">${ok.length} of ${placed.length} words correct</span></div></div>
      <div class="dock-actions"><button type="button" class="btn primary block" data-results>See results</button></div>`);
    if (ok.length === placed.length) toast('Perfetto! Puzzle complete', { kind: 'ok' });
  }
  function results() {
    if(!active()||resultsShown)return;resultsShown=true;
    const ok = placed.filter(isRight);
    const result = { gameId: 'crossword', total: placed.length, correct: ok.length, wrong: placed.length - ok.length, score: Math.round((ok.length / placed.length) * 100), missed: placed.filter(p => !ok.includes(p)).map(p => p.id), secs: Math.round((Date.now() - start) / 1000) };
    result.xp = ok.length * 3 + (ok.length === placed.length ? 15 : 0);
    // check() already awarded 3 XP per correct word: the game record adds only the perfect-puzzle bonus
    store.recordGame('crossword', { ...result, xp: result.xp - ok.length * 3 });
    cleanup();
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice });
  }

  // ----- events -----
  gridEl.addEventListener('click', (ev) => {
    const el = ev.target.closest('.c[data-r]'); if (!el || !active() || finished) return;
    const r = Number(el.dataset.r), c = Number(el.dataset.c);
    const ws = wordsAt(r, c); if (!ws.length) return;
    const here = cellsOf(cur)[pos];
    const sameCell = here && here[0] === r && here[1] === c;
    const idx = ws.indexOf(cur);
    const next = sameCell && ws.length > 1 && idx >= 0 ? ws[(idx + 1) % ws.length] : (ws.includes(cur) ? cur : ws[0]);
    select(next, cellsOf(next).findIndex(([rr, cc]) => rr === r && cc === c));
  });
  root.querySelector('.clues').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-w]'); if (!b || !active()) return;
    const p = placed[Number(b.dataset.w)];
    if (finished) { speak(p.orig); return; }
    select(p, Math.max(0, cellsOf(p).findIndex(([r, c]) => !entered[r][c])));
  });
  dock.el.addEventListener('click', (ev) => {
    if(!active())return;
    const k = ev.target.closest('[data-l]');
    if (k) { press(k.dataset.l); return; }
    if (ev.target.closest('[data-hint]')) { hint(); return; }
    if (ev.target.closest('[data-check]')) { check(); return; }
    if (ev.target.closest('[data-results]')) results();
  });
  const onKey = (e) => {
    if (!active() || !root.contains(gridEl)) { cleanup(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (/^[a-zA-Z]$/.test(e.key)) { press(e.key.toLowerCase()); e.preventDefault(); }
    else if (e.key === 'Backspace') { press('⌫'); e.preventDefault(); }
    else if (e.key === 'Enter') { if (finished) results(); else check(); }
  };
  document.addEventListener('keydown', onKey);
  let cleaned = false;
  function cleanup() { if (cleaned) return; cleaned = true; dead=true; document.removeEventListener('keydown', onKey); dock.destroy(); }
  paint();
  return cleanup;
}
