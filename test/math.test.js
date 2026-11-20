import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allFacts, tableFacts, factById, poolFor, mathState, pickFact, recordFact, maybeUnlock, unlockedTables, factHint,
  PRACTICE_MAX_BOX, NOT_DUE_COINS, FACT_MASTERY_COINS, FACTS_PER_SUPER_STEP, MAX_NEW_PER_ROUND, START_TABLES, tableSummary, trickyFacts,
} from '../src/math.js';
import { newProfile } from '../src/profile.js';
import { BOX_COINS, SUPER_PACK_EVERY } from '../src/economy.js';
import { MAX_BOX } from '../src/srs.js';
import { mulberry32 } from '../src/rng.js';

const T0 = new Date(2026, 10, 19, 15).getTime();
const DAY = 24 * 3600e3;
const kid = () => newProfile('Ava', T0, 'kid-a');

test('fact sets: 0-12 times tables and division without ÷0', () => {
  assert.equal(allFacts('mul').length, 169);
  assert.equal(allFacts('div').length, 156);
  assert.equal(tableFacts('div', 0).length, 0);
  for (const f of allFacts('div')) {
    assert.ok(Number.isInteger(f.answer));
    assert.equal(f.a / f.b, f.answer);
  }
  assert.equal(new Set(allFacts('mix').map((f) => f.id)).size, 325);
});

test('fact ids round-trip', () => {
  for (const f of allFacts('mix')) assert.deepEqual(factById(f.id), f);
  assert.equal(factById('m3x'), null);
  assert.equal(factById('d5/0'), null);
});

test('smart mix starts with the easy tables and a single table can always be picked', () => {
  const s = mathState(kid());
  assert.deepEqual(unlockedTables(s, 'mul'), [0, 1, 2, 10, 5]);
  assert.equal(poolFor(s, 'mul').length, START_TABLES.mul * 13);
  assert.equal(poolFor(s, 'mul', 7).length, 13);
  assert.equal(poolFor(s, 'mix', 7).length, 26);
  assert.equal(poolFor(s, 'mix').length, START_TABLES.mul * 13 + START_TABLES.div * 13);
});

test('the next table opens once most open facts have 2 stars', () => {
  let s = mathState(kid());
  assert.equal(maybeUnlock(s, 'mul').table, null);
  const srs = {};
  for (const f of poolFor(s, 'mul')) srs[f.id] = { id: f.id, box: 2, seen: 2 };
  s = { ...s, srs };
  const r = maybeUnlock(s, 'mul');
  assert.equal(r.table, 11);
  assert.equal(r.state.unlocked.mul, START_TABLES.mul + 1);
});

test('a round introduces only a few new facts', () => {
  const p = kid();
  const s = mathState(p);
  const pool = poolFor(s, 'mul');
  // Some facts seen already.
  const srs = {};
  for (const f of pool.slice(0, 5)) srs[f.id] = { id: f.id, box: 1, seen: 1, dueAt: T0 - 1, misses: 0 };
  const rng = mulberry32(3);
  for (let i = 0; i < 30; i++) {
    const f = pickFact({ ...s, srs }, pool, T0, rng, [], MAX_NEW_PER_ROUND);
    assert.ok(srs[f.id], 'only seen facts after the new-fact limit');
  }
});

test('speed answers in time earn stars and full coins; practice pays half and caps stars', () => {
  let p = kid();
  const r = recordFact(p, 'm7x8', 'correct', { mode: 'speed', now: T0 });
  assert.equal(r.coins, BOX_COINS[0]);
  assert.equal(r.profile.math.srs.m7x8.box, 1);
  const pr = recordFact(p, 'm7x8', 'correct', { mode: 'practice', now: T0 });
  assert.equal(pr.coins, Math.floor(BOX_COINS[0] / 2));
  assert.equal(pr.profile.math.srs.m7x8.box, 1);

  // Practice can't go past PRACTICE_MAX_BOX.
  p = { ...p, math: { ...mathState(p), srs: { m7x8: { id: 'm7x8', box: PRACTICE_MAX_BOX, seen: 5, correct: 5, misses: 0, dueAt: T0, masteredAt: null, lastResult: 'correct' } } } };
  const capped = recordFact(p, 'm7x8', 'correct', { mode: 'practice', now: T0 });
  assert.equal(capped.profile.math.srs.m7x8.box, PRACTICE_MAX_BOX);
  assert.ok(capped.profile.math.srs.m7x8.dueAt > T0);
  const up = recordFact(p, 'm7x8', 'correct', { mode: 'speed', now: T0 });
  assert.equal(up.profile.math.srs.m7x8.box, PRACTICE_MAX_BOX + 1);
});

test('slow or hinted answers keep the star count and pay half; wrong resets', () => {
  let p = recordFact(kid(), 'd56/8', 'correct', { now: T0 }).profile;
  const later = T0 + DAY;
  const slow = recordFact(p, 'd56/8', 'slow', { now: later });
  assert.equal(slow.profile.math.srs['d56/8'].box, 1);
  assert.equal(slow.coins, Math.floor(BOX_COINS[1] / 2));
  assert.equal(slow.battleResult, 'assisted');
  const wrong = recordFact(p, 'd56/8', 'wrong', { now: later });
  assert.equal(wrong.coins, 0);
  assert.equal(wrong.profile.math.srs['d56/8'].box, 0);
});

test('repeating a fact before it is due still adds a star (no waiting) but pays little', () => {
  let p = recordFact(kid(), 'm3x4', 'correct', { now: T0 }).profile;
  const again = recordFact(p, 'm3x4', 'correct', { now: T0 + 1000 });
  assert.equal(again.coins, NOT_DUE_COINS);
  assert.equal(again.profile.math.srs.m3x4.box, 2);
  // A kid can master a fact in one sitting.
  p = again.profile;
  for (let i = 0; i < 3; i++) p = recordFact(p, 'm3x4', 'correct', { now: T0 + 2000 + i }).profile;
  assert.equal(p.math.srs.m3x4.box, MAX_BOX);
  assert.ok(p.math.srs.m3x4.masteredAt != null);
});

test('mastering facts pays once and every few facts step toward a Super Pack', () => {
  let p = kid();
  const master = (prof, id) => {
    const s = mathState(prof);
    const item = { id, box: MAX_BOX - 1, seen: 4, correct: 4, misses: 0, dueAt: T0, masteredAt: null, lastResult: 'correct' };
    return recordFact({ ...prof, math: { ...s, srs: { ...s.srs, [id]: item } } }, id, 'correct', { now: T0 });
  };
  const r1 = master(p, 'm6x7');
  assert.ok(r1.mastered);
  assert.equal(r1.profile.coins, r1.coins + FACT_MASTERY_COINS);
  assert.equal(r1.profile.math.mastered, 1);
  assert.equal(r1.profile.superProgress || 0, FACTS_PER_SUPER_STEP === 1 ? 1 : 0);
  p = r1.profile;
  const r2 = master(p, 'm7x6');
  assert.ok(r2.superStep);
  assert.equal(r2.profile.superProgress, 1);
  // A full Super Pack takes SUPER_PACK_EVERY steps.
  p = { ...r2.profile, superProgress: SUPER_PACK_EVERY - 1, math: { ...r2.profile.math, superCredit: FACTS_PER_SUPER_STEP - 1 } };
  const r3 = master(p, 'm8x8');
  assert.equal(r3.profile.superPacks, 1);
  assert.equal(r3.profile.superProgress, 0);
  // Spelling's mastered-word count is untouched.
  assert.equal(r3.profile.masteredWords, 0);
});

test('summaries and hints', () => {
  let p = kid();
  p = recordFact(p, 'm9x9', 'wrong', { now: T0 }).profile;
  p = recordFact(p, 'm9x9', 'wrong', { now: T0 + 1 }).profile;
  const s = mathState(p);
  assert.equal(trickyFacts(s)[0].text, '9 × 9');
  assert.equal(tableSummary(s, 'mul', 9).seen, 1);
  assert.match(factHint(factById('m7x8')), /Count by 7s, 8 times: 7, 14, 21/);
  assert.match(factHint(factById('d56/8')), /Count by 8s until you reach 56/);
  assert.match(factHint(factById('m0x5')), /0/);
});

test('unknown fact throws', () => {
  assert.throws(() => recordFact(kid(), 'nope', 'correct', { now: T0 }));
});

import { withSolveTime, slowestFacts, formatTime, trialFacts, finalMissionFacts, recordTrial, trialKey, FINAL_KEY, FINAL_LENGTH, SOLVE_TIME_CAP_MS, TRIAL_RECORD_XP } from '../src/math.js';

test('solve times: running average per fact, slowest first', () => {
  let p = kid();
  p = recordFact(p, 'm7x8', 'correct', { now: T0, ms: 6000 }).profile;
  p = recordFact(p, 'm2x2', 'correct', { now: T0, ms: 1000 }).profile;
  p = recordFact(p, 'm3x3', 'wrong', { now: T0, ms: 500 }).profile; // wrong answers aren't timed
  const s = mathState(p);
  assert.equal(s.srs.m7x8.avgMs, 6000);
  assert.equal(s.srs.m3x3.avgMs, undefined);
  assert.deepEqual(slowestFacts(s).map((f) => f.id), ['m7x8', 'm2x2']);
  // Recent answers count most; long pauses are capped.
  const item = withSolveTime(withSolveTime({ id: 'x' }, 6000), 2000);
  assert.ok(item.avgMs < 6000 && item.avgMs > 2000);
  assert.equal(withSolveTime({ id: 'x' }, 999999).avgMs, SOLVE_TIME_CAP_MS);
  assert.equal(item.timed, 2);
});

test('time formatting', () => {
  assert.equal(formatTime(9840), '9.8s');
  assert.equal(formatTime(83400), '1:23.4');
  assert.equal(formatTime(60000), '1:00.0');
});

test('time trials: every fact of the table, final mission covers every table', () => {
  const rng = mulberry32(5);
  const t = trialFacts('mul', 7, rng);
  assert.equal(t.length, 13);
  assert.equal(new Set(t.map((f) => f.id)).size, 13);
  const fin = finalMissionFacts(rng);
  assert.equal(fin.length, FINAL_LENGTH);
  const tables = new Set(fin.map((f) => `${f.op}${f.table}`));
  assert.equal(tables.size, 25);
});

test('trial records keep the personal best', () => {
  let p = kid();
  let r = recordTrial(p, trialKey('mul', 7), 40000);
  assert.ok(r.newBest);
  assert.equal(r.xp, TRIAL_RECORD_XP);
  r = recordTrial(r.profile, trialKey('mul', 7), 45000);
  assert.ok(!r.newBest);
  assert.equal(r.xp, 0);
  assert.equal(r.prevBest, 40000);
  r = recordTrial(r.profile, trialKey('mul', 7), 30000);
  assert.ok(r.newBest);
  assert.deepEqual(mathState(r.profile).records['mul:7'], { best: 30000, last: 30000, runs: 3 });
  assert.equal(mathState(recordTrial(r.profile, FINAL_KEY, 90000).profile).records.final.best, 90000);
});

test('facts with 0, 1 or 2 are warm-ups: no coins, at most 2 stars, never mastered', async () => {
  const { isWarmup, trackedFacts, WARMUP_MAX_BOX } = await import('../src/math.js');
  assert.equal(trackedFacts('mul').length, 100);
  assert.equal(trackedFacts('div').length, 100);
  assert.ok(isWarmup(factById('m0x7')) && isWarmup(factById('m7x1')) && isWarmup(factById('m2x9')));
  assert.ok(isWarmup(factById('d14/2')) && isWarmup(factById('d12/6')));
  assert.ok(!isWarmup(factById('m3x3')) && !isWarmup(factById('d21/7')));

  let p = kid();
  let now = T0;
  let coins = 0;
  for (let i = 0; i < 40; i++) {
    const r = recordFact(p, 'm0x5', 'correct', { mode: 'speed', now });
    coins += r.coins;
    assert.equal(r.mastered, false);
    assert.equal(r.superStep, false);
    p = r.profile;
    now += DAY;
  }
  assert.equal(coins, 0);
  assert.equal(p.coins, 0);
  const item = mathState(p).srs['m0x5'];
  assert.equal(item.box, WARMUP_MAX_BOX);
  assert.equal(item.masteredAt, null);
  assert.equal(mathState(p).mastered, 0);
  assert.equal(tableSummary(mathState(p), 'mul', 0).total, 0, 'the 0s table has nothing to master');
  assert.equal(tableSummary(mathState(p), 'mul', 5).total, 10, '5 × 3 … 5 × 12');
});

test('Smart mix still opens tables when the warm-ups reach their 2 stars', () => {
  let p = kid();
  let now = T0;
  let s = mathState(p);
  for (const f of poolFor(s, 'mul')) for (let k = 0; k < 2; k++) {
    p = recordFact(p, f.id, 'correct', { mode: 'speed', now }).profile;
    now += DAY;
  }
  const { table } = maybeUnlock(mathState(p), 'mul');
  assert.notEqual(table, null);
});

test('a warm-up at its star cap rests a month, so Smart mix spends its time on real facts', async () => {
  const { WARMUP_REST_DAYS, WARMUP_MAX_BOX } = await import('../src/math.js');
  let p = kid();
  for (let k = 0; k < 3; k++) p = recordFact(p, 'm1x7', 'correct', { mode: 'speed', now: T0 + k * 1000 }).profile;
  const item = mathState(p).srs['m1x7'];
  assert.equal(item.box, WARMUP_MAX_BOX);
  assert.ok(item.dueAt >= T0 + WARMUP_REST_DAYS * DAY);
  // A miss still brings it back soon.
  p = recordFact(p, 'm1x7', 'wrong', { mode: 'speed', now: T0 + DAY }).profile;
  assert.ok(mathState(p).srs['m1x7'].dueAt < T0 + 2 * DAY);
});
