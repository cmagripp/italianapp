#!/usr/bin/env node
// Lesson vocabulary drill: every course-v2 lesson's glosses resolve deterministically and the
// synthesised "Le parole di oggi" boards are well formed. Run as `node tools/test-course-words.mjs`.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { article, isPluralOnly } from '../js/data.js';
import { LESSON_CONTENT_VERSION, buildLesson } from '../js/learning/lesson-content.js';
import { resolveLessonWords, wordsCheckSteps, wordsCheckPlan, lessonWordIds } from '../js/learning/course-words.js';
import { installGrammarCourse, attachLessonVocabulary, grammarCourse, grammarLesson } from '../js/learning/grammar-course.js';
const levels=['Foundations','A1','A2','B1','B2','C1','C2'];
const read=path=>JSON.parse(fs.readFileSync(new URL(`../data/${path}.json`,import.meta.url)));
const packs=levels.map(level=>read(`course-v2/${level}`)),vocab=read('vocab'),verbs=read('verbs');
const byId=new Map([...vocab,...verbs].map(e=>[e.id,e]));
// Coverage (resolved words + verbs over all glosses) measured once conjugated forms resolve and the basic chunks are in the
// dictionary: Foundations 85.3%, A1 91.9%, A2 88.6% (the rest are proper names, whole sentences and multi-word chunks).
// Rounded down to a multiple of 5; a dictionary or course edit that drops below this fails the check.
const MIN_COVERAGE={Foundations:85,A1:90,A2:85};
const errors=[],ok=(condition,message)=>{if(!condition)errors.push(message);};
const SKILLS={meaning:['meaning'],recall:['recall'],forms:['article','plural']};
const PROMPTS={meaning:'Match each word to its meaning',recall:'Now from the English',forms:'Match the article to its noun'};
const plans=new Map(),slotsFor=id=>{if(!plans.has(id))plans.set(id,buildLesson(byId.get(id)));return plans.get(id);};
// The article/plural skills a noun's short lesson makes available (these are exactly the rows the strict credit rule needs).
const formSkills=id=>{const plan=slotsFor(id),targets=plan.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets));return [...new Set(plan.wordLesson.slots.map(s=>targets.find(t=>t.id===s.targetId)).filter(t=>t&&t.available!==false&&['article','plural'].includes(t.skill)).map(t=>t.skill))].sort();};
// Independent model of the forms board: one row per available skill; rows split into rounds of 2 to 6 with distinct articles and
// distinct forms exactly when N >= 2 * max(ceil(N / 6), largest multiplicity of one article or form).
const norm=s=>String(s).normalize('NFC').toLocaleLowerCase('it');
const rowsFor=id=>{const e=byId.get(id),first=a=>String(a||'').split('/')[0];return formSkills(id).map(skill=>skill==='article'?[first(article(e,isPluralOnly(e))),norm(isPluralOnly(e)?e.pl:e.it)]:[first(article(e,true)),norm(e.pl)]);};
const feasible=rows=>{if(!rows.length)return true;const n=new Map();for(const [a,f] of rows)for(const k of['a:'+a,'f:'+f])n.set(k,(n.get(k)||0)+1);return rows.length>=2&&rows.length>=2*Math.max(Math.ceil(rows.length/6),...n.values());};
const stepIds=new Set(),table=[],boards={lessons:0,steps:0,pairs:0},excludedNouns=[];
for(const [i,pack] of packs.entries()){
 const level=levels[i],lessons=pack.units.flatMap(unit=>unit.lessons.map(l=>({...l,level,contentVersion:2})));
 const row={level,glosses:0,words:0,verbs:0,unresolved:0,examples:[]};
 for(const lesson of lessons){
  const glosses=lesson.steps.find(s=>s.kind==='words').words,resolved=resolveLessonWords(lesson,{vocab,verbs});
  row.glosses+=glosses.length;
  const hit=new Map(resolved.map(r=>[r.gloss,r.entry]));
  for(const gloss of glosses){
   const entry=hit.get(gloss);
   if(!entry){row.unresolved++;if(row.examples.length<20&&!row.examples.includes(gloss.it))row.examples.push(gloss.it);continue;}
   ok(byId.has(entry.id)&&['word','verb'].includes(entry.kind),`${lesson.id}: ${gloss.it} resolved to an unknown entry ${entry.id}`);
   ok(entry.kind==='verb'?entry.id.startsWith('v:'):entry.id.startsWith('w:'),`${lesson.id}: ${gloss.it} kind/id mismatch ${entry.id}`);
   if(entry.kind==='verb')row.verbs++;else row.words++;
  }
  // Resolution is deterministic: a second pass returns the same entries.
  assert.deepEqual(resolveLessonWords(lesson,{vocab,verbs}).map(r=>r.entry.id),resolved.map(r=>r.entry.id),`${lesson.id}: resolution not deterministic`);
  const {steps,excluded}=wordsCheckPlan(lesson,resolved),distinctWords=new Set(resolved.filter(r=>r.entry.kind==='word').map(r=>r.entry.id));
  assert.deepEqual(wordsCheckSteps(lesson,resolved),steps,`${lesson.id}: wordsCheckSteps must be the plan's steps`);
  // Without the conjugated-form index (the boot path) the words, and so the boards, are the same, and nothing resolves differently:
  // the words-only records are a subset of the full ones (a verb still appears there when it displaces a word whose English does not fit).
  const wordsOnly=resolveLessonWords(lesson,{vocab,verbs,verbForms:false});
  assert.deepEqual(wordsOnly.filter(r=>r.entry.kind==='word').map(r=>[r.gloss.it,r.entry.id]),resolved.filter(r=>r.entry.kind==='word').map(r=>[r.gloss.it,r.entry.id]),`${lesson.id}: words differ without verb forms`);
  ok(wordsOnly.every(r=>resolved.some(x=>x.gloss===r.gloss&&x.entry===r.entry)),`${lesson.id}: a gloss resolves differently without verb forms`);
  assert.deepEqual(wordsCheckSteps(lesson,wordsOnly),steps,`${lesson.id}: boards differ without verb forms`);
  if(distinctWords.size<3)ok(steps.length===0,`${lesson.id}: boards with fewer than 3 resolved words`);
  else{ok(steps.some(s=>s.board==='meaning')&&steps.some(s=>s.board==='recall'),`${lesson.id}: ${distinctWords.size} words resolved but no meaning/recall board`);boards.lessons++;}
  assert.deepEqual(steps.map(s=>s.board),[...steps.map(s=>s.board)].sort((a,b)=>['meaning','recall','forms'].indexOf(a)-['meaning','recall','forms'].indexOf(b)),`${lesson.id}: boards out of order`);
  const credited=[];
  for(const step of steps){
   boards.steps++;
   ok(!stepIds.has(step.id),`${step.id}: duplicate synthesised step id`);stepIds.add(step.id);
   ok(step.id===`${lesson.id}.words-check.${step.board}.${step.round}`,`${step.id}: id shape`);
   ok(step.kind==='words-check'&&step.synthesized===true&&step.format==='match'&&step.title==='Le parole di oggi'&&step.prompt===PROMPTS[step.board]&&Number.isInteger(step.round)&&step.round>=1,`${step.id}: step shape`);
   ok(Array.isArray(step.pairs)&&step.pairs.length>=2&&step.pairs.length<=6,`${step.id}: ${step.pairs?.length} pairs (need 2 to 6)`);
   ok(new Set(step.pairs.map(p=>p.left)).size===step.pairs.length,`${step.id}: left values repeat`);
   ok(new Set(step.pairs.map(p=>p.right)).size===step.pairs.length,`${step.id}: right values repeat`);
   assert.deepEqual(step.entryIds,[...new Set(step.pairs.map(p=>p.entryId))],`${step.id}: entryIds`);
   for(const p of step.pairs){
    boards.pairs++;
    ok([p.left,p.right,p.say].every(v=>typeof v==='string'&&v.trim()),`${step.id}: empty board text`);
    ok(SKILLS[step.board].includes(p.skill),`${step.id}: skill ${p.skill} on the ${step.board} board`);
    ok(p.contentVersion===LESSON_CONTENT_VERSION,`${step.id}: contentVersion ${p.contentVersion}`);
    const plan=slotsFor(p.entryId),target=plan?.chapters.flatMap(c=>c.groups.flatMap(g=>g.targets)).find(t=>t.id===p.objectiveId);
    ok(plan?.wordLesson?.slots.some(s=>s.targetId===p.objectiveId),`${step.id}: ${p.objectiveId} is not a short word lesson slot`);
    ok(target&&target.skill===p.skill&&target.available!==false,`${step.id}: ${p.objectiveId} skill/availability`);
    ok(p.contentVersion===plan.version,`${step.id}: contentVersion differs from the plan`);
    if(step.board==='forms'){
     ok(['singular','plural'].includes(p.form),`${step.id}: forms row without form`);
     ok(['il','lo','la',"l'",'i','gli','le'].includes(p.left),`${step.id}: ${p.left} is not a single article`);
     ok(p.say===(p.left.endsWith("'")?p.left+p.right:`${p.left} ${p.right}`),`${step.id}: say for ${p.right}`);
    }else ok(p.say===(step.board==='meaning'?p.left:p.right),`${step.id}: say must be the Italian side`);
    if(!credited.includes(p.entryId))credited.push(p.entryId);
   }
  }
  // Strict credit: every credited word has meaning and recall rows, and its forms rows cover exactly the available article/plural slots.
  for(const id of credited){
   const rows=steps.flatMap(s=>s.pairs.filter(p=>p.entryId===id));
   ok(rows.some(p=>p.skill==='meaning')&&rows.some(p=>p.skill==='recall'),`${lesson.id}: ${id} lacks a meaning or recall row`);
   ok(rows.every(p=>!['article','plural'].includes(p.skill))||(byId.get(id).pos==='noun'&&byId.get(id).g),`${lesson.id}: ${id} forms rows without gender`);
   const skills=[...new Set(rows.filter(p=>['article','plural'].includes(p.skill)).map(p=>p.skill))].sort();
   assert.deepEqual(skills,byId.get(id).pos==='noun'&&byId.get(id).g?formSkills(id):[],`${lesson.id}: ${id} forms rows ${skills} must cover its available slots`);
   const e=byId.get(id);
   if(e.pos==='noun'&&e.g&&skills.length===2&&norm(e.it)===norm(e.pl))ok(steps.find(s=>s.pairs.some(p=>p.entryId===id&&p.skill==='article'))!==steps.find(s=>s.pairs.some(p=>p.entryId===id&&p.skill==='plural')),`${lesson.id}: invariable ${id} needs its two rows in different rounds`);
  }
  // A noun is excluded only when its rows truly cannot join the kept rows, and then it is off every board.
  const kept=steps.filter(s=>s.board==='forms').flatMap(s=>s.pairs.map(p=>[p.left,norm(p.right)]));
  for(const id of excluded){
   ok(byId.get(id)?.pos==='noun'&&byId.get(id).g&&distinctWords.has(id),`${lesson.id}: excluded ${id} is not a resolved noun`);
   ok(!credited.includes(id)&&steps.every(s=>!s.entryIds.includes(id)&&s.pairs.every(p=>p.entryId!==id)),`${lesson.id}: excluded ${id} still on a board`);
   ok(!feasible([...kept,...rowsFor(id)]),`${lesson.id}: ${id} excluded although its rows could join the kept rounds`);
   excludedNouns.push(`${lesson.id}:${id}`);
  }
  assert.deepEqual(lessonWordIds({...lesson,steps:[...lesson.steps,...steps]}),credited,`${lesson.id}: lessonWordIds`);
  assert.deepEqual(lessonWordIds(lesson),[],`${lesson.id}: raw lesson credits words`);
 }
 table.push(row);
}
// Known resolutions pin the rules: article stripping, English preference, plural and feminine forms, verbs excluded from boards.
const lessonOf=id=>packs.flatMap(p=>p.units.flatMap(u=>u.lessons)).find(l=>l.id===id);
const resolvedOf=id=>Object.fromEntries(resolveLessonWords(lessonOf(id),{vocab,verbs}).map(r=>[r.gloss.it,r.entry.id]));
assert.equal(resolvedOf('v2-a1-essere-polite')['il medico'],'w:medico|noun','leading article stripped');
assert.equal(resolvedOf('v2-a1-avere-singular')['un libro'],'w:libro|noun','indefinite article stripped');
assert.equal(resolvedOf('v2-a2-direct-reference')['le pizze'],'w:pizza|noun','plural form resolves');
assert.equal(resolvedOf('v2-a2-direct-singular')['lo'],'w:lo|pron','English preference over file order');
assert.equal(resolvedOf('v2-a1-small-numbers')['uno'],'w:uno|num','a numeric gloss prefers the number');
assert.equal(resolvedOf('v2-a1-one-thing')['amica'],'w:amico|noun','feminine form resolves');
assert.equal(resolvedOf('v2-b1-recipient-reference')['il collega / la collega'],'w:collega|noun','first alternative stands for the gloss');
assert.equal(resolvedOf('v2-a1-are-singular')['parlare'],'v:parlare','verbs resolve');
// Conjugated forms: paradigm cells with clitics and auxiliaries, participles with agreement, non + imperative, stare + gerund,
// proclitics and enclitics; a phrase with any other word is not a form, and a gloss with its article names a noun.
assert.equal(resolvedOf('v2-a2-reflexive-me-you')['mi alzo'],'v:alzarsi','reflexive present resolves');
assert.equal(resolvedOf('v2-a2-auxiliary-choice')['ha mangiato'],'v:mangiare','compound tense resolves');
assert.equal(resolvedOf('v2-a2-reflexive-past')['mi sono alzata'],'v:alzarsi','reflexive compound with agreement resolves');
assert.equal(resolvedOf('v2-a1-past-essere')['arrivata'],'v:arrivare','feminine participle resolves');
assert.equal(resolvedOf('v2-a2-negative-commands')['non parli'],'v:parlare','negative polite command resolves');
assert.equal(resolvedOf('v2-a2-progressive-present')['sto parlando'],'v:parlare','stare + gerund resolves');
assert.equal(resolvedOf('v2-a2-formal-request')['aiutarmi'],'v:aiutare','infinitive with enclitic resolves');
assert.equal(resolvedOf('v2-a1-piacere')['mi piacciono'],'v:piacere','proclitic before a finite form resolves');
assert.equal(resolvedOf('v2-f-name')['Mi chiamo…'],'v:chiamarsi','trailing punctuation is ignored');
assert.equal(resolvedOf('v2-a2-conditional-plan')['vorrei visitare'],undefined,'modal + infinitive is not a form');
assert.equal(resolvedOf('v2-b1-real-condition')['se piove'],undefined,'se + verb is not a form');
assert.equal(resolvedOf('v2-b1-capstone-relay')['la conferma'],undefined,'an article keeps a noun gloss off the verbs');
// Inflected words: adjective forms, note-only closed-class forms, feminine plurals, headwords with punctuation.
assert.equal(resolvedOf('v2-a1-adjective-agreement')['piccole'],'w:piccolo|adj','adjective form resolves');
assert.equal(resolvedOf('v2-a1-my-possessives')['miei'],'w:mio|det','possessive form resolves');
assert.equal(resolvedOf('v2-a2-del-dal')['dal'],'w:dal|prep','articulated preposition resolves');
assert.equal(resolvedOf('v2-a1-plural-spelling')['amiche'],'w:amico|noun','feminine plural from the note resolves');
assert.equal(resolvedOf('v2-a1-tens-prices')['Quanto costa?'],'w:quanto_costa|expr','expression headword with punctuation resolves');
// A word whose English carries nothing of the gloss yields to a verb form whose English does.
assert.equal(resolvedOf('v2-a1-present-questions')['abiti'],'v:abitare','you live is abitare, not the noun abito');
assert.equal(resolvedOf('v2-a2-lei-commands')['aspetti'],'v:aspettare','wait! is aspettare, not the plural of aspetto');
assert.equal(resolvedOf('v2-f-repair')['Non capisco.'],'w:non_capisco|expr','an expression whose English fits keeps the gloss');
const vowels=lessonOf('v2-a1-vowels-stress'),vowelSteps=wordsCheckSteps(vowels,resolveLessonWords(vowels,{vocab,verbs}));
assert.deepEqual(vowelSteps.map(s=>s.id),['v2-a1-vowels-stress.words-check.meaning.1','v2-a1-vowels-stress.words-check.recall.1','v2-a1-vowels-stress.words-check.forms.1','v2-a1-vowels-stress.words-check.forms.2']);
assert.deepEqual(vowelSteps[0].pairs.map(p=>[p.left,p.right]),[['la casa','house'],['la città','city'],['il caffè','coffee'],['italiano','Italian'],['perché','why']]);
assert.deepEqual(vowelSteps[1].pairs.map(p=>[p.left,p.right,p.say]),[['house','la casa','la casa'],['city','la città','la città'],['coffee','il caffè','il caffè'],['Italian','italiano','italiano'],['why','perché','perché']]);
// Invariable città and caffè keep both rows, each pair split across the two balanced rounds.
assert.deepEqual(vowelSteps[2].pairs.map(p=>[p.left,p.right,p.skill]),[['la','casa','article'],['le','città','plural'],['il','caffè','article']]);
assert.deepEqual(vowelSteps[3].pairs.map(p=>[p.left,p.right,p.skill]),[['le','case','plural'],['la','città','article'],['i','caffè','plural']]);
// The only noun of v2-f-courtesy is invariable caffè: its two rows would need two rounds of one, so it leaves every board.
const courtesy=wordsCheckPlan(lessonOf('v2-f-courtesy'),resolveLessonWords(lessonOf('v2-f-courtesy'),{vocab,verbs}));
assert.deepEqual(courtesy.excluded,['w:caffè|noun']);
assert(courtesy.steps.length>0&&courtesy.steps.every(s=>s.board!=='forms'&&!s.entryIds.includes('w:caffè|noun')),'excluded noun off every board');
assert.equal(wordsCheckSteps(lessonOf('v2-a1-essere-singular'),resolveLessonWords(lessonOf('v2-a1-essere-singular'),{vocab,verbs})).length,0,'two resolved words give no boards');
const unknown=wordsCheckSteps(vowels,resolveLessonWords(vowels,{vocab:[],verbs:[]}));assert.deepEqual(unknown,[],'empty dictionary gives no boards');
// Attachment: steps follow the first words step, byId shares the lesson objects, the raw packs stay clean, and a second call is a no-op.
installGrammarCourse(packs,[]);
const before=new Map(grammarCourse.lessons.map(l=>[l.id,l.steps.length]));
attachLessonVocabulary({vocab,verbs});
let attached=0;
for(const lesson of grammarCourse.lessons){
 const at=lesson.steps.findIndex(s=>s.kind==='words'),synthesised=lesson.steps.filter(s=>s.kind==='words-check');
 assert.equal(grammarCourse.byId.get(lesson.id),lesson,`${lesson.id}: byId must share the lesson object`);
 assert.deepEqual(lesson.steps.slice(at+1,at+1+synthesised.length),synthesised,`${lesson.id}: boards must follow the first words step`);
 assert.deepEqual(lesson.wordEntryIds,lessonWordIds(lesson),`${lesson.id}: wordEntryIds`);
 assert.deepEqual(synthesised,wordsCheckSteps(lesson,resolveLessonWords(lesson,{vocab,verbs})),`${lesson.id}: attached steps differ from a fresh synthesis`);
 attached+=synthesised.length;
}
assert.equal(attached,boards.steps,'every synthesised step is attached');
attachLessonVocabulary({vocab,verbs});
for(const lesson of grammarCourse.lessons)assert.equal(lesson.steps.length,before.get(lesson.id)+lesson.steps.filter(s=>s.kind==='words-check').length,`${lesson.id}: second attach must not duplicate`);
assert.equal(grammarLesson('g:v2-a1-vowels-stress').steps.filter(s=>s.kind==='words-check').length,4);
for(const pack of packs)for(const unit of pack.units)for(const lesson of unit.lessons)assert(lesson.steps.every(s=>!s.synthesized),`${lesson.id}: raw pack mutated`);
installGrammarCourse(packs,[],{vocab,verbs});
assert.equal(grammarCourse.lessons.reduce((n,l)=>n+l.steps.filter(s=>s.kind==='words-check').length,0),boards.steps,'installGrammarCourse attaches when given the dictionary');
installGrammarCourse(packs,[]);
assert(grammarCourse.lessons.every(l=>!l.steps.some(s=>s.kind==='words-check')&&!('wordEntryIds' in l)),'a plain install carries no boards');
// Coverage table and regression floor.
const pct=r=>Math.round(1000*(r.words+r.verbs)/r.glosses)/10;
console.log('level        glosses  words  verbs  unresolved  coverage');
for(const r of table)console.log(`${r.level.padEnd(12)} ${String(r.glosses).padStart(7)}  ${String(r.words).padStart(5)}  ${String(r.verbs).padStart(5)}  ${String(r.unresolved).padStart(10)}  ${String(pct(r)+'%').padStart(8)}`);
for(const r of table)console.log(`  ${r.level} unresolved: ${r.examples.join(' | ')}`);
for(const r of table)if(MIN_COVERAGE[r.level]!=null)ok(pct(r)>=MIN_COVERAGE[r.level],`${r.level}: coverage ${pct(r)}% fell below ${MIN_COVERAGE[r.level]}%`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`${excludedNouns.length} noun${excludedNouns.length===1?'':'s'} excluded because a required forms row could not be placed${excludedNouns.length?`: ${excludedNouns.join(', ')}`:''}.`);
console.log(`${boards.lessons} lessons carry boards: ${boards.steps} synthesised steps, ${boards.pairs} pairs; attachment, idempotence, strict credit rows and objective ids verified.`);
