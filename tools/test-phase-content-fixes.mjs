#!/usr/bin/env node
// Independent bounded semantic and route regressions for urgent Phase 2 teaching.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { repairPhaseContentPack } from './phase-content-fixes.mjs';
import { assessCourseAnswer, createCourseSession, currentCourseStep } from '../js/learning/course-v2-engine.js';
const packs=['Foundations','A1','A2','B1','B2','C1','C2'].map(level=>JSON.parse(fs.readFileSync(new URL(`../data/course-v2/${level}.json`,import.meta.url))));
const lessons=new Map(packs.flatMap(pack=>pack.units.flatMap(unit=>unit.lessons)).map(lesson=>[lesson.id,lesson]));
const lesson=id=>{assert(lessons.has(id),`missing lesson ${id}`);return lessons.get(id);};
const q=(id,suffix)=>{const s=lesson(id).steps.find(s=>s.id===`${id}.${suffix}`);assert.equal(s?.kind,'question',`missing question ${id}.${suffix}`);return s;};
const grade=(id,suffix,input,outcome)=>assert.equal(assessCourseAnswer(q(id,suffix),input).outcome,outcome,`${id}.${suffix}: ${input}`);

// Alternatives are licensed by context/meaning; wrong distance and preposition
// remain wrong. These assertions are intentionally independent of answer arrays.
for(const suffix of ['s4','s9','review-0']){
  grade('v2-a1-near-far',suffix,'vicina a','correct');
  grade('v2-a1-near-far',suffix,'vicino a','correct');
  grade('v2-a1-near-far',suffix,'lontano da','incorrect');
  grade('v2-a1-near-far',suffix,'vicino','incorrect');
}
for(const suffix of ['s5','s7']){
  grade('v2-a1-near-far',suffix,'lontana da','correct');
  grade('v2-a1-near-far',suffix,'lontano da','correct');
  grade('v2-a1-near-far',suffix,'vicina a','incorrect');
}
for(const suffix of ['s4','s9']){
  grade('v2-a2-past-irregular',suffix,'veduto','correct');
  grade('v2-a2-past-irregular',suffix,'visto','correct');
  grade('v2-a2-past-irregular',suffix,'vedato','incorrect');
}
for(const id of ['v2-a1-near-far','v2-a2-past-irregular'])for(const step of lesson(id).steps.filter(s=>s.kind==='question'))
  for(const error of step.errors||[])assert.equal(assessCourseAnswer(step,error.answer).outcome,'incorrect',`${step.id}: valid variant also diagnosed as an error`);

// The model, including every required reserve person, precedes the first check.
// Full matrices are independently specified to catch missed/incorrect persons.
const expectedModels={
  'v2-a1-present-ere':['vivo','vivi','vive','viviamo','vivete','vivono','prendo','prendi','prende','prendiamo','prendete','prendono'],
  'v2-a1-present-ire':['dormo','dormi','dorme','dormiamo','dormite','dormono','parto','parti','parte','partiamo','partite','partono'],
  'v2-a1-andare':['vado','vai','va','andiamo','andate','vanno'],
  'v2-a1-fare':['faccio','fai','fa','facciamo','fate','fanno'],
  'v2-a1-venire':['vengo','vieni','viene','veniamo','venite','vengono'],
  'v2-a1-potere-requests':['posso','puoi','può','possiamo','potete','possono'],
  'v2-a1-want-need':['voglio','vuoi','vuole','vogliamo','volete','vogliono','devo','devi','deve','dobbiamo','dovete','devono'],
  'v2-a2-past-auxiliary-person':['ho','hai','ha','abbiamo','avete','hanno'],
  'v2-a2-essere-plural':['sono','sei','è','siamo','siete','andato','andata','andati','andate'],
  'v2-a2-imperfect-are':['parlavo','parlavi','parlava','parlavamo','parlavate','parlavano'],
  'v2-a2-imperfect-ere-ire':['leggevo','leggevi','leggeva','leggevamo','leggevate','leggevano','dormivo','dormivi','dormiva','dormivamo','dormivate','dormivano'],
  'v2-a2-imperfect-states':['ero','eri','era','eravamo','eravate','erano','avevo','avevi','aveva','avevamo','avevate','avevano'],
  'v2-a2-progressive-present':['sto','stai','sta','stiamo','state','stanno','parlando','leggendo'],
  'v2-a2-progressive-past':['stavo','stavi','stava','stavamo','stavate','stavano'],
  'v2-a2-future-are':['parlerò','parlerai','parlerà','parleremo','parlerete','parleranno'],
  'v2-a2-future-ere-ire':['prenderò','prenderai','prenderà','prenderemo','prenderete','prenderanno','dormirò','dormirai','dormirà','dormiremo','dormirete','dormiranno'],
  'v2-a2-future-irregular':['sarò','sarai','sarà','saremo','sarete','saranno','avrò','avrai','avrà','avremo','avrete','avranno','andrò','andrai','andrà','andremo','andrete','andranno'],
  'v2-a2-conditional-request':['vorrei','vorresti','vorrebbe','vorremmo','vorreste','vorrebbero','potrei','potresti','potrebbe','potremmo','potreste','potrebbero'],
  'v2-a2-conditional-plan':['andrei','andresti','andrebbe','andremmo','andreste','andrebbero','farei','faresti','farebbe','faremmo','fareste','farebbero'],
};
for(const [id,forms] of Object.entries(expectedModels)){
  const l=lesson(id),firstQuestion=l.steps.findIndex(s=>s.kind==='question');
  const text=l.steps.slice(0,firstQuestion).filter(s=>s.kind==='teach').flatMap(s=>[s.body,...s.examples.map(e=>e.it)]).join(' ');
  const tokens=new Set(text.match(/[\p{L}]+/gu));
  for(const form of forms)assert(tokens.has(form),`${id}: required ${form} has no pre-check model`);
  assert(/Lei/.test(text),`${id}: explicit formal Lei mapping missing`);
}
grade('v2-a1-want-need','review-0','vuole','correct');
grade('v2-a1-want-need','review-0','voglio','incorrect');
grade('v2-a1-want-need','review-1','deve','correct');
for(const [id,form,wrong] of [['v2-a1-andare','andate','vanno'],['v2-a1-fare','fate','fanno'],['v2-a1-venire','venite','vengono']]){
  grade(id,'review-1',form,'correct');grade(id,'review-1',wrong,'incorrect');
}

// Facet repairs are displayed by the actual engine, including miss-to-recheck
// paths. A legacy pack with no facet metadata still receives its generic repair.
for(const [id,facet,expected] of [
  ['v2-f-greet','farewell',/Arrivederci.*goodbye|goodbye.*Arrivederci/i],
  ['v2-a1-one-thing','feminine-elision',/un’amica/],
  ['v2-a2-direct-elision-negation','non-first',/non.*pronoun.*verb/i],
]){
  const l=lesson(id),session=createCourseSession(l);
  session.courseV2.phase='repair';session.courseV2.activeTargetId=l.targets[0].id;session.courseV2.activeFacet=facet;
  const view=currentCourseStep(l,session);
  assert.equal(view.kind,'repair');assert.match(view.step.body,expected,`${id}: wrong repair facet`);
  assert.equal(view.step.title,l.targets[0].repair.byFacet[facet].title,`${id}: engine did not select facet repair`);
  const legacy=structuredClone(l);delete legacy.targets[0].repair.byFacet;
  assert.equal(currentCourseStep(legacy,session).step.body,legacy.targets[0].repair.body,`${id}: generic fallback lost`);
}
assert.match(q('v2-a2-direct-singular','s10').explanation,/Pizza/);
assert.doesNotMatch(q('v2-a2-direct-singular','s10').explanation,/Casa/);
assert.equal(q('v2-a1-days-clock','review-1').speak,'Il treno parte all’una.');
assert.equal(q('v2-b2-dislocation','check-1').speak,'La lettera, l’ho scritta ieri.');
const ce=lesson('v2-b1-ce-ne-quantity');
assert.match(ce.targets[0].explanation,/Ne means.*ci means.*for us.*changes to ce/i);
assert.match(q(ce.id,'check-4').explanation,/no ci|needs no ci/);
grade(ce.id,'check-4','Ne','correct');
assert.notEqual(assessCourseAnswer(q(ce.id,'check-4'),'Ce ne').outcome,'correct','an unrecognised open reply cannot receive correctness credit');
assert(lesson('v2-c1-u1-subjunctive-perspective').prerequisites.includes('v2-b2-tense-relations'));
assert(lesson('v2-c2-u1-mood-evidence').prerequisites.includes('v2-c1-u3-qualified-conclusion'));

// Authoring fixes are scoped, reproducible and do not replace unrelated edits.
for(const pack of packs){
  const once=repairPhaseContentPack(structuredClone(pack)),twice=repairPhaseContentPack(structuredClone(once));
  assert.deepEqual(twice,once,`${pack.level}: repairs are not idempotent`);
  assert.deepEqual(once,pack,`${pack.level}: current pack disagrees with canonical scoped repair`);
  const probe=structuredClone(pack);probe.units[0].description+=' [unrelated hand edit]';
  const description=probe.units[0].description;
  assert.equal(repairPhaseContentPack(probe).units[0].description,description);
}
// Re-run the canonical authors in a disposable directory. The live packs and
// their hand edits are never overwritten by this generator consistency check.
const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'parola-phase2-authors-'));
try{
  fs.mkdirSync(path.join(scratch,'tools'),{recursive:true});
  fs.mkdirSync(path.join(scratch,'data'),{recursive:true});
  for(const filename of ['author-course-beginner.mjs','author-course-intermediate.mjs','course-beginner-refinements.mjs','course-beginner-checkpoints.mjs','course-pronunciation-lessons.mjs','phase-content-fixes.mjs'])
    fs.copyFileSync(path.join(sourceRoot,'tools',filename),path.join(scratch,'tools',filename));
  for(const dirname of ['course-v2','grammar-course'])fs.cpSync(path.join(sourceRoot,'data',dirname),path.join(scratch,'data',dirname),{recursive:true});
  execFileSync(process.execPath,['tools/author-course-beginner.mjs'],{cwd:scratch,stdio:'pipe'});
  execFileSync(process.execPath,['tools/author-course-intermediate.mjs'],{cwd:scratch,stdio:'pipe'});
  for(const level of ['Foundations','A1','A2','B1','B2']){
    const generated=JSON.parse(fs.readFileSync(path.join(scratch,'data/course-v2',level+'.json')));
    assert.deepEqual(repairPhaseContentPack(structuredClone(generated)),generated,`${level}: canonical author lost a scoped Phase 2 repair`);
    for(const l of generated.units.flatMap(u=>u.lessons))if(expectedModels[l.id])
      assert.deepEqual(l.steps.find(s=>s.id.endsWith('.phase2-full-forms')),lesson(l.id).steps.find(s=>s.id.endsWith('.phase2-full-forms')),`${l.id}: canonical author lost full-person model`);
  }
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
console.log(`Phase 2 content regressions passed: valid alternatives, 19 pre-check paradigms, facet repairs, source consistency and bridges (${lessons.size} lessons retained).`);
