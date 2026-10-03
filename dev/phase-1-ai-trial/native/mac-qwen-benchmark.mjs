import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateResponse} from '../../../js/ai/validation.js';
import {heldoutGrounding} from '../quality-heldout.mjs';
const input=await readFile(new URL('./qwen-native-cases.json',import.meta.url)),cases=JSON.parse(input),pins=JSON.parse(await readFile(new URL('./native-pins.json',import.meta.url))),destination='docs/implementation/programme/ai-native-qwen-mac.json';
const report={recordedAt:new Date().toISOString(),scope:'Native llama.cpp on physical Mac M1 Max32GB, not physical iPhone performance/quality proof and not production approved',pins,inputSHA256:createHash('sha256').update(input).digest('hex'),promptRevision:'frozen-native-heldout-v1, no tuning after outputs',rows:[],maxObservedRSSKiB:0};
const pid=Number(process.env.PAROLA_NATIVE_SERVER_PID||await readFile(new URL('./evidence/mac-server.pid',import.meta.url),'utf8')),memory=setInterval(()=>{if(!pid)return;try{const kib=Number(execFileSync('ps',['-o','rss=','-p',String(pid)],{encoding:'utf8'}).trim());report.maxObservedRSSKiB=Math.max(report.maxObservedRSSKiB,kib);}catch{}},500);
try{
 for(const test of cases){
  const participants=test.request.participants.filter(p=>p.active!==false&&(!test.request.addresseeId||p.id===test.request.addresseeId));
  const grounding=heldoutGrounding.retrieve(test.request),schema={type:'object',additionalProperties:false,required:['participantId','text','corrections'],properties:{participantId:{type:'string',enum:participants.map(p=>p.id)},text:{type:'string'},corrections:{type:'array',maxItems:test.request.opening||test.request.recognitionUncertain?0:1,items:{type:'object',additionalProperties:false,required:['original','replacement','ruleId'],properties:{original:{type:'string'},replacement:{type:'string'},ruleId:{type:'string',...(grounding.rules.length?{enum:grounding.rules.map(rule=>rule.id)}:{})}}}}}};
  const body={model:'Qwen3-8B-Q4_K_M',messages:[{role:'system',content:test.instructions},{role:'user',content:test.prompt}],max_tokens:512,temperature:.7,top_p:.8,top_k:20,min_p:0,presence_penalty:1.5,seed:42,chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_object',schema},stream:false};
  const started=performance.now(),response=await fetch('http://127.0.0.1:8162/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)}),data=await response.json();
  const row={id:test.id,request:test.request,review:test.review,inputMessages:body.messages,elapsedMs:performance.now()-started,status:response.status,raw:data.choices?.[0]?.message?.content??null,reasoning:data.choices?.[0]?.message?.reasoning_content??null,finishReason:data.choices?.[0]?.finish_reason??null,usage:data.usage,timings:data.timings,error:data.error||null};
  if(row.raw!=null){try{row.validated=validateResponse(row.raw,{request:test.request,grounding,participants});row.structuralAcceptance=true;}catch(error){row.structuralAcceptance=false;row.validationError=error.message;}}
  report.rows.push(row);await writeFile(destination,JSON.stringify(report,null,2));console.log(test.id+': '+(row.raw||JSON.stringify(row.error)));
 }
}finally{clearInterval(memory);report.completedAt=new Date().toISOString();report.outputs=report.rows.filter(row=>row.raw!=null).length;report.structuralAccepted=report.rows.filter(row=>row.structuralAcceptance).length;await writeFile(destination,JSON.stringify(report,null,2));}
