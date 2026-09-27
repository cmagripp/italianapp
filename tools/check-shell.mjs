#!/usr/bin/env node
// Checks sw.js's precache list (SHELL) against the file tree: every listed file must exist, and every module and
// stylesheet the app can load (js/**/*.js, css/*.css) must be listed, or the app breaks offline after a deploy.
// Usage: node tools/check-shell.mjs [path/to/sw.js]   (exit 1 on any mismatch)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function checkShell(swFile = path.join(ROOT, 'sw.js'), root = path.dirname(swFile)) {
  const src = fs.readFileSync(swFile, 'utf8');
  const m = src.match(/const SHELL = \[([\s\S]*?)\];/);
  if (!m) return { errors: [`${swFile}: no "const SHELL = [...]" list found`], listed: [] };
  const listed = [...m[1].matchAll(/'(\.\/[^']*)'/g)].map(x => x[1]).filter(p => p !== './');
  const errors = [];
  for (const p of listed) if (!fs.existsSync(path.join(root, p))) errors.push(`listed in SHELL but missing on disk: ${p}`);
  const walk = (dir, out = []) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p, out); else out.push(p); } return out; };
  const want = [...walk(path.join(root, 'js')).filter(p => p.endsWith('.js')), ...walk(path.join(root, 'css')).filter(p => p.endsWith('.css')), path.join(root, 'index.html'), path.join(root, 'manifest.webmanifest')];
  const set = new Set(listed.map(p => path.normalize(path.join(root, p))));
  for (const p of want) if (!set.has(path.normalize(p))) errors.push(`not precached by sw.js SHELL (breaks offline): ./${path.relative(root, p).split(path.sep).join('/')}`);
  return { errors, listed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sw = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'sw.js');
  const { errors, listed } = checkShell(sw);
  if (errors.length) { console.error(`${path.relative(ROOT, sw) || sw}: ${errors.length} problem(s)`); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
  console.log(`${path.relative(ROOT, sw) || sw}: SHELL OK (${listed.length} files precached, all present, every js/css module listed)`);
}
