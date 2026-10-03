#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLesson,lessonContexts,lessonForms,lessonEntry,formalLessonForms} from '../js/learning/lesson-content.js';
import {buildJourneyQuestion} from '../js/learning/lesson-questions.js';
import {gradeQuestion} from '../js/learning/diagnose.js';
import {ANCHOR_VERBS} from '../js/learning/curriculum.js';
const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url)));
const words=JSON.parse(fs.readFileSync(new URL('../data/vocab.json',import.meta.url)));
const vb=inf=>verbs.find(e=>e.inf===inf);
const wd=(it,pos='noun')=>words.find(e=>e.it===it&&e.pos===pos);
const targets=ch=>ch.groups.flatMap(g=>g.targets);
const chapter=(e,id)=>buildLesson(e).chapters.find(c=>c.id===id);
const target=(e,ch,skill,person,role='ordinary')=>targets(chapter(e,ch)).find(t=>t.skill===skill&&(person===undefined||t.person===person)&&(t.role||'ordinary')===role);
const q=(e,ch,skill,person,opts={},role='ordinary')=>buildJourneyQuestion(e,chapter(e,ch),target(e,ch,skill,person,role),opts);
let tests=0;
function test(name,fn){try{fn();tests++;}catch(error){console.error(`FAIL ${name}`);throw error;}}
function wrong(question,answer,tag){const result=gradeQuestion(question,answer);assert.equal(result.ok,false);assert.ok(result.errorTags.includes(tag),JSON.stringify(result));return result;}
function copyable(question){const visible=question.prompt.replace(/<[^>]+>/g,' ').toLowerCase();return question.answer.some(a=>new RegExp(`(?:^|[^\\p{L}])${a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^\\p{L}])`,'iu').test(visible));}

test('chapter sequence teaches five core cases; mixed practice and later forms are optional',()=>{
 const p=buildLesson(vb('credere'));assert.deepEqual(p.chapters.filter(c=>!c.optional).map(c=>c.id),['meet','present','past','background','future','condizionale']);
 assert.equal(!!p.chapters.find(c=>c.id==='background').optional,false);
 assert.equal(p.chapters.find(c=>c.id==='congiuntivoPresente').optional,true);
 assert.equal(p.chapters[0].groups[0].cards[0].examples.length,1);
});
test('regular -are, -ere, -ire and isc patterns are explicitly taught',()=>{
 for(const [inf,stem,ending]of[['parlare','parl-','-are'],['credere','cred-','-ere'],['dormire','dorm-','-ire']]){
  const text=JSON.stringify(chapter(vb(inf),'present').groups[0].cards);assert.ok(text.includes(stem));assert.ok(text.includes(ending));
 }
 const text=JSON.stringify(chapter(vb('capire'),'present'));assert.ok(text.includes('-isc-'));assert.ok(text.includes('Noi and voi do not use -isc-'));
});
test('irregular dire is introduced at Meet and taught in each applicable chapter',()=>{
 const p=buildLesson(vb('dire'));assert.ok(JSON.stringify(p.chapters[0]).includes('detto'));
 assert.ok(JSON.stringify(chapter(vb('dire'),'present')).includes('dico'));
 assert.ok(JSON.stringify(chapter(vb('dire'),'future')).includes('dir-'));
 assert.deepEqual(q(vb('dire'),'past','conjugation',0).answer,['ho detto']);
 wrong(q(vb('dire'),'past','conjugation',0),'ho dito','participle');
});
test('participle rules are explicit and the selected irregular participle is flagged',()=>{
 for(const inf of ['parlare','credere','dormire']){
  const card=chapter(vb(inf),'past').groups[0].cards.find(c=>c.id==='participle');
  for(const pattern of ['-are → -ato','-ere → -uto','-ire → -ito'])assert.ok(card.body.includes(pattern));
  assert.ok(card.body.includes('patterns with exceptions'));
  assert.ok(!card.body.includes(`${inf} has an irregular past participle`));
 }
 for(const [inf,participle]of[['dire','detto'],['prendere','preso'],['essere','stato'],['fare','fatto']]){
  const card=chapter(vb(inf),'past').groups[0].cards.find(c=>c.id==='participle');assert.ok(card.body.includes(`${inf} has an irregular past participle: ${participle}`));
 }
 const alternate=chapter(vb('riflettere'),'past').groups[0].cards.find(c=>c.id==='participle');assert.ok(alternate.body.includes('riflettuto'));assert.ok(!alternate.body.includes('riflesso'));
});
test('future teaching gives the stem and all six endings in person order',()=>{
 for(const inf of ['parlare','dire','andare','piovere']){
  const body=chapter(vb(inf),'future').groups[0].cards[0].body;assert.ok(body.includes('the stem is'));
  assert.ok(body.includes('io -ò, tu -ai, lui/lei/Lei -à, noi -emo, voi -ete, loro -anno'));
 }
});
test('extended reference material remains accessible without entering mandatory teaching',()=>{
 for(const e of [vb('credere'),wd('caffè')]){
  const plan=buildLesson(e);assert.ok(plan.references.length);assert.ok(plan.chapters.every(ch=>ch.groups.every(g=>g.cards.every(c=>!c.reference))));
  assert.ok(plan.chapters[0].groups[0].cards[0].examples.length<=1);
 }
 assert.ok(JSON.stringify(buildLesson(wd('caffè')).references).includes('café'));
});
test('reviewed regular answers are independently hand checked across six persons',()=>{
 for(const [inf,expected]of[['credere',['credo','credi','crede','crediamo','credete','credono']],['parlare',['parlo','parli','parla','parliamo','parlate','parlano']],['dormire',['dormo','dormi','dorme','dormiamo','dormite','dormono']],['capire',['capisco','capisci','capisce','capiamo','capite','capiscono']]]){
  for(let p=0;p<6;p++){const first=q(vb(inf),'present','conjugation',p),second=q(vb(inf),'present','conjugation',p,{variant:1});assert.deepEqual(first.answer,[expected[p]]);assert.ok(first.context);assert.equal(first.meta.person,p);assert.notEqual(first.meta.variantId,second.meta.variantId);assert.notEqual(first.prompt,second.prompt);assert.equal(copyable(first),false);}
 }
});
test('every original anchor and credere has two situations per person in all three chapters',()=>{
 for(const inf of [...ANCHOR_VERBS,'credere'])for(const ch of ['present','past','future'])for(let p=0;p<6;p++){
  const cs=lessonContexts(vb(inf),ch).filter(x=>x.role==='ordinary'&&x.person===p&&x.source==='reviewed-scene');assert.equal(cs.length,2,`${inf}/${ch}/${p}`);
  assert.ok(cs.every(x=>x.it.includes(x.answer)&&x.en));
  assert.ok(cs.every(x=>!x.it.includes('Marco crede a Marco')));
 }
});
test('prefixed background scenes use ordinary lowercase pronouns and retain names and formal Lei',()=>{
 const cs=lessonContexts(vb('andare'),'background').filter(x=>x.source==='reviewed-scene');
 const subjects=['io','tu','Luca','noi','voi','Luca e Paolo'],english=['I','you','Luca','we','you all','Luca and Paolo'];
 for(let p=0;p<6;p++)for(const s of cs.filter(x=>x.role==='ordinary'&&x.person===p)){
  assert(s.it.startsWith('A quel tempo, '+subjects[p]+' '));assert(s.en.startsWith('Back then, '+english[p]+' '));
 }
 assert(cs.filter(x=>x.role==='formal').every(s=>s.it.includes('a quel tempo Lei ')));
});
test('formal Lei is a full construction with separate polite meaning, not a seventh ordinary person',()=>{
 for(const [ch,answer]of[['present','crede'],['past','ha creduto'],['future','crederà']]){
  const e=vb('credere'),question=q(e,ch,'address',2,{},'formal');assert.deepEqual(question.answer,[answer]);assert.equal(question.meta.role,'formal');assert.equal(question.meta.person,2);assert.ok(question.prompt.includes('Lei · formal'));assert.ok(question.context.it.includes('Lei'));
  const ts=targets(chapter(e,ch));assert.equal(ts.filter(x=>x.skill==='conjugation').length,6);assert.equal(ts.filter(x=>x.role==='formal').length,1);
 }
});
test('formal essere compounds agree with explicitly female/male addressee',()=>{
 assert.deepEqual(q(vb('andare'),'past','address',2,{variant:0},'formal').answer,['è andata']);
 assert.deepEqual(q(vb('andare'),'past','address',2,{variant:1},'formal').answer,['è andato']);
 wrong(q(vb('andare'),'past','address',2,{},'formal'),'è andato','agreement');
 const sparse=vb('abitare');assert.notDeepEqual(q(sparse,'past','address',2,{},'formal').answer,['Lei']);
 assert.deepEqual(formalLessonForms(vb('andare'),'trapassatoProssimo',true),['era andata']);
});
test('compound auxiliary failure retains correct participle evidence',()=>{
 const r=wrong(q(vb('andare'),'past','conjugation',0),'ho andato','auxiliary');assert.ok(r.components.some(c=>c.skill==='participle'&&c.ok));assert.ok(!r.errorTags.includes('participle'));
});
test('reflexive whole construction includes clitic and valid open gender alternatives',()=>{
 const question=q(vb('alzarsi'),'past','conjugation',0);assert.deepEqual(question.answer,['mi sono alzato','mi sono alzata']);wrong(question,'sono alzato','clitic');assert.equal(gradeQuestion(question,'mi sono alzata').ok,true);
});
test('modal source constructions restrict auxiliary to their intended transitive complement',()=>{
 for(const [inf,correct,wrongAnswer]of[['potere','ho potuto','sono potuto'],['dovere','ho dovuto','sono dovuto'],['volere','ho voluto','sono voluto']]){const question=q(vb(inf),'past','conjugation',0);assert.deepEqual(question.answer,[correct]);wrong(question,wrongAnswer,'auxiliary');}
});
test('weather uses impersonal third singular and no feminine weather participle',()=>{
 const e=vb('piovere');for(const ch of ['present','past','future']){assert.deepEqual(targets(chapter(e,ch)).filter(x=>x.skill==='conjugation').map(x=>x.person),[2]);assert.equal(targets(chapter(e,ch)).some(x=>x.role==='formal'),false);}
 assert.deepEqual(q(e,'present','conjugation',2).answer,['piove']);assert.ok(!lessonForms(e,'passatoProssimo',2).some(x=>x.endsWith('a')));
 assert.equal(chapter(e,'imperativo'),undefined);
});
test('piacere teaches liked thing as subject and singular/plural contrast',()=>{
 const e=vb('piacere');assert.deepEqual(targets(chapter(e,'present')).filter(t=>t.skill==='conjugation').map(t=>t.person),[2,5]);assert.deepEqual(q(e,'present','conjugation',2).answer,['piace']);assert.deepEqual(q(e,'present','conjugation',5).answer,['piacciono']);assert.ok(q(e,'present','conjugation',5).context.it.includes('libri'));
});
test('exact dictionary examples are preserved and finite spans are never replaced across persons',()=>{
 let count=0;for(const e of verbs)for(const ch of ['present','past','future'])for(const c of lessonContexts(e,ch).filter(c=>c.source==='dictionary-exact')){assert.ok(e.examples.some(x=>x.it===c.it&&x.en===c.en));assert.ok(c.it.toLowerCase().includes(c.answer.toLowerCase()));assert.ok(lessonForms(e,{present:'presente',past:'passatoProssimo',future:'futuro'}[ch],c.person).includes(c.answer));count++;}assert.ok(count>1200);
});
test('unknown custom verbs have form practice, original reference and explicit missing context',()=>{
 const e={id:'c:annotare',inf:'annotare',en:'to note down',aux:'avere',examples:[{it:'Annoto il numero.',en:'I note down the number.'}]};const p=buildLesson(e);assert.ok(JSON.stringify(p.chapters[0]).includes('Annoto il numero.'));assert.equal(q(e,'future','conjugation',1).meta.evidenceScope,'form');assert.equal(target(e,'future','context').available,false);
});
test('optional chapters have actual required forms; imperative has no io or third-person statement',()=>{
 const e=vb('parlare');assert.equal(targets(chapter(e,'background')).filter(x=>x.skill==='conjugation'&&x.required).length,6);
 const ch=chapter(e,'imperativo');assert.deepEqual(targets(ch).map(t=>t.person),[1,2,3,4,5]);
 for(const t of targets(ch)){const question=buildJourneyQuestion(e,ch,t);assert.ok(question);if(t.person===2){assert.ok(question.prompt.includes('polite singular'));assert.equal(question.meta.role,'formal');assert.deepEqual(question.answer,['parli']);}}
});
test('optional weather retrieval changes the real cue, not just the variant id',()=>{
 const e=vb('piovere'),ch=chapter(e,'background'),t=targets(ch).find(t=>t.skill==='conjugation');
 const italian=buildJourneyQuestion(e,ch,t,{variant:0}),english=buildJourneyQuestion(e,ch,t,{variant:1});
 assert.notEqual(italian.prompt,english.prompt);assert.ok(italian.context&&english.context);assert.notEqual(italian.meta.contextId,english.meta.contextId);assert.match(italian.context.en,/rain/);assert.deepEqual(italian.answer,['pioveva']);
});
test('missing defective forms never become available targets',()=>{
 const e=vb('solere'),ch=chapter(e,'past');assert.equal(targets(ch).some(t=>t.available&&t.skill==='conjugation'),false);
});
test('choice/matching/typed guidance are distinct interfaces but all supported evidence',()=>{
 const e=vb('credere'),ch=chapter(e,'present'),t=target(e,'present','conjugation',0);
 for(const format of ['choice','match','type']){const question=buildJourneyQuestion(e,ch,t,{phase:'guided',format});assert.equal(question.meta.mode,'recognition');assert.equal(question.type,format==='type'?'type':'mc');if(format==='match'){assert.equal(question.meta.activityKind,'matching');assert.ok(question.prompt.includes('Match'));}if(question.type==='mc')assert.ok(!/write the whole/i.test(question.prompt));}
});
test('auxiliary/participle building activities observe only component, even when typed',()=>{
 const e=vb('dire');for(const [skill,answer]of[['auxiliary','ho'],['participle','detto']]){const question=q(e,'past',skill,undefined,{phase:'guided',format:'type'});assert.deepEqual(question.answer,[answer]);assert.equal(question.meta.mode,'recognition');assert.equal(question.type,'type');assert.ok(!gradeQuestion(question,answer).components.some(c=>c.skill==='conjugation'));}
});
test('same-person smaller repair remains recognition and returns component evidence',()=>{
 const e=vb('alzarsi');for(const repairTag of ['auxiliary','participle','agreement','clitic']){const question=q(e,'past','conjugation',1,{phase:'repair',format:'type',repairTag});assert.ok(question.meta.scaffold);assert.equal(question.meta.mode,'recognition');assert.equal(question.meta.person,1);assert.ok(!gradeQuestion(question,question.answer[0]).components.some(c=>c.skill==='conjugation'));}
});
test('context repair respects original actual person and fixed auxiliary',()=>{
 const e=vb('volere'),ch=chapter(e,'past'),t=target(e,'past','context'),variant=4;const full=buildJourneyQuestion(e,ch,t,{variant});const repair=buildJourneyQuestion(e,ch,t,{variant,phase:'repair',repairTag:'auxiliary',format:'type'});assert.equal(repair.meta.person,full.meta.person);assert.deepEqual(repair.answer,['ha']);
});
test('present chapter never leaks future or optional distractors',()=>{
 for(const e of [vb('credere'),vb('dire'),vb('andare')]){const question=q(e,'present','conjugation',0,{phase:'guided',format:'choice'});assert.deepEqual(question.meta.diagnostic.tenseForms,[]);}
});
test('accent policy remains configurable',()=>{
 const question=q(vb('credere'),'future','conjugation',0);assert.equal(gradeQuestion(question,'credero').ok,true);assert.equal(gradeQuestion(question,'credero',{accentStrict:true}).ok,false);
});
test('calcio sport has no invented plural, while count and invariant nouns teach theirs',()=>{
 assert.equal(targets(chapter(wd('calcio'),'forms')).some(t=>t.skill==='plural'),false);assert.ok(JSON.stringify(buildLesson(wd('calcio'))).includes('kick'));
 assert.deepEqual(q(wd('casa'),'forms','plural').answer,['case']);
 const coffee=q(wd('caffè'),'forms','plural');assert.deepEqual(coffee.answer,['i caffè']);assert.equal(copyable(coffee),false);assert.ok(JSON.stringify(chapter(wd('caffè'),'forms')).includes('i caffè'));
});
test('one taught word sense is selected from the example, other meanings stay in reference',()=>{
 assert.equal(buildLesson(wd('caffè')).meaning,'coffee');assert.equal(lessonEntry(wd('di','prep')).en,'from');assert.deepEqual(q(wd('caffè'),'meaning','meaning').answer,['coffee']);assert.ok(JSON.stringify(buildLesson(wd('caffè'))).includes('café'));
});
test('missing custom plural stays unknown; plural-only nouns are not called singular',()=>{
 const e={id:'c:widget',it:'widget',en:'widget',pos:'noun',g:'m'};const ch=chapter(e,'forms');assert.ok(JSON.stringify(ch).includes('Plural not yet recorded'));assert.ok(!JSON.stringify(ch).includes('Normally singular'));assert.equal(targets(ch).some(t=>t.skill==='plural'),false);
 const occhiali=JSON.stringify(chapter(wd('occhiali'),'forms'));assert.ok(occhiali.includes('Normally plural'));
});
test('custom nouns without gender never receive a guessed article',()=>{
 const e={id:'c:unknown-gender',it:'lemma',en:'headword',pos:'noun',pl:'lemmi'};
 const ch=chapter(e,'forms');assert.equal(targets(ch).some(t=>t.skill==='article'),false);assert.equal(ch.groups[0].cards[0].forms[0].form,'lemma');
 assert.deepEqual(q(e,'forms','plural',undefined,{variant:1}).answer,['lemmi']);assert.deepEqual(q(e,'meaning','recall').answer,['lemma']);
});
test('adjectives teach four cells, invariant pattern or feminine-only pattern as recorded',()=>{
 assert.equal(targets(chapter(wd('veloce','adj'),'forms')).filter(t=>t.skill==='agreement').length,4);
 const blue=targets(chapter(wd('blu','adj'),'forms')).filter(t=>t.skill==='agreement');assert.equal(blue.length,1);assert.equal(blue[0].answerForm,'blu');
 const pregnant=targets(chapter(wd('incinta','adj'),'forms')).filter(t=>t.skill==='agreement');assert.deepEqual(pregnant.map(t=>t.answerForm),['incinta','incinte']);
 const question=q(wd('veloce','adj'),'forms','agreement');assert.equal(copyable(question),false);assert.equal(question.meta.diagnostic.kind,'adjective');
});
test('non-noun word types receive no noun morphology or verb questions',()=>{
 for(const pos of ['adv','prep','conj','pron','det','num','interj','expr']){const e=words.find(x=>x.pos===pos);assert.ok(e);assert.ok(buildLesson(e).chapters.flatMap(targets).every(t=>!['article','plural','conjugation'].includes(t.skill)));}
});
test('nonrevealing spacers stay supported and omit the word/verb answer',()=>{
 for(const e of [wd('casa'),wd('bene','adv'),vb('piovere')]){const ch=chapter(e,e.inf?'present':'meaning');for(const t of targets(ch).filter(t=>t.supplementalOnly)){const question=buildJourneyQuestion(e,ch,t);assert.equal(question.meta.mode,'recognition');assert.ok(!question.prompt.includes(t.skill==='progressiveFact'?question.answer[0]:e.inf||e.it));assert.equal(t.required,false);}}
});
test('variant-specific answers and persons match expanded contexts while saved variants retain their scenes',()=>{
 const e=vb('credere'),ch=chapter(e,'past'),t=target(e,'past','context');for(let v=0;v<t.independentVariantCount;v++){
  const question=buildJourneyQuestion(e,ch,t,{variant:v,scenePolicy:'expanded-v1'});
  assert.deepEqual(t.answerFormsByVariant[v%t.answerFormsByVariant.length],question.answer);
  assert.equal(t.personsByVariant[v%t.personsByVariant.length],question.meta.person);
 }
 for(const variant of [0,1,2,3,7,15]){
  const old=buildJourneyQuestion(e,ch,t,{variant,scenePolicy:undefined}),scene=t.legacyAuthoredContexts[variant%t.legacyAuthoredContexts.length];
  assert.equal(old.meta.contextId,scene.id);assert.deepEqual(old.answer,scene.answers);
 }
});
test('English you cues disambiguate informal singular and plural',()=>{
 const e=vb('capire');for(const p of [1,4]){const ch=chapter(e,'present'),t=target(e,'present','conjugation',p),count=lessonContexts(e,'present').filter(c=>c.person===p&&c.role==='ordinary').length;
 const question=buildJourneyQuestion(e,ch,t,{variant:count});assert.ok(question.prompt.includes(p===1?'tu · informal':'voi · plural'));}
});
test('lexical exposure metadata links bare and article phrases but keeps clean fact spacers',()=>{
 const e=wd('casa');const recall=target(e,'meaning','recall');assert.ok(recall.exposureFormsByVariant[0].includes('casa'));assert.ok(recall.exposureFormsByVariant[0].includes('la casa'));
 assert.deepEqual(q(e,'forms','article').meta.promptExposureForms,['casa']);
 const plural=q(e,'forms','plural',undefined,{variant:1});assert.ok(plural.meta.exposureForms.includes('case'));assert.ok(plural.meta.exposureForms.includes('le case'));
 const fact=targets(chapter(e,'meaning')).find(t=>t.supplementalOnly),question=buildJourneyQuestion(e,chapter(e,'meaning'),fact);assert.deepEqual(question.meta.promptExposureForms,[]);assert.deepEqual(question.meta.feedbackExposureForms,[]);
 const invariant=q(wd('caffè'),'forms','plural');assert.ok(!invariant.meta.exposureForms.includes('caffè'));
});
test('questions and plans are plain serializable data and deterministic',()=>{
 const e=vb('credere'),ch=chapter(e,'past'),t=target(e,'past','conjugation',1);const question=buildJourneyQuestion(e,ch,t,{variant:2,phase:'guided',format:'choice'});assert.deepEqual(buildJourneyQuestion(e,ch,t,{variant:2,phase:'guided',format:'choice'}),question);assert.deepEqual(JSON.parse(JSON.stringify(buildLesson(e))),buildLesson(e));assert.deepEqual(JSON.parse(JSON.stringify(question)),question);
});

test('imperfetto uses real past meanings and retains stable person target ids',()=>{
 for(const inf of ['parlare','essere','avere','potere','sapere']){
  const e=vb(inf),ch=chapter(e,'background');assert.equal(!!ch.optional,false);
  const contexts=lessonContexts(e,'background');assert.ok(contexts.length>=14);
  assert.ok(contexts.every(c=>/back then|used to|could/i.test(c.en)),inf);
  assert.ok(contexts.every(c=>!/(?:I am|We are|will |do you )/.test(c.en)),inf);
  assert.ok(targets(ch).some(t=>t.id===`${e.id}::lesson::background::form-0`));
  assert.ok(JSON.stringify(ch).includes('-avo'));assert.ok(JSON.stringify(ch).includes('facevo'));
 }
 assert.ok(q(vb('potere'),'background','conjugation',0).context.en.includes('could'));
});
test('conditional is core for every verb and teaches its own endings, polite wishes and hypothetical meaning',()=>{
 for(const e of verbs){const ch=chapter(e,'condizionale');assert.ok(ch,e.inf);assert.equal(!!ch.optional,false);assert.equal(buildLesson(e).chapters.filter(c=>c.id==='condizionale').length,1);}
 for(const inf of ['parlare','essere','avere','andare','fare','volere','potere']){
  const e=vb(inf),ch=chapter(e,'condizionale'),body=JSON.stringify(ch.groups[0].cards);
  for(const ending of ['-ei','-esti','-ebbe','-emmo','-este','-ebbero'])assert.ok(body.includes(ending));
  assert.ok(body.includes('including its final r'));assert.ok(body.includes('hypothetical'));assert.ok(body.includes('polite request'));assert.ok(body.includes('se avessi tempo'));
  const question=q(e,'condizionale','conjugation',0);assert.ok(question.context.en.includes('would'));
  assert.equal(gradeQuestion(question,lessonForms(e,'condizionale',0)[0]).ok,true);
  wrong(question,lessonForms(e,'futuro',0)[0],'tense');
  assert.equal(target(e,'condizionale','address',2, 'formal').id,`${e.id}::lesson::condizionale::formal`);
 }
 assert.ok(!lessonContexts(vb('potere'),'condizionale').some(c=>/would (?:can|be able to able)/.test(c.en)));
 assert.equal(targets(chapter(vb('piovere'),'condizionale')).filter(t=>t.skill==='conjugation').length,1);
 assert.equal(chapter(vb('parlare'),'condizionalePassato').optional,true);
});
test('present and past progressive questions diagnose helper, time, gerund and clitic without granting scaffold mastery',()=>{
 const e=vb('parlare');
 for(const [chId,expected,otherTime]of [['present','sto parlando','stavo parlando'],['background','stavo parlando','sto parlando']]){
  const ch=chapter(e,chId),t=targets(ch).find(t=>t.skill==='progressive'&&t.person===0);
  const question=buildJourneyQuestion(e,ch,t);assert.ok(question.answer.includes(expected));
  wrong(question,'sono parlando','auxiliary');wrong(question,otherTime,'tense');wrong(question,`${chId==='present'?'sto':'stavo'} parlare`,'gerund');
  wrong(question,`${chId==='present'?'stai':'stavi'} parlando`,'person');
  for(const repairTag of ['auxiliary','gerund']){
   const repair=buildJourneyQuestion(e,ch,t,{phase:'repair',format:'type',repairTag});assert.equal(repair.meta.mode,'recognition');assert.equal(repair.meta.scaffold,true);
   assert.equal(repair.meta.skill,repairTag);assert.equal(repair.answer[0],repairTag==='gerund'?'parlando':chId==='present'?'sto':'stavo');
   assert.ok(!gradeQuestion(repair,repair.answer[0]).components.some(c=>c.skill==='progressive'));
  }
 }
 const reflexive=vb('lavarsi'),ch=chapter(reflexive,'background'),t=targets(ch).find(t=>t.skill==='progressive'&&t.person===0),question=buildJourneyQuestion(reflexive,ch,t);
 assert.ok(gradeQuestion(question,'mi stavo lavando').ok);assert.ok(gradeQuestion(question,'stavo lavandomi').ok);wrong(question,'stavo lavando','clitic');
 const usage=chapter(vb('credere'),'present').groups.find(g=>g.id==='progressive');assert.equal(usage.targets.length,0);assert.match(usage.cards[0].body,/belief/);assert(targets(chapter(vb('credere'),'present')).some(t=>t.finalReview&&!t.progressive));
});


test('selected impersonal and thing-subject senses do not quiz personal or polite address forms',()=>{
 for(const [inf,persons]of [['bisognare',[2]],['trattarsi',[2]],['volerci',[2,5]],['addirsi',[2,5]],['prudere',[2,5]],['urgere',[2,5]],['vigere',[2,5]],['rincrescere',[2,5]],['spettare',[2,5]],['verificarsi',[2,5]]]){
  const e=vb(inf),ch=chapter(e,'present');
  assert.deepEqual(targets(ch).filter(t=>t.skill==='conjugation').map(t=>t.person),persons,inf);
  assert.ok(!targets(ch).some(t=>t.skill==='address'),inf);
  for(const t of targets(ch).filter(t=>t.skill==='conjugation')){
   const question=buildJourneyQuestion(e,ch,t);assert.ok(question.prompt.includes(t.subjectLabel)||question.context,inf);
  }
 }
});
test('sense-specific past forms stay separate and unsupported compounds are explained rather than generated',()=>{
 for(const [inf,good,bad]of [['riflettere','ho riflettuto','ho riflesso'],['inferire','ho inferito','ho inferto'],['ripartire','ho ripartito','sono ripartito']]){
  const e=vb(inf),question=q(e,'past','conjugation',0);assert.ok(question.answer.includes(good));assert.equal(gradeQuestion(question,bad).ok,false);
  const pp=q(e,'past','participle');assert.ok(!pp.answer.some(x=>bad.endsWith(x)&&!good.endsWith(x)));
 }
 for(const inf of ['concernere','ostare']){const e=vb(inf);assert.deepEqual(lessonForms(e,'passatoProssimo',2),[]);assert.ok(!targets(chapter(e,'past')).some(t=>t.available!==false&&t.skill==='participle'));}
});

test('all 8,128 catalog entries produce answerable available targets without missing forms',()=>{
 let count=0;for(const e of [...verbs,...words]){const p=buildLesson(e);const ids=new Set();for(const ch of p.chapters)for(const t of targets(ch)){assert.ok(!ids.has(t.id));ids.add(t.id);if(t.available===false)continue;const question=buildJourneyQuestion(e,ch,t,{phase:t.guidedOnly?'guided':'independent',...(e.inf?{scenePolicy:'expanded-v1'}:{})});assert.ok(question,`${e.id}/${ch.id}/${t.skill}`);assert.ok(question.answer.length);assert.ok(!question.prompt.includes('undefined'));assert.ok(question.answer.every(a=>gradeQuestion(question,a).ok),`${e.id}/${t.id}`);assert.equal(question.meta.targetId,t.id);count++;}}
 assert.ok(count>200000);console.log(`Catalog: ${verbs.length} verbs, ${words.length} words, ${count} available targets checked.`);
});
console.log(`Passed ${tests} taught-lesson content checks.`);
