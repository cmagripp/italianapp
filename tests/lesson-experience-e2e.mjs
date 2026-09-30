#!/usr/bin/env node
// Interaction checks for the taught lesson's exploration and study tools.
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
let context, page;
async function fresh(theme = 'light', width = 390, { height = width === 375 ? 667 : 844, insets = {}, standaloneInset = 0 } = {}) {
  await context?.close();
  context = await browser.newContext(contextOptions(devices['iPhone 13'], { viewport: { width, height }, reducedMotion: 'reduce' }));
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
  await page.evaluate(({insets,standaloneInset}) => {
    for (const [key, value] of Object.entries(insets)) document.documentElement.style.setProperty('--sa' + key, value + 'px');
    if (standaloneInset) {
      Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
      Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>innerHeight-standaloneInset});
    }
  }, {insets,standaloneInset});
  await page.evaluate(async theme => { const { store } = await import('./js/store.js'); store.setSetting('theme', theme); }, theme);
  await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
}
async function check(name, run) {
  if (process.env.EXPERIENCE_FILTER && !name.toLowerCase().includes(process.env.EXPERIENCE_FILTER.toLowerCase()) && name !== 'No application errors') return;
  try { const detail = await run(); results.push({ name, ok: true, detail }); console.log('PASS', name); }
  catch (error) { await shot('failure').catch(()=>{}); const geometry=await page?.evaluate(()=>Object.fromEntries(['#view','.journey-header','.journey-main','.journey-feedback-dock','[data-feedback-bar]','[data-feedback-bar] [data-continue]'].map(s=>[s,document.querySelector(s)?.getBoundingClientRect().toJSON()]))).catch(()=>null); results.push({ name, ok: false, error: error.stack, geometry, visible: await page?.locator('body').innerText().catch(() => '') }); console.error('FAIL', name, error.message,geometry); throw error; }
}
async function evidence() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js'); await store.saveNow();
    return { events: Object.keys(store.learning.events).sort(), xp: store.current.stats.xp, learned: Object.keys(store.current.items).filter(id => store.isLearned(id)).sort() };
  });
}
async function spoken() { return page.evaluate(() => JSON.parse(sessionStorage.getItem('experience-speech') || '[]')); }
async function session() { return page.evaluate(async () => (await import('./js/store.js')).store.learning.session); }
async function question() { return journeyQuestion(page); }

async function reachQuestion() {
  for (let n = 0; n < 15; n++) {
    if (await page.locator('[data-journey]').getAttribute('data-phase') === 'question') return;
    await page.locator('[data-continue]').click();
  }
  throw new Error('No question after teaching');
}
async function answerCorrect() { await solveJourneyQuestion(page, await question()); }
async function openOverviewExamples() {
  const details=page.locator('.journey-overview-meaning');
  if(await details.count()&&!await details.evaluate(e=>e.open))await details.locator('summary').click();
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
async function waitForExample(index) {
  await page.waitForFunction(index => {
    const deck = document.querySelector('.journey-teaching .journey-example-deck'), card = deck?.children[index];
    if (!card) return false;
    const a = card.getBoundingClientRect(), b = deck.getBoundingClientRect();
    return Math.abs((a.left+a.right-b.left-b.right)/2) <= 2;
  }, index, { timeout: 4000 });
}
async function swipeExampleLeft() {
  const deck = page.locator('.journey-teaching .journey-example-deck');
  await deck.scrollIntoViewIfNeeded();
  const box = await deck.boundingBox(), panel = await page.locator('.journey-main').boundingBox();
  const y = Math.max(panel.y + 20, Math.min(box.y + box.height / 2, panel.y + panel.height - 20));
  const x = box.x + box.width - 20, cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i=1;i<=8;i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x:x-(box.width-40)*i/8, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  await waitForExample(1);
}
async function visibleContinue() {
  const button = await page.locator('[data-feedback-bar] [data-continue]').elementHandle(); assert(button);
  await page.waitForFunction(e=>{const r=e.getBoundingClientRect();if(r.y<0||r.bottom>innerHeight+1)return false;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);},button,{timeout:2000});
}
async function withinViewport() {
  const s = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth, x: scrollX, y: scrollY, height: innerHeight, panel: document.querySelector('.journey-main')?.getBoundingClientRect().toJSON(), english: document.querySelector('#enToggle')?.getBoundingClientRect().toJSON() }));
  assert(s.pageWidth <= s.width + 1); assert.equal(s.x, 0); assert.equal(s.y, 0); assert(s.panel.height >= 44); assert(s.panel.bottom <= s.height + 1);
  assert(s.english.right <= s.width + 1, 'English toggle stays inside the viewport');
}

try {
  for (const theme of ['light', 'dark']) {
    await check(`${theme}: Meet pronunciation and translations are exploration, not answers`, async () => {
      await fresh(theme); await gotoRoute(page, '/learn/verb/v:dire');
      const before = await evidence();
      assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'overview');
      await page.locator('.journey-hero-audio').click(); assert.deepEqual(await spoken(), [{ text: 'dire', lang: 'it-IT' }]);
      await openOverviewExamples();
      const example = page.locator('.journey-example').first(), translation = example.locator('[data-translation]'), toggle = example.locator('[data-translation-toggle]');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true'); assert(await translation.isVisible());
      await toggle.click(); assert.equal(await toggle.getAttribute('aria-expanded'), 'false'); assert.equal(await translation.isVisible(), false);
      await toggle.click(); assert.equal(await translation.isVisible(), true);
      await page.locator('.journey-overview-meaning summary').click();
      await page.locator('.journey-main').evaluate(p => { p.scrollTop = 0; });
      assert.deepEqual(await evidence(), before); await withinViewport(); await shot(`${theme}-meet`);
    });
    await check(`${theme}: stacked forms and centered examples support exploration without grading`, async () => {
      await fresh(theme); await gotoRoute(page, '/learn/verb/v:dire?chapter=present');
      assert.equal(await page.locator('[data-journey]').getAttribute('data-chapter'), 'present');
      const before=await evidence(),speechBefore=await spoken(),cards=page.locator('[data-form-card]');
      assert.equal(await cards.count(),3); assert.deepEqual(await cards.locator('.journey-form-value').allTextContents(),['dico','dici','dice']);
      const boxes=await cards.evaluateAll(nodes=>nodes.map(e=>e.getBoundingClientRect().toJSON()));
      for(let i=0;i<boxes.length;i++){assert(boxes[i].height>=44&&boxes[i].height<=100,'forms are compact touch rows');if(i){assert(boxes[i].y>=boxes[i-1].bottom-1);assert(Math.abs(boxes[i].x-boxes[0].x)<1);}}
      assert.equal(await page.locator('[data-form-next], [data-form-prev], .journey-form-comparison').count(),0,'all forms are already shown together');
      await cards.nth(1).click();assert.deepEqual((await spoken()).at(-1),{text:'dici',lang:'it-IT'});assert.equal((await spoken()).length,speechBefore.length+1);
      const afterTap=await spoken();await cards.nth(1).focus();await page.keyboard.press('End');await waitForForm(2);await page.keyboard.press('Home');await waitForForm(0);await page.keyboard.press('ArrowDown');await waitForForm(1);await page.keyboard.press('ArrowUp');await waitForForm(0);await page.keyboard.press('ArrowDown');await waitForForm(1);
      assert.deepEqual(await spoken(),afterTap,'keyboard selection does not pronounce or grade');await shot(`${theme}-present-stacked-forms`);
      const deck=page.locator('.journey-teaching .journey-example-deck');assert.equal(await deck.locator('.journey-example').count(),2);await deck.scrollIntoViewIfNeeded();await waitForExample(0);
      await deck.focus();await page.keyboard.press('End');await waitForExample(1);await page.keyboard.press('Home');await waitForExample(0);await swipeExampleLeft();assert.deepEqual(await spoken(),afterTap,'swiping never triggers accidental audio');await shot(`${theme}-centered-example`);
      const activeExample=deck.locator('.journey-example').nth(1),say=await activeExample.locator('[data-say]').getAttribute('data-say');await activeExample.locator('[data-say]').click();assert.deepEqual((await spoken()).at(-1),{text:say,lang:'it-IT'});assert.equal((await spoken()).length,afterTap.length+1);
      const afterExplore=await spoken();assert.deepEqual(await evidence(),before);await withinViewport();await reloadApp(page);await waitForForm(1);assert.deepEqual(await spoken(),afterExplore);assert.deepEqual(await evidence(),before);
    });
    await check(`${theme}: noun number rows keep the taught article and invariant plural`, async () => {
      await fresh(theme);await gotoRoute(page, '/learn/word/'+encodeURIComponent('w:caffè|noun')+'?chapter=forms');
      const before=await evidence();assert.deepEqual(await page.locator('[data-form-card] .journey-form-value').allTextContents(),['il caffè','i caffè']);
      assert.equal(await page.locator('.journey-form-comparison').count(),0);await page.locator('[data-form-card]').last().scrollIntoViewIfNeeded();await shot(`${theme}-noun-number-rows`);assert.deepEqual(await evidence(),before);await withinViewport();
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
      await openOverviewExamples();
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
      await gotoRoute(page, '/learn/verb/v:capire?chapter=present'); await reachJourneyActivity(page, 'mc');
      const before = await evidence(); await answerCorrect();
      const right = await evidence(); assert.equal(right.events.length, before.events.length + 1);
      assert.equal((await session()).ui.result.ok, true); await visibleContinue(); await shot(`${theme}-correct-feedback`);
      await page.waitForTimeout(500); assert.deepEqual(await evidence(), right);
      assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'feedback');
      await page.locator('[data-continue]').click(); await reachJourneyActivity(page, 'type');
      assert.equal((await question()).type, 'type');
      const beforeWrong = await evidence();
      await page.locator('[data-answer]').fill('sbagliato'); await page.locator('[data-check]').click();
      const wrong = await evidence(); assert.equal(wrong.events.length, beforeWrong.events.length + 1);
      assert.equal((await session()).ui.result.ok, false); await visibleContinue(); await shot(`${theme}-wrong-feedback`);
      await reloadApp(page); assert.deepEqual(await evidence(), wrong);
      assert.equal(await page.locator('[data-journey]').getAttribute('data-phase'), 'feedback');
    });
  }
  const geometryCases = [
    ...[375,390].flatMap(width => ['light','dark'].map(theme => ({width,height:width===375?667:844,theme}))),
    {width:320,height:568,theme:'light'},
    {width:667,height:320,theme:'dark'},
    {width:390,height:844,theme:'dark',insets:{t:47,b:34},standaloneInset:34},
    {width:667,height:320,theme:'light',insets:{l:44,r:44,b:21}},
  ];
  for(const fixture of geometryCases) {
    const {width,height,theme,insets={},standaloneInset=0}=fixture, label=`${width}x${height}-${theme}${Object.keys(insets).length?'-safe-area':''}`;
    await check(`${label}: edge scrolling, usable bottom and anchored info remain accessible`,async()=>{
      await fresh(theme,width,{height,insets,standaloneInset});await gotoRoute(page,'/learn/verb/v:capire?chapter=present');await withinViewport();
      const g=await page.evaluate(()=>{
        const r=s=>document.querySelector(s).getBoundingClientRect().toJSON(),page=document.querySelector('[data-journey]'),main=document.querySelector('.journey-main'),cs=getComputedStyle(page);
        return{view:r('#view'),page:r('[data-journey]'),main:r('.journey-main'),header:r('.journey-header'),info:r('[data-conjugation-toggle]'),en:r('#enToggle'),dock:r('.journey-action-dock'),action:r('[data-action-track] [data-continue]'),border:cs.borderTopWidth,shadow:cs.boxShadow,background:cs.backgroundColor,overflow:getComputedStyle(main).overflowY};
      });
      assert.equal(g.border,'0px');assert.equal(g.shadow,'none');assert.equal(g.background,'rgba(0, 0, 0, 0)');assert(g.header.height<=110,'header leaves room for teaching');
      assert(Math.abs(g.main.x)<=1&&Math.abs(g.main.right-width)<=1,'the actual scrolling box and scrollbar reach both viewport edges');assert.equal(g.overflow,'auto');
      assert(Math.abs(g.view.bottom-height)<=1&&Math.abs(g.dock.bottom-height)<=1,'the lesson and footer fill the viewport height');
      assert(Math.abs(g.main.bottom-g.dock.y)<=1,'no unused strip separates scrolling content and footer');
      assert(Math.abs(g.action.bottom-(height-Math.max(8,insets.b||0)))<=1,'action ends at the usable safe-area bottom with only intended clearance');
      assert(Math.abs(g.info.height-g.info.width)<=1&&g.info.width>=40,'info is a circular topbar control');assert(g.info.right<=g.en.x-4&&g.en.x-g.info.right<=12,'info sits immediately beside EN');assert(Math.abs(g.info.y-g.en.y)<=1);
      assert.equal(await page.locator('.journey-table-tab').count(),0,'the old side tab is gone');assert.equal(await page.locator('#backBtn').isVisible(),false);assert.equal(await page.locator('[data-map-toggle]').count(),0);
      const stack=await page.locator('[data-form-track]').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,rect:e.getBoundingClientRect().toJSON()}));assert(stack.scroll<=stack.width+1,'stacked forms have no horizontal scroller');assert(stack.rect.x>=Math.max(16,insets.l||0)-1&&stack.rect.right<=width-Math.max(16,insets.r||0)+1,'content is padded inside the edge scroller');
      await shot(`${label}-edge-teaching`);
      const headerBefore=await page.locator('.journey-header').boundingBox();await page.locator('.journey-main').evaluate(e=>{e.scrollTop=e.scrollHeight;});
      assert(await page.locator('.journey-main').evaluate(e=>e.scrollTop>0),'teaching really scrolls within the edge box');assert.deepEqual(await page.locator('.journey-header').boundingBox(),headerBefore,'scrolling never moves the header');
      const deck=page.locator('.journey-teaching .journey-example-deck');await deck.scrollIntoViewIfNeeded();await waitForExample(0);await deck.focus();await page.keyboard.press('End');await waitForExample(1);await withinViewport();await shot(`${label}-example-centered`);
      const beforeExplore=await evidence();await page.locator('[data-conjugation-toggle]').click();const menu=page.locator('.journey-conjugation-dropdown');assert(await menu.isVisible());
      const menuBox=await menu.boundingBox();assert(menuBox.x>=Math.max(8,insets.l||0)-1&&menuBox.x+menuBox.width<=width-Math.max(8,insets.r||0)+1,'dropdown stays inside horizontal safe areas');assert(menuBox.y>=g.info.bottom-1&&menuBox.y-g.info.bottom<=16,'dropdown is anchored below info');assert(menuBox.y+menuBox.height<=height-Math.max(8,insets.b||0)+1,'dropdown fits the usable viewport height');
      await shot(`${label}-info-dropdown`);await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});assert.equal(await menu.isVisible(),false);assert.deepEqual(await evidence(),beforeExplore,'exploring the table creates no learning evidence');
      await page.locator('[data-continue]').click();await reachJourneyActivity(page,'mc');
      const questionBox=await page.locator('.journey-main').boundingBox();assert(Math.abs(questionBox.y+questionBox.height-height)<=1,'the question scroll area extends to the viewport bottom when it has no footer');
      await answerCorrect();await visibleContinue();await withinViewport();
      const feedback=await page.locator('.journey-feedback-dock').boundingBox(),button=await page.locator('[data-feedback-bar] [data-continue]').boundingBox();
      assert(Math.abs(feedback.y+feedback.height-height)<=1,'feedback footer fills the bottom without the old reserved gap');assert(Math.abs(button.y+button.height-(height-Math.max(8,insets.b||0)-12))<=1,'Continue keeps only safe-area padding plus the feedback card inset');
      await shot(`${label}-visible-continue`);
    });
  }
  await check('The anchored conjugation dropdown preserves the draft, help and accessible dismissal', async () => {
    await fresh();
    await gotoRoute(page, '/learn/verb/v:credere?mode=review&objective=' + encodeURIComponent('v:credere::lesson::present::form-0'));
    await reachQuestion(); const q = await question(); assert.equal(q.type, 'type'); assert(q.answer.includes('credo'));
    await page.locator('[data-answer]').fill('cre');
    const before = await evidence(), initial = await session();
    assert(!initial.ui.assistance.includes('visible-form'));
    await page.locator('[data-conjugation-toggle]').click();
    const panel = page.locator('.journey-conjugation-dropdown'); assert(await panel.isVisible()); assert.equal(await panel.getAttribute('role'),'dialog');
    assert.equal(await page.locator('[data-conjugation-toggle]').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('dialog.journey-conjugation-panel').count(),0,'verb forms use an anchored dropdown rather than a native dialog');
    assert.match(await panel.innerText(), /credo/);
    await panel.locator('[data-conjugation-tense="futuro"]').click(); assert.match(await panel.innerText(), /crederò/);
    await shot('conjugation-info-dropdown');
    await panel.locator('.journey-conjugation-content').focus(); await page.keyboard.press('Tab');
    assert.equal(await panel.locator('[data-conjugation-close]').evaluate(e=>e===document.activeElement),true,'Tab stays inside the open dropdown');
    await page.keyboard.press('Shift+Tab'); assert.equal(await panel.locator('.journey-conjugation-content').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Escape');
    await panel.waitFor({state:'hidden'}); assert.equal(await panel.isVisible(),false); assert.equal(await page.locator('[data-conjugation-toggle]').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('[data-conjugation-toggle]').evaluate(e=>e===document.activeElement),true,'Escape returns focus to the info button');
    await page.locator('[data-conjugation-toggle]').click(); assert(await panel.isVisible());
    const outside=await page.locator('.journey-header').boundingBox(); await page.mouse.click(outside.x+4,outside.y+4);
    await panel.waitFor({state:'hidden'}); assert.equal(await panel.isVisible(),false); assert.equal(await page.locator('[data-conjugation-toggle]').evaluate(e=>e===document.activeElement),true,'outside dismissal returns focus');
    assert.equal(await page.locator('[data-answer]').inputValue(), 'cre');
    assert((await session()).ui.assistance.includes('visible-form')); assert.deepEqual(await evidence(), before);
    await page.locator('[data-answer]').fill('credo'); await page.locator('[data-check]').click();
    const e = await page.evaluate(async () => Object.values((await import('./js/store.js')).store.learning.events).at(-1));
    assert.equal(e.ok, true); assert(e.assistance.includes('visible-form'));
    assert.equal((await evidence()).events.length, before.events.length + 1);
    await shot('correct-answer-feedback');
    await gotoRoute(page,'/home'); assert.equal(await page.locator('[data-conjugation-toggle], .journey-conjugation-dropdown').count(),0,'leaving the lesson removes its topbar control and dropdown');
  });
  await check('An active-question word lookup is recorded as help and keeps the answer draft', async () => {
    await fresh(); await gotoRoute(page, '/learn/verb/v:capire?chapter=present'); await reachJourneyActivity(page, 'mc');
    await answerCorrect(); await page.locator('[data-continue]').click(); await reachJourneyActivity(page, 'type');
    assert.equal((await question()).type, 'type');
    await page.locator('[data-answer]').fill('cap');
    const before = await evidence(); assert(!(await session()).ui.assistance.includes('hint'));
    const prompt = (await question()).prompt;
    const fixture = prompt.includes('domanda')
      ? { word:'domanda', singular:'la domanda', exposed:['question','la','le','domanda','domande'] }
      : { word:'problema', singular:'il problema', exposed:['problem','il','i','problema','problemi'] };
    assert(prompt.includes(fixture.word), 'a separately checked authored noun is available in the rotated prompt');
    await page.locator(`.journey-prompt [data-lookup-word="${fixture.word}"]`).click();
    assert((await page.locator('dialog.journey-word-dialog').innerText()).includes(fixture.singular));
    await page.locator('dialog.journey-word-dialog [data-word-close]').first().click();
    assert.equal(await page.locator('[data-answer]').inputValue(), 'cap');
    const lookedUp=await session();
    assert(lookedUp.ui.assistance.includes('hint')); assert.deepEqual(await evidence(), before);
    for(const form of fixture.exposed) assert.equal(lookedUp.ui.exposures[form],lookedUp.index||0, `${form} remains recently exposed for following questions`);
    await page.locator('[data-answer]').fill('sbagliato'); await page.locator('[data-check]').click();
    assert.equal((await session()).ui.result.ok, false); await visibleContinue(); await shot('wrong-answer-feedback');
  });
  await check('Lesson Back is read-only and returns to the exact unanswered draft without extra evidence', async () => {
    await fresh(); await gotoRoute(page, '/learn/verb/v:capire?chapter=present'); await reachJourneyActivity(page, 'mc');
    await answerCorrect(); await page.locator('[data-continue]').click(); await reachJourneyActivity(page, 'type');
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
