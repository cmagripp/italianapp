// Keep keyboard navigation inside a modal, including Safari configurations
// whose native Tab order skips buttons. Menus return to the surrounding modal.
export function dialogTabStops(pane) {
  const available = [...pane.querySelectorAll('a[href],button,input,select,textarea,summary,[contenteditable="true"],[tabindex]')]
    .filter(node => {
      if (node.matches(':disabled') || node.tabIndex < 0 || node.closest('[inert],[aria-hidden="true"]') || !node.getClientRects().length) return false;
      if (getComputedStyle(node).visibility !== 'visible') return false;
      const closed = node.closest('details:not([open])');
      return !closed || closed.querySelector(':scope > summary')?.contains(node);
    });
  // A radio group is one Tab stop; its native arrow keys select other choices.
  return available.filter(node => {
    if (!node.matches('input[type="radio"]') || !node.name) return true;
    const group = available.filter(other => other.matches('input[type="radio"]') && other.name === node.name && other.form === node.form);
    return node === (group.find(other => other.checked) || group[0]);
  }).sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
}

export function moveDialogFocus(pane, { from = document.activeElement, reverse = false } = {}) {
  const stops = dialogTabStops(pane), at = stops.indexOf(from);
  const next = stops.length ? stops[at < 0 ? reverse ? stops.length - 1 : 0 : (at + (reverse ? -1 : 1) + stops.length) % stops.length] : pane;
  next.focus();
}
