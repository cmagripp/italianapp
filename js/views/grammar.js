// Grammar reference (#/grammar, #/grammar/:topic): reading layout on glass, typeset like a codex.
// Content comes from data/grammar.json (schema in docs/GRAMMAR.md); live examples are drawn from the dictionary.
import { html, raw, esc, trBlock, speakBtn, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { data, getEntry, article, withArticle, headword, isPluralOnly, hasPluralForm, fold } from '../data.js';
import { conjugate, primary, splitClitic } from '../conjugator.js';
import { setScene, mount, reducedMotion } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));
const refHref = (id) => '#/reference/' + encodeURIComponent(id);

// Minimal fallback used only when data/grammar.json cannot be fetched (keeps the hub list and the routes alive).
export const GRAMMAR_FALLBACK = [
  { id: 'articles', title: 'Articles & gender', titleIt: 'Articoli e genere', summary: "How to choose il/lo/l'/la and un/uno/una/un', and how a noun's ending tells you its gender.", practiceGame: 'gender' },
  { id: 'plurals', title: 'Plurals', titleIt: 'Il plurale', summary: 'Regular endings, -co/-go and -ca/-ga, -io, invariable and irregular plurals.', practiceGame: 'plurals' },
  { id: 'adjectives', title: 'Adjectives', titleIt: 'Gli aggettivi', summary: 'Agreement in gender and number, the two adjective classes, position and invariables.', practiceGame: 'quiz' },
  { id: 'tenses', title: 'The tense system', titleIt: 'I tempi verbali', summary: 'Moods and tenses at a glance: which to use when.', practiceGame: 'tense-detective' },
  { id: 'passato-imperfetto', title: 'Passato prossimo vs imperfetto', titleIt: 'Passato prossimo o imperfetto?', summary: 'Completed events against background, habit and description.', practiceGame: 'tense-detective' },
  { id: 'auxiliaries', title: 'Essere or avere?', titleIt: 'Essere o avere?', summary: 'Choosing the auxiliary in compound tenses, and when the participle agrees.', practiceGame: 'aux' },
  { id: 'reflexives', title: 'Reflexive & pronominal verbs', titleIt: 'Verbi riflessivi e pronominali', summary: 'mi/ti/si… before the verb, attached to the imperative, and essere in the past.', practiceGame: 'conj-drill' },
  { id: 'spelling', title: 'Spelling changes in verbs', titleIt: 'Cambi di ortografia', summary: '-care/-gare, -ciare/-giare and -iare: keeping the sound when the ending changes.', practiceGame: 'conj-drill' },
  { id: 'isc', title: 'The -isc- verbs', titleIt: 'I verbi in -isc-', summary: 'capisco, finisci, preferisce: which -ire verbs take the infix.', practiceGame: 'conj-choice' },
  { id: 'imperative', title: 'Imperative & formal Lei', titleIt: "L'imperativo", summary: 'Commands with tu, noi, voi, the polite Lei, negatives and pronouns.', practiceGame: 'conj-drill' },
  { id: 'pronouns', title: 'Object pronouns', titleIt: 'I pronomi', summary: 'Direct, indirect, combined and where they go.', practiceGame: 'cloze' },
  { id: 'prepositions', title: 'Prepositions', titleIt: 'Le preposizioni', summary: 'di, a, da, in, con, su, per, tra: articulated forms and verb patterns.', practiceGame: 'patterns' },
];

let grammarPromise = null;
export function loadGrammar() {
  if (!grammarPromise) {
    grammarPromise = fetch('data/grammar.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(arr => (Array.isArray(arr) && arr.length ? arr : GRAMMAR_FALLBACK))
      .catch(() => GRAMMAR_FALLBACK);
  }
  return grammarPromise;
}

// *italics* → <em class="gi">…</em> (escaped first)
export function richText(s) {
  return esc(s).replace(/\*([^*]+)\*/g, '<em class="gi">$1</em>');
}
const pad2 = (n) => String(n).padStart(2, '0');

// ---------- live examples from the dictionary ----------
const nouns = () => data.vocab.filter(e => e.pos === 'noun');
const byLevel = (a, b) => 'A1A2B1B2C1C2'.indexOf(a.level || 'C2') - 'A1A2B1B2C1C2'.indexOf(b.level || 'C2');
const LO_RE = /^(s[bcdfghjklmnpqrstvwxz]|z|gn|ps|pn|x|y|i[aeiou])/; // same rule as article() in data.js
const first = (arr, n) => arr.slice().sort(byLevel).slice(0, n);
const liveRow = (e, it, note) => html`<a class="live-row" href="${refHref(e.id)}"><span class="lr-main"><span class="lr-it">${it}</span>${note ? raw(html`<span class="lr-note">${note}</span>`) : ''}</span>${raw(speakBtn(it, 'sm'))}${ic('chevronRight', { size: 18 })}</a>`;
const conjOf = (e) => conjugate(e.inf, { aux: e.aux, isc: e.isc });
// io form, or the third person for an impersonal verb (volerci → ci vuole, not "ci voglio")
const presOf = (e) => primary(conjOf(e).tenses.presente[/impersonal/i.test(e.usage || '') ? 2 : 0]);

function liveExamples(topicId, section, idx) {
  const h = fold(section.heading || '');
  const rows = [];
  let kicker = 'Dal dizionario';
  const pushN = (list, fn, n = 6) => { for (const e of first(list, n)) rows.push(fn(e)); };
  if (topicId === 'articles') {
    if (/lo|gli/.test(h) && idx < 3) pushN(nouns().filter(e => e.g === 'm' && LO_RE.test(fold(e.it)) && hasPluralForm(e) && !isPluralOnly(e)), e => liveRow(e, `${withArticle(e)} → ${withArticle(e, true)}`, e.en.split(';')[0]));
    else if (/-o, -a, -e/.test(h)) {
      pushN(nouns().filter(e => e.g === 'f' && /o$/.test(e.it) && !e.it.includes(' ')), e => liveRow(e, withArticle(e), 'feminine in -o'), 3);
      pushN(nouns().filter(e => e.g === 'm' && /ma$/.test(e.it) && !e.it.includes(' ')), e => liveRow(e, withArticle(e), 'masculine in -ma'), 3);
    } else if (/feminine endings|-ione|-tà/.test(h)) pushN(nouns().filter(e => e.g === 'f' && /(tà|tù|ione|trice|ie)$/.test(e.it)), e => liveRow(e, withArticle(e), e.en.split(';')[0]));
  } else if (topicId === 'plurals') {
    if (/irregular/.test(h)) { kicker = 'Irregular plurals in the dictionary'; pushN(nouns().filter(e => /irregular/i.test(e.note || '') && hasPluralForm(e)), e => liveRow(e, `${withArticle(e)} → ${withArticle(e, true)}`, e.en.split(';')[0]), 8); }
    else if (/-co|-go|-ca|-ga/.test(h)) {
      const masc = /-co|-go/.test(h); // the -ca/-ga section shows only feminine nouns
      if (masc) pushN(nouns().filter(e => /[cg]o$/.test(e.it) && /(chi|ghi)$/.test(e.pl || '')), e => liveRow(e, `${withArticle(e)} → ${withArticle(e, true)}`, 'keeps the hard sound'), 3);
      if (masc) pushN(nouns().filter(e => /[cg]o$/.test(e.it) && /(ci|gi)$/.test(e.pl || '')), e => liveRow(e, `${withArticle(e)} → ${withArticle(e, true)}`, 'softens: no h'), 3);
      pushN(nouns().filter(e => /[cg]a$/.test(e.it) && /(che|ghe)$/.test(e.pl || '')), e => liveRow(e, `${withArticle(e)} → ${withArticle(e, true)}`, '-ca/-ga → -che/-ghe'), masc ? 2 : 6);
    } else if (/invariab/.test(h)) pushN(nouns().filter(e => e.pl === e.it && !isPluralOnly(e) && !e.it.includes(' ')), e => liveRow(e, `${withArticle(e)} → ${withArticle(e, true)}`, /[àèéìòù]$/.test(e.it) ? 'stressed final vowel' : /[^aeiou]$/.test(e.it) ? 'loanword' : 'invariable'), 6);
    else if (/-io/.test(h)) pushN(nouns().filter(e => /io$/.test(e.it) && /i$/.test(e.pl || '')), e => liveRow(e, `${withArticle(e)} → ${withArticle(e, true)}`, /ii$/.test(e.pl) ? 'stressed i: -ii' : 'one i'), 6);
  } else if (topicId === 'adjectives') {
    const adjs = data.vocab.filter(e => e.pos === 'adj');
    if (/four|-o\b|first|class/.test(h) && idx < 2) pushN(adjs.filter(e => e.forms && e.forms.length === 4 && e.forms[0] !== e.forms[1]), e => liveRow(e, e.forms.join(' · '), e.en.split(';')[0]), 5);
    else if (/two|-e\b/.test(h)) pushN(adjs.filter(e => e.forms && e.forms.length === 4 && e.forms[0] === e.forms[1]), e => liveRow(e, `${e.forms[0]} · ${e.forms[2]}`, e.en.split(';')[0]), 5);
    else if (/invariab|colou?r/.test(h)) pushN(adjs.filter(e => !e.forms && !/feminine only/i.test(e.note || '')), e => liveRow(e, e.it, 'invariable'), 5);
  } else if (topicId === 'isc') {
    if (idx === 0) { kicker = '-isc- verbs in the dictionary'; pushN(data.verbs.filter(e => e.isc === true), e => liveRow(e, `${e.inf} → ${primary(conjOf(e).tenses.presente[0])}`, e.en), 8); }
    else if (/without|not|no -isc|dorm|part|apr/.test(h)) { kicker = '-ire verbs without -isc-'; pushN(data.verbs.filter(e => e.isc === false && /ire$/.test(e.inf)), e => liveRow(e, `${e.inf} → ${primary(conjOf(e).tenses.presente[0])}`, e.en), 8); }
  } else if (topicId === 'auxiliaries') {
    if (/reflexive|pronominal/.test(h)) pushN(data.verbs.filter(e => e.aux === 'essere' && /si$/.test(e.inf)), e => liveRow(e, `${e.inf} → ${primary(conjOf(e).tenses.passatoProssimo[0])}`, e.en), 6);
    else if (/essere/.test(h) && !/avere|both|either/.test(h)) pushN(data.verbs.filter(e => e.aux === 'essere' && !/si$|sene$/.test(e.inf)), e => liveRow(e, `${e.inf} → ${primary(conjOf(e).tenses.passatoProssimo[0])}`, e.en), 6);
    else if (/avere/.test(h) && !/essere|both|either/.test(h)) pushN(data.verbs.filter(e => e.aux === 'avere' && (/intransitiv/.test(h) ? e.trans === 'vi' : /^transitiv/.test(h) ? /^vt/.test(e.trans || '') : true)), e => liveRow(e, `${e.inf} → ${primary(conjOf(e).tenses.passatoProssimo[0])}`, e.en), 6);
    else if (/both|either|change|meaning/.test(h)) { kicker = 'Verbs that take both'; pushN(data.verbs.filter(e => e.aux === 'both'), e => liveRow(e, e.inf, e.en), 8); }
  } else if (topicId === 'reflexives') {
    if (idx === 0) pushN(data.verbs.filter(e => /si$/.test(e.inf)), e => liveRow(e, `${e.inf} → ${presOf(e)}`, e.en), 6);
    else if (/pronominal|-sene|-sela|-cela|andarsene|farcela/.test(h)) { kicker = 'Pronominal verbs'; pushN(data.verbs.filter(e => /(sene|sela|cela|celo|sele|la|ci|ne)$/.test(e.inf) && !/si$/.test(e.inf) && splitClitic(e.inf).clitic), e => liveRow(e, `${e.inf} → ${presOf(e)}`, e.en), 6); }
  } else if (topicId === 'spelling') {
    if (/-care|-gare/.test(h)) pushN(data.verbs.filter(e => /[cg]are$/.test(e.inf)), e => { const c = conjOf(e); return liveRow(e, `${e.inf} → ${primary(c.tenses.presente[1])} · ${primary(c.tenses.futuro[0])}`, e.en); }, 6);
    else if (/-ciare|-giare|-sciare/.test(h)) pushN(data.verbs.filter(e => /(ciare|giare)$/.test(e.inf)), e => { const c = conjOf(e); return liveRow(e, `${e.inf} → ${primary(c.tenses.presente[1])} · ${primary(c.tenses.futuro[0])}`, e.en); }, 6);
    else if (/-iare/.test(h)) pushN(data.verbs.filter(e => /[^cg]iare$/.test(e.inf)), e => { const c = conjOf(e); return liveRow(e, `${e.inf} → ${primary(c.tenses.presente[1])}`, e.en); }, 6);
  } else if (topicId === 'tenses') {
    if (idx === 0) {
      kicker = 'One regular verb per group';
      for (const end of ['are', 'ere', 'ire']) { const e = data.verbs.filter(v => v.level === 'A1' && v.inf.endsWith(end) && !v.irregular && !conjOf(v).irregular && !splitClitic(v.inf).clitic)[0]; if (e) { const c = conjOf(e); rows.push(liveRow(e, `${e.inf} → ${primary(c.tenses.presente[0])} · ${primary(c.tenses.passatoProssimo[0])} · ${primary(c.tenses.futuro[0])}`, `${c.group} · ${e.en}`)); } }
    }
  } else if (topicId === 'imperative') {
    if (/irregular|short|apostrophe/.test(h)) { kicker = 'Irregular tu imperatives'; for (const inf of ['andare', 'fare', 'dire', 'dare', 'stare', 'essere', 'avere', 'sapere']) { const e = getEntry('v:' + inf); if (e && conjOf(e).tenses.imperativo) rows.push(liveRow(e, `${e.inf} → ${conjOf(e).tenses.imperativo[0].split('|').join(' / ')}`, `Lei: ${primary(conjOf(e).tenses.imperativo[1])}`)); } }
  } else if (topicId === 'pronouns') {
    if (/combined|attached|verb/.test(h) && idx > 1) { kicker = 'Verbs with a built-in pronoun'; pushN(data.verbs.filter(e => { const c = splitClitic(e.inf).clitic; return c && c !== 'si'; }), e => liveRow(e, `${e.inf} → ${presOf(e)}`, e.en), 6); }
  } else if (topicId === 'prepositions') {
    if (/verb|^di and a\b|pattern/.test(h)) {
      kicker = 'Verb patterns from the dictionary';
      const pats = [];
      for (const e of data.verbs.slice().sort(byLevel)) { for (const p of e.patterns || []) if (/\b(di|a) (fare|qualcuno|qualcosa)\b/.test(p) && pats.length < 8 && !pats.some(x => x.p === p)) pats.push({ e, p }); if (pats.length >= 8) break; }
      for (const { e, p } of pats) rows.push(liveRow(e, p, e.en));
    }
  }
  if (!rows.length) return '';
  return html`<div class="gram-live"><span class="kicker">${kicker}</span><div class="live-list">${raw(rows.join(''))}</div></div>`;
}

// ---------- rendering ----------
const cell = (c) => (c === '—' || c === '' ? raw(`<span class="faint">${c || '—'}</span>`) : c);
// Tables with up to three columns stay tables. Wider ones would need a horizontal scroller on a phone, so they are
// stacked: a paradigm table (empty first header: persons down the side, verbs/genders across) becomes one card per
// column with person → form rows; a record table (named first column) becomes one card per row with header → value rows.
function tableHTML(rows) {
  if (!rows || !rows.length) return '';
  const [head, ...body] = rows;
  if (head.length >= 4) {
    const paradigm = !String(head[0] || '').trim();
    if (paradigm) {
      const cards = head.slice(1).map((h, j) => html`<div class="gcard"><div class="gcard-title">${h}</div>${raw(body.map(r => html`<div class="gs-row ${String(r[0]).length > 12 ? 'stack' : ''}"><span class="gs-k">${r[0]}</span><span class="gs-v">${cell(r[j + 1] ?? '')}</span></div>`).join(''))}</div>`);
      return `<div class="gstack">${cards.join('')}</div>`;
    }
    const cards = body.map(r => html`<div class="gcard"><div class="gcard-title">${cell(r[0])}</div>${raw(head.slice(1).map((h, j) => html`<div class="gs-row"><span class="gs-k">${h}</span><span class="gs-v">${cell(r[j + 1] ?? '')}</span></div>`).join(''))}</div>`);
    return `<div class="gstack records">${cards.join('')}</div>`;
  }
  return html`<div class="gtable-wrap"><table class="gtable"><thead><tr>${raw(head.map(c => html`<th>${c}</th>`).join(''))}</tr></thead><tbody>${raw(body.map(r => html`<tr>${raw(r.map((c, i) => html`<td class="${i === 0 ? 'lab' : ''}">${cell(c)}</td>`).join(''))}</tr>`).join(''))}</tbody></table></div>`;
}
function examplesHTML(exs) {
  if (!exs || !exs.length) return '';
  return `<div class="gram-ex">${exs.map(x => html`<div class="example">${raw(trBlock(x.it, x.en))}${raw(speakBtn(x.it))}</div>`).join('')}</div>`;
}
const TENSES_FOR = { tenses: 'presente,passatoProssimo,imperfetto,futuro', 'passato-imperfetto': 'passatoProssimo,imperfetto', isc: 'presente', spelling: 'presente,futuro', imperative: 'imperativo', reflexives: 'presente,passatoProssimo', auxiliaries: 'passatoProssimo' };
export function practiceHref(topic) {
  const lvl = store.current?.settings?.level || 'A1';
  const g = topic.practiceGame || 'quiz';
  const t = ['conj-drill', 'conj-choice', 'verb-quiz'].includes(g) && TENSES_FOR[topic.id] ? `&tenses=${TENSES_FOR[topic.id]}` : '';
  return `#/game/${g}?src=level:${lvl}${t}`;
}
const GAME_NAME = { gender: 'Articles game', plurals: 'Plurals game', aux: 'Essere or avere?', 'conj-drill': 'Conjugation drill', 'conj-choice': 'Pick the form', 'tense-detective': 'Tense detective', participles: 'Participles & gerunds', patterns: 'Prepositions', quiz: 'Quick quiz', cloze: 'Fill in the blank' };

export function topicRow(t, i) {
  return html`<a class="gram-row glass-flat" href="#/grammar/${t.id}"><span class="gr-num">${pad2(i + 1)}</span><span class="gr-main"><span class="gr-title">${t.titleIt || t.title}</span><span class="gr-sub">${t.title}${t.summary ? raw(html` <span class="faint">· ${t.summary}</span>`) : ''}</span></span>${ic('chevronRight', { size: 20 })}</a>`;
}

function renderIndex(root, topics) {
  setTitle('Grammar');
  root.innerHTML = html`
    <div class="ref-hero">
      <span class="kicker">Grammatica · ${topics.length} temi</span>
      <h1 class="ref-title">Le regole,<br><em>spiegate.</em></h1>
      <p class="lead muted">Short, typeset explanations with real examples from the dictionary.</p>
    </div>
    <div class="gram-list">${raw(topics.map(topicRow).join(''))}</div>`;
  mount(root);
}

function renderTopic(root, topics, topic, i) {
  setTitle(topic.titleIt || topic.title);
  const secs = topic.sections || [];
  const prev = topics[i - 1], next = topics[i + 1];
  root.innerHTML = html`
    <div class="gram-head">
      <span class="kicker">Grammatica · ${pad2(i + 1)} / ${pad2(topics.length)}</span>
      <h1 class="gram-title">${topic.titleIt || topic.title}</h1>
      ${topic.titleIt ? raw(html`<div class="gram-en">${topic.title}</div>`) : ''}
      ${topic.summary ? raw(html`<p class="gram-summary">${topic.summary}</p>`) : ''}
    </div>
    ${secs.length > 1 ? raw(html`<div class="chips scroll gram-toc">${raw(secs.map((s, k) => html`<button type="button" class="chip sm" data-jump="gs-${k}"><span class="tiny">${pad2(k + 1)}</span>${s.heading}</button>`).join(''))}</div>`) : ''}
    ${secs.length ? '' : raw(html`<div class="card"><p class="muted">This topic's text is not available offline yet.</p></div>`)}
    ${raw(secs.map((s, k) => html`<section class="card gram-sec" id="gs-${k}">
      <div class="gram-sec-head"><span class="gram-num">${pad2(k + 1)}</span><h2>${s.heading}</h2></div>
      ${raw((s.body || '').split(/\n{2,}/).map(p => `<p class="gram-p">${richText(p)}</p>`).join(''))}
      ${raw(tableHTML(s.table))}
      ${raw(examplesHTML(s.examples))}
      ${s.tip ? raw(`<div class="note gram-tip"><span class="kicker">Nota</span>${richText(s.tip)}</div>`) : ''}
      ${raw(liveExamples(topic.id, s, k))}
    </section>`).join(''))}
    <div class="card accent gram-cta">
      <div class="sec-head in-pane"><div><span class="kicker">Esercitati</span><span class="title">Practice this</span></div></div>
      <p class="muted small">Play <b>${GAME_NAME[topic.practiceGame] || topic.practiceGame}</b> with your level's words and verbs.</p>
      <a class="btn primary block" href="${practiceHref(topic)}">${ic('play', { size: 20 })} Practice this</a>
    </div>
    <div class="gram-nav">
      ${prev ? raw(html`<a class="gram-nav-link glass-flat" href="#/grammar/${prev.id}">${ic('chevron', { size: 20 })}<span><span class="kicker">Prima</span><span class="gn-title">${prev.titleIt || prev.title}</span></span></a>`) : raw('<span></span>')}
      ${next ? raw(html`<a class="gram-nav-link glass-flat next" href="#/grammar/${next.id}"><span><span class="kicker">Dopo</span><span class="gn-title">${next.titleIt || next.title}</span></span>${ic('chevronRight', { size: 20 })}</a>`) : ''}
    </div>
    <p class="center"><a class="btn sm ghost" href="#/grammar">${ic('list', { size: 16 })} All grammar topics</a></p>`;
  mount(root);
  const onClick = (ev) => {
    const j = ev.target.closest('[data-jump]'); if (!j) return;
    const el = root.querySelector('#' + j.dataset.jump); if (el) el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}

export async function render(root, params) {
  setScene('reference');
  const topics = await loadGrammar();
  if (!params.topic) { renderIndex(root, topics); return; }
  const i = topics.findIndex(t => t.id === params.topic);
  if (i < 0) {
    setTitle('Grammar');
    root.innerHTML = html`<div class="empty"><p>Nessun tema con questo nome.</p><a class="btn primary" href="#/grammar">All grammar topics</a></div>`;
    return;
  }
  return renderTopic(root, topics, topics[i], i);
}
