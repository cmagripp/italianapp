#!/usr/bin/env node
// Stamps the cache VERSION in sw.js with a content hash, so a release can no longer ship stale code because somebody
// forgot to bump it by hand.
//
// VERSION = '<prefix>-<12 hex>'. The prefix is the readable part and is kept exactly as written in sw.js (change it by
// hand only to label a release, e.g. 'parola-v15' -> 'parola-v16'). The hex is the start of a SHA-256 over every file
// in the sw.js SHELL list plus sw.js itself with the VERSION value blanked out (its SHELL list and its install, activate
// and fetch logic). Same content -> same VERSION, so re-running is a no-op; any change to a precached file or to the
// worker gives a new cache name, the browser sees a changed sw.js, installs the new worker atomically (cache.addAll)
// and drops the previous cache only once the new one is complete.
//
// The hash input is normalised so every checkout and CI run agrees: CRLF is read as LF in text files, './' is the same
// file as './index.html', and the "builtAt" timestamp in data/stats.json (rewritten by tools/build-data.mjs on every run
// and never read by the app) is ignored.
//
// Usage: node tools/stamp-sw.mjs [--check] [path/to/sw.js]
//   no flag  rewrites VERSION in place when it is stale (only that line changes)
//   --check  only reports; exit 1 when VERSION is stale
// Exit 1 on any error (no VERSION line, malformed prefix, a SHELL file missing on disk).
// tools/check-shell.mjs runs the same check, so CI fails on an unstamped commit; the deploy job stamps before publishing.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HASH_LENGTH = 12;
const FORMAT = 'sw-stamp-1'; // part of the hash input: changing how the hash is computed changes every VERSION
const VERSION_LINE = /^const VERSION = '([^'\r\n]*)';(?=\r?$)/m;
const STAMPED = new RegExp(`^(.+)-([0-9a-f]{${HASH_LENGTH}})$`);
const PREFIX = /^[A-Za-z][A-Za-z0-9._-]*$/;
const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.txt', '.xml']);
// Generated fields that change on every build without changing what the app does.
const VOLATILE = {
  'data/stats.json': (text) => { const stats = JSON.parse(text); delete stats.builtAt; return JSON.stringify(stats); },
};

const lf = (text) => text.replace(/\r\n/g, '\n');

// SHELL entries as root-relative paths, in listed order, './' folded into index.html and duplicates dropped.
export function shellFiles(src) {
  const m = src.match(/const SHELL = \[([\s\S]*?)\];/);
  if (!m) throw new Error('no "const SHELL = [...]" list found');
  const out = [];
  for (const [, url] of m[1].matchAll(/'(\.\/[^']*)'/g)) {
    const rel = url === './' ? 'index.html' : url.slice(2);
    if (!rel || rel.endsWith('/') || /[?#]/.test(rel) || rel.split('/').includes('..')) throw new Error(`SHELL entry is not a plain file path: ${url}`);
    if (!out.includes(rel)) out.push(rel);
  }
  return out;
}

export function readVersion(src) {
  const m = src.match(VERSION_LINE);
  if (!m) throw new Error(`no "const VERSION = '...';" line found`);
  return m[1];
}

// The readable part of a VERSION: everything before a trailing -<hash>, or the whole value when it was never stamped.
export function versionPrefix(version) {
  const m = version.match(STAMPED);
  const prefix = m ? m[1] : version;
  if (!PREFIX.test(prefix)) throw new Error(`VERSION prefix '${prefix}' must start with a letter and use only letters, digits, '.', '_' or '-'`);
  return prefix;
}

export function contentHash(src, root) {
  const hash = createHash('sha256');
  const part = (name, bytes) => { hash.update(`${name}\0${bytes.length}\0`); hash.update(bytes); hash.update('\0'); };
  hash.update(FORMAT + '\0');
  part('sw.js', Buffer.from(lf(src.replace(VERSION_LINE, "const VERSION = '';")), 'utf8'));
  const missing = [];
  for (const rel of shellFiles(src)) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { missing.push(rel); continue; }
    let bytes = fs.readFileSync(file);
    if (TEXT.has(path.extname(rel).toLowerCase())) {
      let text = lf(bytes.toString('utf8'));
      if (VOLATILE[rel]) text = VOLATILE[rel](text);
      bytes = Buffer.from(text, 'utf8');
    }
    part(rel, bytes);
  }
  if (missing.length) throw new Error(`listed in SHELL but missing on disk: ${missing.map(p => './' + p).join(', ')}`);
  return hash.digest('hex').slice(0, HASH_LENGTH);
}

// { current, expected, stale, src } for a sw.js; root is the directory its SHELL paths are relative to.
export function stampStatus(swFile = path.join(ROOT, 'sw.js'), root = path.dirname(swFile)) {
  const src = fs.readFileSync(swFile, 'utf8');
  const current = readVersion(src);
  const expected = `${versionPrefix(current)}-${contentHash(src, root)}`;
  return { current, expected, stale: current !== expected, src };
}

export function stampWorker(swFile = path.join(ROOT, 'sw.js'), root = path.dirname(swFile)) {
  const status = stampStatus(swFile, root);
  if (status.stale) fs.writeFileSync(swFile, status.src.replace(VERSION_LINE, `const VERSION = '${status.expected}';`));
  return status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const unknown = args.filter(a => a.startsWith('-') && a !== '--check');
  if (unknown.length) { console.error(`stamp-sw: unknown option ${unknown.join(' ')}\nUsage: node tools/stamp-sw.mjs [--check] [path/to/sw.js]`); process.exit(1); }
  const target = args.find(a => !a.startsWith('-'));
  const sw = target ? path.resolve(target) : path.join(ROOT, 'sw.js');
  const name = path.relative(process.cwd(), sw) || sw;
  try {
    const { current, expected, stale } = check ? stampStatus(sw) : stampWorker(sw);
    if (!stale) console.log(`${name}: VERSION '${current}' is current`);
    else if (check) { console.error(`${name}: VERSION '${current}' is stale; the content hash gives '${expected}'. Run: node tools/stamp-sw.mjs`); process.exit(1); }
    else console.log(`${name}: VERSION '${current}' -> '${expected}'`);
  } catch (e) {
    console.error(`${name}: ${e.message}`);
    process.exit(1);
  }
}
