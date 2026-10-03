import { RequestQueue, abortError } from './queue.js';
import { createGrounding } from './grounding.js';
import { prepareTask } from './tasks.js';
import { validateResponse, AIValidationError } from './validation.js';
import { indexGroundedVocabulary } from './source-index.js';
import { verifiedTeachingCards } from './teaching.js';
import {resolvePracticeGrounding,authoredExampleCards} from './practice-grounding.js';
import {assertInputSpellingRequest,createInputSpellingValidator,assertValidatedInputSpelling} from './input-spelling.js';
export { RequestQueue, abortError } from './queue.js';
export { createGrounding, levelIncludes, LEVELS } from './grounding.js';
export { prepareTask, RESPONSE_SCHEMA } from './tasks.js';
export { validateResponse, AIValidationError } from './validation.js';
export {INPUT_SPELLING_VERSION,checkedInputSubmission,assertInputSpellingRequest,createInputSpellingValidator,assertValidatedInputSpelling,isValidatedInputSpelling} from './input-spelling.js';

/** Inject an actual local runtime. No fallback generator or model download runs
 * on import. Callers save the learner turn before requesting a partner turn. */
export function createAIService({ runtime, grounding = createGrounding(), contextPolicy, isCurrent = () => true,
  languagePolicy, requireLanguageValidation = true, repairAttempts = 0, practiceSources, inputSpelling } = {}) {
  if (typeof runtime?.generate !== 'function') throw new TypeError('A local runtime is required');
  if (![0, 1].includes(repairAttempts)) throw new TypeError('At most one bounded repair is supported');
  if(inputSpelling!==undefined&&(!inputSpelling||typeof inputSpelling.checkInput!=='function'||typeof inputSpelling.validator?.validate!=='function'))throw new TypeError('Spelling needs an independent checker and validator');
  const unavailableSpelling=createInputSpellingValidator();
  const queue = new RequestQueue({ onCancel: () => runtime.cancel?.() });
  return {
    get state() { return queue.state; },
    request(request, options = {}) {
      // Clone consumer data now; a composer edit cannot mutate pending work.
      const snapshot = structuredClone(request);
      return queue.enqueue(async signal => {
        if (!isCurrent(snapshot)) throw abortError('Stale source revision');
        if (requireLanguageValidation && typeof languagePolicy?.validate !== 'function') throw new AIValidationError(['verified language policy unavailable'], null);
        const spellingSource=assertInputSpellingRequest(snapshot);
        let spelling=null,effectiveRequest=snapshot;
        if(spellingSource){
          let proposal;
          if(inputSpelling)try{proposal=await inputSpelling.checkInput(structuredClone(snapshot),{signal});}
          catch(error){if(error?.name==='AbortError'||signal.aborted)throw error;proposal={status:'unsupported'};}
          if(signal.aborted||!isCurrent(snapshot))throw abortError('Stale source revision');
          spelling=await (inputSpelling?.validator||unavailableSpelling).validate(proposal,{...spellingSource,protectedNames:snapshot.protectedNames||[]});
          if(signal.aborted||!isCurrent(snapshot))throw abortError('Stale source revision');
          assertValidatedInputSpelling(spelling,spellingSource);
          // Keep currentness tied to the immutable original request. Only this
          // verified effective text reaches grounding, generation and checks.
          effectiveRequest={...snapshot,text:spelling.effectiveText};
        }
        const retrieved = snapshot.helpContext ? await resolvePracticeGrounding(snapshot,practiceSources) : grounding.retrieve(effectiveRequest);
        if(signal.aborted||!isCurrent(snapshot))throw abortError('Stale source revision');
        const task = prepareTask(effectiveRequest, retrieved, contextPolicy);
        const attempts = [];
        for (let attempt = 0; attempt <= repairAttempts; attempt++) {
          const generated = await runtime.generate({ ...task, signal });
          if (signal.aborted || !isCurrent(snapshot)) throw abortError('Stale source revision');
          const raw = typeof generated === 'string' ? generated : generated.text;
          try {
            const response = validateResponse(raw, { request: effectiveRequest, grounding: retrieved, participants: task.participants });
            if(snapshot.helpContext&&response.corrections.length)throw new AIValidationError(['Practice help cannot issue a correction verdict.'],raw);
            const language = languagePolicy ? await languagePolicy.validate(response.message.text, { request: effectiveRequest, grounding: retrieved }) : null;
            if (languagePolicy && language?.ok !== true) throw new AIValidationError(language?.reasons || ['language range or construction unresolved'], raw);
            if(response.replySupport){
              // Suggested learner replies need their own language checks.
              // A valid partner sentence says nothing about the frame's grammar.
              if(typeof languagePolicy?.validate!=='function')throw new AIValidationError(['reply support requires a verified language policy'],raw);
              for(const choice of response.replySupport.choices){
                const sentence=response.replySupport.prefix+choice.surface+response.replySupport.suffix;
                const checked=await languagePolicy.validate(sentence,{request:effectiveRequest,grounding:retrieved,purpose:'learner-reply-suggestion',senseId:choice.senseId});
                if(checked?.ok!==true)throw new AIValidationError(checked?.reasons||['reply support is outside verified language coverage'],raw);
              }
              response.replySupport={...response.replySupport,policyVersion:languagePolicy.version,assisted:true};
            }
            if (signal.aborted || !isCurrent(snapshot)) throw abortError('Stale source revision');
            response.vocabulary = indexGroundedVocabulary(retrieved, effectiveRequest.text, response.message.text);
            // Hints cannot expose the complete canonical answer via a card.
            response.teaching = [...verifiedTeachingCards(effectiveRequest, retrieved, response.corrections),...snapshot.task==='hint'?[]:authoredExampleCards(retrieved)];
            if(spelling)response.inputSpelling=spelling;
            response.provenance.practiceSource=retrieved.practiceSource||null;
            response.provenance.vocabularyIndex = 'deterministic verified-sense matches in finalized text';
            response.provenance.languageRangeVerified = language?.ok === true;
            response.provenance.languagePolicyVersion = languagePolicy?.version || null;
            response.provenance.languageCoverage = language ? {senseIds:language.senseIds || [],constructionIds:language.constructionIds || [],exceptionSenseIds:language.exceptionSenseIds || []} : null;
            response.provenance.promptRevision = task.promptRevision;
            response.provenance.runtime = typeof generated === 'object' ? generated.provenance || null : null;
            response.provenance.rejectedAttempts = attempts;
            return response;
          } catch (error) {
            if (!(error instanceof AIValidationError)) throw error;
            attempts.push({ raw, reasons: error.reasons });
            if (attempt === repairAttempts) { error.attempts = attempts; throw error; }
            const note = `\nLa proposta non ha passato questi controlli: ${error.reasons.join('; ').slice(0, 400)}. Genera una risposta più semplice al messaggio originale, rispettando il JSON. Non discutere i controlli.`;
            if (task.contextChars + note.length > (contextPolicy?.maxContextChars || 10000)) { error.attempts = attempts; throw error; }
            task.messages[0].content += note; task.contextChars += note.length;
          }
        }
      }, { ...options, scope: options.scope || snapshot.scope || 'default' });
    },
    cancelScope(scope) { queue.cancelScope(scope); },
    dispose() { queue.dispose(); return runtime.dispose?.(); },
  };
}
