# Independent language policy and daily-path review

Read-only review of `js/ai/language-policy.js`, `language-scope.js`, `grounding.js`, `js/learning/daily-plan.js`, its Home/Learn presentation and session normalization. No policy/path source edits were made by the reviewer. The original ten policy and fifteen unified learning checks passed before the two additional findings below.

## Historical findings and fixed outcomes

The daily continuation deduplication appended the single active pointer after the saved session map and unconditionally replaced a same-ID saved session. A normalized fixture retained an older pointer at `1700000000100` with phase `complete` and a newer saved session at `1700000000200` with phase `teach`, chapter `future` and draft `creder`. The original `continuation()` returned `null`, hiding the actual saved activity. Root now keeps the newest same-ID session by `updatedAt`; an independent rerun returns `Continue credere · Future` with `session=same-session&chapter=future`. The normalized-state regression is part of the daily-path suite.

The policy originally detected surface ambiguity only across sense IDs. Two different grammatical form IDs belonging to the same sense could therefore bypass the contextual verifier. The adversarial fixture assigns synthetic levels to two `parla` forms: `present-third` at A1 and `command-second` at A2. A separately verified whole-text command construction at A1 deliberately does not authorize a lower-level form identity. An analyzer mislabelling `Parla!` as `present-third` was accepted without a form-context verifier. These deliberately synthetic labels are a policy regression fixture, not a CEFR claim about Italian imperatives.

Root now counts distinct `[sense.id, form.id]` identities for each normalized surface. The independent original probe now rejects the unverified identity with `contextual meaning is unresolved` and incomplete lexical coverage. Root's regression additionally checks absent, wrong and correct form verifiers. Eleven policy checks pass.

## Scope and remaining gates

The policy checks reviewed sense/form levels, exact lexical coverage, contextual homographs, separately verified constructions and source-revision/scope-bound higher-level word receipts. Word exceptions cannot raise a grammar rule or construction level. The daily plan stays read-only and respects the shared saved activity, discovery scope and separate due work.

These are foundation and adversarial fixture checks. No production analyzer, complete reviewed construction/sense registry or production model has been installed. Construction verifiers must evaluate their complete context and the host request; counting covered words does not by itself prove conversational coherence, the truth of a teaching claim or semantic preservation. Existing model failures and the closed production gate remain valid. This review does not establish model quality or physical iPhone behavior.
