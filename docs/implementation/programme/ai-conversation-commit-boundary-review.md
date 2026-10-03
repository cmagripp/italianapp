# Conversation generation commit boundary: independent reproduction

Read-only runtime assessment, 3 October 2026. Production provider remains absent. Both Chromium and WebKit reproduced the same three outcomes using an explicitly injected test-only provider, the actual controller/repository and native browser IndexedDB. The empty test dictionary supplies no teaching or grading authority. No runtime source was edited.

| Boundary | Persisted state | Callback/result |
| --- | --- | --- |
| Provider replaced while service response is pending | Learner only; content revision 1 | No partner callback or reply result |
| Provider replaced after the service response guard, immediately before the native partner transaction | Learner and old-provider partner; content revision 2 | Old reply returned and callback invoked once |
| Controller cancelled after native partner transaction creation, before its first IndexedDB read | Learner and partner; content revision 2 | No partner callback; reply result is null |

The first case demonstrates the existing runtime lease guard. The second demonstrates its limit: the guard cannot authorize a later write after its captured provider was replaced. The third demonstrates that cancellation can suppress publication while still allowing persistence. It is therefore insufficient to check only visible callbacks or the return value.

`acquireConversationService()` checks provider identity/revision before and after inference. `reply()` then checks its generation and owner before calling `commitTurn()`. Repository transactions check the repository owner and stored pending request/content revision; they have no per-generation provider/epoch predicate or cancellation signal. The written view's provider listener clears support and disposes an existing speech session, but has no direct written-controller cancellation when there is no speech session. Provider disposal after the response has already resolved does not invalidate this native transaction.

For explicit cancellation, `cancelGeneration()` starts a second write transaction. It is serialized behind the already active partner transaction over overlapping stores. Cancelling its pending token later cannot retroactively abort that first transaction. A future accent/display operation in that same transaction would share this gap; no accent rewrite was performed by this reproduction.

## Narrow required integration

Keep draft and ordinary local record writes independent of provider availability. Apply a **per-request** guard and `AbortSignal` only to generated partner/validated-spelling commit operations:

1. Capture provider revision with the generation epoch; require both to remain current through reply and commit.
2. Give the repository commit the same exact request/source predicate and signal. Check before/after database opening and transaction creation, after reads, and immediately before each queued write.
3. Register signal invalidation against the active native transaction and abort it while still active. Retain that listener until transaction completion/abort, then remove it. Guard-only checks at the start or rejection in `oncomplete` cannot undo a completed write.
4. Cancel/provider replacement must synchronously invalidate the request predicate and abort its signal before asynchronous pending-token cleanup. Do not await the second `cancelGeneration()` transaction to invalidate the first.
5. The upcoming atomic spelling+partner operation must verify the branded receipt, source learner revision, saved policy and pending token inside that same guarded transaction. Rejected or aborted work retains the durable learner original and no display-only partial edit. Recheck refs against the final learner revision on success.

Once the native transaction has committed, a later cancellation is a later operation, not evidence that an earlier committed record can be erased. Regression tests should exercise invalidation while opening, after transaction creation, between reads/writes and before completion, and inspect persisted records independently of UI results.

The frozen reproduction fixture is [conversation-commit-boundary-before.mjs](../../../dev/phase-1-ai-trial/conversation-commit-boundary-before.mjs). It intentionally records the before-state rather than asserting the missing behavior passed. Preserve its exact provider and scheduling fixture in the next asserting suite. Run from the repository with `BASE=http://127.0.0.1:8127/ node dev/phase-1-ai-trial/conversation-commit-boundary-before.mjs` and the normal Playwright dependency environment; use `COURSE_BROWSER=webkit` for WebKit. Runtime and fixture SHA-256 pins accompany the [Chromium evidence](ai-conversation-commit-boundary-before-chromium.json) and [WebKit evidence](ai-conversation-commit-boundary-before-webkit.json).

Root owns the transaction/controller integration in the immediately next Conversation accent slice. This report does not broaden the current checkpoint or approve a production model.
