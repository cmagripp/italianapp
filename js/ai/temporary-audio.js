/** Temporary local playback with explicit object URL disposal. It never uses
 * speech synthesis or saves the captured recording. */
export function createTemporaryAudioPlayer({environment=globalThis}={}) {
  let audio=null,url=null,rejectPlayback=null,cleanupPlayback=null;
  function stop(){const reject=rejectPlayback;rejectPlayback=null;cleanupPlayback?.();cleanupPlayback=null;if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}if(url){environment.URL.revokeObjectURL(url);url=null;}reject?.(new DOMException('Playback stopped.','AbortError'));}
  return {
    async play(blob,{signal}={}){
      stop();if(!(blob instanceof Blob)||!blob.size)throw new TypeError('No temporary recording to play.');if(signal?.aborted)throw new DOMException('Playback stopped.','AbortError');
      const element=new environment.Audio();audio=element;url=environment.URL.createObjectURL(blob);element.src=url;
      try{await new Promise((resolve,reject)=>{rejectPlayback=reject;const done=()=>{signal?.removeEventListener('abort',onAbort);element.onended=null;element.onerror=null;if(rejectPlayback===reject)rejectPlayback=null;cleanupPlayback=null;};const onAbort=()=>{done();stop();reject(new DOMException('Playback stopped.','AbortError'));};cleanupPlayback=done;element.onended=()=>{done();resolve();};element.onerror=()=>{done();reject(new Error('This device could not replay the recording.'));};signal?.addEventListener('abort',onAbort,{once:true});Promise.resolve(element.play()).catch(error=>{done();reject(error);});});}
      finally{if(audio===element)stop();}
    },stop,
  };
}
