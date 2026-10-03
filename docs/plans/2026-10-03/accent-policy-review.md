# Accent policy review — planning only

Reviewed the active tracked code at `bd60180` in `/Users/calebanderson/Documents/ChatGPT/italianapp2`. No app files, user data, commits or app tests were changed. Untracked `* 2.*` copies were excluded from active-path findings.

## Recommendation

Treat **Strict accents as one profile-wide policy for every submitted Italian typed answer**. With it OFF, an otherwise accepted answer differing only in written accents passes, and the submitted field or learner bubble displays the correctly accented spelling after submission. Keep the original submitted text and the actual grading policy in the saved attempt. With it ON, accent differences fail the orthography check while other supported skills keep their earned evidence. Never turn an accent correction into an invisible article, agreement, person, tense, lexical or meaning correction.

Use one pure comparison function, passed the setting by its caller, shared by lessons, Review, games, placement, workshop and future constrained conversation tasks. Do not import the store into the pure graders. Keep authored valid alternatives and task constraints separate from normalization. The comparator should return the matched alternative and safe accent-only display edits, not just a Boolean. Exact matches win before folded matches; a folded collision must not arbitrarily pick the first answer.

The user's requirement already settles `caffe → caffè` with OFF. The proposed extension is to tolerate missing, extra, misplaced and wrong acute/grave accents alike with OFF, while showing the canonical spelling. This follows the switch's promise to grade accents only with ON; the combined plan retains this broad accent-only policy consistently.

## Current coverage and defects

| Surface | Current route / evidence | Reads setting? | Current visible result | Required change |
|---|---|---|---|---|
| Profile preference | `js/store.js:101`, `:150`, `:166`, `:341`; `js/views/profile.js:116`, `:235` | Yes; stored per profile, default OFF | Label says typed answers must carry correct accents | Define OFF correction behavior explicitly; preserve per-profile scope and backup/import |
| Main word/verb journeys | `js/views/learnJourney.js:886`; `js/learning/diagnose.js:138` | Yes | Raw `given` copied to draft at `learnJourney.js:887`; input renders draft at `:723`; feedback shows raw at `:705` | Store original separately; render corrected display for accepted accent-only responses |
| Adaptive focused practice / Review | `js/views/learnAdaptive.js:196`, `:390`; same `gradeQuestion` | Yes | Feedback shows raw `ui.given` at `:308`; shows first model at `:304`, `:309` | Render matched display alternative and retain original; replay committed policy/result |
| Legacy word/verb walkthroughs | `js/views/walkthrough.js:375` invokes `q.accept` or `checkTyped`; word scene `learnWord.js:206`; verb type scene `learnVerb.js:353` | Yes through `checkTyped` | Accepted input disabled as typed, `walkthrough.js:359–368`; only reveal replaces text | Apply returned display value on accent-only pass before locking |
| Games and original Review | `js/games/engine.js:27`, `:229`; typed vocabulary, plural, cloze, scramble, dictation and verbs in `games/questions.js:52`, `:80`, `:164`, `:190`, `:193`, `:237`; `views/review.js:27` | Yes, except custom callbacks | `engine.js:273` locks original field; `:282` shows first model in feedback | Shared match + display result; preserve existing separately authored article acceptance |
| Workshop new-word drill | `js/views/labFrasiLesson.js:59–64`, `:394`, `:397` | Yes, locally implemented | Keeps `view.draft`; `sentence-lab-activities.js:193` renders it unchanged | Remove local comparator; keep same shared result/display policy and original |
| Course v2 constrained typing | `js/learning/course-v2-engine.js:28–40`, `:43`, `:238`; caller `views/learnCourse.js:165` | **No** | Accents always exact; `course-v2-activities.js:20` shows raw draft | Pass policy through course assessment/submission; correct accepted typed draft display |
| Starting placement | `js/learning/course-v2-placement.js:32–33`; `views/coursePlacement.js:33` | **No** | Uses course exact matcher; answer clears immediately with no submitted corrected review | Reuse comparator; saved answer review needs canonical display/original so correction is observable |
| Legacy grammar v1 | `js/learning/grammar-journey.js:3`, `:14–16`, `:62–70`; `views/learnGrammar.js:45`, `:89–97` | **No** | Accents always exact; raw draft shown read-only | Route through shared policy if legacy route remains supported |
| Workshop cloze / scripted dialogue | `js/learning/sentence-lab.js:27–28`, `:164–203`, `:248–255` | **No** | Exact authored answer inserts canonical `filled`; raw values separately retained for dialogue | Match typed authored blanks under shared policy; retain actual typed original before canonical insertion |
| Workshop dictionary own-word insertion | `views/labFrasiLesson.js:323–339`; `learning/sentence-lab.js:473–496`; lookup norm at `sentence-lookup.js:9` | **No** | Dictionary match can reject missing accents; resolver may also conjugate/add article/change adjective form (`sentence-lab.js:410–432`, `:438–452`) | Add exact-first safe accent lookup, but keep construction assistance explicit; do not call grammar repair an accent correction or independent recall |
| English typed meanings | `games/questions.js:65–69` custom `enKey`; `gradeQuestion` receives `meta.answerLanguage` elsewhere | Inconsistent: English custom grading folds accents; shared diagnosis folds regardless of language | First model may replace preferred meaning if blindly canonicalized | Italian accent setting must not silently transliterate English/foreign names; preserve valid English alternatives |
| Multiple choice / tiles / matching | `gradeQuestion` handles MC labels at `diagnose.js:139–143`; pair matching intentionally forces strict at `lesson-activities.js:68–69` | MC uses setting, though label promises typed only | **OFF can accept an explicitly wrong accent-only choice** through loose match | Typed tolerance applies only to learner typing. Selecting `e` where `è` is offered remains a wrong choice |
| Letter games | Hangman `games/hangman.js:55`, `:60`, `:65`; crossword `games/crossword.js:101`, `:112`, `:162` | Always fold | Hangman reveals canonical letters; crossword alphabet grid strips accents | Treat as explicit letter-recognition game contract, never independent written-accent evidence; decide if strict setting needs separate disclosure here |

The setting has only three active direct grading implementations: `checkTyped`, `gradeQuestion` callers, and workshop drill `typedMatches`. Multiple independent exact normalizers account for the missing coverage. `conjugator.js:468` exports `isCorrectForm`, but there are no active callers; leave it out of the new public grading contract or make it a thin adapter to avoid a future bypass.

### Additional correctness implications

- `gradeQuestion` identifies all combining-mark differences as one `accentIssue` (`diagnose.js:6–7`, `:142`), so OFF currently tolerates wrong accent direction and extra accents, not just missing ones. `checkTyped` does the same (`games/engine.js:36–44`). This is a behavior to specify, not silently narrow.
- OFF currently produces a positive orthography component (`diagnose.js:149`) for an accent-only tolerated answer. An ignored accent is not evidence of correct accent spelling. Keep correct grammar/recall evidence, record the accent discrepancy separately, and mark accent orthography **unassessed** rather than true. The event/component schema currently only permits Boolean `ok` (`learning/model.js:64–85`), so this needs a versioned contract or omitted unassessed component.
- OFF in games also lowers legacy answer quality from 4 to 3 for an accent-only pass (`games/engine.js:245`); this can penalize retention even though strict grading was disabled. Use normal non-accent evidence for the main target, with a separate accent observation.
- Both grading feedback and corrected speech choose the first model or the first folded match (`diagnose.js:148`, `:152`; `learnJourney.js:37`). The accepted alternative actually submitted must determine the correction. Never replace `per piacere` with `per favore` or insert an omitted article when the task explicitly permits the bare noun.
- Strict feedback currently claims “The grammar is otherwise right” for every folded match (`diagnose.js:152`). That is too strong for meaning-bearing pairs such as e/è: the typed string alone cannot distinguish an omitted accent from selection of the wrong word. Show the verified required spelling without inventing either a grammar misconception or proof of semantic understanding.
- Strict game normalization lacks NFC (`conjugator.js:465–466`), while most lesson normalizers include it. A decomposed `e + combining grave` must count as the same spelling as `è` with ON.
- Recovery can reconstruct feedback under a new setting (`learnAdaptive.js:390`); journey recovery calls `gradeQuestion` without the saved setting (`learnJourney.js:324`). Changing the toggle must affect future submissions, not rewrite an already committed attempt or its history.
- Course content already classifies missing and wrong accents as errors even when the setting is OFF: `data/course-v2/A1.json:15525–15546` defines a strict typed `Perché amo la musica.` answer, `Perche…` missing-accent error and `Perchè…` wrong-accent error. `step.strict` currently means closed-answer grading versus ungraded open work (`course-v2-engine.js:38`); do not reuse that property as an accent preference override.

## Central comparison / display contract

Suggested conceptual result (names provisional):

```text
originalText                 unchanged submitted string
normalizedText               NFC and explicit task-allowed typography normalization
matchedAnswerId / canonical  exact reviewed accepted alternative, if one was established
matchKind                    exact | accent-only | invalid | ambiguous | ungraded
accentDifferences            bounded spans: missing | extra | position | acute/grave
displayText                  original with only verified accent edits, else original
outcome / components         subject to task, modality and accent setting
policySnapshot               policy version, accentStrict, inputMode, targeted skills
```

1. Apply NFC, case-insensitive comparison, harmless spacing/apostrophe typography and narrowly specified trailing punctuation. These affect comparison without erasing original source text. Apostrophes are letters/constructions, not accents: do not fold `da'`/`dà`, `po'`/`pò` or `qual è`/`qual'è` into equivalence. Do not strip interior punctuation globally where it changes meaning or is the taught target.
2. Expand only reviewed alternatives already supported by the task. Article omission and agreement alternatives are task content rules; they do not belong in a global normalization step.
3. Prefer normalized exact match. If there is no exact match, compare Italian vowel accent variants only, rather than stripping every Unicode combining mark from every language. Keep missing/extra/wrong-position/wrong-direction information. Do not fold unrelated marks in foreign words, names or user facts.
4. A unique reviewed accent-only match: OFF gives a correct non-accent outcome, an accent observation, and verified display edits. ON leaves original in the answer field, gives orthography-specific feedback, and can show a distinct correct model. OFF auto-correction occurs **after submit**, not while typing.
5. Display edits change only vowel accent marks on the actual submitted string, preserving words, agreement, synonyms, casing and punctuation. Example: `Un CAFFE, per favore!` becomes `Un CAFFÈ, per favore!`; `cafe` remains `cafe`, because inserting a second f is not an accent edit. Model-only feedback or TTS is insufficient: the submitted field/bubble itself must show the spelling.
6. Save original plus corrected display atomically with the attempt/turn and policy snapshot. Corrected spelling must survive history, reopening, export/import and retry without becoming a second learner attempt. A small “Accents added”/“Accent corrected” indicator and an optional “As typed” disclosure reconcile the corrected bubble with accurate provenance. General grammar revisions remain adjacent suggestions with originals preserved.
7. No automatic choice among multiple meanings, valid accent-distinct alternatives, proper-name spellings or open-text rewrites. Mark uncertain judgement ungraded or clarify intent; do not invent mastery credit or a misconception.

The combined plan's preservation rules are compatible with a corrected visible accent display **only if the original is retained and accessible**. Add this narrow accent behavior to the shared presentation/evidence contract. Do not broaden automatic correction to grammar.

## Meaning, special lessons and input provenance

**e/è, da/dà, si/sì:** In a constrained typed task, the authored prompt can uniquely establish intended `è`, `dà` or `sì`; OFF tolerates that accent-only deviation and displays the authored spelling. It does not prove the learner independently knows the semantic spelling distinction. ON requires the accent. If the task has no such closed intent, do not mechanically transform each `e`, `da` or `si`: these are valid unaccented words. Exact valid meanings take priority, and ambiguous free chat must preserve the message and clarify rather than silently changing its proposition. The same applies to `se/sé`, `ne/né`, `la/là` and `li/lì`.

**Dedicated accent lessons:** The currently authored written-accents lesson tests explicit choices, not typing (`data/course-v2/A1.json:1238–1247`, `:1259–1268`, `:1279–1290`, `:1343–1353`). Those choices continue assessing spelling under either toggle because the learner is selecting a visible distinction. For any future typed accent-target exercise, honor global OFF: allow progress as practice and record the accented output as supplied by the app; do not certify unaided accent production. Offer a clearly labelled optional spelling check that the learner enables. Do not introduce a hidden per-lesson strict override.

**Proper nouns and open conversation:** Keep user-provided names as chosen. Do not invent `Rene → René` or `Andrea → Andréa` from a vocabulary fold. A closed task with an explicitly verified name can use its reviewed spelling; free chat should require verified lexical/contextual evidence for each safe accent edit. The AI should propose meaning-sensitive changes beside the message, preserving the original, unless the learner explicitly chooses the interpretation. Unsupported free-chat corrections carry no correctness XP or mastery, consistent with the current plan at `:86` and `:263`.

**ASR / speech transcription:** At code-review time no active SpeechRecognition/ASR learner grader was found. The updated combined plan now includes speech, and its generated orthography is kept separate from typed-answer evidence. Reserve `inputMode: typed | speech-transcript` and original transcript provenance now. A speech recognizer's generated accents/punctuation must never count as learner orthography mistakes, regardless of strict setting. Evaluate only supported spoken/semantic targets; recognition uncertainty is a transcription problem, not a grammatical error. Recognition-generated correct accents also cannot prove learner spelling. If a user subsequently edits a transcript, track spans/provenance; ordinary OS dictation pasted into a text field cannot reliably be recognized by guessing from its text.

## Acceptance fixtures for the later implementation

Run each closed Italian typed fixture through journey, adaptive/review, legacy walkthrough, relevant games, course v2, placement, legacy grammar, workshop blank/drill and constrained conversation adapters. Assert identical result and actual submitted display, not just shared-function output.

| Input / context | OFF | ON | Display / evidence assertion |
|---|---|---|---|
| `caffe`, accepted `caffè` | correct | accent error | OFF submitted field `caffè`; original `caffe` accessible; no accent-production credit |
| `caffé`, accepted `caffè` | correct, proposed broad tolerance | accent error | OFF `caffè`; discrepancy recorded as wrong direction |
| `perchè`, accepted `perché` | correct, proposed broad tolerance | accent error | OFF `perché`; never reference first unrelated alternative |
| `càffe`, accepted `caffè` | correct, proposed broad tolerance | accent error | OFF `caffè`; distinguish position and missing accent |
| `cafè`, accepted `caffè` | incorrect | incorrect | Keep `cafè`; do not add missing f as accent correction |
| `cafe`, accepted `caffè` | incorrect | incorrect | No typo repair into a pass |
| `CAFFE`, accepted `caffè` | correct | accent error | OFF `CAFFÈ`; preserve casing |
| decomposed `caffe\u0300`, accepted NFC `caffè` | exact correct | exact correct | NFC equivalence; no false accent warning |
| `un caffe!`, accepted `un caffè` | correct if trailing punctuation allowed | accent error | OFF `un caffè!`; preserve exclamation |
| `caffe`, accepted noun `il caffè` with explicit bare-word allowance | correct | accent error | OFF display `caffè`, not `il caffè`; no article injected |
| `la caffe`, accepted `il caffè` | article error | article error | No grade pass or grammar correction merely from folded noun |
| `per piacere`, accepted alongside `per favore` | exact correct | exact correct | Display stays `per piacere` |
| `Luca e qui.`, closed expected `Luca è qui.` | correct non-accent target | accent error | OFF displays `Luca è qui.`; no proof of e/è distinction |
| `Mario da un libro.`, closed expected `Mario dà un libro.` | correct non-accent target | accent error | OFF displays `Mario dà un libro.` |
| `si`, closed expected answer `sì` | correct non-accent target | accent error | OFF displays `sì`; retained original |
| `vengo da Roma`, open conversation | preserve valid exact reading | preserve valid exact reading | Never automatic `dà` |
| `si lava`, open conversation | preserve valid exact reading | preserve valid exact reading | Never automatic `sì` |
| `e`, a free reply with multiple plausible interpretations | ungraded/clarify | ungraded/clarify | No invented `è` or mastery |
| `e`, selected MC distractor versus visible correct `è` | incorrect | incorrect | Setting cannot turn wrong explicit spelling choice into correct |
| `caffe`, selected spelling distractor versus visible `caffè` | incorrect | incorrect | Recognition distinction remains assessed |
| `caffe`, future typed accent-target lesson | correct as allowed practice | accent error | OFF cannot certify unaided accent-production target |
| `dà`, closed expected `da` | correct under proposed broad tolerance | accent error | OFF removes accent only under the consistent accent-only policy |
| `da'`, expected `dà` | incorrect | incorrect | Apostrophe is not accent; no global equivalence |
| `po'`, expected `po'` | exact correct | exact correct | Apostrophe preserved; `pò` is not automatically made a pass |
| user-selected name `Rene`, future free chat | preserve | preserve | No unverified `René` repair or penalty |
| exact accepted accented variant plus another folded-colliding alternative | choose exact | choose exact | Do not replace the learner's valid exact form |
| missing accent with several accepted folded-colliding meanings | ambiguous unless prompt independently resolves | accent error/ambiguous per task | Never first-answer auto-correction |
| correct meaning but wrong person/tense/article | incorrect | incorrect | Accent display policy cannot create a grammar pass |
| recognizer transcript `caffe`, explicitly speech input | no learner accent penalty | no learner accent penalty | Correct transcript display only with verified context; no written-accent mastery |
| recognizer transcript with automatic punctuation | no spelling/punctuation penalty | no spelling/punctuation penalty | Preserve input provenance and any audio link |
| submit OFF, then toggle ON and reopen | historical outcome stable | historical outcome stable | Saved display remains `caffè`; original remains `caffe`; no regrading |
| switch profile OFF → ON | next submission follows destination profile | follows profile | History retains each submission's actual preference |
| interrupted save/retry after accent correction | one committed response | one committed response | No double rewards, no corrected text misrecorded as unaided source |

## Recommended defaults incorporated into the plan

Tolerate all Italian vowel-accent-only differences when Strict accents is off, including missing or wrong acute/grave marks, and display the verified spelling after submission. Explicit accent-choice questions still test the visible distinction; typed exercises have no hidden strict override. Correct only contextually supported accent differences in open conversation, preserving names, valid unaccented words and the original submission. The combined plan is authoritative for these product choices. No implementation or application settings were changed.
