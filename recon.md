# Recon & Basic Ideas (light pass, 2026-11-17)

Sources are secondary (news, parent reviews); confirm by trying the apps.

## Blooket
- Teacher-hosted question sets turned into live, competitive class games; reportedly ~23 game modes.
- Draw (per parent guides/critics): variety of modes, plus collecting "Blooks" via reveals — a trading-card/loot-box feel. Some critics note reward mechanics outweigh the learning.
- Takeaway: variety + collection are the hooks. Keep collection, drop chance-based reveals tied to spending.

## Prodigy Math
- RPG/adventure wrapper around math questions; adaptive question difficulty.
- Criticism: 2021 FTC complaint by advocacy groups alleging it manipulates children into pressuring parents for Premium; paid members progress faster, get combat advantages; constant upsell; peer comparison. Company cites a small Johns Hopkins study showing a positive link to test scores. Claims are contested.
- Takeaway: progression + story are the hooks. Avoid pay-to-win, upsell nags, and public comparison.

## Dark patterns to avoid (design rules)
- No purchases, ads, or upsell UI of any kind (family app).
- No loot boxes / randomized paid rewards; any randomness is earned by effort, with transparent odds.
- No streak-loss guilt, countdown pressure, or manipulative "come back!" notifications.
- No leaderboards between kids by default; compare to *own* past performance (sibling race optional, opt-in).
- Parent dashboard shows real mastery, not just time-in-app. Built-in session cap/"all done for today."

## Basic ideas
**Learning engine**
- Leitner/spaced-repetition scheduler per kid per item: correct → move to a longer interval; wrong → back to start. Supported by classic research (1985 Rea & Modigliani: expanded retrieval roughly doubled 3rd-graders' retention of multiplication facts; significant benefit for spelling too — small old study).
- Spelling: parent pastes weekly list → TTS reads word + sentence → kid types/taps letters; variants: scramble, missing letters, listen-and-type.
- Math facts: ×/÷ tables with fluency timing (accuracy first, then speed); fact families linking ×/÷ (3×4=12 ↔ 12÷3=4); show which facts are "mastered / shaky / new".
- Content is just `{prompt, answer, type}` items so new subjects plug in; later, an LLM could generate items/lessons from curriculum standards.

**Game layer (reward effort, not spending)**
- Pick one core loop first (e.g., build/defend/collect creature world) where correct answers power progress.
- Rotating mini-game modes over the same item bank (Blooket-style variety).
- Collection earned by mastery milestones (e.g., "mastered all ×7 facts" → new creature).
- Optional sibling co-op (team goal) rather than competition.

**Curriculum tie-in (later)**
- Find how the school publishes curriculum (state standards, district pacing guide, textbook platform) and whether it's machine-readable; map standards → item banks → generated lessons.

## Tech starting points (undecided)
- PWA (installable on iPad, no App Store, offline via service worker, TTS via Web Speech API) vs native SwiftUI (better audio/polish, requires Apple dev setup).

## Sources
- [Edweek: Prodigy FTC complaint](https://www.edweek.org/technology/popular-interactive-math-game-prodigy-is-target-of-complaint-to-federal-trade-commission/2021/02)
- [Axios: Kids' online math game criticized by watchdogs](https://www.axios.com/2021/02/19/prodigy-math-game-ftc-complaint)
- [Common Sense Media: Prodigy](https://www.commonsensemedia.org/app-reviews/prodigy-kids-math-game)
- [Rea & Modigliani 1985 (spaced practice, math facts/spelling)](https://Www.Gwern.net/doc/psychology/spaced-repetition/1985-rea.pdf)
