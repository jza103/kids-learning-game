# School-year simulator

Plays whole school years with made-up kids, using the game's real code in `src/`
(spelling, Word Match, times tables, coins, packs, Super Packs, Legendaries,
Friend Grove). Change a number in `src/`, rerun, and see what it does to a year.

No setup: Node 18+ and nothing to install.

## Commands

```sh
node sim/run.js                          # every play style, 12 kids each (a few minutes; same as npm run sim)
node sim/run.js --style steady --runs 40 # one style, more kids
node sim/run.js --style steady,crammer   # a few styles side by side
node sim/run.js --style mix --runs 100   # a random mix of kids (weights in MIX, styles.js)
node sim/run.js --seed 7                 # different random kids (same seed = same kids)
node sim/run.js --memory forgetful       # kids who forget faster (or: sharp)
node sim/run.js --rules dailyFrom=2      # try other star rules (STAR_RULES in src/srs.js)
node sim/run.js --json sim/out/run.json  # also save every kid's full results
node sim/exploits.js                     # quick checks of known exploits (npm run sim:exploits)
```

`run.js` prints a Markdown table: for each play style, the median kid and, in
brackets, the 10th to 90th percentile. "never" means some kids never got there.
`sim/out/` is ignored by git, so save runs there.

## What a year is

- Starts Monday 30 November 2026, runs 28 weeks (to mid-June). Monthly friend
  themes open on their real dates.
- 25 weeks have a new list: 10 spelling words and 6 Word Match words every
  Monday (on top of the 44 starter words). Change `YEAR` in `year.js` once the
  real number of school weeks is known.
- Times tables: all of them, with Speed mode at 6 seconds.

## Play styles (`styles.js`)

Each style makes a different random kid on every run (how many days they
play, how many rounds, how often they open the Grove, how much they already know).

| Style | Who |
|---|---|
| `steady` | plays most school days after school: 1-2 spelling, 1 Word Match, 1-2 math rounds |
| `crammer` | Saturdays only: spelling and Word Match until mastered, then lots of math |
| `grinder` | 2-4 long sessions every day, Grove every time (slow to run: ~30 s a kid) |
| `groveOnly` | opens only the Grove, never learns |
| `groveFirst` | one quick math round on some days, Grove 2-3 times a day |
| `prodigy` | already knows most facts, plays a lot for 3 weeks, then a little daily |
| `noGrove` | like `steady`, never opens the Grove |
| `irregular` | 2-5 days a week, random games, Grove sometimes, two weeks off |

To add a style, copy one in `styles.js`. A plan is a list of sessions per day:
`{ hour, rounds: [{ game: 'spelling' | 'vocab' | 'math', n, until }], farm }`.

## How a kid answers (`memory.js`)

The game's stars say what the game thinks the kid knows. The sim also keeps
what the kid *really* knows, with a forgetting model taken from FSRS (the
scheduler Anki uses): each word or fact has a stability that grows a lot when
it's answered right after a gap, and barely when it's answered again minutes
later. That is how the sim tells cramming from spaced practice. "Really known"
in the table means the model gives the kid an 80%+ chance of getting it right
on the last day.

The numbers are a reasonable guess, not measured on kids. Results that depend
on them: "really known" and every mastery count. Results that don't: coin,
pack, Bells and shard totals for a given amount of play, and Grove timings.
Run with `--memory forgetful` and `--memory sharp` to see how much a finding
moves; trust the ones that hold up in both.

## How the Grove is played (`farmbot.js`)

A fair, fairly sharp player: keeps crews full of rested friends, plants every
plot, crafts the most profitable recipe, fills requests, sells extras, runs
expeditions and buys the cheapest thing it can afford (crew spots and lands
first). A real kid will be slower, so Grove dates here are on the early side.
It doesn't use perks, gifts or crystal decorations.

## Files

- `run.js`: runs many kids in parallel and prints the table (`METRICS` lists the rows).
- `year.js`: one kid, one year; `YEAR` sets the calendar.
- `learn.js`: plays spelling, Word Match and math rounds and shops for packs.
- `farmbot.js`: plays the Grove.
- `styles.js`: play styles.
- `memory.js`: what the kid really remembers.
- `exploits.js`: checks for specific exploits.
