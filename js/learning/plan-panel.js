// Read-only plan presentation. Opening this panel never starts or completes work.
import {html,raw,icon} from '../ui.js';
import {dropdown} from '../fx.js';
const labels={grammar:'Course',course:'Session',verb:'Verb',word:'Word',workshop:'Workshop',review:'Review',session:'Session',conversation:'Conversation'};
export function planPanelHTML(plan,{showContinue=true,showSteps=true}={}){
 const next=plan.continuation || plan.steps[0];
 return html`<div class="daily-plan" data-daily-plan>
  <div class="daily-plan-head"><span class="kicker">A little every day</span><button type="button" class="chip" data-plan-budget aria-haspopup="menu" aria-expanded="false" aria-label="Study time: ${plan.minutes} minutes">${plan.minutes} min ${raw(icon('chevronDown',{size:14}))}</button></div>
  ${showSteps?raw(html`<ol class="daily-plan-steps">${raw(plan.steps.map((step,i)=>html`<li><a href="${step.href}" data-plan-step="${step.id}"><span class="daily-plan-order">${i+1}</span><span class="daily-plan-description"><span class="kicker">${labels[step.activity]||'Practice'}</span><span>${step.label.replace(/^Continue\s+/,'')}</span></span><span class="daily-plan-time">~${step.estimatedMinutes} min</span></a></li>`).join(''))}</ol>`):''}
  ${showContinue?raw(html`<a class="btn primary block" href="${next?.href || '#/course'}" data-continue data-continue-shared="${next?.id||''}">Continue</a><p class="tonight-hint" data-continue-label>${next?.label || 'Choose your next course lesson'}</p>`):''}
  ${plan.suggestedNext&&!plan.steps.some(step=>step.kind==='new')?raw(html`<a class="daily-plan-optional" href="${plan.suggestedNext.href}">Or try something new: ${plan.suggestedNext.label}</a>`):''}
  <a class="daily-plan-review" href="#/review">${raw(icon('refresh',{size:17}))}<span>${plan.dueCount?`${plan.dueCount} ${plan.dueCount===1?'item':'items'} ready for review`:'Review at your own pace'}</span>${raw(icon('chevronRight',{size:16}))}</a>
 </div>`;
}
export function openPlanBudget(button,store,onChange){
 dropdown(button,[5,10,15,20,30].map(value=>({value,label:`${value} minutes`,selected:value===(store.settings.studyMinutes||10)})),{align:'end',width:230,onSelect:value=>{store.setSetting('studyMinutes',Number(value));onChange?.();}});
}
