# Noun forms audit — 29 September 2026

The reported missing plural for **calcio** is appropriate for the entry's meaning,
football/soccer. The display must explain the usual singular usage rather than
imply missing data. **Calci** means kicks, not multiple instances of the sport.
[Sabatini–Coletti](https://dizionari.corriere.it/dizionario_italiano/C/calcio_1.shtml)
explicitly distinguishes these meanings and marks the sport singular-only.

## Scope and interpretation

The compiled vocabulary contains **4,613 nouns**; none has an absent or empty
`pl` field. At the start of this review, 297 used `"-"` and 447 repeated the lemma.
The source files contain 714 repeated noun-lemma groups. Twenty disagree on
gender or plural; **17 specifically disagree between `"-"` and a supplied plural**.
Thirteen of those 17 initially compiled to `"-"`.

This review checked those 17 groups, the distinct meanings of **media**, and the
reported **calcio** entry. It also corrected two verified invariable expressions
found during the initial scan. It is not a dictionary-wide assertion that every
recorded plural is correct or that every possible usage has been represented.

For this learning dataset, `"-"` means **normally singular in the meaning taught**.
It does not assert that every meaning, specialized use, or literary use of the
lemma forbids a plural. An unchanged spelling is not itself evidence that a
noun is uncountable. The decisions below distinguish dictionary evidence from
the teaching decision to retain the everyday mass or collective reading.

## The 17 conflicting source groups

Source paths below are relative to `data/vocab/` and identify the record selected
by the current build. Unselected duplicates remain intact. Links are to the
primary dictionary entries consulted on 29 September 2026.

| Lemma and selected source | Competing forms | Selected meaning and result | Evidence |
| --- | --- | --- | --- |
| **insonnia** — `B1-life-1.json` | `-` / `insonnie` | **Retain `-`.** The example teaches the sleep disorder as a condition. Added a usual-singular note; no assertion that episodic or literary plurals are impossible. | [Treccani](https://www.treccani.it/vocabolario/insonnia/) distinguishes the condition and the resulting period of wakefulness. |
| **sollievo** — `B1-life-2.json` | `-` / `sollievi` | **Retain `-`.** The selected sentence expresses the feeling of relief. Added a note limiting the singular treatment to this use; did not invent a separate meaning for every plural occurrence. | [Treccani](https://www.treccani.it/vocabolario/sollievo/) describes release from distress and the expression used in the example. |
| **entusiasmo** — `B1-life-2.json` | `-` / `entusiasmi` | **Retain `-` for the general feeling.** Added that `gli entusiasmi` also occurs for expressions of enthusiasm. This is a limitation of the taught reading, not a prohibition on plural usage. | [Treccani: entusiasmo](https://www.treccani.it/vocabolario/entusiasmo/); [frenare](https://www.treccani.it/vocabolario/frenare/) explicitly uses `gli entusiasmi`. |
| **burocrazia** — `B1-life-4.json` | `-` / `burocrazie` | **Retain `-` for red tape.** Added the distinction from separate administrative organizations, which can be counted. | [Treccani](https://www.treccani.it/vocabolario/burocrazia/) separates organizations from the abstract red-tape meaning. |
| **maturità** — `B1-mind-1.json` | `-` / `maturità` | **Correct to `maturità`.** The selected English meaning is the exam, not abstract maturity. The unchanged form is available for different exams or qualifications; note clarifies both meanings. | [De Mauro](https://dizionario.internazionale.it/parola/maturita) marks the noun invariable and lists the exam and qualification meanings; [Treccani](https://www.treccani.it/vocabolario/maturita/) confirms school usage. |
| **tolleranza** — `B1-mind-3.json` | `-` / `tolleranze` | **Retain `-` for social tolerance.** Expanded the existing sense note to distinguish countable technical margins. | [Treccani](https://www.treccani.it/vocabolario/tolleranza/) distinguishes attitudes from permitted deviations. |
| **segnaletica** — `B1-world-1.json` | `-` / `segnaletiche` | **Retain `-`.** The entry teaches signage as a collective. Added that individual road signs are `segnali stradali`; do not silently substitute a plural of signage for them. | [Treccani](https://www.treccani.it/vocabolario/segnaletica/) defines an organized set of signals. |
| **tracciabilità** — `B2-life-3.json` | `-` / `tracciabilità` | **Retain `-` for the property of traceability.** Reworded the previously bare “Invariable” note: usual singular usage and unchanged spelling when pluralized are different facts. | [Treccani](https://www.treccani.it/vocabolario/tracciabilita/) defines the property and food-chain application. |
| **crittografia** — `B2-mind-1.json` | `-` / `crittografie` | **Retain `-` for the technique/field.** Added that countable puzzles or obscure texts belong to other meanings. | [Treccani](https://www.treccani.it/vocabolario/crittografia/) separately defines the technique, an enigma, and an obscure text. |
| **disinformazione** — `B2-mind-1.json` | `-` / `disinformazioni` | **Retain `-`.** The entry describes distorted information as a phenomenon. The note now states the attested process/lack-of-information meanings, without making a broad unsupported claim about how Italian distinguishes misinformation. | [Treccani](https://www.treccani.it/vocabolario/disinformazione/) supplies both meanings. |
| **mobilità** — `B2-mind-5.json` | `mobilità` / `-` | **Retain `mobilità`.** This spelling is invariable; the selected record includes worker mobility and a transfer scheme. Added that the example uses the general concept in the singular. No dictionary evidence justified declaring the recorded plural invalid. | [Treccani](https://www.treccani.it/vocabolario/mobilita/) distinguishes general, technical and employment usages. |
| **deforestazione** — `B2-mind-5.json` | `-` / `deforestazioni` | **Retain `-` for the process.** Added a note identifying the process reading. A morphological plural in another source is insufficient reason to force plural drills for it. | [Treccani: deforestazione](https://www.treccani.it/vocabolario/deforestazione/) refers to [diboscamento](https://www.treccani.it/vocabolario/diboscamento/), sense 2. |
| **viabilità** — `B2-world-1.json` | `-` / `viabilità` | **Retain `-`.** The example refers collectively to traffic conditions/routing in an area. Added this scope; unchanged spelling in another source does not establish a missing everyday plural. | [Treccani](https://www.treccani.it/vocabolario/viabilita/) distinguishes passability and a territory's road network. |
| **alterigia** — `C1-life-1.json` | `alterigie` / `-` | **Retain `alterigie`, explicitly label it rare.** The form is verified, not a guessed regular plural. | [Treccani](https://www.treccani.it/vocabolario/alterigia/) explicitly marks the plural rare. |
| **astio** — `C1-life-2.json` | `asti` / `-` | **Retain `asti`; no source edit needed.** The selected meaning and recorded plural agree with the dictionary. | [Sabatini–Coletti](https://dizionari.corriere.it/dizionario_italiano/A/astio.shtml) explicitly gives `asti` for rancour. |
| **domotica** — `C1-mind-2.json` | `domotiche` / `-` | **Correct to `-` for the selected field.** The reviewed dictionaries define home automation as a discipline, not individual devices. Added the ordinary singular use and `impianti domotici` for individual systems. This is a sense-specific teaching decision, not a claim that the spelling `domotiche` can never occur elsewhere. | [Treccani](https://www.treccani.it/vocabolario/domotica/), [De Mauro](https://dizionario.internazionale.it/parola/domotica). |
| **accidia** — `C2-life-2.json` | `-` / `accidie` | **Retain `-` for spiritual apathy/the vice.** Added an explicit sense note. Nothing in the reviewed entry requires replacing this mass reading with plural drills. | [Treccani](https://www.treccani.it/vocabolario/accidia/) defines the state and religious vice. |

## Media and the other focused corrections

- **media**, selected from `B1-mind-2.json`: retain masculine plural **i media**
  for mass media. The competing `B1-world-3.json` record is feminine **la media,
  le medie**, meaning an average. Expanded the selected note to make the number
  distinction explicit. [De Mauro's mass-media entry](https://dizionario.internazionale.it/parola/media_2)
  and [Treccani's average entry](https://www.treccani.it/vocabolario/media/) describe
  separate nouns. The average record remains excluded by current deduplication.
- **calcio**, `A1-world-1.json`: retain `-`; add the football/kick distinction.
  [Sabatini–Coletti](https://dizionari.corriere.it/dizionario_italiano/C/calcio_1.shtml).
- **extrema ratio**, `C2-more-2.json`: replace `-` with `extrema ratio` and explain
  the invariable expression. [De Mauro](https://dizionario.internazionale.it/parola/extrema-ratio).
- **vexata quaestio**, `C2-more-2.json`: replace `-` with `vexata quaestio` and
  explain standard invariable Italian usage. The old note mentioned a rare Latin
  plural without representing the ordinary Italian form.
  [De Mauro](https://dizionario.internazionale.it/parola/vexata-quaestio).

## Retained product limitation

`tools/build-data.mjs` keys vocabulary by normalized lemma plus part of speech,
keeps the lowest CEFR record, and uses file order to break equal-level ties.
It cannot represent separate senses with different genders, number behavior,
examples, or learning progress. The current task does **not** change IDs, merge
competing paradigms, or add new independently learned senses.

The records above are sufficient for the display fix and current selected-sense
lessons. Supporting **la media** alongside **i media**, separate kick/football
entries, or a separate policy for optional mass-noun plurals requires a later
sense-aware schema and progress-migration decision. The 17 conflicts should
not be “resolved” by mechanically replacing every dash with a plural.

After the four plural-field corrections in this review, the dataset still has
4,613 nouns, with **295 `"-"` markers and 450 unchanged forms**. One change adds a
regularly available invariable exam noun; one removes unsuitable field-name
plural practice; two repair countable invariable expressions. No other plural
field or stable ID was changed.
