#!/usr/bin/env node
// Validates vocabulary / verb JSON files against data/SCHEMA.md.
// Usage: node tools/validate.mjs data/vocab/a1-life.json [more files...]
import fs from 'node:fs';
import path from 'node:path';

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
    if (isStr(e.inf) && /ire$|irsi$/.test(e.inf) && typeof e.isc !== 'boolean') errors.push(`${where}: -ire verb needs isc true/false`);
    if (!Array.isArray(e.patterns) || e.patterns.length < 1 || !e.patterns.every(isStr)) errors.push(`${where}: patterns must be a non-empty string array`);
    if (!isStr(e.usage)) errors.push(`${where}: missing usage`);
    if (!Array.isArray(e.examples) || e.examples.length !== 3 || !e.examples.every(x => x && isStr(x.it) && isStr(x.en))) errors.push(`${where}: examples must be exactly 3 {it,en}`);
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
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (err) { console.error(`${f}: JSON parse error: ${err.message}`); failed = true; continue; }
    const isVerb = f.includes(`${path.sep}verbs${path.sep}`) || f.includes('/verbs/');
    const errors = isVerb ? validateVerbs(data, f) : validateVocab(data, f);
    total += data.length;
    if (errors.length) { failed = true; console.error(`${f}: ${errors.length} error(s)`); errors.slice(0, 60).forEach(e => console.error('  - ' + e)); if (errors.length > 60) console.error(`  ... ${errors.length - 60} more`); }
    else console.log(`${f}: OK (${data.length} entries)`);
  }
  console.log(`total entries: ${total}`);
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
