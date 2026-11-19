import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newItem, review, pickNext, weightFor, INTERVALS, MAX_BOX, NOT_DUE_WEIGHT, isMastered, masterySummary } from '../src/srs.js';
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
    { ...newItem('c', T0), seen: 9, box: MAX_BOX },
  ];
  assert.deepEqual(masterySummary(items), { new: 1, learning: 1, mastered: 1 });
});
