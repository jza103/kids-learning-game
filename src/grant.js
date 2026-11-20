// Grown-ups screen: give a kid any resource, for testing and balancing.
// Gifts go straight in and never count as learning (no stars, no mastery).
import { farmOf, sunJar } from './farm.js';

export const RESOURCES = [
  { id: 'nuggets', label: 'Nuggets', emoji: '🟡', steps: [50, 200, 1000], get: (p) => p.coins, add: (p, n) => ({ ...p, coins: p.coins + n }) },
  { id: 'dust', label: 'Gem dust', emoji: '💎', steps: [20, 60, 150], get: (p) => p.shards, add: (p, n) => ({ ...p, shards: (p.shards || 0) + n }) },
  { id: 'xp', label: 'XP', emoji: '⭐', steps: [100, 500], get: (p) => p.xp, add: (p, n) => ({ ...p, xp: p.xp + n }) },
  { id: 'super', label: 'Super Packs', emoji: '🌟', steps: [1, 5], get: (p) => p.superPacks, add: (p, n) => ({ ...p, superPacks: (p.superPacks || 0) + n }) },
  {
    id: 'packs', label: "Today's packs", emoji: '🎁', steps: ['reset'], get: (p) => p.packs.openedToday || 0, getLabel: 'opened today',
    add: (p) => ({ ...p, packs: { ...p.packs, openedToday: 0 } }),
  },
  { id: 'sun', label: 'Sunshine', emoji: '☀️', steps: [10, 50, 200], get: (p) => sunJar(p), add: (p, n) => ({ ...p, sunJar: sunJar(p) + n }) },
  { id: 'bells', label: 'Grove Bells', emoji: '🔔', steps: [50, 200, 1000], get: (p) => farmOf(p).bells, add: (p, n) => farmAdd(p, (f) => ({ ...f, bells: f.bells + n })) },
  { id: 'seeds', label: 'Wonder Seeds', emoji: '🌟', steps: [1, 5], get: (p) => farmOf(p).wonderSeeds || 0, add: (p, n) => farmAdd(p, (f) => ({ ...f, wonderSeeds: (f.wonderSeeds || 0) + n })) },
  { id: 'eggs', label: 'Mystery Eggs', emoji: '🥚', steps: [1, 3], get: (p) => farmOf(p).eggs || 0, add: (p, n) => farmAdd(p, (f) => ({ ...f, eggs: (f.eggs || 0) + n })) },
  { id: 'farmxp', label: 'Farm XP', emoji: '🌻', steps: [100, 1000], get: (p) => farmOf(p).xp, add: (p, n) => farmAdd(p, (f) => ({ ...f, xp: f.xp + n })) },
];
const BY_ID = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));

function farmAdd(p, fn) {
  return { ...p, farm: fn(farmOf(p)) };
}

/** Give `n` of resource `id` to a kid. Returns the new profile. */
export function grant(profile, id, n) {
  const r = BY_ID[id];
  if (!r) throw new Error(`unknown resource ${id}`);
  return r.add(profile, n);
}

export function grantHtml(kid, esc) {
  if (!kid) return '';
  const rows = RESOURCES.map((r) => `<div class="grant-row"><span>${r.emoji} ${r.label}: <strong>${r.get(kid)}</strong>${r.getLabel ? ` ${r.getLabel}` : ''}</span>
      <span class="row">${r.steps
        .map((s) => `<button class="small-btn secondary" data-action="grant" data-id="${r.id}" data-n="${s}">${s === 'reset' ? 'Reset' : `+${s}`}</button>`)
        .join('')}</span></div>`).join('');
  return `<div class="card">
    <h3>🧰 Give ${esc(kid.name)} resources</h3>
    <p class="small muted">For testing and balancing. Gifts go straight in and don't count as learning: no stars, mastery or Legendaries.</p>
    <div class="grant-list">${rows}</div>
  </div>`;
}

export const grantName = (id) => `${BY_ID[id].emoji} ${BY_ID[id].label}`;
