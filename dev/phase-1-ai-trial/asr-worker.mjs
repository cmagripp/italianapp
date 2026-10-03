import { WhisperForConditionalGeneration, AutoTokenizer, AutoProcessor, AutomaticSpeechRecognitionPipeline, env } from '@huggingface/transformers';
env.allowRemoteModels = false;
env.allowLocalModels = true;
// Relative paths are treated as local by the 4.3 metadata registry; an absolute
// same-origin HTTP path is incorrectly classified as remote when remote models are disabled.
env.localModelPath = './models/asr/';
env.useBrowserCache = false; // the trial service worker owns explicitly installed, verified files
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = new URL('./ort-asr/', self.location.href).href;
let transcriber;
self.onmessage = async ({ data: { id, op, payload } }) => {
  try {
    const start = performance.now();
    if (op === 'load') {
      // The general pipeline factory derives components from a remote file inventory.
      // Load the known local Whisper components explicitly so processor readiness cannot be skipped.
      const options = { device: 'wasm', dtype: 'q8', local_files_only: true };
      const [model, tokenizer, processor] = await Promise.all([WhisperForConditionalGeneration.from_pretrained('whisper-tiny', options), AutoTokenizer.from_pretrained('whisper-tiny', options), AutoProcessor.from_pretrained('whisper-tiny', options)]);
      transcriber = new AutomaticSpeechRecognitionPipeline({ task: 'automatic-speech-recognition', model, tokenizer, processor });
      self.postMessage({ id, result: { loadMs: performance.now() - start } }); return;
    }
    if (!transcriber) throw Error('Load local Italian recognition first.');
    const result = await transcriber(payload.audio, { language: 'italian', task: 'transcribe', return_timestamps: false, max_new_tokens: 128 });
    self.postMessage({ id, result: { recognizedText: String(result.text || '').trim(), asrMs: performance.now() - start } });
  } catch (error) { self.postMessage({ id, error: String(error?.message || error) }); }
};
