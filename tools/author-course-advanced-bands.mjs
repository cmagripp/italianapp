#!/usr/bin/env node
// Source-preserving band-only refinement. C1/C2 historical author tools are
// absent; the released pack is the retained canonical input for these edits.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {refinePhase6AdvancedPack} from './phase6-advanced.mjs';
const selected=process.argv.includes('--level')?process.argv[process.argv.indexOf('--level')+1]:null;
if(selected&&!['B2','C1','C2'].includes(selected))throw Error('Unknown advanced level: '+selected);
for(const level of selected?[selected]:['B2','C1','C2']){
 const file=new URL('../data/course-v2/'+level+'.json',import.meta.url),pack=JSON.parse(process.argv.includes('--from-baseline')?execFileSync('git',['show','7eeeb36:data/course-v2/'+level+'.json'],{encoding:'utf8'}):fs.readFileSync(file));
 refinePhase6AdvancedPack(pack);fs.writeFileSync(file,JSON.stringify(pack,null,2)+'\n');
 console.log(level+': '+pack.phase6Editorial.decisions.filter(d=>d.changedStepIds.length).length+' specified transfer cards repaired; retained target/question/source identities preserved.');
}
