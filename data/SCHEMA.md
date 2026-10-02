# Data schema

All data files are plain JSON arrays. Validate with `node tools/validate.mjs <file>`.

## Levels
`A1`, `A2`, `B1`, `B2`, `C1`, `C2` (CEFR).

## Categories (`cat` slugs — use exactly these)
| slug | covers |
|---|---|
| basics | greetings, courtesy, survival phrases, yes/no, please/thanks |
| people | family, relationships, people, life stages, personal information |
| body | body parts, health, illness, medicine, hygiene |
| emotions | feelings, personality, character, moods |
| food | food, drink, meals, cooking, restaurant |
| home | house, rooms, furniture, household objects, chores |
| clothing | clothes, accessories, fashion, fabrics |
| daily | daily routine, everyday objects, everyday actions |
| shopping | shopping, money, prices, services, banking (everyday) |
| city | city, buildings, places, directions, public services |
| travel | travel, transport, tourism, holidays, hotel |
| nature | nature, weather, landscape, geography, environment, materials |
| animals | animals, plants, farming |
| time | time, calendar, dates, frequency, seasons |
| numbers | numbers, quantities, measures, maths words |
| colors | colors, shapes, sizes |
| work | work, professions, office, employment |
| school | education, school, university, learning, language |
| tech | technology, computers, internet, phone, media, news |
| arts | art, music, literature, cinema, theatre, entertainment |
| sports | sports, hobbies, games, leisure, fitness |
| society | politics, law, government, justice, religion, social issues, history |
| economy | economy, business, finance, industry, trade |
| science | science, research, medicine (technical), maths, physics, biology |
| abstract | abstract concepts, ideas, thought, qualities, philosophy |
| communication | speaking, discourse, opinion, connectors, prepositions, pronouns, function words |
| description | general adjectives and adverbs for describing things and manner |
| expressions | idioms, fixed phrases, interjections, proverbs, colloquialisms |

## Vocabulary entry (`data/vocab/*.json`)

```json
{
  "it": "casa",
  "en": "house; home",
  "pos": "noun",
  "g": "f",
  "pl": "case",
  "level": "A1",
  "cat": "home",
  "ex": "La mia casa è piccola ma luminosa.",
  "exEn": "My house is small but bright.",
  "note": "optional: irregular plural, false friend, register, collocation"
}
```

Fields:
- `it` (required): Italian lemma, lowercase (proper nouns capitalised), no article for nouns. Multi-word expressions allowed for `expr`.
- `en` (required): English meaning(s); separate alternatives with `; `.
- `pos` (required): one of `noun`, `adj`, `adv`, `prep`, `conj`, `pron`, `num`, `det`, `interj`, `expr`.
- `g` (required for nouns): `m`, `f`, or `mf` (same form for both genders, e.g. "cantante", "turista").
- `pl` (required for nouns): plural form. Invariable nouns repeat the singular (e.g. "città" → "città"). Uncountable/singular-only nouns use `"-"`. Plural-only nouns (occhiali, nozze, affari) put the plural in both `it` and `pl` and say so in `note` ("Plural only", "Usually plural", "Plural in this sense"…); the app then shows them with the plural article. A note for an invariable singular (serie, caricabatterie) should say "invariable".
- `fem` (optional, nouns for people/animals with a distinct feminine form): e.g. `"amico"` → `"fem": "amica"`.
- `forms` (required for adjectives with variable endings): `[ms, fs, mp, fp]`, e.g. `["bello","bella","belli","belle"]`, `["grande","grande","grandi","grandi"]`. Invariable adjectives (`blu`, `rosa`) may omit it.
- `level` (required), `cat` (required): see above.
- `ex` / `exEn` (required): one natural example sentence using the word exactly (inflected form allowed), and its English translation.
- `note` (optional).
- Verbs are NOT vocabulary entries — they live in `data/verbs/*.json`.

Noun number is specific to the meaning taught by the entry. `"pl": "-"` means
that this meaning is normally used in the singular, not that every meaning of
the lemma lacks a plural. For example, `calcio` meaning football uses `"-"`;
`calci` means kicks and must not be taught as the plural of football. Explain
useful sense contrasts in `note`. Do not use `"-"` for a countable invariable
noun: repeat its lemma in `pl` and mark it invariable in `note`. Do not guess
plurals for mass nouns or merge number forms across different meanings.

## Verb entry (`data/verbs/*.json`)

```json
{
  "inf": "mangiare",
  "en": "to eat",
  "level": "A1",
  "cat": "food",
  "aux": "avere",
  "trans": "vt",
  "irregular": false,
  "patterns": ["mangiare qualcosa", "mangiare da qualcuno"],
  "usage": "The everyday verb for eating. Regular -are verb. Also used figuratively: 'mangiarsi le parole' (to mumble).",
  "examples": [
    {"it": "Mangio sempre a mezzogiorno.", "en": "I always eat at noon."},
    {"it": "Ieri abbiamo mangiato la pizza.", "en": "Yesterday we ate pizza."},
    {"it": "Mangeremo fuori stasera.", "en": "We will eat out tonight."}
  ],
  "related": ["il cibo", "la cena"]
}
```

Fields:
- `inf` (required): infinitive, lowercase. Reflexive/pronominal verbs end in `-si` (`alzarsi`, `accorgersi`, `andarsene` → use `andarsene`).
- `en` (required): English meaning(s) starting with "to", alternatives separated by `; `.
- `level`, `cat` (required).
- `aux` (required): `avere`, `essere`, or `both` (when meaning-dependent, e.g. `cambiare`, `correre`, `passare`).
- `trans` (required): `vt` (transitive), `vi` (intransitive), `vr` (reflexive/pronominal), `vt/vi`.
- `irregular` (required): `true` when the verb has irregular forms (stem changes, irregular passato remoto or participle…), `false` otherwise. The build compares it with the conjugation engine and reports every verb whose flag disagrees.
- `isc` (only for `-ire` verbs): `true` if the present uses `-isc-` (capisco, finisco), `false` if not (dormo, parto, apro). Omit for `-are`/`-ere` verbs.
- `patterns` (required, 1–4 items): government/"reggenza" patterns showing prepositions and complements, using `qualcuno`, `qualcosa`, `fare` (for verb + preposition + infinitive), e.g. `"pensare a qualcuno"`, `"cercare di fare"`, `"avere bisogno di qualcosa"`.
- `usage` (required): 1–3 sentences: meaning nuances, register, when to use, common collocations, pitfalls, whether irregular.
- `examples` (required, exactly 3): natural sentences in different tenses/persons, each with English translation.
- `related` (optional): related words with article.
- Conjugation tables are generated by the app's conjugation engine; do not include them.

## Generated fields (`data/vocab.json`, `data/verbs.json`)

`node tools/build-data.mjs` merges the part files (the lowest CEFR level wins for a duplicate lemma) and adds fields that must never be written in the part files:
- `id`: `w:<slug>|<pos>` for vocabulary (slug = the lowercased lemma, spaces → `_`, e.g. `w:casa|noun`, `w:lista_della_spesa|noun`; a clash gets a `#2` suffix) and `v:<inf>` for verbs (`v:mangiare`). Progress, lists and review history are keyed on this id, so it derives from the lemma: renaming or re-spelling a lemma (or changing a word's `pos`) gives it a new id and orphans the progress stored under the old one.
- `irregularEngine` (verbs): the conjugation engine's verdict (`true` when any form comes from its irregular tables), used by the app for the "irregular" filter; `irregular` is the author's flag, kept for the build's disagreement report.

## Useful words (`data/useful-words.json`)

The "Parole utili" deck: a hand-curated set of 60 to 80 function words every learner needs, grouped (question words, connectors, indefinites, object and reflexive pronouns, time and place, quantity). The app shows it grouped at `#/browse?list=useful` (reached from the deck card in the Learn hub's Parole reel and on the Words page), each row opening the word's lesson, with a Play action that runs the Matching game on the set or on one group. The file is written by hand and is not touched by the build; it only refers to the dictionary:

```json
{
  "version": 1,
  "groups": [
    {
      "id": "questions",
      "title": "Question words",
      "it": "Le domande",
      "entries": [
        { "entryId": "w:quando|conj", "note": "Quando parti? When are you leaving?" }
      ]
    }
  ]
}
```

Fields:
- `version` (required): the file format, currently `1`.
- `groups` (required, non-empty, in display order): each with `id` (a slug, unique in the file), `title` (English heading), `it` (Italian heading) and a non-empty `entries` list.
- `entryId` (required): an id from the built `data/vocab.json` (`w:<slug>|<pos>`, see "Generated fields"). The deck follows the dictionary: renaming a lemma or changing its `pos` changes the id and breaks the reference, so add a missing word to `data/vocab/` first and rebuild. It is never a verb or a noun; the deck teaches function words (pronouns, adverbs, conjunctions, prepositions, determiners, expressions), so a homograph points at the function-word entry (`w:cosa|pron`, not `w:cosa|noun`; `w:ora|adv`, not `w:ora|noun`). An id is listed once across the whole file.
- `note` (optional): one line of usage with a short Italian example, shown under the row; plain text, no markup, at most 160 characters.

`node tools/test-useful-words.mjs` checks all of this (every id resolves to a function word, groups non-empty with unique ids and both titles, no id twice, 60 to 80 entries, the id list survives the games' `ids:` deep link).
