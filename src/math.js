// Times tables game logic: multiplication and division facts 0-12, each with
// its own mastery rating (same Leitner boxes as spelling words). Pure
// functions: they take a profile and return a new one.
import { newItem, review, isDue, pickNext, MAX_BOX, INTERVALS } from './srs.js';
import { coinsForAnswer, SUPER_PACK_EVERY, BOX_COINS } from './economy.js';
import { XP_PER, applyXpBoost } from './progress.js';

export const GAME_TYPE = 'math';
export const MAX_FACTOR = 12;
export const OPS = {
  mul: { label: 'Multiply', symbol: '×' },
  div: { label: 'Divide', symbol: '÷' },
  mix: { label: 'Mixed', symbol: '×÷' },
};
export const MODES = {
  practice: { label: 'Practice', emoji: '🐢' },
  speed: { label: 'Speed', emoji: '⚡' },
};

// Tables open up in this order in "Smart mix" (easy ones first). A kid can
// always pick any single table to focus on.
export const UNLOCK_ORDER = { mul: [0, 1, 2, 10, 5, 11, 3, 4, 9, 6, 8, 7, 12], div: [1, 2, 10, 5, 11, 3, 4, 9, 6, 8, 7, 12] };
export const START_TABLES = { mul: 5, div: 4 };
// The next table opens when this share of the open facts has 2+ stars.
export const UNLOCK_SHARE = 0.8;
export const UNLOCK_STARS = 2;

export const ROUND_LENGTH = 12;
export const MAX_NEW_PER_ROUND = 5; // new facts per round, so it's never a wall of new stuff

// Practice (no timer): half coins and XP, and a fact can only reach this many
// stars. Mastering a fact takes answering it quickly in Speed mode.
export const PRACTICE_MAX_BOX = 3;
export const PRACTICE_REWARD = 0.5;
// Speed mode: seconds per question. A right answer after the time runs out
// still hits the monster, but counts like a hinted answer (no new star, half coins).
export const SECONDS_CHOICES = [4, 6, 8, 10, 15];
export const DEFAULT_SECONDS = 6;
// A fact that isn't due yet pays this little, so repeating easy facts isn't worth it.
export const NOT_DUE_COINS = BOX_COINS[MAX_BOX];

// Mastery rewards: facts are quicker to learn than spelling words, so they pay
// less and it takes FACTS_PER_SUPER_STEP mastered facts for one step toward a Super Pack.
export const FACT_MASTERY_COINS = 15;
export const FACT_MASTERY_XP = 25;
export const FACTS_PER_SUPER_STEP = 2;

export function mathState(profile) {
  const m = profile.math || {};
  return {
    srs: {},
    unlocked: { ...START_TABLES },
    mastered: 0,
    superCredit: 0,
    seconds: DEFAULT_SECONDS,
    stats: { answered: 0, correct: 0 },
    ...m,
  };
}

// ---------- facts ----------
export function mulFact(table, n) {
  return { id: `m${table}x${n}`, op: 'mul', table, a: table, b: n, answer: table * n, text: `${table} × ${n}` };
}
export function divFact(table, n) {
  return { id: `d${table * n}/${table}`, op: 'div', table, a: table * n, b: table, answer: n, text: `${table * n} ÷ ${table}` };
}

const range = (n) => Array.from({ length: n + 1 }, (_, i) => i);

export function tableFacts(op, table) {
  if (op === 'mul') return range(MAX_FACTOR).map((n) => mulFact(table, n));
  if (op === 'div') return table === 0 ? [] : range(MAX_FACTOR).map((n) => divFact(table, n));
  return [...tableFacts('mul', table), ...tableFacts('div', table)];
}

export function allFacts(op) {
  return range(MAX_FACTOR).flatMap((t) => tableFacts(op, t));
}

export function factById(id) {
  let m = /^m(\d+)x(\d+)$/.exec(id);
  if (m) return mulFact(Number(m[1]), Number(m[2]));
  m = /^d(\d+)\/(\d+)$/.exec(id);
  if (m && Number(m[2]) > 0) return divFact(Number(m[2]), Number(m[1]) / Number(m[2]));
  return null;
}

export function unlockedTables(state, op) {
  return UNLOCK_ORDER[op].slice(0, state.unlocked[op]);
}

/** Facts for a round: one table, or every open table ("Smart mix", table = null). */
export function poolFor(state, op, table = null) {
  if (table != null) return tableFacts(op, table);
  if (op === 'mix') return [...poolFor(state, 'mul'), ...poolFor(state, 'div')];
  return unlockedTables(state, op).flatMap((t) => tableFacts(op, t));
}

export const itemFor = (state, factId, now) => state.srs[factId] || newItem(factId, now);

/**
 * Choose the next fact. Uses the spelling scheduler's weights (missed and
 * low-star facts come up more); after MAX_NEW_PER_ROUND new facts, only
 * facts already seen, unless there aren't any.
 */
export function pickFact(state, pool, now, rng = Math.random, recent = [], newUsed = 0) {
  let items = pool.map((f) => itemFor(state, f.id, now));
  if (newUsed >= MAX_NEW_PER_ROUND) {
    const seen = items.filter((i) => i.seen > 0);
    if (seen.length >= 3) items = seen;
  }
  const item = pickNext(items, now, rng, recent);
  return item ? factById(item.id) : null;
}

/** Open the next Smart mix table once most open facts have a couple of stars. */
export function maybeUnlock(state, op) {
  const order = UNLOCK_ORDER[op];
  if (state.unlocked[op] >= order.length) return { state, table: null };
  const facts = poolFor(state, op);
  const strong = facts.filter((f) => (state.srs[f.id]?.box || 0) >= UNLOCK_STARS).length;
  if (strong < facts.length * UNLOCK_SHARE) return { state, table: null };
  const table = order[state.unlocked[op]];
  return { state: { ...state, unlocked: { ...state.unlocked, [op]: state.unlocked[op] + 1 } }, table };
}

/** 0-5 stars per table, from the share of its facts mastered-ish (average box). */
export function tableSummary(state, op, table) {
  const facts = tableFacts(op, table);
  const boxes = facts.map((f) => state.srs[f.id]?.box || 0);
  const seen = facts.filter((f) => state.srs[f.id]?.seen).length;
  return {
    stars: facts.length ? Math.floor(boxes.reduce((a, b) => a + b, 0) / facts.length) : 0,
    mastered: facts.filter((f) => state.srs[f.id]?.masteredAt != null && state.srs[f.id].box >= MAX_BOX).length,
    seen,
    total: facts.length,
  };
}

/** The facts missed most (for the grown-ups screen). */
export function trickyFacts(state, n = 6) {
  return Object.values(state.srs)
    .filter((i) => i.misses > 0 && i.box < MAX_BOX)
    .sort((a, b) => b.misses - a.misses || a.box - b.box)
    .slice(0, n)
    .map((i) => ({ ...factById(i.id), item: i }))
    .filter((f) => f.id);
}

// ---------- answering ----------
/**
 * Record one answer.
 * result: 'correct' (in time), 'slow' (right, after the timer), 'hinted', or 'wrong'.
 * mode: 'practice' or 'speed'.
 * Returns { profile, coins, xp, mastered, superStep, battleResult }.
 */
export function recordFact(profile, factId, result, { mode = 'speed', now = Date.now(), powers = { xp: 0 } } = {}) {
  if (!factById(factId)) throw new Error(`unknown fact: ${factId}`);
  const state = mathState(profile);
  const before = itemFor(state, factId, now);
  const due = before.seen === 0 || isDue(before, now);
  const practice = mode === 'practice';
  const srsResult = result === 'wrong' ? 'wrong' : result === 'correct' ? 'correct' : 'assisted';

  let after;
  let coins;
  if (srsResult === 'correct' && !due) {
    // Asked again before it was due: no new star, small pay.
    after = { ...before, seen: before.seen + 1, correct: before.correct + 1, lastResult: 'correct' };
    coins = NOT_DUE_COINS;
  } else if (srsResult === 'correct' && practice && before.box >= PRACTICE_MAX_BOX) {
    // Practice can't take a fact past PRACTICE_MAX_BOX stars: keep the box, reschedule.
    after = { ...before, seen: before.seen + 1, correct: before.correct + 1, lastResult: 'correct', dueAt: now + INTERVALS[before.box] };
    coins = coinsForAnswer(before, 'correct');
  } else {
    after = review(before, srsResult, now);
    coins = coinsForAnswer(before, srsResult);
  }
  const mastered = before.masteredAt == null && after.masteredAt != null;
  let xp = XP_PER[srsResult];
  if (practice) {
    coins = Math.floor(coins * PRACTICE_REWARD);
    xp = Math.floor(xp * PRACTICE_REWARD);
  }
  if (mastered) xp += FACT_MASTERY_XP;
  xp = applyXpBoost(xp, powers);

  const nextState = {
    ...state,
    srs: { ...state.srs, [factId]: after },
    stats: { answered: state.stats.answered + 1, correct: state.stats.correct + (srsResult === 'wrong' ? 0 : 1) },
  };
  let next = { ...profile, coins: profile.coins + coins, xp: profile.xp + xp };
  let superStep = false;
  if (mastered) {
    nextState.mastered = state.mastered + 1;
    nextState.superCredit = state.superCredit + 1;
    next.coins += FACT_MASTERY_COINS;
    if (nextState.superCredit >= FACTS_PER_SUPER_STEP) {
      nextState.superCredit -= FACTS_PER_SUPER_STEP;
      superStep = true;
      const progress = (profile.superProgress || 0) + 1;
      next.superProgress = progress % SUPER_PACK_EVERY;
      next.superPacks = (profile.superPacks || 0) + Math.floor(progress / SUPER_PACK_EVERY);
    }
  }
  next.math = nextState;
  return { profile: next, coins, xp, mastered, superStep, battleResult: srsResult };
}

/** A skip-counting clue: "Count by 7s, 8 times: 7, 14, 21, …" */
export function factHint(fact) {
  const step = fact.op === 'mul' ? fact.a : fact.b;
  if (step === 0) return 'Anything times 0 is 0.';
  if (fact.op === 'mul' && fact.b === 0) return 'Anything times 0 is 0.';
  if (fact.op === 'div' && fact.a === 0) return '0 split into groups is 0.';
  const first = [1, 2, 3].map((k) => step * k).join(', ');
  return fact.op === 'mul'
    ? `Count by ${step}s, ${fact.b} time${fact.b === 1 ? '' : 's'}: ${first}, …`
    : `Count by ${step}s until you reach ${fact.a}: ${first}, … How many counts?`;
}
