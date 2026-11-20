// Times tables game logic: multiplication and division facts 0-12, each with
// its own mastery rating (same Leitner boxes as spelling words). Pure
// functions: they take a profile and return a new one.
import { newItem, review, isDue, pickNext, MAX_BOX, INTERVALS } from './srs.js';
import { coinsForAnswer, earnCoins, SUPER_PACK_EVERY, BOX_COINS } from './economy.js';
import { learnRewards } from './sunshine.js';
import { claimLegends } from './legend.js';
import { XP_PER, applyXpBoost } from './progress.js';

const DAY_MS = 864e5;
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

// Warm-up facts: anything with 0, 1 or 2 (5 × 0, 7 × 1, 16 ÷ 2, 12 ÷ 6 = 2).
// They're too easy to count as math facts (a tester ground the 0s for coins),
// so they stay playable but pay no coins, top out at WARMUP_MAX_BOX stars,
// never count as mastered, and give friends half XP. Mastery, Super Pack
// credit and the times-table totals only count facts with both numbers 3-12.
export const WARMUP_MAX = 2;
export const WARMUP_MAX_BOX = 2;
// A warm-up at its star cap rests this long before Smart mix asks it again
// (they are 125 of the 325 facts, and 0, 1 and 2 facts need little practice).
// It used to come back daily at a high pick weight, so about 45% of a daily
// player's math answers all year were warm-ups (sim/, 2026-11-20).
export const WARMUP_REST_DAYS = 30;
export function isWarmup(fact) {
  return fact.op === 'mul' ? Math.min(fact.a, fact.b) <= WARMUP_MAX : Math.min(fact.b, fact.answer) <= WARMUP_MAX;
}
/** Facts that count toward mastery (both numbers 3-12). */
export function trackedFacts(op) {
  return allFacts(op).filter((f) => !isWarmup(f));
}

export function mathState(profile) {
  const m = profile.math || {};
  return {
    srs: {},
    unlocked: { ...START_TABLES },
    mastered: 0,
    superCredit: 0,
    seconds: DEFAULT_SECONDS,
    stats: { answered: 0, correct: 0 },
    records: {}, // trial key -> { best, last, runs } in ms
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
 * facts already seen, unless there aren't any. Warm-ups resting at their
 * 2-star cap are left out while there are other facts to ask.
 */
export function pickFact(state, pool, now, rng = Math.random, recent = [], newUsed = 0) {
  let items = pool.map((f) => itemFor(state, f.id, now));
  // Warm-ups resting at their star cap only come up when there's little else.
  const working = items.filter((i) => !(i.box >= WARMUP_MAX_BOX && i.dueAt > now && isWarmup(factById(i.id))));
  if (working.length >= 3) items = working;
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
  const facts = tableFacts(op, table).filter((f) => !isWarmup(f));
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
export function recordFact(profile, factId, result, { mode = 'speed', now = Date.now(), powers = { xp: 0 }, ms = null } = {}) {
  const fact = factById(factId);
  if (!fact) throw new Error(`unknown fact: ${factId}`);
  const warmup = isWarmup(fact);
  const state = mathState(profile);
  const before = itemFor(state, factId, now);
  const due = before.seen === 0 || isDue(before, now);
  const practice = mode === 'practice';
  const srsResult = result === 'wrong' ? 'wrong' : result === 'correct' ? 'correct' : 'assisted';

  let after;
  let coins;
  if (srsResult === 'correct' && warmup && before.box >= WARMUP_MAX_BOX) {
    // Warm-ups stop at WARMUP_MAX_BOX stars.
    after = { ...before, seen: before.seen + 1, correct: before.correct + 1, lastResult: 'correct', dueAt: now + WARMUP_REST_DAYS * DAY_MS };
    coins = 0;
  } else if (srsResult === 'correct' && practice && before.box >= PRACTICE_MAX_BOX) {
    // Practice can't take a fact past PRACTICE_MAX_BOX stars: keep the box, reschedule.
    after = { ...before, seen: before.seen + 1, correct: before.correct + 1, lastResult: 'correct', dueAt: now + INTERVALS[before.box] };
    coins = coinsForAnswer(before, 'correct');
  } else {
    // Every in-time right answer adds a star, even before the fact is due:
    // a kid who aces the facts in one week has earned it (Jason, 2026-11-20).
    // Repeating a fact early still pays little, so coins can't be ground.
    after = review(before, srsResult, now, { daily: false });
    coins = srsResult === 'correct' && !due ? NOT_DUE_COINS : coinsForAnswer(before, srsResult);
  }
  if (warmup) {
    coins = 0;
    after = { ...after, box: Math.min(after.box, WARMUP_MAX_BOX), masteredAt: before.masteredAt ?? null };
    if (srsResult === 'correct' && after.box >= WARMUP_MAX_BOX) after.dueAt = Math.max(after.dueAt, now + WARMUP_REST_DAYS * DAY_MS);
  }
  if (ms != null && (result === 'correct' || result === 'slow')) after = withSolveTime(after, ms);
  const mastered = before.masteredAt == null && after.masteredAt != null;
  let xp = XP_PER[srsResult];
  if (practice || warmup) {
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
  const paid = earnCoins(profile, coins, now);
  coins = paid.coins;
  let next = { ...paid.profile, xp: profile.xp + xp };
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
  let legends = [];
  if (mastered) ({ profile: next, newly: legends } = claimLegends(next));
  let sun, shards;
  ({ profile: next, sun, shards } = learnRewards(next, before, srsResult, now, { warmup, mastered }));
  return { profile: next, coins, xp, mastered, superStep, battleResult: srsResult, warmup, legends, sun, shards };
}

// ---------- solve times ----------
// Each fact keeps a running average of how long right answers take (recent
// answers count most), so the slow ones stand out.
export const SOLVE_TIME_CAP_MS = 20000; // a longer pause (walked away) counts as 20 s
export const SOLVE_AVG_WEIGHT = 0.3; // weight of the newest answer

export function withSolveTime(item, ms) {
  const t = Math.min(Math.max(0, ms), SOLVE_TIME_CAP_MS);
  const timed = (item.timed || 0) + 1;
  const avgMs = item.avgMs == null ? t : Math.round(item.avgMs * (1 - SOLVE_AVG_WEIGHT) + t * SOLVE_AVG_WEIGHT);
  return { ...item, avgMs, timed, lastMs: Math.round(t) };
}

/** Facts sorted slowest first (only ones answered right at least once). */
export function slowestFacts(state, n = 8) {
  return Object.values(state.srs)
    .filter((i) => i.avgMs != null)
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, n)
    .map((i) => ({ ...factById(i.id), item: i }))
    .filter((f) => f.id);
}

export const formatSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
/** 83400 -> "1:23.4", 9800 -> "9.8s" */
export function formatTime(ms) {
  const tenths = Math.round(ms / 100);
  const min = Math.floor(tenths / 600);
  const sec = (tenths % 600) / 10;
  return min ? `${min}:${sec.toFixed(1).padStart(4, '0')}` : `${sec.toFixed(1)}s`;
}

// ---------- time trials ----------
// Beat your own time: every fact of one table in a shuffled order, against the
// clock. A wrong answer adds a penalty and has to be fixed before moving on.
// The final mission takes one fact from every × and ÷ table. Records are
// personal bests only.
export const TRIAL_PENALTY_MS = 3000;
export const TRIAL_RECORD_XP = 30; // XP (cosmetic only) for a first finish or a new best
export const FINAL_KEY = 'final';
export const FINAL_PER_TABLE = 1; // facts from each × table (0-12) and each ÷ table (1-12)

export const trialKey = (op, table) => `${op}:${table}`;

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function trialFacts(op, table, rng = Math.random) {
  return shuffle(tableFacts(op, table), rng);
}

export function finalMissionFacts(rng = Math.random) {
  const picks = [];
  for (const op of ['mul', 'div']) {
    for (let t = 0; t <= MAX_FACTOR; t++) picks.push(...shuffle(tableFacts(op, t), rng).slice(0, FINAL_PER_TABLE));
  }
  return shuffle(picks, rng);
}

export const FINAL_LENGTH = (2 * MAX_FACTOR + 1) * FINAL_PER_TABLE;

/** Save a finished run. Returns { profile, newBest, prevBest, xp }. */
export function recordTrial(profile, key, ms) {
  const state = mathState(profile);
  const prev = state.records[key];
  const newBest = !prev || ms < prev.best;
  const rec = { best: newBest ? ms : prev.best, last: ms, runs: (prev?.runs || 0) + 1 };
  const xp = newBest ? TRIAL_RECORD_XP : 0;
  return {
    profile: { ...profile, xp: profile.xp + xp, math: { ...state, records: { ...state.records, [key]: rec } } },
    newBest,
    prevBest: prev?.best ?? null,
    xp,
  };
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
