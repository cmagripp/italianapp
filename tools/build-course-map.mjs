#!/usr/bin/env node
// Explicit release inventory; rebuilding never touches a learner profile.
import fs from 'node:fs';
const levels=['Foundations','A1','A2','B1','B2','C1','C2'];
const load=(path,level)=>JSON.parse(fs.readFileSync(new URL(`../data/${path}/${level}.json`,import.meta.url)));
const packs=levels.map(level=>load('course-v2',level));
const lessons=packs.flatMap(p=>p.units.flatMap(u=>u.lessons.map(l=>({...l,level:p.level,unitId:u.id}))));
const legacy=levels.slice(1).flatMap(level=>load('grammar-course',level).units.flatMap(u=>u.lessons));
const mapping=legacy.map(old=>{
 const replacement=lessons.filter(l=>l.legacyLessonIds?.includes(old.id));
 return {legacyLessonId:old.id,title:old.title,decision:replacement.length>1?'split-and-reteach':replacement.length?'rewrite-with-preparation':'retain-for-existing-work',newLessons:replacement.map(l=>l.id),progressPolicy:'Keep the original lesson session, evidence and due reviews. New targets require their own checks; no automatic completion credit.'};
});
const output={version:2,legacyRegistryVersion:1,learningSchemaVersion:5,defaultEntry:'Foundations',unitCount:packs.reduce((n,p)=>n+p.units.length,0),lessonCount:lessons.length,mapping};
fs.writeFileSync(new URL('../data/course-v2/legacy-map.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(`${mapping.length} legacy lesson decisions; ${lessons.length} new lessons in ${output.unitCount} units.`);
