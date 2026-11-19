# What makes Blooket / Prodigy appealing, and where we draw the line (2026-11-17)

Sources are secondary (reviews, parent guides, vendor blogs). The "design read" sections are our own analysis, not research findings. Engagement stats found in blog posts (e.g. "60% more engagement") were unsourced; ignore them.

## Appeal hooks (what the sources describe)

| Hook | Blooket | Prodigy |
|------|---------|---------|
| Collection | "Blooks": cute collectible characters, rarity tiers, opened from token-bought packs; used as avatars to show off | Pets: collected, trained, form a battle team |
| Progression | Light; mostly per-match | Heavy: RPG levels, gear, zones with storylines, daily/weekly/seasonal quests |
| Variety | Many modes (Gold Quest, Cafe, etc.) over the same question set | One main RPG loop plus battles/minigames |
| Low friction | Join with a code, no account needed | Character creation, then open world |
| Identity | Avatar/Blook as self-expression | Customizable character, pets |
| Social | Live class competition, stealing/sabotage modes | Mostly solo, some friends/peer features |

## Known downsides reported
- Blooket: luck-heavy modes make scores reflect chance; kids feel it's unfair; reward-chasing can pull attention from the questions; some "Blook anxiety" from comparing collections.
- Prodigy: paid members progress faster, constant upsell; 2021 FTC complaint (contested).

## Design read: why each works
1. **Collection with identity.** Things you collect are also things you *show* (avatar, team). Cute and a bit weird beats polished.
2. **Effort converts to a currency, currency converts to a surprise.** The answer is the work; the reveal is the payoff.
3. **Variety over a fixed content bank.** New modes make the same words/facts feel fresh. Cheap for us because items are `{prompt, answer, type}`.
4. **Progression with a visible next step.** Always one more quest/level/pet within reach.
5. **No setup before fun.** Seconds to first play.

The learning is the toll to access 1-4. That's fine for us (the game-heavy balance is intentional), as long as the toll is spaced repetition, so the questions asked are the useful ones.

## Lines we won't cross (decided)
No purchases, ads or upsell; no streak-loss guilt; no leaderboards between kids.

## Loot-box question (open)

**What the research says.** The best-known child-focused study (Newcastle/Loughborough, 2022, "Between Gaming and Gambling") links harm to *paid* chance mechanics: spending pressure, rarity-as-status, near-miss feelings, and shame/disappointment from random outcomes. A libertarian think tank (Reason) disputes the evidence of widespread harm. I found nothing comparing free, earned randomness with paid randomness for kids, so the distinction below is our reasoning, not a finding.

**Two Point Museum.** Reviewers do call its expeditions loot-box-like (VGC: "a loot box element... without microtransactions"). My read of why it feels fine, from reviews rather than the developer (no official design statement found):
- No money touches the randomness.
- Player choices shape the outcome (stat-gated crew choices).
- Every result is a keepable thing you display, so nothing is a dud.
- It's slow and one-player; no rarity-as-status or comparison.
(One DLC pack exists as a paid add-on, but it is separate from the reward mechanic.)

### Proposed test for any randomized reward in our app
A reveal is OK only if all of these hold:
1. **Earned, never bought.** Currency comes only from correct practice. Nothing in the app costs money.
2. **No duds.** Every reveal gives something you keep and can show off. No "common junk" tier that makes a pull feel like a loss.
3. **Rarity isn't status.** No visible rarity rankings or compare-collections screens. Siblings can't rank each other.
4. **No near-miss theatrics or spend-more-to-improve odds.**
5. **Bounded and calm.** Capped per day, no slot-machine spinning, a finite collection that can be *completed* (an end state, unlike an endless chase).
6. **Effort gives agency.** Prefer choice among a few options, or a themed expedition where the kid picks what to send, over a pure random draw.
7. **Transparent.** A parent can see the rules; pity-timers guarantee the full collection arrives in a known number of earned rewards.

Options on the spectrum, mildest to strongest hook: (a) deterministic unlocks at mastery milestones; (b) pick 1 of 3 offered; (c) expedition/"dig" with a themed pool and no duds; (d) blind packs of a finite set with pity guarantee. I suggest prototyping (b)/(c) first; they get most of the reveal excitement with the least risk.

## Sources
- [Blooket parent guide (Screenwise)](https://screenwiseapp.com/guides/parents-guide-to-blooket)
- [Blooket review (AhaSlides)](https://ahaslides.com/blog/blooket-review/)
- [Common Sense: Blooket](https://www.commonsense.org/education/reviews/blooket)
- [Prodigy parents guide](https://prodigygame.com/blog/parents-guide-to-prodigy)
- [Prodigy: Treasure Track](https://www.prodigygame.com/prodigy-newsroom/insideprodigy-how-our-game-team-made-learning-even-more-fun-with-treasure-track)
- [Loughborough: loot boxes and children (2022)](https://www.lboro.ac.uk/media-centre/press-releases/2022/november/loot-box-report-emotional-financial-harm-children/)
- [Reason: loot box "moral panic" brief](https://reason.org/policy-brief/video-game-loot-boxes-anatomy-of-a-moral-panic/)
- [VGC: Two Point Museum review](https://videogameschronicle.com/review/two-point-museum-review)
- [Press Start: Two Point Museum preview](https://press-start.com.au/previews/2024/12/04/two-point-museum-hands-on-preview-excellentpeditions)
