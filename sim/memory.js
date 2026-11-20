// A simple model of what a kid really remembers, kept apart from the game's
// own stars. The game's Leitner box says what the game *thinks*; this says
// whether the kid would actually get it right.
//
// Each item has a hidden stability S (days). The forgetting curve and the
// stability updates follow FSRS (the open model behind Anki's scheduler), with
// difficulty fixed at a middling value:
//   recall chance after t days: R = 1 / (1 + t / (9 S))
//   right answer: S *= 1 + G * S^-0.12 * (e^(1 - R) - 1)
//   miss:         S = min(S, 1.5 * ((S + 1)^0.3 - 1) * e^(2 (1 - R))), then the
//                 kid copies the answer (the game's "lock it in")
// The spacing effect falls out of the e^(1 - R) term: answering a word five
// times in ten minutes (R near 1) barely grows S, answering it once a day for
// five days (R around 0.8-0.9 each time) grows it a lot.
//
// The numbers are rough, not fitted to kids. They are in MEMORY so they're
// easy to change; README.md in this folder says which results depend on them.

export const DAY = 864e5;

export const MEMORY = {
  firstLearn: 1, // S (days) after first meeting an item and copying it
  growth: 20, // G above
  missFloor: 0.5, // S after a miss is at least this (copying the answer)
  maxS: 400,
  preKnownS: 60, // an item the kid already knew before the game
  vocabGuess: 0.3, // tapping a meaning: chance to get it right by elimination
  warmupRecall: 0.97, // 0, 1, 2 facts
};

export class Memory {
  /** ability: { spelling, vocab, math } = chance an item is already known before the game. */
  constructor(rng, ability) {
    this.rng = rng;
    this.ability = ability;
    this.items = new Map();
  }

  get(game, id, now) {
    const key = `${game}:${id}`;
    let m = this.items.get(key);
    if (!m) {
      const known = this.rng() < (this.ability[game] ?? 0);
      m = { S: known ? MEMORY.preKnownS : 0, last: now, game, introduced: now };
      this.items.set(key, m);
    }
    return m;
  }

  recall(m, now) {
    if (!m.S) return 0;
    return 1 / (1 + (now - m.last) / DAY / (9 * m.S));
  }

  /** Does the kid answer right? Updates the memory. */
  answer(game, id, now, { warmup = false } = {}) {
    const m = this.get(game, id, now);
    if (warmup) {
      m.warm = true;
      m.S = MEMORY.maxS;
      m.last = now;
      return this.rng() < MEMORY.warmupRecall;
    }
    const r = this.recall(m, now);
    const p = game === 'vocab' ? r + (1 - r) * MEMORY.vocabGuess : r;
    const correct = this.rng() < p;
    if (!m.S) m.S = MEMORY.firstLearn;
    else if (correct) m.S = Math.min(MEMORY.maxS, m.S * (1 + MEMORY.growth * m.S ** -0.12 * (Math.exp(1 - r) - 1)));
    else m.S = Math.max(MEMORY.missFloor, Math.min(m.S, 1.5 * ((m.S + 1) ** 0.3 - 1) * Math.exp(2 * (1 - r))));
    m.last = now;
    return correct;
  }

  /** Share of a game's items the kid would get right at `now` (and how many items). */
  retention(game, now) {
    let sum = 0;
    let n = 0;
    for (const m of this.items.values()) {
      if (m.game !== game || m.warm) continue;
      sum += this.recall(m, now);
      n++;
    }
    return { share: n ? sum / n : 0, n };
  }
}
