// UI helpers: HTML escaping, DOM building, toasts, bottom sheets, modals, text-to-speech, haptics.
import { store } from './store.js';
import { icon } from './icons.js';

export { icon };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// CSS owns the normal screen height. Some standalone iOS versions report a
// visual viewport smaller than the screen even with no keyboard, so use it only
// for a substantial, unzoomed reduction while a keyboard-editable field is focused.
export function keyboardViewportHeight() {
  const active = document.activeElement, viewport = window.visualViewport;
  const editable = active && !active.disabled && !active.readOnly && active.inputMode !== 'none' &&
    (active.isContentEditable || active.matches('textarea,input:is([type="text"],[type="search"],[type="url"],[type="tel"],[type="email"],[type="password"],[type="number"],:not([type]))'));
  if (!editable || !viewport) return null;
  const height = Number(viewport.height), offset = Number(viewport.offsetTop), scale = Number(viewport.scale), layout = window.innerHeight;
  if (![height,offset,scale,layout].every(Number.isFinite) || height <= 0 || layout <= 0 || Math.abs(scale - 1) > .01) return null;
  const bottom = Math.min(layout, height + Math.max(0,offset));
  return layout - bottom > 100 ? Math.max(1,Math.round(bottom)) : null;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// tagged template: values escaped unless wrapped with raw()
export function html(strings, ...vals) {
  return strings.reduce((out, s, i) => {
    const v = vals[i - 1];
    let str;
    if (v == null || v === false) str = '';
    else if (v instanceof Raw) str = v.s;
    else if (Array.isArray(v)) str = v.map(x => (x instanceof Raw ? x.s : x == null || x === false ? '' : esc(x))).join('');
    else str = esc(v);
    return out + str + s;
  });
}
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s ?? ''));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// Italian text with a tap-to-reveal English translation
export function tr(itText, enText, cls = '') {
  return html`<span class="itx ${cls}" role="button" tabindex="0"><span class="it">${itText}</span><span class="tr">${enText}</span></span>`;
}
export function trBlock(itText, enText, cls = '') {
  return html`<div class="itx block ${cls}" role="button" tabindex="0"><div class="it">${itText}</div><div class="tr">${enText}</div></div>`;
}
// The headword "EN" pill: a glass pill that slides open to reveal the translation (same .itx mechanism).
export function enPill(enText, cls = '') {
  return html`<span class="itx headword-en ${cls}" role="button" tabindex="0" aria-label="Show English"><span class="it">EN</span><span class="tr">${enText}</span></span>`;
}
// global delegated handler for .itx
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('.itx');
  if (!t) return;
  if (ev.target.closest('a,button,.speak,input')) return;
  t.classList.toggle('open');
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const t = ev.target.closest && ev.target.closest('.itx');
  if (!t || ev.target !== t) return;
  ev.preventDefault(); t.classList.toggle('open');
});

// ---------- toast ----------
let toastTimer = null;
export function toast(msg, { ms = 1800, kind = '' } = {}) {
  let t = $('#toast');
  if (!t) { t = el('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, ms);
}

// ---------- bottom sheet ----------
// Open sheets are tracked so the router can dismiss them when the screen underneath changes (back button, tab, link).
const openSheets = new Set();
export function closeSheets() { for (const close of [...openSheets]) close(); }
export function sheet(contentHTML, { title = '', onOpen = null, onClose = null, cls = '' } = {}) {
  const wrap = el('div', { class: 'sheet-wrap' });
  wrap.innerHTML = html`<div class="sheet-backdrop"></div>
    <div class="sheet ${cls}" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      ${title ? raw(html`<div class="sheet-title">${title}</div>`) : ''}
      <div class="sheet-body">${raw(contentHTML)}</div>
    </div>`;
  document.body.append(wrap);
  document.body.classList.add('no-scroll');
  let closed = false;
  const pane = wrap.querySelector('.sheet');
  // Keyboard and screen-reader users land inside the sheet: the pane takes focus (Tab then walks its own controls) and
  // the app behind it is inert while any sheet is open; focus goes back to the opener on close.
  const opener = document.activeElement;
  const chrome = ['view', 'topbar', 'tabs'].map(id => document.getElementById(id)).filter(Boolean);
  pane.setAttribute('tabindex', '-1');
  chrome.forEach(el => el.setAttribute('inert', ''));
  requestAnimationFrame(() => { wrap.classList.add('open'); if (!closed && !pane.contains(document.activeElement)) pane.focus({ preventScroll: true }); });
  // an open dropdown menu over the sheet takes the Escape itself (fx.js): one key press must not dismiss both layers
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.dropdown-layer')) close(); };
  const close = (opts) => {
    if (closed) return; closed = true;
    openSheets.delete(close);
    const silent = !!(opts && opts.silent === true);
    wrap.classList.remove('open');
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey);
    if (!openSheets.size) chrome.forEach(el => el.removeAttribute('inert'));
    if (wrap.contains(document.activeElement) && opener && opener.isConnected && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch { /* ignore */ } }
    setTimeout(() => wrap.remove(), 320);
    if (!silent && onClose) onClose();
  };
  openSheets.add(close);
  document.addEventListener('keydown', onKey);
  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  // drag the handle down to dismiss
  let dragY = null;
  const handle = wrap.querySelector('.sheet-handle');
  handle.addEventListener('pointerdown', (e) => { dragY = e.clientY; pane.style.transition = 'none'; try { handle.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
  handle.addEventListener('pointermove', (e) => { if (dragY == null) return; const dy = Math.max(0, e.clientY - dragY); pane.style.transform = `translateY(${dy}px)`; });
  const endDrag = (e) => { if (dragY == null) return; const dy = Math.max(0, e.clientY - dragY); dragY = null; pane.style.transition = ''; pane.style.transform = ''; if (dy > 80) close(); };
  handle.addEventListener('pointerup', endDrag); handle.addEventListener('pointercancel', endDrag);
  onOpen && onOpen(wrap.querySelector('.sheet-body'), close);
  return { close, body: wrap.querySelector('.sheet-body'), root: wrap };
}

export function confirmDialog(message, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const s = sheet(html`<p class="dialog-msg">${message}</p>
      <div class="row gap">
        <button class="btn ghost grow" data-act="cancel">${cancel}</button>
        <button class="btn ${danger ? 'danger' : 'primary'} grow" data-act="ok">${ok}</button>
      </div>`, { onClose: () => resolve(false) });
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const val = b.dataset.act === 'ok';
      s.close({ silent: true });
      resolve(val);
    });
  });
}

export function promptDialog(message, { value = '', placeholder = '', ok = 'Save' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const s = sheet(html`<p class="dialog-msg">${message}</p>
      <input class="input" type="text" value="${value}" placeholder="${placeholder}" autocomplete="off" autocapitalize="sentences">
      <div class="row gap mt">
        <button class="btn ghost grow" data-act="cancel">Cancel</button>
        <button class="btn primary grow" data-act="ok">${ok}</button>
      </div>`, { onClose: () => { if (!done) resolve(null); } });
    const input = s.body.querySelector('input');
    setTimeout(() => input.focus(), 320);
    const finish = (v) => { done = true; s.close(); resolve(v); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(input.value.trim()); });
    s.body.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b) return; finish(b.dataset.act === 'ok' ? input.value.trim() : null); });
  });
}

// ---------- speech ----------
let voices = [];
function loadVoices() { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch { voices = []; } }
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
export function italianVoice() {
  if (!voices.length) loadVoices();
  const it = voices.filter(v => /^it([-_]|$)/i.test(v.lang));
  const pref = store.current?.settings?.voice;
  if (pref) { const v = it.find(x => x.name === pref); if (v) return v; }
  return it.find(v => /alice|federica|luca|paola/i.test(v.name)) || it.find(v => v.localService) || it[0] || null;
}
let activeSpeakBtn = null, speakTimer = null;
function clearSpeaking() { if (activeSpeakBtn) activeSpeakBtn.classList.remove('speaking'); activeSpeakBtn = null; clearTimeout(speakTimer); }
// Stops whatever is being read aloud; the router calls it on every navigation so a walkthrough or dictation never keeps talking over the next screen.
export function stopSpeech() { clearSpeaking(); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch { /* ignore */ } }
// speak(text, { rate, force, button }) — `button` (a .speak element) pulses while the utterance plays.
export function speak(text, { rate = null, force = false, button = null } = {}) {
  clearSpeaking();
  if (!window.speechSynthesis || !text) return false;
  if (!force && store.current && store.current.settings.tts === false) return false;
  try {
    speechSynthesis.cancel();
    // "andato/a" is read "andato"; a noun of either gender ("il/la cantante", "i/le clienti") with its first article
    const u = new SpeechSynthesisUtterance(String(text).replace(/\|.*$/, '').replace(/\/[ae]\b/g, '').replace(/\b(il|lo|i|gli)\/(la|le)\b/g, '$1'));
    u.lang = 'it-IT';
    const v = italianVoice(); if (v) u.voice = v;
    u.rate = rate ?? (store.current?.settings?.ttsRate || 0.9);
    if (button) {
      activeSpeakBtn = button; button.classList.add('speaking');
      speakTimer = setTimeout(clearSpeaking, Math.max(1500, String(text).length * 110));
      u.onend = u.onerror = () => { if (activeSpeakBtn === button) clearSpeaking(); };
    }
    speechSynthesis.speak(u);
    return true;
  } catch { clearSpeaking(); return false; }
}
export const speakBtn = (text, cls = '') => html`<button class="speak ${cls}" type="button" data-say="${text}" aria-label="Listen">${raw(icon('speaker'))}</button>`;
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-say]');
  if (!b) return;
  ev.preventDefault(); ev.stopPropagation();
  speak(b.dataset.say, { force: true, button: b.classList.contains('speak') ? b : null });
});

export function haptic(kind = 'light') {
  try { if (store.current?.settings?.haptics === false) return; if (navigator.vibrate) navigator.vibrate(kind === 'error' ? [30, 40, 30] : kind === 'success' ? 20 : 8); } catch { /* ignore */ }
}

// ---------- misc ----------
export function fmtNum(n) { return new Intl.NumberFormat('en').format(n || 0); }
export function relTime(ts) {
  if (!ts) return '—';
  const diff = ts - Date.now(); const abs = Math.abs(diff);
  const m = Math.round(abs / 60000), h = Math.round(abs / 3600e3), d = Math.round(abs / 86400e3);
  const s = m < 60 ? `${m} min` : h < 48 ? `${h} h` : `${d} d`;
  return diff > 0 ? `in ${s}` : `${s} ago`;
}
export function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
// Level chip: <span class="lvl lvl-B1">B1</span> (add 'on' to fill)
export function levelBadge(level, cls = '') { return html`<span class="lvl lvl-${level} ${cls}">${level}</span>`; }
export function progressBar(value, max, cls = '') { return html`<div class="bar ${cls}"><div class="bar-fill" style="width:${max ? Math.min(100, Math.round((value / max) * 100)) : 0}%"></div></div>`; }
// Section header: kicker + display title (+ optional right link)
export function secHead(kicker, title, { href = null, more = null, cls = '' } = {}) {
  return html`<div class="sec-head ${cls}"><div><span class="kicker">${kicker}</span><span class="title">${title}</span></div>${href ? raw(html`<a class="more" href="${href}">${more || 'All'}</a>`) : ''}</div>`;
}
export function iconBtn(name, { label = '', cls = '', attrs = '' } = {}) {
  return html`<button type="button" class="icon-btn ${cls}" aria-label="${label}" ${raw(attrs)}>${raw(icon(name))}</button>`;
}
export function onEnter(input, fn) { input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); }
export function scrollTop() { window.scrollTo({ top: 0 }); }
