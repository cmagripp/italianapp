// Verb walkthrough (#/learn/verb/:id): a cinematic deck of scenes —
// Meet → Meaning → Cases & patterns → Auxiliary → one scene per tense (card fan + quick check) → Examples →
// Participio & gerundio → Drill → Finito. Built on the shared scene engine in ./walkthrough.js.
import { html, raw, esc, speak, speakBtn, enPill, levelBadge, haptic, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, data, shuffle, sample, CATS, LEVELS, shortEn } from '../data.js';
import { hwSize } from '../components.js';
import { conjugate, irregularCells, splitClitic, PERSONS, TENSE_BY_KEY, primary, accepted, MISSING } from '../conjugator.js';
import { fan, dropdown, typewriter, riseLetters, stamp, SCENES } from '../fx.js';
import { runDrill, revealInScroller } from '../games/engine.js';
import { qTranslateMC, qConjMC, qConjType, qAux, qParticiple, qPattern, qCloze, mcChoices, findInSentence } from '../games/questions.js';
import { nextNew } from './learn.js';
import { createWalkthrough, renderCheck, renderResults, celebrate } from './walkthrough.js';

const AUX_LABEL = { avere: 'avere', essere: 'essere', both: 'avere / essere' };
const TRANS_LABEL = { vt: 'transitivo', vi: 'intransitivo', vr: 'riflessivo', 'vt/vi': 'vt · vi' };
const TRANS_LONG = { vt: 'transitive', vi: 'intransitive', vr: 'reflexive / pronominal', 'vt/vi': 'transitive & intransitive' };
const PASS = 66;

// one-line meaning of each tense, written for the scene
const TENSE_LINE = {
  presente: 'What happens now, or as a habit. In speech it also covers the near future.',
  passatoProssimo: 'Finished actions that still matter now — the everyday past. Auxiliary + past participle.',
  imperfetto: 'How things were: ongoing, habitual or background actions in the past; descriptions, age, weather.',
  futuro: 'What will happen; also a guess about the present (“sarà a casa” — she is probably home).',
  condizionale: 'Would: polite requests, wishes and hypotheses (“vorrei un caffè”).',
  congiuntivoPresente: 'After opinion, doubt, hope or wish: penso che…, spero che…, benché…',
};
const TENSE_COLORS = {
  passatoProssimo: ['#e0673f', '#f2c14e', '#b8323f'],
  imperfetto: ['#38bdf8', '#a78bfa', '#f2c14e'],
  futuro: ['#2dd4bf', '#38bdf8', '#f2c14e'],
  condizionale: ['#a78bfa', '#f2c14e', '#38bdf8'],
  congiuntivoPresente: ['#b8323f', '#a78bfa', '#f2c14e'],
};
// regular endings shown as a rule line under the tense meaning (regular verbs, simple tenses only)
const ENDINGS = {
  presente: { are: 'o · i · a · iamo · ate · ano', ere: 'o · i · e · iamo · ete · ono', ire: 'o · i · e · iamo · ite · ono', isc: 'isco · isci · isce · iamo · ite · iscono' },
  imperfetto: { are: 'avo · avi · ava · avamo · avate · avano', ere: 'evo · evi · eva · evamo · evate · evano', ire: 'ivo · ivi · iva · ivamo · ivate · ivano' },
  futuro: { are: 'erò · erai · erà · eremo · erete · eranno', ere: 'erò · erai · erà · eremo · erete · eranno', ire: 'irò · irai · irà · iremo · irete · iranno' },
  condizionale: { are: 'erei · eresti · erebbe · eremmo · ereste · erebbero', ere: 'erei · eresti · erebbe · eremmo · ereste · erebbero', ire: 'irei · iresti · irebbe · iremmo · ireste · irebbero' },
  congiuntivoPresente: { are: 'i · i · i · iamo · iate · ino', ere: 'a · a · a · iamo · iate · ano', ire: 'a · a · a · iamo · iate · ano', isc: 'isca · isca · isca · iamo · iate · iscano' },
};
const PREP_FORMS = {
  a: ['a', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', "all'"], di: ['di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', "dell'", "d'"],
  da: ['da', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', "dall'"], in: ['in', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle', "nell'"],
  su: ['su', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', "sull'"], con: ['con'], per: ['per'], tra: ['tra', 'fra'], fra: ['fra', 'tra'],
};
const PLACEHOLDERS = new Set(['qualcuno', 'qualcosa', 'fare', 'un', 'una', 'uno', 'il', 'lo', 'la', 'le', 'i', 'gli', "l'", 'che', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'se', 'si']);
// Verbs whose English subject is not the Italian one (mi piace = I like it, literally "it pleases me"): the meet floats
// show the Italian forms alone rather than a misleading "I like".
const NO_PERSON_GLOSS = /^(piacere|dispiacere|servire|mancare|interessare|bastare|esserci|occorrere|importare|sembrare|convenire|spettare|toccare|succedere|capitare)$/;

// "to eat" → I eat / you eat / he or she eats (naive English inflection for the meet-card floats)
function enPerson(en, i) {
  let base = shortEn(en).replace(/^to\s+/i, '').trim();
  if (!base) return '';
  const pron = ['I', 'you', 'he / she', 'we', 'you all', 'they'][i];
  const [first, ...rest] = base.split(' ');
  let v = first;
  if (i === 2) {
    if (/^be$/i.test(first)) v = 'is'; else if (/^have$/i.test(first)) v = 'has';
    else if (/(s|sh|ch|x|z|o)$/i.test(first)) v = first + 'es';
    else if (/[^aeiou]y$/i.test(first)) v = first.slice(0, -1) + 'ies';
    else v = first + 's';
  } else if (/^be$/i.test(first)) v = i === 0 ? 'am' : 'are';
  return `${pron} ${[v, ...rest].join(' ')}`;
}
const wordFs = (form) => { const n = Math.max(...String(form).split(/\s+/).map(w => w.length)); return n <= 5 ? 22 : n <= 7 ? 19 : n <= 9 ? 16 : n <= 11 ? 14 : 12; };
const words = (s) => String(s || '').toLowerCase().replace(/[.,;:!?«»"()]/g, ' ').split(/\s+/).filter(Boolean);

// The example that shows the pattern: one containing its preposition (in any articulated form) or another content word.
// A bare "verb + qualcosa/qualcuno" pattern is illustrated by any sentence that uses the verb; otherwise null ("no example yet")
// rather than an unrelated sentence.
function exampleFor(pattern, examples, e) {
  if (!examples.length) return null;
  const inf = e.inf.toLowerCase();
  const toks = words(pattern).filter(t => t !== inf);
  const prep = toks.find(t => PREP_FORMS[t]);
  if (prep) { const set = new Set(PREP_FORMS[prep]); return examples.find(x => words(x.it).some(w => set.has(w))) || null; }
  const content = toks.filter(t => !PLACEHOLDERS.has(t) && t.length > 2);
  if (content.length) { for (const c of content) { const hit = examples.find(x => words(x.it).includes(c)); if (hit) return hit; } return null; }
  return examples.find(x => findInSentence(x.it, e)) || null;
}
const availablePersons = (forms) => forms.map((f, i) => (primary(f) && primary(f) !== MISSING ? i : -1)).filter(i => i >= 0);
const cleanChoices = (q) => { if (q && q.choices) q.choices = q.choices.filter(c => c.label !== MISSING); return q; };

export async function render(root, params) {
  const e = getEntry(params.id);
  if (!e || e.kind !== 'verb') { root.innerHTML = '<div class="empty"><p>Verb not found.</p><a class="btn primary" href="#/learn">Back to Learn</a></div>'; return; }
  setTitle(e.inf);
  store.pushRecent(e.id);
  const level = LEVELS.includes(e.level) ? e.level : 'A1';
  const conj = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  const irr = conj.irregular ? irregularCells(e.inf, { aux: e.aux, isc: e.isc }) : {};
  let pool = data.verbs.filter(v => v.level === level && v.id !== e.id);
  if (pool.length < 6) pool = data.verbs;
  const examples = (e.examples || []).filter(x => x && x.it);
  const patterns = (e.patterns || []).filter(Boolean);
  const pp = primary(conj.nonFinite.participioPassato), ger = primary(conj.nonFinite.gerundio);
  const hasPP = pp && pp !== MISSING, hasGer = ger && ger !== MISSING;
  const auxKey = e.aux === 'essere' ? 'essere' : 'avere';
  const wanted = ['presente', 'passatoProssimo', 'imperfetto', 'futuro', ...(LEVELS.indexOf(level) >= 2 ? ['condizionale', 'congiuntivoPresente'] : [])];
  const tenses = wanted.filter(k => conj.tenses[k] && availablePersons(conj.tenses[k]).length);
  const st = { result: null, learnedNow: false, restartDrill: null, celebrated: false };

  // ---------- 1 MEET ----------
  const meet = {
    key: 'meet', title: 'Meet', colors: level, cta: 'Avanti', noSkip: true,
    render(body, api) {
      const pres = conj.tenses.presente || [];
      const gloss = !NO_PERSON_GLOSS.test(splitClitic(e.inf).base);
      const floats = [0, 1, 2].filter(i => pres[i] && primary(pres[i]) !== MISSING).map(i => ({ it: primary(pres[i]), en: gloss ? enPerson(e.en, i) : '', cls: `f${i + 1}` }));
      const cat = CATS[e.cat];
      body.innerHTML = html`<div class="meet-stage">
          ${raw(floats.map((f, i) => (f.en
            ? html`<span class="float meet-float glass ${f.cls} ${i % 2 ? 'delay' : ''} itx" role="button" tabindex="0" style="--glow:var(--lvl-${level})"><span class="it">${f.it}</span><span class="tr">${f.en}</span></span>`
            : html`<span class="float meet-float glass ${f.cls} ${i % 2 ? 'delay' : ''}" style="--glow:var(--lvl-${level})"><span class="it">${f.it}</span></span>`)).join(''))}
          <div class="headword center meet-hero" data-hero>
            <div class="hw-line"><span class="word" style="--hw:${hwSize(e.inf)}px" data-word>${e.inf}</span></div>
            <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(e.inf, 'lg'))}</div>
            <div class="tags">${raw(levelBadge(level))}<span>verbo</span><span>${conj.group}</span><span>${conj.irregular ? 'irregolare' : 'regolare'}</span><span>aux. ${AUX_LABEL[e.aux] || 'avere'}</span>${e.trans ? raw(html`<span>${TRANS_LABEL[e.trans] || e.trans}</span>`) : ''}</div>
          </div>
        </div>
        ${cat ? raw(html`<div class="meet-cat kicker">${cat.name}${e.custom ? ' · custom' : ''}</div>`) : ''}`;
      api.parallax(body.querySelector('[data-hero]'), 0.15);
      api.ready();
    },
    enter(api, first) {
      riseLetters(api.body.querySelector('[data-word]'));
      if (first) setTimeout(() => speak(e.inf), 350);
    },
  };

  // ---------- 2 MEANING ----------
  const meaning = {
    key: 'meaning', title: 'Meaning', colors: level, lockLabel: 'Choose an answer', hintLocked: 'Read the note, then answer',
    render(body, api) {
      const q = qTranslateMC(e, pool, 'it-en');
      body.innerHTML = html`<div class="glass pad usage-pane"><div class="kicker">Uso · how to use it</div><p class="usage-text">${e.usage || `${e.inf} — ${e.en}.`}</p><div class="tags"><span>${TRANS_LONG[e.trans] || TRANS_LONG.vt}</span><span>aux. ${AUX_LABEL[e.aux] || 'avere'}</span></div></div>
        <div class="wt-check" data-check></div>`;
      const chk = renderCheck(body.querySelector('[data-check]'), q, {
        prompt: html`<div class="prompt">Quick check · closest in meaning</div><div class="big md">${e.inf}</div>`,
        onDone: () => api.ready(),
      });
      api.setHelper(() => chk.helper());
    },
  };

  // ---------- 3 CASES & PATTERNS ----------
  const casesScene = {
    key: 'patterns', title: 'Cases & patterns', colors: SCENES.reference, lockLabel: 'Open a pattern', hintLocked: 'Tap a pattern to see it in a sentence',
    render(body, api) {
      body.innerHTML = html`<div class="kicker pat-kicker">Reggenza · what follows the verb</div>
        <div class="pat-list">${raw(patterns.map((p, i) => html`<button type="button" class="pat-row glass-flat" data-pat="${i}" aria-haspopup="dialog"><span class="pat-text">${p}</span><span class="pat-side"><span class="pat-check">${raw(icon('check', { size: 16 }))}</span>${raw(icon('chevronDown', { size: 18 }))}</span></button>`).join(''))}</div>
        ${patterns.length ? '' : raw(html`<div class="glass pad"><p class="display it lead">${e.inf} ${e.trans === 'vt' ? 'qualcosa' : ''}</p><p class="small muted">No fixed pattern to remember — use it ${TRANS_LONG[e.trans] ? 'as a ' + TRANS_LONG[e.trans] + ' verb' : 'freely'}.</p></div>`)}
        <div class="pat-foot tags"><span>${TRANS_LONG[e.trans] || TRANS_LONG.vt}</span>${examples.length ? raw(html`<span>${examples.length} esempi</span>`) : ''}</div>`;
      const opened = new Set();
      if (!patterns.length) api.ready();
      body.addEventListener('click', (ev) => {
        const row = ev.target.closest('[data-pat]'); if (!row) return;
        const i = Number(row.dataset.pat);
        const ex = exampleFor(patterns[i], examples, e);
        const content = html`<div class="dropdown-title">${patterns[i]}</div>
          ${ex ? raw(html`<div class="pat-ex"><div class="itx block" role="button" tabindex="0"><div class="it">${ex.it}</div><div class="tr">${ex.en}</div></div>${raw(speakBtn(ex.it, 'sm'))}</div>`) : raw('<div class="pat-ex small muted">No example yet for this pattern.</div>')}
          <div class="dropdown-list"><button type="button" class="opt on" data-value="ok"><span class="opt-main"><span class="opt-label">Capito</span><span class="opt-sub">tap the sentence for English</span></span>${raw(icon('check', { size: 20 }))}</button></div>`;
        haptic('light');
        dropdown(row, content, {
          width: Math.min(window.innerWidth - 24, 420),
          onSelect: () => true,
          onClose: () => { opened.add(i); row.classList.add('seen'); api.ready(); api.refresh(); },
        });
        setTimeout(() => api.refresh(), 60);
      });
      api.setHelper(() => body.querySelector('[data-pat]:not(.seen)'));
    },
  };

  // ---------- 4 AUXILIARY ----------
  const auxScene = {
    key: 'aux', title: 'Auxiliary', colors: SCENES.profile, lockLabel: 'Pick the auxiliary', hintLocked: 'Which verb builds the passato prossimo?',
    render(body, api) {
      const q = qAux(e);
      const tiles = [{ key: 'essere', label: 'essere', sub: 'sono · sei · è', correct: e.aux === 'essere' }, { key: 'avere', label: 'avere', sub: 'ho · hai · ha', correct: e.aux !== 'essere' && e.aux !== 'both' }];
      if (e.aux === 'both') tiles.push({ key: 'both', label: 'entrambi', sub: 'depends on meaning', correct: true });
      const ppShow = hasPP ? pp : '…';
      body.innerHTML = html`<div class="q-card wt-q aux-q"><div class="prompt">Passato prossimo</div><div class="big md"><span class="blank">?</span> ${ppShow}</div><div class="sub">lui / lei … ${e.inf}</div></div>
        <div class="choices aux-tiles ${tiles.length === 3 ? 'three' : ''}">${raw(tiles.map((t, i) => html`<button type="button" class="choice aux-tile" data-aux="${i}"><span class="aux-word">${t.label}</span><span class="aux-sub">${t.sub}</span></button>`).join(''))}</div>
        <div class="wt-helper"><button type="button" class="btn xs ghost" data-reveal>Not sure — show me</button></div>
        <div class="wt-fb" data-fb></div>`;
      let done = false;
      const settle = (idx, revealed) => {
        if (done) return; done = true;
        const ok = !revealed && tiles[idx].correct;
        const correct = tiles.find(t => t.correct);
        body.querySelectorAll('[data-aux]').forEach((b, i) => { b.disabled = true; if (tiles[i].correct) b.classList.add('correct'); else if (i === idx) b.classList.add('wrong'); else b.classList.add('dim'); });
        body.querySelector('.wt-helper')?.remove();
        body.querySelector('.aux-q .blank').textContent = e.aux === 'both' ? 'ha / è' : (e.aux === 'essere' ? 'è' : 'ha');
        const fb = body.querySelector('[data-fb]');
        fb.innerHTML = `<div class="feedback ${ok ? 'ok' : revealed ? 'info' : 'ko'}">${ok ? icon('check', { size: 18 }) + ' Esatto — ' : revealed ? icon('sparkle', { size: 18 }) + ' ' : icon('x', { size: 18 }) + ' Not quite — '}${esc(e.inf)} takes <b>${esc(correct.label)}</b>.<div class="detail">${q.explain}</div></div>`;
        celebrateAux(body.querySelector(`[data-aux="${tiles.indexOf(correct)}"]`), correct.label.toUpperCase());
        haptic(ok ? 'success' : 'error');
        speak(q.say);
        api.ready();
        requestAnimationFrame(() => revealInScroller(fb));
      };
      body.querySelectorAll('[data-aux]').forEach(b => b.addEventListener('click', () => settle(Number(b.dataset.aux), false)));
      body.querySelector('[data-reveal]').addEventListener('click', () => settle(-1, true));
      api.setHelper(() => (done ? null : body.querySelector('[data-reveal]')));
    },
  };
  const celebrateAux = (tile, text) => { const s = stamp(tile, text, 'ok'); if (s) s.classList.add('abs', 'aux-stamp'); };

  // ---------- 5–8 TENSES ----------
  const tenseScene = (key, idx) => {
    const T = TENSE_BY_KEY[key];
    const forms = conj.tenses[key];
    const irrSet = new Set((irr[key] || []).concat(T.compound && irr.participioPassato ? [0, 1, 2, 3, 4, 5] : []));
    const avail = availablePersons(forms);
    const endings = !conj.irregular && !T.compound && ENDINGS[key] ? (ENDINGS[key][conj.isc && ENDINGS[key].isc ? 'isc' : conj.cls] || null) : null;
    let fanApi = null;
    return {
      key: 'tense-' + key, title: T.name, colors: TENSE_COLORS[key] || level, lockLabel: 'Flip all six cards', hintLocked: 'Tap a card to flip it · listen',
      render(body, api) {
        body.innerHTML = html`<div class="tense-intro">
            <div class="tense-kicker">${T.mood} · ${T.en}</div>
            <p class="tense-line">${TENSE_LINE[key] || ''}</p>
            ${endings ? raw(html`<div class="tense-rule mono">-${endings}</div>`) : conj.irregular ? raw('<div class="tense-rule mono irr">irregular forms in terracotta</div>') : ''}
          </div>
          <div class="fan-stage" data-stage><div class="fan-inner">
            <div class="wt-fan" data-fan></div>
            <div class="fan-tools"><button type="button" class="btn xs ghost" data-flip>${raw(icon('flip', { size: 16 }))}Reveal all</button><button type="button" class="btn xs ghost" data-spread>${raw(icon('spread', { size: 16 }))}Spread</button></div>
          </div></div>
          <div class="strip" data-strip hidden></div>
          <div class="wt-check" data-check></div>`;
        const cards = forms.map((f, i) => {
          const main = primary(f) || MISSING;
          const missing = main === MISSING;
          const isIrr = irrSet.has(i) && !missing;
          return {
            // "lui/lei" may wrap after the slash: the label has to fit the card's visible strip in the hand
            key: PERSONS[i], front: `<span class="pl">${esc(PERSONS[i]).replace('/', '/<wbr>')}</span>`,
            back: missing ? `<span class="form none">—</span><span class="sub">no form</span>` : `<span class="form ${isIrr ? 'irr' : ''}" style="font-size:${wordFs(main)}px">${esc(main)}</span><span class="sub">${esc(PERSONS[i])}</span>`,
            tint: missing ? 'var(--ink-4)' : isIrr ? 'var(--terracotta)' : `var(--lvl-${level})`,
          };
        });
        let state = 'learn';
        let chk = null;
        const fanEl = body.querySelector('[data-fan]');
        fanEl.style.setProperty('--fan-n', String(cards.length)); // css spreads the hand so every card keeps a tappable strip
        fanApi = fan(fanEl, cards, {
          onFlip(i, flipped) { if (flipped) { const f = primary(forms[i]); if (f && f !== MISSING) speak(f); haptic('light'); } },
          onAllFlipped() { setTimeout(startCheck, 560); },
        });
        function startCheck() {
          if (state !== 'learn') return;
          state = 'check';
          api.setLockLabel('Answer the quick check');
          body.querySelector('[data-stage]').classList.add('collapsed');
          const p = sample(avail);
          const q = cleanChoices(idx % 2 === 0 ? qConjMC(e, key, pool, p) : qConjType(e, key, p));
          if (!q) { finish(); return; }
          const host = body.querySelector('[data-check]');
          host.classList.add('in');
          chk = renderCheck(host, q, {
            prompt: html`<div class="prompt">Quick check · ${T.name}</div><div class="big md">${PERSONS[p]} <span class="blank">?</span></div><div class="sub">${e.inf} · ${T.en}</div>`,
            placeholder: `${PERSONS[p]} …`,
            onDone: finish,
          });
          api.setHint(q.type === 'type' ? 'Type the form — accents below' : 'Choose the right form');
          api.refresh();
          // once the fan has folded away, bring the whole check (question + every choice) into view
          setTimeout(() => { if (host.isConnected) { api.refresh(); revealInScroller(host, { pad: 8 }); } }, 460);
          if (q.type === 'type') setTimeout(() => host.querySelector('[data-answer]')?.focus({ preventScroll: true }), 520);
        }
        function finish() {
          state = 'done';
          const strip = body.querySelector('[data-strip]');
          strip.hidden = false;
          strip.innerHTML = forms.map((f, i) => { const m = primary(f) || MISSING; const missing = m === MISSING; return `<button type="button" class="strip-cell ${irrSet.has(i) && !missing ? 'irr' : ''}" ${missing ? 'disabled' : `data-say="${esc(m)}"`}><span class="p">${esc(PERSONS[i])}</span><span class="f">${esc(missing ? '—' : m)}</span></button>`; }).join('');
          api.ready();
        }
        body.querySelector('[data-flip]').addEventListener('click', () => { fanApi.flipAll(true); });
        body.querySelector('[data-spread]').addEventListener('click', (ev) => { const on = fanApi.spread(); ev.currentTarget.classList.toggle('on', on); setTimeout(() => api.refresh(), 450); });
        api.setHelper(() => (state === 'learn' ? body.querySelector('[data-flip]') : chk ? chk.helper() : null));
        return () => fanApi && fanApi.destroy();
      },
      enter() { if (fanApi) requestAnimationFrame(() => fanApi.layout()); },
    };
  };

  // ---------- 9 EXAMPLES ----------
  let runTyping = null;
  const examplesScene = {
    key: 'examples', title: 'Examples', colors: SCENES.home, lockLabel: 'Fill in the blank', hintLocked: 'Tap a sentence for English',
    render(body, api) {
      body.innerHTML = html`<div class="kicker ex-kicker">Esempi · ${e.inf} in context</div>
        <div class="ex-list">${raw(examples.map((x, i) => html`<div class="ex-row glass-flat" data-ex="${i}"><div class="itx block" role="button" tabindex="0"><div class="it" data-tw></div><div class="tr">${x.en}</div></div>${raw(speakBtn(x.it, 'sm'))}</div>`).join(''))}</div>
        <div class="wt-check" data-check></div>`;
      let chk = null; let started = false;
      runTyping = async () => {
        if (started) return; started = true;
        const rows = [...body.querySelectorAll('[data-ex]')];
        for (let i = 0; i < rows.length; i++) {
          rows[i].classList.add('typing');
          await typewriter(rows[i].querySelector('[data-tw]'), examples[i].it, { msPerWord: 60 });
          rows[i].classList.remove('typing');
          await new Promise(r => setTimeout(r, 140));
        }
        if (!body.isConnected) return;
        const q = cleanChoices(qCloze(e, { pool }));
        if (!q) { api.ready(); return; }
        const host = body.querySelector('[data-check]');
        host.classList.add('in');
        chk = renderCheck(host, q, { limit: 3, onDone: () => api.ready() });
        api.refresh();
        requestAnimationFrame(() => revealInScroller(host, { pad: 8 }));
      };
      api.setHelper(() => (chk ? chk.helper() : null));
    },
    enter(api, first) { if (first && runTyping) runTyping(); },
  };

  // ---------- 10 PARTICIPIO & GERUNDIO ----------
  const nonFiniteScene = {
    key: 'nonfinite', title: 'Participio & gerundio', colors: ['#a3b86c', '#f2c14e', '#38bdf8'], lockLabel: 'Type both forms', hintLocked: 'Type it, or pick from a list',
    render(body, api) {
      const steps = [];
      if (hasPP) steps.push({ kind: 'pp', label: 'participio passato', lead: auxKey === 'essere' ? 'sono' : 'ho', answer: accepted(conj.nonFinite.participioPassato), form: pp });
      if (hasGer) steps.push({ kind: 'ger', label: 'gerundio', lead: 'sto', answer: accepted(conj.nonFinite.gerundio), form: ger });
      body.innerHTML = html`<div class="nf-slots">${raw(steps.map(s => html`<div class="nf-slot glass-flat" data-slot="${s.kind}"><span class="lab">${s.label}</span><span class="val"><span class="lead-word">${s.lead}</span> <span class="ans">?</span></span></div>`).join(''))}</div>
        <div class="row between nf-mode"><span class="kicker" data-nf-step></span><button type="button" class="btn xs ghost" data-mode>${raw(icon('list', { size: 16 }))}Pick instead</button></div>
        <div class="wt-check" data-check></div>`;
      if (!steps.length) { body.querySelector('.nf-mode').remove(); api.ready(); return; }
      let i = 0, mode = 'type', chk = null;
      const stepEl = body.querySelector('[data-nf-step]');
      // pronominal verbs: distractors are built on the base verb and carry the clitic like the real gerund (andandosene)
      const { base: baseInf, clitic } = splitClitic(e.inf);
      const stem = baseInf.replace(/(are|ere|ire|rre)$/, '');
      const tail = clitic || '';
      const buildQ = (s) => {
        if (mode === 'type') return { type: 'type', tag: s.label, answer: s.answer, say: s.form, placeholder: `${s.lead} …`, explain: s.kind === 'pp' && conj.irregular && irr.participioPassato ? 'Irregular participle.' : '' };
        if (s.kind === 'pp') return cleanChoices(qParticiple(e, false));
        const wrong = [...new Set([stem + 'ando' + tail, stem + 'endo' + tail, stem + 'iendo' + tail, stem + 'indo' + tail])].filter(x => !s.answer.includes(x)).slice(0, 3);
        return { type: 'mc', tag: s.label, center: true, say: s.form, choices: mcChoices(s.form, wrong), answer: s.form };
      };
      const show = () => {
        const s = steps[i];
        stepEl.textContent = `${i + 1} / ${steps.length} · ${s.label}`;
        body.querySelectorAll('.nf-slot').forEach(el => el.classList.toggle('cur', el.dataset.slot === s.kind));
        const host = body.querySelector('[data-check]');
        chk = renderCheck(host, buildQ(s), {
          prompt: html`<div class="prompt">${s.label}</div><div class="big md">${s.lead} <span class="blank">?</span></div><div class="sub">${e.inf}</div>`,
          placeholder: `${s.lead} …`,
          onDone: () => {
            body.querySelector(`[data-slot="${s.kind}"] .ans`).textContent = s.form;
            body.querySelector(`[data-slot="${s.kind}"]`).classList.add('done');
            i++;
            if (i < steps.length) setTimeout(show, 900); else { body.querySelector('.nf-mode').classList.add('hidden'); api.ready(); }
            api.refresh();
          },
        });
        api.refresh();
      };
      body.querySelector('[data-mode]').addEventListener('click', (ev) => {
        if (chk && chk.answered) return;
        mode = mode === 'type' ? 'pick' : 'type';
        ev.currentTarget.innerHTML = mode === 'type' ? `${icon('list', { size: 16 })}Pick instead` : `${icon('edit', { size: 16 })}Type instead`;
        show();
      });
      api.setHelper(() => (chk ? chk.helper() : null));
      show();
    },
  };

  // ---------- 11 DRILL ----------
  const drillQuestions = () => {
    const tp = (k) => { const a = availablePersons(conj.tenses[k] || []); return a.length ? sample(a) : null; };
    const qs = [
      qTranslateMC(e, pool, 'it-en'),
      tenses.includes('presente') ? qConjMC(e, 'presente', pool, tp('presente')) : null,
      qConjType(e, tenses.includes('passatoProssimo') ? 'passatoProssimo' : tenses[0], tp(tenses.includes('passatoProssimo') ? 'passatoProssimo' : tenses[0])),
      qAux(e),
      hasPP ? qParticiple(e, false) : null,
      tenses.length > 1 ? qConjMC(e, tenses[1], pool, tp(tenses[1])) : null,
      qPattern(e) || qCloze(e, { pool }),
      qConjType(e, sample(tenses.filter(k => k !== 'passatoProssimo')) || tenses[0], null),
      qTranslateMC(e, pool, 'en-it'),
    ].filter(Boolean).map(cleanChoices);
    // never ask about a missing form
    return qs.filter(q => !(Array.isArray(q.answer) ? q.answer.every(a => a === MISSING) : q.answer === MISSING)).slice(0, 9);
  };
  let drill = null, drillTimer = null;
  const drillScene = {
    key: 'drill', title: 'Drill', colors: SCENES.games, lockLabel: 'Finish the drill', hintLocked: 'Nine quick questions · pass with 66 %', noSkip: true,
    render(body) {
      body.innerHTML = html`<div class="drill-host" data-host><div class="drill-intro"><div class="kicker">Verb drill</div><p class="display it lead">Pronti?</p></div></div>`;
      return () => { clearTimeout(drillTimer); if (drill) { drill.destroy(); drill = null; } };
    },
    enter(api, first) {
      if (!first) return;
      const host = api.body.querySelector('[data-host]');
      const start = () => {
        if (drill) drill.destroy();
        drill = runDrill(host, drillQuestions(), {
          title: 'Verb drill', gameId: 'verb-intro', backHref: '#/learn', xpPer: 3, passScore: PASS, record: false,
          onDone: (result) => {
            st.result = result;
            const passed = result.score >= PASS;
            if (passed && !store.isLearned(e.id)) { store.markLearned(e.id, 'verb'); st.learnedNow = true; }
            store.recordGame('verb-intro', result);
            renderResults(host, result, { passScore: PASS, onRetry: start });
            api.setHint(passed ? 'Passed — swipe up' : 'Not yet — retry or continue');
            api.ready();
            api.refresh();
          },
        });
        api.refresh();
      };
      st.restartDrill = start;
      // let "Pronti?" land before the first question
      drillTimer = setTimeout(() => { if (host.isConnected) start(); }, 900);
    },
  };

  // ---------- 12 FINITO ----------
  const finito = {
    key: 'finito', title: 'Finito', colors: ['#f2c14e', '#ffd97a', '#2dd4bf'], cta: false, noSkip: true,
    render(body, api) { body.innerHTML = '<div class="finito" data-fin></div>'; api.ready(); },
    enter(api) {
      const r = st.result || { score: 0, correct: 0, total: 0, xp: 0 };
      const passed = r.score >= PASS;
      const next = nextNew('verb', 1)[0];
      const xp = (r.xp || 0) + (st.learnedNow ? 30 : 0);
      const fin = api.body.querySelector('[data-fin]');
      fin.innerHTML = html`<div class="fin-word display" data-word>${e.inf}</div>
        <div class="fin-stamp" data-stamp></div>
        <p class="fin-line">${passed ? (st.learnedNow ? 'Added to your learned verbs — it will come back in reviews and games.' : 'Already in your learned verbs. Nice refresher.') : `Score ${PASS}% or more in the drill to add ${e.inf} to your learned verbs.`}</p>
        <div class="fin-xp"><span class="display">+${xp}</span><span class="mono">XP</span><span class="mono fin-score">· ${r.score}% · ${r.correct} of ${r.total} correct</span></div>
        <div class="fin-actions">
          ${passed ? raw(next ? html`<a class="btn primary block" href="#/learn/verb/${encodeURIComponent(next.id)}" data-next-verb>Next verb: ${next.inf}${raw(icon('arrow', { size: 18 }))}</a>` : html`<a class="btn primary block" href="#/learn">All verbs in scope learned</a>`) : raw(html`<button type="button" class="btn primary block" data-retry>${raw(icon('refresh', { size: 18 }))}Retry the drill</button>`)}
          <a class="btn secondary block" href="#/game/conj-drill?src=ids:${encodeURIComponent(e.id)}&tenses=presente,passatoProssimo">${raw(icon('dial', { size: 18 }))}Drill this verb</a>
          <div class="row gap">${passed ? '' : raw(html`<button type="button" class="btn ghost grow" data-forms>Review the forms</button>`)}<a class="btn ghost grow" href="#/learn">Back to Learn</a></div>
        </div>`;
      riseLetters(fin.querySelector('[data-word]'));
      const burst = passed && !st.celebrated; st.celebrated = st.celebrated || passed;
      setTimeout(() => { if (fin.isConnected) celebrate(fin.querySelector('[data-stamp]'), passed, { level, confetti: burst }); }, 380);
      fin.querySelector('[data-retry]')?.addEventListener('click', () => { const di = scenesList.findIndex(s => s.key === 'drill'); api.goto(di); setTimeout(() => st.restartDrill && st.restartDrill(), 500); });
      fin.querySelector('[data-forms]')?.addEventListener('click', () => api.goto(scenesList.findIndex(s => s.key.startsWith('tense-'))));
    },
  };

  const scenesList = [meet, meaning, casesScene, auxScene, ...tenses.map(tenseScene), ...(examples.length ? [examplesScene] : []), nonFiniteScene, drillScene, finito];
  const wt = createWalkthrough(root, { level, scenes: scenesList });
  return () => wt.destroy();
}
