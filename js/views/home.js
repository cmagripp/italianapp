// Home: greeting, ticker of recent words, TONIGHT pane (counters + weekly rail + Continue), orbit of levels,
// word & verb of the night, reel of game posters.
import { html, raw, tr, enPill, speakBtn, levelBadge, secHead, fmtNum, toast, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store, todayKey } from '../store.js';
import { data, LEVELS, LEVEL_INFO, dailyPick, headword, getEntry, withArticle, article, isPluralOnly, CATS } from '../data.js';
import { IT_POS } from '../components.js';
import { conjugate, primary } from '../conjugator.js';
import { GAMES } from '../games/index.js';
import { posterHTML } from './games.js';
import { setScene, orbit, ticker, reel, mount, countUp, parallax } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));
const REEL_GAMES = ['flashcards', 'quiz', 'conj-drill', 'crossword', 'speed'];

function levelProgress(L) {
  let total = 0, learned = 0;
  for (const e of data.vocab) if (e.level === L) { total++; if (store.isLearned(e.id)) learned++; }
  for (const e of data.verbs) if (e.level === L) { total++; if (store.isLearned(e.id)) learned++; }
  return { total, learned };
}
// display size for a headword inside a half-width card
const fit = (w) => { const n = String(w || '').length; return n <= 6 ? 32 : n <= 9 ? 28 : n <= 13 ? 24 : n <= 18 ? 20 : 17; };

function recentlyLearned(n = 14) {
  return Object.entries(store.current.items)
    .filter(([, it]) => it.learned)
    .sort((a, b) => (b[1].learnedAt || b[1].first || 0) - (a[1].learnedAt || a[1].first || 0))
    .slice(0, n).map(([id]) => getEntry(id)).filter(Boolean).map(headword);
}

function nightCard(e, kind) {
  if (!e) return '';
  const isNoun = e.pos === 'noun';
  const plural = isNoun && isPluralOnly(e);
  const art = isNoun ? article(e, plural) : '';
  const word = e.kind === 'verb' ? e.inf : (plural ? e.pl : e.it);
  const say = e.kind === 'verb' ? e.inf : (isNoun ? withArticle(e, plural) : e.it);
  const href = '#/entry/' + encodeURIComponent(e.id);
  let tags = '', extra = '';
  if (e.kind === 'verb') {
    const c = conjugate(e.inf, { aux: e.aux, isc: e.isc });
    tags = html`<span>${c.group}</span><span>${c.irregular ? 'irregolare' : 'regolare'}</span>`;
    extra = html`<div class="night-extra mono">p.p. ${primary(c.nonFinite.participioPassato)} · aux. ${e.aux === 'both' ? 'avere / essere' : e.aux}</div>`;
  } else {
    tags = html`<span>${IT_POS[e.pos] || e.pos}</span>${isNoun ? raw(html`<span>${e.g === 'mf' ? 'm · f' : e.g}</span>`) : ''}`;
    extra = e.cat && CATS[e.cat] ? html`<div class="night-extra mono">${CATS[e.cat].name}</div>` : '';
  }
  return html`<article class="night-card glass float ${kind === 'verb' ? 'delay' : ''}" style="--glow:${kind === 'verb' ? 'var(--gold)' : 'var(--amalfi)'}" data-href="${href}">
    <div class="night-top"><span class="kicker">${kind === 'verb' ? 'Verb of the night' : 'Word of the night'}</span><a class="icon-btn night-open" href="${href}" aria-label="Open ${word}">${ic('chevronRight', { size: 20 })}</a></div>
    <div class="night-hw">${art ? raw(html`<span class="article">${art}</span>`) : ''}<a class="word" href="${href}" style="--hw:${fit(word)}px">${word}</a></div>
    <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(say))}</div>
    <div class="tags">${raw(levelBadge(e.level || 'A1'))}${raw(tags)}</div>
    ${raw(extra)}
  </article>`;
}

export async function render(root) {
  setTitle('Parola');
  const p = store.current;
  const day = store.today();
  const s = p.settings;
  const due = store.dueIds().length;
  const newWordsLeft = Math.max(0, s.dailyNew - ((day.new || 0) - (day.newVerbs || 0)));
  const newVerbsLeft = Math.max(0, s.dailyVerbs - (day.newVerbs || 0));
  let lvl = LEVELS.includes(s.level) ? s.level : 'A1';
  const hour = new Date().getHours();
  const [greetIt, greetEn] = hour < 12 ? ['Buongiorno', 'Good morning'] : hour < 18 ? ['Buon pomeriggio', 'Good afternoon'] : ['Buonasera', 'Good evening'];
  const now = new Date();
  const dateIt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const dateEn = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const streak = p.stats.streak || 0;
  const goalDone = newWordsLeft === 0 && newVerbsLeft === 0 && due === 0;
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = todayKey(d); const st = p.stats.days[k]; return { k, today: i === 6, active: !!(st && ((st.correct || 0) + (st.new || 0) + (st.games || 0)) > 0), label: 'SMTWTFS'[d.getDay()] }; });
  const activeDays = week.filter(d => d.active).length;
  const continueHref = due ? '#/review' : '#/learn';
  const continueHint = due ? `review · ${due} due` : goalDone ? 'keep going · learn ahead' : newVerbsLeft ? `learn · ${newVerbsLeft} new verb${newVerbsLeft === 1 ? '' : 's'}` : `learn · ${newWordsLeft} new word${newWordsLeft === 1 ? '' : 's'}`;
  const picks = (L) => ({ wotd: dailyPick(data.vocab.filter(e => e.level === L), 1), votd: dailyPick(data.verbs.filter(e => e.level === L), 2) });
  let { wotd, votd } = picks(lvl);
  const recent = recentlyLearned();
  const tickerWords = recent.length >= 4 ? recent : [...recent, wotd && headword(wotd), votd && votd.inf, 'parola', 'notte italiana'].filter(Boolean);
  const rings = () => LEVELS.map(L => ({ key: L, label: L, ...levelProgress(L) }));
  const levelCaption = (L) => { const pr = levelProgress(L); return html`<span class="lvl-name">${LEVEL_INFO[L].name}</span><span class="mono">${pr.learned} / ${pr.total} learned</span>`; };
  const reelGames = REEL_GAMES.map(id => GAMES.find(g => g.id === id)).filter(Boolean);

  root.innerHTML = html`
    <div class="home">
      <header class="greet"><div class="greet-inner" data-parallax>
        <div class="greet-row">
          <h1 class="greet-title">${raw(tr(greetIt, greetEn))}, ${p.name}.</h1>
          <span class="avatar" aria-hidden="true">${p.avatar}</span>
        </div>
        <div class="greet-meta mono">${raw(tr(dateIt, dateEn))}<i>·</i><span class="streak">${ic('flame', { size: 14 })}${streak} day${streak === 1 ? '' : 's'}</span><i>·</i><span>${fmtNum(p.stats.xp)} XP</span></div>
      </div></header>

      <div class="ticker home-ticker" data-ticker></div>

      <section class="tonight glass pad-l">
        <div class="sec-head in-pane"><div><span class="kicker">Tonight</span><span class="title">${raw(tr('Il piano di stasera', 'Tonight’s plan'))}</span></div><span class="tonight-days mono">${activeDays} / 7 days</span></div>
        <div class="counters">
          <div class="stat"><div class="num" data-count="${due}">0</div><div class="lab">to review</div></div>
          <div class="stat"><div class="num" data-count="${newWordsLeft}">0</div><div class="lab">new words</div></div>
          <div class="stat"><div class="num" data-count="${newVerbsLeft}">0</div><div class="lab">new verbs</div></div>
        </div>
        <div class="week">
          <div class="rail">${raw(week.map(d => `<span class="${d.today ? 'cur' : d.active ? 'done' : ''}"></span>`).join(''))}</div>
          <div class="week-days mono">${raw(week.map(d => `<span class="${d.today ? 'today' : ''}">${d.label}</span>`).join(''))}</div>
        </div>
        <a class="btn primary block" href="${continueHref}" data-continue>Continue${ic('arrow', { size: 20 })}</a>
        <div class="tonight-hint mono">${continueHint}</div>
      </section>

      <section class="levels">
        ${raw(secHead('Your orbit', 'Livelli', { href: '#/browse/' + lvl, more: 'Browse ' + lvl }))}
        <div class="orbit-pane glass pad">
          <div class="orbit" data-orbit></div>
          <div class="orbit-caption" data-caption>${raw(levelCaption(lvl))}</div>
          <div class="orbit-levels" role="group" aria-label="Set your level">${raw(LEVELS.map(L => html`<button type="button" class="lvl lvl-${L} lg ${L === lvl ? 'on' : ''}" data-level="${L}" aria-pressed="${L === lvl ? 'true' : 'false'}">${L}</button>`).join(''))}</div>
          <div class="orbit-hint mono">tap a ring to set your level</div>
        </div>
      </section>

      <section class="night" data-night>${raw(nightCard(wotd, 'word'))}${raw(nightCard(votd, 'verb'))}</section>

      <section class="home-games">
        ${raw(secHead('Play', 'Stasera si gioca', { href: '#/games', more: 'All games' }))}
        <div class="reel" data-reel>${raw(reelGames.map(g => posterHTML(g, { href: '#/games?pick=' + g.id })).join(''))}</div>
      </section>
      <p class="center kicker home-foot">${fmtNum(data.vocab.length)} words · ${fmtNum(data.verbs.length)} verbs · A1–C2</p>
    </div>`;

  const home = root.querySelector('.home');
  mount(home);
  ticker(home.querySelector('[data-ticker]'), tickerWords);
  home.querySelectorAll('[data-count]').forEach((el, i) => setTimeout(() => countUp(el, Number(el.dataset.count), { duration: 900 }), 200 + i * 120));
  const reelApi = reel(home.querySelector('[data-reel]'));
  const unParallax = parallax(home.querySelector('[data-parallax]'), 0.12);
  const orbitApi = orbit(home.querySelector('[data-orbit]'), { rings: rings(), current: lvl, center: { value: fmtNum(p.stats.xp), label: 'XP' }, onSelect: setLevel });

  function setLevel(L) {
    if (!LEVELS.includes(L)) return;
    const changed = L !== lvl;
    lvl = L;
    store.setSetting('level', L);
    setScene(L);
    orbitApi.update({ rings: rings(), current: L, center: { value: fmtNum(store.current.stats.xp), label: 'XP' } });
    home.querySelectorAll('[data-level]').forEach(b => { const on = b.dataset.level === L; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    home.querySelector('[data-caption]').innerHTML = levelCaption(L);
    const more = home.querySelector('.levels .sec-head .more'); if (more) { more.href = '#/browse/' + L; more.textContent = 'Browse ' + L; }
    ({ wotd, votd } = picks(L));
    const night = home.querySelector('[data-night]');
    night.innerHTML = nightCard(wotd, 'word') + nightCard(votd, 'verb');
    mount(night);
    if (changed) toast(`Level ${L} · ${LEVEL_INFO[L].it}`, { kind: 'ok' });
  }

  home.addEventListener('click', (ev) => {
    const lb = ev.target.closest('[data-level]'); if (lb) { setLevel(lb.dataset.level); return; }
    const card = ev.target.closest('[data-href]');
    if (card && !ev.target.closest('a, button, .itx, input')) location.hash = card.dataset.href;
  });
  return () => { reelApi.destroy(); unParallax(); };
}
