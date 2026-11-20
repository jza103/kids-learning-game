import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  friendsAfterAnswer, teamPowersFor, friendInfo, friendLevel, friendXpForLevel, teamStatus, knowsGame, friendGains,
  DAILY_FRIEND_XP, DAILY_TRAINING, TRAINING_TO_LEARN, FRIEND_XP, MAX_BUDDY_BOOST, buddyBoost,
} from '../src/friends.js';
import { ALL_ITEMS, ITEMS_BY_ID, THEMES } from '../src/content.js';
import { GAME_TYPE_IDS } from '../src/games.js';
import { newProfile, migrateProfile } from '../src/profile.js';

const T0 = new Date(2026, 10, 19, 15).getTime();
const DAY = 24 * 3600e3;
const spellingFriend = 'ocean-shark'; // power, spelling
const mathFriend = 'ocean-crab'; // shield, math
const withTeam = (team) => ({ ...newProfile('Kid', T0), team, collection: Object.fromEntries(team.map((id) => [id, 1])) });

function play(p, gameType, answers, now, opts) {
  const events = [];
  for (let i = 0; i < answers; i++) {
    const r = friendsAfterAnswer(p, gameType, 'correct', now, opts);
    p = r.profile;
    events.push(...r.events);
  }
  return { profile: p, events };
}

test('every friend has a known specialty and each theme covers every game type', () => {
  for (const item of ALL_ITEMS) assert.ok(GAME_TYPE_IDS.includes(item.specialty), item.id);
  for (const t of THEMES) for (const g of GAME_TYPE_IDS) assert.ok(t.items.filter((i) => i.specialty === g).length >= 3, `${t.id} ${g}`);
});

test('a friend only gives its power in game types it knows', () => {
  const p = withTeam([spellingFriend, mathFriend]);
  assert.deepEqual(teamPowersFor(p, 'spelling'), { hint: 0, power: 2, shield: 0, xp: 0, buddy: 0 });
  assert.deepEqual(teamPowersFor(p, 'math'), { hint: 0, power: 0, shield: 1, xp: 0, buddy: 0 });
  assert.deepEqual(teamPowersFor(p, 'vocab'), { hint: 0, power: 0, shield: 0, xp: 0, buddy: 0 });
  const status = teamStatus(p, 'spelling');
  assert.deepEqual(status.map((s) => s.helps), [true, false]);
});

test('friends off their specialty earn more XP and training; wrong answers give no training', () => {
  const p = withTeam([spellingFriend, mathFriend]);
  const { profile } = friendsAfterAnswer(p, 'spelling', 'correct', T0);
  assert.equal(profile.friends[spellingFriend].xp, FRIEND_XP.correct);
  assert.ok(profile.friends[mathFriend].xp > FRIEND_XP.correct);
  assert.equal(profile.friends[mathFriend].train.spelling, 1);
  assert.equal(profile.friends[spellingFriend].train.spelling, undefined);
  const wrong = friendsAfterAnswer(p, 'spelling', 'wrong', T0).profile;
  assert.equal(wrong.friends[mathFriend].train.spelling, undefined);
  assert.ok(wrong.friends[mathFriend].xp >= 1);
});

test('practice mode pays half friend XP', () => {
  const p = withTeam([spellingFriend]);
  const full = friendsAfterAnswer(p, 'spelling', 'correct', T0).profile.friends[spellingFriend].xp;
  const half = friendsAfterAnswer(p, 'spelling', 'correct', T0, { practice: true }).profile.friends[spellingFriend].xp;
  assert.equal(half, full / 2);
});

test('daily caps stop friend XP and training until tomorrow', () => {
  let p = withTeam([mathFriend]);
  p = play(p, 'spelling', 500, T0).profile;
  const s = p.friends[mathFriend];
  assert.equal(s.xpToday, DAILY_FRIEND_XP);
  assert.equal(s.xp, DAILY_FRIEND_XP);
  assert.equal(s.train.spelling, DAILY_TRAINING);
  assert.ok(friendInfo(p, mathFriend, T0).tiredToday);
  p = play(p, 'spelling', 1, T0 + DAY).profile;
  assert.ok(p.friends[mathFriend].xp > DAILY_FRIEND_XP);
  assert.equal(p.friends[mathFriend].train.spelling, DAILY_TRAINING + 1);
});

test('learning a game type takes several days, then the power works there', () => {
  let p = withTeam([mathFriend]);
  let learnedOn = null;
  for (let day = 0; day < 30 && learnedOn === null; day++) {
    const r = play(p, 'spelling', 200, T0 + day * DAY);
    p = r.profile;
    if (r.events.some((e) => e.type === 'learned')) learnedOn = day;
  }
  assert.equal(learnedOn, TRAINING_TO_LEARN / DAILY_TRAINING - 1);
  assert.ok(knowsGame(p, mathFriend, 'spelling'));
  assert.equal(teamPowersFor(p, 'spelling').shield, 1);
  // Before Best Friend, one extra game type only: no training in vocab.
  p = play(p, 'vocab', 50, T0 + 40 * DAY).profile;
  assert.equal(p.friends[mathFriend].train.vocab, undefined);
});

test('pacing: even with unlimited play, Super Friend takes 10 days and Best Friend 45', () => {
  let p = withTeam([spellingFriend]);
  const reached = {};
  for (let day = 0; day < 60; day++) {
    const r = play(p, 'spelling', 300, T0 + day * DAY);
    p = r.profile;
    for (const e of r.events) if (e.type === 'evolve') reached[e.stage] = day + 1;
  }
  assert.equal(reached['Super Friend'], friendXpForLevel(5) / DAILY_FRIEND_XP);
  assert.equal(reached['Best Friend'], friendXpForLevel(10) / DAILY_FRIEND_XP);
  assert.ok(reached['Super Friend'] >= 10 && reached['Best Friend'] >= 45);
  assert.equal(friendLevel(p.friends[spellingFriend].xp), 10);
  // Evolution makes the power stronger (+2 at Best Friend), and Best Friends can learn two more game types.
  assert.equal(teamPowersFor(p, 'spelling').power, 4);
  assert.ok(friendInfo(p, spellingFriend).canLearnMore);
});

test('friend boost speeds the team up but is capped', () => {
  const buddy = 'forest-fairy'; // ultra buddy, spelling
  let p = withTeam([buddy, spellingFriend]);
  assert.equal(buddyBoost(teamPowersFor(p, 'spelling')), 0.4);
  p = play(p, 'spelling', 1, T0).profile;
  assert.equal(p.friends[spellingFriend].xp, Math.round(FRIEND_XP.correct * 1.4));
  assert.equal(buddyBoost({ buddy: 99 }), MAX_BUDDY_BOOST);
  // Outside its game type the boost doesn't apply.
  const m = play(withTeam([buddy, mathFriend]), 'math', 1, T0).profile;
  assert.equal(m.friends[mathFriend].xp, FRIEND_XP.correct);
});

test('friendGains reports XP per team friend; old saves get an empty friends map', () => {
  const p = withTeam([spellingFriend, mathFriend]);
  const after = play(p, 'spelling', 3, T0).profile;
  assert.deepEqual(friendGains(p, after).map((g) => g.id), [spellingFriend, mathFriend]);
  assert.ok(friendGains(p, after).every((g) => g.xp > 0));
  const { friends, ...old } = newProfile('Old', T0);
  assert.deepEqual(migrateProfile(old).friends, {});
  assert.ok(ITEMS_BY_ID[spellingFriend].specialty === 'spelling');
});
