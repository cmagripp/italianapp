#!/usr/bin/env node
// Assembles the deployable static site into dist/ and nothing else: the app shell, the runtime data packs, the icons and
// the bundled course audio. Authoring sources (data/vocab/, data/verbs/, data/verb-progressive/), audit output (docs/),
// tests, tools, dev pages, CI config, markdown and dotfiles stay out of the published site.
// Usage: node tools/build-site.mjs   (cleans dist/ first; exit 1 when the built site is incomplete)
// Pure Node 22, no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// What the app loads at runtime, derived from sw.js SHELL, js/data.js (data/vocab.json, verbs.json, stats.json),
// js/views/grammar.js (data/grammar.json), js/learning/grammar-course.js (data/course-v2/<level>.json and
// data/grammar-course/<level>.json), js/learning/course-v2-media.js (data/course-v2/audio.json and the audio/ files it
// lists), index.html (css/, js/, icons/, manifest) and
// manifest.webmanifest (icons/).
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const TREES = ['css', 'js', 'icons', 'audio', 'models', 'vendor', 'fonts'];   // copied recursively
const JSON_DIRS = ['data', 'data/course-v2', 'data/grammar-course', 'data/sentence-lab']; // only the *.json directly inside (no subfolders)

// Never published, wherever they appear. Checked again on the finished dist/ tree.
const EXCLUDED_DIRS = ['docs', 'tests', 'tools', 'dev', '.github', 'node_modules', 'data/vocab', 'data/verbs', 'data/verb-progressive', 'data/lexical-senses', 'models/fit-scorer', 'vendor/ort'];
// Preserved investigation sources and authoring manifests are not runtime assets.
const EXCLUDED_FILES = new Set(['js/learning/fit-scorer.js', 'js/workers/fit-scorer.worker.js', 'data/verb-question-history.json']);
const excludedFile = name => name.startsWith('.') || /\.md$/i.test(name);

const posix = p => p.split(path.sep).join('/');

export function buildSite({ root = ROOT, out = path.join(root, 'dist') } = {}) {
  root = path.resolve(root); out = path.resolve(out);
  if (out === root || !out.startsWith(root + path.sep)) throw new Error(`refusing to build into ${out}: it must be a subfolder of ${root}`);
  const outRel = posix(path.relative(root, out));
  const skip = new Set([...EXCLUDED_DIRS, outRel]);
  const copied = [];
  const copy = rel => {
    const dest = path.join(out, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, rel), dest);
    copied.push({ rel: posix(rel), bytes: fs.statSync(dest).size });
  };
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = posix(path.join(rel, e.name));
      if (e.name.startsWith('.') || skip.has(child) || EXCLUDED_FILES.has(child)) continue;
      if (e.isDirectory()) walk(child);
      else if (e.isFile() && !excludedFile(e.name)) copy(child);
    }
  };

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const errors = [];
  for (const f of FILES) {
    if (fs.existsSync(path.join(root, f))) copy(f); else errors.push(`source file missing: ${f}`);
  }
  for (const d of TREES) {
    if (fs.existsSync(path.join(root, d))) walk(d); else errors.push(`source folder missing: ${d}/`);
  }
  for (const d of JSON_DIRS) {
    if (!fs.existsSync(path.join(root, d))) { errors.push(`source folder missing: ${d}/`); continue; }
    for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isFile() && e.name.endsWith('.json') && !excludedFile(e.name) && !EXCLUDED_FILES.has(posix(path.join(d,e.name)))) copy(posix(path.join(d, e.name)));
    }
  }

  errors.push(...verifySite(out));
  return { out, files: copied, errors };
}

// Checks the finished dist/ tree on its own: everything the service worker precaches and everything the app requests
// at startup must be there, and nothing from the excluded locations may have leaked in.
export function verifySite(out) {
  const errors = [];
  const has = rel => fs.existsSync(path.join(out, rel)) && fs.statSync(path.join(out, rel)).isFile();
  const read = rel => fs.readFileSync(path.join(out, rel), 'utf8');

  // 1. sw.js SHELL: every precached URL must be present, or the service worker atomic installation fails.
  if (has('sw.js')) {
    const m = read('sw.js').match(/const\s+SHELL\s*=\s*\[([\s\S]*?)\]\s*;/);
    if (!m) errors.push('dist/sw.js: no "const SHELL = [...]" list found');
    else {
      const shell = [...m[1].matchAll(/(['"`])([^'"`]*)\1/g)].map(x => x[2]);
      if (!shell.length) errors.push('dist/sw.js: SHELL is empty');
      for (const u of shell) {
        const rel = u.replace(/^\.\//, '').replace(/[?#].*$/, '');
        const file = rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel;
        if (!has(file)) errors.push(`listed in sw.js SHELL but missing from dist/: ${u}`);
      }
    }
  }

  // 2. index.html and manifest.webmanifest local references (stylesheets, module preloads, icons, data preloads).
  if (has('index.html')) {
    for (const [, ref] of read('index.html').matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
      const rel = ref.replace(/^\.\//, '').replace(/[?#].*$/, '');
      if (!has(rel)) errors.push(`referenced by index.html but missing from dist/: ${ref}`);
    }
  }
  if (has('manifest.webmanifest')) {
    try {
      const manifest = JSON.parse(read('manifest.webmanifest'));
      for (const icon of manifest.icons || []) if (!has(icon.src.replace(/^\.\//, ''))) errors.push(`manifest icon missing from dist/: ${icon.src}`);
    } catch (e) { errors.push(`dist/manifest.webmanifest is not valid JSON: ${e.message}`); }
  }

  // 3. Every relative static or dynamic import between modules resolves inside dist/.
  const walk = (dir, acc = []) => {
    if (!fs.existsSync(dir)) return acc;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, acc); else acc.push(p);
    }
    return acc;
  };
  for (const file of walk(path.join(out, 'js')).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(file, 'utf8');
    const specs = [
      ...src.matchAll(/\b(?:import|export)\s[^'"`;]*?\sfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/g),
      ...src.matchAll(/\bimport\s*(['"])(\.{1,2}\/[^'"]+)\1/g),
      ...src.matchAll(/\bimport\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g),
    ].map(x => x[2]);
    for (const spec of new Set(specs)) {
      const target = path.resolve(path.dirname(file), spec);
      if (!fs.existsSync(target)) errors.push(`${posix(path.relative(out, file))} imports ${spec}, which is missing from dist/`);
    }
  }

  // 4. Runtime data packs requested by the loaders, and every bundled audio clip the catalogue lists.
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const runtimeData = ['data/vocab.json', 'data/verbs.json', 'data/stats.json', 'data/grammar.json', 'data/course-index.json', 'data/completion-index.json', 'data/course-v2/audio.json',
    ...['Foundations', ...levels].map(l => `data/course-v2/${l}.json`), ...levels.map(l => `data/grammar-course/${l}.json`)];
  for (const rel of runtimeData) if (!has(rel)) errors.push(`runtime data file missing from dist/: ${rel}`);
  if (has('data/course-v2/audio.json')) {
    try {
      const catalogue = JSON.parse(read('data/course-v2/audio.json'));
      const missing = (catalogue.assets || []).map(a => a.src).filter(src => src && !/^[a-z]+:/i.test(src) && !has(src.replace(/^\.\//, '')));
      for (const src of missing.slice(0, 20)) errors.push(`audio clip listed in data/course-v2/audio.json missing from dist/: ${src}`);
      if (missing.length > 20) errors.push(`... and ${missing.length - 20} more missing audio clips`);
    } catch (e) { errors.push(`dist/data/course-v2/audio.json is not valid JSON: ${e.message}`); }
  }

  // 5. Nothing excluded leaked in, including the retired fit experiment. The
  //    previous-client cache bridge is tested separately; no new client imports it.
  for (const file of walk(out)) {
    const rel = posix(path.relative(out, file));
    const parts = rel.split('/');
    if (parts.some(p => p.startsWith('.')) || /\.md$/i.test(rel) || EXCLUDED_FILES.has(rel) || EXCLUDED_DIRS.some(d => rel === d || rel.startsWith(d + '/'))) errors.push(`excluded file found in dist/: ${rel}`);
  }
  return errors;
}

const fmt = n => n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let result;
  try { result = buildSite(); } catch (e) { console.error(`build-site: ${e.message}`); process.exit(1); }
  const { out, files, errors } = result;
  const rel = posix(path.relative(process.cwd(), out)) || '.';
  if (errors.length) {
    console.error(`build-site: ${rel}/ is incomplete or contaminated, ${errors.length} problem(s):`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  const total = files.reduce((s, f) => s + f.bytes, 0);
  const byTop = new Map();
  for (const f of files) { const top = f.rel.includes('/') ? f.rel.split('/')[0] + '/' : f.rel; const t = byTop.get(top) || { n: 0, bytes: 0 }; t.n++; t.bytes += f.bytes; byTop.set(top, t); }
  console.log(`build-site: ${rel}/ built: ${files.length} files, ${total} bytes (${fmt(total)})`);
  console.log('  by location: ' + [...byTop].sort((a, b) => b[1].bytes - a[1].bytes).map(([k, v]) => `${k} ${v.n} files ${fmt(v.bytes)}`).join(', '));
  console.log('  largest files:');
  for (const f of [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 10)) console.log(`    ${fmt(f.bytes).padStart(10)}  ${f.rel}`);
  console.log('  checks passed: every sw.js SHELL entry, index.html and manifest reference, relative module import, runtime data pack and catalogued audio clip is present; no excluded or retired files.');
}
