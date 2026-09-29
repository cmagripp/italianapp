#!/usr/bin/env node
// Taught-lesson acceptance checks. Isolated profile; app modules are read for state
// and a traversal oracle, while fixed Italian fixtures independently check correctness.
import assert from 'node:assert/strict';
import { journeyQuestion, solveJourneyQuestion, reachJourneyActivity, advanceJourneyPage } from './journey-driver.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, reloadApp, TESTS_DIR, SHOTS_DIR } from './lib.mjs';

const VERB_FORMS = {
  credere: { presente: ['credo', 'credi', 'crede', 'crediamo', 'credete', 'credono'], passatoProssimo: ['ho creduto', 'hai creduto', 'ha creduto', 'abbiamo creduto', 'avete creduto', 'hanno creduto'], imperfetto: ['credevo', 'credevi', 'credeva', 'credevamo', 'credevate', 'credevano'], futuro: ['crederò', 'crederai', 'crederà', 'crederemo', 'crederete', 'crederanno'], condizionale: ['crederei', 'crederesti', 'crederebbe', 'crederemmo', 'credereste', 'crederebbero'] },
  dire: { presente: ['dico', 'dici', 'dice', 'diciamo', 'dite', 'dicono'], passatoProssimo: ['ho detto', 'hai detto', 'ha detto', 'abbiamo detto', 'avete detto', 'hanno detto'], futuro: ['dirò', 'dirai', 'dirà', 'diremo', 'direte', 'diranno'] },
  parlare: { presente: ['parlo', 'parli', 'parla', 'parliamo', 'parlate', 'parlano'], futuro: ['parlerò', 'parlerai', 'parlerà', 'parleremo', 'parlerete', 'parleranno'] },
  capire: { presente: ['capisco', 'capisci', 'capisce', 'capiamo', 'capite', 'capiscono'] },
  alzarsi: { presente: ['mi alzo', 'ti alzi', 'si alza', 'ci alziamo', 'vi alzate', 'si alzano'] },
};
const SITUATIONS = [
  { verb: 'credere', chapter: 'present', it: 'Credo a Marco.', answer: 'credo', person: 0 },
  { verb: 'credere', chapter: 'present', it: 'Noi crediamo a Sara.', answer: 'crediamo', person: 3 },
  { verb: 'dire', chapter: 'past', it: 'Ho detto la verità.', answer: 'ho detto', person: 0 },
  { verb: 'dire', chapter: 'future', it: 'Dirò la verità.', answer: 'dirò', person: 0 },
  { verb: 'andare', chapter: 'past', it: 'Sara è andata al mercato.', answer: 'è andata', person: 2 },
  { verb: 'alzarsi', chapter: 'past', it: 'Marco si è alzato presto.', answer: 'si è alzato', person: 2 },
];
const NO_INTERNAL_LABELS = /\b\d+\s+independent\s+(?:answers|checks|successes)|\b\d+\s*\/\s*\d+\s+independent|\bsupported practice\b|\bevidence\s+(?:counter|score|points)\b/i;

const { chromium, devices } = await loadPlaywright();
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const context = await browser.newContext(contextOptions(devices['iPhone 13'], { reducedMotion: 'reduce' }));
const page = await context.newPage();
const errors = [], results = [], screenshots = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && !/fonts\.g(oogleapis|static)\.com/.test(message.location()?.url || '')) errors.push(message.text());
});
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const entryRoute = (kind, id, chapter = '') => '/learn/' + kind + '/' + encodeURIComponent(id) + (chapter ? '?chapter=' + encodeURIComponent(chapter) : '');
async function check(name, action) {
  if (process.env.JOURNEY_FILTER && !name.toLowerCase().includes(process.env.JOURNEY_FILTER.toLowerCase()) && name !== 'No application errors') return;
  const started = Date.now();
  try { const detail = await action(); results.push({ name, ok: true, ms: Date.now() - started, detail }); console.log('PASS', name); }
  catch (error) { results.push({ name, ok: false, ms: Date.now() - started, error: error.stack, visible: await page.locator('body').innerText().catch(() => '') }); console.error('FAIL', name, error.message); throw error; }
}
async function state() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    const { getEntry } = await import('./js/data.js');
    const { buildLesson } = await import('./js/learning/lesson-content.js');
    const { currentJourneyStep, journeyCaseProgress } = await import('./js/learning/journey.js');
    const session = store.learning.session;
    if (!session?.journey) throw new Error('The default lesson did not create a taught journey session');
    const plan = buildLesson(getEntry(session.entryId));
    return { session, plan, cases: plan.kind === 'verb' ? journeyCaseProgress(plan, store.learning, session) : null, step: currentJourneyStep(plan, session, store.learning, Date.now()), events: Object.values(store.learning.events), xp: store.current.stats.xp, learned: store.isLearned(session.entryId), domPhase: document.querySelector('[data-journey]')?.dataset.phase };
  });
}
async function question() { return journeyQuestion(page); }

async function flush() { await page.evaluate(async () => { const { store } = await import('./js/store.js'); await store.saveNow(); }); }
async function assertSimpleUI() {
  assert.equal(await page.locator('[data-journey]').count(), 1);
  assert(!NO_INTERNAL_LABELS.test(await page.locator('[data-journey]').innerText()), 'internal evidence accounting is hidden');
}
async function continueLesson() { await advanceJourneyPage(page); }
async function reachQuestion(limit = 25) {
  for (let i = 0; i < limit; i++) {
    const s = await state();
    if (s.domPhase === 'overview') { await advanceJourneyPage(page); continue; }
    if (s.step.type === 'question' && !s.step.awaitingContinue) return s;
    assert(!['complete', 'unavailable'].includes(s.step.type), 'an answerable taught question must be reachable');
    await assertSimpleUI();
    await continueLesson();
  }
  throw new Error('No question after the bounded teaching traversal');
}
function independentlyExpected(q, inf) {
  if (['form', 'construction'].includes(q.meta?.evidenceScope) && !q.meta?.scaffold) {
    const form = VERB_FORMS[inf]?.[q.meta.tense]?.[q.meta.person];
    if (form) { assert(q.answer.includes(form), `${inf}: generator differs from separately checked Italian ${form}`); return form; }
  }
  return q.answer[0];
}
async function answerCorrect({ double = false } = {}) {
  const s = await reachQuestion(), q = await question();
  assert(q, 'the selected taught activity can be rendered');
  await solveJourneyQuestion(page, q, { expected: activity => independentlyExpected(activity, s.session.entryId.slice(2)), double });
  return { before: s, after: await state(), q };
}
async function screenshot(name) {
  const file = path.join(SHOTS_DIR, 'journey-' + name + '.png');
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' }); screenshots.push(file);
}
async function auditLayout(name) {
  const layout = await page.evaluate(() => {
    const width = innerWidth;
    const shown = el => el.checkVisibility() && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    const wide = [...document.querySelectorAll('[data-journey] h1, [data-journey] h2, [data-journey] p, [data-journey] table, [data-journey] input, [data-journey] button')]
      .filter(shown).filter(el => el.getBoundingClientRect().width > width + 1 || el.scrollWidth > el.clientWidth + 2)
      .map(el => ({ tag: el.tagName, text: el.textContent.slice(0, 55), width: el.getBoundingClientRect().width, scroll: el.scrollWidth, client: el.clientWidth }));
    const input = document.querySelector('[data-answer]');
    return { width, scroll: document.documentElement.scrollWidth, wide, inputFont: input ? parseFloat(getComputedStyle(input).fontSize) : null, inputLabel: input?.labels?.[0]?.textContent || null };
  });
  assert(layout.scroll <= layout.width + 1, name + ' has no horizontal page overflow');
  assert.deepEqual(layout.wide, [], name + ' text and controls are not clipped');
  if (layout.inputFont) { assert(layout.inputFont >= 16, 'phone answer input avoids focus zoom'); assert(layout.inputLabel, 'answer input has a programmatic label'); }
  await assertSimpleUI();
  await screenshot(name);
}
async function progress() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    const { getEntry } = await import('./js/data.js');
    const { buildLesson } = await import('./js/learning/lesson-content.js');
    const { journeyProgress } = await import('./js/learning/journey.js');
    const session = store.learning.session;
    return journeyProgress(buildLesson(getEntry(session.entryId)), session, store.learning, Date.now());
  });
}
async function trace(seen) {
  const s = await state(), p = await progress();
  return { step: { type: s.step.type, chapter: s.step.chapter?.id, group: s.step.group?.id, target: s.step.target?.id, phase: s.step.phase, questionId: s.step.questionId, awaitingContinue: s.step.awaitingContinue, reason: s.step.reason },
    targets: p.chapters.find(c => c.id === s.step.chapter?.id)?.targets.map(t => ({ id: t.target.id, ready: t.ready, attempts: t.attempts, independent: t.independentCorrect, variants: t.variantCount, errors: t.unresolvedErrors })),
    events: s.events.slice(-10).map(e => ({ target: e.objectiveId, activity: e.activityKind, variant: e.variantId, mode: e.mode, ok: e.ok, assistance: e.assistance })), recent: seen.slice(-12) };
}
async function traverse({ until, limit = 700, observe = () => {} }) {
  const seen = [];
  for (let i = 0; i < limit; i++) {
    const s = await state();
    const stamp = { chapter: s.step.chapter?.id, group: s.step.group?.id, type: s.step.type, phase: s.step.phase, format: s.step.format, supplemental: s.step.supplemental, target: s.step.target?.id, answered: s.step.awaitingContinue };
    seen.push(stamp); await observe(s);
    if (i > 0 && i % 50 === 0) console.log('  journey progress', JSON.stringify({ transitions: i, ...stamp, answers: s.events.filter(e => e.entryId === s.session.entryId).length }));
    if (until(s)) return { state: s, seen };
    await assertSimpleUI();
    if (s.domPhase === 'overview') { await continueLesson(); continue; }
    if (s.step.type === 'question' && !s.step.awaitingContinue) await answerCorrect();
    else if (s.step.type === 'complete' || s.step.type === 'unavailable') throw new Error('Lesson cannot reach its intended completion: ' + JSON.stringify(await trace(seen)));
    else await continueLesson();
  }
  throw new Error('No successful completion after real correct answers: ' + JSON.stringify(await trace(seen)));
}

try {
  await boot(page);
  await check('Authored grammar fixtures match independently checked forms and meanings', async () => {
    const actual = await page.evaluate(async ({ verbs, situations }) => {
      const { getEntry } = await import('./js/data.js');
      const { lessonForms, lessonContexts } = await import('./js/learning/lesson-content.js');
      return { forms: verbs.map(({ inf, tense, person }) => ({ inf, tense, person, forms: lessonForms(getEntry('v:' + inf), tense, person) })), contexts: situations.map(({ verb, chapter }) => lessonContexts(getEntry('v:' + verb), chapter)) };
    }, { verbs: Object.entries(VERB_FORMS).flatMap(([inf, tenses]) => Object.keys(tenses).flatMap(tense => [0, 1, 2, 3, 4, 5].map(person => ({ inf, tense, person })))), situations: SITUATIONS });
    for (const f of actual.forms) assert(f.forms.includes(VERB_FORMS[f.inf][f.tense][f.person]), `${f.inf} ${f.tense} person ${f.person}`);
    SITUATIONS.forEach((expected, i) => assert(actual.contexts[i].some(c => c.it === expected.it && c.answer === expected.answer && c.person === expected.person), expected.it));
    return { checkedForms: actual.forms.length, checkedSituations: SITUATIONS.length };
  });
  await check('Cold start meets the verb and teaches before the first question', async () => {
    await gotoRoute(page, entryRoute('verb', 'v:credere'));
    await page.locator('[data-journey]').waitFor();
    const first = await state();
    assert.equal(first.domPhase, 'overview');
    assert.equal(await page.locator('[data-open-lesson]').count(), 5);
    assert.match(await page.locator('[data-journey]').innerText(), /credere/i);
    assert.equal(first.events.length, 0, 'looking at teaching is not an answer');
    await assertSimpleUI();
    await page.locator('[data-open-lesson=present]').click();
    const q = await reachQuestion();
    assert.equal(q.step.chapter.id, 'present');
    assert.equal(q.step.group.id, 'singular');
    assert.equal(q.step.phase, 'guided');
    await screenshot('first-guided-phone');
  });
  await check('One choice tap grades exactly once and feedback waits for Continue', async () => {
    await reachJourneyActivity(page, 'mc', { expected: q => independentlyExpected(q, 'credere') });
    const { before, after, q } = await answerCorrect({ double: true });
    assert.equal(q.type, 'mc', 'first guided activity uses a tappable answer');
    assert.equal(after.events.length, before.events.length + 1);
    assert.equal(after.step.awaitingContinue, true);
    const locked = await page.locator('[data-choice]:not([disabled])').count();
    assert.equal(locked, 0, 'the answered choices are locked');
    await page.waitForTimeout(800);
    assert.equal((await state()).events.length, after.events.length);
    assert.equal((await state()).step.questionId, after.step.questionId);
    assert.equal((await state()).step.awaitingContinue, true);
    await assertSimpleUI();
    await screenshot('choice-feedback-phone');
  });
  await check('Feedback and exact unfinished journey persist without duplicate awards', async () => {
    await flush(); const before = await state();
    await reloadApp(page); const after = await state();
    assert.equal(after.session.id, before.session.id);
    assert.equal(after.step.questionId, before.step.questionId);
    assert.equal(after.step.awaitingContinue, true);
    assert.deepEqual(after.events, before.events);
    assert.equal(after.xp, before.xp);
  });
  await check('Teaching skip defers the group, and pause preserves help and the exact next activity', async () => {
    await gotoRoute(page, entryRoute('verb', 'v:parlare', 'present'));
    const first = await state();
    assert.equal(first.step.type, 'teach');
    const deferred = first.step.group.targets.filter(t => t.required !== false).map(t => t.id);
    assert(deferred.length > 0);
    await page.locator('[data-skip]').click();
    const skipped = await state();
    assert.notEqual(skipped.step.group?.id, first.step.group.id, 'skip during teaching moves immediately');
    for (const target of deferred) assert(Object.hasOwn(skipped.session.journey.skipped, target), target + ' remains unfinished');
    assert.equal(skipped.learned, false);
    await reachQuestion();
    const q = await question();
    await page.locator('[data-help]').click();
    if (q.type === 'type') await page.locator('[data-answer]').fill('unfinished');
    await page.locator('[data-pause]').click();
    await flush(); const before = await state();
    await reloadApp(page); const paused = await state();
    assert.equal(paused.domPhase, 'paused');
    assert.equal(paused.step.questionId, before.step.questionId);
    assert.deepEqual(paused.session.journey.skipped, before.session.journey.skipped);
    await page.locator('[data-resume]').click();
    assert((await state()).session.ui.assistance.includes('hint'));
    assert(!deferred.includes((await state()).step.target.id));
    if (q.type === 'type') assert.equal(await page.locator('[data-answer]').inputValue(), 'unfinished');
    const result = await answerCorrect();
    assert(result.after.events.at(-1).assistance.includes('hint'));
    await assertSimpleUI();
    await screenshot('paused-help-resume-phone');
  });
  await check('Meet dire flags its real irregular participle before any past checks', async () => {
    await gotoRoute(page, entryRoute('verb', 'v:dire'));
    assert.equal((await state()).domPhase, 'overview');
    await page.locator('.journey-overview-meaning summary').click();
    assert.match(await page.locator('[data-journey]').innerText(), /detto/);
    assert.equal((await state()).events.filter(e => e.entryId === 'v:dire').length, 0);
  });
  await check('A complete credere lesson genuinely demonstrates every person and formal role', async () => {
    await gotoRoute(page, entryRoute('verb', 'v:credere'));
    const traversal = await traverse({ until: s => s.cases?.complete && ['recap', 'complete'].includes(s.step.type) });
    const p = await progress();
    for (const chapter of ['present', 'past', 'background', 'future', 'condizionale']) {
      const c = p.chapters.find(c => c.id === chapter);
      assert(c, chapter + ' is present');
      assert.equal(c.complete, true, chapter + ' cannot finish with unresolved required targets');
      for (const person of [0, 1, 2, 3, 4, 5]) {
        const target = c.targets.find(t => t.target.person === person && t.target.role !== 'formal');
        assert(target?.ready, chapter + ' person ' + person + ' is independently ready');
        const wins = traversal.state.events.filter(e => e.objectiveId === target.target.id && e.ok && e.firstAttempt && e.mode === 'production' && e.activityKind === 'independent' && !e.assistance.length);
        assert(wins.length >= 2, chapter + ' person ' + person + ' has repeated independent answers');
        assert(new Set(wins.map(e => e.variantId)).size >= 2, 'distinct prompt variants');
      }
      assert(c.targets.some(t => t.target.role === 'formal' && t.ready), chapter + ' includes actual formal address evidence');
    }
    assert.equal(traversal.state.cases.complete, true, 'all five core cases are ready without an intro or mixed-practice gate');
    assert.equal(traversal.state.learned, true, 'the verb is learned only after all five core cases are ready');
    const lessonEvents = traversal.state.events.filter(e => e.sessionId === traversal.state.session.id);
    assert(lessonEvents.every(e => e.entryId === 'v:credere'), 'practice and spacing never introduce unrelated entries');
    assert(lessonEvents.some(e => e.tense === 'imperfetto' && e.mode === 'production' && e.ok && !e.assistance.length), 'imperfetto is a required core case');
    assert(!lessonEvents.some(e => e.chapterId === 'mixed'), 'mixed practice stays optional');
    assert(!p.chapters.some(c => c.remembered), 'same-session practice is not later retention');
    const interludes = traversal.seen.filter(s => s.type === 'question' && s.supplemental && s.phase === 'guided' && !s.answered);
    for (const format of ['mc', 'letters', 'pairs']) assert(interludes.some(s => s.format === format), format + ' provides variety during later practice, beyond the introductory activities');
    await screenshot('verb-complete-phone');
    return { answers: lessonEvents.length, transitions: traversal.seen.length, interludes: Object.fromEntries(['mc', 'letters', 'pairs'].map(format => [format, interludes.filter(s => s.format === format).length])) };
  });
  await check('A built-in noun finishes a short recognition introduction without inventing independent mastery', async () => {
    await gotoRoute(page, entryRoute('word', 'w:casa|noun'));
    const traversal = await traverse({ until: s => s.step.type === 'complete', limit: 500 });
    const p = await progress();
    assert.equal(p.complete, true);
    const events = traversal.state.events.filter(e => e.entryId === 'w:casa|noun');
    for (const skill of ['meaning', 'recall', 'article', 'plural']) assert(events.some(e => e.skill === skill && e.mode === 'recognition' && e.ok), skill + ' practised in the short introduction');
    assert(events.every(e => e.mode === 'recognition'), 'recognition is not silently upgraded to production');
    assert(traversal.state.plan.wordLesson.slots.length >= 6 && traversal.state.plan.wordLesson.slots.length <= 8);
    assert.equal(traversal.state.learned, true, 'the introduction can finish without claiming independent recall');
    assert(p.chapters.every(c => !c.remembered), 'same-session word choices do not establish delayed retention');
    assert(events.every(e => e.entryId === 'w:casa|noun'));
    await screenshot('noun-complete-phone');
    return { answers: events.length, transitions: traversal.seen.length };
  });
  await check('All ten word types open taught, answerable activities appropriate to their type', async () => {
    const fixtures = await page.evaluate(async () => {
      const { data } = await import('./js/data.js');
      return [...new Set(data.vocab.map(e => e.pos))].map(pos => {
        const e = data.vocab.find(e => e.pos === pos && e.level === 'A1' && e.ex && e.exEn);
        return { id: e.id, pos, it: e.it };
      });
    });
    assert.equal(fixtures.length, 10);
    for (const f of fixtures) {
      await gotoRoute(page, entryRoute('word', f.id));
      const intro = await state();
      assert.equal(intro.step.type, 'teach', f.it + ' starts with teaching');
      const targets = intro.plan.chapters.flatMap(c => c.groups.flatMap(g => g.targets));
      if (f.pos !== 'noun') assert(!targets.some(t => ['article', 'plural'].includes(t.skill)), f.pos + ' is not treated as a noun');
      if (f.pos !== 'adj') assert(!targets.some(t => t.skill === 'agreement'), f.pos + ' is not treated as an adjective');
      const before = await reachQuestion(), q = await question();
      assert(q && q.answer.length, f.it + ' has a real answer');
      assert.equal(q.meta.skill, 'meaning', f.it + ' keeps the word skill rather than a conjugation skill');
      await answerCorrect();
      const after = await state();
      assert.equal(after.events.length, before.events.length + 1);
      assert.equal(after.events.at(-1).ok, true, f.it + ' accepts its taught answer');
      await assertSimpleUI();
    }
    return fixtures;
  });
  await check('Noun senses, invariant adjectives and missing custom forms remain honest', async () => {
    const facts = await page.evaluate(async () => {
      const { getEntry } = await import('./js/data.js');
      const { buildLesson } = await import('./js/learning/lesson-content.js');
      const ids = ['w:calcio|noun', 'w:caffè|noun', 'w:occhiali|noun', 'w:latte|noun', 'w:blu|adj', 'w:incinta|adj'];
      const plans = ids.map(id => ({ id, plan: buildLesson(getEntry(id)) }));
      return plans.map(({ id, plan }) => ({ id, meaning: plan.meaning, targets: plan.chapters.flatMap(c => c.groups.flatMap(g => g.targets)).map(t => t.skill), teaching: plan.chapters.flatMap(c => c.groups.flatMap(g => g.cards)).map(c => [c.body, ...(c.notes || []), ...(c.forms || []).map(f => f.form)].join(' ')).join(' ') }));
    });
    for (const id of ['w:calcio|noun', 'w:occhiali|noun', 'w:latte|noun']) assert(!facts.find(f => f.id === id).targets.includes('plural'), id + ' does not invent a plural exercise');
    assert.match(facts.find(f => f.id === 'w:calcio|noun').teaching, /calci.*kicks/);
    assert.match(facts.find(f => f.id === 'w:caffè|noun').teaching, /i caffè/);
    assert.match(facts.find(f => f.id === 'w:blu|adj').teaching, /invariab/i);
    assert.match(facts.find(f => f.id === 'w:incinta|adj').teaching, /incinte/);
    assert(!facts.find(f => f.id === 'w:caffè|noun').meaning.includes(';'), 'one taught sense, other meanings stay in reference');
    const customId = await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      const { registerCustom } = await import('./js/data.js');
      const id = store.addCustomWord({ it: 'quaderno di prova', en: 'test notebook', pos: 'noun', g: 'm', level: 'A1', cat: 'school' });
      registerCustom(store.current.custom); return id;
    });
    await gotoRoute(page, entryRoute('word', customId, 'forms'));
    const s = await state();
    assert(!s.plan.chapters.flatMap(c => c.groups.flatMap(g => g.targets)).some(t => t.skill === 'plural'));
    const visible = await page.locator('[data-journey]').innerText();
    assert.match(visible, /Plural not yet recorded/);
    assert(!/Normally singular in this meaning/.test(visible));
    await assertSimpleUI();
  });
  await check('An actual auxiliary mistake receives a component repair before whole-form success', async () => {
    await gotoRoute(page, entryRoute('verb', 'v:andare', 'past'));
    await traverse({ limit: 120, until: s => s.step.type === 'question' && !s.step.awaitingContinue && s.step.phase === 'independent' && s.step.target?.skill === 'conjugation' && s.step.target?.person === 0 });
    const targetId = (await state()).step.target.id;
    assert((await question()).answer.some(a => /^sono andat[oa]$/.test(a)), 'known correct full construction');
    await page.locator('[data-answer]').fill('ho andato');
    await page.locator('[data-check]').click();
    const wrong = (await state()).events.at(-1);
    assert.equal(wrong.ok, false);
    assert(wrong.errorTags.includes('auxiliary'));
    assert(wrong.components.some(c => c.skill === 'participle' && c.ok), 'correct participle is retained');
    assert.match(await page.locator('.journey-feedback').innerText(), /essere|sono/);
    await continueLesson();
    assert.equal((await state()).step.type, 'repair');
    await continueLesson();
    const repair = await question();
    assert(repair.meta.scaffold, 'repair actually isolates a component');
    assert(repair.answer.includes('sono'), 'auxiliary scaffold asks for the helper');
    const repaired = await answerCorrect();
    assert.equal(repaired.after.events.at(-1).mode, 'recognition', 'supported component does not certify the whole construction');
    assert.equal(repaired.after.step.target.id, targetId, 'repair remains on the same target');
    await screenshot('auxiliary-repair-phone');
    await traverse({ limit: 100, until: s => s.step.type === 'question' && !s.step.awaitingContinue && s.step.phase === 'independent' && s.step.target?.id === targetId });
    await page.locator('[data-answer]').fill('ho andato');
    await page.locator('[data-check]').click();
    const repeated = (await state()).events.at(-1);
    assert(repeated.errorTags.includes('auxiliary'));
    assert(repeated.components.some(c => c.skill === 'participle' && c.ok));
    await continueLesson();
    assert.equal((await state()).step.type, 'repair');
    assert.equal((await state()).step.helpSuggested, true);
    const worked = await page.locator('[data-journey]').innerText();
    assert.match(worked, /work through an example/i, 'recurring difficulty changes the teaching');
    assert.match(worked, /already had the past participle right/i, 'teaching preserves the component already correct');
    assert.match(worked, /Auxiliary[\s\S]*sono[\s\S]*Past participle[\s\S]*andat[oa]/, 'worked model decomposes this exact verb');
    assert.equal(await page.locator('[data-skip]').count(), 1);
    assert.equal(await page.locator('[data-pause]').count(), 1);
    await screenshot('repeated-auxiliary-worked-example-phone');
    const done = await traverse({ limit: 300, until: s => s.step.type === 'recap' && s.step.chapter?.id === 'past' });
    const result = (await progress()).chapters.find(c => c.id === 'past');
    assert.equal(result.complete, true, 'past chapter is independently ready after repair');
    const later = done.state.events.filter(e => e.objectiveId === targetId && e.at >= repeated.at && e.id !== repeated.id && e.ok && e.mode === 'production' && !e.assistance.length);
    assert(later.length >= 2, 'the wrong target received two later independent successes');
    assert(done.state.events.filter(e => e.sessionId === done.state.session.id).every(e => e.entryId === 'v:andare'));
  });
  await check('A later focused review preserves the target and establishes retention separately', async () => {
    const targetId = 'v:credere::lesson::present::form-0';
    const before = await page.evaluate(async targetId => { const { store } = await import('./js/store.js'); const { skillState } = await import('./js/learning/model.js'); return skillState(store.learning, targetId); }, targetId);
    assert.equal(before.ready, true); assert.equal(before.remembered, false);
    await page.clock.install({ time: Date.now() + 2 * 86400e3 });
    await gotoRoute(page, entryRoute('verb', 'v:credere') + '?mode=review&objective=' + encodeURIComponent(targetId));
    const started = await state();
    assert.equal(started.session.mode, 'review');
    assert.equal(started.session.journey.focusTargetId, targetId);
    const done = await traverse({ limit: 100, until: s => s.step.type === 'complete' });
    const after = await page.evaluate(async targetId => { const { store } = await import('./js/store.js'); const { skillState } = await import('./js/learning/model.js'); return skillState(store.learning, targetId); }, targetId);
    assert.equal(after.remembered, true);
    const wins = done.state.events.filter(e => e.sessionId === done.state.session.id && e.objectiveId === targetId && e.ok && e.mode === 'production' && !e.assistance.length);
    assert(wins.length >= 2);
    assert(wins.every(e => e.at >= before.readyAt + 86400e3));
    await screenshot('delayed-review-phone');
  });
  await check('A missing reflexive pronoun receives the specific same-verb repair', async () => {
    await gotoRoute(page, entryRoute('verb', 'v:alzarsi', 'past'));
    await traverse({ limit: 120, until: s => s.step.type === 'question' && !s.step.awaitingContinue && s.step.phase === 'independent' && s.step.target?.skill === 'conjugation' && s.step.target?.person === 0 });
    assert((await question()).answer.some(a => /^mi sono alzat[oa]$/.test(a)));
    await page.locator('[data-answer]').fill('sono alzato');
    await page.locator('[data-check]').click();
    const wrong = (await state()).events.at(-1);
    assert.equal(wrong.ok, false);
    assert(wrong.errorTags.includes('clitic'));
    assert(wrong.components.some(c => c.skill === 'auxiliary' && c.ok));
    await continueLesson(); assert.equal((await state()).step.type, 'repair');
    await continueLesson(); const repair = await question();
    assert(repair.meta.scaffold);
    assert(repair.answer.includes('mi'));
    const result = await answerCorrect();
    assert.equal(result.after.events.at(-1).mode, 'recognition');
    assert.equal(result.after.events.at(-1).entryId, 'v:alzarsi');
  });
  for (const width of [375, 390]) for (const theme of ['light', 'dark']) {
    await check(`${width}px ${theme}: teaching, choices, help, typing and feedback remain usable`, async () => {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 844 });
      await page.evaluate(async theme => { const { store } = await import('./js/store.js'); store.setSetting('theme', theme); }, theme);
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      await gotoRoute(page, entryRoute('verb', 'v:capire', 'present'));
      await auditLayout(`${width}-${theme}-teach`);
      await reachQuestion();
      await reachJourneyActivity(page, 'mc', { expected: q => independentlyExpected(q, 'capire') });
      assert.equal((await question()).type, 'mc');
      await auditLayout(`${width}-${theme}-choice`);
      await page.locator('[data-help]').click();
      await page.locator('[data-show-forms]').click();
      await auditLayout(`${width}-${theme}-help`);
      await answerCorrect();
      await continueLesson();
      await traverse({ limit: 80, until: s => s.step.type === 'question' && !s.step.awaitingContinue && s.step.format === 'type' });
      const q = await question(); assert.equal(q.type, 'type');
      await page.locator('[data-answer]').fill(independentlyExpected(q, 'capire'));
      await auditLayout(`${width}-${theme}-type`);
      const before = (await state()).events.length;
      await page.locator('[data-answer]').press('Enter');
      assert.equal((await state()).events.length, before + 1);
      assert.equal((await state()).step.awaitingContinue, true);
      await auditLayout(`${width}-${theme}-feedback`);
      await page.locator('[data-pause]').click();
      assert.equal((await state()).domPhase, 'paused');
      await auditLayout(`${width}-${theme}-paused`);
      await page.locator('[data-resume]').click();
      assert.equal((await state()).step.awaitingContinue, true);
    });
  }
  await check('A v1 future-stage session resumes its exact saved imperfetto question and history', async () => {
    await gotoRoute(page, '/home');
    const fixture = await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      const { getEntry } = await import('./js/data.js');
      const { createSession } = await import('./js/learning/model.js');
      const { objectivesFor } = await import('./js/learning/curriculum.js');
      const { buildQuestion } = await import('./js/learning/questions.js');
      await store.createProfile('Legacy migration fixture');
      const entry = getEntry('v:vedere'), now = Date.now();
      const objectives = objectivesFor(entry, { stage: 'future', legacyTenses: ['imperfetto'] }).filter(o => o.required !== false && !o.optional);
      const oldOrder = ['meaning', 'presente', 'passatoProssimo', 'imperfetto', 'futuro'];
      objectives.sort((a, b) => oldOrder.indexOf(a.tense) - oldOrder.indexOf(b.tense));
      const objective = objectives.find(o => o.tense === 'imperfetto' && o.skill === 'conjugation');
      const session = createSession({ id: 'v1-future-session', entryId: entry.id, objectiveIds: objectives.map(o => o.id), now, mode: 'lesson' });
      session.activeObjectiveId = objective.id;
      session.ui = { version: 1, phase: 'question', taught: objectives.map(o => o.id), exposures: {}, checkpoint: 0, xp: 0, draft: 'vedevo', hintVisible: true, assistance: ['hint'], current: { objectiveId: objective.id, entryId: entry.id, mode: 'production', variant: 0, repairTag: null, repairPerson: null, spacer: false, reason: 'continue', seed: 20260929, id: 'v1-saved-question', startedAt: now, poolIds: [entry.id] } };
      let seed = session.ui.current.seed >>> 0;
      const rng = () => { seed += 0x6D2B79F5; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
      const q = buildQuestion(entry, objective, { mode: 'production', variant: 0, repairTag: null, repairPerson: null, pool: [entry], allowedTenses: ['presente', 'passatoProssimo', 'imperfetto', 'futuro'], rng });
      const template = document.createElement('template'); template.innerHTML = q.prompt;
      store.recordLearningAttempt({ id: 'pre-upgrade-answer', sessionId: 'older-session', entryId: entry.id, objectiveId: 'v:vedere::presente::conjugation', skill: 'conjugation', kind: 'verb', tense: 'presente', person: 0, mode: 'production', variantId: 'older-io', contextId: 'older-cue', firstAttempt: true, ok: true, outcome: 'correct', assistance: [], errorTags: [], components: [] });
      store.markLearned('v:parlare', 'verb');
      store.addToList('bank', 'w:casa|noun');
      const learning = store.current.learning;
      learning.version = 1;
      learning.preferences = { stage: 'future', expansions: [], updatedAt: now };
      learning.session = session;
      learning.sessions = { [entry.id + '|lesson']: session };
      store.save(); await store.saveNow();
      return { session, events: learning.events, xp: store.current.stats.xp, items: store.current.items, lists: store.current.lists, prompt: template.content.textContent.replace(/\s+/g, ' ').trim() };
    });
    await reloadApp(page);
    await gotoRoute(page, entryRoute('verb', fixture.session.entryId));
    await page.locator('.journey-legacy a').click();
    await page.locator('[data-adaptive]').waitFor();
    const resumed = await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      return { version: store.learning.version, preferences: store.learning.preferences, session: store.learning.session, events: store.learning.events, xp: store.current.stats.xp, items: store.current.items, lists: store.current.lists };
    });
    assert(resumed.version >= 2);
    assert(resumed.preferences.legacyTenses.includes('imperfetto'), 'formerly available tense remains available');
    assert.equal(resumed.session.id, fixture.session.id);
    assert.deepEqual(resumed.session.objectiveIds, fixture.session.objectiveIds, 'the old ordering is preserved');
    assert.deepEqual(resumed.session.ui.current, fixture.session.ui.current, 'question recipe and identity survive the migration');
    assert.equal(await page.locator('[data-question-id]').getAttribute('data-question-id'), 'v1-saved-question');
    assert.equal((await page.locator('.adaptive-prompt').innerText()).replace(/\s+/g, ''), fixture.prompt.replace(/\s+/g, ''), 'the regenerated question text is unchanged');
    assert.equal(await page.locator('[data-answer]').inputValue(), 'vedevo');
    assert(resumed.session.ui.assistance.includes('hint'));
    assert.equal(await page.locator('.adaptive-hint').count(), 1);
    assert.deepEqual(resumed.events, fixture.events);
    assert.equal(resumed.xp, fixture.xp);
    assert.deepEqual(resumed.items, fixture.items);
    assert.deepEqual(resumed.lists, fixture.lists);
    await flush(); await reloadApp(page);
    assert.equal(await page.locator('[data-question-id]').getAttribute('data-question-id'), 'v1-saved-question');
    assert.equal(await page.locator('[data-answer]').inputValue(), 'vedevo');
    await screenshot('legacy-v1-exact-resume-phone');
  });
  await check('No application errors', async () => assert.deepEqual(errors, []));
} catch (error) {
  if (!results.some(r => !r.ok)) results.push({ name: 'Harness startup', ok: false, error: error.stack });
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(TESTS_DIR, 'report-journey-e2e.json'), JSON.stringify({ results, errors, screenshots }, null, 2));
  await browser.close(); stopServer();
}
console.log(`${results.filter(r => r.ok).length}/${results.length} taught-journey browser checks passed.`);
