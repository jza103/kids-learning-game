// Coins, packs, shards and crafting. All functions are pure: they take a
// profile and return a new one, so they're easy to test.
import { THEMES, ITEMS_BY_ID, ALL_ITEMS } from './content.js';
import { weightedPick, dayKey } from './rng.js';

// --- Coins: earned per correct answer, never for just finishing a round. ---
// Paid by the word's box *before* the answer: shaky words pay more,
// mastered words pay little, so grinding easy words isn't worth it.
export const BOX_COINS = [15, 12, 10, 8, 5, 2];
// Extra for getting right a word you missed last time.
export const COMEBACK_BONUS = 5;

export function coinsForAnswer(itemBefore, result) {
  if (result === 'wrong') return 0;
  const base = BOX_COINS[itemBefore.box] ?? BOX_COINS[BOX_COINS.length - 1];
  const bonus = itemBefore.lastResult === 'wrong' ? COMEBACK_BONUS : 0;
  const coins = base + bonus;
  return result === 'assisted' ? Math.floor(coins / 2) : coins;
}

// --- Packs ---
export const PACK_COST = 60;
export const DAILY_PACK_CAP = 5;
export const ODDS = { common: 0.65, rare: 0.28, epic: 0.07 };
// A rare-or-better is guaranteed at least once every RARE_PITY packs, and an
// epic at least once every EPIC_PITY packs.
export const RARE_PITY = 4;
export const EPIC_PITY = 12;
export const SHARDS_FOR_DUPLICATE = { common: 5, rare: 15, epic: 40 };
export const CRAFT_COST = { common: 20, rare: 60, epic: 150 };

export function newPackState() {
  return { day: null, openedToday: 0, sinceRare: 0, sinceEpic: 0, total: 0 };
}

export function packsLeftToday(profile, now) {
  const p = profile.packs;
  return p.day === dayKey(now) ? Math.max(0, DAILY_PACK_CAP - p.openedToday) : DAILY_PACK_CAP;
}

export function canOpenPack(profile, now) {
  if (packsLeftToday(profile, now) <= 0) return { ok: false, reason: 'cap' };
  if (profile.coins < PACK_COST) return { ok: false, reason: 'coins' };
  return { ok: true };
}

/** Packs until the next guaranteed rare-or-better / epic (1 = the next pack). */
export function pityStatus(packs) {
  return { rareIn: RARE_PITY - packs.sinceRare, epicIn: EPIC_PITY - packs.sinceEpic };
}

export function rollRarity(packs, rng = Math.random) {
  if (packs.sinceEpic + 1 >= EPIC_PITY) return 'epic';
  if (packs.sinceRare + 1 >= RARE_PITY) {
    // Guaranteed rare-or-better, keeping epic's share of that slice.
    return rng() < ODDS.epic / (ODDS.epic + ODDS.rare) ? 'epic' : 'rare';
  }
  return weightedPick(Object.entries(ODDS), rng);
}

/**
 * Pick a collectible of the given rarity from a theme. Ones you don't own yet
 * come first, so a duplicate only happens once that tier of the theme is full.
 */
export function pickItem(theme, rarity, collection, rng = Math.random) {
  const tier = theme.items.filter((i) => i.rarity === rarity);
  const missing = tier.filter((i) => !collection[i.id]);
  const pool = missing.length ? missing : tier;
  return pool[Math.floor(rng() * pool.length)];
}

export function openPack(profile, themeId, now, rng = Math.random) {
  const check = canOpenPack(profile, now);
  if (!check.ok) throw new Error(`cannot open pack: ${check.reason}`);
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme) throw new Error(`unknown theme: ${themeId}`);

  const today = dayKey(now);
  const prev = profile.packs;
  const rarity = rollRarity(prev, rng);
  const item = pickItem(theme, rarity, profile.collection, rng);
  const duplicate = Boolean(profile.collection[item.id]);
  const shards = duplicate ? SHARDS_FOR_DUPLICATE[rarity] : 0;

  const next = {
    ...profile,
    coins: profile.coins - PACK_COST,
    shards: profile.shards + shards,
    collection: { ...profile.collection, [item.id]: (profile.collection[item.id] || 0) + 1 },
    packs: {
      day: today,
      openedToday: (prev.day === today ? prev.openedToday : 0) + 1,
      sinceRare: rarity === 'common' ? prev.sinceRare + 1 : 0,
      sinceEpic: rarity === 'epic' ? 0 : prev.sinceEpic + 1,
      total: prev.total + 1,
    },
  };
  return { profile: next, result: { item, rarity, duplicate, shards, themeId } };
}

/** Spend shards to get a specific collectible you don't have yet. */
export function craft(profile, itemId) {
  const item = ITEMS_BY_ID[itemId];
  if (!item) throw new Error(`unknown item: ${itemId}`);
  if (profile.collection[itemId]) throw new Error('already owned');
  const cost = CRAFT_COST[item.rarity];
  if (cost === undefined) throw new Error('only from super packs');
  if (profile.shards < cost) throw new Error('not enough shards');
  return {
    ...profile,
    shards: profile.shards - cost,
    collection: { ...profile.collection, [itemId]: 1 },
  };
}

export function themeProgress(theme, collection) {
  const owned = theme.items.filter((i) => collection[i.id]).length;
  return { owned, total: theme.items.length, complete: owned === theme.items.length };
}

// --- Mastery rewards and Super Packs ---
// The big rewards come from mastering words (reaching the top box for the
// first time), not from grinding answers.
export const MASTERY_COINS = 30;
export const SUPER_PACK_EVERY = 5; // mastered words per Super Pack
export const SUPER_PACK_SHARDS = 150; // if every ultra is already owned

/** Pay the one-time reward for newly mastering a word. */
export function rewardMastery(profile) {
  const progress = (profile.superProgress || 0) + 1;
  const earned = Math.floor(progress / SUPER_PACK_EVERY);
  return {
    ...profile,
    coins: profile.coins + MASTERY_COINS,
    masteredWords: (profile.masteredWords || 0) + 1,
    superProgress: progress % SUPER_PACK_EVERY,
    superPacks: (profile.superPacks || 0) + earned,
  };
}

/**
 * Open a Super Pack: a guaranteed ultra from the chosen theme. If that theme's
 * ultras are all owned, any missing ultra; then any missing friend in the
 * theme; and if the whole collection is done, shards. Not limited by the daily cap.
 */
export function openSuperPack(profile, themeId, rng = Math.random) {
  if (!(profile.superPacks > 0)) throw new Error('no super packs');
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme) throw new Error(`unknown theme: ${themeId}`);
  const missing = (items) => items.filter((i) => !profile.collection[i.id]);
  const pool =
    [missing(theme.items.filter((i) => i.rarity === 'ultra')), missing(ALL_ITEMS.filter((i) => i.rarity === 'ultra')), missing(theme.items)].find(
      (p) => p.length,
    ) || [];
  const next = { ...profile, superPacks: profile.superPacks - 1 };
  if (!pool.length) {
    return { profile: { ...next, shards: profile.shards + SUPER_PACK_SHARDS }, result: { item: null, shards: SUPER_PACK_SHARDS, super: true } };
  }
  const item = pool[Math.floor(rng() * pool.length)];
  return {
    profile: { ...next, collection: { ...profile.collection, [item.id]: 1 } },
    result: { item, rarity: item.rarity, duplicate: false, shards: 0, super: true, themeId: item.theme || themeId },
  };
}
