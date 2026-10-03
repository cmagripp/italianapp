// Editorial classification of preparation items. A displayed meaning may help
// with a name or a compositional construction without naming a dictionary
// learning entry. This is not a rule that discards unknown multiword lexemes.
const norm=s=>String(s||'').normalize('NFC').toLocaleLowerCase('it').replace(/[’‘]/g,"'").replace(/[.!?…]+$/u,'').trim().replace(/\s+/g,' ');
const places=new Map([
 ['Roma','Rome'],['Milano','Milan'],['Napoli','Naples'],['Firenze','Florence'],
 ['Italia','Italy'],['Svizzera','Switzerland'],['Torino','Turin'],['Bologna','Bologna'],['Verona','Verona'],
].map(([it,en])=>[norm(it),en.toLocaleLowerCase('en')]));
// Individually read constructions in the current Foundations/A1/A2 opening
// preparation. Their component meanings/form teaching remain in the lessons.
// A missing single word, inflected form or lexicalised noun stays eligible.
const constructions=new Set([
 'Può ripetere, per favore?','un chilo di pane','e tu?',
 'Ecco la casa.','La cena è pronta.','La casa è grande.',
 'di Roma','di Firenze','di Milano','a Roma','parli italiano','abiti a Roma',
 'vicina a','lontana da','alle otto','alle nove','all’una','molta acqua','poca acqua','due euro','Di chi è?',
 'sul tavolo','accanto al letto','alle sette','alle sei','senza zucchero','questa giacca','queste scarpe','Può aiutarmi?',
 'ho caldo','ho freddo','al parco','sto bene','sto male','alle dieci','dalle nove alle sei','Dopo il bar',
 'davanti alla stazione','al bar','alle cinque','Vuoi venire?','Qual è il suo numero di telefono?','il mio cognome',
 'il primo maggio','il dieci ottobre','taglia media','taglia grande',
 'proprio adesso','Il treno? L’aspetto.','La radio? L’ascolto.',
 'lo posso vedere','posso vederlo','la voglio leggere','voglio leggerla','un po’ d’acqua','vorrei visitare',
 'più che','meno che','il più alto','la più alta','del gruppo','della classe','della famiglia',
 'vengo da','viene da','da due anni','da ieri','abito qui','studio italiano',
 'nello zaino','sulla sedia','dai genitori','il libro che leggo','la donna che parla','qualcosa da bere',
 'alle quindici','per un imprevisto','numero di prenotazione','non sono disponibile','perdere una coincidenza',
 'davanti all’ingresso','sono allergico alle noci','sono allergica alle noci','prossima settimana','senza latte',
 'perdere acqua','da due giorni','è iniziato','è iniziata','Può spiegare di nuovo?','entro le dodici','dalle nove alle undici',
].map(norm));
export function courseGlossKind(gloss){
 const it=norm(gloss?.it),en=String(gloss?.en||'').toLocaleLowerCase('en');
 // An explicitly described fictional/name item never earns the riverbank or
 // red-adjective entry merely because Riva/Rossi share its written form.
 if(/\b(?:fictional (?:first )?name|fictional surname|(?:woman|man)[’']s name)\b/.test(en))return 'proper-name';
 const place=it.replace(/^l'/,'');
 if(places.get(place)===en.trim())return 'proper-name';
 if(constructions.has(it))return 'construction';
 return 'lexical';
}
