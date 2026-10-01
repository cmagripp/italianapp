#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLesson,lessonContexts,lessonForms} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {simpleVerbContexts,progressiveContexts} from '../js/learning/progressive-content.js';

const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url)));
const entry=inf=>verbs.find(e=>e.inf===inf);
const chapter=(plan,id)=>plan.chapters.find(c=>c.id===id);
const target=(ch,id)=>ch.groups.flatMap(g=>g.targets).find(t=>t.id.endsWith(`::${id}`));
const newQuestion=(e,ch,t,variant)=>buildJourneyQuestion(e,ch,t,{variant,scenePolicy:'expanded-v1'});

// The user's repeated avere prompt should now vary in lexical meaning as well
// as person, while previously saved numeric variants still reconstruct.
{
 const e=entry('avere'),ch=chapter(buildLesson(e),'present');
 for(let person=0;person<6;person++){
  const t=target(ch,`form-${person}`);
  assert(t.contexts.length>=6,`avere ${person}: six reviewed practice situations`);
  assert.equal(t.legacyAuthoredContexts.length,2,`avere ${person}: old pool retained`);
  assert.equal(new Set(t.contexts.map(c=>c.id)).size,t.contexts.length);
  assert.equal(newQuestion(e,ch,t,0).context.it,t.contexts[0].it);
  assert.equal(buildJourneyQuestion(e,ch,t,{variant:2,scenePolicy:undefined}).context.it,t.legacyAuthoredContexts[0].it);
 }
 const firstScenes=Array.from({length:6},(_,person)=>newQuestion(e,ch,target(ch,`form-${person}`),0).context.it);
 assert(new Set(firstScenes.map(it=>it.replace(/^(?:Io|Tu|Marta|Noi|Voi|Marta e Luca)\s+\S+\s*/,'').toLowerCase())).size>=4,'first form questions vary the situation');
 const mixed=target(ch,'v2-mixed-simple'),practice=ch.groups.flatMap(g=>g.targets).filter(t=>t.id.includes('::form-'));
 const practiceIds=new Set(practice.flatMap(t=>t.contexts.map(c=>c.id)));
 assert(mixed.contexts.every(c=>!practiceIds.has(c.id)),'held-out review is separate');
 assert.notEqual(mixed.contexts[0].it.replace(/^(?:Io|Tu|Marta|Noi|Voi|Loro)\s+\S+\s*/,'').toLowerCase(),mixed.contexts[1].it.replace(/^(?:Io|Tu|Marta|Noi|Voi|Loro)\s+\S+\s*/,'').toLowerCase(),'consecutive review situations differ');
 assert.equal(target(ch,'context').required,false,'context retrieval is covered by contextual form targets');
 assert.equal(target(ch,'context').coveredByContextualForms,true);
 assert(ch.groups.find(g=>g.id==='use').cards.length,'usage teaching remains');
 const future=chapter(buildLesson(e),'future'),futureQuestion=newQuestion(e,future,target(future,'context'),0);
 assert(!futureQuestion.meta.diagnostic.viewpointMessage,'future scenes do not get a present/progressive contrast hint');
}

// Every generated frame is traceable to a reviewed verb record, contains its
// exact answer, and obeys the person/tense and auxiliary constraints.
{
 const tense={past:'passatoProssimo',future:'futuro',condizionale:'condizionale'};
 const coverage={past:0,future:0,condizionale:0};
 for(const e of verbs)for(const ch of Object.keys(tense)){
  const old=lessonContexts(e,ch,{expanded:false}),all=lessonContexts(e,ch);
  assert.deepEqual(all.slice(0,old.length),old,`${e.inf}/${ch}: original scenes stay first`);
  const fresh=all.slice(old.length);
  if(fresh.length)coverage[ch]++;
  assert.equal(new Set(all.map(c=>c.id)).size,all.length,`${e.inf}/${ch}: unique IDs`);
  for(const c of fresh){
   assert.equal(c.source,'reviewed-frame');
   assert(c.it.toLocaleLowerCase('it').includes(c.answer.toLocaleLowerCase('it')),c.it);
   assert(c.answers.includes(c.answer),c.it);
   assert(c.answers.every(answer=>lessonForms(e,tense[ch],c.person).includes(answer)),`${e.inf}/${ch}: ${c.answers}`);
   assert(!/\{[^}]+\}|\b(?:will|would) can\b|\bdid you be(?:\s|\?)|\bwere you be(?:\s|\?)/i.test(c.en),c.en);
   if(ch==='past')assert(['avere','essere'].includes(c.aux));
   if(ch==='past'&&c.aux==='essere'&&c.role==='formal')assert(c.answers.every(answer=>answer.endsWith('a')));
   if(ch==='past'&&c.aux==='essere'&&c.person===5)assert(c.answers.every(answer=>answer.endsWith('i')));
  }
 }
 assert(coverage.past>=995,JSON.stringify(coverage));
 assert(coverage.future>=1100,JSON.stringify(coverage));
 assert(coverage.condizionale>=1100,JSON.stringify(coverage));
 console.log('Reviewed frame coverage:',coverage);
}

// Conservative boundaries: unknown or exact-clitic records never borrow a
// generic lexical tail, and weather/nonhuman subjects remain scoped.
{
 const custom={id:'v:inventato',inf:'inventato',en:'to invent',aux:'avere'};
 for(const ch of ['past','future','condizionale'])assert.deepEqual(lessonContexts(custom,ch),[]);
 assert.equal(lessonContexts(entry('piacere'),'past').filter(c=>c.source==='reviewed-frame').length,0);
 assert.equal(lessonContexts(entry('valere'),'past').filter(c=>c.source==='reviewed-frame').length,0);
 const weather=lessonContexts(entry('piovere'),'future').filter(c=>c.source==='reviewed-frame');
 assert(weather.length>=2&&weather.every(c=>c.person===2&&c.role==='ordinary'));
 const reflexive=lessonContexts(entry('pettinarsi'),'past').filter(c=>c.source==='reviewed-frame');
 assert(reflexive.some(c=>c.it.includes('mi sono pettinato')&&c.en.includes('my hair')));
 assert(reflexive.some(c=>c.role==='formal'&&c.answer.endsWith('a')&&c.en.includes('your hair')));
 const clitic=lessonContexts(entry('andarsene'),'past').filter(c=>c.source==='reviewed-frame');
 assert(clitic.some(c=>c.it.includes('me ne sono andato')&&c.en.includes('I left')));
 const reviewed=(inf,ch)=>lessonContexts(entry(inf),ch).filter(c=>c.source==='reviewed-frame');
 assert(reviewed('dire','past').some(c=>c.it.includes('detto la verità')&&c.en.includes('told the truth')));
 assert(reviewed('dire','future').some(c=>c.it.includes('dirò la verità')&&c.en.includes('will tell the truth')));
 assert(simpleVerbContexts(entry('dire')).some(c=>c.it.includes('dico la verità')&&c.en.includes('tell the truth')));
 assert(simpleVerbContexts(entry('dire'),{legacySelection:true}).some(c=>c.it.includes('dico la verità')&&c.en.includes('say the truth')));
 assert(reviewed('sapere','past').some(c=>c.it.includes('saputo la risposta')&&c.en.includes('found out the answer')));
 assert(reviewed('conoscere','past').some(c=>c.it.includes('conosciuto Marco')&&c.en.includes('met Marco')));
 assert(reviewed('conoscere','past').some(c=>c.it.includes('conosciuto questa città')&&c.en.includes('got to know this city')));
 assert(reviewed('volere','condizionale').some(c=>c.it.includes('vorrei un caffè')&&c.en.includes('would like a coffee')));
 assert(reviewed('ritenere','past').some(c=>c.it.includes('ritenuto la proposta valida')&&c.en.includes('considered the proposal valid')));
 const oldMixed=simpleVerbContexts(entry('avere'),{section:'mixed',legacySelection:true});
 assert.equal(oldMixed.length,14);
 const newMixed=simpleVerbContexts(entry('avere'),{section:'mixed'});
 assert.equal(newMixed.length,14);
 assert(progressiveContexts(entry('viaggiare'),{section:'mixed'}).every(c=>!progressiveContexts(entry('viaggiare')).some(x=>x.id===c.id)));
}

console.log('Verb scene variety checks passed.');
