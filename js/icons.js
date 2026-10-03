// Inline SVG icon set (24px grid, stroke 1.75, round caps). icon('speaker') → '<svg …>'.
// Names: home, book, play, search, user, chevron, chevronRight, chevronDown, chevronUp, speaker, star, list,
// check, x, plus, minus, dial, spread, flip, flame, orbit, dots, trash, arrow, back, refresh, sparkle, lock, cloud.
const PATHS = {
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--pane-bg, #141727)"/><circle cx="15" cy="17" r="3" fill="var(--pane-bg, #141727)"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10 20v-5h4v5"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20"/><path d="M8.5 7.5h7"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  chevron: '<path d="m14.5 6-6 6 6 6"/>',
  back: '<path d="m14.5 6-6 6 6 6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  chevronUp: '<path d="m6 14.5 6-6 6 6"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke-width="2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  dial: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12l3.5-4.5"/><path d="M12 3.5v1.5M20.5 12H19M12 20.5V19M3.5 12H5"/>',
  spread: '<rect x="3.5" y="4" width="7" height="7" rx="1.5"/><rect x="13.5" y="4" width="7" height="7" rx="1.5"/><rect x="3.5" y="14" width="7" height="7" rx="1.5"/><rect x="13.5" y="14" width="7" height="7" rx="1.5"/>',
  flip: '<path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H8"/><path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H16"/><path d="M12 2.5v19" stroke-dasharray="2 2.5"/>',
  flame: '<path d="M12 3.5c1 3 4.5 4.5 4.5 9a4.5 4.5 0 0 1-9 0c0-1.5.5-2.5 1-3.5.5 1.5 1.5 2 2 2 .3-2.5-.5-5 1.5-7.5z"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.5"/><circle cx="18.5" cy="6.5" r="1.4" fill="currentColor" stroke="none"/>',
  dots: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  refresh: '<path d="M20 12a8 8 0 0 1-14.5 4.6"/><path d="M4 12a8 8 0 0 1 14.5-4.6"/><path d="M18.5 3.5v4h-4M5.5 20.5v-4h4"/>',
  sparkle: '<path d="M12 3.5 13.8 9l5.7 1.9-5.7 1.9L12 18.5l-1.8-5.7-5.7-1.9L10.2 9z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  cloud: '<path d="M7 18.5a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9.5a4.5 4.5 0 0 1 .5 9z"/>',
  ear: '<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.5-3 4-3 7a2.5 2.5 0 0 1-5 0"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
};

export const ICON_NAMES = Object.keys(PATHS);

// Returns an inline SVG string, or '' for unknown names (never throws).
export function icon(name, { size = 24, cls = '', stroke = 1.75, label = '' } = {}) {
  const d = PATHS[name];
  if (!d) return '';
  const a11y = label ? `role="img" aria-label="${String(label).replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="ic ic-${name}${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${a11y} focusable="false">${d}</svg>`;
}

export default icon;
