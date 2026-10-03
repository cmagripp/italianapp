// Read-only code review fixture: operates entirely on synthetic Maps. It never
// opens the real profile database or modifies a user's browser storage.
import { writeFile } from 'node:fs/promises';
import { migrateStoredProfile, verifyMigrationSnapshot } from '../../js/learning/migrate-profile.js';
const results = { measuredAt: new Date().toISOString(), synthetic: true, cases: {} };
for (const mode of ['raced-primary', 'rollback-fails', 'wrong-profile-scope']) {
  const original = { id: 'expected', learnerId: 'learner:one', learning: { version: 5 }, draft: 'original' };
  const candidate = { ...original, learning: { version: 6 } }, values = new Map([['kv:profile:expected', JSON.stringify(original)]]);
  let raced = false, written = false;
  const storage = {
    getItem(key) {
      if (mode === 'raced-primary' && key.startsWith('kv:migration:') && !raced) {
        raced = true; values.set('kv:profile:expected', JSON.stringify({ ...original, draft: 'new remote draft' }));
      }
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (mode === 'rollback-fails' && key.startsWith('kv:migration-latest:')) throw Error('pointer write failed');
      if (mode === 'rollback-fails' && key === 'kv:profile:expected' && written && JSON.parse(value).learning.version === 5) throw Error('rollback failed');
      values.set(key, value); if (key === 'kv:profile:expected') written = true;
    }, removeItem(key) { values.delete(key); },
  };
  let error;
  try {
    await migrateStoredProfile({ database: null, storage, profileId: 'expected', primaryBefore: original,
      original: mode === 'wrong-profile-scope' ? { ...original, id: 'other-profile' } : original,
      candidate: mode === 'wrong-profile-scope' ? { ...candidate, id: 'other-profile' } : candidate });
  } catch (failure) { error = failure.message; }
  results.cases[mode] = { error: error || null, current: JSON.parse(values.get('kv:profile:expected')),
    snapshots: await Promise.all([...values].filter(([key]) => key.startsWith('kv:migration:')).map(async ([key, value]) => {
      const snapshot = JSON.parse(value); return { key, verified: await verifyMigrationSnapshot(snapshot), profileId: snapshot.profile.id };
    })), pointer: values.get('kv:migration-latest:expected') || null };
}
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'ai-profile-migration-audit.json';
if (!/^ai-[a-z0-9-]+\.json$/.test(output)) throw Error('Use an ai- report filename');
await writeFile(new URL('../../docs/implementation/programme/' + output, import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
