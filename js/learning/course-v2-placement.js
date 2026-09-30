// A conservative starting-point suggestion, never a CEFR assessment or completion award.
import { assessCourseAnswer } from './course-v2-engine.js';
export const PLACEMENT_LEVELS=['A1','A2','B1','B2','C1','C2'];
// Sample useful contrasts across a level. Do not let an incidental last unit
// (for example the literary trapassato remoto) dominate the entry suggestion.
const samples={
  A1:['v2-a1-essere-singular','v2-a1-adjective-agreement','v2-a1-read-a-message'],
  A2:['v2-a2-habit-versus-event','v2-a2-direct-reference','v2-a2-read-small-story'],
  B1:['v2-b1-story-background-event','v2-b1-che-cui','v2-b1-reporting-information'],
  B2:['v2-b2-past-subjunctive','v2-b2-passive-tenses','v2-b2-argument-links'],
};
export function placementQuestions(lessons,level) {
  const groups=lessons.filter(l=>l.level===level).flatMap(lesson=>lesson.targets.flatMap(target=>{
    if(target.modality==='listening')return [];
    const questions=lesson.steps.filter(s=>s.kind==='question'&&s.target===target.id&&s.stage==='independent'&&!s.audioId&&!s.reserve
      &&(['choice','order'].includes(s.format)||s.format==='type'&&s.strict===true));
    const unique=questions.filter((q,i)=>questions.findIndex(p=>p.contextKey===q.contextKey)===i);
    return unique.length>=2?[{lessonId:lesson.id,targetId:target.id,questions:unique.slice(0,2)}]:[];
  }));
  const selected=(samples[level]||[]).map(id=>groups.find(g=>g.lessonId===id)).filter(Boolean);
  const fallback=[0,Math.floor(groups.length/2),groups.length-1].filter((n,i,a)=>n>=0&&n<groups.length&&a.indexOf(n)===i).map(n=>groups[n]);
  const picks=selected.length===3?selected:fallback;
  // Separate the two checks of each skill with other material.
  return [0,1].flatMap(n=>picks.map(g=>({lessonId:g.lessonId,targetId:g.targetId,questionId:g.questions[n].id})));
}
export function placementRecommendation(level,answers,{stopped=false}={}) {
  const correct=answers.filter(a=>a.correct&&!a.assisted).length;
  const sufficient=answers.length>=6&&correct===answers.length;
  if(!stopped&&sufficient&&level!=='C2')return {continueAt:PLACEMENT_LEVELS[PLACEMENT_LEVELS.indexOf(level)+1]};
  return {level:level==='A1'&&correct<2?'Foundations':level,uncertain:answers.length<6,correct,total:answers.length};
}
export function assessPlacement(question,value,assisted=false) {
  return {correct:assessCourseAnswer(question,value).outcome==='correct',assisted};
}
