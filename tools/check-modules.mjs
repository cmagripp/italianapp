#!/usr/bin/env node
// Parse browser .js files explicitly as modules, independent of Node package-type inference.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const files = [...walk(path.join(root, 'js')), path.join(root, 'sw.js')].filter(f => f.endsWith('.js'));
let failures = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(file, 'utf8'), encoding: 'utf8' });
  if (result.status !== 0) { failures++; console.error(path.relative(root, file), result.stderr || result.error); }
}
console.log(`${files.length - failures}/${files.length} JavaScript files parse as browser modules.`);
if (failures) process.exitCode = 1;
