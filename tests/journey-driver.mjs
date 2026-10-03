// UI-only traversal helpers shared by lesson suites. Canonical expectations may
// come from separately checked language fixtures; application answers are only
// the fallback oracle for the broad content traversal.
import assert from 'node:assert/strict';

export async function journeyQuestion(page) {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    const { getEntry } = await import('./js/data.js');
    const { buildLesson } = await import('./js/learning/lesson-content.js');
    const { currentJourneyStep } = await import('./js/learning/journey.js');
    const { buildJourneyQuestion } = await import('./js/learning/lesson-questions.js');
    const session = store.learning.session, entry = getEntry(session.entryId);
    const step = currentJourneyStep(buildLesson(entry), session, store.learning, Date.now());
    return buildJourneyQuestion(entry, step.chapter, step.target, { variant: step.variant, format: step.format, phase: step.phase, repairTag: step.repairTag, scenePolicy: step.scenePolicy });
  });
}

const attr = (name, value) => `[${name}=${JSON.stringify(String(value))}]`;

export async function advanceJourneyPage(page) {
  const phase = await page.locator('[data-journey]').getAttribute('data-phase');
  if (phase === 'paused') { await page.locator('[data-resume]').click(); return; }
  if (phase === 'overview') {
    const resume = page.locator('[data-resume-lesson]');
    if (await resume.count()) await resume.click();
    else await page.locator('[data-open-lesson]').first().click();
    return;
  }
  const next = page.locator('[data-next-lesson]');
  if (phase === 'recap' && await next.count()) { await next.click(); return; }
  await page.locator('[data-continue]').click();
}

export async function solveJourneyQuestion(page, question, { expected = q => q.answer[0], double = false } = {}) {
  assert(question, 'The selected activity is available');
  if (question.type === 'pairs') {
    for (const pair of question.pairs) {
      const left = page.locator(attr('data-pair-left', pair.id));
      if (!await left.count() || !await left.isVisible() || !await left.isEnabled()) continue;
      const answer = expected(pair.question || { answer: pair.answers, meta: pair.meta });
      assert(pair.answers.includes(answer), `Matching target accepts separately checked answer ${answer}`);
      const candidates = question.rightTiles.filter(tile => pair.answers.includes(tile.text));
      let right;
      for (const tile of candidates) {
        const button = page.locator(attr('data-pair-right', tile.id));
        if (await button.count() && await button.isVisible() && await button.isEnabled()) { right = button; break; }
      }
      assert(right, `An unused valid tile remains for ${pair.label}`);
      await left.click();
      if (double) await right.evaluate(b => { b.click(); b.click(); }); else await right.click();
    }
    return;
  }
  const answer = expected(question);
  assert(question.answer.includes(answer), `Activity accepts separately checked answer ${answer}`);
  if (question.type === 'letters') {
    // Clear only the scratch spelling, then construct it through the visible
    // bank. A fresh tile identity is used for every repeated letter.
    const clear = page.locator('[data-activity-clear]');
    if (await clear.count() && await clear.isEnabled()) await clear.click();
    const used = new Set();
    let position = 0;
    for (const slot of question.slots) {
      if (slot.kind === 'fixed') { position += [...slot.text].length; continue; }
      const character = [...answer][position++];
      const tile = question.tiles.find(t => !used.has(t.id) && t.text === character);
      assert(tile, `The bank contains enough copies of ${character}`); used.add(tile.id);
      await page.locator(attr('data-activity-letter', tile.id)).click();
    }
    return;
  }
  if (question.type === 'mc') {
    const index = question.choices.findIndex(c => (c.value || c.label) === answer);
    assert(index >= 0, 'The correct choice is visible');
    const button = page.locator(attr('data-choice', index));
    if (double) await button.evaluate(b => { b.click(); b.click(); }); else await button.click();
    return;
  }
  assert.equal(question.type, 'type', `Unexpected activity type ${question.type}`);
  await page.locator('[data-answer]').fill(answer);
  if (double) await page.locator('[data-check]').evaluate(b => { b.click(); b.click(); }); else await page.locator('[data-check]').click();
}

export async function reachJourneyActivity(page, desired, { limit = 60, expected = q => q.answer[0] } = {}) {
  for (let n = 0; n < limit; n++) {
    const phase = await page.locator('[data-journey]').getAttribute('data-phase');
    if (phase === 'question') {
      const q = await journeyQuestion(page);
      if (typeof desired === 'function' ? desired(q) : q.type === desired) return q;
      await solveJourneyQuestion(page, q, { expected });
    } else {
      assert(!['complete', 'unavailable'].includes(phase), `Cannot reach requested activity from ${phase}`);
      await advanceJourneyPage(page);
    }
  }
  throw new Error('Requested activity did not occur during lesson traversal');
}
