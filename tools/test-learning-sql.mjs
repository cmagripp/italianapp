#!/usr/bin/env node
// Execute the actual setup SQL in an isolated PostgreSQL engine. No Supabase account is contacted.
// PGLITE_DIR points to a directory with node_modules/@electric-sql/pglite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const modulePath = require.resolve('@electric-sql/pglite', { paths: [process.env.PGLITE_DIR || process.cwd()] });
const { PGlite } = await import(pathToFileURL(modulePath));
const db = new PGlite();
const src = fs.readFileSync(new URL('../js/sync.js', import.meta.url), 'utf8');
const sql = src.match(/export const SETUP_SQL = `([\s\S]*?)`;/)?.[1];
assert(sql, 'setup SQL exists');
const a = '11111111-1111-1111-1111-111111111111', b = '22222222-2222-2222-2222-222222222222';
let checks = 0;
const check = async (name, action) => { await action(); checks++; console.log('✓', name); };
try {
  await db.exec(`create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${a}'), ('${b}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.parola_profiles(user_id uuid primary key references auth.users(id), data jsonb not null, updated_at timestamptz not null default now());
    insert into public.parola_profiles values ('${a}', '{"legacy":true}', now());`);
  await check('migration upgrades a legacy table and can run twice', async () => {
    await db.exec(sql); await db.exec(sql);
    assert.equal((await db.query('select revision from parola_profiles')).rows[0].revision, 0);
  });
  await db.exec('set role authenticated');
  const signIn = id => db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  const save = async (revision, data) => (await db.query('select public.parola_save_profile($1, $2::jsonb) as result', [revision, JSON.stringify(data)])).rows[0].result;
  await signIn(a);
  await check('authenticated owner atomically updates the expected revision', async () => {
    const saved = await save(0, { learning: { events: { first: { ok: true } } } });
    assert.equal(saved.conflict, false); assert.equal(saved.revision, 1);
  });
  await check('a stale concurrent writer returns a conflict and leaves evidence intact', async () => {
    assert.equal((await save(0, { stale: true })).conflict, true);
    const row = (await db.query('select data, revision from parola_profiles')).rows[0];
    assert(row.data.learning.events.first); assert.equal(row.revision, 1);
  });
  await check('old blind UPSERT clients cannot overwrite the upgraded row', async () => {
    await assert.rejects(db.query(`insert into parola_profiles(user_id,data) values ($1,'{}') on conflict(user_id) do update set data=excluded.data, revision=excluded.revision`, [a]), /revision required/);
  });
  await check('invalid profile data is rejected', async () => {
    await assert.rejects(save(1, []), /Invalid profile/);
    await assert.rejects(save(1, null), /Invalid profile/);
  });
  await check('RPC preserves grammar evidence, drafts, and completion tombstones without a schema change',async()=>{
    const completions={'v:andare|present':{entryId:'v:andare',caseId:'present',checked:false,at:10,id:'uncheck'},'v:andare|past':{entryId:'v:andare',caseId:'past',checked:true,at:11,id:'check'}};
    const grammar={kind:'grammar',policy:'grammar-v1',objectiveId:'a1-test.focus',entryId:'g:a1-test',ok:true};
    const sessions={'g:a1-test|lesson':{entryId:'g:a1-test',grammar:{draft:'Una bozza',phase:'question'}}};
    assert.equal((await save(1,{learning:{version:4,completions,events:{first:grammar},sessions,preferences:{courseLevel:'A2'}}})).conflict,false);
    const row=(await db.query('select data from parola_profiles')).rows[0];assert.deepEqual(row.data.learning.completions,completions);assert.deepEqual(row.data.learning.events.first,grammar);assert.deepEqual(row.data.learning.sessions,sessions);assert.equal(row.data.learning.preferences.courseLevel,'A2');
  });
  await check('RPC preserves v5 facet evidence and personal portfolio metadata alongside legacy sessions',async()=>{
    const previous=(await db.query('select data from parola_profiles')).rows[0].data;
    const updated={...previous,learning:{...previous.learning,version:5,events:{...previous.learning.events,v2:{policy:'grammar-v2',contentVersion:2,outcome:'ungraded',grammarPhase:'portfolio',facet:'register',requiredFacets:['register','reference'],completedTargets:[],assistance:[]}},sessions:{...previous.learning.sessions,'g:v2-example|lesson':{courseV2:{version:2,phase:'step',draft:'La mia risposta',portfolios:{output:{draft:'Testo personale',criteria:[0],recording:{key:'local-only-reference'}}}}}}}};
    assert.equal((await save(2,updated)).conflict,false);
    assert.deepEqual((await db.query('select data from parola_profiles')).rows[0].data,updated);
  });
  await check('RPC retains version-six review scheduling and distinct finite-session identities',async()=>{
    const previous=(await db.query('select data from parola_profiles')).rows[0].data;
    const updated={...previous,learning:{...previous.learning,version:6,events:{...previous.learning.events,review:{id:'review',reviewPolicy:'unified-review-v1',canonicalObjectiveId:'w:casa|noun::lesson::forms::article',mappingVersion:1,mode:'recognition',ok:true}},sessions:{...previous.learning.sessions,'review:one':{id:'one',mode:'review',review:{version:1,draft:'caffè',submittedPolicy:{strictAccents:false}}},'review:two':{id:'two',mode:'review',review:{version:1}}}}};
    assert.equal((await save(3,updated)).conflict,false);
    assert.deepEqual((await db.query('select data from parola_profiles')).rows[0].data,updated);
  });
  await signIn(b);
  await check('a different account cannot read or write another account’s row', async () => {
    assert.equal((await db.query('select * from parola_profiles')).rows.length, 0);
    assert.equal((await db.query('update parola_profiles set data=\'{}\',revision=revision+1 returning user_id')).rows.length, 0);
    await assert.rejects(db.query('insert into parola_profiles(user_id,data) values ($1,\'{}\')', [a]), /row-level security/);
  });
  await check('first save inserts once and a duplicate initial revision conflicts', async () => {
    assert.equal((await save(-1, { first: true })).revision, 0);
    assert.equal((await save(-1, { duplicate: true })).conflict, true);
    assert.equal((await db.query('select data from parola_profiles')).rows[0].data.first, true);
  });
  await signIn('');
  await check('an unauthenticated RPC cannot save', async () => {
    await assert.rejects(save(-1, {}), /Sign in first/);
  });
  console.log(`\n${checks} PostgreSQL migration/RLS/revision checks passed (isolated PGlite).`);
} finally { await db.close(); }
