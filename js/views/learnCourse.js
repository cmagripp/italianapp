import {mountActivityViewport} from '../learning/activity-viewport.js';
import { announceAnswer, html, raw, icon, speak, speakBtn, toast } from '../ui.js';
import { setTitle, setChrome, captureViewOwnership } from '../app.js';
import { store } from '../store.js';
import { getEntry, headword, shortEn } from '../data.js';
import { dropdown, setScene } from '../fx.js';
import { feedbackHTML } from '../games/engine.js';
import { createSentencePanel } from '../learning/sentence-panel.js';
import { grammarCourse, grammarLesson, grammarHref, grammarProgress, relatedVocabulary } from '../learning/grammar-course.js';
import { createCourseSession, compatibleCourseSession, currentCourseStep, advanceCourse, submitCourseAnswer, deferCourseTarget, courseSessionProgress, courseBack, courseReturnLive, resumeCourseTargets, recordCoursePairMismatch, recordCoursePairMatch } from '../learning/course-v2-engine.js';
import { courseButton as button, courseExamples, courseWords, courseWordsCheck, courseTeaching, courseQuestion, coursePortfolio } from '../learning/course-v2-activities.js';
import { loadCourseAudio, courseAudioAsset, downloadUnitAudio, removeUnitAudio, saveCourseRecording, getCourseRecording, deleteCourseRecordings } from '../learning/course-v2-media.js';
import {assistanceAvailable} from '../learning/ai-assistance.js';
import {createPracticeHelp} from '../learning/practice-help.js';
import {createCoursePracticeBinding,createPracticeSourceResolver} from '../learning/practice-sources.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const normalized=text=>String(text||'').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g,"'").trim();
const creditText=value=>typeof value==='string'||typeof value==='number'?String(value).trim():'';
const creditURL=value=>{if(typeof value!=='string')return '';try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}};
// Authored/imported attribution is text. Only absolute web source links become
// clickable; all labels, credits and adaptation notes use the normal escaper.
export function courseAttributionHTML(source,{label='Source'}={}) {
  if(!source||typeof source!=='object')return '';
  const title=creditText(source.title),author=creditText(source.author||source.credit),date=creditText(source.date||source.year),license=creditText(source.license),changes=creditText(source.changes),url=creditURL(source.url),licenseUrl=creditURL(source.licenseUrl);
  if(!title&&!author&&!date&&!license&&!changes&&!url)return '';
  return html`<aside class="course-attribution" aria-label="${label} attribution"><div class="course-attribution-heading"><span>${label}</span>${url?raw(html`<a href="${url}" target="_blank" rel="noopener noreferrer">${title||'Original source'}</a>`):raw(html`<strong>${title||'Source credit'}</strong>`)}</div>${author||date?raw(html`<p>${[author,date].filter(Boolean).join(' · ')}</p>`):''}${license?raw(html`<p>${licenseUrl?raw(html`<a href="${licenseUrl}" target="_blank" rel="noopener noreferrer">${license}</a>`):license}</p>`):''}${changes?raw(html`<details><summary>Adaptation notes</summary><p>${changes}</p></details>`):''}</aside>`;
}
export async function render(root,lesson,query={}) {
  const owned=captureViewOwnership(root);
  const owner=store.current.id,ownerLearner=store.current.learnerId,ownerEpoch=store.learning.epoch.id,mode=query.mode==='review'?'review':'lesson';
  const sameOwner=()=>store.current.id===owner&&store.current.learnerId===ownerLearner&&store.learning.epoch.id===ownerEpoch;
  const prior=store.learning.sessions[`g:${lesson.id}|${mode}`];
  let session=compatibleCourseSession(lesson,prior)&&(prior.courseV2.phase!=='complete'||query.recap==='1')&&(!query.objective||prior.courseV2.activeTargetId===query.objective)?clone(prior):createCourseSession(lesson,{mode,objective:query.objective,learning:store.learning});
  if(prior?.courseV2&&session.id!==prior.id){session.courseV2.portfolios=clone(prior.courseV2.portfolios||{});session.courseV2.flags=clone(prior.courseV2.flags||[]);}
  let disposed=false,recorder=null,recordingTimer=null,recordingURL='',recordingMessage='',recordingStep=null,recordingKey=null;
  const manifest=await loadCourseAudio();
  if(!owned()||!sameOwner())return;
  const g=()=>session.courseV2;
  const save=()=>{if(!disposed&&sameOwner())store.saveLearningSession(session);};
  const current=()=>currentCourseStep(lesson,session);
  const liveStep=()=>current()?.step;
  const markHelp=kind=>{g().assistance=[...new Set([...(g().assistance||[]),kind])];save();};
  const portfolio=step=>{g().portfolios ||= {};return g().portfolios[step.id] ||= {draft:'',criteria:[],modelViewed:false};};
  const recordKey=step=>`${owner}|${store.learning.epoch.id}|${session.id}|${step.id}`;
  const vocabHref=x=>`#/learn/${x.entry.kind==='verb'?'verb':'word'}/${encodeURIComponent(x.entry.id)}?${new URLSearchParams({fromGrammar:lesson.id,...x.caseId?{chapter:x.caseId}:{},...query.courseSession?{courseSession:'1'}:{}})}`;
  const preparedWords=lesson.steps.flatMap(step=>[...step.words||[],...step.background||[]]);
  const prerequisites=(lesson.prerequisites||[]).map(grammarLesson).filter(Boolean);
  const returnLesson=query.fromCourseLesson?grammarLesson(query.fromCourseLesson):null;
  const sourceResolver=createPracticeSourceResolver();
  const helpSource=()=>{
    if(disposed||!sameOwner()||!owned())return null;
    const view=current(),step=view?.step;if(!step||g().paused||g().historyCursor!==null)return null;
    const binding=createCoursePracticeBinding({lesson,session}),canonical=binding&&sourceResolver.resolve(binding);if(!canonical)return null;
    return {helpSource:binding,sourceId:`course:${lesson.id}:${step.id}`,sessionId:session.id,index:session.index,owner:{profileId:owner,learnerId:ownerLearner},epochId:ownerEpoch,level:lesson.level,
      prompt:canonical.prompt,context:canonical.context,
      canonical:clone(step),target:clone(view.target||null),answers:[step.answer,...step.accepted||[],...(step.pairs||[]).map(pair=>pair.right)].filter(value=>typeof value==='string'),
      inputLanguage:'en',originalInput:step.kind==='portfolio'?portfolio(step).draft:g().draft||'',result:clone(g().result||null)};
  };
  const help=createPracticeHelp({getSession:()=>session,isCurrent:()=>!disposed&&sameOwner()&&owned(),getSource:helpSource,persist:async()=>{if(disposed||!sameOwner()||!owned())throw new DOMException('This practice step changed.','AbortError');save();await store.saveNow();},
   onViewed:receipt=>{if(liveStep()?.kind==='question'&&!g().result)markHelp('hint');else if(liveStep()?.kind==='portfolio')portfolio(liveStep()).aiHelp=receipt;},
   onUse:async({text,provenance})=>{if(liveStep()?.kind!=='portfolio')throw new DOMException('This practice step changed.','AbortError');const work=portfolio(liveStep());work.draft=text;work.aiHelp=provenance;save();draw();await store.saveNow();},
   onRefresh:()=>draw(),
  });
  function gloss(token){
    const word=preparedWords.find(w=>normalized(w.it)===normalized(token)||normalized(w.it).replace(/^(il|lo|la|gli|le|i|l')\s*/, '')===normalized(token));
    if(!word)return null;
    const article=word.article || word.it.match(/^(il |lo |la |l')/i)?.[0]?.trim();
    return {label:word.it,word:word.it,meaning:word.en,pos:article?'noun':'word',singular:word.it,plural:word.plural || '',note:word.note,genderLabel:article==='il'||article==='lo'?'masculine':article==='la'?'feminine':''};
  }
  setTitle(lesson.title);setScene(lesson.level==='Foundations'?'A1':lesson.level);setChrome({tabs:false,back:false});
  const viewport=mountActivityViewport(root);
  const fit=viewport.fit;
  const info=document.createElement('button');info.className='journey-info-toggle icon-btn';info.type='button';info.setAttribute('aria-label','Lesson reference and options');info.setAttribute('aria-haspopup','menu');info.setAttribute('aria-expanded','false');info.innerHTML='<span aria-hidden="true" style="font-family:Georgia,serif;font-style:italic;font-size:21px">i</span>';
  document.querySelector('#enToggle').before(info);
  info.addEventListener('click',()=>{if(disposed||!sameOwner())return;dropdown(info,[{value:'outline',label:'Course outline',sub:lesson.unitTitle},{value:'download',label:'Save unit audio offline',sub:'Download recordings for this unit'},{value:'remove-audio',label:'Remove downloaded unit audio',sub:'Your lesson progress stays saved'},...(g().result&&liveStep()?.kind==='question'?[{value:'flag',label:'Flag this answer for my review',sub:'Save locally with your lesson work'}]:[]),{value:'export',label:'Export this lesson’s work',sub:'Written drafts, reflections and answer flags'}],{align:'end',width:300,onSelect:async value=>{
    if(disposed||!sameOwner())return;save();
    if(value==='outline')location.hash='#/course';
    else if(value==='download'){try{const count=await downloadUnitAudio(manifest,lesson.unitId,(n,total)=>toast(`Saving audio ${n} / ${total}`));toast(count?'Unit audio saved.':'This unit uses device speech; no audio pack is needed.');}catch(error){toast(error.message,{ms:4000});}}
    else if(value==='remove-audio'){await removeUnitAudio(manifest,lesson.unitId);toast('Downloaded unit audio removed.');}
    else if(value==='flag'){flagAnswer();}
    else if(value==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify({lessonId:lesson.id,title:lesson.title,portfolios:g().portfolios||{},flags:g().flags||[]},null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`parola-${lesson.id}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }});});
  const panel=createSentencePanel(root,{gloss,context:el=>({sentence:{it:el?.textContent || '',en:el?.dataset.english || ''}}),onReveal:result=>{
    if(disposed||!sameOwner())return;const q=liveStep();if(g().historyCursor!==null)return;
    if(q?.kind==='passage'){g().passageLookups=[...new Set([...(g().passageLookups||[]),q.id])];save();return;}
    if(q?.kind!=='question'||g().result)return;
    if(['reading','listening'].includes(current()?.target?.modality)){markHelp('lookup');return;}
    // Incidental vocabulary help is not evidence about the missing grammar form.
    // Only a lookup which contains the expected response can disclose the target.
    const answers=[q.answer,...q.accepted||[],...q.supportTokens||[]].filter(Boolean).map(normalized);
    if(answers.some(answer=>answer.split(/\s+/).includes(normalized(result.token))))markHelp('lookup');
  }});
  function audioHTML(id,{allowTranscript=true}={}) {
    const passage=lesson.steps.find(s=>s.audioId===id&&s.kind==='passage'),asset=courseAudioAsset(manifest,id);
    if(!passage)return '';
    if(store.settings.showEn==='always')g().transcripts=[...new Set([...(g().transcripts||[]),id])];
    const exposed=(g().transcripts||[]).includes(id);
    const recordingCredit=asset?courseAttributionHTML({...asset,title:asset.title||passage.title,author:asset.credit||asset.voice,url:asset.source},{label:asset.kind==='recorded'?'Recording':'Practice voice source'}):'';
    const textCredit=courseAttributionHTML(passage.source||lesson.editorial?.authenticText||(asset?.textSource?{title:passage.title,url:asset.textSource,license:asset.textLicense,licenseUrl:asset.textLicenseUrl}:{ }),{label:'Text source'});
    return html`<div class="course-audio">${asset?raw(html`<audio controls preload="none" src="${asset.src}" data-course-audio="${id}" aria-label="${passage.title}"></audio><small>${asset.kind==='recorded'?'Recorded Italian':'Practice voice'}${asset.voice?' · '+asset.voice:''}</small>${raw(recordingCredit)}`):raw(html`<button type="button" class="btn secondary" data-device-audio="${id}">${raw(icon('speaker',{size:18}))} Listen</button><small>Device voice · listening practice</small>`)}${raw(textCredit)}${allowTranscript?raw(html`<button type="button" class="btn ghost" data-transcript="${id}" aria-expanded="${exposed}">Read with the audio</button>`):''}${exposed?raw(html`<article class="course-passage"><p lang="it" data-italian-sentence data-english="${passage.en}">${passage.it}</p><p class="muted">${passage.en}</p></article>`):''}</div>`;
  }
  function readingHTML(step,{expand=true}={}) {
    if(!step)return '';
    if(store.settings.showEn==='always')g().translations=[...new Set([...(g().translations||[]),step.id])];
    const shown=(g().translations||[]).includes(step.id);
    const body=html`<article class="course-passage">${raw(courseAttributionHTML(step.source||lesson.editorial?.authenticText))}<p lang="it" data-italian-sentence data-english="${step.en}">${step.it}</p><button type="button" class="btn ghost" data-passage-translation="${step.id}" aria-expanded="${shown}">English</button>${shown?raw(html`<p class="muted">${step.en}</p>`):''}</article>`;
    return expand?html`<details class="course-reading-source"><summary>Read the source · ${step.title}</summary>${raw(body)}</details>`:body;
  }
  async function loadRecording(step){
    if(recordingStep===step.id)return;recordingStep=step.id;
    recordingMessage='';
    if(recordingURL){URL.revokeObjectURL(recordingURL);recordingURL='';}
    const key=portfolio(step).recording?.key||recordKey(step);recordingKey=key;
    try{const blob=await getCourseRecording(key);if(!disposed&&sameOwner()&&recordingKey===key){if(blob)recordingURL=URL.createObjectURL(blob);else if(portfolio(step).recording)recordingMessage='The audio is unavailable on this device. Use your exported recording, or record a new response.';if(blob||recordingMessage)draw();}}catch{recordingMessage='The saved audio could not be opened here. You can still practise aloud or record a new response.';if(!disposed)draw();}
  }
  function draw(focus=false) {
    if(disposed||!sameOwner())return;
    const view=current(),step=view?.step,phase=view?.phase || g().phase;
    const past=g().historyCursor!==null&&g().historyCursor!==undefined;
    const state=past?(g().history[g().historyCursor]?.state || g().history[g().historyCursor] || g()):g();
    const progress=courseSessionProgress(lesson,session,store.learning);
    let content='',footer='',feedback=false;
    if(g().paused){
      content=html`<section class="grammar-finish"><span class="kicker">Your place is saved</span><h1>${lesson.title}</h1><p>Resume whenever you’re ready.</p>${raw(button('Resume lesson','data-resume','primary'))}<a class="btn secondary block" href="#/course">Your course</a><a class="btn ghost block" href="#/learn">Back to Learn</a></section>`;
    } else if(['complete','paused'].includes(phase)||view?.kind==='complete'){
      const p=grammarProgress(lesson,store.learning),related=relatedVocabulary(lesson,store),next=grammarCourse.lessons[grammarCourse.lessons.findIndex(l=>l.id===lesson.id)+1];
      content=html`<section class="grammar-finish"><div class="journey-recap-mark">${raw(icon('check',{size:28}))}</div><span class="kicker">${mode==='review'?'Review saved':p.complete?'Lesson complete':'Your work is saved'}</span><h1 tabindex="-1" data-focus>${lesson.title}</h1><p>${lesson.takeaway}</p>${!p.complete&&mode==='lesson'?raw('<p>Some skills still need practice. You can return to them at any time.</p>'):''}${raw(targetSummary())}${raw(wordSummary())}${related.length?raw(html`<h2>Build on this lesson</h2><div class="grammar-related">${raw(related.map(x=>html`<a class="glass-flat grammar-related-card" href="${vocabHref(x)}"><span class="kicker">${x.entry.kind==='verb'?x.caseId || 'Verb':'Word'}</span><strong>${x.entry.inf || x.entry.it}</strong><span>${x.entry.en}</span><small>Learn ${x.entry.kind==='verb'?'this verb':'this word'} ${raw(icon('arrow',{size:16}))}</small></a>`).join(''))}</div>`):''}</section>`;
      footer=html`${!p.complete&&mode==='lesson'?raw(button('Return to unfinished skills','data-retry-targets')):''}${query.courseSession?raw('<a class="btn primary block" href="#/learn/session">Continue your session</a>'):mode==='review'?raw('<a class="btn primary block" href="#/review">Back to Review</a>'):next?raw(html`<a class="btn primary block" href="${grammarHref(next)}">Next lesson · ${next.title}</a>`):raw('<a class="btn primary block" href="#/course">Your course</a>')}<a class="btn ghost block" href="#/learn">Back to Learn</a>`;
    } else if(view?.kind==='exhausted'||phase==='exhausted'){
      content=html`<section class="grammar-teach"><span class="kicker">Let this settle</span><h1 tabindex="-1" data-focus>Come back with a fresh start</h1><p class="grammar-body">You’ve worked through the available examples for this skill. Your answers and unfinished skills are saved for a later practice session.</p>${raw(targetSummary())}</section>`;
      footer=html`${raw(button('Continue with the rest','data-defer'))}${raw(button('Pause here','data-pause','ghost'))}`;
    } else if(view?.kind==='recap'||phase==='recap'){
      content=html`<section class="grammar-teach"><span class="kicker">Take it with you</span><h1 tabindex="-1" data-focus>${lesson.title}</h1><p class="grammar-body">${lesson.takeaway}</p>${raw(targetSummary())}</section>`;footer=button('Save and finish','data-course-next','primary');
    } else if(view?.kind==='repair'||phase==='repair'){
      const target=view.target || lesson.targets.find(t=>t.id===(step?.target||g().activeTargetId||session.activeObjectiveId)) || lesson.targets[0];
      content=courseTeaching(step?.body?step:target.repair,{repair:true});footer=button('Try a new example','data-course-next');
    } else if(step?.kind==='words') {content=courseWords(step);if(prerequisites.length)content=content.replace('</section>',html`<details class="grammar-prerequisites"><summary>Review an earlier pattern</summary><p>Your place here stays saved.</p>${raw(prerequisites.map(l=>html`<a href="${grammarHref(l)}?fromCourseLesson=${lesson.id}">${l.title}</a>`).join(''))}</details></section>`);footer=button('Continue','data-course-next');}
    else if(step?.kind==='teach') {content=courseTeaching(step);footer=button('Continue','data-course-next');}
    else if(step?.kind==='passage') {
      content=html`<section class="grammar-teach"><span class="kicker">${step.mode==='listen'?'Listen in context':'Read in context'}</span><h1 tabindex="-1" data-focus>${step.title}</h1>${step.task?raw(html`<p class="grammar-body">${step.task}</p>`):''}${step.mode==='listen'?raw(audioHTML(step.audioId)):raw(readingHTML(step,{expand:false}))}</section>`;footer=button('Continue','data-course-next');
    } else if(step?.kind==='portfolio') {
      const work=portfolio(step);loadRecording(step);
      content=coursePortfolio(step,work,{past,recording:recorder?.state==='recording',recordingURL,recordingMessage});footer=button(work.draft?.trim()||work.criteria?.length||work.recording?'Save my practice':'Continue without a response','data-course-next');
    } else if(step?.kind==='words-check') {
      content=courseWordsCheck(step,state,{past,learnedIds:(state.result?.credited || []).filter(id=>store.isLearned(id))});
      if(state.result)footer=button('Continue','data-course-next','primary');
    } else if(step?.kind==='question') {
      const result=state.result;
      content=courseQuestion({...step,extraHint:view.target?.repair?.body||view.target?.explanation},state,{past,guided:step.stage==='guided'||view.guided,audio:step.audioId?audioHTML(step.audioId):'',source:step.passageId?readingHTML(lesson.steps.find(s=>s.id===step.passageId)):''});
      if(result){
        feedback=true;
        const ungraded=result.outcome==='ungraded';
        const explanation=result.explanation || step.explanation;
        const detail=html`${step.speak?raw(html`<p lang="it" data-italian-sentence data-english="${step.translation||''}">${step.speak}</p>`):raw(html`<p>${step.answer || 'Compare the pairs above.'}</p>`)}<p>${explanation}</p>${result.assisted&&step.stage!=='guided'?raw('<p class="course-practice-note">This was supported practice. We’ll revisit the skill with a fresh example.</p>'):''}`;
        footer=ungraded?html`<div class="course-ungraded" role="status"><strong>Compare your response</strong><p>This response needs a closer look; it has not been marked wrong.</p>${raw(detail)}</div>${raw(button('Continue','data-course-next','primary'))}`:feedbackHTML({ok:result.ok,title:result.ok?'That’s right.':result.outcome==='revealed'?'Here’s the pattern.':'Let’s work through it.',detail,submission:result.submission,nextAttribute:'data-course-next'});
      }else if(['type','order'].includes(step.format))footer=button('Check answer','data-check-course'+((step.format==='type'?!state.draft?.trim():state.tokens.length!==step.tokens.length)?' disabled':''),'primary');
    }
    if(returnLesson&&(g().paused||['complete','paused'].includes(phase)))footer=html`<a class="btn primary block" href="${grammarHref(returnLesson)}">Return to ${returnLesson.title}</a><a class="btn ghost block" href="#/course">Your course</a>`;
    if(past){content=html`<div class="grammar-history-note">Earlier in this lesson · read only</div>${raw(content)}`;footer=button('Return to your place','data-return-live','primary');feedback=false;}
    const pct=phase==='complete'?100:Math.min(99,Math.max(0,progress.percent??Math.round((g().stepIndex||0)/lesson.steps.length*100)));
    const stage=step?.kind==='question'?'Practise':step?.kind==='words-check'?'Words':step?.kind==='portfolio'?'Use it':phase==='repair'?'A closer look':['complete','paused'].includes(phase)?'Saved':'Learn';
    root.innerHTML=html`<div class="grammar-shell course-v2-shell" data-course-lesson="${lesson.id}" data-phase="${g().paused?'paused':phase}" data-step="${step?.id||''}" data-history="${past}"><header class="grammar-header"><button type="button" class="btn ghost" data-course-back ${!g().history?.length?raw('disabled'):''}>${raw(icon('chevron',{size:16}))} Back</button><span class="kicker">${lesson.level} · ${g().paused?'Paused':stage}</span><button type="button" class="btn ghost" data-pause>Pause</button><div class="bar" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="bar-fill" style="width:${pct}%"></div></div></header><main class="grammar-scroll">${raw(content)}</main>${footer?raw(html`<footer class="grammar-footer ${feedback?'has-feedback':''}">${raw(footer)}</footer>`):''}</div>`;
    if(!g().paused&&!past&&assistanceAvailable()&&helpSource()&&['teach','question','repair','portfolio'].includes(step?.kind)){
      const tools=document.createElement('div');tools.className='journey-tools';tools.dataset.aiLessonTools='';
      const tasks=step.kind==='portfolio'?['intent']:step.kind==='question'&&!state.result?['hint','explain']:['explain'];
      tools.innerHTML=tasks.map(task=>html`<button type="button" class="btn ghost" data-ai-lesson-help="${task}">${task==='intent'?'Help me say it':task==='hint'?'Another hint':'Help me understand'}</button>`).join('');root.querySelector('.grammar-scroll').append(tools);
    }
    if(step?.kind==='portfolio'&&portfolio(step).aiHelp?.originalText)root.querySelector('.grammar-scroll').insertAdjacentHTML('beforeend',html`<details><summary>Your original idea</summary><p>${portfolio(step).aiHelp.originalText}</p><p class="small muted">Wording help keeps this as assisted practice.</p></details>`);
    help.check();panel.decorate();save();if(focus)root.querySelector('[data-focus]')?.focus({preventScroll:true});
  }
  function targetSummary(){return html`<ul class="course-targets">${raw(grammarProgress(lesson,store.learning).skills.map(target=>html`<li><span>${target.label}</span><small>${target.remembered?'Remembered':target.ready?'Checked in practice':'Keep practising'}</small></li>`).join(''))}</ul>`;}
  function wordSummary(){
    const words=(lesson.wordEntryIds || []).map(getEntry).filter(Boolean);
    return words.length?html`<h2>Words from this lesson</h2><ul class="course-words-summary">${raw(words.map(entry=>{const learned=store.isLearned(entry.id);return html`<li class="${learned?'is-learned':''}"><a href="${vocabHref({entry})}"><span lang="it">${headword(entry)}</span><small>${shortEn(entry.en)}</small></a>${learned?raw(html`<span class="check-mark" role="img" aria-label="Learned">${raw(icon('check',{size:18}))}</span>`):''}</li>`;}).join(''))}</ul>`:'';
  }
  // A completed board credits the words whose rows all matched; the journey evidence
  // (every row of the word across this session's boards, no mismatch) decides completion.
  function creditWords(result){
    const learned=(result?.credited || []).filter(id=>store.completionState(id).complete&&!store.getItem(id)?.learned);
    for(const id of learned)store.markLearned(id,'word');
    if(learned.length)toast(`${learned.length} ${learned.length===1?'parola imparata':'parole imparate'} · ${learned.length} ${learned.length===1?'word':'words'} learned`);
    return learned;
  }
  function matchWords(left,right){
    if(disposed||!sameOwner())return;const step=liveStep();if(step?.kind!=='words-check'||g().result||g().paused||g().historyCursor!==null)return;
    const match=recordCoursePairMatch(lesson,session,{left,right});
    session=match.session;g().left=null;
    for(const event of match.events || [])store.recordLearningAttempt(event);
    if(left===right){const say=step.pairs[left]?.say;if(say)speak(say);}
    else g().pairMessage ||= 'Look at the meanings and try another pair.';
    if(match.complete)creditWords(g().result);
    save();draw();
  }
  function submit(value,{reveal=false}={}){
    if(disposed||!sameOwner()||g().result||g().paused||g().historyCursor!==null)return;
    const q=liveStep();if(q?.kind!=='question')return;
    const asset=courseAudioAsset(manifest,q.audioId),audioAvailable=!!asset?.reviewed&&(g().audioPlayed||[]).includes(q.audioId);
    if((g().transcripts||[]).includes(q.audioId))markHelp('transcript');
    if((g().passageLookups||[]).includes(q.passageId)&&current()?.target?.modality==='reading')markHelp('lookup');
    if((g().translations||[]).includes(q.passageId)&&(q.modality==='reading'||current()?.target?.modality==='reading'))markHelp('translation');
    const submission=submitCourseAnswer(lesson,session,value,{reveal,audioAvailable,learning:store.learning,accentStrict:store.settings.accentStrict});
    announceAnswer(submission.result);
    session=submission.session;if(submission.event)store.recordLearningAttempt(submission.event);
    if(submission.result?.ok&&q.speak&&q.speak.length<240)speak(q.speak);
    save();draw();
  }
  function flagAnswer(){const step=liveStep();g().flags ||= [];if(!g().flags.some(flag=>flag.stepId===step?.id&&flag.answer===g().result?.given))g().flags.push({stepId:step?.id,answer:g().result?.given||'',at:Date.now()});save();toast('Saved in this lesson’s work. Nothing was sent.');}
  function check(){if(disposed||!sameOwner())return;const step=liveStep();if(step?.kind==='question')submit(step.format==='order'?(g().tokens||[]).map(i=>step.tokens[i]).join(' '):g().draft);}
  function stopRecording(){if(recorder?.state==='recording')recorder.stop();clearTimeout(recordingTimer);}
  async function toggleRecording(){
    if(disposed||!sameOwner())return;if(recorder?.state==='recording'){stopRecording();return;}
    const step=liveStep();if(step?.kind!=='portfolio')return;
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder){recordingMessage='Recording is unavailable in this browser. You can practise aloud and save notes.';draw();return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(disposed||!sameOwner()||liveStep()?.id!==step.id){stream.getTracks().forEach(track=>track.stop());return;}
      recorder=new MediaRecorder(stream);
      const activeRecorder=recorder,chunks=[],key=recordKey(step)+'|'+Date.now().toString(36),epoch=store.learning.epoch.id,work=portfolio(step);
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onstop=async()=>{
        stream.getTracks().forEach(track=>track.stop());
        const blob=new Blob(chunks,{type:activeRecorder.mimeType||'audio/webm'});
        if(recorder===activeRecorder)recorder=null;
        if(!sameOwner()||store.learning.epoch.id!==epoch)return;
        try{
          if(!blob.size)throw new Error('No audio was captured. Your earlier work is still saved.');
          await saveCourseRecording(key,blob);
          const saved=store.learning.sessions[`g:${lesson.id}|${mode}`];
          if(!sameOwner()||store.learning.epoch.id!==epoch||saved?.id!==session.id){await deleteCourseRecordings(key,{exact:true});return;}
          const previous=saved.courseV2.portfolios?.[step.id]?.recording;
          const metadata={key,type:blob.type,bytes:blob.size,at:Date.now()};
          work.recording=metadata;
          // Navigation may already have opened another lesson. Complete this
          // saved response without replacing that lesson's active session.
          saved.courseV2.portfolios ||= {};
          saved.courseV2.portfolios[step.id]={...saved.courseV2.portfolios[step.id],recording:metadata};
          if(store.learning.session?.id===session.id)store.learning.session.courseV2.portfolios[step.id]=saved.courseV2.portfolios[step.id];
          store.save();await store.saveNow();
          if(previous?.key&&previous.key!==key)await deleteCourseRecordings(previous.key,{exact:true});
          if(recordingURL)URL.revokeObjectURL(recordingURL);
          if(!disposed)recordingURL=URL.createObjectURL(blob);
          recordingMessage='Saved on this device. Export your recording separately to keep a copy.';
        }catch(error){recordingMessage=error.message;}
        draw();
      };
      recorder.start();recordingMessage='Recording…';recordingTimer=setTimeout(stopRecording,120000);draw();
    }catch{recordingMessage='Microphone access was not available. You can practise aloud and save your notes.';draw();}
  }
  const click=event=>{
    const b=event.target.closest('button');if(!b||disposed||!sameOwner())return;
    if(b.hasAttribute('data-pause')){stopRecording();g().paused=true;save();draw();return;}
    if(b.hasAttribute('data-resume')){g().paused=false;save();draw();return;}
    if(b.hasAttribute('data-course-back')){stopRecording();session=courseBack(lesson,session);save();draw();return;}
    if(b.hasAttribute('data-return-live')){session=courseReturnLive(lesson,session);save();draw();return;}
    if(g().historyCursor!==null||g().paused)return;
    if(b.hasAttribute('data-ai-lesson-help')){void help.open(b.dataset.aiLessonHelp,b).catch(error=>{if(!disposed&&sameOwner()&&error.name!=='AbortError')toast(error.message);});return;}
    const step=liveStep();
    if(b.hasAttribute('data-retry-targets')){session=resumeCourseTargets(lesson,session,store.learning);save();draw(true);return;}
    if(b.hasAttribute('data-course-next')){stopRecording();session=advanceCourse(lesson,session,store.learning);
      if(g().phase==='complete'&&mode==='lesson'){const targets=grammarProgress(lesson,store.learning).skills.filter(s=>s.ready).map(s=>s.objectiveId);store.recordLearningAttempt({id:session.id+':finish',sessionId:session.id,index:session.index,objectiveId:lesson.id+'.course-finish',entryId:'g:'+lesson.id,kind:'grammar',policy:'grammar-v2',contentVersion:2,skill:'course-completion',outcome:'ungraded',ok:false,completedTargets:targets,xp:0,countStats:false});}
      save();draw(true);return;}
    if(b.hasAttribute('data-defer')){session=deferCourseTarget(lesson,session,store.learning);save();draw(true);return;}
    if(b.hasAttribute('data-transcript')){g().transcripts=[...new Set([...(g().transcripts||[]),b.dataset.transcript])];if(step?.audioId===b.dataset.transcript&&step.kind==='question')markHelp('transcript');save();draw();return;}
    if(b.hasAttribute('data-passage-translation')){g().translations=[...new Set([...(g().translations||[]),b.dataset.passageTranslation])];save();draw();return;}
    if(b.hasAttribute('data-device-audio')){const passage=lesson.steps.find(s=>s.kind==='passage'&&s.audioId===b.dataset.deviceAudio);if(passage)speak(passage.it,{force:true});return;}
    if(b.hasAttribute('data-portfolio-model')){portfolio(step).modelViewed=!portfolio(step).modelViewed;save();draw();return;}
    if(b.hasAttribute('data-record')){toggleRecording();return;}
    if(b.hasAttribute('data-flag')){g().flags ||= [];if(!g().flags.some(flag=>flag.stepId===step?.id&&flag.answer===g().result?.given))g().flags.push({stepId:step?.id,answer:g().result?.given||'',at:Date.now()});save();toast('Saved in this lesson’s work. Nothing was sent.');return;}
    if(step?.kind==='words-check'){
      if(g().result)return;
      if(b.hasAttribute('data-pair-left')){g().left=Number(b.dataset.pairLeft);save();draw();}
      else if(b.hasAttribute('data-pair-right')&&Number.isInteger(g().left))matchWords(g().left,Number(b.dataset.pairRight));
      return;
    }
    if(step?.kind!=='question'||g().result)return;
    if(b.hasAttribute('data-choice'))submit(step.options[Number(b.dataset.choice)]);
    else if(b.hasAttribute('data-check-course'))check();
    else if(b.hasAttribute('data-hint')){g().hintLevel=Math.min(2,(g().hintLevel||0)+1);markHelp('hint');draw();}
    else if(b.hasAttribute('data-reveal'))submit('',{reveal:true});
    else if(b.hasAttribute('data-token')){g().tokens.push(Number(b.dataset.token));save();draw();}
    else if(b.hasAttribute('data-remove-token')){g().tokens.splice(Number(b.dataset.removeToken),1);save();draw();}
    else if(b.hasAttribute('data-pair-left')){g().left=Number(b.dataset.pairLeft);save();draw();}
    else if(b.hasAttribute('data-pair-right')&&Number.isInteger(g().left)){
      const right=Number(b.dataset.pairRight),left=g().left;g().left=null;
      if(right===left){g().matched.push(left);g().pairMessage='';if(g().matched.length===step.pairs.length){submit(step.pairs.map((_,i)=>i));return;}}
      else {const mismatch=recordCoursePairMismatch(lesson,session,{left,right});session=mismatch.session;if(mismatch.event)store.recordLearningAttempt(mismatch.event);g().pairMessage=step.hint || 'Look at the meanings and try another pair.';}
      save();draw();
    } else if(b.hasAttribute('data-accent')){const field=root.querySelector('[data-course-input]');if(field){field.setRangeText(b.dataset.accent,field.selectionStart,field.selectionEnd,'end');g().draft=field.value;save();field.focus({preventScroll:true});root.querySelector('[data-check-course]')?.removeAttribute('disabled');}}
  };
  const input=event=>{
    if(disposed||!sameOwner())return;
    if(event.target.matches('[data-course-input]')){g().draft=event.target.value.slice(0,1200);save();root.querySelector('[data-check-course]')?.toggleAttribute('disabled',!g().draft.trim());}
    else if(event.target.matches('[data-portfolio-draft]')){portfolio(liveStep()).draft=event.target.value.slice(0,12000);save();}
    else if(event.target.matches('[data-rubric]')){const work=portfolio(liveStep()),criteria=new Set(work.criteria||[]),i=Number(event.target.dataset.rubric);if(event.target.checked)criteria.add(i);else criteria.delete(i);work.criteria=[...criteria];save();}
  };
  const form=event=>{if(event.target.matches('[data-course-form]')){event.preventDefault();check();}};
  const audioPlayed=event=>{if(disposed||!sameOwner())return;if(event.target.matches?.('[data-course-audio]')){g().audioPlayed=[...new Set([...(g().audioPlayed||[]),event.target.dataset.courseAudio])];save();}};
  const audioError=event=>{if(disposed||!sameOwner())return;if(event.target.matches?.('[data-course-audio]')){g().audioPlayed=(g().audioPlayed||[]).filter(id=>id!==event.target.dataset.courseAudio);save();toast('Audio could not play. Reconnect, or use the transcript for supported practice.',{ms:4000});}};
  const offOwner=store.on('profile',()=>{if(!sameOwner()){help.close();stopRecording();info.disabled=true;}});
  const englishToggle=()=>draw();document.querySelector('#enToggle').addEventListener('click',englishToggle);
  root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('submit',form);root.addEventListener('ended',audioPlayed,true);root.addEventListener('error',audioError,true);save();draw();
  return ()=>{offOwner();help.dispose();stopRecording();save();disposed=true;panel.destroy();info.remove();document.querySelector('#enToggle').removeEventListener('click',englishToggle);if(recordingURL)URL.revokeObjectURL(recordingURL);root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('submit',form);root.removeEventListener('ended',audioPlayed,true);root.removeEventListener('error',audioError,true);viewport.destroy();setChrome({tabs:true});};
}
