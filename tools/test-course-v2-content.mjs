#!/usr/bin/env node
// Release gate for the new authored course. Runtime reachability is separate
// from linguistic review and the independent answer/evidence regression suite.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createLearning,recordAttempt} from '../js/learning/model.js';
import {createCourseSession,currentCourseStep,submitCourseAnswer,advanceCourse,courseSessionProgress} from '../js/learning/course-v2-engine.js';
const levels=['Foundations','A1','A2','B1','B2','C1','C2'],baselineUnits=[3,14,15,13,13,12,12],addedLessons=[3,21,12,12,6,6,6];
const addedUnitIds=[['v2-foundations-u4'],Array.from({length:10},(_,i)=>`v2-a1-u${i+15}`),Array.from({length:4},(_,i)=>`v2-a2-u${i+16}`),
 ['v2-b1-followup-accounts','v2-b1-practical-viewpoints','v2-b1-collaborative-solutions','v2-b1-faithful-briefs'],
 ['v2-b2-community-evidence','v2-b2-workshop-register','v2-b2-service-relay'],
 ['v2-c1-evidence-proposal','v2-c1-interview-stance','v2-c1-reader-reformulation'],
 ['v2-c2-editorial-interpretation','v2-c2-spoken-distance','v2-c2-comparative-brief']];
const available=process.argv.includes('--available'),errors=[],lessons=[],ids=new Set(),stepIds=new Set();
const ok=(condition,message)=>{if(!condition)errors.push(message);};
const norm=s=>String(s||'').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g,"'").replace(/[.!?,;:]+$/g,'').trim().replace(/\s+/g,' ');
const bag=s=>norm(s).replace(/[.,!?;:]/g,'').split(/\s+/).sort().join('|');
const dictionary=new Set(['vocab','verbs'].flatMap(name=>JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`,import.meta.url)))).map(e=>e.id));
let questionCount=0;
for(const [index,level] of levels.entries()){
 const path=new URL(`../data/course-v2/${level}.json`,import.meta.url);
 if(available&&!fs.existsSync(path))continue;
 const pack=JSON.parse(fs.readFileSync(path));
 ok(pack.version===2&&pack.level===level,`${level}: pack version/level`);
 if(!available){
  const baseline=JSON.parse(execFileSync('git',['show',`7eeeb36:data/course-v2/${level}.json`],{encoding:'utf8'})),oldIds=baseline.units.flatMap(u=>u.lessons.map(l=>l.id)),currentIds=pack.units.flatMap(u=>u.lessons.map(l=>l.id));
  ok(baseline.units.length===baselineUnits[index],`${level}: baseline unit inventory changed`);
  ok(pack.units.length===baselineUnits[index]+addedUnitIds[index].length,`${level}: expected baseline plus ${addedUnitIds[index].length} declared expansion units`);
  ok(addedUnitIds[index].every(id=>pack.units.some(u=>u.id===id)),`${level}: a declared expansion unit is missing`);
  ok(oldIds.every(id=>currentIds.includes(id)),`${level}: a baseline lesson identity is missing`);
  ok(currentIds.length===oldIds.length+addedLessons[index],`${level}: expected baseline plus ${addedLessons[index]} authored additions`);
 }
 ok(pack.sources?.length,`${level}: sources missing`);
 for(const unit of pack.units){
  ok(unit.title&&unit.description&&unit.lessons.length>=2,`${unit.id}: missing focused lessons`);
  const unitSteps=unit.lessons.flatMap(l=>l.steps);
  for(const mode of ['read','listen'])ok(unitSteps.some(s=>s.kind==='passage'&&s.mode===mode),`${unit.id}: missing ${mode} input`);
  ok(unitSteps.some(s=>s.kind==='portfolio'),`${unit.id}: missing a response with self-review`);
  for(const raw of unit.lessons){
   const l={...raw,level,unitId:unit.id};lessons.push(l);
   ok(l.id?.startsWith('v2-')&&!ids.has(l.id),`${l.id}: ID duplicate/version`);ids.add(l.id);
   ok(l.title&&l.outcome&&l.takeaway&&l.minutes>0,`${l.id}: lesson purpose`);
   ok(l.targets?.length>0&&l.targets.length<=3,`${l.id}: focus 1–3 targets`);
   ok(l.steps[0]?.kind==='words',`${l.id}: begin with language preparation`);
   const targets=new Map(l.targets.map(t=>[t.id,t])),introduced=new Set(),guided=new Set();
   for(const link of l.related||[])ok(dictionary.has(link.entryId),`${l.id}: unknown dictionary link ${link.entryId}`);
   for(const s of l.steps){
    ok(s.id&&!stepIds.has(s.id),`${l.id}: duplicate step ${s.id}`);stepIds.add(s.id);
    ok(['words','teach','question','passage','portfolio'].includes(s.kind),`${s.id}: unknown step kind`);
    if(s.kind==='words')ok(s.words?.length&&s.words.every(w=>w.it&&w.en),`${s.id}: glosses missing`);
    if(s.kind==='teach'){
     ok(s.title&&s.body&&s.examples?.length&&s.examples.every(e=>e.it&&e.en),`${s.id}: model/meaning missing`);
     for(const id of s.introduces||[]){ok(targets.has(id),`${s.id}: unknown introduced target`);introduced.add(id);}
    }
    if(s.kind==='passage')ok(s.it&&s.en&&['read','listen'].includes(s.mode)&&(s.mode!=='listen'||s.audioId),`${s.id}: passage/audio metadata`);
    if(s.kind==='portfolio')ok(s.prompt&&s.model&&s.rubric?.length>=2,`${s.id}: application lacks model/rubric`);
    if(s.kind!=='question')continue;
    questionCount++;const target=targets.get(s.target);
    ok(target&&introduced.has(s.target),`${s.id}: assessed before its model`);
    ok(target?.facets.includes(s.facet),`${s.id}: unauthored facet`);
    ok(s.prompt&&s.explanation&&s.hint&&s.contextKey,`${s.id}: feedback/context required`);
    ok(['guided','independent'].includes(s.stage),`${s.id}: missing support stage`);
    if(s.stage==='guided')guided.add(s.target);
    else ok(guided.has(s.target),`${s.id}: no supported attempt before independent work`);
    if(s.format==='choice')ok(s.options?.length>=2&&s.options.includes(s.answer)&&new Set(s.options).size===s.options.length,`${s.id}: choices invalid`);
    else if(s.format==='match')ok(s.pairs?.length>=2&&new Set(s.pairs.map(p=>norm(p.right))).size===s.pairs.length&&s.pairs.every(p=>p.left&&p.right),`${s.id}: ambiguous matching`);
    else if(s.format==='order'){
     ok(s.tokens?.length>1&&bag(s.tokens.join(' '))===bag(s.answer),`${s.id}: token bank cannot make answer`);
     if(s.stage==='independent')ok(!s.context||!norm(s.context).includes(norm(s.answer)),`${s.id}: independent answer is displayed`);
    }else ok(s.format==='type'&&s.answer,`${s.id}: invalid writing task`);
    ok(!(s.errors||[]).some(e=>[s.answer,...s.accepted||[]].some(a=>norm(e.answer)===norm(a))),`${s.id}: valid form also diagnosed as error`);
   }
   for(const target of l.targets){
    const independent=l.steps.filter(s=>s.kind==='question'&&s.target===target.id&&s.stage==='independent');
    ok(target.id.startsWith(l.id+'.')&&target.label&&target.explanation&&target.repair?.body&&target.repair?.examples?.length,`${target.id}: target/repair contract`);
    ok(target.minIndependent>=2&&target.minIndependent<=independent.length,`${target.id}: impossible evidence requirement`);
    ok(independent.length>=3&&new Set(independent.map(s=>s.contextKey)).size>=3,`${target.id}: need fresh independent contexts`);
    for(const facet of target.facets)ok(independent.filter(s=>s.facet===facet).length>=2,`${target.id}: ${facet} needs a fresh repair variant`);
    if(target.requiresProduction)ok(independent.some(s=>s.format==='type'),`${target.id}: productive goal without a production check`);
   }
  }
 }
}
for(const l of lessons)for(const id of l.prerequisites||[])if(!available)ok(ids.has(id),`${l.id}: unknown prerequisite ${id}`);
const map=new Map(lessons.map(l=>[l.id,l])),done=new Set();
function visit(id,stack=new Set()){if(stack.has(id)){errors.push('Prerequisite cycle '+id);return;}if(done.has(id)||!map.has(id))return;stack.add(id);for(const id2 of map.get(id).prerequisites||[])visit(id2,stack);stack.delete(id);done.add(id);}
for(const l of lessons)visit(l.id);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Validated ${lessons.length} lessons and ${questionCount} questions${available?' (available development packs only)':''}.`);
let totalAnswers=0;
for(const l of lessons){
 try {
 let learning=createLearning(),session=createCourseSession(l),iterations=0;
 while(iterations++<l.steps.length*5+40){
  const view=currentCourseStep(l,session);
  if(view.kind==='complete')break;
  assert.notEqual(view.kind,'exhausted',`${l.id}: correct learner exhausted bank at ${view.target?.id}`);
  if(view.kind==='question'){
   const q=view.step,value=q.format==='match'?q.pairs.map((_,i)=>i):q.answer;
   const submitted=submitCourseAnswer(l,session,value,{audioAvailable:true});session=submitted.session;
   assert.equal(submitted.event?.ok,true,`${q.id}: expected answer rejected`);
   learning=recordAttempt(learning,{...submitted.event,epochId:learning.epoch.id}).learning;totalAnswers++;
  }
  session=advanceCourse(l,session,learning);
 }
 assert.equal(session.courseV2.phase,'complete',`${l.id}: all-correct learner cannot finish`);
 assert(courseSessionProgress(l,session,learning).complete,`${l.id}: missing demonstrated target`);
 assert.equal(Object.keys(learning.completions).length,0,'Grammar targets must not complete verb cases or words on their own');
 }catch(error){errors.push(error.message);}
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Every authored lesson traversed and completed with actual engine/evidence logic (${totalAnswers} answers).`);

if(process.argv.includes('--recovery')) {
 let paths=0;
 for(const l of lessons)for(const missed of l.steps.filter(s=>s.kind==='question'&&s.stage==='independent'&&!s.reserve)){
  let learning=createLearning(),session=createCourseSession(l),failed=false,iterations=0;
  while(iterations++<l.steps.length*8+60){
   const view=currentCourseStep(l,session);if(['complete','exhausted'].includes(view.kind))break;
   if(view.kind==='question'){
    const q=view.step,wrong=!failed&&q.id===missed.id;failed ||= wrong;
    const value=wrong?(q.format==='match'?[]:'__deliberately_wrong__'):q.format==='match'?q.pairs.map((_,i)=>i):q.answer;
    const result=submitCourseAnswer(l,session,value,{audioAvailable:true});session=result.session;
    if(result.event)learning=recordAttempt(learning,{...result.event,epochId:learning.epoch.id}).learning;
   }
   session=advanceCourse(l,session,learning);
  }
  if(failed&&session.courseV2.phase!=='complete')errors.push(`${l.id}: one-mistake recovery exhausted after ${missed.id}`);
  paths++;
 }
 if(errors.length){console.error(errors.join('\n'));process.exit(1);}
 console.log(`${paths} single-error paths recover through the real repair and evidence engine.`);
}
