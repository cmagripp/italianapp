# Parola course-v2 content audit (Foundations–C2)

Repository `/home/user/italianapp`, branch `claude/dreamy-darwin-fqjhm8`, commit `bd60180`. Read-only review of `data/course-v2/*.json` (82 units, 256 lessons, 3,196 steps), `audio.json` (130 clips), the authoring tools and `js/learning/course-words.js`.

## 1. Verdict

The course is a well-engineered **grammar-form drill with a very small world**, not yet a language course. The skeleton is sound (teach → guided → independent → apply → recap; honest handling of speaker gender and tense alternatives; 100 % audio coverage for listening passages; real literary recordings at C level; good error diagnostics in the lessons added on 2 October). But the lessons themselves are overwhelmingly template output:

- **Lexical poverty is the single biggest problem.** After Foundations + A1 (68 lessons) a learner has met **491** distinct Italian word forms in total (names and inflections included); the A1 question corpus uses **146** distinct content words, dominated by *Anna, Luca, casa, libro, Roma, zaino*. After A2 the cumulative count is **750**. Days of the week, months, colours, weather, numbers 21–99, *suo/sua*, *fratello/sorella*, *ti piace*, professions, nationalities, clothes, directions, health, *fa/scorso/prossimo* are never taught at A1–A2.
- **Forms are tested before they are taught** at the A2→B1 seam (plural imperfetto, plural future, *vuole/deve*), against the course's own contract.
- **Three lessons teach wrong or unidiomatic Italian** as the model (*vicina a* enforced and *vicino a* rejected; *Il libro è nella casa*; *Leggo più che scrivo*), and the B1 *ce ne* lessons misdescribe the construction.
- **Templating is extreme**: two prompt strings cover 95 % of A2 questions; ~40 % of B1/B2 "teach" steps are auto-generated echoes of the previous answer; 21–23 % of C1/C2 questions carry the target explanation verbatim as their only feedback.
- **C1/C2 are half C-level**: inputs and writing prompts are genuinely advanced (Pirandello, Collodi, 200–300-word dossiers), but every *graded* grammar target is B1/B2 grammar relabelled, and comprehension checks are English multiple-choice often answerable without the Italian.

The later-authored material (A1 U13–14, A2 U7.4–7.6, U13.5, U15, B1 U12) shows the team can write good lessons by hand. The fix is editorial, not architectural.

## 2. What I read

- **Foundations**: all 8 lessons. **A1**: all 60 lessons in full.
- **A2** (36/58): 1.1–1.3, 2.1–2.3, 3.1–3.4, 4.1–4.3, 5.1–5.3, 6.1–6.3, 7.1, 7.4, 7.5, 7.6, 8.4, 9.3, 9.4, 10.1, 10.3, 11.1, 11.2, 11.3, 12.1, 12.3, 13.2, 13.5, 14.2, 14.3, 15.2, 15.3 (plus teach bodies of 8.2, 9.1, 9.2, 10.2, 11.4, 11.5, 12.2, 12.4).
- **B1** (20/41): 1.1, 1.2, 1.3, 2.1, 3.3, 4.1, 4.2, 5.2, 5.3, 6.1, 7.1, 8.2, 9.1, 9.2, 10.1, 11.1, 11.2, 12.1, 13.1, 13.2.
- **B2** (9/41): 1.1, 1.2, 1.3, 2.2, 3.1, 5.2, 6.3, 11.1, 13.1.
- **C1** (6/24): 1.1, 1.2, 3.1, 8.1, 10.2, 12.2. **C2** (6/24): 1.1, 3.2, 5.1, 6.1, 10.1, 12.2.
- Docs/tools: `COURSE-V2-CONTRACT.md`, `GRAMMAR-COURSE.md`, `ZERO-TO-C2-COURSE-PLAN.md`, `tools/author-course-beginner.mjs` (`addUnit`, `C/M/T/O/X`, `addSourceLesson`), `tools/author-course-intermediate.mjs` (`fresh`, `oldLesson`, `listeningLesson`, `separatedChecks`, `addReserve`), `course-beginner-refinements.mjs`, `course-pronunciation-lessons.mjs`, `course-beginner-checkpoints.mjs`, `js/learning/course-words.js`, `audio.json`, `audio-review.json`.
- Whole-corpus statistics (prompts, frame reuse, lexicon, coverage, audio, duplicates) were computed by script over all 256 lessons.

## 3. Findings

### Critical

**C1 — The beginner levels teach almost no vocabulary.**
Distinct Italian word forms in all Italian text: Foundations 101; A1 447; cumulative after A1 **491**; after A2 **750**; B1 1,337; B2 1,920. A1 question contexts: 729 content tokens, **146 distinct**; top tokens *anna×57, luca×52, casa×40, qui×38, libro×33, roma×32, milano×23, ieri×20, napoli×17, zaino×17*. *Anna* (179) and *Luca* (138) outnumber every content word in A1; A2: *Anna×218, Luca×178*. Only two adjectives are taught in all of A1 (`v2-a1-adjective-agreement`: *piccolo, grande*). A1 words steps are mostly function forms (*io, tu, noi, voi, loro, di Roma, alle nove*); *casa* is glossed in 5 lessons, *perché* in 5. A learner finishing A1 cannot name a day beyond *lunedì/martedì/sabato*, a colour, a month, a sibling or a job (section 4).

**C2 — Forms are tested before they are taught** (contract: "never advances to untaught target material").
- `v2-a1-want-need.review-0` "Anna ___ comprare il pane" → *vuole* STRICT; `.review-1` → *deve* STRICT; the lesson teaches only *voglio, vuoi, devo*. These are repair items: a learner who slipped is repaired with a form never shown.
- Imperfetto is taught in A2 only for *io* and *lui/lei* (`v2-a2-imperfect-are.s2/s3` "parlavo … parlava … mangiavo"; `-ere-ire`: *leggevo/leggeva, dormivo/dormiva*; `-states`: *ero/era, avevo/aveva*). B1 then requires typed plurals: `v2-b1-changing-duration.check-2` "noi ___ ogni giorno in treno" → *viaggiavamo*; `v2-b1-story-background-event.independent-background-b` → *preparavamo* with hint "The noi imperfetto ending of -are verbs is -avamo" (the only place the ending is ever stated); `v2-b1-earlier-past.reserve-1` → *avevamo*.
- Future is taught only as *-erò/-erai/-erà* (`v2-a2-future-are` takeaway; `v2-a2-future-irregular`: *sarò, avrò, andrò, sarà, andrà*). B1 types plural futures: `v2-b1-plan-options.check-2` *prenderemo* (hint "Use the noi future of prendere"), `check-3` *mangeremo*, `check-4` *partiremo*; `v2-b1-revise-plan.check-1` *rimanderemo*, `check-3` *torneremo*. No lesson teaches *-remo/-rete/-ranno*.
- Conditional: A2 teaches only *vorrei, potrei, potrebbe, andrei, farei*; B2 `v2-b2-unreal-present` types *andrei, uscirei* and offers *usciremmo*; the paradigm is never taught.
- Smaller: `v2-a1-da-con.s8` passage "Oggi **vanno** a Napoli" (*vanno* untaught); `v2-a1-first-past-message.s5` "Ieri **sono andata** a Roma" (first-person essere past not taught until A2 3.1); `v2-a1-basic-links` reserves use untaught *esco, bevo, vedo*.

**C3 — The content is template output, and the templates show.**
- Prompts: A2 has **16 distinct prompts over 369 questions**; "Choose the expression that fits this situation." = 63 % of A2, 40 % of A1; "Complete the Italian sentence with the taught form." = 32 % of A2. B2: 10 distinct prompts over 205.
- Lesson shape: 60/60 A1 and 56/58 A2 lessons are "7 min", 11–14 steps, 2 teach + 1 guided + 2–3 independent + 1 passage + reserves + "Keep this" whose body equals the takeaway verbatim (e.g. `v2-a1-essere-singular.s12`).
- **Auto-echo teach steps**: `separatedChecks()` inserts a "Notice why it fits" teach step after each check whose body is the previous explanation: **87/218 B1 and 82/214 B2 teach steps** (40 %/38 %), e.g. `v2-b1-story-sequence.contrast-1` body "Poi marks the second step." They inflate the teach:question ratio (B1 1.26, B2 1.30) without teaching.
- **Reserve items without authored feedback**: `addReserve()` copies the whole target explanation into both `explanation` and `hint`: `v2-b1-earlier-past.reserve-1` hint = 47-word paragraph; `v2-b1-object-agreement.reserve-1/2` hint = 70 words. 44/218 B1 and 38/205 B2 questions have explanation == target explanation.
- **C1/C2 boilerplate**: "Transfer the distinction" is 26 of 96 teach steps in each level, every one with the identical body and example "Nel nuovo contesto, la scelta dipende dal tempo e dal punto di vista." All 8 items of `v2-c1-u3-claim-evidence` (q1–q8) and all 8 of `v2-c2-u10-source-conflict` share one verbatim explanation; 23/111 C1 and 26/114 C2 questions. The portfolio rubric is identical across C1/C2 grammar lessons ("Keep facts, inference and your own position distinct. | Use the construction taught … | Make the intended audience and source attribution clear." in `v2-c1-u1-*`, `v2-c1-u10-impersonal-register`, `v2-c1-u12-reduced-formal-clauses`, `v2-c2-u1-mood-evidence`, `v2-c2-u3-negation-scope`, `v2-c2-u6-contemporary-variation`).
- **Frame reuse**: 36 % of A1 contexts and 29 % of A2 contexts repeat another context's frame ("N ___ a N." ×8). **34 exact contexts** are shared across different lessons ("Ho ___ libri." in `v2-a1-small-numbers`, `v2-a1-numbers-eleven-twenty`, `v2-a1-many-few`; "Io ___ Luca." in `v2-a1-essere-singular` and `v2-a2-past-auxiliary-person`; "Vado ___ mercato." in `v2-a1-a-in-articles` and `v2-a1-a-articles-system`). `v2-a1-avere-plural.s9` (reserve) is identical to `.s8` ("Noi ___ una casa." → *abbiamo*). `v2-a2-relative-superlative` uses *il più alto / la più alta* in all 8 items.

### High

**H1 — `v2-a1-near-far` enforces a half-rule and rejects correct Italian.** Takeaway: "As adjectives, vicino/vicina and lontano/lontana agree with the thing located." *Vicino a* / *lontano da* are standard as invariable adverb/preposition (*La casa è vicino a Roma*). Strict items reject it: `s9` "La scuola è ___ Roma." → "vicina a" STRICT; `review-0` "La scuola è ___ casa." → "vicina a" STRICT; `review-1` "Il mercato è ___ Roma." → "lontano da"; in `s5` "La scuola è ___ Milano." the option "lontano da" is marked wrong.

**H2 — `v2-a1-a-in-articles` teaches *nella casa*.** `s3` "Il pane è nel frigo. **Il libro è nella casa.** — The book is in the house."; `s7` "Il libro è ___ casa." → *nella*; recap `s11` repeats it. Natural Italian is *in casa / a casa*; *nella casa* needs a specifier.

**H3 — `v2-a2-compare-activities` is unidiomatic throughout.** `s2` "Leggo più che scrivo."; `s3` "Scrivo meno che leggo."; `s4`–`s10` "Cammino più che corro", "Parlo più che scrivo", "Leggo meno che parlo"; passage `s7` "Anna legge più che scrive. Luca scrive meno che legge." Two finite verbs joined by *più che* is not how Italian compares activities (*Leggo più di quanto scriva/scrivo*; *Mi piace più leggere che scrivere*).

**H4 — B1 *ce ne* conflates two different *ce*.** `v2-b1-ne-quantity.teach-3`: "Before a finite verb, ci becomes ce beside ne: Ce ne servono due." — that *ce* is dative *ci* ("to us", *servire a*), not locative; `check-2` explanation then says the opposite ("Ce ne preserves the of-them meaning and the recipient 'us'"). `v2-b1-ce-ne-quantity.teach-1` "ce ne avoids repeating biglietti"; `check-3` "Ce ne works with one too"; "Ce ne servono due" translated "Two are needed" (drops *we*); `check-4` "With voglio, simple ne replaces copies; ce is not needed here" (true, wrong reason); the passage then uses locative "Nell'ufficio **ce ne sono** solo sei". The learner is told *ce ne* is a "two-part quantity pronoun" (`check-2` hint).

**H5 — Nine pronunciation lessons have no audio and test letter-spotting.** No clip in `audio.json` for `v2-f-keep-c-hard`, `v2-a1-vowels-stress`, `-written-accents`, `-silent-h`, `-double-consonants`, `-question-intonation`, `-g-and-gh`, `-sc-and-sch`, `-gn-and-gli` (only `v2-f-sound-c` has one); sound is available only via the per-word TTS button. Items: `v2-a1-vowels-stress.q0` "Which two vowel letters occur in casa?" → "a and a"; `.q3` "Which is the first vowel letter?" → "i"; `v2-a1-question-intonation.q3` "Hai un libro? — Does this line ask for an answer?" → "Yes"; `.q6` → "No". A1 has 55 two-option items, almost all here. `v2-a1-double-consonants` makes *pala* (shovel) and *pena* core A1 lexicon just to supply a minimal pair.

**H6 — Redundant and overlapping lessons.** *tu* commands taught twice with the same verbs: `v2-a1-familiar-commands` (*parla, prendi, dormi, non parlare*; `s4` "Prendi il libro, per favore") and `v2-a2-tu-commands` (*parla, prendi, dormi, aspetta*; `s5` "Anna, prendi il libro") + `v2-a2-negative-commands`. *a + article* taught three times: `v2-a1-a-in-articles`, `v2-a1-days-clock` (alle/all'una), `v2-a1-a-articles-system` (whole paradigm *and* clock again, `s4`). B1 `v2-b1-story-sequence` (*prima, poi, alla fine*) and `v2-b1-story-outcome` (*per questo*) are A2 material after `v2-a2-link-reason-sequence`.

**H7 — Wrong or misleading explanations/glosses.** `v2-a2-direct-singular.s10`: context "La pizza? Io ___ compro oggi.", explanation "**Casa** is feminine singular." · `v2-a1-potere-requests.s6`: "Signora, ___ entrare?" glossed "Madam, **may you** come in?" · `v2-a1-essere-polite.s4` "Dottore, Lei ___ il medico?" ("Ask a doctor politely whether he is the doctor") · `v2-a1-days-clock.review-1` speak "Il treno parte **all' una**." and `v2-b2-dislocation.check-1` speak "La lettera, **l' ho** scritta ieri." (speak built by `context.replace('___', answer)`, so elided answers get a stray space) · `v2-f-courtesy.s3` model "Scusi, per favore. — Excuse me, please." (also the recap example) · `v2-a1-venire.s9` "Oggi noi veniamo da Milano. — Today we come from Milan." · `v2-a1-plural-spelling.s8` "Due città sono vicine." · `v2-a1-my-possessives.review-0` "Dove è ___ casa?" · `v2-a2-story-contrast.s10` "…ha chiamato **quando** Anna era a casa" translated "while".

**H8 — C1/C2: C-level in input and production, B-level in what is graded.** Graded targets: `v2-c1-u1-subjunctive-perspective` (*È sorprendente che Luca sia già qui* vs *dice che è*), `v2-c1-u10-impersonal-register` (*si cercano volontari / si lavora*), `v2-c1-u12-reduced-formal-clauses` (*in caso di / in seguito a*), `v2-c2-u1-mood-evidence` (*so che il treno è partito / è possibile che sia partito*), `v2-c2-u3-negation-scope` (*non tutti* vs *nessuno* — logic, not Italian), `v2-c2-u6-contemporary-variation` (*a me mi piace* → *mi piace*). Comprehension checks are English with English options: 22/111 C1, 26/114 C2; several answerable by common sense: `v2-c1-u3-claim-evidence.q7` "Test the extension before adopting it permanently" vs "Promise that it will pay for itself" / "Dismiss all interest in longer hours"; `v2-c2-u10-source-conflict.q3`. Both lessons of `v2-c1-u1` share the same words step (*verbale, guasto, accertato, attribuire*) and the identical passage "A bridge reopening in three accounts". What *is* C-level: the Pirandello (`v2-c1-u8-narrative-stance`, 106 s LibriVox) and Collodi (`v2-c2-u5-literary-narrator`, 135 s) listening with real narrative-stance questions; the 180–290-word dossiers; the two-audience mediation (`v2-c2-u12-integrated-dossier.listen-portfolio`) — all ungraded.

### Medium

**M1 — Malformed distractors** (the plan allows misspelled choices only in labelled spelling activities): "Sono ci", "È ci" (`v2-a1-there-is.s4–s7`), "hano" (`v2-a1-avere-plural.s6`), "libre", "studentes" (`v2-a1-noun-plurals.s4/s6`), "amice", "citte", "cittàe" (`v2-a1-plural-spelling`), "grandie" (`v2-a1-adjective-agreement.s6`), "capisciamo" (`v2-a1-present-isc.s5`), "Mi chiamo?", "Arrivederci?" (`v2-f-name-polite.s3/s7`), "ho visitare", "ha visita", "ho ricevo", "hai ricevere" (`v2-a2-past-regular`), "scrivuto", "prenduto" (`v2-a2-past-irregular`), "parliato" (`v2-a2-progressive-present.s5`), "Lo non" (`v2-a2-direct-elision-negation.s5`), "Non nessuno", "Non niente" (`v2-a2-nobody-nothing`), "parlano si", "sono si" (`v2-b1-impersonal-si`), "Ne ci" (`v2-b1-ce-ne-quantity`), "la pioggia" as a reading distractor (`v2-b2-capstone-accounts.check-3`).

**M2 — Attested variant marked wrong**: *veduto* in `v2-a2-past-irregular.s4/.s9`.

**M3 — Input is too short for the level.** Passage words (median/max): A1 12/36, A2 12/43, B1 23/110, B2 24/177, C1 83/263, C2 92/293. A typical B1 listening: `v2-b1-story-background-event.listen` "Ieri preparavo la cena. Sara è arrivata alle sette. Poi abbiamo mangiato insieme." All 130 listen passages have reviewed clips (128 Kokoro + 2 LibriVox; `audio-review.json` 0 flagged), so the gap is text, not assets.

**M4 — Hints give away answers; guided ≈ independent.** 17 % of A1 hints contain the answer; 28 % of A1 hints equal the explanation (`v2-a1-small-numbers.review-0` hint "Four is quattro."; `v2-a1-family-possessives.s4` hint "Say mia madre." for "___ madre è qui"). Guided items are formally identical to independent ones (`v2-a1-essere-singular.s4` "Io ___ Anna." vs `.s5` "Tu ___ di Roma?").

**M5 — Facets are nominal.** All A2 U1–U6 lessons have one facet equal to the lesson id (`facets=[a2-reflexive-me-you]`…); all `fresh()` B1/B2 lessons have `facets=['use']`.

**M6 — Portfolios formulaic/mismatched.** `v2-a1-adjective-agreement.s10` "Describe a room" with model "Il libro è piccolo. Le case sono grandi."; A1/A2 model medians 8–10 words; `v2-a2-tu-commands` has no portfolio.

**M7 — Words boards starved** (inferred from `course-words.js`: `MIN_WORDS=3`, verbs never reach a board): many words steps are verb forms or chunks only — `v2-a2-past-auxiliary-person.s1` (five forms of *vedere*), `v2-a2-essere-travel.s1`, `v2-a2-reflexive-past.s1`, `v2-a1-andare.s1`, `v2-a1-essere-singular.s1`, `v2-f-name.s1` — so the drill cannot appear where no nouns are introduced.

**M8 — Minutes are a constant**: every A1–B2 lesson is 7 min whether 9 or 21 steps (`v2-b1-object-agreement` 21 steps; `v2-c2-u12-integrated-dossier` 23 steps + 290-word dossier + two recordings = 12 min).

**M9 — Order inside A1**: U13 question words (*chi/che cosa/quando/come/perché/quanto/quale*) and U14 full *a/di + article* are chained after `v2-a1-first-past-message`, i.e. after passato prossimo; `v2-a1-present-questions` teaches only *dove*. Pronunciation lessons hang off unrelated prerequisites (`v2-a1-sc-and-sch` ← `v2-a1-a-in-places`).

### Low

- Recap steps add nothing (60/60 A1 "Keep this" bodies == takeaway). · `v2-a1-demonstratives` teaches *quel/quella* only; *quello/quell'/quei/quegli* first at B2. · `v2-a1-piacere` teaches *mi piace/piacciono* only; *ti/le/gli piace* never taught (only teach occurrence: `v2-c2-u6`). · Oversized words steps: `v2-a1-small-numbers` 12 glosses, `v2-a1-a-articles-system` 9, `v2-a2-direct-attached` 10 (plan target 3–5). · Prerequisite chains are strictly linear per level.

## 4. Syllabus comparison

| Topic | Expected | Where Parola teaches it | Gap / misplacement |
|---|---|---|---|
| Greetings, courtesy, repair | A1 | Foundations U1–U2 | OK |
| Sound/spelling patterns | A1 | Foundations U3, 9 A1 lessons | No audio; tested as spelling (H5) |
| Numbers 0–20 | A1 | A1 3.3, 10.1 | OK |
| Numbers 21–99, 100+ | A1 | **never**; only *trenta/quaranta/cinquanta/cento* (10.2); *ventuno…novanta* first in B2 | **Gap** |
| Ordinals | A1/A2 | never before B2 | Gap |
| Days of week | A1 | *lunedì, martedì, sabato* only (10.3); rest first taught B1 7.2 | **Gap** |
| Months, dates, seasons | A1 | never (used from B1); seasons first B1 | **Gap** |
| Clock beyond whole hours | A1 | never | **Gap** |
| Colours | A1 | never | **Gap** |
| Weather | A1/A2 | *piove* only | **Gap** |
| Articles, plurals | A1 | A1 U2, U4 | OK |
| Adjectives/agreement | A1 | U4: *piccolo, grande* only | Gap (no descriptive adjectives) |
| essere/avere, c'è/ci sono | A1 | U1, U3, U8 | OK |
| Regular present | A1 | U5–U6 | OK |
| Irregular present | A1 | andare/fare/venire (partial persons); *stare* only as *Come stai?*; *dire, uscire, sapere, bere, dare* never | **Gap** |
| Modals | A1/A2 | *posso/puoi/può, voglio/vuoi, devo*; *vuole/deve* only in reserves | Gap + teach-after-test |
| piacere | A1 | *mi piace/piacciono* only | **Gap** (*ti/le/gli piace* never) |
| Possessives | A1 | *mio, tuo* (U9) | **Gap**: *suo/sua* never taught (used in 17 lessons), *nostro/vostro/loro* never |
| Demonstratives | A1 | *questo/a, quel/quella* | *quello/quei/quegli* only B2 |
| Family | A1 | *madre, padre, figlio, zio/zia* | **Gap**: *fratello, sorella, nonni, marito, moglie* first B1 |
| Food/café | A1 | ~9 nouns | Thin |
| Routine, reflexives | A2 | A2 U1 (*alzarsi, lavarsi*; *vi/loro* never) | Gap |
| Prepositions, articulated | A1/A2 | A1 U7, U8, U14; A2 U13 | OK (*tra/fra* never) |
| Question words | A1 | A1 U13 | Good, misplaced after passato prossimo |
| Professions, nationalities | A1 | never | **Gap** |
| Shopping, clothes, directions | A1/A2 | *Quanto costa?* only | **Gap** |
| Health | A2 | *la febbre* (B1) | **Gap** |
| Passato prossimo | A1/A2 | A1 U12, A2 U2–U3 | OK (4 irregular participles) |
| Imperfetto | A2 | A2 U4 (io, lui/lei only) | **Gap**: plural persons never taught, tested at B1 |
| PP vs imperfetto | A2/B1 | A2 U5, B1 U1, U3 | OK |
| Progressive | A2 | A2 U6 | OK |
| Object pronouns | A2 | A2 U7–U8 | Good |
| Future | A2 | A2 U9 (sg. only) | **Gap**: plurals never taught, tested at B1 |
| Conditional | A2/B1 | chunks only | **Gap**: paradigm never taught, required at B2 |
| Comparatives | A2 | A2 U11 | *più…che* between verbs unidiomatic (H3); *tanto…quanto, migliore* missing |
| Quantifiers | A1/A2 | A1 10.4, A2 11.5 | OK |
| Imperatives | A2 | A1 11.4 + A2 U12 (duplicated) | 3–4 verbs; irregulars missing |
| da duration/origin | A2 | A2 U13 | OK |
| Relative che; se + present | A2 | A2 14.2, 14.3; B1 U7 | OK (duplicated) |
| Indefinites, connectives | A2 | A2 U15 | Good |
| ne, ci | B1 | B1 U5 | *ce ne* misdescribed (H4) |
| Combined pronouns; trapassato; che/cui | B1 | B1 U4, U2, U6 | OK |
| Present subjunctive | B1/B2 | B1 U9, B2 U1 | OK |
| Reported speech; impersonal si; passive | B1/B2 | B1 U10–11, B2 U4–5 | OK |
| Participle agreement with clitics | B1 | B1 U12 | Good |
| Imperfect/pluperfect subjunctive, hypotheticals | B2 | B2 U2–U3 | OK; forms piecemeal |
| Passato remoto; gerund/infinitive; clefts | B2 | B2 U11, U6–7 | OK |
| Lexical precision/register (C1 plan U7) | C1 | `v2-c1-u7` = obligation + proportional comparison | **Gap** |
| Extended listening, varied voices | C1/C2 | 2 literary recordings; rest synthetic ≤ 60 s | Partial |

## 5. Strengths

- Honest linguistics: speaker gender always stated before agreement (`v2-a2-essere-travel.s4`, `v2-a2-imperfect-states.s10` "I, a man…"); alternatives acknowledged (`v2-a2-simple-versus-progressive` "Both may be possible…"; `v2-a2-progressive-past` "Ordinary imperfetto may also…"; `v2-b2-passato-remoto` "spoken use varies by region"). Takeaways are, with the exceptions above, correct.
- The 2 October lessons prove the capability: `v2-a1-question-words-2` (Italian-only bookshop dialogue, accent `errors`, accepted *Cosa/Che*), `v2-a1-ask-and-answer.s10` (typed full sentence with `accepted` and two diagnosed misspellings), `v2-a2-direct-elision-negation.s7` (five-turn phone dialogue), `v2-a2-nobody-nothing` (*extra-non* tag), `v2-a2-everyday-links` (accepted *Dunque/Quindi*), `v2-b1-object-agreement` (agreement diagnoses, 100-word voicemail, realistic portfolio).
- Foundations does what the plan promised (chunks, no conjugation test, meaning-first *chilo*).
- Audio: all 130 listen passages have bundled, Whisper-checked clips (0 flagged); listening evidence separated from reading; two LibriVox readings.
- C-level inputs and tasks (dossiers, two-audience briefs, Pirandello/Collodi) are the right shape; B2 `v2-b2-capstone-accounts` (180-word two-voice reading, 100–130-word position) is genuinely B2.
- The data model (stable ids, reserves, `exposureGroup`, `passageId/audioId`, `background`, `errors`, `accepted`, `strict`) will carry better content without change.

## 6. Proposals

### (a) Revised spine

**Foundations**: keep (3 units, 8 lessons); add one reviewed clip per pronunciation item.

**A1** (12 units, ~45 lessons): 1 Who you are — *essere* all persons, *tu/Lei*, nationalities, *Come stai?*, *chi/dove/come/di dove* · 2 Things around you — articles, gender, plurals, *questo/quello* all forms, colours, objects, *c'è/ci sono* · 3 Having and counting — *avere* all persons, numbers 0–100, age, prices, *quanto/quanti* · 4 Family and people — *suo/sua, nostro/vostro*, family nouns, descriptive adjectives, professions · 5 Everyday actions — regular present all persons, *non*, questions, days, *stare/fare/andare* full · 6 Food and the café — *-ere/-ire/-isc*, *bere/prendere*, modals full, *vorrei*, ordering, quantities · 7 Going places — *andare/venire/uscire*, prepositions and articulated forms (two lessons), directions, transport · 8 Likes and time — *piacere* with all indirect pronouns, clock incl. *e mezza/un quarto/meno*, months, dates, seasons, weather · 9 Routine — reflexives all persons, *prima/poi/dopo*, frequency, *mentre* · 10 Requests — *tu/Lei* imperatives (one unit), phone/shop/doctor, body and *mal di…* · 11 Yesterday — passato prossimo, 10 irregular participles, *ieri/fa/scorso* · 12 Checkpoint (keep `read-a-message`, `listen-for-a-detail`). Pronunciation: fold nine lessons into four with recorded minimal pairs, placed in units 1, 2, 5, 9.

**A2** (13 units): 1 Past events (participles, agreement, reflexive past) · 2 Background and story (imperfetto **all persons**, habit vs event, interruptions) · 3 In progress · 4 Direct objects (elision, attachment) · 5 Recipients · 6 Plans (future **all persons**) · 7 Politeness and wishes (conditional **full paradigm**) · 8 Comparing (*di/che* rule done correctly, *tanto…quanto*, superlatives, *migliore*) · 9 Instructions (voi/Lei, negatives, pronoun + imperative, *va'/fa'/di'/sta'*) · 10 Place and time (*da*, *in/su/da* + article, *ci*, *fa/scorso/prossimo*) · 11 Describing and shopping (clothes, *quello/bello*, *ne*) · 12 Linking (relatives, *se*, indefinites, connectives) · 13 Checkpoint.

**B1**: keep the 13-unit frame; merge 1.2+1.3; replace the *ce ne* lessons with a *ci/ce/ne* lesson that separates dative and locative; add modals in the past, *stare per/volerci/bisogna*; lengthen readings to 80–150 words and listenings to 30–60 s with two voices.

**B2**: keep 13 units; fold 1.1+1.2 with a full present-subjunctive table; give full imperfect/pluperfect subjunctive and conditional paradigms before use; inputs 200–300 words; add the lexical/register unit the C1 plan promises.

**C1/C2**: keep themes and inputs; replace graded B-level grammar with C-level discriminations (register/pragmatic choice in Italian, collocation, cohesion editing, reformulation with `accepted`); questions and options in Italian; item-specific explanations; different passages for the two lessons of a unit; more human voices.

### (b) Rewrite / keep / merge / cut

- **Rewrite (wrong/unidiomatic)**: `v2-a1-near-far`; `v2-a1-a-in-articles` s3/s7/s11; `v2-a2-compare-activities`; `v2-b1-ne-quantity` teach-3/check-2; `v2-b1-ce-ne-quantity`; `v2-a2-direct-singular.s10`; `v2-a1-potere-requests.s6`; `v2-a1-essere-polite.s4`; `v2-f-courtesy.s3`.
- **Rewrite (teach-after-test)**: `v2-a1-want-need` reserves; `v2-a2-imperfect-are/-ere-ire/-states`, `v2-a2-future-are/-ere-ire/-irregular`, `v2-a2-conditional-plan` (add paradigms); `v2-b1-plan-options`, `v2-b1-revise-plan`, `v2-b1-changing-duration`, `v2-b1-story-background-event` (bridge or reorder).
- **Merge**: `v2-a1-familiar-commands` + `v2-a2-tu-commands` + `v2-a2-negative-commands`; `v2-a1-a-in-articles` + `v2-a1-days-clock` (clock) + `v2-a1-a-articles-system`; `v2-b2-subj-regular` + `-irregular`; `v2-b1-story-sequence` + `-outcome`; the two number lessons + a new 21–100 lesson; the nine pronunciation lessons → four; `v2-c1-u1-*` (shared passage).
- **Cut/demote**: `v2-a1-vowels-stress`, `v2-a1-question-intonation` as currently designed; `v2-a1-double-consonants` unless re-based on frequent pairs (*nono/nonno, sete/sette, casa/cassa*); all "Notice why it fits"/"Transfer the distinction" steps.
- **Keep as models**: Foundations U1–U3; `v2-a1-question-words-1/2`, `v2-a1-ask-and-answer`, `v2-a1-a-articles-system`, `v2-a1-di-articles`, `v2-a1-read-a-message`, `v2-a1-listen-for-a-detail`; `v2-a2-direct-me-you-us`, `v2-a2-direct-elision-negation`, `v2-a2-direct-attached`, `v2-a2-in-su-da-articles`, `v2-a2-someone-something`, `v2-a2-nobody-nothing`, `v2-a2-everyday-links`; `v2-b1-object-agreement`, `v2-b1-listen-practical-update`, `v2-b1-che-cui`, `v2-b1-impersonal-si`; `v2-b2-capstone-accounts`; `v2-c1-u8-narrative-stance`, `v2-c2-u5-literary-narrator`, `v2-c2-u12-integrated-dossier` (inputs and portfolio).

### (c) Pipeline rules

1. Hand-write every model and item; generators become validators only — no step text from string templates (`Try ${title} again`, `separatedChecks`, `addReserve`, "Transfer the distinction").
2. Lexical budget per unit (domain + 20–30 new dictionary words), enforced: fail a unit whose contexts add fewer than N content types or whose top tokens are names; target ≥ 600 word types by end of A1 and ≥ 1,200 by end of A2 (now 491/750).
3. Variety gates: no prompt > 25 % of a level; no exact context reused across lessons; no frame > 2× per lesson; reserves differ in frame and lexis; hint ≠ explanation; hint must not contain the answer; explanation ≠ target explanation.
4. Paradigm-completeness gate: a form may appear in a question only if a teach step in the lesson or its real prerequisite chain lists that exact form (including reserves and passages).
5. Distractors must be real Italian forms from dictionary/conjugator (person, auxiliary, gender, mood confusions), never invented strings, except in lessons tagged `spelling`.
6. `accepted` variants by default on typed items (invariable/agreeing forms, elision, *cosa/che cosa*, *niente/nulla*, *allora/dunque/quindi*); `strict` only where the contrast is the target.
7. Input floors: reading ≥ 40 words at A1 checkpoint, ≥ 80 A2, ≥ 120 B1, ≥ 200 B2, ≥ 250 C; listening ≥ 15 s A1, ≥ 30 s B1, ≥ 60 s B2+, two voices from B1.
8. Pronunciation = audio first: a sound item must reference a recorded clip before the choice.
9. Native review as a hard gate with a checklist (naturalness, gloss fidelity, register, collocation, speak-string rendering, explanation names the right noun).
10. Item-specific feedback on every question; the engine re-shows teach steps, the content does not fake them.
11. Facets must be real contrasts (person, auxiliary, gender, placement), never the lesson id or `use`.
12. Minutes computed from steps and passage length.

### (d) Top 15 quick wins

1. `v2-a1-near-far`: add `accepted: ["vicino a"]`/`["lontano da"]` to `s9`, `review-0`, `review-1`; stop marking "lontano da" wrong in `s5`; rewrite the takeaway.
2. `v2-a1-a-in-articles` s3/s7/s11: *Il libro è nella borsa / nello zaino* instead of *nella casa*.
3. `v2-a2-compare-activities`: rewrite all nine sentences to *Leggo più di quanto scrivo* / *Mi piace più leggere che scrivere*.
4. `v2-b1-ne-quantity.teach-3`, `v2-b1-ce-ne-quantity` teach-1/check-3/check-4: say *ce* = *ci* "to us" before *ne*; translate "Ce ne servono due" as "We need two of them"; add a locative *ce ne sono* contrast item.
5. `v2-a1-want-need.review-0/1`: use taught forms or add a teach line for *vuole/deve*.
6. `v2-a2-imperfect-are`, `v2-a2-future-are`, `v2-a2-conditional-plan`: add a six-person paradigm teach step and one item per plural person.
7. `v2-a2-direct-singular.s10`: "Pizza is feminine singular."
8. Fix `speak` for elided answers (`v2-a1-days-clock.review-1` "all' una", `v2-b2-dislocation.check-1` "l' ho").
9. `v2-a1-potere-requests.s6` gloss → "Madam, you may come in"; `v2-a1-essere-polite.s4` → "Signora, Lei ___ la madre di Anna?".
10. Replace the M1 malformed distractors with real forms (e.g. *hano* → *avete*; *parliato* → *parlato*; *scrivuto* → *scritta*; *Sono ci* → *Ci*; *Mi chiamo?* → *Come si chiamano?*).
11. `v2-a1-avere-plural.s9`: new context (it duplicates `s8`).
12. Add all seven days to `v2-a1-days-clock`, *suo/sua* to `v2-a1-family-possessives`, months to the appointment passage.
13. Delete the ~220 auto-generated "Notice why it fits"/"Transfer the distinction" teach steps.
14. Write item-specific explanations for the 16 items in `v2-c1-u3-claim-evidence` and `v2-c2-u10-source-conflict`; put prompts/options in Italian.
15. Record one Kokoro clip of the minimal pairs per pronunciation lesson and reference it from a `passage` before the first question; turn letter-spotting items into hear-and-choose.

## 7. Verified vs inferred

**Verified** (read in the dumps or computed over the JSON): every lesson/step id and quotation above; all counts (prompts, frames, lexicon, duplicates, hint==explanation, explanation==target, English options, auto-echo steps, passage lengths, minutes, audio coverage, two-option items); audio: 130 assets (128 synthetic, 2 recorded), every `audioId` resolves, no clips for the nine pronunciation lessons, `audio-review.json` 128 entries with none flagged; generator behaviour read in the tool sources.

**Inferred** (not executed): that words boards are empty for verb-only words steps (from `course-words.js` logic, not from running `test-course-words.mjs`); that TTS is the only sound in pronunciation lessons (from `speakBtn` usage and absent clips; voice quality untested); that C1/C2 English items are answerable without the Italian (my reading, not a learner trial); naturalness judgements (H1–H3, H7, M6) are native-speaker judgements; A2–C2 findings generalise from the sampled lessons (36/58, 20/41, 9/41, 6/24, 6/24) plus whole-corpus scripts — unsampled lessons may hold further errors of the same kinds.
