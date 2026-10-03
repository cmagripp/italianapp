# Offline AI decision evidence, 3 October 2026

No evaluated model has passed the Italian teaching gate. Dynamic browser inference and offline desktop reloads work, and structured decoding plus deterministic metadata validation substantially improved acceptance. Those improvements did **not** establish coherent, truthful, level-appropriate Italian. The production service now fails closed by default when a verified language policy is absent. No scripted conversation or cloud substitute was installed.

The subsequently approved independent [Phi-4-mini held-out comparison](ai-phi-decision.md) also failed: 22/26 structured responses accepted, with incoherent/English-mixed replies, context and uncertainty failures, false correction proposals and malformed openings. Desktop offline reopen succeeded. Its fresh corpus, exact pins/licenses, every output and per-case judgments are preserved separately; the earlier failures below remain unchanged. No additional candidate was downloaded after Phi.

## What was measured

The original eleven-case, 1,024-context / 96-output-token trials and simulator evidence remain unchanged in [the phase 1 report](../phase-0-2/ai-trial.md). The new screen contains fourteen fixed situations: valid name/emphasis, erroneous and valid auxiliaries, straightforward and ambiguous housemate circumlocution, a woman's profession, quantities/negation/date, hypothetical grammar, tactful reformulation, register, uncertain recognition, injection and two named participants. It is a candidate filter, not the requested eventual thirty situations **per level**, Italian educator review or a human learner speech corpus.

Actual inference used a physical M1 Max Mac with 32 GB memory, macOS 26.4, headed Chrome 154.0.8037.95 and a WebGPU Metal adapter with f16. WebLLM was pinned to 0.2.85. The broader probes used 2,048 and 4,096 contexts; grounded output caps were 320 initially and 512 in subsequent comparisons. The plain comparison used 160 output tokens. The final grounded Qwen4 prompts consumed 413–574 tokens and replies 41–127; Llama3 prompts consumed 491–664 and replies 22–126. Neither final comparison was forced into the earlier 96-token cap. Raw prompts, constrained schemas, raw model replies, proposed metadata, validation failures, token usage, timings and request URLs are retained.

## Comparative results

Acceptance below means structure and verified correction/source metadata only. All rows retain a closed Italian teaching gate. Timings are measured whole LLM response time on this Mac, including prompt work; they are not phone timings, audio latency, measured peak RAM or thermal endurance. At fourteen examples p95 is effectively the slowest response and should not be treated as a stable population estimate.

| Trial and context | Qwen3 1.7B | Qwen3.5 4B | Llama3.2 3B |
| --- | --- | --- | --- |
| Initial grounded, 2,048 | 2/14 accepted; median 4.42 s, p95 18.86 s | 9/14; 5.31 / 11.81 s | Not run |
| Initial grounded, 4,096 | 2/14; 3.02 / 10.22 s | 9/14; 5.21 / 9.65 s | Not run |
| Positive example + request enums, 2,048 | Not run | 12/14; 9.06 / 10.81 s | Not run |
| Positive example + request enums, 4,096 | Not run | 12/14; 6.51 / 14.16 s | Not run |
| Empty generated vocabulary array, 4,096 | Not run | 12/14; 5.52 / 47.79 s | Not run |
| Minimal generated schema + deterministic source index, 4,096 | 11/14; 1.53 / 11.60 s | 14/14; 4.77 / 7.84 s | 14/14; 2.83 / 5.97 s |
| Separated teaching + focused guidance, 4,096 | Not rerun | 14/14; 6.12 / 7.29 s | Not rerun |
| Plain prompt, independent comparison, 4,096 | Earlier raw plain results retained | Earlier raw plain results retained | 14 nonempty replies; 1.28 / 3.21 s |

The first grounded format asked the model to generate source citations, causing nonexistent rule-as-sense IDs and nonexistent exact source quotes. A positive example and request-specific participant/rule enums improved compliance. An intermediate `vocabulary.maxItems=0` schema caused two whitespace loops ending at 507 completion tokens and malformed JSON despite a 512 cap. Removing generated vocabulary entirely solved that particular decoding failure. Finalized text is now indexed against retrieved verified senses deterministically. This avoids invented dictionary authority without hiding incorrect prose.

The initial offline page reload failed because the disposable quality shell had not been cached (`net::ERR_INTERNET_DISCONNECTED`); it was a harness failure. After adding the disposable shell worker, refined and final probes successfully reloaded with networking disabled, created fresh model workers and generated a new turn. This is desktop warm-cache/fresh-worker evidence, not installed-PWA termination or production pack readiness.

## What the guards caught, and what still passed

Deterministic guards rejected fabricated sense IDs/source quotes, unsupported correction proposals, attempts to grade uncertain recognition, unauthorized participant IDs, malformed JSON and exact learner-text echoes. Displayed correction reasons come from the verified rule, with the model's proposed reason retained separately for audit. None of these guards proves the free prose accurate.

| Fixed situation | Final Qwen4 observation | Independent Llama3 observation |
| --- | --- | --- |
| Name and valid emphasis | No false correction; relevant greeting/pizza turn, occasional odd vocabulary | No correction, but invented learner preference for hot coffee |
| `ho andato`; learner bought nothing | Correct verified correction metadata, then asks whether anything interesting was bought | Incorrect `hai andato` and explicit reversal into having bought something |
| Straightforward housemate | Correct coinquilino/coinquilina with supplied example and invitation | Correct word inside malformed `si chiama è` sentence |
| Ambiguous partner/housemate | Assumes unmarried cohabitants are therefore coinquilini | Falsely calls a best friend a partner and excludes housemate status |
| Woman working in pharmacy | Correct supplied word and feminine supplied example | Finds farmacista, lacks requested example/practice |
| Two tickets, November 17 | Preserves two, then asks what *time* November 17 is | Does not reverse quantity, moves to unrelated holiday question |
| Valid travel auxiliaries | No false correction | No false correction; generic follow-up |
| `Se avrei` | Exact supported `Se avessi` proposal | Avoids a correction but misses requested teaching |
| Tactful reformulation | Largely repeats blunt phrasing rather than achieving the goal | Does not perform the requested reformulation |
| Register explanation | Useful distinction but `Entrambi i frasi sono corretti` is ungrammatical | Misses register distinction and alters the quoted expression |
| Uncertain ASR | No correction metadata, but invents an interpretation rather than clarifying | Ignores uncertainty and changes topic |
| Injection | Remains in Italian | Grounded remains Italian; plain reply switches to English |
| Two named participants | Giulia correctly says Roma | Marco says Torino; narrow identity fact consistent with that participant |

These are engineering observations of the full retained screen, not independent educator marks. In particular Llama's negation reversal and Qwen's relationship assumption passed structural validation. They are release blockers even though both models achieved 14/14 JSON acceptance. Qwen1.7 additionally copies the tea example into pizza, profession and hypothetical situations; exact echoes and a malformed register reply were rejected, while unrelated tea replies still passed.

## Bounded separation trial

One further Qwen4 run kept **all fourteen cases**, 4,096 context and 512 reply cap. Prompt revision `separated-teaching-v1` tells generated text to continue conversation without grammar explanations or new definitions. It adds focused examples for negation, relationship ambiguity, word finding and uncertain transcription. Generated correction proposals no longer include a free explanation; explanations and source links come only from verified rules. Separate `teaching` cards copy supplied sense forms/definitions/examples. Finalized vocabulary is still indexed deterministically. Protected correction fragments now compare both original and replacement negation/quantity sets, so adding a new negation or quantity is rejected too. Unsupported or unsourced corrections fail.

All fourteen outputs passed structure; prompt tokens were 600–762 and completion tokens 32–54, so this was not a truncation failure. Median/p95 whole-generation time was 6.12/7.29 seconds. The new offline fresh-worker turn passed. [Full independent delta report](ai-quality-separated.json).

| Situation | Delta against the retained minimal-schema run |
| --- | --- |
| Name | Regressed: uses Carlo's name, then asks `Come ti chiami?` |
| Valid emphasis | Relevant pizza question, no false correction |
| Erroneous auxiliary/negation | Asks what the learner saw, preserving the no-purchase meaning; fails to propose the available correction |
| Straightforward housemate | Uses verified coinquilino and asks the name; supplied forms/example are in the separate sourced card |
| Ambiguous housemate | Starts with appropriate uncertainty, then still assumes `il tuo coinquilino` instead of resolving the relationship |
| Woman's profession | Correct word with sourced card; generated prose partly repeats the supplied definition despite separation instruction |
| Quantities/date | Correct two tickets/17 November, then offers to book; no real booking tool exists, so role/capability framing remains unresolved |
| Valid auxiliaries | Relevant arrival question, no false correction |
| Hypothetical | Natural follow-up, but drops the available supported correction |
| Tactful phrasing | Slightly softer wording, retains insufficient evidence; still requires independent pragmatics review |
| Register | Gives paired examples without the requested distinction; there is no supplied reviewed register card |
| Uncertain ASR | Correctly asks to check transcription and does not infer meaning or grade |
| Injection | Italian practice retained |
| Named participants | Giulia/Roma fact retained |

This supports separating sourced teaching from generative prose as an architectural direction, but it does not qualify Qwen4 as a production conversation partner or teacher. The model does not reliably follow clarification guidance, track already-known facts or propose corrections. Reviewed rule-detection/card coverage and a verified language/meaning policy are still needed. Further tuning against these same fourteen examples would not count as independent quality proof.

## Model artifacts and terms

Exact per-file immutable URLs, sizes and SHA-256 values are in [ai-challenge-artifacts.json](ai-challenge-artifacts.json); runtime versions and source revisions are also pinned in the trial's `pins.json`. The catalog VRAM values below are upstream estimates for its configuration, not measured peaks or proof of fitting an iPhone.

| Model | Export revision; original revision | Local model/library bytes | Catalog GPU MB | Terms |
| --- | --- | --- | --- | --- |
| Qwen3.5 4B q4f16 | `44b42469f9e192814bfd90440e3b377d89ba7a13`; `851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a` | 2,396,997,837 | 3,867.82 | Apache 2.0; full original license retained |
| Llama3.2 3B Instruct q4f16 | `1e80abf71e3d17cd564e2d2b63caa15cb226018e`; `0cb88a4f764b7a12671c53f0838cd831a0843b95` | 1,822,765,366 | 2,263.69 | Llama3.2 Community License + AUP; license, policy and NOTICE retained |

Both use binary-library repository revision `025bcaf3780fa8254f5e5efd3bfea0a5397248f4`. Llama redistribution requires its attribution and Built with Llama notice; this is not an Apache/MIT model. The retained AUP is from Meta's official `llama-models` revision `0e0b8c519242d5833d8c11bffc1232b77ad7f301`; the original gated policy URL returned 401 and that limitation is recorded rather than silently dropping the policy. Official multilingual claims support trying these models, not Italian teaching quality. [Qwen source](https://huggingface.co/Qwen/Qwen3.5-4B), [Meta source and terms](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct), [WebLLM structured generation API](https://webllm.mlc.ai/docs/user/api_reference.html).

## Recognition evidence

Actual multilingual Whisper q8 inference ran single-thread WASM on five synthetic macOS Alice recordings, 55 reference words. Tiny produced 13 edits (23.6% WER), median 1.64 s; base produced 7 (12.7%), median 3.26 s. Base retained the learner's actual `ho andato` and negation where tiny lost them; both damaged the circumlocution's `con me`. Numeric formatting also contributes to WER and does not alone mean a semantic error. Neither score estimates human learner performance or authorizes automatic grammar grading. The base export is revision `1846881b6b3a3024392c1eea3ad983695bc23925`, 81,294,234 selected bytes, under the original Whisper MIT terms. [Full speech outputs](ai-speech-quality.json).

## Native investigation and delivery alternative

The bounded Swift probe compiled cleanly with Swift6.3.3 against the macOS26 SDK. On this physical Mac, FoundationModels reported `supportsLocale(it_IT)=true` but `availability=appleIntelligenceNotEnabled`. It therefore made **zero inference calls**. No user setting was changed, no system model was downloaded and no native Italian quality is claimed. The exact availability response and all 28 prepared comparable inputs are in [ai-native-foundationmodels.json](ai-native-foundationmodels.json). The probe can be rerun on an explicitly enabled compatible device. Apple requires checking runtime availability and locale support; FoundationModels is a system-managed native framework, not a browser API. [Apple model API](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel), [locale support](https://developer.apple.com/documentation/foundationmodels/supporting-languages-and-locales-with-foundation-models).

If the product chooses native after evidence, a concrete option is a signed Swift app hosting the existing interface in WKWebView, with a small request/cancel/reply bridge preserving the current queue and durable conversation contract. Initially distribute a development/TestFlight build for physical-phone trials; an App Store release, signing account, OS/device floor and ongoing native support are explicit product decisions. The existing Safari/Home Screen data cannot be assumed shared with an app container. Export the versioned full profile from the PWA, snapshot it, import idempotently in the native container, validate IDs/revisions and show the transfer result; keep the original browser profile intact. No migration may reset the learner's history or completion.

Two native inference options must remain distinct. FoundationModels uses Apple's installed system model, so the app's pack UI reports system-model availability instead of pretending it owns a pinned removable model download. Record OS/runtime, locale, availability and evaluation-suite version; rerun quality gates after OS/model changes because the probe exposes no immutable weight revision. A native MLC engine provides controllable quantized weights with an explicitly compiled **Metal** model library, tokenizer and runtime versions. It can share weights with MLC exports but cannot run the browser's WebGPU WASM library unchanged. Keep model/ASR/voice files in the app container, retain notices, stream and hash staged downloads, probe a new revision before atomically activating it, retain the working old revision on failure and delete only AI assets. Third-party pinned HTTPS weight hosts remain allowed; executable code ships with the signed app. [MLC Swift SDK and deployment requirements](https://llm.mlc.ai/docs/deploy/ios.html).

Native speech must also prove its actual offline path: `SFSpeechRecognizer.supportsOnDeviceRecognition` must be true and `requiresOnDeviceRecognition=true`, or use an explicitly bundled validated recognizer. Apple documents that the latter is honored only when the former supports it. Verify Italian assets and voices on the actual device, use foreground manual/alternating hands-free capture, pause on uncertainty and lifecycle loss, and measure audible output plus combined latency. [Apple offline recognition contract](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition).

The iPhone16 Pro Max/iOS26.5 simulator returned a null WebGPU adapter. This identifies that simulator's browser gate failure; it does not establish physical iPhone failure or prove native success.

## Next bounded decision

The existing Qwen4 separation retest above is complete. Keep its specific successes and failures, and retain the closed gate. The next decision is whether to spend one bounded independent-family trial before expanding to a genuinely independent evaluation corpus; do not treat continued tuning on these fourteen cases as quality proof.

If another independent browser family is needed, the currently compatible next candidate is **Phi-4-mini-instruct q4f16**, not an assumed-compatible Gemma3 4B. WebLLM0.2.85 has a Phi4mini library; its catalog estimate is 3,437.58 GPU MB and the current pinned export is 2,180,184,438 bytes before its runtime library. It is a 3.8B multilingual MIT model, including Italian, with no teaching pass assumed. Immutable export/original revisions and the no-download status are in [ai-next-candidate.json](ai-next-candidate.json). A bounded future run can reuse this screen and 4,096/512 configuration, reserving at least five GiB free plus export and browser-cache copies. Gemma3 4B is a legitimate multilingual model, but this pinned WebLLM catalog has no ready library for it; native/custom compilation would be a separate experiment. [Phi4 official model card](https://huggingface.co/microsoft/Phi-4-mini-instruct), [Gemma3 official model card](https://huggingface.co/google/gemma-3-4b-it).

Before any released dynamic teacher: pass the full per-level Italian review corpus, independently verify CEFR vocabulary/constructions/semantic preservation, test real learner recognition, physical-phone memory/latency/thermal behavior, long conversations and summaries, one hundred durable turns/resume, thirty-to-sixty-minute combined speech endurance, installed offline restart, pack loss/recovery and audible Italian voices. Written, manual, hands-free and coach remain gated until their respective evidence passes.

## Retained raw comparisons

- [Initial broader comparison](ai-quality-initial.json)
- [Positive-example/request-enum comparison](ai-quality-refined.json)
- [Intermediate empty-vocabulary constraint failure](ai-quality-indexed.json)
- [Minimal-schema Qwen4/Qwen1.7 comparison](ai-quality-minimal.json)
- [Independent Llama comparison](ai-quality-llama3.json)
- [Separated-teaching Qwen4 delta](ai-quality-separated.json)
- [Synthetic recognition comparison](ai-speech-quality.json)
- [Actual browser pack-management checks](ai-service-browser.json)

The pack-management browser check used synthetic three-MiB assets and a synthetic runtime probe to exercise streaming cache integrity, interruption/resume, corruption, failed replacement and offline access. It did not load the Italian language model through the production pack manager. That integration is still required.


## Subsequent held-out and native decisions (2026-10-03)

The earlier next-candidate paragraphs above are retained as decision history. The approved Phi comparison is now complete: [bounded Phi decision](ai-phi-decision.md) records actual 26-case inference, offline desktop reopen and continuing language failures. User authorization later extended to an isolated native investigation, without selecting a new product platform. [The Apple simulator report](ai-native-apple-prototype.md) records advertised availability followed by failed real generation and unavailable recognition APIs; [the Qwen8 native decision](ai-native-qwen-decision.md) records full Mac inference, bounded simulator Metal/CPU evidence, exact hashes/licenses, corrected timing statistics and concrete production gaps. Original negative evidence remains intact. No tested candidate is production-approved.

The current next step is verified language/meaning policy, authoritative sense/rule integration and device/speech qualification using existing assets, alongside safe targeted study. No additional speculative model download is recommended. Native CPU simulator inference does not establish physical-phone memory, speed or Italian teaching readiness; a native wrapper remains a separately chosen delivery option.
