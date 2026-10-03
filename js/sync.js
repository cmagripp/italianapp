// Optional cloud sync through a Supabase project the user owns (email + password auth, one JSON row per user).
// Nothing here runs unless the user configures it in Me → Cloud sync. Tokens are kept in localStorage on the device.
import { store } from './store.js';

const LS_KEY = (profileId = store.current.id) => 'it.sync.' + profileId;
let pushTimer = null;
let listening = false;

export function getConfig(profileId) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(profileId)) || 'null') || { url: '', anonKey: '', email: '', access: '', refresh: '', userId: '', lastSync: 0, enabled: false }; }
  catch { return { url: '', anonKey: '', email: '', access: '', refresh: '', userId: '', lastSync: 0, enabled: false }; }
}
function saveConfig(c, profileId) { try { localStorage.setItem(LS_KEY(profileId), JSON.stringify(c)); } catch { /* ignore */ } }
export const isEnabled = () => { const c = getConfig(); return !!(c.enabled && c.url && c.anonKey && c.access); };

// `retried` is an internal flag (one refresh-and-retry per call), never a wire header
async function api(path, { method = 'GET', body = null, auth = true, headers = {}, retried = false, profileId = store.current.id } = {}) {
  const c = getConfig(profileId);
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
    if (res.status === 401 && auth && c.refresh && !retried) { await refreshToken(profileId); return api(path, { method, body, auth, headers, retried: true, profileId }); }
    throw new Error((json && (json.msg || json.message || json.error_description || json.error)) || `HTTP ${res.status}`);
  }
  return json;
}
// remember why the last sync failed so the profile card can show it (auto pushes have no other UI)
function noteError(err, profileId) { const c = getConfig(profileId); c.lastError = String((err && err.message) || err || 'Sync failed'); saveConfig(c, profileId); return err; }
const remoteFingerprint = value => JSON.stringify(value);
function sameLearner(profileId,learnerId) {
  return (store.current?.id===profileId?store.current.learnerId:store.profiles.find(p=>p.id===profileId)?.learnerId)===learnerId;
}
function syncBoundary(profileId,learnerId,accountId) {
  const c=getConfig(profileId);
  if(store.current.id!==profileId||store.current.learnerId!==learnerId||!c.enabled||c.userId!==accountId)
    throw new Error('Profile changed during sync; retry for the current profile.');
}
function beginAuthentication(profileId,learnerId) {
  const c=getConfig(profileId),requestId=Math.random().toString(36).slice(2)+Date.now().toString(36);
  c.authRequestId=requestId;c.boundLearnerId=learnerId;saveConfig(c,profileId);return requestId;
}

function storeSession(data, profileId,{learnerId,requestId,accountId}={}) {
  if (!data || !data.access_token) throw new Error('The server returned no session');
  const c = getConfig(profileId);
  if((learnerId&&!sameLearner(profileId,learnerId))||(requestId&&c.authRequestId!==requestId)||(accountId&&c.userId!==accountId))
    throw new Error('The learner or sign-in changed while connecting. Sign in again for the intended user.');
  const uid = data.user?.id || c.userId;
  if (uid !== c.userId) { c.lastSync = 0; c.lastRemote = ''; } // a different account: its cloud copy must be merged in full, whatever the old lastSync was
  c.access = data.access_token; c.refresh = data.refresh_token; c.userId = uid; c.email = data.user?.email || c.email; c.enabled = true; c.lastError = '';
  saveConfig(c, profileId);
}
export async function configure(url, anonKey) {
  const c = getConfig();
  let u = url.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u; // a pasted "xxxx.supabase.co" would otherwise be fetched relative to the app
  c.url = u; c.anonKey = anonKey.trim(); saveConfig(c);
}
export async function signUp(email, password) {
  const pid = store.current.id,learnerId=store.current.learnerId,requestId=beginAuthentication(pid,learnerId);
  const data = await api('/auth/v1/signup', { method: 'POST', body: { email, password }, auth: false, profileId: pid });
  if (data && data.access_token) { storeSession(data, pid,{learnerId,requestId}); return { ok: true, confirmed: true }; }
  const c = getConfig(pid);
  if(!sameLearner(pid,learnerId)||c.authRequestId!==requestId)throw new Error('The learner or sign-in changed while connecting. Try again for the intended user.');
  c.email = email; saveConfig(c, pid);
  return { ok: true, confirmed: false };
}
export async function signIn(email, password) {
  const pid = store.current.id,learnerId=store.current.learnerId,requestId=beginAuthentication(pid,learnerId);
  const data = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false, profileId: pid });
  storeSession(data, pid,{learnerId,requestId});
  return data;
}
async function refreshToken(profileId) {
  const c = getConfig(profileId);
  const data = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: c.refresh }, auth: false, profileId });
  storeSession(data, profileId,{learnerId:c.boundLearnerId,accountId:c.userId});
}
export function signOut() { clearTimeout(pushTimer); const c = getConfig(); c.access = ''; c.refresh = ''; c.userId = ''; c.enabled = false; c.lastSync = 0; c.lastRemote = ''; c.lastError = '';c.authRequestId='';c.legacyClaim=null;c.associationRequired=false; saveConfig(c); }

export async function pull(profileId = store.current.id) {
  const c = getConfig(profileId);
  const rows = await api(`/rest/v1/parola_profiles?select=data,updated_at,revision&user_id=eq.${c.userId}`, { profileId });
  return rows && rows[0] ? rows[0] : null;
}
export async function push() { if (isEnabled()) return syncNow(); }
// All writes merge evidence, then use an atomic revision check. The SQL trigger
// rejects old clients' blind UPSERTs. There is deliberately no unsafe fallback.
const inflight = new Map();
export function syncNow() {
  if (!isEnabled()) return Promise.reject(new Error('Cloud sync is not set up'));
  const pid = store.current.id;
  const learnerId=store.current.learnerId,accountId=getConfig(pid).userId;
  if (inflight.has(pid)) return inflight.get(pid);
  clearTimeout(pushTimer);
  const task = (async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const remote = await pull(pid);
      syncBoundary(pid,learnerId,accountId);
      if(remote?.data) {
        const remoteLearner=remote.data.learnerId,c=getConfig(pid);
        const claimed=!remoteLearner&&c.legacyClaim?.revision===remote.revision&&c.legacyClaim?.fingerprint===remoteFingerprint(remote.data);
        if((!remoteLearner&&!claimed)||(remoteLearner&&remoteLearner!==learnerId)) {
          c.associationRequired=true;c.remoteLearnerName=remote.data.name || 'the saved learner';saveConfig(c,pid);
          throw new Error(remoteLearner?'This cloud account contains a different learner. Your local progress is kept. Choose Use cloud learner only to restore that learner on this device.':'This older cloud backup has no learner identity. Your local progress is kept. Choose Use cloud learner to associate it deliberately.');
        }
      }
      if (remote?.data) await store.importJSON(JSON.stringify({ profile: remote.data }), { merge: true, silent: true });
      syncBoundary(pid,learnerId,accountId);
      await store.saveNow();
      syncBoundary(pid,learnerId,accountId);
      const snapshot = JSON.parse(JSON.stringify(store.current));
      // Resume positions are device-local. Evidence and course preferences are shared.
      if (snapshot.learning) { snapshot.learning.session = null; snapshot.learning.sessions = {}; }
      const saved = await api('/rest/v1/rpc/parola_save_profile', { method: 'POST', profileId: pid, body: { p_expected_revision: remote?.revision ?? -1, p_data: snapshot } });
      syncBoundary(pid,learnerId,accountId);
      if (saved?.conflict) continue;
      if (!saved || typeof saved.revision !== 'number') throw new Error('The sync server returned an invalid revision.');
      const config = getConfig(pid);
      config.lastSync = Date.now(); config.lastRemote = saved.updated_at; config.lastError = '';config.boundLearnerId=learnerId;config.legacyClaim=null;config.associationRequired=false;
      saveConfig(config, pid);
      if (store.current.id === pid) { store.emit('profile', store.current); store.emit('synced'); }
      return true;
    }
    throw new Error('Another device is still syncing. Your local progress is kept; try again shortly.');
  })().catch(err => {
    if (/revision.*does not exist|parola_save_profile|schema cache/i.test(err.message)) err = new Error('Update cloud sync using Show setup SQL below, then retry. Your progress remains on this device.');
    throw noteError(err, pid);
  }).finally(() => { inflight.delete(pid); });
  inflight.set(pid, task);
  return task;
}
// An explicit restore action; authentication alone never adopts/merges another
// learner. The store preserves a verified recovery copy before replacing data.
export async function useCloudLearner() {
  if(!isEnabled())throw new Error('Sign in first.');
  const pid=store.current.id,learnerId=store.current.learnerId,accountId=getConfig(pid).userId;
  const remote=await pull(pid);syncBoundary(pid,learnerId,accountId);
  if(!remote?.data)return syncNow();
  const profile=JSON.parse(JSON.stringify(remote.data));
  profile.learnerId ||= 'legacy:'+(profile.id || accountId);
  await store.importJSON(JSON.stringify({profile}));
  if(store.current.id!==pid||getConfig(pid).userId!==accountId)throw new Error('Profile changed while restoring the cloud learner.');
  const c=getConfig(pid);c.boundLearnerId=profile.learnerId;c.associationRequired=false;
  c.legacyClaim=remote.data.learnerId?null:{revision:remote.revision,fingerprint:remoteFingerprint(remote.data)};
  saveConfig(c,pid);
  return syncNow();
}
export function schedulePush() {
  if (!isEnabled() || !navigator.onLine) return;
  clearTimeout(pushTimer);
  const pid = store.current.id;
  pushTimer = setTimeout(() => { if (store.current.id === pid) syncNow().catch(() => { /* visible in Cloud sync */ }); }, 15000);
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

export const SETUP_SQL = `create table if not exists public.parola_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  revision bigint not null default 0
);
alter table public.parola_profiles add column if not exists revision bigint not null default 0;
alter table public.parola_profiles enable row level security;
grant select, insert, update on public.parola_profiles to authenticated;
drop policy if exists "own profile" on public.parola_profiles;
create policy "own profile" on public.parola_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.parola_guard_revision() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.revision <> old.revision + 1 then
    raise exception 'Update Parola on this device before syncing (revision required).';
  end if;
  return new;
end;
$$;
drop trigger if exists parola_revision_guard on public.parola_profiles;
create trigger parola_revision_guard before update on public.parola_profiles
for each row execute function public.parola_guard_revision();

create or replace function public.parola_save_profile(p_expected_revision bigint, p_data jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare saved public.parola_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if jsonb_typeof(p_data) <> 'object' or p_data is null then raise exception 'Invalid profile'; end if;
  if p_expected_revision = -1 then
    insert into public.parola_profiles(user_id, data, revision, updated_at)
    values(auth.uid(), p_data, 0, now()) on conflict (user_id) do nothing
    returning * into saved;
  else
    update public.parola_profiles set data = p_data,
      revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = p_expected_revision
    returning * into saved;
  end if;
  if saved.user_id is null then return jsonb_build_object('conflict', true); end if;
  return jsonb_build_object('conflict', false, 'revision', saved.revision, 'updated_at', saved.updated_at);
end;
$$;
revoke all on function public.parola_save_profile(bigint, jsonb) from public;
grant execute on function public.parola_save_profile(bigint, jsonb) to authenticated;`;
