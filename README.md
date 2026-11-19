# Kids Learning Game (working title)

**Status:** spelling game live on GitHub Pages; word bank, mastery rewards and voice picker added
**Created:** 2026-11-17  **Last updated:** 2026-11-19

_Moved from the `jza103/ideas` incubator repo on 2026-11-19._

## Summary
An iPad-friendly learning game for my kids. Parent loads weekly spelling words; kids master them through adaptive spaced repetition wrapped in a game. Also drills math facts (multiplication/division tables). Long-term: tie into the published curriculum and generate lessons/games dynamically.

## Running it
- No build step and no dependencies: plain HTML/CSS/ES modules.
- Tests (spaced repetition, coins, packs, battle): `npm test` (Node 18+).
- Try locally: `npm start`, then open http://localhost:8080.
- Hosting: `.github/workflows/pages.yml` publishes to GitHub Pages on every push to `main` (needs Settings → Pages → Source: GitHub Actions; a private repo needs GitHub Pro for Pages). Site: https://jza103.github.io/kids-learning-game/
- On the iPad: open the site in Safari, then Share → Add to Home Screen. After the first load it works offline.
- Grown-ups screen: press and hold the 👪 button on the home or hub screen.

## How the spelling game works (MVP)
- **Players:** one profile per kid on the shared iPad, each with their own word list and progress.
- **Word bank:** each week the parent adds about 10 words (`word | example sentence`). They join a growing bank and become "this week's" words. Older words keep their 0–5 star mastery rating, and due ones come back for review: about 20% of picks, at most 3 per round, more when this week's words are all caught up. Adding an old word again puts it back in this week's set.
- **Practice:** Leitner boxes 0–5 (`src/srs.js`). Words are read aloud; missed and low-box words are picked more often. A miss sends a word back to box 0 and the kid copies it once to "lock it in". Mastered = box 5.
- **Game:** a 10-word monster battle. Correct answers hit, 3 in a row adds damage, a miss lets the monster heal 1. No timers, no losing.
- **Coins** (`src/economy.js`): only from correct answers, by box before answering (15/12/10/8/5/2), +5 for getting a recently missed word right, half for hinted answers.
- **Mastery = big rewards:** the first time a word reaches 5 stars, it pays 30 coins and 50 XP, and every 5 mastered words earn a **Super Pack** with a guaranteed **ultra** friend (2 per theme; not craftable, not in normal packs, not limited by the daily cap).
- **Packs:** 60 coins, 3 per day, kid picks a theme (Ocean, Space, Forest; 10 friends each). Odds shown (65/28/7%). Rare+ guaranteed every 4 packs, epic every 12. Missing friends come before duplicates; duplicates give shards; shards craft any missing friend, so every set can be finished.
- **Voice:** optional natural AI voice from ElevenLabs (Jason's choice, 2026-11-19). The parent pastes an API key on the grown-ups screen; the key stays on the device and is left out of backups. Audio for each word and sentence is fetched once, saved in Cache Storage (`spelling-audio`, kept across app updates), and played offline. Anything without saved audio falls back to the best built-in voice. Note: iPad Safari doesn't expose downloaded Premium voices to web pages (WebKit bug 237584). Background: `docs/voice-options.md`.
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
- Last done (2026-11-19): went live on GitHub Pages; then added the growing word bank with mastery stars, mastery-driven Super Packs with ultra friends, and better voice selection, all from Jason's first feedback.
- Next:
  1. Jason: create an ElevenLabs key and paste it in grown-ups → Voice; check the kids like the voice.
  2. Play with the kids and tune the numbers in `src/economy.js`, `src/profile.js` (review mix) and `src/progress.js`.
  3. Math facts mode (same item model and scheduler).
- Open questions:
  - iOS PWA storage eviction: backup/restore exists on the grown-ups screen; is that enough?
  - Curriculum file format once downloaded, and how to map it to item banks.

## Key files
- `index.html`, `styles.css`, `src/app.js` — the app UI
- `src/srs.js`, `src/economy.js`, `src/progress.js`, `src/battle.js`, `src/profile.js` — game and learning logic (pure, tested in `test/`)
- `src/content.js` — collectibles, monsters, cosmetics
- `src/voices.js`, `src/speech.js`, `src/aivoice.js` — built-in voice ranking, speech playback, ElevenLabs audio
- `docs/voice-options.md` — AI voice options for a decision
- `sw.js`, `manifest.webmanifest`, `icons/` — offline and install support
- `recon.md` — competitor notes, dark patterns to avoid, basic design ideas
- `appeal-analysis.md` — why Blooket/Prodigy hook kids, loot-box research, proposed rules for ethical randomized rewards

