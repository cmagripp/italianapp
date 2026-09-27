// Profile ("Me"): identity hero (avatar in a gold ring, XP, streak), stat tiles, 4-week heat map, goals with glass
// dropdown pickers, display & sound with dial-like segmented controls and switches, backup, cloud sync, users reel, danger zone.
import { html, raw, esc, toast, confirmDialog, promptDialog, sheet, fmtNum, italianVoice, speak, speakBtn, icon, levelBadge } from '../ui.js';
import { setTitle } from '../app.js';
import { store, todayKey } from '../store.js';
import { data, LEVELS, LEVEL_INFO, registerCustom } from '../data.js';
import { stage } from '../srs.js';
import { setScene, SCENES, dropdown, mount, countUp, reducedMotion } from '../fx.js';
import * as sync from '../sync.js';

const AVATARS = ['🇮🇹', '🍕', '🍝', '🛵', '🎭', '⚽', '🍷', '🏛️', '🌋', '🎨', '☕', '🐈', '🦁', '🌊', '🍋', '🎻'];
const ic = (name, opts) => raw(icon(name, opts));
const NUM_KEYS = ['dailyNew', 'dailyVerbs', 'dailyReviews'];

// Goal pickers (glass dropdowns instead of <select>s). Values are stored with store.setSetting(key, value).
const GOALS = [
  { key: 'level', label: 'Current level', sub: 'Colours the app, picks the word of the night', options: LEVELS.map(L => ({ value: L, label: `${L} · ${LEVEL_INFO[L].it}`, sub: LEVEL_INFO[L].name })) },
  { key: 'dailyNew', label: 'New words per day', sub: 'Introduced in Learn', options: [3, 5, 8, 10, 15, 20, 30].map(n => ({ value: n, label: `${n} words` })) },
  { key: 'dailyVerbs', label: 'New verbs per day', sub: 'Each with its own walkthrough', options: [1, 2, 3, 5, 8].map(n => ({ value: n, label: `${n} ${n === 1 ? 'verb' : 'verbs'}` })) },
  { key: 'dailyReviews', label: 'Reviews per session', sub: 'Cap for a single review run', options: [20, 40, 60, 100].map(n => ({ value: n, label: `${n} reviews` })) },
];
// Dial-like segmented controls (in-place updates, no full redraw).
const SEGS = {
  showEn: [['tap', 'Tap'], ['always', 'Always']],
  theme: [['auto', 'Auto'], ['dark', 'Notte'], ['light', 'Mezzogiorno']],
  ttsRate: [[0.75, 'Slow'], [0.9, 'Normal'], [1.05, 'Fast']],
};

const secHeadIt = (kicker, it, en) => html`<div class="sec-head in-pane"><div><span class="kicker">${kicker}</span><span class="title itx" role="button" tabindex="0"><span class="it">${it}</span><span class="tr">${en}</span></span></div></div>`;
const pickerHTML = (key, valueHTML, label) => html`<button type="button" class="picker" data-pick="${key}" aria-haspopup="menu" aria-expanded="false" aria-label="${label}"><span class="val">${raw(valueHTML)}</span>${ic('chevronDown', { size: 16 })}</button>`;
const goalValue = (g, v) => g.key === 'level' ? levelBadge(v || 'A1', 'on') : esc(String(v));
function segHTML(key, cur) {
  const opts = SEGS[key];
  const i = Math.max(0, opts.findIndex(([v]) => String(v) === String(cur)));
  return html`<div class="seg no-anim" role="radiogroup" data-segkey="${key}">${raw(opts.map(([v, l], k) => html`<button type="button" role="radio" aria-checked="${k === i ? 'true' : 'false'}" class="${k === i ? 'on' : ''}" data-seg="${key}" data-v="${v}">${l}</button>`).join(''))}</div>`;
}
const switchHTML = (key, on, label) => html`<button type="button" class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${label}" data-toggle="${key}"></button>`;
// Moves the gold knob under the .on segment (px, so segments may have different widths).
function placeKnob(seg, animate = true) {
  const on = seg.querySelector('button.on'); if (!on) return;
  seg.classList.toggle('no-anim', !animate);
  seg.style.setProperty('--kx', `${on.offsetLeft}px`); seg.style.setProperty('--kw', `${on.offsetWidth}px`);
  if (!animate) requestAnimationFrame(() => seg.classList.remove('no-anim'));
}
const placeKnobs = (root, animate = false) => root.querySelectorAll('.seg').forEach(s => placeKnob(s, animate));

export async function render(root) {
  setTitle('Me');
  const wrap = document.createElement('div'); wrap.className = 'me';
  root.append(wrap);
  let first = true;
  let pressTimer = null, longPressed = false;
  const onResize = () => placeKnobs(wrap, false);
  window.addEventListener('resize', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (wrap.isConnected) placeKnobs(wrap, false); });

  function draw() {
    const p = store.current; const s = p.settings; const st = p.stats;
    const level = s.level || 'A1';
    const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
    for (const it of Object.values(p.items)) counts[stage(it)]++;
    const learnedV = store.learnedIds('v:').length, learnedW = store.learnedIds().length - learnedV;
    const days = Object.values(st.days);
    const totalAnswers = days.reduce((a, v) => a + (v.correct || 0) + (v.wrong || 0), 0);
    const totalCorrect = days.reduce((a, v) => a + (v.correct || 0), 0);
    const today = todayKey();
    const last28 = [...Array(28)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (27 - i)); const k = todayKey(d); const v = st.days[k]; const n = v ? (v.correct || 0) + (v.new || 0) : 0; return { k, n, d, l: n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4 }; });
    const activeDays = last28.filter(x => x.n > 0).length;
    const dayLetters = last28.slice(0, 7).map(x => 'SMTWTFS'[x.d.getDay()]);
    const voice = italianVoice();
    const voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v => /^it([-_]|$)/i.test(v.lang));

    wrap.innerHTML = html`
      <section class="glass me-hero">
        <div class="me-avatar-wrap"><button type="button" class="me-avatar" data-avatar aria-label="Change avatar">${p.avatar}<span class="me-avatar-edit">${ic('edit', { size: 13 })}</span></button></div>
        <div class="me-id">
          <div class="me-name"><span>${p.name}</span>${raw(levelBadge(level))}</div>
          <div class="me-xp"><span class="num" data-xp>${fmtNum(st.xp)}</span><span class="unit">XP</span></div>
          <div class="me-streak">${ic('flame', { size: 15 })}<span>${st.streak || 0} day streak</span><i>·</i><span>best ${st.bestStreak || 0}</span><i>·</i><span>${LEVEL_INFO[level].name}</span></div>
        </div>
        <div class="me-actions"><button type="button" class="btn sm secondary" data-rename>${ic('edit', { size: 16 })}Rename</button><button type="button" class="btn sm ghost" data-users>${ic('user', { size: 16 })}Switch user</button></div>
      </section>

      <div class="me-stats">
        <div class="card stat-tile glass-flat" style="--c:var(--lvl-current)"><div class="num" data-count="${learnedW}">${learnedW}</div><div class="lab">words learned</div></div>
        <div class="card stat-tile glass-flat" style="--c:var(--terracotta)"><div class="num" data-count="${learnedV}">${learnedV}</div><div class="lab">verbs learned</div></div>
        <div class="card stat-tile glass-flat" style="--c:var(--stage-mastered)"><div class="num" data-count="${counts.mastered}">${counts.mastered}</div><div class="lab">mastered</div></div>
      </div>

      <div class="card">
        ${raw(secHeadIt('Last 4 weeks', 'Il tuo ritmo', 'Your rhythm'))}
        <div class="heat-days">${raw(dayLetters.map(l => `<span>${l}</span>`).join(''))}</div>
        <div class="heat">${raw(last28.map((x, i) => `<div class="d l${x.l}${x.k === today ? ' today' : ''}" style="--i:${i}" title="${x.k}: ${x.n} ${x.n === 1 ? 'answer' : 'answers'}"></div>`).join(''))}</div>
        <div class="heat-foot">
          <div class="tags"><span>${activeDays} active ${activeDays === 1 ? 'day' : 'days'}</span><span>${totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) + '% accuracy' : 'no answers yet'}</span><span>${counts.learning} learning</span><span>${counts.review} reviewing</span></div>
          <div class="heat-legend">less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> more</div>
        </div>
      </div>

      <div class="card">
        ${raw(secHeadIt('Goals', 'Obiettivi', 'Goals'))}
        ${raw(GOALS.map(g => html`<div class="set-row"><div class="set-main"><div class="lab">${g.label}</div><div class="sub">${g.sub}</div></div>${raw(pickerHTML(g.key, goalValue(g, s[g.key]), g.label))}</div>`).join(''))}
      </div>

      <div class="card">
        ${raw(secHeadIt('Display & sound', 'Schermo e suono', 'Display & sound'))}
        <div class="set-row stack"><div class="set-head"><div class="set-main"><div class="lab">English translations</div><div class="sub">Tap Italian text to reveal it, or show it everywhere</div></div></div>${raw(segHTML('showEn', s.showEn || 'tap'))}</div>
        <div class="set-row stack"><div class="set-head"><div class="set-main"><div class="lab">Theme</div><div class="sub">Notte is the night drive, Mezzogiorno the noon light</div></div></div>${raw(segHTML('theme', s.theme || 'auto'))}</div>
        <div class="set-row"><div class="set-main"><div class="lab">Pronunciation</div><div class="sub">${voice ? 'Voice: ' + voice.name : 'No Italian voice found on this device'}</div></div>${raw(switchHTML('tts', s.tts !== false, 'Text-to-speech'))}</div>
        ${voices.length > 1 ? raw(html`<div class="set-row"><div class="set-main"><div class="lab">Voice</div><div class="sub">${voices.length} Italian voices available</div></div>${raw(pickerHTML('voice', esc(s.voice && voices.some(v => v.name === s.voice) ? s.voice : 'Automatic'), 'Voice'))}</div>`) : ''}
        <div class="set-row stack"><div class="set-head"><div class="set-main"><div class="lab">Speech rate</div><div class="sub">How fast Italian is read aloud</div></div>${raw(speakBtn('Buongiorno, benvenuto!'))}</div>${raw(segHTML('ttsRate', s.ttsRate ?? 0.9))}</div>
        <div class="set-row"><div class="set-main"><div class="lab">Strict accents</div><div class="sub">Typed answers must carry the right accents (è, à…)</div></div>${raw(switchHTML('accentStrict', !!s.accentStrict, 'Strict accents'))}</div>
        <div class="set-row"><div class="set-main"><div class="lab">Haptic feedback</div><div class="sub">A light tap on answers</div></div>${raw(switchHTML('haptics', s.haptics !== false, 'Haptic feedback'))}</div>
      </div>

      <div class="card">
        ${raw(secHeadIt('Backup', 'Copia di sicurezza', 'Backup'))}
        <p>Progress lives on this device, per user. Export a backup to move it elsewhere or keep it safe. On iPhone add Parola to the Home Screen (Share → Add to Home Screen) so Safari keeps your data.</p>
        <div class="row gap"><button type="button" class="btn sm secondary grow" data-export>${ic('arrow', { size: 16 })}Export backup</button><button type="button" class="btn sm ghost grow" data-import>${ic('plus', { size: 16 })}Import backup</button></div>
        <input type="file" accept="application/json,.json" data-file class="hidden">
      </div>

      <div class="card" data-sync-card>${raw(syncCard())}</div>

      <section class="section">
        <div class="sec-head"><div><span class="kicker">Users on this device</span><span class="title itx" role="button" tabindex="0"><span class="it">Utenti</span><span class="tr">Users</span></span></div></div>
        <div class="reel compact users-reel">
          ${raw(store.profiles.map(u => { const cur = u.id === p.id; return html`<div class="user-card ${cur ? 'cur' : ''}" role="button" tabindex="0" data-user="${u.id}" aria-label="${cur ? u.name + ' (current user)' : 'Switch to ' + u.name}">
            <button type="button" class="icon-btn uc-menu" data-user-menu="${u.id}" aria-label="Options for ${u.name}" aria-haspopup="menu">${ic('dots', { size: 20 })}</button>
            <span class="uc-av">${u.avatar || '🇮🇹'}</span><span class="uc-name">${u.name}</span><span class="uc-sub">${cur ? 'current' : 'tap to switch'}</span></div>`; }).join(''))}
          <button type="button" class="user-card new" data-new-user><span class="uc-av">${ic('plus', { size: 26 })}</span><span class="uc-name">New user</span><span class="uc-sub">own progress</span></button>
        </div>
      </section>

      <div class="card danger-zone">
        ${raw(secHeadIt('Danger zone', 'Zona pericolosa', 'Danger zone'))}
        <p>Clears every answer, streak and XP of this user. Lists and custom words stay.</p>
        <button type="button" class="btn danger block" data-reset>${ic('trash', { size: 18 })}Reset my progress</button>
      </div>
      <p class="me-foot">Parola · ${fmtNum(data.vocab.length)} words · ${fmtNum(data.verbs.length)} verbs · offline-ready</p>`;

    placeKnobs(wrap, false);
    bindSync(wrap, draw);
    if (first) {
      first = false;
      mount(wrap);
      if (!reducedMotion()) {
        wrap.querySelectorAll('[data-count]').forEach(el => { const n = Number(el.dataset.count); if (n > 0) countUp(el, n, { duration: 900 }); });
        const xpEl = wrap.querySelector('[data-xp]');
        if (st.xp > 0 && st.xp < 100000) countUp(xpEl, st.xp, { duration: 1100 }).then(() => { xpEl.textContent = fmtNum(store.current.stats.xp); });
      }
    }
  }

  // ---------- in-place interactions ----------
  function setSeg(seg, key, v) {
    seg.querySelectorAll('[data-seg]').forEach(b => { const on = String(b.dataset.v) === String(v); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    placeKnob(seg, true);
  }
  function openGoal(btn, key) {
    const g = GOALS.find(x => x.key === key); if (!g) return;
    const cur = store.settings[key];
    dropdown(btn, g.options.map(o => ({ ...o, selected: String(o.value) === String(cur) })), { align: 'end', width: 250, onSelect: (v) => {
      const val = NUM_KEYS.includes(key) ? Number(v) : v;
      store.setSetting(key, val);
      btn.querySelector('.val').innerHTML = goalValue(g, val);
      if (key === 'level') { setScene(SCENES.profile, { level: val }); const nameLvl = wrap.querySelector('.me-name .lvl'); if (nameLvl) nameLvl.outerHTML = levelBadge(val); const st = wrap.querySelector('.me-streak span:last-child'); if (st) st.textContent = LEVEL_INFO[val].name; }
    } });
  }
  function openVoice(btn) {
    const voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v => /^it([-_]|$)/i.test(v.lang));
    const cur = store.settings.voice || '';
    const opts = [{ value: '', label: 'Automatic', sub: 'Best Italian voice on this device', selected: !cur }, ...voices.map(v => ({ value: v.name, label: v.name, sub: v.lang + (v.localService ? ' · on device' : ''), selected: v.name === cur }))];
    dropdown(btn, opts, { align: 'end', width: 270, onSelect: (v) => { store.setSetting('voice', v); btn.querySelector('.val').textContent = v || 'Automatic'; speak('Ciao! Come stai?', { force: true }); } });
  }
  function userMenu(anchor, id) {
    const u = store.profiles.find(x => x.id === id); if (!u) return;
    const cur = id === store.current.id;
    const opt = (value, label, sub = '', extra = '', cls = '') => `<button type="button" class="opt" role="menuitem" data-value="${value}" ${extra}><span class="opt-main"><span class="opt-label ${cls}">${esc(label)}</span>${sub ? `<span class="opt-sub">${esc(sub)}</span>` : ''}</span></button>`;
    const content = `<div class="dropdown-title">${esc(u.name)}${cur ? ' · current' : ''}</div><div class="dropdown-list">
      ${cur ? opt('rename', 'Rename', 'Change your name') + opt('avatar', 'Change avatar') : opt('switch', 'Switch to ' + u.name, 'Their own lists, progress and settings')}
      ${store.profiles.length > 1 ? opt('delete', 'Delete user', 'Removes all their progress', `data-del-user="${esc(id)}"`, 'ko') : ''}</div>`;
    dropdown(anchor, content, { align: 'end', width: 260, onSelect: (v) => { setTimeout(() => userAction(v, id), 0); } });
  }
  async function userAction(act, id) {
    if (act === 'switch') await switchUser(id);
    else if (act === 'rename') rename();
    else if (act === 'avatar') avatarSheet();
    else if (act === 'delete') await deleteUser(id);
  }
  async function switchUser(id) {
    if (id === store.current.id) return;
    await store.switchProfile(id); registerCustom(store.current.custom);
    toast('Switched to ' + store.current.name, { kind: 'ok' }); draw();
  }
  async function deleteUser(id) {
    const u = store.profiles.find(x => x.id === id); if (!u) return;
    if (await confirmDialog(`Delete user “${u.name}” and all their progress?`, { ok: 'Delete', danger: true })) { await store.deleteProfile(id); registerCustom(store.current.custom); toast('User deleted'); draw(); }
  }
  async function rename() {
    const name = await promptDialog('Your name', { value: store.current.name });
    if (name) { store.renameProfile(name); draw(); }
  }
  function avatarSheet() {
    const cur = store.current.avatar;
    const s2 = sheet(html`<div class="av-grid">${raw(AVATARS.map(a => html`<button type="button" class="btn ${a === cur ? 'on' : ''}" data-av="${a}" aria-label="Avatar ${a}">${a}</button>`).join(''))}</div>`, { title: 'Choose an avatar' });
    s2.body.addEventListener('click', (e2) => { const b = e2.target.closest('[data-av]'); if (!b) return; store.renameProfile(store.current.name, b.dataset.av); s2.close(); draw(); });
  }
  function exportBackup() {
    const p = store.current;
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `parola-${p.name.replace(/\W+/g, '_')}-${todayKey()}.json`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Backup exported', { kind: 'ok' });
  }

  wrap.addEventListener('click', async (ev) => {
    const t = ev.target;
    const segBtn = t.closest('[data-seg]');
    if (segBtn) { const k = segBtn.dataset.seg; let v = segBtn.dataset.v; if (k === 'ttsRate') v = Number(v); store.setSetting(k, v); setSeg(segBtn.closest('.seg'), k, v); if (k === 'ttsRate') speak('Buongiorno, benvenuto!', { force: true }); return; }
    const sw = t.closest('[data-toggle]');
    if (sw) { const k = sw.dataset.toggle; const cur = store.settings[k] !== false && store.settings[k] !== undefined ? store.settings[k] : false; const next = !cur; store.setSetting(k, next); sw.classList.toggle('on', next); sw.setAttribute('aria-checked', next ? 'true' : 'false'); if (k === 'tts' && next) speak('Perfetto!', { force: true }); return; }
    const pick = t.closest('[data-pick]');
    if (pick) { if (pick.dataset.pick === 'voice') openVoice(pick); else openGoal(pick, pick.dataset.pick); return; }
    if (t.closest('[data-avatar]')) { avatarSheet(); return; }
    if (t.closest('[data-rename]')) { rename(); return; }
    if (t.closest('[data-users]')) { wrap.querySelector('.users-reel')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' }); return; }
    if (t.closest('[data-export]')) { exportBackup(); return; }
    if (t.closest('[data-import]')) { wrap.querySelector('[data-file]')?.click(); return; }
    if (t.closest('[data-reset]')) { if (await confirmDialog('Reset all learning progress for this user? Lists and custom words are kept.', { ok: 'Reset', danger: true })) { await store.resetProgress(); toast('Progress reset'); draw(); } return; }
    if (t.closest('[data-new-user]')) { const name = await promptDialog('Name for the new user', { placeholder: 'e.g. Marco' }); if (name) { await store.createProfile(name, AVATARS[Math.floor(Math.random() * AVATARS.length)]); registerCustom(store.current.custom); toast('Welcome, ' + name + '!', { kind: 'ok' }); draw(); } return; }
    const menu = t.closest('[data-user-menu]');
    if (menu) { ev.stopPropagation(); userMenu(menu, menu.dataset.userMenu); return; }
    const card = t.closest('[data-user]');
    if (card) { if (longPressed) { longPressed = false; return; } const id = card.dataset.user; if (id === store.current.id) userMenu(card.querySelector('[data-user-menu]') || card, id); else await switchUser(id); }
  });
  wrap.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const card = ev.target.closest && ev.target.closest('[data-user]');
    if (card && ev.target === card) { ev.preventDefault(); card.click(); }
  });
  // long-press on a user card opens its menu (delete / rename)
  const clearPress = () => { clearTimeout(pressTimer); pressTimer = null; };
  wrap.addEventListener('pointerdown', (ev) => {
    const card = ev.target.closest('[data-user]'); if (!card || ev.target.closest('[data-user-menu]')) return;
    clearPress();
    pressTimer = setTimeout(() => { pressTimer = null; longPressed = true; userMenu(card.querySelector('[data-user-menu]') || card, card.dataset.user); }, 520);
  });
  wrap.addEventListener('pointerup', clearPress); wrap.addEventListener('pointercancel', clearPress); wrap.addEventListener('pointermove', (ev) => { if (pressTimer && (Math.abs(ev.movementX) > 3 || Math.abs(ev.movementY) > 3)) clearPress(); });
  wrap.addEventListener('change', async (ev) => {
    const file = ev.target.closest('[data-file]'); if (!file) return;
    const f = file.files[0]; if (!f) return;
    try {
      const text = await f.text();
      const merge = await confirmDialog('Merge with the current progress, or replace it?', { ok: 'Merge', cancel: 'Replace' });
      await store.importJSON(text, { merge });
      registerCustom(store.current.custom);
      toast('Backup imported', { kind: 'ok' }); draw();
    } catch (err) { toast('Import failed: ' + err.message, { kind: 'ko', ms: 3000 }); }
  });

  draw();
  return () => { window.removeEventListener('resize', onResize); clearPress(); };
}

// ---------- cloud sync pane (behaviour unchanged: configure → signIn/signUp → syncNow → startAutoSync; signOut) ----------
function syncCard() {
  const c = sync.getConfig();
  const on = sync.isEnabled();
  return html`<div class="sec-head in-pane"><div><span class="kicker">Cloud sync · optional</span><span class="title itx" role="button" tabindex="0"><span class="it">Sincronizzazione</span><span class="tr">Cloud sync</span></span></div></div>
    <p>Keep this user's progress in sync across devices with your own free <a href="https://supabase.com" target="_blank" rel="noopener">Supabase</a> project: paste the project URL and anon key, then sign in.</p>
    ${on ? raw(html`<div class="sync-on"><span class="icon-btn sync-ico" aria-hidden="true">${ic('cloud', { size: 20 })}</span><div class="grow"><div class="lab">Signed in as ${c.email}</div><div class="sub">${c.lastSync ? 'Last sync ' + new Date(c.lastSync).toLocaleString() : 'Not synced yet'}</div></div><span class="dot stage-mastered" title="Sync on"></span></div>
      <div class="row gap mt"><button type="button" class="btn primary grow" data-sync-now>${ic('refresh', { size: 18 })}Sync now</button><button type="button" class="btn ghost grow" data-sync-out>Sign out</button></div>`)
    : raw(html`<div class="field"><label>Supabase project URL</label><input class="input" data-sync="url" value="${c.url}" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="field"><label>Anon (public) key</label><input class="input" data-sync="key" value="${c.anonKey}" placeholder="eyJ…" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="field"><label>Email</label><input class="input" data-sync="email" type="email" value="${c.email}" autocapitalize="off" autocomplete="email"></div>
      <div class="field"><label>Password</label><input class="input" data-sync="pass" type="password" autocomplete="current-password"></div>
      <div class="row gap"><button type="button" class="btn primary grow" data-sync-in>${ic('lock', { size: 18 })}Sign in</button><button type="button" class="btn grow" data-sync-up>Create account</button></div>
      <div class="row mt"><button type="button" class="btn sm ghost" data-sync-sql>${ic('list', { size: 16 })}Show setup SQL</button></div>`)}
    <div class="sync-status" data-sync-status role="status"></div>`;
}
function bindSync(root, draw) {
  const card = root.querySelector('[data-sync-card]'); if (!card) return;
  const status = (m, kind = '') => { const el = card.querySelector('[data-sync-status]'); if (el) { el.textContent = m; el.classList.toggle('ko', kind === 'ko'); } };
  const creds = () => ({ url: card.querySelector('[data-sync="url"]')?.value || '', key: card.querySelector('[data-sync="key"]')?.value || '', email: card.querySelector('[data-sync="email"]')?.value || '', pass: card.querySelector('[data-sync="pass"]')?.value || '' });
  card.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    try {
      if (b.hasAttribute('data-sync-sql')) { sheet(html`<p class="small muted">Run this once in your Supabase project (SQL editor), then enable Email auth in Authentication → Providers:</p><pre class="sql">${sync.SETUP_SQL}</pre>`, { title: 'Setup SQL' }); return; }
      if (b.hasAttribute('data-sync-in') || b.hasAttribute('data-sync-up')) {
        const { url, key, email, pass } = creds();
        if (!url || !key || !email || !pass) { status('Please fill in all four fields.', 'ko'); return; }
        await sync.configure(url, key);
        status('Connecting…');
        if (b.hasAttribute('data-sync-up')) { const r = await sync.signUp(email, pass); if (!r.confirmed) { status('Account created. Confirm the email Supabase sent you, then sign in.'); return; } }
        else await sync.signIn(email, pass);
        status('Signed in. Syncing…');
        await sync.syncNow(); registerCustom(store.current.custom); sync.startAutoSync();
        toast('Cloud sync enabled', { kind: 'ok' }); draw(); return;
      }
      if (b.hasAttribute('data-sync-now')) { status('Syncing…'); await sync.syncNow(); registerCustom(store.current.custom); toast('Synced', { kind: 'ok' }); draw(); return; }
      if (b.hasAttribute('data-sync-out')) { sync.signOut(); toast('Signed out of cloud sync'); draw(); return; }
    } catch (err) { status('Error: ' + err.message, 'ko'); }
  });
}
