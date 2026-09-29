#!/usr/bin/env node
// Focused regression: intro sequencing and the phone lesson action rail.
import assert from 'node:assert/strict';
import { journeyQuestion, solveJourneyQuestion, reachJourneyActivity } from './journey-driver.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, reloadApp, TESTS_DIR, SHOTS_DIR } from './lib.mjs';

const { chromium, devices } = await loadPlaywright();
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const results = [], errors = [], screenshots = [];
fs.mkdirSync(SHOTS_DIR, { recursive: true });
let page, context;
const route = id => '/learn/verb/' + encodeURIComponent(id);
async function check(name, run) {
  const start = Date.now();
  try { const detail = await run(); results.push({ name, ok: true, ms: Date.now() - start, detail }); console.log('PASS', name); }
  catch (error) {
    const geometry = await railGeometry().catch(() => null);
    await shot('failure').catch(() => {});
    results.push({ name, ok: false, error: error.stack, geometry, visible: await page?.locator('body').innerText().catch(() => '') });
    console.error('FAIL', name, error.message, geometry && JSON.stringify(geometry)); throw error;
  }
}
async function fresh(width = 390, theme = 'light') {
  await context?.close();
  context = await browser.newContext(contextOptions(devices['iPhone 13'], { viewport: { width, height: width === 375 ? 667 : 844 }, reducedMotion: 'reduce' }));
  await context.addInitScript(() => {
    const mock = { getVoices: () => [], cancel: () => {}, speak: utterance => {
      const calls = JSON.parse(sessionStorage.getItem('lesson-action-speech') || '[]');
      calls.push({ text: utterance.text, lang: utterance.lang }); sessionStorage.setItem('lesson-action-speech', JSON.stringify(calls));
    } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: mock });
  });
  page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g(oogleapis|static)\.com/.test(m.location()?.url || '')) errors.push(m.text()); });
  await boot(page);
  await page.evaluate(async theme => { const { store } = await import('./js/store.js'); store.setSetting('theme', theme); }, theme);
  await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
}
async function saved() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js'); await store.saveNow();
    const s = store.learning.session;
    return { session: s, ids: Object.keys(store.learning.events).sort(), xp: store.current.stats.xp, learned: store.isLearned(s.entryId) };
  });
}
async function spoken() { return page.evaluate(() => JSON.parse(sessionStorage.getItem('lesson-action-speech') || '[]')); }
async function question() { return journeyQuestion(page); }

async function reachQuestion() {
  for (let n = 0; n < 12; n++) {
    if (await page.locator('[data-journey]').getAttribute('data-phase') === 'question') return;
    await page.locator('[data-continue]').click();
  }
  throw new Error('Question did not follow the teaching cards');
}
async function assertPresentTeaching() {
  const lesson = page.locator('[data-journey]');
  assert.equal(await lesson.getAttribute('data-phase'), 'teach');
  assert.equal(await lesson.getAttribute('data-chapter'), 'present');
  assert.equal(await page.locator('.journey-stages [aria-current="step"]').innerText(), 'Learn');
  assert(!/Your progress · Meet|You’ve learned the forms and used them/.test(await lesson.innerText()));
}
async function shot(name) {
  const file = path.join(SHOTS_DIR, `lesson-actions-${name}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' }); screenshots.push(file);
}
async function railGeometry() {
  return page.evaluate(() => {
    const track = document.querySelector('[data-action-track]');
    const card = document.querySelector('[data-journey]');
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    let dock = track;
    while (dock && getComputedStyle(dock).position !== 'fixed') dock = dock.parentElement;
    const actions = [...track.querySelectorAll('button, a')];
    return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, card: rect(card), track: rect(track), scroll: track.scrollLeft, scrollWidth: track.scrollWidth, snap: getComputedStyle(track).scrollSnapType, dock: dock && rect(dock), actions: actions.map(a => ({ ...rect(a), name: a.textContent.trim(), tag: a.tagName, href: a.getAttribute('href'), tabIndex: a.tabIndex, font: parseFloat(getComputedStyle(a).fontSize) })) };
  });
}
async function waitForAction(index) {
  await page.waitForFunction(index => {
    const track = document.querySelector('[data-action-track]');
    const action = track?.querySelectorAll('button, a')[index];
    if (!action) return false;
    const a = action.getBoundingClientRect(), t = track.getBoundingClientRect();
    const dot = action.querySelectorAll('[data-action-dot]')[index];
    return a.left >= t.left - 2 && a.right <= t.right + 2 && dot?.classList.contains('is-current');
  }, index);
}
async function moveAction(index) {
  await page.locator('[data-action-track]').focus(); await page.keyboard.press('Home');
  for(let i=0;i<index;i++)await page.keyboard.press('ArrowRight');
  await waitForAction(index);
}
async function assertVisibleWithoutScroll(selector) {
  assert(await page.locator(selector).first().evaluate(e=>{
    const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return r.top>=0&&r.bottom<=innerHeight+1&&(e===hit||e.contains(hit));
  }),selector+' is visible and unobscured without scrolling');
}
async function waitForSwipedAction() {
  // Native fling distance depends on compositor timing. Unlike keyboard steps,
  // a touch swipe may pass more than one card; require a settled, usable destination.
  let previous = null, stableSince = 0;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const track = document.querySelector('[data-action-track]');
      const t = track.getBoundingClientRect();
      const index = [...track.querySelectorAll('button, a')].findIndex((action, i) => {
        const a = action.getBoundingClientRect();
        return a.left >= t.left - 2 && a.right <= t.right + 2 && action.querySelectorAll('[data-action-dot]')[i]?.classList.contains('is-current');
      });
      return { index, scroll: track.scrollLeft };
    });
    if (state.index > 0 && state.index === previous?.index && Math.abs(state.scroll - previous.scroll) < .5) {
      if (Date.now() - stableSince >= 150) return state.index;
    } else stableSince = Date.now();
    previous = state;
    await page.waitForTimeout(50);
  }
  assert.fail('Touch swipe did not settle on a fully visible later action with its matching dot: ' + JSON.stringify(await railGeometry()));
}
async function swipeLeft() {
  const track = await page.locator('[data-action-track]').boundingBox();
  const cdp = await context.newCDPSession(page);
  const x = track.x + track.width - 24, y = track.y + track.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - (track.width - 48) * i / 8, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForFunction(() => document.querySelector('[data-action-track]').scrollLeft > 30);
}

try {
  await check('A new verb opens its overview and starts Present teaching with Learn active', async () => {
    await fresh(); await gotoRoute(page, route('v:credere'));
    assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'overview');
    const before = await saved();
    await page.locator('[data-open-lesson=present]').evaluate(b => { b.click(); b.click(); });
    await assertPresentTeaching();
    const after = await saved();
    assert.equal(after.session.id, before.session.id);
    assert.deepEqual(after.ids, before.ids); assert.equal(after.xp, before.xp); assert.equal(after.learned, false);
    assert.equal(after.session.journey.groupIndex, 0); assert.equal(after.session.journey.cardIndex, 0);
    await shot('meet-to-present');
  });
  await check('An existing saved empty Meet recap resumes directly into Present exactly once', async () => {
    await gotoRoute(page, '/home');
    const seeded = await page.evaluate(async () => {
      const { store } = await import('./js/store.js'); const { getEntry } = await import('./js/data.js');
      const { buildLesson } = await import('./js/learning/lesson-content.js'); const { createJourneySession } = await import('./js/learning/journey.js');
      const s = createJourneySession({ id: 'saved-meet-recap', plan: buildLesson(getEntry('v:dire')), now: Date.now() });
      Object.assign(s.journey, { chapterId: 'meet', phase: 'recap', current: null, queue: [], awaitingContinue: false, groupIndex: 1, cardIndex: 0 });
      s.journey.covered.meet = Date.now(); s.ui = { version: 2, draft: '', assistance: [], exposures: {}, mapOpen: false };
      store.saveLearningSession(s); await store.saveNow();
      return { id: s.id, events: Object.keys(store.learning.events).sort(), xp: store.current.stats.xp };
    });
    await gotoRoute(page, route('v:dire') + '?session=' + seeded.id);
    await assertPresentTeaching();
    const after = await saved(); assert.equal(after.session.id, seeded.id); assert.deepEqual(after.ids, seeded.events); assert.equal(after.xp, seeded.xp);
    await reloadApp(page); await assertPresentTeaching();
    const reloaded = await saved(); assert.equal(reloaded.session.journey.cardIndex, 0); assert.equal(reloaded.session.journey.groupIndex, 0);
    assert.deepEqual(reloaded.ids, seeded.events); assert.equal(reloaded.xp, seeded.xp);
  });
  for (const width of [375, 390]) for (const theme of ['light', 'dark']) {
    await check(`${width}px ${theme}: outlined bottom actions show nested dots and support keyboard, Tab and touch swipe`, async () => {
      await fresh(width, theme); await gotoRoute(page, route('v:capire') + '?chapter=present');
      await assertPresentTeaching();
      const before = await saved(), g = await railGeometry();
      assert(g.dock, 'the action rail is fixed at the bottom');
      assert(g.dock.bottom <= g.height + 1); assert(g.dock.bottom >= g.height - 40);
      assert.equal(g.actions.length, 3); assert.equal(g.actions[0].name, 'Continue');
      assert.match(g.actions[1].name, /meaning|example|reference/i); assert.match(g.actions[2].name, /Skip/);
      assert(g.scrollWidth > g.track.width * 2); assert.match(g.snap, /x/); assert(g.pageWidth <= width + 1);
      for (const a of g.actions) { assert(a.width >= g.card.width * .8, 'each action is nearly the card width'); assert(a.width <= g.card.width + 2); assert(a.height >= 44); assert(a.font >= 14); assert(a.tabIndex >= 0); }
      for (let i = 1; i < g.actions.length; i++) assert(g.actions[i].x - g.actions[i - 1].right >= 8, 'actions have visible separation');
      assert(Math.abs(g.track.x - g.card.x) <= 24, 'rail aligns with the lesson card');
      assert(g.track.right <= g.card.right + 2);
      await waitForAction(0); await shot(`${width}-${theme}-continue`);
      assert.equal(await page.locator('[data-action-next], [data-action-prev]').count(),0,'redundant navigation arrows are removed');
      assert.equal(await page.locator('[data-action-track] [data-action-dot]').count(),9,'each action contains three noninteractive page dots');
      const details=await page.locator('[data-action-track]').locator('button, a').evaluateAll(actions=>actions.map(action=>{
        const a=action.getBoundingClientRect(),s=getComputedStyle(action),dots=[...action.querySelectorAll('[data-action-dot]')].map(d=>d.getBoundingClientRect());
        return {outlined:parseFloat(s.borderTopWidth)>0&&parseFloat(s.borderBottomWidth)>0,centerError:Math.abs((dots[0].left+dots[2].right)/2-(a.left+a.right)/2),inside:dots.every(d=>d.top>a.top+a.height/2&&d.bottom<=a.bottom),active:action.querySelectorAll('[data-action-dot].is-current').length};
      }));
      for(const detail of details){assert(detail.outlined,'every carousel action is outlined');assert(detail.centerError<2,'dots are centered inside each action');assert(detail.inside,'dots sit inside the lower part of each action');assert.equal(detail.active,1);}
      assert.equal(await page.locator('#backBtn').isVisible(),false,'global back chevron is hidden during lessons');
      assert.equal(await page.locator('.journey-header [data-overview]').count(),0,'chapter title does not navigate away');
      assert.equal(await page.locator('[data-journey]').evaluate(e=>getComputedStyle(e).boxShadow),'none','lesson content is directly on the page');
      await moveAction(1); await shot(`${width}-${theme}-reference`);
      await moveAction(2); await shot(`${width}-${theme}-skip`);
      await moveAction(1);
      await moveAction(0);
      assert.equal(await page.locator('[data-action-dot].is-current').count(), 3);
      assert.equal(await page.locator('[data-action-dot]').first().evaluate(e => e.classList.contains('is-current')), true);
      await page.locator('[data-action-track]').focus(); await page.keyboard.press('ArrowRight'); await waitForAction(1);
      await page.keyboard.press('ArrowLeft'); await waitForAction(0);
      const actions = page.locator('[data-action-track]').locator('button, a');
      await actions.nth(0).focus(); await page.keyboard.press('Tab');
      assert.equal(await actions.nth(1).evaluate(a => a === document.activeElement), true); await waitForAction(1);
      await page.keyboard.press('Tab'); assert.equal(await actions.nth(2).evaluate(a => a === document.activeElement), true); await waitForAction(2);
      await moveAction(1);
      await moveAction(0);
      await swipeLeft();
      const swipeIndex = await waitForSwipedAction();
      const swiped = await railGeometry(); assert(swiped.scroll > 30);
      assert.equal((await saved()).session.journey.chapterId, before.session.journey.chapterId, 'swiping is not a Continue click');
      assert.equal((await saved()).session.journey.cardIndex, before.session.journey.cardIndex);
      await moveAction(0);
      const headerBefore = await page.locator('.journey-header').boundingBox();
      await page.locator('.journey-main').evaluate(panel => { panel.scrollTop = panel.scrollHeight; });
      const clearance = await page.evaluate(() => {
        const track = document.querySelector('[data-action-track]'); let dock = track;
        while (dock && getComputedStyle(dock).position !== 'fixed') dock = dock.parentElement;
        const last = [...document.querySelectorAll('.journey-main h1, .journey-main p, .journey-main table, .journey-main .journey-example')].filter(e => e.checkVisibility()).at(-1);
        const panel = document.querySelector('.journey-main');
        return { contentBottom: last.getBoundingClientRect().bottom, panelBottom: panel.getBoundingClientRect().bottom, panelScroll: panel.scrollTop, dockTop: dock.getBoundingClientRect().top, width: innerWidth, pageWidth: document.documentElement.scrollWidth, windowScroll: scrollY };
      });
      assert.equal(clearance.windowScroll, 0, 'the outer page stays fixed'); assert(clearance.panelScroll > 0, 'the lesson panel scrolls');
      assert.deepEqual(await page.locator('.journey-header').boundingBox(), headerBefore, 'the lesson header remains still');
      assert(clearance.contentBottom <= clearance.panelBottom + 1, 'the last teaching text fits inside the scroll panel');
      assert(clearance.panelBottom <= clearance.dockTop - 4, 'the content panel remains above the fixed dock');
      assert(clearance.pageWidth <= clearance.width + 1); await shot(`${width}-${theme}-bottom-clearance`);
      const after = await saved(); assert.deepEqual(after.ids, before.ids); assert.equal(after.xp, before.xp);
      await page.locator('[data-continue]').click();
      assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'question');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const plainTools = await page.locator('[data-help], [data-reveal], [data-skip], [data-pause]').evaluateAll(buttons => buttons.map(b => {
        const s = getComputedStyle(b); return { name: b.textContent.trim(), border: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth], shadow: s.boxShadow };
      }));
      assert.equal(plainTools.length, 4);
      for (const tool of plainTools) { assert.deepEqual(tool.border, ['0px', '0px', '0px', '0px'], tool.name + ' has no border'); assert.equal(tool.shadow, 'none', tool.name + ' has no button outline shadow'); }
      await page.locator('[data-help]').focus(); await page.keyboard.press('Tab');
      assert.equal(await page.locator('[data-reveal]').evaluate(b => b === document.activeElement), true);
      const focus = await page.locator('[data-reveal]').evaluate(b => ({ width: parseFloat(getComputedStyle(b).outlineWidth), style: getComputedStyle(b).outlineStyle }));
      assert(focus.width >= 2 && focus.style !== 'none', 'text controls retain a keyboard focus indicator');
      await shot(`${width}-${theme}-plain-question-controls`);
      return { cardWidth: g.card.width, actionWidth: g.actions[0].width, gap: g.actions[1].x - g.actions[0].right, swipeIndex };
    });
  }
  await check('Reference and Skip rail actions execute their intended action once', async () => {
    await fresh(); await gotoRoute(page, route('v:credere') + '?chapter=present');
    const before = await saved();
    await moveAction(1);
    await page.locator('[data-action-track] a').click();
    await page.waitForFunction(() => location.hash.startsWith('#/reference/'));
    assert.match(await page.locator('body').innerText(), /credere/);
    await gotoRoute(page, route('v:credere') + '?session=' + before.session.id);
    await assertPresentTeaching();
    await moveAction(1);
    await moveAction(2);
    await page.locator('[data-action-track] [data-skip]').evaluate(b => { b.click(); b.click(); });
    const after = await saved();
    assert.equal(after.session.journey.chapterId, 'present'); assert.equal(after.session.journey.groupIndex, 1, 'one skip leaves only the singular group');
    assert(Object.keys(after.session.journey.skipped).some(id => /form-0$/.test(id)));
    assert(!Object.keys(after.session.journey.skipped).some(id => /form-3$/.test(id)));
    assert.deepEqual(after.ids, before.ids); assert.equal(after.xp, before.xp); assert.equal(after.learned, false);
  });
  await check('Correct choices and typed answers speak Italian once, while wrong, reload and muted answers stay quiet', async () => {
    await fresh(); await gotoRoute(page, route('v:capire') + '?chapter=present'); await reachJourneyActivity(page, 'mc');
    const q = await question(); assert(q.answer.includes('capisco'));
    const index = q.choices.findIndex(c => (c.value || c.label) === 'capisco'); assert(index >= 0);
    await page.locator(`[data-choice="${index}"]`).evaluate(b => { b.click(); b.click(); });
    await assertVisibleWithoutScroll('[data-feedback-bar] [data-continue]');
    assert.deepEqual(await spoken(), [{ text: 'capisco', lang: 'it-IT' }]);
    const feedback = await saved(); await reloadApp(page);
    assert.deepEqual(await spoken(), [{ text: 'capisco', lang: 'it-IT' }]);
    assert.deepEqual((await saved()).ids, feedback.ids);
    await gotoRoute(page, route('v:andare') + '?chapter=past'); await reachQuestion();
    assert.equal((await question()).type, 'type'); assert((await question()).answer.includes('sono'));
    await page.locator('[data-answer]').fill('sono');
    await page.locator('[data-check]').evaluate(b => { b.click(); b.click(); });
    await assertVisibleWithoutScroll('[data-feedback-bar] [data-continue]');
    assert.deepEqual(await spoken(), [{ text: 'capisco', lang: 'it-IT' }, { text: 'sono', lang: 'it-IT' }]);
    await page.locator('[data-continue]').click(); await reachJourneyActivity(page, 'type');
    const correctCalls = await spoken();
    assert.equal((await question()).type, 'type');
    await page.locator('[data-answer]').fill('sbagliato'); await page.locator('[data-check]').click();
    assert.equal((await saved()).session.ui.result.ok, false); assert.deepEqual(await spoken(), correctCalls);
    await reloadApp(page); assert.deepEqual(await spoken(), correctCalls);
    await page.evaluate(async () => { const { store } = await import('./js/store.js'); store.setSetting('tts', false); });
    await page.locator('[data-continue]').click(); await reachQuestion();
    await solveJourneyQuestion(page, await question());
    assert.equal((await saved()).session.ui.result.ok, true); assert.deepEqual(await spoken(), correctCalls);
  });
  await check('A short keyboard-sized viewport keeps typing reachable and releases layout on exit', async () => {
    await fresh(); await gotoRoute(page, route('v:andare') + '?chapter=past'); await reachQuestion();
    await page.setViewportSize({ width: 390, height: 480 });
    await page.waitForFunction(() => document.body.classList.contains('journey-compact'));
    await page.locator('[data-answer]').fill('draft');
    await page.locator('[data-answer]').scrollIntoViewIfNeeded();
    const input = await page.locator('[data-answer]').boundingBox(), panel = await page.locator('.journey-main').boundingBox(), pause = await page.locator('[data-pause]').boundingBox();
    assert(input.y >= panel.y - 1 && input.y + input.height <= panel.y + panel.height + 1, 'answer input is reachable inside the panel');
    assert(pause.y >= 0 && pause.y + pause.height <= 480, 'Pause stays accessible');
    await page.locator('[data-check]').scrollIntoViewIfNeeded();
    const check = await page.locator('[data-check]').boundingBox();
    assert(check.y >= panel.y - 1 && check.y + check.height <= panel.y + panel.height + 1, 'Check is reachable inside the panel');
    assert.equal(await page.evaluate(() => scrollY), 0); await shot('keyboard-height');
    await gotoRoute(page, '/reference/' + encodeURIComponent('v:andare'));
    const cleanup = await page.evaluate(() => ({ fixed: document.body.classList.contains('journey-viewport'), compact: document.body.classList.contains('journey-compact'), height: document.body.style.getPropertyValue('--journey-viewport-height') }));
    assert.deepEqual(cleanup, { fixed: false, compact: false, height: '' });
  });
  await check('No application or console errors', async () => assert.deepEqual(errors, []));
} catch (error) {
  if (!results.some(r => !r.ok)) results.push({ name: 'Harness startup', ok: false, error: error.stack });
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(TESTS_DIR, 'report-lesson-actions.json'), JSON.stringify({ results, errors, screenshots }, null, 2));
  await browser.close(); stopServer();
}
console.log(`${results.filter(r => r.ok).length}/${results.length} lesson action checks passed.`);
