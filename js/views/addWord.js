// Add a custom word or verb to the word bank.
import { html, raw, esc, toast } from '../ui.js';
import { setTitle } from '../app.js';
import { store } from '../store.js';
import { CATS, LEVELS, registerCustom, search } from '../data.js';
import { conjugate } from '../conjugator.js';

export async function render(root, params, query) {
  setTitle('Add a word');
  const it = query.it || '';
  root.innerHTML = html`
    <div class="card">
      <div class="field"><label>Italian word or verb</label><input class="input" data-f="it" value="${it}" placeholder="e.g. la sedia → sedia, or dormire" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label>English meaning</label><input class="input" data-f="en" placeholder="e.g. chair"></div>
      <div class="field"><label>Type</label><select class="input" data-f="pos"><option value="noun">noun</option><option value="verb">verb</option><option value="adj">adjective</option><option value="adv">adverb</option><option value="expr">expression</option><option value="prep">preposition</option><option value="conj">conjunction</option><option value="pron">pronoun</option><option value="interj">interjection</option></select></div>
      <div data-noun>
        <div class="field"><label>Gender</label><div class="seg" data-seg="g"><button data-v="m" class="on">masculine</button><button data-v="f">feminine</button><button data-v="mf">both</button></div></div>
        <div class="field"><label>Plural</label><input class="input" data-f="pl" placeholder="e.g. sedie (leave empty to guess)" autocapitalize="off" autocorrect="off"></div>
      </div>
      <div data-verb class="hidden">
        <div class="field"><label>Auxiliary</label><div class="seg" data-seg="aux"><button data-v="avere" class="on">avere</button><button data-v="essere">essere</button><button data-v="both">both</button></div></div>
        <div class="field" data-isc><label>-ire verb: uses -isc- (capisco)?</label><div class="seg" data-seg="isc"><button data-v="true" class="on">yes (-isco)</button><button data-v="false">no (dormo)</button></div></div>
        <div class="tiny muted" data-preview></div>
      </div>
      <div class="field"><label>Example sentence (optional)</label><input class="input" data-f="ex" placeholder="Italian example" autocapitalize="sentences"></div>
      <div class="field"><label>Example translation (optional)</label><input class="input" data-f="exEn" placeholder="English"></div>
      <div class="field"><label>Level</label><select class="input" data-f="level">${raw(LEVELS.map(L => `<option ${L === (store.settings.level || 'A1') ? 'selected' : ''}>${L}</option>`).join(''))}</select></div>
      <div class="field"><label>Topic</label><select class="input" data-f="cat">${raw(Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.icon} ${esc(c.name)}</option>`).join(''))}</select></div>
      <div class="field"><label>Note (optional)</label><input class="input" data-f="note" placeholder="usage, register, irregular forms…"></div>
      <div data-similar class="tiny muted mb"></div>
      <button class="btn primary block" data-save>Save to my word bank</button>
    </div>`;
  const f = (k) => root.querySelector(`[data-f="${k}"]`);
  const seg = { g: 'm', aux: 'avere', isc: 'true' };
  root.querySelectorAll('[data-seg]').forEach(s => s.addEventListener('click', (ev) => { const b = ev.target.closest('[data-v]'); if (!b) return; seg[s.dataset.seg] = b.dataset.v; s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }));
  const update = () => {
    const pos = f('pos').value;
    root.querySelector('[data-noun]').classList.toggle('hidden', pos !== 'noun');
    root.querySelector('[data-verb]').classList.toggle('hidden', pos !== 'verb');
    const w = f('it').value.trim().toLowerCase();
    if (pos === 'verb') { root.querySelector('[data-isc]').classList.toggle('hidden', !/ire$|irsi$/.test(w)); try { const c = conjugate(w, { aux: seg.aux, isc: seg.isc === 'true' }); root.querySelector('[data-preview]').textContent = w ? `Preview: ${c.tenses.presente.slice(0, 3).join(', ')} … · participio ${c.nonFinite.participioPassato}` : ''; } catch { /* ignore */ } }
    const sim = w ? search(w, { limit: 3 }) : [];
    root.querySelector('[data-similar]').innerHTML = sim.length ? 'Already in the dictionary: ' + sim.map(e => html`<a href="#/entry/${encodeURIComponent(e.id)}">${e.it || e.inf}</a>`).join(', ') : '';
  };
  f('pos').addEventListener('change', update); f('it').addEventListener('input', update); root.querySelector('[data-seg="aux"]').addEventListener('click', update); root.querySelector('[data-seg="isc"]').addEventListener('click', update);
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
