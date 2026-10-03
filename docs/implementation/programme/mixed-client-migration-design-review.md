# v5 and v6 simultaneous-client migration review

Read-only design audit by the learning workstream on 3 October 2026. Baseline is the actual installed-release source at `7eeeb36fee685ee0d7e3abd62f1499d51dee59cb`; this audit does not claim an installed-device update test.

## Finding

The original same-namespace migration has a release correctness blocker. An already-open v5 tab retains its own v5 profile object. Its `saveNow()` writes that full object to `italiano-db/kv/profile:<id>` without comparing the stored schema or primary revision. After the new client migrates and saves new v6 evidence, a delayed old answer, setting, timer, visibility handler or unload save can replace that primary with its earlier v5 snapshot. The verified pre-update backup does not contain work earned after migration.

A second path is the shared `it.pendingProfile` mirror. Baseline `_mirrorPending()` saves a dirty v5 snapshot during `pagehide`. New `switchProfile()` originally preferred any valid mirror over the disk primary. It could then migrate that stale mirror while correctly comparing against the current v6 `primaryBefore`, so the transactional comparison passes even though the chosen source discards newer work.

The baseline already preserves a future learning payload in `normalizeLearning()`, and its import/merge path refuses schema 6. A fresh v5 normalization therefore does **not** automatically strip every v6 learning field. The demonstrated design concern is a writer that loaded earlier, and unrestricted full-profile replacement. These cases must remain distinguished.

The baseline worker calls `skipWaiting()` and `clients.claim()`. The app records `controllerchange` and reloads on the next route render. This limits mixed module imports; it does not fence existing answer, save, timer or `pagehide` callbacks. A message, lock or guard implemented only in the new app cannot require already shipped v5 code to cooperate. A database version bump would also depend on closing old connections; baseline does not register a `versionchange` close handler.

## Approved isolation contract

Root selected physically separate v6 storage:

- IndexedDB `italiano-db-v6`, with its own `kv` store.
- Fallback records `kv6:<key>`.
- Roster, selected profile and unsaved mirror `it.v6.profiles`, `it.v6.currentProfile` and `it.v6.pendingProfile`.

The legacy database, fallback records and `it.*` keys remain untouched and usable by the old client. The first v6 roster copies exact legacy metadata and marks those imported roster members `legacySource:true`. Only a member with that provenance and no authoritative v6 primary may read its original legacy primary/pending snapshot. A legacy slot already containing schema 6 must also copy once without reducing its payload or losing its earlier verified recovery.

Cutover writes the original snapshot, its SHA-256/learner metadata and the normalized candidate atomically into the **new** database before the candidate becomes active. The source is read from the legacy database and the target must still be absent; a source or target race must fail safely or have a documented transaction ordering. Fallback storage cannot promise a multi-key transaction and must retain its verified source on failure.

Once a v6 primary exists, an old primary or mirror is never preferred on boot, save, profile switch, restore or ordinary synchronization. A later old-client snapshot is separate recovery, with a deliberate export/import path and source schema/learner metadata. Timestamps alone do not establish ancestry. The v6 roster and deletion/cutover metadata must prevent an old legacy index or resurrected old primary from recreating a deleted v6 profile.

The normal baseline cloud path pulls before compare-and-swap writes and rejects a schema-6 import, so an old client observing the new cloud payload stops. Its raced earlier revision conflicts and retries. The SQL revision trigger rejects blind old upserts. A monotonic supported learning-schema check on the server is still useful defense against a correctly revisioned downgrade; it is distinct from the proven normal client path.

## Required regression evidence

The new `tests/mixed-client-migration-e2e.mjs` serves the immutable baseline app and current app on the **same origin** in two pages of one browser context. It executes baseline `store.saveNow()` and `_mirrorPending()` rather than impersonating an old writer with a copied v6 store. The controlled test blocks service workers so the client versions remain deliberately simultaneous; actual installed worker activation remains a separate release gate. Fallback fixtures override `IDBFactory.prototype.open` and assert actual persisted `kv:`/`kv6:` profiles, avoiding WebKit's per-instance factory-wrapper difference.

1. Preserve initial exact v5 profile, drafts, checks and XP in the verified recovery, and create the authoritative v6 primary without editing the old primary.
2. Save new v6 evidence, then save a conflicting actual v5 snapshot; reload and retain all new v6 evidence/XP/cursor and the separate legacy recovery.
3. Write the actual baseline dirty unload mirror after cutover; new boot must retain its v6 primary and leave old recovery separately discoverable.
4. Mutate/delete legacy roster data after cutover; active v6 identity and roster stay unchanged. Delete a v6 profile and verify a later old save cannot resurrect it automatically.
5. Reset v6 progress, then execute old saves; the authoritative reset epoch and completion fences survive.
6. Recover a genuinely new v6 unsaved mirror independently of the legacy mirror. New saves must not clear an unrelated old snapshot.
7. Cover failed/competing target commits and localStorage fallback separately, including future-schema rejection and a legacy slot already containing v6.

## Implemented isolation and independent checks

Root implemented the approved physical namespace, one-time source provenance, exact SHA-256-protected original and alternative-source container, and owner-guarded `previousAppBackups()` exports. A legacy slot already containing schema 6 preserves its verified earlier schema-5 recovery. A later old snapshot stays a separate exportable copy; it never replaces the existing authoritative v6 primary. The initial selected mirror's alternative primary is also retained rather than discarded.

Independent source review found two fallback transitions during implementation. A legacy fallback had to remain a candidate even when reopening IndexedDB created an empty old database. The current v6 fallback also had to be promoted before legacy lookup when IndexedDB later became available; otherwise already-earned v6 progress could be replaced with the older v5 source. Root corrected both, with an exact, verified promotion that rechecks the target in its write transaction. Deletion removes matching profile and recovery copies in both databases and both fallback namespaces.

The browser suite has **13 passing checks in Chromium and WebKit**, recorded in `mixed-client-migration-chromium.json` and `mixed-client-migration-webkit.json`. It covers exact original preservation, late actual baseline writes/mirrors, separate genuine v6 pending recovery, initial mirror preference with alternative-primary export, actual old/new fallback storage, fallback-to-available transitions, old roster/delete independence, reset epoch retention, v6 deletion without automatic resurrection, and provisional legacy schema-6 recovery. Failed competing commits and verification/rollback failures have separate six-check browser evidence in `learning-v6-migration-{chromium,webkit}.json`.

An already-open old tab still holds its own in-memory data and can write a new **legacy** copy after deletion; the test proves that this cannot recreate the deleted authoritative v6 user. Erasing data already loaded in another uncooperative historical tab cannot be guaranteed by new-client code. Installed-device worker activation, phone storage behavior and complete release rehearsal remain open gates. This review establishes controlled source-generation isolation and recovery behavior, not a completed release.
