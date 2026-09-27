// Add a custom word or verb: glass form with segmented controls and a live preview of the entry it will create.
import { html, raw, esc, toast, tr, enPill, speakBtn, levelBadge, icon } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { CATS, LEVELS, LEVEL_INFO, registerCustom, search, article } from '../data.js';
import { conjugate, primary } from '../conjugator.js';
import { hwSize, IT_POS } from '../components.js';
import { mount, setScene } from '../fx.js';

const ic = (name, opts) => raw(icon(name, opts));
const IT_GENDER = { m: 'maschile', f: 'femminile', mf: 'm · f' };
const POS_OPTS = [['noun', 'noun'], ['verb', 'verb'], ['adj', 'adjective'], ['adv', 'adverb'], ['expr', 'expression'], ['prep', 'preposition'], ['conj', 'conjunction'], ['pron', 'pronoun'], ['interj', 'interjection']];

export async function render(root, params, query) {
  setTitle('Add a word');
  const it = query.it || '';
  const myLevel = store.settings.level || 'A1';
  root.innerHTML = html`<div class="pg pg-add">
    <div class="pg-head"><span class="kicker">Custom entry · saved to your word bank</span><div class="title it">${raw(tr('Una parola nuova', 'A new word'))}</div></div>
    <div class="preview glass glass-tint"><span class="kicker">Preview · anteprima</span><div data-pv-card></div><div class="pv-forms" data-preview></div></div>
    <div class="form glass-flat">
      <div class="field"><label for="f-it">Italian word or verb</label><input class="input it" id="f-it" data-f="it" value="${it}" placeholder="sedia, dormire…" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"></div>
      <div class="field"><label for="f-en">English meaning</label><input class="input" id="f-en" data-f="en" placeholder="e.g. chair" autocomplete="off"></div>
      <div class="field"><label for="f-pos">Type</label><select class="input" id="f-pos" data-f="pos">${raw(POS_OPTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''))}</select></div>
      <div class="fset" data-noun><span class="kicker fset-kicker">Noun</span>
        <div class="field"><label>Gender</label><div class="seg" data-seg="g" role="group" aria-label="Gender"><button type="button" data-v="m" class="on">masculine</button><button type="button" data-v="f">feminine</button><button type="button" data-v="mf">both</button></div></div>
        <div class="field"><label for="f-pl">Plural</label><input class="input" id="f-pl" data-f="pl" placeholder="sedie (leave empty to guess)" autocapitalize="off" autocorrect="off" autocomplete="off"></div>
      </div>
      <div class="fset hidden" data-verb><span class="kicker fset-kicker">Verb</span>
        <div class="field"><label>Auxiliary</label><div class="seg" data-seg="aux" role="group" aria-label="Auxiliary"><button type="button" data-v="avere" class="on">avere</button><button type="button" data-v="essere">essere</button><button type="button" data-v="both">both</button></div></div>
        <div class="field" data-isc><label>-ire verb: uses -isc- (capisco)?</label><div class="seg" data-seg="isc" role="group" aria-label="isc"><button type="button" data-v="true" class="on">yes · -isco</button><button type="button" data-v="false">no · dormo</button></div></div>
      </div>
      <div class="field"><label for="f-ex">Example sentence <span class="faint">(optional)</span></label><input class="input" id="f-ex" data-f="ex" placeholder="La sedia è rotta." autocapitalize="sentences" autocomplete="off"></div>
      <div class="field"><label for="f-exen">Example translation <span class="faint">(optional)</span></label><input class="input" id="f-exen" data-f="exEn" placeholder="The chair is broken." autocomplete="off"></div>
      <div class="grid2">
        <div class="field"><label for="f-level">Level</label><select class="input" id="f-level" data-f="level">${raw(LEVELS.map(L => `<option value="${L}" ${L === myLevel ? 'selected' : ''}>${L} · ${LEVEL_INFO[L].name}</option>`).join(''))}</select></div>
        <div class="field"><label for="f-cat">Topic</label><select class="input" id="f-cat" data-f="cat">${raw(Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.icon} ${esc(c.name)}</option>`).join(''))}</select></div>
      </div>
      <div class="field"><label for="f-note">Note <span class="faint">(optional)</span></label><input class="input" id="f-note" data-f="note" placeholder="usage, register, irregular forms…" autocomplete="off"></div>
    </div>
    <div class="similar" data-similar></div>
    <button type="button" class="btn primary block" data-save>${ic('star', { size: 18 })}Save to my word bank</button>
  </div>`;
  const f = (k) => root.querySelector(`[data-f="${k}"]`);
  const seg = { g: 'm', aux: 'avere', isc: 'true' };
  const pvCard = root.querySelector('[data-pv-card]');
  const preview = () => {
    const pos = f('pos').value; const w = f('it').value.trim().toLowerCase(); const en = f('en').value.trim(); const level = f('level').value; const cat = f('cat').value;
    const word = w || '…';
    const art = pos === 'noun' && w ? article({ pos: 'noun', it: w, g: seg.g }, false) : '';
    const say = art ? (art.endsWith("'") ? art + word : art + ' ' + word) : word;
    pvCard.innerHTML = html`<div class="headword"><div class="hw-line">${art ? raw(`<span class="article">${esc(art)}</span>`) : ''}<span class="word" style="--hw:${Math.min(48, hwSize(word))}px">${word}</span></div>
      <div class="hw-row">${raw(enPill(en || 'meaning…'))}${w ? raw(speakBtn(say, 'lg')) : ''}</div>
      <div class="tags">${raw(levelBadge(level))}<span>${IT_POS[pos] || pos}</span>${pos === 'noun' ? raw(html`<span>${IT_GENDER[seg.g]}</span>`) : ''}${pos === 'verb' ? raw(html`<span>aux. ${seg.aux === 'both' ? 'avere / essere' : seg.aux}</span>`) : ''}<span>${CATS[cat]?.name || cat}</span></div></div>`;
  };
  const update = () => {
    const pos = f('pos').value;
    root.querySelector('[data-noun]').classList.toggle('hidden', pos !== 'noun');
    root.querySelector('[data-verb]').classList.toggle('hidden', pos !== 'verb');
    const w = f('it').value.trim().toLowerCase();
    const pv = root.querySelector('[data-preview]');
    pv.innerHTML = '';
    if (pos === 'verb') {
      root.querySelector('[data-isc]').classList.toggle('hidden', !/ire$|irsi$/.test(w));
      if (w) { try { const c = conjugate(w, { aux: seg.aux, isc: seg.isc === 'true' }); pv.innerHTML = html`Presente ${raw(c.tenses.presente.slice(0, 3).map(x => html`<b>${primary(x)}</b>`).join(', '))} … · participio <b>${primary(c.nonFinite.participioPassato)}</b> · gerundio <b>${primary(c.nonFinite.gerundio)}</b>`; } catch { /* not conjugable yet */ } }
    }
    const sim = w ? search(w, { limit: 4 }) : [];
    root.querySelector('[data-similar]').innerHTML = sim.length ? html`<span class="kicker">Already in the dictionary</span>${raw(sim.map(e => html`<a class="chip" href="#/entry/${encodeURIComponent(e.id)}">${e.it || e.inf}</a>`).join(''))}` : '';
    preview();
  };
  root.querySelectorAll('[data-seg]').forEach(s => s.addEventListener('click', (ev) => { const b = ev.target.closest('[data-v]'); if (!b) return; seg[s.dataset.seg] = b.dataset.v; s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); update(); }));
  f('pos').addEventListener('change', update); f('it').addEventListener('input', update); f('en').addEventListener('input', preview); f('cat').addEventListener('change', preview);
  f('level').addEventListener('change', () => { setScene(f('level').value); preview(); });
  if (/^(il|lo|la|l'|i|gli|le|un|una|uno)\s/i.test(it)) { const m = it.match(/^(il|lo|la|l'|i|gli|le|un|una|uno)\s*(.*)$/i); f('it').value = m[2]; seg.g = /^(la|una|le|l')$/i.test(m[1]) ? 'f' : 'm'; root.querySelectorAll('[data-seg="g"] button').forEach(b => b.classList.toggle('on', b.dataset.v === seg.g)); }
  if (/(are|ere|ire|arsi|ersi|irsi)$/.test(it.trim()) && !it.includes(' ')) f('pos').value = 'verb';
  update();
  root.querySelector('[data-save]').addEventListener('click', () => {
    const w = f('it').value.trim(); const en = f('en').value.trim(); const pos = f('pos').value;
    if (!w || !en) { toast('Please enter the Italian word and its meaning', { kind: 'ko' }); return; }
    const entry = { it: w.toLowerCase(), en, pos, level: f('level').value, cat: f('cat').value, ex: f('ex').value.trim(), exEn: f('exEn').value.trim(), note: f('note').value.trim() };
    if (pos === 'noun') { entry.g = seg.g; entry.pl = f('pl').value.trim() || guessPlural(entry.it, seg.g); }
    if (pos === 'verb') { entry.inf = entry.it; entry.aux = seg.aux; entry.trans = /si$/.test(entry.it) ? 'vr' : 'vt'; entry.isc = seg.isc === 'true'; entry.patterns = [entry.it + ' qualcosa']; entry.usage = entry.note || 'Custom verb.'; entry.examples = entry.ex ? [{ it: entry.ex, en: entry.exEn }] : []; if (entry.trans === 'vr') entry.aux = 'essere'; }
    const id = store.addCustomWord(entry);
    registerCustom(store.current.custom);
    toast('Added to your word bank', { kind: 'ok' });
    location.hash = '#/entry/' + encodeURIComponent(id);
  });
  mount(root.firstElementChild);
}

function guessPlural(w, g) {
  if (/[àèéìòù]$/.test(w) || /[^aeiou]$/.test(w)) return w;
  if (/ca$/.test(w)) return w.replace(/ca$/, 'che');
  if (/ga$/.test(w)) return w.replace(/ga$/, 'ghe');
  if (/cia$/.test(w) || /gia$/.test(w)) return w.replace(/ia$/, 'e');
  if (/a$/.test(w)) return g === 'm' ? w.replace(/a$/, 'i') : w.replace(/a$/, 'e');
  if (/io$/.test(w)) return w.replace(/io$/, 'i');
  if (/co$/.test(w)) return w.replace(/co$/, 'chi');
  if (/go$/.test(w)) return w.replace(/go$/, 'ghi');
  if (/o$/.test(w)) return w.replace(/o$/, 'i');
  if (/e$/.test(w)) return w.replace(/e$/, 'i');
  return w;
}
