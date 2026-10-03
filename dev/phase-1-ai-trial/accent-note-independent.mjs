// Actual imported-record/UI fixture only; never installed as a model/provider.
import fs from 'node:fs';
import {BASE,loadPlaywright,launchBrowser,ensureServer,contextOptions} from '../../tests/lib.mjs';
const {chromium,webkit}=await loadPlaywright(),stop=await ensureServer(),name=process.env.COURSE_BROWSER||'chromium';
const browser=name==='webkit'?await webkit.launch():await launchBrowser(chromium),context=await browser.newContext(contextOptions()),page=await context.newPage(),errors=[],cases=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(BASE+'#/conversations');await page.locator('[data-new-conversation]').waitFor();
 for(const kind of ['effective-does-not-match-candidate','candidate-has-no-accent-change']){
  const imported=await page.evaluate(async kind=>{
   const {store}=await import('./js/store.js'),{createConversationRepository}=await import('./js/conversations/storage.js');
   const actualOwner={profileId:store.current.id,learnerId:store.current.learnerId},source=createConversationRepository({profileId:'synthetic-note-source',learnerId:actualOwner.learnerId}),target=createConversationRepository(actualOwner),threadId='accent-note-'+kind;
   await source.createThread({level:'A1',support:'free',participants:[{id:'partner-1',name:'Giulia'}]},{threadId});
   const original=await source.commitTurn(threadId,{turnId:'learner',role:'learner',participantId:'learner',originalText:'Vorrei un caffe.',displayText:'Vorrei un caffe.',submittedText:'Vorrei un caffe.',policySnapshot:{version:'conversation-v1',strictAccents:false},inputProvenance:{mode:'written'}});
   const inputSubmission=Object.fromEntries(['turnId','revision','originalText','submittedText','displayText','policySnapshot','inputProvenance'].map(key=>[key,original[key]??null]));
   const candidateNFC=kind==='candidate-has-no-accent-change'?'Vorrei un caffe.':'Vorrei un caffè.',effectiveText='Vorrei un tè.';
   await source.reviseTurn(threadId,'learner',{displayText:effectiveText,expectedRevision:1});
   const receipt={version:1,outcome:'restore-display',source:{scope:'conversation:synthetic-note-source:'+actualOwner.learnerId+':'+threadId,sourceRevision:1,inputSubmission},originalNFC:inputSubmission.originalText,baseNFC:inputSubmission.displayText,candidateNFC,effectiveText,differences:[],comparison:null,references:[],registryVersion:null,inputOrigin:'typed',reason:null,assessment:'spelling-display-only',masteryAwarded:false};
   await source.commitTurn(threadId,{turnId:'partner',role:'partner',participantId:'partner-1',originalText:'Certo.',sourceContext:{inputSpelling:receipt,inputSpellingSourceRevision:2}});
   const bundle=await source.exportRecords();const result=await target.importRecords(bundle);const after=await target.read(threadId);source.close();target.close();return {threadId,result,after};
  },kind);
  await page.evaluate(id=>location.hash='#/conversations/'+id,imported.threadId);await page.locator('.conversation-message.partner').waitFor();
  const rendered=await page.locator('[data-spelling-note]').count(),title=rendered?await page.locator('[data-spelling-note] summary').innerText():null;
  if(rendered)await page.locator('[data-spelling-note] summary').click();
  cases.push({kind,rendered,title,note:rendered?await page.locator('[data-spelling-note]').innerText():null,learnerBubble:await page.locator('.conversation-message.learner > p').innerText(),imported});
 }
 const report={browser:name,scope:'Synthetic forged historical receipt imported through actual repository; no generator or production source installed.',errors,cases};
 fs.writeFileSync('docs/implementation/programme/ai-accent-note-'+(process.argv.includes('--after')?'after':'before')+'-'+name+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({browser:name,errors,cases:cases.map(({kind,rendered,title,learnerBubble})=>({kind,rendered,title,learnerBubble}))}));
}finally{await context.close();await browser.close();stop();}
