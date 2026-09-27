// Standalone search screen (same as Words tab search, focused).
import { render as renderWords } from './words.js';
export async function render(root) {
  await renderWords(root);
  setTimeout(() => root.querySelector('#q')?.focus(), 100);
}
