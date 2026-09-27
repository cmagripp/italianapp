// Word introduction flow: Meet → mini drill → Learned (optionally chaining through a session of words).
import { html, raw, esc, speak } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, data, shuffle, withArticle, headword } from '../data.js';
import { wordCard, actionBar, bindActionBar } from '../components.js';
import { runDrill, showResults } from '../games/engine.js';
import { qTranslateMC, qTypeIt, qGender, qPluralMC, qCloze } from '../games/questions.js';
import { nextNew } from './learn.js';

export async function render(root, params, query) {
  const e = getEntry(params.id);
  if (!e) { root.innerHTML = '<div class="empty">Word not found.</div>'; return; }
  setTitle(headword(e));
  store.pushRecent(e.id);
  const pool = data.vocab.filter(v => v.level === e.level);
  const auto = query.auto === '1';

  function meet() {
    root.innerHTML = `<div class="stepper"><div class="s cur"></div><div class="s"></div></div>` + wordCard(e) + html`<div class="card">${raw(actionBar(e))}</div>
      <div class="sticky-actions"><button class="btn primary block" data-next>Quick check →</button></div>`;
    bindActionBar(root, e, () => { root.querySelector('.card:has([data-act])').innerHTML = actionBar(e); });
    root.querySelector('[data-next]').addEventListener('click', drill);
    speak(e.pos === 'noun' ? withArticle(e) : e.it);
  }
  function drill() {
    const qs = [qTranslateMC(e, pool, 'it-en'), e.pos === 'noun' ? qGender(e) : qCloze(e, { pool }), Math.random() < 0.5 && e.pos === 'noun' ? qPluralMC(e, pool) : qTranslateMC(e, pool, 'en-it'), qTypeIt(e)].filter(Boolean);
    runDrill(root, qs, {
      title: 'Word check', gameId: 'word-intro', backHref: '#/learn', xpPer: 2, record: false,
      onDone: (result) => {
        const passed = result.score >= 50;
        if (passed && !store.isLearned(e.id)) store.markLearned(e.id, 'word');
        store.recordGame('word-intro', result);
        const day = store.today();
        const left = Math.max(0, store.settings.dailyNew - ((day.new || 0) - (day.newVerbs || 0)));
        const next = nextNew('word', 1)[0];
        if (auto && passed && next && left > 0) { location.replace('#/learn/word/' + encodeURIComponent(next.id) + '?auto=1'); return; }
        showResults(root, result, {
          backHref: '#/learn', passScore: 50,
          onReplay: drill,
          extraHTML: passed
            ? html`<div class="card accent"><b>${headword(e)}</b> learned ✓${next ? raw(html`<div class="mt"><a class="btn block" style="background:#fff;color:var(--primary-2)" href="#/learn/word/${encodeURIComponent(next.id)}${auto ? '?auto=1' : ''}">Next word: ${headword(next)} →</a></div>`) : ''}</div>`
            : html`<div class="card"><b>Not yet.</b> Look at the card again and retry.<div class="mt"><button class="btn ghost block" data-meet>Back to the card</button></div></div>`,
        });
        root.querySelector('[data-meet]')?.addEventListener('click', meet);
      },
    });
  }
  meet();
}
