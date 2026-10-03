#!/usr/bin/env node
// Spot checks for the conjugation engine. Run: node tools/test-conjugator.mjs
import { conjugate, primary, accepted, isCorrectForm, irregularCells, irregularAlternatives, regularParadigm, MISSING } from '../js/conjugator.js';

let fails = 0, checks = 0;
function eq(inf, tense, i, expected, meta) {
  checks++;
  const c = conjugate(inf, meta);
  const forms = tense === 'pp' ? [c.nonFinite.participioPassato] : tense === 'ger' ? [c.nonFinite.gerundio] : c.tenses[tense];
  const got = forms ? forms[tense === 'pp' || tense === 'ger' ? 0 : i] : null;
  const ok = got != null && accepted(got).includes(expected);
  if (!ok) { fails++; console.log(`FAIL ${inf} ${tense}[${i}]: expected "${expected}", got "${got}"`); }
}
const T = (inf, spec, meta) => {
  for (const [tense, arr] of Object.entries(spec)) {
    if (Array.isArray(arr)) arr.forEach((f, i) => f != null && eq(inf, tense, i, f, meta));
    else eq(inf, tense, 0, arr, meta);
  }
};

// Regular -are with spelling changes
T('parlare', { presente: ['parlo', 'parli', 'parla', 'parliamo', 'parlate', 'parlano'], futuro: ['parlerò', 'parlerai', 'parlerà', 'parleremo', 'parlerete', 'parleranno'], passatoRemoto: ['parlai', 'parlasti', 'parlò', 'parlammo', 'parlaste', 'parlarono'], congiuntivoPresente: ['parli', 'parli', 'parli', 'parliamo', 'parliate', 'parlino'], imperativo: ['parla', 'parli', 'parliamo', 'parlate', 'parlino'], pp: 'parlato', ger: 'parlando' });
T('cercare', { presente: ['cerco', 'cerchi', 'cerca', 'cerchiamo', 'cercate', 'cercano'], futuro: ['cercherò'], congiuntivoPresente: ['cerchi', null, null, 'cerchiamo', 'cerchiate', 'cerchino'] });
T('pagare', { presente: ['pago', 'paghi', 'paga', 'paghiamo'], futuro: ['pagherò'], condizionale: ['pagherei'] });
T('cominciare', { presente: ['comincio', 'cominci', 'comincia', 'cominciamo', 'cominciate', 'cominciano'], futuro: ['comincerò'], congiuntivoPresente: ['cominci', null, null, 'cominciamo', 'cominciate', 'comincino'] });
T('mangiare', { presente: ['mangio', 'mangi', 'mangia', 'mangiamo'], futuro: ['mangerò'], imperativo: ['mangia', 'mangi', 'mangiamo', 'mangiate', 'mangino'] });
T('lasciare', { presente: ['lascio', 'lasci', 'lascia', 'lasciamo'], futuro: ['lascerò'] });
T('studiare', { presente: ['studio', 'studi', 'studia', 'studiamo', 'studiate', 'studiano'], futuro: ['studierò'], congiuntivoPresente: ['studi', 'studi', 'studi', 'studiamo', 'studiate', 'studino'] });
T('inviare', { presente: ['invio', 'invii', 'invia', 'inviamo', 'inviate', 'inviano'], futuro: ['invierò'], congiuntivoPresente: ['invii', null, null, 'inviamo', 'inviate', 'inviino'] });
T('sciare', { presente: ['scio', 'scii', 'scia', 'sciamo', 'sciate', 'sciano'], futuro: ['scierò'] });
T('tagliare', { presente: ['taglio', 'tagli', 'taglia', 'tagliamo'], futuro: ['taglierò'] });
T('sognare', { presente: ['sogno', 'sogni', 'sogna', 'sogniamo', 'sognate', 'sognano'] });
// Regular -ere / -ire
T('credere', { presente: ['credo', 'credi', 'crede', 'crediamo', 'credete', 'credono'], passatoRemoto: ['credei', 'credesti', 'credé', 'credemmo', 'credeste', 'crederono'], futuro: ['crederò'], pp: 'creduto', congiuntivoImperfetto: ['credessi', null, 'credesse', 'credessimo', 'credeste', 'credessero'], imperativo: ['credi', 'creda', 'crediamo', 'credete', 'credano'] });
T('vendere', { passatoRemoto: ['vendetti', null, 'vendette', null, null, 'vendettero'], pp: 'venduto' });
T('dormire', { presente: ['dormo', 'dormi', 'dorme', 'dormiamo', 'dormite', 'dormono'], passatoRemoto: ['dormii', 'dormisti', 'dormì', 'dormimmo', 'dormiste', 'dormirono'], futuro: ['dormirò'], pp: 'dormito', ger: 'dormendo', imperativo: ['dormi', 'dorma', 'dormiamo', 'dormite', 'dormano'] }, { isc: false });
T('capire', { presente: ['capisco', 'capisci', 'capisce', 'capiamo', 'capite', 'capiscono'], congiuntivoPresente: ['capisca', 'capisca', 'capisca', 'capiamo', 'capiate', 'capiscano'], imperativo: ['capisci', 'capisca', 'capiamo', 'capite', 'capiscano'], imperfetto: ['capivo'], pp: 'capito' }, { isc: true });
T('finire', { presente: ['finisco', null, null, 'finiamo', 'finite', 'finiscono'] });
T('partire', { presente: ['parto', 'parti', 'parte'] });
// Highly irregular
T('essere', { presente: ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'], imperfetto: ['ero', 'eri', 'era', 'eravamo', 'eravate', 'erano'], passatoRemoto: ['fui', 'fosti', 'fu', 'fummo', 'foste', 'furono'], futuro: ['sarò', 'sarai', 'sarà', 'saremo', 'sarete', 'saranno'], condizionale: ['sarei', 'saresti', 'sarebbe', 'saremmo', 'sareste', 'sarebbero'], congiuntivoPresente: ['sia', 'sia', 'sia', 'siamo', 'siate', 'siano'], congiuntivoImperfetto: ['fossi', 'fossi', 'fosse', 'fossimo', 'foste', 'fossero'], imperativo: ['sii', 'sia', 'siamo', 'siate', 'siano'], pp: 'stato', ger: 'essendo', passatoProssimo: ['sono stato/a', 'sei stato/a', 'è stato/a', 'siamo stati/e', 'siete stati/e', 'sono stati/e'] }, { aux: 'essere' });
T('avere', { presente: ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'], passatoRemoto: ['ebbi', 'avesti', 'ebbe', 'avemmo', 'aveste', 'ebbero'], futuro: ['avrò'], congiuntivoPresente: ['abbia', null, null, 'abbiamo', 'abbiate', 'abbiano'], imperativo: ['abbi', 'abbia', 'abbiamo', 'abbiate', 'abbiano'], pp: 'avuto', passatoProssimo: ['ho avuto', 'hai avuto', 'ha avuto', 'abbiamo avuto', 'avete avuto', 'hanno avuto'] });
T('andare', { presente: ['vado', 'vai', 'va', 'andiamo', 'andate', 'vanno'], futuro: ['andrò', 'andrai', 'andrà', 'andremo', 'andrete', 'andranno'], condizionale: ['andrei'], congiuntivoPresente: ['vada', 'vada', 'vada', 'andiamo', 'andiate', 'vadano'], imperativo: ["va'", 'vada', 'andiamo', 'andate', 'vadano'], passatoRemoto: ['andai', 'andasti', 'andò'], pp: 'andato', passatoProssimo: ['sono andato/a', null, null, 'siamo andati/e'] }, { aux: 'essere' });
T('stare', { presente: ['sto', 'stai', 'sta', 'stiamo', 'state', 'stanno'], passatoRemoto: ['stetti', 'stesti', 'stette', 'stemmo', 'steste', 'stettero'], futuro: ['starò'], congiuntivoPresente: ['stia'], congiuntivoImperfetto: ['stessi'], imperativo: ["sta'", 'stia', 'stiamo', 'state', 'stiano'], pp: 'stato' });
T('dare', { presente: ['do', 'dai', 'dà', 'diamo', 'date', 'danno'], passatoRemoto: ['diedi', 'desti', 'diede', 'demmo', 'deste', 'diedero'], futuro: ['darò'], congiuntivoPresente: ['dia'], congiuntivoImperfetto: ['dessi'], imperativo: ["da'", 'dia', 'diamo', 'date', 'diano'] });
T('fare', { presente: ['faccio', 'fai', 'fa', 'facciamo', 'fate', 'fanno'], imperfetto: ['facevo', 'facevi', 'faceva', 'facevamo', 'facevate', 'facevano'], passatoRemoto: ['feci', 'facesti', 'fece', 'facemmo', 'faceste', 'fecero'], futuro: ['farò'], condizionale: ['farei'], congiuntivoPresente: ['faccia', 'faccia', 'faccia', 'facciamo', 'facciate', 'facciano'], congiuntivoImperfetto: ['facessi', null, 'facesse', 'facessimo', 'faceste', 'facessero'], imperativo: ["fa'", 'faccia', 'facciamo', 'fate', 'facciano'], pp: 'fatto', ger: 'facendo' });
T('dire', { presente: ['dico', 'dici', 'dice', 'diciamo', 'dite', 'dicono'], imperfetto: ['dicevo'], passatoRemoto: ['dissi', 'dicesti', 'disse', 'dicemmo', 'diceste', 'dissero'], futuro: ['dirò'], congiuntivoPresente: ['dica', 'dica', 'dica', 'diciamo', 'diciate', 'dicano'], imperativo: ["di'", 'dica', 'diciamo', 'dite', 'dicano'], pp: 'detto', ger: 'dicendo' });
T('bere', { presente: ['bevo', 'bevi', 'beve', 'beviamo', 'bevete', 'bevono'], imperfetto: ['bevevo'], passatoRemoto: ['bevvi', 'bevesti', 'bevve', 'bevemmo', 'beveste', 'bevvero'], futuro: ['berrò'], congiuntivoPresente: ['beva'], pp: 'bevuto', ger: 'bevendo' });
T('venire', { presente: ['vengo', 'vieni', 'viene', 'veniamo', 'venite', 'vengono'], passatoRemoto: ['venni', 'venisti', 'venne', 'venimmo', 'veniste', 'vennero'], futuro: ['verrò'], congiuntivoPresente: ['venga', null, null, 'veniamo', 'veniate', 'vengano'], imperativo: ['vieni', 'venga', 'veniamo', 'venite', 'vengano'], pp: 'venuto' });
T('tenere', { presente: ['tengo', 'tieni', 'tiene', 'teniamo', 'tenete', 'tengono'], passatoRemoto: ['tenni', 'tenesti', 'tenne'], futuro: ['terrò'], pp: 'tenuto' });
T('volere', { presente: ['voglio', 'vuoi', 'vuole', 'vogliamo', 'volete', 'vogliono'], passatoRemoto: ['volli', 'volesti', 'volle', 'volemmo', 'voleste', 'vollero'], futuro: ['vorrò'], condizionale: ['vorrei', 'vorresti', 'vorrebbe', 'vorremmo', 'vorreste', 'vorrebbero'], congiuntivoPresente: ['voglia', null, null, 'vogliamo', 'vogliate', 'vogliano'] });
T('potere', { presente: ['posso', 'puoi', 'può', 'possiamo', 'potete', 'possono'], futuro: ['potrò'], congiuntivoPresente: ['possa', null, null, 'possiamo', 'possiate', 'possano'], passatoRemoto: ['potei', 'potesti'] });
T('dovere', { presente: ['devo', 'devi', 'deve', 'dobbiamo', 'dovete', 'devono'], futuro: ['dovrò'], congiuntivoPresente: ['debba', null, null, 'dobbiamo', 'dobbiate', 'debbano'] });
T('sapere', { presente: ['so', 'sai', 'sa', 'sappiamo', 'sapete', 'sanno'], passatoRemoto: ['seppi', 'sapesti', 'seppe'], futuro: ['saprò'], congiuntivoPresente: ['sappia'], imperativo: ['sappi', 'sappia', 'sappiamo', 'sappiate', 'sappiano'] });
T('uscire', { presente: ['esco', 'esci', 'esce', 'usciamo', 'uscite', 'escono'], congiuntivoPresente: ['esca', null, null, 'usciamo', 'usciate', 'escano'], imperativo: ['esci', 'esca', 'usciamo', 'uscite', 'escano'], futuro: ['uscirò'] });
T('riuscire', { presente: ['riesco', 'riesci', 'riesce', 'riusciamo', 'riuscite', 'riescono'], pp: 'riuscito' });
T('salire', { presente: ['salgo', 'sali', 'sale', 'saliamo', 'salite', 'salgono'], congiuntivoPresente: ['salga'] });
T('morire', { presente: ['muoio', 'muori', 'muore', 'moriamo', 'morite', 'muoiono'], pp: 'morto', futuro: ['morirò'] });
T('rimanere', { presente: ['rimango', 'rimani', 'rimane', 'rimaniamo', 'rimanete', 'rimangono'], passatoRemoto: ['rimasi', 'rimanesti', 'rimase'], futuro: ['rimarrò'], pp: 'rimasto' });
T('piacere', { presente: ['piaccio', 'piaci', 'piace', 'piacciamo', 'piacete', 'piacciono'], passatoRemoto: ['piacqui', 'piacesti', 'piacque'], pp: 'piaciuto', congiuntivoPresente: ['piaccia'] });
T('conoscere', { presente: ['conosco', 'conosci', 'conosce', 'conosciamo'], passatoRemoto: ['conobbi', 'conoscesti', 'conobbe'], pp: 'conosciuto' });
T('nascere', { passatoRemoto: ['nacqui', 'nascesti', 'nacque', 'nascemmo', 'nasceste', 'nacquero'], pp: 'nato' });
T('vedere', { passatoRemoto: ['vidi', 'vedesti', 'vide'], futuro: ['vedrò'], pp: 'visto' });
T('vivere', { passatoRemoto: ['vissi', 'vivesti', 'visse'], futuro: ['vivrò'], pp: 'vissuto' });
T('cadere', { passatoRemoto: ['caddi', 'cadesti', 'cadde'], futuro: ['cadrò'], pp: 'caduto' });
T('prendere', { passatoRemoto: ['presi', 'prendesti', 'prese', 'prendemmo', 'prendeste', 'presero'], pp: 'preso', presente: ['prendo'], futuro: ['prenderò'] });
T('comprendere', { passatoRemoto: ['compresi', 'comprendesti'], pp: 'compreso' });
T('sorprendere', { pp: 'sorpreso' });
T('mettere', { passatoRemoto: ['misi', 'mettesti', 'mise'], pp: 'messo' });
T('promettere', { passatoRemoto: ['promisi'], pp: 'promesso' });
T('smettere', { pp: 'smesso', presente: ['smetto'] });
T('scrivere', { passatoRemoto: ['scrissi'], pp: 'scritto' });
T('descrivere', { pp: 'descritto' });
T('leggere', { passatoRemoto: ['lessi', 'leggesti', 'lesse'], pp: 'letto' });
T('chiudere', { passatoRemoto: ['chiusi'], pp: 'chiuso' });
T('concludere', { passatoRemoto: ['conclusi', 'concludesti'], pp: 'concluso', presente: ['concludo'] });
T('decidere', { passatoRemoto: ['decisi'], pp: 'deciso' });
T('ridere', { pp: 'riso', passatoRemoto: ['risi'] });
T('sorridere', { pp: 'sorriso' });
T('correre', { pp: 'corso', passatoRemoto: ['corsi'] });
T('scegliere', { presente: ['scelgo', 'scegli', 'sceglie', 'scegliamo', 'scegliete', 'scelgono'], passatoRemoto: ['scelsi'], pp: 'scelto', congiuntivoPresente: ['scelga', null, null, 'scegliamo', 'scegliate', 'scelgano'] });
T('raccogliere', { presente: ['raccolgo', 'raccogli'], pp: 'raccolto' });
T('togliere', { presente: ['tolgo'], pp: 'tolto' });
T('spegnere', { presente: ['spengo', 'spegni'], pp: 'spento' });
T('vincere', { pp: 'vinto', passatoRemoto: ['vinsi'] });
T('convincere', { pp: 'convinto' });
T('piangere', { pp: 'pianto', passatoRemoto: ['piansi'] });
T('rompere', { passatoRemoto: ['ruppi'], pp: 'rotto' });
T('interrompere', { pp: 'interrotto' });
T('muovere', { pp: 'mosso' });
T('chiedere', { pp: 'chiesto', passatoRemoto: ['chiesi'] });
T('rispondere', { pp: 'risposto', passatoRemoto: ['risposi'] });
T('nascondere', { pp: 'nascosto' });
T('scendere', { pp: 'sceso' });
T('accendere', { pp: 'acceso' });
T('spendere', { pp: 'speso' });
T('dipendere', { pp: 'dipeso' });
T('perdere', { pp: 'perso', passatoRemoto: ['persi'] });
T('discutere', { pp: 'discusso' });
T('succedere', { pp: 'successo' });
T('esprimere', { pp: 'espresso', passatoRemoto: ['espressi', 'esprimesti'] });
T('risolvere', { pp: 'risolto' });
T('porre', { presente: ['pongo', 'poni', 'pone', 'poniamo', 'ponete', 'pongono'], imperfetto: ['ponevo'], passatoRemoto: ['posi', 'ponesti', 'pose'], futuro: ['porrò'], congiuntivoPresente: ['ponga'], pp: 'posto', ger: 'ponendo' });
T('proporre', { presente: ['propongo', 'proponi'], pp: 'proposto', futuro: ['proporrò'], imperfetto: ['proponevo'] });
T('trarre', { presente: ['traggo', 'trai', 'trae', 'traiamo', 'traete', 'traggono'], passatoRemoto: ['trassi', 'traesti'], futuro: ['trarrò'], pp: 'tratto', ger: 'traendo' });
T('attrarre', { pp: 'attratto', presente: ['attraggo'] });
T('tradurre', { presente: ['traduco', 'traduci', 'traduce', 'traduciamo', 'traducete', 'traducono'], imperfetto: ['traducevo'], passatoRemoto: ['tradussi', 'traducesti', 'tradusse'], futuro: ['tradurrò'], pp: 'tradotto', ger: 'traducendo', congiuntivoPresente: ['traduca'] });
T('produrre', { pp: 'prodotto' });
T('aprire', { pp: 'aperto', presente: ['apro'] });
T('scoprire', { pp: 'scoperto' });
T('offrire', { pp: 'offerto' });
T('costruire', { presente: ['costruisco'], pp: 'costruito' });
T('apparire', { presente: ['appaio'], pp: 'apparso', passatoRemoto: ['apparvi'] });
T('ottenere', { presente: ['ottengo', 'ottieni'], futuro: ['otterrò'], pp: 'ottenuto', passatoRemoto: ['ottenni'] });
T('mantenere', { presente: ['mantengo'], futuro: ['manterrò'] });
T('appartenere', { presente: ['appartengo'] });
T('divenire', { presente: ['divengo'], pp: 'divenuto' });
T('rifare', { presente: ['rifaccio', 'rifai'], pp: 'rifatto', imperativo: ['rifai'] });
T('soddisfare', { presente: ['soddisfaccio'], pp: 'soddisfatto' });
T('contraddire', { presente: ['contraddico'], pp: 'contraddetto', imperativo: ['contraddici'] });
T('restare', { presente: ['resto', 'resti'], passatoRemoto: ['restai'], futuro: ['resterò'], pp: 'restato' });
T('costare', { futuro: ['costerò'], pp: 'costato' });
T('ricordare', { futuro: ['ricorderò'], passatoRemoto: ['ricordai'] });
T('mandare', { passatoRemoto: ['mandai'] });
T('esistere', { pp: 'esistito', passatoRemoto: ['esistei'] });
T('provvedere', { pp: 'provvisto', futuro: ['provvederò'], passatoRemoto: ['provvidi'] });
T('possedere', { presente: ['possiedo', 'possiedi'], pp: 'posseduto' });
T('sedere', { presente: ['siedo'] });
T('compiere', { presente: ['compio', 'compi', 'compie', 'compiamo', 'compite', 'compiono'], pp: 'compiuto', imperfetto: ['compivo'], futuro: ['compirò'], ger: 'compiendo' });
T('riempire', { presente: ['riempio', 'riempi', 'riempie', 'riempiamo', 'riempite', 'riempiono'], pp: 'riempito', ger: 'riempiendo' });
T('cuocere', { presente: ['cuocio'], pp: 'cotto', passatoRemoto: ['cossi'] });
T('valere', { presente: ['valgo'], futuro: ['varrò'], pp: 'valso' });
T('sciogliere', { pp: 'sciolto' });
T('redigere', { pp: 'redatto' });
T('affliggere', { pp: 'afflitto' });
T('sconfiggere', { pp: 'sconfitto' });
T('distinguere', { pp: 'distinto' });
T('emergere', { pp: 'emerso' });
T('assumere', { pp: 'assunto' });
T('connettere', { pp: 'connesso' });
T('espellere', { pp: 'espulso' });
T('cogliere', { presente: ['colgo'], pp: 'colto' });
// Reflexives / pronominal
T('alzarsi', { presente: ['mi alzo', 'ti alzi', 'si alza', 'ci alziamo', 'vi alzate', 'si alzano'], passatoProssimo: ['mi sono alzato/a', 'ti sei alzato/a', 'si è alzato/a', 'ci siamo alzati/e', 'vi siete alzati/e', 'si sono alzati/e'], imperativo: ['alzati', 'si alzi', 'alziamoci', 'alzatevi', 'si alzino'], ger: 'alzandosi', futuro: ['mi alzerò'] }, { aux: 'essere' });
T('accorgersi', { presente: ['mi accorgo'], passatoRemoto: ['mi accorsi'], pp: 'accorto', passatoProssimo: ['mi sono accorto/a'] });
T('vestirsi', { presente: ['mi vesto', 'ti vesti'], imperativo: ['vestiti', 'si vesta', 'vestiamoci', 'vestitevi', 'si vestano'] }, { isc: false });
T('sedersi', { presente: ['mi siedo'], imperativo: ['siediti'] });
T('andarsene', { presente: ['me ne vado', 'te ne vai', 'se ne va', 'ce ne andiamo', 've ne andate', 'se ne vanno'], passatoProssimo: ['me ne sono andato/a'], imperativo: ['vattene', 'se ne vada', 'andiamocene', 'andatevene', 'se ne vadano'], ger: 'andandosene' });
T('cavarsela', { presente: ['me la cavo', 'te la cavi', 'se la cava', 'ce la caviamo', 've la cavate', 'se la cavano'], passatoProssimo: ['me la sono cavata', null, 'se la è cavata'], imperativo: ['cavatela', 'se la cavi', 'caviamocela', 'cavatevela'] });
T('farcela', { presente: ['ce la faccio', 'ce la fai', 'ce la fa', 'ce la facciamo', 'ce la fate', 'ce la fanno'], passatoProssimo: ["ce l'ho fatta", "ce l'hai fatta"], futuro: ['ce la farò'] });
T('fregarsene', { presente: ['me ne frego', 'te ne freghi'], passatoProssimo: ['me ne sono fregato/a'] });
T('smetterla', { presente: ['la smetto'], passatoProssimo: ["l'ho smessa"], imperativo: ['smettila', 'la smetta', 'smettiamola', 'smettetela'] });
T('metterci', { presente: ['ci metto', 'ci metti', 'ci mette'], passatoProssimo: ['ci ho messo'], imperativo: ['mettici'] });
T('volerci', { presente: ['ci voglio', null, 'ci vuole', null, null, 'ci vogliono'] });
T('proporsi', { presente: ['mi propongo'], pp: 'proposto' });
T('sottrarsi', { presente: ['mi sottraggo'] });
T('ridursi', { presente: ['mi riduco'], pp: 'ridotto' });
T('prendersela', { presente: ['me la prendo'], passatoProssimo: ['me la sono presa'] });
T('divertirsi', { presente: ['mi diverto'], passatoProssimo: ['mi sono divertito/a'] }, { isc: false });

T('trascorrere', { passatoRemoto: ['trascorsi'], pp: 'trascorso' });
T('disattendere', { pp: 'disatteso' });
T('rimandare', { presente: ['rimando', 'rimandi'], passatoRemoto: ['rimandai'], futuro: ['rimanderò'], pp: 'rimandato' });
T('destare', { presente: ['desto'], futuro: ['desterò'] });
T('prescindere', { pp: 'prescisso' });
T('fungere', { pp: 'funto' });
T('riscoprire', { pp: 'riscoperto' });
T('trasmettere', { pp: 'trasmesso' });
T('scommettere', { pp: 'scommesso', passatoRemoto: ['scommisi'] });
T('contrastare', { presente: ['contrasto'], futuro: ['contrasterò'] });
T('desistere', { pp: 'desistito' });
T('entrarci', { presente: ['ci entro', 'ci entri', 'ci entra'], passatoProssimo: ['ci sono entrato/a'] }, { aux: 'essere' });
T('volerci', { passatoProssimo: [null, null, 'ci è voluto/a', null, null, 'ci sono voluti/e'] }, { aux: 'essere' });
T('distrarsi', { presente: ['mi distraggo'], pp: 'distratto' });
T('ritrarsi', { presente: ['mi ritraggo'] });
// stringere and its derivatives: restringere has a vowel change in the participle (ristretto, not re+stretto)
T('stringere', { presente: ['stringo', 'stringi'], passatoRemoto: ['strinsi', 'stringesti', 'strinse'], pp: 'stretto' });
T('restringere', { presente: ['restringo', 'restringi'], passatoRemoto: ['restrinsi', 'restringesti', 'restrinse', 'restringemmo', 'restringeste', 'restrinsero'], pp: 'ristretto' });
T('restringersi', { presente: ['mi restringo'], passatoProssimo: ['mi sono ristretto/a'] });
T('costringere', { passatoRemoto: ['costrinsi', null, 'costrinse'], pp: 'costretto' });
T('astringere', { passatoRemoto: ['astrinsi'], pp: 'astretto' });
checks++; if (accepted(conjugate('restringere').nonFinite.participioPassato).includes('restretto')) { fails++; console.log('FAIL restringere must not accept "restretto"'); }
// ---------------------------------------------------------------------------------------------------
// Hardening pass: rare -ere families, -rre derivatives, defective verbs, -iare/-gnare spelling, clitics
// ---------------------------------------------------------------------------------------------------
// a form that must NOT be accepted (e.g. "vaitene")
function no(inf, tense, i, bad, meta) {
  checks++;
  const c = conjugate(inf, meta);
  const forms = tense === 'pp' ? [c.nonFinite.participioPassato] : c.tenses[tense];
  const got = forms ? forms[tense === 'pp' ? 0 : i] : null;
  if (got != null && accepted(got).includes(bad)) { fails++; console.log(`FAIL ${inf} ${tense}[${i}]: "${bad}" must not be accepted, got "${got}"`); }
}
// a tense that must be absent (defective imperative etc.)
function none(inf, tense, meta) {
  checks++;
  const c = conjugate(inf, meta);
  if (c.tenses[tense] != null) { fails++; console.log(`FAIL ${inf} ${tense}: expected no forms, got "${c.tenses[tense]}"`); }
}

// compiere / riempire family: stem in -i absorbs i/ì endings (compì, not "compiì")
T('compiere', { passatoRemoto: ['compii', 'compisti', 'compì', 'compimmo', 'compiste', 'compirono'], imperfetto: ['compivo', null, null, 'compivamo'], congiuntivoPresente: ['compia', null, null, 'compiamo', 'compiate', 'compiano'], congiuntivoImperfetto: ['compissi'], imperativo: ['compi', 'compia', 'compiamo', 'compite', 'compiano'] });
T('riempire', { passatoRemoto: ['riempii', 'riempisti', 'riempì', null, null, 'riempirono'], imperfetto: ['riempivo'], congiuntivoPresente: ['riempia', null, null, 'riempiamo', 'riempiate'], imperativo: ['riempi', 'riempia', 'riempiamo', 'riempite', 'riempiano'], pp: 'riempito' });
T('adempiere', { presente: ['adempio', 'adempi', 'adempie', 'adempiamo', 'adempite', 'adempiono'], passatoRemoto: ['adempii', null, 'adempì'], pp: 'adempiuto', ger: 'adempiendo', futuro: ['adempirò'] });
T('empire', { presente: ['empio', 'empi', 'empie', 'empiamo', 'empite', 'empiono'], passatoRemoto: [null, null, 'empì'], pp: 'empito', ger: 'empiendo' });
no('compiere', 'passatoRemoto', 2, 'compiì'); no('riempire', 'passatoRemoto', 2, 'riempiì');

// rare -ere families and alternative participles
T('restringere', { passatoRemoto: ['restrinsi', 'restringesti', 'restrinse'], pp: 'ristretto', presente: ['restringo'], passatoProssimo: ['ho ristretto'] });
T('costringere', { pp: 'costretto', passatoRemoto: ['costrinsi'] });
T('fendere', { passatoRemoto: ['fendei', 'fendesti', 'fendé', 'fendemmo', 'fendeste', 'fenderono'], pp: 'fesso' });
T('fendere', { passatoRemoto: ['fendetti', null, 'fendette', null, null, 'fendettero'], pp: 'fenduto' });
no('fendere', 'passatoRemoto', 0, 'fendi'); no('fendere', 'passatoRemoto', 2, 'fende');
T('espandere', { passatoRemoto: ['espansi', 'espandesti', 'espanse'], pp: 'espanso', presente: ['espando', 'espandi'] });
T('spandere', { pp: 'spanto', passatoRemoto: ['spansi'] });
T('succedere', { passatoRemoto: ['successi', null, 'successe'], pp: 'successo', passatoProssimo: [null, null, 'è successo/a'] }, { aux: 'essere' });
T('succedere', { passatoRemoto: ['succedetti', null, 'succedette'], pp: 'succeduto', passatoProssimo: [null, null, 'è succeduto/a'] }, { aux: 'essere' });
T('convergere', { passatoRemoto: ['conversi', 'convergesti', 'converse'], pp: 'converso', presente: ['convergo', 'convergi'] });
T('divergere', { passatoRemoto: ['diversi'], pp: '—', presente: ['divergo'] });
T('aspergere', { passatoRemoto: ['aspersi'], pp: 'asperso' });
T('indulgere', { passatoRemoto: ['indulsi'], pp: 'indulto', presente: ['indulgo'] });
T('ergere', { pp: 'erto', passatoRemoto: ['ersi'] });
T('configgere', { pp: 'confitto', passatoRemoto: ['confissi'] });
T('infiggere', { pp: 'infisso', passatoRemoto: ['infissi'] });
T('intrudere', { pp: 'intruso', passatoRemoto: ['intrusi'] });
T('recludere', { pp: 'recluso', passatoRemoto: ['reclusi'] });
T('vilipendere', { pp: 'vilipeso', passatoRemoto: ['vilipesi'] });
T('riflettere', { pp: 'riflettuto', passatoRemoto: ['riflettei'] });
T('riflettere', { pp: 'riflesso' });
T('concedere', { passatoRemoto: ['concessi', 'concedesti', 'concesse'], pp: 'concesso' });
T('concedere', { passatoRemoto: ['concedetti'] });
T('esigere', { pp: 'esatto', passatoRemoto: ['esigei'] });
T('transigere', { pp: 'transatto', passatoRemoto: ['transigei'] });
T('evolvere', { pp: 'evoluto', passatoRemoto: ['evolvei'] });
T('devolvere', { pp: 'devoluto' });
T('possedere', { passatoRemoto: ['possedetti'], congiuntivoPresente: ['possieda'], futuro: ['possederò'] });
T('soprassedere', { presente: ['soprassiedo'], pp: 'soprasseduto' });
T('retrocedere', { pp: 'retroceduto', passatoRemoto: ['retrocedei'] });
T('procedere', { pp: 'proceduto', passatoRemoto: ['procedetti'] });
T('scuotere', { presente: ['scuoto'], passatoRemoto: ['scossi'], pp: 'scosso' });
T('percuotere', { pp: 'percosso', passatoRemoto: ['percossi'] });
T('ledere', { pp: 'leso', passatoRemoto: ['lesi'] });
T('radere', { pp: 'raso', passatoRemoto: ['rasi'] });
T('rodere', { pp: 'roso', passatoRemoto: ['rosi'] });
T('mordere', { pp: 'morso', passatoRemoto: ['morsi'] });
T('ardere', { pp: 'arso', passatoRemoto: ['arsi'] });
T('scindere', { pp: 'scisso', passatoRemoto: ['scissi'] });
T('flettere', { pp: 'flesso', passatoRemoto: ['flessi'] });
T('incutere', { pp: 'incusso', passatoRemoto: ['incussi'] });
T('redimere', { pp: 'redento', passatoRemoto: ['redensi'] });
T('eccellere', { pp: 'eccelso', passatoRemoto: ['eccelsi'] });
T('espellere', { passatoRemoto: ['espulsi', 'espellesti'] });
T('rifulgere', { pp: 'rifulso', passatoRemoto: ['rifulsi'] });
T('estinguere', { pp: 'estinto', passatoRemoto: ['estinsi'] });
T('frangere', { pp: 'franto' });
T('ungere', { pp: 'unto', passatoRemoto: ['unsi'] });
T('mungere', { pp: 'munto', passatoRemoto: ['munsi'] });
T('pungere', { pp: 'punto', passatoRemoto: ['punsi'] });
T('fungere', { passatoRemoto: ['funsi'] });
T('cingere', { pp: 'cinto', passatoRemoto: ['cinsi'] });
T('tingere', { pp: 'tinto', passatoRemoto: ['tinsi'] });
T('erigere', { pp: 'eretto', passatoRemoto: ['eressi'] });
T('dirigere', { passatoRemoto: ['diressi', 'dirigesti'] });
T('prediligere', { pp: 'prediletto', passatoRemoto: ['predilessi'] });
T('negligere', { pp: 'negletto' });
T('affiggere', { pp: 'affisso', passatoRemoto: ['affissi'] });
T('trafiggere', { pp: 'trafitto', passatoRemoto: ['trafissi'] });
T('crocifiggere', { pp: 'crocifisso' });
T('infliggere', { pp: 'inflitto', passatoRemoto: ['inflissi'] });
T('struggere', { pp: 'strutto', passatoRemoto: ['strussi'] });
T('porgere', { pp: 'porto', passatoRemoto: ['porsi'] });
T('scorgere', { pp: 'scorto', passatoRemoto: ['scorsi'] });
T('torcere', { pp: 'torto', passatoRemoto: ['torsi'] });
T('spargere', { pp: 'sparso', passatoRemoto: ['sparsi'] });
T('emergere', { passatoRemoto: ['emersi', 'emergesti'] });
T('difendere', { pp: 'difeso', passatoRemoto: ['difesi'] });
T('esplodere', { pp: 'esploso', passatoRemoto: ['esplosi'] });
T('persuadere', { pp: 'persuaso', passatoRemoto: ['persuasi', 'persuadesti'] });
T('invadere', { pp: 'invaso', passatoRemoto: ['invasi'] });
T('uccidere', { pp: 'ucciso', passatoRemoto: ['uccisi'] });
T('nuocere', { presente: ['nuoccio', 'nuoci', 'nuoce', 'nociamo', 'nuocete', 'nuocciono'], passatoRemoto: ['nocqui', 'nuocesti', 'nocque'], pp: 'nociuto', congiuntivoPresente: ['nuoccia', null, null, null, 'nociate'] });
T('giacere', { presente: ['giaccio', 'giaci'], passatoRemoto: ['giacqui'], pp: 'giaciuto' });
T('dolere', { presente: ['dolgo', 'duoli', 'duole', 'doliamo', 'dolete', 'dolgono'], passatoRemoto: ['dolsi'], futuro: ['dorrò'], pp: 'doluto' });
T('parere', { presente: ['paio', 'pari', 'pare', 'paiamo', 'parete', 'paiono'], passatoRemoto: ['parvi', 'paresti', 'parve'], futuro: ['parrò'], pp: 'parso', congiuntivoPresente: ['paia'] });
none('parere', 'imperativo');
T('pascere', { pp: 'pasciuto', passatoRemoto: ['pascei'] });
T('mescere', { pp: 'mesciuto' });

// -ire: apparire / cucire families, -isc- classification
T('apparire', { passatoRemoto: ['apparvi', 'apparisti', 'apparve', 'apparimmo', 'appariste', 'apparvero'], congiuntivoPresente: ['appaia', null, null, 'appariamo', 'appariate', 'appaiano'], imperativo: ['appari', 'appaia'] });
T('apparire', { passatoRemoto: ['apparii', null, 'apparì', null, null, 'apparirono'] });
T('apparire', { passatoRemoto: ['apparsi', null, 'apparse'] });
T('comparire', { presente: ['compaio', 'compari', 'compare', 'compariamo', 'comparite', 'compaiono'], passatoRemoto: ['comparvi'], pp: 'comparso' });
T('scomparire', { presente: ['scompaio'], pp: 'scomparso', passatoRemoto: [null, null, 'scomparve'] });
T('trasparire', { presente: ['traspaio', 'traspari', 'traspare', 'traspariamo', 'trasparite', 'traspaiono'], passatoRemoto: ['trasparii', null, 'trasparì'], pp: 'trasparso' });
T('trasparire', { presente: ['trasparisco'], passatoRemoto: ['trasparvi'], pp: 'trasparito', congiuntivoPresente: ['trasparisca'] });
T('sparire', { presente: ['sparisco', 'sparisci'], pp: 'sparito' });
T('cucire', { presente: ['cucio', 'cuci', 'cuce', 'cuciamo', 'cucite', 'cuciono'], congiuntivoPresente: ['cucia', null, null, 'cuciamo', 'cuciate', 'cuciano'], imperativo: ['cuci', 'cucia'], pp: 'cucito' });
T('scucire', { presente: ['scucio', 'scuci'], pp: 'scucito' });
T('ricucire', { presente: ['ricucio', null, null, null, null, 'ricuciono'] });
T('sdrucire', { presente: ['sdrucio', 'sdruci', 'sdruce', null, null, 'sdruciono'], congiuntivoPresente: ['sdrucia'] });
no('sdrucire', 'presente', 0, 'sdruco');
T('assorbire', { presente: ['assorbo', 'assorbi', 'assorbe', 'assorbiamo', 'assorbite', 'assorbono'], pp: 'assorbito' });
T('assorbire', { presente: ['assorbisco', null, null, null, null, 'assorbiscono'], pp: 'assorto', congiuntivoPresente: ['assorbisca'] });
T('spartire', { presente: ['spartisco', 'spartisci', 'spartisce', 'spartiamo', 'spartite', 'spartiscono'], congiuntivoPresente: ['spartisca'], imperativo: ['spartisci'] });
T('ripartire', { presente: ['riparto', 'riparti', 'riparte'] });
T('impartire', { presente: ['impartisco'] }, { isc: true });
T('seppellire', { presente: ['seppellisco'], pp: 'sepolto' });
T('seppellire', { pp: 'seppellito' });
T('udire', { presente: ['odo', 'odi', 'ode', 'udiamo', 'udite', 'odono'], futuro: ['udirò'], congiuntivoPresente: ['oda'], imperativo: ['odi', 'oda', 'udiamo', 'udite', 'odano'] });
T('salire', { imperativo: ['sali', 'salga', 'saliamo', 'salite', 'salgano'], congiuntivoPresente: [null, null, null, 'saliamo', 'saliate', 'salgano'] });
T('morire', { congiuntivoPresente: ['muoia', null, null, 'moriamo', 'moriate', 'muoiano'], passatoRemoto: ['morii', 'moristi', 'morì'], imperativo: ['muori', 'muoia'] });
T('morire', { futuro: ['morrò'] });
T('venire', { imperfetto: ['venivo'], congiuntivoImperfetto: ['venissi'], ger: 'venendo' });

// defective verbs (Treccani): missing participle / compound tenses are shown as "—"
T('dirimere', { presente: ['dirimo', 'dirimi', 'dirime'], passatoRemoto: ['dirimei'], pp: '—', passatoProssimo: ['—'] });
none('dirimere', 'imperativo');
T('esimersi', { presente: ['mi esimo', 'ti esimi', 'si esime', 'ci esimiamo', 'vi esimete', 'si esimono'], pp: '—', futuro: ['mi esimerò'] });
no('esimersi', 'presente', 3, "c'esimiamo");
T('incombere', { presente: ['incombo', null, 'incombe'], pp: '—', passatoRemoto: ['incombei'] });
none('incombere', 'imperativo');
T('vertere', { presente: ['verto', null, 'verte', null, null, 'vertono'], pp: '—' });
none('vertere', 'imperativo');
T('incedere', { presente: ['incedo'], pp: '—', passatoRemoto: ['incedei', null, 'incedé'] });
T('irrompere', { passatoRemoto: ['irruppi', 'irrompesti', 'irruppe'], pp: '—', presente: ['irrompo'] });
T('erompere', { passatoRemoto: ['eruppi'], pp: '—' });
T('prorompere', { passatoRemoto: ['proruppi'], pp: 'prorotto' });
T('concernere', { presente: ['concerno', null, 'concerne', null, null, 'concernono'], pp: MISSING, passatoRemoto: Array(6).fill(MISSING), passatoProssimo: Array(6).fill(MISSING) });
none('concernere', 'imperativo');
T('solere', { presente: ['soglio', 'suoli', 'suole', 'sogliamo', 'solete', 'sogliono'], imperfetto: ['solevo'], congiuntivoPresente: ['soglia'], passatoRemoto: ['—'], futuro: ['—'], pp: '—' });
none('solere', 'imperativo');
T('urgere', { presente: [null, null, 'urge', null, null, 'urgono'], imperfetto: [null, null, 'urgeva'], pp: '—', passatoRemoto: [null, null, '—'] });
T('splendere', { presente: ['splendo'], passatoRemoto: ['splendei'], pp: '—' });
T('competere', { pp: '—', presente: ['competo'] });
T('delinquere', { pp: '—', passatoRemoto: ['—'], futuro: ['—'], passatoProssimo: ['—'] });
none('delinquere', 'imperativo');
checks++; if (MISSING !== '—') { fails++; console.log('FAIL MISSING placeholder'); }
checks++; if (!conjugate('dirimere').defective.includes('participioPassato')) { fails++; console.log('FAIL dirimere.defective'); }
checks++; if (conjugate('capire').defective.length) { fails++; console.log('FAIL capire.defective should be empty'); }

// -iare with stressed i, -gnare, other spelling
T('spiare', { presente: ['spio', 'spii', 'spia', 'spiamo', 'spiate', 'spiano'], congiuntivoPresente: ['spii', null, null, null, null, 'spiino'] });
T('avviare', { presente: ['avvio', 'avvii'], congiuntivoPresente: ['avvii'] });
T('ravviare', { presente: ['ravvio', 'ravvii'] });
T('obliare', { presente: ['oblio', 'oblii'] });
T('deviare', { presente: ['devio', 'devii'], futuro: ['devierò'] });
T('espiare', { presente: ['espio', 'espii'] });
T('odiare', { presente: ['odio', 'odi', 'odia', 'odiamo'] });
T('calunniare', { presente: ['calunnio', 'calunni'] });
T('sciare', { congiuntivoPresente: ['scii', null, null, 'sciamo', 'sciate', 'sciino'] });
T('sognare', { presente: [null, null, null, 'sognamo'], congiuntivoPresente: [null, null, null, 'sogniamo', 'sogniate'] });
T('sognare', { congiuntivoPresente: [null, null, null, null, 'sognate'] });
T('bagnare', { presente: [null, null, null, 'bagniamo'], congiuntivoPresente: [null, null, null, null, 'bagniate'], imperativo: [null, null, 'bagniamo'] });
T('adeguare', { presente: ['adeguo', 'adegui', 'adegua', 'adeguiamo'], futuro: ['adeguerò'] });
T('permeare', { presente: ['permeo', 'permei', null, 'permeiamo'], futuro: ['permeerò'] });
T('bearsi', { presente: ['mi beo', 'ti bei', 'si bea'] });
T('googlare', { presente: ['googlo', 'googli'] });

// pronominal verbs (-sene, -sela, -cela, -ci, -la, -lo)
T('andarsene', { imperativo: ['vattene', 'se ne vada', 'andiamocene', 'andatevene', 'se ne vadano'], presente: ['me ne vado'], futuro: [null, null, 'se ne andrà'], passatoProssimo: [null, null, 'se ne è andato/a'], ger: 'andandosene' });
no('andarsene', 'imperativo', 0, 'vaitene');
T('farcela', { imperativo: ['faccela'], passatoProssimo: ["ce l'ho fatta", null, "ce l'ha fatta", "ce l'abbiamo fatta"], presente: ['ce la faccio'], ger: 'facendocela' });
no('farcela', 'imperativo', 0, 'faicela');
T('darsela', { imperativo: ['dattela', 'se la dia', 'diamocela', 'datevela'], presente: ['me la do', 'te la dai', 'se la dà'], passatoProssimo: ['me la sono data', null, "se l'è data"] });
no('darsela', 'imperativo', 0, 'daitela');
T('starci', { imperativo: ['stacci', 'ci stia', 'stiamoci', 'stateci'], presente: ['ci sto', 'ci stai', 'ci sta'], passatoProssimo: ['ci sono stato/a'], ger: 'standoci' }, { aux: 'essere' });
no('starci', 'imperativo', 0, 'staici', { aux: 'essere' });
T('avercela', { presente: ["ce l'ho", "ce l'hai", "ce l'ha", "ce l'abbiamo", "ce l'avete", "ce l'hanno"], imperfetto: ["ce l'avevo"], passatoProssimo: ["ce l'ho avuta", null, "ce l'ha avuta"], futuro: ["ce l'avrò"] });
no('avercela', 'presente', 0, 'ce la ho');
T('esserci', { presente: ['ci sono', 'ci sei', "c'è", 'ci siamo', 'ci siete', 'ci sono'], imperfetto: ["c'ero", "c'eri", "c'era", "c'eravamo", "c'eravate", "c'erano"], passatoProssimo: [null, null, "c'è stato/a"], futuro: [null, null, 'ci sarà'], congiuntivoPresente: [null, null, 'ci sia'], pp: 'stato' }, { aux: 'essere' });
T('entrarci', { presente: ["c'entro", "c'entri", "c'entra", null, null, "c'entrano"], imperfetto: [null, null, "c'entrava"], passatoProssimo: [null, null, "c'è entrato/a"], imperativo: ['entraci'] }, { aux: 'essere' });
T('volerci', { passatoProssimo: [null, null, "c'è voluto/a", null, null, 'ci sono voluti/e'], imperfetto: [null, null, 'ci voleva'], trapassatoProssimo: [null, null, "c'era voluto/a"] }, { aux: 'essere' });
T('metterci', { passatoProssimo: ['ci ho messo', null, 'ci ha messo'], imperativo: ['mettici', 'ci metta', 'mettiamoci', 'metteteci', 'ci mettano'], futuro: ['ci metterò'], ger: 'mettendoci' });
no('metterci', 'trapassatoRemoto', 0, "c'ebbi messo");
T('aspettarsela', { presente: ["me l'aspetto", "te l'aspetti", "se l'aspetta"], passatoProssimo: ['me la sono aspettata', null, "se l'è aspettata"] });
T('aspettarsela', { presente: ['me la aspetto'] });
T('prendersela', { imperativo: ['prenditela', 'se la prenda', 'prendiamocela', 'prendetevela', 'se la prendano'], passatoProssimo: ['me la sono presa', 'te la sei presa', "se l'è presa", 'ce la siamo presa', 've la siete presa', 'se la sono presa'], ger: 'prendendosela', futuro: ['me la prenderò'] });
T('sentirsela', { presente: ['me la sento', 'te la senti'], passatoProssimo: ['me la sono sentita'], imperativo: ['sentitela'] });
T('fregarsene', { imperativo: ['fregatene', 'se ne freghi', 'freghiamocene', 'fregatevene', 'se ne freghino'], congiuntivoPresente: ['me ne freghi'], ger: 'fregandosene' });
T('intendersene', { presente: ['me ne intendo', null, 'se ne intende'], passatoProssimo: ['me ne sono inteso/a'], imperativo: ['intenditene'] });
T('accorgersene', { passatoRemoto: ['me ne accorsi'], passatoProssimo: [null, null, 'se ne è accorto/a'], imperativo: ['accorgitene', null, 'accorgiamocene'] });
T('starsene', { presente: ['me ne sto', 'te ne stai', 'se ne sta', 'ce ne stiamo', 've ne state', 'se ne stanno'], imperativo: ['stattene', 'se ne stia', 'stiamocene', 'statevene'], passatoProssimo: ['me ne sono stato/a'] }, { aux: 'essere' });
T('venirsene', { presente: ['me ne vengo', 'te ne vieni'], imperativo: ['vienitene'], passatoProssimo: ['me ne sono venuto/a'] });
T('uscirsene', { presente: ['me ne esco', null, 'se ne esce', 'ce ne usciamo'], imperativo: ['escitene'] });
T('tornarsene', { presente: ['me ne torno'], passatoProssimo: ['me ne sono tornato/a'], imperativo: ['tornatene'] }, { aux: 'essere' });
T('dimenticarsene', { presente: ['me ne dimentico', 'te ne dimentichi'], futuro: ['me ne dimenticherò'], imperativo: ['dimenticatene', null, 'dimentichiamocene'] });
T('infischiarsene', { presente: ['me ne infischio', 'te ne infischi'], imperativo: ['infischiatene'] });
T('smetterla', { passatoProssimo: ["l'ho smessa", "l'hai smessa", "l'ha smessa"], imperativo: ['smettila', 'la smetta', 'smettiamola', 'smettetela', 'la smettano'], futuro: ['la smetterò'], ger: 'smettendola' });
T('finirla', { imperativo: ['finiscila', 'la finisca', 'finiamola', 'finitela'], passatoProssimo: ["l'ho finita"], presente: ['la finisco'] });
T('piantarla', { imperativo: ['piantala'], passatoProssimo: ["l'ho piantata"] });
T('spuntarla', { passatoProssimo: ["l'ho spuntata", null, "l'ha spuntata"], futuro: ['la spunterò'] });
T('dirlo', { imperativo: ['dillo', 'lo dica', 'diciamolo', 'ditelo', 'lo dicano'], passatoProssimo: ["l'ho detto"], presente: ['lo dico'] });
T('farlo', { imperativo: ['fallo', null, 'facciamolo', 'fatelo'], passatoProssimo: ["l'ho fatto"], ger: 'facendolo' });
T('darla', { imperativo: ['dalla'], passatoProssimo: ["l'ho data"] });
T('andarci', { imperativo: ['vacci', 'ci vada', 'andiamoci', 'andateci', 'ci vadano'], passatoProssimo: ['ci sono andato/a', null, "c'è andato/a"], presente: ['ci vado'] }, { aux: 'essere' });
T('pensarci', { imperativo: ['pensaci', 'ci pensi'], passatoProssimo: ['ci ho pensato'], presente: ['ci penso'] });
T('tenerci', { presente: ['ci tengo', 'ci tieni'], imperativo: ['tienici'], futuro: ['ci terrò'] });
T('riuscirci', { presente: ['ci riesco'], passatoProssimo: ['ci sono riuscito/a'], imperativo: ['riescici'] }, { aux: 'essere' });
T('cavarsela', { imperativo: ['cavatela', 'se la cavi', 'caviamocela', 'cavatevela', 'se la cavino'], passatoProssimo: [null, null, "se l'è cavata"], congiuntivoPresente: ['me la cavi'], ger: 'cavandosela' });
T('sbrigarsela', { presente: ['me la sbrigo', 'te la sbrighi'], futuro: ['me la sbrigherò'], imperativo: ['sbrigatela', null, 'sbrighiamocela'] });
T('godersela', { presente: ['me la godo'], passatoProssimo: ['me la sono goduta'], imperativo: ['goditela'] });
T('bersela', { presente: ['me la bevo'], passatoRemoto: ['me la bevvi'], futuro: ['me la berrò'], passatoProssimo: ['me la sono bevuta'] });
T('vedersela', { passatoProssimo: ['me la sono vista'], imperativo: ['veditela'], futuro: ['me la vedrò'] });
T('sapersela', { presente: ['me la so', null, 'se la sa'], imperativo: ['sappitela'] });
T('svignarsela', { presente: ['me la svigno'], passatoProssimo: ['me la sono svignata'], imperativo: ['svignatela'] });
T('filarsela', { imperativo: ['filatela'], passatoProssimo: [null, null, "se l'è filata"] });
T('passarsela', { presente: ['me la passo', null, 'se la passa'], imperfetto: ['me la passavo'] });
// reflexive derivatives (looked up by their base infinitive)
T('opporsi', { presente: ['mi oppongo', 'ti opponi'], passatoProssimo: ['mi sono opposto/a'], imperativo: ['opponiti', 'si opponga'] });
T('ridursi', { imperativo: ['riduciti'], passatoProssimo: ['mi sono ridotto/a'], imperfetto: ['mi riducevo'] });
T('sottrarsi', { passatoProssimo: ['mi sono sottratto/a'], imperativo: ['sottraiti', 'si sottragga'], passatoRemoto: ['mi sottrassi'] });
T('sedersi', { imperativo: ['siediti', 'si sieda', 'sediamoci', 'sedetevi', 'si siedano'], passatoProssimo: ['mi sono seduto/a'] });
T('accorgersi', { imperativo: ['accorgiti', 'si accorga', 'accorgiamoci', 'accorgetevi', 'si accorgano'] });
T('condolersi', { presente: ['mi condolgo', 'ti conduoli', 'si conduole', null, 'vi condolete', 'si condolgono'], passatoRemoto: ['mi condolsi'], futuro: ['mi condorrò'], pp: 'condoluto' });
T('avvedersi', { passatoRemoto: ['mi avvidi', 'ti avvedesti', 'si avvide'], pp: 'avveduto', futuro: ['mi avvedrò'], passatoProssimo: ['mi sono avveduto/a'] });
no('avvedersi', 'pp', 0, 'avvisto');
T('ravvedersi', { passatoRemoto: ['mi ravvidi'], pp: 'ravveduto', passatoProssimo: [null, null, 'si è ravveduto/a'] });
no('ravvedersi', 'pp', 0, 'ravvisto');
T('accingersi', { presente: ['mi accingo'], passatoRemoto: ['mi accinsi'], pp: 'accinto' });
T('astenersi', { presente: ['mi astengo', 'ti astieni'], futuro: ['mi asterrò'], pp: 'astenuto', passatoRemoto: ['mi astenni'] });
T('attenersi', { presente: ['mi attengo', 'ti attieni', 'si attiene'], imperativo: ['attieniti'] });
T('intromettersi', { presente: ['mi intrometto'], pp: 'intromesso', passatoRemoto: ['mi intromisi'] });
T('rivalersi', { presente: ['mi rivalgo'], pp: 'rivalso', futuro: ['mi rivarrò'] });
T('rapprendersi', { pp: 'rappreso', passatoRemoto: [null, null, 'si rapprese'] });
T('arrendersi', { pp: 'arreso', passatoRemoto: ['mi arresi'], imperativo: ['arrenditi'] });
T('prefiggersi', { pp: 'prefisso', passatoRemoto: ['mi prefissi'], passatoProssimo: ['mi sono prefisso/a'] });
T('imbattersi', { presente: ['mi imbatto'], pp: 'imbattuto', passatoRemoto: ['mi imbattei'] });
T('genuflettersi', { pp: 'genuflesso', passatoRemoto: ['mi genuflessi'] });
T('addirsi', { presente: [null, null, 'si addice', null, null, 'si addicono'] });

// prefixed derivatives of fare / dare / stare / andare / dire (accented monosyllables, no "contraddi'")
T('rifare', { presente: ['rifaccio', 'rifai', 'rifà', 'rifacciamo', 'rifate', 'rifanno'], imperativo: ["rifa'", 'rifaccia', 'rifacciamo', 'rifate', 'rifacciano'], passatoRemoto: ['rifeci', 'rifacesti'], futuro: ['rifarò'], ger: 'rifacendo' });
T('rifare', { imperativo: ['rifà'], presente: [null, null, 'rifa'] });
T('disfare', { presente: ['disfaccio', null, 'disfà'], pp: 'disfatto', passatoRemoto: ['disfeci'] });
T('soddisfare', { presente: ['soddisfaccio', 'soddisfai', 'soddisfa', 'soddisfacciamo', 'soddisfate', 'soddisfanno'], congiuntivoPresente: ['soddisfaccia'], imperativo: ['soddisfa', 'soddisfaccia'], futuro: ['soddisfarò'], passatoRemoto: ['soddisfeci', 'soddisfacesti'], pp: 'soddisfatto', imperfetto: ['soddisfacevo'] });
T('soddisfare', { presente: ['soddisfo', 'soddisfi', null, 'soddisfiamo', null, 'soddisfano'], congiuntivoPresente: ['soddisfi'], futuro: ['soddisferò'], imperativo: ['soddisfai', 'soddisfi'] });
T('contraffare', { presente: ['contraffaccio'], pp: 'contraffatto' });
T('liquefare', { presente: ['liquefaccio', null, 'liquefà'], pp: 'liquefatto' });
T('strafare', { presente: ['strafaccio', null, 'strafà'], pp: 'strafatto' });
T('sopraffare', { pp: 'sopraffatto', passatoRemoto: ['sopraffeci'] });
T('stupefare', { pp: 'stupefatto' });
T('assuefare', { pp: 'assuefatto' });
T('tumefare', { pp: 'tumefatto' });
T('putrefare', { pp: 'putrefatto' });
T('ridare', { presente: ['ridò', 'ridai', 'ridà', 'ridiamo', 'ridate', 'ridanno'], passatoRemoto: ['ridiedi', 'ridesti', 'ridiede'], congiuntivoPresente: ['ridia'], imperativo: ["rida'", 'ridia'], futuro: ['ridarò'], pp: 'ridato' });
T('ridare', { imperativo: ['ridà'], presente: ['rido'] });
T('sottostare', { presente: ['sottostò', 'sottostai', 'sottostà', 'sottostiamo', 'sottostate', 'sottostanno'], passatoRemoto: ['sottostetti'], congiuntivoPresente: ['sottostia'], pp: 'sottostato', imperativo: ['sottostà'] });
T('riandare', { presente: ['rivado', 'rivai', 'rivà'], futuro: ['riandrò'], imperativo: ["riva'"] }, { aux: 'essere' });
T('contraddire', { imperativo: ['contraddici', 'contraddica', 'contraddiciamo', 'contraddite', 'contraddicano'], presente: [null, null, null, null, 'contraddite'], passatoRemoto: ['contraddissi'], ger: 'contraddicendo' });
no('contraddire', 'imperativo', 0, "contraddi'");
T('benedire', { presente: ['benedico', 'benedici', 'benedice', 'benediciamo', 'benedite', 'benedicono'], passatoRemoto: ['benedissi'], pp: 'benedetto', imperativo: ['benedici'], imperfetto: ['benedicevo'] });
T('maledire', { pp: 'maledetto', presente: ['maledico'], imperativo: ['maledici'] });
T('predire', { pp: 'predetto', futuro: ['predirò'] });
T('disdire', { pp: 'disdetto', presente: ['disdico', 'disdici'] });
T('indire', { presente: ['indico'], pp: 'indetto', imperativo: ['indici'] });
no('indire', 'imperativo', 0, "indi'");
T('interdire', { pp: 'interdetto', passatoRemoto: ['interdissi'] });
T('risapere', { pp: 'risaputo', futuro: ['risaprò'] });
T('rivolere', { presente: ['rivoglio', 'rivuoi'], futuro: ['rivorrò'], pp: 'rivoluto' });
T('riudire', { presente: ['riodo', 'riodi'], futuro: ['riudirò'] });
T('fuoriuscire', { presente: ['fuoriesco', null, 'fuoriesce'], pp: 'fuoriuscito' });
// -rre derivatives
T('riproporre', { presente: ['ripropongo', 'riproponi'], pp: 'riproposto', futuro: ['riproporrò'], passatoRemoto: ['riproposi'] });
T('sovraesporre', { pp: 'sovraesposto', presente: ['sovraespongo'] });
T('presupporre', { presente: ['presuppongo'], pp: 'presupposto', passatoRemoto: ['presupposi'], imperfetto: ['presupponevo'] });
T('contrapporre', { pp: 'contrapposto', ger: 'contrapponendo' });
T('decomporre', { pp: 'decomposto', presente: ['decompongo'] });
T('anteporre', { pp: 'anteposto', congiuntivoPresente: ['anteponga'] });
T('ricondurre', { presente: ['riconduco'], pp: 'ricondotto', passatoRemoto: ['ricondussi'], futuro: ['ricondurrò'], imperfetto: ['riconducevo'] });
T('riprodurre', { pp: 'riprodotto', presente: ['riproduco', 'riproduci'] });
T('sedurre', { pp: 'sedotto', passatoRemoto: ['sedussi'], futuro: ['sedurrò'] });
T('addurre', { pp: 'addotto', presente: ['adduco'] });
T('introdurre', { pp: 'introdotto', ger: 'introducendo', congiuntivoImperfetto: ['introducessi'] });
T('dedurre', { pp: 'dedotto', passatoRemoto: ['dedussi', 'deducesti'] });
T('protrarre', { presente: ['protraggo', 'protrai', 'protrae', 'protraiamo', 'protraete', 'protraggono'], pp: 'protratto', passatoRemoto: ['protrassi'], futuro: ['protrarrò'], imperfetto: ['protraevo'] });
T('contrarre', { pp: 'contratto', presente: ['contraggo'], ger: 'contraendo' });
T('estrarre', { pp: 'estratto', passatoRemoto: ['estrassi', 'estraesti'] });
T('detrarre', { pp: 'detratto' });
T('ritrarre', { pp: 'ritratto', presente: ['ritraggo'] });
T('astrarre', { pp: 'astratto' });
// venire / tenere / valere / cadere / vedere derivatives
T('sopravvenire', { presente: [null, null, 'sopravviene'], pp: 'sopravvenuto', passatoRemoto: [null, null, 'sopravvenne'] });
T('contravvenire', { presente: ['contravvengo'], futuro: ['contravverrò'], pp: 'contravvenuto' });
T('rinvenire', { presente: ['rinvengo', 'rinvieni'], pp: 'rinvenuto', passatoRemoto: ['rinvenni'] });
T('svenire', { presente: ['svengo', 'svieni', 'sviene'], pp: 'svenuto', futuro: ['sverrò'] });
T('avvenire', { presente: [null, null, 'avviene'], passatoRemoto: [null, null, 'avvenne'], pp: 'avvenuto' });
T('convenire', { presente: ['convengo'], futuro: ['converrò'], pp: 'convenuto' });
T('intrattenere', { presente: ['intrattengo', 'intrattieni'], futuro: ['intratterrò'], pp: 'intrattenuto', passatoRemoto: ['intrattenni'] });
T('contenere', { presente: ['contengo', null, 'contiene'], pp: 'contenuto', futuro: ['conterrò'] });
T('detenere', { presente: ['detengo'], passatoRemoto: ['detenni'] });
T('sostenere', { presente: ['sostengo', 'sostieni', 'sostiene', 'sosteniamo', 'sostenete', 'sostengono'], congiuntivoPresente: ['sostenga'], imperativo: ['sostieni'] });
T('equivalere', { presente: ['equivalgo', null, 'equivale'], pp: 'equivalso', futuro: ['equivarrò'] });
T('prevalere', { pp: 'prevalso', passatoRemoto: ['prevalsi'] });
T('avvalersi', { presente: ['mi avvalgo'], pp: 'avvalso' });
T('compiacere', { presente: ['compiaccio'], pp: 'compiaciuto', passatoRemoto: ['compiacqui'] });
T('soggiacere', { presente: ['soggiaccio'], pp: 'soggiaciuto' });
T('accadere', { passatoRemoto: [null, null, 'accadde'], futuro: [null, null, 'accadrà'], pp: 'accaduto' });
T('scadere', { futuro: ['scadrò'], passatoRemoto: ['scaddi'], pp: 'scaduto' });
T('decadere', { futuro: ['decadrò'] });
T('rivedere', { passatoRemoto: ['rividi'], pp: 'rivisto', futuro: ['rivedrò'] });
T('intravedere', { pp: 'intravisto', passatoRemoto: ['intravidi'] });
T('stravedere', { presente: ['stravedo'], pp: 'stravisto' });
T('prevedere', { futuro: ['prevedrò'], pp: 'previsto', passatoRemoto: ['previdi'] });
T('provvedere', { futuro: ['provvederò'], condizionale: ['provvederei'] });
T('richiedere', { passatoRemoto: ['richiesi'], pp: 'richiesto' });
// -udere / -idere / -adere / -odere derivatives
T('rinchiudere', { pp: 'rinchiuso', passatoRemoto: ['rinchiusi'] });
T('racchiudere', { pp: 'racchiuso' });
T('socchiudere', { pp: 'socchiuso' });
T('dischiudere', { pp: 'dischiuso' });
T('richiudere', { pp: 'richiuso' });
T('includere', { pp: 'incluso', passatoRemoto: ['inclusi'] });
T('precludere', { pp: 'precluso' });
T('occludere', { pp: 'occluso' });
T('illudere', { pp: 'illuso', passatoRemoto: ['illusi'] });
T('eludere', { pp: 'eluso' });
T('alludere', { pp: 'alluso', passatoRemoto: ['allusi'] });
T('colludere', { pp: 'colluso' });
T('circoncidere', { pp: 'circonciso' });
T('coincidere', { pp: 'coinciso', passatoRemoto: [null, null, 'coincise'] });
T('recidere', { pp: 'reciso' });
T('elidere', { pp: 'eliso' });
T('collidere', { pp: 'colliso' });
T('deridere', { pp: 'deriso', passatoRemoto: ['derisi'] });
T('irridere', { pp: 'irriso' });
T('suddividere', { pp: 'suddiviso' });
T('evadere', { pp: 'evaso' });
T('pervadere', { pp: 'pervaso' });
T('dissuadere', { pp: 'dissuaso' });
T('corrodere', { pp: 'corroso', passatoRemoto: ['corrosi'] });
T('erodere', { pp: 'eroso' });
T('implodere', { pp: 'imploso' });
// -ergere / -orgere / -olvere / -ungere / -igere / -iggere / -uotere derivatives
T('immergere', { pp: 'immerso', passatoRemoto: ['immersi'] });
T('sommergere', { pp: 'sommerso' });
T('detergere', { pp: 'deterso' });
T('assurgere', { pp: 'assurto', passatoRemoto: ['assursi'] });
T('risorgere', { pp: 'risorto', passatoRemoto: ['risorsi'] });
T('insorgere', { pp: 'insorto' });
T('sporgere', { pp: 'sporto', passatoRemoto: ['sporsi'] });
T('dissolvere', { pp: 'dissolto', passatoRemoto: ['dissolsi'] });
T('assolvere', { pp: 'assolto', passatoRemoto: ['assolsi'] });
T('congiungere', { pp: 'congiunto', passatoRemoto: ['congiunsi'] });
T('disgiungere', { pp: 'disgiunto' });
T('soggiungere', { pp: 'soggiunto' });
T('ingiungere', { pp: 'ingiunto' });
T('sopraggiungere', { pp: 'sopraggiunto', passatoRemoto: [null, null, 'sopraggiunse'] });
T('espungere', { pp: 'espunto' });
T('prefiggere', { pp: 'prefisso' });
T('soffriggere', { pp: 'soffritto' });
T('rileggere', { pp: 'riletto', passatoRemoto: ['rilessi'] });
T('rieleggere', { pp: 'rieletto' });
T('sorreggere', { pp: 'sorretto', passatoRemoto: ['sorressi'] });
T('correggere', { passatoRemoto: ['corressi'], pp: 'corretto' });
T('riscuotere', { pp: 'riscosso', passatoRemoto: ['riscossi'] });
T('ripercuotere', { pp: 'ripercosso' });
T('rescindere', { pp: 'rescisso', passatoRemoto: ['rescissi'] });
T('deflettere', { pp: 'deflesso' });
T('annettere', { pp: 'annesso', passatoRemoto: ['annessi'] });
T('disconnettere', { pp: 'disconnesso' });
T('interconnettere', { pp: 'interconnesso' });
T('sconnettere', { pp: 'sconnesso' });
T('ridiscutere', { pp: 'ridiscusso' });
T('presumere', { pp: 'presunto', passatoRemoto: ['presunsi'] });
T('riassumere', { pp: 'riassunto' });
T('desumere', { pp: 'desunto' });
T('comprimere', { pp: 'compresso', passatoRemoto: ['compressi'] });
T('sopprimere', { pp: 'soppresso' });
T('imprimere', { pp: 'impresso' });
T('opprimere', { pp: 'oppresso' });
T('repellere', { pp: 'repulso' });
T('avvincere', { pp: 'avvinto' });
T('evincere', { pp: 'evinto', passatoRemoto: ['evinsi'] });
T('stravincere', { pp: 'stravinto' });
T('rimpiangere', { pp: 'rimpianto', passatoRemoto: ['rimpiansi'] });
T('compiangere', { pp: 'compianto' });
T('infrangere', { pp: 'infranto', passatoRemoto: ['infransi'] });
T('sospingere', { pp: 'sospinto' });
T('respingere', { pp: 'respinto', passatoRemoto: ['respinsi'] });
T('astringere', { pp: 'astretto' });
T('attingere', { pp: 'attinto', passatoRemoto: ['attinsi'] });
T('stingere', { pp: 'stinto' });
T('recingere', { pp: 'recinto' });
T('ridipingere', { pp: 'ridipinto' });
// -gliere / -correre / -mettere / -vivere / -scrivere / -scere / -uovere / -mpere / -rcere / -lgere / -ndere derivatives
T('accogliere', { presente: ['accolgo', 'accogli'], pp: 'accolto', passatoRemoto: ['accolsi'] });
T('prescegliere', { pp: 'prescelto', presente: ['prescelgo'] });
T('distogliere', { pp: 'distolto', presente: ['distolgo'], passatoRemoto: ['distolsi'] });
T('disciogliere', { pp: 'disciolto' });
T('ricogliere', { pp: 'ricolto' });
T('rincorrere', { pp: 'rincorso', passatoRemoto: ['rincorsi'] });
T('occorrere', { passatoRemoto: [null, null, 'occorse'], pp: 'occorso' });
T('concorrere', { pp: 'concorso' });
T('decorrere', { pp: 'decorso' });
T('incorrere', { pp: 'incorso' });
T('discorrere', { pp: 'discorso', passatoRemoto: ['discorsi'] });
T('accorrere', { pp: 'accorso' });
T('intercorrere', { pp: 'intercorso' });
T('compromettere', { pp: 'compromesso', passatoRemoto: ['compromisi'] });
T('frammettere', { pp: 'frammesso' });
T('manomettere', { pp: 'manomesso', passatoRemoto: ['manomisi'] });
T('sottomettere', { pp: 'sottomesso' });
T('dimettere', { pp: 'dimesso' });
T('emettere', { pp: 'emesso', passatoRemoto: ['emisi'] });
T('immettere', { pp: 'immesso' });
T('premettere', { pp: 'premesso' });
T('omettere', { pp: 'omesso', passatoRemoto: ['omisi'] });
T('rimettere', { pp: 'rimesso' });
T('convivere', { pp: 'convissuto', passatoRemoto: ['convissi'], futuro: ['convivrò'] });
T('rivivere', { pp: 'rivissuto' });
T('sopravvivere', { futuro: ['sopravvivrò'] });
T('iscrivere', { pp: 'iscritto', passatoRemoto: ['iscrissi'] });
T('prescrivere', { pp: 'prescritto' });
T('sottoscrivere', { pp: 'sottoscritto', passatoRemoto: ['sottoscrissi'] });
T('trascrivere', { pp: 'trascritto' });
T('circoscrivere', { pp: 'circoscritto' });
T('ascrivere', { pp: 'ascritto' });
T('proscrivere', { pp: 'proscritto' });
T('riscrivere', { pp: 'riscritto' });
T('rinascere', { pp: 'rinato', passatoRemoto: ['rinacqui'] });
T('riconoscere', { pp: 'riconosciuto', passatoRemoto: ['riconobbi'] });
T('disconoscere', { pp: 'disconosciuto' });
T('misconoscere', { pp: 'misconosciuto' });
T('accrescere', { pp: 'accresciuto', passatoRemoto: ['accrebbi'] });
T('rincrescere', { pp: 'rincresciuto', passatoRemoto: [null, null, 'rincrebbe'] });
T('decrescere', { pp: 'decresciuto' });
T('smuovere', { pp: 'smosso', passatoRemoto: ['smossi'] });
T('rimuovere', { pp: 'rimosso', presente: ['rimuovo'] });
T('promuovere', { passatoRemoto: ['promossi'] });
T('corrompere', { pp: 'corrotto', passatoRemoto: ['corruppi'] });
T('dirompere', { pp: 'dirotto' });
T('scuocere', { pp: 'scotto', passatoRemoto: ['scossi'] });
T('cospargere', { pp: 'cosparso', passatoRemoto: ['cosparsi'] });
T('contorcere', { pp: 'contorto', passatoRemoto: ['contorsi'] });
T('estorcere', { pp: 'estorto' });
T('distorcere', { pp: 'distorto' });
T('storcere', { pp: 'storto', passatoRemoto: ['storsi'] });
T('ritorcere', { pp: 'ritorto' });
T('capovolgere', { pp: 'capovolto', passatoRemoto: ['capovolsi'] });
T('sconvolgere', { pp: 'sconvolto' });
T('stravolgere', { pp: 'stravolto' });
T('travolgere', { pp: 'travolto', passatoRemoto: ['travolsi'] });
T('avvolgere', { pp: 'avvolto' });
T('involgere', { pp: 'involto' });
T('rivolgere', { passatoRemoto: ['rivolsi'] });
T('disperdere', { pp: 'disperso', passatoRemoto: ['dispersi'] });
T('sperdere', { pp: 'sperso' });
T('riaccendere', { pp: 'riacceso' });
T('rinascondere', { pp: 'rinascosto' });
T('corrispondere', { pp: 'corrisposto', passatoRemoto: ['corrisposi'] });
T('trasfondere', { pp: 'trasfuso' });
T('profondere', { pp: 'profuso', passatoRemoto: ['profusi'] });
T('effondere', { pp: 'effuso' });
T('rifondere', { pp: 'rifuso' });
T('infondere', { pp: 'infuso' });
T('ascendere', { pp: 'asceso', passatoRemoto: ['ascesi'] });
T('discendere', { pp: 'disceso' });
T('condiscendere', { pp: 'condisceso' });
T('trascendere', { pp: 'trasceso' });
T('propendere', { pp: 'propeso' });
T('sospendere', { passatoRemoto: ['sospesi'] });
T('stendere', { pp: 'steso', passatoRemoto: ['stesi'] });
T('distendere', { pp: 'disteso' });
T('contendere', { pp: 'conteso' });
T('protendere', { pp: 'proteso' });
T('sottintendere', { pp: 'sottinteso', passatoRemoto: ['sottintesi'] });
T('fraintendere', { pp: 'frainteso', passatoRemoto: ['fraintesi'] });
T('attendere', { pp: 'atteso', passatoRemoto: ['attesi'] });
T('disattendere', { passatoRemoto: ['disattesi'] });
// -ire derivatives
T('riaprire', { pp: 'riaperto', presente: ['riapro'] });
T('ricoprire', { pp: 'ricoperto' });
T('riscoprire', { presente: ['riscopro'] });
T('riapparire', { presente: ['riappaio'], pp: 'riapparso', passatoRemoto: ['riapparvi'] });
T('ricomparire', { presente: ['ricompaio'], pp: 'ricomparso' });
T('assalire', { presente: ['assalgo', 'assali'], congiuntivoPresente: ['assalga'], pp: 'assalito' });
T('risalire', { presente: ['risalgo', null, null, null, null, 'risalgono'] });
// regular verbs that must not be derived from a shorter irregular base
T('rimandare', { presente: ['rimando'], pp: 'rimandato', passatoRemoto: ['rimandai'] });
T('comandare', { presente: ['comando', 'comandi'], futuro: ['comanderò'] });
T('sedare', { presente: ['sedo', 'sedi', 'seda'], passatoRemoto: ['sedai'] });
T('spedire', { presente: ['spedisco'], pp: 'spedito' });
T('tradire', { presente: ['tradisco'], pp: 'tradito' });
T('condire', { presente: ['condisco'], pp: 'condito' });
T('rivendere', { pp: 'rivenduto', passatoRemoto: ['rivendei'] });
T('ricredersi', { pp: 'ricreduto', presente: ['mi ricredo'] });
T('presiedere', { presente: ['presiedo', 'presiedi'], pp: 'presieduto', passatoRemoto: ['presiedetti'] });
T('risiedere', { presente: ['risiedo'], pp: 'risieduto' });
T('sbattere', { pp: 'sbattuto', passatoRemoto: ['sbattei'] });
T('preesistere', { pp: 'preesistito' });
T('accostare', { presente: ['accosto'], futuro: ['accosterò'] });
T('sostare', { presente: ['sosto'], passatoRemoto: ['sostai'], pp: 'sostato' });
T('soccombere', { pp: 'soccombuto', presente: ['soccombo'] });

// regularity: regularParadigm / irregularCells power the "why it's irregular" explanations
const ALL6 = [0, 1, 2, 3, 4, 5];
function cells(inf, meta, expected, absent = []) {
  const got = irregularCells(inf, meta);
  for (const [k, idx] of Object.entries(expected)) {
    checks++;
    const g = got[k];
    if (!g || g.join(',') !== idx.join(',')) { fails++; console.log(`FAIL irregularCells ${inf}.${k}: expected [${idx}], got ${g ? '[' + g + ']' : 'none'}`); }
  }
  for (const k of absent) { checks++; if (got[k]) { fails++; console.log(`FAIL irregularCells ${inf}.${k}: expected none, got [${got[k]}]`); } }
}
function noCells(inf, meta) {
  checks++;
  const got = irregularCells(inf, meta);
  if (Object.keys(got).length) { fails++; console.log(`FAIL irregularCells ${inf}: expected {}, got ${JSON.stringify(got)}`); }
}
cells('essere', { aux: 'essere' }, { presente: ALL6, imperfetto: ALL6, passatoRemoto: ALL6, futuro: ALL6, condizionale: ALL6, congiuntivoPresente: ALL6, congiuntivoImperfetto: ALL6, imperativo: [0, 1, 2, 3, 4], participioPassato: [0] }, ['gerundio']);
noCells('finire', {}); noCells('finire', { isc: true }); noCells('cercare', {}); noCells('pagare', {}); noCells('mangiare', {}); noCells('cominciare', {});
noCells('inviare', {}); noCells('sognare', {}); noCells('dormire', { isc: false }); noCells('alzarsi', {}); noCells('capire', {}); noCells('credere', {}); noCells('vendere', {});
cells('andare', { aux: 'essere' }, { presente: [0, 1, 2, 5], futuro: ALL6, condizionale: ALL6, congiuntivoPresente: [0, 1, 2, 5], imperativo: [0, 1, 4] }, ['imperfetto', 'passatoRemoto', 'congiuntivoImperfetto', 'participioPassato', 'gerundio']);
cells('prendere', {}, { passatoRemoto: [0, 2, 5], participioPassato: [0] }, ['presente', 'imperfetto', 'futuro', 'condizionale', 'congiuntivoPresente', 'congiuntivoImperfetto', 'imperativo', 'gerundio']);
cells('potere', {}, { presente: [0, 1, 2, 3, 5], imperativo: [0, 1, 2, 3, 4] }, ['passatoRemoto', 'participioPassato']);
cells('dire', {}, { participioPassato: [0], gerundio: [0] });
cells('venire', {}, { presente: [0, 1, 2, 5], passatoRemoto: [0, 2, 5], futuro: ALL6, participioPassato: [0] }, ['imperfetto', 'gerundio']);
// compound alternatives are distributed on both sides, never "se l'è|se la è cavata"
T('vedersela', { passatoProssimo: ['me la sono veduta'] });
T('apparire', { passatoProssimo: ['sono apparso/a'], trapassatoProssimo: [null, null, 'era apparso/a'] }, { aux: 'essere' });
no('cavarsela', 'passatoProssimo', 2, "se l'è");
T('cavarsela', { passatoProssimo: [null, null, 'se la è cavata'] });
cells('avere', {}, { presente: [0, 1, 2, 3, 5], passatoRemoto: [0, 2, 5], futuro: ALL6 }, ['imperfetto', 'participioPassato', 'gerundio']);
cells('porre', {}, { presente: ALL6, participioPassato: [0], gerundio: [0] }, ['futuro']);
cells('fare', {}, { presente: [0, 1, 3, 5], participioPassato: [0], gerundio: [0], futuro: ALL6 });
cells('proporre', {}, { participioPassato: [0] }, ['futuro']);
cells('andarsene', {}, { presente: [0, 1, 2, 5], imperativo: [0, 1, 4] }, ['participioPassato']);
cells('dirimere', {}, { participioPassato: [0], imperativo: [0, 1, 2, 3, 4] }, ['presente']);
cells('compiere', {}, { presente: [4], imperativo: [3] }, ['participioPassato']);
cells('vedere', {}, { passatoRemoto: [0, 2, 5], participioPassato: [0], futuro: ALL6 }, ['presente']);
cells('restringere', {}, { passatoRemoto: [0, 2, 5], participioPassato: [0] }, ['presente']);
{
  const r = regularParadigm('essere', { aux: 'essere' });
  checks++; if (r.tenses.presente[0] !== 'esso') { fails++; console.log('FAIL regularParadigm essere presente'); }
  checks++; if (r.nonFinite.participioPassato !== 'essuto') { fails++; console.log('FAIL regularParadigm essere pp'); }
  checks++; if (r.irregular) { fails++; console.log('FAIL regularParadigm essere irregular flag'); }
  checks++; if (r.tenses.passatoProssimo[0] !== 'sono essuto/a') { fails++; console.log('FAIL regularParadigm essere compound'); }
  checks++; if (regularParadigm('andare').tenses.futuro[0] !== 'anderò') { fails++; console.log('FAIL regularParadigm andare futuro'); }
  checks++; if (regularParadigm('cercare').tenses.presente[1] !== 'cerchi') { fails++; console.log('FAIL regularParadigm cercare spelling'); }
  checks++; if (regularParadigm('porre').tenses.futuro[0] !== 'porrò') { fails++; console.log('FAIL regularParadigm porre futuro'); }
  checks++; if (regularParadigm('capire', { isc: true }).tenses.presente[0] !== 'capisco') { fails++; console.log('FAIL regularParadigm capire isc'); }
  checks++; if (regularParadigm('alzarsi').tenses.presente[0] !== 'mi alzo') { fails++; console.log('FAIL regularParadigm alzarsi clitic'); }
  checks++; if (regularParadigm('prendere').tenses.passatoRemoto[0] !== 'prendei|prendetti') { fails++; console.log('FAIL regularParadigm prendere pr alternatives'); }
  checks++; if (conjugate('andare').tenses.presente[0] !== 'vado') { fails++; console.log('FAIL conjugate cache must not be polluted by regularParadigm'); }
}

// ---------------------------------------------------------------------------------------------------
// Engine audit: compound gerund with clitics, "ne" elision, both-auxiliary verbs, participle alternatives,
// passato remoto alternatives, present participles, gaps for verbs added by hand
// ---------------------------------------------------------------------------------------------------
function nf(inf, key, expected, meta) {
  checks++;
  const got = conjugate(inf, meta).nonFinite[key];
  if (got == null || !accepted(got).includes(expected)) { fails++; console.log(`FAIL ${inf} ${key}: expected "${expected}", got "${got}"`); }
}
// the clitic attaches to the auxiliary of the compound gerund, exactly as in the past infinitive
nf('alzarsi', 'gerundioPassato', 'essendosi alzato/a', { aux: 'essere' }); nf('alzarsi', 'infinitoPassato', 'essersi alzato/a', { aux: 'essere' });
nf('andarsene', 'gerundioPassato', 'essendosene andato/a', { aux: 'essere' });
nf('farcela', 'gerundioPassato', 'avendocela fatta'); nf('farcela', 'infinitoPassato', 'avercela fatta');
nf('metterci', 'gerundioPassato', 'avendoci messo'); nf('cavarsela', 'gerundioPassato', 'essendosela cavata');
nf('smetterla', 'gerundioPassato', 'avendola smessa'); nf('uscirne', 'gerundioPassato', 'essendone uscito/a', { aux: 'essere' });
nf('mangiare', 'gerundioPassato', 'avendo mangiato'); nf('andare', 'gerundioPassato', 'essendo andato/a', { aux: 'essere' });
checks++; if (accepted(conjugate('alzarsi', { aux: 'essere' }).nonFinite.gerundioPassato).includes('essendo alzato/a')) { fails++; console.log('FAIL alzarsi gerundioPassato must not drop the clitic'); }
// "ne" elides before a form of essere starting in e (also accepted unelided)
T('andarsene', { passatoProssimo: [null, null, "se n'è andato/a"], trapassatoProssimo: ["me n'ero andato/a", null, "se n'era andato/a", null, null, "se n'erano andati/e"] }, { aux: 'essere' });
T('andarsene', { passatoProssimo: [null, null, 'se ne è andato/a'], trapassatoProssimo: ['me ne ero andato/a'], imperfetto: ['me ne andavo'], presente: ['me ne vado'] }, { aux: 'essere' });
T('fregarsene', { passatoProssimo: [null, null, "se n'è fregato/a"] }, { aux: 'essere' });
T('accorgersene', { passatoProssimo: [null, null, "se n'è accorto/a", null, null, 'se ne sono accorti/e'] });
T('uscirne', { passatoProssimo: ['ne sono uscito/a', null, "n'è uscito/a"] }, { aux: 'essere' });
checks++; if (!isCorrectForm("se n'è andato", conjugate('andarsene', { aux: 'essere' }).tenses.passatoProssimo[2])) { fails++; console.log("FAIL isCorrectForm se n'è andato"); }
// verbs that take both auxiliaries: avere is primary (the drill says "use avere"), the essere form is listed and accepted
T('salire', { passatoProssimo: ['ho salito', 'hai salito', 'ha salito', 'abbiamo salito', 'avete salito', 'hanno salito'] }, { aux: 'both', isc: false });
T('salire', { passatoProssimo: ['sono salito/a', 'sei salito/a', 'è salito/a', 'siamo saliti/e', 'siete saliti/e', 'sono saliti/e'], trapassatoProssimo: ['ero salito/a'], futuroAnteriore: ['sarò salito/a'], condizionalePassato: ['sarei salito/a'], congiuntivoPassato: ['sia salito/a'], congiuntivoTrapassato: ['fossi salito/a'], trapassatoRemoto: ['fui salito/a'] }, { aux: 'both', isc: false });
checks++; if (primary(conjugate('salire', { aux: 'both', isc: false }).tenses.passatoProssimo[0]) !== 'ho salito') { fails++; console.log('FAIL salire both: avere must stay primary'); }
T('scendere', { passatoProssimo: ['ho sceso', 'sono sceso/a'].map((f, i) => (i ? null : f)) }, { aux: 'both' }); T('scendere', { passatoProssimo: ['sono sceso/a', null, 'è sceso/a'] }, { aux: 'both' });
T('piovere', { passatoProssimo: [null, null, 'è piovuto/a'] }, { aux: 'both' }); T('piovere', { passatoProssimo: [null, null, 'ha piovuto'] }, { aux: 'both' });
T('crescere', { passatoProssimo: ['sono cresciuto/a'] }, { aux: 'both' }); T('correre', { passatoProssimo: ['ho corso', null, null, null, null, 'hanno corso'] }, { aux: 'both' }); T('correre', { passatoProssimo: [null, null, 'è corso/a'] }, { aux: 'both' });
nf('salire', 'infinitoPassato', 'essere salito/a', { aux: 'both', isc: false }); nf('salire', 'infinitoPassato', 'avere salito', { aux: 'both', isc: false }); nf('salire', 'gerundioPassato', 'essendo salito/a', { aux: 'both', isc: false });
T('mangiare', { passatoProssimo: ['ho mangiato'] }, { aux: 'both' }); no('mangiare', 'passatoProssimo', 0, 'ho mangiato|sono mangiato/a');
no('andare', 'passatoProssimo', 0, 'ho andato', { aux: 'essere' }); no('fare', 'passatoProssimo', 0, 'sono fatto/a');
checks++; if (!isCorrectForm('sono salita', conjugate('salire', { aux: 'both', isc: false }).tenses.passatoProssimo[0])) { fails++; console.log('FAIL isCorrectForm sono salita (both)'); }
// every participle alternative is accepted in the compound tenses with avere too
T('perdere', { passatoProssimo: ['ho perso', null, 'ha perso'] }); T('perdere', { passatoProssimo: ['ho perduto', null, 'ha perduto'] });
T('vedere', { passatoProssimo: ['ho visto'] }); T('vedere', { passatoProssimo: ['ho veduto'] });
checks++; if (primary(conjugate('perdere').tenses.passatoProssimo[0]) !== 'ho perso') { fails++; console.log('FAIL perdere passatoProssimo primary'); }
// passato remoto alternatives (Treccani): persi / perdetti / perdei; bevvi / bevetti; risolsi / risolvetti; aprii / apersi, offrii / offersi
T('perdere', { passatoRemoto: ['persi', 'perdesti', 'perse', 'perdemmo', 'perdeste', 'persero'] });
T('perdere', { passatoRemoto: ['perdetti', null, 'perdette', null, null, 'perdettero'] }); T('perdere', { passatoRemoto: ['perdei', null, 'perdé', null, null, 'perderono'] });
checks++; if (primary(conjugate('perdere').tenses.passatoRemoto[2]) !== 'perse') { fails++; console.log('FAIL perdere passatoRemoto primary'); }
T('disperdere', { passatoRemoto: ['dispersi', null, 'disperse'] }); T('disperdere', { passatoRemoto: ['disperdetti'] });
T('bere', { passatoRemoto: ['bevetti', null, 'bevette', null, null, 'bevettero'] }); T('bere', { passatoRemoto: ['bevvi', 'bevesti', 'bevve', 'bevemmo', 'beveste', 'bevvero'] });
checks++; if (primary(conjugate('bere').tenses.passatoRemoto[0]) !== 'bevvi') { fails++; console.log('FAIL bere passatoRemoto primary'); }
T('risolvere', { passatoRemoto: ['risolvetti', null, 'risolvette'] }); T('risolvere', { passatoRemoto: ['risolvei', null, 'risolvé'] }); T('risolvere', { passatoRemoto: ['risolsi', 'risolvesti', 'risolse'] });
T('assolvere', { passatoRemoto: ['assolvetti'] }); T('dissolvere', { passatoRemoto: ['dissolvei'] });
T('aprire', { passatoRemoto: ['aprii', 'apristi', 'aprì', 'aprimmo', 'apriste', 'aprirono'] }); T('aprire', { passatoRemoto: ['apersi', null, 'aperse', null, null, 'apersero'] });
checks++; if (primary(conjugate('aprire').tenses.passatoRemoto[2]) !== 'aprì') { fails++; console.log('FAIL aprire passatoRemoto primary'); }
T('coprire', { passatoRemoto: ['coprii', null, 'coprì'] }); T('coprire', { passatoRemoto: ['copersi', null, 'coperse'] });
T('scoprire', { passatoRemoto: ['scoprii', null, 'scoprì'] }); T('scoprire', { passatoRemoto: ['scopersi'] }); T('riaprire', { passatoRemoto: ['riaprii'] });
T('offrire', { passatoRemoto: ['offrii', 'offristi', 'offrì', 'offrimmo', 'offriste', 'offrirono'] }); T('offrire', { passatoRemoto: ['offersi', null, 'offerse', null, null, 'offersero'] });
T('soffrire', { passatoRemoto: ['soffrii', null, 'soffrì'] }); T('soffrire', { passatoRemoto: ['soffersi', null, 'sofferse'] });
// dovere / dolere / compiere alternatives
T('dovere', { congiuntivoPresente: ['deva', 'deva', 'deva', 'dobbiamo', 'dobbiate', 'devano'] }); T('dovere', { congiuntivoPresente: ['debba', null, null, null, null, 'debbano'] });
checks++; if (primary(conjugate('dovere').tenses.congiuntivoPresente[0]) !== 'debba') { fails++; console.log('FAIL dovere congiuntivo primary'); }
T('dolere', { congiuntivoPresente: ['dolga', null, null, 'dogliamo', 'dogliate', 'dolgano'] }); T('dolere', { congiuntivoPresente: [null, null, null, 'doliamo', 'doliate'] });
T('compiere', { futuro: ['compierò', null, 'compierà'], condizionale: ['compierei'], imperfetto: ['compievo', null, 'compieva'] });
T('compiere', { futuro: ['compirò', 'compirai', 'compirà', 'compiremo', 'compirete', 'compiranno'], imperfetto: ['compivo', 'compivi', 'compiva', 'compivamo', 'compivate', 'compivano'] });
checks++; if (primary(conjugate('compiere').tenses.futuro[0]) !== 'compirò') { fails++; console.log('FAIL compiere futuro primary'); }
// inferire: "to infer" is regular (the strong forms are "inferire un colpo"); no ghost forms like "inferie"
T('inferire', { passatoRemoto: ['inferii', 'inferisti', 'inferì', 'inferimmo', 'inferiste', 'inferirono'], pp: 'inferito', presente: ['inferisco'], passatoProssimo: ['ho inferito'] }, { isc: true });
T('inferire', { passatoRemoto: ['infersi', null, 'inferse', null, null, 'infersero'], pp: 'inferto', passatoProssimo: ['ho inferto'] }, { isc: true });
no('inferire', 'passatoRemoto', 2, 'inferie', { isc: true }); no('inferire', 'passatoRemoto', 5, 'inferiero', { isc: true });
checks++; if (primary(conjugate('inferire', { isc: true }).tenses.passatoRemoto[2]) !== 'inferì') { fails++; console.log('FAIL inferire passatoRemoto primary'); }
no('inferire', 'passatoRemoto', 0, 'inferi', { isc: true }); checks++; if (primary(conjugate('inferire', { isc: true }).nonFinite.participioPassato) !== 'inferito') { fails++; console.log('FAIL inferire pp primary'); }
// indulgere: participle indulto (not "indulso"); fendere: fenduto is the primary participle, fesso stays accepted
T('indulgere', { passatoProssimo: ['ho indulto', null, 'ha indulto'] }); no('indulgere', 'pp', 0, 'indulso'); no('indulgere', 'passatoProssimo', 2, 'ha indulso');
T('fendere', { passatoProssimo: [null, null, 'ha fenduto'] }); T('fendere', { passatoProssimo: [null, null, 'ha fesso'] });
checks++; if (primary(conjugate('fendere').nonFinite.participioPassato) !== 'fenduto') { fails++; console.log('FAIL fendere pp primary'); }
// delinquere: defective (only the infinitive is in use), no invented "delinquuto" / "delinquerò"
T('delinquere', { condizionale: ['—'], congiuntivoPassato: ['—'], trapassatoProssimo: ['—'] }); no('delinquere', 'pp', 0, 'delinquuto'); no('delinquere', 'futuro', 0, 'delinquerò');
checks++; if (!['passatoRemoto', 'futuro', 'participioPassato'].every(k => conjugate('delinquere').defective.includes(k))) { fails++; console.log('FAIL delinquere.defective'); }
// the passato remoto alternatives reach every derived verb, and primaries stay the common forms
T('sperdere', { passatoRemoto: ['spersi', null, 'sperse'] }); T('sperdere', { passatoRemoto: ['sperdetti', null, 'sperdette'] });
T('ricoprire', { passatoRemoto: ['ricopersi', null, 'ricoperse'] }); T('riaprire', { passatoRemoto: [null, null, 'riaperse'] });
T('dissolvere', { passatoRemoto: ['dissolvetti', null, 'dissolvette'] }); T('condolere', { congiuntivoPresente: [null, null, null, 'condogliamo'] });
for (const [inf, tense, i, p] of [['risolvere', 'passatoRemoto', 0, 'risolsi'], ['offrire', 'passatoRemoto', 2, 'offrì'], ['soffrire', 'passatoRemoto', 0, 'soffrii'], ['scoprire', 'passatoRemoto', 2, 'scoprì'], ['dolere', 'congiuntivoPresente', 3, 'doliamo'], ['compiere', 'imperfetto', 0, 'compivo'], ['compiere', 'condizionale', 0, 'compirei']]) {
  checks++; if (primary(conjugate(inf).tenses[tense][i]) !== p) { fails++; console.log(`FAIL ${inf} ${tense}[${i}] primary: expected "${p}"`); }
}
// present participles that do not follow the plain -ente pattern (prefixes apply)
for (const [inf, f] of Object.entries({ sapere: 'sapiente', venire: 'veniente', convenire: 'conveniente', provenire: 'proveniente', dormire: 'dormiente', obbedire: 'obbediente', ubbidire: 'ubbidiente', cuocere: 'cocente', parere: 'parvente', nutrire: 'nutriente', salire: 'saliente', esordire: 'esordiente', patire: 'paziente', capire: 'capiente', sentire: 'senziente', uscire: 'uscente', seguire: 'seguente', morire: 'morente', servire: 'servente', parlare: 'parlante', fare: 'facente', dire: 'dicente', porre: 'ponente', condurre: 'conducente', trarre: 'traente', piacere: 'piacente', vivere: 'vivente' })) nf(inf, 'participioPresente', f);
// lexicalised participles of single verbs, also when the verb is a prefix + root derivative (attenere = at- + tenere);
// the page shows primary(), so the primary is checked. avvenire keeps avveniente: avvenente comes from French avenant.
for (const [inf, f] of Object.entries({ soffrire: 'sofferente', offrire: 'offerente', consentire: 'consenziente', dissentire: 'dissenziente', assentire: 'assenziente', attenere: 'attinente', risalire: 'risalente', avvenire: 'avveniente', provenire: 'proveniente', contenere: 'contenente', appartenere: 'appartenente', salire: 'saliente', sentire: 'senziente' })) {
  checks++; const got = conjugate(inf).nonFinite.participioPresente; if (primary(got) !== f) { fails++; console.log(`FAIL ${inf} participioPresente primary: expected "${f}", got "${got}"`); }
}
nf('attenere', 'participioPresente', 'attenente');
checks++; if(conjugate('capire').nonFinite.participioPresente!=='capiente' || conjugate('capire').nonFiniteNotes?.participioPresente?.source!=='https://www.treccani.it/vocabolario/capiente/' || !conjugate('capire').nonFiniteNotes.participioPresente.text.includes('containment meaning')){fails++;console.log('FAIL capire: lexical participle lacks its capacity/containment meaning');}
checks++; if(conjugate('cuocere').nonFinite.participioPresente!=='cocente' || conjugate('cuocere').nonFiniteNotes?.participioPresente?.source!=='https://www.treccani.it/vocabolario/cocente/' || !conjugate('cuocere').nonFiniteNotes.participioPresente.text.includes('scalding')){fails++;console.log('FAIL cuocere: lexical adjective lacks its attested heat meaning');}
checks++; if(conjugate('riconoscere').nonFinite.participioPresente!=='riconoscente' || conjugate('riconoscere').nonFiniteNotes?.participioPresente?.source!=='https://www.treccani.it/vocabolario/riconoscente/' || !conjugate('riconoscere').nonFiniteNotes.participioPresente.text.includes('grateful')){fails++;console.log('FAIL riconoscere: lexical adjective lacks its ordinary grateful meaning');}
// Base lexical participles are not silently credited to clitic meanings:
// attinente concerns something; attenersi is adhering to a rule. Actual rare
// reflexive/pronominal participles require their own reviewed lexical evidence.
for (const inf of ['attenersi', 'addormentarsi', 'alzarsi', 'andarsene', 'farcela', 'cavarsela']) {
  checks++; const c=conjugate(inf);
  if (c.nonFinite.participioPresente!==MISSING || c.nonFiniteNotes?.participioPresente?.status!=='unreviewed-pronominal-form' || !c.nonFiniteNotes.participioPresente.source.startsWith('https://accademiadellacrusca.it/')) { fails++; console.log(`FAIL ${inf}: unverified clitic participle was supplied or lacks source explanation`); }
}
// both-auxiliary contract: auxBoth marks the verbs whose compound cells carry the essere forms after the avere ones
for (const [inf, meta, want] of [['salire', { aux: 'both', isc: false }, true], ['piovere', { aux: 'both' }, true], ['mangiare', {}, false], ['andare', { aux: 'essere' }, false], ['alzarsi', { aux: 'both' }, false]]) {
  checks++; if (conjugate(inf, meta).auxBoth !== want) { fails++; console.log(`FAIL ${inf}.auxBoth: expected ${want}`); }
}
checks++; if (conjugate('salire', { aux: 'both', isc: false }).nonFinite.gerundioPassato !== 'avendo salito|essendo salito/a') { fails++; console.log('FAIL salire gerundioPassato both order'); }
// irregular flag: an entry that only removes forms (pp: null, imp: null…) makes a defective verb, not an irregular one
for (const inf of ['splendere', 'concernere', 'competere', 'dirimere', 'esimersi', 'incombere', 'vertere', 'delinquere', 'discernere', 'incedere', 'prudere', 'urgere', 'vigere']) {
  const c = conjugate(inf);
  checks++; if (c.irregular || !c.defective.length) { fails++; console.log(`FAIL ${inf}: expected regular + defective, got irregular=${c.irregular} defective=[${c.defective}]`); }
}
// a verb whose irregular forms are all alternatives beside a regular primary (riflettuto|riflesso) stays irregular:
// irregularCells lists no cell, irregularAlternatives names the forms (the -isc- / plain pair of -ire verbs is regular)
for (const [inf, meta, exp] of [['riflettere', {}, { participioPassato: { 0: ['riflesso'] } }], ['fendere', {}, { participioPassato: { 0: ['fesso'] } }], ['inferire', { isc: true }, { passatoRemoto: { 0: ['infersi'], 2: ['inferse'], 5: ['infersero'] }, participioPassato: { 0: ['inferto'] } }], ['assorbire', { isc: false }, { participioPassato: { 0: ['assorto'] } }]]) {
  checks++; if (!conjugate(inf, meta).irregular) { fails++; console.log(`FAIL ${inf}.irregular must be true`); }
  noCells(inf, meta);
  checks++; const got = JSON.stringify(irregularAlternatives(inf, meta)); if (got !== JSON.stringify(exp)) { fails++; console.log(`FAIL irregularAlternatives ${inf}: expected ${JSON.stringify(exp)}, got ${got}`); }
}
// the flag is true exactly when some non-defective cell or some alternative is irregular
for (const [inf, meta] of [['parlare'], ['cercare'], ['finire'], ['essere', { aux: 'essere' }], ['andare', { aux: 'essere' }], ['fare'], ['prendere'], ['perdere'], ['bere'], ['proporre'], ['compiere'], ['offrire'], ['riflettere'], ['fendere'], ['inferire', { isc: true }], ['assorbire', { isc: false }], ['splendere'], ['vigere'], ['dirimere'], ['delinquere']]) {
  const c = conjugate(inf, meta || {}); const cl = irregularCells(inf, meta || {});
  const shown = Object.keys(cl).some(k => !c.defective.includes(k)) || Object.keys(irregularAlternatives(inf, meta || {})).length > 0;
  checks++; if (c.irregular !== shown) { fails++; console.log(`FAIL ${inf}: irregular=${c.irregular} but irregular forms found=${shown}`); }
}
// verbs not in the data set but reachable through "Add word"
T('sommettere', { passatoRemoto: ['sommisi', 'sommettesti', 'sommise'], pp: 'sommesso', presente: ['sommetto'] });
T('rifuggire', { presente: ['rifuggo', 'rifuggi', 'rifugge', 'rifuggiamo', 'rifuggite', 'rifuggono'], congiuntivoPresente: ['rifugga'] }); no('rifuggire', 'presente', 0, 'rifuggisco');
T('trasalire', { presente: ['trasalisco', 'trasalisci', 'trasalisce', 'trasaliamo', 'trasalite', 'trasaliscono'], congiuntivoPresente: ['trasalisca'], imperativo: ['trasalisci', 'trasalisca'], pp: 'trasalito', passatoRemoto: ['trasalii', null, 'trasalì'] });
T('trasalire', { presente: ['trasalgo', null, null, null, null, 'trasalgono'], congiuntivoPresente: ['trasalga'] });
checks++; if (primary(conjugate('trasalire').tenses.presente[0]) !== 'trasalisco') { fails++; console.log('FAIL trasalire primary'); }
T('ammaliare', { presente: ['ammalio', 'ammali', 'ammalia', 'ammaliamo', 'ammaliate', 'ammaliano'], congiuntivoPresente: ['ammali', null, null, null, null, 'ammalino'] }); no('ammaliare', 'presente', 1, 'ammalii');

// answer checking
checks++; if (!isCorrectForm('andata', 'andato/a')) { fails++; console.log('FAIL isCorrectForm agreement'); }
checks++; if (!isCorrectForm('vai', "va'|vai")) { fails++; console.log('FAIL isCorrectForm alt'); }
checks++; if (!isCorrectForm('sono andata', 'sono andato/a')) { fails++; console.log('FAIL isCorrectForm compound agreement'); }
checks++; if (isCorrectForm('ando', 'andò')) { fails++; console.log('FAIL isCorrectForm accent strictness'); }

console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
