# Written conversation accent policy: bounded next slice

Read-only design, 3 October 2026. No implementation, registry, model or provider activation is approved by this note. It addresses [the shared accent contract](../../PLAN-UNIFIED-LEARNING-OFFLINE-AI-2026-10-03.md#consistent-accent-handling-everywhere) and ledger item `P5-conversation-accents`.

## Observed current gap

`createConversationController.send()` commits immutable `originalText`/`submittedText` and a `policySnapshot.strictAccents` value before inference. `reply()` currently sends `learner.displayText` and recognition uncertainty, but not that saved policy, the exact source turn identity or full input provenance. Existing validated grammar corrections do not implement supported spelling-only display restoration. `compareSubmission()` already supplies the shared NFC/accent comparison, matched answer, differences, original input, display text and submitted setting.

`storage.reviseTurn()` preserves original text/history but also increments the thread's content revision and cancels pending generation. Calling it between `beginGeneration()` and partner `commitTurn()` would invalidate that reply token. Display restoration and partner commit therefore need one explicit transaction or an independently validated pre-generation spelling operation. A late unchecked second write is unsuitable.

## Proposed service boundary

Keep spelling interpretation outside model-authored reply JSON. Add an optional installed-provider `accentPolicy.checkInput` contract, backed by a versioned reviewed source registry and an independent contextual verifier. Absence of that adapter means unsupported spelling checking, preserving the original message; it must not create a ready production provider or a canned reply.

The controller should pass a bounded immutable input descriptor with the reply request:

```
inputSubmission: {
  turnId, revision, originalText, submittedText, displayText,
  policySnapshot, inputProvenance
}
```

Use the turn's saved `strictAccents` setting, never a later Settings value. Require agreement between request text, descriptor display text and source turn revision. Unknown/missing historical policy cannot silently become permissive policy or trigger retrospective regrading.

The adapter may propose a complete accent-only spelling candidate and source identities, or unresolved/ambiguous status. A pure shared validator should independently require:

- Exact source descriptor and unchanged base text/revision; bounded plain data.
- Same case-sensitive NFC text except permitted vowel accent changes, preserving whitespace, punctuation, capitalization, apostrophes, order, words, numbers, names and negation. The shared comparison is necessary but not sufficient: its normalized equality also tolerates case/spacing, so an additional exact accent-fold equality must reject those rewrites.
- `compareSubmission(original, supportedCandidate, savedPolicy)` for the actual comparison/result; do not implement another accent tolerance rule.
- A real reviewed spelling/form source, exact source revision and a context verifier confirming that interpretation at each changed word. `languagePolicy.validate(candidate)` alone does not prove preservation of the original meaning: two accented homographs may both form grammatical sentences.
- No model-defined source IDs, fetch URLs, explanation or verdict. Dictionary token matching alone cannot authorize a grammatical `e → è` interpretation or turn an unrecognized proper name into a common noun.

Return a separate bounded validated `inputSpelling` receipt. Proposed fields are source turn/revision, original/base display text, shared submission result, decision (`restore-display`, `spelling-feedback`, `clarify`, `unsupported`, `unchanged`), input origin and source registry/version/IDs. Do not mark free chat correct, produce XP, award spelling mastery, change completion or infer a learner level. The receipt records supported spelling/display treatment only.

NFC normalization and offsets need an explicit contract: the shared comparison's differences refer to NFC source text. Preserve raw immutable input and include the NFC comparison base; the view may highlight the normalized display offsets. Do not apply those offsets blindly to a decomposed raw string. Imported receipts remain data until independently revalidated against the exact source/version, or are displayed only as historical audit text without restoration authority.

## Display and storage handoff

For Strict accents off, a context-verified accent-only candidate can update the same learner bubble without another send or confirmation. Preserve immutable original/submitted text, saved policy and the validated receipt; expose “Accent added” and original text through the existing message history/details. This is not a semantic edit or assessed success.

For Strict accents on, retain the submitted bubble and show source-derived spelling feedback through the existing edit/retry flow. The learner can explicitly edit the message; that creates the ordinary revision and preserves the original submission policy/history. No automatic rewrite or correctness credit occurs.

Prefer a root-owned atomic `commitValidatedReply`/narrow `commitTurn` extension that verifies the pending generation token, original learner turn/revision and validated spelling receipt, then commits the learner display-only revision and partner turn together. It must update thread/source revisions consistently, preserve history and attach subsequent correction references to the actual final learner revision. Rebuild summary from committed content. Any failure leaves the already committed learner message recoverable; generation retry must never resend it. Cancellation, navigation, owner/learner/epoch replacement, a newer edit or another window's send rejects the whole stale operation.

An alternative is a pure verified spelling preflight before `beginGeneration()`, followed by an owner/source-guarded display operation and refreshed source token. This is viable only if its language-source adapter is independently available without waiting for model inference. It still requires durable source/policy receipts and must not rewrite an unrelated draft while its check is pending.

Root owns controller/storage/view integration. programme_ai can own the pure accent validator, request/result contract and deterministic tests after checkpoint release. No current root-owned file is changed by this design.

## Recognition and explicit edits

Recognized text carries its own spelling. A recognizer's missing accent is not the learner's spelling error; an inserted accent is not spelling mastery. `recognitionUncertain` must not be the only origin check: confirming a transcript currently clears uncertainty without converting recognized words into typed choices.

Keep `recognizedText` and exact `transcriptEdits` separate. A typed spelling classification must be supported by the edit chain and the changed word/character, not merely by the existence of any edit elsewhere in the transcript. For unverifiable legacy/imported chains or mixed origins, use recognition/unknown origin and do not penalize spelling. A bounded initial implementation can conservatively decline strict spelling feedback on mixed spans until attribution is supported; it should record that limitation rather than claim full explicit-edit coverage.

## Required regressions

| Case | Expected result |
| --- | --- |
| Supported contextual `Vorrei un caffe.`; strict off | Same bubble displays `caffè`; original and saved policy retained; no attempt/mastery |
| Same text; strict on | Original bubble retained, source-derived spelling feedback |
| Supported `perche/perché`, uppercase and composed/decomposed Unicode | Shared comparison and correct display offsets; raw original preserved |
| Valid conjunction `e` | Unchanged |
| Ambiguous `e/è`, `si/sì`, `da/dà` without a supported interpretation | No automatic change; clarification/unresolved result |
| Model changes case, space, apostrophe, word, person, quantity or negation | Rejected as a non-accent rewrite |
| Proper name resembling an unaccented lemma | Context verifier required; otherwise unchanged/unsupported |
| Recognized `caffe`, even after Confirm | No spelling penalty or mastery claim |
| Accent explicitly removed by keyboard vs unrelated transcript edit | Distinguishable origin; unrelated edit cannot make ASR spelling typed |
| Settings changes while inference is pending | Original submission setting wins |
| Navigation/profile/learner/epoch/edit/provider race or replay | No stale restoration; deterministic receipt/transaction cannot duplicate |
| Partner commit fails or generation retry occurs | Learner original retained; no resend, partial rewrite or duplicate evidence |
| Reload/import/summary rebuild | Restored display and immutable original/policy/history remain coherent; imported authority revalidated |

Real source registry/context interpretation, production Italian quality and installed-device gates remain separate. Synthetic test verifiers can prove the transaction and shared-policy contract, not real contextual language quality.
