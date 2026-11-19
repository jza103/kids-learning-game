# Kids Learning Game (working title)

**Status:** idea
**Created:** 2026-11-17  **Last updated:** 2026-11-19

_Moved from the `jza103/ideas` incubator repo on 2026-11-19._

## Summary
An iPad-friendly learning game for my kids. Parent loads weekly spelling words; kids master them through adaptive spaced repetition wrapped in a game. Also drills math facts (multiplication/division tables). Long-term: tie into the published curriculum and generate lessons/games dynamically.

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
- **Randomized rewards: undecided.** Candidate rule set in `appeal-analysis.md`; leaning toward earned-only, no-dud, finite-collection reveals (pick-1-of-3 or expedition style). Try (b)/(c) first.

## Where we left off
- Last done: captured idea, light recon (`recon.md`), made the platform/storage/curriculum decisions above.
- Next session (deep dive): scope the MVP in detail.
  1. Define MVP: spelling-word import (paste list) + one game loop + Leitner-style scheduler, all offline in the PWA.
  2. Pick stack (plain JS/TS vs a small framework; keep build tooling minimal) and data model (`{prompt, answer, type}` items, per-kid box/due-date state).
  3. Pick the core game loop/theme with the kids' input.
  4. Briefly play Blooket + Prodigy to confirm what the draw is.
- Open questions:
  - iOS PWA storage eviction/backup approach.
  - Curriculum file format once downloaded (PDF? structured data?) and how to map it to item banks.
  - Per-kid profiles on a shared iPad.

## Key files
- `recon.md` — competitor notes, dark patterns to avoid, basic design ideas
- `appeal-analysis.md` — why Blooket/Prodigy hook kids, loot-box research, proposed rules for ethical randomized rewards

