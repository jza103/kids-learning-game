// Built-in "tricky words" list for a kid who no longer gets school spelling
// words. A grown-up turns it on per kid; each week the next set of 10 joins
// the word bank as this week's words (same stars, mastery and Super Packs as
// school words). A kid who gets this week's set to 3+ stars can ask for the
// next set early, so a fast learner is never held back.
import { TRICKY_SETS } from './tricky-words.js';
import { addWords, cleanEntries } from './profile.js';

export const WEEK_MS = 7 * 24 * 3600e3;
export const READY_STARS = 3;

export function trickyState(p) {
  return { on: false, next: 0, lastAt: null, batch: null, ...(p.tricky || {}) };
}

export function trickySetEntries(index) {
  const set = TRICKY_SETS[index];
  return set ? cleanEntries(set.words.map(([word, sentence]) => ({ word, sentence }))) : [];
}

export function setsLeft(p) {
  return TRICKY_SETS.length - trickyState(p).next;
}

/** Add the next set as this week's words. Returns null when the list is used up. */
export function addTrickySet(p, now) {
  const st = trickyState(p);
  const set = TRICKY_SETS[st.next];
  if (!set) return null;
  const r = addWords(p, trickySetEntries(st.next), now);
  return { ...r, set, profile: { ...r.profile, tricky: { ...st, next: st.next + 1, lastAt: now, batch: r.profile.currentBatch } } };
}

/** Turn the list on or off. Turning it on for the first time adds set 1 right away. */
export function setTricky(p, on, now) {
  const st = trickyState(p);
  const q = { ...p, tricky: { ...st, on } };
  if (on && st.next === 0) return addTrickySet(q, now).profile;
  return q;
}

/** A week has passed since the last set: time for the next one. */
export function trickyDue(p, now) {
  const st = trickyState(p);
  return st.on && st.next < TRICKY_SETS.length && (st.lastAt == null || now - st.lastAt >= WEEK_MS);
}

/** Every word of this week's tricky set has READY_STARS or more, so the kid may take the next set now. */
export function readyForMore(p) {
  const st = trickyState(p);
  if (!st.on || st.next >= TRICKY_SETS.length || st.batch == null || p.currentBatch !== st.batch) return false;
  const week = p.words.filter((w) => w.batch === p.currentBatch);
  return week.length > 0 && week.every((w) => (p.srs[w.id]?.box ?? 0) >= READY_STARS);
}

/** Called when a kid opens the game: adds the weekly set if one is due. */
export function autoTricky(p, now) {
  return trickyDue(p, now) ? addTrickySet(p, now) : null;
}

export { TRICKY_SETS };
