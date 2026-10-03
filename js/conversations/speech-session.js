import {createBrowserPCMCapture} from '../ai/pcm-capture.js';
import {createTemporaryAudioPlayer} from '../ai/temporary-audio.js';

const abortError=()=>new DOMException('The speech session changed.','AbortError');
const pendingStates=['starting','finishing','transcribing','sending','speaking','replaying','editing'];
const copy=value=>value?structuredClone(value):null;
const partnerText=turn=>turn?.role==='partner'&&turn?.turnId&&(turn.displayText||turn.originalText);

/** Scoped foreground speech lifecycle. Its host owns the thread/controller and
 * an installed local speech lease. Adapters do not activate product readiness:
 * the provider must separately pass its model/device/language gates. */
export function createConversationSpeechSession({controller,repository,threadId,isCurrent=()=>true,speech,capture=createBrowserPCMCapture(),replay=createTemporaryAudioPlayer(),onChange=()=>{},environment=globalThis,bindLifecycle=true}={}) {
  if(!controller?.saveDraft||!controller?.send||!controller?.reply||!repository?.saveRecording||typeof threadId!=='string')throw new TypeError('A scoped conversation controller and repository are required.');
  let state='idle',mode='manual',epoch=0,abort=null,closed=false,active=false,draft=null,temporary=null,committedTurnId=null,error=null;
  const current=()=>!closed&&isCurrent();
  const check=token=>{if(!current()||token!==epoch||abort?.signal.aborted)throw abortError();};
  const readiness=()=>{
    const declared=speech?.readiness?.()||{},pcm=capture.supported?.()===true;
    const recorded=pcm&&declared.recognition===true&&declared.voice===true&&typeof speech?.recognizer?.transcribe==='function'&&typeof speech?.voice?.speak==='function'&&typeof speech?.voice?.stop==='function';
    const handsfree=recorded&&declared.vad===true&&typeof speech?.vad?.createSession==='function';
    return{recorded,handsfree,reason:recorded?null:declared.reason||'Install and verify local speech recognition and a local voice on this device.'};
  };
  const snapshot=()=>({state,mode,active,draft:copy(draft),error,hasTemporaryAudio:!!temporary,canSaveRecording:!!temporary&&!!committedTurnId,committedTurnId,readiness:readiness()});
  const publish=()=>{if(current())try{onChange(snapshot());}catch{}};
  const notify=next=>{state=next;publish();};
  const guardAction=()=>{if(!current())throw abortError();if(pendingStates.includes(state))throw new Error('A speech action is already pending.');};
  const reviewAction=()=>{guardAction();if(!draft||!['review','paused','error'].includes(state))throw new Error('No editable speech transcript is available.');if(!abort||abort.signal.aborted)abort=new AbortController();};
  async function stopAdapters(){await Promise.allSettled([Promise.resolve().then(()=>capture.stop()),Promise.resolve().then(()=>speech?.voice?.stop()),Promise.resolve().then(()=>replay.stop())]);}
  async function pause({discardAudio=true,reason='paused'}={}) {
    const token=++epoch,wasSending=state==='sending';active=false;abort?.abort();if(discardAudio){temporary=null;committedTurnId=null;}if(wasSending)controller.cancel?.();await stopAdapters();if(token===epoch&&!closed)notify(reason);
  }
  function extras() {
    const previous=controller.state?.draft||{},selectedHelp=copy(previous.selectedHelp)||[];
    return {mode:mode==='handsfree'?'handsfree':'recorded',recognizedText:draft.recognizedText,transcriptEdits:copy(draft.transcriptEdits),selectedHelp,
      inputProvenance:{mode:mode==='handsfree'?'handsfree':'recorded',recognitionUncertain:draft.recognitionUncertain,recognizedText:draft.recognizedText,transcriptEdits:copy(draft.transcriptEdits),assistance:selectedHelp}};
  }
  async function persist(token){check(token);await controller.saveDraft(draft.text,extras());check(token);}
  async function failed(caught,token){if(caught.name!=='AbortError'&&token===epoch&&current()){error=caught.message;active=false;await stopAdapters();if(token===epoch)notify('error');}throw caught;}
  async function listen(token){check(token);notify('starting');await capture.start({mode:'handsfree',signal:abort.signal,vad:speech.vad,onUtterance:audio=>{if(token===epoch&&active&&state==='listening')processAudio(audio,token).catch(()=>{});},onError:caught=>{failed(caught,token).catch(()=>{});},onLimit:()=>pause({reason:'paused'}).catch(()=>{})});check(token);notify('listening');}
  async function playReply(turn,token){
    check(token);const text=partnerText(turn);if(typeof text!=='string'||!text.trim()){active=false;notify('reply-needed');return;}
    notify('speaking');await speech.voice.speak(text,{signal:abort.signal});check(token);
    if(active&&mode==='handsfree')await listen(token);else notify('idle');
  }
  async function submit(token=epoch){
    check(token);if(!draft?.text?.trim())throw new TypeError('Review the transcript before sending.');if(['sending','speaking'].includes(state))throw new Error('This transcript is already being sent.');
    notify('sending');let result;
    try{result=await controller.send();check(token);
      if(!result||typeof result.committed!=='boolean')throw new Error('Speech requires a durable message result.');
      if(!result.committed){active=false;error=result.error||'The transcript was not sent. Review it and try again.';notify('review');return result;}
      draft=null;if(typeof result.turnId!=='string'||!result.turnId)throw new Error('The saved message identity is missing.');
      committedTurnId=result.turnId;error=result.error||null;
      // A committed learner turn is final even when generation failed. Retain
      // only its temporary audio; Retry below requests a partner reply alone.
      await playReply(result.reply,token);return result;
    }catch(caught){return failed(caught,token);}
  }
  async function processAudio(audio,token){
    check(token);notify('transcribing');await capture.stop();check(token);
    try{if(!(audio?.samples instanceof Float32Array)||!Number.isFinite(audio.sampleRate)||audio.sampleRate<8000||audio.sampleRate>192000||!audio.samples.length||!(audio.blob instanceof Blob)||!Number.isFinite(audio.duration)||audio.duration<=0||audio.duration>120)throw new TypeError('No captured microphone audio is available.');
      temporary=audio;committedTurnId=null;
      const result=await speech.recognizer.transcribe(audio,{signal:abort.signal});check(token);const text=typeof result?.recognizedText==='string'?result.recognizedText.trim():'';
      if(!text){temporary=null;active=false;error='No words were recognised. Record again or type your message.';notify('review');return;}
      if(text.length>4000)throw new Error('The recognised message is too long.');
      draft={text,recognizedText:text,recognitionUncertain:result.uncertain!==false,transcriptEdits:[]};await persist(token);
      if(mode==='manual'||draft.recognitionUncertain){active=false;notify('review');return;}
      await submit(token);
    }catch(caught){return failed(caught,token);}
  }
  async function start(nextMode,{replaceDraft=false}={}) {
    guardAction();const ready=readiness();if(!ready.recorded||nextMode==='handsfree'&&!ready.handsfree)throw new Error(ready.reason||'Handsfree speech requires a verified local voice detector.');
    if(controller.busy)throw new Error('Wait for the current conversation reply.');
    if(controller.state?.draft?.typedText?.trim()&&!replaceDraft)throw new Error('Send or keep the existing draft before recording another message.');
    notify('starting');await pause();if(!current())throw abortError();mode=nextMode;error=null;draft=null;active=true;abort=new AbortController();const token=epoch;
    try{if(mode==='handsfree')await listen(token);else{notify('starting');await capture.start({mode:'manual',signal:abort.signal,onError:caught=>failed(caught,token).catch(()=>{}),onLimit:()=>{if(state==='recording')stopRecording().catch(()=>{});}});check(token);notify('recording');}}catch(caught){return failed(caught,token);}
  }
  async function stopRecording(){if(state!=='recording'||mode!=='manual')throw new Error('Manual recording is not active.');const token=epoch;active=false;notify('finishing');try{const audio=await capture.finish();check(token);await processAudio(audio,token);return copy(draft);}catch(caught){return failed(caught,token);}}
  const hidden=()=>{if(environment.document?.visibilityState==='hidden')pause().catch(()=>{});},pagehide=()=>pause().catch(()=>{});
  if(bindLifecycle){environment.document?.addEventListener('visibilitychange',hidden);environment.addEventListener?.('pagehide',pagehide);}
  return {
    get snapshot(){return snapshot();},
    startManual:options=>start('manual',options),startHandsfree:options=>start('handsfree',options),stopRecording,
    async edit(text){reviewAction();if(typeof text!=='string'||text.length>4000)throw new Error('This transcript is too long.');const token=epoch;notify('editing');const before=draft.text;draft={...draft,text,recognitionUncertain:false,transcriptEdits:[...draft.transcriptEdits,{before,after:text,at:Date.now()}]};try{await persist(token);notify('review');}catch(caught){return failed(caught,token);}},
    // Confirm preserves the recognised spelling while recording explicit learner
    // review. Automatic handsfree Send requires the recognizer's explicit false.
    async confirm(){reviewAction();const token=epoch;notify('editing');draft={...draft,recognitionUncertain:false};try{await persist(token);notify('review');}catch(caught){return failed(caught,token);}},
    async send(){guardAction();if(!draft||!['review','paused','error'].includes(state))throw new Error('Review the transcript before sending.');reviewAction();return submit();},
    async retryReply(){guardAction();if(!committedTurnId)throw new Error('No saved speech message needs a reply.');if(!abort||abort.signal.aborted)abort=new AbortController();const token=epoch;notify('sending');try{const before=new Set((controller.state?.turns||[]).map(turn=>turn.turnId));const result=await controller.reply();check(token);const turn=partnerText(result)?result:result?.reply||[...(controller.state?.turns||[])].reverse().find(turn=>turn.role==='partner'&&!before.has(turn.turnId));error=controller.error||null;await playReply(turn,token);return!!turn;}catch(caught){return failed(caught,token);}},
    restoreDraft(){guardAction();const source=controller.state?.draft;if(!source?.typedText||!['recorded','handsfree'].includes(source.mode))return false;mode=source.mode==='handsfree'?'handsfree':'manual';draft={text:source.typedText,recognizedText:source.recognizedText||source.typedText,recognitionUncertain:source.inputProvenance?.recognitionUncertain!==false,transcriptEdits:copy(source.transcriptEdits)||[]};abort=new AbortController();notify('review');return true;},
    async replay(){guardAction();if(!temporary)throw new Error('This temporary recording is no longer available.');const audio=temporary;await pause({discardAudio:false});abort=new AbortController();const token=epoch;notify('replaying');try{await replay.play(audio.blob,{signal:abort.signal});check(token);notify(draft?'review':committedTurnId?'idle':'paused');}catch(caught){return failed(caught,token);}},
    async saveRecording({consentAt}={}){guardAction();if(!Number.isFinite(consentAt)||consentAt<=0)throw new TypeError('Saving requires an explicit learner choice.');if(!temporary||!committedTurnId)throw new Error('Send this message before choosing Save recording.');const audio=temporary,turnId=committedTurnId,token=epoch;const result=await repository.saveRecording(threadId,turnId,audio.blob,{consentAt,duration:audio.duration});check(token);return result;},
    pause,
    async dispose(){if(closed)return;await pause();closed=true;environment.document?.removeEventListener('visibilitychange',hidden);environment.removeEventListener?.('pagehide',pagehide);state='disposed';draft=null;temporary=null;},
  };
}
