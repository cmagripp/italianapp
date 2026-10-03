#!/usr/bin/env node
// Add/update only the explicit revision declarations; preserve original fields.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fillTemplate} from '../js/learning/sentence-lab.js';
import {initialLabTemplateRevision, resolveLabTemplate} from '../js/learning/lab-template-source.js';
import {workshopTemplateRevisions, workshopTemplatePrior, withoutWorkshopTemplateRevisions} from './workshop-template-revisions.mjs';
const root = new URL('../', import.meta.url), check = process.argv.includes('--check');
function spans(raw) {
  let i = 0; const result = new Map(), ws = () => {while (i < raw.length && /\s/.test(raw[i])) i++;};
  const scalar = () => {const start = i; if (raw[i] === '"') {i++; while (i < raw.length) {if (raw[i] === '\\') {i += 2; continue;} if (raw[i++] === '"') break;}} else while (i < raw.length && !/[\s,\]}]/.test(raw[i])) i++; return JSON.parse(raw.slice(start, i));};
  const value = path => {ws(); const start = i;
    if (raw[i] === '{') {i++; ws(); while (raw[i] !== '}') {const key = scalar(); ws(); assert.equal(raw[i++], ':'); value([...path, key]); ws(); if (raw[i] === ',') {i++; ws();} else assert.equal(raw[i], '}');} i++;}
    else if (raw[i] === '[') {i++; ws(); let n = 0; while (raw[i] !== ']') {value([...path, n++]); ws(); if (raw[i] === ',') {i++; ws();} else assert.equal(raw[i], ']');} i++;}
    else scalar(); result.set(JSON.stringify(path), {start, end: i});
  }; value([]); ws(); assert.equal(i, raw.length); return result;
}
let changed = 0;
for (const stage of new Set(workshopTemplateRevisions.map(row => row.stage))) {
  const path = new URL(`data/sentence-lab/${stage}.json`, root), raw = fs.readFileSync(path, 'utf8'), pack = JSON.parse(raw), positions = spans(raw), edits = [];
  assert.equal(createHash('sha256').update(JSON.stringify(withoutWorkshopTemplateRevisions(pack))).digest('hex'), workshopTemplatePrior.jsonSHA256, 'original source differs from the exact reviewed baseline');
  const field = (key, object, name, value) => {
    if (Object.hasOwn(object, name)) {if (JSON.stringify(object[name]) === JSON.stringify(value)) return; assert(!check, `${name}: declaration differs`); const at = positions.get(JSON.stringify([...key, name])); edits.push({...at, content: JSON.stringify(value)});}
    else {assert(!check, `${name}: missing`); const at = positions.get(JSON.stringify(key)), indent = raw.slice(raw.lastIndexOf('\n', at.start) + 1, at.start).match(/^ */)[0] + '  '; edits.push({start: at.end - 1, end: at.end - 1, content: `,\n${indent}"${name}": ${JSON.stringify(value)}\n${indent.slice(0, -2)}`});}
  };
  for (const row of workshopTemplateRevisions.filter(row => row.stage === stage)) {
    const li = pack.lessons.findIndex(lesson => lesson.id === row.lessonId), activity = pack.lessons[li]?.activities[row.activityIndex];
    assert.equal(activity?.id, row.activityId); assert.equal(activity.template, row.legacyTemplate.template); assert.equal(activity.en, row.legacyTemplate.en);
    const current = {...activity, templateRevision: row.templateRevision, templateByAgreement: row.templateByAgreement, legacyTemplate: row.legacyTemplate,
      blanks: activity.blanks.map(blank => ({...blank, sourceExamplesByAgreement: row.sourceExamplesByAgreement}))};
    assert.equal(initialLabTemplateRevision(current).templateRevision, row.templateRevision);
    for (const agreement of ['m', 'f']) {
      const resolved = resolveLabTemplate(current, {templateRevision: row.templateRevision}, agreement); assert(resolved.available);
      for (const example of row.sourceExamplesByAgreement[agreement]) {assert.equal(example.it, fillTemplate(resolved.activity.template, example.values)); example.values.forEach((value, i) => assert(activity.blanks[i].accept.includes(value)));}
    }
    const key = ['lessons', li, 'activities', row.activityIndex];
    for (const name of ['templateRevision', 'templateByAgreement', 'legacyTemplate']) field(key, activity, name, row[name]);
    field([...key, 'blanks', row.blankIndex], activity.blanks[row.blankIndex], 'sourceExamplesByAgreement', row.sourceExamplesByAgreement);
  }
  if (edits.length) {let output = raw; for (const edit of edits.sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.content + output.slice(edit.end);
    assert.deepEqual(withoutWorkshopTemplateRevisions(JSON.parse(output)), withoutWorkshopTemplateRevisions(pack)); fs.writeFileSync(path, output); changed += edits.length;}
}
console.log(JSON.stringify({mode: check ? 'check' : 'author', revisionRecords: workshopTemplateRevisions.length, changed}));
