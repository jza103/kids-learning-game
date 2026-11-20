// Mining look for the three learning games. Only presentation: the round
// itself runs on battle.js, so scoring and rewards don't change here.
//   spelling: ⛏️ Gem Dig       crack a rock open to find a gem
//   vocab:    🪣 Ore Sorting   fill an ore bucket with nuggets
//   math:     🛒 Mine Cart Run race the cart to the next station
import { MINE_TARGETS } from './content.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const ACTIVITIES = {
  spelling: { name: 'Gem Dig', emoji: '⛏️', game: 'Spelling', count: (n) => `💎 ${n} gem${n === 1 ? '' : 's'} found` },
  vocab: { name: 'Ore Sorting', emoji: '🪣', game: 'Word Match', count: (n) => `🪣 ${n} bucket${n === 1 ? '' : 's'} filled` },
  math: { name: 'Mine Cart Run', emoji: '🛒', game: 'Times tables', count: (n) => `🚉 ${n} station${n === 1 ? '' : 's'} reached` },
};

export const targetsFor = (kind) => MINE_TARGETS[kind];
export const randomStart = (kind) => Math.floor(Math.random() * MINE_TARGETS[kind].length);

/** Big button label for the hub. */
export function activityLabel(kind) {
  const a = ACTIVITIES[kind];
  return `${a.emoji} ${a.name}<div class="small">${a.game}</div>`;
}

/** The little burst between the hero and the target after a right answer. */
export function zapText(kind, damage) {
  const icon = { spelling: '⛏️', vocab: '🪨', math: '💨' }[kind];
  return `${icon}${damage > 1 ? ` ×${damage}` : ''}`;
}

export function clearedText(kind, t) {
  if (kind === 'spelling') return `You found ${/^[AEIOU]/.test(t.name) ? 'an' : 'a'} ${t.name}! 💎`;
  if (kind === 'vocab') return `Bucket full: ${t.name}! 🪣`;
  return `You reached ${t.name}! ${t.emoji}`;
}

/** What a miss does to the target: slides back 1 unless a shield friend stops it. */
export function missText(kind, events) {
  const shielded = events.some((e) => e.type === 'shielded');
  const slid = events.some((e) => e.type === 'healed');
  if (kind === 'spelling') return shielded ? '🪵 Your support beam held the rubble back.' : slid ? 'A little rubble slid back. Let\'s learn this one.' : 'Close! Let\'s learn this one.';
  if (kind === 'vocab') return shielded ? 'Not that one, but your bucket lid kept the ore in. Try again!' : slid ? 'Not that one, a nugget spilled. Try again!' : 'Not that one. Try again!';
  return shielded ? '🛞 Your brakes held the cart.' : slid ? 'The cart rolled back a little.' : '';
}

/** The anim class for the target after an answer. */
export function animFor(events) {
  if (events.some((e) => e.type === 'defeated')) return 'down';
  if (events.some((e) => e.type === 'hit')) return 'hit';
  if (events.some((e) => e.type === 'healed')) return 'slip';
  if (events.some((e) => e.type === 'shielded')) return 'held';
  return '';
}

const done = (t, hp) => (t.hp - hp) / t.hp; // 0..1 of the target finished

/**
 * The arena above the question. `from` is how far along the target was before
 * this answer (0..1), so the bar and cart slide from there; null = no slide.
 */
export function arenaHtml(kind, { hero, combo, zap, anim, target, hp, from = null }) {
  const to = done(target, hp);
  const slide = from != null && from !== to ? ' go' : '';
  const vars = `--from:${(from ?? to).toFixed(3)};--to:${to.toFixed(3)}`;
  const streak = combo >= 2 ? `🔥 ${combo} in a row` : '&nbsp;';
  if (kind === 'math') {
    return `<div class="arena mine cart-run ${anim || ''}">
      <div class="run-head"><span class="small">${streak}</span><span class="zap">${zap || ''}</span>
        <span class="small"><strong>Next: ${target.emoji} ${esc(target.name)}</strong></span></div>
      <div class="track" style="${vars}">
        <div class="rails"></div>
        <div class="station">${target.emoji}</div>
        <div class="cart${slide}"><span class="rider">${hero}</span>${CAR}</div>
      </div>
    </div>`;
  }
  const bar = `<div class="mine-bar" style="${vars}"><div class="${slide.trim()}"></div></div>`;
  let art;
  if (kind === 'spelling') {
    const cracks = Math.round(to * CRACKS.length);
    art = hp === 0
      ? `<span class="gem ${anim || ''}" style="filter:${target.look}">${target.emoji}</span>`
      : `<span class="rock ${anim || ''}">🪨<svg viewBox="0 0 100 100" aria-hidden="true">${CRACKS.slice(0, cracks).map((d) => `<path d="${d}"/>`).join('')}</svg></span>`;
  } else {
    art = `<span class="bucket ${anim || ''}"><span class="ore" style="height:${Math.round(to * 100)}%;background:${target.color}"></span>${hp === 0 ? '<span class="stamp">FULL!</span>' : ''}</span>`;
  }
  return `<div class="arena mine ${kind === 'spelling' ? 'dig' : 'sort'}">
      <div><span class="digger">${hero}${kind === 'spelling' ? '<span class="tool">⛏️</span>' : ''}</span><div class="small" style="margin-top:6px">${streak}</div></div>
      <div class="zap">${zap || ''}</div>
      <div>
        ${art}
        <div class="small"><strong>${hp === 0 ? '✨ ' : ''}${esc(target.name)}</strong></div>
        ${bar}
      </div>
    </div>`;
}

const CAR = '<span class="car"><span class="bin"></span><span class="wheel"></span><span class="wheel r"></span></span>';

// Cracks drawn as the rock breaks, in order.
const CRACKS = [
  'M50 22 L46 38 L54 48',
  'M54 48 L48 62 L56 74',
  'M54 48 L68 54 L76 66',
  'M46 38 L32 44 L26 56',
  'M48 62 L36 70 L30 80',
  'M56 74 L64 84',
  'M68 54 L80 48',
];

/** A mini track for cart races (time trials): the cart moves one step per fact. */
export function trialTrackHtml(hero, from, to) {
  return `<div class="track mini" style="--from:${from.toFixed(3)};--to:${to.toFixed(3)}">
      <div class="rails"></div><div class="station">🏁</div>
      <div class="cart${from !== to ? ' go' : ''}"><span class="rider">${hero}</span>${CAR}</div>
    </div>`;
}
