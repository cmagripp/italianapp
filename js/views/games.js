// Games hub: pick a game, then choose what to play with.
import { html, raw, esc, sheet } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { GAMES, TENSE_OPTIONS } from '../games/index.js';
import { sourceChoices, sourceLabel, resolveSource } from '../source.js';

let lastSrc = 'scope';

export function openSourcePicker(game, presetSrc) {
  const choices = sourceChoices();
  const opts = game.options || [];
  const chosen = { src: presetSrc || lastSrc, tenses: ['presente', 'passatoProssimo'] };
  for (const o of opts) chosen[o.key] = o.choices[0][0];
  const body = () => html`
    <div class="mood-title">Play with</div>
    <div class="list">${raw(choices.map(c => {
      const items = c.spec === chosen.src ? resolveSource(c.spec) : null;
      const n = game.kind === 'any' ? c.count : (items ? items.filter(e => game.kind === 'verb' ? e.kind === 'verb' : game.kind === 'noun' ? e.pos === 'noun' : e.kind === 'word').length : c.count);
      return html`<label class="item ${c.spec === chosen.src ? '' : ''}" style="cursor:pointer"><input type="radio" name="src" value="${c.spec}" ${c.spec === chosen.src ? 'checked' : ''}><div class="main"><div class="hw">${c.label}</div><div class="sub">${c.sub}</div></div><span class="badge">${n}</span></label>`;
    }).join(''))}</div>
    ${opts.length ? raw(opts.map(o => html`<div class="mood-title mt">${o.label}</div><div class="chips">${raw(o.choices.map(([v, l]) => html`<button class="chip ${chosen[o.key] === v ? 'on' : ''}" data-opt="${o.key}" data-val="${v}">${l}</button>`).join(''))}</div>`).join('')) : ''}
    ${game.tenses ? raw(html`<div class="mood-title mt">Tenses</div><div class="chips">${raw(TENSE_OPTIONS.map(([k, n]) => html`<button class="chip sm ${chosen.tenses.includes(k) ? 'on' : ''}" data-tense="${k}">${n}</button>`).join(''))}</div>`) : ''}
    <button class="btn primary block mt" data-start>Start ${game.name}</button>`;
  const s = sheet(body(), { title: `${game.icon} ${game.name}` });
  s.body.addEventListener('change', (ev) => { const r = ev.target.closest('input[name=src]'); if (r) { chosen.src = r.value; } });
  s.body.addEventListener('click', (ev) => {
    const o = ev.target.closest('[data-opt]'); if (o) { chosen[o.dataset.opt] = o.dataset.val; s.body.querySelectorAll(`[data-opt="${o.dataset.opt}"]`).forEach(x => x.classList.toggle('on', x === o)); return; }
    const t = ev.target.closest('[data-tense]'); if (t) { const k = t.dataset.tense; if (chosen.tenses.includes(k)) { if (chosen.tenses.length > 1) chosen.tenses = chosen.tenses.filter(x => x !== k); } else chosen.tenses.push(k); t.classList.toggle('on', chosen.tenses.includes(k)); return; }
    if (ev.target.closest('[data-start]')) {
      lastSrc = chosen.src;
      const q = new URLSearchParams({ src: chosen.src });
      for (const o of opts) q.set(o.key, chosen[o.key]);
      if (game.tenses) q.set('tenses', chosen.tenses.join(','));
      s.close();
      location.hash = `#/game/${game.id}?${q.toString()}`;
    }
  });
}

export async function render(root, params, query) {
  setTitle('Play');
  const stats = store.current.stats.games || {};
  const learnedV = store.learnedIds('v:').length;
  const section = (title, games) => html`<div class="section"><div class="section-head"><h2>${title}</h2></div><div class="grid2">${raw(games.map(g => html`<button class="tile" data-game="${g.id}"><span class="ico">${g.icon}</span><span class="name">${g.name}</span><span class="desc">${g.desc}</span>${stats[g.id] ? raw(html`<span class="tiny muted">played ${stats[g.id].played}× · best ${stats[g.id].best}%</span>`) : ''}</button>`).join(''))}</div></div>`;
  root.innerHTML = html`
    <div class="card accent"><div class="row between"><div><b>Play with what you know</b><div class="small muted">Every game can use your learned verbs and words, your word bank, any list, or a whole level.</div></div><span style="font-size:32px">🎮</span></div>
      <div class="row gap mt"><a class="btn sm" style="background:#fff;color:var(--primary-2)" href="#/game/quiz?src=learned">Quiz my learned items</a>${learnedV ? raw(html`<a class="btn sm" style="background:#fff;color:var(--primary-2)" href="#/game/conj-drill?src=learned-verbs&tenses=presente,passatoProssimo">Drill my verbs</a>`) : ''}</div>
    </div>` +
    section('Vocabulary games', GAMES.filter(g => g.kind === 'any' || g.kind === 'noun')) +
    section('Verb games', GAMES.filter(g => g.kind === 'verb'));
  root.addEventListener('click', (ev) => { const b = ev.target.closest('[data-game]'); if (!b) return; const g = GAMES.find(x => x.id === b.dataset.game); openSourcePicker(g); });
  if (query.pick) { const g = GAMES.find(x => x.id === query.pick); if (g) openSourcePicker(g, query.src); }
}
