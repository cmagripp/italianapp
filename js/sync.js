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

async function api(path, { method = 'GET', body = null, auth = true, headers = {} } = {}) {
  const c = getConfig();
  const url = c.url.replace(/\/+$/, '') + path;
  const h = { apikey: c.anonKey, 'Content-Type': 'application/json', ...headers };
  if (auth && c.access) h.Authorization = 'Bearer ' + c.access;
  const res = await fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : null });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    if (res.status === 401 && auth && c.refresh && !headers['x-retry']) { await refreshToken(); return api(path, { method, body, auth, headers: { ...headers, 'x-retry': '1' } }); }
    throw new Error((json && (json.msg || json.message || json.error_description || json.error)) || `HTTP ${res.status}`);
  }
  return json;
}

function storeSession(data) {
  const c = getConfig();
  c.access = data.access_token; c.refresh = data.refresh_token; c.userId = data.user?.id || c.userId; c.email = data.user?.email || c.email; c.enabled = true;
  saveConfig(c);
}
export async function configure(url, anonKey) { const c = getConfig(); c.url = url.trim(); c.anonKey = anonKey.trim(); saveConfig(c); }
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
export function signOut() { const c = getConfig(); c.access = ''; c.refresh = ''; c.userId = ''; c.enabled = false; saveConfig(c); }

export async function pull() {
  const c = getConfig();
  const rows = await api(`/rest/v1/parola_profiles?select=data,updated_at&user_id=eq.${c.userId}`);
  return rows && rows[0] ? rows[0] : null;
}
export async function push() {
  const c = getConfig();
  await store.saveNow();
  const body = { user_id: c.userId, data: store.current, updated_at: new Date().toISOString() };
  await api('/rest/v1/parola_profiles', { method: 'POST', body, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  c.lastSync = Date.now(); saveConfig(c);
}
// Full sync: merge remote into local (newer answers win, lists are unioned), then push the merged profile.
export async function syncNow() {
  if (!isEnabled()) throw new Error('Cloud sync is not set up');
  const remote = await pull();
  if (remote && remote.data) {
    const remoteTime = Date.parse(remote.updated_at || 0) || 0;
    const c = getConfig();
    if (remoteTime > (c.lastSync || 0)) await store.importJSON(JSON.stringify({ profile: remote.data }), { merge: true });
  }
  await push();
  store.emit('synced');
  return true;
}
export function schedulePush() {
  if (!isEnabled() || !navigator.onLine) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { push().catch(() => { /* retry on next change */ }); }, 15000);
}
export function startAutoSync() {
  if (listening) return; listening = true;
  store.on('change', schedulePush);
  window.addEventListener('online', () => { if (isEnabled()) syncNow().catch(() => null); });
  if (isEnabled()) syncNow().catch(() => null);
}

export const SETUP_SQL = `create table if not exists parola_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table parola_profiles enable row level security;
create policy "own profile" on parola_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;
