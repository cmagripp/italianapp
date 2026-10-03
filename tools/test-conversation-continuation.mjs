import assert from 'node:assert/strict';
import {loadConversationContinuation,conversationContinuation} from '../js/learning/conversation-continuation.js';
import {continuation} from '../js/learning/daily-plan.js';
const fixture=()=>({current:{id:'p',learnerId:'l'},learning:{epoch:{id:'e'},sessions:{}}});
const databases=async()=>[{name:'parola-conversations'}];
const thread=(id,at,patch={})=>({threadId:id,title:`Chat ${id}`,updatedAt:at,...patch});
const state=(t,patch={})=>({thread:t,turns:[],draft:null,...patch});
let checks=0;
async function test(name,fn){await fn();checks++;console.log('PASS',name);}
function repository(states){let closes=0;return {factory:()=>({list:async()=>states.map(s=>s.thread).sort((a,b)=>b.updatedAt-a.updatedAt),read:async id=>states.find(s=>s.thread.threadId===id),close:()=>closes++}),closes:()=>closes};}
await test('Fresh learners do not create a conversation database or change learning',async()=>{
 const store=fixture(),before=JSON.stringify(store);let opened=false;
 assert.equal(await loadConversationContinuation(store,{databases:async()=>[],repositoryFactory:()=>{opened=true;}}),null);
 assert.equal(opened,false);assert.equal(JSON.stringify(store),before);
});
await test('Only actual conversation work competes with the exact saved lesson',async()=>{
 const store=fixture(),t=thread('a/b',100),repo=repository([state(thread('empty',300)),state(thread('archived',400,{archived:true}),{turns:[{}]}),state(t,{draft:{typedText:'Vorrei un caffè',updatedAt:110}})]),before=JSON.stringify(store);
 const result=await loadConversationContinuation(store,{databases,repositoryFactory:repo.factory});
 assert.equal(result.threadId,'a/b');assert.equal(result.href,'#/conversations/a%2Fb');assert.equal(result.updatedAt,110);assert.match(result.reason,/unsent/);
 assert.equal(continuation(store).threadId,'a/b');assert.equal(repo.closes(),1);assert.equal(JSON.stringify(store),before);
 store.learning.sessions.review={id:'review',entryId:'w:casa|noun',updatedAt:120,reviewVisit:{index:1,total:4,phase:'activity'}};
 assert.equal(continuation(store).activity,'review');
});
await test('Profile, learner and epoch changes cannot reveal another learner’s cached title',async()=>{
 for(const change of [s=>s.current.id='q',s=>s.current.learnerId='other',s=>s.learning.epoch.id='new']){
  const store=fixture(),repo=repository([state(thread('one',5),{turns:[{}]})]);await loadConversationContinuation(store,{databases,repositoryFactory:repo.factory});change(store);assert.equal(conversationContinuation(store),null);
 }
});
await test('A late read cannot overwrite a newer request or cross a profile change',async()=>{
 const store=fixture();let release,closed=0;
 const slow=loadConversationContinuation(store,{databases,repositoryFactory:()=>({list:()=>new Promise(resolve=>{release=resolve;}),close:()=>closed++,read:async()=>state(thread('old',10),{turns:[{}]})})});
 while(!release)await Promise.resolve();
 const repo=repository([state(thread('new',20),{turns:[{}]})]);await loadConversationContinuation(store,{databases,repositoryFactory:repo.factory});
 release([thread('old',10)]);await slow;assert.equal(conversationContinuation(store).threadId,'new');assert.equal(closed,1);
});
await test('Archiving, deletion and repository errors remove stale recommendations without writes',async()=>{
 const store=fixture(),repo=repository([state(thread('one',5),{turns:[{}]})]);await loadConversationContinuation(store,{databases,repositoryFactory:repo.factory});
 const removed=repository([state(thread('one',6,{deletedAt:6}),{turns:[{}]})]);await loadConversationContinuation(store,{databases,repositoryFactory:removed.factory});assert.equal(conversationContinuation(store),null);
 await loadConversationContinuation(store,{databases,repositoryFactory:()=>({list:async()=>{throw Error('storage unavailable');},close(){}})});assert.equal(continuation(store),null);
});
console.log(`${checks} read-only conversation continuation checks passed.`);
