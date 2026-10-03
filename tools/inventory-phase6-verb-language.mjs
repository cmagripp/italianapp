#!/usr/bin/env node
// Exact coverage inventory for linguistic review. Counts/hashes enumerate
// source and runtime output; they never turn an unread record into a pass.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {conjugate,splitClitic} from '../js/conjugator.js';
import {buildLesson,lessonContexts,lessonForms,formalLessonForms} from '../js/learning/lesson-content.js';
import {progressiveSpec,simpleVerbContexts,progressiveContexts} from '../js/learning/progressive-content.js';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const verbs=read('data/verbs.json'),cases=[['present','presente'],['past','passatoProssimo'],['background','imperfetto'],['future','futuro'],['condizionale','condizionale']];
const reviewPath='docs/implementation/programme/verb-language-reviews.json';
const reviews=fs.existsSync(new URL(reviewPath,root))?read(reviewPath).records:[];
const sourceOf=new Map(),policyOf=new Map();
for(const name of fs.readdirSync(new URL('data/verbs/',root)).filter(n=>n.endsWith('.json')).sort())for(const [index,e]of read('data/verbs/'+name).entries()){
 const old=sourceOf.get(e.inf);if(!old||['A1','A2','B1','B2','C1','C2'].indexOf(e.level)<['A1','A2','B1','B2','C1','C2'].indexOf(old.level))sourceOf.set(e.inf,{file:'data/verbs/'+name,index,level:e.level});
}
for(const name of fs.readdirSync(new URL('data/verb-progressive/',root)).filter(n=>n.endsWith('.json')).sort())for(const [index,e]of read('data/verb-progressive/'+name).entries())policyOf.set(e.inf,{file:'data/verb-progressive/'+name,index});
const optionNumber=(flag,fallback)=>{const i=process.argv.indexOf(flag);if(i<0)return fallback;const n=Number(process.argv[i+1]);if(!Number.isInteger(n)||n<0)throw Error(`${flag} requires a nonnegative integer`);return n;};
const audit=process.argv.includes('--audit'),compact=process.argv.includes('--compact'),view=process.argv.includes('--view')||compact||audit,from=optionNumber('--from',0),count=optionNumber('--count',20);
const fullIndex=process.argv.indexOf('--full-output'),fullOutput=fullIndex>=0?process.argv[fullIndex+1]:null;
if(fullIndex>=0&&(!fullOutput||!isAbsolute(fullOutput)))throw Error('--full-output requires an explicit absolute scratch path');
const records=[];
for(const [index,e]of verbs.entries()){
 if(view&&(index<from||index>=from+count))continue;
 const spec=progressiveSpec(e),c=conjugate(e.inf,e),sourceFields={en:e.en,aux:e.aux,trans:e.trans,isc:e.isc,irregular:e.irregular,usage:e.usage,patterns:e.patterns,examples:e.examples},sourceSHA256=hash(sourceFields),policySHA256=hash(spec);
 const compiled=cases.map(([chapter,tense])=>{
  const direct=lessonContexts(e,chapter),simple=['present','background'].includes(chapter)?simpleVerbContexts(e,{chapter,section:'all'}):[],progressive=['present','background'].includes(chapter)?progressiveContexts(e,{chapter,section:'all'}):[];
  const contexts=[...new Map([...direct,...simple,...progressive].map(s=>[s.id,s])).values()];
  return {chapter,tense,contexts:contexts.length,contextsSHA256:hash(contexts),finiteForms:Array.from({length:6},(_,person)=>lessonForms(e,tense,person)),formalLei:{male:formalLessonForms(e,tense,false),female:formalLessonForms(e,tense,true)},...view?{samples:contexts.filter(s=>s.person===0||s.role==='formal'||spec?.persons&&!spec.persons.includes(0)).map(s=>({id:s.id,it:s.it,en:s.en,answer:s.answer,person:s.person,role:s.role}))}: {}};
 });
 const compiledSHA256=hash(compiled.map(({samples,...row})=>row)),nonFiniteSHA256=hash({forms:c.nonFinite,notes:c.nonFiniteNotes}),review=reviews.find(r=>r.id===e.id),current=review?.sourceSHA256===sourceSHA256&&review?.policySHA256===policySHA256&&review?.compiledSHA256===compiledSHA256&&review?.nonFiniteSHA256===nonFiniteSHA256;
 const record={index,id:e.id,inf:e.inf,level:e.level,source:sourceOf.get(e.inf),sourceFields,sourceSHA256,policySource:policyOf.get(e.inf),policy:spec,policySHA256,nonFinite:c.nonFinite,nonFiniteNotes:c.nonFiniteNotes,nonFiniteSHA256,clitic:splitClitic(e.inf).clitic,defective:c.defective,cases:compiled,compiledSHA256,review:{status:current?review.status:'pending individual source/example/selected-sense/generated-case review',recordPresent:!!review,currentFingerprint:!!current,...current?{fields:review.fields,findings:review.findings}:{} }};
 if(audit){
  console.log(`\n${index} ${e.id} (${e.level}) ${e.en}; aux=${e.aux}, trans=${e.trans}, isc=${!!e.isc}, irregular=${!!e.irregular}`);
  console.log('Usage: '+e.usage+'; Patterns: '+(e.patterns || []).join(' | '));
  for(const s of e.examples)console.log('Source: '+s.it+' / '+s.en);
  console.log('Policy: '+spec.policy+' — '+spec.sense+'; '+spec.note+'; English: '+(spec.en || []).join(' / '));
  for(const frame of spec.frames || [])console.log('Frame: '+frame.join(' / '));
  console.log('Nonfinite: '+Object.entries(c.nonFinite).map(([k,v])=>k+'='+v).join('; '));
  for(const row of compiled){
   console.log(row.chapter+': '+row.finiteForms.map(f=>f.join(' / ')).join(' | ')+'; formal M='+row.formalLei.male.join(' / ')+', F='+row.formalLei.female.join(' / '));
   const selected=[row.samples.find(s=>s.person===0)||row.samples.find(s=>s.role==='ordinary'),row.samples.find(s=>s.role==='formal'),row.samples.find(s=>s.person===0&&s.id.includes(':progressive:'))||row.samples.find(s=>s.id.includes(':progressive:')),row.samples.find(s=>s.role==='formal'&&s.id.includes(':progressive:'))].filter(Boolean);
   for(const s of selected)console.log('Generated: '+s.it+' / '+s.en);
  }
 }
 else if(compact)console.log(JSON.stringify({index,id:e.id,sourceFields,policy:spec,nonFinite:c.nonFinite,cases:compiled.map(row=>({...row,samples:row.samples.filter(s=>s.role==='formal').slice(0,2).concat(row.samples.filter(s=>s.person===0).slice(0,2))}))}));
 else if(view)console.log(JSON.stringify(record));else{const plan=buildLesson(e);record.planSHA256=hash(plan);record.assessedTargets=plan.chapters.flatMap(ch=>ch.groups.flatMap(g=>g.targets.map(t=>({id:t.id,chapter:ch.id,skill:t.skill,person:t.person??null,role:t.role||'ordinary',available:t.available,required:t.required,contextCount:t.contexts?.length||0}))));records.push(record);}
}
if(!view){
 const summary={catalog:records.length,storedExamples:records.reduce((n,r)=>n+r.sourceFields.examples.length,0),policies:records.filter(r=>r.policy).length,caseRecords:records.length*5,compiledContexts:records.reduce((n,r)=>n+r.cases.reduce((m,c)=>m+c.contexts,0),0),currentScopedAgentReviews:records.filter(r=>r.review.currentFingerprint).length,fullRenderedContextReviews:reviews.filter(r=>r.scope?.allRenderedContexts===true&&records.find(v=>v.id===r.id)?.review.currentFingerprint).length};
 const report={schemaVersion:2,date:'2026-10-03',scope:'All 1185 baseline verbs plus additive riavere inventoried. Each linguistic review records its exact fields and sample IDs; reading source examples, frames and representative cases does not assert that every generated context or question has been independently read.',summary,reviewFile:reviewPath,gates:{fullIndividualAgentLinguisticReview:'in progress; exact reviewed/unreviewed IDs and remaining field scope recorded',nativeHumanItalianReview:'pending',pronunciationAndHumanAudio:'not validated here',learnerCalibration:'pending'}};
 let scratchEvidence=null;if(fullOutput){const source=JSON.stringify({...report,records},null,2)+'\n';fs.writeFileSync(fullOutput,source);scratchEvidence={sha256:createHash('sha256').update(source).digest('hex'),bytes:Buffer.byteLength(source),regenerate:'node tools/inventory-phase6-verb-language.mjs --full-output /tmp/parola-verb-language-full.json'};}
 const sourceFiles=[...new Set(records.flatMap(r=>[r.source.file,r.policySource.file]))].sort().map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex')}));
 const compactRecords=records.map(({sourceFields,policy,assessedTargets,...r})=>({...r,sourceFlags:{en:sourceFields.en,aux:sourceFields.aux,trans:sourceFields.trans,isc:!!sourceFields.isc,irregular:!!sourceFields.irregular,examples:sourceFields.examples.length,patterns:sourceFields.patterns?.length || 0},policyFlags:{policy:policy?.policy,sense:policy?.sense,frames:policy?.frames?.length || 0,persons:policy?.persons || [0,1,2,3,4,5],formal:policy?.formal!==false},assessedTargets:{count:assessedTargets.length,required:assessedTargets.filter(t=>t.required!==false).length,available:assessedTargets.filter(t=>t.available!==false).length,sha256:hash(assessedTargets)}}));
 const header=JSON.stringify({...report,sourceFiles,...scratchEvidence?{scratchEvidence}:{}},null,2).slice(0,-1);
 fs.writeFileSync(new URL('docs/implementation/programme/verb-language-inventory.json',root),header+',"records":[\n'+compactRecords.map(r=>JSON.stringify(r)).join(',\n')+'\n]}\n');console.log(JSON.stringify(summary));
}
