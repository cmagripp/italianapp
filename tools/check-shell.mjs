#!/usr/bin/env node
// Checks sw.js against the file tree, or the app breaks offline (or ships stale code) after a deploy:
//   - every file in its precache list (SHELL) exists;
//   - every module and stylesheet the app can load (js/**/*.js, css/*.css), index.html, the manifest, and every data file
//     the app loads at startup (dictionary, grammar reference, audio catalogue, each course-v2 level pack and each
//     data/grammar-course pack) is listed, so all of it installs atomically with the shell;
//   - VERSION carries the current content stamp (tools/stamp-sw.mjs), so a change to a precached file or to sw.js
//     cannot ship under the previous cache name;
//   - AUDIO_CACHE matches js/learning/course-v2-media.js, or every update would delete the learner's downloaded audio.
// Usage: node tools/check-shell.mjs [path/to/sw.js]   (exit 1 on any mismatch)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stampStatus } from './stamp-sw.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const COURSE_PACK = /^(Foundations|[ABC][12])\.json$/;

export function checkShell(swFile = path.join(ROOT, 'sw.js'), root = path.dirname(swFile)) {
  const src = fs.readFileSync(swFile, 'utf8');
  const m = src.match(/const SHELL = \[([\s\S]*?)\];/);
  if (!m) return { errors: [`${swFile}: no "const SHELL = [...]" list found`], listed: [] };
  const listed = [...m[1].matchAll(/'(\.\/[^']*)'/g)].map(x => x[1]).filter(p => p !== './');
  const errors = [];
  for (const p of listed) if (!fs.existsSync(path.join(root, p))) errors.push(`listed in SHELL but missing on disk: ${p}`);
  const walk = (dir, out = []) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p, out); else out.push(p); } return out; };
  const files = (dir, keep) => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(keep).map(f => path.join(root, dir, f)) : [];
  const want = [...walk(path.join(root, 'js')).filter(p => p.endsWith('.js')), ...walk(path.join(root, 'css')).filter(p => p.endsWith('.css')), path.join(root, 'index.html'), path.join(root, 'manifest.webmanifest')];
  const data = [...['vocab.json', 'verbs.json', 'stats.json', 'grammar.json', 'course-v2/audio.json'].map(f => path.join(root, 'data', f)),
    ...files('data/course-v2', f => COURSE_PACK.test(f)), ...files('data/grammar-course', f => f.endsWith('.json'))];
  const set = new Set(listed.map(p => path.normalize(path.join(root, p))));
  for (const p of want) if (!set.has(path.normalize(p))) errors.push(`not precached by sw.js SHELL (breaks offline): ./${path.relative(root, p).split(path.sep).join('/')}`);
  for (const p of data) if (!set.has(path.normalize(p))) errors.push(`data the app loads is not precached by sw.js SHELL (breaks offline): ./${path.relative(root, p).split(path.sep).join('/')}`);

  try {
    const { current, expected, stale } = stampStatus(swFile, root);
    if (stale) errors.push(`VERSION '${current}' is stale: the content hash gives '${expected}'. Run: node tools/stamp-sw.mjs`);
  } catch (e) { errors.push(`VERSION stamp cannot be computed: ${e.message}`); }

  const audio = (file) => { try { return fs.readFileSync(file, 'utf8').match(/const AUDIO_CACHE\s*=\s*'([^']+)'/)?.[1]; } catch { return undefined; } };
  const workerAudio = audio(swFile), pageAudio = audio(path.join(root, 'js/learning/course-v2-media.js'));
  if (!workerAudio) errors.push(`no "const AUDIO_CACHE = '...'" found in ${path.basename(swFile)}`);
  else if (workerAudio !== pageAudio) errors.push(`AUDIO_CACHE '${workerAudio}' differs from js/learning/course-v2-media.js ('${pageAudio}'): every update would delete downloaded audio`);
  return { errors, listed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sw = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'sw.js');
  const { errors, listed } = checkShell(sw);
  if (errors.length) { console.error(`${path.relative(ROOT, sw) || sw}: ${errors.length} problem(s)`); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
  console.log(`${path.relative(ROOT, sw) || sw}: SHELL OK (${listed.length} files precached, all present, every js/css module and data pack listed, VERSION stamp current, audio cache name consistent)`);
}
