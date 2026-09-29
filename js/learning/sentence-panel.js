// A local, offline word inspector. Opening a definition never submits an answer.
import { html, raw, icon, speak } from '../ui.js';
import { data } from '../data.js';
import { createSentenceLookup, tokenizeItalianSentence } from './sentence-lookup.js';

export function createSentencePanel(root, { context = () => ({}), onReveal = () => {} } = {}) {
  let lookup, origin, disposed = false;
  const dialog = document.createElement('dialog');
  dialog.className = 'journey-word-dialog';
  dialog.setAttribute('aria-labelledby','journey-word-title');
  document.body.append(dialog);
  const close = () => { if (dialog.open) dialog.close(); };
  function candidateHTML(candidate) {
    const noun = candidate.pos === 'noun', verb = candidate.pos === 'verb';
    const part = {pron:'Pronoun',det:'Article / determiner',prep:'Preposition',conj:'Conjunction',adv:'Adverb',adj:'Adjective',num:'Number',interj:'Interjection'}[candidate.pos] || candidate.pos || 'Word';
    const matches = (candidate.matches || []).filter(m=>m.contextMatched);
    const readings = matches.length ? matches : candidate.matches || [];
    const matchLabels = [...new Set(readings.map(m=>[m.tenseLabel || m.kind,m.personLabel].filter(Boolean).join(' · ')))].slice(0,6);
    return html`<article class="journey-definition">
      <div class="journey-kicker">${noun ? `Noun${candidate.genderLabel ? ` · ${candidate.genderLabel}` : ''}` : verb ? 'Verb' : part}</div>
      <h3>${candidate.label || candidate.word}</h3><p class="journey-definition-meaning">${candidate.meaning}</p>
      ${noun ? raw(html`<dl class="journey-word-forms"><div><dt>Singular</dt><dd lang="it">${candidate.singular || '—'}</dd></div><div><dt>Plural</dt><dd lang="it">${candidate.plural || '—'}</dd></div></dl>${candidate.numberNote ? raw(html`<p class="journey-note">${candidate.numberNote}</p>`) : ''}`) : ''}
      ${verb ? raw(html`<p class="journey-definition-infinitive">Infinitive <strong lang="it">${candidate.infinitive}</strong></p>${matchLabels.length ? raw(html`<p class="journey-note">${matchLabels.join(' / ')}</p>`) : ''}
        <details class="journey-word-conjugations"><summary>Verb forms</summary>${raw((candidate.forms || []).map(tense=>html`<h4>${tense.label}</h4><dl class="journey-word-forms">${raw(tense.forms.map(row=>html`<div><dt>${row.personLabel}</dt><dd lang="it">${row.form}</dd></div>`).join(''))}</dl>`).join(''))}</details>`) : ''}
      ${candidate.note ? raw(html`<p class="journey-note">${candidate.note}</p>`) : ''}
    </article>`;
  }
  function open(button) {
    if (disposed) return;
    origin = button;
    const sentence = button.closest('[data-italian-sentence],.sentence');
    const ctx = context(sentence) || {};
    if (!lookup) {
      const entries=[...data.byId.values()];
      lookup=createSentenceLookup({vocab:entries.filter(e=>e.kind!=='verb'),verbs:entries.filter(e=>e.kind==='verb')});
    }
    const result = lookup(button.dataset.lookupWord, { ...ctx, sentence:sentence?.textContent || ctx.sentence || '' });
    onReveal(result);
    const candidates = result.candidates || [];
    dialog.innerHTML = html`<header class="journey-word-heading"><div><span class="journey-kicker">Word by word</span><h2 id="journey-word-title" lang="it">${result.token}</h2></div><button type="button" class="journey-word-close" data-word-close aria-label="Close word meaning" autofocus>${raw(icon('x',{size:21}))}</button></header>
      <div class="journey-word-content">
        ${result.contraction ? raw(html`<p class="journey-contraction"><strong>${result.contraction.prefix}</strong> + ${result.contraction.base} <span>${result.contraction.meaning}</span></p>`) : ''}
        ${result.status === 'ambiguous' ? raw('<p class="journey-note">This form can have more than one meaning. Use the sentence to choose.</p>') : ''}
        ${raw(candidates.map(candidateHTML).join(''))}
        ${!candidates.length ? raw(html`<p class="journey-note">${result.message || 'A word-level definition is not available yet.'}</p>${result.sentence?.en ? raw(html`<div class="journey-definition"><span class="journey-kicker">Sentence meaning</span><p>${result.sentence.en}</p></div>`) : ''}`) : ''}
      </div><footer class="journey-word-footer"><button type="button" data-word-say="${result.token}">${raw(icon('speaker',{size:18}))} Listen</button><button type="button" data-word-close>Back to the lesson</button></footer>`;
    dialog.showModal();
  }
  // Tokenize only Italian sentence text; leave blanks, punctuation and existing
  // controls untouched. Native buttons keep every word keyboard-accessible.
  function decorate() {
    close();
    for (const sentence of root.querySelectorAll('[data-italian-sentence],.journey-prompt .sentence')) {
      if (sentence.dataset.wordLookupReady) continue;
      sentence.dataset.wordLookupReady = 'true';
      const walker = document.createTreeWalker(sentence, NodeFilter.SHOW_TEXT);
      const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if(node.parentElement.closest('button,.blank')) continue;
        const fragment=document.createDocumentFragment();
        for(const token of tokenizeItalianSentence(node.textContent)) {
          if(token.type!=='word') {fragment.append(document.createTextNode(token.text));continue;}
          const button=document.createElement('button');button.type='button';button.className='journey-word';
          button.dataset.lookupWord=token.text;button.textContent=token.text;
          button.setAttribute('aria-label',`Meaning of ${token.text}`);button.setAttribute('aria-haspopup','dialog');
          fragment.append(button);
        }
        node.replaceWith(fragment);
      }
      if(sentence.querySelector('[data-lookup-word]')) sentence.classList.add('journey-tappable-sentence');
    }
  }
  const click = event => {
    const button=event.target.closest('[data-lookup-word]');
    if(button && root.contains(button)) open(button);
  };
  const dialogClick = event => {
    const button=event.target.closest('button');
    if(button?.hasAttribute('data-word-close')) close();
    else if(button?.hasAttribute('data-word-say')) speak(button.dataset.wordSay,{force:true});
    else if(event.target===dialog) {const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}
  };
  const closed=()=>{if(origin?.isConnected)origin.focus({preventScroll:true});};
  root.addEventListener('click',click);dialog.addEventListener('click',dialogClick);dialog.addEventListener('close',closed);
  return { decorate, close, destroy(){disposed=true;close();root.removeEventListener('click',click);dialog.removeEventListener('click',dialogClick);dialog.removeEventListener('close',closed);dialog.remove();} };
}
