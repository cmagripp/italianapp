#!/usr/bin/env node
// Independent morphology/usage fixtures and exhaustive content-contract checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProgressiveGroup,progressiveForms,progressiveContexts,progressiveInfo,progressiveSpec,simpleVerbContexts} from '../js/learning/progressive-content.js';
import {buildLesson,lessonContexts} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url))),verb=inf=>verbs.find(e=>e.inf===inf)||{id:`v:${inf}`,inf};
let passed=0;
const check=(name,run)=>{run();passed++;console.log('PASS',name);};
check('domandare teaches an addressee and real indirect question across the five cases',()=>{
 const e=verb('domandare');
 for(const [chapter,english] of [['present','I ask Sara how she is.'],['background','I used to ask Sara how she is.']]){
  const s=simpleVerbContexts(e,{chapter,section:'all'}).find(s=>s.person===0&&s.it.includes('a Sara come sta'));
  assert.equal(s?.en,english);
  assert(progressiveContexts(e,{chapter,section:'all'}).some(s=>s.it.includes('a Sara come sta')&&s.en.includes('asking Sara how she is')));
 }
 for(const [chapter,english] of [['past','I asked Sara how she is.'],['future','I will ask Sara how she is.'],['condizionale','I would ask Sara how she is.']]){
  const s=lessonContexts(e,chapter).find(s=>s.person===0&&s.it.includes('a Sara come sta'));
  assert.equal(s?.en,english);
 }
 assert.equal(progressiveSpec(e).frames.some(([it])=>it==='una domanda'),false);
 assert(progressiveSpec(e).sources.includes('https://www.treccani.it/vocabolario/domandare/'));
});
check('English cues preserve irregular past forms, doubled consonants and subject possessives',()=>{
 for(const [inf,past,ongoing] of [['accedere','logged in to','logging in to'],['lottare','fought','fighting'],['nascondere','hid','hiding'],['prelevare','withdrew','withdrawing'],['superare','overtook','overtaking'],['adempiere','fulfilled','fulfilling'],['attenersi','stuck',''],['dedurre','inferred','inferring'],['emettere','emitted','emitting'],['intraprendere','undertook','undertaking'],['omettere','omitted','omitting'],['scaturire','arose','arising'],['sconvolgere','upset','upsetting'],['sorgere','arose','arising'],['sottoporre','submitted','submitting'],['subire','underwent','undergoing']]){
  const en=progressiveSpec(verb(inf)).en;assert.equal(en[2],past,inf);assert.equal(en[3],ongoing,inf);
 }
 const scenes=progressiveContexts(verb('pettinarsi'));
 for(const [person,phrase] of [[0,'I am combing my hair'],[1,'You are combing your hair'],[2,'She is combing her hair'],[3,'We are combing our hair']])assert(scenes.some(s=>s.person===person&&s.role==='ordinary'&&s.en.startsWith(phrase)),phrase);
 assert(scenes.some(s=>s.role==='formal'&&s.en.startsWith('Ms Rossi, you are combing your hair')));
});
check('Regular and irregular gerunds use independently checked forms of the named verb',()=>{
 for(const [inf,gerund] of [['viaggiare','viaggiando'],['guidare','guidando'],['volare','volando'],['nuotare','nuotando'],['parlare','parlando'],['scrivere','scrivendo'],['dormire','dormendo'],['fare','facendo'],['dire','dicendo'],['bere','bevendo'],['tradurre','traducendo']]){
  const e=verb(inf);assert.equal(progressiveInfo(e).gerund,gerund);assert.deepEqual(progressiveForms(e,0),[`sto ${gerund}`]);
 }
 assert.deepEqual(Array.from({length:6},(_,person)=>progressiveForms(verb('viaggiare'),person)[0]),['sto viaggiando','stai viaggiando','sta viaggiando','stiamo viaggiando','state viaggiando','stanno viaggiando']);
});
check('Reflexive and sene pronouns stay with the construction in either grammatical position',()=>{
 assert.deepEqual(progressiveForms(verb('lavarsi'),0),['mi sto lavando','sto lavandomi']);
 assert.deepEqual(progressiveForms(verb('vestirsi'),1),['ti stai vestendo','stai vestendoti']);
 assert.deepEqual(progressiveForms(verb('alzarsi'),3),['ci stiamo alzando','stiamo alzandoci']);
 assert.deepEqual(progressiveForms(verb('andarsene'),3),['ce ne stiamo andando','stiamo andandocene']);
});
check('Formal Lei has distinct practice with the same third-person helper',()=>{
 const group=buildProgressiveGroup(verb('viaggiare')),formal=group.targets.find(t=>t.role==='formal');
 assert.equal(formal.person,2);assert.deepEqual(formal.answerForms,['sta viaggiando']);assert(formal.contexts.length>=2);
 assert(group.cards.some(c=>c.forms.some(r=>r.label.includes('Lei')&&r.gloss.includes('formal'))));
 assert(formal.contexts.every(c=>/Signora Rossi/.test(c.it)&&/you are travelling/.test(c.en)));
});
check('Ordinary stative senses teach the appropriate simple construction',()=>{
 for(const inf of ['essere','avere','sapere','volere','potere','dovere','piacere','credere','stare']){
  const e=verb(inf),info=progressiveInfo(e),g=buildProgressiveGroup(e);
  assert(info.reviewed,inf);assert.equal(info.supported,false,inf);assert.deepEqual(progressiveForms(e,0),[]);
  assert(g.cards.some(c=>c.body.includes(info.limitation)));assert.equal(g.targets.length,0);
  assert(simpleVerbContexts(e).length>=2,inf);
 }
});
check('Unreviewed custom verbs remain explicitly distinct from inappropriate progressive senses',()=>{
 const e=verb('inventareunverbo');assert.equal(progressiveInfo(e).policy,'unreviewed');assert.equal(buildProgressiveGroup(e),null);assert.deepEqual(progressiveForms(e,0),[]);
});
check('Present lessons teach only the present viewpoints and explain the actual gerund',()=>{
 for(const inf of ['viaggiare','dire','mangiare']){
  const g=buildProgressiveGroup(verb(inf));assert(!g.cards.some(c=>c.id==='progressive-contrast'));
  assert.match(g.cards[0].body,/simple present can also describe what is happening now/);
  assert.match(g.cards[1].body,/-are → -ando; -ere and -ire → -endo/);
  assert(!JSON.stringify(g.cards).includes('stavo mangiando'));assert(!JSON.stringify(g.cards).includes('ho mangiato'));
 }
 assert.match(buildProgressiveGroup(verb('dire')).cards[1].body,/dicendo.*exception/);
});
check('Weather is impersonal and has separate learning and final-review situations',()=>{
 for(const inf of ['piovere','nevicare']){
  const e=verb(inf),g=buildProgressiveGroup(e);assert.deepEqual(g.targets.filter(t=>t.required).map(t=>t.person),[2]);
  for(const p of [0,1,3,4,5])assert.deepEqual(progressiveForms(e,p),[]);
  assert(progressiveContexts(e).length>=2);assert(progressiveContexts(e,{section:'mixed'}).length>=2);
 }
});
check('Past progressive uses imperfect stare and keeps ordinary imperfetto available',()=>{
 assert.deepEqual(progressiveForms(verb('viaggiare'),0,{chapter:'background'}),['stavo viaggiando']);
 assert.deepEqual(progressiveForms(verb('lavarsi'),0,{chapter:'background'}),['mi stavo lavando','stavo lavandomi']);
 assert.deepEqual(progressiveForms(verb('andarsene'),3,{chapter:'background'}),['ce ne stavamo andando','stavamo andandocene']);
 const contexts=progressiveContexts(verb('viaggiare'),{chapter:'background'});assert(contexts.every(c=>!/\b(am|is|are)\b/.test(c.en)));
 assert.match(buildProgressiveGroup(verb('viaggiare'),{chapter:'background'}).cards[0].body,/simple imperfetto can also express an ongoing action/);
 assert(simpleVerbContexts(verb('potere'),{chapter:'background'}).every(c=>/could/.test(c.en)&&!/used to can/.test(c.en)));
});
check('Every catalogue verb has a selected sense, specific explanation and usable final review',()=>{
 let dynamic=0,scenes=0;const failures=[];
 for(const e of verbs){
  try{
   const info=progressiveInfo(e);assert(info.reviewed&&info.sense&&info.limitation,e.inf);
   const group=buildProgressiveGroup(e),p=buildLesson(e),present=p.chapters.find(c=>c.id==='present'),mixed=present.groups.find(g=>g.finalReview);
   assert(group?.cards.length);assert(mixed?.targets.some(t=>!t.progressive&&t.available),e.inf+' simple mixed');
   assert(!JSON.stringify(group.cards).includes('Four ways to describe eating'));
   if(info.supported){
    dynamic++;assert(group.targets.some(t=>t.required&&t.available));assert(mixed.targets.some(t=>t.progressive&&t.available));
    for(const target of group.targets.filter(t=>t.required)){
     assert(target.contexts.length>=2,e.inf+' two practice scenes per person');assert.equal(target.independentVariantCount,new Set(target.contextIds).size);assert.equal(new Set(target.contexts.map(c=>c.it)).size,target.contexts.length,e.inf+' repeated scene');
     const sceneIds=new Set(target.contextIds);assert(mixed.targets.filter(t=>t.progressive).every(t=>t.contexts.every(c=>!sceneIds.has(c.id))));
     for(const context of target.contexts){scenes++;assert(context.it.toLocaleLowerCase('it').includes(context.answer.toLocaleLowerCase('it')));assert(context.answers.includes(context.answer));}
    }
   }
   for(const chapter of p.chapters.filter(c=>['present','background'].includes(c.id)))for(const target of chapter.groups.flatMap(g=>g.targets).filter(t=>t.available&&t.authoredContexts)){
    for(let variant=0;variant<target.contexts.length;variant++){
     // New questions use the current expanded pool. Retired legacy contexts are
     // intentionally not gradable; their recovery is tested in journey-scene.
     const q=buildJourneyQuestion(e,chapter,target,{variant,scenePolicy:'expanded-v1'});assert(q,e.inf+' question');assert(q.context,e.inf+' meaningful context');assert(q.answer.every(x=>typeof x==='string'&&x.trim()));
     assert(!/used to (?:can|must|should)\b/.test(q.context.en),q.context.en);
    }
   }
  }catch(error){failures.push(e.inf+': '+error.message);}
 }
 assert.deepEqual(failures,[]);console.log(`  ${verbs.length} catalogue verbs; ${dynamic} progressive senses; ${scenes} structurally checked practice contexts plus held-out reviews.`);
});
console.log(`${passed} progressive content checks passed.`);
