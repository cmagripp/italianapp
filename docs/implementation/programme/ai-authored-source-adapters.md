# Canonical authored practice sources

The Workshop, Course and retained Grammar help hooks now use the actual loaded catalogue resolver. Generated help remains conditional on an installed validated provider; production has no approved provider. This slice adds source and lifecycle plumbing, not model quality approval or a reviewed grammar registry.

## Exact source contract

`practice-authored-sources.js` creates a bounded descriptor from the selected canonical lesson and reconstructs it independently through trusted catalogue lookups. The descriptor binds lesson ID, selection, full canonical step/activity/question, declared pack version/path and bounded example references. Equality includes the exact Italian/English, attribution, source locator and editorial state. A pack version is a catalogue namespace, not a content hash. Help receipts separately carry SHA-256 over the complete source descriptor; therefore same-version edits revoke stale help.

Course resolves the selected question, teaching step or portfolio, its own spoken/model example, exact passage relationship, or an explicitly introduced target's preceding teaching example. Only declared reviewed child-sense links whose source step exists and exact phrase appears in the selected text can contribute lexical senses. Whole-lesson vocabulary IDs and topic labels do not select authority.

Retained Grammar resolves its actual objective and selected question/card. Repair requires a real `repairQuestionId` belonging to that objective and binds the entire repair question as well as the objective label/explanation. Missing or invented repair IDs reject. Changing answer, options or explanation while retaining the same `speak` and declared version invalidates the prior binding.

Workshop binds actual free-slot/activity/turn indices, the whole canonical activity, loaded pack version and explicit m/f speaker agreement. The request agreement must match. Current free slots use explicit `sourceExamples`: every fill must exactly belong to its actual blank accept list, and the complete Italian must exactly equal shared `fillTemplate` output. Translation, review scope, applicability and quoted subject metadata remain in the binding. An explicit malformed/inapplicable source never falls back to another model example. Declared legacy sources without that field retain conservative whole-token/phrase and neighbouring-frame matching; one-letter fragments, substrings and different frames reject. Locators retain the actual source-example index. Selection has exactly four known fields; cloze turn index must be null and dialogue turn index must be a real in-range integer. Fully reconstructed imported locators and extra authority fields reject. Male-speaker and male/mixed-group quotes are labelled in the help card and the model receives their distinct subject metadata.

Journey additionally binds the new exact `formSnapshot` and `questionRevision`, validates them with `journeyFormMatches` and rejects `retiredJourneyForm`. The history recipe is rebuilt from the trusted catalogue; imported `questionHistory` cannot become authority. Full descriptors include spoken feedback, explanation and matching components, beyond displayed answers. Current and valid prior contextual questions keep help; retired form questions do not. An absent flattened scene revision is derived from its validated snapshot; explicit revision mismatches still reject.

## Honest provenance

`sourceValidated:true` means exact correspondence with the loaded canonical source. It does not mean independent editorial or educator review. Examples copy whatever bounded per-lesson review metadata exists, otherwise record that independent editorial review was not recorded. They never become `verified` grammar rules or correction/grade authority. Existing reviewed Journey examples retain their separate catalogue provenance.

Authentic passages retain title, author, source URL, licence, licence URL and adaptation notes. The help sheet labels them as source excerpts, displays attribution and links separately to source and licence. Long text uses an exact bounded excerpt with offsets; a truncated Italian excerpt is not paired with the full English translation or presented as newly authored prose.

Practice help remains separate from conversation retrieval. Unrelated question text and requested IDs cannot bring in another grammar rule. Hint cards omit answer-bearing authored examples and all teaching cards; direct canonical-answer disclosure in generated hint prose rejects before a receipt. Explanation may show the exact example as assistance. These tests do not prove absence of indirect leaks or reliable generated Italian/meaning.

## Measured support inventory

The reproducible `tools/ai-authored-source-inventory.mjs` records exact pack hashes, selection IDs and matched references in [ai-authored-source-inventory.json](ai-authored-source-inventory.json).

| Selected current source | Exact-bound support |
| --- | --- |
| Course questions | 2,211 / 2,211 |
| Course portfolios | 245 / 245 |
| Retained Grammar questions | 534 / 534 |
| Retained Grammar teaching cards | 258 / 258 |
| Retained Grammar valid repair-question selections | 534 / 534 |
| Workshop free slots, masculine agreement | **46 / 46** |
| Workshop free slots, feminine agreement | **46 / 46 current; 45 / 46 exact legacy** |

At checkpoint dcf2afa, only 3/46 slots were source-bound for both agreements and the other 43 were an explicit open requirement. That historical evidence remains in [ai-authored-source-inventory-before-examples.json](ai-authored-source-inventory-before-examples.json). This slice closes the missing chosen-source coverage with curriculum's 60 exact full contexts, following bounded independent Italian/translation/agreement review. It does **not** review every accepted alternative, reaction or entire pack. Native educator review remains pending.

The prior feminine gap in `sl-strutture-03-quindi-allora-pero`, activity 3, blank 0 is now closed for fresh current sessions through the authored `agreement-v2` template: `Sono stanca...` for f and `Sono stanco...` for m. Exactly two chosen `resto` contexts were independently read in [workshop-template-stanco-independent-review.json](workshop-template-stanco-independent-review.json). Truly absent saved revision markers still select the exact preserved `original-v1` masculine quote; that historical f source remains unsupported. Null, undefined and unknown markers are unavailable. No profile preference silently rewrites an original quote. The two `La sera siamo tornati...` sources identify a male/mixed group independently of the viewer's gender. Retained punctuation and context-naturalness qualifications are recorded in [workshop-source-examples-independent-review.md](workshop-source-examples-independent-review.md).

All 92 fresh current profile/slot combinations reconstruct through the actual resolver; the historical 91-combination inventory is retained in [ai-authored-source-inventory-before-template-revisions.json](ai-authored-source-inventory-before-template-revisions.json). the maximum full binding is 8,368 characters under the 15,000-character gate. Curriculum's independent author check still passes 99 chosen example/profile combinations, 111 actual blank checks and 60 saved-dialogue comparisons with all prior templates, identities, acceptance and reactions unchanged. Changing any canonical accepted list, Italian, English, review note or another agreement's source invalidates the selected current full activity binding, even when the selected Italian and declared pack version remain unchanged. New bindings include the exact template revision and agreement. Pre-version serialized bindings are preserved only by reselecting the source-declared legacy recipe and removing the narrowly additive declaration fields; unrelated original-source edits revoke them.

## Validation

The preceding spelling/source slice passed 99 Node checks. This template revision slice passed its affected 52 checks: assistance controller 11, Journey source 14 and authored adapter 27 (five new version/legacy/forgery/current-prompt checks). The real-catalogue inventory traverses all sources counted above. `ai-assistance-e2e.mjs` passes 19 checks in each of Chromium and WebKit with the actual canonical resolver. Its synthetic generator and permissive language fixture are explicitly test-only. New real-route checks cover the exact chosen m/f source cards and a labelled male/mixed group quotation, plus agreement cancellation with preserved original intention, unsupported slots, pre-generation source tampering, authentic excerpt attribution/licence and retained Grammar repair. Existing persistence, assisted-only canonical answers, owner/learner/epoch/navigation, hint rejection and single sentence speech checks remain.

`ai-journey-assistance-e2e.mjs` passes 11 checks per engine, including current/valid prior/retired form source boundaries. Browser reports are [ai-assistance-chromium.json](ai-assistance-chromium.json), [ai-assistance-webkit.json](ai-assistance-webkit.json), [ai-journey-assistance-chromium.json](ai-journey-assistance-chromium.json) and [ai-journey-assistance-webkit.json](ai-journey-assistance-webkit.json).

Production model, semantic/Italian quality, real speech and native educator gates stay closed or separately recorded. No model run, download, deployment, product switch or provider activation occurred in this slice.
