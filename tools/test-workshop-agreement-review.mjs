import fs from 'node:fs';
import assert from 'node:assert/strict';
import {assessLabBlank,answerLab,createLabSession,currentLabStep} from '../js/learning/sentence-lab.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const dictionary={vocab:read('data/vocab.json'),verbs:read('data/verbs.json')},ctx={dictionary,learnedIds:new Set()};
const slots=[];
for(const stage of ['presente','passato','futuro','strutture'])for(const lesson of read(`data/sentence-lab/${stage}.json`).lessons)for(const activity of lesson.activities){
 for(const [index,blank]of(activity.blanks||[]).entries())if(blank.slot?.agree==='speaker')slots.push({id:activity.id,turn:null,index,blank});
 for(const [turn,item]of(activity.turns||[]).entries())for(const[index,blank]of(item.blanks||[]).entries())if(blank.slot?.agree==='speaker')slots.push({id:activity.id,turn,index,blank});
}
assert.deepEqual(slots.map(s=>[s.id,s.turn,s.index]),[
 ['sl-presente-01-chi-sono.5',null,0],['sl-presente-01-chi-sono.6',3,0],['sl-presente-06-come-stai.5',1,0],['sl-presente-06-come-stai.7',null,0],['sl-strutture-06-una-vera-chiacchierata.4',1,0],
]);
const masculine=new Set(['italiano','americano','spagnolo','tedesco','sono stanco','contento','libero']),feminine=new Set(['italiana','americana','sono stanca','contenta','libera']);let combinations=0;
for(const {blank}of slots)for(const speakerGender of ['m','f'])for(const value of blank.accept){
 const wrong=(speakerGender==='f'?masculine:feminine).has(value),r=assessLabBlank(blank,value,{...ctx,speakerGender});
 assert.equal(r.outcome,wrong?'incorrect':'correct',speakerGender+' '+value);assert.equal(r.filled,wrong?null:value);combinations++;
}
assert.equal(combinations,60);
const activity=read('data/sentence-lab/presente.json').lessons.find(l=>l.id==='sl-presente-06-come-stai').activities.find(a=>a.id==='sl-presente-06-come-stai.5');
for(const speakerGender of ['m','f']){
 const lesson={id:'reaction-review',activities:[activity]},session=createLabSession(lesson),value=speakerGender==='f'?'sono stanca':'sono stanco';
 const r=answerLab(lesson,session,[value],{...ctx,speakerGender}).result;
 assert.deepEqual(r.reaction,{it:'Hai lavorato molto?',en:'Did you work a lot?'});
}
// The source correction must not rewrite an already answered dialogue. These
// exact historical reaction fields were stored in the prior shipping source.
const oldActivity=structuredClone(activity);oldActivity.turns[1].reactions[0]={when:['sono stanco','sono stanca'],it:'Stanco? Hai lavorato molto?',en:'Tired? Did you work a lot?'};
const oldLesson={id:'reaction-review',activities:[oldActivity]},saved=createLabSession(oldLesson);
answerLab(oldLesson,saved,['sono stanca'],{...ctx,speakerGender:'f'});
const restored=JSON.parse(JSON.stringify(saved)),step=currentLabStep({id:'reaction-review',activities:[activity]},restored);
assert(step.state.turns.some(t=>t.reaction&&t.it==='Stanco? Hai lavorato molto?'&&t.en==='Tired? Did you work a lot?'));
assert.deepEqual(restored.state.filled,saved.state.filled,'Saved dialogue wording remains exact');
console.log('All five real speaker slots / 60 authored answer-gender combinations pass; current tiredness reactions are neutral for both genders, and exact saved previous dialogue reactions remain preserved.');
