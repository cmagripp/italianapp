import assert from 'node:assert/strict';
import fs from 'node:fs';
import { data } from '../js/data.js';
import { createLearning, normalizeLearning, mergeLearning, recordAttempt, skillState, resetLearning } from '../js/learning/model.js';
import { installGrammarCourse, grammarCourse, grammarProgress, grammarReviewSkills } from '../js/learning/grammar-course.js';
import { createGrammarSession, currentGrammarQuestion, advanceGrammar, grammarAttempt, checkGrammarAnswer } from '../js/learning/grammar-journey.js';
const levels=['A1','A2','B1','B2','C1','C2'];
const packs=levels.map(level=>JSON.parse(fs.readFileSync(new URL(`../data/grammar-course/${level}.json`,import.meta.url))));
const dictionary=[...JSON.parse(fs.readFileSync(new URL('../data/vocab.json',import.meta.url))),...JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url)))];
const entryIds=new Set(dictionary.map(e=>e.id));
installGrammarCourse(packs);
const errors=[],ids=new Set(),objectives=new Set(),questions=new Set();
let nquestions=0;
const valid=(condition,message)=>{if(!condition)errors.push(message);};
for(const [i,pack] of packs.entries()) {
 valid(pack.level===levels[i],`Wrong level ${pack.level}`);valid(pack.sources?.length,`${pack.level}: no sources`);
 for(const unit of pack.units){valid(unit.title&&unit.description,`${unit.id}: missing unit text`);
 for(const lesson of unit.lessons){
  valid(!ids.has(lesson.id),`Duplicate lesson ${lesson.id}`);ids.add(lesson.id);
  valid(lesson.outcome&&lesson.takeaway&&lesson.minutes>=3&&lesson.minutes<=12,`${lesson.id}: missing outcome/takeaway or unreasonable duration`);
  valid(lesson.objectives?.length>=1&&lesson.objectives.length<=2,`${lesson.id}: must be focused`);
  for(const link of lesson.related || [])valid(entryIds.has(link.entryId),`${lesson.id}: missing dictionary link ${link.entryId}`);
  for(const o of lesson.objectives){valid(!objectives.has(o.id),`Duplicate objective ${o.id}`);objectives.add(o.id);
   valid(o.label&&o.explanation&&o.errorTag,`${o.id}: missing objective teaching metadata`);
   valid(o.teach?.length>=2,`${o.id}: at least two teaching beats`);
   for(const t of o.teach || []){valid(t.title&&t.body&&t.examples?.length,`${o.id}: missing teaching text/examples`);for(const ex of t.examples || [])valid(ex.it&&ex.en,`${o.id}: missing translation`);}
   valid(o.questions?.length>=4,`${o.id}: insufficient variants`);valid(new Set(o.questions.map(q=>q.format)).size>=2,`${o.id}: insufficient exercise variety`);
   for(const q of o.questions){nquestions++;valid(!questions.has(q.id),`Duplicate question ${q.id}`);questions.add(q.id);
    valid(q.prompt&&q.explanation&&q.hint&&q.errorTag,`${q.id}: missing prompt/feedback/hint/error tag`);
    valid(['choice','type','order','match'].includes(q.format),`${q.id}: invalid format`);
    if(q.format==='choice'){valid(q.options?.length>=2&&q.options.includes(q.answer),`${q.id}: answer not in choices`);valid(new Set(q.options).size===q.options.length,`${q.id}: duplicate choices`);}
    else if(q.format==='order'){const bag=x=>x.normalize('NFC').replace(/[’‘]/g,"'").toLocaleLowerCase('it').split(/\s+/).sort().join('|');valid(q.tokens?.length>=2&&bag(q.tokens.join(' '))===bag(q.answer),`${q.id}: token bank cannot make accepted answer`);}
    else if(q.format==='match')valid(q.pairs?.length>=3&&q.pairs.every(p=>p.left&&p.right)&&new Set(q.pairs.map(p=>p.right)).size===q.pairs.length,`${q.id}: ambiguous/broken matching`);
    else valid(q.answer,`${q.id}: missing answer`);
   }
  }
 }}
}
const lessonMap=new Map(grammarCourse.lessons.map(l=>[l.id,l]));
for(const lesson of grammarCourse.lessons)for(const id of lesson.prerequisites || [])valid(lessonMap.has(id),`${lesson.id}: missing prerequisite ${id}`);
function visit(id,stack=new Set(),done=new Set()) {if(stack.has(id)){errors.push(`Prerequisite cycle ${id}`);return;}if(done.has(id)||!lessonMap.has(id))return;stack.add(id);for(const prev of lessonMap.get(id).prerequisites || [])visit(prev,stack,done);stack.delete(id);done.add(id);}
for(const id of lessonMap.keys())visit(id);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Content validated: ${grammarCourse.lessons.length} lessons, ${objectives.size} objectives, ${nquestions} authored exercises across six levels.`);
let sequence=0,learning=createLearning(1700000000000);
function add(session,q,lesson,value,patch={}){const event={...grammarAttempt(lesson,session,q,value),...patch,id:`test:${++sequence}`,deviceId:'test',sequence,epochId:learning.epoch.id,at:1700000000000+sequence*1000};learning=recordAttempt(learning,event).learning;return event;}
for(const lesson of grammarCourse.lessons){
 const session=createGrammarSession(lesson,{now:1700000000000});let answers=0;
 for(let i=0;i<100&&session.grammar.phase!=='complete';i++){
  if(session.grammar.phase==='question'){
   const q=currentGrammarQuestion(lesson,session),value=q.format==='match'?q.pairs.map((_,i)=>i):q.answer;
   const e=add(session,q,lesson,value);session.grammar.result={ok:e.ok,assisted:false,questionId:q.id};answers++;
  }
  advanceGrammar(lesson,session,learning);
 }
 assert.equal(session.grammar.phase,'complete',`${lesson.id}: real correct answers must finish`);
 assert(grammarProgress(lesson,learning).complete,`${lesson.id}: completed objectives`);
 assert(answers>=3,`${lesson.id}: one guess must not skip learning`);
}
console.log(`Every lesson completed using real question/advance/evidence logic; ${sequence} actual answers.`);
assert.equal(grammarReviewSkills({learning},1701000000000).length,objectives.size);
assert.equal(Object.keys(learning.completions).length,0,'Grammar never marks dictionary items complete');
const first=grammarCourse.lessons[0],objective=first.objectives[0],q=objective.questions.find(q=>q.format!=='match');
learning=createLearning();let session=createGrammarSession(first);session.grammar.phase='question';session.grammar.guided=false;
let e=add(session,q,first,q.answer);assert.equal(skillState(learning,objective.id).ready,false,'One answer insufficient');
session.index=2;add(session,q,first,q.answer);assert.equal(skillState(learning,objective.id).ready,false,'Repeated question insufficient');
for(let i=0;i<5;i++){session.index+=3;add(session,objective.questions[i%4],first,objective.questions[i%4].answer,{assistance:['hint']});}
assert.equal(skillState(learning,objective.id).ready,false,'Hints never establish readiness');
const normalized=normalizeLearning({...learning,version:3});assert.equal(normalized.version,4);assert(Object.values(normalized.events).every(e=>e.kind==='grammar'));
const draft={...session,updatedAt:5};draft.grammar.draft='Vorrei';learning.sessions={'g:test|lesson':draft};learning.session=draft;
const merged=mergeLearning(learning,createLearning());assert(Object.values(merged.sessions).some(s=>s.grammar.draft==='Vorrei'));
assert.deepEqual(mergeLearning(learning,normalized),mergeLearning(normalized,learning),'Deterministic merge');
assert.equal(Object.keys(resetLearning(learning,Date.now(),'new').events).length,0);
console.log('Guess, repeat, assistance, dictionary isolation, migration, draft merge, and reset checks passed.');
