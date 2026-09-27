// Study scope: which levels / topics / lists feed Learn, Review and the default game source.
// A rotary level dial colours the scene and adds levels to the multi-select; chips below keep every level toggleable.
import { html, raw, esc, toast, tr, enPill, speakBtn, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, LEVELS, LEVEL_INFO, CATS, itemsForScope } from '../data.js';
import { setScene, dial, mount } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));
const MODES = [['level', 'Levels & topics'], ['lists', 'My lists'], ['learned', 'Learned'], ['all', 'All']];

function levelCounts() {
  const out = {};
  for (const L of LEVELS) out[L] = { words: 0, verbs: 0, learned: 0 };
  for (const e of data.vocab) { const c = out[e.level]; if (c) { c.words++; if (store.isLearned(e.id)) c.learned++; } }
  for (const e of data.verbs) { const c = out[e.level]; if (c) { c.verbs++; if (store.isLearned(e.id)) c.learned++; } }
  for (const e of Object.values(store.current.custom || {})) { const c = out[e.level || 'A1']; if (c) { if (e.pos === 'verb') c.verbs++; else c.words++; if (store.isLearned(e.id)) c.learned++; } }
  return out;
}
function placeKnob(seg, animate = true) {
  const on = seg.querySelector('button.on'); if (!on) return;
  seg.classList.toggle('no-anim', !animate);
  seg.style.setProperty('--kx', `${on.offsetLeft}px`); seg.style.setProperty('--kw', `${on.offsetWidth}px`);
  if (!animate) requestAnimationFrame(() => seg.classList.remove('no-anim'));
}

export async function render(root) {
  setTitle('Study scope');
  const sc = { mode: 'level', levels: ['A1'], cats: [], lists: [], ...JSON.parse(JSON.stringify(store.scope)) };
  if (!sc.levels.length) sc.levels = [store.settings.level || 'A1'];
  const counts = levelCounts();
  let focus = LEVELS.includes(sc.levels[sc.levels.length - 1]) ? sc.levels[sc.levels.length - 1] : (store.settings.level || 'A1');
  setScene(focus);
  const wrap = document.createElement('div'); wrap.className = 'scope';
  root.append(wrap);
  let dialApi = null;
  let tapStart = null;
  const onResize = () => wrap.querySelectorAll('.seg').forEach(s => placeKnob(s, false));
  window.addEventListener('resize', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (wrap.isConnected) onResize(); });

  const countItems = () => itemsForScope(sc, store).length;
  const levelWord = (L) => { const c = counts[L]; return html`<div class="headword center"><div class="hw-line"><span class="word" style="--hw:36px">${LEVEL_INFO[L].it}</span></div><div class="hw-row">${raw(enPill(LEVEL_INFO[L].name))}${raw(speakBtn(LEVEL_INFO[L].it))}</div></div>
    <div class="scope-meta"><span><b>${c.words}</b> words</span><span><b>${c.verbs}</b> verbs</span><span><b>${c.learned}</b> learned</span></div>`; };
  const levelChip = (L) => html`<button type="button" class="chip ${sc.levels.includes(L) ? 'on' : ''}" data-level="${L}" style="--lvl-current:var(--lvl-${L})" aria-pressed="${sc.levels.includes(L) ? 'true' : 'false'}">${L}<span class="tiny">${counts[L].words + counts[L].verbs}</span></button>`;
  const catChip = (k) => html`<button type="button" class="chip" data-cat="${k}" aria-pressed="false">${CATS[k].name}</button>`;

  function modePane() {
    if (sc.mode === 'level') return html`<div class="card topics">
        <div class="sec-head in-pane"><div><span class="kicker">Topics</span><span class="title itx" role="button" tabindex="0"><span class="it">Argomenti</span><span class="tr">Topics</span></span></div><button type="button" class="btn sm ghost ${sc.cats.length ? '' : 'hidden'}" data-clear-cats>${ic('x', { size: 16 })}All topics</button></div>
        <div class="topics-note"><span data-topics-note></span></div>
        <div class="chips" data-cats>${raw(Object.keys(CATS).map(catChip).join(''))}</div>
      </div>`;
    if (sc.mode === 'lists') {
      const lists = Object.values(store.lists);
      return html`<div class="sec-head"><div><span class="kicker">Study from</span><span class="title itx" role="button" tabindex="0"><span class="it">Le mie liste</span><span class="tr">My lists</span></span></div><a class="more" href="#/lists">Manage</a></div>
        ${lists.length ? raw(`<div class="list">${lists.map(l => html`<label class="row-entry glass-flat"><input type="checkbox" data-list="${l.id}" ${sc.lists.includes(l.id) ? 'checked' : ''}><span class="re-main"><span class="re-hw">${l.name}</span><span class="re-sub">${l.items.length} ${l.items.length === 1 ? 'item' : 'items'}${l.builtin ? ' · word bank' : ''}</span></span><span class="re-side"><span class="dot ${l.items.length ? 'gold' : ''}"></span></span></label>`).join('')}</div>`)
          : raw(html`<div class="empty"><p>${raw(tr('Nessuna lista, per ora.', 'No lists yet.'))}</p><a class="btn primary" href="#/lists">Create a list</a></div>`)}`;
    }
    if (sc.mode === 'learned') return html`<div class="card scope-note glass">${raw(tr('Solo quello che hai già imparato.', 'Only what you have already learned.'))}<div class="small">Ideal for consolidation: every word and verb that passed its drill, and nothing new.</div></div>`;
    return html`<div class="card scope-note glass">${raw(tr('Tutto il dizionario, dall’A1 al C2.', 'The whole dictionary, from A1 to C2.'))}<div class="small">New items are still introduced level by level, so beginners meet beginner words first.</div></div>`;
  }

  function draw() {
    if (dialApi) { dialApi.destroy(); dialApi = null; }
    wrap.innerHTML = html`
      <div class="scope-hero">
        <span class="kicker">Livello · level</span>
        <div class="dial-wrap"><div class="dial scope-dial" data-dial aria-label="Level"></div></div>
        <div class="scope-word" data-level-word>${raw(levelWord(focus))}</div>
      </div>
      <div class="chips scroll level-chips" data-level-chips>${raw(LEVELS.map(levelChip).join(''))}</div>
      <div class="seg mode-seg no-anim" role="radiogroup" aria-label="Scope mode">${raw(MODES.map(([m, l]) => html`<button type="button" role="radio" aria-checked="${sc.mode === m ? 'true' : 'false'}" class="${sc.mode === m ? 'on' : ''}" data-mode="${m}">${l}</button>`).join(''))}</div>
      <div data-mode-pane>${raw(modePane())}</div>
      <div class="sticky-actions no-mount"><button type="button" class="btn primary block" data-save>Use this scope <span class="count" data-count>${countItems()} items</span></button></div>`;
    dialApi = dial(wrap.querySelector('[data-dial]'), {
      items: LEVELS.map(L => ({ key: L, label: L, sub: LEVEL_INFO[L].it })), index: LEVELS.indexOf(focus),
      onChange: (i, it) => { setFocus(it.key); if (!sc.levels.includes(it.key)) { sc.levels.push(it.key); syncChips(); } },
    });
    wrap.querySelectorAll('.seg').forEach(s => placeKnob(s, false));
    syncCats();
    mount(wrap);
  }
  function setFocus(L) {
    focus = L; setScene(L);
    const w = wrap.querySelector('[data-level-word]'); if (w) { w.innerHTML = levelWord(L); const word = w.querySelector('.word'); if (word) { word.classList.add('pop'); } }
  }
  function syncChips() {
    wrap.querySelectorAll('[data-level]').forEach(b => { const on = sc.levels.includes(b.dataset.level); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    syncCount();
  }
  function syncCats() {
    wrap.querySelectorAll('[data-cat]').forEach(b => { const on = sc.cats.includes(b.dataset.cat); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const note = wrap.querySelector('[data-topics-note]'); if (note) note.textContent = sc.cats.length ? `${sc.cats.length} of ${Object.keys(CATS).length} topics` : 'None selected = every topic';
    wrap.querySelector('[data-clear-cats]')?.classList.toggle('hidden', !sc.cats.length);
    syncCount();
  }
  function syncCount() { const c = wrap.querySelector('[data-count]'); if (c) c.textContent = `${countItems()} items`; }

  wrap.addEventListener('click', (ev) => {
    const t = ev.target;
    const lvl = t.closest('[data-level]');
    if (lvl) {
      const L = lvl.dataset.level;
      if (sc.levels.includes(L)) { if (sc.levels.length > 1) { sc.levels = sc.levels.filter(x => x !== L); if (focus === L) { const nf = sc.levels[sc.levels.length - 1]; dialApi.select(LEVELS.indexOf(nf), { silent: true }); setFocus(nf); } } }
      else { sc.levels.push(L); dialApi.select(LEVELS.indexOf(L), { silent: true }); setFocus(L); }
      syncChips(); return;
    }
    const cat = t.closest('[data-cat]');
    if (cat) { const c = cat.dataset.cat; sc.cats = sc.cats.includes(c) ? sc.cats.filter(x => x !== c) : [...sc.cats, c]; syncCats(); return; }
    if (t.closest('[data-clear-cats]')) { sc.cats = []; syncCats(); return; }
    const mode = t.closest('[data-mode]');
    if (mode) {
      if (sc.mode !== mode.dataset.mode) { sc.mode = mode.dataset.mode; wrap.querySelector('[data-mode-pane]').innerHTML = modePane(); syncCats(); mount(wrap.querySelector('[data-mode-pane]')); }
      const seg = mode.closest('.seg'); seg.querySelectorAll('[data-mode]').forEach(b => { const on = b === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); placeKnob(seg, true);
      return;
    }
    if (t.closest('[data-save]')) {
      store.setScope(sc);
      if (sc.mode === 'level' && sc.levels.length === 1) store.setSetting('level', sc.levels[0]);
      toast('Study scope saved', { kind: 'ok' });
      history.length > 1 ? history.back() : (location.hash = '#/learn');
    }
  });
  wrap.addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[data-list]'); if (!cb) return;
    const id = cb.dataset.list; sc.lists = cb.checked ? [...new Set([...sc.lists, id])] : sc.lists.filter(x => x !== id);
    const dot = cb.closest('.row-entry')?.querySelector('.dot'); if (dot) dot.classList.toggle('gold', cb.checked || (store.lists[id]?.items.length > 0));
    syncCount();
  });
  // a tap on the centred (already selected) dial level toggles it off; drags and flings are left to the dial
  wrap.addEventListener('pointerdown', (ev) => { if (ev.target.closest('[data-dial]')) tapStart = { x: ev.clientX, y: ev.clientY }; });
  wrap.addEventListener('pointerup', (ev) => {
    if (!tapStart) return; const s = tapStart; tapStart = null;
    if (Math.abs(ev.clientX - s.x) > 6 || Math.abs(ev.clientY - s.y) > 6) return;
    const item = ev.target.closest('.dial-item.on'); if (!item || !dialApi || Number(item.dataset.i) !== dialApi.index) return;
    const L = item.dataset.key;
    if (sc.levels.includes(L) && sc.levels.length > 1) {
      sc.levels = sc.levels.filter(x => x !== L);
      const nf = sc.levels[sc.levels.length - 1]; dialApi.select(LEVELS.indexOf(nf), { silent: true }); setFocus(nf);
      toast(`${L} removed from the scope`);
    } else if (!sc.levels.includes(L)) sc.levels.push(L);
    syncChips();
  });

  draw();
  return () => { window.removeEventListener('resize', onResize); if (dialApi) dialApi.destroy(); };
}
