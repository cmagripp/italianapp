// Shared scene engine for the verb and word walkthroughs ("Notte italiana" cinematic learn flow).
// A vertical scroll-snap deck of full-height .scene cards: mono step counter + title, centred body, CTA footer;
// a right-edge rail of step segments; per-scene aurora hue (fx.setScene); scale/blur entry animation; haptics;
// gating (the CTA stays locked until the scene's interaction is done, a subtle "skip" appears after 6 s — never trap);
// keyboard-safe typed inputs; plus an inline question renderer (multiple choice / typed with accent bar) and a
// results block shared by both views.
//
// createWalkthrough(root, { level, scenes: [{ key, title, colors, cta, lockLabel, hintLocked, hintReady, noSkip,
//   render(body, api), enter(api, first), leave(api) }] }) → { destroy(), goto(i), current }
// Scene api: ready(), isReady(), setHelper(fn → element|null), refresh(), next(), goto(i), isCurrent(), setHint(text),
//   parallax(el, factor), el, body, level, index.
// [data-next] always marks the one element that advances the walkthrough right now (the CTA when the scene is ready,
// otherwise the scene's helper such as "Reveal all" / "Not sure — show me"), so the generic e2e player can drive it.
import { html, raw, esc, haptic, speak, icon } from '../ui.js';
import { setChrome } from '../app.js';
import { setScene, mount, reducedMotion, sheen, shake, countUp, stamp, confetti, SCENES } from '../fx.js';
import { checkTyped, accentBar, bindAccentBar, revealInScroller } from '../games/engine.js';
import { shuffle } from '../data.js';

const pad2 = (n) => String(n).padStart(2, '0');
export const SKIP_AFTER_MS = 6000;

export function createWalkthrough(root, { level = 'A1', scenes: defs = [] } = {}) {
  const n = defs.length;
  root.innerHTML = '';
  document.body.classList.add('walkthrough');
  setChrome({ tabs: false, back: true });

  const container = document.createElement('div');
  container.className = 'scenes wt-scenes';
  const rail = document.createElement('div');
  rail.className = 'rail v wt-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML = defs.map(() => '<span></span>').join('');
  root.append(container, rail);

  let current = -1;
  let lastNext = null;
  let destroyed = false;
  let gotoTimer = null;
  const scenes = [];
  const parallaxItems = [];

  // ---------- hooks: exactly one [data-next] at a time ----------
  function sync() {
    if (destroyed) return;
    const s = scenes[current];
    let target = document.querySelector('.dropdown-layer .dropdown.open [data-value]');
    if (!target && s) {
      if (s.ready) target = s.cta && !s.cta.disabled ? s.cta : null;
      else target = s.helper ? s.helper() : null;
      if (target && (target.disabled || target.hidden || target.closest('[hidden]'))) target = null;
    }
    if (lastNext && lastNext !== target) lastNext.removeAttribute('data-next');
    if (target) target.setAttribute('data-next', '');
    lastNext = target;
  }
  function clearNext() { if (lastNext) lastNext.removeAttribute('data-next'); lastNext = null; }

  // "more below" affordance: the scene gets .more while its body can still scroll down
  function paintMore(s) {
    if (!s) return;
    const b = s.body;
    const more = b.classList.contains('scrollable') && b.scrollHeight - b.clientHeight - b.scrollTop > 12;
    if (s.el.classList.contains('more') !== more) s.el.classList.toggle('more', more);
  }
  function checkOverflow(s) {
    if (!s || s.el.hidden) return;
    const b = s.body;
    const want = b.scrollHeight > b.clientHeight + 6;
    if (b.classList.contains('scrollable') !== want) b.classList.toggle('scrollable', want);
    paintMore(s);
  }

  function reveal(i) {
    const s = scenes[i];
    if (!s || s.revealed) return;
    s.revealed = true;
    s.el.hidden = false;
  }

  function setReady(s, { skipped = false } = {}) {
    if (s.ready) return;
    s.ready = true; s.skipped = skipped;
    clearTimeout(s.skipTimer);
    if (s.skip) s.skip.hidden = true;
    s.foot.classList.remove('locked');
    if (s.cta) {
      s.cta.disabled = false;
      s.cta.classList.remove('locked');
      s.cta.innerHTML = `<span class="lab">${esc(s.def.cta || 'Avanti')}</span>${icon('arrow', { size: 18 })}`;
      if (current === s.i && !reducedMotion()) sheen(s.cta);
    }
    s.hint.textContent = s.def.hintReady ?? (s.i === n - 1 ? '' : 'Swipe up or tap to continue');
    reveal(s.i + 1);
    sync();
    checkOverflow(s);
  }

  function goto(j) {
    const s = scenes[j];
    if (!s) return;
    // a scene is reachable as soon as its predecessor is done (covers scenes readied before the deck existed)
    if (!s.revealed && scenes[j - 1] && scenes[j - 1].ready) reveal(j);
    if (!s.revealed) return;
    clearNext();
    container.scrollTo({ top: s.el.offsetTop, behavior: reducedMotion() ? 'auto' : 'smooth' });
    // fallback: if the observer has not switched scenes within a second (throttled tab, long smooth scroll), do it
    clearTimeout(gotoTimer);
    gotoTimer = setTimeout(() => {
      if (destroyed || current === j) return;
      container.scrollTo({ top: s.el.offsetTop, behavior: 'auto' });
      setCurrent(j);
    }, 1000);
  }

  // ---------- scenes ----------
  defs.forEach((def, i) => {
    const el = document.createElement('section');
    el.className = 'scene wt-scene';
    el.dataset.i = String(i);
    el.dataset.key = def.key || String(i);
    el.hidden = i > 0;
    // noSkip scenes (Meet, Drill, Finito) never get a skip control at all
    el.innerHTML = html`<div class="scene-head"><span class="step">${pad2(i + 1)} / ${pad2(n)}</span><span class="title">${def.title || ''}</span></div>
      <div class="scene-body"></div>
      <div class="scene-foot locked">
        ${def.cta === false ? '' : raw(html`<button type="button" class="btn primary block wt-cta locked" data-cta disabled>${raw(icon('lock', { size: 18 }))}<span class="lab">${def.lockLabel || 'Complete this step'}</span></button>`)}
        <div class="foot-row"><span class="hint">${def.hintLocked || ''}</span>${def.noSkip ? '' : raw(html`<button type="button" class="skip" data-skip hidden>Skip this step${raw(icon('chevronRight', { size: 14 }))}</button>`)}</div>
      </div>`;
    container.append(el);
    const s = {
      i, def, el,
      body: el.querySelector('.scene-body'),
      foot: el.querySelector('.scene-foot'),
      cta: el.querySelector('[data-cta]'),
      hint: el.querySelector('.hint'),
      skip: el.querySelector('[data-skip]'),
      ready: false, revealed: i === 0, entered: false, helper: null, skipTimer: null, cleanup: null,
    };
    s.body.addEventListener('scroll', () => paintMore(s), { passive: true });
    s.api = {
      index: i, el, body: s.body, level,
      ready: (opts) => setReady(s, opts),
      isReady: () => s.ready,
      setHelper(fn) { s.helper = fn; sync(); },
      refresh() { sync(); checkOverflow(s); },
      next: () => goto(i + 1),
      goto,
      isCurrent: () => current === i,
      setHint(text) { s.hint.textContent = text || ''; },
      setLockLabel(text) { const lab = !s.ready && s.cta && s.cta.querySelector('.lab'); if (lab) lab.textContent = text || s.def.lockLabel || 'Complete this step'; },
      parallax(target, factor = 0.15) { if (target) parallaxItems.push({ el: target, scene: el, factor }); },
    };
    if (s.cta) s.cta.addEventListener('click', () => { if (s.ready) goto(i + 1); });
    if (s.skip) s.skip.addEventListener('click', () => { setReady(s, { skipped: true }); goto(i + 1); });
    el.addEventListener('animationend', (ev) => { if (ev.target === el) el.classList.remove('in'); });
    scenes.push(s);
    try { const c = def.render && def.render(s.body, s.api); if (typeof c === 'function') s.cleanup = c; }
    catch (err) { console.error(err); s.body.innerHTML = `<div class="empty"><p>Qualcosa è andato storto.</p></div>`; setReady(s); }
  });
  // scenes that became ready while rendering (Meet, Finito…) could not reveal a successor that did not exist yet
  for (const s of scenes) if (s.ready) reveal(s.i + 1);

  // ---------- current scene tracking ----------
  function paintRail() {
    [...rail.children].forEach((seg, j) => { seg.classList.toggle('done', j < current); seg.classList.toggle('cur', j === current); });
  }
  function setCurrent(i) {
    if (destroyed || i === current) return;
    const prev = scenes[current];
    if (prev) {
      prev.el.classList.remove('in');
      clearTimeout(prev.skipTimer);
      if (prev.skip) prev.skip.hidden = true;
      try { prev.def.leave && prev.def.leave(prev.api); } catch (err) { console.error(err); }
    }
    current = i;
    clearTimeout(gotoTimer);
    const s = scenes[i];
    paintRail();
    setScene(s.def.colors || level, { level });
    if (prev) haptic('light');
    if (!reducedMotion()) { s.el.classList.remove('in'); void s.el.offsetWidth; s.el.classList.add('in'); }
    const first = !s.entered;
    if (first) { s.entered = true; mount(s.body); }
    try { s.def.enter && s.def.enter(s.api, first); } catch (err) { console.error(err); }
    if (!s.ready && !s.def.noSkip && s.skip) {
      s.skipTimer = setTimeout(() => { if (current === i && !s.ready && s.skip) s.skip.hidden = false; }, SKIP_AFTER_MS);
    }
    if (s.ready && s.cta && !reducedMotion()) sheen(s.cta);
    sync();
    checkOverflow(s);
  }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting && en.intersectionRatio >= .55) setCurrent(Number(en.target.dataset.i));
  }, { root: container, threshold: [.55] });
  scenes.forEach(s => io.observe(s.el));
  // content that arrives later (drill questions, typewriter, feedback) changes the body height: re-check overflow
  let moRaf = 0;
  const ownClass = (r) => r.type === 'attributes' && r.attributeName === 'class' && (r.target.classList.contains('scene-body') || r.target.classList.contains('wt-scene') || r.target.classList.contains('scene-foot'));
  const mo = new MutationObserver((records) => {
    if (records.every(ownClass)) return; // our own .scrollable / .more / .locked toggles
    if (!moRaf) moRaf = requestAnimationFrame(() => { moRaf = 0; if (!destroyed) checkOverflow(scenes[current]); });
  });
  mo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });

  // parallax of registered elements (hero word on the meet card) against the deck scroll
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (reducedMotion()) return;
      const y = container.scrollTop, h = container.clientHeight || 1;
      for (const p of parallaxItems) {
        const d = y - p.scene.offsetTop;
        p.el.style.transform = Math.abs(d) > h ? '' : `translate3d(0, ${(d * p.factor).toFixed(1)}px, 0)`;
      }
    });
  };
  container.addEventListener('scroll', onScroll, { passive: true });

  // keyboard-safe inputs: mark the scene (.kb hides the footer), let its body scroll and keep the field, the accent bar
  // and Check in the visible strip. Runs on focus and again whenever the (visual) viewport changes while a field is
  // focused — on iOS the field is usually focused before the keyboard has finished opening.
  const focusedField = () => { const a = document.activeElement; return a && a.matches && a.matches('input, textarea') && container.contains(a) ? a : null; };
  let kbTimer = null;
  function keepFieldVisible(inp) {
    if (!inp || !inp.isConnected) return;
    const sc = inp.closest('.scene'); if (!sc) return;
    sc.classList.add('kb');
    const b = sc.querySelector('.scene-body');
    b.classList.add('scrollable');
    const r = inp.getBoundingClientRect(), br = b.getBoundingClientRect();
    const kb = parseFloat(container.style.getPropertyValue('--kb')) || 0;
    const visible = br.height - kb; // the part of the body not covered by the keyboard
    // room to spare: keep the question above the field; tight: the field goes to the top so the bar and Check fit under it
    const want = visible > 440 ? Math.min(140, visible * .3) : 12;
    const delta = (r.top - br.top) - want;
    if (Math.abs(delta) > 8) b.scrollTop += delta;
  }
  const scheduleKb = (inp, ms = 80) => { clearTimeout(kbTimer); kbTimer = setTimeout(() => keepFieldVisible(inp), ms); };
  const onFocusIn = (ev) => {
    const inp = ev.target.closest && ev.target.closest('input, textarea');
    if (!inp || !inp.closest('.scene')) return;
    inp.closest('.scene').classList.add('kb');
    scheduleKb(inp, 80);
  };
  const onFocusOut = () => {
    setTimeout(() => {
      if (focusedField()) return;
      clearTimeout(kbTimer);
      container.querySelectorAll('.scene.kb').forEach(sc => sc.classList.remove('kb'));
      checkOverflow(scenes[current]);
    }, 120);
  };
  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('focusout', onFocusOut);
  const vv = window.visualViewport;
  const onVV = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
    container.style.setProperty('--kb', `${Math.round(kb)}px`);
    const f = focusedField(); if (f) scheduleKb(f, 60);
  };
  if (vv) vv.addEventListener('resize', onVV);
  const onResize = () => { checkOverflow(scenes[current]); const f = focusedField(); if (f) scheduleKb(f, 60); };
  window.addEventListener('resize', onResize);

  // first scene
  requestAnimationFrame(() => { if (!destroyed && current < 0) setCurrent(0); });

  return {
    get current() { return current; },
    goto,
    scenes,
    destroy() {
      destroyed = true;
      clearTimeout(gotoTimer);
      clearTimeout(kbTimer);
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(moRaf);
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', onFocusOut);
      if (vv) vv.removeEventListener('resize', onVV);
      window.removeEventListener('resize', onResize);
      for (const s of scenes) { clearTimeout(s.skipTimer); try { s.cleanup && s.cleanup(); } catch { /* ignore */ } }
      clearNext();
      rail.remove();
      document.body.classList.remove('walkthrough');
      setChrome({ tabs: true });
      setScene(level);
    },
  };
}

// ---------- inline question renderer ----------
// renderCheck(host, q, { prompt, limit, revealLabel, placeholder, onDone(ok, { revealed }) }) → { helper(), answered, destroy() }
// q comes from js/games/questions.js ({ type:'mc'|'type', tag, prompt, choices, answer, accept, explain, say, center }).
export function renderCheck(host, q, { prompt = null, limit = null, revealLabel = 'Not sure — show me', placeholder = null, onDone = null, speakAnswer = true } = {}) {
  if (!host) return { helper: () => null, answered: true, destroy() {} };
  if (!q) { host.innerHTML = ''; return { helper: () => null, answered: true, destroy() {} }; }
  const state = { answered: false };
  const promptHTML = prompt != null ? prompt : ((q.tag ? html`<div class="prompt">${q.tag}</div>` : '') + (q.prompt || ''));
  const card = `<div class="q-card wt-q">${promptHTML}</div>`;
  const answerText = (choices) => {
    const a = Array.isArray(q.answer) ? q.answer[0] : (q.answer || (choices || []).find(c => c.correct)?.label || '');
    return String(a).split('|')[0];
  };
  const feedback = (ok, revealed, res = {}, choices = null) => {
    const ans = answerText(choices);
    const fb = host.querySelector('[data-fb]');
    if (!fb) return;
    const kind = ok ? 'ok' : revealed ? 'info' : 'ko';
    const line = ok ? `${icon('check', { size: 18 })} ${res.accentIssue ? 'Right — mind the accent: ' + esc(ans) : 'Esatto'}`
      : revealed ? `${icon('sparkle', { size: 18 })} ${esc(ans)}`
        : res.articleIssue ? `${icon('x', { size: 18 })} Mind the article — ${esc(ans)}`
          : `${icon('x', { size: 18 })} Not quite — ${esc(ans)}`;
    fb.innerHTML = `<div class="feedback ${kind}">${line}${q.explain ? `<div class="detail">${q.explain}</div>` : ''}</div>`;
    haptic(ok ? 'success' : 'error');
    if (speakAnswer && q.say && (!ok || revealed)) speak(q.say);
    onDone && onDone(ok, { revealed, res });
    // the verdict must be seen: bring it into view once the scene has re-measured its body
    requestAnimationFrame(() => { if (fb.isConnected) revealInScroller(fb); });
  };

  if (q.type === 'mc') {
    let choices = (q.choices || []).slice().filter(c => c && c.label !== '—');
    if (limit && choices.length > limit) {
      const c = choices.find(x => x.correct);
      const w = choices.filter(x => !x.correct).slice(0, limit - 1);
      choices = shuffle([c, ...w].filter(Boolean));
    }
    host.innerHTML = card + `<div class="choices wt-choices">${choices.map((c, i) => `<button type="button" class="choice${q.center ? ' center' : ''}" data-choice="${i}">${c.html || esc(c.label)}${c.sub ? `<span class="tiny">${esc(c.sub)}</span>` : ''}</button>`).join('')}</div>
      <div class="wt-helper"><button type="button" class="btn xs ghost" data-reveal>${esc(revealLabel)}</button></div><div class="wt-fb" data-fb></div>`;
    const grade = (idx, revealed) => {
      if (state.answered) return;
      state.answered = true;
      const ok = !revealed && !!choices[idx]?.correct;
      host.querySelectorAll('[data-choice]').forEach((b, i) => {
        b.disabled = true;
        if (choices[i].correct) b.classList.add('correct');
        else if (i === idx) b.classList.add('wrong');
        else b.classList.add('dim');
      });
      host.querySelector('.wt-helper')?.remove();
      feedback(ok, revealed, {}, choices);
    };
    host.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => grade(Number(b.dataset.choice), false)));
    host.querySelector('[data-reveal]').addEventListener('click', () => grade(-1, true));
  } else {
    host.innerHTML = card + `<input class="input big" data-answer type="text" placeholder="${esc(placeholder || q.placeholder || 'Type in Italian…')}" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="go">
      ${accentBar()}
      <div class="row gap mt wt-typed-actions"><button type="button" class="btn sm ghost" data-skip>I don't know</button><button type="button" class="btn sm primary grow" data-check>Check</button></div><div class="wt-fb" data-fb></div>`;
    const input = host.querySelector('[data-answer]');
    bindAccentBar(host, input);
    const finish = (ok, res, revealed) => {
      if (state.answered) return;
      state.answered = true;
      input.blur(); // release the keyboard (and the scene's .kb state) before the field is disabled
      input.disabled = true;
      host.querySelector('.wt-typed-actions')?.remove();
      host.querySelector('[data-accents]')?.remove();
      if (revealed) { input.value = answerText(); input.classList.add('revealed'); }
      else if (!ok) { shake(input); input.classList.add('ko'); }
      else input.classList.add('ok');
      feedback(ok, revealed, res);
    };
    const submit = () => {
      if (state.answered) return;
      const v = input.value;
      if (!v.trim()) { shake(input); input.focus(); return; }
      const res = q.accept ? q.accept(v) : checkTyped(v, q.answer);
      finish(!!res.ok, res, false);
    };
    host.querySelector('[data-check]').addEventListener('click', submit);
    host.querySelector('[data-skip]').addEventListener('click', () => finish(false, {}, true));
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } });
  }
  return {
    get answered() { return state.answered; },
    helper: () => (state.answered ? null : host.querySelector('[data-reveal], [data-skip]')),
    destroy() { host.innerHTML = ''; },
  };
}

// ---------- results block for the in-scene drill ----------
export function renderResults(host, result, { passScore = null, retryLabel = 'Retry the drill', onRetry = null } = {}) {
  const passed = passScore == null ? null : result.score >= passScore;
  host.innerHTML = html`<div class="results wt-results">
      <div class="score-ring" style="--p:${result.score}"><div class="score" data-score>0%</div></div>
      <div class="lead wt-res-line">${result.correct} of ${result.total} correct · +${result.xp} XP</div>
      ${passed === false ? raw(html`<div class="small muted">Score ${passScore}% or more to pass</div>`) : passed === true ? raw('<div class="small muted">Passed</div>') : ''}
      ${onRetry ? raw(html`<div class="row gap mt" style="justify-content:center"><button type="button" class="btn sm ghost" data-replay>${retryLabel}</button></div>`) : ''}
    </div>`;
  countUp(host.querySelector('[data-score]'), result.score, { suffix: '%' });
  if (onRetry) host.querySelector('[data-replay]').addEventListener('click', onRetry);
}

// stamp + confetti for a completion scene
export function celebrate(stampHost, passed, { level = 'A1', okText = 'IMPARATO', koText = 'RIPROVA', confetti: burst = true } = {}) {
  stamp(stampHost, passed ? okText : koText, passed ? 'ok' : 'ko');
  if (passed && burst) {
    const cols = [...(SCENES[level] || SCENES.learn), '#f2c14e', '#e0673f', '#2dd4bf'];
    setTimeout(() => confetti(cols, { origin: { x: .5, y: .38 } }), 260);
  }
}
