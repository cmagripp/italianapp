#!/usr/bin/env node
// Rebuild the durable inventory from source data and the separately recorded
// individual usage reviews. Inventory checks are not linguistic certification.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {conjugate,splitClitic,MISSING} from '../js/conjugator.js';
import {progressiveInfo,progressiveContexts,PROGRESSIVE_SOURCES} from '../js/learning/progressive-content.js';

const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
const verbs=read('data/verbs.json');
const batchPaths=['docs/audit-verb-usage-0-399.json','docs/audit-verb-usage-400-799.json','docs/audit-verb-usage-800-1184.json'];
const batches=batchPaths.filter(path=>fs.existsSync(new URL(path,root))).map(path=>({path,...read(path)}));
const reviewed=new Map();
for(const batch of batches){for(const row of batch.records||batch.entries||[]){
  if(reviewed.has(row.id))throw new Error(`Duplicate individual review: ${row.id}`);
  reviewed.set(row.id,{...row,batch:batch.path});
}}
const restrictions=new Set(['bisognare','trattarsi','addirsi','prudere','urgere','vigere','rincrescere','concernere','incombere','vertere','ostare','solere','delinquere','inerire','garrire','sovvenire']);
// This is a conservative sense-review queue, not a claim these lemmas can never
// express an unfolding event. English glosses cannot decide Italian aspect.
const states=new Set(['essere','avere','sapere','volere','potere','dovere','piacere','conoscere','credere','possedere','appartenere','significare','sembrare','preferire','stare','abitare','adorare','amare','chiamarsi','costare','durare','odiare','restare','ricordare','sentire','vedere','vivere','assomigliare','bastare','contenere','desiderare','dispiacere','importare','interessare','mancare','pesare','rimanere','sentirsi','servire','sperare','temere','tenere','volerci','apprezzare','aspettarsi','avercela','comprendere','contare','dipendere','dubitare','entrarci','esistere','fidarsi','godere','meritare','metterci','poterne','pretendere','prevedere','rappresentare','richiedere','riguardare','ritenere','sopportare','sostenere','tacere','tenerci','valere','vederci','vergognarsi','ambire','apparire','aspettarsela','comportare','consistere','corrispondere','costituire','derivare','detenere','differire','diffidare','disporre','equivalere','fungere','giovare','implicare','intendere','nuocere','percepire','prescindere','presumere','prevalere','provvedere','riferirsi','risiedere','risultare','saperne','sorgere','sovrastare','spettare','stimare','supporre','tendere','trascorrere','competere','decorrere','disdegnare','esulare','fregarsene','gravare','intendersene','intercorrere','passarsela','patire','paventare','propendere','sentirsela','starci','anelare','bearsi','compiacersi','dolersi','esecrare','intendersela','languire','permanere','postulare','preludere','rifulgere','soggiacere','trasparire']);
const allFindings=batches.flatMap(batch=>(batch.findings||[]).map(f=>({...f,batch:batch.path})));
const countBy=items=>Object.fromEntries([...new Set(items)].sort().map(key=>[key,items.filter(item=>item===key).length]));
const records=verbs.map((entry,index)=>{
  const {base,clitic}=splitClitic(entry.inf),info=progressiveInfo(entry),paradigm=conjugate(entry.inf,entry);
  const present=progressiveContexts(entry),past=progressiveContexts(entry,{chapter:'background'});
  const review=reviewed.get(entry.id);
  const policy=info.supported?'reviewed-progressive-contexts':restrictions.has(entry.inf)||paradigm.defective.length?'guarded-restricted-usage':clitic&&!['si'].includes(clitic)?'guarded-lexical-clitic':states.has(entry.inf)?'guarded-state-or-sense-dependent':'guarded-context-not-authored';
  const flagged=allFindings.filter(f=>(f.ids||[]).includes(entry.id));
  return {index,id:entry.id,inf:entry.inf,en:entry.en,base,clitic,gerund:info.gerund,gerundDiffersFromRegularSuffix:info.irregular,
    gerundCheck:'Rule/exception inventory; does not certify progressive semantic suitability.',
    usagePolicy:policy,progressiveProductionEnabled:info.supported,
    progressiveRestriction:info.supported?'Only reviewed selected action/weather senses; exact authored scenes and explicitly labelled whole-form retrieval.':info.limitation,
    sourceUsageReviewed:!!review,usageReviewBatch:review?.batch||null,usageReviewedFields:review?.reviewedFields||[],
    sourceUsageSHA256:crypto.createHash('sha256').update([entry.en,entry.usage,...(entry.patterns||[])].join('\n')).digest('hex'),
    storedPatterns:entry.patterns||[],sourceExamplesStored:(entry.examples||[]).length,
    sourceExamplesIndividuallyReviewed:review?.examplesIndividuallyReviewed===true,
    reviewedProgressiveContexts:{present:present.length,past:past.length,ids:[...present,...past].map(c=>c.id)},
    personScope:info.supported?(info.weather?'impersonal-third-singular':'six-person-and-formal-Lei'):restrictions.has(entry.inf)?'restricted-subject-or-form-review':'requires-context-selection',
    engineDefectiveTenses:paradigm.defective,sourceRestrictionSentences:(entry.usage||'').split(/(?<=[.!?])\s+/).filter(s=>/defective|third.person|no (?:past participle|other forms)|rare|only.*infinitive|no.*compound/i.test(s)),
    findings:flagged.map(f=>({type:f.type,status:f.status||'review',finding:f.finding,recommendation:f.recommendation,sources:f.sources||[]}))};
});
const missingReview=records.filter(row=>!row.sourceUsageReviewed).map(row=>row.id);
const unknownReviewed=[...reviewed.keys()].filter(id=>!records.some(row=>row.id===id));
if(unknownReviewed.length)throw new Error(`Unknown reviewed IDs: ${unknownReviewed.join(', ')}`);
if(new Set(records.map(row=>row.id)).size!==records.length)throw new Error('Duplicate catalog ID');
if(records.some(row=>!row.gerund||row.gerund===MISSING))throw new Error('Gerund inventory contains a missing form; investigate before using it as a reference.');
const audit={date:'2026-09-29',catalog:'data/verbs.json',scope:'All entries inventoried; individually read gloss/usage review coverage and additional fields are separately recorded below. Existing source examples have not all received independent sentence-level validation. No unreviewed sentence is generated into a progressive scene.',
  sources:[...PROGRESSIVE_SOURCES,'https://www.treccani.it/enciclopedia/sintassi_(Enciclopedia-dell%27Italiano)/','https://accademiadellacrusca.it/it/consulenza/verbi-difficili/221'],
  counts:{verbs:records.length,individuallyReviewedUsage:records.length-missingReview.length,missingUsageReviews:missingReview.length,sourceExamples:records.reduce((n,r)=>n+r.sourceExamplesStored,0),reviewedProgressiveSenses:records.filter(r=>r.progressiveProductionEnabled).length,reviewedPresentProgressiveContexts:records.reduce((n,r)=>n+r.reviewedProgressiveContexts.present,0),reviewedPastProgressiveContexts:records.reduce((n,r)=>n+r.reviewedProgressiveContexts.past,0),baseGerundExceptions:records.filter(r=>r.gerundDiffersFromRegularSuffix).length,cliticLemmas:records.filter(r=>r.clitic).length,engineDefectiveEntries:records.filter(r=>r.engineDefectiveTenses.length).length,multiwordInfinitives:records.filter(r=>/\s/.test(r.inf)).length,usagePolicies:countBy(records.map(r=>r.usagePolicy))},
  usageReviewFiles:batches.map(b=>b.path),missingReview,records};
fs.writeFileSync(new URL('docs/VERB-CONTENT-AUDIT-2026-09-29.json',root),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit.counts,null,2));
if(missingReview.length)console.log(`Usage review remains explicitly incomplete for ${missingReview.length} entries.`);
