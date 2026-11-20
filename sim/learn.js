// Plays the learning games the way the app does, using the app's own rules
// (src/profile.js, src/vocab.js, src/math.js), with answers decided by the
// kid's memory model (memory.js). Also opens packs and Super Packs.
import { pickPracticeWord, recordAnswer, currentWords } from '../src/profile.js';
import { pickBoard, recordMatch, vocabOf, vocabItems } from '../src/vocab.js';
import { mathState, poolFor, pickFact, recordFact, maybeUnlock, isWarmup, factById, UNLOCK_ORDER } from '../src/math.js';
import { friendsAfterAnswer, teamPowersFor, friendInfo } from '../src/friends.js';
import {
  canOpenPack, openPack, openSuperPack, craft, CRAFT_COST, packCost,
} from '../src/economy.js';
import { claimSetRewards } from '../src/progress.js';
import { themesOpen, ITEMS_BY_ID } from '../src/content.js';
import { MAX_BOX } from '../src/srs.js';

const SEC = 1000;
// Rough seconds per answer, for play-time estimates.
export const ANSWER_SECONDS = { spelling: 18, vocab: 8, math: 5 };

function track(stats, game, before, res, correct) {
  const s = (stats.games[game] ||= { answers: 0, correct: 0, coins: 0, sun: 0, mastered: 0 });
  s.answers++;
  if (correct) s.correct++;
  s.coins += res.coins || 0;
  s.sun += res.sun || 0;
  if (res.mastered) s.mastered++;
  if (res.warmup) s.warmups = (s.warmups || 0) + 1;
  if (before && before.box >= MAX_BOX && before.dueAt > stats.now) s.notDueMastered = (s.notDueMastered || 0) + 1;
  stats.refreshShards += res.shards || 0;
  stats.sun += res.sun || 0;
  stats.answerCoins += res.coins || 0;
  stats.seconds += ANSWER_SECONDS[game];
  for (const l of res.legends || []) stats.legendDays.push({ id: l.id, at: stats.now });
}

function grow(p, game, correct, now) {
  return friendsAfterAnswer(p, game, correct ? 'correct' : 'wrong', now).profile;
}

/** One 10-word spelling round. */
export function spellingRound(ctx) {
  let { p, now } = ctx;
  if (!currentWords(p).length && !p.words.length) return;
  let recent = [];
  let reviewUsed = 0;
  for (let i = 0; i < 10; i++) {
    const pick = pickPracticeWord(p, now, ctx.rng, recent, reviewUsed);
    if (!pick) break;
    if (pick.review) reviewUsed++;
    const id = pick.item.id;
    const correct = ctx.mem.answer('spelling', id, now);
    ctx.stats.now = now;
    const res = recordAnswer(p, id, correct ? 'correct' : 'wrong', now, teamPowersFor(p, 'spelling'));
    p = grow(res.profile, 'spelling', correct, now);
    track(ctx.stats, 'spelling', pick.item, res, correct);
    recent = [id, ...recent].slice(0, Math.min(3, Math.max(0, currentWords(p).length - 1)));
    now += ANSWER_SECONDS.spelling * SEC;
  }
  Object.assign(ctx, { p, now });
}

/** One Word Match round: 3 boards of 4, first try counts. */
export function vocabRound(ctx) {
  let { p, now } = ctx;
  if (!vocabItems(p).length) return;
  let recent = [];
  let newLeft = 6;
  for (let b = 0; b < 3; b++) {
    const { words } = pickBoard(p, now, ctx.rng, { recent, newLeft });
    for (const w of words) {
      const item = vocabOf(p).srs[w.id];
      if (item.seen === 0) newLeft--;
      const correct = ctx.mem.answer('vocab', w.id, now);
      ctx.stats.now = now;
      const res = recordMatch(p, w.id, correct ? 'correct' : 'wrong', now, teamPowersFor(p, 'vocab'));
      p = grow(res.profile, 'vocab', correct, now);
      track(ctx.stats, 'vocab', item, res, correct);
      now += ANSWER_SECONDS.vocab * SEC;
    }
    recent = words.map((w) => w.id);
  }
  Object.assign(ctx, { p, now });
}

/** Which Smart mix op a kid plays: × until every × table is open, then ÷ and mixed. */
export function mathOp(p, rng) {
  const st = mathState(p);
  if (st.unlocked.mul < UNLOCK_ORDER.mul.length) return 'mul';
  if (st.unlocked.div < UNLOCK_ORDER.div.length) return rng() < 0.7 ? 'div' : 'mul';
  return rng() < 0.5 ? 'mix' : rng() < 0.5 ? 'div' : 'mul';
}

/** One 12-question Speed round (Smart mix). */
export function mathRound(ctx, op = mathOp(ctx.p, ctx.rng)) {
  let { p, now } = ctx;
  let recent = [];
  let newUsed = 0;
  for (let i = 0; i < 12; i++) {
    const st = mathState(p);
    const pool = poolFor(st, op);
    const f = pickFact(st, pool, now, ctx.rng, recent, newUsed);
    if (!f) break;
    const before = st.srs[f.id];
    if (!before || before.seen === 0) newUsed++;
    const warmup = isWarmup(f);
    const correct = ctx.mem.answer('math', f.id, now, { warmup });
    ctx.stats.now = now;
    const res = recordFact(p, f.id, correct ? 'correct' : 'wrong', { mode: 'speed', now, powers: teamPowersFor(p, 'math') });
    p = grow(res.profile, 'math', correct, now);
    track(ctx.stats, 'math', before, res, correct);
    recent = [f.id, ...recent].slice(0, Math.min(4, pool.length - 1));
    now += ANSWER_SECONDS.math * SEC;
  }
  // The app checks Smart mix unlocks at the end of a round.
  for (const o of ['mul', 'div']) {
    const st = mathState(p);
    const r = maybeUnlock(st, o);
    if (r.table != null) p = { ...p, math: r.state };
  }
  Object.assign(ctx, { p, now });
}

// ---------- Mastery checks used by play styles ----------
export function weekListMastered(p) {
  const cur = currentWords(p);
  return cur.length > 0 && cur.every((w) => (p.srs[w.id]?.box || 0) >= MAX_BOX);
}
export function newVocabLeft(p) {
  return vocabItems(p).filter((i) => i.seen === 0 || i.box < MAX_BOX).length;
}
export function mathLeft(p) {
  const st = mathState(p);
  let n = 0;
  for (const op of ['mul', 'div']) {
    for (let t = 3; t <= 12; t++) {
      for (let k = 3; k <= 12; k++) {
        const id = op === 'mul' ? `m${t}x${k}` : `d${t * k}/${t}`;
        if ((st.srs[id]?.box || 0) < MAX_BOX) n++;
      }
    }
  }
  return n;
}

// ---------- Packs, Super Packs, crafting ----------
const packItems = (t) => t.items.filter((i) => ['common', 'rare', 'epic'].includes(i.rarity));

/** Spend coins on packs (up to the day's cap), Super Packs, and shards on crafting. */
export function shop(ctx, { packs = true, craftWithShards = true } = {}) {
  let { p, now } = ctx;
  const themes = themesOpen(now);
  const missingIn = (t) => packItems(t).filter((i) => !p.collection[i.id]).length;
  while (p.superPacks > 0) {
    const withUltra = themes.filter((t) => t.items.some((i) => i.rarity === 'ultra' && !p.collection[i.id]));
    const theme = (withUltra.length ? withUltra[withUltra.length - 1] : themes[themes.length - 1]).id;
    const r = openSuperPack(p, theme, ctx.rng, now);
    p = r.profile;
    ctx.stats.superOpened++;
    if (r.result.gold) ctx.stats.gold++;
  }
  if (packs) {
    while (canOpenPack(p, now).ok) {
      const best = [...themes].sort((a, b) => missingIn(b) - missingIn(a))[0];
      ctx.stats.packCoins += packCost(p, now);
      const r = openPack(p, best.id, now, ctx.rng);
      p = r.profile;
      ctx.stats.packs++;
      if (r.result.duplicate) ctx.stats.dupShards += r.result.shards;
    }
  }
  if (craftWithShards) {
    for (;;) {
      const missing = themes.flatMap((t) => packItems(t)).filter((i) => !p.collection[i.id]);
      const cheapest = missing.sort((a, b) => CRAFT_COST[a.rarity] - CRAFT_COST[b.rarity])[0];
      if (!cheapest || p.shards < CRAFT_COST[cheapest.rarity]) break;
      p = craft(p, cheapest.id);
      ctx.stats.crafted++;
      ctx.stats.shardsSpent += CRAFT_COST[cheapest.rarity];
    }
  }
  p = claimSetRewards(p).profile;
  // Team: the 3 strongest friends (the app lets the kid choose; strongest is a fair guess).
  const owned = Object.keys(p.collection).filter((id) => ITEMS_BY_ID[id]);
  const strength = (id) => friendInfo(p, id, now).strength;
  p = { ...p, team: owned.sort((a, b) => strength(b) - strength(a)).slice(0, 3) };
  Object.assign(ctx, { p });
}

export { factById };
