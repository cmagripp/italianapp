# Lexical collision audit and bounded meaning corrections

The pinned inventory contains **935 headword groups and 2,004 source records**. All supplied English glosses and Italian examples were contrasted manually by the learning workstream. `tools/lexical-collision-decisions.mjs` records explicit exception decisions; `tools/audit-lexical-collisions.mjs` verifies the inventory hash and every source-file/index record before generating the evidence report. English string equality, catalogue order and shared spelling do not grant semantic approval.

| Bounded classification | Groups |
| --- | ---: |
| Same meaning attested by the supplied examples | 693 |
| Broader gloss needs additional contextual disambiguation | 142 |
| Distinct meanings/functions attested by supplied contexts | 67 |
| Related contextual or domain variation | 22 |
| Source conflict needing correction | 11 |

These classes describe the reviewed contrast, not approval of every translation, form, factual note or possible meaning. Every inventory row retains `semanticApproval:false`, its exact source fingerprints, its bounded rationale and pending human-review status. An unchanged example for one meaning cannot certify the extra meanings promised by a broad gloss.

The first high-frequency correction batch authors **20 parents and 43 children** in `tools/lexical-frequency-senses.mjs` and `data/lexical-senses/frequency.json`. A separate curriculum agent independently read all Italian models, translations, gender, plural, category, notes and primary sources. Medical sampling was corrected to the taking action (*blood draw*), the feminine boss note was qualified with the primary Crusca guidance, a transport translation no longer adds an unstated train, and six category spellings were corrected. The exact reviewed ten fields and SHA-256 fingerprints are recorded in `frequency-sense-independent-review.json`; changed fields invalidate that closed bounded gate.

Those children are now active alongside the earlier seven-parent/fourteen-child batch: **27 split parents and 57 children**. Only 21 parents are in the collision inventory; six earlier polysemous entries sit outside it. Therefore the exact residual is **914 unsplit inventory groups**, not 928 or 934. This scope remains visible separately from additional polysemy outside the inventory.

`tools/test-lexical-frequency-senses.mjs` passes six independent integration checks: every reviewed field/hash, unchanged original parents, stable identifiers after English edits, no copied parent completion/article evidence/XP, supported noun boards with exact meaning context and full-sentence playback, and the residual audit boundary. The paired boards distinguish *la/le capitale* as city from *il/i capitale* as finance, and plural masculine *i media* from feminine *la media / le medie*. All rows remain supported recognition; they do not certify typed or delayed mastery. The test is included in check CI beside the existing sense suite.

The residual distinct/broad/source-conflict records still need bounded authoring and independent review before activation. In particular, the 11 conflicts include false friends or overbroad factual notes; they have explicit findings rather than silently approved unchanged text. The 1,185 retained verb records still need individual linguistic review; the separately added *riavere* has its own bounded source/form review. Runtime traversal of 1,186 verbs establishes answerable behavior, not catalogue-wide linguistic approval. Native-human editorial review, pronunciation and learner calibration remain open.
