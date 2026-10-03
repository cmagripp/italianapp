import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSentenceLookup} from '../js/learning/sentence-lookup.js';
import {buildConversationSummary} from '../js/conversations/summary.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const vocab=read('vocab.json').filter(e=>!e.legacyGrouping).map(e=>({...e,kind:'word'})),verbs=read('verbs.json').map(e=>({...e,kind:'verb',it:e.inf}));
const entries=new Map([...vocab,...verbs].map(e=>[e.id,e])),lookup=createSentenceLookup({vocab,verbs}),resolveEntry=id=>entries.get(id);
const thread={threadId:'test',contentRevision:1,setup:{agreement:'feminine'}};
const turn=(displayText,extra={})=>({turnId:'one',revision:1,role:'learner',participantId:'learner',originalText:displayText,displayText,...extra});
const build=(turns,extra={})=>buildConversationSummary({thread,turns,...extra},{lookup,resolveEntry,resolveRule:extra.resolveRule});
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
check('Summary uses the recorded noun article/plural and complete verb construction',()=>{
 const source=turn('Io ho mangiato una pesca.'),result=build([source]);
 const verb=result.items.find(i=>i.entryId==='v:mangiare');assert(verb);assert.equal(verb.caseId,'past');assert(verb.matches.some(m=>m.form==='ho mangiato'));
 const ambiguous=result.items.find(i=>i.kind==='meaning-choice'&&i.word==='pesca');assert(ambiguous);assert(!ambiguous.entryId);
 const peach=ambiguous.candidates.find(c=>c.entryId==='w:pesca|noun#peach');assert.equal(peach.singular,'la pesca');assert.equal(peach.plural,'le pesche');
 const fishing=ambiguous.candidates.find(c=>c.entryId==='w:pesca|noun#fishing');assert.equal(fishing.plural,null);
 assert.equal(result.masteryAwarded,false);for(const item of result.items)for(const ref of item.sourceRefs)assert.equal(source.displayText.slice(ref.start,ref.end),ref.quote);
});
check('An explicit meaning choice is used only for its exact source revision',()=>{
 const source=turn('Una pesca.',{sourceContext:{lexicalChoices:[{start:4,end:9,revision:1,entryId:'w:pesca|noun#peach',senseId:'it:pesca:noun:peach'}]}});
 const selected=build([source]);assert(selected.items.some(i=>i.entryId==='w:pesca|noun#peach'&&i.meaningSelection==='learner-choice'));
 const edited=build([{...source,revision:2}]);assert(edited.items.some(i=>i.kind==='meaning-choice'&&i.word==='pesca'));assert(!edited.items.some(i=>i.entryId==='w:pesca|noun#peach'));
});
check('Repeated vocabulary aggregates exact occurrences without changing source turns',()=>{
 const turns=[turn('Il pane è buono.'),turn('Mangio il pane.',{turnId:'two',role:'partner',participantId:'maria'})],before=structuredClone(turns),result=build(turns);
 const pane=result.items.find(i=>i.entryId==='w:pane|noun');assert(pane);assert.equal(pane.sourceRefs.length,2);assert.deepEqual(turns,before);assert(result.items.every(i=>i.completionAwarded===false));
});
check('Only a verified correction rule can create a teaching note; invented reasons are discarded',()=>{
 const source=turn('Ieri ho andato a casa.');
 const rule={id:'aux-go',verified:true,explanation:'This source supplies the explanation.',source:'reviewed-test-rule',confirmCorrection:c=>c.original==='ho andato'&&c.replacement==='sono andata'};
 const response=turn('Va bene.',{turnId:'two',role:'partner',correctionRefs:[{sourceTurnId:'one',sourceTurnRevision:1,ruleId:rule.id,original:'ho andato',replacement:'sono andata',reason:'A made-up model explanation.'}]});
 const result=build([source,response],{resolveRule:id=>id===rule.id?rule:null}),correction=result.items.find(i=>i.kind==='correction');
 assert.equal(correction.explanation,rule.explanation);assert.equal(correction.reference,rule.source);assert(!JSON.stringify(correction).includes('made-up'));
 for(const changed of [{...source,revision:2},{...source,inputProvenance:{recognitionUncertain:true}}])assert(!build([changed,response],{resolveRule:()=>rule}).items.some(i=>i.kind==='correction'));
 assert(!build([source,response]).items.some(i=>i.kind==='correction'));
});
check('A permissive verifier cannot authorize a meaning reversal or an unsourced explanation',()=>{
 const source=turn('Non ho comprato due mele.'),response=turn('Va bene.',{turnId:'two',role:'partner',correctionRefs:[{sourceTurnId:'one',sourceTurnRevision:1,ruleId:'permissive',original:source.displayText,replacement:'Ho comprato tre mele.'}]});
 const rule={id:'permissive',verified:true,source:'fixture',explanation:'A permissive fixture.',confirmCorrection:()=>true};
 assert(!build([source,response],{resolveRule:()=>rule}).items.some(i=>i.kind==='correction'));
 response.correctionRefs[0].replacement=source.displayText;
 assert(!build([source,response],{resolveRule:()=>({...rule,source:null})}).items.some(i=>i.kind==='correction'));
});
check('Personal notes remain visible as invalidated after edits; generated unsupported notes disappear',()=>{
 const prior={items:[{id:'own-note',kind:'note',author:'learner',text:'My note',sourceRefs:[{turnId:'one',revision:1}]},{id:'fake',kind:'note',author:'model',text:'Invented',sourceRefs:[{turnId:'one',revision:1}]}]};
 const result=build([turn('Il pane.',{revision:2})],{previous:prior});
 assert(result.items.find(i=>i.id==='own-note').invalidated);assert(!result.items.some(i=>i.id==='fake'));
});
console.log(`${checks} conversation study-summary checks passed.`);
