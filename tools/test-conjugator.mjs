#!/usr/bin/env node
// Spot checks for the conjugation engine. Run: node tools/test-conjugator.mjs
import { conjugate, primary, accepted, isCorrectForm } from '../js/conjugator.js';

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
// answer checking
checks++; if (!isCorrectForm('andata', 'andato/a')) { fails++; console.log('FAIL isCorrectForm agreement'); }
checks++; if (!isCorrectForm('vai', "va'|vai")) { fails++; console.log('FAIL isCorrectForm alt'); }
checks++; if (!isCorrectForm('sono andata', 'sono andato/a')) { fails++; console.log('FAIL isCorrectForm compound agreement'); }
checks++; if (isCorrectForm('ando', 'andò')) { fails++; console.log('FAIL isCorrectForm accent strictness'); }

console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
