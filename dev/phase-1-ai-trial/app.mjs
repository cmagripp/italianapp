import { SETTINGS, committedHistory, readTrialTurns, summarize, wordErrorRate } from './core.mjs';
const $ = id => document.getElementById(id), STORE = 'parola.phase1.trial.v1', CACHE = 'parola-phase1-disposable-trial-v1';
let restored;
try { restored = readTrialTurns(localStorage, STORE); } catch (error) { restored = { turns: [], error: String(error.message || error) }; }
const rows = [], events = [], turns = restored.turns;
let storageError = restored.error, busy = false;
let manifest, selected, llm, asr, tts, vad, fixtureVAD, recorder, chunks = [], stream, handsfree = false, epoch = 0, sequence = 0, manualDraft, lastSpeechAt = 0, captureSource = 'live-microphone', playingAudio;
let voiceProbeDone = false;
const status = text => { $('status').textContent = text; events.push({ at: new Date().toISOString(), status: text }); };
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(turns)); return true; } catch (error) { storageError = String(error.message || error); events.push({ storageError }); return false; } };
const setBusy = value => { busy = value; for (const id of ['send', 'manual-send', 'smoke']) $(id).disabled = value; };
const show = () => { $('results').textContent = JSON.stringify(summarize(rows), null, 2); };
function worker(file) {
  const w = new Worker(file, { type: 'module' }), pending = new Map();
  w.onmessage = ({ data }) => { if (data.progress) { status(data.progress.text); return; } const pair = pending.get(data.id); if (!pair) return; pending.delete(data.id); clearTimeout(pair.timer); data.error ? pair.reject(Error(data.error)) : pair.resolve(data.result); };
  w.onerror = event => { for (const pair of pending.values()) { clearTimeout(pair.timer); pair.reject(Error(event.message)); } pending.clear(); };
  return { call(op, payload = {}, timeout = 180000) { const id = ++sequence; return new Promise((resolve, reject) => { const timer = setTimeout(() => { pending.delete(id); reject(Error(`${op} timed out`)); w.postMessage({ id: ++sequence, op: 'cancel' }); }, timeout); pending.set(id, { resolve, reject, timer }); w.postMessage({ id, op, payload }); }); }, terminate() { w.terminate(); for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error('Worker released')); } pending.clear(); } };
}
async function probe() {
  const adapter = await navigator.gpu?.requestAdapter();
  const voices = await localVoices();
  const environment = { measuredAt: new Date().toISOString(), userAgent: navigator.userAgent, platform: navigator.platform, secureContext: isSecureContext, standalone: matchMedia('(display-mode: standalone)').matches,
    crossOriginIsolated, webgpu: !!navigator.gpu, adapter: !!adapter, shaderF16: adapter?.features.has('shader-f16') || false,
    adapterInfo: adapter?.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null,
    adapterLimits: adapter ? { maxBufferSize: adapter.limits.maxBufferSize, maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize } : null,
    localItalianVoices: voices.map(v => ({ name: v.name, lang: v.lang, localService: v.localService })), storage: await navigator.storage?.estimate(), versions: manifest?.versions,
    microphone: !!navigator.mediaDevices?.getUserMedia, speechRecognitionBuiltInUsed: false };
  $('environment').textContent = JSON.stringify(environment, null, 2); return environment;
}
async function localVoices() {
  if (!globalThis.speechSynthesis) return [];
  let voices = speechSynthesis.getVoices();
  if (!voices.length && !voiceProbeDone) await new Promise(resolve => { const done = () => { speechSynthesis.removeEventListener('voiceschanged', done); resolve(); }; speechSynthesis.addEventListener('voiceschanged', done); setTimeout(done, 1500); });
  voiceProbeDone = true;
  return speechSynthesis.getVoices().filter(v => v.localService === true && /^it(?:[-_]|$)/i.test(v.lang));
}
async function speak(text, requestEpoch = epoch) {
  const overallStart = performance.now();
  const voices = $('voice')?.value === 'piper' ? [] : await localVoices();
  if (requestEpoch !== epoch) throw Error('Stale speech cancelled');
  if (!voices.length) {
    if (!tts) throw Error('No local Italian system voice and bundled voice is not loaded.');
    const start = overallStart, generated = await tts.call('synthesize', { text });
    if (requestEpoch !== epoch) throw Error('Stale synthesis cancelled before playback');
    const url = URL.createObjectURL(new Blob([generated.wav], { type: 'audio/wav' })), audio = playingAudio = new Audio(url);
    return new Promise((resolve, reject) => { let firstAudioMs = null; const timer = setTimeout(() => { audio.pause(); URL.revokeObjectURL(url); reject(Error('Bundled speech playback watchdog expired')); }, 60000);
      audio.onplaying = () => { firstAudioMs = performance.now() - start; };
      audio.onended = () => { clearTimeout(timer); URL.revokeObjectURL(url); playingAudio = null; resolve({ ttsStartMs: firstAudioMs, ttsGenerationMs: generated.ttsGenerationMs, ttsCompleteMs: performance.now() - start, voice: { name: 'it_IT-paola-medium', lang: 'it-IT', localService: true, engine: 'Piper ONNX/eSpeak WASM' }, audibleConfirmedByHuman: false }); };
      audio.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(Error('Bundled voice audio decoding/playback failed')); }; audio.play().catch(error => { clearTimeout(timer); URL.revokeObjectURL(url); reject(error); }); });
  }
  const start = overallStart;
  return new Promise((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text); u.voice = voices[0]; u.lang = 'it-IT'; u.rate = .95;
    let firstAudioMs = null; const timer = setTimeout(() => { speechSynthesis.cancel(); reject(Error('Local speech watchdog expired')); }, 45000);
    u.onstart = () => { firstAudioMs = performance.now() - start; };
    u.onend = () => { clearTimeout(timer); if (firstAudioMs === null) reject(Error('Speech ended without a start event')); else resolve({ ttsStartMs: firstAudioMs, ttsCompleteMs: performance.now() - start, voice: { name: u.voice.name, lang: u.voice.lang, localService: u.voice.localService }, audibleConfirmedByHuman: false }); };
    u.onerror = e => { clearTimeout(timer); reject(Error(`Local voice: ${e.error}`)); }; speechSynthesis.speak(u);
  });
}
async function install(id = $('model').value) {
  const registration = await navigator.serviceWorker.register('./sw.js'); await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  selected = manifest.models.find(m => m.model_id === id); if (!selected) throw Error('Candidate is not provisioned locally.');
  const assets = manifest.assets.filter(a => !a.path.includes('/models/llm/') || a.path.includes(`/models/llm/${id}/`));
  for (const file of ['index.html', 'app.mjs', 'core.mjs', 'cases.json', 'manifest.webmanifest', 'assets/manifest.json']) assets.push({ path: file });
  const start = performance.now();
  await new Promise((resolve, reject) => { const channel = new MessageChannel(); channel.port1.onmessage = ({ data }) => { if (data.error) reject(Error(data.error)); else if (data.done) resolve(); else status(`Verified and cached ${data.completed}/${data.total}: ${data.path}`); }; registration.active.postMessage({ op: 'install', assets }, [channel.port2]); });
  const result = { model: id, installMs: performance.now() - start, verifiedBytes: assets.reduce((n, a) => n + (a.bytes || 0), 0), artifacts: assets.length };
  events.push({ provisioning: result }); status('Selected pack cached. Cold offline operation still needs a generation/playback test.'); return result;
}
async function load(id = $('model').value, context = Number($('context').value)) {
  await unload(); selected = manifest.models.find(m => m.model_id === id); if (!selected) throw Error('Candidate is not provisioned.');
  const environment = await probe(); if (!environment.adapter || !environment.shaderF16) throw Error('This environment has no compatible WebGPU f16 adapter.');
  llm = worker('./assets/llm-worker.mjs'); asr = worker('./assets/asr-worker.mjs'); tts = worker('./assets/tts-worker.mjs');
  const llmLoad = await llm.call('load', { model: selected, context }, 300000);
  const asrLoad = await asr.call('load', {}, 180000);
  const ttsLoad = await tts.call('load', {}, 180000);
  events.push({ model: id, context, llmLoad, asrLoad, ttsLoad }); status('Actual local language model, Italian ASR and bundled Italian voice loaded.'); return { llmLoad, asrLoad, ttsLoad };
}
async function unload() { await stop(); await vad?.destroy(); vad = null; fixtureVAD = null; await llm?.call('unload').catch(() => {}); llm?.terminate(); asr?.terminate(); tts?.terminate(); llm = asr = tts = null; }
async function turn(text, options = {}) {
  if (!llm) throw Error('Load a pipeline first.'); if (busy) throw Error('A turn is already running.');
  const history = options.history === undefined ? committedHistory(turns) : options.history;
  setBusy(true); const token = epoch, started = performance.now();
  const row = { mode: options.mode || 'written', source: options.source || 'typed', model: selected.model_id, context: Number($('context').value), level: options.level || $('level').value,
    at: new Date().toISOString(), text, historyMessages: history.length, recognizedText: options.recognizedText, reference: options.reference, ...options.metrics };
  const entry = { id: crypto.randomUUID(), role: 'user', content: text, status: 'committed', mode: row.mode, recognizedText: options.recognizedText }; turns.push(entry); save();
  try {
    status('Generating and checking the complete response…');
    const result = await llm.call('generate', { text, level: row.level, history });
    if (token !== epoch) throw Error('Stale turn cancelled'); Object.assign(row, result);
    if (!result.validation.ok) throw Error(result.validation.reason);
    $('reply').textContent = result.reply; turns.push({ id: crypto.randomUUID(), role: 'assistant', content: result.reply, status: 'committed', sourceTurn: entry.id }); save();
    row.validatedReplyMs = performance.now() - started;
    if (row.mode !== 'written' || options.speak) {
      const speech = await speak(result.reply, token); if (token !== epoch) throw Error('Stale playback cancelled'); Object.assign(row, speech);
      row.endToFirstAudioMs = row.mode === 'handsfree' && row.source !== 'recorded-fixture' ? (row.endpointMs || 0) + (row.asrMs || 0) + row.validatedReplyMs + speech.ttsStartMs : null;
      row.sendToFirstAudioMs = row.validatedReplyMs + speech.ttsStartMs;
      row.pipelineToFirstAudioMs = (row.vadProcessingMs || 0) + (row.asrMs || 0) + row.validatedReplyMs + speech.ttsStartMs;
    }
    row.ok = true; status('Turn complete.');
  } catch (error) { row.ok = false; row.error = String(error.message || error); status(row.error); }
  finally { setBusy(false); }
  rows.push(row); show(); return row;
}
async function decode(arrayBuffer) { const ctx = new AudioContext(); try { const decoded = await ctx.decodeAudioData(arrayBuffer); const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000); const source = off.createBufferSource(); source.buffer = decoded; source.connect(off.destination); source.start(); return (await off.startRendering()).getChannelData(0); } finally { await ctx.close(); } }
async function vadForFile() {
  if (fixtureVAD) return fixtureVAD; const { NonRealTimeVAD } = await import('./assets/vad-entry.mjs');
  fixtureVAD = await NonRealTimeVAD.new({ modelURL: new URL('./assets/vad/silero_vad_legacy.onnx', location.href).href, redemptionMs: 1200, minSpeechMs: 100,
    ortConfig: ort => { ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = new URL('./assets/ort-vad/', location.href).href; } }); return fixtureVAD;
}
async function transcribe(audio, source = captureSource, requestEpoch = epoch) {
  if (!asr) throw Error('Load recognition first.'); if (!audio.length || audio.length > 16000 * 60) throw Error('Audio must be between 0 and 60 seconds.');
  status('Recognizing locally in Italian…'); const result = await asr.call('transcribe', { audio }); if (requestEpoch !== epoch) throw Error('Stale recognition cancelled'); $('text').value = result.recognizedText; $('transcript').textContent = result.recognizedText;
  if (!result.recognizedText) throw Error('Empty recognition: no turn was submitted.'); return { ...result, source, audioSeconds: audio.length / 16000 };
}
async function record() {
  if (busy) throw Error('Wait for the current turn or stop it first.');
  await stop(); if (!asr) throw Error('Load the pipeline first.');
  const token = epoch, acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  if (token !== epoch) { acquired.getTracks().forEach(t => t.stop()); return; }
  stream = acquired; chunks = [];
  recorder = new MediaRecorder(stream); recorder.epoch = epoch; recorder.ondataavailable = e => chunks.push(e.data); recorder.start(); status('Recording; press Stop to create an editable transcript.');
  recorder.limit = setTimeout(() => finish().catch(e => status(e.message)), 60000);
}
async function finish() {
  if (!recorder || recorder.state === 'inactive') return; const current = recorder, token = current.epoch; clearTimeout(current.limit);
  await new Promise(resolve => { current.onstop = resolve; current.stop(); }); stream?.getTracks().forEach(t => t.stop()); stream = null;
  const audio = await decode(await new Blob(chunks, { type: current.mimeType }).arrayBuffer()); chunks = []; recorder = null;
  const detector = await vadForFile(); let found = false; for await (const segment of detector.run(audio, 16000)) { if (segment.audio.length) found = true; }
  if (token !== epoch) return;
  if (!found) { status('No speech detected; nothing submitted.'); return; }
  manualDraft = await transcribe(audio, captureSource, token); manualDraft.recordedAt = performance.now(); status('Editable transcript ready. Send to commit once.'); return manualDraft;
}
async function startHandsfree() {
  if (busy) throw Error('Wait for the current turn or stop it first.');
  if (!llm || !asr) throw Error('Load the pipeline first.'); await stop(); handsfree = true; const token = epoch;
  await speak('Ciao! Sono pronto. Di che cosa vuoi parlare?', token);
  const { MicVAD } = await import('./assets/vad-entry.mjs');
  vad = await MicVAD.new({ model: 'v5', baseAssetPath: new URL('./assets/vad/', location.href).href, onnxWASMBasePath: new URL('./assets/ort-vad/', location.href).href,
    redemptionMs: 1200, minSpeechMs: 100, preSpeechPadMs: 300, startOnLoad: false,
    ortConfig: ort => { ort.env.wasm.numThreads = 1; },
    onFrameProcessed: probabilities => { if (probabilities.isSpeech >= .5) lastSpeechAt = performance.now(); },
    onSpeechStart: () => status('Listening…'), onVADMisfire: () => status('Short sound ignored. Listening…'),
    onSpeechEnd: async audio => {
      if (!handsfree || token !== epoch) return;
      const endpointMs = performance.now() - lastSpeechAt; await vad.pause();
      try { const result = await transcribe(audio); if (token !== epoch) return; await turn(result.recognizedText, { mode: 'handsfree', source: captureSource, recognizedText: result.recognizedText, metrics: { endpointMs, asrMs: result.asrMs, audioSeconds: result.audioSeconds } }); }
      catch (error) { rows.push({ mode: 'handsfree', ok: false, error: error.message }); show(); status(error.message); }
      if (handsfree && token === epoch && document.visibilityState === 'visible') { await vad.start(); status('Listening for the next turn…'); }
    } });
  if (token !== epoch) { await vad.destroy(); return; } await vad.start(); status('Hands-free listening. Stop is always available.');
}
async function stop() { epoch++; handsfree = false; await vad?.pause().catch(() => {}); speechSynthesis?.cancel(); if (playingAudio) { playingAudio.pause(); playingAudio.dispatchEvent(new Event('error')); playingAudio = null; } await llm?.call('cancel').catch(() => {}); if (recorder?.state === 'recording') { clearTimeout(recorder.limit); recorder.stop(); } stream?.getTracks().forEach(t => t.stop()); stream = null; chunks = []; manualDraft = null; status('Stopped.'); }
async function fixture(url, options = {}) {
  const audio = await decode(await (await fetch(url)).arrayBuffer()); const detector = await vadForFile(); const started = performance.now(), segments = [];
  for await (const segment of detector.run(audio, 16000)) segments.push(segment);
  if (!segments.length) { const row = { mode: options.mode || 'handsfree', source: 'recorded-fixture', ok: false, error: 'No speech detected' }; rows.push(row); show(); return row; }
  const vadMs = performance.now() - started; const result = await transcribe(segments[0].audio, 'recorded-fixture');
  const row = await turn(result.recognizedText, { mode: options.mode || 'handsfree', source: 'recorded-fixture', reference: options.reference, recognizedText: result.recognizedText, history: options.history,
    metrics: { asrMs: result.asrMs, vadProcessingMs: vadMs, endpointMs: null, audioSeconds: result.audioSeconds, detectedSegments: segments.length, wer: options.reference ? wordErrorRate(options.reference, result.recognizedText) : null } }); return row;
}
async function smoke(limit = 11) { const cases = await (await fetch('./cases.json')).json(); for (const c of cases.slice(0, limit)) { const row = await turn(c.text, { level: c.level, history: [] }); row.caseId = c.id; row.reviewRubric = c.review; } return rows; }
async function report() { return { schema: 1, kind: 'disposable-phase1-pipeline-trial', environment: await probe(), settings: SETTINGS, modelProvenance: selected?.provenance, model: selected?.model_id, rows, events, turns, summaries: summarize(rows), quality: 'not independently rated; structural output validation only', audioPersisted: false, storageError }; }
function action(id, fn) { $(id).onclick = () => fn().catch(error => status(error.message)); }
action('probe', probe); action('install', () => install()); action('load', () => load()); action('unload', unload);
action('send', () => turn($('text').value)); action('record', record); action('finish', finish);
async function sendManual() { if (busy) throw Error('A turn is already running.'); if (!manualDraft) throw Error('Record and stop first.'); const draft = manualDraft; manualDraft = null; return turn($('text').value, { mode: 'manual', source: captureSource, recognizedText: draft.recognizedText, metrics: { asrMs: draft.asrMs, audioSeconds: draft.audioSeconds, transcriptEdited: $('text').value !== draft.recognizedText } }); }
action('manual-send', sendManual);
action('start', startHandsfree); action('stop', stop); action('smoke', smoke);
action('fixture-run', async () => { const file = $('fixture').files[0]; if (!file) throw Error('Choose an Italian audio file.'); const url = URL.createObjectURL(file); try { return await fixture(url); } finally { URL.revokeObjectURL(url); } });
action('export', async () => { const blob = new Blob([JSON.stringify(await report(), null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `parola-trial-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); });
action('clear', async () => { await stop(); turns.length = 0; save(); $('reply').textContent = $('transcript').textContent = ''; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stop().catch(() => {}); }); window.addEventListener('pagehide', () => { save(); stop().catch(() => {}); });
try { manifest = await (await fetch('./assets/manifest.json')).json(); for (const model of manifest.models) { const option = document.createElement('option'); option.value = model.model_id; option.textContent = model.model_id; $('model').append(option); } status('Local trial artifacts are provisioned. Choose a candidate and install its cache.'); }
catch { status('First run prepare.mjs to provision selected artifacts. No model download occurs on page boot.'); }
if (storageError) status(`Trial transcript storage unavailable: ${storageError}. Export measurements before closing.`);
window.trial = { probe, install, load, unload, turn, smoke, fixture, transcribe, report, speak, stop, startHandsfree, record, finish, sendManual, setCaptureSource: source => { captureSource = source; }, rows, manifest };
window.webkit?.messageHandlers?.trial?.postMessage({ ready: true });
if (new URLSearchParams(location.search).has('probe')) probe().then(environment => fetch('./measurements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'capability-probe-only', label: new URLSearchParams(location.search).get('probe'), environment }) })).catch(error => status(error.message));
