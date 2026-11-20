import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newItem, review, pickNext, weightFor, INTERVALS, MAX_BOX, NOT_DUE_WEIGHT, isMastered, masterySummary, STAR_RULES } from '../src/srs.js';
import { mulberry32 } from '../src/rng.js';

const T0 = Date.UTC(2026, 10, 19, 15);

test('correct answers climb boxes with growing intervals', () => {
  let item = newItem('cat', T0);
  let now = T0;
  for (let box = 1; box <= MAX_BOX; box++) {
    item = review(item, 'correct', now);
    assert.equal(item.box, box);
    assert.equal(item.dueAt, now + INTERVALS[box]);
    now = item.dueAt;
  }
  assert.ok(isMastered(item));
  item = review(item, 'correct', now);
  assert.equal(item.box, MAX_BOX, 'box is capped');
});

test('a miss sends the word back to box 0 and makes it due soon', () => {
  let item = newItem('cat', T0);
  item = review(review(review(item, 'correct', T0), 'correct', T0), 'correct', T0);
  assert.equal(item.box, 3);
  item = review(item, 'wrong', T0);
  assert.equal(item.box, 0);
  assert.equal(item.misses, 1);
  assert.equal(item.dueAt, T0 + INTERVALS[0]);
});

test('a hinted answer keeps the box but comes back soon', () => {
  let item = review(newItem('cat', T0), 'correct', T0);
  item = review(item, 'assisted', T0);
  assert.equal(item.box, 1);
  assert.equal(item.dueAt, T0 + INTERVALS[0]);
  assert.equal(item.lastResult, 'assisted');
});

test('review does not mutate its input', () => {
  const item = newItem('cat', T0);
  review(item, 'correct', T0);
  assert.equal(item.box, 0);
  assert.equal(item.seen, 0);
});

test('missed and lower-box words weigh more than solid ones', () => {
  const later = T0 + 30 * 24 * 3600e3;
  const solid = { ...newItem('a', T0), seen: 5, box: 4, misses: 0 };
  const shaky = { ...newItem('b', T0), seen: 5, box: 0, misses: 0 };
  const missedOften = { ...shaky, id: 'c', misses: 3 };
  assert.ok(weightFor(shaky, later) > weightFor(solid, later));
  assert.ok(weightFor(missedOften, later) > weightFor(shaky, later));
  const notDue = { ...solid, dueAt: later + 1 };
  assert.equal(weightFor(notDue, later), NOT_DUE_WEIGHT);
});

test('pickNext favours missed words over many picks', () => {
  const rng = mulberry32(42);
  const now = T0 + 3600e3;
  const items = [
    { ...newItem('missed', T0), seen: 3, misses: 3, box: 0, dueAt: T0 },
    { ...newItem('known', T0), seen: 3, box: 4, dueAt: now + 1e9 },
    { ...newItem('ok', T0), seen: 3, box: 2, dueAt: T0 },
  ];
  const counts = { missed: 0, known: 0, ok: 0 };
  for (let i = 0; i < 2000; i++) counts[pickNext(items, now, rng).id]++;
  assert.ok(counts.missed > counts.ok, JSON.stringify(counts));
  assert.ok(counts.ok > counts.known, JSON.stringify(counts));
  assert.ok(counts.known > 0, 'not-due words still show up now and then');
});

test('pickNext avoids recently asked words unless nothing else is left', () => {
  const rng = mulberry32(1);
  const items = [newItem('a', T0), newItem('b', T0)];
  for (let i = 0; i < 50; i++) assert.equal(pickNext(items, T0, rng, ['a']).id, 'b');
  assert.equal(pickNext([items[0]], T0, rng, ['a']).id, 'a');
  assert.equal(pickNext([], T0, rng), undefined);
});

test('masterySummary buckets words', () => {
  const items = [
    newItem('a', T0),
    { ...newItem('b', T0), seen: 1, box: 1 },
    { ...newItem('c', T0), seen: 9, box: MAX_BOX, dueAt: T0 + 1e9 },
    { ...newItem('d', T0), seen: 9, box: MAX_BOX, dueAt: T0 - 1 },
  ];
  assert.deepEqual(masterySummary(items, T0), { new: 1, learning: 1, mastered: 1, refresh: 1 });
});

test('mastered items need a refresh later; each refresh waits longer; problem items come back sooner', async () => {
  const { needsRefresh, refreshInterval, REFRESH_DAYS, PROBLEM_MISSES } = await import('../src/srs.js');
  const DAY = 24 * 3600e3;
  let item = { ...newItem('w', T0), box: MAX_BOX - 1, seen: 4, correct: 4 };
  item = review(item, 'correct', T0);
  assert.equal(item.box, MAX_BOX);
  assert.equal(item.dueAt, T0 + REFRESH_DAYS[0] * DAY);
  assert.ok(!needsRefresh(item, T0 + DAY));
  const later = item.dueAt + 1;
  assert.ok(needsRefresh(item, later));
  assert.ok(weightFor(item, later) > weightFor({ ...item, box: 3 }, later), 'refreshes come up more than strong words');
  // Answering early doesn't count as a refresh.
  assert.equal(review(item, 'correct', T0 + DAY).refreshes || 0, 0);
  const refreshed = review(item, 'correct', later);
  assert.equal(refreshed.refreshes, 1);
  assert.equal(refreshed.dueAt, later + REFRESH_DAYS[1] * DAY);
  assert.ok(!needsRefresh(refreshed, later + DAY));
  const problem = { ...item, misses: PROBLEM_MISSES };
  assert.equal(refreshInterval(problem), refreshInterval(item) / 2);
  // A miss on a mastered word sends it back to the start (mastery reward is kept).
  const missed = review(item, 'wrong', later);
  assert.equal(missed.box, 0);
  assert.equal(missed.masteredAt, item.masteredAt);
});

test('optional star rules: one star a day from dailyFrom up, and a miss costing missDrop stars', () => {
  const saved = { ...STAR_RULES };
  try {
    Object.assign(STAR_RULES, { dailyFrom: 2, missDrop: 2 });
    let item = newItem('cat', T0);
    let now = T0;
    for (let i = 0; i < 6; i++) item = review(item, 'correct', (now += 60e3));
    assert.equal(item.box, 2, 'two stars on the first day');
    assert.equal(item.correct, 6, 'right answers still count');
    item = review(item, 'correct', T0 + 86400e3);
    item = review(item, 'correct', T0 + 86400e3 + 60e3);
    assert.equal(item.box, 3, 'then one star a day');
    assert.equal(review(item, 'wrong', T0 + 86400e3 + 120e3).box, 1, 'a miss costs 2 stars');
    assert.equal(review(newItem('dog', T0), 'correct', T0, { daily: false }).box, 1);
    let fast = newItem('dog', T0);
    for (let i = 0; i < 5; i++) fast = review(fast, 'correct', T0 + i, { daily: false });
    assert.equal(fast.box, MAX_BOX, 'games can opt out (math)');
  } finally {
    Object.assign(STAR_RULES, saved);
  }
});
