# Foundations–C2 curriculum map — Phases 0–2

Baseline: `bd60180cc4eea7d9c0bd45e41584048ec752fba1`. The inventory reconciles 256 lessons in 82 units, 1484 authored questions, 445 reserve/review question variants and 260 target repair variants. Every authored step has a source ID and a maintain/repair/merge/replace decision in [curriculum-inventory.json](curriculum-inventory.json).

This is a complete source inventory and an authored coverage map, not a claim that all teaching is editorially approved or that the current course develops full C2 proficiency. Agent/source review, automated validation, native Italian educator review, learner calibration and device validation are separate gates. Native Italian human review and learner calibration are pending.

## Shared language and authoring contract

- Map outcome → vocabulary sense/construction → prerequisite model → guided use → independent fresh use → targeted repair → later retrieval. A tooltip, exposure or reserve flag is not proof of teaching or delayed retention.
- Keep lesson/target/step IDs stable for bounded repairs. A replacement or merge retains explicit source IDs and legacy aliases; old completion and evidence are preserved without awarding new skills.
- `course-sense:*` IDs in this report are deterministic proposed semantic keys from Italian plus contextual English gloss. They are not a released dictionary migration. Existing entry IDs remain intact; runtime lookup candidates and unresolved phrases need sense review.
- All dictionary verbs have a five-core-case availability record. Every course-linked verb has complete engine paradigms for all fifteen tense/mood sets plus participle/gerund forms. Missing cells and construction-specific auxiliaries remain visible. Availability is not teaching, mastery or permission to invent unnatural progressive examples.
- Formal Lei uses third-person singular morphology but requires an explicit polite addressee. Supply referent/agreement or admit reviewed alternatives. State/person/tense/meaning changes never become accent-only corrections.
- Typed answer tolerance follows the shared accent contract; explicit choices retain meaningful e/è distinctions. Match valid alternatives within the task constraint and keep false distractors outside every accepted answer.
- An optional open portfolio or self-review is practice until assessed. Course traversal, speaking practice, natural interaction and certified proficiency remain different facts.
- Phase 2 patches only urgent incorrect grading/teaching and the prerequisites/models needed for existing routes. Catalogue integration belongs to Phase 3; full skill breadth, authentic corpus and lesson rewrite remain Phase 6.

## Verified inventory

| Stage | Units / lessons | Questions / normal independent | Reserve/review / repairs | Language / reading / listening targets | Write / speak / interact / mediate | Related lessons / word-board lessons |
| --- | --- | --- | --- | --- | --- | --- |
| Foundations | 3 / 8 | 53 / 24 | 18 / 8 | 8 / 0 / 0 | 0 / 3 / 1 / 0 | 1 / 5 |
| A1 | 14 / 60 | 414 / 211 | 145 / 60 | 58 / 1 / 1 | 12 / 10 / 2 / 0 | 47 / 38 |
| A2 | 15 / 58 | 369 / 182 | 131 / 58 | 56 / 1 / 1 | 12 / 3 / 2 / 0 | 7 / 15 |
| B1 | 13 / 41 | 218 / 131 | 46 / 41 | 39 / 1 / 1 | 28 / 4 / 4 / 5 | 22 / 15 |
| B2 | 13 / 41 | 205 / 123 | 42 / 41 | 35 / 5 / 1 | 28 / 1 / 3 / 9 | 22 / 7 |
| C1 | 12 / 24 | 111 / 54 | 31 / 26 | 20 / 3 / 3 | 20 / 2 / 1 / 3 | 20 / 0 |
| C2 | 12 / 24 | 114 / 56 | 32 / 26 | 20 / 3 / 3 | 20 / 1 / 0 / 5 | 20 / 6 |

Counts describe the audited source and do not measure proficiency. Synthesized word boards are recorded separately from authored questions. Reserve/review variants may be used during the same visit and do not establish a delayed-review schedule.

## Authored stage outcomes, bridges and lexical strands

### Foundations

**Reception:** Understand a familiar greeting, supplied name/origin and request for repetition; distinguish sounds in an explicitly taught tiny lexicon.
**Production:** Use a greeting, name/origin chunk and help phrase with a model; practise sound contrasts through self-comparison.
**Interaction:** Open, maintain and close a supported first exchange; request a repeat or slower delivery.
**Mediation:** Relay the meaning of a taught greeting/help phrase to a peer with support.

**Entry refresh:** No prior course required; explain the task and meaning before testing.

**Required forms:** Mi chiamo / Come ti chiami / Come si chiama as explained chunks; Sono di + supplied place; c/ch through known words; meaning before discrimination.

- first-contact: ciao, buongiorno, arrivederci, nome. Contextual senses and taught/retrieved occurrences must be checked before publication.
- polite-help: grazie, prego, scusi, per favore, non capisco, ripeti. Contextual senses and taught/retrieved occurrences must be checked before publication.
- known-sounds: casa, cena, caffè, chiave, che. Contextual senses and taught/retrieved occurrences must be checked before publication.

**Exit evidence:** Fresh supported greeting with a name, a help request and leave-taking; separate listening identification and optional recorded self-review.

**Remaining breadth:** No independently assessed listening target; No integrated beginner exit; Sound checks mostly expose spelling.

### A1

**Reception:** Recover names, numbers, time, prices and familiar intentions from short signs, messages and clearly delivered exchanges.
**Production:** Describe self/family/home and daily activities; ask useful questions and write a short familiar message.
**Interaction:** Handle a café/shop exchange, simple directions or appointment; choose tu/Lei from an explicit relationship.
**Mediation:** Pass on a short familiar notice or arrangement without changing names, numbers or time.

**Entry refresh:** `v2-f-greet`, `v2-f-name-polite`, `v2-f-repair`, `v2-f-sound-c`, `v2-f-keep-c-hard`

**Required forms:** Full required present persons including formal Lei for essere/avere, -are/-ere/-ire/-isc and high-frequency irregulars; Article, plural, adjective and possessive forms; question/negation/preposition contrasts; Selected completed-past chunks; full auxiliary persons before reuse.

- identity-family: nome, famiglia, madre, padre, amico. Contextual senses and taught/retrieved occurrences must be checked before publication.
- home-places: casa, scuola, stazione, negozio, strada. Contextual senses and taught/retrieved occurrences must be checked before publication.
- food-shopping: pane, acqua, caffè, pizza, prezzo, euro. Contextual senses and taught/retrieved occurrences must be checked before publication.
- time-routine: oggi, domani, giorno, ora, lavoro, colazione. Contextual senses and taught/retrieved occurrences must be checked before publication.
- clothes-weather-health: camicia, scarpa, pioggia, sole, freddo, dolore. Contextual senses and taught/retrieved occurrences must be checked before publication.

**Exit evidence:** Fresh introduction, familiar transaction, short message/sign, and simple taught past account; retain separate reading/listening/portfolio/self-review strands.

**Remaining breadth:** Clothes/weather/basic-health strands need dedicated communicative teaching; Only one reading and one listening target; No integrated A1 stage exit.

### A2

**Reception:** Understand routine services, appointments, plans, short accounts and changes of arrangement in clear connected language.
**Production:** Tell a connected past account distinguishing event/background/habit and action underway; express plans and polite requests.
**Interaction:** Solve a routine service or travel change; ask follow-up and repair misunderstanding.
**Mediation:** Relay an arrangement or short service message, retaining conditions, quantities and practical actions.

**Entry refresh:** `v2-a1-essere-plural`, `v2-a1-avere-plural`, `v2-a1-are-plural`, `v2-a1-present-ere`, `v2-a1-present-ire`, `v2-a1-past-essere`

**Required forms:** Full taught persons of passato prossimo/imperfetto/futuro/conditional including auxiliary and agreement; stare present/imperfect + own verb gerund with aspect/context; Direct/indirect clitics, elision, negation, attachment and tu/voi/Lei commands.

- travel-services: biglietto, treno, autobus, prenotazione, albergo. Contextual senses and taught/retrieved occurrences must be checked before publication.
- appointments-plans: appuntamento, orario, medico, ufficio. Contextual senses and taught/retrieved occurrences must be checked before publication.
- past-routine: prima, poi, ieri, spesso, mentre. Contextual senses and taught/retrieved occurrences must be checked before publication.
- people-reference: qualcuno, qualcosa, nessuno, niente, tutti. Contextual senses and taught/retrieved occurrences must be checked before publication.
- changing-plans: problema, ritardo, cambiare, potere, volere, dovere. Contextual senses and taught/retrieved occurrences must be checked before publication.

**Exit evidence:** Fresh service dialogue plus appointment change and connected past message; comprehension and open responses remain separate evidence.

**Remaining breadth:** Only 7/58 baseline related-entry links; Partial person models in past/future lessons; No integrated A2 stage exit.

### B1

**Reception:** Follow connected everyday narratives, explanations, practical rules and reported messages.
**Production:** Compose a connected account, explanation, advice or opinion with clear time/reference and meaningful clause links.
**Interaction:** Maintain an independent everyday exchange, revise a plan and ask clarifying follow-up.
**Mediation:** Relay information from a voicemail/service/rule to another person, preserving the source and required action.

**Entry refresh:** `v2-a2-story-contrast`, `v2-a2-direct-attached`, `v2-a2-indirect-groups`, `v2-a2-future-irregular`, `v2-a2-conditional-plan`, `v2-a2-real-if`

**Required forms:** Earlier past, tense relationships and real conditional sequences; Combined clitics, ci/ne/ce ne with distinct functions and clear antecedents; Explicit present-subjunctive bridges before opinion/wish/judgment frames; passive/impersonal si.

- accounts-change: ricordo, esperienza, abitudine, cambiamento. Contextual senses and taught/retrieved occurrences must be checked before publication.
- requests-problems: richiesta, soluzione, consiglio, bisogno. Contextual senses and taught/retrieved occurrences must be checked before publication.
- cause-consequence: perché, poiché, quindi, nonostante. Contextual senses and taught/retrieved occurrences must be checked before publication.
- reference-quantity: ci, ne, ce ne, cui, tutto. Contextual senses and taught/retrieved occurrences must be checked before publication.
- opinions-reports: penso, spero, dubbio, messaggio, regola. Contextual senses and taught/retrieved occurrences must be checked before publication.

**Exit evidence:** Fresh connected account, service problem with follow-up, practical listening update and source relay; delayed retrieval on another occasion.

**Remaining breadth:** Natural unscripted interaction remains unassessed; Sustained listening corpus still narrow; Linked lexical retrieval needs planned later contexts.

### B2

**Reception:** Follow sustained arguments, viewpoint, reported exchanges and institutional/news/narrative register.
**Production:** Defend and qualify opinions, express hypotheticals, negotiate a remedy and revise coherent writing with a rubric.
**Interaction:** Respond to objections, clarify intent and negotiate with multiple speakers across follow-up turns.
**Mediation:** Compare sources and relay audience-relevant information without overstating evidence or hiding agents.

**Entry refresh:** `v2-b1-subjunctive-bridge`, `v2-b1-reporting-information`, `v2-b1-che-cui`, `v2-b1-impersonal-si`, `v2-b1-cause-links`, `v2-b1-capstone-relay`

**Required forms:** Productive present/imperfect/past/pluperfect subjunctive with timeline models; Past conditional and mixed counterfactuals; reported speech and command shifts; Passive/si, complex relatives, dislocation/cleft, controlled nonfinite clauses, narrative past recognition.

- argument-evidence: argomento, prova, fonte, vantaggio, limite. Contextual senses and taught/retrieved occurrences must be checked before publication.
- negotiation-institutions: reclamo, compromesso, accordo, rimedio. Contextual senses and taught/retrieved occurrences must be checked before publication.
- stance-condition: sebbene, tuttavia, qualora, ipotesi. Contextual senses and taught/retrieved occurrences must be checked before publication.
- register-report: resoconto, intervista, comunicato, racconto. Contextual senses and taught/retrieved occurrences must be checked before publication.
- cohesion-reference: cui, il quale, pertanto, mentre. Contextual senses and taught/retrieved occurrences must be checked before publication.

**Exit evidence:** Fresh qualified argument with two sources, negotiated objection, listening relay and revised mediation; retained performance beyond the familiar dossier.

**Remaining breadth:** Only one independent listening target; Longer natural multi-speaker material required; Optional discussion portfolio cannot attest interaction competence.

### C1

**Reception:** Interpret extended implicit stance, presupposition and source relationships across professional/academic discourse and varied natural voices.
**Production:** Produce organised extended arguments and precise professional/academic correspondence; reformulate with appropriate certainty/register.
**Interaction:** Manage discussion, qualify claims, negotiate disagreement and repair misunderstanding through real follow-up.
**Mediation:** Synthesize complementary/conflicting sources, retaining attribution, limitations and audience needs.

**Entry refresh:** `v2-b2-tense-relations`, `v2-b2-mixed-condition`, `v2-b2-evidence-source`, `v2-b2-actor-control`, `v2-b2-capstone-mediation`

**Required forms:** Full relative-time subjunctive/conditional paradigms and epistemic future distinctions; Controlled compound gerund/participle clauses, reference/focus and concessive relations; Institutional si/passive, nominalisation and compact clauses without lost agents/time.

- claim-certainty: riscontro, ipotesi, evidenza, plausibile, smentire. Contextual senses and taught/retrieved occurrences must be checked before publication.
- professional-discourse: verbale, relazione, istanza, delibera. Contextual senses and taught/retrieved occurrences must be checked before publication.
- nuance-reformulation: precisare, rettificare, sfumatura, invece. Contextual senses and taught/retrieved occurrences must be checked before publication.
- sources-audience: attribuzione, testimonianza, bilancio, destinatario. Contextual senses and taught/retrieved occurrences must be checked before publication.
- discussion-register: obiezione, concessione, intervento, replica. Contextual senses and taught/retrieved occurrences must be checked before publication.

**Exit evidence:** Fresh extended natural listening and complex reading, sustained argument, discussion follow-up and multi-source synthesis with reviewed rubric.

**Remaining breadth:** 24 lessons reuse only 12 principal reading dossiers; Only one interact portfolio and no actual partner prompt; 14 audio clips ~7.21 minutes, dominated by synthetic practice; No baseline vocabulary matching boards.

### C2

**Reception:** Interpret difficult natural speech and nuanced text, including supported irony, ambiguity, colloquial variation and competing readings.
**Production:** Reformulate and edit precisely for audience/style without changing scope, conditions, attribution or certainty.
**Interaction:** Manage delicate disagreement and repair; shift register and expression flexibly in unscripted follow-up.
**Mediation:** Synthesize demanding contested evidence and explain decision-relevant unknowns to different audiences.

**Entry refresh:** `v2-c1-u1-subjunctive-perspective`, `v2-c1-u2-past-subjunctive-time`, `v2-c1-u3-qualified-conclusion`, `v2-c1-u6-participle-gerund`, `v2-c1-u10-conditional-politeness`, `v2-c1-u12-reduced-formal-clauses`

**Required forms:** Mood/evidence, aspect perspective, unreal/mixed conditions and quantifier/pronoun scope; Register-sensitive dislocation, literary tense/order and presupposition; Implicit hypotheses, modal inference, relative possession and agent-preserving compression.

- precision-scope: connotazione, collocazione, ambiguità, sfumatura. Contextual senses and taught/retrieved occurrences must be checked before publication.
- idiom-pragmatics: ironia, allusione, sottinteso, equivoco. Contextual senses and taught/retrieved occurrences must be checked before publication.
- register-style: colloquiale, retorica, parafrasi, stile. Contextual senses and taught/retrieved occurrences must be checked before publication.
- evidence-decision: riserva, accessibilità, limite, dossier. Contextual senses and taught/retrieved occurrences must be checked before publication.
- interaction-repair: fraintendimento, rettifica, obiezione, mediazione. Contextual senses and taught/retrieved occurrences must be checked before publication.

**Exit evidence:** Unseen difficult listening/text, substantial stylistic reformulation, demanding audience mediation and real interaction repair, with retained performance and educator feedback.

**Remaining breadth:** 24 lessons reuse only 12 principal reading dossiers; No interact portfolio or partner prompt; 14 audio clips ~7.63 minutes, dominated by synthetic practice; Lexical nuance/pragmatic targets need dedicated fresh contexts.

## Every unit and lesson: outcome, prerequisites and disposition

Each row keeps the current bounded communicative outcome. Repair decisions for advanced breadth are Phase 6 work, with a specific urgent Phase 2 list below. Proposed references map to existing local pages when possible; `new:` identifies a missing reference subject.

### v2-foundations-u1 — Make first contact

Greet, exchange names, and choose familiar or polite address.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-f-greet` | I can greet someone and take leave. | entry | repair / 2 | communicative chunks; review support rather than force a grammar link |
| `v2-f-name` | I can ask and give a name with a model. | `v2-f-greet` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-f-name-polite` | I can choose a polite name question for a stranger. | `v2-f-name` | maintain | new:register-pragmatics-and-interaction |

### v2-foundations-u2 — Keep the exchange going

Use courtesy and repair phrases in short conversations.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-f-courtesy` | I can use grazie, prego, scusi and per favore in their different jobs. | `v2-f-name-polite` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-f-repair` | I can say I do not understand and ask for repetition. | `v2-f-courtesy` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-foundations-u3 — Connect meaning and sound

Use supported origin phrases and hear familiar spelling patterns.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-f-origin` | I can use Sono di with a supplied place name. | `v2-f-repair` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-f-sound-c` | I can connect familiar c spellings with their taught sounds. | `v2-f-origin` | maintain | spelling, new:phonology-listening-and-self-comparison |
| `v2-f-keep-c-hard` | I can recognize ch in a few introduced words. | `v2-f-sound-c` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-a1-u1 — Say who you are

Turn familiar identity phrases into reusable essere forms.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-essere-singular` | I can choose essere for I, familiar you, and one other person. | `v2-f-sound-c` | maintain | tenses |
| `v2-a1-essere-polite` | I can ask or tell who a person is using polite Lei. | `v2-a1-essere-singular` | maintain | tenses, new:register-pragmatics-and-interaction |
| `v2-a1-essere-plural` | I can use siamo, siete and sono with plural people. | `v2-a1-essere-polite` | maintain | tenses, auxiliaries |
| `v2-a1-vowels-stress` | I can recognize familiar vowel spellings and marked final stress. | `v2-a1-essere-plural` | maintain | spelling, new:phonology-listening-and-self-comparison |
| `v2-a1-written-accents` | I can distinguish e from è and preserve familiar final accents. | `v2-a1-vowels-stress` | maintain | spelling |

### v2-a1-u2 — Name familiar things

Learn noun gender and singular articles with known objects and people.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-singular-gender` | I can use il or la with familiar singular nouns. | `v2-a1-essere-plural` | maintain | articles |
| `v2-a1-one-thing` | I can distinguish un, una and un’ with a familiar noun. | `v2-a1-singular-gender` | repair / 2 | articles |
| `v2-a1-special-articles` | I can use lo/uno and l’ with their taught nouns. | `v2-a1-one-thing` | maintain | articles |

### v2-a1-u3 — Say what you have

Use avere for possessions, ages, and basic physical states.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-avere-singular` | I can use ho, hai and ha for possessions. | `v2-a1-special-articles` | maintain | tenses |
| `v2-a1-avere-plural` | I can choose abbiamo, avete and hanno. | `v2-a1-avere-singular` | maintain | tenses |
| `v2-a1-small-numbers` | I can recognize and say zero through ten in practical information. | `v2-a1-avere-plural` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a1-age-states` | I can use avere to state a modeled age or hunger and thirst. | `v2-a1-small-numbers` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a1-silent-h` | I can keep the silent h in familiar avere forms. | `v2-a1-avere-plural` | maintain | spelling |

### v2-a1-u4 — Describe one or several things

Build regular plurals, plural articles and simple adjective agreement.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-noun-plurals` | I can form regular plurals of taught nouns. | `v2-a1-age-states` | maintain | plurals, articles |
| `v2-a1-plural-articles` | I can choose i, gli and le for taught plurals. | `v2-a1-noun-plurals` | maintain | articles, plurals |
| `v2-a1-plural-spelling` | I can write amiche and know that città does not change. | `v2-a1-plural-articles` | maintain | plurals, articles, spelling |
| `v2-a1-adjective-agreement` | I can match piccolo or grande to a familiar noun. | `v2-a1-plural-spelling` | maintain | adjectives |
| `v2-a1-double-consonants` | I can preserve a familiar single/double-consonant spelling contrast. | `v2-a1-adjective-agreement` | maintain | spelling, new:phonology-listening-and-self-comparison |

### v2-a1-u5 — Talk about everyday actions

Use -are verbs, questions and negation for familiar routines.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-are-singular` | I can use regular -are verbs with I, you, and one other person. | `v2-a1-adjective-agreement` | maintain | tenses |
| `v2-a1-are-plural` | I can use -iamo, -ate and -ano for regular -are verbs. | `v2-a1-are-singular` | maintain | tenses |
| `v2-a1-present-questions` | I can ask a yes/no or dove question using a taught present form. | `v2-a1-are-plural` | maintain | tenses |
| `v2-a1-present-negation` | I can put non before a known present verb. | `v2-a1-present-questions` | maintain | tenses |
| `v2-a1-question-intonation` | I can recognize a familiar question and practise its intonation. | `v2-a1-present-questions` | maintain | spelling, new:phonology-listening-and-self-comparison |

### v2-a1-u6 — Expand everyday actions

Use regular -ere, -ire and -isc present patterns with useful routines.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-present-ere` | I can choose present -ere forms for familiar persons. | `v2-a1-present-negation` | repair / 2 | tenses |
| `v2-a1-present-ire` | I can use ordinary -ire endings with a known verb. | `v2-a1-present-ere` | repair / 2 | tenses |
| `v2-a1-present-isc` | I can use the taught -isc- forms of capire. | `v2-a1-present-ire` | maintain | tenses, isc |
| `v2-a1-g-and-gh` | I can recognize the taught hard and soft g patterns. | `v2-a1-present-isc` | maintain | spelling, new:phonology-listening-and-self-comparison |

### v2-a1-u7 — Go places and do things

Use selected irregular presents and basic place relationships.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-andare` | I can use selected present forms of andare in a plan. | `v2-a1-present-isc` | repair / 2 | tenses |
| `v2-a1-fare` | I can use selected forms of fare in familiar activities. | `v2-a1-andare` | repair / 2 | tenses |
| `v2-a1-venire` | I can use selected present forms of venire. | `v2-a1-fare` | repair / 2 | tenses |
| `v2-a1-a-in-places` | I can use a with taught cities and in with taught countries. | `v2-a1-venire` | maintain | prepositions |
| `v2-a1-da-con` | I can use da for source and con for a companion. | `v2-a1-a-in-places` | maintain | prepositions |
| `v2-a1-sc-and-sch` | I can recognize the taught soft sc and hard sc/sch patterns. | `v2-a1-a-in-places` | maintain | spelling, new:phonology-listening-and-self-comparison |

### v2-a1-u8 — Find things and places

Express what is present and locate familiar people or objects.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-there-is` | I can choose c’è or ci sono for one or several things. | `v2-a1-da-con` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a1-near-far` | I can say a familiar thing is near or far from a known place. | `v2-a1-there-is` | repair / 2 | adjectives, prepositions |
| `v2-a1-a-in-articles` | I can use al/alla and nel/nella with familiar places. | `v2-a1-near-far` | maintain | articles, prepositions |

### v2-a1-u9 — Say whose and which

Identify possessions and choose nearby or more distant things.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-my-possessives` | I can match mio/mia/miei/mie to a known noun. | `v2-a1-a-in-articles` | maintain | adjectives |
| `v2-a1-family-possessives` | I can say mia madre and tuo padre without an article. | `v2-a1-my-possessives` | maintain | adjectives |
| `v2-a1-demonstratives` | I can select questo/questa and quel/quella for familiar things. | `v2-a1-family-possessives` | maintain | adjectives |
| `v2-a1-gn-and-gli` | I can recognize gn and gli in introduced everyday words. | `v2-a1-family-possessives` | maintain | spelling, new:phonology-listening-and-self-comparison |

### v2-a1-u10 — Buy and arrange things

Use introduced numbers, prices, times and amounts in a short transaction.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-numbers-eleven-twenty` | I can read and use selected numbers from eleven to twenty. | `v2-a1-demonstratives` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a1-tens-prices` | I can use introduced tens in a simple euro price. | `v2-a1-numbers-eleven-twenty` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a1-days-clock` | I can use a taught day and alle/all’una with a clock time. | `v2-a1-tens-prices` | repair / 2 | communicative chunks; review support rather than force a grammar link |
| `v2-a1-many-few` | I can match molto/poco to familiar count and mass nouns. | `v2-a1-days-clock` | maintain | adjectives |

### v2-a1-u11 — Ask, respond and express preferences

Make familiar requests, say what you want, and give a brief reason.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-potere-requests` | I can use posso, puoi and polite può before an infinitive. | `v2-a1-many-few` | repair / 2 | tenses, new:register-pragmatics-and-interaction |
| `v2-a1-want-need` | I can choose taught present forms of volere and dovere before a known infinitive. | `v2-a1-potere-requests` | repair / 2 | tenses |
| `v2-a1-piacere` | I can choose mi piace or mi piacciono for a known thing. | `v2-a1-want-need` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a1-familiar-commands` | I can use a taught tu command and its negative. | `v2-a1-piacere` | maintain | imperative |
| `v2-a1-basic-links` | I can distinguish e, ma and perché in a short statement. | `v2-a1-familiar-commands` | maintain | new:clause-links-and-cohesion |

### v2-a1-u12 — Describe a first completed event

Report a small completed event with taught auxiliaries and participles.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-past-are` | I can use avere plus a regular -ato participle for a completed act. | `v2-a1-basic-links` | maintain | tenses |
| `v2-a1-past-ere-ire` | I can use the taught -uto and -ito participles with avere. | `v2-a1-past-are` | maintain | tenses |
| `v2-a1-past-essere` | I can use selected essere past forms with stated subject agreement. | `v2-a1-past-ere-ire` | maintain | tenses, auxiliaries |
| `v2-a1-first-past-message` | I can choose a taught completed form in a simple message. | `v2-a1-past-essere` | maintain | tenses |
| `v2-a1-read-a-message` | I can find a practical detail in a short written message. | `v2-a1-first-past-message` | maintain | new:source-reasoning-and-mediation |
| `v2-a1-listen-for-a-detail` | I can pick out a practical detail from a short recording. | `v2-a1-read-a-message` | maintain | new:source-reasoning-and-mediation |

### v2-a1-u13 — Ask and answer

Open a question with the right word and give the answer it asks for.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-question-words-1` | I can open a question with chi, che cosa, dove or quando and put the verb next. | `v2-a1-first-past-message` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a1-question-words-2` | I can ask with come, perché, quanto and quale, and make quanto and quale agree with the noun. | `v2-a1-question-words-1` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a1-ask-and-answer` | I can give the kind of answer a question word asks for and use perché both for why and for because. | `v2-a1-question-words-2` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-a1-u14 — Prepositions and articles

Join a and di to every article, including clock times and whose something is.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a1-a-articles-system` | I can choose al, allo, all’, alla, ai, agli or alle from the noun’s article, and say clock times. | `v2-a1-ask-and-answer` | maintain | articles, prepositions |
| `v2-a1-di-articles` | I can choose del, dello, dell’, della, dei, degli or delle to say whose something is or where it comes from. | `v2-a1-a-articles-system` | maintain | articles, prepositions |

### v2-a2-u1 — Describe a daily routine

Use a small reflexive pattern in ordinary routines.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-reflexive-me-you` | I can use mi and ti with alzarsi. | `v2-a1-di-articles` | maintain | reflexives |
| `v2-a2-reflexive-he-we` | I can use si or ci with alzarsi. | `v2-a2-reflexive-me-you` | maintain | reflexives |
| `v2-a2-reflexive-evening` | I can use mi lavo, ti lavi and si lava with a stated person. | `v2-a2-reflexive-he-we` | maintain | reflexives |

### v2-a2-u2 — Report more completed events

Broaden familiar avere past forms through selected verbs.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-past-regular` | I can use a modeled regular participle with avere. | `v2-a2-reflexive-evening` | maintain | tenses, auxiliaries |
| `v2-a2-past-irregular` | I can retrieve fatto, visto, preso and scritto. | `v2-a2-past-regular` | repair / 2 | tenses, auxiliaries |
| `v2-a2-past-auxiliary-person` | I can pair an avere auxiliary with a taught participle. | `v2-a2-past-irregular` | repair / 2 | tenses, auxiliaries |

### v2-a2-u3 — Describe travel and change

Use essere past forms, agreement, and reflexive completion.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-essere-travel` | I can use sono or sei with andato/andata. | `v2-a2-past-auxiliary-person` | maintain | tenses, auxiliaries |
| `v2-a2-essere-plural` | I can make plural participles agree after essere. | `v2-a2-essere-travel` | repair / 2 | tenses, auxiliaries |
| `v2-a2-reflexive-past` | I can use a modeled reflexive past with essere and agreement. | `v2-a2-essere-plural` | maintain | tenses, auxiliaries, reflexives |
| `v2-a2-auxiliary-choice` | I can choose avere for a completed action or essere for known movement. | `v2-a2-reflexive-past` | maintain | auxiliaries |

### v2-a2-u4 — Set the scene in the past

Learn imperfect forms in descriptions and repeated past routines.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-imperfect-are` | I can use parlavo and parlava for a past routine. | `v2-a2-auxiliary-choice` | repair / 2 | tenses, passato-imperfetto |
| `v2-a2-imperfect-ere-ire` | I can use taught -ere/-ire imperfect forms in habitual contexts. | `v2-a2-imperfect-are` | repair / 2 | tenses, passato-imperfetto |
| `v2-a2-imperfect-states` | I can use ero, era, avevo and aveva for past states. | `v2-a2-imperfect-ere-ire` | repair / 2 | tenses, passato-imperfetto |

### v2-a2-u5 — Tell a past story

Contrast the background with completed events in short narratives.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-habit-versus-event` | I can choose imperfect for a habit and passato prossimo for one completed occasion. | `v2-a2-imperfect-states` | maintain | passato-imperfetto |
| `v2-a2-story-contrast` | I can distinguish a background state from an event in a short story. | `v2-a2-habit-versus-event` | maintain | passato-imperfetto |
| `v2-a2-short-story` | I can choose a background imperfect and two completed actions. | `v2-a2-story-contrast` | maintain | passato-imperfetto |

### v2-a2-u6 — Show an action in progress

Use stare plus gerund only where ongoing viewpoint matters.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-progressive-present` | I can use sto, stai or sta plus a taught gerund. | `v2-a2-short-story` | repair / 2 | tenses, new:aspect-and-nonfinite-actor-control |
| `v2-a2-simple-versus-progressive` | I can distinguish parlo from sto parlando by meaning. | `v2-a2-progressive-present` | maintain | tenses, passato-imperfetto, new:aspect-and-nonfinite-actor-control |
| `v2-a2-progressive-past` | I can use stavo or stava plus gerund for an ongoing past action. | `v2-a2-simple-versus-progressive` | repair / 2 | tenses, passato-imperfetto, new:aspect-and-nonfinite-actor-control |

### v2-a2-u7 — Keep track of people and things

Use direct objects after their referents are established.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-direct-singular` | I can use lo or la for a clear singular object. | `v2-a2-progressive-past` | repair / 2 | pronouns |
| `v2-a2-direct-plural` | I can use li or le for a clear plural object. | `v2-a2-direct-singular` | maintain | pronouns |
| `v2-a2-direct-reference` | I can choose a direct pronoun from its stated referent. | `v2-a2-direct-plural` | maintain | pronouns |
| `v2-a2-direct-me-you-us` | I can use mi, ti, ci and vi as direct objects before the verb. | `v2-a2-direct-reference` | maintain | pronouns |
| `v2-a2-direct-elision-negation` | I can write l’ before a verb that begins with a vowel and put non before the pronoun and verb. | `v2-a2-direct-me-you-us` | repair / 2 | pronouns |
| `v2-a2-direct-attached` | I can attach a direct pronoun to an infinitive after per or a modal, to a gerund and to a familiar command. | `v2-a2-direct-elision-negation` | maintain | pronouns |

### v2-a2-u8 — Give things to people

Distinguish recipients and choose a natural clitic position.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-indirect-me-you` | I can use mi or ti for a recipient with dare or scrivere. | `v2-a2-direct-attached` | maintain | pronouns |
| `v2-a2-indirect-him-her` | I can use gli for a male recipient and le for a female recipient. | `v2-a2-indirect-me-you` | maintain | pronouns |
| `v2-a2-indirect-groups` | I can use ci and vi for group recipients in a clear exchange. | `v2-a2-indirect-him-her` | maintain | pronouns |
| `v2-a2-pronoun-placement` | I can place a direct pronoun before a modal or attach it to an infinitive. | `v2-a2-indirect-groups` | maintain | pronouns |

### v2-a2-u9 — Plan ahead

Use modeled future forms for plans beyond the present.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-future-are` | I can use parlerò, parlerai or parlerà for a future conversation. | `v2-a2-pronoun-placement` | repair / 2 | tenses |
| `v2-a2-future-ere-ire` | I can use prenderò and dormirò for two later actions. | `v2-a2-future-are` | repair / 2 | tenses |
| `v2-a2-future-irregular` | I can use sarò, avrò and andrò in a plan. | `v2-a2-future-ere-ire` | repair / 2 | tenses |
| `v2-a2-near-plan` | I can use present for an arranged near plan and future for a later prediction or intention. | `v2-a2-future-irregular` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-a2-u10 — Ask politely and imagine

Use small conditional chunks before broad hypothetical syntax.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-conditional-request` | I can use vorrei, potrei and potrebbe in a polite exchange. | `v2-a2-near-plan` | repair / 2 | tenses, new:register-pragmatics-and-interaction |
| `v2-a2-conditional-plan` | I can use vorrei, andrei and farei for a tentative plan. | `v2-a2-conditional-request` | repair / 2 | tenses |
| `v2-a2-formal-request` | I can distinguish familiar puoi from polite potrebbe in a real request. | `v2-a2-conditional-plan` | maintain | imperative, new:register-pragmatics-and-interaction |

### v2-a2-u11 — Compare and measure

Make bounded comparisons and describe quantities.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-compare-more-less` | I can use più or meno with di for two compared nouns or people. | `v2-a2-formal-request` | maintain | adjectives |
| `v2-a2-compare-activities` | I can use più or meno with che when comparing two activities. | `v2-a2-compare-more-less` | maintain | adjectives |
| `v2-a2-relative-superlative` | I can use il più or la più with a defined group. | `v2-a2-compare-activities` | maintain | adjectives, pronouns |
| `v2-a2-absolute-superlative` | I can use -issimo/-issima with a taught adjective. | `v2-a2-relative-superlative` | maintain | adjectives |
| `v2-a2-quantity` | I can distinguish qualche, alcuni and un po’ di in familiar shopping contexts. | `v2-a2-absolute-superlative` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-a2-u12 — Give clear instructions

Distinguish familiar commands from polite Lei commands.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-tu-commands` | I can use familiar tu commands for taught verbs. | `v2-a2-quantity` | maintain | imperative |
| `v2-a2-voi-commands` | I can use voi commands with familiar verbs. | `v2-a2-tu-commands` | maintain | imperative |
| `v2-a2-lei-commands` | I can use formal Lei commands for taught verbs. | `v2-a2-voi-commands` | maintain | imperative |
| `v2-a2-negative-commands` | I can form a negative familiar or polite instruction. | `v2-a2-lei-commands` | maintain | imperative |

### v2-a2-u13 — Locate and measure time

Choose da and common contracted prepositions in bounded contexts.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-da-origin` | I can use da with venire for a named place. | `v2-a2-negative-commands` | maintain | prepositions |
| `v2-a2-da-duration` | I can use da with present for a state continuing up to now. | `v2-a2-da-origin` | maintain | prepositions |
| `v2-a2-del-dal` | I can understand del and dal with masculine singular nouns. | `v2-a2-da-duration` | maintain | prepositions |
| `v2-a2-preposition-contractions` | I can use al, nel and sul with familiar place nouns. | `v2-a2-del-dal` | maintain | prepositions |
| `v2-a2-in-su-da-articles` | I can choose the right form of in, su and da with any article. | `v2-a2-preposition-contractions` | maintain | articles, prepositions |

### v2-a2-u14 — Connect and understand a small story

Link causes, referents, and real possibilities.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-link-reason-sequence` | I can use perché, poi and quindi for different relations. | `v2-a2-in-su-da-articles` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a2-relative-che` | I can join two short ideas with relative che. | `v2-a2-link-reason-sequence` | maintain | pronouns |
| `v2-a2-real-if` | I can use se with present for an open real condition. | `v2-a2-relative-che` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-a2-read-small-story` | I can find who did what in a short past narrative. | `v2-a2-real-if` | maintain | passato-imperfetto, new:source-reasoning-and-mediation |
| `v2-a2-listen-service` | I can identify the request or answer in a new service exchange. | `v2-a2-read-small-story` | maintain | new:source-reasoning-and-mediation |

### v2-a2-u15 — Someone, something, somewhere

Talk about unnamed people, things and places, say that there is nobody or nothing, and link replies naturally.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-a2-someone-something` | I can use qualcuno for an unnamed person, qualcosa for an unnamed thing, qualche with a singular noun and da qualche parte for an unknown place. | `v2-a2-listen-service` | maintain | pronouns |
| `v2-a2-nobody-nothing` | I can use nessuno and niente with non after the verb, and without non when they open the sentence. | `v2-a2-someone-something` | maintain | pronouns |
| `v2-a2-everyday-links` | I can choose allora or dunque to draw a conclusion, però or invece to contrast, and anche or infatti to add or confirm. | `v2-a2-nobody-nothing` | maintain | new:clause-links-and-cohesion |

### v2-b1-connected-story — Tell what happened

Build a connected account with scene, event, sequence and outcome.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-story-background-event` | I can say what was happening when one event occurred. | `v2-a2-story-contrast` | maintain | passato-imperfetto |
| `v2-b1-story-sequence` | I can recount a short sequence with clear time markers. | `v2-b1-story-background-event` | maintain | passato-imperfetto |
| `v2-b1-story-outcome` | I can connect an unexpected event to what happened next. | `v2-b1-story-sequence` | maintain | passato-imperfetto |

### v2-b1-earlier-past-unit — Explain what happened earlier

Place a cause before another past event and keep agreement clear.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-earlier-past` | I can show that one past action happened before another. | `v2-b1-story-outcome` | maintain | tenses |
| `v2-b1-earlier-essere` | I can place an earlier movement before a later event with essere. | `v2-b1-earlier-past` | maintain | tenses, auxiliaries |
| `v2-b1-earlier-explanation` | I can explain a past result with an action that had already happened. | `v2-b1-earlier-essere` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-b1-life-changed — Describe how life changed

Contrast old routines with a particular event and the present.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-past-habits` | I can distinguish an old routine from a single completed occasion. | `v2-b1-earlier-explanation` | maintain | tenses, passato-imperfetto |
| `v2-b1-then-now` | I can compare a former routine with a present routine. | `v2-b1-past-habits` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b1-changing-duration` | I can say how long a former situation lasted and when it changed. | `v2-b1-then-now` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-b1-give-request — Give and request things

Refer clearly to recipients and objects in messages and requests.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-recipient-reference` | I can use a recipient pronoun without losing track of who receives something. | `v2-b1-changing-duration` | maintain | pronouns |
| `v2-b1-double-pronouns` | I can combine an indirect object pronoun with a direct one. | `v2-b1-recipient-reference` | maintain | pronouns |
| `v2-b1-pronoun-request` | I can use a combined pronoun in a request or answer. | `v2-b1-double-pronouns` | maintain | pronouns, new:register-pragmatics-and-interaction |

### v2-b1-place-quantity — Places and quantities

Replace a known place, item or amount without losing the referent.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-ci-place` | I can refer back to a known place with ci. | `v2-b1-pronoun-request` | maintain | pronouns |
| `v2-b1-ne-quantity` | I can replace a previously named quantity or di phrase with ne. | `v2-b1-ci-place` | maintain | pronouns |
| `v2-b1-ce-ne-quantity` | I can respond to a quantity question using ce ne. | `v2-b1-ne-quantity` | repair / 2 | pronouns |

### v2-b1-identify-people — Identify people and things

Use relative clauses and explicit reference to guide a listener.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-che-cui` | I can link a noun to a clause using che or cui. | `v2-b1-ce-ne-quantity` | maintain | pronouns |
| `v2-b1-relative-prepositions` | I can carry a verb’s required preposition into a relative clause. | `v2-b1-che-cui` | maintain | pronouns, prepositions |
| `v2-b1-clarify-reference` | I can repeat a noun or choose a relative clause so listeners know whom I mean. | `v2-b1-relative-prepositions` | maintain | pronouns |

### v2-b1-workable-plan — Make a workable plan

State real conditions, alternatives and a revised arrangement.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-real-condition` | I can use se with an open, realistic condition. | `v2-b1-clarify-reference` | maintain | tenses |
| `v2-b1-plan-options` | I can propose two workable options depending on what happens. | `v2-b1-real-condition` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b1-revise-plan` | I can explain a condition and suggest a practical replacement plan. | `v2-b1-plan-options` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-b1-explain-problem — Explain a problem

Connect reasons, aims, consequences, obstacles and sequence.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-cause-purpose` | I can choose a reason or purpose clause according to meaning. | `v2-b1-revise-plan` | maintain | new:clause-links-and-cohesion |
| `v2-b1-consequence-concession` | I can link a result or a fact that contrasts with expectation. | `v2-b1-cause-purpose` | maintain | new:clause-links-and-cohesion |
| `v2-b1-before-after` | I can sequence actions and choose infinitive or finite clauses. | `v2-b1-consequence-concession` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-b1-hopes-doubts — Hopes and doubts

Build and use a limited, explicitly introduced present subjunctive toolkit.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-subjunctive-bridge` | I can recognize and make frequent present subjunctive forms for opinions and wishes. | `v2-b1-before-after` | maintain | tenses, new:mood-selection-and-relative-time |
| `v2-b1-opinion-doubt` | I can use the present subjunctive after uncertain opinions. | `v2-b1-subjunctive-bridge` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b1-wishes-feelings` | I can express what I want or feel about another person’s action. | `v2-b1-opinion-doubt` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b1-impersonal-judgment` | I can make an impersonal evaluation with che and a subjunctive. | `v2-b1-wishes-feelings` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-b1-relay-message — Relay a message

Report statements, embed questions and preserve a speaker’s meaning.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-reporting-information` | I can report a statement with dire che and a clear point of view. | `v2-b1-impersonal-judgment` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b1-indirect-questions` | I can embed a yes/no or wh-question after a reporting verb. | `v2-b1-reporting-information` | maintain | pronouns |
| `v2-b1-relay-voicemail` | I can pass on a short voicemail without changing the facts. | `v2-b1-indirect-questions` | maintain | new:source-reasoning-and-mediation |

### v2-b1-rules-writeback — Read rules and write back

Understand general rules and simple passive service notices.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-impersonal-si` | I can express a general habit or rule with impersonal si. | `v2-b1-relay-voicemail` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b1-passive-present` | I can make a present or completed passive statement. | `v2-b1-impersonal-si` | maintain | tenses |
| `v2-b1-read-rules` | I can extract the action required by a short public notice and reply clearly. | `v2-b1-passive-present` | maintain | new:source-reasoning-and-mediation |

### v2-b1-u13 — Agree and connect

Agree the participle with a preceding object pronoun, refer to everyone and everything, and link reasons to their consequences.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-object-agreement` | I can make the past participle agree with lo, la, li or le placed before avere, and leave it unchanged when the object follows the verb. | `v2-a2-direct-singular`, `v2-a2-direct-plural`, `v2-b1-ne-quantity` | maintain | pronouns |
| `v2-b1-everyone-everything` | I can use ognuno, ciascuno, tutti, tutto, ovunque and dappertutto with the right verb agreement. | `v2-b1-object-agreement`, `v2-a2-essere-plural` | maintain | pronouns |
| `v2-b1-cause-links` | I can open a sentence with siccome, poiché or dato che, give a reason with perché after the main clause, and state a consequence with perciò or quindi. | `v2-b1-everyone-everything`, `v2-b1-cause-purpose`, `v2-b1-consequence-concession` | maintain | new:clause-links-and-cohesion |

### v2-b1-integration — Everyday independence checkpoint

Apply connected narration, listening, problem solving and mediation in practical situations.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b1-capstone-account` | I can give a coherent account of a delay, prior cause and outcome. | `v2-b1-read-rules` | maintain | new:source-reasoning-and-mediation |
| `v2-b1-listen-practical-update` | I can hear a practical change in a short message and pass on the exact detail. | `v2-b1-capstone-account` | maintain | new:source-reasoning-and-mediation |
| `v2-b1-capstone-service` | I can state a problem, ask a specific question and propose a workable response. | `v2-b1-listen-practical-update` | maintain | new:source-reasoning-and-mediation |
| `v2-b1-capstone-relay` | I can extract and summarize a substantial notice for someone who needs to act. | `v2-b1-capstone-service` | maintain | new:source-reasoning-and-mediation |

### v2-b2-fact-stance — Fact and stance

Build productive present subjunctive patterns and distinguish known facts from viewpoints.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-subj-regular` | I can make frequent regular present subjunctive forms across persons. | `v2-b1-opinion-doubt` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-subj-irregular` | I can select common irregular present subjunctive forms in a stated viewpoint. | `v2-b2-subj-regular` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-fact-or-stance` | I can distinguish a stated fact from my evaluation of that fact. | `v2-b2-subj-irregular` | maintain | new:mood-selection-and-relative-time |

### v2-b2-viewpoint-time — Time inside a viewpoint

Relate an event to present or past attitudes by its actual temporal relation.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-past-subjunctive` | I can use congiuntivo passato for an event completed before a current viewpoint. | `v2-b2-fact-or-stance` | maintain | tenses, new:mood-selection-and-relative-time |
| `v2-b2-imperfect-subjunctive` | I can relate an ongoing event to a belief or feeling in the past. | `v2-b2-past-subjunctive` | maintain | tenses, passato-imperfetto, new:mood-selection-and-relative-time |
| `v2-b2-pluperfect-subjunctive` | I can show an event was already over when someone formed a past belief. | `v2-b2-imperfect-subjunctive` | maintain | tenses, new:mood-selection-and-relative-time |
| `v2-b2-tense-relations` | I can distinguish simultaneous, earlier and later events inside a past viewpoint. | `v2-b2-pluperfect-subjunctive` | maintain | tenses |

### v2-b2-alternatives — Real and unreal alternatives

Imagine a different present, then express unreal past outcomes and present consequences.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-unreal-present` | I can imagine a different present situation and its possible result. | `v2-b2-tense-relations` | maintain | tenses |
| `v2-b2-past-conditional` | I can state an unreal past result or polite retrospective judgment. | `v2-b2-unreal-present` | maintain | tenses |
| `v2-b2-unreal-past` | I can link an unreal past condition to its unreal past result. | `v2-b2-past-conditional` | maintain | tenses |
| `v2-b2-mixed-condition` | I can connect an unreal past event to its consequence now. | `v2-b2-unreal-past` | maintain | tenses |

### v2-b2-report-meeting — Report an interview or meeting

Shift viewpoint, reference words and instructions accurately.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-reported-past` | I can report a past statement with a past reporting verb. | `v2-b2-mixed-condition` | maintain | tenses |
| `v2-b2-reported-questions` | I can report past questions and adjust their reference words. | `v2-b2-reported-past` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-reported-commands` | I can report an instruction with di plus infinitive. | `v2-b2-reported-questions` | maintain | imperative |

### v2-b2-institutional-notices — Institutional notices

Control passive time, si agreement and whether an actor matters.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-passive-tenses` | I can keep passive voice while moving an event across tenses. | `v2-b2-reported-commands` | maintain | tenses |
| `v2-b2-si-passivante` | I can use si passivante with a singular or plural thing being acted upon. | `v2-b2-passive-tenses` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-agent-and-focus` | I can decide whether an institutional message needs an agent. | `v2-b2-si-passivante` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-b2-precise-reference — Precise reference

Use explicit relatives, focus and known-topic resumption.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-complex-relatives` | I can choose il quale or ciò che when a simple che is unclear or has no noun to refer to. | `v2-b2-agent-and-focus` | maintain | pronouns |
| `v2-b2-cleft-focus` | I can use è...che to focus the person, time or place that matters. | `v2-b2-complex-relatives` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-dislocation` | I can put a known object first and resume it with a pronoun. | `v2-b2-cleft-focus` | repair / 2 | pronouns |

### v2-b2-condense-sequence — Condense a sequence

Shorten same-actor clauses without hiding a changed actor.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-infinitive-clauses` | I can use an infinitive when the subject relationship is clear. | `v2-b2-dislocation` | maintain | new:aspect-and-nonfinite-actor-control |
| `v2-b2-gerund-clauses` | I can use a gerund when the understood actor is the same. | `v2-b2-infinitive-clauses` | maintain | new:aspect-and-nonfinite-actor-control |
| `v2-b2-actor-control` | I can avoid shortening a clause when the actor would change. | `v2-b2-gerund-clauses` | maintain | new:aspect-and-nonfinite-actor-control |

### v2-b2-compare-evidence — Compare evidence and options

Attribute a source, compare options and make a reasoned recommendation.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-argument-links` | I can mark an addition, consequence and counterpoint in an argument. | `v2-b2-actor-control` | maintain | new:clause-links-and-cohesion |
| `v2-b2-evidence-source` | I can report a short source accurately and label my own inference. | `v2-b2-argument-links` | maintain | new:source-reasoning-and-mediation |
| `v2-b2-compare-options` | I can compare benefits and limits before recommending an option for a particular need. | `v2-b2-evidence-source` | maintain | adjectives |

### v2-b2-counterpoint — Respond to a counterpoint

Concede an obstacle, answer it and narrow an overstated claim.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-concession-contrast` | I can distinguish a factual contrast from a conceded possibility. | `v2-b2-compare-options` | maintain | new:clause-links-and-cohesion |
| `v2-b2-respond-objection` | I can acknowledge a valid objection and answer it with a specific reason. | `v2-b2-concession-contrast` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-clarify-intent` | I can narrow a claim when a listener reads too much into it. | `v2-b2-respond-objection` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-b2-correspondence — Negotiate and correspond

Describe a service problem, propose terms and reply with a concrete remedy.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-complaint-facts` | I can describe a service problem without replacing dates or facts with blame. | `v2-b2-clarify-intent` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-negotiate-compromise` | I can acknowledge a constraint and suggest an option with conditions. | `v2-b2-complaint-facts` | maintain | new:register-pragmatics-and-interaction |
| `v2-b2-reply-remedy` | I can answer a complaint by acknowledging facts, offering a remedy and stating a deadline. | `v2-b2-negotiate-compromise` | maintain | communicative chunks; review support rather than force a grammar link |

### v2-b2-narrative-register — Read written history

Recognize written remote past and retell its timeline in conversation.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-passato-remoto` | I can recognize and use common passato remoto forms in a written story. | `v2-b2-reply-remedy` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-remote-pluperfect` | I can recognize trapassato remoto in a written historical sequence. | `v2-b2-passato-remoto` | maintain | communicative chunks; review support rather than force a grammar link |
| `v2-b2-report-versus-story` | I can recognize a written remote-past account and retell its events in natural conversation. | `v2-b2-remote-pluperfect` | maintain | passato-imperfetto |

### v2-b2-relay-information — Relay useful information

Select audience-relevant details from reading and listening and preserve source conflicts.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-audience-needs` | I can select source details for a person with a stated practical need. | `v2-b2-report-versus-story` | maintain | pronouns, new:source-reasoning-and-mediation |
| `v2-b2-listen-relay` | I can hear changed arrangements and relay the exact new details and conditions. | `v2-b2-audience-needs` | maintain | new:source-reasoning-and-mediation |
| `v2-b2-source-summary` | I can combine two short updates without hiding a conflict or inventing a resolution. | `v2-b2-listen-relay` | maintain | new:source-reasoning-and-mediation |

### v2-b2-integration — Qualified argument checkpoint

Compare accounts, discuss a qualified proposal and brief different audiences.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-b2-capstone-accounts` | I can compare evidence, limits and viewpoints in two substantial accounts. | `v2-b2-source-summary` | maintain | new:source-reasoning-and-mediation |
| `v2-b2-capstone-discussion` | I can answer an objection to a pilot proposal without overstating the evidence. | `v2-b2-capstone-accounts` | maintain | isc, new:source-reasoning-and-mediation, new:register-pragmatics-and-interaction |
| `v2-b2-capstone-mediation` | I can adapt the same evidence for a decision maker and a service user without changing its meaning. | `v2-b2-capstone-discussion` | maintain | new:source-reasoning-and-mediation |

### v2-c1-u1 — Attribute a claim accurately

Separate documented facts, evaluation, report and inference.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u1-subjunctive-perspective` | I can distinguish a reported fact from a speaker’s evaluation. | `v2-b2-tense-relations`, `v2-b2-evidence-source` | repair / 2 | tenses, new:mood-selection-and-relative-time |
| `v2-c1-u1-future-perfect-conjecture` | I can use future forms to express a present or past guess. | `v2-c1-u1-subjunctive-perspective` | repair / 6 | tenses |

### v2-c1-u2 — Control complex timelines

Locate an event before, during or after a past viewpoint.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u2-past-subjunctive-time` | I can place a subordinate event before or alongside a past viewpoint. | `v2-c1-u1-future-perfect-conjecture` | repair / 6 | tenses, new:mood-selection-and-relative-time |
| `v2-c1-u2-sequence-tense` | I can locate a future or earlier event from a past report. | `v2-c1-u2-past-subjunctive-time` | repair / 6 | tenses |

### v2-c1-u3 — Build an argument

Read evidence and qualify a conclusion before advocating a proposal.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u3-claim-evidence` | I can distinguish a measured result from a broader policy claim. | `v2-c1-u2-sequence-tense` | repair / 6 | new:source-reasoning-and-mediation |
| `v2-c1-u3-qualified-conclusion` | I can state a conclusion with the strength warranted by its evidence. | `v2-c1-u3-claim-evidence` | repair / 6 | communicative chunks; review support rather than force a grammar link |

### v2-c1-u4 — Concede precisely

Separate factual concession, hypothetical obstacle, cause and purpose.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u4-concessive-relations` | I can concede a fact without losing the main claim. | `v2-c1-u3-qualified-conclusion` | repair / 6 | new:clause-links-and-cohesion |
| `v2-c1-u4-causal-purpose-shades` | I can distinguish a reason from an intended result. | `v2-c1-u4-concessive-relations` | repair / 6 | new:clause-links-and-cohesion |

### v2-c1-u5 — Manage focus and reference

Track antecedents and direct a reader’s attention to the intended item.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u5-relative-scope` | I can link a relative clause to the intended noun. | `v2-c1-u4-causal-purpose-shades` | repair / 6 | pronouns |
| `v2-c1-u5-topic-focus` | I can put a known object first and resume it clearly. | `v2-c1-u5-relative-scope` | repair / 6 | pronouns |

### v2-c1-u6 — Compress and expand prose

Condense clauses without losing actor, time or cause.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u6-infinitive-control` | I can reduce a clause when its subject is understood. | `v2-c1-u5-topic-focus` | repair / 6 | new:aspect-and-nonfinite-actor-control |
| `v2-c1-u6-participle-gerund` | I can distinguish simultaneous from prior action in a reduced clause. | `v2-c1-u6-infinitive-control` | repair / 6 | new:aspect-and-nonfinite-actor-control |

### v2-c1-u7 — Choose precise language

Paraphrase an unfamiliar term and assess the force of a comparison.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u7-circumlocution` | I can reformulate inevitability without changing its force. | `v2-c1-u6-participle-gerund` | repair / 6 | new:register-pragmatics-and-interaction |
| `v2-c1-u7-comparative-degree` | I can link two changing quantities. | `v2-c1-u7-circumlocution` | repair / 6 | adjectives |

### v2-c1-u8 — Hear stance and implication

Use a literary recording and an interview transcript to separate what is said from what is suggested.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u8-narrative-stance` | I can follow an extended narrator’s correction of the listener’s first interpretation. | `v2-c1-u7-comparative-degree` | repair / 6 | new:mood-selection-and-relative-time |
| `v2-c1-u8-interview-implication` | I can distinguish an interviewee’s answer from the interviewer’s suggested conclusion. | `v2-c1-u8-narrative-stance` | repair / 6 | communicative chunks; review support rather than force a grammar link |

### v2-c1-u9 — Manage discussion

Put the disputed point in focus and restate an objection faithfully.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u9-clefts-inversion` | I can highlight the one person or thing that matters. | `v2-c1-u8-interview-implication` | repair / 6 | communicative chunks; review support rather than force a grammar link |
| `v2-c1-u9-reformulation` | I can replace an imprecise claim with a better one. | `v2-c1-u9-clefts-inversion` | repair / 6 | new:register-pragmatics-and-interaction |

### v2-c1-u10 — Write for an institution

Choose formal distance without obscuring who requests or decides.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u10-conditional-politeness` | I can distinguish a polite request from an unverified report. | `v2-c1-u9-reformulation` | repair / 6 | tenses, new:register-pragmatics-and-interaction |
| `v2-c1-u10-impersonal-register` | I can avoid an unnecessary agent in formal information. | `v2-c1-u10-conditional-politeness` | repair / 6 | new:register-pragmatics-and-interaction |

### v2-c1-u11 — Synthesize sources

Keep references and connections clear when two accounts only partly agree.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u11-reference` | I can refer back to the intended item in a two-item sequence. | `v2-c1-u10-impersonal-register` | repair / 6 | pronouns |
| `v2-c1-u11-connectives` | I can choose a connector that preserves the argument. | `v2-c1-u11-reference` | repair / 6 | new:clause-links-and-cohesion |

### v2-c1-u12 — Put C1 together

Turn a complex report into concise, appropriately qualified prose.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c1-u12-nominalization` | I can turn a full action clause into a concise noun phrase. | `v2-c1-u11-connectives` | repair / 6 | communicative chunks; review support rather than force a grammar link |
| `v2-c1-u12-reduced-formal-clauses` | I can shorten a time or condition clause without losing the logical link. | `v2-c1-u12-nominalization` | repair / 6 | communicative chunks; review support rather than force a grammar link |

### v2-c2-u1 — Nuanced grammatical choices

Judge how mood and aspect change the speaker’s commitment.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u1-mood-evidence` | I can distinguish an asserted fact from a speaker’s inference. | `v2-c1-u1-subjunctive-perspective`, `v2-c1-u3-qualified-conclusion` | repair / 2 | tenses, new:mood-selection-and-relative-time, new:source-reasoning-and-mediation |
| `v2-c2-u1-aspect-perspective` | I can choose a past form to foreground an event or its background. | `v2-c2-u1-mood-evidence` | repair / 6 | tenses, passato-imperfetto |

### v2-c2-u2 — Advanced hypotheticals

Track mixed time and implied conditions without turning possibility into fact.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u2-counterfactual-past` | I can state an unreal past condition and its unreal result. | `v2-c2-u1-aspect-perspective` | repair / 6 | tenses |
| `v2-c2-u2-mixed-conditions` | I can connect an unreal past condition to a present state. | `v2-c2-u2-counterfactual-past` | repair / 6 | tenses |

### v2-c2-u3 — Precision and ambiguity

Repair reference and scope where a plausible reading changes the claim.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u3-pronoun-scope` | I can remove a pronoun ambiguity in a short text. | `v2-c2-u2-mixed-conditions` | repair / 6 | pronouns |
| `v2-c2-u3-negation-scope` | I can distinguish “not all” from “none.” | `v2-c2-u3-pronoun-scope` | repair / 6 | communicative chunks; review support rather than force a grammar link |

### v2-c2-u4 — Ellipsis and implication

Recover omitted material and notice assumptions embedded in a question.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u4-ellipsis` | I can omit a repeated verb without hiding the relationship. | `v2-c2-u3-negation-scope` | repair / 6 | new:clause-links-and-cohesion |
| `v2-c2-u4-presupposition` | I can infer what smettere and riprendere imply. | `v2-c2-u4-ellipsis` | repair / 6 | new:register-pragmatics-and-interaction |

### v2-c2-u5 — Literary and historical language

Hear a narrator address readers and recognize older forms in their own context.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u5-literary-narrator` | I can track how a literary narrator uses reader address, interruption and expectation. | `v2-c2-u4-presupposition` | repair / 6 | communicative chunks; review support rather than force a grammar link |
| `v2-c2-u5-literary-tenses` | I can recognize the narrative function of passato remoto. | `v2-c2-u5-literary-narrator` | repair / 6 | tenses |

### v2-c2-u6 — Contemporary variation and register

Recognize spoken variation and choose a register for an audience.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u6-contemporary-variation` | I can identify a spoken topic structure and recast it for a formal text. | `v2-c2-u5-literary-tenses` | repair / 6 | new:register-pragmatics-and-interaction |
| `v2-c2-u6-register-shifts` | I can rewrite a direct request for a formal recipient while preserving the request. | `v2-c2-u6-contemporary-variation` | repair / 6 | new:register-pragmatics-and-interaction |

### v2-c2-u7 — Edit a complex text

Restore cohesion, parallel structure and evidence in a dense draft.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u7-cohesion-editing` | I can replace a connector that misstates the relation between claims. | `v2-c2-u6-register-shifts` | repair / 6 | new:clause-links-and-cohesion |
| `v2-c2-u7-parallelism` | I can repair an uneven pair of coordinated complements. | `v2-c2-u7-cohesion-editing` | repair / 6 | new:clause-links-and-cohesion |

### v2-c2-u8 — Interpret competing readings

Follow irony and older constructions without importing an invented motive.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u8-interpretation` | I can identify what is asserted and what remains a possibility. | `v2-c2-u7-parallelism` | repair / 6 | new:source-reasoning-and-mediation |
| `v2-c2-u8-historical-syntax` | I can interpret a literary subject placed after the verb. | `v2-c2-u8-interpretation` | repair / 6 | communicative chunks; review support rather than force a grammar link |

### v2-c2-u9 — Evaluate sources and inference

Decide which wording remains justified when reports disagree.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u9-modal-inference` | I can express strong or tentative inference about an earlier action. | `v2-c2-u8-historical-syntax` | repair / 6 | tenses |
| `v2-c2-u9-relative-precision` | I can express whose item is involved without a vague pronoun. | `v2-c2-u9-modal-inference` | repair / 6 | pronouns |

### v2-c2-u10 — Mediate conflicting sources

Preserve caveats and adapt a synthesis to an audience’s actual decision.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u10-source-conflict` | I can identify what three sources do and do not establish about one policy choice. | `v2-c2-u9-relative-precision` | repair / 6 | new:source-reasoning-and-mediation |
| `v2-c2-u10-audience-brief` | I can brief riders and decision-makers without changing the facts or their certainty. | `v2-c2-u10-source-conflict` | repair / 6 | new:source-reasoning-and-mediation |

### v2-c2-u11 — Implicit conditions and compression

Interpret unstated conditions and condense dense prose without losing logical links.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u11-implicit-hypotheses` | I can recognize an implied condition in a compact phrase. | `v2-c2-u10-audience-brief` | repair / 6 | tenses |
| `v2-c2-u11-condense-expand` | I can condense a clause while keeping who did what clear. | `v2-c2-u11-implicit-hypotheses` | repair / 6 | communicative chunks; review support rather than force a grammar link |

### v2-c2-u12 — Put C2 together

Interpret several sources and produce precise responses for different audiences.

| Source lesson | Outcome | Existing prerequisites | Decision / phase | Reference coverage |
| --- | --- | --- | --- | --- |
| `v2-c2-u12-production` | I can produce a concise, logically precise sentence for a specified audience. | `v2-c2-u11-condense-expand` | repair / 6 | communicative chunks; review support rather than force a grammar link |
| `v2-c2-u12-integrated-dossier` | I can compare three partial sources and recommend a decision process without erasing limits. | `v2-c2-u12-production` | repair / 6 | new:source-reasoning-and-mediation |

## Vocabulary, paradigms and reference coverage

The JSON records every opening gloss with its source ID, contextual meaning, current lookup candidate, proposed sense key, noun forms where supplied, actual board eligibility, later occurrences and review status. Function phrases retain combined meanings; an unresolved phrase is an authoring task, not an automatic dictionary entry. Ambiguous legacy completion must never imply that all new senses were mastered.

The dictionary contains 6958 word entries and 1185 verb entries. 120 verbs are explicitly linked from course glosses or related entries; their full paradigms are included. Every other verb has a five-core-case availability/exemption record so later catalogue integration can select and review it without losing whole-verb rules.

The twelve current reference topics cover articles, plurals, adjectives, tense forms, past contrast, auxiliaries, reflexives, spelling, -isc, commands/Lei, pronouns and prepositions. They do not by themselves supply the missing phonology listening, mood-selection timelines, nonfinite actor control, cohesion, source reasoning, mediation, pragmatics and register coverage. The per-lesson map identifies the applicable existing and missing subjects. Adding a menu link is Phase 3; authoring the missing material is Phase 6.

## Bounded Phase 2 editorial repair list

| Source lesson | Verified repair | Progress / publication constraint |
| --- | --- | --- |
| `v2-f-greet` | repair-farewell | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-one-thing` | repair-feminine-elision | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-near-far` | valid-invariant-location | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-want-need` | untaught-modal-persons | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-andare` | untaught-plural-persons | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-fare` | untaught-plural-persons | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-venire` | untaught-plural-persons | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-present-ere` | full-present-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-present-ire` | full-present-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-potere-requests` | full-present-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a1-days-clock` | spoken-elision | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-past-auxiliary-person` | full-auxiliary-persons | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-essere-plural` | full-auxiliary-persons-and-agreement | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-imperfect-are` | full-imperfect-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-imperfect-ere-ire` | full-imperfect-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-imperfect-states` | full-imperfect-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-progressive-present` | full-stare-persons | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-progressive-past` | full-stare-persons | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-future-are` | full-future-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-future-ere-ire` | full-future-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-future-irregular` | full-future-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-conditional-request` | full-conditional-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-conditional-plan` | full-conditional-models | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-direct-singular` | pizza-explanation | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-past-irregular` | valid-veduto | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-a2-direct-elision-negation` | repair-negation | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-b1-ce-ne-quantity` | ce-ne-functions | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-b2-dislocation` | spoken-elision | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-c1-u1-subjunctive-perspective` | advanced-entry-bridge | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |
| `v2-c2-u1-mood-evidence` | advanced-entry-bridge | Keep source/target IDs and completion; add required teaching before existing checks and fresh facet-aware repair examples. |

The independent audit also names the legacy pizza/casa explanation, malformed spoken elision and ambiguous distractors. Each must be reproduced against its actual source before mutation. Already-correct main examples are retained; disputed stylistic claims require educator adjudication.

## Validation and editorial release gates

Run `node tools/audit-phase-curriculum.mjs --write` to regenerate this report and its JSON from canonical sources; run `--check` to verify exact reproducibility. The tool validates source IDs, prerequisite references/cycles, dictionary links, complete route inventory and authored stage bridge references. It does not grade language quality.

Phase 2 fixtures cover the actual repaired answer variants, untouched invalid alternatives, taught modal/plural persons, repair facets and source idempotence. Existing all-correct and single-error traversal checks remain required. Native Italian educator review, all-clip perceptual audio review, beginner trials, authentic media rights and advanced open-performance assessment remain explicit external editorial gates. No agent review is labelled native human review.
