# Kids Learning Game — Claude Instructions

An iPad learning game for Jason's kids: weekly spelling words plus multiplication/division fact practice, using spaced repetition inside a game.

## Start here
Read `README.md` first (status, decisions, where we left off). Open `recon.md` and `appeal-analysis.md` only when the task needs them.

## Product rules (don't break these)
- **Platform:** PWA, installable on iPad via Safari. Must work offline (service worker). Use Web Speech API for reading words aloud.
- **Game-first:** the game should be genuinely fun; heavy game-to-learning ratio is intentional.
- **Hard no:** purchases, ads, upsells, streak-loss guilt, leaderboards between kids.
- **Progress stays on the device** (IndexedDB/localStorage). No accounts, servers or sync for now.
- Randomized rewards are undecided; follow the candidate rules in `appeal-analysis.md` if prototyping them.

## Working style
- Be token-efficient: read only the files a task needs; don't read lockfiles, build output or `node_modules`.
- Keep build tooling minimal.
- At the end of a working session, update `README.md` (Status, Summary, Where we left off, date).
- Commit small and often. Ask Jason before merging, pushing to `main` or deleting branches.
