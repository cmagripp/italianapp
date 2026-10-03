import {html,raw,icon,sheet,promptDialog,confirmDialog,toast,speak,stopSpeech} from '../ui.js';
import {setTitle,setChrome,navigate,captureViewOwnership} from '../app.js';
import {store} from '../store.js';
import {data,loadData} from '../data.js';
import {dropdown} from '../fx.js';
import {sourceFingerprint} from '../ai/source-fingerprint.js';
import {compareSubmission,foldItalianAccents} from '../learning/answer-policy.js';
import {createConversationRepository} from '../conversations/storage.js';
import {exportConversationJSON,importConversationJSON} from '../conversations/backup.js';
import {createConversationController} from '../conversations/controller.js';
import {conversationReadiness,resolveConversationRule,acquireConversationSpeech,onConversationProviderChange} from '../conversations/runtime.js';
import {createConversationSpeechSession} from '../conversations/speech-session.js';
import {createTemporaryAudioPlayer} from '../ai/temporary-audio.js';
import {createSpokenFeedback} from '../conversations/spoken-feedback.js';
import {openConversationStudy} from '../conversations/study.js';
import {createSentenceLookup} from '../learning/sentence-lookup.js';
import {createSentencePanel} from '../learning/sentence-panel.js';
import {mountActivityViewport} from '../learning/activity-viewport.js';
import {isStarred,toggleStarred} from '../learning/collections.js';
const ic=(name,size=20)=>raw(icon(name,{size}));
const LEVELS=['A1','A2','B1','B2','C1','C2'];
const TOPICS=[['general','A little of everything'],['introductions','Getting to know each other'],['cafe','At the café'],['travel','Travel & directions'],['day','My day'],['plans','Making plans'],['work','Work & study'],['opinions','Ideas & opinions']];
const SUPPORT=[['guided','Choose words'],['cloze','Complete a reply'],['free','Write freely']];
const AGREEMENT=[['masculine','Masculine'],['feminine','Feminine'],['flexible','Ask when needed']];
const CORRECTION=[['natural','Correct naturally & continue'],['pause','Pause & explain'],['afterward','Review afterward']];
const REGISTERS=[['informal','Tu · informal'],['formal','Lei · polite']];
const MODES=[['conversation','Conversation'],['coach','Dialogue Coach']];
const CASE_NAMES={present:'Present',past:'Completed past',background:'Imperfetto',future:'Future',condizionale:'Conditional'};
const partnerNames=['Giulia','Marco','Sofia'];
let viewportOwner=null;
const threadHref=id=>'#/conversations/'+encodeURIComponent(id);
const label=(options,value)=>options.find(([id])=>id===value)?.[1]||value;
const verifiedCorrections=(turn,summary)=>(turn.correctionRefs||[]).flatMap(correction=>{
 const item=summary?.items?.find(item=>item.kind==='correction'&&!item.invalidated&&item.ruleId===correction.ruleId&&item.original===correction.original&&item.replacement===correction.replacement&&item.sourceRefs.some(ref=>ref.turnId===correction.sourceTurnId&&ref.revision===correction.sourceTurnRevision));
 return item?[{replacement:item.replacement,reason:item.explanation}]:[];
});
function spellingNote(turn,related=[]){
 if(turn.role!=='learner')return '';
 const candidates=[...related].reverse();
 // Retain already saved notes from earlier development/imported records too.
 if(turn.sourceContext?.inputSpelling)candidates.push({receipt:turn.sourceContext.inputSpelling,applied:turn.sourceContext.inputSpellingRevision});
 const note=candidates.find(({receipt})=>{
  const source=receipt?.source?.inputSubmission,policy=source?.policySnapshot,origin=source?.inputProvenance;
  if(receipt?.version!==1||!['restore-display','spelling-feedback'].includes(receipt?.outcome)||typeof receipt.candidateNFC!=='string'||typeof source?.displayText!=='string'||typeof source.originalText!=='string'||source.turnId!==turn.turnId||
   receipt.inputOrigin!=='typed'||!['written','typed'].includes(origin?.mode)||Object.hasOwn(origin,'recognizedText')||Object.hasOwn(origin,'transcriptEdits')||origin.recognitionUncertain===true||
   policy?.version!=='conversation-v1'||policy.strictAccents!==(receipt.outcome==='spelling-feedback')||
   receipt.assessment!=='spelling-display-only'||receipt.masteryAwarded!==false||
   receipt.originalNFC!==source.originalText.normalize('NFC')||receipt.baseNFC!==source.displayText.normalize('NFC')||receipt.candidateNFC!==receipt.candidateNFC.normalize('NFC')||
   receipt.effectiveText!==(receipt.outcome==='restore-display'?receipt.candidateNFC:source.displayText)||
   foldItalianAccents(receipt.candidateNFC)!==foldItalianAccents(source.displayText.normalize('NFC')))return false;
  // An imported note is historical data. Check its internally reproducible
  // spelling facts before presenting it; it cannot authorize a new correction.
  const comparison=compareSubmission(source.displayText,receipt.candidateNFC,{accentStrict:policy.strictAccents,inputMode:'typed',language:'it',trailingPunctuation:false});
  if(comparison.matchKind!=='accent-only'||!comparison.accentDifferences.length||
   sourceFingerprint(receipt.comparison)!==sourceFingerprint(comparison)||
   sourceFingerprint(receipt.differences)!==sourceFingerprint(comparison.accentDifferences))return false;
  return [turn,...(turn.history||[])].some(prior=>sourceFingerprint(source)===sourceFingerprint(Object.fromEntries(
   ['turnId','revision','originalText','submittedText','displayText','policySnapshot','inputProvenance'].map(key=>[key,prior[key]??null]))));
 });
 if(!note)return '';
 const {receipt,applied}=note,source=receipt.source.inputSubmission;
 const current=applied===turn.revision&&turn.displayText===(receipt.outcome==='restore-display'?receipt.effectiveText:source.displayText);
 const title=current?(receipt.outcome==='restore-display'?'Accent added':'A spelling note'):'Earlier spelling note';
 // Saved/imported receipts explain a recorded check. They are history, never
 // authority to rewrite or grade another message. Strict notes live with the
 // partner reply, so an unchanged learner message retains its chosen senses.
 return html`<details class="conversation-correction conversation-spelling" data-spelling-note><summary>${title}</summary><p lang="it">${receipt.candidateNFC}</p><p class="small muted">${current&&receipt.outcome==='spelling-feedback'?'Strict accents was on when you sent this message.':'Your original message is kept.'}</p><p class="small muted">You wrote: <span lang="it">${source.displayText}</span></p></details>`;
}
function spellingNotes(turns){
 const related=new Map();
 for(const partner of turns){
  const receipt=partner.role==='partner'&&partner.sourceContext?.inputSpelling,id=receipt?.source?.inputSubmission?.turnId;
  if(!id)continue;if(!related.has(id))related.set(id,[]);
  related.get(id).push({receipt,applied:partner.sourceContext.inputSpellingSourceRevision});
 }
 return new Map(turns.filter(turn=>turn.role==='learner').map(turn=>[turn.turnId,spellingNote(turn,related.get(turn.turnId))]));
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1000);}

function setupSheet({initial,onSave,title='New conversation'}){
 let values={name:store.current.name==='Learner'?'':store.current.name,mode:'conversation',goal:'',level:store.settings.level||'A1',topic:'general',agreement:'flexible',support:'guided',correctionStyle:'natural',register:'informal',participants:[{id:'partner-1',name:'Giulia',active:true}],...initial};
 const panel=sheet('',{title});
 const rows=[['mode','Practice style',MODES],['level','Italian level',LEVELS.map(l=>[l,l])],['topic','Topic',TOPICS],['agreement','Agreement for me',AGREEMENT],['support','Reply support',SUPPORT],['correctionStyle','Corrections',CORRECTION],['register','How we address each other',REGISTERS]];
 const activeCount=()=>values.participants.filter(p=>p.active!==false).length;
 function draw(){panel.body.innerHTML=html`<form class="conversation-setup"><label class="conversation-name">Your name<input name="name" maxlength="100" autocomplete="given-name" value="${values.name}" placeholder="What should we call you?"></label>
  ${raw(rows.map(([key,title,options])=>html`<button type="button" class="conversation-setting" data-setting="${key}" aria-haspopup="menu"><span><small>${title}</small><strong>${label(options,values[key])}</strong></span>${ic('chevronDown')}</button>`).join(''))}
  ${values.mode==='coach'?raw(html`<label class="conversation-name">What would you like to practise?<input name="goal" maxlength="200" value="${values.goal||''}" placeholder="For example, describe my day"></label>`):''}
  <div class="conversation-setting"><span><small>Participants</small><strong>You + ${activeCount()}</strong></span><div class="conversation-counter"><button type="button" data-count="-1" aria-label="One fewer partner" ${activeCount()===1?'disabled':''}>${ic('minus')}</button><span aria-live="polite">${activeCount()}</span><button type="button" data-count="1" aria-label="One more partner" ${activeCount()===3?'disabled':''}>${ic('plus')}</button></div></div>
  <p class="small muted">Messages and study notes stay on this device. Voice recordings are saved only when you choose.</p><button class="btn primary block" type="submit">${initial?'Save preferences':'Start conversation'}</button><p class="conversation-form-error" role="alert"></p></form>`;}
 draw();
 panel.body.addEventListener('input',event=>{if(['name','goal'].includes(event.target.name))values[event.target.name]=event.target.value;});
 panel.body.addEventListener('click',event=>{
  const button=event.target.closest('[data-setting]');if(button){const row=rows.find(r=>r[0]===button.dataset.setting);dropdown(button,row[2].map(([value,title])=>({value,label:title,selected:values[row[0]]===value})),{onSelect:value=>{values[row[0]]=value;draw();panel.body.querySelector(`[data-setting="${row[0]}"]`)?.focus({preventScroll:true});}});}
  const count=event.target.closest('[data-count]');if(count){const direction=Number(count.dataset.count),length=Math.max(1,Math.min(3,activeCount()+direction));values.participants=Array.from({length:Math.max(length,values.participants.length)},(_,i)=>({...values.participants[i],id:values.participants[i]?.id||'partner-'+(i+1),name:values.participants[i]?.name||partnerNames[i],active:i<length}));draw();(panel.body.querySelector(`[data-count="${direction}"]:not(:disabled)`)||panel.body.querySelector('[data-count]:not(:disabled)'))?.focus({preventScroll:true});}
 });
 panel.body.addEventListener('submit',async event=>{event.preventDefault();const button=panel.body.querySelector('[type=submit]');button.disabled=true;try{await onSave(values);panel.close();}catch(error){panel.body.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}});
 return panel;
}

export async function render(root,params={}){
 const ownsRender=captureViewOwnership(root,{identity:false}),ownsIdentity=captureViewOwnership(root),viewportToken={};
 const owner={profileId:store.current.id,learnerId:store.current.learnerId};let alive=true,studyViewActive=true,studySerial=0,controller=null,viewport=null,words=null,openSummary=null,openStudy=null,speechSession=null,speechLease=null,speechLoading=null,speechEdits=Promise.resolve(),voiceOpen=false,voiceState=null,recordingTimer=null,recordingStarted=0,offProvider=()=>{},spokenFeedback=null,spokenContinuation=null;
 const current=()=>alive&&store.current?.id===owner.profileId&&store.current?.learnerId===owner.learnerId;
 let playerLoaded=!params.id;
 const interactions=new AbortController(),visible=()=>studyViewActive&&current()&&ownsIdentity(),interactive=()=>visible()&&playerLoaded;
 const savedAudioPlayer=createTemporaryAudioPlayer();
 const repository=createConversationRepository({...owner,isCurrent:current});
 const offProfile=store.on('profile',()=>{if(!current()||!ownsIdentity()){const returnToHub=studyViewActive&&ownsRender();disposeView();if(returnToHub)navigate('#/conversations',{replace:true});}});
 const cleanup=()=>{if(!studyViewActive)return;const owned=ownsRender();studyViewActive=false;window.removeEventListener('hashchange',leave);studySerial++;interactions.abort();offProfile();offProvider();clearInterval(recordingTimer);openStudy?.close();void savedAudioPlayer.stop();void speechSession?.dispose().finally(()=>speechLease?.release?.());words?.destroy();viewport?.destroy();openSummary?.close();if(owned)stopSpeech();if(controller)void controller.dispose().finally(()=>{alive=false;});else{alive=false;repository.close();}};
 let disposeView=cleanup;
 const leave=()=>{if(!ownsRender())disposeView();};
 window.addEventListener('hashchange',leave);
 // The repository remains current while disposal flushes the pending draft;
 // interaction listeners and UI publication stop as soon as the view closes.
 const attempt=fn=>Promise.resolve().then(()=>interactive()?fn():undefined).catch(error=>{if(visible()&&error.name!=='AbortError')toast(error.message,{kind:'ko',ms:5000});});
 async function exportThread(threadId){const text=await exportConversationJSON(repository,{threadId});if(visible())download(text,'parola-conversations.json');}
 function threadMenu(anchor,thread,refresh){
  dropdown(anchor,[{value:'rename',label:'Rename'},{value:'archive',label:thread.archived?'Move to conversations':'Archive'},{value:'export',label:'Export transcript & notes'},{value:'delete',label:'Delete conversation'}],{onSelect:value=>void attempt(async()=>{
   if(value==='export'){await exportThread(thread.threadId);return;}
   if(value==='rename'){const title=await promptDialog('Conversation name',{value:thread.title});if(!title||!visible())return;await repository.updateThread(thread.threadId,{title},{expectedRevision:thread.revision});}
   if(value==='archive')await repository.updateThread(thread.threadId,{archived:!thread.archived},{expectedRevision:thread.revision});
   if(value==='delete'){if(!await confirmDialog('Delete this conversation, notes and saved recordings from this device? Any unfinished backup import containing it will also be cancelled.',{ok:'Delete',danger:true})||!visible())return;await repository.deleteThread(thread.threadId);}
   await refresh();
  })});
 }
 if(!params.id){
  setTitle('Conversations');let archived=false,threads=[],drawSerial=0;
  async function draw(){const serial=++drawSerial,next=await repository.list({archived});if(!visible()||serial!==drawSerial)return;threads=next;root.innerHTML=html`<div class="conversations-hub"><section class="conversation-intro"><span class="kicker">A little Italian, every day</span><h1>Parliamo.</h1><p>Make conversation. Find your words. Pick it up again whenever you like.</p><button type="button" class="btn primary block" data-new-conversation>${ic('plus')}New conversation</button></section>
   <div class="conversation-list-heading"><h2>${archived?'Archived':'Your conversations'}</h2><button type="button" class="btn ghost sm" data-archived>${archived?'Show current':'Archive'}</button></div>
   <div class="conversation-list">${threads.length?raw(threads.map(thread=>html`<article class="conversation-row"><a href="${threadHref(thread.threadId)}" class="conversation-row-main"><span class="conversation-avatar" aria-hidden="true">${thread.setup.participants.map(p=>p.name[0]).join('')}</span><span><strong>${thread.title}</strong><small>${thread.setup.level} · ${thread.setup.participants.map(p=>p.name).join(', ')}</small><time datetime="${new Date(thread.updatedAt).toISOString()}">${new Date(thread.updatedAt).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</time></span></a><button type="button" class="conversation-icon" data-menu="${thread.threadId}" aria-label="Options for ${thread.title}">${ic('dots')}</button></article>`).join('')):raw('<p class="conversation-empty">Your conversations will stay here, ready to resume.</p>')}</div>
   <div class="conversation-data"><button class="btn ghost" data-export-all>Export conversations</button><button class="btn ghost" data-import-conversations>Import conversations</button><input type="file" accept="application/json,.json" data-conversation-file hidden></div></div>`;}
  root.addEventListener('click',event=>{
   if(!visible())return;
   if(event.target.closest('[data-new-conversation]'))setupSheet({onSave:async setup=>{if(!visible())throw new DOMException('The conversation changed.','AbortError');const thread=await repository.createThread(setup,{title:label(TOPICS,setup.topic)});if(visible())navigate(threadHref(thread.threadId));}});
   if(event.target.closest('[data-archived]')){archived=!archived;void attempt(draw);}
   const button=event.target.closest('[data-menu]');if(button){const thread=threads.find(t=>t.threadId===button.dataset.menu);if(thread)threadMenu(button,thread,draw);}
   if(event.target.closest('[data-export-all]'))void attempt(()=>exportThread(null));
   if(event.target.closest('[data-import-conversations]'))root.querySelector('[data-conversation-file]').click();
  },{signal:interactions.signal});
  root.addEventListener('change',event=>{const file=event.target.closest('[data-conversation-file]')?.files[0];if(file)void attempt(async()=>{await importConversationJSON(repository,await file.text(),{mode:'merge'});await draw();if(visible())toast('Conversations imported',{kind:'ok'});});},{signal:interactions.signal});
  try{await draw();}catch(error){cleanup();throw error;}return cleanup;
 }
 try{if(!data.loaded)await loadData();}catch(error){cleanup();throw error;}if(!visible())return cleanup;
 setChrome({tabs:false});setTitle('Conversation');
 const threadId=params.id,entries=[...data.byId.values()],lookup=createSentenceLookup({vocab:entries.filter(e=>e.kind!=='verb'),verbs:entries.filter(e=>e.kind==='verb')});
 let paintedRevision=-1,paintedDraftId=null,renderedState=null,keyboardVisible=false,recoveredDraftPending=false,replySupport=null,supportKey='',initialPresentation=null;
 root.innerHTML=html`<div class="conversation-player"><header class="conversation-toolbar"><a href="#/conversations" class="conversation-icon" aria-label="All conversations">${ic('back')}</a><div data-conversation-heading></div><button type="button" class="conversation-icon" data-summary aria-label="Conversation summary">${ic('book')}</button><button type="button" class="conversation-icon" data-conversation-menu aria-label="Conversation preferences">${ic('dots')}</button></header>
  <div class="conversation-messages" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" data-messages></div>
  <div class="conversation-status" role="status" data-conversation-status></div><form class="conversation-composer"><div class="conversation-composer-assistance"><div data-conversation-support></div><div data-speech-controls hidden></div></div><label class="sr-only" for="conversation-draft">Your message in Italian</label><div class="conversation-compose-row"><textarea id="conversation-draft" data-conversation-draft rows="2" maxlength="4000" lang="it" placeholder="Scrivi in italiano…" enterkeyhint="send"></textarea><button type="submit" class="conversation-send" aria-label="Send message">${ic('arrow')}</button></div><div class="conversation-composer-tools"><button type="button" class="btn ghost sm" data-help>Help me reply</button><button type="button" class="conversation-icon" data-voice aria-label="Conversation voice modes" aria-expanded="false">${ic('ear')}</button><button type="button" class="conversation-icon" data-keyboard aria-label="Show keyboard" aria-expanded="false">${ic('chevronUp')}</button></div></form></div>`;
 const draft=root.querySelector('[data-conversation-draft]'),messages=root.querySelector('[data-messages]'),status=root.querySelector('[data-conversation-status]'),send=root.querySelector('[type=submit]');
 // Wait for the saved draft's revision before accepting edits. Otherwise a
 // first keystroke can race the read and create an unnecessary recovery conflict.
 root.querySelectorAll('button,input,textarea').forEach(control=>{control.disabled=true;control.dataset.awaitConversation='';});
 status.textContent='Opening saved conversation…';
 viewport=mountActivityViewport(root,{panelSelector:'.conversation-messages'});document.body.classList.add('conversation-viewport');viewportOwner=viewportToken;
 words=createSentencePanel(root,{backLabel:'Back to the conversation'});
 const originalCleanup=cleanup;
 const dispose=()=>{if(viewportOwner===viewportToken){viewportOwner=null;document.body.classList.remove('conversation-viewport');}document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pause);originalCleanup();};disposeView=dispose;
 function draw({state,busy,error,recoveryConflict,readiness,replySupport:support}){
  if(!visible()||!state)return;
  if(!playerLoaded){initialPresentation={state,busy,error,recoveryConflict,readiness,replySupport:support};return;}
  renderedState=state;recoveredDraftPending=!!recoveryConflict;setTitle(state.thread.title);
  root.querySelector('[data-conversation-heading]').innerHTML=html`<strong>${state.thread.setup.participants.filter(p=>p.active!==false).map(p=>p.name).join(', ')}</strong><span>${state.thread.setup.level} · ${label(SUPPORT,state.thread.setup.support)}</span>`;
  if(paintedRevision!==state.thread.contentRevision){
   const atEnd=messages.scrollHeight-messages.scrollTop-messages.clientHeight<90,notes=spellingNotes(state.turns);
   messages.innerHTML=state.turns.length?state.turns.map(turn=>turn.role==='system'?html`<p class="conversation-system-event" data-turn="${turn.turnId}">${turn.displayText}</p>`:html`<article class="conversation-message ${turn.role}" data-turn="${turn.turnId}"><div class="conversation-message-author">${turn.role==='learner'?state.thread.setup.name||'You':state.thread.setup.participants.find(p=>p.id===turn.participantId)?.name||'Conversation'}</div><p lang="it" data-italian-sentence>${turn.displayText}</p>${turn.history?.some(prior=>!['accent-restoration','accent-feedback','meaning-selection'].includes(prior.editReason))?raw('<span class="conversation-edited">Edited · original kept</span>'):''}${raw(notes.get(turn.turnId)||'')}
    ${state.thread.setup.correctionStyle!=='afterward'?raw(verifiedCorrections(turn,state.summary).map(c=>html`<details class="conversation-correction" ${state.thread.setup.correctionStyle==='pause'?'open':''}><summary>A little Italian tip</summary><p lang="it">${c.replacement}</p><p>${c.reason}</p></details>`).join('')):''}
    <div class="conversation-message-tools">${turn.inputProvenance?.recognizedText?raw(html`<button type="button" data-transcript-info="${turn.turnId}" aria-label="View original speech transcript">${ic('ear',17)}</button>`):''}${turn.recordingRefs?.length?raw(html`<button type="button" data-saved-recording="${turn.turnId}" aria-label="Play your saved recording">${ic('play',17)}</button>`):''}<button type="button" data-hear="${turn.turnId}" aria-label="Hear this message">${ic('speaker',17)}</button><button type="button" data-note="${turn.turnId}" aria-label="Add a note to this message">${ic('book',17)}</button>${turn.role==='learner'?raw(html`<button type="button" data-edit="${turn.turnId}" aria-label="Edit your message">${ic('edit',17)}</button>`):''}</div></article>`).join(''):html`<div class="conversation-welcome"><span class="conversation-avatar">${state.thread.setup.participants.map(p=>p.name[0]).join('')}</span><h2>${state.thread.title}</h2><p>Ready when you are.</p><button type="button" class="btn primary" data-start-dialogue>Say hello</button></div>`;
   words.decorate();if(atEnd||paintedRevision<0)messages.scrollTop=messages.scrollHeight;paintedRevision=state.thread.contentRevision;
  }
  if(paintedDraftId!==state.draft?.turnId&&document.activeElement!==draft){draft.value=state.draft?.typedText||'';paintedDraftId=state.draft?.turnId||null;}
  status.textContent=error||(busy?'Thinking…':readiness.written?'Saved on this device':readiness.reason);
  status.classList.toggle('has-error',!!error);send.disabled=busy||!draft.value.trim()||!readiness.written;
  draft.readOnly=!!recoveryConflict;if(recoveryConflict){status.textContent='Another unsent draft was recovered. Save it before continuing.';send.disabled=true;const button=document.createElement('button');button.type='button';button.className='btn ghost sm';button.dataset.recoveredDraft='';button.textContent='View recovered draft';status.append(button);}
  const start=root.querySelector('[data-start-dialogue]');if(start)start.disabled=busy||!readiness.written;
  if(error&&readiness.written){const retry=document.createElement('button');retry.type='button';retry.className='btn ghost sm';retry.textContent='Try again';retry.dataset.retryReply='';status.append(retry);}
  replySupport=support;const nextSupportKey=JSON.stringify([state.thread.setup.support,support]);if(nextSupportKey!==supportKey){supportKey=nextSupportKey;const host=root.querySelector('[data-conversation-support]');host.innerHTML=support?html`<div class="conversation-reply-support"><span class="kicker">A suggestion · make it yours</span><p lang="it">${support.prefix}<strong>…</strong>${support.suffix}</p>${state.thread.setup.support==='cloze'?raw('<button type="button" class="btn ghost sm" data-reply-options aria-expanded="false">Show word choices</button>'):''}<div class="conversation-support-choices" ${state.thread.setup.support==='cloze'?'hidden':''}>${raw(support.choices.map((choice,index)=>html`<button type="button" class="chip" data-reply-choice="${index}" lang="it">${choice.surface}</button>`).join(''))}</div><div class="conversation-support-own"><input data-reply-own lang="it" maxlength="100" aria-label="Your own word or phrase" placeholder="Or use your own word…"><button type="button" class="btn ghost sm" data-reply-use-own>Use my word</button><button type="button" class="btn ghost sm" data-dismiss-support>Write freely</button></div></div>`:'';}
  root.querySelectorAll('[data-reply-choice],[data-reply-use-own]').forEach(button=>button.disabled=busy||recoveredDraftPending);
  drawSpeech();
 }
 controller=createConversationController({repository,threadId,isCurrent:current,lookup,resolveEntry:id=>data.byId.get(id),resolveRule:resolveConversationRule,onChange:draw,onReply:turn=>{if(visible()&&!document.hidden&&voiceState?.state!=='sending')speak(turn.displayText);}});
 const pause=()=>{if(visible())stopSpeech();void savedAudioPlayer.stop();void speechSession?.pause().catch(()=>{});void controller.cancel().catch(()=>{});},visibility=()=>{if(document.hidden)pause();};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pause);
 draft.addEventListener('input',()=>{if(!interactive())return;send.disabled=controller.busy||!draft.value.trim()||!conversationReadiness().written;if(voiceState?.draft&&['review','editing'].includes(voiceState.state)){const text=draft.value;speechEdits=speechEdits.catch(()=>{}).then(()=>speechSession.edit(text));void speechEdits.catch(()=>{});}else void controller.saveDraft(draft.value).catch(()=>{});});
 draft.addEventListener('focus',()=>{if(!interactive())return;keyboardVisible=true;root.querySelector('[data-keyboard]').setAttribute('aria-expanded','true');root.querySelector('[data-keyboard]').setAttribute('aria-label','Hide keyboard');});
 draft.addEventListener('blur',()=>{if(!interactive())return;keyboardVisible=false;root.querySelector('[data-keyboard]').setAttribute('aria-expanded','false');root.querySelector('[data-keyboard]').setAttribute('aria-label','Show keyboard');});
 root.querySelector('form').addEventListener('submit',event=>{event.preventDefault();void attempt(async()=>{if(!conversationReadiness().written)return;if(voiceState?.draft){await speechEdits;if(!visible())return;if(voiceState.state==='paused')speechSession.restoreDraft();if(voiceState.draft.recognitionUncertain)await speechSession.confirm();if(!visible())return;draft.blur();await speechSession.send();}else{await controller.saveDraft(draft.value);if(!visible())return;draft.blur();await controller.send({strictAccents:store.settings.accentStrict===true});}if(visible()&&!controller.state.draft){draft.value='';paintedDraftId=null;}});});
 function drawSpeech(){
  if(!visible())return;
  const controls=root.querySelector('[data-speech-controls]');if(!controls)return;controls.hidden=!voiceOpen;root.querySelector('[data-voice]').setAttribute('aria-expanded',String(voiceOpen));if(!voiceOpen)return;
  const s=voiceState||{state:'idle'},ready=s.readiness||conversationReadiness(),recording=['recording','listening'].includes(s.state),pending=['starting','finishing','transcribing','sending','speaking','replaying','editing'].includes(s.state);
  const names={starting:'Starting microphone…',recording:'Recording',listening:'Listening · pause when you finish',finishing:'Finishing recording…',transcribing:'Finding your words…',review:s.draft?.recognitionUncertain?'Please check the transcript before sending':'Ready to send',sending:'Thinking…',speaking:'Your partner is speaking',replaying:'Playing your recording',editing:'Saving your transcript…','reply-needed':'Your message is saved. Retry your partner’s reply.',paused:'Paused · microphone off',idle:'Microphone off',error:s.error||'Speech paused'};
  controls.innerHTML=html`<div class="conversation-speech-status"><span role="status">${names[s.state]||'Microphone off'}</span>${recording?raw('<time data-recording-time>0:00</time>'):''}<button type="button" class="conversation-icon" data-speech-close aria-label="Close voice controls">${ic('chevronDown',18)}</button></div><div class="conversation-speech-actions">${recording||pending?raw(html`${s.state==='recording'?raw('<button type="button" class="btn secondary sm" data-speech-stop>Stop recording</button>'):''}<button type="button" class="btn ghost sm" data-speech-pause>Pause</button>`):raw(html`<button type="button" class="btn secondary sm" data-speech-record ${!ready.recorded?'disabled':''}>${s.draft?'Record again':'Record a reply'}</button><button type="button" class="btn ghost sm" data-speech-continuous ${!ready.handsfree?'disabled':''}>Start hands-free</button>${s.state==='reply-needed'?raw('<button type="button" class="btn secondary sm" data-speech-retry>Retry reply</button>'):''}${s.hasTemporaryAudio?raw('<button type="button" class="btn ghost sm" data-speech-replay>Replay</button>'):''}${s.canSaveRecording?raw('<button type="button" class="btn ghost sm" data-speech-save>Save recording</button>'):''}`)}</div>${!ready.recorded?raw(html`<p class="small muted">${ready.reason||'Recorded replies need a verified offline speech pack.'}</p>`):''}`;
  if(spokenContinuation){controls.querySelector('[role=status]').textContent='A little correction · microphone off';const button=document.createElement('button');button.type='button';button.className='btn secondary sm';button.dataset.spokenContinue='';button.textContent='Continue conversation';controls.querySelector('.conversation-speech-actions').prepend(button);}
  draft.readOnly=recording||pending||recoveredDraftPending;
  if(s.draft&&document.activeElement!==draft)draft.value=s.draft.text;
  send.disabled=controller.busy||!draft.value.trim()||!conversationReadiness().written||recording||pending||recoveredDraftPending;
 }
 function speechChanged(next){
  if(!visible())return;
  const wasRecording=['recording','listening'].includes(voiceState?.state),recording=['recording','listening'].includes(next.state);voiceState=next;
  if(recording&&!wasRecording){recordingStarted=Date.now();clearInterval(recordingTimer);recordingTimer=setInterval(()=>{const time=root.querySelector('[data-recording-time]');if(time){const seconds=Math.floor((Date.now()-recordingStarted)/1000);time.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}},1000);}else if(!recording){clearInterval(recordingTimer);recordingTimer=null;}
  if(!visible())return;
  send.disabled=controller.busy||!draft.value.trim()||!conversationReadiness().written;drawSpeech();
 }
 async function ensureSpeech(){
  if(!interactive())return null;
  if(speechSession)return speechSession;if(speechLoading)return speechLoading;
  speechLoading=(async()=>{const lease=await acquireConversationSpeech({scope:`speech:${owner.profileId}:${owner.learnerId}:${threadId}`,isCurrent:visible});if(!visible()){await lease.release?.();return null;}speechLease=lease;const feedback=createSpokenFeedback({voice:lease.voice,getState:()=>controller.state,isCurrent:visible,onChange:pending=>{if(spokenFeedback===feedback){spokenContinuation=pending;if(visible())drawSpeech();}}});spokenFeedback=feedback;speechSession=createConversationSpeechSession({controller:{get state(){return controller.state;},get busy(){return controller.busy;},get error(){return controller.error;},saveDraft:(...args)=>controller.saveDraft(...args),send:()=>controller.send({strictAccents:store.settings.accentStrict===true}),reply:()=>controller.reply(),cancel:()=>controller.cancel()},repository,threadId,isCurrent:visible,speech:{...lease,voice:feedback},onChange:speechChanged});speechSession.restoreDraft();speechChanged(speechSession.snapshot);return speechSession;})();
  try{return await speechLoading;}finally{speechLoading=null;}
 }
 offProvider=onConversationProviderChange(()=>{if(!visible())return;const old=speechSession,lease=speechLease;speechSession=null;speechLease=null;voiceState=null;spokenFeedback=null;spokenContinuation=null;replySupport=null;supportKey='';root.querySelector('[data-conversation-support]').innerHTML='';void old?.dispose().finally(()=>lease?.release?.());if(visible()&&controller.state)draw({state:controller.state,busy:controller.busy,error:controller.error,recoveryConflict:recoveredDraftPending,readiness:conversationReadiness(),replySupport:null});});
 async function showSummary(){
  if(!visible())return;
  const state=controller.state,items=state.summary?.items||[],practiceIds=[...new Set(items.filter(item=>item.kind==='vocabulary').map(item=>item.entryId))];openSummary?.close();
  openSummary=sheet(html`<div class="conversation-summary"><p class="small muted">Words, verb forms and notes from this conversation. Meeting a word here does not mark it learned.</p>${practiceIds.length?raw('<button type="button" class="btn primary block" data-practice-summary>Practise these words</button>'):''}${items.length?raw(items.map((item,index)=>item.kind==='vocabulary'?html`<article class="conversation-study-item"><div><h3 lang="it">${item.label||item.word}</h3><p>${item.meaning}</p>${item.singular?raw(html`<p class="small muted" lang="it">${item.singular} · ${item.plural||'Plural not recorded'}</p>`):''}${item.caseId?raw(html`<span class="kicker">${CASE_NAMES[item.caseId]||item.caseId}</span>`):''}</div><div class="conversation-study-actions"><a class="btn secondary sm" href="#/entry/${encodeURIComponent(item.entryId)}">Details</a><a class="btn ghost sm" href="#/learn/${item.pos==='verb'?'verb':'word'}/${encodeURIComponent(item.entryId)}?${new URLSearchParams({...(item.caseId?{chapter:item.caseId}:{}),fromConversation:threadId})}">Learn</a><button type="button" class="conversation-icon" data-study-star="${item.entryId}" aria-label="${isStarred(store,item.entryId)?'Unstar':'Star'} ${item.word}" aria-pressed="${isStarred(store,item.entryId)}">${ic('star')}</button><button type="button" class="btn ghost sm" data-study-bank="${item.entryId}">Word bank</button></div><button type="button" class="conversation-source" data-source="${item.sourceRefs[0].turnId}">See in conversation</button></article>`:item.kind==='meaning-choice'?html`<article class="conversation-study-item"><h3>${item.word}</h3><p class="small muted">Choose the meaning in this sentence.</p>${raw(item.candidates.map(c=>html`<button type="button" class="btn ghost sm" data-meaning-item="${item.id}" data-meaning-entry="${c.entryId}">${c.meaning}</button>`).join(''))}<button class="conversation-source" data-source="${item.sourceRefs[0].turnId}">See in conversation</button></article>`:item.kind==='correction'?html`<article class="conversation-study-item"><span class="kicker">A useful correction</span><p lang="it">${item.original} → ${item.replacement}</p><p>${item.explanation}</p><button class="conversation-source" data-source="${item.sourceRefs[0].turnId}">See in conversation</button></article>`:html`<article class="conversation-study-item"><span class="kicker">Your note${item.invalidated?' · source edited':''}</span><p>${item.text}</p><button class="conversation-source" data-source="${item.sourceRefs[0].turnId}">See in conversation</button></article>`).join('')):raw('<p>Your study notes will grow as you talk. Tap any Italian word to look it up.</p>')}</div>`,{title:'Conversation notes'});
  openSummary.body.addEventListener('click',event=>{
   if(!visible())return;
   if(event.target.closest('[data-practice-summary]')){void attempt(async()=>{
    const serial=++studySerial,epochId=store.learning.epoch.id,studyCurrent=()=>visible()&&serial===studySerial&&store.learning.epoch.id===epochId;
    stopSpeech();await speechSession?.pause();await controller.cancel();if(!studyCurrent())return;openSummary.close();openStudy?.close();
    openStudy=await openConversationStudy({repository,threadId,isCurrent:studyCurrent,lookup,resolveEntry:id=>data.byId.get(id),pool:entries,epochId,
     onAssessedAnswer:async({event,source})=>{
      const guard=()=>{if(!studyCurrent()||source.owner.profileId!==owner.profileId||source.owner.learnerId!==owner.learnerId||source.epochId!==epochId)throw new DOMException('The learner changed.','AbortError');};guard();
      const latest=await repository.read(threadId),turn=latest.turns.find(t=>t.turnId===source.turnId);guard();
      if(turn?.revision!==source.revision||turn.displayText.slice(source.start,source.end)!==source.quote)throw new Error('The study sentence changed. Choose it again.');
      const existing=store.learning.events[event.id];
      if(existing&&(existing.contextId!==event.contextId||existing.variantId!==event.variantId||existing.objectiveId!==event.objectiveId||existing.epochId!==epochId))throw new Error('This saved practice belongs to a different answer. Choose the words again.');
      const recorded=store.recordLearningAttempt(event);await store.saveNow();guard();return recorded;
     }});
    if(!studyCurrent())openStudy.close();
   });return;}
   const source=event.target.closest('[data-source]');if(source){openSummary.close();messages.querySelector(`[data-turn="${CSS.escape(source.dataset.source)}"]`)?.scrollIntoView({block:'center',behavior:'instant'});}
   const meaning=event.target.closest('[data-meaning-item]');if(meaning)void attempt(async()=>{await controller.chooseMeaning(meaning.dataset.meaningItem,meaning.dataset.meaningEntry);await showSummary();});
   const star=event.target.closest('[data-study-star]');if(star){const on=toggleStarred(store,star.dataset.studyStar);star.setAttribute('aria-pressed',String(on));star.setAttribute('aria-label',on?'Unstar this word':'Star this word');}
   const bank=event.target.closest('[data-study-bank]');if(bank){store.addToList('bank',bank.dataset.studyBank);void store.saveNow().then(()=>{if(visible())toast('Added to your word bank',{kind:'ok'});}).catch(error=>{if(visible())toast(error.message,{kind:'ko'});});}
  });
 }
 root.addEventListener('click',event=>void attempt(async()=>{
  if(event.target.closest('[data-recovered-draft]')){const text=controller.recoverText(),panel=sheet(html`<p>This unsent text differs from the saved draft. Keep a copy before choosing which text to use.</p><textarea class="conversation-recovered-text" readonly rows="6" aria-label="Recovered draft">${text}</textarea><button type="button" class="btn primary block" data-save-recovered>Download recovered text</button><button type="button" class="btn ghost block" data-keep-current>Keep the saved draft</button>`,{title:'Recovered draft'});panel.body.addEventListener('click',e=>{if(e.target.closest('[data-save-recovered]'))download(JSON.stringify({conversation:threadId,unsentText:text}),'parola-recovered-draft.json');if(e.target.closest('[data-keep-current]')){controller.dismissRecoveredDraft();panel.close();}});return;}
  if(event.target.closest('[data-keyboard]')){if(keyboardVisible)draft.blur();else draft.focus();return;}
  if(event.target.closest('[data-start-dialogue]')){await controller.reply({opening:true});return;}
  if(event.target.closest('[data-retry-reply]')){await controller.reply({opening:!controller.state.turns.length});return;}
  if(event.target.closest('[data-summary]')){await showSummary();return;}
  if(event.target.closest('[data-help]')){if(!conversationReadiness().written){sheet(html`<p>${conversationReadiness().reason}</p><p>Tap a word in a message to see its meaning and forms. Your conversation notes stay available while writing.</p>`,{title:'A little help'});return;}await controller.help();return;}
  if(event.target.closest('[data-reply-options]')){const button=event.target.closest('[data-reply-options]');root.querySelector('.conversation-support-choices').hidden=false;button.setAttribute('aria-expanded','true');button.hidden=true;return;}
  if(event.target.closest('[data-dismiss-support]')){root.querySelector('[data-conversation-support]').innerHTML='';draft.focus();return;}
  const replyChoice=event.target.closest('[data-reply-choice]'),ownChoice=event.target.closest('[data-reply-use-own]');
  if(replyChoice||ownChoice){
   if(!replySupport||replySupport.sourceRevision!==controller.state.thread.contentRevision)throw new Error('Ask for a fresh reply suggestion.');
   const chosen=replyChoice?replySupport.choices[Number(replyChoice.dataset.replyChoice)]?.surface:root.querySelector('[data-reply-own]')?.value.trim();if(!chosen)return;
   const text=replySupport.prefix+chosen+replySupport.suffix;
   if(draft.value.trim()&&draft.value!==text&&!await confirmDialog('Replace your unsent draft with this suggestion? You can edit it before sending.',{ok:'Use suggestion'}))return;
   if(!visible())return;await speechSession?.pause();if(!visible())return;voiceState=null;const help={type:ownChoice?'reply-frame-own-word':'reply-frame-choice',partnerTurnId:replySupport.partnerTurnId,policyVersion:replySupport.policyVersion};
   await controller.saveDraft(text,{mode:'written',selectedHelp:[...(controller.state.draft?.selectedHelp||[]),help],inputProvenance:{mode:'written',assistance:[help],generatedSupport:true}});if(!visible())return;draft.value=text;send.disabled=controller.busy||!conversationReadiness().written;draft.focus();return;
  }
  if(event.target.closest('[data-voice]')){voiceOpen=true;drawSpeech();if(conversationReadiness().recorded)await ensureSpeech();return;}
  if(event.target.closest('[data-speech-close]')){voiceOpen=false;const previous=speechSession,lease=speechLease;speechSession=null;speechLease=null;voiceState=null;await previous?.dispose();await lease?.release?.();if(!visible())return;draft.readOnly=recoveredDraftPending;drawSpeech();return;}
  if(event.target.closest('[data-speech-record]')||event.target.closest('[data-speech-continuous]')){const speech=await ensureSpeech();if(!speech)return;const hasDraft=!!controller.state.draft?.typedText.trim();if(hasDraft&&!await confirmDialog('Replace this unsent draft with a new recording?',{ok:'Record again'}))return;if(!visible())return;stopSpeech();draft.blur();if(event.target.closest('[data-speech-continuous]'))await speech.startHandsfree({replaceDraft:hasDraft});else await speech.startManual({replaceDraft:hasDraft});return;}
  if(event.target.closest('[data-speech-stop]')){await speechSession?.stopRecording();return;}
  if(event.target.closest('[data-spoken-continue]')){spokenFeedback?.continue();return;}
  if(event.target.closest('[data-speech-pause]')){await speechSession?.pause();return;}
  if(event.target.closest('[data-speech-replay]')){await speechSession?.replay();return;}
  if(event.target.closest('[data-speech-retry]')){await speechSession?.retryReply();return;}
  if(event.target.closest('[data-speech-save]')){await speechSession?.saveRecording({consentAt:Date.now()});paintedRevision=-1;await controller.refresh();if(visible())toast('Recording saved with this message',{kind:'ok'});return;}
  const menu=event.target.closest('[data-conversation-menu]');if(menu){dropdown(menu,[{value:'preferences',label:'Conversation preferences'},{value:'export',label:'Export transcript & notes'},{value:'pause',label:'Pause & return to conversations'}],{onSelect:value=>void attempt(async()=>{if(value==='preferences')setupSheet({initial:controller.state.thread.setup,onSave:async setup=>{if(!visible())return;await speechSession?.pause();if(visible())return controller.configure(setup);},title:'Conversation preferences'});if(value==='export')await exportThread(threadId);if(value==='pause'){await controller.cancel();if(visible())navigate('#/conversations');}})});return;}
  const hear=event.target.closest('[data-hear]');if(hear){await speechSession?.pause();const turn=controller.state.turns.find(t=>t.turnId===hear.dataset.hear);if(turn&&visible())speak(turn.displayText,{force:true});return;}
  const transcript=event.target.closest('[data-transcript-info]');if(transcript){const turn=controller.state.turns.find(t=>t.turnId===transcript.dataset.transcriptInfo);sheet(html`<span class="kicker">Recognised from your voice</span><p lang="it">${turn.inputProvenance.recognizedText}</p><span class="kicker">Message you sent</span><p lang="it">${turn.originalText}</p><p class="small muted">${turn.inputProvenance.recognitionUncertain?'The recogniser was uncertain. This is not counted as a language mistake.':turn.inputProvenance.transcriptEdits?.length?'You edited the transcript before sending.':'The transcript was kept as recognised.'}</p>`,{title:'Your spoken message'});return;}
  const recording=event.target.closest('[data-saved-recording]');if(recording){const turn=controller.state.turns.find(t=>t.turnId===recording.dataset.savedRecording),ref=turn?.recordingRefs?.at(-1);if(!ref)return;const audio=await repository.recording(threadId,ref.audioId);if(!visible())return;if(!audio)throw new Error('This backup contains the transcript, but not the saved recording.');stopSpeech();await speechSession?.pause();if(visible())await savedAudioPlayer.play(audio.blob);return;}
  const edit=event.target.closest('[data-edit]');if(edit){await speechSession?.pause();if(!visible())return;const turn=controller.state.turns.find(t=>t.turnId===edit.dataset.edit),text=await promptDialog('Edit your message',{value:turn.displayText});if(text&&visible())await controller.edit(turn.turnId,text);return;}
  const note=event.target.closest('[data-note]');if(note){const text=await promptDialog('Add a note');if(text&&visible())await controller.addNote(note.dataset.note,text);}
 }),{signal:interactions.signal});
 try{await controller.load();}catch(error){dispose();throw error;}
 if(visible()){
  playerLoaded=true;
  root.querySelectorAll('[data-await-conversation]').forEach(control=>{control.disabled=false;delete control.dataset.awaitConversation;});
  if(initialPresentation)draw(initialPresentation);
 }
 return dispose;
}
