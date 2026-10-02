# Officina delle frasi: content and engine contract

The sentence workshop is a Laboratorio exercise with its own staged path (`#/lab/frasi`) and lesson player (`#/lab/frasi/<lessonId>`). Content is hand-authored JSON in `data/sentence-lab/<stage>.json`, validated by `tools/test-sentence-lab.mjs`. The pure engine is `js/learning/sentence-lab.js` (Node-importable: it may import `../conjugator.js`, `../data.js` helpers and `./sentence-lookup.js`, never the store). The views are `js/views/labFrasi.js` (path) and `js/views/labFrasiLesson.js` (player) with renderers in `js/learning/sentence-lab-activities.js` and styles in `css/sentence-lab.css`. No audio files: every Italian line speaks through device TTS.

## 1. Stage pack

```json
{ "version": 1, "stage": "presente", "order": 1, "title": "Presente", "subtitle": "Say what is true now",
  "lessons": [ /* Lesson */ ] }
```

Stages, in order: `presente` (1), `passato` (2), `futuro` (3), `strutture` (4). A stage opens when the previous stage's last lesson is done; lessons open in order within a stage.

## 2. Lesson

```json
{ "id": "sl-presente-01-chi-sono", "title": "Chi sono", "outcome": "Say who you are with essere and avere.",
  "minutes": 6, "tense": "presente", "grammarRefs": ["v2-f-name", "v2-a1-essere-avere"],
  "vocab": [ { "it": "stanco", "en": "tired", "pos": "adj" } ],
  "activities": [ /* Activity */ ] }
```

- `id`: `sl-<stage>-<nn>-<slug>`, unique across stages. `tense`: `presente` | `passatoProssimo` | `imperfetto` | `futuro` | `condizionale` | `misto`.
- `grammarRefs`: course v2 lesson ids (must exist) shown as "Review the pattern" links. May be empty.
- `vocab`: the lesson's useful new words, introduced on the first `model` card before any activity uses them. Each must resolve to a dictionary entry (headword + pos); the check fails otherwise. These are credited like the course boards: the player runs them through the same three drills as free-entry words only when the learner uses one in a blank; otherwise they are simply introduced.
- Activities: 6 to 10, the first is a `model`, the last is a `build`. Every lesson has at least one `order`, one `cloze` and one `dialogue`.

## 3. Activities

Common fields: `id` (unique, `${lesson.id}.<n>`), `kind`, `prompt` (shown as the heading), optional `hint`.

### model
```json
{ "id": "…", "kind": "model", "prompt": "Who + is + what", "body": "A sentence names who, then what they are.",
  "pattern": [ { "role": "subject", "label": "who" }, { "role": "verb", "label": "is" }, { "role": "object", "label": "what" } ],
  "examples": [ { "it": "Io sono Marco.", "en": "I am Marco.", "roles": [["Io","subject"],["sono","verb"],["Marco.","object"]] } ],
  "tip": "…" }
```
`roles` is optional; when present every token of `it` must appear in order. Roles: `subject`, `verb`, `object`, `extra`, `link`.

### order
```json
{ "id": "…", "kind": "order", "prompt": "Build the sentence", "en": "I eat bread.",
  "answer": "Io mangio il pane.", "accepted": ["Mangio il pane."], "tokens": ["Io","mangio","il","pane."],
  "distractors": ["mangia"], "explanation": "Io takes mangio.", "hint": "Start with who." }
```
`tokens` must form `answer` exactly (same multiset); `accepted` answers must be formable from `tokens` (a subset is fine); `distractors` are extra tokens never needed. The engine grades by normalised string equality (case, trailing punctuation and straight apostrophes normalised).

### cloze
```json
{ "id": "…", "kind": "cloze", "prompt": "Finish the sentence", "template": "Bene grazie, ma ____ stanco.", "en": "Fine thanks, but I'm tired.",
  "blanks": [ { "accept": ["sono"], "options": ["sono","sei","è"], "bank": ["siamo","ho"], "free": false,
                "slot": null, "explanation": "io takes sono." } ],
  "hint": "…" }
```
One `____` per blank, in order. A blank is graded by `accept` (exact, normalised) OR by `slot` (see §4) when `free` is true and the learner types a word; `options` are shown as tappable choices (2 to 5, must include every `accept` value when `accept` exists); `bank` is the hidden, revealable word bank (0 to 6 extra entries, may overlap options); `free: true` adds the free-entry field. `slot` may be `null` for fixed blanks.

### dialogue
```json
{ "id": "…", "kind": "dialogue", "prompt": "At the bar", "partner": "Luca",
  "turns": [
    { "speaker": "partner", "it": "Ciao! Come stai?", "en": "Hi! How are you?" },
    { "speaker": "you", "template": "Bene grazie, ma ____.", "en": "Fine thanks, but ____.",
      "blanks": [ { "accept": ["sono stanco","sono stanca","ho fame","ho sonno"], "options": ["sono stanco","ho fame","ho sonno"],
                    "bank": ["sono stanca","ho sete"], "free": true,
                    "slot": { "pos": "adj", "agree": "speaker", "wrap": "sono {}" }, "explanation": "…" } ],
      "reactions": [ { "when": ["sono stanco","sono stanca"], "it": "Stanco? Hai lavorato molto?", "en": "Tired? Did you work a lot?" },
                     { "when": ["ho fame"], "it": "Allora prendiamo un panino!", "en": "Then let's get a sandwich!" },
                     { "when": "*", "it": "Capisco. Andiamo?", "en": "I see. Shall we go?" } ] },
    { "speaker": "partner", "it": "Dai, andiamo a casa.", "en": "Come on, let's go home." }
  ] }
```
Turns alternate `partner` / `you` (two partner turns in a row are allowed; two `you` turns are not). A `you` turn has 1 or 2 blanks, each as in cloze. After the learner completes a `you` turn, the engine appends the first reaction whose `when` contains the chosen text for the first blank (normalised), else the `"*"` reaction; every `you` turn must have a `"*"` reaction. The player shows turns one at a time and keeps the completed ones on screen.

### build
```json
{ "id": "…", "kind": "build", "prompt": "Say it yourself", "tense": "presente",
  "roles": [
    { "role": "subject", "items": [ { "it": "Io", "person": 0 }, { "it": "Mia sorella", "person": 2 }, { "it": "Noi", "person": 3 } ] },
    { "role": "verb", "items": [ { "inf": "mangiare", "en": "eat" }, { "inf": "bere", "en": "drink" } ] },
    { "role": "object", "learned": { "pos": "noun", "category": ["food"], "article": "definite" },
      "items": [ { "it": "la pasta", "en": "pasta" }, { "it": "un caffè", "en": "a coffee" } ] },
    { "role": "extra", "optional": true, "items": [ { "it": "a casa", "en": "at home" }, { "it": "la sera", "en": "in the evening" } ] }
  ],
  "examples": [ "Io mangio la pasta a casa." ] }
```
`person` is the conjugator index (0 io, 1 tu, 2 lui/lei, 3 noi, 4 voi, 5 loro). The engine composes `subject + conjugate(inf, tense, person) + object [+ extra]`, capitalises the first letter and adds a full stop. Verb items may carry `aux`/`isc` for the conjugator; the check conjugates every verb item. `learned` on a role lets the player add up to four of the learner's learned dictionary words that match (`pos`, optional `category` list, with `article` applied through `withArticle`). The learner's composed sentences are saved locally ("Le mie frasi") with the English built from the items' `en` fields.

## 4. Slots and free entry

```json
{ "pos": "adj" | "noun" | "verb" | "adv" | "expr",
  "agree": "speaker" | "m-sg" | "f-sg" | "m-pl" | "f-pl" | null,   // adjectives
  "number": "sg" | "pl", "article": "definite" | "indefinite" | "none",   // nouns
  "person": 0..5, "tense": "presente" | …,                              // verbs
  "category": ["food", …] | null,                                       // optional filter for suggestions
  "wrap": "sono {}" | null }                                            // text placed around the resolved word
```

`resolveFreeEntry(text, slot, ctx)` in the engine returns one of:
- `{ status: "ok", entryId, form, display }`: an Italian word (headword, plural, feminine or a conjugated form, through `createSentenceLookup`) that fits the slot; `form` is the inflected form to insert (adjective agreement from `entry.forms` or the `-o/-a/-i/-e` rule; noun with the slot's article via `withArticle`; verb conjugated with `conjugate`).
- `{ status: "learn", entryId, form, display }`: fits, but `ctx.learnedIds` does not include it; the player runs the three drills (meaning choice, recall choice, type it) before inserting.
- `{ status: "choose", candidates: [{ entryId, it, en, form }] }`: an English word matched several dictionary entries (reverse lookup on `entry.en` senses) that fit the slot; the player shows a picker, then proceeds as `learn`.
- `{ status: "unfit", reason }`: a known word that does not fit the slot (wrong part of speech, no plural, cannot conjugate).
- `{ status: "unknown", suggestions: [it…] }`: not in the dictionary; up to three near matches by prefix or edit distance 1.

`ctx` = `{ dictionary: { vocab, verbs }, lookup, learnedIds: Set, speakerGender: "m" | "f" }`. The dictionary is the authority; the engine never invents forms. A fit scorer (`js/learning/fit-scorer.js`, optional download) may add `{ fit: 0..1, note }` to an `ok`/`learn` result; it never changes the status.

## 5. Engine API (`js/learning/sentence-lab.js`)

```js
export function createLabSession(lesson, { now } = {})                    // -> session { id, lessonId, index, phase, state, done: [], sentences: [] }
export function currentLabStep(lesson, session)                           // -> { kind, activity, state, complete }
export function answerLab(lesson, session, value, ctx)                    // order: string | tokens[]; cloze: [blank values]; dialogue: [turn blank values]; build: { subject, verb, object, extra }
                                                                           // -> { session, result: { ok, outcome: 'correct'|'incorrect'|'accepted', answer, explanation, sentence?, en? } }
export function advanceLab(lesson, session)                               // next activity; marks the lesson complete after build
export function resolveFreeEntry(text, slot, ctx)                         // §4
export function composeBuild(activity, choice, ctx)                       // -> { it, en, ok, reason }
export function labProgress(stages, record)                               // -> [{ stage, open, lessons: [{ id, title, state: 'locked'|'next'|'open'|'done' }] }]
```
Grading never depends on the renderer; the player only records what the engine returns. Order and fixed cloze blanks are right or wrong; free entries accepted by the slot are `accepted` (counted as done, never "wrong"); a mismatch on a fixed blank shows the explanation and lets the learner try again (two tries, then the answer is shown and the activity continues).

## 6. Progress, XP and storage

- Per profile: `store.current.lab = { frasi: { done: { [lessonId]: at }, sentences: [{ it, en, lessonId, at }] } }`, saved with the profile, merged on sync (newest `at` per lesson wins, sentences unioned by `it+at`), cleared by `resetProgress`, included in backups.
- First completion of a lesson: `store.addXP(15)`; words learned through the three drills go through `store.markLearned` (10 XP each) with a `journey-v1` event of `wordPolicy: 'word-lab-drill-v1'` per drill so Review sees them (same skill ids as the short word lesson: meaning, recall, and for nouns article).
- Lesson sessions persist in `store.learning.sessions['lab:frasi:<lessonId>']` so a lesson resumes where it was.

## 7. Checks

`tools/test-sentence-lab.mjs`: every pack parses and has the four stages; ids unique; `vocab` and `grammarRefs` resolve; `order` tokens form the answer and every accepted answer; `cloze` and dialogue blanks have `accept` or a `slot`, options include accept values, templates have the right number of blanks; dialogues alternate and every `you` turn has a `"*"` reaction; `build` verbs conjugate for every subject person in the lesson tense; every lesson is traversable by an all-correct learner through the engine; `resolveFreeEntry` fixtures (Italian adjective with agreement, noun with article, verb conjugated, English word with a picker, unknown word with suggestions, unfit word). `tests/sentence-lab-e2e.mjs`: the path page, one full lesson in the browser including a free Italian entry with the drills, a free English entry with the picker, the conversation turn by turn, Say it yourself, resume after reload, and the Laboratorio card.
