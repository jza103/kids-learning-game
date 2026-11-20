// UI for Friend Grove (the farm). app.js passes in its helpers and merges
// these screens and actions into its own. Game rules live in farm.js.
import { ITEMS_BY_ID } from './content.js';
import {
  JOBS, ELEMENTS, farmTrait, BIOMES, CROPS, CRITTERS_BY_ID, GOODS_BY_ID, RECIPES, DECOR, JOURNAL_PAGES, WONDER_CROPS,
} from './farm-content.js';
import {
  STATIONS, STATION_IDS, visitFarm, farmLevelProgress, xpLeftToday, slotsFor, stationOf, workPower, stationSpeed, stationPower,
  crewElements, buildDiscount, assignCrew, removeCrew, openCrops, openRecipes, plant, plotReady, harvestAll, fertilize,
  ownedCritters, penSpace, goodyCycles, collectGoodies, befriendCost, befriend, waveBye, hatchEgg, forageWaiting, collectForage,
  startCraft, canCraft, collectCraft, fillRequest, skipRequest, requestPay, sell, plotCost, nextPenCost, buyPlot, buyPen,
  biomeBlock, biomeCost, openBiome, decorCost, buyDecor, journalProgress, perkUsesLeft, usePerk, canGift, sendGift, farmLocked,
  FERTILIZER_SHARDS, GIFT_MAX, FARM_XP_PER_DAY, sunLeft, sunJar, pourSun, sunToFinish, sunUseful, goldenSeason, MORNING_RAIN, GOODY_SUN,
  FORAGE_PER_POWER_SUN, expeditionSlots, biomeOpen, benchFriends, needsMet, fitsNeed, sendExpedition, collectExpedition, welcomeExplorer,
  EXPEDITION_SUN, TEAM_SIZE_FOR, EXPEDITION_SHARDS, NEED_SPEED, handOf, friendRank, jobStamps, allRounder, isTired, whereIs, RANKS, ENERGY_MAX,
  ENERGY_REST, MORNING_ENERGY, TRIP_ENERGY, JOB_STAMP_SUN, expeditionSpeed, nextExpansion, expandCrew, pourTips, routeExplorer, MAX_SLOTS,
} from './farm.js';
import { ROUTES_BY_ID } from './farm-content.js';
import { THEMES } from './content.js';

const PARENT_SUN = [10, 50, 200];

const TABS = [
  ['farm', '🌻', 'Farm'],
  ['crew', '🧑‍🌾', 'Crew'],
  ['friends', '👥', 'Friends'],
  ['map', '🗺️', 'Expeditions'],
  ['board', '📋', 'Requests'],
  ['build', '🔨', 'Build'],
  ['journal', '📔', 'Journal'],
];

export function initFarm(ctx) {
  const { app, ui, profile, update, go, render, esc, floatText, data } = ctx;
  ui.farm = { tab: 'farm', plantAt: null, pickFor: null, news: [], giftItem: null, trip: null, team: [] };

  const g = (id) => GOODS_BY_ID[id];
  const friend = (id) => ITEMS_BY_ID[id];
  const critter = (id) => CRITTERS_BY_ID[id];
  const farm = () => profile().farm;

  function minutesLeft(at, now) {
    const m = Math.max(1, Math.ceil((at - now) / 60e3));
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  const FRIENDLY = {
    'not enough bells': 'Not enough Grove Bells yet. Fill requests or sell goods to earn more.',
    'not enough shards': 'Not enough 💎 shards.',
    'no pen space': 'Your pens are full. Build another pen first.',
    'crew full': 'That crew is full. Take someone off first, or level up your farm for more spots.',
    'put this friend on a crew first': 'Put this friend on a crew to use its perk.',
  };
  const friendly = (msg) => FRIENDLY[msg] || (msg.startsWith('need ') ? 'You need more of that. Check what it takes.' : msg.charAt(0).toUpperCase() + msg.slice(1) + '.');

  function eventText(e) {
    switch (e.type) {
      case 'level': return `🎉 Farm level ${e.level}!`;
      case 'rank': return `${RANKS[e.rank].emoji} ${friend(e.id).name} is now a farm ${RANKS[e.rank].name}!`;
      case 'rain': return `🌧️ Morning Rain: +${e.n} ☀️ in your Sun Jar.`;
      case 'golden': return `🌟 Golden Season! You've mastered everything, so your farm grew on its own: +${e.n} ☀️`;
      case 'souvenir': return `🏆 New souvenir: ${ROUTES_BY_ID[e.id].souvenir.emoji} ${ROUTES_BY_ID[e.id].souvenir.name}`;
      case 'explorer': return `${critter(e.id).emoji} A ${critter(e.id).name} followed your team home!`;
      case 'seeds': return `🌟 ${e.n} Wonder Seed${e.n > 1 ? 's' : ''} for mastering! Plant ${e.n > 1 ? 'them' : 'it'} in a field.`;
      case 'eggs': return `🥚 ${e.n} Mystery Egg${e.n > 1 ? 's' : ''} for finishing a set! Hatch ${e.n > 1 ? 'them' : 'it'} in the pens.`;
      case 'visitor': return `${critter(e.id).emoji} A wild ${critter(e.id).name} is visiting!`;
      case 'baby': return `💞 A baby ${critter(e.id).name} wandered over!`;
      case 'befriend': return `${critter(e.id).emoji} ${critter(e.id).name} moved in!`;
      case 'hatch': return `🐣 ${critter(e.id).name} hatched!`;
      case 'stardust': return `🌟 +${e.n} Star Dust`;
      case 'gift': return `🎁 ${e.from} sent you ${e.n} ${g(e.item).emoji} ${g(e.item).name}! +10 🔔`;
      case 'stamp': return `📔 ${JOURNAL_PAGES[e.page].name} page complete! A new decoration is on your farm.`;
      case 'found': return `🗺️ Found ${Object.entries(e.found).map(([id, n]) => `${n} ${g(id).emoji}`).join(' ')}`;
      default: return '';
    }
  }

  /** Catch the farm up, run an action, save, and show what happened. */
  function act(fn) {
    try {
      const now = Date.now();
      const v = visitFarm(profile(), now);
      const r = fn(v.profile, now);
      const next = r && r.profile ? r.profile : r || v.profile;
      update(next);
      const lines = [...v.events, ...((r && r.events) || [])].map(eventText).filter(Boolean);
      if (lines.length) ui.farm.news = [...lines, ...ui.farm.news].slice(0, 4);
      render();
      return r;
    } catch (err) {
      floatText(friendly(err.message), 2500);
      return null;
    }
  }

  // ---------- pieces ----------
  function header(p) {
    const f = p.farm;
    const lp = farmLevelProgress(f);
    return `<div class="topbar">
        <button class="secondary" data-action="go" data-to="hub">← Back</button>
        <h2 style="margin:0">🌻 Friend Grove</h2>
        <div class="row"><span class="pill">🔔 ${f.bells}</span><span class="pill">💎 ${p.shards}</span></div>
      </div>
      ${sunHtml(p)}
      <div class="card farm-head">
        <div style="flex:1">
          <div class="small">Farm level ${lp.level} · ${lp.into}/${lp.needed} farm XP${xpLeftToday(f, Date.now()) ? '' : ' · <span class="muted">farm XP is done for today</span>'}</div>
          <div class="xpbar"><div style="width:${(100 * lp.into) / lp.needed}%"></div></div>
        </div>
        ${f.decor.length ? `<div class="decor-row" title="Your decorations">${f.decor.map((id) => DECOR.find((d) => d.id === id)?.emoji).join('')}</div>` : ''}
      </div>
      <div class="farm-tabs">${TABS.map(([id, icon, label]) => `<button class="${ui.farm.tab === id ? '' : 'secondary'}" data-action="farm-tab" data-id="${id}">${icon} ${label}</button>`).join('')}</div>
      ${ui.farm.news.length ? `<div class="card farm-news">${ui.farm.news.map((l) => `<div>${esc(l)}</div>`).join('')}<button class="ghost" data-action="farm-clear-news">OK</button></div>` : ''}`;
  }

  function traitBadge(id) {
    const t = farmTrait(id);
    if (!t) return '';
    return `<span class="trait">${JOBS[t.job].emoji} ${JOBS[t.job].name} · ${ELEMENTS[t.element].emoji} ${ELEMENTS[t.element].name}</span>`;
  }

  /** Rank and energy for one friend, e.g. "🌿 Helper · ⚡ 72". */
  function handTag(f, id) {
    const h = handOf(f, id);
    const r = RANKS[friendRank(f, id)];
    const e = Math.round(h.energy);
    return `<span class="hand ${e <= 0 ? 'tired' : ''}">${r.emoji} ${r.name}${allRounder(f, id) ? ' · 🎖️' : ''} · ${e <= 0 ? '😴 Tired' : `⚡ ${e}`}</span>`;
  }
  function energyBar(f, id) {
    const pct = Math.max(0, Math.min(100, (100 * handOf(f, id).energy) / ENERGY_MAX));
    return `<div class="energy"><div style="width:${pct}%"></div></div>`;
  }

  function crewLine(p, station) {
    const crew = p.farm.crew[station];
    const els = [...crewElements(p.farm, station)].map((e) => ELEMENTS[e].emoji).join('');
    return `<div class="small muted">${STATIONS[station].emoji} Crew: ${crew.map((id) => friend(id).emoji).join(' ') || 'nobody yet'}${els ? ` · elements ${els}` : ''} · speed ×${stationSpeed(p, station).toFixed(2)}
      <button class="ghost" data-action="farm-pick" data-id="${station}">Change</button></div>`;
  }

  // ---------- Farm tab ----------
  function visitorHtml(p, now) {
    const f = p.farm;
    if (!f.visitor) return '';
    const c = critter(f.visitor.id);
    const cost = befriendCost(f);
    const have = cost ? f.items[c.likes] || 0 : 0;
    const full = penSpace(f) <= 0;
    return `<div class="card visitor">
      <div class="row"><span class="big-emoji bob">${c.emoji}</span>
        <div style="flex:1"><h3>${f.visitor.baby ? `A baby ${esc(c.name)}!` : `A wild ${esc(c.name)} is visiting!`}</h3>
          <div class="small">${ELEMENTS[c.element].emoji} ${ELEMENTS[c.element].name} critter · makes ${c.makes.map((m) => `${g(m).emoji} ${g(m).name}`).join(' and ')}</div>
          ${cost ? `<div class="small">It would love <strong>${cost} ${g(c.likes).emoji} ${g(c.likes).name}</strong> (you have ${have}).${cost === 3 ? ` ${/^[AEIOU]/.test(ELEMENTS[c.element].name) ? 'An' : 'A'} ${ELEMENTS[c.element].name} friend on the Pens crew makes it 2.` : ''}</div>` : '<div class="small">Babies move in for free.</div>'}
          ${full ? '<div class="small muted">Your pens are full. Build a pen to make room.</div>' : ''}
        </div></div>
      <div class="row" style="margin-top:8px">
        <button data-action="farm-befriend" ${have >= cost && !full ? '' : 'disabled'}>${cost ? `Give ${cost} ${g(c.likes).emoji}` : 'Welcome home'}</button>
        <button class="ghost" data-action="farm-bye">Wave bye</button>
      </div></div>`;
  }

  function fieldsHtml(p, now) {
    const f = p.farm;
    const ready = f.plots.some((pl) => plotReady(pl));
    const speed = stationSpeed(p, 'fields');
    const plots = f.plots.map((pl, i) => {
      if (!pl) return `<button class="plot empty" data-action="farm-plot" data-i="${i}">➕<div class="small">Plant</div></button>`;
      const c = g(pl.crop);
      if (plotReady(pl)) return `<button class="plot ready" data-action="farm-harvest">${c.emoji}<div class="small">Ready!</div></button>`;
      const pct = Math.min(100, (100 * pl.grown) / Math.max(1e-9, pl.need));
      return `<button class="plot growing" data-action="farm-plot" data-i="${i}">🌱<div class="small">${c.emoji} ☀️${sunLeft(pl, speed)}</div><div class="grow"><div style="width:${pct}%"></div></div></button>`;
    }).join('');
    let picker = '';
    if (ui.farm.plantAt != null) {
      const pl = f.plots[ui.farm.plantAt];
      if (!pl) {
        const els = crewElements(f, 'fields');
        picker = `<div class="picker"><h3>Plant what?</h3><div class="row">
          ${f.wonderSeeds ? `<button class="super" data-action="farm-plant" data-id="wonder">🌟 Wonder Seed (${f.wonderSeeds})</button>` : ''}
          ${openCrops(f).map((c) => `<button class="secondary" data-action="farm-plant" data-id="${c.id}">${c.emoji} ${c.name}<div class="small muted">☀️${c.sun} · ${ELEMENTS[c.element].emoji}${els.has(c.element) ? ' +1' : ''}</div></button>`).join('')}
        </div><button class="ghost" data-action="farm-plot" data-i="-1">Cancel</button></div>`;
      } else if (!plotReady(pl)) {
        picker = `<div class="picker"><p>${g(pl.crop).emoji} ${g(pl.crop).name} needs ${sunLeft(pl, speed)} more ☀️ Sunshine at your crew's speed now.</p>
          <div class="row"><button class="secondary" data-action="farm-fertilize" ${p.shards >= FERTILIZER_SHARDS ? '' : 'disabled'}>💎 Crystal fertilizer: ready now (${FERTILIZER_SHARDS} shards)</button>
          <button class="ghost" data-action="farm-plot" data-i="-1">Close</button></div></div>`;
      }
    }
    return `<div class="card"><div class="row spread"><h3>🌱 Fields</h3>${ready ? '<button data-action="farm-harvest">Harvest all</button>' : ''}</div>
      <div class="plots">${plots}</div>${picker}
      ${crewLine(p, 'fields')}
      <p class="small muted">A friend with the crop's element on the Fields crew adds +1 to each harvest. Growers make every crop grow faster, even ones planted before they joined.</p></div>`;
  }

  function pensHtml(p, now) {
    const f = p.farm;
    const owned = ownedCritters(f);
    const waiting = owned.reduce((s, id) => s + goodyCycles(p, id) * critter(id).makes.length, 0);
    return `<div class="card"><div class="row spread"><h3>🐾 Pens (${owned.length}/${f.pens})</h3>${waiting ? `<button data-action="farm-goodies">Collect goodies (${waiting}+)</button>` : ''}</div>
      ${owned.length ? `<div class="critters">${owned.map((id) => {
        const c = critter(id);
        const n = goodyCycles(p, id);
        return `<div class="critter"><span class="bob">${c.emoji}</span><div class="small">${esc(c.name)}</div><div class="small muted">${n ? c.makes.map((m) => g(m).emoji).join('') + ' ×' + n : '…'}</div></div>`;
      }).join('')}</div>` : '<p class="muted">No critters yet. Befriend a visitor with its favorite crop!</p>'}
      ${f.waiting.map((id) => `<div class="row" style="margin-top:8px"><span class="big-emoji">${critter(id).emoji}</span> ${esc(critter(id).name)} is waiting for a pen. <button data-action="farm-welcome" data-id="${id}" ${penSpace(f) > 0 ? '' : 'disabled'}>Welcome home</button></div>`).join('')}
      ${f.eggs ? `<div class="row" style="margin-top:8px"><button class="super" data-action="farm-hatch">🥚 Hatch a Mystery Egg (${f.eggs})</button></div>` : ''}
      ${crewLine(p, 'pens')}
      <p class="small muted">Critters make a goody for every ${GOODY_SUN} ☀️ (up to 4 waiting each). A Tender with the critter's element doubles it. Two critters that get along sometimes have a baby.</p></div>`;
  }

  function forageHtml(p, now) {
    const n = forageWaiting(p);
    const power = stationPower(p, 'forage');
    return `<div class="card"><div class="row spread"><h3>🧺 Forage</h3>${n ? `<button data-action="farm-forage">Pick up ${n} find${n > 1 ? 's' : ''}</button>` : ''}</div>
      <p class="small">${power ? `Your gatherers find about ${Math.round(power * FORAGE_PER_POWER_SUN * 10)} things for every 10 ☀️.` : 'Put friends on the Forage crew to find acorns, shells, crystals and more.'}</p>
      ${crewLine(p, 'forage')}</div>`;
  }

  function workshopHtml(p, now) {
    const f = p.farm;
    const w = f.workshop;
    let body;
    if (w && plotReady(w)) body = `<button data-action="farm-craft-done">${g(w.recipe).emoji} Collect ${esc(g(w.recipe).name)}</button>`;
    else if (w) body = `<p>Making ${g(w.recipe).emoji} ${esc(g(w.recipe).name)}: needs ${sunLeft(w, stationSpeed(p, 'workshop'))} more ☀️.</p>`;
    else body = `<div class="recipes">${openRecipes(f).map((r) => `<button class="secondary recipe" data-action="farm-craft" data-id="${r.id}" ${canCraft(f, r) ? '' : 'disabled'}>
        <span class="big-emoji">${r.emoji}</span><div><strong>${esc(r.name)}</strong><div class="small">${Object.entries(r.needs).map(([id, n]) => `${n}${g(id).emoji}`).join(' ')} · ☀️${r.sun} · 🔔${r.value}</div></div></button>`).join('')}</div>`;
    return `<div class="card"><h3>🔨 Workshop</h3>${body}${crewLine(p, 'workshop')}</div>`;
  }

  function farmTab(p, now) {
    const f = p.farm;
    const crewTotal = STATION_IDS.reduce((s, st) => s + f.crew[st].length, 0);
    return `${crewTotal ? '' : `<div class="card"><strong>Welcome to Friend Grove!</strong> Your friends can work here. Tap <button class="ghost" data-action="farm-tab" data-id="crew">🧑‍🌾 Crew</button> to give them jobs, then plant some carrots.</div>`}
      ${visitorHtml(p, now)}${fieldsHtml(p, now)}${pensHtml(p, now)}${forageHtml(p, now)}${workshopHtml(p, now)}`;
  }

  function expandHtml(p, st) {
    const x = nextExpansion(p, st);
    if (!x) return `<p class="small muted">✓ Full size (${MAX_SLOTS} spots)</p>`;
    return `<div class="row" style="margin-top:6px"><button class="small-btn" data-action="farm-expand" data-id="${st}" ${x.ok ? '' : 'disabled'}>📐 Expand: +1 spot · 🔔 ${x.cost}</button>
      ${x.reason === 'level' ? `<span class="small muted">at farm level ${x.level}</span>` : ''}</div>`;
  }

  // ---------- Crew tab ----------
  function crewTab(p, now) {
    const f = p.farm;
    const stations = STATION_IDS.map((st) => {
      const s = STATIONS[st];
      const slots = slotsFor(f, st);
      const members = f.crew[st].map((id) => {
        const left = perkUsesLeft(p, id, now);
        const t = farmTrait(id);
        return `<div class="crew-card"><span class="big-emoji">${friend(id).emoji}</span><div style="flex:1"><strong>${esc(friend(id).name)}</strong> <span class="small">+${workPower(p, id, st)}</span><div>${traitBadge(id)} ${handTag(f, id)}</div>${energyBar(f, id)}
          ${t.perk ? `<button class="small-btn" data-action="farm-perk" data-id="${id}" ${left ? '' : 'disabled'}>${t.perk.emoji} ${t.perk.name}${left ? ` (${left})` : ' (tomorrow)'}</button>` : ''}</div>
          <button class="ghost" data-action="farm-unassign" data-id="${id}" aria-label="Take off crew">✕</button></div>`;
      }).join('');
      const empty = Math.max(0, slots - f.crew[st].length);
      return `<div class="card"><div class="row spread"><h3>${s.emoji} ${s.name} (${f.crew[st].length}/${slots})</h3><span class="small muted">Best job: ${JOBS[s.job].emoji} ${JOBS[s.job].name}</span></div>
        ${members}${empty ? `<button class="secondary" data-action="farm-pick" data-id="${st}">➕ Add a friend</button>` : ''}
        ${expandHtml(p, st)}
        ${st === 'build' ? `<p class="small muted">Builders take ${Math.round(buildDiscount(p) * 100)}% off building. New lands need a friend of the right element on this crew.</p>` : ''}</div>`;
    }).join('');
    return `<div class="card small"><p>Every friend has a <strong>job</strong> and an <strong>element</strong>. A friend working its own job counts double, Super and Best Friends and gold friends work harder, and rare-and-up friends have a once-a-day perk. Each area starts small: expand it with 🔔 Grove Bells (up to ${MAX_SLOTS} friends) as your farm levels up. Workers get tired, so check 👥 Friends to swap in rested ones.</p></div>
      ${pickerHtml(p)}${stations}`;
  }

  function pickerHtml(p) {
    const st = ui.farm.pickFor;
    if (!st) return '';
    const f = p.farm;
    const owned = Object.keys(p.collection).filter((id) => friend(id) && farmTrait(id));
    const away = (id) => (whereIs(f, id) === 'trip' ? 1 : 0);
    owned.sort((a, b) => away(a) - away(b) || workPower(p, b, st) - workPower(p, a, st) || friend(a).name.localeCompare(friend(b).name));
    return `<div class="card picker"><div class="row spread"><h3>Who works the ${STATIONS[st].name}?</h3><button class="ghost" data-action="farm-pick" data-id="">Close</button></div>
      ${owned.length ? `<div class="pick-list">${owned.map((id) => {
        const at = whereIs(f, id);
        return `<button class="secondary pick-friend ${at === st ? 'selected' : ''}" data-action="farm-assign" data-id="${id}" ${at === 'trip' ? 'disabled' : ''}>
          <span class="big-emoji">${friend(id).emoji}</span><div><strong>${esc(friend(id).name)}</strong> +${workPower(p, id, st)}<div>${traitBadge(id)} ${handTag(f, id)}</div>
          ${at === 'trip' ? '<div class="small muted">on an expedition</div>' : at && at !== st ? `<div class="small muted">now on ${STATIONS[at].name}</div>` : ''}</div></button>`;
      }).join('')}</div>` : '<p class="muted">Get friends from packs by learning, then they can work here.</p>'}</div>`;
  }

  // ---------- Friends (roster) tab ----------
  function friendsTab(p) {
    const f = p.farm;
    const owned = Object.keys(p.collection || {}).filter((id) => friend(id) && farmTrait(id));
    const filter = ui.farm.rosterFilter || 'all';
    const groupOf = (id) => {
      const at = whereIs(f, id);
      if (at === 'trip') return 'trip';
      if (at) return isTired(f, id) ? 'tired' : 'working';
      return 'resting';
    };
    const order = { tired: 0, working: 1, resting: 2, trip: 3 };
    const shown = owned.filter((id) => filter === 'all' || groupOf(id) === filter);
    shown.sort((a, b) => order[groupOf(a)] - order[groupOf(b)] || handOf(f, a).energy - handOf(f, b).energy || friend(a).name.localeCompare(friend(b).name));
    const count = (g) => owned.filter((id) => groupOf(id) === g).length;
    const chips = [['all', `All ${owned.length}`], ['working', `🧑‍🌾 Working ${count('working')}`], ['tired', `😴 Tired ${count('tired')}`], ['resting', `💤 Resting ${count('resting')}`], ['trip', `🗺️ Exploring ${count('trip')}`]];
    const rows = shown.map((id) => {
      const at = whereIs(f, id);
      const full = (st) => f.crew[st].length >= slotsFor(f, st) && at !== st;
      const stamps = jobStamps(f, id);
      const moves = at === 'trip'
        ? '<span class="small muted">🗺️ On an expedition</span>'
        : `${STATION_IDS.map((st) => `<button class="small-btn ${at === st ? '' : 'secondary'}" data-action="farm-roster" data-id="${id}" data-st="${st}" ${full(st) ? 'disabled' : ''} title="${STATIONS[st].name}">${STATIONS[st].emoji}</button>`).join('')}
           <button class="small-btn ${at ? 'secondary' : ''}" data-action="farm-roster" data-id="${id}" data-st="" title="Rest">💤</button>`;
      return `<div class="roster-row ${groupOf(id)}"><span class="big-emoji">${friend(id).emoji}</span>
        <div style="flex:1;min-width:0"><strong>${esc(friend(id).name)}</strong> <span class="small muted">${at === 'trip' ? 'exploring' : at ? STATIONS[at].name : 'resting'}</span>
          <div>${traitBadge(id)} ${handTag(f, id)}</div>${energyBar(f, id)}
          <div class="small muted">Stamps: ${STATION_IDS.map((st) => (stamps.includes(st) ? STATIONS[st].emoji : '▫️')).join('')}</div></div>
        <div class="roster-moves">${moves}</div></div>`;
    }).join('');
    return `<div class="card small"><p>Every friend has ⚡ <strong>energy</strong> and farm know-how. Friends on a crew learn as you pour Sunshine and rank up from ${RANKS.map((r) => r.emoji).join(' → ')}; each rank helps them work harder. Working uses energy. A tired friend 😴 still works, but at half power, and stops learning.
      Resting friends get ${ENERGY_REST}× the energy back from the same Sunshine, plus ${MORNING_ENERGY} every morning, so swap them around! Work ${JOB_STAMP_SUN} ☀️ in every area for an All-Rounder 🎖️ medal (+1 power everywhere).</p></div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:10px">${chips.map(([id, label]) => `<button class="small-btn ${filter === id ? '' : 'secondary'}" data-action="farm-roster-filter" data-id="${id}">${label}</button>`).join('')}</div>
      <div class="card">${rows || '<p class="muted">Nobody here right now.</p>'}</div>`;
  }

  // ---------- Requests tab ----------
  function boardTab(p, now) {
    const f = p.farm;
    const reqs = f.requests.map((r, i) => {
      if (!r) return `<div class="card muted small">📋 A new request will show up in ${minutesLeft(f.requestAt[i], now)}.</div>`;
      const who = r.from ? friend(r.from) : null;
      const ok = Object.entries(r.wants).every(([id, n]) => (f.items[id] || 0) >= n);
      const pay = requestPay(p, r);
      return `<div class="card request"><div class="row"><span class="big-emoji">${who ? who.emoji : '🧑‍🌾'}</span>
        <div style="flex:1"><strong>${who ? esc(who.name) : 'A neighbor'}</strong> would love:
          <div style="font-size:1.3rem">${Object.entries(r.wants).map(([id, n]) => `${n} ${g(id).emoji} <span class="small">${esc(g(id).name)} (${f.items[id] || 0})</span>`).join(' · ')}</div>
          <div class="small">Pays 🔔 ${pay}${pay > r.bells ? ' (bonus: they\'re on your crew!)' : who ? ` (+25% if ${esc(who.name)} is on a crew)` : ''}</div></div></div>
        <div class="row"><button data-action="farm-fill" data-i="${i}" ${ok ? '' : 'disabled'}>Give</button><button class="ghost" data-action="farm-skip" data-i="${i}">Skip</button></div></div>`;
    }).join('');
    const items = Object.entries(f.items).filter(([, n]) => n > 0);
    const kids = data().order.map((id) => data().profiles[id]).filter((k) => k && k.id !== p.id);
    const giftItem = items.find(([id]) => id === ui.farm.giftItem)?.[0] || items[0]?.[0];
    return `${reqs}
      <div class="card"><h3>🏠 Barn</h3>
        ${items.length ? `<table>${items.map(([id, n]) => `<tr><td>${g(id).emoji} ${esc(g(id).name)}</td><td>${n}</td><td class="small muted">🔔${g(id).value} each</td>
          <td class="nowrap"><button class="small-btn secondary" data-action="farm-sell" data-id="${id}" data-n="1">Sell 1</button>${n > 1 ? `<button class="small-btn secondary" data-action="farm-sell" data-id="${id}" data-n="${n}">Sell all</button>` : ''}</td></tr>`).join('')}</table>`
          : '<p class="muted">Empty. Harvest, collect and forage to fill it.</p>'}
        <p class="small muted">Requests pay more than selling.</p></div>
      ${kids.length && items.length ? `<div class="card"><h3>🎁 Send a gift</h3><p class="small muted">Send up to ${GIFT_MAX} of something to a brother or sister on this iPad, once a day each. They get a little bonus too.</p>
        <div class="row"><select data-action-change="farm-gift-item" aria-label="Gift">${items.map(([id, n]) => `<option value="${id}" ${id === giftItem ? 'selected' : ''}>${g(id).emoji} ${esc(g(id).name)} (${n})</option>`).join('')}</select>
        ${kids.map((k) => `<button class="secondary" data-action="farm-gift" data-id="${k.id}" ${canGift(p, k.id, now) ? '' : 'disabled'}>To ${esc(k.name)}${canGift(p, k.id, now) ? '' : ' ✓'}</button>`).join('')}</div></div>` : ''}`;
  }

  // ---------- Build tab ----------
  function buildTab(p, now) {
    const f = p.farm;
    const pc = plotCost(p);
    const pen = nextPenCost(p);
    const disc = buildDiscount(p);
    const blockText = { level: (b) => `Farm level ${b.level}`, element: (b) => `Needs a ${b.elements.map((e) => ELEMENTS[e].emoji + ' ' + ELEMENTS[e].name).join(' or ')} friend on the Build crew`, bells: (b) => `🔔 ${biomeCost(p, b.id)}` };
    return `${disc ? `<div class="card small">🪚 Your builders take <strong>${Math.round(disc * 100)}%</strong> off.${f.halfOff ? ' (Barn Raising: next build is half price!)' : ''}</div>` : ''}
      <div class="card"><h3>Grow your farm</h3><div class="row">
        <button data-action="farm-buy-plot" ${pc != null && f.bells >= pc ? '' : 'disabled'}>➕ Field plot ${pc != null ? `🔔 ${pc}` : '(all built)'}</button>
        <button data-action="farm-buy-pen" ${pen != null && f.bells >= pen ? '' : 'disabled'}>➕ Pen ${pen != null ? `🔔 ${pen}` : '(all built)'}</button>
      </div><p class="small muted">${f.plots.length} plots · ${f.pens} pens</p></div>
      <div class="card"><h3>📐 Bigger areas</h3><p class="small muted">Each area holds more friends when you expand it. Bigger expansions open at higher farm levels.</p>
        ${STATION_IDS.map((st) => `<div class="biome"><div>${STATIONS[st].emoji} <strong>${STATIONS[st].name}</strong> <span class="small">${f.crew[st].length}/${slotsFor(f, st)} friends</span></div>${expandHtml(p, st)}</div>`).join('')}</div>
      <div class="card"><h3>New lands</h3>${BIOMES.map((b) => {
        const block = biomeBlock(p, b.id);
        if (block === 'open') return `<div class="biome open">${b.emoji} <strong>${b.name}</strong> ✓</div>`;
        return `<div class="biome"><div>${b.emoji} <strong>${b.name}</strong><div class="small muted">New crops, critters, forage, recipes and 3 expedition routes. ${block && block !== 'bells' ? esc(blockText[block](b)) : ''}</div></div>
          <button data-action="farm-biome" data-id="${b.id}" ${block ? 'disabled' : ''}>Open · 🔔 ${biomeCost(p, b.id)}</button></div>`;
      }).join('')}</div>
      <div class="card"><h3>Decorations</h3><div class="grid">${DECOR.filter((d) => !d.stamp).map((d) => {
        const own = f.decor.includes(d.id);
        const cost = decorCost(p, d.id);
        const can = d.shards ? p.shards >= cost : f.bells >= cost;
        return `<div class="decor ${own ? 'owned' : ''}"><div class="big-emoji">${d.emoji}</div><div class="small">${esc(d.name)}</div>
          ${own ? '<div class="small">✓ On your farm</div>' : `<button class="small-btn" data-action="farm-decor" data-id="${d.id}" ${can ? '' : 'disabled'}>${d.shards ? `💎 ${cost}` : `🔔 ${cost}`}</button>`}</div>`;
      }).join('')}</div>
      <p class="small muted">Crystal decorations cost 💎 shards from duplicate friends. Journal prizes can't be bought: finish a Journal page to get them.</p></div>`;
  }

  // ---------- Sunshine ----------
  function sunHtml(p) {
    const jar = sunJar(p);
    const f = p.farm;
    const golden = goldenSeason(p, Date.now());
    const toFinish = sunToFinish(p);
    const useful = sunUseful(p);
    const tips = jar && useful ? pourTips(p) : [];
    const warn = ui.farm.pourWarn && tips.length ? `<div class="picker"><p><strong>Wait! Before you pour:</strong></p><ul>${tips.map((t) => `<li>${esc(t.text)}</li>`).join('')}</ul>
      <div class="row"><button class="secondary" data-action="farm-pour-go">Pour anyway</button><button class="ghost" data-action="farm-pour-cancel">Not yet</button></div></div>` : '';
    return `<div class="card sun-card ${golden ? 'golden' : ''}">
      <div class="row spread">
        <div><div class="sun-jar">☀️ <strong>${jar}</strong> <span class="small">Sunshine in your jar</span></div>
          <div class="small muted">${golden ? '🌟 Golden Season: you\'ve mastered everything, so the farm grows on its own!' : 'Every right answer in a learning game adds Sunshine. Sunshine grows everything here.'}${toFinish ? ` Everything growing needs ☀️ ${toFinish} more.` : ''}${jar && !useful ? ' Plant something or send an expedition, then pour.' : ''} Pouring only uses what's needed; the rest stays in the jar.</div></div>
        <button class="sun-btn" data-action="farm-pour" ${jar && useful ? '' : 'disabled'}>Pour ☀️ ${Math.min(jar, useful)}</button>
      </div>${warn}</div>`;
  }

  // ---------- Expeditions tab ----------
  function needText(n) {
    if (n.kind === 'element') return `${n.n > 1 ? `${n.n} ` : ''}${ELEMENTS[n.value].emoji} ${ELEMENTS[n.value].name}`;
    if (n.kind === 'job') return `${JOBS[n.value].emoji} ${JOBS[n.value].name}`;
    const t = THEMES.find((x) => x.id === n.value);
    return `${n.n} ${t.emoji} ${t.name}`;
  }

  function mapTab(p) {
    const f = p.farm;
    const slots = expeditionSlots(f);
    const out = f.expeditions.map((e, i) => {
      const r = ROUTES_BY_ID[e.route];
      const back = plotReady(e);
      return `<div class="card trip ${back ? 'back' : ''}"><div class="row spread"><div><strong>${r.emoji} ${esc(r.name)}</strong>
        <div style="font-size:1.6rem">${e.team.map((id) => friend(id).emoji).join(' ')}</div>
        <div class="small muted">${back ? 'Back home!' : `Needs ☀️ ${sunLeft(e, expeditionSpeed(e))} more`}</div></div>
        ${back ? `<button data-action="farm-trip-home" data-i="${i}">Welcome back</button>` : ''}</div></div>`;
    }).join('');
    const story = f.stories[0];
    const routeCard = (r, i) => {
      const route = ROUTES_BY_ID[r.route];
      const size = TEAM_SIZE_FOR[route.size];
      const picking = ui.farm.trip === i;
      const team = picking ? ui.farm.team : [];
      const met = needsMet(team, r.needs);
      const ex = routeExplorer(route.id);
      const exGot = ex && (f.critters[ex.id] || f.waiting.includes(ex.id));
      const souvGot = f.souvenirs.includes(route.souvenir.id);
      return `<div class="route ${r.done ? 'done' : ''}">
        <div class="row spread"><div><strong>${route.emoji} ${esc(route.name)}</strong>
          <div class="small muted">${route.size === 'big' ? 'Big trip' : 'Short trip'}: ${size} friends · ☀️ ${EXPEDITION_SUN[route.size]} · 💎 ${EXPEDITION_SHARDS[route.size]}</div>
          <div class="small">Finds: ${route.treasure.emoji} ${esc(route.treasure.name)} · 🏆 ${souvGot ? route.souvenir.emoji : '❓'}${ex ? ` · ${exGot ? ex.emoji : '❓'} rare critter` : ''}</div></div>
          ${r.done ? '<span class="pill">Done today ✓</span>' : picking ? '' : `<button data-action="farm-trip" data-i="${i}" ${f.expeditions.length >= slots ? 'disabled' : ''}>Pick a team</button>`}</div>
        <div class="small">Helps to bring: ${r.needs.map((n) => `<span class="need ${picking && team.filter((id) => fitsNeed(id, n)).length >= n.n ? 'met' : ''}">${needText(n)}</span>`).join(' ')}</div>
        ${picking ? teamPicker(p, r, size, team, met) : ''}
      </div>`;
    };
    const lands = BIOMES.map((b) => {
      const routes = Object.values(ROUTES_BY_ID).filter((r) => r.land === b.id);
      if (!biomeOpen(f, b.id)) {
        return `<div class="card route locked"><h3>🔒 ${b.emoji} ${esc(b.name)}</h3>
          <p class="small muted">Open this land in 🔨 Build (farm level ${b.level}) to explore ${routes.map((r) => `${r.emoji} ${esc(r.name)}`).join(', ')}.</p></div>`;
      }
      const cards = f.routes.list.map((r, i) => [r, i]).filter(([r]) => ROUTES_BY_ID[r.route].land === b.id).map(([r, i]) => routeCard(r, i)).join('');
      return `<div class="card"><h3>${b.emoji} ${esc(b.name)}</h3>${cards}</div>`;
    }).join('');
    const souvenirs = f.souvenirs.map((id) => Object.values(ROUTES_BY_ID).find((r) => r.souvenir.id === id).souvenir);
    return `<div class="card small"><p>Friends who aren't on a farm crew can go exploring. Every land has its own routes, and every route has its own treasure and souvenir; the big routes are home to a rare critter. Each need you meet makes the trip <strong>${Math.round(NEED_SPEED * 100)}% faster</strong> and brings home more treasure. Trips run on ☀️ Sunshine too, and needs change every day.</p>
        <p>Teams out: ${f.expeditions.length}/${slots} · Souvenirs: ${f.souvenirs.length}/${Object.keys(ROUTES_BY_ID).length}</p></div>
      ${out}${lands}
      ${story ? `<div class="card story"><h3>📜 Latest story</h3><p>${esc(story.text)}</p></div>` : ''}
      ${souvenirs.length ? `<div class="card"><h3>🏆 Trophy shelf</h3><div class="decor-row" style="max-width:none;text-align:left">${souvenirs.map((x) => `<span title="${esc(x.name)}">${x.emoji}</span>`).join(' ')}</div></div>` : ''}`;
  }

  function teamPicker(p, r, size, team, met) {
    const bench = benchFriends(p);
    bench.sort((a, b) => r.needs.filter((n) => fitsNeed(b, n)).length - r.needs.filter((n) => fitsNeed(a, n)).length || friend(a).name.localeCompare(friend(b).name));
    return `<div class="picker">
      <div class="row spread"><strong>Team: ${team.length}/${size} · needs met ${met}/${r.needs.length}</strong>
        <div class="row"><button data-action="farm-trip-go" ${team.length === size ? '' : 'disabled'}>Send them!</button><button class="ghost" data-action="farm-trip" data-i="-1">Cancel</button></div></div>
      ${bench.length ? `<div class="pick-list">${bench.map((id) => {
        const on = team.includes(id);
        const fits = r.needs.filter((n) => fitsNeed(id, n)).length;
        return `<button class="secondary pick-friend ${on ? 'selected' : ''}" data-action="farm-trip-pick" data-id="${id}" ${!on && team.length >= size ? 'disabled' : ''}>
          <span class="big-emoji">${friend(id).emoji}</span><div><strong>${esc(friend(id).name)}</strong>${fits ? ` <span class="small">⭐${fits > 1 ? '×' + fits : ''}</span>` : ''}<div>${traitBadge(id)} ${handTag(p.farm, id)}</div></div></button>`;
      }).join('')}</div>` : '<p class="muted">Everyone is busy. Take some friends off farm crews to send them exploring.</p>'}
    </div>`;
  }

  // ---------- Journal tab ----------
  function journalTab(p) {
    const f = p.farm;
    return Object.entries(JOURNAL_PAGES).map(([page, info]) => {
      const pr = journalProgress(f, page);
      const prize = DECOR.find((d) => d.stamp === page);
      return `<div class="card"><div class="row spread"><h3>${info.emoji} ${info.name}</h3><span class="pill">${pr.found}/${pr.total}${pr.complete ? ' · 📔 stamped' : ''}</span></div>
        <div class="journal">${info.entries.map((e) => {
          const got = (f.journal[page] || []).includes(e.id);
          return `<div class="jentry ${got ? '' : 'unknown'}" title="${got ? esc(e.name) : '???'}"><div class="big-emoji">${got ? e.emoji : '❓'}</div><div class="small">${got ? esc(e.name) : '???'}</div></div>`;
        }).join('')}</div>
        <p class="small muted">Prize: ${prize.emoji} ${esc(prize.name)}${page === 'crops' ? '. Wonder crops grow from Wonder Seeds, earned by mastering words and facts.' : page === 'critters' ? '. Some critters are babies of two others, some hatch from Mystery Eggs (finish a set or earn a Legendary), and some only follow expedition teams home.' : page === 'explore' ? '. Treasures and souvenirs come from expeditions.' : ''}</p></div>`;
    }).join('');
  }

  // ---------- screen ----------
  const screens = {
    farm() {
      const p = profile();
      const now = Date.now();
      if (!p.farm) return `${header({ ...p, farm: visitFarm(p, now).profile.farm })}`;
      const tab = { farm: farmTab, crew: crewTab, friends: friendsTab, map: mapTab, board: boardTab, build: buildTab, journal: journalTab }[ui.farm.tab] || farmTab;
      return `${header(p)}${tab(p, now)}`;
    },
  };

  const num = (v) => Number(v);
  const actions = {
    'farm-open': () => {
      const p = profile();
      if (farmLocked(p, Date.now())) return floatText('🌻 Friend Grove opens after a learning round today. Play a game first!', 2500);
      ui.farm = { ...ui.farm, tab: 'farm', plantAt: null, pickFor: null, news: [] };
      const v = visitFarm(p, Date.now());
      update(v.profile);
      ui.farm.news = v.events.map(eventText).filter(Boolean).slice(0, 4);
      go('farm');
    },
    'farm-pour': () => {
      if (pourTips(profile()).length && !ui.farm.pourWarn) {
        ui.farm.pourWarn = true;
        return render();
      }
      actions['farm-pour-go']();
    },
    'farm-pour-go': () => {
      ui.farm.pourWarn = false;
      const r = act((p) => pourSun(p));
      if (r?.poured) floatText(`☀️ ${r.poured} Sunshine!`);
    },
    'farm-pour-cancel': () => {
      ui.farm.pourWarn = false;
      render();
    },
    'farm-expand': (d) => {
      const r = act((p) => expandCrew(p, d.id));
      if (r) floatText('📐 One more spot!');
    },
    'farm-welcome': (d) => act((p) => welcomeExplorer(p, d.id)),
    'farm-trip': (d) => {
      ui.farm.trip = num(d.i) >= 0 ? num(d.i) : null;
      ui.farm.team = [];
      render();
    },
    'farm-trip-pick': (d) => {
      const t = ui.farm.team;
      ui.farm.team = t.includes(d.id) ? t.filter((id) => id !== d.id) : [...t, d.id];
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    },
    'farm-trip-go': () => {
      const i = ui.farm.trip;
      const team = ui.farm.team;
      ui.farm.trip = null;
      ui.farm.team = [];
      const r = act((p, now) => sendExpedition(p, i, team, now));
      if (r) floatText('🗺️ Off they go!');
    },
    'farm-trip-home': (d) => {
      const r = act((p, now) => collectExpedition(p, num(d.i), now));
      if (r?.rewards) {
        ui.farm.news = [`📜 ${r.story}`, `+${r.rewards.n} ${g(r.rewards.treasure).emoji} · +${r.rewards.bells} 🔔 · +${r.rewards.shards} 💎`, ...ui.farm.news].slice(0, 5);
        render();
      }
    },
    'farm-tab': (d) => {
      ui.farm.tab = d.id;
      ui.farm.pickFor = null;
      ui.farm.plantAt = null;
      ui.farm.trip = null;
      ui.farm.pourWarn = false;
      render();
      window.scrollTo(0, 0);
    },
    'farm-clear-news': () => {
      ui.farm.news = [];
      render();
    },
    'farm-plot': (d) => {
      ui.farm.plantAt = num(d.i) >= 0 ? num(d.i) : null;
      render();
    },
    'farm-plant': (d) => {
      const i = ui.farm.plantAt;
      ui.farm.plantAt = null;
      act((p, now) => plant(p, i, d.id, now));
    },
    'farm-harvest': () => {
      const r = act((p, now) => harvestAll(p, now));
      if (r?.harvested?.length) floatText(`+ ${r.harvested.map((h) => `${h.n} ${g(h.id).emoji}`).join(' ')}`);
    },
    'farm-fertilize': () => {
      const i = ui.farm.plantAt;
      ui.farm.plantAt = null;
      act((p, now) => fertilize(p, i, now));
    },
    'farm-befriend': () => act((p, now) => befriend(p, now)),
    'farm-bye': () => act((p, now) => waveBye(p, now)),
    'farm-hatch': () => act((p, now) => hatchEgg(p, now)),
    'farm-goodies': () => {
      const r = act((p, now) => collectGoodies(p, now));
      if (r?.collected) floatText(`+ ${Object.entries(r.collected).map(([id, n]) => `${n} ${g(id).emoji}`).join(' ')}`);
    },
    'farm-forage': () => {
      const r = act((p, now) => collectForage(p, now));
      if (r?.found) floatText(`+ ${Object.entries(r.found).map(([id, n]) => `${n} ${g(id).emoji}`).join(' ')}`);
    },
    'farm-craft': (d) => act((p, now) => startCraft(p, d.id, now)),
    'farm-craft-done': () => {
      const r = act((p, now) => collectCraft(p, now));
      if (r?.id) floatText(`${g(r.id).emoji} ${g(r.id).name}!`);
    },
    'farm-pick': (d) => {
      ui.farm.pickFor = d.id || null;
      if (d.id && ui.farm.tab !== 'crew') ui.farm.tab = 'crew';
      render();
      if (d.id) window.scrollTo(0, 0);
    },
    'farm-assign': (d) => {
      const st = ui.farm.pickFor;
      const r = act((p) => (stationOf(p.farm, d.id) === st ? removeCrew(p, d.id) : assignCrew(p, d.id, st)));
      if (r && profile().farm.crew[st].length >= slotsFor(profile().farm, st)) {
        ui.farm.pickFor = null;
        render();
      }
    },
    'farm-unassign': (d) => act((p) => removeCrew(p, d.id)),
    'farm-roster': (d) => {
      const y = window.scrollY;
      act((p) => (d.st ? assignCrew(p, d.id, d.st) : stationOf(p.farm, d.id) ? removeCrew(p, d.id) : p));
      window.scrollTo(0, y);
    },
    'farm-parent-sun': (d) => {
      const kid = data().profiles[ui.parentKid];
      if (!kid) return;
      update({ ...kid, sunJar: sunJar(kid) + num(d.n) });
      floatText(`☀️ +${d.n} for ${kid.name}`);
      render();
    },
    'farm-roster-filter': (d) => {
      ui.farm.rosterFilter = d.id;
      render();
    },
    'farm-perk': (d) => act((p, now) => usePerk(p, d.id, now)),
    'farm-fill': (d) => {
      const r = act((p, now) => fillRequest(p, num(d.i), now));
      if (r?.bells) floatText(`🔔 +${r.bells}`);
    },
    'farm-skip': (d) => act((p, now) => skipRequest(p, num(d.i), now)),
    'farm-sell': (d) => {
      const r = act((p) => sell(p, d.id, num(d.n)));
      if (r?.bells) floatText(`🔔 +${r.bells}`);
    },
    'farm-gift': (d) => {
      const other = data().profiles[d.id];
      const p0 = profile();
      const item = ui.farm.giftItem && p0.farm.items[ui.farm.giftItem] ? ui.farm.giftItem : Object.keys(p0.farm.items).find((id) => p0.farm.items[id] > 0);
      if (!other || !item) return;
      try {
        const r = sendGift(p0, other, item, GIFT_MAX, Date.now());
        update(r.receiver);
        update(r.sender);
        floatText(`🎁 Sent to ${other.name}!`);
        render();
      } catch (err) {
        floatText(friendly(err.message), 2500);
      }
    },
    'farm-buy-plot': () => act((p) => buyPlot(p)),
    'farm-buy-pen': () => act((p) => buyPen(p)),
    'farm-biome': (d) => {
      const r = act((p, now) => openBiome(p, d.id, now));
      if (r) floatText(`${BIOMES.find((b) => b.id === d.id).emoji} ${BIOMES.find((b) => b.id === d.id).name} is open!`);
    },
    'farm-decor': (d) => act((p) => buyDecor(p, d.id)),
  };

  /** Handle the farm's change events; returns true if it was one. */
  function onChange(kind, e, parentKid) {
    if (kind === 'farm-gift-item') {
      ui.farm.giftItem = e.target.value;
      return true;
    }
    if (kind === 'farm-gate') {
      const kid = parentKid();
      if (kid) update({ ...kid, farmGate: e.target.checked });
      return true;
    }
    return false;
  }

  function hubButton(p) {
    const locked = farmLocked(p, Date.now());
    const jar = sunJar(p);
    return `<button class="big secondary farm-btn" data-action="farm-open">🌻 Friend Grove${locked ? '<div class="small muted">Opens after a learning round today</div>' : jar ? `<div class="small">☀️ ${jar} Sunshine waiting</div>` : ''}</button>`;
  }

  function parentHtml(kid) {
    if (!kid) return '';
    return `<div class="card">
      <h3>🌻 Friend Grove</h3>
      <p class="small muted">A farm side game where friends work, crops grow, critters move in and friends go on expeditions. <strong>Learning powers it:</strong> every correct answer in any game puts ☀️ Sunshine in the Sun Jar (2 for a word that was missed last time, +10 for mastering one; warm-up facts give none), and Sunshine is what grows everything, not the clock. So there's no reason to check in at set times, and nothing is lost while away. There's ${MORNING_RAIN} free Sunshine each morning. When a kid has mastered everything and nothing needs a refresh, the farm grows on its own (Golden Season).
        The farm pays its own Grove Bells and never coins, packs or friends. Mastering gives Wonder Seeds; finishing sets gives Mystery Eggs. Farm XP comes mostly from pouring Sunshine (1 XP each), so farm progress follows learning, and it's capped at ${FARM_XP_PER_DAY} a day. Farm level gates bigger crew areas, new lands and more expedition teams, and each land's routes hold their own treasures, so collecting everything takes weeks, not a weekend. Learning itself is never capped. Each friend also has ⚡ energy and farm know-how: working uses energy and earns know-how, resting friends recover from the same Sunshine (plus a little each morning), so kids rotate friends instead of leaving one crew in place. A tired friend still works at half power; nothing is lost.</p>
      <div class="row" style="flex-wrap:wrap;margin:8px 0"><span>☀️ Sun Jar: <strong>${sunJar(kid)}</strong></span>
        ${PARENT_SUN.map((n) => `<button class="small-btn secondary" data-action="farm-parent-sun" data-n="${n}">+${n} ☀️</button>`).join('')}
        <span class="small muted">For testing and balancing. It goes straight into ${esc(kid.name)}'s jar and doesn't count as learning.</span></div>
      <label class="row"><input type="checkbox" data-action-change="farm-gate" ${kid.farmGate ? 'checked' : ''}> Only open Friend Grove after ${esc(kid.name)} plays a learning game that day</label>
    </div>`;
  }

  // Keep timers fresh while the farm is open.
  setInterval(() => {
    if (ui.screen === 'farm' && document.visibilityState === 'visible' && !ui.farm.pickFor && ui.farm.plantAt == null && ui.farm.trip == null) {
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    }
  }, 30e3);

  return { screens, actions, onChange, hubButton, parentHtml };
}

// Re-exported for the parent help text.
export { CROPS, RECIPES, WONDER_CROPS };
