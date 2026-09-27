// Runs a game with the chosen source.
import { html, raw, esc } from '../ui.js';
import { setTitle, setChrome } from '../app.js';
import { store } from '../store.js';
import { GAME_BY_ID } from '../games/index.js';
import { resolveSource, sourceLabel } from '../source.js';
import { shuffle, data } from '../data.js';

export async function render(root, params, query) {
  const game = GAME_BY_ID[params.id];
  if (!game) { root.innerHTML = '<div class="empty">Unknown game.</div>'; return; }
  setTitle(game.name);
  setChrome({ tabs: false, back: true });
  const src = query.src || 'scope';
  let items = resolveSource(src);
  if (game.kind === 'verb') items = items.filter(e => e.kind === 'verb');
  else if (game.kind === 'noun') items = items.filter(e => e.kind === 'word' && e.pos === 'noun');
  else if (game.kind === 'word') items = items.filter(e => e.kind === 'word');
  const options = { ...query };
  if (query.tenses) options.tenses = query.tenses.split(',').filter(Boolean);
  if (query.count) options.count = Number(query.count);
  const backHref = '#/games';
  if (items.length < game.min) {
    const learnedHint = src.startsWith('learned') ? html`<p class="small">Complete verb or word introductions in <a href="#/learn">Learn</a> to build up this list, or play with a level instead.</p>` : '';
    root.innerHTML = html`<div class="empty"><div class="big">${game.icon}</div><p><b>${sourceLabel(src)}</b> has ${items.length} usable ${game.kind === 'verb' ? 'verbs' : game.kind === 'noun' ? 'nouns' : 'items'}; this game needs at least ${game.min}.</p>${raw(learnedHint)}<div class="row gap" style="justify-content:center"><a class="btn" href="#/games?pick=${game.id}">Choose another source</a><a class="btn primary" href="#/game/${game.id}?src=level:${store.settings.level || 'A1'}${query.tenses ? '&tenses=' + query.tenses : ''}">Use level ${store.settings.level || 'A1'}</a></div></div>`;
    return () => setChrome({ tabs: true });
  }
  const pool = [...data.vocab, ...data.verbs];
  let cleanup = null;
  const run = (its) => {
    const ctx = { items: shuffle(its), pool, options, backHref, replay: () => run(items), practice: (missed) => run(missed) };
    Promise.resolve(game.start(root, ctx)).then(c => { cleanup = typeof c === 'function' ? c : null; });
  };
  run(items);
  return () => { setChrome({ tabs: true }); if (cleanup) cleanup(); };
}
