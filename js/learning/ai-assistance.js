// An exercise-scoped consumer of the installed, validated local service. This
// module never grades, records evidence, supplies fallback text or downloads.
import {acquireConversationService,conversationReadiness,conversationProviderRevision,onConversationProviderChange} from '../conversations/runtime.js';
import {LEVELS} from '../ai/grounding.js';
import {sourceFingerprint} from '../ai/source-fingerprint.js';

const clone=value=>structuredClone(value),stable=sourceFingerprint;
const abort=()=>new DOMException('This practice step changed.','AbortError');
const TASKS=new Set(['intent','hint','explain']);
const normalized=text=>String(text||'').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}']+/gu,' ').trim();
export function assistanceAvailable(){return conversationReadiness().written===true;}
export function restoreAssistanceDraft(saved,source){
 const fingerprint=stable(source);
 let exact=false;try{exact=typeof saved?.sourceFingerprint==='string'&&saved.sourceFingerprint.length<30000&&stable(JSON.parse(saved.sourceFingerprint))===fingerprint;}catch{}
 return saved?.policyVersion===1&&exact&&typeof saved.originalText==='string'&&saved.originalText.length<=1200?saved.originalText:'';
}
function checkedSource(source){
 if(!source||typeof source.sourceId!=='string'||!source.sourceId||source.sourceId.length>200||!LEVELS.includes(source.level)||
  typeof source.owner?.profileId!=='string'||typeof source.owner?.learnerId!=='string'||typeof source.epochId!=='string'||typeof source.prompt!=='string'||source.prompt.length>4000)throw new TypeError('Help needs an exact current practice source.');
 return clone(source);
}
async function revision(fingerprint){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint));
 return 'help:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
const revealsAnswer=(text,answers)=>{
 const candidate=' '+normalized(text)+' ';
 return answers.some(answer=>{const value=normalized(answer);return value&&candidate.includes(' '+value+' ');});
};

export function createAssistanceController({getSource,isCurrent=()=>true,saved,onDraft=()=>{},onViewed=()=>{},onUse=()=>{},onChange=()=>{},
 acquire=acquireConversationService,readiness=conversationReadiness,providerRevision=conversationProviderRevision,onProviderChange=onConversationProviderChange}={}){
 if(typeof getSource!=='function')throw new TypeError('A current exercise source is required');
 const initial=checkedSource(getSource()),fingerprint=stable(initial),scope=stable(['assistance',initial.owner,initial.epochId,initial.sourceId]);
 let closed=false,generation=0,draft=restoreAssistanceDraft(saved,initial),busy=false,response=null,error='',service=null,active=null,pending=Promise.resolve(),accepted=null;
 const current=()=>!closed&&isCurrent()&&stable(getSource())===fingerprint;
 const guard=()=>{if(!current())throw abort();};
 const snapshot=()=>({draft,busy,response:response?clone(response):null,error,available:readiness().written===true,source:clone(initial)});
 const publish=()=>{if(current())onChange(snapshot());};
 const cancel=()=>{generation++;active?.abort();active=null;service?.cancelScope(scope);busy=false;};
 const off=onProviderChange(()=>{cancel();response=null;accepted=null;error='';publish();});
 const controller={
  get snapshot(){return snapshot();},
  setDraft(text){
   guard();if(typeof text!=='string'||text.length>1200)throw new TypeError('Keep your intention to 1,200 characters.');
   cancel();draft=text;response=null;accepted=null;error='';
   const row={policyVersion:1,sourceFingerprint:fingerprint,originalText:text,updatedAt:Date.now()};
   try{pending=Promise.resolve(onDraft(clone(row))).catch(failure=>{if(current()){error=failure.message;publish();}throw failure;});}catch(failure){pending=Promise.reject(failure);}
   // Input listeners need not await a queued profile save. request() still does.
   void pending.catch(()=>{});publish();return pending;
  },
  async request(task='intent'){
   guard();if(!TASKS.has(task))throw new TypeError('Unknown practice help task');if(busy)return null;
   if(readiness().written!==true)throw new Error('Offline reply help is not available on this device.');
   if(task==='intent'&&!draft.trim())throw new TypeError('Write what you want to say first.');
   const epoch=++generation,installed=providerRevision(),original=draft,signal=new AbortController();active=signal;busy=true;response=null;accepted=null;error='';publish();
   const live=()=>current()&&epoch===generation&&installed===providerRevision()&&!signal.signal.aborted;
   const check=()=>{if(!live())throw abort();};
   try{
    await pending;check();const sourceRevision=await revision(fingerprint);check();
    service=await acquire({scope,isCurrent:live,...initial.owner,epochId:initial.epochId});check();
    const request={task,text:task==='intent'?original:original.trim()||initial.prompt,level:initial.level,scope,sourceRevision,
     participants:[{id:'helper',name:'Practice helper'}],requestedIds:initial.requestedIds||[],protectedNames:initial.protectedNames||[],
     helpContext:{sourceId:initial.sourceId,prompt:initial.prompt,context:initial.context||'',inputLanguage:initial.inputLanguage||'en'},
     helpSource:initial.helpSource||{version:1,kind:'unmapped-practice',sourceId:initial.sourceId},
     agreement:initial.agreement||'neutral',history:[],support:'free'};
    const result=await service.request(request,{scope,signal:signal.signal,priority:1});check();
    if(typeof result?.message?.text!=='string'||!result.message.text.trim()||result.provenance?.languageRangeVerified!==true||!result.provenance?.languagePolicyVersion)throw new Error('The suggestion did not pass the language checks.');
    if(initial.helpSource&&(result.provenance.practiceSource?.bindingFingerprint!==stable(initial.helpSource)||result.provenance.practiceSource?.sourceRevision!==sourceRevision))throw new Error('The suggestion did not match this lesson source.');
    if(['intent','hint'].includes(task)&&result.corrections?.length)throw new Error('Help cannot treat this request as a language mistake.');
    if(task==='hint'&&revealsAnswer(result.message.text,initial.answers||[]))throw new Error('That hint revealed the answer. Use the lesson hint instead.');
    const provenance={task,sourceFingerprint:fingerprint,sourceRevision,scope,originalText:original,wording:result.message.text,
     assisted:true,languagePolicyVersion:result.provenance.languagePolicyVersion,practiceSource:clone(result.provenance.practiceSource||null),runtime:clone(result.provenance.runtime||null),at:Date.now()};
    await onViewed(clone(provenance));check();response=clone(result);accepted={provenance,installed,epoch};return clone(result);
   }catch(failure){if(live()&&failure.name!=='AbortError')error=failure.message;return null;}
   finally{if(epoch===generation){busy=false;active=null;publish();}}
  },
  async use(){
   guard();if(!accepted||!response||accepted.installed!==providerRevision()||accepted.epoch!==generation)throw abort();
   // Host rechecks this source before its synchronous input mutation/save. The
   // mutation may itself change the fingerprint, so do not apply a second time.
   const applied=accepted;accepted=null;
   return onUse({text:response.message.text,provenance:clone(applied.provenance),source:clone(initial)});
  },
  cancel(){cancel();response=null;accepted=null;publish();},
  dispose(){if(closed)return;cancel();closed=true;off();},
 };
 return controller;
}
