#!/usr/bin/env node
// Navigation/review descriptors and exact completion recipes; no prompts/answers.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildLesson} from '../js/learning/lesson-content.js';
const root=new URL('../',import.meta.url),levels=['Foundations','A1','A2','B1','B2','C1','C2'];
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),write=(p,x)=>fs.writeFileSync(new URL(p,root),JSON.stringify(x)+'\n');
export const digest=value=>{let h=2166136261;for(const c of JSON.stringify(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
const pick=(x,keys)=>Object.fromEntries(keys.filter(k=>x[k]!==undefined).map(k=>[k,x[k]]));
const descriptor=lesson=>({...pick(lesson,['id','title','outcome','minutes','prerequisites','related','targets','legacyLessonIds','referenceTopics']),...(lesson.objectives?{objectives:lesson.objectives.map(o=>pick(o,['id','label']))}:{}),steps:(lesson.steps||[]).filter(s=>s.kind==='portfolio').map(s=>pick(s,['id','kind','mode','title']))});
const packs=(kind,names)=>names.map(level=>{const pack=read(`data/${kind}/${level}.json`);return {...pick(pack,['version','level','title','description']),path:`data/${kind}/${level}.json`,digest:digest(pack),units:pack.units.map(unit=>({...pick(unit,['id','title','description']),lessons:unit.lessons.map(descriptor)}))};});
export function buildCourseIndex(){const index={version:1,levels:packs('course-v2',levels),legacyLevels:packs('grammar-course',levels.slice(1))};write('data/course-index.json',index);return index;}
export function buildCompletionIndex(){
 const entries=[...read('data/verbs.json'),...read('data/vocab.json')],chapters=[],chapterIds=new Map(),plans=[],planIds=new Map(),byEntry={};
 const intern=(value,list,map)=>{const key=JSON.stringify(value);if(!map.has(key)){map.set(key,list.length);list.push(value);}return map.get(key);};
 for(const entry of entries){const plan=buildLesson(entry),suffix=id=>id.startsWith(entry.id)?id.slice(entry.id.length):id;
  const required=t=>t.available!==false&&(t.required!==false||t.completionRequired)&&!t.supplementalOnly;
  const tuple=t=>[suffix(t.id),(t.guidedOnly?1:0)|(t.completionRequired?2:0)];
  const core=plan.kind==='verb'?plan.chapters.filter(c=>['present','past','background','future','condizionale'].includes(c.id)):plan.chapters;
  const refs=core.map(c=>intern({id:c.id,title:c.title,tense:c.tense??null,...c.flowVersion?{flowVersion:c.flowVersion}:{},targets:c.groups.flatMap(g=>g.targets).filter(plan.kind==='verb'?required:()=>true).map(t=>plan.kind==='verb'?tuple(t):[suffix(t.id),t.skill,t.available===false?0:1]),...(c.legacyRequirements?{legacy:c.legacyRequirements.filter(required).map(tuple)}:{})},chapters,chapterIds));
  const recipe={version:plan.version,kind:plan.kind,chapters:refs,...(plan.wordLesson?{slots:plan.wordLesson.slots.map(s=>[suffix(s.id),suffix(s.targetId)])}:{})};
  byEntry[entry.id]=intern(recipe,plans,planIds);
 }
 const index={version:1,chapters,plans,entries:byEntry};write('data/completion-index.json',index);return index;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){buildCourseIndex();const completion=buildCompletionIndex();console.log(`Built compact course/completion indexes (${completion.plans.length} completion recipes for ${Object.keys(completion.entries).length} entries).`);}
