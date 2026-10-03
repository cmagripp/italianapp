#!/usr/bin/env node
// Inserts only sourceExamples fields; never rewrites an existing activity.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fillTemplate} from '../js/learning/sentence-lab.js';
import {workshopSourceExamples,workshopExamplePacks} from './workshop-source-examples.mjs';
const root=new URL('../',import.meta.url),check=process.argv.includes('--check');
const sha=value=>createHash('sha256').update(value).digest('hex');

// Exact JSON value spans let additions preserve established pack formatting.
function jsonSpans(raw){
 const spans=new Map();let i=0;
 const ws=()=>{while(/\s/.test(raw[i]||'')&&i<raw.length)i++;};
 const scalar=()=>{const start=i;if(raw[i]==='"'){i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue;}if(raw[i++]==='"')break;}}else while(i<raw.length&&!/[\s,\]}]/.test(raw[i]))i++;return JSON.parse(raw.slice(start,i));};
 const value=path=>{ws();const start=i;
  if(raw[i]==='{'){i++;ws();while(raw[i]!=='}'){const key=scalar();ws();assert.equal(raw[i++],':');value([...path,key]);ws();if(raw[i]===','){i++;ws();}else assert.equal(raw[i],'}');}i++;}
  else if(raw[i]==='['){i++;ws();let n=0;while(raw[i]!==']'){value([...path,n++]);ws();if(raw[i]===','){i++;ws();}else assert.equal(raw[i],']');}i++;}
  else scalar();spans.set(JSON.stringify(path),{start,end:i});
 };value([]);ws();assert.equal(i,raw.length);return spans;
}

let inserted=0;
for(const {stage,priorRawSHA256} of workshopExamplePacks){
 const path=new URL(`data/sentence-lab/${stage}.json`,root),raw=fs.readFileSync(path,'utf8'),pack=JSON.parse(raw),spans=jsonSpans(raw),edits=[];
 const rows=workshopSourceExamples.filter(row=>row.stage===stage);
 for(const row of rows){
  const li=pack.lessons.findIndex(lesson=>lesson.id===row.lessonId);assert(li>=0,row.lessonId);
  const activity=pack.lessons[li].activities[row.activityIndex],turn=row.turnIndex===null?activity:activity.turns[row.turnIndex];
  assert.equal(activity.id,row.activityId);assert.equal(turn.template,row.template);const blank=turn.blanks[row.blankIndex];assert(blank.free);
  for(const example of row.sourceExamples){assert.equal(example.it,fillTemplate(turn.template,example.values));assert.equal(example.values.length,turn.blanks.length);example.values.forEach((value,i)=>assert(turn.blanks[i].accept.includes(value)));}
  if(blank.sourceExamples){assert.deepEqual(blank.sourceExamples,row.sourceExamples,`${row.activityId}: existing references differ from source`);continue;}
  assert(!check,`${row.activityId}: sourceExamples missing`);
  const key=['lessons',li,'activities',row.activityIndex,...row.turnIndex===null?[]:['turns',row.turnIndex],'blanks',row.blankIndex];
  const {start,end}=spans.get(JSON.stringify(key));let at=end-1;while(/\s/.test(raw[at-1]))at--;
  const indent=raw.slice(raw.lastIndexOf('\n',start)+1,start).match(/^ */)[0]+'  ';
  const content=',\n'+indent+'"sourceExamples": [\n'+row.sourceExamples.map(example=>indent+'  '+JSON.stringify(example)).join(',\n')+'\n'+indent+']';
  edits.push({at,content});
 }
 if(edits.length){assert.equal(sha(raw),priorRawSHA256,`${stage}: original pack changed; review source before authoring`);let updated=raw;for(const {at,content} of edits.sort((a,b)=>b.at-a.at))updated=updated.slice(0,at)+content+updated.slice(at);const generated=JSON.parse(updated),stripped=structuredClone(generated);for(const lesson of stripped.lessons)for(const activity of lesson.activities)for(const turn of activity.kind==='cloze'?[activity]:activity.kind==='dialogue'?activity.turns:[])for(const blank of turn.blanks||[])delete blank.sourceExamples;assert.deepEqual(stripped,pack);fs.writeFileSync(path,updated);inserted+=edits.length;}
}
console.log(JSON.stringify({mode:check?'check':'author',slots:workshopSourceExamples.length,examples:workshopSourceExamples.reduce((n,row)=>n+row.sourceExamples.length,0),inserted}));
