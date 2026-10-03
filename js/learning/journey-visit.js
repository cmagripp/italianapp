// A visit is a presentation stopping point, never a completion requirement.
// Count answered screens, so matching sub-rows and reload retries cannot move it.
export const JOURNEY_VISIT_LIMIT=8;
export function journeyVisit(session, saved) {
  const chapterId=session?.journey?.chapterId,sessionId=session?.id;
  const valid=saved?.version===1&&saved.sessionId===sessionId&&saved.chapterId===chapterId
    &&Number.isSafeInteger(saved.number)&&saved.number>0&&saved.limit===JOURNEY_VISIT_LIMIT;
  const eventIds=valid&&Array.isArray(saved.eventIds)?[...new Set(saved.eventIds.filter(id=>typeof id==='string'
    &&session.answeredEventIds?.includes(id)&&id.startsWith(`${sessionId}:journey:`)&&!id.includes(':pair:')))].slice(0,JOURNEY_VISIT_LIMIT):[];
  return {version:1,sessionId,chapterId,number:valid?saved.number:1,limit:JOURNEY_VISIT_LIMIT,eventIds,boundary:valid&&saved.boundary===true&&eventIds.length===JOURNEY_VISIT_LIMIT};
}
export function recordJourneyVisit(session, saved, event) {
  const visit=journeyVisit(session,saved);
  if(event?.id===session.journey?.lastAttempt?.id&&session.answeredEventIds?.includes(event.id)
    &&!event.id.includes(':pair:')&&!visit.eventIds.includes(event.id)&&visit.eventIds.length<visit.limit)visit.eventIds.push(event.id);
  return visit;
}
export function nextJourneyVisit(session, saved) {
  const visit=journeyVisit(session,saved);
  return {...visit,number:visit.number+1,eventIds:[],boundary:false};
}
