#!/usr/bin/env node
// Phase 2 assessment/assistance regressions against the shipping dictionary.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { assessLabBlank, answerLab, createLabSession, composeBuild } from '../js/learning/sentence-lab.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const dictionary={vocab:read('data/vocab.json'),verbs:read('data/verbs.json')};
const ctx={dictionary,speakerGender:'m',learnedIds:new Set()};
const blank=(slot,accept=[])=>({accept,options:[],bank:[],free:true,slot});
const check=(b,value,options={})=>assessLabBlank(b,value,{...ctx,...options});
const adjective=blank({pos:'adj',agree:'speaker',wrap:'sono {}'},['sono stanco']);
for(const value of ['stanchi','sono stanchi','stanca','sono stanca']){
  const r=check(adjective,value);assert.equal(r.outcome,'incorrect',value);assert.equal(r.filled,null);assert.equal(r.submission.originalText,value);
}
for(const value of ['tired','sono tired']){
  const r=check(adjective,value);assert.equal(r.outcome,'accepted');assert.equal(r.assessed,false);assert.equal(r.submission.ok,false);assert.deepEqual(r.assistance,['translation']);assert.equal(r.given,value);
}
const authored=blank(adjective.slot,['sono stanco','sono stanca','ho fame','ho sonno','sono felice']);
for(const speakerGender of ['m','f'])for(const value of authored.accept){
 const r=check(authored,value,{speakerGender}),wrongAgreement=value===(speakerGender==='m'?'sono stanca':'sono stanco');
 assert.equal(r.outcome,wrongAgreement?'incorrect':'correct');assert.equal(r.filled,wrongAgreement?null:value,'valid authored alternatives keep their wording');
}
for(const inputMode of ['typed','choice']){
 assert.equal(check(authored,'sono stanca',{speakerGender:'m',inputMode}).outcome,'incorrect');
 assert.equal(check(authored,'sono stanco',{speakerGender:'f',inputMode}).outcome,'incorrect');
}
const someoneElse=blank({pos:'adj',agree:'f-sg'},['stanca']);
assert.equal(check(someoneElse,'stanca',{speakerGender:'m'}).outcome,'correct','The learner preference must not change another person.');
const agreementLesson={id:'agreement',activities:[{id:'feeling',kind:'cloze',template:'Oggi ____.',blanks:[authored]}]},agreementSession=createLabSession(agreementLesson);
answerLab(agreementLesson,agreementSession,['sono stanco'],{...ctx,speakerGender:'f'});
const revealed=answerLab(agreementLesson,agreementSession,['sono stanco'],{...ctx,speakerGender:'f'}).result;
assert.equal(revealed.sentence,'Oggi sono stanca.');assert.equal(revealed.speakerAgreement,'f');
const resultBefore=JSON.stringify(revealed);answerLab(agreementLesson,agreementSession,['sono stanco'],ctx);assert.equal(JSON.stringify(agreementSession.state.result),resultBefore,'Changing preference cannot regrade a submitted result.');
const nationality=blank({pos:'adj',agree:'speaker'},['italiano','italiana','inglese','francese']);
assert.equal(check(nationality,'italiana',{speakerGender:'f'}).outcome,'correct');assert.equal(check(nationality,'italiano',{speakerGender:'f'}).outcome,'incorrect');
for(const speakerGender of ['m','f'])for(const word of ['inglese','francese'])assert.equal(check(nationality,word,{speakerGender}).outcome,'correct');
const compound=blank({pos:'verb',person:0,tense:'passatoProssimo'},['ho mangiato']);
for(const [value,gender] of [['ho preso','m'],['sono andato','m'],['sono andata','f'],['mi sono svegliato','m']]){
  const r=check(compound,value,{speakerGender:gender});assert.notEqual(r.outcome,'incorrect',value);assert.equal(r.filled,value);assert.deepEqual(r.assistance,[]);assert.equal(r.submission.ok,true);
}
for(const value of ['ho andato','sono preso','hai preso','prendo'])assert.equal(check(compound,value).outcome,'incorrect',value);
const ho=blank({pos:'verb',person:0,tense:'passatoProssimo',wrap:'ho {}'},['ho mangiato']);
for(const value of ['ho preso','preso'])assert.equal(check(ho,value).filled,'ho preso',value);
const progressive=blank({pos:'verb',person:0,tense:'presente',wrap:'sto {}'},['sto leggendo']);
for(const value of ['mangiando','sto mangiando'])assert.equal(check(progressive,value).filled,'sto mangiando');
assert.equal(check(progressive,'mangio').outcome,'incorrect');
const time=blank({pos:'adv',category:['time']},['oggi']);
for(const value of ['ieri sera','domani mattina','la sera','la mattina','il lunedì']){const r=check(time,value);assert.notEqual(r.outcome,'incorrect',value);assert.equal(r.filled,value);assert.deepEqual(r.assistance,[]);}
for(const value of ['ieri mattine','la notte domani qqq'])assert.equal(check(time,value).outcome,'incorrect');
const alt=blank({pos:'verb',person:0,tense:'presente'},['devo']);assert.equal(check(alt,'debbo').filled,'debbo');
const tea=blank({pos:'noun',number:'sg',article:'none'},['tè']);
for(const accentStrict of [false,true]){
  const r=check(tea,'te',{accentStrict});assert.equal(r.outcome,accentStrict?'incorrect':'correct');assert.equal(r.submission.originalText,'te');assert.equal(r.submission.displayText,accentStrict?'te':'tè');assert.equal(r.submission.matchKind,'accent-only');
  assert.equal(check(adjective,'stanchi',{accentStrict}).outcome,'incorrect');
  assert.equal(check(adjective,'tired',{accentStrict}).assessed,false);
}
const freeTea=check(blank({pos:'noun',number:'sg',article:'none'},['pane']),'caffe');assert.equal(freeTea.submission.displayText,'caffè');assert.equal(freeTea.submission.originalText,'caffe');assert.equal(freeTea.assessed,true);
const lesson={id:'phase2-workshop',activities:[{id:'p2-verb',kind:'cloze',template:'Marco ____ la pizza.',en:'Marco eats pizza.',blanks:[blank({pos:'verb',person:2,tense:'presente'},['mangia'])]}]};
const invalid=answerLab(lesson,createLabSession(lesson),['piace'],ctx).result;assert.equal(invalid.outcome,'incorrect');assert.match(invalid.explanation,/piacere/);
const validLesson={...lesson,activities:[{...lesson.activities[0],template:'A Marco ____ la pizza.'}]};assert.notEqual(answerLab(validLesson,createLabSession(validLesson),['piace'],ctx).result.outcome,'incorrect');
const build={tense:'presente',roles:[{role:'subject',items:[{it:'Marco',person:2}]},{role:'verb',items:[{inf:'piacere',aux:'essere'}]},{role:'object',items:[{it:'la pizza'}]}]};assert.equal(composeBuild(build,{subject:0,verb:0,object:0},ctx).ok,false);
const translatedLesson={id:'assisted',activities:[{id:'a',kind:'cloze',template:'Oggi ____.',blanks:[adjective]}]};
const assisted=answerLab(translatedLesson,createLabSession(translatedLesson),['sono stanco'],{...ctx,blankInputs:{0:{inputMode:'typed',originalText:'tired',assistance:['translation']}}}).result;assert.equal(assisted.outcome,'accepted');assert.equal(assisted.blanks[0].given,'tired');assert.equal(assisted.blanks[0].assessed,false);
const narrative=answerLab(lesson,createLabSession(lesson),['vede'],ctx).result;assert.equal(narrative.glossIsPattern,true);assert.ok(narrative.wordGlosses.some(g=>/see/.test(g.en)),'changed words do not inherit a false sentence translation');
console.log('Phase 2 workshop: agreement, authored alternatives, assistance provenance, compound/wrapped verbs, time phrases, accent-only policy, valency and honest glosses passed.');
