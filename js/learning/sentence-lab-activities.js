// Presentation for the sentence workshop (Officina delle frasi): HTML for the five activity kinds, the blank controls,
// the drill sheet, the picker and the finish screen. Pure string builders on the course's lesson-shell classes
// (css/grammar-course.css) plus the workshop's own (css/sentence-lab.css); grading and state live in ./sentence-lab.js
// and the player (js/views/labFrasiLesson.js) owns every event. Data hooks (data-lab-*) are what the browser suite uses.
import { html, raw, icon, speakBtn } from '../ui.js';
import { getEntry, headword, withArticle, isPluralOnly } from '../data.js';
import { feedbackHTML } from '../games/engine.js';

export const ROLE_LABEL = { subject: 'who', verb: 'verb', object: 'what', extra: 'when · where', link: 'link' };
const ROLES = new Set(['subject', 'verb', 'object', 'extra', 'link']);
const roleOf = role => (ROLES.has(role) ? role : 'extra');
const BLANK = /_{2,}/;
const same = (a, b) => String(a ?? '').normalize('NFC').toLocaleLowerCase('it').trim() === String(b ?? '').normalize('NFC').toLocaleLowerCase('it').trim();
const join = parts => raw(parts.join(''));

export const labButton = (label, attr, cls = 'secondary') => html`<button type="button" class="btn ${cls} block" ${raw(attr)}>${label}</button>`;
const kickerHTML = (it, en) => html`<span class="kicker lab-kicker"><span lang="it">${it}</span> · ${en}</span>`;

// ---------- model ----------
// `roles` ([["Io","subject"], …]) colours the tokens; without it the sentence is plain text.
export function labTokens(it, roles) {
  if (!Array.isArray(roles) || !roles.length) return html`${it}`;
  return join(roles.map(([token, role]) => html`<span class="lab-tok" data-role="${roleOf(role)}">${token}</span> `));
}
const vocabEntry = v => (v && typeof v === 'object' ? getEntry(v.pos === 'verb' ? `v:${v.it}` : `w:${v.it}|${v.pos}`) : null);
export function labVocab(vocab = []) {
  const rows = vocab.filter(v => v && v.it).map(v => {
    const e = vocabEntry(v);
    const say = e ? (e.kind === 'verb' ? e.inf : e.pos === 'noun' ? withArticle(e, isPluralOnly(e)) : headword(e)) : v.it;
    return html`<li><span class="lab-vocab-it" lang="it">${say}</span><span class="lab-en">${v.en || e?.en || ''}</span>${raw(speakBtn(say, 'sm'))}</li>`;
  });
  return rows.length ? html`<div class="lab-vocab"><span class="kicker">Parole utili · Useful words</span><ul>${join(rows)}</ul></div>` : '';
}
export function labModel(activity, lesson, { first = false } = {}) {
  const pattern = Array.isArray(activity.pattern) ? activity.pattern : [];
  const examples = Array.isArray(activity.examples) ? activity.examples : [];
  return html`<section class="grammar-teach lab-model" data-lab-model>
    ${raw(kickerHTML('Il modello', 'The pattern'))}
    <h1 tabindex="-1" data-focus>${activity.prompt}</h1>
    ${pattern.length ? raw(html`<div class="lab-pattern" role="img" aria-label="Pattern: ${pattern.map(p => p.label).join(' + ')}">${join(pattern.map((p, i) => html`${i ? raw('<span class="lab-plus" aria-hidden="true">+</span>') : ''}<span class="lab-role" data-role="${roleOf(p.role)}">${p.label}</span>`))}</div>`) : ''}
    ${activity.body ? raw(html`<p class="grammar-body">${activity.body}</p>`) : ''}
    <div class="lab-examples" role="list">${join(examples.map(ex => html`<article class="glass-flat lab-example" role="listitem"><div class="lab-example-top"><p lang="it" data-italian-sentence data-english="${ex.en || ''}">${raw(labTokens(ex.it, ex.roles))}</p>${raw(speakBtn(ex.it, 'sm'))}</div><p class="lab-en">${ex.en || ''}</p></article>`))}</div>
    ${activity.tip ? raw(html`<aside class="grammar-hint">${activity.tip}</aside>`) : ''}
    ${first ? raw(labVocab(lesson?.vocab)) : ''}
  </section>`;
}

// ---------- order ----------
// ui: { tokenOrder: [index into tokens…], picked: [index…], hint }. tokens = [...activity.tokens, ...activity.distractors].
export const orderTokens = activity => [...(activity.tokens || []), ...(activity.distractors || [])];
export function labOrder(activity, ui, { locked = false } = {}) {
  const tokens = orderTokens(activity), order = Array.isArray(ui.tokenOrder) ? ui.tokenOrder : tokens.map((_, i) => i), picked = Array.isArray(ui.picked) ? ui.picked : [];
  return html`<section class="grammar-question lab-order" data-lab-order>
    ${raw(kickerHTML('Costruisci', 'Build it'))}
    <h1 tabindex="-1" data-focus>${activity.prompt}</h1>
    <p class="grammar-translation">${activity.en || ''}</p>
    <div class="grammar-built lab-built" aria-label="Your sentence" data-lab-built>${picked.length ? join(picked.map((ti, k) => html`<button type="button" class="chip lab-chip" data-lab-remove="${k}" ${locked ? raw('disabled') : ''}>${tokens[ti]}</button>`)) : raw('<span class="muted">Tap the words in order</span>')}</div>
    <div class="grammar-tokens lab-tokens" aria-label="Words">${join(order.map(ti => html`<button type="button" class="chip lab-chip" data-lab-token="${ti}" ${picked.includes(ti) || locked ? raw('disabled') : ''}>${tokens[ti]}</button>`))}</div>
    ${activity.hint && ui.hint ? raw(html`<aside class="grammar-hint">${activity.hint}</aside>`) : ''}
    ${!locked && activity.hint && !ui.hint ? raw(html`<div class="journey-tools"><button type="button" class="btn ghost" data-lab-hint>Help me</button></div>`) : ''}
  </section>`;
}

// ---------- blanks (cloze and dialogue turns) ----------
// ui: { values[], active, bankOpen{}, freeOpen{}, drafts{}, messages{}, notes{}, hint }
const NOTE_SLUG = { natural: 'natural', 'unusual here': 'unusual', 'odd here': 'odd' };
export function labSentence(template, blanks, ui, { locked = false, result = null, align = 'center' } = {}) {
  const parts = String(template ?? '').split(BLANK);
  const out = [];
  parts.forEach((text, i) => {
    out.push(html`${text}`);
    if (i >= parts.length - 1) return;
    const graded = result?.blanks?.[i];
    if (locked && graded) out.push(html`<span class="lab-blank is-filled ${graded.revealed ? 'is-revealed' : ''} is-${graded.outcome || 'done'}">${graded.filled}</span>`);
    else {
      const value = ui.values?.[i] || '', note = ui.notes?.[i];
      out.push(html`<button type="button" class="lab-blank ${value ? 'is-filled' : ''}" data-lab-blank="${i}" aria-pressed="${ui.active === i ? 'true' : 'false'}" aria-label="${value ? `Blank ${i + 1}: ${value}` : `Blank ${i + 1}, empty`}">${value || '…'}</button>${note ? raw(html`<span class="lab-fit-note" data-note="${NOTE_SLUG[note] || 'note'}" title="Fit scorer: ${note}">${note}</span>`) : ''}`);
    }
  });
  return html`<p class="lab-sentence lab-sentence-${align}" lang="it">${join(out)}</p>`;
}
const PLACEHOLDER = { adj: 'An adjective, in Italian or English', noun: 'A noun, in Italian or English', verb: 'A verb, any form', adv: 'A time or place word', expr: 'A word or phrase' };
function labFreeForm(blank, i, ui) {
  const msg = ui.messages?.[i];
  return html`<form class="lab-free" data-lab-free-form="${i}" autocomplete="off">
    <label class="sr-only" for="lab-free-${i}">Your word</label>
    <input id="lab-free-${i}" class="input" data-lab-free-input="${i}" value="${ui.drafts?.[i] || ''}" placeholder="${PLACEHOLDER[blank.slot?.pos] || PLACEHOLDER.expr}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done">
    <button type="submit" class="btn secondary sm" data-lab-free-submit="${i}">Use it</button>
  </form>
  <div class="journey-accents lab-accents" aria-label="Accents">${join(['à', 'è', 'é', 'ì', 'ò', 'ù'].map(l => html`<button type="button" data-lab-accent="${l}" data-blank="${i}">${l}</button>`))}</div>
  ${msg ? raw(html`<p class="lab-free-message" role="status" data-lab-free-message="${i}">${msg.text}${msg.suggestions?.length ? raw(html` <span class="lab-suggest-label">Did you mean</span> ${join(msg.suggestions.map(s => html`<button type="button" class="chip sm lab-suggest" data-lab-suggest="${s}" data-blank="${i}">${s}</button>`))}`) : ''}</p>`) : ''}`;
}
export function labBlankControls(blank, i, ui) {
  if (!blank) return '';
  const options = Array.isArray(blank.options) ? blank.options : [], bank = (Array.isArray(blank.bank) ? blank.bank : []).filter(b => !options.some(o => same(o, b)));
  const value = ui.values?.[i] || '';
  return html`<div class="lab-controls" data-lab-controls="${i}">
    <div class="chips lab-options" role="group" aria-label="Choices for blank ${i + 1}">${join(options.map(o => html`<button type="button" class="chip lab-option ${same(o, value) ? 'on' : ''}" data-lab-option="${o}" data-blank="${i}" aria-pressed="${same(o, value) ? 'true' : 'false'}">${o}</button>`))}</div>
    ${bank.length || blank.free ? raw(html`<div class="lab-ctl-row">${bank.length ? raw(html`<button type="button" class="btn ghost xs" data-lab-bank="${i}" aria-expanded="${ui.bankOpen?.[i] ? 'true' : 'false'}">${raw(icon('book', { size: 16 }))} Word bank</button>`) : ''}${blank.free ? raw(html`<button type="button" class="btn ghost xs" data-lab-free="${i}" aria-expanded="${ui.freeOpen?.[i] ? 'true' : 'false'}">${raw(icon('edit', { size: 16 }))} Your word</button>`) : ''}</div>`) : ''}
    ${ui.bankOpen?.[i] && bank.length ? raw(html`<div class="chips lab-bank" role="group" aria-label="Word bank">${join(bank.map(o => html`<button type="button" class="chip lab-option ${same(o, value) ? 'on' : ''}" data-lab-option="${o}" data-blank="${i}" aria-pressed="${same(o, value) ? 'true' : 'false'}">${o}</button>`))}</div>`) : ''}
    ${ui.freeOpen?.[i] && blank.free ? raw(labFreeForm(blank, i, ui)) : ''}
  </div>`;
}
export function labCloze(activity, ui, { locked = false, result = null } = {}) {
  const blanks = Array.isArray(activity.blanks) ? activity.blanks : [];
  const active = Number.isInteger(ui.active) && blanks[ui.active] ? ui.active : 0;
  return html`<section class="grammar-question lab-cloze" data-lab-cloze>
    ${raw(kickerHTML('Completa', 'Fill it in'))}
    <h1 tabindex="-1" data-focus>${activity.prompt}</h1>
    <p class="grammar-translation">${activity.en || ''}</p>
    ${raw(labSentence(activity.template, blanks, { ...ui, active }, { locked, result }))}
    ${!locked ? raw(labBlankControls(blanks[active], active, ui)) : ''}
    ${activity.hint && ui.hint ? raw(html`<aside class="grammar-hint">${activity.hint}</aside>`) : ''}
    ${!locked && activity.hint && !ui.hint ? raw(html`<div class="journey-tools"><button type="button" class="btn ghost" data-lab-hint>Help me</button></div>`) : ''}
  </section>`;
}

// ---------- dialogue ----------
// state is the engine's dialogue view ({ partner, turns, current, complete }); ui as for blanks plus { turn, thinking }.
export function labDialogue(activity, state, ui, { locked = false } = {}) {
  const partner = state.partner || activity.partner || 'Partner';
  const bubbles = [];
  for (const t of state.turns || []) {
    if (t.speaker === 'partner') bubbles.push(html`<div class="lab-bubble" data-speaker="partner" data-turn="${t.index}" ${t.reaction ? raw('data-reaction') : ''}><span class="lab-bubble-name">${partner}</span><p lang="it">${t.it}</p><p class="lab-en">${t.en || ''}</p>${raw(speakBtn(t.it, 'sm'))}</div>`);
    else if (t.pending) {
      const blanks = t.blanks || [], active = Number.isInteger(ui.active) && blanks[ui.active] ? ui.active : 0;
      bubbles.push(html`<div class="lab-bubble is-pending" data-speaker="you" data-turn="${t.index}" data-lab-pending><span class="lab-bubble-name">You</span>${raw(labSentence(t.template, blanks, { ...ui, active }, { align: 'left' }))}<p class="lab-en">${t.en || ''}</p>${!locked ? raw(labBlankControls(blanks[active], active, ui)) : ''}${t.hint && ui.hint ? raw(html`<aside class="grammar-hint">${t.hint}</aside>`) : ''}</div>`);
    } else bubbles.push(html`<div class="lab-bubble" data-speaker="you" data-turn="${t.index}" data-outcome="${t.outcome || ''}"><span class="lab-bubble-name">You${t.revealed ? raw('<span class="lab-revealed"> · shown</span>') : ''}</span><p lang="it">${t.it}</p><p class="lab-en">${t.en || ''}</p>${raw(speakBtn(t.it, 'sm'))}</div>`);
  }
  if (ui.thinking) bubbles.push(html`<div class="lab-bubble is-typing" data-speaker="partner" aria-label="${partner} is typing"><span class="lab-bubble-name">${partner}</span><p aria-hidden="true">…</p></div>`);
  const all = (state.turns || []).filter(t => !t.pending).map(t => t.it).join(' ');
  return html`<section class="lab-dialogue" data-lab-dialogue data-complete="${state.complete ? 'true' : 'false'}">
    ${raw(kickerHTML('Conversazione', 'Conversation'))}
    <h1 tabindex="-1" data-focus>${activity.prompt}</h1>
    <p class="grammar-translation">A chat with ${partner}${state.complete ? '' : ' · one turn at a time'}</p>
    <div class="lab-chat" data-lab-chat aria-live="polite">${join(bubbles)}</div>
    ${state.complete ? raw(html`<div class="lab-replay"><button type="button" class="btn ghost sm" data-say="${all}" data-lab-replay>${raw(icon('speaker', { size: 16 }))} Replay the conversation</button></div>`) : ''}
  </section>`;
}

// ---------- build ----------
// ui.choice = { [role]: index | 'yours:<n>' }; yours = { [role]: [{ it, en, entryId }] }; composed = composeBuild(...)
export function labBuild(activity, ui, { composed, yours = {}, locked = false } = {}) {
  const roles = Array.isArray(activity.roles) ? activity.roles : [], choice = ui.choice || {};
  const rows = roles.map(role => {
    const items = Array.isArray(role.items) ? role.items : [], mine = yours[role.role] || [];
    const on = key => String(choice[role.role]) === String(key);
    return html`<div class="lab-role-row" data-role="${roleOf(role.role)}">
      <span class="kicker lab-role" data-role="${roleOf(role.role)}">${role.label || ROLE_LABEL[role.role] || role.role}${role.optional === true ? raw('<span class="lab-optional"> · optional</span>') : ''}</span>
      <div class="chips lab-items" role="group" aria-label="${role.label || ROLE_LABEL[role.role] || role.role}">${join(items.map((item, i) => html`<button type="button" class="chip lab-chip lab-pick ${on(i) ? 'on' : ''}" data-lab-pick="${role.role}" data-item="${i}" aria-pressed="${on(i) ? 'true' : 'false'}" ${locked ? raw('disabled') : ''}>${item.it || item.inf}</button>`))}${join(mine.map((item, i) => html`<button type="button" class="chip lab-chip lab-pick lab-yours ${on(`yours:${i}`) ? 'on' : ''}" data-lab-pick="${role.role}" data-item="yours:${i}" aria-pressed="${on(`yours:${i}`) ? 'true' : 'false'}" ${locked ? raw('disabled') : ''}><span>${item.it}</span><span class="lab-yours-tag">yours</span></button>`))}</div>
    </div>`;
  });
  return html`<section class="grammar-question lab-build" data-lab-build>
    ${raw(kickerHTML('Dillo tu', 'Say it yourself'))}
    <h1 tabindex="-1" data-focus>${activity.prompt}</h1>
    ${activity.hint ? raw(html`<p class="grammar-translation">${activity.hint}</p>`) : ''}
    <div class="lab-composed glass ${composed?.ok ? 'is-ok' : ''}" data-lab-composed aria-live="polite">${composed?.ok ? raw(html`<p class="lab-composed-it" lang="it" data-italian-sentence data-english="${composed.en}">${composed.it}</p><div class="lab-composed-row"><p class="lab-composed-en">${composed.en}</p>${raw(speakBtn(composed.it, 'sm'))}</div>`) : raw(html`<p class="lab-composed-hint">${composed?.reason || 'Pick one word for each role.'}</p>`)}</div>
    <div class="lab-roles">${join(rows)}</div>
    ${Array.isArray(activity.examples) && activity.examples.length ? raw(html`<p class="lab-build-examples"><span class="kicker">Esempi</span> ${join(activity.examples.map(ex => html`<span lang="it">${ex}</span>`))}</p>`) : ''}
  </section>`;
}

// ---------- finish, pause ----------
export function labSentencesList(sentences = [], { lessonTitle = null } = {}) {
  return html`<ul class="lab-sentences">${join(sentences.map(s => html`<li class="lab-sentence-row"><div><p lang="it" data-italian-sentence data-english="${s.en || ''}">${s.it}</p><p class="lab-en">${s.en || ''}${s.title && !lessonTitle ? raw(html` <span class="lab-sentence-lesson">· ${s.title}</span>`) : ''}</p></div>${raw(speakBtn(s.it, 'sm'))}</li>`))}</ul>`;
}
export function labComplete(lesson, { sentences = [], first = false, refs = [], xp = 15 } = {}) {
  return html`<section class="grammar-finish lab-finish" data-lab-complete data-first="${first ? 'true' : 'false'}">
    <div class="journey-recap-mark">${raw(icon('check', { size: 28 }))}</div>
    ${raw(kickerHTML('Lezione completata', 'Lesson complete'))}
    <h1 tabindex="-1" data-focus>${lesson.title}</h1>
    <p class="grammar-body">${lesson.outcome || ''}</p>
    ${first ? raw(html`<p class="lab-xp" data-lab-xp>+${xp} XP</p>`) : ''}
    ${sentences.length ? raw(html`<h2>Le mie frasi <small>· from this lesson</small></h2>${raw(labSentencesList(sentences, { lessonTitle: lesson.title }))}`) : ''}
    ${refs.length ? raw(html`<h2>Review the pattern</h2><div class="lab-refs">${join(refs.map(r => html`<a class="btn ghost sm" href="${r.href}">${raw(icon('book', { size: 16 }))} ${r.title}</a>`))}</div>`) : ''}
  </section>`;
}
export function labPaused(lesson) {
  return html`<section class="grammar-finish lab-paused" data-lab-paused><span class="kicker">Your place is saved</span><h1 tabindex="-1" data-focus>${lesson.title}</h1><p class="grammar-body">Resume whenever you are ready; the lesson picks up at this activity.</p>${raw(labButton('Resume lesson', 'data-lab-resume', 'primary'))}<a class="btn secondary block" href="#/lab/frasi">Back to the workshop</a><a class="btn ghost block" href="#/learn">Back to Learn</a></section>`;
}

// ---------- drills (the three quick drills of a free-entry word) and the picker ----------
// drill: { skill, type: 'mc'|'type', label, prompt, big, lang, choices?: [{ label, correct }], answer, explain, say }
// view: { phase: 'intro'|'drill'|'done'|'failed', index, total, repeat, picked, draft, ok, word: { it, en, say } }
export function labDrill(drill, view) {
  const w = view.word || {};
  if (view.phase === 'intro') return html`<div class="lab-drill" data-drill="intro"><span class="kicker">Parola nuova · New word</span><p class="lab-drill-word" lang="it">${w.say || w.it}</p><p class="lab-en">${w.en || ''}</p><div class="lab-drill-say">${raw(speakBtn(w.say || w.it, 'sm'))}</div><p class="small muted">Three quick drills add it to your words (+10 XP), then it goes into the blank.</p><div class="row gap"><button type="button" class="btn ghost grow" data-drill-skip>Not now</button><button type="button" class="btn primary grow" data-drill-start>Start</button></div></div>`;
  if (view.phase === 'done') return html`<div class="lab-drill" data-drill="done"><div class="journey-recap-mark">${raw(icon('check', { size: 26 }))}</div><span class="kicker">Imparato · Learned · +10 XP</span><p class="lab-drill-word" lang="it">${w.say || w.it}</p><p class="lab-en">${w.en || ''}</p><button type="button" class="btn primary block" data-drill-done>Use it in the sentence</button></div>`;
  if (view.phase === 'failed') return html`<div class="lab-drill" data-drill="failed"><span class="kicker">Not this time</span><p class="lab-drill-word" lang="it">${w.say || w.it}</p><p class="lab-en">${w.en || ''}</p><p class="small muted">The word stays unlearned for now: pick one of the options, or try it again later.</p><button type="button" class="btn secondary block" data-drill-close>Close</button></div>`;
  const fb = view.ok !== null && view.ok !== undefined;
  let body;
  if (drill.type === 'mc') body = html`<div class="lab-drill-choices grammar-choices" role="group">${join(drill.choices.map((c, i) => html`<button type="button" class="choice ${fb && c.correct ? 'is-correct' : fb && view.picked === i ? 'is-wrong' : ''}" data-drill-choice="${i}" ${fb ? raw('disabled') : ''}><span class="journey-choice-marker">${String.fromCharCode(65 + i)}</span><span>${c.label}</span></button>`))}</div>`;
  else body = html`<form class="lab-drill-form" data-drill-form><label class="sr-only" for="lab-drill-input">Your answer</label><input id="lab-drill-input" class="input" data-drill-input value="${view.draft || ''}" ${fb ? raw('readonly') : ''} placeholder="In italiano…" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done"><div class="journey-accents lab-accents">${join(['à', 'è', 'é', 'ì', 'ò', 'ù', "'"].map(l => html`<button type="button" data-drill-accent="${l}" ${fb ? raw('disabled') : ''}>${l}</button>`))}</div>${!fb ? raw(html`<button type="submit" class="btn primary block" data-drill-check ${view.draft?.trim() ? '' : raw('disabled')}>Check</button>`) : ''}</form>`;
  const feedback = fb ? feedbackHTML({ ok: view.ok, title: view.ok ? 'Esatto.' : view.repeat ? 'Not yet. Moving on.' : 'Not quite. Once more.', detail: `<p lang="it">${drill.answer}</p><p>${drill.explain}</p>`, nextAttribute: 'data-drill-next', nextLabel: view.index + 1 >= view.total && (view.ok || view.repeat) ? 'Finish' : 'Continue' }) : '';
  return html`<div class="lab-drill" data-drill="${drill.skill}" data-step="${view.index + 1}" data-repeat="${view.repeat ? 'true' : 'false'}"><span class="kicker">${view.index + 1} / ${view.total} · ${drill.label}${view.repeat ? ' · again' : ''}</span><p class="lab-drill-prompt">${drill.prompt}</p><p class="lab-drill-big" lang="${drill.lang}">${drill.big}</p>${raw(body)}${raw(feedback)}</div>`;
}
export function labPicker(candidates = []) {
  return html`<div class="lab-picker" data-lab-picker><span class="kicker">Scegli · Choose the word</span><p class="small muted">Several Italian words fit here. Pick the one you mean; you will meet it in three quick drills if it is new.</p><div class="lab-drill-choices grammar-choices">${join(candidates.map((c, i) => html`<button type="button" class="choice" data-lab-candidate="${i}"><span class="journey-choice-marker">${String.fromCharCode(65 + i)}</span><span class="lab-cand"><span class="lab-cand-it" lang="it">${c.display || c.form || c.it}</span><span class="lab-cand-en">${c.en || ''}</span></span></button>`))}</div><button type="button" class="btn ghost block" data-close>Cancel</button></div>`;
}
