// Sunshine: every correct answer in any learning game sends Sunshine to the
// kid's farm (Friend Grove). It's banked on the profile in the Sun Jar with no
// limit and poured into the farm there. Crops, critter goodies, forage, crafts
// and expeditions grow from Sunshine, not from the clock.
export const SUN = { correct: 1, comeback: 2, mastery: 10 };

/** Sunshine for one answer. Warm-up facts give none (like coins). */
export function sunshineFor(itemBefore, result, { warmup = false, mastered = false } = {}) {
  if (warmup || result === 'wrong') return 0;
  const base = itemBefore?.lastResult === 'wrong' ? SUN.comeback : SUN.correct;
  return base + (mastered ? SUN.mastery : 0);
}

export function addSun(profile, n) {
  if (!(n > 0)) return profile;
  return { ...profile, sunJar: (profile.sunJar || 0) + n, sunEarned: (profile.sunEarned || 0) + n };
}

// Refreshing a mastered word or fact (see srs.js) also pays a couple of shards.
export const REFRESH_SHARDS = 2;

/** Sunshine and refresh shards for one answer. Returns { profile, sun, shards }. */
export function learnRewards(profile, itemBefore, result, now, opts = {}) {
  const sun = sunshineFor(itemBefore, result, opts);
  const refreshed = !opts.warmup && result === 'correct' && itemBefore?.masteredAt != null && itemBefore.box >= 5 && itemBefore.dueAt <= now;
  const shards = refreshed ? REFRESH_SHARDS : 0;
  let next = addSun(profile, sun);
  if (shards) next = { ...next, shards: (next.shards || 0) + shards };
  return { profile: next, sun, shards };
}
