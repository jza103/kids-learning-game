// Legendary friends: the top tier, earned only by finishing a set.
// Pure functions over a profile; the games call claimLegends after a mastery.
import { LEGENDS, LEGEND_RULES } from './content.js';

const MIN = 3;
const MAX = 12;
const range = () => Array.from({ length: MAX - MIN + 1 }, (_, i) => i + MIN);

/** Fact ids that must be mastered for a table's Titan: t × 3..12 and (t·n) ÷ t for n 3..12. */
export function titanFactIds(table) {
  return range().flatMap((n) => [`m${table}x${n}`, `d${table * n}/${table}`]);
}

const masteredIn = (srs, id) => srs?.[id]?.masteredAt != null;

export function tableMastered(profile, table) {
  const srs = profile.math?.srs;
  return titanFactIds(table).every((id) => masteredIn(srs, id));
}

export function masteredVocabCount(profile) {
  return Object.values(profile.vocab?.srs || {}).filter((i) => i.masteredAt != null).length;
}

/** This week's list, if it's big enough and every word on it has been mastered. */
export function weekListDone(profile) {
  const words = (profile.words || []).filter((w) => w.batch === profile.currentBatch);
  return words.length >= LEGEND_RULES.minWeekWords && words.every((w) => masteredIn(profile.srs, w.id));
}

/** Award a Week Star for the current list once it's all mastered (kept forever). */
export function claimWeekStar(profile) {
  const stars = profile.weekStars || [];
  if (profile.currentBatch == null || stars.includes(profile.currentBatch) || !weekListDone(profile)) return { profile, star: false };
  return { profile: { ...profile, weekStars: [...stars, profile.currentBatch] }, star: true };
}

export function eligibleLegends(profile) {
  const stars = (profile.weekStars || []).length;
  const vocab = masteredVocabCount(profile);
  return LEGENDS.filter((l) => {
    if (l.track === 'math') return tableMastered(profile, l.table);
    if (l.track === 'spelling') return l.order < Math.floor(stars / LEGEND_RULES.weekStars);
    return l.order < Math.floor(vocab / LEGEND_RULES.vocabWords);
  });
}

/**
 * Give any Legendary friends (and a Week Star) the profile has earned but not
 * received. Idempotent. Returns { profile, newly, star }.
 */
export function claimLegends(profile) {
  const { profile: p, star } = claimWeekStar(profile);
  const newly = eligibleLegends(p).filter((l) => !p.collection?.[l.id]);
  if (!newly.length) return { profile: p, newly, star };
  const collection = { ...p.collection };
  for (const l of newly) collection[l.id] = 1;
  return { profile: { ...p, collection, legendsNew: [...(p.legendsNew || []), ...newly.map((l) => l.id)] }, newly, star };
}

/** Progress toward the next Legendary in each game, for the Collection screen. */
export function legendProgress(profile) {
  const stars = (profile.weekStars || []).length;
  const vocab = masteredVocabCount(profile);
  return {
    weekStars: stars,
    starsToNext: LEGEND_RULES.weekStars - (stars % LEGEND_RULES.weekStars),
    vocab,
    vocabToNext: LEGEND_RULES.vocabWords - (vocab % LEGEND_RULES.vocabWords),
    tables: range().map((t) => {
      const ids = titanFactIds(t);
      return { table: t, mastered: ids.filter((id) => masteredIn(profile.math?.srs, id)).length, total: ids.length };
    }),
  };
}
