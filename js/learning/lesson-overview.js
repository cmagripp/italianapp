// The verb hub is a presentation of durable case progress. It does not infer
// readiness from a visited page, mutate a lesson, or create learning evidence.
import { icon } from '../icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paragraphs = value => (Array.isArray(value)?value:[value]).filter(text=>typeof text==='string'&&text.trim());
const CASES = [
  {id:'present',label:'Present',italian:'Presente',cue:'Routines and actions happening now'},
  {id:'past',label:'Completed past',italian:'Passato prossimo',cue:'What happened'},
  {id:'background',label:'Past background',italian:'Imperfetto',cue:'What was happening or used to happen'},
  {id:'future',label:'Future',italian:'Futuro semplice',cue:'What will happen'},
  {id:'condizionale',label:'Conditional',italian:'Condizionale presente',cue:'Wishes, polite requests and possibilities'},
];

export function lessonOverviewHTML({entry,plan,progress,session}={}) {
  if(!entry||!plan)return '';
  const chapters=Array.isArray(plan.chapters)?plan.chapters:[];
  const rows=Array.isArray(progress)?progress:Array.isArray(progress?.cases)?progress.cases:Array.isArray(progress?.chapters)?progress.chapters:[];
  const cards=CASES.map(info=>({...info,chapter:chapters.find(chapter=>chapter.id===info.id),progress:rows.find(row=>row.id===info.id)}));
  const complete=cards.filter(card=>card.progress?.ready===true).length;
  const meet=chapters.find(chapter=>chapter.id==='meet')?.groups?.flatMap(group=>group.cards||[]).find(card=>card.id==='meaning')
    ||chapters.find(chapter=>chapter.id==='meet')?.groups?.flatMap(group=>group.cards||[])[0];
  const title=meet?.title||plan.title||entry.inf||entry.it||'';
  const body=paragraphs(meet?.body?.length?meet.body:plan.meaning||entry.en);
  const notes=paragraphs(meet?.notes);
  const example=meet?.examples?.find(example=>typeof example.it==='string'&&example.it.trim());
  const current=cards.find(card=>card.id===session?.journey?.chapterId);
  const resume=session?.entryId===entry.id&&current&& !['recap','complete'].includes(session.journey.phase)
    && (current.progress?.started===true||session.index>0||session.journey.groupIndex>0||session.journey.cardIndex>0||session.journey.phase!=='teach');
  const extras=chapters.filter(chapter=>chapter.optional===true&&chapter.id!=='mixed'&&!CASES.some(info=>info.id===chapter.id));
  const mixed=progress?.mixedAvailable===true&&chapters.find(chapter=>chapter.id==='mixed');
  return `<section class="journey-overview" aria-label="Verb lesson overview">
    <div class="journey-overview-intro journey-teaching is-meet">
      <div class="journey-kicker">Your verb, five useful lessons</div>
      <div class="journey-intro"><div class="journey-intro-title"><h1 data-focus tabindex="-1">${esc(title)}</h1><button type="button" class="journey-hero-audio" data-say="${esc(entry.inf||entry.it||title)}" aria-label="Listen to ${esc(title)}">${icon('speaker',{size:25})}</button><button type="button" class="icon-btn completion-toggle${progress?.complete?' is-complete':''}" data-completion-menu aria-haspopup="menu" aria-expanded="false" aria-label="Update completion for ${esc(entry.inf||title)}" title="Update completion">${icon('check',{size:20})}</button></div>
        ${body.map(text=>`<p>${esc(text)}</p>`).join('')}</div>

    </div>
    <div class="journey-overview-progress"><p><strong>${complete} of ${progress?.total??CASES.length}</strong> tenses completed</p><span aria-hidden="true">${cards.map(card=>`<span class="journey-overview-progress-mark ${card.progress?.ready===true?'is-complete':''}"></span>`).join('')}</span></div>
    ${resume?`<button type="button" class="btn primary journey-overview-resume" data-resume-lesson>${icon('play',{size:17})}<span>Resume ${esc(current.italian)}</span></button>`:''}
    <div class="journey-tense-grid" aria-label="Choose a tense">${cards.map((card,index)=>{
      const ready=card.progress?.ready===true,started=card.progress?.started===true,available=card.progress?.available!==false;
      const status=!available?'Not used here':ready?'Complete':started?'In progress':'Ready to learn';
      const action=ready?'Practise again':started?'Continue this tense':'Learn this tense';
      return `<article class="journey-tense-card glass-flat ${ready?'is-complete':started?'is-started':''}" data-tense-case="${card.id}" aria-labelledby="journey-tense-${card.id}">
        <div class="journey-tense-top"><span class="journey-tense-number qi" aria-hidden="true">${ready?icon('check',{size:19}):index+1}</span><span class="journey-tense-status">${status}</span></div>
        <h2 id="journey-tense-${card.id}">${card.label}</h2><p class="journey-tense-italian" lang="it">${card.italian}</p><p class="journey-tense-cue">${esc(available?card.cue:card.progress?.limitation||'This form is not normally used for this verb.')}</p>
        <button type="button" class="journey-tense-action" ${ready?'data-redo-lesson':'data-open-lesson'}="${card.id}" aria-label="${esc(action)}: ${card.italian}" ${card.chapter&&available?'':'disabled'}><span>${action}</span>${icon('chevronRight',{size:18})}</button>
      </article>`;
    }).join('')}</div>
    <details class="journey-overview-meaning"><summary>Meaning and examples ${icon('chevronDown',{size:17})}</summary><div>
      ${notes.length?`<aside class="journey-insight"><div class="journey-insight-heading">${icon('sparkle',{size:18})}<span>Remember</span></div>${notes.map(note=>`<p>${esc(note)}</p>`).join('')}</aside>`:''}
      ${example?`<article class="journey-example" data-example-key="${esc(`${example.it}|${example.en||''}`)}"><span class="journey-example-kicker">In conversation</span><div class="journey-example-line"><p lang="it" data-italian-sentence>${esc(example.it)}</p><button type="button" class="journey-audio" data-say="${esc(example.it)}" aria-label="Listen to the example">${icon('speaker',{size:19})}</button></div>${example.en?`<button type="button" class="journey-translation-toggle" data-translation-toggle aria-controls="journey-overview-translation" aria-expanded="true">Hide translation</button><p class="journey-translation" id="journey-overview-translation" data-translation>${esc(example.en)}</p>`:''}</article>`:''}
    </div></details>
    ${mixed||extras.length?`<section class="journey-overview-extras" aria-label="More practice"><h2>Keep exploring</h2>
      ${mixed?`<button type="button" class="btn secondary" data-open-lesson="mixed">Mix your tenses ${icon('chevronRight',{size:17})}</button>`:''}
      ${extras.length?`<details class="journey-overview-more"><summary>More tenses</summary><div>${extras.map(chapter=>`<button type="button" class="btn ghost" data-open-lesson="${esc(chapter.id)}">${esc(chapter.title)}</button>`).join('')}</div></details>`:''}
    </section>`:''}
  </section>`;
}
