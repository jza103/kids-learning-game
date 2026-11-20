# Kids Learning Game (working title)

**Status:** spelling game and times tables game live on GitHub Pages
**Created:** 2026-11-17  **Last updated:** 2026-11-20

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
- **Voice:** optional natural AI voice from ElevenLabs (Jason's choice, 2026-11-19). The parent pastes an API key on the grown-ups screen; the key stays on the device and is left out of backups. Audio for each word and sentence is fetched once, saved in Cache Storage (`spelling-audio`, kept across app updates), and played offline. Each request carries spelling-test context (`previous_text`), the word-sentence-word playback is one clip so the word sounds the same each time, and the voice is tuned steady and a little slow (`CLIP_STYLE` in `src/aivoice.js`; bump it to re-make clips). Audio no word needs any more is cleaned up. Anything without saved audio falls back to the best built-in voice. Note: iPad Safari doesn't expose downloaded Premium voices to web pages (WebKit bug 237584). Background: `docs/voice-options.md`.
- **Collectibles have a purpose:** up to 3 on your team give powers (hints, damage, shields, XP boost, friend boost). Finishing a theme gives a title and XP.
- **Friends grow** (`src/friends.js`, 2026-11-20): each friend specializes in spelling, math or vocab, and its power only works in games it knows. Team friends get XP from answers (capped daily), level up, and evolve into ✨ Super Friends (level 5) and 💖 Best Friends (level 10), getting stronger. A friend brought to a game it doesn't know learns it over about a week of play. Other games plug in with `teamPowersFor` and `friendsAfterAnswer` (see `src/games.js`). Pacing math: `docs/friends-pacing.md`.
- **XP / Locker:** cosmetic only (hero, hat, color, title).

## How the times tables game works
- **Facts:** × and ÷ tables 0–12 (169 × facts, 156 ÷ facts, no ÷0). Each fact has its own 0–5 star rating, using the same scheduler as spelling words (`src/math.js`, stored in `profile.math`).
- **Modes:** Multiply, Divide, and Mixed (advanced). Kids pick "Smart mix" or any single table. Smart mix starts with 0, 1, 2, 10, 5 and opens the next table when 80% of open facts have 2+ stars. At most 5 new facts per round.
- **Practice vs Speed:** Practice has no timer, pays half coins and XP, and can take a fact only up to 3 stars. Speed gives a time per question (6 s default; the grown-ups screen offers 4–15 s). A right answer in time adds a star; a right answer after the timer still hits the monster but counts like a hinted answer (no star, half coins). So 5 stars means fast recall.
- **Anti-grind:** answering a fact before it's due pays 2 coins and adds no star. Mastering a fact pays 15 coins once, and every 2 mastered facts fill one Super Pack dot (shared with spelling).
- **Play:** 12-question monster battle with an on-screen number pad (keyboard digits and Enter work on a computer). A miss shows the right fact big and what the kid typed small and crossed out, then they type the answer once to lock it in. Hint = a skip-counting clue.
- **Friend hooks:** `mathPowers()` and `afterMathAnswer()` at the top of `src/mathgame.js` are where game-type-aware friend powers plug in.
- **Kid view:** "My facts" shows color-coded × and ÷ charts. Grown-ups screen shows mastered facts per table, tricky facts and the timer setting.

## How Word Match (vocabulary) works
- **Game:** tap a word, then tap what it means. No typing. A round is 3 boards of 4 words, each with one extra meaning so the last match isn't a free guess. Matches hit the same monsters as spelling. New words get a quick "New words!" card first and come in at most 6 per round. Works on iPhone (words in a 2×2 grid above the meanings), iPad and desktop (side by side).
- **Words:** each kid starts with 44 third-grade starter words (`src/vocab-words.js`, no synonym pairs so boards stay fair). Grown-ups add words with separate Word and Meaning boxes, ✎ edits, ✕ deletes, and "Put back deleted starter words" restores them. Words the parent adds come in before the remaining starter words.
- **Rewards:** only the first try at each word counts. It gets the same 0–5 stars as spelling (its own list, `profile.vocab`), pays 70% of the spelling coin table (`VOCAB_COIN_SCALE` in `src/vocab.js`), and mastering a word pays the usual mastery coins/XP and counts toward Super Packs. Team powers: 💡 hint takes away a wrong meaning; shield and power work as in spelling.
- Code: `src/vocab.js` (logic, tested in `test/vocab.test.js`), `src/vocab-ui.js` (screens and grown-ups editor, plugged into `app.js`).

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
- Last done (2026-11-20): times tables game (× ÷ mixed, practice and speed modes, per-fact mastery). Checked at iPhone, iPad and desktop sizes in a headless browser.
- Before that (2026-11-19): went live on GitHub Pages; added the growing word bank with mastery stars, Super Packs and ElevenLabs voice. Then, from Jason's listening: spelling-test context for AI clips, a live check of typed words with tips and a 🔊 preview per word, and ✕ now deletes a word completely (stars and audio). After the first playtest (iPhone): a miss shows the kid's attempt small and struck through under the correct spelling, and the grown-ups form has a word box plus an optional sentence box per word instead of the `|` syntax. Every way of adding words goes through `cleanEntries` in `src/profile.js`; `parseWordList` (pasted lists with `|`) is kept for bulk loading later.
- 2026-11-20: added Word Match, a tap-to-match vocabulary game with 44 starter words and a Word/Meaning editor on the grown-ups screen.
- Also (2026-11-20): friend specialties, XP, evolution and learning new games, with daily caps (`docs/friends-pacing.md`). Math and vocab games are being built in parallel and call the same friend hooks.
- Next:
  0. Jason: try friends with the kids; tune pacing numbers in `src/friends.js` if it's too slow or too fast.
  1. Jason: listen to the re-made clips; if a word still sounds odd, tune `WORD_CONTEXT`/`VOICE_SETTINGS` in `src/aivoice.js`.
  2. Play with the kids and tune the numbers in `src/economy.js`, `src/profile.js` (review mix) and `src/progress.js`.
  3. Play-test the times tables: is 6 s right? Is Smart mix opening tables at a good pace?
- Open questions:
  - iOS PWA storage eviction: backup/restore exists on the grown-ups screen; is that enough?
  - Curriculum file format once downloaded, and how to map it to item banks.

## Key files
- `index.html`, `styles.css`, `src/app.js` — the app UI
- `src/srs.js`, `src/economy.js`, `src/progress.js`, `src/battle.js`, `src/profile.js` — game and learning logic (pure, tested in `test/`)
- `src/math.js`, `src/mathgame.js` — times tables logic (tested in `test/math.test.js`) and UI
- `src/content.js` — collectibles (with specialty), monsters, cosmetics
- `src/games.js`, `src/friends.js`, `src/friendsui.js` — game types, friend growth logic, shared friend UI snippets
- `src/voices.js`, `src/speech.js`, `src/aivoice.js` — built-in voice ranking, speech playback, ElevenLabs audio
- `docs/voice-options.md` — AI voice options for a decision
- `sw.js`, `manifest.webmanifest`, `icons/` — offline and install support
- `recon.md` — competitor notes, dark patterns to avoid, basic design ideas
- `appeal-analysis.md` — why Blooket/Prodigy hook kids, loot-box research, proposed rules for ethical randomized rewards

