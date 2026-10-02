// Pure navigation and assessment for the authored v2 course. Persistence belongs to the caller.
import { courseSkill } from './course-v2-state.js';

const clone = value => JSON.parse(JSON.stringify(value));
const normalize = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('it')
  .replace(/[’‘]/g,"'").replace(/[.!?,;:]+$/g,'').trim().replace(/\s+/g,' ');
const targetFor=(lesson,id)=>lesson.targets.find(target=>target.id===id);
const questionFor=(lesson,id)=>lesson.steps.find(step=>step.kind==='question' && step.id===id);
const questionsFor=(lesson,id)=>lesson.steps.filter(step=>step.kind==='question' && step.target===id);
const exposureOf=step=>normalize(step.exposureGroup || step.id);
const snapshot=session=>{
  const c=session.courseV2;
  return clone({stepIndex:c.stepIndex,phase:c.phase,activeQuestionId:c.activeQuestionId,
    activeTargetId:c.activeTargetId,activeFacet:c.activeFacet,draft:c.draft,tokens:c.tokens,
    matched:c.matched,assistance:c.assistance,result:c.result,optionOrder:c.optionOrder,
    tokenOrder:c.tokenOrder,rightOrder:c.rightOrder,left:c.left,pairMessage:c.pairMessage,
    hintLevel:c.hintLevel||0,pairErrors:c.pairErrors,pairMisses:c.pairMisses||{}});
};
const clearAnswer=c=>{c.hintLevel=0;c.draft='';c.tokens=[];c.matched=[];c.assistance=[];c.result=null;
  c.optionOrder=[];c.tokenOrder=[];c.rightOrder=[];c.left=null;c.pairMessage='';c.pairErrors=0;c.pairMisses={};};
const saveHistory=session=>{const c=session.courseV2;c.history.push(snapshot(session));c.history=c.history.slice(-120);c.historyCursor=null;};
const eventsFor=(learning,lesson,targetId)=>Object.values(learning?.events || {}).filter(e=>e.policy==='grammar-v2'
  && e.entryId===`g:${lesson.id}` && e.objectiveId===targetId);
const outcomeResult=(step,answer,given,assisted)=>({outcome:answer.outcome,ok:answer.outcome==='correct',answer:answer.answer,
  given:String(Array.isArray(given)?given.join(' '):given ?? ''),assisted,
  explanation:answer.explanation || step.explanation || '',errorTag:answer.errorTag || null,questionId:step.id});

function scoredAnswer(step,value) {
  if(step.format==='match') {
    const ok=Array.isArray(value) && value.length===step.pairs?.length && value.every((v,i)=>Number(v)===i);
    return {outcome:ok?'correct':'incorrect',answer:(step.pairs || []).map(p=>p.right),explanation:step.explanation};
  }
  const response=Array.isArray(value)?value.join(' '):String(value ?? '');
  const right=[step.answer,...(step.accepted || [])].some(a=>normalize(a)===normalize(response));
  if(right)return {outcome:'correct',answer:step.answer,explanation:step.explanation};
  const known=(step.errors || []).find(error=>normalize(error.answer)===normalize(response));
  if(known)return {outcome:'incorrect',answer:step.answer,errorTag:known.tag,explanation:known.explanation};
  if(step.format==='type' && step.strict!==true)
    return {outcome:'ungraded',answer:step.answer,explanation:'This answer needs a person to check it fairly. Compare the model and continue practicing.'};
  return {outcome:'incorrect',answer:step.answer,errorTag:'unclassified',explanation:step.explanation};
}

export function assessCourseAnswer(step,value) {
  if(step?.kind==='portfolio')return {outcome:'ungraded',ok:false,answer:step.model,explanation:'Compare your work with the model and rubric.'};
  if(step?.kind!=='question')return {outcome:'ungraded',ok:false,answer:null,explanation:''};
  const result=scoredAnswer(step,value);
  return {...result,ok:result.outcome==='correct'};
}

function questionView(lesson,c) {
  const authored=c.phase==='step'?lesson.steps[c.stepIndex]:questionFor(lesson,c.activeQuestionId);
  if(!authored || authored.kind!=='question')return null;
  const guided=c.phase==='guided' || authored.stage==='guided';
  const step=guided && authored.stage!=='guided'?{...authored,stage:'guided'}:authored;
  return {kind:'question',phase:c.phase,step,target:targetFor(lesson,step.target),guided,
    index:c.stepIndex,viewOnly:false};
}

function stepView(lesson,c) {
  if(c.phase==='step') {
    const step=lesson.steps[c.stepIndex];
    if(!step)return {kind:'complete',phase:'complete',step:null,target:null};
    // Synthesised vocabulary boards belong to dictionary words, not to a grammar target.
    return {kind:step.kind,phase:'step',step,target:step.kind==='words-check'?null:targetFor(lesson,step.target),index:c.stepIndex,viewOnly:false};
  }
  if(c.phase==='guided' || c.phase==='recheck')return questionView(lesson,c);
  if(c.phase==='repair') {
    const target=targetFor(lesson,c.activeTargetId);
    return {kind:'repair',phase:'repair',step:{id:`repair:${target?.id}`,kind:'teach',
      title:target?.repair?.title || 'Review this pattern',body:target?.repair?.body || target?.explanation || '',
      examples:target?.repair?.examples || [],introduces:[target?.id]},target,viewOnly:false};
  }
  if(c.phase==='exhausted')return {kind:'exhausted',phase:'exhausted',step:null,target:targetFor(lesson,c.activeTargetId),viewOnly:false};
  if(c.phase==='paused')return {kind:'complete',phase:'paused',step:null,target:null,viewOnly:false};
  return {kind:'complete',phase:'complete',step:null,target:null,viewOnly:false};
}

export function currentCourseStep(lesson,session) {
  const c=session?.courseV2;
  if(!c)return null;
  const past=c.historyCursor===null?null:c.history[c.historyCursor];
  const view=stepView(lesson,past || c);
  return {...view,viewOnly:!!past,historyCursor:c.historyCursor,
    result:(past || c).result || null,assistance:(past || c).assistance || []};
}

function selectQuestion(lesson,c,targetId,{facet=null,stage='independent',learning=null,now=Date.now(),maxStepIndex=null}={}) {
  const candidates=questionsFor(lesson,targetId).filter(q=>(!facet || q.facet===facet)
    && (maxStepIndex===null || lesson.steps.indexOf(q)<maxStepIndex || (q.reserve===true && !!facet && q.facet===facet)));
  const proper=candidates.filter(q=>stage==='guided'?q.stage==='guided':q.stage==='independent');
  const pool=proper.length?proper:(stage==='guided'?candidates.filter(q=>q.stage==='independent'):[]);
  const used=new Set(c.usedQuestions || []),groups=new Set(c.usedGroups || []);
  if(stage==='guided') {
    // Rehearse an already taught item in this facet. Never spend a fresh transfer
    // variant merely because this facet had no separate authored guided card.
    const priorId=[...(c.usedQuestions||[])].reverse().find(id=>pool.some(q=>q.id===id));
    const supported=pool.find(q=>q.stage==='guided') || pool.find(q=>q.id===priorId)
      || pool.find(q=>!q.reserve);
    c.practiceOnlyQuestionId=null;
    return supported || null;
  }

  const history=eventsFor(learning,lesson,targetId);
  const latest=new Map();
  for(const e of history)latest.set(normalize(e.exposureGroup || e.variantId),Math.max(latest.get(normalize(e.exposureGroup || e.variantId)) || 0,e.at || 0));
  const skill=courseSkill(history,now,targetFor(lesson,targetId));
  const gap=skill.enrolled && skill.srs.lapses>0 && now>=skill.due?10*60e3:8*3600e3;
  const fresh=pool.filter(q=>!used.has(q.id) && !groups.has(exposureOf(q))
    && (!latest.has(exposureOf(q)) || now-latest.get(exposureOf(q))>=gap));
  if(fresh.length) {
    // Review rotates within the fresh bank and avoids choosing the first authored item every time.
    const shift=c.mode==='review'?Math.abs(c.seed || 0)%fresh.length:0;
    const rotated=[...fresh.slice(shift),...fresh.slice(0,shift)];
    c.practiceOnlyQuestionId=null;
    return rotated.sort((a,b)=>(latest.get(exposureOf(a)) || 0)-(latest.get(exposureOf(b)) || 0))[0];
  }
  if(stage==='guided') {
    // Supported repair may revisit a model. It never earns independent evidence.
    const old=pool.filter(q=>q.stage==='guided').sort((a,b)=>Number(used.has(a.id))-Number(used.has(b.id)))[0];
    if(old){c.practiceOnlyQuestionId=null;return old;}
  }
  if(!c.allowRecentPractice)return null;
  // An early return can offer bounded practice, visibly assisted, without granting mastery.
  const old=pool.filter(q=>!used.has(q.id) && !groups.has(exposureOf(q)))
    .sort((a,b)=>(latest.get(exposureOf(a)) || 0)-(latest.get(exposureOf(b)) || 0))[0] || null;
  c.practiceOnlyQuestionId=old?.id || null;
  return old;
}

function setQuestion(c,q,phase,targetId) {
  c.phase=phase;c.activeQuestionId=q.id;c.activeTargetId=targetId;c.activeFacet=q.facet;
  clearAnswer(c);
  if(c.practiceOnlyQuestionId===q.id)c.assistance.push('recent-repeat');
}

function missingTarget(lesson,session,learning) {
  const c=session.courseV2;
  for(const target of lesson.targets) {
    if(c.deferred.includes(target.id))continue;
    const skill=courseSkill(eventsFor(learning,lesson,target.id),Date.now(),target);
    if(!skill.ready) {
      const facet=target.facets.find(f=>!skill.facetEvidence[f] || skill.unresolvedErrors.some(e=>e.facet===f)) || null;
      return {target,facet};
    }
  }
  return null;
}

function atEnd(lesson,session,learning) {
  const c=session.courseV2;
  const missing=missingTarget(lesson,session,learning);
  if(!missing){c.phase=c.deferred.length?'paused':'complete';c.activeTargetId=null;return;}
  const q=selectQuestion(lesson,c,missing.target.id,{facet:missing.facet,stage:'independent',learning});
  if(q)setQuestion(c,q,'recheck',missing.target.id);
  else {c.phase='exhausted';c.activeTargetId=missing.target.id;c.activeFacet=missing.facet;clearAnswer(c);}
}

function nextMainStep(lesson,session,learning) {
  const c=session.courseV2;
  c.stepIndex++;
  while(c.stepIndex<lesson.steps.length && (lesson.steps[c.stepIndex].reserve===true
    || (lesson.steps[c.stepIndex].kind==='question' && (c.usedQuestions.includes(lesson.steps[c.stepIndex].id)
      || c.deferred.includes(lesson.steps[c.stepIndex].target)))))c.stepIndex++;
  if(c.stepIndex>=lesson.steps.length)atEnd(lesson,session,learning);
  else {c.phase='step';c.activeQuestionId=null;c.activeTargetId=null;clearAnswer(c);}
}

export function createCourseSession(lesson,{mode='lesson',objective=null,now=Date.now(),learning=null}={}) {
  const id=`course-v2:${now}:${Math.random().toString(36).slice(2)}`;
  const c={version:2,planVersion:3,stepIndex:0,phase:'step',history:[],historyCursor:null,
    draft:'',tokens:[],matched:[],assistance:[],result:null,portfolios:{},
    usedQuestions:[],usedGroups:[],completedStepIds:[],deferred:[],repairCount:{},activeQuestionId:null,activeTargetId:null,
    activeFacet:null,returnStepIndex:null,audioPlayed:[],transcripts:[],paused:false,
    mode,seed:Math.floor(now/60000),allowRecentPractice:mode==='review',practiceOnlyQuestionId:null};
  const session={id,entryId:`g:${lesson.id}`,mode,objectiveIds:lesson.targets.map(t=>t.id),
    index:0,createdAt:now,updatedAt:now,courseV2:c};
  if(mode==='review') {
    const target=targetFor(lesson,objective) || lesson.targets[0];
    c.activeTargetId=target?.id || null;
    if(target){const q=selectQuestion(lesson,c,target.id,{stage:'independent',learning,now});
      if(q)setQuestion(c,q,'recheck',target.id);else c.phase='exhausted';}
    else c.phase='complete';
  }
  return session;
}

export function compatibleCourseSession(lesson,session) {
  const c=session?.courseV2;
  const valid=(s,history=false)=>!!s && Number.isInteger(s.stepIndex) && s.stepIndex>=0 && s.stepIndex<=lesson.steps.length
    && ['step','repair','guided','recheck','exhausted','paused','complete'].includes(s.phase)
    && typeof s.draft==='string' && ['tokens','matched','assistance',...(history?[]:['usedQuestions','usedGroups','deferred','audioPlayed','transcripts'])].every(k=>Array.isArray(s[k]))
    && (!['guided','recheck'].includes(s.phase) || !!questionFor(lesson,s.activeQuestionId));
  return session?.entryId===`g:${lesson.id}` && Array.isArray(session.objectiveIds)
    && session.objectiveIds.length===lesson.targets.length && session.objectiveIds.every((id,i)=>id===lesson.targets[i].id)
    && c?.version===2 && c.planVersion===3 && valid(c) && Array.isArray(c.history) && c.history.every(s=>valid(s,true))
    && (c.historyCursor===null || Number.isInteger(c.historyCursor)&&c.historyCursor>=0&&c.historyCursor<c.history.length);
}

export function markCourseAssistance(lesson,session,{kind,token=null}={}) {
  const c=session.courseV2,view=currentCourseStep(lesson,session);
  if(view?.kind!=='question' || view.viewOnly)return session;
  if(kind==='lookup' && !['reading','listening'].includes(view.target?.modality)) {
    const answers=[view.step.answer,...(view.step.accepted || []),...(view.step.supportTokens || [])].map(normalize);
    if(!token || !answers.some(a=>a===normalize(token) || a.split(' ').includes(normalize(token))))return session;
  }
  if(kind && !c.assistance.includes(kind))c.assistance.push(kind);
  return session;
}

export function courseBack(lesson,session) {
  const c=session.courseV2;
  if(!c.history.length)return session;
  const next=c.historyCursor===null?c.history.length-1:Math.max(0,c.historyCursor-1);
  const prior=c.history[next];
  const live=stepView(lesson,c);
  const seen=lesson.steps[prior.stepIndex];
  const oldTargets=[prior.activeTargetId,seen?.target,...(seen?.introduces || [])];
  if(live?.kind==='question' && oldTargets.includes(live.target?.id))
    markCourseAssistance(lesson,session,{kind:'history'});
  c.historyCursor=next;
  return session;
}

export function courseReturnLive(_lesson,session) {session.courseV2.historyCursor=null;return session;}

export function submitCourseAnswer(lesson,session,value,{reveal=false,now=Date.now(),audioAvailable=false,learning=null}={}) {
  const c=session.courseV2,view=currentCourseStep(lesson,session);
  if(view?.viewOnly || c.result)return {session,result:c.result || null};
  if(view?.kind==='portfolio') {
    const record=c.portfolios[view.step.id] || {};
    c.portfolios[view.step.id]={...record,draft:String(value ?? record.draft ?? '')};
    c.result={outcome:'ungraded',ok:false,answer:view.step.model,explanation:'Compare your work with the model and rubric.'};
    session.updatedAt=now;
    return {session,result:c.result};
  }
  if(view?.kind!=='question')return {session,result:null};
  const step=view.step,target=view.target;
  const assessed=reveal?{outcome:'revealed',ok:false,answer:step.answer,explanation:step.explanation}:assessCourseAnswer(step,value);
  const recentRepeat=c.phase==='step'&&step.stage==='independent'&&eventsFor(learning,lesson,target.id)
    .some(e=>e.sessionId!==session.id&&normalize(e.exposureGroup||e.variantId)===exposureOf(step)&&now-Number(e.at||0)<8*3600e3);
  const assistance=[...new Set([...c.assistance,...(reveal?['reveal']:[]),
    ...(recentRepeat?['recent-repeat']:[]),
    ...((target.modality==='listening' || step.modality==='listening') && (!audioAvailable || c.transcripts.includes(step.audioId))?['transcript-or-audio-unavailable']:[])])];
  const grammarPhase=step.stage==='guided' || c.phase==='guided'?'guided':'independent';
  const index=session.index;
  const event={id:`${session.id}:v2:${index}:${step.id}`,entryId:session.entryId,kind:'grammar',policy:'grammar-v2',
    contentVersion:2,objectiveId:target.id,sessionId:session.id,index,at:now,
    skill:step.facet,variantId:step.id,contextId:normalize(step.contextKey || step.speak || step.context || step.prompt),
    exposureGroup:step.exposureGroup || step.id,facet:step.facet,requiredFacets:[...target.facets],
    minIndependent:target.minIndependent,requiresProduction:target.requiresProduction===true,
    modality:target.modality,mode:step.format==='type'?'production':'recognition',
    responseMode:step.format==='type'?'production':'recognition',grammarPhase,
    assistance,firstAttempt:!c.pairErrors,outcome:assessed.outcome,ok:assessed.outcome==='correct',
    errorTags:assessed.errorTag?[assessed.errorTag]:[],xp:assessed.outcome==='correct' && grammarPhase==='independent' && !assistance.length?2:0};
  c.result=outcomeResult(step,assessed,value,grammarPhase!=='independent' || assistance.length>0 || !!c.pairErrors);
  c.usedQuestions=[...new Set([...c.usedQuestions,step.id])];
  c.usedGroups=[...new Set([...c.usedGroups,exposureOf(step)])];
  session.updatedAt=now;
  return {session,event,result:c.result};
}

// A wrong matching pair is a graded misconception, while the rest of the task stays open.
export function recordCoursePairMismatch(lesson,session,{left,right,now=Date.now()}={}) {
  const c=session.courseV2,view=currentCourseStep(lesson,session);
  if(view?.viewOnly || view?.kind!=='question' || view.step.format!=='match' || c.result)return {session,event:null};
  if(!Number.isInteger(left) || !Number.isInteger(right) || left===right)return {session,event:null};
  c.pairErrors=(c.pairErrors || 0)+1;
  if(!c.assistance.includes('matching-retry'))c.assistance.push('matching-retry');
  const step=view.step,target=view.target;
  const event={id:`${session.id}:v2:${session.index}:${step.id}:pair:${c.pairErrors}`,
    entryId:session.entryId,kind:'grammar',policy:'grammar-v2',contentVersion:2,
    objectiveId:target.id,sessionId:session.id,index:session.index,at:now,skill:step.facet,
    variantId:step.id,contextId:normalize(step.contextKey || step.prompt),exposureGroup:step.exposureGroup || step.id,
    facet:step.facet,requiredFacets:[...target.facets],minIndependent:target.minIndependent,
    requiresProduction:target.requiresProduction===true,modality:target.modality,
    mode:'recognition',responseMode:'recognition',grammarPhase:step.stage==='guided' || c.phase==='guided'?'guided':'independent',
    assistance:['matching-retry'],firstAttempt:c.pairErrors===1,outcome:'incorrect',ok:false,
    errorTags:['matching-mismatch'],xp:0};
  session.updatedAt=now;
  return {session,event};
}

// A synthesised vocabulary board grades each row as supported recognition of a
// dictionary word. Question boards keep their grammar path and return nothing.
export function recordCoursePairMatch(lesson,session,{left,right,now=Date.now()}={}) {
  const c=session.courseV2,view=currentCourseStep(lesson,session),none={session,events:[],complete:false};
  if(view?.viewOnly || view?.kind!=='words-check' || c.result)return none;
  const step=view.step,pairs=step.pairs || [];
  if(!Number.isInteger(left) || !Number.isInteger(right) || !pairs[left] || !pairs[right]
    || c.matched.includes(left) || c.matched.includes(right))return none;
  const ok=left===right,pair=pairs[left],firstAttempt=!c.pairMisses?.[left];
  c.left=null;
  if(ok){c.matched=[...c.matched,left];c.pairMessage='';}
  else {
    c.pairErrors=(c.pairErrors || 0)+1;
    c.pairMisses={...(c.pairMisses || {}),[left]:(c.pairMisses?.[left] || 0)+1};
    c.pairMessage=step.hint || 'Look at the meanings and try another pair.';
  }
  const event={id:`${session.id}:v2:${session.index}:${step.id}:${pair.entryId}:${pair.skill}${ok?'':':miss:'+c.pairErrors}`,
    sessionId:session.id,index:session.index,at:now,
    policy:'journey-v1',wordPolicy:'word-lesson-match-v1',courseLessonId:lesson.id,wordSlotId:`${step.id}:${pair.skill}`,
    entryId:pair.entryId,kind:'word',objectiveId:pair.objectiveId,targetId:pair.objectiveId,contentVersion:pair.contentVersion,
    chapterId:pair.skill==='meaning' || pair.skill==='recall'?'meaning':'forms',skill:pair.skill,role:null,
    activityKind:'guided',mode:'recognition',variantId:step.id,contextId:lesson.id,
    ok,outcome:ok?'correct':'incorrect',assistance:['matching'],firstAttempt,
    errorTags:ok?[]:['matching-mismatch'],components:[],xp:0,countStats:false};
  const complete=ok && c.matched.length===pairs.length;
  if(complete) {
    const ids=[...new Set(pairs.map(p=>p.entryId))];
    const missed=ids.filter(id=>pairs.some((p,i)=>p.entryId===id && c.pairMisses?.[i]));
    c.result={outcome:'ungraded',ok:true,board:step.board,credited:ids.filter(id=>!missed.includes(id)),missed};
  }
  session.updatedAt=now;
  return {session,events:[event],complete};
}

export function courseSessionProgress(lesson,session,learning,now=Date.now()) {
  const targets=lesson.targets.map(target=>({...courseSkill(eventsFor(learning,lesson,target.id),now,target),target,label:target.label}));
  const ready=targets.filter(s=>s.ready).length;
  return {targets,ready,total:targets.length,deferred:[...session.courseV2.deferred],
    complete:session.courseV2.phase==='complete' && ready===targets.length && !session.courseV2.deferred.length,
    phase:session.courseV2.phase,stepIndex:session.courseV2.stepIndex,
    percent:session.courseV2.phase==='complete'?100:Math.min(99,Math.round(100*session.courseV2.stepIndex/Math.max(1,lesson.steps.length)))};
}

function resumeMainAfterRepair(lesson,session,learning) {
  const c=session.courseV2;
  c.stepIndex=c.returnStepIndex ?? c.stepIndex+1;c.returnStepIndex=null;
  while(c.stepIndex<lesson.steps.length && (lesson.steps[c.stepIndex].reserve===true
    || (lesson.steps[c.stepIndex].kind==='question' && (c.usedQuestions.includes(lesson.steps[c.stepIndex].id)
      || c.deferred.includes(lesson.steps[c.stepIndex].target)))))c.stepIndex++;
  if(c.stepIndex>=lesson.steps.length)atEnd(lesson,session,learning);
  else {c.phase='step';c.activeQuestionId=null;c.activeTargetId=null;clearAnswer(c);}
}

export function advanceCourse(lesson,session,learning) {
  const c=session.courseV2;
  if(c.historyCursor!==null || ['complete','paused','exhausted'].includes(c.phase))return session;
  const view=currentCourseStep(lesson,session);
  if((view.kind==='question' || view.kind==='words-check') && !c.result)return session;
  if(c.phase==='step' && view.step?.id)c.completedStepIds=[...new Set([...(c.completedStepIds || []),view.step.id])];
  saveHistory(session);
  session.index++;
  session.updatedAt=Date.now();
  if(c.phase==='repair') {
    const maxStepIndex=c.returnStepIndex===null?null:c.returnStepIndex;
    const q=selectQuestion(lesson,c,c.activeTargetId,{facet:c.activeFacet,stage:'guided',learning,maxStepIndex});
    if(q)setQuestion(c,q,'guided',c.activeTargetId);
    else {const next=selectQuestion(lesson,c,c.activeTargetId,{facet:c.activeFacet,stage:'independent',learning,maxStepIndex});
      if(next)setQuestion(c,next,'recheck',c.activeTargetId);
      else if(c.returnStepIndex!==null)resumeMainAfterRepair(lesson,session,learning);
      else {c.phase='exhausted';clearAnswer(c);}}
    return session;
  }
  if(c.phase==='guided') {
    const q=selectQuestion(lesson,c,c.activeTargetId,{facet:c.activeFacet,stage:'independent',learning,
      maxStepIndex:c.returnStepIndex===null?null:c.returnStepIndex});
    if(q)setQuestion(c,q,'recheck',c.activeTargetId);
    else if(c.returnStepIndex!==null)resumeMainAfterRepair(lesson,session,learning);
    else {c.phase='exhausted';clearAnswer(c);}
    return session;
  }
  if(c.phase==='recheck') {
    const wasOkay=c.result?.outcome==='correct' && !c.result?.assisted;
    if(session.mode==='review' && wasOkay){
      const target=targetFor(lesson,c.activeTargetId),skill=courseSkill(eventsFor(learning,lesson,target.id),Date.now(),target);
      if(skill.ready){c.phase='complete';clearAnswer(c);return session;}
      const next=selectQuestion(lesson,c,target.id,{facet:c.activeFacet,learning});
      if(next)setQuestion(c,next,'recheck',target.id);else{c.phase='exhausted';clearAnswer(c);}
      return session;
    }
    if(session.mode==='review' && !wasOkay){c.phase='repair';clearAnswer(c);return session;}
    if(c.returnStepIndex!==null){resumeMainAfterRepair(lesson,session,learning);return session;}
    atEnd(lesson,session,learning);return session;
  }
  if(c.phase==='step') {
    const failed=view.kind==='question' && c.result?.outcome!=='correct';
    const assisted=view.kind==='question' && c.assistance.length>0;
    if(failed || assisted) {
      c.returnStepIndex=c.stepIndex+1;c.activeTargetId=view.target.id;c.activeFacet=view.step.facet;
      c.phase='repair';clearAnswer(c);return session;
    }
    nextMainStep(lesson,session,learning);
  }
  return session;
}

export function deferCourseTarget(lesson,session,learning=null) {
  const c=session.courseV2;
  const targetId=c.activeTargetId || currentCourseStep(lesson,session)?.target?.id;
  if(!targetId || !targetFor(lesson,targetId))return session;
  saveHistory(session);
  c.deferred=[...new Set([...c.deferred,targetId])];
  const returnIndex=c.returnStepIndex;
  c.returnStepIndex=null;c.activeQuestionId=null;clearAnswer(c);session.index++;
  if(session.mode==='review'){c.phase='paused';return session;}
  c.stepIndex=returnIndex ?? c.stepIndex+1;
  while(c.stepIndex<lesson.steps.length && (lesson.steps[c.stepIndex].reserve===true
    || (lesson.steps[c.stepIndex].kind==='question' && c.deferred.includes(lesson.steps[c.stepIndex].target))))c.stepIndex++;
  if(c.stepIndex<lesson.steps.length)c.phase='step';
  else atEnd(lesson,session,learning);
  return session;
}

export function resumeCourseTargets(lesson,prior,learning,{now=Date.now()}={}) {
  const session=createCourseSession(lesson,{mode:'lesson',now,learning});
  const c=session.courseV2,old=prior?.courseV2 || {};
  c.portfolios=clone(old.portfolios || {});
  c.completedStepIds=[...(old.completedStepIds || [])];
  c.audioPlayed=[];
  c.transcripts=[];
  c.flags=clone(old.flags || []);
  c.stepIndex=lesson.steps.length;
  c.allowRecentPractice=true;
  atEnd(lesson,session,learning);
  return session;
}
