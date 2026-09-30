# Verb-specific progressive content

Authoring files `beginner.json`, `intermediate.json`, `advanced.json` are arrays of records. Every dictionary verb belongs to exactly one file (A1/A2, B1/B2, C1/C2 respectively). The runtime bundle is generated from these records; content must be reviewed for the individual verb and selected sense.

Each record:

```json
{
  "inf": "viaggiare",
  "policy": "dynamic",
  "sense": "travel, make a journey",
  "note": "Use the progressive to focus on a journey underway. Use the simple present for usual travel habits.",
  "en": ["travel", "travels", "travelled", "travelling"],
  "frames": [
    ["in treno", "by train"],
    ["con un amico", "with a friend"],
    ["per lavoro", "for work"],
    ["in Italia", "in Italy"]
  ]
}
```

`policy` is `dynamic`, `sense-dependent`, or `simple`. Dynamic and sense-dependent entries enable progressive practice only for the authored sense. `simple` selects the ordinary simple-form usage and needs a specific explanation of why progressive is not appropriate in that sense. No unknown/unreviewed fallback is permitted. `note` must be individual/sense-specific, not a stock statement substituting for review.

`en` contains English simple-present base, third-person singular, simple-past predicate, and progressive -ing predicate. For simple policies the final predicate may be empty. These predicates and the four Italian/English complement pairs must make natural sentences with this particular verb. They are NOT generic frames into which arbitrary verbs are substituted. Inflected Italian forms come from the conjugator; each authored frame supplies the lexical construction. Empty complements are permitted where the verb naturally stands alone, but all four situations must remain distinct. Avoid extra finite clauses, variable possessives, subject-dependent adjective agreement, and English predicates needing an unprovided object.

Default people are six personal subjects plus formal Lei. If that is unnatural for the taught sense, specify `persons` (0–5) and `formal:false`. Use `subjects` with keyed person indexes to provide natural non-human Italian/English subjects, e.g. `{"2":["L’acqua","The water"],"5":["I liquidi","The liquids"]}`. Third-person nonhuman records should have `formal:false`. Weather has `persons:[2]`, `formal:false`, `subjects:{"2":["","It"]}`. Prefix/suffix spacing is handled by the compiler.

For human subjects using the default pronouns, English predicates or complements may use `{poss}` for a subject-dependent possessive, such as `comb {poss} hair`. This becomes my / your / her / our / your / their, and your for formal Lei. Do not use this placeholder with custom nonhuman subjects.

If the ordinary simple usage cannot fit conjugated-form + complement (special lexical clitics/defective constructions), provide `simpleExamples` with at least four complete reviewed `{it,en,answer,person}` sentences and an explanation. Do not invent personal forms. `persons` still scopes valid forms; `formal:false` where appropriate. These records may omit `en`/`frames` if simpleExamples fully define the lesson. For special-clitic dynamic usages provide exact complete `progressiveExamples` instead of pretending the clitic is ordinary reflexive; author at least four distinct `{it,en,answer,person,role?}` scenes plus simpleExamples, scope persons accordingly.

Exact scenes may specify `section:"practice"` or `section:"mixed"`; each scoped practiced person needs two distinct practice scenes. Optional `past:{it,en,answer}` supplies a separately authored past version.

The four frames support different contexts for teaching/practice (first two) and mixed review (last two). The compiler may inflect these reviewed bounded frames for allowed persons and present/imperfetto; separate scenario IDs are retained. Include two extra frames when readily natural to supply repair reserves. In simpleExample-only records aim for four complete examples (two initial, two review).

Do not alter dictionary source data, conjugator, runtime modules, or other authors' files while authoring. List uncertain inflections or source-data issues separately for integration. Cite primary Italian sources for exceptional usage in an optional `sources` array. Cross-review happens after authoring; do not label automated checks as native-speaker certification.
