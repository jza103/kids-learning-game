// The monster battle that wraps each practice round. No timers and no way to
// lose: a miss only lets the monster heal a little.
import { MONSTERS } from './content.js';

export const ROUND_LENGTH = 10;
export const COMBO_STEP = 3; // every 3 in a row adds +1 damage

export function newBattle(powers, monsterIndex = 0) {
  return {
    ...spawn(monsterIndex),
    combo: 0,
    hintsLeft: powers.hint,
    shieldsLeft: powers.shield,
    defeated: 0,
    asked: 0,
  };
}

function spawn(index) {
  const m = MONSTERS[index % MONSTERS.length];
  return { monsterIndex: index, monster: m, hp: m.hp, maxHp: m.hp };
}

export function applyAnswer(battle, result, powers) {
  const b = { ...battle, asked: battle.asked + 1 };
  const events = [];
  if (result === 'wrong') {
    b.combo = 0;
    if (b.shieldsLeft > 0) {
      b.shieldsLeft--;
      events.push({ type: 'shielded' });
    } else if (b.hp < b.maxHp) {
      b.hp++;
      events.push({ type: 'healed' });
    }
    return { battle: b, events };
  }
  b.combo = result === 'correct' ? b.combo + 1 : 0;
  const comboBonus = Math.floor(b.combo / COMBO_STEP);
  const damage = 1 + powers.power + comboBonus;
  b.hp = Math.max(0, b.hp - damage);
  events.push({ type: 'hit', damage });
  if (b.hp === 0) {
    events.push({ type: 'defeated', monster: b.monster });
    Object.assign(b, spawn(b.monsterIndex + 1));
    b.defeated++;
  }
  return { battle: b, events };
}

export function roundOver(battle) {
  return battle.asked >= ROUND_LENGTH;
}

/** Reveal the first `n` letters of a word, the rest as blanks. */
export function hintText(word, n = Math.max(1, Math.ceil(word.length / 3))) {
  return [...word].map((ch, i) => (i < n || !/[a-z]/i.test(ch) ? ch : '_')).join(' ');
}
