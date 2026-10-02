#!/usr/bin/env python3
"""Build bundled, openly licensed synthetic Italian practice audio.
Authoring only: kokoro-onnx 0.6.1, misaki-fork 0.9.6, soundfile and afconvert (macOS) or ffmpeg.
Pass the Kokoro v1.0 model and voices files; no model is shipped to the browser.
Natural LibriVox excerpts are catalogued separately and retain their source.
"""
import argparse,hashlib,json,pathlib,shutil,subprocess,tempfile,re
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from misaki.espeak import EspeakG2P
ROOT=pathlib.Path(__file__).resolve().parents[1]
def encode_aac(wav,output):
 # 64 kb/s AAC-LC in an .m4a container: afconvert on macOS, ffmpeg elsewhere; moov stays ahead of mdat for byte-range playback.
 if shutil.which('afconvert'):subprocess.run(['afconvert','-f','m4af','-d','aac','-b','64000',str(wav),str(output)],check=True,capture_output=True)
 elif shutil.which('ffmpeg'):subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','aac','-b:a','64k','-movflags','+faststart',str(output)],check=True,capture_output=True)
 else:raise SystemExit('build-course-audio: need afconvert (macOS) or ffmpeg on PATH to encode AAC .m4a')
p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--voices',required=True);p.add_argument('--level',action='append');p.add_argument('--unit',action='append');args=p.parse_args()
voice=Kokoro(args.model,args.voices);g2p=EspeakG2P(language='it')
recorded_path=ROOT/'data/course-v2/recorded-audio.json';recorded=json.loads(recorded_path.read_text())['assets'] if recorded_path.exists() else [];recorded_ids={a['id'] for a in recorded}
manifest_path=ROOT/'data/course-v2/audio.json';old=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'assets':[]};old_by_id={a['id']:a for a in old['assets']};assets=[]
model_hash=hashlib.sha256(pathlib.Path(args.model).read_bytes()).hexdigest()
for level in ['Foundations','A1','A2','B1','B2','C1','C2']:
 pack_path=ROOT/f'data/course-v2/{level}.json'
 if not pack_path.exists():continue
 pack=json.loads(pack_path.read_text())
 for unit in pack['units']:
  for lesson in unit['lessons']:
   for step in lesson['steps']:
    if step['kind']!='passage' or step.get('mode')!='listen':continue
    text=step['it'];identifier=step['audioId']
    if identifier in recorded_ids:continue
    if (args.level and level not in args.level) or (args.unit and unit['id'] not in args.unit):
     if identifier in old_by_id:assets.append(old_by_id[identifier])
     continue
    speaker='if_sara' if int(hashlib.sha256(identifier.encode()).hexdigest()[0],16)%2 else 'im_nicola'
    speed=.92 if level in ['Foundations','A1'] else 1.0
    pronunciation_revision='biglietto-palatal-length-1' if re.search(r'bigliett[oi]',text,re.I) else ''
    digest=hashlib.sha256(('kokoro-v2|'+model_hash+'|'+speaker+'|'+str(speed)+'|'+text+pronunciation_revision).encode()).hexdigest()
    output=ROOT/f'audio/course-v2/{level}/{identifier}-{digest[:10]}.m4a';output.parent.mkdir(parents=True,exist_ok=True)
    # Speaker labels orient the transcript. Dialogues use alternating voices,
    # without reading labels aloud as if they were part of the conversation.
    parts=re.split(r'(?:^|\n|(?<=[.!?»]))\s*([A-ZÀ-Ù][\wÀ-ÿ ]{0,34}):\s*',text)
    dialogue=len(parts)>2 and not parts[0].strip();segments=[];speakers={}
    if dialogue:
     for i in range(1,len(parts)-1,2):
      name=parts[i].strip();speakers.setdefault(name,'if_sara' if len(speakers)%2==0 else 'im_nicola');segments.append((parts[i+1].strip(),speakers[name]))
    else:segments=[(text,speaker)]
    spoken=' '.join(t for t,_ in segments)
    if not output.exists():
     audio=[]
     for phrase,name in segments:
      # Break long input at sentence boundaries before phonemization, retaining
      # natural pauses and preventing the model's 510-token limit truncation.
      cleaned=re.sub(r'[«»“”\"]','',phrase)
      chunks=[]
      for sentence in re.split(r'(?<=[.!?])\s+|\n+',cleaned):
       if chunks and len(chunks[-1])+len(sentence)<350:chunks[-1]+=' '+sentence
       else:chunks.append(sentence)
      for chunk in chunks:
       if not chunk.strip():continue
       phonemes,_=g2p(chunk)
       # Preserve the held intervocalic palatal in biglietto/biglietti. The
       # default single-phoneme rendering was independently heard as "bisetto".
       if pronunciation_revision:phonemes=phonemes.replace('biʎˈetː','biʎʎˈetː')
       samples,rate=voice.create(phonemes,name,is_phonemes=True,speed=speed);audio.extend([samples,np.zeros(round(rate*.18),dtype=np.float32)])
     combined=np.concatenate(audio)
     with tempfile.TemporaryDirectory(prefix='parola-audio-') as temp:
      wav=pathlib.Path(temp)/'voice.wav';sf.write(wav,combined,rate);encode_aac(wav,output)
     seconds=round(len(combined)/rate,2)
    else:seconds=old_by_id.get(identifier,{}).get('seconds')
    bytehash=hashlib.sha256(output.read_bytes()).hexdigest();same=old_by_id.get(identifier,{}).get('sha256')==bytehash
    asset={'id':identifier,'lessonId':lesson['id'],'unitId':unit['id'],'level':level,'src':output.relative_to(ROOT).as_posix(),'kind':'synthetic','voice':'Sara and Nicola · synthetic Italian' if dialogue else ('Sara' if speaker=='if_sara' else 'Nicola')+' · synthetic Italian','reviewed':old_by_id.get(identifier,{}).get('reviewed',False) if same else False,'textSha256':hashlib.sha256(text.encode()).hexdigest(),'spokenText':spoken,'sha256':bytehash,'bytes':output.stat().st_size,'seconds':seconds,'modelSha256':model_hash,'source':'https://huggingface.co/hexgrad/Kokoro-82M','license':'Kokoro v1.0 model · Apache 2.0','licenseUrl':'https://www.apache.org/licenses/LICENSE-2.0'}
    if same and old_by_id[identifier].get('reviewMethod'):asset['reviewMethod']=old_by_id[identifier]['reviewMethod']
    if pronunciation_revision:asset['pronunciationRevision']=pronunciation_revision
    assets.append(asset);print(identifier,output.stat().st_size,flush=True)
assets.extend(recorded)
manifest_path.write_text(json.dumps({'version':2,'assets':assets},ensure_ascii=False,indent=2)+'\n')
print(f'{len(assets)} clips catalogued',flush=True)
