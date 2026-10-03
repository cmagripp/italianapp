// Portable local backups. Audio is absent unless the learner explicitly asks
// to include saved recordings; model packs and microphone buffers are excluded.
const FORMAT='parola-conversations-json';
function encode(bytes){
 const array=new Uint8Array(bytes);let result='';
 for(let i=0;i<array.length;i+=32768)result+=String.fromCharCode(...array.subarray(i,i+32768));
 return btoa(result);
}
function decode(value){
 if(typeof value!=='string'||value.length>Math.ceil(64*1024*1024/3)*4||value.length%4||/[^A-Za-z0-9+/=]/.test(value))throw new TypeError('Invalid recording data in backup');
 const padding=value.endsWith('==')?2:value.endsWith('=')?1:0;
 if(value.slice(0,padding?-padding:undefined).includes('='))throw new TypeError('Invalid recording padding in backup');
 const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes.buffer;
}
export async function exportConversationJSON(repository,{includeAudio=false,threadId=null}={}){
 const bundle=await repository.exportRecords({includeAudio});
 if(threadId)for(const name of Object.keys(bundle.records))bundle.records[name]=bundle.records[name].filter(record=>record.threadId===threadId);
 for(const row of bundle.records.recordings)row.bytes={encoding:'base64',value:encode(row.bytes)};
 return JSON.stringify({format:FORMAT,version:1,...bundle});
}
export function parseConversationJSON(value){
 const bundle=JSON.parse(value);
 if(bundle?.format!==FORMAT||bundle.version!==1||!Array.isArray(bundle.records?.recordings))throw new TypeError('Not a supported conversation backup');
 for(const row of bundle.records.recordings){if(row.bytes?.encoding!=='base64')throw new TypeError('Unsupported recording encoding');row.bytes=decode(row.bytes.value);}
 return bundle;
}
export async function importConversationJSON(repository,value,options){return repository.importRecords(parseConversationJSON(value),options);}
