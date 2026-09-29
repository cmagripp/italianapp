#!/usr/bin/env node
// Shared legacy game runner: real clicks must produce honest adaptive evidence,
// while XP/daily totals stay with the existing game/SRS accounting.
import assert from 'node:assert/strict';
import { loadPlaywright, launchBrowser, ensureServer, boot, BASE, contextOptions } from './lib.mjs';

const { chromium, devices } = await loadPlaywright();
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const context = await browser.newContext(contextOptions(devices['iPhone 13']));
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
let groups = 0;
try {
  await boot(page, BASE);
  await page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    const { data } = await import('./js/data.js');
    const { createLearning } = await import('./js/learning/model.js');
    const Q = await import('./js/games/questions.js');
    const { runDrill } = await import('./js/games/engine.js');
    store.current.learning = createLearning(); store.current.learning.preferences.stage = 'past';
    store.current.items = {};
    const verb = inf => data.verbs.find(e => e.inf === inf);
    const casa = data.vocab.find(e => e.it === 'casa' && e.pos === 'noun');
    const questions = [
      Q.qConjType(verb('andare'), 'passatoProssimo', 0),
      Q.qConjType(verb('parlare'), 'presente', 1),
      Q.qTypeIt(casa), Q.qTypeIt(casa),
      Q.qParticiple(verb('prendere'), true),
      Q.qConjType(verb('alzarsi'), 'passatoProssimo', 0),
      Q.qTenseDetective(verb('parlare')),
    ];
    if (questions.some(q => !q)) throw new Error('Test question unavailable');
    const host = document.createElement('div'); host.id = 'game-evidence-test';
    host.style.cssText = 'position:fixed;inset:0;overflow:auto;background:var(--paper);z-index:999;';
    document.body.append(host);
    const day = store.today();
    window.__evidenceTest = { questions, before: { xp: store.current.stats.xp, correct: day.correct || 0, wrong: day.wrong || 0 }, done: null };
    window.__evidenceRunner = runDrill(host, questions, { autoAdvance: false, gameId: 'evidence-test', onDone: result => { window.__evidenceTest.done = result.score; } });
  });
  const snapshot = () => page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    const { skillState } = await import('./js/learning/model.js');
    return { events: Object.values(store.learning.events), xp: store.current.stats.xp, day: store.today(), before: window.__evidenceTest.before, casa: skillState(store.learning, 'w:casa|noun::word::recall') };
  });
  const answer = async (value, doubleClick = false) => {
    await page.locator('#game-evidence-test [data-answer]').fill(value);
    await page.locator('#game-evidence-test [data-check]').evaluate((b, twice) => { b.click(); if (twice) b.click(); }, doubleClick);
  };
  const next = () => page.locator('#game-evidence-test [data-feedback] [data-next]').click();

  await answer('ho andato', true);
  let s = await snapshot();
  assert.equal(s.events.length, 1, 'double submission creates one attempt');
  assert.equal(s.events[0].objectiveId, 'v:andare::passatoProssimo::conjugation');
  assert.ok(s.events[0].errorTags.includes('auxiliary'));
  assert.ok(s.events[0].components.some(c => c.skill === 'participle' && c.ok));
  assert.equal(s.events[0].xp, 0); assert.equal(s.day.wrong - s.before.wrong, 1); groups++;

  await next();
  await page.locator('#game-evidence-test .q-say [data-say]').click();
  await answer('parli');
  s = await snapshot();
  assert.equal(s.events.length, 2); assert.ok(s.events[1].assistance.includes('answer-audio'));
  assert.equal(s.events[1].person, 1); assert.equal(s.events[1].mode, 'production');
  assert.equal(s.day.correct - s.before.correct, 1); assert.equal(s.xp - s.before.xp, 2); groups++;

  await next(); await answer('casa'); await next(); await answer('casa');
  s = await snapshot();
  assert.equal(s.events.length, 4);
  assert.equal(s.events[2].variantId, s.events[3].variantId, 'same question has stable variant');
  assert.ok(s.events[3].assistance.includes('recent-answer-exposure'));
  assert.equal(s.casa.ready, false, 'copying a repeated answer never certifies recall');
  assert.equal(s.day.correct - s.before.correct, 3); assert.equal(s.xp - s.before.xp, 6); groups++;

  await next(); await page.locator('#game-evidence-test [data-skip]').click();
  s = await snapshot(); assert.equal(s.events[4].outcome, 'revealed'); assert.deepEqual(s.events[4].components, []); assert.equal(s.day.wrong - s.before.wrong, 2); groups++;

  await next(); await answer('sono alzato');
  s = await snapshot(); assert.ok(s.events[5].errorTags.includes('clitic')); assert.equal(s.day.wrong - s.before.wrong, 3); groups++;

  await next();
  await page.evaluate(() => {
    const q = window.__evidenceTest.questions[6];
    document.querySelector(`#game-evidence-test [data-choice="${q.choices.findIndex(c => c.correct)}"]`).click();
  });
  s = await snapshot(); assert.equal(s.events.length, 6, 'unsupported tense detective does not grant mastery evidence');
  assert.equal(s.day.correct - s.before.correct, 4); assert.equal(s.xp - s.before.xp, 8); groups++;
  await next();
  assert.equal(await page.evaluate(() => typeof window.__evidenceTest.done), 'number');
  await page.evaluate(() => { window.__evidenceRunner.destroy(); document.querySelector('#game-evidence-test').remove(); });
  assert.deepEqual(errors, []);
  console.log(`Game learning browser evidence: ${groups} groups passed.`);
} finally {
  await context.close(); await browser.close(); stopServer();
}
