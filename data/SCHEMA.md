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
- `pl` (required for nouns): plural form. Invariable nouns repeat the singular (e.g. "città" → "città"). Uncountable/singular-only nouns use `"-"`.
- `fem` (optional, nouns for people/animals with a distinct feminine form): e.g. `"amico"` → `"fem": "amica"`.
- `forms` (required for adjectives with variable endings): `[ms, fs, mp, fp]`, e.g. `["bello","bella","belli","belle"]`, `["grande","grande","grandi","grandi"]`. Invariable adjectives (`blu`, `rosa`) may omit it.
- `level` (required), `cat` (required): see above.
- `ex` / `exEn` (required): one natural example sentence using the word exactly (inflected form allowed), and its English translation.
- `note` (optional).
- Verbs are NOT vocabulary entries — they live in `data/verbs/*.json`.

## Verb entry (`data/verbs/*.json`)

```json
{
  "inf": "mangiare",
  "en": "to eat",
  "level": "A1",
  "cat": "food",
  "aux": "avere",
  "trans": "vt",
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
- `isc` (only for `-ire` verbs): `true` if the present uses `-isc-` (capisco, finisco), `false` if not (dormo, parto, apro). Omit for `-are`/`-ere` verbs.
- `patterns` (required, 1–4 items): government/"reggenza" patterns showing prepositions and complements, using `qualcuno`, `qualcosa`, `fare` (for verb + preposition + infinitive), e.g. `"pensare a qualcuno"`, `"cercare di fare"`, `"avere bisogno di qualcosa"`.
- `usage` (required): 1–3 sentences: meaning nuances, register, when to use, common collocations, pitfalls, whether irregular.
- `examples` (required, exactly 3): natural sentences in different tenses/persons, each with English translation.
- `related` (optional): related words with article.
- Conjugation tables are generated by the app's conjugation engine; do not include them.
