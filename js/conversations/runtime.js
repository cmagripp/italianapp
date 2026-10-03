// The product supplies one measured, installed local provider. Importing the
// conversation interface never downloads a model or substitutes cloud replies.
let provider=null,revision=0;
const listeners=new Set();
const changed=()=>{for(const listener of listeners)try{listener();}catch{}};
export function onConversationProviderChange(listener){listeners.add(listener);return()=>listeners.delete(listener);}
const unavailable={written:false,recorded:false,handsfree:false,reason:'An approved offline conversation pack is not available in this release. Saved conversations remain accessible.'};
export function conversationReadiness(){return provider?{...unavailable,...provider.readiness()}:{...unavailable};}
export function conversationProviderRevision(){return revision;}
export function resolveConversationRule(id){return provider?.resolveRule?.(id)||null;}
export function installConversationProvider(next){
 if(typeof next?.readiness!=='function'||typeof next?.acquire!=='function')throw new TypeError('An installed local conversation provider is required');
 if(provider&&provider!==next)provider.dispose?.();provider=next;const installedRevision=++revision;changed();
 return ()=>{if(provider===next&&revision===installedRevision){provider=null;revision++;next.dispose?.();changed();}};
}
export async function acquireConversationSpeech(context){
 const installed=provider,installedRevision=revision;
 const current=()=>provider===installed&&revision===installedRevision&&context.isCurrent();
 const guard=()=>{if(!current())throw new DOMException('The offline speech pack changed.','AbortError');};
 if(!installed?.readiness().recorded||typeof installed.acquireSpeech!=='function')throw new Error('Recorded replies need a verified offline speech pack.');
 const speech=await installed.acquireSpeech(context);
 if(!current()){await speech?.release?.();guard();}
 if(typeof speech?.recognizer?.transcribe!=='function'||typeof speech?.voice?.speak!=='function'||typeof speech?.voice?.stop!=='function'){await speech?.release?.();throw new Error('The local speech pack could not start.');}
 return {
  readiness(){if(!current())return {recognition:false,voice:false,vad:false,reason:'The offline speech pack changed.'};const allowed=installed.readiness(),ready=speech.readiness?.()||{};return {...ready,recognition:allowed.recorded&&ready.recognition===true,voice:allowed.recorded&&ready.voice===true,vad:allowed.handsfree&&ready.vad===true};},
  recognizer:{async transcribe(...args){guard();const result=await speech.recognizer.transcribe(...args);guard();return result;}},
  voice:{async speak(...args){guard();await speech.voice.speak(...args);guard();},stop:()=>speech.voice.stop()},
  vad:speech.vad?{async createSession(...args){guard();const session=await speech.vad.createSession(...args);if(!current()){await session.dispose?.();guard();}return {async process(...frames){guard();const result=await session.process(...frames);guard();return result;},dispose:()=>session.dispose?.()};}}:null,
  release:()=>speech.release?.(),
 };
}
export async function acquireConversationService(context){
 const installed=provider,installedRevision=revision;
 if(!installed||!installed.readiness().written)throw new Error(conversationReadiness().reason);
 const service=await installed.acquire(context);
 if(provider!==installed||revision!==installedRevision||!context.isCurrent()){service?.cancelScope?.(context.scope);throw new DOMException('The conversation changed.','AbortError');}
 if(typeof service?.request!=='function'||typeof service?.cancelScope!=='function')throw new TypeError('The offline conversation service could not start');
 return {
  async request(...args){if(provider!==installed||revision!==installedRevision)throw new DOMException('The offline pack changed.','AbortError');const response=await service.request(...args);if(provider!==installed||revision!==installedRevision||!context.isCurrent())throw new DOMException('The offline pack changed.','AbortError');return response;},
  cancelScope:scope=>service.cancelScope(scope),
 };
}
