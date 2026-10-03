# Parola curriculum and content audit — main `bd60180cc4eea7d9c0bd45e41584048ec752fba1`

Read-only review of the tracked files in `/Users/calebanderson/Documents/ChatGPT/italianapp2`. The untracked “ 2” sync copies were ignored and preserved. Scope: course-v2 Foundations–C2, legacy grammar reference/course, dictionary links, vocabulary synthesis, representative normal and error routes. This is an editorial/product audit, not a certification judgement or a line-by-line linguistic proof of all 1,484 questions.

## Overall judgement

The new course is a useful, carefully scaffolded **introductory course spine**. Foundations through A2 teach practical chunks and common forms in a mostly coherent order; B1/B2 extend into connected narratives, arguments, and mediation; C1/C2 include substantive source-attribution and uncertainty work. The implementation is honest that open writing/speaking needs self-review or a human assessor. It should retain these strengths.

The present main path does **not yet provide or assess comprehensive zero-to-C2 proficiency**. This conclusion is about breadth, transfer, and evidence, not a CEFR hour quota. The authored minutes total 32h15m over 256 lessons; C1 and C2 each advertise under four hours, use a dozen distinct principal reading situations per level, and have very little sustained natural listening or interactive speaking. The dictionary and separate verb/word lessons add substantial optional material, but the course does not prescribe a cumulative selection of it. The [Council of Europe's CEFR Companion Volume](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4#page=48) describes C1 listening as extended discourse with implied relationships and C2 oral comprehension as virtually any live or broadcast language at fast natural speed; its [written production](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4#page=66) and [interaction](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4#page=179) descriptors likewise involve sustained, flexible expression. Those are orientation descriptors, not prescribed lesson lengths. The gap between that breadth and the current path is an inference from the audited corpus and tasks, not a claim that a user cannot reach C2 with outside practice.

### Inventory verified from tracked JSON

| Level | Units / lessons | Advertised minutes | Target modality (language / reading / listening) | Main-path independent questions | Portfolio (write / speak / interact / mediate) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Foundations | 3 / 8 | 57 | 8 / 0 / 0 | 24 | 0 / 3 / 1 / 0 |
| A1 | 14 / 60 | 438 | 58 / 1 / 1 | 211 | 12 / 10 / 2 / 0 |
| A2 | 15 / 58 | 411 | 56 / 1 / 1 | 182 | 12 / 3 / 2 / 0 |
| B1 | 13 / 41 | 287 | 39 / 1 / 1 | 131 | 28 / 4 / 4 / 5 |
| B2 | 13 / 41 | 287 | 35 / 5 / 1 | 123 | 28 / 1 / 3 / 9 |
| C1 | 12 / 24 | 228 | 20 / 3 / 3 | 54 | 20 / 2 / 1 / 3 |
| C2 | 12 / 24 | 227 | 20 / 3 / 3 | 56 | 20 / 1 / 0 / 5 |

The modality count is what can accrue target evidence, not all exposure. The many read/listen passages inside language-form lessons are useful context, but generally do not themselves yield separate comprehension evidence. Main-path independent means non-reserved `stage: independent` questions.

## Prioritized findings

### P1 — Advanced listening and interaction corpus is too narrow for the stated end goal

The course bundles 130 passage audio assets totaling 25.64 minutes across all seven levels. C1 has 14 clips totaling 7.21 minutes; C2 has 14 totaling 7.63 minutes. Of the 130, 128 are reviewed **synthetic practice voices** and two are recorded public-domain literary narrations (Pirandello in C1 and Collodi in C2); the manifest contains no recorded natural conversation or interview. C1/C2 median listening-passage lengths are 61/64 Italian words, with the one longer literary narration at 259/284 words. Compare `data/course-v2/audio.json:6`, `:2573`, `:2578`, `:2599`, `:2604`, and `data/course-v2/recorded-sources.json`. Reviewed synthetic speech is a good basic model but is a small, regularized sample of pace, accent, turn-taking, interruption and register.

Advanced interaction is similarly thin: C1 has one `interact` portfolio, C2 none, and neither level has a `partnerPrompt`. C1's one interaction prompt is a fixed three-step response to Bruno, with no actual partner turn (`data/course-v2/C1.json:4513`); C2's only explicit `speak` portfolio is a literary commentary (`data/course-v2/C2.json`, lesson `v2-c2-u5-literary-narrator`). The approved plan calls for C1 discussion management and C2 delicate interaction repair, colloquial/idiomatic range, and unscripted follow-up (`docs/ZERO-TO-C2-COURSE-PLAN.md:138-162`). The actual C2 units 5–8 are literature, variation/register, prose editing, and interpretation (`data/course-v2/C2.json:2204`, `:2711`, `:3214`, `:3721`). Those are useful topics, but no dedicated target exercises interaction repair or lexical nuance such as connotation/collocation/idiom in a changing social situation.

**Improve:** retain the short preparatory clips, then add a progressively larger bank of licensed natural conversations, interviews, public media and registers, with source-specific comprehension/reconstruction tasks. Add partner or tutor briefs that actually elicit follow-up, disagreement, clarification and reformulation, and keep the result explicitly self-reviewed or externally assessed. Introduce dedicated C1/C2 lexical-choice and pragmatic targets, using the existing large dictionary as a source, with context and audience variation. The official [CEFR phonological and sociolinguistic scales](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4#page=134) support evaluating intelligibility, prosody and nuance separately.

### P1 — Course completion is evidence of bounded targets, not integrated four-skill performance

The per-target checks deliberately use bounded responses, and portfolios are ungraded practice. That is a good honesty policy. The practical consequence is significant: C2's final `v2-c2-u12-integrated-dossier` has two strong mediation prompts (committee recommendation and public update, including written and spoken sources; `data/course-v2/C2.json:6026`, `:6456`), yet `js/views/learnCourse.js:111-113` offers “Continue without a response.” In an engine traversal, eight correct normal question answers with the required listening audio available completed this lesson with both portfolios skipped and zero portfolio records: `phase=complete`, `courseSessionProgress.complete=true`. The eight bounded questions are all choices; neither target requires production. This does not mean the app certifies C2, but a learner can complete the named C2 capstone without composing its synthesis.

Foundations, A1 and A2 also lack an integrated stage-exit task: A1 ends with `v2-a1-di-articles` (`data/course-v2/A1.json:16083`), A2 with `v2-a2-everyday-links` (`data/course-v2/A2.json:14598`). Their dedicated listening and reading targets number just one each (Foundations has none), even though passage exposure appears throughout. B1/B2 have explicit integration units; C1/C2 final units combine sources but still cannot attest to open production. The plan itself asks for level checkpoints using separate reading/listening, writing, speaking/interaction, and mediation evidence (`docs/ZERO-TO-C2-COURSE-PLAN.md:171-187`).

**Improve:** add fresh stage-exit tasks with independent source material and a visible four-strand evidence profile. Keep automatically checked grammar/comprehension distinct from submitted portfolio work, self-assessment, and human feedback. A course traversal can be labeled “path complete”; a readiness or proficiency statement should require reviewed performances and retention across occasions. Do not force a learner to submit private speech to use the course.

### P1/P2 — Advanced reading has promising source reasoning but limited transfer volume and genre diversity

Each C1/C2 level has 24 lessons but only **12 distinct main-path written passages**: in 11 units the same passage is repeated verbatim across its two lessons (e.g. `data/course-v2/C1.json:1136` and `:1431`; `data/course-v2/C2.json:129` and `:372`). Sharing a dossier for two concepts is coherent and should remain where it serves a sequence. Its near-universal use leaves little fresh transfer evidence. Median C1/C2 passage lengths are 86/98 words (maximum 169/284, counting the literary source), so the main course rarely asks the learner to sustain interpretation through an extended article, meeting record, argument, or multi-page text. Most C1/C2 writing prompts are three to five sentences, often based on the shared source. For example, `v2-c2-u10-source-conflict` genuinely asks about three partial accounts and decision-relevant missing data (`data/course-v2/C2.json:4751`); the transfer would be stronger if a later unseen source required the same judgment without familiar figures and option patterns.

This is a depth and breadth opportunity, not a failure of individual passages. The C2 integrated dossier correctly preserves rainfall, accessibility, frequency, and uncertainty (`data/course-v2/C2.json:6026`), and the C1 interview lesson distinguishes interviewer insinuation from the manager's answer (`data/course-v2/C1.json:3811`). These are strong editorial exemplars.

**Improve:** keep the paired lesson dossier, then require a later new context with longer connected input and plausible alternative interpretations; rotate among ordinary service texts, media, institutional correspondence, specialist explanation, and literary prose. Ask learners to revise longer outputs with a rubric and preserve source attribution across genres. The [CEFR reading scales](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4#page=56) distinguish complex, lengthy texts and implicit stance, not simply difficult vocabulary.

### P2 — Multi-facet repairs sometimes reteach the wrong facet

Structural recovery passes, but target-level repair copy is not always aligned to the missed facet. Three verified examples:

* In Foundations `v2-f-greet.s7`, a farewell answer `Arrivederci` is assessed; the target repair only restates `ciao` for a friend and `buongiorno` for polite daytime greeting, with `Ciao, Anna!` as its example. It does not reteach farewell before the reserve farewell check (`data/course-v2/Foundations.json:49`, `:196`, `:280`).
* In A1 `v2-a1-one-thing.s6`, `un’amica` tests feminine elision, but repair models only `un libro` and `una casa` (`data/course-v2/A1.json:1676`, `:1792`, `:1876`).
* In A2 `v2-a2-direct-elision-negation.s5`, `Non lo` tests the placement of `non` before an object clitic; the repair discusses only vowel elision to `l’` (`data/course-v2/A2.json:5729`, `:5830`).

All 781 simulated single-error paths in `node tools/test-course-v2-content.mjs --recovery` eventually complete; that test verifies reachability with answer-key responses, not whether the explanation addresses the learner's confusion. **Improve:** author repairs per facet (or per reviewed error tag), with a concise discriminating example, then recheck on a genuinely new context.

### P2 — Pronunciation is modeled, but most evidence is orthographic or meaning-choice

The A1 sound sequence is thoughtfully woven through known words, and it explicitly avoids pretending the app grades pronunciation. Yet `v2-a1-double-consonants` teaches length with `pala/palla` and `pena/penna`, while its independent questions choose a written word given meaning and printed sentence; none is linked to audio (`data/course-v2/A1.json:4636`, `:4768`). `v2-a1-question-intonation` similarly tests printed punctuation/meaning rather than recognizing or producing an intonation contour (`data/course-v2/A1.json:5978`, `:6102`). Foundations `v2-f-sound-c` has a listening passage and speaking practice but its independent sound questions show the spelled word and no `audioId` (`data/course-v2/Foundations.json`, lesson `v2-f-sound-c`). Thus completion demonstrates spelling/semantic recognition and self-practice, not auditory discrimination or intelligible production.

**Improve:** keep visual spelling checks, add a separate audio-only minimal-pair identification/replay route and a recorded self-comparison/rubric route. Only claim independent listening or assessed speaking when that evidence actually exists. The [CEFR phonological scale](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4#page=134) treats intelligibility, sound control, stress/rhythm and intonation separately.

### P2 — The main path only partly integrates its vocabulary and verb/reference assets

The application has a large separate dictionary (6,958 word entries; 1,185 verbs), tap-to-explain sentence support, and optional related drills. That is a strength, not a missing lexicon. The **curricular link** is uneven:

* The opening `words` glosses total 96 occurrences (47 unique strings) in C1 and 98 (48 unique) in C2 across 24 lessons per level. The current deterministic `wordsCheckPlan` produced no word boards in any C1 lesson and boards in only 6 of 24 C2 lessons, covering 11 unique dictionary entries (the entries repeat in paired lessons). This is because most advanced gloss lists have fewer than three distinct board-eligible word entries or contain phrases/verbs; see `js/learning/course-words.js:300-318` and `data/course-v2/C1.json:73`. It is not a code failure: the contract intentionally skips undersized boards. The main path consequently treats much advanced vocabulary as lookup/gloss rather than active retrieval.
* A2 has `related` dictionary links in only 7 of 58 lessons; its core completed-past lesson `v2-a2-past-regular` and future lesson `v2-a2-future-are` both have `related: []` (`data/course-v2/A2.json:760-767`, `:7291-7298`). A1 has links in 47/60 lessons and B1 in 22/41. This makes the invitation to deepen a new A2 verb case inconsistent.
* The legacy grammar reference covers articles, plurals, tense/mood, pronouns, etc. (`data/grammar.json`), and legacy lessons carry `referenceTopics`; the v2 lessons carry none. The v2 lesson menu has no topic-specific reference link (`js/views/learnCourse.js:45-52`), whereas the legacy lesson menu does (`js/views/learnGrammar.js:35-37`). A learner can reach the general Grammar reference from the course page, but the relevant page is not linked in-context.

**Improve:** curate a small lexical strand per unit (not a word-count quota), ensure each word/construction is introduced, retrieved, reused and signposted to a deeper word or verb lesson; add appropriate `related` and `referenceTopics` mappings to A2 and v2 generally. Separate essential high-utility vocabulary from optional literary/regional C2 dictionary material.

### P3 — Prerequisite metadata does not yet express cross-level bridges

The Foundations→A1, A1→A2 and B1→B2 first lessons name a prior lesson; the first C1 and C2 lessons have `prerequisites: []` (`data/course-v2/C1.json:30-34`, `data/course-v2/C2.json:30-34`). In the v2 player the field merely renders an optional “Review an earlier pattern” link at the words screen (`js/views/learnCourse.js:31`, `:107`); there are intentionally no hard locks. Thus this is **not** a learner-facing lock bug or an assertion that C1/C2 are inaccessible. It is a missing bridge/recommendation and documentation link at the highest transitions. The plan envisioned target-level prerequisite and lexical maps, not one previous lesson ID alone (`docs/ZERO-TO-C2-COURSE-PLAN.md:19-32`).

**Improve:** add selected B2→C1 and C1→C2 bridge concepts and a short diagnostic/refresh option on advanced entry, while keeping browsing open. This should point to needed patterns and lexical background, not force a whole level replay.

### P3 — Generic transfer cards repeat across advanced lessons

Twenty C1 and twenty C2 language lessons use the same generic body beginning “The next example changes the setting. Read its whole meaning before choosing a form…” with the same generic Italian example “Nel nuovo contesto, la scelta dipende dal tempo e dal punto di vista.” Three reading and three listening source-strategy bodies per level also repeat. Example: `data/course-v2/C1.json`, `v2-c1-u1-subjunctive-perspective.core.transfer`. The cards are harmless and can orient a learner; repeated forty times, they do not specifically show how the actual target transfers. Replace them with one target-specific contrast or source cue per lesson. This is an editorial polish issue, not a correctness failure.

## Representative strengths and sequencing

* `v2-f-name-polite` introduces `Come si chiama?` as a whole polite chunk and contrasts it with `Come ti chiami?` before A1 unpacks forms (`data/course-v2/Foundations.json`, lesson `v2-f-name-polite`). Good for true beginners.
* `v2-a1-essere-singular` has separate `io sono`, `tu sei`, named-person `è` facets, guided choice, later independent choice/type, reserve variants, and an accent explanation (`data/course-v2/A1.json`, lesson `v2-a1-essere-singular`). The independent typed item is a meaningful progression from recognition.
* `v2-a2-story-contrast` explicitly cues a bounded event with `A un certo punto` and contrasts it with background `ero/aveva`; the task does not treat time words as mechanical tense laws (`data/course-v2/A2.json`, lesson `v2-a2-story-contrast`).
* A1 `v2-a1-listen-for-a-detail` and C2 `v2-c2-u12-integrated-dossier` use source-linked audio questions, reviewed assets, transcript assistance rules, and independent target evidence; the C2 dossier attends to who measured what and what remains unknown (`data/course-v2/A1.json:14258`, `data/course-v2/C2.json:6026`).
* The grammar reference's passato/imperfetto “Signal words” section explicitly says time expressions are clues, not laws (`data/grammar.json`, topic `passato-imperfetto`). This is a helpful correction to many rote courses.

## Validation and limits

Read-only commands passed on this commit:

* `node tools/test-course-v2-content.mjs`: 256 lessons, 1,484 authored questions, all-correct engine traversal.
* `node tools/test-course-v2-content.mjs --recovery`: 781 single-error routes completed.
* `node tools/test-course-v2-editorial.mjs`: advanced editorial fixtures and selected A1–B2 answer variants passed.
* `node tools/test-course-v2-lexicon.mjs`: 40,123 tokens in 5,457 Italian strings had local word help; this checks lookup coverage, not whether a word was taught or retained.

I inspected representative lessons across each stage, including Foundation greetings/phonics, A1 subject forms/reading/listening/phonics, A2 tense contrast/reading/listening/object clitics, B1/B2 capstones, C1 stance/interview, and C2 source-conflict/integrated dossier. I counted corpus and task fields directly from the tracked JSON and ran the actual engine for the C2 skip case. I did not listen perceptually to every clip, formally calibrate difficulty with learners, or independently verify all Italian examples. The findings above therefore separate observed contract/runtime behavior and corpus counts from editorial recommendations.
