# Parola — Dictionary, verb engine, reference and games content audit

Repository `/home/user/italianapp`, branch `claude/dreamy-darwin-fqjhm8`, commit `bd60180`. Read-only audit; all scripts and outputs live in `scratchpad/audit2/data/` (`sample.mjs`, `wholeset.mjs`, `conj-hard.mjs`, `ref-rules.mjs`, `games-sample.mjs` and their `*-out.txt`).

## 1. Verdict

The lexical content is in very good shape. Of 200 vocabulary entries and 80 verbs read in full (seed 20261002, stratified by level × pos), I found **0 errors**, 5 vocabulary "doubtful" and 2 verb "doubtful". Whole-set scripts over all 7,000-odd vocabulary entries and all verbs found no empty fields, no missing translations, no glosses containing Italian, no gender/article mismatches, all -co/-go/-cia/-gia/-io/neuter/invariable plurals correct, all 995 explicit adjective form sets correct and 0 disagreements between the `irregular` flag in the data and the engine's own computation.

The real problems are structural rather than lexical, and none is Critical:

- **High:** (H1) the build's "lowest level wins" dedup plus C2 authoring of rare senses means dozens of everyday words (macchia, trasporto, credenza, giostra, mora…) exist only as their rare C2 sense; (H2) a `fold()` bug in the reference codex makes every accent-final noun (caffè, città, università, virtù — 178 nouns) get the wrong or no plural/gender explanation.
- **Medium:** `expr` is a catch-all with ~320 plain noun phrases; one exact duplicate and several near-duplicate idioms; the 55 `aux: both` verbs are presented avere-first in tables and drills even when essere is the dominant choice; cloze multiple-choice has ambiguous distractors; grammar reference covers 12 topics but the course-v2 syllabus references ~15 more; sentence builder accepts one word order only; 14 common verbs missing; "why irregular" panel mislabels accepted alternatives as "regular would be".
- The conjugation engine is excellent: 137 hard verbs, all moods and tenses, all correct except a handful of edge cases (`esserci` compound forms, pronominal idioms' bare participle, no negative imperative, impersonal verbs shown in all persons).

## 2. Sample results

### 2a. Vocabulary sample (200 entries, seed 20261002)

| Level | n | OK | Doubtful | Error | Doubtful ids |
|---|---|---|---|---|---|
| A1 | 33 | 33 | 0 | 0 | — |
| A2 | 33 | 33 | 0 | 0 | — |
| B1 | 34 | 34 | 0 | 0 | — |
| B2 | 34 | 31 | 3 | 0 | `w:ferramenta\|noun`, `w:abbandono_scolastico\|expr`, `w:incendio_boschivo\|expr` |
| C1 | 33 | 31 | 2 | 0 | `w:cortesemente\|adv`, `w:restare_con_un_palmo_di_naso\|expr` |
| C2 | 33 | 32 | 1 | 0 | `w:stemma\|noun` |

Doubtful details:
- `w:ferramenta|noun` (B2): note "feminine and invariable: la ferramenta, le ferramenta". Historically *ferramenta* is a Latin neuter plural; modern usage treats *la ferramenta* as a feminine singular with plural *le ferramenta* (Treccani) — the entry is defensible, so doubtful not error.
- `w:abbandono_scolastico|expr`, `w:incendio_boschivo|expr`: noun phrases (with gender, plural) tagged `expr`; see M1.
- `w:cortesemente|adv` at C1: ordinary adverb, inferred B1-level (inference).
- `w:restare_con_un_palmo_di_naso|expr`: gloss lacks the "to" that all other verbal expressions use (style only).
- `w:stemma|noun` (C2): gloss "stemma (family tree of manuscripts); coat of arms" puts the philological sense first; the everyday sense "coat of arms" is B2-ish.

Fields checked per entry: `it`, `en`, `pos`, `g`, `pl`, `forms` (adj), `ex`/`exEn`, `note`, `level`, `cat`, `register`. Register/note coverage: A1 614/930, A2 609/984, B1 893/1309, B2 1269/1291, C1 1240/1240, C2 1204/1204 entries have a note.

### 2b. Verb sample (80 verbs)

| Level | n | OK | Doubtful | Error |
|---|---|---|---|---|
| A1 | 10 | 10 | 0 | 0 |
| A2 | 14 | 14 | 0 | 0 |
| B1 | 15 | 14 | 1 (`v:dirigersi`) | 0 |
| B2 | 15 | 15 | 0 | 0 |
| C1 | 13 | 13 | 0 | 0 |
| C2 | 13 | 12 | 1 (`v:decantare`) | 0 |

- `v:dirigersi`: third example uses the adjective *diretto* rather than a form of *dirigersi* (example does not exercise the headword; harmless).
- `v:decantare`: usage note "takes essere or avere". *Decantare* "to let settle" (intransitive) with essere is attested but rare; `aux: both` is defensible. Doubtful.

Fields checked: `inf`, `en`, `aux`, `isc`, `trans`, `patterns`, `examples[].it/.en`, `usage`, `irregular` vs `irregularEngine`, `related`.

### 2c. Whole-set scripts (`wholeset.mjs`, output `wholeset-out.txt`)

| Check | Result |
|---|---|
| Exact duplicate headword+pos across source files | 0 after build (build dedups); 1 semantic duplicate pair survives with different slugs (M2) |
| Example lacks headword | 38 flagged, all false positives (inflected forms, elision, clitic attachment) |
| Expression example lacks expression | 0 real |
| Gloss contains Italian / accented chars | 0 |
| Gloss capitalised | 0 unexpected (only proper nouns) |
| Missing en / ex / exEn / pl / g | 0 |
| -co/-go plural (chi/ghi vs ci/gi) | all consistent with stress rule and listed exceptions (amici, nemici, greci, porci, medici, psicologi…) |
| -cia/-gia plural | all correct (camicie, facce, valigie, spiagge, farmacie…) |
| -io plural | all correct (zii, studi, negozi, occhi) |
| masc -o → fem -a plural (neuter) | 3 non-neuter cases, all correct: orecchio→orecchie, uomo→uomini, Dio→dèi |
| fem -a → non -e plural | 3, all correct: ala→ali, casamatta→casematte, acquacotta→acquecotte |
| Invariable noun without note | 21: giovedì, martedì, mercoledì, venerdì, difficoltà, possibilità, verità, libertà, capacità, curiosità, necessità, opportunità, profondità, povertà, disponibilità, località, chat, password, festival, quiz, record |
| `g: mf` noun without note | 7: elettricista, perdente, camionista, abitante, passante, giudice, attaccante |
| Article vs gender/initial | 0 mismatches (`article()` handles s+cons, z, gn, ps, pn, x, y, vowel, i+vowel) |
| Adjective `forms` | 995 sets, all correct incl. -co/-go, -io, -e, invariable (rosa, blu, viola), bello/buono/grande/santo special handling noted in notes |
| Homograph pairs (same `it`, different pos) | 32, all legitimate (e.g. `w:bene|adv`/`w:bene|noun`) |
| Interjections | 47, all correct glosses |
| Placeholder strings ("TODO", "???") | 0 |

## 3. Findings (ranked)

### Critical
None.

### High

**H1 — Shadowed senses and C2 inflation (data model + build).**
`tools/build-data.mjs:45-52` merges source files keyed on `norm(it)|pos`, lowest CEFR level winning. C2 files were authored with rare senses of common words, and no lower-level file defines the common sense, so the only record in the built dictionary is the rare one. Verified lookups in `data/vocab.json`:
- `w:macchia|noun` C2 "Mediterranean scrub, maquis; thicket" — the A2 sense "stain, spot" is absent.
- `w:trasporto|noun` C2 "transport (of emotion); rapture; fervour" — "transport" (A2) absent.
- `w:mora|noun` C2 "default (late payment); delay in performance" — "blackberry/mulberry" absent.
- `w:credenza|noun` "sideboard; dresser (also: belief)"; `w:giostra|noun` "joust, tournament; merry-go-round"; `w:diligenza|noun` "stagecoach (historical); diligence, care"; `w:incanto|noun` "auction (legal); enchantment"; `w:gobbo|noun` "teleprompter (TV jargon); hunchback"; also `w:sbalzo|noun`, `w:china|noun`, `w:secca|noun`, `w:grossa|noun` "gross (144)", `w:balia|noun`, `w:velina|noun`, `w:girata|noun`, `w:storno|noun`, `w:salasso|noun`, `w:cencio|noun`, `w:montante|noun`, `w:fioretto|noun`, `w:occhiello|noun`.
Learner impact: a B1 user searching *macchia* for the coffee stain gets "maquis" at C2 and the word never appears in their level's drills. Separately (inferred CEFR placement), ordinary words sit at C2: borgo, ventre, crepuscolo, grembo, focolare, rotula, sterno, clavicola, cefalea, oblio, tedio, ilarità, prassi, rione, contrada, pegno, vaglia, ebano, garzone, comma, evo.
Correct form: add the base sense at its natural level (dedup will then keep it), or make ids sense-aware (`w:macchia|noun#maquis`) so both coexist.

**H2 — Reference codex plural/gender rule bug for accent-final nouns.**
`js/views/referenceEntry.js:382` `const w = fold(a[0]), p = fold(b[0]);` then `:387` `if (/[àèéìòù]$/.test(w))` — `fold()` strips accents, so the test can never be true. Same pattern in `genderCues()`: `:468` `const w = fold(e.it.split(' ')[0])`, `:473` `/(tà|tù)$/.test(w)`, `:486` `/[àèéìòù]$/.test(w)`. Verified output (`ref-rules-out.txt`):
- caffè → "Invariable: this noun keeps the same form in the plural" (generic fallback, not the stress-accent rule) + gender cue "-e (either)" instead of "stressed final vowel → invariable".
- città → generic plural text + cue "-a (ok): Nouns in -a are feminine…" (misleading: città is feminine because of -tà, and invariable).
- virtù → no cue at all; università, papà → generic.
Affects 178 nouns (159 in -tà/-tù; by level A1 15, A2 12, B1 35, B2 41, C1 47, C2 28). Fix: test the unfolded lemma (`e.it`) for the accent rules before folding.

### Medium

**M1 — `expr` is a catch-all (801 entries).** Breakdown: 125 verbal ("to …"), 231 adverbial, ~122 formulas (greetings, discourse), ~323 noun-phrase-like: incendio boschivo, abbandono scolastico, colonna sonora, ricetta medica, effetto serra, padrone di casa, spese condominiali, tasso di interesse, previsioni del tempo, posto fisso, canto del cigno, figlio unico, senso unico, ora di punta. Meanwhile centro commerciale, volo diretto, campo da calcio, uomo d'affari, cacciatore di teste are `noun`. Consequence: `js/data.js:166` `headword()` shows expr bare (no article), so these get no article, no plural, no gender cue, and are excluded from the articles/plurals games.

**M2 — Duplicates.** Exact: `w:tasso_di_interesse|expr` and `w:tasso_d'interesse|expr`, both B2 "interest rate" (survive dedup because `norm()` keeps the apostrophe). Near-duplicates at different levels: restare/rimanere di stucco (B2/C1), essere nato/nascere con la camicia (B2/C1), essere con/avere l'acqua alla gola (B2/C1), a dire la verità/a dire il vero (A2/B1), non fa niente/fa niente (A1/A2), sull'/all'imbrunire (C1/C2), in attesa di un Suo/cortese riscontro (B2/C1), in alto mare/essere in alto mare (B1/B2).

**M3 — `aux: both` is avere-primary everywhere.** `js/conjugator.js:333-337` `let aux = meta.aux || (cl && cl.aux) || 'avere'; … if (aux === 'both') aux = 'avere';` and `:369` builds cells as `avere-form|essere-form`. 55 verbs are `both`: cominciare, correre, dovere, finire, potere, ripassare, vivere, cambiare, continuare, crescere, girare, guarire, importare, interessare, mancare, nevicare, passare, piovere, ricominciare, salire, scattare, scendere, servire, toccare, volare, aumentare, bruciare, diminuire, migliorare, peggiorare, procedere, saltare, trascorrere, derivare, emanare, equivalere, evadere, fallire, giovare, mutare, precipitare, prevalere, sbarcare, conseguire, sporgere, ammansire, ardere, decantare, deflagrare, deragliare, rifulgere, rinvenire, sbigottire, trasecolare. Effects: salire table shows "ho salito|sono salito/a"; conjugation drill prompt (`js/games/questions.js:237`) says "(use avere)" for all of them; CONJ MC sample #9 presented "avete deragliato" as the answer; essere-dominant verbs (crescere, guarire, mancare, importare, aumentare, diminuire, migliorare, sbarcare, precipitare, deragliare) are drilled with the minority auxiliary. Fix: per-verb `auxPrimary`, or essere-first when `trans` is `vi`.

**M4 — Cloze MC distractors are often not wrong.** Words: `w:perciò|conj` "Ero malato, ? non sono venuto" choices quindi | siccome | perciò | dunque — three are correct. Inflection giveaways: sfusi vs stupendo/graduale/severo; farraginosa vs ispido/acerbo/insigne; rammendi vs singular nouns. Expr clozes use random idioms as distractors. Verb clozes offer grammatical alternatives: affascinano/affascinarono, allegherò/allegheranno/allegherà, estinguerà/estingueva. Cause: `questions.js:177` uses `distractors(e, pool, 3)` which only filters by gloss (`js/data.js:218`), not by pos/number/gender/synonymy.

**M5 — Grammar reference gaps vs course-v2.** `data/grammar.json` has 12 topics (articles, plurals, adjectives, tenses, passato-imperfetto, auxiliaries, reflexives, spelling, isc, imperative, pronouns, prepositions). Course units with no topic: possessives (A1 u9), demonstratives, question words (A1 u13), numbers/time/dates (A1 u10), piacere, relative pronouns che/cui/il quale (A2 u14, B1, B2, C1/C2), subjunctive as its own topic (B1 u9, B2 u1–u2, C1), conditional sentences (A2, B1, B2 u3, C2 u2/u11), passive/impersonal si (B1 u11, B2 u5, C1 u10), reported speech (B1 u10, B2 u4, C1 u2), negation (A2 u15), connectives (A2 u14, B1 u8, B2 u8–9, C1 u11), reduced clauses (B2 u7, C1 u6), cleft/dislocation (B2 u6, C1 u9, C2 u6), nominalisation (C1 u12); comparatives are buried under Adjectives. `js/views/grammar.js:14-27` hard-codes `GRAMMAR_FALLBACK`, so adding topics means touching code. Content of the 12 topics is accurate; one inconsistency: Spelling §3 says "sognamo… not standard" while the engine (`conjugator.js:53`) emits `sogniamo|sognamo` and the codex note says Crusca admits both.

**M6 — Sentence builder accepts one order.** `js/games/sentence.js:91` `const ok = chosen.every((c, k) => c.w === words[k]);` — only the source order passes. 10,182 eligible sentences; 1,242 contain repeated tokens (identical chips, order among them arbitrary but still rejected if swapped), 2,387 contain apostrophe chips (l'amico as one chip).

**M7 — Missing common verbs.** parere, possedere, stringere, esigere, convenire, udire, sedere, giacere, espellere, rifare, benedire, disfare, cucire, dolere are absent from `data/verbs.json` (several appear as examples in grammar.json / codex, so live panels cannot link them).

**M8 — "Why irregular" panel mislabels accepted alternatives.** `explainVerb()` shows the engine's second accepted form as "regular would be": soddisfare "soddisfo · soddisfi · soddisfiamo" (these are accepted forms, not regular ones); compiere/adempiere "compievo"; bere "bo · bi · be" (nonsense: `SUPPLETIVE` at `referenceEntry.js:31` lacks bere so the panel derives a regular paradigm from "bere"). farcela lead says "plus the past participle fatto" (should be "fatta", invariable in the idiom).

### Low

- **L1** Invariable notes: 21 invariables (list in §2c) lack a note; caricabatterie/lavastoviglie explanation (`referenceEntry.js:389`) says "feminine nouns in -ie" (they are compounds, not -ie feminines); moglie gets "-ie invariable" cue with status ok although its plural is mogli.
- **L2** 7 `mf` nouns lack a note (list in §2c).
- **L3** Gloss style: inconsistent "to" on verbal expressions; semicolon vs comma sense separators.
- **L4** Engine edge cases: `esserci` compound cells "ci ho stato … averci stato, avendoci stato" (`cliticInfo()` at `conjugator.js:245-251` returns `aux: null` for ci/vi/ne, so default avere is used; `conj-hard-out.txt` l.2589-2603); no negative imperative (non + infinitive for tu); disfare lacks disfo/disfi/disfa/disfiamo/disfano/disferò; `nonFinite.participioPassato` for pronominal idioms gives bare fatto/avuto/visto (`conjugator.js:387 participioPassato: par.pp`); volerci present "ci voglio/vogliamo" shown in all persons; impersonal piovere/nevicare conjugated in all six persons.
- **L5** sognamo: Spelling topic vs engine inconsistency (see M5).
- **L6** Games: plural MC distractor `base + 's'` (`questions.js:89`) produces rotocalcos, otticos, uggias, taffetàs; invariable nouns receive random unrelated plurals as distractors (taffetà vs sottoscrizioni|ninnoli); preposition game includes adjunct patterns (cantare in un posto, studiare in un posto, vigere in qualcosa) where the answer is not lexically governed; raw prompt "atterrare ? + città"; articles game is singular-only; mf nouns offer only 3 choices; `qAux` explain (`questions.js:300`) pastes the whole `usage` note.
- **L7** `withArticle()` yields "il Dio" and "una gente".
- **L8** A1 placement doubtful (inferred): pensiero, torto, fatto, società, denaro, affari, carabiniere, Dio.
- **L9** `w:compìto|adj` carries a disambiguating grave accent in the lemma (searchable only via fold).
- **L10** deragliare/ammansire `both` are defensible; decantare doubtful.

## 4. Verb engine results (`conj-hard.mjs`, 137 verbs, all moods/tenses)

All correct unless listed below. Verified highlights: essere full paradigm; dare do/dai/dà, diedi|detti, da'|dai; fa'|fai, di'; contraddici; rifai|rifa'|rifà; soddisfare double paradigm; -rre stems (ponevo, ponendo, traducevo, traevo); verrò/terrò; morirò|morrò; odo, udirò|udrò; cuocio/cuociamo|cociamo/cossi/cotto; nuoccio|noccio/nociamo/nocqui/nociuto; compio/compivo|compievo/compii/compirò|compierò/compiuto/compiendo; apparvi|apparii|apparsi; sepolto|seppellito; assorbo|assorbisco, assorbito|assorto; solere/urgere/dirimere defective cells '—'; devo|debbo, debba|deva; mi siedo|mi seggo, siediti, sediamoci, sedetevi; andarsene (me ne vado, se n'è andato/a|se ne è andato/a, vattene, andiamocene, andatevene, essersene andato/a, andandosene); farcela (ce l'ho fatta, faccela, facciamocela, fatecela, avercela fatta, facendocela); cavarsela (me la sono cavata, se l'è cavata|se la è cavata, ce la siamo cavata, cavatela); dattela, fattene; ce l'ho / ce l'ho avuta; ci vuole / c'è voluto/a; c'entro|ci entro; stacci; l'ho smessa / smettila; me la sono vista|veduta / veditela; agreement mi sono alzato/a … ci siamo alzati/e; sogniamo|sognamo; scio/scii/sciino; invii; cerchi/pagherò; mangerò/cominci.

Both-aux handling: `auxBoth` flag, cells "avere-form|essere-form", infinito/gerundio passato both; `isCorrectForm` accepts either plus /a /e agreement variants. Accepted variant sets verified: -ei|-etti, perso|perduto, visto|veduto, previsto|preveduto, successo|succeduto, esatto|esigito, riflettuto|riflesso, inferito|inferto, elided clitics.

Wrong or missing forms:

| Verb / area | Engine output | Correct | Cause |
|---|---|---|---|
| esserci compounds | ci ho stato, averci stato, avendoci stato | ci sono stato/a, esserci stato/a, essendoci stato/a | `cliticInfo()` aux null for ci → default avere |
| parere, dolere, convenire, sedere | not in dictionary; bare `conjugate()` defaults to avere | essere | missing entries |
| disfare | only disfaccio paradigm | disfo/disfi/disfa/disfiamo/disfano, disferò also accepted | `DERIVED` table |
| pronominal idioms nonFinite | participioPassato fatto/avuto/visto | fatta (farcela), avuta (avercela), vista (vedersela) | `:387` uses bare pp |
| negative imperative | absent | non fare, non andare (tu) | not modelled |
| piovere/nevicare/volerci | six persons | 3sg (and 3pl for volerci) only | no impersonal flag |

## 5. Reference and games findings

### Reference codex (tricky nouns)
zaino ✓ (lo, gli); amica — not in dictionary (amico note says "Plural: amici (m), amiche (f)"); amici ✓; problema ✓ (-ma Greek masculine); mano ✓; uovo/dito/braccio ✓ (neuter plurals explained); radio ✓ (shortened-word rule); caffè ✗ (H2); auto — not in dictionary; re ✓ (monosyllable); crisi ✓ (-i invariable); città/università/virtù/papà ✗ (H2); collega/turista/giornalista ✓; carcere/gregge ✓ (gender switch); occhiali/pantaloni/ferie/jeans ✓ (plural-only); yogurt/sport/hobby/hacker ✓ (loanword rule). Also missing from the dictionary: psicologo, gnocco, bue, tempio, brindisi, eco, frutto, grido, urlo, membro, fondamento, arma, belga, oasi, stereo, tele, xilofono, pneumatico, hotel, whisky, capostazione, cassaforte, ferrovia, iodio — several are grammar.json examples, so the live panels cannot show them.

### Games (20 generated questions per game, `games-sample-out.txt`)

| Game | Verdict | Notes |
|---|---|---|
| Articles (qGender) | sound | singular only; mf nouns only 3 choices |
| Plurals MC/typed | sound | "+s" distractor (L6); invariables get unrelated plurals |
| Prepositions (qPattern) | mostly sound | 20/20 answers correct; adjunct patterns and raw "atterrare ? + città" prompt |
| Essere or avere (qAux) | 20/20 correct | `both` verbs drilled as avere (M3); explain pastes usage |
| Participles MC/typed | 20/20 | plausible distractors |
| Gerund | 20/20 | |
| Tense detective | 20/20 | identical-form exclusion verified |
| Person detective | sound | merges persons with identical forms correctly |
| Cloze MC (words/verbs) | weak | M4 |
| Cloze typed | sound | |
| Dictation | sound | "il regista" accepted for "la regista" via `checkTyped` expansion |
| Type it | sound | accepts synonyms (fogliame/chioma) |
| Translate MC | easy | distractors random |
| Conj MC/typed | 24/24 | M3 "(use avere)" |
| Sentence builder | weak | M6 |
| Hangman/crossword | sound | fold accents (è ≡ e) |

### Useful words (`data/useful-words.json`, 78 entries)
All 78 notes correct; groups 10+18+13+11+18+8. Nits: "e → ed before a vowel in careful speech" (ed is mostly before e- today); "gli … (and, in speech, to them)" (standard for many registers); "qua is the same word" (same meaning, different word).

## 6. Strengths
Lexical accuracy (0 errors in 280 entries read closely); high-quality notes; complete morphological data (gender, plural, adjective forms); engine design (variants, clitics, agreement, defectives, both-aux); grammar topic accuracy; form-aware game generators (tense/person detective exclude identical forms); process (validate + build fail hard, prior audit documents, `tools/test-conjugator.mjs` with 2,802 spot checks).

## 7. Proposals

1. `tools/lint-data.mjs` with 12 rules: example-contains-headword (inflection-aware); gloss language/capitals; level sanity vs NVdB/Profilo lists; shadowed-sense detector (common lemma only at C1/C2); near-duplicate detector (fold + stopword strip); expr shape → suggest noun; note required for invariable/mf/both; adjective forms rule check; pattern lint for adjuncts; `related` resolve; grammar ↔ engine consistency test; dedup report in build (list every shadowed record).
2. Sense-aware ids `w:<slug>|<pos>#<sense>` with an id map for stored progress.
3. Level recalibration pass on C1/C2 nouns (H1 list) and A1 doubtfuls (L8).
4. Split `expr` into idiom / formula / collocation; migrate ~320 noun phrases to `noun` with id map.
5. Fix order: H2 fold bug (one-line) → qCloze distractors (pos/number/gender filter, exclude synonyms by gloss overlap) → `auxPrimary` for both-verbs → base senses + tasso duplicate → expr migration → grammar topics data-driven (remove `GRAMMAR_FALLBACK`) → sentence builder alternative orders (accept any order that keeps adjacent clitic/verb groups, or author alternatives) → add missing verbs + ci/vi/ne aux inheritance + negative imperative + impersonal flag.

## 8. Verified vs inferred
Verified by script or file read: all sample classifications, whole-set counts, bug locations with line numbers, shadowed-lemma lookups, the tasso duplicate, the 55-verb `both` list, missing verbs, engine outputs, game samples, 178 accent-final nouns (159 -tà/-tù; A1 15, A2 12, B1 35, B2 41, C1 47, C2 28). Inferred (lexicographer judgement, no corpus check): CEFR placements, dictionary facts from memory (deragliare/ammansire/decantare auxiliaries, disfo, sognamo acceptance, ferramenta), essere-dominance claims for both-verbs, frequency of alternative word orders in sentence builder.
