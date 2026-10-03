// A fresh profile can recommend its first item without authoring every lesson.
// Existing history uses the complete, unchanged review/resume policies on demand.
import {itemsForScope} from '../data.js';
import {ANCHOR_VERBS} from './curriculum.js';
export async function homeLearning(store){
 const learning=store.learning;
 if(Object.keys(learning.events||{}).length||Object.keys(learning.completions||{}).length||Object.keys(learning.sessions||{}).length||Object.values(store.current.items||{}).some(i=>i.learned))return import('./integration.js');
 return {reviewItems:()=>[],practiceHref:entry=>`#/learn/${entry.kind==='verb'?'verb':'word'}/${encodeURIComponent(entry.id)}`,recommendLesson:()=>{
  const anchors=new Map(['credere','parlare','essere','avere','dormire','capire','dire','andare',...ANCHOR_VERBS].map((name,i)=>[name,i]));
  const entry=itemsForScope(store.scope,store).filter(e=>!store.current.customDeleted?.[e.id]).slice().sort((a,b)=>(anchors.get(a.inf)??100)-(anchors.get(b.inf)??100))[0];
  return entry?{entry,mode:'lesson',reason:entry.kind==='verb'?'Choose a tense: present, passato prossimo, imperfetto, future or conditional.':'Learn a word through its meaning, forms and real examples.'}:null;
 }};
}
