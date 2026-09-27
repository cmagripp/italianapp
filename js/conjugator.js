// Italian conjugation engine.
// conjugate(infinitive, { aux, isc, trans }) -> full paradigm (simple + compound tenses, non-finite forms),
// with support for spelling changes, irregular verbs, prefixed derivatives, reflexive and pronominal clitics.
// regularParadigm(inf, meta) -> the same paradigm computed as if the verb were regular (no IRREGULAR/DERIVED lookups).
// irregularCells(inf, meta) -> { tense: [personIdx...] } of cells whose primary form differs from the regular one.
import { IRREGULAR, FORCE_REGULAR, DERIVED } from './irregular.js';

export const PERSONS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'];
export const IMP_PERSONS = ['tu', 'Lei', 'noi', 'voi', 'Loro'];

// Placeholder for a form a defective verb lacks (e.g. the participle of "dirimere", the passato remoto of "solere").
export const MISSING = '—';

const END = {
  are: { pres: ['o', 'i', 'a', 'iamo', 'ate', 'ano'], imperf: ['avo', 'avi', 'ava', 'avamo', 'avate', 'avano'], pr: ['ai', 'asti', 'ò', 'ammo', 'aste', 'arono'], subj: ['i', 'i', 'i', 'iamo', 'iate', 'ino'], subjImp: ['assi', 'assi', 'asse', 'assimo', 'aste', 'assero'], pp: 'ato', ger: 'ando', fut: 'er' },
  ere: { pres: ['o', 'i', 'e', 'iamo', 'ete', 'ono'], imperf: ['evo', 'evi', 'eva', 'evamo', 'evate', 'evano'], pr: ['ei|etti', 'esti', 'é|ette', 'emmo', 'este', 'erono|ettero'], subj: ['a', 'a', 'a', 'iamo', 'iate', 'ano'], subjImp: ['essi', 'essi', 'esse', 'essimo', 'este', 'essero'], pp: 'uto', ger: 'endo', fut: 'er' },
  ire: { pres: ['o', 'i', 'e', 'iamo', 'ite', 'ono'], imperf: ['ivo', 'ivi', 'iva', 'ivamo', 'ivate', 'ivano'], pr: ['ii', 'isti', 'ì', 'immo', 'iste', 'irono'], subj: ['a', 'a', 'a', 'iamo', 'iate', 'ano'], subjImp: ['issi', 'issi', 'isse', 'issimo', 'iste', 'issero'], pp: 'ito', ger: 'endo', fut: 'ir' },
};
const FUT_END = ['ò', 'ai', 'à', 'emo', 'ete', 'anno'];
const COND_END = ['ei', 'esti', 'ebbe', 'emmo', 'este', 'ebbero'];
const ISC_PRES = ['isco', 'isci', 'isce', 'iamo', 'ite', 'iscono'];
const ISC_SUBJ = ['isca', 'isca', 'isca', 'iamo', 'iate', 'iscano'];

// -ire verbs that do NOT take -isc- (used when metadata does not say)
const NON_ISC = new Set(['aprire', 'coprire', 'dormire', 'partire', 'sentire', 'servire', 'seguire', 'vestire', 'offrire', 'soffrire', 'fuggire', 'bollire', 'cucire', 'divertire', 'avvertire', 'convertire', 'invertire', 'pentire', 'mentire', 'assorbire', 'nutrire', 'applaudire', 'sfuggire', 'scoprire', 'riaprire', 'ricoprire', 'riempire', 'empire', 'venire', 'salire', 'uscire', 'morire', 'udire', 'inseguire', 'proseguire', 'conseguire', 'eseguire', 'perseguire', 'susseguire', 'investire', 'travestire', 'svestire', 'rivestire', 'sovvertire', 'pervertire', 'sovvenire', 'ripartire', 'spartire', 'compartire', 'consentire', 'dissentire', 'risentire', 'presentire', 'acconsentire', 'apparire', 'comparire', 'scomparire', 'trasparire', 'sparire', 'inghiottire', 'seppellire', 'assalire', 'risalire', 'muggire', 'sbollire', 'ribollire', 'sdrucire', 'scucire', 'ricucire', 'sortire', 'languire', 'ruggire', 'riconvertire', 'riavvertire', 'rioffrire', 'riservire', 'ridormire', 'addormire', 'sopraddormire', 'assentire', 'aborrire', 'sbollire', 'riassorbire', 'divergire']);
// -isc- exceptions inside NON_ISC family: sparire, inghiottire, seppellire, muggire, ruggire, languire, sortire, spartire, compartire take -isc-
const ISC_OVERRIDE = new Set(['sparire', 'inghiottire', 'seppellire', 'muggire', 'ruggire', 'languire', 'sortire', 'spartire', 'compartire', 'aborrire', 'divergire']);

const STRESSED_IARE = new Set(['sciare', 'inviare', 'spiare', 'avviare', 'rinviare', 'deviare', 'obliare', 'espiare', 'ovviare', 'fuorviare', 'sviare', 'traviare', 'striare', 'ammaliare', 'ravviare', 'riavviare', 'reinviare', 'disviare']);

const PREFIXES = ['ri', 'ra', 're', 's', 'dis', 'di', 'con', 'com', 'cor', 'col', 'co', 'a', 'ac', 'ad', 'af', 'ag', 'al', 'ap', 'ar', 'as', 'at', 'av', 'ab', 'am', 'an', 'in', 'im', 'il', 'ir', 'e', 'es', 'ex', 'de', 'pre', 'pro', 'per', 'tra', 'tras', 'trans', 'sotto', 'sopra', 'so', 'sur', 'su', 'sus', 'sub', 'inter', 'intra', 'intro', 'contra', 'contro', 'o', 'ob', 'oc', 'of', 'op', 'ot', 'retro', 'circon', 'circo', 'para', 'ben', 'bene', 'mal', 'male', 'sod', 'sof', 'sog', 'sop', 'sor', 'sos', 'sot', 'sov', 'stra', 'rin', 'ricon', 'pos', 'post', 'anti', 'estro', 'ultra', 'tele', 'auto', 'mano', 'man', 'rif', 'rap', 'rac', 'rag', 'ram', 'ras', 'rat', 'rav', 'scom', 'scon', 'sof', 'sub', 'sud', 'suf', 'sug', 'sup', 'soc', 'sog', 'sot', 'sov', 'fram', 'fra', 'frap', 'coin', 'contrap', 'contrav', 'contrad', 'contraf', 'sopraf', 'soprag', 'soprav', 'sopras', 'sovrap', 'presup', 'predis', 'indis', 'ricom', 'decom', 'giustap', 'equi', 'appar', 'intrat', 'trat', 'addi', 'capo', 'sottin', 'frain', 'condi', 'rias', 'compro', 'ripro', 'copro', 'discon', 'dif', 'ef', 'sup', 'sot', 'ante', 'mis', 'i', 'rim', 'se'];

// ---------- helpers ----------
const alts = (s) => String(s).split('|');
const pfx = (p, s) => alts(s).map(a => (a === MISSING ? a : p + a)).join('|');
const prefixArr = (p, arr) => arr.map(f => (f == null ? f : pfx(p, f)));

function join(stem, ending, cls, stressedI) {
  const first = ending[0];
  if (cls === 'are') {
    if (stressedI) {
      if (first === 'i') return (ending === 'i' || ending === 'ino') ? stem + ending : stem.slice(0, -1) + ending;
      return stem + ending;
    }
    if (/[cg]$/.test(stem) && (first === 'e' || first === 'i')) return stem + 'h' + ending;
    if (/(ci|gi)$/.test(stem) && (first === 'e' || first === 'i')) return stem.slice(0, -1) + ending;
    if (/i$/.test(stem) && first === 'i') return stem.slice(0, -1) + ending;
    // -gnare: the noi/voi forms in -iamo/-iate may be written with or without the i (sogniamo / sognamo)
    if (/gn$/.test(stem) && (ending === 'iamo' || ending === 'iate')) return stem + ending + '|' + stem + ending.slice(1);
    return stem + ending;
  }
  // stems ending in i (compi-, riempi-) absorb an i/ì-initial ending: compii, compì, compivo
  if (/i$/.test(stem) && (first === 'i' || first === 'ì')) return stem.slice(0, -1) + ending;
  return stem + ending;
}
function joinAlts(stem, ending, cls, stressedI) {
  return alts(ending).map(e => alts(stem).map(s => join(s, e, cls, stressedI)).join('|')).join('|');
}

// Split a pronominal/reflexive infinitive into base infinitive + clitic descriptor.
export function splitClitic(inf) {
  inf = inf.trim().toLowerCase();
  const m = inf.match(/^(.+?r)(sene|sela|cela|celo|sele|si|ci|la|ne|le|lo|li|vi|mi|ti)$/);
  if (!m) return { base: inf, clitic: null };
  const stemR = m[1];
  let base;
  if (/[ou]r$/.test(stemR)) base = stemR + 're';           // porsi -> porre, ridursi -> ridurre
  else if (/trar$/.test(stemR) && (stemR + 're' === 'trarre' || DERIVED[stemR + 're'])) base = stemR + 're'; // sottrarsi -> sottrarre
  else base = stemR + 'e';                                  // alzar -> alzare, accorger -> accorgere
  return { base, clitic: m[2] };
}

function classOf(inf) {
  if (/rre$/.test(inf)) return 'ere';
  const e = inf.slice(-3);
  return (e === 'are' || e === 'ere' || e === 'ire') ? e : 'are';
}

const PSEUDO = new Set(['durre', 'cludere', 'ludere', 'cidere', 'lidere', 'vadere', 'suadere', 'plodere', 'sumere', 'primere', 'nettere', 'pellere', 'solvere', 'mergere', 'tergere', 'fulgere', 'trudere']);
const isPseudo = (b) => PSEUDO.has(b);
// short / ambiguous bases that may only be derived through the explicit DERIVED map
const NO_GENERIC = new Set(['andare', 'avere', 'essere', 'stare', 'dare', 'fare', 'dire', 'udire', 'uscire', 'bere', 'solere', 'parere', 'dolere']);

function resolveBase(inf, depth = 0) {
  if (depth > 4) return null;
  if (IRREGULAR[inf]) return { prefix: '', base: inf, entry: IRREGULAR[inf] };
  if (inf in DERIVED) {
    const d = DERIVED[inf];
    if (!d) return { prefix: '', base: inf, entry: null, forced: true };
    const [p, b] = d;
    const r = resolveBase(b, depth + 1);
    if (r && r.entry) return { prefix: p + r.prefix, base: r.base, entry: r.entry };
    return null;
  }
  return null;
}

function resolve(inf) {
  const direct = resolveBase(inf);
  if (direct) return direct;
  if (FORCE_REGULAR.has(inf)) return { prefix: '', base: inf, entry: null };
  // generic prefix stripping, longest prefix first; the remainder must be a known base (possibly itself derived)
  const cands = PREFIXES.filter(p => inf.startsWith(p) && inf.length - p.length >= 5).sort((a, b) => b.length - a.length);
  for (const p of cands) {
    const rest = inf.slice(p.length);
    if (NO_GENERIC.has(rest)) continue;
    const r = resolveBase(rest);
    if (r && r.entry) return { prefix: p + r.prefix, base: r.base, entry: r.entry };
  }
  return { prefix: '', base: inf, entry: null };
}

function defaultIsc(inf) {
  return ISC_OVERRIDE.has(inf) ? true : !NON_ISC.has(inf);
}

function baseParadigm(inf, opts) {
  const e = opts.entry || {};
  const cls = e.cls || classOf(inf);
  const stressedI = STRESSED_IARE.has(inf);
  const stem = e.stem || (/rre$/.test(inf) ? inf.slice(0, -2) : inf.slice(0, -3));
  const E = END[cls];
  let isc = false;
  if (cls === 'ire') {
    if (typeof e.isc === 'boolean') isc = e.isc;
    else if (typeof opts.isc === 'boolean') isc = opts.isc;
    else isc = defaultIsc(inf);
  }
  const gen = (endings) => endings.map(en => joinAlts(stem, en, cls, stressedI));
  const defective = [];

  // Present
  let pres = e.pres ? e.pres.slice() : (isc ? ISC_PRES.map(en => join(stem, en, cls)) : gen(E.pres));
  // Imperfetto
  const imperf = e.imperf ? e.imperf.slice() : gen(E.imperf);
  // Passato remoto
  let pr;
  if (e.pr === null) { pr = Array(6).fill(MISSING); defective.push('passatoRemoto'); }
  else if (Array.isArray(e.pr)) pr = e.pr.slice();
  else {
    pr = gen(E.pr);
    if (typeof e.pr === 'string') {
      const strong = e.pr;
      pr[0] = alts(strong).map(s => s + 'i').join('|');
      pr[2] = alts(strong).map(s => s + 'e').join('|');
      pr[5] = alts(strong).map(s => s + 'ero').join('|');
    }
    if (cls === 'ere' && typeof e.pr === 'string') {
      // strong stem verbs: regular persons have no -etti alternatives
      pr[1] = alts(pr[1])[0]; pr[3] = alts(pr[3])[0]; pr[4] = alts(pr[4])[0];
    }
  }
  // Futuro / condizionale
  let fut, cond;
  if (e.fut === null) { fut = Array(6).fill(MISSING); cond = Array(6).fill(MISSING); defective.push('futuro', 'condizionale'); }
  else {
    let futStem;
    if (e.fut) futStem = e.fut;
    else if (/rre$/.test(inf)) futStem = inf.slice(0, -1); // porre -> porr
    else futStem = joinAlts(inf.slice(0, -3), E.fut, cls, stressedI);
    fut = FUT_END.map(en => alts(futStem).map(s => s + en).join('|'));
    cond = COND_END.map(en => alts(futStem).map(s => s + en).join('|'));
  }
  // Congiuntivo presente
  let subj;
  if (e.subj) subj = e.subj.slice();
  else if (e.pres) {
    const s1 = alts(pres[0])[0].replace(/o$/, '');
    const noi = alts(pres[3])[0];
    subj = [s1 + 'a', s1 + 'a', s1 + 'a', noi, noi.replace(/iamo$/, 'iate'), s1 + 'ano'];
  } else subj = isc ? ISC_SUBJ.map(en => join(stem, en, cls)) : gen(E.subj);
  // Congiuntivo imperfetto
  const subjImp = e.subjImp ? e.subjImp.slice() : gen(E.subjImp);
  // Imperativo
  let imp;
  if (e.imp === null) { imp = null; defective.push('imperativo'); }
  else if (e.imp) imp = e.imp.slice();
  else {
    const tu = cls === 'are' ? alts(pres[2])[0] : alts(pres[1])[0];
    imp = [tu, alts(subj[2])[0], alts(pres[3])[0], alts(pres[4])[0], alts(subj[5])[0]];
  }
  // Participio / gerundio
  let pp;
  if (e.pp === null) { pp = MISSING; defective.push('participioPassato'); }
  else if (e.pp) pp = e.pp;
  else if (cls === 'ere' && /c$/.test(stem)) pp = stem + 'iuto';
  else if (cls === 'ere' && /sist$/.test(stem)) pp = stem + 'ito';
  else pp = joinAlts(stem, E.pp, cls, stressedI);
  const ger = e.ger || joinAlts(stem, E.ger, cls, stressedI);
  const presPart = cls === 'are' ? stem + 'ante' : (isc ? stem + 'ente' : stem + 'ente');

  return { cls, isc, pres, imperf, pr, fut, cond, subj, subjImp, imp, pp, ger, presPart, irregular: !!opts.entry, defective };
}

function applyPrefix(p, par, base) {
  if (!p) return par;
  const out = { ...par };
  for (const k of ['pres', 'imperf', 'pr', 'fut', 'cond', 'subj', 'subjImp']) out[k] = prefixArr(p, par[k]);
  // compounds of fare / stare / dare / andare mark the stressed monosyllabic persons with an accent: rifà, sottostà, ridò, ridà, rivà
  const accented = base === 'fare' || base === 'stare' || base === 'dare' || base === 'andare';
  const acc3 = accented ? alts(par.pres[2])[0].replace(/[aà]$/, 'à') : null;
  if (accented) {
    const bare = alts(par.pres[2])[0];
    out.pres[2] = acc3 === bare ? p + bare : [p + acc3, p + bare].join('|');
    if (base === 'dare' || base === 'stare') { const b0 = alts(par.pres[0])[0]; out.pres[0] = [p + b0.slice(0, -1) + 'ò', p + b0].join('|'); }
  }
  if (par.imp) {
    out.imp = prefixArr(p, par.imp);
    // derived verbs use the full tu-form (contraddici, rifai) rather than the apostrophe form
    if (/'/.test(par.imp[0])) {
      const full = alts(par.pres[1])[0];
      // compounds of dire have no apostrophe form (contraddici, benedici); fare/stare/dare/andare keep it (rifa', rida', rivà)
      const extra = base === 'dire' ? [] : alts(par.imp[0]).map(a => p + a);
      const forms = [p + full, ...extra.filter(x => x !== p + full)];
      if (accented) forms.push(p + acc3);
      out.imp[0] = forms.join('|');
    }
  }
  out.pp = pfx(p, par.pp); out.ger = pfx(p, par.ger); out.presPart = pfx(p, par.presPart);
  return out;
}

const REFL = ['mi', 'ti', 'si', 'ci', 'vi', 'si'];
const REFL_NE = ['me ne', 'te ne', 'se ne', 'ce ne', 've ne', 'se ne'];
const REFL_LA = ['me la', 'te la', 'se la', 'ce la', 've la', 'se la'];
const REFL_LE = ['me le', 'te le', 'se le', 'ce le', 've le', 'se le'];
const REFL_LO = ['me lo', 'te lo', 'se lo', 'ce lo', 've lo', 'se lo'];

function cliticInfo(clitic) {
  switch (clitic) {
    case 'si': return { pron: REFL, attach: ['ti', 'si', 'ci', 'vi', 'si'], ger: 'si', aux: 'essere', agree: true, elide: false };
    case 'sene': return { pron: REFL_NE, attach: ['tene', 'sene', 'cene', 'vene', 'sene'], ger: 'sene', aux: 'essere', agree: true };
    case 'sela': return { pron: REFL_LA, attach: ['tela', 'sela', 'cela', 'vela', 'sela'], ger: 'sela', aux: 'essere', ppFixed: 'a' };
    case 'sele': return { pron: REFL_LE, attach: ['tele', 'sele', 'cele', 'vele', 'sele'], ger: 'sele', aux: 'essere', ppFixed: 'e' };
    case 'selo': return { pron: REFL_LO, attach: ['telo', 'selo', 'celo', 'velo', 'selo'], ger: 'selo', aux: 'essere', ppFixed: 'o' };
    case 'cela': return { pron: Array(6).fill('ce la'), attach: ['cela', 'cela', 'cela', 'cela', 'cela'], ger: 'cela', aux: 'avere', ppFixed: 'a', elideAvere: "ce l'" };
    case 'celo': return { pron: Array(6).fill('ce lo'), attach: ['celo', 'celo', 'celo', 'celo', 'celo'], ger: 'celo', aux: 'avere', ppFixed: 'o', elideAvere: "ce l'" };
    case 'ci': return { pron: Array(6).fill('ci'), attach: ['ci', 'ci', 'ci', 'ci', 'ci'], ger: 'ci', aux: null };
    case 'vi': return { pron: Array(6).fill('vi'), attach: ['vi', 'vi', 'vi', 'vi', 'vi'], ger: 'vi', aux: null };
    case 'la': return { pron: Array(6).fill('la'), attach: ['la', 'la', 'la', 'la', 'la'], ger: 'la', aux: 'avere', ppFixed: 'a', elideAvere: "l'" };
    case 'lo': return { pron: Array(6).fill('lo'), attach: ['lo', 'lo', 'lo', 'lo', 'lo'], ger: 'lo', aux: 'avere', ppFixed: 'o', elideAvere: "l'" };
    case 'le': return { pron: Array(6).fill('le'), attach: ['le', 'le', 'le', 'le', 'le'], ger: 'le', aux: 'avere', ppFixed: 'e' };
    case 'li': return { pron: Array(6).fill('li'), attach: ['li', 'li', 'li', 'li', 'li'], ger: 'li', aux: 'avere', ppFixed: 'i' };
    case 'ne': return { pron: Array(6).fill('ne'), attach: ['ne', 'ne', 'ne', 'ne', 'ne'], ger: 'ne', aux: null };
    default: return null;
  }
}

// Proclitic + finite form, with elision: "ce la ho" -> "ce l'ho", "me la aspetto" -> "me l'aspetto" (also accepted unelided),
// locative "ci è" -> "c'è", "ci entra" -> "c'entra" (also accepted unelided). Before a form of avere the elision is mandatory.
function pronForm(pron, form, clitic, strict, ciElide) {
  if (form === MISSING) return form;
  if (/l[ao]$/.test(pron)) {
    if (strict || /^h/.test(form)) return `${pron.slice(0, -2)}l'${form}`;
    if (/^[aeiouàèéìòù]/.test(form)) return `${pron.slice(0, -2)}l'${form}|${pron} ${form}`;
  }
  if (clitic === 'ci' && ciElide && /^[eè]/.test(form)) return `c'${form}|ci ${form}`;
  return pron + ' ' + form;
}

function attachClitic(form, cl) {
  // attach enclitic to an imperative / gerund form, handling apostrophe forms (va' + tene -> vattene).
  // When an apostrophe form exists it is the only one that takes an enclitic (vattene, fallo, dimmi — never "vaitene").
  const forms = alts(form);
  const apo = forms.filter(f => /'$/.test(f));
  return (apo.length ? apo : forms).map(f => {
    if (/'$/.test(f)) { const c = cl.startsWith('gli') ? cl : cl[0] + cl; return f.slice(0, -1) + c; }
    return f + cl;
  }).join('|');
}

const AUX_FORMS = {
  avere: { pres: ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'], imperf: ['avevo', 'avevi', 'aveva', 'avevamo', 'avevate', 'avevano'], pr: ['ebbi', 'avesti', 'ebbe', 'avemmo', 'aveste', 'ebbero'], fut: ['avrò', 'avrai', 'avrà', 'avremo', 'avrete', 'avranno'], cond: ['avrei', 'avresti', 'avrebbe', 'avremmo', 'avreste', 'avrebbero'], subj: ['abbia', 'abbia', 'abbia', 'abbiamo', 'abbiate', 'abbiano'], subjImp: ['avessi', 'avessi', 'avesse', 'avessimo', 'aveste', 'avessero'], inf: 'avere', ger: 'avendo' },
  essere: { pres: ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'], imperf: ['ero', 'eri', 'era', 'eravamo', 'eravate', 'erano'], pr: ['fui', 'fosti', 'fu', 'fummo', 'foste', 'furono'], fut: ['sarò', 'sarai', 'sarà', 'saremo', 'sarete', 'saranno'], cond: ['sarei', 'saresti', 'sarebbe', 'saremmo', 'sareste', 'sarebbero'], subj: ['sia', 'sia', 'sia', 'siamo', 'siate', 'siano'], subjImp: ['fossi', 'fossi', 'fosse', 'fossimo', 'foste', 'fossero'], inf: 'essere', ger: 'essendo' },
};

function agreePP(pp, i) {
  // participle with gender/number agreement for essere-auxiliary verbs: andato/a, andati/e
  return alts(pp).map(p => {
    if (!/o$/.test(p)) return p;
    return i < 3 ? p + '/a' : p.slice(0, -1) + 'i/e';
  }).join('|');
}
function fixedPP(pp, ending) {
  return alts(pp).map(p => (/o$/.test(p) ? p.slice(0, -1) + ending : p)).join('|');
}

export const TENSES = [
  { key: 'presente', mood: 'indicativo', name: 'Presente', en: 'Present', compound: false },
  { key: 'passatoProssimo', mood: 'indicativo', name: 'Passato prossimo', en: 'Present perfect', compound: true },
  { key: 'imperfetto', mood: 'indicativo', name: 'Imperfetto', en: 'Imperfect', compound: false },
  { key: 'trapassatoProssimo', mood: 'indicativo', name: 'Trapassato prossimo', en: 'Past perfect', compound: true },
  { key: 'passatoRemoto', mood: 'indicativo', name: 'Passato remoto', en: 'Historic past', compound: false },
  { key: 'trapassatoRemoto', mood: 'indicativo', name: 'Trapassato remoto', en: 'Historic past perfect', compound: true },
  { key: 'futuro', mood: 'indicativo', name: 'Futuro semplice', en: 'Future', compound: false },
  { key: 'futuroAnteriore', mood: 'indicativo', name: 'Futuro anteriore', en: 'Future perfect', compound: true },
  { key: 'condizionale', mood: 'condizionale', name: 'Condizionale presente', en: 'Conditional', compound: false },
  { key: 'condizionalePassato', mood: 'condizionale', name: 'Condizionale passato', en: 'Past conditional', compound: true },
  { key: 'congiuntivoPresente', mood: 'congiuntivo', name: 'Congiuntivo presente', en: 'Present subjunctive', compound: false },
  { key: 'congiuntivoPassato', mood: 'congiuntivo', name: 'Congiuntivo passato', en: 'Past subjunctive', compound: true },
  { key: 'congiuntivoImperfetto', mood: 'congiuntivo', name: 'Congiuntivo imperfetto', en: 'Imperfect subjunctive', compound: false },
  { key: 'congiuntivoTrapassato', mood: 'congiuntivo', name: 'Congiuntivo trapassato', en: 'Past perfect subjunctive', compound: true },
  { key: 'imperativo', mood: 'imperativo', name: 'Imperativo', en: 'Imperative', compound: false },
];
export const TENSE_BY_KEY = Object.fromEntries(TENSES.map(t => [t.key, t]));
export const SIMPLE_KEYS = ['presente', 'imperfetto', 'passatoRemoto', 'futuro', 'condizionale', 'congiuntivoPresente', 'congiuntivoImperfetto'];
export const COMPOUND_MAP = { passatoProssimo: 'pres', trapassatoProssimo: 'imperf', trapassatoRemoto: 'pr', futuroAnteriore: 'fut', condizionalePassato: 'cond', congiuntivoPassato: 'subj', congiuntivoTrapassato: 'subjImp' };

const cache = new Map();

// Build the paradigm. With `regular` set, IRREGULAR/DERIVED lookups are skipped and the verb is conjugated
// with the plain endings tables (spelling rules still apply) — the baseline used to explain irregularities.
function build(infinitive, meta = {}, regular = false) {
  const key = infinitive + '|' + (meta.aux || '') + '|' + (typeof meta.isc === 'boolean' ? meta.isc : '') + (regular ? '|R' : '');
  if (cache.has(key)) return cache.get(key);
  const inf = infinitive.trim().toLowerCase();
  const { base, clitic } = splitClitic(inf);
  const { prefix, base: root, entry } = regular ? { prefix: '', base, entry: null } : resolve(base);
  let par = baseParadigm(root, { entry, isc: meta.isc });
  par = applyPrefix(prefix, par, root);
  const cl = clitic ? cliticInfo(clitic) : null;

  let aux = meta.aux || (cl && cl.aux) || 'avere';
  if (cl && cl.aux) aux = cl.aux;
  if (aux === 'both') aux = 'avere';
  const auxKey = aux === 'essere' ? 'essere' : 'avere';
  const A = AUX_FORMS[auxKey];

  const t = {};
  const strictElision = root === 'avere';
  const ciElide = root === 'essere' || root === 'entrare'; // c'è, c'era, c'entra
  const withPron = (arr) => (cl ? arr.map((f, i) => alts(f).map(a => pronForm(cl.pron[i], a, clitic, strictElision, ciElide)).join('|')) : arr);
  t.presente = withPron(par.pres);
  t.imperfetto = withPron(par.imperf);
  t.passatoRemoto = withPron(par.pr);
  t.futuro = withPron(par.fut);
  t.condizionale = withPron(par.cond);
  t.congiuntivoPresente = withPron(par.subj);
  t.congiuntivoImperfetto = withPron(par.subjImp);

  // participle used in compounds (null when the verb has no participle)
  const noPP = par.pp === MISSING;
  const ppFor = (i) => {
    if (noPP) return null;
    if (cl && cl.ppFixed) return fixedPP(par.pp, cl.ppFixed);
    if (auxKey === 'essere') return agreePP(par.pp, i);
    return alts(par.pp)[0];
  };
  const auxWith = (forms, i) => {
    if (!cl) return forms[i];
    if (cl.elideAvere) return cl.elideAvere + forms[i];
    return pronForm(cl.pron[i], forms[i], clitic, false, auxKey === 'essere');
  };
  // auxiliary + participle, distributing alternatives on both sides ("se l'è cavata|se la è cavata", "è apparso/a|apparito/a")
  const compound = (auxForm, pp) => alts(auxForm).flatMap(a => alts(pp).map(p => a + ' ' + p)).join('|');
  for (const [tk, ak] of Object.entries(COMPOUND_MAP)) {
    t[tk] = PERSONS.map((_, i) => { const p = ppFor(i); return p == null ? MISSING : compound(auxWith(A[ak], i), p); });
  }
  // Imperative
  if (par.imp) {
    if (cl) {
      t.imperativo = [
        attachClitic(par.imp[0], cl.attach[0]),
        pronForm(cl.pron[2], alts(par.imp[1])[0], clitic, strictElision, ciElide),
        attachClitic(par.imp[2], cl.attach[2]),
        attachClitic(par.imp[3], cl.attach[3]),
        pronForm(cl.pron[5], alts(par.imp[4])[0], clitic, strictElision, ciElide),
      ];
    } else t.imperativo = par.imp.slice();
  } else t.imperativo = null;

  const nonFinite = {
    infinito: inf,
    infinitoPassato: '',
    participioPassato: par.pp,
    participioPresente: par.presPart,
    gerundio: cl ? attachClitic(par.ger, cl.ger) : par.ger,
    gerundioPassato: noPP ? MISSING : compound(auxKey === 'essere' ? 'essendo' : 'avendo', ppFor(0)),
  };
  // infinito passato
  if (noPP) nonFinite.infinitoPassato = MISSING;
  else if (cl) {
    if (cl.elideAvere) nonFinite.infinitoPassato = compound('aver' + cl.attach[1].replace(/^se/, ''), ppFor(0));
    else if (auxKey === 'essere') nonFinite.infinitoPassato = compound('esser' + cl.attach[1], ppFor(0));
    else nonFinite.infinitoPassato = compound('aver' + cl.attach[1], ppFor(0));
  } else nonFinite.infinitoPassato = compound(auxKey === 'essere' ? 'essere' : 'avere', ppFor(0));

  const result = {
    inf, base, root, prefix, clitic, cls: par.cls, isc: par.isc, aux, auxBoth: meta.aux === 'both',
    irregular: par.irregular, defective: par.defective, tenses: t, nonFinite,
    group: par.cls === 'are' ? '-are' : par.cls === 'ere' ? (/rre$/.test(base) ? '-rre' : '-ere') : (par.isc ? '-ire (-isc-)' : '-ire'),
  };
  cache.set(key, result);
  return result;
}

export function conjugate(infinitive, meta = {}) {
  return build(infinitive, meta, false);
}

// The paradigm the verb would have if it were regular: same endings tables and spelling rules, no IRREGULAR/DERIVED lookups.
export function regularParadigm(infinitive, meta = {}) {
  return build(infinitive, meta, true);
}

// Cells whose primary form differs from the regular paradigm: { presente: [0, 1, 2, 5], participioPassato: [0], ... }.
// Covers the simple tenses, the imperative and the non-finite participio passato / gerundio (compound tenses only
// differ through the participle, so they are not listed).
const CELL_KEYS = [...SIMPLE_KEYS, 'imperativo'];
export function irregularCells(infinitive, meta = {}) {
  const actual = conjugate(infinitive, meta);
  const reg = regularParadigm(infinitive, meta);
  const out = {};
  for (const k of CELL_KEYS) {
    const a = actual.tenses[k], r = reg.tenses[k];
    if (!a && !r) continue;
    if (!a || !r) { out[k] = (a || r).map((_, i) => i); continue; }
    const idx = a.map((f, i) => (primary(f) !== primary(r[i]) ? i : -1)).filter(i => i >= 0);
    if (idx.length) out[k] = idx;
  }
  for (const k of ['participioPassato', 'gerundio']) {
    if (primary(actual.nonFinite[k]) !== primary(reg.nonFinite[k])) out[k] = [0];
  }
  return out;
}

// Utility: primary display form (first alternative) and all accepted alternatives
export const primary = (f) => (f == null ? '' : alts(f)[0]);
export const accepted = (f) => (f == null ? [] : alts(f));

// Normalise for answer comparison: lower-case, trim, collapse spaces, ignore apostrophe spacing, strip "/a" agreement marks
export function normalizeAnswer(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s*'\s*/g, "'").replace(/’/g, "'");
}
export function isCorrectForm(answer, form) {
  const a = normalizeAnswer(answer);
  if (!a) return false;
  return accepted(form).some(f => {
    const n = normalizeAnswer(f);
    if (n === a) return true;
    // accept either agreement variant: "andato/a" -> andato | andata ; "andati/e" -> andati | andate
    const variants = n.replace(/(\w)o\/a\b/g, '$1o').split(' ').length ? [n.replace(/o\/a\b/g, 'o'), n.replace(/o\/a\b/g, 'a'), n.replace(/i\/e\b/g, 'i'), n.replace(/i\/e\b/g, 'e')] : [];
    return variants.includes(a);
  });
}

// Strip accents for loose comparison (used by games that tolerate missing accents)
export function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
