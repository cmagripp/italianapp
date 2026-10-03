// Actual browser microphone/AudioWorklet transport; synthetic microphone input
// and explicitly injected test-only speech adapters. No recognition quality claim.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {loadPlaywright,ensureServer,BASE} from '../../tests/lib.mjs';
const rate=48000,length=rate*6,buffer=Buffer.alloc(44+length*2);buffer.write('RIFF');buffer.writeUInt32LE(36+length*2,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length*2,40);
for(let n=0;n<length;n++){const phase=n/rate%3,value=phase>.4&&phase<1.6?.25*Math.sin(2*Math.PI*440*n/rate):0;buffer.writeInt16LE(Math.round(value*32767),44+n*2);}
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'parola-speech-capture-')),wav=path.join(directory,'synthetic-microphone.wav');fs.writeFileSync(wav,buffer);
const {chromium}=await loadPlaywright(),stop=await ensureServer(),browser=await chromium.launch({executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+wav,'--autoplay-policy=no-user-gesture-required']}),context=await browser.newContext({permissions:['microphone'],serviceWorkers:'block'}),page=await context.newPage(),checks=[];
try{
 await page.goto(BASE);
 const manual=await page.evaluate(async()=>{
  const {createBrowserPCMCapture}=await import('./js/ai/pcm-capture.js'),capture=createBrowserPCMCapture();window.speechCapture=capture;
  await capture.start();await new Promise(resolve=>setTimeout(resolve,2200));const audio=await capture.finish();window.testAudio=audio;
  const view=new DataView(await audio.blob.arrayBuffer());return{sampleRate:audio.sampleRate,captureSampleRate:audio.captureSampleRate,frames:audio.samples.length,duration:audio.duration,bytes:audio.blob.size,riff:String.fromCharCode(...new Uint8Array(view.buffer,0,4)),nonzero:audio.samples.some(value=>Math.abs(value)>.001),recording:capture.recording};
 });assert.equal(manual.sampleRate,16000);assert.ok(manual.frames>16000);assert.ok(manual.duration>1);assert.equal(manual.riff,'RIFF');assert.ok(manual.nonzero);assert.equal(manual.recording,false);checks.push({name:'actual getUserMedia/AudioWorklet capture, 16k PCM, native-rate WAV and track stop',...manual});
 const segment=await page.evaluate(async()=>{
  const {createBrowserPCMCapture}=await import('./js/ai/pcm-capture.js'),capture=createBrowserPCMCapture({maxDuration:12,maxUtterance:8});
  // Deliberately test-only energy classifier validates transport/state wiring;
  // it is not a production VAD and makes no human voice detection claim.
  const vad={createSession:()=>({process:chunk=>Math.sqrt(chunk.reduce((n,value)=>n+value*value,0)/chunk.length)>.015?.95:.05})};
  let audio;await new Promise(async(resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No synthetic utterance')),10000);try{await capture.start({mode:'handsfree',vad,onUtterance:value=>{audio=value;clearTimeout(timer);resolve();},onError:reject,onLimit:()=>reject(new Error('Capture limit'))});}catch(error){clearTimeout(timer);reject(error);}});await capture.stop();return{duration:audio.duration,frames:audio.samples.length,bytes:audio.blob.size,recording:capture.recording};
 });assert.ok(segment.duration>.7&&segment.duration<4);assert.ok(segment.frames>5000);assert.equal(segment.recording,false);checks.push({name:'actual PCM segmentation with explicit synthetic test detector',...segment});
 const session=await page.evaluate(async()=>{
  const {createConversationSpeechSession}=await import('./js/conversations/speech-session.js');let saves=0,sends=0,voices=0,recognizerPCM=false,source=null;
  const controller={state:{draft:null,turns:[]},async saveDraft(text,extras){this.state.draft={typedText:text,...extras};source=this.state.draft;},async send(){sends++;this.state.draft=null;return{committed:true,turnId:'browser-learner',reply:{role:'partner',turnId:'browser-partner',displayText:'Ciao.'},error:null};},reply:async()=>false};
  const speech={readiness:()=>({recognition:true,voice:true,vad:false}),recognizer:{transcribe:async audio=>{recognizerPCM=audio.samples instanceof Float32Array&&audio.samples.length>1000;return{recognizedText:'due biglietti',uncertain:true};}},voice:{speak:async()=>{voices++;},stop(){}}};
  const session=createConversationSpeechSession({controller,repository:{saveRecording:async()=>{saves++;return{audioId:'explicit'};}},threadId:'synthetic-browser',speech});
  await session.startManual();await new Promise(resolve=>setTimeout(resolve,900));await session.stopRecording();const afterStop={state:session.snapshot.state,saves,sends};await session.edit('Due biglietti, grazie.');await session.replay();await session.send();const afterSend={saves,sends,voices,canSave:session.snapshot.canSaveRecording};await session.saveRecording({consentAt:Date.now()});await session.dispose();return{afterStop,afterSend,saves,recognizerPCM,source,retainedAfterDispose:session.snapshot.hasTemporaryAudio};
 });assert.equal(session.afterStop.state,'review');assert.equal(session.afterStop.sends,0);assert.equal(session.afterStop.saves,0);assert.equal(session.afterSend.sends,1);assert.equal(session.afterSend.saves,0);assert.equal(session.afterSend.voices,1);assert.equal(session.saves,1);assert.equal(session.source.recognizedText,'due biglietti');assert.equal(session.source.inputProvenance.transcriptEdits[0].after,'Due biglietti, grazie.');assert.equal(session.recognizerPCM,true);assert.equal(session.retainedAfterDispose,false);checks.push({name:'actual capture and temporary local replay; test-only ASR/voice and durable-send fixtures; explicit save only',...session});
 fs.writeFileSync('docs/implementation/programme/ai-speech-browser-audit.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'headed-capable Chrome on macOS, headless transport test with synthetic microphone WAV',qualityScope:'No real human microphone, Italian ASR, TTS pronunciation or physical iPhone claim; no production adapters installed',checks},null,2));console.log(JSON.stringify(checks,null,2));
}finally{await context.close();await browser.close();stop();fs.rmSync(directory,{recursive:true,force:true});}
