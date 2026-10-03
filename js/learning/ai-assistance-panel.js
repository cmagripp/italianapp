import {createAssistanceController} from './ai-assistance.js';

const safeURL=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}};
export async function openValidatedAssistance({task='intent',title=task==='intent'?'Help me say it':'A little help',getSource,isCurrent,
 saved,onDraft,onViewed,onUse,opener,onClose=()=>{}}={}){
 const {sheet,html,raw,speak,stopSpeech}=await import('../ui.js');
 if(!isCurrent())throw new DOMException('This practice step changed.','AbortError');
 let closed=false,controller;
 const panel=sheet('',{title,opener,onClose:()=>{closed=true;controller?.dispose();stopSpeech();onClose();}});
 const close=panel.close;panel.close=(...args)=>{closed=true;controller?.dispose();stopSpeech();close(...args);};
 const current=()=>!closed&&isCurrent();
 const attributionHTML=card=>{
  const credit=card.attribution;if(!credit)return '';
  return html`<p class="small muted">${credit.title||''}${credit.author?` · ${credit.author}`:''}${credit.license?` · ${credit.license}`:''}</p>${credit.changes?raw(html`<p class="small muted">${credit.changes}</p>`):''}${safeURL(credit.licenseUrl)?raw(html`<a href="${safeURL(credit.licenseUrl)}" target="_blank" rel="noopener noreferrer">Source licence</a>`):''}`;
 };
 function draw(state){
  if(!current()){panel.close();return;}
  const input=panel.body.querySelector('[data-assistance-intent]'),focused=input===document.activeElement,start=input?.selectionStart,end=input?.selectionEnd;
  const cards=state.response?.teaching||[];
  panel.body.innerHTML=html`<p class="small muted">${task==='intent'?'Describe what you want to say in your own words. Keep your original idea; you can edit the suggestion before using it.':'The lesson remains your reference. Any help you use is saved as assisted practice.'}</p><label>${task==='intent'?'What would you like to say?':'Your question (optional)'}<textarea data-assistance-intent rows="4" maxlength="1200">${state.draft}</textarea></label><button type="button" class="btn primary block" data-assistance-request ${state.busy||!state.available||task==='intent'&&!state.draft.trim()?'disabled':''}>${state.busy?'Finding a suggestion…':task==='intent'?'Suggest wording':task==='hint'?'Give me a hint':'Help me understand'}</button>${!state.available?raw('<p class="small muted">Offline reply help is unavailable. Dictionary and lesson help remain available.</p>'):''}<p role="alert">${state.error}</p>${state.response?raw(html`<section class="assistance-suggestion"><span class="kicker">A suggestion</span><p lang="it" data-assistance-wording>${state.response.message.text}</p><button type="button" class="btn ghost sm" data-assistance-hear>Hear suggestion</button>${task==='intent'?raw('<button type="button" class="btn secondary block" data-assistance-use>Use this wording</button>'):''}${raw(cards.map(card=>html`<article><strong>${card.title||'Lesson reference'}</strong><p>${card.definition||card.explanation||''}</p>${raw((card.examples||[]).slice(0,3).map(example=>html`<p lang="it">${typeof example==='string'?example:example.it||''}</p>`).join(''))}${raw(attributionHTML(card))}${safeURL(card.source)?raw(html`<a href="${safeURL(card.source)}" target="_blank" rel="noopener noreferrer">Reference source</a>`):''}</article>`).join(''))}</section>`):''}<button type="button" class="btn ghost block" data-assistance-close>Back to practice</button>`;
  if(focused){const field=panel.body.querySelector('[data-assistance-intent]');field.focus({preventScroll:true});try{field.setSelectionRange(start,end);}catch{}}
 }
 controller=createAssistanceController({getSource,isCurrent:current,saved,onDraft,onViewed,onUse,onChange:draw});
 panel.body.addEventListener('input',event=>{if(event.target.matches('[data-assistance-intent]')&&current())void controller.setDraft(event.target.value).catch(()=>{});});
 panel.body.addEventListener('click',event=>{
  if(event.target.closest('[data-assistance-close]')){panel.close();return;}
  if(!current())return;
  if(event.target.closest('[data-assistance-request]'))void controller.request(task).catch(error=>{if(current()){panel.body.querySelector('[role=alert]').textContent=error.message;}});
  if(event.target.closest('[data-assistance-hear]')){const text=controller.snapshot.response?.message?.text;if(text)speak(text,{force:true});}
  if(event.target.closest('[data-assistance-use]'))void controller.use().then(()=>panel.close()).catch(error=>{if(current())panel.body.querySelector('[role=alert]').textContent=error.message;});
 });
 draw(controller.snapshot);return panel;
}
