// Small seeded RNG so game logic can be tested deterministically.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one entry from `entries` ([value, weight] pairs) using rng() in [0,1). */
export function weightedPick(entries, rng = Math.random) {
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  if (total <= 0) return entries.length ? entries[0][0] : undefined;
  let r = rng() * total;
  for (const [value, w] of entries) {
    r -= Math.max(0, w);
    if (r < 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** Local calendar day, e.g. "2026-11-19". Used for the daily pack cap. */
export function dayKey(now) {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
