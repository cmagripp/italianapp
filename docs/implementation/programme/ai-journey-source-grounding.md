# Journey assistance and canonical source grounding

This slice adds optional Journey hint/explanation controls against the installed validated-service contract. The production provider remains absent; no failed model, generated substitute or download is enabled. Existing authored lesson help stays available.

## Source boundary

`js/learning/practice-sources.js` rebuilds the selected canonical question from the trusted dictionary and lesson catalogue. Its binding includes entry/chapter/target, content version, exact question ID, phase/format/variant, repair cue, selected saved scene and its revision, and canonical prompt/answers/context. The controller separately binds profile, learner, learning epoch, current view generation and the original unfinished answer. A binding does not prove a historical learning attempt; only canonical grading can create that evidence.

The resolver accepts exact current scenes and explicitly declared prior-revision pools consistent with `journeySceneMatches`. Retired scenes, changed prompt/answers/examples, invented authority fields and unrelated imported prose fail closed. A reused context ID is resolved against its declared revision and exact Italian/English, not the first matching current ID. Short-word sources additionally validate the exact canonical slot.

Three source categories remain distinct:

- A selected dictionary child entry can contribute its exact `senseId`, forms, definition and existing lexical references when its versioned provenance records the accepted independent-agent review status. Base-lemma guesses and sibling senses are excluded. This is not a native educator or CEFR certification claim.
- A grammar rule can be returned only by an explicitly supplied trusted reviewed-registry resolver. Topic, target and context IDs are not converted into rule IDs. The production reviewed rule registry is still absent.
- A reviewed authored scene can contribute a bounded `authored-example` with its existing context ID, exact source revision and honest catalogue source category. It supplies the current example, not authority to diagnose grammar, correct the learner or grade an answer.

Practice `helpContext` no longer uses conversation lexical retrieval. `createAIService` requires `practiceSources.resolve` and an explicit binding, validates that its resolved prompt/context match the request, and retrieves only that source's supported records. Missing, empty, altered or out-of-level sources fail before model generation. A helper's `requestedIds` and unrelated question text cannot pull in another rule. Conversation retrieval is unchanged.

Generated practice corrections are rejected even if a supplied rule could otherwise validate them. Complete authored examples are kept in the grounded hint prompt but omitted from displayed hint cards; explanation cards may show the example and their use is assisted. Direct canonical-answer disclosure in hint prose is rejected before a viewed receipt. These controls do not establish absence of indirect leaks, correct Italian prose, preserved intention or freedom from unsupported free-text verdicts. Model and language-quality release gates remain closed.

## Persistence and ownership

The help sheet saves the original question before requesting generation. It never automatically submits an answer or restores a generated result. Viewing accepted help adds the existing `hint` assistance tag; a later actual canonical answer records assisted evidence. Exposure alone creates no attempt, completion or mastery.

Real reopening exposed a serialization issue: persisted scene object keys are reordered by normal storage. `source-fingerprint.js` now canonicalizes object key ordering while preserving array order. Exact older original drafts are compared structurally on restore; changed source values still reject them. The source digest is SHA-256 over this complete canonical descriptor.

Navigation, provider replacement/removal, learner replacement, epoch reset and external unfinished-answer changes revoke pending output before receipts or writes. The lazy Journey-to-Grammar import now rechecks the original view ownership before invoking the child renderer. Already open Journey completion controls also reject a changed learner.

## Validation and limits

At the earlier Journey checkpoint the source/controller and existing AI-service suite totalled 53 passing Node checks, with ten browser checks per engine and twelve Workshop/Course/Grammar checks using explicit source fixtures. The later [canonical adapter slice](ai-authored-source-adapters.md) replaces those source fixtures with the actual loaded resolver: 68 Node checks, eleven Journey and seventeen Workshop/Course/Grammar checks per engine now pass. Only generator/language fixtures remain synthetic, with no model quality claim. Reports remain `ai-journey-assistance-{chromium,webkit}.json` and `ai-assistance-{chromium,webkit}.json`.

A deliberately incomplete synthetic Journey seed exposed an adjacent import edge: a compatible current independent question with an empty variant-counter map records the assisted event, then `recordJourneyAttempt` dereferences an absent counter. Normal engine-generated sessions contain that counter. The learning agent owns a proposed initialization guard/regression; it is not silently fixed by this slice. The browser seed was corrected to match actual engine-generated state.

## Canonical adapter follow-up

Workshop, Course and retained Grammar bindings are now implemented by [canonical authored practice sources](ai-authored-source-adapters.md). Their examples preserve exact loaded revisions and honest editorial state, without inventing reviewed grammar IDs. Generated Workshop help is source-bound for only 3 of 46 free slots; the remaining 43 require explicitly reviewed per-slot examples or links and remain open.

The new Journey form fence is also included in help bindings. It uses the trusted catalogue history recipe for current and valid prior descriptors; retired forms cannot supply help. Grammar registry links remain optional and absent in production. No topic or example is promoted to grammar-rule authority.

The installed service must supply the canonical resolver alongside a real passing runtime and language policy. None of these adapters or the small browser corpus can approve a production model.
