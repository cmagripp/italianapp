// Standalone search screen: the Words hub with the search field focused.
import { render as renderWords } from './words.js';
import { setTitle } from '../app.js';
export async function render(root) {
  const cleanup = await renderWords(root);
  setTitle('Search');
  setTimeout(() => root.querySelector('#q')?.focus({ preventScroll: true }), 120);
  return cleanup;
}
