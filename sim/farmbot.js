// A kid playing Friend Grove with the app's own rules (src/farm.js). The bot
// is a fair, fairly sharp player: it keeps crews full of rested friends,
// plants every plot, crafts, fills requests, sends expeditions, sells extras
// and buys the cheapest thing it can afford. `skill` (0-1) makes it sloppier:
// a low-skill kid skips some of those steps.
import * as F from '../src/farm.js';
import { farmTrait, CROPS, RECIPES, GOODS_BY_ID, DECOR, BIOMES, ROUTES_BY_ID } from '../src/farm-content.js';
import { ITEMS_BY_ID } from '../src/content.js';
import { STATION_IDS } from '../src/farm.js';

const tryDo = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

/** Everything that can be bought with Grove Bells, and how much of it is bought. */
export function buildList(p) {
  const f = F.farmOf(p);
  const expansions = STATION_IDS.reduce((s, st) => s + (F.MAX_SLOTS - F.BASE_SLOTS[st]), 0);
  const bought = STATION_IDS.reduce((s, st) => s + (f.crewUp?.[st] || 0), 0);
  return {
    expansions: [bought, expansions],
    plots: [f.plots.length - F.START_PLOTS, F.MAX_PLOTS - F.START_PLOTS],
    pens: [f.pens - F.START_PENS, F.MAX_PENS - F.START_PENS],
    lands: [f.biomes.length - 1, BIOMES.length - 1],
    decor: [DECOR.filter((d) => d.bells && f.decor.includes(d.id)).length, DECOR.filter((d) => d.bells).length],
  };
}
export function allBuilt(p) {
  return Object.values(buildList(p)).every(([a, b]) => a >= b);
}

function owned(p) {
  return Object.keys(p.collection || {}).filter((id) => ITEMS_BY_ID[id] && farmTrait(id));
}

/** Put the best rested friends on every crew (the Friends tab makes this a few taps). */
function staff(p, keepForBuild = null) {
  const f = F.farmOf(p);
  const onTrip = new Set(f.expeditions.flatMap((e) => e.team));
  const free = owned(p).filter((id) => !onTrip.has(id));
  const crew = Object.fromEntries(STATION_IDS.map((s) => [s, []]));
  const used = new Set();
  const energy = (id) => F.handOf(f, id).energy;
  if (keepForBuild) {
    crew.build.push(keepForBuild);
    used.add(keepForBuild);
  }
  // Leave enough friends on the bench for today's expeditions.
  const benchWanted = Math.min(free.length - 8, 6 * F.expeditionSlots(f));
  const workers = free.length - Math.max(0, benchWanted);
  for (const st of ['fields', 'workshop', 'pens', 'forage', 'build']) {
    const slots = F.slotsFor(f, st);
    const ranked = free
      .filter((id) => !used.has(id) && energy(id) > 5)
      .sort((a, b) => F.workPower(p, b, st) - F.workPower(p, a, st) || energy(b) - energy(a));
    for (const id of ranked) {
      if (crew[st].length >= slots || used.size >= workers) break;
      crew[st].push(id);
      used.add(id);
    }
  }
  return { ...p, farm: { ...f, crew } };
}

function sendTrips(p, now, stats) {
  for (;;) {
    const f = F.farmOf(p);
    if (f.expeditions.length >= F.expeditionSlots(f)) return p;
    const bench = F.benchFriends(p).sort((a, b) => F.handOf(f, b).energy - F.handOf(f, a).energy);
    const routes = f.routes.list.map((r, i) => ({ ...r, i, size: F.TEAM_SIZE_FOR[r.route && routeSize(r.route)] }))
      .filter((r) => !r.done && bench.length >= r.size)
      .sort((a, b) => b.size - a.size);
    const r = routes[0];
    if (!r) return p;
    const team = [];
    for (const need of r.needs) {
      for (const id of bench) {
        if (team.length >= r.size) break;
        if (team.filter((t) => F.fitsNeed(t, need)).length >= need.n) break;
        if (!team.includes(id) && F.fitsNeed(id, need)) team.push(id);
      }
    }
    for (const id of bench) if (team.length < r.size && !team.includes(id)) team.push(id);
    const next = tryDo(() => F.sendExpedition(p, r.i, team, now));
    if (!next) return p;
    stats.trips++;
    p = next;
  }
}
const routeSize = (id) => ROUTES_BY_ID[id].size;

function collectAll(p, now, rng, stats) {
  let r;
  r = F.harvestAll(p, now);
  p = r.profile;
  r = tryDo(() => F.collectGoodies(p, now, rng));
  if (r) p = r.profile;
  if (F.forageWaiting(p) > 0) p = F.collectForage(p, now, rng).profile;
  const f = F.farmOf(p);
  if (f.workshop && F.plotReady(f.workshop)) {
    r = F.collectCraft(p, now);
    p = r.profile;
  }
  for (let i = F.farmOf(p).expeditions.length - 1; i >= 0; i--) {
    if (!F.plotReady(F.farmOf(p).expeditions[i])) continue;
    r = F.collectExpedition(p, i, now, rng);
    p = r.profile;
    stats.tripShards += r.rewards.shards;
    stats.bells += r.rewards.bells;
  }
  for (const id of [...F.farmOf(p).waiting]) {
    if (F.penSpace(F.farmOf(p)) <= 0) p = tryDo(() => F.buyPen(p)) || p;
    p = tryDo(() => F.welcomeExplorer(p, id).profile) || p;
  }
  while (F.farmOf(p).eggs > 0) {
    if (F.penSpace(F.farmOf(p)) <= 0) p = tryDo(() => F.buyPen(p)) || p;
    const h = tryDo(() => F.hatchEgg(p, now, rng));
    if (!h) break;
    p = h.profile;
  }
  if (F.farmOf(p).visitor) {
    if (F.penSpace(F.farmOf(p)) <= 0) p = tryDo(() => F.buyPen(p)) || p;
    const b = tryDo(() => F.befriend(p, now));
    if (b) p = b.profile;
  }
  return p;
}

function trade(p, now, stats) {
  // Requests first (they pay more), then sell extras while the market buys.
  for (let s = 0; s < F.REQUEST_SLOTS; s++) {
    const r = tryDo(() => F.fillRequest(p, s, now));
    if (r) {
      p = r.profile;
      stats.bells += r.bells;
      stats.requests++;
    }
  }
  // Keep a few of everything for recipes and requests; sell the rest.
  const f = F.farmOf(p);
  for (const [id, n] of Object.entries(f.items)) {
    const keep = GOODS_BY_ID[id]?.kind === 'craft' ? 0 : 6;
    if (n > keep && F.marketLeft(p, now) > 0) {
      const r = F.sell(p, id, n - keep, now);
      p = r.profile;
      stats.bells += r.bells;
      stats.sold = stats.sold || {};
      stats.sold[id] = (stats.sold[id] || 0) + r.bells;
    }
  }
  return p;
}

function build(p, now, stats) {
  for (let guard = 0; guard < 40; guard++) {
    const f = F.farmOf(p);
    const options = [];
    for (const st of STATION_IDS) {
      const x = F.nextExpansion(p, st);
      if (x && x.ok) options.push({ cost: x.cost, go: (q) => F.expandCrew(q, st) });
    }
    const pc = F.plotCost(p);
    if (pc != null) options.push({ cost: pc, go: F.buyPlot });
    for (const b of BIOMES) {
      const block = F.biomeBlock(p, b.id, now);
      if (block === 'element') {
        const helper = owned(p).find((id) => b.elements.includes(farmTrait(id).element) && !f.expeditions.some((e) => e.team.includes(id)));
        if (helper) {
          const q = staff(p, helper);
          if (!F.biomeBlock(q, b.id, now)) options.push({ cost: F.biomeCost(q, b.id), go: () => F.openBiome(q, b.id, now) });
        }
      } else if (!block) options.push({ cost: F.biomeCost(p, b.id), go: (q) => F.openBiome(q, b.id, now) });
    }
    for (const d of DECOR) {
      if (d.bells && !f.decor.includes(d.id) && F.decorCost(p, d.id) <= f.bells) options.push({ cost: F.decorCost(p, d.id), go: (q) => F.buyDecor(q, d.id), decor: true });
    }
    // Lands and crew spots first (they grow the farm), then the cheapest thing.
    const affordable = options.filter((o) => o.cost <= f.bells).sort((a, b) => (a.decor ? 1 : 0) - (b.decor ? 1 : 0) || a.cost - b.cost);
    if (!affordable.length) return p;
    const next = tryDo(() => affordable[0].go(p));
    if (!next) return p;
    stats.bellsSpent += affordable[0].cost;
    p = next;
  }
  return p;
}

function plantAll(p, now, rng) {
  const f = F.farmOf(p);
  const crops = CROPS.filter((c) => f.biomes.includes(c.biome));
  // A mix: what recipes and visitors want, and the best value per Sunshine.
  const wanted = new Set();
  for (const r of RECIPES) if (f.biomes.includes(r.biome)) for (const id of Object.keys(r.needs)) wanted.add(id);
  for (const req of f.requests) if (req) for (const id of Object.keys(req.wants)) wanted.add(id);
  if (f.visitor) wanted.add(F.CRITTERS.find((c) => c.id === f.visitor.id)?.likes);
  const pick = (i) => {
    const want = crops.filter((c) => wanted.has(c.id) && (f.items[c.id] || 0) < 6);
    const pool = want.length && i % 2 === 0 ? want : crops;
    return pool[Math.floor(rng() * pool.length)];
  };
  f.plots.forEach((pl, i) => {
    if (pl) return;
    const id = F.farmOf(p).wonderSeeds > 0 ? 'wonder' : pick(i).id;
    p = tryDo(() => F.plant(p, i, id, now, rng)) || p;
  });
  return p;
}

function craftOne(p, now) {
  const f = F.farmOf(p);
  if (f.workshop) return p;
  const ok = RECIPES.filter((r) => f.biomes.includes(r.biome) && F.canCraft(f, r)).sort((a, b) => F.craftProfit(b) - F.craftProfit(a));
  return ok.length ? tryDo(() => F.startCraft(p, ok[0].id, now)) || p : p;
}

/**
 * One visit to the Grove. Returns the new profile. `skill` 0-1: chance of
 * doing each optional step (crafting, expeditions, staffing well).
 */
export function visit(p, now, rng, stats, { skill = 1, pourLimit = Infinity } = {}) {
  const v = F.visitFarm(p, now, rng);
  p = v.profile;
  for (const e of v.events) if (e.type === 'golden') stats.golden += e.n;
  const jarAtStart = F.sunJar(p);
  let poured = 0;
  for (let i = 0; i < 12; i++) {
    p = collectAll(p, now, rng, stats);
    p = trade(p, now, stats);
    p = build(p, now, stats);
    p = plantAll(p, now, rng);
    if (rng() < skill) p = craftOne(p, now);
    if (rng() < skill) p = staff(p);
    if (rng() < skill) p = sendTrips(p, now, stats);
    if (!F.sunJar(p) || poured >= pourLimit) break;
    const useful = F.sunUseful(p);
    if (!useful) break;
    const n = Math.min(useful, pourLimit - poured, F.sunJar(p));
    const r = tryDo(() => F.pourSun(p, n, now));
    if (!r) break;
    p = r.profile;
    poured += r.poured;
    stats.poured += r.poured;
    stats.actions += 6;
  }
  stats.visits++;
  stats.visitMinutes += 2 + 0.5 * Math.min(12, Math.ceil(poured / 20));
  stats.jarAtVisit.push(jarAtStart);
  return p;
}
