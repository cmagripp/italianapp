import { html, raw, sheet } from '../ui.js';
import { store } from '../store.js';
import { conversationReadiness, onConversationProviderChange } from '../conversations/runtime.js';

// Product availability comes from the installed provider, never the existence
// of cached weights. A downloaded trial is not an approved conversation model.
export function openOfflineAI({ opener } = {}) {
  const owner=store.current.id,learner=store.current.learnerId,epoch=store.learning.epoch.id;
  const current=()=>store.current.id===owner&&store.current.learnerId===learner&&store.learning.epoch.id===epoch;
  let closed=false,storage=null;
  const dialog=sheet('',{title:'Offline conversations',opener,onClose:cleanup});
  const off=onConversationProviderChange(draw);
  const guard=()=>{if(!current())dialog.close();};
  store.addEventListener('profile',guard);store.addEventListener('change',guard);
  function cleanup(){if(closed)return;closed=true;off();store.removeEventListener('profile',guard);store.removeEventListener('change',guard);}
  function draw(){
    if(closed||!current())return;
    const ready=conversationReadiness();
    dialog.body.innerHTML=html`<p>${ready.written?'An offline conversation provider is available on this device.':'Conversation replies are not available in this release. The models evaluated so far have not met our Italian teaching checks.'}</p>
      ${raw([['Written replies',ready.written],['Tap to speak',ready.recorded],['Hands-free dialogue',ready.handsfree]].map(([name,on])=>html`<div class="set-row"><div class="set-main"><div class="lab">${name}</div></div><span>${on?'Available':'Unavailable'}</span></div>`).join(''))}
      <p>Your lessons, dictionary and saved transcripts remain available. Conversations stay on this device; recordings are saved only when you choose.</p>
      ${storage?raw(html`<p class="small muted">This website uses ${storage.used} of ${storage.quota} available browser storage. This includes lessons and downloads.</p>`):''}
      <a class="btn secondary block" href="#/conversations" data-ai-conversations>Saved conversations</a>
      <p class="small muted">Back up transcripts and notes in Me → Settings → Export backup.</p>`;
  }
  dialog.body.addEventListener('click',event=>{if(event.target.closest('[data-ai-conversations]'))dialog.close();});
  draw();
  Promise.resolve(navigator.storage?.estimate?.()).then(value=>{
    if(!Number.isFinite(value?.usage)||!Number.isFinite(value?.quota))return;
    const size=n=>n>=1024**3?`${(n/1024**3).toFixed(1)} GB`:`${Math.ceil(n/1024**2)} MB`;
    storage={used:size(value.usage),quota:size(value.quota)};draw();
  }).catch(()=>{});
  return dialog;
}
