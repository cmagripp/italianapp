// A word deliberately chosen by the learner may exceed the current level for
// this exact source revision. It never raises the level of a grammar rule.
export function wordException(request, senseId, surface = null) {
  const revision=request?.sourceRevision;
  if (typeof request?.scope !== 'string' || !request.scope || !(Number.isSafeInteger(revision)&&revision>=0 || typeof revision==='string'&&revision.length>0&&revision.length<=200)) return null;
  return (Array.isArray(request.wordExceptions)?request.wordExceptions:[]).find(item => item?.selectedBy === 'learner' && item.senseId === senseId
    && item.scope === request.scope && item.sourceRevision === request.sourceRevision
    && Array.isArray(item.forms) && item.forms.length > 0 && item.forms.length <= 8
    && item.forms.every(form => typeof form === 'string' && form.trim() && form.length <= 120)
    && (surface === null || item.forms.some(form => form.normalize('NFC').toLocaleLowerCase('it') === surface.normalize('NFC').toLocaleLowerCase('it')))) || null;
}
