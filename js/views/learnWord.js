// Word walkthrough (#/learn/word/:id): Meet → Forms (flip cards) → Example (tap the word) → Listen & pick →
// Type it → Quick check → Finito. Built on the shared scene engine in ./walkthrough.js. Supports ?auto=1 chaining.
import { html, raw, esc, speak, speakBtn, enPill, levelBadge, haptic, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { getEntry, data, shuffle, CATS, LEVELS, POS_NAME, article, withArticle, isPluralOnly, isUncountable, headword, shortEn, distractors } from '../data.js';
import { hwSize, IT_POS } from '../components.js';
import { fan, typewriter, riseLetters, SCENES } from '../fx.js';
import { runDrill } from '../games/engine.js';
import { qTranslateMC, qTypeIt, qGender, qPluralMC, qCloze, findInSentence, mcChoices } from '../games/questions.js';
import { nextNew } from './learn.js';
import { createWalkthrough, renderCheck, renderResults, celebrate } from './walkthrough.js';

const PASS = 50;
const IT_GENDER = { m: 'maschile', f: 'femminile', mf: 'm · f' };
const EN_IRREG = { child: 'children', man: 'men', woman: 'women', person: 'people', mouse: 'mice', foot: 'feet', tooth: 'teeth', knife: 'knives', life: 'lives', wife: 'wives', leaf: 'leaves', half: 'halves', fish: 'fish', sheep: 'sheep' };
function enPlural(en) {
  const base = shortEn(en).replace(/^(the|a|an)\s+/i, '').trim();
  if (!base) return '';
  const parts = base.split(' ');
  const w = parts[parts.length - 1].toLowerCase();
  let p;
  if (EN_IRREG[w]) p = EN_IRREG[w];
  else if (/[^aeiou]y$/.test(w)) p = w.slice(0, -1) + 'ies';
  else if (/(s|sh|ch|x|z)$/.test(w)) p = w + 'es';
  else if (/^(potato|tomato|hero)$/.test(w)) p = w + 'es';
  else p = w + 's';
  return [...parts.slice(0, -1), p].join(' ');
}
function articleNote(e) {
  if (e.pos !== 'noun') return '';
  const art = article(e, isPluralOnly(e));
  const w = isPluralOnly(e) ? e.pl : e.it;
  const g = e.g === 'f' ? 'feminine' : e.g === 'm' ? 'masculine' : 'masculine or feminine';
  let why = '';
  if (art === "l'") why = `it starts with a vowel, so the article elides to l'`;
  else if (art === 'lo') why = 'masculine nouns starting with s + consonant, z, gn, ps, x or y take lo';
  else if (art === 'la') why = 'feminine nouns take la';
  else if (art === 'il') why = 'masculine nouns take il';
  else if (art === 'gli') why = 'plural masculine nouns starting with a vowel, s + consonant or z take gli';
  else if (art === 'le') why = 'plural feminine nouns take le';
  else if (art === 'i') why = 'plural masculine nouns take i';
  else if (art && art.includes('/')) why = `one word for both genders: ${art}`;
  return `${w} is ${g}${why ? ' — ' + why : ''}.`;
}
function pluralNote(e) {
  if (e.pos !== 'noun') return '';
  if (isUncountable(e)) return 'Uncountable: no plural form.';
  if (isPluralOnly(e)) return 'Used only in the plural.';
  const s = e.it, p = e.pl;
  if (!p || p === '-') return '';
  if (s === p) return `Invariable: the plural is the same word — ${withArticle(e, false)} → ${withArticle(e, true)}.`;
  let i = 0; while (i < s.length && i < p.length && s[i] === p[i]) i++;
  const es = s.slice(i) || '∅', ep = p.slice(i) || '∅';
  return `Plural: -${es} → -${ep}: ${withArticle(e, false)} → ${withArticle(e, true)}.`;
}
const sayText = (e) => (e.pos === 'noun' && !isPluralOnly(e) ? withArticle(e, false) : (e.pos === 'noun' ? withArticle(e, true) : e.it));

export async function render(root, params, query) {
  const e = getEntry(params.id);
  if (!e) { root.innerHTML = '<div class="empty"><p>Word not found.</p><a class="btn primary" href="#/learn">Back to Learn</a></div>'; return; }
  setTitle(headword(e));
  store.pushRecent(e.id);
  const level = LEVELS.includes(e.level) ? e.level : 'A1';
  const auto = query && query.auto === '1';
  let pool = data.vocab.filter(v => v.level === level && v.id !== e.id);
  if (pool.length < 8) pool = data.vocab;
  const isNoun = e.pos === 'noun';
  const st = { result: null, learnedNow: false, restartDrill: null, celebrated: false, autoTimer: null };

  // ---------- MEET ----------
  const floats = [];
  if (isNoun && !isUncountable(e) && !isPluralOnly(e) && e.pl && e.pl !== '-') floats.push({ it: withArticle(e, true), en: enPlural(e.en) });
  if (isNoun && e.fem) floats.push({ it: e.fem, en: `${shortEn(e.en)} (feminine)` });
  if (e.pos === 'adj' && e.forms && e.forms.length === 4) { floats.push({ it: e.forms[1], en: `${shortEn(e.en)} (feminine)` }); floats.push({ it: e.forms[2], en: `${shortEn(e.en)} (plural)` }); }
  const meet = {
    key: 'meet', title: 'Meet', colors: level, cta: 'Avanti', noSkip: true,
    render(body, api) {
      const art = isNoun ? article(e, isPluralOnly(e)) : '';
      const word = isPluralOnly(e) ? e.pl : e.it;
      const cat = CATS[e.cat];
      body.innerHTML = html`<div class="meet-stage ${floats.length ? '' : 'no-floats'}">
          ${raw(floats.slice(0, 3).map((f, i) => html`<span class="float meet-float glass f${i + 1} ${i % 2 ? 'delay' : ''} itx" role="button" tabindex="0" style="--glow:var(--lvl-${level})"><span class="it">${f.it}</span><span class="tr">${f.en}</span></span>`).join(''))}
          ${e.note ? raw(html`<span class="float meet-float glass note ${floats.length ? 'f3' : 'f1'}" style="--glow:var(--lvl-${level})">${e.note}</span>`) : ''}
          <div class="headword center meet-hero" data-hero>
            <div class="hw-line">${art ? raw(html`<span class="article">${art}</span>`) : ''}<span class="word" style="--hw:${hwSize(word)}px" data-word>${word}</span></div>
            <div class="hw-row">${raw(enPill(e.en))}${raw(speakBtn(sayText(e), 'lg'))}</div>
            <div class="tags">${raw(levelBadge(level))}<span>${IT_POS[e.pos] || e.pos}</span>${isNoun ? raw(html`<span>${IT_GENDER[e.g] || e.g}</span>`) : ''}${cat ? raw(html`<span>${cat.name}</span>`) : ''}${e.custom ? raw('<span>custom</span>') : ''}</div>
          </div>
        </div>`;
      api.parallax(body.querySelector('[data-hero]'), 0.15);
      api.ready();
    },
    enter(api, first) {
      riseLetters(api.body.querySelector('[data-word]'));
      if (first) setTimeout(() => speak(sayText(e)), 350);
    },
  };

  // ---------- FORMS ----------
  const formCards = [];
  if (isNoun) {
    if (!isPluralOnly(e)) formCards.push({ label: 'singolare', form: withArticle(e, false) });
    if (!isUncountable(e) && e.pl && e.pl !== '-') formCards.push({ label: 'plurale', form: withArticle(e, true) });
    if (e.fem) formCards.push({ label: 'femminile', form: e.fem });
    if (e.femPl) formCards.push({ label: 'femm. plurale', form: e.femPl });
  } else if (e.pos === 'adj' && e.forms && e.forms.length === 4) {
    ['m · sing.', 'f · sing.', 'm · plur.', 'f · plur.'].forEach((l, i) => formCards.push({ label: l, form: e.forms[i] }));
  }
  let formsFan = null;
  const formsScene = formCards.length < 2 ? null : {
    key: 'forms', title: 'Forms', colors: SCENES.reference, lockLabel: `Flip ${formCards.length === 2 ? 'both' : 'all'} cards`, hintLocked: 'Tap a card to flip it · listen',
    render(body, api) {
      const rules = isNoun ? [articleNote(e), pluralNote(e)].filter(Boolean) : ['Adjectives agree in gender and number with the noun: -o / -a / -i / -e.'];
      body.innerHTML = html`<div class="kicker forms-kicker">Forme · ${formCards.length} ${formCards.length === 1 ? 'card' : 'cards'}</div>
        <div class="fan-stage"><div class="fan-inner"><div class="wt-fan forms-fan" data-fan></div>
        <div class="fan-tools"><button type="button" class="btn xs ghost" data-flip>${raw(icon('flip', { size: 16 }))}Reveal all</button><button type="button" class="btn xs ghost" data-spread>${raw(icon('spread', { size: 16 }))}Spread</button></div></div></div>
        <div class="rule-lines">${raw(rules.map(r => html`<p class="rule-line">${r}</p>`).join(''))}</div>`;
      formsFan = fan(body.querySelector('[data-fan]'), formCards.map(c => ({ key: c.label, front: esc(c.label), back: `<span class="form" style="font-size:${Math.max(...c.form.split(' ').map(w => w.length)) > 9 ? 15 : 19}px">${esc(c.form)}</span><span class="sub">${esc(c.label)}</span>`, tint: `var(--lvl-${level})` })), {
        onFlip(i, flipped) { if (flipped) { speak(formCards[i].form); haptic('light'); } },
        onAllFlipped() { setTimeout(() => api.ready(), 420); },
      });
      body.querySelector('[data-flip]').addEventListener('click', () => formsFan.flipAll(true));
      body.querySelector('[data-spread]').addEventListener('click', (ev) => { const on = formsFan.spread(); ev.currentTarget.classList.toggle('on', on); setTimeout(() => api.refresh(), 450); });
      api.setHelper(() => (api.isReady() ? null : body.querySelector('[data-flip]')));
      return () => formsFan && formsFan.destroy();
    },
    enter() { if (formsFan) requestAnimationFrame(() => formsFan.layout()); },
  };

  // ---------- EXAMPLE: tap the word ----------
  let runExample = null;
  const exampleScene = !e.ex ? null : {
    key: 'example', title: 'Example', colors: SCENES.home, lockLabel: `Find “${e.it}”`, hintLocked: 'Tap the word in the sentence',
    render(body, api) {
      const hit = findInSentence(e.ex, e);
      body.innerHTML = html`<div class="kicker ex-kicker">Esempio · tap the word for “${shortEn(e.en)}”</div>
        <div class="ex-card glass-flat"><div class="itx block ex-tap" role="button" tabindex="0"><div class="it ex-sentence" data-tw></div><div class="tr">${e.exEn || ''}</div></div>
          <div class="row between ex-foot"><span class="kicker" data-ex-hint>${hit ? 'Which word is it?' : 'Tap the sentence for English'}</span>${raw(speakBtn(e.ex, 'sm'))}</div></div>
        <div class="wt-helper"><button type="button" class="btn xs ghost" data-reveal hidden>Show me the word</button></div>`;
      let done = false;
      const found = (revealed) => {
        if (done) return; done = true;
        body.querySelectorAll('.tw-tap').forEach(b => b.classList.add('locked'));
        const t = body.querySelector('.tw-tap.target');
        if (t) t.classList.add('hit');
        body.querySelector('.ex-tap').classList.add('open');
        body.querySelector('.wt-helper')?.remove();
        body.querySelector('[data-ex-hint]').textContent = revealed ? `Here: ${hit ? hit.form : e.it}` : `Esatto — ${hit.form}`;
        haptic(revealed ? 'light' : 'success');
        if (hit) speak(hit.form);
        api.ready();
      };
      runExample = async () => {
        const sentence = body.querySelector('[data-tw]');
        await typewriter(sentence, e.ex, { msPerWord: 60 });
        if (!body.isConnected) return;
        // rebuild the sentence as tappable words (the typewriter animation has finished)
        sentence.innerHTML = '';
        let pos = 0;
        for (const tok of e.ex.split(/(\s+)/)) {
          if (!tok) continue;
          if (/^\s+$/.test(tok)) { sentence.append(document.createTextNode(tok)); pos += tok.length; continue; }
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'tw-word tw-tap'; b.textContent = tok;
          if (hit && pos < hit.end && pos + tok.length > hit.start) b.classList.add('target');
          sentence.append(b); pos += tok.length;
        }
        if (!hit) { api.ready(); return; }
        sentence.addEventListener('click', (ev) => {
          const b = ev.target.closest('.tw-tap'); if (!b || done) return;
          if (b.classList.contains('target')) found(false);
          else { b.classList.add('miss'); haptic('error'); body.querySelector('[data-ex-hint]').textContent = 'Not that one — try again'; setTimeout(() => b.classList.remove('miss'), 500); }
        });
        const rv = body.querySelector('[data-reveal]'); rv.hidden = false;
        rv.addEventListener('click', () => found(true));
        api.refresh();
      };
      api.setHelper(() => (done ? null : body.querySelector('[data-reveal]:not([hidden])')));
    },
    enter(api, first) { if (first && runExample) runExample(); },
  };

  // ---------- LISTEN & PICK ----------
  const listenScene = {
    key: 'listen', title: 'Listen & pick', colors: ['#2dd4bf', '#38bdf8', '#f2c14e'], lockLabel: 'Pick what you hear', hintLocked: 'Tap the speaker, then choose',
    render(body, api) {
      const wrong = distractors(e, pool, 3).map(d => headword(d));
      const q = { type: 'mc', tag: 'Ascolta', say: sayText(e), choices: mcChoices(headword(e), wrong), answer: headword(e), explain: html`${headword(e)} — ${shortEn(e.en)}` };
      const chk = renderCheck(body, q, {
        prompt: html`<div class="prompt">Ascolta · which word did you hear?</div><div class="listen-big">${raw(speakBtn(sayText(e), 'lg'))}</div><div class="sub">Tap to listen again</div>`,
        onDone: () => api.ready(), speakAnswer: false,
      });
      api.setHelper(() => chk.helper());
    },
    enter(api, first) { if (first) setTimeout(() => speak(sayText(e)), 500); },
  };

  // ---------- TYPE IT ----------
  const typeScene = {
    key: 'type', title: 'Type it', colors: ['#a78bfa', '#f2c14e', '#38bdf8'], lockLabel: 'Type the Italian', hintLocked: 'Accents are on the keys below',
    render(body, api) {
      const q = qTypeIt(e);
      const hint = isNoun ? (e.g === 'mf' ? 'noun' : e.g === 'f' ? 'feminine noun' : 'masculine noun') : (POS_NAME[e.pos] || e.pos);
      const chk = renderCheck(body, q, {
        prompt: html`<div class="prompt">Scrivi · type the Italian</div><div class="big md">${shortEn(e.en)}</div><div class="sub">${hint}${e.it.length > 2 ? ' · ' + e.it.length + ' letters' : ''}</div>`,
        placeholder: 'In italiano…',
        onDone: () => api.ready(),
      });
      api.setHelper(() => chk.helper());
    },
    enter(api, first) { if (first) setTimeout(() => api.body.querySelector('[data-answer]')?.focus({ preventScroll: true }), 500); },
  };

  // ---------- QUICK CHECK ----------
  const quickQuestions = () => [
    qTranslateMC(e, pool, 'it-en'),
    isNoun ? (qGender(e) || qCloze(e, { pool })) : (qCloze(e, { pool }) || qTranslateMC(e, pool, 'en-it')),
    (isNoun && Math.random() < 0.5 ? qPluralMC(e, pool) : null) || qTranslateMC(e, pool, 'en-it'),
  ].filter(Boolean);
  const quickScene = {
    key: 'quick', title: 'Quick check', colors: SCENES.games, lockLabel: 'Finish the check', hintLocked: 'Three questions · pass with 50 %', noSkip: true,
    render(body) { body.innerHTML = html`<div class="drill-host" data-host><div class="drill-intro"><div class="kicker">Quick check</div><p class="display it lead">Pronti?</p></div></div>`; },
    enter(api, first) {
      if (!first) return;
      const host = api.body.querySelector('[data-host]');
      const start = () => {
        runDrill(host, quickQuestions(), {
          title: 'Word check', gameId: 'word-intro', backHref: '#/learn', xpPer: 2, passScore: PASS, record: false,
          onDone: (result) => {
            st.result = result;
            const passed = result.score >= PASS;
            if (passed && !store.isLearned(e.id)) { store.markLearned(e.id, 'word'); st.learnedNow = true; }
            store.recordGame('word-intro', result);
            renderResults(host, result, { passScore: PASS, retryLabel: 'Retry', onRetry: start });
            api.setHint(passed ? 'Passed — swipe up' : 'Not yet — retry or continue');
            api.ready(); api.refresh();
          },
        });
        api.refresh();
      };
      st.restartDrill = start;
      start();
    },
  };

  // ---------- FINITO ----------
  const finito = {
    key: 'finito', title: 'Finito', colors: ['#f2c14e', '#ffd97a', '#2dd4bf'], cta: false, noSkip: true,
    render(body, api) { body.innerHTML = '<div class="finito" data-fin></div>'; api.ready(); },
    enter(api) {
      const r = st.result || { score: 0, correct: 0, total: 0, xp: 0 };
      const passed = r.score >= PASS;
      const day = store.today();
      const left = Math.max(0, store.settings.dailyNew - ((day.new || 0) - (day.newVerbs || 0)));
      const next = nextNew('word', 1)[0];
      const chain = auto && passed && next && left > 0;
      const nextHref = next ? `#/learn/word/${encodeURIComponent(next.id)}${auto ? '?auto=1' : ''}` : '#/learn';
      const xp = (r.xp || 0) + (st.learnedNow ? 10 : 0);
      const fin = api.body.querySelector('[data-fin]');
      fin.innerHTML = html`<div class="fin-word display" data-word>${headword(e)}</div>
        <div class="fin-stamp" data-stamp></div>
        <p class="fin-line">${passed ? (st.learnedNow ? 'Learned — it will come back in reviews and games.' : 'Already in your learned words. Nice refresher.') : `Score ${PASS}% or more to add ${e.it} to your learned words.`}</p>
        <div class="fin-xp"><span class="display">+${xp}</span><span class="mono">XP</span><span class="mono fin-score">· ${r.score}% · ${r.correct} of ${r.total} correct</span></div>
        <div class="fin-actions">
          ${passed ? raw(html`<a class="btn primary block" href="${nextHref}" data-next-word>${next ? 'Next word: ' + headword(next) : 'All words in scope learned'}${raw(icon('arrow', { size: 18 }))}</a>`) : raw(html`<button type="button" class="btn primary block" data-retry>${raw(icon('refresh', { size: 18 }))}Retry the check</button>`)}
          <div class="row gap">${passed ? '' : raw(html`<button type="button" class="btn ghost grow" data-meet>Back to the card</button>`)}<a class="btn ghost grow" href="#/learn">Back to Learn</a></div>
          ${chain ? raw('<div class="kicker center fin-auto" data-auto>next word in 3</div>') : ''}
        </div>`;
      riseLetters(fin.querySelector('[data-word]'));
      const burst = passed && !st.celebrated; st.celebrated = st.celebrated || passed;
      setTimeout(() => { if (fin.isConnected) celebrate(fin.querySelector('[data-stamp]'), passed, { level, confetti: burst }); }, 380);
      fin.querySelector('[data-retry]')?.addEventListener('click', () => { api.goto(scenesList.findIndex(s => s.key === 'quick')); setTimeout(() => st.restartDrill && st.restartDrill(), 500); });
      fin.querySelector('[data-meet]')?.addEventListener('click', () => api.goto(0));
      clearInterval(st.autoTimer);
      if (chain) {
        let left3 = 3;
        const lab = fin.querySelector('[data-auto]');
        st.autoTimer = setInterval(() => {
          left3--;
          if (!fin.isConnected) { clearInterval(st.autoTimer); return; }
          if (left3 <= 0) { clearInterval(st.autoTimer); location.replace(nextHref); }
          else lab.textContent = `next word in ${left3}`;
        }, 1000);
      }
    },
    leave() { clearInterval(st.autoTimer); },
  };

  const scenesList = [meet, formsScene, exampleScene, listenScene, typeScene, quickScene, finito].filter(Boolean);
  const wt = createWalkthrough(root, { level, scenes: scenesList });
  return () => { clearInterval(st.autoTimer); wt.destroy(); };
}
