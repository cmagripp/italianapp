#!/usr/bin/env node
// Compatibility checks for the retained legacy adaptive loop; journey-e2e covers the default experience. No production profile or network account is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, reloadApp } from './lib.mjs';

const { chromium, devices } = await loadPlaywright();
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const context = await browser.newContext(contextOptions(devices['iPhone 13'], { reducedMotion: 'reduce' }));
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const results = [];
const lessonRoute = (kind, id, objective) => process.env.ADAPTIVE_DIRECT === '1'
  ? '/learn/practice?id=' + encodeURIComponent(id) + '&legacy=1&objective=' + encodeURIComponent(objective)
  : '/learn/' + kind + '/' + encodeURIComponent(id) + '?legacy=1&objective=' + encodeURIComponent(objective);

async function state() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    const { skillState } = await import('./js/learning/model.js');
    const session = store.learning.session;
    return { session, events: Object.values(store.learning.events), learned: store.isLearned(session.entryId), skill: session.ui.current ? skillState(store.learning, session.ui.current.objectiveId) : null, xp: store.current.stats.xp, phase: document.querySelector('[data-adaptive]')?.dataset.phase };
  });
}

async function currentQuestion() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    const { getEntry, itemsForScope } = await import('./js/data.js');
    const { objectivesFor, allowedTenses } = await import('./js/learning/curriculum.js');
    const { buildQuestion } = await import('./js/learning/questions.js');
    const s = store.learning.session, current = s.ui.current;
    const entry = getEntry(current.entryId || s.entryId);
    const opts = store.learning.preferences;
    const objective = objectivesFor(entry, opts).find(o => o.id === current.objectiveId);
    let seed = current.seed >>> 0;
    const rng = () => { seed += 0x6D2B79F5; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
    return buildQuestion(entry, objective, { mode: current.mode, variant: current.variant, repairTag: current.repairTag, repairPerson: current.repairPerson, rng, pool: current.poolIds ? current.poolIds.map(getEntry).filter(Boolean) : itemsForScope(store.scope, store), allowedTenses: allowedTenses(store.learning) });
  });
}

async function startIfNeeded() {
  if ((await state()).phase === 'intro') await page.locator('[data-start]').click();
}
async function submitCorrect() {
  await startIfNeeded();
  const q = await currentQuestion();
  if (q.type === 'mc') await page.locator(`[data-choice="${q.choices.findIndex(c => c.correct)}"]`).click();
  else { await page.locator('[data-answer]').fill(q.answer[0]); await page.locator('[data-check]').click(); }
  await page.locator('[data-adaptive][data-phase="feedback"]').waitFor();
}
async function next() {
  await page.locator('[data-next]').click();
  if ((await state()).phase === 'checkpoint') await page.locator('[data-resume]').click();
  await startIfNeeded();
}
async function finishCurrent(limit = 130) {
  for (let i = 0; i < limit; i++) {
    const s = await state();
    if (s.phase === 'complete') return s;
    if (s.phase === 'checkpoint') { await page.locator('[data-resume]').click(); continue; }
    if (s.phase === 'feedback') { await page.locator('[data-next]').click(); continue; }
    await submitCorrect();
  }
  const s = await state();
  throw new Error('Practice could not reach completion: ' + JSON.stringify({ phase: s.phase, main: s.session.activeObjectiveId, current: s.session.ui.current, evidence: s.skill }));
}
async function skill(id) {
  return page.evaluate(async id => { const {store}=await import('./js/store.js'); const {skillState}=await import('./js/learning/model.js'); return skillState(store.learning, id); }, id);
}
async function check(name, action) {
  try { await action(); results.push({ name, ok: true }); console.log('PASS', name); }
  catch (error) { results.push({ name, ok: false, error: error.stack }); console.error('FAIL', name, error.message); throw error; }
}

try {
  await boot(page);
  await check('A correct exposed answer is practice, not independent readiness', async () => {
    await gotoRoute(page, lessonRoute('verb', 'v:mangiare', 'v:mangiare::presente::conjugation'));
    assert.equal((await state()).phase, 'intro');
    await submitCorrect();
    const s = await state();
    assert.equal(s.events.length, 1);
    assert.equal(s.events[0].ok, true);
    assert(s.events[0].assistance.includes('visible-form'));
    assert.equal(s.skill.independentCorrect, 0);
    assert.equal(s.skill.ready, false);
    assert.equal(s.phase, 'feedback');
  });
  await check('Feedback reload does not count the answer twice', async () => {
    const before = await state();
    await reloadApp(page);
    const after = await state();
    assert.equal(after.events.length, before.events.length);
    assert.equal(after.xp, before.xp);
    assert.equal(after.phase, 'feedback');
    assert.equal(after.session.ui.current.id, before.session.ui.current.id);
  });
  await check('Wrong answers produce repair feedback and retain the objective', async () => {
    await next();
    const q = await currentQuestion(), before = await state();
    if (q.type === 'mc') await page.locator(`[data-choice="${q.choices.findIndex(c => !c.correct)}"]`).click();
    else { await page.locator('[data-answer]').fill('sbagliatissimo'); await page.locator('[data-check]').click(); }
    const after = await state();
    assert.equal(after.events.at(-1).ok, false);
    assert.equal(after.skill.ready, false);
    assert.equal(after.session.ui.current.objectiveId, before.session.ui.current.objectiveId);
    assert(await page.locator('.adaptive-feedback-text').innerText());
    const unresolved = after.skill.unresolvedErrors;
    assert(unresolved.length, 'the failed skill retains a repair need');
    await next();
  });
  await check('Hint, draft and exact unfinished question survive pause and reload', async () => {
    await page.locator('[data-hint]').click();
    if (await page.locator('[data-answer]').count()) await page.locator('[data-answer]').fill('unfinished');
    const before = await state(), q = await currentQuestion();
    await page.locator('[data-pause]').click();
    await reloadApp(page);
    assert.equal((await state()).phase, 'paused');
    await page.locator('[data-resume]').click();
    const after = await state();
    assert.equal(after.session.ui.current.id, before.session.ui.current.id);
    assert(after.session.ui.assistance.includes('hint'));
    assert.deepEqual(await currentQuestion(), q);
    if (await page.locator('[data-answer]').count()) assert.equal(await page.locator('[data-answer]').inputValue(), 'unfinished');
    await submitCorrect();
    assert((await state()).events.at(-1).assistance.includes('hint'));
  });
  await check('I don’t know reveals without claiming success', async () => {
    await next();
    await page.locator('[data-reveal]').click();
    const s = await state();
    assert.equal(s.events.at(-1).outcome, 'revealed');
    assert.equal(s.events.at(-1).ok, false);
    assert.equal(s.skill.ready, false);
  });
  await check('Explicit skip stays deferred across reload and can be resumed', async () => {
    const id = (await state()).session.activeObjectiveId;
    const before = (await state()).events.length;
    await page.locator('[data-skip-step]').click();
    let s = await state();
    assert.equal(s.phase, 'complete');
    assert(Object.hasOwn(s.session.deferred, id));
    assert.equal(s.learned, false);
    assert.equal(s.events.length, before);
    await reloadApp(page);
    assert.equal((await state()).phase, 'complete');
    await page.locator('[data-resume-objective]').click();
    s = await state();
    assert.equal(s.session.ui.current.objectiveId, id);
    assert(!Object.hasOwn(s.session.deferred, id));
  });
  await check('Repeated varied independent answers eventually demonstrate the step', async () => {
    let sawCheckpoint = false;
    for (let i = 0; i < 100; i++) {
      const before = await state();
      if (before.phase === 'complete') break;
      await submitCorrect();
      await page.locator('[data-next]').click();
      if ((await state()).phase === 'checkpoint') {
        sawCheckpoint = true;
        assert.match(await page.locator('.adaptive-lead').innerText(), /no question limit/);
        await page.locator('[data-resume]').click();
      }
    }
    const s = await state();
    assert.equal(s.phase, 'complete', 'loop must remain solvable, including after errors and assistance');
    const summary = await page.evaluate(async () => { const {store}=await import('./js/store.js'); const {skillState}=await import('./js/learning/model.js'); return skillState(store.learning, 'v:mangiare::presente::conjugation'); });
    assert(summary.ready);
    assert(summary.independentCorrect >= 4);
    assert(summary.variantCount >= 2);
    assert(summary.spacedSuccess);
    assert(sawCheckpoint, '10-question checkpoint was offered without forcing advancement');
  });
  await check('Word recall hides the answer and continues after one correct response', async () => {
    await gotoRoute(page, lessonRoute('word', 'w:casa|noun', 'w:casa|noun::word::recall'));
    await startIfNeeded();
    assert.equal(await page.locator('.adaptive-entry').innerText(), 'Word practice');
    await submitCorrect();
    assert.equal((await state()).skill.ready, false);
    await next();
    assert.equal((await state()).phase, 'question');
    assert.equal((await state()).session.entryId, 'w:casa|noun');
  });
  await check('Phone layout has no horizontal overflow and accessible answer input', async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (await page.locator('[data-answer]').count()) {
      assert(await page.getByLabel('Your answer in Italian').count());
      assert(await page.locator('[data-answer]').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
    }
    fs.mkdirSync('tests/shots', { recursive: true });
    await page.screenshot({ path: 'tests/shots/adaptive-word-phone.png', fullPage: true });
  });
  await check('Word recall remains solvable after a deliberate error', async () => {
    const q = await currentQuestion();
    if (q.type === 'mc') await page.locator(`[data-choice="${q.choices.findIndex(c => !c.correct)}"]`).click();
    else { await page.locator('[data-answer]').fill('sbagliato'); await page.locator('[data-check]').click(); }
    await finishCurrent();
    const result = await skill('w:casa|noun::word::recall');
    assert(result.ready); assert(result.independentCorrect >= 4); assert(result.variantCount >= 2);
  });
  await check('Focused review rechecks an already-ready skill in a new session', async () => {
    await gotoRoute(page, '/review?mode=extra');
    const objective = 'v:mangiare::presente::conjugation';
    const link = page.locator(`a[href*="objective=${encodeURIComponent(objective)}"]`).first();
    assert(await link.count(), 'review menu links to the individual skill');
    await gotoRoute(page, (await link.getAttribute('href')).slice(1) + '&legacy=1');
    await page.locator('[data-adaptive]').waitFor();
    assert.notEqual((await state()).phase, 'complete');
    const result = await finishCurrent();
    assert.equal(result.session.mode, 'review');
    const evidence = (await skill(objective)).sessionEvidence[result.session.id];
    assert(evidence.independentCorrect >= 2); assert(evidence.variants.length >= 2);
    await reloadApp(page);
    assert.equal((await state()).phase, 'complete', 'reload preserves the completed session summary');
    await gotoRoute(page, '/review?mode=extra');
    await gotoRoute(page, (await page.locator(`a[href*="objective=${encodeURIComponent(objective)}"]`).first().getAttribute('href')).slice(1) + '&legacy=1');
    await page.locator('[data-adaptive]').waitFor();
    assert.notEqual((await state()).session.id, result.session.id, 'a new review request gets a new session');
    assert.notEqual((await state()).phase, 'complete');
  });
  await check('Cold-start word meaning reaches repeated independent readiness', async () => {
    await gotoRoute(page, '/home');
    await page.evaluate(async () => { const {store}=await import('./js/store.js'); const {createLearning}=await import('./js/learning/model.js'); store.current.learning=createLearning(); store.save(); });
    await gotoRoute(page, lessonRoute('word', 'w:casa|noun', 'w:casa|noun::word::meaning'));
    await finishCurrent();
    const result = await skill('w:casa|noun::word::meaning');
    assert(result.ready); assert(result.independentCorrect >= 4); assert(result.variantCount >= 2);
  });
  await check('Course checkpoint checks all six persons in this session', async () => {
    await gotoRoute(page, lessonRoute('verb', 'v:parlare', 'v:parlare::presente::conjugation') + '&mode=checkpoint');
    const result = await finishCurrent(220);
    const evidence = await skill('v:parlare::presente::conjugation');
    const persons = evidence.sessionEvidence[result.session.id].independentPersons;
    assert.deepEqual([...persons].sort(), [0, 1, 2, 3, 4, 5]);
  });
  await check('An auxiliary mistake pivots to a component and then full production', async () => {
    await gotoRoute(page, '/home');
    await page.evaluate(async () => (await import('./js/store.js')).store.setLearningPreference('stage', 'past'));
    const id = 'v:andare::passatoProssimo::conjugation';
    await gotoRoute(page, lessonRoute('verb', 'v:andare', id));
    await startIfNeeded();
    if ((await currentQuestion()).type === 'mc') { await submitCorrect(); await next(); }
    let q = await currentQuestion();
    assert.equal(q.type, 'type'); assert.equal(q.meta.objectiveId, id);
    const wrongAuxiliary = q.answer[0].replace(/^(sono|sei|è|siamo|siete) /, 'ho ');
    assert.notEqual(wrongAuxiliary, q.answer[0]);
    await page.locator('[data-answer]').fill(wrongAuxiliary); await page.locator('[data-check]').click();
    assert((await state()).events.at(-1).errorTags.includes('auxiliary'));
    let foundScaffold = false;
    for (let i = 0; i < 30; i++) {
      await next();
      if ((await state()).phase === 'complete') break;
      q = await currentQuestion();
      if (q.meta.objectiveId === id && q.meta.scaffold) {
        foundScaffold = true;
        assert.equal(q.meta.scaffoldSkill, 'auxiliary');
        const before = (await skill(id)).independentCorrect;
        await submitCorrect();
        assert.equal((await state()).events.at(-1).mode, 'recognition');
        assert.equal((await skill(id)).independentCorrect, before);
        break;
      }
      await submitCorrect();
    }
    assert(foundScaffold, 'a supported auxiliary repair was shown');
    await finishCurrent(220);
    assert((await skill(id)).ready, 'whole construction became ready after independent full-form answers');
  });
  await check('Optional word practice is offered after the core lesson', async () => {
    await gotoRoute(page, lessonRoute('word', 'w:casa|noun', ''));
    assert((await state()).session.objectiveIds.every(id => !/::(?:context|listening)$/.test(id)));
    for (let i = 0; i < 6 && (await state()).phase !== 'complete'; i++) await page.locator('[data-skip-step]').click();
    assert.equal((await state()).phase, 'complete');
    assert.equal(await page.locator('[data-extra-practice]').count(), 2);
  });
  await check('A one-item scope explains its limit and permits immediate skip', async () => {
    await gotoRoute(page, '/home');
    await page.evaluate(async () => { const {store}=await import('./js/store.js'); const {createLearning}=await import('./js/learning/model.js'); store.current.learning=createLearning(); store.current.items={}; store.current.lists.bank.items=['w:casa|noun']; store.setScope({mode:'lists',lists:['bank']}); });
    await gotoRoute(page, lessonRoute('word', 'w:casa|noun', 'w:casa|noun::word::recall'));
    await startIfNeeded();
    assert(await page.locator('.adaptive-scope-note').isVisible());
    await page.locator('[data-skip-step]').click();
    const result = await state();
    assert.equal(result.phase, 'complete'); assert.equal(result.learned, false);
    assert(Object.hasOwn(result.session.deferred, 'w:casa|noun::word::recall'));
  });
  await check('Newer saved learning is preserved and asks for an app update', async () => {
    await gotoRoute(page, '/home');
    await page.evaluate(async () => { const {store}=await import('./js/store.js'); store.learning.version=999; store.save(); });
    await gotoRoute(page, lessonRoute('word', 'w:casa|noun', 'w:casa|noun::word::recall'));
    assert.match(await page.locator('#view').innerText(), /saved by a newer version/);
    assert.equal(await page.locator('[data-check], [data-choice], [data-start]').count(), 0);
    assert.equal(await page.evaluate(async () => (await import('./js/store.js')).store.learning.version), 999);
  });
  assert.deepEqual(errors, [], 'no browser errors');
} finally {
  fs.writeFileSync('tests/report-adaptive-e2e.json', JSON.stringify({ generatedAt: new Date().toISOString(), results, errors }, null, 2));
  await browser.close();
  stopServer();
}
