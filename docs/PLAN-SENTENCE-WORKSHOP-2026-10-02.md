# Plan: Officina delle frasi, a sentence-building workshop in the Laboratorio

Status: implemented, 2 October 2026 (what landed, and where it differs from the proposal, is noted at the end of §6).

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

**Implemented (2 October 2026).** The three rounds shipped together: the engine (`js/learning/sentence-lab.js`), the path page and the player (`#/lab/frasi`, `#/lab/frasi/<lessonId>`; `js/views/labFrasi.js`, `labFrasiLesson.js`, renderers in `js/learning/sentence-lab-activities.js`), the Laboratorio card, the four stages of §2 with 21 lessons (Presente 6, Passato 5, Futuro 4, Strutture 6) and 168 activities in `data/sentence-lab/`, free entry with the three drills and the English picker, reactive conversations one turn at a time, *Say it yourself* with the saved *Le mie frasi*, 15 XP per first completion, “Review the pattern” links through each lesson's `grammarRefs`, `docs/SENTENCE-LAB-CONTRACT.md`, `tools/test-sentence-lab.mjs` and `tests/sentence-lab-e2e.mjs`. Progress is the profile field `lab` (synced, exported, reset with the rest). Of §8, layer 2 is built: the fit scorer (`js/learning/fit-scorer.js`, `js/workers/fit-scorer.worker.js`, `models/fit-scorer/`, `vendor/ort/`; 83 MB, offered from the workshop page's *Strumenti* pane, never required); layer 3 exists as the opt-in experiment of `ASSISTANT-EXPERIMENT.md`, switched on from the same pane and used only to choose among the generic reactions of a conversation turn, and the phone measurement that decides whether it stays has not been made. Two differences from the proposal: a lesson's useful words are drilled and credited only when the learner uses one in a blank (otherwise they are introduced on the model card), and a stage opens when the previous stage's last lesson is done (its conversation lesson, so the rule of §2 holds).

## 7. Decisions so far (2 October 2026)

- Placement: Laboratorio card and its own route (§4). Agreed.
- Conversations: reactive replies, every authored option has a scripted reaction. Agreed, with the AI question below.
- Delivery: all four stages, built and reviewed stage by stage in the preview, shipped as one complete update.
- Free entry: a "smart combination" is wanted. Correctness matters; the owner asked whether a small, fully offline AI model could be shipped inside the app. The assessment follows.

## 8. Can we ship an offline AI model inside the app?

Research done on 2 October 2026 (sources in `docs/RESEARCH-ON-DEVICE-AI-2026-10-02.md`). The short answer: the platform allows it, the small models are not yet good enough at Italian to be the judge of correctness, and iPhones still kill web pages that load them. So the AI goes in as an optional, clearly labelled extra, never as the thing the lessons depend on.

**What the platform offers.** WebGPU is on by default in Safari 26 and later on iPhone, iPad and Mac (September 2025), with 16-bit shader support everywhere. Storage is no longer the problem: an installed Home Screen app gets up to 60 percent of the disk and is exempt from the seven-day purge. The binding limit is memory: a page is killed without warning somewhere between about 1 and 3 GB of footprint depending on the phone and how long it has been on, and no API reports how much is left.

**What the field reports say.** The report closest to this project (iPhone 16 Pro, iOS 26.7, 30 September 2026) loaded two tiny models in every available runtime and the tab died at the first inference every time. WebLLM users on iOS 26 run a 135M model but lose the tab with a 3B one. Transformers.js only switched WebGPU on for Safari on 16 September 2026. iOS 27 shipped on 14 September 2026 and has no reports yet. No measured tokens-per-second figure exists for an iPhone 16 Pro in Safari; the nearest measurement (iPhone 17 Pro Max, a different runtime) is 4 to 17 tokens per second on the smallest models.

**What the models can do in Italian.** The only sub-1B model with a credible Italian footprint is Qwen3 0.6B (336 MB at 4-bit through WebLLM); its own report scores its Italian at roughly a third of the 1.7B model (850 MB). On the one Italian grammatical-acceptability benchmark with published numbers, small generative models score between 5 and 24 (Matthews correlation) while a fine-tuned Italian BERT encoder scores 43 to 60 in domain. A generative model this size would mis-grade learners; an encoder-based scorer would not, and it needs no WebGPU.

**Design that follows from this: three layers.**

1. **Grammar, always on, authoritative.** The deterministic engine of §3: typed slots, dictionary membership, agreement and conjugation. Every accepted sentence is well formed. Ships with the workshop; works offline with nothing to download.
2. **Fit scorer, optional download (about 70 to 110 MB, runs on the CPU in under a second).** An Italian masked-language model (BERTino or bert-base-italian, int8, through ONNX Runtime Web on WebAssembly) scores the learner's free-entry word in the blank against the authored options by pseudo-log-likelihood, and the app says "unusual here" with a confidence when the word is grammatical but odd. It never blocks a well-formed sentence, it only advises, and its verdicts are logged locally so the thresholds can be tuned. Later it can be fine-tuned on ItaCoLA plus our own labelled learner errors. This is the reliable answer to "it should be correct" for meaning.
3. **Assistant, experimental download (about 340 MB, needs WebGPU: iPhone 15 Pro class or newer on iOS 26 or later).** WebLLM with Qwen3 0.6B (or its successor once it runs on phones), with a 1,024-token window and low-resource mode, used only as a selector: it chooses the best reactive reply among the authored reaction lines, breaks ties for the fit scorer, and picks the explanation template that applies. It never writes Italian that the learner reads unreviewed. It is guarded by a crash-loop breaker (if the page dies twice after loading the model, the app disables it) and a memory check, and the whole workshop works identically with it absent. We measure it on the owner's phone before deciding whether to keep it.

Hosting: layer 2's model file fits under GitHub's 100 MB per-file limit as one shard, served from the site like the audio packs and cached in its own cache; layer 3's weights are downloaded from the model's public repository on demand, as WebLLM does by default, so they never enter this repository.

**Reactive replies and the assistant.** Dialogues keep one authored reaction per option, plus two or three generic reactions per turn for free-entry words (one per slot type: an adjective about how you feel gets "Mi dispiace, riposati!" or "Che bello!" depending on the word's polarity tag in the dictionary). Layer 3, when present, picks among those; without it the app picks by the slot's polarity tag. Real branching stays out.

## 9. Open questions

1. Layers 1 and 2 are part of the workshop; layer 3 is built as an experiment first and kept only if it runs reliably on your phone. Agreed?
2. The fit scorer adds a one-time 70 to 110 MB download, offered from the workshop page like unit audio, never automatic. Agreed?
3. May I build the workshop in parallel with the remaining rounds of the vocabulary plan? The files are separate (new `js/learning/sentence-lab*.js`, `js/views/labFrasi*.js`, `data/sentence-lab/`), so the two streams do not collide.
