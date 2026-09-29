#!/usr/bin/env node
// Hand-checked expectations plus whole-catalog safety for both progressive groups.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildProgressiveGroup,progressiveForms,progressiveContexts,progressiveInfo} from '../js/learning/progressive-content.js';

let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS',name);};
const verb=inf=>({id:`v:${inf}`,kind:'verb',inf});

check('Regular groups use the actual gerundio and all six stare forms',()=>{
  assert.deepEqual(Array.from({length:6},(_,p)=>progressiveForms(verb('parlare'),p)[0]),['sto parlando','stai parlando','sta parlando','stiamo parlando','state parlando','stanno parlando']);
  assert.deepEqual(progressiveForms(verb('scrivere'),0),['sto scrivendo']);
  assert.deepEqual(progressiveForms(verb('dormire'),0),['sto dormendo']);
});
check('Irregular gerunds are never derived by dropping the infinitive ending',()=>{
  for(const [inf,gerund] of [['fare','facendo'],['dire','dicendo'],['bere','bevendo'],['tradurre','traducendo']]){
    assert.deepEqual(progressiveForms(verb(inf),0),[`sto ${gerund}`]);
    assert.equal(progressiveInfo(verb(inf)).irregular,true);
    assert.match(buildProgressiveGroup(verb(inf)).cards.find(c=>c.id==='progressive-forms').body,/learn separately/);
  }
});
check('Reflexive pronouns match the person in both valid positions',()=>{
  assert.deepEqual(progressiveForms(verb('lavarsi'),0),['mi sto lavando','sto lavandomi']);
  assert.deepEqual(progressiveForms(verb('vestirsi'),1),['ti stai vestendo','stai vestendoti']);
  assert.deepEqual(progressiveForms(verb('alzarsi'),3),['ci stiamo alzando','stiamo alzandoci']);
  assert.deepEqual(progressiveForms(verb('andarsene'),3),['ce ne stiamo andando','stiamo andandocene']);
  assert(!progressiveForms(verb('lavarsi'),0).includes('sto lavandosi'));
});
check('Formal Lei is distinct evidence with the third-person stare form',()=>{
  const group=buildProgressiveGroup(verb('parlare'));
  assert.equal(group.targets.length,7);
  const formal=group.targets.find(t=>t.role==='formal');
  assert.equal(formal.person,2);assert.equal(formal.skill,'progressive');
  assert.deepEqual(formal.answerForms,['sta parlando']);
  assert(formal.contexts.some(c=>c.it.includes('Signora Rossi')));
  assert(group.cards.some(c=>c.forms?.some(row=>row.label.includes('Lei')&&row.gloss.includes('formal'))));
});
check('Weather is impersonal, never a six-person progressive drill',()=>{
  for(const inf of ['piovere','nevicare']){
    const group=buildProgressiveGroup(verb(inf));assert.equal(group.targets.length,1);
    assert.equal(group.targets[0].person,2);
    for(const person of [0,1,3,4,5])assert.deepEqual(progressiveForms(verb(inf),person),[]);
  }
  assert.deepEqual(progressiveForms(verb('piovere'),2),['sta piovendo']);
});
check('Statives teach the limitation without manufactured scored constructions',()=>{
  for(const inf of ['essere','avere','sapere','volere','potere','dovere','piacere','credere','stare']){
    const entry=verb(inf),group=buildProgressiveGroup(entry);
    assert.deepEqual(progressiveForms(entry,0),[]);assert.deepEqual(progressiveContexts(entry),[]);
    assert(group.cards[0].notes.some(note=>note===progressiveInfo(entry).limitation));
    assert.equal(group.targets.length,1);assert.equal(group.targets[0].skill,'progressiveUsage');
    assert.equal(group.targets[0].guidedOnly,true);assert.equal(group.targets[0].required,false);
    assert.equal(group.targets[0].completionRequired,true);
    assert(!group.targets[0].answerForms.some(answer=>/^sto /.test(answer)));
  }
});
check('Unknown or special-clitic verbs never acquire an invented semantic drill',()=>{
  for(const inf of ['inventareunverbo','avercela','metterci']){
    const entry=verb(inf),group=buildProgressiveGroup(entry);
    assert.equal(progressiveInfo(entry).supported,false);assert.deepEqual(progressiveForms(entry,0),[]);
    assert(group.targets.every(target=>target.guidedOnly&&target.required===false));
  }
  assert.equal(buildProgressiveGroup(null),null);
});
check('Teaching states the contrast and patterns without banning ordinary present now',()=>{
  const group=buildProgressiveGroup(verb('parlare'));
  assert.match(group.cards[0].body,/ordinary present can also describe what is happening now/);
  assert.match(group.cards.find(c=>c.id==='progressive-forms').body,/-are → -ando; -ere and -ire → -endo/);
  assert(group.cards[0].notes.some(note=>note.includes('general routine')));
});
check('Authored contexts remain exact and each target span is a valid whole construction',()=>{
  for(const inf of ['parlare','mangiare','lavorare','studiare','dormire','scrivere','leggere','dire','fare','bere','tradurre','lavarsi','andarsene','piovere']){
    const entry=verb(inf),contexts=progressiveContexts(entry);assert(contexts.length>=2);
    for(const context of contexts){
      assert(context.it.toLocaleLowerCase('it').includes(context.answer));
      assert(context.answers.includes(context.answer));assert(context.answers.every(form=>progressiveForms(entry,context.person).includes(form)));
      assert.equal(context.source,'reviewed-progressive');assert(context.en.length>0);
    }
  }
  assert.equal(progressiveContexts(verb('scrivere'))[0].it,'Sto scrivendo un messaggio.');
  assert.equal(progressiveContexts(verb('lavarsi'))[0].it,'Mi sto lavando le mani.');
});
check('Descriptors are stable, serializable, finite and have two genuine question modes',()=>{
  const entry=verb('leggere'),group=buildProgressiveGroup(entry);
  assert.deepEqual(JSON.parse(JSON.stringify(group)),group);
  assert.deepEqual(group,buildProgressiveGroup(entry));
  for(const target of group.targets){
    assert(target.id.startsWith('v:leggere::lesson::present::progressive-'));
    assert(target.required&&target.available);assert(target.independentVariantCount>=2);
    assert(target.answerForms.length);assert.equal(target.answerFormsByVariant.length,target.personsByVariant.length);
  }
});
check('Every catalog verb gets safe teaching; only reviewed senses receive construction targets',()=>{
  const json=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url),'utf8'));
  const verbs=Array.isArray(json)?json:json.verbs||json.items||[];
  assert(verbs.length>1000);
  let supported=0,scenes=0;
  for(const raw of verbs){
    const entry={...raw,id:raw.id||`v:${raw.inf}`},group=buildProgressiveGroup(entry);
    assert(group?.cards.length);assert(group.targets.length);
    if(progressiveInfo(entry).supported){supported++;scenes+=progressiveContexts(entry).length;assert(group.targets.every(t=>t.skill==='progressive'));}
    else assert(group.targets.every(t=>t.skill==='progressiveUsage'&&t.guidedOnly&&t.required===false));
  }
  console.log(`  Coverage: ${verbs.length} verbs; ${supported} reviewed progressive senses; ${scenes} exact authored contexts.`);
});
check('Past progressive uses all six imperfect helpers and keeps clitics',()=>{
  const opts={chapter:'background'};
  assert.deepEqual(Array.from({length:6},(_,p)=>progressiveForms(verb('mangiare'),p,opts)[0]),['stavo mangiando','stavi mangiando','stava mangiando','stavamo mangiando','stavate mangiando','stavano mangiando']);
  assert.deepEqual(progressiveForms(verb('lavarsi'),0,opts),['mi stavo lavando','stavo lavandomi']);
  assert.deepEqual(progressiveForms(verb('andarsene'),3,opts),['ce ne stavamo andando','stavamo andandocene']);
  assert.deepEqual(progressiveForms(verb('piovere'),2,opts),['stava piovendo']);
  const group=buildProgressiveGroup(verb('parlare'),opts),formal=group.targets.find(t=>t.role==='formal');
  assert.equal(formal.id,'v:parlare::lesson::background::progressive-formal');
  assert.equal(formal.tense,'imperfettoProgressivo');assert.deepEqual(formal.answerForms,['stava parlando']);
  assert(formal.contexts.some(c=>c.it==='Signora Rossi, stava parlando con il medico?'&&c.en==='Ms Rossi, were you speaking with the doctor?'));
});
check('All 84 reviewed past scenes retain correct target spans and past time cues',()=>{
  const verbs=JSON.parse(fs.readFileSync(new URL('../data/verbs.json',import.meta.url),'utf8'));
  let count=0;
  for(const entry of verbs){for(const context of progressiveContexts(entry,{chapter:'background'})){
    count++;assert(context.it.toLocaleLowerCase('it').includes(context.answer),context.it);
    assert(!/\b(?:sto|stai|sta|stiamo|state|stanno|ora|adesso|oggi)\b/i.test(context.it),context.it);
    assert(!/\b(?:am|are|is|now|today)\b/i.test(context.en),context.en);
    assert(context.answers.every(form=>progressiveForms(entry,context.person,{chapter:'background'}).includes(form)));
    assert.equal(context.source,'reviewed-past-progressive');
  }}
  assert.equal(count,84);
  const said=progressiveContexts(verb('dire'),{chapter:'background'}).find(c=>c.role==='formal');
  assert.match(said.it,/il treno era in ritardo/);assert.match(said.en,/the train was late/);
});
check('The four-way contrast teaches viewpoint without claiming all food was finished',()=>{
  for(const chapter of ['present','background']){
    const group=buildProgressiveGroup(verb('mangiare'),{chapter}),c=group.cards.find(c=>c.id==='progressive-contrast');
    assert.deepEqual(c.examples.map(e=>e.it),['Ora sto mangiando una mela.','Quando hai chiamato, stavo mangiando.','Da bambino mangiavo una mela ogni pomeriggio.','Ieri ho mangiato al ristorante.']);
    assert(c.notes.some(n=>n.includes('Mangiavo can also describe an action in progress')));
    assert(c.notes.some(n=>n.includes('does not, by itself, mean that every bit')));
  }
  const limited=buildProgressiveGroup(verb('sapere'),{chapter:'background'});
  assert(limited.cards[0].notes.some(n=>n.includes('simple imperfetto')));
  assert.equal(limited.targets[0].usageAnswers[0],'An action in progress at a past moment');
  assert.equal(limited.targets[0].completionRequired,true);
});
console.log(`\n${passed} progressive content checks passed.`);
