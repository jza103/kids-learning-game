# Kids Learning Game (working title)

**Status:** spelling MVP built (PR open), not yet tried on the iPad
**Created:** 2026-11-17  **Last updated:** 2026-11-19

_Moved from the `jza103/ideas` incubator repo on 2026-11-19._

## Summary
An iPad-friendly learning game for my kids. Parent loads weekly spelling words; kids master them through adaptive spaced repetition wrapped in a game. Also drills math facts (multiplication/division tables). Long-term: tie into the published curriculum and generate lessons/games dynamically.

## Running it
- No build step and no dependencies: plain HTML/CSS/ES modules.
- Tests (spaced repetition, coins, packs, battle): `npm test` (Node 18+).
- Try locally: `npm start`, then open http://localhost:8080.
- On the iPad: host the folder on any HTTPS static host (e.g. GitHub Pages), open it in Safari, then Share → Add to Home Screen. After the first load it works offline.
- Grown-ups screen: press and hold the 👪 button on the home or hub screen.

## How the spelling game works (MVP)
- **Players:** one profile per kid on the shared iPad, each with their own word list and progress.
- **Words:** parent pastes the week's list (`word | example sentence`, sentence optional). A new list keeps progress on returning words.
- **Practice:** Leitner boxes 0–5 (`src/srs.js`). Words are read aloud; missed and low-box words are picked more often. A miss sends a word back to box 0 and the kid copies it once to "lock it in". Mastered = box 5.
- **Game:** a 10-word monster battle. Correct answers hit, 3 in a row adds damage, a miss lets the monster heal 1. No timers, no losing.
- **Coins** (`src/economy.js`): only from correct answers, by box before answering (15/12/10/8/5/2), +5 for getting a recently missed word right, half for hinted answers.
- **Packs:** 60 coins, 3 per day, kid picks a theme (Ocean, Space, Forest; 10 friends each). Odds shown (65/28/7%). Rare+ guaranteed every 4 packs, epic every 12. Missing friends come before duplicates; duplicates give shards; shards craft any missing friend, so every set can be finished.
- **Collectibles have a purpose:** up to 3 on your team give powers (hints, damage, shields, XP boost). Finishing a theme gives a title and XP.
- **XP / Locker:** cosmetic only (hero, hat, color, title).

## Hypothesis / what we're trying to prove
- Kids will happily practice if the *game* is fun, without needing manipulative monetization.
- Spaced repetition (adaptive scheduling of missed items) beats flat quizzes for spelling + math facts.
- Weekly word-list loading is low-friction enough for a parent to sustain.

## Inspiration & recon (light, not vetted first-hand)
See `recon.md`. Short version: kids like Blooket (collection/reveal rewards, game variety) and Prodigy (RPG progression). Prodigy was the target of a 2021 FTC complaint over membership pressure on kids. We want the fun, not the dark patterns.

## Decisions
- **Platform: PWA** (installable on iPad via Safari, no App Store, offline via service worker, TTS via Web Speech API). (2026-11-17)
- **Progress storage: on-device only** for now (IndexedDB/localStorage; no accounts or sync). Consider export/import backup later since iOS can evict PWA storage. (2026-11-17)
- **Curriculum:** believed to be district-wide; user expects to download it and hand the files to Claude. Defer until MVP works.

- **Balance:** game-heavy over learning is intentional; it must compete with Blooket/Prodigy. (2026-11-17)
- **Hard no:** purchases/ads/upsell, streak-loss guilt, leaderboards between kids.
- **Randomized rewards: decided (2026-11-19)** after Jason tested Blooket with the kids: collectibles with rarity via packs, kept mild. Odds shown, pity guarantees, duplicates → shards, daily cap, kid picks a theme, collectibles give in-game powers and fill a collection book, coins only from correct answers (missed words pay more, mastered less), parent writes the content. Background in `appeal-analysis.md`.

## Where we left off
- Last done (2026-11-19): built the spelling MVP as an offline PWA following the Blooket-derived design rules (collectibles with rarity and a purpose, coins from correct answers, mild packs). Logic has unit tests; UI was smoke-tested in Chromium at iPad size.
- Next:
  1. Host it (GitHub Pages is simplest) and try it on the iPad with the kids: check speech voice, keyboard, and whether the economy numbers feel right.
  2. Tune numbers in `src/economy.js` / `src/progress.js` from real play.
  3. Math facts mode (same item model and scheduler).
- Open questions:
  - iOS PWA storage eviction: backup/restore exists on the grown-ups screen; is that enough?
  - Curriculum file format once downloaded (PDF? structured data?) and how to map it to item banks.

## Key files
- `index.html`, `styles.css`, `src/app.js` — the app UI
- `src/srs.js`, `src/economy.js`, `src/progress.js`, `src/battle.js`, `src/profile.js` — game and learning logic (pure, tested in `test/`)
- `src/content.js` — collectibles, monsters, cosmetics
- `sw.js`, `manifest.webmanifest`, `icons/` — offline and install support
- `recon.md` — competitor notes, dark patterns to avoid, basic design ideas
- `appeal-analysis.md` — why Blooket/Prodigy hook kids, loot-box research, proposed rules for ethical randomized rewards

