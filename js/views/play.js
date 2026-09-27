// Runs a game with the chosen source. The scene is tinted to the source's level (or the games palette) before the game starts.
import { html, raw, esc, tr } from '../ui.js';
import { setTitle, setChrome } from '../app.js';
import { store } from '../store.js';
import { GAME_BY_ID } from '../games/index.js';
import { resolveSource, sourceLabel } from '../source.js';
import { shuffle, data, LEVELS } from '../data.js';
import { setScene, SCENES } from '../fx.js';

// level:B1 → B1; a single-level selection → that level; otherwise the games palette tinted with the user's level.
function sceneFor(src, items) {
  const [kind, a] = String(src).split(':');
  if (kind === 'level' && LEVELS.includes(a)) return setScene(a);
  const levels = new Set(items.map(e => e.level).filter(Boolean));
  if (levels.size === 1) { const L = [...levels][0]; if (LEVELS.includes(L)) return setScene(L); }
  return setScene(SCENES.games, { level: store.settings.level || 'A1' });
}

export async function render(root, params, query) {
  const game = GAME_BY_ID[params.id];
  if (!game) { root.innerHTML = html`<div class="empty play-empty"><p>${raw(tr('Gioco sconosciuto.', 'Unknown game.'))}</p><a class="btn primary" href="#/games">All games</a></div>`; return; }
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
  sceneFor(src, items);
  if (items.length < game.min) {
    const lvl = store.settings.level || 'A1';
    const what = game.kind === 'verb' ? 'verbs' : game.kind === 'noun' ? 'nouns' : 'items';
    const learnedHint = src.startsWith('learned') ? html`<p class="why">Complete verb or word introductions in <a href="#/learn">Learn</a> to build up this list, or play with a level instead.</p>` : '';
    root.innerHTML = html`<div class="empty play-empty">
      <span class="kicker">${game.name}</span>
      <p>${raw(tr('Troppo poche parole qui.', 'Too few words here.'))}</p>
      <p class="why"><b>${sourceLabel(src)}</b> has ${items.length} usable ${what}; this game needs at least ${game.min}.</p>
      ${raw(learnedHint)}
      <div class="row gap"><a class="btn primary" href="#/game/${game.id}?src=level:${lvl}${query.tenses ? '&tenses=' + query.tenses : ''}">Use level ${lvl}</a><a class="btn ghost" href="#/games?pick=${game.id}">Choose another source</a></div>
    </div>`;
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
