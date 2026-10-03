# Source-bound written spelling receipts

Implemented on 2026-10-03 after checkpoint dcf2afa. This is independent service and validation plumbing; it provides no production contextual spelling registry, meaning verifier, model, cloud service or provider activation. Production readiness remains closed.

## Installed adapter and request

The new `js/ai/input-spelling.js` exports `checkedInputSubmission`, `assertInputSpellingRequest`, `createInputSpellingValidator`, `assertValidatedInputSpelling` and `isValidatedInputSpelling` (also re-exported by `js/ai/index.js`). Version is `INPUT_SPELLING_VERSION = 1`.

`createAIService({inputSpelling:{checkInput,validator}, ...})` accepts an explicitly installed checker and validator. `checkInput` receives a clone of the original request plus `{signal}`; it proposes data only. The validator is constructed with trusted `{registry,confirmInterpretation}`. Neither imported records nor generated JSON select the registry or verifier.

Conversation/Coach requests may supply this exact immutable `inputSubmission` descriptor:

```js
{
  turnId, revision, originalText, submittedText, displayText,
  policySnapshot, inputProvenance
}
```

All seven keys are required. `originalText` and `displayText` are strings; `submittedText` may be an explicit `null` for a historical missing submission. Policy/provenance are plain objects or explicit null. Source context is `{inputSubmission,scope,sourceRevision,protectedNames:[]}`; scope and content revision bind the descriptor exactly. The request text must equal saved display text. This source cannot accompany opening or authored-practice help requests.

Missing saved submission/policy yields an unsupported receipt while conversation generation continues using the actual original display text. Only saved `conversation-v1` policy with boolean `strictAccents` is supported. Typed/written origin is required. Recorded/handsfree/speech-transcript, any recognition/transcript-edit metadata, or uncertain recognition is unsupported for spelling attribution, including confirmed or explicitly edited ASR. This declines mixed-ASR penalties rather than relabelling them as typing.

## Meaning and reviewed form boundary

A candidate proposal is exactly `{status:'candidate',candidate,references:[{id,revision,start,end}]}`. Alternative statuses (`unchanged`, `clarify`, `unsupported`) carry no extra fields. Candidate/base are compared in NFC. Only accent differences are permitted: case, whitespace, punctuation, apostrophes, word order, negation and quantities must remain exact. Protected names are checked separately with NFC-normalized exact occurrence matching; their accents are never folded and immutable original input is preserved. This permits no blanket token replacement, including ambiguous `e` to `è`.

Every changed whole word requires exactly one source reference covering its NFC offsets. Registry lookup returns an exact reviewed row `{id,revision,source,reviewStatus,forms}` whose canonical form must match the candidate word. Supported review status is `independent-agent-review` or `independent-agent-review-passed`. The independent `confirmInterpretation` callback receives the full frozen source, both sentences, differences, reviewed rows, names and registry version. It must return literal true; otherwise the outcome is clarify without a display candidate. A dictionary match alone does not prove the intended meaning.

Rows are snapshotted before confirmation. Registry version is checked after asynchronous lookup and confirmation. An installed registry must change its epoch/version whenever underlying rows change; mutation behind an unchanged registry version cannot be detected independently by this module and remains an installed-adapter responsibility.

## Receipt and durable boundary

The deeply frozen receipt includes:

```js
{
  version:1, outcome,
  source:{scope,sourceRevision,inputSubmission},
  originalNFC, baseNFC, candidateNFC, effectiveText,
  differences, comparison, references, registryVersion,
  inputOrigin, reason,
  assessment:'spelling-display-only', masteryAwarded:false
}
```

Outcomes are `restore-display`, `spelling-feedback`, `unchanged`, `clarify`, `unsupported`. A module-private WeakMap brands the exact receipt identity against the complete source fingerprint. `assertValidatedInputSpelling(receipt,context)` must run before persistence. A spread copy, structured clone, JSON import or model-authored lookalike loses the brand. Persisted plain receipt data is historical provenance, never fresh authority. Assertions compare exact policy, original/submitted/display text, provenance, turn revision, scope and request revision, independent of object key order.

Strict-off verified accent-only proposals produce `restore-display` with corrected effective text and nonpenalty comparison. Strict-on produces `spelling-feedback`; effective text stays the saved original. No receipt awards mastery, creates learning evidence or schedules a case. Root owns atomic display/partner storage and UI; these changes do not independently assert that those integration paths passed.

## Service sequence

Preflight snapshots the original descriptor and checks currentness. It awaits the independent checker/validator, rechecks the original request after each await, and asserts the brand. Grounding, prompt generation, response correction-original checks, language validation, suggested reply validation and vocabulary indexing then use `effectiveText`. Currentness always uses the original request. Strict-off restoration therefore checks model corrections against the eventual corrected display, while root can map references to the final committed learner revision. Immutable submission evidence remains separate.

Checker failure (except cancellation) produces unsupported checking and retains original generation; a missing adapter also yields unsupported. Invalid source descriptors and unbranded validator output reject before inference. Model response JSON cannot supply `inputSpelling` authority. Cancellation or source changes during checking prevent generation.

## Validation

`tests/ai-input-spelling.test.mjs`: 22 passing deterministic checks. They cover saved strictness, decomposed NFC/case/offsets, semantic/punctuation/order/name guards, ambiguous homographs, exact references and registry changes, deep-freeze/clone authority, source/policy mismatch, nullable history, mixed recognition, malformed tasks, effective prompt/grounding/language/correction checks, missing/erroring adapters and cancellation. Existing 30 service checks also pass. Two additional valid-rule fixtures close the ordinary correction bypass after speech confirmation: exact accent-only correction proposals from recognition/mixed origin reject even when `recognitionUncertain` is false, while independently supported grammatical corrections remain allowed. The shared `classifyInputSubmissionOrigin` and `isRecognitionSpellingCorrection` helpers live in `validation.js`; the spelling validator uses the same classifier.

A bounded historical/import summary reproduction still produced one `caffe` → `caffè` correction item from a confirmed recorded source plus a valid rule; the new shared guard returns true. Root owns the necessary summary-loop hook and tests. Root subsequently added the shared summary-loop guard; the same independent fixture now yields zero correction items. The seven study-summary checks pass, including preserved genuine grammar feedback on confirmed speech. The separate imported spelling-note receipt consistency finding remains root-owned.

All language rows/checkers/generators in these tests are explicit fixtures; this is not Italian quality or production spelling coverage evidence.
