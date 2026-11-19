// UI for Spelling Quest. Plain DOM, no framework or build step.
import { THEMES, ITEMS_BY_ID, POWER_INFO, RARITY_STRENGTH, COSMETICS, MONSTERS } from './content.js';
import { masterySummary, masteryRating, MAX_BOX } from './srs.js';
import {
  BOX_COINS, COMEBACK_BONUS, PACK_COST, DAILY_PACK_CAP, ODDS, CRAFT_COST, SHARDS_FOR_DUPLICATE,
  RARE_PITY, EPIC_PITY, canOpenPack, openPack, craft, packsLeftToday, pityStatus, themeProgress,
  MASTERY_COINS, SUPER_PACK_EVERY, openSuperPack,
} from './economy.js';
import {
  XP_PER, TEAM_SIZE, teamPowers, levelProgress, levelForXp, unlockedCosmetics, applyXpBoost,
  claimSetRewards, earnedTitles,
} from './progress.js';
import { newBattle, applyAnswer, roundOver, hintText, ROUND_LENGTH } from './battle.js';
import {
  newProfile, parseWordList, addWords, removeWord, migrateProfile, currentWords, activeItems, recordAnswer, checkSpelling,
  pickPracticeWord,
} from './profile.js';
import { load, save, requestPersistence, exportBackup, parseBackup } from './storage.js';
import { say, speechAvailable, setSpeechPrefs, englishVoices, currentVoice, onVoicesChanged } from './speech.js';
import { voiceQuality } from './voices.js';

// Shown on the grown-ups screen so you can tell an update has arrived.
const APP_VERSION = '2026-11-19.4';
const app = document.getElementById('app');
let data = load();
for (const id of Object.keys(data.profiles)) data.profiles[id] = migrateProfile(data.profiles[id]);
data.settings = { voiceURI: null, rate: 0.85, ...(data.settings || {}) };
setSpeechPrefs(data.settings);
const ui = { screen: 'home', game: null, reveal: null, packTheme: null, parentKid: null, flash: '' };

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
    <div class="row"><span class="pill">🪙 ${p.coins}</span><span class="pill">💎 ${p.shards}</span></div>
  </div>`;
}

function collectibleCard(item, { owned = true, extra = '', cls = '' } = {}) {
  const strength = RARITY_STRENGTH[item.rarity];
  return `<div class="collectible ${owned ? '' : 'missing'} ${cls}">
    <div class="art">${item.emoji}</div>
    <div><strong>${owned ? esc(item.name) : '???'}</strong></div>
    <div class="rarity ${item.rarity}">${item.rarity}</div>
    ${owned ? `<div class="small muted">${POWER_INFO[item.power].label}: ${POWER_INFO[item.power].describe(strength)}</div>` : ''}
    ${extra}
  </div>`;
}

function starsHtml(item) {
  const { stars, label } = masteryRating(item);
  return `<span class="stars" title="${label}">${'★'.repeat(stars)}<span class="off">${'★'.repeat(MAX_BOX - stars)}</span></span>`;
}

function superProgressHtml(p) {
  const n = p.superProgress || 0;
  return `<div class="super-progress"><span>🌟 Super Pack</span>
    <span class="dots">${'●'.repeat(n)}<span class="off">${'●'.repeat(SUPER_PACK_EVERY - n)}</span></span>
    <span class="small muted">Master ${SUPER_PACK_EVERY - n} more word${SUPER_PACK_EVERY - n === 1 ? '' : 's'}</span>
    ${p.superPacks ? `<button class="super" data-action="go" data-to="packs">Open ${p.superPacks} Super Pack${p.superPacks > 1 ? 's' : ''}!</button>` : ''}</div>`;
}

function floatText(text) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
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
        <div class="row"><span class="pill">🪙 ${p.coins}</span><span class="pill">💎 ${p.shards}</span></div>
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
      ${
        p.words.length
          ? `<p class="muted">This week: ${week.length} words · ${weekSum.mastered} mastered · ${p.masteredWords || 0} mastered all time</p>`
          : `<p class="muted">No words yet. Ask a grown-up to add this week's list.</p>`
      }
      <button class="big" style="width:100%;margin-bottom:16px" data-action="play" ${p.words.length ? '' : 'disabled'}>⚔️ Play</button>
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
          <button class="big" id="play-submit" style="width:100%" type="submit">⚡ Zap!</button>
        </form>
      </div>
      <p class="small muted" style="text-align:center">Team: ${
        profile().team.length
          ? profile().team.map((id) => ITEMS_BY_ID[id]?.emoji).join(' ')
          : 'none yet. Add friends from your collection for powers!'
      }</p>`;
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
          <span>🪙 +${g.earned.coins}</span><span>⭐ +${g.earned.xp} XP</span><span>👾 ${g.battle.defeated} defeated</span>
        </div>
        ${
          mastered.length
            ? `<p style="font-size:1.3rem">🌟 <strong>You mastered ${mastered.map((w) => `“${esc(w)}”`).join(', ')}!</strong> +${MASTERY_COINS * mastered.length} 🪙</p>`
            : ''
        }
        ${superProgressHtml(p)}
        ${g.levelUp ? `<p style="font-size:1.3rem"><strong>Level up! You're level ${levelForXp(p.xp)}.</strong> Check the Locker for new stuff.</p>` : ''}
      </div>
      ${
        missed.length
          ? `<div class="card"><h3>Words to keep practicing</h3><p style="font-size:1.4rem">${missed.map(esc).join(' · ')}</p>
             <p class="small muted">These will come back more often, and pay extra coins when you get them right.</p></div>`
          : ''
      }
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
    const theme = THEMES.find((t) => t.id === ui.packTheme) || THEMES[0];
    const pity = pityStatus(p.packs);
    const r = ui.reveal;
    return `${topbar('Packs')}
      ${
        r && !r.item
          ? `<div class="reveal"><div class="flip collectible"><div class="art">💎</div><p><strong>You have every friend!</strong><br>+${r.shards} shards</p></div></div>`
          : r
          ? `<div class="reveal"><div class="flip">${collectibleCard(r.item, {
              cls: r.super ? 'ultra-glow' : '',
              extra: r.duplicate
                ? `<p><strong>You already have this one!</strong><br>+${r.shards} 💎 shards</p>`
                : '<p><strong>New friend!</strong></p>',
            })}</div></div>`
          : ''
      }
      ${
        p.superPacks
          ? `<div class="card super-card"><h3>🌟 You have ${p.superPacks} Super Pack${p.superPacks > 1 ? 's' : ''}!</h3>
             <p>You earned ${p.superPacks > 1 ? 'these' : 'this'} by mastering words. A Super Pack always has an <strong class="rarity ultra">ultra</strong> friend from the theme you pick, and doesn't count toward today's packs.</p>
             <button class="big super" data-action="open-super">Open ${theme.emoji} Super Pack</button></div>`
          : `<div class="card">${superProgressHtml(p)}<p class="small muted">Ultra friends only come from Super Packs. Master ${SUPER_PACK_EVERY} words to earn one.</p></div>`
      }
      <div class="card">
        <h3>Pick a theme</h3>
        <div class="grid">
          ${THEMES.map((t) => {
            const tp = themeProgress(t, p.collection);
            return `<button class="theme-pick ${t.id === theme.id ? 'selected' : ''}" data-action="pack-theme" data-id="${t.id}">
              <span class="icon">${t.emoji}</span>${t.name}<div class="small muted">${tp.owned}/${tp.total}${tp.complete ? ' ✓' : ''}</div></button>`;
          }).join('')}
        </div>
        <div class="row" style="margin-top:16px">
          <button class="big" data-action="open-pack" ${check.ok ? '' : 'disabled'}>Open ${theme.emoji} pack · 🪙 ${PACK_COST}</button>
          <span class="muted">${left} of ${DAILY_PACK_CAP} packs left today</span>
        </div>
        ${check.reason === 'coins' ? `<p class="muted">You need ${PACK_COST - p.coins} more coins. Spell words to earn them!</p>` : ''}
        ${check.reason === 'cap' ? '<p class="muted">That\'s all the packs for today. More tomorrow!</p>' : ''}
        ${themeProgress(theme, p.collection).complete ? '<p class="muted">You have every friend in this theme, so packs here give shards.</p>' : ''}
      </div>
      <div class="card small">
        <h3>What's in a pack</h3>
        <p>Each pack has one friend from the theme you pick. Friends you don't have yet always come first.</p>
        <table>
          <tr><th>Rarity</th><th>Chance</th><th>Shards if you already have it</th></tr>
          ${Object.entries(ODDS)
            .map(([k, v]) => `<tr><td class="rarity ${k}">${k}</td><td>${Math.round(v * 100)}%</td><td>${SHARDS_FOR_DUPLICATE[k]} 💎</td></tr>`)
            .join('')}
        </table>
        <p>Rare or better guaranteed within <strong>${pity.rareIn}</strong> pack${pity.rareIn === 1 ? '' : 's'}.
           Epic guaranteed within <strong>${pity.epicIn}</strong>.</p>
        <p class="muted">Shards let you pick any missing friend in your Collection, except ultras. Ultras only come from Super Packs (100% ultra), earned by mastering words.</p>
      </div>`;
  },

  book() {
    const p = profile();
    const powers = teamPowers(p.team);
    const powerLine = Object.entries(powers)
      .filter(([, n]) => n)
      .map(([k, n]) => `${POWER_INFO[k].label}: ${POWER_INFO[k].describe(n)}`)
      .join(' · ');
    return `${topbar('Collection')}
      <div class="card">
        <h3>Your team (${p.team.length}/${TEAM_SIZE})</h3>
        <p class="muted small">Friends on your team give you powers in battle. Tap a friend you own to add or remove it.</p>
        <div style="font-size:2.4rem">${p.team.map((id) => ITEMS_BY_ID[id]?.emoji).join(' ') || '—'}</div>
        ${powerLine ? `<p><strong>${powerLine}</strong></p>` : ''}
      </div>
      ${THEMES.map((t) => {
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
                  : `<button class="secondary" data-action="craft" data-id="${item.id}" ${p.shards >= cost ? '' : 'disabled'}>Make for ${cost} 💎</button>`;
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
        <p class="small muted">Each right answer adds a star, spread out over days. A miss starts the word over. Five stars means mastered!</p>
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
      </div>
      ${
        kid
          ? `<div class="card">
          <h3>Add this week's words for ${esc(kid.name)}</h3>
          <p class="small muted">One word per line. Add an example sentence after a bar if you like:<br><code>because | I stayed inside because it rained.</code><br>
            New words join ${esc(kid.name)}'s word bank and become this week's practice words. Older words keep their stars and come back now and then for review.
            Adding an old word again puts it back in this week's set.</p>
          <form data-form="words">
            <textarea name="words" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="friend | My friend lives next door.&#10;because&#10;people"></textarea>
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
                      <td><button class="ghost" data-action="remove-word" data-id="${esc(w.id)}" aria-label="Remove ${esc(w.word)}">✕</button></td></tr>`;
                  })
                  .join('')}</table>`
              : ''
          }
          <p class="small muted">Mastery is a 0–${MAX_BOX} star rating. Each correct answer adds a star, with waits that grow from minutes to a week, so a word takes about a week to master. A miss starts it over.
            Removing a word only takes it out of practice; its stars are kept if you add it again.</p>
        </div>`
          : ''
      }
      <div class="card small">
        <h3>How rewards work</h3>
        <p>Coins only come from correct answers, never from finishing a round. A word pays by how well it's known:
          ${BOX_COINS.join(', ')} coins from new to mastered, plus ${COMEBACK_BONUS} for getting a recently missed word right.
          Using a hint pays half. XP (${XP_PER.correct} per correct answer, ${XP_PER.monster} per monster) only unlocks looks in the Locker.</p>
        <p>Packs cost ${PACK_COST} coins, with at most ${DAILY_PACK_CAP} a day. Odds: ${Object.entries(ODDS)
          .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
          .join(', ')}. A rare or better is guaranteed every ${RARE_PITY} packs and an epic every ${EPIC_PITY}.
          Missing friends always come before duplicates, duplicates become shards, and shards can make any missing friend except ultras.
          Nothing in the app costs money.</p>
        <p><strong>The big rewards come from mastering words.</strong> The first time a word reaches ${MAX_BOX} stars it pays ${MASTERY_COINS} coins and ${XP_PER.mastered} XP,
          and every ${SUPER_PACK_EVERY} mastered words earn a Super Pack: a guaranteed ultra friend (not limited by the daily cap). Ultra friends can't be bought with coins or shards, so finishing the collection takes mastering words.</p>
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
      <span class="pill">🪙 ${p.coins}</span>
    </div>
    <div class="arena">
      <div>${heroHtml(p)}<div class="small muted" style="margin-top:6px">${b.combo >= 2 ? `🔥 ${b.combo} in a row` : '&nbsp;'}</div></div>
      <div class="zap">${g.zap || ''}</div>
      <div>
        <span class="monster ${g.anim || ''}">${g.shownMonster.emoji}</span>
        <div class="small"><strong>${esc(g.shownMonster.name)}</strong></div>
        <div class="hp"><div style="width:${(100 * g.shownHp) / g.shownMonster.hp}%"></div></div>
      </div>
    </div>`;
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
  document.getElementById('play-submit').textContent = g.phase === 'copy' ? 'Got it' : '⚡ Zap!';
  const input = document.getElementById('answer');
  input.readOnly = g.phase === 'wait';
  if (clearInput) input.value = '';
}

function parentButton() {
  return `<button class="ghost hold" data-hold="parent"><span class="fill"></span>👪 Grown-ups (press and hold)</button>`;
}

// ---------- game flow ----------
function startRound() {
  const p = profile();
  if (!p.words.length) return go('hub');
  const powers = teamPowers(p.team);
  ui.game = {
    powers,
    battle: newBattle(powers, Math.floor(Math.random() * MONSTERS.length)),
    phase: 'ask',
    recent: [],
    missed: new Set(),
    mastered: [],
    reviewUsed: 0,
    earned: { coins: 0, xp: 0 },
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
  Object.assign(g, { phase: 'ask', usedHint: false, feedback: review ? '⭐ Review word' : '', feedbackClass: '', zap: '', anim: '' });
  g.shownMonster = g.battle.monster;
  g.shownHp = g.battle.hp;
  ui.screen = 'play';
  render({ clearInput: true });
  say(g.word.word);
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
      say(g.word.word);
    }
    return;
  }

  const correct = checkSpelling(value, g.word.word);
  const result = correct ? (g.usedHint ? 'assisted' : 'correct') : 'wrong';
  const now = Date.now();
  const rec = recordAnswer(profile(), g.word.id, result, now, g.powers);
  let p = rec.profile;
  g.earned.coins += rec.coins;
  g.earned.xp += rec.xp;

  const { battle, events } = applyAnswer(g.battle, result, g.powers);
  const defeated = events.find((e) => e.type === 'defeated');
  // Show the beaten monster at 0 HP until the next word brings the new one.
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
    g.zap = `💥${hit.damage > 1 ? ` ×${hit.damage}` : ''}`;
    g.anim = defeated ? 'down' : 'hit';
    g.feedback = defeated ? `You beat ${defeated.monster.name}! ${defeated.monster.emoji}` : ['Nice!', 'Yes!', 'Great spelling!', 'Boom!'][Math.floor(Math.random() * 4)];
    if (rec.mastered) {
      g.mastered.push(g.word.id);
      g.earned.coins += MASTERY_COINS;
      g.feedback = `🌟 You mastered “${g.word.word}”! +${MASTERY_COINS} 🪙`;
    }
    g.feedbackClass = 'good';
    render();
    if (rec.coins) floatText(`+${rec.coins} 🪙`);
    advanceLater(rec.mastered ? 2200 : defeated ? 1300 : 900);
  } else {
    g.missed.add(g.word.id);
    g.phase = 'copy';
    g.zap = '';
    g.feedback = events.some((e) => e.type === 'shielded') ? '🛡️ Your shield stopped the monster from healing.' : 'Close! Let\'s learn this one.';
    g.feedbackClass = 'bad';
    render({ clearInput: true });
    say(g.word.word);
  }
}

// ---------- events ----------
const actions = {
  go: (d) => go(d.to),
  'pick-kid': (d) => {
    data.activeId = d.id;
    save(data);
    applyLook(profile());
    go('hub');
  },
  play: () => startRound(),
  'end-round': () => (ui.game.battle.asked ? finishRound() : go('hub')),
  hear: () => say(ui.game.word.word),
  'hear-sentence': () => say(ui.game.word.word, ui.game.word.sentence, ui.game.word.word),
  hint: () => {
    const g = ui.game;
    g.battle = { ...g.battle, hintsLeft: g.battle.hintsLeft - 1 };
    g.usedHint = true;
    render();
  },
  'open-super': () => {
    const themeId = ui.packTheme || THEMES[0].id;
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
    if (!w || !confirm(`Remove “${w.word}” from ${kid.name}'s words? Its stars are kept if you add it again.`)) return;
    update(removeWord(kid, d.id));
    render();
  },
  'test-voice': () => say('because', 'I stayed inside because it rained.'),
  'pack-theme': (d) => {
    ui.packTheme = d.id;
    ui.reveal = null;
    render();
  },
  'open-pack': () => {
    const themeId = ui.packTheme || THEMES[0].id;
    const { profile: p1, result } = openPack(profile(), themeId, Date.now());
    const { profile: p2, newly } = claimSetRewards(p1);
    update(p2);
    ui.reveal = result;
    render();
    if (newly.length) floatText(`🏅 ${newly[0].reward}! +${XP_PER.setComplete} XP`);
  },
  craft: (d) => {
    const item = ITEMS_BY_ID[d.id];
    if (!confirm(`Use ${CRAFT_COST[item.rarity]} shards to make ${item.name}?`)) return;
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
  } else if (kind === 'words') {
    const kid = data.profiles[ui.parentKid];
    const entries = parseWordList(form.words.value);
    if (!entries.length) return;
    const r = addWords(kid, entries, Date.now());
    update(r.profile);
    ui.flash = `${kid.name}'s words this week: ${entries.length} (${r.added} new${r.returning ? `, ${r.returning} from before` : ''}).`;
    render();
    window.scrollTo(0, 0);
  }
});

app.addEventListener('change', async (e) => {
  const kind = e.target.dataset.actionChange;
  if (kind === 'voice' || kind === 'rate') {
    if (kind === 'voice') data.settings.voiceURI = e.target.value || null;
    else data.settings.rate = Number(e.target.value);
    save(data);
    setSpeechPrefs(data.settings);
    say('because');
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
    setSpeechPrefs(data.settings);
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
  if (['hub', 'play', 'summary', 'packs', 'book', 'locker', 'words'].includes(ui.screen) && !profile()) ui.screen = 'home';
  if (ui.screen === 'play' && app.dataset.screen === 'play') {
    patchPlay(opts);
  } else {
    app.innerHTML = screens[ui.screen]();
    app.dataset.screen = ui.screen;
  }
  if (ui.screen === 'play') document.getElementById('answer')?.focus();
}

applyLook(profile());
ui.screen = profile() ? 'hub' : 'home';
render();
requestPersistence();
// A new version was installed: reload now, or after the round if one is in progress.
window.__klgUpdate = () => (ui.screen === 'play' ? (ui.pendingReload = true) : location.reload());
// Voices load late on some browsers; refresh the grown-ups screen when they arrive.
onVoicesChanged(() => ui.screen === 'parent' && render());
