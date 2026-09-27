// Optional cloud sync through a Supabase project the user owns (email + password auth, one JSON row per user).
// Nothing here runs unless the user configures it in Me → Cloud sync. Tokens are kept in localStorage on the device.
import { store } from './store.js';

const LS_KEY = () => 'it.sync.' + store.current.id;
let pushTimer = null;
let listening = false;

export function getConfig() {
  try { return JSON.parse(localStorage.getItem(LS_KEY()) || 'null') || { url: '', anonKey: '', email: '', access: '', refresh: '', userId: '', lastSync: 0, enabled: false }; }
  catch { return { url: '', anonKey: '', email: '', access: '', refresh: '', userId: '', lastSync: 0, enabled: false }; }
}
function saveConfig(c) { try { localStorage.setItem(LS_KEY(), JSON.stringify(c)); } catch { /* ignore */ } }
export const isEnabled = () => { const c = getConfig(); return !!(c.enabled && c.url && c.anonKey && c.access); };

// `retried` is an internal flag (one refresh-and-retry per call), never a wire header
async function api(path, { method = 'GET', body = null, auth = true, headers = {}, retried = false } = {}) {
  const c = getConfig();
  const url = c.url.replace(/\/+$/, '') + path;
  const h = { apikey: c.anonKey, 'Content-Type': 'application/json', ...headers };
  if (auth && c.access) h.Authorization = 'Bearer ' + c.access;
  // bounded wait: a request that hangs on a bad connection must not block every later sync
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 30000);
  let res, text;
  try { res = await fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : null, signal: ctl.signal }); text = await res.text(); }
  catch (err) { throw new Error(ctl.signal.aborted ? 'No answer from the server (timed out)' : (err && err.message) || 'Network error'); }
  finally { clearTimeout(timer); }
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    if (res.status === 401 && auth && c.refresh && !retried) { await refreshToken(); return api(path, { method, body, auth, headers, retried: true }); }
    throw new Error((json && (json.msg || json.message || json.error_description || json.error)) || `HTTP ${res.status}`);
  }
  return json;
}
// remember why the last sync failed so the profile card can show it (auto pushes have no other UI)
function noteError(err) { const c = getConfig(); c.lastError = String((err && err.message) || err || 'Sync failed'); saveConfig(c); return err; }

function storeSession(data) {
  if (!data || !data.access_token) throw new Error('The server returned no session');
  const c = getConfig();
  const uid = data.user?.id || c.userId;
  if (uid !== c.userId) { c.lastSync = 0; c.lastRemote = ''; } // a different account: its cloud copy must be merged in full, whatever the old lastSync was
  c.access = data.access_token; c.refresh = data.refresh_token; c.userId = uid; c.email = data.user?.email || c.email; c.enabled = true; c.lastError = '';
  saveConfig(c);
}
export async function configure(url, anonKey) {
  const c = getConfig();
  let u = url.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u; // a pasted "xxxx.supabase.co" would otherwise be fetched relative to the app
  c.url = u; c.anonKey = anonKey.trim(); saveConfig(c);
}
export async function signUp(email, password) {
  const data = await api('/auth/v1/signup', { method: 'POST', body: { email, password }, auth: false });
  if (data && data.access_token) { storeSession(data); return { ok: true, confirmed: true }; }
  const c = getConfig(); c.email = email; saveConfig(c);
  return { ok: true, confirmed: false };
}
export async function signIn(email, password) {
  const data = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
  storeSession(data);
  return data;
}
async function refreshToken() {
  const c = getConfig();
  const data = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: c.refresh }, auth: false });
  storeSession(data);
}
export function signOut() { clearTimeout(pushTimer); const c = getConfig(); c.access = ''; c.refresh = ''; c.userId = ''; c.enabled = false; c.lastSync = 0; c.lastRemote = ''; c.lastError = ''; saveConfig(c); }

export async function pull() {
  const c = getConfig();
  const rows = await api(`/rest/v1/parola_profiles?select=data,updated_at&user_id=eq.${c.userId}`);
  return rows && rows[0] ? rows[0] : null;
}
export async function push() {
  if (!isEnabled()) return; // signed out while a push was pending
  clearTimeout(pushTimer); // this push supersedes any scheduled one
  const c = getConfig();
  await store.saveNow();
  const body = { user_id: c.userId, data: store.current, updated_at: new Date().toISOString() };
  try { await api('/rest/v1/parola_profiles', { method: 'POST', body, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } }); }
  catch (err) { throw noteError(err); }
  // re-read: the request may have refreshed the session (401 → new access/refresh tokens); saving the copy read above would discard them
  const c2 = getConfig(); c2.lastSync = Date.now(); c2.lastRemote = body.updated_at; c2.lastError = ''; saveConfig(c2);
}
// Full sync: merge remote into local (newer answers win, lists are unioned), then push the merged profile.
// Concurrent callers (boot, 'online', profile switch, the merge's own change event) share one in-flight sync.
let inflight = null;
export function syncNow() {
  if (!isEnabled()) return Promise.reject(new Error('Cloud sync is not set up'));
  if (inflight) return inflight;
  inflight = (async () => {
    const pid = store.current.id;
    let remote;
    try { remote = await pull(); } catch (err) { throw noteError(err); }
    if (store.current.id !== pid) throw new Error('User switched during sync'); // never merge another user's cloud copy into this profile
    if (remote && remote.data) {
      // "changed since this device last wrote or merged it" is decided by the row's own stamp (the last updated_at this
      // device pushed or merged), never by comparing another device's clock with ours: a device a few minutes slow
      // wrote an updated_at below our lastSync, was skipped, and then had its cloud copy overwritten by our push
      const remoteTime = Date.parse(remote.updated_at || 0) || 0;
      const c = getConfig();
      const seen = Date.parse(c.lastRemote || 0) || 0; // 0 (never pushed/merged here) always merges
      if (remoteTime !== seen) await store.importJSON(JSON.stringify({ profile: remote.data }), { merge: true });
    }
    await push();
    store.emit('synced');
    return true;
  })().finally(() => { inflight = null; });
  return inflight;
}
export function schedulePush() {
  if (!isEnabled() || !navigator.onLine) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { push().catch(() => { /* recorded by push(); retried on the next change */ }); }, 15000);
}
// Called at boot and whenever the current user changes; listeners are installed once, the sync runs per call.
export function startAutoSync() {
  if (!listening) {
    listening = true;
    store.on('change', schedulePush);
    window.addEventListener('online', () => { if (isEnabled()) syncNow().catch(() => null); });
  }
  if (isEnabled() && Date.now() - (getConfig().lastSync || 0) > 5000) syncNow().catch(() => null);
}

export const SETUP_SQL = `create table if not exists parola_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table parola_profiles enable row level security;
create policy "own profile" on parola_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;
