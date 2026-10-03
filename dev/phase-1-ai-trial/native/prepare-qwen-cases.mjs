import {readFile,writeFile} from 'node:fs/promises';
import {heldoutCases,heldoutGrounding} from '../quality-heldout.mjs';
// Use the already frozen native input. The browser task implementation may
// evolve during root integration; this comparison never retunes its prompts.
const original=JSON.parse(await readFile(new URL('./native-heldout.json',import.meta.url),'utf8'));
const textRules=String.raw`ws ::= [ \t\n\r]*
string ::= "\"" char* "\""
char ::= [^"\\\x00-\x1f] | "\\" (["\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])`;
const literal=value=>JSON.stringify(JSON.stringify(value));
const cases=original.map(probe=>{
 const request={task:'conversation',participants:[{id:'partner',name:'Giulia'}],sourceRevision:1,...heldoutCases.find(row=>row.id===probe.id)},grounding=heldoutGrounding.retrieve(request);
 const participants=request.participants.filter(p=>p.active!==false&&(!request.addresseeId||p.id===request.addresseeId)).map(p=>p.id),rules=grounding.rules.map(rule=>rule.id);
 const correction=rules.length&&!request.opening&&!request.recognitionUncertain?'correction?':'';
 const grammar=`root ::= "{" ws "\\\"participantId\\\"" ws ":" ws participant ws "," ws "\\\"text\\\"" ws ":" ws string ws "," ws "\\\"corrections\\\"" ws ":" ws "[" ws ${correction} ws "]" ws "}" ws\nparticipant ::= ${participants.map(literal).join(' | ')}\n${rules.length?`rule ::= ${rules.map(literal).join(' | ')}\ncorrection ::= "{" ws "\\\"original\\\"" ws ":" ws string ws "," ws "\\\"replacement\\\"" ws ":" ws string ws "," ws "\\\"ruleId\\\"" ws ":" ws rule ws "}"\n`:''}${textRules}`;
 return {...probe,request,grammar,model:'Qwen3-8B-Q4_K_M',promptRevision:'frozen-native-heldout-v1',groundingVersion:grounding.version};
});
await writeFile(new URL('./qwen-native-cases.json',import.meta.url),JSON.stringify(cases,null,2));
console.log(`Frozen ${cases.length} cases for the single native Qwen trial.`);
