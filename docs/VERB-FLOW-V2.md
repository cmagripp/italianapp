# Verb lessons: construction-specific progress

The Present and Imperfetto cases now have three stable sections: simple forms, the appropriate progressive usage, and a final contextual review. Section checkpoints complete the current material before introducing the next construction. Repairs remain inside the active section. A final review is mandatory, includes both constructions where appropriate, and uses separately authored situations. Skipping a prerequisite defers the dependent review; it never manufactures a completion.

## Content

`data/verb-progressive/{beginner,intermediate,advanced}.json` assigns every dictionary verb a selected sense and usage policy. `dynamic` and `sense-dependent` records provide bounded lexical frames or complete scenes for that verb. `simple` records explain why the selected meaning normally uses the simple construction. Missing custom content is explicitly unreviewed; it cannot borrow another verb's lesson or create progressive practice.

`tools/build-verb-progressive.mjs` validates complete catalogue coverage and compiles the runtime module `js/learning/verb-progressive-data.js`. The authoring JSON is not fetched during a lesson. The service worker caches the complete module atomically with the release.

Frames provide the lexical construction and English predicates; the conjugator supplies only the finite verb or gerundio. Nonhuman/impersonal subjects and lexical clitics require appropriate subject scopes or exact scenes. A scoped progressive sense does not remove otherwise valid ordinary conjugations from the verb. The initial two frames and remaining final-review frames are distinct. Exact scenes can use `section: "practice"` or `"mixed"`; each practiced person needs at least two real situations. Optional `past` overrides preserve complete past scenes where mechanical tense adaptation would be inappropriate.

The simple present and progressive can both describe a current event. Prompts name the requested construction. Recognizing an otherwise grammatical counterpart produces viewpoint feedback rather than asserting that the Italian form is invalid. English -ing is never a blanket eligibility rule. The present lesson does not introduce a generic four-tense eating example.

## Evidence and review

New progressive and final-review targets have separate `v2-` identifiers. They require spaced unaided successes across distinct context identities. Translating the cue or changing the question format does not turn one situation into two. Matching, choice, letter banks, hints, examples and repairs remain supported practice, not independent mastery.

Stable milestones show where the learner is in the lesson; internal skill readiness is not presented as an exercise fraction. Earlier simple-form evidence is retained. A completed tense enrolls its learned targets for review. Historical case completion does not enroll newly added unlearned constructions; those appear as new practice. Explicit current-version manual completion enrolls the current case without inventing answers or XP.

## Shorter, varied practice

Verb lessons avoid repeating a form as a separate guided exercise after it has already been matched correctly. Where every required person has complete sentence practice, the additional usage target is covered by those contextual answers; its teaching card remains. Written recall no longer triggers an automatic filler exercise after every two answers. A verb requires two unaided correct recalls with an intervening activity; adjacent repeats, hints, revealed answers, choices and matching cannot earn that evidence. New construction targets still require distinct scenes. Mistakes retain focused explanations and repair, with no automatic retry limit or false completion on skip. Word and grammar evidence policies remain separate.

The new `scenePolicy: "expanded-v1"` question marker selects the expanded sentence pool. Unmarked saved questions retain the previous pool, including its ordering, English cues, feedback and repair. History and inactive case cursors preserve the marker. New context questions rotate situations as well as grammatical people; mixed review retains separate situations. Reviewed verb-specific frames extend sentence practice to later tenses with explicit restrictions for sense, auxiliary, agreement and temporal meaning.

Correct answers read the complete Italian sentence when one is shown. Matching tiles pronounce the selected Italian subject, then flip to a matched back in their original grid positions. The backs hide the answered forms, preserving both the layout and the exposure bookkeeping. Reloading or viewing history does not replay speech or the matching animation.

## Existing profiles

Lesson content version 1 and evidence schema 5 remain compatible. `verbFlowVersion: 2` is a cursor policy, not a destructive profile migration. The legacy progressive module exists only to reconstruct an already-active old question. A saved draft and feedback stay on that prompt until Continue; only then is the session upgraded. Inactive old case cursors also retain their prompt until reopened and continued. An archive preserves the previous cursor/UI, while events, session identity, sequence, skipped work and manual marks remain intact.

Historical completion uses the exact old requirements. The card can therefore remain green while offering newly added practice; this does not claim the new targets have been mastered. Redo still requires fresh evidence. Distinct-scene policy and new manual-completion scope have durable identifier markers so an older additive-schema client cannot accidentally inflate evidence by stripping an optional metadata field.

## Validation

- Rebuild/check the catalogue with `node tools/build-verb-progressive.mjs --check`.
- Content and independent language fixtures: `tools/test-progressive-content.mjs`.
- Flow, error repair, skip, evidence diversity and migration: `tools/test-verb-flow-v2.mjs`.
- Bounded exercise counts, unaided evidence and saved-scene repair: `tools/test-verb-pacing.mjs`; corpus coverage and independently checked meanings: `tools/test-verb-scene-variety.mjs`.
- Real avere traversal, saved drafts and feedback: `tests/verb-pacing-e2e.mjs`. Matching geometry, speech and reload behavior: `tests/lesson-activities-e2e.mjs`.
- Phone traversal, stable milestones, visible Continue and old drafts: `tests/verb-flow-v2-e2e.mjs`, with Chromium and `VERB_BROWSER=webkit`.
- Existing journey, completion, sync, grammar, word-lesson and offline regression suites continue to run.

These checks validate executable content and specific independently checked constructions. They are not a claim of professional native-speaker certification of every authored sentence.
