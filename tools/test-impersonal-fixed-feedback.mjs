import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLesson} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
import {TENSE_BY_KEY} from '../js/conjugator.js';

const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url)));
const entry=verbs.find(e=>e.inf==='trattarsi');
const plan=buildLesson(entry,{questionBuilder:buildJourneyQuestion});
let questions=0,endingErrors=0,controls=0,repairChecks=0;
const checkedTenses=new Set();
for(const chapter of plan.chapters)for(const target of chapter.groups.flatMap(g=>g.targets)){
 if(target.skill!=='conjugation'||target.person!==2||!TENSE_BY_KEY[target.tense]?.compound)continue;
 for(const variant of [0,1])for(const format of ['type','mc','letters','match']){
  const q=buildJourneyQuestion(entry,chapter,target,{phase:'independent',format,variant,scenePolicy:'expanded-v1'});
  assert(q,target.id);assert(q.answer.every(a=>a.endsWith('trattato')));
  assert.equal(q.meta.diagnostic.compound.agreementRule,'impersonal-fixed');
  const typed={...q,type:'type',choices:[]};
  for(const answer of q.answer)assert(gradeQuestion(typed,answer,{accentStrict:true}).ok);
  for(const ending of ['a','i','e']){
   const given=q.answer[0].slice(0,-1)+ending,result=gradeQuestion(typed,given,{accentStrict:true});
   assert.equal(result.ok,false);assert.deepEqual(result.errorTags,['agreement'],target.id+' '+given);
   assert.match(result.feedback,/trattarsi di/);assert.match(result.feedback,/masculine singular: trattato/);
   assert(!/irregular|another person|new person|match.*subject/i.test(result.feedback));
   for(const skill of ['person','auxiliary','participle','clitic'])assert(result.components.some(c=>c.skill===skill&&c.ok),skill);
   assert(result.components.some(c=>c.skill==='agreement'&&!c.ok));endingErrors++;
  }
  const missingClitic=gradeQuestion(typed,q.answer[0].replace(/^si /,''),{accentStrict:true});
  assert.equal(missingClitic.ok,false);assert(missingClitic.errorTags.includes('clitic'));controls++;
  const wrongPP=gradeQuestion(typed,q.answer[0].replace(/trattato$/,'partito'),{accentStrict:true});
  assert.equal(wrongPP.ok,false);assert(wrongPP.errorTags.includes('participle'));controls++;
  const wrongAux=gradeQuestion(typed,`si ${q.meta.diagnostic.compound.allAuxForms.avere[0]} trattato`,{accentStrict:true});
  assert.equal(wrongAux.ok,false);assert(wrongAux.errorTags.includes('auxiliary'));controls++;
  checkedTenses.add(target.tense);questions++;
 }
 for(const repairTag of ['agreement','participle','auxiliary','clitic']){
  const q=buildJourneyQuestion(entry,chapter,target,{phase:'repair',format:'type',variant:0,repairTag,scenePolicy:'expanded-v1'});
  assert(q,target.id+' repair '+repairTag);
  assert(!/lui\/lei|Either applicable gender|requested gender and number|try a new person/i.test([q.prompt,q.tip,q.lesson,q.explanation].join(' ')),target.id+' repair '+repairTag);
  if(repairTag==='agreement'){
   for(const answer of q.answer)assert(['o','trattato'].includes(answer),answer);
   assert.match([q.tip,q.explanation].join(' '),/impersonal|trattarsi di/);
   for(const ending of ['a','i','e']){
    const result=gradeQuestion(q,ending,{accentStrict:true});assert(!result.ok);
    assert.deepEqual(result.errorTags,['agreement']);assert.match(result.feedback,/trattarsi di/);
    assert(!/match.*subject/i.test(result.feedback));repairChecks++;
   }
  }
  repairChecks++;
 }
}
assert.equal(checkedTenses.size,7);
// The new message requires explicit meaning-specific metadata; ordinary
// subject agreement and personal reflexive targets keep their own feedback.
for(const inf of ['restarci','andarsene','lavarsi']){
 const e=verbs.find(x=>x.inf===inf);assert(e);const p=buildLesson(e,{questionBuilder:buildJourneyQuestion});
 const c=p.chapters.find(x=>x.id==='past'),t=c.groups.flatMap(g=>g.targets).find(x=>x.skill==='address');assert(t,inf);
 const q=buildJourneyQuestion(e,c,t,{phase:'independent',format:'type',variant:0,scenePolicy:'expanded-v1'});
 assert.notEqual(q.meta.diagnostic.compound.agreementRule,'impersonal-fixed');
 const result=gradeQuestion(q,q.answer[0].slice(0,-1)+'o',{accentStrict:true});assert(!result.ok);assert(!result.feedback.includes('trattarsi'));controls++;
}
const report={status:'passed',questions,endingErrors,controls,repairChecks,tenses:[...checkedTenses],scope:'Meaning-specific fixed impersonal participle feedback; current questions and scaffolds only, with unrelated agreement controls.'};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--report'))fs.writeFileSync(new URL('../docs/implementation/programme/impersonal-fixed-feedback.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
