#!/usr/bin/env node
// Checks sw.js against the file tree, or the app breaks offline (or ships stale code) after a deploy:
//   - every file in its precache list (SHELL) exists;
//   - every module and stylesheet the app can load (js/**/*.js, css/*.css), index.html, the manifest, and every data file
//     the app loads at startup (dictionary, grammar reference, audio catalogue, each course-v2 level pack and each
//     data/grammar-course pack) is listed, so all of it installs atomically with the shell;
//   - VERSION carries the current content stamp (tools/stamp-sw.mjs), so a change to a precached file or to sw.js
//     cannot ship under the previous cache name;
//   - AUDIO_CACHE matches js/learning/course-v2-media.js, or every update would delete the learner's downloaded audio;
//   - the fit scorer's on-demand files (js/workers/, models/, vendor/) are NOT in SHELL (they would add 83 MB to every
//     install), FIT_CACHE matches js/learning/fit-scorer.js and js/workers/fit-scorer.worker.js, and activate keeps it;
//   - activate keeps the experimental assistant's WebLLM caches ('webllm/' prefix, docs/ASSISTANT-EXPERIMENT.md), or every
//     update would delete its 340 MB download.
// Usage: node tools/check-shell.mjs [path/to/sw.js]   (exit 1 on any mismatch)
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stampStatus } from './stamp-sw.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const COURSE_PACK = /^(Foundations|[ABC][12])\.json$/;
// The fit scorer's dedicated worker (js/workers/), model (models/) and ONNX runtime (vendor/) belong to the optional scorer
// download: js/learning/fit-scorer.js puts them in their own cache (FIT_CACHE) and sw.js serves them from it, so they are
// deliberately not precached with the shell.
const ON_DEMAND = /^(js\/workers|models|vendor)\//;

export function checkShell(swFile = path.join(ROOT, 'sw.js'), root = path.dirname(swFile)) {
  const src = fs.readFileSync(swFile, 'utf8');
  const m = src.match(/const SHELL = \[([\s\S]*?)\];/);
  if (!m) return { errors: [`${swFile}: no "const SHELL = [...]" list found`], listed: [] };
  const listed = [...m[1].matchAll(/'(\.\/[^']*)'/g)].map(x => x[1]).filter(p => p !== './');
  const errors = [];
  for (const p of listed) if (!fs.existsSync(path.join(root, p))) errors.push(`listed in SHELL but missing on disk: ${p}`);
  for (const p of listed) if (ON_DEMAND.test(p.slice(2))) errors.push(`precached by sw.js SHELL but part of the on-demand fit scorer download (served from FIT_CACHE instead): ${p}`);
  const walk = (dir, out = []) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p, out); else out.push(p); } return out; };
  const files = (dir, keep) => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(keep).map(f => path.join(root, dir, f)) : [];
  const rel = p => path.relative(root, p).split(path.sep).join('/');
  const want = [...walk(path.join(root, 'js')).filter(p => p.endsWith('.js') && !ON_DEMAND.test(rel(p))), ...walk(path.join(root, 'css')).filter(p => p.endsWith('.css')), ...walk(path.join(root, 'fonts')).filter(p => p.endsWith('.woff2')), path.join(root, 'index.html'), path.join(root, 'manifest.webmanifest')];
  const data = [...['vocab.json', 'verbs.json', 'stats.json', 'grammar.json', 'course-index.json', 'completion-index.json', 'course-v2/audio.json'].map(f => path.join(root, 'data', f)),
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

  const fit = (file) => { try { return fs.readFileSync(file, 'utf8').match(/const FIT_CACHE\s*=\s*'([^']+)'/)?.[1]; } catch { return undefined; } };
  const workerFit = fit(swFile), pageFit = fit(path.join(root, 'js/learning/fit-scorer.js')), scorerFit = fit(path.join(root, 'js/workers/fit-scorer.worker.js'));
  if (!workerFit) errors.push(`no "const FIT_CACHE = '...'" found in ${path.basename(swFile)}`);
  else {
    if (workerFit !== pageFit) errors.push(`FIT_CACHE '${workerFit}' differs from js/learning/fit-scorer.js ('${pageFit}'): every update would delete the downloaded fit scorer`);
    if (workerFit !== scorerFit) errors.push(`FIT_CACHE '${workerFit}' differs from js/workers/fit-scorer.worker.js ('${scorerFit}'): the worker would not find the downloaded model`);
    if (!/k\s*!==\s*FIT_CACHE/.test(src)) errors.push(`${path.basename(swFile)} activate does not keep FIT_CACHE: every update would delete the downloaded fit scorer`);
  }

  // The assistant's weights live in WebLLM's own Cache API caches ('webllm/model', 'webllm/wasm', 'webllm/config');
  // activate must skip every cache under that prefix.
  const assistantPrefix = src.match(/const ASSISTANT_CACHE_PREFIX\s*=\s*'([^']+)'/)?.[1];
  if (assistantPrefix !== 'webllm/') errors.push(`no "const ASSISTANT_CACHE_PREFIX = 'webllm/'" found in ${path.basename(swFile)}: every update would delete the assistant's downloaded weights`);
  else if (!/!\s*k\.startsWith\(\s*ASSISTANT_CACHE_PREFIX\s*\)/.test(src)) errors.push(`${path.basename(swFile)} activate does not keep the ASSISTANT_CACHE_PREFIX caches: every update would delete the assistant's downloaded weights`);
  const optional=src.match(/const ASSISTANT_RUNTIME_FILES = (\{.*\});/);
  if(optional){
    for(const [asset,hash] of Object.entries(JSON.parse(optional[1]))){
      const file=path.join(root,asset);
      if(!fs.existsSync(file)||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==hash)errors.push('Missing or mismatched optional assistant runtime: '+asset);
    }
    if(!/k\s*!==\s*ASSISTANT_RUNTIME_CACHE/.test(src))errors.push('Assistant runtime cache must survive updates');
    const assistant=fs.readFileSync(path.join(root,'js/learning/assistant.js'),'utf8');
    const loaderCache=assistant.match(/const RUNTIME_CACHE = '([^']+)'/)?.[1];
    const workerCache=src.match(/const ASSISTANT_RUNTIME_CACHE = '([^']+)'/)?.[1];
    if(loaderCache!==workerCache)errors.push('Assistant loader and service worker runtime cache names disagree');
    const loaderHash=assistant.match(/const RUNTIME_SHA256 = '([^']+)'/)?.[1];
    const loaderPath=assistant.match(/const RUNTIME_URL = new URL\('\.\.\/\.\.\/([^']+)'/)?.[1];
    if(JSON.parse(optional[1])['./'+loaderPath]!==loaderHash)errors.push('Assistant loader and service worker runtime hashes disagree');
  }
  return { errors, listed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sw = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'sw.js');
  const { errors, listed } = checkShell(sw);
  if (errors.length) { console.error(`${path.relative(ROOT, sw) || sw}: ${errors.length} problem(s)`); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
  console.log(`${path.relative(ROOT, sw) || sw}: SHELL OK (${listed.length} files precached, all present, every js/css module and data pack listed, no on-demand fit scorer file listed, VERSION stamp current, audio and fit scorer cache names consistent, assistant caches kept)`);
}
