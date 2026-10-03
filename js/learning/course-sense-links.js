// Bounded editorial links where the supplied course situation identifies a
// meaning but the short English gloss is not one of the dictionary synonyms.
// These links select a new meaning identity; they never copy parent progress.
export const COURSE_SENSE_LINKS=[
  {lessonId:'v2-a2-habit-versus-event',it:'una volta',en:'once',entryId:'w:volta|noun#occasion',
    status:'independent-agent-context-review-passed',
    rationale:'The opening preparation contrasts every day with one occasion. The separate board teaches la volta as a countable time/occasion, rather than translating bare volta as once.',
    sourceStepIds:['v2-a2-habit-versus-event.s1'],sources:['https://www.treccani.it/vocabolario/volta1/']},
  {lessonId:'v2-b2-reported-commands',it:'il capo',en:'manager',entryId:'w:capo|noun#boss',
    status:'independent-agent-context-review-passed',
    rationale:'The lesson reports instructions from the person in charge. The supplied role is a boss, rather than a body part or an item of clothing.',
    sourceStepIds:['v2-b2-reported-commands.words'],sources:['https://www.treccani.it/vocabolario/capo/']},
];
export function courseSenseEntryId(lessonId,gloss){return COURSE_SENSE_LINKS.find(r=>r.lessonId===lessonId&&r.it===gloss?.it&&r.en===gloss?.en)?.entryId || null;}
