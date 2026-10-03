# Bounded verb example corrections — 2026-10-03

The current individual author-agent read covers catalog indices 0–214: 215 of 1,186 verbs (124 A1 and 91 A2). The other 971 records remain unread. Each recorded verb covers its three source examples/translations, usage/patterns, current lexical frames, five six-person core paradigms, formal Lei agreement, rendered non-finite fields and the listed representative contexts. This does not claim a read of every generated context or question, independent primary attestation of every rare non-finite form, or native-human review. Exact fields and fingerprints are in `verb-language-reviews.json`; the reproducible compact catalog inventory is `verb-language-inventory.json`.

## Auxiliary containment

The source parser previously accepted a bare present-form match inside an auxiliary construction. It therefore assigned these sentences to voi present, despite their actual clause:

| Retired context | Source sentence | Mistaken answer | Actual relationship |
| --- | --- | --- | --- |
| `v:fiorire:present:dictionary-1` | Le rose sono fiorite presto quest'anno. | fiorite | Third-person plural completed flowering |
| `v:peggiorare:present:dictionary-0` | Le condizioni del paziente sono peggiorate durante la notte. | peggiorate | Third-person plural completed worsening |
| `v:sparire:present:dictionary-0` | Sono sparite le chiavi della macchina, le hai viste? | sparite | Third-person plural completed disappearance |
| `v:emanare:present:dictionary-2` | Le nuove linee guida saranno emanate entro il mese prossimo. | emanate | Future passive issuance |

The new negative span guard excludes a bare finite candidate contained within a recognized auxiliary-plus-participle span. It does not use that recognition to certify the clause’s tense or voice: in particular, saranno emanate is passive, not an authored future-perfect model. A full scan of all 1,186 verbs removes exactly those four current source-context IDs. Genuine bare voi forms remain available; the correctly matched compound-past contexts for the first three sentences remain available.

Every affected policy declares distinct current/prior revisions, the exact prior source context and its retirement ID. The builder reconstructs the complete earlier expanded plan, including every removed context and original ordering. `verb-finite-span-prior-pools.json` binds 181 prior target pools by SHA-256 and count, captured before the correction. It also preserves the earlier ordinary-v1 required target sets. Older raw context arrays remain available to the recovery engine. The correction preserves target IDs and core forms.

## Domandare frame

[Treccani](https://www.treccani.it/vocabolario/domandare/) and [De Mauro](https://dizionario.internazionale.it/parola/domandare) describe asking for content such as the time/price, requesting something, and asking an indirect question. They do not support the former tautological una domanda frame as the natural teaching model for English “ask a question”. The current model asks Sara how she is. This is an editorial rejection of that unsupported model, not a claim that every possible occurrence of the wording is grammatically impossible.

Only the 49 exact variants of old frame 1 are declared retired: ordinary/formal simple and progressive present/background, plus the ordinary/formal past, future and conditional variants. Their exact old frame and complete pools remain recoverable. Other older frames remain eligible for exact resumption. The current corrected variants retain the same IDs, so the retirement decision must apply to the **prior source revision**, not to a current ID alone.

## Recovery and evidence

These declarations are consumed by the separately owned scene engine. A retired saved descriptor, draft and feedback must remain recoverable under “This example has been corrected”. Continue selects a current activity with a fresh question identity. The transition must not grade the retired example, record a fabricated attempt, copy mastery or erase historical evidence/completion. Harmless source-wording revisions remain resumable until Continue. Engine/browser transition verification is reported in `journey-scene-contract.md`; this source report alone does not assert that player gate.

The focused source gate is `node tools/test-verb-finite-spans.mjs`. The existing taught-lesson suite passes 44 checks across 239,401 available targets; the progressive-content suite passes 11 checks. Conjugator and actual reference-route tests for the separately qualified cocente form pass 2,809 assertions and six routes in Chromium and WebKit. Cocente also has a bounded independent agent source/reference read; no native-human claim is made.

The highest-priority remaining author findings include the odiare alzarmi person mismatch and two universal body-weight predictions in dimagrire/ingrassare. They are recorded as pending, alongside narrower translation, lexical-meaning and rare-form questions. Those records have not been silently marked repaired.
