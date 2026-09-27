// Home: today's plan, streak & XP, quick actions, word & verb of the day.
import { html, raw, esc, levelBadge, progressBar, fmtNum, speakBtn } from '../ui.js';
import { setTitle } from '../app.js';
import { store, todayKey } from '../store.js';
import { data, LEVELS, LEVEL_INFO, itemsForScope, dailyPick, headword, shortEn, describeScope } from '../data.js';
import { entryRow } from '../components.js';
import { conjugate, primary } from '../conjugator.js';

function levelProgress(L) {
  const items = [...data.vocab, ...data.verbs].filter(e => e.level === L);
  const learned = items.filter(e => store.isLearned(e.id)).length;
  return { total: items.length, learned };
}

export async function render(root) {
  setTitle('Parola');
  const p = store.current;
  const day = store.today();
  const s = p.settings;
  const due = store.dueIds().length;
  const scopeItems = itemsForScope(store.scope, store);
  const newWordsLeft = Math.max(0, s.dailyNew - ((day.new || 0) - (day.newVerbs || 0)));
  const newVerbsLeft = Math.max(0, s.dailyVerbs - (day.newVerbs || 0));
  const lvl = s.level || 'A1';
  const lp = levelProgress(lvl);
  const wotd = dailyPick(data.vocab.filter(e => e.level === lvl), 1);
  const votd = dailyPick(data.verbs.filter(e => e.level === lvl), 2);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const goalDone = newWordsLeft === 0 && newVerbsLeft === 0 && due === 0;
  const totalLearned = store.learnedIds().length;
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = todayKey(d); const st = p.stats.days[k]; return { k, active: !!(st && ((st.correct || 0) + (st.new || 0)) > 0), label: 'SMTWTFS'[d.getDay()] }; });

  root.innerHTML = html`
    <div class="row between mb">
      <div><h1 style="margin:0">${greet}, ${p.name}!</h1><div class="muted small">${describeScope(store.scope, store)} · <a href="#/scope">change</a></div></div>
      <div class="avatar">${p.avatar}</div>
    </div>
    <div class="card ${goalDone ? 'accent' : ''}">
      <div class="row between"><h3 style="margin:0">Today</h3><span class="badge ${goalDone ? '' : 'ok'}">🔥 ${p.stats.streak || 0} day streak</span></div>
      <div class="grid3 mt">
        <div class="stat"><div class="num">${due}</div><div class="lab">to review</div></div>
        <div class="stat"><div class="num">${newWordsLeft}</div><div class="lab">new words</div></div>
        <div class="stat"><div class="num">${newVerbsLeft}</div><div class="lab">new verbs</div></div>
      </div>
      <div class="row gap mt" style="justify-content:space-between">${raw(week.map(d => html`<div class="col center"><div class="dot" style="width:12px;height:12px;background:${d.active ? (goalDone ? '#fff' : 'var(--primary)') : 'var(--line)'}"></div><div class="tiny muted">${d.label}</div></div>`).join(''))}</div>
      <div class="row gap mt">
        ${due ? raw(html`<a class="btn primary grow" href="#/review">Review ${due}</a>`) : ''}
        <a class="btn ${due ? '' : 'primary'} grow" href="#/learn">${goalDone ? 'Keep going' : 'Learn new'}</a>
      </div>
    </div>

    <div class="grid2">
      <a class="tile" href="#/games"><span class="ico">🎮</span><span class="name">Play</span><span class="desc">21 games with your words</span></a>
      <a class="tile" href="#/search"><span class="ico">🔍</span><span class="name">Search</span><span class="desc">Italian or English</span></a>
    </div>

    <div class="section mt">
      <div class="section-head"><h2>Your level: ${lvl}</h2><a href="#/browse/${lvl}">browse</a></div>
      <div class="card level-card"><div class="lv" style="background:${LEVEL_INFO[lvl].color}">${lvl}</div><div class="grow"><div class="bold">${LEVEL_INFO[lvl].name}</div><div class="tiny muted">${lp.learned} / ${lp.total} learned · ${fmtNum(p.stats.xp)} XP total · ${totalLearned} items learned overall</div>${raw(progressBar(lp.learned, lp.total, 'thin mt'))}</div></div>
    </div>

    ${wotd ? raw(html`<div class="section"><div class="section-head"><h2>Word of the day</h2></div>${raw(entryRow(wotd))}</div>`) : ''}
    ${votd ? raw(html`<div class="section"><div class="section-head"><h2>Verb of the day</h2></div>${raw(entryRow(votd, { extra: html`<span class="tiny muted">${primary(conjugate(votd.inf, { aux: votd.aux, isc: votd.isc }).nonFinite.participioPassato)}</span>` }))}</div>`) : ''}

    <div class="section">
      <div class="section-head"><h2>Levels</h2></div>
      <div class="list">${raw(LEVELS.map(L => { const pr = levelProgress(L); return html`<a class="item" href="#/browse/${L}"><div class="lv" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:900;color:#fff;background:${LEVEL_INFO[L].color}">${L}</div><div class="main"><div class="hw">${LEVEL_INFO[L].name}</div><div class="sub">${pr.total} entries · ${pr.learned} learned</div>${raw(progressBar(pr.learned, pr.total, 'thin mt'))}</div></a>`; }).join(''))}</div>
    </div>
    <p class="center tiny muted">${fmtNum(data.vocab.length)} words · ${fmtNum(data.verbs.length)} verbs · A1–C2</p>`;
}
