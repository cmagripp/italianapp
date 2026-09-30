import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLearning, mergeLearning, normalizeLearning, recordAttempt, resetLearning, skillState } from '../js/learning/model.js';
import { installGrammarCourse, grammarCourse, grammarProgress, grammarReviewSkills } from '../js/learning/grammar-course.js';
import { advanceGrammar, createGrammarSession, grammarAttempt } from '../js/learning/grammar-journey.js';
import { eligibleSkills, reviewItems } from '../js/learning/integration.js';

const pack=JSON.parse(fs.readFileSync(new URL('../data/grammar-course/C1.json',import.meta.url)));
installGrammarCourse([pack]);
const lesson=grammarCourse.byId.get('c1-subjunctive-perspective');
const objective=lesson.objectives[0];
const [q1,q2,q3,q4]=objective.questions;
const base=1_700_000_000_000;
let sequence=0;
function add(learning,session,question,{index=0,at=base,guided=false,assistance=[],reveal=false,value=question.answer}={}) {
  session.index=index;
  session.grammar.guided=guided;
  session.grammar.assistance=assistance;
  const attempt=grammarAttempt(lesson,session,question,value,{reveal});
  const event={...attempt,id:`durability:${++sequence}`,deviceId:'durability',sequence,epochId:learning.epoch.id,at};
  return recordAttempt(learning,event).learning;
}
function session(mode='lesson',at=base){return createGrammarSession(lesson,{mode,now:at});}
function state(learning,at=base){return skillState(learning,objective.id,at);}

// Assistance, reveal, and massed repeats cannot manufacture new contexts.
let repeats=createLearning(base),same=session();
for(let i=0;i<8;i++)repeats=add(repeats,same,q2,{index:i*3,at:base+i*1000});
assert.equal(state(repeats).ready,false,'Repeated wording must not complete an objective');
let supported=createLearning(base),helper=session();
supported=add(supported,helper,q2,{index:1,assistance:['hint']});
supported=add(supported,helper,q3,{index:4,reveal:true});
supported=add(supported,helper,q4,{index:7,assistance:['lookup']});
supported=add(supported,helper,q2,{index:10,assistance:['history']});
assert.equal(state(supported).ready,false,'Hints, lookups, and reveals must not count as independent recall');

// Event insertion and offline merge order may differ from session order when a
// device clock changes during a lesson. The saved session index is authoritative.
const skewed=session('lesson',base);
const skewLeft=add(createLearning(base),skewed,q2,{index:2,at:base+3_000});
const skewRight=add(createLearning(base),skewed,q4,{index:5,at:base+2_000});
const leftFirst=mergeLearning(skewLeft,skewRight);
const rightFirst=mergeLearning(skewRight,skewLeft);
assert.equal(state(leftFirst).ready,true,'Clock skew must not reverse within-session grammar evidence');
assert.deepEqual(state(leftFirst),state(rightFirst),'Offline merge order must not change grammar evidence');

// Two distinct independent contexts complete a lesson and enter review.
let learning=createLearning(base),first=session();
learning=add(learning,first,q1,{index:0,guided:true,at:base});
learning=add(learning,first,q2,{index:2,at:base+2000});
learning=add(learning,first,q4,{index:5,at:base+5000});
assert.equal(state(learning).ready,true);
assert.equal(grammarProgress(lesson,learning).complete,true);
assert(grammarReviewSkills({learning},base+5000).some(s=>s.objectiveId===objective.id),'Ready grammar must enroll in review immediately');
assert.equal(Object.keys(learning.completions).length,0,'Grammar must not mark dictionary completion');
const firstReps=state(learning).srs.reps;
const readyLearning=learning;
const fakeStore={learning:readyLearning,scope:{mode:'all'},current:{custom:{},customDeleted:{},items:{}},dueIds:()=>[]};
assert(eligibleSkills(fakeStore,base+5000).some(s=>s.objectiveId===objective.id),'Grammar enrollment must not depend on dictionary scope');
const dueItem=reviewItems(fakeStore,state(readyLearning).due+1).find(x=>x.objectiveId===objective.id);
assert.equal(dueItem?.entry.kind,'grammar','Due grammar must reach the review queue');

// A voluntary review immediately after learning is useful practice, but cannot
// establish spaced memory or push its schedule forward.
const early=session('review',base+60_000);
learning=add(learning,early,q1,{index:0,at:base+60_000,assistance:['hint']});
assert.equal(state(learning).srs.reps,firstReps,'An assisted early review must not advance the SRS interval');
assert.equal(state(learning).remembered,false,'An assisted early review must not mark remembered');

// An early mistake creates a short retry. A clean independent answer at that
// retry should clear the overdue timer without claiming eight-hour spacing.
let shortRepair=readyLearning;
const earlyFailure=session('review',base+60_000);
shortRepair=add(shortRepair,earlyFailure,q1,{index:0,at:base+60_000,value:'incorrect answer'});
const shortDue=state(shortRepair).due;
assert.equal(shortDue,base+60_000+10*60_000);
const retry=session('review',shortDue+1_000);
shortRepair=add(shortRepair,retry,q3,{index:0,at:shortDue+1_000});
assert(state(shortRepair).due>shortDue+1_000,'A clean short retry must not stay overdue');
assert.equal(state(shortRepair).remembered,false,'A short repair is not spaced mastery');

// A wrong review answer leaves historical completion and review enrollment intact.
const review=session('review',base+70_000);
learning=add(learning,review,q2,{index:0,at:base+70_000,value:'incorrect answer'});
const afterOne=state(learning);
assert.equal(afterOne.ready,true,'A review lapse must not erase completed learning');
assert(grammarReviewSkills({learning},base+70_000).some(s=>s.objectiveId===objective.id),'A lapsed objective stays enrolled');
assert.equal(afterOne.unresolvedErrors.length,1,'The review mistake needs repair');
review.grammar.result={ok:false,assisted:false,questionId:q2.id};
advanceGrammar(lesson,review,learning);
assert.equal(review.grammar.phase,'repair');
advanceGrammar(lesson,review,learning);
assert.equal(review.grammar.guided,true);
review.grammar.result={ok:true,assisted:false,questionId:q3.id};
advanceGrammar(lesson,review,learning);
assert.notEqual(review.grammar.phase,'complete','A guided repair must not complete review');
learning=add(learning,review,q3,{index:3,at:base+73_000,value:'still incorrect'});
assert.equal(state(learning).srs.lapses,afterOne.srs.lapses,'Repeated errors in one review session count as one lapse');

// Drafts survive normalization and offline merge; reset removes the old epoch.
const draft=session('lesson',base+80_000);
draft.grammar.draft='Potrebbe';draft.updatedAt=base+80_000;
const left=normalizeLearning({...learning,sessions:{'g:c1-subjunctive-perspective|lesson':draft},session:draft});
const merged=mergeLearning(left,createLearning(base));
assert.equal(merged.sessions['g:c1-subjunctive-perspective|lesson'].grammar.draft,'Potrebbe');
assert.deepEqual(mergeLearning(left,createLearning(base)),mergeLearning(createLearning(base),left));
const reviewDraft=session('review',base+85_000);
reviewDraft.grammar.phase='question';reviewDraft.grammar.draft='Avrei';
reviewDraft.grammar.history=[{phase:'teach',objectiveIndex:0,teachIndex:1}];
reviewDraft.grammar.historyCursor=0;reviewDraft.updatedAt=base+85_000;
const restored=mergeLearning(merged,normalizeLearning({...createLearning(base),sessions:{'g:c1-subjunctive-perspective|review':reviewDraft}}));
assert.equal(restored.sessions['g:c1-subjunctive-perspective|review'].grammar.draft,'Avrei');
assert.equal(restored.sessions['g:c1-subjunctive-perspective|review'].grammar.historyCursor,0);
assert.equal(restored.sessions['g:c1-subjunctive-perspective|lesson'].grammar.draft,'Potrebbe');
const reset=resetLearning(merged,base+90_000,'durability:reset');
assert.equal(Object.keys(reset.events).length,0);
assert.equal(Object.keys(reset.sessions).length,0);
assert.equal(skillState(reset,objective.id).ready,false);
const resetMerged=mergeLearning(reset,restored);
assert.equal(Object.keys(resetMerged.events).length,0,'An old backup cannot restore pre-reset events');
assert.equal(Object.keys(resetMerged.sessions).length,0,'An old backup cannot restore pre-reset drafts');
console.log('Grammar durability: repeat/assistance, clock skew, early review, lapse enrollment, repair, draft merge, and reset passed.');
