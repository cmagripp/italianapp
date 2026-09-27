# Grammar reference schema (`data/grammar.json`)

`data/grammar.json` is a JSON array of topic objects, in display order; validate with `node -e "JSON.parse(require('fs').readFileSync('data/grammar.json','utf8'))"`.
- `id` (string, slug): stable key used for routing and progress; one of `articles`, `plurals`, `adjectives`, `tenses`, `passato-imperfetto`, `auxiliaries`, `reflexives`, `spelling`, `isc`, `imperative`, `pronouns`, `prepositions`.
- `title` (English) and `titleIt` (Italian) headings; `summary` is one sentence for the topic card.
- `practiceGame`: the game to launch from the topic, one of `gender | plurals | aux | conj-drill | conj-choice | tense-detective | participles | patterns | quiz | cloze`.
- `sections` (5–9 items, in reading order), each with:
  - `heading` (string) and `body` (2–6 sentences of plain text; `*…*` marks italics and should be rendered, not shown literally);
  - `table` (optional): array of rows, each an array of string cells; the first row is the header and every row has the same number of cells (an em dash `—` means "no form");
  - `examples` (optional): array of `{ "it": Italian sentence, "en": English translation }`;
  - `tip` (optional): one short note to render as a callout; may also contain `*italics*`.
