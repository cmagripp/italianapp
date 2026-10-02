// Content and session plumbing for the sentence workshop (Officina delle frasi): loads the four stage packs
// (data/sentence-lab/<stage>.json) once per page with fetch, indexes their lessons, and keeps the lesson sessions in
// store.learning.sessions under 'lab:frasi:<lessonId>'. The engine (./sentence-lab.js) stays pure; the views
// (js/views/labFrasi.js, js/views/labFrasiLesson.js) go through this module for everything that touches the network
// or the learning domain's session slots. Contract: docs/SENTENCE-LAB-CONTRACT.md §1 and §6.
import { LAB_STAGES } from './sentence-lab.js';

export const LAB_KEY = 'frasi';
const BASE = new URL('../../data/sentence-lab/', import.meta.url);
const cache = { promise: null, stages: [], lessons: new Map(), missing: [] };

async function fetchPack(stage) {
  try {
    const response = await fetch(new URL(`${stage}.json`, BASE));
    if (!response.ok) return null;
    const pack = await response.json();
    return pack && typeof pack === 'object' && Array.isArray(pack.lessons) ? pack : null;
  } catch { return null; }
}

// Resolves to { stages, missing }: the packs that loaded, sorted by order, and the stage names that did not. A stage pack
// that is missing or malformed is skipped (the path shows the stages it has); nothing at all is an error, and the next
// call tries again.
export function loadSentenceLab() {
  return cache.promise ||= (async () => {
    const packs = await Promise.all(LAB_STAGES.map(fetchPack));
    const stages = packs
      .map((pack, i) => (pack ? { ...pack, stage: typeof pack.stage === 'string' ? pack.stage : LAB_STAGES[i], order: Number.isFinite(pack.order) ? pack.order : i + 1 } : null))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
    if (!stages.length) { cache.promise = null; throw new Error('The sentence workshop could not load its lessons. Check the connection and try again.'); }
    cache.stages = stages;
    cache.missing = LAB_STAGES.filter((stage, i) => !packs[i]);
    cache.lessons = new Map();
    for (const pack of stages) for (const lesson of pack.lessons) if (lesson && typeof lesson.id === 'string') cache.lessons.set(lesson.id, { lesson, stage: pack });
    return { stages, missing: cache.missing };
  })();
}

export const labLoaded = () => cache.stages.length > 0;
export const labStages = () => cache.stages;
export const labLesson = id => cache.lessons.get(id)?.lesson || null;
export const labStageOf = id => cache.lessons.get(id)?.stage || null;
export const labLessonList = () => cache.stages.flatMap(pack => pack.lessons);
// null until the packs have loaded (the Learn hub prints the count only when it knows it)
export const labLessonTotal = () => (cache.stages.length ? cache.stages.reduce((n, pack) => n + pack.lessons.length, 0) : null);
export function labNextLesson(id) {
  const all = labLessonList();
  const i = all.findIndex(l => l.id === id);
  return i >= 0 ? all[i + 1] || null : null;
}
export function labLessonIndex(id) {
  const stage = labStageOf(id);
  const i = stage ? stage.lessons.findIndex(l => l.id === id) : -1;
  return i >= 0 ? { stage, index: i, total: stage.lessons.length } : null;
}

// ---------- sessions ----------
// A lesson session lives in store.learning.sessions['lab:frasi:<lessonId>']. The learning domain re-keys every stored
// session by `${entryId}|${mode}` whenever it normalises (reload, merge, an attempt recorded), so the session also
// carries entryId = that key and mode = 'lab', and a read accepts the re-keyed alias 'lab:frasi:<lessonId>|lab'.
export const LAB_SESSION_MODE = 'lab';
export const labSessionKey = lessonId => `lab:${LAB_KEY}:${lessonId}`;
const aliasKey = lessonId => `${labSessionKey(lessonId)}|${LAB_SESSION_MODE}`;
const sessionsOf = store => store?.learning?.sessions || {};

export function readLabSession(store, lessonId) {
  const sessions = sessionsOf(store);
  const a = sessions[labSessionKey(lessonId)], b = sessions[aliasKey(lessonId)];
  if (a && b) return (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
  return a || b || null;
}
export function writeLabSession(store, session) {
  if (!store?.current || !session?.lessonId) return null;
  const domain = store.learning;
  domain.sessions ||= {};
  session.entryId = labSessionKey(session.lessonId);
  session.mode = LAB_SESSION_MODE;
  session.updatedAt = Date.now();
  delete domain.sessions[aliasKey(session.lessonId)];
  domain.sessions[labSessionKey(session.lessonId)] = session;
  store.save();
  return session;
}
export function clearLabSession(store, lessonId) {
  const sessions = sessionsOf(store);
  const had = !!(sessions[labSessionKey(lessonId)] || sessions[aliasKey(lessonId)]);
  delete sessions[labSessionKey(lessonId)];
  delete sessions[aliasKey(lessonId)];
  if (had) store.save();
  return had;
}
// Unfinished lesson sessions, newest first: [{ lessonId, session }].
export function openLabSessions(store) {
  const prefix = `lab:${LAB_KEY}:`;
  const out = new Map();
  for (const session of Object.values(sessionsOf(store))) {
    if (!session || typeof session.entryId !== 'string' || !session.entryId.startsWith(prefix) || session.phase !== 'activity') continue;
    const lessonId = session.lessonId || session.entryId.slice(prefix.length);
    const kept = out.get(lessonId);
    if (!kept || (session.updatedAt || 0) > (kept.updatedAt || 0)) out.set(lessonId, session);
  }
  return [...out.entries()].map(([lessonId, session]) => ({ lessonId, session })).sort((a, b) => (b.session.updatedAt || 0) - (a.session.updatedAt || 0));
}
