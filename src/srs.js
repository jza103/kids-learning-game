// Leitner-style spaced repetition. Boxes 0..MAX_BOX; a correct answer moves an
// item up one box (longer wait), a miss sends it back to box 0.
import { weightedPick } from './rng.js';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export const MAX_BOX = 5;
// How long to wait before an item in each box is due again.
export const INTERVALS = [1 * MIN, 10 * MIN, 1 * DAY, 2 * DAY, 4 * DAY, 7 * DAY];
// Pick weight for a due item, by box: lower boxes (shakier words) come up more.
export const BOX_WEIGHT = [8, 6, 4, 3, 2, 1];
export const NEW_WEIGHT = 5;
export const NOT_DUE_WEIGHT = 0.25;
export const MISS_BOOST_PER_MISS = 0.5;
export const MISS_BOOST_CAP = 4;

// --- Mastery refresh ---
// A mastered item (top box) comes back after a while and needs a "refresh":
// until it's answered right again it shows 4 stars and a 🔄. Each refresh
// pushes the next one further out. Items that were once a problem (missed
// PROBLEM_MISSES+ times) come back twice as soon.
export const REFRESH_DAYS = [7, 14, 30, 60];
export const PROBLEM_MISSES = 2;
export const REFRESH_WEIGHT = 5;

export function refreshInterval(item) {
  const days = REFRESH_DAYS[Math.min(item.refreshes || 0, REFRESH_DAYS.length - 1)];
  return (item.misses >= PROBLEM_MISSES ? days / 2 : days) * DAY;
}

/** A mastered item whose refresh is due. */
export function needsRefresh(item, now = Date.now()) {
  return Boolean(item) && item.box >= MAX_BOX && item.dueAt <= now;
}

export function newItem(id, now) {
  return { id, box: 0, dueAt: now, seen: 0, correct: 0, misses: 0, lastResult: null, masteredAt: null };
}

/**
 * Record an answer. result is 'correct', 'wrong' or 'assisted' (answered
 * correctly after using a hint). Returns a new item; does not mutate.
 */
export function review(item, result, now) {
  const next = { ...item, seen: item.seen + 1, lastResult: result };
  if (result === 'correct') {
    next.box = Math.min(item.box + 1, MAX_BOX);
    next.correct = item.correct + 1;
  } else if (result === 'assisted') {
    // A hinted answer doesn't prove recall: keep the box, ask again soon.
    next.box = item.box;
  } else {
    next.box = 0;
    next.misses = item.misses + 1;
  }
  if (result === 'correct' && item.box >= MAX_BOX && item.dueAt <= now) next.refreshes = (item.refreshes || 0) + 1;
  next.dueAt = result !== 'correct' ? now + INTERVALS[0] : next.box >= MAX_BOX ? now + refreshInterval(next) : now + INTERVALS[next.box];
  // First time reaching the top box. Kept even if the word slips later, so
  // mastery rewards are paid once per word.
  next.masteredAt = item.masteredAt ?? (next.box >= MAX_BOX ? now : null);
  return next;
}

export function isMastered(item) {
  return item.box >= MAX_BOX;
}

export function isDue(item, now) {
  return item.dueAt <= now;
}

/** Relative chance of asking this item next. Missed words weigh more. */
export function weightFor(item, now) {
  if (item.seen === 0) return NEW_WEIGHT;
  if (!isDue(item, now)) return NOT_DUE_WEIGHT;
  if (needsRefresh(item, now)) return REFRESH_WEIGHT * (item.misses >= PROBLEM_MISSES ? 1.5 : 1);
  const missBoost = 1 + Math.min(item.misses, MISS_BOOST_CAP) * MISS_BOOST_PER_MISS;
  return BOX_WEIGHT[item.box] * missBoost;
}

/**
 * Choose the next item to ask. `recent` holds ids asked in the last few turns
 * so the same word doesn't come straight back (unless it's the only one).
 */
export function pickNext(items, now, rng = Math.random, recent = []) {
  if (!items.length) return undefined;
  let pool = items.filter((i) => !recent.includes(i.id));
  if (!pool.length) pool = items;
  return weightedPick(pool.map((i) => [i, weightFor(i, now)]), rng);
}

/** 0-5 star mastery rating (the current box) and a label for it. */
export function masteryRating(item, now = Date.now()) {
  if (needsRefresh(item, now)) return { stars: MAX_BOX - 1, label: 'Needs a refresh', refresh: true };
  const stars = item ? item.box : 0;
  let label = 'New';
  if (item && item.seen > 0) label = stars >= MAX_BOX ? 'Mastered' : stars >= 3 ? 'Strong' : 'Learning';
  return { stars, label, refresh: false };
}

/** Summary used on the parent screen. */
export function masterySummary(items, now = Date.now()) {
  const out = { new: 0, learning: 0, mastered: 0, refresh: 0 };
  for (const i of items) {
    if (i.seen === 0) out.new++;
    else if (needsRefresh(i, now)) out.refresh++;
    else if (isMastered(i)) out.mastered++;
    else out.learning++;
  }
  return out;
}
