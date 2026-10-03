import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8');
const manifest=JSON.parse(read('dev/retired-fit-scorer/manifest.json'));
for(const file of manifest.files){const bytes=fs.readFileSync(new URL(file.path,root));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);}
assert.equal(manifest.retiredPublishedBytes,84013164);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):entry.name.endsWith('.js')?[path.join(dir,entry.name)]:[]);
const retiredModules=new Set(['js/learning/fit-scorer.js','js/workers/fit-scorer.worker.js']);
for(const file of walk(fileURLToPath(new URL('js',root)))){const rel=path.relative(fileURLToPath(root),file);if(retiredModules.has(rel))continue;assert(!/(?:fit-scorer\.js|fit-scorer\.worker\.js|models\/fit-scorer\/|vendor\/ort\/)/.test(fs.readFileSync(file,'utf8')),rel+' still calls retired scorer');}
const sw=read('sw.js'),shell=sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
assert(!/fit-scorer|vendor\/ort/.test(shell));assert(/k\s*!==\s*FIT_CACHE/.test(sw));
assert(sw.includes("'./js/workers/fit-scorer.worker.js'"));
assert(read('vendor/ort/ort.wasm.bundle.min.mjs').includes('MIT License'));
console.log('Retired source hashes/notices preserved; 84,013,164 published bytes excluded by build contract; current modules have no scorer caller and old cache bridge remains.');
