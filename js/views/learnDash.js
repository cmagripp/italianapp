// Learn · Panoramica dashboard. renderDash(container, model, ctx) draws the overview from the model built by
// learnData.js: the path hero (stage line + mode dial + one Start/Resume button), the in-progress stack of full-width
// cards, the "up next" reel and the verb-lab reel (both learnCards.js). Returns a cleanup function.
// Everything here is presentation: the model carries every href, count and label. The lab reel builder is exported
// (labReelHTML / mountLabReel) so the Sezioni view can draw the same Laboratorio.
import { html, raw, icon } from '../ui.js';
import { dial, mount, sheen, reducedMotion } from '../fx.js';
import { readPref, writePref, MODE_KEY } from './learnData.js';
import { learnReel, learnCardHTML } from './learnCards.js';

const ic = (name, opts) => raw(icon(name, opts));
const pct = (a, b) => (b ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);
const isLevel = (L) => /^[ABC][12]$/.test(String(L || ''));
const KIND = { grammar: { label: 'Grammar', c: 'var(--amalfi)' }, verb: { label: 'Verb', c: 'var(--gold)' }, word: { label: 'Word', c: 'var(--turquoise)' }, session: { label: 'Session', c: 'var(--terracotta)' } };
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const firstSense = (s) => String(s || '').split(';')[0].trim();
// a lesson title shortened for one italic line: the part before a colon or a dash, then the ellipsis does the rest
const shortTitle = (t) => String(t || '').split(/\s*[:—–]\s*|\s+-\s+/)[0].trim();
const stageName = (stage = {}) => (isLevel(stage.level) ? (stage.name || stage.level) : (stage.level || stage.name || ''));

// ---------- in corso ----------
function progressCard(item) {
  const k = KIND[item.kind] || KIND.session;
  const p = Math.max(0, Math.min(100, Math.round(item.pct || 0)));
  // the kind already sits in the kicker: the sub-line loses its "Grammar · " prefix
  const en = String(item.sub || '').replace(/^(Grammar|Verb|Word|Session)\s*·\s*/i, '');
  return learnCardHTML({ key: `thread-${item.kind}`, kicker: k.label, title: item.title, en, detail: 'Resume', ring: p, accent: k.c, href: item.href, thread: item.kind }, { kind: item.kind === 'grammar' || item.kind === 'session' ? 'next' : item.kind });
}

const inviteCard = () => html`<button type="button" class="dash-card dash-invite glass-flat" data-to-hero>
    <span class="dc-top"><span class="dc-kind"><span class="dc-ico">${ic('sparkle', { size: 16 })}</span><span class="kicker">In progress</span></span></span>
    <span class="dc-title it">Niente in corso, per ora.</span>
    <span class="dc-sub">Nothing in progress yet. Pick a mode on the dial above and press Start: whatever you begin is kept here.</span>
    <span class="dc-foot"><span class="dc-resume">Choose a mode</span></span>
  </button>`;

// ---------- prossimi passi ----------
function nextCards(next = {}, stage = {}, scope = {}) {
  const g = next.grammar, v = next.verb, w = next.words || { entries: [] }, r = next.review || {};
  const name = stageName(stage);
  const grammar = g
    ? { key: 'grammar', kicker: 'Grammar', title: name || g.unit || 'Grammar', en: shortTitle(g.title), detail: g.minutes ? `${g.minutes} min` : (g.unit || ''), level: g.level, icon: 'book', href: g.href }
    : { key: 'grammar', kicker: 'Grammar', title: 'Tappa completa', en: 'This stage is complete', detail: 'choose the next stage', level: stage.level, icon: 'book', href: stage.href || '#/course' };
  const verb = v
    ? { key: 'verb', kicker: 'Verb', title: v.name, en: firstSense(v.en), detail: v.chapterLabel || '', level: v.level, icon: 'dial', href: v.href }
    : { key: 'verb', kicker: 'Verb', title: 'Nessun verbo', en: 'No new verbs in this scope', detail: 'widen the scope', icon: 'dial', href: scope.href || '#/scope' };
  const entries = (w.entries || []).slice(0, 3);
  const wordLevel = entries.find(e => isLevel(e.level))?.level || null;
  const joined = entries.map(e => e.headword).join(' · ');
  const words = entries.length
    ? { key: 'words', kicker: 'Words', title: joined.length <= 24 ? joined : entries[0].headword, en: entries.map(e => firstSense(e.en)).filter(Boolean).join(' · '), detail: `${w.done || 0} of ${w.goal || 0} today`, level: wordLevel, ring: pct(w.done || 0, w.goal || 0), href: w.href }
    : { key: 'words', kicker: 'Words', title: 'Nessuna parola', en: 'No new words in this scope', detail: 'widen the scope', icon: 'sparkle', href: w.href || scope.href || '#/scope' };
  const due = r.due || 0;
  // the due ring fills against a nominal 20-card session: a full ring says "worth sitting down for"
  const review = { key: 'review', kicker: 'Review', title: 'Review', en: due ? plural(due, 'item') + ' due' : 'Tutto fresco', detail: r.nextDueLabel || (due ? 'due now' : 'review ahead'), ring: due ? pct(due, 20) : 0, icon: 'refresh', accent: due ? 'var(--gold)' : 'var(--ink-3)', href: due ? r.href : (r.aheadHref || r.href) };
  return [grammar, verb, words, review];
}
// the test hooks ride on the cards themselves: one element each
const HOOK = { grammar: 'grammar-next', words: 'vocabulary-heading', review: 'review-pane' };
function hookCards(container) {
  for (const [key, cls] of Object.entries(HOOK)) { const el = container.querySelector(`.lc[data-key="${key}"]`); if (el) el.classList.add(cls); }
}

// ---------- laboratorio ----------
const LAB_ICON = { 'conj-drill': 'edit', 'verb-quiz': 'sparkle', 'all-verbs': 'book', lists: 'list' };
const labCards = (lab = []) => lab.map(l => ({ key: l.key, kicker: l.key === 'frasi' ? 'Officina' : 'Verb lab', title: l.title, en: l.sub || '', detail: '', icon: l.icon || LAB_ICON[l.key] || 'sparkle', href: l.href }));
export const labReelHTML = (lab = []) => labCards(lab).map(c => learnCardHTML(c, { kind: 'lab' })).join('');
export function mountLabReel(container, model = {}) {
  if (!container) return { update() {}, scrollTo() {}, destroy() {} };
  container.classList.add('verb-lab');
  return learnReel(container, labCards(model.lab || []), { kind: 'lab', ariaLabel: 'Laboratorio' });
}

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
  if (idx < 0) idx = modes.findIndex(m => m.recommended);
  if (idx < 0) idx = modes.findIndex(m => m.key === 'together');
  if (idx < 0) idx = 0;
  const mode0 = modes[idx] || { title: 'Impariamo', sub: '', href: '#/learn/session', label: 'Insieme', key: 'together' };
  const inProgress = model.inProgress || [];
  // something already begun takes the button (Resume) while the dial sits on its mode; any other stop starts fresh
  const resume = inProgress[0] || null;
  const resumeLabel = resume ? (resume.kind === 'session' ? 'Resume session' : 'Resume lesson') : '';
  const units = stage.units || [];
  const unitIdx = units.findIndex(u => u.current);
  const stageLine = [stageName(stage), unitIdx >= 0 ? `unit ${unitIdx + 1} of ${units.length}` : '', stage.lessonsTotal ? `${stage.lessonsDone || 0} of ${plural(stage.lessonsTotal, 'lesson')}` : ''].filter(Boolean).join(' · ');

  container.innerHTML = html`<div class="dash">
    <section class="dash-hero glass course-preview" data-hero>
      <div class="dash-hero-top">
        <span class="kicker">Il tuo percorso · your path</span>
        <div class="dash-stage course-summary"><span class="dash-stage-main">${isLevel(stage.level) ? raw(html`<span class="lvl lvl-${stage.level}">${stage.level}</span>`) : ''}<span class="dash-stage-text" title="${stageLine}">${stageLine}</span></span>${stage.href ? raw(html`<button type="button" class="dash-change" data-href="${stage.href}">Change</button>`) : ''}</div>
      </div>
      <div class="dial-wrap dash-dial-wrap"><div class="dial dash-dial" data-dial aria-label="Learning mode"></div></div>
      <div class="dash-mode" data-mode-text>
        <h2 class="dash-title" data-title>${mode0.title}</h2>
        <p class="dash-sub" data-sub>${mode0.sub || ''}</p>
      </div>
      <a class="btn primary block dash-start" data-start href="${resume ? resume.href : mode0.href}">${resume ? resumeLabel : 'Start lesson'}</a>
    </section>

    <section class="dash-progress">
      <div class="sec-head"><div><span class="kicker">In progress</span><span class="title">In corso</span></div>${inProgress.length ? raw(html`<span class="mono sec-side">${plural(inProgress.length, 'thread')}</span>`) : ''}</div>
      <div class="dash-threads" data-threads>${raw(inProgress.length ? inProgress.map(progressCard).join('') : inviteCard())}</div>
    </section>

    <section class="dash-next">
      <div class="sec-head"><div><span class="kicker">Up next</span><span class="title">Prossimi passi</span></div></div>
      <div class="dash-next-reel" data-next-reel></div>
    </section>

    ${(model.lab || []).length ? raw(html`<section class="dash-lab">
      <div class="sec-head"><div><span class="kicker">Lab</span><span class="title">Laboratorio</span></div></div>
      <div class="dash-lab-reel" data-lab-reel></div>
    </section>`) : ''}
  </div>`;

  const root = container.querySelector('.dash');
  const hero = root.querySelector('[data-hero]');
  const titleEl = root.querySelector('[data-title]'), subEl = root.querySelector('[data-sub]'), modeText = root.querySelector('[data-mode-text]');
  const startBtn = root.querySelector('[data-start]');

  // The dial only previews: it rewrites the title, the sub-line and the button; nothing begins until it is pressed.
  let swapTimer = 0;
  function showMode(i, { save = false } = {}) {
    const m = modes[i]; if (!m) return;
    titleEl.textContent = m.title || m.label || '';
    subEl.textContent = m.sub || '';
    startBtn.dataset.mode = m.key || '';
    hero.dataset.mode = m.key || '';
    // the thread already begun belongs to the dial's fresh stop: there the button resumes, everywhere else it starts
    const resuming = !!resume && !!m.fresh;
    startBtn.textContent = resuming ? resumeLabel : 'Start lesson';
    startBtn.setAttribute('href', resuming ? resume.href : (m.href || '#/learn/session'));
    startBtn.classList.toggle('dash-resume', resuming);
    modeText.classList.remove('swap'); void modeText.offsetWidth; modeText.classList.add('swap');
    clearTimeout(swapTimer); swapTimer = setTimeout(() => modeText.classList.remove('swap'), reducedMotion() ? 150 : 450);
    if (save && m.key) { try { writePref(store, MODE_KEY, m.key); } catch { /* a convenience, never a blocker */ } }
  }
  const dialApi = modes.length
    ? dial(root.querySelector('[data-dial]'), { items: modes.map(m => ({ key: m.key, label: m.label, sub: m.key })), index: idx, step: 28, radius: 250, onChange: (i) => showMode(i, { save: true }) })
    : null;
  if (!modes.length) root.querySelector('.dash-dial-wrap').remove();
  showMode(idx);

  // the two reels (learnCards.js): up next and the verb lab
  const nextEl = root.querySelector('[data-next-reel]');
  const nextReel = learnReel(nextEl, nextCards(model.next, stage, scope), { kind: 'next', ariaLabel: 'Up next' });
  hookCards(nextEl);
  const labEl = root.querySelector('[data-lab-reel]');
  const labReel = labEl ? mountLabReel(labEl, model) : null;

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
    nextReel.destroy();
    if (labReel) labReel.destroy();
  };
}

export default renderDash;
