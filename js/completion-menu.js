// Manual completion is a learner preference. The callbacks own persistence;
// opening or changing this menu never creates practice answers or awards XP.
import { esc, icon } from './ui.js';
import { dropdown } from './fx.js';

function stateOf(value) {
  return { complete: value?.complete === true, cases: (Array.isArray(value?.cases) ? value.cases : [])
    .filter(row => row && typeof row.id === 'string')
    .map(row => ({ ...row, title: String(row.title || row.label || row.id), checked: row.checked === true })) };
}
function labelFor(entry, state) {
  const name = entry.inf || entry.it || 'this item';
  return `Completion for ${name}: ${state.complete ? 'learned' : state.cases.some(row => row.checked && row.available !== false && !row.exempt) ? 'partly learned' : 'not marked learned'}`;
}

export function completionButtonHTML(entry, value = {}) {
  const state = stateOf(value);
  return `<button type="button" class="icon-btn completion-toggle${state.complete ? ' is-complete' : ''}" data-completion-menu aria-haspopup="menu" aria-expanded="false" aria-label="${esc(labelFor(entry,state))}" title="Update completion">${icon('check',{size:20})}</button>`;
}

function menuHTML(entry, state) {
  const rows = state.cases;
  const available = rows.filter(row => row.available !== false && !row.exempt);
  const title = rows.length ? `${available.filter(row => row.checked).length} of ${available.length} tenses learned` : 'Word completion';
  return `<div class="dropdown-title" data-completion-title>${esc(title)}</div><div class="dropdown-list">
    ${rows.length ? `<button type="button" class="opt completion-all" role="menuitem" data-value="all:on" data-completion-all="true"><span class="opt-main"><span class="opt-label">Mark all learned</span></span>${icon('check',{size:18})}</button>
      <button type="button" class="opt completion-all" role="menuitem" data-value="all:off" data-completion-all="false"><span class="opt-main"><span class="opt-label">Clear all</span></span>${icon('x',{size:18})}</button>
      <div class="completion-divider" role="separator"></div>
      ${rows.map(row => `<button type="button" class="opt completion-case${row.checked ? ' on' : ''}" role="menuitemcheckbox" aria-checked="${row.checked}" ${row.available === false || row.exempt ? 'disabled aria-disabled="true"' : `data-value="case:${esc(row.id)}"`} data-completion-case="${esc(row.id)}"><span class="opt-main"><span class="opt-label">${esc(row.title)}</span>${row.available === false || row.exempt ? '<span class="opt-sub">Not used for this verb</span>' : ''}</span><span class="completion-checkbox" aria-hidden="true">${icon('check',{size:16})}</span></button>`).join('')}`
      : `<button type="button" class="opt completion-case${state.complete ? ' on' : ''}" role="menuitemcheckbox" aria-checked="${state.complete}" data-value="word" data-completion-item><span class="opt-main"><span class="opt-label">Learned</span></span><span class="completion-checkbox" aria-hidden="true">${icon('check',{size:16})}</span></button>`}
  </div><span class="completion-status" role="status" aria-live="polite" data-completion-status></span>`;
}

export function bindCompletionMenu(anchor, { entry, getState, setCase, setAll, onChange = null } = {}) {
  if (!anchor || !entry || typeof getState !== 'function') return { refresh() {}, destroy() {} };
  let menu = null, disposed = false;
  const read = () => stateOf(getState());
  function refresh() {
    if (disposed) return;
    const state = read();
    anchor.classList.toggle('is-complete', state.complete);
    anchor.classList.toggle('is-partial', !state.complete && state.cases.some(row => row.checked && row.available !== false && !row.exempt));
    anchor.setAttribute('aria-label', labelFor(entry,state));
    if (menu) {
      const selected = menu.el.contains(document.activeElement) ? document.activeElement?.dataset.value : null;
      menu.el.innerHTML = menuHTML(entry,state);
      if (selected) [...menu.el.querySelectorAll('[data-value]')].find(button => button.dataset.value === selected)?.focus({preventScroll:true});
      menu.reposition();
    }
  }
  function open() {
    if (disposed) return;
    if (menu) { menu.close(); return; }
    const state = read();
    menu = dropdown(anchor,menuHTML(entry,state),{align:'end',width:286,
      onSelect(value) {
        const before = read();
        let updated;
        if (value === 'all:on') updated=setAll?.(true);
        else if (value === 'all:off') updated=setAll?.(false);
        else if (value === 'word') updated=setAll?.(!before.complete);
        else if (value.startsWith('case:')) {
          const row = before.cases.find(row => row.id === value.slice(5));
          if (!row) return false;
          updated=setCase?.(row.id,!row.checked);
        } else return false;
        refresh();
        onChange?.(read());
        const status = menu?.el.querySelector('[data-completion-status]');
        if (status) status.textContent = updated===false ? 'Completion could not be updated.' : 'Completion updated';
        return false;
      },
      onClose() { menu = null; anchor.setAttribute('aria-expanded','false'); },
    });
    menu.el.classList.add('completion-dropdown');
    menu.el.setAttribute('aria-label',`Completion for ${entry.inf || entry.it || 'this item'}`);
  }
  function tabAway(event) { if (menu && event.key === 'Tab') menu.close({restoreFocus:false}); }
  anchor.addEventListener('click',open);
  document.addEventListener('keydown',tabAway);
  refresh();
  return { refresh, destroy() {
    disposed = true;
    menu?.close({restoreFocus:false});
    anchor.removeEventListener('click',open);
    document.removeEventListener('keydown',tabAway);
  } };
}
