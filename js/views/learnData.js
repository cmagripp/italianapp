// Learn hub model: one plain, serialisable object with everything the dashboard and the sections views show.
// Every value is derived from the same modules the course page and the lesson views use, so the hub never
// disagrees with the screens it links to.
import { store as appStore } from '../store.js';
import { data, itemsForScope, describeScope, LEVEL_INFO, getEntry, headword } from '../data.js';
import { relTime } from '../ui.js';
import { dailyPlan } from '../learning/daily-plan.js';
import { practiceHref, lessonSessions, lessonPlan, reviewItems, eligibleSkills } from '../learning/integration.js';
import { grammarCourse, grammarLesson, grammarProgress, grammarHref, courseLevel, nextGrammarLesson, grammarSessions, relatedVocabulary } from '../learning/grammar-course.js';
import { courseSessionProgress } from '../learning/course-v2-engine.js';
import { journeyChapterCompletions, journeyCaseProgress } from '../learning/journey.js';
import { labLessonTotal, loadSentenceLab } from '../learning/sentence-lab-data.js';

export const LEARN_VIEW_KEY = 'learnView';
export const MODE_KEY = 'learnMode';
export const QUEUE_KEY = 'course:everyday|course';

// Hub preferences: the learning domain keeps a closed list of keys, so anything it does not accept falls back to
// a per-profile localStorage slot (a per-device convenience, never evidence).
const slot = (store, key) => `it.pref.${store?.current?.id || 'default'}.${key}`;
export function readPref(store, key, fallback) {
  const v = store?.learning?.preferences?.[key];
  if (v !== undefined && v !== null) return v;
  try { const raw = localStorage.getItem(slot(store, key)); if (raw != null) return JSON.parse(raw); } catch { /* storage blocked */ }
  return fallback;
}
export function writePref(store, key, value) {
  try { store.setLearningPreference(key, value); } catch { /* read-only domain */ }
  if (store?.learning?.preferences?.[key] === value) return value;
  try { localStorage.setItem(slot(store, key), JSON.stringify(value)); } catch { /* storage blocked */ }
  return value;
}

// deterministic-ish ordering of new items within the scope: by level, then rotate by category so the user sees variety
export function nextNew(kind, n = 5, store = appStore) {
  const items = itemsForScope(store.scope, store, { kind }).filter(e => !store.isLearned(e.id));
  const byCat = {};
  for (const e of items) (byCat[e.level + '|' + e.cat] ||= []).push(e);
  const keys = Object.keys(byCat).sort();
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 1000) {
    let added = false;
    for (const k of keys) { const arr = byCat[k]; if (arr.length) { out.push(arr.shift()); added = true; if (out.length >= n) break; } }
    if (!added) break;
  }
  return out;
}

const pct = (a, b) => Math.max(0, Math.min(100, Math.round((a / Math.max(1, b)) * 100)));
const MODE_OF_KIND = { session: 'together', grammar: 'grammar', verb: 'verbs', word: 'words' };

export function learnModel(store, now = Date.now()) {
  const learning = store.learning, s = store.settings, day = store.today();
  const level = courseLevel(store);
  const next = nextGrammarLesson(store);
  const queue = learning.sessions?.[QUEUE_KEY];
  const queueLive = !!(queue?.course && !queue.course.finished);
  const inQueue = id => queueLive && queue.course.items.some(item => item.id === id);
  const queued = (href, id) => inQueue(id) ? href + (href.includes('?') ? '&' : '?') + 'courseSession=1' : href;

  // ---- stage (course level, units, lessons) ----
  const lessons = grammarCourse.lessons.filter(l => l.level === level);
  const complete = lesson => grammarProgress(lesson, learning, now).complete;
  const pack = grammarCourse.levels.find(l => l.level === level);
  const units = (pack?.units || []).map(unit => {
    const ls = unit.lessons.map(l => grammarLesson(l.id)).filter(Boolean);
    return { id: unit.id, title: unit.title, done: ls.filter(complete).length, total: ls.length, current: !!next && ls.some(l => l.id === next.id) };
  });
  const stage = { level, name: LEVEL_INFO[level]?.name || 'Start from zero', lessonsDone: lessons.filter(complete).length, lessonsTotal: lessons.length,
    units, currentUnitTitle: units.find(u => u.current)?.title || next?.unitTitle || null, href: '#/course' };

  // ---- in progress: grammar lessons, verb / word lessons, the saved combined session ----
  const inProgress = [];
  for (const session of grammarSessions(store)) {
    const lesson = grammarLesson(session.entryId);
    const p = session.courseV2 && lesson.targets ? courseSessionProgress(lesson, session, learning, now).percent : (() => { const g = grammarProgress(lesson, learning, now); return pct(g.completed, g.total); })();
    inProgress.push({ kind: 'grammar', title: lesson.title, sub: `Grammar · ${lesson.unitTitle || lesson.level}`, pct: Math.min(99, p), href: queued(grammarHref(lesson), lesson.id), updatedAt: session.updatedAt || 0 });
  }
  for (const x of lessonSessions(store)) {
    if (x.step.type === 'complete' || x.progress.complete) continue;
    const { entry, session, progress } = x;
    let p, sub;
    if (entry.kind === 'verb') {
      const cases = journeyCaseProgress(lessonPlan(entry), learning, session, now);
      const cur = progress.chapters.find(c => c.id === progress.currentChapterId);
      const partial = cur && !cases.cases.find(c => c.id === cur.id)?.ready ? cur.ready / Math.max(1, cur.total) : 0;
      p = pct(cases.completed + partial, cases.total || cases.caseCount);
      sub = `Verb · ${cur?.title || 'Meet the verb'}`;
    } else {
      const chapters = progress.chapters.filter(c => !c.optional);
      p = progress.wordShort ? pct(progress.answered, progress.total) : pct(chapters.reduce((n, c) => n + c.ready, 0), chapters.reduce((n, c) => n + c.total, 0));
      sub = `Word · ${String(entry.en || '').split(';')[0].trim()}`;
    }
    inProgress.push({ kind: entry.kind, title: entry.inf || entry.it, sub, pct: Math.min(99, p), href: queued(practiceHref(entry) + '?session=' + encodeURIComponent(session.id), entry.id), updatedAt: session.updatedAt || 0 });
  }
  if (queueLive) {
    const items = queue.course.items;
    const itemDone = item => item.kind === 'grammar' ? !!grammarLesson(item.id) && complete(grammarLesson(item.id))
      : item.kind === 'verb' ? !!journeyChapterCompletions(lessonPlan(getEntry(item.id)), learning, now).find(c => c.id === item.caseId)?.ready
      : store.isLearned(item.id);
    const done = items.filter(itemDone).length, left = items.length - done - items.filter((item, i) => queue.course.skipped.includes(i) && !itemDone(item)).length;
    inProgress.push({ kind: 'session', title: 'Everyday Italian', sub: `${items.length} part${items.length === 1 ? '' : 's'} · ${left} left`, pct: pct(done, items.length), href: '#/learn/session', updatedAt: queue.updatedAt || 0 });
  }
  inProgress.sort((a, b) => b.updatedAt - a.updatedAt);

  // ---- next: grammar, verb, words, review ----
  const grammar = next ? { title: next.title, unit: next.unitTitle || null, minutes: next.minutes || 0, level: next.level, href: grammarHref(next) } : null;

  const related = kind => relatedVocabulary(next, store, { kind, unfinished: true });
  const connected = kind => [...related(kind).map(x => x.entry), ...nextNew(kind, 3, store)].filter((e, i, all) => all.findIndex(x => x.id === e.id) === i).slice(0, 3);
  const verbEntry = connected('verb')[0] || null;
  let verb = null;
  if (verbEntry) {
    const link = related('verb').find(x => x.entry.id === verbEntry.id && x.caseId);
    const cases = journeyChapterCompletions(lessonPlan(verbEntry), learning, now);
    const chapter = (link && cases.find(c => c.id === link.caseId && c.available && !c.ready)) || cases.find(c => !c.optional && c.available && !c.ready) || cases.find(c => c.available) || null;
    verb = { id: verbEntry.id, name: verbEntry.inf, en: verbEntry.en || '', level: verbEntry.level || 'A1', chapterLabel: chapter?.title || 'Present',
      href: `#/learn/verb/${encodeURIComponent(verbEntry.id)}${link && chapter?.id === link.caseId ? '?chapter=' + encodeURIComponent(link.caseId) : ''}` };
  }
  const wordEntries = connected('word').map(e => ({ id: e.id, headword: headword(e), en: e.en || '', level: e.level || 'A1' }));
  const words = { entries: wordEntries, done: Math.max(0, (day.new || 0) - (day.newVerbs || 0)), goal: s.dailyNew || 0, href: '#/learn/session?start=words' };

  const review = reviewItems(store, now);
  const due = s.adaptiveLearning !== false ? review.length : new Set(review.map(item => item.entry.id)).size;
  const scopeAll = itemsForScope(store.scope, store);
  const evidenceIds = new Set(Object.values(learning.events || {}).map(event => event.entryId));
  const legacyDates = scopeAll.filter(e => e.kind === 'word' && store.isLearned(e.id) && !evidenceIds.has(e.id)).map(e => store.getItem(e.id)?.due);
  const nextDue = [...eligibleSkills(store, now).map(skill => skill.due), ...legacyDates].filter(d => Number.isFinite(d) && d > now).reduce((soonest, d) => Math.min(soonest, d), Infinity);
  const reviewModel = { due, nextDueLabel: nextDue < Infinity ? relTime(nextDue) : null, href: '#/review', aheadHref: '#/review?mode=extra' };

  // ---- modes (the hero's four stops) ----
  // fresh = the stop of the item already begun (the button then resumes it); recommended = the course's next step for a
  // learner with nothing in progress: the next grammar lesson when the stage still has one, else a mixed session
  const fresh = MODE_OF_KIND[inProgress[0]?.kind] || null;
  const recommended = grammar ? 'grammar' : 'together';
  const modes = [
    { key: 'together', label: 'Insieme', title: queueLive ? 'Resume your session' : 'Everyday Italian', sub: queueLive ? 'Continue your saved session, one part at a time.' : 'Grammar, one verb tense, and up to three words', href: queueLive ? '#/learn/session' : '#/learn/session?start=together' },
    { key: 'grammar', label: 'Grammatica', title: grammar?.title || 'This level is complete', sub: grammar ? (next.outcome || `${next.level} · ${next.minutes} min`) : 'Revisit a lesson or choose your next level.', href: grammar?.href || '#/course' },
    { key: 'verbs', label: 'Verbi', title: verb?.name || 'No new verbs left in this scope', sub: verb ? `${String(verb.en).split(';')[0].trim()} · ${verb.chapterLabel}` : 'Widen the scope to meet more verbs.', href: verb?.href || '#/scope' },
    { key: 'words', label: 'Parole', title: wordEntries.length ? wordEntries.map(w => w.headword).join(' · ') : 'No new words left in this scope', sub: wordEntries.length ? 'A short vocabulary session' : 'Widen the scope to meet more words.', href: wordEntries.length ? words.href : '#/scope' },
  ].map(m => ({ ...m, ...(m.key===fresh?{title:inProgress[0].title,sub:inProgress[0].sub,href:inProgress[0].href}:{}), fresh: m.key === fresh, recommended: m.key === recommended }));

  // ---- scope + verb lab ----
  const scope = { label: describeScope(store.scope, store), learned: scopeAll.filter(e => store.isLearned(e.id)).length, total: scopeAll.length, href: '#/scope' };
  const learnedVerbs = store.learnedIds('v:').length;
  // the sentence workshop: its packs load lazily, so the lesson total is printed once the learner has used it and they are in
  const frasi = typeof store.labRecord === 'function' ? store.labRecord('frasi') : (store.current?.lab?.frasi || { done: {} });
  const frasiDone = Object.keys(frasi.done || {}).length, frasiTotal = labLessonTotal();
  if (frasiDone && !frasiTotal) loadSentenceLab().catch(() => { /* the card still opens the workshop, which reports the error */ });
  const lab = [
    { key: 'frasi', title: 'Officina delle frasi', sub: frasiDone ? (frasiTotal ? `${frasiDone} / ${frasiTotal} lessons` : `${frasiDone} lesson${frasiDone === 1 ? '' : 's'} done`) : 'Build sentences', href: '#/lab/frasi', icon: 'edit' },
    { key: 'conj-drill', title: 'Conjugation drill', sub: learnedVerbs ? `${learnedVerbs} learned verb${learnedVerbs === 1 ? '' : 's'}` : 'verbs in your scope', href: learnedVerbs ? '#/game/conj-drill?src=learned-verbs&tenses=presente,passatoProssimo' : '#/game/conj-drill?src=scope&tenses=presente', icon: 'edit' },
    { key: 'verb-quiz', title: 'Verb mix', sub: 'current scope', href: '#/game/verb-quiz?src=scope', icon: 'sparkle' },
    { key: 'all-verbs', title: 'All verbs', sub: `${data.verbs.length} with full tables`, href: '#/browse?kind=verb', icon: 'book' },
    { key: 'lists', title: 'My lists', sub: 'word bank & custom', href: '#/lists', icon: 'list' },
  ];

  return { plan:dailyPlan(store,{now}), stage, inProgress, next: { grammar, verb, words, review: reviewModel }, modes, scope, lab };
}
