# Plan: Officina delle frasi, a sentence-building workshop in the Laboratorio

Status: proposal for review, 2 October 2026. Nothing is implemented yet.

## 1. What it is

A new Laboratorio card and page, "Frasi · Officina delle frasi" (sentence workshop), with its own graded path of short lessons that teach how Italian sentences are built: first simple present-tense sentences, then the past, then the future, then richer structures (pronouns in the sentence, questions, connectors, reflexives, comparisons, "se" clauses). Every lesson mixes four kinds of practice, all tap-and-type, none spoken:

1. **Model.** A pattern card ("someone + verb + something") with three or four example sentences, English, and the speaker button. Roles are colour-coded (subject, verb, object, extra).
2. **Build it.** Tap words in order to build the sentence (the course's token activity, with one or two distractors from stage 2 onward).
3. **Fill it in.** A sentence with one or more blanks. Each blank offers fitting options, a hidden word bank the learner can reveal, and free entry (see §3).
4. **Conversation.** A dialogue shown one turn at a time, like a chat: the other person's line appears, the learner fills their reply (options, bank or free entry), the next line reacts to the choice, and the finished exchange stays on screen. The whole dialogue is never shown in advance.

At the end of every lesson a **Say it yourself** screen: the learner composes their own sentence from role-grouped banks (who, verb, what, when or where) that include their own learned words. The app checks the grammar, not the meaning: one item per required role, the verb conjugated for the chosen subject and the lesson's tense, articles and adjective endings agreeing. Valid sentences are read aloud and translated word by word; this is where it gets creative.

## 2. Content and progression

Content lives in `data/sentence-lab/<stage>.json`, authored by hand (no generator, no audio: everything speaks through device TTS), validated by a new deterministic check.

| Stage | Lessons at launch | What they build |
| --- | --- | --- |
| Presente | 6 | Chi sono (essere, avere, nationality and job); Cosa faccio (-are, -ere, -ire with everyday objects); Mi piace / non mi piace; Dove e quando (place and time phrases); Domande (sì/no and dove/quando/chi); Come stai? (the first full conversation) |
| Passato | 5 | Ieri ho… (passato prossimo with avere); Sono andato (essere verbs and agreement); Quando? (ieri, la settimana scorsa, due giorni fa); Era così (imperfetto for background); Raccontami (a short story in conversation) |
| Futuro | 4 | Domani (futuro semplice); Progetti (andare a, volere, dovere + infinitive); Se… (present "if" with future result); Che farai? (conversation about plans) |
| Strutture | 6 | Lo conosco (object pronouns inside the sentence); Chi, che cosa, perché (question words and answers); Quindi, allora, però (joining ideas); La mia giornata (reflexives); Più o meno (comparisons); Una vera chiacchierata (a long reactive conversation) |

Each lesson has about eight activities and takes five to seven minutes. The path unlocks in order within a stage; a stage opens when the previous stage's conversation lesson is done. More lessons are added later in the same files.

**Vocabulary rules.** Every blank and bank draws first on words the learner has already learned (the store's learned list, filtered by the slot's part of speech and category), then on the lesson's own "useful words" (a short list introduced on the model card, resolved to dictionary entries so they can be credited exactly as the course lesson boards do), then on the stage's small core set. New words needed by a sentence are introduced before they are used, never sprung in a blank.

## 3. Free entry in a blank (how it works without an AI)

The app is offline and has no language model, so free entry is checked for grammatical fit and dictionary membership, and the learner's sentence is accepted and read back when it fits the slot. Meaning is not judged; the English of the chosen word is shown so the learner can judge it themselves.

- **An Italian word.** Looked up in the dictionary (headwords, plurals, feminine forms, and conjugated verb forms through the existing sentence lookup). If it fits the slot (part of speech, and the form the slot asks for), it goes in. If it is not yet learned, the app asks "Add *stanco* to your words?" and runs three quick drills (meaning, recall, type it); passing marks it learned (10 XP) and inserts it. A word the dictionary does not have gets "not in the dictionary yet" with near matches.
- **An English word.** The reverse lookup lists Italian candidates that fit the slot (filtered by part of speech); the learner picks one, sees its meaning card, does the same three drills, and the word is inserted in the right form: a noun with the article the slot needs, an adjective in the agreeing ending, a verb conjugated for the slot's person and tense by the conjugator.
- **Slots are typed.** A blank declares what fits: `{pos:'adj', agree:'subject'}`, `{pos:'noun', number:'sg', article:'definite', category:['food','home']}`, `{pos:'verb', person:1, tense:'presente'}`, or an explicit `accept` list for fixed answers. Options shown by default are the authored ones plus up to four learned words that fit.

Example from the brief: the other person says "Come stai?"; the learner's turn is "Bene grazie, ma ____" with options such as *sono stanco*, *ho fame*, *ho sonno*, a revealable bank, and free entry; if the learner types "tired" the app offers *stanco* (adjective, agreeing with the learner's chosen gender), teaches it in three drills, and the reply becomes "Bene grazie, ma sono stanco." The next line reacts: "Stanco? Hai lavorato molto?"

## 4. Where it lives in the app

- Learn hub, Laboratorio section: a new reel card "Frasi · Sentence workshop" (icon: edit), first in the reel.
- Route `#/lab/frasi`: the workshop page with the four stages as a vertical path (stage headers, lesson rows with state: locked, next, done), a resume card, and the learner's "sentences I made" list (the Say-it-yourself results, kept locally, playable).
- Route `#/lab/frasi/<lessonId>`: the lesson player, in the course's full-screen shell (progress bar, Back, Pause), with the four activity kinds above and the Say-it-yourself finale.
- Progress: a per-profile `lab.frasi` record (lesson completions with timestamps, saved sentences) stored with the profile and synced like the rest of it; 15 XP per lesson on first completion; words learned through the drills go through `markLearned` as everywhere else.

## 5. Engineering shape

- `js/learning/sentence-lab.js`: pure engine (session state, activity sequencing, grading of order/cloze/dialogue/build, free-entry resolution and conjugation through `conjugator.js` and `sentence-lookup.js`), importable in Node.
- `js/views/labFrasi.js` and `js/views/labFrasiLesson.js`: the path page and the player; `js/learning/sentence-lab-activities.js` for the renderers (reusing the course's token, choice and pairs markup and styles); `css/sentence-lab.css`.
- `data/sentence-lab/presente.json` and so on; `docs/SENTENCE-LAB-CONTRACT.md` for authors.
- Checks: `tools/test-sentence-lab.mjs` (content: token banks form their answers, every accept list or slot is valid, dialogues alternate and every reactive line has a fallback, vocabulary resolves, lessons traversable by an all-correct learner; engine: free-entry resolution, agreement and conjugation cases) and `tests/sentence-lab-e2e.mjs` (browser: a lesson end to end, free Italian and English entry with the drills, the conversation turn by turn, Say it yourself, resume after reload).
- Service worker shell entries, README, GRAMMAR-COURSE cross-links ("review the pattern" links from lab lessons to the course lessons that teach the grammar).

## 6. Build plan

Round 1: engine, player, path page, Laboratorio card, the Presente stage (6 lessons) with the full free-entry and conversation mechanics, checks and browser suite. Reviewed in the iPhone preview before anything else is written.
Round 2: Passato and Futuro stages, the "sentences I made" list.
Round 3: Strutture, cross-links to the course, docs.

Authoring is done by content subagents writing to the contract, with a separate reviewing subagent checking every sentence for correctness and level before integration.

## 7. Questions to settle before building

1. Name and placement as in §4 (a Laboratorio card and its own route), or also a poster in Play?
2. Free entry checks grammar and dictionary membership only, never meaning (§3). Acceptable?
3. Conversations: linear with reactive replies (recommended, every option has a scripted reaction) or real branching dialogues (more content per lesson)?
4. First delivery: the Presente stage only (six lessons, so the format can be reviewed early), or all four stages in one go?
