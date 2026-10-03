// Flashcards with self-grading (SRS quality 1–5): 3D flip glass card over a peeking deck, four-button rate bar,
// optional swipe (left = Again, right = Good) once the card is flipped.
import { html, raw, icon, speak, stopSpeech, haptic } from '../ui.js';
import { store } from '../store.js';
import { headword, shortEn, withArticle, isPluralOnly, hasPluralForm, nounNumberNote } from '../data.js';
import { conjugate, primary, MISSING } from '../conjugator.js';
import { showResults, gameTop, gameActivityFence } from './engine.js';
import fx from '../fx.js';
import {isStarred as entryIsStarred,toggleStarred} from '../learning/collections.js';

export function startFlashcards(root, ctx) {
  const items = ctx.items.slice();
  const total = items.length;
  const owner = store.current.id, start = Date.now(), active = gameActivityFence(ctx.isActive);
  const ratings = Array(total).fill(null), faces = Array(total).fill(false), revealed = Array(total).fill(false);
  let i = 0, completed = 0, dead = false, finished = false, pending = null, screen = null;
  const dir = ctx.options?.dir || 'it-en';
  const ratingNames = { 1: 'Again', 3: 'Hard', 4: 'Good', 5: 'Easy' };
  const owned = () => !dead && active() && store.current.id === owner && (!screen || root.contains(screen));
  const isStarred = id => entryIsStarred(store,id);

  const kicker = (e) => `${e.level || 'A1'} · ${e.kind === 'verb' ? 'verbo' : e.pos}${e.pos === 'noun' ? ' · ' + (e.g === 'mf' ? 'm/f' : e.g) : ''}`;
  function front(e) {
    const w = e.kind === 'verb' ? e.inf : headword(e);
    const ghost = html`<span class="ghost" aria-hidden="true">${(e.kind === 'verb' ? e.inf : e.it || w).slice(0, 1)}</span>`;
    if (dir === 'en-it') return html`${raw(ghost)}<div class="fc-kicker kicker">${kicker(e)}</div><div class="en">${shortEn(e.en)}</div><div class="hint">tap to flip</div>`;
    return html`${raw(ghost)}<div class="fc-kicker kicker">${kicker(e)}</div><div class="word ${w.length > 14 ? 'long' : w.length > 9 ? 'mid' : ''}">${w}</div><div class="hint">tap to flip</div>`;
  }
  function back(e) {
    const numberNote = nounNumberNote(e);
    const plural = numberNote ? html`<div class="ex">${numberNote.split('.')[0]}.</div>` : hasPluralForm(e) ? html`<div class="ex">pl. ${withArticle(e, true)}</div>` : '';
    if (dir === 'en-it') {
      const w = e.kind === 'verb' ? e.inf : headword(e);
      return html`<div class="word ${w.length > 14 ? 'long' : ''}">${w}</div>${raw(plural)}<div class="ex">${e.kind === 'verb' ? (e.examples?.[0]?.it || '') : (e.ex || '')}</div>`;
    }
    let extra;
    if (e.kind === 'verb') {
      const pp = primary(conjugate(e.inf, { aux: e.aux, isc: e.isc }).nonFinite.participioPassato);
      extra = html`<div class="ex mono-line">${e.aux}${pp && pp !== MISSING ? ' · ' + pp : ''}</div><div class="ex">${e.examples?.[0]?.it || ''}<br><span class="muted">${e.examples?.[0]?.en || ''}</span></div>`;
    } else extra = html`${raw(plural)}<div class="ex">${e.ex || ''}<br><span class="muted">${e.exEn || ''}</span></div>`;
    return html`<div class="en">${e.en}</div>${raw(extra)}`;
  }
  function render() {
    if (!owned() || finished) return;
    const e = items[i];
    if (!e) return finish();
    const reviewing = ratings[i] !== null;
    let flipped = faces[i], locked = false;
    const say = e.kind === 'verb' ? e.inf : (e.pos === 'noun' && !isPluralOnly(e) ? withArticle(e) : e.it);
    const starred = isStarred(e.id);
    root.innerHTML = html`<section class="flash-session" data-flash-session data-card-index="${i}" data-flash-mode="${reviewing?'history':'current'}">
      ${raw(gameTop(ctx.backHref, { i, total, completed }))}
      <nav class="flash-history" aria-label="Flashcard history">
        <button type="button" class="btn sm ghost" data-previous ${i===0?raw('disabled'):''}>${raw(icon('chevron',{size:18}))} Previous</button>
        ${reviewing?raw(html`<span class="flash-rating-saved">Rated ${ratingNames[ratings[i]]}</span><button type="button" class="btn sm ghost" data-forward>${i+1===completed?'Resume':'Next'} ${raw(icon('chevronRight',{size:18}))}</button>`):raw('<span class="flash-rating-saved">Flip, then rate</span>')}
      </nav>
      <section class="flash ${flipped?'flipped':''}" data-flash aria-label="Flashcard" style="--fc:var(--lvl-${e.level || 'A1'})">
        <div class="flash-card-tools">
          <button type="button" class="btn sm ghost" data-hear aria-label="Hear ${say}">${raw(icon('speaker',{size:18}))}<span>Hear</span></button>
          <a class="btn sm ghost" data-details href="#/entry/${encodeURIComponent(e.id)}">${raw(icon('book',{size:18}))}<span>Details</span></a>
          <button type="button" class="btn sm ghost flash-star ${starred?'is-starred':''}" data-star aria-pressed="${starred}" aria-label="${starred?'Remove from':'Add to'} Starred">${raw(icon('star',{size:19}))}<span>${starred?'Starred':'Star'}</span></button>
        </div>
        <span class="swipe-tag left" aria-hidden="true">Again</span><span class="swipe-tag right" aria-hidden="true">Good</span>
        <button type="button" class="flash-flip" data-flip aria-pressed="${flipped}">
          <span class="inner">
            <span class="face front" aria-hidden="${flipped}">${raw(front(e))}</span>
            <span class="face back" aria-hidden="${!flipped}">${raw(back(e))}</span>
          </span>
        </button>
      </section>
      <div class="grade" data-grade style="visibility:${revealed[i]||reviewing?'visible':'hidden'}" role="group" aria-label="${reviewing?'Your saved rating':'How well did you know it?'}">
        ${raw([[1,'Again','forgot'],[3,'Hard','barely'],[4,'Good','knew it'],[5,'Easy','instantly']].map(([q,label,detail])=>html`<button type="button" class="btn secondary ${ratings[i]===q?'is-selected':''}" data-q="${q}" aria-pressed="${ratings[i]===q}" ${reviewing?raw('disabled'):''}>${label}<small>${detail}</small></button>`).join(''))}
      </div>
      <p class="flash-hint kicker" data-hint-line role="status">${reviewing?'Your original rating is saved. Continue when you’re ready.':revealed[i]?'Rate it — or swipe left for Again, right for Good':'Flip the card, then rate how well you knew it'}</p>
    </section>`;
    screen = root.querySelector('[data-flash-session]');
    fx.mount(root);
    const card = root.querySelector('[data-flash]');
    const flipButton = root.querySelector('[data-flip]');
    const gradeBar = root.querySelector('[data-grade]');
    const hintLine = root.querySelector('[data-hint-line]');
    const active = () => owned() && !finished && root.contains(card) && !locked;
    function flipLabel() {
      const visible = flipped ? dir==='it-en'?e.en:say : dir==='it-en'?say:shortEn(e.en);
      flipButton.setAttribute('aria-label',`${visible}. ${flipped?'Show front':'Show answer'}`);
    }
    function flip() {
      if (!active()) return;
      flipped = !flipped;
      faces[i] = flipped; revealed[i] ||= flipped;
      card.classList.toggle('flipped', flipped);
      flipButton.setAttribute('aria-pressed',String(flipped));
      card.querySelector('.front').setAttribute('aria-hidden',String(flipped));
      card.querySelector('.back').setAttribute('aria-hidden',String(!flipped));
      flipLabel();
      gradeBar.style.visibility = revealed[i] || reviewing ? 'visible' : 'hidden';
      if (!reviewing) hintLine.textContent = 'Rate it — or swipe left for Again, right for Good';
      if (flipped && dir === 'en-it') speak(say);
    }
    function grade(q, { delay = 0 } = {}) {
      if (!active() || reviewing || ratings[i]!==null || !revealed[i] || !Object.hasOwn(ratingNames,q)) return;
      locked = true; ratings[i] = q; completed++;
      const ok = q >= 3;
      haptic(ok ? 'success' : 'error');
      store.recordAnswer(e.id, ok, { quality: q, xp: ok ? 2 : 0 });
      for(const button of screen.querySelectorAll('button'))button.disabled=true;
      const top=screen.querySelector('.game-top');
      if(top)top.outerHTML=gameTop(ctx.backHref,{i,total,completed});
      const next=()=>{pending=null;if(!owned()||finished)return;i=completed;render();};
      if(delay)pending=setTimeout(next,delay);else next();
    }
    gradeBar.addEventListener('click', (ev) => { const b = ev.target.closest('[data-q]'); if (b) grade(Number(b.dataset.q)); });
    root.querySelector('[data-previous]').addEventListener('click',()=>{if(active()&&i>0){i--;render();root.querySelector('[data-flip]')?.focus({preventScroll:true});}});
    root.querySelector('[data-forward]')?.addEventListener('click',()=>{if(active()&&reviewing){i++;render();root.querySelector('[data-flip]')?.focus({preventScroll:true});}});
    root.querySelector('[data-hear]').addEventListener('click',ev=>{if(active())speak(say,{force:true,button:ev.currentTarget});});
    root.querySelector('[data-star]').addEventListener('click',ev=>{
      if(!active())return;
      const starred=isStarred(e.id);toggleStarred(store,e.id);
      const button=ev.currentTarget;
      button.classList.toggle('is-starred',!starred);button.setAttribute('aria-pressed',String(!starred));
      button.setAttribute('aria-label',`${starred?'Add to':'Remove from'} Starred`);button.querySelector('span').textContent=starred?'Star':'Starred';
      void store.saveNow().catch(()=>{}); // The persistent save warning owns retry/export.
    });
    flipLabel();

    // tap = flip; horizontal swipe (after the flip) = grade
    let pid = null, sx = 0, sy = 0, dx = 0, moved = false, suppressClick = false;
    const reduced = fx.reducedMotion();
    flipButton.addEventListener('pointerdown', (ev) => {
      if (!active() || ev.pointerType === 'mouse' && ev.button !== 0) return;
      pid = ev.pointerId; sx = ev.clientX; sy = ev.clientY; dx = 0; moved = false; suppressClick = false;
      card.classList.add('dragging');
      try { flipButton.setPointerCapture(pid); } catch { /* ignore */ }
    });
    flipButton.addEventListener('pointermove', (ev) => {
      if (pid === null || ev.pointerId !== pid) return;
      dx = ev.clientX - sx; const dy = ev.clientY - sy;
      if(Math.max(Math.abs(dx),Math.abs(dy))>8)suppressClick=true;
      if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) moved = true;
      if (!moved || !flipped || reviewing) return;
      card.style.transform = `translateX(${dx}px) rotate(${(dx / 22).toFixed(2)}deg)`;
      card.dataset.swipe = dx > 40 ? 'right' : dx < -40 ? 'left' : '';
    });
    const up = (ev) => {
      if (pid === null || ev.pointerId !== pid) return;
      pid = null; card.classList.remove('dragging');
      const swiped = ev.type !== 'pointercancel' && active() && !reviewing && moved && flipped && Math.abs(dx) > 90;
      if (swiped) {
        card.style.transform = `translateX(${dx > 0 ? 140 : -140}%) rotate(${dx > 0 ? 18 : -18}deg)`;
        card.style.opacity = '0';
        grade(dx > 0 ? 4 : 1, { delay: reduced ? 0 : 260 });
      } else { card.style.transform = ''; card.dataset.swipe = ''; }
      if(ev.type==='pointercancel')suppressClick=true;
    };
    flipButton.addEventListener('pointerup', up);
    flipButton.addEventListener('pointercancel', up);
    flipButton.addEventListener('click',ev=>{if(suppressClick&&ev.detail!==0){suppressClick=false;return;}suppressClick=false;flip();});
    if (dir === 'it-en' && !reviewing) speak(say);
  }
  function finish() {
    if(!owned()||finished)return;
    finished=true;
    const correct=ratings.filter(q=>q>=3).length,missed=items.filter((_,index)=>ratings[index]===1).map(e=>e.id);
    const result = { gameId: 'flashcards', total, correct, wrong: total - correct, score: total ? Math.round((correct / total) * 100) : 0, missed, secs: Math.round((Date.now() - start) / 1000) };
    result.xp = correct * 2;
    // recordAnswer already awarded 2 XP per card rated Hard or better: the game record adds nothing more
    store.recordGame('flashcards', { ...result, xp: 0 });
    showResults(root, result, { backHref: ctx.backHref, onReplay: ctx.replay, onPractice: ctx.practice });
  }
  render();
  return () => { dead=true;clearTimeout(pending);pending=null;stopSpeech(); };
}
