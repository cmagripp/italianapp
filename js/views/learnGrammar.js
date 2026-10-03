import {mountActivityViewport} from '../learning/activity-viewport.js';
import { render as renderCourse } from './learnCourse.js';
import { announceAnswer, html, raw, icon, speak, speakBtn } from '../ui.js';
import { setTitle, setChrome, captureViewOwnership } from '../app.js';
import { store } from '../store.js';
import { LEARNING_VERSION } from '../learning/model.js';
import { shuffle, getEntry } from '../data.js';
import { dropdown, setScene } from '../fx.js';
import { feedbackHTML } from '../games/engine.js';
import { createSentencePanel } from '../learning/sentence-panel.js';
import { loadGrammarCourse, loadGrammarLesson, grammarCourse, grammarLesson, grammarHref, grammarProgress, relatedVocabulary } from '../learning/grammar-course.js';
import { createGrammarSession, compatibleGrammarSession, grammarObjective, currentGrammarQuestion, advanceGrammar, grammarAttempt, checkGrammarAnswer } from '../learning/grammar-journey.js';
import {assistanceAvailable} from '../learning/ai-assistance.js';
import {createPracticeHelp} from '../learning/practice-help.js';
import {createGrammarPracticeBinding,createPracticeSourceResolver} from '../learning/practice-sources.js';

const button=(label,attr,cls='secondary')=>html`<button type="button" class="btn ${cls} block" ${raw(attr)}>${label}</button>`;
const exercisePrompt=prompt=>({'Choose the form that completes the sentence.':'Complete the sentence','Put the words in the correct order.':'Build the sentence'}[prompt] || prompt);
const vocabHref=(x,lesson,courseSession)=>`#/learn/${x.entry.kind==='verb'?'verb':'word'}/${encodeURIComponent(x.entry.id)}?${new URLSearchParams({fromGrammar:lesson.id,...x.caseId?{chapter:x.caseId}:{},...courseSession?{courseSession:'1'}:{}})}`;
export async function render(root,params,query={}) {
  const owned=captureViewOwnership(root);
  const owner=store.current.id,ownerLearner=store.current.learnerId,ownerEpoch=store.learning.epoch.id;
  const sameOwner=()=>store.current.id===owner&&store.current.learnerId===ownerLearner&&store.learning.epoch.id===ownerEpoch;
  if(store.learning.version>LEARNING_VERSION){root.innerHTML=html`<div class="empty"><h1>Update Parola to continue</h1><p>Your saved progress is safe. Reopen the app online to get the latest version.</p><a href="#/learn">Back to Learn</a></div>`;return;}
  let lesson;
  try{lesson=await loadGrammarLesson(params.id);}catch(error){if(!owned()||!sameOwner())return;root.innerHTML=html`<div class="empty"><p>${error.message}</p><button class="btn primary" data-course-retry>Retry this lesson</button><a class="btn ghost" href="#/course">Your course</a></div>`;root.querySelector('[data-course-retry]').addEventListener('click',()=>render(root,params,query));return;}
  if(!owned()||!sameOwner())return;
  if(!lesson){root.innerHTML=html`<div class="empty"><p>This lesson is unavailable.</p><a class="btn primary" href="#/course">Your course</a></div>`;return;}
  if(lesson.contentVersion===2)return renderCourse(root,lesson,query);
  const mode=query.mode==='review'?'review':'lesson';
  const prior=store.learning.sessions[`g:${lesson.id}|${mode}`];
  let session=compatibleGrammarSession(lesson,prior) && (prior.grammar.phase!=='complete'||query.recap==='1') && (!query.objective || prior.objectiveIds.includes(query.objective) && grammarObjective(lesson,prior)?.id===query.objective)
    ? JSON.parse(JSON.stringify(prior)) : createGrammarSession(lesson,{mode,objective:query.objective});
  let disposed=false;
  const g=()=>session.grammar;
  const save=()=>{if(!disposed&&sameOwner()){store.saveLearningSession(session);}};
  const sourceResolver=createPracticeSourceResolver();
  const helpSource=()=>{
    if(disposed||!sameOwner()||!owned())return null;
    if(g().paused||g().historyCursor!==null||g().phase==='complete')return null;
    const objective=grammarObjective(lesson,session),q=g().phase==='question'?currentGrammarQuestion(lesson,session):null,card=g().phase==='teach'?objective.teach[g().teachIndex]:null;
    const binding=createGrammarPracticeBinding({lesson,session}),canonical=binding&&sourceResolver.resolve(binding);if(!canonical)return null;
    return {helpSource:binding,sourceId:`grammar:${lesson.id}:${objective.id}:${q?.id||g().phase+':'+g().teachIndex}`,sessionId:session.id,index:session.index,owner:{profileId:owner,learnerId:ownerLearner},epochId:ownerEpoch,level:lesson.level,
      prompt:canonical.prompt,context:canonical.context,canonical:structuredClone(canonical.canonical),
      answers:[q?.answer,...q?.accepted||[],...(q?.pairs||[]).map(pair=>pair.right)].filter(value=>typeof value==='string'),originalInput:g().draft,result:g().result,inputLanguage:'en'};
  };
  const help=createPracticeHelp({getSession:()=>session,isCurrent:()=>!disposed&&sameOwner()&&owned(),getSource:helpSource,persist:async()=>{if(disposed||!sameOwner()||!owned())throw new DOMException('This practice step changed.','AbortError');save();await store.saveNow();},
   onViewed:()=>{if(g().phase==='question'&&!g().result)g().assistance=[...new Set([...g().assistance,'hint'])];},onRefresh:()=>draw(),
  });
  const offOwner=store.on('profile',()=>{if(!sameOwner())help.close();});
  setTitle(lesson.title);setScene(lesson.level);setChrome({tabs:false,back:false});
  const viewport=mountActivityViewport(root);
  const fit=viewport.fit;
  const info=document.createElement('button');info.className='journey-info-toggle icon-btn';info.type='button';info.setAttribute('aria-label','Lesson reference');info.setAttribute('aria-haspopup','menu');info.setAttribute('aria-expanded','false');info.innerHTML='<span aria-hidden="true" style="font-family:Georgia,serif;font-style:italic;font-size:21px">i</span>';
  document.querySelector('#enToggle').before(info);
  info.addEventListener('click',()=>{if(disposed||!sameOwner())return;dropdown(info,[{value:'outline',label:'Course outline',sub:lesson.unitTitle},...(lesson.referenceTopics || []).map(id=>({value:id,label:id.split('-').join(' '),sub:'Grammar reference'}))],{align:'end',width:285,onSelect:value=>{if(disposed||!sameOwner())return;save();location.hash=value==='outline'?'#/course':'#/grammar/'+value;}});});
  const panel=createSentencePanel(root,{context:el=>({sentence:{it:el?.textContent || '',en:el?.dataset.english || ''}}),onReveal:()=>{if(!disposed&&sameOwner()&&g().phase==='question'&&!g().result && g().historyCursor===null){g().assistance=[...new Set([...g().assistance,'lookup'])];save();}}});
  function questionHTML(q,state,past) {
    const answered=!!state.result;
    let activity='';
    if(q.format==='choice') {
      if(!state.optionOrder)state.optionOrder=shuffle(q.options.map((_,i)=>i));
      activity=html`<div class="grammar-choices">${raw(state.optionOrder.map((i,k)=>html`<button type="button" class="choice ${answered&&checkGrammarAnswer(q,q.options[i])?'is-correct':answered&&state.result.given===q.options[i]?'is-wrong':''}" data-choice="${i}" ${answered||past?raw('disabled'):''}><span class="journey-choice-marker">${String.fromCharCode(65+k)}</span><span>${q.options[i]}</span></button>`).join(''))}</div>`;
    } else if(q.format==='type') activity=html`<form data-grammar-form><label class="sr-only" for="grammar-answer">Your answer in Italian</label><input id="grammar-answer" data-grammar-input autocomplete="off" autocapitalize="none" spellcheck="false" value="${state.draft || ''}" ${answered||past?raw('readonly'):''} placeholder="Write in Italian"><div class="journey-accents">${raw(['à','è','é','ì','ò','ù',"'"].map(letter=>html`<button type="button" data-accent="${letter}" ${answered||past?raw('disabled'):''}>${letter}</button>`).join(''))}</div></form>`;
    else if(q.format==='order') {
      if(!state.tokenOrder)state.tokenOrder=shuffle(q.tokens.map((_,i)=>i));
      activity=html`<div class="grammar-built" aria-label="Your sentence">${state.tokens.length?raw(state.tokens.map((i,k)=>html`<button type="button" class="chip" data-remove-token="${k}" ${answered||past?raw('disabled'):''}>${q.tokens[i]}</button>`).join('')):raw('<span class="muted">Tap the words to build the sentence</span>')}</div><div class="grammar-tokens">${raw(state.tokenOrder.map(i=>html`<button type="button" class="chip" data-token="${i}" ${state.tokens.includes(i)||answered||past?raw('disabled'):''}>${q.tokens[i]}</button>`).join(''))}</div>`;
    } else if(q.format==='match') {
      if(!state.rightOrder)state.rightOrder=shuffle(q.pairs.map((_,i)=>i));
      activity=html`<div class="grammar-pairs"><div>${raw(q.pairs.map((p,i)=>html`<button type="button" class="choice ${state.matched.includes(i)?'matched':''} ${state.left===i?'selected':''}" data-pair-left="${i}" ${state.matched.includes(i)||answered||past?raw('disabled'):''}>${p.left}</button>`).join(''))}</div><div>${raw(state.rightOrder.map(i=>html`<button type="button" class="choice ${state.matched.includes(i)?'matched':''}" data-pair-right="${i}" ${state.matched.includes(i)||answered||past?raw('disabled'):''}>${q.pairs[i].right}</button>`).join(''))}</div></div>${state.pairMessage?raw(html`<p role="status" class="grammar-hint">${state.pairMessage}</p>`):''}`;
    }
    return html`<section class="grammar-question"><span class="kicker">${state.guided?'Try it together':'Your turn'}</span><h1 tabindex="-1" data-focus>${exercisePrompt(q.prompt)}</h1>${q.translation?raw(html`<p class="grammar-translation">${q.translation}</p>`):''}${q.context?raw(html`<p class="grammar-sentence" lang="it" data-italian-sentence data-english="${q.translation || ''}">${q.context}</p>`):''}${raw(activity)}${!answered&&!past?raw(html`${state.assistance.includes('hint')?raw(html`<aside class="grammar-hint">${q.hint || grammarObjective(lesson,session).explanation}</aside>`):''}<div class="journey-tools"><button type="button" class="btn ghost" data-hint>Help me</button><button type="button" class="btn ghost" data-reveal>Show answer</button><button type="button" class="btn ghost" data-pause>Save for later</button></div>`):''}</section>`;
  }
  function draw(focus=false) {
    if(disposed||!sameOwner())return;
    const state=g().historyCursor!==null?g().history[g().historyCursor]:g(),past=state!==g();
    const objective=lesson.objectives[state.objectiveIndex],progress=grammarProgress(lesson,store.learning);
    const q=state.phase==='question'?(objective.questions.find(x=>x.id===state.questionId)||objective.questions[state.questionIndex%objective.questions.length]):null;
    if(q)state.questionId=q.id;
    let content='',footer='';
    if(g().paused) {
      content=html`<section class="grammar-finish"><span class="kicker">Your place is saved</span><h1>${lesson.title}</h1><p>Come back whenever you’re ready.</p>${raw(button('Resume lesson','data-resume','primary'))}<a class="btn secondary block" href="#/course">Your course</a><a class="btn ghost block" href="#/learn">Back to Learn</a>${query.courseSession?raw('<a class="btn secondary block" href="#/learn/session">Your session</a>'):''}</section>`;
    } else if(state.phase==='complete') {
      const related=relatedVocabulary(lesson,store);
      const next=grammarCourse.lessons[grammarCourse.lessons.findIndex(l=>l.id===lesson.id)+1];
      content=html`<section class="grammar-finish"><div class="journey-recap-mark">${raw(icon('check',{size:28}))}</div><span class="kicker">${mode==='review'?'Review complete':'Lesson complete'}</span><h1 tabindex="-1" data-focus>${lesson.title}</h1><p>${lesson.takeaway}</p>${mode==='lesson'&&related.length?raw(html`<h2>Use what you learned</h2><div class="grammar-related">${raw(related.map(x=>html`<a class="glass-flat grammar-related-card" href="${vocabHref(x,lesson,query.courseSession)}"><span class="kicker">${x.entry.kind==='verb'?x.caseId || 'Verb':'Word'}</span><strong>${x.entry.inf || x.entry.it}</strong><span>${x.entry.en}</span><small>${store.isLearned(x.entry.id)?'Revisit':'Learn'} ${x.entry.kind==='verb'?'this verb':'this word'} ${raw(icon('arrow',{size:16}))}</small></a>`).join(''))}</div>`):''}</section>`;
      footer=html`${query.courseSession?raw('<a class="btn primary block" href="#/learn/session">Continue your session</a>'):mode==='review'?raw('<a class="btn primary block" href="#/review">Back to Review</a>'):next?raw(html`<a class="btn primary block" href="${grammarHref(next)}">Next lesson · ${next.title}</a>`):raw('<a class="btn primary block" href="#/course">Your course</a>')}<a class="btn ghost block" href="#/learn">Back to Learn</a>`;
    } else if(state.phase==='teach') {
      const card=objective.teach[state.teachIndex];
      const prerequisites=(lesson.prerequisites || []).map(grammarLesson).filter(l=>l&&!grammarProgress(l,store.learning).complete);
      content=html`<section class="grammar-teach"><span class="kicker">${lesson.unitTitle}</span><h1 tabindex="-1" data-focus>${card.title}</h1><p class="grammar-body">${card.body}</p><div class="grammar-examples">${raw((card.examples || []).map(ex=>html`<article class="glass-flat grammar-example"><div class="grammar-example-top"><p lang="it" data-italian-sentence data-english="${ex.en}">${ex.it}</p>${raw(speakBtn(ex.it))}</div><p>${ex.en}</p></article>`).join(''))}</div>${card.tip?raw(html`<aside class="grammar-hint">${card.tip}</aside>`):''}${state.teachIndex===0&&state.objectiveIndex===0&&prerequisites.length?raw(html`<details class="grammar-prerequisites"><summary>Useful before this lesson</summary>${raw(prerequisites.map(l=>html`<a href="${grammarHref(l)}">${l.title}</a>`).join(''))}</details>`):''}</section>`;
      footer=button('Continue','data-grammar-next');
    } else if(state.phase==='repair') {
      const repair=objective.questions.find(x=>x.id===state.repairQuestion);
      content=html`<section class="grammar-teach"><span class="kicker">Let’s look at it another way</span><h1 tabindex="-1" data-focus>${objective.label}</h1><p class="grammar-body">${objective.explanation}</p>${repair?raw(html`<article class="glass-flat grammar-example"><p lang="it" data-italian-sentence data-english="${repair.translation || ''}">${repair.speak || repair.answer || ''}</p><p>${repair.explanation}</p></article>`):''}<p class="muted">Try a new example with a little support.</p></section>`;
      footer=button('Try another example','data-grammar-next');
    } else if(q) {
      content=questionHTML(q,state,past);
      if(state.result)footer=feedbackHTML({ok:state.result.ok,title:state.result.ok?'That’s right.':'Let’s work through it.',detail:html`<p lang="it" data-italian-sentence data-english="${q.translation || ''}">${q.speak || q.answer || ''}</p><p>${q.explanation}</p>`,submission:state.result.submission,nextAttribute:'data-grammar-next'});
      else if(['type','order'].includes(q.format))footer=button('Check answer','data-check-grammar'+((q.format==='type'?!state.draft.trim():state.tokens.length!==q.tokens.length)?' disabled':''),'primary');
    }
    if(past){content=html`<div class="grammar-history-note">Earlier in this lesson · answers are not recorded here</div>${raw(content)}`;footer=button('Return to your place','data-return-live','primary');}
    const pct=state.phase==='complete'?100:Math.min(95,Math.round((progress.completed+Math.min(.9,(state.teachIndex+state.questionIndex+1)/7))/progress.total*100));
    root.innerHTML=html`<div class="grammar-shell" data-grammar-lesson="${lesson.id}" data-phase="${g().paused?'paused':state.phase}" data-history="${past}"><header class="grammar-header"><button type="button" class="btn ghost" data-grammar-back ${!g().history.length?raw('disabled'):''}>${raw(icon('chevron',{size:16}))} Back</button><span class="kicker">${lesson.level} · ${g().paused?'Paused':state.phase==='complete'?'Complete':state.phase==='teach'?'Learn':state.phase==='repair'?'A closer look':'Practise'}</span><button type="button" class="btn ghost" data-pause>Pause</button><div class="bar" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="bar-fill" style="width:${pct}%"></div></div></header><main class="grammar-scroll">${raw(content)}</main>${footer?raw(html`<footer class="grammar-footer ${state.result&&!past?'has-feedback':''}">${raw(footer)}</footer>`):''}</div>`;
    if(!g().paused&&!past&&state.phase!=='complete'&&assistanceAvailable()&&helpSource()){
      const tools=document.createElement('div');tools.className='journey-tools';tools.dataset.aiLessonTools='';
      tools.innerHTML=(q&&!state.result?['hint','explain']:['explain']).map(task=>html`<button type="button" class="btn ghost" data-ai-lesson-help="${task}">${task==='hint'?'Another hint':'Help me understand'}</button>`).join('');root.querySelector('.grammar-scroll').append(tools);
    }
    help.check();panel.decorate();save();
    if(focus)root.querySelector('[data-focus]')?.focus({preventScroll:true});
  }
  function submit(value,{reveal=false}={}) {
    if(disposed||!sameOwner()||g().result||g().historyCursor!==null||g().paused||g().phase!=='question')return;
    const q=currentGrammarQuestion(lesson,session),attempt=grammarAttempt(lesson,session,q,value,{reveal,accentStrict:store.settings.accentStrict});
    store.recordLearningAttempt(attempt);announceAnswer(attempt);
    g().result={ok:attempt.ok,assisted:!!attempt.assistance.length,given:attempt.submission?.displayText || (typeof value==='string'?value:''),submission:attempt.submission,questionId:q.id};
    if(attempt.submission?.ok && q.format==='type')g().draft=attempt.submission.displayText;
    if(attempt.ok && (q.speak || q.answer))speak(q.speak || q.answer);
    save();draw();
  }
  function check(){const q=currentGrammarQuestion(lesson,session);if(q)submit(q.format==='order'?g().tokens.map(i=>q.tokens[i]).join(' '):g().draft);}
  const click=event=>{
    const b=event.target.closest('button');if(!b||disposed||!sameOwner())return;
    if(b.hasAttribute('data-pause')){g().paused=true;save();draw();return;}
    if(b.hasAttribute('data-resume')){g().paused=false;save();draw();return;}
    if(b.hasAttribute('data-grammar-back')){if(g().phase==='question'&&!g().result)g().assistance=[...new Set([...g().assistance,'history'])];if(g().history.length)g().historyCursor=g().historyCursor===null?g().history.length-1:Math.max(0,g().historyCursor-1);save();draw();return;}
    if(b.hasAttribute('data-return-live')){g().historyCursor=null;save();draw();return;}
    if(g().historyCursor!==null||g().paused)return;
    if(b.hasAttribute('data-ai-lesson-help')){void help.open(b.dataset.aiLessonHelp,b).catch(error=>{if(!disposed&&sameOwner()&&error.name!=='AbortError')console.warn(error.message);});return;}
    if(b.hasAttribute('data-grammar-next')){session=advanceGrammar(lesson,session,store.learning);delete g().optionOrder;delete g().tokenOrder;delete g().rightOrder;g().pairMessage='';save();draw(true);return;}
    const q=currentGrammarQuestion(lesson,session);if(!q||g().result)return;
    if(b.hasAttribute('data-choice'))submit(q.options[Number(b.dataset.choice)]);
    else if(b.hasAttribute('data-check-grammar'))check();
    else if(b.hasAttribute('data-hint')){g().assistance=[...new Set([...g().assistance,'hint'])];save();draw();}
    else if(b.hasAttribute('data-reveal'))submit('',{reveal:true});
    else if(b.hasAttribute('data-token')){g().tokens.push(Number(b.dataset.token));save();draw();}
    else if(b.hasAttribute('data-remove-token')){g().tokens.splice(Number(b.dataset.removeToken),1);save();draw();}
    else if(b.hasAttribute('data-pair-left')){g().left=Number(b.dataset.pairLeft);save();draw();}
    else if(b.hasAttribute('data-pair-right')&&Number.isInteger(g().left)){
      const right=Number(b.dataset.pairRight),left=g().left;g().left=null;
      if(right===left){g().matched.push(left);g().pairMessage='';if(g().matched.length===q.pairs.length){submit(q.pairs.map((_,i)=>i));return;}}
      else {g().pairErrors=(g().pairErrors||0)+1;g().pairMessage=q.hint || 'Those do not match. Look at the meaning and try again.';store.recordLearningAttempt({...grammarAttempt(lesson,session,q,[]),xp:0});}
      save();draw();
    } else if(b.hasAttribute('data-accent')){const input=root.querySelector('[data-grammar-input]');if(input){input.setRangeText(b.dataset.accent,input.selectionStart,input.selectionEnd,'end');g().draft=input.value;save();input.focus({preventScroll:true});root.querySelector('[data-check-grammar]')?.removeAttribute('disabled');}}
  };
  const input=event=>{if(!disposed&&sameOwner()&&event.target.matches('[data-grammar-input]')){g().draft=event.target.value.slice(0,600);save();help.check();root.querySelector('[data-check-grammar]')?.toggleAttribute('disabled',!g().draft.trim());}};
  const form=event=>{if(!disposed&&sameOwner()&&event.target.matches('[data-grammar-form]')){event.preventDefault();check();}};
  root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('submit',form);save();draw();
  return ()=>{save();disposed=true;offOwner();help.dispose();panel.destroy();info.remove();root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('submit',form);viewport.destroy();setChrome({tabs:true});};
}
