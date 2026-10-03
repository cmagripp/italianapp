// Independent read/audit fixture requested after the AI comparison. Synthetic
// isolated profile data only; no production conversation or learner is touched.
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildConversationSummary } from '../../js/conversations/summary.js';
import { ensureServer } from '../../tests/lib.mjs';
const { chromium } = await import(pathToFileURL(process.env.PAROLA_TRIAL_PLAYWRIGHT || '/tmp/parola-grammar-tools/node_modules/playwright/index.mjs'));
const report = { measuredAt: new Date().toISOString(), source: 'independent synthetic fixtures; no user records', summary: {}, storage: {} };
const source = { turnId: 'source', revision: 1, role: 'learner', displayText: 'Non ho comprato due mele.' };
const response = { turnId: 'response', revision: 1, role: 'partner', displayText: 'Va bene.', correctionRefs: [{ sourceTurnId: 'source', sourceTurnRevision: 1, original: source.displayText, replacement: 'Ho comprato tre mele.', ruleId: 'permissive' }] };
const rule = { id: 'permissive', verified: true, explanation: 'Fixture verifier deliberately does not preserve meaning.', source: 'audit-fixture', confirmCorrection: () => true };
const summary = extra => buildConversationSummary({ thread: { contentRevision: 2, setup: { agreement: 'flexible' } }, turns: [source, response] }, { lookup: () => ({ candidates: [] }), resolveEntry: () => null, resolveRule: () => ({ ...rule, ...extra }) });
report.summary.meaningReversalCreatesCorrection = summary({}).items.some(item => item.kind === 'correction');
report.summary.missingSourceCreatesCorrection = summary({ source: null }).items.some(item => item.kind === 'correction');
const base = 'http://127.0.0.1:8157/', stop = await ensureServer(base);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage(); await page.goto(base + 'index.html');
  report.storage = await page.evaluate(async () => {
    const { createConversationRepository } = await import('./js/conversations/storage.js');
    const repo = createConversationRepository({ profileId: 'ai-independent-audit', learnerId: 'synthetic' });
    const setup = { level: 'A1', participants: [{ id: 'partner', name: 'Giulia' }] };
    try {
      await repo.createThread(setup, { threadId: 'synthetic' });
      for (let n = 1; n <= 2; n++) await repo.commitTurn('synthetic', { turnId: `source-${n}`, role: 'learner', participantId: 'learner', originalText: `Messaggio ${n}.` });
      await repo.saveRecording('synthetic', 'source-1', new Blob(['first-recording'], { type: 'audio/webm' }), { audioId: 'shared-id', consentAt: Date.now() });
      let collisionError;
      try { await repo.saveRecording('synthetic', 'source-2', new Blob(['different-recording'], { type: 'audio/webm' }), { audioId: 'shared-id', consentAt: Date.now() }); } catch (error) { collisionError = error.message; }
      const recording = await repo.recording('synthetic', 'shared-id'), saved = await repo.read('synthetic');
      let quoteError;
      try { await repo.saveSummary('synthetic', { items: [{ id: 'wrong-quote', kind: 'vocabulary', entryId: 'fiction', sourceRefs: [{ turnId: 'source-1', revision: 1, start: 0, end: 1000, quote: 'Not the actual message.' }] }] }, { sourceRevision: 2 }); } catch (error) { quoteError = error.message; }
      return { collisionError: collisionError || null, recordingTurn: recording.turnId, recordingText: await recording.blob.text(),
        source1StillReferencesSharedId: saved.turns[0].recordingRefs.some(ref => ref.audioId === 'shared-id'), quoteError: quoteError || null,
        wrongQuoteAccepted: !quoteError };
    } finally { await repo.removeProfileData(); repo.close(); }
  });
} finally { await browser.close(); stop(); }
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'ai-conversation-audit.json';
if (!/^ai-[a-z0-9-]+\.json$/.test(output)) throw Error('Use an ai- report filename');
await writeFile(new URL('../../docs/implementation/programme/' + output, import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
