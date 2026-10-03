# Retired fit-scoring experiment

The application no longer calls the BERTino fit scorer. Its two modules, model files and ONNX Runtime files are excluded from the published site by exact path. The original source paths remain in Git so the investigation, model hashes, tokenizer proof and redistribution notices stay reproducible without duplicating the large files. `manifest.json` records every preserved file and the 84,013,164 bytes formerly published.

The original notices and model provenance remain in `models/fit-scorer/README.md`; the ONNX Runtime bundle retains its license header. `tools/test-fit-scorer.mjs` remains an optional historical investigation check. It does not determine current lesson grading or production AI readiness.

Existing `parola-fit-scorer-v1` downloads are preserved. The service worker can serve the exact cached old worker when its retired URL is unavailable; already-open old code retains its own runtime pair. Missing or interrupted downloads fail explicitly. No draft, result, history or learner evidence is migrated or removed by this retirement.

Current release checks use `tools/test-fit-retirement.mjs`, `tests/fit-retirement-e2e.mjs` and the real Workshop browser suite. The compatibility test uses the actual locally preserved model/runtime to start old workers online and offline, with a minimal service-worker fixture. This is compatibility evidence, not language-quality approval or a physical-phone benchmark.
