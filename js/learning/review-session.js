// A visit is finite and recoverable. Its question snapshots and denominator stay
// fixed through mistakes, pause, reload and changes to the wider due backlog.
import { data, getEntry } from '../data.js';
import { objectiveId } from './curriculum.js';
import { canonicalObjectiveId } from './objectives.js';
import { lessonPlan, lessonObjectives, entryCompletion } from './integration.js';
import { buildQuestion, escapeHTML } from './questions.js';
import { buildJourneyQuestion } from './lesson-questions.js';
import { buildShortWordQuestion } from './word-questions.js';
import { lessonEntry } from './lesson-content.js';
import { gradeQuestion } from './diagnose.js';
import { compareSubmission } from './answer-policy.js';
import { grammarLesson } from './grammar-course.js';
import { assessCourseAnswer } from './course-v2-engine.js';

export const REVIEW_VISIT_VERSION=1;
const clone=x=>JSON.parse(JSON.stringify(x));
const seed=id=>{let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const norm=x=>String(x || '').normalize('NFC').toLocaleLowerCase('it').trim();
const prompt=(main,detail='')=>`<div class="big md">${escapeHTML(main)}</div>${detail?`<div class="sub">${escapeHTML(detail)}</div>`:''}`;

function grammarQuestion(row,target,variant,typed) {
  const lesson=grammarLesson(row.entry.id);
  if(!lesson)return null;
  const descriptor=(lesson.targets || lesson.objectives || []).find(o=>o.id===target.objectiveId);
  if(!descriptor)return null;
  const all=lesson.targets?lesson.steps.filter(s=>s.kind==='question'&&s.target===descriptor.id):descriptor.questions || [];
  const facet=target.unresolvedErrors?.[0]?.facet;
  let candidates=all.filter(q=>!q.guided&&q.stage!=='guided');
  if(facet && candidates.some(q=>q.facet===facet))candidates=candidates.filter(q=>q.facet===facet);
  const preference=candidates.filter(q=>typed?q.format==='type':['choice','mc'].includes(q.format));
  if(preference.length)candidates=preference;
  if(!candidates.length)candidates=all;
  const source=candidates[variant%candidates.length];
  if(!source)return null;
  const format=source.format,type=['choice','mc'].includes(format)?'mc':'type';
  let answers=[source.answer,...source.accepted || []],options=source.options || source.choices || [];
  if(format==='match') {
    // Judge the whole correspondence in one recognition choice. A forced last
    // matching pair is never converted into independent recall evidence.
    const pairs=source.pairs || [];if(pairs.length<2)return null;
    const mapping=offset=>pairs.map((p,i)=>`${p.left} → ${pairs[(i+offset)%pairs.length].right}`).join(' · ');
    answers=[mapping(0)];options=[mapping(0),mapping(1),...(pairs.length>2?[mapping(2)]:[])];
  }
  const actualType=format==='match'?'mc':type;
  const choices=actualType==='mc'?options.map(o=>{const label=typeof o==='string'?o:o.label || o.value;return {label,value:label,correct:answers.some(a=>norm(a)===norm(label))};}):[];
  if(actualType==='mc'&&(!choices.some(c=>c.correct)||choices.length<2))return null;
  const requiresAudio=descriptor.modality==='listening';
  const readingSource=descriptor.modality==='reading'?lesson.steps?.find(step=>step.id===source.passageId)?.it || '':'';
  return {type:actualType,answer:answers,choices,itemId:row.entry.id,tag:row.label,
    prompt:prompt(source.prompt,requiresAudio?'Listen to the complete sentence.':'')+(!requiresAudio&&source.context?`<div class="big md" lang="it">${escapeHTML(source.context)}</div>`:'')+(!requiresAudio&&source.translation?`<div class="sub">${escapeHTML(source.translation)}</div>`:'')+(readingSource?`<p class="course-passage" lang="it">${escapeHTML(readingSource)}</p>`:''),
    say:source.speak || (requiresAudio?source.context:'') || '',audioId:source.audioId || null,listening:requiresAudio,
    explain:escapeHTML(source.explanation || descriptor.explanation || ''),hint:source.hint || descriptor.explanation || '',
    sourceStep:lesson.targets&&format!=='match'?clone(source):null,
    meta:{objectiveId:target.objectiveId,entryId:row.entry.id,kind:'grammar',skill:source.facet || descriptor.errorTag || target.skill,
      policy:lesson.targets?'grammar-v2':'grammar-v1',contentVersion:lesson.contentVersion || 1,
      grammarPhase:source.guided||source.stage==='guided'?'guided':'independent',facet:source.facet || null,
      requiredFacets:descriptor.facets || [],minIndependent:descriptor.minIndependent || 2,
      requiresProduction:descriptor.requiresProduction===true,modality:descriptor.modality || 'language',
      exposureGroup:source.exposureGroup || source.id,responseMode:actualType==='type'?'production':'recognition',
      mode:actualType==='type'?'production':'recognition',variantId:source.id,
      contextId:source.contextKey || source.speak || source.context || source.prompt,
      diagnostic:{kind:'component',component:source.facet || descriptor.errorTag || target.skill}}};
}
export function reviewQuestion(row,target,{variant=0,typed=false}={}) {
  typed=typed || target.schedulingMode==='production' || target.unresolvedErrors?.some(e=>e.evidenceMode==='production')
    || !!target.responseEvidence?.written?.unresolvedErrors?.length;
  if(row.entry.kind==='grammar')return grammarQuestion(row,target,variant,typed);
  const entry=row.entry,plan=lessonPlan(entry);
  const descriptor=lessonObjectives(entry).find(o=>canonicalObjectiveId(o.id)===canonicalObjectiveId(target.objectiveId));
  let question=null;
  if(descriptor && !target.legacyItem) {
    const chapter=plan.chapters.find(c=>c.id===descriptor.chapterId);
    if(entry.kind!=='verb' && !typed && ['meaning','recall','article','plural','agreement'].includes(descriptor.skill))
      question=buildShortWordQuestion(lessonEntry(entry),descriptor,{variant,phase:'independent',format:'mc',pool:data.vocab,chapterId:chapter.id});
    else if(entry.kind!=='verb' && !typed)
      question=buildQuestion(lessonEntry(entry),descriptor,{variant,mode:'recognition',pool:data.vocab,rng:()=>.37});
    else question=buildJourneyQuestion(entry,chapter,descriptor,{variant,phase:'independent',format:typed?'type':'mc',scenePolicy:'expanded-v1'});
    if(question)question.meta={...question.meta,policy:'journey-v1',targetId:descriptor.id,chapterId:chapter.id,contentVersion:plan.version || 1,activityKind:'independent'};
  } else {
    const skill=target.legacyItem&&entry.kind==='verb'?'conjugation':target.skill;
    const id=target.objectiveId || objectiveId(entry.id,entry.kind==='verb'?target.tense:null,skill);
    question=buildQuestion(entry,{id,entryId:entry.id,kind:entry.kind,skill,tense:target.tense || null},
      {variant,mode:typed?'production':'recognition',repairPerson:target.unresolvedErrors?.find(e=>e.person!=null)?.person,
        allowedTenses:target.tense?[target.tense]:[],pool:[...data.vocab,...data.verbs],rng:()=>.37});
  }
  if(!question)return null;
  question.meta={...question.meta,objectiveId:target.objectiveId || question.meta.objectiveId,
    reviewPolicy:'unified-review-v1'};
  question.tag=row.label;question.explain=question.explain || escapeHTML(question.tip || question.lesson || '');
  question.hint=question.tip || question.lesson || '';
  // The snapshot contains authored data only. Runtime callbacks are rebuilt by
  // the shared assessment policy and are never persisted as a resume dependency.
  delete question.accept;delete question.activity;
  return clone(question);
}
export function selectReviewTargets(rows,{limit=8,objective=null}={}) {
  const out=[],queues=rows.map(row=>({row,targets:row.targets.filter(t=>!t.contentUnavailable&&(!objective || canonicalObjectiveId(t.objectiveId)===canonicalObjectiveId(objective))).slice()}));
  while(out.length<limit&&queues.some(q=>q.targets.length))for(const queue of queues){
    if(out.length>=limit)break;
    const target=queue.targets.shift();if(target)out.push({row:queue.row,target});
  }
  return out;
}
export function createReviewVisit(store,rows,{id=`review:${globalThis.crypto?.randomUUID?.() || Date.now()+':'+Math.random().toString(36).slice(2)}`,now=Date.now(),minutes=4,limit=null,objective=null,typed=false}={}) {
  const cap=Math.max(1,Math.min(10,limit || Math.floor((Number(minutes)||4)*2)));
  const questions=selectReviewTargets(rows,{limit:cap,objective}).map(({row,target},i)=>{
    const question=reviewQuestion(row,target,{typed,variant:(seed(id+':'+(target.objectiveId || row.id))+i)%12});
    return question?{rowId:row.id,entryId:row.entry.id,caseId:row.caseId,label:row.label,
      objectiveId:target.objectiveId || question.meta.objectiveId,legacyItem:!!target.legacyItem,enrolled:!!target.enrolled,
      due:target.due || 0,question}:null;
  }).filter(Boolean);
  return {id,entryId:rows.length===1?`review:${rows[0].id}`:'review:mixed',mode:'review',epochId:store.learning.epoch.id,
    profileId:store.current.id,...store.current.learnerId?{learnerId:store.current.learnerId}:{},objectiveIds:[...new Set(questions.map(q=>q.objectiveId))],index:0,
    createdAt:now,updatedAt:now,answeredEventIds:[],completedObjectiveIds:[],reviewedObjectiveIds:[],deferred:{},
    reviewVisit:{version:REVIEW_VISIT_VERSION,phase:questions.length?'question':'complete',index:0,total:questions.length,
      caseId:rows.length===1?rows[0].caseId:null,questions,draft:'',assistance:[],audioPlayed:[],result:null,answers:[],paused:false}};
}
export function compatibleReviewVisit(session,store) {
  const v=session?.reviewVisit;
  return !!v&&v.version===REVIEW_VISIT_VERSION&&session.epochId===store.learning.epoch.id
    &&(session.learnerId&&store.current.learnerId?session.learnerId===store.current.learnerId:session.profileId===store.current.id)
    &&Array.isArray(v.questions)&&v.total===v.questions.length&&v.total<=10&&Number.isInteger(v.index)&&v.index>=0&&v.index<=v.total
    &&['question','feedback','complete'].includes(v.phase)&&typeof v.draft==='string'&&Array.isArray(v.assistance)&&Array.isArray(v.answers)
    &&v.questions.every(q=>q.entryId&&q.objectiveId&&['mc','type'].includes(q.question?.type)&&Array.isArray(q.question.answer));
}
export const currentReviewQuestion=session=>session.reviewVisit.questions[session.reviewVisit.index] || null;
export function reviewTargetEligible(store,frame,now=Date.now()) {
  if(frame.entryId.startsWith('g:'))return !!grammarLesson(frame.entryId);
  const entry=getEntry(frame.entryId);if(!entry||store.current.customDeleted?.[entry.id])return false;
  const completion=entryCompletion(entry,store.learning,store.current.items?.[entry.id],now);
  return entry.kind==='verb'?!!completion.cases.find(c=>c.id===frame.caseId)?.checked:completion.complete;
}
export function reviewAttempt(session,given,{now=Date.now(),accentStrict=false,revealed=false,audioAvailable=false}={}) {
  const v=session.reviewVisit,frame=currentReviewQuestion(session);
  if(!frame || v.phase!=='question' || v.result)return null;
  const q=frame.question,assistance=[...v.assistance,...revealed?['revealed']:[],...q.listening&&!audioAvailable?['audio-unavailable']:[]];
  let result=q.sourceStep?assessCourseAnswer(q.sourceStep,given,{accentStrict}):gradeQuestion(q,given,{accentStrict,revealed,assistance});
  if(q.type==='mc') {
    const choice=q.choices.find(c=>String(c.value ?? c.label)===String(given));
    result={...result,ok:!!choice?.correct, outcome:choice?.correct?'correct':'incorrect'};
  }
  const outcome=revealed?'revealed':result.outcome || (result.ok?'correct':'incorrect');
  const ok=outcome==='correct'&&result.ok===true;
  const submission=result.submission || compareSubmission(given,q.answer,{accentStrict,inputMode:q.type==='type'?'typed':'choice'});
  const event={...q.meta,reviewPolicy:'unified-review-v1',id:`${session.id}:answer:${v.index}`,epochId:session.epochId,
    sessionId:session.id,index:v.index,at:now,objectiveId:frame.objectiveId,entryId:frame.entryId,
    firstAttempt:true,ok,outcome,assistance,errorTags:ok?[]:result.errorTags || [result.errorTag || q.meta.skill],
    components:outcome==='ungraded'?[]:result.components || [],submission,
    xp:frame.legacyItem?0:ok?assistance.length?1:2:0,countStats:!frame.legacyItem};
  v.result={ok,outcome,given:submission.ok?submission.displayText:String(given || ''),submission,
    answer:submission.matchedAnswerText || q.answer[0],explanation:result.explanation || q.explain || '',eventId:event.id};
  if(ok)v.draft=v.result.given;
  v.answers.push({objectiveId:frame.objectiveId,rowId:frame.rowId,ok,outcome,eventId:event.id});v.phase='feedback';session.updatedAt=now;
  return {event,result:v.result,frame};
}
export function advanceReviewVisit(session,{now=Date.now()}={}) {
  const v=session.reviewVisit;if(v.phase!=='feedback')return session;
  v.index++;session.index=v.index;v.phase=v.index>=v.total?'complete':'question';
  v.result=null;v.draft='';v.assistance=[];session.updatedAt=now;return session;
}
