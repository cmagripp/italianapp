// Adaptive spaced-repetition review session.
import { html, raw } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, shuffle, itemsForScope, sample, data } from '../data.js';
import { buildQueue } from '../srs.js';
import { runDrill } from '../games/engine.js';
import { qTranslateMC, qTypeIt, qGender, qCloze, qConjMC, qConjType, qAux, qParticiple, qPluralMC } from '../games/questions.js';

// Pick a question type according to how well the item is known: weak items get recognition tasks, strong ones get production tasks.
function questionFor(e, pool) {
  const it = store.getItem(e.id) || { s: 0 };
  const strong = it.s >= 3;
  if (e.kind === 'verb') {
    const r = Math.random();
    if (!strong) return r < 0.4 ? qTranslateMC(e, pool, 'it-en') : r < 0.7 ? qConjMC(e, sample(['presente', 'passatoProssimo']), pool) : r < 0.85 ? qAux(e) : qParticiple(e, false);
    return r < 0.3 ? qConjType(e, sample(['presente', 'passatoProssimo', 'imperfetto', 'futuro', 'condizionale', 'congiuntivoPresente'])) : r < 0.5 ? qCloze(e, { typed: true, pool }) || qConjType(e, 'presente') : r < 0.7 ? qConjMC(e, sample(['imperfetto', 'futuro', 'condizionale', 'congiuntivoPresente', 'passatoRemoto']), pool) : r < 0.85 ? qParticiple(e, true) : qTranslateMC(e, pool, 'en-it');
  }
  const r = Math.random();
  if (!strong) return r < 0.45 ? qTranslateMC(e, pool, 'it-en') : r < 0.75 ? qTranslateMC(e, pool, 'en-it') : (qGender(e) || qCloze(e, { pool }) || qTranslateMC(e, pool, 'it-en'));
  return r < 0.4 ? qTypeIt(e) : r < 0.6 ? qCloze(e, { typed: true, pool }) || qTypeIt(e) : r < 0.8 ? (qPluralMC(e, pool) || qTranslateMC(e, pool, 'en-it')) : qTranslateMC(e, pool, 'en-it');
}

export async function render(root, params, query) {
  setTitle('Review');
  const limit = store.settings.dailyReviews || 40;
  let ids = store.dueIds();
  if (query.mode === 'extra' || ids.length < 5) {
    // review ahead: weakest learned items not yet due
    const learned = store.learnedIds().filter(id => !ids.includes(id));
    const extra = buildQueue(learned, id => store.getItem(id), { limitNew: 0, limitTotal: Math.max(8, 12 - ids.length), includeNew: false });
    const byDue = learned.map(id => [id, store.getItem(id)?.due || 0]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    ids = [...ids, ...extra, ...byDue].filter((v, i, a) => a.indexOf(v) === i).slice(0, Math.max(ids.length, 12));
  }
  ids = ids.slice(0, limit);
  const entries = ids.map(getEntry).filter(Boolean);
  if (!entries.length) { root.innerHTML = '<div class="empty"><div class="big">🎉</div><p>Nothing to review. Learn some new words first!</p><a class="btn primary" href="#/learn">Learn</a></div>'; return; }
  const pool = [...data.vocab, ...data.verbs];
  const qs = shuffle(entries).map(e => questionFor(e, pool) || qTranslateMC(e, pool, 'it-en'));
  runDrill(root, qs, { title: 'Review', gameId: 'review', backHref: '#/learn', xpPer: 2, autoAdvance: true, onReplay: null, onPractice: (missed) => { location.hash = '#/game/flashcards?src=ids:' + encodeURIComponent(missed.map(e => e.id).join(',')); } });
}
