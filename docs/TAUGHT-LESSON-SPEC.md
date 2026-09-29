# Taught adaptive lessons: acceptance specification

Status: implementation acceptance contract for `codex/taught-adaptive-lessons`, 29 September 2026. This records the user's approved lesson direction and interaction mockup. It supersedes conflicting lesson behavior in [ADAPTIVE-VERB-LEARNING.md](ADAPTIVE-VERB-LEARNING.md); that document remains useful background rather than the acceptance authority for this revision.

The result must feel like a lesson that teaches a word or verb, then responds to how the learner uses it. A sequence of unexplained tests, a conjugation table followed immediately by a copying test, or a fixed quiz followed by an automatic pass does not satisfy this specification. Browser checks must exercise actual lessons and persisted learner outcomes, not only inspect generated question metadata.

## 1. Scope and lesson structure

1. A new verb opens an overview that **meets the verb**: its everyday meaning, a useful sentence with its meaning, pronunciation, and any exception that changes how the learner should approach it. For example, *dire* must flag that its past participle is *detto* before a past exercise assumes knowledge of it.
2. The overview offers five core cases: **Present**, **Passato prossimo**, **Imperfetto**, **Future**, and **Condizionale presente**. Each is a complete taught lesson and remains selectable. A finished case receives a persistent, accessible completion mark on return and reload. Existing imperfetto work remains valid. Mixed and advanced practice are optional; opening reference content does not enroll advanced forms.
3. Each chapter has a meaningful explanation, worked examples, guided practice, and increasingly independent checks. The order is content driven rather than an arbitrary fixed number of questions. Teaching is available again when an answer exposes a difficulty.
4. The present chapter teaches singular persons first—*io*, *tu*, *lui/lei* and formal *Lei*—then *noi*, *voi*, and *loro*, followed by recurring checks across the relevant persons. The all-person checks use the evidence already earned during the chapter.
5. Guided work rotates real disappearing-pair matching, letter banks, choices, cloze, and typed answers as the content calls for them. Variety continues during later practice, while independent checks still require writing. Equivalent visible forms match regardless of hidden tile identity. A wrong match diagnoses the selected person. Letter banks retain accents, repeated letters, and fixed spaces; neither visible letters nor matched forms certify independent recall. An activity has one clear learning purpose, and the learner must have been taught what it asks them to do; a sparse entry need not artificially include every format.
6. The current verb remains the lesson's subject through teaching, repair, and intervening activities. Do not inject unrelated random words or a different verb to fill spacing requirements. Same-verb meaning, person, sentence interpretation, and construction activities may provide useful spacing.
7. The verb overview offers an explicit resume control for unfinished work. At a case's end, the learner chooses the next case or returns to the overview; completing an answer does not automatically start another tense. Explicitly redoing a completed case creates fresh practice and checks while preserving past evidence, XP, history, and completion. A short review or another lesson is an optional choice that does not silently replace unfinished work.
8. Sparse or unusual dictionary entries need an honest supported path. If available content cannot support a required activity or enough distinct checks, explain that limitation and allow pause or explicit skip. Do not fabricate an example, manufacture variant IDs, loop forever implying success is one more identical answer away, or claim completion for unavailable content.

## 2. Teach the grammar before testing it

### Present

- Explain what the present expresses, using meaningful examples of now, routines, and ordinary use. An English meaning accompanies the teaching example.
- Explain the person pronouns and why the ending changes. Show the relationship between an infinitive, its stem, and the applicable endings; color or emphasis may help, but color alone must not carry the explanation.
- Teach regular *-are*, *-ere*, and *-ire* patterns when relevant to the verb. Teach *-isc-* behavior explicitly for an applicable verb such as *capire*. Never present *-isc-* as the rule for every *-ire* verb.
- Teach the selected verb's actual irregular forms or spelling changes before checking them. Explain what remains regular and what must be remembered, without applying a convenient rule that produces a wrong form.
- Present *lui* (he), *lei* (she), and formal *Lei* (you, polite singular) clearly. Formal *Lei* uses third-person singular morphology but addresses the listener. It must not be conflated with feminine third person or plural *voi*.
- Use whole meaningful constructions across persons. A learner who only chooses detached endings has not demonstrated independent use of the verb.

### Passato prossimo

- Teach the construction **present auxiliary + past participle** before asking the learner to build it. Explain the selected verb's auxiliary in the intended use.
- Teach the regular participle patterns *-are → -ato*, *-ere → -uto*, and *-ire → -ito* as patterns with real exceptions, not universal transformations. For an irregular verb, teach its actual participle before independent checks. *Dire → detto* and *prendere → preso* must never be incorrectly derived as regular.
- For *essere*, teach agreement using an explicitly stated subject/gender/number where that matters. For an ambiguous first-person context, accept the applicable alternatives rather than guessing the learner's gender.
- Teach reflexive/clitic placement and the auxiliary when relevant. *Mi sono alzato/alzata* is a whole construction; *sono alzato* cannot demonstrate the same reflexive target.
- A component exercise may supply the participle and ask only for the auxiliary, or vice versa. It is useful teaching but is not independent evidence for the whole construction.
- Diagnose component errors without discarding what was correct. For *ho andato*, identify the auxiliary issue; do not claim the participle was wrong. Re-teach the helper and return to a full construction for the same verb.

### Future, imperfetto, and further forms

- Teach the future's use, person endings, applicable stem changes, and the selected verb's irregular stem before independent checks.
- The requested tense must be explicit or supported by a carefully authored semantic context. *Domani* alone does not make a present-tense sentence grammatically wrong: Italian also uses the present for planned future events.
- If an exercise specifically asks for the future form, feedback on a present answer explains that task requirement rather than asserting the present is impossible in the sentence.
- Core imperfetto teaching explains background, description, and habit with meaningful contexts, actual endings, and irregular forms such as *essere*. Past-form contrasts need authored cues that support the intended distinction; one isolated time word is not enough.
- Optional forms cannot silently enter beginner teaching, distractors, repair, or review when not selected. Full reference access remains available.

## 3. Sentences, meaning, and correctness

Every example and answer must be semantically plausible for the selected verb, person, tense, and noun sense. A grammatical shell filled with an unrelated verb is not an authored example. Sentence variants must change a meaningful cue or retrieval task, not only punctuation, a variant counter, or the placement of an identical exposed answer.

Teaching uses Italian and an understandable meaning. Exercises make the task clear and supply unrelated grammar when that grammar is not the target. For example, a new noun lesson should not require the learner to conjugate an untaught verb to demonstrate the noun. Accept valid alternatives supported by the prompt and the application's accent policy. Do not classify an ambiguous answer as a specific misconception without enough evidence.

The browser suite must include hand-checked examples whose expected answer is known independently of the generator. Generator output may drive a long traversal, but at least the regular, irregular, auxiliary, reflexive, formal-address, and noun-sense regressions must compare against separate expected Italian.

## 4. Repeated independent demonstration for verbs

| Rule | Acceptance requirement |
| --- | --- |
| Person coverage | At least **two independent correct whole constructions for each relevant grammatical person** in the chapter. Ordinary personal verbs cover *io, tu, lui/lei, noi, voi, loro*. Defective/impersonal verbs cover only forms that are valid in the taught use. |
| Formal address | Separate evidence that the learner understands formal **Lei** as polite singular *you*, even though its form belongs to third-person singular. A correct answer for *she* alone cannot satisfy the formal-address requirement. |
| Evidence carries forward | Qualifying answers during ordinary chapter practice count toward the chapter requirement. Entering a checkpoint does not reset them or require a second identical quota. |
| Independence | The first submitted answer must be correct, with no answer-revealing support or recent answer exposure that makes it a copy. A correction typed immediately after seeing the answer remains practice. |
| Variation and spacing | The successful checks use changed meaningful cues and intervening activities. Immediate repeats of an identical exposed construction do not count as separate demonstrations. Same-verb activities must preserve honest spacing without introducing unrelated words. |
| Wrong target | A mistake retains that target and leads to teaching/repair. It needs two later independent successes after the error, which also count toward the normal requirement. It does not erase unrelated successful persons or components. |
| Guided components | Correct choices, supplied endings, auxiliary-only cloze, matching, and visible-table copying can support learning but cannot certify an independent whole construction. |
| No answer quota | There is no arbitrary retry cap or question count that advances a struggling learner. Repeated failure changes the explanation/scaffold and offers pause/skip. |
| Skip | Explicit skip immediately leaves the target/chapter without marking it understood; preserve the weak target and its history for return. |
| Lesson vs retention | Finishing today's chapter and remembering it later are different states. A later session after a meaningful delay checks retention. Same-session repetitions or changing the session ID are not proof of delayed memory. |

Showing the answer through a help panel, table, worked example, answer audio, or feedback must be accounted for when judging subsequent attempts. Audio that is intentionally the listening prompt is different from answer-revealing audio. Recognition can be a useful learning activity; it cannot silently be recorded as independent production.

Targets with identical written forms across persons still require the semantic/person distinction to be clear in the prompt. Evidence for one person cannot be copied into another person merely because the string is the same. Formal *Lei* must be distinguishable from feminine *lei* in the stored role and authored context.

The browser checks must prove an incomplete chapter stays incomplete when one relevant person or formal role remains unproven. They must also demonstrate that a complete supported chapter can eventually finish by answering correctly, without an accidental infinite loop caused by every same-verb activity exposing the next answer.

## 5. Repair is instruction, not repetition

1. On a wrong answer, show the learner's answer, an appropriate correct form, and a concise explanation of the actual mismatch.
2. Return to a smaller teaching step for that same verb and difficulty: person contrast, stem/ending construction, auxiliary, participle, agreement, or clitic placement as warranted.
3. Make the next activity achievable; supplied parts are visibly supplied and recorded as support internally.
4. Return to a whole construction after intervening activity, using a different valid cue. Only independent successful answers repair the independent target.
5. After recurring difficulty, change the explanation or exercise approach. Repeating the same generic sentence indefinitely is not adaptation.
6. Keep pause and explicit skip available. Neither is recorded as successful learning, and neither destroys already earned progress.

Required concrete regressions include a person-ending mistake, *ho andato*, an incorrect irregular participle, a missing reflexive pronoun, and an accent-only difference. The feedback must not infer more than the question actually tested.

## 6. Word lessons teach one sense and its usable form

The subsequent approved word-lesson revision makes these lessons deliberately short and primarily matching and multiple choice. It supersedes the earlier use of the full verb-style repeated-production controller for default word introductions. Sentence examples teach meaning and use; default word lessons must not require the learner to write a particular example sentence. The five-case verb requirements above are unchanged.

A short completed word introduction records what was actually demonstrated. Matching and choice answers remain recognition, visible letters remain supported spelling, and none may be reclassified as independent production or delayed retention to satisfy a completion flag. Wrong answers still receive specific feedback; skip or reveal cannot silently count as a correct answer. Existing word histories and in-progress sessions must remain recoverable, without deleting earlier independent evidence or awarding duplicate XP.

- Start by meeting one dictionary sense, with its meaning and a plausible example. Polysemy must not cause plural or usage rules for one sense to be asserted for another.
- For nouns, keep the article attached to the word in teaching. Explain the applicable gender/article and recorded plural or number usage before testing either.
- A count noun such as *la casa → le case* teaches both forms. An invariant noun such as *il caffè → i caffè* teaches the article change and unchanged noun. A normally plural entry such as *gli occhiali* uses appropriately qualified language.
- *Il calcio* in the football/soccer sense is normally singular; *un calcio / i calci* meaning a kick/kicks is a different sense. Do not ask for *calci* as the plural of the sport. A note may explain the difference without treating both senses as interchangeable answers.
- A missing custom plural means **not recorded**, not **invariable** and not **uncountable**. Say what is missing, omit unsupported plural tests, and never invent a form to enable completion.
- Adjective lessons teach the applicable agreement forms and meaningful uses before testing them. Do not impose four forms when the adjective's real pattern or stored data differs.
- Adverbs, prepositions, conjunctions, pronouns, determiners, numerals, interjections, and fixed expressions use lessons appropriate to their word type and authored examples. Do not impose noun article/plural or verb conjugation exercises on them.
- Usage exercises supply unrelated grammar and accept the intended form in context. Listening or extra context can be offered when reliable content is available; unsupported optional activities must not become a hidden completion gate.
- Explicit review of a word retains its sense, known morphology, and unresolved skill. Success on the English meaning does not erase a wrong article or plural.

## 7. Interaction and presentation

The approved interaction is deliberately simple:

| State | Interaction |
| --- | --- |
| Teaching | Read/listen, optionally open help/reference, then **Continue**. |
| Choice/matching selection | One tap submits the selection, grades it, and locks the answered interaction. No extra Check button for a completed single choice. |
| Typed question | Type, then submit using **Check** or Enter. |
| Feedback | Remains visible until the learner taps **Continue**. No timer or automatic advance. Double taps cannot record extra attempts or accidentally skip feedback. |
| Help | Accessible without losing the answer draft. Any answer-revealing material affects internal evidence honestly. |
| Pause | Saves the exact teaching/question/feedback position, draft, support, and target. |
| Resume | Returns to that exact saved position with no repeated grading or XP. |
| Skip | Explicitly defers the target and keeps its unfinished status. |
| Case overview | Shows five core cases and persistent completion marks, with explicit start/resume/redo actions. |
| Case completion | Offers the next case or a return to the verb overview; waits for a choice. |

Display understandable chapter/stage labels and qualitative progress. Do **not** display internal evidence counters such as “3 independent answers,” “0/4 independent checks,” percentages implying mastery, or “supported” evidence labels. Internal tracking remains rigorous; the learner sees the subject they are learning and what comes next. Necessary grammar explanations are learner-facing; implementation terminology is not.

Phone layouts at 375 and 390 CSS pixels must show readable teaching, choices, inputs, feedback, and controls in light and dark themes. No horizontal page overflow, clipped critical text, or control overlap is acceptable. Interactive elements support keyboard focus, meaningful accessible labels, live feedback, and reduced motion. Animation is decorative and never required to answer or navigate.

Planned stable hooks: `[data-journey]` with `data-phase`, `[data-choice]`, `[data-answer]`, `[data-check]`, `[data-continue]`, `[data-help]`, `[data-skip]`, `[data-pause]`, and `[data-resume]`. Tests should prefer visible roles/labels where unambiguous and use these hooks for stateful actions. Class names and visual copy are not a substitute for semantic state metadata.

## 8. Preservation, offline use, and updates

- Preserve existing profiles, learned lists, word banks, custom entries, XP, history, adaptive events, due reviews, and unfinished sessions. Never wipe history to make new lesson thresholds easier to implement.
- Existing records remain valid evidence only for what they actually demonstrate. A legacy learned flag or older aggregate readiness flag is not automatically two independent whole constructions for every person/formal role.
- Migrate versioned state without losing data. Unknown newer schemas must be preserved with a clear update requirement; an older client must not silently overwrite or misinterpret them.
- Save a stable serializable lesson cursor and regenerate validated authored content. Imported state is untrusted: do not execute or raw-render stored HTML, callbacks, or prototype keys.
- Every submitted answer is recorded once. Reload, repeat taps, resume, merge, or replay of the same event cannot duplicate evidence or XP.
- Partial letter banks and matching boards survive reload, pause, and read-only lesson history. Recovery handles both a completed activity saved before its event and an event saved before its cursor, without collisions or duplicate awards. A wrong match reserves its attempt identity before a later retry.
- A skip remains a skip across reload and review recommendation. Reset boundaries must prevent an old offline device or backup from resurrecting deliberately cleared progress.
- After a complete first online load, taught content, lesson generation, help, questions, feedback, saved draft, and resume must work offline. No paid model, cloud credential, or remote inference is required.
- An update must cache a complete app shell before activation. A missing new module must not replace the previous working offline app. Include new journey content and styles in the actual service-worker shell.
- Fresh installation and upgrade are separate tests. Upgrade testing must start with pre-existing progress and show it surviving the new worker and state migration.
- Browser verification uses isolated test contexts, never the user's real installed app, profile, credentials, or preview. Publishing/merging remains a separately coordinated root action.

## 9. Required verification scenarios

| ID | Observable scenario and pass condition |
| --- | --- |
| J01 | New regular verb: Meet teaches meaning; singular/person/ending teaching precedes related independent checks; plural teaching follows; the chapter can finish by actual correct interaction. |
| J02 | *Dire* or another irregular: exception is taught before the relevant question; wrong regularized participle gets accurate repair. |
| J03 | Formal *Lei*: prompt means polite singular you, answer uses third-singular morphology, separate role evidence is needed, and feminine *lei* success alone does not clear it. |
| J04 | *Ho andato*: feedback identifies auxiliary; scaffold remains on *andare*; auxiliary-only correction cannot finish the whole-construction requirement; later independent whole answers can. |
| J05 | Missing reflexive or agreement error: teaching isolates the affected part; unrelated correct components/persons remain recorded. |
| J06 | Two-per-person requirement: leaving one person short prevents chapter readiness; returning and demonstrating it completes the requirement without replaying already earned evidence. |
| J07 | Help/table/answer/feedback copying: correct immediate copies and recognition do not certify the whole target; useful same-verb spacing eventually permits independent success. |
| J08 | One-tap choice: a real click grades and locks immediately; feedback stays until Continue; double click records exactly once. Typed Check and Enter also record once. |
| J09 | Repeated wrong answers: no quota passes the chapter, repair changes approach, pause/skip remain usable, skipped target remains weak after reload. |
| J10 | Word types: regular/invariant/mass/plural nouns, missing custom plural, adjective, adverb, preposition, and expression all receive suitable teaching and answerable practice. |
| J11 | Noun sense: *calcio* teaches soccer's singular use and distinguishes kicks; no soccer plural test accepts *calci*. |
| J12 | Meaningful tense context: a future task teaches the requested form; feedback does not falsely state that present + tomorrow is ungrammatical. |
| J13 | Lesson vs retention: today's chapter completion is possible without falsifying elapsed time; same-day repetitions cannot claim later retention; a later check can establish it. |
| J14 | Online/offline resume: exact chapter/question/feedback, answer draft, help status, and single-event accounting survive reload; returning entry defaults to the saved lesson. |
| J15 | Upgrade: old progress and custom data survive; legacy aggregate mastery does not fabricate per-person evidence; a failed shell update preserves a working offline version. |
| J16 | Responsive/accessibility: 375/390 light/dark teaching, choice, typing, help, feedback, pause, and summary remain usable; no internal evidence counts or support labels leak into the lesson. |
| J17 | Five-case overview: imperfetto and condizionale presente are core, all five supported cases are needed for the new complete-verb milestone, and a legacy three-case profile is not granted invented imperfetto evidence. Existing learned flags and history remain preserved. |
| J18 | End-of-case choice and redo: completion waits for explicit next/overview navigation, remains marked after reload, and redo adds fresh practice without deleting prior learning. |
| J19 | Matching/letters: correct pairs disappear, equivalent forms interchange, errors target the selected person, partial work persists, and visible assistance never replaces required independent writing. |

Long browser traversals may use deterministic fixtures or exposed read-only content descriptors to choose the right answer. They must still click/type through the actual UI, assert the resulting stored evidence and visible state, and keep independent hand-checked grammar assertions. Unit tests should cover selection, diagnosis, migration, merging, and elapsed-time retention; browser tests cover the complete interaction and persistence boundaries. Passing automated tests establishes these implementation behaviors, not a scientific claim that a threshold guarantees fluency.

## 10. Items to settle in the implementation contract

The approved requirements above do not specify exact storage field names. The five core case IDs are `present`, `past`, `background`, `future`, and `condizionale`; `background` retains existing imperfetto evidence. The browser suite needs the final API and selectors, but must not weaken the acceptance conditions to match whichever implementation happens to arrive first.

The existing later-retention delay is 24 hours; retain that explicit policy unless the team changes it deliberately. Formal-address success needs an authored semantic role and must not be inferred from capitalization alone. Very sparse custom entries require an explicit limited-content path rather than fabricated variation. These are the main cross-module boundaries to review before release.


Present includes meaning-appropriate stare + gerundio; Imperfetto includes stavo + gerundio. Teach -ando/-endo and specific exceptions, with explicit simple-present, habitual-past, ongoing-past and completed-event contrasts. Unreviewed progressive senses get usage guidance, not mechanically generated sentence drills.

The conditional lesson teaches the future/conditional stem ending in -r with -ei, -esti, -ebbe, -emmo, -este, -ebbero, including irregular stems and formal Lei. It covers wishes, polite requests and hypothetical outcomes without teaching conditional after hypothetical se. Truly unavailable forms are explained on the overview and excluded from completion requirements.
