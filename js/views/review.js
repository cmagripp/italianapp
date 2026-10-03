// Grouped learned targets enter finite visits, with exact draft/feedback recovery.
import { html, raw, esc, speak, speakBtn, stopSpeech, toast, announceAnswer } from '../ui.js';
import { setTitle, setChrome } from '../app.js';
import { store } from '../store.js';
import { setScene } from '../fx.js';
import { reviewItems, familiarReviewItems } from '../learning/integration.js';
import { loadGrammarLesson } from '../learning/grammar-course.js';
import { loadCourseAudio,courseAudioAsset } from '../learning/course-v2-media.js';
import { gameTop, typedInputHTML, bindAccentBar, feedbackHTML } from '../games/engine.js';
import { mountActivityViewport } from '../learning/activity-viewport.js';
import { createReviewVisit, compatibleReviewVisit, currentReviewQuestion, reviewTargetEligible, reviewAttempt, advanceReviewVisit } from '../learning/review-session.js';

const clone=x=>JSON.parse(JSON.stringify(x));
function safeHTML(source) {
  const template=document.createElement('template');template.innerHTML=String(source || '');
  for(const node of [...template.content.querySelectorAll('*')].reverse()) {
    if(!['DIV','SPAN','P','STRONG','EM','B','I','BR','SUP','SUB'].includes(node.tagName)){node.replaceWith(document.createTextNode(node.textContent || ''));continue;}
    const classes=(node.getAttribute('class') || '').split(/\s+/).filter(c=>/^[a-z][a-z0-9_-]{0,40}$/i.test(c));
    for(const attr of [...node.attributes])node.removeAttribute(attr.name);if(classes.length)node.className=classes.join(' ');
  }
  return template.innerHTML;
}
function savedVisit(query={}) {
  const sessions=Object.values(store.learning.sessions || {}).filter(s=>compatibleReviewVisit(s,store));
  if(query.session)return sessions.find(s=>s.id===query.session) || null;
  return sessions.filter(s=>s.reviewVisit.phase!=='complete' && (!query.target || s.reviewVisit.questions.every(q=>q.rowId===query.target))
    &&(query.typed!=='1'||s.reviewVisit.questions.every(q=>q.question.type==='type'))
    &&(!query.objective||s.reviewVisit.questions.every(q=>q.objectiveId===query.objective)))
    .sort((a,b)=>b.updatedAt-a.updatedAt || a.id.localeCompare(b.id))[0] || null;
}
function listRows(query={}) {
  const due=reviewItems(store),items=query.mode==='extra'?familiarReviewItems(store):due;
  return {due,items:query.target?items.filter(row=>row.id===query.target):items};
}
function renderQueue(root,query={}) {
  const {due,items}=listRows(query),resume=savedVisit(query),limit=store.settings.dailyReviews || 40;
  const start=new URLSearchParams({start:'1'});if(query.mode==='extra')start.set('mode','extra');
  root.innerHTML=html`<div class="course-page" data-review-queue><header><div class="kicker">Ripasso</div><h1 class="display">${due.length?'Bring it back to mind.':'A little practice for later.'}</h1><p>A short mixed visit to familiar words, completed verb cases and grammar. Each visit ends after a few checks.</p></header>
    ${resume?raw(html`<a class="btn primary" data-review-resume href="#/review?start=1&session=${encodeURIComponent(resume.id)}">Continue your saved review · ${resume.reviewVisit.index} / ${resume.reviewVisit.total}</a>`):''}
    ${items.length?raw(html`<a class="btn ${resume?'secondary':'primary'}" data-review-start href="#/review?${start}">${query.mode==='extra'?'Practise ahead':'Start a short mixed review'}</a><p class="small muted">${due.length} ${due.length===1?'target is':'targets are'} due. Remaining work stays here for another visit.</p><ul class="course-skills">${raw(items.slice(0,limit).map(row=>html`<li data-review-row="${row.id}"><div><strong>${row.label}</strong><span>${row.targets.length} ${row.targets.length===1?'check':'checks'} ${row.targets.some(t=>t.enrolled)?'· gentle review':'ready to revisit'}</span><small>${row.contentUnavailable?'Earlier difficulty kept · open its reference':row.outOfScope?'From your earlier learning · outside today’s study scope':row.targets.some(t=>t.unresolvedErrors?.length)?'A focused check on a recent difficulty':'Meaning, forms and use'}</small></div><a class="btn sm secondary" href="${row.href}">${row.contentUnavailable?'Reference':'Review'}</a></li>`).join(''))}</ul>`):raw('<p>There is nothing due yet. Your completed learning will return here for a gentle check.</p>')}
    ${!items.length&&familiarReviewItems(store).length?raw('<a class="btn secondary" href="#/review?mode=extra">Practise something familiar</a>'):''}<a class="btn secondary" href="#/course">Your learning path</a><a href="#/learn">Back to Learn</a></div>`;
}

export async function render(root,_params={},query={}) {
  const owner=store.current.id,learner=store.current.learnerId,epoch=store.learning.epoch.id;let route=location.hash;
  let disposed=false,locked=false,session=null;
  const alive=()=>!disposed&&store.current.id===owner&&store.current.learnerId===learner&&store.learning.epoch.id===epoch&&location.hash===route;
  setTitle('Review');setScene(store.settings.level || 'A1');
  const start=query.start==='1' || !!query.session || !!query.target || query.typed==='1' || store.settings.adaptiveLearning===false;
  if(!start){renderQueue(root,query);return;}
  const prior=query.fresh==='1'?null:savedVisit(query);
  if(query.session&&!prior){root.innerHTML=html`<div class="empty"><h1>This saved review needs attention.</h1><p>Your earlier draft and answers are kept. You can export them from Me or begin another compatible review.</p><a class="btn primary" href="#/review">Back to Review</a></div>`;return;}
  if(prior)session=clone(prior);
  else {
    let {items}=listRows(query);
    if(!items.length && (query.mode==='extra'||query.objective||query.target))items=familiarReviewItems(store).filter(row=>!query.target||row.id===query.target);
    const cap=Math.max(1,Math.min(10,Math.floor((Number(query.minutes)||4)*2)));
    const grammarIds=[...new Set(items.slice(0,cap).filter(row=>row.entry.kind==='grammar').map(row=>row.entry.id))];
    try{await Promise.all(grammarIds.map(id=>loadGrammarLesson(id)));}catch(error){if(alive())root.innerHTML=html`<div class="empty"><h1>Your review is saved.</h1><p>${error.message}</p><a class="btn primary" href="#/review">Back to Review</a></div>`;return;}
    if(!alive())return;
    ({items}=listRows(query));
    if(!items.length && (query.mode==='extra'||query.objective||query.target))items=familiarReviewItems(store).filter(row=>!query.target||row.id===query.target);
    session=createReviewVisit(store,items,{minutes:Number(query.minutes)||4,objective:query.objective || null,typed:query.typed==='1'});
    if(!session.reviewVisit.total){renderQueue(root,query);return;}
  }
  if(!alive())return;
  if(session.reviewVisit.questions.some(frame=>frame.question.listening)) {
    const manifest=await loadCourseAudio();if(!alive())return;
    for(const frame of session.reviewVisit.questions){const q=frame.question;if(!q.listening)continue;const asset=courseAudioAsset(manifest,q.audioId);
      // Imported snapshots cannot bless a remote source or a newly re-authored
      // clip. Keep the frozen question only when its complete source still matches.
      q.audioAsset=null;
      if(asset&&/^audio\/course-v2\/[a-z0-9_./-]+\.m4a$/i.test(asset.src)&&!asset.src.split('/').includes('..')&&asset.spokenText?.trim()===q.say.trim())
        q.audioAsset={src:asset.src,reviewed:asset.reviewed===true,id:asset.id};}
  }
  const resumeQuery=new URLSearchParams(query);resumeQuery.delete('fresh');resumeQuery.set('start','1');resumeQuery.set('session',session.id);
  history.replaceState(null,'',location.pathname+location.search+'#/review?'+resumeQuery);route=location.hash;
  setChrome({tabs:false,back:true});root.dataset.practiceGame='review';
  const viewport=mountActivityViewport(root,{kind:'practice',panelSelector:'.drill-main'});
  const save=()=>{if(!alive())return;session.updatedAt=Date.now();store.saveLearningSession(session);};
  const durable=async()=>{save();try{await store.saveNow();}catch{if(alive())toast('Your latest review is waiting to save. Keep this tab open or export your progress.');}};

  function draw() {
    if(!alive())return;
    const v=session.reviewVisit,frame=currentReviewQuestion(session),q=frame?.question;
    if(frame && v.phase==='question' && !reviewTargetEligible(store,frame)) {
      v.result={ok:false,outcome:'skipped',given:'',answer:'',explanation:'This target was unmarked. Your earlier evidence is kept; it is left out of ordinary review.'};
      v.phase='feedback';v.answers.push({objectiveId:frame.objectiveId,rowId:frame.rowId,ok:false,outcome:'skipped'});save();
    }
    root.innerHTML=html`<div class="review-strip glass-flat" data-review-strip><span class="kicker">Short review</span><span class="due"><b>${v.index+Number(v.phase==='feedback')}</b> / ${v.total} checks</span><button type="button" class="btn ghost sm" data-review-pause>${v.paused?'Resume':'Pause'}</button></div><div class="practice-host" data-runner></div>`;
    const runner=root.querySelector('[data-runner]');
    if(v.paused)runner.innerHTML=html`<div class="empty"><h1>Your place is saved.</h1><p>Return to this exact question, draft and feedback whenever you like.</p><button type="button" class="btn primary" data-review-resume>Resume review</button><a class="btn secondary" href="#/learn">Back to Learn</a></div>`;
    else if(v.phase==='complete') {
      const correct=v.answers.filter(a=>a.ok).length,missed=[...new Set(v.answers.filter(a=>['incorrect','revealed'].includes(a.outcome)).map(a=>a.rowId))];
      runner.innerHTML=html`<div class="empty" data-review-complete><span class="kicker">A good stopping point</span><h1>Your short review is finished.</h1><p>${correct} of ${v.total} checks answered correctly. Your real answers and schedules are saved.</p>${missed.length?raw(html`<a class="btn secondary" href="#/review?start=1&target=${encodeURIComponent(missed[0])}&fresh=1">A little more practice</a>`):''}<a class="btn primary" href="#/learn">Continue learning</a><a class="btn secondary" href="#/review?fresh=1">Review list</a><a class="btn ghost" href="#/review?start=1&fresh=1">Another short visit</a></div>`;
    } else {
      const feedback=v.phase==='feedback',r=v.result,skipped=feedback&&r.outcome==='skipped';
      const answers=skipped?'':q.type==='mc'?html`<div class="choices ${q.choices.length===2?'two':''}">${raw(q.choices.map((c,i)=>html`<button type="button" class="choice ${feedback?c.correct?'correct':String(c.value ?? c.label)===r.given?'wrong':'dim':''}" data-choice="${i}" ${feedback?raw('disabled'):''}><span class="choice-label">${c.label}</span></button>`).join(''))}</div>`:html`<div class="typed">${raw(typedInputHTML({value:v.draft,language:q.meta.answerLanguage}))}<button type="button" class="btn ghost block" data-skip>I don’t know</button></div>`;
      const audio=skipped?'':q.listening&&q.audioAsset?html`<div class="course-audio"><audio controls preload="none" src="${q.audioAsset.src}" data-review-audio aria-label="Listen to the complete Italian source"></audio></div>`:q.say?html`<div class="q-say">${raw(speakBtn(q.say))}</div>`:'';
      runner.innerHTML=html`<section class="drill-shell" data-drill data-state="${feedback?'feedback':'question'}" data-question-type="${q.type}">${raw(gameTop('#/review',{i:v.index,total:v.total,completed:v.answers.length}))}<div class="drill-main" data-drill-main><div class="q-card"><div class="prompt">${frame.label}</div>${skipped?'':raw(safeHTML(q.prompt))}${raw(audio)}</div><div class="drill-answer-area" data-drill-answers>${raw(answers)}${!feedback?raw(html`<button type="button" class="btn ghost sm" data-review-hint>Hint</button>${v.assistance.includes('hint')?raw(html`<p class="grammar-hint">${q.hint}</p>`):''}`):''}</div></div><div class="drill-feedback" data-feedback>${feedback?raw(feedbackHTML({ok:r.ok,title:r.outcome==='skipped'?'This target is saved for later.':r.outcome==='ungraded'?'Compare this answer with the model.':r.ok?'Correct.':`Look again · ${esc(r.answer)}`,detail:safeHTML(r.explanation),submission:r.submission,nextLabel:v.index+1===v.total?'Finish this visit':'Continue',say:skipped?null:q.say})):''}</div></section>`;
      runner.querySelector('[data-review-audio]')?.addEventListener('ended',()=>{v.audioPlayed=[...new Set([...v.audioPlayed || [],q.audioId])];save();});
      const input=runner.querySelector('[data-answer]');
      if(input){
        if(feedback){input.disabled=true;input.value=r.given;input.classList.add(r.ok?'is-ok':'is-ko');runner.querySelector('[data-check]')?.remove();runner.querySelector('[data-skip]')?.remove();runner.querySelector('[data-accents]')?.remove();}
        else{bindAccentBar(runner.querySelector('.typed'),input);input.oninput=()=>{v.draft=input.value;save();};input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();submit(input.value);}};runner.querySelector('[data-check]').onclick=()=>submit(input.value);runner.querySelector('[data-skip]').onclick=()=>submit('',{revealed:true});}
      }
      runner.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>submit(q.choices[Number(button.dataset.choice)].value ?? q.choices[Number(button.dataset.choice)].label));
      runner.querySelector('[data-review-hint]')?.addEventListener('click',()=>{if(locked)return;v.assistance=[...new Set([...v.assistance,'hint'])];save();draw();});
      runner.querySelector('[data-next]')?.addEventListener('click',async()=>{if(locked)return;locked=true;advanceReviewVisit(session);await durable();locked=false;draw();});
      if(feedback)runner.querySelector('[data-next]')?.focus({preventScroll:true});
    }
    root.querySelector('[data-review-pause]')?.addEventListener('click',()=>{if(locked)return;v.paused=!v.paused;save();draw();});
    root.querySelector('[data-review-resume]')?.addEventListener('click',()=>{v.paused=false;save();draw();});
    viewport.fit();
  }
  async function submit(given,options={}) {
    if(locked||!alive()||session.reviewVisit.paused||session.reviewVisit.phase!=='question')return;
    const frame=currentReviewQuestion(session);
    if(!reviewTargetEligible(store,frame)) {toast('This target was unmarked. Your earlier answers are kept.');location.hash='#/review';return;}
    locked=true;
    const q=frame.question,audioAvailable=!q.listening || q.audioAsset?.reviewed===true && (session.reviewVisit.audioPlayed || []).includes(q.audioId);
    const attempted=reviewAttempt(session,given,{...options,accentStrict:store.settings.accentStrict===true,audioAvailable});
    if(attempted){
      const recorded=store.recordLearningAttempt(attempted.event);
      if(recorded.added && frame.legacyItem)store.recordAnswer(frame.entryId,attempted.result.ok,{quality:attempted.result.ok?session.reviewVisit.assistance.length?3:4:1,xp:attempted.result.ok?2:0});
      session.answeredEventIds=[...new Set([...session.answeredEventIds,attempted.event.id])];
      announceAnswer(attempted.result);await durable();
      if(alive() && frame.question.say)speak(frame.question.say);
    }
    locked=false;draw();
  }
  save();draw();
  return ()=>{
    if(disposed)return;save();disposed=true;stopSpeech();viewport.destroy();delete root.dataset.practiceGame;setChrome({tabs:true});
  };
}
