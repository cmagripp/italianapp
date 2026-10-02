#!/usr/bin/env node
// Browser suite for the sentence workshop (Officina delle frasi, docs/SENTENCE-LAB-CONTRACT.md §7): the path page and
// the Laboratorio card, one full lesson (Chi sono) with a free Italian entry and its three drills, the conversation turn
// by turn and "Say it yourself", a second lesson (Come stai?) with a free English entry through the picker, Pause,
// reload and Resume, then persistence, export, reset and the merge of lab records. Every screen is photographed in both
// themes at 430×932 into LAB_SHOTS_DIR (default tests/shots/).
//
//   PLAYWRIGHT_DIR=… node tests/sentence-lab-e2e.mjs            everything
//   LAB_FILTER=resume node tests/sentence-lab-e2e.mjs            only checks whose name contains the filter
//
// Exit code 1 when a check fails. JSON report: tests/report-sentence-lab.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, reloadApp, settle, wait, writeReport, SHOTS_DIR, ms, pad } from './lib.mjs';

const SHOTS = process.env.LAB_SHOTS_DIR || SHOTS_DIR;
const FILTER = (process.env.LAB_FILTER || '').toLowerCase();
const LESSON_1 = 'sl-presente-01-chi-sono', LESSON_6 = 'sl-presente-06-come-stai';
const { chromium, devices } = await loadPlaywright();
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const results = [], errors = [], shots = [];
let context = null, page = null;
fs.mkdirSync(SHOTS, { recursive: true });

// ---------- harness ----------
async function fresh() {
  await context?.close();
  context = await browser.newContext(contextOptions(devices['iPhone 13'], { viewport: { width: 430, height: 932 }, reducedMotion: 'reduce' }));
  page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', e => errors.push(`PAGEERROR ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g(oogleapis|static)\.com/.test(m.location()?.url || '')) errors.push(m.text()); });
  page.on('response', r => { const u = r.url(); if (/127\.0\.0\.1:8123/.test(u) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${u}`); });
  await boot(page);
  await page.evaluate(async () => { const { store } = await import('./js/store.js'); store.setSetting('theme', 'dark'); store.setSetting('tts', false); });
}
async function check(name, run) {
  if (FILTER && !name.toLowerCase().includes(FILTER)) return;
  const t0 = Date.now();
  try { const detail = await run(); results.push({ name, ok: true, ms: Date.now() - t0, detail }); console.log(`  ✓ ${pad(name, 46)} ${pad(ms(Date.now() - t0), 7)} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); }
  catch (error) {
    const visible = await page?.evaluate(() => (document.querySelector('#view')?.innerText || '').replace(/\s*\n+\s*/g, ' | ').slice(0, 400)).catch(() => '');
    results.push({ name, ok: false, ms: Date.now() - t0, error: error.stack, visible });
    console.error(`  ✗ ${pad(name, 46)} ${error.message.split('\n')[0]}\n    on screen: ${visible}`);
    try { await page.screenshot({ path: path.join(SHOTS, `lab-fail-${name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.png`) }); } catch { /* ignore */ }
    throw error;
  }
}
const $ = sel => page.locator(sel).first();
const count = sel => page.locator(sel).count();
async function click(sel, { timeout = 3000 } = {}) { await $(sel).click({ timeout }); }
async function clickText(sel, text) {
  const loc = page.locator(sel).filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first();
  await loc.click({ timeout: 3000 });
}
const text = sel => page.locator(sel).first().innerText().catch(() => '');
// textContent: innerText follows text-transform (the mono counters are uppercase on screen)
const tc = sel => page.locator(sel).first().textContent().then(t => String(t || '').replace(/\s+/g, ' ').trim()).catch(() => '');
const kind = () => page.evaluate(() => document.querySelector('[data-lab-lesson]')?.dataset.kind || null);
async function expectKind(k) { await page.waitForFunction(k => document.querySelector('[data-lab-lesson]')?.dataset.kind === k, k, { timeout: 5000 }); }
async function feedbackState() { await page.waitForSelector('[data-feedback-bar]', { timeout: 4000 }); return page.evaluate(() => ({ state: document.querySelector('[data-feedback-bar]')?.dataset.feedbackState, title: document.querySelector('[data-feedback-bar] .fb-title')?.textContent.trim(), detail: document.querySelector('[data-feedback-bar] .detail')?.innerText.replace(/\s+/g, ' ').trim() })); }
async function next() { await click('[data-lab-next]'); await wait(120); }
async function checkAnswer() { await click('[data-lab-check]:not([disabled])'); await wait(120); }
async function state() {
  return page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    await store.saveNow();
    const lab = JSON.parse(JSON.stringify(store.labRecord('frasi')));
    const sessions = Object.fromEntries(Object.entries(store.learning.sessions || {}).filter(([k]) => k.startsWith('lab:frasi:')).map(([k, s]) => [k, { phase: s.phase, index: s.index, paused: !!s.paused, kind: s.state?.kind || null, turnIndex: s.state?.turnIndex ?? null }]));
    const events = Object.values(store.learning.events || {}).filter(e => e.policy === 'journey-v1' && /:drill:/.test(e.id)).map(e => ({ entryId: e.entryId, skill: e.skill, ok: e.ok, mode: e.mode, objectiveId: e.objectiveId, activityKind: e.activityKind }));
    return { lab, sessions, events, xp: store.current.stats.xp, learned: store.learnedIds().filter(id => !id.startsWith('v:')), hash: location.hash };
  });
}
async function shotPair(name) {
  for (const theme of ['dark', 'light']) {
    await page.evaluate(async t => { const { store } = await import('./js/store.js'); store.setSetting('theme', t); }, theme);
    await page.waitForFunction(t => document.documentElement.dataset.theme === t, theme, { timeout: 3000 });
    await wait(220);
    const file = path.join(SHOTS, `${name}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: false, animations: 'disabled', timeout: 15000 });
    shots.push(file);
  }
  await page.evaluate(async () => { const { store } = await import('./js/store.js'); store.setSetting('theme', 'dark'); });
  await wait(120);
}

// ---------- activity drivers ----------
async function buildOrder(sentence) {
  for (const word of sentence.split(/\s+/)) await clickText('[data-lab-token]:not([disabled])', word);
}
async function fillBlank(i, option) {
  await click(`[data-lab-blank="${i}"]`);
  await click(`[data-lab-option="${option}"][data-blank="${i}"]`);
}
async function typeFreeWord(i, word) {
  await click(`[data-lab-blank="${i}"]`);
  if ((await page.locator(`[data-lab-free="${i}"]`).getAttribute('aria-expanded')) !== 'true') await click(`[data-lab-free="${i}"]`);
  await $(`[data-lab-free-input="${i}"]`).fill(word);
  await click(`[data-lab-free-submit="${i}"]`);
}
// The three drills of a new word, answered correctly: meaning (English choice), recall (Italian choice), type it.
async function passDrills({ meaning, italian, typed, shot = null }) {
  await page.waitForSelector('[data-drill="intro"]', { timeout: 4000 });
  if (shot) await shotPair(shot);
  await click('[data-drill-start]');
  await page.waitForSelector('[data-drill="meaning"]');
  // the choice's label span: the button itself also carries its A/B/C marker
  await clickText('[data-drill="meaning"] .choice:not([disabled]) > span:last-child', meaning);
  assert.equal((await feedbackState()).state, 'correct', 'meaning drill graded correct');
  await click('[data-drill-next]');
  await page.waitForSelector('[data-drill="recall"][data-step="2"]');
  await clickText('[data-drill="recall"] .choice:not([disabled]) > span:last-child', italian);
  assert.equal((await feedbackState()).state, 'correct', 'recall drill graded correct');
  await click('[data-drill-next]');
  await page.waitForSelector('[data-drill-input]');
  await $('[data-drill-input]').fill(typed);
  await click('[data-drill-check]:not([disabled])');
  assert.equal((await feedbackState()).state, 'correct', 'type-it drill graded correct');
  await click('[data-drill-next]');
  await page.waitForSelector('[data-drill="done"]', { timeout: 4000 });
  await click('[data-drill-done]');
  await page.waitForSelector('[data-drill]', { state: 'detached', timeout: 4000 }).catch(() => {});
  await wait(150);
}
async function sendTurn(expectReaction) {
  const before = await count('[data-speaker="you"]:not(.is-pending)');
  await click('[data-lab-check]:not([disabled])');
  await page.waitForFunction(n => document.querySelectorAll('[data-speaker="you"]:not(.is-pending)').length > n, before, { timeout: 4000 });
  const reaction = await page.evaluate(() => [...document.querySelectorAll('[data-reaction]')].at(-1)?.querySelector('p[lang="it"]')?.textContent.trim());
  if (expectReaction) assert.equal(reaction, expectReaction, 'the partner reacts to the chosen reply');
  return reaction;
}

// ---------- the checks ----------
console.log(`Officina delle frasi · browser suite · screenshots into ${SHOTS}`);
try {
  await check('path page: header, four stages, first lesson next, tools', async () => {
    await fresh();
    await gotoRoute(page, '/lab/frasi');
    await page.waitForSelector('[data-lab-page]');
    const head = await text('.lab-hero');
    assert.match(head, /Officina delle frasi/); assert.match(head, /Sentence workshop/);
    assert.equal(await count('.lab-stage'), 4, 'four stages');
    const states = await page.$$eval('.lab-lesson', els => els.map(e => e.dataset.state));
    assert.equal(states[0], 'next'); assert.ok(states.slice(1).every(s => s === 'locked'), 'every other lesson is locked');
    assert.equal(await count('.lab-lesson[data-state="locked"] a'), 0);
    assert.ok(await count('[data-lab-fit]') === 1 && await count('[data-lab-assistant]') === 1, 'the two tool switches');
    assert.ok(await count('[data-lab-gender]') === 2, 'the speaker gender control');
    assert.equal(await count('[data-lab-resume]'), 0, 'no resume card without a session');
    assert.match(await tc('[data-lab-progress]'), /0 \/ \d+ lessons/);
    await shotPair('path');
    await click('[data-lab-gender="f"]');
    const gender = await page.evaluate(async () => (await import('./js/store.js')).store.settings.gender);
    assert.equal(gender, 'f');
    await click('[data-lab-gender="m"]');
    return `${states.length} lessons · tools ${await text('[data-fit-status]').then(t => t.slice(0, 40))}…`;
  });

  await check('laboratorio card: first in the Learn hub reel', async () => {
    await gotoRoute(page, '/learn');
    await page.waitForSelector('.lc[data-key="frasi"]', { timeout: 6000 });
    const card = await page.$eval('.lc[data-key="frasi"]', a => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\s+/g, ' ').trim(), first: a.parentElement.querySelector('.lc') === a }));
    assert.equal(card.href, '#/lab/frasi'); assert.match(card.text, /Officina delle frasi/); assert.match(card.text, /Build sentences/); assert.ok(card.first, 'the workshop is the first Laboratorio card');
    await click('.lc[data-key="frasi"]'); await settle(page);
    assert.equal(await page.evaluate(() => location.hash), '#/lab/frasi');
    return card.text;
  });

  await check('lesson 1: model, order, a miss and a retry on a cloze', async () => {
    await gotoRoute(page, `/lab/frasi/${LESSON_1}`);
    await expectKind('model');
    assert.match(await tc('[data-lab-model]'), /Parole utili/);
    assert.equal(await count('[data-lab-model] .lab-example'), 4);
    await shotPair('model');
    await next(); await expectKind('order');
    await buildOrder('Io sono Anna');
    await shotPair('order');
    await buildOrder('e sono di Roma.');
    await checkAnswer();
    const fb = await feedbackState(); assert.equal(fb.state, 'correct'); assert.match(fb.detail, /Io sono Anna e sono di Roma\./);
    await next(); await expectKind('cloze');
    await fillBlank(0, 'sei'); await fillBlank(1, 'ho');
    await checkAnswer();
    const miss = await feedbackState(); assert.equal(miss.state, 'incorrect'); assert.match(miss.detail, /Io takes sono/);
    await click('[data-lab-retry]');
    assert.equal(await text('[data-lab-blank="0"]'), '…', 'the wrong blank was cleared'); assert.equal(await text('[data-lab-blank="1"]'), 'ho', 'the right blank stays');
    await click('[data-lab-blank="0"]');
    await shotPair('cloze');
    await click('[data-lab-option="sono"][data-blank="0"]');
    await checkAnswer();
    const ok = await feedbackState(); assert.equal(ok.state, 'correct'); assert.match(ok.detail, /Ciao, io sono Marco e ho ventotto anni\./);
    await next(); await expectKind('order');
    await buildOrder('Mio fratello ha dieci anni.'); await checkAnswer(); assert.equal((await feedbackState()).state, 'correct');
    await next(); await expectKind('cloze');
    const s = await state();
    assert.equal(s.sessions[`lab:frasi:${LESSON_1}`]?.index, 4, 'the session is saved at the fifth activity');
    return 'order + cloze (miss, retry, correct) + order';
  });

  await check('lesson 1: a free Italian word runs the three drills and is learned', async () => {
    const before = await state();
    assert.ok(!before.learned.includes('w:tedesco|adj'));
    await typeFreeWord(0, 'xyzzyq');
    assert.match(await text('[data-lab-free-message="0"]'), /not in the dictionary/);
    await $('[data-lab-free-input="0"]').fill('tedesco'); await click('[data-lab-free-submit="0"]');
    await passDrills({ meaning: 'German', italian: 'tedesco', typed: 'tedesco', shot: 'learn-sheet' });
    assert.equal(await text('[data-lab-blank="0"]'), 'tedesco', 'the learned word is in the blank');
    const after = await state();
    assert.ok(after.learned.includes('w:tedesco|adj'), 'tedesco is learned');
    const drills = after.events.filter(e => e.entryId === 'w:tedesco|adj');
    assert.deepEqual(drills.map(e => e.skill), ['meaning', 'recall', 'recall']); assert.ok(drills.every(e => e.ok && e.activityKind === 'guided'));
    assert.deepEqual(drills.map(e => e.mode), ['recognition', 'recognition', 'production']);
    assert.ok(after.xp >= before.xp + 10, `XP ${before.xp} → ${after.xp} includes the learned bonus`);
    await checkAnswer();
    const fb = await feedbackState(); assert.equal(fb.state, 'correct'); assert.match(fb.title, /Accepted/); assert.match(fb.detail, /Sono di Roma e sono tedesco\./);
    await next(); await expectKind('dialogue');
    return `+${after.xp - before.xp} XP · ${drills.length} drill events on ${drills[0].objectiveId}`;
  });

  await check('lesson 1: the conversation, one turn at a time', async () => {
    assert.equal(await count('[data-speaker="partner"]'), 1, 'only the first partner line is shown');
    assert.equal(await count('[data-lab-pending]'), 1);
    await fillBlank(0, 'sono');
    assert.equal(await sendTurn('Milano! Che bella città.'), 'Milano! Che bella città.');
    assert.equal(await count('[data-speaker="partner"]'), 3, 'reaction and the next partner line appeared');
    await shotPair('dialogue');
    await fillBlank(0, 'italiano'); await fillBlank(1, 'ho');
    await sendTurn('Anche io sono italiana, di Napoli!');
    await fillBlank(0, 'studente');
    await sendTurn('Anche io! Studio a Bologna.');
    await page.waitForSelector('[data-lab-dialogue][data-complete="true"]');
    assert.equal(await count('[data-lab-pending]'), 0);
    assert.match(await text('[data-lab-chat]'), /Ci vediamo dopo alla festa/);
    assert.equal(await count('[data-lab-replay]'), 1, 'the finished exchange can be replayed');
    const bubbles = await count('[data-lab-chat] .lab-bubble');
    assert.equal(bubbles, 10, 'four partner lines, three replies, three reactions');
    assert.equal(await count('[data-lab-chat] [data-say]'), bubbles, 'every bubble has a speaker button');
    await next(); await expectKind('cloze');
    await fillBlank(0, 'è'); await fillBlank(1, 'ha'); await checkAnswer(); assert.equal((await feedbackState()).state, 'correct');
    await next(); await expectKind('build');
    return '3 you-turns, 4 partner lines, replay';
  });

  await check('lesson 1: say it yourself, keep, complete (+15 XP)', async () => {
    const before = await state();
    assert.match(await text('[data-lab-composed]'), /Choose who/);
    await click('[data-lab-pick="subject"][data-item="0"]'); await click('[data-lab-pick="verb"][data-item="0"]');
    assert.match(await text('[data-lab-composed]'), /Choose what/);
    await click('[data-lab-pick="object"][data-item="2"]');
    await page.waitForFunction(() => /Io sono uno studente\./.test(document.querySelector('[data-lab-composed]')?.textContent || ''));
    assert.match(await text('[data-lab-composed]'), /I am a student\./);
    await shotPair('build');
    await click('[data-lab-another]');
    assert.match(await text('[data-lab-composed]'), /Choose who/);
    await click('[data-lab-pick="subject"][data-item="0"]'); await click('[data-lab-pick="verb"][data-item="0"]'); await click('[data-lab-pick="object"][data-item="2"]'); await click('[data-lab-pick="extra"][data-item="0"]');
    await click('[data-lab-keep]:not([disabled])');
    const fb = await feedbackState(); assert.equal(fb.state, 'correct'); assert.match(fb.title, /Saved/); assert.match(fb.detail, /Io sono uno studente a Milano\./);
    await next();
    await page.waitForSelector('[data-lab-complete][data-first="true"]');
    assert.match(await tc('[data-lab-complete]'), /Lesson complete/); assert.match(await text('[data-lab-xp]'), /\+15 XP/);
    assert.match(await text('[data-lab-complete] .lab-sentences'), /Io sono uno studente a Milano\./);
    assert.ok(await count('[data-lab-next-lesson]') === 1, 'a next-lesson link');
    await shotPair('complete');
    const after = await state();
    assert.ok(after.lab.done[LESSON_1] > 0, 'the lesson is recorded as done');
    assert.equal(after.xp, before.xp + 15, '15 XP for the first completion');
    assert.deepEqual(after.lab.sentences.map(s => s.it), ['Io sono uno studente a Milano.']);
    assert.equal(after.lab.sentences[0].en, 'I am a student in Milan.');
    assert.equal(after.lab.sentences[0].lessonId, LESSON_1);
    assert.equal(Object.keys(after.sessions).length, 0, 'the finished session is cleared');
    await click('[data-lab-workshop]'); await settle(page);
    await page.waitForSelector('[data-lab-page]');
    const states = await page.$$eval('.lab-lesson', els => els.slice(0, 3).map(e => e.dataset.state));
    assert.deepEqual(states, ['done', 'next', 'locked']);
    assert.match(await tc('[data-lab-progress]'), /1 \/ \d+ lessons/);
    assert.match(await text('[data-lab-mine]'), /Io sono uno studente a Milano\./);
    return `done at ${new Date(after.lab.done[LESSON_1]).toISOString()} · ${after.lab.sentences.length} sentence kept`;
  });

  await check('lesson 6: a free English word through the picker, then pause, reload, resume', async () => {
    await gotoRoute(page, `/lab/frasi/${LESSON_6}`);
    await expectKind('model'); await next(); await expectKind('order');
    await buildOrder('Ciao Marco, come stai?'); await checkAnswer(); assert.equal((await feedbackState()).state, 'correct'); await next();
    await expectKind('cloze'); await fillBlank(0, 'sono'); await checkAnswer(); assert.equal((await feedbackState()).state, 'correct'); await next();
    await expectKind('cloze'); await fillBlank(0, 'ha'); await fillBlank(1, 'abbiamo'); await checkAnswer(); assert.equal((await feedbackState()).state, 'correct'); await next();
    await expectKind('dialogue');
    await typeFreeWord(0, 'happy');
    await page.waitForSelector('[data-lab-picker]');
    const candidates = await page.$$eval('[data-lab-candidate]', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    assert.equal(candidates.length, 2, 'contento and felice'); assert.ok(candidates.some(c => /sono felice/.test(c)) && candidates.some(c => /sono contento/.test(c)), candidates.join(' | '));
    await page.locator('[data-lab-candidate]').filter({ hasText: /felice/ }).first().click();
    await passDrills({ meaning: 'happy', italian: 'felice', typed: 'felice' });
    assert.equal(await text('[data-lab-blank="0"]'), 'sono felice', 'the wrap is applied around the learned word');
    assert.equal(await sendTurn('Capisco. Andiamo?'), 'Capisco. Andiamo?');
    assert.match(await text('[data-speaker="you"]:not(.is-pending)'), /Bene grazie, ma sono felice\./);
    await click('[data-lab-pause]');
    await page.waitForSelector('[data-lab-paused]');
    const paused = await state();
    assert.equal(paused.sessions[`lab:frasi:${LESSON_6}`]?.paused, true); assert.equal(paused.sessions[`lab:frasi:${LESSON_6}`]?.turnIndex, 3);
    await reloadApp(page);
    await gotoRoute(page, '/lab/frasi');
    await page.waitForSelector(`[data-lab-resume="${LESSON_6}"]`);
    assert.match(await text('[data-lab-resume]'), /Come stai\?/);
    const keys = Object.keys((await state()).sessions);
    assert.ok(keys.some(k => k.startsWith(`lab:frasi:${LESSON_6}`)), `the session survived the reload (${keys.join(', ')})`);
    await click(`[data-lab-resume="${LESSON_6}"]`); await settle(page);
    await page.waitForSelector('[data-lab-paused]');
    await click('[data-lab-resume]');
    await expectKind('dialogue');
    assert.equal(await count('[data-speaker="you"]:not(.is-pending)'), 1, 'the first exchange is still on screen');
    assert.match(await text('[data-reaction]'), /Capisco\. Andiamo\?/);
    assert.equal(await count('[data-lab-pending]'), 1, 'the conversation resumes at the second turn');
    await fillBlank(0, 'andiamo'); await sendTurn('Perfetto!');
    await fillBlank(0, 'ho'); await sendTurn('Pizza! Ottima idea.');
    await fillBlank(0, 'ciao'); await sendTurn('Ciao!');
    await page.waitForSelector('[data-lab-dialogue][data-complete="true"]');
    await next(); await expectKind('order');
    return `picker ${candidates.length} candidates → felice · resumed at turn ${paused.sessions[`lab:frasi:${LESSON_6}`].turnIndex}`;
  });

  await check('lesson 6: second free entry, say it yourself, second completion', async () => {
    await buildOrder('Ho sonno, vado a casa.'); await checkAnswer(); assert.equal((await feedbackState()).state, 'correct'); await next();
    await expectKind('cloze');
    await typeFreeWord(0, 'triste');
    await passDrills({ meaning: 'sad', italian: 'triste', typed: 'triste' });
    assert.equal(await text('[data-lab-blank="0"]'), 'triste');
    await checkAnswer(); const fb = await feedbackState(); assert.equal(fb.state, 'correct'); assert.match(fb.detail, /Oggi sono triste perché è sabato\./);
    await next(); await expectKind('build');
    await click('[data-lab-pick="subject"][data-item="3"]'); await click('[data-lab-pick="verb"][data-item="2"]'); await click('[data-lab-pick="object"][data-item="2"]'); await click('[data-lab-pick="extra"][data-item="3"]');
    await page.waitForFunction(() => /Noi mangiamo una pizza insieme\./.test(document.querySelector('[data-lab-composed]')?.textContent || ''));
    await click('[data-lab-keep]:not([disabled])'); assert.equal((await feedbackState()).state, 'correct');
    await next();
    await page.waitForSelector('[data-lab-complete][data-first="true"]');
    const s = await state();
    assert.equal(Object.keys(s.lab.done).length, 2); assert.equal(s.lab.sentences.length, 2);
    assert.ok(s.learned.includes('w:triste|adj') && s.learned.includes('w:felice|adj'));
    return `${Object.keys(s.lab.done).length} lessons done · ${s.lab.sentences.length} sentences · learned ${s.learned.length} words`;
  });

  await check('persistence, export, reset and merge of the lab records', async () => {
    await reloadApp(page);
    await gotoRoute(page, '/lab/frasi');
    await page.waitForSelector('[data-lab-page]');
    assert.match(await tc('[data-lab-progress]'), /2 \/ \d+ lessons/);
    assert.equal(await count('[data-lab-mine] .lab-sentence-row'), 2);
    assert.equal(await count('[data-lab-resume]'), 0, 'a reload on the completion screen leaves no stray session behind');
    const r = await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      await store.saveNow();
      const json = store.exportJSON();
      const exported = JSON.parse(json).profile.lab;
      const before = JSON.parse(JSON.stringify(store.labRecord('frasi')));
      await store.resetProgress();
      const afterReset = JSON.parse(JSON.stringify(store.labRecord('frasi')));
      // a backup from before the reset belongs to an older reset generation: merging it is a no-op (like the legacy
      // items), replacing restores it
      await store.importJSON(json, { merge: true, silent: true });
      const mergedAfterReset = JSON.parse(JSON.stringify(store.labRecord('frasi')));
      await store.importJSON(json, { merge: false, silent: true });
      const merged = JSON.parse(JSON.stringify(store.labRecord('frasi')));
      // a remote copy of the same generation with a later completion of lesson 1, the same sentences and one new one:
      // newest at wins, union by it+at
      const remote = JSON.parse(json);
      const later = before.done[Object.keys(before.done)[0]] + 5000;
      remote.profile.lab.frasi.done[Object.keys(before.done)[0]] = later;
      remote.profile.lab.frasi.sentences.push({ it: 'Tu bevi un caffè.', en: 'You drink a coffee.', lessonId: null, at: Date.now() + 1 });
      await store.importJSON(JSON.stringify(remote), { merge: true, silent: true });
      const merged2 = JSON.parse(JSON.stringify(store.labRecord('frasi')));
      return { exported, before, afterReset, mergedAfterReset, merged, merged2, later };
    });
    assert.deepEqual(Object.keys(r.exported.frasi.done).length, 2, 'the backup carries the lab records');
    assert.deepEqual(r.afterReset, { done: {}, sentences: [] }, 'reset clears the lab');
    assert.deepEqual(r.mergedAfterReset, { done: {}, sentences: [] }, 'an older generation never resurrects progress through a merge');
    assert.deepEqual(r.merged, r.before, 'replacing with the backup restores the records');
    assert.equal(r.merged2.done[Object.keys(r.before.done)[0]], r.later, 'the newest completion time wins');
    assert.equal(r.merged2.sentences.length, 3, 'sentences are unioned by text and time');
    const hub = await (async () => { await gotoRoute(page, '/learn'); await page.waitForSelector('.lc[data-key="frasi"]'); return page.$eval('.lc[data-key="frasi"]', a => a.innerText.replace(/\s+/g, ' ').trim()); })();
    assert.match(hub, /2 (lessons done|\/ \d+ lessons)/, hub);
    return `export ok · reset ok · merge ok · hub card "${hub.slice(0, 60)}"`;
  });

  await check('No application errors', async () => {
    const real = errors.filter(e => !/fonts\.g(oogleapis|static)/.test(e));
    assert.deepEqual(real, []);
    return `${results.length} checks, no console, page or network errors`;
  });
} catch { /* reported above */ }
finally { await context?.close().catch(() => {}); await browser.close().catch(() => {}); stopServer(); }

const failed = results.filter(r => !r.ok);
const file = writeReport('sentence-lab', { suite: 'sentence-lab', generatedAt: new Date().toISOString(), shots: SHOTS, results, errors, screenshots: shots, summary: { checks: results.length, failed: failed.length } });
console.log(`\nSummary: ${results.length - failed.length}/${results.length} checks passed · ${errors.length} console/page errors · ${shots.length} screenshots → ${failed.length ? `${failed.length} FAILURES` : 'PASS'}\nReport: ${file}`);
process.exit(failed.length ? 1 : 0);
