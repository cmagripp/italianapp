// Editorial identifiers survive changes to glosses or examples. Old headword
// records remain addressable, with their original lesson content and progress.
// An ambiguous split never copies an old completion into its new sense lessons.
export function applyEditorialSenses(vocab, registry) {
  if(registry.schemaVersion!==1)throw new Error('Unsupported lexical-sense schema');
  const byId=new Map(vocab.map(e=>[e.id,e])),seen=new Set(byId.keys()),senseIds=new Set(),additions=[];
  for(const group of registry.entries){
    const entry=byId.get(group.entryId);
    if(!entry)throw new Error(`Unknown sense headword ${group.entryId}`);
    if(!Array.isArray(group.senses)||group.senses.length<2)throw new Error(`A split needs distinct senses: ${entry.id}`);
    entry.legacyGrouping=true;
    entry.senseEntryIds=[];
    for(const source of group.senses){
      if(!/^[a-z][a-z0-9-]*$/.test(source.key))throw new Error(`Invalid editorial sense key ${source.key}`);
      const id=`${entry.id}#${source.key}`,senseId=`it:${entry.it}:${entry.pos}:${source.key}`;
      if(seen.has(id)||senseIds.has(senseId))throw new Error(`Duplicate sense ${senseId}`);
      if(!source.sources?.length||!source.sources.every(url=>url.startsWith('https://')))throw new Error(`Missing provenance ${id}`);
      seen.add(id);senseIds.add(senseId);entry.senseEntryIds.push(id);
      const {key,sources,...fields}=source;
      // Copy lexical identity, not a different meaning's feminine/plural/notes.
      const child={id,it:entry.it,pos:entry.pos,...fields,parentEntryId:entry.id,senseId,
        sense:{schemaVersion:1,contentVersion:registry.contentVersion,senseId,entryId:entry.id,
          partOfSpeech:entry.pos,glosses:fields.en.split(/;\s*/),level:fields.level,
          forms:{gender:fields.g,plural:fields.pl},constructions:[],
          provenance:{sources,authoredAt:'2026-10-03',levelBasis:registry.levelBasis,reviewStatus:registry.reviewStatus}}};
      additions.push(child);
    }
  }
  return [...vocab,...additions];
}
