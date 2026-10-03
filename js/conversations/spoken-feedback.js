// Only the independently rebuilt, source-bound summary can supply a correction
// to speech. Model-authored reasons and imported raw correctionRefs are ignored.
const abortError=()=>new DOMException('Spoken feedback stopped.','AbortError');
export function createSpokenFeedback({voice,getState,isCurrent=()=>true,onChange=()=>{}}){
 let continuation=null;
 const notify=value=>{try{onChange(value);}catch{}};
 function stop(){const pending=continuation;continuation=null;pending?.reject(abortError());notify(null);return voice.stop();}
 function correctionFor(turn,state){
  return (state.summary?.items||[]).find(item=>item.kind==='correction'&&!item.invalidated&&item.sourceRefs?.some(ref=>{
   const source=state.turns.find(t=>t.turnId===ref.turnId);
   return source?.role==='learner'&&!source.inputProvenance?.recognitionUncertain&&source.revision===ref.revision&&source.displayText.slice(ref.start,ref.end)===ref.quote&&ref.quote===item.original&&
    turn.correctionRefs?.some(c=>c.sourceTurnId===ref.turnId&&c.sourceTurnRevision===ref.revision&&c.ruleId===item.ruleId&&c.original===item.original&&c.replacement===item.replacement);
  }));
 }
 return {
  async speak(text,{signal}={}){
   const state=getState(),turn=state?.turns?.at(-1),revision=state?.thread.contentRevision;
   const valid=()=>isCurrent()&&!signal?.aborted&&getState()?.thread.contentRevision===revision;
   if(!valid())throw abortError();
   const correction=turn?.role==='partner'&&turn.displayText===text&&state.summary?.throughTurnRevision===state.thread.contentRevision?correctionFor(turn,state):null;
   const style=state?.thread.setup.correctionStyle||'natural';
   if(!correction||style==='afterward')return voice.speak(text,{signal});
   const prefix=`Puoi dire: «${correction.replacement}».`;
   if(style==='natural')return voice.speak(`${prefix} ${text}`,{signal});
   await voice.speak(prefix,{signal});if(!valid())throw abortError();
   await new Promise((resolve,reject)=>{let pending;const abort=()=>{if(continuation===pending){continuation=null;notify(null);}reject(abortError());};pending={resolve:()=>{signal?.removeEventListener('abort',abort);resolve();},reject:error=>{signal?.removeEventListener('abort',abort);reject(error);}};continuation=pending;signal?.addEventListener('abort',abort,{once:true});notify({replacement:correction.replacement});});
   if(!valid())throw abortError();await voice.speak(text,{signal});
  },
  continue(){const pending=continuation;continuation=null;notify(null);pending?.resolve();},
  stop,
 };
}
