#!/usr/bin/env node
// Validates vocabulary / verb JSON files against data/SCHEMA.md.
// Usage: node tools/validate.mjs data/vocab/a1-life.json [more files...]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const CATS = new Set([
  'basics', 'people', 'body', 'emotions', 'food', 'home', 'clothing', 'daily', 'shopping', 'city',
  'travel', 'nature', 'animals', 'time', 'numbers', 'colors', 'work', 'school', 'tech', 'arts',
  'sports', 'society', 'economy', 'science', 'abstract', 'communication', 'description', 'expressions',
]);
const POS = new Set(['noun', 'adj', 'adv', 'prep', 'conj', 'pron', 'num', 'det', 'interj', 'expr']);
const AUX = new Set(['avere', 'essere', 'both']);
const TRANS = new Set(['vt', 'vi', 'vr', 'vt/vi']);

function isStr(v) { return typeof v === 'string' && v.trim().length > 0; }
// -ire verbs, including pronominal ones (pentirsi, sentirsela): the only ones that take `isc`
const isIre = (inf) => /ire$|ir(si|ci|vi|ne|la|lo|le|li|sene|sela|selo|sele|cela|celo|cene)$/.test(inf);

export function validateVocab(arr, file) {
  const errors = [];
  const seen = new Map();
  if (!Array.isArray(arr)) return ['root is not an array'];
  arr.forEach((e, i) => {
    const where = `${file}#${i} (${e && e.it})`;
    if (!e || typeof e !== 'object') { errors.push(`${where}: not an object`); return; }
    if (!isStr(e.it)) errors.push(`${where}: missing it`);
    if (!isStr(e.en)) errors.push(`${where}: missing en`);
    if (!POS.has(e.pos)) errors.push(`${where}: bad pos "${e.pos}"`);
    if (!LEVELS.has(e.level)) errors.push(`${where}: bad level "${e.level}"`);
    if (!CATS.has(e.cat)) errors.push(`${where}: bad cat "${e.cat}"`);
    if (!isStr(e.ex)) errors.push(`${where}: missing ex`);
    if (!isStr(e.exEn)) errors.push(`${where}: missing exEn`);
    if (e.pos === 'noun') {
      if (!['m', 'f', 'mf'].includes(e.g)) errors.push(`${where}: noun needs g m|f|mf`);
      if (!isStr(e.pl)) errors.push(`${where}: noun needs pl`);
    }
    if (e.pos === 'adj' && e.forms !== undefined) {
      if (!Array.isArray(e.forms) || e.forms.length !== 4 || !e.forms.every(isStr)) errors.push(`${where}: forms must be [ms,fs,mp,fp]`);
    }
    if (e.fem !== undefined && !isStr(e.fem)) errors.push(`${where}: fem must be a non-empty string`);
    if (e.note !== undefined && !isStr(e.note)) errors.push(`${where}: note must be a non-empty string (or omitted)`);
    if (isStr(e.it) && /^(il|lo|la|l'|i|gli|le|un|una|uno|un')\s/i.test(e.it) && e.pos === 'noun') errors.push(`${where}: noun lemma must not start with an article`);
    if (isStr(e.it) && /^to\s/i.test(e.en) && e.pos !== 'expr') errors.push(`${where}: looks like a verb — verbs belong in data/verbs`);
    const key = `${(e.it || '').toLowerCase()}|${e.pos}`;
    if (seen.has(key)) errors.push(`${where}: duplicate of #${seen.get(key)}`);
    seen.set(key, i);
  });
  return errors;
}

export function validateVerbs(arr, file) {
  const errors = [];
  const seen = new Map();
  if (!Array.isArray(arr)) return ['root is not an array'];
  arr.forEach((e, i) => {
    const where = `${file}#${i} (${e && e.inf})`;
    if (!e || typeof e !== 'object') { errors.push(`${where}: not an object`); return; }
    if (!isStr(e.inf)) errors.push(`${where}: missing inf`);
    else {
      const inf = e.inf.toLowerCase();
      const ok = /(are|ere|ire|arre|orre|urre)$/.test(inf) || /r(si|ci|vi|ne|la|lo|le|li|sene|sela|selo|sele|cela|celo|cene)$/.test(inf);
      if (!ok) errors.push(`${where}: infinitive does not look Italian`);
      if (inf !== e.inf) errors.push(`${where}: infinitive must be lowercase`);
    }
    if (!isStr(e.en)) errors.push(`${where}: missing en`);
    else if (!/^to\s/.test(e.en)) errors.push(`${where}: en must start with "to "`);
    if (!LEVELS.has(e.level)) errors.push(`${where}: bad level "${e.level}"`);
    if (!CATS.has(e.cat)) errors.push(`${where}: bad cat "${e.cat}"`);
    if (!AUX.has(e.aux)) errors.push(`${where}: bad aux "${e.aux}"`);
    if (!TRANS.has(e.trans)) errors.push(`${where}: bad trans "${e.trans}"`);
    if (typeof e.irregular !== 'boolean') errors.push(`${where}: irregular must be true/false`);
    if (isStr(e.inf)) {
      if (isIre(e.inf.toLowerCase())) { if (typeof e.isc !== 'boolean') errors.push(`${where}: -ire verb needs isc true/false`); }
      else if (e.isc !== undefined) errors.push(`${where}: isc is only for -ire verbs (omit it)`);
    }
    if (!Array.isArray(e.patterns) || e.patterns.length < 1 || e.patterns.length > 4 || !e.patterns.every(isStr)) errors.push(`${where}: patterns must be 1–4 strings`);
    if (!isStr(e.usage)) errors.push(`${where}: missing usage`);
    if (!Array.isArray(e.examples) || e.examples.length !== 3 || !e.examples.every(x => x && isStr(x.it) && isStr(x.en))) errors.push(`${where}: examples must be exactly 3 {it,en}`);
    if (e.related !== undefined && !(Array.isArray(e.related) && e.related.every(isStr))) errors.push(`${where}: related must be a string array`);
    const key = (e.inf || '').toLowerCase();
    if (seen.has(key)) errors.push(`${where}: duplicate of #${seen.get(key)}`);
    seen.set(key, i);
  });
  return errors;
}

function main() {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node tools/validate.mjs <file.json> ...'); process.exit(2); }
  let total = 0; let failed = false;
  const firstSeen = new Map(); const crossDupes = []; // same lemma at the same level in two files: the build keeps the first file's copy
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (err) { console.error(`${f}: JSON parse error: ${err.message}`); failed = true; continue; }
    const isVerb = f.includes(`${path.sep}verbs${path.sep}`) || f.includes('/verbs/');
    const errors = isVerb ? validateVerbs(data, f) : validateVocab(data, f);
    if (Array.isArray(data)) {
      total += data.length;
      for (const e of data) {
        if (!e || typeof e !== 'object') continue;
        const key = isVerb ? `v:${String(e.inf || '').toLowerCase().trim()}` : `w:${String(e.it || '').toLowerCase().trim()}|${e.pos}`;
        const prev = firstSeen.get(key);
        if (prev && prev.level === e.level) crossDupes.push(`${key.slice(2)} (${e.level}) in ${path.basename(prev.file)} and ${path.basename(f)}`);
        else if (!prev) firstSeen.set(key, { file: f, level: e.level });
      }
    }
    if (errors.length) { failed = true; console.error(`${f}: ${errors.length} error(s)`); errors.slice(0, 60).forEach(e => console.error('  - ' + e)); if (errors.length > 60) console.error(`  ... ${errors.length - 60} more`); }
    else console.log(`${f}: OK (${data.length} entries)`);
  }
  console.log(`total entries: ${total}`);
  if (crossDupes.length) console.log(`note: ${crossDupes.length} entries appear in more than one file at the same level; the build keeps the copy from the first file in name order and drops the other: ${crossDupes.slice(0, 8).join('; ')}${crossDupes.length > 8 ? '; …' : ''}`);
  process.exit(failed ? 1 : 0);
}

// process.argv[1] is a plain path: compare it as a file URL so the CLI also runs from a directory whose path contains spaces.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
