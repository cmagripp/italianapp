#!/usr/bin/env node
// Individually authored dictionary bridges for actual new course situations.
// Running this writes only the two named additive source files and one new
// progressive policy. build-data/build-verb-progressive remain the shared build.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateVocab,validateVerbs} from './validate.mjs';
const source=word=>`https://www.treccani.it/vocabolario/${word}/`;
export const courseWords=[
 {it:'trentuno',en:'thirty-one',pos:'num',level:'A1',cat:'numbers',ex:'La visita è il trentuno ottobre.',exEn:'The visit is on the thirty-first of October.',note:'Cardinal 31. Calendar dates use the cardinal after day one; before a noun, trentun also occurs.',sources:[source('trentuno')]},
 {it:'caricatore',en:'charger',pos:'noun',g:'m',pl:'caricatori',level:'A2',cat:'tech',ex:'Il caricatore del telefono non funziona.',exEn:'The phone charger does not work.',note:'Here an electrical battery charger; the machinery, person and ammunition meanings are not taught in this entry.',sources:[source('caricatore')]},
 {it:'bevanda',en:'drink; beverage',pos:'noun',g:'f',pl:'bevande',level:'A2',cat:'food',ex:'Vorrei una bevanda senza latte.',exEn:'I would like a drink without milk.',note:'A liquid drink. La bevanda / le bevande.',sources:[source('bevanda')]},
 {it:'tecnico',en:'technician',pos:'noun',g:'m',pl:'tecnici',fem:'tecnica',femPl:'tecniche',level:'A2',cat:'work',ex:'Il tecnico controlla il riscaldamento.',exEn:'The technician checks the heating.',note:'A person with practical technical expertise, here in a repair service. Feminine: tecnica, pl. tecniche. The adjective technical is a separate use.',sources:[source('tecnico')]},
 {it:'noce',en:'walnut',pos:'noun',g:'f',pl:'noci',level:'A2',cat:'food',ex:'Questi biscotti contengono noci.',exEn:'These biscuits contain walnuts.',note:'La noce is the edible fruit; le noci is its plural. Il noce is the tree, a separate masculine meaning. This entry gives vocabulary, not allergy advice.',sources:[source('noce1'),source('noce2')]},
 {it:'sostitutivo',en:'replacement; substitute',pos:'adj',forms:['sostitutivo','sostitutiva','sostitutivi','sostitutive'],level:'A2',cat:'travel',ex:'Il bus sostitutivo parte davanti alla stazione.',exEn:'The replacement bus leaves from in front of the station.',note:'Something serving in place of something else. Here it describes a replacement transport service, with no provider policy implied.',sources:[source('sostitutivo')]},
];
export const courseVerbs=[
 {inf:'riavere',en:'to get back; to have again',level:'A2',cat:'daily',aux:'avere',trans:'vt',irregular:true,patterns:['riavere + thing returned','riavere + opportunity/possession'],usage:'Conjugates like avere with ri-, but the present is riò, riài, rià, riabbiamo, riavete, rianno: it does not retain avere’s h. The future riavrò, conditional riavrei, participle riavuto and gerund riavendo preserve the prefix. Here it means receiving something back, rather than the separate pronominal riaversi, to recover.',examples:[{it:'Vorrei riavere lo scontrino.',en:'I would like to get the receipt back.'},{it:'Ieri ho riavuto le chiavi.',en:'Yesterday I got the keys back.'},{it:'Domani riavremo il documento.',en:'Tomorrow we will get the document back.'}],related:['avere','ricevere','restituire'],sources:[source('riavere')]},
];
export const riaverePolicy={inf:'riavere',policy:'simple',sense:'receive a returned object or state its restored possession',note:'These scenes use ordinary forms to state or request the return of a specific object. The imperfect describes a former repeated restitution (used to get back); the completed past got back belongs to passato prossimo. They do not describe a gradual recovery process: no progressive credit is available for this selected restitution sense. Other contextual uses, including pronominal riaversi, require separate review.',en:['get back','gets back','got back',''],imperfectEn:'used to get back',frames:[['il libro prestato','the book lent out'],['la cauzione','the deposit'],['il documento','the document'],['le chiavi','the keys']],sources:[source('riavere')]};
export function writeCourseWordSources(){
 for(const [kind,records,validate]of[['vocab',courseWords,validateVocab],['verbs',courseVerbs,validateVerbs]]){
  const errors=validate(records,'phase6-course-links');if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(new URL(`../data/${kind}/phase6-course-links.json`,import.meta.url),JSON.stringify(records,null,2)+'\n');
 }
 const file=new URL('../data/verb-progressive/beginner.json',import.meta.url),policies=JSON.parse(fs.readFileSync(file));
 const index=policies.findIndex(p=>p.inf==='riavere');if(index<0)policies.push(riaverePolicy);else policies[index]=riaverePolicy;
 policies.sort((a,b)=>a.inf.localeCompare(b.inf,'it'));fs.writeFileSync(file,JSON.stringify(policies,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){writeCourseWordSources();console.log('Six course vocabulary bridges and one individually authored riavere record/policy written.');}
