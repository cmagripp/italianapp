import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareTask, validateResponse } from '../../js/ai/index.js';
import { probeGrounding, qualityCases } from './quality-grounding.mjs';
import { messagesFor } from './core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url)), destination = path.join(root, 'measurements');
await mkdir(destination, { recursive: true });
const input = qualityCases.flatMap(test => {
  const request = { task: 'conversation', participants: [{ id: 'partner', name: 'Giulia' }], sourceRevision: 1, ...test };
  const grounded = prepareTask(request, probeGrounding.retrieve(request), { maxContextChars: 10500 });
  return ['plain', 'grounded'].map(variant => {
    const messages = variant === 'plain' ? messagesFor(request.text, request.level) : grounded.messages;
    return { id: test.id, variant, request, messages, instructions: messages[0].content, prompt: messages.at(-1).content };
  });
});
const inputPath = path.join(destination, 'native-input.json'), outputPath = path.join(destination, 'native-foundationmodels.json');
await writeFile(inputPath, JSON.stringify(input, null, 2));
function command(cmd, args, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root }); let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => { child.kill('SIGTERM'); }, timeout);
    child.on('error', reject); child.on('exit', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
const binary = path.join(destination, 'FoundationModelsProbe');
const build = await command('xcrun', ['swiftc', '-parse-as-library', '-O', '-target', 'arm64-apple-macos26.0', 'native/FoundationModelsProbe.swift', '-o', binary], 120000);
const report = { recordedAt: new Date().toISOString(), scope: 'native Mac investigation; no platform/product switch',
  build: { code: build.code, stderr: build.stderr }, inputs: input, availability: null, rows: [] };
if (build.code === 0) {
  const available = await command(binary, ['--availability'], 30000);
  report.availabilityProbe = available;
  report.availability = available.stdout.trim() ? JSON.parse(available.stdout.trim().split('\n')[0]) : null;
  if (report.availability?.availability === 'available' && report.availability?.supportsItalian) {
    console.log('System model is available for Italian; running bounded 28-case native probe.');
    const generated = await command(binary, [inputPath], 10 * 60 * 1000);
    report.execution = { code: generated.code, stderr: generated.stderr };
    report.rows = generated.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.kind === 'response');
    for (const row of report.rows.filter(row => row.ok && row.variant === 'grounded')) {
      const request = input.find(test => test.id === row.id && test.variant === row.variant).request;
      try { row.response = validateResponse(row.raw, { request, grounding: probeGrounding.retrieve(request), participants: request.participants }); row.structuralAcceptance = true; }
      catch (error) { row.structuralAcceptance = false; row.validationError = error.message; }
    }
  }
}
await writeFile(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outputPath, build: report.build, availability: report.availability, generated: report.rows.length }));
if (build.code !== 0) process.exitCode = 1;
