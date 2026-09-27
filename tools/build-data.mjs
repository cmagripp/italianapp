#!/usr/bin/env node
// Merges data/vocab/*.json and data/verbs/*.json into data/vocab.json and data/verbs.json,
// de-duplicating across levels (lowest CEFR level wins), assigning stable ids and writing data/stats.json.
// Usage: node tools/build-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVocab, validateVerbs } from './validate.mjs';
import { conjugate } from '../js/conjugator.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const lvl = (l) => LEVELS.indexOf(l);
let skippedFiles = 0; // unreadable or non-array source files: reported and counted, the build then exits 1

function readDir(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const p = path.join(dir, f);
    let data;
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.error(`skip ${p}: ${e.message}`); skippedFiles++; continue; }
    if (!Array.isArray(data)) { console.error(`skip ${p}: root is not an array`); skippedFiles++; continue; }
    out.push({ file: p, data });
  }
  return out;
}
// "<file>#<index> (<lemma>): <message>" → index of the offending entry
const badIndexes = (errs) => new Set(errs.map(e => { const m = e.match(/#(\d+) /); return m ? Number(m[1]) : -1; }));

const norm = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
const slug = (s) => norm(s).replace(/[^a-z0-9àèéìíîòóùú' ]/g, '').replace(/ /g, '_');

// ---- vocab ----
const vocabMap = new Map();
let vocabIn = 0, vocabErrors = 0;
for (const { file, data } of readDir(path.join(ROOT, 'data/vocab'))) {
  const errs = validateVocab(data, file);
  if (errs.length) { vocabErrors += errs.length; console.error(`${file}: ${errs.length} validation errors (entries with errors are skipped)`); }
  const bad = badIndexes(errs);
  data.forEach((e, i) => {
    if (bad.has(i)) return;
    vocabIn++;
    const key = `${norm(e.it)}|${e.pos}`;
    const cur = vocabMap.get(key);
    if (!cur || lvl(e.level) < lvl(cur.level)) {
      const merged = { ...e };
      if (cur && cur.note && !merged.note) merged.note = cur.note;
      vocabMap.set(key, merged);
    } else if (cur && !cur.note && e.note) cur.note = e.note;
  });
}
const vocab = [...vocabMap.values()].map(e => ({ id: `w:${slug(e.it)}|${e.pos}`, ...e }));
vocab.sort((a, b) => lvl(a.level) - lvl(b.level) || a.cat.localeCompare(b.cat) || a.it.localeCompare(b.it, 'it'));
// ensure unique ids
const seenIds = new Set();
for (const e of vocab) { let id = e.id, n = 2; while (seenIds.has(id)) id = `${e.id}#${n++}`; e.id = id; seenIds.add(id); }

// ---- verbs ----
const verbMap = new Map();
let verbIn = 0, verbErrors = 0;
for (const { file, data } of readDir(path.join(ROOT, 'data/verbs'))) {
  const errs = validateVerbs(data, file);
  if (errs.length) { verbErrors += errs.length; console.error(`${file}: ${errs.length} validation errors (entries with errors are skipped)`); }
  const bad = badIndexes(errs);
  data.forEach((e, i) => {
    if (bad.has(i)) return;
    verbIn++;
    const key = norm(e.inf);
    const cur = verbMap.get(key);
    if (!cur || lvl(e.level) < lvl(cur.level)) verbMap.set(key, { ...e, inf: key });
  });
}
const verbs = [...verbMap.values()].map(e => ({ id: `v:${e.inf}`, ...e }));
verbs.sort((a, b) => lvl(a.level) - lvl(b.level) || a.inf.localeCompare(b.inf, 'it'));

// engine coverage check
const flaggedNotCovered = [];
const coveredNotFlagged = [];
for (const v of verbs) {
  let c;
  try { c = conjugate(v.inf, { aux: v.aux, isc: v.isc }); } catch (err) { console.error(`conjugate(${v.inf}) failed: ${err.message}`); continue; }
  v.irregularEngine = c.irregular;
  if (v.irregular && !c.irregular) flaggedNotCovered.push(v.inf);
  if (!v.irregular && c.irregular) coveredNotFlagged.push(v.inf);
}

fs.writeFileSync(path.join(ROOT, 'data/vocab.json'), JSON.stringify(vocab));
fs.writeFileSync(path.join(ROOT, 'data/verbs.json'), JSON.stringify(verbs));

const byLevel = (arr) => Object.fromEntries(LEVELS.map(l => [l, arr.filter(e => e.level === l).length]));
const byCat = (arr) => { const o = {}; for (const e of arr) o[e.cat] = (o[e.cat] || 0) + 1; return o; };
const stats = { builtAt: new Date().toISOString(), vocab: { total: vocab.length, byLevel: byLevel(vocab), byCat: byCat(vocab), byPos: byCat(vocab.map(e => ({ cat: e.pos }))) }, verbs: { total: verbs.length, byLevel: byLevel(verbs), irregular: verbs.filter(v => v.irregularEngine).length } };
fs.writeFileSync(path.join(ROOT, 'data/stats.json'), JSON.stringify(stats, null, 2));

console.log(`vocab: ${vocabIn} in -> ${vocab.length} unique (${vocabErrors} validation errors)`);
console.log(`verbs: ${verbIn} in -> ${verbs.length} unique (${verbErrors} validation errors)`);
console.log('by level (vocab):', stats.vocab.byLevel);
console.log('by level (verbs):', stats.verbs.byLevel);
if (flaggedNotCovered.length) console.log(`\nVerbs flagged irregular by data but NOT covered by the engine (${flaggedNotCovered.length}):\n  ${flaggedNotCovered.join(', ')}`);
if (coveredNotFlagged.length) console.log(`\nVerbs treated as irregular by the engine but flagged regular in data (${coveredNotFlagged.length}):\n  ${coveredNotFlagged.join(', ')}`);
// Entries or files that were left out make an incomplete dictionary: say so and fail, so a CI or pre-push run cannot ship it.
if (vocabErrors || verbErrors || skippedFiles) {
  console.error(`\nBUILD INCOMPLETE: ${vocabErrors + verbErrors} validation error(s) and ${skippedFiles} unreadable file(s) — those entries are missing from data/*.json. Run node tools/validate.mjs data/vocab/*.json data/verbs/*.json, fix them and rebuild.`);
  process.exit(1);
}
