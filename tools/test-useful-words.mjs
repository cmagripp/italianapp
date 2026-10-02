#!/usr/bin/env node
// The "Parole utili" deck (data/useful-words.json, see data/SCHEMA.md): every entryId resolves to a built dictionary
// word that is not a noun or a verb, groups are non-empty with unique ids and both titles, no id is listed twice across
// the file, notes are one-line strings, the set stays within 60 to 80 words, and the id list survives the games'
// `ids:` deep link (js/source.js) unchanged. Run as `node tools/test-useful-words.mjs` (exit 1 on any problem).
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../data/${p}`, import.meta.url), 'utf8'));
const set = read('useful-words.json'), vocab = read('vocab.json');
const byId = new Map(vocab.map(e => [e.id, e]));
const FUNCTION_POS = new Set(['pron', 'adv', 'conj', 'prep', 'det', 'expr', 'adj', 'num', 'interj']);
const MIN = 60, MAX = 80, NOTE_MAX = 160;
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

ok(set && typeof set === 'object' && !Array.isArray(set), 'root must be an object');
ok(set.version === 1, `version must be 1 (got ${JSON.stringify(set.version)})`);
ok(Object.keys(set).every(k => ['version', 'groups'].includes(k)), `unknown top-level keys: ${Object.keys(set).filter(k => !['version', 'groups'].includes(k)).join(', ')}`);
ok(Array.isArray(set.groups) && set.groups.length > 0, 'groups must be a non-empty array');

const groupIds = new Set(), seen = new Map(), all = [];
for (const [gi, g] of (Array.isArray(set.groups) ? set.groups : []).entries()) {
  const where = `group #${gi} (${g && g.id})`;
  if (!g || typeof g !== 'object') { errors.push(`${where}: not an object`); continue; }
  ok(isStr(g.id) && /^[a-z][a-z0-9-]*$/.test(g.id), `${where}: id must be a slug`);
  ok(!groupIds.has(g.id), `${where}: duplicate group id`); groupIds.add(g.id);
  ok(isStr(g.title), `${where}: missing title`);
  ok(isStr(g.it), `${where}: missing Italian title (it)`);
  ok(Object.keys(g).every(k => ['id', 'title', 'it', 'entries'].includes(k)), `${where}: unknown keys ${Object.keys(g).filter(k => !['id', 'title', 'it', 'entries'].includes(k)).join(', ')}`);
  ok(Array.isArray(g.entries) && g.entries.length > 0, `${where}: entries must be a non-empty array`);
  for (const [ei, e] of (Array.isArray(g.entries) ? g.entries : []).entries()) {
    const at = `${where} entry #${ei} (${e && e.entryId})`;
    if (!e || typeof e !== 'object') { errors.push(`${at}: not an object`); continue; }
    ok(Object.keys(e).every(k => ['entryId', 'note'].includes(k)), `${at}: unknown keys ${Object.keys(e).filter(k => !['entryId', 'note'].includes(k)).join(', ')}`);
    if (!isStr(e.entryId)) { errors.push(`${at}: missing entryId`); continue; }
    const entry = byId.get(e.entryId);
    ok(entry, `${at}: not in data/vocab.json (run node tools/build-data.mjs after adding it to data/vocab/)`);
    if (entry) {
      ok(e.entryId.startsWith('w:'), `${at}: must be a vocabulary id (w:…), not a verb`);
      ok(FUNCTION_POS.has(entry.pos), `${at}: ${entry.pos} "${entry.it}" is not a function word (a noun homograph such as w:cosa|noun was meant to be the pronoun)`);
    }
    ok(!seen.has(e.entryId), `${at}: already listed in group "${seen.get(e.entryId)}"`); if (!seen.has(e.entryId)) seen.set(e.entryId, g.id);
    if (e.note !== undefined) {
      ok(isStr(e.note), `${at}: note must be a non-empty string (or omitted)`);
      if (isStr(e.note)) { ok(!/[\r\n]/.test(e.note), `${at}: note must be one line`); ok(e.note.length <= NOTE_MAX, `${at}: note longer than ${NOTE_MAX} characters`); ok(!/<[a-z/]/i.test(e.note), `${at}: note must be plain text`); }
    }
    all.push(e.entryId);
  }
}
ok(all.length >= MIN && all.length <= MAX, `${all.length} entries in total; the deck holds ${MIN} to ${MAX}`);
ok(seen.has('w:si|pron'), 'the reflexive pronoun si (w:si|pron) belongs in the deck');

// The Play action hands the whole list to the games as `ids:<id,id,…>` (URL-encoded, decoded by the router and split on
// the first colon and then on commas by js/source.js parseSpec / resolveSource): every id must come back unchanged.
const spec = 'ids:' + encodeURIComponent(all.join(','));
const decoded = decodeURIComponent(spec), rest = decoded.slice(decoded.indexOf(':') + 1);
const back = rest.split(',').map(s => s.trim()).filter(Boolean);
ok(back.length === all.length && back.every((id, i) => id === all[i]), 'the id list does not survive the ids: deep link (an id with a comma?)');

const summary = (set.groups || []).map(g => `${g.id} ${Array.isArray(g.entries) ? g.entries.length : 0}`).join(' · ');
if (errors.length) { console.error(`data/useful-words.json: ${errors.length} problem(s)`); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
console.log(`data/useful-words.json: OK — ${all.length} words in ${set.groups.length} groups (${summary}), every id resolves, none twice, deep link round-trips`);
