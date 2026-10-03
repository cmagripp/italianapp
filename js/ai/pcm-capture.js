const aborted = () => new DOMException('Recording cancelled.','AbortError');

export function resamplePCM(samples,sourceRate,targetRate=16000) {
  if (!(samples instanceof Float32Array) || !Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(targetRate) || targetRate <= 0) throw new TypeError('Invalid microphone PCM');
  if (sourceRate === targetRate) return samples.slice();
  const output = new Float32Array(Math.floor(samples.length * targetRate / sourceRate));
  for (let i=0;i<output.length;i++) { const position=i*sourceRate/targetRate,index=Math.floor(position),part=position-index; output[i]=(samples[index]||0)*(1-part)+(samples[Math.min(index+1,samples.length-1)]||0)*part; }
  return output;
}
export function encodePCM16Wav(samples,sampleRate) {
  if (!(samples instanceof Float32Array) || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new TypeError('Invalid recording');
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer),write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const value=Math.max(-1,Math.min(1,Number.isFinite(samples[i])?samples[i]:0));view.setInt16(44+i*2,value<0?Math.round(value*32768):Math.round(value*32767),true);}
  return new Blob([buffer],{type:'audio/wav'});
}
const join = chunks => { const result=new Float32Array(chunks.reduce((n,chunk)=>n+chunk.length,0));let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result; };

/** Actual browser microphone transport. Recognition/voice/VAD are installed
 * provider adapters. A local VAD session yields probabilities on native-rate PCM;
 * energy is exposed only as a level meter, never asserted to detect speech. */
export function createBrowserPCMCapture({environment=globalThis,workletURL=new URL('./pcm-capture-worklet.js',import.meta.url),targetRate=16000,maxDuration=60,maxUtterance=30,silenceMs=650,minSpeechMs=250,preRollMs=200,onLevel=()=>{}}={}) {
  if (maxDuration <= 0 || maxDuration > 120 || maxUtterance <= 0 || maxUtterance > maxDuration) throw new TypeError('Invalid recording bounds');
  let epoch=0,run=null;
  const supported=()=>!!(environment.isSecureContext && environment.navigator?.mediaDevices?.getUserMedia && (environment.AudioContext||environment.webkitAudioContext) && environment.AudioWorkletNode);
  const makeAudio=(chunks,rate)=>{const original=join(chunks);return{samples:resamplePCM(original,rate,targetRate),sampleRate:targetRate,captureSampleRate:rate,duration:original.length/rate,blob:encodePCM16Wav(original,rate)};};
  async function cleanup(session) { if(!session)return;session.closed=true;session.signal?.removeEventListener('abort',session.onAbort);session.node?.port.postMessage({type:'close'});session.node?.disconnect();session.source?.disconnect();session.silent?.disconnect();session.stream?.getTracks().forEach(track=>track.stop());await Promise.allSettled([session.context?.close(),session.detector?.dispose?.()]); }
  async function stop() {epoch++;const old=run;run=null;await cleanup(old);}
  function fail(session,error) {if(run!==session||session.closed)return;stop().then(()=>session.onError?.(error));}
  function process(session,samples) {
    if(run!==session||session.closed)return;
    const available=Math.max(0,Math.floor(maxDuration*session.rate)-session.frames),chunk=samples.slice(0,available);if(!chunk.length)return;
    session.frames+=chunk.length;session.chunks.push(chunk);
    let energy=0;for(const value of chunk)energy+=value*value;try{onLevel(Math.sqrt(energy/chunk.length));}catch{}
    if(session.mode==='handsfree'){
      if(++session.backlog>8){fail(session,new Error('The voice detector could not keep up.'));return;}
      session.vadQueue=session.vadQueue.then(async()=>{
        if(run!==session||session.closed)return;
        const result=await session.detector.process(chunk,{sampleRate:session.rate,signal:session.signal});if(run!==session||session.closed)return;
        const probability=typeof result==='number'?result:result?.probability;
        if(!Number.isFinite(probability)||probability<0||probability>1)throw new TypeError('The local voice detector returned an invalid result.');
        const ms=chunk.length/session.rate*1000;
        if(!session.started){session.pre.push(chunk);session.preFrames+=chunk.length;while(session.pre.length>1&&session.preFrames-session.pre[0].length>preRollMs/1000*session.rate)session.preFrames-=session.pre.shift().length;if(probability>=0.6){session.started=true;session.segment=session.pre;session.pre=[];session.voiceMs=ms;session.quietMs=0;}}
        else {session.segment.push(chunk);if(probability>=0.6){session.voiceMs+=ms;session.quietMs=0;}else if(probability<=0.3)session.quietMs+=ms;}
        if(session.started&&(session.quietMs>=silenceMs||session.segment.reduce((n,c)=>n+c.length,0)>=maxUtterance*session.rate)){
          const segment=session.segment,hasSpeech=session.voiceMs>=minSpeechMs;session.started=false;session.segment=[];session.pre=[];session.preFrames=0;session.voiceMs=0;session.quietMs=0;
          if(hasSpeech&&!session.delivered){session.delivered=true;session.onUtterance?.(makeAudio(segment,session.rate));}
        }
      }).catch(error=>fail(session,error)).finally(()=>{session.backlog--;});
    }
    if(session.frames>=Math.floor(maxDuration*session.rate)&&!session.limit){session.limit=true;session.onLimit?.();}
  }
  return {
    supported,
    get recording(){return !!run&&!run.closed;},
    async start({mode='manual',signal,vad,onUtterance,onError,onLimit}={}) {
      const token=++epoch,previous=run;run=null;await cleanup(previous);if(token!==epoch||signal?.aborted)throw aborted();if(!supported())throw new Error('Microphone PCM capture is unavailable on this device.');
      if(!['manual','handsfree'].includes(mode)||mode==='handsfree'&&typeof vad?.createSession!=='function')throw new TypeError('Handsfree speech requires an installed local voice detector.');
      const url=new URL(workletURL,environment.location?.href);if(environment.location&&url.origin!==environment.location.origin)throw new TypeError('Microphone worklet code must be served by this app.');
      const session={mode,signal,onUtterance,onError,onLimit,chunks:[],frames:0,pre:[],preFrames:0,segment:[],started:false,quietMs:0,voiceMs:0,vadQueue:Promise.resolve(),backlog:0,closed:false};
      session.onAbort=()=>{if(run===session)stop();};
      try {
        // Permission may resolve after cancellation. Check ownership before
        // connecting the microphone, and stop every acquired track on failure.
        session.stream=await environment.navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});
        if(token!==epoch||signal?.aborted)throw aborted();run=session;signal?.addEventListener('abort',session.onAbort,{once:true});
        const Context=environment.AudioContext||environment.webkitAudioContext;session.context=new Context();session.rate=session.context.sampleRate;
        if(mode==='handsfree'){session.detector=await vad.createSession({sampleRate:session.rate,signal});if(typeof session.detector?.process!=='function')throw new TypeError('The local voice detector could not start.');}
        await session.context.audioWorklet.addModule(url.href);if(token!==epoch||signal?.aborted)throw aborted();
        session.node=new environment.AudioWorkletNode(session.context,'parola-pcm-capture');session.node.port.onmessage=event=>{if(event.data?.type==='pcm')process(session,event.data.samples);if(event.data?.type==='flushed')session.flushed?.(event.data.id);};session.node.onprocessorerror=()=>fail(session,new Error('Microphone capture was interrupted.'));
        session.source=session.context.createMediaStreamSource(session.stream);session.silent=session.context.createGain();session.silent.gain.value=0;session.source.connect(session.node);session.node.connect(session.silent);session.silent.connect(session.context.destination);
        for(const track of session.stream.getTracks())track.addEventListener('ended',()=>{if(!session.closed)fail(session,new Error('The microphone stopped.'));},{once:true});
        await session.context.resume();if(token!==epoch||signal?.aborted)throw aborted();
      } catch(error) {if(run===session)run=null;await cleanup(session);throw error;}
    },
    async finish() {
      const session=run;if(!session||session.closed)throw new Error('No recording is active.');
      await new Promise(resolve=>{const id=session.flushId=(session.flushId||0)+1,timer=setTimeout(resolve,500);session.flushed=value=>{if(value===id){clearTimeout(timer);resolve();}};session.node.port.postMessage({type:'flush',id});});
      if(run!==session||session.closed)throw aborted();const audio=makeAudio(session.chunks,session.rate);await stop();return audio;
    },
    stop,
  };
}
