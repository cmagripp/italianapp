// Adaptive spaced-repetition review session on a level-tinted scene, with a short glass intro strip above the runner.
import { html, raw, tr, levelBadge } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, shuffle, itemsForScope, sample, data } from '../data.js';
import { buildQueue } from '../srs.js';
import { runDrill, showResults } from '../games/engine.js';
import { qTranslateMC, qTypeIt, qGender, qCloze, qConjMC, qConjType, qAux, qParticiple, qPluralMC } from '../games/questions.js';
import { setScene } from '../fx.js';
import { reviewItems, eligibleSkills, practiceHref, skillLabel } from '../learning/integration.js';
import { allowedTenses } from '../learning/curriculum.js';

// Pick a question type according to how well the item is known: weak items get recognition tasks, strong ones get production tasks.
function questionFor(e, pool) {
  const it = store.getItem(e.id) || { s: 0 };
  const strong = it.s >= 3;
  if (e.kind === 'verb') {
    const r = Math.random();
    const tenses = allowedTenses(store.learning);
    if (!strong) return r < 0.4 ? qTranslateMC(e, pool, 'it-en') : r < 0.7 || !tenses.includes('passatoProssimo') ? qConjMC(e, sample(tenses), pool) : r < 0.85 ? qAux(e) : qParticiple(e, false);
    return r < 0.3 ? qConjType(e, sample(tenses)) : r < 0.5 ? qCloze(e, { typed: true, pool }) || qConjType(e, 'presente') : r < 0.7 ? qConjMC(e, sample(tenses), pool) : r < 0.85 && tenses.includes('passatoProssimo') ? qParticiple(e, true) : qTranslateMC(e, pool, 'en-it');
  }
  const r = Math.random();
  if (!strong) return r < 0.45 ? qTranslateMC(e, pool, 'it-en') : r < 0.75 ? qTranslateMC(e, pool, 'en-it') : (qGender(e) || qCloze(e, { pool }) || qTranslateMC(e, pool, 'it-en'));
  return r < 0.4 ? qTypeIt(e) : r < 0.6 ? qCloze(e, { typed: true, pool }) || qTypeIt(e) : r < 0.8 ? (qPluralMC(e, pool) || qTranslateMC(e, pool, 'en-it')) : qTranslateMC(e, pool, 'en-it');
}

export async function render(root, params, query) {
  if (store.settings.adaptiveLearning !== false) return renderAdaptiveReview(root, query);
  setTitle('Review');
  const level = store.settings.level || 'A1';
  setScene(level);
  const limit = store.settings.dailyReviews || 40;
  const dueNow = store.dueIds().length;
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
  if (!entries.length) {
    root.innerHTML = html`<div class="empty"><span class="kicker">Ripasso</span><p>${raw(tr('Niente da ripassare, per ora.', 'Nothing to review, for now.'))}</p><p class="small muted">Learn some new words first: they come back here when they are due.</p><a class="btn primary" href="#/learn">Learn</a></div>`;
    return;
  }
  const pool = [...data.vocab, ...data.verbs];
  const qs = shuffle(entries).map(e => questionFor(e, pool) || qTranslateMC(e, pool, 'it-en'));
  const n = entries.length;
  root.innerHTML = html`<div class="review-strip glass-flat" data-review-strip>${raw(tr('Ripasso', 'Review', 'kicker'))}<span class="due"><b>${n}</b> ${dueNow >= n ? 'due now' : dueNow ? `in this run · ${dueNow} due` : 'ahead of schedule'}</span>${raw(levelBadge(level))}</div><div data-runner></div>`;
  const runner = root.querySelector('[data-runner]');
  const opts = { title: 'Review', gameId: 'review', backHref: '#/learn', xpPer: 2, autoAdvance: true, onReplay: null, onPractice: (missed) => { location.hash = '#/game/flashcards?src=ids:' + encodeURIComponent(missed.map(e => e.id).join(',')); } };
  runDrill(runner, qs, { ...opts, onDone: (result) => { root.querySelector('[data-review-strip]')?.remove(); showResults(runner, result, opts); } });
}

function renderAdaptiveReview(root, query = {}) {
  setTitle('Review'); setScene(store.settings.level || 'A1');
  const due = reviewItems(store);
  const ahead = !due.length || query.mode === 'extra';
  const items = ahead ? [...due, ...eligibleSkills(store).filter(s => !due.some(d => d.objectiveId === s.objectiveId)).sort((a, b) => (a.due || Infinity) - (b.due || Infinity)).map(skill => ({ entry: getEntry(skill.entryId), objectiveId: skill.objectiveId, skill }))] : due;
  root.innerHTML = html`<div class="course-page"><header><div class="kicker">Ripasso · keep it with you</div><h1 class="display">${due.length ? 'Bring it back to mind.' : 'A little practice for later.'}</h1><p>Revisit familiar words and forms in a short practice session. You can return to your lesson whenever you like.</p></header>
    ${items.length ? raw(html`<a class="btn primary" href="${practiceHref(items[0].entry, items[0].objectiveId, 'review')}">${due.length ? 'Start focused review' : 'Practice ahead'}</a><ul class="course-skills">${raw(items.slice(0, store.settings.dailyReviews || 40).map(x => html`<li><div><strong>${x.entry.inf || x.entry.it}</strong><span>${x.skill ? skillLabel(x.entry, x.skill) : 'Check your earlier learning'}</span><small>${x.skill?.unresolvedErrors?.length ? 'Focused practice on a recent difficulty' : x.skill?.remembered ? 'Strengthen a remembered skill' : 'Try another example'}</small></div><a class="btn sm secondary" href="${practiceHref(x.entry, x.objectiveId, 'review')}">Practice</a></li>`).join(''))}</ul>`) : raw('<p>There is nothing to review yet. Start a lesson and your skills will return here when it is time to practice them again.</p>')}
    <a class="btn secondary" href="#/course">Your learning path</a><a href="#/learn">Back to Learn</a></div>`;
}
