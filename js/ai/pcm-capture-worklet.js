// Same-origin microphone capture only. No recognizer, network call or recording
// persistence runs in this worklet. Transfer bounded mono PCM batches to its host.
class ParolaPCMCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Float32Array(2048); this.used = 0; this.closed = false; this.port.onmessage = event => { if (event.data?.type === 'flush') { this.flush(); this.port.postMessage({type:'flushed',id:event.data.id}); } if (event.data?.type === 'close') this.closed = true; }; }
  flush() { if (!this.used) return; const samples = this.buffer.slice(0,this.used); this.port.postMessage({type:'pcm',samples},[samples.buffer]); this.used = 0; }
  process(inputs) {
    if (this.closed) return false;
    const channels = inputs[0]; if (!channels?.length) return true;
    for (let frame = 0; frame < channels[0].length; frame++) { let value = 0; for (const channel of channels) value += channel[frame] || 0; this.buffer[this.used++] = value / channels.length; if (this.used === this.buffer.length) this.flush(); }
    return true;
  }
}
registerProcessor('parola-pcm-capture',ParolaPCMCapture);
