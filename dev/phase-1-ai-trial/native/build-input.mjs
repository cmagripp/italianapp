import {writeFile} from 'node:fs/promises';
import {prepareTask} from '../../../js/ai/tasks.js';
import {heldoutCases,heldoutGrounding} from '../quality-heldout.mjs';
const cases=heldoutCases.map(probe=>{const request={task:'conversation',participants:[{id:'partner',name:'Giulia'}],sourceRevision:1,...probe},task=prepareTask(request,heldoutGrounding.retrieve(request),{maxContextChars:10500});return{id:probe.id,instructions:task.messages[0].content,prompt:JSON.stringify({committedHistory:task.messages.slice(1,-1),currentRequest:JSON.parse(task.messages.at(-1).content)}),review:probe.review};});
await writeFile(new URL('./native-heldout.json',import.meta.url),JSON.stringify(cases,null,2));
console.log(`Prepared ${cases.length} frozen cases; no native inference or downloads performed.`);
