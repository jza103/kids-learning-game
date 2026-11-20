// Play styles. Each style makes a randomized kid (so many runs of one style
// give a spread of kids), and the kid's plan says what they play each day.
// A plan is a list of sessions: { hour, rounds: [{ game, n, until? }], farm }.
// `until(profile)` stops that game early (e.g. "until this week's list is mastered").
import { weekListMastered, newVocabLeft, mathLeft } from './learn.js';

const between = (rng, a, b) => a + rng() * (b - a);
const int = (rng, a, b) => Math.floor(between(rng, a, b + 1));
const ability = (rng, lo = 0.15, hi = 0.4) => ({ spelling: between(rng, lo, hi), vocab: between(rng, lo, hi), math: between(rng, lo + 0.1, hi + 0.15) });
const school = (weekday) => weekday >= 1 && weekday <= 5;

export const STYLES = {
  steady: {
    name: 'Steady daily practicer',
    make(rng) {
      const pd = between(rng, 0.75, 0.95);
      const pw = between(rng, 0.1, 0.4);
      const grove = between(rng, 0.4, 1);
      const spell = int(rng, 1, 2);
      const math = int(rng, 1, 2);
      return {
        label: `plays ${Math.round(pd * 100)}% of school days, ${spell} spelling + 1 Word Match + ${math} math rounds, Grove ${Math.round(grove * 100)}% of sessions`,
        ability: ability(rng),
        groveSkill: between(rng, 0.6, 1),
        plan({ weekday, rng: r }) {
          if (!(school(weekday) ? r() < pd : r() < pw)) return [];
          return [{ hour: 16, rounds: [{ game: 'spelling', n: spell }, { game: 'vocab', n: 1 }, { game: 'math', n: math }], farm: r() < grove }];
        },
      };
    },
  },

  crammer: {
    name: 'Weekend crammer',
    make(rng) {
      const math = int(rng, 6, 15);
      const grove = between(rng, 0.3, 1);
      return {
        label: `Saturdays only: spelling and Word Match until mastered, ${math} math rounds`,
        ability: ability(rng),
        groveSkill: between(rng, 0.6, 1),
        plan({ weekday, rng: r }) {
          if (weekday !== 6) return [];
          return [{
            hour: 10,
            rounds: [
              { game: 'spelling', n: 15, until: weekListMastered },
              { game: 'vocab', n: 10, until: (p) => newVocabLeft(p) === 0 },
              { game: 'math', n: math, until: (p) => mathLeft(p) === 0 },
            ],
            farm: r() < grove,
          }];
        },
      };
    },
  },

  grinder: {
    name: 'All-day grinder',
    make(rng) {
      const sessions = int(rng, 2, 4);
      return {
        label: `${sessions} long sessions every day, Grove every time`,
        ability: ability(rng),
        groveSkill: 1,
        plan() {
          return Array.from({ length: sessions }, (_, i) => ({
            hour: 9 + i * 4,
            rounds: [{ game: 'spelling', n: 3 }, { game: 'vocab', n: 2 }, { game: 'math', n: 5 }],
            farm: true,
          }));
        },
      };
    },
  },

  groveOnly: {
    name: 'Grove only (no learning)',
    make(rng) {
      return {
        label: 'opens only the Grove, 2-3 times a day',
        ability: ability(rng),
        groveSkill: 1,
        plan({ rng: r }) {
          const n = r() < 0.5 ? 2 : 3;
          return Array.from({ length: n }, (_, i) => ({ hour: 8 + i * 5, rounds: [], farm: true }));
        },
      };
    },
  },

  groveFirst: {
    name: 'Grove fan, minimal learning',
    make(rng) {
      const days = between(rng, 0.4, 0.8);
      return {
        label: `one quick math round on ${Math.round(days * 100)}% of days, Grove 2-3 times a day`,
        ability: ability(rng),
        groveSkill: 1,
        plan({ rng: r }) {
          const out = [{ hour: 8, rounds: r() < days ? [{ game: 'math', n: 1 }] : [], farm: true }];
          out.push({ hour: 15, rounds: [], farm: true });
          if (r() < 0.5) out.push({ hour: 19, rounds: [], farm: true });
          return out;
        },
      };
    },
  },

  prodigy: {
    name: 'Masters everything early',
    make(rng) {
      return {
        label: 'strong kid: already knows most facts, plays a lot in the first 3 weeks, then a little each day',
        ability: { spelling: between(rng, 0.5, 0.7), vocab: between(rng, 0.5, 0.7), math: between(rng, 0.8, 0.95) },
        groveSkill: between(rng, 0.6, 1),
        plan({ week, weekday, rng: r }) {
          if (week < 3) {
            return [{ hour: 16, rounds: [{ game: 'math', n: 8, until: (p) => mathLeft(p) === 0 }, { game: 'spelling', n: 4 }, { game: 'vocab', n: 4 }], farm: r() < 0.6 }];
          }
          if (weekday === 1) return [{ hour: 16, rounds: [{ game: 'spelling', n: 8, until: weekListMastered }, { game: 'vocab', n: 2 }, { game: 'math', n: 1 }], farm: r() < 0.6 }];
          return [{ hour: 16, rounds: [{ game: 'spelling', n: 1 }, { game: 'vocab', n: 1 }, { game: 'math', n: 1 }], farm: r() < 0.6 }];
        },
      };
    },
  },

  noGrove: {
    name: 'Never opens the Grove',
    make(rng) {
      const kid = STYLES.steady.make(rng);
      const plan = kid.plan;
      return { ...kid, label: `${kid.label.replace(/, Grove.*/, '')}, never opens the Grove`, plan: (a) => plan(a).map((s) => ({ ...s, farm: false })) };
    },
  },

  irregular: {
    name: 'On and off',
    make(rng) {
      const days = int(rng, 2, 5);
      const grove = rng();
      const breaks = [int(rng, 2, 26), int(rng, 2, 26)]; // two random weeks off
      return {
        label: `about ${days} days a week, random games, Grove ${Math.round(grove * 100)}% of sessions, two weeks off`,
        ability: ability(rng),
        groveSkill: between(rng, 0.3, 1),
        plan({ week, rng: r }) {
          if (breaks.includes(week) || r() > days / 7) return [];
          const games = ['spelling', 'vocab', 'math'];
          const rounds = Array.from({ length: int(r, 1, 4) }, () => ({ game: games[Math.floor(r() * 3)], n: 1 }));
          return [{ hour: 17, rounds, farm: r() < grove }];
        },
      };
    },
  },
};

/** A random kid from a mix of styles (for population runs). */
export const MIX = { steady: 3, irregular: 3, crammer: 1, noGrove: 2, grinder: 0.5, groveFirst: 0.5, prodigy: 1 };
