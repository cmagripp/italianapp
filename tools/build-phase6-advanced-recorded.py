#!/usr/bin/env python3
"""Cut only the explicitly catalogued advanced natural excerpts.
Requires soundfile/numpy plus afconvert (macOS) or ffmpeg. Original files are
user-supplied authoring inputs; use --original key=/absolute/source/path.
Verifies each contemporary original against its primary published SHA1/bytes.
Preserves every earlier catalogue and manifest record by stable ID.
"""
import argparse,hashlib,json,pathlib,shutil,subprocess,tempfile
import soundfile as sf
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--original',action='append',required=True);a=p.parse_args()
originals=dict(item.split('=',1) for item in a.original)
source=json.loads((ROOT/'data/course-v2/phase6-advanced-recorded-sources.json').read_text())
cache={};assets=[]
for r in source['passages']:
 key=r['key']
 if key not in cache:
  file=pathlib.Path(originals[key]);raw=file.read_bytes()
  if r.get('originalSha1') and hashlib.sha1(raw).hexdigest()!=r['originalSha1']:raise SystemExit(key+': original SHA1 does not match primary source')
  if r.get('originalBytes') and len(raw)!=r['originalBytes']:raise SystemExit(key+': original byte count differs')
  audio,rate=sf.read(file,always_2d=True);cache[key]=(audio,rate,hashlib.sha256(raw).hexdigest())
 audio,rate,originalhash=cache[key]
 if not 0<=r['start']<r['end']<=len(audio)/rate:raise SystemExit(r['id']+': invalid excerpt bounds')
 clip=audio[round(r['start']*rate):round(r['end']*rate)]
 digest=hashlib.sha256((originalhash+'|'+str(r['start'])+'|'+str(r['end'])+'|aac64').encode()).hexdigest()[:10]
 output=ROOT/f"audio/course-v2/{r['level']}/{r['id']}-recorded-{digest}.m4a";output.parent.mkdir(parents=True,exist_ok=True)
 if not output.exists():
  with tempfile.TemporaryDirectory(prefix='parola-natural-') as d:
   wav=pathlib.Path(d)/'excerpt.wav';sf.write(wav,clip,rate)
   if shutil.which('afconvert'):cmd=['afconvert','-f','m4af','-d','aac','-b','64000',str(wav),str(output)]
   elif shutil.which('ffmpeg'):cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','aac','-b:a','64k','-movflags','+faststart',str(output)]
   else:raise SystemExit('Need afconvert or ffmpeg to encode natural excerpts')
   subprocess.run(cmd,check=True,capture_output=True)
 asset={k:r[k] for k in ['id','lessonId','unitId','level','voice','source','originalAudio','license','licenseUrl','credit','title','date','changes','textSha256','rightsChecked','rightsEvidence']}
 if r.get('textLicense'):asset.update(textLicense=r['textLicense'],textLicenseUrl=r['textLicenseUrl'])
 if r.get('workYear'):asset['workYear']=r['workYear']
 asset.update(src=output.relative_to(ROOT).as_posix(),kind='recorded',reviewed=False,reviewMethod='Awaiting automated alignment and independent agent editorial review; human pronunciation/audio review pending.',sha256=hashlib.sha256(output.read_bytes()).hexdigest(),bytes=output.stat().st_size,seconds=round(len(clip)/rate,3),originalExcerptSeconds=[r['start'],r['end']],originalSha256=originalhash)
 assets.append(asset);print(r['id'],asset['bytes'],flush=True)
for name in ['recorded-audio.json','audio.json']:
 file=ROOT/'data/course-v2'/name;manifest=json.loads(file.read_text());old={a['id']:a for a in manifest['assets']}
 for asset in assets:
  before=old.get(asset['id'])
  if before and before.get('sha256')==asset['sha256']:
   for field in ['reviewed','reviewMethod','alignmentReview','editorialReview']:
    if field in before:asset[field]=before[field]
  old[asset['id']]=asset
 manifest['assets']=list(old.values());file.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Added '+str(len(assets))+' natural clips; older manifest entries preserved.',flush=True)
