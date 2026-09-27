// Spaced-repetition scheduling (SM-2 variant with a 0–5 mastery ladder).
const DAY = 86400e3;
const MIN = 60e3;

// item: { s, ef, iv, due, reps, lapses }
// quality: 0-5 (5 perfect, 4 correct, 3 correct with hesitation/hint, <3 wrong)
export function schedule(item, quality, now = Date.now()) {
  let { s = 0, ef = 2.5, iv = 0, reps = 0, lapses = 0 } = item;
  const q = Math.max(0, Math.min(5, quality));
  let due;
  if (q < 3) {
    reps = 0; lapses += 1; s = Math.max(0, s - 1); iv = 0;
    due = now + 10 * MIN;
  } else {
    reps += 1;
    if (reps === 1) iv = 1;
    else if (reps === 2) iv = 3;
    else iv = Math.round(iv * ef);
    if (q === 3 && iv > 1) iv = Math.max(1, Math.round(iv * 0.7));
    ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    s = Math.min(5, s + (q >= 4 ? 1 : 0));
    // short first step inside the same day for brand-new items
    due = reps === 1 ? now + 8 * 3600e3 : now + iv * DAY;
  }
  return { s, ef: Math.round(ef * 100) / 100, iv, reps, lapses, due };
}

export function isDue(item, now = Date.now()) { return !!item && !!item.due && item.due <= now; }

export function stage(item) {
  if (!item || (!item.seen && !item.learned)) return 'new';
  if (item.s >= 5 && item.iv >= 21) return 'mastered';
  if (item.s >= 3) return 'review';
  return 'learning';
}

export const STAGE_LABEL = { new: 'New', learning: 'Learning', review: 'Reviewing', mastered: 'Mastered' };

// Build a study queue: due first (oldest due first), then weak items, then new ones.
export function buildQueue(ids, getItem, { limitNew = 10, limitTotal = 30, now = Date.now(), includeNew = true } = {}) {
  const due = [], weak = [], fresh = [];
  for (const id of ids) {
    const it = getItem(id);
    if (!it || (!it.seen && !it.learned)) { if (includeNew) fresh.push(id); continue; }
    if (it.due && it.due <= now) due.push([id, it.due]);
    else if (it.s < 3) weak.push([id, it.s * 1000 + (it.due || 0) / 1e9]);
  }
  due.sort((a, b) => a[1] - b[1]);
  weak.sort((a, b) => a[1] - b[1]);
  const out = [...due.map(x => x[0])];
  for (const [id] of weak) { if (out.length >= limitTotal) break; out.push(id); }
  let n = 0;
  for (const id of fresh) { if (out.length >= limitTotal || n >= limitNew) break; out.push(id); n++; }
  return out;
}
