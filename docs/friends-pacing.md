# Friend growth: pacing math

Friends (collectibles) specialize in one game type and grow when they play. The numbers live in `src/friends.js`; this note explains them so they're easy to tune after play tests.

## The rules
- **Specialty.** Every friend has one game type: ✏️ spelling, ✖️ math or 📚 vocab (`specialty` in `src/content.js`). Each theme has 4 of each, so any theme you collect helps every game. Packs still drop friends of any specialty, whichever game earned the coins.
- **Powers only work where a friend knows the game.** `teamPowersFor(profile, gameType)` counts only team friends whose specialty, or a learned game type, matches.
- **Friend XP.** Every answer gives each team friend XP: correct 4, hinted 2, wrong 1. A friend outside the games it knows is *learning*, so it gets ×1.5. Untimed practice modes give ×0.5.
- **Daily cap.** Each friend can earn 100 base XP a day, then it's "😴 sleepy" until tomorrow. The cap counts XP before Friend boost.
- **Levels and evolution.** XP for level L is `50 × (L−1) × L`, the same curve as the player's. Level 5 is **✨ Super Friend** (+1 power), level 10 (max) is **💖 Best Friend** (+2 power).
- **Learning a game type.** Each correct or hinted answer in an unknown game type gives 1 training point, at most 10 per friend per day. At 50 points the friend learns that game, and its power works there at full strength. Friends and Super Friends can learn **one** extra game type. Best Friends can learn the third.
- **New skills.** *XP boost* (`xp`): +10% player XP per strength. *Friend boost* (`buddy`): +10% friend XP per strength for the whole team, capped at +50%.

## How fast is that?
A round is 10 answers. At about 80% correct, one friend earns about 34 XP a round, or about 50 if it's learning. So about 3 rounds a day (2 if it's learning) hits the daily cap. That's a normal session for a kid who plays every day, so in practice the cap and the curve set the pace, not how much they grind.

| Milestone | Fastest possible (capped every day) | Playing 1–2 rounds most days |
|---|---|---|
| Level 2 | 1 day | 2–3 days |
| ✨ Super Friend (level 5, 1,000 XP) | 10 days | 3–5 weeks |
| 💖 Best Friend (level 10, 4,500 XP) | 45 days | 3–5 months |
| Learn a new game type (50 points) | 5 days of playing that game | 2–3 weeks |

A team holds 3 friends, so at most 3 friends grow at once. With 60 friends, there is always another friend to raise. The first week brings a few level-ups and maybe a learned game type, not a maxed collection.

Friend boost can shorten the curve by at most a third (+50%). An all-ultra, all-Best-Friend team is a months-long goal.

## Tests that guard this
`test/friends.test.js` plays a friend for 300 answers a day and checks that Super Friend takes exactly 10 days and Best Friend 45, that learning takes 5 days, and that the caps reset daily. If you change a number, those tests show the new pace.

## Tuning knobs
`DAILY_FRIEND_XP`, `FRIEND_XP`, `LEARNING_XP_BONUS`, `PRACTICE_SCALE`, `DAILY_TRAINING`, `TRAINING_TO_LEARN`, `MAX_BUDDY_BOOST`, `STAGES` and `friendXpForLevel` in `src/friends.js`.

## Collection pace (packs)
5 themes × 12 friends = 60: 30 common, 15 rare, 5 epic from packs, plus 10 ultras only from Super Packs. Packs are capped at 5 a day (`DAILY_PACK_CAP` in `src/economy.js`).

A simulation of a kid who opens all 5 packs every day, always picks the theme with the most missing friends and crafts with shards as soon as possible finishes the 50 pack friends in about **12 days (10–15)**. That matched the old setup (36 friends, 3 a day). In practice coins slow it down: 5 packs cost 300 coins, about 3–4 rounds, so a kid playing 2 rounds a day opens about 3 packs and needs about 3 weeks. The 10 ultras need 50 mastered words (2 math facts count as one word), which is months.

When you add a theme, keep its shape (6 common, 3 rare, 1 epic, 2 ultra; 4 friends per game type). `test/economy.test.js` checks this. Each new theme adds about 2–3 days to the fastest finish at 5 packs a day.
