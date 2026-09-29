#!/usr/bin/env node
// Noun-number regressions in an isolated browser profile. Never uses a signed-in profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, launchBrowser, contextOptions, ensureServer, boot, gotoRoute, BASE, TESTS_DIR, SHOTS_DIR } from './lib.mjs';

const { chromium, devices } = await loadPlaywright();
const stopServer = await ensureServer();
const browser = await launchBrowser(chromium);
const context = await browser.newContext(contextOptions(devices['iPhone 13'], { reducedMotion: 'reduce' }));
const page = await context.newPage();
const results = [], screenshots = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().startsWith(BASE) && response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
fs.mkdirSync(SHOTS_DIR, { recursive: true });
const id = word => 'w:' + word.replaceAll(' ', '_') + '|noun';
const route = (kind, word) => '/' + kind + '/' + encodeURIComponent(id(word));
const singularNote = 'Normally singular in this meaning. Other meanings or specialized uses may have a plural.';
const pluralNote = 'This entry is normally used in the plural.';
const missingNote = 'Plural not yet recorded for this entry.';

async function check(name, action) {
  try { const detail = await action(); results.push({ name, ok: true, detail }); console.log('PASS', name); }
  catch (error) { results.push({ name, ok: false, error: error.stack }); console.error('FAIL', name, error.message); }
}
async function visibleNote(selector, expected) {
  const note = page.locator(selector);
  assert.equal(await note.count(), 1, 'one usage note');
  assert.equal(await note.isVisible(), true, 'usage note is visible without a flip');
  assert((await note.innerText()).includes(expected));
  assert.equal(await note.locator('[data-say]').count(), 0, 'usage explanations are not speech controls');
  assert.equal(await note.evaluate(el => !!el.closest('[data-say]')), false);
}
async function noBogusForms() {
  const actual = await page.locator('#view').evaluate(root => ({
    text: root.innerText,
    forms: [...root.querySelectorAll('.f .val > span, .fan-card .form, .forms-say [data-say], [data-night-number]')].map(e => e.textContent),
    speech: [...root.querySelectorAll('[data-say]')].map(e => e.dataset.say),
  }));
  assert(!/\bundefined\b/.test(actual.text), 'no undefined values printed');
  assert(actual.forms.every(s => !/\b(?:i|gli|le)\s+[—-](?:\s|$)/.test(s)), 'no markers presented as forms');
  assert(actual.speech.every(s => s && !/^(?:undefined|null|[—-]|(?:i|gli|le)\s+[—-])$/.test(s)), 'no missing forms offered to speech');
  assert(actual.speech.every(s => ![singularNote, pluralNote, missingNote].some(note => s.includes(note))), 'number guidance is not spoken as Italian');
}
async function shot(name, selector = null) {
  const file = path.join(SHOTS_DIR, 'noun-' + name + '.png');
  if (selector) await page.locator(selector).screenshot({ path: file, animations: 'disabled' });
  else await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  screenshots.push(file);
}

// Preserve the full dictionary while deterministically placing a target at the daily-pick index.
// This changes only the isolated page's in-memory array and restores it before leaving home.
async function homeWith(word, action) {
  await gotoRoute(page, route('entry', word));
  await page.evaluate(async target => {
    const { data } = await import('./js/data.js');
    const { store } = await import('./js/store.js');
    const entry = data.byId.get(target);
    window.__nounTestVocab = data.vocab;
    const candidates = data.vocab.filter(e => e.level === entry.level);
    const d = new Date(), seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate() + 7919;
    const a = candidates[seed % candidates.length];
    const copy = data.vocab.slice(), first = copy.indexOf(a), second = copy.indexOf(entry);
    [copy[first], copy[second]] = [copy[second], copy[first]];
    data.vocab = copy;
    store.setSetting('level', entry.level);
  }, id(word));
  try { await gotoRoute(page, '/home'); await action(); }
  finally { await page.evaluate(async () => { const { data } = await import('./js/data.js'); data.vocab = window.__nounTestVocab; delete window.__nounTestVocab; }); }
}

try {
  await boot(page);
  await check('Every dictionary noun renders its recorded plural or an explicit number note', async () => {
    const audit = await page.evaluate(async () => {
      const { data, withArticle } = await import('./js/data.js');
      const { wordForms } = await import('./js/components.js');
      const nouns = data.vocab.filter(e => e.pos === 'noun');
      const failures = [], counts = { nouns: nouns.length, forms: 0, notes: 0, invariant: 0 };
      for (const e of nouns) {
        const el = document.createElement('div'); el.innerHTML = wordForms(e);
        const cells = [...el.querySelectorAll('.f')].map(f => ({ label: f.querySelector('.lab')?.textContent, value: f.querySelector('.val > span')?.textContent }));
        const recorded = typeof e.pl === 'string' && e.pl.trim() && !['-', '—'].includes(e.pl.trim());
        const plural = cells.find(c => c.label === 'Plurale');
        const note = el.querySelector('[data-number-note]');
        if (recorded) {
          counts.forms++;
          if (e.pl === e.it) counts.invariant++;
          if (plural?.value !== withArticle(e, true)) failures.push(`${e.id}: recorded plural is absent or changed`);
        } else if (!note?.textContent.trim()) failures.push(`${e.id}: missing number explanation`);
        if (!recorded && plural) failures.push(`${e.id}: a plural was invented`);
        if (note) counts.notes++;
        if (/\bundefined\b|\b(?:i|gli|le)\s+[—-](?:\s|$)/.test(el.textContent)) failures.push(`${e.id}: invalid form printed`);
        if (note?.querySelector('[data-say]') || note?.closest('[data-say]')) failures.push(`${e.id}: note is speakable`);
        for (const button of el.querySelectorAll('[data-say]')) {
          if (!cells.some(c => c.value === button.dataset.say)) failures.push(`${e.id}: speech is not a displayed form`);
        }
      }
      return { ...counts, failures };
    });
    assert.equal(audit.nouns, 4613);
    assert.deepEqual(audit.failures, []);
    return audit;
  });

  const fixtures = [
    { word: 'calcio', forms: ['il calcio'], note: singularNote },
    { word: 'casa', forms: ['la casa', 'le case'] },
    { word: 'latte', forms: ['il latte'], note: singularNote },
    { word: 'caffè', forms: ['il caffè', 'i caffè'] },
    { word: 'occhiali', forms: ['gli occhiali'], note: pluralNote },
    { word: 'extrema ratio', forms: ["l'extrema ratio", 'le extrema ratio'] },
    { word: 'vexata quaestio', forms: ['la vexata quaestio', 'le vexata quaestio'] },
  ];
  for (const fixture of fixtures) {
    await check(`${fixture.word}: entry fan and grid show correct forms and usage`, async () => {
      await gotoRoute(page, route('entry', fixture.word));
      await page.locator('[data-forms-card] [data-fan]').waitFor();
      assert.deepEqual(await page.locator('[data-forms-card] .fan-card .form').allTextContents(), fixture.forms);
      if (fixture.note) await visibleNote('[data-forms-card] [data-number-note]', fixture.note);
      else assert.equal(await page.locator('[data-forms-card] [data-number-note]').count(), 0);
      if (fixture.word === 'calcio') {
        assert.match(await page.locator('#nota').innerText(), /'i calci' are kicks/);
        assert.equal(await page.locator('#nota .note').isVisible(), true);
        await shot('calcio-entry-fan', '[data-forms-card]');
      }
      await page.locator('[data-fview="grid"]').click();
      assert.deepEqual(await page.locator('[data-forms-card] .f .val > span').allTextContents(), fixture.forms);
      if (fixture.note) await visibleNote('[data-forms-card] [data-number-note]', fixture.note);
      if (fixture.word === 'occhiali') assert.deepEqual(await page.locator('[data-forms-card] .f .lab').allTextContents(), ['Plurale']);
      await noBogusForms();
      if (fixture.word === 'calcio') await shot('calcio-entry-grid', '[data-forms-card]');
    });
    await check(`${fixture.word}: reference shows forms and usage without inventing a plural`, async () => {
      await gotoRoute(page, route('reference', fixture.word));
      assert.deepEqual(await page.locator('#forms .forms-say [data-say]').allTextContents(), fixture.forms);
      for (const button of await page.locator('#forms .forms-say [data-say]').all()) assert.equal(await button.isVisible(), true);
      if (fixture.note) await visibleNote('#forms [data-number-note]', fixture.note);
      else assert.equal(await page.locator('#forms [data-number-note]').count(), 0);
      if (fixture.word === 'calcio') assert.match(await page.locator('#note').innerText(), /'i calci' are kicks/);
      if (fixture.word === 'occhiali') {
        assert.match(await page.locator('.ref-id .tags').innerText(), /normally plural/i);
        assert(!/only used in the plural|always plural/.test(await page.locator('#forms').innerText()));
      }
      await noBogusForms();
    });
  }

  await check('A custom noun without plural data explains the gap in entry, reference and shared forms', async () => {
    const customId = await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      const { registerCustom } = await import('./js/data.js');
      const customId = store.addCustomWord({ it: 'quaderno di prova', en: 'test notebook', pos: 'noun', g: 'm', level: 'A1', cat: 'school' });
      registerCustom(store.current.custom);
      return customId;
    });
    for (const kind of ['entry', 'reference']) {
      await gotoRoute(page, '/' + kind + '/' + encodeURIComponent(customId));
      const selector = kind === 'entry' ? '[data-forms-card]' : '#forms';
      await visibleNote(selector + ' [data-number-note]', missingNote);
      if (kind === 'entry') {
        await page.locator('[data-fview="grid"]').click();
        assert.deepEqual(await page.locator(selector + ' .f .lab').allTextContents(), ['Singolare']);
      } else assert.deepEqual(await page.locator('#forms .forms-say [data-say]').allTextContents(), ['il quaderno di prova']);
      assert(!(await page.locator(selector).innerText()).includes('Normally singular'));
      await noBogusForms();
    }
    const shared = await page.evaluate(async customId => {
      const { getEntry } = await import('./js/data.js');
      const { wordForms } = await import('./js/components.js');
      const el = document.createElement('div'); el.innerHTML = wordForms(getEntry(customId));
      return { note: el.querySelector('[data-number-note]')?.textContent, labels: [...el.querySelectorAll('.lab')].map(e => e.textContent) };
    }, customId);
    assert.equal(shared.note, missingNote);
    assert.deepEqual(shared.labels, ['Singolare']);
  });

  for (const fixture of fixtures) {
    await check(`${fixture.word}: home noun of the day has plural or usage guidance`, () => homeWith(fixture.word, async () => {
      const card = page.locator('.night-card').filter({ has: page.locator(`[aria-label="Open ${fixture.word}"]`) });
      assert.equal(await card.count(), 1);
      const number = card.locator('[data-night-number]');
      assert.equal(await number.isVisible(), true);
      assert.equal(await number.innerText(), fixture.note ? fixture.note.split('.')[0] + '.' : 'Plural: ' + fixture.forms.at(-1));
      assert.equal(await number.locator('[data-say]').count(), 0);
      await noBogusForms();
    }));
  }

  for (const word of ['calcio', 'casa']) {
    await check(`${word}: flipped flashcard shows number guidance in both directions`, async () => {
      for (const dir of ['it-en', 'en-it']) {
        await gotoRoute(page, '/game/flashcards?src=ids:' + encodeURIComponent(id(word)) + '&dir=' + dir);
        const flash = page.locator('[data-flash]');
        await flash.locator('[data-flip]').click();
        assert.equal(await flash.evaluate(el => el.classList.contains('flipped')), true);
        assert((await flash.locator('.face.back').innerText()).includes(word === 'calcio' ? 'Normally singular in this meaning.' : 'pl. le case'));
        await noBogusForms();
      }
    });
  }

  const layoutDetails = [];
  for (const width of [375, 390]) for (const theme of ['light', 'dark']) {
    await check(`${width}px ${theme}: home, entry fan/grid, reference and flashcards have no horizontal overflow`, async () => {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 844 });
      await page.evaluate(async theme => { const { store } = await import('./js/store.js'); store.setSetting('theme', theme); }, theme);
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      const audit = async name => {
        const measured = await page.evaluate(() => {
          const vw = window.innerWidth;
          const nodes = [...document.querySelectorAll('#view .card, #view .night-card, #view [data-number-note], #view [data-night-number], #view [data-flash]')];
          const wide = nodes.filter(el => el.checkVisibility() && el.getBoundingClientRect().width > vw + 1).map(el => ({ className: el.className, text: el.innerText.slice(0, 60), width: el.getBoundingClientRect().width }));
          return { viewport: vw, scrollWidth: document.documentElement.scrollWidth, wide };
        });
        layoutDetails.push({ width, theme, name, ...measured });
        assert(measured.scrollWidth <= width + 1, `${name}: page wider than viewport: ${JSON.stringify(measured)}`);
        assert.deepEqual(measured.wide, [], name + ': wide content');
        await noBogusForms();
        if (width === 375 && theme === 'light' || width === 390 && theme === 'dark') await shot(`${width}-${theme}-${name}`);
      };
      await homeWith('calcio', () => audit('home'));
      for (const word of ['calcio', 'extrema ratio']) {
        await gotoRoute(page, route('entry', word));
        await audit(word.replaceAll(' ', '-') + '-entry-fan');
        await page.locator('[data-fview="grid"]').click();
        await audit(word.replaceAll(' ', '-') + '-entry-grid');
        await gotoRoute(page, route('reference', word));
        await audit(word.replaceAll(' ', '-') + '-reference');
      }
      for (const word of ['calcio', 'casa']) {
        await gotoRoute(page, '/game/flashcards?src=ids:' + encodeURIComponent(id(word)));
        await page.locator('[data-flip]').click();
        await audit(word + '-flashcard');
      }
      return { pages: 9 };
    });
  }
  await check('No application errors or missing local assets', async () => assert.deepEqual(errors, []));
  fs.writeFileSync(path.join(TESTS_DIR, 'report-noun-forms-e2e.json'), JSON.stringify({ results, layoutDetails, screenshots, errors }, null, 2));
} finally {
  await browser.close();
  stopServer();
}
const failed = results.filter(r => !r.ok);
console.log(`${results.length - failed.length}/${results.length} noun-form browser checks passed.`);
if (failed.length) process.exitCode = 1;
