#!/usr/bin/env python3
"""Automated alignment gate for the authored natural excerpt catalogue.
Does not infer a human pronunciation rating, proficiency or native review.
Compares a new no-prompt ASR pass to the authored transcript and critical phrases.
"""
import argparse,hashlib,json,pathlib,re,unicodedata
from faster_whisper import WhisperModel
from num2words import num2words
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--model',default='small');a=p.parse_args()
def tokens(s):
 s=re.sub(r'\b\d+\b',lambda m:num2words(int(m[0]),lang='it'),s)
 s=unicodedata.normalize('NFKD',s.lower()).replace('’',"'")
 return re.findall('[a-z0-9]+',''.join(c for c in s if not unicodedata.combining(c)))
def distance(x,y):
 row=list(range(len(y)+1))
 for i,item in enumerate(x):
  nxt=[i+1]
  for j,other in enumerate(y):nxt.append(min(row[j+1]+1,nxt[j]+1,row[j]+(item!=other)))
  row=nxt
 return row[-1]
model=WhisperModel(a.model,device='cpu',compute_type='int8')
sources=json.loads((ROOT/'data/course-v2/phase6-advanced-recorded-sources.json').read_text())['passages']
manifest=json.loads((ROOT/'data/course-v2/audio.json').read_text());assets={r['id']:r for r in manifest['assets']}
path=ROOT/'data/course-v2/phase6-advanced-recorded-review.json';old=json.loads(path.read_text())['clips'] if path.exists() else {};reports={}
for source in sources:
 asset=assets[source['id']];previous=old.get(source['id']);hash=hashlib.sha256((ROOT/asset['src']).read_bytes()).hexdigest()
 if hash!=asset['sha256']:raise SystemExit(source['id']+': asset hash mismatch')
 if previous and previous['sha256']==hash and previous['textSha256']==source['textSha256']:report=previous
 else:
  segments,info=model.transcribe(str(ROOT/asset['src']),language='it',beam_size=5,vad_filter=False,condition_on_previous_text=False)
  actual=' '.join(s.text.strip() for s in segments);x,y=tokens(source['it']),tokens(actual);wer=distance(x,y)/max(1,len(x));cx,cy=list(''.join(x)),list(''.join(y));cer=distance(cx,cy)/max(1,len(cx));heard=' '+' '.join(y)+' ';critical=all(' '+' '.join(tokens(s))+' ' in heard for s in source['criticalPhrases'])
  report={'sha256':hash,'textSha256':source['textSha256'],'expected':source['it'],'transcript':actual,'wordErrorRate':round(wer,3),'characterErrorRate':round(cer,3),'criticalPhrases':source['criticalPhrases'],'criticalPhrasesPresent':critical,'passed':wer<=.25 and cer<=.10 and critical,'method':'faster-whisper '+a.model+' / Italian / beam5 / no prompt','humanAudioReview':'pending'}
 # Re-evaluate the current explicit assessed-meaning cue on a cached ASR pass.
 # The acoustic transcript and WER/CER remain unchanged; no threshold is relaxed.
 heard=' '+' '.join(tokens(report['transcript']))+' '
 report['criticalPhrases']=source['criticalPhrases'];report['criticalPhrasesPresent']=all(' '+' '.join(tokens(s))+' ' in heard for s in source['criticalPhrases'])
 report['passed']=report['wordErrorRate']<=.25 and report['characterErrorRate']<=.10 and report['criticalPhrasesPresent']
 reports[source['id']]=report;asset['alignmentReview']='automated-pass' if report['passed'] else 'needs-editorial-check'
 # A passed alignment alone never becomes a claimed independent language review.
 asset['reviewed']=report['passed'] and asset.get('editorialReview')=='independent-agent-pass'
 asset['reviewMethod']='Automated no-prompt transcript/critical-phrase alignment; independent agent editorial gate '+asset.get('editorialReview','pending')+'; native/human audio review pending.'
 print(('PASS' if report['passed'] else 'REVIEW'),source['id'],report['wordErrorRate'],report['characterErrorRate'],report['criticalPhrasesPresent'],flush=True)
 path.write_text(json.dumps({'version':1,'clips':reports},ensure_ascii=False,indent=2)+'\n')
for name in ['audio.json','recorded-audio.json']:
 file=ROOT/'data/course-v2'/name;m=json.loads(file.read_text());m['assets']=[assets.get(r['id'],r) for r in m['assets']];file.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
