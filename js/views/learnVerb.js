// Verb introduction flow: Meet → Forms → Drill → Learned.
import { html, raw, esc, toast, speak } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, data, shuffle, sample } from '../data.js';
import { verbHero, verbUsage, conjSection, bindConjSection, actionBar, bindActionBar } from '../components.js';
import { conjugate } from '../conjugator.js';
import { runDrill, showResults } from '../games/engine.js';
import { qTranslateMC, qConjMC, qConjType, qAux, qParticiple, qPattern, qCloze, qTenseDetective } from '../games/questions.js';
import { nextNew } from './learn.js';

const STEPS = ['Meet', 'Forms', 'Drill'];

function stepper(cur) { return `<div class="stepper">${STEPS.map((s, i) => `<div class="s ${i < cur ? 'done' : i === cur ? 'cur' : ''}" title="${s}"></div>`).join('')}</div>`; }

export async function render(root, params) {
  const e = getEntry(params.id);
  if (!e || e.kind !== 'verb') { root.innerHTML = '<div class="empty">Verb not found.</div>'; return; }
  setTitle(e.inf);
  store.pushRecent(e.id);
  const conj = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const pool = data.verbs.filter(v => v.level === e.level);
  let step = 0;

  function renderStep() {
    window.scrollTo(0, 0);
    if (step === 0) {
      root.innerHTML = stepper(0) + verbHero(e, conj) + verbUsage(e, conj) + html`<div class="card">${raw(actionBar(e))}</div>
        <div class="sticky-actions"><button class="btn primary block" data-next>See the forms →</button></div>`;
      bindActionBar(root, e, () => { root.querySelector('.card:has([data-act])').innerHTML = actionBar(e); });
      root.querySelector('[data-next]').addEventListener('click', () => { step = 1; renderStep(); });
      speak(e.inf);
    } else if (step === 1) {
      root.innerHTML = stepper(1) + html`<div class="hero" style="padding-bottom:0"><div class="word ${e.inf.length > 14 ? 'long' : ''}">${e.inf}</div><div class="en"><span class="itx inline" role="button" tabindex="0"><span class="it">meaning ▾</span><span class="tr">${e.en}</span></span></div></div>` + conjSection(e, conj) + html`
        <div class="card"><h4>Persons (casi)</h4><p class="small muted">io (I) · tu (you, informal) · lui/lei (he/she; Lei = formal you) · noi (we) · voi (you plural) · loro (they). Subject pronouns are usually dropped: the ending tells you who.</p>
        ${conj.irregular ? raw('<div class="note">This verb is <b>irregular</b>: watch the forms highlighted in the tables and the participle.</div>') : raw(html`<div class="note">Regular <b>${conj.group}</b> verb: once you know the pattern, you can conjugate every verb of this group.</div>`)}</div>
        <div class="sticky-actions"><button class="btn ghost" data-prev>←</button><button class="btn primary grow" data-next>Start the drill →</button></div>`;
      bindConjSection(root, conj);
      root.querySelector('[data-next]').addEventListener('click', () => { step = 2; renderStep(); });
      root.querySelector('[data-prev]').addEventListener('click', () => { step = 0; renderStep(); });
    } else {
      const qs = [
        qTranslateMC(e, pool, 'it-en'),
        qConjMC(e, 'presente', pool),
        qConjType(e, 'presente'),
        qAux(e),
        qParticiple(e, false),
        qConjMC(e, 'passatoProssimo', pool),
        qPattern(e) || qCloze(e, { pool }) || qTenseDetective(e),
        qConjType(e, sample(['presente', 'imperfetto', 'futuro'])),
        qTranslateMC(e, pool, 'en-it'),
      ].filter(Boolean);
      runDrill(root, qs, {
        title: 'Verb drill', gameId: 'verb-intro', backHref: '#/learn', xpPer: 3, passScore: 66, record: false,
        onDone: (result) => {
          const passed = result.score >= 66;
          if (passed && !store.isLearned(e.id)) store.markLearned(e.id, 'verb');
          store.recordGame('verb-intro', result);
          const next = nextNew('verb', 1)[0];
          showResults(root, result, {
            backHref: '#/learn', passScore: 66,
            onReplay: () => { step = 2; renderStep(); },
            extraHTML: passed
              ? html`<div class="card accent"><b>${e.inf}</b> added to your learned verbs 🎉<div class="small mt-s">It will now appear in reviews and in the games that use your learned verbs.</div></div>${next ? raw(html`<a class="btn block accent" href="#/learn/verb/${encodeURIComponent(next.id)}">Next verb: ${next.inf} →</a>`) : ''}`
              : html`<div class="card"><b>Almost!</b> Review the forms and try the drill again to add <b>${e.inf}</b> to your learned verbs.<div class="row gap mt"><button class="btn ghost grow" data-forms>Forms</button></div></div>`,
          });
          root.querySelector('[data-forms]')?.addEventListener('click', () => { step = 1; renderStep(); });
        },
      });
    }
  }
  renderStep();
}
