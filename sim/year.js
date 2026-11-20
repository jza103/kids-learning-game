// Simulates one kid playing a whole school year: weekly spelling and Word Match
// words, times tables, coins and packs, Super Packs and Legendaries, and Friend
// Grove. Everything goes through the app's own code in src/, so a rule change
// there shows up here on the next run.
import { mulberry32, dayKey } from '../src/rng.js';
import { newProfile, addWords, currentWords } from '../src/profile.js';
import { addVocabWord, vocabOf } from '../src/vocab.js';
import { mathState, trackedFacts } from '../src/math.js';
import { ITEMS_BY_ID, THEMES, LEGENDS } from '../src/content.js';
import { MAX_BOX, needsRefresh } from '../src/srs.js';
import * as F from '../src/farm.js';
import { Memory, DAY } from './memory.js';
import { spellingRound, vocabRound, mathRound, shop, weekListMastered, newVocabLeft, mathLeft } from './learn.js';
import { visit, buildList, allBuilt } from './farmbot.js';
import { STYLES } from './styles.js';

export const YEAR = {
  start: new Date(2026, 10, 30).getTime(), // Monday 30 Nov 2026, local time
  weeks: 28, // through mid-June
  listWeeks: 25, // weeks with a new spelling list and new Word Match words
  spellingPerWeek: 10,
  vocabPerWeek: 6, // on top of the 44 starter words
};

const HOUR = 36e5;

function newStats() {
  return {
    now: 0, games: {}, sun: 0, answerCoins: 0, packCoins: 0, refreshShards: 0, seconds: 0, legendDays: [],
    packs: 0, superOpened: 0, gold: 0, crafted: 0, shardsSpent: 0, dupShards: 0,
    sold: {}, golden: 0, trips: 0, tripShards: 0, bells: 0, bellsSpent: 0, requests: 0, poured: 0, visits: 0, visitMinutes: 0, actions: 0, jarAtVisit: [],
    days: 0, playDays: 0, weekly: [],
  };
}

/** Run one kid. style: a key of STYLES, or a style object. Returns a summary. */
export function runYear(styleKey, seed = 1, overrides = {}) {
  const rng = mulberry32(seed);
  const style = { ...(typeof styleKey === 'string' ? STYLES[styleKey] : styleKey), ...overrides };
  const kid = style.make(rng);
  const mem = new Memory(rng, kid.ability);
  let p = newProfile('Sim', YEAR.start, `sim-${seed}`);
  p.math = { ...mathState(p), seconds: 6 };
  const stats = newStats();
  const ctx = { p, now: YEAR.start, rng, mem, stats };
  const milestones = {};
  const mark = (key, day) => {
    if (milestones[key] == null) milestones[key] = day;
  };

  for (let day = 0; day < YEAR.weeks * 7; day++) {
    const dayStart = YEAR.start + day * DAY;
    const week = Math.floor(day / 7);
    const weekday = new Date(dayStart).getDay(); // 0 Sun .. 6 Sat
    // Monday morning: the grown-up adds this week's words.
    if (weekday === 1 && week < YEAR.listWeeks) {
      const entries = Array.from({ length: YEAR.spellingPerWeek }, (_, i) => ({ id: `w${week}-${i}`, word: `w${week}-${i}`, sentence: '' }));
      ctx.p = addWords(ctx.p, entries, dayStart + 6 * HOUR).profile;
      for (let i = 0; i < YEAR.vocabPerWeek; i++) {
        ctx.p = addVocabWord(ctx.p, { word: `v${week}-${i}`, definition: `meaning ${week}-${i}` }, dayStart + 6 * HOUR).profile;
      }
    }
    if (day === 0) ctx.p = { ...ctx.p, vocab: vocabOf(ctx.p) };

    const plan = kid.plan({ day, week, weekday, rng, p: ctx.p });
    let played = false;
    for (const session of plan) {
      ctx.now = dayStart + session.hour * HOUR;
      for (const g of session.rounds || []) {
        const until = g.until;
        for (let r = 0; r < g.n; r++) {
          if (until && until(ctx.p)) break;
          if (g.game === 'spelling') spellingRound(ctx);
          else if (g.game === 'vocab') vocabRound(ctx);
          else mathRound(ctx);
          ctx.now += 30e3; // between rounds
          played = true;
        }
      }
      shop(ctx, { packs: kid.buysPacks !== false });
      if (session.farm) ctx.p = visit(ctx.p, ctx.now, rng, stats, { skill: kid.groveSkill ?? 1 });
    }
    if (played) stats.playDays++;
    stats.days++;

    // Milestones (day numbers from the start).
    const p2 = ctx.p;
    const legends = Object.keys(p2.collection).filter((id) => ITEMS_BY_ID[id]?.rarity === 'legendary').length;
    if (Object.values(p2.math?.srs || {}).filter((i) => i.masteredAt != null).length >= 200) mark('allMathMastered', day);
    const packFriends = THEMES.slice(0, 5).flatMap((t) => t.items).filter((i) => i.rarity !== 'ultra');
    if (packFriends.every((i) => p2.collection[i.id])) mark('first60PackFriends', day);
    if (p2.farm) {
      const lvl = F.farmLevel(p2.farm);
      for (const l of [5, 10, 15]) if (lvl >= l) mark(`farmLevel${l}`, day);
      if (allBuilt(p2)) mark('groveAllBuilt', day);
      if (p2.farm.biomes.length === 5) mark('allLands', day);
    }
    if (weekday === 0) {
      const t = dayStart + 20 * HOUR;
      stats.weekly.push({
        week,
        spellRet: round(mem.retention('spelling', t).share),
        vocabRet: round(mem.retention('vocab', t).share),
        mathRet: round(mem.retention('math', t).share),
        coins: p2.coins,
        friends: Object.keys(p2.collection).length,
        legends,
        jar: p2.sunJar || 0,
        farmLevel: p2.farm ? F.farmLevel(p2.farm) : 0,
        minutes: Math.round(stats.seconds / 60),
      });
    }
  }
  return summarize(ctx, kid, style, milestones, mem);
}

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

function summarize(ctx, kid, style, milestones, mem) {
  const { p, stats } = ctx;
  const end = ctx.now;
  const items = (srs) => Object.values(srs || {});
  const masteredNow = (srs) => items(srs).filter((i) => i.box >= MAX_BOX && !needsRefresh(i, end)).length;
  const everMastered = (srs) => items(srs).filter((i) => i.masteredAt != null).length;
  const tracked = new Set([...trackedFacts('mul'), ...trackedFacts('div')].map((f) => f.id));
  const mathSrs = Object.fromEntries(Object.entries(p.math?.srs || {}).filter(([id]) => tracked.has(id)));
  // "Really knows": the memory model says 80%+ chance of getting it right today.
  const known = (game, ids) => ids.filter((id) => {
    const m = mem.items.get(`${game}:${id}`);
    return m && mem.recall(m, end) >= 0.8;
  }).length;
  const spellIds = p.words.map((w) => w.id);
  const vocabIds = vocabOf(p).words.map((w) => w.id);
  const mathIds = [...tracked];
  const collection = Object.keys(p.collection).filter((id) => ITEMS_BY_ID[id]);
  const byRarity = (r) => collection.filter((id) => ITEMS_BY_ID[id].rarity === r).length;
  const f = p.farm;
  const ranks = f ? collection.map((id) => F.friendRank(f, id)) : [];
  const playMin = stats.seconds / 60;
  return {
    style: style.name,
    kid: kid.label,
    playDaysPerWeek: round((stats.playDays / stats.days) * 7, 1),
    learnMinPerPlayDay: round(playMin / Math.max(1, stats.playDays), 0),
    groveMinPerWeek: round((stats.visitMinutes / stats.days) * 7, 0),
    curriculum: {
      spelling: { total: spellIds.length, everMastered: everMastered(p.srs), masteredNow: masteredNow(p.srs), reallyKnown: known('spelling', spellIds) },
      vocab: { total: vocabIds.length, everMastered: everMastered(vocabOf(p).srs), masteredNow: masteredNow(vocabOf(p).srs), reallyKnown: known('vocab', vocabIds) },
      math: { total: mathIds.length, everMastered: everMastered(mathSrs), masteredNow: masteredNow(mathSrs), reallyKnown: known('math', mathIds) },
    },
    retention: { spelling: round(mem.retention('spelling', end).share), vocab: round(mem.retention('vocab', end).share), math: round(mem.retention('math', end).share) },
    answers: Object.fromEntries(Object.entries(stats.games).map(([g, s]) => [g, s.answers])),
    games: stats.games,
    coins: { fromAnswers: stats.answerCoins, onPacks: stats.packCoins, left: p.coins },
    packs: stats.packs,
    superPacks: stats.superOpened,
    gold: stats.gold,
    friends: { total: collection.length, ultra: byRarity('ultra'), legendary: byRarity('legendary'), of: THEMES.flatMap((t) => t.items).length + LEGENDS.length },
    shards: { dupes: stats.dupShards, refresh: stats.refreshShards, trips: stats.tripShards, spent: stats.shardsSpent, crafted: stats.crafted, left: p.shards },
    weekStars: (p.weekStars || []).length,
    sun: { earned: p.sunEarned || 0, poured: stats.poured, leftInJar: p.sunJar || 0, golden: stats.golden },
    grove: f ? {
      level: F.farmLevel(f),
      bellsEarned: stats.bells,
      soldTop: Object.entries(stats.sold).sort((a, b) => b[1] - a[1]).slice(0, 5),
      bellsSpent: stats.bellsSpent,
      built: buildList(p),
      trips: stats.trips,
      journal: Object.fromEntries(Object.keys(F.farmOf(p).journal).map((k) => [k, (f.journal[k] || []).length])),
      masterRanks: ranks.filter((r) => r >= 4).length,
      critters: Object.keys(f.critters).length,
    } : null,
    milestones,
    weekly: stats.weekly,
  };
}

export { dayKey, currentWords, weekListMastered, newVocabLeft };
