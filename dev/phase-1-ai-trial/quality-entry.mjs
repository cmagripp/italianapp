import { createAIService, prepareTask } from '../../js/ai/index.js';
import { probeGrounding, qualityCases } from './quality-grounding.mjs';
import { heldoutGrounding, heldoutCases } from './quality-heldout.mjs';
import { messagesFor } from './core.mjs';
const worker = new Worker('/assets/llm-worker.mjs', { type: 'module' }); let sequence = 0;
const pending = new Map();
worker.onmessage = ({ data }) => {
  if (data.progress) { document.querySelector('#status').textContent = data.progress.text; return; }
  const item = pending.get(data.id); if (!item) return; pending.delete(data.id);
  data.error ? item.reject(Error(data.error)) : item.resolve(data.result);
};
const call = (op, payload) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); worker.postMessage({ id, op, payload }); });
let lastGenerated;
const runtime = {
  async generate({ messages, responseFormat }) {
    lastGenerated = await call('generate', { messages, responseFormat, maxTokens: 512 });
    return { text: lastGenerated.reply, provenance: { engine: 'WebLLM 0.2.85', model: window.quality.modelId } };
  }, cancel() { return call('cancel'); },
};
// Deliberate evaluation-only bypass: the report must distinguish schema/rule
// acceptance from Italian correctness. Released consumers retain fail-closed.
const heldout = new URLSearchParams(location.search).get('suite') === 'heldout';
const grounding = heldout ? heldoutGrounding : probeGrounding;
const service = createAIService({ runtime, grounding, requireLanguageValidation: false, contextPolicy: { maxContextChars: 10500 } });
window.quality = {
  cases: heldout ? heldoutCases : qualityCases, service,
  async load(modelId, context = 4096) {
    const manifest = await (await fetch('/assets/manifest.json')).json();
    const model = manifest.models.find(m => m.model_id === modelId); if (!model) throw Error('Missing pinned model');
    this.modelId = modelId; this.context = context;
    return call('load', { model, context });
  },
  async run(test, variant = 'grounded') {
    const request = { task: 'conversation', participants: [{ id: 'partner', name: 'Giulia' }], sourceRevision: 1, ...test };
    const started = performance.now(); let response, error, raw, task;
    if (variant === 'plain') {
      task = { messages: messagesFor(request.text, request.level, []), maxTokens: 160 };
      raw = await call('generate', task); response = { message: { participantId: 'partner', text: raw.reply } };
    } else {
      task = prepareTask(request, grounding.retrieve(request), { maxContextChars: 10500 });
      try { response = await service.request(request); } catch (e) { error = String(e.message || e); }
      raw = lastGenerated;
    }
    return { id: test.id, modelId: this.modelId, context: this.context, variant, promptRevision: task.promptRevision, request, messages: task.messages, responseFormat: task.responseFormat,
      raw, response, error, elapsedMs: performance.now() - started, ok: !error, review: test.review };
  },
  async unload() { return call('unload'); },
};
document.querySelector('#status').textContent = 'Quality probe ready; models load only through the explicit runner.';
