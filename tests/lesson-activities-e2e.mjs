#!/usr/bin/env node
// Real phone interactions for guided matching and letter construction. Fixed
// Italian fixtures check the content separately from the app's traversal oracle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, reloadApp, TESTS_DIR, SHOTS_DIR } from './lib.mjs';
import { journeyQuestion, solveJourneyQuestion, reachJourneyActivity } from './journey-driver.mjs';

const { chromium, devices } = await loadPlaywright();
const stopServer = await ensureServer(), browser = await launchBrowser(chromium);
const results = [], errors = [], screenshots = [];
fs.mkdirSync(SHOTS_DIR, { recursive: true });
let context, page, board, boardStart, boardSpeech;
const selector = (key, id) => `[${key}=${JSON.stringify(id)}]`;
const forms = ['credo', 'credi', 'crede', 'crediamo', 'credete', 'credono'];
async function fresh(width = 375, theme = 'light') {
  await context?.close();
  context = await browser.newContext(contextOptions(devices['iPhone 13'], { viewport: { width, height: width === 375 ? 667 : 844 }, reducedMotion: 'reduce' }));
  await context.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [], cancel: () => {
      const operations = JSON.parse(sessionStorage.getItem('activity-audio-operations') || '[]');
      operations.push('cancel'); sessionStorage.setItem('activity-audio-operations', JSON.stringify(operations));
    }, speak: utterance => {
      const calls = JSON.parse(sessionStorage.getItem('activity-speech') || '[]');
      calls.push(utterance.text); sessionStorage.setItem('activity-speech', JSON.stringify(calls));
      const operations = JSON.parse(sessionStorage.getItem('activity-audio-operations') || '[]');
      operations.push('say:' + utterance.text); sessionStorage.setItem('activity-audio-operations', JSON.stringify(operations));
    },
  } }));
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g(oogleapis|static)\.com/.test(m.location()?.url || '')) errors.push(m.text()); });
  await boot(page);
  await page.evaluate(async theme => { const { store } = await import('./js/store.js'); store.setSetting('theme', theme); store.setSetting('tts', true); }, theme);
  await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
}
async function check(name, run) {
  const start = Date.now();
  try { const detail = await run(); results.push({ name, ok: true, ms: Date.now() - start, detail }); console.log('PASS', name); }
  catch (error) { results.push({ name, ok: false, error: error.stack, visible: await page?.locator('body').innerText().catch(() => '') }); console.error('FAIL', name, error.message); throw error; }
}
async function state() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js'); await store.saveNow();
    return { session: store.learning.session, events: Object.values(store.learning.events), xp: store.current.stats.xp };
  });
}
async function spoken() { return page.evaluate(() => JSON.parse(sessionStorage.getItem('activity-speech') || '[]')); }
function sameEvidence(a, b) {
  const sorted = events => [...events].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(sorted(a.events), sorted(b.events)); assert.equal(a.xp, b.xp);
}
function expected(q) {
  const actual = q.meta?.tense === 'presente' && q.meta?.entryId === 'v:credere' && q.meta?.person != null && !q.meta?.scaffold && ['conjugation', 'address'].includes(q.meta?.skill) ? forms[q.meta.person] : q.answer[0];
  assert(q.answer.includes(actual)); return actual;
}
async function choosePair(q, pair, tile, double = false) {
  await page.locator(selector('data-pair-left', pair.id)).click();
  const right = page.locator(selector('data-pair-right', tile.id));
  if (double) await right.evaluate(button => { button.click(); button.click(); }); else await right.click();
}
async function shot(name) {
  const file = path.join(SHOTS_DIR, 'lesson-activities-' + name + '.png');
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' }); screenshots.push(file);
}
async function assertPhone() {
  const layout = await page.evaluate(() => {
    const panel = document.querySelector('.journey-main');
    const buttons = [...document.querySelectorAll('[data-activity] button')].filter(b => b.checkVisibility());
    return { x: scrollX, y: scrollY, width: innerWidth, pageWidth: document.documentElement.scrollWidth,
      clipped: buttons.filter(b => b.scrollWidth > b.clientWidth + 2).map(b => b.textContent),
      panel: panel.getBoundingClientRect().toJSON() };
  });
  assert.equal(layout.x, 0); assert.equal(layout.y, 0); assert(layout.pageWidth <= layout.width + 1); assert.deepEqual(layout.clipped, []); assert(layout.panel.height > 100);
}
async function preservePartial() {
  const before = await state();
  await reloadApp(page);
  let after = await state();
  assert.equal(after.session.ui.questionId, before.session.ui.questionId);
  assert.deepEqual(after.session.ui.activity, before.session.ui.activity); sameEvidence(before, after);
  await page.locator('[data-pause]').click(); await reloadApp(page);
  assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'paused');
  await page.locator('[data-resume]').click();
  after = await state(); assert.deepEqual(after.session.ui.activity, before.session.ui.activity); sameEvidence(before, after);
  await page.locator('[data-lesson-back]').click();
  assert.equal(await page.locator('[data-journey]').getAttribute('data-history'), 'true');
  assert.equal(await page.locator('[data-activity] button:not([disabled])').count(), 0, 'history cannot play the board again');
  await page.locator('[data-lesson-current]').first().click();
  after = await state(); assert.deepEqual(after.session.ui.activity, before.session.ui.activity); sameEvidence(before, after);
}
async function putLetters(q, spelling, count = Infinity, doubleLast = false) {
  const used = new Set(), letters = [...spelling].filter(char => /[\p{L}\p{N}]/u.test(char));
  for (let i = 0; i < Math.min(count, letters.length); i++) {
    const tile = q.tiles.find(t => !used.has(t.id) && t.text === letters[i]); assert(tile, `Available copy of ${letters[i]}`); used.add(tile.id);
    const button = page.locator(selector('data-activity-letter', tile.id));
    if (doubleLast && i === letters.length - 1) await button.evaluate(b => { b.click(); b.click(); }); else await button.click();
  }
}

try {
  await check('A wrong pair diagnoses the selected person and leaves both tiles available', async () => {
    await fresh(); await gotoRoute(page, '/learn/verb/v:credere?chapter=present');
    board = await reachJourneyActivity(page, 'pairs', { expected }); boardStart = await state(); boardSpeech = await spoken();
    assert.equal(board.pairs.length, 3);
    for (const pair of board.pairs) assert.equal(pair.canonical, forms[pair.meta.person]);
    const lui = board.pairs.find(p => p.meta.person === 2 && p.meta.role !== 'formal'), tu = board.rightTiles.find(t => t.text === 'credi');
    assert(lui && tu); await choosePair(board, lui, tu, true);
    const after = await state(), event = after.events.at(-1);
    assert.equal(after.events.length, boardStart.events.length + 1); assert.equal(after.xp, boardStart.xp);
    assert.equal(event.objectiveId, lui.targetId); assert.equal(event.person, 2); assert.equal(event.ok, false);
    assert(event.errorTags.includes('person'), 'the wrong person is diagnosed for lui/lei, not the parent board target tu');
    assert.equal(event.mode, 'recognition'); assert(event.assistance.length > 0);
    assert.equal(after.session.ui.activity.matches.length, 0);
    assert(await page.locator(selector('data-pair-left', lui.id)).isVisible()); assert(await page.locator(selector('data-pair-right', tu.id)).isVisible());
    assert.match(await page.locator('[data-activity-status]').innerText(), /lui.*crede/i);
    assert.deepEqual(await spoken(), boardSpeech, 'wrong matches stay quiet');
    await assertPhone(); await shot('wrong-person-pair');
  });
  await check('A saved wrong-pair event repairs a stale cursor and reserves the next attempt identity', async () => {
    const before = await state(), target = board.pairs.find(p => p.meta.person === 2 && p.meta.role !== 'formal');
    // Keep the recorded event but restore the pre-click cursor: the event write
    // succeeded, while the presentation/session write was interrupted.
    await page.evaluate(async stale => { const { store } = await import('./js/store.js'); store.saveLearningSession(stale); await store.saveNow(); }, boardStart.session);
    await reloadApp(page); const after = await state();
    sameEvidence(before, after); assert.equal(after.session.ui.questionId, boardStart.session.ui.questionId);
    assert.equal(after.session.ui.activity.attempts[target.id], 1);
    assert.equal(after.session.ui.activity.matches.length, 0);
  });
  await check('Correct pairs disappear and a partial board survives reload, pause and read-only Back', async () => {
    const lui = board.pairs.find(p => p.meta.person === 2 && p.meta.role !== 'formal'), right = board.rightTiles.find(t => t.text === 'crede'), before = await state();
    await choosePair(board, lui, right, true); const after = await state();
    assert.equal(after.events.length, before.events.length + 1); assert.equal(after.xp, before.xp);
    assert(after.events.find(e => !before.events.some(b => b.id === e.id)).id.endsWith(':1'), 'the correct retry uses attempt 1, not the already persisted wrong attempt 0');
    assert.equal(after.session.ui.activity.matches.length, 1);
    assert.equal(await page.locator(selector('data-pair-left', lui.id)).isVisible(), false);
    assert.equal(await page.locator(selector('data-pair-right', right.id)).isVisible(), false);
    assert.deepEqual(await spoken(), [...boardSpeech, 'crede'], 'a correct pair speaks once despite a repeated click');
    await preservePartial(); await shot('partial-pair-board');
  });
  await check('A board awards one supported completion and preserves its actual wrong target for repair', async () => {
    const before = await state(); await solveJourneyQuestion(page, board, { expected, double: true });
    const after = await state(), added = after.events.filter(e => !before.events.some(b => b.id === e.id));
    assert.equal(added.length, 3, 'two remaining pairs and one board completion');
    assert.equal(after.xp, boardStart.xp + 1); assert.equal(after.session.ui.activity.complete, true);
    assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'feedback');
    assert(added.every(e => e.mode === 'recognition' && e.assistance.length));
    const calls = await spoken(); assert.equal(calls.length, boardSpeech.length + 3, 'each pair speaks once; the board aggregate stays quiet');
    const lastAudio = await page.evaluate(() => JSON.parse(sessionStorage.getItem('activity-audio-operations') || '[]').at(-1));
    assert.equal(lastAudio, 'say:' + calls.at(-1), 'board completion must not cancel the final pair pronunciation');
    await reloadApp(page); sameEvidence(after, await state()); assert.deepEqual(await spoken(), calls);
    await page.locator('[data-continue]').click();
    const repair = await state();
    assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'repair');
    assert.equal(repair.session.journey.current.targetId, board.pairs.find(p => p.meta.person === 2 && p.meta.role !== 'formal').targetId);
  });
  await check('Letter construction supports removing tiles and saves exact partial work without an attempt', async () => {
    const q = await reachJourneyActivity(page, 'letters', { expected }), before = await state();
    assert(q.answer.includes(expected(q))); assert.equal(q.meta.mode, 'recognition');
    await putLetters(q, q.answer[0], 2);
    assert.equal((await state()).session.ui.activity.selected.length, 2); sameEvidence(before, await state());
    await page.locator('[data-activity-backspace]').click(); assert.equal((await state()).session.ui.activity.selected.length, 1);
    await page.locator('[data-activity-slot="0"]').click(); assert.equal((await state()).session.ui.activity.selected.length, 0);
    await putLetters(q, q.answer[0], 2); await preservePartial(); await assertPhone(); await shot('partial-letter-bank');
  });
  await check('Completing visible letters records once and cannot certify independent recall', async () => {
    const q = await journeyQuestion(page), before = await state(), calls = await spoken();
    await page.locator('[data-activity-clear]').click();
    await putLetters(q, q.answer[0], Infinity, true);
    const after = await state(), event = after.events.at(-1);
    assert.equal(after.events.length, before.events.length + 1); assert.equal(after.xp, before.xp + 1);
    assert.equal(event.ok, true); assert.equal(event.mode, 'recognition'); assert(event.assistance.includes('letter-bank')); assert.equal(q.meta.activityKind, 'letters');
    assert.equal(await page.locator('[data-activity-letter]:not([disabled])').count(), 0);
    assert.deepEqual(await spoken(), [...calls, q.answer[0]], 'the completed canonical form is spoken once');
    await reloadApp(page); sameEvidence(after, await state()); assert.deepEqual(await spoken(), [...calls, q.answer[0]]); await shot('letter-feedback');
  });
  await check('Identical subjunctive forms accept any equivalent tile rather than a hidden identity', async () => {
    await fresh(390, 'dark');
    await page.evaluate(async () => { const { store } = await import('./js/store.js'); store.setLearningPreference('expansions', ['opinions']); });
    await gotoRoute(page, '/learn/verb/v:credere?chapter=congiuntivoPresente');
    const q = await reachJourneyActivity(page, 'pairs');
    assert.deepEqual(q.pairs.map(p => p.canonical), ['creda', 'creda', 'creda']);
    const first = q.pairs[0], foreign = q.rightTiles.find(t => t.pairId !== first.id), before = await state();
    await choosePair(q, first, foreign);
    const event = (await state()).events.at(-1); assert.equal(event.ok, true); assert.equal(event.objectiveId, first.targetId);
    assert.equal((await state()).events.length, before.events.length + 1);
    assert.equal(await page.locator(selector('data-pair-left', first.id)).isVisible(), false);
    await solveJourneyQuestion(page, q); assert.equal((await state()).session.ui.result.ok, true); await shot('equivalent-pair-forms');
  });
  await check('Word letter banks retain repeated letters and accents and still lead to writing', async () => {
    await fresh(); await gotoRoute(page, '/learn/word/' + encodeURIComponent('w:caffè|noun'));
    const q = await reachJourneyActivity(page, 'letters'); assert(q.answer.includes('caffè'));
    assert.equal(q.tiles.filter(t => t.text === 'f').length, 2); assert(q.tiles.some(t => t.text === 'è'));
    const before = await state(); await putLetters(q, 'cafèf', Infinity, true);
    const wrong = await state(); assert.equal(wrong.events.length, before.events.length + 1); assert.equal(wrong.events.at(-1).ok, false);
    assert.equal(wrong.events.at(-1).mode, 'recognition'); assert(wrong.events.at(-1).assistance.length);
    await shot('word-letter-mistake'); await page.locator('[data-continue]').click();
    const writing = await reachJourneyActivity(page, q => q.type === 'type' && q.meta.mode === 'production', { limit: 100 });
    assert(writing.answer.length); assert.equal(await page.locator('[data-answer]').count(), 1, 'writing remains part of the lesson');
  });
  await check('A saved completed spelling recovers its single pending answer after an interrupted write', async () => {
    await fresh(); await gotoRoute(page, '/learn/word/' + encodeURIComponent('w:caffè|noun'));
    const q = await reachJourneyActivity(page, 'letters'), before = await state();
    // Reproduce the crash boundary after persisting the final tile but before
    // recording its attempt, using the production reducer and real question.
    await page.evaluate(async q => {
      const { store } = await import('./js/store.js');
      const { activityAction, activityState } = await import('./js/learning/activity-panel.js');
      const session = structuredClone(store.learning.session), model = { ...q, id: session.ui.questionId };
      let activity = activityState(model), used = new Set();
      for (const text of [...q.answer[0]].filter(c => /[\p{L}\p{N}]/u.test(c))) {
        const tile = q.tiles.find(t => !used.has(t.id) && t.text === text); used.add(tile.id);
        activity = activityAction(model, activity, { type: 'letter', id: tile.id }).state;
      }
      session.ui.activity = activity; store.saveLearningSession(session); await store.saveNow();
    }, q);
    const pending = await state(); sameEvidence(before, pending);
    await reloadApp(page);
    await page.waitForFunction(() => document.querySelector('[data-journey]')?.dataset.phase === 'feedback');
    const after = await state(); assert.equal(after.events.length, before.events.length + 1); assert.equal(after.xp, before.xp + 1);
    assert.equal(after.session.ui.result.ok, true); assert.equal(after.events.at(-1).mode, 'recognition');
    await reloadApp(page); sameEvidence(after, await state());
    // Also cover the inverse write boundary: the event was persisted, while the
    // cursor still points at its completed, unanswered activity.
    await page.evaluate(async stale => { const { store } = await import('./js/store.js'); store.saveLearningSession(stale); await store.saveNow(); }, pending.session);
    await reloadApp(page);
    await page.waitForFunction(() => document.querySelector('[data-journey]')?.dataset.phase === 'feedback');
    sameEvidence(after, await state());
  });
  for (const width of [375, 390]) for (const theme of ['light', 'dark']) {
    await check(`${width}px ${theme}: matching and letter banks fit the lesson and support keyboard actions`, async () => {
      await fresh(width, theme); await gotoRoute(page, '/learn/verb/v:credere?chapter=present');
      const q = await reachJourneyActivity(page, 'pairs', { expected }); await assertPhone(); await shot(`${width}-${theme}-pairs`);
      const first = q.pairs[0], correct = q.rightTiles.find(t => first.answers.includes(t.text));
      await page.locator(selector('data-pair-left', first.id)).focus(); await page.keyboard.press('Enter');
      await page.locator(selector('data-pair-right', correct.id)).focus(); await page.keyboard.press('Enter');
      assert.equal((await state()).session.ui.activity.matches.length, 1);
      await solveJourneyQuestion(page, q, { expected }); await page.locator('[data-continue]').click();
      const letters = await reachJourneyActivity(page, 'letters', { expected }); await assertPhone(); await shot(`${width}-${theme}-letters`);
      const tile = letters.tiles.find(t => t.text === letters.answer[0][0]);
      await page.locator(selector('data-activity-letter', tile.id)).focus(); await page.keyboard.press('Enter');
      assert.deepEqual((await state()).session.ui.activity.selected, [tile.id]);
      await page.locator('[data-activity-backspace]').focus(); await page.keyboard.press('Enter');
      assert.deepEqual((await state()).session.ui.activity.selected, []);
    });
  }
  await check('Showing an unfinished board gives the correct pairs without claiming a completed match', async () => {
    await fresh(); await gotoRoute(page, '/learn/verb/v:credere?chapter=present');
    const q = await reachJourneyActivity(page, 'pairs', { expected }), before = await state();
    await page.locator('[data-reveal]').click();
    const after = await state(), event = after.events.find(e => !before.events.some(b => b.id === e.id));
    assert.equal(after.events.length, before.events.length + 1); assert.equal(after.xp, before.xp);
    assert.equal(event.outcome, 'revealed'); assert.equal(event.mode, 'recognition'); assert(event.assistance.includes('reveal'));
    assert.equal(after.session.ui.activity.matches.length, 0); assert.equal(after.session.ui.activity.complete, false);
    assert.equal(await page.locator('[data-pair-left]:not([disabled]), [data-pair-right]:not([disabled])').count(), 0);
    const answerList = page.locator('.journey-pair-answer-list'); assert(await answerList.isVisible());
    for (const pair of q.pairs) { assert((await answerList.innerText()).includes(pair.label)); assert((await answerList.innerText()).includes(pair.canonical)); }
    assert(!/All pairs matched/.test(await page.locator('[data-journey]').innerText()));
    await reloadApp(page); sameEvidence(after, await state()); await shot('revealed-pair-board');
  });
  await check('No application errors', async () => assert.deepEqual(errors, []));
} catch (error) {
  if (!results.some(r => !r.ok)) results.push({ name: 'Harness startup', ok: false, error: error.stack });
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(TESTS_DIR, 'report-lesson-activities.json'), JSON.stringify({ results, errors, screenshots }, null, 2));
  await browser.close(); stopServer();
}
console.log(`${results.filter(r => r.ok).length}/${results.length} lesson activity checks passed.`);
