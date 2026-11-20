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

test('repeating a fact before it is due pays little and adds no star', () => {
  const p = recordFact(kid(), 'm3x4', 'correct', { now: T0 }).profile;
  const again = recordFact(p, 'm3x4', 'correct', { now: T0 + 1000 });
  assert.equal(again.coins, NOT_DUE_COINS);
  assert.equal(again.profile.math.srs.m3x4.box, 1);
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
