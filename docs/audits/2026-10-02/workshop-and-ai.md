# Parola audit 2 — Sentence workshop, Useful words, On-device AI

Repository `/home/user/italianapp`, branch `claude/dreamy-darwin-fqjhm8`, commit `bd60180`. Read-only review, 2 October 2026.
Working files: `dump.mjs` / `dump-all.txt` (all 21 lessons), `engine-probe.mjs` / `engine-probe.out` (free-entry and build probes), `fitrun/fitprobe.mjs` / `fit-probe.out` (real int8 BERTino scoring through the app's own worker recipe), `shots.mjs`, `hub.mjs`, `hub2.mjs`, `shots-notes.txt`, screenshots in `shots/` (430×932, iPhone 13 profile, dark theme).

## 1. Verdict

The workshop is a well-built, well-written product surface: 21 lessons / 168 activities (dump: 21 model, 43 order, 62 cloze, 21 dialogue, 21 build), the Italian is almost entirely correct and idiomatic, the player is polished, resume/persistence/XP work, and the engine is cleanly separated and Node-testable. The authored content needs only a handful of small fixes (§2).

The weak point is the thing the owner cares most about, "it should be correct": the free-entry and *Say it yourself* checks are far more permissive, and in places more restrictive, than the README/plan claim.

- **False accepts (silent corrections).** Any inflection or English gloss of an accepted lemma is graded *Esatto*: `stanchi`, `stanca`, `tired`, `sono tired` → "sono stanco · correct" (`engine-probe.out` 361-372, 380); `alti`, `simpatica` → "alto/simpatico · correct" (442, 450); wrong tenses `mangiato`, `mangerà`, `mangiava` → "mangia · correct" (180-183, 396). The bank trap `sono stanchi` in `sl-strutture-06…4` is graded **correct** and silently rewritten to `sono stanco` (shot `23-bank-trap-graded`, `data-outcome="correct"`). The learner's actual error is never shown, so the agreement the lesson is about is never tested through free entry.
- **Grammar-only, meaning-blind accepts.** `Marco piace la pizza`, `Marco dorme la pizza`, `Ieri sera sono andato un bel film`, `Mio fratello è più migliore di me`, `Studio l'italiano non`, `Studio l'italiano mai` are all "Accepted · your own words" (394, 391, 435, 445, 406-407; shot `20-free-accept-mai`). *Say it yourself* saves `Io sono una studentessa` for a male speaker and `Mia sorella è un fratello` to *Le mie frasi* with "+15 XP" (shots `16-build-gender-hole`, `17-build-kept`, `18-complete`).
- **False rejects of exactly what the lesson teaches.** Typing the taught compound forms `ho preso`, `ho bevuto`, `sono andato`, `ho dormito` in a passato slot → "not in the dictionary yet" (217, 223, 239, 433-436); time phrases `il martedì`, `la notte`, `di notte`, `il sabato`, `tutti i giorni` in the "Dove e quando" adverb slot → "not in the dictionary yet" although the blank's own options are `il lunedì`, `la sera` (401-411; shot `19-free-reject-martedi`); `ho caldo`, `ho freddo`, `sto bene` in "Bene grazie, ma ____" → rejected (365-367; shot `21-free-reject-ho-caldo`).
- **Layer 2 (fit scorer) misleads.** With the real model, the lesson's own bank word `libero` and the natural `rilassato`, `triste`, `tranquillo` get **odd here** in "Oggi sono ____ perché è sabato", `il gelato` (a bank word) gets **odd here** in "Mi piace molto ____", while ungrammatical `non`/`mai` get only **unusual here** (`fit-probe.out`; shot `26-fit-note-odd`). The scale is anchored to the *worst authored option*, and the options passed include the deliberately wrong distractors (`mangio`, `mangi`, `alta`, `la più bello`): `labFrasiLesson.js:315` passes `blanks[i].options`, not `accept`.
- **Layer 3 (assistant) can never run on the shipped content.** It fires only when a turn has two or more `"*"` reactions and no specific match (`labFrasiLesson.js:255-258`); every one of the 62 `you` turns has exactly one `"*"` reaction (count in §6/§8).

Recommendation in one line: fix the deterministic layer first (it is the authoritative one, and its holes are cheap to close), retire the learner-facing fit note, and point the on-device LLM at *constrained selection* tasks where wrong Italian cannot reach the learner (§6).

## 2. Content findings (Italian, with lesson / activity ids)

I read all 21 lessons in `dump-all.txt`. Overall quality: high; natural, register-appropriate A1–A2 Italian, correct accents and apostrophes, sensible English glosses. The errors and dubious points, all of them:

### 2.1 Errors or clearly unnatural Italian
| # | Where | Text | Problem | Fix |
|---|---|---|---|---|
| C1 | `sl-presente-02-cosa-faccio.6` P4/Y5 and the `dormo` reaction | *E dormi presto?* / *No, dormo sempre tardi.* / *Tardi! Io invece dormo presto.* glossed "do you go to sleep early? / I always go to sleep late" | *dormire tardi* reads as "sleep late (into the morning)"; the gloss means going to bed late. | *Vai a letto presto? / No, vado a letto sempre tardi.* |
| C2 | `sl-presente-06-come-stai.5` Y1 reaction `when: ["sono stanco","sono stanca"]` | *Stanco? Hai lavorato molto?* | Shown unchanged to a learner who answered *sono stanca* (`engine-probe.out` 378). | Split the reaction (`sl-passato-02…4` Y3 already does this correctly). |
| C3 | `sl-passato-05-raccontami.4` Y1, option *ho lavorato* | *Ieri mattina ho lavorato presto.* | Not idiomatic; the reaction *Di mattina presto? Che giornata lunga!* papers over it. | *ho cominciato presto* or drop the option. |
| C4 | `sl-futuro-03-se.5` Y3, accept *resteremo* | *Se piove, resteremo a casa e guardiamo un film.* | Tense mismatch across the coordination. | Accept only *restiamo*, or template *… e guarderemo un film*. |
| C5 | `sl-strutture-02-chi-che-cosa-perche.8` build, extras *perché è interessante/bello/utile…* with object *i film italiani* | *Io guardo i film italiani perché è interessante.* (528) | Agreement with a plural object. | Plural variants or restrict the object list. |
| C6 | `sl-presente-01-chi-sono.7` | *… ha quaranta anni.* | Normal form is *quarant'anni*. | *quarant'anni*. |
| C7 | `sl-presente-03-mi-piace.1` model | pattern `subject: "to me"`; roles tag *Mi* as subject, *la pizza* as object | Contradicts the card's own body ("the thing you like is the subject"). | Tag *la pizza* subject, *mi* as "to whom". |
| C8 | `sl-presente-01-chi-sono.6` Y3 | reaction for *americano/a* equals the `"*"` reaction *Che bello! Io sono di Napoli.* | "Specific" reaction is the generic one. | Author a real one. |

### 2.2 Dialogue design: reactions that ask a question the learner never answers
The next partner line is fixed, so a reaction ending in a question is followed by an unrelated line: `sl-passato-01…5` Y1 *Un film! Al cinema o a casa?* → *E oggi? Hai già fatto colazione?*; `sl-passato-02…4` Y1 *Hai visto un bel film?* / *E dove siete andati?* → *E poi? Hai fatto tardi?*; `sl-passato-03…5` Y1 *In estate?* / *Con chi?* → *E cosa hai visto?*; `sl-futuro-01…6` Y1 *Con chi andrai?* → *E la settimana prossima…*; `sl-futuro-04…4` Y3 *Dove andrai?* → *Io domenica vado al lago…*; `sl-strutture-03…6` Y3 *Studi ancora? Che cosa studi?* → *Lo prendi con lo zucchero?*. Make reactions statements, or let a reaction carry its own `next` turn. Elsewhere the reactions read as genuinely reactive and are the best part of the content (`sl-passato-05…4`, `sl-strutture-05…6`).

### 2.3 Gender-fixed templates vs the speaker setting
Fixed blanks hard-code a gender regardless of *Parlo al…*: `sl-presente-06…3` *ma ____ stanco*, `sl-strutture-02…5` *Perché sei stanco?*, `sl-strutture-06…3` *mi sono alzata* ("I (f)"). Accept lists also contain both genders regardless of the setting (`sl-presente-06…5` Y1 accepts *sono stanco* for a female speaker as *correct*, 376).

### 2.4 Difficulty curve, teaching vs exercising, variety
- Curve: Presente→Passato is the real step; Futuro is easier than Passato; Strutture mixes A2/B1. Within a stage the curve is flat: model → 2–3 order → 2–4 cloze → 1 dialogue → build, 6–9 min. Order has ≤2 distractors; cloze 2–5 options. Stage tints are A1/A2/B1/B2 (`labFrasiLesson.js:20`) while the content is A1–A2.
- Teaching: the model card is a two-sentence primer plus examples and a tip; the teaching lives in the linked course lessons. The workshop *exercises* more than teaches; long tips (imperfetto endings in `sl-passato-04…1`, future stems in `sl-futuro-01…1`) sit below the fold (shot `04-model-card`).
- Variety: 32 activities titled "Build the sentence", 19 "Finish the sentence". 46 free blanks: 31 verb, 9 adj, 4 noun, 2 adv. "Your own words in every blank" mostly means "type any verb".
- Role colouring is inconsistent: prepositional phrases tagged `object` in `sl-presente-01…1`, `sl-futuro-01…1` but `extra` in `sl-presente-04…1`.

## 3. Engine and grading findings (with reproduction)

All runs: `node engine-probe.mjs`; line numbers refer to `engine-probe.out`.

### 3.1 Silent correction is graded as *correct*
`gradeBlank` resolves the typed text, then compares the *resolved* form with the accept list (`sentence-lab.js:185-187`); `inflect` always returns the slot's required form from the lemma (`:410-434`).

| Slot / activity | Input | Result |
|---|---|---|
| `sl-presente-06…5` Y1 adj speaker, wrap `sono {}` (m) | `stanca`, `sono stanchi`, `tired`, `sono tired` | **correct**, *sono stanco* (362, 369, 371, 372) |
| same, female speaker | `sono stanco`, `stanco` | **correct**, *sono stanco* (376-377) |
| `sl-strutture-06…4` Y1, bank chip *sono stanchi* | tap | **correct**, *sono stanco* (380; shot `23`) |
| `sl-strutture-05…4` adj m-sg | `alti`, `simpatica` | **correct** (442, 450); `alta` incorrect only because it is an authored distractor (441) |
| `sl-presente-02…4` verb p2 | `mangiato`, `mangiare`, `eat` | **correct** *mangia* (390, 396, 398); `mangio`/`mangi` incorrect only as authored distractors (388-389) |
| `sl-presente-01…5` adj speaker (m) | `tedesca`, `tedeschi`, `German` | accepted, *tedesco* (416-418) |

Fix: when the typed form differs from the slot's required form of the same lemma, grade `incorrect` with the agreement/person explanation; keep silent re-inflection for the English path only.

### 3.2 Grammar-only, meaning-blind
Verb slots accept any conjugable verb: *Marco dorme la pizza*, *Marco piace la pizza*, *sono andato un bel film* (391-394, 435). Adjective slots accept *molto* (10). Adverb slot accepts *non*, *mai* (406-407; shot `20`). Noun slots: *ho un cane / una fame / uno yoga* (467-472). *più migliore* (445). Minimum: exclude negation/polarity adverbs from `adv`, quantifiers from `adj`, block *più/meno + migliore/peggiore/maggiore/minore*.

### 3.3 False rejects
| Slot | Input | Result |
|---|---|---|
| any passato `verb` slot | `ho preso`, `ho bevuto`, `sono andato`, `ho dormito` | **unknown** (217, 223, 239, 433, 436); `prendere`/`preso`/`prendo` accepted (218-220) |
| `sl-presente-04…4` adv time | `la notte`, `il martedì`, `di notte`, `tutti i giorni`, `il sabato`, `lunedì`, `sabato` | unknown / "is a noun" (401-411; shot `19`); `ogni giorno` → "is an expression" (319); `stanotte` → contradictory "is an adv, not a dictionary word" (322, `sentence-lab.js:495`) |
| `sl-presente-06…5` Y1 | `ho caldo`, `ho freddo`, `sto bene`, `sono molto stanco` | rejected (365-367, 370; shot `21`): only `sono {}` is unwrapped |
| English | `eats`, `drank`, `took`, `watched`, `was sleeping`, `will watch` | unknown (185, 230, 232, 256, 275, 437) |
| noun definite | `Roma`, `Italia` | "proper noun" (117-118) |
| noun | `psicologo` | unknown; suggests *psicoterapia* (146) |

`category` on a slot only *sorts* (`sentence-lab.js:442-448`), never filters.

### 3.4 Small resolution oddities
`zia` → "una zia (uncle)" (142), `cameriera` → "(waiter)" (157); `il dentista` by a female speaker → *una dentista* (139, 473); `visto` → `choose` with *prendersela* (218, 240); `caffe`/`te` not accent-matched on the Italian path (84, 88).

### 3.5 *Say it yourself* (`composeBuild`)
Checked: person→conjugation (`:565-572`), participle agreement via `gender`/`g`/speaker (`:562`, `:47`), required roles, conjugability. Not checked (483-537): predicate-noun gender (*Io sono una studentessa* m, *Mia sorella è un fratello*, *Mio fratello è una studentessa a scuola*; shots `16`, `17`, `18`); any meaning (*Io mangiavo un cane ogni estate*, *Il mio telefono è più bello di Luca*, *Io sono andata insieme*); number for fixed *piace* (526, unreachable from UI); the engine accepts free object strings and conjugates non-existent verbs (*Tu sei blah blah*, *Io xyzo un amico*, 488-491; unreachable from UI). "Keep this sentence" is enabled for anything.

### 3.6 Drills
`buildDrills` (`labFrasiLesson.js:45-58`): meaning MC, recall MC, type (article for nouns); one repeat each (`:381`); all three right → `markLearned`, +10 XP, three `journey-v1` events (`:401-415`); verbs never marked learned (`:359`). Lenient but defensible; XP-farming risk (ten adjectives in one blank = 100 XP). Consider "seen" state and 5 XP.

### 3.7 Progress/XP
15 XP once per lesson (`store.js:587-595`, shot `18`), 0 for repeats, 10 per drilled word, nothing per activity; sessions resume. Flat compared with the course's per-skill credit.

### 3.8 Grading flow
`MAX_TRIES = 2` then reveal (478-479); a fully revealed lesson still earns 15 XP. Course has "Show answer"/"Save this skill for later" (shot `32`); workshop has only "Help me".

## 4. UX findings (screenshots in `shots/`)
No console or page errors across the whole run (`shots-notes.txt`).

| # | Finding | Evidence |
|---|---|---|
| U1 | English line keeps the blank after a free entry ("…and I am ____.", "Fine, thanks! But ____.") — `detailOf` and `dialogueView` use `en` verbatim (`labFrasiLesson.js:102`, `sentence-lab.js:108`) though `resolution.en` is known | `11`, `23`, `26` |
| U2 | Three sizes for one download: "70 MB" (`labFrasi.js:62`), "about 83 MB" (`:48`), "24 MB / 79 MB" (`fmtMB` MiB, `:14`), "83 MB" (`:113`) | `fail-fit…`, `24` |
| U3 | "ODD HERE" on *rilassato*, "UNUSUAL HERE" on *triste*; uppercase red chip inside the sentence, nothing says it is advisory | `26`, `25` |
| U4 | Toast "rilassato · learned" overlaps the Check button | `26` |
| U5 | Speaker-gender control (affects grading) buried at the bottom of the path page; player never shows it | `02`, `03` |
| U6 | "Parlo al… · I speak as" reads as truncation; the assistant's promise never happens (§6) | `02` |
| U7 | *Le mie frasi* keeps nonsense ("My sister is a brother"), no delete | `18` |
| U8 | Free-entry UI good (accent keys, "Did you mean" chips, learn sheet with "+10 XP"/"Not now"); "Help me" is a bare link far below | `09`, `10` |
| U9 | Chat bubbles, reaction highlight, two-blank turns in one bubble: good | `12`, `13`, `14` |
| U10 | Build screen clear; nothing is ever "bad" | `15`, `16` |
| U11 | Path page clear; locked stages give no reason; Strumenti only after scrolling past 21 lessons | `01`, `03` |
| U12 | Model card: pattern chips, role underlines, TTS, useful words | `04`, `05` |

Course-player consistency (`learnCourse.js:132` vs `labFrasiLesson.js:97`; shots `32` vs `08`/`07`): same shell; course kickers English ("Try it together"), lab bilingual ("COMPLETA · FILL IT IN"); feedback titles "That's right. / Let's work through it. / Here's the pattern." vs "Esatto. / Not quite · one more try. / Here is the sentence. / Accepted · your own words."; "Check answer" vs "Check"/"Send"/"Keep this sentence"; A/B/C cards vs chips; course has "Show answer". Same `feedbackHTML` component. Pick one voice; add "Show answer".

## 5. Useful words
- 78/78 ids resolve; `tools/test-useful-words.mjs` checks structure. Notes accurate across all 78 (*qual è*, *dopo di te*, *siccome* never answers *perché*, *qualche* + singular, *già* placement, *gli* "to them", *la* formal, *ne*, *ci/c'è*, *se/sé*, *tanto… quanto*, *non… più*). Quibbles: *ed* "in careful speech", *qua* "same word"; *vicino/lontano* are adjectives in an adverb group (notes handle it). *che* in "Question words" though mostly relative.
- Missing candidates: *neanche/nemmeno, solo/soltanto, appena, comunque, cioè, anzi, magari, ecco, proprio, almeno, mica, pure*.
- Discoverability: present on the Words tab (`33-words-tab-deck`); **absent from the default Learn hub** (Panoramica, `learn.js:22` → `learnDash.js`), which has path / In progress / Up next / Lab only; the deck lives in the alternate Sezioni layout (`learnSections.js:150, 281`); verified fresh and seeded (`hub.mjs`, `hub2.mjs`: `deck: null`). README line 13/17 describes the non-default layout.
- Integration: rows open `#/learn/word/<id>` (`browse.js:174`); Matching/Flashcards/Quiz (`:165-169, 208`). No lesson sequence, no "learn next", no references from course or workshop. Generic word lessons are weak for clitics; cross-link to `sl-strutture-01/-03/-04`.

## 6. On-device AI

### 6.1 Today
**Layer 2** (`fit-scorer.js`, worker, 68.7 MB + 14.3 MB): PLL in a worker, memoised; only dictionary-resolved free words get a note (`labFrasiLesson.js:304`); scale `(pll − worst option)/(best − worst)`, thresholds 0.6/0.2 (`fit-scorer.js:31, 51-63`). Measured with the real model (`fit-probe.out`; load 3.7 s, ~100–350 ms/candidate on x86 WASM):

| Template (options) | natural | unusual | odd |
|---|---|---|---|
| Bene grazie, ma sono ____ (stanco, felice) | annoiato | triste .46, stanca .51, malato, contento, arrabbiato | nervoso, libero, occupato, vecchio, italiano, tedesco, verde, tavolo |
| Oggi sono ____ perché è sabato (contento, contenta, felice) | — | — | libero (bank), stanco, triste, rilassato, tranquillo, nervoso, annoiato, verde, alto |
| Mi piace molto ____ (la pizza, il mare, la musica) | lo sport, il calcio | lo yoga, il cinema | il gelato (bank), il vino, la birra, il cane, l'acqua, la città, Roma |
| Marco ____ la pizza (mangia, mangio, mangi) | preferisce | prende, compra, odia, ama | piace, cucina, beve, dorme, ordina |
| Studio l'italiano ____ (la sera, la mattina, il lunedì, stasera) | oggi, ogni giorno | **non**, **mai**, bene, sempre, qui, la notte | spesso, raramente, forse, il martedì |
| Perché alle tre ho ____ (una lezione, …) | **un cane, un amico** | un colloquio | una visita, un corso, un volo |

Sound signal? No as deployed: floor = worst authored option, options include wrong distractors (`labFrasiLesson.js:315`), PLL measures collocation frequency not grammar/meaning, hard three-word verdicts. Usable as a ranker/tie-breaker/verifier with an absolute threshold, not as a label.

**Layer 3** (`assistant.js`): WebLLM 0.2.85, `Qwen3-0.6B-q4f16_1-MLC` (prebuilt: `vram_required_MB 1403` at 4k ctx, `low_resource_required`), ctx 1,024 (`:14`); `assistantPick` with schema `{choice: enum}`, plain-int fallback, temp 0, 16 tokens, thinking off (`:207-220`); queue of one; 6 s timeout = trip; two trips = breaker; crash flags with pagehide/visibility handling (`:60-81`); guards tested in Node. **In the shipped app it never runs**: `afterTurn` requires ≥2 generic reactions (`labFrasiLesson.js:255-258`); 62 you-turns, 61 with specific reactions, **0 with ≥2 generic**. No polarity tags exist (`grep -rn polarity js/` empty). `releaseAssistant` is never called by the lesson view (only `enableAssistant` at `:265`), so the engine stays resident, contrary to `ASSISTANT-EXPERIMENT.md` line 37. Latency unmeasured (research note line 28); 1–3 s per pick plausible.

### 6.2 Caches on update
`parola-fit-scorer-v1` and `webllm/*` survive activate (`sw.js:46`); `models/`, `vendor/ort/` cache-first (`:82-90`); `fitScorerStatus` compares sizes only (`fit-scorer.js:95`), cache name has no model version → a changed model needs a new path/cache name. WebLLM caches never pruned; no "remove assistant model" control. `build-site.mjs` copies `models/` and `vendor/`, excludes `score.mjs`, verifies `FIT_FILES` sizes (`:145-159`). The 83 MB is justified only if repurposed as internal ranker/verifier (CPU/WASM, ~150 MB RAM, deterministic, no WebGPU); otherwise remove.

### 6.3 Ranked proposal
Design rule: the LLM *selects* (constrained decoding, indices) or writes *English*; any Italian it writes is shown only after the deterministic verifier (dictionary forms, conjugator, `forms` agreement, optional PLL floor), else authored fallback. Latency figures are **estimates** (no public A18 Pro Safari-WebGPU tok/s; nearest data 4–17 tok/s decode on an iPhone 17 Pro Max in another runtime, research note; assumed 0.6B 25–50 tok/s, 1.7B 12–25, 4B 5–12, prefill dominant for short answers; measure in Phase 1).

| Rank | Feature | Value | Risk of wrong Italian | Guard | Latency (est.) | Download | Effort |
|---|---|---|---|---|---|---|---|
| 1 | Intent → build: learner types English intent, model returns role indices, engine composes | High | None (indices) | Per-role enum schema; show chosen items' English | 1–2 s (0.6B/1.7B), 3–5 s (4B) | 0.6B 336 MB / 1.7B ~850 MB | S–M |
| 2 | Meaning verdict for *Say it yourself* `{fine, odd, nonsense}` + authored reason enum; plus **deterministic** predicate-gender check | High | Low | Enum only; never block Keep; log; calibrate on labelled set | 1–2 s | as above | S |
| 3 | "Explain my mistake" in any player, English, personalised to learner's form | High | Low–medium | Italian-quote filter against activity strings/dictionary; authored fallback; 1.7B+ | 3–6 s (1.7B), 8–15 s (4B), streamed | 1.7B | M |
| 4 | Reactive replies by selection from a 6–10 reaction pool (fixes dead code), later slot-templates filled by the engine | Med–high | None / low | Enum; deterministic slot fill; PLL tie-break | 1–2 s | 0.6B | S / M |
| 5 | Fresh example sentences, fully verified, max 2 shown as "model-made" | Medium | Medium | Dictionary+conjugator+agreement+PLL floor; discard failures; 4B | 6–15 s in background | 4B (~2.3–2.6 GB, inference) | M–L |
| 6 | Free generated replies (true branching) | High delight | **Highest** | Full verification + 4B + reviewed sample; visible fallback rate | 2–5 s (4B) | 4B | L |
| 7 | Bounded tutor chat in a lesson | Medium | Medium | Lesson-scoped system prompt; English; quote filter; 3 turns; 1.7B+ | 5–12 s (1.7B), 15–30 s (4B) | 1.7B/4B | M–L |
| 8 | Portfolio writing feedback | High (B1+) | Med–high | Deterministic pass highlights; rubric by constrained choice; English comments; 4B only | 15–40 s (4B) | 4B | L |
| 9 | Pronunciation | — | — | **Out of scope for WebLLM**; separate ASR track (`SpeechRecognition` online, or whisper-tiny/wav2vec2 via transformers.js, 40–150 MB) | — | — | L |

Build order: 1, 2 (+ gender check), 4-selection, 3; measure before 5–8.

### 6.4 Models (WebLLM 0.2.85 prebuilt, q4f16, 4k ctx; licences from memory, verify)
| Model | VRAM MB | low_resource | Weights | Italian | Licence |
|---|---|---|---|---|---|
| Qwen3-0.6B | 1,403 | yes | 336 MB | weak | Apache 2.0 |
| Qwen3-1.7B | 2,037 | yes | ~850 MB | fair | Apache 2.0 |
| Qwen3-4B | 3,432 | yes | ~2.3–2.6 GB (inferred) | good A1–B1 | Apache 2.0 |
| Llama-3.2-1B / 3B | 879 / 2,264 | yes | ~800 MB / ~1.9 GB | supported; 1B weak | Llama 3.2 Community |
| gemma-2-2b-it (-1k) | 1,895 (1,583) | no (yes) | ~1.4 GB | fair | Gemma Terms |
| gemma-3 | **not prebuilt** | — | — | — | Gemma Terms |
| Phi-4-mini | 3,438 | no | ~2.2 GB | English-centric | MIT |
| Phi-3.5-mini (-1k) | 3,672 (2,520) | no (yes) | ~2.2 GB | weak | MIT |

Ship Qwen3-1.7B as default (1k ctx), 0.6B as selection-only fallback, 4B gated on the memory measurement (above the ~1.5–3 GB page-kill band at 4k ctx; 1k/batch-1 may bring it to ~2–2.5 GB, must be measured). Avoid Gemma/Phi. Llama 3.2 3B is an alternative to Qwen3-4B if its Italian evals better. Fit scorer: remove the learner-facing note now; keep files only for a Phase-3 verifier role, else delete `models/`, `vendor/ort/`, worker, Strumenti row, `FIT_CACHE` handling.

### 6.5 Phased plan
- **Phase 0 (1–2 days, no AI):** grade wrong inflections as incorrect with explanation; accept `aux + participle` and multiword time phrases; unwrap `ho {}`/`sto {}`; filter adv/adj slots; predicate-gender check; fill the English blank; one size figure; remove fit note; ≥2 generic reactions or delete the hook. Acceptance: the 23 false accepts and 19 false rejects in `engine-probe.out` reclassified; fixtures added to `tools/test-sentence-lab.mjs`; bank trap graded incorrect.
- **Phase 1 (1 day, phone):** `ASSISTANT-EXPERIMENT.md` steps 1–5 for 0.6B/1.7B/4B at 1k ctx, plus prefill/decode tok/s on a 200-token prompt, 30-min memory survival, battery per 20 picks, cold cache load. Pass: 20 picks, 0 trips, median ≤2.5 s, p95 ≤5 s, no death in 30 min, ≤5 % battery.
- **Phase 2 (1–2 weeks):** ranks 1, 2, 4-selection; eval sets (200 intents, 200 composed sentences, 100 reaction choices). Pass: ≥85 % agreement (1.7B), ≥75 % (0.6B); zero model-written Italian in UI; fallback ≤10 %.
- **Phase 3 (2–3 weeks):** ranks 3, 5, 4-templates; verifier module; Italian-quote filter. Pass: 0 unverified Italian tokens (asserted); ≤30 % fallback; 100+100 outputs native-reviewed ≥95 %; p95 ≤8 s streamed.
- **Phase 4:** ranks 7, 8 only with a 4B tier that passed Phase 1; rubric agreement ≥80 % on 50 portfolio responses; no false correction of a correct sentence.
- Ongoing: "remove model" control; prune old `webllm/*` on model change; wire `releaseAssistant` to lesson lifecycle.

## 7. Strengths
Idiomatic content with gender-aware glosses and genuinely reactive turns; clean, Node-importable engine with careful normalisation; resume/pause/merge/export covered by e2e; course-consistent shell, chat UI, free entry with suggestions/picker/drills, TTS, "Review the pattern" links; no console errors in a full run; dictionary-backed free entry that turns `tedesco` into a reviewed learned word; accurate useful-words notes; iOS-appropriate failure handling in the assistant; honest docs about what is unmeasured.

## 8. Verified vs inferred
**Verified:** all 21 lessons read (`dump-all.txt`); activity and slot counts; 0 turns with ≥2 generic reactions (`{youTurns:62, turnsWithTwoOrMoreGenericReactions:0, turnsWithSpecificReactions:61, turnsWithOnlyStar:1}`); every §3 claim is a line of `engine-probe.out` from the live engine; browser confirmation of bank trap, `il martedì`, `la notte`, `ho caldo`, `mai`, gender hole, end screen (shots 16–23); fit numbers from the real `model.onnx` via the app's worker functions (`fit-probe.out`) and UI notes after a real install (shots 25/26); code citations listed in §3–6; 78/78 useful ids; deck absent from Panoramica on fresh and seeded profiles, present on Words; WebLLM prebuilt ids/VRAM read from the bundle; `FIT_BYTES` 83,251,573 B, `fmtMB` in MiB.
**Inferred:** all phone latency figures and the 4B memory estimate; licence summaries; Qwen3-4B weight size; small-model Italian rankings; "PLL measures collocation not grammar" as my reading of the table; naturalness judgements C1/C3/C6 (C1 regional in colloquial speech); XP-farming as a scenario.
