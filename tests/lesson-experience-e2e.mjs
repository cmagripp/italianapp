#!/usr/bin/env node
// Interaction checks for the taught lesson's exploration and study tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, reloadApp, TESTS_DIR, SHOTS_DIR } from './lib.mjs';

const { chromium, devices } = await loadPlaywright();
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const results = [], errors = [], screenshots = [];
fs.mkdirSync(SHOTS_DIR, { recursive: true });
let context, page;
async function fresh(theme = 'light', width = 390) {
  await context?.close();
  context = await browser.newContext(contextOptions(devices['iPhone 13'], { viewport: { width, height: 844 }, reducedMotion: 'reduce' }));
  await context.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [], cancel: () => {}, speak: utterance => {
      const calls = JSON.parse(sessionStorage.getItem('experience-speech') || '[]');
      calls.push({ text: utterance.text, lang: utterance.lang }); sessionStorage.setItem('experience-speech', JSON.stringify(calls));
    },
  } }));
  page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g(oogleapis|static)\.com/.test(m.location()?.url || '')) errors.push(m.text()); });
  await boot(page);
  await page.evaluate(async theme => { const { store } = await import('./js/store.js'); store.setSetting('theme', theme); }, theme);
  await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
}
async function check(name, run) {
  if(process.env.EXPERIENCE_FILTER&&!name.toLowerCase().includes(process.env.EXPERIENCE_FILTER.toLowerCase())&&name!=='No application errors')return;
  if (process.env.EXPERIENCE_FILTER && !name.toLowerCase().includes(process.env.EXPERIENCE_FILTER.toLowerCase()) && name !== 'No application errors') return;
  try { const detail = await run(); results.push({ name, ok: true, detail }); console.log('PASS', name); }
  catch (error) { results.push({ name, ok: false, error: error.stack, visible: await page?.locator('body').innerText().catch(() => '') }); console.error('FAIL', name, error.message); throw error; }
}
async function evidence() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js'); await store.saveNow();
    return { events: Object.keys(store.learning.events).sort(), xp: store.current.stats.xp, learned: Object.keys(store.current.items).filter(id => store.isLearned(id)).sort() };
  });
}
async function spoken() { return page.evaluate(() => JSON.parse(sessionStorage.getItem('experience-speech') || '[]')); }
async function session() { return page.evaluate(async () => (await import('./js/store.js')).store.learning.session); }
async function question() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js'); const { getEntry } = await import('./js/data.js');
    const { buildLesson } = await import('./js/learning/lesson-content.js'); const { currentJourneyStep } = await import('./js/learning/journey.js');
    const { buildJourneyQuestion } = await import('./js/learning/lesson-questions.js');
    const s = store.learning.session, e = getEntry(s.entryId), step = currentJourneyStep(buildLesson(e), s, store.learning);
    return buildJourneyQuestion(e, step.chapter, step.target, { variant: step.variant, format: step.format, phase: step.phase, repairTag: step.repairTag });
  });
}
async function reachQuestion() {
  for (let n = 0; n < 15; n++) {
    if (await page.locator('[data-journey]').getAttribute('data-phase') === 'question') return;
    await page.locator('[data-continue]').click();
  }
  throw new Error('No question after teaching');
}
async function answerCorrect() {
  const q = await question(); assert(q);
  if (q.type === 'mc') { const index = q.choices.findIndex(c => (c.value || c.label) === q.answer[0]); assert(index >= 0); await page.locator(`[data-choice="${index}"]`).click(); }
  else { await page.locator('[data-answer]').fill(q.answer[0]); await page.locator('[data-check]').click(); }
}
async function shot(name) {
  const file = path.join(SHOTS_DIR, `lesson-experience-${name}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' }); screenshots.push(file);
}
async function waitForForm(index) {
  await page.waitForFunction(index => {
    const track = document.querySelector('[data-form-track]'), card = track?.querySelector(`[data-form-card="${index}"]`);
    if (!card || card.getAttribute('aria-pressed') !== 'true') return false;
    const r = card.getBoundingClientRect(), t = track.getBoundingClientRect();
    return r.left >= t.left - 3 && r.right <= t.right + 3;
  }, index);
}
async function swipeFormLeft() {
  await page.locator('[data-form-track]').scrollIntoViewIfNeeded();
  const box = await page.locator('[data-form-track]').boundingBox();
  const panel = await page.locator('.journey-main').boundingBox();
  const y = Math.max(panel.y + 20, Math.min(box.y + box.height / 2, panel.y + panel.height - 20));
  const x = box.x + box.width - 20, cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - (box.width - 40) * i / 8, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  await waitForForm(1);
}
async function withinViewport() {
  const s = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth, x: scrollX, y: scrollY, height: innerHeight, panel: document.querySelector('.journey-main')?.getBoundingClientRect().toJSON(), english: document.querySelector('#enToggle')?.getBoundingClientRect().toJSON() }));
  assert(s.pageWidth <= s.width + 1); assert.equal(s.x, 0); assert.equal(s.y, 0); assert(s.panel.height > 100); assert(s.panel.bottom <= s.height + 1);
  assert(s.english.right <= s.width + 1, 'English toggle stays inside the viewport');
}

try {
  for (const theme of ['light', 'dark']) {
    await check(`${theme}: Meet pronunciation and translations are exploration, not answers`, async () => {
      await fresh(theme); await gotoRoute(page, '/learn/verb/v:dire');
      const before = await evidence();
      assert.equal(await page.locator('[data-journey]').getAttribute('data-chapter'), 'meet');
      await page.locator('.journey-hero-audio').click(); assert.deepEqual(await spoken(), [{ text: 'dire', lang: 'it-IT' }]);
      const example = page.locator('.journey-example').first(), translation = example.locator('[data-translation]'), toggle = example.locator('[data-translation-toggle]');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true'); assert(await translation.isVisible());
      await toggle.click(); assert.equal(await toggle.getAttribute('aria-expanded'), 'false'); assert.equal(await translation.isVisible(), false);
      await toggle.click(); assert.equal(await translation.isVisible(), true);
      await page.locator('.journey-main').evaluate(p => { p.scrollTop = 0; });
      assert.deepEqual(await evidence(), before); await withinViewport(); await shot(`${theme}-meet`);
    });
    await check(`${theme}: form cards support swipe, navigation, pronunciation and comparison without grading`, async () => {
      await page.locator('[data-continue]').click();
      assert.equal(await page.locator('[data-journey]').getAttribute('data-chapter'), 'present');
      const before = await evidence(), speechBefore = await spoken();
      const cards = page.locator('[data-form-card]'); assert.equal(await cards.count(), 3);
      assert.deepEqual(await cards.locator('.journey-form-value').allTextContents(), ['dico', 'dici', 'dice']);
      await waitForForm(0);
      await page.locator('[data-form-next]').click(); await waitForForm(1);
      assert.deepEqual(await spoken(), speechBefore, 'navigation does not speak or submit');
      await cards.nth(1).click(); assert.deepEqual((await spoken()).at(-1), { text: 'dici', lang: 'it-IT' });
      const afterTap = await spoken();
      await page.locator('[data-form-track]').focus(); await page.keyboard.press('End'); await waitForForm(2);
      await page.keyboard.press('Home'); await waitForForm(0);
      await page.keyboard.press('ArrowRight'); await waitForForm(1);
      await page.keyboard.press('ArrowLeft'); await waitForForm(0);
      assert.deepEqual(await spoken(), afterTap, 'keyboard exploration stays quiet');
      await swipeFormLeft(); assert.equal(await page.locator('[data-form-count]').innerText(), '2 / 3');
      assert.deepEqual(await spoken(), afterTap, 'a swipe does not pronounce an accidental tapped card');
      await shot(`${theme}-present-form-deck`);
      await page.locator('.journey-form-comparison summary').click();
      assert.equal(await page.locator('.journey-form-comparison').getAttribute('open'), '');
      assert.deepEqual(await page.locator('.journey-form-comparison td:last-child').allTextContents(), ['dico', 'dici', 'dice']);
      await page.locator('.journey-form-comparison table').scrollIntoViewIfNeeded(); await shot(`${theme}-present-comparison`);
      assert.deepEqual(await evidence(), before); await withinViewport();
      await reloadApp(page); await waitForForm(1);
      assert.deepEqual(await spoken(), afterTap); assert.deepEqual(await evidence(), before);
    });
    await check(`${theme}: noun number comparison keeps the taught article and invariant plural`, async () => {
      await gotoRoute(page, '/learn/word/' + encodeURIComponent('w:caffè|noun') + '?chapter=forms');
      const before = await evidence();
      assert.deepEqual(await page.locator('[data-form-card] .journey-form-value').allTextContents(), ['il caffè', 'i caffè']);
      await page.locator('.journey-form-comparison summary').click();
      assert.deepEqual(await page.locator('.journey-form-comparison td:last-child').allTextContents(), ['il caffè', 'i caffè']);
      await page.locator('.journey-form-comparison table').scrollIntoViewIfNeeded(); await shot(`${theme}-noun-number-comparison`);
      assert.deepEqual(await evidence(), before); await withinViewport();
    });
    await check(`${theme}: past and future retain explicit construction and ending teaching`, async () => {
      await gotoRoute(page, '/learn/verb/v:dire?chapter=past');
      const before = await evidence();
      assert.match(await page.locator('.journey-main').innerText(), /auxiliary/i);
      await shot(`${theme}-past-auxiliary`);
      await page.locator('[data-continue]').click();
      const past = await page.locator('.journey-main').innerText();
      assert.match(past, /detto/); for (const pattern of ['-are → -ato', '-ere → -uto', '-ire → -ito']) assert(past.includes(pattern));
      await shot(`${theme}-past-participle`);
      await gotoRoute(page, '/learn/verb/v:dire?chapter=future');
      const future = await page.locator('.journey-main').innerText();
      assert.match(future, /stem is dir-/); for (const ending of ['io -ò', 'tu -ai', 'lui/lei/Lei -à', 'noi -emo', 'voi -ete', 'loro -anno']) assert(future.includes(ending));
      await shot(`${theme}-future`);
      assert.deepEqual(await evidence(), before); await withinViewport();
    });
    await check(`${theme}: sentence lookup shows real noun and verb details without grading`, async () => {
      await gotoRoute(page, '/learn/verb/v:capire');
      const before = await evidence();
      const noun = page.locator('[data-italian-sentence] [data-lookup-word="domanda"]').first();
      await noun.click(); const dialog = page.locator('dialog.journey-word-dialog');
      assert.equal(await dialog.getAttribute('open'), '');
      const meaning = await dialog.innerText(); assert.match(meaning, /feminine/i); assert.match(meaning, /la domanda/); assert.match(meaning, /le domande/);
      await shot(`${theme}-noun-word-lookup`);
      const beforeSpeech = await spoken(); await dialog.locator('[data-word-say]').click();
      assert.equal((await spoken()).length, beforeSpeech.length + 1); assert.deepEqual((await spoken()).at(-1), { text: 'domanda', lang: 'it-IT' });
      await page.keyboard.press('Escape'); assert.equal(await dialog.getAttribute('open'), null);
      await page.waitForFunction(() => document.activeElement?.dataset.lookupWord === 'domanda');
      await page.locator('[data-italian-sentence] [data-lookup-word="capisco"]').first().click();
      assert.match(await dialog.innerText(), /Infinitive\s+capire/);
      await dialog.locator('.journey-word-conjugations summary').first().click();
      assert.match(await dialog.innerText(), /capisci/); await shot(`${theme}-verb-word-lookup`);
      await dialog.locator('[data-word-close]').first().click();
      assert.deepEqual(await evidence(), before);
    });
    await check(`${theme}: correct and wrong feedback stays until Continue and records once`, async () => {
      await gotoRoute(page, '/learn/verb/v:capire?chapter=present'); await reachQuestion();
      const before = await evidence(); await answerCorrect();
      const right = await evidence(); assert.equal(right.events.length, before.events.length + 1);
      assert.equal((await session()).ui.result.ok, true); await shot(`${theme}-correct-feedback`);
      await page.waitForTimeout(500); assert.deepEqual(await evidence(), right);
      assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'feedback');
      await page.locator('[data-continue]').click(); await reachQuestion();
      assert.equal((await question()).type, 'type');
      await page.locator('[data-answer]').fill('sbagliato'); await page.locator('[data-check]').click();
      const wrong = await evidence(); assert.equal(wrong.events.length, right.events.length + 1);
      assert.equal((await session()).ui.result.ok, false); await shot(`${theme}-wrong-feedback`);
      await reloadApp(page); assert.deepEqual(await evidence(), wrong);
      assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'feedback');
    });
  }
  await check('The conjugation panel preserves the draft and makes a looked-up answer assisted', async () => {
    await fresh();
    await gotoRoute(page, '/learn/verb/v:credere?mode=review&objective=' + encodeURIComponent('v:credere::lesson::present::form-0'));
    await reachQuestion(); const q = await question(); assert.equal(q.type, 'type'); assert(q.answer.includes('credo'));
    await page.locator('[data-answer]').fill('cre');
    const before = await evidence(), initial = await session();
    assert(!initial.ui.assistance.includes('visible-form'));
    await page.locator('[data-conjugation-toggle]').click();
    const panel = page.locator('dialog.journey-conjugation-panel'); assert.equal(await panel.getAttribute('open'), '');
    assert.match(await panel.innerText(), /credo/);
    await panel.locator('[data-conjugation-tense="futuro"]').click(); assert.match(await panel.innerText(), /crederò/);
    await shot('conjugation-side-panel'); await page.keyboard.press('Escape');
    assert.equal(await panel.getAttribute('open'), null);
    assert.equal(await page.locator('[data-answer]').inputValue(), 'cre');
    assert((await session()).ui.assistance.includes('visible-form')); assert.deepEqual(await evidence(), before);
    await page.locator('[data-answer]').fill('credo'); await page.locator('[data-check]').click();
    const e = await page.evaluate(async () => Object.values((await import('./js/store.js')).store.learning.events).at(-1));
    assert.equal(e.ok, true); assert(e.assistance.includes('visible-form'));
    assert.equal((await evidence()).events.length, before.events.length + 1);
    await shot('correct-answer-feedback');
  });
  await check('An active-question word lookup is recorded as help and keeps the answer draft', async () => {
    await fresh(); await gotoRoute(page, '/learn/verb/v:capire?chapter=present'); await reachQuestion();
    await answerCorrect(); await page.locator('[data-continue]').click(); await reachQuestion();
    assert.equal((await question()).type, 'type');
    await page.locator('[data-answer]').fill('cap');
    const before = await evidence(); assert(!(await session()).ui.assistance.includes('hint'));
    await page.locator('.journey-prompt [data-lookup-word="domanda"]').click();
    assert.match(await page.locator('dialog.journey-word-dialog').innerText(), /la domanda/);
    await page.locator('dialog.journey-word-dialog [data-word-close]').first().click();
    assert.equal(await page.locator('[data-answer]').inputValue(), 'cap');
    const lookedUp=await session();
    assert(lookedUp.ui.assistance.includes('hint')); assert.deepEqual(await evidence(), before);
    for(const form of ['question','la','le','domanda','domande']) assert.equal(lookedUp.ui.exposures[form],lookedUp.index||0, `${form} remains recently exposed for following questions`);
    await page.locator('[data-answer]').fill('sbagliato'); await page.locator('[data-check]').click();
    assert.equal((await session()).ui.result.ok, false); await shot('wrong-answer-feedback');
  });
  await check('Lesson Back is read-only and returns to the exact unanswered draft without extra evidence', async () => {
    await fresh(); await gotoRoute(page, '/learn/verb/v:capire?chapter=present'); await reachQuestion();
    await answerCorrect(); await page.locator('[data-continue]').click(); await reachQuestion();
    await page.locator('[data-answer]').fill('capi');
    const before = await evidence(), active = await session();
    await page.locator('[data-lesson-back]').click();
    assert.equal(await page.locator('[data-journey]').getAttribute('data-history'), 'true');
    assert(await page.locator('.journey-history-banner').isVisible());
    assert.equal(await page.locator('[data-answer], [data-check], [data-choice]:not([disabled]), [data-skip], button[data-chapter]').count(), 0, 'past content cannot be graded or skipped again');
    assert.deepEqual(await evidence(), before); await shot('readonly-lesson-history');
    await page.locator('[data-lesson-current]').first().click();
    assert.notEqual(await page.locator('[data-journey]').getAttribute('data-history'), 'true');
    assert.equal(await page.locator('[data-answer]').inputValue(), 'capi');
    assert.equal((await session()).ui.questionId, active.ui.questionId); assert.deepEqual(await evidence(), before);
    assert((await session()).ui.assistance.includes('visible-form'), 'looking back cannot turn a copied answer into independent evidence');
    await answerCorrect(); assert.equal((await evidence()).events.length, before.events.length + 1);
  });
  await check('No application errors', async () => assert.deepEqual(errors, []));
} catch (error) {
  if (!results.some(r => !r.ok)) results.push({ name: 'Harness startup', ok: false, error: error.stack });
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(TESTS_DIR, 'report-lesson-experience.json'), JSON.stringify({ results, errors, screenshots }, null, 2));
  await browser.close(); stopServer();
}
console.log(`${results.filter(r => r.ok).length}/${results.length} lesson experience checks passed.`);
