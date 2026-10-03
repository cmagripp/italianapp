import {openValidatedAssistance} from './ai-assistance-panel.js';
import {onConversationProviderChange} from '../conversations/runtime.js';

// One optional help sheet per practice player. Drafts and receipts live in the
// ordinary saved lesson session; they never stand in for a graded answer.
export function createPracticeHelp({getSource,getSession,isCurrent,persist,onViewed=()=>{},onUse=()=>{},onRefresh=()=>{}}){
 let panel=null,pending=0,closed=false,fingerprint='';
 const current=()=>!closed&&isCurrent();
 const source=()=>getSource();
 const journal=()=>{
  const session=getSession();if(!session.aiAssistance||typeof session.aiAssistance!=='object'||Array.isArray(session.aiAssistance))session.aiAssistance={drafts:{},history:[]};
  const saved=session.aiAssistance;if(!saved.drafts||typeof saved.drafts!=='object'||Array.isArray(saved.drafts))saved.drafts={};if(!Array.isArray(saved.history))saved.history=[];return saved;
 };
 const same=expected=>current()&&JSON.stringify(source())===expected;
 const guard=expected=>{if(!same(expected))throw new DOMException('This practice step changed.','AbortError');};
 const close=()=>{pending++;panel?.close({silent:true});panel=null;fingerprint='';};
 const check=()=>{if(fingerprint&&!same(fingerprint))close();};
 const off=onConversationProviderChange(()=>{close();if(current())onRefresh();});
 return {
  async open(task,opener){
   if(!current())return null;close();const request=++pending,initial=source(),expected=JSON.stringify(initial);
   if(!initial)return null;fingerprint=expected;
   const result=await openValidatedAssistance({task,getSource:source,isCurrent:()=>request===pending&&same(expected),
    saved:journal().drafts?.[initial.sourceId],opener,
    onDraft:async row=>{guard(expected);const saved=journal();saved.drafts ||= {};saved.drafts[initial.sourceId]=row;await persist();guard(expected);},
    onViewed:async receipt=>{guard(expected);const saved=journal();saved.history ||= [];saved.history.push(receipt);saved.history=saved.history.slice(-80);onViewed(receipt);await persist();guard(expected);},
    onUse:async result=>{guard(expected);await onUse(result);},
    onClose:()=>{if(request===pending){pending++;panel=null;fingerprint='';}},
   });
   if(request!==pending||!same(expected)){result.close({silent:true});return null;}
   panel=result;return panel;
  },
  check,close,
  dispose(){if(closed)return;close();closed=true;off();},
 };
}
