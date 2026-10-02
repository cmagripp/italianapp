// Presentation-only activities. The parent owns persistence, grading and every
// learning event; these helpers never mutate a session or start timers.
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const norm = value => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('it').replace(/[’‘]/g,"'").replace(/\s+/g,' ');
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 500;
const text = value => String(value ?? '').normalize('NFC');
const graphemes = value => typeof Intl.Segmenter === 'function'
  ? [...new Intl.Segmenter('it',{granularity:'grapheme'}).segment(text(value))].map(part=>part.segment)
  : Array.from(text(value));
const unique = values => [...new Set(values)];

function letterData(model) {
  const tiles = (Array.isArray(model?.tiles) ? model.tiles : []).filter(tile=>tile && validId(tile.id) && typeof tile.text==='string').map(tile=>({id:tile.id,text:text(tile.text)}));
  const seen = new Set();
  const bank = tiles.filter(tile=>!seen.has(tile.id)&&seen.add(tile.id));
  const slots = (Array.isArray(model?.slots) ? model.slots : graphemes(model?.answer?.[0] || '').map(char=>/^\s+$/.test(char)?{kind:'fixed',text:char}:{kind:'letter'}))
    .map(slot=>slot?.kind==='fixed'?{kind:'fixed',text:text(slot.text)}:{kind:'letter'});
  return { tiles:bank, slots, count:slots.filter(slot=>slot.kind==='letter').length };
}
function pairData(model) {
  const seen = new Set();
  const pairs = (Array.isArray(model?.pairs)?model.pairs:[]).filter(pair=>pair&&validId(pair.id)&&!seen.has(pair.id)&&seen.add(pair.id))
    .map(pair=>({...pair,targetId:pair.targetId||pair.id,answers:unique((pair.answers||[pair.canonical]).filter(x=>typeof x==='string'&&norm(x))),canonical:text(pair.canonical||pair.answers?.[0]||''),label:text(pair.label)}));
  const ids=new Set(pairs.map(pair=>pair.id));
  const order=unique([...(Array.isArray(model?.leftOrder)?model.leftOrder:[]).filter(id=>ids.has(id)),...ids]);
  const rightSeen=new Set();
  const right=(Array.isArray(model?.rightTiles)?model.rightTiles:[]).filter(tile=>tile&&validId(tile.id)&&typeof tile.text==='string'&&!rightSeen.has(tile.id)&&rightSeen.add(tile.id)).map(tile=>({...tile,text:text(tile.text)}));
  return {pairs:order.map(id=>pairs.find(pair=>pair.id===id)),right};
}
const accepts = (pair,given) => !!pair && pair.answers.some(answer=>norm(answer)===norm(given));
const pairSpeech = (model,pair) => {
  if (model?.meta?.shortWord || !pair) return '';
  const subject=pair.label.split('·')[0].replace(/\s*\([^)]*\)/g,'').trim();
  if (!/^(?:io|tu|lui|lei|noi|voi|loro)(?:\s*\/\s*(?:lui|lei|loro))*$/iu.test(subject)) return '';
  return subject.replace(/\s*\/\s*/g,', ');
};

// Only retain state that refers to this exercise's actual tile identities.
// Repeated letters and homographic verb forms remain independent physical tiles.
export function activityState(model, source = {}) {
  const id=String(model?.id||'');
  const state=source&&source.version===1&&source.id===id&&source.type===model?.type?source:{};
  if(model?.type==='letters'){
    const data=letterData(model), ids=new Set(data.tiles.map(tile=>tile.id));
    const selected=unique((Array.isArray(state.selected)?state.selected:[]).filter(value=>ids.has(value))).slice(0,data.count);
    return {version:1,id,type:'letters',selected,submitted:state.submitted===true&&selected.length===data.count&&data.count>0};
  }
  if(model?.type==='pairs'){
    const {pairs,right}=pairData(model), usedLeft=new Set(),usedRight=new Set(),matches=[];
    for(const match of Array.isArray(state.matches)?state.matches:[]){
      const pair=pairs.find(p=>p.id===match?.leftId),tile=right.find(t=>t.id===match?.rightId);
      if(!pair||!tile||usedLeft.has(pair.id)||usedRight.has(tile.id)||!accepts(pair,tile.text))continue;
      matches.push({leftId:pair.id,rightId:tile.id});usedLeft.add(pair.id);usedRight.add(tile.id);
    }
    const attempts=Object.fromEntries(pairs.map(pair=>[pair.id,Number.isInteger(state.attempts?.[pair.id])&&state.attempts[pair.id]>=0?Math.min(state.attempts[pair.id],100000):0]));
    const leftId=pairs.some(p=>p.id===state.leftId)&&!usedLeft.has(state.leftId)?state.leftId:null;
    const rightId=right.some(t=>t.id===state.rightId)&&!usedRight.has(state.rightId)?state.rightId:null;
    let feedback=null;
    if(state.feedback&&typeof state.feedback.correct==='boolean'){
      const pair=pairs.find(p=>p.id===state.feedback.leftId),tile=right.find(t=>t.id===state.feedback.rightId);
      if(pair&&tile)feedback={leftId:pair.id,rightId:tile.id,correct:accepts(pair,tile.text),given:tile.text,expected:pair.canonical,label:pair.label};
    }
    return {version:1,id,type:'pairs',matches,attempts,leftId,rightId,feedback,complete:pairs.length>0&&matches.length===pairs.length};
  }
  return {version:1,id,type:model?.type||''};
}
export function letterAnswer(model,source) {
  const state=activityState(model,source);
  const {tiles,slots}=letterData(model);let next=0;
  return slots.map(slot=>{if(slot.kind==='fixed')return slot.text;const id=state.selected[next++];return tiles.find(tile=>tile.id===id)?.text||'';}).join('').normalize('NFC');
}

export function activityHTML(model, source = {}, {readOnly=false,review=false} = {}) {
  const state=activityState(model,source);
  if(model?.type==='letters'){
    const {tiles,slots,count}=letterData(model),disabled=readOnly||state.submitted;
    const words=[];let word=[], index=0;
    const finish=()=>{if(word.length){words.push(`<span class="journey-letter-word">${word.join('')}</span>`);word=[];}};
    for(const slot of slots){
      if(slot.kind==='fixed'&&/^\s+$/.test(slot.text)){finish();continue;}
      if(slot.kind==='fixed'){word.push(`<span class="journey-letter-fixed" aria-label="${esc(slot.text)}">${esc(slot.text)}</span>`);continue;}
      const selected=state.selected[index],tile=tiles.find(t=>t.id===selected),at=index++;
      word.push(`<button type="button" class="journey-letter-slot ${tile?'is-filled':'is-empty'}" data-activity-slot="${at}" aria-label="${tile?`Remove ${esc(tile.text)} from position ${at+1}`:`Letter ${at+1}, empty`}" ${disabled||!tile?'disabled':''}>${tile?esc(tile.text):'<span aria-hidden="true">·</span>'}</button>`);
    }
    finish();
    return `<section class="journey-activity is-letters" data-activity="letters" aria-label="Build the Italian answer">
      <p class="journey-note">Tap the letters to complete the answer.</p>
      <div class="journey-letter-answer" lang="it" role="group" aria-label="Your answer">${words.join('<span class="journey-letter-space" aria-hidden="true"> </span>')}</div>
      <div class="journey-letter-bank" lang="it" role="group" aria-label="Available letters">${tiles.map(tile=>{const used=state.selected.includes(tile.id);return `<button type="button" class="journey-letter-tile ${used?'is-used':''}" data-activity-letter="${esc(tile.id)}" aria-label="Add ${esc(tile.text)}" ${disabled||used?'disabled':''}>${esc(tile.text)}</button>`;}).join('')}</div>
      <div class="journey-letter-tools"><button type="button" data-activity-backspace aria-label="Remove the last letter" ${disabled||!state.selected.length?'disabled':''}>⌫ <span>Backspace</span></button><button type="button" data-activity-clear ${disabled||!state.selected.length?'disabled':''}>Clear</button></div>
      <p class="journey-activity-status" data-activity-status role="status" aria-live="polite" aria-atomic="true" tabindex="-1">${state.submitted?'Answer complete.':`${state.selected.length} of ${count} letters placed.`}</p>
    </section>`;
  }
  if(model?.type==='pairs'){
    const {pairs,right}=pairData(model),usedLeft=new Set(state.matches.map(m=>m.leftId)),usedRight=new Set(state.matches.map(m=>m.rightId));
    if(readOnly&&!review&&!state.complete){
      return `<section class="journey-activity is-pairs is-readonly is-revealed" data-activity="pairs" aria-label="Correct matching forms">
        <p class="journey-activity-progress">${state.matches.length} of ${pairs.length} pairs matched before the answer was shown</p>
        <dl class="journey-pair-answer-list">${pairs.map(pair=>`<div class="journey-pair-answer"><dt>${esc(pair.label)}</dt><dd lang="it">${esc(pair.canonical)}</dd></div>`).join('')}</dl>
        <p class="journey-activity-status" data-activity-status role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Here are the matching forms.</p>
      </section>`;
    }
    const labelTile=pair=>{
      const matched=usedLeft.has(pair.id),wrong=state.feedback&&!state.feedback.correct&&state.feedback.leftId===pair.id;
      return `<button type="button" class="journey-pair-tile m journey-pair-label ${state.leftId===pair.id?'is-selected':''} ${wrong?'is-wrong':''} ${matched?'is-matched':''}" data-pair-left="${esc(pair.id)}" aria-label="${esc(pair.label)}${matched?', matched':''}" aria-pressed="${state.leftId===pair.id}" ${readOnly||matched?'disabled':''}><span class="journey-pair-flip"><span class="journey-pair-face journey-pair-front" aria-hidden="true">${esc(pair.label)}</span><span class="journey-pair-face journey-pair-back" aria-hidden="true"><span class="journey-pair-check">✓</span><span class="journey-pair-back-label">Matched</span></span></span></button>`;
    };
    const formTile=tile=>{
      const matched=usedRight.has(tile.id),wrong=state.feedback&&!state.feedback.correct&&state.feedback.rightId===tile.id;
      return `<button type="button" class="journey-pair-tile m journey-pair-form ${state.rightId===tile.id?'is-selected':''} ${wrong?'is-wrong':''} ${matched?'is-matched':''}" data-pair-right="${esc(tile.id)}" lang="it" aria-label="${esc(tile.text)}${matched?', matched':''}" aria-pressed="${state.rightId===tile.id}" ${readOnly||matched?'disabled':''}><span class="journey-pair-flip"><span class="journey-pair-face journey-pair-front" aria-hidden="true">${esc(tile.text)}</span><span class="journey-pair-face journey-pair-back" aria-hidden="true"><span class="journey-pair-check">✓</span><span class="journey-pair-back-label">Matched</span></span></span></button>`;
    };
    const isWord=model.meta?.shortWord===true,isArticle=isWord&&pairs.some(pair=>pair.decoy)||isWord&&pairs.every(pair=>/^(il|lo|la|l'|i|gli|le)$/i.test(String(pair.label||'').trim()));
    const leftName=isArticle?'article':isWord?'label':'person',rightName=isArticle?'noun':'form';
    const message=state.complete?'All pairs matched.':state.feedback?`${state.feedback.correct?'Matched':'Use'}: ${state.feedback.label} → ${state.feedback.expected}${state.feedback.correct?'.':'. Try again.'}`:state.leftId?`Now choose its ${rightName}.`:state.rightId?`Now choose the matching ${leftName}.`:`Choose ${isArticle?'an':'a'} ${leftName} and its matching ${rightName}.`;
    return `<section class="journey-activity is-pairs ${readOnly?'is-readonly':''} ${review?'is-review':''}" data-activity="pairs" aria-label="${isArticle?'Match articles and nouns':isWord?'Match word forms':'Match people and forms'}">
      <p class="journey-activity-progress">${state.matches.length} of ${pairs.length} pairs matched</p>
      <div class="journey-pair-board match-grid"><div class="journey-pair-column" role="group" aria-label="${isArticle?'Articles':isWord?'Labels':'People'}">${pairs.map(labelTile).join('')}</div><div class="journey-pair-column" role="group" aria-label="${isArticle?'Nouns':isWord?'Word forms':'Verb forms'}">${right.map(formTile).join('')}</div></div>
      <p class="journey-activity-status ${state.feedback?.correct?'is-correct':state.feedback?'is-wrong':''}" data-activity-status role="status" aria-live="polite" aria-atomic="true" tabindex="-1">${esc(message)}</p>
    </section>`;
  }
  return '';
}

// The caller applies state before handling answer/pair callbacks. A completed
// letter answer emits once; a matched pair cannot emit another event.
export function activityAction(model, source, action) {
  if(!action||typeof action!=='object')return null;
  const state=activityState(model,source);
  if(model?.type==='letters'){
    if(state.submitted)return null;
    const {tiles,count}=letterData(model);if(!count)return null;
    let focus=null;
    if(action.type==='letter'){
      const tile=tiles.find(t=>t.id===action.id);
      if(!tile||state.selected.includes(tile.id)||state.selected.length>=count)return null;
      state.selected.push(tile.id);
      const next=tiles.find(t=>!state.selected.includes(t.id));focus=next?{kind:'letter',id:next.id}:{kind:'status'};
    } else if(action.type==='slot'){
      if(!Number.isInteger(action.index)||action.index<0||action.index>=state.selected.length)return null;
      focus={kind:'letter',id:state.selected.splice(action.index,1)[0]};
    } else if(action.type==='backspace'){
      if(!state.selected.length)return null;
      focus={kind:'letter',id:state.selected.pop()};
    } else if(action.type==='clear'){
      if(!state.selected.length)return null;
      state.selected=[];focus={kind:'letter',id:tiles[0]?.id};
    } else return null;
    if(state.selected.length===count){state.submitted=true;return {state,answer:letterAnswer(model,state),complete:true,focus:{kind:'status'}};}
    return {state,complete:false,focus};
  }
  if(model?.type==='pairs'){
    if(state.complete)return null;
    const {pairs,right}=pairData(model),usedLeft=new Set(state.matches.map(m=>m.leftId)),usedRight=new Set(state.matches.map(m=>m.rightId));
    let focus,speech='';
    if(action.type==='pair-left'){
      const selected=pairs.find(pair=>pair.id===action.id);
      if(!selected||usedLeft.has(action.id))return null;
      state.leftId=state.leftId===action.id?null:action.id;
      speech=pairSpeech(model,selected);
      focus={kind:'right',id:state.rightId||right.find(tile=>!usedRight.has(tile.id))?.id};
    } else if(action.type==='pair-right'){
      if(!right.some(tile=>tile.id===action.id)||usedRight.has(action.id))return null;
      state.rightId=state.rightId===action.id?null:action.id;
      focus={kind:'left',id:state.leftId||pairs.find(pair=>!usedLeft.has(pair.id))?.id};
    } else return null;
    state.feedback=null;
    if(!state.leftId||!state.rightId)return {state,complete:false,focus,speech};
    const pair=pairs.find(p=>p.id===state.leftId),tile=right.find(t=>t.id===state.rightId),correct=accepts(pair,tile.text),attempt=state.attempts[pair.id]||0;
    state.attempts[pair.id]=attempt+1;
    state.feedback={leftId:pair.id,rightId:tile.id,correct,given:tile.text,expected:pair.canonical,label:pair.label};
    if(correct){state.matches.push({leftId:pair.id,rightId:tile.id});usedLeft.add(pair.id);usedRight.add(tile.id);}
    state.leftId=null;state.rightId=null;state.complete=state.matches.length===pairs.length;
    focus=state.complete?{kind:'status'}:{kind:'left',id:correct?pairs.find(p=>!usedLeft.has(p.id))?.id:pair.id};
    return {state,complete:state.complete,focus,speech,pair:{leftId:pair.id,rightId:tile.id,targetId:pair.targetId,given:tile.text,correct,expected:pair.canonical,attempt}};
  }
  return null;
}

export function activityActionFromButton(button) {
  if(!button||button.disabled)return null;
  if(button.hasAttribute('data-activity-letter'))return {type:'letter',id:button.dataset.activityLetter};
  if(button.hasAttribute('data-activity-slot'))return {type:'slot',index:Number(button.dataset.activitySlot)};
  if(button.hasAttribute('data-activity-backspace'))return {type:'backspace'};
  if(button.hasAttribute('data-activity-clear'))return {type:'clear'};
  if(button.hasAttribute('data-pair-left'))return {type:'pair-left',id:button.dataset.pairLeft};
  if(button.hasAttribute('data-pair-right'))return {type:'pair-right',id:button.dataset.pairRight};
  return null;
}

export function focusActivity(root, focus) {
  if(!root||!focus)return;
  const selector={letter:'[data-activity-letter]',left:'[data-pair-left]',right:'[data-pair-right]',status:'[data-activity-status]'}[focus.kind];
  if(!selector)return;
  const key={letter:'activityLetter',left:'pairLeft',right:'pairRight'}[focus.kind];
  const node=[...root.querySelectorAll(selector)].find(button=>!button.disabled&&!button.hidden&&(focus.kind==='status'||button.dataset[key]===focus.id));
  node?.focus({preventScroll:true});
}
