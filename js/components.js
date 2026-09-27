// Shared UI components: entry rows, word cards, verb cards, conjugation tables, list picker.
import { html, raw, esc, tr, trBlock, speakBtn, sheet, toast, promptDialog, levelBadge } from './ui.js';
import { store } from './store.js';
import { CATS, POS_NAME, GENDER_NAME, article, withArticle, isPluralOnly, isUncountable, headword, shortEn, getEntry } from './data.js';
import { conjugate, PERSONS, IMP_PERSONS, TENSES, primary, accepted } from './conjugator.js';
import { stage, STAGE_LABEL } from './srs.js';

export function stageOf(id) { return stage(store.getItem(id)); }

export function entryRow(e, { showLevel = true, extra = '', href = null } = {}) {
  const st = stageOf(e.id);
  const learned = store.isLearned(e.id);
  const hw = e.kind === 'verb' ? e.inf : headword(e);
  const sub = e.kind === 'verb' ? `${shortEn(e.en)}${e.trans ? ' · ' + e.trans : ''}` : `${shortEn(e.en)}${e.pos === 'noun' ? ' · ' + (e.g === 'mf' ? 'm/f' : e.g) : ''}${e.pos !== 'noun' ? ' · ' + (POS_NAME[e.pos] || e.pos) : ''}`;
  return html`<a class="item" href="${href || '#/entry/' + encodeURIComponent(e.id)}" data-id="${e.id}">
    <span class="stage ${st}" title="${STAGE_LABEL[st]}"></span>
    <div class="main"><div class="hw">${hw}${e.kind === 'verb' ? raw(' <span class="tiny muted">verb</span>') : ''}</div><div class="sub">${sub}</div></div>
    ${showLevel ? raw(levelBadge(e.level || 'A1')) : ''}${learned ? raw('<span class="badge ok">✓</span>') : ''}${raw(extra)}
  </a>`;
}

export function entryList(entries, opts = {}) {
  if (!entries.length) return html`<div class="empty"><div class="big">🫙</div>Nothing here yet.</div>`;
  return `<div class="list">${entries.map(e => entryRow(e, opts)).join('')}</div>`;
}

function genderTag(e) {
  if (e.pos !== 'noun') return '';
  const g = e.g === 'mf' ? 'm/f' : e.g;
  return html`<span class="badge g-${e.g}">${g === 'm' ? '♂ masculine' : g === 'f' ? '♀ feminine' : '♂/♀ masc. or fem.'}</span>`;
}

export function wordHero(e) {
  const isNoun = e.pos === 'noun';
  const art = isNoun ? article(e, isPluralOnly(e)) : '';
  const word = isPluralOnly(e) ? e.pl : e.it;
  const cat = CATS[e.cat];
  return html`<div class="hero">
    <div class="word ${word.length > 16 ? 'long' : ''}">${art ? raw(`<span class="article">${esc(art)}</span> `) : ''}${word} ${raw(speakBtn(isNoun ? withArticle(e, isPluralOnly(e)) : e.it, 'lg'))}</div>
    <div class="en"><span class="itx inline" role="button" tabindex="0"><span class="it">tap for English</span><span class="tr">${e.en}</span></span></div>
    <div class="tags">${raw(levelBadge(e.level || 'A1'))}<span class="badge">${POS_NAME[e.pos] || e.pos}</span>${raw(genderTag(e))}${cat ? raw(html`<span class="badge">${cat.icon} ${cat.name}</span>`) : ''}${e.custom ? raw('<span class="badge">custom</span>') : ''}</div>
  </div>`;
}

export function wordForms(e) {
  if (e.pos === 'noun') {
    const sg = isPluralOnly(e) ? null : withArticle(e, false);
    const pl = isUncountable(e) ? null : withArticle(e, true);
    const cells = [];
    if (sg) cells.push(['Singular', sg]);
    if (pl) cells.push(['Plural', pl]);
    if (e.fem) cells.push(['Feminine', e.fem]);
    if (e.femPl) cells.push(['Feminine plural', e.femPl]);
    if (isUncountable(e)) cells.push(['Plural', 'uncountable (no plural)']);
    if (isPluralOnly(e)) cells.push(['Note', 'plural-only noun']);
    return html`<div class="forms-grid">${raw(cells.map(([l, v]) => html`<div class="f"><div class="lab">${l}</div><div class="val">${v} ${v.includes('(') ? '' : raw(speakBtn(v))}</div></div>`).join(''))}</div>`;
  }
  if (e.pos === 'adj' && e.forms && e.forms.length === 4) {
    const labs = ['Masc. sing.', 'Fem. sing.', 'Masc. plural', 'Fem. plural'];
    return html`<div class="forms-grid">${raw(e.forms.map((f, i) => html`<div class="f"><div class="lab">${labs[i]}</div><div class="val">${f}</div></div>`).join(''))}</div>`;
  }
  if (e.pos === 'adj') return html`<div class="note">Invariable adjective: the same form is used for all genders and numbers.</div>`;
  return '';
}

export function wordCard(e) {
  return html`${raw(wordHero(e))}
    ${raw(wordForms(e) ? `<div class="card">${wordForms(e)}</div>` : '')}
    ${e.ex ? raw(html`<div class="card"><h4>Example</h4><div class="example">${raw(trBlock(e.ex, e.exEn))} ${raw(speakBtn(e.ex))}</div></div>`) : ''}
    ${e.note ? raw(html`<div class="card"><h4>Note</h4><div class="note">${e.note}</div></div>`) : ''}`;
}

// ---------- verbs ----------
const AUX_LABEL = { avere: 'avere', essere: 'essere', both: 'avere / essere' };
const TRANS_LABEL = { vt: 'transitive', vi: 'intransitive', vr: 'reflexive / pronominal', 'vt/vi': 'transitive & intransitive' };

export function verbHero(e, conj) {
  const cat = CATS[e.cat];
  return html`<div class="hero">
    <div class="word ${e.inf.length > 14 ? 'long' : ''}">${e.inf} ${raw(speakBtn(e.inf, 'lg'))}</div>
    <div class="en"><span class="itx inline" role="button" tabindex="0"><span class="it">tap for English</span><span class="tr">${e.en}</span></span></div>
    <div class="tags">${raw(levelBadge(e.level || 'A1'))}<span class="badge">${conj.group} · ${conj.irregular ? 'irregular' : 'regular'}</span><span class="badge">aux. ${AUX_LABEL[e.aux] || e.aux}</span>${cat ? raw(html`<span class="badge">${cat.icon} ${cat.name}</span>`) : ''}</div>
  </div>`;
}

export function verbUsage(e, conj) {
  const patterns = (e.patterns || []).map(p => html`<span class="pattern">${p}</span>`).join('');
  return html`<div class="card">
    <h4>Cases & patterns <span class="tiny muted">(reggenza)</span></h4>
    <div class="mb-s">${raw(patterns)}</div>
    <dl class="kv mt">
      <dt>Type</dt><dd>${TRANS_LABEL[e.trans] || e.trans}</dd>
      <dt>Auxiliary</dt><dd>${AUX_LABEL[e.aux] || e.aux}${e.aux === 'both' ? raw(' <span class="tiny muted">(essere when intransitive, avere with an object)</span>') : ''}</dd>
      <dt>Participle</dt><dd class="bold">${primary(conj.nonFinite.participioPassato)}${accepted(conj.nonFinite.participioPassato).length > 1 ? raw(` <span class="muted">/ ${esc(accepted(conj.nonFinite.participioPassato).slice(1).join(' / '))}</span>`) : ''}</dd>
      <dt>Gerund</dt><dd class="bold">${primary(conj.nonFinite.gerundio)}</dd>
    </dl>
  </div>
  <div class="card"><h4>How to use it</h4><p>${e.usage}</p>
    ${e.related && e.related.length ? raw(html`<div class="tiny muted">Related: ${e.related.join(' · ')}</div>`) : ''}
  </div>
  <div class="card"><h4>Examples</h4>${raw((e.examples || []).map(x => html`<div class="example">${raw(trBlock(x.it, x.en))} ${raw(speakBtn(x.it))}</div>`).join(''))}</div>`;
}

const TENSE_HELP = {
  presente: 'What happens now or habitually. Also used for the near future in speech.',
  passatoProssimo: 'Completed actions in the past with present relevance; the everyday past tense in speech. Auxiliary + past participle.',
  imperfetto: 'Ongoing, habitual or background actions in the past; descriptions, age, weather, time.',
  trapassatoProssimo: 'An action completed before another past action ("had done").',
  passatoRemoto: 'Completed past actions with no link to the present; literary and narrative (and spoken in the South).',
  trapassatoRemoto: 'Rare, literary: an action just before a passato remoto action (after dopo che, appena).',
  futuro: 'Future actions, predictions, and suppositions about the present ("sarà a casa" = he is probably home).',
  futuroAnteriore: 'An action completed before a future moment; also supposition about the past.',
  condizionale: 'Would: polite requests, wishes, hypotheses, reported information.',
  condizionalePassato: 'Would have; also the "future in the past" in reported speech.',
  congiuntivoPresente: 'After verbs of opinion, doubt, emotion, wish (penso che, spero che, benché) about the present.',
  congiuntivoPassato: 'Same triggers, for a completed action ("penso che sia partito").',
  congiuntivoImperfetto: 'Subjunctive after past-tense triggers and in "se" hypotheticals ("se avessi tempo…").',
  congiuntivoTrapassato: 'Past-perfect subjunctive for unreal past hypotheses ("se avessi saputo…").',
  imperativo: 'Commands and instructions. The Lei form uses the subjunctive.',
};

export function conjTable(conj, key) {
  const t = conj.tenses[key];
  if (!t) return html`<div class="muted">No ${key} forms.</div>`;
  const persons = key === 'imperativo' ? IMP_PERSONS : PERSONS;
  const rows = t.map((f, i) => {
    const alt = accepted(f); const main = alt[0]; const rest = alt.slice(1);
    return html`<tr><td>${persons[i]}</td><td class="form">${main}${rest.length ? raw(`<div class="alt">also: ${esc(rest.join(', '))}</div>`) : ''} ${raw(speakBtn(persons[i] === 'lui/lei' ? main : (key === 'imperativo' ? main : main)))}</td></tr>`;
  }).join('');
  return `<table class="conj">${rows}</table>`;
}

export function conjSection(e, conj, { defaultTense = 'presente' } = {}) {
  const groups = [
    { name: 'Indicativo', keys: ['presente', 'passatoProssimo', 'imperfetto', 'trapassatoProssimo', 'futuro', 'futuroAnteriore', 'passatoRemoto', 'trapassatoRemoto'] },
    { name: 'Condizionale', keys: ['condizionale', 'condizionalePassato'] },
    { name: 'Congiuntivo', keys: ['congiuntivoPresente', 'congiuntivoPassato', 'congiuntivoImperfetto', 'congiuntivoTrapassato'] },
    { name: 'Imperativo', keys: ['imperativo'] },
  ];
  const byKey = Object.fromEntries(TENSES.map(t => [t.key, t]));
  const tabs = groups.flatMap(g => g.keys).map(k => html`<button class="tab ${k === defaultTense ? 'on' : ''}" data-tense="${k}">${byKey[k].name}</button>`).join('');
  return html`<div class="card conj-card">
    <h4>Forms <span class="tiny muted">(moods & tenses)</span></h4>
    <div class="tabs">${raw(tabs)}</div>
    <div class="tense-note" data-tense-note>${TENSE_HELP[defaultTense]}</div>
    <div data-conj-table>${raw(conjTable(conj, defaultTense))}</div>
    <div class="mt small muted">Non-finite: <b>${conj.nonFinite.infinito}</b> · <b>${primary(conj.nonFinite.participioPassato)}</b> (participio passato) · <b>${primary(conj.nonFinite.gerundio)}</b> (gerundio) · <b>${conj.nonFinite.infinitoPassato}</b> (infinito passato)</div>
  </div>`;
}
export function bindConjSection(root, conj) {
  const card = root.querySelector('.conj-card'); if (!card) return;
  card.addEventListener('click', (ev) => {
    const b = ev.target.closest('.tab[data-tense]'); if (!b) return;
    card.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    card.querySelector('[data-conj-table]').innerHTML = conjTable(conj, b.dataset.tense);
    card.querySelector('[data-tense-note]').textContent = TENSE_HELP[b.dataset.tense] || '';
  });
}

export function verbCard(e) {
  const conj = conjugate(e.inf, { aux: e.aux, isc: e.isc });
  return { html: verbHero(e, conj) + verbUsage(e, conj) + conjSection(e, conj), conj };
}

// ---------- list picker ----------
export function openListPicker(itemId) {
  const render = () => {
    const lists = Object.values(store.lists);
    return html`<div class="list">${raw(lists.map(l => html`<label class="item" style="cursor:pointer"><input type="checkbox" data-list="${l.id}" ${l.items.includes(itemId) ? 'checked' : ''}> <div class="main"><div class="hw">${l.name}</div><div class="sub">${l.items.length} items</div></div></label>`).join(''))}</div>
      <button class="btn ghost block mt" data-new-list>＋ New list</button>`;
  };
  const s = sheet(render(), { title: 'Save to list' });
  s.body.addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[data-list]'); if (!cb) return;
    if (cb.checked) { store.addToList(cb.dataset.list, itemId); toast('Added to ' + store.lists[cb.dataset.list].name, { kind: 'ok' }); }
    else store.removeFromList(cb.dataset.list, itemId);
  });
  s.body.addEventListener('click', async (ev) => {
    if (!ev.target.closest('[data-new-list]')) return;
    const name = await promptDialog('Name of the new list', { placeholder: 'e.g. Kitchen words' });
    if (name) { const id = store.createList(name); store.addToList(id, itemId); s.body.innerHTML = render(); }
  });
}

export function actionBar(e) {
  const learned = store.isLearned(e.id);
  const inBank = store.inList('bank', e.id);
  return html`<div class="row gap wrap mt">
    <button class="btn sm ${inBank ? 'on' : ''}" data-act="bank">${inBank ? '★ In word bank' : '☆ Word bank'}</button>
    <button class="btn sm" data-act="lists">＋ List</button>
    <button class="btn sm ${learned ? 'on' : ''}" data-act="learned">${learned ? '✓ Learned' : 'Mark learned'}</button>
    ${e.custom ? raw('<button class="btn sm danger" data-act="delete-custom">Delete</button>') : ''}
  </div>`;
}
export function bindActionBar(root, e, rerender) {
  root.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'bank') { if (store.inList('bank', e.id)) { store.removeFromList('bank', e.id); toast('Removed from word bank'); } else { store.addToList('bank', e.id); toast('Saved to word bank', { kind: 'ok' }); } rerender && rerender(); }
    else if (act === 'lists') openListPicker(e.id);
    else if (act === 'learned') { if (store.isLearned(e.id)) { store.unlearn(e.id); toast('Unmarked'); } else { store.markLearned(e.id, e.kind); toast('Marked as learned ✓', { kind: 'ok' }); } rerender && rerender(); }
    else if (act === 'delete-custom') { const { confirmDialog } = await import('./ui.js'); if (await confirmDialog('Delete this custom word?', { ok: 'Delete', danger: true })) { store.removeCustomWord(e.id); const { registerCustom } = await import('./data.js'); registerCustom(store.current.custom); location.hash = '#/lists'; } }
  });
}
