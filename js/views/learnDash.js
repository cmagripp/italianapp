// Learn · Panoramica dashboard. renderDash(container, model, ctx) draws the overview from the model built by
// learnData.js: the path hero (stage line + mode dial + one Start button), the in-progress reel, the 2×2 "up next"
// tiles, the stage strip, the slim vocabulary-scope row and the verb-lab tiles. Returns a cleanup function.
// Everything here is presentation: the model carries every href, count and label; ctx wires the two menus.
import { html, raw, icon, levelBadge } from '../ui.js';
import { dial, mount, sheen, reducedMotion } from '../fx.js';
import { readPref, writePref, MODE_KEY } from './learnData.js';

const ic = (name, opts) => raw(icon(name, opts));
const pct = (a, b) => (b ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);
const isLevel = (L) => /^[ABC][12]$/.test(String(L || ''));
const lvlVar = (L) => (isLevel(L) ? `var(--lvl-${L})` : 'var(--gold)');
const KIND = { grammar: { label: 'Grammar', icon: 'book', c: 'var(--amalfi)' }, verb: { label: 'Verb', icon: 'dial', c: 'var(--gold)' }, word: { label: 'Word', icon: 'sparkle', c: 'var(--turquoise)' }, session: { label: 'Session', icon: 'play', c: 'var(--terracotta)' } };
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---------- pieces ----------
const ring = (p, inner, color) => html`<span class="ring dash-ring" style="--p:${p};--rc:${raw(color || 'var(--gold)')}" aria-hidden="true"><span>${raw(inner)}</span></span>`;

function progressCard(item) {
  const k = KIND[item.kind] || KIND.session;
  const p = Math.max(0, Math.min(100, Math.round(item.pct || 0)));
  return html`<a class="dash-card glass-flat" href="${item.href}" style="--rc:${raw(k.c)}">
    <span class="dc-top"><span class="dc-kind"><span class="dc-ico">${ic(k.icon, { size: 16 })}</span><span class="kicker">${k.label}</span></span>${raw(ring(p, `${p}<i>%</i>`, k.c))}</span>
    <span class="dc-title">${item.title}</span>
    <span class="dc-sub mono">${item.sub || ''}</span>
    <span class="dc-foot"><span class="dc-bar" aria-hidden="true"><i style="width:${p}%"></i></span><span class="dc-resume">Resume${ic('arrow', { size: 14 })}</span></span>
  </a>`;
}

const inviteCard = () => html`<button type="button" class="dash-card dash-invite glass-flat" data-to-hero>
    <span class="dc-top"><span class="dc-kind"><span class="dc-ico">${ic('sparkle', { size: 16 })}</span><span class="kicker">In progress</span></span><span class="dc-up">${ic('chevronUp', { size: 18 })}</span></span>
    <span class="dc-title it">Niente in corso, per ora.</span>
    <span class="dc-sub">Nothing in progress yet. Pick a mode on the dial above and press Start: whatever you begin is kept here.</span>
    <span class="dc-foot"><span class="dc-resume">Choose a mode${ic('arrow', { size: 14 })}</span></span>
  </button>`;

// Tile grammar shared by "up next" and the verb lab: icon top-left (+ kicker), one figure top-right (a number, a ring
// or a level), a display name, a mono sub-line and a chevron; the whole tile is the link; a level tints the top hairline.
function tile({ href, iconName, kicker = '', figure = '', name, nameCls = '', sub = '', level = null, cls = '' }) {
  const lc = level ? lvlVar(level) : null;
  return html`<a class="dash-tile ${cls} ${lc ? 'has-lvl' : ''}" href="${href}" ${lc ? raw(`style="--lc:${lc}"`) : ''}>
    <span class="dt-top"><span class="dt-ico">${ic(iconName, { size: 18 })}</span>${kicker ? raw(html`<span class="dt-kicker kicker">${kicker}</span>`) : ''}${figure ? raw(html`<span class="dt-fig">${raw(figure)}</span>`) : ''}</span>
    <span class="dt-name ${nameCls}">${raw(name)}</span>
    <span class="dt-foot"><span class="dt-sub mono">${sub}</span><span class="dt-chev">${ic('chevronRight', { size: 18 })}</span></span>
  </a>`;
}

function nextTiles(next = {}, stage = {}, scope = {}) {
  const g = next.grammar, v = next.verb, w = next.words || { entries: [] }, r = next.review || {};
  const esc = (s) => html`${s}`;
  // the sub-line leads with the level so it survives the ellipsis on a 375px tile
  const grammar = g
    ? tile({ href: g.href, iconName: 'book', kicker: 'Grammar', figure: `<b class="num">${g.minutes || 0}</b><span class="unit">min</span>`, name: esc(g.title), sub: [g.level, g.unit, g.minutes ? `${g.minutes} min` : ''].filter(Boolean).join(' · '), level: g.level, cls: 'grammar-next' })
    : tile({ href: stage.href || '#/course', iconName: 'book', kicker: 'Grammar', name: esc('Tappa completa'), nameCls: 'it', sub: [stage.level, 'choose the next stage'].filter(Boolean).join(' · '), cls: 'grammar-next' });
  const verb = v
    ? tile({ href: v.href, iconName: 'dial', kicker: 'Verb', figure: isLevel(v.level) ? levelBadge(v.level) : '', name: esc(v.name), sub: [v.chapterLabel, v.en].filter(Boolean).join(' · '), level: v.level })
    : tile({ href: scope.href || '#/scope', iconName: 'dial', kicker: 'Verb', name: esc('Nessun verbo'), nameCls: 'it', sub: 'widen the scope' });
  const entries = (w.entries || []).slice(0, 3);
  const wordLevel = entries.find(e => isLevel(e.level))?.level || null;
  const words = entries.length
    ? tile({ href: w.href, iconName: 'sparkle', kicker: 'Words', figure: ring(pct(w.done || 0, w.goal || 0), `${w.done || 0}<i>/${w.goal || 0}</i>`, wordLevel ? lvlVar(wordLevel) : 'var(--gold)'), name: entries.map(e => html`<span>${e.headword}</span>`).join(''), nameCls: 'words', sub: `${w.done || 0} of ${w.goal || 0} today`, level: wordLevel, cls: 'vocabulary-heading' })
    : tile({ href: w.href || scope.href || '#/scope', iconName: 'sparkle', kicker: 'Words', name: esc('Nessuna parola'), nameCls: 'it', sub: 'widen the scope', cls: 'vocabulary-heading' });
  const due = r.due || 0;
  // the due ring fills against a nominal 20-card session: a full ring says "worth sitting down for"
  const review = tile({ href: due ? r.href : (r.aheadHref || r.href), iconName: 'refresh', kicker: 'Review', figure: ring(due ? pct(due, 20) : 0, `${due}`, due ? 'var(--gold)' : 'var(--ink-4)'), name: esc(due ? 'Ripasso' : 'Tutto fresco'), nameCls: due ? '' : 'it', sub: due ? plural(due, 'item') + ' due' : (r.nextDueLabel || 'review ahead'), cls: 'review-pane' });
  return grammar + verb + words + review;
}

function stageStrip(stage = {}) {
  const units = stage.units || [];
  if (!units.length) return '';
  const segs = units.map(u => { const f = pct(u.done || 0, u.total || 0); const done = u.total && u.done >= u.total; return html`<i class="${u.current ? 'cur' : ''} ${done ? 'done' : ''}" style="--f:${f}" title="${u.title}"></i>`; }).join('');
  const cur = units.find(u => u.current);
  return html`<a class="dash-strip glass-flat" href="${stage.href || '#/course'}" aria-label="Open this stage">
    <span class="dash-units" aria-hidden="true">${raw(segs)}</span>
    <span class="ds-foot">
      <span class="ds-main"><span class="kicker">${cur ? 'Current unit' : 'Units'}</span><span class="ds-title">${stage.currentUnitTitle || (cur && cur.title) || stage.name || ''}</span></span>
      <span class="ds-count mono">${stage.lessonsDone ?? 0} / ${stage.lessonsTotal ?? 0}</span>
      <span class="ds-chev">${ic('chevronRight', { size: 18 })}</span>
    </span>
  </a>`;
}

const labTiles = (lab = []) => lab.map(l => tile({ href: l.href, iconName: l.icon || 'sparkle', name: html`${l.title}`, sub: l.sub || '', cls: 'lab' })).join('');

// ---------- render ----------
export function renderDash(container, model = {}, ctx = {}) {
  if (!container) return () => {};
  const stage = model.stage || {};
  const modes = (model.modes || []).filter(Boolean);
  const scope = model.scope || {};
  const store = ctx.store;
  const saved = readPref(store, MODE_KEY, null);
  let idx = modes.findIndex(m => m.fresh);
  if (idx < 0) idx = modes.findIndex(m => m.key === saved);
  if (idx < 0) idx = modes.findIndex(m => m.key === 'together');
  if (idx < 0) idx = 0;
  const mode0 = modes[idx] || { title: 'Impariamo', sub: '', href: '#/learn/session', label: 'Insieme', key: 'together' };
  const inProgress = model.inProgress || [];
  // something already begun takes the primary button (Resume); the dial then drives a quieter Start button
  const resume = inProgress[0] || null;
  const resumeLabel = resume ? (resume.kind === 'session' ? 'Resume session' : 'Resume') : '';
  const stageLine = `${stage.name || ''}${stage.lessonsTotal ? ` · ${stage.lessonsDone || 0} of ${plural(stage.lessonsTotal, 'lesson')}` : ''}`;

  container.innerHTML = html`<div class="dash">
    <section class="dash-hero glass course-preview" data-hero>
      <div class="dash-hero-top">
        <span class="kicker">Il tuo percorso · your path</span>
        <div class="dash-stage course-summary"><span class="dash-stage-main">${stage.level ? raw(levelBadge(stage.level)) : ''}<span class="dash-stage-text">${stageLine}</span></span>${stage.href ? raw(html`<button type="button" class="dash-change" data-href="${stage.href}">Change</button>`) : ''}</div>
      </div>
      <div class="dial-wrap dash-dial-wrap"><div class="dial dash-dial" data-dial aria-label="Learning mode"></div></div>
      <div class="dash-mode" data-mode-text>
        <h2 class="dash-title" data-title>${mode0.title}</h2>
        <p class="dash-sub" data-sub>${mode0.sub || ''}</p>
      </div>
      ${resume
        ? raw(html`<a class="btn primary block dash-start dash-resume" data-resume href="${resume.href}">${resumeLabel} ${resume.kind === 'session' ? '' : raw(html`<span class="dash-mode-tag">${resume.title}</span>`)}${ic('arrow', { size: 20 })}</a>`)
        : raw(html`<a class="btn primary block dash-start" data-start href="${mode0.href}">Start <span class="dash-mode-tag" data-start-tag>${mode0.label}</span>${ic('arrow', { size: 20 })}</a>`)}
      <div class="dash-hero-foot">
        ${resume
          ? raw(html`<a class="btn ghost xs dash-start-alt" data-start href="${mode0.href}">Start <span class="dash-mode-tag" data-start-tag>${mode0.label}</span></a>`)
          : raw(html`<span class="dash-hint mono">${modes.length > 1 ? 'dial to preview' : ''}</span>`)}
        <button type="button" class="btn ghost xs dash-session" data-session-menu aria-haspopup="menu" aria-expanded="false">Start a session${ic('chevronDown', { size: 14 })}</button>
      </div>
    </section>

    <div class="dash-scope glass-flat">
      <span class="dash-scope-main"><span class="kicker">Vocabulary scope</span><span class="dash-scope-val mono"><span class="dash-scope-label">${scope.label || 'All words'}</span><i>·</i><span>${scope.learned ?? 0}/${scope.total ?? 0}</span></span></span>
      <button type="button" class="icon-btn dash-scope-menu" data-scope-menu aria-haspopup="menu" aria-expanded="false" aria-label="Change the vocabulary scope">${ic('chevronDown', { size: 20 })}</button>
      <a class="icon-btn dash-scope-open" href="${scope.href || '#/scope'}" aria-label="Scope details">${ic('arrow', { size: 20 })}</a>
    </div>

    <section class="dash-progress">
      <div class="sec-head"><div><span class="kicker">In progress</span><span class="title">In corso</span></div>${inProgress.length ? raw(html`<span class="mono sec-side">${plural(inProgress.length, 'thread')}</span>`) : ''}</div>
      <div class="reel compact dash-reel" data-reel>${raw(inProgress.length ? inProgress.map(progressCard).join('') : inviteCard())}</div>
    </section>

    <section class="dash-next">
      <div class="sec-head"><div><span class="kicker">Up next</span><span class="title">Prossimi passi</span></div></div>
      <div class="dash-tiles">${raw(nextTiles(model.next, stage, scope))}</div>
    </section>

    ${(stage.units || []).length ? raw(html`<section class="dash-stage-sec">
      <div class="sec-head"><div><span class="kicker">This stage</span><span class="title">Questa tappa</span></div>${stage.href ? raw(html`<a class="more" href="${stage.href}">All units</a>`) : ''}</div>
      ${raw(stageStrip(stage))}
    </section>`) : ''}

    ${(model.lab || []).length ? raw(html`<section class="dash-lab">
      <div class="sec-head"><div><span class="kicker">Verb lab</span><span class="title">Laboratorio</span></div></div>
      <div class="dash-tiles verb-lab">${raw(labTiles(model.lab))}</div>
    </section>`) : ''}
  </div>`;

  const root = container.querySelector('.dash');
  const hero = root.querySelector('[data-hero]');
  const titleEl = root.querySelector('[data-title]'), subEl = root.querySelector('[data-sub]'), modeText = root.querySelector('[data-mode-text]');
  const startBtn = root.querySelector('[data-start]'), startTag = root.querySelector('[data-start-tag]');

  // The dial only previews: it rewrites the title, the sub-line and the Start button; nothing begins until Start is pressed.
  let swapTimer = 0;
  function showMode(i, { save = false } = {}) {
    const m = modes[i]; if (!m) return;
    titleEl.textContent = m.title || m.label || '';
    subEl.textContent = m.sub || '';
    startTag.textContent = m.label || '';
    startBtn.dataset.mode = m.key || '';
    hero.dataset.mode = m.key || '';
    // with a saved session the dial's "together" stop is that same session: one link is enough, so the quiet
    // Start loses its href as well as its box (a hidden duplicate link would still be counted by assistive tech)
    const dup = !!resume && (m.href || '') === (resume.href || '');
    startBtn.hidden = dup;
    if (dup) startBtn.removeAttribute('href'); else startBtn.setAttribute('href', m.href || '#/learn/session');
    modeText.classList.remove('swap'); void modeText.offsetWidth; modeText.classList.add('swap');
    clearTimeout(swapTimer); swapTimer = setTimeout(() => modeText.classList.remove('swap'), reducedMotion() ? 150 : 450);
    if (save && m.key) { try { writePref(store, MODE_KEY, m.key); } catch { /* a convenience, never a blocker */ } }
  }
  const dialApi = modes.length
    ? dial(root.querySelector('[data-dial]'), { items: modes.map(m => ({ key: m.key, label: m.label, sub: m.key })), index: idx, step: 28, radius: 250, onChange: (i) => showMode(i, { save: true }) })
    : null;
  if (!modes.length) root.querySelector('.dash-dial-wrap').remove();
  showMode(idx);

  // menus belong to the shell (scope picker, session picker); the dashboard only hands over the buttons
  const scopeBtn = root.querySelector('[data-scope-menu]');
  if (scopeBtn && typeof ctx.bindScopeMenu === 'function') ctx.bindScopeMenu(scopeBtn);
  const sessionBtn = root.querySelector('[data-session-menu]');
  if (sessionBtn && typeof ctx.bindSessionMenu === 'function') ctx.bindSessionMenu(sessionBtn);

  const onClick = (e) => {
    const go = e.target.closest('button[data-href]');
    if (go) { location.hash = go.dataset.href; return; }
    if (e.target.closest('[data-to-hero]')) {
      hero.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      sheen(startBtn);
      try { root.querySelector('[data-dial]')?.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  };
  root.addEventListener('click', onClick);
  mount(root);

  return () => {
    clearTimeout(swapTimer);
    root.removeEventListener('click', onClick);
    if (dialApi) dialApi.destroy();
  };
}

export default renderDash;
