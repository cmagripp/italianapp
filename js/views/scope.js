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
  // "Use this scope" starts in the flow, in a slot between the mode segment and the topics, so it covers nothing on
  // load; once that slot scrolls up under the top bar the button docks to the bottom as a fixed glass bar (like the
  // game keyboard dock) and a spacer at the end of the page keeps the last chips clear of it.
  const dock = document.createElement('div'); dock.className = 'scope-dock'; dock.setAttribute('data-scope-dock', '');
  const space = document.createElement('div'); space.className = 'scope-space no-mount'; space.setAttribute('aria-hidden', 'true');
  let dialApi = null;
  let tapStart = null;
  let docked = false, scrollRaf = 0;
  const placeDock = () => {
    scrollRaf = 0;
    const slot = wrap.querySelector('[data-cta-slot]'); if (!slot || !dock.isConnected) return;
    const barBottom = (document.getElementById('topbar')?.getBoundingClientRect().bottom || 52) + 8;
    const should = slot.getBoundingClientRect().bottom < barBottom;
    if (should === docked) return;
    docked = should;
    dock.classList.toggle('docked', docked);
  };
  const onScroll = () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(placeDock); };
  window.addEventListener('scroll', onScroll, { passive: true });
  const onResize = () => { wrap.querySelectorAll('.seg').forEach(s => placeKnob(s, false)); onScroll(); };
  window.addEventListener('resize', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (wrap.isConnected) onResize(); });

  const countItems = () => itemsForScope(sc, store).length;
  const levelWord = (L) => { const c = counts[L]; return html`<div class="headword center"><div class="hw-line" style="--hw:36px"><span class="word">${LEVEL_INFO[L].it}</span></div><div class="hw-row">${raw(enPill(LEVEL_INFO[L].name))}${raw(speakBtn(LEVEL_INFO[L].it))}</div></div>
    <div class="scope-meta"><span><b>${c.words}</b> words</span><span><b>${c.verbs}</b> verbs</span><span><b>${c.learned}</b> learned</span></div>`; };
  // compact readout of the multi-level selection (the dial adds levels; a pill or the centred dial item removes one)
  const levelPill = (L) => html`<button type="button" class="lvl lvl-${L} lg ${sc.levels.includes(L) ? 'on' : ''}" data-level="${L}" aria-pressed="${sc.levels.includes(L) ? 'true' : 'false'}">${L}</button>`;
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
        <div class="scope-sel"><span class="kicker">In scope</span><div class="scope-levels" role="group" aria-label="Levels in scope" data-level-pills>${raw(LEVELS.map(levelPill).join(''))}</div></div>
      </div>
      <div class="seg mode-seg no-anim" role="radiogroup" aria-label="Scope mode">${raw(MODES.map(([m, l]) => html`<button type="button" role="radio" aria-checked="${sc.mode === m ? 'true' : 'false'}" class="${sc.mode === m ? 'on' : ''}" data-mode="${m}">${l}</button>`).join(''))}</div>
      <div class="scope-cta no-mount" data-cta-slot></div>
      <div data-mode-pane>${raw(modePane())}</div>`;
    wrap.append(space);
    dock.innerHTML = html`<button type="button" class="btn primary block" data-save>Use this scope <span class="count" data-count>${countItems()} items</span></button>`;
    docked = false; dock.classList.remove('docked');
    wrap.querySelector('[data-cta-slot]').append(dock);
    dialApi = dial(wrap.querySelector('[data-dial]'), {
      items: LEVELS.map(L => ({ key: L, label: L, sub: `${counts[L].words + counts[L].verbs} items` })), index: LEVELS.indexOf(focus),
      onChange: (i, it) => { setFocus(it.key); if (!sc.levels.includes(it.key)) { sc.levels.push(it.key); syncChips(); } },
    });
    wrap.querySelectorAll('.seg').forEach(s => placeKnob(s, false));
    syncChips();
    syncCats();
    mount(wrap);
    measureDock();
  }
  function measureDock() { requestAnimationFrame(() => { const slot = wrap.querySelector('[data-cta-slot]'); if (slot && dock.isConnected) { slot.style.minHeight = `${dock.offsetHeight}px`; placeDock(); } }); }
  function setFocus(L) {
    focus = L; setScene(L);
    const w = wrap.querySelector('[data-level-word]'); if (w) { w.innerHTML = levelWord(L); const word = w.querySelector('.word'); if (word) { word.classList.add('pop'); } }
  }
  function syncChips() {
    wrap.querySelectorAll('button[data-level]').forEach(b => { const on = sc.levels.includes(b.dataset.level); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    wrap.querySelectorAll('.dial-item').forEach(b => b.classList.toggle('picked', sc.levels.includes(b.dataset.key)));
    syncCount();
  }
  function syncCats() {
    wrap.querySelectorAll('[data-cat]').forEach(b => { const on = sc.cats.includes(b.dataset.cat); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const note = wrap.querySelector('[data-topics-note]'); if (note) note.textContent = sc.cats.length ? `${sc.cats.length} of ${Object.keys(CATS).length} topics` : 'None selected = every topic';
    wrap.querySelector('[data-clear-cats]')?.classList.toggle('hidden', !sc.cats.length);
    syncCount();
  }
  function syncCount() { const c = dock.querySelector('[data-count]'); if (c) c.textContent = `${countItems()} items`; }

  dock.addEventListener('click', (ev) => {
    if (!ev.target.closest('[data-save]')) return;
    store.setScope(sc);
    if (sc.mode === 'level' && sc.levels.length === 1) store.setSetting('level', sc.levels[0]);
    toast('Study scope saved', { kind: 'ok' });
    history.length > 1 ? history.back() : (location.hash = '#/learn');
  });
  wrap.addEventListener('click', (ev) => {
    const t = ev.target;
    // button[data-level]: <html data-level> (set by fx.setScene) must never match
    const lvl = t.closest('button[data-level]');
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
  return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(scrollRaf); if (dialApi) dialApi.destroy(); dock.remove(); space.remove(); };
}
