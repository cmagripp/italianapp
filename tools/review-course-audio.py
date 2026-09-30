#!/usr/bin/env python3
"""Independent speech-recognition check of bundled synthetic practice audio.
This is an automated intelligibility check, not a human pronunciation rating.
Natural recordings keep their separately documented source/transcript review.
"""
import argparse,pathlib,json,re,unicodedata,hashlib
from faster_whisper import WhisperModel
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--model',default='base');p.add_argument('--download-root');p.add_argument('--recheck-failed',action='store_true');p.add_argument('--recheck-all',action='store_true');args=p.parse_args()
model=WhisperModel(args.model,device='cpu',compute_type='int8',download_root=args.download_root)
expected={};assessment_answers={}
for level in ['Foundations','A1','A2','B1','B2','C1','C2']:
 file=ROOT/f'data/course-v2/{level}.json'
 if file.exists():
  for unit in json.loads(file.read_text())['units']:
   for lesson in unit['lessons']:
    targets={t['id']:t for t in lesson['targets']}
    for step in lesson['steps']:
     if step.get('audioId') and step['kind']=='passage':expected[step['audioId']]=step['it']
     if step.get('audioId') and step['kind']=='question' and (step.get('modality')=='listening' or targets.get(step.get('target'),{}).get('modality')=='listening'):
      assessment_answers.setdefault(step['audioId'],[]).append(step.get('answer',''))
reportpath=ROOT/'data/course-v2/audio-review.json'
reports=json.loads(reportpath.read_text())['clips'] if reportpath.exists() else {}
manifestpath=ROOT/'data/course-v2/audio.json';manifest=json.loads(manifestpath.read_text())
def tokens(text):
 from num2words import num2words
 text=re.sub(r'\b\d+\b',lambda m:num2words(int(m[0]),lang='it'),text)
 text=unicodedata.normalize('NFKD',text.lower()).replace('’',"'")
 return re.findall(r'[a-z0-9]+',''.join(c for c in text if not unicodedata.combining(c)))
def distance(a,b):
 row=list(range(len(b)+1))
 for i,x in enumerate(a):
  nxt=[i+1]
  for j,y in enumerate(b):nxt.append(min(row[j+1]+1,nxt[j]+1,row[j]+(x!=y)))
  row=nxt
 return row[-1]
def critical_matches(asset,text,actual):
 source=' '+' '.join(tokens(text))+' ';heard=' '+' '.join(tokens(actual))+' '
 keys=[' '.join(tokens(answer)) for answer in assessment_answers.get(asset['id'],[]) if answer and ' '+' '.join(tokens(answer))+' ' in source]
 return keys,all(' '+key+' ' in heard for key in keys)
for asset in manifest['assets']:
 if asset['kind']!='synthetic':continue
 text=asset.get('spokenText') or expected.get(asset['id']);previous=reports.get(asset['id'])
 if not text:continue
 if previous and previous.get('sha256')==asset['sha256']:
  keys,keys_ok=critical_matches(asset,text,previous['transcript']);previous['criticalAnswers']=keys;previous['criticalAnswersPresent']=keys_ok
  previous['passed']=previous['wordErrorRate']<=.25 and previous['characterErrorRate']<=.10 and keys_ok
  if not args.recheck_all and (previous['passed'] or not args.recheck_failed):
   asset['reviewed']=previous['passed'];asset['reviewMethod']='Automated Whisper transcription comparison; synthetic practice voice.';continue
 segments,info=model.transcribe(str(ROOT/asset['src']),language='it',beam_size=5,vad_filter=False,condition_on_previous_text=False)
 actual=' '.join(s.text.strip() for s in segments);a,b=tokens(text),tokens(actual);wer=distance(a,b)/max(1,len(a));chars_a=list(''.join(a));chars_b=list(''.join(b));cer=distance(chars_a,chars_b)/max(1,len(chars_a))
 keys,keys_ok=critical_matches(asset,text,actual)
 record={'sha256':asset['sha256'],'expected':text,'transcript':actual,'wordErrorRate':round(wer,3),'characterErrorRate':round(cer,3),'criticalAnswers':keys,'criticalAnswersPresent':keys_ok,'passed':wer<=.25 and cer<=.10 and keys_ok,'method':f'faster-whisper 1.2.1 / {args.model} / Italian / beam5 / no prompt','seconds':round(info.duration,2)}
 reports[asset['id']]=record;asset['reviewed']=record['passed'];asset['reviewMethod']='Automated Whisper transcription comparison; synthetic practice voice.';asset['seconds']=record['seconds']
 print(('PASS' if record['passed'] else 'REVIEW'),asset['id'],round(wer,3),actual,flush=True)
 reportpath.write_text(json.dumps({'version':2,'clips':reports},ensure_ascii=False,indent=2)+'\n')
 manifestpath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
reportpath.write_text(json.dumps({'version':2,'clips':reports},ensure_ascii=False,indent=2)+'\n')
manifestpath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Audio comparison complete',flush=True)
