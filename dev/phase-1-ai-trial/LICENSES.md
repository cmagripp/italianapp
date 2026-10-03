# Trial dependency and model terms

Versions and package integrity are pinned by `package-lock.json`; immutable model/export and model-library revisions are in `pins.json`. The prepared manifest records every exact file hash. This is a local engineering trial, not a redistributed production pack.

| Component | Exact trial version | Terms/source |
| --- | --- | --- |
| WebLLM | 0.2.85 | [Apache 2.0](https://github.com/mlc-ai/web-llm/blob/v0.2.85/LICENSE). Upstream npm `lib/index.js` includes WebRuntime/tokenizer/grammar code; the minified bundle has no retained legal-comment block. Separate license, TVM notice and tslib ISC attribution are retained in `vendor/webllm/`. |
| loglevel | 1.9.2 | [MIT](https://github.com/pimterry/loglevel/blob/v1.9.2/LICENSE). |
| Embedded tslib helpers | Nested version not identified in upstream source map | Microsoft ISC permission/copyright/disclaimer copied verbatim from the pinned source map to `vendor/webllm/tslib-ISC.txt`; helpers also appear inside the embedded WebRuntime/tokenizer sources. |
| Transformers.js | 4.3.0 | [Apache 2.0](https://github.com/huggingface/transformers.js/blob/4.3.0/LICENSE). |
| ONNX Runtime Web for ASR | 1.31.0-dev.20260914-8d85527a0 | [MIT](https://github.com/microsoft/onnxruntime/blob/main/LICENSE); exact JS/WASM paired from the Transformers dependency. |
| ONNX Runtime Web for VAD/TTS | 1.30.0 | Same upstream MIT terms; separate matched WASM/JS directories. |
| VAD wrapper | @ricky0123/vad-web 0.0.31 | [ISC](https://github.com/ricky0123/vad/blob/master/LICENSE). Bundled Silero model has [MIT upstream terms](https://github.com/snakers4/silero-vad/blob/master/LICENSE). |
| Piper browser wrapper | @mintplex-labs/piper-tts-web 1.0.5 | [MIT wrapper](https://github.com/Mintplex-Labs/piper-tts-web). Trial build rewrites model host to the local pack and forces one WASM thread. |
| Piper phonemizer WASM/data | @diffusionstudio/piper-wasm 1.0.0 | [Build source](https://github.com/diffusionstudio/piper-wasm), [Piper phonemize](https://github.com/rhasspy/piper-phonemize), and embedded [eSpeak NG GPL 3.0](https://github.com/espeak-ng/espeak-ng/blob/master/COPYING). The wrapper's MIT label does not relicense embedded phonemizer/data; preserve source and notices when packaging for redistribution. |
| Qwen3 0.6B / 1.7B | MLC q4f16 exports pinned in `pins.json` | [Qwen3 model terms](https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/LICENSE), Apache 2.0. MLC conversion is not a separate permission to discard model notices. |
| Qwen3.5 0.8B / optional 2B | MLC q4f16 exports pinned in `pins.json` | [Qwen3.5 model terms](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE), Apache 2.0. |
| Gemma 3 1B IT | MLC q4f16 export pinned in `pins.json` | [Gemma Terms of Use](https://ai.google.dev/gemma/terms), including the redistribution agreement, use restrictions and Notice requirements. These are not Apache/MIT terms. |
| Whisper tiny | Multilingual ONNX export pinned in `pins.json` | [Whisper MIT](https://github.com/openai/whisper/blob/main/LICENSE); preserve ONNX exporter metadata and original model attribution. |
| Italian Paola medium | `rhasspy/piper-voices` revision in `pins.json` | [Voice card](https://huggingface.co/rhasspy/piper-voices/blob/main/it/it_IT/paola/medium/MODEL_CARD) specifies Italian, 22,050 Hz and the dataset. [Dataset CC0](https://huggingface.co/datasets/paolapersico1/Voice-Dataset-Italian); repository model MIT terms and voice-specific card remain part of any pack. |

The production pack needs its own complete notice/source bundle and distribution review, particularly Gemma and the compiled eSpeak stack. Phase 1 does not authorize silently calling the whole combined stack “MIT” or bundling it into the production app.
