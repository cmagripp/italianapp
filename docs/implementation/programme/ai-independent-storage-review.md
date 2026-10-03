# Independent storage and migration review

This read-only review was requested after the AI comparisons. Root owns the conversation/profile implementation and all fixes. Synthetic fixtures use isolated learner/profile IDs or in-memory Maps; no user data was accessed or changed.

## Conversation follow-up

The existing five dictionary-backed summary checks and all seventeen storage/browser tests passed independently in Chromium and WebKit, including 120 turns, exact draft reload, conflicting/idempotent sends, quota rollback, owner changes, portable optional audio including eight MiB, merge ancestry, deletion privacy and snapshots. Those existing tests did not cover four additional isolated findings recorded in [ai-conversation-audit.json](ai-conversation-audit.json):

1. Reusing an existing audioId for another turn/bytes overwrote the recording while the first turn retained that ID.
2. A current turn/revision allowed a derived vocabulary source reference with an impossible end offset and unrelated quote.
3. A verified but permissive correction predicate could create a summary note reversing negation/quantities.
4. A verified rule with no source could create an unsourced teaching summary.

Root fixed all four; the retained JSON shows the pre-fix reproduction. The independent [after report](ai-conversation-audit-after.json) confirms a conflicting recording identity is rejected with the first bytes/turn retained, wrong quote/range rejected, protected-meaning reversal rejected and missing-source correction omitted. `preservesProtectedMeaning(original,replacement,protectedNames=[])` is exported by the AI validator for shared correction/summary checks. It protects only explicit fragment features, not full semantic correctness. No summary/storage production source was edited by this reviewer.

## v6 boot migration review

The IndexedDB migration design is sound in its core transaction boundary: recovery copy, exact readback, candidate primary, exact candidate readback and recovery pointer share one readwrite transaction. Existing primary comparison prevents applying a candidate to an already-changed source. The old-schema snapshot is a full profile, retaining session drafts, events, completion checks, items, lists, custom words and XP rather than a reduced evidence projection. The app catches migration failure before mounting normal UI and offers the exact original export plus retry. Future learning schemas are rejected before normalization. Normal v5 migration and snapshot/write/verification failures passed the current four browser checks independently in both Chromium and WebKit.

The following helper/fallback gaps were independently reproduced and reported to root. [Synthetic cases](ai-profile-migration-audit.json) and the repeatable `dev/phase-1-ai-trial/profile-migration-audit.mjs` preserve the pre-fix state.

1. **Fallback changed source:** the localStorage path compares the primary only before saving and verifying recovery. A changed primary during recovery verification is then overwritten by the prepared candidate. Recheck source immediately before replacement and serialize when possible. Multiple localStorage keys do not acquire IndexedDB's atomic cross-tab transaction guarantee merely because each individual setItem is synchronous.
2. **Rollback reporting/recoverability:** after a successful candidate write, a failing pointer write followed by failed rollback leaves v6 primary active while the error says the previous copy is kept; there is no latest-recovery pointer. Preserve a verified recovery pointer before replacement or otherwise make the recovery copy discoverable, and expose rollback failure distinctly with the original export.
3. **Source scope:** the helper accepts source/candidate `id` values different from the requested profile slot. Such a candidate is written under the wrong key and the snapshot still verifies. Validate expected profile and stable learner scope before any write. The current boot caller constructs the normal candidate from the source clone, but the helper should reject inconsistent input explicitly.

## Hash and ownership scope critique

The pre-fix checksum was FNV32 over JSON, accompanied by an exact serialized readback during initial preservation. FNV32 was neither a cryptographic hash nor an ownership or source identity proof, and the later verifier did not validate the metadata envelope. This historical limitation is retained to explain the finding.

Root replaced it with an async SHA-256 digest of the complete saved profile and explicit version/policy/kind/hash-algorithm/profile/learner metadata validation. Initial snapshot verification compares the whole saved envelope exactly inside the transaction. Source/candidate profile and learner identities are validated before writes; the recovery pointer carries learner scope. The fallback writes its verified recovery pointer before attempting the candidate and rechecks the primary after backup preparation. A failed rollback has a distinct warning and still exposes the original export.

The independent [migration after report](ai-profile-migration-audit-after.json) confirms the raced remote draft stays active at v5 and the migration rejects; wrong profile scope rejects without writes; pointer-write failure now occurs before replacing the old primary. Root additionally reports expanded six-per-browser coverage including actual verification failure plus failed rollback with a discoverable snapshot. The earlier four-per-browser independent checks and the pre-fix fixtures remain separate evidence. localStorage still has no atomic multi-key cross-tab transaction; installed-device and complete backup gates remain recorded.

The ordinary import path prepares a normalized candidate off-screen and retains a pre-replacement copy, but uses separate KV writes rather than the boot migration's atomic transaction. It checks in-memory expected identity/revision before activation and attempts rollback on verification or concurrent edits. Failed rollback already has a distinct warning there. Merge refuses a different learner; explicit Replace adopts the saved learner in the current profile slot. `recoveryBackup()` can deliberately contain the previous learner after Replace; any UI offering it needs to make that recovery scope clear rather than presenting it as the current learner's backup. Snapshot/profile removal cleanup and ownership of older recovery pointers should be tested as part of the complete backup integration.

The historical four-test suite did not cover metadata/scope mismatch, fallback changed-source races or failure after the candidate write plus failed rollback; the fixes and expanded root tests address these. Additional integration gates include ownership loss during asynchronous migration, pending-mirror source precedence and a complete migration-backup export/import round trip. Installed-device interruption, quota, cross-tab behavior and full application backup remain separate gates.
