import { LEVELS, levelIncludes } from './grounding.js';
import { wordException } from './language-scope.js';

const normalize = text => text.normalize('NFC').replace(/[’‘]/g,"'").toLocaleLowerCase('it');
const tokens = text => [...text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}]+)*/gu)].map(match=>({start:match.index,end:match.index+match[0].length,text:match[0]}));
const spanOK = (span,text) => Number.isInteger(span?.start) && Number.isInteger(span?.end) && span.start>=0 && span.end>span.start && span.end<=text.length;
const contains = (span,token) => span.start<=token.start && span.end>=token.end;
const reviewed = record => record?.verified===true && typeof record.source==='string' && record.source.trim() && LEVELS.includes(record.level);

/** The analyzer only proposes sense/form/structure identities. Every proposed
 * identity is checked against a reviewed registry and its independent context
 * verifier. Token recognition alone never certifies a grammatical sentence.
 * A production registry/analyzer must be reviewed separately before activation.
 */
export function createLanguagePolicy({ version, senses=[], constructions=[], analyze, limits={} }={}) {
  if(typeof version!=='string'||!version.trim()||typeof analyze!=='function')throw new TypeError('A versioned, reviewed language analyzer is required');
  const senseMap=new Map(),constructionMap=new Map(),surfaceOwners=new Map();
  for(const sense of senses){
    if(!reviewed(sense)||!sense.id||senseMap.has(sense.id)||!Array.isArray(sense.forms)||!sense.forms.length)throw new TypeError('Invalid reviewed language sense');
    const forms=new Map();
    for(const form of sense.forms){
      if(!form?.id||forms.has(form.id)||typeof form.text!=='string'||!form.text.trim()||!LEVELS.includes(form.level))throw new TypeError('Every inflected form needs its own level and identity');
      forms.set(form.id,Object.freeze({...form}));
      const key=normalize(form.text),owners=surfaceOwners.get(key)||new Set();owners.add(JSON.stringify([sense.id,form.id]));surfaceOwners.set(key,owners);
    }
    senseMap.set(sense.id,{...sense,forms});
  }
  for(const construction of constructions){
    if(!reviewed(construction)||!construction.id||constructionMap.has(construction.id)||typeof construction.confirmUse!=='function')throw new TypeError('Every construction needs a reviewed verifier');
    constructionMap.set(construction.id,{...construction});
  }
  return {
    version,
    async validate(text,{request}={}){
      const reasons=[],usedSenses=new Set(),usedConstructions=new Set(),exceptions=new Set();
      if(typeof text!=='string'||!text.trim()||text.length>1200||!LEVELS.includes(request?.level))return {ok:false,reasons:['invalid language text or level']};
      const words=tokens(text),analysis=await analyze(text,{request,version});
      if(!words.length||!analysis||!Array.isArray(analysis.lexemes)||!Array.isArray(analysis.constructions))return {ok:false,reasons:['language analysis is unresolved']};
      const ranges=[],grammar=[];
      for(const lexeme of analysis.lexemes){
        if(!spanOK(lexeme,text)){reasons.push('invalid lexical span');continue;}
        const sense=senseMap.get(lexeme.senseId),form=sense?.forms.get(lexeme.formId),surface=text.slice(lexeme.start,lexeme.end);
        if(!sense||!form||normalize(surface)!==normalize(form.text)){reasons.push('unknown sense or inflected form');continue;}
        const exception=wordException(request,sense.id,surface);
        // A requested higher-level word can bring its selected surface into
        // this turn. It cannot enable other forms of the verb or constructions.
        if((!levelIncludes(request.level,sense.level)||!levelIncludes(request.level,form.level))&&!exception){reasons.push('sense or form exceeds the selected level');continue;}
        const ambiguous=surfaceOwners.get(normalize(surface)).size>1;
        if((ambiguous||typeof sense.confirmUse==='function') && (typeof sense.confirmUse!=='function'||await sense.confirmUse({text,span:lexeme,request,formId:form.id})!==true)){reasons.push('contextual meaning is unresolved');continue;}
        if(!words.some(word=>word.start===lexeme.start)||!words.some(word=>word.end===lexeme.end)){reasons.push('lexical span splits a word');continue;}
        ranges.push(lexeme);usedSenses.add(sense.id);if(exception)exceptions.add(sense.id);
      }
      const names=[request.learnerName,...(request.participants||[]).map(participant=>participant.name),...(request.knownNames||[])].filter(name=>typeof name==='string'&&name.trim());
      for(const name of analysis.names||[]){
        if(!spanOK(name,text)||!names.includes(text.slice(name.start,name.end))){reasons.push('unconfirmed proper name');continue;}ranges.push(name);
      }
      for(const number of analysis.numbers||[]){
        if(!spanOK(number,text)||!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(text.slice(number.start,number.end))){reasons.push('unresolved numeric expression');continue;}ranges.push(number);
      }
      for(const word of words)if(ranges.filter(span=>contains(span,word)).length!==1)reasons.push('unknown or ambiguously covered word');
      for(const item of analysis.constructions){
        const construction=constructionMap.get(item.id);
        if(!spanOK(item,text)||!construction){reasons.push('unknown construction');continue;}
        if(!levelIncludes(request.level,construction.level)){reasons.push('construction exceeds the selected level');continue;}
        if(await construction.confirmUse({text,span:item,request,lexemes:analysis.lexemes})!==true){reasons.push('construction is not verified in this context');continue;}
        grammar.push(item);usedConstructions.add(construction.id);
      }
      if(words.some(word=>!grammar.some(span=>contains(span,word))))reasons.push('sentence structure is unresolved');
      const ceiling=limits[request.level];
      if(ceiling?.maxWords && words.length>ceiling.maxWords)reasons.push('reply exceeds the reviewed length limit');
      return {ok:reasons.length===0,reasons:[...new Set(reasons)],version,senseIds:[...usedSenses],constructionIds:[...usedConstructions],exceptionSenseIds:[...exceptions]};
    },
  };
}
