# Taught lesson release

29 September 2026. Implementation of [the approved lesson specification](TAUGHT-LESSON-SPEC.md).

## What changes

The default lesson is a saved chapter journey: meet a verb, learn its present, build the completed past, learn the future, then combine those forms. Each chapter teaches before asking for practice. Imperfetto and enrolled advanced chapters remain explicit follow-ons. Formal Lei shares third-person morphology while receiving its own meaning-aware practice. Participle rules, irregular exceptions, auxiliary choice, agreement and pronouns are taught where they are needed.

Choice and matching answers grade on one tap and stay visible until Continue. Typed answers use Check or Enter. Help, answer audio and exposed forms affect the internal evidence. Repeated errors lead to smaller exercises and worked examples; complete forms return after intervening activities. Learners can pause exactly where they are or explicitly save a difficult part for later. Skipping never grants readiness, and no answer-count cap automatically passes an unfinished target.

Readiness requires varied, separated independent answers per target, including the relevant persons and formal role. Today's readiness is separate from recall on another day. This is a transparent application policy, not a claim that an answer threshold proves fluency. Technical evidence labels and quotas stay out of the lesson interface.

Words receive lessons appropriate to their type and selected meaning. Nouns teach articles and number, adjectives teach recorded agreement, and other word types use their own functions and examples. Soccer's `calcio` remains distinct from `calci` meaning kicks. Missing custom morphology remains missing rather than being invented.

## Content coverage and limits

The lesson builder handles the complete catalog of 1,185 verbs and 6,943 words. Automated content validation checks every available target for a generated, gradable answer and valid form. Those checks cannot establish that every sentence in a large dictionary is linguistically ideal.

The richest contextual exercises use reviewed situations for 27 common verbs, including 25 families with constructions across all six persons and formal address. Additional dictionary examples are reused unchanged only when an unambiguous finite form, subject and tense can be identified, bringing contextual coverage to 452 present, 673 completed-past and 244 future verb entries. A sentence is never fabricated by inserting an infinitive into an unrelated example.

Where suitable contextual examples are absent, lessons distinguish form practice from contextual use. Limited variants do not manufacture contextual mastery; the learner gets a reference/continue path with unfinished work preserved. Optional advanced chapters teach the actual forms and their use, but do not pretend to have the same authored contextual coverage as the common-verb chapters.

## Preservation and deployment

Learning schema 2 adds chapter/role/content metadata while retaining prior events, XP, lists, profiles and custom entries. Existing sessions coexist under separate keys and remain resumable with their old question recipe. The reordered beginner path preserves previously enrolled imperfetto work. Unknown newer schemas remain intact and request an app update.

Session drafts and presentation state stay on the device; shared learning events continue through the existing optional cloud mechanism. This release requires no new database migration. The service worker `parola-v6-taught-lessons` caches the complete new lesson code and styles before activation. Failed precaching leaves the prior working installation active.

## Verification

- Full browser journeys complete a regular verb and noun through actual UI interactions and verify resulting independent evidence.
- Separate hand-checked Italian assertions cover regular and irregular forms, formal address, auxiliary and agreement constraints, reflexives, weather verbs and noun senses.
- Error, assistance, skip, exact reload, later focused review, migration, merge, duplicate-reward and reset behavior have unit and browser coverage.
- The real service-worker suite verifies upgrade, failed update, offline lesson loading and exact feedback resume with existing progress intact.
- Phone-sized Chromium checks cover 375/390-pixel light and dark teaching, choice, typing, help, feedback and pause states. This is browser emulation, not a physical iPhone Safari test.
- The general regression suite exercises 45 routes and 45 flows, including games, profiles, backup import/export and dictionaries. Separate game-evidence, noun-form and PostgreSQL ownership/revision tests remain in the release checks.

Pull-request checks run the pure model/content/integration suites, isolated PostgreSQL checks, and six independent browser suites. Pages deployment reruns data validation, model checks and complete-shell validation before publishing. The final deployed commit and live installation are verified after the pull request is merged.
