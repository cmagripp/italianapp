import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BASE, loadPlaywright, launchBrowser, ensureServer, contextOptions } from './lib.mjs';
const { chromium, webkit } = await loadPlaywright(), stop = await ensureServer();
const browserName = process.env.COURSE_BROWSER || 'chromium';
const browser = browserName === 'webkit' ? await webkit.launch() : await launchBrowser(chromium);
const context = await browser.newContext(contextOptions()), page = await context.newPage(), checks = [];
await context.addInitScript(()=>{
  window.__studySpeech=[];
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class {constructor(text){this.text=text;}}});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices(){return[];},addEventListener(){},removeEventListener(){},speak(utterance){window.__studySpeech.push({text:utterance.text,lang:utterance.lang});}}});
});
const speech=()=>page.evaluate(()=>window.__studySpeech);
const check = async (name, action) => { await action(); checks.push(name); console.log('PASS', name); };
const panel = () => page.locator('.sheet-wrap.open').getByRole('dialog', { name: 'Practise this conversation', exact: true });
let activeThread = null,passed=false;
async function seed(threadId, text) {
  activeThread = threadId;
  await page.goto(BASE + '#/conversations'); await page.locator('[data-new-conversation]').waitFor();
  await page.evaluate(async ({ threadId, text }) => {
    const { store } = await import('./js/store.js'), { createConversationRepository } = await import('./js/conversations/storage.js');
    window.studyStore = store; window.studyRepo?.close(); window.studyRepo = createConversationRepository({ profileId: store.current.id, learnerId: store.current.learnerId }); window.studyThread = threadId;
    await studyRepo.createThread({ name: 'Ada', level: 'A2', participants: [{ id: 'partner', name: 'Giulia' }] }, { threadId, title: 'Study fixture' });
    await studyRepo.commitTurn(threadId, { turnId: 'source', role: 'learner', participantId: 'learner', originalText: text });
  }, { threadId, text });
  await page.goto(BASE + '#/conversations/' + threadId); await page.locator('[data-summary]').waitFor();
}
async function open() { await state(); await page.locator('[data-summary]').click(); await page.locator('.sheet-wrap.open [data-practice-summary]').first().waitFor();assert.equal(await page.locator('.sheet-wrap.open [data-practice-summary]').count(),1,'Only the current conversation listener may open notes');await page.locator('.sheet-wrap.open [data-practice-summary]').click(); await panel().waitFor(); }
async function begin(format = 'choice') { await panel().locator(`[name=study-format][value=${format}]`).check(); await panel().locator('[data-study-begin]').click(); await panel().locator('[data-study-next]').waitFor(); }
const state = () => page.evaluate(async threadId => {
  const { store } = await import('./js/store.js'), { createConversationRepository } = await import('./js/conversations/storage.js');
  window.studyStore = store; window.studyThread = threadId;
  if (!window.studyRepo) window.studyRepo = createConversationRepository({ profileId: store.current.id, learnerId: store.current.learnerId });
  return studyRepo.read(threadId);
}, activeThread);
const evidence = () => page.evaluate(async () => { const { store } = await import('./js/store.js'); window.studyStore = store;
  return { events: Object.values(store.learning.events), completions: store.learning.completions, items: store.current.items }; });
async function answerCorrect(targetIndex = 0) {
  const saved = await state(), plan = JSON.parse(saved.summary.studyState.fingerprint), target = plan.targets[targetIndex];
  const index = target.question.choices.findIndex(c => c.correct);
  await panel().locator(`[data-study-choice="${index}"]`).click(); await panel().locator('[data-study-next]').filter({ hasNot: page.locator('[disabled]') }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-study-next]')?.disabled);
  return target;
}
try {
  await check('A single encountered word opens selected in-place study without generation, routing or exposure evidence', async () => {
    await seed('study-one', 'casa'); await open(); assert.equal(await panel().locator('[data-study-select]').count(), 1);
    const before = await evidence(); await begin(); assert.equal((await evidence()).events.length, before.events.length);
    assert.equal(await page.evaluate(() => location.hash), '#/conversations/study-one');
    const readiness = await page.evaluate(async () => (await import('./js/conversations/runtime.js')).conversationReadiness()); assert.equal(readiness.written, false);
  });
  await check('A real choice records one supported recognition event and no learned status or unlearned review', async () => {
    const before = (await evidence()).events.length, target = await answerCorrect();
    const after = await evidence(); assert.equal(after.events.length, before + 1);
    const event = after.events.at(-1); assert.equal(event.entryId, target.entryId); assert.equal(event.mode, 'recognition'); assert(event.assistance.includes('conversation-study'));
    assert(event.contextId.includes('"turnId":"source"')); assert.equal(event.tense, null); assert.equal(after.items[target.entryId]?.learned || false, false);
    assert.equal(Object.keys(after.completions).length, 0);
    const reviews = await page.evaluate(async () => (await import('./js/learning/integration.js')).eligibleSkills(studyStore)); assert.equal(reviews.length, 0);
    assert.equal((await speech()).at(-1).text,'casa');
  });
  await check('Reload restores exact feedback without recording it again and returns to the same conversation', async () => {
    const before = (await evidence()).events.length, saved = await state(); await page.reload(); await page.locator('[data-summary]').waitFor(); await open();
    assert.equal(await panel().locator('[data-study-choice]:disabled').count(), 4); assert.equal((await evidence()).events.length, before);
    assert.equal((await state()).summary.studyState.sessionId, saved.summary.studyState.sessionId);
    assert.deepEqual(await speech(),[],'Restored success feedback must not autoplay');
    await panel().locator('[data-study-next]').click(); await panel().locator('[data-study-return]').click(); assert.equal(await page.evaluate(() => location.hash), '#/conversations/study-one');
  });
  await check('Flashcard exposure and saving do not create assessment or completion', async () => {
    await seed('study-cards', 'libro'); await open(); const before = (await evidence()).events.length;
    await begin('cards'); await panel().locator('[data-study-flip]').click(); await page.waitForFunction(() => !document.querySelector('[data-study-next]')?.disabled);
    await panel().locator('[data-study-next]').click(); await panel().locator('[data-study-return]').click(); assert.equal((await evidence()).events.length, before);
  });
  await check('Present verb selection stays on the encountered person/tense and double activation records only once', async () => {
    await seed('study-verb', 'studio'); await open(); await begin(); const saved = await state(), p = JSON.parse(saved.summary.studyState.fingerprint), target = p.targets[0];
    assert.equal(target.observed.tense, 'presente'); assert.equal(target.question.meta.person, 0); assert.equal(target.question.meta.diagnostic.tenseForms.length, 0);
    const before = (await evidence()).events.length, index = target.question.choices.findIndex(c => c.correct);
    await page.evaluate(index => { const button = document.querySelector(`[data-study-choice="${index}"]`); button.click(); button.click(); }, index);
    await page.waitForFunction(() => !document.querySelector('[data-study-next]')?.disabled);
    const after = await evidence(); assert.equal(after.events.length, before + 1); assert.equal(after.events.at(-1).tense, 'presente');
    assert.equal(Object.keys(after.completions).length, 0);
  });
  await check('Two selected items use the shared matching controls and each real match records its source target', async () => {
    await seed('study-pairs', 'casa libro'); await open(); await begin('match'); const before = (await evidence()).events.length;
    const saved = await state(), p = JSON.parse(saved.summary.studyState.fingerprint), q = p.activities[0].question;
    for (const pair of q.pairs) {
      const tile = q.rightTiles.find(t => t.text === pair.canonical);
      await panel().locator(`[data-pair-left="${pair.id}"]`).click();
      const target=p.targets.find(t=>t.id===pair.targetId);await page.waitForFunction(word=>window.__studySpeech.some(call=>call.text===word),target.word);
      await panel().locator(`[data-pair-right="${tile.id}"]`).click();
      await page.waitForFunction(id => document.querySelector(`[data-pair-left="${id}"]`)?.classList.contains('is-matched'), pair.id);
    }
    assert.equal((await evidence()).events.length, before + 2); await page.waitForFunction(() => !document.querySelector('[data-study-next]')?.disabled);
    await page.reload(); await page.locator('[data-summary]').waitFor(); await open(); assert.equal(await panel().locator('.journey-pair-label.is-matched').count(), 2);
    assert.equal((await evidence()).events.length, before + 2);
    assert.deepEqual(await speech(),[],'Restored matches must not autoplay');
  });
  await check('Success speaks canonical Italian only; the incorrect quoted source is heard only on request',async()=>{
    const original='Ho andata a casa.';await seed('study-original',original);await open();await begin();await answerCorrect();
    const calls=await speech();assert(calls.length>0);assert.equal(calls.some(call=>call.text===original),false);
    await panel().getByText('See the original sentence',{exact:true}).click();await panel().getByRole('button',{name:'Hear original',exact:true}).click();
    await page.waitForFunction(text=>window.__studySpeech.some(call=>call.text===text),original);
    assert.equal((await speech()).at(-1).text,original);
  });
  await check('Tapping an Italian matching form speaks that form without recording an answer before its label is selected',async()=>{
    await seed('study-verb-pairs','studio mangio');await open();await begin('match');const saved=await state(),p=JSON.parse(saved.summary.studyState.fingerprint),q=p.activities[0].question;
    assert.equal(p.activities[0].type,'pairs');const pair=q.pairs[0],tile=q.rightTiles.find(t=>t.text===pair.canonical),before=(await evidence()).events.length;
    await panel().locator(`[data-pair-right="${tile.id}"]`).click();await page.waitForFunction(text=>window.__studySpeech.some(call=>call.text===text),tile.text);assert.equal((await evidence()).events.length,before);
    await panel().locator(`[data-pair-left="${pair.id}"]`).click();await page.waitForFunction(id=>document.querySelector(`[data-pair-left="${id}"]`)?.classList.contains('is-matched'),pair.id);assert.equal((await evidence()).events.length,before+1);
  });
  await check('A source edit during practice rejects stale assessment before recording evidence', async () => {
    await seed('study-edit', 'casa'); await open(); await begin(); const before = (await evidence()).events.length;
    await page.evaluate(() => studyRepo.reviseTurn(studyThread, 'source', { displayText: 'libro', expectedRevision: 1 }));
    await panel().locator('[data-study-choice]').first().click(); await panel().getByRole('alert').filter({ hasText: 'changed' }).waitFor();
    assert.equal((await evidence()).events.length, before); await panel().locator('[data-study-return]').click();
  });
  await check('A saved assessment survives failed study-UI persistence and retry cannot duplicate or rewrite the answer',async()=>{
    await seed('study-retry','casa');await open();await begin();const initial=await state(),before=(await evidence()).events.length;
    await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.failStudyUIOnce=true;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='summaries'&&value.studyState&&Object.keys(value.studyState.answers).length&&window.failStudyUIOnce){window.failStudyUIOnce=false;throw new DOMException('Study UI quota failure','QuotaExceededError');}return put.call(this,value,...args);};});
    const target=await answerCorrect();await panel().getByRole('alert').filter({hasText:'quota failure'}).waitFor();
    assert.equal((await evidence()).events.length,before+1);assert.equal(Object.keys((await state()).summary.studyState.answers).length,0);
    await page.reload();await page.locator('[data-summary]').waitFor();await open();assert.equal((await state()).summary.studyState.sessionId,initial.summary.studyState.sessionId);
    const wrong=target.question.choices.findIndex(c=>!c.correct);await panel().locator(`[data-study-choice="${wrong}"]`).click();await page.waitForFunction(()=>!document.querySelector('[data-study-next]')?.disabled);
    assert.equal((await evidence()).events.length,before+1);const answer=Object.values((await state()).summary.studyState.answers)[0];assert.equal(answer.ok,true);assert.equal(answer.given,target.question.choices.find(c=>c.correct).value);
  });
  await check('Imported session-ID collisions cannot redirect old evidence to another source; a fresh selection recovers',async()=>{
    await seed('study-collision','casa');await open();await begin();const saved=await state(),p=JSON.parse(saved.summary.studyState.fingerprint),target=p.targets[0];
    await page.evaluate(async({sessionId,target})=>{const {store}=await import('./js/store.js');store.recordLearningAttempt({...target.question.meta,id:`${sessionId}:${target.id}:0`,sessionId,at:Date.now(),mode:'recognition',activityKind:'guided',contextId:'other-conversation-source',assistance:['conversation-study'],firstAttempt:true,ok:true,outcome:'correct',xp:0});await store.saveNow();},{sessionId:saved.summary.studyState.sessionId,target});
    const before=(await evidence()).events.length;await panel().locator('[data-study-choice]').first().click();await panel().getByRole('alert').filter({hasText:'different answer'}).waitFor();assert.equal((await evidence()).events.length,before);
    await panel().locator('[data-study-again]').click();await panel().locator('[data-study-begin]').waitFor();await begin();assert.notEqual((await state()).summary.studyState.sessionId,saved.summary.studyState.sessionId);
  });
  await check('Navigation and profile changes dismiss study without adding assessment or returning to an old thread', async () => {
    await seed('study-owner', 'casa'); await open(); await begin(); const before = (await evidence()).events.length;
    await page.evaluate(async () => { const { navigate } = await import('./js/app.js'); navigate('#/conversations'); });
    await page.locator('[data-new-conversation]').waitFor(); assert.equal(await page.locator('.sheet-wrap.open').count(), 0); assert.equal((await evidence()).events.length, before);
    await page.goto(BASE + '#/conversations/study-owner'); await page.locator('[data-summary]').waitFor(); await open();
    await page.evaluate(() => studyStore.createProfile('Other learner')); await page.locator('[data-new-conversation]').waitFor();
    assert.equal(await page.locator('.sheet-wrap.open').count(), 0); assert.equal((await evidence()).events.length, 0);
  });
  passed=true;
} finally {
  fs.writeFileSync(`docs/implementation/programme/ai-conversation-study-${browserName}.json`, JSON.stringify({ browser: browserName,
    scope: 'Real browser UI/storage/canonical assessment with committed test messages and captured shared speech calls; no production model or audible/device speech quality claim', passed,checks }, null, 2));
  await context.close(); await browser.close(); stop();
}
