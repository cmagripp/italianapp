import {mountActivityViewport} from '../learning/activity-viewport.js';
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
  // the speed round's "Conjugations (verbs)" and matching's "Verb ↔ participle / present form" are verb rounds whatever the
  // source holds: on Level A1 (917 words, 124 verbs) they would otherwise be word rounds with a few verb questions
  const verbRound = (game.id === 'speed' || game.id === 'matching') && (query.mode === 'conj' || query.mode === 'participle');
  if (game.kind === 'verb' || verbRound) items = items.filter(e => e.kind === 'verb');
  else if (game.kind === 'noun') items = items.filter(e => e.kind === 'word' && e.pos === 'noun');
  else if (game.kind === 'word') items = items.filter(e => e.kind === 'word');
  const options = { ...query };
  if (query.tenses) options.tenses = query.tenses.split(',').filter(Boolean);
  if (query.count) options.count = Number(query.count);
  const backHref = typeof query.fromConversation==='string'&&query.fromConversation.length<=200 ? '#/conversations/'+encodeURIComponent(query.fromConversation) : '#/games';
  sceneFor(src, items);
  if (items.length < game.min) {
    const lvl = store.settings.level || 'A1';
    const what = game.kind === 'verb' || verbRound ? 'verbs' : game.kind === 'noun' ? 'nouns' : 'items';
    const learnedHint = src.startsWith('learned') ? html`<p class="why">Complete verb or word introductions in <a href="#/learn">Learn</a> to build up this list, or play with a level instead.</p>` : '';
    // "Use level" keeps every option the learner chose (mode, direction, typed answers, tenses): only the source changes
    const useLevel = new URLSearchParams({ ...query, src: 'level:' + lvl }).toString();
    root.innerHTML = html`<div class="empty play-empty">
      <span class="kicker">${game.name}</span>
      <p>${raw(tr('Troppo poche parole qui.', 'Too few words here.'))}</p>
      <p class="why"><b>${sourceLabel(src)}</b> has ${items.length} usable ${what}; this game needs at least ${game.min}.</p>
      ${raw(learnedHint)}
      <div class="row gap"><a class="btn primary" href="#/game/${game.id}?${useLevel}">Use level ${lvl}</a><a class="btn ghost" href="#/games?pick=${game.id}">Choose another source</a></div>
    </div>`;
    return () => setChrome({ tabs: true });
  }
  const pool = [...data.vocab, ...data.verbs];
  let cleanup = null, generation = 0, disposed = false;
  const owner=store.current.id,learner=store.current.learnerId,epoch=store.learning.epoch.id;
  const sameOwner=()=>store.current.id===owner&&store.current.learnerId===learner&&store.learning.epoch.id===epoch;
  root.dataset.practiceGame=game.id;
  const viewport=mountActivityViewport(root,{kind:'practice',panelSelector:'.drill-main'});
  const release=c=>{if(typeof c==='function')c();else c?.destroy?.();};
  const run = async (its) => {
    if(disposed||!sameOwner())return;
    const current=++generation;
    release(cleanup);cleanup=null;root.scrollTop=0;
    const host=document.createElement('div');host.className='practice-host';root.replaceChildren(host);
    const ctx = { items: shuffle(its), pool, options, backHref, replay: () => run(items), practice: (missed) => run(missed),
      isActive: () => !disposed && current === generation && sameOwner() && host.isConnected && root.contains(host) };
    try {
      const result=await game.start(host,ctx);
      if(disposed||current!==generation||!sameOwner())release(result);else cleanup=result;
    } catch(error) {
      if(!disposed&&current===generation)host.innerHTML='<div class="empty"><p>This activity could not start.</p><a class="btn primary" href="#/games">Back to Play</a></div>';
    }
  };
  run(items);
  return () => {
    disposed=true;generation++;release(cleanup);cleanup=null;
    viewport.destroy();
    delete root.dataset.practiceGame;setChrome({tabs:true});
  };
}
