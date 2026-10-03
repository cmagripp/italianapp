# Canonical authored practice sources

The Workshop, Course and retained Grammar help hooks now use the actual loaded catalogue resolver. Generated help remains conditional on an installed validated provider; production has no approved provider. This slice adds source and lifecycle plumbing, not model quality approval or a reviewed grammar registry.

## Exact source contract

`practice-authored-sources.js` creates a bounded descriptor from the selected canonical lesson and reconstructs it independently through trusted catalogue lookups. The descriptor binds lesson ID, selection, full canonical step/activity/question, declared pack version/path and bounded example references. Equality includes the exact Italian/English, attribution, source locator and editorial state. A pack version is a catalogue namespace, not a content hash. Help receipts separately carry SHA-256 over the complete source descriptor; therefore same-version edits revoke stale help.

Course resolves the selected question, teaching step or portfolio, its own spoken/model example, exact passage relationship, or an explicitly introduced target's preceding teaching example. Only declared reviewed child-sense links whose source step exists and exact phrase appears in the selected text can contribute lexical senses. Whole-lesson vocabulary IDs and topic labels do not select authority.

Retained Grammar resolves its actual objective and selected question/card. Repair requires a real `repairQuestionId` belonging to that objective and binds the entire repair question as well as the objective label/explanation. Missing or invented repair IDs reject. Changing answer, options or explanation while retaining the same `speak` and declared version invalidates the prior binding.

Workshop binds actual free-slot/activity/turn indices, the whole canonical activity, loaded pack version and explicit m/f speaker agreement. The request agreement must match. A source example must contain a whole accepted token phrase and the neighbouring canonical template frame; one-letter fragments, substrings and examples with a different frame reject. There is no arbitrary preceding-example fallback. The example locator retains its original catalogue index.

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
| Workshop free slots, both m/f agreements | **3 / 46** |

The supported Workshop slots are `sl-presente-01-chi-sono` activity 4 blank 0 (`Sono italiana.`), `sl-presente-03-mi-piace` activity 5 turn 1 blank 0 (`Mi piace la pizza.`), and `sl-passato-04-era-cosi` activity 5 blank 0 (`Mentre dormivo, è arrivato Marco.`). This inventory establishes exact source support, not language quality for every accepted answer. The other **43 slots remain an open programme requirement**. Their generated-help controls stay unavailable; authored slot help remains available.

The bounded next content task is to author explicit per-slot reference links or examples for those 43 inventory IDs, reviewed against the exact template, accepted phrase, surrounding meaning and both speaker agreements. Existing model examples may be reused only with a demonstrated relevant relationship. Retain source locators and editorial scope, test every link against its loaded canonical revision and rerun the inventory. Do not weaken source matching or label an entire Workshop pack reviewed because a speaker-agreement subset was reviewed.

## Validation

68 Node checks pass: existing AI service 30, assistance controller 11, Journey source 14, authored adapter 13. The real-catalogue inventory traverses all sources counted above. `ai-assistance-e2e.mjs` passes 17 checks in each of Chromium and WebKit with the actual canonical resolver. Its synthetic generator and permissive language fixture are explicitly test-only. New real-route checks cover agreement cancellation with preserved original intention, unsupported slots, pre-generation source tampering, authentic excerpt attribution/licence and retained Grammar repair. Existing persistence, assisted-only canonical answers, owner/learner/epoch/navigation, hint rejection and single sentence speech checks remain.

`ai-journey-assistance-e2e.mjs` passes 11 checks per engine, including current/valid prior/retired form source boundaries. Browser reports are [ai-assistance-chromium.json](ai-assistance-chromium.json), [ai-assistance-webkit.json](ai-assistance-webkit.json), [ai-journey-assistance-chromium.json](ai-journey-assistance-chromium.json) and [ai-journey-assistance-webkit.json](ai-journey-assistance-webkit.json).

Production model, semantic/Italian quality, real speech and native educator gates stay closed or separately recorded. No model run, download, deployment, product switch or provider activation occurred in this slice.
