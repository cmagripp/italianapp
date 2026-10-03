// Home: greeting, ticker of recent words, TODAY pane (counters + weekly rail + Continue), level ribbon (homeLevels.js),
// word & verb of the day, reel of game posters.
import { html, raw, tr, speakBtn, levelBadge, secHead, fmtNum, toast, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store, todayKey } from '../store.js';
import { data, LEVELS, LEVEL_INFO, dailyPick, headword, getEntry, withArticle, article, isPluralOnly, nounNumberNote, CATS, itemsForScope } from '../data.js';
import { IT_POS } from '../components.js';
import { conjugate, primary } from '../conjugator.js';
import { GAMES } from '../games/index.js';
import { posterHTML } from './games.js';
import { levelRibbonHTML, bindLevelRibbon } from './homeLevels.js';
import { setScene, ticker, reel, mount, countUp, parallax } from '../fx.js';
import { homeLearning } from '../learning/home-learning.js';
import {dailyPlan} from '../learning/daily-plan.js';
import {loadGrammarCourse} from '../learning/grammar-course.js';
import {planPanelHTML,openPlanBudget} from '../learning/plan-panel.js';

const ic = (name, opts) => raw(icon(name, opts));
const REEL_GAMES = ['flashcards', 'quiz', 'conj-drill', 'crossword', 'speed'];

function levelProgress(L) {
  let total = 0, learned = 0;
  for (const e of data.vocab) if (e.level === L) { total++; if (store.isLearned(e.id)) learned++; }
  for (const e of data.verbs) if (e.level === L) { total++; if (store.isLearned(e.id)) learned++; }
  return { total, learned };
}
// display size for a headword inside a half-width card (the estimate; fitDayCards measures it once the card is laid out)
const fit = (w) => { const n = String(w || '').length; return n <= 6 ? 32 : n <= 9 ? 28 : n <= 13 ? 24 : n <= 18 ? 20 : 17; };
const HW_SIZES = [32, 28, 24, 20, 17];
const HW_LINE = 1.05;

function recentlyLearned(n = 14) {
  return Object.entries(store.current.items)
    .filter(([id]) => store.isLearned(id))
    .sort((a, b) => (b[1].learnedAt || b[1].first || 0) - (a[1].learnedAt || a[1].first || 0))
    .slice(0, n).map(([id]) => getEntry(id)).filter(Boolean).map(headword);
}

// a short number note for the detail line (the full sentence is on the entry page)
function numberNote(e) {
  const note = nounNumberNote(e);
  if (!note) return 'pl. ' + withArticle(e, true);
  if (/singular/i.test(note)) return 'usually singular';
  if (/plural not/i.test(note)) return 'plural not recorded';
  return 'usually plural';
}

// Word / verb of the day: the Learn-card layout (learnCards.js) in a half-width glass card — kicker and level chip on
// top, the headword (with its article) over the English line with the speaker centred on that pair at the right, then
// the tag row and one mono detail line. The whole card opens the entry (data-href); the headword is the link.
function dayCard(e, kind) {
  if (!e) return '';
  const isNoun = e.pos === 'noun';
  const plural = isNoun && isPluralOnly(e);
  const art = isNoun ? article(e, plural) : '';
  const word = e.kind === 'verb' ? e.inf : (plural ? e.pl : e.it);
  const say = e.kind === 'verb' ? e.inf : (isNoun ? withArticle(e, plural) : e.it);
  const href = '#/entry/' + encodeURIComponent(e.id);
  let tags, detail;
  if (e.kind === 'verb') {
    const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
    tags = html`<span>${c.group}</span><span>${c.irregular ? 'irregolare' : 'regolare'}</span>`;
    detail = `p.p. ${primary(c.nonFinite.participioPassato)} · aux. ${e.aux === 'both' ? 'avere / essere' : e.aux}`;
  } else {
    tags = html`<span>${IT_POS[e.pos] || e.pos}</span>${isNoun ? raw(html`<span>${e.g === 'mf' ? 'm · f' : e.g}</span>`) : ''}`;
    // the number note keeps its own hook: the noun-forms suite checks that the plural or the usage guidance is shown
    const topic = e.cat && CATS[e.cat] ? html`${CATS[e.cat].name}` : '';
    const number = isNoun ? html`<span data-night-number>${numberNote(e)}</span>` : '';
    const joined = [topic, number].filter(Boolean).join(' · ');
    detail = joined ? raw(joined) : '';
  }
  const size = fit(word);
  return html`<article class="night-card glass float ${kind === 'verb' ? 'delay' : ''}" style="--glow:${kind === 'verb' ? 'var(--gold)' : 'var(--amalfi)'}" data-href="${href}">
    <div class="night-top"><span class="kicker">${kind === 'verb' ? 'Verb of the day' : 'Word of the day'}</span>${raw(levelBadge(e.level || 'A1'))}</div>
    <div class="night-main">
      <div class="night-hw">${art ? raw(html`<span class="article">${art}</span>`) : ''}<a class="word" href="${href}" style="--hw:${size}px" data-hw="${size}" aria-label="Open ${word}">${word}</a></div>
      <div class="night-en">${e.en || ''}</div>
      ${raw(speakBtn(say, 'sm'))}
    </div>
    <div class="tags">${raw(tags)}</div>
    <div class="night-extra mono">${detail || raw('&nbsp;')}</div>
  </article>`;
}

// Measured fit: with the cards laid out, each headword starts from its estimate (data-hw) and steps down while it runs
// past two lines or breaks a word in two (lines > words) beside the speaker. Runs on render and once the web fonts
// are ready, so a fallback font never leaves a wrong size behind.
function fitDayCards(container) {
  if (!container) return;
  for (const w of container.querySelectorAll('.night-hw .word')) {
    if (!w.clientWidth) continue;
    const top = Number(w.dataset.hw) || HW_SIZES[0];
    const words = (w.textContent.match(/\S+/g) || []).length || 1;
    const range = document.createRange();
    for (const z of HW_SIZES) {
      if (z > top) continue;
      w.style.setProperty('--hw', `${z}px`);
      range.selectNodeContents(w);
      const lines = Math.round(range.getBoundingClientRect().height / (z * HW_LINE)) || 1;
      if (lines <= 2 && lines <= words) break;
    }
  }
}

export async function render(root) {
  await Promise.all([homeLearning(store),loadGrammarCourse().catch(() => null)]);
  const plan=dailyPlan(store);
  setTitle(''); // the top bar shows "Parola" on its own; 'Parola' here made the document title "Parola · Parola"
  const p = store.current;
  const day = store.today();
  const s = p.settings;
  let lvl = LEVELS.includes(s.level) ? s.level : 'A1';
  const hour = new Date().getHours();
  const [greetIt, greetEn] = hour < 12 ? ['Buongiorno', 'Good morning'] : hour < 18 ? ['Buon pomeriggio', 'Good afternoon'] : ['Buonasera', 'Good evening'];
  const now = new Date();
  const dateIt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const dateEn = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const streak = p.stats.streak || 0;
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = todayKey(d); const st = p.stats.days[k]; return { k, today: i === 6, active: !!(st && ((st.correct || 0) + (st.new || 0) + (st.games || 0)) > 0), label: 'SMTWTFS'[d.getDay()] }; });
  const activeDays = week.filter(d => d.active).length;
  const picks = (L) => ({ wotd: dailyPick(data.vocab.filter(e => e.level === L), 1), votd: dailyPick(data.verbs.filter(e => e.level === L), 2) });
  let { wotd, votd } = picks(lvl);
  const recent = recentlyLearned();
  const tickerWords = recent.length >= 4 ? recent : [...recent, wotd && headword(wotd), votd && votd.inf, 'parola', 'notte italiana'].filter(Boolean);
  const rings = () => LEVELS.map(L => ({ key: L, label: L, ...levelProgress(L) }));
  const reelGames = REEL_GAMES.map(id => GAMES.find(g => g.id === id)).filter(Boolean);

  root.innerHTML = html`
    <div class="home">
      <header class="greet"><div class="greet-inner" data-parallax>
        <div class="greet-row">
          <h1 class="greet-title">${raw(tr(greetIt, greetEn))}, ${p.name}.</h1>
          <span class="avatar" aria-hidden="true">${p.avatar}</span>
        </div>
        <div class="greet-meta mono"><span class="greet-date">${raw(tr(dateIt, dateEn))}</span><span class="greet-stats"><span class="streak">${ic('flame', { size: 14 })}${streak} day${streak === 1 ? '' : 's'}</span><i>·</i><span>${fmtNum(p.stats.xp)} XP</span></span></div>
      </div></header>

      <div class="ticker home-ticker" data-ticker></div>

      <section class="tonight glass pad-l">
        <div class="sec-head in-pane"><div><span class="kicker">Today</span><span class="title">${raw(tr('Il piano di oggi', 'Today’s plan'))}</span></div><span class="tonight-days mono">${activeDays} / 7 days</span></div>
        <div class="week">
          <div class="rail">${raw(week.map(d => `<span class="${d.today ? 'cur' : d.active ? 'done' : ''}"></span>`).join(''))}</div>
          <div class="week-days mono">${raw(week.map(d => `<span class="${d.today ? 'today' : ''}">${d.label}</span>`).join(''))}</div>
        </div>
        <div data-plan-host>${raw(planPanelHTML(plan))}</div>
      </section>

      <section class="night" data-night>${raw(dayCard(wotd, 'word'))}${raw(dayCard(votd, 'verb'))}</section>

      <section class="home-games">
        ${raw(secHead('Play', 'Oggi si gioca', { href: '#/games', more: 'All games' }))}
        <div class="reel" data-reel>${raw(reelGames.map(g => posterHTML(g, { href: '#/games?pick=' + g.id })).join(''))}</div>
      </section>

      <section class="levels">
        ${raw(secHead('Levels', 'Livelli', { href: '#/browse/' + lvl, more: 'Browse ' + lvl }))}
        <div class="home-levels" data-levels>${raw(levelRibbonHTML({ current: lvl, rings: rings() }))}</div>
      </section>
      <p class="center kicker home-foot">${fmtNum(data.vocab.length)} words · ${fmtNum(data.verbs.length)} verbs · A1–C2</p>
    </div>`;

  const home = root.querySelector('.home');
  mount(home);
  ticker(home.querySelector('[data-ticker]'), tickerWords);
  home.querySelectorAll('[data-count]').forEach((el, i) => setTimeout(() => countUp(el, Number(el.dataset.count), { duration: 900 }), 200 + i * 120));
  const reelApi = reel(home.querySelector('[data-reel]'));
  const unParallax = parallax(home.querySelector('[data-parallax]'), 0.12);
  const ribbon = bindLevelRibbon(home.querySelector('[data-levels]'), { onSelect: setLevel, current: lvl });
  fitDayCards(home.querySelector('[data-night]'));
  // the first measure runs on whatever font is in place; the web fonts (when they arrive) get a second one
  try { document.fonts?.ready?.then(() => { if (home.isConnected) fitDayCards(home.querySelector('[data-night]')); }); } catch { /* no Font Loading API */ }

  function setLevel(L) {
    if (!LEVELS.includes(L)) return;
    const changed = L !== lvl;
    lvl = L;
    store.setSetting('level', L);
    setScene(L);
    ribbon.update({ rings: rings(), current: L });
    const more = home.querySelector('.levels .sec-head .more'); if (more) { more.href = '#/browse/' + L; more.textContent = 'Browse ' + L; }
    ({ wotd, votd } = picks(L));
    const night = home.querySelector('[data-night]');
    night.innerHTML = dayCard(wotd, 'word') + dayCard(votd, 'verb');
    mount(night);
    fitDayCards(night);
    if (changed) toast(`Level ${L} · ${LEVEL_INFO[L].it}`, { kind: 'ok' });
  }

  home.addEventListener('click', (ev) => {
    const budget=ev.target.closest('[data-plan-budget]');
    if(budget){openPlanBudget(budget,store,()=>{home.querySelector('[data-plan-host]').innerHTML=planPanelHTML(dailyPlan(store));});return;}
    const card = ev.target.closest('[data-href]');
    if (card && !ev.target.closest('a, button, .itx, input')) location.hash = card.dataset.href;
  });
  return () => { reelApi.destroy(); unParallax(); ribbon.destroy(); };
}
