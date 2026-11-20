// Friend growth: specialties, friend XP, levels, evolution and learning new
// game types. Pure functions (profile in, new profile out). Pacing math and the
// reasons behind these numbers: docs/friends-pacing.md.
import { ITEMS_BY_ID, RARITY_STRENGTH } from './content.js';
import { TEAM_SIZE } from './progress.js';
import { dayKey } from './rng.js';

// Friend XP per answer while on the team. A friend playing outside the game
// types it knows is "learning", so it earns a bit more XP (and training).
export const FRIEND_XP = { correct: 4, assisted: 2, wrong: 1 };
export const LEARNING_XP_BONUS = 1.5;
export const PRACTICE_SCALE = 0.5; // untimed practice modes: half friend XP
// Base friend XP (before Friend boost) one friend can earn per day.
export const DAILY_FRIEND_XP = 100;
// Training toward a new game type: per correct answer, per friend per day.
export const TRAIN_PER_CORRECT = 1;
export const DAILY_TRAINING = 10;
export const TRAINING_TO_LEARN = 50;
// Friend boost (buddy power) is capped so stacking can't skip the curve.
export const MAX_BUDDY_BOOST = 0.5;
export const MAX_LEVEL = 10;

// Evolution stages by level. Each stage adds +1 to the friend's power.
export const STAGES = [
  { level: 1, name: 'Friend', badge: '', bonus: 0, extraTypes: 1 },
  { level: 5, name: 'Super Friend', badge: '✨', bonus: 1, extraTypes: 1 },
  { level: 10, name: 'Best Friend', badge: '💖', bonus: 2, extraTypes: 2 },
];

/** Total friend XP needed to reach `level` (2 = 100, 3 = 300, 5 = 1000, 10 = 4500). */
export function friendXpForLevel(level) {
  return 50 * (level - 1) * level;
}

export function friendLevel(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= friendXpForLevel(level + 1)) level++;
  return level;
}

export function stageForLevel(level) {
  return [...STAGES].reverse().find((s) => level >= s.level);
}

export function newFriendState() {
  return { xp: 0, train: {}, learned: [], day: null, xpToday: 0, trainToday: 0 };
}

export function friendState(profile, id) {
  return { ...newFriendState(), ...(profile.friends || {})[id] };
}

/** Everything the UI needs to show about one friend. */
export function friendInfo(profile, id, now = Date.now()) {
  const item = ITEMS_BY_ID[id];
  const s = friendState(profile, id);
  const level = friendLevel(s.xp);
  const stage = stageForLevel(level);
  const start = friendXpForLevel(level);
  const end = level >= MAX_LEVEL ? start : friendXpForLevel(level + 1);
  const knows = [item.specialty, ...s.learned];
  return {
    item,
    level,
    stage,
    strength: RARITY_STRENGTH[item.rarity] + stage.bonus,
    knows,
    into: s.xp - start,
    needed: end - start,
    maxed: level >= MAX_LEVEL,
    train: s.train,
    canLearnMore: s.learned.length < stage.extraTypes,
    tiredToday: s.day === dayKey(now) && s.xpToday >= DAILY_FRIEND_XP,
  };
}

export function knowsGame(profile, id, gameType) {
  const item = ITEMS_BY_ID[id];
  if (!item) return false;
  return item.specialty === gameType || friendState(profile, id).learned.includes(gameType);
}

/**
 * Powers from team friends that know this game type. Friends that don't know
 * it still come along and learn, but give no power here.
 */
export function teamPowersFor(profile, gameType) {
  const out = { hint: 0, power: 0, shield: 0, xp: 0, buddy: 0 };
  for (const id of (profile.team || []).slice(0, TEAM_SIZE)) {
    if (!knowsGame(profile, id, gameType)) continue;
    const info = friendInfo(profile, id);
    out[info.item.power] += info.strength;
  }
  return out;
}

export function buddyBoost(powers) {
  return Math.min(MAX_BUDDY_BOOST, (powers.buddy || 0) * 0.1);
}

/** For each team friend: is it helping in this game type, or learning it? */
export function teamStatus(profile, gameType) {
  return (profile.team || []).slice(0, TEAM_SIZE).filter((id) => ITEMS_BY_ID[id]).map((id) => {
    const helps = knowsGame(profile, id, gameType);
    const info = friendInfo(profile, id);
    return { id, item: info.item, helps, training: info.train[gameType] || 0, canLearn: info.canLearnMore };
  });
}

/**
 * Grow the team after one answer in `gameType`. Call once per answer.
 * Returns events: { type: 'level', id, level } | { type: 'evolve', id, stage }
 * | { type: 'learned', id, gameType }.
 */
export function friendsAfterAnswer(profile, gameType, result, now, { practice = false } = {}) {
  const team = (profile.team || []).slice(0, TEAM_SIZE).filter((id) => ITEMS_BY_ID[id]);
  if (!team.length) return { profile, events: [] };
  const boost = buddyBoost(teamPowersFor(profile, gameType));
  const today = dayKey(now);
  const friends = { ...(profile.friends || {}) };
  const events = [];
  for (const id of team) {
    const prev = friendState(profile, id);
    const s = { ...prev, train: { ...prev.train }, learned: [...prev.learned] };
    if (s.day !== today) Object.assign(s, { day: today, xpToday: 0, trainToday: 0 });
    const learning = !knowsGame(profile, id, gameType);

    let base = FRIEND_XP[result] || 0;
    if (learning) base *= LEARNING_XP_BONUS;
    if (practice) base *= PRACTICE_SCALE;
    base = Math.min(Math.round(base), DAILY_FRIEND_XP - s.xpToday);
    if (base > 0) {
      const levelBefore = friendLevel(s.xp);
      s.xpToday += base;
      s.xp += Math.round(base * (1 + boost));
      const levelAfter = friendLevel(s.xp);
      if (levelAfter > levelBefore) {
        events.push({ type: 'level', id, level: levelAfter });
        const before = stageForLevel(levelBefore);
        const after = stageForLevel(levelAfter);
        if (after !== before) events.push({ type: 'evolve', id, stage: after.name });
      }
    }

    const slots = stageForLevel(friendLevel(s.xp)).extraTypes;
    if (learning && result !== 'wrong' && s.learned.length < slots && s.trainToday < DAILY_TRAINING) {
      s.trainToday += TRAIN_PER_CORRECT;
      s.train[gameType] = (s.train[gameType] || 0) + TRAIN_PER_CORRECT;
      if (s.train[gameType] >= TRAINING_TO_LEARN) {
        s.learned.push(gameType);
        events.push({ type: 'learned', id, gameType });
      }
    }
    friends[id] = s;
  }
  return { profile: { ...profile, friends }, events };
}

/** Friend XP each team friend gained between two profiles (for a round summary). */
export function friendGains(before, after) {
  return (after.team || []).filter((id) => ITEMS_BY_ID[id]).map((id) => ({
    id,
    xp: friendState(after, id).xp - friendState(before, id).xp,
  }));
}
