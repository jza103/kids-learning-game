// UI for Spelling Quest. Plain DOM, no framework or build step.
import { THEMES, ITEMS_BY_ID, POWER_INFO, COSMETICS, themesOpen, nextTheme, LEGENDS, LEGEND_RULES, GOLD_BONUS } from './content.js';
import { claimLegends, legendProgress } from './legend.js';
import { masterySummary, masteryRating, MAX_BOX } from './srs.js';
import {
  BOX_COINS, COMEBACK_BONUS, PACK_COSTS, packCost, coinPaceNote, COIN_PACE, DAILY_COIN_MAX, DAILY_PACK_CAP, ODDS, CRAFT_COST, SHARDS_FOR_DUPLICATE,
  RARE_PITY, EPIC_PITY, canOpenPack, openPack, craft, packsLeftToday, pityStatus, themeProgress,
  MASTERY_COINS, SUPER_PACK_EVERY, openSuperPack, WISH_SHARDS, WISH_RARITIES, wishCoinCost, canWish, makeWish, wishPool,
} from './economy.js';
import { farmTrait, JOBS, ELEMENTS } from './farm-content.js';
import { REFRESH_SHARDS } from './sunshine.js';
import {
  XP_PER, TEAM_SIZE, levelProgress, levelForXp, unlockedCosmetics, applyXpBoost,
  claimSetRewards, earnedTitles,
} from './progress.js';
import { newBattle, applyAnswer, roundOver, hintText, ROUND_LENGTH } from './battle.js';
import { grant, grantHtml, grantName } from './grant.js';
import { ACTIVITIES, activityLabel, arenaHtml, zapText, clearedText, missText, animFor, targetsFor, randomStart } from './mine.js';
import {
  newProfile, addWords, removeWord, migrateProfile, currentWords, activeItems, recordAnswer, checkSpelling,
  pickPracticeWord, entryWarnings, cleanEntries,
} from './profile.js';
import { TRICKY_SETS, trickyState, setTricky, autoTricky, addTrickySet, readyForMore, setsLeft, trickySetEntries, WEEK_MS, READY_STARS } from './tricky.js';
import { load, save, requestPersistence, exportBackup, parseBackup } from './storage.js';
import { createVocab, VOCAB_SCREENS } from './vocab-ui.js';
import { sayWord, saySentence, speechAvailable, setSpeechPrefs, englishVoices, currentVoice, onVoicesChanged, unlockAudio, preloadSpeech, sayBuiltIn } from './speech.js';
import { getKey, setKey, listVoicesOrDefaults, prepareClips, countReady, clipSpecs, clipsForWord, sentenceClip, pruneClips, charCount, clearClips, generateClip } from './aivoice.js';
import { voiceQuality } from './voices.js';
import { teamPowersFor, friendsAfterAnswer } from './friends.js';
import { friendDetailsHtml, teamLineHtml, friendSummaryHtml, friendsHelpHtml } from './friendsui.js';
import { GAME_TYPES, GAME_TYPE_IDS } from './games.js';
import { initMath } from './mathgame.js';
import { initFarm } from './farmui.js';

// Shown on the grown-ups screen so you can tell an update has arrived.
const APP_VERSION = '2026-11-21.10';
const app = document.getElementById('app');
let data = load();
// claimLegends also catches sets finished before Legendaries existed.
for (const id of Object.keys(data.profiles)) data.profiles[id] = claimLegends(migrateProfile(data.profiles[id])).profile;
data.settings = { voiceURI: null, rate: 0.85, ...(data.settings || {}) };
data.settings.ai = { enabled: false, voiceId: null, voiceName: null, ...(data.settings.ai || {}) };
applySpeech();

/** Use the ElevenLabs voice only when it's switched on and a key is saved. */
function applySpeech() {
  const ai = data.settings.ai;
  setSpeechPrefs({ ...data.settings, aiVoiceId: ai.enabled && ai.voiceId && getKey() ? ai.voiceId : null });
}

function allClipSpecs() {
  return clipSpecs(Object.values(data.profiles));
}
const ui = { screen: 'home', game: null, reveal: null, packTheme: null, parentKid: null, flash: '', hubNote: '' };

/** Add this week's tricky-words set if one is due (see tricky.js). */
function checkTricky() {
  const p = profile();
  const r = p && autoTricky(p, Date.now());
  if (!r) return;
  update(r.profile);
  ui.hubNote = `🔤 New tricky words this week: ${r.set.name}!`;
  setTimeout(prepareAllClips, 0);
}

/** This week's tricky set, if this week's words came from the list. */
function currentTrickySet(p) {
  const st = trickyState(p);
  return st.on && st.batch != null && st.batch === p.currentBatch ? TRICKY_SETS[st.next - 1] : null;
}

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const profile = () => data.profiles[data.activeId];
function update(p) {
  data.profiles[p.id] = p;
  save(data);
}
function go(screen) {
  if (ui.pendingReload) return location.reload();
  // Visiting the Collection counts as having seen new Legendaries.
  if (screen === 'book' && profile()?.legendsNew?.length) update({ ...profile(), legendsNew: [] });
  ui.screen = screen;
  ui.flash = '';
  render();
  window.scrollTo(0, 0);
}
const cosmetic = (id) => COSMETICS.find((c) => c.id === id);

function applyLook(p) {
  const color = p ? cosmetic(p.look.color)?.value : null;
  document.documentElement.style.setProperty('--accent', color || '#4f8cff');
}

function heroHtml(p, size = '') {
  const hero = cosmetic(p.look.hero)?.value || '🐱';
  const hat = p.look.hat ? cosmetic(p.look.hat)?.value : '';
  return `<span class="hero ${size}">${hat ? `<span class="hat">${hat}</span>` : ''}${hero}</span>`;
}

function topbar(title) {
  const p = profile();
  return `<div class="topbar">
    <button class="secondary" data-action="go" data-to="hub">← Back</button>
    <h2 style="margin:0">${esc(title)}</h2>
    <div class="row"><span class="pill">🟡 ${p.coins}</span><span class="pill">💎 ${p.shards}</span></div>
  </div>`;
}

function collectibleCard(item, { owned = true, extra = '', cls = '' } = {}) {
  const spec = GAME_TYPES[item.specialty];
  const gold = owned && profile()?.gold?.[item.id];
  return `<div class="collectible ${owned ? '' : 'missing'} ${gold ? 'gold' : ''} ${item.rarity === 'legendary' ? 'legendary' : ''} ${cls}">
    <div class="art">${item.emoji}</div>
    <div><strong>${owned ? esc(item.name) : '???'}</strong></div>
    <div class="rarity ${item.rarity}">${gold ? '✨ gold ' : ''}${item.rarity}</div>
    ${owned ? friendDetailsHtml(profile(), item.id) : `<div class="small muted">${spec.emoji} ${spec.name} friend</div>`}
    ${traitHtml(item.id)}
    ${extra}
  </div>`;
}

function traitHtml(id) {
  const t = farmTrait(id);
  return t ? `<div class="trait">${JOBS[t.job].emoji} ${JOBS[t.job].name} · ${ELEMENTS[t.element].emoji} ${ELEMENTS[t.element].name}</div>` : '';
}

const WISH_ATTRS = [
  ...Object.values(ELEMENTS).map((e) => ({ kind: 'element', value: e.id, label: `${e.emoji} ${e.name}` })),
  ...Object.values(JOBS).map((j) => ({ kind: 'job', value: j.id, label: `${j.emoji} ${j.name}` })),
];

function wishHtml(p, now) {
  const attr = WISH_ATTRS.find((a) => `${a.kind}:${a.value}` === ui.wishAttr) || WISH_ATTRS[0];
  const left = wishPool(p, attr, now).length;
  const coins = canWish(p, attr, 'coins', now);
  const reason = { cap: 'No packs left today.', coins: `You need ${wishCoinCost(p, now)} nuggets.`, none: 'You have every one of those already!' };
  return `<div class="card wish-card"><h3>🌠 Wishing Well</h3>
    <p class="small">Need a certain kind of friend for Friend Grove? Pick an element or a job and wish. You'll get a friend you don't have yet with it. Ultras and Legendaries never come from wishes.</p>
    <div class="row"><select data-action-change="wish-attr" aria-label="Wish for">${WISH_ATTRS.map((a) => `<option value="${a.kind}:${a.value}" ${a === attr ? 'selected' : ''}>${a.label}</option>`).join('')}</select>
      <span class="small muted">${left} you don't have yet</span></div>
    <div class="row" style="margin-top:12px">
      <button data-action="wish" data-pay="coins" ${coins.ok ? '' : 'disabled'}>Wish · 🟡 ${wishCoinCost(p, now)}</button>
      ${WISH_RARITIES.map((r) => {
        const ok = canWish(p, attr, 'shards', now, r).ok;
        return `<button class="secondary" data-action="wish" data-pay="shards" data-rarity="${r}" ${ok ? '' : 'disabled'}><span class="rarity ${r}">${r}</span> · 💎 ${WISH_SHARDS[r]}</button>`;
      }).join('')}
    </div>
    <p class="small muted">${coins.ok ? '' : reason[coins.reason] + ' '}A nugget wish rolls rarity like a pack and uses one of today's packs. A gem dust wish lets you pick the rarity.</p></div>`;
}

function starsHtml(item) {
  const { stars, label, refresh } = masteryRating(item);
  return `<span class="stars" title="${label}">${'★'.repeat(stars)}<span class="off">${'★'.repeat(MAX_BOX - stars)}</span>${refresh ? ' 🧽' : ''}</span>`;
}

function legendNewsHtml(p) {
  const fresh = (p.legendsNew || []).map((id) => ITEMS_BY_ID[id]).filter(Boolean);
  if (!fresh.length) return '';
  return `<div class="card super-card"><h3>🏆 New Legendary friend${fresh.length > 1 ? 's' : ''}!</h3>
    <p style="font-size:2.4rem;margin:4px 0">${fresh.map((l) => l.emoji).join(' ')}</p>
    <p>${fresh.map((l) => `<strong>${esc(l.name)}</strong> (${esc(legendHow(l))})`).join(', ')}</p>
    <button class="super" data-action="go" data-to="book">See them in your Collection</button></div>`;
}

function legendHow(l) {
  if (l.track === 'math') return `every ${l.table}s × and ÷ fact mastered`;
  if (l.track === 'spelling') return `${LEGEND_RULES.weekStars} Week Stars`;
  return `${LEGEND_RULES.vocabWords} Word Match words mastered`;
}

function legendsHtml(p) {
  const lp = legendProgress(p);
  const card = (l) => collectibleCard(l, {
    owned: Boolean(p.collection[l.id]),
    cls: p.team.includes(l.id) ? 'on-team' : '',
    extra: p.collection[l.id]
      ? `<button class="${p.team.includes(l.id) ? '' : 'secondary'}" data-action="toggle-team" data-id="${l.id}">${p.team.includes(l.id) ? 'On team ✓' : 'Add to team'}</button>`
      : `<div class="small muted" style="margin-top:8px">${esc(legendHow(l))}</div>`,
  });
  const nextOf = (track) => LEGENDS.filter((l) => l.track === track && !p.collection[l.id]).slice(0, 1);
  const owned = (track) => LEGENDS.filter((l) => l.track === track && p.collection[l.id]);
  const titans = LEGENDS.filter((l) => l.track === 'math');
  return `<div class="card">
    <div class="row spread"><h3>🏆 Legendary</h3><span class="pill">${LEGENDS.filter((l) => p.collection[l.id]).length} earned</span></div>
    <p class="small muted">The strongest friends. They never come from packs: you earn them by finishing a whole set.</p>
    <p><strong>✏️ Spelling:</strong> ⭐ ${lp.weekStars} Week Star${lp.weekStars === 1 ? '' : 's'}. Master every word on a week's list for a star; ${lp.starsToNext} more for the next Legendary.</p>
    <p><strong>📚 Word Match:</strong> ${lp.vocab} words mastered; ${lp.vocabToNext} more for the next Legendary.</p>
    <p><strong>✖️ Times tables:</strong> a Table Titan for each table from 3 to 12 when every × and ÷ fact is mastered.
      ${lp.tables.map((t) => `<span class="pill small">${t.table}s ${t.mastered}/${t.total}</span>`).join(' ')}</p>
    <div class="grid">${[...owned('spelling'), ...nextOf('spelling'), ...owned('vocab'), ...nextOf('vocab'), ...titans].map(card).join('')}</div>
  </div>`;
}

function superProgressHtml(p) {
  const n = p.superProgress || 0;
  return `<div class="super-progress"><span>🌟 Super Pack</span>
    <span class="dots">${'●'.repeat(n)}<span class="off">${'●'.repeat(SUPER_PACK_EVERY - n)}</span></span>
    <span class="small muted">Master ${SUPER_PACK_EVERY - n} more word${SUPER_PACK_EVERY - n === 1 ? '' : 's'}</span>
    ${p.superPacks ? `<button class="super" data-action="go" data-to="packs">Open ${p.superPacks} Super Pack${p.superPacks > 1 ? 's' : ''}!</button>` : ''}</div>`;
}

function floatText(text, ms = 1000) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  if (ms > 1000) {
    el.style.animationDuration = `${ms}ms`;
    el.classList.add('float-msg');
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- screens ----------
const screens = {
  home() {
    const kids = data.order.map((id) => data.profiles[id]).filter(Boolean);
    return `<h1>Spelling Quest</h1>
      ${kids.length ? '<p class="muted">Who is playing?</p>' : '<p>Welcome! A grown-up can add players and this week\'s words.</p>'}
      <div class="grid">
        ${kids
          .map(
            (k) => `<button class="secondary" style="min-height:150px" data-action="pick-kid" data-id="${k.id}">
              ${heroHtml(k, 'sm')}<div style="margin-top:8px">${esc(k.name)}</div></button>`,
          )
          .join('')}
      </div>
      <div style="margin-top:24px">${parentButton()}</div>`;
  },

  hub() {
    const p = profile();
    const lp = levelProgress(p.xp);
    const week = currentWords(p);
    const weekSum = masterySummary(week.map((w) => p.srs[w.id]).filter(Boolean));
    return `<div class="topbar">
        <button class="ghost" data-action="go" data-to="home">Switch player</button>
        <div class="row"><span class="pill">🟡 ${p.coins}</span><span class="pill">💎 ${p.shards}</span></div>
      </div>
      <div class="card hub-head">
        ${heroHtml(p)}
        <div style="flex:1">
          <h1 style="margin-bottom:4px">${esc(p.name)}</h1>
          ${p.look.title ? `<div class="muted">${esc(p.look.title)}</div>` : ''}
          <div class="small" style="margin:6px 0">Level ${lp.level} · ${lp.into}/${lp.needed} XP</div>
          <div class="xpbar"><div style="width:${(100 * lp.into) / lp.needed}%"></div></div>
        </div>
      </div>
      ${ui.hubNote ? `<div class="card" style="border-color:var(--good)">${esc(ui.hubNote)}</div>` : ''}
      ${trickyHubHtml(p)}
      ${
        p.words.length
          ? `<p class="muted">This week: ${week.length} words · ${weekSum.mastered} mastered · ${p.masteredWords || 0} mastered all time</p>`
          : `<p class="muted">No words yet. Ask a grown-up to add this week's list.</p>`
      }
      <div class="game-pick">
        <button class="big" data-action="play" ${p.words.length ? '' : 'disabled'}>${activityLabel('spelling')}</button>
        <button class="big secondary" data-action="go" data-to="math">${activityLabel('math')}</button>
        ${vocab.hubButton(p)}
        ${farm.hubButton(p)}
      </div>
      ${legendNewsHtml(p)}
      <div class="card">${superProgressHtml(p)}</div>
      <div class="menu">
        <button class="secondary" data-action="go" data-to="packs"><span class="icon">🎁</span>Packs</button>
        <button class="secondary" data-action="go" data-to="book"><span class="icon">📖</span>Collection</button>
        <button class="secondary" data-action="go" data-to="words"><span class="icon">📝</span>My words</button>
        <button class="secondary" data-action="go" data-to="locker"><span class="icon">🎨</span>Locker</button>
      </div>
      <div style="margin-top:24px">${parentButton()}</div>`;
  },

  play() {
    return `<div id="play-top">${playTop()}</div>
      <div class="card">
        <div id="play-prompt">${playPrompt()}</div>
        <form data-form="answer" autocomplete="off">
          <input class="answer" id="answer" type="text" autocomplete="off" autocorrect="off" autocapitalize="off"
            spellcheck="false" enterkeyhint="go" aria-label="Type the word">
          <div class="feedback" id="play-feedback"></div>
          <button class="big" id="play-submit" style="width:100%" type="submit">⛏️ Dig!</button>
        </form>
      </div>
      <p class="small muted" style="text-align:center">${teamLineHtml(profile(), 'spelling')}</p>`;
  },

  summary() {
    const g = ui.game;
    const p = profile();
    const wordOf = (id) => p.words.find((w) => w.id === id)?.word;
    const missed = [...g.missed].map(wordOf).filter(Boolean);
    const mastered = g.mastered.map(wordOf).filter(Boolean);
    return `<h1>Round done! 🎉</h1>
      <div class="card">
        <div class="row" style="font-size:1.3rem;gap:24px">
          <span>🟡 +${g.earned.coins}</span><span>⭐ +${g.earned.xp} XP</span>${g.earned.sun ? `<span>☀️ +${g.earned.sun}</span>` : ''}<span>${ACTIVITIES.spelling.count(g.battle.defeated)}</span>
        </div>
        ${
          mastered.length
            ? `<p style="font-size:1.3rem">🌟 <strong>You mastered ${mastered.map((w) => `“${esc(w)}”`).join(', ')}!</strong> +${MASTERY_COINS * mastered.length} 🟡</p>`
            : ''
        }
        ${superProgressHtml(p)}
        ${coinPaceNote(p, Date.now()) ? `<p class="small muted">${coinPaceNote(p, Date.now())}</p>` : ''}
        ${g.levelUp ? `<p style="font-size:1.3rem"><strong>Level up! You're level ${levelForXp(p.xp)}.</strong> Check the Locker for new stuff.</p>` : ''}
      </div>
      ${
        missed.length
          ? `<div class="card"><h3>Words to keep practicing</h3><p style="font-size:1.4rem">${missed.map(esc).join(' · ')}</p>
             <p class="small muted">These will come back more often, and pay extra nuggets when you get them right.</p></div>`
          : ''
      }
      ${friendSummaryHtml(g.friendsBefore, p, g.friendEvents)}
      <div class="row">
        <button class="big" data-action="play">Play again</button>
        <button class="big secondary" data-action="go" data-to="packs">🎁 Packs</button>
        <button class="big secondary" data-action="go" data-to="hub">Home</button>
      </div>`;
  },

  packs() {
    const p = profile();
    const now = Date.now();
    const left = packsLeftToday(p, now);
    const check = canOpenPack(p, now);
    const open = themesOpen(now);
    const theme = open.find((t) => t.id === ui.packTheme) || open[0];
    const pity = pityStatus(p.packs);
    const r = ui.reveal;
    return `${topbar('Packs')}
      ${
        r && !r.item
          ? `<div class="reveal"><div class="flip collectible"><div class="art">💎</div><p><strong>You have every friend!</strong><br>+${r.shards} gem dust</p></div></div>`
          : r
          ? `<div class="reveal"><div class="flip">${collectibleCard(r.item, {
              cls: r.super ? 'ultra-glow' : '',
              extra: r.wish
                ? '<p><strong>🌠 Your wish came true!</strong></p>'
                : r.gold
                ? `<p><strong>✨ Gold version!</strong><br>Gold friends get +${GOLD_BONUS} power.</p>`
                : r.duplicate
                ? `<p><strong>You already have this one!</strong><br>+${r.shards} 💎 gem dust</p>`
                : '<p><strong>New friend!</strong></p>',
            })}</div></div>`
          : ''
      }
      ${
        p.superPacks
          ? `<div class="card super-card"><h3>🌟 You have ${p.superPacks} Super Pack${p.superPacks > 1 ? 's' : ''}!</h3>
             <p>You earned ${p.superPacks > 1 ? 'these' : 'this'} by mastering. A Super Pack gives an <strong class="rarity ultra">ultra</strong> friend from the theme you pick. Once you have that theme's ultras, it turns one of your rare, epic or ultra friends <strong>✨ gold</strong> (+${GOLD_BONUS} power) instead. It doesn't count toward today's packs.</p>
             <button class="big super" data-action="open-super">Open ${theme.emoji} Super Pack</button></div>`
          : `<div class="card">${superProgressHtml(p)}<p class="small muted">Ultra friends only come from Super Packs. Master ${SUPER_PACK_EVERY} words to earn one.</p></div>`
      }
      ${wishHtml(p, now)}
      <div class="card">
        <h3>Pick a theme</h3>
        <div class="grid">
          ${open.map((t) => {
            const tp = themeProgress(t, p.collection);
            return `<button class="theme-pick ${t.id === theme.id ? 'selected' : ''}" data-action="pack-theme" data-id="${t.id}">
              <span class="icon">${t.emoji}</span>${t.name}<div class="small muted">${tp.owned}/${tp.total}${tp.complete ? ' ✓' : ''}</div></button>`;
          }).join('')}
        </div>
        <div class="row" style="margin-top:16px">
          <button class="big" data-action="open-pack" ${check.ok ? '' : 'disabled'}>Open ${theme.emoji} pack · 🟡 ${packCost(p, now)}</button>
          <span class="muted">${left} of ${DAILY_PACK_CAP} packs left today</span>
        </div>
        ${check.reason === 'coins' ? `<p class="muted">You need ${packCost(p, now) - p.coins} more nuggets. Spell words to earn them!</p>` : ''}
        <p class="small muted">Packs today cost ${PACK_COSTS.slice(0, DAILY_PACK_CAP).join(', ')} nuggets. Back to ${PACK_COSTS[0]} tomorrow.</p>
        ${check.reason === 'cap' ? '<p class="muted">That\'s all the packs for today. More tomorrow!</p>' : ''}
        ${themeProgress(theme, p.collection).complete ? '<p class="muted">You have every friend in this theme, so packs here give gem dust.</p>' : ''}
      </div>
      <div class="card small">
        <h3>What's in a pack</h3>
        <p>Each pack has one friend from the theme you pick. Friends you don't have yet always come first.</p>
        <table>
          <tr><th>Rarity</th><th>Chance</th><th>Gem dust if you already have it</th></tr>
          ${Object.entries(ODDS)
            .map(([k, v]) => `<tr><td class="rarity ${k}">${k}</td><td>${Math.round(v * 100)}%</td><td>${SHARDS_FOR_DUPLICATE[k]} 💎</td></tr>`)
            .join('')}
        </table>
        <p>Rare or better guaranteed within <strong>${pity.rareIn}</strong> pack${pity.rareIn === 1 ? '' : 's'}.
           Epic guaranteed within <strong>${pity.epicIn}</strong>.</p>
        <p class="muted">Gem dust lets you pick any missing common, rare or epic friend in your Collection. Ultras and gold versions only come from Super Packs, and Legendaries only from finishing a whole set, so the best friends always take mastering.</p>
      </div>`;
  },

  book() {
    const p = profile();
    const powerLines = GAME_TYPE_IDS.map((g) => {
      const line = Object.entries(teamPowersFor(p, g))
        .filter(([, n]) => n)
        .map(([k, n]) => `${POWER_INFO[k].label}: ${POWER_INFO[k].describe(n)}`)
        .join(' · ');
      return `<div>${GAME_TYPES[g].emoji} <strong>${GAME_TYPES[g].name}:</strong> ${line || '<span class="muted">no powers yet</span>'}</div>`;
    }).join('');
    return `${topbar('Collection')}
      <div class="card">
        <h3>Your team (${p.team.length}/${TEAM_SIZE})</h3>
        <p class="muted small">Friends on your team give you powers in the games they know, and grow when you play. Tap a friend you own to add or remove it.</p>
        <div style="font-size:2.4rem">${p.team.map((id) => ITEMS_BY_ID[id]?.emoji).join(' ') || '—'}</div>
        <div class="small" style="margin-top:8px">${powerLines}</div>
      </div>
      ${friendsHelpHtml()}
      <div class="card"><div class="row spread"><h3>💎 Gem Cutter</h3><span class="pill">💎 ${p.shards} gem dust</span></div>
        <p class="small muted">Cut gem dust into any missing common, rare or epic friend: tap 💎 Cut under a friend below (${Object.entries(CRAFT_COST).map(([r, c]) => `${r} ${c}`).join(', ')}). Gem dust comes from duplicate friends, polishing mastered words and facts, and expeditions.</p></div>
      ${legendsHtml(p)}
      ${nextTheme() ? `<div class="card"><h3>${nextTheme().emoji} ${esc(nextTheme().name)}: coming ${new Date(nextTheme().from + 'T12:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</h3><p class="small muted">A new theme with 12 new friends arrives every month.</p></div>` : ''}
      ${themesOpen().map((t) => {
        const tp = themeProgress(t, p.collection);
        return `<div class="card">
          <div class="row spread"><h3>${t.emoji} ${t.name}</h3><span class="pill">${tp.owned}/${tp.total}${tp.complete ? ` · 🏅 ${esc(t.reward)}` : ''}</span></div>
          <div class="grid">
            ${t.items
              .map((item) => {
                const owned = Boolean(p.collection[item.id]);
                const onTeam = p.team.includes(item.id);
                const cost = CRAFT_COST[item.rarity];
                const extra = owned
                  ? `<button class="${onTeam ? '' : 'secondary'}" data-action="toggle-team" data-id="${item.id}">${onTeam ? 'On team ✓' : 'Add to team'}</button>`
                  : cost === undefined
                  ? '<div class="small muted" style="margin-top:8px">🌟 From Super Packs</div>'
                  : `<button class="secondary" data-action="craft" data-id="${item.id}" ${p.shards >= cost ? '' : 'disabled'}>💎 Cut · ${cost}</button>`;
                return collectibleCard(item, { owned, extra, cls: onTeam ? 'on-team' : '' });
              })
              .join('')}
          </div>
        </div>`;
      }).join('')}`;
  },

  locker() {
    const p = profile();
    const lp = levelProgress(p.xp);
    const unlocked = new Set(unlockedCosmetics(p.xp).map((c) => c.id));
    const section = (kind, title) => `<div class="card"><h3>${title}</h3><div class="row">
      ${kind === 'hat' ? `<button class="pick ${!p.look.hat ? 'selected' : ''}" data-action="look" data-kind="hat" data-id="">🚫</button>` : ''}
      ${COSMETICS.filter((c) => c.kind === kind)
        .map((c) => {
          const ok = unlocked.has(c.id);
          const sel = p.look[kind] === c.id;
          if (kind === 'color')
            return `<button class="swatch ${sel ? 'selected' : ''} ${ok ? '' : 'locked'}" style="background:${c.value}" title="${esc(c.label)}${ok ? '' : ` (level ${c.level})`}"
              data-action="look" data-kind="color" data-id="${c.id}" ${ok ? '' : 'disabled'}></button>`;
          return `<button class="pick ${sel ? 'selected' : ''} ${ok ? '' : 'locked'}" data-action="look" data-kind="${kind}" data-id="${c.id}" ${ok ? '' : 'disabled'}>
            ${c.value}${ok ? '' : `<div class="small">Lv ${c.level}</div>`}</button>`;
        })
        .join('')}</div></div>`;
    const titles = earnedTitles(p.collection);
    return `${topbar('Locker')}
      <div class="card hub-head">${heroHtml(p)}<div><h2>${esc(p.name)}</h2><div>Level ${lp.level} · ${lp.into}/${lp.needed} XP to next level</div></div></div>
      ${section('hero', 'Hero')}
      ${section('hat', 'Hat')}
      ${section('color', 'Color')}
      <div class="card"><h3>Title</h3>
        ${
          titles.length
            ? `<div class="row"><button class="pick small ${!p.look.title ? 'selected' : ''}" data-action="title" data-id="">None</button>
               ${titles.map((t) => `<button class="pick small ${p.look.title === t ? 'selected' : ''}" data-action="title" data-id="${esc(t)}">${esc(t)}</button>`).join('')}</div>`
            : '<p class="muted">Finish a theme in your collection to earn a title.</p>'
        }
      </div>`;
  },

  words() {
    const p = profile();
    const week = new Set(currentWords(p).map((w) => w.id));
    const sorted = [...p.words].sort((a, b) => (week.has(b.id) - week.has(a.id)) || (b.addedAt - a.addedAt));
    const row = (w) => `<tr><td><strong>${esc(w.word)}</strong>${week.has(w.id) ? ' <span class="tag">this week</span>' : ''}</td>
      <td>${starsHtml(p.srs[w.id])}</td><td class="small muted">${masteryRating(p.srs[w.id]).label}</td></tr>`;
    return `${topbar('My words')}
      <div class="card">${superProgressHtml(p)}</div>
      <div class="card">
        <p class="small muted">The first 2 stars come quickly; after that a word earns one new star a day, so practicing a little every day wins. A miss takes away 2 stars. Five stars means mastered!</p>
        <table>${sorted.map(row).join('')}</table>
      </div>`;
  },

  parent() {
    const kids = data.order.map((id) => data.profiles[id]).filter(Boolean);
    const kid = data.profiles[ui.parentKid] || kids[0];
    if (kid) ui.parentKid = kid.id;
    const items = kid ? activeItems(kid) : [];
    const sum = masterySummary(items);
    const week = new Set(kid ? currentWords(kid).map((w) => w.id) : []);
    const bank = kid ? [...kid.words].sort((a, b) => (week.has(b.id) - week.has(a.id)) || (b.addedAt - a.addedAt)) : [];
    const voices = englishVoices();
    const active = currentVoice();
    return `<div class="topbar">
        <button class="secondary" data-action="go" data-to="${data.activeId ? 'hub' : 'home'}">← Back</button>
        <h2 style="margin:0">Grown-ups</h2><span></span>
      </div>
      ${ui.flash ? `<div class="card" style="border-color:var(--good)">${esc(ui.flash)}</div>` : ''}
      <div class="card">
        <h3>Players</h3>
        <div class="row">
          ${kids.map((k) => `<button class="${k.id === kid?.id ? '' : 'secondary'}" data-action="parent-kid" data-id="${k.id}">${esc(k.name)}</button>`).join('')}
        </div>
        <form data-form="add-kid" class="row" style="margin-top:12px">
          <input type="text" name="name" placeholder="New player's name" maxlength="24" autocomplete="off">
          <button type="submit" class="secondary">Add player</button>
        </form>
      </div>
      <div class="card">
        <h3>Voice</h3>
        ${
          !speechAvailable()
            ? '<p>Speech is not available in this browser.</p>'
            : `<p class="small muted">Words are read by a voice built into this device, and the game picks the best one the browser offers.
                Note: on iPad, Safari only lets websites use some of the installed voices. Premium voices you download in Settings usually don't show up here; that's an Apple limit.</p>
               <div class="row">
                 <select data-action-change="voice" aria-label="Voice">
                   <option value="">Automatic (best installed${active ? `: ${esc(active.name)}` : ''})</option>
                   ${voices
                     .map((v) => `<option value="${esc(v.voiceURI)}" ${data.settings.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)}${voiceQuality(v) ? ` (${voiceQuality(v)})` : ''} · ${esc(v.lang)}</option>`)
                     .join('')}
                 </select>
                 <label class="row small">Speed <input type="range" min="0.6" max="1.1" step="0.05" value="${data.settings.rate}" data-action-change="rate"></label>
                 <button class="secondary" data-action="test-voice">🔊 Test</button>
               </div>`
        }
        ${aiVoiceHtml()}
      </div>
      ${math.parentHtml(kid)}
      ${grantHtml(kid, esc)}
      ${farm.parentHtml(kid)}
      ${kid ? trickyParentHtml(kid) : ''}
      ${
        kid
          ? `<div class="card">
          <h3>Add this week's words for ${esc(kid.name)}</h3>
          <p class="small muted">Type each word, and a sentence if you like. For the sentence, write just the sentence and use the word exactly as it's spelled: the game says the word before and after it for you.
            Tap 🔊 to hear exactly what your kids will hear.<br>
            New words join ${esc(kid.name)}'s word bank and become this week's practice words. Older words keep their stars and come back now and then for review.
            Adding an old word again puts it back in this week's set.</p>
          <form data-form="words">
            <div id="entry-rows">${Array.from({ length: ENTRY_ROWS }, (_, i) => entryRowHtml(i)).join('')}</div>
            <button type="button" class="ghost" data-action="more-rows">+ More words</button>
            <div class="row" style="margin-top:12px"><button type="submit">Add as this week's words</button>
            ${speechAvailable() ? '' : '<span class="muted">Speech is not available in this browser, so words will be shown instead of read aloud.</span>'}</div>
          </form>
        </div>
        <div class="card">
          <h3>${esc(kid.name)}'s word bank</h3>
          <p>${bank.length} words · ${sum.mastered} mastered · ${sum.learning} learning · ${sum.new} not tried yet · ${kid.stats.correct}/${kid.stats.answered} correct overall</p>
          ${
            bank.length
              ? `<table><tr><th>Word</th><th>Mastery</th><th>Right</th><th>Missed</th><th>Added</th><th></th></tr>
                ${bank
                  .map((w) => {
                    const i = kid.srs[w.id];
                    return `<tr><td><strong>${esc(w.word)}</strong>${week.has(w.id) ? ' <span class="tag">this week</span>' : ''}</td>
                      <td>${starsHtml(i)} <span class="small muted">${masteryRating(i).label}</span></td>
                      <td>${i?.correct ?? 0}</td><td>${i?.misses ?? 0}</td>
                      <td class="small muted">${new Date(w.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                      <td class="nowrap"><button class="ghost" data-action="hear-bank" data-id="${esc(w.id)}" aria-label="Hear ${esc(w.word)}">🔊</button><button class="ghost" data-action="remove-word" data-id="${esc(w.id)}" aria-label="Remove ${esc(w.word)}">✕</button></td></tr>`;
                  })
                  .join('')}</table>`
              : ''
          }
          <p class="small muted">Mastery is a 0–${MAX_BOX} star rating. The first 2 stars can come in one round; from then on a word earns at most one new star a day, so a word takes at least 4 days of practice to master and cramming a list in one sitting doesn't (Word Match works the same way; times tables don't wait). A miss takes away 2 stars.
            🔊 plays a word the way the kids hear it. ✕ deletes a word completely (for typos), stars and all. Nuggets and cards already earned stay.</p>
          <p class="small muted preview-status"></p>
        </div>
        ${vocab.parentHtml(kid)}`
          : ''
      }
      <div class="card small">
        <h3>How rewards work</h3>
        <p>Nuggets only come from correct answers, never from finishing a round. A word pays by how well it's known:
          ${BOX_COINS.join(', ')} nuggets from new to mastered, plus ${COMEBACK_BONUS} for getting a recently missed word right.
          Using a hint pays half. XP (${XP_PER.correct} per correct answer, ${XP_PER.monster} per gem, ore bucket or cart station) only unlocks looks in the Locker.</p>
        <p>Nuggets slow down after a lot of play in one day: the first ${COIN_PACE[0].upTo} nuggets pay in full, then answers pay half until ${COIN_PACE[1].upTo}, then 1 nugget each until ${DAILY_COIN_MAX}, when the nugget bag is full until tomorrow. Mastery rewards always pay in full.</p>
        <p>At most ${DAILY_PACK_CAP} packs a day, and each one costs a bit more than the last: ${PACK_COSTS.slice(0, DAILY_PACK_CAP).join(', ')} nuggets, back to ${PACK_COSTS[0]} the next day. Odds: ${Object.entries(ODDS)
          .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
          .join(', ')}. A rare or better is guaranteed every ${RARE_PITY} packs and an epic every ${EPIC_PITY}.
          Missing friends always come before duplicates, duplicates become gem dust, and gem dust can make any missing friend except ultras.
          Gem dust also comes from polishing a mastered word or fact (${REFRESH_SHARDS} each) and from Friend Grove expeditions. The 🌠 Wishing Well (on the Packs screen) gives a missing friend with an element or job the kid picks, for nuggets (uses one of the day's packs) or gem dust; never an ultra or Legendary.
          Nothing in the app costs money.</p>
        <p><strong>The big rewards come from mastering words.</strong> The first time a word reaches ${MAX_BOX} stars it pays ${MASTERY_COINS} nuggets and ${XP_PER.mastered} XP,
          and every ${SUPER_PACK_EVERY} mastered words earn a Super Pack: an ultra friend, or once a theme's ultras are owned, a ✨ gold version (+${GOLD_BONUS} power) of a rare, epic or ultra friend (not limited by the daily cap). Ultras and gold versions can't be bought with nuggets or gem dust.</p>
        <p><strong>🏆 Legendary friends</strong> only come from finishing a whole set: a Table Titan for each times table from 3 to 12 (every × and ÷ fact mastered), one for every ${LEGEND_RULES.weekStars} Week Stars (a Week Star = every word on that week's list mastered, at least ${LEGEND_RULES.minWeekWords} words), and one for every ${LEGEND_RULES.vocabWords} mastered Word Match words.</p>
        <p><strong>🧽 Polishing:</strong> mastered words and facts lose their shine and come back after 7 days, then 14, 30 and 60 (half as long for ones that were missed a couple of times). Until they're polished up with a right answer they show 4 stars and 🧽, and each polish gives ${REFRESH_SHARDS} 💎 gem dust. Mastery rewards are only paid once. A new theme with 12 friends arrives each month through June.</p>
      </div>
      <div class="card">
        <h3>Backup</h3>
        <p class="small muted">Progress is stored only on this iPad. Save a backup now and then in case Safari clears it.</p>
        <div class="row">
          <button class="secondary" data-action="export">Save backup file</button>
          <label class="pill" style="cursor:pointer">Restore from file<input type="file" accept="application/json,.json" data-action-change="import" hidden></label>
          ${kid ? `<button class="ghost" data-action="delete-kid" data-id="${kid.id}">Remove ${esc(kid.name)}</button>` : ''}
        </div>
      </div>
      <p class="small muted" style="text-align:center">Version ${APP_VERSION}</p>`;
  },
};

function playTop() {
  const g = ui.game;
  const p = profile();
  const b = g.battle;
  return `<div class="topbar">
      <button class="secondary" data-action="end-round">Done</button>
      <span class="pill">Word ${Math.min(b.asked + (g.phase === 'ask' ? 1 : 0), ROUND_LENGTH)} of ${ROUND_LENGTH}</span>
      <span class="pill">🟡 ${p.coins}</span>
    </div>
    ${arenaHtml('spelling', { hero: heroHtml(p), combo: b.combo, zap: g.zap, anim: g.anim, target: g.shownMonster, hp: g.shownHp, from: g.from })}`;
}

function playPrompt() {
  const g = ui.game;
  const word = g.word;
  const asking = g.phase === 'ask';
  return `<div class="row" style="justify-content:center">
      <button type="button" data-action="hear">🔊 Hear word</button>
      ${word.sentence ? '<button type="button" class="secondary" data-action="hear-sentence">💬 Sentence</button>' : ''}
      ${asking && g.battle.hintsLeft > 0 && !g.usedHint ? `<button type="button" class="secondary" data-action="hint">💡 Hint (${g.battle.hintsLeft})</button>` : ''}
    </div>
    ${!speechAvailable() && asking ? `<p class="hint">${esc(word.word)}</p>` : ''}
    ${g.usedHint && asking ? `<div class="hint">${esc(hintText(word.word))}</div>` : ''}
    ${
      g.phase === 'copy'
        ? `<p style="text-align:center;margin-bottom:0">It's spelled:</p><div class="correct-word">${esc(word.word)}</div>
           ${g.typed ? `<p class="your-try">You wrote <s>${esc(g.typed)}</s></p>` : ''}
           <p class="muted" style="text-align:center">Type it once to lock it in.</p>`
        : ''
    }`;
}

/** Update the play screen in place so the input (and the iPad keyboard) stays put. */
function patchPlay({ clearInput = false } = {}) {
  const g = ui.game;
  document.getElementById('play-top').innerHTML = playTop();
  document.getElementById('play-prompt').innerHTML = playPrompt();
  const fb = document.getElementById('play-feedback');
  fb.textContent = g.feedback || '';
  fb.className = `feedback ${g.feedbackClass || ''}`;
  document.getElementById('play-submit').textContent = g.phase === 'copy' ? 'Got it' : '⛏️ Dig!';
  const input = document.getElementById('answer');
  input.readOnly = g.phase === 'wait';
  if (clearInput) input.value = '';
}

function aiVoiceHtml() {
  const key = getKey();
  const ai = data.settings.ai;
  if (!key) {
    return `<h3 style="margin-top:20px">Natural AI voice (ElevenLabs)</h3>
      <p class="small muted">For a much more natural voice, the game can get recordings from ElevenLabs and save them on this iPad.
        Only the words and example sentences are sent, never names or progress. The free plan covers about 10 words a week easily.</p>
      <ol class="small">
        <li>Make a free account at <strong>elevenlabs.io</strong>.</li>
        <li>Open your profile → <strong>API Keys</strong> → create a key (it needs Text to Speech and Voices read access).</li>
        <li>Paste it here. It stays on this iPad and isn't included in backups.</li>
      </ol>
      <form data-form="ai-key" class="row">
        <input type="password" name="key" placeholder="ElevenLabs API key" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;min-width:200px">
        <button type="submit">Save key</button>
      </form>`;
  }
  return `<h3 style="margin-top:20px">Natural AI voice (ElevenLabs)</h3>
    <label class="row"><input type="checkbox" data-action-change="ai-enabled" ${ai.enabled ? 'checked' : ''} style="width:24px;height:24px"> Use the AI voice</label>
    <div class="row" style="margin-top:8px">
      <select id="ai-voice" data-action-change="ai-voice" aria-label="AI voice">
        <option value="${esc(ai.voiceId || '')}">${esc(ai.voiceName || 'Loading voices…')}</option>
      </select>
      <button class="secondary" data-action="ai-test">🔊 Test</button>
      <button class="secondary" data-action="ai-prepare">Get audio now</button>
    </div>
    <p class="small" id="ai-status" aria-live="polite">Checking saved audio…</p>
    <p class="small muted">Audio is fetched automatically when you add words and saved on this iPad, so the game works offline.
      Words without saved audio use the built-in voice. <button class="ghost" data-action="ai-remove-key">Remove key</button></p>`;
}

let aiVoicesCache = null;
let aiVoicesLimited = false;

/** Fill the AI voice list and status on the grown-ups screen without re-rendering it. */
async function refreshAiPanel() {
  const key = getKey();
  const select = document.getElementById('ai-voice');
  if (!key || !select) return;
  try {
    if (!aiVoicesCache) {
      const r = await listVoicesOrDefaults(key);
      aiVoicesCache = r.voices;
      aiVoicesLimited = r.limited;
    }
    const ai = data.settings.ai;
    if (!ai.voiceId && aiVoicesCache.length) {
      ai.voiceId = aiVoicesCache[0].id;
      ai.voiceName = aiVoicesCache[0].name;
      save(data);
      applySpeech();
    }
    const el = document.getElementById('ai-voice');
    if (el)
      el.innerHTML = aiVoicesCache
        .map((v) => `<option value="${esc(v.id)}" ${v.id === ai.voiceId ? 'selected' : ''}>${esc(v.name)}${v.accent ? ` · ${esc(v.accent)}` : ''}${v.description ? ` · ${esc(v.description)}` : ''}</option>`)
        .join('');
  } catch (err) {
    setAiStatus(err.message);
    return;
  }
  await refreshAiStatus();
  prepareAllClips();
}

function limitedNote() {
  return aiVoicesLimited ? " This key can't list your voices, so ElevenLabs' standard voices are shown. That's fine." : '';
}

function setAiStatus(text) {
  const el = document.getElementById('ai-status');
  if (el) el.textContent = text;
}

async function refreshAiStatus() {
  const ai = data.settings.ai;
  if (!ai.voiceId) return;
  const specs = allClipSpecs();
  const ready = await countReady(ai.voiceId, specs);
  setAiStatus(
    `${ai.enabled ? 'On' : 'Off'} · ${ready} of ${specs.length} words and sentences have audio saved on this iPad. ` +
      `All of them together are ${charCount(specs).toLocaleString()} characters of ElevenLabs credit, and each is only fetched once.` +
      limitedNote(),
  );
}

/** Play a word the way the kids will hear it, fetching its AI audio first if needed. */
async function previewWord(w) {
  unlockAudio();
  const ai = data.settings.ai;
  const key = getKey();
  const status = (t) => app.querySelectorAll('.preview-status').forEach((el) => (el.textContent = t));
  if (ai.enabled && ai.voiceId && key) {
    const specs = clipsForWord(w);
    status('Getting audio…');
    const res = await prepareClips(key, ai.voiceId, specs);
    status(res.error || '');
    await preloadSpeech(specs);
  }
  return w.sentence ? saySentence(w.word, w.sentence) : sayWord(w.word);
}

const ENTRY_ROWS = 10;

/** One word with an optional sentence, plus a 🔊 and live tips. */
function entryRowHtml(i) {
  return `<div class="entry" data-row="${i}">
      <input type="text" name="word" placeholder="Word ${i + 1}" aria-label="Word ${i + 1}" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" enterkeyhint="next" data-live="entry">
      <input type="text" name="sentence" placeholder="Sentence (optional)" aria-label="Sentence for word ${i + 1} (optional)" autocapitalize="sentences" autocomplete="off" enterkeyhint="next" data-live="entry">
      <button type="button" class="ghost" data-action="preview-entry" data-i="${i}" aria-label="Hear word ${i + 1}">🔊</button>
      <div class="entry-tips"></div>
    </div>`;
}

function rowEntry(row) {
  return { word: row.querySelector('[name=word]').value, sentence: row.querySelector('[name=sentence]').value };
}

function typedEntries() {
  return cleanEntries([...app.querySelectorAll('#entry-rows .entry')].map(rowEntry));
}

app.addEventListener('input', (e) => {
  if (e.target.dataset?.live !== 'entry') return;
  const row = e.target.closest('.entry');
  const entry = rowEntry(row);
  const tips = entry.word.trim() ? entryWarnings(entry) : [];
  row.querySelector('.entry-tips').innerHTML = tips.map((t) => `<div class="warn">⚠️ ${esc(t)}</div>`).join('');
});

// Return in a word box moves on instead of sending the form half-filled.
app.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.dataset?.live !== 'entry') return;
  e.preventDefault();
  const inputs = [...app.querySelectorAll('#entry-rows input')];
  inputs[inputs.indexOf(e.target) + 1]?.focus();
});

let preparing = false;
/** Fetch audio for every word and sentence that doesn't have it yet. */
async function prepareAllClips() {
  const ai = data.settings.ai;
  const key = getKey();
  if (preparing || !ai.enabled || !ai.voiceId || !key) return;
  preparing = true;
  try {
    await pruneClips(allClipSpecs()).catch(() => {});
    const res = await prepareClips(key, ai.voiceId, allClipSpecs(), (done, total) => setAiStatus(`Getting audio… ${done} of ${total}`));
    if (res.error) setAiStatus(res.error);
    else refreshAiStatus();
  } finally {
    preparing = false;
  }
}

function parentButton() {
  return `<button class="ghost hold" data-hold="parent"><span class="fill"></span>👪 Grown-ups (press and hold)</button>`;
}

// ---------- game flow ----------
async function startRound() {
  const p = profile();
  if (!p.words.length) return go('hub');
  await preloadSpeech(clipSpecs([p]));
  const powers = teamPowersFor(p, 'spelling');
  ui.game = {
    powers,
    friendsBefore: p,
    friendEvents: [],
    battle: newBattle(powers, randomStart('spelling'), targetsFor('spelling')),
    phase: 'ask',
    recent: [],
    missed: new Set(),
    mastered: [],
    reviewUsed: 0,
    earned: { coins: 0, xp: 0, sun: 0 },
    startLevel: levelForXp(p.xp),
  };
  nextWord();
}

function nextWord() {
  const g = ui.game;
  if (roundOver(g.battle)) return finishRound();
  const p = profile();
  const pick = pickPracticeWord(p, Date.now(), Math.random, g.recent, g.reviewUsed);
  if (!pick) return finishRound();
  const { item, review } = pick;
  if (review) g.reviewUsed++;
  g.word = p.words.find((w) => w.id === item.id);
  g.recent = [item.id, ...g.recent].slice(0, Math.min(3, Math.max(0, currentWords(p).length - 1)));
  Object.assign(g, { phase: 'ask', usedHint: false, typed: '', feedback: review ? '⭐ Review word' : '', feedbackClass: '', zap: '', anim: '', from: null });
  g.shownMonster = g.battle.monster;
  g.shownHp = g.battle.hp;
  ui.screen = 'play';
  render({ clearInput: true });
  sayWord(g.word.word);
}

// Move on after a short pause, unless the kid left the round meanwhile.
function advanceLater(ms) {
  const g = ui.game;
  setTimeout(() => {
    if (ui.game === g && ui.screen === 'play') nextWord();
  }, ms);
}

function finishRound() {
  const g = ui.game;
  g.levelUp = levelForXp(profile().xp) > g.startLevel;
  go('summary');
}

function submitAnswer(value) {
  const g = ui.game;
  if (g.phase === 'wait' || !value.trim()) return;
  if (g.phase === 'copy') {
    Object.assign(g, { anim: '', from: null });
    if (checkSpelling(value, g.word.word)) {
      g.phase = 'wait';
      g.feedback = 'Locked in! 🔒';
      g.feedbackClass = 'good';
      render();
      advanceLater(700);
    } else {
      g.feedback = 'Not quite. Copy it letter by letter.';
      g.feedbackClass = 'bad';
      render({ clearInput: true });
      sayWord(g.word.word);
    }
    return;
  }

  const correct = checkSpelling(value, g.word.word);
  const result = correct ? (g.usedHint ? 'assisted' : 'correct') : 'wrong';
  const now = Date.now();
  const rec = recordAnswer(profile(), g.word.id, result, now, g.powers);
  const grown = friendsAfterAnswer(rec.profile, 'spelling', result, now);
  let p = grown.profile;
  g.friendEvents.push(...grown.events);
  g.earned.coins += rec.coins;
  g.earned.sun += rec.sun || 0;
  g.earned.xp += rec.xp;

  const { battle, events } = applyAnswer(g.battle, result, g.powers);
  const defeated = events.find((e) => e.type === 'defeated');
  // Show the finished target (gem found) until the next word brings a new rock.
  g.from = (g.shownMonster.hp - g.shownHp) / g.shownMonster.hp;
  g.anim = animFor(events);
  g.shownMonster = defeated ? g.battle.monster : battle.monster;
  g.shownHp = defeated ? 0 : battle.hp;
  g.battle = battle;
  if (defeated) {
    const bonus = applyXpBoost(XP_PER.monster, g.powers);
    p = { ...p, xp: p.xp + bonus };
    g.earned.xp += bonus;
  }
  update(p);

  if (correct) {
    const hit = events.find((e) => e.type === 'hit');
    g.phase = 'wait';
    g.zap = zapText('spelling', hit.damage);
    g.feedback = defeated ? clearedText('spelling', defeated.monster) : ['Nice!', 'Yes!', 'Great spelling!', 'Clink!'][Math.floor(Math.random() * 4)];
    if (rec.starWaits && !defeated) g.feedback += ' Next ⭐ for this word tomorrow.';
    if (rec.shards && !defeated) g.feedback = `✨ Polished back to shiny! +${rec.shards} 💎`;
    if (rec.mastered) {
      g.mastered.push(g.word.id);
      g.earned.coins += MASTERY_COINS;
      g.feedback = `🌟 You mastered “${g.word.word}”! +${MASTERY_COINS} 🟡`;
    }
    g.feedbackClass = 'good';
    render();
    if (rec.coins) floatText(`+${rec.coins} 🟡`);
    advanceLater(rec.mastered ? 2200 : defeated ? 1300 : 900);
  } else {
    g.missed.add(g.word.id);
    g.phase = 'copy';
    g.typed = value.trim();
    g.zap = '';
    g.feedback = missText('spelling', events);
    g.feedbackClass = 'bad';
    render({ clearInput: true });
    sayWord(g.word.word);
  }
}

// ---------- tricky words ----------
function trickyHubHtml(p) {
  const set = currentTrickySet(p);
  if (!set) return '';
  return `<div class="card small"><strong>🔤 Tricky words: ${esc(set.name)}</strong><br>${esc(set.tip)}
    ${readyForMore(p) ? `<div style="margin-top:8px"><button class="secondary" data-action="tricky-more">Ready for 10 more tricky words</button></div>` : ''}</div>`;
}

function trickyParentHtml(kid) {
  const st = trickyState(kid);
  const left = setsLeft(kid);
  const set = currentTrickySet(kid);
  const nextSet = TRICKY_SETS[st.next];
  const daysToNext = st.lastAt == null ? 0 : Math.max(0, Math.ceil((st.lastAt + WEEK_MS - Date.now()) / 864e5));
  return `<div class="card">
    <h3>Tricky words list (grades 5–6)</h3>
    <p class="small muted">For a kid who doesn't get spelling words from school: ${TRICKY_SETS.length} sets of 10 commonly misspelled and tricky words, each with a sentence and a spelling tip.
      Each week the next set becomes ${esc(kid.name)}'s words for the week. They get stars, mastery and Super Packs like any other words, and older sets come back for review.
      If ${esc(kid.name)} gets every word of the week to ${READY_STARS}+ stars early, a button lets them take the next set right away.</p>
    <label class="row"><input type="checkbox" data-action-change="tricky" ${st.on ? 'checked' : ''}> Use the tricky words list for ${esc(kid.name)}</label>
    ${
      st.next
        ? `<p class="small">Set ${st.next} of ${TRICKY_SETS.length}${set ? ` (this week): <strong>${esc(set.name)}</strong>` : ''}.
            ${!left ? 'All sets added.' : st.on ? `Next set${nextSet ? ` (${esc(nextSet.name)})` : ''} ${daysToNext ? `in ${daysToNext} day${daysToNext === 1 ? '' : 's'}` : 'next time they open the game'}.` : 'Paused.'}</p>`
        : ''
    }
    ${st.on && nextSet ? `<p class="small muted">Coming up: ${trickySetEntries(st.next).map((e) => esc(e.word)).join(', ')}</p>
      <button class="secondary" data-action="tricky-next">Add the next set now</button>` : ''}
  </div>`;
}

// ---------- events ----------
const actions = {
  grant: (d) => {
    const kid = data.profiles[ui.parentKid];
    if (!kid) return;
    const y = window.scrollY;
    update(grant(kid, d.id, d.n === 'reset' ? 0 : Number(d.n)));
    floatText(d.n === 'reset' ? `${grantName(d.id)} reset for ${kid.name}` : `${grantName(d.id)} +${d.n} for ${kid.name}`);
    render();
    window.scrollTo(0, y);
  },
  go: (d) => go(d.to),
  'pick-kid': (d) => {
    data.activeId = d.id;
    save(data);
    applyLook(profile());
    ui.hubNote = '';
    checkTricky();
    go('hub');
  },
  'tricky-more': () => {
    const r = addTrickySet(profile(), Date.now());
    if (!r) return;
    update(r.profile);
    ui.hubNote = `🔤 New tricky words: ${r.set.name}!`;
    setTimeout(prepareAllClips, 0);
    render();
  },
  'tricky-next': () => {
    const kid = data.profiles[ui.parentKid];
    const r = kid && addTrickySet(kid, Date.now());
    if (!r) return;
    update(r.profile);
    ui.flash = `${kid.name}'s words this week: tricky set ${trickyState(r.profile).next}, ${r.set.name}.`;
    setTimeout(prepareAllClips, 0);
    render();
    window.scrollTo(0, 0);
  },
  play: () => {
    ui.hubNote = '';
    unlockAudio();
    startRound();
  },
  'end-round': () => (ui.game.battle.asked ? finishRound() : go('hub')),
  hear: () => {
    unlockAudio();
    sayWord(ui.game.word.word);
  },
  'hear-sentence': () => {
    unlockAudio();
    saySentence(ui.game.word.word, ui.game.word.sentence);
  },
  hint: () => {
    const g = ui.game;
    g.battle = { ...g.battle, hintsLeft: g.battle.hintsLeft - 1 };
    g.usedHint = true;
    render();
  },
  'open-super': () => {
    const themeId = themesOpen().some((t) => t.id === ui.packTheme) ? ui.packTheme : themesOpen()[0].id;
    const { profile: p1, result } = openSuperPack(profile(), themeId);
    const { profile: p2, newly } = claimSetRewards(p1);
    update(p2);
    ui.reveal = result;
    render();
    window.scrollTo(0, 0);
    if (newly.length) floatText(`🏅 ${newly[0].reward}! +${XP_PER.setComplete} XP`);
  },
  'remove-word': (d) => {
    const kid = data.profiles[ui.parentKid];
    const w = kid?.words.find((x) => x.id === d.id);
    if (!w || !confirm(`Delete “${w.word}” completely? Its stars and history are erased. Nuggets and cards already earned stay.`)) return;
    update(removeWord(kid, d.id));
    render();
    pruneClips(allClipSpecs()).then(() => refreshAiStatus()).catch(() => {});
  },
  'hear-bank': (d) => {
    const w = data.profiles[ui.parentKid]?.words.find((x) => x.id === d.id);
    if (w) previewWord(w);
  },
  'preview-entry': (d) => {
    const row = app.querySelector(`#entry-rows [data-row="${Number(d.i)}"]`);
    const e = row && cleanEntries([rowEntry(row)])[0];
    if (e) previewWord(e);
  },
  'more-rows': () => {
    const rows = document.getElementById('entry-rows');
    const n = rows.children.length;
    rows.insertAdjacentHTML('beforeend', Array.from({ length: 5 }, (_, i) => entryRowHtml(n + i)).join(''));
    rows.children[n].querySelector('input').focus();
  },
  'test-voice': () => sayBuiltIn('because', 'I stayed inside because it rained.'),
  'ai-test': async () => {
    unlockAudio();
    const ai = data.settings.ai;
    if (!ai.voiceId) return;
    setAiStatus('Getting a sample…');
    try {
      const blob = await generateClip(getKey(), ai.voiceId, sentenceClip('because', 'I stayed inside because it rained.'));
      const a = new Audio(URL.createObjectURL(blob));
      await a.play();
      refreshAiStatus();
    } catch (err) {
      setAiStatus(err.message);
    }
  },
  'ai-prepare': () => {
    if (!data.settings.ai.enabled) {
      data.settings.ai.enabled = true;
      save(data);
      applySpeech();
      const box = app.querySelector('[data-action-change="ai-enabled"]');
      if (box) box.checked = true;
    }
    prepareAllClips();
  },
  'ai-remove-key': async () => {
    if (!confirm('Remove the ElevenLabs key and the saved AI audio from this iPad?')) return;
    setKey('');
    aiVoicesCache = null;
    data.settings.ai = { enabled: false, voiceId: null, voiceName: null };
    save(data);
    applySpeech();
    await clearClips();
    render();
  },
  'pack-theme': (d) => {
    ui.packTheme = d.id;
    ui.reveal = null;
    render();
  },
  'open-pack': () => {
    const themeId = themesOpen().some((t) => t.id === ui.packTheme) ? ui.packTheme : themesOpen()[0].id;
    const { profile: p1, result } = openPack(profile(), themeId, Date.now());
    const { profile: p2, newly } = claimSetRewards(p1);
    update(p2);
    ui.reveal = result;
    render();
    if (newly.length) floatText(`🏅 ${newly[0].reward}! +${XP_PER.setComplete} XP`);
  },
  wish: (d) => {
    const attr = WISH_ATTRS.find((a) => `${a.kind}:${a.value}` === ui.wishAttr) || WISH_ATTRS[0];
    try {
      const { profile: p1, result } = makeWish(profile(), attr, d.pay, Date.now(), Math.random, d.rarity || null);
      const { profile: p2, newly } = claimSetRewards(p1);
      update(p2);
      ui.reveal = result;
      render();
      window.scrollTo(0, 0);
      if (newly.length) floatText(`🏅 ${newly[0].reward}! +${XP_PER.setComplete} XP`);
    } catch {
      render();
    }
  },
  craft: (d) => {
    const item = ITEMS_BY_ID[d.id];
    if (!confirm(`Use ${CRAFT_COST[item.rarity]} gem dust at the Gem Cutter to make ${item.name}?`)) return;
    const { profile: p, newly } = claimSetRewards(craft(profile(), d.id));
    update(p);
    render();
    floatText(newly.length ? `🏅 ${newly[0].reward}!` : `${item.emoji} ${item.name} joined you!`);
  },
  'toggle-team': (d) => {
    const p = profile();
    let team = p.team.includes(d.id) ? p.team.filter((id) => id !== d.id) : [...p.team, d.id];
    if (team.length > TEAM_SIZE) team = team.slice(team.length - TEAM_SIZE);
    update({ ...p, team });
    render();
  },
  look: (d) => {
    const p = profile();
    update({ ...p, look: { ...p.look, [d.kind]: d.id || null } });
    applyLook(profile());
    render();
  },
  title: (d) => {
    const p = profile();
    update({ ...p, look: { ...p.look, title: d.id || null } });
    render();
  },
  'parent-kid': (d) => {
    ui.parentKid = d.id;
    ui.flash = '';
    render();
  },
  export: () => exportBackup(data),
  'delete-kid': (d) => {
    const k = data.profiles[d.id];
    if (!k || !confirm(`Remove ${k.name} and all their progress from this iPad?`)) return;
    delete data.profiles[d.id];
    data.order = data.order.filter((id) => id !== d.id);
    if (data.activeId === d.id) data.activeId = null;
    ui.parentKid = null;
    save(data);
    render();
  },
};

// Word Match (vocabulary) lives in its own module and plugs in here.
const vocab = createVocab({
  app, ui, esc, profile, update, go, render, floatText, heroHtml, starsHtml, superProgressHtml,
  itemEmoji: (id) => ITEMS_BY_ID[id]?.emoji,
  parentKid: () => data.profiles[ui.parentKid],
});
Object.assign(screens, vocab.screens);
Object.assign(actions, vocab.actions);
// Times tables game: its own screens and actions (src/mathgame.js).
const math = initMath({ ui, profile, update, go, render, esc, heroHtml, topbar, floatText, superProgressHtml, data: () => data });
Object.assign(screens, math.screens);
Object.assign(actions, math.actions);
// Friend Grove farm side game (src/farmui.js).
const farm = initFarm({ app, ui, profile, update, go, render, esc, floatText, data: () => data });
Object.assign(screens, farm.screens);
Object.assign(actions, farm.actions);

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el.dataset, el);
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const kind = form.dataset.form;
  if (kind === 'answer') {
    submitAnswer(form.querySelector('input').value);
  } else if (kind === 'add-kid') {
    const name = form.name.value.trim();
    if (!name) return;
    const p = newProfile(name, Date.now());
    data.profiles[p.id] = p;
    data.order.push(p.id);
    ui.parentKid = p.id;
    ui.flash = `Added ${p.name}. Now paste their words below.`;
    save(data);
    render();
  } else if (kind === 'ai-key') {
    const key = form.key.value.trim();
    if (!key) return;
    setKey(key);
    data.settings.ai.enabled = true;
    save(data);
    aiVoicesCache = null;
    aiVoicesLimited = false;
    ui.flash = 'ElevenLabs key saved on this iPad. Pick a voice and tap Test.';
    render();
    applySpeech();
    prepareAllClips();
  } else if (kind === 'words') {
    const kid = data.profiles[ui.parentKid];
    const entries = typedEntries();
    if (!entries.length) return;
    const r = addWords(kid, entries, Date.now());
    update(r.profile);
    ui.flash = `${kid.name}'s words this week: ${entries.length} (${r.added} new${r.returning ? `, ${r.returning} from before` : ''}).`;
    setTimeout(prepareAllClips, 0);
    render();
    window.scrollTo(0, 0);
  }
});

app.addEventListener('change', async (e) => {
  const kind = e.target.dataset.actionChange;
  if (farm.onChange(kind, e, () => data.profiles[ui.parentKid])) return;
  if (kind === 'wish-attr') {
    ui.wishAttr = e.target.value;
    render();
    return;
  }
  if (kind === 'voice' || kind === 'rate') {
    if (kind === 'voice') data.settings.voiceURI = e.target.value || null;
    else data.settings.rate = Number(e.target.value);
    save(data);
    applySpeech();
    sayBuiltIn('because');
    return;
  }
  if (kind === 'ai-voice') {
    const opt = e.target.selectedOptions[0];
    data.settings.ai.voiceId = e.target.value || null;
    data.settings.ai.voiceName = opt ? opt.textContent : null;
    save(data);
    applySpeech();
    refreshAiStatus();
    prepareAllClips();
    return;
  }
  if (kind === 'ai-enabled') {
    data.settings.ai.enabled = e.target.checked;
    save(data);
    applySpeech();
    refreshAiStatus();
    if (e.target.checked) prepareAllClips();
    return;
  }
  if (kind === 'tricky') {
    const kid = data.profiles[ui.parentKid];
    if (!kid) return;
    const before = trickyState(kid).next;
    const next = setTricky(kid, e.target.checked, Date.now());
    update(next);
    ui.flash = !e.target.checked ? `Tricky words paused for ${kid.name}. Their words and stars stay.`
      : before === 0 ? `Tricky words are on for ${kid.name}. This week's set: ${TRICKY_SETS[0].name}.` : `Tricky words are back on for ${kid.name}.`;
    if (!before && e.target.checked) setTimeout(prepareAllClips, 0);
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (kind !== 'import') return;
  const file = e.target.files[0];
  if (!file) return;
  try {
    const restored = parseBackup(await file.text());
    if (!confirm('Replace everything on this iPad with the backup?')) return;
    data = restored;
    for (const id of Object.keys(data.profiles)) data.profiles[id] = migrateProfile(data.profiles[id]);
    data.settings = { voiceURI: null, rate: 0.85, ...(data.settings || {}) };
    data.settings.ai = { enabled: false, voiceId: null, voiceName: null, ...(data.settings.ai || {}) };
    applySpeech();
    save(data);
    ui.flash = 'Backup restored.';
  } catch (err) {
    ui.flash = `Couldn't read that file: ${err.message}`;
  }
  render();
});

// Press-and-hold to open the grown-ups screen (keeps little fingers out).
let holdTimer = null;
app.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-hold]');
  if (!el) return;
  el.classList.add('holding');
  holdTimer = setTimeout(() => {
    el.classList.remove('holding');
    go('parent');
  }, 1500);
});
const cancelHold = () => {
  clearTimeout(holdTimer);
  app.querySelectorAll('.holding').forEach((el) => el.classList.remove('holding'));
};
['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => app.addEventListener(t, cancelHold));

// ---------- render ----------
function render(opts = {}) {
  if (['hub', 'play', 'summary', 'packs', 'book', 'locker', 'words', 'math', 'math-play', 'math-summary', 'math-facts', 'math-trial', 'math-trial-done', 'farm', ...VOCAB_SCREENS].includes(ui.screen) && !profile()) ui.screen = 'home';
  if (ui.screen === 'play' && app.dataset.screen === 'play') {
    patchPlay(opts);
  } else {
    app.innerHTML = screens[ui.screen]();
    app.dataset.screen = ui.screen;
  }
  if (ui.screen === 'play') document.getElementById('answer')?.focus();
  if (ui.screen === 'parent') refreshAiPanel();
}

applyLook(profile());
ui.screen = profile() ? 'hub' : 'home';
checkTricky();
render();
requestPersistence();
// A new version was installed: reload now, or after the round if one is in progress.
window.__klgUpdate = () => (ui.screen === 'play' || math.isPlaying() ? (ui.pendingReload = true) : location.reload());
// Voices load late on some browsers; refresh the grown-ups screen when they arrive.
onVoicesChanged(() => ui.screen === 'parent' && render());
