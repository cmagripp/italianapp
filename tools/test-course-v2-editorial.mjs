#!/usr/bin/env node
// Independent editorial regression fixtures for the advanced course. These
// expectations describe meanings a learner can reasonably express, not a copy
// of the authored answer/accepted arrays.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessCourseAnswer} from '../js/learning/course-v2-engine.js';

const packs=['C1','C2'].map(level=>JSON.parse(fs.readFileSync(new URL(`../data/course-v2/${level}.json`,import.meta.url))));
const lessons=packs.flatMap(pack=>pack.units.flatMap(unit=>unit.lessons));
const intermediate=['A2','B1','B2'].map(level=>JSON.parse(fs.readFileSync(new URL(`../data/course-v2/${level}.json`,import.meta.url))))
  .flatMap(pack=>pack.units.flatMap(unit=>unit.lessons));
const byId=new Map([...intermediate,...lessons].map(lesson=>[lesson.id,lesson]));
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
const lesson=id=>{const found=byId.get(id);assert(found,`Missing editorial fixture lesson ${id}`);return found;};
const question=(lessonId,suffix)=>{
  const id=`${lessonId}.${suffix}`;
  const found=lesson(lessonId).steps.find(step=>step.id===id);
  assert(found?.kind==='question',`Missing editorial fixture question ${id}`);
  return found;
};
const answer=(lessonId,suffix,response,expected)=>{
  const q=question(lessonId,suffix);
  const outcome=assessCourseAnswer(q,response).outcome;
  check(outcome===expected,`${q.id}: ${JSON.stringify(response)} should be ${expected}; got ${outcome}`);
};
const preSourceText=id=>{
  const l=lesson(id),sourceIndex=l.steps.findIndex(step=>step.kind==='passage');
  check(sourceIndex>0,`${id}: no source passage after introduction`);
  return [l.targets.map(target=>[target.explanation,target.repair?.body,...(target.repair?.examples||[]).map(example=>example.it)].join(' ')).join(' '),
    ...l.steps.slice(0,sourceIndex).filter(step=>step.kind==='teach').map(step=>[step.body,...(step.examples||[]).map(example=>example.it)].join(' '))].join(' ');
};

// Advanced units are communicative work: a written source, a distinct spoken
// source, and a response to them. Each level also needs actual audio-linked
// comprehension checks; not every unit has to award machine-scored listening.
for(const pack of packs)for(const unit of pack.units){
  const steps=unit.lessons.flatMap(l=>l.steps),read=steps.filter(s=>s.kind==='passage'&&s.mode==='read'),
    listen=steps.filter(s=>s.kind==='passage'&&s.mode==='listen');
  check(read.length>0,`${unit.id}: no coherent written source`);
  check(listen.length>0,`${unit.id}: no distinct spoken source`);
  check(steps.some(s=>s.kind==='portfolio'),`${unit.id}: no applied production/mediation task`);
}
for(const pack of packs){
  const steps=pack.units.flatMap(unit=>unit.lessons.flatMap(l=>l.steps)),audioIds=new Set(steps.filter(s=>s.kind==='passage'&&s.mode==='listen').map(s=>s.audioId||s.id));
  check(steps.some(s=>s.kind==='question'&&s.stage==='independent'&&s.audioId&&audioIds.has(s.audioId)),
    `${pack.level}: no independent source-linked listening check`);
}

// Application models must not give away evidence before the last independent
// check. A learner who succeeds without using the source has not shown the
// advertised reading/listening ability.
for(const l of lessons){
  const lastIndependent=l.steps.reduce((index,step,i)=>step.kind==='question'&&step.stage==='independent'&&!step.reserve?i:index,-1);
  for(const [i,step] of l.steps.entries())if(step.kind==='portfolio')
    check(i>lastIndependent,`${l.id}: portfolio model appears before an independent check`);
  const oneMinute=l.steps.filter(step=>step.kind==='portfolio'&&/one.minute/i.test(step.prompt));
  for(const step of oneMinute){
    const count=step.model.trim().split(/\s+/).length;
    check(count>=85,`${step.id}: one-minute production model is only ${count} words; extend the model or shorten the task`);
  }
}

// These phrases identify conclusions from the *assessed* sources. General
// source-reading strategy may be taught first, but the result itself must be
// discovered in the source or post-answer feedback.
const sourceLeaks=[
  ['v2-c1-u3-claim-evidence',/existing users|utenti (?:già |attuali)|cost(?:s)? of (?:a |the )?(?:longer |evening )?open|sostenibil|centoventi|settantotto|78\s*(?:su|out of)\s*120/i],
  ['v2-c1-u8-narrative-stance',/mattia|pascal|repeats? his name|ripet(?:e|eva) il (?:suo )?nome|familiar guess|genitor|parenti|misfortune|disgrazia/i],
  ['v2-c2-u5-literary-narrator',/pinocchio|collodi|\bking\b|\bre\b|piece of wood|pezzo di legno|carpenter|falegname/i],
];
for(const [id,pattern] of sourceLeaks)
  check(!pattern.test(preSourceText(id)),`${id}: pre-source explanation/model reveals this source's assessed content (${pattern})`);

const leakedContexts=[
  ['v2-c1-u8-narrative-stance','q2',/non poter più rispondere|cannot (?:use|give) that answer/i],
  ['v2-c1-u8-interview-implication','q3',/fotograf|photo|ordinare/i],
  ['v2-c2-u5-literary-narrator','q2',/pezzo di legno|piece of wood|firewood/i],
  ['v2-c2-u5-literary-narrator','q3',/figurat|imagin/i],
];
for(const [id,suffix,pattern] of leakedContexts){
  const q=question(id,suffix);
  check(!pattern.test([q.context,q.translation].filter(Boolean).join(' ')),`${q.id}: question context supplies its source answer`);
  const passageId=q.audioId||q.passageId;
  check(Boolean(passageId)&&lesson(id).steps.some(step=>step.id===passageId&&step.kind==='passage'),`${q.id}: source-dependent question needs a retrievable passage`);
}

// Fresh examples that preserve the original communicative intent must receive
// credit; they are not derived from either author's accepted-answer lists.
answer('v2-c2-u6-register-shifts','q2','Potrebbe mandarmi il modulo?','correct');
answer('v2-c2-u6-register-shifts','q2','Mi potrebbe mandare il modulo?','correct');
answer('v2-c1-u10-conditional-politeness','q2','Potrebbe dirmi quando apre lo sportello?','correct');
// Independent B1/B2 peer findings: speaker gender, idiomatic reporting and
// indicative acknowledgement must also survive authoring regeneration.
answer('v2-b1-past-habits','check-2','sono rimasta','correct');
answer('v2-b2-reported-past','check-2','ha perso','correct');
answer('v2-b2-negotiate-compromise','check-2','è','correct');
answer('v2-b2-clarify-intent','check-1','è','incorrect'); // The prompt explicitly asks for subjunctive.
check(question('v2-b1-ne-quantity','check-1').context.startsWith('Vuoi delle arance?'),
  'v2-b1-ne-quantity.check-1: quantity reply must answer the actual question');
for(const id of ['v2-b2-reported-past','v2-b2-reported-questions'])
  check(!/\b(?:disse|chiese)\b|domandò/i.test(JSON.stringify(lesson(id))),
    `${id}: untaught passato remoto remains in the pre-remoto reporting unit`);

// A2 peer review fixtures guard fair choices and genuinely coherent exchanges.
// A valid phrase may be omitted from the offered choices; if it is offered, it
// must not be the knowingly wrong distractor.
{
  const q=question('v2-a2-quantity','s5'),valid='un po’ di';
  check(!q.options?.includes(valid)||assessCourseAnswer(q,valid).outcome==='correct',
    `${q.id}: grammatical “un po’ di libri” must not be offered as a wrong answer`);
}
{
  const q=question('v2-a2-simple-versus-progressive','s5');
  check(/stare\s*\+\s*gerund|progressiv/i.test([q.prompt,q.translation].join(' ')),
    `${q.id}: plain present also describes now; explicitly request progressive emphasis`);
}
{
  const q=question('v2-a2-story-contrast','s5');
  check(!q.options?.includes('chiamava')||/a un certo punto|all'improvviso|una volta|one.time|at one point/i.test([q.context,q.translation].join(' ')),
    `${q.id}: ha chiamato versus chiamava needs a bounded-event cue`);
  const scene=question('v2-a2-short-story','s6');
  check(!scene.options?.includes('è stato')||/background|setting|scene/i.test([scene.prompt,scene.translation].join(' ')),
    `${scene.id}: è stato may fit an uncued completed state`);
}
{
  const q=question('v2-a2-direct-reference','s5');
  check(!/sì,\s*___\s*leggo/i.test(q.context)||/leggi\s+la\s+lettera\?/i.test(q.context),
    `${q.id}: “yes, I read it” must answer a question about reading, not possession`);
}
for(const id of ['v2-a2-conditional-request','v2-a2-conditional-plan']){
  const q=question(id,'s8');
  check(!q.strict||/volere|vorrei/i.test([q.prompt,q.translation].join(' ')),
    `${q.id}: strict Vorrei cloze needs a volere cue; other polite phrases fit the meaning`);
}

// These deliberately incorrect alternatives alter condition, scope, evidence
// or timing. Keep them distinguishable even when a rewrite admits synonyms.
answer('v2-c2-u12-production','q1','La visita sarà rinviata anche senza pioggia.','incorrect');
answer('v2-c2-u3-negation-scope','q1','Nessun ospite è arrivato','incorrect');
answer('v2-c1-u3-claim-evidence','q2','A permanent extension will pay for itself','incorrect');
answer('v2-c2-u10-source-conflict','q1','Hospital arrivals','incorrect');
answer('v2-c2-u10-source-conflict','q3','The diversion certainly helps every district.','incorrect');
answer('v2-c2-u12-integrated-dossier','q4','Open the crossing immediately because the dry-day route is short.','incorrect');
answer('v2-c2-u12-production','q4','Il passaggio è già sicuro e fa risparmiare venti minuti a tutti.','incorrect');

const dossierRewrite=question('v2-c2-u12-production','q4');
const dossierTranslation=[dossierRewrite.translation,dossierRewrite.context].filter(Boolean).join(' ');
check(!/office|delay|segreteria|ritardo/i.test(dossierTranslation),`${dossierRewrite.id}: unrelated office/delay prompt contaminates the river-crossing dossier`);
check(/passaggio|crossing|pioggia|rain|sicurezza|safety|accessibil|mobilit/i.test(dossierTranslation),`${dossierRewrite.id}: dossier prompt should mention the actual decision or conditions`);

// These outcomes require more than one interchangeable 'core' check: source
// observation vs warranted inference, and source attribution vs synthesis.
for(const id of ['v2-c1-u3-claim-evidence','v2-c2-u10-source-conflict','v2-c2-u12-integrated-dossier']){
  const l=lesson(id),target=l.targets[0];
  check(target.facets.length>=2,`${id}: split distinct source/evidence and interpretation/decision facets`);
  for(const facet of target.facets){
    const independent=l.steps.filter(step=>step.kind==='question'&&step.stage==='independent'&&step.facet===facet);
    check(independent.length>=2&&new Set(independent.map(step=>step.contextKey)).size>=2,
      `${id}: facet ${facet} needs at least two fresh independent contexts`);
  }
}

if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`Editorial fixtures passed for ${lessons.length} advanced lessons plus independent A2–B2 answer meanings.`);
