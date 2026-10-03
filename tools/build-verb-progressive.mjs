import fs from 'node:fs';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
const verbs=read('data/verbs.json'),data=Object.create(null);
const batches={beginner:['A1','A2'],intermediate:['B1','B2'],advanced:['C1','C2']};
for(const [batch,levels] of Object.entries(batches)){
  const records=read(`data/verb-progressive/${batch}.json`);
  assert(Array.isArray(records),batch);
  for(const record of records){
    const entry=verbs.find(e=>e.inf===record.inf);
    assert(entry&&levels.includes(entry.level),`${batch}: unexpected ${record.inf}`);
    assert(!data[record.inf],`Duplicate ${record.inf}`);
    assert(['dynamic','sense-dependent','simple'].includes(record.policy),record.inf+' policy');
    assert(record.sense?.trim()&&record.note?.trim(),record.inf+' explanation');
    if(record.frameEn){
      assert(record.sceneRevision?.trim()&&record.legacyExpandedRevision?.trim()&&record.sceneRevision!==record.legacyExpandedRevision,record.inf+' frame predicates need distinct source revisions');
      assert(Object.hasOwn(record,'legacyExpandedFrameEn')&&Object.hasOwn(record,'legacyFrameEn'),record.inf+' exact previous frame predicates required');
      assert(record.legacyExpandedEn&&record.legacyExpandedFrames&&record.legacyFrames,record.inf+' frame predicates require exact prior default and frames');
    }
    for(const field of ['frameEn','legacyExpandedFrameEn','legacyFrameEn'])if(Object.hasOwn(record,field)&&record[field]!==null){
      const table=record[field],frames=field==='legacyExpandedFrameEn'?record.legacyExpandedFrames:field==='legacyFrameEn'?record.legacyFrames:record.frames;
      assert(table&&typeof table==='object'&&!Array.isArray(table)&&Object.keys(table).length&&Object.keys(table).every(key=>/^(0|[1-9]\d*)$/.test(key)&&frames?.[Number(key)]),record.inf+' exact indexed frame predicates');
      for(const en of Object.values(table))assert(Array.isArray(en)&&en.length===4&&en.slice(0,3).every(text=>typeof text==='string'&&text.trim())&&(record.policy==='simple'?typeof en[3]==='string':en[3]?.trim()),record.inf+' four frame predicates');
    }
    if(record.legacyExpandedEn){
      assert(record.sceneRevision?.trim()&&record.legacyExpandedRevision?.trim()&&record.sceneRevision!==record.legacyExpandedRevision,record.inf+' distinct English scene revisions');
      for(const field of ['legacyExpandedEn','legacyEn'])assert(Array.isArray(record[field])&&record[field].length===4&&record[field].every(s=>typeof s==='string'&&s.trim()),record.inf+' exact prior English predicates');
      assert(record.legacyExpandedFrames&&record.legacyFrames,record.inf+' prior English requires the exact prior frames');
    }
    if(record.legacyExpandedRevisionAliases){
      const aliases=record.legacyExpandedRevisionAliases;
      assert(record.sceneRevision&&record.legacyExpandedRevision,record.inf+' prior aliases need explicit revisions');
      assert(Array.isArray(aliases)&&aliases.length>0&&aliases.length<=8&&new Set(aliases).size===aliases.length&&aliases.every(s=>typeof s==='string'&&s.trim()&&s.length<=500&&s!==record.sceneRevision&&s!==record.legacyExpandedRevision),record.inf+' bounded distinct prior aliases');
      assert(record.legacyExpandedFrames||record.legacyExpandedExamples||record.legacyExpandedSourceContexts||Object.hasOwn(record,'legacyExpandedImperfectEn'),record.inf+' aliases lack a declared exact previous source');
    }
    if(Object.hasOwn(record,'legacyExpandedImperfectEn')){
      assert(record.sceneRevision?.trim()&&record.legacyExpandedRevision?.trim()&&record.sceneRevision!==record.legacyExpandedRevision,record.inf+' distinct imperfect scene revisions');
      assert(record.imperfectEn?.trim()&&(record.legacyExpandedImperfectEn===null||typeof record.legacyExpandedImperfectEn==='string'&&record.legacyExpandedImperfectEn.trim()),record.inf+' exact prior imperfect predicate');
      assert(Object.hasOwn(record,'legacyImperfectEn')&&(record.legacyImperfectEn===null||typeof record.legacyImperfectEn==='string'&&record.legacyImperfectEn.trim()),record.inf+' baseline imperfect preservation');
    }
    if(record.legacyExpandedExamples){
      assert(record.sceneRevision?.trim()&&record.legacyExpandedRevision?.trim()&&record.sceneRevision!==record.legacyExpandedRevision,record.inf+' distinct source scene revisions');
      assert(record.legacyExpandedExamples.length===entry.examples.length&&record.legacyExpandedExamples.every(e=>e.it?.trim()&&e.en?.trim()),record.inf+' prior source examples');
    }
    if(record.legacyExpandedSourceContexts){
      assert(record.sceneRevision?.trim()&&record.legacyExpandedRevision?.trim()&&record.sceneRevision!==record.legacyExpandedRevision,record.inf+' distinct span scene revisions');
      assert(new Set(record.legacyExpandedSourceContexts.map(c=>c.id)).size===record.legacyExpandedSourceContexts.length,record.inf+' duplicate prior source context');
      for(const c of record.legacyExpandedSourceContexts){
        assert(c.id.startsWith(entry.id+':'+c.chapter+':dictionary-')&&['present','past','background','future','condizionale'].includes(c.chapter),record.inf+' prior source context identity');
        assert(c.it?.trim()&&c.en?.trim()&&c.answer?.trim()&&c.it.includes(c.answer)&&c.answers?.includes(c.answer)&&Number.isInteger(c.person)&&c.person>=0&&c.person<=5&&c.role==='ordinary'&&c.source==='dictionary-exact',record.inf+' prior source context fields');
      }
    }
    if(record.retiredExpandedContextIds){
      assert(record.legacyExpandedRevision&&record.retiredExpandedContextIds.length&&new Set(record.retiredExpandedContextIds).size===record.retiredExpandedContextIds.length,record.inf+' retired source identities');
      const frameIndexes=record.retiredExpandedFrameIndexes||[];
      assert(new Set(frameIndexes).size===frameIndexes.length&&frameIndexes.every(index=>Number.isInteger(index)&&record.legacyExpandedFrames?.[index]&&record.frames?.[index]),record.inf+' retired frame lacks exact current/prior record');
      const priorFrameId=id=>{
        const prefix=entry.id+':';if(!id.startsWith(prefix))return false;
        const suffix=id.slice(prefix.length),authored=suffix.match(/^(present|background):v2:(simple|progressive):scene-(\d+)-([0-5])-(ordinary|formal)$/),finite=suffix.match(/^(past|future|condizionale):reviewed-frame-(\d+):(person-[0-5]|formal)$/);
        return authored?frameIndexes.includes(Number(authored[3]))&&(authored[5]!=='formal'||authored[4]==='2'):finite?frameIndexes.includes(Number(finite[2])):false;
      };
      assert(record.retiredExpandedContextIds.every(id=>record.legacyExpandedSourceContexts?.some(c=>c.id===id)||priorFrameId(id)),record.inf+' retirement lacks exact prior source/frame identity');
    }
    if(record.frames){
      assert(record.frames.length>=4,record.inf+' needs four situations');
      if(record.legacyFrameCount!==undefined)assert(Number.isInteger(record.legacyFrameCount)&&record.legacyFrameCount>=4&&record.legacyFrameCount<=record.frames.length,record.inf+' legacy frame count');
      assert(new Set(record.frames.map(f=>f[0])).size===record.frames.length,record.inf+' repeated Italian frames');
      assert(record.frames.every(f=>Array.isArray(f)&&f.length===2&&f.every(x=>typeof x==='string')),record.inf+' frames');
      if(record.legacyFrames)assert(record.legacyFrames.length===(record.legacyFrameCount??record.frames.length)&&record.legacyFrames.every(f=>Array.isArray(f)&&f.length===2&&f.every(x=>typeof x==='string')),record.inf+' legacy frames');
      if(record.legacyExpandedFrames){
        assert(record.sceneRevision?.trim()&&record.legacyExpandedRevision?.trim()&&record.sceneRevision!==record.legacyExpandedRevision,record.inf+' distinct scene revisions');
        assert(record.legacyExpandedFrames.length===record.frames.length&&record.legacyExpandedFrames.every(f=>Array.isArray(f)&&f.length===2&&f.every(x=>typeof x==='string')),record.inf+' legacy expanded frames');
      }
      assert(Array.isArray(record.en)&&record.en.length===4,record.inf+' English predicates');
      assert(record.en.slice(0,3).every(x=>typeof x==='string'&&x.trim()),record.inf+' English finite predicates');
      if(record.policy!=='simple')assert(record.en[3]?.trim(),record.inf+' progressive predicate');
    }else{
      assert(record.simpleExamples?.length>=4,record.inf+' needs four exact simple examples');
      if(record.policy!=='simple')assert(record.progressiveExamples?.length>=4,record.inf+' needs four exact progressive examples');
    }
    for(const field of ['simpleExamples','progressiveExamples'])for(const scene of record[field]||[]){
      if(scene.section)assert(['practice','mixed'].includes(scene.section),record.inf+' scene section');
      assert(scene.it?.trim()&&scene.en?.trim()&&scene.answer?.trim(),`${record.inf} ${field}`);
      assert(scene.it.toLocaleLowerCase('it').includes(scene.answer.toLocaleLowerCase('it')),record.inf+' answer span');
      assert(Number.isInteger(scene.person)&&scene.person>=0&&scene.person<=5,record.inf+' person');
      if(scene.past){
        assert(scene.past.it?.trim()&&scene.past.en?.trim()&&scene.past.answer?.trim(),record.inf+' past scene');
        assert(scene.past.it.toLocaleLowerCase('it').includes(scene.past.answer.toLocaleLowerCase('it')),record.inf+' past answer span');
      }
    }
    if(record.persons)assert(record.persons.length&&record.persons.every(p=>Number.isInteger(p)&&p>=0&&p<=5),record.inf+' persons');
    data[record.inf]=record;
  }
  assert.equal(records.length,verbs.filter(e=>levels.includes(e.level)).length,batch+' coverage');
}
assert.equal(Object.keys(data).length,verbs.length,'Every verb needs a reviewed policy');
const ordered=Object.fromEntries(Object.entries(data).sort(([a],[b])=>a.localeCompare(b,'it')));
const source='// Generated by tools/build-verb-progressive.mjs. Do not edit by hand.\nexport const VERB_PROGRESSIVE_DATA = '+JSON.stringify(ordered)+';\n';
const destination=new URL('js/learning/verb-progressive-data.js',root);
if(process.argv.includes('--check'))assert(fs.readFileSync(destination,'utf8')===source,'Rebuild verb progressive bundle with node tools/build-verb-progressive.mjs');
else fs.writeFileSync(destination,source);
console.log(`${verbs.length} verb policies bundled: ${Object.entries(batches).map(([b,l])=>`${b} ${verbs.filter(e=>l.includes(e.level)).length}`).join(', ')}.`);
