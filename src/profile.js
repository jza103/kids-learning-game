// Per-kid profile: their word list, spaced-repetition state, wallet,
// collection and cosmetics.
import { newItem, review, isDue, pickNext } from './srs.js';
import { coinsForAnswer, earnCoins, newPackState, rewardMastery } from './economy.js';
import { claimLegends } from './legend.js';
import { XP_PER, applyXpBoost } from './progress.js';
import { learnRewards } from './sunshine.js';

export function newProfile(name, now, id = `kid-${now.toString(36)}`) {
  return {
    id,
    name: name.trim() || 'Player',
    createdAt: now,
    words: [], // word bank, grows each week: [{ id, word, sentence, addedAt, batch }]
    currentBatch: null, // `batch` of this week's words
    srs: {}, // id -> srs item (also the word's mastery rating)
    coins: 0,
    shards: 0,
    xp: 0,
    packs: newPackState(),
    collection: {}, // itemId -> count
    team: [],
    friends: {}, // itemId -> friend growth (XP, training), see friends.js
    completedSets: [],
    masteredWords: 0,
    superProgress: 0, // mastered words toward the next Super Pack
    superPacks: 0,
    look: { color: 'color-sky', hero: 'hero-cat', hat: null },
    stats: { answered: 0, correct: 0 },
  };
}

export function wordKey(word) {
  return normalize(word);
}

/** Lower-case, trim, straighten iPad "smart" quotes and collapse spaces. */
export function normalize(text) {
  return text
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function checkSpelling(input, word) {
  return normalize(input) === normalize(word);
}

/**
 * Parse a pasted word list. One word per line, optionally followed by an
 * example sentence after "|", e.g. "because | I stayed in because it rained."
 * A single comma-separated line also works.
 */
export function parseWordList(text) {
  let lines = text.split(/\r?\n/);
  if (lines.filter((l) => l.trim()).length === 1 && !text.includes('|') && text.includes(',')) {
    lines = text.split(',');
  }
  return cleanEntries(
    lines.map((raw) => {
      const line = raw.replace(/^\s*(\d+[.)]|[-*•])\s+/, ''); // strip "1." or "-" list markers
      const [w, ...rest] = line.split('|');
      return { word: w, sentence: rest.join('|') };
    }),
  );
}

/**
 * Tidy typed entries ({ word, sentence }) from the word form or a pasted
 * list: trims, drops blanks and repeats, and gives each word its id. Every
 * way of adding words (one at a time now, bulk lists later) goes through here.
 */
export function cleanEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const word = String(e.word || '').replace(/\s+/g, ' ').trim();
    if (!word) continue;
    const key = wordKey(word);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: key, word, sentence: String(e.sentence || '').replace(/\s+/g, ' ').trim() });
  }
  return out;
}

/**
 * Add this week's words to the bank. New words join the bank; words already
 * in it keep their mastery and are brought back into this week's set.
 */
export function addWords(profile, entries, now) {
  const batch = now;
  const words = profile.words.map((w) => ({ ...w }));
  const srs = { ...profile.srs };
  let added = 0;
  let returning = 0;
  for (const e of entries) {
    const existing = words.find((w) => w.id === e.id);
    if (existing) {
      existing.batch = batch;
      if (e.sentence) existing.sentence = e.sentence;
      returning++;
    } else {
      words.push({ ...e, addedAt: now, batch });
      added++;
    }
    if (!srs[e.id]) srs[e.id] = newItem(e.id, now);
  }
  return { profile: { ...profile, words, srs, currentBatch: batch }, added, returning };
}

/**
 * Delete a word completely (e.g. a typo): it leaves the bank and its stars and
 * history are erased, so adding it again starts fresh. Coins, cards and packs
 * already earned are kept.
 */
export function removeWord(profile, wordId) {
  const srs = { ...profile.srs };
  const wasMastered = Boolean(srs[wordId]?.masteredAt);
  delete srs[wordId];
  return {
    ...profile,
    words: profile.words.filter((w) => w.id !== wordId),
    srs,
    masteredWords: Math.max(0, (profile.masteredWords || 0) - (wasMastered ? 1 : 0)),
  };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tips for one typed entry ({ word, sentence }), shown while the grown-up
 * types so the words and sentences come out right when read aloud.
 */
export function entryWarnings({ word, sentence }) {
  const out = [];
  const w = normalize(word).replace(/[.!?,;:]+$/, '');
  const s = normalize(sentence || '');
  if (/[0-9]|[^\p{L}\s'.-]/u.test(w)) out.push('The word has numbers or symbols in it. Check the spelling.');
  if (w.split(' ').length > 3) out.push('That looks like a sentence. Put a | between the word and its sentence.');
  if (!s) return out;
  const re = escapeRe(w);
  if (!new RegExp(`(^|[^\\p{L}'])${re}($|[^\\p{L}'])`, 'u').test(s)) out.push(`The sentence doesn't use “${w}” exactly. Use the word as spelled so the kids hear it.`);
  const startsWithWord = new RegExp(`^${re}\\s*[.:–—-]\\s*\\S`, 'u').test(s);
  const endsWithWord = new RegExp(`[.!?]\\s*[–—-]?\\s*${re}[.!?]?$`, 'u').test(s);
  if (startsWithWord || endsWithWord) out.push('Just write the sentence. The game says the word before and after it for you.');
  if (s.length > 120) out.push('Shorter sentences are easier to listen to.');
  return out;
}

/** Bring a profile saved by an older version up to date. */
export function migrateProfile(p) {
  const out = { masteredWords: 0, superProgress: 0, superPacks: 0, friends: {}, ...p };
  if (out.currentBatch == null) {
    const batch = out.createdAt || 1;
    out.words = out.words.map((w) => ({ addedAt: batch, batch, ...w }));
    out.currentBatch = batch;
  }
  return out;
}

export function currentWords(profile) {
  return profile.words.filter((w) => w.batch === profile.currentBatch);
}

export function activeItems(profile) {
  return profile.words.map((w) => profile.srs[w.id]).filter(Boolean);
}

// Older words come back now and then for review, but this week's words lead.
export const REVIEW_CHANCE = 0.2;
export const REVIEW_CHANCE_WHEN_IDLE = 0.6; // when nothing this week is due
export const MAX_REVIEW_PER_ROUND = 3;

/**
 * Pick the next word for a round. Mostly this week's words (weighted by the
 * scheduler); sometimes a due word from earlier weeks.
 */
export function pickPracticeWord(profile, now, rng = Math.random, recent = [], reviewUsed = 0) {
  const current = currentWords(profile).map((w) => profile.srs[w.id]).filter(Boolean);
  const currentIds = new Set(current.map((i) => i.id));
  const reviewDue = activeItems(profile).filter((i) => !currentIds.has(i.id) && i.seen > 0 && isDue(i, now) && !recent.includes(i.id));
  const currentBusy = current.some((i) => i.seen === 0 || isDue(i, now));
  const chance = currentBusy ? REVIEW_CHANCE : REVIEW_CHANCE_WHEN_IDLE;
  if (reviewDue.length && reviewUsed < MAX_REVIEW_PER_ROUND && (!current.length || rng() < chance)) {
    return { item: pickNext(reviewDue, now, rng, recent), review: true };
  }
  const pool = current.length ? current : activeItems(profile);
  const item = pickNext(pool, now, rng, recent);
  return item ? { item, review: false } : null;
}

/**
 * Record one answer: updates the schedule, pays coins and XP.
 * result: 'correct' | 'assisted' | 'wrong'.
 */
export function recordAnswer(profile, wordId, result, now, powers = { xp: 0 }) {
  const before = profile.srs[wordId];
  if (!before) throw new Error(`unknown word: ${wordId}`);
  const paid = earnCoins(profile, coinsForAnswer(before, result), now);
  const coins = paid.coins;
  const after = review(before, result, now);
  const mastered = before.masteredAt == null && after.masteredAt != null;
  const xp = applyXpBoost(XP_PER[result] + (mastered ? XP_PER.mastered : 0), powers);
  let next = {
    ...paid.profile,
    srs: { ...profile.srs, [wordId]: after },
    xp: profile.xp + xp,
    stats: {
      answered: profile.stats.answered + 1,
      correct: profile.stats.correct + (result === 'correct' ? 1 : 0),
    },
  };
  let legends = [];
  let weekStar = false;
  if (mastered) {
    next = rewardMastery(next);
    const claimed = claimLegends(next);
    ({ profile: next, newly: legends, star: weekStar } = claimed);
  }
  let sun, shards;
  ({ profile: next, sun, shards } = learnRewards(next, before, result, now, { mastered }));
  return { profile: next, coins, xp, mastered, legends, weekStar, sun, shards };
}
