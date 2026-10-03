// Shared geometry/lifecycle only: each activity keeps its own visual layout.
// CSS owns the normal viewport; JS intervenes only for a real virtual keyboard.
import {keyboardViewportHeight} from '../ui.js';
const owners=new Map();
export function mountActivityViewport(root,{kind='journey',compactClass=null,panelSelector='.journey-main',inputSelector='input,textarea,[contenteditable="true"]'}={}){
 const cssClass=kind==='practice'?'practice-viewport':'journey-viewport';
 const property=kind==='practice'?'--practice-height':'--journey-viewport-height';
 const token={};owners.set(cssClass,token);
 let disposed=false,frame=0;
 document.body.classList.add(cssClass);window.scrollTo(0,0);
 const fit=()=>{
  if(disposed || owners.get(cssClass)!==token)return;
  const height=keyboardViewportHeight();
  if(height===null)document.body.style.removeProperty(property);
  else document.body.style.setProperty(property,`${height}px`);
  if(compactClass)document.body.classList.toggle(compactClass,(height??window.innerHeight)<600);
  const input=document.activeElement;
  if(root.contains(input)&&input?.matches(inputSelector)){
   const panel=input.closest(panelSelector)||root.querySelector(panelSelector);
   if(panel){const bottom=input.getBoundingClientRect().bottom-panel.getBoundingClientRect().bottom;if(bottom>0)panel.scrollTop+=bottom+16;}
  }
 };
 const resize=()=>{fit();cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);};
 for(const name of ['resize','scroll'])window.visualViewport?.addEventListener(name,resize);
 for(const name of ['resize','orientationchange','pageshow'])window.addEventListener(name,resize);
 for(const name of ['focusin','focusout'])root.addEventListener(name,resize);
 fit();
 return {fit,destroy(){
  if(disposed)return;disposed=true;cancelAnimationFrame(frame);
  for(const name of ['resize','scroll'])window.visualViewport?.removeEventListener(name,resize);
  for(const name of ['resize','orientationchange','pageshow'])window.removeEventListener(name,resize);
  for(const name of ['focusin','focusout'])root.removeEventListener(name,resize);
  if(owners.get(cssClass)!==token)return;
  owners.delete(cssClass);document.body.classList.remove(cssClass);document.body.style.removeProperty(property);
  if(compactClass)document.body.classList.remove(compactClass);
 }};
}
