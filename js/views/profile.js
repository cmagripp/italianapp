// Profile: users, goals, settings, statistics, backup (export/import), reset.
import { html, raw, esc, toast, confirmDialog, promptDialog, sheet, fmtNum, italianVoice, speak } from '../ui.js';
import { setTitle } from '../app.js';
import { store, todayKey } from '../store.js';
import { data, LEVELS, LEVEL_INFO, registerCustom } from '../data.js';
import { stage } from '../srs.js';
import * as sync from '../sync.js';

const AVATARS = ['🇮🇹', '🍕', '🍝', '🛵', '🎭', '⚽', '🍷', '🏛️', '🌋', '🎨', '☕', '🐈', '🦁', '🌊', '🍋', '🎻'];

export async function render(root) {
  setTitle('Me');
  function draw() {
    const p = store.current; const s = p.settings; const st = p.stats;
    const items = Object.values(p.items);
    const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
    for (const it of items) counts[stage(it)]++;
    const learnedV = store.learnedIds('v:').length, learnedW = store.learnedIds().length - learnedV;
    const days = Object.entries(st.days).sort((a, b) => a[0].localeCompare(b[0]));
    const last28 = [...Array(28)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (27 - i)); const k = todayKey(d); const v = st.days[k]; const n = v ? (v.correct || 0) + (v.new || 0) : 0; return n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4; });
    const totalAnswers = days.reduce((a, [, v]) => a + (v.correct || 0) + (v.wrong || 0), 0);
    const totalCorrect = days.reduce((a, [, v]) => a + (v.correct || 0), 0);
    const voice = italianVoice();
    const voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v => /^it/i.test(v.lang));
    root.innerHTML = html`
      <div class="card row gap"><div class="avatar" data-avatar style="cursor:pointer">${p.avatar}</div><div class="grow"><div class="bold" style="font-size:18px">${p.name}</div><div class="tiny muted">${fmtNum(st.xp)} XP · 🔥 ${st.streak || 0} day streak (best ${st.bestStreak || 0})</div></div><button class="btn xs ghost" data-users>Switch user</button></div>

      <div class="grid3 mb">
        <div class="card stat tight"><div class="num">${learnedW}</div><div class="lab">words learned</div></div>
        <div class="card stat tight"><div class="num">${learnedV}</div><div class="lab">verbs learned</div></div>
        <div class="card stat tight"><div class="num">${counts.mastered}</div><div class="lab">mastered</div></div>
      </div>
      <div class="card"><h4>Last 4 weeks</h4><div class="heat">${raw(last28.map(l => `<div class="d l${l}"></div>`).join(''))}</div><div class="tiny muted mt">${totalAnswers ? `${Math.round((totalCorrect / totalAnswers) * 100)}% accuracy over ${fmtNum(totalAnswers)} answers` : 'No answers yet'} · learning ${counts.learning} · reviewing ${counts.review}</div></div>

      <div class="card"><h4>Goals</h4>
        <div class="opt-row"><div><div class="lab">Current level</div><div class="sub">Used for word of the day and defaults</div></div><select class="input" style="width:auto" data-set="level">${raw(LEVELS.map(L => `<option ${s.level === L ? 'selected' : ''}>${L}</option>`).join(''))}</select></div>
        <div class="opt-row"><div><div class="lab">New words per day</div></div><select class="input" style="width:auto" data-set="dailyNew">${raw([3, 5, 8, 10, 15, 20, 30].map(n => `<option ${s.dailyNew === n ? 'selected' : ''}>${n}</option>`).join(''))}</select></div>
        <div class="opt-row"><div><div class="lab">New verbs per day</div></div><select class="input" style="width:auto" data-set="dailyVerbs">${raw([1, 2, 3, 5, 8].map(n => `<option ${s.dailyVerbs === n ? 'selected' : ''}>${n}</option>`).join(''))}</select></div>
        <div class="opt-row"><div><div class="lab">Max reviews per session</div></div><select class="input" style="width:auto" data-set="dailyReviews">${raw([20, 40, 60, 100].map(n => `<option ${s.dailyReviews === n ? 'selected' : ''}>${n}</option>`).join(''))}</select></div>
      </div>

      <div class="card"><h4>Display & sound</h4>
        <div class="opt-row"><div><div class="lab">English translations</div><div class="sub">Tap to reveal, or always visible</div></div><div class="seg" style="min-width:150px"><button data-seg="showEn" data-v="tap" class="${s.showEn === 'tap' ? 'on' : ''}">Tap</button><button data-seg="showEn" data-v="always" class="${s.showEn === 'always' ? 'on' : ''}">Always</button></div></div>
        <div class="opt-row"><div><div class="lab">Theme</div></div><div class="seg" style="min-width:180px"><button data-seg="theme" data-v="auto" class="${s.theme === 'auto' ? 'on' : ''}">Auto</button><button data-seg="theme" data-v="light" class="${s.theme === 'light' ? 'on' : ''}">Light</button><button data-seg="theme" data-v="dark" class="${s.theme === 'dark' ? 'on' : ''}">Dark</button></div></div>
        <div class="opt-row"><div><div class="lab">Pronunciation (text-to-speech)</div><div class="sub">${voice ? 'Voice: ' + voice.name : 'No Italian voice found on this device'}</div></div><button class="switch ${s.tts ? 'on' : ''}" data-toggle="tts" aria-label="Toggle speech"></button></div>
        ${voices.length > 1 ? raw(html`<div class="opt-row"><div class="lab">Voice</div><select class="input" style="width:auto;max-width:55%" data-set="voice"><option value="">Auto</option>${raw(voices.map(v => `<option value="${esc(v.name)}" ${s.voice === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join(''))}</select></div>`) : ''}
        <div class="opt-row"><div><div class="lab">Speech rate</div></div><div class="seg" style="min-width:150px"><button data-seg="ttsRate" data-v="0.75" class="${s.ttsRate === 0.75 ? 'on' : ''}">Slow</button><button data-seg="ttsRate" data-v="0.9" class="${s.ttsRate === 0.9 ? 'on' : ''}">Normal</button><button data-seg="ttsRate" data-v="1.05" class="${s.ttsRate === 1.05 ? 'on' : ''}">Fast</button></div></div>
        <div class="opt-row"><div><div class="lab">Strict accents</div><div class="sub">Typed answers must have the right accents (è, à…)</div></div><button class="switch ${s.accentStrict ? 'on' : ''}" data-toggle="accentStrict"></button></div>
        <div class="opt-row"><div><div class="lab">Haptic feedback</div></div><button class="switch ${s.haptics !== false ? 'on' : ''}" data-toggle="haptics"></button></div>
      </div>

      <div class="card"><h4>Backup & sync</h4>
        <p class="small muted">Your progress is stored on this device per user. Export a backup file to move it to another device or keep it safe. On iPhone, add this app to your Home Screen (Share → Add to Home Screen) so Safari keeps your data.</p>
        <div class="row gap"><button class="btn grow" data-export>Export backup</button><button class="btn grow" data-import>Import backup</button></div>
        <input type="file" accept="application/json,.json" data-file class="hidden">
      </div>

      <div class="card" data-sync-card>${raw(syncCard())}</div>

      <div class="card"><h4>Users on this device</h4>
        <div class="list">${raw(store.profiles.map(u => html`<div class="item" data-user="${u.id}" style="${u.id === p.id ? 'border:2px solid var(--primary)' : ''}"><span class="avatar" style="width:36px;height:36px;font-size:18px">${u.avatar || '🇮🇹'}</span><div class="main"><div class="hw">${u.name}</div><div class="sub">${u.id === p.id ? 'current' : 'tap to switch'}</div></div>${store.profiles.length > 1 ? raw(html`<button class="icon-btn" data-del-user="${u.id}" aria-label="Delete user">🗑️</button>`) : ''}</div>`).join(''))}</div>
        <div class="row gap mt"><button class="btn grow" data-new-user>＋ New user</button><button class="btn grow ghost" data-rename>Rename me</button></div>
      </div>

      <div class="card"><h4>Danger zone</h4><button class="btn danger block" data-reset>Reset my progress</button></div>
      <p class="center tiny muted">Parola · ${fmtNum(data.vocab.length)} words · ${fmtNum(data.verbs.length)} verbs · offline-ready</p>`;

    root.querySelectorAll('[data-set]').forEach(el => el.addEventListener('change', () => { const k = el.dataset.set; let v = el.value; if (['dailyNew', 'dailyVerbs', 'dailyReviews'].includes(k)) v = Number(v); store.setSetting(k, v); if (k === 'voice') speak('Ciao! Come stai?', { force: true }); }));
    root.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.seg; let v = b.dataset.v; if (k === 'ttsRate') v = Number(v); store.setSetting(k, v); draw(); if (k === 'ttsRate') speak('Buongiorno, benvenuto!', { force: true }); }));
    root.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.toggle; store.setSetting(k, !(store.settings[k] !== false && store.settings[k] !== undefined ? store.settings[k] : false)); if (k === 'tts' && store.settings.tts) speak('Perfetto!', { force: true }); draw(); }));
    root.querySelector('[data-export]').addEventListener('click', () => {
      const blob = new Blob([store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `parola-${p.name.replace(/\W+/g, '_')}-${todayKey()}.json`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('Backup exported', { kind: 'ok' });
    });
    const file = root.querySelector('[data-file]');
    root.querySelector('[data-import]').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      try {
        const text = await f.text();
        const merge = await confirmDialog('Merge with the current progress, or replace it?', { ok: 'Merge', cancel: 'Replace' });
        await store.importJSON(text, { merge });
        registerCustom(store.current.custom);
        toast('Backup imported', { kind: 'ok' }); draw();
      } catch (err) { toast('Import failed: ' + err.message, { kind: 'ko', ms: 3000 }); }
    });
    bindSync(root, draw);
    root.querySelector('[data-reset]').addEventListener('click', async () => { if (await confirmDialog('Reset all learning progress for this user? Lists and custom words are kept.', { ok: 'Reset', danger: true })) { await store.resetProgress(); toast('Progress reset'); draw(); } });
    root.querySelector('[data-new-user]').addEventListener('click', async () => { const name = await promptDialog('Name for the new user', { placeholder: 'e.g. Marco' }); if (name) { await store.createProfile(name, AVATARS[Math.floor(Math.random() * AVATARS.length)]); registerCustom(store.current.custom); toast('Welcome, ' + name + '!', { kind: 'ok' }); draw(); } });
    root.querySelector('[data-rename]').addEventListener('click', async () => { const name = await promptDialog('Your name', { value: p.name }); if (name) { store.renameProfile(name); draw(); } });
    root.querySelector('[data-users]').addEventListener('click', () => root.querySelector('[data-user]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    root.querySelectorAll('[data-user]').forEach(el => el.addEventListener('click', async (ev) => { if (ev.target.closest('[data-del-user]')) return; const id = el.dataset.user; if (id !== p.id) { await store.switchProfile(id); registerCustom(store.current.custom); toast('Switched to ' + store.current.name); draw(); } }));
    root.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', async (ev) => { ev.stopPropagation(); const id = b.dataset.delUser; const u = store.profiles.find(x => x.id === id); if (await confirmDialog(`Delete user “${u.name}” and all their progress?`, { ok: 'Delete', danger: true })) { await store.deleteProfile(id); registerCustom(store.current.custom); draw(); } }));
    root.querySelector('[data-avatar]').addEventListener('click', () => {
      const s2 = sheet(html`<div class="letter-grid">${raw(AVATARS.map(a => html`<button class="btn" data-av="${a}" style="font-size:24px;height:56px">${a}</button>`).join(''))}</div>`, { title: 'Choose an avatar' });
      s2.body.addEventListener('click', (e2) => { const b = e2.target.closest('[data-av]'); if (!b) return; store.renameProfile(p.name, b.dataset.av); s2.close(); draw(); });
    });
  }
  draw();
}


function syncCard() {
  const c = sync.getConfig();
  const on = sync.isEnabled();
  return html`<h4>Cloud sync <span class="tiny muted">(optional)</span></h4>
    <p class="small muted">Keep this user's progress in sync across devices with your own free <a href="https://supabase.com" target="_blank" rel="noopener">Supabase</a> project. Paste the project URL and anon key, then sign in. <button class="link" data-sync-sql>Show setup SQL</button></p>
    ${on ? raw(html`<div class="opt-row"><div><div class="lab">Signed in as ${c.email}</div><div class="sub">${c.lastSync ? 'Last sync ' + new Date(c.lastSync).toLocaleString() : 'Not synced yet'}</div></div><span class="badge ok">on</span></div>
      <div class="row gap mt"><button class="btn primary grow" data-sync-now>Sync now</button><button class="btn ghost grow" data-sync-out>Sign out</button></div>`)
    : raw(html`<div class="field"><label>Supabase project URL</label><input class="input" data-sync="url" value="${c.url}" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label>Anon (public) key</label><input class="input" data-sync="key" value="${c.anonKey}" placeholder="eyJ…" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label>Email</label><input class="input" data-sync="email" type="email" value="${c.email}" autocapitalize="off"></div>
      <div class="field"><label>Password</label><input class="input" data-sync="pass" type="password"></div>
      <div class="row gap"><button class="btn primary grow" data-sync-in>Sign in</button><button class="btn grow" data-sync-up>Create account</button></div>`)}
    <div class="tiny muted mt" data-sync-status></div>`;
}
function bindSync(root, draw) {
  const card = root.querySelector('[data-sync-card]'); if (!card) return;
  const status = (m, kind = '') => { const el = card.querySelector('[data-sync-status]'); if (el) { el.textContent = m; el.style.color = kind === 'ko' ? 'var(--danger)' : ''; } };
  const creds = () => ({ url: card.querySelector('[data-sync="url"]')?.value || '', key: card.querySelector('[data-sync="key"]')?.value || '', email: card.querySelector('[data-sync="email"]')?.value || '', pass: card.querySelector('[data-sync="pass"]')?.value || '' });
  card.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    try {
      if (b.hasAttribute('data-sync-sql')) { sheet(html`<p class="small">Run this once in your Supabase project (SQL editor), then enable Email auth in Authentication → Providers:</p><pre class="card flat" style="white-space:pre-wrap;font-size:12px">${sync.SETUP_SQL}</pre>`, { title: 'Setup SQL' }); return; }
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
