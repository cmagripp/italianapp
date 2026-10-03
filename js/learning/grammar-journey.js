import { grammarSkill } from './grammar-state.js';
import { compareSubmission } from './answer-policy.js';

export const normalizeGrammarAnswer=value=>String(value || '').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g,"'").replace(/[.!?,;:]+$/g,'').trim().replace(/\s+/g,' ');
export function compatibleGrammarSession(lesson,session) {
  const g=session?.grammar;
  if(!g || g.version!==1 || g.contentVersion!==lesson.contentVersion || session.entryId!==`g:${lesson.id}` || !Array.isArray(session.objectiveIds))return false;
  const frame=state=>state && Number.isInteger(state.objectiveIndex) && !!lesson.objectives[state.objectiveIndex]
    && ['teach','question','repair','complete'].includes(state.phase) && Number.isInteger(state.teachIndex) && state.teachIndex>=0
    && state.teachIndex<lesson.objectives[state.objectiveIndex].teach.length && Number.isInteger(state.questionIndex) && state.questionIndex>=0
    && ['draft'].every(key=>typeof state[key]==='string') && ['tokens','matched','assistance'].every(key=>Array.isArray(state[key]));
  return frame(g) && Array.isArray(g.history) && g.history.every(frame)
    && (g.historyCursor===null || Number.isInteger(g.historyCursor)&&g.historyCursor>=0&&g.historyCursor<g.history.length);
}
export function assessGrammarAnswer(question,value,policy={}) {
  if(question.format==='match')return {ok:Array.isArray(value) && value.length===question.pairs.length && value.every((right,left)=>right===left)};
  return compareSubmission(value,[question.answer,...question.accepted || []],{...policy,inputMode:question.format==='type'?'typed':'choice'});
}
export function checkGrammarAnswer(question,value,policy={}) {
  return assessGrammarAnswer(question,value,policy).ok;
}
export function createGrammarSession(lesson,{mode='lesson',objective=null,now=Date.now()}={}) {
  const focused=lesson.objectives.findIndex(o=>o.id===objective);
  return {id:`grammar:${now}:${Math.random().toString(36).slice(2)}`,entryId:`g:${lesson.id}`,mode,objectiveIds:lesson.objectives.map(o=>o.id),
    index:0,createdAt:now,updatedAt:now,grammar:{version:1,contentVersion:lesson.contentVersion,objectiveIndex:Math.max(0,focused),
      phase:mode==='review'?'question':'teach',teachIndex:0,questionIndex:0,questionId:null,guided:mode!=='review',
      history:[],historyCursor:null,reviewed:[],draft:'',tokens:[],matched:[],assistance:[],result:null,paused:false}};
}
export function grammarObjective(lesson,session) { return lesson.objectives[session.grammar.objectiveIndex]; }
export function currentGrammarQuestion(lesson,session) {
  const objective=grammarObjective(lesson,session), g=session.grammar;
  return objective?.questions.find(q=>q.id===g.questionId) || objective?.questions[g.questionIndex%objective.questions.length];
}
export function grammarSnapshot(session) {
  const {history,historyCursor,...state}=session.grammar;
  return JSON.parse(JSON.stringify(state));
}
function resetAnswer(g) {g.draft='';g.tokens=[];g.matched=[];g.assistance=[];g.result=null;g.questionId=null;g.left=null;g.pairErrors=0;}
export function advanceGrammar(lesson,session,learning) {
  const g=session.grammar, objective=grammarObjective(lesson,session);
  g.history.push(grammarSnapshot(session));g.history=g.history.slice(-100);g.historyCursor=null;session.index++;
  if(g.phase==='teach') {
    if(g.teachIndex===0){g.phase='question';g.guided=true;}
    else if(g.teachIndex<objective.teach.length-1)g.teachIndex++;
    else {g.phase='question';g.guided=false;}
    resetAnswer(g);return session;
  }
  if(g.phase==='repair') {g.phase='question';g.guided=true;resetAnswer(g);return session;}
  if(g.phase!=='question' || !g.result)return session;
  const result=g.result, wasGuided=g.guided;
  g.questionIndex++;resetAnswer(g);
  if(session.mode==='review' && result.ok && !result.assisted && !wasGuided) {
    g.reviewed.push(objective.id);g.phase='complete';return session;
  }
  if(!result.ok){g.phase='repair';g.repairQuestion=result.questionId;return session;}
  const state=grammarSkill(Object.values(learning.events || {}).filter(e=>e.sessionId===session.id&&e.objectiveId===objective.id).sort((a,b)=>a.index-b.index||a.at-b.at));
  if(session.mode!=='review' && state.ready) {
    const next=lesson.objectives.findIndex((o,i)=>i>g.objectiveIndex);
    if(next<0){g.phase='complete';return session;}
    g.objectiveIndex=next;g.phase='teach';g.teachIndex=0;g.questionIndex=0;g.guided=true;return session;
  }
  if(wasGuided && g.teachIndex===0 && objective.teach.length>1) {g.phase='teach';g.teachIndex=1;}
  else {g.phase='question';g.guided=false;}
  return session;
}
export function grammarAttempt(lesson,session,question,value,{reveal=false,accentStrict=false}={}) {
  const g=session.grammar, objective=grammarObjective(lesson,session);
  const assistance=[...g.assistance,...reveal?['reveal']:[],...g.pairErrors?['pair-correction']:[]];
  const submission=assessGrammarAnswer(question,value,{accentStrict});
  const ok=!reveal && submission.ok;
  return {entryId:session.entryId,kind:'grammar',policy:'grammar-v1',contentVersion:lesson.contentVersion,
    objectiveId:objective.id,sessionId:session.id,index:session.index,skill:objective.errorTag,
    variantId:question.id,contextId:normalizeGrammarAnswer(question.speak || question.context || (question.pairs || []).map(p=>p.left+' '+p.right).join(' ') || question.translation || question.prompt),mode:question.format==='type'?'production':'recognition',
    grammarPhase:g.guided||question.guided?'guided':'independent',firstAttempt:true,assistance,
    ...(submission.policyVersion?{submission}:{}),ok,outcome:reveal?'revealed':ok?'correct':'incorrect',errorTags:ok?[]:[question.errorTag || objective.errorTag],
    xp:ok&&!assistance.length?2:0};
}
