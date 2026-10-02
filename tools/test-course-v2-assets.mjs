#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const levels=['Foundations','A1','A2','B1','B2','C1','C2'];
const lessons=levels.flatMap(level=>read(`data/course-v2/${level}.json`).units.flatMap(u=>u.lessons.map(l=>({...l,unitId:u.id,level}))));
const manifest=read('data/course-v2/audio.json'),assets=new Map(manifest.assets.map(a=>[a.id,a]));
const reviews=read('data/course-v2/audio-review.json').clips;
assert.equal(assets.size,manifest.assets.length,'Duplicate audio ID hides a recorded source');
const hash=value=>createHash('sha256').update(value).digest('hex');let bytes=0,listening=0;
for(const l of lessons)for(const s of l.steps){
 if(s.kind==='passage'&&s.mode==='listen'){
  const a=assets.get(s.audioId);assert(a,`${s.id}: missing audio asset`);
  assert.equal(a.lessonId,l.id);assert.equal(a.unitId,l.unitId);assert.equal(a.level,l.level);
  assert.equal(a.textSha256,hash(s.it),`${s.id}: stale transcript/audio`);
  assert(/^audio\/course-v2\/(Foundations|[ABC][12])\/[a-z0-9.-]+\.m4a$/.test(a.src),`${s.id}: invalid audio path`);
  const file=fs.readFileSync(new URL('../'+a.src,import.meta.url));assert.equal(hash(file),a.sha256,`${a.id}: audio bytes changed`);assert.equal(file.length,a.bytes);bytes+=file.length;
  assert(a.source?.startsWith('https://')&&a.license&&a.licenseUrl?.startsWith('https://'),`${a.id}: source/license missing`);
  assert(['synthetic','recorded'].includes(a.kind));assert(a.voice);assert(a.seconds>0,`${a.id}: duration missing`);
  assert(a.reviewed,`${a.id}: audio quality check missing`);
  if(a.kind==='synthetic'){
   assert.equal(reviews[a.id]?.sha256,a.sha256,`${a.id}: stale audio comparison`);
   assert(reviews[a.id]?.passed,`${a.id}: audio comparison failed`);
  }
 }
 if(s.kind==='question'&&(s.modality==='listening'||l.targets.find(t=>t.id===s.target)?.modality==='listening')){
  assert(s.audioId,`${s.id}: listening check without sound`);assert(assets.get(s.audioId)?.reviewed,`${s.id}: listening assessment audio has not passed validation`);listening++;
 }
 if(s.passageId)assert(l.steps.some(p=>p.id===s.passageId&&p.kind==='passage'&&p.mode==='read'),`${s.id}: missing reading source`);
 if(s.audioId&&s.kind==='question')assert(l.steps.some(p=>p.audioId===s.audioId&&p.kind==='passage'&&p.mode==='listen'),`${s.id}: missing listening source`);
}
const actualIds=new Set(lessons.flatMap(l=>l.steps.filter(s=>s.kind==='passage'&&s.mode==='listen').map(s=>s.audioId)));
assert.equal(assets.size,actualIds.size,'Audio manifest contains unused assets');
const legacy=levels.slice(1).flatMap(level=>read(`data/grammar-course/${level}.json`).units.flatMap(u=>u.lessons));
const map=read('data/course-v2/legacy-map.json');assert.equal(map.unitCount,82);assert.equal(map.lessonCount,lessons.length);assert.equal(map.mapping.length,legacy.length);
const newIds=new Set(lessons.map(l=>l.id));for(const old of legacy){const row=map.mapping.find(r=>r.legacyLessonId===old.id);assert(row?.decision&&row.progressPolicy,`${old.id}: no migration decision`);for(const id of row.newLessons)assert(newIds.has(id),`${old.id}: missing mapped lesson ${id}`);}
const oldIds=new Set(legacy.map(l=>l.id));for(const l of lessons)for(const id of l.legacyLessonIds||[])assert(oldIds.has(id),`${l.id}: unknown legacy source ${id}`);
console.log(`${assets.size} attributed audio clips (${(bytes/1024/1024).toFixed(1)} MiB), ${listening} validated listening checks, ${legacy.length} preserved legacy lesson decisions.`);
