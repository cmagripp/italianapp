# The assistant experiment (sentence workshop, layer 3)

Status: experimental, 2 October 2026. Off by default, opt-in per device, and no lesson depends on it. It is kept only if it runs reliably on the owner's phone (`PLAN-SENTENCE-WORKSHOP-2026-10-02.md` §8 and §9; the facts behind the design are in `RESEARCH-ON-DEVICE-AI-2026-10-02.md`). The workshop page's Strumenti pane enables and disables it and resets the breaker, and the lesson player asks it to pick among generic reaction lines in a conversation; everything else in the workshop ignores it.

## What it does

`js/learning/assistant.js` runs a small language model on the device through WebGPU: WebLLM 0.2.85 with Qwen3 0.6B at 4-bit (`Qwen3-0.6B-q4f16_1-MLC`, 336 MB of weights), with a 1,024-token context window instead of the prebuilt 4,096 so the key-value cache stays small.

The model does one thing: it picks an index. `assistantPick({ question, candidates })` sends a short description of the situation and a numbered list of candidate texts, asks for `{"choice": N}` under a JSON schema (constrained decoding, temperature 0, no thinking block), and returns the chosen candidate's `id`, or `null`. The model's text is never shown to the learner and never becomes Italian the learner reads; the texts it chooses among are all authored. The uses the plan names: choosing among the generic reactions in a dialogue turn after a free-entry word, breaking ties for the fit scorer (layer 2), and picking the explanation template that applies to a slip. In every case the caller has a deterministic rule to fall back on when the answer is `null`, so the workshop behaves identically with the assistant absent, disabled, unsupported or crashed.

Importing the module costs nothing: no network request and no model until the learner opts in. The runtime (`https://esm.run/@mlc-ai/web-llm@0.2.85`) is imported dynamically inside `enableAssistant` only.

## Limits

- **Devices.** WebGPU with 16-bit shaders: iPhone 15 Pro class or newer on iOS 26 or later, and current desktop browsers. `assistantSupport()` is the synchronous gate (`navigator.gpu` present; a device reporting under 4 GB through `navigator.deviceMemory`, a Chromium-only hint, is refused). `probeAssistantSupport()` additionally requests the adapter and checks `shader-f16`, which the q4f16 weights need; `enableAssistant` makes the same check before downloading anything. Nothing is offered to a device that fails either.
- **Memory.** A loaded engine holds about a gigabyte, and iOS kills a page that uses too much without warning or any event the page could catch. This is what the breaker (below) is for, and why `releaseAssistant()` exists: free the engine when leaving a lesson rather than keep it resident while the learner uses the rest of the app.
- **Answers.** One at a time (concurrent calls queue). Default timeout 6 seconds (`maxMs`), after which the generation is interrupted and a trip is counted. At most 12 candidates, question text up to 600 characters, candidate text up to 160, whitespace normalised; a single candidate is returned without consulting the model. An unparseable or out-of-range answer is `null`, not a trip.
- **Quality.** Qwen3 0.6B's Italian is weak (its own report scores it at about a third of the 1.7B model), which is why it only selects among authored options and never grades or writes. Whether its selections are better than the deterministic rule is part of what the experiment measures.
- **Download.** About 340 MB on the first enable (weights, a model library of a few MB and the runtime), from third-party hosts, so the first enable needs a network connection. Afterwards everything comes from the browser's cache and works offline.
- **Speed.** No measurement exists for an iPhone 16 Pro in Safari (the research note); the nearest figure is 4 to 17 tokens per second on a newer phone in a different runtime. An answer is about ten tokens after a prompt of a few hundred, so a pick should take one to three seconds once loaded, but this has to be measured.

## Enabling and disabling

The module's API (every function returns a plain value or `null`, never throws, and `assistantState()` is returned by every state-changing call):

| Call | What it does |
| --- | --- |
| `assistantSupport()` | `{ supported, reason?, device: { webgpu, memoryHint, adapter } }`, synchronous, no network. Reasons: `no-navigator`, `no-webgpu`, `low-memory`, and after a probe `no-adapter`, `no-f16`, `adapter-error`. |
| `probeAssistantSupport()` | The same after requesting the WebGPU adapter; for a view that wants to know before offering the download. |
| `assistantState()` | `{ enabled, loaded, loading, error, breaker: { trips, tripped, lastTripAt, lastTrip }, model }`. |
| `enableAssistant(onProgress)` | The opt-in. Imports the runtime, downloads or reads the cached weights, compiles the shaders; `onProgress({ text, progress })` follows it (progress 0 to 1). Refuses with `error: 'tripped'` while the breaker is tripped and with the support reason on an unsupported device. A thrown load error (offline, a shader the device lacks) withdraws the opt-in and sets `error`; it is a failure, not a trip. Concurrent callers share one load. |
| `disableAssistant()` | The learner's opt-out: frees the engine and clears `enabled`. The cached weights stay in the browser's storage, so enabling again does not download them again. During a load, the engine is freed as soon as it arrives. |
| `releaseAssistant()` | Frees the engine but keeps `enabled`: for leaving a workshop lesson. The next `enableAssistant` reloads from the cache (seconds, not a download). An answer in flight is dropped (`null`). |
| `assistantPick({ question, candidates, maxMs = 6000 })` | `candidates` is `[{ id, text }]`. Resolves `{ id }` or `null`. |
| `resetAssistantBreaker()` | Clears the trips so the learner can opt in again; it does not re-enable by itself. |

The intended flow for a view: offer the toggle only when `assistantSupport().supported`; on the toggle, call `enableAssistant` with a progress bar and tell the learner the size before the first download; when a workshop lesson opens and `assistantState().enabled` is true, call `enableAssistant` again (a cache load) and `releaseAssistant` when the lesson closes; a settings switch calls `disableAssistant`; when the breaker is tripped, show why and offer `resetAssistantBreaker`. To remove the downloaded weights, clear the site's data in the browser (the module never deletes them; `deleteModelAllInfoInCache` from the WebLLM runtime does, if a developer wants to from the console).

## The breaker

The guard against the one failure the page cannot see coming: being killed for memory. The record in `localStorage['it.assistant']` is

```json
{ "enabled": false, "trips": 0, "loading": false, "busy": false, "lastTripAt": null, "lastTrip": null }
```

- `loading` is set before the runtime and weights load and cleared after; `busy` is set while an answer is generated and cleared after. A page killed with either flag set cannot clear it, so at the next start a set flag counts one trip (`lastTrip` `load` or `pick`) and is cleared.
- A timed-out answer counts a trip (`timeout`) and interrupts the generation.
- Two trips switch the assistant off: `enabled` becomes false, the engine is freed, `enableAssistant` refuses with `tripped` and `assistantPick` returns `null`, until `resetAssistantBreaker()`. Any stored count of two or more reads as tripped.
- A successful pick resets the count to zero: a device that answered is not held to an earlier bad start.
- A thrown error during the load or an answer is a failure, not a trip (it is reported in `assistantState().error`); only a death or a timeout trips.
- A graceful departure is not a crash: `pagehide` (a reload, a navigation, a closed tab) clears the stored flags, and a page restored from the back-forward cache re-arms them if the work is still running. The same when the page is hidden: iOS freezes a backgrounded web app and may evict it later, which never crashed in front of the learner, so the flags are cleared while hidden and re-armed when the page is visible again.
- The record is read once at module load and kept in memory from then on, so a blocked or missing `localStorage` (a private window) still gives a working assistant for that page; the breaker simply does not survive a reload there.

The record is per device and per browser: it is not part of the learner's profile, not synced and not in a backup.

## Privacy

No learner text leaves the device. The situation and candidate texts of a pick are formatted into a prompt that runs on the device's GPU; nothing is sent to any server, and nothing is logged by the module. The only network traffic is the one-time download when the learner enables the assistant: the runtime from `cdn.jsdelivr.net` (`esm.run` redirects there), the weights and model configuration from `huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC`, and the compiled model library from `raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs`. Those hosts see an ordinary file download from the device's address, the same as any CDN; they do not see what the learner does. The downloaded files live in the browser's Cache API under the app's origin (`webllm/model`, `webllm/wasm`, `webllm/config`), which `sw.js` keeps across app updates, and go away with the site's data. None of this enters the repository: the weights are fetched from the model's public repository on demand, as the plan requires.

## Checks and measuring

`node tools/test-assistant-guard.mjs` runs the guards in Node with a fake `localStorage`, a fake `navigator.gpu` and a fake runtime injected through `enableAssistant`'s second argument: support detection, the loading and busy flags tripping on a restart, the two-trip breaker and its reset, enabling, disabling and releasing, the request the model receives, timeouts, bad answers, blocked storage, and that `assistantPick` returns `null` without an engine and never throws. WebGPU and the real model are not exercised anywhere in the checks; that is the measurement on the phone, which decides whether layer 3 stays:

1. Enable on the installed app over Wi-Fi: how long the download and the first compile take, and whether the page survives them (`it.assistant` shows `trips` afterwards).
2. Reload the app and enable again: the load from the cache, which is what every lesson start would cost.
3. Twenty picks in a row on a dialogue turn: the time per answer, whether any times out, whether the phone warms up, and the battery used.
4. Switch to another app and come back during a load and during a pick: the page should still be there, or restart without a trip.
5. Compare the picks with the deterministic rule's choices on the same turns: if the model is not visibly better, the experiment ends there.
