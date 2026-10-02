// The sentence workshop's path page (#/lab/frasi): the four stages as a vertical path of lesson rows (locked, next, open,
// done from the engine's labProgress), a resume card for an unfinished lesson, the learner's "Le mie frasi", and the
// Strumenti pane: the speaker gender the adjectives agree with, the optional fit scorer download (layer 2) and the
// experimental on-device assistant (layer 3). Both tools are imported lazily, so the page works when they are absent.
import { html, raw, icon, toast, confirmDialog } from '../ui.js';
import { setTitle, setChrome } from '../app.js';
import { store } from '../store.js';
import { setScene, mount } from '../fx.js';
import { labProgress } from '../learning/sentence-lab.js';
import { loadSentenceLab, labLesson, openLabSessions, LAB_KEY } from '../learning/sentence-lab-data.js';
import { labSentencesList } from '../learning/sentence-lab-activities.js';

const STAGE_NO = ['01', '02', '03', '04'];
const fmtMB = bytes => `${Math.round((Number(bytes) || 0) / 1048576)} MB`;
// Tool state survives navigation inside the page lifetime (a download in flight keeps reporting when the page is reopened).
const tools = { fit: { module: null, support: null, status: null, installing: false, loaded: 0, total: 0, error: '' }, assistant: { module: null, support: null, state: null, loading: false, progress: '', error: '' } };
const ASSISTANT_REASON = { 'no-webgpu': 'Needs WebGPU (Safari 26 / Chrome 113 or later).', 'low-memory': 'This device reports too little memory for the model.', 'no-adapter': 'No graphics adapter is available to WebGPU.', 'no-f16': 'The graphics adapter has no 16-bit shaders, which the model needs.', 'adapter-error': 'WebGPU could not open the graphics adapter.', 'no-navigator': 'Not available here.' };

async function fitModule() { if (tools.fit.module === null) { try { tools.fit.module = await import('../learning/fit-scorer.js'); } catch { tools.fit.module = false; } } return tools.fit.module || null; }
async function assistantModule() { if (tools.assistant.module === null) { try { tools.assistant.module = await import('../learning/assistant.js'); } catch { tools.assistant.module = false; } } return tools.assistant.module || null; }
async function refreshTools() {
  const fit = await fitModule();
  if (fit) { try { tools.fit.support = fit.fitScorerSupport(); tools.fit.status = await fit.fitScorerStatus(); tools.fit.total ||= fit.FIT_BYTES; } catch (err) { tools.fit.error = err.message; } }
  const assistant = await assistantModule();
  if (assistant) { try { tools.assistant.support = assistant.assistantSupport(); tools.assistant.state = assistant.assistantState(); } catch (err) { tools.assistant.error = err.message; } }
}

const switchHTML = (attr, on, label, { disabled = false } = {}) => html`<button type="button" class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${label}" ${raw(attr)} ${disabled ? raw('disabled') : ''}></button>`;

export async function render(root) {
  setTitle('Officina delle frasi'); setChrome({ tabs: true, back: true });
  setScene(store.current?.settings?.level || 'A1');
  root.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  let stages;
  try { ({ stages } = await loadSentenceLab()); }
  catch (err) { root.innerHTML = html`<div class="empty"><p>The workshop could not load its lessons.</p><p class="tiny muted">${err.message}</p><button type="button" class="btn primary" onclick="location.reload()">Retry</button></div>`; return; }
  let disposed = false;
  const total = stages.reduce((n, p) => n + p.lessons.length, 0);

  function toolsHTML() {
    const fit = tools.fit, as = tools.assistant;
    const gender = store.settings.gender === 'f' ? 'f' : 'm';
    let fitSub, fitOn = false, fitDisabled = false, fitBar = '';
    if (fit.module === false) { fitSub = 'Not available in this build.'; fitDisabled = true; }
    else if (fit.support && !fit.support.supported) { fitSub = `Cannot run here: ${fit.support.reason}.`; fitDisabled = true; }
    else if (fit.installing) { fitSub = `Downloading… ${fmtMB(fit.loaded)} / ${fmtMB(fit.total)}`; fitOn = true; fitDisabled = true; fitBar = html`<div class="bar thin lab-tool-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${fit.total ? Math.round(100 * fit.loaded / fit.total) : 0}"><div class="bar-fill" style="width:${fit.total ? Math.round(100 * fit.loaded / fit.total) : 0}%"></div></div>`; }
    else if (fit.status?.installed) { fitSub = `Installed · ${fmtMB(fit.status.bytes)} kept offline. Your free-entry words get a note: natural, unusual here or odd here.`; fitOn = true; }
    else fitSub = `Rates how natural your free-entry word sounds in the blank, next to the authored options. One-time download of about ${fit.total ? fmtMB(fit.total) : '83 MB'}, kept offline; it only advises, never blocks.`;
    if (fit.error) fitSub += ` ${fit.error}`;
    let asSub, asOn = false, asDisabled = false, asExtra = '';
    const st = as.state;
    if (as.module === false) { asSub = 'Not available in this build.'; asDisabled = true; }
    else if (as.support && !as.support.supported) { asSub = ASSISTANT_REASON[as.support.reason] || `Cannot run here (${as.support.reason}).`; asDisabled = true; }
    else if (as.loading) { asSub = as.progress || 'Loading the model…'; asOn = true; asDisabled = true; }
    else if (st?.breaker?.tripped) { asSub = 'Paused: the page stopped twice while the assistant was working. It stays off until you try again.'; asExtra = html`<button type="button" class="btn ghost xs" data-lab-assistant-reset>Try again</button>`; asDisabled = true; }
    else if (st?.enabled) { asOn = true; asSub = st.loaded ? 'On · loaded. In conversations it picks the most fitting of the authored replies.' : 'On · loads the next time a conversation needs it.'; }
    else asSub = 'A small language model (Qwen3 0.6B, about 340 MB, WebGPU) that only chooses among authored replies in conversations. Experimental: it may be slow or crash the page on some phones; a crash-loop breaker switches it off.';
    if (st?.error && !st.enabled && !as.loading) asSub += ` Last attempt: ${st.error === 'tripped' ? 'breaker tripped' : st.error}.`;
    return html`<section class="lab-tools glass-flat" data-lab-tools>
      <div class="sec-head in-pane"><div><span class="kicker">Strumenti</span><span class="title">Tools</span></div></div>
      <div class="opt-row"><div class="lab-tool-main"><div class="lab">Parlo al… · I speak as</div><div class="sub">Adjectives in your free entries agree with you: sono stanco or sono stanca.</div></div><div class="seg no-anim lab-gender" role="radiogroup" aria-label="Speaker gender">${raw(['m', 'f'].map(v => html`<button type="button" role="radio" aria-checked="${gender === v ? 'true' : 'false'}" class="${gender === v ? 'on' : ''}" data-lab-gender="${v}">${v === 'm' ? 'maschile' : 'femminile'}</button>`).join(''))}</div></div>
      <div class="opt-row" data-tool="fit"><div class="lab-tool-main"><div class="lab">Fit scorer · 70 MB download</div><div class="sub" data-fit-status>${fitSub}</div>${raw(fitBar)}</div>${raw(switchHTML('data-lab-fit', fitOn, 'Fit scorer', { disabled: fitDisabled }))}</div>
      <div class="opt-row" data-tool="assistant"><div class="lab-tool-main"><div class="lab">Assistente · experimental</div><div class="sub" data-assistant-status>${asSub}</div>${raw(asExtra)}</div>${raw(switchHTML('data-lab-assistant', asOn, 'Assistant', { disabled: asDisabled }))}</div>
      <p class="tiny muted lab-tools-note">Both run entirely on this device: nothing you type or say leaves it. The downloads come from this site (the scorer) and from the model's public repository (the assistant), once, and stay in the browser's storage.</p>
    </section>`;
  }

  function draw() {
    if (disposed) return;
    const record = store.labRecord(LAB_KEY);
    const progress = labProgress(stages, record);
    const done = progress.reduce((n, s) => n + s.done, 0);
    const open = openLabSessions(store).map(x => ({ ...x, lesson: labLesson(x.lessonId) })).filter(x => x.lesson);
    const resume = open[0] || null;
    const sentences = record.sentences.slice().reverse().slice(0, 12).map(s => ({ ...s, title: labLesson(s.lessonId)?.title || '' }));
    const stageHTML = progress.map((stage, si) => html`<section class="lab-stage ${stage.open ? 'is-open' : 'is-locked'}" data-stage="${stage.stage}" aria-label="${stage.title}">
      <header class="lab-stage-head"><span class="lab-stage-no">${STAGE_NO[si] || String(si + 1).padStart(2, '0')}</span><div><h2>${stage.title}</h2><p>${stage.subtitle}</p></div><span class="lab-stage-count mono">${stage.done} / ${stage.total}</span></header>
      <ol class="lab-lessons">${raw(stage.lessons.map((l, li) => {
        const locked = l.state === 'locked';
        const inner = html`<span class="lab-lesson-state" data-state="${l.state}" aria-hidden="true">${raw(l.state === 'done' ? icon('check', { size: 18 }) : l.state === 'locked' ? icon('lock', { size: 16 }) : l.state === 'next' ? icon('arrow', { size: 18 }) : `<span class="lab-lesson-dot"></span>`)}</span><span class="lab-lesson-main"><span class="lab-lesson-title" lang="it">${l.title}</span><span class="lab-lesson-outcome">${l.outcome}</span></span><span class="lab-lesson-meta mono">${l.state === 'done' ? 'done' : l.state === 'next' ? 'next' : l.state === 'locked' ? '' : 'open'}${l.minutes ? raw(html`<span>${l.minutes} min</span>`) : ''}</span>`;
        return locked ? html`<li><div class="lab-lesson" data-state="locked" data-lesson="${l.id}" aria-disabled="true">${raw(inner)}</div></li>` : html`<li><a class="lab-lesson" data-state="${l.state}" data-lesson="${l.id}" href="#/lab/frasi/${encodeURIComponent(l.id)}" aria-label="${l.title}, ${l.state === 'done' ? 'done' : l.state === 'next' ? 'next lesson' : 'open'}">${raw(inner)}</a></li>`;
      }).join(''))}</ol>
    </section>`).join('');
    root.innerHTML = html`<div class="lab-page" data-lab-page>
      <header class="lab-hero glass">
        <span class="kicker">Laboratorio</span>
        <h1 lang="it">Officina delle frasi</h1>
        <p class="lab-hero-sub">Sentence workshop · Build sentences from who, what and when; conversations that reply; your own words in every blank.</p>
        <div class="lab-hero-progress"><span class="mono" data-lab-progress>${done} / ${total} lessons</span><div class="bar thin"><div class="bar-fill" style="width:${total ? Math.round(100 * done / total) : 0}%"></div></div></div>
      </header>
      ${resume ? raw(html`<a class="lab-resume glass-flat" href="#/lab/frasi/${encodeURIComponent(resume.lessonId)}" data-lab-resume="${resume.lessonId}"><span class="lab-resume-main"><span class="kicker">Riprendi · Resume</span><strong lang="it">${resume.lesson.title}</strong><span class="sub">${resume.session.paused ? 'Paused' : 'In progress'} · activity ${Math.min(resume.session.index + 1, resume.lesson.activities.length)} of ${resume.lesson.activities.length}</span></span><span class="lab-resume-go">${raw(icon('arrow', { size: 20 }))}</span></a>`) : ''}
      <div class="lab-path">${raw(stageHTML)}</div>
      <section class="lab-mine glass-flat" data-lab-mine>
        <div class="sec-head in-pane"><div><span class="kicker">Le mie frasi</span><span class="title">My sentences</span></div>${record.sentences.length > 12 ? raw(html`<span class="more">${record.sentences.length} kept</span>`) : ''}</div>
        ${sentences.length ? raw(labSentencesList(sentences)) : raw('<p class="lab-empty">The sentences you compose in “Say it yourself” are kept here, with their English, to replay any time.</p>')}
      </section>
      ${raw(toolsHTML())}
    </div>`;
    mount(root.querySelector('[data-lab-page]'));
  }

  // ---------- tools ----------
  async function toggleFit(on) {
    const fit = await fitModule(); if (!fit) return;
    if (on) {
      tools.fit.installing = true; tools.fit.loaded = 0; tools.fit.error = ''; draw();
      try {
        tools.fit.status = await fit.installFitScorer(({ loaded, total }) => { tools.fit.loaded = loaded; tools.fit.total = total; const bar = root.querySelector('.lab-tool-bar .bar-fill'), sub = root.querySelector('[data-fit-status]'); if (bar) bar.style.width = `${total ? Math.round(100 * loaded / total) : 0}%`; if (sub) sub.textContent = `Downloading… ${fmtMB(loaded)} / ${fmtMB(total)}`; });
        toast(tools.fit.status?.installed ? 'Fit scorer installed.' : 'The download did not complete.', { kind: tools.fit.status?.installed ? 'ok' : 'ko' });
      } catch (err) { tools.fit.error = err.message; toast(err.message, { ms: 4000, kind: 'ko' }); }
      tools.fit.installing = false;
    } else {
      if (!(await confirmDialog('Remove the fit scorer? The 83 MB download is deleted; you can install it again later.', { ok: 'Remove', danger: true }))) { draw(); return; }
      try { await fit.removeFitScorer(); toast('Fit scorer removed.'); } catch (err) { toast(err.message, { ms: 4000, kind: 'ko' }); }
    }
    await refreshTools(); draw();
  }
  async function toggleAssistant(on) {
    const assistant = await assistantModule(); if (!assistant) return;
    if (on) {
      tools.assistant.loading = true; tools.assistant.progress = 'Loading the model…'; draw();
      const state = await assistant.enableAssistant(({ text, progress }) => { tools.assistant.progress = `${Math.round((progress || 0) * 100)}% · ${text || 'loading'}`; const sub = root.querySelector('[data-assistant-status]'); if (sub) sub.textContent = tools.assistant.progress; });
      tools.assistant.loading = false; tools.assistant.state = state;
      if (state.loaded) toast('Assistant on.', { kind: 'ok' });
      else toast(state.breaker?.tripped ? 'The assistant is paused by its crash-loop breaker.' : `The assistant could not start${state.error ? `: ${ASSISTANT_REASON[state.error] || state.error}` : ''}.`, { ms: 4500, kind: 'ko' });
    } else { tools.assistant.state = await assistant.disableAssistant(); toast('Assistant off. The downloaded model stays in the browser.'); }
    await refreshTools(); draw();
  }
  const click = async event => {
    const b = event.target.closest('button'); if (!b || disposed) return;
    if (b.hasAttribute('data-lab-gender')) { store.setSetting('gender', b.dataset.labGender === 'f' ? 'f' : 'm'); draw(); return; }
    if (b.hasAttribute('data-lab-fit')) { await toggleFit(b.getAttribute('aria-checked') !== 'true'); return; }
    if (b.hasAttribute('data-lab-assistant')) { await toggleAssistant(b.getAttribute('aria-checked') !== 'true'); return; }
    if (b.hasAttribute('data-lab-assistant-reset')) { const assistant = await assistantModule(); if (assistant) { tools.assistant.state = assistant.resetAssistantBreaker(); toast('Breaker reset. Switch the assistant on to try again.'); draw(); } }
  };
  root.addEventListener('click', click);
  draw();
  refreshTools().then(() => { if (!disposed) draw(); });
  return () => { disposed = true; root.removeEventListener('click', click); };
}
