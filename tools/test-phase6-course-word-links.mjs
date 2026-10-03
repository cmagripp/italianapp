#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {courseWords,courseVerbs,riaverePolicy} from './phase6-course-word-links.mjs';
import {conjugate} from '../js/conjugator.js';
import {resolveLessonWords} from '../js/learning/course-words.js';
import {progressiveInfo,simpleVerbContexts} from '../js/learning/progressive-content.js';
import {lessonContexts} from '../js/learning/lesson-content.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url)));
assert.deepEqual(read('data/vocab/phase6-course-links.json'),courseWords);
assert.deepEqual(read('data/verbs/phase6-course-links.json'),courseVerbs);
assert.deepEqual(read('data/verb-progressive/beginner.json').find(p=>p.inf==='riavere'),riaverePolicy);
const c=conjugate('riavere',{aux:'avere'});
for(const [key,expected]of Object.entries({
 presente:['riò','riài','rià','riabbiamo','riavete','rianno'],
 imperfetto:['riavevo','riavevi','riaveva','riavevamo','riavevate','riavevano'],
 futuro:['riavrò','riavrai','riavrà','riavremo','riavrete','riavranno'],
 condizionale:['riavrei','riavresti','riavrebbe','riavremmo','riavreste','riavrebbero'],
 passatoProssimo:['ho riavuto','hai riavuto','ha riavuto','abbiamo riavuto','avete riavuto','hanno riavuto'],
}))assert.deepEqual(c.tenses[key],expected,key+': riavere lexical derivative');
assert.equal(c.nonFinite.participioPassato,'riavuto');assert.equal(c.nonFinite.gerundio,'riavendo');
assert.deepEqual(conjugate('avere',{aux:'avere'}).tenses.presente,['ho','hai','ha','abbiamo','avete','hanno'],'simple avere unchanged');
const vocab=read('data/vocab.json'),verbs=read('data/verbs.json'),lessons=['A1','A2'].flatMap(level=>read('data/course-v2/'+level+'.json').units.flatMap(u=>u.lessons));
const expected=[['v2-a1-calendar-dates','trentuno','w:trentuno|num'],['v2-a2-shopping-exchange','caricatore','w:caricatore|noun'],['v2-a2-shopping-exchange','riavere','v:riavere'],['v2-a2-food-needs','noci','w:noce|noun'],['v2-a2-food-needs','bevanda','w:bevanda|noun'],['v2-a2-home-repair','tecnico','w:tecnico|noun'],['v2-a2-read-travel-notices','sostitutivo','w:sostitutivo|adj']];
for(const [id,it,entryId]of expected){const resolved=resolveLessonWords(lessons.find(l=>l.id===id),{vocab,verbs});assert.equal(resolved.find(r=>r.gloss.it===it)?.entry.id,entryId,id+': '+it+' useful entry bridge');}
const entry=verbs.find(e=>e.inf==='riavere');assert(entry);assert.equal(progressiveInfo(entry).supported,false,'restitution scenes do not manufacture progressive assessment');
const background=simpleVerbContexts(entry,{chapter:'background',section:'all'}),past=lessonContexts(entry,'past');
assert.equal(background.length,28,'four selected backgrounds for six people plus formal Lei');
assert(background.every(c=>c.en.includes('used to get back')),'imperfect restitution is a former repeated situation');
assert(past.some(c=>c.it==='Io ho riavuto il libro prestato.'&&c.en==='I got back the book lent out.'),'completed restitution retains got back rather than the background habit');
console.log('Seven actual course entry bridges, exact five core riavere cases, non-finite forms and scoped simple policy pass.');
