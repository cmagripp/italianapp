#!/usr/bin/env node
// Catalogue explicit authored excerpt decisions. The sound is copied from the
// verified original recording; no voice is generated from the transcript.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {advancedListening,naturalSources} from './phase6-advanced-listening.mjs';
import {advancedUnits} from './phase6-advanced.mjs';
const critical={B2:[['si incontrano'],['parallelamente'],['messaggio'],['cosplay'],['speriamo']],C1:[['ma non solo'],['numero'],['speriamo'],['non è un dispregiativo'],['condivisione']],C2:[['siamo solo all'],['non può essere vissuto completamente da nessuno'],['per ora'],['nascosto'],['pizzicorino']]};
const passages=[];
for(const [level,lessons] of Object.entries(advancedListening))for(const lesson of lessons){
 const unitId=advancedUnits[level].find(u=>u[4]===lesson.id)[0];
 for(const [index,scene] of lesson.scenes.entries()){
  const source=naturalSources[scene.media.key];
  passages.push({...source,...scene.media,id:lesson.id+'.source-'+index,lessonId:lesson.id,unitId,level,it:scene.it,en:scene.en,textSha256:crypto.createHash('sha256').update(scene.it).digest('hex'),criticalPhrases:critical[level][index],kind:'recorded',changes:'Excerpt cropped from original and AAC encoded; no synthetic voice, time stretching or background replacement. Intro/theme omitted. Transcript punctuation standardised; original English meaning guide and pedagogy.',rightsChecked:'2026-10-03',rightsEvidence:source.key==='pinocchio'?'Archive primary item identifies LibriVox public-domain recording; Wikisource public-domain underlying work with attributed transcription.':'Commons primary file page explicitly gives CC BY 2.5, named credits and original SHA1; downloaded original bytes match that SHA1.',alignmentReview:'pending automated transcript comparison and independent agent editorial review; native/human audio review remains pending'});
 }
}
fs.writeFileSync(new URL('../data/course-v2/phase6-advanced-recorded-sources.json',import.meta.url),JSON.stringify({version:1,passages},null,2)+'\n');
console.log(passages.length+' explicit natural excerpt records exported.');
