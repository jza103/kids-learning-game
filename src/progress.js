// Cosmetic XP / levels and team powers from collectibles.
import { ITEMS_BY_ID, RARITY_STRENGTH, COSMETICS, THEMES } from './content.js';
import { themeProgress } from './economy.js';

export const XP_PER = { correct: 10, assisted: 4, wrong: 2, monster: 25, mastered: 50, setComplete: 200 };
export const TEAM_SIZE = 3;

/** Total XP needed to reach `level` (level 1 = 0, 2 = 100, 3 = 300, 4 = 600...). */
export function xpForLevel(level) {
  return 50 * (level - 1) * level;
}

export function levelForXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelProgress(xp) {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return { level, into: xp - start, needed: end - start };
}

export function unlockedCosmetics(xp) {
  const level = levelForXp(xp);
  return COSMETICS.filter((c) => c.level <= level);
}

/** Sum the powers of the collectibles on the team, ignoring game type and level. Games use teamPowersFor in friends.js. */
export function teamPowers(team) {
  const out = { hint: 0, power: 0, shield: 0, xp: 0, buddy: 0 };
  for (const id of team.slice(0, TEAM_SIZE)) {
    const item = ITEMS_BY_ID[id];
    if (item) out[item.power] += RARITY_STRENGTH[item.rarity];
  }
  return out;
}

export function applyXpBoost(xp, powers) {
  return Math.round(xp * (1 + powers.xp * 0.1));
}

/** Titles earned by completing a theme in the collection book. */
export function earnedTitles(collection) {
  return THEMES.filter((t) => themeProgress(t, collection).complete).map((t) => t.reward);
}

/** Award XP once for each theme completed since last check. */
export function claimSetRewards(profile) {
  const done = new Set(profile.completedSets || []);
  const newly = THEMES.filter((t) => !done.has(t.id) && themeProgress(t, profile.collection).complete);
  if (!newly.length) return { profile, newly: [] };
  return {
    profile: {
      ...profile,
      xp: profile.xp + newly.length * XP_PER.setComplete,
      completedSets: [...done, ...newly.map((t) => t.id)],
    },
    newly,
  };
}
