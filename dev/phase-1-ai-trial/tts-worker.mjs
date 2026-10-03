import { TtsSession } from '@mintplex-labs/piper-tts-web';
let session;
self.onmessage = async ({ data: { id, op, payload } }) => {
  try {
    const start = performance.now();
    if (op === 'load') {
      session = await TtsSession.create({ voiceId: 'it_IT-paola-medium', wasmPaths: { onnxWasm: new URL('./ort-tts/', self.location.href).href,
        piperWasm: new URL('./piper/piper_phonemize.wasm', self.location.href).href, piperData: new URL('./piper/piper_phonemize.data', self.location.href).href } });
      self.postMessage({ id, result: { loadMs: performance.now() - start, voice: 'it_IT-paola-medium', engine: 'Piper ONNX/eSpeak WASM' } }); return;
    }
    if (!session) throw Error('Load the explicitly provisioned Italian voice first.');
    const wav = await session.predict(payload.text);
    self.postMessage({ id, result: { wav: await wav.arrayBuffer(), ttsGenerationMs: performance.now() - start } });
  } catch (error) { self.postMessage({ id, error: String(error?.message || error) }); }
};
